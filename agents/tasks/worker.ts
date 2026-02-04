#!/usr/bin/env -S bun run

/**
 * FORGE TASK WORKER: Implement a single assigned task
 *
 * This agent implements a single task, tracking progress and updating
 * acceptance criteria as it works. It's designed to be spawned by a
 * coordinator agent via the Task tool.
 *
 * Key capabilities:
 * - Read task details and acceptance criteria
 * - Update task progress as it works
 * - Check off acceptance criteria as completed
 * - Add implementation notes
 * - Report completion or blockers
 *
 * Usage:
 *   bun run agents/tasks/worker.ts "Implement TASK-001"
 *   bun run agents/tasks/worker.ts                        # interactive mode
 *   bun run agents/tasks/worker.ts --print "TASK-001"     # print mode (non-interactive)
 *   bun run agents/tasks/worker.ts --backend codex-cli    # use alternate backend
 *
 * ## Runtime Abstraction Migration Pattern
 *
 * This agent uses the runtime abstraction layer (lib/runtime) which enables
 * backend switching via the --backend flag. The pattern is:
 *
 * 1. Import from lib/runtime instead of lib/claude:
 *    - runAgentOnce() for print mode (non-interactive, captured output)
 *    - runAgentInteractive() for interactive mode (inherited stdio)
 *
 * 2. Import getBackend, validateBackendFlags, isPrintMode from lib/flags:
 *    - getBackend() resolves --backend flag or FORGE_BACKEND env var
 *    - validateBackendFlags() warns about incompatible Claude-specific flags
 *    - isPrintMode() checks if --print flag was passed
 *
 * 3. Build RunOptions instead of CLI args:
 *    - prompt: positional argument
 *    - systemPrompt: from system-prompts/*.md
 *    - settings: JSON.stringify(settingsObject)
 *    - mcpConfig: JSON.stringify(mcpObject)
 *    - cwd: project root
 *    - env: additional environment variables
 *
 * 4. Call the appropriate runtime function based on mode:
 *    - isPrintMode() ? runAgentOnce(options) : runAgentInteractive(options)
 */

import type { ClaudeFlags } from "../../lib";
import {
	getBackend,
	getPositionals,
	isPrintMode,
	parsedArgs,
	runAgentInteractive,
	runAgentOnce,
	toFlags,
	validateBackendFlags,
} from "../../lib";
import taskWorkerMcp from "../../settings/forge-task-worker.mcp.json" with {
	type: "json",
};
import taskWorkerSettings from "../../settings/forge-task-worker.settings.json" with {
	type: "json",
};
import taskWorkerSystemPrompt from "../../system-prompts/forge-task-worker-prompt.md" with {
	type: "text",
};

function resolvePath(relativeFromThisFile: string): string {
	const url = new URL(relativeFromThisFile, import.meta.url);
	return url.pathname;
}

async function main() {
	const projectRoot = resolvePath("../");

	const cliValues = parsedArgs.values as Record<
		string,
		string | boolean | string[] | undefined
	>;

	const coerceList = (
		value: string | string[] | boolean | undefined,
	): string[] | undefined => {
		if (typeof value === "string") {
			const items = value.split(/[,\s]+/).filter(Boolean);
			return items.length > 0 ? items : undefined;
		}

		if (Array.isArray(value)) {
			const items = value.flatMap((entry) =>
				entry.split(/[,\s]+/).filter(Boolean),
			);
			return items.length > 0 ? items : undefined;
		}

		return undefined;
	};

	const coerceNumber = (value: string | boolean | string[] | undefined) => {
		if (typeof value === "string" && value.trim() !== "") {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : undefined;
		}
		return undefined;
	};

	// Get backend and validate flags
	const backend = getBackend();
	validateBackendFlags(backend);

	// Get any prompt from positional arguments
	const positionals = getPositionals();
	const cliPrompt =
		typeof cliValues.prompt === "string" ? cliValues.prompt : undefined;
	const userPrompt =
		positionals.join(" ") || cliPrompt || "Help me with my task";

	const cliModel =
		typeof cliValues.model === "string" ? cliValues.model : undefined;
	const cliMaxTurns = coerceNumber(
		(cliValues["max-turns"] ?? cliValues.maxTurns) as
			| string
			| boolean
			| string[]
			| undefined,
	);
	const cliAllowedTools = coerceList(cliValues.allowedTools);
	const cliDisallowedTools = coerceList(cliValues.disallowedTools);
	const cliSettings =
		typeof cliValues.settings === "string" ? cliValues.settings : undefined;
	const rawMcpConfig = cliValues["mcp-config"] ?? cliValues.mcpConfig;
	const cliMcpConfig =
		typeof rawMcpConfig === "string" ? rawMcpConfig : undefined;
	const rawAppendSystemPrompt =
		cliValues["append-system-prompt"] ?? cliValues.appendSystemPrompt;
	const cliAppendSystemPrompt =
		typeof rawAppendSystemPrompt === "string"
			? rawAppendSystemPrompt
			: undefined;
	const cliSkipPermissions =
		(cliValues["dangerously-skip-permissions"] ??
			cliValues.dangerouslySkipPermissions) === true;

	const mappedFlags = new Set([
		"backend",
		"print",
		"prompt",
		"model",
		"max-turns",
		"maxTurns",
		"allowedTools",
		"disallowedTools",
		"settings",
		"mcp-config",
		"mcpConfig",
		"append-system-prompt",
		"appendSystemPrompt",
		"dangerously-skip-permissions",
		"dangerouslySkipPermissions",
	]);

	const filteredFlags = Object.fromEntries(
		Object.entries(cliValues).filter(
			([key, value]) => value !== undefined && !mappedFlags.has(key),
		),
	) as ClaudeFlags;

	const rawArgs = backend === "claude-cli" ? toFlags(filteredFlags) : undefined;

	// Build RunOptions for the runtime abstraction
	const options = {
		prompt: userPrompt,
		systemPrompt: cliAppendSystemPrompt
			? `${taskWorkerSystemPrompt}\n\n${cliAppendSystemPrompt}`
			: taskWorkerSystemPrompt,
		settings: cliSettings ?? JSON.stringify(taskWorkerSettings),
		mcpConfig: cliMcpConfig ?? JSON.stringify(taskWorkerMcp),
		cwd: projectRoot,
		env: { CLAUDE_PROJECT_DIR: projectRoot },
		backend,
		model: cliModel,
		maxTurns: cliMaxTurns,
		skipPermissions: cliSkipPermissions ? true : undefined,
		tools:
			cliAllowedTools || cliDisallowedTools
				? {
						allowed: cliAllowedTools,
						disallowed: cliDisallowedTools,
					}
				: undefined,
		rawArgs: rawArgs && rawArgs.length > 0 ? rawArgs : undefined,
	};

	// Choose execution mode based on --print flag
	const result = isPrintMode()
		? await runAgentOnce(options)
		: await runAgentInteractive(options);

	// In print mode, output the captured response
	if (isPrintMode() && result.stdout) {
		process.stdout.write(result.stdout);
	}

	process.exit(result.exitCode);
}

await main();
