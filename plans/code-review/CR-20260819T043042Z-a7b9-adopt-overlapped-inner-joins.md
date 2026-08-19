---
id: CR-20260819T043042Z-a7b9
plan: FEAT-20260819T035826Z-835a
title: Review of Adopt ADR-0013 — overlap inner joins and reprice the inner-join level
status: REQUEST_CHANGES
created_at: 2026-08-19T04:35:06Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 1
should_fix_count: 4
---

**Related:** [FEAT-20260819T035826Z-835a](../feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md) · [SPEC-20260819T034803Z-18d2](../specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md) · [TEST-20260819T042313Z-1acb](../test/TEST-20260819T042313Z-1acb-adopt-overlapped-inner-joins.md)

## Summary

This is a strong, disciplined change. The hard constraint held: the barrier half (`SKILL.md` Step 3s) and the charge half (`references/config.md` → *The makespan model* / *The cost side*) land in one working state, so the gate and the ladder never sit on two accounts. I re-derived all four worked examples independently and every figure is correct, including the new `k = 2` example and the coder's corrected counterfactual (**19**, not the spec's 20). The three hazards beyond ADR-0013 (Step 3j's second barrier, the amendment loop's entry point, `max_parallel_lanes` counting integration coders) are all handled in the shipped text, and the determinism argument holds as written. The generated tree is clean: `build-prime-agent.mjs --check` exits 0, `prime-agent` npm test passes, `clean-code-gates` still reports 213/0, and both near-miss overlay anchors are still exactly 3.

One blocker: `SKILL.md:958` still tells a sub-lane that its own inner join can run a deferred gate. Post-change the inner join can never run one, so that sentence directly contradicts AC-7's *"Step 3j item 4 is the single de-duplicated run site"* — inside the same file, four lines above the step that was rewritten. It is not a race (Step 3s item 3 and Step 3j item 4 are explicit and mutually consistent), but in a skill whose executable substrate is prose, a live directive pointing at a run site that no longer exists is a functional defect, not a cosmetic one.

Verdict: **REQUEST_CHANGES** on that one line, with three related documentation-consistency items that should ride the same rebuild.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | No literal `k × J` / `k×J` in `SKILL.md`, `config.md`, or Prime copies; superseded rationale kept as `(k − 1) × J` + prose | ✅ | Verified by grep in source and `prime-agent/skills/orchestrator/`. History note at `config.md:265` uses `(k − 1) × J` and prose exactly as the resolved tension required. ADRs retain the literal, correctly — they are historical record and out of AC-1's stated scope. |
| 2 | `M_nested` charges `+ J` for the inner-join level with a `slowest-of-k` annotation and an ADR-0013 / Step 3s citation | ✅ | `config.md:256` reads `+ J   k inner joins   (Step 3s — per-lane barrier, so slowest-of-k)`; bullet at `:248` cites `SKILL.md` → Step 3s and ADR-0013 in the neighbouring bullets' style. |
| 3 | *The cost side* charges `J` on the **first** adoption only, mirroring the `A` bullet, naming the double-bill it prevents | ✅ | `config.md:296`. Mirrors the `A` bullet's phrasing and structure rather than inventing a parallel formulation; names the double-bill as "an aggregate of `k` full join passes" so AC-1 is not breached. |
| 4 | Step 2p.2 marginal table charges `I(…)` alone for "Every later adoption" on both baselines; trailing `k×J` rule gone; expanded zero preserved | ✅ | Both later-adoption cells now `I(…)` alone with the two-level reason; first-adoption cells unchanged (`A + J + I` flat, `A + A + J + J + I` sequential); `c = I(0×0.25=0) = 0` survives in expanded form. |
| 5 | Step 3s has no global-barrier sentence; per-lane all-sub-lanes-DONE check retained in substance; justification names ADR-0013 and carries the containment proof forward | ✅ | Global sentence removed. The check retains its from-the-artifact verification, single retry, and `PARTIAL` routing verbatim in substance, now framed as the join's only barrier. The containment paragraph is preserved and promoted from footnote to operative justification. |
| 6 | Step 3j's opening wait names both conditions | ✅ | "every in-flight leaf subagent to return, **and** for every inner join to complete — both waits, before anything else in this step". The unsupported *"has already completed"* assertion is gone. |
| 7 | Step 3s runs no deferred gates (collect + record only); Step 3j item 4 is the single de-duplicated run site, naming the deferring lane(s) on failure | ❌ | Step 3s item 3 and Step 3j item 4 are both correct and mutually consistent, and the `JOIN — deferred gate failed` block names the deferring lanes. But `SKILL.md:958` still asserts the inner join can run a deferred gate, contradicting "single run site". See **MF-1**. |
| 8 | 3s.1 states in one sentence that overlap adds no second writer | ✅ | "**overlapping inner joins add no second writer**, because the orchestrator performs each inner join's writes itself". |
| 9 | `SUBJOIN` emitted in lane-map row order at one point; `PARTIAL` and amendment routing recorded at 3s, taken at 3j in row order | ✅ | All three present and mutually consistent. The "printing is not on the critical path" justification correctly closes the obvious objection that pinning the transcript re-serializes the joins. |
| 10 | `max_parallel_lanes` counts inner-join integration coders, worded consistently at both sites; Step 2L untouched | ✅ | `SKILL.md` Step 3L and the `config.md` `max_parallel_lanes` key both read "at most `max_parallel_lanes` coder subagents in flight at any time, counting each inner join's integration sub-lane coder", both note the wave-sizing subtraction, both state it tightens nothing previously allowed, and both explicitly exempt Step 2L. |
| 11 | Four worked examples; the three existing ones re-derived and stated unchanged; the fourth is `k = 2` with FR-16's figures and both reconciliations | ✅ | Four examples confirmed. I re-derived all four by hand — see below. One deviation (19 vs the spec's 20) is correct and correctly recorded; see **SF-4**. |
| 12 | *Greedy, recomputed adoption* drops the strictly-positive claim and names the three real guards | ✅ | The false claim is gone; termination now rests on monotonically shrinking gain, `g > c` rejecting a wash (`0 > 0` is false), and a finite lane set — with the leaf-width ceiling, aggregate diminishing-payback rule, and per-sub-lane viability re-application named as the three independent bounds. |
| 13 | ADR-0013 `Accepted`, four questions answered in place, three hazards recorded; ADR-0012 / ADR-0014 cross-refs corrected | ✅ | Status and dual date line correct. All four questions answered in place with the filed question preserved. Hazards 5–7 recorded. The self-critique of question 1's framing (the defect is definitional and applies to a single lane, so option B is unsound rather than merely inconvenient) is the sharpest part of the record. |
| 14 | `build-prime-agent.mjs --check` exits 0; `prime-agent` npm test exits 0; generated tree regenerated, never hand-edited | ✅ | Re-run independently: `--check` → "prime-agent/skills is up to date (11 skills, 154 files)", exit 0. `npm test` → install ok + parity ok. |
| 15 | Both near-miss overlay anchors still occur exactly 3 times | ✅ | `the call shape from *How to spawn a subagent*` = 3; `:(exclude).claude` = 3. `through a **single sequential coder invocation**` preserved (2 occurrences). |
| 16 | `clean-code-gates` still 213 passing / 0 failing | ✅ | Re-run independently: `# pass 213 / # fail 0`. |
| 17 | Barrier half and charge half checked off in the same phase | ✅ | Phase 2 holds both. No task ordering in the plan produces a half-landed state, and the working tree confirms both halves present together. |

