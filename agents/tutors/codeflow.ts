#!/usr/bin/env -S bun run

/**
 * CODEFLOW: React · TypeScript coaching tutor on Webflow's Codeflow shell
 *
 * Guides the student through a React/TS curriculum delivered as Codeflow
 * patterns (src/interviews/). Also runs on-demand interview simulations
 * that mimic Webflow's Round 2 fullstack coding interview — a broken app
 * the student inherits and must debug/refactor/extend in 60 minutes.
 *
 * Designed to run inside a clone of github.com/webflow/codeflow.
 *
 * Usage:
 *   bun run agents/tutors/codeflow.ts              # start or resume coaching
 *   bun run agents/tutors/codeflow.ts "let's go"   # with initial message
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/codeflow-coach.md" with {
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
