---
id: FEAT-001
title: G6 Mutation Gate — Swap mutation_test → dart_mutant
type: feat
status: DONE
created_at: 2026-07-02T23:02:43Z
updated_at: 2026-07-02T23:15:14Z
cycle: 0
related_to: SPEC-001
---

**Related:** [SPEC-001](../specs/SPEC-001-g6-dart-mutant-rewrite.md) · design doc — `docs/superpowers/specs/2026-06-15-g6-adapter-dart-mutant-rewrite-design.md`

## Overview

Rewrite the clean-code-gates `dart-flutter` adapter's G6 (mutation) gate to invoke the external `dart_mutant` binary and parse its Stryker-compatible JSON (`--json`) instead of the `mutation_test` pub package and its XML/worktree apparatus. The pass/fail verdict is read from the report's top-level `mutationScore` float vs. the gate threshold (default 70); surviving-mutant warnings come from the per-file mutant list. The gate keeps its existing report contract, rule values (`mutation/score`, `mutation/survived`), and thresholds — consumers see no change in finding shape. Derived from SPEC-001; all work is confined to the `clean-code-gates` skill.

## Acceptance Criteria

1. `defaults.cjs` dart-flutter `gates.G6.tool` is `'dart_mutant'` (was `'mutation_test'`); thresholds unchanged.
2. `GATE_META.G6` in `src/adapters/dart-flutter.cjs` is `{ name: 'mutation', tool: 'dart_mutant' }`.
3. `parseDartMutantReport(json)` returns `{ score, total, byFile }` where `score = report.mutationScore` when numeric else `null`; `total` = count of all mutants across all files; `byFile` maps file name → array of `location.start.line` for mutants whose lowercased `status` ∈ `{survived, nocoverage, no_coverage}`; invalid JSON → `null`. It is exported via `_internals`.
4. `g6Glob(stackCfg)` maps the stack `roots` (default `['lib']`) to a single wildcard `'{root}/**/*.dart'` and is exported via `_internals`.
5. G6 availability is gated on `resolveFlutter(io.root)` AND `commandExists('dart_mutant')`; when either is missing the gate returns `missing_tool` via `missingTool('G6', stackCfg)`.
6. `runG6` invokes `dart_mutant` with at least `--path <root>`, `--glob <rootGlob>`, `--test-command "<flutter test invocation>"`, `--threshold <score>`, `--json`, `--quiet`, `--ai none`, `--output <tempDir>`, and one `--exclude <glob>` per configured exclude; the test command is derived from `resolveFlutter` (never the `dart_mutant` default `dart test`).
7. A non-zero `dart_mutant` exit code is tolerated; the verdict relies on the presence/parse of the report file. A missing report → `error`.
8. Verdict matrix holds: mutants present and `score ≥ threshold` → `pass` (no findings); `score < threshold` → `fail` with one `blocker` `{ id: 'G6:score', rule: 'mutation/score', file: targets[0], line: 1, metric: { value: score, limit: threshold, unit: 'percent' } }` plus one `warning` `{ id: 'G6-<rel>:<line>', rule: 'mutation/survived', file: <rel>, line }` per surviving mutant; no in-scope non-exempt targets → `pass` without invoking `dart_mutant`; `files` present but `total === 0` → `pass`; `parsed == null || parsed.score == null` → `error`.
9. Absolute survivor file names are relativized against `io.root`; exempt survivor files are skipped.
10. The report is written to an `fs.mkdtempSync` temp dir under `os.tmpdir()` and removed (`fs.rmSync … { recursive, force }`) after parsing; a run leaves no `mutation-reports/`, git worktree, or `pub get` artifacts on the target tree.
11. `status`/`mutatorName` are parsed case-insensitively.
12. The `mutation_test`-only helpers `escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree` are deleted; `git`/`gitRoot` are deleted unless a retained gate references them (verified — G7 does not). Reusable infra (`resolveDart`, `resolveFlutter`, `isExempt`, `gateResult`, `missingTool`, `commandExists`, `DART_FILE_RE`) is retained.
13. Unit tests + captured JSON fixtures cover cases (a)–(e); the previous G6 `mutation_test`/XML test cases are replaced with `dart_mutant`/JSON equivalents; `node --test` passes.
14. The G6 tooling note in `SKILL.md` and `README.md` states G6 uses the external `dart_mutant` binary (Stryker JSON) requiring it on PATH, replacing the `mutation_test` dev-dependency mention.
15. `schema/report.schema.json` is unchanged (no new `rule` value registered).

