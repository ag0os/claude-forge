# Building a Bun-based AI agent orchestrator with Ralph-style iteration loops

The **Ralph Wiggum pattern** represents a breakthrough in autonomous AI coding: spawn fresh agent instances in a loop, detect completion via explicit markers like `<promise>COMPLETE</promise>`, and persist state in external files rather than context. Bun's **60% faster `Bun.spawn`** API, combined with TypeScript's type safety, provides an ideal foundation for building such orchestration tools. This report synthesizes implementation patterns from snarktank/ralph, frankbria/ralph-claude-code, and claude-forge to guide construction of a production-ready CLI orchestrator.

---

## Bun.spawn provides the foundation for child process management

Bun's subprocess API uses `posix_spawn(3)` under the hood, making it significantly faster than Node.js's child_process module. The core pattern for capturing agent output involves spawning a process with `stdout: "pipe"` and consuming the resulting `ReadableStream`:

```typescript
const proc = Bun.spawn(["claude", "-p", prompt], {
  cwd: "./workspace",
  env: { ...process.env, CLAUDE_MODEL: "sonnet" },
  stdout: "pipe",
  stderr: "pipe",
  onExit(proc, exitCode, signalCode, error) {
    console.log(`Agent exited with code: ${exitCode}`);
  },
});

// Capture output as text
const output = await proc.stdout.text();
const exitCode = await proc.exited;
```

For real-time pattern matching during long-running agent sessions, stream the output line-by-line using an async iterator. This enables detecting completion markers **before** the process terminates:

```typescript
async function* streamLines(proc: Bun.Subprocess): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  
  for await (const chunk of proc.stdout) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) yield line;
  }
  if (buffer) yield buffer;
}

// Usage: detect completion in real-time
for await (const line of streamLines(proc)) {
  if (line.includes("<promise>COMPLETE</promise>")) {
    proc.kill("SIGTERM");
    return { complete: true, output: line };
  }
}
```

**Signal handling** follows Node.js conventions. The critical pattern for graceful shutdown tracks all spawned child processes and terminates them before exit:

```typescript
const childProcesses: Bun.Subprocess[] = [];

process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  for (const proc of childProcesses) {
    if (!proc.killed) proc.kill("SIGTERM");
  }
  await Promise.all(childProcesses.map(p => p.exited));
  process.exit(0);
});
```

---

## Ralph implementations demonstrate two distinct completion detection philosophies

The **snarktank/ralph** repository (4.9k stars) takes a simple approach: run the Amp CLI in a bash loop and grep for the `<promise>COMPLETE</promise>` marker. Each iteration spawns a fresh agent instance with clean context, reading task state from a `prd.json` file where each user story has a `passes: true/false` field:

```bash
#!/bin/bash
MAX_ITERATIONS=${1:-10}

for ((i=1; i<=MAX_ITERATIONS; i++)); do
    result=$(amp -p "$(cat prompt.md)")
    
    if echo "$result" | grep -q "<promise>COMPLETE</promise>"; then
        echo "✅ All stories complete."
        exit 0
    fi
done
```

The **frankbria/ralph-claude-code** repository (3.9k stars) implements a more sophisticated **dual-condition exit gate**. Completion requires both semantic indicators (like completion language in output) AND an explicit `EXIT_SIGNAL: true` from Claude. This prevents premature exit when Claude merely discusses completion without actually achieving it:

```typescript
interface RalphStatus {
  STATUS: "COMPLETE" | "IN_PROGRESS" | "BLOCKED";
  EXIT_SIGNAL: boolean;
  WORK_SUMMARY: string;
}

function shouldExitGracefully(signals: SignalHistory): boolean {
  const recentTestLoops = signals.test_only_loops.length;
  const recentDoneSignals = signals.done_signals.length;
  const recentCompletionIndicators = signals.completion_indicators.length;
  const claudeExitSignal = signals.explicit_exit_signal;
  
  // Exit condition 1: Too many test-only loops (stagnation)
  if (recentTestLoops >= 3) return true;
  
  // Exit condition 2: Multiple done signals
  if (recentDoneSignals >= 2) return true;
  
  // Exit condition 3: Completion indicators WITH explicit exit signal
  if (recentCompletionIndicators >= 2 && claudeExitSignal) return true;
  
  return false;
}
```

Key safety mechanisms in frankbria's implementation include **rate limiting** (100 calls/hour), a **circuit breaker** that opens after 3 stagnant loops with no file changes, and detection of Claude's 5-hour API usage limits.

---

## Multi-signal completion detection provides the most robust approach

Combining exit codes, file watching, and stdout markers yields a completion detector that handles edge cases gracefully. Bun supports file watching via the Node.js-compatible `fs.watch` API:

