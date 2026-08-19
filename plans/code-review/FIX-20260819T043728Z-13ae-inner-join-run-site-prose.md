---
id: FIX-20260819T043728Z-13ae
title: Correct the surviving inner-join run-site prose and fold back the corrected counterfactual
type: fix
status: DONE
created_at: 2026-08-19T04:40:21Z
updated_at: 2026-08-19T05:24:00Z
cycle: 0
related_to: CR-20260819T043042Z-a7b9, FEAT-20260819T035826Z-835a, SPEC-20260819T034803Z-18d2, TEST-20260819T042313Z-1acb, docs/adr/0013-overlapped-inner-joins.md
---

**Related:** [CR-20260819T043042Z-a7b9](./CR-20260819T043042Z-a7b9-adopt-overlapped-inner-joins.md) · [FEAT-20260819T035826Z-835a](../feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md) · [SPEC-20260819T034803Z-18d2](../specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md) · [TEST-20260819T042313Z-1acb](../test/TEST-20260819T042313Z-1acb-adopt-overlapped-inner-joins.md)

## Overview

Resolve `CR-20260819T043042Z-a7b9` (REQUEST_CHANGES) against `FEAT-20260819T035826Z-835a`. The ADR-0013 adoption moved every deferred gate's **run site** to Step 3j item 4, but three prose sites in the `orchestrator` skill still name the **inner join** as a place a deferred gate *runs* — `SKILL.md`'s lane preamble (MF-1, the blocker), `references/config.md`'s per-sub-lane viability condition 4 (SF-1), and `templates/coder.md`'s explanatory clauses around an otherwise-correct instruction (SF-2). All three are corrected in one phase because all three regenerate the same `prime-agent/skills/**` tree. SF-3 is ruled **in scope** (see Technical Notes) and pins the run order of the de-duplicated deferred-gate set at Step 3j item 4. SF-4 folds the corrected `k = 2` counterfactual (**19**, not 20) back into spec FR-16 and the FEAT plan's Phase-2 task text.

The unifying defect is one shape repeated three times: **deferral has two hops now — record at the nearest enclosing join, run at the outer join — and every site that mentions deferral collapsed them into one.** The fix is not to delete the sentences; the deferral-moves-outward-never-drops guarantee they encode is still real and still worth stating. It is to make each site name the recording hop and the run site separately.

This is a **docs-only** change to a markdown skill plus one generator run. No executable path exists: `parallelism` resolves to `off` in this repo and a `full` run with `k ≥ 2` is unreachable here, so verification is structural (a red-then-green grep assertion set), arithmetic (hand re-derivation for SF-4), and the builder's drift guard plus two existing suites as no-regression floors.

## Acceptance Criteria

