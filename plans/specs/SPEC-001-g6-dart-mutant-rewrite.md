---
id: SPEC-001
title: G6 Mutation Gate — Swap mutation_test → dart_mutant
status: READY_FOR_PLANNING
created_at: 2026-07-02T23:01:07Z
updated_at: 2026-07-02T23:01:07Z
cycle: 0
related_to: —
---

**Related:** design doc — `docs/superpowers/specs/2026-06-15-g6-adapter-dart-mutant-rewrite-design.md`

## Summary

Rewrite the clean-code-gates **dart-flutter** adapter's G6 (mutation) gate so it invokes the external `dart_mutant` binary (AST-based engine, Stryker-compatible JSON report) instead of the `mutation_test` pub package (XML report). The verdict is read from `dart_mutant`'s top-level `mutationScore` float, surviving-mutant warnings come from its per-file mutant list, and the whole `mutation_test`-era worktree/XML apparatus is deleted. The gate keeps its existing report contract, rule values, and thresholds; a fixer/orchestrator consuming G6 output sees the same `mutation/score` blocker and `mutation/survived` warnings as before.

## Goals

- G6 in the `dart-flutter` adapter runs `dart_mutant --json` (never `mutation_test`) and parses its Stryker JSON.
- The pass/fail verdict is derived from the report's top-level `mutationScore` (0–100 float) compared to the gate threshold (default 70).
- Below-threshold runs emit one `mutation/score` blocker plus per-line `mutation/survived` warnings for each surviving mutant (`status ∈ {Survived, NoCoverage}`).
- `dart_mutant` absent on PATH → `missing_tool`; unparseable/empty/`mutationScore`-absent report → `error`; `files` present but 0 mutants total → `pass`.
- The run leaves **no** side effects on the target tree: report is written to a temp dir and cleaned up; no git worktree, no in-place mutation, no `pub get`, no `mutation-reports/` litter.
- `status`/`mutatorName` values are parsed **case-insensitively**.
- Dead `mutation_test`-only helpers are removed; reusable infra is retained.
- Unit tests and captured JSON fixtures cover the five report cases (a–e); docs' G6 tooling note is updated.

## Non-goals

