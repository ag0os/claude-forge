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

### Agent Commands
- `bun run agents/contain.ts` - Launch Claude with contained settings
- `bun run agents/planner.ts` - Launch Claude in planning mode
- `bun run agents/gemsum.ts` - Gemini-powered summarization
- `bun run agents/claude-mix.ts` - Claude with mixed capabilities
- `bun run agents/parallel.ts` - Run parallel operations
- `bun run agents/designer.ts` - Design mode with Figma/Chrome DevTools integrations
- `bun run agents/chain.ts` - Chain multiple Claude instances with data flow
- `bun run agents/rails-backlog.ts` - Rails Backlog Task Coordinator - analyze backlog tasks and coordinate specialized Rails sub-agents
- `bun run agents/plan-coordinator.ts` - Implementation Plan Coordinator - coordinate sub-agents to implement a plan step by step
- `bun run agents/tdd-coordinator.ts` - TDD Coordinator - orchestrate Red-Green-Refactor cycles with human-in-the-loop checkpoints
- `bun run agents/riff.ts` - Design exploration through pseudo-code dialogue (language-agnostic)

### Forge-Tasks Agent Commands
- `bun run agents/forge-task-manager.ts` - Planning: digest plans/requirements into tasks with labels
- `bun run agents/forge-task-coordinator.ts` - Execution: coordinate sub-agents to implement tasks
- `bun run agents/forge-task-worker.ts` - Implementation: work on a single task, update ACs

### Forkhestra Commands
- `bun run agents/forkhestra.ts` - Orchestrate agent chains (see Forkhestra section below)

## Code Architecture

### Directory Structure
- `agents/` - Standalone TypeScript scripts that spawn Claude CLI with specific configurations
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

Agents support namespacing via subdirectories. The directory structure determines the binary name:

| Source Path | Binary Name |
|-------------|-------------|
| `agents/planner.ts` | `planner` |
| `agents/forge-tasks/manager.ts` | `forge-tasks:manager` |
| `agents/deep/nested/agent.ts` | `deep:nested:agent` |

**Private agents**: Create `agents/local/` for personal agents that won't be committed (gitignored). Example: `agents/local/my-agent.ts` compiles to `local:my-agent`.

**Usage with forkhestra**:
```bash
forkhestra "forge-tasks:manager -> forge-tasks:coordinator:10"
```

## Forkhestra - Agent Orchestration

Forkhestra provides two modes for orchestrating agents:
- **Pipeline mode**: Run agents once each, in sequence
- **Loop mode**: Run agents repeatedly until they output `FORKHESTRA_COMPLETE` or hit max iterations

### CLI Usage

```bash
# Pipeline mode - run agents once each
forkhestra "task-manager -> task-coordinator"

# Loop mode - single agent with max iterations
forkhestra task-coordinator:10

# Chain mode with iterations
forkhestra "task-manager:3 -> task-coordinator:10"

# Config mode - named chains
forkhestra --chain plan-and-build
forkhestra --chain single-task TASK_ID=TASK-001

# With prompts - pass instructions to agents
forkhestra task-coordinator:10 -p "Focus on TASK-001"
forkhestra --chain build --prompt "Implement the login feature"
forkhestra agent:5 --prompt-file prompts/instructions.md

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

### Configuration (forge/chains.json)

```json
{
  "agents": {
    "task-manager": {
      "defaultPrompt": "Create tasks from current requirements"
    }
  },
  "chains": {
    "chain-name": {
      "description": "What this chain does",
      "prompt": "Chain-level prompt for all steps",
      "steps": [
        { "agent": "agent-name" },
        { "agent": "agent-name", "iterations": 10 },
        { "agent": "agent-name", "args": ["--task", "${TASK_ID}"] },
        { "agent": "agent-name", "prompt": "Step-specific prompt override" },
        { "agent": "agent-name", "promptFile": "prompts/instructions.md" }
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

Agents participating in forkhestra loops must output `FORKHESTRA_COMPLETE` on its own line when done. The orchestrator watches stdout and stops looping when it sees this marker.

### Key Libraries
- `@anthropic-ai/claude-code` - Official Claude Code SDK
- `@anthropic-ai/sdk` - Anthropic API client
- `bun` - Runtime and package manager
- `biome` - Code formatter and linter

### Core Patterns
- Agents use `spawn()` to launch Claude CLI with custom settings
- Settings and MCP configs are stored as JSON in `settings/`
- Use `resolvePath()` pattern for resolving relative paths in agents
- Pass environment variables like `CLAUDE_PROJECT_DIR` to spawned processes
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