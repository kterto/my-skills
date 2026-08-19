---
id: TEST-20260819T022100Z-2621
plan: FIX-20260819T020345Z-48c5
title: Test Report — Gateable-scope guard and installer rollback fixes
status: PASS
created_at: 2026-08-19T02:28:07Z
cycle: 2
---

**Related:** [FIX-20260819T020345Z-48c5](../code-review/FIX-20260819T020345Z-48c5-gateable-scope-guard-installer-rollback.md) · [CR-20260819T015653Z-4511](../code-review/CR-20260819T015653Z-4511-prime-agent-remediation-cr-fixes.md) · [TEST-20260819T014354Z-d58f](./TEST-20260819T014354Z-d58f-prime-agent-remediation-cr-fixes.md)

## Summary

Cycle 2's fix pass verified **independently of the coder's report**. Both Must Fix findings are closed;
MF-1 — the ungateable-scope false pass I raised as **D1** in `TEST-20260819T014354Z-d58f` — is closed on
the full surface, not just the `src/theme.css` case the CR reproduced.

Verdict: **PASS**. Suites 206/206 (`clean-code-gates`), `prime-agent npm test` exit 0,
`build-prime-agent.mjs --check` exit 0, line coverage 86.77 % overall with the MF-1 change site at 100 %.

Independent verification, not taken on report:

- **MF-1** re-probed on a purpose-built fixture repo across **six** non-source extensions × **four** scope
  kinds. All exit 3. Mixed scopes and `--scaffold` unaffected.
- **MF-2** re-probed at **five** distinct `MV_FAIL_AT` points on a genuinely empty destination. All leave
  the destination with **zero entries of any kind**, print the rollback message, and accept a plain retry.
- **Five mutants** injected against the delivered code; all five killed. The regression tests are load-bearing.
- The README sentence AC 12 nominally froze was re-derived from a **pre-feature baseline binary**, not read.
  Both halves of the new text are factually true.

One residual observation and two minor test-hygiene notes are recorded below. Neither blocks.

## Flows Triaged

The e2e layer is the two runtime islands' own outer-boundary suites — `__tests__/cli-e2e.test.cjs` spawns
the real `bin/gates.cjs`; `prime-agent/tests/install.sh` runs the real installer against a real filesystem.
PROJECT-CONTEXT → Test tooling records no separate e2e framework, so **no new e2e harness was authored**;
instead every selected flow was re-executed **out of suite**, against a fixture the plan's tests do not use,
so a passing test and a passing probe are independent evidence.

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| Ungateable scope → exit 3, all 4 scope kinds, all non-source extensions | **High** — this is D1, the finding a prior fix attempt missed; a false pass here is silent CI green | **e2e probed** (out of suite, 24 combinations) | The prior cycle's guard was too narrow. A test written by the same agent that wrote the fix cannot settle whether the *surface* is covered — only an independently chosen input set can. |
| Mixed scope (source + non-source coexist) → still returns a verdict | **High** — a false positive here breaks every legitimate run | **e2e probed** | The strictness increase's blast radius. `files:`, `module:`, `diff:` all exercised with mixed inputs. |
| `--scaffold` under an ungateable scope | **High** — named in the brief; `--scaffold` is the recovery path a blocked user reaches for | **e2e probed** | Confirmed exit 0 on both a source-bearing and a source-free repo. Structurally it short-circuits in `bin/gates.cjs:15-20` before `run()`, so the guard is unreachable from it. |
| Unknown-adapter `: true` escape hatch vs. the two real adapters | **High** — an over-broad escape hatch silently reopens MF-1 | **e2e + unit probed** | See "the escape hatch is bounded" below. |
| Fresh-install rollback → destination genuinely empty | **High** — a partial install under a message claiming otherwise | **e2e probed** (5 failure points) | AC 5 pins one point (`MV_FAIL_AT=4`); I widened it to 1, 2, 4, 7, 11. |
| Plain (non-`--force`) retry after failed fresh install | **High** — the user's actual next move | **e2e probed** (all 5 points) | AC 6. |
| Overwrite-path rollback (live skills restored) | **High** — the fix must not weaken what already worked | **e2e via mutation** | Mutant E proves the restore branch is load-bearing. |
| Error precedence (bad base ref, unknown gate id, `--require-tools`, `--out <dir>`) | Medium | **e2e probed** | A guard that swallows a *more specific* error is its own defect. |
| G1 adapter divergence (task 3.2) | Medium — a characterization test, not a behaviour change | **mutation probed, no e2e** | Pure-function surface reachable by unit test; e2e would add cost without adding signal. |
| G5 string-awareness, monorepo roots, base-ref resolution | Low for *this plan* | **Excluded** | Not in this plan's diff. Covered by the existing suite; re-testing them is regression noise, and e2e is expensive. |
| Doc-only artifacts (ADR-0015, `SKILL.md`) | Low | **Excluded from e2e** | PROJECT-CONTEXT → Test tooling: verified by structural review. ADR-0015 is next in sequence after 0014, no collision, cross-references resolve. |

