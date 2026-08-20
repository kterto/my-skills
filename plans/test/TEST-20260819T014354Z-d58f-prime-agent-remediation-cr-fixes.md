---
id: TEST-20260819T014354Z-d58f
plan: FIX-20260819T012309Z-b208
title: Test Report — Prime Agent remediation CR fixes
status: PASS
created_at: 2026-08-19T01:52:00Z
cycle: 1
---

**Related:** [FIX-20260819T012309Z-b208](../code-review/FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md) · [CR-20260819T010844Z-f9ea](../code-review/CR-20260819T010844Z-f9ea-prime-agent-distribution-review-remediation.md) · [TEST-20260819T005959Z-4591](./TEST-20260819T005959Z-4591-prime-agent-distribution-review-remediation.md)

## Summary

All three gates are green and independently re-run: `clean-code-gates` **197 pass / 0 fail** (floor 180), `node scripts/build-prime-agent.mjs` then `--check` both exit 0, `cd prime-agent && npm test` exit 0. Source-only line coverage **75.16% → 75.39%**, above the 70% floor.

I verified every Must Fix against the real binary and the real generated tree rather than on report. **MF-2, MF-3 and MF-4 are fully closed.** **MF-1 is closed on its reported reproduction and materially narrowed, but a reachable residual remains** — the guard tests the wrong predicate, so a change confined to non-source files that live *inside* a stack root (`src/theme.css`, `src/README.md`, any `.js`/`.json`/`.scss` under `src/`) still exits 0 with `status: "pass"` having measured nothing. That is the same harm class MF-1 named, and the README now documents a stronger guarantee than the code delivers.

