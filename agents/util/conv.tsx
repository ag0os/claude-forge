#!/usr/bin/env -S bun run

/**
 * conv.ts — Conversation utilities for mapped JSONL projects
 *
 * Subcommands:
 *   conv latest             # Pick actions for the newest .jsonl
 *   conv search [query?]    # Live search UI (selection-first) then unified Action Sheet
 *   conv export [options]   # Non-interactive export (scriptable)
 *
 * Examples:
 *   bun run agents/conv.ts latest
 *   bun run agents/conv.ts search "hello world"
 *   bun run agents/conv.ts export --md --stdout --file path/to/file.jsonl
 */

import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import { basename, dirname, join } from "node:path";
import { Box, render, Text, useApp, useInput } from "ink";
import React from "react";

// ───────────────────────────────────────────────────────────────────────────────
// Shared helpers (unchanged)
// ───────────────────────────────────────────────────────────────────────────────
function projectsRoot(): string {
	return join(os.homedir(), ".claude", "projects");
}
function norm(p: string): string {
	let out = p.replace(/\\/g, "/");
	if (out.endsWith("/")) out = out.slice(0, -1);
	return out;
}
function normalizeAbs(p: string): string {
	try {
		return norm(realpathSync(p));
	} catch {
		return norm(p);
	}
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
					if (st.isDirectory() && candidate !== root) {
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
	// Fallback: best suffix match
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
			const score = i;
			if (score > 0 && (!best || score > best.score))
				best = { path: join(root, d.name), score };
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

function listJsonlFiles(dir: string): string[] {
	return readdirSync(dir)
		.filter((f) => f.endsWith(".jsonl"))
		.map((f) => join(dir, f));
}

// ───────────────────────────────────────────────────────────────────────────────
// Transcript helpers (mostly unchanged)
// ───────────────────────────────────────────────────────────────────────────────
type TranscriptMessage = { role: string; text: string; timestamp?: string };

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
			if (Array.isArray(vr.content)) push(vr.content);
			for (const k of ["summary", "title", "message", "body"]) {
				if (typeof vr[k] === "string") parts.push(vr[k] as string);
			}
			return;
		}
	}
	const msg =
		(rec?.message as Record<string, unknown> | undefined) ?? undefined;
	if (msg && (msg as Record<string, unknown>).content !== undefined)
		push((msg as Record<string, unknown>).content);
	if (typeof rec?.summary === "string") parts.push(rec.summary as string);
	const text = parts.join("\n");
	const timestamp = rec?.timestamp as string | undefined;
	return { role, text, timestamp };
}

function parseJsonlMessages(jsonlPath: string): TranscriptMessage[] {
	const data = readFileSync(jsonlPath, "utf8");
	const out: TranscriptMessage[] = [];
	for (const line of data.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let obj: unknown;
		try {
			obj = JSON.parse(trimmed);
		} catch {
			continue;
		}
		const { role, text, timestamp } = extractRoleAndText(obj);
		const roleLabel = (role || "unknown").toLowerCase();
		out.push({ role: roleLabel, text: text || "", timestamp });
	}
	return out;
}

