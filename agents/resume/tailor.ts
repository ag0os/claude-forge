#!/usr/bin/env -S bun run

/**
 * RESUME:TAILOR — Resume tailoring assistant
 *
 * Runs a short intake conversation, analyzes an existing `.typ` resume file,
 * produces a version tailored to a specific role, and compiles it to PDF
 * with the Typst CLI. No candidate data is hardcoded — everything comes from
 * the input file provided at session start.
 *
 * Usage:
 *   bun run agents/resume/tailor.ts                          # start
 *   bun run agents/resume/tailor.ts "tailor ./resume.typ"    # with a message
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import tailorSystemPrompt from "../../system-prompts/resume-tailor.md" with {
	type: "text",
};

const tailorSettings = {
	permissions: {
		defaultMode: "default",
		allow: ["Read", "Write", "Edit", "Glob", "Bash(typst:*)"],
	},
};

const tailorMcp = {
	mcpServers: {},
};

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": tailorSystemPrompt,
			settings: JSON.stringify(tailorSettings),
			"mcp-config": JSON.stringify(tailorMcp),
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
