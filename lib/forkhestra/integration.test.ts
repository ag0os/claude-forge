/**
 * Integration tests for forkhestra direct spawn functionality
 *
 * These tests verify the full direct spawn flow works end-to-end,
 * including command construction, max-turns handling, and error cases.
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "bun";

import {
	loadConfig,
	type AgentConfig,
	isDirectSpawnAgent,
} from "./config";
import { loadAgentSystemPrompt, composeSystemPrompt, MODE_AWARENESS_PREFIX } from "./mode-awareness";
import { COMPLETION_MARKER } from "./constants";

// Test directory setup
const tmpDir = "/tmp/forkhestra-integration-test";
const forgeDir = join(tmpDir, "forge/orch");
const promptsDir = join(tmpDir, "system-prompts/fk");

beforeAll(() => {
	// Create directory structure
	mkdirSync(forgeDir, { recursive: true });
	mkdirSync(promptsDir, { recursive: true });

	// Create test system prompt files
	writeFileSync(
		join(promptsDir, "test-planner.md"),
		"You are a test planner agent.\n\nYour job is to create implementation tasks."
	);

	writeFileSync(
		join(promptsDir, "test-builder.md"),
		"You are a test builder agent.\n\nYour job is to implement tasks."
	);

	// Create test chains.json with direct spawn agents
	const chainsConfig = {
		agents: {
			"test:planner": {
				systemPrompt: "system-prompts/fk/test-planner.md",
				model: "sonnet",
				maxTurns: 10,
				allowedTools: ["Read", "Grep", "Glob", "Bash"],
			},
			"test:builder": {
				systemPrompt: "system-prompts/fk/test-builder.md",
				model: "opus",
				maxTurns: 25,
			},
			"test:inline": {
				systemPromptText: "You are an inline test agent with no file.",
				model: "haiku",
				maxTurns: 5,
				disallowedTools: ["WebSearch"],
			},
			"test:binary": {
				defaultPrompt: "This is a binary agent without direct spawn",
			},
			"test:with-mcp": {
				systemPromptText: "Agent with MCP config.",
				mcpConfig: "settings/test.mcp.json",
				settings: "settings/test.settings.json",
			},
			"test:missing-file": {
				systemPrompt: "system-prompts/nonexistent.md",
			},
		},
		chains: {
			"test-ralph": {
				description: "Test forkhestra planning and building workflow.",
				steps: [
					{ agent: "test:planner", iterations: 3 },
					{ agent: "test:builder", iterations: 20 },
				],
			},
			"test-inline": {
				description: "Test chain with inline system prompt.",
				steps: [{ agent: "test:inline", iterations: 5 }],
			},
			"test-missing-file": {
				description: "Test chain with missing system prompt file.",
				steps: [{ agent: "test:missing-file", iterations: 1 }],
			},
		},
	};

	writeFileSync(join(forgeDir, "chains.json"), JSON.stringify(chainsConfig, null, 2));
});

afterAll(() => {
	// Cleanup test directory
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("integration: direct spawn configuration", () => {
	test("loads ralph chain configuration correctly", async () => {
		const config = await loadConfig(tmpDir);

		expect(config).not.toBeNull();
		expect(config?.chains["test-ralph"]).toBeDefined();
		expect(config?.chains["test-ralph"]?.steps.length).toBe(2);
		expect(config?.chains["test-ralph"]?.steps[0]?.agent).toBe("test:planner");
		expect(config?.chains["test-ralph"]?.steps[1]?.agent).toBe("test:builder");
	});

	test("identifies direct spawn agents correctly", async () => {
		const config = await loadConfig(tmpDir);
		expect(config).not.toBeNull();

		const plannerConfig = config?.agents?.["test:planner"];
		const builderConfig = config?.agents?.["test:builder"];
		const inlineConfig = config?.agents?.["test:inline"];
		const binaryConfig = config?.agents?.["test:binary"];

		expect(plannerConfig).toBeDefined();
		expect(builderConfig).toBeDefined();
		expect(inlineConfig).toBeDefined();
		expect(binaryConfig).toBeDefined();

		// Direct spawn agents have systemPrompt or systemPromptText
		expect(isDirectSpawnAgent(plannerConfig!)).toBe(true);
		expect(isDirectSpawnAgent(builderConfig!)).toBe(true);
		expect(isDirectSpawnAgent(inlineConfig!)).toBe(true);

		// Binary agent has neither
		expect(isDirectSpawnAgent(binaryConfig!)).toBe(false);
	});

	test("loads agent configurations with all direct spawn fields", async () => {
		const config = await loadConfig(tmpDir);
		expect(config).not.toBeNull();

		const plannerConfig = config?.agents?.["test:planner"];
		expect(plannerConfig).toBeDefined();
		expect(plannerConfig?.systemPrompt).toBe("system-prompts/fk/test-planner.md");
		expect(plannerConfig?.model).toBe("sonnet");
		expect(plannerConfig?.maxTurns).toBe(10);
		expect(plannerConfig?.allowedTools).toEqual(["Read", "Grep", "Glob", "Bash"]);

		const builderConfig = config?.agents?.["test:builder"];
		expect(builderConfig?.model).toBe("opus");
		expect(builderConfig?.maxTurns).toBe(25);

		const inlineConfig = config?.agents?.["test:inline"];
		expect(inlineConfig?.systemPromptText).toBe("You are an inline test agent with no file.");
		expect(inlineConfig?.model).toBe("haiku");
		expect(inlineConfig?.maxTurns).toBe(5);
		expect(inlineConfig?.disallowedTools).toEqual(["WebSearch"]);

		const mcpConfig = config?.agents?.["test:with-mcp"];
		expect(mcpConfig?.mcpConfig).toBe("settings/test.mcp.json");
		expect(mcpConfig?.settings).toBe("settings/test.settings.json");
	});
});

describe("integration: system prompt loading", () => {
	test("loads system prompt from file path", async () => {
		const agentConfig: AgentConfig = {
			systemPrompt: "system-prompts/fk/test-planner.md",
		};

		const prompt = await loadAgentSystemPrompt(agentConfig, tmpDir);

		expect(prompt).toBeDefined();
		expect(prompt).toContain("You are a test planner agent.");
		expect(prompt).toContain("Your job is to create implementation tasks.");
	});

	test("loads system prompt from inline text (takes priority)", async () => {
		const agentConfig: AgentConfig = {
			systemPrompt: "system-prompts/fk/test-planner.md", // Should be ignored
			systemPromptText: "Inline prompt takes priority over file",
		};

		const prompt = await loadAgentSystemPrompt(agentConfig, tmpDir);

		expect(prompt).toBe("Inline prompt takes priority over file");
	});

	test("returns undefined for non-direct-spawn agents", async () => {
		const agentConfig: AgentConfig = {
			defaultPrompt: "This is not a direct spawn agent",
		};

		const prompt = await loadAgentSystemPrompt(agentConfig, tmpDir);

		expect(prompt).toBeUndefined();
	});

	test("throws error for missing system prompt file", async () => {
		const agentConfig: AgentConfig = {
			systemPrompt: "system-prompts/nonexistent.md",
		};

		await expect(loadAgentSystemPrompt(agentConfig, tmpDir)).rejects.toThrow(
			"System prompt file not found"
		);
	});
});

describe("integration: system prompt composition", () => {
	test("composes system prompt with mode awareness prefix", () => {
		const agentPrompt = "You are a helpful assistant.";
		const composed = composeSystemPrompt(agentPrompt);

		expect(composed).toContain(MODE_AWARENESS_PREFIX);
		expect(composed).toContain(agentPrompt);
		expect(composed.indexOf(MODE_AWARENESS_PREFIX)).toBe(0);
		expect(composed.indexOf(agentPrompt)).toBeGreaterThan(MODE_AWARENESS_PREFIX.length - 1);
	});

	test("composed prompt includes completion marker instruction", () => {
		const agentPrompt = "Test agent";
		const composed = composeSystemPrompt(agentPrompt);

		expect(composed).toContain(COMPLETION_MARKER);
		expect(composed).toContain("ORCHESTRA_COMPLETE");
		expect(composed).toContain("HEADLESS mode");
		expect(composed).toContain("CANNOT ask the user questions");
	});

	test("full composition flow from agent config", async () => {
		const agentConfig: AgentConfig = {
			systemPrompt: "system-prompts/fk/test-planner.md",
		};

		const rawPrompt = await loadAgentSystemPrompt(agentConfig, tmpDir);
		expect(rawPrompt).toBeDefined();

		const composed = composeSystemPrompt(rawPrompt!);

		// Should have mode awareness prefix
		expect(composed).toContain("HEADLESS mode");
		expect(composed).toContain(COMPLETION_MARKER);

		// Should have agent-specific content
		expect(composed).toContain("You are a test planner agent.");
	});
});

describe("integration: claude command construction", () => {
	/**
	 * Helper function that simulates the buildClaudeArgs logic from runner.ts
	 * This allows us to test command construction without spawning claude
	 */
	function buildTestClaudeArgs(
		agentConfig: AgentConfig,
		composedSystemPrompt: string,
		cwd: string
	): string[] {
		const { isAbsolute, join } = require("node:path");

		const args: string[] = [
			"--print",
			"--dangerously-skip-permissions",
			"--append-system-prompt",
			composedSystemPrompt,
		];

		if (agentConfig.maxTurns !== undefined) {
			args.push("--max-turns", String(agentConfig.maxTurns));
		}

		if (agentConfig.model !== undefined) {
			args.push("--model", agentConfig.model);
		}

		if (agentConfig.mcpConfig !== undefined) {
			const mcpPath = isAbsolute(agentConfig.mcpConfig)
				? agentConfig.mcpConfig
				: join(cwd, agentConfig.mcpConfig);
			args.push("--mcp-config", mcpPath);
		}

		if (agentConfig.settings !== undefined) {
			const settingsPath = isAbsolute(agentConfig.settings)
				? agentConfig.settings
				: join(cwd, agentConfig.settings);
			args.push("--settings", settingsPath);
		}

		if (agentConfig.allowedTools !== undefined && agentConfig.allowedTools.length > 0) {
			args.push("--allowedTools", agentConfig.allowedTools.join(","));
		}

		if (agentConfig.disallowedTools !== undefined && agentConfig.disallowedTools.length > 0) {
			args.push("--disallowedTools", agentConfig.disallowedTools.join(","));
		}

		return args;
	}

	test("constructs claude args with --print and --dangerously-skip-permissions", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--print");
		expect(args).toContain("--dangerously-skip-permissions");
	});

	test("constructs claude args with --append-system-prompt", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--append-system-prompt");
		const promptIndex = args.indexOf("--append-system-prompt");
		expect(args[promptIndex + 1]).toBe(composed);
	});

	test("constructs claude args with --max-turns when configured", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
			maxTurns: 15,
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--max-turns");
		const maxTurnsIndex = args.indexOf("--max-turns");
		expect(args[maxTurnsIndex + 1]).toBe("15");
	});

	test("constructs claude args with --model when configured", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
			model: "opus",
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--model");
		const modelIndex = args.indexOf("--model");
		expect(args[modelIndex + 1]).toBe("opus");
	});

	test("constructs claude args with --allowedTools when configured", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
			allowedTools: ["Read", "Grep", "Bash"],
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--allowedTools");
		const toolsIndex = args.indexOf("--allowedTools");
		expect(args[toolsIndex + 1]).toBe("Read,Grep,Bash");
	});

	test("constructs claude args with --disallowedTools when configured", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
			disallowedTools: ["WebSearch", "WebFetch"],
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--disallowedTools");
		const toolsIndex = args.indexOf("--disallowedTools");
		expect(args[toolsIndex + 1]).toBe("WebSearch,WebFetch");
	});

	test("constructs claude args with --mcp-config when configured", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
			mcpConfig: "settings/test.mcp.json",
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--mcp-config");
		const mcpIndex = args.indexOf("--mcp-config");
		expect(args[mcpIndex + 1]).toBe(join(tmpDir, "settings/test.mcp.json"));
	});

	test("constructs claude args with --settings when configured", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Test prompt",
			settings: "settings/test.settings.json",
		};

		const composed = composeSystemPrompt("Test prompt");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		expect(args).toContain("--settings");
		const settingsIndex = args.indexOf("--settings");
		expect(args[settingsIndex + 1]).toBe(join(tmpDir, "settings/test.settings.json"));
	});

	test("constructs full claude command for ralph planner agent", async () => {
		const config = await loadConfig(tmpDir);
		expect(config).not.toBeNull();

		const plannerConfig = config?.agents?.["test:planner"];
		expect(plannerConfig).toBeDefined();

		const rawPrompt = await loadAgentSystemPrompt(plannerConfig!, tmpDir);
		expect(rawPrompt).toBeDefined();

		const composed = composeSystemPrompt(rawPrompt!);
		const args = buildTestClaudeArgs(plannerConfig!, composed, tmpDir);

		// Verify all expected flags are present
		expect(args).toContain("--print");
		expect(args).toContain("--dangerously-skip-permissions");
		expect(args).toContain("--append-system-prompt");
		expect(args).toContain("--max-turns");
		expect(args).toContain("--model");
		expect(args).toContain("--allowedTools");

		// Verify values
		const maxTurnsIndex = args.indexOf("--max-turns");
		expect(args[maxTurnsIndex + 1]).toBe("10");

		const modelIndex = args.indexOf("--model");
		expect(args[modelIndex + 1]).toBe("sonnet");

		const toolsIndex = args.indexOf("--allowedTools");
		expect(args[toolsIndex + 1]).toBe("Read,Grep,Glob,Bash");
	});

	test("omits undefined optional flags", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Minimal config",
			// No maxTurns, model, allowedTools, etc.
		};

		const composed = composeSystemPrompt("Minimal config");
		const args = buildTestClaudeArgs(agentConfig, composed, tmpDir);

		// Should only have required flags
		expect(args).toContain("--print");
		expect(args).toContain("--dangerously-skip-permissions");
		expect(args).toContain("--append-system-prompt");

		// Should NOT have optional flags
		expect(args).not.toContain("--max-turns");
		expect(args).not.toContain("--model");
		expect(args).not.toContain("--allowedTools");
		expect(args).not.toContain("--disallowedTools");
		expect(args).not.toContain("--mcp-config");
		expect(args).not.toContain("--settings");
	});
});

