#!/usr/bin/env -S bun run
/**
 * TDD COORDINATOR: Orchestrate Test-Driven Development with human-in-the-loop checkpoints
 *
 * This agent coordinates the classic Red-Green-Refactor TDD cycle, ensuring
 * human involvement at critical decision points: test case agreement,
 * refactoring review, and plan adaptation.
 *
 * Key capabilities:
 * - Test case proposal and agreement with user
 * - RED phase: coordinate test writing, verify tests fail
 * - GREEN phase: coordinate minimal implementation, verify tests pass
 * - REFACTOR phase: user review and improvement coordination
 * - Plan adaptation: surface insights, update plans based on TDD discoveries
 *
 * Usage:
 *   bun run agents/tdd-coordinator.ts "Implement user authentication with TDD"
 *   bun run agents/tdd-coordinator.ts             # interactive mode
 */

import { buildClaudeFlags, getPositionals, spawnClaudeAndWait } from "../lib";
import tddCoordinatorMcp from "../settings/tdd-coordinator.mcp.json" with {
	type: "json",
};
import tddCoordinatorSettings from "../settings/tdd-coordinator.settings.json" with {
	type: "json",
};
import tddCoordinatorSystemPrompt from "../system-prompts/tdd-coordinator-prompt.md" with {
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
	settings: JSON.stringify(tddCoordinatorSettings),
	"mcp-config": JSON.stringify(tddCoordinatorMcp),
	"append-system-prompt": tddCoordinatorSystemPrompt,
});

// Add the prompt as positional argument if provided
const args = userPrompt ? [...flags, userPrompt] : [...flags];

const exitCode = await spawnClaudeAndWait({
	args,
	env: { CLAUDE_PROJECT_DIR: projectRoot },
});

process.exit(exitCode);
