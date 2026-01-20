/**
 * File system utilities for forge-tasks
 * Handles all file I/O operations for tasks and configuration
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ForgeTasksConfig } from "./task-types.ts";

// Directory constants
const FORGE_DIR = "forge";
const TASKS_DIR = "tasks";
const CONFIG_FILE = "forge.json";

/**
 * Ensure the forge/ and forge/tasks/ directories exist
 * @param projectRoot - The project root directory
 * @returns The path to forge/tasks/
 */
export async function ensureForgeDirectory(projectRoot: string): Promise<string> {
	const forgeDir = join(projectRoot, FORGE_DIR);
	const tasksDir = join(forgeDir, TASKS_DIR);

	await mkdir(forgeDir, { recursive: true });
	await mkdir(tasksDir, { recursive: true });

	return tasksDir;
}

/**
 * Load forge.json configuration from project root
 * @param projectRoot - The project root directory
 * @returns The configuration object or null if file doesn't exist
 */
export async function loadConfig(projectRoot: string): Promise<ForgeTasksConfig | null> {
	const configPath = join(projectRoot, CONFIG_FILE);

	try {
		const file = Bun.file(configPath);
		const exists = await file.exists();

		if (!exists) {
			return null;
		}

		const content = await file.text();
		return JSON.parse(content) as ForgeTasksConfig;
	} catch (error) {
		// Return null for any errors (file doesn't exist, parse errors, etc.)
		if (process.env.DEBUG) {
			console.error("Error loading config:", error);
		}
		return null;
	}
}

/**
 * Save forge.json configuration to project root
 * @param projectRoot - The project root directory
 * @param config - The configuration object to save
 */
export async function saveConfig(
	projectRoot: string,
	config: ForgeTasksConfig
): Promise<void> {
	const configPath = join(projectRoot, CONFIG_FILE);
	const content = JSON.stringify(config, null, 2);
	await Bun.write(configPath, content + "\n");
}

/**
 * List all .md files in forge/tasks/
 * @param projectRoot - The project root directory
 * @returns Array of filenames (not full paths)
 */
export async function listTaskFiles(projectRoot: string): Promise<string[]> {
	const tasksDir = join(projectRoot, FORGE_DIR, TASKS_DIR);

	try {
		const entries = await readdir(tasksDir);
		return entries.filter((file) => file.endsWith(".md")).sort();
	} catch (error) {
		// Return empty array if directory doesn't exist
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

/**
 * Read task file content from forge/tasks/
 * @param projectRoot - The project root directory
 * @param filename - The filename to read
 * @returns The file content or null if file doesn't exist
 */
export async function readTaskFile(
	projectRoot: string,
	filename: string
): Promise<string | null> {
	const filePath = join(projectRoot, FORGE_DIR, TASKS_DIR, filename);

	try {
		const file = Bun.file(filePath);
		const exists = await file.exists();

		if (!exists) {
			return null;
		}

		return await file.text();
	} catch (error) {
		if (process.env.DEBUG) {
			console.error("Error reading task file:", error);
		}
		return null;
	}
}

/**
 * Write task file to forge/tasks/
 * @param projectRoot - The project root directory
 * @param filename - The filename to write
 * @param content - The content to write
 */
export async function saveTaskFile(
	projectRoot: string,
	filename: string,
	content: string
): Promise<void> {
	// Ensure directory exists
	await ensureForgeDirectory(projectRoot);

	const filePath = join(projectRoot, FORGE_DIR, TASKS_DIR, filename);
	await Bun.write(filePath, content);
}

/**
 * Remove task file from forge/tasks/
 * @param projectRoot - The project root directory
 * @param filename - The filename to delete
 */
export async function deleteTaskFile(
	projectRoot: string,
	filename: string
): Promise<void> {
	const filePath = join(projectRoot, FORGE_DIR, TASKS_DIR, filename);

	try {
		await rm(filePath);
	} catch (error) {
		// Ignore if file doesn't exist
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}
}

/**
 * Characters that are not safe for filenames on common filesystems
 */
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Generate a filename from task ID and title
 * @param task - Object containing id and title
 * @returns Filename in format "{ID} - {Title}.md"
 */
export function getTaskFilename(task: { id: string; title: string }): string {
	// Sanitize title by removing unsafe characters and normalizing whitespace
	const sanitizedTitle = task.title
		.replace(UNSAFE_FILENAME_CHARS, "")
		.replace(/\s+/g, " ")
		.trim();

	return `${task.id} - ${sanitizedTitle}.md`;
}

/**
 * Extract task ID from a filename
 * @param filename - The filename (e.g., "TASK-001 - Some Title.md")
 * @returns The task ID or null if not found
 */
export function parseTaskIdFromFilename(filename: string): string | null {
	// Match pattern: {PREFIX}-{NUMBER} - {Title}.md
	// The ID is everything before " - "
	const match = filename.match(/^([A-Za-z]+-\d+)\s+-\s+.+\.md$/);

	if (match && match[1]) {
		return match[1];
	}

	return null;
}