```typescript
type CompletionSignal = 
  | { type: "exit"; code: number }
  | { type: "file"; path: string }
  | { type: "stdout"; marker: string }
  | { type: "timeout" };

class MultiSignalDetector {
  private markers = [
    /<promise>COMPLETE<\/promise>/,
    /"status":\s*"completed"/,
    /RALPH_STATUS:\s*STATUS:\s*COMPLETE/,
  ];
  
  async detect(proc: Bun.Subprocess, workDir: string): Promise<{
    complete: boolean;
    signals: CompletionSignal[];
  }> {
    const signals: CompletionSignal[] = [];
    const controller = new AbortController();
    
    // Race: exit code, file creation, stdout marker, timeout
    const promises = [
      proc.exited.then(code => ({ type: "exit" as const, code })),
      this.watchForFile(workDir, ".done", controller.signal),
      this.watchStdout(proc.stdout, controller.signal),
      this.timeout(300_000).then(() => ({ type: "timeout" as const })),
    ];
    
    const result = await Promise.race(promises);
    controller.abort();
    signals.push(result);
    
    return {
      complete: result.type !== "timeout" && 
                (result.type !== "exit" || result.code === 0),
      signals,
    };
  }
  
  private async watchStdout(
    stream: ReadableStream<Uint8Array>,
    signal: AbortSignal
  ): Promise<CompletionSignal> {
    const reader = stream.getReader();
    let buffer = "";
    
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      
      for (const marker of this.markers) {
        const match = buffer.match(marker);
        if (match) return { type: "stdout", marker: match[0] };
      }
    }
    throw new Error("Stream ended without marker");
  }
}
```

---

## Agent chaining requires parsing DSL definitions and managing state transitions

For chain definitions like `--chain "researcher:10 -> writer:15 -> reviewer:5"`, a simple regex parser extracts agent names and iteration counts:

```typescript
interface AgentStep {
  name: string;
  iterations: number;
  onSuccess?: string;
  onFailure?: string;
}

function parseChainDefinition(chainString: string): AgentStep[] {
  const CHAIN_REGEX = /(\w+):(\d+)(?:\s*->\s*)?/g;
  const steps: AgentStep[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = CHAIN_REGEX.exec(chainString)) !== null) {
    steps.push({
      name: match[1],
      iterations: parseInt(match[2], 10),
    });
  }
  
  if (steps.length === 0) {
    throw new Error(`Invalid chain: ${chainString}`);
  }
  return steps;
}

// Extended syntax with error handling: "agent1:10 -> agent2:15 | error_handler:3"
function parseAdvancedChain(definition: string): { 
  steps: AgentStep[]; 
  errorHandler?: AgentStep 
} {
  const [mainChain, errorChain] = definition.split("|").map(s => s.trim());
  return {
    steps: parseChainDefinition(mainChain),
    errorHandler: errorChain ? parseChainDefinition(errorChain)[0] : undefined,
  };
}
```

**State persistence** between agents follows a filesystem-based approach, mirroring Ralph's design where progress lives outside the agent context. A `StateManager` class handles saving, loading, and checkpointing:

```typescript
interface ChainState {
  chainId: string;
  currentStep: number;
  steps: { id: string; status: "pending" | "running" | "done" | "failed"; output?: unknown }[];
  globalContext: Record<string, unknown>;
}

class StateManager {
  constructor(private stateDir = "./.agent-state") {}
  
  saveState(state: ChainState): void {
    Bun.write(
      `${this.stateDir}/${state.chainId}.json`,
      JSON.stringify(state, null, 2)
    );
  }
  
  loadState(chainId: string): ChainState | null {
    const file = Bun.file(`${this.stateDir}/${chainId}.json`);
    if (!file.size) return null;
    return file.json();
  }
  
  createCheckpoint(state: ChainState): string {
    const checkpointId = `${state.chainId}_${Date.now()}`;
    Bun.write(
      `${this.stateDir}/checkpoints/${checkpointId}.json`,
      JSON.stringify(state, null, 2)
    );
    return checkpointId;
  }
}
```

---

## Iteration management combines progress reporting with cost tracking

Terminal progress reporting uses the **ora** library (37M weekly npm downloads) for spinners. A `ProgressReporter` class encapsulates iteration state and formatting:

```typescript
import ora, { Ora } from "ora";

class ProgressReporter {
  private spinner: Ora;
  private startTime = Date.now();
  private totalCost = 0;
  
  startChain(totalSteps: number): void {
    this.spinner = ora({
      text: `Initializing chain (${totalSteps} steps)...`,
      spinner: "dots",
    }).start();
  }
  
  updateIteration(step: number, iteration: number, maxIter: number, cost?: number): void {
    if (cost) this.totalCost += cost;
    const elapsed = this.formatDuration(Date.now() - this.startTime);
    this.spinner.text = `[Step ${step}] Iteration ${iteration}/${maxIter} | ${elapsed} | $${this.totalCost.toFixed(4)}`;
  }
  
  stepSuccess(message: string): void {
    this.spinner.succeed(message);
    this.spinner = ora({ spinner: "dots" }).start();
  }
  
  private formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }
}
```

**Cost tracking** parses token usage from Claude CLI's `--output-format json` output. The `usage` object contains `input_tokens`, `output_tokens`, and cache-related fields:

