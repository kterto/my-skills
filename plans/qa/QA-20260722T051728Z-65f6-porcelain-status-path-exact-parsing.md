---
id: QA-20260722T051728Z-65f6
plan: FEAT-20260722T050049Z-de05
cr: CR-20260722T051421Z-112a
title: QA Report — Path-exact git status parsing in validation-fixer clean-tree gate and rollback
status: READY_TO_COMMIT
created_at: 2026-07-22T05:17:28Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FEAT-20260722T050049Z-de05](../feat/FEAT-20260722T050049Z-de05-porcelain-status-path-exact-parsing.md)

## Summary

QA validated the single-file documentation/procedure change to
`plugins/my-skills/skills/validation-fixer/SKILL.md` that converts every `git status`
parse/compare site to one canonical, NUL-safe, path-exact command. This is a markdown doc skill:
per PROJECT-CONTEXT there is no build, lint, or automated test tooling for doc-skill authoring, and
the `clean-code-gates` JS suite is Invariant-forbidden against it — so QA is **structural review**.
All structural checks pass and no gate command selects this diff. Verdict: **READY_TO_COMMIT**.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Automated tests (doc skill — none per PROJECT-CONTEXT §Commands) | — | — | — | — | N/A |
| Lint (none configured for markdown) | — | — | — | — | N/A |
| Build / typecheck (no build step for doc skills) | — | — | — | — | N/A |
| Format check (none configured for markdown) | — | — | — | — | N/A |
| Structural verification (parse-site canonicalization, invariants) | 5 | 5 | 0 | 0 | ✅ |

## Clean Code Gates

Gates G1–G7 depend on per-stack runtime tooling (coverage, complexity, mutation, dependency
analysis) that has no meaning for a markdown doc skill. Per PROJECT-CONTEXT §Invariants and
§Commands, the `clean-code-gates` JS suite MUST NOT run against non-JS doc skills, and the plan's
`## Verification (per phase)` section confirms **no runnable gate command selects this diff**. These
are therefore **N/A by project design** (a documented carve-out), not `MISSING_TOOL` — no tooling is
absent that the project expects to exist for this layer. G8 is computed from the plans tree.

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | N/A (doc skill — not measured) |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | N/A (no code) |
| G4 Naming | intent-revealing | 0 violations | N/A (no code) |
| G5 No comments | inline comment audit | 0 violations | N/A (markdown prose) |
| G6 Mutation score (changed files) | killed / total | ≥70% | N/A (doc skill — no test surface) |
| G7 Dependency structure | layering, cycles | 0 violations | N/A (no modules) |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ✅ 0.0 |

**G8 detail:** 0 `REQUEST_CHANGES` CRs + 0 FIX/QAF plans spawned from this plan ÷ 1 total CR = 0.0.

## Structural Verification (the acceptance-criteria surface)

| Check | Result |
|-------|--------|
| Canonical command `git status --porcelain=v1 -z --untracked-files=all` byte-exact as the single normative source (L379) | ✅ |
| All five parse/compare sites use the canonical form + reference the contract (clean-tree gate L461, baseline capture L475, attribute-guard L509, rollback step-4 enumeration L542, acceptance gate (D) L648) | ✅ |
| No stray plain `git status --porcelain` parse step — every plain occurrence is contract-contrast (389), the parse-vs-display note (432/434), or one of the four annotated STOP display dumps (523/671/745/1096) | ✅ |
| sec-2/bug-15 enumerated NUL-safe `rm -- <path>` preserved, not reverted (422, 546) | ✅ |
| `-x` / `--ignored` prohibition intact; no blanket untracked sweep introduced (405, 421–422, 547) | ✅ |
| Baseline/enumeration symmetry invariant present with `current_untracked − baseline` removal rule (418–421) | ✅ |
| No residual whitespace/newline-split parse language (L397 is an explicit prohibition) | ✅ |
| Single-file working-tree scope — only `SKILL.md` modified; no `.opencode`/reference/template files touched | ✅ |

## Failures

None — all structural checks passed and no automated suite is applicable.

## Lint / Format / Type Issues

None — no lint/format/type tooling applies to markdown doc-skill authoring in this repo.

## Verdict

**Status**: READY_TO_COMMIT

All applicable checks pass: the single-file doc change canonicalizes every parse site, preserves the
sec-2/bug-15 enumerated `rm` and the `-x`/`--ignored` prohibition, states the symmetry invariant, and
leaves no stray parse form; no test/lint/build/gate command selects this markdown diff and G8 rework
ratio is 0.0. Safe to commit and open PR.
