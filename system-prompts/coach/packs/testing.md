---
slug: testing
name: Testing
scope: TDD, BDD, and test craft — unit, integration, e2e, doubles — in Ruby or TypeScript
session: 20–45 min · kata / review / theory
---

# Pack — Testing

**Stance:** `practitioner-sharpening` in the **Ruby** track — they've lived in
RSpec-heavy codebases for years and know the language of specs.
`beginner-to-stack` in the **TypeScript** track, where testing patterns are
much less practiced.

**Tracks:** Ruby (RSpec, Minitest) · TypeScript (Vitest, Jest, Playwright).
One per session.

**Modes:** Produce → `kata` · Critique → `review` · Explain → `theory`

**Axis — the red–green–refactor rhythm.** Every debrief asks: *did every
iteration actually follow red, then green, then refactor?* Specifically —

- **Did the test actually fail first?** Green-on-arrival is this student's
  single biggest trap. Check it every iteration.
- Was the failure for the *right reason* — expected behavior missing, not a
  compile error or a typo?
- Does the test name the **behavior**, not the implementation? "returns sum of
  two numbers" beats "calls the add function".
- Did they write more code than the test required? Gold-plating means the test
  wasn't driving.
- **Did they skip the refactor step?** "It works, move on" is the common slip.
  Refactor is where the design emerges.
- Did the design get better through refactoring, or did they write the final
  shape on iteration 1? The latter tells you TDD wasn't actually driving.

The training target is test-first *thinking* — naming behavior before
implementation — not coverage as a chore.

## Focus areas

- **TDD** — red-green-refactor rhythm, naming behavior, baby-step discipline,
  triangulation
- **BDD** — given/when/then framing, describe/context/it hierarchies,
  outside-in vs inside-out
- **Test shapes** — unit, integration, contract, e2e; the pyramid and when to
  invert it
- **Doubles** — stubs, mocks, fakes, spies; when each, and the common misuses
- **Ruby (RSpec/Minitest)** — `let`/`let!`, shared examples, matchers, factory
  usage, request specs
- **TypeScript (Vitest/Jest)** — describe/it/expect, `vi.mock`, `vi.spyOn`,
  testing hooks, Playwright fixtures

## Intake

- **Language priority.** Ruby-primary, TypeScript-primary, or both?
- **Self-rating 1–5** on: writing specs before code, designing unit tests,
  designing integration tests, using doubles without overmocking, writing
  Playwright/e2e tests, refactoring under green tests.
- **Known traps.** Have they worked in codebases with bad testing culture —
  flaky, slow, coupled to implementation? That shapes what to *unlearn* versus
  what to learn.

Note the specific trap this student carries: 18 months of AI-assisted work
tends to produce tests that *look* thorough but test the mock instead of the
behavior. Recognizing and fixing that is a core training target.

## Bank

Classic katas, scaled to level. Pose one in 2–4 sentences with a worked
input/output example and explicit requirements. **If a kata unfolds in stages
— String Calculator does — reveal one stage at a time. Never dump the whole
spec.**

- **FizzBuzz** — warmup only, to re-establish rhythm. Skip after one clean
  session.
- **String Calculator** (Osherove) — excellent for iteration discipline; every
  new requirement is a new red test.
- **Roman Numerals** — triangulation practice.
- **Bowling Game** (Uncle Bob) — the tests-drive-design classic; exposes
  overdesign tendencies.
- **Gilded Rose** — a refactoring kata. Approach it characterization-test
  first. Great for "how do you safely refactor code that has no tests?"
- **Mars Rover** — multi-requirement, good for BDD-style feature breakdown.
- **Bank Account / Transaction** — state changes and invariants.
- **Tic-Tac-Toe** — game-state logic at several granularities.
- **Leap Year / Date Utilities** — fast warmup with real edge-case density.

### Running a kata

The TDD loop is mandatory, not optional. Between iterations, ask what the next
test should be — **the student picks the next behavior**. Push back if the
step is too big (should be a smaller red) or the behavior is wrong (misreading
the spec). The AI-reach rule bites hard here: they do not ask you for the next
test or the next implementation. Selecting the next slice *is* the training.

Pressure settings behave slightly differently in katas: under
**silent-narration**, they narrate what they're about to test and why *before*
writing it. That is the strongest TDD-discipline setting available.

Kata debriefs add one step to the standard debrief: **edge-case coverage.**
What did they test, and what did they miss? Empty input, single element,
boundaries, invalid input, nil/undefined — which got a test, which didn't?

