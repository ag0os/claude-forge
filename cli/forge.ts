#!/usr/bin/env bun

/**
 * Forge CLI - Unified entry point for claude-forge tools
 *
 * Usage:
 *   forge tasks <command>    - Task management
 *   forge config <command>   - Configuration and discovery
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function getForgeRoot(): string {
	// Check if running as compiled binary by looking for bun's virtual filesystem
	const isCompiled = import.meta.dir.startsWith("/$bunfs");

	if (isCompiled) {
		// Compiled binary: process.execPath is /path/to/claude-forge/bin/forge
		// Go up one level from bin/ to get forge root
		return resolve(dirname(process.execPath), "..");
	}

	// Running via bun: import.meta.dir is /path/to/claude-forge/cli
	// Go up one level to get forge root
	return resolve(import.meta.dir, "..");
}

function getBinDir(): string {
	const forgeRoot = getForgeRoot();
	return resolve(forgeRoot, "bin");
}

const subcommand = process.argv[2];
const args = process.argv.slice(3);

switch (subcommand) {
	case "tasks": {
		const result = spawnSync(resolve(getBinDir(), "forge-tasks"), args, {
			stdio: "inherit",
			cwd: process.cwd(),
		});
		process.exit(result.status ?? 1);
		break;
	}

	case "config": {
		const configSubcmd = args[0];
		const forgeRoot = getForgeRoot();
		switch (configSubcmd) {
			case "agents": {
				const binDir = getBinDir();
				const files = readdirSync(binDir)
					.filter((f) => !f.startsWith("."))
					.sort();
				for (const f of files) {
					console.log(f);
				}
				break;
			}
			case "path": {
				console.log(forgeRoot);
				break;
			}
			default:
				console.error("Usage: forge config <agents|path>");
				process.exit(1);
		}
		break;
	}

	case "-h":
	case "--help":
	case "help":
	case undefined:
		console.log(`Usage: forge <command> [options]

Claude Forge - Task management and configuration

Commands:
  tasks <cmd>     Task management (list, create, edit, view, delete, search)
  config <cmd>    Configuration (agents, path)

Examples:
  forge tasks list --ready
  forge config agents

Run 'forge <command> --help' for command-specific help.`);
		break;

	case "-V":
	case "--version":
		console.log("forge 1.0.0");
		break;

	default:
		console.error(`Unknown command: ${subcommand}`);
		console.error("Run 'forge --help' for usage.");
		process.exit(1);
}
