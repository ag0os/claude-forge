/**
 * Codex CLI runtime backend
 *
 * Implements the AgentRuntime interface for Codex CLI.
 * This backend maps print mode to `codex exec "<prompt>"` and interactive
 * mode to `codex` with inherited stdio.
 *
 * Uses `--config` flags for native system prompt and MCP support:
 * - System prompts via `--config 'base_instructions=...'`
 * - MCP servers via `--config 'mcp_servers.<name>={...}'`
 *
 * Key differences from Claude CLI:
 * - No --max-turns equivalent: limited max turns support
 * - No tool allow/deny lists: only coarse --disable/--enable for built-in tools
 *
 * @module lib/runtime/codex-cli
 */

import { readFileSync } from "node:fs";
import { spawn, type Subprocess } from "bun";
import { $ } from "bun";

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
 * Escape a string for use in a TOML inline value
 *
 * Escapes backslashes and double quotes to prevent TOML parsing issues.
 */
function escapeTomlString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Codex CLI runtime backend
 *
 * Provides agent execution via the Codex CLI (codex command).
 * Supports system prompts and MCP via `--config` flags.
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
			debugSpawn("Codex CLI found via CODEX_PATH", {
				path: process.env.CODEX_PATH,
			});
			return true;
		}

		try {
			const cmd = process.platform === "win32" ? "where" : "which";
			const result = (await $`${cmd} codex`.quiet().text()).trim();
			const available = result.length > 0;
			debugSpawn("Codex CLI availability check", {
				available,
				path: available ? result : undefined,
			});
			return available;
		} catch {
			debugSpawn("Codex CLI not found in PATH");
			return false;
		}
	}

	/**
	 * Get the capabilities of Codex CLI runtime
	 *
	 * Codex CLI supports system prompts and MCP via `--config` flags.
	 * Remaining limitations:
	 * - No fine-grained tool allow/deny lists (only --disable/--enable for built-in tools)
	 * - No native max turns support
	 *
	 * @returns Capability set for Codex CLI
	 */
	capabilities(): RuntimeCapabilities {
		return {
			supportsMcp: true, // Via --config 'mcp_servers.<name>={...}'
			supportsTools: false, // No fine-grained allow/deny lists
			supportsModel: true, // Via --model flag
			supportsMaxTurns: false, // No --max-turns equivalent
			supportsInteractive: true, // Supports interactive mode
			supportsStreaming: true, // Supports stdout streaming
			supportsSystemPrompt: true, // Via --config 'base_instructions=...'
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

		const command = process.env.CODEX_PATH ?? "codex";

		// Log the constructed command for debugging
		debugCommand(command, args, { cwd, env });

		debugSpawn("Spawning Codex CLI process (exec mode)", {
			cwd: cwd || process.cwd(),
		});

		const proc = spawn([command, ...args], {
			stdin: "ignore",
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

		const command = process.env.CODEX_PATH ?? "codex";

		// Log the constructed command for debugging
		debugCommand(command, args, { cwd, env });

		debugSpawn("Spawning Codex CLI process (interactive mode)", {
			cwd: cwd || process.cwd(),
		});

		const proc = spawn([command, ...args], {
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
	 * Extract the user prompt from run options
	 *
	 * System prompts are now handled natively via `--config 'base_instructions=...'`
	 * in the arg builders, so this method only returns the user prompt.
	 *
	 * @param options - Run configuration
	 * @returns The user prompt string
	 */
	private buildPrompt(options: RunOptions | Omit<RunOptions, "mode">): string {
		return (options as RunOptions).prompt ?? "";
	}

	/**
	 * Build CLI arguments for `codex exec` mode
	 *
	 * The exec command runs a prompt non-interactively.
	 * System prompts and MCP config are passed via `--config` flags.
	 * Exec mode defaults to `approval_policy=never`, so skipPermissions is a no-op.
	 *
	 * @param options - Run configuration
	 * @param prompt - The user prompt
	 * @returns Array of CLI arguments
	 */
	private buildExecArgs(options: RunOptions, prompt: string): string[] {
		const args: string[] = ["exec"];

		// Add system prompt via native --config flag
		if (options.systemPrompt) {
			args.push(...this.buildSystemPromptArgs(options.systemPrompt));
		}

		// Add MCP servers via --config flags
		if (options.mcpConfig) {
			args.push(...this.buildMcpArgs(options.mcpConfig));
		}

		// Add model if specified
		if (options.model) {
			args.push("--model", options.model);
		}

		// Append any raw arguments
		if (options.rawArgs && options.rawArgs.length > 0) {
			args.push(...options.rawArgs);
		}

		// codex exec requires a positional prompt; without one it reads from stdin,
		// but we start with stdin: "ignore" so the process would exit immediately.
		// When only a system prompt is provided, pass a minimal prompt so codex runs.
		if (prompt.length > 0) {
			args.push("--", prompt);
		} else if (options.systemPrompt) {
			args.push("--", "Follow the instructions in your system prompt.");
		}

		return args;
	}

	/**
	 * Build CLI arguments for interactive mode
	 *
	 * System prompts and MCP config are passed via `--config` flags.
	 * Skip permissions maps to `--full-auto` in interactive mode.
	 *
	 * @param options - Run configuration
	 * @param prompt - The user prompt
	 * @returns Array of CLI arguments
	 */
	private buildInteractiveArgs(
		options: Omit<RunOptions, "mode">,
		prompt: string
	): string[] {
		const runOptions = options as RunOptions;
		const args: string[] = [];

		// Add system prompt via native --config flag
		if (runOptions.systemPrompt) {
			args.push(...this.buildSystemPromptArgs(runOptions.systemPrompt));
		}

		// Add MCP servers via --config flags
		if (runOptions.mcpConfig) {
			args.push(...this.buildMcpArgs(runOptions.mcpConfig));
		}

		// Skip permissions bypasses all approvals and sandboxing, matching
		// Claude's --dangerously-skip-permissions behavior
		if (runOptions.skipPermissions) {
			args.push("--dangerously-bypass-approvals-and-sandbox");
		}

		// Add model if specified
		if (options.model) {
			args.push("--model", options.model);
		}

		// Append any raw arguments
		if (options.rawArgs && options.rawArgs.length > 0) {
			args.push(...options.rawArgs);
		}

		if (prompt.length > 0) {
			// Add prompt as the final argument (initial prompt for interactive session)
			args.push(prompt);
		}

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
		if (options.tools?.allowed || options.tools?.disallowed) {
			console.warn(
				"[codex-cli] Warning: Tool allow/deny lists are not supported by Codex CLI. " +
					"Use --disable/--enable for built-in tool categories via rawArgs."
			);
		}

		if (options.maxTurns !== undefined) {
			console.warn(
				"[codex-cli] Warning: --max-turns is not supported by Codex CLI."
			);
		}

		if (options.settings) {
			console.warn(
				"[codex-cli] Warning: --settings is not directly supported by Codex CLI. " +
					"Use --profile or --config as alternatives via rawArgs."
			);
		}
	}

	/**
	 * Build `--config 'base_instructions=...'` args for native system prompt support
	 *
	 * @param systemPrompt - The system prompt text
	 * @returns Array of CLI arguments
	 */
	private buildSystemPromptArgs(systemPrompt: string): string[] {
		return ["--config", `base_instructions=${systemPrompt}`];
	}

	/**
	 * Build `--config 'mcp_servers.<name>={...}'` args from MCP config
	 *
	 * Accepts either inline JSON (e.g. from JSON.stringify()) or a file path.
	 * Translates the Claude-style MCP config format (JSON with mcpServers)
	 * into Codex `--config` flags using TOML inline table syntax.
	 *
	 * @param mcpConfig - Inline JSON string or path to an MCP config JSON file
	 * @returns Array of CLI arguments
	 */
	private buildMcpArgs(mcpConfig: string): string[] {
		let config: Record<string, unknown>;

		// Try parsing as inline JSON first (callers like agents/tasks/worker.ts
		// pass JSON.stringify(mcpJson) directly)
		try {
			config = JSON.parse(mcpConfig);
		} catch {
			// Not valid JSON, treat as a file path
			let raw: string;
			try {
				raw = readFileSync(mcpConfig, "utf-8");
			} catch (error) {
				console.warn(
					`[codex-cli] Warning: Could not read MCP config at ${mcpConfig}: ${error instanceof Error ? error.message : String(error)}`
				);
				return [];
			}

			try {
				config = JSON.parse(raw);
			} catch (error) {
				console.warn(
					`[codex-cli] Warning: Invalid JSON in MCP config at ${mcpConfig}: ${error instanceof Error ? error.message : String(error)}`
				);
				return [];
			}
		}

		const servers = (config.mcpServers ?? {}) as Record<
			string,
			{ command: string; args?: string[]; env?: Record<string, string> }
		>;
		const args: string[] = [];

		for (const [name, server] of Object.entries(servers)) {
			const tomlParts: string[] = [];
			tomlParts.push(`command = "${escapeTomlString(server.command)}"`);
			if (server.args && server.args.length > 0) {
				const argsStr = server.args.map((a) => `"${escapeTomlString(a)}"`).join(", ");
				tomlParts.push(`args = [${argsStr}]`);
			}
			if (server.env) {
				const envParts = Object.entries(server.env).map(
					([k, v]) => `${k} = "${escapeTomlString(v)}"`
				);
				tomlParts.push(`env = {${envParts.join(", ")}}`);
			}
			args.push("--config", `mcp_servers.${name}={${tomlParts.join(", ")}}`);
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
 * Create a new Codex CLI runtime instance
 *
 * This is the factory function used by the runtime registry.
 *
 * @returns A new CodexCliRuntime instance
 */
export function createCodexCliRuntime(): AgentRuntime {
	return new CodexCliRuntime();
}
