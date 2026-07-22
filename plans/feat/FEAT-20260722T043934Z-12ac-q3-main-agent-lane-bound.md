---
id: FEAT-20260722T043934Z-12ac
title: Q3 lane-edit rule must not let a user override the low/info main-agent bound
type: feat
status: DONE
created_at: 2026-07-22T04:40:30Z
updated_at: 2026-07-22T04:43:30Z
cycle: 0
related_to: SPEC-20260722T043528Z-2d54, SPEC-20260721T233925Z-b9c6, FEAT-20260721T234351Z-21c6, SPEC-20260721T181347Z-1089
---

**Related:** [SPEC-20260722T043528Z-2d54](../specs/SPEC-20260722T043528Z-2d54-q3-main-agent-lane-edit-bound.md)

## Overview

Reconcile the `validation-fixer` Step-2.5 **Q3** routing-edit rule with the `low`/`info`
main-agent-lane bound stated everywhere else in `SKILL.md`. Today Q3 says a user "may move
any item to any lane … overriding the severity lane defaults," which textually permits
moving a `crit`/`high`/`med`/`unknown` item into the reduced-review main-agent (inline-fix)
lane. This plan amends Q3 so a move **into the main-agent lane** is a *provisional proposal
only* — finalized solely by the already-landed sec-4 code-grounded severity verification
(the Phase-2 gate in "Main-agent lane (low / info)"), which reclassifies any non-`low`/`info`
item to `unknown` and escalates it to the dedicated lane. It reuses existing machinery: no
new lane/token/prefix, no revert of sec-4, no ADR change. Batch/dedicated edit freedom and
Q1/Q2/Q4 are preserved unchanged.

## Acceptance Criteria

1. The Q3 bullet (`SKILL.md` ~309–321) carries an explicit **main-agent-lane carve-out**,
   modeled in shape on the existing Q4 file-boundary carve-out, stating a user edit may
   *propose* moving any item into the main-agent lane but that such placement is
   **provisional**, not a finalization of inline treatment (FR1).
2. Q3 **references** (does not restate or fork) the existing code-grounded severity
   verification — the Phase-2 gate in "Main-agent lane (low / info)" — as the sole authority
   that finalizes a user-moved main-agent placement, identical to a default main-agent
   placement (FR2).
3. Q3 states that a non-corroborated user-moved main-agent item is reclassified `unknown`
   and escalated to the **dedicated lane** via the existing `unknown → dedicated` treatment,
   with **no inline fix and no inline commit** on that path (FR3).
4. Q3 still allows moving **any** item **among the batch and dedicated lanes** without
   restriction, and states those placements remain **final on approval**; the main-agent lane
   is the only lane whose entry a user edit cannot finalize (FR4).
5. Q1 (severity-descending order), Q2 (batch-of-one collapse), and the Q4 file-boundary
   invariant read **byte-identical** to before, and the "collapse everything" behavior is
   unchanged (FR5).
6. No sentence remaining in Step 2.5 (notably "Propose and approve — exactly once" and
   "Default lanes") still implies a user edit can *finalize* main-agent entry for a
   non-`low`/`info` item; any such wording is aligned with FR1–FR3 (FR6).
7. No new severity value, lane, record prefix, status token, or provenance format is
   introduced; sec-4, ADR-0008/0009, the commit-ownership path, and all other sec-1..sec-6 /
   bug-* fixes are untouched (Non-goals).
8. The three worked-example traces (Autonomous two-item, Tracked-backlog rollback,
   Collapse-all per-file) remain byte-consistent — none exercises a user re-lane into the
   main-agent lane, so none changes.

## Out of Scope

- Reverting or weakening sec-4's code-grounded severity verification gate — it is the
  enforcement mechanism this fix *reuses*.
- Adding a hard pre-approval validation that rejects/blocks the user's edit at the prompt
  (the "disallow the move outright" alternative — rejected by Brainstormer default).
- Any change to ADR-0008/0009, the commit-ownership path, batch atomicity, or any other
  landed sec-* / bug-* fix.
