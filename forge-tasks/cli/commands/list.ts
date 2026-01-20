import type { Command } from "commander";

export function registerCommand(program: Command): void {
	program
		.command("list")
		.alias("ls")
		.description("List all tasks")
		.option("-s, --status <status>", "Filter by status: todo, in-progress, done, blocked")
		.option("-p, --priority <priority>", "Filter by priority: high, medium, low")
		.option("-a, --assignee <name>", "Filter by assignee")
		.option("-l, --label <label>", "Filter by label")
		.option("--ready", "Show only tasks with no dependencies")
		.action(async (options) => {
			console.log("Not implemented yet");
		});
}
