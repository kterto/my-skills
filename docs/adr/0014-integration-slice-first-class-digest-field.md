# ADR-0014 — The nested cost model prices an integration sub-lane it can never read; make the slice a first-class digest field

- **Status:** Accepted
- **Date:** 2026-08-18
- **Skills affected:** `orchestrator` (`SKILL.md` → Steps 2p.1, 2p.2, 2s.2; `references/config.md` → *The makespan model*, *Containment*, *Per-sub-lane re-application of the existing viability conditions*, and all three worked examples)
- **Source finding:** `arch-1` in the `feat/prime-agent-distribution` PR review, remediated by `SPEC-20260819T000458Z-bfac` / `FEAT-20260819T001630Z-be84`.
- **Lineage:** Follows **ADR-0012 — The nested viability gate's cost model punishes slicing in three places**, which established that `span(L)` for a split lane is `max` over its *non-integration* sub-lanes **plus** `tasks(integration sub-lane)`, because the integration sub-lane is dispatched serially at Step 3s. This ADR does not amend that decision; it repairs the input path that made the term unreachable. ADR-0012 stands unchanged and remains the normative source for every other term in the model.

## Context

ADR-0012 corrected the *arithmetic*: an integration sub-lane is serial, so its task count is
added to the concurrent sub-lanes' `max` rather than folded into it. `references/config.md` →
*The makespan model* has said so since, and its third worked example exercises the term with a
declared slice of 6.

But `tasks(integration)` has no source. Step 2p.1's digest request asks the slicing analysis for,
per sub-lane, the mapped requirement IDs, an estimated task count, and the candidate globs — and
separately for the intra-lane overlaps. No integration slice is requested. Step 2p.1's strict-shape
acceptance rule then closes the loop in the other direction:

> **Prose outside those fields is discarded, not read**, and a digest that will not parse into that
> shape is **rejected**.

So an analysis that *volunteers* an integration slice has it thrown away as unrequested prose, and
an analysis that does not volunteer one was never asked. Either way `tasks(integration)` evaluates
to `0` on every real run.

The consequence is confined to one term but reaches the run's verdict:

- `span(L)` collapses to the concurrent `max`, understating the split lane's real span;
- `span_max` — the `max` over lanes of `span(L)` — is understated by the same amount whenever the
  split lane is critical;
- `g = span_base − span_max` is therefore **overstated by exactly the serial integration work**;
- `g > c` adopts candidates whose true critical path is longer than the one they were priced on,
  and option 3 of the `ask` ladder quotes the user a makespan the run cannot achieve.

On `references/config.md`'s own third worked example the error is 6 task-equivalents: `span_max`
reads `5` instead of `11` and `g` reads `19` instead of `13`. That candidate is adopted either way,
which is why the defect survived — the failure is a wrong number, not a wrong branch. A split whose
integration slice is large relative to its concurrent work fails differently: it is adopted when it
should not be.

This is the same defect family ADR-0012 named — a term that misprices serial work inside a
concurrency model — arriving one layer upstream, at the digest boundary instead of the formula.

## Decision

### 1. The integration slice is a first-class field of every proposed sub-lane split

Step 2p.1 requests an `integration` field alongside the sub-lanes for **every** proposed split:
either the literal `none`, or a **named slice carrying its mapped requirement IDs, its candidate
globs, and an integer task count** — the same three fields every other slice carries. It is
requested as a field, not inferred from prose, because the acceptance rule reads fields and
discards prose.

### 2. The strict-shape acceptance rule lists it, so an omitting split is rejected

The rule at Step 2p.1 enumerates it with the other accepted fields, and a split that omits it is
**rejected** rather than read as zero.

**"Not declared" and "declared `none`" are different claims, and only the second is safe to price.**
Defaulting a missing field to `0` reintroduces the exact defect this ADR repairs, silently, on every
analysis that simply forgot to answer. Rejecting costs one re-request; defaulting costs a wrong
verdict that nothing downstream can detect.

### 3. The declared count feeds `span(L)`, and therefore `g` and the admission decision

