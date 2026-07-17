---
id: QA-20260716T175919Z-1d60
plan: QAF-20260716T175126Z-b1a2
cr: CR-20260716T175603Z-7112
title: QA Report — Reconcile design prompt 12 READY(r) to untagged-inclusive definition
status: READY_TO_COMMIT
created_at: 2026-07-16T18:00:42Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [QAF-20260716T175126Z-b1a2](./QAF-20260716T175126Z-b1a2-reconcile-prompt-12-readiness-definition.md)

## Summary

Final structural/consistency QA over the whole system-band change set (parent `FEAT-20260716T161418Z-70c9` + `FIX-20260716T170225Z-6581` + this `QAF-20260716T175126Z-b1a2`). This is documentation/template authoring — no build, no test suite, no code-quality gates apply (recorded N/A per PROJECT-CONTEXT). The QAF closed the last divergent site: design prompt 12 (`docs/design-prompts/12-roadmap-release-matrix.md`) L16 + L47 now carry the untagged-INCLUSIVE `READY(r)` semantics matching every other site. All structural invariants hold; verdict READY_TO_COMMIT.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Automated tests (node --test) | — | — | — | — | N/A — doc/template authoring, no test framework |
| Lint | — | — | — | — | N/A — no markdown linter configured |
| Build / typecheck | — | — | — | — | N/A — no build step |
| Format check | — | — | — | — | N/A |
| Structural / consistency validation (grep + read) | 7 | 7 | 0 | 0 | ✅ |

## Clean Code Gates

Not applicable — this change set is markdown skill docs, template files, and design-prompt `.md` files. Per PROJECT-CONTEXT (Commands / Test tooling) the clean-code-gates suite targets the unrelated `clean-code-gates` JS and is explicitly out of scope. All gates recorded N/A.

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage | — | — | N/A (no code / no coverage tooling) |
| G2 Complexity | — | — | N/A (no code) |
| G4 Naming | — | — | N/A (no code) |
| G5 No comments | — | — | N/A (no code) |
| G6 Mutation score | — | — | N/A (no code) |
| G7 Dependency structure | — | — | N/A (no code) |
| G8 Rework ratio | plan-level signal | ≤0.5 | N/A (advisory; QAF is itself the remediation closing a prior QA) |

## Structural Validation (in place of test suite)

| # | Check | Command / method | Result |
|---|-------|------------------|--------|
| 1 | Declared-only readiness phrasing eliminated in design prompts | `grep -rniE "for every declared system\|laggard system column" docs/design-prompts/` | ✅ 0 matches |
| 2 | Untagged-EXCLUDING phrasing absent across roadmap skill + design doc + prompts | `grep -rniE "laggard system column\|for every declared system\|declared-system column has remaining" plugins/.../roadmap/ docs/design-prompts/ docs/superpowers/specs/` | ✅ 0 matches |
| 3 | Single `READY(r)` definition consistent across ALL sites incl. both prompts | Read all "regardless of system" sites | ✅ Consistent |
| 4 | `.md`/`.html` template parity (all 5 roadmap template pairs) | file-existence pairing | ✅ 5/5 pairs present |
| 5 | Cross-refs resolve (prompt 12 → SKILL.md → Release readiness) | anchor grep | ✅ `## Release readiness` (SKILL.md:165) present |
| 6 | Division of labor (PM never writes `/roadmap/`; exactly one skill writes it) | invariant grep | ✅ Held in roadmap-management.md, mutation-ops.md, SKILL.md |
| 7 | No dangling cross-refs / undefined tokens; backward-compat prose intact | token + backward-compat grep | ✅ All `{{…}}` are documented injection points; backward-compat/legacy-collapse prose present (prompt 12 L107, L144) |

**READY(r) definition sites verified consistent (untagged-inclusive):**
- `roadmap/SKILL.md` L175–176 — "every not-superseded story with release=r is done, regardless of system … no cell in row r — every declared-system column AND the (untagged) column — has remaining not-done work"
- `release-matrix.template.md` L24–26, L42–44 and `release-matrix.template.html` L222, L238, L257, L261 — same, in both variants
- `roadmap-readme.template.{md,html}` L54–55 / L587–588 — "regardless of system — no column, including (untagged) …; laggard columns (which may include (untagged))"
- design doc `2026-07-16-…-design.md` L47 — `READY(r) := … regardless of system`
- design prompt 12 L16 (derivation) + L47 (READY? verdict) — reconciled by this QAF; L47 now "naming the laggard columns, which may include `(untagged)`"

**Legitimate structural "declared system" uses left intact** (matrix layout, not readiness gate): prompt 12 L45, L64, L103; these describe one column per declared system and are correct.

## Failures

None — all structural checks passed.

## Lint / Format / Type Issues

None — no linting/format/type tooling applies to this doc/template change set.

## Known Non-Blocking Item (accepted deferral)

### SF-1 — prompt 12 L7 intro says "names its laggard systems"

`docs/design-prompts/12-roadmap-release-matrix.md:7` — the Role & context intro's trailing verdict marks each release `READY` "or names its **laggard systems**". This is non-normative framing prose, not the READY(r) derivation: it is not matched by the declared-only verification grep, and a future regeneration follows the normative L16/L47 (both untagged-inclusive), not the intro. The QAF plan (Technical Notes) reviewed L7, scoped it out of F-1, and the CR (SF-1) recorded it as a safe deferral. Confirmed present; noted, NOT blocking. Optional future consistency pass: change "laggard systems" → "laggard columns".

## Verdict

**Status**: READY_TO_COMMIT

All structural and consistency invariants hold across the whole change set: the single untagged-inclusive `READY(r)` definition is now consistent at every site including both design prompts, the declared-only greps return zero matches, `.md`/`.html` template parity holds, cross-refs resolve, the division-of-labor invariant is preserved, and backward-compat prose is intact. The one residual item (SF-1, prompt 12 L7 non-normative intro) is an accepted deferral and does not block. Safe to commit and open PR.
