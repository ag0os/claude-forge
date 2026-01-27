#!/usr/bin/env -S bun run
/**
 * search.ts — Search JSONL conversations in the mapped Claude projects directory
 *
 * Finds the mapped directory for the current repo under ~/.claude/projects and
 * searches all .jsonl files for messages by role (user/system/assistant) that
 * match a case-insensitive substring query.
 *
 * Usage:
 *   search <query> [options]
 *
 * Options:
 *   -r, --role <roles>   Comma-separated roles to include (user,assistant,system,any). Default: user,assistant
 *       --json            Emit JSON results [{file,line,role,timestamp,text}]
 *       --cwd <dir>       Start from a specific directory
 *       --limit <n>       Max results to print (default 1000)
 *       --debug           Show mapping and scan info
 *   -h, --help           Show help
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import os from "node:os";
import { basename, dirname, join } from "node:path";

type Options = {
	roles: Set<string>;
	json: boolean;
	cwd?: string;
	debug: boolean;
	help: boolean;
	limit: number;
};

function showHelp() {
	console.log(
		`search — find messages in mapped JSONL conversations\n\n` +
			`Usage:\n` +
			`  search <query> [options]\n\n` +
			`Options:\n` +
			`  -r, --role <roles>  Comma-separated roles (user,assistant,system,any). Default: user,assistant\n` +
			`      --json          Output JSON objects (file,line,role,timestamp,text)\n` +
			`      --cwd <dir>     Start from this directory instead of the current shell dir\n` +
			`      --limit <n>     Max results to print (default 1000)\n` +
			`      --debug         Log mapping and scan details\n` +
			`  -h, --help          Show help\n\n` +
			`Notes:\n` +
			`  • Matches are case-insensitive substring against extracted text blocks.\n` +
			`  • Roles are taken from message.role when present, otherwise from top-level type.\n`,
	);
}

function parseArgs(argv: string[]): { opts: Options; query: string | null } {
	const opts: Options = {
		roles: new Set(["user", "assistant"]),
		json: false,
		cwd: undefined,
		debug: false,
		help: false,
		limit: 1000,
	};

	let query: string | null = null;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a) continue;
		if (!a.startsWith("-")) {
			if (query === null) query = a;
			else query += ` ${a}`; // allow multi-word queries without quotes
			continue;
		}
		if (a === "-r" || a === "--role") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --role requires a value");
				process.exit(64);
			}
			const parts = v
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean);
			if (parts.includes("any")) {
				opts.roles = new Set(["user", "assistant", "system"]);
			} else {
				opts.roles = new Set(parts);
			}
		} else if (a === "--json") opts.json = true;
		else if (a === "--cwd") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --cwd requires a path");
				process.exit(64);
			}
			opts.cwd = v;
		} else if (a === "--limit") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --limit requires a number");
				process.exit(64);
			}
			const n = Number(v);
			if (!Number.isFinite(n) || n <= 0) {
				console.error("Error: --limit must be a positive number");
				process.exit(64);
			}
			opts.limit = Math.floor(n);
		} else if (a === "--debug") opts.debug = true;
		else if (a === "-h" || a === "--help") opts.help = true;
	}
	return { opts, query };
}

function projectsRoot(): string {
	return join(os.homedir(), ".claude", "projects");
}

function norm(p: string): string {
	return p.replace(/\\/g, "/").replace(/\/$/, "");
}

function unique<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

function candidateStartPaths(cwd?: string): string[] {
	const arr: string[] = [];
	if (cwd) arr.push(cwd);
	if (process.env.PWD) arr.push(process.env.PWD);
	arr.push(process.cwd());
	const more = arr.map((p) => {
		try {
			return norm(realpathSync(p));
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
					if (st.isDirectory() && candidate !== root) {
						if (debug) console.error(`  ✓ Mapped: ${candidate}`);
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
	// fallback: best suffix match
	try {
		const dirs = readdirSync(root, { withFileTypes: true }).filter((d) =>
			d.isDirectory(),
		);
		const target = dashedFromAbs(startAbs);
		let best: { path: string; score: number } | null = null;
		for (const d of dirs) {
			const name = d.name.startsWith("~") ? d.name.slice(1) : d.name;
			const a = name,
				b = target;
			let i = 0;
			while (
				i < a.length &&
				i < b.length &&
				a[a.length - 1 - i] === b[b.length - 1 - i]
			)
				i++;
			if (i > 0 && (!best || i > best.score))
				best = { path: join(root, d.name), score: i };
		}
		if (best) {
			if (debug)
				console.error(
					`  ~ Fallback: ${best.path} (suffix score ${best.score})`,
				);
			return best.path;
		}
	} catch {}
	return null;
}

function listJsonlFiles(dir: string): string[] {
	return readdirSync(dir)
		.filter((f) => f.endsWith(".jsonl"))
		.map((f) => join(dir, f));
}

function extractRoleAndText(obj: unknown): {
	role: string | null;
	text: string;
	timestamp?: string;
} {
	const rec =
		typeof obj === "object" && obj !== null
			? (obj as Record<string, unknown>)
			: undefined;
	const topType =
		typeof rec?.type === "string" ? (rec.type as string) : undefined;
	const maybeMessage = rec?.message as Record<string, unknown> | undefined;
	const role: string | null =
		typeof maybeMessage?.role === "string"
			? ((maybeMessage.role as string) ?? null)
			: typeof topType === "string"
				? topType
				: null;

	const parts: string[] = [];
	function push(v: unknown) {
		if (v == null) return;
		if (typeof v === "string") {
			parts.push(v);
			return;
		}
		if (Array.isArray(v)) {
			for (const x of v) push(x);
			return;
		}
		if (typeof v === "object") {
			const vr = v as Record<string, unknown>;
			if (typeof vr.text === "string") parts.push(vr.text);
			if (typeof vr.content === "string") parts.push(vr.content);
			// Some blocks nest their content as arrays
			if (Array.isArray(vr.content)) push(vr.content);
			// Fallthrough: scan common keys
			for (const k of ["summary", "title", "message", "body"]) {
				if (typeof vr[k] === "string") parts.push(vr[k] as string);
			}
			return;
		}
	}
	// Prefer message.content; fallbacks include summary (for summary lines)
	const msg =
		(rec?.message as Record<string, unknown> | undefined) ?? undefined;
	if (msg && (msg as Record<string, unknown>).content !== undefined)
		push((msg as Record<string, unknown>).content);
	if (typeof rec?.summary === "string") parts.push(rec.summary as string);

	const text = parts.join("\n");
	const timestamp = rec?.timestamp as string | undefined;
	return { role, text, timestamp };
}

function main() {
	const { opts, query } = parseArgs(Bun.argv.slice(2));
	if (opts.help || !query) {
		showHelp();
		return;
	}

	const starts = candidateStartPaths(opts.cwd);
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
			`No mapped directory found under ${projectsRoot()} for ${starts[0]}`,
		);
		process.exit(1);
	}

	const files = listJsonlFiles(mappedDir);
	if (files.length === 0) {
		console.error(`No .jsonl files in ${mappedDir}`);
		process.exit(2);
	}

	const q = query.toLowerCase();
	let printed = 0;
	type SearchResult = {
		file: string;
		line: number;
		role: string | null;
		timestamp?: string;
		text: string;
	};
	const resultsJson: SearchResult[] = [];

	for (const file of files) {
		const data = readFileSync(file, "utf8");
		const lines = data.split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			if (!line.trim()) continue;
			let obj: unknown;
			try {
				obj = JSON.parse(line);
			} catch {
				continue;
			}
			const { role, text, timestamp } = extractRoleAndText(obj);
			const roleNorm = (role ?? "").toLowerCase();
			if (opts.roles.size && roleNorm && !opts.roles.has(roleNorm)) continue;
			if (!text || !text.toLowerCase().includes(q)) continue;

			if (opts.json) {
				resultsJson.push({
					file,
					line: i + 1,
					role: roleNorm || null,
					timestamp,
					text,
				});
			} else {
				const ts = timestamp ? ` [${timestamp}]` : "";
				const who = roleNorm || "unknown";
				const snippet = text.length > 300 ? `${text.slice(0, 297)}...` : text;
				console.log(`${basename(file)}:${i + 1}:${who}${ts}: ${snippet}`);
			}

			printed++;
			if (printed >= opts.limit) break;
		}
		if (printed >= opts.limit) break;
	}

	if (opts.json) {
		console.log(JSON.stringify(resultsJson, null, 2));
	}
}

main();
