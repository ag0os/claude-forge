---
id: TASK-045
title: Add unit tests for runtime abstraction
status: Done
priority: medium
labels:
  - testing
  - runtime
dependencies:
  - TASK-038
  - TASK-044
createdAt: '2026-02-03T19:12:08.778Z'
updatedAt: '2026-02-03T20:36:06.518Z'
---

## Description

Create tests for the runtime registry, capability checks, and backend selection logic. Use mocked backends for isolated testing.

<!-- AC:BEGIN -->
- [x] #1 Unit tests for getRuntime() with valid and invalid backends
- [x] #2 Unit tests for resolveBackend() with flag, env var, and default
- [x] #3 Unit tests for capability checks and isAvailable()
- [x] #4 Integration tests gated by CLAUDE_CLI_AVAILABLE env
- [x] #5 Integration tests gated by CODEX_CLI_AVAILABLE env
- [x] #6 Tests pass with bun test
<!-- AC:END -->

## Implementation Notes

Task completed: Created registry.test.ts with 35 tests for getRuntime, resolveBackend, hasRuntime, getRegisteredBackends, isValidBackend, and parseBackendFromArgs. Created integration.test.ts with 22 tests gated by CLAUDE_CLI_AVAILABLE and CODEX_CLI_AVAILABLE env vars. All 70 tests pass (60 run, 10 skipped for missing CLIs).
