/**
 * Core runner for forkhestra agent execution
 *
 * Spawns agent binaries or Claude directly, streams output, detects completion markers,
 * and handles loop/single-run modes.
 *
 * Direct spawn mode: When an agent config has systemPrompt or systemPromptText,
 * the runner spawns Claude directly with --append-system-prompt instead of
 * running a compiled binary.
 */

import { spawn, type Subprocess } from "bun";
import { isAbsolute, join } from "node:path";

import { isDirectSpawnAgent, type AgentConfig } from "./config";
import { COMPLETION_MARKER } from "./constants";
import { composeSystemPrompt, loadAgentSystemPrompt } from "./mode-awareness";

/**
 * Re-export COMPLETION_MARKER for backward compatibility
 */
export { COMPLETION_MARKER };

/**
 * Result from running an agent
 */
export interface RunResult {
	/** Whether the agent completed (marker detected or single run finished) */
	complete: boolean;
	/** Number of iterations executed */
	iterations: number;
	/** Exit code from the last agent run */
	exitCode: number;
	/** Reason for stopping */
	reason: "marker" | "max_iterations" | "error" | "single_run";
}

/**
 * Options for running an agent
 */
export interface RunOptions {
	/** Agent binary name (must be in PATH) */
	agent: string;
	/** Maximum iterations (only applies when loop: true) */
	maxIterations: number;
	/** Whether to loop until completion marker or max iterations */
	loop: boolean;
	/** Additional arguments to pass to the agent */
	args?: string[];
	/** Working directory for the agent */
	cwd?: string;
	/** Show verbose output */
	verbose?: boolean;
	/** Prompt to pass as positional argument to the agent */
	prompt?: string;
	/** Agent configuration (for direct spawn support) */
	agentConfig?: AgentConfig;
}

/**
 * Run an agent with optional looping until completion
 *
 * Dispatches to either runDirect() for direct spawn agents (those with systemPrompt)
 * or runBinary() for legacy binary agents.
 *
 * In loop mode (loop: true):
 * - Streams stdout and watches for FORKHESTRA_COMPLETE marker
 * - Loops until marker detected or maxIterations reached
 *
 * In single-run mode (loop: false):
 * - Runs the agent once
 * - Returns immediately when agent exits, ignoring completion marker
 *
 * @param options - Run configuration
 * @returns RunResult with completion status and metadata
 */
export async function run(options: RunOptions): Promise<RunResult> {
	const { agentConfig, cwd } = options;

	// Dispatch to the appropriate runner based on agent configuration
	if (agentConfig && isDirectSpawnAgent(agentConfig)) {
		return runDirect(options);
	}

	return runBinary(options);
}

/**
 * Run a legacy binary agent
 *
 * Spawns a compiled agent binary with --print and --dangerously-skip-permissions flags.
 *
 * @param options - Run configuration
 * @returns RunResult with completion status and metadata
 */
