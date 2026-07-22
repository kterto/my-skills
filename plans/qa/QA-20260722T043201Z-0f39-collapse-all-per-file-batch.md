---
id: QA-20260722T043201Z-0f39
plan: FEAT-20260722T041913Z-916b
cr: CR-20260722T042857Z-6f19
title: QA Report — Resolve collapse-all (Q3) vs. no-cross-file (Q4) conflict in validation-fixer directory mode
status: READY_TO_COMMIT
created_at: 2026-07-22T04:33:15Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FEAT-20260722T041913Z-916b](../feat/FEAT-20260722T041913Z-916b-collapse-all-per-file-batch.md) · [CR-20260722T042857Z-6f19](../code-review/CR-20260722T042857Z-6f19-collapse-all-per-file-batch.md)

## Summary

This is a **documentation-only** plan: a prose reconciliation of the `validation-fixer`
skill's Q3-vs-Q4 routing conflict, touching exactly two markdown files
(`plugins/my-skills/skills/validation-fixer/SKILL.md` and
`docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md`). Per PROJECT-CONTEXT
§Commands / §Test tooling there is **no automated build / test / lint framework** for doc-skill
authoring, and the `clean-code-gates` JS suite is Invariant-scoped and MUST NOT run against a
doc skill. QA verification is therefore **structural review** (the gate the plan's own
`## Verification (per phase)` section designates), which is green across all applicable checks.
Verdict: **READY_TO_COMMIT**.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Automated tests (doc skill) | — | — | — | — | N/A (no framework; structural review — PROJECT-CONTEXT §Test tooling) |
| `clean-code-gates` JS suite | — | — | — | — | NOT RUN — Invariant-scoped to that skill only; MUST NOT run against doc skills |
| Lint (markdown) | — | — | — | — | N/A (none configured) |
| Build / typecheck | — | — | — | — | N/A (no build step for markdown/templates) |
| Format check | — | — | — | — | N/A (none configured) |
| Structural review (5 per-phase gates + AC-1..AC-10) | 15 | 15 | 0 | 0 | PASS |

## Clean Code Gates

The G1–G7 Clean Code gates run against **runtime code** via per-stack tooling. The changed set
is two markdown documents with no runtime code; the sole JS island in the repo
(`clean-code-gates`) is untouched and its suite is Invariant-scoped and MUST NOT be run against
a doc skill. The plan's `## Verification (per phase)` section explicitly designates **structural
review** as the gate and explicitly scopes out G1 (coverage) and G6 (mutation) as inapplicable
to markdown. Accordingly G1–G7 are **N/A by Invariant** (not MISSING_TOOL — there is no code
surface to measure, by design), and are non-blocking here. G8 (plan-level) is computed and
passes.

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | N/A — no code surface (markdown docs; no coverage instrument) |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | N/A — no code surface |
| G4 Naming | intent-revealing | 0 violations | N/A — no code surface |
| G5 No comments | inline comment audit | 0 violations | N/A — no code files in changed set (markdown prose) |
| G6 Mutation score (changed files) | killed / total | ≥70% | N/A — no code surface |
| G7 Dependency structure | layering, cycles | 0 violations | N/A — no code surface |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | PASS — (0 + 0) / 1 = 0.0 |

**G8 detail:** 1 CR total for this plan (`CR-20260722T042857Z-6f19`, APPROVED); 0
REQUEST_CHANGES cycles; 0 FIX/QAF plans spawned. Ratio 0.0 ≤ 0.5 — no HIGH_REWORK flag.

## Structural review (the applicable gate)

All five per-phase structural gates hold on the changed set, and the acceptance-criteria prose
is present in the edited files:

- **Internal consistency (G-consistency):** Q3 and Q4 agree — Q3 (SKILL.md L309–319) defines
  "collapse everything" as **one collapsed batch per file** and explicitly defers to Q4 as the
  governing invariant; Q4 (L322–325) states "Batches never span files (the hard invariant that
  governs Q3)". No clause contradicts another.
- **AC coverage:** "one collapsed batch per file" (L315, L899); "overriding all lane defaults"
  narrowed to severity **lane defaults**, not the file boundary (L311, L317); single-file
  degenerate-case note (L319); N files → N shared commits (L317, L899); no cross-file SHA
  aggregation (L941); 2-file worked trace with independent per-file whole-batch rollback
  (L896–940, "Collapse-all per-file batch lifecycle" scenario incl. the independent-rollback
  variant).
- **Cross-references resolve:** Q1–Q4, ADR-0008, sec-3, bug-11/bug-15 all referenced against
  existing anchors.
- **Invariant-preservation & backward-compat prose:** Q4 file boundary stated as governing;
  ADR-0008 work-unit contract preserved; single-file / legacy single-SHA behavior described as
  unchanged, additive, no migration.
- **Scope containment:** working-tree changes are exactly `SKILL.md` + `ADR-0008` (M); no JS, no
  `.opencode` port (validation-fixer has none), no `.bak-*` file, no `templates/` touched.
- **ADR-0008 note:** the single optional file-boundary-cap line is present (ADR-0008 L160) and
  introduces no claim beyond the file-boundary cap.

## Failures

None — no automated suite applies; structural review passed on all checks.

## Lint / Format / Type Issues

None — no lint/format/type tooling is configured for markdown doc-skill authoring
(PROJECT-CONTEXT §Commands: Build none, Test none, Lint none).

## Verdict

**Status**: READY_TO_COMMIT

Documentation-only change; all applicable verification (structural review of the two changed
markdown files) passes, G8 rework ratio is 0.0, and the Invariant-scoped `clean-code-gates` JS
suite was correctly NOT run against the doc skill. All checks pass. Safe to commit and open PR.
