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
	RuntimeFactory,
	RunOptions,
	RunResult,
	StreamCallbacks,
} from "./types";

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
	// 1. Explicit override takes precedence
	if (override) {
		return override;
	}

	// 2. Check CLI arguments for --backend flag
	const fromArgs = parseBackendFromArgs();
	if (fromArgs) {
		return fromArgs;
	}

	// 3. Check environment variable
	const envValue = process.env[BACKEND_ENV_VAR];
	if (envValue) {
		if (isValidBackend(envValue)) {
			return envValue;
		}
		console.warn(
			`[runtime] Invalid ${BACKEND_ENV_VAR} value: ${envValue}, using default`,
		);
	}

	// 4. Fall back to default
	return DEFAULT_BACKEND;
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
 * @param options - Run options (mode is set to "print" automatically)
 * @returns Promise resolving to the run result with captured output
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
	const runtime = getRuntime(backend);
	return runtime.run({
		...runOptions,
		mode: "print",
	});
}

/**
 * Run an agent with streaming output and optional callbacks
 *
 * This wrapper enables real-time output processing and completion marker
 * detection, which is essential for orchestra loop control.
 *
 * @param options - Run options (mode is set to "print" automatically)
 * @param callbacks - Callbacks for stdout, stderr, and marker detection
 * @returns Promise resolving to the run result
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
	const runtime = getRuntime(backend);
	return runtime.runStreaming(
		{
			...runOptions,
			mode: "print",
		},
		callbacks,
	);
}

/**
 * Run an agent in interactive mode with inherited stdio
 *
 * This wrapper spawns the agent with inherited stdio, allowing direct
 * user interaction through the terminal.
 *
 * @param options - Run options (mode is ignored, always interactive)
 * @returns Promise resolving to the run result (output is not captured)
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
	const runtime = getRuntime(backend);
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
	try {
		const runtime = getRuntime(backend);
		return await runtime.isAvailable();
	} catch {
		// Backend not registered or factory failed
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

// ============================================================================
// Auto-registration
// ============================================================================

// Import and register the Claude CLI runtime
import { createClaudeCliRuntime } from "./claude-cli";
registerRuntime("claude-cli", createClaudeCliRuntime);
