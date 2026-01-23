# Forkhestra Implementation Plan

Agent orchestration for claude-forge. Run agents in loops (Ralph-style) or chains, with shared context via forge-tasks.

---

## Overview

Forkhestra provides two modes:
1. **Loop mode**: Run a single agent repeatedly until completion or max iterations
2. **Chain mode**: Run multiple agents sequentially, each looping until complete

Agents signal completion by outputting `FORKHESTRA_COMPLETE` to stdout. Progress persists in forge-tasks files and git history, not context windows.

---

## CLI Interface

```bash
# Pipeline mode - run agents once each, no looping
forkhestra "task-manager -> task-coordinator"
forkhestra "planner -> builder -> tester"

# Loop mode - single agent with max iterations
forkhestra task-coordinator:10
forkhestra task-worker:5 --cwd /project

# Chain mode - DSL with iterations (loops until complete or max)
forkhestra "task-manager:3 -> task-coordinator:10"

# Mixed - some agents loop, some run once
forkhestra "task-manager -> task-coordinator:10"

# Config mode - named chains
forkhestra --chain plan-and-build
forkhestra --chain single-task TASK_ID=TASK-001

# Options
--cwd <path>          Working directory (passed to all agents)
--verbose, -v         Show full agent output (default: streaming)
--dry-run             Show what would run without executing
--chain <name>        Run named chain from forge/chains.json
```

---

## Completion Contract

Any agent participating in forkhestra loops must:

1. Do its work
2. When done, output `FORKHESTRA_COMPLETE` on its own line to stdout
3. Exit

Example in an agent's system prompt:
> When all tasks are complete, output `FORKHESTRA_COMPLETE` on its own line before exiting.

The runner watches stdout for this marker. If seen, the step is complete. If the agent exits without the marker, the runner loops again (up to max iterations).

---

## Configuration

### File Location

`forge/chains.json`

### Schema

```json
{
  "chains": {
    "<chain-name>": {
      "description": "Optional description",
      "steps": [
        {
          "agent": "<agent-binary-name>",
          "iterations": <number>,       // Optional. If omitted, runs once (no looping)
          "args": ["--flag", "value", "${VAR_NAME}"]
        }
      ]
    }
  }
}
```

- If `iterations` is omitted: run agent once, don't wait for completion marker
- If `iterations` is specified: loop up to N times, watching for `FORKHESTRA_COMPLETE`

### Example Configuration

```json
{
  "chains": {
    "plan-and-build": {
      "description": "Break down requirements into tasks, then coordinate implementation",
      "steps": [
        { "agent": "forge-task-manager", "iterations": 3 },
        { "agent": "forge-task-coordinator", "iterations": 15 }
      ]
    },
    "quick-pipeline": {
      "description": "Run agents in sequence, once each (no looping)",
      "steps": [
        { "agent": "forge-task-manager" },
        { "agent": "forge-task-coordinator" }
      ]
    },
    "single-task": {
      "description": "Work on one specific task",
      "steps": [
        { "agent": "forge-task-worker", "iterations": 8, "args": ["--task", "${TASK_ID}"] }
      ]
    },
    "mixed-mode": {
      "description": "Manager runs once, coordinator loops",
      "steps": [
        { "agent": "forge-task-manager" },
        { "agent": "forge-task-coordinator", "iterations": 15 }
      ]
    }
  }
}
```

### Variable Substitution

Variables in args use `${VAR_NAME}` syntax. Passed via CLI:

```bash
forkhestra --chain single-task TASK_ID=TASK-001
```

Or multiple variables:
```bash
forkhestra --chain custom TASK_ID=TASK-001 LABEL=backend
```

---

## Implementation

### Phase 1: Core Runner

**File**: `lib/forkhestra/runner.ts`

Spawns an agent binary, streams output, detects completion marker.

```typescript
interface RunResult {
  complete: boolean;
  iterations: number;
  exitCode: number;
  reason: "marker" | "max_iterations" | "error";
}

interface RunOptions {
  agent: string;
  maxIterations: number;
  args?: string[];
  cwd?: string;
  verbose?: boolean;
}

async function run(options: RunOptions): Promise<RunResult>;
```

**Requirements**:
- Spawn agent binary via `Bun.spawn`
- Two modes based on `loop` flag:
  - `loop: false` → Run once, ignore completion marker, move on when agent exits
  - `loop: true` → Stream stdout, watch for `FORKHESTRA_COMPLETE`, loop if not found
