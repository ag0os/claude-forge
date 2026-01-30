#!/usr/bin/env bun

/**
 * Forge CLI - Unified entry point for claude-forge tools
 *
 * Usage:
 *   forge tasks <command>    - Task management
 *   forge orch <args>        - Agent orchestration
 *   forge config <command>   - Configuration and discovery
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function getForgeRoot(): string {
	// Try to find forge root by looking for package.json
	// Start from current working directory and walk up
	let dir = process.cwd();
	while (dir !== "/") {
		if (existsSync(resolve(dir, "package.json"))) {
			const pkg = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf-8"));
			if (pkg.name === "claude-forge") {
				return dir;
			}
		}
		dir = dirname(dir);
	}
	// Fallback: assume we're in the forge root
	return process.cwd();
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

	case "orch": {
		const result = spawnSync(resolve(getBinDir(), "orch:forkhestra"), args, {
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
			case "chains": {
				const chainsPath = resolve(forgeRoot, "forge/orch/chains.json");
				const chains = JSON.parse(readFileSync(chainsPath, "utf-8"));
				console.log(JSON.stringify(chains, null, 2));
				break;
			}
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
				console.error("Usage: forge config <chains|agents|path>");
				process.exit(1);
		}
		break;
	}

	case "-h":
	case "--help":
	case "help":
	case undefined:
		console.log(`Usage: forge <command> [options]

Claude Forge - Agent orchestration and task management

Commands:
  tasks <cmd>     Task management (list, create, edit, view, delete, search)
  orch <args>     Agent orchestration (run chains, loops, pipelines)
  config <cmd>    Configuration (chains, agents, path)

Examples:
  forge tasks list --ready
  forge orch --chain build
  forge orch "planner:3 -> builder:10"
  forge config chains

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
