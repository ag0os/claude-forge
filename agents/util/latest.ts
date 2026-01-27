#!/usr/bin/env -S bun run
/**
 * latest.ts — Find the newest .jsonl for the current project's mapped dir under ~/.claude/projects
 *
 * Usage:
 *   latest                 # prints path to newest .jsonl
 *   latest --print         # prints file contents
 *   latest --json          # prints { path, size, mtime }
 *   latest --cwd <dir>     # start from a specific directory
 *   latest --debug         # show what was attempted
 *
 * Build (single native binary):
 *   bun build --compile latest.ts --outfile latest
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";

type Options = {
	print: boolean;
	json: boolean;
	cwd?: string;
	debug: boolean;
	help: boolean;
};

function showHelp() {
	console.log(
		`latest — find the newest .jsonl conversation for the current project

Usage:
  latest [options]

Options:
  -p, --print          Print the file contents instead of the path
      --json           Print JSON metadata { path, size, mtime }
      --cwd <dir>      Start from this directory instead of the current shell dir
      --debug          Log candidate paths and decisions
  -h, --help           Show this help

Notes:
  • Mapping uses your shell-visible PWD first (preserves symlinks), then fallbacks.
  • Folder mapping examples:
      /Users/johnlindquist/dev/claude-workshop-live
        → ~/.claude/projects/~Users-johnlindquist-dev-claude-workshop-live
        (fallback also tries without the leading "~").
  • "Latest" is chosen by filesystem mtime, not by filename.
`.trim(),
	);
}

function parseArgs(argv: string[]): Options {
	const opts: Options = {
		print: false,
		json: false,
		cwd: undefined,
		debug: false,
		help: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "-p" || a === "--print") opts.print = true;
		else if (a === "--json") opts.json = true;
		else if (a === "--cwd") {
			if (i + 1 >= argv.length) {
				console.error("Error: --cwd requires a path");
				process.exit(64);
			}
			opts.cwd = argv[++i];
		} else if (a === "--debug") opts.debug = true;
		else if (a === "-h" || a === "--help") opts.help = true;
	}
	return opts;
}

function projectsRoot(): string {
	return join(os.homedir(), ".claude", "projects");
}

function norm(p: string): string {
	let out = p.replace(/\\/g, "/");
	if (out.endsWith("/")) out = out.slice(0, -1);
	return out;
}

function _normalizeAbs(p: string): string {
	try {
		return norm(realpathSync(p));
	} catch {
		return norm(p);
	}
}

function unique<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

function candidateStartPaths(opts: Options): string[] {
	const arr: string[] = [];
	if (opts.cwd) arr.push(opts.cwd);
	if (process.env.PWD) arr.push(process.env.PWD);
	arr.push(process.cwd());

	// Add realpaths for each
	const more = arr.map((p) => {
		try {
			return realpathSync(p);
		} catch {
			return p;
		}
	});

	return unique([...arr, ...more]).map(norm);
}

function dashedFromAbs(abs: string): string {
	const cleaned = abs.replace(/^\/+/, "").replace(/\/$/, "");
	return cleaned.split("/").join("-");
}

function mappedNames(abs: string): string[] {
	const d = dashedFromAbs(abs);
	return [`~${d}`, d];
}

function findMappedDirFrom(startAbs: string, debug = false): string | null {
	const root = projectsRoot();
	if (debug) console.error(`→ Searching from: ${startAbs}`);

	let cur = startAbs;
	for (;;) {
		for (const name of mappedNames(cur)) {
			const candidate = join(root, name);
			if (existsSync(candidate)) {
				try {
					const st = statSync(candidate);
					if (st.isDirectory()) {
						if (candidate === root) continue; // never treat the root as the mapped project
						if (debug) console.error(`  ✓ Found mapped dir: ${candidate}`);
						return candidate;
					}
				} catch {}
			} else if (debug) {
				console.error(`  ✗ Missing: ${candidate}`);
			}
		}
		const parent = dirname(cur);
		if (parent === cur) break;
		cur = parent;
	}

	// Heuristic fallback: pick the best suffix match in ~/.claude/projects
	try {
		const dirs = readdirSync(root, { withFileTypes: true }).filter((d) =>
			d.isDirectory(),
		);
		const target = dashedFromAbs(startAbs);
		let best: { path: string; score: number } | null = null;

		for (const d of dirs) {
			const name = d.name.startsWith("~") ? d.name.slice(1) : d.name;
			// Score by length of common suffix with the dashed startAbs
			const a = name,
				b = target;
			let i = 0;
			while (
				i < a.length &&
				i < b.length &&
				a[a.length - 1 - i] === b[b.length - 1 - i]
			)
				i++;
			const score = i;
			if (score > 0 && (!best || score > best.score)) {
				best = { path: join(root, d.name), score };
			}
		}
		if (best) {
			if (debug)
				console.error(
					`  ~ Fallback chose: ${best.path} (suffix score ${best.score})`,
				);
			return best.path;
		}
	} catch {}

	return null;
}

function findLatestJsonl(
	dir: string,
): { path: string; mtimeMs: number } | null {
	let latestPath: string | null = null;
	let latestTime = -Infinity;

	const entries = readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
		const p = join(dir, e.name);
		try {
			const st = statSync(p);
			if (st.isFile() && st.mtimeMs > latestTime) {
				latestTime = st.mtimeMs;
				latestPath = p;
			}
		} catch {}
	}
	return latestPath ? { path: latestPath, mtimeMs: latestTime } : null;
}

function main() {
	const opts = parseArgs(Bun.argv.slice(2));
	if (opts.help) {
		showHelp();
		return;
	}

	const starts = candidateStartPaths(opts);
	if (opts.debug) {
		console.error(`PWD: ${process.env.PWD ?? "(unset)"}`);
		console.error(`process.cwd(): ${process.cwd()}`);
		console.error("Start candidates:");
		for (const s of starts) console.error(`  - ${s}`);
	}

	let mappedDir: string | null = null;
	for (const s of starts) {
		mappedDir = findMappedDirFrom(s, opts.debug);
		if (mappedDir) break;
	}

	if (!mappedDir) {
		console.error(
			`No mapped directory found for:
  ${starts[0]}
under:
  ${projectsRoot()}
(try: --debug to see attempted candidates)`,
		);
		process.exit(1);
	}

	const latest = findLatestJsonl(mappedDir);
	if (!latest) {
		console.error(`No .jsonl files found in:\n  ${mappedDir}`);
		process.exit(2);
	}

	if (opts.json) {
		const st = statSync(latest.path);
		console.log(
			JSON.stringify({
				path: latest.path,
				size: st.size,
				mtime: new Date(latest.mtimeMs).toISOString(),
			}),
		);
		return;
	}

	if (opts.print) {
		process.stdout.write(readFileSync(latest.path, "utf8"));
		return;
	}

	console.log(latest.path);
}

main();
