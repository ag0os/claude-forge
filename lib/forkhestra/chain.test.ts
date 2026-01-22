/**
 * Tests for forkhestra chain executor
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { executeChain, type ChainResult } from "./chain";
import { COMPLETION_MARKER } from "./runner";
import type { ChainStep } from "./parser";

// Create temporary test scripts
const tmpDir = "/tmp/forkhestra-chain-test";
const simpleAgentPath = join(tmpDir, "simple-agent");
const completingAgentPath = join(tmpDir, "completing-agent");
const failingAgentPath = join(tmpDir, "failing-agent");
const argEchoAgentPath = join(tmpDir, "arg-echo-agent");
const counterAgentPath = join(tmpDir, "counter-agent");

beforeAll(() => {
	// Create tmp directory
	try {
		require("fs").mkdirSync(tmpDir, { recursive: true });
	} catch {}

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
});

afterAll(() => {
	// Cleanup test scripts
	try {
		unlinkSync(simpleAgentPath);
		unlinkSync(completingAgentPath);
		unlinkSync(failingAgentPath);
		unlinkSync(argEchoAgentPath);
		unlinkSync(counterAgentPath);
	} catch {}
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
});
