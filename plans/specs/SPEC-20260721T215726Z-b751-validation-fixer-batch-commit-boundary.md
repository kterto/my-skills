---
id: SPEC-20260721T215726Z-b751
title: Reconcile validation-fixer batch commits with the commit-ownership ADR
status: READY_FOR_PLANNING
created_at: 2026-07-21T21:59:40Z
updated_at: 2026-07-21T21:59:40Z
cycle: 0
related_to: SPEC-20260721T181347Z-1089, ADR-0007
---

## Summary

The `validation-fixer` skill's new severity-routing **batch lane** (SKILL.md
lines 440-464) has ≥2 `med` findings share **one combined orchestrator run and one
shared commit**, with **whole-batch rollback** on failure. This directly
contradicts **ADR-0007** (accepted), whose Decision authorizes commit ownership
"only for the single item it is currently reconciling" and whose Alternatives
section **explicitly rejects** batch commits ("loses per-item provenance and
per-item rollback… Per-item atomicity is the point"). This spec closes that
architectural contradiction by re-establishing a single, self-consistent
commit-ownership contract that covers both the single-item lanes and the batch
lane, so no shipped SKILL.md behavior cites an ADR that forbids it.

## Goals

- The `validation-fixer` commit-ownership contract and its governing ADR agree:
  no SKILL.md text describes a commit behavior that the governing ADR rejects.
- The batch lane's shared-commit, shared-SHA provenance, whole-batch rollback,
  and joint resumability are either **explicitly authorized** by the governing
  ADR or **removed** in favor of per-finding commits — with one coherent choice
  applied everywhere.
- Every ADR citation inside `validation-fixer/SKILL.md` (lines 337, 405, 425,
  453) points at an ADR that actually authorizes the behavior at that citation.
- The `.orchestrator/PROJECT-CONTEXT.md` §Invariants commit-exception clause
  (line 68) matches the redefined boundary (its current wording, "atomic
  per-item rollback," is consistent only with the single-item model).
- The finding `arch-1` in
  `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`
  is fully resolvable — one commit per finding, or a supersession that authorizes
  the multi-item work unit.

## Non-goals

- **arch-2** (directory-mode "collapse everything" vs. Q4 batch-never-spans-files
  ambiguity, same review §Architecture) — a separate finding, out of scope here.
- The **main-agent-lane user-edit** finding (moving non-`low`/`info` items into
  the main-agent lane) — a separate finding, out of scope here.
- Any change to the **superpowers** / **gsd** framework paths — those keep their
  unchanged per-item loop and are untouched by this contradiction.
- Redesigning the severity-routing feature itself (lanes, severity tokens,
  routing-plan approval) beyond the commit/rollback/provenance boundary.
- Adding a `.opencode` override port for `validation-fixer` (it ships a single
  copy — see Project-context fit).
- Committing or pushing the fix (the pipeline stops at READY_TO_COMMIT).

## Users and use cases

- **Skill maintainer (this repo's author)**: relies on ADRs as the durable,
  auditable record of *why* a skill may do something the global invariants
  otherwise forbid. A SKILL.md that commits in a way its cited ADR rejects makes
  the ADR a trap for the next author; this spec restores the ADR↔SKILL agreement.
- **Downstream `validation-fixer` operator (via `/validation-fixer`)**: runs the
  orchestrator framework in batch-capable mode over a `med`-heavy findings
  backlog. Success = the batch lane's commit/rollback behavior is governed by an
  ADR that authorizes it, so provenance (`_fixed via … · <sha> · <date>_`) and
  resumability remain trustworthy.

## Functional requirements

1. **Adopt one commit-ownership contract for all lanes.** The chosen resolution
   (see "Decisions resolved by Brainstormer default": supersede ADR-0007 with
   ADR-0008, redefining the revertible unit as a **work unit** — a single item OR
   an approved batch of ≥2) MUST be applied consistently to the dedicated,
   main-agent, and batch lanes. No lane may cite an ADR that forbids its behavior.
2. **Author ADR-0008** at `docs/adr/0008-*.md`, titled per the review's suggested
   ADR ("Work-unit commit ownership and batch atomicity"), Status **Accepted**,
   that **supersedes ADR-0007** and redefines all four dimensions the review
   names, around an explicitly approved multi-item work unit:
   - **Authorization:** the Step-2.5 routing-plan approval (checkpoint = explicit
     approval of which items batch; autonomous = standing approval) plus the
     Step-3.4 per-commit diff approval (checkpoint) authorizes the batch's one
     shared commit.
   - **Provenance:** a batch's shared SHA(s) recorded on **every** member's
     `_fixed via orchestrator · <shared-sha(s)> · <date>_` line is an intentional
     N-findings→1-commit mapping; the ADR states how a reader interprets a shared
     SHA across members.
   - **Rollback:** the atomic revertible unit is the **work unit** ("one work unit
     = one commit = one revertible unit"); whole-batch rollback on a `BLOCKED`/
     errored batch (tracked + untracked, validation files preserved) is the
     intended behavior, not the forbidden one.
   - **Resumability:** all members of a successful batch are marked `[x]` together
     with the shared SHA and skipped together on re-run; a failed batch marks all
     members `[~]` together. The done-marker granularity is per-work-unit.
3. **Mark ADR-0007 superseded.** Flip ADR-0007's Status line to
   "Superseded by ADR-0008" with a forward pointer, preserving its body per the
   ADR-lifecycle convention (do not delete or rewrite its reasoning).
4. **Repoint SKILL.md ADR citations.** Every `ADR-0007` reference in
   `validation-fixer/SKILL.md` (lines 337, 405, 425, 453) MUST cite the governing
   ADR (ADR-0008) — or ADR-0007-as-superseded-by-ADR-0008 — so that the batch
   lane's "one shared commit" citation (line 453) and the single-item lanes' cites
   all point at an ADR that authorizes them. The dedicated/main-agent single-item
   commit remains authorized (single item = work unit of size 1).
5. **Amend the policy invariant.** Update `.orchestrator/PROJECT-CONTEXT.md`
   §Invariants (line 68) so the documented exception cites ADR-0008 and its
   rollback wording reflects **per-work-unit** atomicity (currently "atomic
   per-item rollback"), while still naming the same safeguards (checkpoint/standing
   approval, validation-file-preserving rollback, protected-branch STOP) and still
   reaffirming that **no other skill may commit**.
6. **Preserve the regression guards.** The "Autonomous two-item lifecycle
   (bug-6)" and "Tracked-backlog rollback lifecycle (bug-11)" worked traces, and
   the batch-note addenda under them, MUST remain internally consistent with the
   redefined boundary (a batch is one shared-commit revertible unit; two
   *dedicated* items remain two separate commits).
7. **No behavioral change to superpowers/gsd or to the severity-routing
   mechanics** beyond the commit/rollback/provenance/resumability wording the
   contradiction touches. One backlog line still equals exactly one concern
   (Step-1 trust rule); the untrusted-evidence frame is unchanged.

> **Note for the architect (alternative resolution).** If, on review, superseding
> ADR-0007 is judged too heavy, the review's other offered fix — **"keep one
> commit per finding"** — is the fallback: remove the batch lane's shared-commit
> (each `med` item gets its own per-item commit and independent rollback,
> collapsing the batch lane to per-item behavior) and leave ADR-0007 in force.
> The brainstormer default (below) is supersede-and-preserve; the architect owns
> the final direction and should record it if it diverges.

## Non-functional requirements

- **Performance**: —
- **Security / auth**: The untrusted-evidence frame, one-line-per-concern trust
  rule, and sec-3 shell-safe commit construction MUST be preserved verbatim in
  meaning; the batch's "combined brief, trust never merged" guarantee stays intact.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: —
- **Monetization tier**: —

## Project-context fit

- **Layers touched:** the `validation-fixer` skill source
  (`plugins/my-skills/skills/validation-fixer/SKILL.md`), the ADR record
  (`docs/adr/`), and the policy trust anchor
  (`.orchestrator/PROJECT-CONTEXT.md` §Invariants).
- **Invariant in play:** PROJECT-CONTEXT §Invariants line 68 names
  `validation-fixer` as the **single** documented exception to
  never-commit, bounded by "atomic per-item rollback." Redefining the unit to a
  work unit means this invariant is the load-bearing text to amend — and it is a
  **policy trust anchor** (loaded from merge-base), so the amendment must keep the
  exception narrow and still reaffirm "no other skill may commit."
- **Convention — mirror machinery:** ADR-0008 mirrors ADR-0007's structure
  (Context / Decision / Alternatives / Consequences) and the SKILL.md citation
  style; ADR-0007's own "Batch-commit sub-decision — Rejected" alternative is the
  precise clause ADR-0008 must revisit and re-decide with justification.
- **Backward compatibility (mandatory invariant):** legacy already-recorded
  `_fixed via <framework> · <sha> · <date>_` lines (single-SHA, single item)
  MUST still parse and render unchanged; the shared-SHA batch line is additive,
  not a migration. A re-run over a pre-existing backlog behaves identically for
  `[x]`/`[~]`/`[ ]` items.
- **opencode-port-parity:** `validation-fixer` ships a **single copy** (no
  `.opencode/skills/validation-fixer/` override port — confirmed on disk and in
  ADR-0007 §Consequences), so no port mirror is due for this change.
- **Precedent/dependency:** SPEC-20260721T181347Z-1089
  (orchestrator-skill-severity-routing) is the spec that introduced the batch
  lane whose commit behavior this spec reconciles; ADR-0007 is the governing
  decision being superseded.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**:
  - `plugins/my-skills/skills/validation-fixer/SKILL.md` — batch-lane commit
    wording (lines 440-464, esp. 451-457) + ADR citations (337, 405, 425, 453);
    regression-trace batch notes kept consistent.
  - `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` — NEW ADR
    (exact filename slug at architect's discretion), supersedes ADR-0007.
  - `docs/adr/0007-validation-fixer-commit-ownership.md` — Status → "Superseded
    by ADR-0008" + forward pointer (body preserved).
  - `.orchestrator/PROJECT-CONTEXT.md` §Invariants line 68 — cite ADR-0008,
    per-work-unit rollback wording.

## Open questions

<!-- Empty: no unauthorized reserved decision remains. The (a) vs (b) resolution
     fork is an ordinary architecture-governance choice, resolved by the
     Brainstormer default below and auditable by the architect. -->

- (none)

## Decisions resolved by Brainstormer default

- **Resolution direction — supersede ADR-0007 vs. remove batch shared-commit** →
  **Default: supersede ADR-0007 with ADR-0008 and preserve the batch lane**
  (redefine the revertible unit as an approved work unit) → the branch
  `feat/validation-fixer-severity-routing` shipped the batch lane as a core
  deliverable, and the review's own Fix text pre-names the ADR-0008 that this path
  creates ("Work-unit commit ownership and batch atomicity"); superseding is the
  intent-preserving, lowest-surprise resolution, whereas "keep one commit per
  finding" would gut a deliberate feature of this very branch. The alternative
  remains available to the architect (see the Functional-requirements note).
- **ADR-0008 supersedes vs. narrowly amends ADR-0007** → **Default: full
  supersession** — ADR-0008 restates the complete commit-ownership contract at
  work-unit granularity (single item = work unit of size 1; batch = size ≥2), so
  there is one governing ADR rather than two overlapping ones → cleaner citation
  target and avoids a split authority for the same commit step.
- **ADR-0007 disposition** → **Default: Status flip to "Superseded by ADR-0008"
  with a forward pointer, body preserved** → standard ADR-lifecycle convention;
  keeps ADR-0007's reasoning (including its rejected batch sub-decision) as the
  historical record ADR-0008 revisits.

## References

- `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`
  §Architecture → finding `arch-1` (the source concern).
- `plugins/my-skills/skills/validation-fixer/SKILL.md` — batch lane (lines
  440-464, anchor 451) and ADR citations (337, 405, 425, 453).
- `docs/adr/0007-validation-fixer-commit-ownership.md` — §Decision (single-item
  boundary) and §Alternatives ("Batch-commit sub-decision — Rejected").
- `.orchestrator/PROJECT-CONTEXT.md` §Invariants (line 68) — the documented
  never-commit exception.
- `plans/specs/SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md`
  — the spec that introduced the batch lane.
