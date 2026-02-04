/**
 * Codex SDK runtime backend (stub)
 *
 * This backend is not implemented yet. It exists to provide a clear,
 * actionable error when selected, and to reserve the backend identifier
 * for future SDK integration work.
 */

import type {
	AgentRuntime,
	RunOptions,
	RunResult,
	RuntimeCapabilities,
	StreamCallbacks,
} from "./types";

const NOT_IMPLEMENTED_MESSAGE =
	"codex-sdk backend is not implemented in claude-forge yet. Use codex-cli instead.";

export class CodexSdkRuntime implements AgentRuntime {
	readonly backend = "codex-sdk" as const;

	async isAvailable(): Promise<boolean> {
		return false;
	}

	capabilities(): RuntimeCapabilities {
		return {
			supportsMcp: false,
			supportsTools: false,
			supportsModel: true,
			supportsMaxTurns: true,
			supportsInteractive: false,
			supportsStreaming: false,
			supportsSystemPrompt: true,
		};
	}

	async run(_options: RunOptions): Promise<RunResult> {
		return {
			exitCode: 1,
			completionMarkerFound: false,
			stderr: NOT_IMPLEMENTED_MESSAGE,
		};
	}

	async runStreaming(
		_options: RunOptions,
		callbacks: StreamCallbacks
	): Promise<RunResult> {
		if (callbacks.onStderr) {
			callbacks.onStderr(NOT_IMPLEMENTED_MESSAGE);
		}

		return {
			exitCode: 1,
			completionMarkerFound: false,
			stderr: NOT_IMPLEMENTED_MESSAGE,
		};
	}

	async runInteractive(_options: Omit<RunOptions, "mode">): Promise<RunResult> {
		return {
			exitCode: 1,
			completionMarkerFound: false,
			stderr: NOT_IMPLEMENTED_MESSAGE,
		};
	}
}

export function createCodexSdkRuntime(): AgentRuntime {
	return new CodexSdkRuntime();
}
