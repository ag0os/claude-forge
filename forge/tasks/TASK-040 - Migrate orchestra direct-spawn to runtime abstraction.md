---
id: TASK-040
title: Migrate orchestra direct-spawn to runtime abstraction
status: Done
priority: high
labels:
  - backend
  - runtime
  - orchestra
dependencies:
  - TASK-038
  - TASK-039
createdAt: '2026-02-03T19:11:38.710Z'
updatedAt: '2026-02-03T19:38:27.028Z'
---

## Description

Refactor lib/orchestra/runner.ts to use the runtime abstraction instead of direct claude CLI spawning. Preserves all existing loop and marker detection behavior.

<!-- AC:BEGIN -->
- [x] #1 Direct claude spawning in runner.ts replaced with runtime.run() calls
- [x] #2 AgentConfig gains optional backend field (defaults to claude-cli)
- [x] #3 Existing loop iteration and marker detection behavior unchanged
- [x] #4 Orchestra direct-spawn works exactly as before with Claude CLI
- [x] #5 All existing orchestra tests pass
<!-- AC:END -->

## Implementation Notes

Task completed: Migrated orchestra direct-spawn to use runtime abstraction. Changes: (1) runner.ts now imports getRuntime() and uses runtime.run()/runtime.runStreaming() instead of direct spawn calls, (2) Added buildRuntimeOptions() helper that converts AgentConfig to runtime RunOptions, (3) Removed runDirectOnce/runDirectOnceWithMarkerDetection helper functions (now handled by runtime), (4) config.ts gains optional 'backend' field in AgentConfig interface with validation for valid backends, (5) All 232 existing orchestra tests pass.
