---
id: FEAT-20260721T220140Z-7b61
title: Reconcile validation-fixer batch commits with the commit-ownership ADR
type: feat
status: DONE
created_at: 2026-07-21T22:02:01Z
updated_at: 2026-07-21T22:13:21Z
cycle: 0
related_to: SPEC-20260721T215726Z-b751, ADR-0007, ADR-0008
---

**Related:** [SPEC-20260721T215726Z-b751](../specs/SPEC-20260721T215726Z-b751-validation-fixer-batch-commit-boundary.md)

## Overview

The `validation-fixer` batch lane (SKILL.md 440-464) runs ≥2 `med` findings through
**one combined orchestrator run + one shared commit** with **whole-batch rollback**,
yet cites **ADR-0007**, whose Decision authorizes commit ownership "only for the single
item it is currently reconciling" and whose Alternatives section **explicitly rejects**
batch commits. This plan closes that contradiction (source finding `arch-1`) by adopting
the Brainstormer-default resolution: **author ADR-0008** ("Work-unit commit ownership and
batch atomicity") redefining the revertible unit as a **work unit** (a single item OR an
approved batch of ≥2), **supersede ADR-0007**, then repoint every SKILL.md citation and
amend the `.orchestrator/PROJECT-CONTEXT.md` §Invariants trust anchor so no shipped
behavior cites an ADR that forbids it. Doc-only reconciliation — no runtime code.

## Acceptance Criteria

1. `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` exists with Status
   **Accepted**, mirrors ADR-0007's Context / Decision / Alternatives / Consequences
   structure, states that it **supersedes ADR-0007**, and defines all four dimensions —
   **authorization** (Step-2.5 routing-plan approval + Step-3.4 per-commit diff approval),
   **provenance** (shared SHA(s) on every member's `_fixed via …_` line as an intentional
   N-findings→1-commit mapping, with how a reader interprets a shared SHA), **rollback**
   ("one work unit = one commit = one revertible unit"; whole-batch rollback on BLOCKED/
   errored, tracked + untracked, validation files preserved), and **resumability** (all
   members `[x]` together on success / `[~]` together on failure; per-work-unit granularity)
   — around a work unit = single item OR approved batch ≥2.
2. `docs/adr/0007-validation-fixer-commit-ownership.md` Status line reads
   "Superseded by ADR-0008" with a forward pointer; the remainder of its body (including its
   rejected batch-commit sub-decision) is preserved unchanged.
3. Every `ADR-0007` citation in `validation-fixer/SKILL.md` (lines ~337, ~405, ~425, ~453)
   points at the governing ADR (ADR-0008, or ADR-0007-as-superseded-by-ADR-0008); no
   citation — the batch lane's `~453` included — points at an ADR that forbids the behavior
   at that citation.
4. The batch lane (SKILL.md ~440-464) describes its shared-commit, shared-SHA provenance,
   whole-batch rollback, and joint resumability as **authorized** under the work-unit
   contract; the single-item dedicated / main-agent lanes remain authorized as work units of
   size 1.
5. `.orchestrator/PROJECT-CONTEXT.md` §Invariants (line 68) cites **ADR-0008**, replaces
   "atomic per-item rollback" with **per-work-unit** rollback wording, still names the same
   three safeguards (checkpoint/standing approval, validation-file-preserving rollback,
   protected-branch STOP), and still reaffirms **"no other skill may commit"** with the
   exception kept narrow.
6. The "Autonomous two-item lifecycle (bug-6)" and "Tracked-backlog rollback lifecycle
   (bug-11)" worked traces and their batch-note addenda are internally consistent with the
   redefined boundary: a batch is one shared-commit revertible unit; two **dedicated** items
   remain two separate commits.
7. No behavioral change to the superpowers/gsd paths or the severity-routing mechanics
   beyond the commit/rollback/provenance/resumability wording; the one-line-per-concern
   Step-1 trust rule, the untrusted-evidence frame, and the sec-3 shell-safe commit
   construction are preserved verbatim in meaning.
