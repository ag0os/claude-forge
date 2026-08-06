#!/usr/bin/env bun
/**
 * Rebuild every agent in agents/ and prune orphaned binaries.
 *
 * `bun watch` only reacts to files that change, so deleted agents leave stale
 * binaries in bin/ that still run off prompts embedded at their last compile.
 * This is the sweep that fixes that.
 *
 * Binaries produced by the other `compile:*` package scripts (orchestra,
 * forge-tasks, …) are detected from package.json and never pruned.
 *
 * Usage:
 *   bun run compile:all
 *   bun run compile:all --dry-run    # report what would change, build nothing
 *   bun run compile:all --no-prune   # rebuild only, leave orphans alone
 */

import { $ } from "bun";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { toBinaryName } from "./binary-name";

const dryRun = process.argv.includes("--dry-run");
const prune = !process.argv.includes("--no-prune");

const root = process.cwd();
const agentsDir = resolve(root, "agents");
const binDir = resolve(root, "bin");

/** Every .ts/.tsx under agents/, minus test files. */
function findAgents(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			found.push(...findAgents(full));
			continue;
		}
		if (!/\.tsx?$/.test(entry.name)) continue;
		if (/\.(test|spec)\.tsx?$/.test(entry.name)) continue;
		found.push(full);
	}
	return found.sort();
}

/** Binaries owned by other compile:* scripts — never ours to prune. */
function protectedBinaries(): Set<string> {
	const names = new Set<string>();
	try {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		for (const command of Object.values(pkg.scripts ?? {})) {
			const match = /--outfile\s+(?:\.\/)?bin\/(\S+)/.exec(String(command));
			const name = match?.[1];
			if (name) names.add(name);
		}
	} catch (error) {
		console.warn(`Could not read package.json, protecting nothing: ${error}`);
	}
	return names;
}

if (!existsSync(agentsDir)) {
	console.error("No agents/ directory here — run from the repo root.");
	process.exit(1);
}

const sources = findAgents(agentsDir);
const expected = new Map(sources.map((file) => [toBinaryName(file, root), file]));

console.log(
	`${dryRun ? "[dry run] " : ""}${sources.length} agents → bin/\n`,
);

if (!dryRun) {
	// Once for the whole sweep; compile.ts does this per invocation.
	await $`bun scripts/gen-assets.ts`.quiet();
}

let built = 0;
let failed = 0;

for (const [name, file] of [...expected].sort()) {
	const relativeFile = file.slice(root.length + 1);
	if (dryRun) {
		console.log(`  would build ${name}`);
		continue;
	}
	try {
		await $`bun build --compile ${relativeFile} --outfile ${`./bin/${name}`}`.quiet();
		console.log(`  ✓ ${name}`);
		built++;
	} catch (error) {
		console.error(`  ✗ ${name} — ${error}`);
		failed++;
	}
}

if (prune && existsSync(binDir)) {
	const keep = protectedBinaries();
	const orphans = readdirSync(binDir).filter(
		(entry) => !expected.has(entry) && !keep.has(entry),
	);

	if (orphans.length > 0) {
		console.log(`\n${dryRun ? "Would prune" : "Pruning"} ${orphans.length} orphaned binaries:`);
		for (const orphan of orphans) {
			console.log(`  - ${orphan}`);
			if (!dryRun) rmSync(join(binDir, orphan), { force: true });
		}
	}
}

if (!dryRun) {
	console.log(`\n${built} built, ${failed} failed.`);
}
if (failed > 0) process.exit(1);
