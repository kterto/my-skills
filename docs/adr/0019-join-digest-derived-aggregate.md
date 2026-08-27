# ADR-0019 — Three join roles rebuild the same aggregate on every cycle; materialize it once, and let the original always win

- **Status:** Accepted
- **Date:** 2026-08-27
- **Skills affected:** `orchestrator` (`references/parallel.md` → **3j.4 — The join digest**, 3j.3; `references/config.md` → `join_digest`; `references/artifact-format.md` → *`PACT` ID resolution* item 5; `SKILL.md` → Steps 3b, 4, 4c, 5, 5c, 5d — the `aggregate=` preamble line; `templates/tester.md`, `templates/reviewer.md`, `templates/qa.md` → Step 1a; `templates/config.template.json`)
- **Source finding:** run-cost forensics on a 75-hour, 9-leaf `full` run, landed on `perf/orchestrator-run-cost` (PR #40) as item P7. Measured: ~403 KB of plan text per tester spawn and ~721 KB per reviewer and QA spawn, across thirteen join spawns — **7.8 MB of re-ingestion for one run's worth of facts.**
- **Depends on:** **ADR-0018 — The run can name its base commit but never its own tree**, whose `tree=` line is the digest stamp's freshness key and whose boundaries are its rebuild sites. This ADR amends none of it, and explicitly declines to fold the ledger into the digest (0018 → *Deliberate divergences*).
- **Distinct from ADR-0014.** The repository now uses the word *digest* for two unrelated artifacts, and conflating them would be a real error. See *Two artifacts called "digest"* below.

## Two artifacts called "digest"

**ADR-0014's digest is the Step 2p.1 slicing digest** — the strict-shape response the *slicing-analysis
subagent* returns, whose accepted fields are per-candidate-lane requirement IDs, task counts, candidate
globs, intra-lane overlaps, and the `integration` slice that ADR-0014 made first-class. ADR-0014's own
Consequences pin its lifetime: *"the digest is a **transient per-run artifact**: it lives in the Step 2p
spawn prompts and the `PRIOR SLICING ANALYSIS` envelope."* It is an **input to the cost model, consumed
before any coder runs**, and it is never written to disk.

**This ADR's digest is `.orchestrator/join-digest.md`** — a materialized file, built by the orchestrator
at the outer join, read by the tester, reviewer and QA **in place of** the contracts, leaf plans and
progress logs they otherwise re-walk. Different producer, different consumer, different lifetime,
different persistence, different failure mode.

What the two share is **doctrine, not identity**, and this ADR reuses ADR-0014's rather than inventing a
second one: a digest is accepted only in a declared shape, and a shape it fails is **rejected, never
defaulted**. ADR-0014's *"'Not declared' and 'declared `none`' are different claims, and only the second
is safe to price"* is the same argument as decision 3 below.

## Context

The tester, the reviewer and QA each rebuild the run's aggregate from the parent contract, every
sub-contract, every leaf plan and every leaf `.progress.md` — **on every cycle**. The artifacts do not
change between cycles. The reading is repeated because nothing carries it forward.

Two properties make this the run's largest single sink rather than a rounding error. First, it scales
with **cycles × roles × leaves**, none of which the run controls. Second, most join spawns are
cycle-2-or-later, and by then the great majority of what is being re-read is provably frozen: a frozen
interface shape may not change unilaterally, the orchestrator is the contracts' sole writer, and the
architect never rewrites an existing plan.

The naive fix — hand the roles a summary — is the dangerous one, and the reason this needed a recorded
decision rather than an implementation. **Every way a summary of these artifacts can be wrong produces
a stronger verdict, not an error.** A dropped requirement row is counted as verified, because the unmet
count is computed from the table's own rows. A dropped write authorization becomes a boundary Must Fix
against code that is correct. A paraphrased interface shape passes a check that a byte comparison would
have failed. A summary that fails loudly is a nuisance; this one fails silently and in the direction of
approval.

## Decision

### 1. Materialize once per boundary, and read it *in place of* — never in addition to

The orchestrator writes `.orchestrator/join-digest.md` at 3j.4, before dispatching any of the three
join roles, and each role reads **its own section in place of the artifacts that section replaces**.

*In place of* is the whole design. **A digest that is merely *additional* raises every role's input
instead of lowering it**, and would convert this from a saving into a cost while looking like a
feature.

### 2. Six regions, each named with its consumer, its contents and its source

A — authorized-**write** map (reviewer). B — interface ledger, both levels, frozen shapes verbatim,
resolved to the owning leaf (tester, reviewer). C — union requirement map, each claim qualified
`{leaf-id}:AC{n}` (reviewer). D — per-leaf gate posture, verbatim, **kept per leaf** (QA). E —
acceptance criteria, byte-for-byte (tester, reviewer, QA). F — `GATE` index carrying the **measured
value** plus a locator and a positive scope assertion (QA).

Four of the six carry a rule that is not obvious and would be lost if the region were described only
by its name:

- **A is an authorized-*write* map, not a glob table.** Ownership governs writes; a lane legitimately
  *reads* everywhere, and carve-outs and assigned unowned files are writes no glob matches. A
  globs-only region turns each of those into a **false boundary Must Fix**, which the reviewer is
  required to raise regardless of how good the code is.
- **B's value is the join, not the copy.** A sub-contract's inherited-assignment region is an *index*
  into the parent's frozen shapes and does not restate them; the parent's rows do not name the sub-lane
  that owns each side. Neither artifact alone lets the reviewer gate on *every interface row satisfied
  on both sides at its frozen shape*. This is the one region that removes a real tree walk.
- **D is never unioned.** Unioning per-leaf gate tables erases the distinction between *the architect
  omitted the gate* and *the coder skipped its sub-step* — QA's two branches, which need different
  fixes.
- **F carries the measured value, and is a pointer, not a copy.** A carried finding is one recorded *at
  no worse a measurement*; an index recording presence without the number lets a **regressed**
  measurement pass the join as carried. The `Carried because:` prose is deliberately **not** carried —
  QA opens the named `.progress.md` for any finding it is about to label carried, which is one or two
  files per cycle rather than all of them.

### 3. Built by the read-only scan subagent; a template-shaped extractor is forbidden

Regions A and B are mechanical and the orchestrator builds them directly. C, D, E and F are
leaf-derived and are built by one read-only scan subagent, under the existing type-resolution and
never-fail rules, with an **inline fallback** on a host that admits no scan child — so the step is
host-agnostic and never silently skipped.

**A template-shaped extractor is forbidden, because it fails open.** Real leaf `## Requirement
Coverage` tables have been observed carrying **nine different column headers across nine leaves**, none
of them the canonical schema. An unmatched header yields an empty row; an empty row reads as *no
requirement*; and a requirement map with no unmet rows passes the reviewer's approval test. The builder
reads; the orchestrator checks and writes.

### 4. I1–I8, fail-closed, before the tester is dispatched — and the counts are printed

Every check is a count, a set equality, or a hash over text the orchestrator already handles at this
step. **Any failure means the digest is not written and `aggregate=` is not emitted.** There is no
"built with warnings".

Three of the eight are load-bearing in ways a shorter check list would have missed, and are recorded
here because a later editor pruning "redundant" checks will find them first:

- **I2a and I2b are not redundant.** I2a (distinct requirement ids) alone passes a digest that
  collapsed claims into rows; I2b (total claim cells) alone passes one that duplicated instead of
  merging. **Both, or the check is worthless.**
- **I4b hashes each frozen-shape cell against its source.** It is the only mechanically detectable
  difference between *copied* and *summarized*. A paraphrase of a frozen shape is not a frozen shape.
- **I8 makes absence evidence.** Two of QA's three attribution branches are decided by absence, and an
  empty result is otherwise ambiguous between *no entry existed* and *the builder missed it*.

**Print the counts, never a checkmark.** A self-check nobody sees is indistinguishable from no check.
A failed build prints a first-class `DIGEST — not built ({which check failed}: {value} vs {value})`
line naming the failing equality and both values.

### 5. Staleness is two-part, and conflating them is the design error to avoid

Regions A–E are **frozen at authoring** and carry forward across every cycle unchanged — which is where
most of the saving lives, because most join spawns are cycle-2-or-later. **Region F is the sole region
whose source moves**, and it is rebuilt at every boundary (3j, 4c, 5d) — the same three sites that
already re-mint the tree hash, so the hook exists and the marginal cost is one file write. Per-leaf
progress hashes let a role fall through **for one leaf only**, exactly as suite inheritance falls
through for one suite.

**A contract amendment invalidates the whole digest at once**, because it rebinds `root_plan_id`,
re-partitions the split, and rebuilds the leaf set with new `FEAT` IDs. The superseded digest is
**deleted, not overwritten in place**, and rebuilt inside the amendment's own transaction; a failed
rebuild fails the amendment and halts the run `PARTIAL` — the rule the rest of that transaction
already follows (**ADR-0011**).

### 6. The original artifact always wins — and a noticed disagreement kills the digest for the run

The decisive argument is **not deference but detectability**: every loss listed in Context produces a
stronger verdict rather than an error, so a role noticing a disagreement is the *only* runtime signal
that the builder dropped something.

This costs nothing, because roles do not re-derive — I1–I8 does the checking once, at build time, and
the role-level rule fires only on reads the role was making anyway. When what a role opens disagrees
with the digest, three things follow: it **prints** it, it **records** it in its report and
`.progress.md`, and the **digest is marked unusable for the rest of the run**. Without that third
clause "the original wins" decays into every role privately re-deriving, and the digest becomes a file
everyone reads and nobody trusts — strictly worse than not having one.

### 7. Every role prints its rung, in stdout *and* in its artifact

The four-rung ladder (verified digest / stamp mismatch / no digest / legacy `PACT` walk) is disclosed
by every join role. **The dangerous silence is not the stale digest — it is a build that failed or was
skipped**, after which every role quietly takes rung 2, the run costs exactly what it costs today, and
nobody knows the mechanism did not happen. The artifact record matters more than the stdout one: the
artifact is what a human reads three cycles later when a verdict looks wrong.

### 8. Parallel path only, default on, one boolean

`join_digest` defaults to `true` **because the mechanism fails closed**: the downside of a bad build is
a run that costs what it costs today, printed. On a sequential run the sub-step does not exist at all —
there is no contract and no leaf set, every region would be empty or a verbatim copy of the one plan
the role already opens, and emitting `aggregate=` would break the `off`-run prompt-parity invariant to
buy nothing.

## Alternatives considered

- **(A) Extend ADR-0020's `### Gate coverage` table to carry the aggregate.** Rejected. That table is
  a **per-plan** artifact keyed by gate id, authored by the architect before any coder runs, and its
  value is precisely that each leaf's table stands or falls alone (region D preserves that property by
  refusing to union it). The digest is a **cross-plan** artifact keyed by role, built by the
  orchestrator after every leaf is DONE, from sources the architect never sees — progress logs, gate
  measurements, the changed-file list. They share no key, no author, no lifetime and no consumer.
  Merging them would put a post-hoc measurement into a pre-flight contract, and QA's ability to tell
  *the architect omitted the gate* from *the coder skipped its sub-step* depends on those two being
  different documents.
