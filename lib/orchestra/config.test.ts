/**
 * Tests for orchestra config loader and schema validation
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	loadConfig,
	substituteVars,
	substituteVarsInChain,
	getChain,
	isDirectSpawnAgent,
	type ChainStep,
	type ChainConfig,
	type AgentConfig,
} from "./config";

// Create temporary test directory
const tmpDir = "/tmp/orchestra-config-test";

beforeAll(() => {
	mkdirSync(join(tmpDir, "forge/orch"), { recursive: true });
});

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(config: unknown) {
	writeFileSync(
		join(tmpDir, "forge/orch/chains.json"),
		JSON.stringify(config, null, 2)
	);
}

describe("config schema validation", () => {
	describe("AgentConfig interface", () => {
		test("accepts valid agent config with defaultPrompt", async () => {
			writeConfig({
				chains: {},
				agents: {
					"my-agent": {
						defaultPrompt: "Hello, this is a prompt",
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.agents?.["my-agent"]?.defaultPrompt).toBe(
				"Hello, this is a prompt"
			);
		});

		test("accepts valid agent config with defaultPromptFile", async () => {
			writeConfig({
				chains: {},
				agents: {
					"my-agent": {
						defaultPromptFile: "prompts/my-prompt.md",
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.agents?.["my-agent"]?.defaultPromptFile).toBe(
				"prompts/my-prompt.md"
			);
		});

		test("accepts agent config with both defaultPrompt and defaultPromptFile", async () => {
			writeConfig({
				chains: {},
				agents: {
					"my-agent": {
						defaultPrompt: "Inline prompt",
						defaultPromptFile: "prompts/file.md",
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.agents?.["my-agent"]?.defaultPrompt).toBe("Inline prompt");
			expect(config?.agents?.["my-agent"]?.defaultPromptFile).toBe(
				"prompts/file.md"
			);
		});

		test("rejects non-string defaultPrompt", async () => {
			writeConfig({
				chains: {},
				agents: {
					"my-agent": {
						defaultPrompt: 123,
					},
				},
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"agent 'my-agent' defaultPrompt must be a string"
			);
		});

		test("rejects non-string defaultPromptFile", async () => {
			writeConfig({
				chains: {},
				agents: {
					"my-agent": {
						defaultPromptFile: ["array", "of", "strings"],
					},
				},
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"agent 'my-agent' defaultPromptFile must be a string"
			);
		});

		test("rejects null agent config", async () => {
			writeConfig({
				chains: {},
				agents: {
					"my-agent": null,
				},
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"agent 'my-agent' must be an object"
			);
		});

		// Direct spawn fields tests
		describe("direct spawn fields", () => {
			test("accepts valid agent config with systemPrompt", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							systemPrompt: "prompts/system.md",
						},
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["my-agent"]?.systemPrompt).toBe(
					"prompts/system.md"
				);
			});

			test("accepts valid agent config with systemPromptText", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							systemPromptText: "You are a helpful assistant.",
						},
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["my-agent"]?.systemPromptText).toBe(
					"You are a helpful assistant."
				);
			});

			test("accepts valid agent config with mcpConfig", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							mcpConfig: "settings/agent.mcp.json",
						},
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["my-agent"]?.mcpConfig).toBe(
					"settings/agent.mcp.json"
				);
			});

			test("accepts valid agent config with settings", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							settings: "settings/agent.settings.json",
						},
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["my-agent"]?.settings).toBe(
					"settings/agent.settings.json"
				);
			});

			test("accepts valid agent config with model", async () => {
				writeConfig({
					chains: {},
					agents: {
						"sonnet-agent": { model: "sonnet" },
						"opus-agent": { model: "opus" },
						"haiku-agent": { model: "haiku" },
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["sonnet-agent"]?.model).toBe("sonnet");
				expect(config?.agents?.["opus-agent"]?.model).toBe("opus");
				expect(config?.agents?.["haiku-agent"]?.model).toBe("haiku");
			});

			test("accepts valid agent config with maxTurns", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							maxTurns: 50,
						},
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["my-agent"]?.maxTurns).toBe(50);
			});

			test("accepts valid agent config with allowedTools", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							allowedTools: ["Read", "Write", "Bash"],
						},
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["my-agent"]?.allowedTools).toEqual([
					"Read",
					"Write",
					"Bash",
				]);
			});

			test("accepts valid agent config with disallowedTools", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							disallowedTools: ["WebFetch", "WebSearch"],
						},
					},
				});

				const config = await loadConfig(tmpDir);
				expect(config?.agents?.["my-agent"]?.disallowedTools).toEqual([
					"WebFetch",
					"WebSearch",
				]);
			});

			test("accepts full direct spawn config with all fields", async () => {
				writeConfig({
					chains: {},
					agents: {
						"full-agent": {
							defaultPrompt: "Default prompt",
							defaultPromptFile: "prompts/default.md",
							systemPrompt: "prompts/system.md",
							systemPromptText: "Inline system prompt",
							mcpConfig: "settings/mcp.json",
							settings: "settings/agent.json",
							model: "opus",
							maxTurns: 100,
							allowedTools: ["Read", "Write"],
							disallowedTools: ["Bash"],
						},
					},
				});

				const config = await loadConfig(tmpDir);
				const agent = config?.agents?.["full-agent"];
				expect(agent?.defaultPrompt).toBe("Default prompt");
				expect(agent?.defaultPromptFile).toBe("prompts/default.md");
				expect(agent?.systemPrompt).toBe("prompts/system.md");
				expect(agent?.systemPromptText).toBe("Inline system prompt");
				expect(agent?.mcpConfig).toBe("settings/mcp.json");
				expect(agent?.settings).toBe("settings/agent.json");
				expect(agent?.model).toBe("opus");
				expect(agent?.maxTurns).toBe(100);
				expect(agent?.allowedTools).toEqual(["Read", "Write"]);
				expect(agent?.disallowedTools).toEqual(["Bash"]);
			});

			// Validation rejection tests
			test("rejects non-string systemPrompt", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							systemPrompt: 123,
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' systemPrompt must be a string"
				);
			});

			test("rejects non-string systemPromptText", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							systemPromptText: ["array", "of", "strings"],
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' systemPromptText must be a string"
				);
			});

			test("rejects non-string mcpConfig", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							mcpConfig: { path: "mcp.json" },
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' mcpConfig must be a string"
				);
			});

			test("rejects non-string settings", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							settings: true,
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' settings must be a string"
				);
			});

			test("rejects non-string model", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							model: 42,
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' model must be a string"
				);
			});

			test("rejects invalid model value", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							model: "gpt-4",
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' model must be one of: sonnet, opus, haiku"
				);
			});

			test("rejects non-number maxTurns", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							maxTurns: "fifty",
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' maxTurns must be a number"
				);
			});

			test("rejects non-positive maxTurns", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							maxTurns: 0,
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' maxTurns must be a positive integer"
				);
			});

			test("rejects non-integer maxTurns", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							maxTurns: 10.5,
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' maxTurns must be a positive integer"
				);
			});

			test("rejects non-array allowedTools", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							allowedTools: "Read,Write",
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' allowedTools must be an array"
				);
			});

			test("rejects non-string elements in allowedTools", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							allowedTools: ["Read", 123, "Write"],
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' allowedTools[1] must be a string"
				);
			});

			test("rejects non-array disallowedTools", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							disallowedTools: "Bash",
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' disallowedTools must be an array"
				);
			});

			test("rejects non-string elements in disallowedTools", async () => {
				writeConfig({
					chains: {},
					agents: {
						"my-agent": {
							disallowedTools: [null, "Bash"],
						},
					},
				});

				await expect(loadConfig(tmpDir)).rejects.toThrow(
					"agent 'my-agent' disallowedTools[0] must be a string"
				);
			});
		});
	});

	describe("OrchestraConfig agents section", () => {
		test("config without agents section is valid", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						steps: [{ agent: "test-agent" }],
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.agents).toBeUndefined();
		});

		test("config with empty agents section is valid", async () => {
			writeConfig({
				chains: {},
				agents: {},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.agents).toEqual({});
		});

		test("rejects non-object agents section", async () => {
			writeConfig({
				chains: {},
				agents: "not-an-object",
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"'agents' must be an object"
			);
		});

		test("rejects null agents section", async () => {
			writeConfig({
				chains: {},
				agents: null,
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"'agents' must be an object"
			);
		});
	});

	describe("ChainConfig prompt fields", () => {
		test("accepts valid chain config with prompt", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						prompt: "Work on this task",
						steps: [{ agent: "test-agent" }],
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.chains["test-chain"]?.prompt).toBe("Work on this task");
		});

		test("accepts valid chain config with promptFile", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						promptFile: "prompts/chain-prompt.md",
						steps: [{ agent: "test-agent" }],
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.chains["test-chain"]?.promptFile).toBe(
				"prompts/chain-prompt.md"
			);
		});

		test("rejects non-string prompt in chain", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						prompt: 42,
						steps: [{ agent: "test-agent" }],
					},
				},
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"chain 'test-chain' prompt must be a string"
			);
		});

		test("rejects non-string promptFile in chain", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						promptFile: { path: "file.md" },
						steps: [{ agent: "test-agent" }],
					},
				},
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"chain 'test-chain' promptFile must be a string"
			);
		});
	});

	describe("ChainStep prompt fields", () => {
		test("accepts valid step config with prompt", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						steps: [
							{
								agent: "test-agent",
								prompt: "Step-specific prompt",
							},
						],
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.chains["test-chain"]?.steps[0]?.prompt).toBe(
				"Step-specific prompt"
			);
		});

		test("accepts valid step config with promptFile", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						steps: [
							{
								agent: "test-agent",
								promptFile: "prompts/step-prompt.md",
							},
						],
					},
				},
			});

			const config = await loadConfig(tmpDir);
			expect(config?.chains["test-chain"]?.steps[0]?.promptFile).toBe(
				"prompts/step-prompt.md"
			);
		});

		test("rejects non-string prompt in step", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						steps: [
							{
								agent: "test-agent",
								prompt: false,
							},
						],
					},
				},
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"chain 'test-chain' step 1 'prompt' must be a string"
			);
		});

		test("rejects non-string promptFile in step", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						steps: [
							{
								agent: "test-agent",
								promptFile: 999,
							},
						],
					},
				},
			});

			await expect(loadConfig(tmpDir)).rejects.toThrow(
				"chain 'test-chain' step 1 'promptFile' must be a string"
			);
		});

		test("accepts step with both prompt and promptFile", async () => {
			writeConfig({
				chains: {
					"test-chain": {
						steps: [
							{
								agent: "test-agent",
								prompt: "Inline prompt",
								promptFile: "prompts/file.md",
							},
						],
					},
				},
			});

			const config = await loadConfig(tmpDir);
			const step = config?.chains["test-chain"]?.steps[0];
			expect(step?.prompt).toBe("Inline prompt");
			expect(step?.promptFile).toBe("prompts/file.md");
		});
	});
});

describe("variable substitution in prompt fields", () => {
	describe("substituteVars for steps", () => {
		test("substitutes variables in step prompt", () => {
			const steps: ChainStep[] = [
				{
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Work on ${TASK_ID} in ${PROJECT}",
				},
			];

			const result = substituteVars(steps, {
				TASK_ID: "TASK-001",
				PROJECT: "my-project",
			});

			expect(result[0]?.prompt).toBe("Work on TASK-001 in my-project");
		});

		test("substitutes variables in step promptFile", () => {
			const steps: ChainStep[] = [
				{
					agent: "test-agent",
					iterations: 1,
					loop: false,
					promptFile: "prompts/${TASK_TYPE}/template.md",
				},
			];

			const result = substituteVars(steps, { TASK_TYPE: "feature" });

			expect(result[0]?.promptFile).toBe("prompts/feature/template.md");
		});

		test("substitutes variables in both prompt and promptFile", () => {
			const steps: ChainStep[] = [
				{
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Task: ${TASK_ID}",
					promptFile: "prompts/${CATEGORY}/task.md",
				},
			];

			const result = substituteVars(steps, {
				TASK_ID: "TASK-042",
				CATEGORY: "backend",
			});

			expect(result[0]?.prompt).toBe("Task: TASK-042");
			expect(result[0]?.promptFile).toBe("prompts/backend/task.md");
		});

		test("throws error for missing variable in prompt", () => {
			const steps: ChainStep[] = [
				{
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Work on ${UNDEFINED_VAR}",
				},
			];

			expect(() => substituteVars(steps, {})).toThrow(
				"Variable 'UNDEFINED_VAR' referenced in 'test-agent' but not provided"
			);
		});

		test("throws error for missing variable in promptFile", () => {
			const steps: ChainStep[] = [
				{
					agent: "my-worker",
					iterations: 1,
					loop: false,
					promptFile: "prompts/${MISSING}/file.md",
				},
			];

			expect(() => substituteVars(steps, {})).toThrow(
				"Variable 'MISSING' referenced in 'my-worker' but not provided"
			);
		});

		test("leaves steps without prompts unchanged", () => {
			const steps: ChainStep[] = [
				{
					agent: "test-agent",
					iterations: 1,
					loop: false,
					args: ["--task", "${TASK_ID}"],
				},
			];

			const result = substituteVars(steps, { TASK_ID: "TASK-001" });

			expect(result[0]?.args).toEqual(["--task", "TASK-001"]);
			expect(result[0]?.prompt).toBeUndefined();
			expect(result[0]?.promptFile).toBeUndefined();
		});
	});

	describe("substituteVarsInChain", () => {
		test("substitutes variables in chain prompt", () => {
			const chain: ChainConfig = {
				steps: [],
				prompt: "Execute chain for ${PROJECT_NAME}",
			};

			const result = substituteVarsInChain(chain, { PROJECT_NAME: "my-app" });

			expect(result.prompt).toBe("Execute chain for my-app");
		});

		test("substitutes variables in chain promptFile", () => {
			const chain: ChainConfig = {
				steps: [],
				promptFile: "chains/${CHAIN_TYPE}/prompt.md",
			};

			const result = substituteVarsInChain(chain, { CHAIN_TYPE: "deploy" });

			expect(result.promptFile).toBe("chains/deploy/prompt.md");
		});

		test("substitutes variables in both chain-level and step-level prompts", () => {
			const chain: ChainConfig = {
				steps: [
					{
						agent: "worker",
						iterations: 1,
						loop: false,
						prompt: "Step: ${STEP_NAME}",
					},
				],
				prompt: "Chain: ${CHAIN_NAME}",
			};

			const result = substituteVarsInChain(chain, {
				CHAIN_NAME: "build",
				STEP_NAME: "compile",
			});

			expect(result.prompt).toBe("Chain: build");
			expect(result.steps[0]?.prompt).toBe("Step: compile");
		});

		test("throws error for missing variable in chain prompt", () => {
			const chain: ChainConfig = {
				steps: [],
				prompt: "Execute ${UNDEFINED}",
			};

			expect(() => substituteVarsInChain(chain, {})).toThrow(
				"Variable 'UNDEFINED' referenced in 'chain' but not provided"
			);
		});

		test("preserves other chain fields during substitution", () => {
			const chain: ChainConfig = {
				description: "Test chain description",
				steps: [
					{
						agent: "test-agent",
						iterations: 5,
						loop: true,
						args: ["--verbose"],
					},
				],
				prompt: "${TASK}",
				promptFile: "prompts/${TYPE}.md",
			};

			const result = substituteVarsInChain(chain, {
				TASK: "build",
				TYPE: "default",
			});

			expect(result.description).toBe("Test chain description");
			expect(result.steps[0]?.iterations).toBe(5);
			expect(result.steps[0]?.loop).toBe(true);
			expect(result.steps[0]?.args).toEqual(["--verbose"]);
		});
	});
});

describe("isDirectSpawnAgent", () => {
	test("returns true when systemPrompt is set", () => {
		const agent: AgentConfig = {
			systemPrompt: "prompts/system.md",
		};
		expect(isDirectSpawnAgent(agent)).toBe(true);
	});

	test("returns true when systemPromptText is set", () => {
		const agent: AgentConfig = {
			systemPromptText: "You are a helpful assistant.",
		};
		expect(isDirectSpawnAgent(agent)).toBe(true);
	});

	test("returns true when both systemPrompt and systemPromptText are set", () => {
		const agent: AgentConfig = {
			systemPrompt: "prompts/system.md",
			systemPromptText: "You are a helpful assistant.",
		};
		expect(isDirectSpawnAgent(agent)).toBe(true);
	});

	test("returns false when neither systemPrompt nor systemPromptText is set", () => {
		const agent: AgentConfig = {
			defaultPrompt: "Default prompt",
			model: "sonnet",
		};
		expect(isDirectSpawnAgent(agent)).toBe(false);
	});

	test("returns false for empty config", () => {
		const agent: AgentConfig = {};
		expect(isDirectSpawnAgent(agent)).toBe(false);
	});

	test("returns false when only other fields are set", () => {
		const agent: AgentConfig = {
			mcpConfig: "settings/mcp.json",
			settings: "settings/agent.json",
			model: "opus",
			maxTurns: 100,
			allowedTools: ["Read", "Write"],
			disallowedTools: ["Bash"],
		};
		expect(isDirectSpawnAgent(agent)).toBe(false);
	});

	test("returns true with systemPrompt even with other fields set", () => {
		const agent: AgentConfig = {
			systemPrompt: "prompts/system.md",
			mcpConfig: "settings/mcp.json",
			settings: "settings/agent.json",
			model: "opus",
		};
		expect(isDirectSpawnAgent(agent)).toBe(true);
	});

	test("returns true with systemPromptText even with other fields set", () => {
		const agent: AgentConfig = {
			systemPromptText: "You are a helpful assistant.",
			mcpConfig: "settings/mcp.json",
			settings: "settings/agent.json",
			model: "haiku",
		};
		expect(isDirectSpawnAgent(agent)).toBe(true);
	});

	test("handles undefined systemPrompt explicitly", () => {
		const agent: AgentConfig = {
			systemPrompt: undefined,
			defaultPrompt: "Some default",
		};
		expect(isDirectSpawnAgent(agent)).toBe(false);
	});

	test("handles undefined systemPromptText explicitly", () => {
		const agent: AgentConfig = {
			systemPromptText: undefined,
			defaultPrompt: "Some default",
		};
		expect(isDirectSpawnAgent(agent)).toBe(false);
	});
});

describe("config resolution fallback", () => {
	const emptyDir = "/tmp/orchestra-config-test-empty";

	beforeAll(() => {
		mkdirSync(emptyDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(emptyDir, { recursive: true, force: true });
	});

	test("returns null when no local config and forge-config not available", async () => {
		// emptyDir has no forge/orch/chains.json and forge-config is not in PATH during tests
		const config = await loadConfig(emptyDir);
		expect(config).toBeNull();
	});

	test("returns null when directory does not exist", async () => {
		const config = await loadConfig("/nonexistent/path/that/does/not/exist");
		expect(config).toBeNull();
	});

	test("local config takes precedence over forge-config", async () => {
		// Write a local config with a unique marker
		writeConfig({
			chains: {
				"local-chain": {
					description: "This is from local config",
					steps: [{ agent: "local-agent" }],
				},
			},
		});

		const config = await loadConfig(tmpDir);

		// Should load the local config, not forge-config
		expect(config?.chains["local-chain"]).toBeDefined();
		expect(config?.chains["local-chain"]?.description).toBe(
			"This is from local config"
		);
	});

	test("verbose mode does not throw when config not found", async () => {
		// Should not throw, just return null
		const config = await loadConfig(emptyDir, { verbose: true });
		expect(config).toBeNull();
	});

	test("loadConfig with verbose option logs resolution attempts", async () => {
		// This test verifies verbose option is accepted and doesn't break anything
		// We can't easily capture console.log in bun:test, so we just verify it runs
		const config = await loadConfig(tmpDir, { verbose: true });
		expect(config).not.toBeNull();
	});
});

describe("complete config with all prompt fields", () => {
	test("loads config with prompts at all levels", async () => {
		writeConfig({
			agents: {
				worker: {
					defaultPrompt: "Default worker prompt",
					defaultPromptFile: "prompts/worker-default.md",
				},
			},
			chains: {
				"full-chain": {
					description: "A chain with all prompt fields",
					prompt: "Chain-level prompt",
					promptFile: "prompts/chain.md",
					steps: [
						{
							agent: "worker",
							prompt: "Step-level prompt",
							promptFile: "prompts/step.md",
						},
						{
							agent: "worker",
							iterations: 3,
						},
					],
				},
			},
		});

		const config = await loadConfig(tmpDir);

		// Verify agents section
		expect(config?.agents?.["worker"]?.defaultPrompt).toBe(
			"Default worker prompt"
		);
		expect(config?.agents?.["worker"]?.defaultPromptFile).toBe(
			"prompts/worker-default.md"
		);

		// Verify chain-level fields
		const chain = config?.chains["full-chain"];
		expect(chain?.prompt).toBe("Chain-level prompt");
		expect(chain?.promptFile).toBe("prompts/chain.md");

		// Verify step-level fields
		expect(chain?.steps[0]?.prompt).toBe("Step-level prompt");
		expect(chain?.steps[0]?.promptFile).toBe("prompts/step.md");
		expect(chain?.steps[1]?.prompt).toBeUndefined();
		expect(chain?.steps[1]?.promptFile).toBeUndefined();
	});
});
