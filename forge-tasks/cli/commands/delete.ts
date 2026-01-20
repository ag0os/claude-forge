import type { Command } from "commander";

export function registerCommand(program: Command): void {
	program
		.command("delete")
		.alias("rm")
		.description("Delete a task")
		.argument("<taskId>", "Task ID to delete (e.g., TASK-001)")
		.option("-f, --force", "Skip confirmation prompt")
		.action(async (taskId, options) => {
			console.log("Not implemented yet");
		});
}
