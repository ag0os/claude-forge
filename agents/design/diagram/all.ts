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

// Get the current working directory (the project to analyze)
const targetProject = process.cwd();
const diagramsDir = join(targetProject, "ai", "diagrams");

// Ensure the ai/diagrams directory exists
try {
	mkdirSync(diagramsDir, { recursive: true });
	console.log(`✅ Created/verified directory: ${diagramsDir}`);
} catch (error) {
	console.error(`Failed to create diagrams directory: ${error}`);
}

// Optional free-form focus filter from args
const positionals = getPositionals();
const focusArea = positionals.join(" ");

// Build the user prompt
const userPrompt = `Analyze the codebase at ${targetProject} and generate comprehensive, project-wide event flow diagrams.

Target output directory: ${diagramsDir}

Instructions:
1. Scan the ENTIRE codebase to identify ALL event flows, data flows, and interaction patterns
2. Look for:
   - User interaction flows (click handlers, form submissions, etc.)
   - API request/response flows
   - WebSocket/real-time event flows
   - State management flows (Redux, Zustand, Context, etc.)
   - File system operations and I/O flows
   - Background job/worker flows
   - Authentication/authorization flows
   - Data transformation pipelines
   - Message queue/pub-sub patterns
   - Database query flows
   - Component communication patterns
   - Navigation/routing flows
   - Error handling cascades
   - Lifecycle event flows
   - Custom event emitters

3. For each identified flow, create a markdown file in ${diagramsDir} with:
   - Descriptive filename: {flow-type}-{specific-name}.md (e.g., auth-login-flow.md, api-user-crud-flow.md)
   - Mermaid diagram showing the complete flow
   - Brief description of the flow
   - Key files and functions involved
   - Trigger points and conditions

4. Diagrams should include:
   - All actors/components involved
   - Direction of data flow
   - Decision points and branches
   - Error paths
   - Async operations
   - External service calls
   - State mutations

5. Be EXHAUSTIVE - every possible event flow should have its own diagram

${focusArea ? `\nFocus Area (optional filter): ${focusArea}` : "\nAnalyze ALL flows comprehensively"}

Start by scanning the project structure to understand the architecture, then systematically identify and document every event flow.`;

async function main() {
	console.log("🔍 Starting project-wide diagram generation...");
	console.log(`📁 Target project: ${targetProject}`);
	console.log(`📊 Diagrams will be saved to: ${diagramsDir}`);

	// Load assets by convention based on filename
	const { systemPrompt, settings } = assetsFor(import.meta.url);
	const defaults: ClaudeFlags = {
		...(systemPrompt ? { "append-system-prompt": systemPrompt } : {}),
		...(settings ? { settings: JSON.stringify(settings) } : {}),
	};

	// Build Claude flags
	const flags = buildClaudeFlags(defaults, parsedArgs.values as ClaudeFlags);

	// Add the prompt as positional argument
	const finalArgs = [...flags, userPrompt];

	// Spawn Claude with diagram generation settings
	const exitCode = await spawnClaudeAndWait({
		args: finalArgs,
		env: { CLAUDE_PROJECT_DIR: targetProject },
	});

	console.log(`\n✨ Event flow diagram generation complete!`);
	console.log(`📁 Diagrams saved to: ${diagramsDir}`);
	process.exit(exitCode);
}

main().catch(console.error);
