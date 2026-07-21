# ADR-0008 — Work-unit commit ownership and batch atomicity (validation-fixer)

- **Status:** Accepted
- **Date:** 2026-07-21
- **Supersedes:** [ADR-0007 — Commit ownership after READY_TO_COMMIT (validation-fixer exception)](0007-validation-fixer-commit-ownership.md)
- **Skills affected:** `validation-fixer` (`SKILL.md` Step 2.5 routing, Step 3.4 commit-ownership, the orchestrator routing lanes, and the bug-6 / bug-11 worked traces); the repo commit policy in `.orchestrator/PROJECT-CONTEXT.md` §Invariants
- **Source finding:** arch-1 — "batch lane lands one shared commit yet cites ADR-0007, whose Decision authorizes commit ownership only for the single item it is reconciling and whose Alternatives section explicitly rejects batch commits" (`docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md` §Architecture). Supersedes ADR-0007, whose single-item boundary predates the severity-routing batch lane.

## Context

ADR-0007 established `validation-fixer` as the repo's **one** documented exception to the
never-commit invariant: it owns the per-item commit for frameworks that stop at
`READY_TO_COMMIT` (or otherwise leave a successful fix uncommitted). It bounded that
exception to "the single item it is currently reconciling" — one item = one commit = one
revertible unit — and, in its Alternatives section, **explicitly rejected** a batch commit
("one commit for all fixed items at the end … loses per-item provenance and per-item
rollback … Per-item atomicity is the point").

Since ADR-0007 was accepted, `validation-fixer` gained **severity routing** (SPEC-
20260721T181347Z-1089). Findings are triaged into lanes: `crit`/`high`/`unknown` run a
**dedicated** single-item orchestrator run; `low`/`info` are fixed inline in the
**main-agent** lane; and ≥2 `med` findings grouped by their `## ` lens section run through a
**batch** lane — **one combined orchestrator run** that lands **one shared commit**, with
**whole-batch rollback** on failure and the shared SHA(s) recorded on every member's
`_fixed via …_` line.

The batch lane is a **deliberate deliverable** of the severity-routing branch, but its
shared-commit / shared-SHA / whole-batch-rollback behavior is exactly what ADR-0007's
Decision boundary and rejected batch sub-decision forbid. So a shipped SKILL.md behavior
cites — and is governed by — an ADR that rejects it (finding arch-1). An invariant with an
unwritten *or contradicted* exception is a trap for the next author; the citation must point
at an ADR that actually authorizes the behavior at that citation.

The reasons ADR-0007 rejected a batch commit assumed the batch was an **unstructured,
end-of-run bundle of unrelated items** — no explicit approval of *which* items batch, and a
single failure stranding or reverting work the operator never grouped. The severity-routing
batch lane is a **different construct**: an **explicitly approved group** (Step-2.5 routing
plan) of `med` findings that share one lens section, run as **one combined orchestrator
run**, that either **all succeed together** or **all roll back together**. Under that
construct the atomic unit is not the individual finding — it is the **approved group**. This
ADR redefines the revertible unit accordingly and re-decides the batch sub-decision on those
grounds.

## Decision

**The revertible unit for `validation-fixer` commit ownership is a `work unit`: either a
single item (dedicated lane, or main-agent lane, or a batch-of-one that collapsed to the
dedicated lane) OR an approved batch of ≥2 members (batch lane). `validation-fixer` owns
**one** commit per work unit for fix producers that stop at `READY_TO_COMMIT` (or otherwise
leave a successful fix uncommitted). One work unit = one commit = one revertible unit. No
other skill gains this right.**

A single item is a work unit of **size 1**; the ADR-0007 single-item contract is the size-1
special case of this rule, unchanged in effect for the dedicated and main-agent lanes. The
exception stays bounded by the exact safeguards the never-commit policy protects — a human
stays in control of history, and every work unit is atomic and reversible — now defined
across the four dimensions the batch lane touches:

1. **Authorization (two gates, not one).**
   - **Step-2.5 routing-plan approval** authorizes **which items form each work unit** —
     which findings collapse to dedicated single-item runs, which `med` findings batch
     together by lens section. In **checkpoint** mode the operator explicitly approves the
     routing plan (and therefore each batch's membership); in **autonomous** mode, opting in
     *is* the standing approval of the routing plan.
   - **Step-3.4 per-commit approval** authorizes **the commit itself**. In checkpoint mode
     the operator sees the work unit's diff + intended message and approves before the commit
     (for a batch, one diff spanning all members' code paths, one joined message); on
     rejection, the validation-file-preserving rollback runs and the members stay `- [ ]`. In
     autonomous mode the standing approval covers the commit.
   Together these authorize a batch's **one shared commit**: the operator approved *both*
   which findings batch (Step 2.5) *and* the resulting commit (Step 3.4).

2. **Provenance (shared SHA = intentional N-findings→1-commit mapping).** A work unit's
   commit SHA(s) are recorded on the `_fixed via <framework> · <sha(s)> · <date>_` line of
   **every** member. For a size-1 work unit that is one member carrying its own SHA (the
   legacy line, unchanged). For a batch it is the **same shared SHA(s)** on **every** member
   — an intentional **N-findings → 1-commit** mapping, not an accident. **A reader interprets
   a shared SHA as: these N findings were verified and fixed as one combined orchestrator run
   and committed together as one atomic work unit; reverting that one commit reverts all N
   together.** The shared SHA is the durable evidence of that grouping, carried forward by the
   prior-only retention trail after a finding leaves the diff.

3. **Rollback (whole-work-unit atomicity).** Every work unit begins from a clean tree (the
   Step-1 / bug-6 precondition, validation-file exempt) with `$BEFORE_SHA = HEAD`. A work
   unit that is rejected, `BLOCKED`, or errored — **even with partial commits** (bug-12) — is
   restored by the **validation-file-preserving rollback (bug-11, bug-15)** to `$BEFORE_SHA`,
   discarding the work unit's whole delta: **tracked** edits, partial **commits** in
   `BEFORE_SHA..AFTER_SHA`, **and** framework-created **untracked** files, while **preserving
   every validation file** (the skill's untracked scratchpad and its in-file bookkeeping). For
   a batch, "the work unit's delta" is the **whole batch's** delta and **every** constituent
   member records `- [~]` — a batch never lands a partial success, never strands one member
   fixed while another rolled back. For a size-1 work unit this is the ADR-0007 per-item
   rollback verbatim. **Protected-branch semantics are unchanged:** the Step-2 run-wide
   preflight (bug-7) STOPs on `main`/`master`/`dev` (or detached HEAD) before any framework
   is invoked; autonomous mode does not override it; a cheap re-assert at the commit step
   remains as defense-in-depth.

4. **Resumability (per-work-unit done-marker).** On success **all members** of a work unit
   are marked `- [x]` together, each carrying the work unit's SHA(s) (the shared SHA for a
   batch), so a re-run skips them together. On failure **all members** are marked `- [~]`
   together (needs attention), so a re-run re-attempts them together. The durable done-marker
   granularity is **per work unit**, not per finding — a size-1 work unit's single `[x]` is
   the special case.

`.orchestrator/PROJECT-CONTEXT.md` §Invariants is amended to cite this ADR, to use
per-work-unit rollback wording, and to reaffirm that **no other skill may commit** — the
exception stays narrow (still `validation-fixer` alone).

## Alternatives considered

- **(A) Keep ADR-0007's single-item boundary; remove the batch lane's shared commit** — give
  each `med` finding its own per-item commit and independent rollback, collapsing the batch
  lane to per-item behavior, and leave ADR-0007 in force. Rejected: it guts a deliberate
  deliverable of the severity-routing branch (the combined-run batch lane), trades the
  operator-approved N→1 grouping for N unrequested commits, and loses the whole-batch
  atomicity the lane is designed around. It resolves the citation contradiction only by
  deleting the behavior, not by governing it. (Recorded as the fallback the coder must
  surface via BLOCKED if supersession proves untenable, not silently switch to.)
- **(B) Narrowly amend ADR-0007 to carve out the batch lane** — leave ADR-0007 governing the
  single-item lanes and add a batch clause. Rejected: it splits authority for the same
  Step-3.4 commit step across two overlapping ADRs, so a future reader must reconcile them to
  know which governs a given commit — the same "which ADR authorizes this?" ambiguity this
  change exists to remove.
- **(C — chosen) Supersede ADR-0007 with a single work-unit contract.** ADR-0008 restates the
  complete commit-ownership contract at **work-unit** granularity — single item = size 1,
  approved batch = size ≥2 — so there is **one** governing ADR and **one** citation target for
  every lane's commit. It preserves the batch lane and the single-item behavior alike, and
  turns the contradicted citation into an authorizing one.
- **Re-decision of ADR-0007's "Batch-commit sub-decision — Rejected."** ADR-0007 rejected a
  batch commit because it "loses per-item provenance and per-item rollback, and a single
  failure would strand or revert the whole batch." **Re-decided here as authorized**, with
  justification: (a) **provenance is not lost** — the shared SHA on every member is an
  *intentional, documented* N→1 mapping a reader can interpret, not an erased trail; (b) the
  batch is an **approved unit** (Step-2.5 routing plan), so "strand or revert the whole batch"
  is the *intended* atomicity, not an accident — reverting the one commit reverts exactly the
  group the operator approved; (c) ADR-0007 assumed an unstructured end-of-run bundle, whereas
  the severity-routing batch is **one combined orchestrator run** over a lens-section group.
  Per-item atomicity remains the rule for size-1 work units (dedicated / main-agent lanes);
  the batch simply makes the *approved group* the atomic unit.

## Consequences

- The never-commit invariant still has exactly **one** named exception (`validation-fixer`);
  the orchestrator/PM and every other skill still stop at `READY_TO_COMMIT`. Redefining the
  exception's unit from "item" to "work unit" does **not** broaden *which* skill may commit —
  it only defines the granularity of that one skill's revertible unit.
- All three orchestrator routing lanes now cite **one** governing ADR for their commit: the
  dedicated and main-agent lanes as work units of size 1 (behavior unchanged from ADR-0007),
  the batch lane as a work unit of size ≥2 (its shared-commit / shared-SHA / whole-batch
  rollback / joint resumability now authorized, not contradicted).
- **Backward compatibility holds.** A legacy single-SHA `_fixed via <framework> · <sha> ·
  <date>_` line is a size-1 work unit's record and still parses and renders unchanged; the
  shared-SHA batch line is **additive**, not a migration. A re-run over a pre-existing backlog
  behaves identically for `[x]`/`[~]`/`[ ]` items.
- **Security model preserved.** The untrusted-evidence frame, the one-line-per-concern trust
  rule, and the sec-3 shell-safe commit construction are unchanged; a batch's "combined brief,
  trust never merged" guarantee (each member's evidence block individually wrapped, one
  backlog line = one concern) is intact. The joined batch commit message is still built from
  each member's one-physical-line summary, never interpolated into a shell string.
- ADR-0007 is retained as the historical record this ADR revisits — Status flipped to
  "Superseded by ADR-0008" with a forward pointer, its reasoning and rejected sub-decision
  preserved unchanged.
- `validation-fixer` ships a single copy (no `.opencode` override port), so this change is the
  ADR pair, the SKILL.md citation/authorization wording, and the policy amendment; no port
  mirror is due.
