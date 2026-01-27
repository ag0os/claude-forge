#!/usr/bin/env -S bun run
/**
 * IMPLEMENTATION PLAN COORDINATOR: Coordinate sub-agents to implement a plan step by step
 *
 * This agent takes an implementation plan and coordinates specialized sub-agents
 * to execute each step. It ensures proper sequencing, progress tracking, and
 * quality assurance throughout the implementation.
 *
 * Key capabilities:
 * - Plan parsing and step breakdown
 * - Sub-agent coordination for each step
 * - Progress tracking and status updates
 * - Quality verification between steps
 *
 * Usage:
 *   bun run agents/plan-coordinator.ts "Implement the user authentication feature according to the plan"
 *   bun run agents/plan-coordinator.ts             # interactive mode
 */

import {
	buildClaudeFlags,
	getPositionals,
	spawnClaudeAndWait,
} from "../../lib";
import planCoordinatorMcp from "../../settings/plan-coordinator.mcp.json" with {
	type: "json",
};
import planCoordinatorSettings from "../../settings/plan-coordinator.settings.json" with {
	type: "json",
};
import planCoordinatorSystemPrompt from "../../system-prompts/plan-coordinator-prompt.md" with {
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
	settings: JSON.stringify(planCoordinatorSettings),
	"mcp-config": JSON.stringify(planCoordinatorMcp),
	"append-system-prompt": planCoordinatorSystemPrompt,
});

// Add the prompt as positional argument if provided
const args = userPrompt ? [...flags, userPrompt] : [...flags];

const exitCode = await spawnClaudeAndWait({
	args,
	env: { CLAUDE_PROJECT_DIR: projectRoot },
});

process.exit(exitCode);
