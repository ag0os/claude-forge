---
id: TASK-043
title: Implement Codex CLI runtime backend
status: Done
priority: medium
labels:
  - backend
  - runtime
  - codex
dependencies:
  - TASK-037
createdAt: '2026-02-03T19:11:56.922Z'
updatedAt: '2026-02-03T21:15:00.000Z'
---

## Description

Create lib/runtime/codex-cli.ts implementing the AgentRuntime interface for Codex CLI. Maps print mode to codex exec and interactive mode to codex with inherited stdio.

<!-- AC:BEGIN -->
- [x] #1 CodexCliRuntime class implements AgentRuntime interface
- [x] #2 run() maps mode:print to 'codex exec' with prompt argument
- [x] #3 runInteractive() spawns 'codex' with inherited stdio
- [x] #4 System prompt prepended to user prompt (no native system prompt support)
- [x] #5 stdout collected for completion marker detection in print mode
- [x] #6 MCP config documented as unsupported (requires preconfigured MCP)
<!-- AC:END -->

## Notes

Implementation completed in `lib/runtime/codex-cli.ts` with:
- `isAvailable()` checks for `codex` binary in PATH (or CODEX_PATH env var)
- `capabilities()` returns limited set (no MCP, no maxTurns, no tools config)
- `run()` delegates to `runStreaming()` for print mode or `runInteractive()` for interactive mode
- `runStreaming()` uses `codex exec "<prompt>"` with stdout/stderr piping and completion marker detection
- `runInteractive()` spawns `codex` with inherited stdio
- System prompt handling prepends to user prompt with separator
- Warnings logged for unsupported options (mcpConfig, tools, maxTurns, settings, skipPermissions)
- Registered in `lib/runtime/index.ts`
