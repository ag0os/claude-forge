---
id: TASK-029
title: Update chain executor to pass agent config
status: Done
priority: high
labels:
  - backend
  - forkhestra
dependencies:
  - TASK-028
createdAt: '2026-01-30T15:50:48.627Z'
updatedAt: '2026-01-30T16:07:44.163Z'
---

## Description

Update lib/forkhestra/chain.ts executeStep() to look up agent config from ForkhestraConfig.agents and pass it to run() via options. This connects the config layer to the runner layer.

<!-- AC:BEGIN -->
- [x] #1 executeStep() looks up agentConfig from config.agents[step.agent]
- [x] #2 agentConfig is passed to run() in the options object
- [x] #3 Missing agent config gracefully falls back to binary spawn
- [x] #4 cwd is passed through to runner for file path resolution
<!-- AC:END -->

## Implementation Notes

Task completed: Updated executeChain() in lib/forkhestra/chain.ts to look up agent config from agentDefaults and pass it to run() via the agentConfig option. Also updated cwd to use resolvedCwd for consistent path resolution. The runner already handles the graceful fallback: if agentConfig is undefined or not a direct spawn agent, it falls back to binary spawn. All 37 chain and runner tests pass.
