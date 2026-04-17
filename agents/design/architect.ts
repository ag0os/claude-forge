#!/usr/bin/env -S bun run

/**
 * DESIGN:ARCHITECT — Collaborative system design partner
 *
 * Peer-level collaborator for designing new systems or expanding
 * existing ones. Discusses trade-offs, proposes architectures, and
 * reaches for the web when its knowledge may be stale. Persists
 * decisions as ADRs under `.design/`.
 *
 * Usage:
 *   bun run agents/design/architect.ts              # start or resume
 *   bun run agents/design/architect.ts "help me design an ingestion pipeline"
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import architectSystemPrompt from "../../system-prompts/design-architect.md" with {
	type: "text",
};

const architectSettings = {
	permissions: {
		defaultMode: "default",
		allow: ["WebSearch", "WebFetch"],
	},
};

const architectMcp = {
	mcpServers: {},
};

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": architectSystemPrompt,
			settings: JSON.stringify(architectSettings),
			"mcp-config": JSON.stringify(architectMcp),
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
