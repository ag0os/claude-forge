#!/usr/bin/env bun
import { $ } from "bun";
import { resolve } from "node:path";
import { toBinaryName } from "./binary-name";

const input = process.argv[2];
if (!input) {
	console.error("Usage: bun compile <typescript-file>");
	process.exit(1);
}

const inputPath = resolve(process.cwd(), input);
const outputName = toBinaryName(inputPath);
const outputPath = `./bin/${outputName}`;

console.log(`Compiling ${input} → ${outputPath}`);

// Generate static asset maps so Bun can inline all assets
await $`bun scripts/gen-assets.ts`;

// Build a single-file binary
await $`bun build --compile ${input} --outfile ${outputPath}`;

console.log(`✓ Compiled ${outputName}`);
