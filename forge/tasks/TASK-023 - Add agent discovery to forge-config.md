---
id: TASK-023
title: Add agent discovery to forge-config
status: Done
priority: medium
labels:
  - backend
dependencies:
  - TASK-021
createdAt: '2026-01-28T15:27:52.688Z'
updatedAt: '2026-01-28T16:20:04.067Z'
---

## Description

Implement the agents command in forge-config that lists all compiled agent binaries available in the bin/ directory. This enables tooling to discover available agents programmatically.

<!-- AC:BEGIN -->
- [x] #1 forge-config agents lists all binaries in bin directory
- [x] #2 Output is one agent per line
- [x] #3 Agent list is sorted alphabetically
- [x] #4 Works regardless of current directory
<!-- AC:END -->

## Implementation Notes

Implemented agents command: reads bin directory from forge root (resolved via getForgeRoot()), filters hidden files, sorts alphabetically, outputs one per line

Task completed: Implemented agents command that lists compiled binaries from bin/ directory. Commit: 62d86d6
