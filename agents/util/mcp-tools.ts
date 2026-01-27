#!/usr/bin/env -S bun run
import { parseArgs } from "node:util";
import { $ } from "bun";

interface ToolProperty {
	type: string;
	description: string;
}

interface ToolInputSchema {
	type: "object";
	properties: Record<string, ToolProperty>;
	required: string[];
	additionalProperties: boolean;
	$schema: string;
}

interface Tool {
	name: string;
	description: string;
	inputSchema: ToolInputSchema;
}

interface ToolsResponse {
	tools: Tool[];
}

const parsedArgs = parseArgs({
	allowPositionals: true,
	options: {
		token: {
			type: "string",
			short: "t",
		},
	},
});

const mcp = parsedArgs.positionals[0];
const token = parsedArgs.values.token;

if (!mcp) {
	console.error("No MCP provided");
	console.log(`Usage: bun list-mcp-tools <mcp-url> [--token <auth-token>]`);
	console.log(`Common examples:
list-mcp-tools https://mcp.deepwiki.com/sse       
list-mcp-tools https://api.githubcopilot.com/mcp --token "Bearer ghu_xxxx"
        `);
	process.exit(1);
}

async function fetchMCPToolsDirectly(url: string, authToken?: string) {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};

	if (authToken) {
		headers.Authorization = authToken;
	}

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			method: "tools/list",
			params: {},
			id: 1,
		}),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const data = (await response.json()) as {
		result?: ToolsResponse;
		error?: { message?: string };
	};

	if (data.error) {
		throw new Error(`MCP Error: ${data.error.message ?? "Unknown error"}`);
	}

	return (data.result ?? { tools: [] }) as ToolsResponse;
}

let response: ToolsResponse;

try {
	// First try using the CLI (works for SSE and unauthenticated endpoints)
	if (!token) {
		response =
			await $`npx --yes @modelcontextprotocol/inspector --cli "${mcp}" --method tools/list`.json();
	} else {
		// If token provided, skip CLI and use direct fetch
		throw new Error("Token provided, using direct fetch");
	}
} catch (_error) {
	// If CLI fails or token is provided, try direct HTTP POST
	try {
		response = await fetchMCPToolsDirectly(mcp, token);
	} catch (fetchError) {
		console.error("Failed to fetch tools:", fetchError);
		if (fetchError instanceof Error && fetchError.message.includes("401")) {
			console.log("\nFor authenticated endpoints, provide a token:");
			console.log('Example: --token "Bearer your_token_here"');
		}
		process.exit(1);
	}
}

const toolDescriptions = response.tools.map((tool) => {
	return {
		name: tool.name,
		description: tool.description,
	};
});

console.log("Tools found:", response.tools.length);
console.log("\nTool Descriptions:");
console.log(JSON.stringify(toolDescriptions, null, 2));

console.log("\nTool Names:");
console.log(response.tools.map((tool) => tool.name));