1. **MF-1 — `SKILL.md` lane preamble (currently L958).** The paragraph beginning *"Path-scoped gates defer to the nearest enclosing join"* no longer names the inner join as a place a deferred gate **runs**. It names the nearest enclosing join as where the deferral is **recorded**, and Step 3j item 4 as the single site where every deferred gate **runs**, citing Step 3s item 3 and ADR-0013.
2. **MF-1 — the vacuous clause is deleted, not softened.** The literal string `when its own inner join can run it` does not occur anywhere in `SKILL.md`. There is no longer any case it selects, so it is removed outright rather than hedged.
3. **MF-1 — the guarantee survives.** The rewritten paragraph still states, in its own words, that deferral only ever moves a gate **outward** to a wider scope and never drops one. Deleting the false half must not cost the true half.
4. **SF-1 — `references/config.md` viability condition 4** names both hops: the gate defers to the inner join, **which records it for the outer join** (`SKILL.md` → Step 3j item 4, the single run site; ADR-0013). The condition's own test — *can the gate be scoped to a sub-lane's paths* — is textually unchanged, because it was never wrong.
5. **SF-2 — `templates/coder.md`'s instruction is unchanged in substance.** The coder still: defers a gate with no path-scoped form to the nearest enclosing join, notes the deferral in `.progress.md`, and proceeds; deferring is still stated to be the correct outcome, not a failure. No action the coder takes changes.
6. **SF-2 — only the two false explanatory clauses change.** `that join runs it once over its own scope` is replaced by the true destination (deferred gates run once, at the outer join — Step 3j item 4), and the trailing sentence `A sub-lane never defers a gate past its own inner join when that join can run it.` is deleted.
7. **SF-2 — the scope amendment is explicit.** This plan records that the FEAT plan's out-of-scope entry *"No edit to `templates/*.md`"* is amended: its justification (*"the coder's defer-a-gate instruction is unchanged"*) is true of the instruction and false of the sentences around it, and the surrounding explanation is re-scoped **in**.
8. **SF-3 — Step 3j item 4 pins the run order** of the de-duplicated deferred-gate set: **lane-map row order of first deferral**, ties broken by the gate's command string — stated in one clause, in the same style Step 3s pins `SUBJOIN` emission order, and consistent with the step's existing "never analysis order and never completion order" convention.
9. **No literal `k × J` / `k×J`** is introduced in any edited file (`SKILL.md`, `references/config.md`, `templates/coder.md`, spec FR-16, the FEAT plan) — AC-1 of the parent plan still holds after these edits.
10. **Both near-miss exact-count overlay anchors are still exactly 3** in `SKILL.md`: `the call shape from *How to spawn a subagent*` = 3, `:(exclude).claude` = 3. `through a **single sequential coder invocation**` is still exactly 2.
11. **`prime-agent/skills/**` is regenerated, never hand-edited.** `git status --porcelain prime-agent/skills/` is empty before the build runs; the tree is produced by `node scripts/build-prime-agent.mjs`; `node scripts/build-prime-agent.mjs --check` then exits **0**.
12. **`cd prime-agent && npm test` exits 0** after regeneration.
13. **The FEAT plan's full Phase-2 assertion set re-runs green** on the edited source tree, with the one state-dependent row (`--check` exits non-zero) re-read per its own semantics — see Technical Notes.
14. **`cd plugins/my-skills/skills/clean-code-gates && node --test` still reports 213 passing / 0 failing**, run unchanged as a floor.
15. **SF-4 — spec FR-16 and the FEAT plan's Phase-2 task text state 19, not 20**, in both cases showing the expanded term-by-term form `span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)` = **19**, so the figure is self-checking. The phrasing that avoids the forbidden literal is preserved (`2 join passes`, never `2J` expanded into the banned form).
16. **SF-4 — the correction is logged where it will be found.** The spec records the correction in its own log region, naming this FIX plan and the CR, and stating that the qualitative role of the counterfactual is intact (19 > 18.5, so the historical rejection was still self-consistent).
17. **No worked-example figure in `references/config.md` changes.** The shipped `k = 2` example already carries 19; SF-4 moves the upstream artifacts to it, never the other way around.

## Out of Scope

- **No change to Step 3s item 3's substance.** Collect-and-record-only is correct and stays; only the sites that *describe* it elsewhere are corrected.
- **No change to Step 3j item 4's substance.** It gains one ordering clause (AC-8). Its de-duplication rule, its union scope, its blocking non-zero exit, its `PARTIAL` routing, and its `JOIN — deferred gate failed` block are untouched.
- **No change to the coder's action** (AC-5). This is the whole reason SF-2 is a warning and not a blocker; a fix that changed behaviour would exceed the finding.
- **No change to the cost model** — `A`, `J`, the `0.25` interface-point conversion, `M_flat`, `M_nested`, the viability conditions themselves, or any default value.
- **No change to any worked example's figures** (AC-17).
- **No ADR edit.** ADR-0013 is `Accepted` and records the hazards *that change* surfaced. SF-3 pins a step-level ordering rule; it reverses no decision ADR-0013 took and adds no new decision, so it belongs in the step, not in the record. If a future editor wants it in the hazard list, that is a separate, deliberate change.
- **No hand edit of `prime-agent/skills/**`** — it is generated; a hand edit is a bug the next build overwrites and `--check` flags.
- **No `.opencode` port.** `orchestrator` has no `.opencode/skills/orchestrator/` override, so opencode-port-parity does not apply (confirmed in the parent plan against `.opencode/skills/`).
- **No edit to `.orchestrator/**`.**
- **No edit to `.orchestrator/PROJECT-CONTEXT.md`.** The parent plan already surfaced the Out-of-scope carve-out for the builder as a human decision; it is not applied here either.
- **No behavioural or e2e test** — the changed path is unreachable in this repo (see Technical Notes). Inventing a test that cannot exist would be worse than naming the gap.
- **No new config key, no CLI arg, no artifact-schema change, no re-slice retry.**
- **No commit and no push** — the pipeline ends at READY_TO_COMMIT.

