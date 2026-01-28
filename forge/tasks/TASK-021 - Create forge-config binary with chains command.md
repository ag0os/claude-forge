---
id: TASK-021
title: Create forge-config binary with chains command
status: Done
priority: high
labels:
  - backend
dependencies: []
createdAt: '2026-01-28T15:27:39.860Z'
updatedAt: '2026-01-28T15:35:17.944Z'
---

## Description

Create a compiled binary that outputs shared configurations. The binary bundles chains.json at compile time, making it available system-wide since bin/ is in PATH. This enables forkhestra to access claude-forge configs from any project without copying files.

<!-- AC:BEGIN -->
- [x] #1 forge-config chains outputs valid JSON (chains.json content)
- [x] #2 forge-config (no args) shows usage message and exits with error code
- [x] #3 Unknown commands show error and exit with non-zero code
- [x] #4 Compiles to standalone binary in bin/
- [x] #5 Works from any directory (not dependent on cwd)
<!-- AC:END -->

## Implementation Notes

Created forge-config.ts with chains command. Binary compiles to bin/util:forge-config following the namespace convention.