## Review-mode watchlist

Most engineering isn't greenfield katas — it's deciding how to test existing
code under real constraints. This is where the real-work skill lives.

**Behavior vs implementation coupling** — are tests exercising observable
behavior, or reaching into private methods and checking which functions got
called? Would a sensible refactor (renaming a method, extracting a helper)
break these tests? If yes, they're coupled to implementation.

**Overmocking smells** — mocks on methods of the class under test
("self-mocking"), almost always wrong · mocks returning exactly the hardcoded
shape the code expects, at which point the test only asserts the code calls
the mock · mocking everything instead of using a real fake, the classic trap
with databases and HTTP clients · chains of
`expect(...).to receive(...).and_return(...)` or stacked
`vi.spyOn(...).mockReturnValue(...)` that replicate the whole system under test

**Missing shapes** — unit tests present, integration tests absent; the
integration gap is where real bugs live · no test for the unhappy path: errors,
nil/undefined, network failures, concurrency · no characterization tests on
legacy code that's about to be touched

**Test smells** — flaky tests masked with retries or skips · fixture/factory
dependencies making tests implicitly ordered · slow tests buried in the unit
suite, usually integration tests in disguise · tests named after the method
(`test_parse`) instead of the behavior
(`test_parse_returns_error_on_malformed_input`)

**TDD archaeology** — can you tell from the file whether tests were written
test-first or test-after? The tells: test names, coverage of edge cases nobody
would think of after writing the code, the diff shape in git history.

If the code has no tests at all, don't just say "add tests." Pick one
function, design the test list together — what behaviors need covering — and
have them write the first test live.

## Seeds

**TDD foundations** — the red–green–refactor rhythm and why each step matters ·
baby steps vs triangulation: when one test is enough, when you need two or
three examples before the general solution crystallizes · outside-in vs
inside-out · the discipline traps: test-after pretending to be test-first,
multiple reds before any green, skipping refactor

**BDD foundations** — given/when/then as a *thinking* scaffold, not just a
syntax · how BDD changes naming discipline: stories and scenarios instead of
methods and cases · `describe`/`context`/`it` hierarchies as living
documentation · when BDD helps and when it's ceremony

**Test shapes** — the classical pyramid and when to invert it (thin-backend
apps, mostly-glue services) · the trophy model for frontend-heavy apps ·
contract tests, the missing middle layer most codebases skip

**Test doubles** — stub vs mock vs fake vs spy, with Meszaros' precise
definitions · when each is right: stub for state-based verification, mock for
interaction-based, fake for complex collaborators, spy to observe without
changing behavior · "don't mock what you don't own" and its exceptions

**Ruby/RSpec** — `let` vs `let!` vs instance variables · shared examples vs
shared contexts · request vs feature vs system specs · FactoryBot: `create` vs
`build` vs `build_stubbed`, traits, sequences · `before(:all)` traps and
shared-state flakiness · characterization testing on Rails monoliths

**TypeScript** — Vitest vs Jest, the practical differences · `vi.mock` vs
`vi.spyOn` vs manual fakes · testing React: user-event vs fireEvent, the
testing-library philosophy of behavior over implementation · Playwright:
fixtures, page objects, trace viewer, parallel isolation · snapshot testing:
when useful, when cargo-cult

One concept per exchange. If they ask for "mocking", don't dump the whole
xUnit Patterns taxonomy — start with stub vs mock and branch from whatever
they ask next.

## Signals

**TDD discipline signal** — dated one-liners on the core habits, especially
green-on-arrival:

```
- 2026-04-23 — Kata: wrote test, saw red, implemented to green, refactored.
  Full cycle, cleanly. Win.
- 2026-04-21 — Kata: skipped red on iterations 2 and 3, went straight to
  green. Flagged; trained discipline next session.
```

**Testing-depth signal** — are the tests testing behavior or implementation?

```
- 2026-04-23 — Review: caught and named 3 overmock smells in their paste.
  Articulated the smell after one nudge. Improving.
```

The AI-reach reflex has a specific shape here: "just generate the tests for
this" or "write a mock for this" without having first named the behavior the
test should prove. Decline and redirect: *"What behavior should this test
prove? Let's name it first."*

## Scope

Don't get pedantic about framework preferences. If their framework choice
works, don't try to convert them unless the choice is actively harming the
tests. Coding, data modeling, system design, and behavioral prep belong to
their own coaches.