## Technical Notes

- **Ruling on SF-3 (the item the CR left to the architect).** **In scope, and not optional.** Three reasons. (a) It is a one-clause edit to `SKILL.md`, the same file MF-1 edits, so it rides the same `prime-agent` rebuild at zero marginal cost — deferring it buys a second full regenerate-and-re-verify cycle for one sentence. (b) The CR's diagnosis is right that *this change enlarged the seam*: before ADR-0013, item 4 handled only the leftovers an inner join could not run; now every deferred gate in the run routes through it, and gates are arbitrary project commands, some of which mutate the workspace. (c) Leaving it open is worst precisely here — the same change strengthened the step's determinism posture, so an unpinned order sits directly beside a paragraph arguing that observable order is pinned. Pin it in the style already established two sections up, and the parallel path has no order-dependent surface left.
- **Deviation from the default Should-Fix treatment, stated deliberately.** The architect's standing rule makes every Should Fix an `(optional)` task pair. Here SF-1, SF-2 and SF-4 are mandatory by orchestrator direction, and SF-3 is mandatory by the ruling above. Nothing in this plan is optional; a phase that lands three of the four repeats the exact class of defect the CR found — a file where one site tells the truth and its neighbour does not.
- **Why MF-1, SF-1, SF-2 and SF-3 are one phase.** All four are the same defect at four sites, and three of the four files are inputs to `scripts/build-prime-agent.mjs`. Splitting them leaves the generated tree stale across a phase boundary and produces a transient state where `SKILL.md` names the run site correctly and `templates/coder.md` still contradicts it — which is the CR's finding, reintroduced. Do not "helpfully" re-order Phase 2 into sub-phases.
- **`templates/coder.md` is a build input.** `prime-agent/skills/orchestrator/templates/coder.md` exists in the generated tree, so SF-2 makes the expected drift set **three** files, not two: `SKILL.md`, `references/config.md`, `templates/coder.md`. Phase 2's `--check` assertion must expect exactly those three and no other drift line.
- **Overlay anchors are safe but must be proven, not assumed.** `prime-agent/overlays/orchestrator.json` has no `find` anchor targeting any text this change rewrites (its anchors are the bootstrap/spawn/skill-resolution regions and the two near-miss strings). The two exact-count anchors — `the call shape from *How to spawn a subagent*` (3) and `:(exclude).claude` (3) — are untouched by all four edits, and Step 3s's *"through a **single sequential coder invocation**"* phrasing (2 occurrences) must not be rewritten to reference the shared call shape, which would take the first count to 4 and hard-fail `--check`. Phase 2 verifies all three counts rather than assuming them.
- **The FEAT plan's assertion set: 26 rows as written, one of them state-dependent.** The orchestrator's brief cites 19; the checklist under that plan's `### Phase 2 verification` actually carries **26** rows (21 grep assertions over `$SK`/`$CFG`, 2 exact-count anchor rows, 1 hand-re-derivation row, and the 2 command rows). This plan re-runs **all 26**, with one re-reading: row *"`node scripts/build-prime-agent.mjs --check` exits **non-zero** … the expected, bounded blast radius before Phase 3 regenerates"* is a mid-phase assertion about a stale tree, not a steady-state property. Here it holds at the end of **this** plan's Phase 2 (with the three-file drift set of the note above) and is superseded by AC-11's `--check` **exit 0** after this plan's Phase 3. Assert it in that order; do not treat the two as contradictory.
- **No test can exercise the changed path.** `parallelism` resolves to `off` by default and this repo's own orchestrator runs are sequential, so a `full` run with `k ≥ 2` is unreachable here. Verification is the red-then-green assertion set, hand arithmetic for SF-4, the builder's drift guard, and the two existing suites as no-regression floors. **This is the honest posture, not a gap to be filled later** — the same posture the parent plan and the tester's report both took.
- **`clean-code-gates` is a floor, not a gate applied to this diff.** PROJECT-CONTEXT forbids running it *against* non-JS doc skills; here its own suite runs unchanged, purely to prove this markdown change regressed nothing.
- **Single-source-of-truth references.** The normative deferral rule lives in `SKILL.md` (Steps 3s/3j); `references/config.md` condition 4 and `templates/coder.md` **cite** it and must not restate it as a second rule. Both fixes are therefore citations pointing at Step 3j item 4, not parallel formulations — which is also what keeps them from drifting again.
- **Mirror machinery.** SF-3's clause reuses Step 3s's established `SUBJOIN` phrasing (*lane-map row order … never analysis order and never completion order*) rather than inventing a new ordering vocabulary.
- **SF-4 touches `plans/` only.** Spec FR-16 and the FEAT plan are pipeline artifacts, not shipped skill content, so Phase 4 triggers no rebuild and no gate beyond arithmetic and the forbidden-literal check. The parent plan is `status: DONE`; the SF-4 edit corrects a figure inside an already-checked task's text and must **not** flip any checkbox or status.
- **Backward compatibility (project invariant).** No config key, default, or artifact-schema change. `off` and `lanes` runs are byte-identically unaffected — Step 3s does not exist for them and the coder's action is unchanged.
- **Complexity gate (per-method cyclomatic ≤ 10) is not applicable**: no service, handler, use-case, or dispatcher class is introduced. This is a markdown change plus one generator run.

