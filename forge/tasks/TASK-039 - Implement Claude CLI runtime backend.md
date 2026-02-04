---
id: TASK-039
title: Implement Claude CLI runtime backend
status: Done
priority: high
labels:
  - backend
  - runtime
dependencies:
  - TASK-037
createdAt: '2026-02-03T19:11:34.507Z'
updatedAt: '2026-02-03T19:33:07.506Z'
---

## Description

Create lib/runtime/claude-cli.ts implementing the AgentRuntime interface for Claude CLI. Wraps existing spawn logic while conforming to the new abstraction.

<!-- AC:BEGIN -->
- [x] #1 ClaudeCliRuntime class implements AgentRuntime interface
- [x] #2 run() method wraps existing spawnClaude/buildClaudeFlags logic
- [x] #3 runInteractive() spawns claude with inherited stdio
- [x] #4 capabilities() returns full capability set (MCP, tools, model, maxTurns all supported)
- [x] #5 Preserves current stdout streaming and marker detection behavior
- [x] #6 isAvailable() checks for claude binary in PATH
<!-- AC:END -->

## Implementation Notes

Completed: ClaudeCliRuntime class implementing AgentRuntime interface created at lib/runtime/claude-cli.ts. The implementation:
- run() wraps spawn logic with marker detection for print mode
- runInteractive() spawns claude with inherited stdio
- runStreaming() provides streaming output with callbacks
- capabilities() returns full support for MCP, tools, model, maxTurns, interactive, streaming, and systemPrompt
- isAvailable() checks for claude binary via which/where command or CLAUDE_PATH env var
- Preserves existing stdout streaming and marker detection from orchestra runner
- Auto-registers with runtime registry in lib/runtime/index.ts
