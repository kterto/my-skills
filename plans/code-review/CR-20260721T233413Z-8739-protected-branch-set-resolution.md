---
id: CR-20260721T233413Z-8739
plan: FEAT-20260721T232022Z-f51c
title: Review of validation-fixer — default-branch-aware protected-branch set resolution
status: APPROVED
created_at: 2026-07-21T23:35:41Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260721T232022Z-f51c](../feat/FEAT-20260721T232022Z-f51c-protected-branch-set-resolution.md)

## Summary

The plan adds a single named "Protected-branch set resolution recipe" to `validation-fixer/SKILL.md` and re-points all three enforcement sites (Step-2 preflight, Step-3.4 acceptance gate A, Step-3.4 defense-in-depth guard) at it by name. Reviewed the recipe block and every enforcement site against acceptance criteria 1–8 and the load-bearing invariants (two-trust-anchors, data-never-instructions, backward compatibility, doc-only structural verification). All eight criteria are met, the recipe is single-sourced with no literal branch list surviving outside it, and the invariants hold. Verdict: APPROVED. One non-blocking bookkeeping nit (a plan task left unchecked though its work is present).

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Exactly one named recipe, adjacent to and before the Step-2 preflight | ✅ | Single `### Protected-branch set resolution recipe` header at line 117; preflight begins line 166 (recipe precedes first use). `grep -c` returns exactly 1. |
| 2 | Union of (a) dynamic `origin/HEAD` (symbolic-ref → `git remote show origin` fallback), (b) widened static `main`/`master`/`dev`/`trunk`, (c) merge-base `$mb` documented policy | ✅ | Lines 126–139 enumerate all three sources including the `git symbolic-ref --short refs/remotes/origin/HEAD` primary + `git remote show origin` fallback. |
| 3 | Dynamic resolution degrades silently to (b) ∪ (c), never aborts/errors | ✅ | Lines 141–144: "best-effort … degrades silently … never aborts, errors, or STOPs the run"; (b) always present so set is never empty. |
| 4 | "Protected" = exact case-sensitive equality; detached HEAD independent STOP | ✅ | Lines 146–152: `git rev-parse --abbrev-ref HEAD`, no prefix/substring/case-insensitive match; detached HEAD kept as a separate unchanged STOP. |
| 5 | All three sites reference recipe by name; none restates a literal branch list | ✅ | Preflight (175, 185), gate A (455), defense-in-depth (550) all cite the recipe by name. The only literal `main`/`master`/`dev`/`trunk` tokens (121, 133, 159) live inside the recipe block itself (its own negation, source-(b) definition, backward-compat prose) — none at an enforcement site. |
| 6 | Surrounding gate behavior preserved verbatim | ✅ | Preflight STOP message + "create/switch to a feature branch" guidance (177–183); Step-3.4 A/B/C/D structural-before-content ordering (453–475); defense-in-depth re-assert-before-commit + "do not fork a second definition" (546–552, 456). |
| 7 | Documented policy read from merge-base (`$mb`); resolved names treated as data not commands | ✅ | Lines 136–139 bind source (c) to `$mb` per two-trust-anchors; lines 154–156 restate the data-never-commands (Step-1 trust) framing. Dynamic `origin/HEAD` correctly classified as repo state (working tree), not branch-authored policy. |
| 8 | Backward compatible (only widens); no opencode port mirrored | ✅ | Lines 158–164: static fallback retains the former `main`/`master`/`dev` set so nothing previously protected is unprotected; only widens; explicit note that validation-fixer has no `.opencode/` port. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Plan task checkbox left unchecked though its work is present

**File**: `plans/feat/FEAT-20260721T232022Z-f51c-protected-branch-set-resolution.md:66`
**Problem**: The Phase-2 task "Re-point the Step-3.4 defense-in-depth 'Protected-branch guard' to consume the recipe output" is still `[ ]`, but the work is actually done — the defense-in-depth guard at `SKILL.md:546-552` references the recipe by name and preserves the re-assert-before-commit behavior. The tester flagged this same bookkeeping miss. Purely a plan-hygiene inconsistency; no functional gap in the delivered `SKILL.md`.
**Fix**: Tick line 66 to `[x]` so the plan's task ledger matches the completed implementation. No code change.

---

## Verdict

**Status**: APPROVED

All eight acceptance criteria are met, the recipe is single-sourced with the three enforcement sites drift-proofed against it, and every load-bearing invariant holds; the lone finding is a non-blocking plan-checkbox bookkeeping nit.

Invoke `/qa` with plan ID `FEAT-20260721T232022Z-f51c` to run the QA suite.
