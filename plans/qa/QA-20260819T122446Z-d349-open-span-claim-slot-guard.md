---
id: QA-20260819T122446Z-d349
plan: FIX-20260819T113512Z-438c
cr: CR-20260819T121737Z-7abb
title: QA Report — Replace the closed span-shape census with an open form and repair the slot guard
status: READY_WITH_WARNINGS
created_at: 2026-08-19T12:24:46Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260819T113512Z-438c](../code-review/FIX-20260819T113512Z-438c-open-span-claim-slot-guard.md) · [CR-20260819T121737Z-7abb](../code-review/CR-20260819T121737Z-7abb-open-span-claim-slot-guard.md) · [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md) · [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md)

## Summary

QA'd the **whole aggregate change set** against base `d297e6c` — the parent FEAT plus both FIX cycles — not just cycle 2's slice. The change set is **19 files, every one of them `.md`**: zero source-code files, so no executable path exists to test and the Clean Code code gates have no subject matter. All three no-regression floor suites pass, the generated distribution verifies in its strong form, and the four substantive claims this QA was asked to establish all hold: no figure moved across all three cycles, the rewritten rule genuinely derives its dependents, the three-slot guard is correct and complete, and the open claim at `config.md:234` survives a post-edit, post-regeneration census with **exactly one** normative definition of the shape.