## Tasks

> Tasks are ordered TDD-first: the structural assertion set is proven **red** in Phase 1 before any edit lands in Phase 2.
> The coder checks off `[ ] → [x]` as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase.
> **Phase 2 is deliberately one phase.** All four prose sites land together (see Technical Notes). Do not split it.

### Phase 1 — Red baseline and anchor census (no source edits)

- [x] Record the current text of all four target sites verbatim in `.progress.md`: `SKILL.md` lane-preamble paragraph (the one containing `the **inner** join for a sub-lane`, currently L958), `references/config.md` viability condition 4 (currently L437), `templates/coder.md`'s defer paragraph (currently L153), and `SKILL.md` Step 3j item 4's opening
- [x] Run the full Phase 2 assertion set (see `### Phase 2 verification`) against the current tree and record, assertion by assertion, which fail and which already hold — the red baseline
- [x] Confirm the red set is non-empty and that **every** assertion whose subject this change rewrites is currently failing; if any such assertion already passes, stop and report it rather than proceeding (it means the target text is not where the CR says it is)
- [x] Census the three exact-count anchors before any edit and record the numbers: `the call shape from *How to spawn a subagent*` (expect 3), `:(exclude).claude` (expect 3), `through a **single sequential coder invocation**` (expect 2)
- [x] Confirm `git status --porcelain prime-agent/skills/` is empty and `node scripts/build-prime-agent.mjs --check` exits 0 — the clean starting point the CR verified
- [x] Run the Phase 1 verification checklist and confirm every command exits as stated

### Phase 1 verification

