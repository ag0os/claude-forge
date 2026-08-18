#!/usr/bin/env -S bun run

/**
 * COACH: one dynamic tutor, many subject packs.
 *
 * Composes a session prompt from three layers:
 *   1. student.md  — who is being coached
 *   2. core.md     — how coaching works (modes, state, debrief, pressure)
 *   3. <pack>.md   — what this subject is (stance, axis, bank, seeds)
 *
 * ## What lives where
 *
 * The binary carries *mechanism* plus *seeds*; a training root carries
 * *content*. The rule that decides which: **does using the tool change this
 * file?** If yes it must live in the root, because anything a session mutates
 * but the binary owns goes stale silently at the next compile boundary.
 *
 *   - Compiled, never mutated: this code, core.md, coordinator.md.
 *   - Compiled as a seed, then owned by the root: student.md, the packs.
 *
 * So `.coach/student.md` wins over the built-in scaffold, and once
 * `.coach/packs/` exists it *is* the roster — add a subject by writing a file,
 * retire one by deleting it. Built-ins seed a fresh root and nothing more;
 * they are not a floor the root has to subtract from. `--init` copies the
 * seeds in so a root can start from the full set and prune.
 *
 * Each subject keeps its own state in .coach/<slug>/, so several subjects can
 * share one training root without clobbering each other.
 *
 * Usage:
 *   bun run agents/tutors/coach.ts                    # coordinator: what to train today
 *   bun run agents/tutors/coach.ts rails              # open the Rails coach
 *   bun run agents/tutors/coach.ts coding "ts drill"  # open with an initial message
 *   bun run agents/tutors/coach.ts --list             # print the roster and exit
 *   bun run agents/tutors/coach.ts --init             # seed .coach/ with student + packs
 *   bun run agents/tutors/coach.ts rails --show-prompt # print composed prompt, don't spawn
 *   bun run agents/tutors/coach.ts rails --cwd ~/training  # train against a fixed root
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coordinatorDoc from "../../system-prompts/coach/coordinator.md" with {
	type: "text",
};
import coreDoc from "../../system-prompts/coach/core.md" with { type: "text" };
import ccaCoachPack from "../../system-prompts/coach/packs/cca-coach.md" with {
	type: "text",
};
import codingPack from "../../system-prompts/coach/packs/coding.md" with {
	type: "text",
};
import dataModelingPack from "../../system-prompts/coach/packs/data-modeling.md" with {
	type: "text",
};
import railsPack from "../../system-prompts/coach/packs/rails.md" with {
	type: "text",
};
import starPack from "../../system-prompts/coach/packs/star.md" with {
	type: "text",
};
import systemDesignPack from "../../system-prompts/coach/packs/system-design.md" with {
	type: "text",
};
import testingPack from "../../system-prompts/coach/packs/testing.md" with {
	type: "text",
};
import tsReactPack from "../../system-prompts/coach/packs/ts-react.md" with {
	type: "text",
};
import studentScaffold from "../../system-prompts/coach/student.md" with {
	type: "text",
};

/**
 * Seeds for a fresh training root — not a floor every root inherits.
 *
 * Subjects that run as their own binary (star, cca-coach) are packs like any
 * other; they just carry a `command:` field instead of being launched through
 * this one. That keeps the roster in a single place, so retiring one is a file
 * deletion rather than a source edit and a recompile.
 */
const BUILT_IN_PACKS: string[] = [
	codingPack,
	dataModelingPack,
	railsPack,
	systemDesignPack,
	testingPack,
	tsReactPack,
	starPack,
	ccaCoachPack,
];

/**
 * Every coach owns `.coach/`: its own state directory, and the student profile
 * it is told to keep current. Scoped so training files never prompt while
 * everything outside stays gated. Subject packs add to this; they never
 * replace it.
 */
const BASE_ALLOW = ["Read(.coach/**)", "Write(.coach/**)", "Edit(.coach/**)"];

type Pack = {
	slug: string;
	name: string;
	scope: string;
	session: string;
	allow: string[];
	/** Set when the subject runs as its own binary rather than through this one. */
	command?: string;
	body: string;
	local: boolean;
};

/**
 * Minimal frontmatter reader: flat `key: value` pairs between `---` fences.
 * Deliberately not YAML — packs only ever carry scalar metadata.
 */
function parsePack(raw: string, local: boolean): Pack | null {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
	const frontmatter = match?.[1];
	if (!match || frontmatter === undefined) return null;

	const meta = new Map<string, string>();
	for (const line of frontmatter.split(/\r?\n/)) {
		const sep = line.indexOf(":");
		if (sep === -1) continue;
		meta.set(line.slice(0, sep).trim(), line.slice(sep + 1).trim());
	}

	const slug = meta.get("slug");
	if (!slug) return null;

	return {
		slug,
		name: meta.get("name") ?? slug,
		scope: meta.get("scope") ?? "",
		session: meta.get("session") ?? "",
		allow: (meta.get("allow") ?? "")
			.split(",")
			.map((tool) => tool.trim())
			.filter(Boolean),
		command: meta.get("command") || undefined,
		body: raw.slice(match[0].length).trim(),
		local,
	};
}

