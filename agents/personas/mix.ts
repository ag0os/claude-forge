#!/usr/bin/env -S bun run
import { parseArgs } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getClaudeExecutablePath } from "../../lib/claude";
import systemPrompt from "../../prompts/claude-mix.md" with { type: "text" };

const args = parseArgs({
	allowPositionals: true,
});

const userPrompt = args.positionals[0];

if (!userPrompt) {
	console.error("Usage: bun run agents/claude-mix.ts <prompt>");
	process.exit(1);
}

try {
	const claudePath = await getClaudeExecutablePath();

	const response = query({
		prompt: userPrompt,
		options: {
			systemPrompt: systemPrompt,
			mcpServers: {},
			tools: ["Bash(repomix:*)"],
			pathToClaudeCodeExecutable: claudePath,
		},
	});

	for await (const chunk of response) {
		if (
			chunk.type === "assistant" &&
			chunk.message.content[0]?.type === "text"
		) {
			process.stdout.write(chunk.message.content[0].text);
		} else {
			process.stderr.write(JSON.stringify(chunk, null, 2));
		}
	}
} catch (error) {
	console.error(
		"\nError during agent execution:",
		error instanceof Error ? error.message : String(error),
	);
	process.exit(1);
}
