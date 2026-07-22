---
id: CR-20260722T030225Z-45cc
plan: FEAT-20260722T000412Z-c096
title: Review of Robust dynamic fence for the untrusted-evidence handoff frame
status: APPROVED
created_at: 2026-07-22T03:04:21Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260722T000412Z-c096](../feat/FEAT-20260722T000412Z-c096-dynamic-fence-untrusted-evidence-handoff.md)

## Summary

Reviewed the single-file, doc-authoring change to `plugins/my-skills/skills/validation-fixer/SKILL.md` that replaces the fixed four-backtick fence in the Step-3.2 untrusted-evidence handoff frame with a dynamically sized `max(4, M+1)` fence (finding `sec-5`). The change is confined to the Step-3.2 construction site, correctly mirrors the CommonMark closing-fence rule, and every acceptance criterion is met by structural review. Backward compatibility holds (floor of 4 renders short items byte-for-byte identically) and no load-bearing invariant is touched. Verdict: APPROVED, with one optional style nit.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Step 3.2 instructs scan for longest run `M` and fence with `max(4, M+1)`, same length open/close, each on its own line | ✅ | Lines 439–448 state the scan, the formula, matched open/close lengths, and the own-line placement verbatim. |
| 2 | Illustrative example no longer presents a hardcoded four-backtick literal | ✅ | Lines 458–461 use a `⟨FENCE⟩` placeholder annotated as `max(4, M+1)` backticks, ≥4 and longer than any inner run. |
| 3 | Batch bullet wraps each grouped item in the Step-3.2 frame, inheriting the dynamic fence, no separate fixed-fence literal | ✅ | Lines 709–714 ("Combined brief, trust never merged") wrap each block individually in the Step-3.2 frame; no batch-specific fence literal exists. |
| 4 | No literal fixed-width fence remains wrapping untrusted item text | ✅ | `grep -nE '`{4,}'` returns zero four-backtick fences. Remaining triple-backtick fences (747–750, 770–773) are the non-evidence `_fixed via_` / `_attempted via_` status-line recording templates, outside the untrusted-evidence path. |
| 5 | Step-1 guard (~72–80) consistent with the new rule, no restated algorithm | ✅ | Lines 72–80 point at "the untrusted-evidence frame in Step 3.2" for the mechanism and describe only the *substance* of the guard; the fence algorithm is not restated or contradicted. |
| 6 | Backward-compatible: short items still fence at four backticks; no schema/state/provenance/legacy-backlog change | ✅ | `M ≤ 3 ⇒ max(4, M+1) = 4`; the working-tree diff touches only Step-3.2 prose — no frontmatter, state file, provenance line, or backlog wording changed. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Fence placeholder uses non-standard bracket notation

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:458,461`
**Problem**: The example marks the fence with `⟨FENCE⟩` (mathematical angle brackets U+27E8/27E9), whereas every other placeholder in the same prompt block uses the doc's established `<…>` convention (e.g. `<verbatim item text, including any referenced files/paths>` on line 460, `<file>`, `<section>`). The divergent glyph is a minor inconsistency with the surrounding placeholder style and is harder to type/grep. This is purely cosmetic — the adjacent annotation ("`max(4, M + 1)` backticks; ≥ 4 and always longer than the longest backtick run inside the item below") makes the intent unambiguous, so behavior is unaffected.
**Fix**: Optional. If aligning to the file's placeholder convention is desired, render it as `<FENCE>` (or `<opening fence>` / `<closing fence>`) to match the `<…>` style used one line below. Deliberate distinctness from the literal backtick glyph is a reasonable rationale to keep `⟨FENCE⟩` as-is — reviewer's call.

---

## Verdict

**Status**: APPROVED

All six acceptance criteria are satisfied by structural review, the change is scoped to the single Step-3.2 construction site with no invariant or backward-compat regression, and the lone finding is an optional cosmetic nit.

Invoke `/qa` with plan ID `FEAT-20260722T000412Z-c096` to run the QA suite.
