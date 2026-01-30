#!/usr/bin/env -S bun run
import { $ } from "bun";

interface ParallelTask {
	id: string;
	task: string;
	description?: string;
}

interface ParallelTaskResult {
	tasks: ParallelTask[];
}

interface ClaudeResponse {
	type: string;
	subtype: string;
	is_error: boolean;
	result: string;
	session_id: string;
	total_cost_usd: number;
}

async function invokeClaude(
	prompt: string,
	outputFormat: "json" | "text" = "json",
): Promise<string> {
	console.log(`\n[DEBUG] Invoking Claude with output format: ${outputFormat}`);
	console.log(`[DEBUG] Prompt: ${prompt.substring(0, 100)}...`);

	try {
		const result =
			await $`claude --print --output-format ${outputFormat} ${prompt}`.text();
		console.log(
			`[DEBUG] Raw Claude response length: ${result.length} characters`,
		);
		console.log(
			`[DEBUG] First 200 chars of response: ${result.substring(0, 200)}...`,
		);
		return result;
	} catch (error) {
		console.error(`[ERROR] Failed to invoke Claude:`, error);
		throw new Error(`Failed to invoke Claude: ${error}`);
	}
}

function extractJsonFromMarkdown(text: string): string | null {
	console.log(`[DEBUG] Attempting to extract JSON from markdown`);

	// Try to find JSON code block
	const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
	if (jsonBlockMatch?.[1]) {
		console.log(`[DEBUG] Found JSON in code block`);
		return jsonBlockMatch[1];
	}

	// Try to find raw JSON object
	const jsonMatch = text.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
	if (jsonMatch) {
		console.log(`[DEBUG] Found raw JSON object`);
		return jsonMatch[0];
	}

	console.log(`[DEBUG] No JSON found in text`);
	return null;
}

async function splitTaskIntoParallel(task: string): Promise<ParallelTask[]> {
	const prompt = `Given this task: "${task}"
  
Split this into 3-5 parallel subtasks that can be executed independently. Each subtask should be a distinct part of the main task.

For example, if the task is "Write a 3 paragraph story to story.md", you might split it into:
- Write the opening paragraph 
- Write the middle paragraph
- Write the closing paragraph

Return ONLY a JSON object (no markdown, no explanation) with a "tasks" array where each task has:
- id: a unique identifier (1, 2, 3, etc)
- task: the specific subtask to execute
- description: optional brief description

Important: Actually split the task into multiple parts, don't just return the original task.

Return the JSON object directly without any code blocks or markdown formatting.
Example format:
{"tasks": [{"id": "1", "task": "Write the opening paragraph of the story", "description": "Set the scene and introduce characters"}, {"id": "2", "task": "Write the middle paragraph of the story", "description": "Develop the plot"}, {"id": "3", "task": "Write the closing paragraph of the story", "description": "Conclude the narrative"}]}`;

	try {
		console.log(`\n[DEBUG] Splitting task: "${task}"`);
		const result = await invokeClaude(prompt, "json");

		// Parse the Claude response wrapper
		let claudeResponse: ClaudeResponse;
		try {
			claudeResponse = JSON.parse(result);
			console.log(`[DEBUG] Parsed Claude response wrapper successfully`);
			console.log(
				`[DEBUG] Response type: ${claudeResponse.type}, subtype: ${claudeResponse.subtype}`,
			);
			console.log(`[DEBUG] Is error: ${claudeResponse.is_error}`);
		} catch (parseError) {
			console.error(
				`[ERROR] Failed to parse Claude response wrapper:`,
				parseError,
			);
			throw new Error(`Invalid Claude response format: ${parseError}`);
		}

		if (claudeResponse.is_error) {
			throw new Error(`Claude returned an error: ${claudeResponse.result}`);
		}

		// Extract JSON from the result field
		const resultContent = claudeResponse.result;
		console.log(
			`[DEBUG] Claude result content: ${resultContent.substring(0, 300)}...`,
		);

		// Try to extract JSON from the result
		const jsonStr = extractJsonFromMarkdown(resultContent) || resultContent;

		// Parse the tasks JSON
		let parsed: ParallelTaskResult;
		try {
			parsed = JSON.parse(jsonStr);
			console.log(`[DEBUG] Successfully parsed tasks JSON`);
			console.log(`[DEBUG] Found ${parsed.tasks?.length || 0} tasks`);
		} catch (parseError) {
			console.error(`[ERROR] Failed to parse tasks JSON:`, parseError);
			console.error(`[ERROR] Attempted to parse:`, jsonStr);

			// Fallback: create a single task
			console.log(`[DEBUG] Falling back to single task`);
			return [
				{
					id: "1",
					task: task,
					description: "Original task (failed to split)",
				},
			];
		}

		if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
			console.error(`[ERROR] Invalid tasks format:`, parsed);
			throw new Error("Response does not contain a valid tasks array");
		}

		return parsed.tasks;
	} catch (error) {
		console.error(`[ERROR] Failed to split task:`, error);
		// Fallback: return the original task as a single item
		return [
			{
				id: "1",
				task: task,
				description: "Original task (error during split)",
			},
		];
	}
}

