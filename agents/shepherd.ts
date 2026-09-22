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
 *   3. .shepherd/charter.md   — the workspace's agreed mission and way of working,
 *                               written during the init conversation
 *   4. .shepherd/integrations/*.md — workspace-local modules appended at launch,
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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
 * integration module instead.
 */
const shepherdSettings = {
	permissions: {
		defaultMode: "default",
		allow: [
			`Read(${STATE_DIR}/**)`,
			`Write(${STATE_DIR}/**)`,
			`Edit(${STATE_DIR}/**)`,
			"Bash(herdr:*)",
		],
	},
};

const shepherdMcp = {
	mcpServers: {},
};

/**
 * Workspace-local capability modules, appended after the built-ins so a
 * directory can extend or override Shepherd's behavior without a recompile.
 */
function loadLocalIntegrations(cwd: string): { name: string; body: string }[] {
	const dir = join(cwd, STATE_DIR, "integrations");
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((file) => file.endsWith(".md"))
		.sort()
		.map((file) => ({
			name: file,
			body: readFileSync(join(dir, file), "utf8"),
		}));
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

function composeSystemPrompt(cwd: string, backend: string): string {
	const charter = loadCharter(cwd);
	const locals = loadLocalIntegrations(cwd);
	const header = [
		"# Shepherd session context",
		"",
		`- Launch directory: ${cwd}`,
		`- State directory: ${join(cwd, STATE_DIR)}`,
		`- Date: ${new Date().toISOString().slice(0, 10)}`,
		`- Backend: ${backend}`,
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
	const systemPrompt = composeSystemPrompt(cwd, backend);

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
					settings: JSON.stringify(shepherdSettings),
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
