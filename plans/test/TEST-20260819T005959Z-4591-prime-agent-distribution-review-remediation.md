---
id: TEST-20260819T005959Z-4591
plan: FEAT-20260819T001630Z-be84
title: Test Report — Prime Agent distribution review remediation
status: PASS
created_at: 2026-08-19T01:05:55Z
cycle: 0
---

**Related:** [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md)

## Summary

All three suites are green and the coverage floor is met: `clean-code-gates` **180/180** (was 174), `node scripts/build-prime-agent.mjs --check` exit 0, `prime-agent && npm test` exit 0. Source-only line coverage moved **72.69% → 75.16%**, above the 70% floor.

Six e2e tests were added for one selected flow — the **CLI exit-code + report-artifact contract** (`bin/gates.cjs`). That flow is how every consumer (CI job, orchestrator, the `/clean-code-gates` skill itself) actually uses this tool, and before this report it was the least-covered file in the repo at 55.56% with the entire `--out <dir>` writer and the `process.exit(exitCode)` propagation unproven. It is now at 100%.

> **The headline finding is not the green suite — it is what the green suite does not see.** The three correctness defects the simplify pass reported and deliberately left open are **all invisible to the test suite**, before and after my additions. I reproduced each one against the real binary. One of them means the spec's top-line Goal is unmet while every gate reports success. Detail in [Known-open defects](#known-open-defects--test-suite-verdict) below; per my contract I did not fix them.

## Flows Triaged

Criticality = user impact × breakage likelihood × not-covered-by-unit. e2e is expensive, so only the flow that scored high on **all three** factors was selected.

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| **F1 — CLI exit-code + `--out <dir>` report artifacts** (ACs 5, 6, 7) | **High** (impact H × likelihood M × uncovered H) | **SELECTED — 6 e2e added** | The process-level contract every consumer branches on. `exit-codes.test.cjs` proves the codes via in-process `run()`, so a regression in `bin/gates.cjs`'s `process.exit(exitCode)` would leave the whole suite green. The `--out <dir>` writer (`report.json` + `report.md`, the documented default per README:26/:89) had **zero** tests. `bin/gates.cjs` sat at 55.56% line coverage, the worst non-adapter file. |
| F2 — Shell injection via `--scope diff:<baseRef>` (ACs 1, 2) | High | **EXCLUDED — already covered** | `scope-baseref.test.cjs` already runs two CLI-level `spawnSync` e2e tests and proves non-execution with a sentinel-file existence check (`PWNED`, `PWNED2`, `PWNED3`). Adding more would duplicate, not extend. Audited: assertions are strong. |
| F3 — Installer preflight, symlink containment, all-or-nothing (ACs 3, 4) | High | **EXCLUDED — already covered** | `prime-agent/tests/install.sh` is a genuine e2e: real temp trees, real symlinks, asserts the attacker-chosen outside directory stays empty, asserts a late collision leaves exactly one pre-existing dir and no earlier skill. Covers global, project, `--force`, deep-component, and collision cases. Audited: high quality. |
| F4 — Builder mode preservation + `--check` drift (AC 12) | Med-High | **EXCLUDED — already covered** | `prime-agent/tests/parity.sh:42-43` asserts `[[ -x "$built" ]]` on a real executable source file — the exact AC-12 claim. Re-verified live this session (see Coverage note on regeneration). |
| F5 — G5 string-aware inline scanning (AC 11) | Med | **EXCLUDED from e2e** | Unit is the right altitude for a lexer: 20 focused unit tests in `g5-inline.test.cjs` pair positive and negative controls. The CLI path through G5 is now covered incidentally by F1. **But see defect D3** — one of these tests is aimed at the defect and misses it. |
| F6 — Gate-selection usage errors (AC 6) | Med-High | **EXCLUDED — already covered** | `gate-selection.test.cjs` has 7 unit tests plus one CLI-level `spawnSync` asserting exit 3 and `doesNotMatch(stdout, /"status": "pass"/)`. **But see defect D2** — the CLI test uses a non-empty scope and so misses the early-return hole. |
| F7 — Monorepo per-package root derivation (ACs 9, 10) | Med | **EXCLUDED** | Pure config-derivation logic with no distinct user-facing flow; `monorepo-roots.test.cjs` + `dart-monorepo-g1.test.cjs` cover it at unit level, and `detect.cjs`/`defaults.cjs` are both at 100% line coverage. |
| F8 — Prime-port doc adaptations (ACs 14–17, 19–22) | N/A | **EXCLUDED — not executable** | Prose and template changes. `PROJECT-CONTEXT.md` → Test tooling mandates structural review for doc-skill changes, not execution. No e2e is possible or meaningful. |
| F9 — Distribution hygiene: zero marketplace paths, zero broken ADR links (AC 18) | Med | **EXCLUDED from e2e — structurally verified** | Verified by inspection this session (below). A `grep` guard in `parity.sh` would be a reasonable future regression lock, but the check is a one-time migration assertion, not a flow. |

### F9 structural verification (performed)

