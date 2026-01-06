# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Workshop Live - A collection of TypeScript agents and utilities for enhancing Claude Code CLI functionality with custom configurations, MCP integrations, and specialized workflows.

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