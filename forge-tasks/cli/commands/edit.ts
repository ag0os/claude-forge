import type { Command } from "commander";

export function registerCommand(program: Command): void {
	program
		.command("edit")
		.alias("update")
		.description("Edit a task")
		.argument("<taskId>", "Task ID to edit (e.g., TASK-001)")
		.option("-t, --title <title>", "Update title")
		.option("-d, --description <text>", "Update description")
		.option("-s, --status <status>", "Update status: todo, in-progress, done, blocked")
		.option("-p, --priority <priority>", "Update priority: high, medium, low")
		.option("-a, --assignee <name>", "Update assignee")
		.option("--due <date>", "Update due date (YYYY-MM-DD)")
		.option("--add-label <label>", "Add a label", collectLabels, [])
		.option("--remove-label <label>", "Remove a label", collectLabels, [])
		.option("--add-dep <taskId>", "Add a dependency", collectDependencies, [])
		.option("--remove-dep <taskId>", "Remove a dependency", collectDependencies, [])
		.option("--check-ac <index>", "Check acceptance criterion by index", collectIndices, [])
		.option("--uncheck-ac <index>", "Uncheck acceptance criterion by index", collectIndices, [])
		.action(async (taskId, options) => {
			console.log("Not implemented yet");
		});
}

function collectLabels(value: string, previous: string[]): string[] {
	return [...previous, value];
}

function collectDependencies(value: string, previous: string[]): string[] {
	return [...previous, value];
}

function collectIndices(value: string, previous: number[]): number[] {
	const num = parseInt(value, 10);
	if (!isNaN(num)) {
		return [...previous, num];
	}
	return previous;
}
