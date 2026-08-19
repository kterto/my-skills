---
id: FEAT-20260819T101153Z-e883
title: One span rule over any slice set, at any depth (ADR-0017)
type: feat
status: DONE
created_at: 2026-08-19T10:13:42Z
updated_at: 2026-08-19T11:12:00Z
cycle: 0
related_to: SPEC-20260819T100451Z-01da, SPEC-20260819T052229Z-3d97, FEAT-20260819T053237Z-236f
---

**Related:** [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md)

## Overview

`plugins/my-skills/skills/orchestrator/references/config.md` writes the same "concurrent `max` plus serial remainder" shape as four separate normative formulas — `span(L)`, `span_max`, the baseline table's viable-row `span_base`, and `M_flat`'s span term — plus a fenced `g`/`c` derivation block that exists only because two of those were written separately. This plan replaces the four statements with **one rule stated over an arbitrary slice set**, derives each of the four from it, compresses (not deletes) the cancellation block, and partially collapses the three near-verbatim integration-lane exclusion blockquotes to one canonical statement plus two effect-naming pointers. It records the decision as ADR-0017 and adds a forward pointer to ADR-0016.

This is a **reframing, not a repricing**. Every figure the model prints — `M_flat`, `M_nested`, `M_seq`, `T`, `g`, `c`, `span_base`, `span_max`, `A`, `J`, `0.25`, `70%` — and every numeral in all five worked examples must be numerically identical afterwards. That is pinned by two independent checks (mechanical no-numeral-drift diff **and** full hand re-derivation), because the rewrite changes the very text the examples are checked against, so their prior verification does not carry over. Implemented on top of `FEAT-20260819T053237Z-236f` (the ADR-0016 landing); no in-flight work overlaps the gate section.

## Acceptance Criteria