async function runBinary(options: RunOptions): Promise<RunResult> {
	const {
		agent,
		maxIterations,
		loop,
		args = [],
		cwd,
		verbose = false,
		prompt,
	} = options;

	// Build command arguments
	// Note: cwd is passed to spawn() directly, not as an argument
	const cmdArgs: string[] = [...args];

	// Append prompt as last positional argument if provided
	if (prompt) {
		cmdArgs.push(prompt);
	}

	// Track child process for signal forwarding
	let currentProcess: Subprocess | null = null;
	let signalReceived = false;

	// Set up signal handlers for graceful shutdown
	const handleSignal = (signal: NodeJS.Signals) => {
		signalReceived = true;
		if (currentProcess) {
			try {
				currentProcess.kill(signal);
			} catch {
				// Process may have already exited
			}
		}
	};

	// Store handler references so removeListener can match them
	const sigintHandler = () => handleSignal("SIGINT");
	const sigtermHandler = () => handleSignal("SIGTERM");

	process.on("SIGINT", sigintHandler);
	process.on("SIGTERM", sigtermHandler);

	// Cleanup function to remove signal handlers
	const cleanup = () => {
		process.removeListener("SIGINT", sigintHandler);
		process.removeListener("SIGTERM", sigtermHandler);
	};

	try {
		// Single-run mode: execute once and return
		if (!loop) {
			const result = await runBinaryOnce(agent, cmdArgs, cwd, verbose);
			currentProcess = null;
			cleanup();

			return {
				complete: result.exitCode === 0,
				iterations: 1,
				exitCode: result.exitCode,
				reason: "single_run",
			};
		}

		// Loop mode: iterate until marker or max iterations
		let iterations = 0;
		let lastExitCode = 0;

		while (iterations < maxIterations && !signalReceived) {
			iterations++;

			if (verbose) {
				console.log(
					`[forkhestra] Iteration ${iterations}/${maxIterations}`,
				);
			}

			const result = await runBinaryOnceWithMarkerDetection(
				agent,
				cmdArgs,
				cwd,
				verbose,
				(proc) => {
					currentProcess = proc;
				},
			);

			lastExitCode = result.exitCode;
			currentProcess = null;

			// Check if completion marker was detected
			if (result.markerDetected) {
				cleanup();
				return {
					complete: true,
					iterations,
					exitCode: lastExitCode,
					reason: "marker",
				};
			}

			// If signal received during iteration, break out
			if (signalReceived) {
				break;
			}
		}

		// Max iterations reached without completion
		cleanup();
		return {
			complete: false,
			iterations,
			exitCode: lastExitCode,
			reason: signalReceived ? "error" : "max_iterations",
		};
	} catch (error) {
		cleanup();
		return {
			complete: false,
			iterations: 0,
			exitCode: 1,
			reason: "error",
		};
	}
}

/**
 * Run a direct spawn agent (spawns Claude CLI directly)
 *
 * Builds a claude command with:
 * - --print and --dangerously-skip-permissions (non-interactive mode)
 * - --append-system-prompt with composed prompt (mode awareness + agent prompt)
 * - Optional --max-turns, --model, --mcp-config, --settings, --allowedTools, --disallowedTools
 *
 * @param options - Run configuration (must include agentConfig)
 * @returns RunResult with completion status and metadata
 */
