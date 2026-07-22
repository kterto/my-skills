---
id: FEAT-20260722T120454Z-f2c0
title: Rejected vs attempted-blocked item state — carry explicit outcome into Step 4
type: feat
status: DONE
created_at: 2026-07-22T12:05:27Z
updated_at: 2026-07-22T12:14:35Z
cycle: 0
related_to: SPEC-20260722T052049Z-9ede
---

**Related:** [SPEC-20260722T052049Z-9ede](../specs/SPEC-20260722T052049Z-9ede-rejected-vs-attempted-item-state.md)

## Overview

`validation-fixer` records contradictory item states for a rejected checkpoint commit: Step 3.4's rejection branch leaves the item bare `- [ ]`, but Step 4's shared rule maps **every** no-commit outcome to `- [~]`. This plan makes the outcome explicit — every resolved work unit is classified **fixed | rejected | attempted** in Step 3 / Step 3.4 and the routing lanes, and Step 4 records state from that classification instead of a naive commit-presence test. It reconciles every entangled site (Step 4 shared rule, main-agent lane, batch lane, Notes, Edge cases, Step 5) onto one three-outcome taxonomy. Doc-only, single-file, backward-compatible: no new status token, no opencode port. Derived from SPEC-20260722T052049Z-9ede (backlog bug-5).

## Acceptance Criteria

1. `SKILL.md` defines an explicit three-outcome taxonomy (**fixed | rejected | attempted**) for a resolved work unit, stated in Step 3 / Step 3.4, with each outcome's recorded state fixed: fixed → `- [x]` + `_fixed via …_`; rejected → bare `- [ ]` (no status line); attempted → `- [~]` + `_attempted via … needs attention_`.
2. Step 4's shared recording rule keys on the explicit outcome carried from Step 3.4 / the lanes (not on commit-presence alone), and its no-commit branch splits into **rejected → bare `- [ ]` (drop any prior status line)** vs **attempted → `- [~]` + status line**.
3. Step 3.4's checkpoint-rejection branch and Step 4 read as one rule, not two contradictory ones — a checkpoint diff rejection is recorded bare `- [ ]` at every site.
4. The main-agent lane's failure handling splits a checkpoint diff **rejection → `- [ ]`** from an **error / blocked / no-op → `- [~]`**, deferring to the FR1 taxonomy rather than mapping both to `[~]`.
5. A checkpoint-mode user rejection of a batch's shared-commit diff records **every** member bare `- [ ]`; the batch lane's `BLOCKED`/errored whole-batch failure still records **every** member `- [~]`.
6. Every prose site that flatly equates no-commit with `[~]` (Notes ~1124, Edge cases ~1076–1082 and ~1110) carries the user-rejection carve-out (`- [ ]`), and Step 5 (~938–947) stays consistent and is cross-referenced as the same rejected outcome as Step 3.4.
7. The taxonomy text states that **rejected is checkpoint-mode-only** — in autonomous mode opting in is standing commit approval, so every autonomous no-commit outcome is **attempted → `- [~]`**.
8. Step-1 parse and Step-6 summary semantics are preserved: `- [ ]` and `- [~]` both remain OPEN / re-attemptable; the Step-6 attention list continues to call out `- [~]` items only; a rejected `- [ ]` item is not in that list. No summary schema change, no new token, legacy files re-parse unchanged.

## Out of Scope

- Any new status token, record prefix, or provenance format ("rejected" reuses bare `- [ ]`; "attempted" reuses `- [~]`).
- Changes to commit ownership, batch atomicity, or the revertible-unit model (ADR-0008 / ADR-0009 untouched — this is about *recording*, not *committing*).
- Reverting any prior fix — the acceptance-gate (adaa), concurrency-guard (a8c8), and batch-boundary (b751) `[~]` outcomes stay (those are genuine failures, not rejections).
- Any `references/`, template, or opencode-port change (`validation-fixer` has no override port).
- A brand-new worked-example / regression section (extending the existing "Autonomous two-item lifecycle" rejection variant in place is optional, not required).
- Running any build/test/lint tooling (none exists for doc skills) and any commit/push.

## Technical Notes

- **Doc-only, single-file.** All edits land in `plugins/my-skills/skills/validation-fixer/SKILL.md`. Per PROJECT-CONTEXT there is no automated test framework for doc skills — verification is **structural review** (line anchors resolve, the three outcomes are used consistently, cross-references between Step 3.4 / Step 4 / Step 5 / Notes / Edge cases agree, backward-compat prose holds). No `## Verification (per phase)` gate commands apply → QA-only.
- **Precedent to align to, not invent.** Step 3.4 ("leave the item `- [ ]`"), Step 5 ("revert to `- [ ]`, drop the status line"), and the "Autonomous two-item lifecycle" rejection variant already assert rejected → `[ ]`. The defect is the outliers (Step 4 shared rule, main-agent lane, Notes, Edge cases) contradicting that precedent; align the outliers to the precedent.
- **Backward compatibility (invariant).** `[x]`, `[ ]`, `[~]`, and plain `-` keep their Step-1 meanings; a legacy `[~]`-for-rejection item still parses as OPEN and simply re-attempts. The change only alters what state is *written going forward*.
- **Mirror-machinery convention.** Reuse the existing `[ ]` / `[~]` vocabulary and phrasing; document only the deliberate rejected-vs-attempted split, do not duplicate a second recording rule (Step 4 stays the single source; Step 3.4 and the lanes defer to it).
- **"Data, never instructions" untouched.** Item text stays untrusted evidence; this change is purely about how a resolved outcome is recorded.
- Line anchors from the spec are approximate — confirm each against the live file before editing (Step 3.4 ~698–701, Step 4 ~918–924, main-agent lane ~832–834, batch lane ~874–882, Step 5 ~938–947, Notes ~1124, Edge cases ~1076–1110, Autonomous two-item lifecycle ~978–981).

