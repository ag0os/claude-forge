# Integration: Herdr

Herdr is a terminal multiplexer for coding agents. It organizes terminals into workspaces, tabs, and panes, recognizes agents running inside panes, and exposes the session through the `herdr` CLI. When available, it is your primary way to run commands in the background and to start and coordinate other agents.

## Availability

```bash
test "${HERDR_ENV:-}" = 1
```

If this fails you are not inside a Herdr managed pane. Do not inspect or control Herdr from outside; the CLI would act on whatever pane the UI has focused, which may belong to the user. Fall back to portable mechanisms.

## Learn the current CLI, then act

The installed binary is the authority on syntax and behavior. Before your first nontrivial control operation of a session, load the full current instructions:

```bash
herdr --skill
```

Read and follow that output; it supersedes anything remembered from training. For quick orientation, `herdr --help` and running a command group without a subcommand (for example `herdr agent`, `herdr pane`) print usage. Do not run bare `herdr`, which launches the TUI, and do not probe mutating commands by omitting arguments.

## Working model

- Pane commands drive raw terminals: run commands, wait for output, read output.
- Agent commands drive a recognized coding agent in a pane: start it, prompt it, wait for `idle`, `done`, or `blocked`, read its screen, send keys.
- Your own pane context is injected as `HERDR_WORKSPACE_ID`, `HERDR_TAB_ID`, `HERDR_PANE_ID`. Prefer `--current` or explicit IDs parsed from JSON responses; never rely on the UI focused pane.
- Default new work to a sibling pane in the current tab, preserving your working directory, split direction chosen from the caller pane's geometry (wide splits right, narrow or tall splits down).

## Rules of engagement

- Use `--no-focus` for background work; keep the user's focus where it is unless they asked to switch.
- Do not close workspaces, tabs, panes, or sessions you did not create unless the user explicitly asks.
- Never run `herdr server stop` and never kill the main Herdr process. Use named test sessions for experiments that need an isolated server.
- Do not create workspaces, tabs, worktrees, or change directories for delegated work unless the user asked for that topology.
- Before running a command or prompting an agent in a pane, check that pane's state first. Input sent to a busy or unready pane arrives as garbage to whatever is running there, and an agent already working needs no second prompt.
- If a wait returns `blocked`, inspect the agent's state and screen before deciding what to send. `unknown` does not prove completion.
- When a long agent response cannot be recovered from scrollback (alternate screen), ask that agent to write its full answer to a file and read the file. Use this as a fallback, not in the initial prompt.
