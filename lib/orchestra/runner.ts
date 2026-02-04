/**
 * Core runner for orchestra agent execution
 *
 * Spawns agent binaries or uses runtime abstraction for Claude execution,
 * streams output, detects completion markers, and handles loop/single-run modes.
 *
 * Direct spawn mode: When an agent config has systemPrompt or systemPromptText,
 * the runner uses the runtime abstraction to execute Claude with the composed
 * system prompt instead of running a compiled binary.
 */

import { spawn, type Subprocess } from "bun";
import { isAbsolute, join } from "node:path";

import { isDirectSpawnAgent, type AgentConfig } from "./config";
import { COMPLETION_MARKER } from "./constants";
import { composeSystemPrompt, loadAgentSystemPrompt } from "./mode-awareness";
import { getRuntime } from "../runtime";

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
 * - Streams stdout and watches for ORCHESTRA_COMPLETE marker
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
					`[orchestra] Iteration ${iterations}/${maxIterations}`,
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
 * Run a direct spawn agent using the runtime abstraction
 *
 * Uses the runtime abstraction layer to execute Claude with:
 * - Composed system prompt (mode awareness + agent prompt)
 * - Model, MCP config, settings, and tool restrictions from agent config
 * - Skip permissions for headless mode
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
	if (rawSystemPrompt === undefined) {
		// No system prompt configured at all (empty string is valid)
		console.error("[orchestra] Direct spawn agent has no system prompt configured");
		return {
			complete: false,
			iterations: 0,
			exitCode: 1,
			reason: "error",
		};
	}

	const composedSystemPrompt = composeSystemPrompt(rawSystemPrompt);

	// Get the runtime for the specified backend (defaults to claude-cli)
	const runtime = getRuntime(agentConfig.backend ?? "claude-cli");

	// Build runtime run options from agent config
	const runtimeOptions = buildRuntimeOptions(
		agentConfig,
		composedSystemPrompt,
		resolvedCwd,
		prompt,
		args
	);

	// Single-run mode: execute once and return
	if (!loop) {
		const caps = runtime.capabilities();
		let result: import("../runtime").RunResult;

		if (caps.supportsStreaming) {
			result = await runtime.runStreaming(runtimeOptions, {
				onStdout: (data) => process.stdout.write(data),
				onStderr: (data) => process.stderr.write(data),
			});
		} else {
			result = await runtime.run(runtimeOptions);
			if (result.stdout) {
				process.stdout.write(result.stdout);
			}
			if (result.stderr) {
				process.stderr.write(result.stderr);
			}
		}

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

	while (iterations < maxIterations) {
		iterations++;

		if (verbose) {
			console.log(
				`[orchestra] Iteration ${iterations}/${maxIterations}`,
			);
		}

		// Use streaming to detect the completion marker
		const result = await runtime.runStreaming(
			runtimeOptions,
			{
				onStdout: (data) => process.stdout.write(data),
				onStderr: (data) => process.stderr.write(data),
			}
		);

		lastExitCode = result.exitCode;

		// Check if completion marker was detected
		if (result.completionMarkerFound) {
			return {
				complete: true,
				iterations,
				exitCode: lastExitCode,
				reason: "marker",
			};
		}
	}

	// Max iterations reached without completion
	return {
		complete: false,
		iterations,
		exitCode: lastExitCode,
		reason: "max_iterations",
	};
}

/**
 * Build runtime run options from agent config
 *
 * @param agentConfig - Agent configuration with optional settings
 * @param composedSystemPrompt - The composed system prompt (mode awareness + agent prompt)
 * @param cwd - Working directory for resolving relative paths
 * @param prompt - Optional prompt to pass to the agent
 * @param rawArgs - Additional raw CLI arguments
 * @returns RunOptions for the runtime
 */
function buildRuntimeOptions(
	agentConfig: AgentConfig,
	composedSystemPrompt: string,
	cwd: string,
	prompt?: string,
	rawArgs: string[] = []
): import("../runtime").RunOptions {
	// Resolve MCP config path if relative
	let mcpConfig: string | undefined;
	if (agentConfig.mcpConfig !== undefined) {
		mcpConfig = isAbsolute(agentConfig.mcpConfig)
			? agentConfig.mcpConfig
			: join(cwd, agentConfig.mcpConfig);
	}

	// Resolve settings path if relative
	let settings: string | undefined;
	if (agentConfig.settings !== undefined) {
		settings = isAbsolute(agentConfig.settings)
			? agentConfig.settings
			: join(cwd, agentConfig.settings);
	}

	return {
		prompt,
		systemPrompt: composedSystemPrompt,
		cwd,
		mode: "print",
		skipPermissions: true,
		model: agentConfig.model,
		maxTurns: agentConfig.maxTurns,
		mcpConfig,
		settings,
		tools: {
			allowed: agentConfig.allowedTools,
			disallowed: agentConfig.disallowedTools,
		},
		rawArgs: rawArgs.length > 0 ? rawArgs : undefined,
	};
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
