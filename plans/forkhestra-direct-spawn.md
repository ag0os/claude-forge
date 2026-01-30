# Implementation Plan: Forkhestra Direct Claude Spawning

## Overview

Refactor forkhestra to spawn Claude directly instead of through agent binaries. This enables full control over Claude invocation, automatic mode awareness injection, turn limiting, and Ralph Wiggum-style autonomous loops.

**Key insight**: Agent "authoring" becomes configuration + prompt files, not TypeScript binaries.

---

## Phase 1: Extend Config Schema

### 1.1 Update AgentConfig interface

**File**: `lib/forkhestra/config.ts`

Add new fields to `AgentConfig`:

```typescript
interface AgentConfig {
  // Existing
  defaultPrompt?: string;
  defaultPromptFile?: string;

  // New: Direct spawn configuration
  /** Path to system prompt file (relative to cwd) */
  systemPrompt?: string;
  /** Inline system prompt text (alternative to file) */
  systemPromptText?: string;
  /** Path to MCP config JSON */
  mcpConfig?: string;
  /** Path to settings JSON */
  settings?: string;
  /** Model: sonnet (default), opus, haiku */
  model?: "sonnet" | "opus" | "haiku";
  /** Max turns per iteration (default: 100) */
  maxTurns?: number;
  /** Allowed tools whitelist (if omitted, all tools allowed) */
  allowedTools?: string[];
  /** Disallowed tools blacklist */
  disallowedTools?: string[];
}
```

### 1.2 Update validation in config.ts

Add validation for new fields in `validateAndTransformAgent()`:
- `systemPrompt`: string, optional
- `systemPromptText`: string, optional
- `mcpConfig`: string, optional
- `settings`: string, optional
- `model`: enum validation
- `maxTurns`: positive integer, optional
- `allowedTools`: string array, optional
- `disallowedTools`: string array, optional

### 1.3 Add agent type detection helper

```typescript
/** Check if agent is configured for direct spawn (has systemPrompt) */
function isDirectSpawnAgent(config: AgentConfig): boolean {
  return !!(config.systemPrompt || config.systemPromptText);
}
```

---

## Phase 2: Create Mode Awareness Module

### 2.1 New file: `lib/forkhestra/mode-awareness.ts`

```typescript
/**
 * Mode awareness prefix injected into all forkhestra agent prompts.
 * Addresses Claude Code bug #17603 where Claude doesn't know it's headless.
 */
export const MODE_AWARENESS_PREFIX = `# Execution Context

You are running in non-interactive headless mode via forkhestra orchestration.

## Critical Rules
- Do NOT ask questions or wait for user input
- Do NOT use interactive features (confirmations, prompts)
- Complete your task autonomously using available tools
- Read state from files and git history (context resets each iteration)

## Completion Contract
When your task for this iteration is complete:
1. Commit any code changes with descriptive message
2. Output FORKHESTRA_COMPLETE on its own line
3. Exit cleanly

WARNING: If you do not output FORKHESTRA_COMPLETE, the orchestration will hang.

---

`;

/**
 * Compose the full system prompt for an agent.
 *
 * Order:
 * 1. Mode awareness prefix (always)
 * 2. Agent system prompt (from file or inline)
 * 3. Task prompt is passed as positional arg, not in system prompt
 */
export async function composeSystemPrompt(
  agentSystemPrompt: string,
): Promise<string> {
  return MODE_AWARENESS_PREFIX + agentSystemPrompt;
}

/**
 * Load system prompt from file or return inline text.
 */
export async function loadAgentSystemPrompt(
  config: AgentConfig,
  cwd: string
): Promise<string> {
  if (config.systemPromptText) {
    return config.systemPromptText;
  }
  if (config.systemPrompt) {
    const path = join(cwd, config.systemPrompt);
    return await Bun.file(path).text();
  }
  return "";
}
```

---

## Phase 3: Update Runner for Direct Spawn

### 3.1 New interface: `DirectRunOptions`

**File**: `lib/forkhestra/runner.ts`

