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

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)+/g, "")
		.slice(0, 80);
}

// Get args: first positional is required topic, rest optional focus/filter details
const positionals = getPositionals();
const [topic, ...rest] = positionals;
const extraFocus = rest.join(" ");

if (!topic) {
	console.error("Missing required topic.");
	console.error(
		"Usage: bun run agents/diagram-topic.ts <topic> [extra focus words]",
	);
	process.exit(1);
}

const topicSlug = slugify(topic);
const targetProject = process.cwd();
const diagramsDir = join(targetProject, "ai", "diagrams");

// Ensure output directory exists
try {
	mkdirSync(diagramsDir, { recursive: true });
	console.log(`✅ Created/verified directory: ${diagramsDir}`);
} catch (error) {
	console.error(`Failed to create diagrams directory: ${error}`);
}

// Build the user prompt
const userPrompt = `Analyze the codebase at ${targetProject} and generate event flow diagrams ONLY for the specified topic.

Topic: ${topic}
${extraFocus ? `Extra focus: ${extraFocus}` : ""}

Target output directory: ${diagramsDir}

Instructions:
1. Identify flows, data paths, and interactions that are DIRECTLY related to the topic above.
2. Ignore unrelated flows. If the topic is ambiguous, choose the most relevant interpretation based on code patterns and file names.
3. Create one markdown file per distinct topic-relevant flow in ${diagramsDir}:
   - Filename prefix with the topic (e.g., ${topicSlug}-auth-login-flow.md)
   - Include a Mermaid diagram, overview, trigger points, key components, data flow, error scenarios.
4. Validate relevance: each output must clearly explain why it belongs to this topic (files, functions, or naming patterns matching the topic).
5. Provide thorough coverage of the topic but do NOT include unrelated areas.

Begin by locating files/functions whose names, routes, types, or documentation match the topic and follow all call/data paths from those anchors.`;

async function main() {
	console.log("🎯 Starting topic-focused diagram generation...");
	console.log(`🏷️ Topic: ${topic} (slug: ${topicSlug})`);
	console.log(`📁 Target project: ${targetProject}`);
	console.log(`📊 Diagrams will be saved to: ${diagramsDir}`);

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

	console.log(`\n✨ Topic-focused diagram generation complete!`);
	console.log(`📁 Diagrams saved to: ${diagramsDir}`);
	process.exit(exitCode);
}

main().catch(console.error);
