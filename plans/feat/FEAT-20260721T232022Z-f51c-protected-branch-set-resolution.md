---
id: FEAT-20260721T232022Z-f51c
title: validation-fixer — default-branch-aware protected-branch set resolution
type: feat
status: DONE
created_at: 2026-07-21T23:20:22Z
updated_at: 2026-07-21T23:29:34Z
cycle: 0
related_to: SPEC-20260721T231715Z-3045
---

**Related:** [SPEC-20260721T231715Z-3045](../specs/SPEC-20260721T231715Z-3045-protected-branch-set-resolution.md)

## Overview

Fixes finding **sec-3** in the `validation-fixer` skill (source: SPEC-20260721T231715Z-3045). The protected-branch STOP currently relies on a hardcoded `main`/`master`/`dev` set, which silently fails to protect a repo whose real default branch is `trunk`, `production`, or any custom name — letting an autonomous sweep commit onto the actual default branch. This plan adds a **single** protected-set resolution recipe to `SKILL.md` (union of the dynamic `origin/HEAD` default branch, a widened static fallback `main`/`master`/`dev`/`trunk`, and merge-base-trusted documented policy names) and re-points all three enforcement sites at it so they can never drift. Pure prose/procedure change to one file — no code, no `references/`, no opencode port.

## Acceptance Criteria

1. `SKILL.md` contains exactly **one** named protected-set resolution recipe, placed adjacent to the Step-2 preflight (`### Preflight — reject a protected branch …`), before its first use.
2. The recipe defines the protected set as the **union** of: (a) the dynamic default branch resolved best-effort from `origin/HEAD` (`git symbolic-ref --short refs/remotes/origin/HEAD` → strip `origin/`, falling back to parsing `git remote show origin`); (b) the widened static fallback `main`, `master`, `dev`, `trunk` (always present); (c) documented protected-branch names read from the **merge-base** (`$mb`).
3. The recipe states that when dynamic resolution (a) cannot determine a default branch (no `origin` remote, offline, detached, or command error) it degrades **silently** to (b) ∪ (c) and never aborts or errors the run.
4. The recipe defines "protected" as **exact, case-sensitive** equality between the current branch (`git rev-parse --abbrev-ref HEAD`) and any name in the resolved set; detached `HEAD` remains an independent STOP condition, unchanged.
5. All three enforcement sites reference the recipe **by name** and none restates a literal `main`/`master`/`dev` (or any hardcoded) branch list: (a) Step-2 preflight / bug-7 STOP-before-invoking-any-framework gate; (b) Step-3.4 acceptance gate A "Branch unchanged (structural)"; (c) Step-3.4 defense-in-depth "Protected-branch guard".
6. Every other behavior of those gates is preserved verbatim: the preflight STOP message, the "create/switch to a feature branch" guidance, the Step-3.4 acceptance gate A/B/C/D ordering, and the defense-in-depth re-assert-before-commit.
7. The documented-policy names are read from the **merge-base** (`$mb`), never the working tree — consistent with the two-trust-anchors invariant — and the resolved default-branch name / documented text is treated as **data, not commands** (used only for name comparison).
8. Backward compatibility holds: the change only *widens* protection; no previously-allowed feature branch is newly blocked unless that branch IS the repo's real default. No `.opencode/` port exists for `validation-fixer`, so no port mirroring is performed.

## Out of Scope

- Reverting or weakening ADR-0008, sec-1's framework-commit acceptance gate, or sec-2's rollback concurrency guard — this change only widens the set they already consult.
- Changing detached-HEAD handling (remains a STOP exactly as today).
- Introducing a new machine-readable config file/schema for protected branches ("documented policy" = whatever the host repo already documents, read at merge-base).
- Adding auto-creation / auto-switching of branches.
- Touching any other skill or adding an opencode port (validation-fixer has none).

## Technical Notes

- Single file touched: `plugins/my-skills/skills/validation-fixer/SKILL.md`. No `references/`, no opencode port, no JS — pure prose/procedure change (PROJECT-CONTEXT: doc-and-template authoring, verification is structural review).
- Mirror the established "define once, reference everywhere" shape already used for the Step-3.1 rollback recipe; the Step-3.4 gate already says "do not fork a second definition" — this plan makes that literal.
- Two-trust-anchors invariant: documented protected-branch policy is policy/config → load from merge-base (`$mb`). The dynamic `origin/HEAD` value is repo state (not branch-authored policy) → read normally.
- Data-never-instructions (Step-1 trust rule): resolved branch names / documented text are used only for name comparison, never executed.
- ADR-0008 parenthetical in PROJECT-CONTEXT.md (line 68) enumerates `main`/`master`/`dev` — the spec flags an OPTIONAL follow-up to note the set is now resolved, not fixed. Not required by this plan; surfaced only, not planned.
- No automated gate commands exist for markdown authoring (PROJECT-CONTEXT Commands: none). Verification is structural: grep-based existence/uniqueness checks plus prose review.

## Tasks

> Tasks are ordered TDD-first: define the structural verification before making the prose change.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase.

### Phase 1 — Define the single protected-set resolution recipe

- [x] Write the structural check(s) for Phase 1: assert `SKILL.md` contains exactly one named protected-set resolution recipe block, positioned adjacent to and before the Step-2 preflight; assert the block enumerates the three union sources (dynamic `origin/HEAD`, widened static `main`/`master`/`dev`/`trunk`, merge-base documented policy), the silent-degrade-on-failure clause, exact case-sensitive match, and the separate detached-HEAD STOP. (Expected to fail before implementation.)
- [x] Implement the recipe: add the single named protected-set resolution recipe to `SKILL.md` adjacent to the Step-2 preflight, defining the union (2a dynamic `origin/HEAD` with `git remote show origin` fallback; 2b widened static fallback `main`/`master`/`dev`/`trunk`; 2c merge-base `$mb` documented policy), the best-effort non-fatal silent degrade, exact case-sensitive branch match, and the unchanged separate detached-HEAD STOP.

