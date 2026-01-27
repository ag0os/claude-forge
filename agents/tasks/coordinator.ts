#!/usr/bin/env -S bun run
/**
 * FORGE TASK COORDINATOR: Coordinate sub-agents to implement forge-tasks
 *
 * This agent reads existing tasks from forge-tasks and coordinates specialized
 * sub-agents to implement them. It discovers available agents, matches tasks
 * to appropriate specialists, and monitors progress to completion.
 *
 * Key capabilities:
 * - Read and understand tasks from forge-tasks
 * - Discover available sub-agents via Task tool
 * - Match tasks to appropriate specialists based on labels
 * - Delegate with embedded task-update instructions
 * - Monitor progress and verify completion
 *
 * Usage:
 *   bun run agents/forge-task-coordinator.ts "Implement all pending tasks"
 *   bun run agents/forge-task-coordinator.ts "Work on TASK-001"
 *   bun run agents/forge-task-coordinator.ts              # interactive mode
 */

import {
	buildClaudeFlags,
	getPositionals,
	spawnClaudeAndWait,
} from "../../lib";
import taskCoordinatorMcp from "../../settings/forge-task-coordinator.mcp.json" with {
	type: "json",
};
import taskCoordinatorSettings from "../../settings/forge-task-coordinator.settings.json" with {
	type: "json",
};
import taskCoordinatorSystemPrompt from "../../system-prompts/forge-task-coordinator-prompt.md" with {
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
	settings: JSON.stringify(taskCoordinatorSettings),
	"mcp-config": JSON.stringify(taskCoordinatorMcp),
	"append-system-prompt": taskCoordinatorSystemPrompt,
});

// Add the prompt as positional argument if provided
const args = userPrompt ? [...flags, userPrompt] : [...flags];

const exitCode = await spawnClaudeAndWait({
	args,
	env: { CLAUDE_PROJECT_DIR: projectRoot },
});

process.exit(exitCode);
