---
id: CR-20260819T015653Z-4511
plan: FIX-20260819T012309Z-b208
title: Review of Prime Agent remediation CR fixes
status: REQUEST_CHANGES
created_at: 2026-08-19T01:56:53Z
reviewer: reviewer-agent
cycle: 2
must_fix_count: 2
should_fix_count: 6
---

**Related:** [FIX-20260819T012309Z-b208](./FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md) · [CR-20260819T010844Z-f9ea](./CR-20260819T010844Z-f9ea-prime-agent-distribution-review-remediation.md) · [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md) · [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md) · [TEST-20260819T014354Z-d58f](../test/TEST-20260819T014354Z-d58f-prime-agent-remediation-cr-fixes.md)

## Summary

I reviewed the whole aggregate against `09fa490` (the parent `FEAT-…be84` plus this `FIX-…b208`; the entire change set is uncommitted worktree state, 31 tracked files plus 9 new source/test files and the regenerated `prime-agent/skills/` tree). **Three of the four prior Must Fix findings — MF-2, MF-3, MF-4 — are genuinely closed**, and I re-verified each against the real binary and the real generated tree rather than on report. MF-4's root cause is closed too: the three dispatch replacements in `prime-agent/overlays/orchestrator.json` are each `description`-anchored at `count: 1`, and the generated `orchestrator/SKILL.md` carries three distinct lane-qualified `name` literals at 874/934/971.

**MF-1 is not closed.** The tester's D1 is correct and I reproduced it independently on **all four** scope kinds, not just `diff:` — `diff`, `files:`, `module:`, and `project` each exit **0** with `status: "pass"` and `gatesRun: ["G5"]` when the only scoped file is `src/theme.css`. That is verbatim the harm the spec's top-line goal names, the guard simply tests the wrong predicate, and `README.md:157` now publishes a guarantee the code does not deliver. AC 1 of this plan is unmet as written.

