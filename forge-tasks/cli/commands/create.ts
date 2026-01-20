import type { Command } from "commander";

export function registerCommand(program: Command): void {
	program
		.command("create")
		.description("Create a new task")
		.argument("<title>", "Task title")
		.option("-d, --description <text>", "Task description")
		.option("-p, --priority <priority>", "Priority: high, medium, low")
		.option("-a, --assignee <name>", "Assignee name")
		.option("-l, --label <label>", "Add a label (can be used multiple times)", collectLabels, [])
		.option("--due <date>", "Due date (YYYY-MM-DD)")
		.option("--dep <taskId>", "Add a dependency (can be used multiple times)", collectDependencies, [])
		.option("--ac <criterion>", "Add acceptance criterion (can be used multiple times)", collectCriteria, [])
		.action(async (title, options) => {
			console.log("Not implemented yet");
		});
}

function collectLabels(value: string, previous: string[]): string[] {
	return [...previous, value];
}

function collectDependencies(value: string, previous: string[]): string[] {
	return [...previous, value];
}

function collectCriteria(value: string, previous: string[]): string[] {
	return [...previous, value];
}