## Out of Scope

- `--incremental` / `--base-ref` / `--cache-file` wiring.
- `--coverage-file` (mutate only covered lines).
- Brace-glob / per-file narrow-scope mutation **scoring** — v1 uses root-glob + post-filter of findings; the score-vs-scope caveat is documented in the implementation instead.
- AI mutation placement (`--ai`) — intentionally always `none`; never enabled for the gate.
- Any change outside the `clean-code-gates` skill (no `node-ts` adapter, other gates, target-project pubspec/CI changes).
- Any change to `schema/report.schema.json` or registration of a new finding `rule` value.

## Technical Notes

- **Zero runtime deps invariant:** `dart_mutant` is an external binary invoked via `node:child_process` (`execFileSync`), not an npm/pub dependency. No package additions.
- **CommonJS only:** `require`/`module.exports`, `.cjs` extension. New helpers exercised via the module's exported `_internals` object per repo convention.
- **Report contract:** findings must conform to `schema/report.schema.json` (`{file,line,rule,message,fixHint,severity}`); reuse existing rule values `mutation/score` + `mutation/survived`. Finding IDs follow `G6:score` / `G6-<relpath>:<line>`.
- **No side effects on the target tree:** temp-dir report + cleanup; no worktree, no in-place mutation, no `pub get`, no `mutation-reports/` litter.
- **Score-vs-scope caveat:** `dart_mutant` computes `mutationScore` over everything its `--glob` mutated. With the root-glob approach the score is exactly correct for `--scope project` (the primary G6 use); for narrow scopes survivor findings are correctly scoped but the pass/fail score is root-wide — document this in the impl, do not present a root-wide score as a per-file score.
- **Non-zero exit:** `dart_mutant` exits non-zero when the score is below `--threshold`; wrap `execFileSync` in try/catch and ignore the exit code, keying the verdict off the report file.
- **In-repo source of truth:** edit `plugins/my-skills/skills/clean-code-gates/` (NOT the `~/.claude/skills/...` global path the design doc references — that is the synced copy). Verified anchors: `defaults.cjs` line ~39 (`gates.G6.tool`), adapter `GATE_META.G6` line ~41.
- **Reference implementation** for `runG6` / `parseDartMutantReport` / `g6Glob` and the fixture cases (a)–(e) live in `docs/superpowers/specs/2026-06-15-g6-adapter-dart-mutant-rewrite-design.md` — follow it for detail.

## Tasks

> Tasks are ordered TDD-first: write/update tests before implementation.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.

### Phase 1 — Report parsing helper + fixtures

- [x] Add captured Stryker JSON fixtures under `__tests__/fixtures/`: (a) `mutationScore ≥ threshold` with some `Killed` mutants, (b) `mutationScore < threshold` with `Survived`/`NoCoverage` mutants (include mixed-case `status` to prove case-insensitivity), (d) report with `mutationScore` absent, (e) `files` present but 0 mutants total (`mutationScore 0.0`); plus a malformed/empty input for (c)
- [x] Write failing unit tests for `parseDartMutantReport` over fixtures (a)–(e): score extraction (numeric vs `null`), `total` mutant count, `byFile` survivor `location.start.line` collection, case-insensitive `status` matching, and invalid/empty JSON → `null`
- [x] Implement `parseDartMutantReport(json)` in `src/adapters/dart-flutter.cjs` and export it via `_internals` so the tests pass

### Phase 1 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test __tests__/dart-flutter.test.cjs` exits 0

