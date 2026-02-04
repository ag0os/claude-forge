# Implementation Plan: Agent Runtime Abstraction + Codex CLI

## Goal

Introduce a backend-agnostic runtime for agent execution, migrate orchestra direct-spawn and compiled agents to use it, and add a Codex CLI backend (non-interactive + interactive). Keep Claude CLI as default with zero regressions.

## Scope

- Add runtime abstraction and backend registry.
- Migrate orchestra direct-spawn path to runtime abstraction.
- Add `--backend` and `FORGE_BACKEND` support to compiled agents.
- Implement Codex CLI backend (non-interactive + interactive).
- Add capability checks, error handling, and minimal tests.

## Non-Goals

- Implement Codex SDK (follow-on phase).
- Build a custom REPL for SDK interactive mode.
- Change completion marker contract.

## Phase 0: Prep (Design and Interfaces)

1) Define runtime interfaces and options

- Add `lib/runtime/types.ts` with:
  - `AgentRuntime` interface
  - `RuntimeCapabilities`
  - `RunOptions`, `RunResult`, `StreamCallbacks`
  - `RuntimeBackend` union type
- Include fields discussed in design doc:
  - `prompt`, `systemPrompt`, `cwd`, `env`, `model`, `maxTurns`
  - `tools` (allowed/disallowed)
  - `settings`, `mcpConfig`
  - `mode` (`interactive` | `print`)
  - `providerOptions` (backend-specific)
  - `rawArgs` (CLI-only escape hatch)

2) Add runtime registry

- Add `lib/runtime/index.ts` with:
  - `getRuntime(backend)`
  - `runAgentOnce(...)`, `runAgentStreaming(...)`, `runAgentInteractive(...)`
  - `resolveBackend()` (from CLI flag or `FORGE_BACKEND`)

Acceptance Criteria

- Type definitions compile with no usage yet.
- No behavior changes in existing flows.

## Phase 1: Claude CLI Runtime + Orchestra Migration

1) Implement Claude CLI runtime

- Add `lib/runtime/claude-cli.ts`
- Wrap existing Claude spawn logic (use `spawnClaude`, `buildClaudeFlags`)
- Preserve current stdout streaming marker detection
- Implement capability flags

2) Update orchestra direct-spawn to use runtime

- Refactor `lib/orchestra/runner.ts`:
  - Replace direct `claude` spawning with runtime calls
  - Keep existing loop and marker detection behavior
- Add backend selection via `AgentConfig.backend` (default `claude-cli`)

Acceptance Criteria

- Orchestra direct-spawn works exactly as before using Claude CLI.
- Existing tests pass.

## Phase 2: Compiled Agents -> Runtime

1) Add `--backend` parsing

- Update `lib/flags.ts` (or shared arg parsing) to include `--backend`
- Add `FORGE_BACKEND` env fallback
- Warn when Claude-specific flags are used with non-Claude backends

2) Update compiled agents

- Replace direct `spawnClaudeAndWait` calls with `runAgentOnce` or `runAgentInteractive` depending on mode
- Ensure `--print` maps to `mode: print` and inherited stdio maps to `mode: interactive`

Acceptance Criteria

- Agents continue to work with no flags (default Claude CLI).
- `--backend claude-cli` is no-op relative to default.

## Phase 3a: Codex CLI Runtime

1) Implement Codex CLI runtime

- Add `lib/runtime/codex-cli.ts`
- Non-interactive:
  - Map `mode: print` to `codex exec` with prompt
  - Collect stdout for marker detection
- Interactive:
  - Map `mode: interactive` to `codex` with inherited stdio
- System prompt injection:
  - Prepend to user prompt if no native support
- MCP handling:
  - Document as unsupported/ignored; require preconfigured MCP

2) Add backend capability checks

- `isAvailable()` checks for `codex` binary
- Fail fast with actionable error messages

Acceptance Criteria

- `--backend codex-cli` works in print mode.
- Interactive mode works via Codex CLI with inherited stdio.
- Marker detection works for print mode.

## Phase 3b: Optional Codex SDK (Future)

- Add `lib/runtime/codex-sdk.ts`
- Support non-interactive runs only (no REPL)
- Defer until Codex CLI integration is stable

## Testing Strategy

- Unit tests for runtime registry and capability checks (mock backends)
- Integration tests gated by env:
  - Claude CLI presence
  - Codex CLI presence (if installed)
- Reuse existing orchestra tests for completion marker detection

## Error Handling and Logging

- Add verbose debug logs for backend selection and commands
- Standardize error messages on missing backend binaries
- Avoid silent fallback to other backends

## Migration Risks & Mitigations

- Flag incompatibility: warn when unsupported options are used for selected backend
- Output format differences: force consistent output for marker detection
- Behavioral drift: keep Claude CLI as default everywhere

## Definition of Done

- Runtime abstraction in place and used by orchestra direct-spawn
- Compiled agents support `--backend` with `FORGE_BACKEND` fallback
- Codex CLI backend works for print and interactive modes
- All existing workflows remain stable with Claude CLI default

