/**
 * Utility functions for handling Claude CLI flags
 */
import { parseArgs } from "node:util"
import type { ClaudeFlags } from "./claude-flags.types"
import type { RuntimeBackend } from "./runtime/types"

/**
 * Valid backend values
 */
const VALID_BACKENDS: RuntimeBackend[] = ["claude-cli", "codex-cli", "codex-sdk"]

/**
 * Claude-specific flags that may not work with other backends
 */
const CLAUDE_SPECIFIC_FLAGS = [
	"mcp-config",
	"allowedTools",
	"disallowedTools",
	"strict-mcp-config",
	"append-system-prompt",
	"permission-mode",
] as const

// Parse command line arguments once
const args = parseArgs({
	strict: false,
	allowPositionals: true,
	options: {
		backend: { type: "string" },
		print: { type: "boolean" },
	},
})

/**
 * Convert flags object to command line arguments
 */
export function toFlags(flagsObj: ClaudeFlags): string[] {
    return Object.entries(flagsObj).flatMap(([key, value]) => {
        if (value === true) return [`--${key}`]
        if (value === false) return [`--no-${key}`]
        if (value !== undefined) return [`--${key}`, String(value)]
        return []
    })
}

/**
 * Extract Claude-specific flags from parsed args, excluding forge-specific flags
 */
function extractClaudeFlags(
	values: Record<string, string | boolean | undefined>
): ClaudeFlags {
	// Exclude forge-specific flags that shouldn't be passed to Claude CLI
	const { backend, ...claudeFlags } = values
	return claudeFlags as ClaudeFlags
}

/**
 * Merge default flags with user flags and convert to CLI format
 * User flags override defaults. Uses parsed command line args automatically.
 */
export function buildClaudeFlags(
	defaults: ClaudeFlags,
	userFlags: ClaudeFlags = extractClaudeFlags(args.values)
): string[] {
	const merged = { ...defaults, ...userFlags }
	return toFlags(merged)
}

/**
 * Get parsed positional arguments
 */
export function getPositionals(): string[] {
    return args.positionals
}

// Expose parsed args for advanced cases where direct access is helpful
export const parsedArgs = args

/**
 * Check if a value is a valid RuntimeBackend
 */
function isValidBackend(value: string): value is RuntimeBackend {
	return VALID_BACKENDS.includes(value as RuntimeBackend)
}

/**
 * Get the resolved backend from CLI flag, environment variable, or default
 *
 * Resolution order:
 * 1. CLI --backend flag
 * 2. FORGE_BACKEND environment variable
 * 3. Default: 'claude-cli'
 *
 * @throws Error if the backend value is invalid
 */
export function getBackend(): RuntimeBackend {
	// 1. Check CLI --backend flag first
	const cliBackend = args.values.backend as string | undefined
	if (cliBackend !== undefined) {
		if (!isValidBackend(cliBackend)) {
			throw new Error(
				`Unknown backend: '${cliBackend}'. Valid backends are: ${VALID_BACKENDS.join(", ")}`
			)
		}
		return cliBackend
	}

	// 2. Check FORGE_BACKEND environment variable
	const envBackend = process.env.FORGE_BACKEND
	if (envBackend !== undefined && envBackend !== "") {
		if (!isValidBackend(envBackend)) {
			throw new Error(
				`Unknown backend in FORGE_BACKEND: '${envBackend}'. Valid backends are: ${VALID_BACKENDS.join(", ")}`
			)
		}
		return envBackend
	}

	// 3. Default to claude-cli
	return "claude-cli"
}

/**
 * Validate flag combinations for the selected backend
 *
 * Emits warnings to stderr when Claude-specific flags are used with non-Claude backends.
 *
 * @param backend - The resolved backend to validate against
 */
export function validateBackendFlags(backend: RuntimeBackend): void {
	if (backend === "claude-cli") {
		// No warnings needed for Claude backend
		return
	}

	// Check for Claude-specific flags being used with non-Claude backends
	const usedClaudeFlags: string[] = []

	for (const flag of CLAUDE_SPECIFIC_FLAGS) {
		if (args.values[flag] !== undefined) {
			usedClaudeFlags.push(`--${flag}`)
		}
	}

	if (usedClaudeFlags.length > 0) {
		console.warn(
			`Warning: The following flags are Claude CLI-specific and may not work with '${backend}' backend: ${usedClaudeFlags.join(", ")}`
		)
	}
}

/**
 * Check if the agent is running in print mode (non-interactive)
 *
 * Returns true if --print flag was passed on the command line.
 * Used to determine whether to call runAgentOnce (print mode) or
 * runAgentInteractive (interactive mode).
 */
export function isPrintMode(): boolean {
	return args.values.print === true
}