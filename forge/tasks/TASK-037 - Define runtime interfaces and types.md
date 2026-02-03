---
id: TASK-037
title: Define runtime interfaces and types
status: Done
priority: high
labels:
  - backend
  - runtime
dependencies: []
createdAt: '2026-02-03T19:11:23.820Z'
updatedAt: '2026-02-03T19:29:59.251Z'
---

## Description

Create lib/runtime/types.ts with the core type definitions for the backend-agnostic runtime abstraction. This establishes the contract that all runtime backends must implement.

<!-- AC:BEGIN -->
- [x] #1 AgentRuntime interface defined with run(), runInteractive(), capabilities() methods
- [x] #2 RuntimeCapabilities type includes supportsMcp, supportsTools, supportsModel, supportsMaxTurns flags
- [x] #3 RunOptions type includes prompt, systemPrompt, cwd, env, model, maxTurns, tools, settings, mcpConfig, mode, providerOptions, rawArgs
- [x] #4 RunResult type includes exitCode, stdout, stderr, completionMarkerFound fields
- [x] #5 StreamCallbacks type includes onStdout, onStderr, onMarkerDetected callbacks
- [x] #6 RuntimeBackend union type defined (claude-cli | codex-cli | codex-sdk)
- [x] #7 Types compile with no errors
<!-- AC:END -->

## Implementation Notes

Completed: Created lib/runtime/types.ts with all required interfaces and types. All types compile successfully with bun.
