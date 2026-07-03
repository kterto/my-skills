---
id: FINAL-001
status: READY_TO_COMMIT
plan: FEAT-001
spec: SPEC-001
created_at: 2026-07-02T23:46:00Z
---

# FINAL-001 — G6 mutation gate: swap mutation_test → dart_mutant

## Related
- Spec: [SPEC-001](../specs/SPEC-001-g6-dart-mutant-rewrite.md)
- Plan: [FEAT-001](../feat/FEAT-001-g6-dart-mutant-rewrite.md)
- Test report: [TEST-001](../test/TEST-001-g6-mutation-gate-swap-mutation-test-dart-mutant.md)
- Code review: [CR-001](../code-review/CR-001-g6-mutation-gate-swap-mutation-test-dart-mutant.md)
- QA report: [QA-001](../qa/QA-001-g6-dart-mutant-rewrite.md)
- Spec eval: [EVAL-001](../eval/EVAL-001-g6-dart-mutant-rewrite.md)

## Outcome

Rewrote the `clean-code-gates` **dart-flutter** adapter's G6 (mutation) gate to invoke the external `dart_mutant` binary (AST engine, Stryker JSON) instead of the `mutation_test` pub package (XML). Verdict now reads the top-level `mutationScore` float; survivor warnings come from the per-file mutant list; the entire `mutation_test`-era git-worktree/XML apparatus is deleted. Finding contract (`mutation/score` blocker + `mutation/survived` warnings) unchanged — no consumer changes.

## Pipeline

| Stage | Artifact | Result |
|-------|----------|--------|
| Brainstormer | SPEC-001 | READY_FOR_PLANNING |
| Architect | FEAT-001 (14 tasks, 3 phases) | created |
| Coder | FEAT-001 | DONE |
| Simplify | 1 fix (status normalization) | applied |
| Tester | TEST-001 | PASS (65/65) |
| Reviewer | CR-001 | APPROVED (0 must-fix, 1 cosmetic deferred) |
| QA | QA-001 | READY_TO_COMMIT (G8 rework 0.0) |
| Spec eval | EVAL-001 | PASS — 0.93 Spec-complete |

## Files changed (all under `plugins/my-skills/skills/clean-code-gates/`)
- `src/adapters/dart-flutter.cjs` — new `parseDartMutantReport`, `g6Glob`, `g6Verdict`, `runMutant`; rewritten `runG6`; `GATE_META.G6` → dart_mutant; deleted `escapeXml`/`writeMutationConfig`/`parseMutationReport`/`setupWorktree`/`git`/`gitRoot`; exported new helpers via `_internals`.
- `defaults.cjs` — dart-flutter `gates.G6.tool` → `'dart_mutant'`.
- `__tests__/dart-flutter.test.cjs` + `__tests__/fixtures/*.json` — 5 Stryker fixtures; G6 XML cases replaced with JSON cases (a–e).
- `SKILL.md`, `README.md` — G6 tooling note.

## Issues found
- None blocking. One non-blocking deferred item (CR-001 SF-1 / EVAL-001 gap): integration-level tests for `runMutant` (real argv, non-zero-exit tolerance, temp-dir cleanup) are absent — that boundary is manual-smoke-only because this repo has no Flutter app and `dart_mutant` can't run in CI here. Fix path recorded in EVAL-001.

## Proposed commit message

```
feat(clean-code-gates): rewrite dart-flutter G6 to use dart_mutant

Swap the G6 mutation gate from the mutation_test pub package (XML,
git-worktree sandbox) to the external dart_mutant binary (AST engine,
Stryker-compatible JSON). Read the verdict from the report's top-level
mutationScore float; emit mutation/survived warnings from the per-file
mutant list. Delete the mutation_test-only apparatus (escapeXml,
writeMutationConfig, parseMutationReport, setupWorktree, git/gitRoot);
runs now execute against the live tree with a temp --output dir that is
cleaned up (no worktree, in-place mutation, pub get, or report litter).
Finding contract (mutation/score + mutation/survived) unchanged.

Detection switches to commandExists('dart_mutant') + resolveFlutter; the
test command is derived from the resolved Flutter invocation (never the
dart_mutant default `dart test`). Status/mutatorName parsed
case-insensitively. Adds parseDartMutantReport/g6Glob/g6Verdict + 5
captured Stryker fixtures covering report cases a–e.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Proposed PR message

```
## Summary
Rewrite the clean-code-gates dart-flutter G6 mutation gate to invoke the
`dart_mutant` binary (AST-based, parallel, Stryker JSON) instead of the
removed `mutation_test` pub package. The verdict comes straight from the
report's top-level mutationScore; surviving-mutant warnings come from the
per-file mutant list. The mutation_test worktree/XML machinery is deleted,
so G6 now runs against the live tree with no side effects. The G6 finding
contract is unchanged — fixers/orchestrators see the same output.

## Test plan
- `node --test` inside plugins/my-skills/skills/clean-code-gates/ → 65/65 pass.
- Report cases a–e covered at both parser and verdict level, incl. a fail
  fixture that mixes Survived/survived/NoCoverage/no_coverage casings.
- QA: G8 rework ratio 0.0 (PASS). Spec eval: 0.93 (Spec-complete).
- Not runnable in CI here (no Flutter app; dart_mutant absent): the live
  runMutant subprocess path — manual smoke per the design doc.
```
