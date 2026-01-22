---
id: TASK-003
title: Implement config loader for chain definitions
status: Done
priority: high
labels:
  - backend
dependencies: []
createdAt: '2026-01-22T17:51:47.583Z'
updatedAt: '2026-01-22T18:00:30.777Z'
---

## Description

Create lib/forkhestra/config.ts - loads and validates forge/chains.json configuration file. Handles variable substitution in args using ${VAR} syntax.

<!-- AC:BEGIN -->
- [x] #1 Loads config from forge/chains.json relative to provided cwd
- [x] #2 Returns null when config file does not exist (not an error condition)
- [x] #3 Throws descriptive error on invalid JSON syntax
- [x] #4 Throws descriptive error when schema structure is invalid (missing chains, invalid step format)
- [x] #5 Substitutes ${VAR_NAME} placeholders in args with provided variable values
- [x] #6 Throws descriptive error when variable is referenced but not provided
- [x] #7 Exports getChain function to retrieve named chain as ChainStep array
<!-- AC:END -->

## Implementation Notes

Implementation completed:
- Created lib/forkhestra/config.ts with loadConfig(), getChain(), and substituteVars() functions
- loadConfig() is async and uses Bun.file().text() for reading
- Comprehensive schema validation with descriptive error messages
- Variable substitution supports ${VAR_NAME} pattern in args
- Returns null for missing config file (not an error)
- All 8 test cases pass
