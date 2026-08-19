# ADR-0016 — The flat/outer cost model never charges the top-level integration lane; price it as serial

- **Status:** Accepted
- **Date:** 2026-08-19
- **Skills affected:** `orchestrator` (`SKILL.md` → Steps 2p.1, 2p.2; `references/config.md` → *The makespan model*, *The baseline*, *The two work-concentration conditions are evaluated at leaf granularity*, *Leaf-level re-application of the two work-concentration conditions*, *Greedy, recomputed adoption*, and all worked examples; `templates/architect.md` → *5. Integration lane*)
- **Source finding:** the `feat/prime-agent-distribution` PR-review backlog, remediated by `SPEC-20260819T052229Z-3d97` / `FEAT-20260819T053237Z-236f`. Filed as the deferred top-level bullet in ADR-0014's Consequences.
- **Lineage:** Extends **ADR-0014 — The nested cost model prices an integration sub-lane it can never read** one level up, which itself follows **ADR-0012 — The nested viability gate's cost model punishes slicing in three places**. ADR-0012 established that an integration slice is serial and is **added** to the concurrent `max` rather than folded into it; ADR-0014 made the sub-lane slice a first-class digest field so the term became reachable. This ADR applies the same shape to the **run's own** integration lane. It **amends neither**: ADR-0013's per-lane inner-join barrier and its `J` (not `k × J`) charge stand, and ADR-0014's sub-lane `integration` field stands.

## Context

ADR-0012 and ADR-0014 fixed the integration slice one level down. The **top level** was left
explicitly unfixed: ADR-0014's Consequences carried a *"Not addressed here"* bullet naming the
flat/outer cost model's missing top-level integration lane — `references/config.md` → `M_flat`,
and Step 2p.2's flat print block — as the same defect family one level up, and filed it separately.

This ADR is that filing, and the bullet has been rewritten to point here. It is quoted nowhere
above deliberately: the same change that authored this ADR amended that bullet, so a verbatim
quotation would cite wording that no longer exists in the file it names.

`SKILL.md` → Step 3j runs the top-level integration lane at the outer join **after every other lane
is DONE, never concurrently with them** — the same discipline Step 3s applies to a sub-lane's
integration slice — and Step 3L dispatches **no** integration lane in the concurrent wave, at either
level. The model did not follow the machine. `M_flat` and the viable-flat `span_base` took a bare
`max` over lanes, and `span_max` did the same, so the run's serial tail was folded into a `max`
instead of charged after it.

Two things made the defect hard to see, and both are worth recording because they are what a future
reviewer will trip on:

1. **There was no declared field to read.** Exactly as at the sub-lane level before ADR-0014, the
   lane-level digest requested no `integration` field, and Step 2p.1's strict-shape acceptance rule
   discards prose outside the requested fields. So a slicing analysis that volunteered a top-level
   integration lane had it thrown away, and one that did not was never asked.
2. **Every internal reconciliation still passed.** This is the sharp part. See *The `g`/`c`
   interaction* below: the error moved `M_flat` and `M_nested` by the **same** amount, so
   `M_flat − M_nested = g − c` held, the gate and the ladder agreed, and nothing in the transcript
   contradicted the printed figures. A passing reconciliation is evidence that two accounts match —
   not evidence that either is right.

## Decision

### 1. `tasks(integration)` at the top level is a first-class field of the lane-level split

Step 2p.1 requests an `integration` field alongside the lanes, in ADR-0014's exact strict shape:
either the literal `none`, or a **named slice carrying its mapped requirement IDs, its candidate
globs, and an integer task count**. The strict-shape acceptance rule enumerates it, and a lane-level
split that **omits** it is **rejected outright**, not read as zero — "not declared" and "declared
`none`" are different claims and only the second is safe to price. A declared `none` is `0`.

The declared slice is a slice in its own right: its requirement IDs and globs are **disjoint from
every lane's**, it does **not** also appear as a lane-map row, and its globs satisfy the full
*Owned-glob rejection* list.

### 2. The term enters `span_base`, `span_max`, and `M_flat` — and nothing else on the cost side

With `X = tasks(integration)` at the top level:

