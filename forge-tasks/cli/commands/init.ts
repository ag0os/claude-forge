import type { Command } from "commander";

export function registerCommand(program: Command): void {
	program
		.command("init")
		.description("Initialize forge-tasks in a project")
		.option("-p, --prefix <prefix>", "Task ID prefix (default: TASK)")
		.option("-n, --name <name>", "Project name")
		.action(async (options) => {
			console.log("Not implemented yet");
		});
}