```typescript
interface DirectRunOptions extends RunOptions {
  /** Agent configuration for direct spawn */
  agentConfig?: AgentConfig;
  /** Working directory for file resolution */
  cwd: string;
}
```

### 3.2 New function: `runDirect()`

Core function that spawns Claude directly:

```typescript
async function runDirect(options: DirectRunOptions): Promise<RunResult> {
  const { agentConfig, cwd, prompt, maxIterations, loop, verbose } = options;

  // Load and compose system prompt
  const agentPrompt = await loadAgentSystemPrompt(agentConfig, cwd);
  const fullSystemPrompt = await composeSystemPrompt(agentPrompt);

  // Build Claude command args
  const args: string[] = [
    "claude",
    "--print",
    "--dangerously-skip-permissions",
    "--append-system-prompt", fullSystemPrompt,
  ];

  // Add optional flags
  if (agentConfig.maxTurns) {
    args.push("--max-turns", agentConfig.maxTurns.toString());
  }
  if (agentConfig.model) {
    args.push("--model", agentConfig.model);
  }
  if (agentConfig.mcpConfig) {
    args.push("--mcp-config", join(cwd, agentConfig.mcpConfig));
  }
  if (agentConfig.settings) {
    args.push("--settings", join(cwd, agentConfig.settings));
  }
  if (agentConfig.allowedTools?.length) {
    args.push("--allowedTools", agentConfig.allowedTools.join(","));
  }
  if (agentConfig.disallowedTools?.length) {
    args.push("--disallowedTools", agentConfig.disallowedTools.join(","));
  }

  // Add task prompt as positional argument
  if (prompt) {
    args.push(prompt);
  }

  // Spawn and handle (reuse existing loop/marker logic)
  // ...
}
```

### 3.3 Update `run()` to dispatch

Modify the main `run()` function to detect agent type and dispatch:

```typescript
export async function run(options: RunOptions): Promise<RunResult> {
  // If agentConfig has systemPrompt, use direct spawn
  if (options.agentConfig && isDirectSpawnAgent(options.agentConfig)) {
    return runDirect(options as DirectRunOptions);
  }

  // Otherwise, use legacy binary spawn
  return runBinary(options);
}
```

### 3.4 Refactor existing logic into `runBinary()`

Move current spawn logic to `runBinary()` for backward compatibility.

---

## Phase 4: Update Chain Executor

### 4.1 Pass agent config to runner

**File**: `lib/forkhestra/chain.ts`

Update `executeChain()` to:
1. Look up agent config from `ForkhestraConfig.agents`
2. Pass it to `run()` via options

```typescript
async function executeStep(
  step: ChainStep,
  config: ForkhestraConfig,
  options: ChainOptions
): Promise<StepResult> {
  const agentConfig = config.agents?.[step.agent];

  const result = await run({
    agent: step.agent,
    maxIterations: step.iterations,
    loop: step.loop,
    cwd: options.cwd,
    prompt: resolvedPrompt,
    agentConfig,  // NEW
    verbose: options.verbose,
  });

  // ...
}
```

---

## Phase 5: Create Forkhestra-Native Agents

### 5.0 The `ralph/` Directory Convention

Ralph-style agents use convention over configuration. Instead of passing prompts and configs, users create a `ralph/` directory with standard files:

```
project-root/
├── ralph/
│   ├── PLAN.md              # What to build (implementation plan)
│   ├── SPECS.md             # Requirements and specifications
│   └── AGENTS.md            # Operational notes for agents (~60 lines)
├── forge/
│   └── tasks/               # Task database (managed by agents)
└── src/                     # Your code
```

**File purposes:**

| File | Purpose | Who Writes |
|------|---------|------------|
| `PLAN.md` | High-level implementation plan, goals | Human |
| `SPECS.md` | Detailed requirements, acceptance criteria | Human |
| `AGENTS.md` | Build commands, test commands, project conventions | Human (updated by agents) |
| `forge/tasks/` | Task database with status tracking | Agents |

**Usage is zero-config:**
```bash
forkhestra --chain ralph
```

Agents know where to look. No prompts needed.

### 5.0.1 State Persistence (Ralph Pattern)

