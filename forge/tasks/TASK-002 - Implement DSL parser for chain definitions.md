---
id: TASK-002
title: Implement DSL parser for chain definitions
status: Done
priority: high
labels:
  - backend
dependencies: []
createdAt: '2026-01-22T17:51:40.555Z'
updatedAt: '2026-01-22T17:58:54.606Z'
---

## Description

Create lib/forkhestra/parser.ts - parses the DSL string format (e.g., 'agent1:3 -> agent2:10') into structured ChainStep arrays. Handles both pipeline mode (no iterations) and loop mode (with iterations).

<!-- AC:BEGIN -->
- [x] #1 Parses single agent without iterations (e.g., 'agent') returning loop: false, iterations: 1
- [x] #2 Parses single agent with iterations (e.g., 'agent:10') returning loop: true, iterations: 10
- [x] #3 Parses pipeline chains with arrow separator (e.g., 'a -> b -> c')
- [x] #4 Parses mixed mode chains (e.g., 'a -> b:10') with correct loop flags per step
- [x] #5 Throws descriptive error on invalid syntax (malformed agent names)
- [x] #6 Throws descriptive error on non-numeric or non-positive iteration counts
- [x] #7 Handles whitespace around arrows and colons gracefully
<!-- AC:END -->

## Implementation Notes

Implemented lib/forkhestra/parser.ts with comprehensive DSL parsing. Added parser.test.ts with 41 tests covering all acceptance criteria. All tests pass.

Task completed: All 7 acceptance criteria implemented and verified with tests.