- `--incremental` / `--base-ref` / `--cache-file` wiring (fast local diffs).
- `--coverage-file` (mutate only covered lines).
- Brace-glob / per-file narrow-scope mutation **scoring** — v1 uses root-glob + post-filter of findings; the score-vs-scope caveat is documented instead.
- AI mutation placement (`--ai`) — intentionally always `none`; never enabled for the gate.
- Any change outside the `clean-code-gates` skill (no changes to the `node-ts` adapter, other gates, target projects' pubspec/CI in this repo).
- Registering any new finding `rule` value (`mutation/score` + `mutation/survived` are reused).

## Users and use cases

- **Gate runner / CI (`node bin/gates.cjs --scope project --gates G6`)**: runs G6 against a Flutter project that has `dart_mutant` installed, receives a `pass`/`fail`/`missing_tool`/`error` verdict conforming to the report schema. Success = correct verdict and, on failure, actionable survivor findings.
- **Fixer agent / orchestrator**: consumes the JSON report's `mutation/score` blocker and `mutation/survived` warnings to strengthen tests. Success = same finding shape as the previous `mutation_test` implementation, no consumer changes required.
- **Skill maintainer**: reads the updated SKILL.md/README G6 note describing the `dart_mutant` dependency and PATH requirement.

## Functional requirements

Traceable to the design's "Success criteria" and "Testing the rewrite" (a–e).

1. **Tool selection.** `defaults.cjs` dart-flutter `gates.G6.tool` is `'dart_mutant'` (was `'mutation_test'`); `GATE_META.G6` in the adapter is `{ name: 'mutation', tool: 'dart_mutant' }`.
2. **Detection.** G6 availability is determined by `commandExists('dart_mutant')` (a PATH check) plus `resolveFlutter(io.root)`, not by a pub-package presence check. If either is missing → `missing_tool` via the existing `missingTool('G6', stackCfg)`.
3. **Invocation.** The adapter runs `dart_mutant` with, at minimum: `--path <root>`, `--glob <rootGlob>`, `--test-command "<flutter test invocation>"`, `--threshold <score>`, `--json`, `--quiet`, `--ai none`, `--output <tempDir>`, and one `--exclude <glob>` per configured exclude. The test command is derived from `resolveFlutter` (e.g. `flutter test` / `fvm flutter test`), never the `dart_mutant` default `dart test`.
4. **Glob mapping (`g6Glob`).** The stack `roots` (default `['lib']`) map to a single wildcard `--glob '{root}/**/*.dart'` (a superset of the in-scope files). Findings are then post-filtered to the in-scope `targets` set and non-exempt files. Narrow scopes (`files:`/`diff:`/`module:`) mutate the whole root glob but report only in-scope survivors.
5. **Score-vs-scope caveat.** For `--scope project` (the primary G6 use) the root-wide `mutationScore` is exactly correct. For narrow scopes the survivor findings are correctly scoped but the pass/fail score is root-wide; this is documented in the implementation and must not be presented as a per-file score.
6. **Report parsing (`parseDartMutantReport`).** Given the report JSON string, return `{ score, total, byFile }` where: `score` is `report.mutationScore` when it is a number else `null`; `total` is the count of all mutants across all files; `byFile` maps file name → array of `location.start.line` for mutants whose lowercased `status` ∈ `{survived, nocoverage, no_coverage}`. Invalid JSON → `null`.
7. **Verdict — pass (score ≥ threshold).** With mutants present and `score ≥ threshold`, return `pass` with no findings.
8. **Verdict — fail (score < threshold).** Return `fail` with one `blocker` finding `{ id: 'G6:score', rule: 'mutation/score', file: targets[0], line: 1, metric: { value: score, limit: threshold, unit: 'percent' } }`, plus one `warning` per surviving mutant `{ id: 'G6-<rel>:<line>', rule: 'mutation/survived', file: <rel>, line }`. Survivor file names that are absolute are relativized against `io.root`; exempt files are skipped.
9. **Verdict — no targets.** If no in-scope, non-exempt Dart targets exist, return `pass` (nothing to verify) without invoking `dart_mutant`.
10. **Verdict — zero mutants.** If `files` are present but `total === 0` (e.g. too-simple code, `dart_mutant` reports `mutationScore 0.0`), return `pass` — not a failure.
11. **Verdict — error.** If no report is produced, the report is unparseable/empty, or `mutationScore` is absent (`parsed == null || parsed.score == null`), return `error`.
12. **Non-zero exit tolerance.** `dart_mutant` exits non-zero when the score is below `--threshold`; the adapter must ignore the exit code and rely on the presence/parse of the report file. A missing report is the real failure.
13. **No side effects / cleanup.** The report is written to a `fs.mkdtempSync` temp dir under `os.tmpdir()` and removed (`fs.rmSync … force`) after parsing; the run must leave no `mutation-reports/`, worktree, or `pub get` artifacts on the target tree.
14. **Case-insensitivity.** `status` and `mutatorName` are compared case-insensitively so the adapter is not brittle across `dart_mutant` versions.
15. **Dead-code removal.** Delete the `mutation_test`-only helpers `escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree`; delete `git`/`gitRoot` too unless a retained gate still references them (verify — G7 does not). Retain reusable infra: `resolveDart`, `resolveFlutter`, `isExempt`, `gateResult`, `missingTool`, `commandExists`, `DART_FILE_RE`.
16. **Testability.** New helpers (`parseDartMutantReport`, `g6Glob`) are exported via the module's `_internals` object so `node --test` can exercise them directly.
17. **Docs.** Update the G6 tooling note in `SKILL.md` and `README.md` to state G6 uses the external `dart_mutant` binary (Stryker JSON) requiring it on PATH, replacing the `mutation_test` dev-dependency mention.

### Explicit test cases (design "Testing the rewrite" a–e)

- **(a)** Fixture: `mutationScore ≥ threshold` with some `Killed` mutants → `parseDartMutantReport` yields the score and empty `byFile`; gate returns `pass`, no findings.
- **(b)** Fixture: `mutationScore < threshold` with `Survived`/`NoCoverage` mutants → one `mutation/score` blocker + per-line `mutation/survived` warnings; gate returns `fail`.
- **(c)** Malformed/empty JSON → `parseDartMutantReport` returns `null` → gate returns `error`.
- **(d)** `mutationScore` absent from the report → `parsed.score == null` → gate returns `error`.
- **(e)** `files` present but **0 mutants total** (`mutationScore 0.0`) → `total === 0` → gate returns `pass`.

Fixtures are captured JSON files added under `__tests__/fixtures/`. Existing `__tests__/dart-flutter.test.cjs` G6 cases that assert `mutation_test` invocation/XML parsing are replaced with `dart_mutant`/JSON equivalents.

## Non-functional requirements

- **Performance**: `dart_mutant` is parallel + AST-based; no per-mutant serial worktree penalty. No latency budget set — must not be slower than the removed worktree flow for the project scope.
- **Security / auth**: none (local CLI). Never pass `--ai` with a provider; keep `none` so scores stay deterministic and no external calls are made.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: no new user data; the run mutates the target tree only in `dart_mutant`'s own sandbox and writes reports to a temp dir that is deleted.
- **Monetization tier**: —

## Project-context fit

- **Layers touched**: the `dart-flutter` adapter's G6 gate only, plus `defaults.cjs`, the adapter's test file + fixtures, and the two docs files. No other adapter, gate, or module changes.
- **Depends on / extends**: reuses existing adapter infra (`resolveFlutter`, `isExempt`, `gateResult`, `missingTool`, `commandExists`, `DART_FILE_RE`) and the report schema's existing rule values `mutation/score` + `mutation/survived`.
- **Invariants honored**: zero runtime deps (only `node:*` builtins — `dart_mutant` is an external binary invoked via `child_process`, not an npm/pub dependency); CommonJS `.cjs`; findings conform to `schema/report.schema.json`; no side effects on the target tree; case-insensitive `status`/`mutatorName` parsing; reusable infra retained, `mutation_test`-only helpers deleted; SKILL.md/README G6 note updated.
- **Conflicts to resolve**: none identified — the design doc's file paths (`~/.claude/skills/clean-code-gates/`) refer to the synced global copy; the authoritative in-repo source is `plugins/my-skills/skills/clean-code-gates/` (mapping confirmed: `defaults.cjs:39` and adapter `GATE_META.G6` at line 41 currently reference `mutation_test`). The architect targets the in-repo paths.
- **Open product decisions**: none.

## Affected surface

- **Backend (skill code)**:
  - `plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs` — rewrite `runG6`, add `parseDartMutantReport` + `g6Glob`, update `GATE_META.G6` and the top-of-file G6 doc comment, delete `mutation_test`-only helpers, export new helpers via `_internals`.
  - `plugins/my-skills/skills/clean-code-gates/defaults.cjs` — dart-flutter `gates.G6.tool`: `'mutation_test'` → `'dart_mutant'` (thresholds unchanged).
- **Frontend / mobile**: —
- **Admin**: —
- **Tests / fixtures**:
  - `plugins/my-skills/skills/clean-code-gates/__tests__/dart-flutter.test.cjs` — replace G6 `mutation_test`/XML cases with `dart_mutant`/JSON cases (a–e).
  - `plugins/my-skills/skills/clean-code-gates/__tests__/fixtures/` — add captured Stryker JSON fixtures for cases (a), (b), (d), (e) (and an empty/malformed input for (c)).
- **Docs**:
  - `plugins/my-skills/skills/clean-code-gates/SKILL.md` and `README.md` — G6 tooling note.
- **Shared**: `schema/report.schema.json` — **no change** (no new rule value).

## Open questions

- None. (The design doc verifies the `dart_mutant 0.4.0` invocation surface, JSON schema, reference implementation, files-to-change, and test cases.)

## Decisions resolved by Brainstormer default

<!-- The design doc resolved every material decision; nothing was delegated to a Brainstormer default. -->

- None.

## References

- `docs/superpowers/specs/2026-06-15-g6-adapter-dart-mutant-rewrite-design.md` — full design (verified facts, reference `runG6`/`parseDartMutantReport`, test cases a–e, success criteria).
- `.orchestrator/PROJECT-CONTEXT.md` — invariants, layout, critical flows, out-of-scope.
- `plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs` — current G6 implementation (`GATE_META.G6` line 41).
- `plugins/my-skills/skills/clean-code-gates/defaults.cjs` — current dart-flutter `gates.G6.tool` (line 39).
- `plugins/my-skills/skills/clean-code-gates/schema/report.schema.json` — report/finding contract.
