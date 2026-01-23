---
id: TASK-004
title: Implement chain executor for sequential step execution
status: Done
priority: high
labels:
  - backend
dependencies:
  - TASK-001
createdAt: '2026-01-22T17:51:55.512Z'
updatedAt: '2026-01-22T18:04:16.613Z'
---

## Description

Create lib/forkhestra/chain.ts - executes a sequence of ChainSteps, running each agent through the runner. Handles step-by-step execution with proper failure handling.

<!-- AC:BEGIN -->
- [x] #1 Executes ChainStep array in sequential order
- [x] #2 Stops execution if a looping step doesn't complete within its max iterations
- [x] #3 Merges globalArgs with per-step args (step args take precedence)
- [x] #4 Returns structured ChainResult with success flag and per-step details
- [x] #5 Reports failedAt index when chain doesn't complete
- [x] #6 Handles SIGINT gracefully, killing current child and stopping chain
<!-- AC:END -->

## Implementation Notes

Chain executor implemented with full test suite