- viable-flat `span_base` = `max` over **non-integration** lanes of `tasks(L)` **plus** `X`;
- `span_max` = `max` over **non-integration** lanes of `span(L)` **plus** `X`;
- `M_flat` = that `span_base` + `A` + `J` + the parent contract's interface-point count.

`M_nested` needs **no** separate term: it is built on `span_max`, which already carries `+ X`.
Adding one would charge the same serial work twice.

`T` counts the integration lane in full, so **`M_seq` is unchanged** — an `off` run implements
integration work like any other work, one task at a time. Only the two concurrent baselines were
ever wrong.

### 3. The lane is excluded from the two work-concentration conditions, and from those only

At **both** evaluation sites — *The two work-concentration conditions are evaluated at leaf
granularity* (2p.3) and *Leaf-level re-application* (2p.3n) — the top-level integration lane is
excluded, for the reason ADR-0012 gave one level down: the conditions measure concurrency and it has
none. Counting it would read `{backend: 20, integration: 4}` as *"2 lanes carry work, largest holds
83%"*, passing for concurrency a split that is not a split at all.

The exclusion applies at both sites or at neither: a lane excluded at 2p.3 and counted again at
2p.3n would let that same shape pass the deferred check it was deferred because of. It counts in
**full** in `span_base`, `span_max`, `M_flat`, and `T` — including as part of the `70%` denominator.

### 4. The lane is never a sub-split candidate

`span(integration) = tasks(integration)` is a **run constant**; 2p.3n evaluates candidates over the
non-integration lanes only. This is load-bearing rather than incidental — see the derivation below.

### 5. Step 2p.2's flat print block divides by `span_base`

The `Estimated speedup:` denominator is the flat `span_base` in expanded form — the non-integration
`max` and `+ integration({n})` shown as two summands — rather than a bare `largest lane tasks`,
which silently omits the serial tail. A new `Integration lane:` line names the slice or reads
`none`. `Fixed overhead:` and `Interface points to freeze:` are unchanged: pricing the integration
lane moves the **span** term, never the overhead term.

### 6. The parent contract's integration-lane region is bound, not authored

`templates/architect.md` → *5. Integration lane* binds the **parent** contract's integration lane to
the declared slice in the same verify-and-freeze terms the sub-contract case already uses — *verify
it against the real spec and tree, then freeze it verbatim; do not re-derive, rename, or re-size it*
— with the same `contract violation` BLOCKED stop when verification shows the declared slice is
wrong. Without this the newly-priced `+ X` would have no binding to what Step 3j actually dispatches:
an architect could freely re-author or re-size the lane and the figure charged at 2p.2 would describe
a run that never happens. That is precisely the failure ADR-0014 §5 prevents one level down.

### 7. Normative detail lives in `references/config.md`

Per the repository's single-source-of-truth convention, `references/config.md` owns the arithmetic.
`SKILL.md` → Step 2p states what the digest must **declare** and links; it does not restate formulas.

## The `g`/`c` interaction — derived, not asserted

Write `X = tasks(integration)` at the top level, `N` for the non-integration lanes,
`M = max_{L∈N} tasks(L)`, and `S = max_{L∈N} span(L)`. Note `S ≤ M` always, and `S = M` before any
adoption. The **uncorrected** model took a bare `max` over all lanes, i.e. `max(M, X)` and
`max(S, X)`; the corrected model is `M + X` and `S + X`.

**`c` is unchanged at every branch.** `c` is a delta of `M_nested`'s **overhead** term — the
sub-contract level, the inner-join level, the outer join, the parent contract, and interface points
(`references/config.md` → *The cost side*). `X` appears in no overhead term at either level. There
is therefore nothing for this change to move on the cost side, on either baseline, at any adoption
index.

**`g` under a viable flat baseline — unchanged when the integration lane is not the longest span,
corrected upward when it is.** Corrected: `g = (M + X) − (S + X) = M − S`. The `+ X` cancels
identically, because `X` is a run constant — which is exactly what decision 4 guarantees. Uncorrected:
`g = max(M, X) − max(S, X)`. Three branches, and the correction is never downward:

