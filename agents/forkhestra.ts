#!/usr/bin/env -S bun run

/**
 * FORKHESTRA: CLI entry point for orchestrating agent chains
 *
 * Supports multiple modes:
 * - Single agent with loop: `forkhestra agent:N` - run agent up to N iterations
 * - Pipeline mode: `forkhestra "a -> b"` - run agents once each, sequentially
 * - Chain mode: `forkhestra "a:3 -> b:10"` - run agents with iteration limits
 * - Config mode: `forkhestra --chain name` - load named chain from forge/chains.json
 * - Config with vars: `forkhestra --chain name VAR=value` - substitute variables
 *
 * Options:
 * --cwd <path>          Working directory for all agents
 * --verbose, -v         Show full agent output and iteration details
 * --dry-run             Show what would run without executing
 * --chain <name>        Run named chain from forge/chains.json
 */

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { type ChainResult, executeChain } from "../lib/forkhestra/chain";
import { getChain, loadConfig, substituteVars } from "../lib/forkhestra/config";
import { type ChainStep, parseDSL } from "../lib/forkhestra/parser";

// Exit codes
const EXIT_COMPLETE = 0;
const EXIT_INCOMPLETE = 1;
const EXIT_ERROR = 2;

/**
 * Parse command line arguments
 */
function parseArguments() {
	const { values, positionals } = parseArgs({
		options: {
			cwd: { type: "string" },
			verbose: { type: "boolean", short: "v", default: false },
			"dry-run": { type: "boolean", default: false },
			chain: { type: "string" },
			help: { type: "boolean", short: "h", default: false },
		},
		allowPositionals: true,
		strict: false,
	});

	return { values, positionals };
}

/**
 * Parse VAR=value pairs from positional arguments
 */
function parseVariables(positionals: string[]): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const arg of positionals) {
		const eqIndex = arg.indexOf("=");
		if (eqIndex > 0) {
			const key = arg.slice(0, eqIndex);
			const value = arg.slice(eqIndex + 1);
			// Only treat as variable if key looks like a variable name (uppercase)
			if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
				vars[key] = value;
			}
		}
	}
	return vars;
}

/**
 * Filter out VAR=value pairs from positionals, returning just the DSL or agent strings
 */
function getNonVariablePositionals(positionals: string[]): string[] {
	return positionals.filter((arg) => {
		const eqIndex = arg.indexOf("=");
		if (eqIndex > 0) {
			const key = arg.slice(0, eqIndex);
			return !/^[A-Z_][A-Z0-9_]*$/.test(key);
		}
		return true;
	});
}

/**
 * Print usage information
 */
function printUsage() {
	console.log(`
forkhestra - Orchestrate chains of Claude agents

USAGE:
  forkhestra <agent>[:iterations]              Single agent mode
  forkhestra "<dsl>"                           DSL chain mode
  forkhestra --chain <name> [VAR=value...]     Config mode

EXAMPLES:
  forkhestra task-coordinator:10               Loop task-coordinator up to 10 times
  forkhestra "task-manager -> task-coordinator" Run pipeline (each once)
  forkhestra "task-manager:3 -> task-coordinator:10" Chain with iterations
  forkhestra --chain plan-and-build            Load chain from forge/chains.json
  forkhestra --chain single-task TASK_ID=001   Config with variable substitution

OPTIONS:
  --cwd <path>          Working directory for all agents
  --verbose, -v         Show full agent output and iteration details
  --dry-run             Show what would run without executing
  --chain <name>        Run named chain from forge/chains.json
  --help, -h            Show this help message

EXIT CODES:
  0   All steps completed successfully
  1   One or more steps did not complete
  2   Configuration or runtime error
`);
}

/**
 * Print a formatted summary of the chain result
 */
