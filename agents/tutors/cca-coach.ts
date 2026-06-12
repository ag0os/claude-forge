#!/usr/bin/env -S bun run

/**
 * CCA COACH: Claude Certified Architect – Foundations (CCA-F) exam prep
 *
 * Certification coach for the proctored, single-attempt CCA-F exam. Has the
 * full exam blueprint baked in: 6 scenarios, 5 weighted domains with task
 * statements, the recurring answer-selection heuristics, and the distractor
 * archetypes the exam reuses.
 *
 * Modes: quiz (exam-format scenario MCQs, commit-then-debrief), teach (domain
 * deep-dive), drill (rapid recall), diagnose (scored mock + weak-spot report),
 * review (critique the student's reasoning). Tracks domain coverage; can
 * persist progress to .coach/cca-progress.md.
 *
 * Has WebFetch + WebSearch enabled so it can verify fast-moving Claude Code /
 * Agent SDK / API mechanics against official Anthropic docs mid-session.
 *
 * Usage:
 *   bun run agents/tutors/cca-coach.ts                 # start session
 *   bun run agents/tutors/cca-coach.ts "quiz domain 1" # with initial message
 */

import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../lib";
import type { ClaudeFlags } from "../../lib/claude-flags.types";
import coachSystemPrompt from "../../system-prompts/cca-coach.md" with {
	type: "text",
};

const coachSettings = {
	permissions: {
		defaultMode: "default",
		// Live doc lookup: auto-approve web tools so the coach can verify
		// current mechanics against official Anthropic docs without prompting.
		allow: ["WebFetch", "WebSearch"],
	},
};

const coachMcp = {
	mcpServers: {},
};

async function main() {
	const positionals = getPositionals();
	const userPrompt = positionals.join(" ").trim();

	const flags = buildClaudeFlags(
		{
			"append-system-prompt": coachSystemPrompt,
			settings: JSON.stringify(coachSettings),
			"mcp-config": JSON.stringify(coachMcp),
		},
		parsedArgs.values as ClaudeFlags,
	);
	const args = userPrompt ? [...flags, userPrompt] : [...flags];

	const exitCode = await spawnClaudeAndWait({
		args,
		env: { CLAUDE_PROJECT_DIR: process.cwd() },
	});

	process.exit(exitCode);
}

await main();