8. Backward compatibility holds: legacy single-SHA `_fixed via <framework> · <sha> · <date>_`
   lines still parse and render; the shared-SHA batch line is additive, not a migration.

## Out of Scope

- **arch-2** (directory-mode "collapse everything" vs. Q4 batch-never-spans-files ambiguity)
  — a separate finding, not touched here.
- The **main-agent-lane user-edit** finding (moving non-`low`/`info` items into the
  main-agent lane) — separate finding, out of scope.
- Any change to the **superpowers** / **gsd** framework paths (unchanged per-item loop).
- Redesigning the severity-routing feature (lanes, severity tokens, routing-plan approval)
  beyond the commit/rollback/provenance/resumability boundary.
- Adding a `.opencode/skills/validation-fixer/` override port (skill ships a single copy).
- Committing or pushing the fix (pipeline stops at READY_TO_COMMIT).
- The alternative resolution ("keep one commit per finding", remove the batch shared-commit,
  leave ADR-0007 in force) — recorded as the fallback in Technical Notes, NOT the planned
  direction. If the coder finds supersession untenable, route through the BLOCKED step rather
  than silently switching direction.

## Technical Notes

- **Chosen direction (Brainstormer default):** supersede ADR-0007 with ADR-0008 and preserve
  the batch lane, redefining the revertible unit as a work unit. Full supersession (ADR-0008
  restates the complete contract at work-unit granularity: single item = size 1, batch = size
  ≥2) — one governing ADR, not two overlapping ones. Fallback if untenable: remove the batch
  shared-commit and keep per-finding commits under ADR-0007 (SPEC Functional-requirements
  note) — a divergence the coder must surface, not assume.
- **Mirror machinery (Convention):** ADR-0008 mirrors ADR-0007's Context / Decision /
  Alternatives / Consequences structure and the SKILL.md citation style. ADR-0007's own
  "Batch-commit sub-decision — Rejected" (0007 line ~101) is the exact clause ADR-0008 must
  revisit and re-decide with justification.
- **ADR lifecycle:** ADR-0007's body (including reasoning and the rejected sub-decision) is
  the historical record ADR-0008 revisits — flip the Status line + add a forward pointer
  only; do not delete or rewrite its reasoning.
- **Trust anchor (Invariant):** PROJECT-CONTEXT §Invariants line 68 is a **policy trust
  anchor** loaded from the merge-base. The amendment must keep the exception narrow, cite
  ADR-0008, use per-work-unit rollback wording, and still end with "no other skill may
  commit." Do not broaden the exception to any other skill.
- **Backward compatibility (mandatory Invariant):** the shared-SHA batch `_fixed via …_`
  line is additive; a single-SHA single-item line must still parse and render, and a re-run
  over a pre-existing backlog must behave identically for `[x]`/`[~]`/`[ ]` items.
- **Security preservation (NFR):** the untrusted-evidence frame, one-line-per-concern trust
  rule, and sec-3 shell-safe commit construction (single-quoted heredoc `git commit -F -`,
  `git add -- <path>`, never interpolate item text) must be preserved verbatim in meaning;
  the batch's "combined brief, trust never merged" guarantee stays intact.
- **opencode-port-parity (Invariant):** `validation-fixer` ships a single copy — no
  `.opencode` override port exists, so no port mirror is due. Do NOT create one.
- **Concrete citation anchors (verify live line numbers before editing — the file moves):**
  SKILL.md ADR-0007 cites at ~337 (3.4 commit-ownership branch), ~405 (dedicated lane),
  ~425 (main-agent lane), ~453 (batch lane "one shared commit"). ADR-0007 Status is line 3;
  its rejected batch sub-decision is ~line 101.

## Tasks

> Tasks are ordered structural-first: define/assert the verification criteria for a unit of
> work before writing it, and re-assert them after. The coder checks off [ ] → [x] as each
> task is verified. Each phase ends with a `### Phase N verification` checklist the coder
> MUST run + assert before checking the phase's last task. For this doc-only plan the phase
> checks are structural (see `## Verification (per phase)`).

