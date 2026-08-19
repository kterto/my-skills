---
id: TEST-20260819T042313Z-1acb
plan: FEAT-20260819T035826Z-835a
title: Test Report — Adopt ADR-0013 — overlap inner joins and reprice the inner-join level
status: PASS
created_at: 2026-08-19T04:27:43Z
cycle: 0
---

**Related:** [FEAT-20260819T035826Z-835a](../feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md)

## Summary

**No executable flow exists for this change; verification is structural and arithmetic.** This is stated plainly rather than worked around. The change edits `plugins/my-skills/skills/orchestrator/SKILL.md` and `references/config.md` (plus three ADRs) and regenerates the `prime-agent/skills/**` mirror. `parallelism` resolves to `off` by default in this repo, and the changed behaviour — `full` mode with `k ≥ 2` sub-split lanes — is unreachable here. **No run in this repository exercises the changed path, so no behavioural or e2e test can honestly be written.** None was invented, no harness was scaffolded for the unreachable path, and coverage was not padded. The plan, the spec, and PROJECT-CONTEXT all take this same posture, and it is the correct one.

What was verified instead, all by hand:

1. **Arithmetic** — all four worked examples re-derived from the model's own definitions; gate (`c`) and ladder (`M_nested`) reconciled independently on each.
2. **Internal consistency of the two halves** — every site describing the barrier (SKILL.md) checked against every site describing the charge (config.md).
3. **The three spec-added hazards** (3j's own barrier, the amendment loop's entry point, `max_parallel_lanes` accounting) — each traced through the shipped text.
4. **The determinism argument** — judged on whether it actually holds as written, not merely whether it is present.
5. **No-regression floors** — three suites, reported as a floor over unrelated surface.
6. **Generated-tree integrity** — builder drift guard, parity guard, and both near-miss exact-count overlay anchors.

**Verdict: PASS on every arithmetic and structural check, with three surviving stale prose sites flagged for the reviewer.** All three describe the deferred-gate discipline that this change moved, all three were left untouched, and all three have propagated into the generated tree. None is a race or a behavioural defect — Step 3s item 3 and Step 3j item 4 are explicit and unambiguous — but two of them actively invite a future editor to restore the gate-run step this change just removed. Details in *Test-Quality Audit*.

## Flows Triaged

Criticality scored as user impact × breakage likelihood × not-covered-by-unit. e2e is expensive; each inclusion and each exclusion is justified.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| `full` run, `k ≥ 2`, overlapped inner joins | n/a — **unreachable** | **Excluded from e2e** | The changed path itself. `parallelism` defaults to `off`; this repo's own orchestrator runs are sequential; a `full` run with `k ≥ 2` cannot be produced here. An e2e test would have to fabricate the entire multi-lane subagent fan-out it claims to exercise, which tests the fabrication, not the change. Excluded on honesty, not on cost. |
| Cost-model arithmetic (gate vs. ladder agreement) | **High** | **Included — hand re-derivation** | This is the only real check the cost model has, and both halves of the change land on it. Verified by independent re-derivation, not by grep. See *Arithmetic Re-Derivation*. |
| Barrier/charge internal consistency across both files | **High** | **Included — site-by-site audit** | The defect class this change exists to prevent is "gate and ladder on two accounts". A surviving site describing either half on the old terms recreates it. This audit is what found the three stale sites. |
| Generated-tree integrity (`prime-agent/skills/**`) | **High** | **Included — builder `--check` + parity** | The mirror is generated and never hand-edited; a hand edit is a bug the next build overwrites. Two overlay anchors are exact-count near-misses that hard-fail the build if disturbed. |
| `clean-code-gates` JS suite | Low (unrelated surface) | **Included as floor only** | Reported as a no-regression floor, not as evidence about this change. PROJECT-CONTEXT forbids running it *against* doc skills; it was run unchanged, on its own sources. |
| `prime-agent` install/parity suite | Low (unrelated surface) | **Included as floor only** | Same posture. Covers installer containment and rollback, not the cost model. |
| Determinism under wall-clock execution order | **High** | **Included — argument judged, not just located** | The change trades a global barrier for wall-clock execution order and claims observable order is still pinned at two surfaces. Whether that argument *holds* is the load-bearing question; whether the text *says it* is not. |

