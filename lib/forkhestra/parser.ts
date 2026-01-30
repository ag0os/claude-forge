/**
 * DSL parser for forkhestra chain definitions
 *
 * Parses DSL strings into structured ChainStep arrays.
 * Supports both pipeline mode (no iterations) and loop mode (with iterations).
 *
 * DSL Format: `agent1[:iterations] -> agent2[:iterations]`
 *
 * Examples:
 * - `task-coordinator` -> run once (loop: false)
 * - `task-coordinator:10` -> loop up to 10 times (loop: true)
 * - `task-manager -> task-coordinator` -> pipeline, each runs once
 * - `task-manager:3 -> task-coordinator:10` -> both loop
 * - `task-manager -> task-coordinator:10` -> mixed mode
 */

/**
 * Represents a single step in a chain
 */
export interface ChainStep {
	/** Agent binary name */
	agent: string;
	/** Maximum number of iterations (1 if no looping) */
	iterations: number;
	/** If true, loop until ORCHESTRA_COMPLETE marker or max iterations */
	loop: boolean;
	/** Optional arguments to pass to the agent */
	args?: string[];
}

// Valid agent name pattern: alphanumeric, hyphens, underscores
// Must start with alphanumeric character
const AGENT_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/**
 * Parses a single agent step (e.g., "agent" or "agent:10")
 */
function parseStep(step: string): ChainStep {
	const trimmed = step.trim();

	if (!trimmed) {
		throw new Error("Invalid syntax: empty agent name");
	}

	// Split on colon to separate agent name from iterations
	const colonIndex = trimmed.lastIndexOf(":");

	let agent: string;
	let iterations: number;
	let loop: boolean;

	if (colonIndex === -1) {
		// No iterations specified: run once, no looping
		agent = trimmed;
		iterations = 1;
		loop = false;
	} else {
		// Has iterations specified
		agent = trimmed.slice(0, colonIndex).trim();
		const iterStr = trimmed.slice(colonIndex + 1).trim();

		if (!iterStr) {
			throw new Error(
				`Invalid syntax: missing iteration count after colon in "${trimmed}"`
			);
		}

		// Parse iteration count
		const parsed = Number.parseInt(iterStr, 10);

		if (Number.isNaN(parsed)) {
			throw new Error(
				`Invalid iteration count "${iterStr}" in "${trimmed}": must be a number`
			);
		}

		if (!Number.isInteger(parsed) || iterStr !== String(parsed)) {
			throw new Error(
				`Invalid iteration count "${iterStr}" in "${trimmed}": must be an integer`
			);
		}

		if (parsed <= 0) {
			throw new Error(
				`Invalid iteration count "${parsed}" in "${trimmed}": must be a positive integer`
			);
		}

		iterations = parsed;
		loop = true;
	}

	// Validate agent name
	if (!agent) {
		throw new Error("Invalid syntax: empty agent name");
	}

	if (!AGENT_NAME_PATTERN.test(agent)) {
		throw new Error(
			`Invalid agent name "${agent}": must start with alphanumeric and contain only alphanumeric characters, hyphens, and underscores`
		);
	}

	return { agent, iterations, loop };
}

/**
 * Parses a DSL string into an array of ChainSteps
 *
 * @param dsl - The DSL string to parse (e.g., "agent1:3 -> agent2:10")
 * @returns Array of ChainStep objects
 * @throws Error if the DSL syntax is invalid
 */
export function parseDSL(dsl: string): ChainStep[] {
	const trimmed = dsl.trim();

	if (!trimmed) {
		throw new Error("Invalid syntax: empty DSL string");
	}

	// Split by arrow separator
	const parts = trimmed.split("->");

	// Parse each part as a step
	const steps = parts.map((part, index) => {
		try {
			return parseStep(part);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Step ${index + 1}: ${error.message}`);
			}
			throw error;
		}
	});

	return steps;
}