## E2E Tests Added

**None authored.** The plan's own e2e cases (`cli-e2e.test.cjs` ×2, `tests/install.sh` fresh-install case)
already cover the selected flows at the right boundary, and I confirmed by mutation that they are not
decorative. Adding a parallel harness would duplicate them without raising signal. What I contributed
instead is independent execution of the same flows on inputs the suite does not contain — recorded below.

### MF-1 — probe matrix (fixture: TS repo, `package.json` + `tsconfig.json`, `roots: ['src']`)

Six non-source extensions, sole scoped file, per scope kind. **Every cell exits 3, none emits `"status": "pass"`:**

| extension | `files:` | `module:` | `diff:` | `project` |
|---|---|---|---|---|
| `.css` | 3 | 3 | 3 | 3 |
| `.js` | 3 | — | — | 3 |
| `.jsx` | 3 | — | — | — |
| `.json` | 3 | — | — | 3 |
| `.scss` | 3 | — | — | — |
| `.svg` | 3 | 3 | 3 | — |

Message shape is correct per kind, including the base ref:
`scope resolved to zero gateable files (diff HEAD~1) — nothing was measured, so this run has no verdict`.

**No legitimate run newly exits 3.** Mixed scopes return their verdict:

| case | exit |
|---|---|
| `files:src/a.ts,src/theme.css` | 0, `status: pass` |
| `module:src/mixed` (`m.ts` + `m.css`) | 0, `status: pass` |
| `diff:HEAD~1` over a commit touching `m2.ts` **and** `a.css` | 0, `status: pass` |
| `project` on a repo containing any `.ts` | 0, `status: pass` |
| `--scaffold`, source-bearing repo | 0 |
| `--scaffold`, source-free repo | 0 |

Error precedence holds — the guard does not swallow a more specific fault, and the failure path writes
no side effects:

| case | reported |
|---|---|
| `--scope diff:nope-not-a-ref` over an ungateable scope | `invalid base ref` (exit 3) — base-ref error wins, correctly |
| `--gates G5` / `--gates G9` / `--require-tools` over a css-only scope | `zero gateable files` (exit 3) — guard precedes gate selection, as AC 2 requires |
| `--out .out` over a css-only scope | exit 3, **no `.out` directory created** |

### MF-1 — the escape hatch is bounded

AC 3's `sourceRe ? test : true` fallback does **not** reopen the false pass for the two real adapters.
Probed via the exported `sourcePredicate`:

- `node-ts` exports `SOURCE_FILE_RE = /\.tsx?$/`, `dart-flutter` exports `DART_FILE_RE`. Neither can reach
  the `: true` branch, so `src/theme.css`, `src/a.js`, `src/a.jsx`, `src/d.json`, `lib/m.css`, `lib/m.ts`
  are all correctly `not-source`, and `src/a.ts`, `src/a.tsx`, `lib/m.dart` are all `GATEABLE`.
- A `registerAdapter('mystery', …)` with no `SOURCE_FILE_RE` keeps its files gateable — AC 3's intent.
- I additionally probed the adjacent case the AC does not name: a **user config introducing a stack key
  with no registered adapter at all** (`deepMerge(defaults, user)` in `src/config.cjs:47` permits it). It
  also takes the `: true` branch. It does **not** produce a vacuous pass: with `gates: {}` the run exits 3
  at gate selection (`no gates left to run`), and with `gates: {G5}` the run exits 0 **having genuinely
  scanned the file** — `runG5`'s own fallback makes it scannable, so a gate really did measure it. Not a
  false pass; consistent with `runG5:25-26`. Recorded so the reviewer need not re-derive it.

### MF-2 — probe matrix (empty destination, real installer, `mv` shim)

