#!/usr/bin/env -S bun run
/**
 * DESIGN-AUDIT: Comprehensive design system/site styling audit
 *
 * Scans the current project for design-related constructs (tokens, variables,
 * themes, layouts, patterns, utilities, packages, and more) and writes a
 * navigable audit to ai/design-audit/ without changing app code.
 *
 * Usage:
 *   bun run agents/design-audit.ts            # full audit
 *   bun run agents/design-audit.ts "auth, marketing"  # optional focus filters
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import designAuditSettings from "../../settings/design-audit.settings.json" with {
	type: "json",
};
import designAuditSystemPrompt from "../../system-prompts/design-audit-prompt.md" with {
	type: "text",
};
import expectationsDoc from "../../system-prompts/expectations.md" with {
	type: "text",
};

const targetProject = process.cwd();
const auditDir = join(targetProject, "ai", "design-audit");

// Ensure output directory exists
try {
	mkdirSync(auditDir, { recursive: true });
	console.log(`✅ Created/verified directory: ${auditDir}`);
} catch (error) {
	console.error(`Failed to create audit directory: ${error}`);
}

// Optional free-form focus filter(s)
const positionals = getPositionals();
const focus = positionals.join(", ");

// Build the user task prompt (system prompt contains the persona/contract)
const userPrompt =
	`Conduct a comprehensive design system audit of the project at ${targetProject}.

Output directory: ${auditDir}

Instructions:
1. Examine all design-related constructs (tokens, variables, themes, layouts, utilities, components, packages).
2. Identify real file anchors for each finding (paths + line ranges + short snippets).
3. Write ONLY into ${auditDir} following the system prompt's output contract.
${focus ? `4. Prioritize focus areas: ${focus}.` : ""}`.trim();

async function main() {
	console.log("🔎 Starting design system audit...");
	console.log(`📁 Project: ${targetProject}`);
	console.log(`🗂️  Output: ${auditDir}`);

	// Merge user-provided flags with our defaults; append expectations for quality bar
	const flags = buildClaudeFlags(
		{
			"append-system-prompt": `${designAuditSystemPrompt}\n\n---\n\n[Expectations Quality Bar]\n\n${expectationsDoc}`,
			settings: JSON.stringify(designAuditSettings),
		},
		parsedArgs.values as ClaudeFlags,
	);

	const finalArgs = [...flags, userPrompt];

	const exitCode = await spawnClaudeAndWait({
		args: finalArgs,
		env: { CLAUDE_PROJECT_DIR: targetProject },
	});

	console.log("\n✨ Design audit complete!");
	console.log(`📁 Reports saved to: ${auditDir}`);
	process.exit(exitCode);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
