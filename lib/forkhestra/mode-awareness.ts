/**
 * Mode awareness utilities for forkhestra
 *
 * Provides constants and helpers for composing system prompts that inform
 * Claude about its headless execution context. This addresses Claude Code
 * bug #17603 where Claude doesn't know it's running in headless mode.
 */

import { existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";

import type { AgentConfig } from "./config";
import { COMPLETION_MARKER } from "./constants";

/**
 * Prefix that informs Claude about headless execution mode and forkhestra contract.
 *
 * This prefix should be prepended to all agent system prompts when running
 * via forkhestra to ensure Claude understands:
 * - It's running in headless/non-interactive mode
 * - It cannot ask the user questions
 * - It must output the completion marker when finished
 */
export const MODE_AWARENESS_PREFIX = `You are running in HEADLESS mode via forkhestra orchestration.

IMPORTANT CONSTRAINTS:
- You are in non-interactive mode and CANNOT ask the user questions
- You must make autonomous decisions based on the information available
- If you need clarification, make a reasonable assumption and proceed
- Do not wait for user input or confirmation

COMPLETION CONTRACT:
When you have finished your task, you MUST output the following marker on its own line:
${COMPLETION_MARKER}

This marker signals to the forkhestra orchestrator that you have completed your work.
Output this marker ONLY when you are truly done with your assigned task.

---

`;

/**
 * Compose a complete system prompt by prepending the mode awareness prefix.
 *
 * @param agentPrompt - The agent's custom system prompt content
 * @returns Complete system prompt with mode awareness prefix
 */
export function composeSystemPrompt(agentPrompt: string): string {
	return MODE_AWARENESS_PREFIX + agentPrompt;
}

/**
 * Load an agent's system prompt from file or inline text.
 *
 * Resolution priority:
 * 1. systemPromptText (inline text) - highest priority
 * 2. systemPrompt (file path) - loaded from file
 *
 * @param agentConfig - The agent configuration containing prompt settings
 * @param cwd - Working directory for resolving relative file paths
 * @returns The raw system prompt content, or undefined if not configured
 * @throws Error if the file does not exist or cannot be read
 */
export async function loadAgentSystemPrompt(
	agentConfig: AgentConfig,
	cwd: string
): Promise<string | undefined> {
	// Priority 1: Inline text takes precedence
	if (agentConfig.systemPromptText !== undefined) {
		return agentConfig.systemPromptText;
	}

	// Priority 2: Load from file path
	if (agentConfig.systemPrompt !== undefined) {
		const filePath = agentConfig.systemPrompt;
		const fullPath = isAbsolute(filePath) ? filePath : join(cwd, filePath);

		if (!existsSync(fullPath)) {
			throw new Error(`System prompt file not found: ${filePath}`);
		}

		try {
			return await Bun.file(fullPath).text();
		} catch (error) {
			throw new Error(
				`Failed to read system prompt file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// No system prompt configured
	return undefined;
}
