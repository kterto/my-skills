---
id: SPEC-20260819T100451Z-01da
title: One span rule over any slice set, at any depth (ADR-0017)
status: READY_FOR_PLANNING
created_at: 2026-08-19T10:08:34Z
updated_at: 2026-08-19T10:08:34Z
cycle: 0
related_to: SPEC-20260819T052229Z-3d97, SPEC-20260819T034803Z-18d2, SPEC-20260807T025822Z-2a6f, SPEC-20260819T000458Z-bfac
---

## Summary

The orchestrator's inner viability gate writes the same "concurrent `max` plus serial remainder" shape as **four separate normative formulas** — `span(L)` for a split lane, `span_max` for the run, the viable-flat `span_base` in the baseline table, and `M_flat`'s span term. This spec replaces those four statements with **one rule stated over any slice set**, from which all four are derived, and collapses the near-verbatim integration-lane exclusion prose that the duplication forced. It is a **reframing, not a repricing**: every figure the model prints — `M_flat`, `M_nested`, `M_seq`, `g`, `c`, `span_base`, `span_max`, and every numeral in all five worked examples — must be numerically identical afterwards. The decision is recorded as **ADR-0017**, superseding ADR-0016's *derivation framing* while leaving every ADR-0016 conclusion and figure standing.

## Goals

- One normative statement of the span rule, generic over a slice set, from which `span(L)`, `span_max`, and the viable-flat `span_base` are each derived as that rule applied to a different slice set — so a future change to integration-lane pricing moves **one** site, not four.
- The cancellation identity (`g = M − S` on a viable flat baseline) becomes a short consequence of the rule plus the run-constancy of the top-level integration slice, instead of a derivation block that exists only because two formulas were written separately.
- The integration-lane exclusion from the two work-concentration conditions is stated **once** canonically, with each remaining evaluation site carrying a pointer that still names the rule's effect in that site's own vocabulary.
- ADR-0016 §3's assertion *"the exclusion applies at both evaluation sites or at neither"* becomes true by construction under a single rule, and is restated as a consequence rather than a mandate.
- Every printed figure, worked example numeral, print-block template string, and digest field requirement is unchanged.
- ADR-0017 is authored in ADR-0016's style, cross-referencing 0012 / 0013 / 0014 / 0016 the way those cross-reference each other, and saying explicitly what it supersedes and what it leaves standing.
- The generated Prime Agent distribution is regenerated from source and `node scripts/build-prime-agent.mjs --check` exits 0.

## Non-goals

- **No repricing.** No change to `M_flat`, `M_nested`, `M_seq`, `T`, `g`, `c`, `span_base`, `span_max`, `A`, `J`, the `0.25` interface-point conversion, the `70%` threshold, the aggregate `I > T` guard, or the `max_parallel_lanes` ceiling. An implementation that moves any arithmetic has mis-scoped the work.
- **No change to the digest contract.** The lane-level and sub-lane-level `integration` field, its strict shape, and the "omitted ⇒ rejected outright, never read as zero" rule are all untouched (ADR-0014 §1, ADR-0016 §1).
- **No amendment to ADR-0012, ADR-0013, or ADR-0014.** ADR-0013 concerns the inner-join charge (`J`, not `k × J`), not the span shape, and stands unamended in particular.
- **No change to ADR-0016's status.** It remains `Accepted`; only its derivation framing is superseded, and that is recorded as a forward pointer, not a status flip.
- **No behavioural test.** See *Non-functional requirements → Test strategy* — none is reachable, and the spec deliberately specifies none.
- **No heading renames, deletions, or additions above `#####` inside the gate section** that would break an existing cross-reference (see FR-10).
- **No hand-edit of `prime-agent/skills/**`** — it is generated (see FR-13).
- **No opencode port work.** `orchestrator` has no `.opencode/skills/orchestrator/` override port; the `opencode-port-parity` invariant does not bind here (verified: only `pr-review-report` and `spec-driven-eval` have ports).
- **No change to `templates/architect.md`.** It names `span_base` / `span_max` / `span(L)` referentially (`:245`, `:247`) and restates no formula; it stays as-is unless FR-10's cross-reference audit proves a pointer target moved.

## Users and use cases

