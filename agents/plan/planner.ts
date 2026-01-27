#!/usr/bin/env -S bun run

/**
 * PLANNER: Interactive implementation plan creator
 *
 * Creates high-level implementation plans through interactive requirements
 * gathering. Plans are consumed by coordinator agents (builder, plan-coordinator).
 *
 * Usage:
 *   bun run agents/planner.ts                    # interactive mode
 *   bun run agents/planner.ts "build a todo app" # with initial prompt
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import plannerSystemPrompt from "../../system-prompts/planner-prompt.md" with {
	type: "text",
};

const plannerSettings = {
	permissions: {
		defaultMode: "default",
		allow: [],
	},
};

const plannerMcp = {
	mcpServers: {},
};

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": plannerSystemPrompt,
			settings: JSON.stringify(plannerSettings),
			"mcp-config": JSON.stringify(plannerMcp),
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
