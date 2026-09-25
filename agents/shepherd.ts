#!/usr/bin/env -S bun run

/**
 * SHEPHERD: personal day-to-day assistant and agent coordinator.
 *
 * Runs in any directory and keeps its own state there (.shepherd/): memories,
 * an append-only journal, and living docs that make it better at that
 * workspace over time.
 *
 * The session prompt is composed from layers:
 *   1. core.md                — identity, workspace protocol, init, self-evolution
 *   2. integrations/*.md      — built-in capability modules (Herdr, inter-agent
 *                               messaging), each self-gated by an availability check
 *   3. inherited modules      — the integrations/*.md of the nearest enclosing
 *                               workspace (a parent directory with its own
 *                               .shepherd/), shared by every workspace beneath it
 *   4. .shepherd/charter.md   — the workspace's agreed mission and way of working,
 *                               written during the init conversation
 *   5. .shepherd/integrations/*.md — workspace-local modules appended at launch,
 *                               so a directory can extend Shepherd without a recompile
 *
 * Harness agnostic: spawns through lib/runtime, so the backend is selected with
 * --backend claude-cli|codex-cli|codex-sdk or FORGE_BACKEND (default claude-cli).
 * Capability modules degrade gracefully on harnesses that lack a feature.
 *
 * Usage:
 *   bun run agents/shepherd.ts                          # interactive session here
 *   bun run agents/shepherd.ts "triage my morning"      # with an initial message
 *   bun run agents/shepherd.ts --cwd ~/work             # run against another root
 *   bun run agents/shepherd.ts --backend codex-cli      # different harness
 *   bun run agents/shepherd.ts --print "status report"  # one-shot, non-interactive
 *   bun run agents/shepherd.ts --show-prompt            # print composed prompt, don't spawn
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	getBackend,
	getPositionals,
	isPrintMode,
	parsedArgs,
	toFlags,
	validateBackendFlags,
} from "../lib";
import type { ClaudeFlags } from "../lib/claude-flags.types";
import { runAgentInteractive, runAgentStreaming } from "../lib/runtime";
import coreDoc from "../system-prompts/shepherd/core.md" with { type: "text" };
import herdrDoc from "../system-prompts/shepherd/integrations/herdr.md" with {
	type: "text",
};
import interAgentDoc from "../system-prompts/shepherd/integrations/inter-agent.md" with {
	type: "text",
};

const STATE_DIR = ".shepherd";
const BUILT_IN_INTEGRATIONS = [herdrDoc, interAgentDoc];

/**
 * Flags consumed by this launcher (or by lib/flags) that must not leak into
 * the spawned backend's argument list.
 */
const FORGE_LEVEL_FLAGS = ["backend", "cwd", "print", "show-prompt", "model"];

/**
 * State-dir file ops are pre-approved so memory and journal upkeep never
 * prompt. `herdr` is pre-approved because coordinating panes and agents is
 * Shepherd's core duty; destructive Herdr commands are forbidden by the
 * integration module instead. An enclosing workspace's state dir is added as
 * a readable directory, since its modules point at files there; Claude Code
 * checks permissions against resolved paths, so this can't ride on the
 * relative rules above.
 */
function shepherdSettings(enclosing: string | undefined) {
	const allow = [
		`Read(${STATE_DIR}/**)`,
		`Write(${STATE_DIR}/**)`,
		`Edit(${STATE_DIR}/**)`,
		"Bash(herdr:*)",
	];
	const shared = enclosing ? join(enclosing, STATE_DIR) : undefined;
	if (shared) allow.push(`Read(/${shared}/**)`);
	return {
		permissions: {
			defaultMode: "default",
			allow,
			...(shared ? { additionalDirectories: [shared] } : {}),
		},
	};
}

const shepherdMcp = {
	mcpServers: {},
};

type Module = { name: string; body: string; path: string };

/**
 * Capability modules in a workspace's integrations dir: workspace-local ones
 * for the launch directory, inherited ones for an enclosing workspace.
 */
function loadIntegrations(root: string): Module[] {
	const dir = join(root, STATE_DIR, "integrations");
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((file) => file.endsWith(".md"))
		.sort()
		.map((file) => ({
			name: file,
			body: readFileSync(join(dir, file), "utf8"),
			path: realpathSync(join(dir, file)),
		}));
}