- **Skill maintainer (the human editing the orchestrator's cost model)** — needs to change how the integration lane is priced and edit **one** normative site rather than reconcile four; success is that a single-site edit cannot leave the model internally inconsistent.
- **The executing orchestrator agent (reader of `references/config.md` at Step 2p.3 / 2p.3n)** — must compute the same figures it computes today from a shorter, non-duplicated text, and must be able to land mid-document at any evaluation site and still know what is excluded from the work-concentration conditions without scrolling.
- **A future reviewer auditing the lineage** — must be able to read ADR-0017 and learn exactly which part of ADR-0016 no longer describes the text, and that no figure moved.

## Functional requirements

### The one rule

1. **State one span rule, once, over an arbitrary slice set.** In `references/config.md` → *The inner viability gate* → *The makespan model*, replace the separately-written shapes with a single normative rule of the form: for a slice set `P` with declared integration slice `i(P)`, `span(P) = max over the non-integration members m of P of span(m), plus tasks(i(P))`, with a **leaf's** `span` equal to its `tasks`, and `tasks(none) = 0`. The rule must be stated **before** any of the derived quantities that reference it.

2. **Derive the four quantities from that rule, and state each as a derivation rather than a formula.**
   - `span(L)` for a split lane = the rule applied to **that lane's sub-lane set**.
   - `span(L)` for an unsplit lane = `tasks(L)` (the leaf case of the rule).
   - `span_max` = the rule applied to **the run's lane set**.
   - viable-flat `span_base` = the rule applied to **the run's lane set with every lane unsplit** — i.e. every lane taken at its leaf `span`.
   Each derived quantity keeps its existing name and its existing role in the model; only its *statement* changes from a restated formula to an application of the rule.

3. **`M_flat`'s span term and the baseline table's viable row both reference `span_base` by name** rather than re-expanding the `max`-plus-`tasks(integration)` shape a third and fourth time (`references/config.md:237` and the viable row of the baseline table at `:245`). The non-viable row (`span_base = T`) is unchanged — `T` is a **sum**, not an application of the span rule, and that distinction must remain explicit so a reader does not apply the rule to the sequential baseline.

4. **`M_seq` and `T` are explicitly outside the rule.** `T` is the sum over lanes of `tasks(L)` counting the integration lane in full; `M_seq = T` with no overhead. State plainly that the span rule does not apply to either, for the reason ADR-0016 §2 gives (an `off` run implements integration work one task at a time).

5. **Preserve the two independent claims the single rule does *not* subsume**, each stated in its own right:
   - **The top-level integration lane is never a sub-split candidate** (ADR-0016 §4), so `tasks(i(run))` is a **run constant** — invariant under adoption. The span rule alone does not imply this; it is what makes the cancellation in FR-6 exact.
   - **The depth cap.** The rule is stated generically so that one statement covers both depths the run has, but the run has **exactly two** (lane → sub-lane) and Steps 2s / 3s dispatch no third. The generic phrasing must not be readable as a claim that arbitrary nesting depth is supported.

### The cancellation identity

6. **Compress, do not delete, the `g`/`c` cancellation block** (`references/config.md:248`–`:254`, including the fenced `span_base = M + X   span_max = S + X   g = (M + X) − (S + X) = M − S` block). Under the one rule, `span_base` and `span_max` are the same function applied to two slice sets that share the identical declared `i(run)`, so on a viable flat baseline the `+ tasks(i(run))` term cancels **by construction** — the remaining content is one sentence naming the invariance of `tasks(i(run))` under adoption (FR-5) plus the resulting `g = M − S`. Replace the fenced derivation with that statement.

7. **Keep the sequential-baseline case in full.** `g = T − (S + tasks(i(run)))` on a sequential baseline does **not** follow by construction — `span_base` is `T` there, which is a sum and already counts the integration work as ordinary work, so nothing cancels. This half must survive the compression intact, including the statement that the difference from the uncorrected reading is `min(S, X)`.

8. **Keep the "a passing reconciliation is not evidence the model is right" claim.** The `M_flat − M_nested = g − c` identity is preserved under the one rule and must still be stated as preserved, together with the ADR-0016 point that this class of defect moves both makespans by the same amount and is therefore undetectable by the reconciliation. The old-model comparison itself stays in ADR-0016 and is referenced, not re-inlined.

### The exclusion prose

9. **Collapse the three near-verbatim exclusion blockquotes to one canonical statement plus two site-local pointers**, structured as follows (this is a deliberate partial collapse — see *Decisions resolved by Brainstormer default*, D3):
   - **Canonical site: `references/config.md:74`**, the first occurrence in reading order, at the deferral site under *The two work-concentration conditions are evaluated at leaf granularity*. It carries the **single generic statement** — the two work-concentration conditions exclude the declared integration slice of **whatever slice set they are evaluated over**, because they measure concurrency and it has none — together with the **only** surviving worked counter-examples (`{backend: 20, integration: 4}` and `{a: 3, b: 3, integration: 18}`), and the "excluded from these two conditions only; counts in full in `span_base`, `span_max`, `M_flat`, and `T`, including as the `70%` denominator" scope limit.
   - **`references/config.md:482`** (*Per-sub-lane re-application*) and **`references/config.md:498`** (*Leaf-level re-application*) each keep a **one-line** pointer to the canonical statement that still names, in that site's own vocabulary, **what** is excluded there (the split's declared integration slice / the run's top-level integration lane) and that it still counts in full toward that site's totals. A bare "see above" is **not** acceptable — a reader landing mid-document at either site must learn the effect without scrolling. The duplicated worked counter-examples at those two sites are removed.
   - The "a split/run whose `integration` field is `none` has nothing to exclude, and both conditions read exactly as they did before the field existed" reassurance is stated **once**, at the canonical site.

10. **Restate ADR-0016 §3's both-sites mandate as a consequence.** The sentence at `:498` asserting *"the exclusion applies at both evaluation sites or at neither"* becomes a one-clause observation that under a single rule it **cannot** apply at one site and not the other, with the failure it guards against (`{backend: 20, integration: 4}` passing the deferred check it was deferred *because of*) retained at the canonical site.

### Structural constraints on the edit

11. **No existing heading is renamed, removed, or re-levelled.** The one rule is added as lead text **inside the existing `#### The makespan model` heading**; the exclusion canonical statement stays under the existing `#### The two work-concentration conditions are evaluated at leaf granularity` heading. Every existing cross-reference target — *The makespan model*, *The baseline*, *The two work-concentration conditions are evaluated at leaf granularity*, *Leaf-level re-application of the two work-concentration conditions*, *Per-sub-lane re-application of the existing viability conditions*, *Containment*, *Owned-glob rejection*, *The cost side*, *Greedy, recomputed adoption*, *Degradation* — must still resolve from `SKILL.md`, `templates/architect.md`, and from within `config.md` itself. Audit every one of them after the edit.

12. **`SKILL.md` is changed only if it restates a formula normatively.** Verified at spec time: `SKILL.md:512` already says `span_base` "is defined normatively in `references/config.md` → *The makespan model* → *The baseline*, and is not redefined here", and `SKILL.md:544`/`:546` describe the print block as display only. The `2p.2` print-block **template strings must not change** — `Estimated speedup: {T} / span_base(max(concurrent {n},…) + integration({n}) = {span_base}) = {S}×`, the `Integration lane:` line, and the nested block's `span({lane})` / `span_max` lines are renderings, not a fifth normative statement, and their expanded on-screen form is deliberate (ADR-0016 §5). Change `SKILL.md` prose only where it duplicates the span shape as normative text; if the audit finds no such site, `SKILL.md` is left untouched and that is recorded.

### ADR-0017

13. **Author `docs/adr/0017-one-span-rule-over-any-slice-set.md`** (confirmed: `0016` is the highest existing ADR, so `0017` is the next free number — re-confirm before writing). It must, in ADR-0016's style:
   - Carry `Status: Accepted`, a date, a `Skills affected` line naming `orchestrator` and the specific sections touched, a `Source finding` line citing the `feat/prime-agent-distribution` PR-review backlog item `arch-2` and this spec ID, and a `Lineage` paragraph placing it after ADR-0012 → ADR-0014 → ADR-0016.
   - State explicitly **which part of ADR-0016 it supersedes**: the *derivation framing* — specifically the `span_base = M + X` / `span_max = S + X` derivation block in *The `g`/`c` interaction — derived, not asserted*, and §3's assertion that the exclusion applies at both sites or at neither.
   - State explicitly **what it leaves standing**: every ADR-0016 figure, every ADR-0016 decision (§1, §2, §4, §5, §6, §7), the three-branch old-model comparison, and the `min(S, X)` sequential-baseline result. ADR-0012, ADR-0013, and ADR-0014 stand unamended, ADR-0013 explicitly so.
   - Record the **Consequences**: no figure moves; the reconciliation identity is unchanged; the depth cap is now explicit; a future change to integration-lane pricing edits one site; and the "three depths of one defect" observation (ADR-0012 → ADR-0014 → ADR-0016) that motivated pre-empting a fourth.
   - Record, per the repo's *mirror machinery* convention, any deliberate divergence — in particular that the generic rule does **not** subsume the never-a-sub-split-candidate claim or the depth cap, which is why both survive as independent statements.

14. **Add a forward pointer to `docs/adr/0016-top-level-integration-lane-pricing.md`** naming ADR-0017 and stating that only the derivation framing is superseded while every decision and figure stands. Its `Status:` stays `Accepted`. This mirrors the precedent ADR-0016 itself set when it rewrote ADR-0014's *"Not addressed here"* bullet to point forward. Do not delete or rewrite any ADR-0016 conclusion.

### Regeneration

15. **Regenerate the Prime Agent distribution** with `node scripts/build-prime-agent.mjs`, then verify `node scripts/build-prime-agent.mjs --check` exits **0**. `prime-agent/skills/**` is a generated `rmSync`-plus-full-rewrite distribution and must **never** be hand-edited.

16. **Run an overlay-anchor census before and after the edit.** `scripts/build-prime-agent.mjs` hard-fails when any overlay `find` string's occurrence count drifts from its declared `count` (`applyReplacements`, `scripts/build-prime-agent.mjs:77`–`:81`), so `--check` exit 0 is the mechanical form of this. The census must additionally record, by exact string count, that these are unchanged:
   - `':(exclude).claude'` — **3** in `SKILL.md` (`:205`, `:235`, `:262`).
   - `the call shape from *How to spawn a subagent*` — **3** in `SKILL.md` (`:838`, `:898`, `:937`).
   - `through a **single sequential coder invocation**` — **2** in `SKILL.md` (`:981`, `:1047`). **Correction to the briefing:** this phrase is **not** an overlay anchor (verified — the orchestrator overlay contains no `find` string matching `sequential coder`, `span`, `integration`, or `makespan`). Its count constraint is **cross-document quote fidelity**, not a build hard-fail: `references/config.md:229` quotes it in unbolded form inside the sub-lane-integration blockquote, and that quotation must continue to match the `SKILL.md` wording it cites.
   - Verified at spec time and to be re-confirmed: `references/config.md` carries **exactly one** overlay anchor, the ADR-0001 link at `:86`, which is far outside the gate section this change edits; and the nearest `SKILL.md` anchors to the change region are at `:456`, `:458`, and `:488` (Step 2p.1), with **no** anchor inside the 2p.2 print block. The anchor risk is therefore genuinely low — the census is required anyway, because low is not zero and the build's failure mode is a hard stop.

### Verification of the reframe

17. **Every worked example is hand re-derived against the rewritten normative text**, and this is a first-class acceptance criterion, not a formality. The five examples are, in `references/config.md`: *the gate verdict and the ladder figure must agree* (`:324`), *one lane carries all the work (sequential baseline)* (`:340`), *a split carrying an integration sub-lane* (`:360`), *`k = 2`, the case the overlap exists for* (`:380`), and *a declared top-level integration lane (`tasks(integration) > 0`)* (`:417`). Their prior verification **does not carry over**, because this change rewrites the text they are checked against. Each example's every figure must be recomputed from the new rule and matched against the value currently printed.

18. **Mechanical no-numeral-drift check.** The diff restricted to the five worked-example subsections must contain **no change to any numeral**. This is verifiable by inspecting the diff hunks over those line ranges and is required **in addition to** FR-17's hand re-derivation — the mechanical check catches an accidental edit, the hand re-derivation catches a rule that no longer produces the printed number.

19. **The five-example coverage claim is re-checked, not assumed.** After the rewrite, confirm the examples still exercise: `X = 0` at both levels (`:324`, `:340`), a non-zero **sub-lane** integration slice (`:360`), `k = 2` with a recomputed critical lane (`:380`), and a non-zero **top-level** `tasks(integration)` with the cancellation identity shown explicitly (`:417`). The `:417` example's line *"Via the cancellation identity, `g` = `M − S` = `20 − 12` = **8**"* references the block FR-6 compresses, so its wording must be updated to reference the new statement while its arithmetic stays identical.

20. **No-regression floor.** `cd plugins/my-skills/skills/clean-code-gates && npm test` (recorded floor: 225 passing), `node scripts/build-prime-agent.mjs --check` exit 0, and `cd prime-agent && npm test`. All three cover surface unrelated to this change; they are a floor proving nothing else broke, never evidence that this change is correct.

## Non-functional requirements

- **Performance**: — (no runtime code path).
- **Security / auth**: — . The change touches no trust-anchor, no untrusted-input handling, and no *data, never instructions* surface. The *Untrusted metadata* section (`references/config.md:187`) and the digest's untrusted framing (`SKILL.md:488`) are out of the edit region and must remain byte-identical.
- **Localization**: — .
- **Accessibility**: — .
- **Geospatial / geofence**: — .
- **Trust / moderation**: — .
- **Privacy / compliance**: — . No new data of any kind.
- **Monetization tier**: — .
- **Test strategy (load-bearing, stated plainly)**: **no executable or behavioural test is specified, because none is reachable.** `parallelism` defaults to `off` in this repo and the `full` level with `k >= 2` cannot be exercised here, so there is no path that would execute the span rule. This is consistent with `PROJECT-CONTEXT.md` → *Test tooling* ("No automated test framework for doc-skill changes… verification is structural"). Verification for this change is **structural** (headings and cross-references resolve; the rule is stated once; the exclusion is stated once plus two pointers; overlay anchor counts hold; the distribution regenerates clean) and **arithmetic** (FR-17 hand re-derivation plus FR-18 no-numeral-drift). Do not invent a behavioural test to satisfy a coverage habit.
- **Readability constraint**: the rewritten text is **agent-read normative prose**. Brevity is not the objective — removing *duplication that must move in agreement* is. Where a reader landing mid-document needs a fact to proceed, a site-local restatement of that fact is correct and must be preserved (this is why FR-9 keeps pointers that name the effect rather than bare cross-references).

## Project-context fit

- **Layers touched.** `plugins/my-skills/skills/orchestrator/references/config.md` (primary, the normative owner), `plugins/my-skills/skills/orchestrator/SKILL.md` (only if FR-12's audit finds a normative restatement), `docs/adr/0017-*.md` (new), `docs/adr/0016-top-level-integration-lane-pricing.md` (forward pointer only), and the generated `prime-agent/skills/orchestrator/**`.
- **Depends on / extends.** ADR-0016 (immediate predecessor, whose derivation framing this supersedes), ADR-0014 (the sub-lane integration field made first-class), ADR-0012 (the serial-integration-slice and interface-point decisions), and ADR-0013 (the overlapped inner-join charge — a **dependency to leave alone**, not to extend). Implemented on top of `FEAT-20260819T053237Z-236f` (the ADR-0016 landing) — no in-flight work overlaps the gate section.
- **Invariants that shape the implementation.**
  - *Single-source-of-truth references* — this change is that convention applied to a section that had drifted from it; `references/config.md` remains the sole normative owner of the arithmetic and `SKILL.md` continues to summarize and link.
  - *Mirror machinery* — the deliberate divergences (the generic rule not subsuming the never-a-candidate claim, and the depth cap) are **recorded**, per convention, rather than left silently different.
  - *Backward compatibility* — trivially satisfied: no persisted artifact encodes the span formulas. The Step 2p digest is a transient per-run artifact (ADR-0016 Consequences) and `.orchestrator/run-manifest.json` persists none of it, so there is no migration.
  - *opencode-port-parity* — does **not** bind; `orchestrator` has no `.opencode` override port.
  - *Never commit or push* — the pipeline ends at `READY_TO_COMMIT`.
- **Conflicts the architect must resolve.** None found. The one tension is FR-9 versus the counter-argument that in-place restatement aids agent readers; it is resolved in this spec by the partial collapse (canonical statement plus effect-naming pointers), and the reasoning is recorded in D3 below rather than left to the architect to re-litigate.
- **Open product decisions this depends on.** None.

## Affected surface

- **Backend**: — .
- **Frontend / mobile**: — .
- **Admin**: — .
- **Shared**: — .
- **Skill source (the real surface)**:
  - `plugins/my-skills/skills/orchestrator/references/config.md` — *The makespan model* (`:210`–`:258`, the rule plus the four derivations plus the compressed cancellation), *The two work-concentration conditions are evaluated at leaf granularity* (`:64`–`:78`, canonical exclusion statement), *Per-sub-lane re-application* (`:475`–`:489`, pointer), *Leaf-level re-application* (`:491`–`:503`, pointer), and the wording-only touch to the `:417` worked example's cancellation-identity sentence.
  - `plugins/my-skills/skills/orchestrator/SKILL.md` — audit only; edit only on a proven normative restatement. Print-block template strings frozen.
  - `plugins/my-skills/skills/orchestrator/templates/architect.md` — **unamended** (referential mentions only at `:245`, `:247`).
- **Docs**: `docs/adr/0017-one-span-rule-over-any-slice-set.md` (new); `docs/adr/0016-top-level-integration-lane-pricing.md` (forward-pointer line only).
- **Generated**: `prime-agent/skills/orchestrator/**` — regenerated by `scripts/build-prime-agent.mjs`, never hand-edited.

## Open questions

_None._ Every unknown was resolved by a recorded Brainstormer default below. No reserved decision arose: the change introduces no out-of-scope item, no product-framing choice, no compliance or privacy dimension, and no irreversible one-way door — it is versioned prose in a doc skill, with no persisted artifact encoding the old shape and therefore no migration to undo.

## Decisions resolved by Brainstormer default

- **D1 — Adopt the one-rule reframe at all four sites, or a narrower subset?** → **All four** (`span(L)`, `span_max`, viable-flat `span_base`, `M_flat`'s span term), stated as one rule over a slice set with a leaf base case. → A narrower subset leaves two sites that must still move in agreement, which is the defect itself; the item's own fix names all four and the fourth (`M_flat`) is the cheapest of them.
- **D2 — Delete the `g`/`c` cancellation derivation block, as the item proposes, or compress it?** → **Compress, do not delete.** → The item's claim that the identity has "nothing to prove" under one rule is *almost* right: the cancellation is by construction only given that `tasks(i(run))` is invariant under adoption, which is ADR-0016 §4's separate never-a-sub-split-candidate decision, not a consequence of the span rule. And the **sequential-baseline** half (`g = T − (S + X)`, differing from the uncorrected reading by `min(S, X)`) genuinely does not follow by construction, because `T` is a sum. Deleting the block would drop both. One sentence for the flat case plus the sequential case intact is the honest reduction.
- **D3 — Collapse the three exclusion blockquotes fully, partially, or not at all?** → **Partially: one canonical statement at `:74` carrying the only surviving worked counter-examples, plus a one-line effect-naming pointer at `:482` and `:498`.** → The prior review's counter-argument is real and is honoured: this is agent-read normative prose and a reader landing at `:498` must learn *what* is excluded there without scrolling, so bare cross-references are rejected. But the genuine near-verbatim duplication is the **worked counter-examples**, which are restated almost identically at all three sites and buy a mid-document reader nothing the one-line effect statement does not. Note also that the three blockquotes are not three copies of one rule — `:74` and `:498` are the top-level rule at its two evaluation sites, `:482` is the sub-lane rule — which is precisely why the canonical statement must be phrased **generically over the slice set being evaluated**; that generic phrasing is what makes ADR-0016 §3's both-sites mandate true by construction (D4).
- **D4 — Keep ADR-0016 §3's "both sites or neither" as a mandate, or demote it?** → **Restate as a consequence**, retaining the failure mode it guards against at the canonical site. → Under one generic rule the two-site asymmetry is unstatable, so a mandate against it is a rule that cannot be violated; keeping the *reason* preserves the reviewer's context without preserving a redundant obligation.
- **D5 — ADR number.** → **ADR-0017**, re-confirmed as next free before writing. → `0016` is the highest existing ADR in `docs/adr/`; the briefing's expectation checks out.
- **D6 — Flip ADR-0016 to `Superseded`, or add a forward pointer?** → **Forward pointer; status stays `Accepted`.** → Only the derivation framing is superseded; every decision and figure stands, and a `Superseded` status would misrepresent a still-normative record. ADR-0016 set the precedent itself by rewriting ADR-0014's deferred bullet to point forward rather than restatusing it.
- **D7 — Does `SKILL.md` change?** → **Audit-only; edit only on a proven normative restatement, and freeze the 2p.2 print-block template strings either way.** → Verified at spec time that `SKILL.md:512`, `:544`, and `:546` already point rather than restate, and the expanded on-screen `max(concurrent …) + integration(…)` rendering is a deliberate ADR-0016 §5 decision about legibility, not a duplicated normative formula. Changing it would move a printed figure's *presentation*, which the no-figure-moves constraint forbids in spirit.
- **D8 — How strictly to pin "no figure moves"?** → **Two independent checks: a mechanical no-numeral-drift diff over the five worked-example subsections (FR-18) *and* a full hand re-derivation of all five (FR-17).** → The briefing is explicit that the examples' prior green does not carry over. The mechanical check alone would pass a rewrite whose rule no longer yields the printed number; the hand re-derivation alone is error-prone across five examples. Requiring both is cheap and each catches what the other misses.
- **D9 — Specify a behavioural test?** → **No, and say so plainly in the spec.** → Confirmed independently: `parallelism` defaults to `off`, `full` with `k >= 2` is unreachable in this repo, and `PROJECT-CONTEXT.md` → *Test tooling* already treats automated tests as N/A for doc-skill changes. Inventing one would be theatre against an unexecutable path.
- **D10 — Trust the briefing's third near-miss anchor?** → **No — verified and corrected.** `through a **single sequential coder invocation**` is **not** an overlay anchor; the orchestrator overlay contains no `find` string matching `sequential coder`, `span`, `integration`, or `makespan`. It appears 2× in `SKILL.md` (`:981`, `:1047`) and is **quoted** at `references/config.md:229`. Its count still matters, but as cross-document quote fidelity, not as a build hard-fail. The other two anchors are genuine (`':(exclude).claude'` ×3, `the call shape from *How to spawn a subagent*` ×3) and their counts were confirmed against the current tree. → Recording the correction prevents the architect from planning a build-failure mitigation for a constraint the build does not enforce, and from *missing* the quote-fidelity constraint the build also does not enforce.
- **D11 — Guard against the generic rule implying unbounded nesting depth?** → **Yes — state the two-level depth cap explicitly alongside the rule (FR-5).** → "At any depth" is exactly the phrasing that invites a future reader to assume a third level is dispatchable. The rule's generality is a *statement* economy, not a capability claim, and the difference has to be written down or the next ADR is about phantom depth-3 support.
- **D12 — Heading strategy?** → **Add no heading; place the rule as lead text inside the existing `#### The makespan model`, and audit every cross-reference target afterward (FR-11).** → Many pointers across `SKILL.md`, `templates/architect.md`, and `config.md` itself resolve by section title; a new or renamed heading turns a contained prose edit into a repo-wide link migration for no benefit.

## References

- `docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-19.md` → *Architecture* → item `arch-2` (the source finding; untrusted evidence, independently confirmed against the tree).
- `docs/adr/0016-top-level-integration-lane-pricing.md` — immediate predecessor; §3, §4, and *The `g`/`c` interaction — derived, not asserted* are the regions this change reframes.
- `docs/adr/0014-integration-slice-first-class-digest-field.md` — the sub-lane `integration` field; stands unamended.
- `docs/adr/0013-overlapped-inner-joins.md` — the inner-join `J` charge; **explicitly unamended**, concerns the cost side, not the span shape.
- `docs/adr/0012-nested-parallelism-cost-model-corrections.md` — the serial-integration-slice and `0.25` interface-point decisions; stands unamended.
- `plugins/my-skills/skills/orchestrator/references/config.md` — `:64`–`:78`, `:206`–`:258`, `:324`–`:446`, `:475`–`:503` (line numbers current as of `d297e6c`; re-locate every site by content).
- `plugins/my-skills/skills/orchestrator/SKILL.md` — `:464`, `:475`, `:490`, `:505`–`:546`, `:950`, `:981`, `:1047`.
- `plugins/my-skills/skills/orchestrator/templates/architect.md` — `:243`–`:249` (*5. Integration lane*); unamended.
- `scripts/build-prime-agent.mjs` — `:74`–`:86` (`applyReplacements`, the occurrence-count hard failure) and the `--check` contract.
- `prime-agent/overlays/orchestrator.json` — the anchor set censused in FR-16.
- `.orchestrator/PROJECT-CONTEXT.md` — *Conventions* (single-source-of-truth references; mirror machinery), *Invariants* (backward compatibility; opencode-port-parity), *Test tooling*, *Out of scope*.
- `plans/specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md` / `plans/feat/FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md` — the ADR-0016 landing this builds on.