Each iteration starts with fresh context. State persists externally:

| Layer | What It Tracks |
|-------|----------------|
| `ralph/` files | Requirements, plan (human input) |
| `forge/tasks/` | Task status, ACs, blockers (agent state) |
| Git history | Code changes (implementation state) |

**Agent behavior pattern:**
```
Each iteration:
1. READ current state (ralph/*, forge-tasks, git)
2. DECIDE what to do (find gaps, pick next task)
3. DO the work
4. WRITE state changes (forge-tasks edit, git commit)
5. EXIT with FORKHESTRA_COMPLETE
```

The agent asks "what needs doing now?" not "what have I done?"

### 5.1 Directory structure

```
system-prompts/fk/
├── planner.md      # Gap analysis, task creation
├── builder.md      # Single task implementation
└── reviewer.md     # Code review and fixes
```

### 5.2 Planner agent prompt

**File**: `system-prompts/fk/planner.md`

```markdown
# Forkhestra Planner

You analyze requirements and create tasks. You do NOT implement.

## Inputs

Read from the ralph/ directory:
- `ralph/PLAN.md` - Implementation plan
- `ralph/SPECS.md` - Requirements and specifications
- `ralph/AGENTS.md` - Project conventions

## Each Iteration

1. Read ralph/PLAN.md and ralph/SPECS.md
2. Check existing tasks: `forge-tasks list --plain`
3. Identify gaps (requirements not covered by tasks)
4. Create tasks for gaps found
5. Output FORKHESTRA_COMPLETE

If no gaps remain, just output FORKHESTRA_COMPLETE.

## Creating Tasks

```bash
forge-tasks create "Title" \
  --description "Why this task exists" \
  --ac "Testable outcome 1" \
  --ac "Testable outcome 2" \
  --label backend \
  --priority high \
  --depends-on TASK-001
```

## Rules

- Plan only, never implement
- Each task = one PR scope
- ACs must be testable outcomes, not implementation steps
- Set dependencies to enforce execution order
```

### 5.3 Builder agent prompt

**File**: `system-prompts/fk/builder.md`

```markdown
# Forkhestra Builder

You implement exactly ONE task per iteration, then exit.

## Inputs

- `ralph/AGENTS.md` - Build commands, test commands, conventions
- `forge-tasks` - Task database with work to do

## Each Iteration

1. Read ralph/AGENTS.md for project conventions
2. Find work: `forge-tasks list --ready --plain`
3. If no ready tasks → output FORKHESTRA_COMPLETE and exit
4. Pick ONE task (highest priority)
5. Read task details: `forge-tasks view TASK-XXX --plain`
6. Mark in progress: `forge-tasks edit TASK-XXX --status "In Progress"`
7. Implement all acceptance criteria
8. Check off ACs: `forge-tasks edit TASK-XXX --check-ac 1`
9. Run tests (see ralph/AGENTS.md for commands)
10. Commit: `git commit -m "TASK-XXX: description"`
11. Mark done: `forge-tasks edit TASK-XXX --status done`
12. Output FORKHESTRA_COMPLETE

## Rules

- ONE task per iteration (fresh context next time)
- Always commit before signaling complete
- No questions - make reasonable decisions
- If blocked, mark blocked and still exit with FORKHESTRA_COMPLETE

## Blocked Tasks

```bash
forge-tasks edit TASK-XXX --status blocked --append-notes "Reason"
```
Then output FORKHESTRA_COMPLETE. Next iteration picks a different task.
```

### 5.4 Agent config entries

**File**: `forge/chains.json` (additions)

