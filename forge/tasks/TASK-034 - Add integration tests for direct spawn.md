---
id: TASK-034
title: Add integration tests for direct spawn
status: Done
priority: low
labels:
  - testing
  - forkhestra
dependencies:
  - TASK-033
createdAt: '2026-01-30T15:51:32.393Z'
updatedAt: '2026-01-30T16:16:03.683Z'
---

## Description

Add integration tests that verify the full direct spawn flow works end-to-end. Test with --dry-run to verify command construction, test max-turns limiting, and verify prompt file loading.

<!-- AC:BEGIN -->
- [x] #1 Integration test runs forkhestra --chain ralph --dry-run
- [x] #2 Integration test verifies claude command args are constructed correctly
- [x] #3 Integration test verifies max-turns is passed to claude
- [x] #4 Integration test fails gracefully with clear error for missing prompt file
<!-- AC:END -->

## Implementation Notes

Task completed: Created lib/forkhestra/integration.test.ts with 29 comprehensive tests covering:
- Direct spawn configuration loading and validation
- System prompt loading from file and inline text
- System prompt composition with mode awareness prefix
- Claude command argument construction (--print, --dangerously-skip-permissions, --append-system-prompt, --max-turns, --model, --allowedTools, --disallowedTools, --mcp-config, --settings)
- Forkhestra CLI dry-run execution
- Error handling for missing prompt files
- Chain iteration limit verification
