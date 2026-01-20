#!/usr/bin/env bun
import { Command } from "commander";
import { registerCommand as registerCreate } from "./commands/create";
import { registerCommand as registerDelete } from "./commands/delete";
import { registerCommand as registerEdit } from "./commands/edit";
import { registerCommand as registerInit } from "./commands/init";
import { registerCommand as registerList } from "./commands/list";
import { registerCommand as registerSearch } from "./commands/search";
import { registerCommand as registerView } from "./commands/view";

const program = new Command();

program
	.name("forge-tasks")
	.description("Task management for claude-forge projects")
	.version("1.0.0");

// Global options
program
	.option("--plain", "Output in plain text format (for agents)")
	.option("--json", "Output in JSON format");

// Register subcommands
registerInit(program);
registerCreate(program);
registerList(program);
registerView(program);
registerEdit(program);
registerDelete(program);
registerSearch(program);

program.parse();