/**
 * The nearest parent directory that is itself a Shepherd workspace. Its
 * modules apply to every workspace beneath it, which is how a group of
 * workspaces shares one layer of conventions without copying it.
 */
function findEnclosingWorkspace(cwd: string): string | undefined {
	for (let dir = dirname(cwd); dir !== dirname(dir); dir = dirname(dir)) {
		if (existsSync(join(dir, STATE_DIR))) return dir;
	}
	return undefined;
}

/**
 * The workspace charter is the agreed mission and way of working, written
 * during the init conversation. Absence means the workspace is uninitiated
 * and core.md tells Shepherd to run init before substantial work.
 */
function loadCharter(cwd: string): string | undefined {
	const path = join(cwd, STATE_DIR, "charter.md");
	return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function composeSystemPrompt(
	cwd: string,
	backend: string,
	enclosing: string | undefined,
): string {
	const charter = loadCharter(cwd);
	const inherited = enclosing ? loadIntegrations(enclosing) : [];
	// A local module that is the same file as an inherited one (a leftover
	// symlink, say) would load twice.
	const inheritedPaths = new Set(inherited.map((m) => m.path));
	const locals = loadIntegrations(cwd).filter(
		(m) => !inheritedPaths.has(m.path),
	);
	const header = [
		"# Shepherd session context",
		"",
		`- Launch directory: ${cwd}`,
		`- State directory: ${join(cwd, STATE_DIR)}`,
		`- Date: ${new Date().toISOString().slice(0, 10)}`,
		`- Backend: ${backend}`,
		enclosing
			? `- Enclosing workspace: ${enclosing} (inherited integrations: ${inherited.map((m) => m.name).join(", ") || "none"})`
			: "- Enclosing workspace: none",
		charter
			? "- Charter: loaded"
			: "- Charter: none, this workspace is uninitiated",
		locals.length
			? `- Workspace-local integrations loaded: ${locals.map((l) => l.name).join(", ")}`
			: "- Workspace-local integrations loaded: none",
	].join("\n");

	return [
		coreDoc,
		...BUILT_IN_INTEGRATIONS,
		...inherited.map((m) => m.body),
		...(charter ? [charter] : []),
		...locals.map((l) => l.body),
		header,
	].join("\n\n---\n\n");
}

/**
 * Remaining CLI flags are passed through to the backend untouched (Claude CLI
 * only), preserving the framework's flag passthrough convention for things
 * like --resume or --permission-mode.
 */
function passthroughArgs(): string[] {
	const values = { ...parsedArgs.values } as Record<
		string,
		string | boolean | undefined
	>;
	for (const flag of FORGE_LEVEL_FLAGS) {
		delete values[flag];
	}
	return toFlags(values as ClaudeFlags);
}

async function main() {
	const backend = getBackend();
	validateBackendFlags(backend);

	const cwd = parsedArgs.values.cwd
		? resolve(String(parsedArgs.values.cwd))
		: process.cwd();
	const prompt = getPositionals().join(" ").trim() || undefined;
	const enclosing = findEnclosingWorkspace(cwd);
	const systemPrompt = composeSystemPrompt(cwd, backend, enclosing);

	if (parsedArgs.values["show-prompt"] === true) {
		console.log(systemPrompt);
		return;
	}

	const options = {
		backend,
		prompt,
		systemPrompt,
		cwd,
		env: { CLAUDE_PROJECT_DIR: cwd },
		model: parsedArgs.values.model as string | undefined,
		...(backend === "claude-cli"
			? {
					settings: JSON.stringify(shepherdSettings(enclosing)),
					mcpConfig: JSON.stringify(shepherdMcp),
					rawArgs: passthroughArgs(),
				}
			: {}),
	};

	if (isPrintMode()) {
		if (!prompt) {
			console.error('Print mode requires a prompt: shepherd --print "..."');
			process.exit(1);
		}
		const result = await runAgentStreaming(options, {
			onStdout: (data) => process.stdout.write(data),
			onStderr: (data) => process.stderr.write(data),
		});
		process.exit(result.exitCode);
	}

	const result = await runAgentInteractive(options);
	process.exit(result.exitCode);
}

await main();
