---
id: TASK-030
title: Create forkhestra planner agent prompt
status: Done
priority: medium
labels:
  - forkhestra
  - prompt
dependencies:
  - TASK-029
createdAt: '2026-01-30T15:50:57.569Z'
updatedAt: '2026-01-30T16:10:23.767Z'
---

## Description

Create system-prompts/fk/planner.md with the planner agent system prompt. The planner reads ralph/ directory files (PLAN.md, SPECS.md, AGENTS.md), identifies gaps between requirements and existing tasks, and creates new tasks using forge-tasks CLI.

<!-- AC:BEGIN -->
- [x] #1 Planner prompt instructs to read ralph/PLAN.md and ralph/SPECS.md
- [x] #2 Planner prompt instructs to check existing tasks with forge-tasks list
- [x] #3 Planner prompt instructs to create tasks for uncovered requirements
- [x] #4 Planner prompt enforces planning only, no implementation
- [x] #5 Planner prompt includes FORKHESTRA_COMPLETE contract
<!-- AC:END -->

## Implementation Notes

Created system-prompts/fk/planner.md with: instructions to read ralph/PLAN.md and ralph/SPECS.md; forge-tasks list --plain for checking existing tasks; task creation for uncovered requirements; planning-only enforcement; FORKHESTRA_COMPLETE marker contract
