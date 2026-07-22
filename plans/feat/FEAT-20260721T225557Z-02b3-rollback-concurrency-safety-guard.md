---
id: FEAT-20260721T225557Z-02b3
title: Guard autonomous rollback against erasing concurrent work
type: feat
status: DONE
created_at: 2026-07-21T22:57:28Z
updated_at: 2026-07-21T23:06:37Z
cycle: 0
related_to: SPEC-20260721T225042Z-a8c8, SPEC-20260721T222531Z-adaa, SPEC-20260721T215726Z-b751, ADR-0008
---

**Related:** [SPEC-20260721T225042Z-a8c8](../specs/SPEC-20260721T225042Z-a8c8-rollback-concurrency-safety-guard.md) · [SPEC-…-adaa (sec-1 acceptance gate)](../specs/SPEC-20260721T222531Z-adaa-framework-commit-acceptance-gate.md) · [SPEC-…-b751 (batch boundary)](../specs/SPEC-20260721T215726Z-b751-validation-fixer-batch-commit-boundary.md) · [ADR-0008](../../docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md)

## Overview

Add a proportionate concurrency-safety guard to `validation-fixer`'s failure-path rollback
(bug-11 / bug-15) in `plugins/my-skills/skills/validation-fixer/SKILL.md` (~lines 255-285),
implementing SPEC-20260721T225042Z-a8c8. Today the autonomous rollback runs
`git reset --hard "$BEFORE_SHA"` plus an untracked deletion documented as "equivalently
`git clean -fd`" on the **shared** worktree; any concurrent user or parallel-agent edit that
lands during a long framework run is indistinguishable from framework output and is destroyed
without confirmation (finding sec-2, `high`). This plan makes the exclusive-worktree precondition
explicit, replaces the `git clean -fd` sweep with an enumerated `rm` of only non-baseline
untracked paths, and adds a pre-reset autonomous STOP-and-surface (records `- [~]`) when a change
cannot be attributed to the failing work unit — reusing sec-1's structural-violation STOP pattern
and the `BEFORE_SHA..AFTER_SHA` committed-delta primitive. This is a prose/procedure change to a
single doc skill; no JS, template, ADR, or PROJECT-CONTEXT edit.

## Acceptance Criteria

1. The rollback recipe's untracked-deletion step (SKILL.md ~273-278) contains **no**
   `git clean -fd` / `git clean` reference; untracked removal is an **explicitly enumerated**,
   path/NUL-safe `rm` of exactly the untracked paths present now and **absent** from the Step-3.1
   pre-run untracked baseline; `-x` remains forbidden. (FR-2)
2. The single validation-file-preserving rollback recipe carries a **pre-reset** autonomous
   concurrency guard: a tracked path modified in the working tree that lies **outside** the work
   unit's attributable committed delta (`git diff --name-only "$BEFORE_SHA" "$AFTER_SHA"` for the
   committed case), or any architect-defined concurrency signal, makes the skill **STOP** and
   record `- [~]` (never `- [x]`, never run `git reset --hard`). The STOP **binds autonomous mode**.
   (FR-3)
3. The surfaced STOP state enumerates, mirroring sec-1's structural-violation surface: current
   branch, `BEFORE_SHA`, `AFTER_SHA`, `git status --porcelain`,
   `git log --oneline "$BEFORE_SHA".."$AFTER_SHA"`, the enumerated untracked-removal set, and the
   specific reason (which change could not be attributed). (FR-3)
