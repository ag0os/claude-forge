#!/usr/bin/env -S bun run

/**
 * BUILDER: Launch Claude with a build partner system prompt appended
 *
 * - Imports the markdown prompt so it is bundled at compile time
 * - Passes it via --append-system-prompt
 *
 * Usage:
 *   bun run agents/builder.ts "<your build task>"
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import builderMcp from "../../settings/builder.mcp.json" with { type: "json" };
import builderSettings from "../../settings/builder.settings.json" with {
	type: "json",
};
import builderSystemPrompt from "../../system-prompts/builder-prompt.md" with {
	type: "text",
};

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	// Merge user-provided flags with our defaults
	const flags = buildClaudeFlags(
		{
			"append-system-prompt": builderSystemPrompt,
			settings: JSON.stringify(builderSettings),
			"mcp-config": JSON.stringify(builderMcp),
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