- Pass through stderr to console
- Track iteration count
- Handle SIGINT/SIGTERM gracefully (kill child process)
- Return structured result

**Acceptance Criteria**:
- [ ] Spawns agent binary by name (assumes in PATH)
- [ ] When `loop: false`, runs agent once and returns
- [ ] When `loop: true`, detects `FORKHESTRA_COMPLETE` in stdout
- [ ] When `loop: true`, stops looping when marker detected
- [ ] Respects max iterations limit
- [ ] Passes `--cwd` and custom args to agent
- [ ] Forwards SIGINT to child process

### Phase 2: Chain Parser

**File**: `lib/forkhestra/parser.ts`

Parses DSL strings into step arrays.

```typescript
interface ChainStep {
  agent: string;
  iterations: number;
  loop: boolean;        // false = run once, true = loop until marker or max
  args?: string[];
}

function parseDSL(dsl: string): ChainStep[];
```

**DSL Format**: `agent1[:iterations] -> agent2[:iterations]`

Iterations are optional. If omitted, the agent runs exactly once (no looping, no completion marker check).

Examples:
- `task-coordinator` → run once
- `task-coordinator:10` → loop up to 10 times
- `task-manager -> task-coordinator` → pipeline, each runs once
- `task-manager:3 -> task-coordinator:10` → both loop
- `task-manager -> task-coordinator:10` → mixed: first runs once, second loops

**Requirements**:
- Parse agent name and optional iteration count
- If no `:N` suffix, iterations = 1 and `loop = false`
- If `:N` suffix, iterations = N and `loop = true`
- Support single agent (no arrow)
- Support multiple agents with `->` separator
- Validate iteration counts are positive integers when present

**Acceptance Criteria**:
- [ ] Parses single agent without iterations: `agent` → `{ agent, iterations: 1, loop: false }`
- [ ] Parses single agent with iterations: `agent:10` → `{ agent, iterations: 10, loop: true }`
- [ ] Parses pipeline: `a -> b -> c` → all with `loop: false`
- [ ] Parses mixed: `a -> b:10` → first `loop: false`, second `loop: true`
- [ ] Throws on invalid syntax
- [ ] Throws on non-numeric iterations

### Phase 3: Config Loader

**File**: `lib/forkhestra/config.ts`

Loads and validates `forge/chains.json`.

```typescript
interface ChainConfig {
  description?: string;
  steps: ChainStep[];
}

interface ForkhestraConfig {
  chains: Record<string, ChainConfig>;
}

function loadConfig(cwd: string): ForkhestraConfig | null;
function getChain(config: ForkhestraConfig, name: string): ChainStep[];
function substituteVars(steps: ChainStep[], vars: Record<string, string>): ChainStep[];
```

**Requirements**:
- Load from `forge/chains.json` relative to cwd
- Validate schema structure
- Return null if file doesn't exist (not an error)
- Substitute `${VAR}` in args with provided values
- Throw if variable referenced but not provided

**Acceptance Criteria**:
- [ ] Loads valid config file
- [ ] Returns null for missing file
- [ ] Throws on invalid JSON
- [ ] Throws on invalid schema
- [ ] Substitutes variables in args
- [ ] Throws on missing variable

### Phase 4: Chain Executor

**File**: `lib/forkhestra/chain.ts`

Executes a sequence of steps.

```typescript
interface ChainResult {
  success: boolean;
  steps: {
    agent: string;
    result: RunResult;
  }[];
  failedAt?: number;
}

interface ChainOptions {
  steps: ChainStep[];
  cwd?: string;
  verbose?: boolean;
  globalArgs?: string[];
}

async function executeChain(options: ChainOptions): Promise<ChainResult>;
```