| `MV_FAIL_AT` | installer exit | `SKILL.md` anywhere under skills dir | **all** depth-1 entries | dot-entries | stderr message | plain retry (no `--force`) |
|---|---|---|---|---|---|---|
| 1 | 1 | 0 | **0** | 0 | present | exit 0, 11/11 |
| 2 | 1 | 0 | **0** | 0 | present | exit 0, 11/11 |
| 4 | 1 | 0 | **0** | 0 | present | exit 0, 11/11 |
| 7 | 1 | 0 | **0** | 0 | present | exit 0, 11/11 |
| 11 | 1 | 0 | **0** | 0 | present | exit 0, 11/11 |

The "all depth-1 entries = 0" column is stronger than the suite's own assertion: the destination is not
merely free of `SKILL.md` and staging dot-entries, it is **genuinely empty**. AC 5 and AC 6 hold at four
failure points beyond the one the test pins.

## Coverage

Measured with `node --test --experimental-test-coverage` in
`plugins/my-skills/skills/clean-code-gates/`. PROJECT-CONTEXT → Test tooling records coverage as measured
only within this island; the shell island (`prime-agent/install.sh`) has no line-coverage tooling, and
mutation was used there instead.

| | before | after |
|---|---|---|
| **all files (line)** | **86.77 %** | **86.77 %** |
| all files (branch) | 85.58 % | 85.58 % |
| all files (funcs) | 92.52 % | 92.52 % |

Before = after: **no coverage-floor tests were needed**, so none were added. 86.77 % is comfortably above
the 70 % floor and no path in this plan's diff is under-covered.

Per-module, restricted to this plan's change sites:

| module | line % | branch % | note |
|---|---|---|---|
| `src/run.cjs` (MF-1 change site) | **100.00** | 82.61 | `sourcePredicate` + `assertNonEmptyScope` both fully covered, **including the `: true` fallback branch** (proved by mutant D) |
| `src/scope.cjs` | 100.00 | 85.71 | `fileStack` reached by the predicate |
| `src/gates/registry.cjs` | 100.00 | 85.00 | |
| `src/gates/g5-no-comments.cjs` | 100.00 | 96.10 | |
| `src/adapters/node-ts.cjs` | 58.36 | 65.45 | task 3.2's line 246 **is** covered; the uncovered mass is external-tool shell-out (eslint/jest/stryker), untouched by this plan |
| `src/adapters/dart-flutter.cjs` | 64.80 | 82.02 | same — untouched by this plan |

The two adapters sit below 70 % individually. **No tests were added for them**: their uncovered lines are
subprocess-invocation paths for tooling not installed in this repo, none of them is in this plan's diff,
and manufacturing coverage there would be exactly the vacuous-green pattern this plan exists to close.
The floor is an aggregate floor and the aggregate clears it.

## Test-Quality Audit

Assertion quality across the coder's new tests is **high**. No empty assertions, no tautologies, no
assertion-free tests. Message shapes are pinned rather than substring-matched — SF-4's `/module/` →
`/zero gateable files \(module\)/` tightening is exactly right, and SF-2's near-vacuous
`doesNotMatch(stdout, /"status": "pass"/)` on a path that writes no stdout was correctly swapped for a
real `stderr` assertion with two surviving controls.

### Mutation probe — are the regression tests load-bearing?

Five mutants injected into the delivered code. **All five killed.**

| # | mutant | result |
|---|---|---|
| A | `assertNonEmptyScope` reverted to `if (scope.files.length) return;` (pre-fix MF-1) | **6 tests red** — 4 scope-kind cases, the CLI e2e case, and the direct guard case |
| B | node-ts G1 narrowed to `if (!TS_FILE_RE.test(rel)) return [];` (would close the divergence) | **1 test red** — task 3.2's case |
| C | dart-flutter G1 stops filtering `DART_FILE_RE` | **3 tests red**, task 3.2's case among them |
| D | `sourcePredicate` fallback flipped `: true` → `: false` | **5 tests red**, including the `bare-stack` fallback case |
| E | `install.sh` guarded restore removed (unconditional `rm -rf` only) | **red**: `a failed mv (call 5) left 9 of 11 skills installed` |

B and C together settle the brief's question about task 3.2: the divergence test is **genuinely
two-sided** — it dies if node-ts stops scoring *or* if dart-flutter starts. It cannot be satisfied by
parity in either direction, as the plan required.

### MF-2 regression test confirmed red pre-fix — independently

I reverted **only** the four-line `rollback` body to its pre-fix shape and ran the suite:

```
a failed fresh install left 3 skills behind
PRE-FIX TEST EXIT: 1
POST-FIX TEST EXIT: 0
```