### Phase 1 — Author ADR-0008 and supersede ADR-0007

- [x] Structural check first: enumerate the four dimensions ADR-0007 governs
  (authorization, provenance, rollback, resumability) and ADR-0007's four-section shape, to
  use as the completeness checklist for ADR-0008.
- [x] Author `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md`: Status
  Accepted, Date 2026-07-21, mirror ADR-0007's Context / Decision / Alternatives /
  Consequences; state it supersedes ADR-0007; redefine the revertible unit as a **work unit**
  (single item OR approved batch ≥2) and cover all four dimensions per AC-1; revisit and
  re-decide ADR-0007's rejected "Batch-commit sub-decision" with justification.
- [x] Flip `docs/adr/0007-validation-fixer-commit-ownership.md` Status line to
  "Superseded by ADR-0008" and add a forward pointer; preserve the rest of the body
  (reasoning + rejected sub-decision) unchanged.

### Phase 1 verification

- [x] Run the structural checks in `## Verification (per phase)` for Phase 1 and assert green
  before checking the last Phase 1 task.

### Phase 2 — Reconcile SKILL.md citations, batch lane, and regression traces

- [x] Structural check first: grep `validation-fixer/SKILL.md` for every `ADR-0007`
  occurrence, record the live line numbers, and confirm the ~337 / ~405 / ~425 / ~453 anchors
  (line numbers may have shifted).
- [x] Repoint every `ADR-0007` citation in SKILL.md to the governing ADR (ADR-0008, or
  ADR-0007-as-superseded-by-ADR-0008); ensure no citation — the batch lane's included —
  points at an ADR that forbids the behavior at that citation.
- [x] Reconcile the batch-lane wording (~440-464, esp. ~451-457) so shared-commit,
  shared-SHA provenance, whole-batch rollback, and joint resumability read as **authorized**
  under the work-unit contract; keep the single-item dedicated / main-agent lanes as
  work-units-of-size-1 and their per-item commit language intact.
- [x] Reconcile the "Autonomous two-item lifecycle (bug-6)" and "Tracked-backlog rollback
  lifecycle (bug-11)" worked traces and their batch-note addenda so they stay internally
  consistent with the boundary (batch = one shared-commit revertible unit; two dedicated
  items = two commits).
- [x] Confirm no behavioral change to superpowers/gsd or severity-routing mechanics beyond
  the commit/rollback/provenance/resumability wording, and that the one-line-per-concern
  trust rule, the untrusted-evidence frame, and the sec-3 shell-safe commit construction are
  preserved verbatim in meaning.

### Phase 2 verification

- [x] Run the structural checks in `## Verification (per phase)` for Phase 2 and assert green
  before checking the last Phase 2 task.

### Phase 3 — Amend the policy invariant

- [x] Structural check first: read `.orchestrator/PROJECT-CONTEXT.md` §Invariants line 68 and
  list the three safeguards + the "no other skill may commit" reaffirmation that must survive.
- [x] Update line 68 to cite **ADR-0008**, replace "atomic per-item rollback" with
  per-work-unit rollback wording, keep all three safeguards and the "no other skill may
  commit" reaffirmation, and keep the exception narrow (no other skill gains the right).

### Phase 3 verification

- [x] Run the structural checks in `## Verification (per phase)` for Phase 3 and assert green
  before checking the last Phase 3 task.

### Final

- [x] Cross-artifact consistency pass: ADR-0008 ↔ ADR-0007 status ↔ SKILL.md citations ↔
  PROJECT-CONTEXT invariant all agree on the work-unit contract; every AC 1-8 is satisfied;
  backward-compat and security-preservation notes hold.

## Verification (per phase)

> This is a **doc-only** FEAT. Per `PROJECT-CONTEXT.md` §Commands there is **no build /
> test / lint** for markdown+template authoring, and the `clean-code-gates` JS suite is an
> Invariant-scoped island that MUST NOT run against doc skills. The applicable automated
> gate set is therefore **empty**; each phase's exit criterion is its **structural review**
> checklist below. No silent rewrite of prose to "pass" a check without a corresponding task.
> G1 (coverage) and G6 (mutation) remain QA-only and are NOT emitted here.

