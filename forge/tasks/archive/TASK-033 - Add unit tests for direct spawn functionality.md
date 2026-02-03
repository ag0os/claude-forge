---
id: TASK-033
title: Add unit tests for direct spawn functionality
status: Done
priority: medium
labels:
  - testing
  - forkhestra
dependencies:
  - TASK-029
createdAt: '2026-01-30T15:51:24.927Z'
updatedAt: '2026-01-30T16:11:44.584Z'
---

## Description

Add unit tests for the new direct spawn functionality: config validation for new fields, mode awareness prompt composition, and runner dispatch logic.

<!-- AC:BEGIN -->
- [x] #1 Tests validate new AgentConfig fields
- [x] #2 Tests verify isDirectSpawnAgent() detection logic
- [x] #3 Tests verify mode awareness prefix is prepended
- [x] #4 Tests verify loadAgentSystemPrompt() file vs inline behavior
- [x] #5 Tests verify run() dispatches correctly to runDirect vs runBinary
- [x] #6 All tests pass with bun test
<!-- AC:END -->

## Implementation Notes

Task completed: Added comprehensive unit tests for direct spawn functionality including:
- 17 tests for new AgentConfig field validation (systemPrompt, systemPromptText, mcpConfig, settings, model, maxTurns, allowedTools, disallowedTools)
- 10 tests for isDirectSpawnAgent() detection logic
- 6 tests for run() dispatch logic (runDirect vs runBinary)
- Mode awareness tests already existed and pass (21 tests for loadAgentSystemPrompt and composeSystemPrompt)
All new tests pass. 3 pre-existing tests fail due to environmental assumptions about util:forge-config availability (not related to this task).
