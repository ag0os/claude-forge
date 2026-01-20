import type { Command } from "commander";

export function registerCommand(program: Command): void {
	program
		.command("view")
		.alias("show")
		.description("View a single task")
		.argument("<taskId>", "Task ID to view (e.g., TASK-001)")
		.action(async (taskId) => {
			console.log("Not implemented yet");
		});
}
