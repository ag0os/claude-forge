#!/usr/bin/env -S bun run

/**
 * PR-REVIEW: Code review a pull request for bugs and guideline compliance
 *
 * Uses parallel subagents to review for:
 * - Bugs and logic errors
 * - Security issues
 * - Project guideline compliance (CLAUDE.md, CONTRIBUTING.md, etc.)
 *
 * Usage:
 *   bun run agents/review/pr.ts <PR_URL_OR_NUMBER>
 *   bun run agents/review/pr.ts 123
 *   bun run agents/review/pr.ts https://github.com/owner/repo/pull/123
 *   bun run agents/review/pr.ts 123 --comment  # Post summary if no issues found
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import prReviewSettings from "../../settings/pr-review.settings.json" with {
	type: "json",
};
import prReviewSystemPrompt from "../../system-prompts/pr-review-prompt.md" with {
	type: "text",
};

// Claude-specific guideline files
const GUIDELINE_FILES = ["CLAUDE.md", "AGENTS.md"];

function buildReviewPrompt(prRef: string, postComment: boolean): string {
	const guidelineFilesStr = GUIDELINE_FILES.map((f) => `- ${f}`).join("\n");

	return `Provide a code review for pull request: ${prRef}

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error. Do not test tools or make exploratory calls.
- Only call a tool if it is required to complete the task. Every tool call should have a clear purpose.

Follow these steps precisely:

## Step 1: Pre-flight checks

Launch a haiku agent to check if any of the following are true:
- The pull request is closed
- The pull request is a draft
- The pull request does not need code review (e.g., automated PR, trivial change that is obviously correct)
- A code review comment has already been posted on this PR (check \`gh pr view <PR> --comments\`)

If any condition is true, stop and do not proceed. Still review AI-generated PRs.

## Step 2: Find project guidelines

Launch a haiku agent to return a list of file paths (not contents) for all relevant project guideline files including:
- Root-level guideline files if they exist
- Any guideline files in directories containing files modified by the pull request

Guideline files to look for:
${guidelineFilesStr}

## Step 3: Summarize changes

Launch a sonnet agent to view the pull request and return a summary of the changes.

## Step 4: Parallel review

Launch 4 agents in parallel to independently review the changes. Each agent should return a list of issues, where each issue includes a description and the reason it was flagged.

**Agents 1 + 2: Guideline compliance (sonnet agents)**
Audit changes for project guideline compliance in parallel. Only consider guideline files that share a file path with the changed file or its parents.

**Agent 3: Bug detection (opus agent)**
Scan for obvious bugs. Focus only on the diff itself without reading extra context. Flag only significant bugs; ignore nitpicks and likely false positives. Do not flag issues that cannot be validated without context outside the git diff.

**Agent 4: Code quality (opus agent)**
Look for problems in the introduced code: security issues, incorrect logic, etc. Only look for issues within the changed code.

**CRITICAL: HIGH SIGNAL ONLY.** Flag issues where:
- Code will fail to compile or parse (syntax errors, type errors, missing imports, unresolved references)
- Code will definitely produce wrong results regardless of inputs (clear logic errors)
- Clear, unambiguous guideline violations where you can quote the exact rule being broken
- Security vulnerabilities in the changed code

Do NOT flag:
- Code style or quality concerns (unless required in guidelines)
- Potential issues that depend on specific inputs or state
- Subjective suggestions or improvements
- Pre-existing issues not introduced by this PR
- Issues a linter would catch
- General concerns unless required in project guidelines

Each subagent should receive the PR title and description for context.

## Step 5: Validate issues

For each issue found in step 4 by bug/code quality agents (agents 3 and 4), launch parallel subagents to validate the issue. The agent's job is to verify that the stated issue is truly an issue with high confidence.

Use opus subagents for bugs and logic issues, sonnet agents for guideline violations.

## Step 6: Filter issues

Filter out any issues that were not validated in step 5. This gives the final list of high signal issues.

## Step 7: Post results

${
	postComment
		? `If NO issues were found, post a summary comment using \`gh pr comment\`:
"No issues found. Checked for bugs and project guideline compliance."`
		: "If NO issues were found, report this to the user but do not post a comment."
}

If issues WERE found, skip to step 8.

## Step 8: Post inline comments

Create a list of all comments you plan to post (internal only, for verification).

For each issue, post an inline review comment on the PR using the GitHub API:

\`\`\`bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \\
  -f body="Your comment here" \\
  -f commit_id="FULL_COMMIT_SHA" \\
  -f path="path/to/file.ext" \\
  -F line=42
\`\`\`

For each comment:
- Provide a brief description of the issue
- For small, self-contained fixes: include a committable suggestion block in the body
- For larger fixes (6+ lines, structural changes, multi-location): describe without suggestion block
- Never post a committable suggestion unless committing it fixes the issue entirely
- Link to the relevant guideline file if applicable

Suggestion block format (in comment body):
\`\`\`suggestion
corrected code here
\`\`\`

**IMPORTANT: Only post ONE comment per unique issue. Do not post duplicates.**

## Link Format

When linking to code in inline comments, use this format precisely:
\`https://github.com/OWNER/REPO/blob/FULL_SHA/path/to/file.ext#L10-L15\`

Requirements:
- Use full git sha (not HEAD or branch name)
- Line range format is L[start]-L[end]
- Provide at least 1 line of context before and after

## False Positive List

Do NOT flag these (they are false positives):
- Pre-existing issues
- Something that appears buggy but is actually correct
- Pedantic nitpicks a senior engineer would not flag
- Issues a linter will catch
- General code quality concerns unless required in guidelines
- Issues silenced via lint ignore comments`;
}

async function main() {
	const positionals = getPositionals();
	const prRef = positionals[0];

	if (!prRef) {
		console.error("Usage: pr-review <PR_URL_OR_NUMBER>");
		console.error("Examples:");
		console.error("  pr-review 123");
		console.error("  pr-review https://github.com/owner/repo/pull/123");
		process.exit(1);
	}

	// Check for --comment flag
	const postComment = parsedArgs.values.comment === true;

	const prompt = buildReviewPrompt(prRef, postComment);

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": prReviewSystemPrompt,
			settings: JSON.stringify(prReviewSettings),
		},
		parsedArgs.values as ClaudeFlags,
	);

	const args = [...flags, prompt];

	const exitCode = await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: process.cwd() },
	});

	process.exit(exitCode);
}

await main();
