---
id: FIX-20260819T020345Z-48c5
title: Gateable-scope guard and installer rollback fixes
type: fix
status: DONE
created_at: 2026-08-19T02:05:26Z
updated_at: 2026-08-19T02:33:10Z
cycle: 2
related_to: CR-20260819T015653Z-4511, FIX-20260819T012309Z-b208, CR-20260819T010844Z-f9ea, FEAT-20260819T001630Z-be84, SPEC-20260819T000458Z-bfac, TEST-20260819T014354Z-d58f
---

**Related:** [CR-20260819T015653Z-4511](./CR-20260819T015653Z-4511-prime-agent-remediation-cr-fixes.md) · [FIX-20260819T012309Z-b208](./FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md) · [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md) · [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md) · [TEST-20260819T014354Z-d58f](../test/TEST-20260819T014354Z-d58f-prime-agent-remediation-cr-fixes.md)

## Overview

Closes the two Must Fix blockers raised by `CR-20260819T015653Z-4511` against `FIX-20260819T012309Z-b208`, plus the six Should Fix warnings as optional work. Both blockers are guards that fire on the wrong predicate and then *report success at protecting something they did not protect*.

**MF-1** — `assertNonEmptyScope` (`src/run.cjs:66-72`) tests `scope.files.length`, but `resolveScope` (`src/scope.cjs:145`) keeps any file under a stack root regardless of that stack's `SOURCE_FILE_RE`. A scope holding only `src/theme.css` therefore reads non-empty, every gate filters it back out downstream, and the run exits **0** with `status: "pass"` and `gatesRun: ["G5"]` — a *named* gate, so a consumer reading `gatesRun` cannot even tell the run was vacuous. The reviewer reproduced this on all four scope kinds, and `README.md:157` already publishes the guarantee to CI callers. This is the spec's top-line harm, unfixed.

**MF-2** — `prime-agent/install.sh:113-119` unwinds only skills that had a `.old-$name` copy in staging, so a skill installed *fresh* is committed at `:143` and never rolled back. On a first install every skill takes that branch: a mid-loop `mv` failure leaves a partial tree while `cleanup` prints *"the destination was restored to its previous state."* Reproduced at `MV_FAIL_AT=4` against an empty destination — 3 of 11 skills survived, and the natural plain retry is then refused with `use --force`. That contradicts the parent plan's AC 4 and puts a false statement on the user's terminal. The existing test at `prime-agent/tests/install.sh:96-113` structurally cannot catch it: both `fail_at` iterations pre-install and re-run with `--force`, exercising only the overwrite path.

The two blockers are independent and land in different trees (`plugins/my-skills/skills/clean-code-gates/` and `prime-agent/`), so Phases 1 and 2 can proceed in either order. Phase 4's regeneration is mandatory for Phase 1 and 3 only — `prime-agent/skills/clean-code-gates/` is a generated copy of the plugins-side skill.

## Acceptance Criteria

