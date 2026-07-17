---
id: CR-20260716T175603Z-7112
plan: QAF-20260716T175126Z-b1a2
title: Review of Reconcile design prompt 12 READY(r) to untagged-inclusive definition
status: APPROVED
created_at: 2026-07-16T17:58:11Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [QAF-20260716T175126Z-b1a2](../qa/QAF-20260716T175126Z-b1a2-reconcile-prompt-12-readiness-definition.md)

## Summary

Doc-only QA-remediation of the last blocking defect (F-1): design prompt `docs/design-prompts/12-roadmap-release-matrix.md` still carried the pre-reconciliation "declared system"-only READY(r) semantics at L16 (derivation note) and L47 (READY? verdict). Both spans were rewritten to the untagged-INCLUSIVE form and now match the shipped `release-matrix.template.{md,html}` and `roadmap/SKILL.md` → Release readiness verbatim in intent. All four acceptance criteria are met; the declared-only grep returns zero matches and every legitimate structural "declared system" reference was left intact. No blockers.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | L16 derivation note states untagged-INCLUSIVE READY(r) (every declared-system column AND `(untagged)`, regardless of `system`; `superseded` = no-remaining-work) | ✅ | L16 now reads "every not-superseded story with that `release` is `done`, regardless of `system` — no cell in the row, across every declared-system column AND the `(untagged)` column, has remaining not-done work; `superseded` counts as no-remaining-work." Matches SKILL.md L175-176 and both template variants. |
| 2 | L47 READY? verdict names "laggard columns, which may include `(untagged)`"; no "laggard system columns" | ✅ | L47 now reads "`lagging: <col>, …` in `warning` naming the laggard columns, which may include `(untagged)`." The excluding "laggard system columns" phrasing is gone. |
| 3 | `grep -rniE "for every declared system\|laggard system column" docs/design-prompts/` returns zero matches | ✅ | Re-ran independently — zero matches. |
| 4 | Structural "one column per declared system" phrasing (L44/L45/L64/L103) left intact | ✅ | L45 ("one column per declared system"), L64 ("one `<th scope="col">` per declared system"), L103 gallery ("every declared-system cell done") all unchanged; L48 path chip and L107 legacy-state prose also untouched and correct. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Intro prose at L7 still says "laggard systems", not "laggard columns"

**File**: `docs/design-prompts/12-roadmap-release-matrix.md:7`
**Problem**: The Role & context intro says a trailing verdict "marks each release `READY` or names its **laggard systems**." Now that the normative verdict (L47) and the gallery (L104) name "laggard columns" — which may include the `(untagged)` column, which is not a "system" — the intro's "laggard systems" is a minor untagged-excluding wording residue. It is descriptive prose, not the READY definition, and is not matched by the declared-only verification grep, so it does not affect correctness or a future regeneration's semantics (the renderer follows L16/L47, not the intro). The QAF plan (Technical Notes) explicitly reviewed L7, scoped it out of F-1, and asked that it be flagged only if a stricter consistency pass is wanted.
**Fix**: Optional. For full untagged-inclusive consistency, change "names its laggard systems" → "names its laggard columns" at L7. Non-blocking; safe to defer.

---

## Verdict

**Status**: APPROVED

All four acceptance criteria are met, the reconciled READY(r) wording matches every shipped site verbatim in intent, the declared-only grep is clean, and the single residual nit (L7) is non-normative prose the plan deliberately deferred.

Invoke `/qa` with plan ID `QAF-20260716T175126Z-b1a2` to run the QA suite.
