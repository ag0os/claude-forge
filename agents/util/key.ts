#!/usr/bin/env -S bun run
const key = process.env.GEMINI_API_KEY;
if (!key) {
	console.error("GEMINI_API_KEY is not set");
	console.error("Set it with: export GEMINI_API_KEY=your_api_key");
	process.exit(1);
}
console.log(key);
