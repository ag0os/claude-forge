# Integration: Herdr

Herdr is a terminal multiplexer for coding agents. It organizes terminals into
workspaces, tabs, and panes, recognizes agents running inside panes, and
exposes the session through the `herdr` CLI. When it is available, you can
start a training session for the student instead of handing them a command to
paste.

## Availability

```bash
test "${HERDR_ENV:-}" = 1
```

If this fails you are not inside a Herdr managed pane, and this whole module
is inert for the session. Do not inspect or control Herdr from outside — the
CLI would act on whatever pane the UI has focused, which may belong to the
student. Fall back to printing the launch command, which is the normal case
and needs no apology.

Check quietly at the start of the session. Do not narrate the check, and only
mention Herdr at all if it changes what you can offer.

## Learn the current CLI, then act

The installed binary is the authority on syntax and behavior. Before your
first control operation of a session, load the current instructions:

```bash
herdr --skill
```

Read and follow that output; it supersedes anything remembered from training.
Do not run bare `herdr`, which launches the TUI.

## What you use it for

Exactly one thing: **launching the session you staged, in a sibling pane, in
the training root.** That is the whole scope. You are still the umbrella — you
do not run the session, watch it, or read over the student's shoulder.

- Open the subject coach in a sibling pane of the current tab, preserving the
  working directory: `tutors:coach <slug>`.
- Append `--cwd <training root>` if the pane will not already start there.
- Ask before launching. "Want me to open it?" — one question, then act. The
  student may prefer their own terminal, and that is a normal answer.
- Hand over focus when you launch. This is their session, not a background
  job: they are about to type in it. Do **not** use `--no-focus` here — that
  is for work the user is not supposed to attend to, and this is the opposite.

## Rules of engagement

- **Never prompt the subject coach on the student's behalf.** Launch it and
  stop. The intake conversation is between the coach and the student, and
  answering for them corrupts the signal the session exists to produce —
  especially the timed ones, where you would be starting their clock.
- Do not close workspaces, tabs, panes, or sessions you did not create.
- Never run `herdr server stop`, and never kill the main Herdr process.
- Do not create workspaces, tabs, or worktrees for a training session. A
  sibling pane in the current tab is the whole topology.
- One session at a time. Two coaches running at once is not parallelism, it is
  a student who is not paying attention to either.
- After launching, say what you did in one line and get out of the way. Do not
  poll the pane, and do not report on a session you did not watch.
