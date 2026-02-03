/**
 * Debug logging and error handling utilities for runtime abstraction
 *
 * Provides standardized debug logging controlled by environment variables
 * and a custom error class with actionable remediation steps.
 *
 * @module lib/runtime/debug
 */

import type { RuntimeBackend } from "./types";

// ============================================================================
// Debug Configuration
// ============================================================================

/**
 * Check if debug logging is enabled
 *
 * Debug logging is enabled when:
 * - FORGE_DEBUG environment variable is set to "1"
 * - DEBUG environment variable contains "forge"
 *
 * @returns true if debug logging should be enabled
 */
export function isDebugEnabled(): boolean {
	return (
		process.env.FORGE_DEBUG === "1" ||
		(process.env.DEBUG?.includes("forge") ?? false)
	);
}

/**
 * Internal flag to cache debug state
 * Lazy-evaluated on first use
 */
let _debugEnabled: boolean | undefined;

/**
 * Get cached debug enabled state
 *
 * Caches the result to avoid repeated environment variable lookups.
 *
 * @returns true if debug logging is enabled
 */
function getDebugEnabled(): boolean {
	if (_debugEnabled === undefined) {
		_debugEnabled = isDebugEnabled();
	}
	return _debugEnabled;
}

// ============================================================================
// Debug Logging Functions
// ============================================================================

/**
 * Log a debug message with a category prefix
 *
 * Messages are only logged when debug mode is enabled via environment variables.
 * Output goes to stderr to avoid interfering with stdout-based tool communication.
 *
 * @param category - The logging category (e.g., "runtime", "resolve", "spawn")
 * @param message - The message to log
 * @param data - Optional structured data to include (will be JSON stringified)
 *
 * @example
 * ```ts
 * debugLog("runtime", "Resolving backend", { override: "codex-cli" });
 * // Output: [forge:runtime] Resolving backend {"override":"codex-cli"}
 * ```
 */
export function debugLog(
	category: string,
	message: string,
	data?: unknown
): void {
	if (!getDebugEnabled()) {
		return;
	}

	const prefix = `[forge:${category}]`;
	const timestamp = new Date().toISOString();

	if (data !== undefined) {
		const dataStr =
			typeof data === "string" ? data : JSON.stringify(data, null, 2);
		console.error(`${timestamp} ${prefix} ${message}`, dataStr);
	} else {
		console.error(`${timestamp} ${prefix} ${message}`);
	}
}

/**
 * Log a debug message in the "runtime" category
 *
 * Convenience wrapper for runtime-related debug messages.
 *
 * @param message - The message to log
 * @param data - Optional structured data to include
 *
 * @example
 * ```ts
 * debugRuntime("Backend resolved", { backend: "claude-cli", source: "env" });
 * ```
 */
export function debugRuntime(message: string, data?: unknown): void {
	debugLog("runtime", message, data);
}

/**
 * Log a debug message in the "resolve" category
 *
 * Used for backend resolution and configuration logging.
 *
 * @param message - The message to log
 * @param data - Optional structured data to include
 *
 * @example
 * ```ts
 * debugResolve("Checking CLI args for --backend flag");
 * debugResolve("Found backend in args", { backend: "codex-cli" });
 * ```
 */
export function debugResolve(message: string, data?: unknown): void {
	debugLog("resolve", message, data);
}

/**
 * Log a debug message in the "spawn" category
 *
 * Used for command building and process spawning logging.
 *
 * @param message - The message to log
 * @param data - Optional structured data to include
 *
 * @example
 * ```ts
 * debugSpawn("Building command", { command: "claude", args: ["--print"] });
 * debugSpawn("Spawning process", { cwd: "/path/to/project" });
 * ```
 */
