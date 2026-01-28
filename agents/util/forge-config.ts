#!/usr/bin/env -S bun run

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import chains from "../../forge/chains.json" with { type: "json" };
import { getForgeRoot } from "../../lib/forge-root";
import packageJson from "../../package.json" with { type: "json" };

const command = process.argv[2];

switch (command) {
	case "chains":
		console.log(JSON.stringify(chains, null, 2));
		break;
	case "agents": {
		// Get bin directory from forge root
		const forgePath = getForgeRoot();
		const binDir = resolve(forgePath, "bin");
		const files = readdirSync(binDir);

		// Filter out hidden files, sort alphabetically, and output one per line
		const agents = files.filter((f) => !f.startsWith(".")).sort();

		for (const agent of agents) {
			console.log(agent);
		}
		break;
	}
	case "path": {
		const forgePath = getForgeRoot();
		if (!existsSync(forgePath)) {
			console.error(`Error: Resolved path does not exist: ${forgePath}`);
			process.exit(1);
		}
		// Verify it's actually the forge root by checking for package.json
		const packageJsonPath = resolve(forgePath, "package.json");
		if (!existsSync(packageJsonPath)) {
			console.error(
				`Error: Not a valid claude-forge root (no package.json): ${forgePath}`,
			);
			process.exit(1);
		}
		console.log(forgePath);
		break;
	}
	case "version":
		console.log(`forge-config ${packageJson.version}`);
		break;
	default:
		console.error("Usage: forge-config <chains|agents|path|version>");
		process.exit(1);
}