- `grep -rn 'plugins/my-skills' prime-agent/skills/` → **1 hit**, `spec-driven-eval/UPSTREAM.md:32`. Read in context: it is inside a fenced `bash` block describing how to re-sync **from a checkout of the source repository**, which AC 18 explicitly carves out ("keeps its CC-BY-4.0 attribution with a clarified source-repository re-sync path"). Intentional, not a dead marketplace path. **AC 18 holds.**
- Relative `docs/adr` links in the distribution → **0**.
- `/my-skills:` slash references in the distribution → **0**.

## E2E Tests Added

New file: `plugins/my-skills/skills/clean-code-gates/__tests__/cli-e2e.test.cjs` (6 tests, all green, ~0.9s).

| # | Test | Proves |
|---|---|---|
| 1 | clean run exits 0 and writes both artifacts | exit 0; `report.json` parses with `status: pass` and `schemaVersion: 1.0`; `report.md` renders the `— PASS` header; stderr names the path and status |
| 2 | a blocker exits 1 and the on-disk report names file and line | exit 1; `status: blocked`, `blockers: 1`; finding is `src/b.ts:1` severity `blocker`; markdown renders `[blocker] src/b.ts:1` |
| 3 | `--require-tools` turns missing tooling into exit 2 | paired control: same project exits **0** without the flag and **2** with it; report still written with `G1` in `gatesMissingTool` |
| 4 | a gate producing no verdict exits 4, independent of `--require-tools` | exit 4 both with and without the flag (exit 4 outranks the opt-in exit 2); `gatesErrored: ['G1']` **and `gatesRun: []`** — an errored gate is not a gate that ran. Driven by a stub `node_modules/.bin/jest` that exits 0 writing no coverage summary |
| 5 | `--scaffold` exits 0, prints install commands, changes nothing | exit 0; stdout contains the advice banner, `[node-ts]`, and `npm i -D`; directory listing is byte-identical before/after, proving the documented read-only claim (README:27) |
| 6 | `--out -` streams JSON to stdout and writes no report directory | exit 0; stdout parses as JSON with `status: pass`; no `.cleancode` directory created |

Tests 1, 2, 3, 4 and 6 cover `bin/gates.cjs:25-34` (the report writer and exit propagation); test 5 covers `bin/gates.cjs:15-20` (the scaffold branch). Together they take the file from 55.56% to **100%** line and branch coverage.

**Generated-tree note.** `plugins/my-skills/skills/**/__tests__/` ships into the distribution, so adding this test file made `build-prime-agent.mjs --check` report drift (`missing: prime-agent/skills/clean-code-gates/__tests__/cli-e2e.test.cjs`). I resolved it the sanctioned way — ran the builder to regenerate wholesale (11 skills, 152 → 153 files), never hand-editing the generated tree — then re-ran `--check` to exit 0. This is the plan's own V2 gate working as designed.

## Coverage

Command: `node --test --experimental-test-coverage --test-coverage-exclude='__tests__/**'` (run from the skill dir). The exclusion matters — the default invocation counts the test files themselves at ~100% and inflates the total to 83.78%. The figures below are **source-only** and are the honest ones.

| Metric | Before | After | Floor |
|---|---|---|---|
| **Line** | **72.69%** | **75.16%** | 70% ✅ |
| Branch | 81.24% | 81.79% | — |
| Functions | 81.32% | 83.52% | — |
| Test count | 174 | 180 | ≥ 106 ✅ (AC 23) |

Per-file movement:

| File | Before | After |
|---|---|---|
| `bin/gates.cjs` | 55.56% | **100.00%** |
| `src/adapters/node-ts.cjs` | 52.56% | 58.36% |
| `src/report.cjs` (branch) | 75.86% | 81.48% |
| `src/run.cjs` (branch) | 77.14% | 79.41% |

No further unit tests were added. The floor is met with margin, and the remaining drag is concentrated in the two adapters (`node-ts.cjs` 58.36%, `dart-flutter.cjs` 64.80%) whose uncovered regions are the G2/G4/G6/G7 tool-invocation paths — they require jest, vitest, ESLint, Stryker, dependency-cruiser, and the Dart toolchain installed in a fixture project. Covering them means either shipping heavy fixtures or stubbing every external binary; that is a deliberate, sizeable piece of work, not an incremental top-up, and it is out of proportion to this plan's diff. Recording it as a backlog candidate rather than pretending it is a gap this report should close.

## Test-Quality Audit

Suite-wide scan for weak assertions across all 22 test files:

- **Tautologies** (`assert.ok(true)`, `strictEqual(true, true)`, truthy-only `.length` checks) — **none found**.
- **Assertion-free tests** — **none found**.
- Assertion density is healthy (e.g. `g5-inline.test.cjs` 25 asserts / 20 tests; `scope-baseref.test.cjs` 19 asserts / 8 tests). Negative controls are consistently paired with positives.
- Security tests do not merely assert a throw — they assert the sentinel side-effect file was never created. That is the correct shape for an injection test.
- `install.sh` and `parity.sh` assert real filesystem state (containment, empty attacker directory, `-x` mode bit) rather than exit codes alone.

