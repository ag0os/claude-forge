#!/usr/bin/env -S bun run
import { parseArgs } from "node:util";
import { GoogleGenAI } from "@google/genai";
import { $ } from "bun";
import { encoding_for_model } from "tiktoken";
import gitCommitCommandExample from "../../infer/examples/commands/git-commit.md" with {
	type: "text",
};
import hooksExample from "../../infer/examples/hooks/example-hooks.md" with {
	type: "text",
};
import { getClaudeProjectsPath } from "../../lib/claude";
import {
	readAllJsonlsAsText,
	readMostRecentJsonlAsText,
} from "../../lib/jsonl";

// Parse command line arguments
const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		mode: {
			type: "string",
			short: "m",
			default: "commands",
		},
		conversation: {
			type: "string",
			short: "c",
			default: "latest",
		},
		help: {
			type: "boolean",
			short: "h",
		},
		debug: {
			type: "boolean",
			short: "d",
		},
	},
	strict: true,
	allowPositionals: true,
});

// Show help if requested
if (values.help) {
	console.log(`
Usage: bun agents/infer.ts [options]

Options:
  -m, --mode <mode>             Inference mode: commands, hooks (default: commands)
  -c, --conversation <type>     Conversation scope: latest, all (default: latest)
  -h, --help                    Show this help message
  -d, --debug                   Enable debug output (shows token counts)

Examples:
  bun agents/infer.ts                           # Infer commands from latest conversation
  bun agents/infer.ts -m hooks                  # Infer hooks from latest conversation  
  bun agents/infer.ts -c all                    # Infer commands from all conversations
  bun agents/infer.ts -m hooks -c all          # Infer hooks from all conversations
`);
	process.exit(0);
}

// Get API key from 1Password
const apiKey = (
	await $`op item get "GEMINI_API_KEY_FREE" --fields credential --reveal`
		.quiet()
		.text()
).trim();

if (!apiKey) {
	console.error(
		"Failed to retrieve GEMINI_API_KEY from 1Password. Ensure 'op' is signed in and the item exists.",
	);
	process.exit(1);
}

const ai = new GoogleGenAI({
	apiKey,
});

// Get Claude project path
const projectPath = await getClaudeProjectsPath();

// Read conversation data based on flag
let result:
	| Awaited<ReturnType<typeof readMostRecentJsonlAsText>>
	| Awaited<ReturnType<typeof readAllJsonlsAsText>>
	| null = null;
if (values.conversation === "all") {
	result = await readAllJsonlsAsText(projectPath);
	if (!result) {
		console.error("No JSONL files found");
		process.exit(1);
	}
} else {
	result = await readMostRecentJsonlAsText(projectPath);
	if (!result) {
		console.error("No JSONL files found");
		process.exit(1);
	}
}

// Define system prompts for different modes
const systemPrompts = {
	commands: `
# Commands Extractor

You are given a JSONL that contains a conversation between a user and Claude Code.

## Steps
1. Read the JSONL file
2. Find where the user instructs Claude Code to take action
3. Extract the user's instructions into commands

## Example Commands

<example>
${gitCommitCommandExample}
</example>
`.trim(),

	hooks: `
# Hooks Extractor

You are given a JSONL that contains a conversation between a user and Claude Code.

## Steps
1. Read the JSONL file
2. Identify patterns where the user would benefit from automated hooks
3. Extract potential hooks based on their workflow patterns

## What to Look For
- Repetitive manual steps after certain actions (PostToolUse hooks)
- Security concerns or file access patterns (PreToolUse hooks)
- Quality control needs (formatting, linting, testing)
- Environment setup requirements
- Workflow automation opportunities

## Example Hooks Configuration

<example>
${
	hooksExample ||
	JSON.stringify(
		{
			hooks: {
				PostToolUse: [
					{
						matcher: "Edit",
						hooks: [
							{
								type: "command",
								command: "echo 'File edited - consider running formatter'",
							},
						],
					},
				],
				PreToolUse: [
					{
						matcher: "Read",
						hooks: [
							{
								type: "command",
								command:
									'jq -r \'if (.tool_input.file_path) | test("(\\\\.env|\\\\.pem|credentials)") then {"permissionDecision": "deny", "permissionDecisionReason": "Access to sensitive files blocked"} else {"permissionDecision": "allow"} end\'',
							},
						],
					},
				],
			},
		},
		null,
		2,
	)
}
</example>

## Output Format
Provide a complete hooks configuration object that could be added to .claude/settings.json
`.trim(),
};

// Select system prompt based on mode
const systemPrompt = systemPrompts[values.mode as keyof typeof systemPrompts];
if (!systemPrompt) {
	console.error(`Invalid mode: ${values.mode}. Use 'commands' or 'hooks'`);
	process.exit(1);
}

// Count tokens if debug is enabled
if (values.debug) {
	const encoder = encoding_for_model("gpt-4");
	const tokens = encoder.encode(result.text);
	console.log(`[DEBUG] Token count for conversation data: ${tokens.length}`);
	console.log(`[DEBUG] Mode: ${values.mode}`);
	console.log(`[DEBUG] Conversation scope: ${values.conversation}`);
	if (values.conversation === "all") {
		const filesCount =
			result && typeof result === "object" && "files" in result
				? (result as { files: unknown[] }).files.length
				: 0;
		console.log(`[DEBUG] Processing ${filesCount} conversation files`);
	}
	encoder.free();
}

// Generate content with Gemini
const response = await ai.models.generateContent({
	model: "gemini-2.5-pro",
	contents: [
		{
			role: "model",
			parts: [
				{
					text: systemPrompt,
				},
			],
		},
		{
			role: "user",
			parts: [
				{
					text: result.text,
				},
			],
		},
	],
});

const output = response.candidates?.[0]?.content?.parts?.[0]?.text;

console.log(output);