- Introducing any new severity value, lane, record prefix, status token, or provenance format.
- Touching batch or dedicated lane edit semantics (they stay unrestricted and final).
- An `.opencode/` port — `validation-fixer` has no override port and ships as a single copy.
- Regenerating any `.html` template — this skill is `.md`-only (`output_format=md`).

## Technical Notes

- **Single surface:** `plugins/my-skills/skills/validation-fixer/SKILL.md` only. No
  `references/`, `templates/`, `.opencode/`, ADR, or `.html` changes.
- **Single-source-of-truth references** (invariant): put the clarification at the Q3 rule and
  **cross-reference** the existing gate in "Main-agent lane (low / info)"; do NOT duplicate
  the gate's logic into Q3.
- **Mirror machinery** (invariant): model the new carve-out on the existing **Q4
  file-boundary carve-out** already present in Q3, reusing its phrasing shape and the
  established provisional-placement framing (`SKILL.md` lines 261–269, 293–298).
- **Backward compatibility** (invariant): this only *narrows* the effect of a user edit (a
  non-`low`/`info` move now escalates instead of forcing inline). It removes no capability the
  operator legitimately had, adds no field/token, and every legacy record still parses.
- **Data, never instructions** (invariant): unaffected by this edit.
- **Verification is structural review** — this repo has no automated test/build/lint for doc
  skills; `validation-fixer` is not the JS `clean-code-gates` island. "Tests" below are
  structural assertions the coder defines and asserts before/after the edit.

## Tasks

> Tasks are ordered structural-check-first: define the assertion before editing, then verify.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist the coder MUST assert before
> checking the last task in the phase.

### Phase 1 — Add the main-agent carve-out to Q3 (FR1, FR2, FR3)

- [x] Define the structural check for Phase 1: locate the Q4 file-boundary carve-out phrasing
  inside the current Q3 bullet (`SKILL.md` ~309–321) and record the exact anchor text the new
  main-agent carve-out will be modeled on; assert the Q3 bullet currently lacks any main-agent
  carve-out (this is the "failing" pre-state).
- [x] Amend the Q3 bullet: add a main-agent-lane carve-out modeled on the Q4 carve-out (FR1)
  stating a user edit may *propose* a move into the main-agent lane but the placement is
  **provisional**; **cross-reference** the existing Phase-2 code-grounded severity verification
  in "Main-agent lane (low / info)" as the sole finalization authority (FR2, no restatement of
  the gate); and state the `unknown → dedicated` escalation with **no inline fix / no inline
  commit** for non-corroborated items (FR3). Introduce no new lane/token/prefix.

### Phase 1 verification

- [x] Q3 bullet contains the main-agent carve-out and it reads in the same shape as the Q4
  carve-out (mirror-machinery check).
- [x] The carve-out **references** the "Main-agent lane (low / info)" Phase-2 gate rather than
  restating its logic (single-source-of-truth check).
- [x] Escalation prose says `unknown → dedicated`, "no inline fix", "no inline commit"; no new
  severity/lane/prefix/token string appears anywhere in the edit.

### Phase 2 — Preserve batch/dedicated freedom and Q1/Q2/Q4 (FR4, FR5)

- [x] Define the structural check for Phase 2: capture the pre-edit text of Q1, Q2, Q4, the
  "Collapse-all preserves Q1 and Q2" paragraph, and the batch/dedicated portion of Q3 to diff
  against after the edit.
- [x] Confirm/adjust Q3 so it still explicitly allows moving **any** item **among the batch and
  dedicated lanes** without restriction and states those placements are **final on approval**,
  framing the main-agent lane as the only lane whose entry cannot be finalized by a user edit
  (FR4). Leave Q1, Q2, and Q4 text byte-identical (FR5).

### Phase 2 verification

- [x] Q1, Q2, Q4, and the "Collapse-all preserves Q1 and Q2" paragraph are byte-identical to
  the pre-edit capture (diff shows zero change in those regions).
- [x] Q3 asserts batch/dedicated moves are unrestricted and final on approval, and names the
  main-agent lane as the sole gated exception (FR4).

