---
id: TASK-022
title: Update forkhestra config resolution with fallback
status: Done
priority: high
labels:
  - backend
dependencies:
  - TASK-021
createdAt: '2026-01-28T15:27:45.736Z'
updatedAt: '2026-01-28T16:23:10.028Z'
---

## Description

Update forkhestra to resolve chains.json with fallback resolution: 1) Local ./forge/chains.json (project-specific override), 2) forge-config chains output (global shared config), 3) Error if neither found. This allows projects to define their own chains while falling back to shared chains from claude-forge.

<!-- AC:BEGIN -->
- [x] #1 Local ./forge/chains.json config takes precedence over global
- [x] #2 Falls back to forge-config chains when local config not found
- [x] #3 Handles forge-config not in PATH gracefully (doesn't crash)
- [x] #4 Error message explains resolution attempts when neither source found
- [x] #5 Verbose mode shows which config source was used
<!-- AC:END -->

## Implementation Notes

Starting implementation: updating config.ts with fallback resolution

Implemented forge-config fallback in loadConfig function with verbose mode support

All acceptance criteria met. Local config takes precedence, falls back to forge-config chains, handles missing forge-config gracefully, and provides clear error messages with verbose mode showing config source.
