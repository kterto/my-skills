---
id: QA-20260716T174635Z-06c6
plan: FIX-20260716T170225Z-6581
cr: CR-20260716T174258Z-492e
title: QA Report — Reconcile READY(r) readiness definition across six sites
status: BLOCKED
created_at: 2026-07-16T17:46:35Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260716T170225Z-6581](../code-review/FIX-20260716T170225Z-6581-reconcile-ready-readiness-definition.md)

## Summary

This is a documentation/template change (roadmap + product-manager skills): there is no build, no automated test suite, and no code-quality gate tooling that applies (per PROJECT-CONTEXT → Commands / Test tooling). QA ran as a structural/consistency validation over the whole change set (parent FEAT-20260716T161418Z-70c9 + this FIX). Seven of eight validation dimensions hold, but one concrete blocking defect was found: **design prompt `12-roadmap-release-matrix.md` was NOT reconciled** — its derivation note and verdict spec still carry the pre-reconciliation "for every declared system" / "laggard system columns" phrasing, contradicting both the shipped templates it regenerates and the `SKILL.md` authority it cites, and reproducing the exact MF-1 two-incompatible-readings defect this FIX was meant to eliminate everywhere. Verdict: **BLOCKED**.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Automated tests (`node --test` etc.) | — | — | — | — | N/A — no test framework for skill docs/templates (PROJECT-CONTEXT → Test tooling) |
| Lint | — | — | — | — | N/A — no markdown lint configured |
| Build / typecheck | — | — | — | — | N/A — no build step |
| Format check | — | — | — | — | N/A — no formatter configured |
| **Structural / consistency validation** | 8 | 7 | 1 | 0 | ❌ |

## Clean Code Gates

Automated Clean Code gates G1–G7 target the unrelated `clean-code-gates` skill's JS and do **not** apply to this markdown/template change (explicitly out of scope per PROJECT-CONTEXT → Commands and per the QA task brief). They are recorded as **NOT-APPLICABLE**, not failed.

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | N/A — no coverage tooling; doc/template change |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | N/A — no executable code changed |
| G4 Naming | intent-revealing | 0 violations | N/A — no code identifiers |
| G5 No comments | inline comment audit | 0 violations | N/A — prose/templates, not source |
| G6 Mutation score (changed files) | killed / total | ≥70% | N/A — no tests/mutation tooling |
| G7 Dependency structure | layering, cycles | 0 violations | N/A — no module graph |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | N/A (advisory) — this plan is itself the FIX remediation of a prior CR |

## Structural Validation Results

| # | Dimension | Result | Notes |
|---|-----------|--------|-------|
| 1 | Single reconciled `READY(r)` definition across all shipped sites | ✅ | `roadmap/SKILL.md` L175-176, `release-matrix.template.md` L23-26/L42-43, `release-matrix.template.html` L221-223/L257/L261, `roadmap-readme.template.md` L53-55, `roadmap-readme.template.html` L586-588/L604 all state the untagged-inclusive gate ("…AND the `(untagged)` column…"; laggard "which may include `(untagged)`"). |
| 2 | `.md` / `.html` template parity (both touched pairs) | ✅ | Token sets identical except the documented html-root-only `{{created_at}}`/`{{updated_at}}` exception on `release-matrix`; reconciled wording mirrored across each pair. |
| 3 | Backward-compat prose intact | ✅ | `(untagged)`-column collapse + `superseded = no-remaining-work` present in `release-matrix.{md,html}`, `roadmap-readme.{md,html}`, `SKILL.md`. |
| 4 | Single-source-of-truth: PM sites are pure pointers | ✅ | `product-manager/SKILL.md` L182 "computes exactly the derivation defined in `roadmap/SKILL.md` → Release readiness — PM adds no divergent logic"; `roadmap-management.md` L34 "(no divergent logic)". No local formula. |
| 5 | Division of labor (PM never writes `/roadmap/`; readiness is derived) | ✅ | `release-status` maps to no mutation op; read-only, no branch/gate/PR; no persisted readiness state introduced. |
| 6 | `system` band symmetric to `release` | ✅ | Untouched by this definitional edit; readiness wording is orthogonal to band symmetry (CR regression check confirms). |
| 7 | No dangling cross-references / undefined template tokens | ✅ | All template/design-prompt/design-doc paths referenced from `SKILL.md` resolve; every `{{token}}` used is defined. |
| 8 | **Design prompts accurately describe the shipped templates** | ❌ | Prompt 13 is clean (structural additions + system legend, no READY formula). **Prompt 12 is NOT reconciled** — see F-1. |

