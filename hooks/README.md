# Hooks Directory

Type-safe Claude Code hooks using Bun and the official SDK.

## Quick Start

Create a new hook:

```typescript
import type { UserPromptSubmitHookInput } from "@anthropic-ai/claude-code";

const input = (await Bun.stdin.json()) as UserPromptSubmitHookInput;

if (!input) {
	console.error("No input provided");
	process.exit(1);
}

// Your hook logic here

process.stdout.write(
	JSON.stringify(
		{
			decision: undefined,
			reason: "Hook processed successfully",
		},
		null,
		2,
	),
);
process.exit(0);
```

## Available Hook Types

Import from `@anthropic-ai/claude-code`:

- `PreToolUseHookInput` - Before tool execution
- `PostToolUseHookInput` - After tool execution
- `UserPromptSubmitHookInput` - When user submits prompt
- `StopHookInput` - When agent stops
- `SubagentStopHookInput` - When subagent stops
- `NotificationHookInput` - On notifications
- `PreCompactHookInput` - Before context compaction
- `SessionStartHookInput` - Session start/resume
- `SessionEndHookInput` - Session end

## Testing Hooks

Test independently with sample JSON:

```bash
echo '{"prompt": "test", "session_id": "123"}' | bun run UserPromptSubmit.ts
```

## Full Documentation

See [../docs/HOOKS.md](../docs/HOOKS.md) for comprehensive guide with examples, best practices, and troubleshooting.

## Current Hooks

None at the moment.
