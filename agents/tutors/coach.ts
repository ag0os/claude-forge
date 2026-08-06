#!/usr/bin/env -S bun run

/**
 * COACH: one dynamic tutor, many subject packs.
 *
 * Composes a session prompt from three layers:
 *   1. student.md  — who is being coached (single source of truth)
 *   2. core.md     — how coaching works (modes, state, debrief, pressure)
 *   3. <pack>.md   — what this subject is (stance, axis, bank, seeds)
 *
 * The roster is generated from the packs that are actually installed, so
 * adding a subject never requires editing another file.
 *
 * Built-in packs ship in system-prompts/coach/packs/. Local packs are picked
 * up from .coach/packs/*.md in the working directory and override built-ins
 * with the same slug.
 *
 * Each subject keeps its own state in .coach/<slug>/, so several subjects can
 * share one project directory without clobbering each other.
 *
 * Usage:
 *   bun run agents/tutors/coach.ts                    # coordinator: what to train today
 *   bun run agents/tutors/coach.ts rails              # open the Rails coach
 *   bun run agents/tutors/coach.ts coding "ts drill"  # open with an initial message
 *   bun run agents/tutors/coach.ts --list             # print the roster and exit
 *   bun run agents/tutors/coach.ts rails --show-prompt # print composed prompt, don't spawn
 *   bun run agents/tutors/coach.ts rails --cwd ~/training  # train against a fixed root
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
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
import codingPack from "../../system-prompts/coach/packs/coding.md" with {
	type: "text",
};
import dataModelingPack from "../../system-prompts/coach/packs/data-modeling.md" with {
	type: "text",
};
import railsPack from "../../system-prompts/coach/packs/rails.md" with {
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
import studentDoc from "../../system-prompts/coach/student.md" with {
	type: "text",
};

/** Coaches that live in their own binary but belong on the roster. */
const SIBLINGS = [
	{
		command: "tutors:star",
		name: "STAR / behavioral",
		scope:
			"Behavioral interview prep — interrogate raw experience into STAR stories",
		session: "30–60 min · interrogate + draft + rehearse",
	},
	{
		command: "tutors:cca-coach",
		name: "CCA-F exam",
		scope:
			"Claude Certified Architect (Foundations) exam prep — scenario MCQs and answer strategy",
		session: "30–60 min · quiz / teach / drill / diagnose / review",
	},
] as const;

const BUILT_IN_PACKS: string[] = [
	codingPack,
	dataModelingPack,
	railsPack,
	systemDesignPack,
	testingPack,
	tsReactPack,
];

/**
 * Tools the coordinator needs to scaffold a training root. Scoped to `.coach/`
 * so setup doesn't prompt on every file, while everything outside stays gated.
 * Subject coaches inherit only what their pack asks for.
 */
const COORDINATOR_ALLOW = [
	"Read(.coach/**)",
	"Write(.coach/**)",
	"Edit(.coach/**)",
];

type Pack = {
	slug: string;
	name: string;
	scope: string;
	session: string;
	allow: string[];
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
		body: raw.slice(match[0].length).trim(),
		local,
	};
}

/** Built-ins first, then local packs — a local pack wins on slug collision. */
function loadPacks(root: string): Pack[] {
	const packs = new Map<string, Pack>();

	for (const raw of BUILT_IN_PACKS) {
		const pack = parsePack(raw, false);
		if (pack) packs.set(pack.slug, pack);
	}

	const localDir = join(root, ".coach", "packs");
	if (existsSync(localDir)) {
		for (const file of readdirSync(localDir)) {
			if (!file.endsWith(".md")) continue;
			try {
				const pack = parsePack(
					readFileSync(join(localDir, file), "utf8"),
					true,
				);
				if (pack) packs.set(pack.slug, pack);
			} catch (error) {
				console.warn(`Skipping unreadable pack ${file}: ${error}`);
			}
		}
	}

	return [...packs.values()].sort((a, b) => a.slug.localeCompare(b.slug));
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

function renderRoster(packs: Pack[]): string {
	const rows = packs.map(
		(pack) =>
			`| \`tutors:coach ${pack.slug}\` | ${pack.name}${pack.local ? " *(local)*" : ""} | ${pack.scope} | ${pack.session} |`,
	);
	const siblings = SIBLINGS.map(
		(sibling) =>
			`| \`${sibling.command}\` | ${sibling.name} | ${sibling.scope} | ${sibling.session} |`,
	);

	return [
		"# The roster",
		"",
		"These are the coaches the student can launch. You do **not** launch them —",
		"the student does. You recommend.",
		"",
		"| Launch with | Subject | Covers | Typical session |",
		"| ----------- | ------- | ------ | --------------- |",
		...rows,
		...siblings,
		"",
		"Subjects below the packs run as their own binaries — same student, different",
		"pedagogy, so they are not pack-shaped. Everything else is a pack in",
		"`system-prompts/coach/packs/`, or a local pack in `.coach/packs/`.",
		"",
		"Each subject owns `.coach/<slug>/` and maintains its own continuity there.",
	].join("\n");
}

function printRoster(packs: Pack[]): void {
	console.log("Subjects:\n");
	for (const pack of packs) {
		const tag = pack.local ? " (local)" : "";
		console.log(`  tutors:coach ${pack.slug.padEnd(16)}${pack.name}${tag}`);
		if (pack.scope) console.log(`  ${" ".repeat(29)}${pack.scope}`);
	}
	console.log("\nSeparate binaries:\n");
	for (const sibling of SIBLINGS) {
		console.log(`  ${sibling.command.padEnd(29)}${sibling.name}`);
	}
	console.log("\nRun `tutors:coach` with no subject to plan a session.");
}

async function main() {
	const root = resolveRoot();
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
				`# This training root\n\nYou are running in \`${root}\`. Scaffold into \`${join(root, ".coach")}\`. When you hand the student a launch command, append \`--cwd ${root}\` unless they will already be in that directory.`,
			].join("\n\n---\n\n");

	if (parsedArgs.values["show-prompt"] === true) {
		console.log(systemPrompt);
		process.exit(0);
	}

	const coachSettings = {
		permissions: {
			defaultMode: "default",
			allow: pack ? pack.allow : COORDINATOR_ALLOW,
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
