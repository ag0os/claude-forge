/**
 * Config loader for orchestra chain definitions
 *
 * Loads and validates forge/orch/chains.json configuration file.
 * Uses fallback resolution:
 * 1. Local ./forge/orch/chains.json (project-specific override)
 * 2. forge config chains output (global shared config)
 * 3. Returns null if neither found
 *
 * Handles variable substitution in args using ${VAR} syntax.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

import type { RuntimeBackend } from "../runtime/types";

/**
 * Represents a single step in a chain
 */
export interface ChainStep {
	agent: string;
	iterations: number;
	loop: boolean;
	args?: string[];
	/** Inline prompt text to pass to the agent */
	prompt?: string;
	/** Path to a file containing the prompt */
	promptFile?: string;
}

/**
 * Configuration for a named chain
 */
export interface ChainConfig {
	description?: string;
	steps: ChainStep[];
	/** Inline prompt text to pass to all agents in the chain */
	prompt?: string;
	/** Path to a file containing the prompt for all agents in the chain */
	promptFile?: string;
}

/**
 * Valid model identifiers for direct spawn agents
 */
export type AgentModel = "sonnet" | "opus" | "haiku";

/**
 * Configuration for a specific agent's defaults
 */
export interface AgentConfig {
	/** Default inline prompt text for this agent */
	defaultPrompt?: string;
	/** Default path to a file containing the prompt for this agent */
	defaultPromptFile?: string;

	// Direct spawn fields - when set, agent spawns Claude directly instead of running a binary

	/** Path to system prompt file (relative to config or absolute) */
	systemPrompt?: string;
	/** Inline system prompt text */
	systemPromptText?: string;
	/** Path to MCP config file */
	mcpConfig?: string;
	/** Path to settings file */
	settings?: string;
	/** Model to use (sonnet, opus, haiku) */
	model?: AgentModel;
	/** Maximum number of turns for the conversation */
	maxTurns?: number;
	/** List of allowed tools (whitelist) */
	allowedTools?: string[];
	/** List of disallowed tools (blacklist) */
	disallowedTools?: string[];
	/** Runtime backend to use (defaults to 'claude-cli') */
	backend?: RuntimeBackend;
}

/**
 * Check if an agent config is configured for direct Claude spawning.
 *
 * An agent is considered a direct spawn agent if it has either:
 * - systemPrompt: path to a system prompt file
 * - systemPromptText: inline system prompt text
 *
 * @param agent - The agent configuration to check
 * @returns true if the agent should spawn Claude directly
 */
export function isDirectSpawnAgent(agent: AgentConfig): boolean {
	return agent.systemPrompt !== undefined || agent.systemPromptText !== undefined;
}

/**
 * Root configuration structure from forge/orch/chains.json
 */
export interface OrchestraConfig {
	chains: Record<string, ChainConfig>;
	/** Agent-specific default configurations */
	agents?: Record<string, AgentConfig>;
}

/**
 * Options for loadConfig function
 */
export interface LoadConfigOptions {
	/** Enable verbose output showing which config source was used */
	verbose?: boolean;
}

const CONFIG_PATH = "forge/orch/chains.json";

/**
 * Load configuration from forge/orch/chains.json relative to the provided cwd,
 * with fallback to forge-config chains command.
 *
 * Resolution order:
 * 1. Local ./forge/orch/chains.json (project-specific override)
 * 2. forge config chains output (global shared config)
 * 3. Returns null if neither found
 *
 * @param cwd - Working directory to load config relative to
 * @param options - Optional configuration options (verbose mode)
 * @returns Parsed and validated config, or null if no config found
 * @throws Error on invalid JSON syntax
 * @throws Error on invalid schema structure
 */
