---
id: TASK-020
title: Document forkhestra prompt support
status: Done
priority: medium
labels:
  - documentation
dependencies:
  - TASK-018
  - TASK-019
createdAt: '2026-01-23T15:49:50.569Z'
updatedAt: '2026-01-23T16:11:16.088Z'
---

## Description

Update documentation to cover new prompt configuration and CLI options.

<!-- AC:BEGIN -->
- [x] #1 CLAUDE.md forkhestra section updated with prompt CLI flags and config examples
- [x] #2 New docs/FORKHESTRA.md created with comprehensive prompt documentation
- [x] #3 Prompt resolution priority table included in documentation
- [x] #4 Example chain config with prompts added to forge/chains.json
<!-- AC:END -->

## Implementation Notes

Updated CLAUDE.md forkhestra section with prompt CLI flags (--prompt, -p, --prompt-file) and config examples including agents section, chain/step prompts, and priority table.

Created docs/FORKHESTRA.md with comprehensive documentation including: CLI reference, DSL syntax, prompt support (CLI, config, variables), configuration schema, completion marker contract, examples, and troubleshooting.

Prompt resolution priority table included in both CLAUDE.md (concise) and docs/FORKHESTRA.md (detailed with examples). Documents 4-level priority: CLI > step > chain > agent default, with inline prompt beating promptFile at each level.

Added example chains to forge/chains.json: 'feature-build' (chain-level and step-level prompts with variables) and 'targeted-work' (step prompt with variable substitution). Also added 'agents' section with default prompts for forge-task-manager and forge-task-coordinator.

Task completed. All documentation updated: CLAUDE.md forkhestra section expanded with prompt flags and config examples, docs/FORKHESTRA.md created with comprehensive documentation, and forge/chains.json updated with example chains demonstrating prompt usage.