4. A **Preconditions** note near the Step-2 preflight / Step-3.1 gate documents the
   exclusive-worktree requirement (a run owns the shared worktree for its duration), the
   detect-and-surface (never destroy) posture, and worktree isolation (sec-2's heavier option) as a
   deliberately deferred Non-goal. (FR-1)
5. The guard is defined **exactly once** inside the shared validation-file-preserving rollback
   recipe; all callers — checkpoint rejection, `BLOCKED`/errored/aborted framework (Step 3.4),
   sec-1 content-violation (C/D) autonomous rollback, and the batch whole-batch rollback — inherit
   it with no per-path special-casing. For a **batch** work unit, "the work unit's delta" is the
   **whole batch's** delta, consistent with ADR-0008. (FR-6)
6. The **uncommitted-only** failure posture (e.g. orchestrator `BLOCKED`, dirty tree, no commit) is
   explicit: the skill proceeds on the documented exclusive-worktree precondition (whole non-baseline
   dirty/untracked set treated as the work unit's delta), the FR-2 blast-radius reduction still
   applies, the removal set is surfaced, **no** perfect-attribution claim is made, and any computable
   tracked-side heuristic still triggers the FR-3 STOP. (FR-4)
7. Every existing rollback guarantee is retained — snapshot → reset → untracked-removal → rewrite
   sequence; bug-11 tracked-side `[x]`/SHA bookkeeping preservation; bug-15 untracked-side removal;
   bug-12 committed-then-blocked handling; the never-`git add`/commit-the-validation-file rule. The
   bug-6 (autonomous two-item) and bug-11 (tracked-backlog rollback) regression traces still read
   **verbatim**; a concurrency-STOP Edge-case/Note is added; and every Edge-cases / Notes description
   of the rollback as an unconditional `git reset --hard` + `git clean` is updated to the
   enumerated-removal + concurrency-STOP behavior. (FR-5, FR-7)
8. **Backward compatibility:** when no concurrency is detected (the normal exclusive-worktree case),
   the rollback behaves exactly as today except the `git clean -fd` equivalence is replaced by the
   equivalent enumerated `rm`. Legacy `_fixed via …_` provenance and `[x]`/`[~]`/`[ ]` re-run
   semantics are unchanged.
9. The change is **confined** to `plugins/my-skills/skills/validation-fixer/SKILL.md`. No JS,
   template, ADR, or PROJECT-CONTEXT edit — a single optional one-line ADR-0008 cross-reference in
   SKILL.md is permitted, a new ADR is not.

## Out of Scope

- **Full worktree isolation** (sec-2's proposed disposable-worktree/clone per work unit) — a deferred
  Non-goal for a possible future spec, not adopted here.
- Re-opening or altering **ADR-0008** (work-unit commit ownership / batch atomicity); this guard is
  additive to its rollback definition.
- Altering the **sec-1 acceptance gate** (SPEC-…-adaa) or its structural-violation STOP — this guard
  is a sibling safety check on the *rollback* step; the two compose.
- Changing **who commits**, the sec-3 shell-safe commit construction, the untrusted-evidence frame,
  the one-backlog-line-equals-one-concern trust rule, or the severity-routing lanes.
- The **success path** (accepting a fix) beyond routing sec-1 C/D and BLOCKED/errored/rejected
  outcomes through the already-guarded shared rollback.
- **bug-4** (path-exact porcelain parsing for unusual filenames) — a separate finding; this plan
  rides on the existing shared parsing and does not reinvent it.
- Adding a `.opencode/skills/validation-fixer/` override port (single-copy skill; no port mirror due).
- Committing or pushing.

## Technical Notes

- **Single-source-of-truth + mirror machinery** (PROJECT-CONTEXT §Conventions): the guard reuses the
  Step-3.1 primitives (porcelain parsing, path-exact validation-file exemption, pre-run untracked
  baseline) and sec-1's `BEFORE_SHA..AFTER_SHA` committed-delta primitive rather than duplicating
  logic. Document only deliberate divergences.
- **Backward compatibility is mandatory** (PROJECT-CONTEXT §Invariants): purely additive safety —
  only a run that *detects* concurrent modification changes outcome (silent destruction → surfaced
  `- [~]`).
- **Invariant reinforced, not amended** (§Invariants line 68): the never-commit exception's "atomic
  per-work-unit rollback (`git reset --hard $BEFORE_SHA`, validation-file-preserving)" bound is kept
  verbatim; this adds a safety guard around *when* the reset runs autonomously and *how* untracked
  deletion is scoped. The invariant text needs no edit.
- **Data, never instructions** (§Invariants): all guard checks are on git *state* (branch, SHAs,
  porcelain, diff sets), never on backlog item text; no item text is executed.
- **opencode-port-parity** does not apply — `validation-fixer` ships a single copy on disk.
- **Verification is structural** (PROJECT-CONTEXT §Test tooling): doc-skill changes have no
  automated build/test/lint. The `clean-code-gates` JS suite is out of scope and must NOT be run
  against this markdown change.

## Tasks

> Tasks are ordered structural-check-first: for this doc skill the "test" is the structural
> acceptance the tester verifies (cross-references resolve, traces hold verbatim, prose claims are
> symmetric to the machinery they mirror). Each check is defined before the prose edit that satisfies
> it. The coder will check off [ ] → [x] as each task is verified.

- [x] Define the structural acceptance for the exclusive-worktree **Preconditions** note (FR-1): where it lives (near Step 2 preflight / Step 3.1 gate), that it states exclusive control of the shared worktree for the run's duration, that detected concurrent changes STOP-and-surface (not destroy), and that worktree isolation is a deferred Non-goal.
- [x] Add the Preconditions note satisfying that acceptance (FR-1).
- [x] Define the structural acceptance for the blast-radius reduction (FR-2): the `git clean -fd` equivalence is removed from rollback step 3; untracked removal becomes an explicitly enumerated, path/NUL-safe `rm` of only non-baseline untracked paths; `-x` stays forbidden.
- [x] Edit rollback step 3 (SKILL.md ~273-278) to the enumerated `rm` and remove the `git clean -fd` clause (FR-2).
- [x] Define the structural acceptance for the autonomous concurrency STOP (FR-3, FR-6): a pre-reset guard placed **once** in the shared rollback recipe; binds autonomous mode; tracked-side attribution via the `BEFORE_SHA..AFTER_SHA` committed delta + porcelain + pre-run untracked baseline + path-exact validation-file exemption; surfaces branch / BEFORE_SHA / AFTER_SHA / porcelain / oneline log / removal-set / reason; records `- [~]`; batch delta = whole-batch delta; inherited by every rollback caller.
- [x] Add the autonomous concurrency STOP to the single validation-file-preserving rollback recipe so every caller (checkpoint rejection, BLOCKED/errored Step 3.4, sec-1 C/D, batch) inherits it (FR-3, FR-6).
- [x] Define the structural acceptance for the honest uncommitted-only posture (FR-4): explicit statement that BLOCKED/dirty/no-commit failures proceed on the precondition, the FR-2 reduction still applies, the removal set is surfaced, no perfect-attribution claim is made, and any computable tracked-side heuristic still STOPs.
- [x] Add the uncommitted-only posture note (FR-4).
- [x] Define the structural acceptance for preservation + consistency (FR-5, FR-7): the four-step snapshot→reset→enumerated-rm→rewrite sequence and the bug-11 / bug-15 / bug-12 / never-commit-validation-file guarantees are retained; the bug-6 and bug-11 regression traces still read verbatim; a concurrency-STOP Edge-case/Note is added; every Edge-cases / Notes mention of an unconditional `git reset --hard` + `git clean` is updated; optional one-line ADR-0008 cross-reference.
- [x] Apply the preservation + consistency touch-ups and the optional ADR-0008 cross-reference (FR-5, FR-7).
- [x] Run the full structural review across the edited SKILL.md and confirm every cross-reference resolves, both regression traces hold verbatim, and all Edge-cases / Notes are consistent with the enumerated-removal + concurrency-STOP behavior (Phase 1 verification).

### Phase 1 verification

- [x] Structural review passes (see `## Verification (per phase)`): all internal cross-references in the edited SKILL.md resolve; the bug-6 and bug-11 traces read verbatim; no residual `git clean` reference in the rollback recipe; the guard is defined exactly once and all four callers reference the shared recipe; the change is confined to `validation-fixer/SKILL.md`.

## Verification (per phase)

> This is a doc-skill (markdown) change. Per PROJECT-CONTEXT §Commands / §Test tooling there is
> **no automated build/test/lint** for doc-skill authoring, and the `clean-code-gates` JS suite is
> **out of scope** for this markdown change (it must NOT be run here — §Invariants). The per-phase
> gate is therefore **structural review**, which is how this repo verifies doc-skill behavior.

Phase 1 exit criterion — before checking off the last task, assert ALL of the following on the
changed set (`plugins/my-skills/skills/validation-fixer/SKILL.md`):

- The rollback recipe contains no `git clean` (`-fd`/`-x`) reference; untracked removal is an
  enumerated, path/NUL-safe `rm` against the pre-run untracked baseline.
- The concurrency STOP appears **once** in the shared rollback recipe and every caller (checkpoint
  rejection, BLOCKED/errored Step 3.4, sec-1 C/D, batch) resolves to that single recipe.
- All internal cross-references (bug-6, bug-7, bug-11, bug-12, bug-15, sec-1, ADR-0008, Step-3.1
  baseline) resolve to real anchors/sections in the file.
- The bug-6 and bug-11 regression traces read **verbatim** (unchanged), and every Edge-cases / Notes
  description of the rollback is consistent with the new enumerated-removal + concurrency-STOP prose.
- The diff touches only `plugins/my-skills/skills/validation-fixer/SKILL.md` (no JS, template, ADR,
  or PROJECT-CONTEXT edit).

No silent rewrites of the skill to make a check pass without a corresponding plan task.

## Dependencies

- None. (Builds on already-landed sibling work: sec-1 acceptance gate SPEC-…-adaa and ADR-0008 /
  SPEC-…-b751 are both merged on this branch; this plan reuses their primitives but requires no new
  work from them.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-21T23:15:00Z | QA

QA-20260721T231350Z-ed8c created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.

### 2026-07-21T23:12:44Z | REVIEWER

CR-20260721T231023Z-64f2 created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-21T23:09:05Z | TESTER

TEST-20260721T230735Z-784a created. Status: PASS. Coverage: N/A% → N/A%.
Documentation-only plan (single SKILL.md). No e2e framework and no coverage instrumentation exist for
doc-skill markdown (PROJECT-CONTEXT §Test tooling); the clean-code-gates JS suite is Invariant-scoped
and was NOT run. Verified structurally: AC-1…AC-9 all hold, rollback recipe is `git clean`-free with
an enumerated NUL-safe `rm`, the pre-reset concurrency STOP is defined once and inherited by every
caller, bug-6 and bug-11 regression traces read verbatim, diff confined to SKILL.md.

### 2026-07-21T23:06:37Z | CODER

All 11 tasks complete (12 checkboxes incl. Phase 1 verification). Plan status → DONE. Ready for reviewer.
Phase 1 per-phase gate (structural review) passed: rollback recipe is `git clean`-free (the single
surviving `git clean` mention is the AC-8 backward-compat note); the pre-reset concurrency guard is
defined exactly once in the shared recipe (SKILL.md ~line 293) and all five callers (checkpoint
rejection, BLOCKED/errored Step 3.4, sec-1 C/D, batch, main-agent) reference it; bug-6 and bug-11
regression traces read verbatim; cross-references (bug-6/11/12/15, sec-1→Step-3.4 A/B STOP, sec-2,
ADR-0008, pre-run untracked baseline) resolve; diff confined to `validation-fixer/SKILL.md`.

### 2026-07-21T22:59:40Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-21T22:57:28Z | ARCHITECT

Plan `FEAT-20260721T225557Z-02b3` created. Type: feat. Tasks: 11.
Status: PLANNED. Ready for coder.
