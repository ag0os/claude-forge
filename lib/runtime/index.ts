/**
 * Runtime abstraction registry and resolver
 *
 * This module provides the central registry for runtime backends and unified
 * entry points for agent execution. It decouples agents and orchestra from
 * specific backend implementations.
 *
 * @module lib/runtime
 *
 * @example
 * ```ts
 * import { getRuntime, resolveBackend, runAgentOnce } from "./lib/runtime";
 *
 * // Get the configured backend
 * const backend = resolveBackend();
 *
 * // Get a runtime instance
 * const runtime = getRuntime(backend);
 *
 * // Or use the convenience wrappers
 * const result = await runAgentOnce({
 *   prompt: "Implement the feature",
 *   systemPrompt: "You are a coding assistant...",
 * });
 * ```
 */

// Re-export all types for convenience
export type {
	RuntimeBackend,
	RuntimeCapabilities,
	ToolConfig,
	RunOptions,
	RunResult,
	StreamCallbacks,
	AgentRuntime,
	RuntimeConfig,
	RuntimeFactory,
	RuntimeRegistry,
} from "./types";

import type {
	AgentRuntime,
	RuntimeBackend,
	RuntimeCapabilities,
	RuntimeFactory,
	RunOptions,
	RunResult,
	StreamCallbacks,
} from "./types";

// Re-export error classes and utilities from debug module
export {
	RuntimeError,
	BackendNotFoundError,
	UnsupportedOptionError,
	formatCommand,
	debugCommand,
	isDebugEnabled,
	debugLog,
} from "./debug";

// Import debug functions for internal use
import { debugLog } from "./debug";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default backend to use when none is specified
 */
export const DEFAULT_BACKEND: RuntimeBackend = "claude-cli";

/**
 * Environment variable for backend override
 */
export const BACKEND_ENV_VAR = "FORGE_BACKEND";

/**
 * Completion marker that agents output to signal they are done
 */
export const COMPLETION_MARKER = "ORCHESTRA_COMPLETE";

// ============================================================================
// Install Instructions
// ============================================================================

/**
 * Installation instructions for each backend
 *
 * These are shown when a backend is not available, providing users
 * with clear steps to install the missing dependency.
 */
export const INSTALL_INSTRUCTIONS: Record<RuntimeBackend, string> = {
	"claude-cli":
		"Install Claude Code CLI with: npm install -g @anthropic-ai/claude-code\n" +
		"Then authenticate with: claude login",
	"codex-cli":
		"Install Codex CLI with: npm install -g @openai/codex\n" +
		"Then authenticate with: codex auth",
	"codex-sdk":
		"Note: codex-sdk backend is not implemented in claude-forge yet.\n" +
		"Use codex-cli for now. If you are implementing the SDK backend:\n" +
		"Install Codex SDK with: npm install @openai/codex\n" +
		"Then set your OPENAI_API_KEY environment variable",
};

/**
 * Get installation instructions for a backend
 *
 * @param backend - The backend to get instructions for
 * @returns Installation instructions string
 */
