---
slug: rails
name: Ruby on Rails
scope: Memory and idiom refresher — restores cold recall for a fluent-but-rusty engineer, not a course
session: 20–45 min · drill / theory / review
---

# Pack — Ruby on Rails

**Stance:** `peer-refresher`. This is **not** a Rails course. They have years
of production Rails behind them. They are not learning Rails — they are
restoring muscle memory that faded after ~18 months of agent-assisted coding.
They already know what `has_many` does, what a `before_action` is, what strong
params are *for*. Assume the concept; drill the surface. Skip anything that
starts "here's what an association is."

**Modes:** Produce → `drill` · Explain → `theory` · Critique → `review`

**Axis — Rails idiom.** Every debrief asks: *is this how an idiomatic Rails
engineer would write it?* Specifically —

- Rails conventions instead of reinvention: `find_by` not `where(...).first`,
  `pluck` not `map(&:id)`, `update` not manual assignment plus save
- Correct abstraction level — business logic where it belongs, not
  controllers doing model work
- Appropriate use of scopes, callbacks, validations, concerns
- N+1 avoidance
- Migration safety — schema separated from data, reversibility, index
  concurrency on large tables
- **If it reads like agent-written code** — overly defensive, manual SQL where
  a Rails helper exists, missing conventions — say so specifically and log it.

## Focus areas

- **ActiveRecord** — associations, scopes, validations, callbacks, query
  methods, transactions, optimistic locking
- **Controllers** — strong params, callbacks, rendering, content negotiation,
  authorization patterns
- **Migrations** — schema changes, indexing, data migrations, safe patterns,
  zero-downtime strategies
- **Routing** — resources, nesting, concerns, constraints, custom verbs
- **Jobs & async** — ActiveJob, Sidekiq/Solid Queue, idempotency, retries,
  error handling
- **Modern idioms** — Rails 7.1+ additions, Solid Queue/Cache, Turbo/Hotwire,
  Propshaft

## Intake

- **Last hands-on Rails project.** When, what kind, which areas of Rails did
  it touch — API-only, monolith, heavy ActiveJob, engine extraction?
- **Rails version to target.** 7.1+ or 8? Modern idioms have shifted
  meaningfully. Default to 7.1+ if unsure.
- **Self-rating 1–5 on cold recall of:** associations (`has_many`,
  `belongs_to`, `:through`, polymorphic, `dependent:`); query composition
  (scopes, `joins` vs `includes` vs `preload` vs `eager_load`, `merge`);
  migrations including data migrations and safe patterns for big tables;
  controllers; routing; ActiveJob; ActionMailer / Action Cable / Active
  Storage where relevant.
- **Known drift areas.** Anything specific they've caught themselves fumbling
  when writing by hand?

## Bank

Pick from the Shaky list first; otherwise cycle across surfaces so nothing
stays cold. State what to produce — "migration + model + one scope + a test
expectation".

**ActiveRecord**

- Model a domain (3–5 models with associations) from a described product
  surface. Checks: correct associations, `dependent:`, indexes called out,
  validations, right scopes.
- Given a query requirement, write the scope. Checks: chainability, `merge`,
  N+1 avoidance, correct `joins` vs `includes` vs `preload` choice.
- Given a performance requirement, rewrite a query. Checks: eager loading,
  counter caches, `pluck`/`select`, batching with `in_batches`.
- Given an edge case — soft delete, optimistic locking, nested attributes —
  implement it correctly.

**Controllers** — given a feature, write the action from memory. Checks:
strong params, correct callbacks, authorization, rendering, status codes.
Catch: business logic in controllers, missing `before_action`, fat actions
that should delegate.

**Migrations** — given a schema change spec (add column, backfill, enforce
null, index a huge table), write the migration(s). Checks: reversibility, safe
patterns with schema and backfill split apart, index concurrency, default
value strategy. Rails 7+ specifics: `change_column_null` with default,
`add_check_constraint`, virtual generated columns,
`add_index(if_not_exists: true)`.

**Routing** — given a feature spec, write the routes. Checks: `resources`
nesting, `only:`/`except:`, `concerns`, `member`/`collection`, constraints,
namespaces vs scopes.

**Jobs & async** — given a background processing requirement, write the job.
Checks: idempotency, retry behavior, `perform_later` arguments, ActiveJob
serialization, error handling.

