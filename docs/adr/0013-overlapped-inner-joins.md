# ADR-0013 — Overlap inner joins so `k × J` stops scaling with slice count

- **Status:** Proposed
- **Date:** 2026-08-14
- **Skills affected:** `orchestrator` (`SKILL.md` → Step 3s; `references/config.md` → *The makespan model*, *The cost side*)
- **Depends on:** ADR-0012 (the other three members of the same defect family)

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

## What must be resolved before implementing

The containment proof covers **file paths**. It does not obviously cover the three pieces of
shared state Step 3s touches. Each needs an answer before this ships:

1. **Deferred-gate de-duplication.** `SKILL.md` → Step 3s step 3 collects gate deferrals across
   a lane's sub-lanes, de-duplicates them, and runs each once over the settled lane union.
   With overlapping joins, two lanes may defer the same unscopable gate and race to run it over
   *different* unions. Options: run deferred gates only at the outer join when more than one
   lane deferred the same one; or serialize just the gate-running sub-step behind a lock while
   overlapping the rest. Note the gates are project commands — they may not be concurrency-safe
   even over disjoint paths (shared build dirs, lockfiles, ports).
2. **Parent contract lane-status writes.** Step 3s step 5 marks the lane DONE in the *parent*
   contract's status table. Concurrent inner joins write the same table. The orchestrator owns
   these writes (`SKILL.md` → "Never let a subagent write a `PACT`"), so this is likely fine —
   confirm the writes are orchestrator-side and ordered.
3. **Reconciliation determinism.** The barrier guaranteed lane-map row order across runs.
   Overlapping joins complete in wall-clock order. Determinism must be re-established where it
   is actually observable — artifact write order, printed `SUBJOIN` line order — rather than
   assumed lost. Two runs over the same contract should still produce the same artifacts.
4. **`PARTIAL` routing.** A lane routed to `PARTIAL` mid-run while other leaves are still
   in flight. Confirm 3j's classification still sees a consistent picture.

## Expected effect

For a 3-way nested plan at the defaults, inner-join cost drops from 6 to 2 task-equivalents,
and adoptions 2 and 3 no longer each need to clear a fresh `J`. Combined with ADR-0012 this
is what makes multi-lane `full` reachable rather than theoretically available.

## Alternative rejected

**Charge `slowest-of-k` without changing Step 3s.** Rejected on sight: it prices a cost the
implementation does not have, which is the failure mode `references/config.md` → *Worked
example — the gate verdict and the ladder figure must agree* documents as having already
happened once.