function seemsCodeBlock(text: string): boolean {
	if (text.includes("```")) return true;
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 3) return false;
	const codey = lines.filter(
		(l) =>
			/^(\s*([#>]|\/\/|\/\*|\*|\{|\}|const\b|let\b|var\b|function\b|class\b|if\b|for\b|while\b|return\b|import\b|export\b|def\b|print\b))/.test(
				l,
			) || /(;|\{|\}|=>|\(\)|\)\s*\{|\bconsole\.log\b)/.test(l),
	);
	return codey.length / lines.length >= 0.4;
}

function buildTranscriptText(
	messages: TranscriptMessage[],
	sourceFile: string,
	asMarkdown: boolean,
): string {
	const lines: string[] = [];
	const exportedAt = new Date().toISOString();
	if (asMarkdown) {
		lines.push(`# Conversation Export`);
		lines.push("");
		lines.push(`- Source: ${sourceFile}`);
		lines.push(`- Exported: ${exportedAt}`);
		lines.push("");
		for (const m of messages) {
			const headerTime = m.timestamp ? ` (${m.timestamp})` : "";
			lines.push(`## ${m.role}${headerTime}`);
			lines.push("");
			const text = m.text || "";
			if (text.includes("```")) {
				lines.push(text);
			} else if (seemsCodeBlock(text)) {
				lines.push("```");
				lines.push(text);
				lines.push("```");
			} else {
				lines.push(text);
			}
			lines.push("");
		}
	} else {
		lines.push(
			`Conversation Export\nSource: ${sourceFile}\nExported: ${exportedAt}`,
		);
		lines.push("");
		for (const m of messages) {
			const ts = m.timestamp ? ` [${m.timestamp}]` : "";
			lines.push(`${m.role}${ts}:`);
			lines.push(m.text || "");
			lines.push("");
		}
	}
	return lines.join("\n");
}

function deriveTitleFromMessages(messages: TranscriptMessage[]): string | null {
	const firstUser = messages.find(
		(m) => m.role === "user" && m.text.trim().length > 0,
	);
	const candidate: string | null =
		firstUser?.text ??
		messages.find((m) => m.text.trim().length > 0)?.text ??
		null;
	if (typeof candidate !== "string") return null;
	const firstLineCandidate = candidate as string;
	const parts = firstLineCandidate.split(/\r?\n/);
	let singleLine = (parts[0] ?? "").trim();
	if (singleLine.length > 50) singleLine = `${singleLine.slice(0, 50)}...`;
	return singleLine;
}

function slugifyTitle(title: string): string {
	const lower = title.toLowerCase();
	return lower
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function isoDateOnly(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function ensureParentDir(filePath: string) {
	const dir = dirname(filePath);
	try {
		mkdirSync(dir, { recursive: true });
	} catch {}
}

// ───────────────────────────────────────────────────────────────────────────────
// Small search utilities (unchanged or lightly adjusted)
// ───────────────────────────────────────────────────────────────────────────────
type CachedFile = { path: string; title: string | null; lines: string[] };

function getAllJsonlFiles(mappedDir: string): string[] {
	return listJsonlFiles(mappedDir);
}

function buildCache(files: string[]): CachedFile[] {
	return files.map((p) => {
		const data = readFileSync(p, "utf8");
		const msgs: TranscriptMessage[] = [];
		for (const line of data.split(/\r?\n/)) {
			const t = line.trim();
			if (!t) continue;
			try {
				const obj = JSON.parse(t);
				const { role, text } = extractRoleAndText(obj);
				msgs.push({
					role: (role || "unknown").toLowerCase(),
					text: text || "",
				});
			} catch {}
		}
		const title = deriveTitleFromMessages(msgs);
		const lines = data.split(/\r?\n/);
		return { path: p, title, lines };
	});
}

function firstMatchSnippet(lines: string[], q: string): React.ReactNode | null {
	if (!q) return null;
	const lq = q.toLowerCase();
	for (let i = 0; i < lines.length; i++) {
		const s = lines[i];
		if (!s) continue;
		try {
			const obj = JSON.parse(s);
			const { text } = extractRoleAndText(obj);
			if (text?.toLowerCase().includes(lq)) {
				const one = text.replace(/\s+/g, " ").trim();
				const shortened = one.length > 140 ? `${one.slice(0, 137)}...` : one;
				return highlightMatch(shortened, q);
			}
		} catch {}
	}
	return null;
}

// Helper function to highlight matched text
function highlightMatch(text: string, query: string): React.ReactNode {
	if (!query) return text;

	const parts: React.ReactNode[] = [];
	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	let lastIndex = 0;
	let matchIndex = lowerText.indexOf(lowerQuery);

	while (matchIndex !== -1) {
		// Add text before match
		if (matchIndex > lastIndex) {
			parts.push(
				<Text key={`text-${lastIndex}`}>
					{text.slice(lastIndex, matchIndex)}
				</Text>,
			);
		}

		// Add highlighted match
		parts.push(
			<Text key={`match-${matchIndex}`} color="yellow" bold>
				{text.slice(matchIndex, matchIndex + query.length)}
			</Text>,
		);

		lastIndex = matchIndex + query.length;
		matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
	}

	// Add remaining text
	if (lastIndex < text.length) {
		parts.push(<Text key={`text-${lastIndex}`}>{text.slice(lastIndex)}</Text>);
	}

	return <>{parts}</>;
}

function countMatches(lines: string[], q: string, roles?: Set<string>): number {
	const lq = q.toLowerCase();
	let c = 0;
	for (const s of lines) {
		if (!s) continue;
		try {
			const obj = JSON.parse(s);
			const { role, text } = extractRoleAndText(obj);
			const rn = (role || "").toLowerCase();
			if (roles?.size && rn && !roles.has(rn)) continue;
			if (text?.toLowerCase().includes(lq)) c++;
		} catch {}
	}
	return c;
}

function copyToClipboard(text: string): boolean {
	try {
		const plat = process.platform;
		if (plat === "darwin") {
			execSync("pbcopy", { input: text });
			return true;
		}
		if (plat === "win32") {
			execSync("clip", { input: text });
			return true;
		}
		try {
			execSync("xclip -selection clipboard", {
				input: text,
				stdio: ["pipe", "ignore", "ignore"],
			});
			return true;
		} catch {}
		try {
			execSync("wl-copy", {
				input: text,
				stdio: ["pipe", "ignore", "ignore"],
			});
			return true;
		} catch {}
	} catch {}
	return false;
}

// ───────────────────────────────────────────────────────────────────────────────
// Unified Action Sheet (shared by search + latest)
// ───────────────────────────────────────────────────────────────────────────────

type ActionMode =
	| "stdout-md"
	| "stdout-txt"
	| "file-md"
	| "file-txt"
	| "clipboard-md"
	| "clipboard-txt"
	| "cancel";
const ACTIONS: { id: ActionMode; label: string }[] = [
	{ id: "stdout-md", label: "Print to stdout (Markdown)" },
	{ id: "stdout-txt", label: "Print to stdout (Plain Text)" },
	{ id: "file-md", label: "Write to file (Markdown)" },
	{ id: "file-txt", label: "Write to file (Plain Text)" },
	{ id: "clipboard-md", label: "Copy to Clipboard (Markdown)" },
	{ id: "clipboard-txt", label: "Copy to Clipboard (Plain Text)" },
	{ id: "cancel", label: "Cancel" },
];

function combinedTranscriptText(
	files: string[],
	roles: Set<string> | undefined,
	markdown: boolean,
): string {
	const transcripts: { path: string; messages: TranscriptMessage[] }[] = [];
	for (const p of files) {
		let msgs = parseJsonlMessages(p);
		if (roles?.size) msgs = msgs.filter((m) => !m.role || roles.has(m.role));
		transcripts.push({ path: p, messages: msgs });
	}
	const parts: string[] = [];
	for (const { path, messages } of transcripts) {
		if (transcripts.length > 1)
			parts.push(
				markdown ? `\n---\n### File: ${path}\n` : `\n==== File: ${path} ====\n`,
			);
		parts.push(buildTranscriptText(messages, path, markdown));
	}
	return parts.join("\n");
}

// ───────────────────────────────────────────────────────────────────────────────
// Export (unchanged, kept for non-interactive mode)
// ───────────────────────────────────────────────────────────────────────────────

type ExportOptions = {
	cwd?: string;
	outputPath?: string;
	markdown: boolean;
	debug: boolean;
	help: boolean;
	filePaths: string[];
	stdin: boolean;
	stdout: boolean;
	concat: boolean;
	roles?: Set<string>;
};

function parseExportArgs(argv: string[]): ExportOptions {
	const opts: ExportOptions = {
		cwd: undefined,
		outputPath: undefined,
		markdown: false,
		debug: false,
		help: false,
		filePaths: [],
		stdin: false,
		stdout: false,
		concat: false,
		roles: undefined,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--cwd") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --cwd requires a path");
				process.exit(64);
			}
			opts.cwd = v;
		} else if (a === "-o" || a === "--output" || a === "--out") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --output requires a file path");
				process.exit(64);
			}
			opts.outputPath = v;
		} else if (a === "--md" || a === "--markdown") opts.markdown = true;
		else if (a === "-f" || a === "--file") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --file requires a .jsonl path");
				process.exit(64);
			}
			opts.filePaths.push(v);
		} else if (a === "--stdin") opts.stdin = true;
		else if (a === "--stdout") opts.stdout = true;
		else if (a === "--concat") opts.concat = true;
		else if (a === "--roles") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --roles requires a value");
				process.exit(64);
			}
			const parts = v
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean);
			opts.roles = new Set(parts);
		} else if (a === "--debug") opts.debug = true;
		else if (a === "-h" || a === "--help") opts.help = true;
	}
	return opts;
}

