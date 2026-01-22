/**
 * Config loader for forkhestra chain definitions
 *
 * Loads and validates forge/chains.json configuration file.
 * Handles variable substitution in args using ${VAR} syntax.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Represents a single step in a chain
 */
export interface ChainStep {
	agent: string;
	iterations: number;
	loop: boolean;
	args?: string[];
}

/**
 * Configuration for a named chain
 */
export interface ChainConfig {
	description?: string;
	steps: ChainStep[];
}

/**
 * Root configuration structure from forge/chains.json
 */
export interface ForkhestraConfig {
	chains: Record<string, ChainConfig>;
}

const CONFIG_PATH = "forge/chains.json";

/**
 * Load configuration from forge/chains.json relative to the provided cwd.
 *
 * @param cwd - Working directory to load config relative to
 * @returns Parsed and validated config, or null if file doesn't exist
 * @throws Error on invalid JSON syntax
 * @throws Error on invalid schema structure
 */
export async function loadConfig(
	cwd: string
): Promise<ForkhestraConfig | null> {
	const configPath = join(cwd, CONFIG_PATH);

	// Return null if file doesn't exist (not an error condition)
	if (!existsSync(configPath)) {
		return null;
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
): ForkhestraConfig {
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

	return { chains };
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

	// Validate each step
	const steps: ChainStep[] = chain.steps.map((rawStep, index) =>
		validateAndTransformStep(rawStep, chainName, index, configPath)
	);

	return {
		description: chain.description as string | undefined,
		steps,
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

	return {
		agent: step.agent,
		iterations,
		loop,
		args,
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
export function getChain(config: ForkhestraConfig, name: string): ChainStep[] {
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
 * Substitute ${VAR_NAME} placeholders in step args with provided variable values.
 *
 * @param steps - Array of ChainStep objects to process
 * @param vars - Record of variable names to values
 * @returns New array of ChainStep objects with substituted args
 * @throws Error if a variable is referenced but not provided
 */
export function substituteVars(
	steps: ChainStep[],
	vars: Record<string, string>
): ChainStep[] {
	return steps.map((step) => {
		if (!step.args || step.args.length === 0) {
			return step;
		}

		const substitutedArgs = step.args.map((arg) =>
			substituteVarsInString(arg, vars, step.agent)
		);

		return {
			...step,
			args: substitutedArgs,
		};
	});
}

/**
 * Substitute ${VAR_NAME} placeholders in a single string.
 *
 * @param str - The string to process
 * @param vars - Record of variable names to values
 * @param agentName - Name of the agent (for error messages)
 * @returns String with all variables substituted
 * @throws Error if a variable is referenced but not provided
 */
function substituteVarsInString(
	str: string,
	vars: Record<string, string>,
	agentName: string
): string {
	// Match ${VAR_NAME} pattern
	const varPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

	return str.replace(varPattern, (match, varName: string): string => {
		const value = vars[varName];
		if (value === undefined) {
			throw new Error(
				`Variable '${varName}' referenced in args for agent '${agentName}' but not provided. ` +
					`Pass it via CLI: VAR_NAME=value`
			);
		}
		return value;
	});
}
