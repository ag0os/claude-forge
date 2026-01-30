# Implementing Ralph Wiggum for autonomous AI coding

The Ralph Wiggum technique—named after The Simpsons character who embodies "persistent iteration despite setbacks"—enables continuous autonomous development through a deceptively simple mechanism: **a bash loop that repeatedly feeds an AI coding agent the same prompt until completion**. Created by Australian developer Geoffrey Huntley and popularized in late 2025, this approach fundamentally shifts how developers work with AI coding assistants by letting progress persist through files and git history rather than context windows.

The technique works because AI agents don't need to remember everything—they just need to read updated files each iteration. As Huntley puts it: "Ralph is deterministically bad in an undeterministic world. It's better to fail predictably than succeed unpredictably."

---

## The bash loop that runs everything

At its core, Ralph is a single line of bash:

```bash
while :; do cat PROMPT.md | claude ; done
```

This "OG" approach works because each iteration starts with a fresh context window. The agent reads the current state from disk (specs, implementation plan, existing code), completes one task, commits, and exits. The bash loop restarts it immediately, and the cycle continues until work is complete.

The enhanced production script supports mode selection between planning and building:

```bash
#!/bin/bash
# Usage: ./loop.sh [plan] [max_iterations]

if [ "$1" = "plan" ]; then
    MODE="plan"
    PROMPT_FILE="PROMPT_plan.md"
    MAX_ITERATIONS=${2:-0}
else
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=${1:-0}
fi

ITERATION=0
while true; do
    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    cat "$PROMPT_FILE" | claude -p \
        --dangerously-skip-permissions \
        --output-format=stream-json \
        --model opus \
        --verbose

    git push origin "$(git branch --show-current)"
    ITERATION=$((ITERATION + 1))
done
```

The `-p` flag enables headless mode, `--dangerously-skip-permissions` bypasses all confirmation prompts (critical for automation), and `--output-format=stream-json` provides structured logging. The `--model opus` flag selects Claude Opus for complex reasoning tasks.

### Directory structure for Ralph projects

```
project-root/
├── loop.sh                    # The bash loop script
├── PROMPT_build.md            # Building mode prompt
├── PROMPT_plan.md             # Planning mode prompt
├── AGENTS.md                  # Operational guide (~60 lines max)
├── IMPLEMENTATION_PLAN.md     # Prioritized task list (Ralph-generated)
├── specs/                     # Requirement specifications
│   ├── user-auth.md
│   └── payment-processing.md
├── src/                       # Application source code
└── src/lib/                   # Shared utilities
```

### Git worktrees enable parallel execution

For running multiple Ralph loops simultaneously on different features:

```bash
# Create work branch with scoped plan
git checkout -b ralph/user-auth-oauth

# Run scoped planning
./loop.sh plan-work "user authentication with OAuth and session management"

# Execute building loop (max 20 iterations)
./loop.sh 20

# Create PR when complete
gh pr create --base main --head ralph/user-auth-oauth --fill
```

Each branch gets its own `IMPLEMENTATION_PLAN.md`, preventing cross-contamination between features.

---

## Safety mechanisms protect against runaway costs

The `--dangerously-skip-permissions` flag grants Claude **full terminal control**—this is powerful but dangerous. Security experts recommend:

- **Sandboxing**: Run in Docker containers, Fly Sprites, or E2B environments
- **Minimum viable access**: Only the API keys and deploy keys needed for the task
- **Max iterations**: Always set a limit. A **50-iteration loop can cost $50-100+ in API credits**
- **Network isolation**: Restrict connectivity where possible

Huntley's philosophy: "It's not if it gets popped, it's when. What is the blast radius?"

The `frankbria/ralph-claude-code` implementation adds rate limiting and circuit breakers:

```bash
# Rate-limited execution (100 calls/hour default)
ralph --calls 50 --monitor

# Circuit breaker with error detection
ralph --reset-circuit  # Reset if stuck
```

---

## The two-prompt system separates planning from building

### PROMPT_plan.md focuses on gap analysis

