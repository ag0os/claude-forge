# Shepherd

Shepherd is a personal day to day assistant and agent coordinator. It runs in any directory, helps with routine work, coordinates terminal sessions and other coding agents (through Herdr when available), talks to co sessions over inter agent messaging when the harness supports it, and keeps persistent state in the launch directory so it improves at a workspace over time.

## Usage

```bash
shepherd                          # interactive session in the current directory
shepherd "triage my morning"      # with an initial message
shepherd --cwd ~/work             # run against another root
shepherd --backend codex-cli      # different harness (or FORGE_BACKEND env)
shepherd --print "status report"  # one-shot, non-interactive
shepherd --show-prompt            # print the composed prompt, don't spawn
```

Source: `agents/shepherd.ts` (flat, so the binary is plain `shepherd`). Rebuild with `bun compile agents/shepherd.ts` or `bun run compile:all`.

Remaining CLI flags pass through to the backend on `claude-cli` (for example `--resume`, `--permission-mode`). `--model` maps through the runtime abstraction and works on every backend that supports model selection.

## Prompt composition

The session prompt is layered, in order:

| Layer | Source | Baked in |
|-------|--------|----------|
| Core | `system-prompts/shepherd/core.md` | yes |
| Built in integrations | `system-prompts/shepherd/integrations/*.md` | yes |
| Workspace charter | `.shepherd/charter.md` in the launch directory | no, read at launch |
| Workspace integrations | `.shepherd/integrations/*.md` in the launch directory | no, read at launch |
| Session context header | generated (cwd, state dir, date, backend, charter status, loaded modules) | no |

Every integration module is self gated: it declares how to detect availability (for example `HERDR_ENV=1`, or the presence of messaging tools) and Shepherd skips the capability cleanly when the check fails. That is what keeps the prompt harness agnostic.

## Init and the charter

A fresh workspace is deliberately generic. On first launch Shepherd runs an init conversation with the user to agree the mission, the way of working, the toolset (for example cosmonauts, gh, project tooling), and any structure the workspace needs, then records the agreement as `.shepherd/charter.md`. The charter loads into every session and is the contract; renegotiate it rather than drift from it. A workspace can be any shape: one project, several, a coordinator of coordinators, internet chores.

## Self evolution

Shepherd improves its own operating instructions over time, gated by agreement rather than capability:

- Memories, journal, and docs are written freely.
- Changes to `charter.md` or `.shepherd/integrations/*.md` are proposed first and applied once the user agrees, with the reason journaled.
- Ways of working that prove out across workspaces get promoted into the base (below) with the user's agreement. Promoted modules must stay self gated and free of workspace specifics.

## Extending Shepherd

- **Framework wide**: add a module to `system-prompts/shepherd/integrations/`, import it in `agents/shepherd.ts`, add it to `BUILT_IN_INTEGRATIONS`, recompile.
- **Per workspace**: drop a `*.md` module into `.shepherd/integrations/` in that directory, or let Shepherd write one during init. Loaded on next launch, no recompile. The charter and local modules are appended after built ins and may extend or override them.

## Workspace state

Shepherd maintains `.shepherd/` in the launch directory:

```
.shepherd/
  charter.md         # agreed mission and way of working, written at init
  MEMORY.md          # index: one line per memory
  memories/          # one fact per file (frontmatter: name, description, type)
  journal.md         # append only session log and handoff
  docs/              # runbooks, environment notes, agent rosters
  integrations/      # workspace local capability modules
```

The launcher pre approves Read/Write/Edit inside `.shepherd/` and `Bash(herdr:*)` so memory upkeep and Herdr coordination never prompt; destructive Herdr operations are forbidden by the integration module instead. Everything else follows normal permission rules.

## Backends

Shepherd spawns through `lib/runtime` (see [AGENT-RUNTIME.md](AGENT-RUNTIME.md)). Default is `claude-cli`. Claude specific options (settings, MCP config, flag passthrough) are only sent to `claude-cli`.

On `codex-cli` the launcher writes the composed prompt to `AGENTS.md` in the launch directory (marker guarded, rewritten every launch, never clobbers a foreign AGENTS.md), because codex 0.155+ ignores the `base_instructions` config override the runtime layer uses. Codex also refuses non trusted directories in exec mode, so `git init` the workspace or expect its trust prompt interactively. `codex-sdk` falls back to print mode. Note the runtime level `base_instructions` breakage still affects other agents that pass a system prompt to the codex backend; only shepherd carries the AGENTS.md workaround so far.
