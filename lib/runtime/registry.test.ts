/**
 * Tests for runtime registry and backend resolution
 *
 * These tests verify that:
 * - getRuntime() correctly returns registered backends
 * - getRuntime() throws for invalid/unregistered backends
 * - resolveBackend() respects override > flag > env > default priority
 * - hasRuntime() correctly checks registration status
 * - getRegisteredBackends() returns all registered backends
 * - parseBackendFromArgs() correctly parses CLI arguments
 * - isValidBackend() correctly validates backend names
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import {
	DEFAULT_BACKEND,
	BACKEND_ENV_VAR,
	getRuntime,
	getRegisteredBackends,
	hasRuntime,
	isValidBackend,
	parseBackendFromArgs,
	resolveBackend,
} from "./index";
import type { RuntimeBackend } from "./types";

describe("getRuntime", () => {
	test("returns claude-cli runtime for valid backend", () => {
		const runtime = getRuntime("claude-cli");
		expect(runtime).toBeDefined();
		expect(runtime.backend).toBe("claude-cli");
	});

	test("returns codex-cli runtime for valid backend", () => {
		const runtime = getRuntime("codex-cli");
		expect(runtime).toBeDefined();
		expect(runtime.backend).toBe("codex-cli");
	});

	test("throws for invalid backend", () => {
		expect(() => getRuntime("invalid-backend" as RuntimeBackend)).toThrow(
			/not registered/,
		);
	});

	test("error message includes available backends", () => {
		try {
			getRuntime("invalid-backend" as RuntimeBackend);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error instanceof Error).toBe(true);
			const message = (error as Error).message;
			expect(message).toContain("claude-cli");
			expect(message).toContain("codex-cli");
		}
	});

	test("uses resolveBackend when no backend specified", () => {
		// This test verifies getRuntime() calls resolveBackend() when no arg
		// Since default is claude-cli, we expect that runtime
		const runtime = getRuntime();
		expect(runtime.backend).toBe("claude-cli");
	});

	test("returns fresh instance on each call", () => {
		const runtime1 = getRuntime("claude-cli");
		const runtime2 = getRuntime("claude-cli");
		// Factory creates new instances
		expect(runtime1).not.toBe(runtime2);
	});
});

describe("hasRuntime", () => {
	test("returns true for registered backend", () => {
		expect(hasRuntime("claude-cli")).toBe(true);
		expect(hasRuntime("codex-cli")).toBe(true);
	});

	test("returns false for unregistered backend", () => {
		expect(hasRuntime("invalid-backend" as RuntimeBackend)).toBe(false);
	});
});

describe("getRegisteredBackends", () => {
	test("returns array of registered backends", () => {
		const backends = getRegisteredBackends();
		expect(Array.isArray(backends)).toBe(true);
		expect(backends).toContain("claude-cli");
		expect(backends).toContain("codex-cli");
	});

	test("includes at least claude-cli and codex-cli", () => {
		const backends = getRegisteredBackends();
		expect(backends.length).toBeGreaterThanOrEqual(2);
	});
});

describe("isValidBackend", () => {
	test("returns true for valid backends", () => {
		expect(isValidBackend("claude-cli")).toBe(true);
		expect(isValidBackend("codex-cli")).toBe(true);
		expect(isValidBackend("codex-sdk")).toBe(true);
	});

	test("returns false for invalid backends", () => {
		expect(isValidBackend("invalid")).toBe(false);
		expect(isValidBackend("")).toBe(false);
		expect(isValidBackend("claude")).toBe(false);
		expect(isValidBackend("codex")).toBe(false);
	});
});

describe("parseBackendFromArgs", () => {
	test("parses --backend flag from args", () => {
		const args = ["node", "script.ts", "--backend", "codex-cli"];
		const result = parseBackendFromArgs(args);
		expect(result).toBe("codex-cli");
	});

	test("returns undefined when no --backend flag", () => {
		const args = ["node", "script.ts", "--other", "value"];
		const result = parseBackendFromArgs(args);
		expect(result).toBeUndefined();
	});

	test("returns undefined for invalid backend value", () => {
		const args = ["node", "script.ts", "--backend", "invalid"];
		const result = parseBackendFromArgs(args);
		expect(result).toBeUndefined();
	});

	test("returns undefined when --backend is last arg (no value)", () => {
		const args = ["node", "script.ts", "--backend"];
		const result = parseBackendFromArgs(args);
		expect(result).toBeUndefined();
	});

	test("parses claude-cli backend", () => {
		const args = ["--backend", "claude-cli"];
		const result = parseBackendFromArgs(args);
		expect(result).toBe("claude-cli");
	});

	test("parses codex-sdk backend", () => {
		const args = ["--backend", "codex-sdk"];
		const result = parseBackendFromArgs(args);
		expect(result).toBe("codex-sdk");
	});

	test("uses process.argv by default", () => {
		// This test verifies the default behavior
		// Note: This is hard to test without modifying process.argv
		// We just verify it doesn't throw
		const result = parseBackendFromArgs();
		expect(result === undefined || isValidBackend(result)).toBe(true);
	});
});

describe("resolveBackend", () => {
	let originalEnv: string | undefined;
	let originalArgv: string[];

	beforeEach(() => {
		originalEnv = process.env[BACKEND_ENV_VAR];
		originalArgv = process.argv;
		delete process.env[BACKEND_ENV_VAR];
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env[BACKEND_ENV_VAR] = originalEnv;
		} else {
			delete process.env[BACKEND_ENV_VAR];
		}
		process.argv = originalArgv;
	});

	test("returns default backend when nothing specified", () => {
		process.argv = ["node", "script.ts"];
		const result = resolveBackend();
		expect(result).toBe(DEFAULT_BACKEND);
		expect(result).toBe("claude-cli");
	});

	test("explicit override takes highest priority", () => {
		process.env[BACKEND_ENV_VAR] = "codex-cli";
		process.argv = ["node", "script.ts", "--backend", "codex-sdk"];

		const result = resolveBackend("claude-cli");
		expect(result).toBe("claude-cli");
	});

	test("CLI flag takes priority over env var", () => {
		process.env[BACKEND_ENV_VAR] = "codex-sdk";
		process.argv = ["node", "script.ts", "--backend", "codex-cli"];

		const result = resolveBackend();
		expect(result).toBe("codex-cli");
	});

	test("env var takes priority over default", () => {
		process.argv = ["node", "script.ts"];
		process.env[BACKEND_ENV_VAR] = "codex-cli";

		const result = resolveBackend();
		expect(result).toBe("codex-cli");
	});

	test("warns and uses default for invalid env value", () => {
		// Mock console.warn to capture the warning
		const warnMock = mock(() => {});
		const originalWarn = console.warn;
		console.warn = warnMock;

		process.argv = ["node", "script.ts"];
		process.env[BACKEND_ENV_VAR] = "invalid-backend";

		const result = resolveBackend();

		expect(result).toBe(DEFAULT_BACKEND);
		expect(warnMock).toHaveBeenCalled();
		expect(warnMock.mock.calls.length).toBeGreaterThan(0);
		const firstCall = warnMock.mock.calls[0] as unknown[];
		expect(firstCall).toBeDefined();
		const callArg = firstCall[0] as string;
		expect(callArg).toContain("Invalid");

		console.warn = originalWarn;
	});

	test("respects FORGE_BACKEND env var name", () => {
		expect(BACKEND_ENV_VAR).toBe("FORGE_BACKEND");
	});

	test("default backend is claude-cli", () => {
		expect(DEFAULT_BACKEND).toBe("claude-cli");
	});
});

describe("Constants", () => {
	test("DEFAULT_BACKEND is claude-cli", () => {
		expect(DEFAULT_BACKEND).toBe("claude-cli");
	});

	test("BACKEND_ENV_VAR is FORGE_BACKEND", () => {
		expect(BACKEND_ENV_VAR).toBe("FORGE_BACKEND");
	});
});
