# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Forge - A collection of TypeScript agents and utilities for enhancing Claude Code CLI functionality with custom configurations, MCP integrations, and specialized workflows.

## Commands

### Development Commands
- `bun install` - Install dependencies
- `bun run index.ts` - Run the main entry point
- `bun compile <file>` - Compile TypeScript file to binary in ./bin/
- `bun watch` - Watch and auto-compile agents directory
- `bun lint` - Format and fix code with Biome
- `bun format` - Format code with Biome
- `bun check` - Run Biome checks without fixes
- `bun lint:fix` - Apply unsafe fixes with Biome
- `bun run compile:forge-tasks` - Compile forge-tasks CLI to binary
- `bun run compile:forkhestra` - Compile forkhestra CLI to binary
- `bun test:forge-tasks` - Run forge-tasks tests

## Code Architecture

### Directory Structure
- `agents/` - TypeScript agents organized by namespace (subdirectories become the namespace prefix)
- `lib/` - Core utilities for Claude CLI interaction and flag management
- `settings/` - JSON configuration files for different agent modes (MCP configs and settings)
- `prompts/` - Markdown prompt templates for various use cases
- `system-prompts/` - System prompts for specialized behaviors
- `hooks/` - Type-safe hook scripts that run in response to Claude events (see [docs/HOOKS.md](docs/HOOKS.md))
- `scripts/` - Build and development utilities
- `bin/` - Compiled binaries (generated)
- `docs/` - Documentation for framework features
- `forge-tasks/` - Hybrid task management system (CLI + sub-agents). See [docs/FORGE-TASKS.md](docs/FORGE-TASKS.md)
- `forkhestra/` - Agent orchestration library for chaining and looping agents

### Agent Namespacing

Agents are namespaced via subdirectories. The directory structure determines the binary name:

| Source Path | Binary Name |
|-------------|-------------|
| `agents/plan/planner.ts` | `plan:planner` |
| `agents/tasks/manager.ts` | `tasks:manager` |
| `agents/design/diagram/all.ts` | `design:diagram:all` |
| `agents/local/my-agent.ts` | `local:my-agent` |

**Private agents**: Create `agents/local/` for personal agents that won't be committed (gitignored).

**Usage with forkhestra**:
```bash
forkhestra "tasks:manager -> tasks:coordinator:10"
forkhestra "plan:riff -> build:builder"
```

## Forkhestra - Agent Orchestration

Forkhestra provides two modes for orchestrating agents:
- **Pipeline mode**: Run agents once each, in sequence
- **Loop mode**: Run agents repeatedly until they output `ORCHESTRA_COMPLETE` or hit max iterations

### CLI Usage

```bash
# Pipeline mode - run agents once each
forkhestra "tasks:manager -> tasks:coordinator"

# Loop mode - single agent with max iterations
forkhestra tasks:coordinator:10

# Chain mode with iterations
forkhestra "tasks:manager:3 -> tasks:coordinator:10"

# Config mode - named chains
forkhestra --chain plan-and-build
forkhestra --chain single-task TASK_ID=TASK-001

# With prompts - pass instructions to agents
forkhestra tasks:coordinator:10 -p "Focus on TASK-001"
forkhestra --chain build --prompt "Implement the login feature"
forkhestra plan:planner:5 --prompt-file prompts/instructions.md

# Options
--cwd <path>           Working directory
--verbose, -v          Full agent output
--dry-run              Show without executing
--prompt, -p <text>    Inline prompt to pass to all agents
--prompt-file <path>   Path to file containing prompt
```

### DSL Syntax

- `agent` - Run once, no completion marker check
- `agent:N` - Loop up to N times, watching for completion marker
- `a -> b` - Pipeline: run a, then b (both once)
- `a:3 -> b:10` - Chain: a loops up to 3, then b loops up to 10

### Configuration (forge/orch/chains.json)

