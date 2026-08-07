---
id: TEST-20260807T035031Z-230c
plan: FEAT-20260807T030642Z-6077
title: Test Report — Nested inner-lane parallelism — redefining the orchestrator's `full` level
status: BELOW_FLOOR
created_at: 2026-08-07T03:50:31Z
cycle: 0
---

**Related:** [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md)

## Summary

The plan's diff is **entirely prose** — 10 markdown files plus one JSON config template under
`plugins/my-skills/skills/{orchestrator,product-manager}/`, 743 insertions / 136 deletions,
**zero** files under `scripts/` or `templates/html/`. Per `PROJECT-CONTEXT.md` → *Test tooling*,
this repo has no e2e framework and measures coverage only inside `clean-code-gates`; doc-skill
changes are verified by **structural review**, and the plan's own five per-phase grep assertion
sets are the designated substitute gate.

I therefore added **no e2e tests** (correctly — see triage) and ran the substitute gate instead.

**Result: 4 of 5 phase gates green; Phase 3 is RED on 3 assertions.**

The three Phase 3 failures are **prose/gate drift introduced by the mandatory simplify pass**
(`.progress.md` → `2026-08-07T04:05:00Z | SIMPLIFY`), which ran *after* the coder's green run at
`03:37` and deliberately de-duplicated the exact prose those assertions require to be duplicated.
The **substance** of the underlying acceptance criteria survives in reworded form — I verified this
by reading, not by assuming — but the plan's own gate no longer passes against the tree it gates.

The process gap: the simplify pass re-ran `node --test render-artifact.test.cjs` (a suite this plan
does not touch) but **did not re-run the plan's five phase gates**, which are the only gate that
actually covers this diff.

## Flows Triaged

`PROJECT-CONTEXT.md` → *Critical flows*: "Skill behaviors are verified by review of prose/templates,
not execution." There is no runnable surface in this diff, so every candidate flow scores **zero on
"not-covered-by-unit"** in the e2e sense — there is nothing to drive end-to-end.

| Flow | Criticality (impact × breakage × not-unit-covered) | Decision | Rationale |
| --- | --- | --- | --- |
| Orchestrator `full` nested dispatch (2p → 2c → 2s → 2L → 3L → 3s → 3j) | High × High × **N/A** | **Excluded from e2e** | The "flow" is a numbered prose procedure executed by an LLM subagent chain, not code. No harness can drive it. Covered by the Phase 3 assertion set instead. |
| `PACT` ID resolution walking `Sub-contract` one level | High × Med × **N/A** | **Excluded from e2e** | Normative prose in `references/artifact-format.md`. Verified by Phase 2 assertions (one-level-only, leaf-set `DONE`, legacy absent column = all-flat). |
| Backward compat: `off` byte-identical, `lanes` unchanged | High × Med × **N/A** | **Excluded from e2e** | Prose guarantee. Verified by Phase 5 assertions + the renderer suite as a collateral guard. |
| HTML artifact rendering (`render-artifact.cjs`) | High × **Low** × Covered | **Excluded from new e2e; run as regression guard** | Real executable surface, but **untouched by this diff**. Ran the existing 45-test suite unchanged as a collateral-regression check. Adding e2e here would test a prior commit's work. |
| `config.template.json` ≡ canonical default object | Med × Med × Low | **Covered by existing Phase 4 assertion** | Already a real executable check (Python `json` load + deep equality). No addition needed. |
| PM → orchestrator ladder / resume interaction | Med × Med × **N/A** | **Excluded from e2e** | Cross-skill prose contract; Phase 5 assertions cover it. |

