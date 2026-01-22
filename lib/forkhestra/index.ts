/**
 * Forkhestra - Agent orchestration for claude-forge
 *
 * Run agents in loops (Ralph-style) or chains, with shared context via forge-tasks.
 */

// From runner.ts
export {
	run,
	COMPLETION_MARKER,
	type RunResult,
	type RunOptions,
} from "./runner";

// From parser.ts
export { parseDSL, type ChainStep } from "./parser";

// From config.ts
export {
	loadConfig,
	getChain,
	substituteVars,
	type ChainConfig,
	type ForkhestraConfig,
} from "./config";

// From chain.ts
export {
	executeChain,
	type ChainResult,
	type ChainOptions,
	type StepResult,
} from "./chain";