function printSummary(result: ChainResult, steps: ChainStep[]) {
	const completedSteps = result.steps.filter((s) => s.result.complete).length;
	const totalSteps = steps.length;

	console.log("\n[forkhestra] Summary:");

	for (let i = 0; i < result.steps.length; i++) {
		const stepResult = result.steps[i];
		if (!stepResult) continue;

		const step = steps[i];
		if (!step) continue;

		const status = stepResult.result.complete ? "done" : "incomplete";
		const iterInfo = step.loop
			? ` (${stepResult.result.iterations}/${step.iterations} iterations)`
			: "";
		const reason = stepResult.result.reason;

		console.log(
			`  ${i + 1}. ${stepResult.agent}: ${status}${iterInfo} [${reason}]`,
		);
	}

	// Print steps that weren't executed
	for (let i = result.steps.length; i < steps.length; i++) {
		const step = steps[i];
		if (!step) continue;
		console.log(`  ${i + 1}. ${step.agent}: skipped`);
	}

	if (result.success) {
		console.log(
			`\n[forkhestra] Chain complete (${completedSteps}/${totalSteps} steps)`,
		);
	} else {
		console.log(
			`\n[forkhestra] Chain incomplete (${completedSteps}/${totalSteps} steps)`,
		);
		if (result.failedAt !== undefined) {
			const failedStep = steps[result.failedAt];
			if (failedStep) {
				console.log(
					`[forkhestra] Failed at step ${result.failedAt + 1}: ${failedStep.agent}`,
				);
			}
		}
	}
}

/**
 * Print dry-run output showing what would be executed
 */
function printDryRun(steps: ChainStep[], cwd?: string) {
	console.log("[forkhestra] Dry run - would execute the following chain:\n");

	if (cwd) {
		console.log(`Working directory: ${cwd}\n`);
	}

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		if (!step) continue;

		const modeDesc = step.loop
			? `loop up to ${step.iterations} iterations`
			: "run once";
		const argsDesc = step.args?.length
			? ` args: [${step.args.join(", ")}]`
			: "";

		console.log(`  ${i + 1}. ${step.agent} - ${modeDesc}${argsDesc}`);
	}

	console.log("\n[forkhestra] Dry run complete. No agents were executed.");
}

/**
 * Main entry point
 */
async function main() {
	const { values, positionals } = parseArguments();

	// Handle help flag
	if (values.help) {
		printUsage();
		process.exit(EXIT_COMPLETE);
	}

	const verbose = Boolean(values.verbose);
	const dryRun = Boolean(values["dry-run"]);
	const chainName = values.chain as string | undefined;
	const cwdFlag = values.cwd as string | undefined;

	// Resolve working directory
	const cwd = cwdFlag ? resolve(cwdFlag) : process.cwd();

	let steps: ChainStep[];

	try {
		if (chainName) {
			// Config mode: load chain from forge/chains.json
			const config = await loadConfig(cwd);
			if (!config) {
				console.error(
					`[forkhestra] Error: No forge/chains.json found in ${cwd}`,
				);
				process.exit(EXIT_ERROR);
			}

			steps = getChain(config, chainName);

			// Parse variables from remaining positionals
			const vars = parseVariables(positionals);
			if (Object.keys(vars).length > 0) {
				steps = substituteVars(steps, vars);
			}

			if (verbose) {
				console.log(`[forkhestra] Loaded chain '${chainName}' from config`);
			}
		} else {
			// DSL mode or single agent mode
			const nonVarPositionals = getNonVariablePositionals(positionals);

			if (nonVarPositionals.length === 0) {
				console.error("[forkhestra] Error: No agent or chain specified");
				console.error("Run 'forkhestra --help' for usage information");
				process.exit(EXIT_ERROR);
			}

			// Join positionals to form DSL (handles "a -> b" passed as multiple args)
			const dsl = nonVarPositionals.join(" ");

			try {
				steps = parseDSL(dsl);
			} catch (error) {
				console.error(
					`[forkhestra] Error parsing DSL: ${error instanceof Error ? error.message : String(error)}`,
				);
				process.exit(EXIT_ERROR);
			}

			if (verbose) {
				console.log(`[forkhestra] Parsed DSL: ${dsl}`);
			}
		}

		// Dry run: just show what would happen
		if (dryRun) {
			printDryRun(steps, cwd);
			process.exit(EXIT_COMPLETE);
		}

		// Print starting message
		if (steps.length === 1) {
			const step = steps[0];
			if (step) {
				if (step.loop) {
					console.log(
						`[forkhestra] Starting: ${step.agent} (max ${step.iterations} iterations)`,
					);
				} else {
					console.log(`[forkhestra] Running: ${step.agent}`);
				}
			}
		} else {
			console.log(`[forkhestra] Starting chain with ${steps.length} steps`);
		}

		// Execute the chain
		const result = await executeChain({
			steps,
			cwd,
			verbose,
		});

		// Print summary
		printSummary(result, steps);

		// Exit with appropriate code
		if (result.success) {
			process.exit(EXIT_COMPLETE);
		} else {
			process.exit(EXIT_INCOMPLETE);
		}
	} catch (error) {
		console.error(
			`[forkhestra] Error: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(EXIT_ERROR);
	}
}

// Run main
main();
