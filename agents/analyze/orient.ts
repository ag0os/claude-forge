#!/usr/bin/env -S bun run

/**
 * ORIENT: Get oriented in your codebase with context-aware analysis
 *
 * This agent helps you understand your current project by analyzing:
 * - Project structure and key files
 * - Available commands and scripts
 * - Dependencies and technologies used
 * - Recent changes and git history
 * - TODO items and documentation
 *
 * Usage:
 *   bun run agents/orient.ts                 # Full orientation analysis
 *   bun run agents/orient.ts --quick         # Quick overview only
 *   bun run agents/orient.ts --focus <area>  # Focus on specific area (structure/commands/tech/changes)
 */

import { parseArgs } from "node:util";
import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import orientSettings from "../../settings/orient.settings.json" with {
	type: "json",
};
import orientSystemPrompt from "../../system-prompts/orient-prompt.md" with {
	type: "text",
};

function resolvePath(relativeFromThisFile: string): string {
	const url = new URL(relativeFromThisFile, import.meta.url);
	return url.pathname;
}

const projectRoot = resolvePath("../");

// Parse orient-specific arguments
const args = parseArgs({
	allowPositionals: true,
	options: {
		quick: {
			type: "boolean",
			short: "q",
			default: false,
		},
		focus: {
			type: "string",
			short: "f",
		},
		help: {
			type: "boolean",
			short: "h",
			default: false,
		},
	},
	strict: false, // Allow unknown arguments to pass through
});

function showHelp() {
	console.log(`
ORIENT: Get oriented in your codebase with context-aware analysis

Usage:
  bun run agents/orient.ts [options]

Options:
  -q, --quick          Quick overview only (skip detailed analysis)
  -f, --focus <area>   Focus on specific area:
                         structure - Project structure and file organization
                         commands  - Available scripts and commands
                         tech      - Technologies and dependencies
                         changes   - Recent changes and git history
  -h, --help           Show this help message

Examples:
  bun run agents/orient.ts                    # Full orientation
  bun run agents/orient.ts --quick           # Quick overview
  bun run agents/orient.ts --focus commands  # Focus on available commands
  bun run agents/orient.ts --focus tech      # Focus on tech stack

Notes:
  This agent analyzes your current project directory and provides
  a comprehensive orientation to help you understand the codebase.
`);
}

async function main() {
	if (args.values.help) {
		showHelp();
		process.exit(0);
	}

	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	// Build the orientation prompt based on options
	const orientationTasks = [];

	if (args.values.quick) {
		orientationTasks.push(
			"Provide a quick overview of this project in 2-3 paragraphs",
		);
	} else if (args.values.focus) {
		const focusArea = args.values.focus;
		switch (focusArea) {
			case "structure":
				orientationTasks.push(
					"Analyze the project structure and file organization",
				);
				orientationTasks.push("Identify key directories and their purposes");
				orientationTasks.push("Find the main entry points");
				break;
			case "commands":
				orientationTasks.push("List all available commands and scripts");
				orientationTasks.push("Explain what each command does");
				orientationTasks.push("Identify development, build, and test commands");
				break;
			case "tech":
				orientationTasks.push("Identify all technologies and frameworks used");
				orientationTasks.push("List key dependencies and their purposes");
				orientationTasks.push("Analyze the tech stack and architecture");
				break;
			case "changes":
				orientationTasks.push("Show recent git commits");
				orientationTasks.push("Identify areas of active development");
				orientationTasks.push("Find any TODO items or incomplete features");
				break;
			default:
				console.error(`Unknown focus area: ${focusArea}`);
				console.log("Valid areas: structure, commands, tech, changes");
				process.exit(1);
		}
	} else {
		// Full orientation
		orientationTasks.push(
			"Provide a comprehensive orientation of this project",
		);
		orientationTasks.push(
			"Include project structure, available commands, tech stack, and recent changes",
		);
		orientationTasks.push("Identify any patterns or conventions used");
		orientationTasks.push("Note any important configuration files");
	}

	// Combine tasks with user prompt if provided
	const fullPrompt =
		orientationTasks.join(". ") +
		(userPrompt ? `\n\nAdditional context: ${userPrompt}` : "");

	// Merge user-provided flags with our defaults
	const flags = buildClaudeFlags(
		{
			"append-system-prompt": orientSystemPrompt,
			settings: JSON.stringify(orientSettings),
		},
		parsedArgs.values as ClaudeFlags,
	);
	const finalArgs = fullPrompt ? [...flags, fullPrompt] : [...flags];

	const exitCode = await spawnClaudeAndWait({
		args: finalArgs,
		env: { CLAUDE_PROJECT_DIR: projectRoot },
	});

	process.exit(exitCode);
}

await main();
