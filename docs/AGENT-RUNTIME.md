# Agent Runtime Abstraction (Pre-Codex Integration)

## Purpose

We want a unified, backend-agnostic API for running agents so we can integrate Codex CLI now (and Codex SDK or other tools later) without rewriting every agent.

Today, compiled agents are tightly coupled to the Claude CLI. This document proposes a minimal abstraction layer that keeps current behavior stable while allowing backend selection at runtime.

## Goals

- Provide a single runtime API for running agents with different backends.
- Keep existing Claude CLI behavior as the default (no regressions).
- Support both interactive and non-interactive/print modes.
- Make backend choice explicit and configurable at runtime.
- Keep the changes incremental and low-risk.

## Non-Goals

- Rewriting all agent logic or prompts.
- Forcing a one-size-fits-all flag mapping across backends.

## Current State (Summary)

- Compiled agents import `spawnClaudeAndWait` and `buildClaudeFlags`, hardcoding Claude CLI.

## Proposed Abstractions

### 1) Agent Runtime Interface

Create a small runtime interface used by compiled agents.

**Intentional shape (example):**

- `isAvailable(): Promise<boolean>`
- `runOnce(options): Promise<{ exitCode: number; output?: string; structured?: object[] }>`
- `runStreaming(options, callbacks): Promise<{ exitCode: number; structured?: object[] }>`
- `runInteractive(options): Promise<{ exitCode: number }>`

Key idea: backends implement the interface; callers do not hardcode the backend. If a backend does not support interactive or streaming, it should fail fast with a clear error and capability hints.

### 2) Backend Registry

Add a registry or simple switch that maps `backend` to a concrete runner:

- `claude-cli` (existing behavior)
- `codex-cli` (new, primary Codex target)
- optional future: `codex-sdk`, `gemini-cli`, etc.

### 3) Unified Options Shape

Define a backend-agnostic options object that includes the common denominator of what we need:

- `prompt` (positional or inline text)
- `systemPrompt`
- `cwd`
- `env`
- `model`
- `maxTurns`
- `tools` (allowed/disallowed)
- `settings` / `mcpConfig`
- `mode` (interactive | print)
- `providerOptions` (backend-specific config)
- `rawArgs` (CLI-only escape hatch)

Each backend can map or ignore unsupported fields explicitly. `providerOptions` is preferred for backend-specific features; `rawArgs` is only for CLI backends.

## CLI and Config Surface

### Compiled Agents

- Add a new `--backend` flag (and `FORGE_BACKEND` env fallback).
- Default to `claude-cli` to preserve current behavior.
- Continue to accept existing Claude flags, but translate them into the unified options where possible.
- Warn (or error) when Claude-specific flags are provided with non-Claude backends.

## Implementation Ideas

### Phase 1: Internal Runtime Abstraction

- Extract Claude CLI logic into `lib/agent-runtime/claude-cli.ts`.
- Implement the runtime interface and preserve current stdout streaming behavior.
- Keep binary agent path unchanged at this stage.

### Phase 2: Compiled Agents on the Runtime

- Add `lib/agent-runtime/index.ts` with `spawnAgentAndWait`.
- Update compiled agents to call the runtime abstraction instead of `spawnClaudeAndWait`.
- Add `--backend` to shared flag parsing.

### Phase 3a: Codex CLI Runner

- Add `lib/agent-runtime/codex-cli.ts` that shells out to `codex`.
- Map print mode to `codex exec`.
- Map interactive mode to `codex` with inherited stdio.
- Add optional JSON output mode if it improves structured parsing.

### Phase 3b: Codex SDK Runner (Optional)

- Add `lib/agent-runtime/codex-sdk.ts` using `@openai/codex-sdk`.
- Support non-interactive runs only unless we explicitly build a REPL.

## Mapping Notes (Claude CLI -> Codex CLI/SDK)

- `--print` in Claude maps to `codex exec` (non-interactive).
- System prompt injection:
  - Claude CLI: `--append-system-prompt`
  - Codex CLI/SDK: no direct equivalent, so prepend to the user prompt as a fallback.
- `--dangerously-skip-permissions` has no direct match; Codex approval mode must be set separately.
- `settings` and `mcpConfig` do not map 1:1 (Codex uses its own persistent config).
- Tool allow/deny lists are backend-specific; document supported subsets and ignored options.

## MCP Handling

- Claude: supports per-run `--mcp-config`.
- Codex: MCP configuration is persistent via `codex mcp` or config files.
- Conclusion: treat MCP as a Claude-first feature for now and document that Codex requires preconfigured MCP servers.

## Capabilities and Unsupported Features

Each backend should declare capabilities (for example: supportsInteractive, supportsStreaming, supportsSystemPrompt). Runners should fail fast with a clear error if unsupported features are requested.

## Risks and Decisions

- **Flag incompatibility:** Not all flags map across backends; the runtime must be explicit about ignored options.
- **Streaming availability:** Codex CLI/SDK output modes might differ; use explicit output modes in runners.
- **Behavioral drift:** Keep Claude CLI as default so existing workflows stay stable.

## Future Extensions

- Add additional backends (Gemini CLI, local LLM) without rewriting agent code.
- Allow per-agent backend overrides.

## Testing Strategy

- Unit-test the runtime abstraction with mock runners.
- Add integration tests gated by environment variables for installed backends.

## Error Handling

- `isAvailable()` should check for missing binaries or SDK credentials.
- Fail with explicit, actionable errors when a backend is not installed or misconfigured.
- Avoid silent fallbacks unless explicitly requested.

## Logging and Debugging

- Add a verbose mode to log the selected backend and key options.
- Log the exact command or SDK call only in verbose/debug mode.
- Surface backend capability mismatches clearly.

## Definition of Done

- Compiled agents support `--backend` and route through the runtime.
- Claude CLI remains the default backend and behaves exactly as before.
- Codex CLI can be selected for compiled agents.
