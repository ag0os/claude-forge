---
slug: data-modeling
name: Data Modeling
scope: Relational (Postgres-leaning) and document (Mongo-leaning) databases, plus which-when judgment
session: 20–45 min · drill / theory / discuss
---

# Pack — Data Modeling

**Stance:** `practitioner-sharpening`. They have strong daily SQL fluency, but
through an ORM abstraction — raw SQL and query-plan literacy are thinner than
that fluency suggests. Push on judgment and mechanics, not syntax basics.

**Tracks:** SQL (Postgres dialect unless stated) · Document (MongoDB dialect
unless stated). One per session, except in `discuss`, which spans both.

**Modes:** Produce → `drill` · Explain → `theory` · Discuss → `discuss`

**Axis — performance under real scale.** Every debrief asks, mandatory:

- **For queries:** what's the expected plan? Which indexes are required for
  this to run well at N = 10k, 1M, 100M rows?
- **For schemas:** which access patterns will be fast, which will require a
  scan or a secondary lookup?

This is the data-modeling analog of Big O. Ask them first; never answer for
them. Then an **idiom check**: is it written the way a fluent SQL or Mongo
engineer would write it? Window function instead of self-join; `$lookup` vs a
separate query in app code; CTE for readability vs subquery.

The goal is schemas that hold up under production load and queries that don't
melt under scale. Interview readiness falls out of that, not the other way
round.

## Focus areas

- **SQL** — joins, window functions, CTEs, indexing, query plans,
  transactions, normalization, schema design, migrations
- **Document** — embedding vs referencing, aggregation pipelines, Mongo
  indexing, denormalization patterns, schema validation
- **Cross-cutting** — consistency models, CAP, which-when judgment, hybrid
  architectures, caching, pagination

## Intake

- **Paradigm priority.** Both equally, SQL-primary, or document-primary? It
  skews the problem mix.
- **Self-rating 1–5** on: writing SQL by hand without an ORM, reading a query
  plan, designing a normalized schema, designing a denormalized document
  schema, writing Mongo aggregations, picking indexes.
- **Use-case bias.** More OLTP (transactional app backends), analytical
  (reporting, BI), or real-time/streaming in their work and target roles?
  Problems should bias toward what they actually face.

## Bank

For query-writing, give a schema listing the tables/columns or
collections/fields. For schema design, describe the app's access patterns
concretely — **don't make them guess the requirements.**

### SQL drills

- **Query-writing from a schema** — given 3–5 tables, answer a specific
  question. Start with join + aggregate, progress to window functions, CTEs,
  self-joins, lateral joins, recursive queries.
- **Query-plan reading** — paste an `EXPLAIN ANALYZE` output; they diagnose
  why it's slow and how to fix it. This is the query equivalent of code
  review, and many engineers who write SQL daily have never been forced to
  read a plan carefully.
- **Index design** — given a query and a table, design the index that makes it
  fast. Single-column, composite, covering, partial, expression. Push them to
  explain *why* it helps, not just name it.
- **Schema design** — here's the app, here are the access patterns, design the
  schema. Watch for: proper normalization for the use case (not blind 3NF),
  foreign keys and cascade rules, primary key choice (serial vs UUID vs
  natural), enums vs lookup tables, soft-delete vs hard-delete tradeoffs.
- **Transactions & isolation** — given a scenario, pick the isolation level,
  spot race conditions, reason about lock contention.
- **Migrations** — given a production table with N rows and a required schema
  change, design a safe migration: downtime, backfills, dual writes, rollback.

### Document drills

- **Document design** — given an app and its access patterns, design the
  document shape. Push on: what embeds vs what references, array sizes and
  growth, hot-document problems, updates that affect many docs.
- **Aggregation pipelines** — write the pipeline that answers a question.
  `$match`, `$group`, `$project`, `$lookup`, `$unwind`, `$facet`, `$bucket`,
  `$graphLookup`. Pipelines are the killer interview surface — most engineers
  who've used Mongo have never written a non-trivial one.
- **Indexing in Mongo** — compound indexes, the ESR rule (Equality, Sort,
  Range), multikey, text, partial and sparse indexes.
- **Schema validation** — write a JSON schema for a collection that enforces
  the shape you want without over-constraining.
- **Denormalization tradeoffs** — given an access pattern, decide whether to
  duplicate data, and if so how to handle drift.

### Discuss scenarios

Work through: what are the access patterns (reads vs writes, point lookups vs
range queries vs aggregations, latency requirements)? What are the consistency
requirements? What's the scale now and projected? Which paradigm fits and why
— and if both would work, what's the tiebreaker? What does the schema or
document shape look like in enough detail to know the design is sound? What's
the operational story — indexes, migrations, backups, ops complexity?

Good scenario sources:

- A social feed for N million users, mixed read/write, soft-real-time
- A time-series workload (metrics, events) with high write and time-range reads
- A product catalog with faceted search and frequent reshaping
- A chat app with strong ordering and eventual-consistency-OK search
- A financial ledger with strict ACID and auditability
- A CMS or authoring tool with flexible content types
- An analytics pipeline feeding a dashboard

If a design runs long, treat it as a living document at
`.coach/data-modeling/designs/<scenario>.md` — but only if they want the
persistence.

## Seeds

Always bring a concrete example — a real schema, a real query, a real plan
output. No pseudocode-only theory. Anchor to Rails/ActiveRecord when it helps:
they already know how `includes` vs `joins` behave, so use that as the hook
into plan discussion.

**SQL** — normalization 1NF→3NF and BCNF, and *when to denormalize on
purpose* · index internals: B-tree vs hash vs GiST vs BRIN, why composite
order matters, covering indexes · query plans: scan types, join strategies
(nested loop, hash, merge), how the planner chooses · transaction isolation:
read committed, repeatable read, serializable; phantom reads, lost updates;
Postgres MVCC · locking: row locks, advisory locks, deadlock detection ·
constraints: foreign keys, checks, exclusion, deferrable

**Document** — why document databases exist, what they give up and what they
buy · embedding vs referencing: "query together, store together", and when to
break it · aggregation pipeline internals — stages as a pipeline, when it can
use indexes, when it must scan · consistency: majority read/write concern,
causal consistency · sharding briefly: shard keys, zone sharding — know the
vocabulary even without implementing

**Cross-cutting** — **CAP and PACELC**: why you can't have everything, what
real systems choose, why "NoSQL = eventually consistent" is a lazy
generalization · **which-paradigm-when**: does the access pattern require
multi-entity joins at query time? Is the schema stable? Are access patterns
known up front? Do you need ACID across multiple records? Each answer points
one way · **hybrid architectures**: Postgres plus Elasticsearch for search, or
plus Redis for hot reads — when justified, when premature · **caching**:
write-through vs write-behind vs read-through, TTL strategy, invalidation ·
**pagination**: offset vs keyset, when each breaks, how to do it right in both
paradigms

## Signals

**Cross-cutting judgment** — dated observations on which-when decisions:

```
- 2026-04-23 — Picked document for a reporting problem that clearly wanted
  relational. Key tell they missed: needed multi-table joins at query time.
```

## Scope

SQL and document stores. Acknowledge Redis, Kafka, Elasticsearch, DynamoDB,
and Cassandra in discussion — especially Redis for caching — but don't run
full drills on them. Data modeling *inside* a system design conversation is in
scope when asked directly; the broader system design conversation is not.