**Justification for adding zero e2e tests:** e2e is expensive and must buy real signal. Every
high-criticality flow in this diff is prose executed by an agent, with no addressable entry point.
Writing an e2e harness would mean building a runtime for a documentation change — squarely inside
`PROJECT-CONTEXT.md` → *Out of scope* ("Running language/build/test tooling against markdown doc
skills"). The honest substitute is the structural gate, which I ran in full.

## E2E Tests Added

**None.** See triage rationale above. No test file was created or modified by this role.

## Coverage

| | Before | After |
| --- | --- | --- |
| Line coverage (this plan's diff) | **N/A — not measurable** | **N/A — not measurable** |

The diff contains **zero lines of executable code**. `PROJECT-CONTEXT.md` → *Test tooling* states
coverage "is not measured except within `clean-code-gates`", and *Invariants* forbids invoking that
suite against non-JS doc skills. The 70% floor is therefore **inapplicable, not missed** — there is
no denominator.

### Executable suites run (collateral-regression guards, not coverage targets)

| Suite | Result |
| --- | --- |
| `scripts/render-artifact.test.cjs` | **45 pass / 0 fail** |
| `scripts/check-artifact-pairing.test.cjs` | **pass / 0 fail** (3 sub-cases) |
| `scripts/gate-target-guard.test.cjs` | **pass / 0 fail** (7 sub-cases) |

### Pre-existing red suites — verified at the merge-base, not assumed

`scripts/gate-scope.test.cjs` and `scripts/gate-shell-injection.test.cjs` fail on
`MODULE_NOT_FOUND` for `…/orchestrator/.orchestrator/gate-scope.cjs`, a path that exists only in a
bootstrapped target project (`scripts/README.md` documents them as runnable only from there).

I did **not** assume this. I created a worktree at the merge-base (`974b01a`, `git merge-base HEAD
origin/main`) and ran both suites there:

| Suite | Merge-base `974b01a` | HEAD + working tree |
| --- | --- | --- |
| `gate-scope.test.cjs` | 1 test / **0 pass / 1 fail** | 1 test / **0 pass / 1 fail** |
| `gate-shell-injection.test.cjs` | 1 test / **0 pass / 1 fail** | 1 test / **0 pass / 1 fail** |

Identical failure signature at both points, down to the inner per-case pass lines. **Pre-existing;
not caused by this plan; not fixed here** (per instruction). Worktree removed after the run.

## Structural Gate — the plan's five assertion sets

Run from the repo root as the plan specifies (`bash /dev/stdin <<'GATE'` with `set -euo pipefail`).

| Phase | Target | Result |
| --- | --- | --- |
| 1 | `references/config.md` | **OK** |
| 2 | `references/artifact-format.md` | **OK** |
| 3 | `SKILL.md` | **RED — 3 assertions fail** |
| 4 | `templates/architect.md`, `coder.md`, `config.template.json` | **OK** |
| 5 | cross-skill, backward-compat, reachability | **OK** |

### The three Phase 3 failures

Each verified with `/usr/bin/grep` inside a heredoc — the interactive shell here proxies `grep`
through an `rtk` shim that alters exit codes, so top-level results are not trustworthy for negative
assertions. The gates themselves run inside heredocs and used the real binary.

**F1 — requirement-53 audit line.**

```
grep -qi 'no level-specific behavior may be specified only inside a join step' SKILL.md   → FAIL
```

The rule is present, reworded, at `SKILL.md:1222`:

> Never specify a level-specific behavior only in a join step or in ladder option text — every one
> needs a numbered dispatch step. (This is why the previous `full` never ran: it was described only
> inside the join and the ladder, so there was nothing to spawn.)

**Attribution:** simplify fix #5 deleted `3j.4` (which carried a dangling "requirement 53"
reference) and preserved the authoring rule "as one line in Rules" — reworded. AC 9's substance
holds; the literal pattern does not.

**F2 / F3 — halt-amend precedence in `3j.1` and `3j.2`.**

```
awk '/^#### 3j.1 /,/^#### 3j.2 /' SKILL.md | grep -q 'amendment loop is evaluated first'   → FAIL
awk '/^#### 3j.2 /,/^#### 3j.3 /' SKILL.md | grep -q 'amendment loop is evaluated first'   → FAIL
```

The precedence rule was **hoisted out of both subsections** into a single blockquote at
`SKILL.md:811`, in the Step 3j preamble *above* the `3j.1` heading (line 841):

> `contract violation` **and** `amendment_count < max_contract_amendments` → the amendment loop
> (3j.2), evaluated **first**. Every other reason — including `lane boundary` — and any violation
> past the cap → the `PARTIAL` halt (3j.1), applied to whatever remains after the amendment
> resolves.

introduced by: "This is the single statement of the precedence between the two halt paths, at the
one place the classification happens — and it holds identically at both depths."

**Attribution:** simplify fix #3, explicitly: "`3j.0` was a whole sub-step whose content was a
two-outcome dispatch table, restated at 3j.1, 3j.2, 3s, and again in its own consequences. Deleted;
one classification line now sits in Step 3j's ordered list."

**Substance check (read-through, not grep).** The plan task behind F2/F3 required that "neither
subsection may still describe itself as firing unconditionally." I read both:

- `3j.1` opens "Reached for the leaves **Step 3j's classification routed here**."
- `3j.2` opens "Reached for the leaves **Step 3j's classification routed here** — a `contract
  violation` with budget remaining."

Neither is unconditional. AC 11's five clauses all survive — amendment-first (`:811`), narrowest
contract (`:797`, `:869` table), parent amendment re-authors affected sub-contracts (`:869`), one
shared budget (`:879`), exhausted budget → `PARTIAL` halt (`:883`).

**This is a genuine tension, not a formality.** The de-duplication is defensible on the project's
own *single-source-of-truth* convention (`PROJECT-CONTEXT.md` → Conventions), and the plan's
Technical Notes explicitly warn "Never duplicate a rule into two files." But the plan's Phase 3
task and gate demanded the rule appear in **both** subsections. Those two instructions now conflict,
and the tree satisfies the convention while failing the gate.

**I did not resolve it.** The plan states: "No silent rewrite of a rule to make an assertion pass
without a corresponding plan task." The assertion sets live in the architect's plan file and the
prose lives in production skill source — both outside a tester's write scope. This is a reviewer
decision: either reword `SKILL.md:1222` / re-state precedence inside `3j.1`+`3j.2` to match the gate,
or amend the plan's Phase 3 gate to match the simplified prose, with a Progress Log entry either way.

### Assertion 14c — a false alarm worth recording

```
! grep -n 'tester and a reviewer' SKILL.md | grep -qv 'previously'
```

`'tester and a reviewer'` has **0 occurrences** in `SKILL.md`. This assertion **passes** under the
gate's stated `set -euo pipefail` and **fails** without it — its verdict is decided by a shell
option, not by file content. Under the plan's specified invocation it is green. Flagged below as a
weak test.

## Additional structural checks (beyond the plan's gates)

Run because a deletion-heavy simplify pass is exactly where dangling internal references appear.

| Check | Result |
| --- | --- |
| Every `Step {N}` reference in `SKILL.md` resolves to a real heading (36 headings, all refs incl. `0b`/`0c`/`0r`/`2L`/`3L`/`2p.3n`) | **0 unresolved** |
| Refs simplify claimed to have removed: `3j.0`, `3j.4`, `requirement 53`, `Full lane pipelines` | **0 hits repo-wide** — claim verified |
| `leaves=` preamble contract: defined in `SKILL.md:142,150`, consumed in `tester.md:23`, `reviewer.md:26`, `qa.md:35` | **consistent** — the templates' promised input is actually documented as supplied |
| All 9 cross-referenced skill files exist on disk | **9/9 ok** |
| `config.template.json` ≡ canonical default object (deep equality) | **equal**; `max_parallel_lanes: 6` present |
| `git diff --name-only HEAD -- scripts/ templates/html/` | **empty** — no renderer/scaffold change |

### One observation for the reviewer (not a defect)

`templates/qa.md`, `templates/reviewer.md`, and `templates/tester.md` are in the diff but appear in
**none** of the plan's 18 acceptance criteria file lists. They are legitimately in scope via the
Phase 5 task "Sweep the whole repo for surviving statements of the shipped `full` meaning" — the
coder recorded exactly this in its Phase 5 findings — and the changes are correct. Recording it so
the scope delta is visible rather than silent.

### Environment note

This repo's own `.orchestrator/` is a stale materialization: `artifact-format.md` has **diverged**
from the skill source and `config.md` is **absent** (never tracked — `git log` empty). This is
pre-existing bootstrap staleness, not a plan defect: B3 re-materializes both on the next bootstrap,
and the Phase 5 gate correctly asserts `SKILL.md` **names** both copies (it does). Worth knowing
because a dogfooded run on this repo today would not see the new normative `config.md` rules.

## Test-Quality Audit

The coder's assertion sets are **unusually strong for grep-based structural tests** — byte-exact
`grep -qF` on pre-existing stdout rows, `awk`-scoped range assertions instead of whole-file
substring hits, and a real Python deep-equality check on the config template. The Progress Log
documents three assertions *corrected* after the fact with reasons, and records a near-miss where an
aggregate run "exited 0 while executing zero assertions" (a vacuous green) caught by asserting the
block count. That is the opposite of assertion-laundering and deserves saying.

Weak assertions found (none invalidate a result; all are precision, not correctness):

| Location | Assertion | Problem |
| --- | --- | --- |
| Phase 1 | `grep -q 'leaf' "$C"` | Bare 4-char substring in a file whose whole subject is leaves. Passes on any incidental use; proves nothing specific. |
| Phase 1 | `grep -q '2s' "$C"` (under *absent-key tolerance*) | Stands in for a claim about tolerance being extended, but `2s` is a two-char token matching anything. Near-tautological. |
| Phase 1 / 2 | `grep -q 'sublanes'`, `grep -q 'sub-contract'`, `grep -q 'Sub-contract'` | Unanchored presence checks. Confirm a word was typed, not that a rule was stated. |
| Phase 3 | `awk '/^### Step 3s /,/^### Step 3j /' \| grep -q 'parent'` | "parent" appears in nearly every sentence of that section. **Tautological** — cannot fail if the section exists. |
| Phase 3 | `grep -q 'narrowest' "$K"` | Bare word, whole file, no scope. |
| Phase 5 | `! grep -q 'passes --resume' "$PM/…"` | Negative assertion on an exact phrase nobody would plausibly write. **Vacuous** — cannot fail. |
| Phases 1/3/5 | `! grep -n 'tester and a reviewer' … \| grep -qv 'previously'` | Verdict flips with `pipefail`. Worse: with **0** occurrences it passes for the wrong reason — it cannot distinguish "phrase absent" from "phrase present and correctly marked historical", which is the property requirement 65 actually cares about. |

**No empty assertions and no disabled/skipped checks were found.** The dominant systemic weakness is
the one F1–F3 exposed: **assertions pinned to exact prose wording are brittle against a downstream
prose-editing pass.** Scoping them to a section and asserting the *claim* (e.g. that `3j.1` names its
entry condition) rather than a sentence would have survived the simplify rewrite intact.

## Verdict

**BELOW_FLOOR.**

Not `PASS`: this repo's designated verification gate for a doc-skill diff — the plan's own structural
assertion sets, which `PROJECT-CONTEXT.md` prescribes *in place of* coverage — is **red on 3 of ~158
assertions**, against the very tree it gates.

Not `BLOCKED`: all tooling ran. Four of five gates are green, every executable suite this diff could
regress is green, the two red suites are proven pre-existing at the merge-base, and no cross-reference
dangles.

The literal coverage floor is inapplicable (zero executable lines in the diff), so `BELOW_FLOOR` here
means **the structural gate did not fully pass**, not that a percentage fell short.

**Confidence that the failure is cosmetic is high but not total** — I confirmed by reading that AC 9
and AC 11 are substantively satisfied by the reworded prose. But "the gate is red and the substance is
fine" is a judgment the reviewer should ratify explicitly, not one a tester should absorb by relaxing
a gate it does not own.

**For the reviewer — pick one, and log it:**

1. Restore the two sentences to the patterns the Phase 3 gate expects (smallest change; re-introduces
   the duplication simplify removed on single-source-of-truth grounds), **or**
2. Amend the Phase 3 gate's three assertions to match the simplified prose — scoped and claim-based
   rather than sentence-exact — with a plan task recording why.

Either way the simplify pass should re-run the plan's phase gates, not only the JS suite, before a
diff like this is handed on.