async function executeParallelTasks(
	tasks: ParallelTask[],
): Promise<Map<string, string>> {
	const results = new Map<string, string>();

	console.log(`\n[DEBUG] Starting parallel execution of ${tasks.length} tasks`);

	const promises = tasks.map(async (task) => {
		console.log(`[DEBUG] Starting execution of task ${task.id}: ${task.task}`);
		try {
			const result = await invokeClaude(task.task, "text");

			// Parse the response to get the actual result
			let actualResult: string;
			try {
				const response: ClaudeResponse = JSON.parse(result);
				actualResult = response.result;
				console.log(`[DEBUG] Task ${task.id} completed successfully`);
			} catch {
				// If parsing fails, use the raw result
				actualResult = result;
				console.log(`[DEBUG] Task ${task.id} completed (raw response)`);
			}

			results.set(task.id, actualResult);
		} catch (error) {
			console.error(`[ERROR] Task ${task.id} failed:`, error);
			results.set(task.id, `Error: ${error}`);
		}
	});

	await Promise.all(promises);
	console.log(`[DEBUG] All tasks completed`);
	return results;
}

export async function runParallelAgent(initialTask: string): Promise<void> {
	try {
		console.log("=== Starting Parallel Agent ===");
		console.log(`Initial task: "${initialTask}"`);

		console.log("\nSplitting task into parallel subtasks...");
		const parallelTasks = await splitTaskIntoParallel(initialTask);

		if (!parallelTasks || parallelTasks.length === 0) {
			console.error("No tasks were generated");
			return;
		}

		console.log(`\nIdentified ${parallelTasks.length} parallel tasks:`);
		parallelTasks.forEach((task) => {
			console.log(`- [${task.id}] ${task.task}`);
			if (task.description) {
				console.log(`  Description: ${task.description}`);
			}
		});

		console.log("\nExecuting tasks in parallel...");
		const results = await executeParallelTasks(parallelTasks);

		console.log("\n=== Results ===");
		parallelTasks.forEach((task) => {
			console.log(`\n--- Task ${task.id}: ${task.task} ---`);
			const result = results.get(task.id);
			if (result) {
				console.log(result);
			} else {
				console.log("[No result]");
			}
			console.log("--- End of Task ---");
		});

		console.log("\n=== Parallel Agent Completed ===");
	} catch (error) {
		console.error("\n[FATAL] Error running parallel agent:", error);
		if (error instanceof Error) {
			console.error("Stack trace:", error.stack);
		}
		process.exit(1);
	}
}

// CLI entry point
if (import.meta.main) {
	const task = process.argv[2];
	if (!task) {
		console.error('Usage: bun run agents/parallel.ts "<task>"');
		console.error(
			'Example: bun run agents/parallel.ts "Write a 3 paragraph story to story.md"',
		);
		process.exit(1);
	}

	runParallelAgent(task);
}
