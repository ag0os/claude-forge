---
id: TASK-016
title: Update forkhestra runner to accept and pass prompt
status: Done
priority: high
labels:
  - backend
dependencies:
  - TASK-014
createdAt: '2026-01-23T15:49:45.772Z'
updatedAt: '2026-01-23T16:01:12.150Z'
---

## Description

Modify lib/forkhestra/runner.ts to accept an optional prompt field in RunOptions and append it to agent spawn args.

<!-- AC:BEGIN -->
- [x] #1 RunOptions interface has optional prompt string field
- [x] #2 Prompt is appended as last positional argument to spawn command
- [x] #3 Works in both single-run (runOnce) and loop modes (runOnceWithMarkerDetection)
- [x] #4 Empty or undefined prompt does not add extra args
- [x] #5 Unit tests verify prompt is passed to spawn
<!-- AC:END -->

## Implementation Notes

Added optional prompt field to RunOptions interface

Prompt is appended as last positional argument after args

cmdArgs with prompt is passed to both runOnce and runOnceWithMarkerDetection

if (prompt) check ensures empty/undefined prompts are not added

Added 5 unit tests verifying prompt passing in both modes

Task completed: Added prompt field to RunOptions and updated run() function to append prompt as last positional argument. All 11 tests pass.
