---
id: TASK-017
title: Update chain executor for prompt resolution
status: Done
priority: high
labels:
  - backend
dependencies:
  - TASK-015
  - TASK-016
createdAt: '2026-01-23T15:49:47.996Z'
updatedAt: '2026-01-23T16:05:22.666Z'
---

## Description

Modify lib/forkhestra/chain.ts to accept prompt-related options and resolve the appropriate prompt for each step using the prompt utility.

<!-- AC:BEGIN -->
- [x] #1 ChainOptions accepts cliPrompt, cliPromptFile, chainPrompt, chainPromptFile, and agentDefaults fields
- [x] #2 For each step, resolvePrompt is called with all relevant prompt sources
- [x] #3 Different steps can have different resolved prompts
- [x] #4 CLI prompt overrides all step and chain-level prompts
- [x] #5 Integration tests cover multi-step chains with different prompts per step
<!-- AC:END -->

## Implementation Notes

Implementation completed:
- Updated ChainOptions interface to accept cliPrompt, cliPromptFile, chainConfig, and agentDefaults fields
- Imported resolvePrompt from ./prompt and ChainStep/ChainConfig/AgentConfig types from ./config
- For each step, resolvePrompt is called with all relevant prompt sources (CLI, step, chain, agent defaults)
- CLI prompt always overrides all step and chain-level prompts
- Different steps can have different resolved prompts based on the priority hierarchy
- Added 12 integration tests covering multi-step chains with various prompt combinations
- All 26 tests pass
