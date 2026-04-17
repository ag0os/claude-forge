#!/usr/bin/env -S bun run

/**
 * STAR: Interview coaching tutor for Webflow's Round 1 Core Behaviors
 *
 * Interrogates the student for the details that matter, structures their
 * raw experience into STAR format (Situation, Task, Action, Result), maps
 * each story to Webflow's four Core Behaviors, and flags weak spots.
 *
 * Usage:
 *   bun run agents/tutors/star.ts                  # start or resume coaching
 *   bun run agents/tutors/star.ts "let's work on behavior 2"
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/star-coach.md" with {
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