A second blocker that no prior artifact caught: SF-4b's new rollback in `prime-agent/install.sh` restores only skills that had a **pre-existing** copy, so a mid-loop `mv` failure on a **fresh** install leaves partially-installed skills behind while printing *"the destination was restored to its previous state."* I reproduced 3 of 11 skills surviving, after which a retry without `--force` is refused. That contradicts the parent plan's AC 4 and the message is false to the user.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Zero-gateable-file scope never `pass`, never exit 0, every scope kind | ❌ | Holds only for files **outside** a stack root. A file under `src/` that no adapter considers source keeps `scope.files` non-empty; all four kinds exit 0 `pass`. See MF-1. |
| 2 | Guard in `run()` after `resolveScope`, before `resolveGatePlan`, exit 3 via `bin/gates.cjs`; `resolveGatePlan`'s early return retained | ✅ | `assertNonEmptyScope` at `src/run.cjs:66-72`, called at `:74`; `if (!plan.length) return plan;` structurally untouched at `:48`. |
| 3 | `--scope files:` / `--scope module:<docs-dir>` with `--gates G9` exit 3; controls hold | ✅ | Verified in a throwaway repo: both exit 3; `files:src/a.ts --gates G9` still exits 3 with `unknown gate id`; implicit drops silent. |
| 4 | Reusable empty-scope fixture, exercised at `run()` and CLI incl. the docs-only-commit reproduction | ✅ | `__tests__/fixtures/empty-scope.cjs`; `run.test.cjs:32-53`, `cli-e2e.test.cjs:119-126`. One test pins a weaker property — SF-3. |
| 5 | Exit-3 cause documented in README exit table, README `--scope` row, SKILL.md exit line; behaviour change stated | ✅ | `README.md:152`, `README.md:23`, `SKILL.md:33`, plus the *Behaviour change* section at `README.md:155-159`. Wording is consistent — but `:157` asserts a scope-coverage guarantee AC 1 does not deliver. |
| 6 | G5 flags `i++ / 2; // c` and `i-- / 2; // c`; `a + /re/.test(s)` stays clean; `+`/`-` remain in `REGEX_PRECEDERS` | ✅ | Probed `scanNoComments` directly, 6/6 correct. `g5-no-comments.cjs:49` short-circuits on the digraph before the `REGEX_PRECEDERS` lookup at `:50`; `+`/`-` still in the set at `:15`. |
| 7 | No two concurrently-dispatched Prime children share a `name`; three lane-qualified literals | ✅ | Generated `prime-agent/skills/orchestrator/SKILL.md:874` `architect:{lane}`, `:934` `architect:{qualified leaf name}`, `:971` `coder:{qualified leaf name}` — the only three `name` bullets in the file, all distinct. |
| 8 | Every dispatch replacement context-anchored at `count: 1`; no `count > 1` on dispatch/role-identity without a `why` | ✅ | Replacements 11-13 in `orchestrator.json` each carry the preceding `` - `description`: … `` line and `count: 1`. Surviving `count > 1` entries are git pathspecs and a section cross-reference, each with a `why`. |
| 9 | `prime-agent/skills/` regenerated wholesale; `--check` exits 0; no hand-edit | ✅ | `node scripts/build-prime-agent.mjs --check` exits 0. Worktree diff shows no hand-edit under `prime-agent/skills/`. |
| 10 | `node --test` exits 0, ≥ 180 tests; `cd prime-agent && npm test` exits 0 | ✅ | 197 pass / 0 fail. `npm test` green (`install.sh` + `parity.sh`). |
| 11 | Per-method cyclomatic complexity ≤ 10 in touched modules | ✅ | The guard was extracted into `assertNonEmptyScope` precisely so `run()` did not grow; `startsRegex` gains one decision point. |
| 12 | `opencode-port-parity` re-verified | ✅ | Untriggered — no plugins-side change landed in `pr-review-report/` or `spec-driven-eval/`; SF-8b edits `prime-agent/overlays/spec-driven-eval.json` only. |

**Prior CR (`CR-…f9ea`) Must Fix closure:** MF-1 ❌ (narrowed, residual reachable — see MF-1 below) · MF-2 ✅ · MF-3 ✅ · MF-4 ✅ (symptom **and** anchor root cause).

## Must Fix (Blockers)

### MF-1 — The empty-scope guard tests `scope.files`, not gateable files; all four scope kinds still exit 0 `pass` having measured nothing

**File**: `plugins/my-skills/skills/clean-code-gates/src/run.cjs:66-72` (and `src/scope.cjs:145`, `README.md:157`)

**Problem**: `resolveScope` keeps a file when `fileStack(f, cfg) && !isExcluded(f, cfg)` — i.e. when it sits **under a stack root** — with no reference to that stack's `SOURCE_FILE_RE`. `assertNonEmptyScope` then tests `scope.files.length`. Every gate filters the file back out downstream (`runG5` at `run.cjs:25`, and G1/G2/G4 on `TS_FILE_RE`), so the scope reads non-empty while nothing is measurable.

I reproduced this myself in a fresh git repo (`package.json` + `tsconfig.json` + `src/a.ts` in commit 1, `src/theme.css` in commit 2), and it is broader than the tester reported — **it is not confined to `diff:`**:

| Command | Exit | `summary` |
|---|---|---|
| `--scope diff:HEAD~1 --out -` | **0** | `status: "pass"`, `gatesRun: ["G5"]`, `files: ["src/theme.css"]` |
| `--scope files:src/theme.css --out -` | **0** | same |
| `--scope module:src --out -` | **0** | same |
| `--scope project --out -` | **0** | same |

