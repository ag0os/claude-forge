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
| Workspace integrations | `.shepherd/integrations/*.md` in the launch directory | no, read at launch |
| Session context header | generated (cwd, state dir, date, backend, loaded modules) | no |

Every integration module is self gated: it declares how to detect availability (for example `HERDR_ENV=1`, or the presence of messaging tools) and Shepherd skips the capability cleanly when the check fails. That is what keeps the prompt harness agnostic.

## Extending Shepherd

- **Framework wide**: add a module to `system-prompts/shepherd/integrations/`, import it in `agents/shepherd.ts`, add it to `BUILT_IN_INTEGRATIONS`, recompile.
- **Per workspace**: drop a `*.md` module into `.shepherd/integrations/` in that directory. Loaded on next launch, no recompile. Local modules are appended after built ins and may extend or override them.

## Workspace state

Shepherd maintains `.shepherd/` in the launch directory:

```
.shepherd/
  MEMORY.md          # index: one line per memory
  memories/          # one fact per file (frontmatter: name, description, type)
  journal.md         # append only session log and handoff
  docs/              # runbooks, environment notes, agent rosters
  integrations/      # workspace local capability modules
```

The launcher pre approves Read/Write/Edit inside `.shepherd/` and `Bash(herdr:*)` so memory upkeep and Herdr coordination never prompt; destructive Herdr operations are forbidden by the integration module instead. Everything else follows normal permission rules.

## Backends

Shepherd spawns through `lib/runtime` (see [AGENT-RUNTIME.md](AGENT-RUNTIME.md)). Default is `claude-cli`; `codex-cli` supports interactive sessions with the system prompt prepended; `codex-sdk` falls back to print mode. Claude specific options (settings, MCP config, flag passthrough) are only sent to `claude-cli`.
