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

import {
	getBackend,
	getPositionals,
	isPrintMode,
	runAgentInteractive,
	runAgentOnce,
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

	// Get backend and validate flags
	const backend = getBackend();
	validateBackendFlags(backend);

	// Get any prompt from positional arguments
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ") || "Help me with my task";

	// Build RunOptions for the runtime abstraction
	const options = {
		prompt: userPrompt,
		systemPrompt: taskWorkerSystemPrompt,
		settings: JSON.stringify(taskWorkerSettings),
		mcpConfig: JSON.stringify(taskWorkerMcp),
		cwd: projectRoot,
		env: { CLAUDE_PROJECT_DIR: projectRoot },
		backend,
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
