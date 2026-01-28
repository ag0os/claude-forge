import type { StopHookInput } from "@anthropic-ai/claude-agent-sdk";
// import { tmpdir } from "node:os";
// import { join } from "node:path";

const input = (await Bun.stdin.json()) as StopHookInput;

if (!input) {
	console.error("No input provided");
	process.exit(1);
}

// Write payload to temp directory for debugging
// const payloadPath = join(tmpdir(), `payload-${new Date().toISOString()}.json`);
// await Bun.write(payloadPath, JSON.stringify(input, null, 2));

// Read the transcript_path file
// const transcript = await Bun.file(input.transcript_path).text();

// Allow stopping without container-use merge requirement
process.stdout.write(
	JSON.stringify(
		{ decision: undefined, reason: "Stop hook processed successfully" },
		null,
		2,
	),
);
process.exit(0);
