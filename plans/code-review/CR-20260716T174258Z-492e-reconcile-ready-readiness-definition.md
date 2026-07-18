---
id: CR-20260716T174258Z-492e
plan: FIX-20260716T170225Z-6581
title: Review of Reconcile READY(r) readiness definition across six sites
status: APPROVED
created_at: 2026-07-16T17:42:58Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 0
---

**Related:** [FIX-20260716T170225Z-6581](./FIX-20260716T170225Z-6581-reconcile-ready-readiness-definition.md)

## Summary

Reviewed the documentation/template reconciliation that resolves MF-1 from `CR-20260716T165719Z-281e` — the `READY(r)` release-readiness definition was stated two incompatible ways across six sites, and the adjudicated semantics (remaining `(untagged)`/`system: null` work DOES gate readiness) is now stated one consistent way everywhere. All six required sites plus the SF-1 design-doc block express the single canonical definition; no untagged-excluding "declared systems only" phrasing survives; both `.md`/`.html` template pairs remain at parity; and backward-compat prose and the PM-pointer discipline are unchanged. Verdict: **APPROVED**.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `roadmap/SKILL.md` READY derivation is release-wide, untagged-inclusive, no "declared systems only" restriction | ✅ | L175-176: `READY(r) := every not-superseded story with release=r is done, regardless of system ( equivalently: no cell in row r — every declared-system column AND the (untagged) column — has remaining not-done work )`. Old "for every declared system s" scaffolding removed. |
| 2 | `release-matrix.template.md` verdict comment + Legend include `(untagged)` in the gate and permit it in laggards; L32 example unchanged | ✅ | Verdict comment L23-26 and both Legend rows L42-43 reconciled; the `(untiered) … 2/5 … lagging: (untagged)` demonstration row (now L33) is intact and correct. |
| 3 | `release-matrix.template.html` matrix comment, TBODY comment, both Legend descs include `(untagged)` | ✅ | L221-223 (matrix), L238 (TBODY, "naming the laggard columns, which may include `(untagged)`"), L257 + L261 (legends) all reconciled; parity with `.md`. |
| 4 | `roadmap-readme.template.md` embedded-matrix comments match canonical definition | ✅ | L52-55: "no column, including `(untagged)`, has remaining not-done work; laggard columns (which may include `(untagged)`) are called out." |
| 5 | `roadmap-readme.template.html` embedded-matrix comments match; `.md`/`.html` parity for both pairs | ✅ | L585-588 + L599-604 reconciled; both template pairs verified at parity. |
| 6 | PM `SKILL.md` (`release-status`) and `references/roadmap-management.md` remain pure pointers — no local formula | ✅ | SKILL.md L182 "computes exactly the derivation defined in `roadmap/SKILL.md` → Release readiness — PM adds no divergent logic"; roadmap-management.md L34 "computes exactly the matrix defined in `roadmap/SKILL.md` → Release readiness (no divergent logic)". No local READY formula in either. |
| 7 | Repo-wide search for declared-only phrasing returns no contradicting occurrence | ✅ | `every declared system s` / `declared systems only` / `for every declared system` → NONE. All surviving "declared-system column" hits are the reconciled "…AND the (untagged) column…" form. |
| 8 | (SF-1, optional) design-doc Release-readiness block mirrors reconciled wording | ✅ | L47-48 mirrors: `READY(r) := every not-superseded story with release=r is done, regardless of system ( i.e. no cell in row r — every declared-system column AND the (untagged) column — has remaining not-done work )`. |

## Must Fix (Blockers)

None — no blockers found. MF-1 from `CR-20260716T165719Z-281e` is fully and correctly reconciled across all six sites.

## Should Fix (Warnings)

None — no warnings found. Local phrasing varies slightly between sites ("no column, including `(untagged)`" vs "no cell in row r — every declared-system column AND the `(untagged)` column") but both forms are semantically identical to the canonical oracle, and per-site local phrasing is explicitly permitted by the plan. Not a defect.

## Regression Checks

- **Backward-compat prose** — intact in every touched file: a legacy untagged roadmap still collapses the matrix to a single `(untagged)` column; `superseded` still counts as no-remaining-work. No regression.
- **release↔system symmetry** — the `system`-band machinery mirroring the `release` band (SKILL.md L145, mutation-ops, config) is untouched by this definitional edit; readiness wording is orthogonal to band symmetry. No regression.
- **`.md`/`.html` parity** — both `release-matrix` and `roadmap-readme` pairs carry identical gate + laggard wording across variants. Verified.
- **PM pointer discipline** — no divergent local `READY(r)` formula was introduced; both PM sites remain pointers to `roadmap/SKILL.md` → Release readiness.

## Verdict

**Status**: APPROVED

All eight acceptance criteria are met, the sole prior blocker (MF-1) is reconciled to one untagged-inclusive definition across all six sites plus the SF-1 design doc, parity and backward-compat hold, and no regression was introduced.

Invoke `/qa` with plan ID `FIX-20260716T170225Z-6581` to run the QA suite.
