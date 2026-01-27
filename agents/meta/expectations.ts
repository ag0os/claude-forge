#!/usr/bin/env -S bun run

/**
 * EXPECTATIONS: Launch Claude with the prompts/expectations.md system prompt
 *
 * Usage:
 *   bun run agents/expectations.ts                 # interactive
 *   bun run agents/expectations.ts "<your prompt>"  # with initial user prompt
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import expectationsPrompt from "../../prompts/expectations.md" with {
	type: "text",
};

function resolvePath(relativeFromThisFile: string): string {
	const url = new URL(relativeFromThisFile, import.meta.url);
	return url.pathname;
}

const projectRoot = resolvePath("../");

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	// Merge user-provided flags with our defaults
	const flags = buildClaudeFlags(
		{
			"append-system-prompt": expectationsPrompt,
		},
		parsedArgs.values as ClaudeFlags,
	);
	const args = userPrompt ? [...flags, userPrompt] : [...flags];

	const exitCode = await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: projectRoot },
	});

	process.exit(exitCode);
}

await main();
