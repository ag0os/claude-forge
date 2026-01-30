/**
 * Tests for forkhestra mode awareness utilities
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	MODE_AWARENESS_PREFIX,
	composeSystemPrompt,
	loadAgentSystemPrompt,
} from "./mode-awareness";
import { COMPLETION_MARKER } from "./runner";
import type { AgentConfig } from "./config";

// Create temporary test directory
const tmpDir = "/tmp/forkhestra-mode-awareness-test";

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

describe("MODE_AWARENESS_PREFIX", () => {
	test("contains headless mode instructions", () => {
		expect(MODE_AWARENESS_PREFIX).toContain("HEADLESS");
		expect(MODE_AWARENESS_PREFIX).toContain("non-interactive");
		expect(MODE_AWARENESS_PREFIX).toContain("CANNOT ask the user");
	});

	test("contains FORKHESTRA_COMPLETE contract", () => {
		expect(MODE_AWARENESS_PREFIX).toContain(COMPLETION_MARKER);
		expect(MODE_AWARENESS_PREFIX).toContain("COMPLETION CONTRACT");
	});

	test("instructs to output marker when finished", () => {
		expect(MODE_AWARENESS_PREFIX).toContain("you MUST output");
		expect(MODE_AWARENESS_PREFIX).toContain("on its own line");
	});

	test("ends with separator for clean concatenation", () => {
		expect(MODE_AWARENESS_PREFIX).toMatch(/---\s*\n\s*$/);
	});
});

describe("composeSystemPrompt", () => {
	test("prepends MODE_AWARENESS_PREFIX to agent prompt", () => {
		const agentPrompt = "You are a helpful coding assistant.";
		const result = composeSystemPrompt(agentPrompt);

		expect(result).toContain(MODE_AWARENESS_PREFIX);
		expect(result).toContain(agentPrompt);
		expect(result.indexOf(MODE_AWARENESS_PREFIX)).toBeLessThan(
			result.indexOf(agentPrompt)
		);
	});

	test("preserves agent prompt content exactly", () => {
		const agentPrompt = `You are a task manager.

## Responsibilities
- Create tasks
- Update tasks
- Complete tasks

Always be thorough.`;

		const result = composeSystemPrompt(agentPrompt);
		expect(result).toContain(agentPrompt);
	});

	test("handles empty agent prompt", () => {
		const result = composeSystemPrompt("");
		expect(result).toBe(MODE_AWARENESS_PREFIX);
	});

	test("handles multi-line agent prompt", () => {
		const agentPrompt = "Line 1\nLine 2\nLine 3";
		const result = composeSystemPrompt(agentPrompt);

		expect(result).toBe(MODE_AWARENESS_PREFIX + agentPrompt);
	});
});

describe("loadAgentSystemPrompt", () => {
	beforeAll(() => {
		writePromptFile("prompts/system.md", "File-based system prompt content");
		writePromptFile(
			"prompts/nested/deep/system.md",
			"Nested system prompt content"
		);
	});

	describe("priority ordering", () => {
		test("systemPromptText has highest priority over systemPrompt", async () => {
			const agentConfig: AgentConfig = {
				systemPromptText: "Inline system prompt",
				systemPrompt: "prompts/system.md",
			};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBe("Inline system prompt");
		});

		test("systemPrompt file is loaded when no systemPromptText", async () => {
			const agentConfig: AgentConfig = {
				systemPrompt: "prompts/system.md",
			};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBe("File-based system prompt content");
		});
	});

	describe("file loading", () => {
		test("loads file relative to cwd", async () => {
			const agentConfig: AgentConfig = {
				systemPrompt: "prompts/system.md",
			};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBe("File-based system prompt content");
		});

		test("loads nested file paths", async () => {
			const agentConfig: AgentConfig = {
				systemPrompt: "prompts/nested/deep/system.md",
			};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBe("Nested system prompt content");
		});

		test("loads absolute file paths", async () => {
			const absolutePath = join(tmpDir, "prompts/system.md");
			const agentConfig: AgentConfig = {
				systemPrompt: absolutePath,
			};

			// Use a different cwd to verify absolute path is used
			const result = await loadAgentSystemPrompt(agentConfig, "/some/other/dir");
			expect(result).toBe("File-based system prompt content");
		});
	});

	describe("returns undefined when not configured", () => {
		test("returns undefined for empty config", async () => {
			const agentConfig: AgentConfig = {};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBeUndefined();
		});

		test("returns undefined when only other fields are set", async () => {
			const agentConfig: AgentConfig = {
				defaultPrompt: "Some default prompt",
				model: "sonnet",
			};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBeUndefined();
		});
	});

	describe("error handling", () => {
		test("throws error when systemPrompt file not found", async () => {
			const agentConfig: AgentConfig = {
				systemPrompt: "prompts/nonexistent.md",
			};

			await expect(loadAgentSystemPrompt(agentConfig, tmpDir)).rejects.toThrow(
				"System prompt file not found: prompts/nonexistent.md"
			);
		});

		test("throws error for deeply nested nonexistent file", async () => {
			const agentConfig: AgentConfig = {
				systemPrompt: "deeply/nested/path/missing.md",
			};

			await expect(loadAgentSystemPrompt(agentConfig, tmpDir)).rejects.toThrow(
				"System prompt file not found: deeply/nested/path/missing.md"
			);
		});
	});

	describe("inline text handling", () => {
		test("returns inline text exactly as provided", async () => {
			const inlinePrompt = `You are a specialized agent.

## Instructions
- Do this
- Do that

Be precise.`;

			const agentConfig: AgentConfig = {
				systemPromptText: inlinePrompt,
			};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBe(inlinePrompt);
		});

		test("handles empty inline text", async () => {
			const agentConfig: AgentConfig = {
				systemPromptText: "",
			};

			const result = await loadAgentSystemPrompt(agentConfig, tmpDir);
			expect(result).toBe("");
		});
	});
});

describe("integration", () => {
	test("composeSystemPrompt works with loadAgentSystemPrompt result", async () => {
		writePromptFile("prompts/agent-system.md", "Agent-specific instructions");

		const agentConfig: AgentConfig = {
			systemPrompt: "prompts/agent-system.md",
		};

		const agentPrompt = await loadAgentSystemPrompt(agentConfig, tmpDir);
		expect(agentPrompt).toBeDefined();

		const composedPrompt = composeSystemPrompt(agentPrompt!);

		expect(composedPrompt).toContain(MODE_AWARENESS_PREFIX);
		expect(composedPrompt).toContain("Agent-specific instructions");
		expect(composedPrompt).toContain(COMPLETION_MARKER);
	});

	test("composed prompt has correct structure", async () => {
		const agentConfig: AgentConfig = {
			systemPromptText: "Custom agent behavior",
		};

		const agentPrompt = await loadAgentSystemPrompt(agentConfig, tmpDir);
		const composedPrompt = composeSystemPrompt(agentPrompt!);

		// Mode awareness prefix comes first
		const prefixIndex = composedPrompt.indexOf("HEADLESS");
		const agentIndex = composedPrompt.indexOf("Custom agent behavior");

		expect(prefixIndex).toBeLessThan(agentIndex);
	});
});
