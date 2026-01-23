---
id: TASK-018
title: Add CLI flags for prompt
status: Done
priority: high
labels:
  - backend
dependencies:
  - TASK-017
createdAt: '2026-01-23T15:49:49.185Z'
updatedAt: '2026-01-23T16:08:11.471Z'
---

## Description

Add --prompt/-p and --prompt-file CLI flags to agents/forkhestra.ts and wire them through to the chain executor.

<!-- AC:BEGIN -->
- [x] #1 --prompt or -p flag accepts inline prompt string
- [x] #2 --prompt-file flag accepts path to file containing prompt
- [x] #3 Help text documents new flags with usage examples
- [x] #4 Dry-run output shows resolved prompt for each step
- [x] #5 Prompts from CLI are passed to executeChain as cliPrompt/cliPromptFile
<!-- AC:END -->

## Implementation Notes

Implemented CLI flags for prompt support:
- Added --prompt/-p flag for inline prompt strings
- Added --prompt-file flag for reading prompts from files
- Updated help text with new flags and usage examples
- Updated printDryRun() to resolve and display prompts for each step
- Passed cliPrompt and cliPromptFile to executeChain()

Task completed: All acceptance criteria verified working.