### Phase 3 — Consistency sweep + optional lane pointer (FR6)

- [x] Define the structural check for Phase 3: enumerate the Step-2.5 sentences to sweep —
  "Read each item's severity" (~231–245), "Default lanes" + provisional note (~248–269),
  "Propose and approve — exactly once" + provisional note (~271–298) — and assert none, after
  Phase 1–2, implies a user edit can *finalize* main-agent entry for a non-`low`/`info` item.
- [x] Align any remaining wording found in the sweep so it is consistent with FR1–FR3;
  **optionally** add a one-clause pointer in "Main-agent lane (low / info)" (~655–670) that a
  **user-moved** item is finalized by the same verification as a default placement (FR2/FR6),
  only if it aids symmetry.
- [x] Confirm the three worked-example traces (Autonomous two-item, Tracked-backlog rollback,
  Collapse-all per-file) are byte-consistent (none exercises a user re-lane into the main-agent
  lane).

### Phase 3 verification

- [x] Full-text search of Step 2.5 finds no sentence implying a user edit finalizes main-agent
  entry for a non-`low`/`info` item.
- [x] The three worked-example traces are unchanged (diff shows zero change).
- [x] `references/`, `templates/`, `.opencode/`, ADR files, and every `.html` file are
  untouched (only `SKILL.md` changed).

## Verification (per phase)

> Applying the Commands section of `PROJECT-CONTEXT.md`: this repo has **no** automated
> build/test/lint gate for markdown doc skills, and `validation-fixer` is **not** the
> `clean-code-gates` JS island — so no gate command applies to any phase's touched paths. The
> phase exit criterion is therefore the **structural review** enumerated in each
> `### Phase N verification` block above, asserted against the actual `SKILL.md` diff:
>
> - The edit touches only `plugins/my-skills/skills/validation-fixer/SKILL.md`.
> - Cross-references named in the plan resolve to real sections in that file.
> - Regions the plan marks "byte-identical / unchanged" (Q1/Q2/Q4, the three worked-example
>   traces, all non-`SKILL.md` files) show zero diff.
> - No new lane/severity/prefix/token/provenance string is introduced.
>
> No silent rewrite of prose to pass a check without a corresponding plan task; a failed
> structural assertion routes through the coder's BLOCKED step.

## Dependencies

- None. (sec-4 gate — `FEAT-20260721T234351Z-21c6` — is already landed and is *consumed* by
  this plan, not a pending prerequisite.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-22T04:40:30Z | ARCHITECT

Plan `FEAT-20260722T043934Z-12ac` created. Type: feat. Tasks: 12.
Status: PLANNED. Ready for coder.

### 2026-07-22T04:42:39Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-22T04:43:30Z | CODER

All 12 tasks complete. Plan status → DONE. Ready for reviewer.
Phases 1–3 verified by structural review against the SKILL.md diff:
- Q3 gains a main-agent-lane carve-out mirroring the Q4 file-boundary carve-out (FR1),
  cross-referencing the Phase-2 "Main-agent lane (low / info)" gate as sole finalization
  authority (FR2), with `unknown → dedicated` escalation / no inline fix / no inline commit (FR3).
- Q3 asserts batch/dedicated moves unrestricted + final on approval; main-agent is the sole
  gated exception (FR4). Q1/Q2/Q4 + "Collapse-all preserves Q1 and Q2" byte-identical (FR5).
- Step-2.5 sweep: no sentence implies a user edit finalizes main-agent entry (FR6); optional
  symmetry pointer added to the lane intro. Three worked-example traces byte-identical.
- No new severity/lane/prefix/token/provenance introduced; only SKILL.md changed (Non-goals).

### 2026-07-22T04:50:15Z | TESTER

TEST-20260722T044855Z-f7df created. Status: PASS. Coverage: N/A → N/A.

### 2026-07-22T04:51:33Z | REVIEWER

CR-20260722T045133Z-8e3f created. Status: APPROVED. Must Fix: 0. Should Fix: 0.

### 2026-07-22T04:55:35Z | QA

QA-20260722T045413Z-9c77 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