export function debugSpawn(message: string, data?: unknown): void {
	debugLog("spawn", message, data);
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when a runtime backend operation fails
 *
 * Includes the backend identifier and optional remediation steps
 * to help users resolve the issue.
 *
 * @example
 * ```ts
 * throw new RuntimeError(
 *   "claude command not found",
 *   "claude-cli",
 *   "Install Claude Code CLI: npm install -g @anthropic-ai/claude-code"
 * );
 * ```
 */
export class RuntimeError extends Error {
	/**
	 * Create a new RuntimeError
	 *
	 * @param message - The error message describing what went wrong
	 * @param backend - The runtime backend that encountered the error
	 * @param remediation - Optional steps the user can take to fix the issue
	 */
	constructor(
		message: string,
		public readonly backend: RuntimeBackend,
		public readonly remediation?: string
	) {
		super(message);
		this.name = "RuntimeError";
	}

	/**
	 * Format the error message with remediation steps
	 *
	 * @returns A formatted string including the error and remediation
	 */
	toString(): string {
		let result = `RuntimeError [${this.backend}]: ${this.message}`;
		if (this.remediation) {
			result += `\n\nTo fix this:\n  ${this.remediation}`;
		}
		return result;
	}
}

/**
 * Error thrown when a backend binary is not found
 *
 * Specialization of RuntimeError with pre-formatted remediation steps
 * for missing CLI tools.
 *
 * @example
 * ```ts
 * throw new BackendNotFoundError("claude-cli");
 * // Error: Claude CLI (claude) not found in PATH
 * // To fix this:
 * //   Install Claude Code CLI: npm install -g @anthropic-ai/claude-code
 * //   Or set CLAUDE_PATH environment variable to the claude binary location
 * ```
 */
export class BackendNotFoundError extends RuntimeError {
	constructor(backend: RuntimeBackend) {
		const { message, remediation } = getBackendNotFoundInfo(backend);
		super(message, backend, remediation);
		this.name = "BackendNotFoundError";
	}
}

/**
 * Error thrown when an unsupported option is used with a backend
 *
 * Specialization of RuntimeError that indicates which option was used
 * and what the backend supports instead.
 *
 * @example
 * ```ts
 * throw new UnsupportedOptionError(
 *   "codex-cli",
 *   "mcpConfig",
 *   "MCP servers must be preconfigured externally for Codex CLI"
 * );
 * ```
 */
export class UnsupportedOptionError extends RuntimeError {
	constructor(
		backend: RuntimeBackend,
		public readonly option: string,
		alternative?: string
	) {
		const message = `Option "${option}" is not supported by ${backend}`;
		const remediation = alternative
			? `${alternative}`
			: `Remove the "${option}" option or use a different backend`;
		super(message, backend, remediation);
		this.name = "UnsupportedOptionError";
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get error info for a missing backend binary
 *
 * Returns backend-specific error messages and remediation steps.
 *
 * @param backend - The runtime backend that was not found
 * @returns Object with message and remediation strings
 */
function getBackendNotFoundInfo(backend: RuntimeBackend): {
	message: string;
	remediation: string;
} {
	switch (backend) {
		case "claude-cli":
			return {
				message: "Claude CLI (claude) not found in PATH",
				remediation:
					"Install Claude Code CLI: npm install -g @anthropic-ai/claude-code\n" +
					"  Or set CLAUDE_PATH environment variable to the claude binary location",
			};
		case "codex-cli":
			return {
				message: "Codex CLI (codex) not found in PATH",
				remediation:
					"Install OpenAI Codex CLI: npm install -g @openai/codex\n" +
					"  Or set CODEX_PATH environment variable to the codex binary location",
			};
		case "codex-sdk":
			return {
				message: "Codex SDK is not available",
				remediation:
					"Install OpenAI Codex SDK: npm install @openai/codex\n" +
					"  Ensure OPENAI_API_KEY environment variable is set",
			};
		default:
			return {
				message: `Unknown backend "${backend}" not found`,
				remediation: `Available backends: claude-cli, codex-cli, codex-sdk`,
			};
	}
}

/**
 * Format a command and arguments for debug logging
 *
 * Produces a shell-safe representation of the command that can be
 * copy-pasted for debugging.
 *
 * @param command - The command to run
 * @param args - The command arguments
 * @returns A formatted string representation
 *
 * @example
 * ```ts
 * formatCommand("claude", ["--print", "--model", "sonnet", "Hello"]);
 * // Returns: claude --print --model sonnet 'Hello'
 * ```
 */
export function formatCommand(command: string, args: string[]): string {
	const escapedArgs = args.map((arg) => {
		// Quote args that contain spaces, quotes, or special characters
		if (/[\s"'\\$`!]/.test(arg)) {
			// Use single quotes and escape any single quotes in the arg
			return `'${arg.replace(/'/g, "'\\''")}'`;
		}
		return arg;
	});
	return [command, ...escapedArgs].join(" ");
}

/**
 * Log the constructed command for debugging
 *
 * @param command - The command to run
 * @param args - The command arguments
 * @param options - Additional options to log (cwd, env vars, etc.)
 */
export function debugCommand(
	command: string,
	args: string[],
	options?: { cwd?: string; env?: Record<string, string> }
): void {
	if (!getDebugEnabled()) {
		return;
	}

	debugSpawn("Constructed command", {
		command: formatCommand(command, args),
		cwd: options?.cwd || process.cwd(),
		envOverrides: options?.env ? Object.keys(options.env) : [],
	});
}
