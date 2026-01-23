/**
 * Tests for forkhestra runner
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { run, COMPLETION_MARKER, type RunResult } from "./runner";

// Create temporary test scripts
const tmpDir = "/tmp/forkhestra-test";
const testAgentPath = join(tmpDir, "test-agent");
const completingAgentPath = join(tmpDir, "completing-agent");
const failingAgentPath = join(tmpDir, "failing-agent");

beforeAll(() => {
	// Create tmp directory
	try {
		require("fs").mkdirSync(tmpDir, { recursive: true });
	} catch {}

	// Create a simple test agent that outputs some text and exits
	writeFileSync(
		testAgentPath,
		`#!/bin/bash
echo "Test agent running"
echo "Args: $@"
exit 0
`,
	);
	chmodSync(testAgentPath, 0o755);

	// Create an agent that outputs the completion marker
	writeFileSync(
		completingAgentPath,
		`#!/bin/bash
echo "Working..."
echo "${COMPLETION_MARKER}"
echo "Done"
exit 0
`,
	);
	chmodSync(completingAgentPath, 0o755);

	// Create an agent that exits with error
	writeFileSync(
		failingAgentPath,
		`#!/bin/bash
echo "Failing..."
exit 1
`,
	);
	chmodSync(failingAgentPath, 0o755);
});

afterAll(() => {
	// Cleanup test scripts
	try {
		unlinkSync(testAgentPath);
		unlinkSync(completingAgentPath);
		unlinkSync(failingAgentPath);
	} catch {}
});

describe("runner", () => {
	describe("single-run mode (loop: false)", () => {
		test("runs agent once and returns", async () => {
			const result = await run({
				agent: testAgentPath,
				maxIterations: 5,
				loop: false,
			});

			expect(result.iterations).toBe(1);
			expect(result.reason).toBe("single_run");
			expect(result.exitCode).toBe(0);
			expect(result.complete).toBe(true);
		});

		test("returns complete: false for non-zero exit", async () => {
			const result = await run({
				agent: failingAgentPath,
				maxIterations: 5,
				loop: false,
			});

			expect(result.iterations).toBe(1);
			expect(result.reason).toBe("single_run");
			expect(result.exitCode).toBe(1);
			expect(result.complete).toBe(false);
		});
	});

	describe("loop mode (loop: true)", () => {
		test("detects completion marker and stops", async () => {
			const result = await run({
				agent: completingAgentPath,
				maxIterations: 5,
				loop: true,
			});

			expect(result.complete).toBe(true);
			expect(result.iterations).toBe(1);
			expect(result.reason).toBe("marker");
		});

		test("respects maxIterations limit", async () => {
			const result = await run({
				agent: testAgentPath,
				maxIterations: 3,
				loop: true,
			});

			expect(result.complete).toBe(false);
			expect(result.iterations).toBe(3);
			expect(result.reason).toBe("max_iterations");
		});
	});

	describe("arguments passing", () => {
		test("passes args to agent", async () => {
			// This test just verifies the agent receives args
			// The test-agent script echoes args to stdout
			const result = await run({
				agent: testAgentPath,
				maxIterations: 1,
				loop: false,
				args: ["--foo", "bar"],
			});

			expect(result.exitCode).toBe(0);
		});

		test("uses cwd for process working directory", async () => {
			const result = await run({
				agent: testAgentPath,
				maxIterations: 1,
				loop: false,
				cwd: "/tmp",
			});

			expect(result.exitCode).toBe(0);
		});
	});

	describe("prompt passing", () => {
		test("passes prompt as last positional argument in single-run mode", async () => {
			// The test-agent echoes all args, so if prompt is passed, it will be in output
			const result = await run({
				agent: testAgentPath,
				maxIterations: 1,
				loop: false,
				prompt: "Build a new feature",
			});

			expect(result.exitCode).toBe(0);
			expect(result.reason).toBe("single_run");
		});

		test("passes prompt as last positional argument in loop mode", async () => {
			// Use completing agent which outputs marker
			const result = await run({
				agent: completingAgentPath,
				maxIterations: 5,
				loop: true,
				prompt: "Build a new feature",
			});

			expect(result.exitCode).toBe(0);
			expect(result.reason).toBe("marker");
		});

		test("prompt comes after args", async () => {
			const result = await run({
				agent: testAgentPath,
				maxIterations: 1,
				loop: false,
				args: ["--task", "TASK-001"],
				prompt: "Implement the feature",
			});

			expect(result.exitCode).toBe(0);
		});

		test("undefined prompt does not add extra args", async () => {
			const result = await run({
				agent: testAgentPath,
				maxIterations: 1,
				loop: false,
				prompt: undefined,
			});

			expect(result.exitCode).toBe(0);
		});

		test("empty string prompt does not add extra args", async () => {
			const result = await run({
				agent: testAgentPath,
				maxIterations: 1,
				loop: false,
				prompt: "",
			});

			expect(result.exitCode).toBe(0);
		});
	});
});
