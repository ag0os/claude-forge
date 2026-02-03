---
id: TASK-044
title: Add backend capability checks and availability detection
status: Done
priority: medium
labels:
  - backend
  - runtime
dependencies:
  - TASK-039
  - TASK-043
createdAt: '2026-02-03T19:12:00.514Z'
updatedAt: '2026-02-03T19:12:00.514Z'
---

## Description

Implement isAvailable() and capability checks for all runtime backends to provide clear error messages when backends are missing or features unsupported.

<!-- AC:BEGIN -->
- [x] #1 isAvailable() checks for claude/codex binary in PATH
- [x] #2 Actionable error message when backend binary not found
- [x] #3 Capability mismatch warnings when unsupported options used
- [x] #4 No silent fallback to other backends
- [x] #5 Verbose debug logs for backend selection (when enabled)
<!-- AC:END -->

## Implementation Notes

Implemented in `lib/runtime/index.ts` with the following additions:

1. **isAvailable() checks** - Both `ClaudeCliRuntime` and `CodexCliRuntime` already implement `isAvailable()` that checks for the CLI binary in PATH or via environment variables (`CLAUDE_PATH`, `CODEX_PATH`)

2. **BackendNotAvailableError** - New error class that provides:
   - Clear error message identifying the missing backend
   - Installation instructions (via `INSTALL_INSTRUCTIONS` constant)
   - PATH and environment variable hints

3. **ensureBackendAvailable()** - New function that throws `BackendNotAvailableError` with actionable instructions when backend is not available

4. **checkCapabilities()** - New function that warns about unsupported options:
   - MCP config on backends without MCP support
   - Tool allow/deny lists on backends without tool support
   - Max turns on backends without max turns support
   - System prompt on backends with limited support
   - Interactive mode on backends without interactive support

5. **getCapabilityMismatches()** - Programmatic version that returns structured mismatch data

6. **Debug logging** - Using existing `debugLog()` from `lib/runtime/debug.ts`:
   - Enabled via `FORGE_DEBUG=1` or `DEBUG=forge`
   - Logs backend resolution with source
   - Logs availability checks
   - Logs capability checks

7. **Updated convenience wrappers** - `runAgentOnce()`, `runAgentStreaming()`, and `runAgentInteractive()` now:
   - Call `ensureBackendAvailable()` before execution
   - Call `checkCapabilities()` to warn about mismatches
   - Include debug logging

8. **Tests** - Added comprehensive tests in `lib/runtime/capability-checks.test.ts` (25 tests passing)
