---
id: TASK-015
title: Add prompt file reading utility
status: Done
priority: high
labels:
  - backend
dependencies:
  - TASK-014
createdAt: '2026-01-23T15:49:44.238Z'
updatedAt: '2026-01-23T16:01:43.943Z'
---

## Description

Create lib/forkhestra/prompt.ts with utilities to read prompt content from files and resolve prompts from multiple sources with priority ordering.

<!-- AC:BEGIN -->
- [x] #1 readPromptFile() reads file content relative to provided cwd
- [x] #2 readPromptFile() throws clear error with filename if file not found
- [x] #3 resolvePrompt() returns first defined prompt following priority order: CLI > step > chain > agent default
- [x] #4 At same level, inline prompt wins over promptFile
- [x] #5 Returns undefined if no prompt found at any level
- [x] #6 Unit tests verify resolution priority logic
<!-- AC:END -->

## Implementation Notes

Created lib/forkhestra/prompt.ts with readPromptFile() and resolvePrompt() utilities. Added 30 unit tests covering all priority logic and error handling.

Task completed: All 6 acceptance criteria met. Module exports added to lib/forkhestra/index.ts.