```json
{
  "agents": {
    "tasks:manager": {
      "defaultPrompt": "Create tasks from current requirements"
    }
  },
  "chains": {
    "plan-and-build": {
      "description": "Break down requirements into tasks, then coordinate implementation",
      "steps": [
        { "agent": "tasks:manager", "iterations": 3 },
        { "agent": "tasks:coordinator", "iterations": 15 }
      ]
    },
    "design-then-build": {
      "description": "Design exploration followed by implementation",
      "steps": [
        { "agent": "plan:riff" },
        { "agent": "tasks:coordinator", "iterations": 12 }
      ]
    }
  }
}
```

### Prompt Resolution Priority

When multiple prompt sources exist, the highest priority wins:

| Priority | Source | Scope |
|----------|--------|-------|
| 1 | CLI `--prompt` / `--prompt-file` | All steps (runtime override) |
| 2 | Step `prompt` / `promptFile` | This step only |
| 3 | Chain `prompt` / `promptFile` | All steps in chain |
| 4 | Agent `defaultPrompt` / `defaultPromptFile` | Fallback for this agent |

At each level, inline `prompt` beats `promptFile`. See [docs/FORKHESTRA.md](docs/FORKHESTRA.md) for full documentation.

### Completion Marker Contract

Agents participating in forkhestra loops must output `ORCHESTRA_COMPLETE` on its own line when done. The orchestrator watches stdout and stops looping when it sees this marker.

### Direct Spawn Agents

Direct spawn agents are defined entirely in `forge/orch/chains.json` via `systemPrompt` instead of compiled binaries. These agents are spawned by forkhestra directly using `claude` CLI with the specified system prompt.

**Built-in direct spawn agents:**
- `planner` - Creates tasks from `forge/orch/specs/` requirements (read-only tools)
- `builder` - Implements one task per iteration (full tool access)

**Example config:**
```json
{
  "agents": {
    "planner": {
      "systemPrompt": "forge/orch/prompts/planner.md",
      "model": "sonnet",
      "allowedTools": ["Read", "Grep", "Glob", "Bash"]
    }
  }
}
```

### forge/orch/specs/ Directory Convention

The `forge/orch/specs/` directory holds project requirements for forkhestra workflows:

| File | Purpose |
|------|---------|
| `forge/orch/specs/PLAN.md` | High-level implementation plan and goals |
| `forge/orch/specs/SPECS.md` | Detailed specifications and requirements |
| `forge/orch/specs/AGENTS.md` | Coding conventions and project-specific context |

**Usage with build-all chain:**
```bash
# Full workflow: plan tasks, then build
forkhestra --chain build-all

# Plan only (create tasks from requirements)
forkhestra --chain plan

# Build only (implement existing tasks)
forkhestra --chain build
```

**State persistence:** Agents maintain state across iterations through `forge/orch/specs/` files, `forge/tasks/` task files, and git commits. Each iteration reads current state and makes incremental progress.

### Key Libraries
- `@anthropic-ai/claude-code` - Official Claude Code SDK
- `@anthropic-ai/sdk` - Anthropic API client
- `bun` - Runtime and package manager
- `biome` - Code formatter and linter

### Core Patterns
- Agents use `spawn()` to launch Claude CLI with custom settings
- Settings and MCP configs are stored as JSON in `settings/`
- Use `resolvePath()` pattern for resolving relative paths in agents
- `CLAUDE_FORGE_DIR` is automatically set to the framework root (use in hooks)
- `CLAUDE_PROJECT_DIR` points to the target project directory
- Always handle SIGINT/SIGTERM for clean subprocess termination
- When working with containers, always merge changes back with `container-use merge <branch-name>`
- Container environments don't include uncommitted changes - commit first if needed

## Code Style

- Use tabs for indentation (configured in biome.json)
- Use double quotes for strings
- Organize imports automatically with Biome
- TypeScript files only, no plain JavaScript
- Avoid dashes in prose text
- Use `fd` for finding files, `rg` for searching contents

## Important Notes

- This is a Bun project - use `bun` not `npm` or `yarn`
- Biome is configured to only check files in `./agents/**/*`
- The project uses TypeScript with module syntax
- Agents are designed to be compiled to standalone binaries with `bun compile`
- Settings files follow the pattern: `<agent-name>.settings.json` and `<agent-name>.mcp.json`
- Hooks are type-safe TypeScript scripts - see [docs/HOOKS.md](docs/HOOKS.md) for complete guide