### Arithmetic re-derived independently

I did not take the coder's or the tester's figures on report. All four examples re-derived from `A = 2`, `J = 2`, `0.25`/interface-point:

- **Example 1 (gate/ladder agreement, `k = 1`):** `M_flat` = 12 + (A + J) = 16; `M_nested` = 6 + (A + A + J + J) = 14; `g` = 12 − 6 = 6; `c` = 8 − 4 = 4; adopted. Unchanged — at `k = 1`, slowest-of-one **is** `J`, so `1 × J` → `J` is notation only. ✅
- **Example 2 (one lane carries all the work, sequential baseline):** overhead `A + A + J + J + I(2×0.25=0.5)` = 8.5; `M_nested` = 8 + 8.5 = 16.5 vs `M_seq` 24; `g` = 16; `c` = 8.5; adopted; leaf re-application 8/24 = 33% ≤ 70%. Unchanged. ✅
- **Example 3 (integration sub-lane):** `span_max` = 5 + 6 = 11; overhead `A + A + J + J + I(8×0.25=2)` = 10; `M_nested` = 21 vs `M_seq` 24; `g` = 13; `c` = 10; adopted at a margin of 3. Unchanged. ✅
- **Example 4 (new, `k = 2`):** `span_base` 24, `M_flat` = 24 + 4 = 28. Adoption 1: `span_max` 10, overhead 8.5, `M_nested` 18.5, `g₁` 14, `c₁` 4.5 → adopted. Adoption 2: `span_max` 8, overhead 9, `M_nested` 17, `g₂` 2, `c₂` 0.5 → adopted. Reconciliations: 9 − 4 = 5 = 4.5 + 0.5 ✅; 24 → 8 = 16 = 14 + 2 ✅. Gates: `{8,8,8,5,5,4}` sums to 38 = `T` ✅; largest 8/38 = 21% ≤ 70% ✅; interface points 0 + 2 + 2 = 4 ≤ 38 ✅; 6 leaves = `max_parallel_lanes` default 6 ✅.
- **The counterfactual:** the serialized `k = 2` plan's `M_nested` = `span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)` = **19**. The spec's stated **20** is an arithmetic slip in the total; the spec's own expression yields 19. **Shipping 19 was right** — the plan's own verification row makes hand arithmetic the gate for any worked-example change, and transcribing a figure the file's own expanded form contradicts would have put a self-refuting number in the one document that exists to keep two accounts honest. The qualitative role survives intact (19 > 18.5, so the historical rejection was still self-consistent), and no AC-11 figure or FR-16 reconciliation is touched. See **SF-4** for the fold-back.

