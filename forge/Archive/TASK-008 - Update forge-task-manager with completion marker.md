---
id: TASK-008
title: Update forge-task-manager with completion marker
status: Done
priority: medium
labels:
  - backend
dependencies:
  - TASK-001
createdAt: '2026-01-22T17:52:25.883Z'
updatedAt: '2026-01-22T18:04:17.750Z'
---

## Description

Update the forge-task-manager agent's system prompt to output FORKHESTRA_COMPLETE when it has finished creating all tasks from requirements. This enables it to participate in forkhestra orchestration.

<!-- AC:BEGIN -->
- [x] #1 System prompt instructs agent to output FORKHESTRA_COMPLETE on its own line when done
- [x] #2 Agent outputs marker after all tasks are created from the input plan/requirements
- [x] #3 Marker is output before agent exits
<!-- AC:END -->

## Implementation Notes

Added FORKHESTRA_COMPLETE marker to forge-task-manager system prompt
