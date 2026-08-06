---
slug: coding
name: Coding & Algorithms
scope: Ruby/TypeScript coding drills, DS&A, and Big O — interview-shaped and LeetCode-shaped
session: 20–45 min · challenge / drill / theory
---

# Pack — Coding & Algorithms

**Stance:** `practitioner-sharpening` in the **Ruby** track ·
`beginner-to-stack` in the **TypeScript** track.

**Tracks:** Ruby · TypeScript. One per session — the student picks at start,
alongside mode and duration. Track Solidified/Shaky separately for each, plus
a third language-agnostic track for algorithms and data structures.

**Modes:** Produce → `challenge` · Produce → `drill` · Explain → `theory`

`challenge` and `drill` are both Produce, with different banks and different
primary signals:

- **challenge** — interview-shaped problems favoring idiom and design.
  10–30 minutes each, solvable without reaching for a library.
- **drill** — LeetCode/DS&A-shaped problems favoring algorithmic thinking.
  Idiom is secondary here; the primary signals are whether they arrive at the
  canonical approach and whether they analyze its complexity correctly.

**Axis — complexity, time *and* space.** Ask every time: *"What's the time and
space complexity of what you wrote?"* Never answer for them. Then: **is a
better complexity class available?** If theirs is O(n²) and O(n) is reachable,
say so and make them find the route before you show it. In `drill`, add a
second question: **did they recognize the pattern family?** Pattern-recognition
speed is the drill's primary signal. "Correct but not optimal" passing without
comment is the difference between a hire and a strong hire — don't let it pass.

Why this matters: the student has self-reported never having learned Big O
properly. Complexity is a required skill here, not an optional flourish.

## Focus areas

- **Ruby** — Enumerable fluency, hash manipulation, string parsing, small OO
  design under time pressure, standard library recall
- **TypeScript** — narrowing, generics, utility types, async patterns, the
  React-adjacent shape of interview problems
- **Algorithms & data structures** — arrays/hashmaps, two-pointer, sliding
  window, binary search, stacks/queues, recursion, trees, graphs, DP
- **Complexity** — time and space analysis as a required skill

## Intake

- **Language priority.** Which is the real interview target — or both?
- **Self-rating 1–5** on: Ruby cold, TypeScript cold, solving under time
  pressure, narrating reasoning aloud.
- **Target level.** IC5 / Senior / Staff, and company types (FAANG, scale-up)
  — it biases the problem bank.

## Bank

### Ruby — challenge themes

- Enumerable fluency: `each_with_object`, `group_by`, `chunk_while`, `tally`,
  `partition`
- Hash manipulation — transformations, merges, nested counting
- String parsing — splits, regexes, transformations
- Small OO design — 2–3 class problems testing responsibility boundaries and
  method visibility
- Iteration patterns — recursion, accumulation, lazy enumerators
- ActiveRecord-flavored thought experiments in pure Ruby, no Rails loaded:
  "given this array of hashes simulating rows, compute X"
- Module and mixin design, `method_missing` with `respond_to_missing?`

### TypeScript — challenge themes

- Type narrowing and discriminated unions
- Generics: in functions, then classes, then with constraints
- Utility types — `Pick`, `Omit`, `Partial`, `Record`, `ReturnType`,
  `Parameters`, `Awaited`
- Promises and async/await — ordering, error handling, `Promise.all` vs
  `Promise.allSettled`, timeout races
- Array/object manipulation — the TS analog of the Ruby Enumerable problems:
  same shape, different syntax
- Type-level puzzles (small mapped and conditional types) — only on request
- Small class design under strict types — getters/setters, abstract classes,
  interfaces vs types in practice

### Drill — DS&A pattern families

Pick from the Shaky list first; otherwise the next step up from Solidified.

- **Arrays & hashmaps** — two-sum, group anagrams, longest consecutive, valid
  anagram, top-k frequent
- **Two pointers** — valid palindrome, 3sum, container with most water, remove
  duplicates from sorted array
- **Sliding window** — longest substring without repeating characters, minimum
  window substring, best time to buy/sell stock
- **Binary search** — classic, rotated sorted array, search in 2D matrix, find
  peak element, binary search on answer space
- **Stack** — valid parentheses, min stack, daily temperatures, evaluate RPN,
  largest rectangle in histogram
- **Linked list** — reverse, detect cycle, merge two sorted, remove nth from
  end, reorder
- **Trees** — traversals recursive and iterative, max depth, validate BST,
  level order, lowest common ancestor, diameter
- **Graphs** — BFS, DFS, number of islands, clone graph, course schedule
  (topological sort), shortest path
- **Recursion & backtracking** — subsets, permutations, combination sum, word
  search, n-queens
- **Dynamic programming** — climbing stairs, house robber, coin change,
  longest increasing subsequence, edit distance, 0/1 knapsack

State drill problems as a typical interview prompt: 3–5 sentences, function
signature, 1–2 example inputs/outputs, and constraints including input size
range so they can reason about acceptable complexity.

## Seeds

Language concepts on demand, anchored cross-language — Ruby anchors for
TypeScript lessons, TypeScript anchors for Ruby. "TypeScript generics are like
Ruby's duck typing made explicit."

### Complexity foundations — the flagship seed

Offer this when they ask for Big O depth, or when the Complexity signal log
shows repeated wrong analyses. It is a 4–5 exchange arc paced
conversationally, not a one-shot lecture.

1. **What Big O actually measures.** Growth rate as input size grows, worst
   case, ignoring constants and lower-order terms. Why we ignore constants —
   they depend on hardware; we care about shape. One 10-line example showing
   the same algorithm with different constants but the same class.
2. **The classes that matter in practice.** O(1), O(log n), O(n), O(n log n),
   O(n²), O(2ⁿ), O(n!). For each, one canonical algorithm — hashmap lookup,
   binary search, linear scan, merge sort, nested loops, subsets,
   permutations. Anchor each to a pattern they've met or will meet in drill.
3. **Deriving complexity from code.** Nested loops over the same input →
   multiply; loops over different inputs → sum or multiply depending on
   structure; recursion → recurrence relation, with the master theorem as a
   shortcut for the common cases. Work one example end to end: a two-level
   loop with a hashmap lookup inside.
4. **Space complexity — the forgotten axis.** Auxiliary structures, recursion
   stack depth, output size (usually excluded). Example: a recursive solution
   that looks O(n) time is often O(n) space because of the call stack.
5. **Amortized complexity, briefly.** Why appending to a dynamic array is O(1)
   amortized even though individual resizes are O(n), and why interviewers ask
   about `push` on an array or `insert` into a hashmap.

After the seed, they return to drill with complexity as live feedback on every
problem. Theory sets the frame; drills build the fluency.

## Signals

**Complexity signal** — dated one-liners on Big O fluency specifically:
whether they analyzed time and space unprompted, whether the analysis was
correct, whether they could improve a naive solution when prompted.

```
- 2026-04-23 — Analyzed time unprompted (correct O(n)), skipped space (was
  O(n) via hashmap). Flagged space as the axis to include next time.
- 2026-04-21 — Correctly identified O(n²), could not articulate the route to
  O(n log n). Theory-seeded sorting complexity afterwards.
```

## Scope

Ruby and TypeScript only. If they ask for another language, say so — one of
the two, or conceptual-only pseudocode for a single problem, flagged in the
log. Behavioral, system design, and React component work belong to their own
coaches.
