#!/usr/bin/env -S bun run

/**
 * FORGE TASK MANAGER: Create and manage tasks using forge-tasks CLI
 *
 * This agent specializes in task management operations:
 * - Creating tasks from requirements
 * - Breaking down work into subtasks
 * - Tracking progress across tasks
 * - Updating task status
 * - Managing task dependencies
 *
 * Usage:
 *   bun run forge-tasks/agents/task-manager-agent.ts                     # interactive mode
 *   bun run forge-tasks/agents/task-manager-agent.ts "Create tasks for..." # with prompt
 */

import {
	buildClaudeFlags,
	getPositionals,
	spawnClaudeAndWait,
} from "../../lib";
import forgeTaskManagerMcp from "../../settings/forge-task-manager.mcp.json" with {
	type: "json",
};
import forgeTaskManagerSettings from "../../settings/forge-task-manager.settings.json" with {
	type: "json",
};
import forgeTaskManagerSystemPrompt from "../../system-prompts/forge-task-manager-prompt.md" with {
	type: "text",
};

function resolvePath(relativeFromThisFile: string): string {
	const url = new URL(relativeFromThisFile, import.meta.url);
	return url.pathname;
}

const projectRoot = resolvePath("../../");

// Get any prompt from positional arguments
const positionals = getPositionals();
const userPrompt = positionals.join(" ");

// Build Claude flags
const flags = buildClaudeFlags({
	settings: JSON.stringify(forgeTaskManagerSettings),
	"mcp-config": JSON.stringify(forgeTaskManagerMcp),
	"append-system-prompt": forgeTaskManagerSystemPrompt,
});

// Add the prompt as positional argument if provided
const args = userPrompt ? [...flags, userPrompt] : [...flags];

const exitCode = await spawnClaudeAndWait({
	args,
	env: { CLAUDE_PROJECT_DIR: projectRoot },
});

process.exit(exitCode);
