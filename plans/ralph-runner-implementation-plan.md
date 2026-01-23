# Ralph Runner Implementation Plan

## Overview

This document outlines the implementation plan for adding `ralph-runner` to the claude-forge framework - an orchestration layer that enables Ralph Wiggum-style persistent iteration loops for any agent, with support for agent chaining, pluggable completion checkers, and Claude Code hook integration.

---

## Phase 1: Core Loop Runner

**Goal**: Create the basic iteration loop that can run any claude-forge agent repeatedly until completion.

### Step 1.1: Create Spawner Module

**File**: `lib/ralph/spawner.ts`

**Description**: Wrapper around `Bun.spawn` that handles agent invocation with output capture.

**Requirements**:
- Accept agent binary path and arguments
- Spawn as child process with `stdout: "pipe"` and `stderr: "pipe"`
- Stream stdout line-by-line for real-time pattern matching
- Capture full output for logging
- Handle process exit codes
- Support `--dangerously-skip-permissions` passthrough
- Track spawned processes for graceful shutdown

**Acceptance Criteria**:
- [ ] Can spawn any compiled claude-forge agent binary
- [ ] Captures stdout/stderr as streams
- [ ] Returns exit code and full output on completion
- [ ] Exposes async iterator for line-by-line stdout processing

### Step 1.2: Create Completion Detector

**File**: `lib/ralph/detector.ts`

**Description**: Multi-signal completion detection that combines stdout markers, exit codes, and file-based signals.

**Requirements**:
- Define `CompletionSignal` type: `"marker" | "exit_code" | "file" | "timeout" | "max_iterations"`
- Scan stdout stream for completion markers:
  - `<promise>COMPLETE</promise>`
  - `RALPH_STATUS: COMPLETE`
  - Custom patterns via config
- Check exit code (0 = success)
- Support file-based completion (e.g., `.done` file created)
- Return structured result with signal type and details

**Acceptance Criteria**:
- [ ] Detects `<promise>COMPLETE</promise>` in stdout stream
- [ ] Reports which signal triggered completion
- [ ] Supports multiple marker patterns
- [ ] Can be configured with custom patterns

### Step 1.3: Create Core Loop Controller

**File**: `lib/ralph/loop.ts`

**Description**: Main iteration loop that spawns agent repeatedly until completion or limit reached.

**Requirements**:
- Accept agent name, max iterations, and optional config
- For each iteration:
  1. Spawn agent via spawner
  2. Stream output through detector
  3. Log iteration results
  4. Check for completion signals
  5. If not complete, continue to next iteration
- Implement circuit breaker: stop if 3 consecutive iterations have no git changes
- Handle graceful shutdown on SIGINT/SIGTERM
- Return final status and iteration history

**Acceptance Criteria**:
- [ ] Loops until completion marker detected
- [ ] Respects max iterations limit
- [ ] Implements circuit breaker for stagnation
- [ ] Handles SIGINT gracefully (kills child, exits cleanly)
- [ ] Returns structured result with all iteration data

### Step 1.4: Create Main CLI Entry Point

**File**: `agents/ralph-runner.ts`

**Description**: CLI interface for the ralph-runner.

**Requirements**:
- Parse CLI arguments:
  - `--agent <name>` (required): Agent to run
  - `--max-iterations <n>` (required): Safety limit
  - `--verbose` / `-v`: Detailed output
  - `--cwd <path>`: Working directory
- Resolve agent binary path from `bin/` directory
- Invoke loop controller
- Print summary on completion
- Exit with appropriate code (0 = complete, 1 = max iterations, 2 = stagnated)

**Acceptance Criteria**:
- [ ] `ralph-runner --agent plan-coordinator --max-iterations 20` works
- [ ] Fails if `--max-iterations` not provided
- [ ] Resolves agent binaries correctly
- [ ] Prints progress and summary

### Step 1.5: Add to Build System

**Requirements**:
- Add `ralph-runner.ts` to watch/compile targets
- Ensure it compiles to `bin/ralph-runner`
- Test compiled binary works standalone

**Acceptance Criteria**:
- [ ] `bun compile agents/ralph-runner.ts` produces working binary
- [ ] `./bin/ralph-runner --help` shows usage

---

## Phase 2: Completion Checkers

**Goal**: Add pluggable completion verification scripts that can validate work is actually done.

### Step 2.1: Define Checker Interface

**File**: `lib/checkers/index.ts`

**Description**: Interface and types for completion checkers.

