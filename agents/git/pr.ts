#!/usr/bin/env -S bun run

/**
 * PR: Create a pull request for the current branch
 *
 * Usage:
 *   bun run agents/git/pr.ts
 *   git:pr  # after compiling
 */

import { buildClaudeFlags, parsedArgs, spawnClaudeAndWait } from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";

const PROMPT = `Create a pull request for the current branch.

Use the gh CLI to create the PR. Follow the repository's PR conventions if any exist.`;

async function main() {
	const flags = buildClaudeFlags({}, parsedArgs.values as ClaudeFlags);

	const args = [...flags, PROMPT];

	const exitCode = await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: process.cwd() },
	});

	process.exit(exitCode);
}

await main();