1. A scope holding files that resolve under a stack root but that **no scoped adapter's `SOURCE_FILE_RE` considers source** exits **3**, never 0, and never reports `status: "pass"` — verified for all four scope kinds (`diff:<ref>`, `files:`, `module:<path>`, `project`) with `src/theme.css` as the sole scoped file.
2. `assertNonEmptyScope` keeps its current placement (in `run()`, after `resolveScope`, before `resolveGatePlan`) and its message contract (`zero gateable files (<kind>[ <baseRef>]) — nothing was measured, so this run has no verdict`); `resolveGatePlan`'s `if (!plan.length) return plan;` early return stays structurally untouched.
3. The gateable predicate is **resolved and passed into** the guard rather than re-derived inside it, and an adapter that exports no `SOURCE_FILE_RE` leaves its files counted as gateable (a third-party registered adapter must not start failing runs it previously served).
4. A scope holding at least one adapter-recognised source file still returns a verdict and exits by report status — no regression in the existing exit-code matrix (0/1/2/3/4).
5. `prime-agent/install.sh` rollback restores the destination to its true prior state for **freshly installed** skills as well as overwritten ones: after an injected mid-loop `mv` failure against a destination with **no prior install**, no `SKILL.md` remains anywhere under the skills directory and no staging leftovers (`.*` entries) remain.
6. After that failed fresh install, a **plain retry with no `--force`** succeeds and installs all 11 skills.
7. `prime-agent/tests/install.sh` gains the fresh-install rollback case (it fails against the pre-fix installer) and asserts the installer's stderr message, so the "restored to its previous state" claim is pinned to being true.
8. `g1-absent-coverage.test.cjs` documents the node-ts / dart-flutter G1 divergence with an explicit node-ts case for `entry` **present** on a non-TS file, so the `CASES` loop no longer reads as parity the adapters do not have. **The divergence is pinned as today's deliberate behaviour, not repaired** — see Technical Notes.
9. `prime-agent/skills/` is regenerated wholesale via `node scripts/build-prime-agent.mjs`; `node scripts/build-prime-agent.mjs --check` exits 0; no file under `prime-agent/skills/` is hand-edited.
10. `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0 with no fewer tests than the 197 the CR recorded; `cd prime-agent && npm test` exits 0.
11. Per-method cyclomatic complexity stays ≤ 10 in every touched module — the predicate is a named module-level factory, not inline growth inside `run()`.
12. `README.md:155-159` and `SKILL.md:33` are re-verified as true against the fixed code and left unchanged unless the code's message or exit code moved.

## Out of Scope

- **Narrowing node-ts's G1 surface to `TS_FILE_RE`.** The reviewer overturned the tester's premise: `git show 09fa490:…/node-ts.cjs` shows the pre-change `runG1` loop had **no** `TS_FILE_RE` filter at all, so the current `!entry && !TS_FILE_RE.test(rel)` *preserves* legacy node-ts behaviour, while dart's pre-change loop filtered unconditionally, so SF-7b *restored* dart's. The naive `if (!TS_FILE_RE.test(rel)) return [];` would itself be a backward-compat break and is refused here. Closing the divergence is a design decision to take on its own merits (optional task 3.1), not a repair.
- A `--allow-empty-scope` escape hatch (still deferred per `README.md:159`).
- Changing `resolveScope`'s retention rule. The scope is what it is; the *guard* decides whether it is measurable. Filtering non-source files out of `scope.files` would change the `files:` echo in every report and is a wider blast radius than AC 1 needs.
- Any hand-edit under `prime-agent/skills/**` (generated tree — change the plugins source or `prime-agent/overlays/*.json`, then regenerate).
- Committing or pushing. The pipeline stops at READY_TO_COMMIT.
- Re-litigating the eight ACs the CR marked ✅ (2, 3, 4, 5, 6, 7, 8, 9 of the prior plan) — they are closed and must stay closed.

## Technical Notes

- **`clean-code-gates` is the repo's lone runtime-code island** (PROJECT-CONTEXT → Stack). Its `node --test` suite is the only real gate here; do **not** run it against doc skills.
- **Backward compatibility is mandatory** (PROJECT-CONTEXT → Invariants). Two places this bites:
  - AC 3's fallback. `ADAPTERS` is a mutable registry (`registerAdapter` at `src/run.cjs:12`). A registered adapter with no `SOURCE_FILE_RE` must have its files treated as gateable, matching `runG5`'s existing shape at `:25-26` (`sourceRe ? files.filter(…) : files`). Mirror that ternary rather than inventing a second convention — the repo's "mirror machinery" convention.
  - The `--scope files:src/theme.css` case that used to exit 0 now exits 3. That is the *intended* strictness increase and `README.md:155-159` already documents it as a behaviour change; the change here makes the prose true rather than adding a new claim.
- **Where the predicate lives.** `run()` already holds `cfg` and can reach `fileStack(rel, cfg)` and `ADAPTERS`. Build a module-level factory (e.g. `sourcePredicate(cfg)` returning `rel => …`) and pass the closure into `assertNonEmptyScope(scope, isSource)` per the CR's suggested shape. This keeps `run()`'s decision count flat (AC 11) and keeps the guard a pure function of its two arguments, testable without a registry.
- **Exit 3 routing already works** — `bin/gates.cjs` maps a thrown guard error to exit 3, verified by the CR's AC 2/3 ✅. Do not add a second mapping.
- **`prime-agent/install.sh` and `prime-agent/tests/` are hand-authored**, NOT generated: `scripts/build-prime-agent.mjs` only `rmSync`s and rewrites `prime-agent/skills/` (`destRoot`, `:191`). Editing them directly is correct. `prime-agent/skills/clean-code-gates/` **is** generated, so Phase 1's JS change must be followed by a regeneration (Phase 4).
- **The rollback's `committed` ordering is already correct** for the fix: `committed+=("$name")` runs *after* the move-aside `mv` and *before* the commit `mv`, so an unconditional `rm -rf "$destination/$name"` followed by a conditional restore covers both the "commit mv failed" and "commit mv succeeded" states. Do not reorder the array push.
- **The `mv` shim already exists** at `prime-agent/tests/install.sh:83-92` with `MV_CALLS` / `MV_FAIL_AT`. Reuse it for the fresh-install case; do not author a second shim.
- **`opencode-port-parity`** is untriggered — none of these paths has a `.opencode/skills/` override port (`pr-review-report`, `spec-driven-eval` only). No mirroring required; state that in the progress log rather than silently skipping it.
- **Single-source-of-truth references** (PROJECT-CONTEXT → Conventions): if optional task 3.1 records the G1 divergence, it belongs in an ADR (`docs/adr/0015-*.md`, next in sequence) or a backlog note — not duplicated into `SKILL.md`.

## Tasks

> Tasks are ordered TDD-first: write/update tests before implementation.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.
> Tasks marked `(optional)` are Should Fix items — implement if cheap and safe, skip without blocking. **Task 3.2 is NOT optional** despite deriving from SF-1: the CR's premise correction makes the misleading test the load-bearing half of that finding.

### Phase 1 — MF-1: the guard counts gateable files, not scoped files

- [x] 1.1 Extend `__tests__/fixtures/empty-scope.cjs` with a non-source-under-`src/` shape: a `src/theme.css` (and its `docsOnlyCommitRepo` variant whose second commit touches only that file), so all four scope kinds can reach a non-empty-but-ungateable scope from one fixture. Keep the existing docs-only exports — they are still cited by passing tests.
- [x] 1.2 Write failing tests in `__tests__/run.test.cjs` proving a `src/theme.css`-only scope throws for **each** of the four kinds (`files:`, `module:`, `diff:`, `project`), asserting the message shape `/zero gateable files \(<kind>[^)]*\)/`. All four go red today (all currently return `status: "pass"`).
- [x] 1.3 Fold SF-3 into 1.2: replace `run.test.cjs:47-52`'s `fs.rmSync(path.join(d, 'src', 'a.ts'))` with writing `src/x.css`, so the `project` case proves an empty *gateable set* rather than an empty *directory*.
- [x] 1.4 Tighten SF-4: change `run.test.cjs:37`'s `assert.throws(…, /module/)` to `/zero gateable files \(module\)/`, so Node's own `Cannot find module` / `MODULE_NOT_FOUND` can no longer satisfy a test whose name promises the opposite.
- [x] 1.5 Write a failing CLI test in `__tests__/cli-e2e.test.cjs` for the reviewer's exact reproduction: `--scope diff:HEAD~1 --out -` over a `src/theme.css`-only commit exits **3**, stdout carries no `"status": "pass"`, and stderr matches `/zero gateable files/i`.
- [x] 1.6 Write failing unit tests for the predicate itself (guard called directly, no registry): a scope whose files are all adapter-source passes the guard; a scope whose files are none passes none; **and** a scope whose resolved stack exposes no `SOURCE_FILE_RE` is treated as gateable (AC 3's backward-compat fallback).
- [x] 1.7 Implement: add a module-level `sourcePredicate(cfg)` factory in `src/run.cjs` resolving each file's stack via `fileStack(rel, cfg)` and testing that adapter's `SOURCE_FILE_RE`, mirroring `runG5:25-26`'s `sourceRe ? … : …` ternary for the missing-regex fallback.
- [x] 1.8 Implement: change `assertNonEmptyScope(scope)` → `assertNonEmptyScope(scope, isSource)` with `if (scope.files.some(isSource)) return;`, and call it from `run()` at `:74` as `assertNonEmptyScope(scope, sourcePredicate(cfg))`. Leave the placement, the message text, and `resolveGatePlan`'s `if (!plan.length) return plan;` structurally untouched (AC 2).
- [x] 1.9 Update the doc comment above `assertNonEmptyScope` to state the real predicate (files at least one scoped adapter considers source) — the current text says "zero gateable files" while the code counted scoped files, which is exactly how MF-1 shipped past review.
- [x] 1.10 Verify AC 4 by running the full suite: confirm no previously-green test flipped, in particular `exit-codes.test.cjs`, `gate-selection.test.cjs` controls, `scope-*.test.cjs`, and `run.test.cjs`'s "a non-empty scope still returns a verdict".
- [x] 1.11 Re-verify AC 12: read `README.md:145-159` and `SKILL.md:33` against the fixed behaviour and confirm each sentence is now true. Change nothing unless a claim is false.

### Phase 1 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, total test count ≥ 197 + the cases added above.
- [x] Manual reproduction of the CR's table: in a throwaway repo, all four scope kinds over a `src/theme.css`-only scope exit **3** (not 0) and print no `"status": "pass"`.

### Phase 2 — MF-2: the installer rollback unwinds fresh installs

- [x] 2.1 Write the failing regression case in `prime-agent/tests/install.sh`: against a destination with **no prior install**, run with the existing `mv` shim at `MV_FAIL_AT=4`, assert the installer exits non-zero, assert `find "$dest/.prime/agent/skills" -name SKILL.md | wc -l` is **0**, and assert no `.*` staging leftovers remain at depth 1. This fails today (3 of 11 skills survive).
- [x] 2.2 Extend 2.1 with AC 6: after the failed fresh install, a **plain retry with no `--force`** exits 0 and installs all 11 skills. This fails today with `Refusing to install: existing skill: … (use --force)`.
- [x] 2.3 Extend 2.1 with SF-5's stderr assertion: capture stderr (the existing rollback case at `:103` discards it) and assert it carries the `Install failed — the destination was restored to its previous state.` message — the claim is only worth pinning once the fix makes it true.
- [x] 2.4 Implement the `rollback` fix in `prime-agent/install.sh:113-119`: `rm -rf "$destination/$name"` unconditionally for every committed name, then restore `.old-$name` only if it exists. Do not reorder the `committed+=` push (see Technical Notes).
- [x] 2.5 Update the comment block above `committed`/`rollback` (`install.sh:105-111`) so it describes unwinding *both* fresh and overwritten commits — the current wording ("moved aside rather than deleted, so a failure can put every committed skill back") is what made the overwrite-only loop read as complete.
- [x] 2.6 Confirm the pre-existing overwrite cases (`fail_at` 5 and 6 at `tests/install.sh:96-113`) still pass unchanged — the fix must not weaken the restore-live-skills path (`PREEXISTING` markers all 11).
- [x] 2.7 (optional) SF-5, remaining two: pin the symlink refusal prefix (`Refusing to install: destination path component is a symlink:`) at `tests/install.sh:35` and `:58` instead of the too-broad `*".prime"*` / `*"/agent"*` globs that the usage banner at `install.sh:9` also satisfies; and assert at `:47` that the attacker-chosen `outside` directory is **empty**, matching its siblings at `:38`/`:61`.

### Phase 2 verification

- [x] `cd prime-agent && npm test` exits 0 (`tests/install.sh` + `tests/parity.sh`).
- [x] The new fresh-install case is confirmed to fail against the pre-fix `rollback` (stash or temporarily revert the four-line change, observe red, restore) — a regression test that never went red proves nothing.

### Phase 3 — Test-honesty cleanups

- [x] 3.1 (optional) SF-1(a): record the node-ts / dart-flutter G1 divergence and its real history in `docs/adr/0015-*.md` (next in sequence) or a backlog note — that node-ts's G1 has **always** scored any scoped file carrying a coverage entry while dart's has always filtered on `DART_FILE_RE`, that `SOURCE_FILE_RE`/G2/G4/G5 all gate on `TS_FILE_RE` making G1 the lone exception, and that closing it is a deliberate narrowing to decide on its own merits — **not** a backward-compat repair. Do not change adapter behaviour under this task.
- [x] 3.2 SF-1(b) — **required, not optional**: add an explicit node-ts case to `__tests__/g1-absent-coverage.test.cjs` pinning today's behaviour with `entry` **present** on a non-TS file (`src/schema.json` with a coverage entry **is** scored by node-ts, unlike its dart counterpart at `:51`). The `CASES` loop only ever passes `entry: undefined` — the one argument for which the adapters agree — so it currently reads as parity that does not exist. Name the test so the divergence is visible from the test name alone.
- [x] 3.3 (optional) SF-2: in `__tests__/gate-selection.test.cjs:85-98`, rename both tests to what they assert (e.g. `an empty files: scope exits 3 even with a gate id that would also be rejected`), replace the `:85-87` comment — which attributes the pass to `resolveGatePlan`'s early return, now unreachable for exactly this reason — with the real mechanism (the empty-scope guard deliberately precedes gate selection so the deeper cause is reported), and swap the near-vacuous `doesNotMatch(r.stdout, /"status": "pass"/)` on a path that writes no stdout for `assert.match(r.stderr, /zero gateable files/i)`.
- [x] 3.4 (optional) SF-6: neutralise `core.hooksPath` / `init.templateDir` in `__tests__/fixtures/empty-scope.cjs:29-43` via `GIT_CONFIG_GLOBAL=/dev/null` on the spawned git calls or `git init --template=`, so a developer with global hooks configured cannot flake the tests that now carry MF-1's closure.

### Phase 3 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0.
- [x] If 3.3 landed: confirm both renamed tests still exit 3 and now assert on stderr, and that the surviving `--gates G9` control on a **non-empty** scope still reports `unknown gate id`.

### Phase 4 — Regenerate the Prime Agent distribution

- [x] 4.1 Run `node scripts/build-prime-agent.mjs` to regenerate `prime-agent/skills/` wholesale, picking up Phase 1's and Phase 3's plugins-side changes to `clean-code-gates`.
- [x] 4.2 Assert `node scripts/build-prime-agent.mjs --check` exits 0.
- [x] 4.3 Confirm no file under `prime-agent/skills/**` was hand-edited: every change there must appear only as build output (inspect the worktree diff for that subtree and match it against the plugins-side change).
- [x] 4.4 Run the full test suite of both islands and confirm green.

### Phase 4 verification

- [x] `node scripts/build-prime-agent.mjs --check` exits 0.
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0.
- [x] `cd prime-agent && npm test` exits 0.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate
> commands below that apply to the phase's touched paths and asserts each
> exits 0. A failure routes through the coder's BLOCKED step, not a silent
> rewrite of source to make a gate pass.

Per PROJECT-CONTEXT → Commands, this repo has **no build, no lint, and no automated test framework for doc skills**. Two runtime islands are in scope here, each with its own suite; run only the commands whose path condition matches the phase's diff.

| Condition on the phase's diff | Gate command | Exit criterion |
|---|---|---|
| Any file under `plugins/my-skills/skills/clean-code-gates/` (Phases 1, 3) | `cd plugins/my-skills/skills/clean-code-gates && node --test` | exit 0; test count ≥ 197 and never decreasing |
| Any file under `prime-agent/` **outside** `prime-agent/skills/` (Phase 2) | `cd prime-agent && npm test` | exit 0 (`tests/install.sh` + `tests/parity.sh`) |
| Any change under `prime-agent/skills/` or any plugins-side skill source (Phases 1, 3, 4) | `node scripts/build-prime-agent.mjs --check` | exit 0 — proves the generated tree matches its source |
| Doc-only edits (`README.md`, `SKILL.md`, `docs/adr/`) | structural review per PROJECT-CONTEXT → Test tooling | cross-references resolve; `.md`/`.html` template parity unaffected; backward-compat claims hold in prose |

Phase exit criterion: ALL applicable commands exit 0 on the changed set.

G1 (coverage) and G6 (mutation) are NOT gates of this plan — they remain QA-only.

## Dependencies

None. This plan supersedes `FIX-20260819T012309Z-b208` for the two open blockers; the eight ACs that CR marked ✅ must remain green (AC 10's suite run is the regression net for that).

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T02:05:26Z | ARCHITECT

Plan `FIX-20260819T020345Z-48c5` created. Type: fix. Tasks: 26 (across 4 phases; 5 marked optional).
Status: PLANNED. Ready for coder.

### 2026-08-19T02:08:45Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-19T02:33:10Z | CODER

All 26 tasks complete (including all 5 marked optional). Plan status → DONE. Ready for reviewer.

### 2026-08-19T02:28:07Z | TESTER

TEST-20260819T022100Z-2621 created. Status: PASS. Coverage: 86.77% → 86.77%.

### 2026-08-19T02:30:32Z | REVIEWER

CR-20260819T023032Z-d934 created. Status: APPROVED. Must Fix: 0. Should Fix: 5.

### 2026-08-19T02:36:47Z | QA

QA-20260819T023647Z-5465 created. Status: READY_WITH_WARNINGS. Failures: 0. Lint/type errors: 0.
