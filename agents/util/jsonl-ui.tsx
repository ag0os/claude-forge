#!/usr/bin/env -S bun run
/**
 * JSONL FORMATTER: Demonstrates various ways to format and extract data from Claude's JSONL output
 *
 * This agent showcases 12 different jq recipes for processing Claude's JSONL stream output,
 * including human-readable summaries, tool analysis, cost tracking, and more.
 *
 * Usage:
 *   bun run agents/jsonl-formatter.ts ["your prompt"] [--recipe=<recipe_number>]
 *
 * Examples:
 *   bun run agents/jsonl-formatter.ts "hello world" --recipe=1    # Get assistant's text reply
 *   bun run agents/jsonl-formatter.ts "hello world" --recipe=2    # Session summary
 *   bun run agents/jsonl-formatter.ts "hello world" --recipe=3    # MCP servers table
 *   bun run agents/jsonl-formatter.ts "hello world"               # Show all recipes
 */

import { parseArgs } from "node:util";
import { spawn } from "bun";
import { Box, render, Text } from "ink";
import { useEffect, useState } from "react";
import { buildClaudeFlags, parsedArgs } from "../../lib/flags";

// Parse our agent-specific arguments, ignoring claude-specific ones
const args = parseArgs({
	allowPositionals: true,
	options: {
		recipe: {
			type: "string",
			short: "r",
			default: "all",
		},
		verbose: {
			type: "boolean",
			short: "v",
			default: false,
		},
		help: {
			type: "boolean",
			short: "h",
			default: false,
		},
	},
	strict: false, // Allow unknown arguments to pass through
});

const userPrompt =
	args.positionals[0] || "Explain what JSONL formatting recipes are available";
const formatOption = args.values.recipe;
const verbose = args.values.verbose;
const help = args.values.help;