- **`X ≤ S ≤ M`** — the two agree at `M − S`. The integration lane is shorter than the shortened
  span on both sides, so it never enters either `max` and there is nothing to correct.
- **`S < X < M`** — uncorrected `g = M − X`, understated by `X − S`. The lane swallows the
  *nested* side of the subtraction but not the flat side, so the old model saw only the part of
  the gain that exceeded the serial tail.
- **`X ≥ M ≥ S`** — uncorrected `g = X − X = 0` while the correct value is `M − S ≥ 0`,
  understated by the whole gain. The old model reported *no* benefit from splitting a lane whose
  split genuinely shortens the concurrent part of the run, because a large serial tail swallowed
  both sides of the subtraction.

The middle branch is the one an implementer is most likely to omit, because the two extremes are
the cases that come to mind — and it is the branch where the understatement is partial rather than
total, so a run exhibiting it looks plausible rather than obviously wrong.

**`g` under a sequential (`M_seq`) baseline — reduced by `min(S, X)`.** There `span_base = T`, which
already counts the integration work as ordinary work, so nothing cancels. Corrected:
`g = T − (S + X)`. Uncorrected: `g = T − max(S, X)`. The difference is
`(S + X) − max(S, X) = min(S, X)`. This is the optimistic direction the finding names: on a
sequential baseline the gate was crediting a nested plan with span it does not remove.

**`M_flat − M_nested = g − c` is preserved.** Both makespans gain the same `+ X`, so their difference
is untouched, and `c` does not move. **This is the point that matters for a future reader:** the
defect was *not* a gate/ladder disagreement of the kind
`references/config.md` → *Worked example — the gate verdict and the ladder figure must agree*
records. Both figures were wrong **in the same direction, by the same amount**. That distinction
tells a future reader which regression check applies: the reconciliation identity cannot detect this
class of error, and only a hand re-derivation against the dispatch order in `SKILL.md` → Steps 3L
and 3j can.

## Deliberate divergences from ADR-0014's sub-lane shape

Recorded rather than left silently different, per the repository's `mirror machinery` convention:

- **The top-level integration lane is never sub-split**, whereas a sub-lane integration slice belongs
  to a lane that was itself a split candidate. This is what makes `X` a run constant and the
  cancellation above exact.
- **There is no containment parent.** A sub-lane integration slice's globs must be contained within
  its parent lane's globs (ADR-0014 §4, resting on the *Containment* disjointness proof). The
  top-level lane has no parent lane, so containment reads against the repository root; the full
  *Owned-glob rejection* list still applies, and its globs must be disjoint from every lane's.

## Consequences

- **No existing worked example's figures move.** All four in `references/config.md` were re-derived
  by hand with `integration: none` declared explicitly at the lane level, so `X = 0` in each and the
  correction is a no-op by construction. They gain the explicit declaration so they exercise the new
  required field rather than silently predating it.
- **A fifth worked example is added** exercising `X > 0` on a viable flat baseline, and it is
  specifically the case that shows a passing `M_flat − M_nested = g − c` reconciliation alongside two
  makespans understated by exactly `X`.
- **Runs that declare `integration: none` at the lane level are unchanged in every printed number.**
- **The digest shape change makes previously-acceptable digests rejectable.** Acceptable for
  ADR-0014's reason, unchanged: the digest is a **transient per-run artifact** living in the Step 2p
  spawn prompts and the `PRIOR SLICING ANALYSIS` envelope, and `.orchestrator/run-manifest.json`
  persists none of it. No persisted artifact carries the old shape, so no migration exists to perform.
- **The gate gets stricter on a sequential baseline and looser on one branch of the flat baseline.**
  Not uniformly one direction: `g` falls by `min(S, X)` against `M_seq`, and rises from `0` to
  `M − S` on a flat baseline where the integration lane was the longest span. Both are corrections
  toward the machine.
- **Not addressed here:** the nested/sub-lane half of the model. `span(L)` for a split lane, the
  per-sub-lane conditions, containment, and the cost side's `A`/`J`/`I` charges are untouched except
  where the top-level term had to be named alongside them. ADR-0012, ADR-0013, and ADR-0014 stand
  unamended.