/** The built-in seeds, paired with the raw text `--init` needs to write out. */
function builtInEntries(): { pack: Pack; raw: string }[] {
	return BUILT_IN_PACKS.map((raw) => ({
		raw,
		pack: parsePack(raw, false),
	})).filter((entry): entry is { pack: Pack; raw: string } =>
		Boolean(entry.pack),
	);
}

function bySlug(a: Pack, b: Pack): number {
	return a.slug.localeCompare(b.slug);
}

function packsDir(root: string): string {
	return join(root, ".coach", "packs");
}

/**
 * The roster, resolved.
 *
 * A root that has `.coach/packs/` owns its roster outright — that directory is
 * the whole list, so a subject is retired by deleting its file. Built-ins are
 * only the seed for a root that has none; treating them as a permanent floor
 * is what made retired subjects impossible to remove without a recompile.
 */
function loadPacks(root: string): Pack[] {
	const localDir = packsDir(root);
	if (!existsSync(localDir)) {
		return builtInEntries()
			.map((entry) => entry.pack)
			.sort(bySlug);
	}

	const packs = new Map<string, Pack>();
	for (const file of readdirSync(localDir)) {
		if (!file.endsWith(".md")) continue;
		try {
			const pack = parsePack(readFileSync(join(localDir, file), "utf8"), true);
			if (pack) packs.set(pack.slug, pack);
		} catch (error) {
			console.warn(`Skipping unreadable pack ${file}: ${error}`);
		}
	}

	// An empty or all-unreadable directory is a half-made root, not a deliberate
	// empty roster. Fall back rather than offering the student nothing.
	if (packs.size === 0) {
		return builtInEntries()
			.map((entry) => entry.pack)
			.sort(bySlug);
	}

	return [...packs.values()].sort(bySlug);
}

function studentPath(root: string): string {
	return join(root, ".coach", "student.md");
}

/**
 * The student profile is the one document a session is expected to rewrite, so
 * the root's copy always wins and the compiled one is only a scaffold. The
 * provenance line matters as much as the text: without a path, a coach told to
 * "update this file" has no file to update.
 */
function loadStudent(root: string): string {
	const path = studentPath(root);
	let doc = studentScaffold;
	let local = false;

	if (existsSync(path)) {
		try {
			doc = readFileSync(path, "utf8");
			local = true;
		} catch (error) {
			console.warn(`Falling back to the built-in student scaffold: ${error}`);
		}
	}

	const provenance = local
		? `_This profile is \`.coach/student.md\` in the training root. When the student corrects anything in it, edit that file — it is authoritative, and this text is only a copy of it._`
		: `_No \`.coach/student.md\` exists in this training root yet, so this is the built-in scaffold. Treat it as a starting guess, write it to \`.coach/student.md\` once it is right, and edit that file from then on._`;

	return `${doc.trim()}\n\n${provenance}`;
}

/** Seed a training root with the built-in student profile and pack set. */
function initRoot(root: string): void {
	const dir = packsDir(root);
	mkdirSync(dir, { recursive: true });

	const written: string[] = [];
	const skipped: string[] = [];
	for (const { pack, raw } of builtInEntries()) {
		const dest = join(dir, `${pack.slug}.md`);
		if (existsSync(dest)) {
			skipped.push(pack.slug);
			continue;
		}
		writeFileSync(dest, raw, "utf8");
		written.push(pack.slug);
	}

	const student = studentPath(root);
	const studentWritten = !existsSync(student);
	if (studentWritten) writeFileSync(student, studentScaffold, "utf8");

	console.log(`Seeded ${join(root, ".coach")}\n`);
	console.log(
		`  student.md   ${studentWritten ? "written" : "kept (already present)"}`,
	);
	if (written.length) console.log(`  packs written  ${written.join(", ")}`);
	if (skipped.length) console.log(`  packs kept     ${skipped.join(", ")}`);
	console.log(
		"\nThis directory is now the roster. Delete a pack file to retire the subject;\nadd one to create a subject. No recompile either way.",
	);
}

/**
 * `--cwd` picks the training root: where `.coach/` lives and where subjects
 * are launched. It must not reach the Claude CLI, so it is consumed here.
 */
function resolveRoot(): string {
	const requested = parsedArgs.values.cwd;
	if (typeof requested !== "string" || requested === "") return process.cwd();

	const root = resolve(requested);
	if (!existsSync(root)) {
		console.error(`--cwd does not exist: ${root}`);
		process.exit(1);
	}
	return root;
}

function launchCommand(pack: Pack): string {
	return pack.command ?? `tutors:coach ${pack.slug}`;
}

