---
id: TASK-011
title: Create example chains.json configuration
status: Done
priority: low
labels:
  - documentation
dependencies:
  - TASK-003
createdAt: '2026-01-22T17:52:46.034Z'
updatedAt: '2026-01-22T18:08:33.806Z'
---

## Description

Create forge/chains.json with example chain configurations demonstrating the various modes: pipeline, loop, mixed, and variable substitution.

<!-- AC:BEGIN -->
- [x] #1 File exists at forge/chains.json
- [x] #2 Contains 'plan-and-build' chain with task-manager and task-coordinator
- [x] #3 Contains 'quick-pipeline' chain showing non-looping sequential execution
- [x] #4 Contains 'single-task' chain demonstrating variable substitution with TASK_ID
- [x] #5 Contains 'mixed-mode' chain showing combination of looping and non-looping steps
- [x] #6 All chains have descriptions explaining their purpose
<!-- AC:END -->

## Implementation Notes

chains.json created at forge/chains.json
