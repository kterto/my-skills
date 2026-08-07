---
id: TEST-20260807T011909Z-b155
plan: FEAT-20260807T004018Z-c4af
title: Test Report — Optional layer-sliced parallel execution for the orchestrator pipeline
status: PASS
created_at: 2026-08-07T01:19:09Z
cycle: 0
---

**Related:** [FEAT-20260807T004018Z-c4af](../feat/FEAT-20260807T004018Z-c4af-orchestrator-parallel-lane-execution.md)

## Summary

This plan is 12 documentation/template files plus **one** runtime change: the prefix→scaffold
resolution in `plugins/my-skills/skills/orchestrator/scripts/render-artifact.cjs`. Per
`PROJECT-CONTEXT.md` → **Test tooling**, the doc-skill portions have no automated framework and
are verified by structural review (the reviewer's lane); the renderer is the sole executable
surface and the only place a test can prove anything.

Three things were verified rather than assumed:

1. **The TDD claim in AC 4 holds.** Both coder-authored `PACT` tests were replayed against the
   pre-change renderer in a detached `HEAD` worktree: **red** (2 failures), green after. The
   test genuinely drives the change.
2. **The two red sibling suites are pre-existing.** Verified at `HEAD`, not assumed — identical
   failure counts before and after (`gate-scope` 24, `gate-shell-injection` 3). Left untouched.
3. **The simplify pass left an untested regression surface**, closed here — see *Test-Quality Audit*.

Coverage on the one runtime file was already far above the 70% floor, so the coverage work was
not about hitting a number; it was about the fact that a high line-coverage number was hiding an
under-tested lookup table.

## Flows Triaged

"Flows" in this repo are skill behaviors described in prose (`PROJECT-CONTEXT.md` → Critical
flows: *"none — flows are skill behaviors described in prose"*). Only one flow in this diff has
an executable surface. Criticality = user impact × breakage likelihood × not-covered-by-unit.

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| Render a `PACT` artifact to HTML via the `render-artifact.cjs` CLI | **High** (impact: high — a broken render fails the whole html-mode pipeline; likelihood: med; unit-covered: partial) | **SELECTED — e2e added** | The coder's tests call `toHtml` directly, proving the *mapping*. They never drive `render()`, so the write path, the containment guard, and the internal `validateHtml` gate were unexercised for the new prefix. This is the flow the orchestrator actually runs. Cheap — the CLI harness already existed. |
| Prefix→scaffold resolution for the other 8 allow-listed prefixes | **High** (impact: high — silently re-points an established artifact type; likelihood: med — the simplify pass rewrote exactly this code; unit-covered: **no**) | **SELECTED — unit, not e2e** | See *Test-Quality Audit*. A pure-function table; e2e would be 9× the cost for no extra signal. Correctly a unit test per Step 4. |
| Parallel lane execution itself — Steps 2p/2c/2L/3L/3j, lane boundary enforcement, contract amendment loop, `ask` ladder | High value, **zero executable surface** | **EXCLUDED** | These are instructions to a subagent in markdown. There is nothing to invoke; an "e2e" here would test a prompt string against itself — a tautology. Verification is structural review, which is the reviewer's step, not the tester's. |
| `parallelism=off` byte-identical no-op (AC 14) | High | **EXCLUDED from e2e** | Same reason — the assertion is over document text, and it is a `git diff` argument, not a runtime one. Flagged to the reviewer as the highest-value structural check in the plan. |
| Legacy `config.json` missing all three keys resolves to defaults (AC 15) | Medium | **EXCLUDED from e2e; gate run** | No config *reader* ships in this repo — the keys are consumed by a subagent reading markdown. The only executable assertion available is that `templates/config.template.json` parses, which is the plan's own Phase 1 gate. Run below; exits 0. |
| `.md`/`.html` template parity, cross-reference resolution, opencode host-agnosticism (ACs 5–13, 16) | Medium | **EXCLUDED** | Structural review; explicitly out of scope for automated tooling per `PROJECT-CONTEXT.md` → Out of scope. |

## E2E Tests Added

Added to `plugins/my-skills/skills/orchestrator/scripts/render-artifact.test.cjs` (test file only —
no production source touched).

- **`PACT(c)`** — the selected e2e. Writes a real `PACT-*.md` to a temp dir, spawns
  `render-artifact.cjs` as a subprocess, and asserts exit 0, that the `.html` sibling is written
  to disk, and that the *written file* carries the `Interface Contract` kicker and the `data-id`.
  Covers the CLI → `render()` → containment guard → `validateHtml` → `writeFileNoFollow` path that
  `PACT(a)`/`PACT(b)` skip.

Supporting unit tests (Step 4 backfill, not e2e):

- **`MAP(a)`** — table-driven over all 9 allow-listed prefixes (`SPEC`, `FEAT`, `FIX`, `QAF`,
  `PACT`, `TEST`, `CR`, `QA`, `FINAL`). For each, asserts the lifted `<style>` is byte-identical to
  the scaffold file on disk (identifying *which template was loaded*, independent of the kicker)
  **and** that the document label matches. Locks both halves of the new `SCAFFOLD` /
  `KICKER_BY_PREFIX` split.
- **`MAP(b)`** — the two fallback branches: a `plans/eval/` artifact (directory overrides the
  basename prefix) and an unrecognised prefix both resolve to the `qa-report` scaffold.

## Coverage

Measured with `node --test --experimental-test-coverage` on the only runtime file in the diff.
The repo has no coverage command configured (`PROJECT-CONTEXT.md`: *"Coverage: not measured except
within `clean-code-gates`"*), so Node's built-in instrumentation was used.

| Metric (`render-artifact.cjs`) | Before (HEAD) | After coder+simplify | After this report |
|---|---|---|---|
| **Line** | 97.86% | 97.89% | **97.89%** |
| Branch | 87.84% | 86.67% | **88.74%** |
| Functions | 100% | 100% | **100%** |

Floor of 70% met with a wide margin at every point. Note the branch dip the coder+simplify pass
introduced (87.84 → 86.67): the new map added branches the two `PACT` tests did not reach. The
tests added here recover it and clear the original baseline (→ 88.74).

Test count: **40 → 42** (coder) **→ 45** (this report). All green.

Remaining uncovered lines — `470-471`, `489-495`, `512-513` — are **pre-existing** defensive paths
(the derived-output-equals-input guard, the temp-file unlink-on-rename-failure cleanup, and the
non-render error rethrow). All three sit outside this plan's diff hunks and need filesystem fault
injection to reach. Not worth the harness; no meaningful tests remain to add for this diff.

## Test-Quality Audit

**Coder-authored tests (`PACT(a)`, `PACT(b)`) — good quality.** No empty asserts, no tautologies.
`PACT(a)` is notably well-constructed: it pins the scaffold by comparing the lifted `<style>`
against a reference plan render rather than by string-matching a class name, so it fails if the
wrong template is loaded even when the markup superficially matches. The negative assertions
(`doesNotMatch` on both `Execution Plan` and `QA Report`) correctly pin the *absence* of both the
old fallback and the sibling label. `PACT(b)`'s `deepEqual(validateHtml(...), [])` is the strong
form — it asserts the exact problem list, not merely truthiness.

**One real gap found — and it was created by the simplify pass.** The simplification split the
prefix map into `SCAFFOLD` + `KICKER_BY_PREFIX` and changed the prefix extraction from a
`replace`-based regex to a `match`-based one. That is a refactor of the resolution path for
**every** artifact type in the pipeline. Yet before this report, only 3 of the 9 prefixes
(`SPEC`, `FEAT`, `PACT`) were exercised by any test — `FIX`, `QAF`, `TEST`, `CR`, `QA`, and
`FINAL` had **zero** coverage of their mapping.

Line coverage did not show this: the lookup line executes on every render, so it reported as
covered while a third of its table was verified. This is precisely the case Step 4's "lowest-covered
code paths" is meant to catch, and a coverage percentage alone would have missed it.

I confirmed the gap was a *test* gap and not a defect — all 9 prefixes resolve correctly today, so
the simplify pass introduced no regression. `MAP(a)`/`MAP(b)` now lock the behavior in.

**Mutation-checked the new tests** (in a scratch copy, to prove they earn their place rather than
merely passing):

| Mutant | Caught by |
|---|---|
| `TEST: 'test-report'` → `'qa-report'` | **`MAP(a)` only** — no other test in the suite detects it |
| `KICKER_BY_PREFIX` emptied | `PACT(a)`, `PACT(c)`, `MAP(a)` |
| `PACT: 'plan'` removed from `SCAFFOLD` | `PACT(a)`, `PACT(b)`, `MAP(a)` |

The first row is the justification for `MAP(a)`: re-pointing an established artifact type to the
wrong scaffold was previously an undetectable change.

**Pre-existing red suites — claim verified, not assumed.** Ran `gate-scope.test.cjs` and
`gate-shell-injection.test.cjs` in a detached `HEAD` worktree: red there with identical failure
counts (24 and 3). Every failure is `MODULE_NOT_FOUND` on a *materialized* `.orchestrator/`
path (e.g. `…/orchestrator/.orchestrator/gate-scope.cjs`) that exists only in a bootstrapped target
project, never in this authoring repo. Unrelated to this diff, out of scope, left untouched.

## Verdict

**PASS.**

- Selected e2e flow green; full renderer suite **45 pass / 0 fail**.
- Coverage 97.89% line on the sole runtime file — floor of 70% met with a wide margin; the branch
  regression the change introduced is recovered and improved on baseline.
- AC 4's TDD obligation independently verified red-before/green-after against the pre-change renderer.
- Phase 1 gate (`config.template.json` parses) exits 0. Sibling suites `check-artifact-pairing`
  and `gate-target-guard` green.
- Test-quality audit found no weak assertions and one coverage gap, now closed.

Handing to the reviewer. Two items are outside a tester's reach and deserve the reviewer's
attention, since they carry this plan's real risk and no test can speak to either:

1. **AC 14** — the `parallelism=off` byte-identical no-op. This is the plan's load-bearing
   backward-compatibility claim and is a pure document-diff argument.
2. **The three items the simplify pass explicitly skipped and routed to review** (Step 2L's global
   architect barrier, `full` mode's per-lane reviewer buying no concurrency, and the mandatory
   `.progress.md` reads) — flagged as design questions, not cleanups, and still open.
