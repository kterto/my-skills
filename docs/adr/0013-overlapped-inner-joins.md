# ADR-0013 — Overlap inner joins so `k × J` stops scaling with slice count

- **Status:** Accepted
- **Date:** 2026-08-14 (proposed) / 2026-08-19 (accepted and implemented)
- **Skills affected:** `orchestrator` (`SKILL.md` → Step 3s; `references/config.md` → *The makespan model*, *The cost side*)
- **Depends on:** ADR-0012 (the other three members of the same defect family)
- **See also:** ADR-0014 (the sub-lane integration slice as a first-class digest field) and
  **ADR-0016** (the same shape one level up, pricing the top-level integration lane into
  `span_base`, `span_max`, and `M_flat`). Neither amends this decision: the per-lane inner-join
  barrier and its `slowest-of-k` = `J` charge stand, and `X = tasks(integration)` enters no overhead
  term at either level.

## Context

ADR-0012 corrected three cost terms that grow with slice count while being compared against
quantities that shrink with it. One member of that family was deliberately left out, because
fixing it is a change to execution order rather than to a constant.

`references/config.md` → *The makespan model*:

> **Inner-join passes are serialized after the leaf barrier.** Step 3s reconciles each
> sub-split lane in turn, in lane-map row order, and every one of them sits on the critical
> path — so `k` of them cost the **sum of k**, i.e. `k × J`.

At the default `J = 2`, a 3-way nested plan pays 6 task-equivalents in inner joins alone,
on top of `A + A + J`. This is why `full` is effectively gated to `k = 1` in practice: the
second and third adopted lanes each need a marginal gain above `J` plus their interface points
before they clear `g > c`, and by construction each adoption is evaluated against a smaller
remaining gain than the one before it.

The single-lane case ADR-0012 unblocks does not feel this — it is `k = 1`. Multi-lane `full`
does, and it is the case `full` exists for.

## The change

`SKILL.md` → Step 3s currently imposes a global barrier: *"Wait for every in-flight leaf
subagent — across all lanes, not just this lane's — to return before beginning any inner
join."* Replace it with a per-lane barrier: a lane's inner join begins as soon as **its own**
sub-lanes are DONE, concurrently with leaves still running in other lanes.

Cost model follows: inner joins become `slowest-of-k` = `J`, matching how `A` is already
treated for concurrently-spawned sub-contract architects. `M_nested`'s `k × J` term becomes
`J`, and *The cost side*'s per-adoption charge drops `J` for every adoption after the first.

**Change the barrier and the charge together, or neither.** Charging `slowest-of-k` while
Step 3s still serializes recreates exactly the gate-and-ladder-on-two-accounts defect that
`references/config.md` → *The cost side* and its worked example were written to prevent.

## Why this is believed safe

`SKILL.md` → Step 3s already states it, unprompted, and supplies the proof:

> Early per-lane inner joins — starting a lane's 3s as soon as that lane's own sub-lanes
> return, concurrently with still-running leaves elsewhere — are **safe by containment** and
> would convert `k` serialized join passes into overlapped ones, but they are deliberately
> **not** taken at this depth. That is a spec-level change to the barrier discipline, recorded
> as a follow-up rather than assumed here. Do not read the barrier as load-bearing for
> correctness; it is not, and a future editor removing it needs the containment proof, not
> this paragraph.

The containment proof is the paragraph above it: sub-lane globs strictly partition their
parent lane's globs, and lane globs are mutually disjoint, so no other lane's leaves can touch
the paths a given inner join reconciles. A lane's inner-join inputs are whole the moment its
own sub-lanes return.

The barrier is therefore described by the skill itself as a **simplicity choice** buying a
single deterministic reconciliation order and one join state machine.

## What must be resolved before implementing — resolved, 2026-08-19

The containment proof covers **file paths**. It does not obviously cover the three pieces of
shared state Step 3s touches. Each question is answered below, in place; the answers are what
was implemented.

