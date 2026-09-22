---
id: TASK-047
title: Review codex backend integration
status: To Do
priority: medium
labels:
  - backend
  - runtime
  - codex
dependencies: []
createdAt: '2026-09-22T15:05:56.434Z'
updatedAt: '2026-09-22T15:05:56.434Z'
---

## Description

Codex 0.155+ silently ignores the base_instructions config override that lib/runtime/codex-cli.ts uses for system prompts, so any codex-backend agent (shepherd, orchestra direct spawn) runs without its prompt. Verified 2026-09-22: base_instructions and experimental_instructions_file are both ignored; AGENTS.md in the cwd works (but Claude Code reads AGENTS.md too, so a file-based fix must handle both backends seeing it); codex exec refuses untrusted non-git directories. Plan needed before fixing: where the fix lives (shepherd launcher vs lib/runtime/codex-cli.ts, which affects all codex callers), delivery mechanism (AGENTS.md with ownership rules vs prompt-prepend fallback vs newer codex config path), and cross-backend AGENTS.md hygiene. A reverted spike exists in git history (5abfa01, reverted by 136ff16) with a working AGENTS.md approach to draw from.
