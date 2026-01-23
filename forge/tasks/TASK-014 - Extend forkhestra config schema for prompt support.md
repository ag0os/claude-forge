---
id: TASK-014
title: Extend forkhestra config schema for prompt support
status: Done
priority: high
labels:
  - backend
dependencies: []
createdAt: '2026-01-23T15:49:43.394Z'
updatedAt: '2026-01-23T15:58:54.336Z'
---

## Description

Add TypeScript interfaces and validation for prompt fields at agent, chain, and step levels in lib/forkhestra/config.ts. This enables prompts to be specified in configuration files.

<!-- AC:BEGIN -->
- [x] #1 AgentConfig interface has defaultPrompt and defaultPromptFile optional string fields
- [x] #2 ForkhestraConfig interface has optional agents section (Record<string, AgentConfig>)
- [x] #3 ChainConfig interface has prompt and promptFile optional string fields
- [x] #4 ChainStep interface has prompt and promptFile optional string fields
- [x] #5 Validation rejects non-string values for prompt fields
- [x] #6 Variable substitution (${VAR}) works in all prompt fields
- [x] #7 Unit tests cover new schema validation
<!-- AC:END -->

## Implementation Notes

Implemented prompt field support in config.ts:
- Added AgentConfig interface with defaultPrompt and defaultPromptFile
- Added optional agents section to ForkhestraConfig
- Added prompt and promptFile to ChainConfig interface
- Added prompt and promptFile to ChainStep interface
- Added validation for all prompt fields (rejects non-string values)
- Updated substituteVars to handle prompt/promptFile in steps
- Added substituteVarsInChain for chain-level prompt substitution
- Created comprehensive test suite with 31 tests covering all new functionality

Task completed: All 7 acceptance criteria met
