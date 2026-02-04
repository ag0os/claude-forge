---
id: TASK-041
title: Add --backend flag parsing to lib/flags.ts
status: Done
priority: high
labels:
  - backend
  - runtime
dependencies:
  - TASK-037
createdAt: '2026-02-03T19:11:47.711Z'
updatedAt: '2026-02-03T19:32:29.159Z'
---

## Description

Update the shared flag parsing in lib/flags.ts to support --backend selection with FORGE_BACKEND environment variable fallback.

<!-- AC:BEGIN -->
- [x] #1 --backend <backend> flag parsed and available to all compiled agents
- [x] #2 FORGE_BACKEND env var used as fallback when --backend not provided
- [x] #3 Warns when Claude-specific flags (--mcp-config, --allowedTools) used with non-Claude backends
- [x] #4 Unknown backend values produce clear error message
- [x] #5 Default remains claude-cli when neither flag nor env var set
<!-- AC:END -->

## Implementation Notes

Task completed: Added getBackend() and validateBackendFlags() functions to lib/flags.ts. Implementation includes CLI flag parsing via parseArgs, FORGE_BACKEND env var fallback, validation against valid backends (claude-cli, codex-cli, codex-sdk), clear error messages for unknown backends, and warnings for Claude-specific flags when using non-Claude backends.
