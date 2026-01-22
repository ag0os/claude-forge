# Claude Code Hooks Documentation

Comprehensive guide for creating and using hooks in this framework.

## Overview

Hooks are callback functions that execute at specific lifecycle events during Claude's agent loop. They receive typed input from Claude Code and can send output back to control behavior.

## Available Hook Events

### 1. **PreToolUse**
Fires before tool calls are executed.

**When to use:** Validate, log, or block tool calls before execution.

**Input Type:** `PreToolUseHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  tool_name: string;
  tool_input: object;
}
```

**Output:**
```typescript
{
  decision?: "block" | null;
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: "PreToolUse";
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
  }
}
```

**Example use cases:**
- Log all bash commands before execution
- Validate file paths before writes
- Block dangerous operations

---

### 2. **PostToolUse**
Fires after tool calls complete.

**When to use:** Perform actions after tools execute (formatting, validation, notifications).

**Input Type:** `PostToolUseHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  tool_name: string;
  tool_input: object;
  tool_response: object;
}
```

**Output:**
```typescript
{
  decision?: "block" | null;
  reason?: string;
}
```

**Example use cases:**
- Auto-format code after file edits
- Run linters after writes
- Send notifications on completion

---

### 3. **UserPromptSubmit**
Fires when user submits a prompt, before Claude processes it.

**When to use:** Validate, enhance, or block user prompts.

**Input Type:** `UserPromptSubmitHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  prompt: string;
}
```

**Output:**
```typescript
{
  decision?: "block" | null;
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: "UserPromptSubmit";
    additionalContext?: string;
  }
}
```

**Example use cases:**
- Add context reminders to prompts
- Validate prompt format
- Inject project-specific instructions

---

### 4. **Stop**
Fires when the main agent finishes responding (not on user interrupt).

**When to use:** Cleanup, validation, or require additional work before stopping.

**Input Type:** `StopHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  stop_hook_active: boolean;
}
```

**Output:**
```typescript
{
  decision?: "block" | null;
  reason?: string;
}
```

**Example use cases:**
- Remind to merge container changes
- Verify tests pass before stopping
- Generate summary reports

---

### 5. **SubagentStop**
Fires when subagent tasks complete.

**When to use:** Handle subagent completion, validate results.

**Input Type:** `SubagentStopHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  stop_hook_active: boolean;
}
```

**Output:**
```typescript
{
  decision?: "block" | null;
  reason?: string;
}
```

**Example use cases:**
- Aggregate subagent results
- Validate subagent output
- Trigger follow-up tasks

---

### 6. **Notification**
Fires when Claude Code sends notifications.

**When to use:** Handle notification events, send to external systems.

**Input Type:** `NotificationHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  notification_type: string;
  message: string;
}
```

**Example use cases:**
- Send desktop notifications
- Log to monitoring systems
- Trigger external alerts

---

### 7. **PreCompact**
Fires before Claude Code runs a compact operation.

**When to use:** Save state before context is compacted.

**Input Type:** `PreCompactHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}
```

**Example use cases:**
- Save important context
- Export conversation state
- Backup transcripts

---

### 8. **SessionStart**
Fires when starting a new session or resuming an existing one.

**When to use:** Initialize session state, load context.

**Input Type:** `SessionStartHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  source: "startup" | "resume" | "clear";
}
```

**Example use cases:**
- Load project context
- Set environment variables
- Display welcome messages

---

### 9. **SessionEnd**
Fires when a Claude Code session ends.

**When to use:** Cleanup, save state, generate reports.

**Input Type:** `SessionEndHookInput`
```typescript
{
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}
```

**Example use cases:**
- Save session state
- Generate activity reports
- Cleanup temporary files

---

## Creating Hooks in This Framework

### Step 1: Set up hooks directory (already done)

The `hooks/` directory is set up as a Bun project with the Claude Code SDK:

```bash
cd hooks
bun install  # Already has @anthropic-ai/claude-code
```

### Step 2: Create a typed hook script

Create `hooks/YourHookName.ts`:

```typescript
import type { UserPromptSubmitHookInput } from "@anthropic-ai/claude-code";

const input = (await Bun.stdin.json()) as UserPromptSubmitHookInput;

if (!input) {
	console.error("No input provided");
	process.exit(1);
}

// Your hook logic here
const { prompt, cwd, session_id } = input;

// Example: Add context to every prompt
const additionalContext = `Project root: ${cwd}`;

// Return response
process.stdout.write(
	JSON.stringify(
		{
			decision: undefined,
			reason: "Hook processed successfully",
			hookSpecificOutput: {
				hookEventName: "UserPromptSubmit",
				additionalContext,
			},
		},
		null,
		2,
	),
);
process.exit(0);
```

### Step 3: Configure hook in settings