`gatesRun: ["G5"]` is worse than the original MF-1 shape: the report names a gate as having run, so a consumer reading `gatesRun` cannot even tell the run was vacuous. Because node-ts's `SOURCE_FILE_RE` is aliased to `TS_FILE_RE` (`node-ts.cjs:730`), the trigger covers `.js`, `.jsx`, `.json`, `.css`, `.scss`, `.svg`, `.snap`, `.graphql` under `src/` — a CSS-only or JS-only PR in a React+TS repo, which is strictly more common than the docs-only case MF-1 named.

This is AC 1 of this plan verbatim ("for every scope kind"), and it makes `README.md:157` — *"it applies to every scope form (`diff:<ref>`, `files:`, `module:<path>`, `project`)"* — a false claim published to CI callers. Fixing only the prose is not acceptable here: the spec's top-line goal is that an unmeasured run is loudly non-zero, and the code, not the sentence, is what a CI job depends on.

**Fix**: keep `assertNonEmptyScope`'s placement and message contract; change the predicate to count files at least one scoped stack's adapter considers source. Both adapters already export `SOURCE_FILE_RE` and `run.cjs` already reads it at `:25`, so this needs no new mechanism — pass the adapter registry (or a resolved `isSource(rel)` closure) into the guard rather than re-deriving it:

```js
function assertNonEmptyScope(scope, isSource) {
  if (scope.files.some(isSource)) return;
  const ref = scope.baseRef ? ` ${scope.baseRef}` : '';
  throw new Error(`scope resolved to zero gateable files (${scope.kind}${ref}) — `
    + 'nothing was measured, so this run has no verdict');
}
```

Regression tests (both fail today): the `src/theme.css` diff above, and the same file under `--scope project`. Fold SF-3's `run.test.cjs:47-52` into the first of these rather than adding a parallel case. Leave `README.md:157` as written once the code delivers it.

---

### MF-2 — `install.sh`'s rollback leaves freshly-installed skills behind and claims it did not

**File**: `prime-agent/install.sh:113-119` (`rollback`), message at `:126`

**Problem**: `rollback` iterates `committed` and skips any entry with no `.old-$name` in staging:

```sh
for name in "${committed[@]}"; do
  [[ -e "$staging/.old-$name" ]] || continue
  rm -rf "$destination/$name"
  mv "$staging/.old-$name" "$destination/$name"
done
```

A skill that had **no** prior copy is committed at `:143` (`mv "$staging/$name" "$destination/$name"`) but never unwound, because the `continue` fires before the `rm -rf`. On a first install every skill takes that branch, so a mid-loop `mv` failure leaves a partial tree while `cleanup` prints *"Install failed — the destination was restored to its previous state."*

Reproduced with the suite's own `mv` shim at `MV_FAIL_AT=4` against an empty destination: **3 of 11 skills survived**, and the natural retry is then refused —

```
Refusing to install: existing skill: …/.prime/agent/skills/clean-code-gates (use --force)
```

— so the user is pushed to `--force` to recover from a failure the installer told them left nothing behind. This contradicts the parent plan's AC 4 (*"on any failure leaves the destination tree untouched"*) and makes a false statement on the user's terminal. `prime-agent/tests/install.sh:96-113` cannot catch it: both `fail_at` iterations run a successful install first and then re-run with `--force`, so only the overwrite path is exercised.

**Fix**: unwind fresh commits as well as overwritten ones —

```sh
for name in "${committed[@]}"; do
  rm -rf "$destination/$name"
  [[ -e "$staging/.old-$name" ]] && mv "$staging/.old-$name" "$destination/$name"
done
```

Add the missing test case to `prime-agent/tests/install.sh`: inject the `mv` failure against a **destination with no prior install** and assert the skills directory ends empty (no `SKILL.md` anywhere under it) and that a plain retry — no `--force` — succeeds. That case fails today.

## Should Fix (Warnings)

### SF-1 — The `node-ts` / `dart-flutter` G1 divergence is real, but the tester's premise for closing it is wrong; record it and pin it with a test

