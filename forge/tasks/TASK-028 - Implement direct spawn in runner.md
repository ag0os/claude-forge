---
id: TASK-028
title: Implement direct spawn in runner
status: Done
priority: high
labels:
  - backend
  - forkhestra
dependencies:
  - TASK-027
createdAt: '2026-01-30T15:50:38.837Z'
updatedAt: '2026-01-30T16:04:50.224Z'
---

## Description

Update lib/forkhestra/runner.ts to spawn Claude directly when agent has systemPrompt configured. Add DirectRunOptions interface, runDirect() function, and refactor existing logic to runBinary(). The run() function should dispatch based on isDirectSpawnAgent().

<!-- AC:BEGIN -->
- [x] #1 DirectRunOptions interface extends RunOptions with agentConfig and cwd
- [x] #2 runDirect() builds claude command with --print --dangerously-skip-permissions
- [x] #3 runDirect() uses --append-system-prompt with composed prompt
- [x] #4 runDirect() adds --max-turns when maxTurns is configured
- [x] #5 runDirect() adds --model when model is configured
- [x] #6 runDirect() adds --mcp-config when mcpConfig is configured
- [x] #7 runDirect() adds --settings when settings is configured
- [x] #8 runDirect() adds --allowedTools when allowedTools is configured
- [x] #9 runDirect() adds --disallowedTools when disallowedTools is configured
- [x] #10 run() dispatches to runDirect() for direct spawn agents
- [x] #11 run() dispatches to runBinary() for legacy binary agents
- [x] #12 Existing marker detection and loop logic works for both paths
<!-- AC:END -->

## Implementation Notes

Completed implementation:

- Created lib/forkhestra/constants.ts to hold COMPLETION_MARKER (avoids circular dependency)
- Updated mode-awareness.ts to import COMPLETION_MARKER from constants.ts
- Updated runner.ts with:
  - Added agentConfig optional field to RunOptions interface
  - run() now dispatches to runDirect() for direct spawn agents or runBinary() for legacy binaries
  - runBinary() handles compiled agent binaries (existing behavior, renamed from original run logic)
  - runDirect() spawns 'claude' directly with --append-system-prompt containing composed prompt
  - buildClaudeArgs() builds CLI args from agentConfig (maxTurns, model, mcpConfig, settings, allowedTools, disallowedTools)
  - Extracted streamAndDetectMarker() as shared helper for both binary and direct spawn paths
- All existing tests pass (129 tests across 5 files)
