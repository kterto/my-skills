---
id: FIX-20260721T185705Z-a3ae
title: Reconcile the never-fabricates-a-fix invariant with the no-framework main-agent lane
type: fix
status: DONE
created_at: 2026-07-21T18:58:07Z
updated_at: 2026-07-21T19:02:50Z
cycle: 0
related_to: SPEC-20260721T181347Z-1089, CR-20260721T185132Z-138e
---

**Related:** [SPEC-20260721T181347Z-1089](../specs/SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md) · [CR-20260721T185132Z-138e](./CR-20260721T185132Z-138e-validation-fixer-orchestrator-severity-routing.md)

## Overview

Resolves CR-20260721T185132Z-138e (REQUEST_CHANGES) against the single prose file `plugins/my-skills/skills/validation-fixer/SKILL.md`. The new orchestrator main-agent lane fixes `low`/`info` items **inline by the host's own main agent with no framework spawned**, but three passages still speak in framework-only terms and therefore contradict that lane: the load-bearing "never fabricates a fix" guard in Notes and the Step-4 leading success condition (MF-1, blocker — AC-29 self-consistency breach), the `_fixed via <framework>_` provenance label that has no defined token for the main-agent lane (SF-1), and the Step-3 loop sub-step that unconditionally says "invoke the chosen framework" (SF-2). This plan is minimal prose edits only, reconciling the wording without reopening any locked decision (bug-6/7/11/12/15, sec-3, ADR-0007).

## Acceptance Criteria

1. The Notes "never fabricates a fix" guard (`SKILL.md:615-618`) states a success predicate that legitimately admits a completed main-agent inline fix plus a real commit as grounds for `[x]`, while still requiring a real commit and preserving the bug-12 committed-then-blocked rule.
2. The Step-4 leading success condition (`SKILL.md:467`) carries the same generalized predicate and no longer contradicts the per-work-unit paragraph (`484-485`).
3. Step 4 defines a deterministic provenance token for the main-agent lane so its status line renders as `_fixed via main-agent · <sha> · <date>_` (SF-1).
4. Step 3 sub-step 3 (`SKILL.md:297`) carries an inline main-agent carve-out noting that in the main-agent lane this step is the inline fix, not a framework invocation, pointing at the main-agent lane (SF-2).
5. Whole-file structural self-consistency holds (AC-29): every step/invariant reference resolves, no framework-only success phrasing remains that contradicts the main-agent lane, and no locked invariant (bug-6/7/11/12/15, sec-3, ADR-0007) is weakened.

## Out of Scope

- Any change to superpowers or gsd routing behavior (frameworks still run one item at a time).
- Re-litigating the severity-routing lanes, the shared-commit machinery, or any locked decision (bug-6/7/11/12/15, sec-3, ADR-0007).
- Editing files other than `plugins/my-skills/skills/validation-fixer/SKILL.md` — validation-fixer has no `.opencode/skills/` override port, so opencode-port-parity requires no mirrored edit.
- Running clean-code-gates or any code test suite — this is a prose change; verification is structural self-consistency only.

## Technical Notes

- **Prose-only, single file.** Edits target `plugins/my-skills/skills/validation-fixer/SKILL.md` exclusively. Verification is structural review, not execution (per PROJECT-CONTEXT → Commands / Test tooling).
- **Mirror machinery.** Generalize the success predicate by admitting the inline lane alongside the framework paths — do not delete the framework wording, extend it (batch/dedicated lanes still resolve `<framework>` to `orchestrator` at lines 487, 540, 572).
- **Backward compatibility.** Legacy `[x]` records made via a framework's success signal remain valid under the generalized predicate; do not force any migration.
- **Do not weaken bug-12.** The committed-then-blocked rule (an item that committed but then failed is `[~]`, its commit stays) must survive the reworded success predicate unchanged.
- **No opencode port.** `validation-fixer` ships a single copy; the opencode-port-parity invariant applies only to skills with an override port (`pr-review-report`, `spec-driven-eval`).

## Tasks