- **(B) Make the digest additive — hand roles a summary alongside the artifacts.** Rejected on sight:
  it raises every role's input and delivers no saving, while creating every fidelity hazard.
- **(C) Build the regions with a template-shaped extractor.** Rejected — it fails open. See decision 3.
- **(D) Include the verification ledger as a seventh region.** Rejected. It is already one small file
  at a fixed path that roles both read and append to; its rows are rewritten in place; and its match
  rule forbids the normalization a copy would perform. Copying it would save nothing and hand roles a
  row that has since been re-classified (ADR-0018 → *Deliberate divergences*).
- **(E) Union region D across leaves, as region C is unioned.** Rejected: it erases QA's two branches.
  C is unioned because a requirement genuinely spans leaves; D is not, because a gate table does not.

## Consequences

- **The saving is bounded by what is frozen, and that is most of it.** Regions A–E carry forward
  untouched from cycle 2 onward; only F is rebuilt.
- **The digest is never a gate, with one exception, and the exception is named.** I5b — every path in
  the join's changed-file list matches at least one authorization in A — is a real gate rather than a
  fidelity check, and it is the only one. It costs nothing, because the changed-file list is already
  computed at this step.
- **`.progress.md` write volume falls at the same time, from a different decision.** The join verdict
  is now written in full once to the parent contract's sidecar with pointers in the leaves (P9), which
  removes the nine byte-identical paragraphs per join role per cycle that region F re-hashes. That is
  an application of the existing sole-writer rule — the ban is on the contract file, not on its
  append-only sidecar — not a decision this ADR makes, and it is recorded at
  `references/artifact-format.md` → *`PACT` ID resolution* item 5, which owns it.
- **The `off`-run prompt-parity invariant is preserved**, and stated as the reason the sub-step does
  not exist on the sequential path rather than as an implementation detail.
- **First-run obligation, stated in `references/config.md`:** read the printed `DIGEST —` counts. They
  are the entire audit surface, and a checkmark in their place would be worth nothing.
- **Not addressed here:** any change to what the roles *evaluate*. The digest replaces metadata reads
  only. The working-tree snapshot, every changed file in full, the changed-file set recomputed at run
  time, `.cleancode-gates.json` thresholds, `PROJECT-CONTEXT.md`'s commands, each plan's
  `## Technical Notes` and `## Tasks`, the `Carried because:` prose, the run-family walk, the
  join-level `CR` and the spec are all reads of the original, on every cycle.
