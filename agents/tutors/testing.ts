#!/usr/bin/env -S bun run

/**
 * TESTING: TDD, BDD, and test craft coach
 *
 * Trains test-first discipline in Ruby (RSpec, Minitest) or TypeScript
 * (Vitest, Jest, Playwright). Three modes: kata (TDD drill),
 * review (critique existing tests), theory (concept walkthroughs).
 *
 * Usage:
 *   bun run agents/tutors/testing.ts                  # start or resume
 *   bun run agents/tutors/testing.ts "ruby kata"      # with initial message
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/testing.md" with {
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