async function runDirect(options: RunOptions): Promise<RunResult> {
	const {
		maxIterations,
		loop,
		args = [],
		cwd,
		verbose = false,
		prompt,
		agentConfig,
	} = options;

	// Should not happen if called correctly, but guard anyway
	if (!agentConfig) {
		return {
			complete: false,
			iterations: 0,
			exitCode: 1,
			reason: "error",
		};
	}

	// Resolve the working directory
	const resolvedCwd = cwd || process.cwd();

	// Load and compose the system prompt
	const rawSystemPrompt = await loadAgentSystemPrompt(agentConfig, resolvedCwd);
	if (!rawSystemPrompt) {
		// Should not happen for direct spawn agents, but guard anyway
		console.error("[forkhestra] Direct spawn agent has no system prompt");
		return {
			complete: false,
			iterations: 0,
			exitCode: 1,
			reason: "error",
		};
	}

	const composedSystemPrompt = composeSystemPrompt(rawSystemPrompt);

	// Build the base claude command arguments
	const claudeArgs = buildClaudeArgs(agentConfig, composedSystemPrompt, resolvedCwd);

	// Append additional args
	claudeArgs.push(...args);

	// Append prompt as last positional argument if provided
	if (prompt) {
		claudeArgs.push(prompt);
	}

	// Track child process for signal forwarding
	let currentProcess: Subprocess | null = null;
	let signalReceived = false;

	// Set up signal handlers for graceful shutdown
	const handleSignal = (signal: NodeJS.Signals) => {
		signalReceived = true;
		if (currentProcess) {
			try {
				currentProcess.kill(signal);
			} catch {
				// Process may have already exited
			}
		}
	};

	const sigintHandler = () => handleSignal("SIGINT");
	const sigtermHandler = () => handleSignal("SIGTERM");

	process.on("SIGINT", sigintHandler);
	process.on("SIGTERM", sigtermHandler);

	const cleanup = () => {
		process.removeListener("SIGINT", sigintHandler);
		process.removeListener("SIGTERM", sigtermHandler);
	};

	try {
		// Single-run mode: execute once and return
		if (!loop) {
			const result = await runDirectOnce(claudeArgs, resolvedCwd, verbose);
			currentProcess = null;
			cleanup();

			return {
				complete: result.exitCode === 0,
				iterations: 1,
				exitCode: result.exitCode,
				reason: "single_run",
			};
		}

		// Loop mode: iterate until marker or max iterations
		let iterations = 0;
		let lastExitCode = 0;

		while (iterations < maxIterations && !signalReceived) {
			iterations++;

			if (verbose) {
				console.log(
					`[forkhestra] Iteration ${iterations}/${maxIterations}`,
				);
			}

			const result = await runDirectOnceWithMarkerDetection(
				claudeArgs,
				resolvedCwd,
				verbose,
				(proc) => {
					currentProcess = proc;
				},
			);

			lastExitCode = result.exitCode;
			currentProcess = null;

			// Check if completion marker was detected
			if (result.markerDetected) {
				cleanup();
				return {
					complete: true,
					iterations,
					exitCode: lastExitCode,
					reason: "marker",
				};
			}

			// If signal received during iteration, break out
			if (signalReceived) {
				break;
			}
		}

		// Max iterations reached without completion
		cleanup();
		return {
			complete: false,
			iterations,
			exitCode: lastExitCode,
			reason: signalReceived ? "error" : "max_iterations",
		};
	} catch (error) {
		cleanup();
		return {
			complete: false,
			iterations: 0,
			exitCode: 1,
			reason: "error",
		};
	}
}

/**
 * Build Claude CLI arguments from agent config
 *
 * @param agentConfig - Agent configuration with optional settings
 * @param composedSystemPrompt - The composed system prompt (mode awareness + agent prompt)
 * @param cwd - Working directory for resolving relative paths
 * @returns Array of CLI arguments for the claude command
 */
function buildClaudeArgs(
	agentConfig: AgentConfig,
	composedSystemPrompt: string,
	cwd: string
): string[] {
	const args: string[] = [
		"--print",
		"--dangerously-skip-permissions",
		"--append-system-prompt",
		composedSystemPrompt,
	];

	// Add --max-turns if configured
	if (agentConfig.maxTurns !== undefined) {
		args.push("--max-turns", String(agentConfig.maxTurns));
	}

	// Add --model if configured
	if (agentConfig.model !== undefined) {
		args.push("--model", agentConfig.model);
	}

	// Add --mcp-config if configured (resolve relative paths)
	if (agentConfig.mcpConfig !== undefined) {
		const mcpPath = isAbsolute(agentConfig.mcpConfig)
			? agentConfig.mcpConfig
			: join(cwd, agentConfig.mcpConfig);
		args.push("--mcp-config", mcpPath);
	}

	// Add --settings if configured (resolve relative paths)
	if (agentConfig.settings !== undefined) {
		const settingsPath = isAbsolute(agentConfig.settings)
			? agentConfig.settings
			: join(cwd, agentConfig.settings);
		args.push("--settings", settingsPath);
	}

	// Add --allowedTools if configured
	if (agentConfig.allowedTools !== undefined && agentConfig.allowedTools.length > 0) {
		args.push("--allowedTools", agentConfig.allowedTools.join(","));
	}

	// Add --disallowedTools if configured
	if (agentConfig.disallowedTools !== undefined && agentConfig.disallowedTools.length > 0) {
		args.push("--disallowedTools", agentConfig.disallowedTools.join(","));
	}

	return args;
}

/**
 * Internal result from a single agent run
 */