## Failures

### F-1 — Design prompt `12-roadmap-release-matrix.md` still carries the pre-reconciliation READY definition (unreconciled site of MF-1)

`docs/design-prompts/12-roadmap-release-matrix.md` is the explicit regeneration source for `release-matrix.template.html` and `release-matrix.template.md` (prompt L11-16) and cites `roadmap/SKILL.md → Release readiness` as its authority. Yet two spans still carry the exact untagged-excluding phrasing this FIX removed from every other site:

**L16 (Derivation note)** — verbatim:
```
A release is `READY` only when, for every declared system, every not-superseded
story in that release is `done` (no cell in the row has remaining not-done work);
`superseded` counts as no-remaining-work.
```

**L47 (READY? verdict component)** — verbatim:
```
**READY? verdict:** `READY` in `success`, or `lagging: <system>, …` in `warning`
naming the laggard system columns.
```

**Why this is a concrete blocking defect:**

1. **Reproduces MF-1 verbatim.** L16 states the definition two incompatible ways in one sentence: the primary clause "for every declared system, every not-superseded story … is `done`" excludes `system: null` stories, while the parenthetical "(no cell in the row has remaining not-done work)" includes the `(untagged)` cell. This is exactly the two-readings ambiguity CR-20260716T165719Z-281e adjudicated (untagged open work DOES gate readiness) and this FIX eliminated everywhere else.
2. **Contradicts the templates it regenerates.** The shipped `release-matrix.template.{md,html}` now gate on "every declared-system column AND the `(untagged)` column" and permit `(untagged)` in the laggard callout ("naming the laggard columns, which may include `(untagged)`"). Prompt 12 L16/L47 say the opposite ("for every declared system"; "laggard system columns").
3. **Regeneration would reintroduce the fixed defect.** Because prompt 12 is the human-run Claude-design source for these templates (PROJECT-CONTEXT: "regeneration via Claude-design is a human step"), a future regeneration from the current prompt text would re-emit a template carrying the divergent, since-adjudicated-wrong semantics — undoing MF-1.
4. **Fails an explicit QA mandate.** The validation brief requires "the two design prompts (docs/design-prompts/12,13) accurately describe the shipped templates" and "the now-reconciled single `READY(r)` definition across all sites." Prompt 12 is a live site that is not reconciled.

**Likely cause**: The FIX plan deliberately scoped design prompt 12 out (its "Out of Scope": "Any file not listed in the CR's MF-1 / SF-1"). MF-1 enumerated six documentation/template sites plus the SF-1 design doc, but did not enumerate the design prompts — so the reconciliation stopped one site short of the full change set. The templates were fixed; their regeneration source was not.

**Suggested remediation** (for the QAF plan):
- Rewrite prompt 12 L16 to the untagged-inclusive form, e.g. "A release is `READY` only when every not-superseded story with that `release` is `done`, regardless of `system` — no cell in the row, across every declared-system column AND the `(untagged)` column, has remaining not-done work; `superseded` counts as no-remaining-work."
- Rewrite prompt 12 L47 so the laggard callout may name `(untagged)`, e.g. "`lagging: <col>, …` … naming the laggard columns, which may include `(untagged)`" — matching the shipped `release-matrix` template and `SKILL.md`.
- Re-run the declared-only grep across `docs/design-prompts/` to confirm zero remaining occurrences.

---

## Lint / Format / Type Issues

None — no lint/format/type tooling applies to this change (documentation/template authoring).

## Verdict

**Status**: BLOCKED

The shipped templates, `SKILL.md` derivation, PM pointer sites, and SF-1 design doc are correctly and consistently reconciled to the single untagged-inclusive `READY(r)` definition, with parity and backward-compat intact — but design prompt `12-roadmap-release-matrix.md` (the regeneration source for the very templates that were fixed) still states the pre-reconciliation, MF-1-defective definition, so the change set is not internally consistent across all sites.

Invoke `/architect` with this QA report path (`plans/qa/QA-20260716T174635Z-06c6-reconcile-ready-readiness-definition.md`) to generate a QAF remediation plan. The single failure (F-1) becomes the task: reconcile prompt 12 L16 + L47 to the untagged-inclusive definition and re-verify with the declared-only grep.
