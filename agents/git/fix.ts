#!/usr/bin/env -S bun run

/**
 * FIX: Read PR review comments and fix the issues
 *
 * Fetches review comments from the current branch's PR and fixes any issues found.
 * Designed to run after review:pr in a forkhestra chain.
 *
 * Usage:
 *   bun run agents/git/fix.ts              # Auto-detect PR for current branch
 *   bun run agents/git/fix.ts 123          # Fix issues from PR #123
 *   git:fix                                # After compiling
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";

/**
 * Get the PR number for the current branch using gh CLI
 */
async function getCurrentBranchPR(): Promise<string | null> {
	const proc = Bun.spawn(
		["gh", "pr", "view", "--json", "number", "-q", ".number"],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		return null;
	}
	const output = await new Response(proc.stdout).text();
	return output.trim() || null;
}

function buildFixPrompt(prRef: string): string {
	return `Fix issues from PR review comments on pull request #${prRef}.

## Instructions

1. First, fetch the review comments from the PR using:
   \`gh api repos/{owner}/{repo}/pulls/${prRef}/comments\`

   Also check for general PR comments:
   \`gh pr view ${prRef} --comments\`

2. If there are no review comments or issues to fix, output "No issues to fix" and stop.

3. For each issue found in the comments:
   - Read the relevant file
   - Understand the issue described
   - Apply the fix
   - If a suggestion block is provided, apply it exactly

4. After fixing all issues, summarize what was fixed.

Do NOT commit the changes - leave them staged for review.`;
}

async function main() {
	const positionals = getPositionals();
	let prRef = positionals[0];

	// Auto-detect PR for current branch if no argument provided
	if (!prRef) {
		const detectedPR = await getCurrentBranchPR();
		if (!detectedPR) {
			console.error("No PR found for current branch.");
			console.error("Usage: git:fix [PR_NUMBER]");
			console.error("Examples:");
			console.error("  git:fix           # Auto-detect PR for current branch");
			console.error("  git:fix 123");
			process.exit(1);
		}
		console.log(`Detected PR #${detectedPR} for current branch`);
		prRef = detectedPR;
	}

	const prompt = buildFixPrompt(prRef);

	const flags = buildClaudeFlags({}, parsedArgs.values as ClaudeFlags);

	const args = [...flags, prompt];

	const exitCode = await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: process.cwd() },
	});

	process.exit(exitCode);
}

await main();
