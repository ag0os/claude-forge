# Forkhestra Prompt Support

Add the ability to pass initial prompts to agents orchestrated by forkhestra.

## Problem Statement

Currently forkhestra can pass `args` (CLI flags) to agents, but has no way to pass the **initial prompt** - the actual instruction that tells the agent what to do.

When running Claude agents directly:
```bash
claude "Please create tasks from requirements.md"
```

But forkhestra just runs agents without instructions:
```bash
forkhestra "task-manager:3 -> task-coordinator:10"
# No way to tell agents WHAT to do
```

Agents have system prompts that define their capabilities, but they need runtime prompts to know what specific task to perform.

## Design

### Config Schema

Extend `forge/chains.json` to support prompts at multiple levels:

```json
{
  "agents": {
    "task-manager": {
      "defaultPrompt": "Create tasks from current requirements",
      "defaultPromptFile": "prompts/task-manager-default.md"
    },
    "task-coordinator": {
      "defaultPrompt": "Execute all pending tasks to completion"
    }
  },
  "chains": {
    "plan-and-build": {
      "description": "Create and execute tasks",
      "prompt": "Chain-level global prompt for all steps",
      "promptFile": "prompts/plan-and-build.md",
      "steps": [
        {
          "agent": "task-manager",
          "iterations": 3,
          "prompt": "Step-specific override prompt"
        },
        {
          "agent": "task-coordinator",
          "iterations": 10,
          "promptFile": "prompts/coordinator-instructions.md"
        }
      ]
    }
  }
}
```

### Prompt Resolution Order

For each step, resolve prompt using first match (highest to lowest priority):

| Priority | Source | Scope |
|----------|--------|-------|
| 1 | CLI `--prompt` / `--prompt-file` | Runtime override for all steps |
| 2 | Step-level `prompt` / `promptFile` | This step only |
| 3 | Chain-level `prompt` / `promptFile` | All steps in chain |
| 4 | Agent default `defaultPrompt` / `defaultPromptFile` | Fallback for this agent |
| 5 | No prompt | Agent runs without instruction |

When both `prompt` and `promptFile` are specified at the same level, `prompt` wins (inline is more explicit).

### CLI Interface

CLI provides **global prompt only** - applies to all steps in the chain. For per-step prompts, use config.

```bash
# Single agent with prompt
forkhestra "task-manager:3" --prompt "Create tasks from plan.md"
forkhestra "task-manager:3" -p "Create tasks from plan.md"

# Multi-step chain - prompt applies to ALL steps
forkhestra "task-manager:3 -> task-coordinator:10" --prompt "Work on auth feature"

# Prompt from file
forkhestra "task-manager:3" --prompt-file instructions.md

# Config chain mode (uses prompts from config)
forkhestra --chain plan-and-build

# Config chain with runtime override (overrides ALL steps)
forkhestra --chain plan-and-build --prompt "Focus on authentication feature"

# Variables work in prompts (existing ${VAR} substitution)
forkhestra --chain plan-and-build FEATURE="auth"
# Config can have: "prompt": "Work on ${FEATURE} feature"
```

**Design decision:** CLI does not support per-step prompts. If you need different prompts for different steps, define a chain in config. This keeps the CLI simple and encourages reusable, version-controlled workflows for complex cases.

### How Agents Receive Prompts

Existing agents accept prompts as positional arguments at the end of args:
```typescript
// In agents like forge-task-manager.ts
const positionals = getPositionals();
const userPrompt = positionals.join(" ");
const args = userPrompt ? [...flags, userPrompt] : [...flags];
```

Forkhestra will append the resolved prompt to the spawn args:
```typescript
// In runner.ts
const fullArgs = prompt ? [...args, prompt] : args;
spawn([agent, ...fullArgs], { cwd, env });
```

### Per-Iteration Behavior

The same prompt applies to every iteration of a looping agent. Agents track their own state and the prompt provides the overall objective.

## Implementation Plan

### Task 1: Extend Config Schema

