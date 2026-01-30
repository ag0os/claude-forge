---
id: TASK-026
title: Extend AgentConfig interface with direct spawn fields
status: Done
priority: high
labels:
  - backend
  - forkhestra
dependencies: []
createdAt: '2026-01-30T15:50:18.069Z'
updatedAt: '2026-01-30T15:58:19.403Z'
---

## Description

Add new configuration fields to AgentConfig for direct Claude spawning: systemPrompt, systemPromptText, mcpConfig, settings, model, maxTurns, allowedTools, disallowedTools. Also add validation in validateAndTransformAgent() and isDirectSpawnAgent() helper function.

<!-- AC:BEGIN -->
- [x] #1 AgentConfig has systemPrompt field (string, optional)
- [x] #2 AgentConfig has systemPromptText field (string, optional)
- [x] #3 AgentConfig has mcpConfig field (string, optional)
- [x] #4 AgentConfig has settings field (string, optional)
- [x] #5 AgentConfig has model field with enum validation (sonnet/opus/haiku)
- [x] #6 AgentConfig has maxTurns field (positive integer, optional)
- [x] #7 AgentConfig has allowedTools field (string array, optional)
- [x] #8 AgentConfig has disallowedTools field (string array, optional)
- [x] #9 isDirectSpawnAgent() returns true when systemPrompt or systemPromptText is set
<!-- AC:END -->

## Implementation Notes

Implemented all new fields in AgentConfig interface: systemPrompt, systemPromptText, mcpConfig, settings, model, maxTurns, allowedTools, disallowedTools. Added AgentModel type alias for model validation. Added isDirectSpawnAgent() helper function. Updated validateAndTransformAgent() with full validation for all new fields including type checks, enum validation for model, positive integer check for maxTurns, and array element type checks for allowedTools/disallowedTools.
