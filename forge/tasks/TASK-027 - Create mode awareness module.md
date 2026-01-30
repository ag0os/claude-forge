---
id: TASK-027
title: Create mode awareness module
status: Done
priority: high
labels:
  - backend
  - forkhestra
dependencies:
  - TASK-026
createdAt: '2026-01-30T15:50:26.418Z'
updatedAt: '2026-01-30T16:00:36.780Z'
---

## Description

Create lib/forkhestra/mode-awareness.ts with MODE_AWARENESS_PREFIX constant and helper functions for composing system prompts. This addresses Claude Code bug #17603 where Claude doesn't know it's headless.

<!-- AC:BEGIN -->
- [x] #1 MODE_AWARENESS_PREFIX constant contains headless mode instructions
- [x] #2 MODE_AWARENESS_PREFIX includes FORKHESTRA_COMPLETE contract
- [x] #3 composeSystemPrompt() prepends MODE_AWARENESS_PREFIX to agent prompt
- [x] #4 loadAgentSystemPrompt() loads from file when systemPrompt is set
- [x] #5 loadAgentSystemPrompt() returns inline text when systemPromptText is set
- [x] #6 Module is exported from lib/forkhestra/index.ts
<!-- AC:END -->

## Implementation Notes

Completed: Created lib/forkhestra/mode-awareness.ts with MODE_AWARENESS_PREFIX, composeSystemPrompt(), and loadAgentSystemPrompt(). Added comprehensive tests in mode-awareness.test.ts (21 tests passing). Module exported from index.ts.