> Tasks are ordered structural-check-first: state the self-consistency target before editing prose.
> The coder will check off [ ] → [x] as each edit is verified against the target.
> Should-Fix items (SF-1, SF-2) are annotated (optional) per the fix-plan convention; the orchestrator brief asks that all three findings be resolved, so complete them unless explicitly de-scoped.

- [x] Record the structural-consistency target for MF-1: capture the exact framework-only phrasings at `SKILL.md:615-618` (Notes guard) and `SKILL.md:467` (Step-4 leading condition), and the rescue paragraph at `484-485`, so the edited wording can be asserted against a stated expectation.
- [x] Edit the Notes "never fabricates a fix" guard (`615-618`) to generalize the success predicate — admit "the fix producer signaled success — a framework's normal completion / `READY_TO_COMMIT`, **or the main-agent lane's completed inline fix** — *and* a real commit exists for it (the framework's own commit, or validation-fixer's commit-ownership commit)" — keeping the real-commit requirement and the bug-12 rule intact (AC 1).
- [x] Edit the Step-4 leading success sentence (`467`) with the same generalized predicate so it agrees with the per-work-unit paragraph (`484-485`) (AC 2).
- [x] (optional, SF-1) Specify the main-agent provenance token in the Step-4 status-line template so the main-agent lane records `_fixed via main-agent · <sha> · <date>_` deterministically (`478`/`485`) (AC 3).
- [x] (optional, SF-2) Add a half-sentence / parenthetical carve-out to Step 3 sub-step 3 (`297`) noting that in the main-agent lane this step is the inline fix, not a framework invocation, and pointing at the main-agent lane under "Orchestrator routing lanes" (AC 4).
- [x] Full-file structural self-consistency pass (AC 5): grep for any remaining framework-only success phrasing that still contradicts the main-agent lane; confirm the SF-2 carve-out matches the preamble divergence note (`227`) and the main-agent lane (`407-435`); confirm the SF-1 token is consistent with the batch/dedicated `orchestrator` resolutions (`487`, `540`, `572`); confirm no step/invariant reference dangles and no locked invariant is weakened.

## Dependencies

- None. (Applies on top of the FEAT-20260721T182238Z-ab8c change already under review.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-21T18:58:07Z | ARCHITECT

Plan `FIX-20260721T185705Z-a3ae` created. Type: fix. Tasks: 6.
Status: PLANNED. Ready for coder.

### 2026-07-21T18:59:54Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-21T19:02:50Z | CODER

All 6 tasks complete. Plan status → DONE. Ready for reviewer.
MF-1 (blocker) resolved: Notes guard (615-618) and Step-4 leading condition (467) now carry a generalized fix-producer predicate admitting the main-agent inline fix + real commit, agreeing with the per-work-unit paragraph (484-485). SF-1: main-agent provenance token defined (`_fixed via main-agent · <sha> · <date>_`). SF-2: Step-3 sub-step 3 carve-out added. Real-commit requirement, bug-12, and all locked invariants (bug-6/7/11/15, sec-3, ADR-0007) preserved. Single file touched: plugins/my-skills/skills/validation-fixer/SKILL.md.

### 2026-07-21T19:04:55Z | TESTER

TEST-20260721T190338Z-4d1c created. Status: PASS. Coverage: N/A → N/A (doc-only prose change, no runnable suite).
Structural self-consistency verified via Read + grep: MF-1 (Notes guard 623-629 + Step-4 leading condition 470-476 admit the main-agent inline fix, real-commit + bug-12 preserved), SF-1 (`main-agent` provenance token, 487-489), SF-2 (Step-3 sub-step carve-out 297-300 → Main-agent lane 410). No new contradiction: bug-6/7/11/12/15, sec-3, ADR-0007 all intact; three lanes, Change A, Step 2.5, per-work-unit gate, batch shared-commit/rollback, dual-host wording, severity abbreviations, cross-references all resolve.

### 2026-07-21T19:06:37Z | REVIEWER

CR-20260721T190637Z-0819 created. Status: APPROVED. Must Fix: 0. Should Fix: 0.

### 2026-07-21T19:12:44Z | QA

QA-20260721T191039Z-8569 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