**Requirements**:
- Define `CompletionChecker` interface:
  ```typescript
  interface CheckerContext {
    workDir: string;
    iteration: number;
    agentOutput: string;
    exitCode: number;
  }
  
  interface CheckerResult {
    passed: boolean;
    message?: string;
  }
  
  interface CompletionChecker {
    name: string;
    check(ctx: CheckerContext): Promise<CheckerResult>;
  }
  ```
- Export factory function for creating checkers from scripts

**Acceptance Criteria**:
- [ ] Interface is exported and documented
- [ ] Can load checker from TypeScript file path
- [ ] Can load checker from bash script path

### Step 2.2: Implement Built-in Checkers

**Files**: `lib/checkers/exit-code.ts`, `stdout-marker.ts`, `file-exists.ts`, `command-succeeds.ts`

**Requirements**:

**exit-code.ts**:
- Pass if last agent exit code was 0

**stdout-marker.ts**:
- Accept marker pattern as config
- Pass if pattern found in agent output

**file-exists.ts**:
- Accept file path as config
- Pass if file exists after agent run

**command-succeeds.ts**:
- Accept shell command as config
- Run command via `Bun.spawn`
- Pass if command exits 0

**Acceptance Criteria**:
- [ ] Each checker implements the interface
- [ ] `command-succeeds` can run `bun test` and check result
- [ ] `file-exists` can check for PROGRESS.md
- [ ] Checkers return descriptive messages on failure

### Step 2.3: Integrate Checkers into Loop

**File**: `lib/ralph/loop.ts` (modify)

**Description**: Update loop controller to run checkers after each iteration.

**Requirements**:
- Accept array of checker instances
- After each iteration, run all checkers
- Completion requires: (marker detected OR exit code 0) AND all checkers pass
- Log checker results
- Include checker results in iteration history

**Acceptance Criteria**:
- [ ] Loop runs checkers after each iteration
- [ ] All checkers must pass for completion
- [ ] Checker failures are logged with messages

### Step 2.4: Add Checker CLI Arguments

**File**: `agents/ralph-runner.ts` (modify)

**Requirements**:
- Add `--check <path>` argument (repeatable)
- Support inline command syntax: `--check command:"bun test"`
- Load checkers from paths or create from inline commands
- Pass checkers to loop controller

**Acceptance Criteria**:
- [ ] `--check ./my-checker.ts` loads custom checker
- [ ] `--check command:"bun test"` creates command checker
- [ ] Multiple `--check` flags work together

---

## Phase 3: Agent Chaining

**Goal**: Enable sequential execution of multiple agents with handoffs.

### Step 3.1: Create Chain Parser

**File**: `lib/ralph/chain-parser.ts`

**Description**: Parse chain definition DSL into structured steps.

**Requirements**:
- Parse format: `"agent1:10 -> agent2:15 -> agent3:5"`
- Extract agent name and max iterations for each step
- Validate agent names exist in `bin/`
- Return array of `ChainStep` objects:
  ```typescript
  interface ChainStep {
    agent: string;
    maxIterations: number;
    checkers?: string[];
  }
  ```

**Acceptance Criteria**:
- [ ] Parses simple chains correctly
- [ ] Validates agent names
- [ ] Returns structured step array
- [ ] Throws descriptive error on invalid syntax

### Step 3.2: Create State Manager

**File**: `lib/ralph/state-manager.ts`

**Description**: Persist chain/run state to filesystem for recovery and inspection.

**Requirements**:
- Define state directory: `.agent-state/`
- Implement `RunState` schema (per-agent run):
  ```typescript
  interface RunState {
    id: string;
    agent: string;
    startedAt: string;
    iterations: IterationRecord[];
    status: "running" | "complete" | "stagnated" | "max_iterations" | "interrupted";
    completedAt?: string;
  }
  ```
- Implement `ChainState` schema (multi-agent chain):
  ```typescript
  interface ChainState {
    id: string;
    definition: string;
    steps: ChainStepState[];
    currentStep: number;
    startedAt: string;
    completedAt?: string;
  }
  ```
- Methods: `saveRunState()`, `loadRunState()`, `saveChainState()`, `loadChainState()`
- Create checkpoint on each iteration completion

**Acceptance Criteria**:
- [ ] Creates `.agent-state/` directory if not exists
- [ ] Saves state as formatted JSON
- [ ] Can load and resume from saved state
- [ ] Generates unique IDs for runs/chains

### Step 3.3: Create Chain Executor

**File**: `lib/ralph/chain.ts`

**Description**: Execute a chain of agents sequentially.

**Requirements**:
- Accept parsed chain steps
- For each step:
  1. Update chain state to "running"
  2. Execute agent loop with step's max iterations
  3. If complete, update state and proceed to next step
  4. If failed/stagnated, stop chain and report
- Save state after each step completion
- Support resuming from saved chain state