Verdict is **READY_WITH_WARNINGS**, not READY_TO_COMMIT, for one reason: G8 exceeds threshold on the aggregate framing (1.33). No blocking check fails. QA additionally discovered one small accuracy item the reviewer never saw (`ADR-0014 §5`'s slot count, now falsified by this change set) and confirmed two pre-existing ambiguities that this change set did **not** introduce.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| `clean-code-gates` (`cd plugins/my-skills/skills/clean-code-gates && npm test`) | 225 | 225 | 0 | 0 | ✅ |
| prime-agent (`cd prime-agent && npm test` — install + parity) | 2 | 2 | 0 | 0 | ✅ |
| Generated-tree check (`node scripts/build-prime-agent.mjs --check`) | — | — | — | — | ✅ exit 0 |
| Lint | — | — | — | — | N/A — none configured for markdown in-repo |
| Build / typecheck | — | — | — | — | N/A — no build step for doc-skill authoring |
| Format check | — | — | — | — | N/A — none configured |

**Scope honesty.** The two `npm test` suites cover **entirely unrelated surface** — no file under `plugins/my-skills/skills/clean-code-gates/**` or `prime-agent/tests/**` is in this change set. They are recorded as a **no-regression floor**, not as evidence about this change. `PROJECT-CONTEXT.md` is explicit that the `clean-code-gates` suite must not be treated as a gate on non-JS doc skills.

**`--check` is the strong form.** `git status` cannot show a clean tree here because the pipeline never commits; every edit in all three plans is still uncommitted. `--check` exit 0 is the load-bearing statement instead: it asserts the on-disk `prime-agent/skills/` equals a fresh regeneration from `plugins/my-skills/skills/` plus `prime-agent/overlays/*.json`, and it hard-fails on overlay-anchor occurrence-count drift. It passed on 11 skills / 154 files.

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | **INAPPLICABLE** — see below |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | **INAPPLICABLE** — 0 code files changed |
| G3 Length & nesting | subsumed by G2 | — | **INAPPLICABLE** — 0 code files changed |
| G4 Naming | intent-revealing | 0 violations | **INAPPLICABLE** — 0 code files changed |
| G5 No comments | inline comment audit | 0 violations | **INAPPLICABLE** — 0 code files changed |
| G6 Mutation score | killed / total | ≥70% | **INAPPLICABLE** — no executable path |
| G7 Dependency structure | layering, cycles | 0 violations | **INAPPLICABLE** — 0 code files changed |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ⚠️ **HIGH_REWORK** on aggregate (1.33); ✅ 0.0 plan-scoped |

### Why INAPPLICABLE and not BELOW_FLOOR

This is stated plainly because the distinction is load-bearing and prior QA runs on this repo have made the same call for doc-skill changes.

1. **Zero code files.** The aggregate change set vs `d297e6c`, including untracked files, is **19 files, all `.md`** (verified by extension census). There is no statement, branch, function, or import to measure. A coverage number here would not be low — it would be undefined.
2. **No executable path exists to cover.** `references/config.md:14` declares `parallelism` default `"off"`, and `:51` states that with it unset or `off` "every role prompt, artifact, status line, and stdout header line is identical to the pre-feature pipeline"; `:611` confirms Steps 2p/2c/2s/2L/3L/3s/3j are "skipped entirely". The `full` level with `k ≥ 2` — the only path that prints the edited block — is unreachable in this repo.
3. **Fabricating a harness would be the defect, not the fix.** A behavioural test here would test a scaffold invented for the test. `PROJECT-CONTEXT.md` → *Test tooling* is explicit that doc-skill verification is structural review and that coverage is "not measured except within `clean-code-gates`". The plan's own Verification section reaches the same conclusion (`:237`).

Verification was therefore **structural and arithmetic**, executed below rather than skipped.

### G8 — computed both ways, because the framing changes the answer

| Framing | REQUEST_CHANGES | FIX/QAF spawned | Total CR | Ratio | Result |
|---|---|---|---|---|---|
| Plan-scoped (`FIX-…438c` only, per role spec) | 0 | 0 | 1 | **0.00** | ✅ PASS |
| Aggregate (the unit actually under evaluation) | 2 | 2 | 3 | **1.33** | ⚠️ HIGH_REWORK |

The aggregate breach is real and is why this report is READY_WITH_WARNINGS. But the convergence claim was checked rather than accepted, and it holds — independently, from CR frontmatter:

- `must_fix_count`: **3 → 2 → 0** (`CR-…fc4f` → `CR-…9e42` → `CR-…7abb`). Monotonic to zero, and stronger than the "3 → 2 → 1" the handoff reported.
- `should_fix_count`: 2 → 3 → 3 — flat, not growing into the Must Fix band.
- Failure mode changed **kind**: arithmetic wrong in normative sites → census false in the shipped tree → a provenance clause over-reaching by one item that moves no figure. Cycles 1–2 failed on *self-invalidating* constructions (a closed census, a count) that decay on their own; the surviving item is *static* — wrong today, exactly as wrong tomorrow.

This is a converging series, not churn. HIGH_REWORK is surfaced for human root-cause attention (the root cause is consistently **plan defects propagated faithfully by the coder** — the CR attributes both cycle-2 findings to plan ACs, not to execution), and it does not block.

## What QA independently established

### 1. No figure moved, across all three cycles — CONFIRMED, with the convention pinned

**Convention (mine, stated explicitly).** The worked-example region is the contiguous block of `references/config.md` from the line `#### Worked example — the gate verdict and the ladder figure must agree` up to but excluding `#### Greedy, recomputed adoption`. A *numeral* is a maximal run of `[0-9]` — so `12` is one numeral and `0.25` is two (`0` and `25`). Numerals are compared as an ordered sequence, not a multiset, so a transposition would fail.

| Measure | base `d297e6c` | working tree | Verdict |
|---|---|---|---|
| Region size | 16,115 chars / 123 lines | 16,227 chars / 123 lines | +112 chars |
| Numeral count | **507** | **507** | equal |
| Numeral sequence md5 | `e567488ab3d45697d64100e80c6fda00` | `e567488ab3d45697d64100e80c6fda00` | **identical** |
| Region byte md5 | `d42825292888560e3e20d7f142f13806` | `b65ab7cb479544f5a3c5701c4a016575` | **differs** |

**The region is *not* byte-identical, and the reviewer's and tester's framing should be read with that nuance.** There is exactly one change in it, at region line 114 — a prose clause, no figure:

```diff
-`g` = `24 − 16` = **8**. Via the cancellation identity, `g` = `M − S` = …
+`g` = `24 − 16` = **8**. Via the cancellation identity (*The makespan model*, above), `g` = `M − S` = … as it must be: `X` is common to both slice sets and cancels by construction, not by coincidence.
```

My count independently lands on **507**, matching the reviewer's figure on a different convention. The 448 → 505 → 507 drift recorded across cycles is convention drift, as diagnosed.

**Second, independent check — every figure re-derives by hand.** A separate agent re-derived all five worked examples from the rule text alone, recomputing `span(L)`, `span_max`, `span_base`, `g`, `c`, `M_flat`, `M_nested`, `M_seq`, `T`, and both the reconciliation and cancellation identities, taking no printed intermediate on faith. Result: **zero disagreements** across all five examples, including every percentage (66.7, 33.3→33, 63.16→63, 21.05→21, 47.6→48, 91.7→92, 28.6→29) and both identities in every example that prints them.

### 2. The rewritten rule genuinely derives its dependents — CONFIRMED, with one pre-existing caveat

`span(L)` at split level (rule over the lane's sub-lane set with its declared `i(L)`), `span(L)` at leaf level (`tasks(L)`), `span_max` (rule over the run's lane set), `M_flat`'s span term (now *referenced by name*, never re-expanded), and the viable-flat `span_base` all derive from `config.md:227` without a quantity changing meaning while keeping its number. `T` and `M_seq` are stated as **not** applications at their definition site (`:252`: "**`T` is a sum, not an application of the span rule**") and twice more (`:234` forward declaration, `:260` baseline table, `:262`).

The change here is a genuine improvement and was measured: the `M_flat` bullet previously re-expanded the span term inline (`max` over non-integration lanes of `tasks(L)` plus `tasks(integration)`); it now names `span_base` and adds "The span term is referenced by name here and nowhere re-expanded."

### 3. The `SKILL.md:544` three-slot guard is correct and complete — CONFIRMED

Filling `:531`/`:533`/`:534` for worked example 5 from `:544`'s text alone:

- `:531` `Nested plan:` — critical leaf is `frontend` at 12, whose lane declared no adopted slice → slot **omitted**, per "a declared `none` … omits the `Nested plan:` slot entirely".
- `:533` `span({lane})` — candidate split's **own** declared count; `backend` split `{8,8}` with `integration: none` → `max(8, 8) + integration(0) = 8`. ✅
- `:534` `span_max` — **lane-level** declared count; second-largest span over the *other non-integration* lanes = `max(12, 6) = 12`; → `max(12, 8) + integration(4) = 16`. ✅
- `:535` → `g = 24 − 16 = 8`. ✅

**The mis-fill is unreachable from the guard's text.** Copying `:533`'s `integration(0)` into `:534` yields `span_max = 12` and `g = 24 − 12 = 12`; `:544` forbids exactly this in terms ("the `span_max` slot **never copied from the line directly above it**", and it "carries the **lane-level** declared count"). `grep` confirms neither `24 − 12` nor `= 12` appears anywhere in the orchestrator skill — the counter-example is recorded in the plan, never printed.

**Completeness checks that could have failed and did not:** the guard cites "the `Integration lane:` line of the block above" as the lane-level source — that line genuinely exists at `SKILL.md:504` in the flat block, so the pointer resolves. `second_largest_span`, which `:534` needs but `:544` does not define, is defined at `config.md:312` (SF-1's ACCEPT ruling) as the max over the post-adoption set's **other non-integration** lanes with the run's integration lane excluded, plus the double-charging warning — and it was added *outside* the `:309` fence, adding no numeral, as AC-17 required.

### 4. The open claim at `config.md:234` holds over the post-edit, post-regeneration tree — CONFIRMED

A full census over `config.md`, `SKILL.md`, `templates/architect.md`, ADR-0016, ADR-0017 and both generated mirrors found:

**Normative definitions of the shape: exactly 1** — `config.md:227`, with base cases at `:230`.

Everything else classifies as **12 applications, 12 illustrations, 3 displays**, plus 1 citation in ADR-0017 and 2 referential-only mentions in `templates/architect.md` (confirming ADR-0017 `:5`'s claim that the template restates no formula). Every site found is covered by `:234`'s universal classification; none escapes it. The nearest miss — ADR-0016 §2 `:58`–`:60`, which writes the shape summand-by-summand as a bare equality — is an **application**, not a competing home, on three independent grounds: ADR-0016 §7 itself disclaims arithmetic ownership ("`references/config.md` owns the arithmetic"), ADR-0017 §2 re-labels exactly those quantities as applications, and ADR-0017's Consequences state the one-site bound.

### 5. The generated tree matches source — CONFIRMED (strong form)

`--check` exit 0. The only source↔mirror difference in `references/config.md` is one intentional overlay (a relative ADR link rewritten to an absolute GitHub URL at `:86`), unrelated to the shape; `SKILL.md`'s entire Step 2p.2 region is byte-identical between source and mirror, and the mirror carries both edits (`+ integration({n})` on the `span_max` line, and the three-slot guard).

## Failures

**None — all suites passed.** 0 test failures, 0 lint errors, 0 type/build errors.

## Findings (non-blocking)

### QA-N1 — NEW: `ADR-0014 §5`'s slot count is falsified by this change set

**File**: `docs/adr/0014-integration-slice-first-class-digest-field.md:87`

> The printed nested block already reserves **two** slots — `+ integration({n})` inside the `span({lane})` line and `{, + integration sub-lane {n}}` on the `Nested plan:` line.

This change set added a third integration slot to the nested block (`SKILL.md:534` gained `+ integration({n})`), and `SKILL.md:544` now reads "The **three** integration slots". ADR-0014 §5 is Accepted, carries no supersession note on this point, and is listed in **ADR-0017 `:147` under the heading *What stands*** as "ADR-0012, ADR-0013, and ADR-0014, **unamended**".

**Why this was missed upstream, and why it matters.** AC-20 scoped the census to `config.md`, `SKILL.md`, `templates/architect.md`, ADR-0016 and ADR-0017 — **ADR-0014 is not in that list**. AC-26 and the plan's Phase 5 checks did verify ADR-0012/0013/0014 are `md5`-**identical**, i.e. *unamended* — but never asked whether they remain *true*. Note the asymmetry inside ADR-0017 `:147`–`:149` itself: ADR-0013 is called out "**explicitly so**" with a figure-by-figure re-derivation; ADR-0012 and ADR-0014 get the label without a truth re-check.

**Why non-blocking.** It moves no figure; ADRs are point-in-time records in this repo and the amendment *is* recorded, at ADR-0017 `:5`, which names the nested block's `span_max` line as amended; and no gate independently fails. It is the same count-decay class the CR ruled Should Fix three times.

**Why it should still be recorded.** It is the fourth instance of that class, it was **caused by this change set** rather than inherited, and it is a direct instantiation of SF-3's structural gap — read as the dual of SF-3's oracle: *any ADR section describing a site must be re-read when that site changes*, not merely confirmed unedited. `unamended ≠ still accurate` is the exact confusion.

### QA-N2 — PRE-EXISTING (not a regression): `M_flat`'s interface term omits the 0.25 conversion

`config.md:251` ("plus the parent contract's interface-point count") and `:259` ("`A + J +` parent interface points") state the interface term as a raw **count**, while `M_nested`'s term and the cost side both state the `0.25 task-equivalents each` conversion inline. Read literally, worked example 5 gives `M_flat = 24 + 2 + 2 + 4 = 32` and the reconciliation breaks (`32 − 25.5 = 6.5 ≠ g − c = 3.5`); the printed **29** requires the 0.25 reading. Invisible in examples 1–4, which all have parent `I = 0`.

**Confirmed not introduced here.** The `git diff` of both lines shows the interface clause is **byte-identical** on either side of `d297e6c`; this change set rewrote only `M_flat`'s *span* term (an improvement — it now references `span_base` by name) and added the `M_seq` disclaimer. Out of scope for this change set; handed forward.

### QA-N3 — PRE-EXISTING (not a regression): worked examples 2 and 3 label a sub-lane-set span as `span_max`

In examples 2 and 3 the cell headed `span_base / span_max` prints `max(8, 8, 8) + 0` and `5 + 6` — the rule applied to **mobile's sub-lane set**, i.e. `span(mobile)`, not to the run's lane set as `span_max` is defined. The numbers coincide only because the other five lanes carry 0 tasks and `X = 0`. This is precisely the "quantity keeps its number while its slice set changes" failure mode, and it is worth naming because ADR-0017's central claim is that each quantity is *the rule applied to a named slice set*.

**Confirmed not introduced here** — the worked-example region is unchanged apart from the single prose clause at region line 114. Example 5 is the one example that shows the run-level application honestly, with separate `non-integration term` and `+ tasks(integration)` rows. Illustration-only; handed forward.

### The three CR Should-Fix items — each independently confirmed non-blocking

- **SF-1 (ADR-0016 §5 over-attribution)** — verified directly, not taken on report. §5's heading is `### 5. Step 2p.2's flat print block divides by span_base`; its body touches only `Estimated speedup:`, `Integration lane:`, `Fixed overhead:`, `Interface points to freeze:`, all flat-block lines; the word "nested" does not appear in §5. `config.md:208` and `:234` do over-attribute the plural — **exactly the known defect, nothing worse**, and confined to those two sites (0 hits elsewhere). ADR-0017 makes the attribution in 4 passages and **scopes it correctly in every one**. Decisively, the *instruction* attached to the false citation is correct and in fact stronger than §5 alone would license: both sentences end by requiring the change be hand-carried into those blocks, so the dangerous inference ("the nested block is protected") is contradicted in the same sentence. Non-blocking confirmed.
- **SF-2 (`:208`'s count)** — confirmed true today, self-invalidating in shape, one clause to repair, shares SF-1's fix. Non-blocking confirmed. QA-N1 above is the same pattern one file further out.
- **SF-3 (structural: attribution correctness at named sites)** — confirmed as the real structural residue. QA-N1 is new evidence for it and extends the proposed oracle in the dual direction.

## Lint / Format / Type Issues

**None — all checks clean.** No lint, format, build, or typecheck tooling is configured for markdown in this repo (`PROJECT-CONTEXT.md` → *Commands*), and no source-code file is in the change set.

## Method note — a tooling hazard that affected verification

The shell's `diff` is proxied in this environment and **returned a false "Files are identical" on two files that genuinely differ**, exit code 0. Reproduced on a 3-line control pair. It also mis-reported the source↔mirror `config.md` comparison as identical when it carries a real one-line overlay difference.

Every byte-identity assertion in this report was therefore made with `cmp`, `shasum`/`md5`, or `git diff --no-index` — never with bare `diff`. **Recommendation for the next touch of this change set**: any byte-identity claim in the FEAT/FIX plans, TEST reports, or CRs that was established with bare `diff` should be re-confirmed with `cmp` before being relied on. The claims QA re-checked independently (the worked-example region, the `:309` fence, the mirrors, the Step 2p.2 region) all hold — but they were re-checked, not inherited.

## Observations (no action required)

- **Per-cycle byte-identity claims are not re-derivable by QA.** All three plans' edits are uncommitted, so git offers only the aggregate base `d297e6c`. Against *that* base the `:309` fence is **not** byte-identical — it gained `+ tasks(i(run))`, which is cycle 1's intended MF-1 fix. AC-5's byte-identity pin was scoped to cycle 2's pre-edit tree and QA cannot reconstruct it; the reviewer verified it in-cycle. Recorded per AC-19's own discipline that every byte-identity figure names its baseline.
- `CR-20260819T121737Z-7abb` carries `cycle: 3` while its plan carries `cycle: 2`. Metadata only.
- All three plans are `status: DONE` with **zero** unchecked tasks (64 / 79 / 68 checkboxes complete). All three TEST reports are `status: PASS`.
- `config.md:234`'s hand-carry instruction ("every site that writes the shape out") is unscoped and would, read literally, reach the immutable ADRs — which ADR-0017 `:139` explicitly declines to re-inline. A wording risk, not a second definition.

## Verdict

**Status**: READY_WITH_WARNINGS

All blocking checks pass — 227 tests green across three floor suites, generated tree verified in its strong form, zero lint/type/build errors, and all four substantive claims independently established — but G8 is 1.33 on the aggregate framing (HIGH_REWORK).

Plan can ship; flag for human root-cause investigation. The rework is **converging, not churning** (`must_fix` 3 → 2 → 0, failure mode static rather than self-invalidating), and the consistent root cause is plan defects propagated faithfully by the coder rather than execution error — that is the thing worth investigating. Carry QA-N1, QA-N2, QA-N3 and the three CR Should-Fix items into the next touch of `references/config.md`; QA-N1 and SF-1/SF-2 share a single repair theme, and none of them moves a figure.