describe("integration: dry-run with forkhestra CLI", () => {
	/**
	 * Helper to run forkhestra CLI and capture output
	 */
	async function runForkhestra(
		args: string[],
		cwd: string
	): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		// Path to forkhestra CLI
		const forkhestraPath = join(
			import.meta.dir,
			"../../agents/orch/forkhestra.ts"
		);

		const proc = spawn(["bun", "run", forkhestraPath, ...args], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
			env: process.env,
		});

		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		await proc.exited;

		return {
			stdout,
			stderr,
			exitCode: proc.exitCode ?? 0,
		};
	}

	test("forkhestra --chain test-ralph --dry-run shows chain steps", async () => {
		const result = await runForkhestra(
			["--chain", "test-ralph", "--dry-run"],
			tmpDir
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Dry run");
		expect(result.stdout).toContain("test:planner");
		expect(result.stdout).toContain("test:builder");
		expect(result.stdout).toContain("loop up to 3 iterations");
		expect(result.stdout).toContain("loop up to 20 iterations");
	});

	test("forkhestra --chain test-inline --dry-run works with inline prompts", async () => {
		const result = await runForkhestra(
			["--chain", "test-inline", "--dry-run"],
			tmpDir
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Dry run");
		expect(result.stdout).toContain("test:inline");
		expect(result.stdout).toContain("loop up to 5 iterations");
	});

	test("forkhestra --dry-run with prompt option shows resolved prompt", async () => {
		const result = await runForkhestra(
			["--chain", "test-ralph", "--dry-run", "--prompt", "Build the login feature"],
			tmpDir
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("prompt:");
		expect(result.stdout).toContain("Build the login feature");
	});

	test("forkhestra --help shows usage information", async () => {
		const result = await runForkhestra(["--help"], tmpDir);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("forkhestra");
		expect(result.stdout).toContain("--dry-run");
		expect(result.stdout).toContain("--chain");
		expect(result.stdout).toContain("--prompt");
	});

	test("forkhestra reports error for missing chain", async () => {
		const result = await runForkhestra(
			["--chain", "nonexistent-chain", "--dry-run"],
			tmpDir
		);

		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("not found");
	});
});

describe("integration: error handling for missing prompt files", () => {
	test("loadAgentSystemPrompt throws clear error for missing file", async () => {
		const agentConfig: AgentConfig = {
			systemPrompt: "system-prompts/does-not-exist.md",
		};

		try {
			await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain("System prompt file not found");
			expect((error as Error).message).toContain("does-not-exist.md");
		}
	});

	test("error message includes the file path that was attempted", async () => {
		const agentConfig: AgentConfig = {
			systemPrompt: "custom/path/to/missing.md",
		};

		try {
			await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(true).toBe(false);
		} catch (error) {
			expect((error as Error).message).toContain("custom/path/to/missing.md");
		}
	});
});

describe("integration: chain iteration limits", () => {
	test("chain steps have correct iteration counts", async () => {
		const config = await loadConfig(tmpDir);
		expect(config).not.toBeNull();

		const ralphChain = config?.chains["test-ralph"];
		expect(ralphChain).toBeDefined();

		expect(ralphChain?.steps[0]?.iterations).toBe(3);
		expect(ralphChain?.steps[0]?.loop).toBe(true);

		expect(ralphChain?.steps[1]?.iterations).toBe(20);
		expect(ralphChain?.steps[1]?.loop).toBe(true);
	});

	test("inline chain has correct iteration count", async () => {
		const config = await loadConfig(tmpDir);
		expect(config).not.toBeNull();

		const inlineChain = config?.chains["test-inline"];
		expect(inlineChain).toBeDefined();

		expect(inlineChain?.steps[0]?.iterations).toBe(5);
		expect(inlineChain?.steps[0]?.loop).toBe(true);
	});
});