**Acceptance Criteria**:
- [ ] Executes steps in sequence
- [ ] Stops on first failure
- [ ] Persists state between steps
- [ ] Can resume interrupted chain

### Step 3.4: Add Chain CLI Arguments

**File**: `agents/ralph-runner.ts` (modify)

**Requirements**:
- Add `--chain <definition>` argument (mutually exclusive with `--agent`)
- Add `--resume <state-file>` argument for recovery
- Add per-agent checker syntax: `--check agent1:./checker.ts`
- Route to chain executor when `--chain` provided

**Acceptance Criteria**:
- [ ] `--chain "planner:10 -> builder:20"` executes chain
- [ ] `--resume .agent-state/chain-xxx.json` resumes
- [ ] Per-agent checkers work with chain syntax

---

## Phase 4: Progress & Cost Tracking

**Goal**: Add observability with terminal UI and cost tracking.

### Step 4.1: Create Progress Reporter

**File**: `lib/ralph/progress-reporter.ts`

**Description**: Terminal UI for progress reporting with spinners.

**Requirements**:
- Use `ora` package for spinners
- Display current state: `[Agent: plan-coordinator] Iteration 3/20 | 2m 15s | $0.0342`
- Update in place (single line, no scroll)
- Show success/failure symbols on completion
- Support verbose mode with full output

**Acceptance Criteria**:
- [ ] Shows spinner during agent execution
- [ ] Updates iteration count in real-time
- [ ] Displays elapsed time
- [ ] Shows cost when available

### Step 4.2: Create Cost Tracker

**File**: `lib/ralph/cost-tracker.ts`

**Description**: Parse Claude CLI output for token usage and calculate cost.

**Requirements**:
- Parse JSON output from Claude CLI (`--output-format json`)
- Extract `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`
- Calculate cost based on model pricing:
  ```typescript
  const PRICING = {
    "claude-sonnet-4": { input: 3.00, output: 15.00, cacheRead: 0.30 },
    "claude-opus-4": { input: 15.00, output: 75.00, cacheRead: 1.50 },
  };
  ```
- Track cumulative cost across iterations
- Include in state persistence

**Acceptance Criteria**:
- [ ] Parses token counts from Claude output
- [ ] Calculates per-iteration cost
- [ ] Tracks cumulative cost
- [ ] Handles missing usage data gracefully

### Step 4.3: Create Iteration Logger

**File**: `lib/ralph/iteration-logger.ts`

**Description**: Append-only log of all iterations for analysis.

**Requirements**:
- Write to `.agent-state/iterations.jsonl`
- Log format (one JSON object per line):
  ```json
  {"runId":"xxx","iteration":1,"agent":"plan-coordinator","startedAt":"...","endedAt":"...","exitCode":0,"signals":["marker"],"tokens":1234,"cost":0.0123}
  ```
- Append after each iteration completes
- Include agent name, iteration number, duration, exit code, signals, tokens, cost

**Acceptance Criteria**:
- [ ] Creates JSONL file
- [ ] Appends one line per iteration
- [ ] Includes all relevant metrics
- [ ] File is human-readable and parseable

### Step 4.4: Generate Summary Report

**File**: `lib/ralph/summary.ts`

**Description**: Generate completion summary for terminal and file output.

**Requirements**:
- Summarize on completion:
  - Total iterations
  - Total duration
  - Total cost
  - Completion status (complete/stagnated/max_iterations)
  - Which signals triggered completion
- Print to terminal in formatted style
- Optionally write to `.agent-state/summary-<id>.md`

**Acceptance Criteria**:
- [ ] Prints readable summary to terminal
- [ ] Includes all key metrics
- [ ] Optionally saves to file

---

## Phase 5: Hook Integration

**Goal**: Wire into Claude Code's hook system for extensibility.

### Step 5.1: Define Hook Types

**File**: `lib/ralph/hooks.ts`

**Description**: Hook type definitions and execution logic.

**Requirements**:
- Define hook points:
  - `pre-iteration`: Before each agent spawn
  - `post-iteration`: After each agent exits
  - `on-complete`: When loop/chain finishes successfully
  - `on-stagnation`: When circuit breaker triggers
  - `on-failure`: When max iterations reached without completion
- Define hook context (passed via environment variables):
  ```
  RALPH_AGENT=plan-coordinator
  RALPH_ITERATION=5
  RALPH_MAX_ITERATIONS=20
  RALPH_EXIT_CODE=0
  RALPH_STATUS=running
  RALPH_WORK_DIR=/path/to/project
  ```
- Execute hooks via `Bun.spawn` with shell

