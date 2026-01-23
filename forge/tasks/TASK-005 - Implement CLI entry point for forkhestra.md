---
id: TASK-005
title: Implement CLI entry point for forkhestra
status: Done
priority: high
labels:
  - backend
dependencies:
  - TASK-002
  - TASK-003
  - TASK-004
createdAt: '2026-01-22T17:52:03.870Z'
updatedAt: '2026-01-22T18:08:31.796Z'
---

## Description

Create agents/forkhestra.ts - the main CLI interface using parseArgs. Supports DSL mode, config mode, and various options. This ties together all the library components.

<!-- AC:BEGIN -->
- [x] #1 Parses 'forkhestra agent:N' for single agent loop mode
- [x] #2 Parses 'forkhestra "a:5 -> b:10"' for DSL chain mode
- [x] #3 Parses 'forkhestra --chain name' to load from config file
- [x] #4 Parses 'forkhestra --chain name VAR=value' and substitutes variables
- [x] #5 --dry-run flag shows steps without executing
- [x] #6 --verbose flag shows full untruncated agent output
- [x] #7 --cwd flag sets working directory passed to all agents
- [x] #8 Prints formatted summary showing iterations and completion status
- [x] #9 Exits with code 0 on complete, 1 on incomplete, 2 on error
<!-- AC:END -->

## Implementation Notes

CLI implemented at agents/forkhestra.ts