## E2E Tests Added

**None, deliberately.** See the first row of *Flows Triaged*. There is no executable code path for this change and no reachable configuration that would exercise it. Writing an e2e test here would mean building a harness that simulates the orchestrator's own multi-lane subagent fan-out and then asserting against the simulation — proving the harness correct, not the skill. The gap is named rather than filled.

## Coverage

| | Before | After |
| --- | --- | --- |
| Line coverage (this change's diff) | **N/A** | **N/A** |

**The 70% floor does not apply and this is not a BELOW_FLOOR result.** PROJECT-CONTEXT → *Test tooling* states it directly: *"No automated test framework for doc-skill changes. The tester role treats automated tests + coverage as N/A / advisory, not a hard block."* The changed files are markdown. There is no instrumentable code in the diff, so there is no coverage number to raise and nothing meaningful to add tests for. No coverage padding was attempted.

The one JS island in the repo (`clean-code-gates`) is untouched by this change and was run only as a floor.

### No-regression floors — unrelated surface, reported as a floor

These cover machinery this change does not touch. They are evidence that the markdown edit regressed nothing, **not** evidence about the change itself.

| Floor | Result |
| --- | --- |
| `cd plugins/my-skills/skills/clean-code-gates && npm test` | **213 pass / 0 fail** — matches the expected 213 baseline exactly |
| `cd prime-agent && npm test` | **exit 0** — `install ok` (preflight, containment, all-or-nothing install, mid-loop rollback) and `parity ok` |
| `node scripts/build-prime-agent.mjs --check` | **exit 0** — `prime-agent/skills is up to date (11 skills, 154 files)` |

## Arithmetic Re-Derivation

Every figure below was re-derived by hand from the model's own definitions in `references/config.md` → *The makespan model* and *The cost side*, then checked against the shipped text. Defaults `A = 2`, `J = 2`, interface point = `0.25` task-equivalents.

Model as shipped:

```
M_nested = span_max + A (2c) + A (2s, slowest-of-k) + J (3s, per-lane barrier, slowest-of-k)
                    + J (3j) + I (aggregate interface points × 0.25)
```

### Example 1 — the gate verdict and the ladder figure must agree (`k = 1`, flat baseline)

- `span_max` = 6; nested overhead `A + A + J + J` = 2+2+2+2 = **8**; `M_nested` = 6+8 = **14**. ✔
- `M_flat` = 16; flat overhead `A + J` = **4**.
- `g` = 12 − 6 = **6**; `c` = 8 − 4 = **4**. `6 > 4` → **adopted**; 14 < 16. ✔
- Cross-check: `c` computed from *The cost side* as `A(2) + J(2) + I(0)` = **4** — matches the delta-of-`M_nested` derivation. Gate and ladder agree.

**Unchanged by this change, as the text claims.** Only the notation moved (`1 × J` → `J`); at `k = 1` slowest-of-one *is* `J`.

### Example 2 — one lane carries all the work (`k = 1`, sequential baseline)

- `span_max` = 8; overhead `A + A + J + J + I(2×0.25=0.5)` = **8.5**; `M_nested` = 8+8.5 = **16.5**. ✔
- `M_seq` = 24; `g` = 24 − 8 = **16**; `c` = 8.5 − 0 = **8.5**. `16 > 8.5` → **adopted**. ✔
- Leaf re-application: largest leaf 8/24 = 33% ≤ 70%, 3 leaves ≥ 2. ✔

**Unchanged.** ✔

### Example 3 — a split carrying an integration sub-lane (`k = 1`, sequential baseline)

- `span_max` = 11 (largest sub-lane 5 + integration 6); overhead `A + A + J + J + I(8×0.25=2)` = **10**; `M_nested` = 11+10 = **21**. ✔
- `M_seq` = 24; `g` = 24 − 11 = **13**; `c` = **10**. `13 > 10` → **adopted**, margin 3. ✔

**Unchanged.** ✔

### Example 4 — `k = 2`, the new example (flat baseline)

Lane set `{A: 24, B: 10, C: 4}`, `T` = 38. Parent contract 0 interface points; each adopted sub-contract 2.

- **Flat verdict viable:** largest lane 24/38 = **63.2%** ≤ 70%, 3 lanes carry work. ✔
- **Baseline:** `span_base` = 24; flat overhead `A + J + I(0)` = **4**; `M_flat` = **28**. ✔
- **Adoption 1** (`A` → `{8,8,8}`, integration none, `span(A)` = 8): `span_max` = max(8,10,4) = **10**; accumulated overhead `A+A+J+J+I(2×0.25=0.5)` = **8.5**; `M_nested` = 10+8.5 = **18.5**. `g₁` = 24−10 = **14**; `c₁` = `A(2)+J(2)+I(0.5)` = **4.5**. `14 > 4.5` → **adopted**. ✔
  - Delta cross-check: 8.5 − 4 = 4.5 = `c₁`. ✔
- **Adoption 2** (`B` → `{5,5}`, `span(B)` = 5): `span_max` = max(8,5,4) = **8**; accumulated overhead `A+A+J+J+I(4×0.25=1.0)` = **9**; `M_nested` = 8+9 = **17**. `g₂` = 10−8 = **2**; `c₂` = `I(0.5)` = **0.5** — no `A`, and newly no `J`. `2 > 0.5` → **adopted**. ✔
  - Delta cross-check: 9 − 8.5 = 0.5 = `c₂`. ✔
- **Reconciliation 1 (cost):** `M_nested` overhead (9) − `M_flat` overhead (4) = **5** = `c₁`(4.5) + `c₂`(0.5). ✔
- **Reconciliation 2 (gain):** span reduction 24 → 8 = **16** = `g₁`(14) + `g₂`(2). ✔
- **Remaining gates:** leaves `{8,8,8,5,5,4}` sum to 8+8+8+5+5+4 = **38** = `T` ✔; ≥ 2 leaves carry work ✔; largest leaf 8/38 = **21.1%** ≤ 70% ✔; aggregate interface points 0+2+2 = **4** ≤ `T` = 38 ✔; 6 leaves ≤ `max_parallel_lanes` default of 6 ✔.

### The corrected counterfactual — spec FR-16's `20` is wrong; `19` is right

The coder reported correcting one spec figure. **Verified independently, and the correction is right.**

Spec FR-16 (line 123 of `SPEC-20260819T034803Z-18d2`) states the superseded serialized `k = 2` plan's `M_nested` as **20**, via the expression `8 + (A + A + 2J + J + I)`. Evaluating the spec's *own* expression:

```
span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4 × 0.25 = 1.0)
= 8 + 2 + 2 + 4 + 2 + 1
= 19
```

The spec's expression and the spec's stated total disagree with each other; **19** is what the expression evaluates to, and 19 is what the model yields. The shipped text (`references/config.md` line 391) states **19**, in expanded term-by-term form, and uses the phrasing `2 join passes(4)` so the forbidden `k × J` literal is not reintroduced.

**The qualitative role of the figure survives the correction intact**, which is what makes the fix safe:
- Counterfactual under the superseded charge: `c₂` = `J(2) + I(0.5)` = 2.5 against `g₂` = 2 → `2 > 2.5` is false → **rejected**. ✔
- That rejection was self-consistent: the serialized plan's `M_nested` at 19 is **worse** than the 18.5 of leaving `B` flat. The claim holds at 19 exactly as it would have at 20. ✔
- Under the overlapped machine: `M_nested` = 17, strictly better than 18.5, and the gate adopts. ✔
- **Gate and ladder agree on both sides of the change** — which is precisely what this example is for. ✔

Action for the architect: fold **19** back into spec FR-16.

## Test-Quality Audit

There are no coder-written automated tests in this diff to audit for assertion quality — the change is markdown. The equivalent audit for a doc-skill change is whether the shipped prose is internally consistent and whether its arguments hold. Three findings.

### Internal consistency of the two halves — **PASS**

Every site describing the **barrier** was checked against every site describing the **charge**. Both halves landed in one working state; neither is described on the other's terms anywhere.

Barrier sites (`SKILL.md`), all consistent: pipeline overview 3s bullet (L102); joins-compose-bottom-up line (L105); Step 3s header (L964); all-sub-lanes-DONE check as the only barrier (L966); the rewritten justification carrying the containment proof forward (L970); Step 3j's two waits (L1028); the guardrail list (L1491); Step 3L wave sizing (L926); Step 2L's honest-cost disambiguation (L905).

Charge sites, all consistent: `config.md` makespan bullets (L245–248), `M_nested` block (L256), recorded-history note (L265), cost-side inner-join bullet (L297), sequential-baseline paragraphs (L303–305), greedy-adoption rewrite, `max_parallel_lanes` key (L481); `SKILL.md` Step 2p.2 marginal-cost table (L547) and trailing rule (L554).

Specifically checked and correct:
- `M_nested` charges `+ J` for the inner-join level with a `slowest-of-k` annotation; *The cost side* charges `J` on the **first** adoption only. A later adoption's marginal overhead delta is `ΔI` alone, and the cost side charges `I(…)` alone. **The two accounts reconcile exactly** on all four examples.
- Step 2p.2's table charges `I(…)` alone for "Every later adoption" on **both** baselines; the `k×J` trailing rule is gone; the expanded-zero form `c = I(0×0.25=0) = 0` survives.
- The `k × J` literal survives nowhere in either skill file or its generated copy. Remaining occurrences are confined to the ADRs (0012's worked examples, 0013's title and its quotation of the superseded model), which is correct — those are historical records.
- The superseded charge is preserved as `(k − 1) × J` and in prose, satisfying both AC-1 and FR-11 without contradiction.
- `max_parallel_lanes` wording is consistent in substance at both enforcement sites; Step 2L's bound is untouched and the carve-out is stated ("an architect fan-out never overlaps an inner join").

### The three hazards beyond ADR-0013 — **all handled**

- **(a) Step 3j needs its own barrier.** Handled. The old *"every inner join (Step 3s) has already completed"* assertion — which depended on the removed global barrier — is gone, replaced by an explicit two-part wait at L1028: *"Wait for every in-flight leaf subagent to return, and for every inner join to complete — both waits, before anything else in this step."* The text also states *why* the second wait is now necessary rather than just adding it: a leaf returning is no longer evidence the inner joins are finished.
- **(b) The 3j.2 amendment loop can invalidate an in-flight leaf.** Handled, with the right resolution. L1016: the inner join **records** the amendment routing; the loop is entered at Step 3j once both waits hold; requests evaluated in **lane-map row order**. Scoping is explicitly unchanged (sub-contract row amends that sub-contract; inherited parent row escalates); only the entry point moves. `max_contract_amendments` remains one shared budget with one writer consuming it in deterministic order. The reasoning correctly identifies the mechanism — 3j.2 step 5 partitions the leaf set and step 7 re-dispatches — so running it early would invalidate a leaf mid-write, contradicting *"Never abandon a running leaf"*. The sibling `PARTIAL` hazard is resolved with the identical record-at-3s / take-at-3j shape at L1014, citing the same rule.
- **(c) `max_parallel_lanes` stops binding.** Handled at both sites (SKILL.md L926, config.md L481) with mutually consistent wording, plus a correct backward-compatibility note (*"tightens nothing that was previously allowed"* — before overlap an integration coder could not run concurrently with a leaf coder at all, so no previously-fitting configuration stops fitting).

### Determinism claims — **the argument holds as written**, with one seam noted

The claim: *"Two runs over the same contract produce the same artifacts and the same printed `SUBJOIN` sequence. Only wall-clock completion order differs."*

- **Surface 1 — artifact writes. Sound.** Each sub-contract's sub-lane-status table is written by exactly one lane's inner join, so no two joins contend. The parent contract's lane-status table has one pre-existing row per lane (frozen at Step 2c) whose status cell that lane's inner join sets alone. Setting disjoint cells of a pre-existing table is genuinely order-independent in content. The lost-update concern that concurrent writes to one file would otherwise raise is answered by 3s.1's added sentence — the orchestrator performs each inner join's writes **itself**, and a single agent's writes are serialized by construction. The argument is complete.
  - *Observation, not a defect:* the two halves of that argument live in separate paragraphs (L972 and L1022) and neither cross-references the other. The composition is left to the reader. A single cross-reference would make it airtight on one read.
- **Surface 2 — `SUBJOIN` print order. Sound.** The buffering mechanism is explicit rather than asserted: the orchestrator holds each completed join's result instead of printing on completion, then emits the full set in lane-map row order at one point before Step 3j. The cost argument is correct — printing is off the critical path, so serializing the transcript costs nothing the overlap bought.
- **Seam the claim does not cover — advisory.** A third observable exists that the argument does not address: **the order in which multiple distinct deferred gates run at Step 3j item 4 is not pinned.** If two different deferred gates would both fail, which one blocks the join first — and therefore what the `JOIN — deferred gate failed` block reports — is unspecified. This is **not a regression**: 3j item 4 was equally unpinned before. But the change routes *every* deferred gate through that site rather than only the leftovers, so it enlarges a pre-existing determinism seam at the same moment the surrounding text strengthens its determinism claim. A one-clause fix would close it — e.g. run them in lane-map row order of the earliest lane that deferred each, matching the ordering discipline every neighbouring rule already uses.

### Three surviving stale prose sites — **for the reviewer**

The change moved where a deferred gate *runs*: Step 3s now **collects and records** (L987: *"do not run any of them here"*), and Step 3j item 4 is the single de-duplicated run site (L1063: *"the **only** site at which a deferred gate executes, at either depth"*). Three sites describing that same discipline were left untouched and now contradict it. All three have propagated into the generated tree.

| # | Site | Text | Assessment |
| --- | --- | --- | --- |
| 1 | `plugins/my-skills/skills/orchestrator/SKILL.md:958` (Step 3L preamble) — mirrored at `prime-agent/skills/orchestrator/SKILL.md:996` | *"Path-scoped gates defer to the nearest enclosing join — the **inner** join for a sub-lane… A sub-lane never defers a gate all the way to the outer join when its own inner join can run it."* | **Highest of the three.** Post-change the inner join can *never* run one — a deferred gate is by definition unscopable — so the guard clause is vacuously true while reading as a directive to expect the inner join to run it. In scope by FR-4's intent (correct every prose site asserting the old discipline), missed by the sweep. Same category as the guardrail-list gap at ~L1462 the architect *did* catch. |
| 2 | `plugins/my-skills/skills/orchestrator/references/config.md:437` (nested viability condition 4) — mirrored in the generated tree | *"…can be **scoped to a sub-lane's paths** — otherwise that gate defers to the inner join;"* | Now names the wrong destination: the gate defers *past* the inner join to the outer join. The split-viability outcome is unaffected (the condition never rejects; it has a built-in escape), so this is naming, not logic. Notable because it sits in the very file whose charge half was rewritten. |
| 3 | `plugins/my-skills/skills/orchestrator/templates/coder.md:153` | *"…that join runs it once over its own scope… A sub-lane never defers a gate past its own inner join when that join can run it."* | Plan-declared **out of scope** (*"No edit to `templates/*.md`"*), and the coder's *action* is genuinely unchanged — defer and record, identically either way. But the explanatory clause is now false about the machine. Lowest severity; listed for completeness because it is the same sentence pattern as #1. |

**Severity, stated honestly: these are documentation-consistency defects, not races.** Nothing here can cause a gate to be skipped: Step 3s item 3 and Step 3j item 4 are explicit, unambiguous, and mutually consistent, and an orchestrator following them discharges every deferred gate exactly once. The concrete risk is a future editor reading #1 or #2 and restoring the gate-run step at 3s that this change deliberately removed — which is exactly the failure mode the plan's own "recorded history is kept, not deleted" convention exists to prevent. #1 and #2 warrant a fix before approval; #3 is a judgement call for the reviewer given the explicit out-of-scope declaration.

### Generated-tree integrity — **PASS**

- `node scripts/build-prime-agent.mjs --check` exits **0**: `prime-agent/skills is up to date (11 skills, 154 files)`. The mirror matches its sources and was not hand-edited.
- `prime-agent` parity suite reports `parity ok: prime-agent/skills is generated, in sync, and guarded`.
- **Both near-miss exact-count overlay anchors resolve at 3**, confirmed against the source and against `prime-agent/overlays/orchestrator.json`:
  - `the call shape from *How to spawn a subagent*` — **3** in the source; overlay declares `"count": 3`. It appears **0** times in the generated file, which is correct: the overlay replaces the phrase at all three sites.
  - `:(exclude).claude` — **3** in the source; overlay declares `"count": 3`; **3** in the generated file, since the overlay appends rather than replaces.
- No `k × J` / `k×J` literal anywhere under `prime-agent/skills/orchestrator/` — the overlay did not reintroduce the superseded charge.

### ADR record — **PASS**

- ADR-0013: `**Status:** Accepted`, dated `2026-08-14 (proposed) / 2026-08-19 (accepted and implemented)`. No surviving `Proposed` status line.
- ADR-0012 (~L150): cross-reference updated to note ADR-0013 is now Accepted and implemented, with a one-line summary of what it did.
- ADR-0014 (~L127): the false *"Still `Proposed`"* claim is removed while the true statement (ADR-0014 did not touch Step 3s's barrier discipline) is preserved.
- The `k × J` literals remaining in the ADRs are correct — they are historical record and direct quotation of the superseded model, and AC-1's prohibition is scoped to the skill files and their generated copies.

## Verdict

**PASS.**

- Arithmetic: all four worked examples re-derived by hand and correct; both FR-16 reconciliations verified (Σ`c` = 5 = overhead delta; Σ`g` = 16 = span reduction); the gate and the ladder agree on every example, on both sides of the change.
- The reported spec-figure correction is independently confirmed: spec FR-16's **20** is wrong, the shipped **19** is right, and the figure's qualitative role is unaffected.
- The barrier half and the charge half are mutually consistent at every site describing either.
- All three spec-added hazards are handled in the shipped text.
- The determinism argument holds as written at both claimed surfaces, with one pre-existing ordering seam noted as advisory.
- All three no-regression floors green; generated tree in sync; both exact-count anchors intact.

**Coverage: N/A → N/A**, and this is not a BELOW_FLOOR result — the 70% floor is inapplicable by PROJECT-CONTEXT policy for doc-skill changes, there is no instrumentable code in the diff, and no coverage was padded.

**Carried to the reviewer:**
1. Three surviving stale deferred-gate sites (SKILL.md:958, config.md:437, templates/coder.md:153), all propagated into the generated tree. Fixing #1 and #2 requires a rebuild of `prime-agent/skills/**`.
2. Advisory: pin the run order of deferred gates at Step 3j item 4 to close the noted determinism seam.
3. For the architect: fold **19** back into spec FR-16.
