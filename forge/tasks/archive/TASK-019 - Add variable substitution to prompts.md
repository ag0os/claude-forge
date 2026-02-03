---
id: TASK-019
title: Add variable substitution to prompts
status: Done
priority: medium
labels:
  - backend
dependencies:
  - TASK-014
createdAt: '2026-01-23T15:49:49.288Z'
updatedAt: '2026-01-23T16:00:31.766Z'
---

## Description

Extend substituteVars() in lib/forkhestra/config.ts to handle prompt and promptFile fields at step and chain levels.

<!-- AC:BEGIN -->
- [x] #1 Variables (${VAR}) in step prompt fields are substituted
- [x] #2 Variables in step promptFile fields are substituted
- [x] #3 Variables in chain-level prompt are substituted
- [x] #4 Variables in chain-level promptFile are substituted
- [x] #5 Missing required variables throw clear error message
- [x] #6 Unit tests cover variable substitution in all prompt locations
<!-- AC:END -->

## Implementation Notes

Task completed: All variable substitution functionality was already implemented in TASK-014. Verified implementation in lib/forkhestra/config.ts:

- substituteVars() handles step-level prompt and promptFile fields (lines 471-481)
- substituteVarsInChain() handles chain-level prompt and promptFile fields (lines 503-508)
- substituteVarsInString() provides clear error messages for missing variables (lines 536-542)

All 31 unit tests pass, covering all prompt field locations at both step and chain levels, including error cases for missing variables.
