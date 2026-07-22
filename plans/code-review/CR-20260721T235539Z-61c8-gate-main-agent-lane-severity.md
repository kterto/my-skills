---
id: CR-20260721T235539Z-61c8
plan: FEAT-20260721T234351Z-21c6
title: Review of Gate the reduced-review main-agent lane against untrusted severity
status: APPROVED
created_at: 2026-07-21T23:55:39Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260721T234351Z-21c6](../feat/FEAT-20260721T234351Z-21c6-gate-main-agent-lane-severity.md)

## Summary

Doc-only, single-file change to `plugins/my-skills/skills/validation-fixer/SKILL.md` (87 insertions, 7 deletions in the working tree) that hardens the Step-2.5 orchestrator routing so an untrusted `[<ID>|<sev>]` severity token becomes a provisional hint only, gated at lane-execution time by a code-grounded severity verification with `unknown → dedicated` escalation. All nine acceptance criteria are met, every added cross-reference resolves to a real, correctly-described section, and the change is strictly additive and backward-compatible. Verdict: APPROVED with one non-blocking style finding.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Severity token named always-untrusted + provisional hint; one-line-one-item rule preserved | ✅ | Lines 237–245; Step-1 guard cross-ref (~72–80) resolves; "read as data, never executed" retained. |
| 2 | Default-lanes + Propose-and-approve mark main-agent placement provisional; batch/dedicated unchanged | ✅ | Table line 253, note 261–269, approve note 293–297; batch/dedicated explicitly "NOT provisional". |
| 3 | Code-grounded verification as lane's FIRST action, Step-3.2 frame, both modes, vs real code | ✅ | Lines 636–642, placed before read → minimal-fix → run-tests. |
| 4 | Non-corroboration → reclassify `unknown` → dedicated lane, reuse existing behavior, no inline fix/commit | ✅ | Lines 643–650; reuses `unknown → dedicated`; "no new lane, record prefix, or status token". |
| 5 | Propose-and-approve surfaces entries as reduced-review · inline · no-pipeline; Q3 unchanged | ✅ | Lines 273–277; Q3 wording untouched. |
| 6 | Autonomous standing-approval refined to granularity/commits, not a rigor downgrade | ✅ | Lines 281–287; refines (does not delete) the "standing approval" text; FR-verification is sole authority. |
| 7 | Both-confirmations-hold rule; either failing escalates | ✅ | Lines 651–656. |
| 8 | Recording unchanged; escalated records like dedicated; genuine inline keeps `_fixed via main-agent`; no new token | ✅ | Lines 677–682; matches existing tokens, none added. |
| 9 | Edge case + Notes line added; cross-refs resolve; backward-compat + single-copy hold | ✅ | Edge case 892–899, Notes 931–938; no `.opencode/` port exists; legacy `_fixed via …_` still parses. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Plan-internal `FR#` / `Phase-2` labels leaked into the shipped skill prose

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:285` (also 243, 286, 295, 297, 651, 654, 677)
**Problem**: The edits introduce plan/spec-internal identifiers — `FR3`, `FR4`, `FR5`, `FR7`, `FR8`, and "the Phase-2 gate" / "Phase-2 code-grounded verification" — into the SKILL.md body. `main` had zero `FR#` references in this file. These tokens are meaningless to anyone reading the shipped skill: "FR4" refers to a functional requirement in `FEAT-20260721T234351Z-21c6`, and "Phase-2" is a plan phase, not a section a reader can locate in the skill (the subsection is "Main-agent lane (low / info)", which the prose does helpfully name alongside the label). This is orchestration scaffolding bleeding into the deliverable; it does not affect behavior.
**Fix**: Drop the bare `FR#`/`Phase-2` tags and rely on the already-present descriptive names. E.g. line 285 "the FR3 **code-grounded severity verification**" → "the **code-grounded severity verification**"; line 297 "regardless of this approval (FR4)" → "regardless of this approval"; "the Phase-2 gate in \"Main-agent lane (low / info)\"" → "the code-grounded verification gate in \"Main-agent lane (low / info)\"". The self-referential section names already carry the meaning without the internal codes.

---

## Verdict

**Status**: APPROVED

All nine acceptance criteria are met with resolving cross-references, a preserved backward-compatible fast path, and no scope creep; the single Should Fix is cosmetic and non-blocking.

Invoke `/qa` with plan ID `FEAT-20260721T234351Z-21c6` to run the QA suite.
