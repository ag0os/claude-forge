#!/usr/bin/env -S bun run

/**
 * COMMENT-REVIEW: Review and fix newly added comments in the current branch
 *
 * Analyzes git diff to find new comments, evaluates them for quality,
 * and removes or improves comments that don't add lasting value.
 */

import { execSync } from "node:child_process";
import { buildClaudeFlags, spawnClaudeAndWait } from "../../lib";
import commentReviewSettings from "../../settings/comment-review.settings.json" with {
	type: "json",
};
import commentReviewPrompt from "../../system-prompts/comment-review-prompt.md" with {
	type: "text",
};

function getBaseBranch(): string {
	for (const branch of ["main", "master"]) {
		try {
			execSync(`git rev-parse --verify ${branch}`, { stdio: "ignore" });
			return branch;
		} catch {
			try {
				execSync(`git rev-parse --verify origin/${branch}`, {
					stdio: "ignore",
				});
				return `origin/${branch}`;
			} catch {}
		}
	}
	console.error("Could not find main or master branch");
	process.exit(1);
}

function getDiff(): string {
	const baseBranch = getBaseBranch();

	const committed = execSync(`git diff ${baseBranch}...HEAD`, {
		encoding: "utf-8",
	});
	const staged = execSync("git diff --cached", { encoding: "utf-8" });

	return `${committed}\n${staged}`;
}

async function main() {
	const diff = getDiff();

	if (!diff.trim()) {
		console.log("No changes found to review.");
		process.exit(0);
	}

	const prompt = `Review the following git diff for newly added comments. Focus only on lines starting with "+" that contain comment syntax (// or /* or # depending on language).

<diff>
${diff}
</diff>

Analyze these new comments. For any comments that should be removed or improved, edit the files directly to fix them.`;

	const flags = buildClaudeFlags({
		"append-system-prompt": commentReviewPrompt,
		settings: JSON.stringify(commentReviewSettings),
	});

	const exitCode = await spawnClaudeAndWait({
		args: [...flags, prompt],
		env: { CLAUDE_PROJECT_DIR: process.cwd() },
	});

	process.exit(exitCode);
}

await main();
