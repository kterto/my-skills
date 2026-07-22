---
id: CR-20260721T224406Z-1725
plan: FEAT-20260721T222950Z-7cf1
title: Review of Validate framework-owned commits before accepting them as fixes
status: APPROVED
created_at: 2026-07-21T22:46:29Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260721T222950Z-7cf1](../feat/FEAT-20260721T222950Z-7cf1-framework-commit-acceptance-gate.md)

## Summary

Doc-only change to `plugins/my-skills/skills/validation-fixer/SKILL.md` (+77/-4, one file) adding
a four-invariant post-run acceptance gate to the Step-3.4 "Framework signaled success AND HEAD
advanced" branch, plus the `BEFORE_BRANCH` capture at Step 3.1 and touch-ups to Edge cases and
Notes. All 12 acceptance criteria are met, all load-bearing invariants hold, and the change is
strictly confined to the target branch — the own-commit path, ADR-0008, the protected-set
definition, PROJECT-CONTEXT line 68, and the (absent) opencode port are untouched. **Verdict:
APPROVED.**

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Step 3.1 captures `BEFORE_BRANCH` via `git rev-parse --abbrev-ref HEAD` | ✅ | SKILL.md:241-244, beside `BEFORE_SHA`/untracked baseline, described as the gate's reference |
| 2 | Framework-owned-commit branch gates on all four invariants, structural before destructive | ✅ | SKILL.md:329-358; A/B ordered before C/D with the "decide whether the destructive rollback is safe" rationale |
| 3 | Invariant A — branch == `BEFORE_BRANCH`, not detached, not protected, same Step-2 set | ✅ | SKILL.md:336-340; reuses `main`/`master`/`dev` re-derived-from-host, matching Step-2 preflight (127-135) |
| 4 | Invariant B — `merge-base --is-ancestor`, prose explains why count is insufficient | ✅ | SKILL.md:341-347; orphaned-`BEFORE_SHA`/switched-branch case spelled out |
| 5 | Invariant C — delta excludes validation file(s), path-exact, pre-run backlog note | ✅ | SKILL.md:348-353; `git diff --name-only`, same repo-relative matcher, backlog-in-`BEFORE_SHA` note present |
| 6 | Invariant D — clean porcelain with validation files + baseline dropped | ✅ | SKILL.md:354-358; explicitly "exactly as" the Step-3.1 gate / bug-15 baseline |
| 7 | Any A–D failure → "did NOT signal success" outcome, `- [~]` never `- [x]` | ✅ | SKILL.md:364-366; framed as the bug-12 principle extended |
| 8 | Structural A/B STOP-and-surface with exact fields, no reset, binds autonomous | ✅ | SKILL.md:369-378; surfaces current branch, `BEFORE_BRANCH`, `BEFORE_SHA`, `AFTER_SHA`, porcelain, `git log --oneline`; "binds autonomous mode too" |
| 9 | Content C/D reuse the existing rollback / surface, no new machinery | ✅ | SKILL.md:379-384; lands verbatim in the unchanged "did NOT signal success" outcome (435-449) |
| 10 | Change confined; own-commit path unchanged; primitives reused | ✅ | Own-commit path (388-434) byte-unchanged; no second parser/exemption/protected-set; no line-68 edit; no opencode port |
| 11 | Edge cases / Notes reconciled; bug-6 happy path unaffected; trust rule intact | ✅ | Edge cases (694-701), Notes (716-722) updated; bug-6/bug-11 traces untouched (diff is 4 hunks only) |
| 12 | Backward compatibility — legacy provenance parses, well-behaved commit passes | ✅ | SKILL.md:360-362, 700-701, 721-722; "additive verification only", normal case accepted as before |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — "Route to the … outcome" reads as prescribing the rollback for A/B before the override

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:364`
**Problem**: The failure clause opens with "Route to the **'Framework did NOT signal success'**
outcome below and record `- [~]`", but that outcome's autonomous behavior is a `git reset --hard`
rollback — the exact action the immediately-following structural (A/B) branch forbids ("Do NOT
reset"). A hurried reader could momentarily read A/B as inheriting the rollback before reaching
the override two lines down. The intent is faithful to AC-7 + AC-8 (which use the same framing),
and the `*How* it isolates depends on which invariant failed` sentence plus the explicit split do
resolve it — so this is a clarity nit, not a correctness gap.
**Fix**: Optional. Consider narrowing the lead-in to the recording semantics only, e.g. "Treat it
as **not fixed** — record `- [~]` (needs attention), never `- [x]` … then isolate per the split
below", so the "route to that outcome" wording attaches to C/D (which genuinely reuse it) rather
than to A/B (which override it). No behavior change; purely wording.

---

## Verdict

**Status**: APPROVED

All 12 acceptance criteria are satisfied, every load-bearing invariant holds, and the change is
confined to the framework-owned-commit branch with all primitives reused rather than reinvented;
the lone Should Fix is an optional wording clarification.

Invoke `/qa` with plan ID `FEAT-20260721T222950Z-7cf1` to run the QA suite.
