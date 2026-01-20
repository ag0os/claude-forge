import type { Command } from "commander";

export function registerCommand(program: Command): void {
	program
		.command("search")
		.description("Search tasks")
		.argument("<query>", "Search query")
		.option("-s, --status <status>", "Filter by status: todo, in-progress, done, blocked")
		.option("-p, --priority <priority>", "Filter by priority: high, medium, low")
		.option("-l, --label <label>", "Filter by label")
		.action(async (query, options) => {
			console.log("Not implemented yet");
		});
}
