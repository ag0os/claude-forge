/**
 * Forkhestra - Agent orchestration for claude-forge
 *
 * Run agents in loops (Ralph-style) or chains, with shared context via forge-tasks.
 */

export {
	run,
	COMPLETION_MARKER,
	type RunResult,
	type RunOptions,
} from "./runner";
