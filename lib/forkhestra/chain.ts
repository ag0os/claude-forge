/**
 * Chain executor for forkhestra - sequential step execution
 *
 * Executes a sequence of ChainSteps, running each agent through the runner.
 * Handles step-by-step execution with proper failure handling.
 */

import { run, type RunResult } from "./runner";
import type { ChainStep } from "./parser";

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
 * @param options - Chain execution options
 * @returns ChainResult with success status and per-step details
 */
export async function executeChain(options: ChainOptions): Promise<ChainResult> {
	const { steps, cwd, verbose = false, globalArgs = [] } = options;

	const stepResults: StepResult[] = [];
	signalReceived = false;

	// Set up signal handlers for graceful shutdown
	const handleSignal = () => {
		signalReceived = true;
		if (verbose) {
			console.log("\n[forkhestra] Signal received, stopping chain...");
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
					`\n[forkhestra] Step ${i + 1}/${steps.length}: ${step.agent}${step.loop ? `:${step.iterations}` : ""}`
				);
			}

			// Merge global args with step args (step args take precedence by being last)
			const mergedArgs = [...globalArgs, ...(step.args || [])];

			// Execute the step
			const result = await run({
				agent: step.agent,
				maxIterations: step.iterations,
				loop: step.loop,
				args: mergedArgs.length > 0 ? mergedArgs : undefined,
				cwd,
				verbose,
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
						`[forkhestra] Step ${i + 1} did not complete (reason: ${result.reason})`
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
					`[forkhestra] Step ${i + 1} completed (reason: ${result.reason})`
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
				`[forkhestra] Chain error: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		return {
			success: false,
			steps: stepResults,
			failedAt: stepResults.length,
		};
	}
}