export async function loadConfig(
	cwd: string,
	options?: LoadConfigOptions
): Promise<OrchestraConfig | null> {
	const verbose = options?.verbose ?? false;
	const configPath = join(cwd, CONFIG_PATH);

	// 1. Try local config first (takes precedence)
	if (existsSync(configPath)) {
		if (verbose) {
			console.log(`[orchestra] Loading config from local: ${configPath}`);
		}

		// Read and parse the file
		let rawContent: string;
		try {
			rawContent = await Bun.file(configPath).text();
		} catch (error) {
			throw new Error(
				`Failed to read config file at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		// Parse JSON
		let rawConfig: unknown;
		try {
			rawConfig = JSON.parse(rawContent);
		} catch (error) {
			throw new Error(
				`Invalid JSON in config file at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		// Validate and transform the config
		return validateAndTransformConfig(rawConfig, configPath);
	}

	// 2. Try forge config chains as fallback
	if (verbose) {
		console.log(
			"[orchestra] Local config not found, trying forge config chains..."
		);
	}

	const globalResult = await loadFromForgeConfig(verbose);
	if (globalResult) {
		return globalResult;
	}

	// 3. No config found
	if (verbose) {
		console.log("[orchestra] No config found from any source");
	}
	return null;
}

/**
 * Load configuration from forge config chains command.
 *
 * @param verbose - Whether to log verbose output
 * @returns Parsed config or null if forge is not available or fails
 */
async function loadFromForgeConfig(
	verbose: boolean
): Promise<OrchestraConfig | null> {
	try {
		// Use Bun shell to execute forge config chains
		// nothrow prevents exceptions on non-zero exit
		const result = await $`forge config chains`.nothrow();

		// Check if command was successful
		if (result.exitCode !== 0) {
			if (verbose) {
				const stderr = result.stderr.toString().trim();
				console.log(
					`[orchestra] forge config chains failed with exit code ${result.exitCode}`
				);
				if (stderr) {
					console.log(`[orchestra] stderr: ${stderr}`);
				}
				console.log(`[orchestra] PATH: ${process.env.PATH}`);
			}
			return null;
		}

		const output = result.stdout.toString().trim();
		if (!output) {
			if (verbose) {
				console.log("[orchestra] forge config chains returned empty output");
			}
			return null;
		}

		// Parse JSON output
		let rawConfig: unknown;
		try {
			rawConfig = JSON.parse(output);
		} catch (error) {
			if (verbose) {
				console.log(
					`[orchestra] forge config chains returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
				);
			}
			return null;
		}

		if (verbose) {
			console.log("[orchestra] Loaded config from forge config chains");
		}

		// Validate and transform the config
		return validateAndTransformConfig(rawConfig, "forge config chains");
	} catch (error) {
		// This catches errors like "command not found" when forge is not in PATH
		if (verbose) {
			console.log(
				`[orchestra] forge not available: ${error instanceof Error ? error.message : String(error)}`
			);
			console.log(`[orchestra] PATH: ${process.env.PATH}`);
		}
		return null;
	}
}

/**
 * Validate the raw config object and transform it to the typed structure.
 *
 * @param rawConfig - The parsed JSON object
 * @param configPath - Path to the config file (for error messages)
 * @returns Validated and transformed config
 * @throws Error on invalid schema structure
 */
function validateAndTransformConfig(
	rawConfig: unknown,
	configPath: string
): OrchestraConfig {
	// Check that config is an object
	if (typeof rawConfig !== "object" || rawConfig === null) {
		throw new Error(
			`Invalid config schema at ${configPath}: config must be an object`
		);
	}

	const config = rawConfig as Record<string, unknown>;

	// Check that chains property exists
	if (!("chains" in config)) {
		throw new Error(
			`Invalid config schema at ${configPath}: missing required 'chains' property`
		);
	}

	// Check that chains is an object
	if (typeof config.chains !== "object" || config.chains === null) {
		throw new Error(
			`Invalid config schema at ${configPath}: 'chains' must be an object`
		);
	}

	const rawChains = config.chains as Record<string, unknown>;
	const chains: Record<string, ChainConfig> = {};

	// Validate each chain
	for (const [chainName, rawChain] of Object.entries(rawChains)) {
		chains[chainName] = validateAndTransformChain(
			rawChain,
			chainName,
			configPath
		);
	}

	// Validate agents section if present
	let agents: Record<string, AgentConfig> | undefined;

	if ("agents" in config && config.agents !== undefined) {
		if (typeof config.agents !== "object" || config.agents === null) {
			throw new Error(
				`Invalid config schema at ${configPath}: 'agents' must be an object`
			);
		}

		const rawAgents = config.agents as Record<string, unknown>;
		agents = {};

		for (const [agentName, rawAgent] of Object.entries(rawAgents)) {
			agents[agentName] = validateAndTransformAgent(
				rawAgent,
				agentName,
				configPath
			);
		}
	}

	return { chains, agents };
}

/**
 * Valid model values for validation
 */
const VALID_MODELS: AgentModel[] = ["sonnet", "opus", "haiku"];

/**
 * Valid backend values for validation
 */
const VALID_BACKENDS: RuntimeBackend[] = ["claude-cli", "codex-cli", "codex-sdk"];

/**
 * Validate and transform a single agent configuration.
 *
 * @param rawAgent - The raw agent object
 * @param agentName - Name of the agent (for error messages)
 * @param configPath - Path to the config file (for error messages)
 * @returns Validated and transformed agent config
 * @throws Error on invalid agent structure
 */
function validateAndTransformAgent(
	rawAgent: unknown,
	agentName: string,
	configPath: string
): AgentConfig {
	if (typeof rawAgent !== "object" || rawAgent === null) {
		throw new Error(
			`Invalid config schema at ${configPath}: agent '${agentName}' must be an object`
		);
	}

	const agent = rawAgent as Record<string, unknown>;
	const prefix = `Invalid config schema at ${configPath}: agent '${agentName}'`;

	// Validate defaultPrompt if present
	if (
		"defaultPrompt" in agent &&
		agent.defaultPrompt !== undefined &&
		typeof agent.defaultPrompt !== "string"
	) {
		throw new Error(`${prefix} defaultPrompt must be a string`);
	}

	// Validate defaultPromptFile if present
	if (
		"defaultPromptFile" in agent &&
		agent.defaultPromptFile !== undefined &&
		typeof agent.defaultPromptFile !== "string"
	) {
		throw new Error(`${prefix} defaultPromptFile must be a string`);
	}

	// Validate systemPrompt if present
	if (
		"systemPrompt" in agent &&
		agent.systemPrompt !== undefined &&
		typeof agent.systemPrompt !== "string"
	) {
		throw new Error(`${prefix} systemPrompt must be a string`);
	}

	// Validate systemPromptText if present
	if (
		"systemPromptText" in agent &&
		agent.systemPromptText !== undefined &&
		typeof agent.systemPromptText !== "string"
	) {
		throw new Error(`${prefix} systemPromptText must be a string`);
	}

	// Validate mcpConfig if present
	if (
		"mcpConfig" in agent &&
		agent.mcpConfig !== undefined &&
		typeof agent.mcpConfig !== "string"
	) {
		throw new Error(`${prefix} mcpConfig must be a string`);
	}

	// Validate settings if present
	if (
		"settings" in agent &&
		agent.settings !== undefined &&
		typeof agent.settings !== "string"
	) {
		throw new Error(`${prefix} settings must be a string`);
	}

	// Validate model if present
	if ("model" in agent && agent.model !== undefined) {
		if (typeof agent.model !== "string") {
			throw new Error(`${prefix} model must be a string`);
		}
		if (!VALID_MODELS.includes(agent.model as AgentModel)) {
			throw new Error(
				`${prefix} model must be one of: ${VALID_MODELS.join(", ")}`
			);
		}
	}

	// Validate maxTurns if present
	if ("maxTurns" in agent && agent.maxTurns !== undefined) {
		if (typeof agent.maxTurns !== "number") {
			throw new Error(`${prefix} maxTurns must be a number`);
		}
		if (!Number.isInteger(agent.maxTurns) || agent.maxTurns < 1) {
			throw new Error(`${prefix} maxTurns must be a positive integer`);
		}
	}

	// Validate allowedTools if present
	if ("allowedTools" in agent && agent.allowedTools !== undefined) {
		if (!Array.isArray(agent.allowedTools)) {
			throw new Error(`${prefix} allowedTools must be an array`);
		}
		for (let i = 0; i < agent.allowedTools.length; i++) {
			if (typeof agent.allowedTools[i] !== "string") {
				throw new Error(`${prefix} allowedTools[${i}] must be a string`);
			}
		}
	}

	// Validate disallowedTools if present
	if ("disallowedTools" in agent && agent.disallowedTools !== undefined) {
		if (!Array.isArray(agent.disallowedTools)) {
			throw new Error(`${prefix} disallowedTools must be an array`);
		}
		for (let i = 0; i < agent.disallowedTools.length; i++) {
			if (typeof agent.disallowedTools[i] !== "string") {
				throw new Error(`${prefix} disallowedTools[${i}] must be a string`);
			}
		}
	}

	// Validate backend if present
	if ("backend" in agent && agent.backend !== undefined) {
		if (typeof agent.backend !== "string") {
			throw new Error(`${prefix} backend must be a string`);
		}
		if (!VALID_BACKENDS.includes(agent.backend as RuntimeBackend)) {
			throw new Error(
				`${prefix} backend must be one of: ${VALID_BACKENDS.join(", ")}`
			);
		}
	}

	return {
		defaultPrompt: agent.defaultPrompt as string | undefined,
		defaultPromptFile: agent.defaultPromptFile as string | undefined,
		systemPrompt: agent.systemPrompt as string | undefined,
		systemPromptText: agent.systemPromptText as string | undefined,
		mcpConfig: agent.mcpConfig as string | undefined,
		settings: agent.settings as string | undefined,
		model: agent.model as AgentModel | undefined,
		maxTurns: agent.maxTurns as number | undefined,
		allowedTools: agent.allowedTools as string[] | undefined,
		disallowedTools: agent.disallowedTools as string[] | undefined,
		backend: agent.backend as RuntimeBackend | undefined,
	};
}

/**
 * Validate and transform a single chain configuration.
 *
 * @param rawChain - The raw chain object
 * @param chainName - Name of the chain (for error messages)
 * @param configPath - Path to the config file (for error messages)
 * @returns Validated and transformed chain config
 * @throws Error on invalid chain structure
 */
function validateAndTransformChain(
	rawChain: unknown,
	chainName: string,
	configPath: string
): ChainConfig {
	if (typeof rawChain !== "object" || rawChain === null) {
		throw new Error(
			`Invalid config schema at ${configPath}: chain '${chainName}' must be an object`
		);
	}

	const chain = rawChain as Record<string, unknown>;

	// Check that steps property exists
	if (!("steps" in chain)) {
		throw new Error(
			`Invalid config schema at ${configPath}: chain '${chainName}' is missing required 'steps' property`
		);
	}

	// Check that steps is an array
	if (!Array.isArray(chain.steps)) {
		throw new Error(
			`Invalid config schema at ${configPath}: chain '${chainName}' steps must be an array`
		);
	}

	// Validate description if present
	if (
		"description" in chain &&
		chain.description !== undefined &&
		typeof chain.description !== "string"
	) {
		throw new Error(
			`Invalid config schema at ${configPath}: chain '${chainName}' description must be a string`
		);
	}

	// Validate prompt if present
	if (
		"prompt" in chain &&
		chain.prompt !== undefined &&
		typeof chain.prompt !== "string"
	) {
		throw new Error(
			`Invalid config schema at ${configPath}: chain '${chainName}' prompt must be a string`
		);
	}

	// Validate promptFile if present
	if (
		"promptFile" in chain &&
		chain.promptFile !== undefined &&
		typeof chain.promptFile !== "string"
	) {
		throw new Error(
			`Invalid config schema at ${configPath}: chain '${chainName}' promptFile must be a string`
		);
	}

	// Validate each step
	const steps: ChainStep[] = chain.steps.map((rawStep, index) =>
		validateAndTransformStep(rawStep, chainName, index, configPath)
	);

	return {
		description: chain.description as string | undefined,
		steps,
		prompt: chain.prompt as string | undefined,
		promptFile: chain.promptFile as string | undefined,
	};
}

/**
 * Validate and transform a single step configuration.
 *
 * @param rawStep - The raw step object
 * @param chainName - Name of the parent chain (for error messages)
 * @param stepIndex - Index of the step in the chain (for error messages)
 * @param configPath - Path to the config file (for error messages)
 * @returns Validated and transformed step
 * @throws Error on invalid step structure
 */
function validateAndTransformStep(
	rawStep: unknown,
	chainName: string,
	stepIndex: number,
	configPath: string
): ChainStep {
	const stepDesc = `chain '${chainName}' step ${stepIndex + 1}`;

	if (typeof rawStep !== "object" || rawStep === null) {
		throw new Error(
			`Invalid config schema at ${configPath}: ${stepDesc} must be an object`
		);
	}

	const step = rawStep as Record<string, unknown>;

	// Check required 'agent' property
	if (!("agent" in step)) {
		throw new Error(
			`Invalid config schema at ${configPath}: ${stepDesc} is missing required 'agent' property`
		);
	}

	if (typeof step.agent !== "string") {
		throw new Error(
			`Invalid config schema at ${configPath}: ${stepDesc} 'agent' must be a string`
		);
	}

	if (step.agent.trim() === "") {
		throw new Error(
			`Invalid config schema at ${configPath}: ${stepDesc} 'agent' cannot be empty`
		);
	}

	// Validate iterations if present
	let iterations = 1;
	let loop = false;

	if ("iterations" in step && step.iterations !== undefined) {
		if (typeof step.iterations !== "number") {
			throw new Error(
				`Invalid config schema at ${configPath}: ${stepDesc} 'iterations' must be a number`
			);
		}

		if (!Number.isInteger(step.iterations) || step.iterations < 1) {
			throw new Error(
				`Invalid config schema at ${configPath}: ${stepDesc} 'iterations' must be a positive integer`
			);
		}

		iterations = step.iterations;
		loop = true;
	}

	// Validate args if present
	let args: string[] | undefined;

	if ("args" in step && step.args !== undefined) {
		if (!Array.isArray(step.args)) {
			throw new Error(
				`Invalid config schema at ${configPath}: ${stepDesc} 'args' must be an array`
			);
		}

		for (let i = 0; i < step.args.length; i++) {
			if (typeof step.args[i] !== "string") {
				throw new Error(
					`Invalid config schema at ${configPath}: ${stepDesc} 'args[${i}]' must be a string`
				);
			}
		}

		args = step.args as string[];
	}

	// Validate prompt if present
	if (
		"prompt" in step &&
		step.prompt !== undefined &&
		typeof step.prompt !== "string"
	) {
		throw new Error(
			`Invalid config schema at ${configPath}: ${stepDesc} 'prompt' must be a string`
		);
	}

	// Validate promptFile if present
	if (
		"promptFile" in step &&
		step.promptFile !== undefined &&
		typeof step.promptFile !== "string"
	) {
		throw new Error(
			`Invalid config schema at ${configPath}: ${stepDesc} 'promptFile' must be a string`
		);
	}

	return {
		agent: step.agent,
		iterations,
		loop,
		args,
		prompt: step.prompt as string | undefined,
		promptFile: step.promptFile as string | undefined,
	};
}

/**
 * Get a named chain from the configuration as a ChainStep array.
 *
 * @param config - The loaded configuration
 * @param name - Name of the chain to retrieve
 * @returns Array of ChainStep objects for the named chain
 * @throws Error if chain name is not found
 */
export function getChain(config: OrchestraConfig, name: string): ChainStep[] {
	if (!(name in config.chains)) {
		const availableChains = Object.keys(config.chains);
		const availableList =
			availableChains.length > 0
				? `Available chains: ${availableChains.join(", ")}`
				: "No chains defined in configuration";
		throw new Error(`Chain '${name}' not found in configuration. ${availableList}`);
	}

	const chain = config.chains[name];
	if (!chain) {
		throw new Error(`Chain '${name}' not found in configuration.`);
	}
	return chain.steps;
}

/**
 * Substitute \${VAR_NAME} placeholders in step args and prompt fields with provided variable values.
 *
 * @param steps - Array of ChainStep objects to process
 * @param vars - Record of variable names to values
 * @returns New array of ChainStep objects with substituted args and prompts
 * @throws Error if a variable is referenced but not provided
 */
export function substituteVars(
	steps: ChainStep[],
	vars: Record<string, string>
): ChainStep[] {
	return steps.map((step) => {
		const result = { ...step };

		// Substitute in args if present
		if (step.args && step.args.length > 0) {
			result.args = step.args.map((arg) =>
				substituteVarsInString(arg, vars, step.agent)
			);
		}

		// Substitute in prompt if present
		if (step.prompt) {
			result.prompt = substituteVarsInString(step.prompt, vars, step.agent);
		}

		// Substitute in promptFile if present
		if (step.promptFile) {
			result.promptFile = substituteVarsInString(
				step.promptFile,
				vars,
				step.agent
			);
		}

		return result;
	});
}

/**
 * Substitute \${VAR_NAME} placeholders in chain-level prompt fields with provided variable values.
 *
 * @param chain - The ChainConfig to process
 * @param vars - Record of variable names to values
 * @returns New ChainConfig with substituted prompt fields
 * @throws Error if a variable is referenced but not provided
 */
export function substituteVarsInChain(
	chain: ChainConfig,
	vars: Record<string, string>
): ChainConfig {
	const result = { ...chain };

	// Substitute in prompt if present
	if (chain.prompt) {
		result.prompt = substituteVarsInString(chain.prompt, vars, "chain");
	}

	// Substitute in promptFile if present
	if (chain.promptFile) {
		result.promptFile = substituteVarsInString(chain.promptFile, vars, "chain");
	}

	// Also substitute in steps
	result.steps = substituteVars(chain.steps, vars);

	return result;
}

/**
 * Substitute \${VAR_NAME} placeholders in a single string.
 *
 * @param str - The string to process
 * @param vars - Record of variable names to values
 * @param context - Context description (for error messages)
 * @returns String with all variables substituted
 * @throws Error if a variable is referenced but not provided
 */
function substituteVarsInString(
	str: string,
	vars: Record<string, string>,
	context: string
): string {
	// Match \${VAR_NAME} pattern
	const varPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

	return str.replace(varPattern, (match, varName: string): string => {
		const value = vars[varName];
		if (value === undefined) {
			throw new Error(
				`Variable '${varName}' referenced in '${context}' but not provided. ` +
					`Pass it via CLI: VAR_NAME=value`
			);
		}
		return value;
	});
}
