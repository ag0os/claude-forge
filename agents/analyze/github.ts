#!/usr/bin/env -S bun run
import { parseArgs } from "node:util";
import { type McpServerConfig, query } from "@anthropic-ai/claude-agent-sdk";
import { $ } from "bun";
import { getClaudeExecutablePath } from "../../lib/claude";
import systemPrompt from "../../prompts/github-examples.md" with {
	type: "text",
};

const args = parseArgs({
	allowPositionals: true,
});

const userPrompt = args.positionals[0];

if (!userPrompt) {
	console.error(
		"Usage: bun run agents/github-examples.ts <code snippet or description>",
	);
	process.exit(1);
}

// Get GitHub token from 1Password with session management
const getGitHubToken = async () => {
	try {
		// First, ensure we're signed in with biometric unlock
		// This will prompt for fingerprint/TouchID only once per session
		await $`op signin --raw`.quiet();

		// Now get the token
		const result =
			await $`op item get "Github CLI Token" --fields password --reveal`.quiet();
		if (!result) {
			console.error("Failed to retrieve GitHub token from 1Password");
			process.exit(1);
		}
		return result.text().trim();
	} catch (error: unknown) {
		console.error(
			"Failed to retrieve GitHub token from 1Password:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
};

// Explicit allowlist of tools - cleaner than maintaining a huge disallowedTools list
const allowedTools = [
	"Write",
	"mcp__github__search_code",
	"mcp__github__search_issues",
	"mcp__github__search_orgs",
	"mcp__github__search_pull_requests",
	"mcp__github__search_repositories",
	"mcp__github__get_file_contents",
];

const githubToken = await getGitHubToken();

if (!githubToken) {
	console.error("Failed to retrieve GitHub token from 1Password");
	process.exit(1);
}

const mcpServers: Record<string, McpServerConfig> = {
	github: {
		url: "https://api.githubcopilot.com/mcp/",
		headers: {
			Authorization: `Bearer ${githubToken}`,
		},
		type: "http",
	},
};

try {
	const claudePath = await getClaudeExecutablePath();

	const response = query({
		prompt: userPrompt,
		options: {
			pathToClaudeCodeExecutable: claudePath,
			systemPrompt: systemPrompt,
			tools: allowedTools,
			mcpServers,
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
