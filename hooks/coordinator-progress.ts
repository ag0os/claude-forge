/**
 * PostToolUse hook for coordinator progress logging
 *
 * Logs to stderr when:
 * - Task tool is used (delegations to sub-agents)
 * - Bash tool runs forge-tasks commands
 */
import type { PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const input = (await Bun.stdin.json()) as PostToolUseHookInput;

if (!input) {
	console.error("[Coordinator] Hook error: No input provided");
	process.exit(1);
}

const { tool_name, tool_input } = input;

// Log Task tool usage (delegations)
if (tool_name === "Task") {
	const { subagent_type, description } = tool_input as {
		subagent_type?: string;
		description?: string;
	};
	if (subagent_type && description) {
		console.error(`[Coordinator] Delegating to ${subagent_type}: ${description}`);
	}
}

// Log forge-tasks Bash commands
if (tool_name === "Bash") {
	const { command } = tool_input as { command?: string };
	if (command?.includes("forge-tasks")) {
		// Extract the subcommand for cleaner logging
		const match = command.match(/forge-tasks\s+(\w+)/);
		const subcommand = match?.[1] || "command";
		console.error(`[Coordinator] Running forge-tasks ${subcommand}...`);
	}
}

// Allow the tool to proceed
process.stdout.write(JSON.stringify({ decision: undefined }));
process.exit(0);
