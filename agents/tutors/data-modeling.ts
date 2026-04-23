#!/usr/bin/env -S bun run

/**
 * DATA MODELING: SQL + document database coach
 *
 * Covers relational (Postgres-leaning) and document (MongoDB-leaning)
 * databases in one tutor because the highest-value skill is knowing
 * which-when. Three modes: drill (write queries/schemas), theory
 * (concept walkthroughs), discuss (scenario-based which-fits).
 *
 * Usage:
 *   bun run agents/tutors/data-modeling.ts                  # start or resume
 *   bun run agents/tutors/data-modeling.ts "sql drill"      # with initial message
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/data-modeling.md" with {
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