**File:** `lib/forkhestra/config.ts`

Add TypeScript interfaces:
```typescript
interface AgentConfig {
  defaultPrompt?: string;
  defaultPromptFile?: string;
}

interface ForkhestraConfig {
  agents?: Record<string, AgentConfig>;
  chains: Record<string, ChainConfig>;
}
```

Extend `ChainConfig`:
```typescript
interface ChainConfig {
  description?: string;
  prompt?: string;
  promptFile?: string;
  steps: ChainStep[];
}
```

Extend `ChainStep`:
```typescript
interface ChainStep {
  agent: string;
  iterations?: number;
  args?: string[];
  prompt?: string;
  promptFile?: string;
  loop: boolean;
}
```

Add validation for new fields in `validateAndTransformConfig()`, `validateAndTransformChain()`, and `validateAndTransformStep()`.

**Acceptance Criteria:**
- [ ] `agents` section with `defaultPrompt` and `defaultPromptFile` fields
- [ ] Chain-level `prompt` and `promptFile` fields
- [ ] Step-level `prompt` and `promptFile` fields
- [ ] Validation rejects invalid types (non-string prompts, etc.)
- [ ] Variable substitution (`${VAR}`) works in prompt fields
- [ ] Unit tests for new schema validation

### Task 2: Add Prompt File Reading Utility

**File:** `lib/forkhestra/prompt.ts` (new file)

Create utility functions:
```typescript
/**
 * Read prompt content from a file path (relative to cwd)
 */
export async function readPromptFile(
  filePath: string,
  cwd: string
): Promise<string>

/**
 * Resolve prompt from multiple sources with priority
 */
export async function resolvePrompt(options: {
  cliPrompt?: string;
  cliPromptFile?: string;
  stepPrompt?: string;
  stepPromptFile?: string;
  chainPrompt?: string;
  chainPromptFile?: string;
  agentDefault?: AgentConfig;
  cwd: string;
}): Promise<string | undefined>
```

**Acceptance Criteria:**
- [ ] `readPromptFile()` reads file content relative to cwd
- [ ] `readPromptFile()` throws clear error if file not found
- [ ] `resolvePrompt()` follows priority order correctly
- [ ] `prompt` beats `promptFile` at same level
- [ ] Returns `undefined` if no prompt found at any level
- [ ] Unit tests for resolution priority

### Task 3: Update Runner to Accept Prompt

**File:** `lib/forkhestra/runner.ts`

Add `prompt` to `RunOptions`:
```typescript
export interface RunOptions {
  agent: string;
  maxIterations: number;
  loop: boolean;
  args?: string[];
  cwd?: string;
  verbose?: boolean;
  prompt?: string;  // NEW
}
```

Update `runOnce()` and `runOnceWithMarkerDetection()` to append prompt to args:
```typescript
const fullArgs = prompt ? [...args, prompt] : args;
const proc = spawn([agent, ...fullArgs], { ... });
```

**Acceptance Criteria:**
- [ ] `RunOptions` accepts optional `prompt` field
- [ ] Prompt is appended as last positional argument
- [ ] Agents receive prompt correctly (manual test with task-manager)
- [ ] Works in both single-run and loop modes
- [ ] Unit tests verify prompt is passed to spawn

### Task 4: Update Chain Executor for Prompt Resolution

**File:** `lib/forkhestra/chain.ts`

Update `ChainOptions` and `executeChain()`:
```typescript
export interface ChainOptions {
  steps: ChainStep[];
  cwd?: string;
  verbose?: boolean;
  args?: string[];
  // NEW
  cliPrompt?: string;
  cliPromptFile?: string;
  chainPrompt?: string;
  chainPromptFile?: string;
  agentDefaults?: Record<string, AgentConfig>;
}
```

