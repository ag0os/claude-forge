/**
 * Codex CLI runtime backend
 *
 * Implements the AgentRuntime interface for Codex CLI.
 * This backend maps print mode to `codex exec "<prompt>"` and interactive
 * mode to `codex` with inherited stdio.
 *
 * Key differences from Claude CLI:
 * - No native system prompt support: system prompt is prepended to user prompt
 * - No --mcp-config support: MCP must be preconfigured externally
 * - No --max-turns equivalent: limited max turns support
 * - No tool allow/deny lists: limited tool configuration
 *
 * @module lib/runtime/codex-cli
 */

import { spawn, type Subprocess } from "bun";
import { $ } from "bun";

import { COMPLETION_MARKER } from "../orchestra/constants";
import type {
	AgentRuntime,
	RunOptions,
	RunResult,
	RuntimeCapabilities,
	StreamCallbacks,
} from "./types";

/**
 * Codex CLI runtime backend
 *
 * Provides agent execution via the Codex CLI (codex command).
 * Supports limited features compared to Claude CLI due to Codex CLI constraints.
 *
 * @example
 * ```ts
 * const runtime = new CodexCliRuntime();
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
export class CodexCliRuntime implements AgentRuntime {
	readonly backend = "codex-cli" as const;

	/**
	 * Check if Codex CLI is available
	 *
	 * Checks for CODEX_PATH environment variable first, then falls back
	 * to searching for codex in the system PATH.
	 *
	 * @returns Promise resolving to true if codex is available
	 */
	async isAvailable(): Promise<boolean> {
		// Check for CODEX_PATH environment variable first
		if (process.env.CODEX_PATH) {
			return true;
		}

		try {
			const cmd = process.platform === "win32" ? "where" : "which";
			const result = (await $`${cmd} codex`.quiet().text()).trim();
			return result.length > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Get the capabilities of Codex CLI runtime
	 *
	 * Codex CLI has limited capabilities compared to Claude CLI:
	 * - No MCP config support (requires preconfigured MCP)
	 * - Limited tool configuration
	 * - No native max turns support
	 * - System prompt support via prepending (limited)
	 *
	 * @returns Capability set with limited features
	 */
	capabilities(): RuntimeCapabilities {
		return {
			supportsMcp: false, // MCP must be preconfigured, no --mcp-config flag
			supportsTools: false, // No tool allow/deny lists
			supportsModel: true, // Codex supports model selection
			supportsMaxTurns: false, // No --max-turns equivalent
			supportsInteractive: true, // Supports interactive mode
			supportsStreaming: true, // Supports stdout streaming
			supportsSystemPrompt: false, // No native support, but we prepend to prompt
		};
	}

	/**
	 * Run an agent with the given options
	 *
	 * In print mode, uses `codex exec "<prompt>"` and captures output.
	 * In interactive mode, spawns `codex` with inherited stdio.
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
	 * Uses `codex exec "<prompt>"` for non-interactive execution.
	 *
	 * @param options - Run configuration (mode should be "print")
	 * @param callbacks - Streaming callbacks for output processing
	 * @returns Promise resolving to the run result
	 */
	async runStreaming(
		options: RunOptions,
		callbacks: StreamCallbacks
	): Promise<RunResult> {
		// Warn about unsupported options
		this.warnUnsupportedOptions(options);

		const fullPrompt = this.buildPrompt(options);
		const args = this.buildExecArgs(options, fullPrompt);
		const { cwd, env } = options;

		const proc = spawn(["codex", ...args], {
			stdin: "inherit",
			stdout: "pipe",
			stderr: "pipe",
			cwd: cwd || process.cwd(),
			env: {
				...process.env,
				...env,
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
	 * Spawns `codex` with inherited stdio for full user interaction.
	 * Completion marker detection is not performed in this mode.
	 *
	 * @param options - Run configuration (mode is ignored, always interactive)
	 * @returns Promise resolving to the run result
	 */
	async runInteractive(options: Omit<RunOptions, "mode">): Promise<RunResult> {
		// Warn about unsupported options
		this.warnUnsupportedOptions(options as RunOptions);

		const fullPrompt = this.buildPrompt(options as RunOptions);
		const args = this.buildInteractiveArgs(options, fullPrompt);
		const { cwd, env } = options;

		const proc = spawn(["codex", ...args], {
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
			cwd: cwd || process.cwd(),
			env: {
				...process.env,
				...env,
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
		};

		await proc.exited;
		cleanup();

		return {
			exitCode: proc.exitCode ?? 0,
			completionMarkerFound: false, // Not checked in interactive mode
		};
	}

	/**
	 * Build the full prompt by prepending system prompt if provided
	 *
	 * Codex CLI does not have native system prompt support, so we prepend
	 * the system prompt to the user prompt with a separator.
	 *
	 * @param options - Run configuration
	 * @returns The combined prompt string
	 */
	private buildPrompt(options: RunOptions | Omit<RunOptions, "mode">): string {
		const runOptions = options as RunOptions;
		if (runOptions.systemPrompt) {
			return `${runOptions.systemPrompt}\n\n---\n\n${runOptions.prompt}`;
		}
		return runOptions.prompt;
	}

	/**
	 * Build CLI arguments for `codex exec` mode
	 *
	 * The exec command runs a prompt non-interactively.
	 *
	 * @param options - Run configuration
	 * @param prompt - The full prompt (with system prompt prepended if applicable)
	 * @returns Array of CLI arguments
	 */
	private buildExecArgs(
		options: RunOptions,
		prompt: string
	): string[] {
		const args: string[] = ["exec"];

		// Add model if specified
		if (options.model) {
			args.push("--model", options.model);
		}

		// Append any raw arguments
		if (options.rawArgs && options.rawArgs.length > 0) {
			args.push(...options.rawArgs);
		}

		// Add prompt as the final argument
		args.push(prompt);

		return args;
	}

	/**
	 * Build CLI arguments for interactive mode
	 *
	 * @param options - Run configuration
	 * @param prompt - The full prompt (with system prompt prepended if applicable)
	 * @returns Array of CLI arguments
	 */
	private buildInteractiveArgs(
		options: Omit<RunOptions, "mode">,
		prompt: string
	): string[] {
		const args: string[] = [];

		// Add model if specified
		if (options.model) {
			args.push("--model", options.model);
		}

		// Append any raw arguments
		if (options.rawArgs && options.rawArgs.length > 0) {
			args.push(...options.rawArgs);
		}

		// Add prompt as the final argument (initial prompt for interactive session)
		args.push(prompt);

		return args;
	}

	/**
	 * Warn about options that are not supported by Codex CLI
	 *
	 * Logs warnings to stderr for options that will be ignored.
	 *
	 * @param options - Run configuration to check
	 */
	private warnUnsupportedOptions(options: RunOptions): void {
		if (options.mcpConfig) {
			console.warn(
				"[codex-cli] Warning: --mcp-config is not supported by Codex CLI. " +
					"MCP servers must be preconfigured externally."
			);
		}

		if (options.tools?.allowed || options.tools?.disallowed) {
			console.warn(
				"[codex-cli] Warning: Tool allow/deny lists are not supported by Codex CLI."
			);
		}

		if (options.maxTurns !== undefined) {
			console.warn(
				"[codex-cli] Warning: --max-turns is not supported by Codex CLI."
			);
		}

		if (options.settings) {
			console.warn(
				"[codex-cli] Warning: --settings is not supported by Codex CLI."
			);
		}

		if (options.skipPermissions) {
			console.warn(
				"[codex-cli] Warning: --dangerously-skip-permissions is not supported by Codex CLI."
			);
		}
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

		// Stream stdout and detect marker
		if (proc.stdout && typeof proc.stdout !== "number") {
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
		}

		// Stream stderr
		if (proc.stderr && typeof proc.stderr !== "number") {
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
		}

		await proc.exited;

		return {
			exitCode: proc.exitCode ?? 0,
			stdout,
			stderr,
			completionMarkerFound,
		};
	}
}

/**
 * Create a new Codex CLI runtime instance
 *
 * This is the factory function used by the runtime registry.
 *
 * @returns A new CodexCliRuntime instance
 */
export function createCodexCliRuntime(): AgentRuntime {
	return new CodexCliRuntime();
}
