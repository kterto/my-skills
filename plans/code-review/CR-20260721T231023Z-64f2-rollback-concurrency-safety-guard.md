---
id: CR-20260721T231023Z-64f2
plan: FEAT-20260721T225557Z-02b3
title: Review of Guard autonomous rollback against erasing concurrent work
status: APPROVED
created_at: 2026-07-21T23:12:44Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260721T225557Z-02b3](../feat/FEAT-20260721T225557Z-02b3-rollback-concurrency-safety-guard.md)

## Summary

Reviewed the single-file doc-skill change to `plugins/my-skills/skills/validation-fixer/SKILL.md` (working-tree diff, +96/-11) implementing the rollback concurrency-safety guard (SPEC-…-a8c8). The edit adds an exclusive-worktree Preconditions note, converts the failure-path rollback to a guarded five-step sequence (attribute-or-STOP → snapshot → reset → enumerated NUL-safe `rm` → rewrite), removes the `git clean -fd` sweep from the recipe, and documents the uncommitted-only posture plus a concurrency Edge-case and Note. All nine acceptance criteria hold; the two regression traces (bug-6, bug-11) are untouched and read verbatim; the diff is confined to SKILL.md. Verdict: APPROVED.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | No `git clean` in the rollback recipe; enumerated path/NUL-safe `rm` of only non-baseline untracked paths; `-x` forbidden | ✅ | Recipe step 4 (lines 320-331) enumerates via `git status --porcelain -z` `??` entries, subtracts the baseline, `rm -- <path>` NUL-delimited. `-x` explicitly forbidden (329). The lone surviving `git clean` mention (805) is the AC-8 backward-compat Note, not the recipe. |
| 2 | Pre-reset autonomous concurrency guard: tracked path outside `BEFORE_SHA..AFTER_SHA` delta (or architect signal) → STOP, record `- [~]`, never reset; binds autonomous | ✅ | Step 1 of the guarded sequence (293-316); binds autonomous mode (312-313). |
| 3 | STOP surface enumerates branch, BEFORE_SHA, AFTER_SHA, porcelain, oneline log, removal set, reason | ✅ | Lines 308-311, mirrored in the Edge-case entry (767-776). |
| 4 | Preconditions note near preflight/3.1 gate: exclusive-worktree, detect-and-surface, isolation deferred Non-goal | ✅ | Lines 137-157, placed right after the bug-7 preflight. |
| 5 | Guard defined exactly once in the shared recipe; all callers inherit; batch delta = whole-batch delta | ✅ | Defined once at 293 ("defined here once; every caller below inherits it"); checkpoint-rejection (468), BLOCKED/errored 3.4 (506-509), sec-1 C/D (446-449), batch (599-603) and main-agent (565-567) all route through the shared bug-11/bug-15 rollback. Batch delta = whole batch (298-299). |
| 6 | Uncommitted-only posture explicit (proceeds on precondition, FR-2 still applies, removal set surfaced, no perfect-attribution claim, tracked heuristic still STOPs) | ✅ | Lines 335-345. |
| 7 | Existing guarantees retained; bug-6 & bug-11 traces verbatim; concurrency Edge-case/Note added; unconditional reset+clean descriptions updated | ✅ | Diff hunks touch only ~134, ~266-288, ~699, ~720; traces at 672-736 untouched. Edge-case (767-776) and Note (798-807) added. |
| 8 | Backward compatibility: no-concurrency case behaves as today except `git clean` → enumerated `rm`; legacy provenance/re-run semantics unchanged | ✅ | Note lines 803-807. |
| 9 | Change confined to `validation-fixer/SKILL.md`; no JS/template/ADR/PROJECT-CONTEXT edit; only a one-line ADR-0008 cross-ref permitted | ✅ | `git status` shows only SKILL.md modified; ADR-0008 referenced but its file is unmodified; no opencode port exists (single-copy skill). |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Committed-case guard omits the honest-limit caveat the uncommitted posture carries

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:300`
**Problem**: The committed-case attribution signal is "any tracked path modified in the working tree that is **not** in the attributable committed delta cannot be attributed to this work unit." That correctly catches a concurrent edit to an *unrelated* file, but a concurrent edit to a file that **is** in the committed delta (e.g. the framework committed `foo.js` and the user also edited `foo.js` in the working tree) falls inside the delta and is silently discarded by `reset --hard` — the same residual risk the uncommitted-only posture explicitly acknowledges with its "no perfect-attribution claim is made" caveat (342-343). The committed-case prose reads as if attribution were exact, so the honest limit is asymmetric between the two paths. This is spec-faithful (FR-3 defines the signal exactly this way, and the guard is deliberately "proportionate"), so it is non-blocking — but a one-clause acknowledgement in the committed-case guard that overlapping-file concurrent edits remain the shared-worktree model's residual limit (which the deferred worktree-isolation Non-goal would close) would make the two paths symmetrically honest.
**Fix**: Append a short caveat to the committed-case guard (near line 305), e.g. "(A concurrent edit to a file *inside* the delta still rides along with the reset — the same shared-worktree residual the worktree-isolation Non-goal would close.)" No behavioral change; documentation-honesty only.

---

## Verdict

**Status**: APPROVED

All nine acceptance criteria are met with zero Must Fix items; the single Should Fix is an optional documentation-honesty refinement that does not block.

Invoke `/qa` with plan ID `FEAT-20260721T225557Z-02b3` to run the QA suite.
