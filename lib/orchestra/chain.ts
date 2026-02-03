/**
 * Chain executor for orchestra - sequential step execution
 *
 * Executes a sequence of ChainSteps, running each agent through the runner.
 * Handles step-by-step execution with proper failure handling.
 * Resolves prompts for each step using the prompt resolution utility.
 */

import { run, type RunResult } from "./runner";
import { resolvePrompt } from "./prompt";
import type { ChainStep, ChainConfig, AgentConfig } from "./config";

/**
 * Result from a single step in the chain
 */
export interface StepResult {
	/** Agent binary name */
	agent: string;
	/** Result from the runner */
	result: RunResult;
}

/**
 * Result from executing a chain
 */
export interface ChainResult {
	/** Whether the chain completed successfully (all steps completed) */
	success: boolean;
	/** Results from each step that was executed */
	steps: StepResult[];
	/** Index of the step that failed (0-based), if any */
	failedAt?: number;
}

/**
 * Options for executing a chain
 */
export interface ChainOptions {
	/** Array of steps to execute */
	steps: ChainStep[];
	/** Working directory for all agents */
	cwd?: string;
	/** Show verbose output */
	verbose?: boolean;
	/** Global arguments to pass to all agents (step args take precedence) */
	globalArgs?: string[];
	/** CLI-level prompt (highest priority, overrides all other prompts) */
	cliPrompt?: string;
	/** CLI-level prompt file path */
	cliPromptFile?: string;
	/** Chain configuration (for chain-level prompts) */
	chainConfig?: ChainConfig;
	/** Agent default configurations (for agent-level default prompts) */
	agentDefaults?: Record<string, AgentConfig>;
}

// Track whether we've received a termination signal
let signalReceived = false;

/**
 * Execute a chain of agents sequentially
 *
 * Each step is executed in order. If a step fails (in loop mode: doesn't
 * complete within max iterations; in single mode: returns non-zero exit),
 * the chain stops and reports the failure.
 *
 * Prompts are resolved for each step using the following priority (highest to lowest):
 * 1. CLI prompt/promptFile
 * 2. Step prompt/promptFile
 * 3. Chain prompt/promptFile
 * 4. Agent default prompt/promptFile
 *
 * @param options - Chain execution options
 * @returns ChainResult with success status and per-step details
 */
export async function executeChain(options: ChainOptions): Promise<ChainResult> {
	const {
		steps,
		cwd,
		verbose = false,
		globalArgs = [],
		cliPrompt,
		cliPromptFile,
		chainConfig,
		agentDefaults,
	} = options;

	// Resolve cwd for prompt file resolution
	const resolvedCwd = cwd || process.cwd();

	const stepResults: StepResult[] = [];
	signalReceived = false;

	// Set up signal handlers for graceful shutdown
	const handleSignal = () => {
		signalReceived = true;
		if (verbose) {
			console.log("\n[orchestra] Signal received, stopping chain...");
		}
	};

	const sigintHandler = () => handleSignal();
	const sigtermHandler = () => handleSignal();

	process.on("SIGINT", sigintHandler);
	process.on("SIGTERM", sigtermHandler);

	// Cleanup function to remove signal handlers
	const cleanup = () => {
		process.removeListener("SIGINT", sigintHandler);
		process.removeListener("SIGTERM", sigtermHandler);
	};

	try {
		for (let i = 0; i < steps.length; i++) {
			// Check if we received a signal before starting this step
			if (signalReceived) {
				cleanup();
				return {
					success: false,
					steps: stepResults,
					failedAt: i,
				};
			}

			const step = steps[i];
			if (!step) {
				continue;
			}

			if (verbose) {
				console.log(
					`\n[orchestra] Step ${i + 1}/${steps.length}: ${step.agent}${step.loop ? `:${step.iterations}` : ""}`
				);
			}

			// Merge global args with step args (step args take precedence by being last)
			const mergedArgs = [...globalArgs, ...(step.args || [])];

			// Resolve prompt for this step using the priority hierarchy
			const resolvedPrompt = await resolvePrompt(
				{
					cliPrompt,
					cliPromptFile,
					step,
					chain: chainConfig,
					agentConfig: agentDefaults?.[step.agent],
				},
				resolvedCwd
			);

			if (verbose && resolvedPrompt) {
				console.log(
					`[orchestra] Using prompt for ${step.agent}: ${resolvedPrompt.substring(0, 50)}${resolvedPrompt.length > 50 ? "..." : ""}`
				);
			}

			// Look up agent config for this step (enables direct spawn if configured)
			const agentConfig = agentDefaults?.[step.agent];

			// Execute the step
			const result = await run({
				agent: step.agent,
				maxIterations: step.iterations,
				loop: step.loop,
				args: mergedArgs.length > 0 ? mergedArgs : undefined,
				cwd: resolvedCwd,
				verbose,
				prompt: resolvedPrompt,
				agentConfig,
			});

			stepResults.push({
				agent: step.agent,
				result,
			});

			// Check if we received a signal during step execution
			if (signalReceived) {
				cleanup();
				return {
					success: false,
					steps: stepResults,
					failedAt: i,
				};
			}

			// Check if step completed successfully
			// For loop mode: must have detected completion marker
			// For single mode: exit code must be 0
			if (!result.complete) {
				if (verbose) {
					console.log(
						`[orchestra] Step ${i + 1} did not complete (reason: ${result.reason})`
					);
				}

				cleanup();
				return {
					success: false,
					steps: stepResults,
					failedAt: i,
				};
			}

			if (verbose) {
				console.log(
					`[orchestra] Step ${i + 1} completed (reason: ${result.reason})`
				);
			}
		}

		// All steps completed successfully
		cleanup();
		return {
			success: true,
			steps: stepResults,
		};
	} catch (error) {
		cleanup();

		if (verbose) {
			console.error(
				`[orchestra] Chain error: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		return {
			success: false,
			steps: stepResults,
			failedAt: stepResults.length,
		};
	}
}
