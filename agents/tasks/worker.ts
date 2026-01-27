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
 *   bun run agents/forge-task-worker.ts "Implement TASK-001"
 *   bun run agents/forge-task-worker.ts              # interactive mode
 */

import {
	buildClaudeFlags,
	getPositionals,
	spawnClaudeAndWait,
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

const projectRoot = resolvePath("../");

// Get any prompt from positional arguments
const positionals = getPositionals();
const userPrompt = positionals.join(" ");

// Build Claude flags
const flags = buildClaudeFlags({
	settings: JSON.stringify(taskWorkerSettings),
	"mcp-config": JSON.stringify(taskWorkerMcp),
	"append-system-prompt": taskWorkerSystemPrompt,
});

// Add the prompt as positional argument if provided
const args = userPrompt ? [...flags, userPrompt] : [...flags];

const exitCode = await spawnClaudeAndWait({
	args,
	env: { CLAUDE_PROJECT_DIR: projectRoot },
});

process.exit(exitCode);
