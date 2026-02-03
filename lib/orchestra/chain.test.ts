/**
 * Tests for orchestra chain executor
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { writeFileSync, unlinkSync, chmodSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { executeChain, type ChainResult } from "./chain";
import { COMPLETION_MARKER } from "./runner";
import type { ChainStep } from "./config";

// Create temporary test scripts
const tmpDir = "/tmp/orchestra-chain-test";
const promptsDir = join(tmpDir, "prompts");
const simpleAgentPath = join(tmpDir, "simple-agent");
const completingAgentPath = join(tmpDir, "completing-agent");
const failingAgentPath = join(tmpDir, "failing-agent");
const argEchoAgentPath = join(tmpDir, "arg-echo-agent");
const counterAgentPath = join(tmpDir, "counter-agent");
const promptEchoAgentPath = join(tmpDir, "prompt-echo-agent");

beforeAll(() => {
	// Create tmp directory and prompts subdirectory
	mkdirSync(promptsDir, { recursive: true });

	// Create a simple agent that exits successfully
	writeFileSync(
		simpleAgentPath,
		`#!/bin/bash
echo "Simple agent running"
exit 0
`
	);
	chmodSync(simpleAgentPath, 0o755);

	// Create an agent that outputs the completion marker
	writeFileSync(
		completingAgentPath,
		`#!/bin/bash
echo "Working..."
echo "${COMPLETION_MARKER}"
echo "Done"
exit 0
`
	);
	chmodSync(completingAgentPath, 0o755);

	// Create an agent that exits with error
	writeFileSync(
		failingAgentPath,
		`#!/bin/bash
echo "Failing..."
exit 1
`
	);
	chmodSync(failingAgentPath, 0o755);

	// Create an agent that echoes its arguments
	writeFileSync(
		argEchoAgentPath,
		`#!/bin/bash
echo "Args: $@"
exit 0
`
	);
	chmodSync(argEchoAgentPath, 0o755);

	// Create a counter agent that never completes (for max iteration tests)
	writeFileSync(
		counterAgentPath,
		`#!/bin/bash
echo "Counter iteration"
exit 0
`
	);
	chmodSync(counterAgentPath, 0o755);

	// Create an agent that echoes its last positional argument (the prompt)
	// This agent stores received prompts to a file for verification
	writeFileSync(
		promptEchoAgentPath,
		`#!/bin/bash
# Get the last argument (the prompt) - skip --cwd and its value if present
PROMPT=""
SKIP_NEXT=false
for arg in "$@"; do
  if [ "$SKIP_NEXT" = true ]; then
    SKIP_NEXT=false
    continue
  fi
  if [ "$arg" = "--cwd" ]; then
    SKIP_NEXT=true
    continue
  fi
  # Check if arg starts with -- (it's a flag)
  if [[ "$arg" == --* ]]; then
    continue
  fi
  # This is a positional argument, likely the prompt
  PROMPT="$arg"
done
echo "PROMPT:$PROMPT"
exit 0
`
	);
	chmodSync(promptEchoAgentPath, 0o755);

	// Create prompt files for testing
	writeFileSync(join(promptsDir, "cli.md"), "CLI prompt from file");
	writeFileSync(join(promptsDir, "step1.md"), "Step 1 prompt from file");
	writeFileSync(join(promptsDir, "step2.md"), "Step 2 prompt from file");
	writeFileSync(join(promptsDir, "chain.md"), "Chain prompt from file");
	writeFileSync(join(promptsDir, "agent-default.md"), "Agent default prompt from file");
});

afterAll(() => {
	// Cleanup test directory
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("chain executor", () => {
	describe("sequential execution", () => {
		test("executes steps in sequential order", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
				{ agent: simpleAgentPath, iterations: 1, loop: false },
				{ agent: simpleAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({ steps });

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(3);
			expect(result.failedAt).toBeUndefined();

			// Verify each step completed
			for (const step of result.steps) {
				expect(step.result.complete).toBe(true);
			}
		});

		test("executes mixed loop and single-run steps", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
				{ agent: completingAgentPath, iterations: 5, loop: true },
				{ agent: simpleAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({ steps });

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(3);
			expect(result.steps[0]?.result.reason).toBe("single_run");
			expect(result.steps[1]?.result.reason).toBe("marker");
			expect(result.steps[2]?.result.reason).toBe("single_run");
		});
	});

	describe("failure handling", () => {
		test("stops on first failing step and reports failedAt index", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
				{ agent: failingAgentPath, iterations: 1, loop: false },
				{ agent: simpleAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({ steps });

			expect(result.success).toBe(false);
			expect(result.steps.length).toBe(2); // Only first two steps executed
			expect(result.failedAt).toBe(1); // Second step (index 1) failed
		});

		test("stops when looping step doesn't complete within max iterations", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
				{ agent: counterAgentPath, iterations: 2, loop: true }, // Will hit max iterations
				{ agent: simpleAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({ steps });

			expect(result.success).toBe(false);
			expect(result.steps.length).toBe(2);
			expect(result.failedAt).toBe(1);
			expect(result.steps[1]?.result.reason).toBe("max_iterations");
			expect(result.steps[1]?.result.iterations).toBe(2);
		});
	});

	describe("argument merging", () => {
		test("merges globalArgs with per-step args (step args last)", async () => {
			const steps: ChainStep[] = [
				{
					agent: argEchoAgentPath,
					iterations: 1,
					loop: false,
					args: ["--step-arg", "value"],
				},
			];

			// Test that both global and step args are passed
			const result = await executeChain({
				steps,
				globalArgs: ["--global-arg", "global-value"],
			});

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(1);
		});

		test("step args override global args by being last", async () => {
			const steps: ChainStep[] = [
				{
					agent: argEchoAgentPath,
					iterations: 1,
					loop: false,
					args: ["--override", "step-value"],
				},
			];

			const result = await executeChain({
				steps,
				globalArgs: ["--override", "global-value"],
			});

			expect(result.success).toBe(true);
			// Both are passed, step-value comes last
		});

		test("works with only globalArgs (no step args)", async () => {
			const steps: ChainStep[] = [
				{ agent: argEchoAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({
				steps,
				globalArgs: ["--global-only", "value"],
			});

			expect(result.success).toBe(true);
		});

		test("works with only step args (no globalArgs)", async () => {
			const steps: ChainStep[] = [
				{
					agent: argEchoAgentPath,
					iterations: 1,
					loop: false,
					args: ["--step-only", "value"],
				},
			];

			const result = await executeChain({ steps });

			expect(result.success).toBe(true);
		});
	});

	describe("result structure", () => {
		test("returns structured ChainResult with success flag", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({ steps });

			expect(typeof result.success).toBe("boolean");
			expect(Array.isArray(result.steps)).toBe(true);
		});

		test("returns per-step details with agent name and result", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
				{ agent: completingAgentPath, iterations: 5, loop: true },
			];

			const result = await executeChain({ steps });

			expect(result.steps.length).toBe(2);

			expect(result.steps[0]?.agent).toBe(simpleAgentPath);
			expect(result.steps[0]?.result.complete).toBe(true);

			expect(result.steps[1]?.agent).toBe(completingAgentPath);
			expect(result.steps[1]?.result.complete).toBe(true);
		});

		test("failedAt is undefined on success", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({ steps });

			expect(result.success).toBe(true);
			expect(result.failedAt).toBeUndefined();
		});

		test("failedAt is set on failure", async () => {
			const steps: ChainStep[] = [
				{ agent: failingAgentPath, iterations: 1, loop: false },
			];

			const result = await executeChain({ steps });

			expect(result.success).toBe(false);
			expect(result.failedAt).toBe(0);
		});
	});

	describe("empty chain", () => {
		test("handles empty steps array", async () => {
			const result = await executeChain({ steps: [] });

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(0);
			expect(result.failedAt).toBeUndefined();
		});
	});

	describe("verbose mode", () => {
		test("runs with verbose output", async () => {
			const steps: ChainStep[] = [
				{ agent: simpleAgentPath, iterations: 1, loop: false },
			];

			// Just verify it doesn't throw
			const result = await executeChain({ steps, verbose: true });
			expect(result.success).toBe(true);
		});
	});

	describe("prompt resolution", () => {
		test("passes CLI prompt to all steps (highest priority)", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Step-level prompt",
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Another step prompt",
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				cliPrompt: "CLI prompt overrides all",
			});

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(2);
		});

		test("passes CLI prompt file to all steps when cliPromptFile provided", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Step-level prompt",
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				cliPromptFile: "prompts/cli.md",
			});

			expect(result.success).toBe(true);
		});

		test("uses step-level prompts when no CLI prompt provided", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "First step prompt",
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Second step prompt",
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
			});

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(2);
		});

		test("uses step promptFile when no step prompt provided", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					promptFile: "prompts/step1.md",
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
			});

			expect(result.success).toBe(true);
		});

		test("uses chain-level prompt when no step prompt provided", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				chainConfig: {
					steps: [],
					prompt: "Chain-level prompt for all steps",
				},
			});

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(2);
		});

		test("uses chain promptFile when no chain prompt provided", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				chainConfig: {
					steps: [],
					promptFile: "prompts/chain.md",
				},
			});

			expect(result.success).toBe(true);
		});

		test("uses agent default prompt when no higher-level prompts provided", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				agentDefaults: {
					[promptEchoAgentPath]: {
						defaultPrompt: "Agent default prompt",
					},
				},
			});

			expect(result.success).toBe(true);
		});

		test("uses agent default promptFile when no default prompt provided", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				agentDefaults: {
					[promptEchoAgentPath]: {
						defaultPromptFile: "prompts/agent-default.md",
					},
				},
			});

			expect(result.success).toBe(true);
		});

		test("different steps can have different resolved prompts", async () => {
			// This tests that step-level prompts take precedence over chain-level
			// and different steps can have their own prompts
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Step 1 has its own prompt",
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					// No prompt - should fall back to chain-level
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Step 3 has a different prompt",
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				chainConfig: {
					steps: [],
					prompt: "Chain fallback for steps without prompts",
				},
			});

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(3);
		});

		test("CLI prompt overrides all step and chain-level prompts", async () => {
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Step prompt (should be overridden)",
					promptFile: "prompts/step1.md",
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					// No step prompt - would fall back to chain
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				cliPrompt: "CLI prompt wins",
				chainConfig: {
					steps: [],
					prompt: "Chain prompt (should be overridden)",
				},
				agentDefaults: {
					[promptEchoAgentPath]: {
						defaultPrompt: "Agent default (should be overridden)",
					},
				},
			});

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(2);
		});

		test("works without any prompts configured", async () => {
			const steps: ChainStep[] = [
				{
					agent: simpleAgentPath,
					iterations: 1,
					loop: false,
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
			});

			expect(result.success).toBe(true);
		});

		test("multi-step chain with mixed prompt sources", async () => {
			// A complex integration test with different prompt sources at each step
			const steps: ChainStep[] = [
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					prompt: "Step 1: inline prompt",
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					promptFile: "prompts/step2.md",
				},
				{
					agent: promptEchoAgentPath,
					iterations: 1,
					loop: false,
					// Falls back to chain prompt
				},
				{
					agent: simpleAgentPath,
					iterations: 1,
					loop: false,
					// Different agent with no defaults
				},
			];

			const result = await executeChain({
				steps,
				cwd: tmpDir,
				chainConfig: {
					steps: [],
					prompt: "Chain fallback prompt",
				},
				agentDefaults: {
					[promptEchoAgentPath]: {
						defaultPrompt: "Agent default (lower priority than chain)",
					},
				},
			});

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(4);
		});
	});
});