### The three hazards, verified in the shipped text

- **(a) Step 3j's own barrier.** Handled. The old *"every inner join has already completed"* assertion depended on the removed global barrier and is replaced by an explicit second wait, stated as the thing "this step's whole picture rests on". Step 3j's classification, 3j.1, and 3j.2 all sit after both waits, so the settled-set premise they rely on is now earned rather than inherited.
- **(b) Amendment loop vs "never abandon a running leaf".** Handled, and handled at the right seam. Recording at 3s and entering the loop at 3j is what keeps 3j.2 step 5's leaf-set partition and step 7's re-dispatch from invalidating a leaf mid-write; scoping is explicitly unchanged, and `max_contract_amendments` stays one budget consumed by one writer in lane-map row order — which is what prevents the budget itself from becoming wall-clock-dependent. Step 3s's older *"routes through the same precedence rule (3j.1 / 3j.2)"* sentence survives above the new paragraph, but the new paragraph disambiguates it explicitly (record here, take there); not a finding.
- **(c) `max_parallel_lanes` binding.** Handled at both enforcement sites in mutually consistent wording, with the backward-compatibility argument stated correctly (before overlap an integration coder could not run concurrently with a leaf coder at all, so nothing that fitted the ceiling stops fitting it).

### The determinism argument

It holds as written, and the claim is correctly scoped rather than overstated. The net claim is "same artifacts and same printed `SUBJOIN` sequence; only wall-clock completion order differs" — not "same everything". Both surfaces are genuinely pinned: sub-contract status tables have exactly one writing join, the parent lane-status table's cells are disjoint and pre-existing (frozen at Step 2c), and disjoint-cell writes are order-independent given 3s.1's sole writer. Moving deferred gates to 3j is load-bearing here too, and the text says so — a gate whose run site depended on what else happened to be in flight would have been the one genuinely non-deterministic surface left. Unsplit lanes' status cells are set at Step 3j after both waits, so they never contend. The one seam the argument leaves open is **SF-3**.

## Must Fix (Blockers)

