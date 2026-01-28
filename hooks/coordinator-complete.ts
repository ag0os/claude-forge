/**
 * Stop hook for coordinator completion
 *
 * Outputs FORKHESTRA_COMPLETE marker when the coordinator finishes.
 * This ensures the marker is always output, regardless of whether
 * the model remembers to output it.
 */
import type { StopHookInput } from "@anthropic-ai/claude-agent-sdk";

const input = (await Bun.stdin.json()) as StopHookInput;

if (!input) {
	console.error("[Coordinator] Hook error: No input provided");
	process.exit(1);
}

// Output completion message to stderr (visible in terminal)
console.error("[Coordinator] Session complete");

// Note: FORKHESTRA_COMPLETE must be output by the model to stdout,
// as hooks' stdout is consumed by Claude for the JSON response protocol.
// The model is already instructed to output this marker.

// Allow stopping
process.stdout.write(JSON.stringify({ decision: undefined }));
process.exit(0);