function runExport(argv: string[]) {
	const opts = parseExportArgs(argv);
	if (opts.help) {
		exportHelp();
		return;
	}

	// Collect input files (stdin + repeated --file)
	let inputFiles: string[] = [];
	if (opts.stdin) {
		try {
			const buf = readFileSync(0, "utf8");
			inputFiles.push(
				...buf
					.split(/\r?\n/)
					.map((s) => s.trim())
					.filter(Boolean),
			);
		} catch {}
	}
	if (opts.filePaths.length) inputFiles.push(...opts.filePaths);
	inputFiles = Array.from(new Set(inputFiles.map(normalizeAbs)));
	if (inputFiles.length === 0) {
		// Default to latest of mapped dir
		const starts = candidateStartPaths(opts.cwd);
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
		const latest = findLatestJsonl(mappedDir);
		if (!latest) {
			console.error(`No .jsonl files found in:\n  ${mappedDir}`);
			process.exit(2);
		}
		inputFiles = [latest.path];
	}
	// Validate
	inputFiles = inputFiles.filter((p) => {
		const ok = p.endsWith(".jsonl") && existsSync(p);
		if (!ok) console.error(`Skipping invalid/nonexistent file: ${p}`);
		return ok;
	});
	if (inputFiles.length === 0) {
		console.error("No valid input files");
		process.exit(2);
	}

	// Parse and filter by roles if requested
	const transcripts: { path: string; messages: TranscriptMessage[] }[] = [];
	for (const p of inputFiles) {
		let msgs = parseJsonlMessages(p);
		if (opts.roles?.size)
			msgs = msgs.filter((m) => !m.role || opts.roles?.has(m.role));
		transcripts.push({ path: p, messages: msgs });
	}

	const combine =
		opts.concat || opts.stdout || (!!opts.outputPath && transcripts.length > 1);
	if (combine) {
		const parts: string[] = [];
		for (const { path, messages } of transcripts) {
			if (transcripts.length > 1) {
				parts.push(
					opts.markdown
						? `\n---\n### File: ${path}\n`
						: `\n==== File: ${path} ====\n`,
				);
			}
			parts.push(buildTranscriptText(messages, path, opts.markdown));
		}
		const outText = parts.join("\n");
		if (opts.stdout) {
			process.stdout.write(outText);
			return;
		}
		let outPath = opts.outputPath;
		if (!outPath) {
			const date = isoDateOnly(new Date());
			outPath = join(
				process.cwd(),
				`conversation-${date}.${opts.markdown ? "md" : "txt"}`,
			);
		}
		ensureParentDir(outPath);
		writeFileSync(outPath, outText, "utf8");
		console.log(outPath);
		return;
	}

	// Per-file outputs
	if (opts.stdout) {
		for (const { path, messages } of transcripts) {
			if (transcripts.length > 1)
				process.stdout.write(
					opts.markdown
						? `\n---\n### File: ${path}\n\n`
						: `\n==== File: ${path} ====\n\n`,
				);
			process.stdout.write(buildTranscriptText(messages, path, opts.markdown));
			process.stdout.write("\n");
		}
		return;
	}
	for (const { path, messages } of transcripts) {
		let outputPath = opts.outputPath;
		const transcript = buildTranscriptText(messages, path, opts.markdown);
		if (!outputPath) {
			const title = deriveTitleFromMessages(messages);
			const date = isoDateOnly(new Date());
			const slug = title ? slugifyTitle(title) : "";
			const base = slug ? `${date}-${slug}` : `conversation-${date}`;
			const outputDir = join(process.cwd(), "ai", "conv");
			ensureParentDir(join(outputDir, "dummy"));
			outputPath = join(outputDir, `${base}.${opts.markdown ? "md" : "txt"}`);
		}
		ensureParentDir(outputPath);
		writeFileSync(outputPath, transcript, "utf8");
		console.log(outputPath);
	}
}

