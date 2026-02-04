/**
 * Runtime abstraction types for backend-agnostic agent execution
 *
 * This module defines the core interfaces and types that all runtime backends
 * (claude-cli, codex-cli, codex-sdk, etc.) must implement. The abstraction
 * allows agents and orchestra to run without being tightly coupled to any
 * specific backend.
 *
 * @module lib/runtime/types
 */

// ============================================================================
// Backend Types
// ============================================================================

/**
 * Supported runtime backend identifiers
 *
 * - `claude-cli`: The Claude Code CLI (default, existing behavior)
 * - `codex-cli`: OpenAI Codex CLI
 * - `codex-sdk`: OpenAI Codex SDK (programmatic access)
 */
export type RuntimeBackend = "claude-cli" | "codex-cli" | "codex-sdk";

// ============================================================================
// Capability Types
// ============================================================================

/**
 * Capabilities that a runtime backend may or may not support
 *
 * Callers should check capabilities before using features that may not be
 * available on all backends. Backends should fail fast with clear errors
 * when unsupported features are requested.
 */
export interface RuntimeCapabilities {
	/**
	 * Whether the backend supports MCP (Model Context Protocol) servers
	 *
	 * Claude CLI: Yes (via --mcp-config)
	 * Codex CLI: No (requires preconfigured servers)
	 * Codex SDK: No
	 */
	supportsMcp: boolean;

	/**
	 * Whether the backend supports tool allow/deny lists
	 *
	 * Claude CLI: Yes (--allowedTools, --disallowedTools)
	 * Codex CLI: Limited
	 * Codex SDK: Limited
	 */
	supportsTools: boolean;

	/**
	 * Whether the backend supports model selection
	 *
	 * Claude CLI: Yes (--model)
	 * Codex CLI: Yes
	 * Codex SDK: Yes
	 */
	supportsModel: boolean;

	/**
	 * Whether the backend supports limiting the number of turns/iterations
	 *
	 * Claude CLI: Yes (--max-turns)
	 * Codex CLI: Limited
	 * Codex SDK: Yes
	 */
	supportsMaxTurns: boolean;

	/**
	 * Whether the backend supports interactive mode (inherited stdio)
	 *
	 * Claude CLI: Yes
	 * Codex CLI: Yes
	 * Codex SDK: No (programmatic only)
	 */
	supportsInteractive: boolean;

	/**
	 * Whether the backend supports streaming output with callbacks
	 *
	 * Claude CLI: Yes (stdout streaming)
	 * Codex CLI: Yes (stdout streaming)
	 * Codex SDK: Yes (event callbacks)
	 */
	supportsStreaming: boolean;

	/**
	 * Whether the backend supports system prompt injection
	 *
	 * Claude CLI: Yes (--append-system-prompt)
	 * Codex CLI: Limited (prepend to user prompt)
	 * Codex SDK: Yes
	 */
	supportsSystemPrompt: boolean;
}

// ============================================================================
// Run Options
// ============================================================================

/**
 * Tool configuration for allow/deny lists
 */
export interface ToolConfig {
	/**
	 * Tools to allow (whitelist)
	 * @example ["Bash(git:*)", "Edit", "Read"]
	 */
	allowed?: string[];

	/**
	 * Tools to deny (blacklist)
	 * @example ["Bash(rm:*)", "Write"]
	 */
	disallowed?: string[];
}

/**
 * Options for running an agent through the runtime abstraction
 *
 * This is the unified options shape that works across all backends.
 * Each backend maps or ignores unsupported fields explicitly.
 */
export interface RunOptions {
	/**
	 * The prompt/instruction to send to the agent
	 * This is the main user input that the agent will process.
	 * Optional for direct-spawn flows that rely solely on system prompts.
	 */
	prompt?: string;

	/**
	 * System prompt to prepend to the conversation
	 *
	 * For Claude CLI, this uses --append-system-prompt.
	 * For Codex CLI/SDK, this may be prepended to the user prompt.
	 */
	systemPrompt?: string;

	/**
	 * Working directory for the agent execution
	 * Defaults to process.cwd() if not specified.
	 */
	cwd?: string;

	/**
	 * Additional environment variables to set for the agent process
	 * These are merged with the current process environment.
	 */
	env?: Record<string, string>;

	/**
	 * Model identifier to use for this run
	 *
	 * For Claude CLI, this maps to --model (e.g., "sonnet", "opus").
	 * For Codex, this maps to the model parameter.
	 */
	model?: string;

	/**
	 * Maximum number of turns/iterations for the agent
	 *
	 * For Claude CLI, this maps to --max-turns.
	 * For other backends, this limits the conversation length.
	 */
	maxTurns?: number;

	/**
	 * Tool allow/deny configuration
	 *
	 * For Claude CLI, this maps to --allowedTools and --disallowedTools.
	 * Support varies by backend.
	 */
	tools?: ToolConfig;

	/**
	 * Path to a settings JSON file
	 *
	 * For Claude CLI, this maps to --settings.
	 * Other backends may ignore this or have their own config mechanisms.
	 */
	settings?: string;

	/**
	 * Path to an MCP configuration file
	 *
	 * For Claude CLI, this maps to --mcp-config.
	 * Codex backends do not support per-run MCP config.
	 */
	mcpConfig?: string;

	/**
	 * Execution mode for the agent
	 *
	 * - `print`: Non-interactive mode (Claude CLI --print)
	 * - `interactive`: Full interactive mode with inherited stdio
	 */
	mode: "print" | "interactive";

	/**
	 * Backend-specific configuration options
	 *
	 * Use this for features that don't map across backends.
	 * Prefer using standard options when possible.
	 */
	providerOptions?: Record<string, unknown>;

