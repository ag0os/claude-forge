/**
 * Claude CLI runtime backend
 *
 * Implements the AgentRuntime interface for Claude Code CLI.
 * This backend wraps the existing spawn logic from lib/claude.ts
 * and provides streaming output with marker detection for orchestra loops.
 *
 * @module lib/runtime/claude-cli
 */

import { spawn, type Subprocess } from "bun";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

import { getForgeRoot } from "../forge-root";
import { COMPLETION_MARKER } from "../orchestra/constants";
import { debugCommand, debugSpawn } from "./debug";
import type {
	AgentRuntime,
	RunOptions,
	RunResult,
	RuntimeCapabilities,
	StreamCallbacks,
} from "./types";

/**
 * Claude CLI runtime backend
 *
 * Provides agent execution via the Claude Code CLI (claude command).
 * Supports all features including MCP, tools, model selection, and max turns.
 *
 * @example
 * ```ts
 * const runtime = new ClaudeCliRuntime();
 *
 * if (await runtime.isAvailable()) {
 *   const result = await runtime.run({
 *     prompt: "Implement the feature",
 *     systemPrompt: "You are a helpful assistant",
 *     mode: "print",
 *     cwd: "/path/to/project",
 *   });
 * }
 * ```
 */
export class ClaudeCliRuntime implements AgentRuntime {
	readonly backend = "claude-cli" as const;

	/**
	 * Check if Claude CLI is available
	 *
	 * Checks for CLAUDE_PATH environment variable first, then falls back
	 * to searching for claude in the system PATH.
	 *
	 * @returns Promise resolving to true if claude is available
	 */
	async isAvailable(): Promise<boolean> {
		// Check for CLAUDE_PATH environment variable first
		if (process.env.CLAUDE_PATH) {
			debugSpawn("Claude CLI found via CLAUDE_PATH", {
				path: process.env.CLAUDE_PATH,
			});
			return true;
		}

		try {
			const cmd = process.platform === "win32" ? "where" : "which";
			const result = (await $`${cmd} claude`.quiet().text()).trim();
			const available = result.length > 0;
			debugSpawn("Claude CLI availability check", {
				available,
				path: available ? result : undefined,
			});
			return available;
		} catch {
			debugSpawn("Claude CLI not found in PATH");
			return false;
		}
	}

	/**
	 * Get the capabilities of Claude CLI runtime
	 *
	 * Claude CLI supports all features defined in RuntimeCapabilities.
	 *
	 * @returns Full capability set with all features enabled
	 */
	capabilities(): RuntimeCapabilities {
		return {
			supportsMcp: true,
			supportsTools: true,
			supportsModel: true,
			supportsMaxTurns: true,
			supportsInteractive: true,
			supportsStreaming: true,
			supportsSystemPrompt: true,
		};
	}

	/**
	 * Run an agent with the given options
	 *
	 * In print mode, captures stdout and returns it in the result.
	 * In interactive mode, inherits stdio for user interaction.
	 *
	 * @param options - Run configuration
	 * @returns Promise resolving to the run result
	 */
	async run(options: RunOptions): Promise<RunResult> {
		if (options.mode === "interactive") {
			return this.runInteractive(options);
		}

		// Print mode: capture output and detect marker
		return this.runStreaming(options, {});
	}

