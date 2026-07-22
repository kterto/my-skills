---
id: QA-20260722T041159Z-93b4
plan: FEAT-20260722T035033Z-3962
cr: CR-20260722T040725Z-85ad
title: QA Report — Pin pr-review-report review ranges and provenance to reviewed_head
status: READY_TO_COMMIT
created_at: 2026-07-22T04:12:30Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FEAT-20260722T035033Z-3962](../feat/FEAT-20260722T035033Z-3962-pin-review-ranges-reviewed-head.md)

## Summary

QA'd the doc-skill change that pins every `pr-review-report` review range, merge-base,
and provenance guard to the Step-1 `reviewed_head` snapshot and adds one additive
Step-8 drift warning, mirrored into the `.opencode` port. All three executable gates
in scope pass (provenance-gate fixture, new drift-warning fixture, the
`validate-pr-review-skill.sh` structural validator), and the structural sweep confirms
no residual `HEAD`-based review range in either copy with `reviewed_head` re-established
in every re-resolving block. Per PROJECT-CONTEXT the `clean-code-gates` JS suite is
Invariant-scoped and was correctly NOT run. Verdict: READY_TO_COMMIT.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| provenance-gate.test.sh (mirrors pinned Step 2b, sec-2) | 3 | 3 | 0 | 0 | ✅ |
| drift-warning.test.sh (mirrors Step 8, AC6/AC11) | 3 | 3 | 0 | 0 | ✅ |
| validate-pr-review-skill.sh (structural gate, sec-1 + parity) | 2 | 2 | 0 | 0 | ✅ |
| Lint | — | — | — | — | N/A (none configured for markdown doc skills) |
| Build / typecheck | — | — | — | — | N/A (no build step for doc skills) |
| Format check | — | — | — | — | N/A (none configured) |

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | N/A — no coverage for doc skills (PROJECT-CONTEXT § Test tooling); clean-code-gates JS suite Invariant-scoped, MUST NOT run |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | N/A — no complexity tooling for markdown skills |
| G4 Naming | intent-revealing | 0 violations | N/A — no naming lint for markdown skills |
| G5 No comments | inline comment audit | 0 violations | N/A — changed surface is markdown docs + shell fixtures, not application source |
| G6 Mutation score (changed files) | killed / total | ≥70% | N/A — no mutation tooling for doc skills; Invariant-scoped |
| G7 Dependency structure | layering, cycles | 0 violations | N/A — no dependency tooling for markdown skills |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ✅ 0.0 (0 + 0) / 1 |

**Gate applicability note (not a MISSING_TOOL block):** This is a documentation-and-template
authoring change. PROJECT-CONTEXT § Commands / § Test tooling states the repo has no
build/lint/coverage/mutation tooling for markdown doc skills, and the `clean-code-gates`
JS test suite is the lone runtime island scoped **to that skill only** — it MUST NOT run
against `pr-review-report`. The plan's own `## Verification (per phase)` section confirms
G1/G6 are QA-only and the JS suite is not applicable. Accordingly G1–G7 are N/A by project
design (the OPTIONAL_UNTIL_TOOL / not-applicable carve-out), not MISSING_TOOL, and do not
block. The in-scope executable substitutes — the two shell fixtures and the structural
validator — all pass.

## Failures

None — all suites passed.

## Lint / Format / Type Issues

None — no lint/format/type tooling applies to markdown doc-skill changes. Structural
verification is the project-blessed equivalent and is clean:

- Both SKILL copies: no live `...HEAD` / `..HEAD` review-range command remains
  (`git diff|log|rev-list|shortlog` sweep returns none). Remaining `HEAD` hits are the
  excepted default-branch detection, the `reviewed_head` capture (`git rev-parse HEAD`),
  the Step-8 drift capture/emit, and "never `..HEAD`" prose.
- All three `git merge-base "$base" "$reviewed_head"` calls and every review-range diff
  (`"$mb".."$reviewed_head"`, `"$mb"..."$reviewed_head"`, `"$base"..."$reviewed_head"`)
  are pinned; three-dot preserved in Step 3.
- `reviewed_head` re-established by literal sha substitution in every re-resolving block
  (plugin L127/180/273/619; opencode L130/186/279/625).
- `review-data-schema.md` pin note is present and identical in both plugin and `.opencode`
  copies (opencode-port-parity holds).

## Verdict

**Status**: READY_TO_COMMIT

All in-scope executable gates and structural checks pass; the Clean Code JS gates are N/A
by project design for doc skills; G8 rework ratio is 0.0.

All checks pass. Safe to commit and open PR.