	/**
	 * Raw CLI arguments to pass through (CLI backends only)
	 *
	 * This is an escape hatch for backend-specific flags that
	 * don't have a standard option mapping. Use sparingly.
	 */
	rawArgs?: string[];

	/**
	 * Whether to skip permission checks
	 *
	 * For Claude CLI, this maps to --dangerously-skip-permissions.
	 * Use with caution; recommended only for sandboxed environments.
	 */
	skipPermissions?: boolean;

	/**
	 * Verbose/debug output mode
	 */
	verbose?: boolean;
}

// ============================================================================
// Run Result Types
// ============================================================================

/**
 * Result from running an agent
 *
 * This structure captures the outcome of an agent run, including
 * exit status, captured output, and completion marker detection.
 */
export interface RunResult {
	/**
	 * Exit code from the agent process
	 *
	 * 0 typically indicates success, non-zero indicates an error.
	 */
	exitCode: number;

	/**
	 * Captured stdout content (only available in print mode)
	 *
	 * In interactive mode, stdout is inherited and this will be undefined.
	 */
	stdout?: string;

	/**
	 * Captured stderr content (only available in print mode)
	 *
	 * In interactive mode, stderr is inherited and this will be undefined.
	 */
	stderr?: string;

	/**
	 * Whether the completion marker (ORCHESTRA_COMPLETE) was detected
	 *
	 * This is used by orchestra to determine when an agent loop should stop.
	 * Detection happens during streaming or in the final output.
	 */
	completionMarkerFound: boolean;

	/**
	 * Structured output from the agent (if available)
	 *
	 * Some backends (like Codex SDK) may return structured data
	 * in addition to or instead of text output.
	 */
	structured?: unknown[];
}

// ============================================================================
// Streaming Callbacks
// ============================================================================

/**
 * Callbacks for streaming mode execution
 *
 * These callbacks allow callers to process output incrementally
 * and react to completion markers in real-time.
 */
export interface StreamCallbacks {
	/**
	 * Called when stdout data is received
	 *
	 * @param data - The raw string data received from stdout
	 */
	onStdout?: (data: string) => void;

	/**
	 * Called when stderr data is received
	 *
	 * @param data - The raw string data received from stderr
	 */
	onStderr?: (data: string) => void;

	/**
	 * Called when the completion marker is detected in the output
	 *
	 * This is called at most once per run, when ORCHESTRA_COMPLETE
	 * is found in the output stream.
	 */
	onMarkerDetected?: () => void;
}

// ============================================================================
// Agent Runtime Interface
// ============================================================================

/**
 * Core interface that all runtime backends must implement
 *
 * This abstraction allows agents and orchestra to run without being
 * tightly coupled to any specific backend (Claude CLI, Codex, etc.).
 *
 * @example
 * ```ts
 * // Get a runtime for the desired backend
 * const runtime = getRuntime("claude-cli");
 *
 * // Check if the backend is available
 * if (!(await runtime.isAvailable())) {
 *   throw new Error("Claude CLI not installed");
 * }
 *
 * // Run an agent
 * const result = await runtime.run({
 *   prompt: "Implement the feature described in TASK-001",
 *   systemPrompt: "You are a helpful coding assistant...",
 *   mode: "print",
 *   cwd: "/path/to/project",
 * });
 * ```
 */
export interface AgentRuntime {
	/**
	 * The backend identifier for this runtime
	 */
	readonly backend: RuntimeBackend;

	/**
	 * Check if this runtime backend is available
	 *
	 * This should verify that the necessary CLI tools are installed
	 * or SDK credentials are configured.
	 *
	 * @returns Promise resolving to true if the backend is ready to use
	 */
	isAvailable(): Promise<boolean>;

	/**
	 * Get the capabilities of this runtime backend
	 *
	 * Callers should check capabilities before using features that
	 * may not be available on all backends.
	 *
	 * @returns The capability flags for this backend
	 */
	capabilities(): RuntimeCapabilities;

	/**
	 * Run an agent with the given options
	 *
	 * In print mode, output is captured and returned in RunResult.
	 * In interactive mode, stdio is inherited for user interaction.
	 *
	 * @param options - Run configuration
	 * @returns Promise resolving to the run result
	 */
	run(options: RunOptions): Promise<RunResult>;

	/**
	 * Run an agent with streaming output callbacks
	 *
	 * This method enables real-time output processing and completion
	 * marker detection, which is essential for orchestra loop control.
	 *
	 * @param options - Run configuration (mode should be "print")
	 * @param callbacks - Streaming callbacks for output processing
	 * @returns Promise resolving to the run result
	 */
	runStreaming(options: RunOptions, callbacks: StreamCallbacks): Promise<RunResult>;

	/**
	 * Run an agent in interactive mode
	 *
	 * This is a convenience method that sets mode to "interactive"
	 * and inherits stdio for user interaction.
	 *
	 * @param options - Run configuration (mode is ignored, always interactive)
	 * @returns Promise resolving to the run result
	 */
	runInteractive(options: Omit<RunOptions, "mode">): Promise<RunResult>;
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Configuration for runtime resolution
 */
export interface RuntimeConfig {
	/**
	 * Default backend to use when none is specified
	 * @default "claude-cli"
	 */
	defaultBackend?: RuntimeBackend;

	/**
	 * Environment variable to check for backend override
	 * @default "FORGE_BACKEND"
	 */
	envVar?: string;
}

/**
 * Function type for runtime factories
 */
export type RuntimeFactory = () => AgentRuntime;

/**
 * Registry mapping backend names to their factories
 */
export type RuntimeRegistry = Record<RuntimeBackend, RuntimeFactory>;