**File**: `plugins/my-skills/skills/clean-code-gates/src/adapters/node-ts.cjs:246`, `src/adapters/dart-flutter.cjs:210`, `__tests__/g1-absent-coverage.test.cjs:8-45`

**Problem**: The behavioural asymmetry the tester reported (D2) is confirmed — I probed `fileCoverageFindings` directly: with a coverage entry present, `src/a.js`, `src/a.jsx`, `src/styles.css`, `src/fixture.json` and `src/README.md` each yield **4 blocker findings** under node-ts and **0** under dart.

**But the recommended fix (`if (!TS_FILE_RE.test(rel)) return [];`, mirroring dart) is not a backward-compat repair — it would itself be a backward-compat break.** `git show 09fa490:…/node-ts.cjs` shows the pre-change `runG1` loop as `if (isExempt…) continue; const entry = byRel.get(rel); if (!entry) continue; findings.push(…)` — **no `TS_FILE_RE` filter at all**. node-ts has always scored any scoped file carrying a coverage entry. The `!entry &&` clause preserves that exactly. Dart's pre-change loop, by contrast, opened with `if (!DART_FILE_RE.test(rel) || isExempt…) continue;`, so SF-7b genuinely *restored* dart's original behaviour. The two adapters diverge because they always did.

So this is a design inconsistency worth closing, not a regression this change set introduced, and closing it means deliberately narrowing node-ts's G1 surface — a decision to take on its own merits (the adapter's own `SOURCE_FILE_RE`, G2/G4 at `:399`, and G5 all gate on `TS_FILE_RE`, so G1 is the lone exception) rather than under a backward-compat argument that does not apply.

**Fix**: (a) record the divergence and its history in a backlog item or an ADR follow-up, so the next reader does not re-derive it from a wrong premise; (b) close the test gap now regardless of which way (a) resolves — `g1-absent-coverage.test.cjs`'s `CASES` loop only ever passes `entry: undefined`, the one argument for which the adapters agree, so the loop reads as parity it does not have. Add an explicit node-ts counterpart to `:51` pinning today's behaviour (`a non-TS file carrying a coverage entry **is** scored by node-ts`), so the divergence is documented by a test instead of hidden by one.

---

### SF-2 — The two tests named for prior-MF-2 do not exercise gate selection, and the comment above them describes a mechanism that is not what makes them pass

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/gate-selection.test.cjs:85-98`

**Problem**: Confirmed. `assertNonEmptyScope` fires at `run.cjs:74`, before `resolveGatePlan` is ever called, so `--gates G9` is never evaluated in either test — the tester verified both stay green with a valid `G5` substituted. The behaviour is correct and mandated (AC 2's ordering, AC 3's exit 3), but the tests are duplicates of `run.test.cjs:32-38` wearing a gate-selection name, and the comment at `:85-87` attributes the pass to `resolveGatePlan`'s early return, which is now unreachable for exactly this reason. Two assertions are also near-vacuous: `doesNotMatch(r.stdout, /"status": "pass"/)` on a path that writes no stdout.

**Fix**: rename both tests to what they assert (`an empty files: scope exits 3 even with a gate id that would also be rejected`), replace the comment at `:85-87` with the real mechanism (the empty-scope guard precedes gate selection, deliberately, so the deeper cause is reported), and swap the vacuous `doesNotMatch` for a `assert.match(r.stderr, /zero gateable files/i)`. If the ordering is ever meant to surface both faults, that is a separate product decision — do not encode it as a test rename.

---

### SF-3 — `run.test.cjs:47-52` proves an empty *directory*, not an empty *gateable set*

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/run.test.cjs:47-52`

**Problem**: The test deletes `src/a.ts`, leaving `src/` completely empty, so `projectFiles` returns `[]` and the guard fires on an empty list. AC 1's actual property — *zero **gateable** files* — is never exercised. This is why MF-1 shipped.

