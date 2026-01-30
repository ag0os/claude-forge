---
id: TASK-001
title: Implement core runner for agent execution
status: Done
priority: high
labels:
  - backend
dependencies: []
createdAt: '2026-01-22T17:51:32.152Z'
updatedAt: '2026-01-22T17:59:31.771Z'
---

## Description

Create lib/forkhestra/runner.ts - the foundational component that spawns agent binaries, streams output, and detects the FORKHESTRA_COMPLETE marker. This is the core loop mechanism that all other components depend on.

<!-- AC:BEGIN -->
- [x] #1 Spawns agent binary by name using Bun.spawn (assumes binary is in PATH)
- [x] #2 When loop: false, runs agent once and returns without checking for completion marker
- [x] #3 When loop: true, streams stdout and detects FORKHESTRA_COMPLETE marker
- [x] #4 When loop: true, stops looping when marker is detected in stdout
- [x] #5 Respects maxIterations limit and returns appropriate reason
- [x] #6 Passes --cwd and custom args array to spawned agent
- [x] #7 Forwards SIGINT/SIGTERM to child process for graceful shutdown
- [x] #8 Returns structured RunResult with complete, iterations, exitCode, and reason fields
<!-- AC:END -->

## Implementation Notes

Implemented Bun.spawn for agent execution in run() and runOnce() functions

Single-run mode implemented with loop:false path that calls runOnce() and returns with reason 'single_run'

Loop mode implemented with runOnceWithMarkerDetection() that streams stdout and detects FORKHESTRA_COMPLETE marker

maxIterations limit enforced in loop with reason 'max_iterations' when reached

Passes --cwd flag and custom args array to spawned agent in cmdArgs

SIGINT/SIGTERM handlers forward signals to currentProcess via handleSignal()

RunResult interface with complete, iterations, exitCode, and reason fields implemented and returned

Task completed: Created lib/forkhestra/runner.ts with run() function, RunResult interface, and COMPLETION_MARKER constant. All 6 tests passing.
