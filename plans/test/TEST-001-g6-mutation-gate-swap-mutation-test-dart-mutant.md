---
id: TEST-001
plan: FEAT-001
title: Test Report — G6 Mutation Gate — Swap mutation_test → dart_mutant
status: PASS
created_at: 2026-07-02T23:21:20Z
cycle: 0
---

**Related:** [FEAT-001](../feat/FEAT-001-g6-dart-mutant-rewrite.md)

## Summary

FEAT-001 rewrites the `dart-flutter` adapter's G6 gate from the `mutation_test` pub package to the external `dart_mutant` binary (Stryker JSON). The coder's suite already lands the five design report cases (a)–(e) as captured JSON fixtures plus a full verdict-matrix and `runG6`-wiring test set. This tester run verified the whole suite is green, audited that the five cases assert real behavior (not stubs), and measured advisory coverage.

- **Full suite:** `node --test` → **65 pass / 0 fail**.
- **e2e:** none added — the skill has no e2e surface and none is warranted (rationale below).
- **Coverage floor:** advisory-only per PROJECT-CONTEXT; not a hard block for this plan. The G6 diff itself is well covered.

## Flows Triaged

The gate is a dependency-free Node CLI, not a UI. PROJECT-CONTEXT defines "flows" as CLI behaviors verified by unit tests + a manual smoke run, and states there is **no e2e framework** (unit tests only). Criticality scored as user-impact × breakage-likelihood × not-covered-by-unit.

| Flow (from plan AC + PROJECT-CONTEXT critical flows) | Criticality | Decision | Rationale |
|---|---|---|---|
| Parser: `parseDartMutantReport` — score extraction, `total`, `byFile` survivor lines, case-insensitive `status` | High | Unit (covered) | Pure function; the JSON contract boundary. Fully unit-tested over fixtures (a)–(e), incl. mixed-case proof. Not-covered-by-unit = 0 → no e2e. |
| Verdict matrix: `g6Verdict` — pass / fail+blocker+survivors / zero-mutants→pass / error / no-targets→pass / relativize+exempt | High | Unit (covered) | Pure decision logic; the gate's core correctness. Fully unit-tested incl. absolute-path relativization and exempt filtering. |
| Wiring: `runG6` — `missing_tool` (no Flutter / no binary), no-target skip, parse→verdict, missing-report→error | High | Unit (covered) | Branch logic dependency-injects `resolveFlutter`/`commandExists`/`runMutant`; all four branches asserted. |
| CLI end-to-end: `node bin/gates.cjs --scope project --gates G6` against a real Flutter project with `dart_mutant` installed | High impact, but not unit-testable | **Excluded from e2e** | Requires the external `dart_mutant 0.4.0` binary + a live Flutter project + `flutter test` toolchain — none available in this Node-only repo/CI. PROJECT-CONTEXT designates this the manual smoke run, not an automated e2e. Adding a stubbed "e2e" would only re-assert the already-unit-covered wiring. |
| No-litter invariant (AC #10 / flow #6): run leaves no `mutation-reports/`, worktree, or `pub get` artifacts | Medium | **Excluded / inherent gap** | Lives in `runMutant`, the real `execFileSync('dart_mutant', …)` shell-out. It is dependency-injected out of every `runG6` test and is not exported via `_internals`, so it cannot be exercised from a test file without a production-source change (out of tester scope). Verified only by the manual smoke run. |

**e2e added: none.** Justification: there is no e2e framework in the project, and every high-criticality flow that *can* run without the external Dart toolchain is already covered by real unit assertions. The only paths needing the live binary are explicitly the manual-smoke domain per PROJECT-CONTEXT — an automated e2e there would be a stub, not a real exercise.

## E2E Tests Added

None. See triage — no e2e framework exists; the sole live-binary flow is manual-smoke by design. Expensive e2e was deliberately not manufactured.

## Coverage (before → after)

No coverage floor tooling is wired for the skill's own JS (PROJECT-CONTEXT: "treat coverage as not-measured/advisory, not a hard block"). Numbers below are from an advisory `node --test --experimental-test-coverage` run.

- **Before:** not-measured (no floor tooling; the coder rewrote the entire G6 test surface, so a like-for-like prior number is not meaningful).
- **After (advisory):** `dart-flutter.cjs` line **61.69%** / branch 78.62% / funcs 60.00%; whole-suite **all-files line 69.69%**.

**Why below 70 is expected and not a regression for this plan:** the shortfall is entirely the *other* gates' external-tool shell-out paths (`runG1`/`runCoverage`, `runG2`, `runG4`, `runG7` — lines 198–250, 313–371, 383–425, 691–714), all outside FEAT-001's diff. Within this plan's diff, the G6 helpers are covered: `parseDartMutantReport` (430–454), `g6Glob` (463–467), `g6Verdict` (489–526), and `runG6` (572–591) all execute under test. The one uncovered G6 span is `runMutant` (536–570) — the real `dart_mutant` `execFileSync` shell-out — which is dependency-injected in every `runG6` test and needs the external binary + a Flutter project to run. It is not exported to `_internals`, so no additional *test-file-only* change can lift it; closing it would require exporting the runner (production change) or the manual smoke run. No further meaningful test-only coverage remains.

Per PROJECT-CONTEXT and the plan ("G1 coverage and G6 mutation of the skill's own code are NOT gated here … remains QA-only"), the 70% floor is advisory here, so this reports **PASS**, not BELOW_FLOOR.

## Test-Quality Audit

Audited the G6 assertions for empty asserts / tautologies — none found. Highlights:

- **Case (a) pass** — asserts `score === 85`, `total === 2`, `byFile === {}` (real values from `g6-dart-mutant-pass.json`).
- **Case (b) fail / case-insensitivity** — the fixture genuinely mixes `Survived`, `survived`, `NoCoverage`, and `no_coverage` casings across two files; the test asserts the exact collected survivor lines `[5, 8, 12]` (calc) and `[7]` (util) with `Killed` (line 3) excluded. This is a real proof of case-insensitive `status` matching, not a stub.
- **Case (c) malformed** — asserts `null` for both a malformed fixture and `''`.
- **Case (d) no-score** — asserts `score === null` while `total === 1` (distinguishes "absent score" from "no mutants").
- **Case (e) zero-mutants** — asserts `score === 0`, `total === 0`, `byFile === {}` (proves the count-guard, not the score, drives the zero-mutant pass).
- **Verdict + wiring** — `g6Verdict (b)` asserts the exact blocker `id`/`rule`/`file`/`line`/`metric` object and all four survivor-warning `file:line` pairs; the relativize/exempt test asserts a single surviving finding after dropping an absolute path, a `_test.dart`, and a `.g.dart`. `runG6` tests assert both `missing_tool` branches, the no-invocation skip (via an `invoked` spy), the fail wire-through, and missing-report→`error`.

No weak or tautological tests identified in the FEAT-001 test set.

## Verdict

**PASS.** Full suite green (65/65). All high-criticality G6 flows are covered by real, non-stub assertions, including the five design report cases (a)–(e). No e2e was warranted (no framework; the sole live-binary flow is manual-smoke by design, and manufacturing a stubbed e2e was declined). Coverage is advisory-only per PROJECT-CONTEXT and explicitly not gated for this plan; the sub-70 all-files number is driven by out-of-diff external-tool shell-out paths, while the G6 diff itself is covered. One inherent, test-only-unclosable gap noted (`runMutant`'s real shell-out / no-litter invariant), delegated to the manual smoke run.
