#!/usr/bin/env -S bun run

/**
 * DESIGNER: Launch Claude with a design partner system prompt appended
 *
 * - Imports the markdown prompt so it is bundled at compile time
 * - Passes it via --append-system-prompt
 *
 * Usage:
 *   bun run agents/designer.ts "<your design task>"
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import designerMcp from "../../settings/designer.mcp.json" with {
	type: "json",
};
import designerSettings from "../../settings/designer.settings.json" with {
	type: "json",
};
import designerSystemPrompt from "../../system-prompts/designer-prompt.md" with {
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
			"append-system-prompt": designerSystemPrompt,
			settings: JSON.stringify(designerSettings),
			"mcp-config": JSON.stringify(designerMcp),
			model: "sonnet",
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