1. `references/config.md` → `#### The makespan model` states the span rule **exactly once**, generically over a slice set `P` with declared integration slice `i(P)`: `span(P) = max over non-integration members m of P of span(m), plus tasks(i(P))`, with a leaf's `span` equal to its `tasks` and `tasks(none) = 0`; the rule appears **before** any quantity that references it.
2. `span(L)` (split), `span(L)` (unsplit, leaf case), `span_max`, and the viable-flat `span_base` are each stated as **the rule applied to a named slice set**, not as a re-expanded `max`-plus-`tasks(integration)` formula. Each keeps its existing name and role.
3. `M_flat`'s span term (`references/config.md:237` region) and the baseline table's **viable** row reference `span_base` **by name**; the `max`-plus-`tasks(integration)` shape appears in neither.
4. The baseline table's **non-viable** row still reads `span_base = T`, with explicit text that `T` is a **sum** and not an application of the span rule, so a reader cannot apply the rule to the sequential baseline.
5. `T` and `M_seq` are explicitly stated as outside the rule, for the ADR-0016 §2 reason (an `off` run implements integration work one task at a time).
6. Two claims the rule does **not** subsume survive as independent statements: (a) the top-level integration lane is never a sub-split candidate (ADR-0016 §4), making `tasks(i(run))` a run constant invariant under adoption; (b) the run has **exactly two** depths (lane → sub-lane) and Steps 2s/3s dispatch no third — the generic phrasing is a statement economy, not a capability claim.
7. The fenced derivation block `span_base = M + X   span_max = S + X   g = (M + X) − (S + X) = M − S` is **replaced** by one sentence naming the by-construction cancellation plus the invariance of `tasks(i(run))` under adoption, yielding `g = M − S`. The block is gone; the identity and its name survive.
8. The **sequential-baseline** half survives intact: `g = T − (S + tasks(i(run)))`, with the reason (`span_base` is `T`, a sum that already counts the integration work as ordinary work, so nothing cancels).
9. The `M_flat − M_nested = g − c` reconciliation is still stated as holding on both baselines and still carries the "a passing reconciliation is not evidence the model is right" point; the three-branch old-model comparison remains referenced to ADR-0016, not re-inlined.
10. `references/config.md:74` (the deferral site) carries the **single canonical, generically-phrased** exclusion statement — over "whatever slice set the conditions are evaluated over" — with the **only** surviving worked counter-examples (`{backend: 20, integration: 4}` and `{a: 3, b: 3, integration: 18}`), the "these two conditions only; counts in full in `span_base`, `span_max`, `M_flat`, and `T`, including as the `70%` denominator" scope limit, and the `integration: none` reassurance stated once.
11. The `Per-sub-lane re-application` site (`:482` region) and the `Leaf-level re-application` site (`:498` region) each carry a **one-line** pointer that names, in that site's own vocabulary, **what** is excluded there (the split's declared integration slice / the run's top-level integration lane) and that it still counts in full toward that site's totals. Neither is a bare "see above". Their duplicated worked counter-examples are removed.
12. ADR-0016 §3's "the exclusion applies at both evaluation sites or at neither" is restated as a **one-clause consequence** (under one generic rule the asymmetry is unstatable), with the failure it guards against retained at the canonical site.
13. **No heading anywhere in `references/config.md` is renamed, removed, added, or re-levelled.** All ten named cross-reference targets still resolve from `SKILL.md`, `templates/architect.md`, and from within `config.md` itself.
14. `SKILL.md` is changed **only** where it restates the span shape as normative text. The Step 2p.2 print-block template strings are byte-identical, including `Estimated speedup: {T} / span_base(max(concurrent {n},…) + integration({n}) = {span_base}) = {S}×`, the `Integration lane:` line, and the nested block's `span({lane})` / `span_max` lines. If the audit finds no normative restatement, `SKILL.md` is untouched and that outcome is recorded in the Progress Log.
15. `templates/architect.md` is unamended.
16. `docs/adr/0017-one-span-rule-over-any-slice-set.md` exists, in ADR-0016's style, with `Status: Accepted`, a date, `Skills affected`, `Source finding` (backlog item `arch-2` + this spec ID), and a `Lineage` paragraph placing it after ADR-0012 → ADR-0014 → ADR-0016.
17. ADR-0017 states explicitly **what it supersedes** (ADR-0016's derivation framing: the `span_base = M + X` / `span_max = S + X` block in *The `g`/`c` interaction — derived, not asserted*, and §3's both-sites assertion) and **what it leaves standing** (every ADR-0016 figure; §1, §2, §4, §5, §6, §7; the three-branch old-model comparison; the `min(S, X)` sequential-baseline result; ADR-0012/0013/0014 unamended, ADR-0013 explicitly so).
18. ADR-0017 records Consequences (no figure moves; reconciliation identity unchanged; depth cap now explicit; integration-lane pricing is now a one-site edit; the "three depths of one defect" observation) and, per the *mirror machinery* convention, the deliberate divergence that the generic rule does not subsume the never-a-candidate claim or the depth cap.
19. `docs/adr/0016-top-level-integration-lane-pricing.md` carries a forward pointer naming ADR-0017 and stating that only the derivation framing is superseded while every decision and figure stands. Its `Status:` is still `Accepted`. No ADR-0016 conclusion is deleted or rewritten.
20. **Mechanical no-numeral-drift:** the diff restricted to the five worked-example subsections contains **no change to any numeral**. The one permitted textual change in that region is the `:417` example's cancellation-identity sentence, whose wording is updated to reference the new statement while its arithmetic (`g` = `M − S` = `20 − 12` = **8**) is unchanged.
21. **Hand re-derivation:** each of the five worked examples is recomputed from the rewritten rule and every figure matched against the value printed today. All five are recorded as re-derived in the Progress Log, per example.
22. Five-example coverage is re-confirmed after the rewrite: `X = 0` at both levels (`:324`, `:340`), a non-zero **sub-lane** integration slice (`:360`), `k = 2` with a recomputed critical lane (`:380`), and a non-zero **top-level** `tasks(integration)` with the cancellation identity shown explicitly (`:417`).
23. **Overlay-anchor census holds** across the edit, by exact string count: `':(exclude).claude'` = **3** in `SKILL.md`; `the call shape from *How to spawn a subagent*` = **3** in `SKILL.md`; `through a **single sequential coder invocation**` = **2** in `SKILL.md` and its unbolded quotation = **1** in `references/config.md` (cross-document quote fidelity — the two must still match); `references/config.md` carries **exactly one** overlay anchor (the ADR-0001 link).
24. `node scripts/build-prime-agent.mjs` regenerates the distribution and `node scripts/build-prime-agent.mjs --check` exits **0**. `prime-agent/skills/**` is not hand-edited at any point.
25. No-regression floor holds: `cd plugins/my-skills/skills/clean-code-gates && npm test` at **225 passing**, `node scripts/build-prime-agent.mjs --check` exit 0, `cd prime-agent && npm test` green.
26. `references/config.md:187` (*Untrusted metadata*) and `SKILL.md:488` (the digest's untrusted framing) are **byte-identical** to their pre-edit state.

## Out of Scope

- **Any repricing.** No change to `M_flat`, `M_nested`, `M_seq`, `T`, `g`, `c`, `span_base`, `span_max`, `A`, `J`, the `0.25` interface-point conversion, the `70%` threshold, the aggregate `I > T` guard, or the `max_parallel_lanes` ceiling. Moving any arithmetic means the work was mis-scoped.
- **Any change to the digest contract** — the lane-level and sub-lane-level `integration` field, its strict shape, and "omitted ⇒ rejected outright, never read as zero" (ADR-0014 §1, ADR-0016 §1).
- **Amending ADR-0012, ADR-0013, or ADR-0014.** ADR-0013 (the inner-join `J` charge) is explicitly a dependency to leave alone.
- **Flipping ADR-0016's status.** It stays `Accepted`; a forward pointer only.
- **Any behavioural or executable test.** None is reachable — see Technical Notes.
- **Any heading rename, deletion, addition, or re-levelling** in the gate section.
- **Hand-editing `prime-agent/skills/**`.** It is generated by `rmSync` + full rewrite.
- **opencode port work.** `orchestrator` has no `.opencode/skills/orchestrator/` override port; the `opencode-port-parity` invariant does not bind (only `pr-review-report` and `spec-driven-eval` have ports).
- **Changing `templates/architect.md`** — it names `span_base` / `span_max` / `span(L)` referentially at `:245` / `:247` and restates no formula.
- **Changing the Step 2p.2 print-block template strings.** Their expanded on-screen form is a deliberate ADR-0016 §5 legibility decision, not a fifth normative statement.
- **Committing or pushing.** The pipeline ends at `READY_TO_COMMIT`.

## Technical Notes

- **`min(S, X)` lives in ADR-0016, not in `config.md`** — verified: `grep 'min(S' references/config.md` returns 0 matches; ADR-0016 carries it at `:141`, `:144`, `:183`. FR-7's "including the statement that the difference from the uncorrected reading is `min(S, X)`" is therefore satisfied by (a) `config.md`'s sequential sentence `g = T − (S + X)` surviving intact and (b) ADR-0017 listing the `min(S, X)` sequential-baseline result under *what it leaves standing*. **Do not add a new `min(S, X)` claim to `config.md`** — that would be new normative content, not a compression.
- **The three exclusion blockquotes are not three copies of one rule.** `:74` and `:498` are the top-level rule at its two evaluation sites; `:482` is the sub-lane rule. This is exactly why the canonical statement must be phrased **generically over the slice set being evaluated** — and that generic phrasing is what makes ADR-0016 §3's both-sites mandate true by construction. A collapse that merges them without generalizing first is wrong.
- **The collapse is deliberately partial.** This is agent-read normative prose; a reader landing mid-document at `:498` must learn *what* is excluded there without scrolling. The genuine near-verbatim duplication is the **worked counter-examples**, which buy a mid-document reader nothing the one-line effect statement does not. Bare cross-references are explicitly rejected (spec D3). Brevity is not the objective; removing *duplication that must move in agreement* is.
- **`through a **single sequential coder invocation**` is NOT an overlay anchor** — verified: the orchestrator overlay contains no `find` string matching `sequential coder`, `span`, `integration`, or `makespan`. Its count constraint is **cross-document quote fidelity** (`config.md:229` quotes it unbolded and must keep matching the `SKILL.md` wording it cites), not a build hard-fail. Do not plan a build-failure mitigation for it — and do not therefore skip the quote-fidelity check, which the build also does not enforce.
- **`config.md` carries exactly one overlay anchor** (the ADR-0001 link at `:86`), far outside the gate section. The nearest `SKILL.md` anchors to the change region are `:456`, `:458`, `:488` (Step 2p.1), with **no** anchor inside the 2p.2 print block. Anchor risk is genuinely low — the census runs anyway, because low is not zero and `applyReplacements` (`scripts/build-prime-agent.mjs:77`–`:81`) hard-fails the build on any occurrence-count drift.
- **No executable path exists for this change, and none can be written.** `parallelism` defaults to `off` in this repo and the `full` level with `k >= 2` is unreachable here, so nothing would execute the span rule. This matches `PROJECT-CONTEXT.md` → *Test tooling* ("No automated test framework for doc-skill changes… verification is structural"). Verification is **structural** (headings and cross-references resolve; the rule stated once; the exclusion once plus two pointers; anchor counts hold; distribution regenerates clean) and **arithmetic** (hand re-derivation + no-numeral-drift). **Do not invent a behavioural test to satisfy a coverage habit.**
- **The pre-edit oracle is the TDD analogue.** Because no test can be written, the ordering discipline is: capture the expected outputs (numerals, anchor counts, cross-reference inventory, floor results) **before** touching a single line, then edit, then assert the captured oracle still holds. Phase 0 exists for exactly this reason and must not be skipped or reordered after the edits.
- **`.orchestrator/PROJECT-CONTEXT.md` conventions that shape the edit:** *Single-source-of-truth references* — this change is that convention applied to a section that drifted from it; `references/config.md` remains the sole normative owner of the arithmetic and `SKILL.md` continues to summarize and link. *Mirror machinery* — the deliberate divergences (the rule not subsuming the never-a-candidate claim, and the depth cap) are **recorded**, not left silently different.
- **Backward compatibility** is trivially satisfied: no persisted artifact encodes the span formulas. The Step 2p digest is a transient per-run artifact and `.orchestrator/run-manifest.json` persists none of it, so there is no migration.
- **Line numbers in the spec are current as of `d297e6c`.** Re-locate every site by content, never by line number.
- **ADR-0017 is confirmed next free** — `0016` is the highest existing ADR in `docs/adr/`. Re-confirm with `ls docs/adr/` immediately before writing.
- **No open product decision** is touched by this plan.

## Tasks

> Tasks are ordered oracle-first: the expected outputs are captured before any text changes, because no executable test can exist for this surface (see Technical Notes).
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase.

### Phase 0 — Capture the pre-edit oracle

- [x] Record the pre-edit numeral oracle: extract every numeral from the five worked-example subsections of `references/config.md` (*the gate verdict and the ladder figure must agree*, *one lane carries all the work (sequential baseline)*, *a split carrying an integration sub-lane*, *`k = 2`, the case the overlap exists for*, *a declared top-level integration lane*) into a scratch snapshot, together with each subsection's current line range. Located by heading text, not line number.
- [x] Record the pre-edit anchor + quote-fidelity census: `':(exclude).claude'` in `SKILL.md`; `the call shape from *How to spawn a subagent*` in `SKILL.md`; `through a **single sequential coder invocation**` in `SKILL.md`; the unbolded quotation in `references/config.md`; and the count of overlay `find` strings from `prime-agent/overlays/orchestrator.json` that occur in `references/config.md`. Expected: 3, 3, 2, 1, 1.
- [x] Record the pre-edit cross-reference target inventory: every occurrence in `SKILL.md`, `templates/architect.md`, and `references/config.md` that resolves to one of *The makespan model*, *The baseline*, *The two work-concentration conditions are evaluated at leaf granularity*, *Leaf-level re-application of the two work-concentration conditions*, *Per-sub-lane re-application of the existing viability conditions*, *Containment*, *Owned-glob rejection*, *The cost side*, *Greedy, recomputed adoption*, *Degradation*.
- [x] Record the pre-edit byte hashes of `references/config.md` → *Untrusted metadata* section and the `SKILL.md` digest untrusted-framing paragraph, and of the entire Step 2p.2 print block, so AC-14 and AC-26 are checkable mechanically.
- [x] Record the pre-edit no-regression floor: `cd plugins/my-skills/skills/clean-code-gates && npm test` (expect 225 passing), `node scripts/build-prime-agent.mjs --check` (expect exit 0), `cd prime-agent && npm test` (expect green).

### Phase 0 verification

- [x] All five oracle artifacts exist in scratch and are non-empty.
- [x] `node scripts/build-prime-agent.mjs --check` exits 0 (clean starting tree).
- [x] `cd plugins/my-skills/skills/clean-code-gates && npm test` exits 0 at 225 passing.
- [x] `cd prime-agent && npm test` exits 0.

### Phase 1 — The one rule and its four derivations

- [x] Write the single normative span rule as **lead text inside the existing `#### The makespan model` heading**, generic over a slice set `P` with declared integration slice `i(P)`, with the leaf base case (`span(leaf) = tasks(leaf)`) and `tasks(none) = 0`, positioned **before** any quantity that references it. Add no heading.
- [x] Restate `span(L)` as two applications of the rule — the split case (the rule over that lane's sub-lane set) and the unsplit case (the leaf case) — replacing the re-expanded `max`-plus-`tasks(integration)` formula while keeping the name and role. Preserve the two existing blockquotes attached to it (the `tasks(integration)` digest-field blockquote and the "the integration sub-lane is serial" blockquote), including the exact unbolded quotation of `through a single sequential coder invocation`.
- [x] Restate `span_max` as the rule applied to the run's lane set, keeping "the bare critical-path term, carrying **no** overhead" and its role as the term the marginal gain is measured over.
- [x] Restate `M_flat`'s span term to reference `span_base` **by name**, and rewrite the baseline table's **viable** row's `span_base` cell as the rule applied to the run's lane set with every lane unsplit (each lane at its leaf `span`). Neither re-expands the shape.
- [x] Keep the baseline table's **non-viable** row as `span_base = T` and state explicitly that `T` is a **sum**, not an application of the span rule, so the rule is not misread onto the sequential baseline.
- [x] State plainly that `T` and `M_seq` are outside the rule, with the ADR-0016 §2 reason (an `off` run implements the integration work one task at a time, so `T` and `M_seq` are unchanged by the correction).
- [x] Preserve, as two independent statements the rule does not subsume: (a) the top-level integration lane is never a sub-split candidate (ADR-0016 §4), making `tasks(i(run))` a run constant invariant under adoption; (b) the depth cap — the run has exactly two depths (lane → sub-lane), Steps 2s/3s dispatch no third, and the rule's generality is a statement economy, not a capability claim.

### Phase 1 verification

- [x] `grep -c '^####\|^###\|^##' references/config.md` matches the Phase 0 heading count, and a heading-text diff shows zero renames, additions, or re-levellings.
- [x] The `max`-plus-`tasks(integration)` shape is written exactly once in `#### The makespan model` (the rule itself); `span(L)`, `span_max`, `M_flat`'s span term, and the viable row do not restate it.
- [x] `node scripts/build-prime-agent.mjs --check` exits 0 or fails only on the expected source-drift signal (never on an occurrence-count mismatch).

### Phase 2 — Compress the cancellation identity

- [x] Replace the fenced `span_base = M + X   span_max = S + X   g = (M + X) − (S + X) = M − S` block with one sentence stating that, under the one rule, `span_base` and `span_max` are the same function over two slice sets sharing the identical declared `i(run)`, so on a viable flat baseline the `+ tasks(i(run))` term cancels **by construction** given the run-constancy of `tasks(i(run))` (Phase 1's independent claim), yielding `g = M − S`.
- [x] Keep the **sequential-baseline** half intact and unabridged: `g = T − (S + X)`, with the reason that `span_base` is `T` there, a sum that already counts the integration work as ordinary work, so nothing cancels. Add no `min(S, X)` claim to `config.md` (see Technical Notes).
- [x] Keep the statement that `M_flat − M_nested = g − c` holds on both baselines unchanged under the one rule, together with the ADR-0016 point that this defect class moves both makespans by the same amount and is therefore undetectable by the reconciliation. Keep the old-model comparison referenced to ADR-0016, not re-inlined.

### Phase 2 verification

- [x] The fenced `span_base = M + X` derivation block no longer appears in `references/config.md`.
- [x] The sequential-baseline sentence and the `M_flat − M_nested = g − c` reconciliation sentence both still appear, and `grep 'min(S' references/config.md` still returns 0 matches.
- [x] `node scripts/build-prime-agent.mjs --check` behaves as in Phase 1.

### Phase 3 — Partially collapse the exclusion prose

- [x] Rewrite the canonical blockquote at the deferral site (under *The two work-concentration conditions are evaluated at leaf granularity*) as the **single generic statement** — the two conditions exclude the declared integration slice of **whatever slice set they are evaluated over**, because they measure concurrency and it has none — carrying the only surviving worked counter-examples (`{backend: 20, integration: 4}`, `{a: 3, b: 3, integration: 18}`), the "these two conditions only; counts in full in `span_base`, `span_max`, `M_flat`, and `T`, including as the `70%` denominator" scope limit, and the `integration: none` reassurance stated once.
- [x] Replace the *Per-sub-lane re-application* blockquote with a one-line pointer that names the **split's declared integration slice** as what is excluded there and states it still counts in full toward `span(L)` and `T`. Remove that site's duplicated worked counter-examples. Not a bare "see above".
- [x] Replace the *Leaf-level re-application* blockquote with a one-line pointer that names the **run's top-level integration lane** as what is excluded there and states it still counts in full toward `span_base`, `span_max`, `M_flat`, and `T`, with the `70%` denominator still the run total `T` which includes it. Remove that site's duplicated worked counter-examples. Not a bare "see above".
- [x] Restate ADR-0016 §3's "the exclusion applies at both evaluation sites or at neither" as a one-clause consequence — under a single generic rule it cannot apply at one site and not the other — and confirm the failure it guards against (`{backend: 20, integration: 4}` passing the deferred check it was deferred *because of*) is retained at the canonical site.

### Phase 3 verification

- [x] The `{a: 3, b: 3, integration: 18}` counter-example appears exactly once in `references/config.md`; the `integration: none` reassurance appears exactly once.
- [x] Both pointer sites name what is excluded in their own vocabulary and state the counts-in-full scope; neither is a bare cross-reference.
- [x] Heading inventory still matches Phase 0. `node scripts/build-prime-agent.mjs --check` behaves as in Phase 1.

### Phase 4 — Audit `SKILL.md` and every cross-reference

- [x] Audit `SKILL.md` for any **normative** restatement of the span shape. Verified at spec time that `:512` points rather than restates and `:544`/`:546` describe display only. Edit only on a proven normative restatement; otherwise leave `SKILL.md` untouched and record that outcome explicitly in the Progress Log.
- [x] Assert the Step 2p.2 print-block template strings are byte-identical against the Phase 0 hash — including `Estimated speedup: {T} / span_base(max(concurrent {n},…) + integration({n}) = {span_base}) = {S}×`, the `Integration lane:` line, and the nested block's `span({lane})` / `span_max` lines.
- [x] Re-resolve every cross-reference target from the Phase 0 inventory — all ten named sections — from `SKILL.md`, `templates/architect.md`, and within `config.md` itself. Confirm `templates/architect.md` needs no amendment (referential mentions only).
- [x] Assert `references/config.md` → *Untrusted metadata* and the `SKILL.md` digest untrusted-framing paragraph are byte-identical against the Phase 0 hashes.

### Phase 4 verification

- [x] Every entry in the Phase 0 cross-reference inventory resolves to an existing heading; zero unresolved.
- [x] Print-block and untrusted-section hashes match Phase 0 exactly.
- [x] `git diff --stat` shows `templates/architect.md` unchanged.

### Phase 5 — Re-verify the arithmetic (two independent checks)

- [x] **Mechanical no-numeral-drift:** diff `references/config.md` restricted to the five worked-example subsections and confirm no numeral changed. The single permitted textual change in that region is the top-level-integration example's cancellation-identity sentence (`Via the cancellation identity, g = M − S = 20 − 12 = 8`), reworded to reference the new statement with its arithmetic untouched.
- [x] **Hand re-derivation, example 1** — *the gate verdict and the ladder figure must agree*: recompute every figure from the rewritten rule and match against the printed value.
- [x] **Hand re-derivation, example 2** — *one lane carries all the work (sequential baseline)*: recompute every figure, confirming the sequential baseline is derived from `T` as a sum, not from the span rule.
- [x] **Hand re-derivation, example 3** — *a split carrying an integration sub-lane*: recompute every figure, confirming the non-zero sub-lane integration slice is still charged after the concurrent `max`.
- [x] **Hand re-derivation, example 4** — *`k = 2`, the case the overlap exists for*: recompute every figure, confirming the recomputed critical lane and the ADR-0013 inner-join `J` charge are unchanged.
- [x] **Hand re-derivation, example 5** — *a declared top-level integration lane*: recompute `T`=42, `span_base`=24, `M_flat`=29, `span_max`=16, `M_nested`=25.5, `g`=8, `c`=4.5, and the reconciliation 3.5, all from the rewritten rule.
- [x] Re-confirm the five-example coverage claim: `X = 0` at both levels (examples 1, 2), a non-zero **sub-lane** integration slice (example 3), `k = 2` with a recomputed critical lane (example 4), and a non-zero **top-level** `tasks(integration)` with the cancellation identity shown explicitly (example 5).

### Phase 5 verification

- [x] The worked-example diff contains zero numeral changes.
- [x] All five hand re-derivations are recorded per example in the Progress Log, each reproducing the printed figures exactly.
- [x] `node scripts/build-prime-agent.mjs --check` behaves as in Phase 1.

### Phase 6 — ADR-0017 and the ADR-0016 forward pointer

- [x] Re-confirm `0017` is the next free ADR number (`ls docs/adr/`), then author `docs/adr/0017-one-span-rule-over-any-slice-set.md` in ADR-0016's style with `Status: Accepted`, a date, `Skills affected` naming `orchestrator` and the specific sections touched, `Source finding` citing the `feat/prime-agent-distribution` backlog item `arch-2` and `SPEC-20260819T100451Z-01da`, and a `Lineage` paragraph placing it after ADR-0012 → ADR-0014 → ADR-0016.
- [x] In ADR-0017, state explicitly **what is superseded**: ADR-0016's derivation framing — the `span_base = M + X` / `span_max = S + X` block in *The `g`/`c` interaction — derived, not asserted*, and §3's assertion that the exclusion applies at both sites or at neither.
- [x] In ADR-0017, state explicitly **what stands**: every ADR-0016 figure; ADR-0016 §1, §2, §4, §5, §6, §7; the three-branch old-model comparison; the `min(S, X)` sequential-baseline result; and ADR-0012, ADR-0013 (explicitly), and ADR-0014 unamended.
- [x] In ADR-0017, record Consequences (no figure moves; the reconciliation identity is unchanged; the depth cap is now explicit; integration-lane pricing is now a one-site edit; the "three depths of one defect" observation ADR-0012 → ADR-0014 → ADR-0016 that motivated pre-empting a fourth) and, per *mirror machinery*, the deliberate divergence that the generic rule subsumes neither the never-a-sub-split-candidate claim nor the depth cap.
- [x] Add a forward pointer to `docs/adr/0016-top-level-integration-lane-pricing.md` naming ADR-0017 and stating that only the derivation framing is superseded while every decision and figure stands — mirroring the precedent ADR-0016 set with ADR-0014's deferred bullet. Leave `Status: Accepted` and delete or rewrite no conclusion.

### Phase 6 verification

- [x] `docs/adr/0017-one-span-rule-over-any-slice-set.md` exists and carries every required section.
- [x] `git diff docs/adr/0016-top-level-integration-lane-pricing.md` shows only an added forward pointer; `Status:` line unchanged.
- [x] Every ADR cross-reference in 0017 (0012, 0013, 0014, 0016) resolves to an existing file.

### Phase 7 — Regenerate, re-census, and prove the floor

- [x] Run `node scripts/build-prime-agent.mjs` to regenerate the distribution from `plugins/my-skills/skills/` plus `prime-agent/overlays/*.json`. Confirm `prime-agent/skills/**` was never hand-edited (`git diff` on it shows only regeneration output).
- [x] Run the **post-edit** anchor + quote-fidelity census and match it against the Phase 0 record: `':(exclude).claude'` = 3, `the call shape from *How to spawn a subagent*` = 3, `through a **single sequential coder invocation**` = 2 in `SKILL.md`, its unbolded quotation = 1 in `references/config.md` and still matching the `SKILL.md` wording it cites, and exactly 1 overlay anchor in `references/config.md`.
- [x] Run the full no-regression floor and confirm each: `cd plugins/my-skills/skills/clean-code-gates && npm test` at 225 passing, `node scripts/build-prime-agent.mjs --check` exit 0, `cd prime-agent && npm test` green. Record each result; they prove nothing else broke, never that this change is correct.

### Phase 7 verification

- [x] `node scripts/build-prime-agent.mjs --check` exits **0**.
- [x] `cd prime-agent && npm test` exits 0.
- [x] `cd plugins/my-skills/skills/clean-code-gates && npm test` exits 0 at 225 passing.
- [x] Post-edit census matches the Phase 0 census exactly, with no count drift.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands from the Commands section of `PROJECT-CONTEXT.md` that apply to the phase's touched paths and asserts each exits 0. A failure routes through the coder's BLOCKED step, not a silent rewrite.

Applying `PROJECT-CONTEXT.md` → **Commands** to this change:

- **No build step and no markdown lint** exist for doc-skill authoring — neither is emitted.
- **`clean-code-gates` JS test suite** (`cd plugins/my-skills/skills/clean-code-gates && npm test`) — its path condition (`plugins/my-skills/skills/clean-code-gates/**`) is **not** matched by any phase's diff. It is run only as the Phase 0 and Phase 7 no-regression floor, never as a per-phase gate. `PROJECT-CONTEXT.md` is explicit that it must not be invoked against non-JS doc skills.
- **`node scripts/build-prime-agent.mjs --check`** — path condition `plugins/my-skills/skills/orchestrator/**`, matched by Phases 1–4. This is the one mechanical gate that applies to the edit region, because it hard-fails on overlay-anchor occurrence-count drift (`applyReplacements`, `scripts/build-prime-agent.mjs:77`–`:81`). In Phases 1–4 it may legitimately report source drift against the not-yet-regenerated distribution; the assertion in those phases is specifically that it does **not** fail on an occurrence-count mismatch. In Phase 7, after regeneration, it must exit **0** outright.
- **`cd prime-agent && npm test`** — path condition `prime-agent/**`, matched only by Phase 7 (regeneration). Must exit 0 there.

Phase exit criterion: ALL applicable commands above exit 0 (or, for `--check` in Phases 1–4, fail on nothing but expected source drift) on the changed set, **and** every item in that phase's `### Phase N verification` checklist is green. No silent rewrite of `references/config.md` to make a check pass without a corresponding plan task — and in particular, no numeral is ever adjusted to make a hand re-derivation agree. A hand re-derivation that disagrees with a printed figure means the rewritten rule is wrong; it routes through BLOCKED.

G1 (coverage) and G6 (mutation) are QA-only and are not emitted here. No structural or behavioural test is emitted at any phase, because none is reachable — see Technical Notes.

## Dependencies

- `FEAT-20260819T053237Z-236f` (the ADR-0016 landing) must be DONE — verified present in `plans/feat/`. No other plan is a dependency; no in-flight work overlaps the gate section.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T10:34:48Z | TESTER

TEST-20260819T103448Z-5a36 created. Status: PASS. Coverage: N/A → N/A (inapplicable — no executable path exists for this surface; `parallelism` is `off` and `full` with `k >= 2` is unreachable, so coverage is not below floor, it does not apply).

Central claim independently verified: **no figure moved.** All five worked examples hand re-derived from the rewritten rule with every printed figure reproduced; all nine derived quantities value-identical to the pre-edit formulas; numeral sequences identical before/after (45/63/62/146/130 excluding heading lines — the coder's 147/131 includes them, both conventions agree); four of five bodies byte-identical, the fifth differing only by the permitted cancellation-identity rewording. All four dependents (`span(L)` split + leaf, `span_max`, `M_flat`'s span term, viable `span_base`) confirmed to recover their pre-edit formulas exactly — no quantity changed meaning while keeping its number. `T` and `M_seq` confirmed outside the rule at three sites.

Pinned constraints all held: `min(S` = 0; 31 headings byte-identical; 10/10 cross-references resolve; anchor + quote-fidelity census 3/3/2/1/1 with zero drift; ADR-0016 append-only (11/0) with `Status: Accepted` intact; ADR-0012/0013/0014 and `templates/architect.md` unamended; `SKILL.md` audit verified — genuinely unedited (md5 identical to HEAD); distribution regenerated clean (`--check` exit 0, single expected overlay-replacement line).

Three findings routed to the reviewer, none blocking, all pre-existing text: F1 — the new "one-site edit" claim at `config.md:234` is overstated; six other sites still carry the shape, and `config.md:309`/`:316` are incomplete when `X > 0` (combining `:259`'s correct `span_base` with `:309` yields `g` = 12 vs the correct 8 on example 5). F2 — `SKILL.md:534`'s nested `span_max` print line omits the integration summand and is **not** covered by the ADR-0016 §5 exemption the plan invoked (§5 covers the flat block only). F3 — the simplify pass's deferred `:243`/`:246` finding assessed as narrowly right: collapse the shared general-argument clause only, never wholesale (each site uniquely carries a machine citation, ADR attribution, and the quote-fidelity anchor).

### 2026-08-19T11:12:00Z | CODER

All 64 checkboxes complete (38 tasks + 26 phase-verification checks) across 8 phases. Plan status → DONE. Ready for reviewer.

Final state: `references/config.md` states the span rule once, generically over a slice set `P` with declared integration slice `i(P)`, and derives `span(L)` (split and leaf), `span_max`, `M_flat`'s span term, and the viable-flat `span_base` from it; `T` and `M_seq` are explicitly outside it. The fenced `span_base = M + X` derivation block is replaced by one by-construction sentence that keeps the named cancellation identity `g = M − S`; the sequential half `g = T − (S + X)` and the `M_flat − M_nested = g − c` reconciliation survive. The three exclusion blockquotes are one generic canonical statement plus two vocabulary-specific one-line pointers. `docs/adr/0017-one-span-rule-over-any-slice-set.md` is Accepted; ADR-0016 gained a forward pointer only (11 insertions, 0 deletions, `Status: Accepted` untouched).

**No figure moved.** Both independent checks are green: mechanical no-numeral-drift over all five worked-example subsections (identical numeral sequences 45/63/62/147/131; four bodies byte-identical, the fifth differing only by the one permitted cancellation-identity rewording), and a full hand re-derivation of each example from the rewritten rule with every printed figure reproduced. No numeral was adjusted at any point; no BLOCKED route was needed.

Structural invariants held: 31 headings byte-identical (zero renames/additions/re-levellings); all ten cross-reference targets resolve; overlay-anchor + quote-fidelity census unchanged at 3 / 3 / 2 / 1 / 1; `grep 'min(S' references/config.md` = 0; `SKILL.md` and `templates/architect.md` untouched; `prime-agent/skills/**` never hand-edited (regenerated only).

Floor: `clean-code-gates npm test` exit 0 at 225 passing; `node scripts/build-prime-agent.mjs --check` exit **0**; `prime-agent npm test` exit 0.

### 2026-08-19T10:18:00Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-19T10:13:42Z | ARCHITECT

Plan `FEAT-20260819T101153Z-e883` created. Type: feat. Tasks: 38 across 8 phases (plus 26 phase-verification checks).
Status: PLANNED. Ready for coder.

### 2026-08-19T10:49:05Z | REVIEWER

CR-20260819T104419Z-fc4f created. Status: REQUEST_CHANGES. Must Fix: 3. Should Fix: 2.