1. **Deferred-gate de-duplication.** *Question as filed:* Step 3s step 3 collects gate deferrals
   across a lane's sub-lanes, de-duplicates them, and runs each once over the settled lane union.
   With overlapping joins, two lanes may defer the same unscopable gate and race to run it over
   *different* unions.

   **Answered: option A, generalized.** Step 3s runs **no** deferred gate at all — it collects
   and records them, and **Step 3j item 4 is the single de-duplicated run site** for every
   deferred gate at either depth. The filed option A ("run deferred gates only at the outer join
   *when more than one lane deferred the same one*") is generalized to *always*, because the
   conditional form is non-deterministic: it places the same gate at 3s in one run and at 3j in
   another, depending on what other lanes happened to defer.

   **Option B (lock the gate-running sub-step) is rejected.** A lock serializes the *invocation*
   without settling the *workspace* the unscopable gate reads — the gate still runs while other
   lanes' leaves are writing, which is the actual defect — and it does nothing about this ADR's
   own warning that project gate commands may not be concurrency-safe even over disjoint paths
   (shared build dirs, lockfiles, ports). The outer join is the only point at which nothing else
   is in flight. A third option, "run at 3s only when no other lane happens to be in flight", is
   rejected on the same determinism ground as the conditional form of A.

   **This ADR's framing of question 1 was narrower than the defect.** It presented the problem as
   a *race between two lanes deferring the same gate*, which suggested de-duplication or a lock
   as the fix. The real invalidator is definitional and applies to a **single** deferred gate in a
   **single** lane: a deferred gate is by definition one with **no path-scoped form**, so it reads
   paths outside the lane, and containment — which only ever proves things about a lane's own
   globs — proves nothing whatever about it. Option B is not merely less convenient than option A;
   it is unsound, and it would have been unsound with only one lane deferring.

   **Consequence, knowingly accepted:** a `SUBJOIN` reconciliation of a lane no longer implies
   that lane's deferred gates passed, and the narrower-scope benefit the deferral used to buy
   ("the smallest scope on which an unscopable gate is meaningful") is given up. It was resting on
   a settled-union premise the overlap falsifies. Step 3j item 4's failure output names the
   **lane(s) that deferred** the failing gate, so de-duplication costs no attribution.

2. **Parent contract lane-status writes.** *Answered: confirmed safe, and now stated explicitly.*
   The writes are orchestrator-side — `SKILL.md` → 3s.1 already makes the orchestrator the sole
   writer of every contract's status table at both levels — so overlapping inner joins add **no
   second writer**: only the leaf and integration coders the orchestrator spawns run concurrently,
   and none of them writes a `PACT` or a sub-contract. Ordering is not required either, because the
   writes are disjoint: the parent lane-status table has one pre-existing row per lane, frozen when
   Step 2c authored the lane map, and each lane's inner join sets **its own row's status cell
   alone**. Setting disjoint cells of a pre-existing table is order-independent. 3s.1 now carries
   the claim in one sentence rather than leaving it inferable.

3. **Reconciliation determinism.** *Answered: re-established at the two observable surfaces, not
   assumed lost.* **Execution** order is now wall-clock; **observable** order is pinned, and they
   are separated explicitly in Step 3s. (a) *Artifacts:* each sub-contract's sub-lane-status table
   is written by exactly one lane's inner join, and the parent table's cells are disjoint per
   lane — so the settled artifacts are identical regardless of completion order. (b) *Transcript:*
   `SUBJOIN` blocks are emitted **in lane-map row order, at a single point, once every inner join
   has completed**, immediately before Step 3j — the orchestrator holds each result rather than
   printing it as that join finishes. Printing is not on the critical path, so ordering the
   emission costs nothing the overlap was bought for. **Net claim:** two runs over the same
   contract produce the same artifacts and the same printed `SUBJOIN` sequence; only wall-clock
   completion order differs, and nothing reads it.

4. **`PARTIAL` routing.** *Answered: recorded at the inner join, taken at the outer join.* An
   inner join that routes its lane to `PARTIAL` **records** the routing and marks the lane
   accordingly **without halting the run**; the `PARTIAL` halt (3j.1) is taken at Step 3j after
   both of that step's waits hold. A mid-run halt is forbidden by the existing *"never abandon a
   running leaf"* rule — halting while other lanes' leaves are still writing abandons them
   mid-write into a shared workspace, which is exactly what 3j.1's "completed lanes stay DONE"
   guarantee depends on not happening. Deferring the halt is also what keeps 3j's classification
   consistent under overlap: 3j classifies **one settled set** of lanes with every inner join's
   verdict already recorded, rather than a set still changing underneath it.

## Three hazards this ADR did not name, resolved in the same change

Implementation surfaced three further hazards the four questions above do not cover. Each is a
race the barrier change would otherwise have shipped, so each landed in the same change:

5. **Step 3j needed a second barrier.** Step 3j asserted that *"every inner join (Step 3s) has
   already completed"* by the time it begins — true only because the global leaf barrier put every
   inner join strictly before it. Once inner joins overlap still-running leaves, a leaf returning
   is no longer evidence the joins are finished, so the assertion becomes unsupported. Step 3j's
   opening wait now names **both** conditions explicitly: every in-flight leaf returned **and**
   every inner join complete. The outer join gains a wait; it loses none.

6. **The contract-amendment loop's entry point had to move to Step 3j.** 3j.2 partitions the leaf
   set and re-dispatches the invalidated part; entering it from an inner join while other lanes'
   leaves are still in flight would invalidate a leaf **mid-write**, which the loop's own
   atomic-transaction rule forbids. The inner join therefore **records** the amendment routing
   exactly as it records a `PARTIAL` one, and the loop is entered at Step 3j once both waits hold,
   with recorded requests evaluated in lane-map row order. Amendment **scoping** is unchanged — a
   sub-contract row still amends that sub-contract alone, an inherited parent row still escalates —
   and `max_contract_amendments` remains one budget shared across both levels, consumed by one
   writer in a deterministic order. Only the entry point moves.

7. **`max_parallel_lanes` stopped binding.** A lane's integration sub-lane coder now runs while
   other lanes' leaves are still in flight, so it is genuinely concurrent with them and must be
   counted on the same ledger. The ceiling now reads: at most `max_parallel_lanes` **coder
   subagents** in flight at any time, **counting each inner join's integration sub-lane coder**,
   with Step 3L's wave sizing subtracting the integration coders currently running. Both of the
   key's stated reasons — host concurrency and blast radius — apply to an integration coder exactly
   as they do to a leaf coder. This tightens nothing previously allowed: before overlap, an
   integration coder could not run concurrently with a leaf coder at all. Step 2L's bound is
   untouched — an architect fan-out never overlaps an inner join.

## Expected effect

For a 3-way nested plan at the defaults, inner-join cost drops from 6 to 2 task-equivalents,
and adoptions 2 and 3 no longer each need to clear a fresh `J`. Combined with ADR-0012 this
is what makes multi-lane `full` reachable rather than theoretically available.

## Alternative rejected

**Charge `slowest-of-k` without changing Step 3s.** Rejected on sight: it prices a cost the
implementation does not have, which is the failure mode `references/config.md` → *Worked
example — the gate verdict and the ladder figure must agree* documents as having already
happened once.
