# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Forge - A collection of TypeScript agents and utilities for enhancing Claude Code CLI functionality with custom configurations, MCP integrations, and specialized workflows.

## Commands

### Development Commands
- `bun install` - Install dependencies
- `bun compile <file>` - Compile TypeScript file to binary in ./bin/
- `bun run compile:all` - Rebuild every agent and prune orphaned binaries (`--dry-run`, `--no-prune`)
- `bun watch` - Watch and auto-compile agents directory
- `bun lint` - Format and fix code with Biome
- `bun format` - Format code with Biome
- `bun check` - Run Biome checks without fixes
- `bun lint:fix` - Apply unsafe fixes with Biome

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

### Agent Namespacing

Agents are namespaced via subdirectories. The directory structure determines the binary name:

| Source Path | Binary Name |
|-------------|-------------|
| `agents/plan/planner.ts` | `plan:planner` |
| `agents/design/diagram/all.ts` | `design:diagram:all` |
| `agents/local/my-agent.ts` | `local:my-agent` |

**Private agents**: Create `agents/local/` for personal agents that won't be committed (gitignored).

### Key Libraries
- `@anthropic-ai/claude-code` - Official Claude Code SDK
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