// React Components
const Help = () => (
	<Box flexDirection="column" padding={1}>
		<Text bold color="cyan">
			🚀 JSONL Formatter Agent
		</Text>
		<Text dimColor>
			━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		</Text>
		<Box height={1} />

		<Text bold color="yellow">
			DESCRIPTION:
		</Text>
		<Text>
			{" "}
			Demonstrates various ways to format and extract data from{" "}
			<Text color="cyan">Claude's JSONL output</Text>
		</Text>
		<Text>
			{" "}
			using <Text color="green">jq filters</Text>. Showcases{" "}
			<Text color="magenta">8 different recipes</Text> for processing Claude's
			JSONL
		</Text>
		<Text>
			{" "}
			stream output, including human-readable summaries, tool analysis, cost
			tracking,
		</Text>
		<Text> and more.</Text>
		<Box height={1} />

		<Text bold color="yellow">
			USAGE:
		</Text>
		<Text>
			{" "}
			<Text color="cyan">bun run agents/jsonl-formatter.ts</Text> [prompt]
			[options]
		</Text>
		<Text>
			{" "}
			<Text color="cyan">./bin/jsonl-formatter</Text> [prompt] [options]
		</Text>
		<Box height={1} />

		<Text bold color="yellow">
			ARGUMENTS:
		</Text>
		<Text>
			{" "}
			<Text color="green">prompt</Text> Your prompt to send to Claude (optional)
		</Text>
		<Box height={1} />

		<Text bold color="yellow">
			OPTIONS:
		</Text>
		<Text>
			{" "}
			<Text color="green">-r, --recipe &lt;number&gt;</Text> Run specific recipe
			(1, 2, 3, 4, 5, 7, 8, 12) or 'all'
		</Text>
		<Text>
			{" "}
			<Text color="green">-v, --verbose</Text> Enable verbose output (shows raw
			JSONL data)
		</Text>
		<Text>
			{" "}
			<Text color="green">-h, --help</Text> Show this help message
		</Text>
		<Box height={1} />

		<Text bold color="yellow">
			EXAMPLES:
		</Text>
		<Text dimColor> # Run all recipes with a prompt</Text>
		<Text>
			{" "}
			<Text color="cyan">./bin/jsonl-formatter</Text> "hello world"
		</Text>
		<Box height={1} />
		<Text dimColor> # Run specific recipe</Text>
		<Text>
			{" "}
			<Text color="cyan">./bin/jsonl-formatter</Text> "explain quantum
			computing" <Text color="green">--recipe=1</Text>
		</Text>
		<Text>
			{" "}
			<Text color="cyan">./bin/jsonl-formatter</Text> "what's the weather?"{" "}
			<Text color="green">-r 3</Text>
		</Text>
		<Box height={1} />
		<Text dimColor> # Run with verbose output to see raw JSONL data</Text>
		<Text>
			{" "}
			<Text color="cyan">./bin/jsonl-formatter</Text> "test prompt"{" "}
			<Text color="green">--verbose --recipe=2</Text>
		</Text>
		<Box height={1} />
		<Text dimColor> # Get help</Text>
		<Text>
			{" "}
			<Text color="cyan">./bin/jsonl-formatter</Text>{" "}
			<Text color="green">--help</Text>
		</Text>
		<Box height={1} />

		<Text bold color="yellow">
			AVAILABLE RECIPES:
		</Text>
		<Text>
			{" "}
			<Text color="magenta">1:</Text> Assistant's Text Reply - Extract the
			assistant's text response (raw)
		</Text>
		<Text>
			{" "}
			<Text color="magenta">2:</Text> Session Summary - Summarize session,
			models, token totals, and cost
		</Text>
		<Text>
			{" "}
			<Text color="magenta">3:</Text> MCP Servers Table - Turn MCP server
			statuses into a Markdown table
		</Text>
		<Text>
			{" "}
			<Text color="magenta">4:</Text> Tool Counts - Count tools and slash
			commands
		</Text>
		<Text>
			{" "}
			<Text color="magenta">5:</Text> Tools by Origin - Tools grouped by origin
			(core vs MCP providers)
		</Text>
		<Text>
			{" "}
			<Text color="magenta">7:</Text> Timeline Summary - Human-readable one-line
			summary per event
		</Text>
		<Text>
			{" "}
			<Text color="magenta">8:</Text> Duration Analysis - Convert durations to
			seconds with service tier info
		</Text>
		<Text>
			{" "}
			<Text color="magenta">12:</Text> Human Sentence - Emit a single
			human-readable sentence
		</Text>
		<Box height={1} />

		<Text bold color="yellow">
			NOTES:
		</Text>
		<Text>
			{" "}
			<Text dimColor>•</Text> Pass-through arguments: Any unrecognized arguments
			are passed to the claude command
		</Text>
		<Text>
			{" "}
			<Text dimColor>•</Text> Default prompt: If no prompt is provided, uses a
			default about JSONL formatting
		</Text>
		<Text>
			{" "}
			<Text dimColor>•</Text> Output formats: Some recipes produce raw text,
			others produce formatted JSON
		</Text>
	</Box>
);

interface Recipe {
	name: string;
	description: string;
	jqFilter: string;
	outputFormat: "raw" | "json";
}

