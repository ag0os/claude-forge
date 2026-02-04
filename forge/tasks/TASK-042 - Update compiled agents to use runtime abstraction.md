---
id: TASK-042
title: Update compiled agents to use runtime abstraction
status: Done
priority: high
labels:
  - backend
  - runtime
dependencies:
  - TASK-038
  - TASK-041
createdAt: '2026-02-03T19:11:50.127Z'
updatedAt: '2026-02-03T20:25:42.111Z'
---

## Description

Replace direct spawnClaudeAndWait calls in compiled agents with runtime entry points (runAgentOnce or runAgentInteractive) to enable backend switching.

<!-- AC:BEGIN -->
- [x] #1 Compiled agents use runAgentOnce() for --print mode
- [x] #2 Compiled agents use runAgentInteractive() for inherited stdio mode
- [x] #3 Agents work unchanged with no flags (default Claude CLI)
- [x] #4 --backend claude-cli behaves identically to default
- [x] #5 At least one agent fully migrated and tested as reference implementation
<!-- AC:END -->

## Implementation Notes

Task completed: Migrated agents/tasks/worker.ts as reference implementation. Key changes:

1. Added isPrintMode() helper to lib/flags.ts to detect --print flag
2. Added --print option parsing in lib/flags.ts parseArgs
3. Exported runtime functions from lib/index.ts
4. Fixed bug in lib/runtime/claude-cli.ts: Added '--' separator before prompt to prevent variadic flags like --mcp-config from consuming the prompt
5. Fixed bug in lib/runtime/claude-cli.ts: Changed stdin to 'ignore' for print mode to prevent hanging
6. Fixed bug in lib/runtime/claude-cli.ts: Read stdout and stderr concurrently to avoid deadlocks

The worker.ts now uses:
- runAgentOnce() for --print mode (non-interactive, captured output)
- runAgentInteractive() for interactive mode (inherited stdio)
- getBackend() and validateBackendFlags() for backend resolution

Tested scenarios:
- bun run agents/tasks/worker.ts 'prompt' (interactive mode works)
- bun run agents/tasks/worker.ts --print 'prompt' (print mode works)
- bun run agents/tasks/worker.ts --backend claude-cli --print 'prompt' (explicit backend works)
