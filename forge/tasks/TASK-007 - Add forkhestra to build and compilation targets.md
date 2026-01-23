---
id: TASK-007
title: Add forkhestra to build and compilation targets
status: Done
priority: medium
labels:
  - devops
dependencies:
  - TASK-005
createdAt: '2026-01-22T17:52:17.960Z'
updatedAt: '2026-01-22T18:11:22.056Z'
---

## Description

Integrate forkhestra.ts into the build system so it compiles to a standalone binary in bin/. Update any asset registry or build scripts as needed.

<!-- AC:BEGIN -->
- [x] #1 'bun compile agents/forkhestra.ts' produces bin/forkhestra binary
- [x] #2 Binary is standalone and runs without bun installed at runtime
- [x] #3 'forkhestra --help' displays usage information
- [x] #4 Binary is added to asset registry if applicable
<!-- AC:END -->

## Implementation Notes

Build script added, binary compiles to bin/forkhestra