### MF-1 — `SKILL.md:958` still directs a sub-lane's deferred gate to a run site that no longer exists

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:958` (and, generated from it, `prime-agent/skills/orchestrator/SKILL.md`)

**Problem**: The lane-preamble section, four lines above the rewritten Step 3s, still reads:

> **Path-scoped gates defer to the nearest enclosing join** — the **inner** join for a sub-lane, the **outer** join for an unsplit lane. A sub-lane never defers a gate all the way to the outer join when its own inner join can run it.

Post-change the inner join **never** runs a deferred gate: Step 3s item 3 collects and records only, and Step 3j item 4 is "the **only** site at which a deferred gate executes, at either depth". The second sentence is therefore vacuously true while reading as a live directive, and the first names the inner join as a *run* destination it no longer is.

This is not a race — Step 3s item 3 and Step 3j item 4 are explicit and consistent — but it breaches **AC-7**, which requires Step 3j item 4 to be *the single de-duplicated run site*, and it does so in the same file, in the paragraph immediately preceding the step that was rewritten. In a skill whose execution substrate is prose read by a model, a directive naming a run site that the very next section abolishes is the same class of defect as the `~L1462` guardrail the architect caught during planning and put in scope as a task — and it is the harder of the two to notice, because the sentence is still grammatically true.

**Fix**: Rewrite so deferral names the **recording** hop and the **run** site separately, e.g.:

> **A gate with no path-scoped form defers to the nearest enclosing join** — the **inner** join for a sub-lane, the **outer** join for an unsplit lane — which is where the deferral is **recorded**. A sub-lane's inner join records the deferral and passes it outward; **every deferred gate runs at the outer join** (Step 3j item 4), which is the first point at which nothing else is in flight (Step 3s item 3; ADR-0013).

Delete the "when its own inner join can run it" clause outright rather than softening it — there is no longer any case it selects. Then regenerate: `node scripts/build-prime-agent.mjs` and re-assert `--check` exits 0 plus the two exact-count anchors (3 / 3). Do **not** hand-edit `prime-agent/skills/**`.

---

## Should Fix (Warnings)

### SF-1 — `references/config.md:437` names the wrong destination for a deferred gate

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:437` (per-sub-lane viability condition 4)

**Problem**: Condition 4 reads *"…can be **scoped to a sub-lane's paths** — otherwise that gate defers to the inner join"*. The first hop is still accurate (the sub-lane coder defers to its inner join, which records it), but this is the normative reference file, and it now stops one hop short of where the gate actually runs. A reader pricing or auditing the condition gets no signal that the inner join is a waypoint rather than an executor. The condition itself — *can the gate be path-scoped* — is unchanged and still correct, which is why this is a warning rather than a blocker.

**Fix**: `— otherwise that gate defers to the inner join, which records it for the outer join (`SKILL.md` → Step 3j item 4, the single run site; ADR-0013)`. Bundle with MF-1: the same rebuild covers both at zero marginal cost.

---

### SF-2 — `templates/coder.md:153`'s explanatory clause is now false, though the coder's action is not

**File**: `plugins/my-skills/skills/orchestrator/templates/coder.md:153`

**Problem**: The template reads *"…**defer it to the nearest enclosing join** … the **inner** join if you are a sub-lane … that join runs it once over its own scope. … A sub-lane never defers a gate past its own inner join when that join can run it."* The **instruction** is genuinely unchanged — defer, note it in `.progress.md`, proceed — which is what the plan relied on when declaring `templates/*.md` out of scope. But the two explanatory clauses are now false in the same way MF-1 is: for a sub-lane, that join does *not* run it, and there is no case where the inner join "can run it".

The coder correctly honoured a declared out-of-scope boundary, so this is not a defect in the coder's work. It is a scoping error in the plan: the out-of-scope entry justified itself on *"the coder's defer-a-gate instruction is unchanged"*, which is true of the instruction and false of the sentences around it.

**Fix**: Route through the architect as an explicit scope amendment in the FIX plan, then trim to the action plus the true destination — *"Note the deferral in `.progress.md` and proceed; deferred gates run once, at the outer join (Step 3j item 4)."* — and drop the final sentence. Requires the same `prime-agent` rebuild.

---

### SF-3 — Deferred-gate run order at Step 3j item 4 is unpinned, and this change enlarged the seam

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md` — Step 3j item 4

**Problem**: Item 4 de-duplicates deferred gates and runs each once over the union, but says nothing about the order they run in. Pre-existing — but before this change, item 4 handled only the leftovers an inner join could not run, and now **every** deferred gate in the run routes through it. Gates are arbitrary project commands and some mutate the workspace (formatters, builds), so run order can determine which of two failing gates is reported and, in the mutating case, whether the second one fails at all. The step's own net determinism claim is scoped to artifacts and the `SUBJOIN` sequence, so it is not falsified — but the text strengthened its determinism posture in the same change that widened this seam, which is an awkward place to leave an unpinned order.

**Fix**: Pin it in one clause, in the same style Step 3s pins `SUBJOIN` emission — e.g. run the de-duplicated set in **lane-map row order of first deferral**, ties broken by the gate's command string. Cheap, costs nothing on the critical path, and closes the last order-dependent surface in the parallel path. Reasonable to defer to its own change if the FIX plan wants to stay minimal, but it should not be dropped.

---

### SF-4 — Fold the corrected counterfactual (19, not 20) back into spec FR-16 and the plan's Phase-2 task text

**File**: `plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md:123`; `plans/feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md` (Phase 2 task at *"…would have been 20, worse than 18.5"*)

**Problem**: The spec's FR-16 states the superseded serialized `k = 2` plan's `M_nested` as `8 + (A + A + 2J + J + I)` = **20**; the expression evaluates to **19**. The plan copied the figure into a Phase-2 task verbatim. Both upstream artifacts now disagree with the shipped file, which is correct. Leaving them is a live trap: the shipped example carries a standing *"re-check this example whenever either side of the model is edited"* instruction, and the next person who re-checks it against FR-16 will find a mismatch and have to re-derive the arithmetic from scratch to learn which side is wrong.

**Fix**: Correct `20` → `19` in spec FR-16 and in the plan's Phase-2 task text, in both cases showing the expanded term-by-term form (`span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)` = 19) so the figure is self-checking, and note the correction in the spec's own log. Upstream-artifact hygiene, not shipped content — hence a warning.

---

## Verdict

**Status**: REQUEST_CHANGES

The change is arithmetically correct, atomically landed, and closes every hazard it set out to close; it is blocked solely on one surviving sentence (`SKILL.md:958`) that contradicts AC-7's single-run-site requirement inside the file the change rewrote.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260819T043042Z-a7b9-adopt-overlapped-inner-joins.md`) to generate a FIX plan. MF-1 becomes a TDD task pair; SF-1 and SF-2 should be folded into the same phase, since the required `prime-agent` rebuild covers all three in one pass, and SF-2 additionally needs an explicit out-of-scope amendment (`templates/*.md`). SF-3 and SF-4 may be scheduled separately.