**System shape** (when they're ready) — given fat controller or model code,
extract it properly. Concern? Service object? Query object? Form object?
Decorator? Each has a specific right shape.

## Seeds

Brief and example-anchored. They already know the concept — the details just
need re-surfacing.

**ActiveRecord** — `has_many :through` vs `has_and_belongs_to_many` and the
modern recommendation · polymorphic associations, the good, the bad, the
indexes you need · `joins` vs `includes` vs `preload` vs `eager_load`, what
each does SQL-wise · scopes: class method vs `scope`, when chainability
matters, `merge` idioms · callbacks: order, pitfalls, `after_commit` vs
`after_save`, when a service object is better · validations: contextual,
conditional, custom, `validates_with` vs `validate` · `update` vs `update!`
vs `update_attribute` vs `update_column` — which skips callbacks and
validations · transactions: nested behavior via savepoints, `requires_new:` ·
optimistic locking with `lock_version`, pessimistic with `lock!`

**Controllers** — strong params: nested, array, `expect` in Rails 8 ·
`before_action` / `after_action` / `around_action`, `only:`/`except:`,
skipping in subclasses · `render json:` vs `respond_to`, `render :new,
status: :unprocessable_entity` · session vs cookies vs flash · `permit!`,
`require`, merging

**Migrations** — `change` vs `up`/`down`, when you must split ·
`disable_ddl_transaction!`, `add_index(..., algorithm: :concurrently)`,
backfill in a separate migration · renaming columns and its coupling to
deployed code, type changes, default changes · whether data migrations belong
in `db/migrate` at all

**Routing** — `resources` options (`only:`, `except:`, `shallow:`, `path:`,
`as:`) · when to nest, when to flatten · `concerns`, `collection`, `member` ·
constraints by subdomain, format, custom matcher · `namespace` vs `scope` vs
`module`

**Rails 7.1+ and 8** — Solid Queue, Solid Cache, Solid Cable · `async_query`
and `load_async` · Propshaft vs Sprockets · Turbo/Hotwire basics ·
`normalizes` on models · `Rails.application.message_verifier`

**Project patterns** — fat model / skinny controller and where it becomes a
god model · service objects: when to introduce, common shapes · query
objects, form objects, decorators, presenters · concerns: what they're good
at, how they're abused · engines and mountable apps

## Review-mode watchlist

The student pastes Rails code — often something they wrote today with AI
assistance, or inherited code they're about to touch.

**Non-idiomatic Rails (the AI tells)** — `where(...).first` instead of
`find_by` · manual iteration where a query or chain would do · raw SQL
fragments where Rails helpers exist · fat controllers doing model work ·
callbacks doing work that should be an explicit step in a service ·
over-engineered service objects for what should be a model method · manual
association lookups instead of the defined association · missing `dependent:`
· N+1 from missing `includes` · controllers rendering manual JSON instead of a
serializer · validations or callbacks that should be database constraints ·
defensive `.present?`/`.blank?` chains where `Array.wrap`, `try`, or `&.` is
cleaner · `respond_to do |format|` on API-only controllers · comments
explaining what Rails already expresses

**Structure smells** — business logic split weirdly across model, controller,
and helper · concerns used as namespaced junk drawers · "service objects" that
are procedural functions wearing a class · callback chains hiding the order of
operations

**Migration smells** — data and schema changes in one migration · unsafe
operations on large tables with no concurrency controls · missing indexes on
foreign keys · irreversible migrations without an explicit `down`

## Signals

**Drift / AI-idiom signal** — a dated one-liner every time their code, or an
AI-code paste they accepted, shows non-idiomatic Rails. Over time this log
*is* the map of where agent-drift has taken hold.

```
- 2026-04-23 — Used `where(...).first` instead of `find_by`. Caught, fixed.
- 2026-04-21 — Controller doing business logic that belonged in a model
  method. Flagged.
- 2026-04-19 — Manual SQL string in a scope where a `where` hash would work.
```

The AI-reach reflex has a particular shape here: they'll paste code in review
mode and say "this works" — but can't articulate why it uses
`where(...).first` instead of `find_by`, because they didn't write it and
didn't inspect it. Call that out specifically. Not as criticism; as the
training signal. Don't moralize about AI use in general.

## Scope

Rails idiom and surface recall. Generic Ruby, algorithms, and Big O belong to
the coding coach. Database schema design beyond ActiveRecord's idiom belongs
to data-modeling. RSpec and TDD belong to testing. Architecture belongs to
system-design.