interface SingleRunResult {
	exitCode: number;
	markerDetected: boolean;
}

// ============================================================================
// Binary agent helpers (for legacy compiled agent binaries)
// ============================================================================

/**
 * Run binary agent once without marker detection (for single-run mode)
 */
async function runBinaryOnce(
	agent: string,
	args: string[],
	cwd?: string,
	_verbose?: boolean,
): Promise<{ exitCode: number }> {
	// Pass --print and --dangerously-skip-permissions so agents run non-interactively
	const proc = spawn([agent, "--print", "--dangerously-skip-permissions", ...args], {
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		cwd: cwd || process.cwd(),
		env: process.env,
	});

	await proc.exited;

	return {
		exitCode: proc.exitCode ?? 0,
	};
}

/**
 * Run binary agent once with stdout streaming and marker detection (for loop mode)
 */
async function runBinaryOnceWithMarkerDetection(
	agent: string,
	args: string[],
	cwd?: string,
	_verbose?: boolean,
	onProcessStart?: (proc: Subprocess) => void,
): Promise<SingleRunResult> {
	// Pass --print and --dangerously-skip-permissions so agents run non-interactively
	const proc = spawn([agent, "--print", "--dangerously-skip-permissions", ...args], {
		stdin: "inherit",
		stdout: "pipe",
		stderr: "inherit",
		cwd: cwd || process.cwd(),
		env: process.env,
	});

	// Notify caller of process start for signal handling
	if (onProcessStart) {
		onProcessStart(proc);
	}

	const result = await streamAndDetectMarker(proc);

	return result;
}

// ============================================================================
// Direct spawn helpers (for Claude CLI direct spawning)
// ============================================================================

/**
 * Run Claude directly once without marker detection (for single-run mode)
 */
async function runDirectOnce(
	args: string[],
	cwd: string,
	_verbose?: boolean,
): Promise<{ exitCode: number }> {
	const proc = spawn(["claude", ...args], {
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		cwd,
		env: process.env,
	});

	await proc.exited;

	return {
		exitCode: proc.exitCode ?? 0,
	};
}

/**
 * Run Claude directly once with stdout streaming and marker detection (for loop mode)
 */
async function runDirectOnceWithMarkerDetection(
	args: string[],
	cwd: string,
	_verbose?: boolean,
	onProcessStart?: (proc: Subprocess) => void,
): Promise<SingleRunResult> {
	const proc = spawn(["claude", ...args], {
		stdin: "inherit",
		stdout: "pipe",
		stderr: "inherit",
		cwd,
		env: process.env,
	});

	// Notify caller of process start for signal handling
	if (onProcessStart) {
		onProcessStart(proc);
	}

	const result = await streamAndDetectMarker(proc);

	return result;
}

// ============================================================================
// Shared helpers
// ============================================================================

/**
 * Stream stdout from a process and detect the completion marker
 *
 * @param proc - The spawned subprocess with piped stdout
 * @returns SingleRunResult with exit code and marker detection status
 */
async function streamAndDetectMarker(proc: Subprocess): Promise<SingleRunResult> {
	let markerDetected = false;
	let buffer = "";

	// Stream stdout and detect marker
	// proc.stdout can be a ReadableStream or a file descriptor number
	if (proc.stdout && typeof proc.stdout !== "number") {
		const reader = proc.stdout.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const text = decoder.decode(value, { stream: true });
				buffer += text;

				// Write to stdout (passthrough)
				process.stdout.write(text);

				// Check for completion marker in accumulated buffer
				if (buffer.includes(COMPLETION_MARKER)) {
					markerDetected = true;
				}

				// Keep buffer from growing unbounded (keep last 1000 chars)
				if (buffer.length > 2000) {
					buffer = buffer.slice(-1000);
				}
			}
		} catch {
			// Stream may have been closed
		}
	}

	await proc.exited;

	return {
		exitCode: proc.exitCode ?? 0,
		markerDetected,
	};
}
