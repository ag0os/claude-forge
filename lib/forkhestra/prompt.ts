/**
 * Prompt resolution utilities for forkhestra
 *
 * Handles reading prompt files and resolving prompts from multiple sources
 * with proper priority ordering.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import type { ChainStep, ChainConfig, AgentConfig } from "./config";

/**
 * Options for prompt resolution at different levels
 */
export interface PromptSources {
	/** CLI-level prompt (highest priority) */
	cliPrompt?: string;
	/** CLI-level prompt file path */
	cliPromptFile?: string;
	/** Step-level configuration */
	step?: ChainStep;
	/** Chain-level configuration */
	chain?: ChainConfig;
	/** Agent-level default configuration */
	agentConfig?: AgentConfig;
}

/**
 * Read prompt content from a file relative to the provided working directory.
 *
 * @param filePath - Path to the prompt file (relative to cwd)
 * @param cwd - Working directory to resolve the file path against
 * @returns The file content as a string
 * @throws Error if the file does not exist or cannot be read
 */
export async function readPromptFile(
	filePath: string,
	cwd: string
): Promise<string> {
	const fullPath = join(cwd, filePath);

	if (!existsSync(fullPath)) {
		throw new Error(`Prompt file not found: ${filePath}`);
	}

	try {
		return await Bun.file(fullPath).text();
	} catch (error) {
		throw new Error(
			`Failed to read prompt file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Resolve the prompt to use from multiple sources with priority ordering.
 *
 * Priority order (highest to lowest):
 * 1. CLI prompt/promptFile
 * 2. Step prompt/promptFile
 * 3. Chain prompt/promptFile
 * 4. Agent default prompt/promptFile
 *
 * At each level, inline prompt takes precedence over promptFile.
 *
 * @param sources - Prompt sources at different levels
 * @param cwd - Working directory for resolving prompt files
 * @returns The resolved prompt content, or undefined if no prompt found
 */
export async function resolvePrompt(
	sources: PromptSources,
	cwd: string
): Promise<string | undefined> {
	const { cliPrompt, cliPromptFile, step, chain, agentConfig } = sources;

	// Level 1: CLI (highest priority)
	if (cliPrompt !== undefined) {
		return cliPrompt;
	}
	if (cliPromptFile !== undefined) {
		return await readPromptFile(cliPromptFile, cwd);
	}

	// Level 2: Step
	if (step?.prompt !== undefined) {
		return step.prompt;
	}
	if (step?.promptFile !== undefined) {
		return await readPromptFile(step.promptFile, cwd);
	}

	// Level 3: Chain
	if (chain?.prompt !== undefined) {
		return chain.prompt;
	}
	if (chain?.promptFile !== undefined) {
		return await readPromptFile(chain.promptFile, cwd);
	}

	// Level 4: Agent default (lowest priority)
	if (agentConfig?.defaultPrompt !== undefined) {
		return agentConfig.defaultPrompt;
	}
	if (agentConfig?.defaultPromptFile !== undefined) {
		return await readPromptFile(agentConfig.defaultPromptFile, cwd);
	}

	// No prompt found at any level
	return undefined;
}
