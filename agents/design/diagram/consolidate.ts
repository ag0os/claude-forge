#!/usr/bin/env bun

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	buildClaudeFlags,
	getPositionals,
	parsedArgs,
	spawnClaudeAndWait,
} from "../../../lib";
import { assetsFor } from "../../../lib/assets";
import type { ClaudeFlags } from "../../../lib/claude-flags.types";

const targetProject = process.cwd();
const diagramsRoot = join(targetProject, "ai", "diagrams");
const consolidatedDir = diagramsRoot;

// Optional scope filters provided as free-form positionals
const filters = getPositionals().join(" ");

// Ensure consolidated directory exists
try {
	mkdirSync(consolidatedDir, { recursive: true });
	console.log(`✅ Created/verified directory: ${consolidatedDir}`);
} catch (error) {
	console.error(`Failed to create consolidated directory: ${error}`);
}

const userPrompt = `Consolidate and optimize all diagram markdown files found under: ${diagramsRoot}

Goals:
1) Verify: Check that each diagram plausibly reflects the referenced code paths and components (based on file/function references and patterns). Flag any questionable items in a short note inline.
2) Deduplicate: Identify near-duplicates or overlapping flows and merge them.
3) Grouping: Cluster by topic/theme and produce one consolidated markdown per topic under: ${consolidatedDir}
4) Cleanup: Normalize naming, remove redundancy, and streamline diagrams while preserving completeness and correctness.

Scope filters: ${filters || "(none)"}

Instructions:
- Read all diagram files under ${diagramsRoot} (no subdirectories required).
- Derive topics from filename prefixes before the first dash (e.g., "auth-login-flow.md" => topic "auth"). If no clear prefix, infer topic heuristically.
- For each topic, produce a single consolidated file in ${consolidatedDir}: {topic}-consolidated.md
- Within each consolidated file, include:
  - A refined, comprehensive Mermaid diagram (or multiple sections if needed)
  - A brief overview of included subflows
  - Key components and their roles
  - Noted assumptions or verification concerns
- Create an index file at ${consolidatedDir}/diagrams-index.md listing topics, file counts, and short summaries.

Verification heuristics:
- Ensure nodes and edges match named files/functions/types mentioned in the flow descriptions
- Confirm external calls and state mutations are plausible given the stack
- If a diagram lacks clear anchors to the codebase, mark it for review

Output only the final consolidated markdown files in ${consolidatedDir} plus the index.`;

async function main() {
	console.log("🧹 Starting diagram consolidation...");
	console.log(`📁 Diagrams root: ${diagramsRoot}`);
	console.log(`📦 Consolidated output: ${consolidatedDir}`);

	// Load assets by convention based on filename
	const { systemPrompt, settings } = assetsFor(import.meta.url);
	const defaults: ClaudeFlags = {
		...(systemPrompt ? { "append-system-prompt": systemPrompt } : {}),
		...(settings ? { settings: JSON.stringify(settings) } : {}),
	};

	const flags = buildClaudeFlags(defaults, parsedArgs.values as ClaudeFlags);
	const finalArgs = [...flags, userPrompt];

	const exitCode = await spawnClaudeAndWait({
		args: finalArgs,
		env: { CLAUDE_PROJECT_DIR: targetProject },
	});

	console.log(`\n✨ Consolidation complete!`);
	console.log(`📁 Consolidated diagrams saved to: ${consolidatedDir}`);
	process.exit(exitCode);
}

main().catch(console.error);