export function getInstallInstructions(backend: RuntimeBackend): string {
	return INSTALL_INSTRUCTIONS[backend];
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Internal registry mapping backend names to factory functions
 *
 * Backends register themselves by calling registerRuntime().
 */
const registry = new Map<RuntimeBackend, RuntimeFactory>();

/**
 * Register a runtime backend factory
 *
 * This allows runtime implementations to register themselves without
 * creating import dependencies in this module.
 *
 * @param backend - The backend identifier
 * @param factory - Factory function that creates the runtime instance
 *
 * @example
 * ```ts
 * // In lib/runtime/backends/claude-cli.ts
 * registerRuntime("claude-cli", () => new ClaudeCliRuntime());
 * ```
 */
export function registerRuntime(
	backend: RuntimeBackend,
	factory: RuntimeFactory,
): void {
	registry.set(backend, factory);
}

/**
 * Check if a runtime backend is registered
 *
 * @param backend - The backend identifier to check
 * @returns true if the backend has a registered factory
 */
export function hasRuntime(backend: RuntimeBackend): boolean {
	return registry.has(backend);
}

/**
 * Get the list of registered backend names
 *
 * @returns Array of registered backend identifiers
 */
export function getRegisteredBackends(): RuntimeBackend[] {
	return Array.from(registry.keys());
}

// ============================================================================
// Runtime Resolution
// ============================================================================

/**
 * Parse runtime backend from CLI arguments
 *
 * Looks for --backend <name> in the argument list.
 *
 * @param args - Command line arguments (defaults to process.argv)
 * @returns The backend name if found, undefined otherwise
 */
export function parseBackendFromArgs(
	args: string[] = process.argv,
): RuntimeBackend | undefined {
	const backendIndex = args.indexOf("--backend");
	if (backendIndex !== -1 && backendIndex < args.length - 1) {
		const value = args[backendIndex + 1];
		// Validate that the value is a known backend
		if (value !== undefined && isValidBackend(value)) {
			return value;
		}
	}
	return undefined;
}

/**
 * Check if a string is a valid backend identifier
 *
 * @param value - The string to check
 * @returns true if the value is a valid RuntimeBackend
 */
export function isValidBackend(value: string): value is RuntimeBackend {
	return value === "claude-cli" || value === "codex-cli" || value === "codex-sdk";
}

/**
 * Resolve the runtime backend to use
 *
 * Resolution priority (highest to lowest):
 * 1. Explicit override parameter
 * 2. --backend CLI flag
 * 3. FORGE_BACKEND environment variable
 * 4. Default backend (claude-cli)
 *
 * @param override - Optional explicit backend override
 * @returns The resolved backend identifier
 * @throws Error if the resolved backend is not valid
 */
export function resolveBackend(override?: RuntimeBackend): RuntimeBackend {
	let resolved: RuntimeBackend;
	let source: string;

	// 1. Explicit override takes precedence
	if (override) {
		resolved = override;
		source = "explicit override";
	} else {
		// 2. Check CLI arguments for --backend flag
		const fromArgs = parseBackendFromArgs();
		if (fromArgs) {
			resolved = fromArgs;
			source = "--backend CLI flag";
		} else {
			// 3. Check environment variable
			const envValue = process.env[BACKEND_ENV_VAR];
			if (envValue) {
				if (isValidBackend(envValue)) {
					resolved = envValue;
					source = `${BACKEND_ENV_VAR} environment variable`;
				} else {
					console.warn(
						`[runtime] Invalid ${BACKEND_ENV_VAR} value: "${envValue}", using default.\n` +
							`  Valid backends: claude-cli, codex-cli, codex-sdk`,
					);
					resolved = DEFAULT_BACKEND;
					source = "default (invalid env value)";
				}
			} else {
				// 4. Fall back to default
				resolved = DEFAULT_BACKEND;
				source = "default";
			}
		}
	}

	debugLog("runtime", `Resolved backend: ${resolved} (source: ${source})`);
	return resolved;
}

/**
 * Get a runtime instance for the specified backend
 *
 * @param backend - The backend to get (defaults to resolved backend)
 * @returns The runtime instance
 * @throws Error if the backend is not registered
 *
 * @example
 * ```ts
 * const runtime = getRuntime("claude-cli");
 * const result = await runtime.run({
 *   prompt: "Hello",
 *   mode: "print",
 * });
 * ```
 */
export function getRuntime(backend?: RuntimeBackend): AgentRuntime {
	const resolvedBackend = backend ?? resolveBackend();
	const factory = registry.get(resolvedBackend);

	if (!factory) {
		const registered = getRegisteredBackends();
		if (registered.length === 0) {
			throw new Error(
				`Runtime backend "${resolvedBackend}" is not registered. ` +
					`No backends are currently registered. ` +
					`Ensure the backend module is imported before calling getRuntime().`,
			);
		}
		throw new Error(
			`Runtime backend "${resolvedBackend}" is not registered. ` +
				`Available backends: ${registered.join(", ")}`,
		);
	}

	return factory();
}

// ============================================================================
// Availability and Capability Checks
// ============================================================================

/**
 * Error thrown when a backend is not available
 */
export class BackendNotAvailableError extends Error {
	constructor(
		public readonly backend: RuntimeBackend,
		public readonly installInstructions: string,
	) {
		super(
			`Backend "${backend}" is not available.\n\n` +
				`${installInstructions}\n\n` +
				`If the CLI is installed but not found, ensure it is in your PATH ` +
				`or set the appropriate environment variable:\n` +
				`  - claude-cli: CLAUDE_PATH=/path/to/claude\n` +
				`  - codex-cli: CODEX_PATH=/path/to/codex`,
		);
		this.name = "BackendNotAvailableError";
	}
}

/**
 * Ensure that a backend is available before use
 *
 * This function checks if the specified backend is installed and ready to use.
 * If not available, it throws a BackendNotAvailableError with actionable
 * installation instructions.
 *
 * @param backend - The backend to check (defaults to resolved backend)
 * @throws BackendNotAvailableError if the backend is not available
 *
 * @example
 * ```ts
 * try {
 *   await ensureBackendAvailable("codex-cli");
 *   // Proceed with using codex-cli
 * } catch (e) {
 *   if (e instanceof BackendNotAvailableError) {
 *     console.error(e.message);
 *     // Show installation instructions
 *   }
 * }
 * ```
 */
export async function ensureBackendAvailable(
	backend?: RuntimeBackend,
): Promise<void> {
	const resolvedBackend = backend ?? resolveBackend();
	debugLog("runtime", `Checking availability for backend: ${resolvedBackend}`);

	const runtime = getRuntime(resolvedBackend);
	const available = await runtime.isAvailable();

	debugLog("runtime", `Backend ${resolvedBackend} available: ${available}`);

	if (!available) {
		throw new BackendNotAvailableError(
			resolvedBackend,
			getInstallInstructions(resolvedBackend),
		);
	}
}

/**
 * Check capabilities and warn about unsupported options
 *
 * This function examines the RunOptions and compares them against the
 * backend's capabilities. It logs warnings for any options that will be
 * ignored or have limited support.
 *
 * @param runtime - The runtime to check capabilities for
 * @param options - The run options to check
 *
 * @example
 * ```ts
 * const runtime = getRuntime("codex-cli");
 * checkCapabilities(runtime, {
 *   prompt: "Hello",
 *   mcpConfig: "./mcp.json", // Will warn: Codex doesn't support MCP
 *   mode: "print",
 * });
 * ```
 */
export function checkCapabilities(
	runtime: AgentRuntime,
	options: RunOptions,
): void {
	const caps = runtime.capabilities();
	const backend = runtime.backend;

	debugLog("runtime", `Checking capabilities for backend: ${backend}`, caps);

	// Check MCP config support
	if (options.mcpConfig && !caps.supportsMcp) {
		console.warn(
			`[runtime] Warning: Backend "${backend}" does not support MCP configuration.\n` +
				`  The mcpConfig option will be ignored.\n` +
				`  MCP servers must be preconfigured externally for this backend.`,
		);
	}

	// Check tool allow/deny support
	if (
		(options.tools?.allowed?.length || options.tools?.disallowed?.length) &&
		!caps.supportsTools
	) {
		console.warn(
			`[runtime] Warning: Backend "${backend}" does not support tool allow/deny lists.\n` +
				`  The tools.allowed and tools.disallowed options will be ignored.`,
		);
	}

	// Check model support
	if (options.model && !caps.supportsModel) {
		console.warn(
			`[runtime] Warning: Backend "${backend}" does not support model selection.\n` +
				`  The model option will be ignored.`,
		);
	}

	// Check max turns support
	if (options.maxTurns !== undefined && !caps.supportsMaxTurns) {
		console.warn(
			`[runtime] Warning: Backend "${backend}" does not support max turns.\n` +
				`  The maxTurns option will be ignored.`,
		);
	}

	// Check system prompt support
	if (options.systemPrompt && !caps.supportsSystemPrompt) {
		console.warn(
			`[runtime] Warning: Backend "${backend}" has limited system prompt support.\n` +
				`  The system prompt will be prepended to the user prompt.`,
		);
	}

	// Check interactive mode support
	if (options.mode === "interactive" && !caps.supportsInteractive) {
		console.warn(
			`[runtime] Warning: Backend "${backend}" does not support interactive mode.\n` +
				`  Falling back to print mode with captured output.`,
		);
	}

	// Check streaming support (for streaming calls)
	// Note: This is informational; callers should check before using runStreaming
	if (!caps.supportsStreaming) {
		debugLog(
			"runtime",
			`Backend "${backend}" does not support streaming output.`,
		);
	}
}

/**
 * Get a summary of capability mismatches between options and runtime
 *
 * This is a programmatic version of checkCapabilities that returns
 * structured data instead of logging warnings.
 *
 * @param runtime - The runtime to check capabilities for
 * @param options - The run options to check
 * @returns Array of capability mismatch descriptions
 */
export function getCapabilityMismatches(
	runtime: AgentRuntime,
	options: RunOptions,
): string[] {
	const caps = runtime.capabilities();
	const mismatches: string[] = [];

	if (options.mcpConfig && !caps.supportsMcp) {
		mismatches.push("mcpConfig: MCP configuration not supported");
	}

	if (
		(options.tools?.allowed?.length || options.tools?.disallowed?.length) &&
		!caps.supportsTools
	) {
		mismatches.push("tools: Tool allow/deny lists not supported");
	}

	if (options.model && !caps.supportsModel) {
		mismatches.push("model: Model selection not supported");
	}

	if (options.maxTurns !== undefined && !caps.supportsMaxTurns) {
		mismatches.push("maxTurns: Max turns not supported");
	}

	if (options.systemPrompt && !caps.supportsSystemPrompt) {
		mismatches.push("systemPrompt: Limited system prompt support");
	}

	if (options.mode === "interactive" && !caps.supportsInteractive) {
		mismatches.push("mode: Interactive mode not supported");
	}

	return mismatches;
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Options for convenience wrapper functions
 *
 * These extend RunOptions but make mode optional since each wrapper
 * has a specific mode.
 */
export type WrapperOptions = Omit<RunOptions, "mode"> & {
	/** Optional backend override */
	backend?: RuntimeBackend;
};

/**
 * Run an agent once in print mode and return the result
 *
 * This is a convenience wrapper for simple, non-streaming agent execution.
 * The agent runs to completion and the full output is returned.
 *
 * This function performs availability checks and capability warnings before
 * executing the agent. If the backend is not available, it throws a
 * BackendNotAvailableError with installation instructions.
 *
 * @param options - Run options (mode is set to "print" automatically)
 * @returns Promise resolving to the run result with captured output
 * @throws BackendNotAvailableError if the backend is not installed
 *
 * @example
 * ```ts
 * const result = await runAgentOnce({
 *   prompt: "Implement the login feature",
 *   systemPrompt: "You are a helpful coding assistant...",
 *   cwd: "/path/to/project",
 * });
 *
 * if (result.exitCode === 0) {
 *   console.log("Agent output:", result.stdout);
 * }
 * ```
 */
export async function runAgentOnce(options: WrapperOptions): Promise<RunResult> {
	const { backend, ...runOptions } = options;

	debugLog("runtime", "runAgentOnce called", {
		backend: backend ?? resolveBackend(),
		prompt: runOptions.prompt?.slice(0, 100) + (runOptions.prompt && runOptions.prompt.length > 100 ? "..." : ""),
	});

	// Ensure backend is available (throws if not)
	await ensureBackendAvailable(backend);

	const runtime = getRuntime(backend);
	const fullOptions: RunOptions = {
		...runOptions,
		mode: "print",
	};

	// Check and warn about capability mismatches
	checkCapabilities(runtime, fullOptions);

	debugLog("runtime", `Executing agent with backend: ${runtime.backend}`);

	return runtime.run(fullOptions);
}

/**
 * Run an agent with streaming output and optional callbacks
 *
 * This wrapper enables real-time output processing and completion marker
 * detection, which is essential for orchestra loop control.
 *
 * This function performs availability checks and capability warnings before
 * executing the agent. If the backend is not available, it throws a
 * BackendNotAvailableError with installation instructions.
 *
 * @param options - Run options (mode is set to "print" automatically)
 * @param callbacks - Callbacks for stdout, stderr, and marker detection
 * @returns Promise resolving to the run result
 * @throws BackendNotAvailableError if the backend is not installed
 *
 * @example
 * ```ts
 * const result = await runAgentStreaming(
 *   {
 *     prompt: "Implement TASK-001",
 *     systemPrompt: "You are a coding assistant...",
 *   },
 *   {
 *     onStdout: (data) => process.stdout.write(data),
 *     onMarkerDetected: () => console.log("Agent signaled completion"),
 *   }
 * );
 * ```
 */
export async function runAgentStreaming(
	options: WrapperOptions,
	callbacks: StreamCallbacks = {},
): Promise<RunResult> {
	const { backend, ...runOptions } = options;

	debugLog("runtime", "runAgentStreaming called", {
		backend: backend ?? resolveBackend(),
		prompt: runOptions.prompt?.slice(0, 100) + (runOptions.prompt && runOptions.prompt.length > 100 ? "..." : ""),
	});

	// Ensure backend is available (throws if not)
	await ensureBackendAvailable(backend);

	const runtime = getRuntime(backend);
	const fullOptions: RunOptions = {
		...runOptions,
		mode: "print",
	};

	// Check streaming support
	const caps = runtime.capabilities();
	if (!caps.supportsStreaming) {
		console.warn(
			`[runtime] Warning: Backend "${runtime.backend}" does not support streaming.\n` +
				`  Output will be returned after the agent completes.`,
		);
	}

	// Check and warn about other capability mismatches
	checkCapabilities(runtime, fullOptions);

	debugLog("runtime", `Executing streaming agent with backend: ${runtime.backend}`);

	return runtime.runStreaming(fullOptions, callbacks);
}

/**
 * Run an agent in interactive mode with inherited stdio
 *
 * This wrapper spawns the agent with inherited stdio, allowing direct
 * user interaction through the terminal.
 *
 * This function performs availability checks and capability warnings before
 * executing the agent. If the backend is not available, it throws a
 * BackendNotAvailableError with installation instructions.
 *
 * @param options - Run options (mode is ignored, always interactive)
 * @returns Promise resolving to the run result (output is not captured)
 * @throws BackendNotAvailableError if the backend is not installed
 *
 * @example
 * ```ts
 * // Run interactively, user can type directly
 * const result = await runAgentInteractive({
 *   prompt: "Help me with my code",
 *   systemPrompt: "You are a helpful coding assistant...",
 * });
 *
 * process.exit(result.exitCode);
 * ```
 */
export async function runAgentInteractive(
	options: WrapperOptions,
): Promise<RunResult> {
	const { backend, ...runOptions } = options;

	debugLog("runtime", "runAgentInteractive called", {
		backend: backend ?? resolveBackend(),
		prompt: runOptions.prompt?.slice(0, 100) + (runOptions.prompt && runOptions.prompt.length > 100 ? "..." : ""),
	});

	// Ensure backend is available (throws if not)
	await ensureBackendAvailable(backend);

	const runtime = getRuntime(backend);

	// Check interactive support
	const caps = runtime.capabilities();
	if (!caps.supportsInteractive) {
		console.warn(
			`[runtime] Warning: Backend "${runtime.backend}" does not support interactive mode.\n` +
				`  The agent will run in print mode instead.`,
		);

		const printOptions: RunOptions = {
			...runOptions,
			mode: "print",
		};

		// Check and warn about capability mismatches for print mode
		checkCapabilities(runtime, printOptions);

		if (caps.supportsStreaming) {
			return runtime.runStreaming(printOptions, {
				onStdout: (data) => process.stdout.write(data),
				onStderr: (data) => process.stderr.write(data),
			});
		}

		const result = await runtime.run(printOptions);
		if (result.stdout) {
			process.stdout.write(result.stdout);
		}
		if (result.stderr) {
			process.stderr.write(result.stderr);
		}
		return result;
	}

	// Check and warn about capability mismatches (using interactive mode for check)
	const checkOptions: RunOptions = {
		...runOptions,
		mode: "interactive",
	};
	checkCapabilities(runtime, checkOptions);

	debugLog("runtime", `Executing interactive agent with backend: ${runtime.backend}`);

	return runtime.runInteractive(runOptions);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if the specified backend is available
 *
 * This checks whether the backend's dependencies (CLI tools, credentials, etc.)
 * are properly configured.
 *
 * NOTE: This function does NOT throw an error if the backend is unavailable.
 * Use ensureBackendAvailable() if you want to throw with actionable instructions.
 * This function is intended for checking availability without side effects,
 * such as when deciding which backend to use.
 *
 * @param backend - The backend to check (defaults to resolved backend)
 * @returns Promise resolving to true if the backend is ready to use
 *
 * @example
 * ```ts
 * if (await isBackendAvailable("codex-cli")) {
 *   const runtime = getRuntime("codex-cli");
 *   // ... use codex
 * } else {
 *   console.log("Codex CLI not available, falling back to Claude CLI");
 *   const runtime = getRuntime("claude-cli");
 * }
 * ```
 */
export async function isBackendAvailable(
	backend?: RuntimeBackend,
): Promise<boolean> {
	const resolvedBackend = backend ?? resolveBackend();
	debugLog("runtime", `Checking if backend is available: ${resolvedBackend}`);

	try {
		const runtime = getRuntime(resolvedBackend);
		const available = await runtime.isAvailable();
		debugLog(
			"runtime",
			`Backend ${resolvedBackend} availability: ${available}`,
		);
		return available;
	} catch (error) {
		// Backend not registered or factory failed
		debugLog("runtime", `Backend ${resolvedBackend} check failed`, error);
		return false;
	}
}

/**
 * Detect completion marker in text
 *
 * Checks if the completion marker (ORCHESTRA_COMPLETE) appears in the text.
 * Used by streaming implementations for marker detection.
 *
 * @param text - The text to search
 * @returns true if the completion marker is found
 */
export function detectCompletionMarker(text: string): boolean {
	return text.includes(COMPLETION_MARKER);
}

// ============================================================================
// Backend Exports
// ============================================================================

// Export Claude CLI runtime for direct use
export { ClaudeCliRuntime, createClaudeCliRuntime } from "./claude-cli";

// Export Codex CLI runtime for direct use
export { CodexCliRuntime, createCodexCliRuntime } from "./codex-cli";

// Export Codex SDK runtime for direct use
export { CodexSdkRuntime, createCodexSdkRuntime } from "./codex-sdk";

// ============================================================================
// Auto-registration
// ============================================================================

// Import and register the Claude CLI runtime
import { createClaudeCliRuntime } from "./claude-cli";
registerRuntime("claude-cli", createClaudeCliRuntime);

// Import and register the Codex CLI runtime
import { createCodexCliRuntime } from "./codex-cli";
registerRuntime("codex-cli", createCodexCliRuntime);

// Import and register the Codex SDK runtime (stub)
import { createCodexSdkRuntime } from "./codex-sdk";
registerRuntime("codex-sdk", createCodexSdkRuntime);