function exportHelp() {
	console.log(`conv export — export .jsonl to a readable transcript (non-interactive)
Usage:
  conv export [options]

Options:
      --cwd <dir>     Detect mapped project starting here
  -f,  --file <f>     Export this .jsonl (repeatable)
      --stdin         Read newline-separated .jsonl paths from stdin
  -o,  --output <f>   Write transcript to this path; when multiple and set, combines
      --stdout        Print transcript to stdout
      --concat        Combine multiple inputs into one transcript (default with --stdout)
      --roles <list>  Filter roles (e.g. user,assistant,system)
      --md            Write Markdown (default is plain text)
      --debug         Verbose mapping info
  -h,  --help         Show help
`);
}

// ───────────────────────────────────────────────────────────────────────────────
// Unified Picker App
// ───────────────────────────────────────────────────────────────────────────────

type RolesFilterPreset =
	| "user+assistant"
	| "any"
	| "user"
	| "assistant"
	| "system";
function presetToRoles(p: RolesFilterPreset): Set<string> | undefined {
	if (p === "any") return undefined;
	if (p === "user+assistant") return new Set(["user", "assistant"]);
	return new Set([p]);
}

type PickerMode = "search" | "latest";
type PickerOptions = {
	mappedDir: string;
	mode: PickerMode;
	initialQuery?: string;
	initialFiles?: string[]; // used by 'latest'
	initialRolesPreset?: RolesFilterPreset; // default 'user+assistant'
	showLimit?: number; // max items to render
};