`tasks(integration)` is read from the declared field and enters `span(L)` exactly as ADR-0012
specified: `max` over non-integration sub-lanes **plus** `tasks(integration)`. It therefore flows
into `span_max`, into `g = span_base − span_max`, and into `g > c`. A declared `none` yields `0`,
which is what the model already assumed — so a run whose splits genuinely carry no integration work
is unaffected in every number.

### 4. Integration-slice globs obey containment; the slice stays out of the two concentration conditions

The slice is a sub-lane for **containment and disjointness** — its globs are contained within the
parent lane and disjoint from its siblings' — because the global disjointness proof at
`references/config.md` → *Containment* rests on that and a slice that could reach outside its parent
would break it.

It remains excluded from the **two work-concentration conditions**, unchanged from ADR-0012, because
those conditions measure concurrency and it has none. The exclusion is from those two conditions
only: the slice counts in full toward `span(L)` and toward `T`.

### 5. Step 2p.2 populates its existing integration slots, and 2s.2 carries the slice to the sub-contract architect

The printed nested block already reserves two slots — `+ integration({n})` inside the `span({lane})`
line and `{, + integration sub-lane {n}}` on the `Nested plan:` line. They are filled from the
declared field. A declared `none` prints `integration(0)` and omits the `Nested plan:` slot: `none`
is a printed answer, not an absent one.

The `PRIOR SLICING ANALYSIS` envelope handed to each sub-contract architect at Step 2s.2 carries the
declared slice alongside the per-sub-lane requirements, task counts, globs, and intra-lane overlaps —
so the sub-contract's required `### 5. Integration lane` region
(`templates/architect.md`, verified at Step 2s.3) is **authored against the slice that was priced**
rather than re-derived independently of it.

### 6. Normative detail lives in `references/config.md`

`references/config.md` owns the model, per the repository's single-source-of-truth convention.
`SKILL.md` → Step 2p states what the digest must **declare** and links; it does not restate the
arithmetic.

## Consequences

- **No worked example's numbers move.** All three in `references/config.md` were re-checked: examples
  1 and 2 declare `integration: none` (`tasks(integration) = 0`, exactly what they already assumed)
  and example 3 already declared a slice of 6 and already priced it. What changes is that the slice
  is now *reachable* — example 3's arithmetic was correct on paper and unattainable in practice.
  Example 3 gains a note recording the 6-task-equivalent error the old path produced; the three
  examples remain the regression check for any edit to either side of the model.
- **The digest shape change makes previously-acceptable digests rejectable.** This is acceptable
  because the digest is a **transient per-run artifact**: it lives in the Step 2p spawn prompts and
  the `PRIOR SLICING ANALYSIS` envelope, and `.orchestrator/run-manifest.json` persists only
  `branch`, `base_sha`, `spec_id`, `spec_sha256`, `contract_ids`, `leaf_ids`, and `parallelism`. No
  persisted artifact carries the old shape, so no migration exists to perform.
- **The gate gets stricter, not looser.** Correctly charging serial integration work lowers `g`, so
  some candidates that were adopted on an overstated gain will now be left flat with a named reason.
  That is the intended direction: ADR-0012 corrected three terms that were too strict and one —
  the integration exclusion — that was too loose; this repairs the input to that same too-loose term.
- **Runs whose splits declare `none` are unchanged in every printed number.**
- **Addressed separately, and now filed:** the flat/outer cost model's missing top-level integration
  lane (`references/config.md` → `M_flat`, and Step 2p.2's flat print block). Same defect family, one
  level up: `M_flat` took a bare `max` over lanes and never charged the parent contract's own
  integration lane, which Step 3j dispatches just as serially. See **ADR-0016 — The flat/outer cost
  model never charges the top-level integration lane** — **Accepted** (2026-08-19), which extends
  this decision one level up without amending it: the lane-level split gains the same first-class
  `integration` field, `span_base`/`span_max`/`M_flat` gain `+ tasks(integration)`, and the lane is
  excluded from the two work-concentration conditions at both evaluation sites. This ADR remains
  scoped to the nested sub-lane split that `arch-1` named.
- **Not addressed here:** ADR-0013's overlapped inner joins (`k × J`). This decision does not
  touch Step 3s's barrier discipline. (ADR-0013 was subsequently **Accepted and implemented** on
  2026-08-19, independently of this one.)
