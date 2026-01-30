/**
 * Tests for orchestra DSL parser
 * Covers parsing of agent chains with optional iteration counts
 */

import { describe, expect, test } from "bun:test";
import { parseDSL, type ChainStep } from "./parser.ts";

describe("parseDSL", () => {
	describe("single agent without iterations", () => {
		test("parses simple agent name", () => {
			const steps = parseDSL("agent");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "agent",
				iterations: 1,
				loop: false,
			});
		});

		test("parses agent with hyphens", () => {
			const steps = parseDSL("task-coordinator");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "task-coordinator",
				iterations: 1,
				loop: false,
			});
		});

		test("parses agent with underscores", () => {
			const steps = parseDSL("task_worker");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "task_worker",
				iterations: 1,
				loop: false,
			});
		});

		test("parses agent with numbers", () => {
			const steps = parseDSL("agent2");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "agent2",
				iterations: 1,
				loop: false,
			});
		});
	});

	describe("single agent with iterations", () => {
		test("parses agent with iteration count", () => {
			const steps = parseDSL("agent:10");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "agent",
				iterations: 10,
				loop: true,
			});
		});

		test("parses hyphenated agent with iteration count", () => {
			const steps = parseDSL("task-coordinator:15");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "task-coordinator",
				iterations: 15,
				loop: true,
			});
		});

		test("parses iteration count of 1 (explicit loop)", () => {
			const steps = parseDSL("agent:1");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "agent",
				iterations: 1,
				loop: true,
			});
		});

		test("parses large iteration count", () => {
			const steps = parseDSL("agent:1000");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "agent",
				iterations: 1000,
				loop: true,
			});
		});
	});

	describe("pipeline chains with arrow separator", () => {
		test("parses two agents without iterations", () => {
			const steps = parseDSL("a -> b");

			expect(steps).toHaveLength(2);
			expect(steps[0]).toEqual({ agent: "a", iterations: 1, loop: false });
			expect(steps[1]).toEqual({ agent: "b", iterations: 1, loop: false });
		});

		test("parses three agents without iterations", () => {
			const steps = parseDSL("a -> b -> c");

			expect(steps).toHaveLength(3);
			expect(steps[0]).toEqual({ agent: "a", iterations: 1, loop: false });
			expect(steps[1]).toEqual({ agent: "b", iterations: 1, loop: false });
			expect(steps[2]).toEqual({ agent: "c", iterations: 1, loop: false });
		});

		test("parses full agent names in pipeline", () => {
			const steps = parseDSL("task-manager -> task-coordinator -> task-worker");

			expect(steps).toHaveLength(3);
			expect(steps[0]?.agent).toBe("task-manager");
			expect(steps[1]?.agent).toBe("task-coordinator");
			expect(steps[2]?.agent).toBe("task-worker");
		});
	});

	describe("mixed mode chains", () => {
		test("parses first without iterations, second with", () => {
			const steps = parseDSL("a -> b:10");

			expect(steps).toHaveLength(2);
			expect(steps[0]).toEqual({ agent: "a", iterations: 1, loop: false });
			expect(steps[1]).toEqual({ agent: "b", iterations: 10, loop: true });
		});

		test("parses first with iterations, second without", () => {
			const steps = parseDSL("a:5 -> b");

			expect(steps).toHaveLength(2);
			expect(steps[0]).toEqual({ agent: "a", iterations: 5, loop: true });
			expect(steps[1]).toEqual({ agent: "b", iterations: 1, loop: false });
		});

		test("parses complex mixed chain", () => {
			const steps = parseDSL("task-manager -> task-coordinator:10");

			expect(steps).toHaveLength(2);
			expect(steps[0]).toEqual({
				agent: "task-manager",
				iterations: 1,
				loop: false,
			});
			expect(steps[1]).toEqual({
				agent: "task-coordinator",
				iterations: 10,
				loop: true,
			});
		});

		test("parses both with iterations", () => {
			const steps = parseDSL("task-manager:3 -> task-coordinator:10");

			expect(steps).toHaveLength(2);
			expect(steps[0]).toEqual({
				agent: "task-manager",
				iterations: 3,
				loop: true,
			});
			expect(steps[1]).toEqual({
				agent: "task-coordinator",
				iterations: 10,
				loop: true,
			});
		});
	});

	describe("whitespace handling", () => {
		test("handles no whitespace around arrow", () => {
			const steps = parseDSL("a->b");

			expect(steps).toHaveLength(2);
			expect(steps[0]?.agent).toBe("a");
			expect(steps[1]?.agent).toBe("b");
		});

		test("handles extra whitespace around arrow", () => {
			const steps = parseDSL("a    ->    b");

			expect(steps).toHaveLength(2);
			expect(steps[0]?.agent).toBe("a");
			expect(steps[1]?.agent).toBe("b");
		});

		test("handles leading and trailing whitespace", () => {
			const steps = parseDSL("   a -> b   ");

			expect(steps).toHaveLength(2);
			expect(steps[0]?.agent).toBe("a");
			expect(steps[1]?.agent).toBe("b");
		});

		test("handles whitespace around colon", () => {
			const steps = parseDSL("agent : 10");

			expect(steps).toHaveLength(1);
			expect(steps[0]).toEqual({
				agent: "agent",
				iterations: 10,
				loop: true,
			});
		});

		test("handles tabs and newlines gracefully", () => {
			const steps = parseDSL("a\t->\tb");

			expect(steps).toHaveLength(2);
			expect(steps[0]?.agent).toBe("a");
			expect(steps[1]?.agent).toBe("b");
		});
	});

	describe("error handling - invalid syntax", () => {
		test("throws on empty string", () => {
			expect(() => parseDSL("")).toThrow("empty DSL string");
		});

		test("throws on whitespace only", () => {
			expect(() => parseDSL("   ")).toThrow("empty DSL string");
		});

		test("throws on invalid agent name starting with hyphen", () => {
			expect(() => parseDSL("-agent")).toThrow("Invalid agent name");
		});

		test("throws on invalid agent name starting with underscore", () => {
			expect(() => parseDSL("_agent")).toThrow("Invalid agent name");
		});

		test("throws on agent name with spaces", () => {
			expect(() => parseDSL("my agent")).toThrow("Invalid agent name");
		});

		test("throws on agent name with special characters", () => {
			expect(() => parseDSL("agent@1")).toThrow("Invalid agent name");
		});

		test("throws on empty agent name in chain", () => {
			expect(() => parseDSL("a -> -> b")).toThrow("empty agent name");
		});

		test("throws on trailing arrow", () => {
			expect(() => parseDSL("a -> ")).toThrow("empty agent name");
		});

		test("throws on leading arrow", () => {
			expect(() => parseDSL("-> a")).toThrow("empty agent name");
		});
	});

	describe("error handling - iteration counts", () => {
		test("throws on non-numeric iteration count", () => {
			expect(() => parseDSL("agent:abc")).toThrow("must be a number");
		});

		test("throws on negative iteration count", () => {
			expect(() => parseDSL("agent:-5")).toThrow("must be a positive integer");
		});

		test("throws on zero iteration count", () => {
			expect(() => parseDSL("agent:0")).toThrow("must be a positive integer");
		});

		test("throws on decimal iteration count", () => {
			expect(() => parseDSL("agent:3.5")).toThrow("must be an integer");
		});

		test("throws on missing iteration count after colon", () => {
			expect(() => parseDSL("agent:")).toThrow(
				"missing iteration count after colon",
			);
		});

		test("includes agent context in error message", () => {
			expect(() => parseDSL("agent:abc")).toThrow('in "agent:abc"');
		});

		test("includes step number in error for chain", () => {
			expect(() => parseDSL("a -> b:invalid")).toThrow("Step 2:");
		});
	});

	describe("edge cases", () => {
		test("handles agent name that looks like number", () => {
			const steps = parseDSL("agent123");

			expect(steps).toHaveLength(1);
			expect(steps[0]?.agent).toBe("agent123");
		});

		test("handles multiple hyphens in agent name", () => {
			const steps = parseDSL("my-long-agent-name");

			expect(steps).toHaveLength(1);
			expect(steps[0]?.agent).toBe("my-long-agent-name");
		});

		test("handles multiple underscores in agent name", () => {
			const steps = parseDSL("my_long_agent_name");

			expect(steps).toHaveLength(1);
			expect(steps[0]?.agent).toBe("my_long_agent_name");
		});

		test("handles mixed hyphens and underscores", () => {
			const steps = parseDSL("my-agent_name");

			expect(steps).toHaveLength(1);
			expect(steps[0]?.agent).toBe("my-agent_name");
		});

		test("handles long chain", () => {
			const steps = parseDSL("a -> b -> c -> d -> e:5");

			expect(steps).toHaveLength(5);
			expect(steps[0]?.loop).toBe(false);
			expect(steps[4]?.loop).toBe(true);
			expect(steps[4]?.iterations).toBe(5);
		});
	});
});