### Phase 2 — runG6 rewrite, glob mapping, config + dead-code removal

- [x] Write failing unit test for `g6Glob(stackCfg)` mapping stack `roots` (default `['lib']`) → `'{root}/**/*.dart'`
- [x] Implement `g6Glob(stackCfg)` in the adapter and export it via `_internals`
- [x] Replace the existing G6 `mutation_test`/XML test cases in `__tests__/dart-flutter.test.cjs` with `dart_mutant`/JSON verdict cases: `pass` (a/e), `fail` with one `mutation/score` blocker + per-line `mutation/survived` warnings (b), `error` (c/d), no-targets → `pass` without invocation, and `missing_tool` when `dart_mutant`/Flutter absent
- [x] Rewrite `runG6` to invoke `dart_mutant` (`--path`/`--glob`/`--test-command`/`--threshold`/`--json`/`--quiet`/`--ai none`/`--output`/`--exclude`), derive the test command from `resolveFlutter`, tolerate non-zero exit, parse via `parseDartMutantReport`, apply the verdict matrix, relativize + post-filter (`isExempt`) survivors, use an `fs.mkdtempSync` temp dir with `fs.rmSync` cleanup, document the score-vs-scope caveat inline, and set `GATE_META.G6` to `{ name: 'mutation', tool: 'dart_mutant' }`
- [x] Update `defaults.cjs` dart-flutter `gates.G6.tool` from `'mutation_test'` to `'dart_mutant'` (thresholds unchanged)
- [x] Delete the `mutation_test`-only helpers (`escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree`; and `git`/`gitRoot` after verifying no retained gate references them) and any now-dead tests; retain reusable infra
- [x] Run the full test suite and confirm green

### Phase 2 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0

### Phase 3 — Docs (doc-only)

- [x] Update the G6 tooling note in `SKILL.md` to state G6 uses the external `dart_mutant` binary (Stryker JSON) requiring it on PATH, replacing the `mutation_test` dev-dependency mention
- [x] Update the G6 tooling note in `README.md` to match

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate
> commands from the Commands section of PROJECT-CONTEXT.md that apply to the
> phase's touched paths and asserts each exits 0. A failure routes through the
> coder's BLOCKED step, not a silent rewrite.

Applicable gate command for this skill (per PROJECT-CONTEXT `## Commands`): the Node built-in test runner. No build, lint, or coverage tooling is configured for the skill's own JS.

- **Phase 1** (touches the adapter + tests + fixtures): `cd plugins/my-skills/skills/clean-code-gates && node --test __tests__/dart-flutter.test.cjs` exits 0.
- **Phase 2** (adapter rewrite, `defaults.cjs`, dead-code removal): `cd plugins/my-skills/skills/clean-code-gates && node --test` (full suite) exits 0.
- **Phase 3** (doc-only: `SKILL.md`, `README.md`): no code gate applies — no source/runtime surface changed. Confirm the full suite still passes if any code was incidentally touched.

Phase exit criterion: the applicable command exits 0 on the changed set. No silent rewrites of source to make a gate pass without a corresponding plan task. G1 (coverage) and G6 (mutation of the skill's own code) are NOT gated here — coverage is not-measured/advisory per PROJECT-CONTEXT and remains QA-only.

## Dependencies

- None. (SPEC-001 is READY_FOR_PLANNING; no other plan must be DONE first.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-02T23:29:18Z | QA

QA-001 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.

### 2026-07-02T23:24:57Z | REVIEWER

CR-001 created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-02T23:21:20Z | TESTER

TEST-001 created. Status: PASS. Coverage: not-measured → 69.69% (advisory).

### 2026-07-02T23:15:14Z | CODER

All 14 tasks complete. Plan status → DONE. Ready for reviewer.

### 2026-07-02T23:05:39Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-02T23:02:43Z | ARCHITECT

Plan `FEAT-001` created. Type: feat. Tasks: 14.
Status: PLANNED. Ready for coder.
