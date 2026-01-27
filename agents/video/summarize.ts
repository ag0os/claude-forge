#!/usr/bin/env -S bun run
import * as path from "node:path";
import { parseArgs } from "node:util";
import {
	createPartFromUri,
	createUserContent,
	GoogleGenAI,
} from "@google/genai";

const args = parseArgs({
	allowPositionals: true,
});

let videoPath = args.positionals[0];

if (!videoPath) {
	console.error("Usage: bun run agents/gemsum.ts <path to video file>");
	process.exit(1);
}

// Handle shell escaping by unescaping common escaped characters
function unescapePath(path: string): string {
	return path
		.replace(/\\ /g, " ") // escaped space
		.replace(/\\\[/g, "[") // escaped left bracket
		.replace(/\\\]/g, "]") // escaped right bracket
		.replace(/\\\(/g, "(") // escaped left paren
		.replace(/\\\)/g, ")") // escaped right paren
		.replace(/\\&/g, "&") // escaped ampersand
		.replace(/\\'/g, "'") // escaped single quote
		.replace(/\\"/g, '"') // escaped double quote
		.replace(/\\:/g, ":") // escaped colon
		.replace(/\\;/g, ";") // escaped semicolon
		.replace(/\\=/g, "=") // escaped equals
		.replace(/\\>/g, ">") // escaped greater than
		.replace(/\\</g, "<") // escaped less than
		.replace(/\\\|/g, "|") // escaped pipe
		.replace(/\\`/g, "`") // escaped backtick
		.replace(/\\\$/g, "$") // escaped dollar sign
		.replace(/\\\*/g, "*") // escaped asterisk
		.replace(/\\\?/g, "?"); // escaped question mark
}

// Unescape the video path to handle shell escaping
videoPath = unescapePath(videoPath);

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

// Create prompt for Gemini to summarize the video
const geminiPrompt = `Analyze this video and provide a comprehensive summary with key points extracted. Focus on creating a concise yet thorough overview that captures the essential information.

Your summary should include:

## Summary
A brief overview of what the video covers and its main purpose.

## Key Points
- Extract and list the most important concepts, insights, or information presented
- Include any major steps, processes, or methodologies demonstrated
- Note significant details, tips, or best practices mentioned
- Highlight any tools, technologies, or resources discussed

## Main Takeaways
- What are the core lessons or insights someone should remember?
- What actionable information can viewers apply?
- Any important warnings, caveats, or considerations mentioned?

## Additional Notes
- Any prerequisites or background knowledge required
- Relevant links, resources, or references mentioned
- Context about when this information might be useful

Format your response in clear, readable markdown. Be comprehensive but concise - focus on information that would be valuable for someone who needs to understand the video's content quickly.`;

console.log("Generating video summary...");

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

const videoSummary = response.text;
if (!videoSummary) {
	throw new Error("Failed to generate video summary");
}

console.log("\nGenerated Video Summary:");
console.log("========================");
console.log(videoSummary);
console.log("========================\n");

// Create ai/gemsum directory if it doesn't exist
const summariesDir = path.join(process.cwd(), "ai", "gemsum");
await Bun.write(path.join(summariesDir, ".gitkeep"), ""); // This will create the directory

// Extract video filename without extension to use as video-id
const videoPathParsed = path.parse(videoPath);
const videoId = videoPathParsed.name;
const summaryPath = path.join(summariesDir, `${videoId}.md`);

// Save the summary to the summaries directory
await Bun.write(summaryPath, videoSummary);
console.log(`Summary saved to: ${summaryPath}`);
