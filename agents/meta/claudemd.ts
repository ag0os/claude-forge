#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	buildClaudeFlags,
	getPositionals,
	spawnClaudeAndWait,
} from "../../lib";
import updateClaudeMdMcp from "../../settings/update-claudemd.mcp.json" with {
	type: "json",
};
import updateClaudeMdSettings from "../../settings/update-claudemd.settings.json" with {
	type: "json",
};
import updateClaudeMdSystemPrompt from "../../system-prompts/update-claudemd-prompt.md" with {
	type: "text",
};

// Get the current working directory
const projectDir = process.cwd();
const claudeMdPath = join(projectDir, "CLAUDE.md");

// Check if CLAUDE.md exists
if (!existsSync(claudeMdPath)) {
	console.log(
		"📝 No CLAUDE.md found in current directory. Creating initial version...",
	);
}

// Build the initial prompt based on whether we're creating or updating
const action = existsSync(claudeMdPath) ? "update" : "create";
const userPrompt =
	action === "update"
		? `Please review and update the CLAUDE.md file in this project. Follow these steps:

1. Analyze the current CLAUDE.md for outdated information, redundancy, or missing sections
2. Scan the codebase for new patterns, commands, or important context
3. Update the file following best practices:
   - Keep it lean and concise
   - Use clear section headings
   - Focus on essential information
   - Remove outdated content
   - Add any new important commands or patterns
4. Explain what changes you made and why

Start by reading the current CLAUDE.md and analyzing the project structure.`
		: `Please create an initial CLAUDE.md file for this project. Follow these steps:

1. Scan the codebase to understand the project structure and technology stack
2. Identify key commands, build processes, and development workflows
3. Note any important patterns, conventions, or architectural decisions
4. Create a well-structured CLAUDE.md following best practices:
   - Project overview
   - Essential commands
   - Code architecture
   - Development workflow
   - Code style guidelines
   - Important notes
5. Keep it concise but comprehensive

Start by analyzing the project structure and key files.`;

// Parse any additional arguments as specific update requests
const positionals = getPositionals();
const specificRequest = positionals.join(" ");
const finalPrompt = specificRequest
	? `${userPrompt}\n\nAdditional specific request: ${specificRequest}`
	: userPrompt;

async function main() {
	// Build Claude flags
	const flags = buildClaudeFlags({
		settings: JSON.stringify(updateClaudeMdSettings),
		"mcp-config": JSON.stringify(updateClaudeMdMcp),
		"append-system-prompt": updateClaudeMdSystemPrompt,
	});

	// Add the prompt as positional argument
	const args = [...flags, finalPrompt];

	// Spawn Claude with update-claudemd settings
	const exitCode = await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: projectDir },
	});

	console.log(`\n✅ CLAUDE.md maintenance session completed`);
	process.exit(exitCode);
}

main().catch(console.error);