**Requirements**:
- Execute steps sequentially
- Stop on first incomplete step (didn't reach marker within iterations)
- Merge global args with per-step args
- Report which step failed if chain doesn't complete
- Handle SIGINT gracefully

**Acceptance Criteria**:
- [ ] Executes steps in order
- [ ] Stops if a step doesn't complete
- [ ] Merges global args with step args
- [ ] Returns structured result with per-step details
- [ ] Reports failed step index

### Phase 5: CLI Entry Point

**File**: `agents/forkhestra.ts`

CLI interface using `parseArgs`.

```typescript
// Usage patterns:
// forkhestra agent:N
// forkhestra "agent1:N -> agent2:M"
// forkhestra --chain name
// forkhestra --chain name VAR=value
```

**Requirements**:
- Parse positional args (DSL or VAR=value pairs)
- Parse `--chain`, `--cwd`, `--verbose`, `--dry-run` options
- Determine mode: DSL vs config
- Load config if `--chain` specified
- Execute via runner (single) or chain executor (multiple steps)
- Print summary on completion
- Exit with appropriate code (0 = complete, 1 = incomplete, 2 = error)

**Acceptance Criteria**:
- [ ] `forkhestra agent:10` works (loop mode)
- [ ] `forkhestra "a:5 -> b:10"` works (DSL chain)
- [ ] `forkhestra --chain name` loads from config
- [ ] `forkhestra --chain name VAR=value` substitutes variables
- [ ] `--dry-run` shows steps without executing
- [ ] `--verbose` shows full output
- [ ] Prints summary: iterations, completion status

### Phase 6: Build Integration

**Requirements**:
- Add `forkhestra.ts` to compile targets
- Compile to `bin/forkhestra`
- Add to asset registry if applicable

**Acceptance Criteria**:
- [ ] `bun compile agents/forkhestra.ts` produces binary
- [ ] `forkhestra --help` works
- [ ] Binary is standalone (no bun required at runtime)

---

## File Structure

```
claude-forge/
├── agents/
│   └── forkhestra.ts           # CLI entry point
├── lib/
│   └── forkhestra/
│       ├── index.ts            # Public exports
│       ├── runner.ts           # Core loop runner
│       ├── parser.ts           # DSL parser
│       ├── config.ts           # Config loader
│       └── chain.ts            # Chain executor
└── forge/
    └── chains.json             # Chain configurations (user-created)
```

---

## Agent Updates

Agents that participate in forkhestra need to output the completion marker. Update these system prompts:

### forge-task-manager
> When you have finished creating all tasks from the requirements, output `FORKHESTRA_COMPLETE` on its own line.

### forge-task-coordinator
> When all tasks have been implemented (no tasks with status "To Do" or "In Progress" remain), output `FORKHESTRA_COMPLETE` on its own line.

### forge-task-worker
> When your assigned task is marked as Done with all acceptance criteria checked, output `FORKHESTRA_COMPLETE` on its own line.

---

## Output Format

### Pipeline mode (no looping)
```
[forkhestra] Running: task-manager
... agent output streams through ...
[forkhestra] Done: task-manager (exit 0)

[forkhestra] Running: task-coordinator
... agent output streams through ...
[forkhestra] Done: task-coordinator (exit 0)

[forkhestra] Pipeline complete (2/2 steps)
```

### Loop mode (with iterations)
```
[forkhestra] Starting: task-manager (max 3 iterations)
[forkhestra] Iteration 1/3
... agent output streams through ...
[forkhestra] Iteration 2/3
... agent output streams through ...
[forkhestra] Complete after 2 iterations

[forkhestra] Starting: task-coordinator (max 10 iterations)
[forkhestra] Iteration 1/10
... agent output streams through ...
[forkhestra] Complete after 1 iteration

[forkhestra] Chain complete (2/2 steps)
```

### Verbose mode
Same as normal, but agent output is not truncated.

### Dry-run mode
```
[forkhestra] Dry run - would execute:
  Step 1: task-manager (max 3 iterations)
  Step 2: task-coordinator (max 10 iterations)
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Agent binary not found | Exit 2 with error message |
| Config file invalid JSON | Exit 2 with parse error |
| Chain name not found | Exit 2 with available chains listed |
| Variable not provided | Exit 2 listing missing variables |
| Step doesn't complete | Exit 1, show which step and iteration count |
| SIGINT received | Kill child, exit 130 |
| Agent crashes (non-zero exit) | Continue to next iteration (agent might recover) |

---

## Future Considerations (Out of Scope)

These are explicitly NOT in this plan but could be added later:

- **Parallel steps**: Run agents concurrently (would need different syntax)
- **Conditional steps**: Skip steps based on conditions
- **Retry with backoff**: Smarter retry logic for flaky agents
- **Cost tracking**: Parse Claude output for token usage
- **Web UI**: Visual chain builder
- **Hooks**: Pre/post step hooks (use Claude Code hooks instead)

---

## Definition of Done

- [ ] All phases implemented
- [ ] CLI compiles to standalone binary
- [ ] Works with existing forge-task agents
- [ ] Agent system prompts updated with completion marker
- [ ] Example `forge/chains.json` created
- [ ] Basic usage documented in README or CLAUDE.md
