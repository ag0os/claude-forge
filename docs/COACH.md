# Coach — one dynamic tutor, many subject packs

`tutors:coach` replaces eight separate tutor binaries with one that composes
its system prompt from three layers at launch. Adding a subject is one file.

## Usage

```bash
tutors:coach                       # coordinator — set up, plan, or pick today's session
tutors:coach rails                 # open the Rails coach
tutors:coach coding "ts drill"     # open with an initial message
tutors:coach --list                # print the roster and exit
tutors:coach rails --cwd ~/prep    # train against a fixed root from anywhere
tutors:coach rails --show-prompt   # print the composed prompt, don't spawn
```

`--cwd` and `--list`/`--show-prompt` are consumed here; any other flag passes
straight through to the Claude CLI — `--model`, `--resume`, and so on.

## Setting up for interviews

The coordinator's main job. Run `tutors:coach` in (or `--cwd` at) the
directory you want as your training root, and tell it what's coming:

> *"I've got a senior full-stack loop at two companies in about five weeks —
> coding screen, system design, and behavioral. Set me up."*

It runs a five-step setup: pin down the target and dates → map each interview
round to a subject → **offer to build coaches for anything the roster doesn't
cover** → scaffold a brief per subject → write the plan and print the launch
commands. It stops there; you run the commands.

What it produces:

```
~/prep/
  .coach/
    plan.md                  # target, dates, rounds → subjects, weekly shape
    packs/graphql.md         # any coach it built for you during setup
    coding/brief.md          # ← coordinator writes
    system-design/brief.md
    graphql/brief.md
```

### The brief contract

`brief.md` is how campaign context reaches a subject without breaking the
layering. The coordinator writes it; the subject coach reads it at **Step 0**
of startup and uses it to shape intake — skipping questions it already
answers, biasing the bank toward the surfaces it names, and carrying the
target and date into `program.md`.

The coordinator does **not** write `program.md` or `progress.md`. Those stay
owned by the subject coach, which still runs its own intake for the
self-ratings — just a shorter, better-targeted one. It never starts generic.

The crossing goes one way. The coordinator writes briefs; it does not read
progress files, so its rotation advice still comes from asking you rather than
from reading state. If you'd rather it read progress and reason about coverage
from actual dates, that's a one-line change to its "what you don't do" list.

## Architecture

Every session composes:

| Layer | File | Carries |
| ----- | ---- | ------- |
| Student | `system-prompts/coach/student.md` | Who is being coached. Single source of truth. |
| Core | `system-prompts/coach/core.md` | How coaching works — mode archetypes, session state, program/progress format, the debrief, pressure and AI-reach rules, tone. |
| Roster | generated at launch | Every installed subject, so a coach knows its siblings. |
| Pack | `system-prompts/coach/packs/<slug>.md` | What this subject is — stance, axis, banks, seeds, signals. |

With no subject, the coordinator prompt replaces core + pack: it plans and
routes, it does not teach, so it has no use for the coaching machinery.

### Why it is split this way

The eight original tutors were ~50% identical: the same student profile copied
eight times, the same startup flow, the same progress format, the same
pressure rules, the same tone section. Only the problem bank, the theory
seeds, and one domain rubric axis actually differed. Core holds the shared
half; a pack holds the half that varies.

The mode names differed too, but the archetypes did not — `challenge`,
`drill`, `kata`, and `lesson` are all *produce something cold*. Core defines
five archetypes (Produce, Critique, Explain, Discuss, Simulate); each pack
enables a subset and names them for its subject.

## Session state

Each subject owns `.coach/<slug>/` — `brief.md` (optional, from the
coordinator), `program.md`, and `progress.md`. The namespace matters: the old
tutors all wrote `.coach/program.md`, so two subjects run in one directory
would clobber each other. Now one training root can host every subject at
once.

Subjects that build a real project are the exception and want their own
directory — `ts-react` in standalone mode builds a full-stack app, and in
Codeflow mode it must run inside the Codeflow repo. Because state is
per-directory, you can keep independent `ts-react` programs in both.

## Writing a pack

Drop a markdown file with frontmatter into `system-prompts/coach/packs/`
(shipped, requires recompile) or `.coach/packs/` in a project (local, picked
up at runtime; wins on slug collision).

```markdown
---
slug: go-concurrency          # must match the filename
name: Go Concurrency
scope: Goroutines, channels, sync primitives — not general Go syntax
session: 30 min · drill / theory
allow: WebFetch, WebSearch    # optional — extra auto-approved tools
---

# Pack — Go Concurrency

**Stance:** beginner-to-stack

**Modes:** Produce → `drill` · Explain → `theory`

**Axis:** Does this leak a goroutine or race? Ask them to name the
synchronization guarantee before you say anything.

## Focus areas
## Intake        (optional — extra first-session questions)
## Bank          (what to draw problems from)
## Seeds         (concept list for Explain mode)
## Signals       (subject-specific dated logs for progress.md)
## Environment   (optional — repo/tooling contract)
```

Frontmatter is flat `key: value` only — deliberately not YAML.

**The Axis is the field that matters most.** It is the one domain check that
runs in every single debrief and never gets skipped: Big O for coding, the
query plan for data modeling, the red–green–refactor rhythm for testing, Rails
idiom for Rails. Write it as the question you ask the student, not as a topic.

**Stance** picks how much you explain: `peer-refresher` (rusty expert, jog the
memory), `beginner-to-stack` (new to this technology, not to engineering), or
`practitioner-sharpening` (competent, training judgment). A subject with
tracks can name one per track.

Keep a pack to one screen of prose plus its banks. Anything about *how*
coaching works belongs in core, not in a pack.

The coordinator can also author a pack interactively — ask it for a coach on
something the roster doesn't cover and it will interview you and write the
file to `.coach/packs/`.

## Subjects that are not packs

Two coaches keep their own binaries, because they are not pack-shaped:

- **`tutors:star`** — behavioral interview prep. No program file, no progress
  tracking, no modes. It interrogates raw experience into STAR stories and
  tracks coverage over behavior categories.
- **`tutors:cca-coach`** — CCA-F exam prep. Almost entirely domain knowledge:
  exam blueprint, verified-mechanics drift, distractor archetypes, and a real
  scored diagnostic. The pedagogy is a thin layer on top.

Both appear on the generated roster so the coordinator can route to them.
