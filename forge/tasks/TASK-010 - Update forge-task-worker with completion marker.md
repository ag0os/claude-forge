---
id: TASK-010
title: Update forge-task-worker with completion marker
status: Done
priority: medium
labels:
  - backend
dependencies:
  - TASK-001
createdAt: '2026-01-22T17:52:38.536Z'
updatedAt: '2026-01-22T18:02:41.773Z'
---

## Description

Update the forge-task-worker agent's system prompt to output FORKHESTRA_COMPLETE when its assigned task is marked as Done with all acceptance criteria checked.

<!-- AC:BEGIN -->
- [x] #1 System prompt instructs agent to output FORKHESTRA_COMPLETE on its own line when done
- [x] #2 Agent outputs marker when assigned task status is 'Done' and all ACs are checked
- [x] #3 Marker is output before agent exits
<!-- AC:END -->

## Implementation Notes

Added Forkhestra Integration section to system prompt with instructions to output FORKHESTRA_COMPLETE

Instructions specify agent outputs marker when task status is Done and all ACs are checked

Marker output is specified in the system prompt, which is loaded before agent exits

Task completed: Added Forkhestra Integration section to forge-task-worker system prompt. Committed as 6a3ccae.
