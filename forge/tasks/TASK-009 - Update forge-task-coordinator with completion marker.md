---
id: TASK-009
title: Update forge-task-coordinator with completion marker
status: Done
priority: medium
labels:
  - backend
dependencies:
  - TASK-001
createdAt: '2026-01-22T17:52:32.007Z'
updatedAt: '2026-01-22T18:04:18.997Z'
---

## Description

Update the forge-task-coordinator agent's system prompt to output FORKHESTRA_COMPLETE when all tasks have been implemented (no tasks with status 'To Do' or 'In Progress' remain).

<!-- AC:BEGIN -->
- [x] #1 System prompt instructs agent to output FORKHESTRA_COMPLETE on its own line when done
- [x] #2 Agent outputs marker when no tasks remain in 'To Do' or 'In Progress' status
- [x] #3 Marker is output before agent exits
<!-- AC:END -->

## Implementation Notes

Added FORKHESTRA_COMPLETE marker to forge-task-coordinator system prompt
