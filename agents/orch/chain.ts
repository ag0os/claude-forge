#!/usr/bin/env -S bun run

/**
 * CHAIN: Run planner, then contain, passing the generated plan forward
 *
 * Flow:
 * 1) Invoke planner with --print to capture the plan text
 * 2) Start contain agent interactively with the plan as the initial prompt
 *
 * Usage:
 *   bun run agents/chain.ts "<your prompt>"
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaude,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import containMcp from "../../settings/contain.mcp.json" with { type: "json" };
import containSettings from "../../settings/contain.settings.json" with {
	type: "json",
};
import plannerMcp from "../../settings/planner.mcp.json" with { type: "json" };
import plannerSettings from "../../settings/planner.settings.json" with {
	type: "json",
};

interface ClaudePrintResponse {
	type: string;
	subtype: string;
	is_error: boolean;
	result: string; // The actual assistant output
	session_id: string;
	total_cost_usd?: number;
}

function resolvePath(relativeFromThisFile: string): string {
	const url = new URL(relativeFromThisFile, import.meta.url);
	return url.pathname;
}

const projectRoot = resolvePath("../");
// Settings and MCP configs are imported and passed as JSON strings so they're bundled
const plannerSettingsJson = JSON.stringify(plannerSettings);
const plannerMcpJson = JSON.stringify(plannerMcp);
const containSettingsJson = JSON.stringify(containSettings);
const containMcpJson = JSON.stringify(containMcp);

async function runPlannerAndGetPlan(userPrompt: string): Promise<string> {
	const baseFlags = {
		print: true,
		"output-format": "json",
		settings: plannerSettingsJson,
		"mcp-config": plannerMcpJson,
	} as const;
	const flags = buildClaudeFlags(
		{ ...baseFlags },
		parsedArgs.values as ClaudeFlags,
	);
	const args = [...flags, userPrompt];

	const { process: proc, cleanup } = spawnClaude({
		args,
		env: { CLAUDE_PROJECT_DIR: projectRoot },
		stdout: "pipe",
	});

	const stdoutText = await new Response(proc.stdout as ReadableStream).text();
	const exitCode = await proc.exited;
	cleanup();

	if (exitCode !== 0) {
		throw new Error(`Planner exited with code ${exitCode}`);
	}

	let parsed: ClaudePrintResponse;
	try {
		parsed = JSON.parse(stdoutText) as ClaudePrintResponse;
	} catch {
		throw new Error(
			`Failed to parse planner output as JSON. Raw output:\n${stdoutText}`,
		);
	}

	if (parsed.is_error) {
		throw new Error(`Planner returned an error: ${parsed.result}`);
	}

	const planText = parsed.result?.trim();
	if (!planText) {
		throw new Error("Planner produced no plan text in result field");
	}

	return planText;
}

async function runContainWithPlan(planText: string): Promise<number> {
	const initialPrompt = `\n<plan>\n${planText}\n</plan>\n\nFollow this plan step-by-step using only the container-use MCP tools. If the plan is incomplete, refine it minimally and proceed.`;

	const baseFlags = {
		settings: containSettingsJson,
		"mcp-config": containMcpJson,
	} as const;
	const flags = buildClaudeFlags(
		{ ...baseFlags },
		parsedArgs.values as ClaudeFlags,
	);
	const args = [...flags, initialPrompt];

	return await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: projectRoot },
	});
}

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	let code: number;
	if (userPrompt) {
		console.log("[chain] Running planner to generate plan...");
		const plan = await runPlannerAndGetPlan(userPrompt);
		console.log(
			"[chain] Plan captured. Launching contain agent with plan...\n",
		);
		code = await runContainWithPlan(plan);
	} else {
		console.log(
			"[chain] No prompt provided. Launching contain agent interactively without a pre-generated plan...\n",
		);
		code = await runContainWithPlan("");
	}
	process.exit(code);
}

await main();