```json
{
  "agents": {
    "fk:planner": {
      "systemPrompt": "system-prompts/fk/planner.md",
      "model": "sonnet",
      "maxTurns": 50,
      "allowedTools": ["Read", "Grep", "Glob", "Bash"]
    },
    "fk:builder": {
      "systemPrompt": "system-prompts/fk/builder.md",
      "model": "sonnet",
      "maxTurns": 100
    }
  },
  "chains": {
    "ralph": {
      "description": "Ralph Wiggum style: plan from ralph/, then build tasks",
      "steps": [
        { "agent": "fk:planner", "iterations": 3 },
        { "agent": "fk:builder", "iterations": 20 }
      ]
    },
    "build": {
      "description": "Just build - assumes tasks already exist",
      "steps": [
        { "agent": "fk:builder", "iterations": 30 }
      ]
    },
    "plan": {
      "description": "Just plan - create tasks from ralph/ specs",
      "steps": [
        { "agent": "fk:planner", "iterations": 5 }
      ]
    }
  }
}
```

**No prompts needed** - agents read from `ralph/` by convention.

**Usage:**
```bash
# Full cycle: plan then build
forkhestra --chain ralph

# Just create tasks from specs
forkhestra --chain plan

# Just implement existing tasks
forkhestra --chain build
```

---

## Phase 6: Testing

### 6.1 Unit tests

- `config.test.ts`: Validate new AgentConfig fields
- `mode-awareness.test.ts`: Test prompt composition
- `runner.test.ts`: Test direct spawn path detection and arg building

### 6.2 Integration tests

- Run `forkhestra --chain ralph --dry-run` to verify command construction
- Test with a simple agent that just outputs FORKHESTRA_COMPLETE
- Test max-turns limiting works

### 6.3 Manual validation

- Run `forkhestra fk:builder:3` on a real project with tasks
- Verify mode awareness prevents interactive behavior
- Verify commits happen each iteration

---

## Phase 7: Documentation

### 7.1 Update docs/FORKHESTRA.md

- Document new agent config fields
- Explain direct spawn vs binary spawn
- Add examples of config-only agents

### 7.2 Update CLAUDE.md

- Add section on forkhestra-native agents
- Document the `fk:` namespace convention

---

## Migration Notes

### Backward Compatibility

- Existing agents (e.g., `tasks:coordinator`) continue to work
- They're spawned as binaries (legacy path)
- Direct spawn only activates when `systemPrompt` is present in config

### When to Use Which

| Use Case | Approach |
|----------|----------|
| Interactive + forkhestra hybrid | Binary agent (existing) |
| Forkhestra-only automation | Direct spawn (new) |
| Quick prototyping | Direct spawn (just write a prompt) |
| Complex tool setup | Binary agent (full control) |

---

## Implementation Order

1. **Phase 1**: Config schema (foundation)
2. **Phase 2**: Mode awareness module (small, testable)
3. **Phase 3**: Runner changes (core functionality)
4. **Phase 4**: Chain executor updates (integration)
5. **Phase 5**: Create fk:* agents (validate it works)
6. **Phase 6**: Testing
7. **Phase 7**: Documentation

Estimated effort: Medium (mostly additive, minimal breaking changes)

---

## Design Decisions

### 1. No MCP Config Merging

Each agent specifies its complete MCP config. No base + agent merging.

**Rationale**: Simple and explicit. Duplication is minimal, and explicit config is easier to debug than magic merging.

### 2. No Settings Merging

Each agent specifies its complete settings. No merging.

**Rationale**: Settings are usually small and agent-specific. Merging complexity isn't worth it.

### 3. No Prompt File Caching

Reload prompt files every iteration, even in loops.

**Rationale**:
- File reads are fast (local disk)
- Aligns with Ralph philosophy: fresh context each iteration
- User can edit prompts mid-chain to "tune" behavior
- Keeps code simple

### 4. Fail Early on Missing Prompt File

Validate at config load time. If `systemPrompt` references a non-existent file, fail immediately with a clear error.

**Error format**: `Agent 'fk:planner' references systemPrompt 'prompts/foo.md' which does not exist`

**Rationale**: Fail fast, fail clearly. Don't let bad config silently proceed.

### 5. No Agent Inheritance

No `extends` field. Duplicate shared config across agents.

**Rationale**:
- YAGNI - no evidence we need it yet
- Explicit duplication is easier to debug
- Reduces config validation complexity
- Can add later if patterns emerge

### Design Philosophy

**Start simple, add complexity only when needed.** Every feature not added is a feature that doesn't need debugging.