### Phase 1 verification

- Structural review only (no automated gate commands apply — markdown authoring). Assert: exactly one recipe block exists; it is placed before the Step-2 preflight's first use; all three union sources, the silent-degrade clause, exact-match semantics, and the detached-HEAD STOP are present. Confirm the merge-base (`$mb`) trust anchor is named for source (c) and the resolved names are described as data used only for comparison.

### Phase 2 — Re-point the three enforcement sites at the recipe

- [x] Write the structural check(s) for Phase 2: assert no enforcement site restates a literal `main`/`master`/`dev` (or other hardcoded) branch list; each of the three sites references the recipe by name; and the preserved prose (preflight STOP message + feature-branch guidance, Step-3.4 gate A/B/C/D ordering, defense-in-depth re-assert-before-commit) is still present verbatim. (Expected to fail before implementation.)
- [x] Re-point the Step-2 preflight (bug-7) STOP-before-invoking-any-framework gate to consume the recipe output; preserve its STOP message and "create/switch to a feature branch" guidance unchanged.
- [x] Re-point the Step-3.4 acceptance gate A "Branch unchanged (structural)" to consume the same recipe output; preserve the A/B/C/D ordering and the existing "do not fork a second definition" directive.
- [ ] Re-point the Step-3.4 defense-in-depth "Protected-branch guard" to consume the recipe output; preserve the re-assert-before-commit behavior.
- [x] Confirm backward-compatibility prose holds: the change only widens protection, no previously-allowed feature branch is newly blocked except the repo's real default; note explicitly that validation-fixer has no `.opencode/` port so no mirroring is required.

### Phase 2 verification

- Structural review only. Assert: none of the three sites restates a literal branch list; all three reference the single recipe by name; the preflight STOP message + feature-branch guidance, the Step-3.4 acceptance gate A/B/C/D ordering, and the defense-in-depth re-assert-before-commit are all preserved verbatim. Re-confirm the merge-base trust anchor and data-not-commands framing survive the edits.

### Phase 3 — Final structural pass

- [x] Run the full structural review across `SKILL.md` and confirm all acceptance criteria (1–8) hold; confirm cross-references within the file resolve and the recipe is single-sourced with no drift between the three sites.

## Verification (per phase)

> Apply the Commands section of PROJECT-CONTEXT.md to determine per-phase gate
> commands. For this repo, markdown/template authoring has **no automated
> build/test/lint commands** (PROJECT-CONTEXT → Commands: "none"), and the lone
> JS gate suite (`clean-code-gates`) is scoped to that skill only and MUST NOT
> be run against this doc change. Therefore no gate command applies to any phase
> here; the phase exit criterion is a passing **structural review** (the
> `### Phase N verification` checklist above), per PROJECT-CONTEXT "Test
> tooling" (tester treats automated tests/coverage as N/A / advisory for doc
> skills). No silent rewrites of `SKILL.md` to force a check green without a
> corresponding plan task.

Per-phase gate: structural review of the changed section(s) — assert the phase's `### Phase N verification` checklist passes. G1 (coverage) and G6 (mutation) remain QA-only and are not emitted here.

## Dependencies

- None. (The bug-7 preflight, sec-1 acceptance gate, and sec-2 rollback guard this change re-points already landed earlier this run and are present in `SKILL.md`.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-21T23:36:33Z | QA

QA-20260721T233633Z-f425 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
Doc-only change — no automated suite/gates apply; clean-code-gates JS suite correctly not run
(Invariant-scoped). Structural AC 1-8 re-verified GREEN; G8 rework ratio 0.00.

### 2026-07-21T23:35:41Z | REVIEWER

CR-20260721T233413Z-8739 created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-21T23:30:29Z | TESTER

TEST-20260721T233029Z-ac82 created. Status: PASS. Coverage: N/A% → N/A% (doc-only skill;
no automated test/coverage tooling per PROJECT-CONTEXT — verification is structural).
All AC 1-8 structurally verified GREEN; recipe single-sourced, three sites reference it by
name, no literal branch list outside the recipe, diff confined to one file. `clean-code-gates`
JS suite correctly NOT run. Non-blocking note: plan task at line 66 (defense-in-depth re-point)
left `[ ]` unchecked though its work is present at SKILL.md line 550 — bookkeeping miss for the
reviewer to tick, no functional gap.

### 2026-07-21T23:29:34Z | CODER

All 9 tasks complete. Plan status → DONE. Ready for reviewer.
Single file touched: `plugins/my-skills/skills/validation-fixer/SKILL.md`. Added one
named "Protected-branch set resolution recipe" (union of dynamic `origin/HEAD`, widened
static `main`/`master`/`dev`/`trunk`, merge-base `$mb` documented policy; silent non-fatal
degrade; exact case-sensitive match; separate detached-HEAD STOP) and re-pointed all three
enforcement sites (Step-2 preflight, Step-3.4 gate A, Step-3.4 defense-in-depth guard) at it
by name — no literal branch list remains outside the recipe. All AC 1-8 verified GREEN via
structural review (no automated gate commands apply to markdown authoring).

### 2026-07-21T23:22:58Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-21T23:20:22Z | ARCHITECT

Plan `FEAT-20260721T232022Z-f51c` created. Type: feat. Tasks: 9.
Status: PLANNED. Ready for coder.