const recipes: Record<string, Recipe> = {
	"1": {
		name: "Assistant's Text Reply",
		description: "Extract the assistant's text response (raw)",
		jqFilter:
			'.[] | select(.type=="assistant") | .message.content[] | select(.type=="text") | .text',
		outputFormat: "raw",
	},
	"2": {
		name: "Session Summary",
		description: "Summarize session, models, token totals, and cost",
		jqFilter: `{
  session_id: (map(.session_id) | unique | first),
  models: (map(.model // .message?.model // empty) | unique),
  turns: length,
  input_tokens: (map(.message?.usage?.input_tokens // .usage?.input_tokens // 0) | add),
  output_tokens: (map(.message?.usage?.output_tokens // .usage?.output_tokens // 0) | add),
  total_cost_usd: (map(.total_cost_usd? // 0) | add)
}`,
		outputFormat: "json",
	},
	"3": {
		name: "MCP Servers Table",
		description: "Turn MCP server statuses into a Markdown table",
		jqFilter: `
.[] | select(.type=="system")
| .mcp_servers
| ["| Server | Status |", "|---|---|"] + (map("| \\(.name) | \\(.status) |"))
| .[]
`,
		outputFormat: "raw",
	},
	"4": {
		name: "Tool Counts",
		description: "Count tools and slash commands",
		jqFilter: `
.[] | select(.type=="system")
| { tool_count: (.tools | length), slash_command_count: (.slash_commands | length) }
`,
		outputFormat: "json",
	},
	"5": {
		name: "Tools by Origin",
		description: "Tools grouped by origin (core vs MCP providers)",
		jqFilter: `
.[] | select(.type=="system")
| .tools
| map(
    if startswith("mcp__chrome-devtools__") then "chrome-devtools"
    elif startswith("mcp__deepwiki__") then "deepwiki"
    else "core"
    end
  )
| group_by(.) | map({group: .[0], count: length})
`,
		outputFormat: "json",
	},
	"7": {
		name: "Timeline Summary",
		description: "Human-readable one-line summary per event",
		jqFilter: `
.[] | def text_or_empty: (.message?.content[]? | select(.type=="text") | .text) // "";
[ "\\(.type)", (if .subtype then "(\(.subtype))" else "" end),
  (if (.model // .message?.model) then " model=" + (.model // .message?.model) else "" end),
  (if .duration_ms then " duration=\\(.duration_ms)ms" else "" end),
  (if .usage?.server_tool_use?.web_search_requests then " web_search=\\(.usage.server_tool_use.web_search_requests)" else "" end),
  (if (text_or_empty | length) > 0 then " text=\\"" + (text_or_empty) + "\\"" else "" end) ]
| join("") | gsub(" +"; " ")
`,
		outputFormat: "raw",
	},
	"8": {
		name: "Duration Analysis",
		description: "Convert durations to seconds with service tier info",
		jqFilter: `
.[] | select(.type=="result")
| {
    duration_s: (.duration_ms / 1000),
    duration_api_s: (.duration_api_ms / 1000),
    web_searches: (.usage.server_tool_use.web_search_requests // 0),
    service_tier: .usage.service_tier
  }
`,
		outputFormat: "json",
	},
	"12": {
		name: "Human Sentence",
		description: "Emit a single human-readable sentence",
		jqFilter: `.[] | select(.type=="assistant") | .message.model + " said: " + .message.content[0].text`,
		outputFormat: "raw",
	},
};

// Utility functions
async function runClaudeCommand(prompt: string): Promise<string> {
	// Filter out our agent-specific arguments from the parsed args
	const claudeFlags = { ...parsedArgs.values };
	delete claudeFlags.recipe;
	delete claudeFlags.verbose;
	delete claudeFlags.help;

	const flags = buildClaudeFlags(
		{
			print: true,
			"output-format": "json",
			verbose: true,
		},
		claudeFlags,
	);

	const proc = spawn(["claude", ...flags, prompt], {
		stdin: "inherit",
		stdout: "pipe",
		stderr: "inherit",
	});

	const stdoutText = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		throw new Error(`Claude command failed with exit code ${exitCode}`);
	}

	return stdoutText;
}

async function runJqFilter(
	jsonlData: string,
	jqFilter: string,
	outputFormat: "raw" | "json" = "json",
): Promise<string> {
	const jqArgs = outputFormat === "raw" ? ["-r", jqFilter] : [jqFilter];
	const proc = spawn(["jq", ...jqArgs], {
		stdin: "pipe",
		stdout: "pipe",
		stderr: "inherit",
	});

	proc.stdin.write(jsonlData);
	proc.stdin.end();

	const stdoutText = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		throw new Error(`jq command failed with exit code ${exitCode}`);
	}

	return stdoutText;
}

