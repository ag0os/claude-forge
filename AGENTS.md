# Repository Guidelines

## Project Structure & Module Organization

- `agents/` — TypeScript agent launchers (one file per agent).
- `lib/` — Shared utilities and the backend runtime (`lib/runtime`).
- `forge/` — Historical plans (`forge/plans/`).
- `settings/`, `system-prompts/`, `prompts/` — Agent settings and prompt templates.
- `scripts/` — Build/watch utilities.
- `bin/` — Generated binaries (do not edit manually).
- `docs/`, `ai/` — Documentation and generated artifacts.

## Build, Test, and Development Commands

- `bun install` — Install dependencies.
- `bun run watch` — Watch and auto-compile agents into `bin/`.
- `bun run compile:all` — Rebuild every agent into `bin/` and prune orphaned binaries.
- `bun run lint` / `bun run format` — Lint and format with Biome.
- `bun run check` / `bun run typecheck` — Static analysis and TypeScript checks.
- `bun test` — Run all tests.

## Coding Style & Naming Conventions

- TypeScript (ESM) with Biome formatting: tabs for indentation and double quotes.
- Never use default exports.
- Keep filenames in `kebab-case.ts`; tests use `*.test.ts`.
- Agent files in `agents/` should match settings files:
  - `agents/my-agent.ts`
  - `settings/my-agent.settings.json` (optional)
  - `settings/my-agent.mcp.json` (optional)

## Testing Guidelines

- Test runner: `bun test`.
- Tests live next to the code they cover (e.g., `lib/runtime/*.test.ts`, `agents/tools/webfetch.test.ts`).
- Add or update tests for behavior changes; no explicit coverage target is enforced.

## Commit & Pull Request Guidelines

- Commit subjects are typically imperative and concise (e.g., “Add …”, “Fix …”).
- Keep commits focused.
- PRs should include a brief summary, verification notes (commands run), and links to related docs.

## Security & Configuration Notes

- Store secrets in environment variables (e.g., API keys and tokens); never commit credentials.
- Agent behavior is controlled via `settings/`, `system-prompts/`, and `prompts/`; update those alongside agent code when necessary.