	/**
	 * Run an agent with streaming output callbacks
	 *
	 * Streams stdout in real-time and detects the completion marker.
	 * This is the core method used by orchestra for loop control.
	 *
	 * @param options - Run configuration (mode should be "print")
	 * @param callbacks - Streaming callbacks for output processing
	 * @returns Promise resolving to the run result
	 */
	async runStreaming(
		options: RunOptions,
		callbacks: StreamCallbacks
	): Promise<RunResult> {
		const args = this.buildArgs(options);
		const { cwd, env } = options;

		const command = process.env.CLAUDE_PATH ?? "claude";

		// Log the constructed command for debugging
		debugCommand(command, args, { cwd, env });

		// Create a clean temp directory to avoid file watcher errors on socket files
		const cleanTmpDir = mkdtempSync(join(tmpdir(), "claude-runtime-"));

		debugSpawn("Spawning Claude CLI process (print mode)", {
			cwd: cwd || process.cwd(),
			tmpDir: cleanTmpDir,
		});

		// For print mode, don't inherit stdin since it's non-interactive
		// This prevents hanging when no user input is available
		const proc = spawn([command, ...args], {
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			cwd: cwd || process.cwd(),
			env: {
				...process.env,
				CLAUDE_FORGE_DIR: getForgeRoot(),
				...env,
				TMPDIR: cleanTmpDir,
			},
		});

		// Set up signal handlers for graceful shutdown
		let signalReceived = false;
		const handleSignal = (signal: NodeJS.Signals) => {
			signalReceived = true;
			try {
				proc.kill(signal);
			} catch {
				// Process may have already exited
			}
		};

		const sigintHandler = () => handleSignal("SIGINT");
		const sigtermHandler = () => handleSignal("SIGTERM");

		process.on("SIGINT", sigintHandler);
		process.on("SIGTERM", sigtermHandler);

		const cleanup = () => {
			process.removeListener("SIGINT", sigintHandler);
			process.removeListener("SIGTERM", sigtermHandler);
			try {
				rmSync(cleanTmpDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		};

		try {
			const result = await this.streamAndDetect(proc, callbacks);
			cleanup();
			return result;
		} catch (error) {
			cleanup();
			return {
				exitCode: 1,
				completionMarkerFound: false,
				stderr: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Run an agent in interactive mode
	 *
	 * Inherits all stdio for full user interaction.
	 * Completion marker detection is not performed in this mode.
	 *
	 * @param options - Run configuration (mode is ignored, always interactive)
	 * @returns Promise resolving to the run result
	 */
	async runInteractive(options: Omit<RunOptions, "mode">): Promise<RunResult> {
		// Build args but don't include --print for interactive mode
		const args = this.buildArgsInteractive(options);
		const { cwd, env } = options;

		const command = process.env.CLAUDE_PATH ?? "claude";

		// Log the constructed command for debugging
		debugCommand(command, args, { cwd, env });

		// Create a clean temp directory to avoid file watcher errors
		const cleanTmpDir = mkdtempSync(join(tmpdir(), "claude-runtime-"));

		debugSpawn("Spawning Claude CLI process (interactive mode)", {
			cwd: cwd || process.cwd(),
			tmpDir: cleanTmpDir,
		});

		const proc = spawn([command, ...args], {
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
			cwd: cwd || process.cwd(),
			env: {
				...process.env,
				CLAUDE_FORGE_DIR: getForgeRoot(),
				...env,
				TMPDIR: cleanTmpDir,
			},
		});

		// Set up signal handlers for graceful shutdown
		const handleSignal = (signal: NodeJS.Signals) => {
			try {
				proc.kill(signal);
			} catch {
				// Process may have already exited
			}
		};

		const sigintHandler = () => handleSignal("SIGINT");
		const sigtermHandler = () => handleSignal("SIGTERM");

		process.on("SIGINT", sigintHandler);
		process.on("SIGTERM", sigtermHandler);

		const cleanup = () => {
			process.removeListener("SIGINT", sigintHandler);
			process.removeListener("SIGTERM", sigtermHandler);
			try {
				rmSync(cleanTmpDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		};

		await proc.exited;
		cleanup();

		return {
			exitCode: proc.exitCode ?? 0,
			completionMarkerFound: false, // Not checked in interactive mode
		};
	}

	/**
	 * Build CLI arguments from RunOptions for print mode
	 *
	 * Maps RunOptions fields to Claude CLI flags:
	 * - prompt -> positional arg
	 * - systemPrompt -> --append-system-prompt
	 * - model -> --model
	 * - maxTurns -> --max-turns
	 * - tools.allowed -> --allowedTools
	 * - tools.disallowed -> --disallowedTools
	 * - settings -> --settings
	 * - mcpConfig -> --mcp-config
	 * - skipPermissions -> --dangerously-skip-permissions
	 * - rawArgs -> appended directly
	 *
	 * @param options - Run configuration
	 * @returns Array of CLI arguments
	 */
	private buildArgs(options: RunOptions): string[] {
		const args: string[] = ["--print"];

		// Add --dangerously-skip-permissions if requested
		if (options.skipPermissions) {
			args.push("--dangerously-skip-permissions");
		}

		// Add system prompt
		if (options.systemPrompt) {
			args.push("--append-system-prompt", options.systemPrompt);
		}

		// Add model
		if (options.model) {
			args.push("--model", options.model);
		}

		// Add max turns
		if (options.maxTurns !== undefined) {
			args.push("--max-turns", String(options.maxTurns));
		}

		// Add allowed tools
		if (options.tools?.allowed && options.tools.allowed.length > 0) {
			args.push("--allowedTools", options.tools.allowed.join(","));
		}

		// Add disallowed tools
		if (options.tools?.disallowed && options.tools.disallowed.length > 0) {
			args.push("--disallowedTools", options.tools.disallowed.join(","));
		}

		// Add settings file
		if (options.settings) {
			args.push("--settings", options.settings);
		}

		// Add MCP config
		if (options.mcpConfig) {
			args.push("--mcp-config", options.mcpConfig);
		}

		// Append any raw arguments
		if (options.rawArgs && options.rawArgs.length > 0) {
			args.push(...options.rawArgs);
		}

		if (options.prompt !== undefined && options.prompt !== "") {
			// Use -- to separate options from positional arguments
			// This prevents flags like --mcp-config (which accepts variadic args)
			// from consuming the prompt as one of their values
			args.push("--");

			// Add prompt as final positional argument
			args.push(options.prompt);
		}

		return args;
	}

	/**
	 * Build CLI arguments for interactive mode (without --print)
	 *
	 * @param options - Run configuration
	 * @returns Array of CLI arguments
	 */
	private buildArgsInteractive(options: Omit<RunOptions, "mode">): string[] {
		const args: string[] = [];

		// Add --dangerously-skip-permissions if requested
		if (options.skipPermissions) {
			args.push("--dangerously-skip-permissions");
		}

		// Add system prompt
		if (options.systemPrompt) {
			args.push("--append-system-prompt", options.systemPrompt);
		}

		// Add model
		if (options.model) {
			args.push("--model", options.model);
		}

		// Add max turns
		if (options.maxTurns !== undefined) {
			args.push("--max-turns", String(options.maxTurns));
		}

		// Add allowed tools
		if (options.tools?.allowed && options.tools.allowed.length > 0) {
			args.push("--allowedTools", options.tools.allowed.join(","));
		}

		// Add disallowed tools
		if (options.tools?.disallowed && options.tools.disallowed.length > 0) {
			args.push("--disallowedTools", options.tools.disallowed.join(","));
		}

		// Add settings file
		if (options.settings) {
			args.push("--settings", options.settings);
		}

		// Add MCP config
		if (options.mcpConfig) {
			args.push("--mcp-config", options.mcpConfig);
		}

		// Append any raw arguments
		if (options.rawArgs && options.rawArgs.length > 0) {
			args.push(...options.rawArgs);
		}

		if (options.prompt !== undefined && options.prompt !== "") {
			// Use -- to separate options from positional arguments
			// This prevents flags like --mcp-config (which accepts variadic args)
			// from consuming the prompt as one of their values
			args.push("--");

			// Add prompt as final positional argument
			args.push(options.prompt);
		}

		return args;
	}

	/**
	 * Stream stdout from a process and detect the completion marker
	 *
	 * This is the core streaming logic that enables orchestra loop control.
	 * It watches for the ORCHESTRA_COMPLETE marker in the output stream.
	 *
	 * @param proc - The spawned subprocess with piped stdout/stderr
	 * @param callbacks - Streaming callbacks for output processing
	 * @returns Promise resolving to the run result
	 */
	private async streamAndDetect(
		proc: Subprocess,
		callbacks: StreamCallbacks
	): Promise<RunResult> {
		let completionMarkerFound = false;
		let buffer = "";
		let stdout = "";
		let stderr = "";

		// Read stdout stream
		const readStdout = async () => {
			if (!proc.stdout || typeof proc.stdout === "number") return;

			const reader = proc.stdout.getReader();
			const decoder = new TextDecoder();

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const text = decoder.decode(value, { stream: true });
					stdout += text;
					buffer += text;

					// Call stdout callback if provided
					if (callbacks.onStdout) {
						callbacks.onStdout(text);
					}

					// Check for completion marker in accumulated buffer
					if (!completionMarkerFound && buffer.includes(COMPLETION_MARKER)) {
						completionMarkerFound = true;
						if (callbacks.onMarkerDetected) {
							callbacks.onMarkerDetected();
						}
					}

					// Keep buffer from growing unbounded (keep last 1000 chars)
					if (buffer.length > 2000) {
						buffer = buffer.slice(-1000);
					}
				}
			} catch {
				// Stream may have been closed
			}
		};

		// Read stderr stream
		const readStderr = async () => {
			if (!proc.stderr || typeof proc.stderr === "number") return;

			const reader = proc.stderr.getReader();
			const decoder = new TextDecoder();

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const text = decoder.decode(value, { stream: true });
					stderr += text;

					// Call stderr callback if provided
					if (callbacks.onStderr) {
						callbacks.onStderr(text);
					}
				}
			} catch {
				// Stream may have been closed
			}
		};

		// Read both streams concurrently to avoid deadlocks
		await Promise.all([readStdout(), readStderr(), proc.exited]);

		return {
			exitCode: proc.exitCode ?? 0,
			stdout,
			stderr,
			completionMarkerFound,
		};
	}
}

/**
 * Create a new Claude CLI runtime instance
 *
 * This is the factory function used by the runtime registry.
 *
 * @returns A new ClaudeCliRuntime instance
 */
export function createClaudeCliRuntime(): AgentRuntime {
	return new ClaudeCliRuntime();
}