function runPicker(opts: PickerOptions) {
	function App() {
		const { exit } = useApp();

		// Phase
		const [phase, setPhase] = React.useState<"browse" | "actions">(
			opts.mode === "latest" ? "actions" : "browse",
		);

		// Query, selection, roles
		const [q, setQ] = React.useState(opts.initialQuery ?? "");
		// Absolute index into the full results array (not the window)
		const [idx, setIdx] = React.useState(0);
		// Window start for results list
		const PAGE_SIZE = 4; // Fixed window size for scrolling
		const [startIdx, setStartIdx] = React.useState(0);

		const [selected, setSelected] = React.useState<Set<string>>(
			new Set(opts.initialFiles ?? []),
		);
		const [rolesPreset, setRolesPreset] = React.useState<RolesFilterPreset>(
			opts.initialRolesPreset ?? "user+assistant",
		);
		const roles = presetToRoles(rolesPreset);

		// Action sheet selection + window
		const [actionIdx, setActionIdx] = React.useState(0);
		const [actionStart, setActionStart] = React.useState(0);

		// Cache for search mode
		const [cache] = React.useState<CachedFile[]>(() => {
			if (opts.mode === "latest") return [];
			const files = getAllJsonlFiles(opts.mappedDir);
			return buildCache(files);
		});

		// Build results
		const results = React.useMemo(() => {
			if (opts.mode === "latest")
				return [] as {
					path: string;
					title: string | null;
					count: number;
					snippet: React.ReactNode;
				}[];
			const r = cache
				.map((cf) => {
					const count = q
						? countMatches(cf.lines, q, roles)
						: cf.lines.length
							? 1
							: 0;
					if (count === 0) return null;
					const snippet: React.ReactNode = q
						? firstMatchSnippet(cf.lines, q) || ""
						: cf.title || "";
					return { path: cf.path, title: cf.title, count, snippet };
				})
				.filter(Boolean) as {
				path: string;
				title: string | null;
				count: number;
				snippet: React.ReactNode;
			}[];
			r.sort((a, b) => b.count - a.count);
			return r;
		}, [q, cache, opts.mode, roles]);

		// Visible windows
		const total = results.length;
		const endIdx = Math.min(startIdx + PAGE_SIZE, total);
		const windowed = results.slice(startIdx, endIdx);

		// Helpers to keep selection visible in its window
		function clampAndEnsure(newIdx: number) {
			if (total === 0) {
				setIdx(0);
				setStartIdx(0);
				return;
			}
			const clamped = Math.max(0, Math.min(newIdx, total - 1));
			setIdx(clamped);
			setStartIdx((s) => {
				if (clamped < s) return clamped;
				if (clamped >= s + PAGE_SIZE) return clamped - PAGE_SIZE + 1;
				return s;
			});
		}
		function clampAndEnsureAction(newIdx: number) {
			const len = ACTIONS.length;
			const WIN = Math.min(len, 7);
			const clamped = Math.max(0, Math.min(newIdx, len - 1));
			setActionIdx(clamped);
			setActionStart((s) => {
				if (clamped < s) return clamped;
				if (clamped >= s + WIN) return clamped - WIN + 1;
				return s;
			});
		}

		// If results shrink due to filtering, keep idx sane and visible
		React.useEffect(() => {
			if (phase !== "browse" || opts.mode !== "search") return;
			if (total === 0) {
				setIdx(0);
				setStartIdx(0);
				return;
			}
			if (idx > total - 1) {
				const n = total - 1;
				setIdx(n);
				setStartIdx((s) =>
					n < s ? n : n >= s + PAGE_SIZE ? Math.max(0, n - PAGE_SIZE + 1) : s,
				);
			} else {
				// Ensure current idx is still inside window
				setStartIdx((s) => {
					if (idx < s) return idx;
					if (idx >= s + PAGE_SIZE) return idx - PAGE_SIZE + 1;
					return s;
				});
			}
		}, [total, idx, opts.mode, phase]); // eslint-disable-line react-hooks/exhaustive-deps

		useInput((input, key) => {
			if (key.escape) {
				exit();
				return;
			}

			// Roles toggle: Ctrl+R (and Meta+R if terminal forwards it). Shift reverses direction.
			// (Plain 'r' now just types into the query.)
			if (
				phase === "browse" &&
				(key.ctrl || key.meta) &&
				input?.toLowerCase() === "r"
			) {
				const order: RolesFilterPreset[] = [
					"user+assistant",
					"any",
					"user",
					"assistant",
					"system",
				];
				setRolesPreset((prev) => {
					const i = order.indexOf(prev);
					const dir = key.shift ? -1 : 1;
					const next = (i + dir + order.length) % order.length;
					const val = order.at(next) ?? "any";
					return val;
				});
				return;
			}

			if (phase === "actions") {
				if (key.upArrow) {
					clampAndEnsureAction(actionIdx - 1);
					return;
				}
				if (key.downArrow) {
					clampAndEnsureAction(actionIdx + 1);
					return;
				}
				if (key.return) {
					const filesRaw: Array<string | undefined> = selected.size
						? Array.from(selected)
						: opts.mode === "latest" && (opts.initialFiles?.length ?? 0) > 0
							? [opts.initialFiles?.[0]]
							: results[idx]
								? [results[idx]?.path]
								: [];
					const files = filesRaw.filter(
						(f): f is string => typeof f === "string",
					);
					if (!files.length) {
						setPhase("browse");
						return;
					}
					const chosen = ACTIONS[actionIdx]?.id ?? "cancel";
					const markdown = chosen.endsWith("-md");
					const text = combinedTranscriptText(files, roles, markdown);
					switch (chosen) {
						case "stdout-md":
						case "stdout-txt": {
							process.stdout.write(`${text}\n`);
							exit();
							return;
						}
						case "clipboard-md":
						case "clipboard-txt": {
							copyToClipboard(text);
							exit();
							return;
						}
						case "file-md":
						case "file-txt": {
							const args = [
								...(markdown ? (["--md"] as const) : []),
								"--concat",
								...files.flatMap((f) => ["--file", f]),
							];
							runExport(args as unknown as string[]);
							exit();
							return;
						}
						default:
							setPhase("browse");
							return;
					}
				}
				if (key.backspace || key.delete) {
					setPhase("browse");
					return;
				}
				// any printable key exits to browse & appends to query
				if (input && input.length === 1) {
					setPhase("browse");
					setQ((s) => s + input);
					return;
				}
				return;
			}

			// phase === 'browse'
			if (opts.mode === "search") {
				if (key.upArrow) {
					clampAndEnsure(idx - 1);
					return;
				}
				if (key.downArrow) {
					clampAndEnsure(idx + 1);
					return;
				}
				if (input === " ") {
					const file = results[idx]?.path;
					if (!file) return;
					setSelected((prev) => {
						const n = new Set(prev);
						if (n.has(file)) n.delete(file);
						else n.add(file);
						return n;
					});
					return;
				}
				if (key.return) {
					setPhase("actions");
					setActionIdx(0);
					setActionStart(0);
					return;
				}
				if (key.backspace || key.delete) {
					setQ((s) => s.slice(0, -1));
					return;
				}
				if (input && input.length === 1) setQ((s) => s + input);
			} else {
				// latest-mode: Enter goes to actions (already there by default)
				if (key.return) {
					setPhase("actions");
					setActionIdx(0);
					setActionStart(0);
					return;
				}
			}
		});

		const header = (
			<Text color="cyan">
				{phase === "actions"
					? "Action Sheet: ↑/↓ select, Enter run, Esc exit, Backspace to go back"
					: opts.mode === "search"
						? "Live search — ↑/↓ move (scrolls), Space select, Enter continue, Esc exit, Ctrl+R roles (Shift=reverse)"
						: "Latest file selected — press Enter for actions, Esc to exit"}
			</Text>
		);

		const rolesLine = (
			<Text>
				Roles filter: <Text color="green">{rolesPreset}</Text>{" "}
				<Text dimColor>(Ctrl+R to cycle, Shift reverses)</Text>
			</Text>
		);

		let body: React.ReactElement | null = null;

		if (phase === "actions") {
			const WIN = Math.min(ACTIONS.length, 7);
			const actionVisible = ACTIONS.slice(actionStart, actionStart + WIN);
			body = (
				<Box flexDirection="column" marginTop={1}>
					{opts.mode === "search" && (
						<Text dimColor>
							Selected:{" "}
							{selected.size
								? Array.from(selected)
										.map((p) => basename(p))
										.join(", ")
								: (() => {
										const p = results[idx]?.path;
										return p ? basename(p) : "none";
									})()}
						</Text>
					)}
					{opts.mode === "latest" && (opts.initialFiles?.length ?? 0) > 0
						? (() => {
								const first = opts.initialFiles?.[0];
								return (
									<Text dimColor>Selected: {first ? basename(first) : ""}</Text>
								);
							})()
						: null}
					<Box marginTop={1} flexDirection="column">
						{actionVisible.map((o, i) => {
							const abs = actionStart + i;
							const isSel = abs === actionIdx;
							return (
								<Text key={o.id} color={isSel ? "yellow" : undefined}>
									{isSel ? ">" : " "} {o.label}
								</Text>
							);
						})}
					</Box>
				</Box>
			);
		} else if (opts.mode === "search") {
			if (total === 0) {
				body = <Text dimColor>No matches</Text>;
			} else {
				body = (
					<Box flexDirection="column" marginTop={1}>
						{windowed.map((r, i) => {
							const abs = startIdx + i;
							const isSel = abs === idx;
							const marked = selected.has(r.path) ? "●" : "○";
							const titleDisplay =
								r.title && q ? (
									<>
										{" — "}
										{highlightMatch(r.title, q)}
									</>
								) : r.title ? (
									` — ${r.title}`
								) : (
									""
								);
							return (
								<Box key={r.path} flexDirection="column">
									<Text color={isSel ? "yellow" : undefined}>
										{isSel ? ">" : " "} {marked} {basename(r.path)} ({r.count}{" "}
										hits){titleDisplay}
									</Text>
									{r.snippet ? <Text dimColor>{r.snippet}</Text> : null}
									<Text dimColor> {r.path}</Text>
								</Box>
							);
						})}
					</Box>
				);
			}
		}

		return (
			<Box flexDirection="column">
				{header}
				{rolesLine}

				{/* results or actions */}
				{body}

				{/* Query at the bottom while browsing search */}
				{opts.mode === "search" && phase === "browse" && (
					<Box marginTop={1}>
						<Text>Query: </Text>
						<Text color="green">{q}</Text>
					</Box>
				)}
			</Box>
		);
	}

	render(React.createElement(App));
}

