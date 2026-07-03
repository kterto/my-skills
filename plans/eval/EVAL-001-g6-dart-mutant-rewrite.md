---
id: EVAL-001
status: PASS
plan: FEAT-001
spec: SPEC-001
created_at: 2026-07-02T23:45:00Z
---

# EVAL-001 — Spec-Driven Eval: G6 mutation gate rewrite (mutation_test → dart_mutant)

**Subject:** FEAT-001 implementation vs SPEC-001 (17 functional requirements + test cases a–e), grounded in the design doc's Success criteria.
**Final: 0.93 — Spec-complete (≥ 0.90).** Adjusted Final: 0.93 (no red gate).

## Diff surface

```
plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs   (rewrite runG6, +parseDartMutantReport/g6Glob/g6Verdict/runMutant, dead-code deleted)
plugins/my-skills/skills/clean-code-gates/defaults.cjs                    (G6 tool → dart_mutant)
plugins/my-skills/skills/clean-code-gates/__tests__/dart-flutter.test.cjs (G6 XML cases → JSON cases)
plugins/my-skills/skills/clean-code-gates/__tests__/fixtures/*.json        (5 new Stryker fixtures, untracked)
plugins/my-skills/skills/clean-code-gates/SKILL.md, README.md             (G6 tooling note)
```

## Implementation checklist (I = 17/17 = 1.00)

| FR | Behavior | I | Evidence |
|----|----------|---|----------|
| FR1 | tool = dart_mutant (GATE_META + defaults) | MET | `defaults.cjs:39`; `GATE_META.G6` adapter |
| FR2 | detection via commandExists+resolveFlutter → missing_tool | MET | `dart-flutter.cjs:576-577` |
| FR3 | invocation flags (--path/--glob/--test-command/--threshold/--json/--quiet/--ai none/--output/--exclude) | MET | `dart-flutter.cjs:539-548` |
| FR4 | g6Glob root→wildcard (brace group multi-root) | MET | `dart-flutter.cjs:462-466` |
| FR5 | score-vs-scope caveat documented, not per-file | MET | `dart-flutter.cjs:482-486` |
| FR6 | parseDartMutantReport {score,total,byFile}; invalid→null | MET | `dart-flutter.cjs:430-453` |
| FR7 | pass when score ≥ threshold | MET | `dart-flutter.cjs:495,524` |
| FR8 | fail: score blocker + per-line survivor warnings, relativized/exempt-filtered | MET | `dart-flutter.cjs:496-522` |
| FR9 | no targets → pass, no dart_mutant | MET | `dart-flutter.cjs:585,490` |
| FR10 | zero mutants (total===0) → pass | MET | `dart-flutter.cjs:492` |
| FR11 | absent report / no score → error | MET | `dart-flutter.cjs:491` |
| FR12 | non-zero exit tolerated | MET | `dart-flutter.cjs:550-558` |
| FR13 | temp --output + rmSync cleanup, no litter | MET | `dart-flutter.cjs:538,560-567` |
| FR14 | case-insensitive status (lowercase+strip _) | MET | `dart-flutter.cjs:445` |
| FR15 | dead mutation_test helpers removed | MET | grep: escapeXml/writeMutationConfig/parseMutationReport/setupWorktree/git/gitRoot → 0 matches |
| FR16 | new helpers exported via _internals | MET | `dart-flutter.cjs:729-739` |
| FR17 | SKILL.md/README G6 note updated | MET | SKILL.md/README diff |

## Harness checklist (T = 11/14 applicable = 0.79)

| FR | Level | T | Evidence |
|----|-------|---|----------|
| FR2 detection | unit | MET | test:213 `runG6 returns missing_tool` |
| FR4 g6Glob | unit | MET | test:134 |
| FR6 parse a–e | unit | MET | test:98,105,115,120,127 |
| FR7 pass | unit | MET | test:147 |
| FR8 fail+findings | unit | MET | test:161,183 |
| FR9 no-targets | unit | MET | test:207,228 |
| FR10 zero-mutants | unit | MET | test:127,154 |
| FR11 error | unit | MET | test:201,250 |
| FR14 case-insens | unit | MET | test:105 (fail fixture mixes Survived/survived/NoCoverage/no_coverage) |
| FR15 dead-code | regression | MET | full suite 65/65 green, no dangling refs |
| FR16 testability | meta | MET | tests exercise _internals |
| **FR3 invocation** | integration | **UNMET** | `runMutant` dependency-injected out of every test; real argv never asserted |
| **FR12 exit tolerance** | integration | **UNMET** | inside `runMutant`, mocked out |
| **FR13 cleanup/no-litter** | integration | **UNMET** | inside `runMutant`, mocked out |
| FR1, FR5, FR17 | n/a (config/doc) | — | no observable-behavior test level |

**Root cause of the 3 T-gaps (single, documented, by-design):** `runMutant` — the only boundary that spawns the real `dart_mutant` binary and runs the Flutter test suite per mutant — is dependency-injected out and not exported to `_internals`. This repo has no Flutter app and `dart_mutant` cannot run in CI here, so FR3/12/13 are covered only by the design's **manual integration smoke** (`node bin/gates.cjs --scope files:… --gates G6` in a Flutter project with dart_mutant installed). The tester and CR-001 both recorded this as an inherent, non-blocking gap.

## Scope adherence S: **pass**

Every built behavior traces to an FR. All non-goals correctly deferred, not built: `--incremental`/`--base-ref`/`--cache-file`, `--coverage-file`, brace-glob narrow-scope scoring, `--ai` providers, node-ts adapter untouched, `schema/report.schema.json` unchanged. No rogue builds, no PRD-boundary violations, no plan drift.

## Robustness R (beside grade, not folded in)

Modest: absolute-path relativization + exempt-skip edge (test:183), runG6 wiring fail/error paths (test:239,250) beyond the primary happy path.

## Engineering gates G

| Gate | Verdict | Evidence |
|------|---------|----------|
| build | n/a — no build step for CJS skill | — |
| lint | not-run — none configured for skill's own JS (PROJECT-CONTEXT) | — |
| unit | ✓ | `node --test` inside skill dir → 65/65 pass, exit 0 |
| e2e | not-run — no e2e framework; live dart_mutant flow is manual-smoke by design (no Flutter app in repo) | — |

No red (`✗`) gate → **no Adjusted Final penalty.**

## Ranked gaps → fixes to reach 1.00

1. **FR3/12/13 (integration coverage of `runMutant`).** Fix: export `runMutant` via `_internals` and add an integration test that stubs `execFileSync` to (a) assert the argv contains the 9 required flags + one `--exclude` per exclude, (b) simulate non-zero exit yet a written report → still parsed, (c) assert the temp `--output` dir is `rmSync`'d. This closes all three T-gaps without needing the real binary. (Non-blocking; deferred as designed.)

## Verdict

`Final = 0.6·I + 0.4·T` averaged over 17 FRs (P0, single story) = **0.93 — Spec-complete.** Implementation is complete and faithful to the design; the only shortfall is integration-level test coverage of the external-binary boundary, which is a documented, by-design manual-smoke gap in this repo.
