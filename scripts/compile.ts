#!/usr/bin/env bun
import { $ } from "bun";
import { basename, dirname, relative, resolve } from "path";

const input = process.argv[2];
if (!input) {
	console.error("Usage: bun compile <typescript-file>");
	process.exit(1);
}

const agentsDir = resolve(process.cwd(), "agents");
const inputPath = resolve(process.cwd(), input);

/**
 * Convert a file path to a namespaced binary name
 * - If file is under agents/, use directory structure for namespace
 * - Root level: agents/foo.ts → foo
 * - Subdirectory: agents/forge-tasks/manager.ts → forge-tasks:manager
 * - Outside agents/: use just the filename
 */
function toBinaryName(filePath: string): string {
	const base = basename(filePath, ".ts").replace(".tsx", "");

	// Check if file is under agents directory
	const relativePath = relative(agentsDir, filePath);
	if (relativePath.startsWith("..") || relativePath === filePath) {
		// File is outside agents directory, use plain name
		return base;
	}

	const dir = dirname(relativePath);
	if (dir === ".") {
		// Root level agent, no namespace
		return base;
	}

	// Subdirectory agent, use colon-separated namespace
	// Handle nested dirs: a/b/c.ts → a:b:c
	const namespace = dir.split("/").join(":");
	return `${namespace}:${base}`;
}

const outputName = toBinaryName(inputPath);
const outputPath = `./bin/${outputName}`;

console.log(`Compiling ${input} → ${outputPath}`);

// Generate static asset maps so Bun can inline all assets
await $`bun scripts/gen-assets.ts`;

// Build a single-file binary
await $`bun build --compile ${input} --outfile ${outputPath}`;

console.log(`✓ Compiled ${outputName}`);
