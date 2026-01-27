#!/usr/bin/env -S bun run

/**
 * RIFF: Design exploration through code dialogue
 *
 * Based on Kasper Timm Hansen's "riffing" technique - using pseudo-code
 * as a dialogue with the problem to explore the organizational skeleton
 * before implementation.
 *
 * Usage:
 *   bun run agents/riff.ts                              # interactive mode
 *   bun run agents/riff.ts "add user gifting feature"   # with initial prompt
 *
 * The agent will:
 *   1. Detect your tech stack (or ask)
 *   2. Explore the problem through pseudo-code dialogue
 *   3. Surface design decisions, state requirements, and open questions
 *   4. Output a design brief for implementation
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import riffSystemPrompt from "../../system-prompts/riff-prompt.md" with {
	type: "text",
};

const riffSettings = {
	permissions: {
		defaultMode: "default",
		allow: [],
	},
};

const riffMcp = {
	mcpServers: {},
};

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": riffSystemPrompt,
			settings: JSON.stringify(riffSettings),
			"mcp-config": JSON.stringify(riffMcp),
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
