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
import boxen from "boxen";
import { spawn } from "bun";
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { spawnClaude } from "../../lib";
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

// Helper functions for beautiful console output
function createHeader(title: string) {
	return boxen(chalk.bold.cyan(title), {
		padding: 1,
		margin: 0,
		borderStyle: "round",
		borderColor: "cyan",
		dimBorder: true,
	});
}

function createSection(title: string, content: string) {
	return `${chalk.bold.yellow(title)}\n${content}`;
}

function _createTable(headers: string[], rows: string[][]) {
	const table = new Table({
		head: headers.map((h) => chalk.bold.cyan(h)),
		style: {
			head: [],
			border: [],
		},
	});

	rows.forEach((row) => table.push(row));
	return table.toString();
}

function showHelp() {
	const helpContent = [
		createSection(
			"DESCRIPTION",
			[
				`    Demonstrates various ways to format and extract data from ${chalk.cyan("Claude's JSONL output")}`,
				`    using ${chalk.green("jq filters")}. Showcases ${chalk.magenta("8 different recipes")} for processing Claude's JSONL`,
				"    stream output, including human-readable summaries, tool analysis, cost tracking,",
				"    and more.",
			].join("\n"),
		),

		createSection(
			"USAGE",
			[
				`    ${chalk.cyan("bun run agents/jsonl-formatter.ts")} [prompt] [options]`,
				`    ${chalk.cyan("./bin/jsonl-formatter")} [prompt] [options]`,
			].join("\n"),
		),

		createSection(
			"ARGUMENTS",
			`    ${chalk.green("prompt")}                    Your prompt to send to Claude (optional)`,
		),

		createSection(
			"OPTIONS",
			[
				`    ${chalk.green("-r, --recipe <number>")}     Run specific recipe (1, 2, 3, 4, 5, 7, 8, 12) or 'all'`,
				`    ${chalk.green("-v, --verbose")}             Enable verbose output (shows raw JSONL data)`,
				`    ${chalk.green("-h, --help")}                Show this help message`,
			].join("\n"),
		),

		createSection(
			"EXAMPLES",
			[
				`    ${chalk.gray("# Run all recipes with a prompt")}`,
				`    ${chalk.cyan("./bin/jsonl-formatter")} "hello world"`,
				"",
				`    ${chalk.gray("# Run specific recipe")}`,
				`    ${chalk.cyan("./bin/jsonl-formatter")} "explain quantum computing" ${chalk.green("--recipe=1")}`,
				`    ${chalk.cyan("./bin/jsonl-formatter")} "what's the weather?" ${chalk.green("-r 3")}`,
				"",
				`    ${chalk.gray("# Run with verbose output to see raw JSONL data")}`,
				`    ${chalk.cyan("./bin/jsonl-formatter")} "test prompt" ${chalk.green("--verbose --recipe=2")}`,
				"",
				`    ${chalk.gray("# Get help")}`,
				`    ${chalk.cyan("./bin/jsonl-formatter")} ${chalk.green("--help")}`,
			].join("\n"),
		),

		createSection(
			"AVAILABLE RECIPES",
			[
				`    ${chalk.magenta("1:")}  Assistant's Text Reply     - Extract the assistant's text response (raw)`,
				`    ${chalk.magenta("2:")}  Session Summary           - Summarize session, models, token totals, and cost`,
				`    ${chalk.magenta("3:")}  MCP Servers Table         - Turn MCP server statuses into a Markdown table`,
				`    ${chalk.magenta("4:")}  Tool Counts               - Count tools and slash commands`,
				`    ${chalk.magenta("5:")}  Tools by Origin           - Tools grouped by origin (core vs MCP providers)`,
				`    ${chalk.magenta("7:")}  Timeline Summary          - Human-readable one-line summary per event`,
				`    ${chalk.magenta("8:")}  Duration Analysis         - Convert durations to seconds with service tier info`,
				`    ${chalk.magenta("12:")} Human Sentence            - Emit a single human-readable sentence`,
			].join("\n"),
		),

		createSection(
			"NOTES",
			[
				`    ${chalk.gray("•")} Pass-through arguments: Any unrecognized arguments are passed to the claude command`,
				`    ${chalk.gray("•")} Default prompt: If no prompt is provided, uses a default about JSONL formatting`,
				`    ${chalk.gray("•")} Output formats: Some recipes produce raw text, others produce formatted JSON`,
			].join("\n"),
		),
	].join("\n\n");

	console.log(createHeader("🚀 JSONL Formatter Agent"));
	console.log(helpContent);
}

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
	delete claudeFlags.backend;

	const flags = buildClaudeFlags(
		{
			print: true,
			"output-format": "json",
			verbose: true,
		},
		claudeFlags as import("../../lib/claude-flags.types").ClaudeFlags,
	);

	const { process: proc, cleanup } = spawnClaude({
		args: [...flags, prompt],
		stdout: "pipe",
	});

	const stdoutText = await new Response(proc.stdout as ReadableStream).text();
	const exitCode = await proc.exited;
	cleanup();

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

	const stdoutText = await new Response(proc.stdout as ReadableStream).text();
	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		throw new Error(`jq command failed with exit code ${exitCode}`);
	}

	return stdoutText;
}