// ───────────────────────────────────────────────────────────────────────────────
// CLI: latest / search / export
// ───────────────────────────────────────────────────────────────────────────────

function showTopHelp() {
	console.log(`conv — conversation utilities for mapped Claude projects

Usage:
  conv <subcommand> [args]

Subcommands:
  latest   Open actions for the newest .jsonl (interactive)
  search   Live search UI with selection + actions (interactive)
  export   Non-interactive export to stdout/file (scriptable)

Examples:
  conv latest
  conv search "hello world"
  conv export --md --stdout --file path/to/file.jsonl
`);
}

// latest → resolve mapped dir + newest file → Action Sheet
type LatestOptions = {
	cwd?: string;
	debug: boolean;
	help: boolean;
	roles?: Set<string>;
};
function parseLatestArgs(argv: string[]): LatestOptions {
	const opts: LatestOptions = {
		cwd: undefined,
		debug: false,
		help: false,
		roles: undefined,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--cwd") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --cwd requires a path");
				process.exit(64);
			}
			opts.cwd = v;
		} else if (a === "--roles") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --roles requires a value");
				process.exit(64);
			}
			const parts = v
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean);
			opts.roles = new Set(parts);
		} else if (a === "--debug") opts.debug = true;
		else if (a === "-h" || a === "--help") opts.help = true;
		else {
			console.error(`Unknown option for latest: ${a}`);
			process.exit(64);
		}
	}
	return opts;
}

