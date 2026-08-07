# ADR-0011 — Contract amendment is an atomic state transition, not a document rewrite

- **Status:** Accepted
- **Date:** 2026-08-07
- **Skills affected:** `orchestrator` (`SKILL.md` → Steps 2c, 3j.2, 3j.3; `references/config.md` → `max_contract_amendments`)
- **Source finding:** arch-2 — "Contract amendments have no executable state transition" (`plugins/my-skills/skills/orchestrator/SKILL.md:895`).

## Context

The orchestrator's parallel path freezes a `PACT` interface contract before any lane starts.
When a lane coder discovers a frozen shape is wrong it stops with the reserved reason
`contract violation`, and the join enters the **amendment loop** (Step 3j.2).

As originally written, that loop was three sentences: write an amended contract, re-slice,
increment the counter. Every one of those is a *document* operation. None of them said what
happens to the **run's state** — which is where the real work is:

- Contract and plan IDs are **orchestrator-allocated**, never self-numbered by a subagent
  (the mandatory preamble's `ID to use:` rule). An amendment needs new IDs for the amended
  contract and for every replacement leaf plan, and nothing allocated them.
- The run holds an **active contract tree** (parent `PACT`, plus a sub-contract per adopted
  lane) and a **leaf set** that `leaves=` carries to every join-level role. An amendment
  changes both, and nothing rebound them — so the superseded contract stayed addressable and
  the join could still resolve leaves from it.
- "Resume the affected leaves" left **which leaves are affected** undefined, and said nothing
  about the completed ones. A `DONE` leaf that produced a row the amendment reshaped is
  finished work against a shape that no longer holds — silently keeping it is a correctness
  hole, and silently re-running everything throws away the split's entire payoff.

The gap is structural rather than cosmetic: an amendment is the **only** point where the
contract tree and the leaf set — both frozen precisely so the fan-out can be reasoned about —
legitimately change mid-run. Leaving that transition unspecified meant the one moment the
invariants move was the one moment nothing described how.

## Decision

**Model contract amendment as an atomic transaction over the run's contract tree and leaf
set, specified as numbered steps in Step 3j.2.** It either completes fully and leaves one
coherent tree and leaf set, or it fails and the run halts `PARTIAL` (3j.1). Concretely:

1. **Scope first** — the narrowest contract that can fix the violated row (the existing
   sub-contract-vs-parent escalation table), and from it the *affected set*.
2. **Allocate every replacement ID up front**, before any spawn — `newid PACT` for the
   amended contract and each invalidated sub-contract, `newid FEAT` per affected leaf —
   under the same no-directory-scan rule the initial fan-out uses.
3. **Author and verify** the amended contract through the existing Step 2c / 2s.3 verification.
   The superseded contract stays on disk **unmodified**: it is history, not state.
4. **Rebind the active contract.** The amended contract replaces the superseded one in the
   tree. On a **parent** amendment, `root_plan_id` (ADR: see *Consequences*) rebinds to the
   amended parent ID. The superseded ID never dispatches, verifies, or invokes a role again.
5. **Partition the leaf set.** A leaf is **preserved** only when it is `DONE` *and* the
   amendment touched no row it produces or consumes and no glob it owns. Everything else —
   including a `DONE` leaf whose shapes moved, and every leaf of a re-authored sub-contract —
   is **invalidated**.
6. **Rebuild the leaf set**; preserved leaves keep their plan IDs, invalidated leaves take the
   pre-allocated replacements with new plans authored and verified per Step 2L.
7. **Re-dispatch only the invalidated leaves**, under the same `max_parallel_lanes` wave rule.
8. **Increment `amendment_count`** and return to the join.

An `AMEND — {superseded} → {amended}` stanza is printed with the preserved/invalidated
partition, so an amended run is never indistinguishable from a first-pass one in the transcript.

## Consequences

**Positive.**

- The amendment loop is now executable rather than aspirational: every state the run holds has
  a defined value on the other side of it.
- Preservation is **conservative by construction** — the rule keeps a leaf only when it is
  provably untouched, so the failure mode is redundant re-work, never silently shipping work
  built against a superseded shape.
- Narrow amendment keeps its payoff. Because the partition is computed from the amended
  contract's own rows and globs, a sub-contract amendment still re-slices exactly one lane —
  which is the reason the contract was split in the first place.
- The transaction reuses existing machinery end to end (`newid`, Step 2c/2s.3 verification,
  Step 2L authoring, Step 3L wave dispatch). It adds no new artifact type, no new directory,
  and no new status token.

**Negative / accepted costs.**

- Step 3j.2 grew from three sentences to eight steps plus a printed stanza. That is the honest
  size of the transition; compressing it is what produced the gap.
- `root_plan_id` — introduced by arch-1's fix as immutable — now has exactly **one** rebinding
  point (a parent amendment). A single documented exception is preferable to the alternative of
  leaving the aggregate pointing at a superseded contract, but it is an exception, and it must
  stay the only one.
- Re-authoring an invalidated sub-contract costs a full architect pass. This is deliberate:
  patching a contract in place would leave the two levels disagreeing about a frozen shape,
  which is the class of bug the contract exists to prevent.

**Bounded by the existing cap.** `max_contract_amendments` remains one budget shared across
both depths, so this ADR makes each amendment *well-defined*, not *cheaper* — the run still
abandons parallel execution and continues sequentially when the cap is reached.