**The coder's test suite is well-built.** The problem is not assertion quality. It is that three tests are aimed at the right behaviors but chose inputs that sit just beside the defect — see below.

## Known-open defects — test-suite verdict

I reproduced all three against the real binary. **The suite does not catch any of them**, and in two cases a test exists that *looks* like it would.

### D1 — empty scope yields `status: pass`, exit 0

`src/report.cjs` + `src/run.cjs`. Reproduced:

```
$ gates.cjs --scope files: --out -          → exit 0, "status": "pass", "gatesRun": []
$ gates.cjs --scope module:docs --out -     → exit 0, "status": "pass"   (dir holds only .md)
```

**Severity: high.** This is the spec's top-line Goal — *"a gate run can no longer exit 0 while having measured nothing"* — unmet on the most direct path to it. Reachable in normal operation: any `--scope diff:<ref>` whose changed set contains no source files, or any `--module` pointed at a docs directory, reports a green pass having gated nothing.

Note the inconsistency this creates, which my e2e test 4 pins from the other side: an **errored** gate correctly yields `gatesRun: []` with `status: error` and exit 4, while an **empty scope** yields the identical `gatesRun: []` with `status: pass` and exit 0. The report builder has the information it needs to tell these apart and does not use it.

**Why no test catches it:** every fixture in the suite scopes to at least one real source file. There is no empty-scope case anywhere.

### D2 — unknown `--gates` id on an empty scope exits 0 instead of 3

`src/run.cjs` `resolveGatePlan`, the `if (!plan.length) return plan;` at line 51 sitting *above* `assertRequestedGates`/`assertResolvedGates`. Reproduced:

```
$ gates.cjs --scope files: --gates G9 --out -            → exit 0   (expected 3)
$ gates.cjs --scope files:src/a.ts --gates G9 --out -    → exit 3   (control, correct)
```

**Severity: medium-high.** A typo'd gate id silently succeeds whenever the scope happens to be empty — the two failure modes compound, and AC 6 is unmet in that corner.

**Why no test catches it:** `gate-selection.test.cjs` *does* have a CLI-level exit-3 test, but its fixture scopes to `src/a.ts`, so `plan.length` is 1 and the early return is never reached. The test is correct; its input is one step away from the bug.

### D3 — G5 misses a trailing comment after `++ /` or `-- /`

`src/gates/g5-no-comments.cjs`: `+` and `-` are in `REGEX_PRECEDERS`, so the `/` after a postfix operator mis-lexes as a regex opener and swallows the `//`. Reproduced — trigger set is **narrower than the simplify note implies**:

| Input | Result |
|---|---|
| `i++ / 2; // c` | **MISSED** |
| `i-- / 2; // c` | **MISSED** |
| `const x = a + b / c; // c` | flagged (correct) |
| `const x = a - b / c; // c` | flagged (correct) |
| `n = -x / 2; // c` | flagged (correct) |
| `const ok = a + /re/.test(s);` | clean (correct — must stay) |

**Severity: low.** It fires only when `+` or `-` is the character *immediately* preceding the slash after whitespace-trim, i.e. postfix `++`/`--` followed by division. Note that `+`/`-` genuinely belong in `REGEX_PRECEDERS` (`a + /re/.test(s)` is valid JS and must keep working) — so the fix is to special-case the `++`/`--` digraphs, **not** to remove `+`/`-` from the set. A naive removal would introduce a false positive; the last row above is the regression test that would catch that.

**Why no test catches it:** `g5-inline.test.cjs` has a test literally named *"a division is not mistaken for a regex"* — but its input is `const a = b / c; // ratio`, where the preceding token is an identifier. It proves the property for the case that already worked.

**I did not add failing tests for D1–D3.** My workflow requires the tests I commit to pass, and a red suite would block the pipeline on defects that are already tracked. The reproductions above are the handoff; the reviewer should route them to a fix plan, and each fix should land with the exact input shown here as its regression test.

## Verdict

**PASS** — e2e green, coverage 75.16% ≥ 70% floor, test count 180 ≥ 106, all three plan gates (V1, V2, V3) exit 0.

The PASS is mechanical and it is narrow. It certifies that what the suite measures is green and that the floor is met. It does **not** certify the plan's acceptance criteria as satisfied: **AC 5/6's intent and the spec's top-line Goal are demonstrably unmet** (D1, D2), and AC 11 has a real hole (D3). All three are reproduced above with exact commands.

Recommended handoff to the reviewer:

1. Treat D1 as the blocking item — it defeats the stated purpose of the whole `clean-code-gates` change family.
2. D2 is a two-line reordering (move the `!plan.length` early return below the two asserts) but needs the empty-scope fixture that the suite currently lacks.
3. D3 is low severity; fix by special-casing `++`/`--` and keep the `a + /re/` case as a guard.
4. Backlog candidate (not this plan): adapter tool-invocation coverage, the 52–65% region dragging the total down.