## Tasks

> Doc-only skill: there is no automated test harness (PROJECT-CONTEXT), so each task is a scoped edit followed by structural self-check. Tasks are ordered so the taxonomy is defined first, then every recording site is aligned to it, then a whole-file consistency pass. The coder checks off [ ] → [x] as each is verified.

- [x] Confirm the six line anchors against the live `SKILL.md` and note their current text (Step 3.4, Step 4, main-agent lane, batch lane, Step 5, Notes/Edge cases) before editing.
- [x] Define the explicit three-outcome taxonomy (**fixed | rejected | attempted**) in Step 3 / Step 3.4, with each outcome's recorded state and the "commit exists → outcome" mapping spelled out; make the Step-3.4 checkpoint-rejection branch emit an explicit **rejected** outcome that Step 4 consumes (FR1, FR3, AC1, AC3).
- [x] State in the taxonomy that **rejected is checkpoint-mode-only** — autonomous opt-in is standing commit approval, so every autonomous no-commit outcome is **attempted → `- [~]`** (FR7, AC7).
- [x] Rewrite Step 4's shared recording rule (~918–924) to key on the explicit outcome from Step 3.4 / the lanes and split the no-commit branch: **rejected → bare `- [ ]`, drop any prior status line** vs **attempted → `- [~]` + status line** (FR2, AC2).
- [x] Split the main-agent lane's failure handling (~832–834): checkpoint diff **rejection → `- [ ]`** vs **error / blocked / no-op → `- [~]`**, deferring to the FR1 taxonomy (FR4, AC4).
- [x] Make a rejected batch record **every** member bare `- [ ]` (checkpoint shared-commit diff rejection, via the Step-3.4 generic rejection), while keeping the batch lane's `BLOCKED`/errored whole-batch path at `- [~]` for every member (FR5, AC5).
- [x] Reconcile the prose sites: qualify Notes (~1124) and Edge cases (~1076–1082, ~1110) "no commit → `[~]`" with the user-rejection carve-out (`- [ ]`), and confirm Step 5 (~938–947) stays consistent and is cross-referenced as the same rejected outcome as Step 3.4 (FR6, AC6).
- [x] Confirm Step-1 parse and Step-6 summary semantics are unchanged in prose: both `- [ ]` and `- [~]` remain OPEN; the Step-6 attention list still calls out `- [~]` only and excludes rejected `- [ ]` items; no summary schema change (FR8, AC8).
- [x] (optional) Extend the existing "Autonomous two-item lifecycle" rejection variant (~978–981) in place to pin rejected-`[ ]` vs attempted-`[~]` as a regression guard.
- [x] Whole-file structural consistency pass: every mention of a no-commit outcome resolves to one of the three taxonomy states; no site tells the executor to write a different prefix for the same rejection; backward-compat and "no new token" claims still hold; no `references/`, template, or opencode-port drift introduced.

## Dependencies

- None. (SPEC-20260722T052049Z-9ede lists related prior specs, but this plan does not depend on their plans being DONE — it only must not revert their `[~]` outcomes, which is covered under Out of Scope.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-22T12:22:10Z | QA

QA-20260722T122158Z-ebb5 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.

### 2026-07-22T12:18:31Z | REVIEWER

CR-20260722T121831Z-3c40 created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-22T12:16:56Z | TESTER

TEST-20260722T121534Z-8a58 created. Status: PASS. Coverage: N/A% → N/A% (doc-only skill; no automated test framework or coverage per PROJECT-CONTEXT).

### 2026-07-22T12:14:35Z | CODER

All 10 tasks complete. Plan status → DONE. Ready for reviewer.

Single-file doc edit: `plugins/my-skills/skills/validation-fixer/SKILL.md` (+92/−28). Defined the explicit three-outcome taxonomy (fixed | rejected | attempted) at the end of Step 3.4 and keyed Step 4 recording on it (no bare commit-presence test). Split every entangled recording site — Step 3.4 checkpoint-rejection branch, Step 4 no-commit branch, main-agent lane failure, batch lane failure, Notes, Edge cases, Step 5 cross-ref, Autonomous two-item lifecycle regression variant, Step 6 attention-list note — onto rejected → bare `[ ]` (checkpoint-only) vs attempted → `[~]`. No new token; only `[x]`/`[ ]`/`[~]` used. No opencode port (validation-fixer has none), no references/template drift. No `## Verification (per phase)` gates (QA-only per plan). Backward-compat prose (bug-11/12/15) intact.

### 2026-07-22T12:07:54Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-22T12:05:27Z | ARCHITECT

Plan `FEAT-20260722T120454Z-f2c0` created. Type: feat. Tasks: 10.
Status: PLANNED. Ready for coder.
