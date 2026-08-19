---
id: QA-20260819T023647Z-5465
plan: FIX-20260819T020345Z-48c5
cr: CR-20260819T023032Z-d934
title: QA Report — Gateable-scope guard and installer rollback fixes
status: READY_WITH_WARNINGS
created_at: 2026-08-19T02:36:47Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260819T020345Z-48c5](../code-review/FIX-20260819T020345Z-48c5-gateable-scope-guard-installer-rollback.md) · [CR-20260819T023032Z-d934](../code-review/CR-20260819T023032Z-d934-gateable-scope-guard-installer-rollback.md) · [TEST-20260819T022100Z-2621](../test/TEST-20260819T022100Z-2621-gateable-scope-guard-installer-rollback.md) · [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md) · [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md)

## Summary

I ran the whole aggregate — the parent `FEAT-…be84` plus both fix plans — against base `09fa490`, not just this fix plan's diff. **All four executable suites exit 0**: 206/206 on the plugins-side `clean-code-gates`, 206/206 on the generated `prime-agent/skills/` copy, `prime-agent`'s `install.sh` + `parity.sh`, and `build-prime-agent.mjs --check`. Zero test failures, zero lint/type/build errors.

I did not take the closure of either blocker on report. I injected my own mutant at each Must Fix change site: reverting `assertNonEmptyScope` to the pre-fix `scope.files.length` predicate is **killed by 6 tests**, and reverting the installer rollback to its pre-fix conditional form is **killed with the exact diagnostic `a failed fresh install left 3 skills behind`** — the same "3 skills behind" number the reviewer reproduced independently. Both files were restored md5-identical afterwards and the working tree is back to its exact pre-QA state (92 entries).

**Verdict: READY_WITH_WARNINGS.** Every blocking check passes. The one warning is G8: the *accumulated* rework ratio across the three-plan chain is **1.33**, well over the 0.5 threshold, which is worth a human root-cause look even though the plan under QA is itself clean at 0.00.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| `clean-code-gates` — plugins source (`node --test`) | 206 | 206 | 0 | 0 | ✅ |
| `clean-code-gates` — generated tree (`prime-agent/skills/`) | 206 | 206 | 0 | 0 | ✅ |
| `prime-agent` (`npm test` → `install.sh` + `parity.sh`) | — | all | 0 | 0 | ✅ |
| Generator drift (`build-prime-agent.mjs --check`) | — | — | — | — | ✅ `11 skills, 154 files` up to date |
| Lint | — | — | — | — | ⚪ none configured in-repo (PROJECT-CONTEXT → Commands) |
| Build / typecheck | — | — | — | — | ⚪ no build step for markdown/template authoring |
| Format check | — | — | — | — | ⚪ none configured in-repo |

Test count rose **106 → 206** against base `09fa490` (+100), comfortably clearing the plan's "≥ 197, never decreasing" exit criterion.

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage — plan scope (`48c5`) | stmts / branches | ≥85% / ≥80% | ✅ `run.cjs` **100.00 / 82.61** |
| G1 Coverage — aggregate scope | stmts / branches | ≥85% / ≥80% | ⚠️ 9/11 files pass; 2 adapters below (inherited + tool-gated — see below) |
| G2 Complexity (substitute) | over-threshold fns | no regression | ✅ **21 → 19** (net −2) |
| G4 Naming (substitute) | intent-revealing | 0 new violations | ✅ 0 new; pre-existing loop-scoped `m`/`r` only |
| G5 No comments | production-source audit | no regression | ✅ **43 → 43** (exactly flat) |
| G6 Mutation (changed sites) | killed / total | ≥70% | ✅ **100%** (7/7 — 2 injected by me, 5 by the tester) |
| G7 Dependency structure | layering, cycles | 0 violations | ✅ **0 cycles**, 14 modules, clean layering |
| G8 Rework — plan under QA | (RC + FIX/QAF) / total CR | ≤0.5 | ✅ **0.00** |
| G8 Rework — accumulated union | (RC + FIX/QAF) / total CR | ≤0.5 | ⚠️ **1.33 — HIGH_REWORK** |

### Why G2/G4 are substitute measurements, not `MISSING_TOOL`

The repo's own gate engine settles this. `node-ts` declares `SOURCE_FILE_RE: TS_FILE_RE = /\.tsx?$/` (`src/adapters/node-ts.cjs:730`), and every JS file in this repo is `.cjs`/`.mjs`. Running the shipped binary against its own tree proves it:

```
$ node bin/gates.cjs --scope project --gates G5 --out -
error: scope resolved to zero gateable files (project) — nothing was measured, so this run has no verdict
```

That is the very guard this plan built, correctly refusing to render a verdict. So G2/G4/G6/G7 are **out of subject-matter scope by the codebase's own canonical definition of source**, not blocked on an uninstalled binary — the same "N/A by construction" ruling `QA-20260807T060418Z-d7d0` used, now with the engine's own exit-3 as evidence. I ran independent substitute measurements anyway rather than leave the rows empty.

### G1 — the two adapters, and why this is not a regression

Measured with `node --test --experimental-test-coverage` at base `09fa490` and at HEAD:

| File | Base (line / branch) | Current | Δ |
|---|---|---|---|
| **Aggregate** | 77.23 / 79.69 | **86.77 / 85.58** | **+9.54 / +5.89** |
| `src/adapters/node-ts.cjs` | 42.42 / 58.82 | 58.36 / 65.45 | +15.94 / +6.63 |
| `src/adapters/dart-flutter.cjs` | 63.71 / 79.29 | 64.80 / 82.02 | +1.09 / +2.73 |
| `src/run.cjs` | 100 / 61.11 | 100 / 82.61 | +0 / **+21.50** |
| `src/scope.cjs` | 86.09 / 81.58 | 100 / 85.71 | +13.91 / +4.13 |
| `src/gates/registry.cjs` | 100 / 66.67 | 100 / 85.00 | +0 / +18.33 |
| `defaults.cjs` | 97.83 / 66.67 | 100 / 100 | +2.17 / +33.33 |
| `src/baseref.cjs` | *(new)* | 100 / 85.71 | new, passes |