// Utility functions

function createRecipeOutput(recipe: Recipe, number: string, jsonlData: string) {
	const spinner = ora({
		text: chalk.blue(`Processing recipe ${number}: ${recipe.name}`),
		spinner: "dots",
	});

	spinner.start();

	return runJqFilter(jsonlData, recipe.jqFilter, recipe.outputFormat)
		.then((output) => {
			spinner.succeed();

			// Create a boxed output for the recipe
			const header = boxen(
				`${chalk.bold.magenta(`📊 RECIPE ${number}: ${recipe.name}`)}\n${chalk.dim(`📝 ${recipe.description}`)}`,
				{
					padding: 1,
					borderStyle: "round",
					borderColor: "cyan",
					dimBorder: true,
				},
			);

			let content: string;
			if (output.trim()) {
				content = output;
			} else {
				content = chalk.dim(`(No ${recipe.name.toLowerCase()} data found)`);
			}

			console.log(header);
			console.log(content);
			console.log(); // Add spacing
		})
		.catch((error) => {
			spinner.fail(chalk.red(`Recipe ${number} failed: ${error.message}`));
		});
}

async function main() {
	// Show help if requested
	if (help) {
		showHelp();
		return;
	}

	// Create a beautiful header
	console.log(createHeader("🚀 JSONL Formatter Agent"));

	// Display prompt and format option
	console.log(`Running Claude with prompt: ${chalk.cyan(`"${userPrompt}"`)}`);
	console.log(`Format option: ${chalk.green(formatOption as string)}`);
	console.log();

	try {
		// Get JSONL data from Claude with a spinner
		const spinner = ora({
			text: chalk.blue("📡 Getting JSONL data from Claude..."),
			spinner: "dots",
		}).start();

		const jsonlData = await runClaudeCommand(userPrompt);
		spinner.succeed(
			chalk.green(
				`✅ Received ${jsonlData.split("\n").length} lines of JSONL data`,
			),
		);

		// Show raw JSONL data if verbose
		if (verbose) {
			console.log();
			console.log(chalk.yellow("📄 Raw JSONL data:"));
			console.log(
				boxen(jsonlData, {
					padding: 1,
					borderStyle: "round",
					borderColor: "gray",
					dimBorder: true,
				}),
			);
		}

		console.log();

		// Run selected recipes
		if (formatOption === "all") {
			console.log(chalk.magenta("🎯 Running all available recipes...\n"));

			for (const [number, recipe] of Object.entries(recipes)) {
				await createRecipeOutput(recipe, number, jsonlData);
			}
		} else if (recipes[formatOption as string]) {
			const recipe = recipes[formatOption as string];
			await createRecipeOutput(
				recipe as (typeof recipes)[string],
				formatOption as string,
				jsonlData,
			);
		} else {
			console.log(chalk.red(`❌ Unknown format option: ${formatOption}`));
			console.log(chalk.yellow("Available format options:"));
			Object.entries(recipes).forEach(([number, recipe]) => {
				console.log(`  ${number}: ${recipe.name}`);
			});
			console.log(`  all: Run all recipes`);
			process.exit(1);
		}

		// Final completion message
		const completionBox = boxen(
			chalk.bold.green("✅ JSONL formatting demonstration complete!"),
			{
				padding: 1,
				margin: 0,
				borderStyle: "round",
				borderColor: "green",
				dimBorder: true,
			},
		);
		console.log(completionBox);
	} catch (error) {
		console.error(chalk.red("❌ Error:"), error);
		process.exit(1);
	}
}

// Run the main function
main();
