/**
 * ID Generator for forge-tasks
 * Generates sequential task IDs with configurable prefix and zero-padding
 */

import type { ForgeTasksConfig, Task } from "./task-types.ts";

/**
 * Default prefix used when none is specified in config
 */
const DEFAULT_PREFIX = "TASK";

/**
 * Parse the numeric part from a task ID
 * ID matching is case-insensitive
 *
 * @param id - The task ID to parse (e.g., "TASK-123", "task-1")
 * @param prefix - The expected prefix (e.g., "TASK")
 * @returns The numeric part as a number, or null if ID doesn't match format
 *
 * @example
 * parseIdNumber("TASK-123", "TASK") // => 123
 * parseIdNumber("task-1", "TASK") // => 1 (case-insensitive)
 * parseIdNumber("FEAT-5", "TASK") // => null (wrong prefix)
 * parseIdNumber("TASK-abc", "TASK") // => null (non-numeric)
 */
export function parseIdNumber(id: string, prefix: string): number | null {
	const trimmedId = id.trim();
	const trimmedPrefix = prefix.trim();

	// Build case-insensitive regex: ^PREFIX-(\d+)$
	const pattern = new RegExp(`^${escapeRegex(trimmedPrefix)}-(\\d+)$`, "i");

	const match = trimmedId.match(pattern);
	if (!match || !match[1]) {
		return null;
	}

	const num = Number.parseInt(match[1], 10);
	return Number.isNaN(num) ? null : num;
}

/**
 * Format a task ID with the given prefix, number, and optional zero-padding
 *
 * @param prefix - The ID prefix (e.g., "TASK", "FEAT")
 * @param number - The numeric part of the ID
 * @param zeroPadding - Optional number of digits for zero-padding
 * @returns Formatted ID string
 *
 * @example
 * formatId("TASK", 1) // => "TASK-1"
 * formatId("TASK", 1, 3) // => "TASK-001"
 * formatId("FEAT", 42, 4) // => "FEAT-0042"
 */
export function formatId(
	prefix: string,
	number: number,
	zeroPadding?: number,
): string {
	const trimmedPrefix = prefix.trim().toUpperCase();

	if (zeroPadding && zeroPadding > 0) {
		const paddedNumber = String(number).padStart(zeroPadding, "0");
		return `${trimmedPrefix}-${paddedNumber}`;
	}

	return `${trimmedPrefix}-${number}`;
}

/**
 * Generate the next sequential task ID based on existing tasks
 *
 * @param config - ForgeTasksConfig containing prefix and zeroPadding settings
 * @param existingTasks - Array of existing tasks to check for ID collisions
 * @returns Next sequential ID string
 *
 * @example
 * // No existing tasks
 * generateNextId({ prefix: "TASK" }, []) // => "TASK-1"
 *
 * // With existing tasks
 * generateNextId({ prefix: "TASK" }, [{ id: "TASK-1" }, { id: "TASK-2" }]) // => "TASK-3"
 *
 * // With gap in sequence (still uses highest + 1)
 * generateNextId({ prefix: "TASK" }, [{ id: "TASK-1" }, { id: "TASK-3" }]) // => "TASK-4"
 *
 * // With zero-padding
 * generateNextId({ prefix: "TASK", zeroPadding: 3 }, []) // => "TASK-001"
 *
 * // Custom prefix
 * generateNextId({ prefix: "FEAT" }, []) // => "FEAT-1"
 */
export function generateNextId(
	config: ForgeTasksConfig,
	existingTasks: Task[],
): string {
	const prefix = config.prefix || DEFAULT_PREFIX;
	const zeroPadding = config.zeroPadding;

	// Find the highest existing ID number
	let highestNumber = 0;

	for (const task of existingTasks) {
		const num = parseIdNumber(task.id, prefix);
		if (num !== null && num > highestNumber) {
			highestNumber = num;
		}
	}

	// Next ID is highest + 1
	const nextNumber = highestNumber + 1;

	return formatId(prefix, nextNumber, zeroPadding);
}

/**
 * Find all numeric IDs from a list of tasks that match the given prefix
 *
 * @param tasks - Array of tasks to search
 * @param prefix - The ID prefix to match
 * @returns Array of numeric parts from matching task IDs
 *
 * @example
 * const tasks = [{ id: "TASK-1" }, { id: "TASK-5" }, { id: "FEAT-3" }];
 * extractIdNumbers(tasks, "TASK") // => [1, 5]
 */
export function extractIdNumbers(tasks: Task[], prefix: string): number[] {
	const numbers: number[] = [];

	for (const task of tasks) {
		const num = parseIdNumber(task.id, prefix);
		if (num !== null) {
			numbers.push(num);
		}
	}

	return numbers;
}

/**
 * Check if an ID matches the expected format for the given prefix
 *
 * @param id - The ID to validate
 * @param prefix - The expected prefix
 * @returns true if the ID matches the format "{PREFIX}-{NUMBER}"
 *
 * @example
 * isValidId("TASK-123", "TASK") // => true
 * isValidId("task-1", "TASK") // => true (case-insensitive)
 * isValidId("TASK-abc", "TASK") // => false
 * isValidId("FEAT-1", "TASK") // => false
 */
export function isValidId(id: string, prefix: string): boolean {
	return parseIdNumber(id, prefix) !== null;
}

/**
 * Escape special regex characters in a string
 * Used internally for building regex patterns from prefix strings
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
