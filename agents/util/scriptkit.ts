#!/usr/bin/env bun

import os from "node:os";
import path from "node:path";
import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import { assetsFor } from "../../lib/assets";
import type { ClaudeFlags } from "../../lib/claude-flags.types";

const KENV_SCRIPTS_DIR = path.join(os.homedir(), ".kenv", "scripts");

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

// Build the user prompt
const userPrompt = `
## Location
Please generate the following script idea to:
${KENV_SCRIPTS_DIR}

## Add the original "Script Idea" as a multi-line comment at the top of the script so we can easily remember what the original idea was.

## Script Idea

${idea}
`;

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

	console.log(`\n✨ Script Kit generation session completed`);
	process.exit(exitCode);
}

main().catch(console.error);
