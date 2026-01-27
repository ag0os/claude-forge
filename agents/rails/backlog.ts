#!/usr/bin/env -S bun run

/**
 * RAILS BACKLOG TASK COORDINATOR: Analyze backlog tasks and coordinate specialized Rails sub-agents
 *
 * This agent reads tasks from backlog.md using the backlog CLI, analyzes them,
 * and coordinates the appropriate specialized sub-agents to accomplish them efficiently.
 *
 * Key capabilities:
 * - Task analysis and understanding
 * - Sub-agent coordination and assignment
 * - Task lifecycle management
 * - Quality assurance and Definition of Done verification
 *
 * Usage:
 *   bun run agents/rails-backlog.ts "Work on task 42"
 *   bun run agents/rails-backlog.ts "What's next on the backlog?"
 *   bun run agents/rails-backlog.ts             # interactive mode
 */

import {
	buildClaudeFlags,
	getPositionals,
	spawnClaudeAndWait,
} from "../../lib";
import railsBacklogMcp from "../../settings/rails-backlog.mcp.json" with {
	type: "json",
};
import railsBacklogSettings from "../../settings/rails-backlog.settings.json" with {
	type: "json",
};
import railsBacklogSystemPrompt from "../../system-prompts/rails-backlog-coordinator-prompt.md" with {
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
	settings: JSON.stringify(railsBacklogSettings),
	"mcp-config": JSON.stringify(railsBacklogMcp),
	"append-system-prompt": railsBacklogSystemPrompt,
});

// Add the prompt as positional argument if provided
const args = userPrompt ? [...flags, userPrompt] : [...flags];

const exitCode = await spawnClaudeAndWait({
	args,
	env: { CLAUDE_PROJECT_DIR: projectRoot },
});

process.exit(exitCode);