function latestHelp() {
	console.log(`conv latest — open actions for newest .jsonl (interactive)

Usage:
  conv latest [options]

Options:
      --cwd <d>   Start from this directory to detect mapped project
      --roles     Filter roles (e.g. user,assistant,system)
      --debug     Show mapping details
  -h, --help      Show help
`);
}

function runLatest(argv: string[]) {
	const opts = parseLatestArgs(argv);
	if (opts.help) {
		latestHelp();
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
			`No mapped directory found for:\n  ${starts[0]}\nunder:\n  ${projectsRoot()}\n(try: --debug to see attempted candidates)`,
		);
		process.exit(1);
	}
	const latest = findLatestJsonl(mappedDir);
	if (!latest) {
		console.error(`No .jsonl files found in:\n  ${mappedDir}`);
		process.exit(2);
	}

	runPicker({
		mappedDir,
		mode: "latest",
		initialFiles: [latest.path],
		initialRolesPreset: opts.roles ? "any" : "user+assistant",
	});
}

// search → always interactive picker (select-first), supports optional initial query
type SearchOptions = {
	roles: Set<string> | undefined;
	cwd?: string;
	debug: boolean;
	help: boolean;
	limit?: number;
	deprecatedFlags?: string[];
};
function parseSearchArgs(argv: string[]): {
	opts: SearchOptions;
	query: string;
} {
	const opts: SearchOptions = {
		roles: undefined,
		cwd: undefined,
		debug: false,
		help: false,
		limit: 200,
		deprecatedFlags: [],
	};
	const nonFlag: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a) continue;
		if (!a.startsWith("-")) {
			nonFlag.push(a);
			continue;
		}
		if (a === "-r" || a === "--role" || a === "--roles") {
			const v = argv[++i];
			if (!v) {
				console.error("Error: --roles requires a value");
				process.exit(64);
			}
			const parts = v
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean);
			opts.roles = parts.includes("any") ? undefined : new Set(parts);
		} else if (a === "--cwd") {
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
				console.error("Error: --limit must be positive");
				process.exit(64);
			}
			opts.limit = Math.floor(n);
		} else if (a === "--debug") opts.debug = true;
		else if (a === "-h" || a === "--help") opts.help = true;
		// Deprecated flags handled gracefully
		else if (["--live", "--select", "--paths-only", "--json"].includes(a)) {
			opts.deprecatedFlags?.push(a);
		} else {
			console.error(`Unknown option for search: ${a}`);
			process.exit(64);
		}
	}
	const query = nonFlag.join(" ");
	return { opts, query };
}