function renderRoster(packs: Pack[]): string {
	const rows = packs.map(
		(pack) =>
			`| \`${launchCommand(pack)}\` | ${pack.name}${pack.local ? " *(local)*" : ""} | ${pack.scope} | ${pack.session} |`,
	);
	const hasExternal = packs.some((pack) => pack.command);

	return [
		"# The roster",
		"",
		"These are the coaches the student can launch. You do **not** launch them —",
		"the student does. You recommend.",
		"",
		"| Launch with | Subject | Covers | Typical session |",
		"| ----------- | ------- | ------ | --------------- |",
		...rows,
		"",
		...(hasExternal
			? [
					"Rows whose command is not `tutors:coach <slug>` run as their own binary —",
					"same student, different pedagogy, so they are not pack-shaped.",
					"",
				]
			: []),
		"Each subject owns `.coach/<slug>/` and maintains its own continuity there.",
	].join("\n");
}

function printRoster(packs: Pack[]): void {
	const launchable = packs.filter((pack) => !pack.command);
	const external = packs.filter((pack) => pack.command);

	console.log("Subjects:\n");
	for (const pack of launchable) {
		const tag = pack.local ? " (local)" : "";
		console.log(`  tutors:coach ${pack.slug.padEnd(16)}${pack.name}${tag}`);
		if (pack.scope) console.log(`  ${" ".repeat(29)}${pack.scope}`);
	}

	if (external.length) {
		console.log("\nSeparate binaries:\n");
		for (const pack of external) {
			const tag = pack.local ? " (local)" : "";
			console.log(`  ${(pack.command ?? "").padEnd(29)}${pack.name}${tag}`);
		}
	}

	console.log("\nRun `tutors:coach` with no subject to plan a session.");
}

async function main() {
	const root = resolveRoot();

	if (parsedArgs.values.init === true) {
		initRoot(root);
		process.exit(0);
	}

	const packs = loadPacks(root);

	if (parsedArgs.values.list === true) {
		printRoster(packs);
		process.exit(0);
	}

	const positionals = getPositionals();
	const requested = positionals[0];
	const pack = requested
		? packs.find((candidate) => candidate.slug === requested)
		: undefined;

	// A slug-shaped first argument that matches nothing is a typo, not a
	// message. Anything else (`coach "plan my week"`) goes to the coordinator.
	if (requested && !pack && /^[a-z0-9][a-z0-9-]*$/.test(requested)) {
		console.error(`Unknown subject: ${requested}\n`);
		printRoster(packs);
		process.exit(1);
	}

	// On the roster, but not ours to run.
	if (pack?.command) {
		console.error(
			`\`${pack.slug}\` runs as its own binary. Launch it with:\n\n  ${pack.command}\n`,
		);
		process.exit(1);
	}

	const studentDoc = loadStudent(root);

	// With a subject: student + core + roster + pack. Without one: the
	// coordinator, which plans rather than teaches and so skips the core.
	const systemPrompt = pack
		? [
				studentDoc,
				coreDoc,
				renderRoster(packs),
				`# This session's subject\n\nSlug: \`${pack.slug}\` — your state directory is \`.coach/${pack.slug}/\`.\n\n${pack.body}`,
			].join("\n\n---\n\n")
		: [
				studentDoc,
				renderRoster(packs),
				coordinatorDoc,
				`# This training root\n\nYou are running in \`${root}\`. Scaffold into \`${join(root, ".coach")}\`. When you hand the student a launch command, append \`--cwd ${root}\` unless they will already be in that directory.\n\nThe roster is exactly \`.coach/packs/*.md\` once that directory exists: adding a subject means writing a pack file there, and retiring one means deleting it. Neither needs a recompile.`,
			].join("\n\n---\n\n");

	if (parsedArgs.values["show-prompt"] === true) {
		console.log(systemPrompt);
		process.exit(0);
	}

	const coachSettings = {
		permissions: {
			defaultMode: "default",
			// Every coach gets `.coach/` — its state directory and the student
			// profile it is told to keep current. Packs add to that, never replace it.
			allow: [...new Set([...BASE_ALLOW, ...(pack?.allow ?? [])])],
		},
	};

	const coachMcp = { mcpServers: {} };

	const userPrompt = (pack ? positionals.slice(1) : positionals)
		.join(" ")
		.trim();

	// `cwd` is ours, not the CLI's — drop it before the flags are forwarded.
	const { cwd: _consumed, ...forwarded } = parsedArgs.values;

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": systemPrompt,
			settings: JSON.stringify(coachSettings),
			"mcp-config": JSON.stringify(coachMcp),
		},
		forwarded as ClaudeFlags,
	);
	const args = userPrompt ? [...flags, userPrompt] : [...flags];

	const exitCode = await spawnClaudeAndWait({
		args,
		cwd: root,
		env: { CLAUDE_PROJECT_DIR: root },
	});

	process.exit(exitCode);
}

await main();
