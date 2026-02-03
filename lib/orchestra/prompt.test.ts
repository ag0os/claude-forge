/**
 * Tests for orchestra prompt resolution utilities
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readPromptFile, resolvePrompt, type PromptSources } from "./prompt";
import type { ChainStep, ChainConfig, AgentConfig } from "./config";

// Create temporary test directory
const tmpDir = "/tmp/orchestra-prompt-test";

beforeAll(() => {
	mkdirSync(join(tmpDir, "prompts"), { recursive: true });
});

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

function writePromptFile(relativePath: string, content: string) {
	const fullPath = join(tmpDir, relativePath);
	const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
	mkdirSync(dir, { recursive: true });
	writeFileSync(fullPath, content);
}

describe("readPromptFile", () => {
	test("reads file content relative to provided cwd", async () => {
		writePromptFile("prompts/test.md", "This is a test prompt");

		const content = await readPromptFile("prompts/test.md", tmpDir);
		expect(content).toBe("This is a test prompt");
	});

	test("reads file with multiple lines", async () => {
		const multilineContent = `# Prompt Title

This is a multi-line prompt.

- Item 1
- Item 2
`;
		writePromptFile("prompts/multiline.md", multilineContent);

		const content = await readPromptFile("prompts/multiline.md", tmpDir);
		expect(content).toBe(multilineContent);
	});

	test("throws clear error with filename if file not found", async () => {
		await expect(
			readPromptFile("prompts/nonexistent.md", tmpDir)
		).rejects.toThrow("Prompt file not found: prompts/nonexistent.md");
	});

	test("throws error for deeply nested nonexistent file", async () => {
		await expect(
			readPromptFile("deeply/nested/path/file.md", tmpDir)
		).rejects.toThrow("Prompt file not found: deeply/nested/path/file.md");
	});

	test("reads files in nested directories", async () => {
		writePromptFile("prompts/nested/deep/file.md", "Nested content");

		const content = await readPromptFile("prompts/nested/deep/file.md", tmpDir);
		expect(content).toBe("Nested content");
	});
});

describe("resolvePrompt", () => {
	beforeAll(() => {
		// Set up prompt files for testing
		writePromptFile("prompts/cli.md", "CLI prompt file content");
		writePromptFile("prompts/step.md", "Step prompt file content");
		writePromptFile("prompts/chain.md", "Chain prompt file content");
		writePromptFile("prompts/agent.md", "Agent default prompt file content");
	});

	describe("priority ordering", () => {
		test("CLI prompt has highest priority", async () => {
			const sources: PromptSources = {
				cliPrompt: "CLI inline prompt",
				cliPromptFile: "prompts/cli.md",
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Step inline prompt",
					promptFile: "prompts/step.md",
				},
				chain: {
					steps: [],
					prompt: "Chain inline prompt",
					promptFile: "prompts/chain.md",
				},
				agentConfig: {
					defaultPrompt: "Agent default prompt",
					defaultPromptFile: "prompts/agent.md",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("CLI inline prompt");
		});

		test("CLI promptFile used when no CLI prompt", async () => {
			const sources: PromptSources = {
				cliPromptFile: "prompts/cli.md",
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Step inline prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("CLI prompt file content");
		});

		test("step prompt used when no CLI prompt", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Step inline prompt",
					promptFile: "prompts/step.md",
				},
				chain: {
					steps: [],
					prompt: "Chain inline prompt",
				},
				agentConfig: {
					defaultPrompt: "Agent default prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Step inline prompt");
		});

		test("step promptFile used when no step prompt", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					promptFile: "prompts/step.md",
				},
				chain: {
					steps: [],
					prompt: "Chain inline prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Step prompt file content");
		});

		test("chain prompt used when no step prompt", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
				},
				chain: {
					steps: [],
					prompt: "Chain inline prompt",
					promptFile: "prompts/chain.md",
				},
				agentConfig: {
					defaultPrompt: "Agent default prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Chain inline prompt");
		});

		test("chain promptFile used when no chain prompt", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
				},
				chain: {
					steps: [],
					promptFile: "prompts/chain.md",
				},
				agentConfig: {
					defaultPrompt: "Agent default prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Chain prompt file content");
		});

		test("agent default prompt used when no higher level prompts", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
				},
				chain: {
					steps: [],
				},
				agentConfig: {
					defaultPrompt: "Agent default prompt",
					defaultPromptFile: "prompts/agent.md",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Agent default prompt");
		});

		test("agent default promptFile used when no agent default prompt", async () => {
			const sources: PromptSources = {
				agentConfig: {
					defaultPromptFile: "prompts/agent.md",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Agent default prompt file content");
		});
	});

	describe("inline prompt wins over promptFile at same level", () => {
		test("CLI level: inline wins over file", async () => {
			const sources: PromptSources = {
				cliPrompt: "CLI inline",
				cliPromptFile: "prompts/cli.md",
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("CLI inline");
		});

		test("step level: inline wins over file", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Step inline",
					promptFile: "prompts/step.md",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Step inline");
		});

		test("chain level: inline wins over file", async () => {
			const sources: PromptSources = {
				chain: {
					steps: [],
					prompt: "Chain inline",
					promptFile: "prompts/chain.md",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Chain inline");
		});

		test("agent level: inline wins over file", async () => {
			const sources: PromptSources = {
				agentConfig: {
					defaultPrompt: "Agent inline",
					defaultPromptFile: "prompts/agent.md",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Agent inline");
		});
	});

	describe("returns undefined when no prompt found", () => {
		test("returns undefined for empty sources", async () => {
			const sources: PromptSources = {};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBeUndefined();
		});

		test("returns undefined when step has no prompt fields", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBeUndefined();
		});

		test("returns undefined when chain has no prompt fields", async () => {
			const sources: PromptSources = {
				chain: {
					steps: [],
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBeUndefined();
		});

		test("returns undefined when agentConfig has no prompt fields", async () => {
			const sources: PromptSources = {
				agentConfig: {},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBeUndefined();
		});

		test("returns undefined when all sources have no prompt fields", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					args: ["--verbose"],
				},
				chain: {
					steps: [],
					description: "A chain without prompts",
				},
				agentConfig: {},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBeUndefined();
		});
	});

	describe("error handling", () => {
		test("throws error when CLI promptFile not found", async () => {
			const sources: PromptSources = {
				cliPromptFile: "prompts/missing.md",
			};

			await expect(resolvePrompt(sources, tmpDir)).rejects.toThrow(
				"Prompt file not found: prompts/missing.md"
			);
		});

		test("throws error when step promptFile not found", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					promptFile: "prompts/missing-step.md",
				},
			};

			await expect(resolvePrompt(sources, tmpDir)).rejects.toThrow(
				"Prompt file not found: prompts/missing-step.md"
			);
		});

		test("throws error when chain promptFile not found", async () => {
			const sources: PromptSources = {
				chain: {
					steps: [],
					promptFile: "prompts/missing-chain.md",
				},
			};

			await expect(resolvePrompt(sources, tmpDir)).rejects.toThrow(
				"Prompt file not found: prompts/missing-chain.md"
			);
		});

		test("throws error when agent promptFile not found", async () => {
			const sources: PromptSources = {
				agentConfig: {
					defaultPromptFile: "prompts/missing-agent.md",
				},
			};

			await expect(resolvePrompt(sources, tmpDir)).rejects.toThrow(
				"Prompt file not found: prompts/missing-agent.md"
			);
		});
	});

	describe("partial sources", () => {
		test("works with only CLI prompt", async () => {
			const sources: PromptSources = {
				cliPrompt: "Only CLI prompt",
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Only CLI prompt");
		});

		test("works with only step", async () => {
			const sources: PromptSources = {
				step: {
					agent: "test-agent",
					iterations: 1,
					loop: false,
					prompt: "Only step prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Only step prompt");
		});

		test("works with only chain", async () => {
			const sources: PromptSources = {
				chain: {
					steps: [],
					prompt: "Only chain prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Only chain prompt");
		});

		test("works with only agentConfig", async () => {
			const sources: PromptSources = {
				agentConfig: {
					defaultPrompt: "Only agent prompt",
				},
			};

			const result = await resolvePrompt(sources, tmpDir);
			expect(result).toBe("Only agent prompt");
		});
	});
});
