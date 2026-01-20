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