- [x] `node scripts/build-prime-agent.mjs --check` exits 0 (clean baseline)
- [x] `git status --porcelain prime-agent/skills/` is empty
- [x] The three anchor counts are 3 / 3 / 2
- [x] The red assertion log is written to `.progress.md` with one line per assertion
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0 with 213 passing (floor, recorded once here)

### Phase 2 — The four prose corrections, together

> Every task in this phase lands in one working state. The phase is not complete — and no task in it is checked — until all four sites are corrected and the whole assertion set is green.

- [x] **[MF-1]** Rewrite the `SKILL.md` lane-preamble paragraph (currently L958) so the **recording** hop and the **run** site are named separately: a gate with no path-scoped form defers to the nearest enclosing join — the inner join for a sub-lane, the outer join for an unsplit lane — **which is where the deferral is recorded**; a sub-lane's inner join records it and passes it outward; **every deferred gate runs at the outer join** (Step 3j item 4), the first point at which nothing else is in flight (Step 3s item 3; ADR-0013) [AC-1]
- [x] **[MF-1]** Delete the clause `when its own inner join can run it` outright — no softened variant, no hedge — and verify the literal string no longer occurs in `SKILL.md` [AC-2]
- [x] **[MF-1]** Confirm the rewritten paragraph still states the deferral-moves-outward-never-drops guarantee in its own words; if the rewrite dropped it, restore it before proceeding [AC-3]
- [x] **[SF-1]** Extend `references/config.md` viability condition 4 to name the second hop: `— otherwise that gate defers to the inner join, which records it for the outer join` plus the citation to `SKILL.md` → Step 3j item 4 as the single run site and ADR-0013. Leave the condition's own test (*can be scoped to a sub-lane's paths*) textually unchanged [AC-4]
- [x] **[SF-2]** Record the scope amendment in `.progress.md` before editing `templates/coder.md`: the FEAT plan's out-of-scope entry *"No edit to `templates/*.md`"* is amended by this plan, because its justification covers the instruction and not the explanation around it [AC-7]
- [x] **[SF-2]** In `templates/coder.md` (currently L153), replace `that join runs it once over its own scope` with the true destination — deferred gates run once, at the **outer** join (Step 3j item 4) — keeping *"Note the deferral in `.progress.md` and proceed"* and *"Deferring is the correct outcome here, not a failure"* intact [AC-5, AC-6]
- [x] **[SF-2]** Delete the trailing sentence `A sub-lane never defers a gate past its own inner join when that join can run it.` from `templates/coder.md`, and confirm no instruction the coder follows changed — only the explanation [AC-5, AC-6]
- [x] **[SF-3]** Add one clause to `SKILL.md` Step 3j item 4 pinning the run order of the de-duplicated set: **lane-map row order of first deferral**, ties broken by the gate's command string — phrased in the same style Step 3s pins `SUBJOIN` emission (never analysis order, never completion order), and placed so item 4's de-duplication rule and union scope read unchanged [AC-8]
- [x] Re-read all four edited passages against Step 3s item 3 and Step 3j item 4 and confirm no site now states a rule the other two contradict — the check that would have caught the original defect [AC-1, AC-4, AC-6, AC-8]
- [x] Confirm no edit introduced the literal `k × J` / `k×J` in any of the three source files [AC-9]
- [x] Run the Phase 2 verification checklist and confirm every assertion and every command exits as stated

### Phase 2 verification

Assertion set — run with `SK=plugins/my-skills/skills/orchestrator/SKILL.md`, `CFG=plugins/my-skills/skills/orchestrator/references/config.md`, `CODER=plugins/my-skills/skills/orchestrator/templates/coder.md`. Every one of these must be proven red in Phase 1 first (except the anchor-count and floor rows, which are green-throughout invariants).

