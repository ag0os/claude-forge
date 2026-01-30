---
id: TASK-031
title: Create forkhestra builder agent prompt
status: Done
priority: medium
labels:
  - forkhestra
  - prompt
dependencies:
  - TASK-029
createdAt: '2026-01-30T15:51:06.137Z'
updatedAt: '2026-01-30T16:11:23.330Z'
---

## Description

Create system-prompts/fk/builder.md with the builder agent system prompt. The builder implements exactly ONE task per iteration: finds ready tasks, picks highest priority, implements acceptance criteria, runs tests, commits, and marks done.

<!-- AC:BEGIN -->
- [x] #1 Builder prompt instructs to read ralph/AGENTS.md for conventions
- [x] #2 Builder prompt instructs to find ready tasks with forge-tasks list --ready
- [x] #3 Builder prompt enforces ONE task per iteration
- [x] #4 Builder prompt instructs to check off ACs as completed
- [x] #5 Builder prompt instructs to commit before signaling complete
- [x] #6 Builder prompt includes blocked task handling
- [x] #7 Builder prompt includes FORKHESTRA_COMPLETE contract
<!-- AC:END -->

## Implementation Notes

Added instruction to read ralph/AGENTS.md for coding conventions in Startup Protocol step 1

Added instruction to find ready tasks with forge-tasks list --ready --plain in Startup Protocol step 2

Added ONE task per iteration enforcement in Critical Rules section and throughout the workflow

Added instructions to check off ACs as completed using forge-tasks edit --check-ac N in Implementation Protocol step 3

Added instruction to commit before signaling complete in Implementation Protocol step 4 and Critical Rules

Added complete Blocked Task Handling section with marking blocked, common blockers, and signaling completion

Added complete Completion Contract section with FORKHESTRA_COMPLETE marker and three completion scenarios

Task completed: Created system-prompts/fk/builder.md with full builder agent prompt including startup protocol, implementation workflow, blocked task handling, and FORKHESTRA_COMPLETE contract