function searchHelp() {
	console.log(`conv search — live search UI (selection-first) then Action Sheet

Usage:
  conv search [query] [options]

Options:
  -r, --roles <roles>  Roles filter: user,assistant,system,any (default: user,assistant)
      --cwd <dir>      Start from this directory
      --limit <n>      Max items rendered in list (default 200)
      --debug          Verbose mapping info
  -h, --help           Show help

Deprecated (ignored): --live, --select, --paths-only, --json
`);
}

function runSearch(argv: string[]) {
	const { opts, query } = parseSearchArgs(argv);
	if (opts.help) {
		searchHelp();
		return;
	}
	if (opts.deprecatedFlags?.length) {
		console.error(
			`(notice) Deprecated flags ignored: ${opts.deprecatedFlags.join(", ")} — interactive mode is now default.`,
		);
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
	const files = readdirSync(mappedDir).filter((f) => f.endsWith(".jsonl"));
	if (!files.length) {
		console.error(`No .jsonl files in ${mappedDir}`);
		process.exit(2);
	}

	const rolesPreset: RolesFilterPreset = opts.roles ? "any" : "user+assistant";

	runPicker({
		mappedDir,
		mode: "search",
		initialQuery: query || "",
		initialRolesPreset: rolesPreset,
		showLimit: opts.limit ?? 200,
	});
}

// ───────────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────────
function main() {
	const argv = Bun.argv.slice(2);
	const sub = argv[0];
	if (!sub || sub === "-h" || sub === "--help") {
		showTopHelp();
		return;
	}
	if (sub === "latest") {
		runLatest(argv.slice(1));
		return;
	}
	if (sub === "search") {
		runSearch(argv.slice(1));
		return;
	}
	if (sub === "export") {
		runExport(argv.slice(1));
		return;
	}
	console.error(`Unknown subcommand: ${sub}`);
	showTopHelp();
	process.exit(64);
}

main();