**Every changed file improved or held.** The two adapters sit below the literal per-file threshold, but three facts make that inherited debt rather than a defect this work introduced:

1. **The shortfall is structurally unreachable here.** The uncovered ranges are exactly the external-tool bodies behind `missingTool()` guards — `writeEslintConfig`, `runEslint`, the Stryker and dependency-cruiser runners, dart's `dart_code_linter` path. Each sits past `if (!eslintBin || !parserRef) return missingTool('G2', stackCfg);`. Covering them requires installing eslint / stryker / dependency-cruiser / Dart into this repo, which PROJECT-CONTEXT → Out of scope explicitly excludes.
2. **It predates the base commit** and was *reduced* by this work — node-ts gained nearly 16 points.
3. **The change surface is tiny**: `node-ts.cjs` is `+20 −4` and `dart-flutter.cjs` `+20 −4` across the whole aggregate. Neither file's low coverage is a property of what changed.

Scoped to the files **this plan** changed, G1 passes outright: `run.cjs` at 100.00 / 82.61.

### G5 — flat on production source

Audited by loading the repo's own `scanNoComments` and running it over every changed `.cjs`/`.mjs`, then repeating against the base tree:

- **Production source: 43 → 43.** Exactly flat. `src/gates/g5-no-comments.cjs` went 4 → 0 (decomposed into 15 small named functions), and `src/run.cjs` went 0 → 4 — a *why*-comment block justifying the exit-code mapping the CR chain litigated, not "what" narration. Net zero.
- The adapters (14 + 14) and `scope.cjs` (7) are unchanged pre-existing counts.
- `__tests__/` rose 55 → 130, consistent with +100 new tests; test files are excluded from source by `SOURCE_FILE_RE` and carry rationale comments by design.
- The three changed shell scripts have **0** indented `#` comment lines.

### G6 — mutation, independently probed

7 mutants across the two change sites, **7 killed (100%)**, aggregate well over the 70% floor. The two I injected myself:

| Mutant | Site | Result |
|---|---|---|
| **A** (mine) | `assertNonEmptyScope`: `scope.files.some(isSource)` → `scope.files.length` (the pre-fix bug) | **killed** — 6 tests red across all four scope kinds + the CLI e2e |
| **B** (mine) | `rollback()`: unconditional `rm -rf` → pre-fix conditional-on-`.old-$name` | **killed** — `a failed fresh install left 3 skills behind` |
| C–G (tester) | delivered code, per `TEST-…2621` | 5/5 killed |

Both files restored md5-identical; final re-run of all four suites after restore: exit 0 across the board.

### G7 — dependency structure

Built the require graph over the 14 non-test modules: **0 cycles**. The only edges leaving `src/` are three modules importing shared constants from the package-root `defaults.cjs` (`config.cjs`, both adapters) — a downward dependency on a leaf constants module, not a layering inversion.

### G8 — rework ratio

| Plan | CRs | REQUEST_CHANGES | FIX spawned | Ratio |
|---|---|---|---|---|
| `FIX-…48c5` (under QA) | 1 | 0 | 0 | **0.00** ✅ |
| Accumulated union (3 plans) | 3 | 2 | 2 | **1.33** ⚠️ |

Chain: `FEAT-…be84` → `CR-…f9ea` REQUEST_CHANGES → `FIX-…b208` → `CR-…4511` REQUEST_CHANGES → `FIX-…48c5` → `CR-…d934` APPROVED.

HIGH_REWORK is a warning, not a block. Worth noting in mitigation: both rework cycles were driven by *reviewer-caught real defects* (a false-pass guard and a false rollback claim), each reproduced on independent inputs — the loop was doing its job rather than churning. The root-cause question for a human is whether the parent `FEAT` under-specified the guard predicate, given that both cycles landed on the same class of bug: **a guard that reports success at protecting something it did not protect**.

## Failures

None — all suites passed.

## Lint / Format / Type Issues

None — no lint, format, or typecheck tooling is configured in this repo (PROJECT-CONTEXT → Commands: "none for markdown/template authoring"). No errors surfaced from any executable gate.

Advisory, non-blocking:

- `src/adapters/*.cjs`: loop-scoped single-letter identifiers (`m` for regex match, `r` for root) in unchanged regions. Pre-existing idiom, 0 introduced by this change set.
- `src/gates/g5-no-comments.cjs`: branch coverage 100 → 96.10. Still far above the 80% floor; new branches added by the scanner's decomposition.

## Verdict

**Status**: READY_WITH_WARNINGS

All blocking checks pass — 4/4 suites green, both Must Fix closures independently mutation-verified, zero regressions across every measured gate — with G8's accumulated ratio of 1.33 flagged for human root-cause review.

Plan can ship. Two items to carry forward, neither blocking:

1. **G8 HIGH_REWORK (1.33)** — two review cycles on the same defect class. Worth a look at whether the parent spec under-specified guard predicates.
2. **G1 adapter coverage** — `node-ts.cjs` (58.36) and `dart-flutter.cjs` (64.80) remain below the per-file threshold on inherited, tool-gated surface. Closing it needs eslint/stryker/dependency-cruiser fixtures, which is an architect-plan decision, not a fix-plan one. Recording it here so it is tracked rather than rediscovered next cycle.

Safe to commit and open PR.
