---
id: TASK-038
title: Add runtime registry and resolver
status: Done
priority: high
labels:
  - backend
  - runtime
dependencies:
  - TASK-001
createdAt: '2026-02-03T19:11:26.634Z'
updatedAt: '2026-02-03T19:35:06.498Z'
---

## Description

Create lib/runtime/index.ts with the runtime registry that manages backend selection and provides unified entry points for agent execution.

<!-- AC:BEGIN -->
- [x] #1 getRuntime(backend) function returns appropriate runtime implementation
- [x] #2 resolveBackend() reads from --backend CLI flag or FORGE_BACKEND env var
- [x] #3 runAgentOnce() wrapper executes agent in print mode and returns result
- [x] #4 runAgentStreaming() wrapper supports stdout callbacks and marker detection
- [x] #5 runAgentInteractive() wrapper spawns agent with inherited stdio
- [x] #6 Default backend is claude-cli when not specified
<!-- AC:END -->

## Implementation Notes

Implemented DEFAULT_BACKEND constant set to 'claude-cli'

Implemented getRuntime(backend) with registry-based factory lookup

Implemented resolveBackend() with priority: override > --backend flag > FORGE_BACKEND env > default

Implemented runAgentOnce() wrapper that executes agent in print mode

Implemented runAgentStreaming() wrapper with stdout callbacks and marker detection via detectCompletionMarker()

Implemented runAgentInteractive() wrapper that delegates to runtime.runInteractive()

Task completed: Created lib/runtime/index.ts with registry, resolver, and wrapper functions. All tests pass.

Note: The implementation was committed as part of 6b1ab4e (TASK-039) due to pre-commit hook sequencing. The file lib/runtime/index.ts contains all TASK-038 functionality.