In the execution loop, resolve prompt for each step:
```typescript
for (const step of steps) {
  const prompt = await resolvePrompt({
    cliPrompt: options.cliPrompt,
    cliPromptFile: options.cliPromptFile,
    stepPrompt: step.prompt,
    stepPromptFile: step.promptFile,
    chainPrompt: options.chainPrompt,
    chainPromptFile: options.chainPromptFile,
    agentDefault: options.agentDefaults?.[step.agent],
    cwd,
  });

  const result = await run({
    agent: step.agent,
    maxIterations: step.iterations || 1,
    loop: step.loop,
    args: mergedArgs,
    cwd,
    verbose,
    prompt,  // NEW
  });
}
```

**Acceptance Criteria:**
- [ ] `ChainOptions` accepts prompt-related fields
- [ ] Prompt resolved per-step with correct priority
- [ ] Different steps can have different prompts
- [ ] CLI prompt overrides all step/chain prompts
- [ ] Integration tests for multi-step chains with prompts

### Task 5: Add CLI Flags for Prompt

**File:** `agents/forkhestra.ts`

Add new CLI flags:
```typescript
const { values, positionals } = parseArgs({
  options: {
    // ... existing
    prompt: { type: "string", short: "p" },
    "prompt-file": { type: "string" },
  },
  // ...
});
```

Pass to chain executor:
```typescript
const result = await executeChain({
  steps,
  cwd,
  verbose,
  args: globalArgs,
  cliPrompt: values.prompt,
  cliPromptFile: values["prompt-file"],
  chainPrompt: chain?.prompt,
  chainPromptFile: chain?.promptFile,
  agentDefaults: config?.agents,
});
```

Update help text and dry-run output to show prompts.

**Acceptance Criteria:**
- [ ] `--prompt` / `-p` flag accepts inline prompt
- [ ] `--prompt-file` flag accepts path to prompt file
- [ ] Help text documents new flags with examples
- [ ] Dry-run output shows resolved prompts per step
- [ ] Error if both `--prompt` and `--prompt-file` provided (optional)

### Task 6: Add Variable Substitution to Prompts

**File:** `lib/forkhestra/config.ts`

Extend `substituteVars()` to handle prompt fields:
```typescript
export function substituteVars(
  steps: ChainStep[],
  vars: Record<string, string>,
  chainPrompt?: string,
  chainPromptFile?: string
): { steps: ChainStep[]; chainPrompt?: string; chainPromptFile?: string }
```

**Acceptance Criteria:**
- [ ] Variables in step `prompt` fields are substituted
- [ ] Variables in step `promptFile` fields are substituted
- [ ] Variables in chain-level `prompt` are substituted
- [ ] Variables in chain-level `promptFile` are substituted
- [ ] Missing variables throw clear error
- [ ] Unit tests for variable substitution in prompts

### Task 7: Documentation and Examples

**Files:**
- `CLAUDE.md` - Update forkhestra section
- `docs/FORKHESTRA.md` (new) - Detailed documentation

Document:
- New config schema with examples
- CLI flags and usage examples
- Prompt resolution priority
- Common patterns (global prompt, per-step prompts, agent defaults)

**Acceptance Criteria:**
- [ ] CLAUDE.md forkhestra section updated with prompt info
- [ ] New docs/FORKHESTRA.md with comprehensive examples
- [ ] Example chain config with prompts in forge/chains.json

## Testing Strategy

### Unit Tests
- Config validation for new fields
- Prompt resolution priority logic
- Variable substitution in prompts
- File reading error handling

### Integration Tests
- Single agent with CLI prompt
- Multi-step chain with different prompts per step
- Chain with global prompt
- Agent defaults as fallback
- CLI override of chain prompts

### Manual Tests
- Run task-manager with prompt via forkhestra
- Run full plan-and-build chain with prompts
- Verify agents receive and act on prompts correctly

## Dependencies

- Existing forkhestra implementation (complete)
- forge-tasks agents that accept positional prompts (complete)

## Notes

- Prompt files are read relative to the working directory (cwd)
- Same prompt applies to all iterations of a looping agent
- Empty string prompt is treated as "no prompt" (not passed to agent)
- Prompts can be multi-line (useful for promptFile)
