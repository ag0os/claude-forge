# Repository Guidelines

## Project Structure & Module Organization

- `agents/` — TypeScript agent launchers (one file per agent).
- `cli/` — CLI entrypoints (e.g., `forge`, `orchestra`, `parallel`).
- `lib/` — Shared utilities and orchestration logic.
- `forge-tasks/` — Task system (core logic + tests).
- `forge/` — Task files and orchestration configs (e.g., `chains.json`).
- `settings/`, `system-prompts/`, `prompts/` — Agent settings and prompt templates.
- `scripts/` — Build/watch utilities.
- `bin/` — Generated binaries (do not edit manually).
- `docs/`, `ai/` — Documentation and generated artifacts.

## Build, Test, and Development Commands

- `bun install` — Install dependencies.
- `bun run watch` — Watch and auto-compile agents into `bin/`.
- `bun run compile:forge` / `bun run compile:orchestra` / `bun run compile:parallel` / `bun run compile:forge-tasks` — Build specific CLIs.
- `bun run lint` / `bun run format` — Lint and format with Biome.
- `bun run check` / `bun run typecheck` — Static analysis and TypeScript checks.
- `bun run test:forge-tasks` — Run forge-tasks tests.
- `bun test lib/orchestra` — Run orchestration tests directly with Bun.

## Coding Style & Naming Conventions

- TypeScript (ESM) with Biome formatting: tabs for indentation and double quotes.
- Keep filenames in `kebab-case.ts`; tests use `*.test.ts`.
- Agent files in `agents/` should match settings files:
  - `agents/my-agent.ts`
  - `settings/my-agent.settings.json` (optional)
  - `settings/my-agent.mcp.json` (optional)

## Testing Guidelines

- Test runner: `bun test`.
- Tests live under `lib/orchestra/*.test.ts` and `forge-tasks/**.test.ts`.
- Add or update tests for behavior changes; no explicit coverage target is enforced.

## Commit & Pull Request Guidelines

- Commit subjects are typically imperative and concise (e.g., “Add …”, “Fix …”).
- Many commits use a task prefix like `TASK-034: …` when tied to a work item.
- Keep commits focused; include relevant task IDs when available.
- PRs should include a brief summary, verification notes (commands run), and links to related tasks or docs (e.g., `forge/tasks/...`).

## Security & Configuration Notes

- Store secrets in environment variables (e.g., `GEMINI_API_KEY`); never commit credentials.
- Agent behavior is controlled via `settings/`, `system-prompts/`, and `prompts/`; update those alongside agent code when necessary.
