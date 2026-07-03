---
id: CR-001
plan: FEAT-001
title: Review of G6 Mutation Gate — Swap mutation_test → dart_mutant
status: APPROVED
created_at: 2026-07-02T23:24:57Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-001](../feat/FEAT-001-g6-dart-mutant-rewrite.md)

## Summary

The G6 mutation gate rewrite (`mutation_test` → `dart_mutant`) is faithful to the design doc and the plan's 15 acceptance criteria. `parseDartMutantReport`, `g6Glob`, `g6Verdict`, `runMutant`, and `runG6` implement the reference behavior with correct dart_mutant invocation, Stryker-JSON parsing, the full verdict matrix, temp-dir report + cleanup, and case-insensitive status matching. All `mutation_test`-only helpers (`escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree`, `git`, `gitRoot`) are deleted with no dangling references anywhere in `src/`; reusable infra is retained. Docs and `defaults.cjs` are updated; `schema/report.schema.json` is untouched. Full suite is green (65/65 via `node --test`). No blockers.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `defaults.cjs` G6 tool = `'dart_mutant'`, thresholds unchanged | ✅ | Diff: single-line tool swap; `THRESHOLDS.G6` untouched. |
| 2 | `GATE_META.G6` = `{ name: 'mutation', tool: 'dart_mutant' }` | ✅ | adapter line ~41. |
| 3 | `parseDartMutantReport` returns `{score,total,byFile}`; invalid JSON → null; exported via `_internals` | ✅ | score numeric-guarded; total counts all mutants; byFile keyed on survivor set; try/catch → null; exported. |
| 4 | `g6Glob(stackCfg)` → `'{root}/**/*.dart'`, exported | ✅ | default `['lib']`, empty roots, single, and multi-root brace-group all unit-tested. |
| 5 | G6 gated on `resolveFlutter` AND `commandExists('dart_mutant')` → `missing_tool` | ✅ | both branches asserted via injected deps. |
| 6 | `dart_mutant` invoked with `--path/--glob/--test-command/--threshold/--json/--quiet/--ai none/--output/--exclude`, test cmd from `resolveFlutter` | ✅ | `runMutant` builds args exactly; testCommand = `[flutter.cmd, ...flutter.pre, 'test']`. |
| 7 | Non-zero exit tolerated; missing report → `error` | ✅ | try/catch swallows exit; `runMutant` returns null when file absent → `error`. |
| 8 | Verdict matrix (pass/fail blocker+warnings/no-targets/zero-mutants/error) | ✅ | `g6Verdict` matches shapes; blocker `metric {value,limit,unit}` and warning IDs asserted. |
| 9 | Absolute survivor names relativized; exempt survivors skipped | ✅ | `path.relative(io.root,...)` + `isExempt`; dedicated test with abs path + `_test`/`.g.dart`. |
| 10 | Temp `mkdtempSync` report dir removed after parse; no target-tree litter | ✅ | `os.tmpdir()` + `fs.rmSync(recursive,force)`; report read into memory before cleanup. |
| 11 | `status`/`mutatorName` parsed case-insensitively | ✅ | `.toLowerCase().replace(/_/g,'')`; fail fixture mixes `Survived`/`survived`/`NoCoverage`/`no_coverage`. |
| 12 | `mutation_test` helpers deleted; `git`/`gitRoot` removed (G7 unaffected); infra retained | ✅ | grep confirms zero refs in `src/`; `resolveDart`/`hasPkg` still used by G2/G4. |
| 13 | Unit tests + JSON fixtures cover (a)–(e); old XML cases replaced; `node --test` passes | ✅ | 5 fixtures + parser/verdict/runG6 tests; 65/65 green. |
| 14 | SKILL.md + README.md G6 note reflects `dart_mutant` (Stryker JSON, PATH) | ✅ | both updated; `mutation_test` dev-dep mention removed. |
| 15 | `schema/report.schema.json` unchanged | ✅ | `git diff main` on the file is empty. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Static `command` string omits the real invocation flags

**File**: `src/adapters/dart-flutter.cjs:581`
**Problem**: The `command` echoed into every G6 gate result is the fixed literal `'dart_mutant --json --quiet --ai none'`, which drops the flags that actually determine the run (`--path`, `--glob`, `--test-command`, `--threshold`, `--exclude`). A consumer reading the report's `command` field cannot reproduce the invocation. This is cosmetic (the field is display-only and does not affect the verdict) and mirrors the pre-existing pattern, so it is non-blocking.
**Fix**: Optionally surface the resolved glob/threshold/test-command in the `command` string (or a small `meta` object) so the report reflects what was run. Safe to defer.

## Verdict

**Status**: APPROVED

All 15 acceptance criteria are met, the invariants (zero deps, CommonJS, report contract, no target-tree side effects, case-insensitive parsing, infra retained/dead-code deleted) hold, and the suite is green with a single non-blocking cosmetic note.

Invoke `/qa` with plan ID `FEAT-001` to run the QA suite.