The CR's exact number. The file was restored byte-for-byte afterwards (md5 verified against a
pre-revert backup; `git status` shows only the coder's own modification).

### AC 12 — the README sentence the coder changed

The brief asks whether the new text matches actual behaviour. **It does.** I did not read the claim — I
re-derived both halves from a pre-feature baseline binary (guard stripped entirely, run in a fixture repo):

| claim in the new sentence | measured |
|---|---|
| "…used to exit 0 with `status: "pass"` — with `gatesRun: []` when nothing resolved at all" | exit 0, `summary.status = pass`, `gatesRun = []`, `scope.files = []` ✅ |
| "…and with a *named* `gatesRun` when files did resolve under a stack root but every gate filtered them back out (a `src/theme.css`-only diff, say)" | exit 0, `status: "pass"`, **`gatesRun: ["G5"]`** ✅ |
| "it applies to every scope form (`diff:<ref>`, `files:`, `module:<path>`, `project`)" | all four exit 3 ✅ (matrix above) |

The sentence the coder replaced claimed only the `gatesRun: []` shape, which **understated** the harm and
would have left the README describing a bug it no longer had. The correction was warranted.

**Procedural note for the reviewer.** AC 12's literal escape clause is narrower than the change taken —
it permits an edit "unless the code's message or exit code moved", and neither moved. The coder edited on
the broader ground that the sentence was false. I judge the edit **correct on the merits and in the spirit
of AC 12** (which exists to keep the prose *true*), and the new text is verified accurate above. Flagging
it as a deviation for the reviewer to ratify explicitly rather than to discover.

### Weak tests found

Three minor items. **None blocks; none is a false-green risk.**

1. **`run.test.cjs` — registry mutation without teardown.** `test('a stack whose adapter exports no
   SOURCE_FILE_RE keeps its files gateable')` calls `registerAdapter('bare-stack', …)` against the
   module-level `ADAPTERS` and never removes it. Harmless today — `bare-stack` collides with nothing — but
   it leaks into every later test in the file, so a future test asserting the *converse* would become
   order-dependent. A teardown (or a locally-constructed registry) would close it.
2. **`cli-e2e.test.cjs:123-124` — redundant assertion pair.** `assert.notStrictEqual(r.status, 0)` is
   immediately subsumed by `assert.strictEqual(r.status, 3)`. Not vacuous, just noise.
3. **`prime-agent/tests/install.sh` — single failure point.** The fresh-install case pins `MV_FAIL_AT=4`
   only. My probe at 1, 2, 7 and 11 shows the fix is correct at all of them, but the *suite* would not
   catch a regression that only broke the first or last iteration. A loop over 2-3 points would cost
   almost nothing and would match the shape the overwrite cases already use (`for fail_at in 5 6`).

### Residual observation (not a defect)

The strictness increase is **broader than the README's headline example**. The prose leads with "a
docs-only pull request", but the guard also newly fails a pull request touching only `.js`, `.jsx`,
`.json`, `.css`, `.scss` or `.svg` **under a TypeScript stack root** — files that are not docs. The
explanatory paragraph does cover it ("no gateable source file", with the `src/theme.css` example), so the
document is not wrong, only front-loaded with the gentler case. Worth a reviewer's eye on whether the
headline should name the broader set. Note that a **pure-JavaScript** project is unaffected: `detect.cjs`
requires both `package.json` **and** `tsconfig.json` to register the `node-ts` stack, so such a repo
resolves no stack and already exited 3 before this change.

## Verdict

**PASS.**

| gate | result |
|---|---|
| `cd plugins/my-skills/skills/clean-code-gates && node --test` | exit 0 — **206/206** (≥ the 197 the CR recorded) |
| `cd prime-agent && npm test` | exit 0 (`tests/install.sh` + `tests/parity.sh`) |
| `node scripts/build-prime-agent.mjs --check` | exit 0 — `prime-agent/skills is up to date (11 skills, 154 files)` |
| generated tree runs its own suite | `prime-agent/skills/clean-code-gates` → **206/206** |
| generated ≡ source | `src/run.cjs` and all five touched test files byte-identical between plugins source and generated copy |
| line coverage | 86.77 % ≥ 70 % floor; MF-1 change site 100 % |
| mutation probe | 5/5 mutants killed |

MF-1 (my D1) and MF-2 are both genuinely closed, verified on inputs the suite does not contain. The
worktree was restored to the coder's exact state after every mutation probe. `prime-agent/skills/**` was
not hand-edited at any point during testing.

Ready for the reviewer.
