---
id: TASK-032
title: 'Add fk:* agents and ralph chain to config'
status: Done
priority: medium
labels:
  - forkhestra
  - config
dependencies:
  - TASK-030
  - TASK-031
createdAt: '2026-01-30T15:51:15.637Z'
updatedAt: '2026-01-30T16:13:55.510Z'
---

## Description

Add fk:planner and fk:builder agent configurations to forge/chains.json with systemPrompt, model, maxTurns, and allowedTools. Add ralph, build, and plan chains using these agents.

<!-- AC:BEGIN -->
- [x] #1 fk:planner agent config references system-prompts/fk/planner.md
- [x] #2 fk:planner agent config limits tools to Read, Grep, Glob, Bash
- [x] #3 fk:builder agent config references system-prompts/fk/builder.md
- [x] #4 ralph chain runs fk:planner (3 iterations) then fk:builder (20 iterations)
- [x] #5 build chain runs fk:builder only (30 iterations)
- [x] #6 plan chain runs fk:planner only (5 iterations)
<!-- AC:END -->

## Implementation Notes

Completed: Added fk:planner and fk:builder agent configs with systemPrompt references, model settings, and tool restrictions. Added ralph, build, and plan chains with specified iterations.
