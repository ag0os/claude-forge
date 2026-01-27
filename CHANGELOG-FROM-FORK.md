# Claude Forge: Evolution from claude-workshop-live

This document describes the major changes made after forking from [johnlindquist/claude-workshop-live](https://github.com/johnlindquist/claude-workshop-live).

## Why a New Repository?

The original repository was created by John Lindquist for a workshop and hasn't seen active development since. This project diverged significantly and there were no plans to contribute changes back upstream. Additionally, GitHub's default PR behavior for forks kept accidentally opening pull requests against the original repository. Creating a fresh, independent repository avoids this issue entirely.

## Original Fork

Claude Forge was originally forked from `johnlindquist/claude-workshop-live`, a collection of agents and utilities for the Claude Code CLI. The original project provided a foundation of agent infrastructure including:
- Basic agent compilation system (TypeScript to binary)
- MCP configuration patterns
- Settings and permissions system
- Initial agents: designer, planner, contain, refactor, builder, orient, brainstorm
- Claude CLI integration utilities (`lib/claude.ts`, `lib/flags.ts`)
- JSONL conversation utilities
- Hooks system for Claude events

## Major New Features

### 1. Forge-Tasks: Hybrid Task Management System

A complete task management system that combines a CLI tool with Claude sub-agents for coordinated task execution.

**Components:**
- `forge-tasks/` - Core library with task parsing, serialization, file system utilities
- CLI commands: `init`, `create`, `list`, `view`, `edit`, `delete`, `search`
- Sub-agents:
  - `forge-task-manager` - Creates and manages tasks with labels and acceptance criteria
  - `forge-task-worker` - Implements individual assigned tasks
  - `forge-task-coordinator` - Coordinates sub-agents to implement task backlogs

**Key Features:**
- Markdown-based task files with YAML frontmatter
- Sequential task ID generation
- Label-based task organization
- Acceptance criteria tracking
- Integration with forkhestra for orchestration loops

### 2. Forkhestra: Agent Orchestration Library

A DSL and runtime for orchestrating Claude agent chains with iteration control.

**Components:**
- `lib/forkhestra/` - Core orchestration library
  - DSL parser for chain definitions
  - Core runner for agent execution
  - Chain executor for sequential steps
  - Prompt resolution system

**DSL Syntax:**
```
agent             # Run once
agent:N           # Loop up to N times (watches for completion marker)
a -> b            # Pipeline: run a, then b
a:3 -> b:10       # Chain with iteration limits
```

**Features:**
- Pipeline mode: Run agents once each in sequence
- Loop mode: Run agents until `FORKHESTRA_COMPLETE` marker or max iterations
- Configuration via `forge/chains.json`
- Prompt support: CLI flags, step-level, chain-level, agent defaults
- Variable substitution in prompts

### 3. Agent Namespacing System

Restructured agents from flat directory to functional namespaces:

| Namespace | Purpose |
|-----------|---------|
| `plan/` | Planning and design exploration |
| `tasks/` | Task management workflows |
| `build/` | Implementation and refactoring |
| `design/` | Design and visualization (including `diagram/` subdirectory) |
| `video/` | Gemini-powered video processing |
| `orch/` | Orchestration agents |
| `analyze/` | Codebase analysis |
| `meta/` | Meta-tools for prompts and documentation |
| `util/` | Standalone utilities |
| `modes/` | Alternative Claude configurations |
| `rails/` | Platform-specific (Rails) agents |
| `local/` | Personal agents (gitignored) |

**Binary naming convention:**
- `agents/plan/planner.ts` → `plan:planner`
- `agents/design/diagram/all.ts` → `design:diagram:all`

### 4. New Agents

**Planning & Design:**
- `plan:riff` - Design exploration through pseudo-code dialogue
- `plan:brainstorm` - Brainstorm agent variations from an idea
- `plan:coordinator` - Coordinate sub-agents to implement a plan

**Design & Visualization:**
- `design:audit` - Comprehensive design system audits
- `design:diagram:all` - Generate all diagrams for a project
- `design:diagram:topic` - Topic-focused diagram generation
- `design:diagram:consolidate` - Consolidate and dedupe diagrams

**Video Processing:**
- `video:summarize` - Gemini-powered video summarization
- `video:execute` - Extract instructions from video, execute with Claude

**Analysis:**
- `analyze:search` - Search JSONL conversations
- `analyze:github` - Find GitHub code examples

**Meta Tools:**
- `meta:claudemd` - Create or update CLAUDE.md
- `meta:prompt` - Improve prompts with variations
- `meta:expectations` - Apply expectations prompt
- `meta:infer` - Infer commands/hooks from conversations

**Utilities:**
- `util:latest` - Find newest JSONL for current project
- `util:mcp-tools` - List MCP server tools
- `util:jsonl` - JSONL formatting recipes
- `util:scriptkit` - Generate Script Kit scripts
- `util:conv` - Conversation utilities (TUI)

### 5. Enhanced Documentation

- Comprehensive `CLAUDE.md` with agent namespacing documentation
- `docs/FORGE-TASKS.md` - Forge-tasks documentation
- `docs/FORKHESTRA.md` - Forkhestra orchestration documentation
- `docs/HOOKS.md` - Type-safe hooks documentation

### 6. Infrastructure Improvements

- Project renamed from `claude-workshop-live` to `claude-forge`
- Enhanced asset generation system (`lib/assets.gen.ts`)
- Improved lib exports and module organization
- Additional test coverage for forge-tasks
- Biome configuration for agents directory

## Summary

The fork evolved from a workshop example into a comprehensive agent development framework with:
- **Task management** for structured work tracking
- **Agent orchestration** for complex multi-agent workflows
- **Namespace organization** for scalable agent collections
- **Video processing** integration with Gemini
- **Extensive tooling** for prompt engineering and codebase analysis

The original agent concepts (designer, planner, contain, refactor, builder) remain but are now part of a larger ecosystem with orchestration capabilities.