// React Components
const RecipeOutput = ({
	recipe,
	number,
	jsonlData,
}: {
	recipe: Recipe;
	number: string;
	jsonlData: string;
}) => {
	const [output, setOutput] = useState<string>("");
	const [error, setError] = useState<string>("");

	useEffect(() => {
		runJqFilter(jsonlData, recipe.jqFilter, recipe.outputFormat)
			.then(setOutput)
			.catch((err) => setError(err.message));
	}, [jsonlData, recipe]);

	return (
		<Box flexDirection="column" marginY={1}>
			<Box
				flexDirection="column"
				padding={1}
				borderStyle="round"
				borderColor="cyan"
			>
				<Text bold color="magenta">
					📊 RECIPE {number}: {recipe.name}
				</Text>
				<Text dimColor>📝 {recipe.description}</Text>
			</Box>
			<Box flexDirection="column" paddingX={2} paddingY={1}>
				{error ? (
					<Text color="red">❌ Error: {error}</Text>
				) : output.trim() ? (
					<Text>{output}</Text>
				) : (
					<Text dimColor>(No {recipe.name.toLowerCase()} data found)</Text>
				)}
			</Box>
		</Box>
	);
};

const JsonlFormatterApp = () => {
	const [jsonlData, setJsonlData] = useState<string>("");
	const [error, setError] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);

	// Resolve selected recipe (if any) once; used in render below
	const selectedRecipe = recipes[formatOption as string];

	useEffect(() => {
		if (help) return;

		setLoading(true);
		runClaudeCommand(userPrompt)
			.then((data) => {
				setJsonlData(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(err.message);
				setLoading(false);
			});
	}, []);

	if (help) {
		return <Help />;
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">❌ Error: {error}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					🚀 JSONL Formatter Agent
				</Text>
				<Text dimColor>
					━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
				</Text>
				<Text>
					Running Claude with prompt: <Text color="cyan">"{userPrompt}"</Text>
				</Text>
				<Text>
					Format option: <Text color="green">{formatOption as string}</Text>
				</Text>
			</Box>

			{loading ? (
				<Box padding={1}>
					<Text color="blue">📡 Getting JSONL data from Claude...</Text>
				</Box>
			) : (
				<Box flexDirection="column">
					<Box padding={1}>
						<Text color="green">
							✅ Received {jsonlData.split("\n").length} lines of JSONL data
						</Text>
					</Box>

					{verbose && (
						<Box flexDirection="column" padding={1} marginY={1}>
							<Text color="yellow">📄 Raw JSONL data:</Text>
							<Box borderStyle="round" borderColor="gray" padding={1}>
								<Text dimColor>{jsonlData}</Text>
							</Box>
						</Box>
					)}

					{formatOption === "all" ? (
						<Box flexDirection="column">
							<Box padding={1}>
								<Text color="magenta">🎯 Running all available recipes...</Text>
							</Box>
							{Object.entries(recipes).map(([number, recipe]) => (
								<RecipeOutput
									key={number}
									recipe={recipe}
									number={number}
									jsonlData={jsonlData}
								/>
							))}
						</Box>
					) : selectedRecipe ? (
						<RecipeOutput
							recipe={selectedRecipe}
							number={formatOption as string}
							jsonlData={jsonlData}
						/>
					) : (
						<Box flexDirection="column" padding={1}>
							<Text color="red">❌ Unknown format option: {formatOption}</Text>
							<Text>Available format options:</Text>
							{Object.entries(recipes).map(([number, recipe]) => (
								<Text key={number}>
									{" "}
									{number}: {recipe.name}
								</Text>
							))}
							<Text> all: Run all recipes</Text>
						</Box>
					)}

					<Box padding={1}>
						<Text dimColor>
							━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
						</Text>
						<Text bold color="green">
							✅ JSONL formatting demonstration complete!
						</Text>
						<Text dimColor>
							━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};

// Render the React app
render(<JsonlFormatterApp />);
