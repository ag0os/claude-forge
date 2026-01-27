#!/usr/bin/env -S bun run
import * as path from "node:path";
import { parseArgs } from "node:util";
import {
	createPartFromUri,
	createUserContent,
	GoogleGenAI,
} from "@google/genai";
import { $ } from "bun";
import { claude } from "../../lib";

const args = parseArgs({
	allowPositionals: true,
	options: {
		skipClaude: {
			type: "boolean" as const,
			short: "s",
			default: false,
		},
	},
});

const videoPath = args.positionals[0];

if (!videoPath) {
	console.error("Usage: bun run agents/claude-video.ts <path to video file>");
	process.exit(1);
}

// Verify the video file exists and is an mp4
if (!videoPath.endsWith(".mp4")) {
	console.error("Error: Please provide a .mp4 video file");
	process.exit(1);
}

// Check if video file exists using Bun.file
const videoFile = Bun.file(videoPath);
if (!(await videoFile.exists())) {
	console.error(`Error: Cannot access video file at ${videoPath}`);
	process.exit(1);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
	console.error("Error: GEMINI_API_KEY environment variable is not set");
	console.error(
		"Please set your Gemini API key: export GEMINI_API_KEY=your_api_key",
	);
	process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Upload video to Gemini
console.log("Uploading video to Gemini...");
let file = await ai.files.upload({
	file: videoPath,
	config: { mimeType: "video/mp4" },
});

// Wait for file to be processed
let attempts = 0;
const maxAttempts = 60; // 2 minutes max wait

while (file.state !== "ACTIVE" && attempts < maxAttempts) {
	await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

	if (!file.name) {
		throw new Error("File name is undefined");
	}
	file = await ai.files.get({ name: file.name });

	attempts++;
	console.log(
		`Checking file status (${attempts}/${maxAttempts}): ${file.state}`,
	);

	// Check for failure states
	if (file.state === "FAILED") {
		throw new Error(
			`File processing failed: ${file.error?.message || "Unknown error"}`,
		);
	}
}

if (file.state !== "ACTIVE") {
	throw new Error(
		`File did not become active after ${maxAttempts * 2} seconds`,
	);
}

console.log("Video uploaded successfully!");

// Create prompt for Gemini to generate AI agent instructions
const geminiPrompt = `Analyze this instructional video and create a comprehensive text-based breakdown that serves as a complete standalone reference. Since no one else will have access to the video after this analysis, capture EVERYTHING needed to understand and replicate what's shown.

<CRITICAL>
You are creating the ONLY record of this video's content. Be exhaustive in your documentation.
</CRITICAL>

Your analysis must include:

## 1. COMPLETE TRANSCRIPT
- Full verbatim transcript of all spoken words, including timestamps
- Note any significant pauses, emphasis, or tone changes
- Include any on-screen text that appears

## 2. VISUAL DOCUMENTATION
- Frame-by-frame description of what's happening visually
- Describe every UI element, button, menu, or interface shown
- Document cursor movements, clicks, and interactions
- Note any visual indicators, highlights, or annotations
- Describe any diagrams, code snippets, or text shown on screen

## 3. CONTEXTUAL INFORMATION
- Software/tools being used (including versions if visible)
- Environment details (OS, browser, IDE, etc.)
- File paths, URLs, or navigation sequences shown
- Any error messages or system responses

## 4. STEP-BY-STEP INSTRUCTIONS
- Break down the demonstrated process into numbered steps
- Include exact commands, code, or text input shown
- Note keyboard shortcuts or specific interactions used
- Highlight any decision points or alternatives mentioned

## 5. ADDITIONAL DETAILS
- Prerequisites or setup requirements mentioned
- Warnings, tips, or best practices shared
- Common pitfalls or troubleshooting advice given
- Expected outcomes or results shown

Format your response as a structured document that someone could follow without ever seeing the video. Be verbose and detailed rather than concise. Include everything that might be relevant for someone trying to replicate what was demonstrated.`;

console.log("Generating AI agent instructions from video...");

// Check file properties before using them
if (!file.uri || !file.mimeType) {
	throw new Error("File URI or mimeType is undefined");
}

const response = await ai.models.generateContent({
	model: "gemini-2.5-flash",
	contents: createUserContent([
		createPartFromUri(file.uri, file.mimeType),
		geminiPrompt,
	]),
});

const agentInstructions = response.text;
if (!agentInstructions) {
	throw new Error("Failed to generate agent instructions from video");
}
console.log("\nGenerated AI Agent Instructions:");
console.log("================================");
console.log(agentInstructions);
console.log("================================\n");

// Save the instructions to a file for reference
const videoPathParsed = path.parse(videoPath);
// Create ai/claude-video directory if it doesn't exist
const outputDir = path.join(process.cwd(), "ai", "claude-video");
await Bun.write(path.join(outputDir, ".gitkeep"), ""); // This will create the directory
const instructionsPath = path.join(
	outputDir,
	`${videoPathParsed.name}-instructions.md`,
);
// Use Bun.write for file writing
await Bun.write(instructionsPath, agentInstructions);
console.log(`Instructions saved to: ${instructionsPath}\n`);

// Execute the instructions with Claude Code
console.log("Executing instructions with Claude Code...");
// if --skip-claude flag, ignore
if (!args.values.skipClaude) {
	await claude(agentInstructions);
} else {
	console.log(agentInstructions);
	// Copy them to clipboard
	try {
		await $`echo ${agentInstructions} | pbcopy`;
	} catch {
		// ignore clipboard failures in non-macOS environments
	}
}
