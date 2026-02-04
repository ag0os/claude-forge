---
id: TASK-046
title: Add error handling and debug logging
status: Done
priority: low
labels:
  - backend
  - runtime
dependencies:
  - TASK-040
  - TASK-042
createdAt: '2026-02-03T19:12:10.937Z'
updatedAt: '2026-02-03T20:31:20.645Z'
---

## Description

Standardize error messages and add verbose debug logging for backend selection, command building, and execution flow.

<!-- AC:BEGIN -->
- [x] #1 Verbose debug logs for backend resolution (controlled by DEBUG or FORGE_DEBUG)
- [x] #2 Debug logs show constructed command and arguments
- [x] #3 Standardized error format for missing backend binaries
- [x] #4 Clear error message when unsupported options used for backend
- [x] #5 Error messages include actionable remediation steps
<!-- AC:END -->

## Implementation Notes

Implemented error handling and debug logging for the runtime abstraction layer. Created lib/runtime/debug.ts with RuntimeError, BackendNotFoundError, and UnsupportedOptionError classes. Added verbose debug logging to resolveBackend(), getRuntime(), and all convenience wrappers. Updated claude-cli.ts and codex-cli.ts with command and availability debug logging. Debug logging is controlled by FORGE_DEBUG=1 or DEBUG=forge environment variables.
