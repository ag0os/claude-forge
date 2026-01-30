---
id: TASK-024
title: Add path resolution to forge-config
status: Done
priority: medium
labels:
  - backend
dependencies:
  - TASK-021
createdAt: '2026-01-28T15:27:58.020Z'
updatedAt: '2026-01-28T16:18:30.627Z'
---

## Description

Implement the path and version commands in forge-config. The path command outputs the absolute path to the claude-forge root directory (resolved from binary location). The version command outputs version info for debugging.

<!-- AC:BEGIN -->
- [x] #1 forge-config path outputs absolute path to claude-forge root
- [x] #2 forge-config version outputs version information
- [x] #3 Path resolution works from any directory
- [x] #4 Output path is valid and exists
<!-- AC:END -->

## Implementation Notes

Blocked: Unable to write to files due to permission issues. The Edit tool requires permissions that have not been granted.

Implemented path and version commands. Path resolution uses process.execPath for compiled binaries and import.meta.dir for bun runtime. Verified working from multiple directories.

Task completed. Implemented path command (resolves claude-forge root from binary/source location) and version command (outputs forge-config 0.1.0). All acceptance criteria verified.
