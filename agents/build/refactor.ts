#!/usr/bin/env -S bun run

/**
 * REFACTOR: Launch Claude with a refactor partner system prompt appended
 *
 * - Imports the markdown prompt so it is bundled at compile time
 * - Passes it via --append-system-prompt
 *
 * Usage:
 *   bun run agents/refactor.ts "<your refactor task>"
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import refactorMcp from "../../settings/refactor.mcp.json" with {
	type: "json",
};
import refactorSettings from "../../settings/refactor.settings.json" with {
	type: "json",
};
import refactorSystemPrompt from "../../system-prompts/refactor-prompt.md" with {
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
			"append-system-prompt": refactorSystemPrompt,
			settings: JSON.stringify(refactorSettings),
			"mcp-config": JSON.stringify(refactorMcp),
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