**Fix**: replace the `rmSync` with `fs.writeFileSync(path.join(d, 'src', 'x.css'), '.a{}')`. It goes red today and becomes MF-1's regression test.

---

### SF-4 — `/module/` is too broad to pin "the message names the scope kind"

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/run.test.cjs:37`

**Problem**: `assert.throws(…, /module/)` also matches Node's own `Cannot find module` / `MODULE_NOT_FOUND`, so a broken require path in the fixture would read as a pass under a test whose name promises the opposite.

**Fix**: pin the real shape — `/zero gateable files \(module\)/`.

---

### SF-5 — Three installer-test assertions are satisfied by the installer's own usage banner or discard the evidence

**File**: `prime-agent/tests/install.sh:35`, `:47`, `:58`, `:103`

**Problem**: `*".prime"*` and `*"/agent"*` both match `install.sh:9`'s usage banner, so an arg-parsing regression that turned `--project PATH` into an unknown option would keep both symlink-containment tests green. `:47` checks only that the attacker-chosen `outside` directory still exists, never that it stayed empty — unlike its siblings at `:38`/`:61`. `:103` discards stderr, so the user-facing failure message at `install.sh:126` is never asserted (which is why MF-2's false claim went unnoticed). Mostly pre-existing, but MF-2's new test lands next door.

**Fix**: pin the refusal prefix (`Refusing to install: destination path component is a symlink:`), assert `outside` is empty, and capture stderr in the rollback case so the restoration message is asserted — once MF-2 is fixed, that message becomes true and is worth pinning.

---

### SF-6 — The empty-scope fixture does not neutralise `core.hooksPath` / `init.templateDir`

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/fixtures/empty-scope.cjs:29-43`

**Problem**: The fixture neutralises `commit.gpgsign`, `user.name` and `user.email` but not global hooks or an init template, so a developer with either configured can make `docsOnlyCommitRepo()` behave unpredictably — a fixture-dependent flake in the tests that now carry MF-1's closure.

**Fix**: `GIT_CONFIG_GLOBAL=/dev/null` on the spawned git calls, or `git init --template=`.

## Notes (no action required)

- **`frontmatterReplacements` (`scripts/build-prime-agent.mjs:87-95`) is the right shape for SF-3b.** `replacements` only ever sees the body, and the frontmatter `description` is the discovery blurb, so a host claim there is as visible as one in the body. Routing it through the same `applyReplacements` matcher means a drifted anchor hard-fails the build identically. Verified in the generated tree: `prime-agent/skills/orchestrator/SKILL.md:3` now reads *"Admits each role … as an RLM child."* No new failure mode.
- **`resolveGatePlan`'s `if (!plan.length) return plan;` is now unreachable** — `scope.stacks` derives from `scope.files`, so an empty plan implies an empty scope, which throws upstream. AC 2 deliberately retained it and there is no reason to remove it; SF-2's comment rewrite is where a future reader should learn this.
- **Doc-skill changes (SF-1/1b, SF-2, SF-5, SF-6) are structurally sound.** SF-6's reduction of `SKILL.md:473` to request-plus-pointer respects the single-source-of-truth convention while still listing the three fields the strict-shape rule needs to be readable at all — the plan called that tension out and resolved it correctly. `config.md`'s three worked examples were re-checked and the `integration: none` declarations added where the arithmetic depends on them. Cross-references to ADR-0014 resolve.
- **No scope creep.** Every changed path traces to a plan task; the plugins-side `orchestrator/SKILL.md` dispatch bullets are unchanged as AC 7's Prime-port-only framing requires.

## Verdict

**Status**: REQUEST_CHANGES

Prior MF-2, MF-3 and MF-4 are genuinely closed and the Prime-port work is solid, but AC 1 is unmet on all four scope kinds with a README that publishes the guarantee anyway, and the new installer rollback leaves a partial tree on a fresh install while reporting the opposite.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260819T015653Z-4511-prime-agent-remediation-cr-fixes.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair.
