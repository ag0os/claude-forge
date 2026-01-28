/**
 * Core runner for forkhestra agent execution
 *
 * Spawns agent binaries, streams output, detects completion markers,
 * and handles loop/single-run modes.
 */

import { spawn, type Subprocess } from "bun";

/**
 * Marker that agents output to signal completion
 */
export const COMPLETION_MARKER = "FORKHESTRA_COMPLETE";

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
}

/**
 * Run an agent with optional looping until completion
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
			const result = await runOnce(agent, cmdArgs, cwd, verbose);
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

			const result = await runOnceWithMarkerDetection(
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
 * Internal result from a single agent run
 */
interface SingleRunResult {
	exitCode: number;
	markerDetected: boolean;
}

/**
 * Run agent once without marker detection (for single-run mode)
 */
async function runOnce(
	agent: string,
	args: string[],
	cwd?: string,
	verbose?: boolean,
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
 * Run agent once with stdout streaming and marker detection (for loop mode)
 */
async function runOnceWithMarkerDetection(
	agent: string,
	args: string[],
	cwd?: string,
	verbose?: boolean,
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

	let markerDetected = false;
	let buffer = "";

	// Stream stdout and detect marker
	if (proc.stdout) {
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