**Phase 1 (ADRs) — structural checks:**
- `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` exists; has the four
  headings Context / Decision / Alternatives / Consequences; Status is Accepted; explicitly
  states supersession of ADR-0007; covers all four dimensions (authorization, provenance,
  rollback, resumability) at work-unit granularity (single item OR batch ≥2).
- ADR-0007 Status line == "Superseded by ADR-0008" with a forward pointer; `git diff` shows
  the rest of ADR-0007's body unchanged.
- Cross-links resolve: ADR-0008 → ADR-0007 and ADR-0007 → ADR-0008 filenames are correct.

**Phase 2 (SKILL.md) — structural checks:**
- `grep -n 'ADR-0007' plugins/my-skills/skills/validation-fixer/SKILL.md`: every remaining
  occurrence is in a "superseded by ADR-0008" / governing-ADR context — no citation presents
  ADR-0007 as the sole live authority for a commit behavior it forbids.
- The batch lane cites the governing ADR and describes shared-commit / shared-SHA / whole-
  batch rollback / joint resumability as authorized; single-item lanes still cite an
  authorizing ADR for their per-item commit.
- The bug-6 and bug-11 worked traces + batch-note addenda read consistently with the
  boundary; the sec-3 shell-safe construction block, the one-line-per-concern trust rule, and
  the untrusted-evidence frame are unchanged in meaning (diff shows only citation/authorization
  wording moved, not the security recipe).
- No superpowers/gsd path text changed; no `.opencode` port created.

**Phase 3 (PROJECT-CONTEXT invariant) — structural checks:**
- §Invariants line 68 cites ADR-0008, uses per-work-unit rollback wording, still names the
  three safeguards, still reaffirms "no other skill may commit", and does not broaden the
  exception to any other skill.

Phase exit criterion: all structural checks for the phase hold. A checklist item that cannot
be made to hold routes through the coder's BLOCKED step, not a silent rewrite.

## Dependencies

- None. (Depends on the accepted SPEC-20260721T215726Z-b751 as input, but no prior plan must
  be DONE first.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-21T22:02:01Z | ARCHITECT

Plan `FEAT-20260721T220140Z-7b61` created. Type: feat. Tasks: 16.
Status: PLANNED. Ready for coder.

### 2026-07-21T22:05:29Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-21T22:13:21Z | CODER

All 16 tasks complete. Plan status → DONE. Ready for reviewer.

Summary: Authored ADR-0008 (work-unit commit ownership + batch atomicity) superseding
ADR-0007; flipped ADR-0007 Status + forward pointer (body preserved, +3/-1 lines);
repointed all four ADR-0007 citations in validation-fixer/SKILL.md to ADR-0008 and
reconciled the batch lane, dedicated/main-agent lanes, and the bug-6/bug-11 worked-trace
batch notes to the work-unit contract; amended PROJECT-CONTEXT §Invariants line 68 to cite
ADR-0008 with per-work-unit rollback wording, three safeguards + "no other skill may
commit" preserved, exception kept narrow. sec-3 shell-safe construction, one-line-per-concern
trust rule, untrusted-evidence frame, and superpowers/gsd paths unchanged; no .opencode port
created; backward compatibility documented (shared-SHA line additive). Structural
verification green for all three phases (doc-only plan — no automated gates apply).

### 2026-07-21T22:16:15Z | TESTER

TEST-20260721T221440Z-1b4e created. Status: PASS. Coverage: N/A% → N/A% (doc-only plan — no
runtime code; automated tests + coverage N/A per PROJECT-CONTEXT; verification is structural).
All eight acceptance criteria hold under structural review; no e2e applicable (no executable
surface); no weak tests found.

### 2026-07-21T22:20:03Z | REVIEWER

CR-20260721T221802Z-32c8 created. Status: APPROVED. Must Fix: 0. Should Fix: 0.

### 2026-07-21T22:20:59Z | QA

QA-20260721T222059Z-bde0 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
