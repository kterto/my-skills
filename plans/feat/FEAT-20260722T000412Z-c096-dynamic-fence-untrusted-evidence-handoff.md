---
id: FEAT-20260722T000412Z-c096
title: Robust dynamic fence for the untrusted-evidence handoff frame
type: feat
status: DONE
created_at: 2026-07-22T00:04:12Z
updated_at: 2026-07-22T00:08:23Z
cycle: 0
related_to: SPEC-20260722T000131Z-cb13
---

**Related:** [SPEC-20260722T000131Z-cb13](../specs/SPEC-20260722T000131Z-cb13-untrusted-evidence-dynamic-fence.md)

## Overview

The `validation-fixer` Step-3.2 handoff prompt wraps every verbatim, always-untrusted backlog item in a **fixed four-backtick fence** (`plugins/my-skills/skills/validation-fixer/SKILL.md:449–451`). A backlog item containing a line of four-or-more backticks closes that fence early, spilling attacker-controlled text into the trusted preamble region seen by the downstream framework (finding `sec-5`). This plan replaces the fixed fence with a **dynamically computed fence** whose length always exceeds the longest backtick run in the item (`max(4, M+1)`), restoring an unbreakable data/instruction boundary on both the single-item and batch (multi-concern) handoff paths. It is a pure authoring/instruction change to one `SKILL.md`, verified by structural review — no runtime code, schema, provenance, or legacy backlog is affected.

## Acceptance Criteria

1. Step 3.2's handoff-prompt construction instructs the agent to scan the verbatim item for the longest consecutive-backtick run `M` and fence the item with `max(4, M+1)` backticks on **both** the opening and closing lines (same length, each on its own line immediately before/after the item).
2. The illustrative example at `SKILL.md:~449–451` no longer presents a hardcoded four-backtick fence as the literal rule; it conveys the computed-length fence (floor of 4, always longer than any inner backtick run).
3. The batch "Combined brief, trust never merged" bullet still wraps **each** grouped item in the Step-3.2 frame and inherits the dynamic-fence rule per block, with no separate fixed-fence literal on that path.
4. No literal fixed-width fence remains anywhere in `validation-fixer/SKILL.md` for wrapping untrusted item text; any surviving fixed fence is an explicit non-evidence example outside the untrusted-evidence path.
5. The Step-1 untrusted-evidence guard (~lines 72–80) remains consistent with the new rule — either cross-referencing Step 3.2 or not contradicting it — without restating the algorithm.
6. The change is backward-compatible: an item with no ≥4 backtick run renders identically to today (still four backticks); no artifact schema, state file, provenance line, or legacy backlog is altered.

## Out of Scope