- [x] `! grep -qF 'when its own inner join can run it' "$SK"` — the vacuous clause is gone from the preamble [AC-2]
- [x] The lane-preamble line matching `the **inner** join for a sub-lane` in `$SK` also contains `record` **and** `Step 3j item 4` — the recording hop and the run site are named separately [AC-1]
- [x] That same paragraph matches a never-drops phrasing (e.g. `never drops`) — the guarantee survived the deletion [AC-3]
- [x] `grep -qF 'ADR-0013' "$SK"` still holds and the citation appears in the rewritten preamble paragraph [AC-1]
- [x] The `$CFG` line carrying `scoped to a sub-lane's paths` also contains `records it for the outer join` **and** `Step 3j item 4` [AC-4]
- [x] `grep -qF "ADR-0013" "$CFG"` holds on that condition's line [AC-4]
- [x] `! grep -qF 'that join runs it once over its own scope' "$CODER"` — the false explanatory clause is gone [AC-6]
- [x] `! grep -qF 'when that join can run it' "$CODER"` — the trailing sentence is gone [AC-6]
- [x] ``grep -qF 'Note the deferral in `.progress.md` and proceed' "$CODER"`` — the coder's action survives verbatim [AC-5]
- [x] `grep -qF 'Deferring is the correct outcome here, not a failure' "$CODER"` — unchanged [AC-5]
- [x] `grep -qF 'Step 3j item 4' "$CODER"` — the template names the real run site [AC-6]
- [x] `grep -qF 'lane-map row order of first deferral' "$SK"` — Step 3j item 4's run order is pinned [AC-8]
- [x] The Step 3j item 4 paragraph still matches `de-duplicates them across the whole run` and `lane(s) that deferred` — the ordering clause was added, nothing was displaced [AC-8, out-of-scope guard]
- [x] `! grep -qF "Run every gate this lane's sub-lanes deferred" "$SK"` — Step 3s still runs no deferred gates (parent-plan invariant, must not regress)
- [x] `! grep -qE 'k × J|k×J' "$SK" "$CFG" "$CODER"` — no literal reintroduced [AC-9]
- [x] `[ "$(grep -cF 'the call shape from *How to spawn a subagent*' "$SK")" -eq 3 ]` [AC-10]
- [x] `[ "$(grep -cF ':(exclude).claude' "$SK")" -eq 3 ]` [AC-10]
- [x] `[ "$(grep -cF 'through a **single sequential coder invocation**' "$SK")" -eq 2 ]` [AC-10]
- [x] `node scripts/build-prime-agent.mjs --check` exits **non-zero**, reporting exactly `prime-agent/skills/orchestrator/SKILL.md`, `prime-agent/skills/orchestrator/references/config.md`, and `prime-agent/skills/orchestrator/templates/coder.md` as stale and **no other drift line** — the expected, bounded blast radius before Phase 3 regenerates
- [x] `git status --porcelain prime-agent/skills/` is still empty — nothing under the generated tree was hand-edited [AC-11]
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0 with 213 passing [AC-14]

### Phase 3 — Regenerate the Prime Agent distribution and re-prove the parent plan's set