```typescript
const PRICING = {
  "claude-sonnet-4": { input: 3.00, output: 15.00, cacheRead: 0.30 },
};

function parseClaudeUsage(output: string): { tokens: number; cost: number } | null {
  try {
    const data = JSON.parse(output);
    if (!data.usage) return null;
    
    const inputTokens = data.usage.input_tokens || 0;
    const outputTokens = data.usage.output_tokens || 0;
    const cacheReadTokens = data.usage.cache_read_input_tokens || 0;
    
    const cost = 
      (inputTokens / 1_000_000) * PRICING["claude-sonnet-4"].input +
      (outputTokens / 1_000_000) * PRICING["claude-sonnet-4"].output +
      (cacheReadTokens / 1_000_000) * PRICING["claude-sonnet-4"].cacheRead;
    
    return { tokens: inputTokens + outputTokens, cost };
  } catch {
    return null;
  }
}
```

---

## Claude-forge demonstrates specification-driven task management

The **claudeforge/Forge** project (TypeScript, installable as a Claude Code plugin) provides an excellent reference architecture. It uses a `.forge/` directory structure for specs, plans, tasks, and rules. Key patterns include **multi-criteria completion** (tests, coverage, lint, custom scripts) and **stuck detection** with automatic recovery strategies.

Their plugin architecture for completion checkers is particularly relevant:

```typescript
interface CompletionChecker {
  name: string;
  priority: number;
  check(context: TaskContext): Promise<{ passed: boolean; message?: string }>;
}

class TestChecker implements CompletionChecker {
  name = "tests";
  priority = 1;
  
  async check(ctx: TaskContext): Promise<{ passed: boolean; message?: string }> {
    const result = Bun.spawnSync(["bun", "test"], { cwd: ctx.workDir });
    return {
      passed: result.exitCode === 0,
      message: result.exitCode === 0 ? "All tests pass" : "Tests failing",
    };
  }
}

class CustomScriptChecker implements CompletionChecker {
  name = "custom";
  priority = 10;
  
  constructor(private scriptPath: string) {}
  
  async check(ctx: TaskContext): Promise<{ passed: boolean; message?: string }> {
    const result = Bun.spawnSync(["bash", this.scriptPath], { cwd: ctx.workDir });
    return { passed: result.exitCode === 0 };
  }
}
```

---

## A recommended architecture integrates these patterns

Based on the research, the following structure provides a solid foundation for a Bun-based Ralph orchestrator:

```
ralph-bun/
├── src/
│   ├── cli.ts                      # Entry point with subcommands
│   ├── commands/
│   │   ├── run.ts                  # Single agent iteration loop
│   │   ├── chain.ts                # Chain multiple agents
│   │   └── status.ts               # Check state/progress
│   ├── core/
│   │   ├── spawner.ts              # Bun.spawn wrapper
│   │   ├── loop.ts                 # Main iteration controller
│   │   └── detector.ts             # Multi-signal completion
│   ├── plugins/
│   │   ├── loader.ts               # Dynamic checker loading
│   │   └── checkers/               # Built-in completion checkers
│   ├── state/
│   │   └── manager.ts              # Filesystem state persistence
│   └── config/
│       └── schema.ts               # YAML/JSON config types
├── .ralphrc.yaml                   # Project config
└── package.json
```

The CLI entry point uses Bun's built-in `util.parseArgs` for argument handling:

```typescript
#!/usr/bin/env bun
import { parseArgs } from "util";
import { runCommand } from "./commands/run";
import { chainCommand } from "./commands/chain";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iterations: { type: "string", short: "i", default: "10" },
    chain: { type: "string", short: "c" },
    config: { type: "string" },
    verbose: { type: "boolean", short: "v" },
  },
  allowPositionals: true,
  strict: true,
});

const [command] = positionals;

if (command === "run") {
  await runCommand({ iterations: parseInt(values.iterations) });
} else if (command === "chain" && values.chain) {
  await chainCommand({ chainDef: values.chain });
} else {
  console.log("Usage: ralph <run|chain> [options]");
}
```

---

## Conclusion

Building a Bun-based Ralph orchestrator benefits from three key architectural decisions. First, use **Bun.spawn with streaming stdout** to detect completion markers in real-time rather than waiting for process termination. Second, implement **multi-signal completion detection** combining exit codes, file watchers, and stdout parsing—the frankbria dual-gate pattern prevents premature exits. Third, persist all state to the **filesystem** (JSON files for structured data, append-only logs for learnings), enabling each iteration to spawn with fresh context while retaining cross-iteration knowledge.

The most critical insight from existing Ralph implementations is that **deterministic failure beats unpredictable success**. Always set `--max-iterations` limits, implement circuit breakers for stagnation detection, and track cost aggressively. The `<promise>COMPLETE</promise>` marker pattern works because it forces the agent to make an explicit, greppable assertion of completion rather than relying on semantic interpretation of natural language.