**Acceptance Criteria**:
- [ ] Hooks receive context via env vars
- [ ] Hooks can be shell scripts or executables
- [ ] Hook failures are logged but don't stop execution (unless configured)

### Step 5.2: Add Hook CLI Arguments

**File**: `agents/ralph-runner.ts` (modify)

**Requirements**:
- Add `--hook <type>:<script>` argument (repeatable)
- Examples:
  - `--hook pre-iteration:./scripts/log-start.sh`
  - `--hook on-complete:./scripts/notify-slack.sh`
- Parse hook type and script path
- Register hooks with loop/chain executor

**Acceptance Criteria**:
- [ ] `--hook post-iteration:./log.sh` works
- [ ] Multiple hooks of same type are all executed
- [ ] Invalid hook type shows error

### Step 5.3: Integrate Hooks into Loop

**File**: `lib/ralph/loop.ts` (modify)

**Requirements**:
- Accept hook registry
- Call `pre-iteration` hooks before spawning agent
- Call `post-iteration` hooks after agent exits
- Call `on-complete`/`on-stagnation`/`on-failure` based on final status
- Log hook execution and any errors

**Acceptance Criteria**:
- [ ] Hooks fire at correct points
- [ ] Hook errors are caught and logged
- [ ] Hooks receive correct context

---

## File Structure Summary

```
claude-forge/
├── agents/
│   └── ralph-runner.ts              # Main CLI entry point
├── lib/
│   ├── ralph/
│   │   ├── spawner.ts               # Bun.spawn wrapper
│   │   ├── detector.ts              # Completion signal detection
│   │   ├── loop.ts                  # Core iteration loop
│   │   ├── chain-parser.ts          # Chain DSL parser
│   │   ├── chain.ts                 # Chain executor
│   │   ├── state-manager.ts         # State persistence
│   │   ├── progress-reporter.ts     # Terminal UI
│   │   ├── cost-tracker.ts          # Token/cost tracking
│   │   ├── iteration-logger.ts      # JSONL iteration log
│   │   ├── summary.ts               # Completion summary
│   │   └── hooks.ts                 # Hook system
│   └── checkers/
│       ├── index.ts                 # Checker interface & loader
│       ├── exit-code.ts             # Exit code checker
│       ├── stdout-marker.ts         # Stdout pattern checker
│       ├── file-exists.ts           # File existence checker
│       └── command-succeeds.ts      # Shell command checker
└── .agent-state/                    # Runtime state (gitignored)
    ├── run-<id>.json                # Per-run state
    ├── chain-<id>.json              # Per-chain state
    ├── iterations.jsonl             # Iteration log
    └── summary-<id>.md              # Completion summaries
```

---

## CLI Reference

```bash
# Single agent loop (required: --agent, --max-iterations)
ralph-runner --agent <name> --max-iterations <n> [options]

# Agent chain (required: --chain)
ralph-runner --chain "<agent1>:<n> -> <agent2>:<n>" [options]

# Resume interrupted run
ralph-runner --resume <state-file>

# Options
--check <path|command:"...">    # Add completion checker (repeatable)
--check <agent>:<path>          # Per-agent checker (chain mode)
--hook <type>:<script>          # Add hook (repeatable)
--cwd <path>                    # Working directory
--verbose, -v                   # Detailed output
--help, -h                      # Show help

# Examples
ralph-runner --agent plan-coordinator --max-iterations 20
ralph-runner --agent rails-backlog --max-iterations 15 --check command:"backlog task list --plain | grep -v Pending"
ralph-runner --chain "planner:10 -> builder:20 -> tester:5"
ralph-runner --chain "planner:10 -> builder:20" --hook on-complete:./notify.sh
ralph-runner --resume .agent-state/chain-abc123.json
```

---

## Testing Strategy

### Unit Tests
- `spawner.ts`: Mock Bun.spawn, verify output capture
- `detector.ts`: Test pattern matching with sample outputs
- `chain-parser.ts`: Test DSL parsing with valid/invalid inputs
- `state-manager.ts`: Test save/load/checkpoint cycle
- `checkers/*`: Test each checker with mock contexts

### Integration Tests
- Run `ralph-runner` against a test agent that completes after N iterations
- Test chain execution with mock agents
- Test resume from saved state
- Test hook execution

### Manual Testing
- Run against real `plan-coordinator` agent
- Run against `rails-backlog` agent with backlog.md project
- Test SIGINT handling
- Verify cost tracking accuracy

---

## Definition of Done

- [ ] All phases implemented and tested
- [ ] CLI compiles to standalone binary
- [ ] Works with existing claude-forge agents
- [ ] Documentation in README updated
- [ ] Example usage added to docs/
- [ ] No regressions in existing agents
