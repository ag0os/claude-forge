#!/usr/bin/env -S bun run

/**
 * COACH COORDINATOR: training organizer / scheduler
 *
 * Stateless dialogue partner that knows the tutor roster and helps the
 * student pick what to train today, sketch out a week, or think about
 * their rotation across specialists. Does not teach, drill, review code,
 * or track progress — each specialist owns its own continuity.
 *
 * Optional file: .coach/plan.md in cwd, only if the student asks.
 *
 * Usage:
 *   bun run agents/tutors/coach-coordinator.ts                         # open
 *   bun run agents/tutors/coach-coordinator.ts "what should I do today"
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/coach-coordinator.md" with {
	type: "text",
};

const coachSettings = {
	permissions: {
		defaultMode: "default",
		allow: [],
	},
};

const coachMcp = {
	mcpServers: {},
};

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": coachSystemPrompt,
			settings: JSON.stringify(coachSettings),
			"mcp-config": JSON.stringify(coachMcp),
		},
		parsedArgs.values as ClaudeFlags,
	);
	const args = userPrompt ? [...flags, userPrompt] : [...flags];

	const exitCode = await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: process.cwd() },
	});

	process.exit(exitCode);
}

await main();