I also assessed the asymmetry the coder flagged deliberately (`node-ts.cjs:246` vs SF-7b's `dart-flutter.cjs:210`). **It is a real behavioural divergence, not cosmetic**, and the test suite's shared parameterized loop makes the divergence read as symmetry.

Per my contract I did not fix either — both are reproduced below with exact commands for the reviewer to route.

Mutation-style spot checks confirm the new tests are genuine regression tests rather than tests that merely pass: reverting each fix in a scratchpad copy turns the corresponding tests red. **One exception** — the two tests carrying MF-2's name (`gate-selection.test.cjs:88-98`) pass identically with a *valid* gate id substituted, so they exercise the empty-scope guard, not gate selection. The behaviour they assert is correct; the coverage they appear to give is not there.

## Flows Triaged

This is a review-fix cycle. Criticality = user impact × breakage likelihood × not-covered-by-unit. Every high-criticality flow in this diff already gained passing e2e coverage from the coder in this same cycle, so the tester's marginal value here is **independent reproduction against the real binary and the real generated tree**, not duplicate e2e. Each inclusion and exclusion is justified.

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| **F1 — Empty-scope guard: CLI exit code + message, all four scope kinds** (AC 1, 2, 3, 5) | **High** (impact H × likelihood H × was-uncovered H) | **VERIFIED, no new e2e** | `cli-e2e.test.cjs:126` and `gate-selection.test.cjs` now carry CLI-level `spawnSync` cases pinning the message (`/zero gateable files/i`), and `run.test.cjs:32-52` covers all four scope kinds at `run()` level. Adding a seventh CLI case would duplicate. I instead re-ran all four kinds plus five controls against `bin/gates.cjs` in a throwaway git repo I built myself — see *Independent reproductions*. **This is where the residual defect surfaced.** |
| **F2 — G5 `++`/`--` digraph lexing** (AC 6) | Med | **VERIFIED, no new e2e** | Unit is the right altitude for a lexer, and `g5-inline.test.cjs` is now 27 tests. e2e would add process overhead and prove nothing extra. I probed `scanNoComments` directly with 12 inputs — the 6 the plan names plus 6 of my own (`n = -x / 2`, `a - /re/.test(s)`, `x = y++ / z / 2`, `/a\/\/b/.test(s)`, `"http://x"`, `a = b / c`). All 12 correct. |
| **F3 — Prime concurrent-wave child addressability** (AC 7, 8) | **High** | **VERIFIED structurally against the GENERATED tree** | Not executable — prose. `--check` passing proves the overlay applied, not that the emitted text is right, so I read the generated `prime-agent/skills/orchestrator/SKILL.md` directly. Three distinct `name` literals at 874 / 934 / 971, each anchored under its own `description`. See *MF-4* below. |
| **F4 — Installer atomicity + mid-loop rollback** (SF-4/SF-4b) | High | **EXCLUDED — already a genuine e2e** | `prime-agent/tests/install.sh:77-113` injects a failing `mv` via a fake binary on `PATH` at two distinct call indices, then asserts all 11 skills survive **with their `PREEXISTING` marker files intact** and no `.old-*` residue. That is real filesystem state, not an exit code. Re-run green. Duplicating it would not extend it. |
| F5 — `--out <dir>` artifact contract under the new guard | Med | **VERIFIED, no new e2e** | New interaction worth one check: does a run that throws leave a half-written report? It does not — `--scope files: --out ./.cleancode` exits 3 and creates no `.cleancode` directory. An unmeasured run has no artifact, which is the correct shape. |
| F6 — Builder regeneration idempotence (AC 9) | Med | **VERIFIED, no new e2e** | Ran the full builder (`rmSync` + rewrite, 11 skills / 154 files) then `--check`; both exit 0 and the working-tree dirty set is unchanged, proving the committed generated tree is exactly what the builder produces. |
| F7 — `opencode-port-parity` (AC 12) | Low | **EXCLUDED — untriggered** | No plugins-side change landed in `pr-review-report/` or `spec-driven-eval/`, and no `.opencode/` file is dirty. V4 is a no-op this cycle, as the plan predicted. |
| F8 — Doc-skill prose (SF-1, SF-2, SF-3a/b/c, SF-5, SF-6, SF-8a/b) | N/A | **EXCLUDED — not executable** | `PROJECT-CONTEXT.md` → Test tooling mandates structural review for doc-skill changes. Covered by the exit-code documentation check below and left to the reviewer otherwise. |
| F9 — Adapter G1 coverage semantics (`node-ts.cjs:246` vs `dart-flutter.cjs:210`) | Med-High | **PROBED, not e2e** | The orchestrator asked me to assess this divergence. Adapter-internal, called per scoped file — unit altitude. I probed `nodeTs.fileCoverageFindings` directly across 6 file kinds × entry/no-entry. Finding below. |

## E2E Tests Added

**None — deliberately, and the reason is load-bearing rather than a shortfall.**

Every high-criticality flow in this diff acquired passing e2e coverage from the coder *in this cycle*: the empty-scope CLI reproduction (`cli-e2e.test.cjs`), the two empty-scope `--gates G9` CLI cases (`gate-selection.test.cjs`), and the mid-loop rollback case (`prime-agent/tests/install.sh`). The prior cycle's gap — no empty-scope fixture anywhere in 180 tests — is closed by the reusable `__tests__/fixtures/empty-scope.cjs`. e2e is expensive; a seventh `spawnSync` over the same code path buys nothing.

The two tests this diff *should* additionally have are both tests that **would fail today**, because each pins a defect rather than a fix:

1. `--scope diff:HEAD~1` where the only changed file is `src/theme.css` → must exit 3, currently exits 0.
2. `node-ts: a non-TS file carrying a coverage entry is not scored` → must return `[]`, currently returns 4 blocker findings.

Committing a red suite would block the pipeline on defects that are better routed to a fix plan, so I recorded them as reproductions instead. **Each should land as the regression test of its fix, with the exact input given below.**

## Coverage

Command (run from `plugins/my-skills/skills/clean-code-gates`):

```
node --test --experimental-test-coverage --test-coverage-exclude='__tests__/**'
```

The exclusion is what makes the number honest — without it the test files count themselves and inflate the total.

| Metric | Before | After | Floor |
|---|---|---|---|
| **Line** | **75.16%** | **75.39%** | 70% ✅ |
| Branch | 81.79% | 82.19% | — |
| Functions | 83.52% | 83.61% | — |
| Test count | 180 | **197** | ≥ 180 ✅ (AC 10) |

> **Caveat on "before".** The pre-FIX tree is not cleanly recoverable — the working tree carries 85 uncommitted entries spanning both the parent FEAT and this FIX, so there is no commit to measure against. The *Before* column is quoted from `TEST-20260819T005959Z-4591`, which measured the tree this plan started from. The *After* column I measured this session. Stated rather than glossed.

Per-file movement on the touched modules:

| File | Before | After |
|---|---|---|
| `src/run.cjs` | 100.00% line / 79.41% branch | 100.00% line / **82.93%** branch |
| `src/gates/g5-no-comments.cjs` | 100.00% line | 100.00% line / **96.10%** branch |
| `src/adapters/dart-flutter.cjs` | 64.80% | 64.80% |
| `src/adapters/node-ts.cjs` | 58.36% | 58.36% |

No unit tests added: the floor is met with 5.4 points of margin, and the remaining drag is the same one the prior report characterised — the G2/G4/G6/G7 tool-invocation paths in the two adapters, which need jest, vitest, ESLint, Stryker, dependency-cruiser and the Dart toolchain installed in a fixture project. That is a sizeable standalone piece of work, out of proportion to this plan's diff, and it remains a backlog candidate rather than a gap this report should close.

## Independent verification of each Must Fix

I rebuilt the fixtures myself rather than reusing `__tests__/fixtures/empty-scope.cjs`, so a fixture defect could not mask a code defect.

### MF-1 / MF-2 — empty scope (CLOSED on the reported reproduction; residual below)

Throwaway git repo: `src/a.ts` committed, second commit touches only `docs/note.md`.

| Command | Exit | stderr |
|---|---|---|
| `--scope diff:HEAD~1 --out -` | **3** | `scope resolved to zero gateable files (diff HEAD~1) — nothing was measured, so this run has no verdict` |
| `--scope files: --out -` | **3** | `… (files) …` |
| `--scope module:docs --out -` | **3** | `… (module) …` |
| `--scope files: --gates G9 --out -` | **3** | empty-scope message |
| `--scope module:docs --gates G9 --out -` | **3** | empty-scope message |
| `--scope files:docs/note.md --out -` | **3** | `… (files) …` |
| *control* `--scope files:src/a.ts --gates G9 --out -` | 3 | `unknown gate id(s): G9 — known gates are G1…G7` |
| *control* `--scope files:src/a.ts --gates G5 --out -` | 0 | valid report, `status: pass`, `gatesRun: ["G5"]` |
| *control* `--scaffold` in a docs-only project | 0 | advice banner, no run attempted — **the guard does not break the scaffold path** |

AC 1's message contract holds: the kind is named, `baseRef` appears where one applies, and *"nothing was measured"* is stated. AC 2's placement holds — `assertNonEmptyScope` is a separate function called between `resolveScope` and `resolveGatePlan` (`src/run.cjs:59-72`), and `resolveGatePlan`'s `if (!plan.length) return plan;` is structurally untouched.

**One consequence worth the reviewer's eye, not a defect:** on an empty scope the guard fires *before* gate selection, so `--scope files: --gates G9` reports the empty scope and never mentions the unknown gate id. AC 3 only requires exit 3, which holds, and AC 2 mandates exactly this ordering. It is the right trade — the scope is the deeper cause — but a caller with two mistakes only learns about one per run.

### MF-3 — G5 `++` / `--` digraphs (CLOSED)

`startsRegex` now short-circuits on `trimmed.endsWith('++') || trimmed.endsWith('--')` before the `REGEX_PRECEDERS` lookup; `+` and `-` remain in the set (`g5-no-comments.cjs:15,49`). Direct probe of `scanNoComments`, 12 inputs, **0 failures**:

| Input | Expected | Got |
|---|---|---|
| `i++ / 2; // c` | flag | flag ✅ |
| `i-- / 2; // c` | flag | flag ✅ |
| `x = y++ / z / 2; // trailing` *(mine — two slashes after a digraph)* | flag | flag ✅ |
| `const x = a + b / c; // c` | flag | flag ✅ |
| `const x = a - b / c; // c` | flag | flag ✅ |
| `const t = a * b / c; // m` | flag | flag ✅ |
| `n = -x / 2; // c` | flag | flag ✅ |
| `const a = b / c; // ratio` | flag | flag ✅ |
| `const ok = a + /re/.test(s);` | clean | clean ✅ |
| `const ok2 = a - /re/.test(s);` *(mine)* | clean | clean ✅ |
| `const r = /a\/\/b/.test(s);` *(mine)* | clean | clean ✅ |
| `const s = "http://x";` *(mine)* | clean | clean ✅ |

The negative controls that a naive removal of `+`/`-` from `REGEX_PRECEDERS` would have broken all stay clean. Complexity of `startsRegex` after the change: **6** decision points (AC 11's ≤ 10 holds; see *Complexity* below).

### MF-4 — Prime concurrent-wave child names (CLOSED, symptom and root cause)

`--check` exiting 0 proves the overlay applied; it does not prove the emitted text is right. I read the generated tree.

`prime-agent/skills/orchestrator/SKILL.md` — every `- \`name\`:` bullet in the file, with its anchor:

| Line | Site | `description` | `name` |
|---|---|---|---|
| 874 | 2s.2 — one architect per sub-split lane, concurrently | `Contract sub-lanes of {lane}` | `architect:{lane}` |
| 934 | 2L — one architect per leaf, concurrently | `Plan lane {qualified leaf name}` | `architect:{qualified leaf name}` |
| 971 | 3L — one coder per leaf, concurrently | `Implement lane {qualified leaf name}` | `coder:{qualified leaf name}` |

Three, and only three, `name` bullets exist; all three are distinct. The fourth `description` bullet in the file (`:496`, *Slice spec into lanes*) is the single read-only scan spawn — **exactly one** child, so the protocol block's fallback at `:167` (*"Where a step below lists a `description`, use it as that child's `name` when no lane-qualified name is given"*) covers it without ambiguity. That fallback still reads correctly.

**Cross-wave collision is impossible too**, which the plan did not claim but which addressability actually requires. `:940` states a hard barrier — *"all of Step 2s, then all of Step 2L, then all of Step 3L"* — and explicitly declines to overlap 2L with 2s. The three waves never coexist, so `receiver_name=handle.name` addresses exactly one child at every site.

**Root cause (AC 8) closed.** Overlay replacements 11, 12, 13 in `prime-agent/overlays/orchestrator.json` each carry `count: 1` and each `find` includes its preceding `` - `description`: … `` line, so no replacement text can be reused across sites. Sweeping every `find`/`count` pair across all 9 overlays, the only surviving `count > 1` entries are:

| Overlay | `find` | count | Has `why`? |
|---|---|---|---|
| `commit-pr.json` | `':(exclude).claude'` | 4 | ✅ git pathspec — site-independent |
| `orchestrator.json` | `':(exclude).claude'` | 3 | ✅ same |
| `orchestrator.json` | `the call shape from *How to spawn a subagent*` | 3 | ✅ section-name cross-reference — site-independent |
| `product-manager.json` | `':(exclude).claude'` | 2 | ✅ same |

None address dispatch, role identity, or child naming. AC 8 holds.

**Plugins side untouched (as required):** `git diff` on `plugins/my-skills/skills/orchestrator/SKILL.md` changes no `- \`name\``/`- \`description\``/`- \`subagent_type\`` line, and `subagent_type: architect|coder` remains at `:836`, `:896`, `:933`. This is a Prime-port-only adaptation, correctly.

### Documentation vs actual behaviour (AC 5)

All three publishing places carry the new cause and the wording is consistent:

- `README.md:152` — exit-code table row 3 includes *"or a scope that resolved to zero gateable files"*.
- `README.md:23` — the `--scope` flag row: *"a scope that resolves to **zero gateable files** is a usage error (exit 3), not an empty `pass`"*.
- `SKILL.md:33` — *"`3` usage/config error, including a scope that resolved to zero gateable files"*.
- `README.md:155-159` — a dedicated *Behaviour change* section stating the docs-only-PR consequence for CI callers, and recording `--allow-empty-scope` as deferred, not refused.

Neither file claims an exit code the code does not produce. **But `README.md:157` claims a guarantee the code does not deliver** — see finding D1.

## Test-Quality Audit

Scan of the tests this cycle added or changed.

**No tautologies, no assertion-free tests, no truthy-only checks.** Assertion quality is high and the shapes are right for what they test:

- `run.test.cjs:32-52` pins the *message*, not just the throw — `/zero gateable files/i`, `/module/`, `/diff/` + `/HEAD~1/` + `/nothing was measured/i`. All four scope kinds covered, and `:53` is a paired positive control (a non-empty scope still returns a verdict).
- `cli-e2e.test.cjs:126` asserts the CLI-level stderr message, not merely a non-zero exit.
- `prime-agent/tests/install.sh:77-113` asserts real filesystem state after an injected `mv` failure — 11 surviving skills, `PREEXISTING` markers intact, zero `.old-*` residue — at two distinct failure indices. Exit codes alone would have been much weaker.
- `g5-inline.test.cjs` keeps the digraph cases as their own tests rather than broadening the pre-existing *"a division is not mistaken for a regex"*, so a future refactor cannot collapse them, and the `const ok = a + /re/.test(s);` negative control is present.

**Three weak spots found — the first two are the same failure mode the prior cycle diagnosed: a test aimed at the right property whose input sits one step beside the defect.**

### W1 — `run.test.cjs:47-52` proves an empty *directory*, not an empty *gateable set*

```js
test('an empty project: scope is caught by the same guard', () => {
  const d = docsOnlyProject();
  fs.rmSync(path.join(d, 'src', 'a.ts'));        // ← leaves src/ completely empty
  assert.throws(() => invoke(d, { kind: 'project' }), /zero gateable files/i);
});
```

Deleting the only file under the stack root makes `projectFiles` return `[]`, so the guard fires on an empty *list*. The property AC 1 actually claims is *zero **gateable** files* — a root that still holds `src/README.md` or `src/theme.css`. Change `rmSync` to `writeFileSync(path.join(d,'src','x.css'), '.a{}')` and this test goes red. It is a correct test of a weaker property, and it is the reason D1 shipped.

### W2 — `g1-absent-coverage.test.cjs` makes an asymmetry look like symmetry

Lines 8-45 run five identical cases over both adapters via a shared `CASES` loop, which reads as full parity. But the loop only ever passes `entry: undefined`, which is precisely the argument for which the two adapters agree. The one case where they disagree is tested for **one adapter only**:

```js
test('dart-flutter: a non-Dart file carrying an lcov entry is not scored', () => { … });
// ← no node-ts counterpart exists, and one written today would fail
```

The missing counterpart is finding D2.

### W3 — the two MF-2 tests do not exercise gate selection at all

`gate-selection.test.cjs:88-98`, with the comment at `:85-87` attributing the failure to `resolveGatePlan`'s early return:

```js
test('an unknown gate id on an empty files: scope still exits 3', () => {
  const r = cli(docsOnlyProject(), ['--scope', 'files:', '--gates', 'G9', '--out', '-']);
  assert.strictEqual(r.status, 3);
  assert.doesNotMatch(r.stdout, /"status": "pass"/);
});
```

`assertNonEmptyScope` fires at `run.cjs:74`, **before** `resolveGatePlan` is ever called, so `--gates G9` is never evaluated — swapping `G9` for the perfectly valid `G5` leaves both tests green. They assert only the status and a `doesNotMatch` on stdout that is near-vacuous (the error path exits before writing any stdout). They are duplicates of `run.test.cjs:32-38` wearing a gate-selection name, and the comment above them describes a mechanism that is not what makes them pass.

**This is a test-accuracy problem, not a behaviour problem** — AC 2 mandates exactly this ordering and AC 3 only requires exit 3, both of which hold. But it means the *gate-selection* behaviour on an empty scope is untested, and the tests read as coverage that does not exist. Fix: assert `/unknown gate id/i` on stderr (which fails today, correctly documenting that the ordering was never changed), or rename the tests and drop the stale comment.

Related observation: with the guard in place, `resolveGatePlan`'s `if (!plan.length) return plan;` (`run.cjs:48`) is now **unreachable** — `scope.stacks` is derived from `scope.files`, so an empty plan implies an empty scope, which now throws upstream. AC 2 deliberately retained it and there is no reason to remove it, but it is defensive rather than live, and a future reader should not infer otherwise from the test comment above.

### Other weak assertions worth recording (mostly pre-existing)

- `run.test.cjs:37` — `assert.throws(…, /module/)` under the name *"the message names the scope kind"*. Over-broad: `/module/` also matches `Cannot find module` / `MODULE_NOT_FOUND`, so a require-path break would read as a pass. Pin `/zero gateable files \(module\)/`.
- `cli-e2e.test.cjs:123` — `notStrictEqual(r.status, 0)` is dead weight next to `:124`'s `strictEqual(r.status, 3)`; `:125`'s `doesNotMatch(stdout, /"status": "pass"/)` is near-vacuous on a path that writes no stdout. `:126` (`/zero gateable files/i` on stderr) is the assertion carrying the test.
- `prime-agent/tests/install.sh:35` (`*".prime"*`) and `:58` (`*"/agent"*`) — both patterns are satisfied by the installer's own usage banner (`install.sh:9`), so an arg-parsing regression that turned `--project PATH` into an unknown option would keep both symlink-containment tests green. Pin the refusal prefix (`Refusing to install: destination path component is a symlink:`). Pre-existing, not from this cycle.
- `prime-agent/tests/install.sh:47` — unlike its siblings at `:38` and `:61`, this one checks only that the attacker-chosen `outside` directory still exists, never that it stayed **empty**. Pre-existing.
- `prime-agent/tests/install.sh:103` — stderr is discarded, so the user-facing *"Install failed — the destination was restored to its previous state."* (`install.sh:126`) is never asserted. The `fail_at` values `5`/`6` are magic numbers encoding "2 `mv` calls per skill, 3rd skill"; if the loop's per-skill call count changes they will still land mid-loop but will stop exercising the two distinct branches the comment describes.
- `g1-absent-coverage.test.cjs:83` — *"scored exactly as before"* but the body only does `findings.some(…)`, never pinning the count, unlike its node-ts twin at `:75`. A spurious extra finding would pass.
- `fixtures/empty-scope.cjs:29-43` neutralises `commit.gpgsign`, `user.name` and `user.email` but not `core.hooksPath` / `init.templateDir`; a developer with global git hooks could make `docsOnlyCommitRepo()` behave unpredictably. `GIT_CONFIG_GLOBAL=/dev/null` or `git init --template=` would close it.

### Mutation-style spot checks (fix reverted in a scratchpad copy, source left byte-identical)

To distinguish real regression tests from tests that merely pass:

| Fix reverted | Result |
|---|---|
| `assertNonEmptyScope` deleted | `run.test.cjs:32,36,40,48` **and** `cli-e2e.test.cjs:119` fail — genuine |
| `endsWith('++') \|\| endsWith('--')` short-circuit removed | `g5-inline.test.cjs:78,83` fail (25 pass / 2 fail) — genuine |
| `runG5`'s `SOURCE_FILE_RE` filter removed | `g5-inline.test.cjs:138` fails — genuine |
| atomic `mv`-aside commit loop reverted to `rm -rf` | `install.sh` SF-4 case fails: *"a failed mv (call 5) left 10 of 11 skills installed"* — genuine, and both `fail_at` iterations exercise distinct rollback branches |
| `--gates G9` swapped for the valid `--gates G5` in `gate-selection.test.cjs:88-98` | both tests still pass — **not genuine**, see W3 |

`git diff --stat` confirms `prime-agent/install.sh` and `plugins/my-skills/skills/clean-code-gates/**` are unchanged by this audit.

## Known-open defects — reproduced, not fixed

### D1 — the empty-scope guard tests the wrong predicate; a non-source-only change under a stack root still exits 0 `pass`

**Severity: medium-high.** MF-1's own reproduction is closed. This is a distinct, reachable path to the same harm.

`src/scope.cjs:145` keeps a file when `fileStack(f, cfg) && !isExcluded(f, cfg)` — i.e. when it sits **under a stack root** — not when it matches that stack's `SOURCE_FILE_RE`. `assertNonEmptyScope` then tests `scope.files.length`. So any non-source file inside `src/` (node-ts) or `lib/` (dart) keeps the scope "non-empty" while every gate filters it back out.

Reproduction — git repo, `src/a.ts` in commit 1, **only** `src/theme.css` in commit 2:

```
$ node bin/gates.cjs --scope diff:HEAD~1 --out -
exit 0
{"scope":{"kind":"diff","files":["src/theme.css"],"stacks":["node-ts"],"baseRef":"HEAD~1"},
 "summary":{"status":"pass","gatesRun":["G5"],"gatesMissingTool":["G1","G2","G4","G6","G7"],
            "gatesErrored":[],"blockers":0,"warnings":0}}
```

`gatesRun: ["G5"]` — G5 "ran" and scanned zero files, because `runG5` (`src/run.cjs:25`) filters by `SOURCE_FILE_RE` *inside* the gate. Same result for `src/README.md`, and for `--scope project` on any tree whose stack root holds only non-`.ts` files.

Breadth matters here: node-ts's `SOURCE_FILE_RE === TS_FILE_RE === /\.tsx?$/` (`node-ts.cjs:72,730`), so **`.js`, `.jsx`, `.json`, `.css`, `.scss`, `.svg`, `.snap`, `.graphql` under `src/` all qualify.** A pure-CSS or pure-JS pull request in a React+TS repo run under `--scope diff:origin/main` exits 0 having measured nothing — a strictly more common shape than the docs-only case MF-1 named.

This also makes `README.md:157` inaccurate: *"it applies to every scope form (`diff:<ref>`, `files:`, `module:<path>`, `project`)"* is not true for any file under a stack root, and `project` is the weakest of the four.

**Suggested fix shape** (one line, no new mechanism): have `assertNonEmptyScope` test files that at least one scoped stack's adapter considers source, e.g. count `scope.files.filter(f => (ADAPTERS[fileStack(f,cfg)]||{}).SOURCE_FILE_RE?.test(f))`. Both adapters already export `SOURCE_FILE_RE` and `run.cjs` already reads it at `:25`. Regression test: the `src/theme.css` diff above.

**Adjacent, lower priority:** `--scope project` on a package whose declared root does not exist at all exits 3 with a raw `ENOENT: … scandir '…/src'` rather than the guard's message — exit code right, message does not name the scope kind as AC 1 requires. Pre-existing in `realListFiles`, not introduced here.

### D2 — SF-7b closed the coverage widening for dart and left it open for node-ts

**Severity: medium.** This is the asymmetry the coder flagged deliberately rather than fixing without a task. **It is a real behavioural difference, not cosmetic.**

```js
// src/adapters/node-ts.cjs:246
if (!entry && !TS_FILE_RE.test(rel)) return [];
// src/adapters/dart-flutter.cjs:210
if (!DART_FILE_RE.test(rel)) return [];
```

The `!entry &&` makes the skip conditional. A non-source file that *does* carry a coverage entry is scored by node-ts and skipped by dart. Probed directly (`thresholds` all 80, entry at 10%):

| `rel` | node-ts, **with** entry | node-ts, no entry | dart equivalent |
|---|---|---|---|
| `src/a.ts` | 4 findings | 4 findings | — |
| `src/a.js` | **4 findings** | 0 | 0 |
| `src/a.jsx` | **4 findings** | 0 | 0 |
| `src/styles.css` | **4 findings** | 0 | 0 |
| `src/fixture.json` | **4 findings** | 0 | 0 |
| `src/README.md` | **4 findings** | 0 | 0 |

These are `severity: blocker` findings — exit 1.

The divergence is not defensible as "node-ts has a second source language", because the adapter itself does not think so: `SOURCE_FILE_RE` is *aliased to* `TS_FILE_RE` (`node-ts.cjs:730`), so G5 skips `.js`, and `:399` gates G2/G4 on `TS_FILE_RE` too. **G1 is the only gate in the adapter that scores a file the same adapter defines as non-source**, and only when an entry happens to exist. Reachability is real: jest/babel-jest instruments `.js`/`.jsx` by default, so any mixed JS/TS repo hits it.

The backward-compat argument that justified SF-7b applies identically — the `!entry &&` gating was introduced by the parent plan's absent-coverage change, per the comment at `g1-absent-coverage.test.cjs:48-50`. Closing it for dart and not node-ts leaves the widening half-open.

**Suggested fix:** `if (!TS_FILE_RE.test(rel)) return [];`, mirroring dart. Regression test: the missing `node-ts:` counterpart to `g1-absent-coverage.test.cjs:51`, which would fail today.

## Complexity (AC 11)

`node_modules` is not installed in the skill directory, so ESLint/G2 cannot be invoked; measured statically by counting decision points.

| Function | Decision points | ≤ 10? |
|---|---|---|
| `run()` (`src/run.cjs:73`) | 9 — 2 loops, 3 ternaries, 1 `&&`, 2 `\|\|`, base 1 | ✅ **unchanged at 9** |
| `assertNonEmptyScope()` (`:66`) | 2 | ✅ |
| `startsRegex()` (`g5-no-comments.cjs:44`) | 6 (was 5) | ✅ |

The guard was extracted into its own function specifically so `run()` would not grow — the plan asked for exactly this and the coder did it. AC 11 holds.

## Gate results

| Gate | Command | Result |
|---|---|---|
| V1 | `cd plugins/my-skills/skills/clean-code-gates && node --test` | **exit 0** — 197 pass / 0 fail (floor 180) |
| V2 | `node scripts/build-prime-agent.mjs` then `--check` | **exit 0 / exit 0** — 11 skills, 154 files; dirty set unchanged after regeneration, so the committed generated tree is exactly what the builder produces |
| V3 | `cd prime-agent && npm test` | **exit 0** — `install.sh` (preflight, containment, all-or-nothing, mid-loop rollback) + `parity.sh` |
| V4 | opencode-port-parity | **untriggered** — no plugins-side change in `pr-review-report/` or `spec-driven-eval/`, no `.opencode/` file dirty |
| V5 | structural review | exit-3 cause consistent across `README.md` and `SKILL.md`; **but see D1** — `README.md:157` overstates the guarantee |

## Verdict

**PASS** — all e2e green, coverage 75.39% ≥ 70% floor, test count 197 ≥ 180, all three executable gates exit 0.

The PASS is mechanical and it is narrower than the coder's summary implies. It certifies that what the suite measures is green and that the floor is met, and it certifies **MF-2, MF-3 and MF-4 as genuinely closed** on independent reproduction — MF-4 including the root-cause anchoring the plan asked for, verified in the generated tree rather than on `--check`. It does **not** certify MF-1 as fully closed: AC 1's stated property ("zero gateable files, every scope kind") is met for files outside a stack root and unmet for files inside one, which is the more common shape.

Recommended handoff to the reviewer:

1. **D1 is the item to route.** It is the same harm MF-1 named, on a broader trigger, and the README currently promises the guarantee the code does not deliver. One-line fix, one regression test, plus a one-clause README correction.
2. **D2** — close the node-ts side of the SF-7b widening for symmetry with dart. Two-word code change, one test.
3. **W1 / W2** — strengthen the two tests whose inputs sit beside the defects; each becomes the regression test for D1 / D2 respectively.
4. **W3** — either add `/unknown gate id/i` to `gate-selection.test.cjs:88-98` (it will fail, correctly documenting that the ordering was never changed and that the empty-scope guard is what closes MF-2) or rename the tests and delete the stale comment at `:85-87`. Cheap, and it stops the suite from claiming coverage it does not have.
5. The smaller assertion weaknesses listed above — chiefly `run.test.cjs:37`'s over-broad `/module/` and `install.sh:35`/`:58` matching the installer's own usage banner — are worth a tidy-up pass but block nothing.
6. Unchanged from the prior cycle: adapter tool-invocation coverage (`node-ts.cjs` 58.36%, `dart-flutter.cjs` 64.80%) stays a backlog candidate, not a gap for this plan.