- [x] Confirm again that no file under `prime-agent/skills/**` was hand-edited during Phase 2 (`git status --porcelain prime-agent/skills/` is empty before the build runs) [AC-11]
- [x] Run `node scripts/build-prime-agent.mjs` to regenerate the tree [AC-11]
- [x] Confirm the regenerated diff under `prime-agent/skills/` is confined to the three orchestrator files the source edits touch, and that each generated file's changed hunks correspond to the source hunks (overlay application did not rewrite anything else) [AC-11]
- [x] Re-run the FEAT plan's **full** Phase-2 assertion set (all 26 rows) against the edited source tree and record the result row by row, re-reading the `--check`-exits-non-zero row per this plan's Technical Notes (it held at the end of Phase 2; after this phase's regeneration the governing assertion is `--check` exit **0**) [AC-13]
- [x] Run the Phase 3 verification checklist and confirm every command exits as stated

### Phase 3 verification

- [x] `node scripts/build-prime-agent.mjs --check` exits **0** [AC-11]
- [x] `cd prime-agent && npm test` exits 0 [AC-12]
- [x] The three exact-count anchors in the **generated** `prime-agent/skills/orchestrator/SKILL.md` are consistent with the build (no exact-count overlay error was raised) [AC-10]
- [x] All 26 rows of the FEAT plan's Phase-2 assertion set are green on the source tree, with the one state-dependent row re-read as documented [AC-13]
- [x] Every Phase 2 assertion row above still holds after regeneration [AC-1 – AC-10]
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0 with 213 passing [AC-14]

### Phase 4 — Fold the corrected counterfactual back upstream (SF-4, docs-only)

- [x] Re-derive the counterfactual by hand and record the working in `.progress.md`: `span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)` = **19** [AC-15]
- [x] Confirm `references/config.md`'s shipped `k = 2` worked example already states **19** and that this phase changes no figure in it [AC-17]
- [x] Correct spec FR-16 (`plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md`): `20` → `19`, showing the expanded term-by-term form so the figure is self-checking, and preserving the phrasing that avoids the forbidden literal (`2 join passes`, never the banned expansion) [AC-15, AC-9]
- [x] Confirm the corrected FR-16 sentence still carries its qualitative point intact — 19 > 18.5, so the historical rejection under the superseded charge was still self-consistent — and that no other FR-16 figure or reconciliation moves [AC-16, AC-17]
- [x] Correct the FEAT plan's Phase-2 task text (`plans/feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md`, the task reading *"…would have been 20, worse than 18.5"*): `20` → `19` with the same expanded form, **without** altering that task's `[x]` state, the plan's `status: DONE`, or any other row [AC-15]
- [x] Add a correction note to the spec's own log region naming this FIX plan (`FIX-20260819T043728Z-13ae`) and the CR (`CR-20260819T043042Z-a7b9`), stating that the shipped example was always 19 and that the spec's arithmetic slip was in the stated total, not in the expression [AC-16]
- [x] Run the Phase 4 verification checklist and confirm every command exits as stated

### Phase 4 verification

- [x] `! grep -qE 'k × J|k×J' plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md plans/feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md` — no forbidden literal introduced by the fold-back [AC-9]
- [x] `! grep -qF 'would have been `8 + (A + A + 2J + J + I)` = **20**' plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md` and no `**20**` remains as the counterfactual total in either artifact [AC-15]
- [x] Both artifacts state **19** with the expanded term-by-term form [AC-15]
- [x] `grep -qF 'FIX-20260819T043728Z-13ae' plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md` — the correction is logged and traceable [AC-16]
- [x] `git diff --stat plans/feat/` shows only the counterfactual figure changed in the FEAT plan — no checkbox, no `status:`, no other line [AC-15]
- [x] `node scripts/build-prime-agent.mjs --check` still exits 0 (nothing under `plugins/` or `prime-agent/` moved in this phase) [AC-11]
- [x] Full Phase 2 assertion set re-run and still green [AC-1 – AC-10]
- [x] `cd prime-agent && npm test` exits 0 and `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0 with 213 passing [AC-12, AC-14]

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands
> that apply to that phase's touched paths and asserts each exits 0 — with the one
> documented exception of Phase 2's deliberately-non-zero `--check`, which asserts a
> bounded three-file drift set.
> A failure routes through the coder's BLOCKED step, not a silent rewrite.

`PROJECT-CONTEXT.md` → **Commands** declares no build, no lint, and no automated test for markdown doc skills — verification for those is structural review. That section predates the Prime Agent distribution (`e2e635f`), after which `scripts/build-prime-agent.mjs` became the mandatory, only-sanctioned way to update `prime-agent/skills/**`. The applicable gate commands therefore come from the generated-tree contract plus the two existing suites used as no-regression floors:

| Gate | Command | Path condition |
| --- | --- | --- |
| Builder drift guard | `node scripts/build-prime-agent.mjs --check` | any change under `plugins/my-skills/skills/**` or `prime-agent/**` |
| Prime distribution suite | `cd prime-agent && npm test` | any change under `prime-agent/**` (including a regeneration) |
| Structural assertion set | the Phase-2 assertion rows above | any change to `orchestrator/SKILL.md`, `references/config.md`, or `templates/coder.md` |
| Parent-plan regression set | the FEAT plan's full Phase-2 assertion set (26 rows) | any change to `orchestrator/SKILL.md` or `references/config.md` |
| Exact-count overlay anchors | the three `grep -c` rows (3 / 3 / 2) | any change to `orchestrator/SKILL.md` |
| Counterfactual re-derivation | hand arithmetic against the shipped `k = 2` worked example | any change to spec FR-16 or the FEAT plan's counterfactual text |
| No-regression floor | `cd plugins/my-skills/skills/clean-code-gates && node --test` (213 passing) | every phase — run unchanged, purely as a floor |

**Explicitly not run, and why:** no behavioural or e2e test exists or can be written. `parallelism` resolves to `off` by default, this repo's own orchestrator runs are sequential, and a `full` run with `k ≥ 2` is unreachable here — so no run in this repository exercises the changed path. Coverage is N/A and advisory, per the tester's documented posture for doc-skill changes. The `clean-code-gates` suite is **not** applied to the edited markdown (PROJECT-CONTEXT forbids that); it is executed unchanged as a regression floor only.

Phase exit criterion: every applicable row above passes on the changed set, plus that phase's own `### Phase N verification` checklist. No silent rewrite of skill text to make an assertion pass without a corresponding plan task.

G1 (coverage) and G6 (mutation) are NOT gates here — they remain QA-only, and both are N/A for a markdown change.

## Dependencies

- `FEAT-20260819T035826Z-835a` — DONE. This plan edits its output and folds a correction back into its task text.
- `CR-20260819T043042Z-a7b9` — the source review. No other plan blocks this one.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T05:01:33Z | REVIEWER

CR-20260819T045602Z-221d created. Status: APPROVED. Must Fix: 0. Should Fix: 3.

### 2026-08-19T05:24:00Z | CODER

All 29 work tasks complete across 4 phases (plus all 40 verification rows; 0 unchecked). Plan status → DONE. Ready for reviewer.
All 17 ACs satisfied. Three verification rows re-read (not silently passed), each with a stronger substitute check recorded in `.progress.md`: `prime-agent/skills/` porcelain-empty (parent plan's uncommitted regeneration — replaced by `--check` exit 0 + a tree-content hash), the absolute `k × J` grep over `plans/` (those documents are *about* that literal — replaced by a delta test, 15/15 lines unchanged), and `git diff --stat plans/feat/` (the FEAT plan is untracked — replaced by a reconstruction diff proving exactly one line changed, checkbox and status untouched). No source was rewritten to make an assertion pass.

### 2026-08-19T04:46:10Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-19T04:40:21Z | ARCHITECT

Plan `FIX-20260819T043728Z-13ae` created. Type: fix. Tasks: 29 work tasks across 4 phases (plus 40 verification checklist rows).
Source CR: `CR-20260819T043042Z-a7b9` (1 Must Fix, 4 Should Fix).
Scope decisions: MF-1, SF-1, SF-2, SF-3 bundled into one phase (Phase 2) so `prime-agent/skills/**` regenerates once; SF-3 ruled **in scope and non-optional** (rationale in Technical Notes); SF-4 in Phase 4 as a docs-only upstream fold-back. Explicit scope amendment recorded: the FEAT plan's out-of-scope entry *"No edit to `templates/*.md`"* is re-scoped **in** for the explanatory prose only — the coder's action is unchanged.
Discrepancy surfaced: the orchestrator's brief cites 19 assertion rows in the FEAT plan's Phase-2 set; the checklist as written carries 26, one of which is state-dependent. All 26 are re-run in Phase 3, with that row re-read per its documented semantics.
Status: PLANNED. Ready for coder.

### 2026-08-19T05:04:19Z | QA

QA-20260819T050419Z-cfd2 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