- Reverting or weakening ADR-0008 (work-unit commit ownership / batch atomicity) or the `sec-1`–`sec-4` fixes landed earlier this run.
- Touching any other trust/severity machinery: the Step-1 guard's *substance*, `[<ID>|<sev>]` provisional-severity handling, sec-3 shell-safe commit construction, rollback safety, or the main-agent-lane gate. The only change is *how the fence delimiter is sized*.
- Re-architecting the evidence encoding into escaped JSON or an out-of-band delimiter scheme (evaluated and rejected by the spec's Brainstormer default); the fenced-code-block representation the downstream framework reads stays.
- Switching to tilde (`~~~`) fences; the family stays backtick with computed length.
- opencode override port work — `validation-fixer` has no `.opencode/skills/validation-fixer/` port, so opencode-port-parity does not apply.
- Any behavioral change to a framework invocation, routing lane, or commit flow.

## Technical Notes

- Single surface: `plugins/my-skills/skills/validation-fixer/SKILL.md`. No `references/` file owns the fence rule today; keep the operative rule inline at Step 3.2 (the construction site) per the spec default. A brief reference note is optional and only if it improves clarity — do not duplicate the algorithm.
- Mirror the CommonMark fenced-code-block convention: a closing fence must be at least as long as the opening, so an opening fence longer than any inner run cannot be closed early. State it operatively, human-readably (this is the "mirror machinery / reuse established shape" convention).
- Invariants honored: *Data, never instructions* (this hardens the boundary), *Backward compatibility* (wider fence renders identically for short items), *Staged-diff → gate → … → never-commit* / ADR-0008 (untouched).
- This repo is documentation-and-template authoring: the "code" is prose the main agent executes. There is no automated test suite for this skill — verification is structural review (per PROJECT-CONTEXT "Test tooling"). The `clean-code-gates` JS island is not touched and must not be run for this change.
- Carry item text through VERBATIM (existing rule at ~68–70) is preserved — the fence only changes the delimiter width, never the enclosed content.

## Tasks

> Tasks are ordered structurally: state the operative rule, then reconcile every dependent site, then a repo-wide consistency sweep. For a doc-authoring skill there is no failing-test step; each implementation task is paired with a structural check that stands in for the test (per PROJECT-CONTEXT "Test tooling").
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST assert before checking the last task in the phase.

### Phase 1 — Operative computed-fence rule at Step 3.2

- [x] Rewrite the Step-3.2 handoff-prompt construction (~438–451) to instruct: scan the verbatim item for the longest consecutive-backtick run `M`, then fence the item with `max(4, M+1)` backticks, using the **same** computed length on the opening and closing lines, each on its own line immediately before/after the item (AC 1).
- [x] Update the illustrative example at `SKILL.md:~449–451` so it conveys the computed-length fence (a placeholder/annotation making clear the fence is `≥ 4` and always longer than any inner backtick run) instead of a literal four-backtick fence presented as the rule (AC 2).
- [x] Structural check: re-read Step 3.2 and confirm it states the scan for `M`, the `max(4, M+1)` formula, and matched open/close fence lengths; and confirm the VERBATIM carry-through rule (~68–70) is unchanged.

### Phase 1 verification

- Structural review only (no automated gate commands apply to markdown doc skills — see `## Verification (per phase)`).
- Assert: Step 3.2 prose is self-consistent and unambiguous; the example no longer reads as a fixed four-backtick literal; enclosed item content is unchanged (delimiter width only).

### Phase 2 — Consistency across the Step-1 guard, batch path, and whole file

- [x] Keep the Step-1 untrusted-evidence guard (~72–80) consistent with the new rule — add at most a cross-reference to Step 3.2, or confirm it does not describe/contradict the fence mechanism; do not restate the algorithm (AC 5).
- [x] Verify the batch "Combined brief, trust never merged" bullet (~699–704) still wraps **each** grouped block in the Step-3.2 frame and therefore inherits the dynamic-fence rule per block; confirm no separate batch-specific fixed-fence literal exists or is introduced (AC 3).
- [x] Repo-wide sweep of `validation-fixer/SKILL.md`: locate every remaining fixed-width fence and confirm none wraps untrusted item text; any surviving fixed fence must be an explicit non-evidence example outside the untrusted-evidence path (AC 4).
- [x] Backward-compatibility check: confirm an item with no ≥4 backtick run still fences at four backticks and renders identically to today; confirm no schema/state/provenance/legacy-backlog wording changed (AC 6).

### Phase 2 verification

- Structural review only.
- Assert: exactly one operative fence rule exists (Step 3.2); the Step-1 guard and batch bullet reference/inherit it without a competing literal; a file-wide search surfaces no fixed fence wrapping untrusted evidence; short-item rendering is unchanged.

## Verification (per phase)

> This repo is documentation-and-template authoring; per PROJECT-CONTEXT "Commands", there is **no** build/lint/test tooling for markdown doc skills, and the `clean-code-gates` JS suite is scoped to that skill only and is NOT touched here. Therefore no automated gate command applies to this change — every phase's exit criterion is **structural review** (per PROJECT-CONTEXT "Test tooling"): confirm the changed prose is self-consistent, cross-references resolve, backward-compat claims hold in prose, and the untrusted-evidence boundary rule is stated once operatively and inherited everywhere it must be.
>
> Gate commands to run: **none applicable** (doc-only change; no gate-covered production code). Do not invoke the `clean-code-gates` suite. No silent rewrites of prose to pass a nonexistent gate.
>
> G1 (coverage) and G6 (mutation) remain QA-only and are not emitted here.

## Dependencies

- None. The spec's related SPECs and ADR-0008 must not regress but are not prerequisites of this plan.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-22T00:04:12Z | ARCHITECT

Plan `FEAT-20260722T000412Z-c096` created. Type: feat. Tasks: 7.
Status: PLANNED. Ready for coder.

### 2026-07-22T00:06:34Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-22T00:08:23Z | CODER

All 7 tasks complete. Plan status → DONE. Ready for reviewer.
Phase 2 verification asserted (structural review): exactly one operative fence rule (Step 3.2); Step-1 guard (72–80) and batch bullet (699–704) inherit the Step-3.2 frame with no competing fixed-fence literal; file-wide sweep found zero four-backtick fences — the only remaining fences (747–750, 770–773) are non-evidence status-line templates; short-item rendering unchanged (M ≤ 3 ⇒ max(4, M+1) = 4). No schema/state/provenance/legacy-backlog wording altered. opencode-port-parity N/A (no port). clean-code-gates suite not run (out of scope).

### 2026-07-22T00:09:00Z | TESTER

TEST-20260722T000900Z-152d created. Status: PASS. Coverage: N/A → N/A.

### 2026-07-22T03:04:21Z | REVIEWER

CR-20260722T030225Z-45cc created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-22T03:06:20Z | QA

QA-20260722T030518Z-1bb3 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
