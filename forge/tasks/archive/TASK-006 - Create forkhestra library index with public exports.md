---
id: TASK-006
title: Create forkhestra library index with public exports
status: Done
priority: medium
labels:
  - backend
dependencies:
  - TASK-001
  - TASK-002
  - TASK-003
  - TASK-004
createdAt: '2026-01-22T17:52:10.880Z'
updatedAt: '2026-01-22T18:08:32.985Z'
---

## Description

Create lib/forkhestra/index.ts - exports the public API from the forkhestra library modules for use by the CLI and potentially other consumers.

<!-- AC:BEGIN -->
- [x] #1 Exports run function from runner.ts
- [x] #2 Exports parseDSL function from parser.ts
- [x] #3 Exports loadConfig, getChain, substituteVars from config.ts
- [x] #4 Exports executeChain from chain.ts
- [x] #5 Exports all TypeScript interfaces (RunResult, RunOptions, ChainStep, etc.)
<!-- AC:END -->

## Implementation Notes

Index at lib/forkhestra/index.ts with all exports