```markdown
0a. Study `specs/*` with up to 250 parallel Sonnet subagents to learn the specifications.
0b. Study @IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `src/lib/*` with up to 250 parallel Sonnet subagents to understand shared utilities.

1. Use up to 500 Sonnet subagents to study existing source code in `src/*` and 
   compare it against `specs/*`. Use an Opus subagent to analyze findings, 
   prioritize tasks, and create/update @IMPLEMENTATION_PLAN.md as a bullet point 
   list sorted by priority. Ultrathink.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is 
missing; confirm with code search first.

ULTIMATE GOAL: We want to achieve [project-specific goal].
```

### PROMPT_build.md executes one task per iteration

```markdown
0a. Study `specs/*` with up to 500 parallel Sonnet subagents to learn specifications.
0b. Study @IMPLEMENTATION_PLAN.md.

1. Your task is to implement functionality per the specifications using parallel 
   subagents. Follow @IMPLEMENTATION_PLAN.md and choose the most important item 
   to address. Before making changes, search the codebase (don't assume not 
   implemented) using Sonnet subagents.

2. After implementing, run the tests. If functionality is missing, add it per specs.

3. When you discover issues, immediately update @IMPLEMENTATION_PLAN.md with findings.

4. When tests pass, update @IMPLEMENTATION_PLAN.md, then `git add -A` then 
   `git commit` with a descriptive message. After the commit, `git push`.
```

Huntley's specific prompt language matters. Use "study" (not "read"), "don't assume not implemented" (prevents false negatives), "using parallel subagents," and "ultrathink" (triggers extended reasoning). The phrase "only 1 subagent for build/tests" creates **backpressure control**—preventing parallel write operations that create conflicts.

---

## AGENTS.md serves as the operational heart of each project

This file—limited to **~60 lines**—tells Ralph how to actually run your project. It's loaded every iteration and captures operational learnings:

```markdown
## Build & Run
- npm install
- npm run dev

## Validation
Run these after implementing to get immediate feedback:
- Tests: `npm test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

## Operational Notes
- Database must be running before tests
- Use NODE_ENV=test for test runs

### Codebase Patterns
- Components go in src/components/
- Utilities go in src/lib/
- All API routes use middleware from src/middleware/auth
```

**What AGENTS.md is NOT**: a changelog, progress diary, or verbose documentation. Those belong in `IMPLEMENTATION_PLAN.md`. A bloated AGENTS.md pollutes every future loop's context.

---

## Completion signals and backpressure control the loop

### The promise tag pattern signals completion

```markdown
Output <promise>COMPLETE</promise> when:
- All CRUD endpoints working
- Input validation in place
- Tests passing (coverage > 80%)
- README with API docs
```

**Critical warning**: The `--completion-promise` flag uses exact string matching, which is unreliable. **Always use `--max-iterations` as your real safety net**.

### Backpressure through test failures guides iteration

The pattern from HumanLayer swallows success output but surfaces failures:

```bash
run_silent() {
    local description="$1"
    local command="$2"
    local tmp_file=$(mktemp)

    if eval "$command" > "$tmp_file" 2>&1; then
        printf "  ✓ %s\n" "$description"
        rm -f "$tmp_file"
        return 0
    else
        printf "  ✗ %s\n" "$description"
        cat "$tmp_file"
        rm -f "$tmp_file"
        return $exit_code
    fi
}
```

This keeps Claude in the "smart zone" (~75k tokens) where reasoning is strongest. A full jest/pytest run can dump **200+ lines**—2-3% of context window wasted on success messages. Enable `--bail` or `-x` flags for fail-fast behavior.

### TDD creates natural iteration structure

Harper Reed's observation: "The robots LOVE TDD. Seriously. They eat it up." The pattern:

1. Build the test and mock first
2. Next prompt: make the mock real
3. This is the most effective counter to hallucination and scope drift

Pre-commit hooks provide additional backpressure—"the robot REALLY wants to commit," so making commits contingent on passing tests forces it to fix issues rather than paper over them.

---

## Real implementations across the ecosystem

### snarktank/ralph (4,700+ stars)

Uses `prd.json` for tracking user story completion:

```json
{
  "branchName": "feature/user-auth",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add user login form",
      "priority": 1,
      "passes": false,
      "acceptanceCriteria": ["Form validates email", "Shows error messages"]
    }
  ]
}
```

Their `prompt.md` instructs the agent to pick the highest-priority story where `passes: false`, implement it, run quality checks, and update both the PRD and an append-only `progress.txt` file.

### frankbria/ralph-claude-code (785 stars)

Adds intelligent exit detection with dual-condition gates: **both** completion indicators AND explicit EXIT_SIGNAL required. Includes rate limiting (100 calls/hour configurable), circuit breakers, and tmux integration for monitoring.

Installation:
```bash
git clone https://github.com/frankbria/ralph-claude-code.git
cd ralph-claude-code && ./install.sh
ralph-setup my-project
ralph --monitor
```

### mikeyobrien/ralph-orchestrator

Rust rewrite supporting multiple backends (Claude, Kiro, Gemini CLI, Codex, Amp) with hat-based orchestration for specialized agent roles.

---

## Breaking large projects into Ralph-able chunks

### The JTBD specification pattern

**Jobs to Be Done** (JTBD) sits at the top of the hierarchy:

| Level | Definition | Example |
|-------|------------|---------|
| **JTBD** | High-level user outcome | "Help designers create mood boards" |
| **Topic** | Distinct component | Image collection, color extraction, layout |
| **Spec** | Requirements doc | `specs/color-extraction.md` |
| **Task** | Unit of work | Implement K-means clustering |

**Topic scope test**: "One sentence without 'and'." If you can't describe the topic in a single sentence without conjunctions, it needs splitting.

### The three-phase funnel

**Phase 1: Define Requirements** (human + LLM conversation)
- Chat to identify JTBD → break into topics → LLM writes `specs/*.md`

**Phase 2: Planning** (Ralph loop in PLANNING mode)
- Gap analysis: compares specs against existing code
- Outputs prioritized `IMPLEMENTATION_PLAN.md`
- No implementation, no commits—planning only

**Phase 3: Building** (Ralph loop in BUILDING mode)
- Picks ONE task from plan per iteration
- Implements, runs tests, commits
- Updates plan as side effect

### Tasks must fit in one context window

If a task is too big, the LLM runs out of context before finishing and produces poor code. Each iteration should:
- Start with **~5,000 tokens** allocated for specs loading
- Leave 40-60% of context for the "smart zone"
- Complete entirely within that session

---

## Failure modes and how to recover from them

### Infinite loops happen when exit conditions are ambiguous

**Problem**: Agent stuck trying to modify the same file repeatedly, or repeating semantically identical plans.

**Solutions**:
- Circuit breakers detecting >95% vector similarity between consecutive plans
- Hard `--max-iterations` limits (start with 10-20, never begin with 50+)
- Multiple timeout levels (per-iteration and total session)

### Context drift causes regression

**Problem**: After context compaction, Claude "forgets" recent changes and rewrites code you already fixed.

**Solutions**:
- Work from subdirectories, not monorepo root
- Bounded instructions: "Fix JWT validation in packages/api/src/auth/middleware.ts. DO NOT modify anything in packages/frontend."
- Fresh context per task with re-anchoring (re-reads specs + git state)

### Premature completion wastes iterations

**Problem**: Agent writes 3 files, ignores database schema, declares success.

**Solutions**:
- Dual-condition exit: BOTH completion indicators AND explicit EXIT_SIGNAL required
- Never rely on completion promises alone
- Pair with Opus for complex tasks requiring judgment

### Cost explosions stem from spinning wheels

Reported experiences: sprints where AI worked well cost **$200**; sprints where it got stuck cost **$2,000**. Warning signs include the same import statement regenerated 12 times, or persistence without learning.

**Cost controls**:
- Budget gauges killing processes exceeding per-request thresholds ($1.00)
- Semantic deduplication (stop if new plan is >95% similar to failed plan)
- Model tiering: Opus for planning, Sonnet for execution
- Prompt caching for up to 90% token reduction on repeated context

---

## When Ralph works and when it doesn't

### Strong fit for mechanical, verifiable tasks

- **Large refactors**: Framework upgrades (React 16→19), test framework migrations
- **Test coverage**: "Add tests for uncovered code"
- **Documentation generation**: API docs, READMEs
- **Greenfield projects**: Clear specs, no institutional knowledge required
- **Repetitive operations**: Batch processing with defined success criteria

### Poor fit for judgment-heavy work

- **Ambiguous requirements**: "Make it better" kills loops
- **Security-critical code**: Research found **72 vulnerabilities across 15 AI-coded apps**
- **Large monoliths**: Context consumption explodes; sparse tests provide weak backpressure
- **Architectural decisions**: Requires human judgment, not iteration

### The philosophy is tuning, not perfection

Huntley: "Each time Ralph does something bad, Ralph gets tuned—like a guitar." If the agent falls off the slide, add a sign saying "SLIDE DOWN, DON'T JUMP." Eventually you get a new Ralph that doesn't feel defective.

The skill shifts from directing Claude step-by-step to writing prompts that converge toward correct solutions. This is autonomous execution of mechanical work, not replacement of human judgment.

---

## Conclusion

The Ralph Wiggum technique represents a fundamental shift in AI-assisted development: from interactive pair programming to **autonomous iteration with human-defined constraints**. The core innovation is surprisingly simple—progress persists in files and git history, not context windows—but successful implementation requires careful attention to task scoping, backpressure mechanisms, and safety limits.

Key success factors: binary completion criteria that machines can verify, single-feature-per-iteration scope to stay in the "smart zone," comprehensive test suites for backpressure, and sandboxed environments since `--dangerously-skip-permissions` means exactly what it says. Start with 10-20 iterations, never more, until you understand your project's token economics.

The technique works best as a force multiplier for mechanical work—migrations, test generation, documentation—while leaving architectural decisions and security-critical code to human judgment. Master the core loop before reaching for automation, and remember: feedback loops are your speed limit. Never outrun your headlights.