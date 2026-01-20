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
 */
export const FORGE_TASK_AGENTS = {
	"forge-task-manager": {
		description:
			"Manages tasks: creates, breaks down work, tracks progress, delegates to workers",
		agentPath: "forge-tasks/agents/task-manager-agent.ts",
		capabilities: [
			"create-tasks",
			"breakdown-work",
			"track-progress",
			"delegate",
		],
	},
	"forge-task-worker": {
		description:
			"Implements single tasks: reads requirements, implements, updates ACs and notes",
		agentPath: "forge-tasks/agents/task-worker-agent.ts",
		capabilities: [
			"implement-task",
			"update-progress",
			"check-acceptance-criteria",
		],
	},
} as const;

export type ForgeTaskAgentName = keyof typeof FORGE_TASK_AGENTS;
