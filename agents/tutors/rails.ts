#!/usr/bin/env -S bun run

/**
 * RAILS: Ruby on Rails memory & idiom coach
 *
 * Refresher tutor for a fluent-but-rusty Rails engineer. Not a course —
 * drills cold recall, catches AI-written non-idiomatic Rails, restores
 * muscle memory that faded after heavy agent-assisted coding.
 *
 * Three modes: drill (write Rails from memory), theory (surface refresh
 * on demand), review (paste code — often AI-generated — for idiom critique).
 *
 * Usage:
 *   bun run agents/tutors/rails.ts                 # start or resume
 *   bun run agents/tutors/rails.ts "drill"         # with initial message
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/rails.md" with {
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
