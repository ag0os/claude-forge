/**
 * Forge-tasks library exports
 * Provides programmatic access to task management functionality
 */

// Core types
export type {
	Task,
	TaskStatus,
	TaskPriority,
	AcceptanceCriterion,
	TaskCreateInput,
	TaskUpdateInput,
	TaskListFilter,
	ForgeTasksConfig,
} from "../forge-tasks/core/task-types";

// Constants
export { DEFAULT_CONFIG } from "../forge-tasks/core/task-types";

// Task Manager
export { TaskManager } from "../forge-tasks/core/task-manager";

/**
 * Registry of forge-tasks sub-agents for coordinator use
 *
 * This registry defines the available agents that can be spawned by coordinators
 * to handle different aspects of task management workflows.
 *
 * Agent roles:
 * - forge-task-manager: Planning phase - digests plans, creates tasks
 * - forge-task-coordinator: Execution phase - delegates to sub-agents, monitors
 * - forge-task-worker: Implementation phase - implements single tasks
 */
export const FORGE_TASK_AGENTS = {
	"forge-task-manager": {
		description:
			"Creates tasks from requirements/plans: breaks down work, sets dependencies, applies labels",
		agentPath: "agents/forge-task-manager.ts",
		capabilities: [
			"create-tasks",
			"breakdown-work",
			"set-dependencies",
			"apply-labels",
		],
	},
	"forge-task-coordinator": {
		description:
			"Coordinates task implementation: discovers agents, delegates work, monitors progress",
		agentPath: "agents/forge-task-coordinator.ts",
		capabilities: [
			"read-tasks",
			"discover-agents",
			"delegate-work",
			"monitor-progress",
			"verify-completion",
		],
	},
	"forge-task-worker": {
		description:
			"Implements single tasks: reads requirements, implements, updates ACs and notes",
		agentPath: "agents/forge-task-worker.ts",
		capabilities: [
			"implement-task",
			"update-progress",
			"check-acceptance-criteria",
		],
	},
} as const;

export type ForgeTaskAgentName = keyof typeof FORGE_TASK_AGENTS;