In your agent's settings file (e.g., `settings/my-agent.settings.json`):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run $CLAUDE_PROJECT_DIR/hooks/YourHookName.ts"
          }
        ]
      }
    ]
  }
}
```

### Step 4: Pass settings to agent

In your agent file (e.g., `agents/my-agent.ts`):

```typescript
import myAgentSettings from "../settings/my-agent.settings.json" with { type: "json" };

const flags = buildClaudeFlags({
	settings: JSON.stringify(myAgentSettings),
	// ... other flags
});
```

### Step 5: Compile and test

```bash
bun compile agents/my-agent.ts
./bin/my-agent
```

---

## Hook Matchers

Matchers control when hooks fire. Common patterns:

- `"*"` - Match all events
- `"Bash"` - Match tool (allows all commands)
- `"Bash(npm:*)"` - Match tool with command pattern
- `"Edit(*.ts)"` - Match tool with file pattern

---

## Best Practices

1. **Always import types from SDK:**
   ```typescript
   import type { UserPromptSubmitHookInput } from "@anthropic-ai/claude-code";
   ```

2. **Handle input validation:**
   ```typescript
   if (!input) {
     console.error("No input provided");
     process.exit(1);
   }
   ```

3. **Return proper JSON response:**
   ```typescript
   process.stdout.write(JSON.stringify({ ... }, null, 2));
   process.exit(0);
   ```

4. **Use Bun features:**
   ```typescript
   // Parse stdin easily
   const input = await Bun.stdin.json();

   // Write files
   await Bun.write("/tmp/log.json", JSON.stringify(data));

   // Read files
   const content = await Bun.file(input.transcript_path).text();
   ```

5. **Test hooks independently:**
   ```bash
   echo '{"prompt": "test", "session_id": "123"}' | bun run hooks/UserPromptSubmit.ts
   ```

6. **Comment out actions during development:**
   ```typescript
   // await Bun.write(payloadPath, JSON.stringify(input, null, 2));
   ```

---

## Security Considerations

- Hooks run with your current environment credentials
- Always validate input before executing commands
- Be careful with file system operations
- Review third-party hook scripts before use
- Use blocklists for dangerous operations

---

## Common Patterns

### Simple reminder hook
```typescript
import type { UserPromptSubmitHookInput } from "@anthropic-ai/claude-code";

const input = (await Bun.stdin.json()) as UserPromptSubmitHookInput;

// Simple echo for reminders
process.stdout.write(
	JSON.stringify(
		{
			hookSpecificOutput: {
				hookEventName: "UserPromptSubmit",
				additionalContext: "Remember: Use TDD approach!",
			},
		},
		null,
		2,
	),
);
process.exit(0);
```

### Blocking hook
```typescript
import type { StopHookInput } from "@anthropic-ai/claude-code";

const input = (await Bun.stdin.json()) as StopHookInput;

// Check if tests pass before stopping
const testsPass = await checkTests();

if (!testsPass) {
	process.stdout.write(
		JSON.stringify(
			{
				decision: "block",
				reason: "Tests are failing. Please fix them before stopping.",
			},
			null,
			2,
		),
	);
	process.exit(0);
}

// Allow stopping
process.stdout.write(JSON.stringify({ decision: undefined }, null, 2));
process.exit(0);
```

### Logging hook
```typescript
import type { PostToolUseHookInput } from "@anthropic-ai/claude-code";
import { join } from "node:path";

const input = (await Bun.stdin.json()) as PostToolUseHookInput;

// Log all tool uses
const logFile = join(input.cwd, ".claude/tool-usage.log");
const logEntry = `${new Date().toISOString()} - ${input.tool_name}\n`;

await Bun.write(logFile, logEntry, { append: true });

process.stdout.write(JSON.stringify({ decision: undefined }, null, 2));
process.exit(0);
```

---

## Troubleshooting

### Hook not firing
1. Check settings JSON syntax
2. Verify hook command path
3. Test hook independently with sample JSON
4. Check for syntax errors in hook script

### "Stop hook error" messages
1. Ensure hook returns valid JSON
2. Check hook exits with code 0
3. Validate TypeScript compiles
4. Add error handling

### Type errors
1. Make sure `@anthropic-ai/claude-code` is installed in `hooks/`
2. Check import statement uses correct type name
3. Run `bun install` in hooks directory

---

## Reference

- Official docs: https://docs.claude.com/en/docs/claude-code/hooks-guide
- SDK package: `@anthropic-ai/claude-code`
- This framework's hooks: `/hooks/`
- Settings files: `/settings/*.settings.json`

---

## Available Hook Types in SDK

Import any of these from `@anthropic-ai/claude-code`:

- `PreToolUseHookInput`
- `PostToolUseHookInput`
- `UserPromptSubmitHookInput`
- `StopHookInput`
- `SubagentStopHookInput`
- `NotificationHookInput`
- `PreCompactHookInput`
- `SessionStartHookInput`
- `SessionEndHookInput`
