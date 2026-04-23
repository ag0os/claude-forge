#!/usr/bin/env -S bun run

/**
 * COACH CODING: coding sparring partner for interview prep
 *
 * Runs challenges or theory in Ruby OR TypeScript (student picks at
 * session start). Challenge-first: problem given, student attempts,
 * debrief afterwards. Trains against the student's top weak spot:
 * blocking under pressure and AI-reach reflex.
 *
 * Reads an optional session brief from .coach/sessions/ produced by
 * tutors:coach-coordinator. Appends session summaries to
 * .coach/progress.md under its own section.
 *
 * Usage:
 *   bun run agents/tutors/coach-coding.ts                # start session
 *   bun run agents/tutors/coach-coding.ts "ruby"         # with initial message
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/coach-coding.md" with {
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
