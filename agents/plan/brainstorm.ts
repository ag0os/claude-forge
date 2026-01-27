#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import { assetsFor } from "../../lib/assets";
import type { ClaudeFlags } from "../../lib/claude-flags.types";

function resolvePath(relativeFromThisFile: string): string {
	const url = new URL(relativeFromThisFile, import.meta.url);
	return url.pathname;
}

const projectRoot = resolvePath("../");

// Read user's idea from args
const positionals = getPositionals();
const idea = positionals.join(" ");

if (!idea) {
	console.error("Please provide an idea to brainstorm about");
	console.error("Usage: brainstorm 'your idea here'");
	process.exit(1);
}

// Create temporary file for the brainstorming session
const tempFile = join(tmpdir(), `brainstorm-${Date.now()}.md`);
const initialContent = `# AI Agent Brainstorming Session

## Your Idea:
${idea}

## Instructions:
I will generate 5 different AI agent variations based on your idea. Each will have:
- A unique name and purpose
- Key capabilities and tools
- Use cases and examples
- Implementation approach

After I present the options, you can select one to develop further.

---

`;

writeFileSync(tempFile, initialContent);

// Build the user prompt
const userPrompt = `Please brainstorm 5 different AI agent variations based on this idea:

"${idea}"

Present them in a clear, numbered format and then ask which one I'd like to explore further.`;

async function main() {
	// Build Claude flags
	const { systemPrompt, settings } = assetsFor(import.meta.url);
	const defaults: ClaudeFlags = {
		...(systemPrompt ? { "append-system-prompt": systemPrompt } : {}),
		...(settings ? { settings: JSON.stringify(settings) } : {}),
	};

	const flags = buildClaudeFlags(defaults, parsedArgs.values as ClaudeFlags);

	// Add the prompt as positional argument
	const finalArgs = userPrompt ? [...flags, userPrompt] : [...flags];

	// Spawn Claude with brainstorm settings
	const exitCode = await spawnClaudeAndWait({
		args: finalArgs,
		env: { CLAUDE_PROJECT_DIR: projectRoot },
	});

	console.log(`\n✨ Brainstorming session saved to: ${tempFile}`);
	process.exit(exitCode);
}

main().catch(console.error);
