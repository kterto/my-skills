---
id: FIX-20260819T105159Z-3cd7
title: Correct three stale span-rule assertions (CR-20260819T104419Z-fc4f)
type: fix
status: DONE
created_at: 2026-08-19T10:51:59Z
updated_at: 2026-08-19T12:18:44Z
cycle: 0
related_to: CR-20260819T104419Z-fc4f, FEAT-20260819T101153Z-e883, SPEC-20260819T100451Z-01da, TEST-20260819T103448Z-5a36
---

**Related:** [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md) · [CR-20260819T104419Z-fc4f](./CR-20260819T104419Z-fc4f-one-span-rule-slice-set.md) · [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md) · [TEST-20260819T103448Z-5a36](../test/TEST-20260819T103448Z-5a36-one-span-rule-slice-set.md)

## Overview

`CR-20260819T104419Z-fc4f` returned REQUEST_CHANGES on `FEAT-20260819T101153Z-e883` with three Must Fix findings, all text-only. Two normative sites in `references/config.md` (`:309`, `:316`) still state the **pre-ADR-0016** span formulas — the same expressions that document's own worked example 5 names at `:459` as "the uncorrected model" — so cross-reading the now-canonical `span_base` at `:259` with the stale post-split term at `:309` yields `g` = 12 on example 5 against a true 8, overstating the gain by exactly `X`. The `SKILL.md` Step 2p.2 **nested** print block carries the same stale shape at `:534`, exempted by the parent plan on an ADR-0016 §5 reading that §5's own heading (*"Step 2p.2's **flat** print block divides by `span_base`"*) does not support, and it has no slot filling that is both self-consistent and correct when `X > 0`. And the change's own new claim — `config.md:234`'s "one-site edit" and ADR-0017's "there is no longer a set of statements that must be moved in agreement" — is false in the shipped tree, which is the only defect this change **introduced**.

This plan corrects all three by text. It is still a **reframing, not a repricing**: no figure moves. `:439` and `:447` already print the corrected 24 and 16, so MF-1 requires no arithmetic change; MF-3 makes the nested block's decomposition equal its own already-correct result. The claim in MF-2 is **scoped, not deleted** — the underlying achievement (one normative statement of the arithmetic) is real and stays stated.

Because these edits touch the very prose the five worked examples are checked against, the parent plan's two independent no-figure-moved checks do not carry over and are re-run in full: a mechanical no-numeral-drift diff over all five worked examples **and** a complete hand re-derivation of each. `SKILL.md` is modified for the first time in this work stream (MF-3), so the overlay-anchor + quote-fidelity census becomes load-bearing rather than precautionary.

## Acceptance Criteria

1. **`config.md:316` no longer re-expands `span_base`.** The clause "which is `max` over lanes of `tasks(L)` under a viable flat verdict and `T` under a non-viable one" is replaced by a **by-name** reference to `span_base` as defined in *The makespan model* → *The baseline* — the span rule over the run's lane set with every lane unsplit under a viable flat verdict, `T` under a non-viable one. No `max`-plus-`tasks(…)` re-expansion of a run-level span quantity survives at this site.
2. **`config.md:309`'s fenced post-split formula carries the serial remainder**, i.e. it is the span rule applied to the post-adoption lane set (`max(second_largest_span, span(L after the split)) + tasks(i(run))`), followed by a clause stating that `tasks(i(run))` is a run constant and therefore cancels in `g` — which is what makes the shorter form correct as a *delta* and wrong as a *span*.
3. **`config.md:314`'s sub-lane micro-example is byte-identical.** `max(10, 5 + 6)` = 11 is at the sub-lane level and is already correct; it is not touched.
4. **The cross-read derivation is fixed.** Taking `span_base` from *The baseline* and the post-split term from *Marginal-gain rule* — the realistic pairing, and the one `SKILL.md:512` steers a reader into — yields `g` = **8** on worked example 5, not 12. Recorded as an explicit before (12) / after (8) derivation.
5. **`SKILL.md:534`'s nested `span_max` line carries `+ integration({n})`**, mirroring the `integration({n})` idiom already used at `:505` and `:533`, so its decomposition equals its own stated result and matches the flat block's treatment of the same term.
6. **The nested block has a self-consistent, correct filling on worked example 5**: `span_max = max(second-largest span 12, span(backend) 8) + integration(4) = 16`, and the following line renders `g = 24 − 16 = 8`. Recorded as a filled-slot walkthrough.
7. **`SKILL.md:546`'s prose is extended by one clause** noting that the run-level term carries the top-level integration lane after the `max`, as `span_base` does — **pointing at** `references/config.md` → *The makespan model*, restating no rule. Its existing `span(L)` vs `span_max` distinction and its 16 → `{5, 5}` + integration 6 micro-example survive unchanged.
8. **Every other line of Step 2p.2 is byte-identical**, in particular the flat print block (`Estimated speedup:`, `Integration lane:`, `Fixed overhead:`, `Interface points to freeze:`) which ADR-0016 §5 genuinely does cover, the `span({lane})` line at `:533`, the `g` / `c` / `{adopted | rejected}` lines, and the `c` cost table below.
9. **`config.md:234`'s claim is scoped, not deleted.** It bounds the achievement to the **normative arithmetic** ("a one-site edit of the normative arithmetic … four separately-maintained *normative* statements"), and names the Step 2p.2 print blocks as the recorded display exception (ADR-0016 §5) and the only other place the shape appears.
10. **ADR-0017's Consequence is corrected.** "There is no longer a set of statements that must be moved in agreement" is replaced by the bounded form, naming the display sites as the recorded exception and stating explicitly that MF-3 was **fixed rather than exempted**, and that ADR-0016 §5 covers the **flat** block only.
11. **ADR-0017's `Skills affected` line is corrected.** It no longer asserts `SKILL.md` is "unamended — both point at the arithmetic rather than restating it". It records the one amended `SKILL.md` site (`:534` + the `:546` clause), why it was amended (it restated the arithmetic, and in its superseded form), and that `templates/architect.md` remains genuinely unamended.
12. **ADR-0017's *What stands* entry for the Step 2p.2 print-block template strings is corrected** to record that the byte-for-byte guarantee holds for the **flat** block, and that the nested block's `span_max` line was corrected because §5 does not reach it.
13. **ADR-0016 needs no amendment and receives none.** §5's heading already scopes it to the flat block; the defect was in the citing documents, not the cited text. ADR-0016 stays `Accepted` and its diff against HEAD stays a pure append (11 +, 0 −).
14. **No figure moves anywhere.** Every numeral in all five worked-example subsections (`:338`, `:354`, `:374`, `:394`, `:431`) is identical pre- and post-edit, under one stated extraction convention, and every one of the five re-derives by hand from the corrected text.
15. **`grep 'min(S' references/config.md` returns 0.** No new `min(S, X)` claim is introduced — that would be new normative content, not a correction. It stays in ADR-0016.
16. **No heading is renamed, removed, added, or re-levelled** in `references/config.md` or in `SKILL.md`'s Step 2p region. Cross-references resolve by title; the pre-edit heading inventory is byte-identical post-edit.
17. **The ten cross-reference targets named in the parent plan still resolve**, plus any reference introduced by this plan's own by-name rewrites (`:316` → *The baseline*; `:546` → *The makespan model*).
18. **Anchor + quote-fidelity census holds at 3 / 3 / 2 / 1 / 1**, by exact string count: `':(exclude).claude'` = 3 in `SKILL.md`; `the call shape from *How to spawn a subagent*` = 3 in `SKILL.md`; `through a **single sequential coder invocation**` = 2 in `SKILL.md`; its unbolded quotation = 1 in `references/config.md`, still matching the `SKILL.md` wording it cites; exactly 1 overlay `find` string from `prime-agent/overlays/orchestrator.json` occurring in `references/config.md`. Re-run **after** the `SKILL.md` edit and again after regeneration.
19. **ADR-0012, ADR-0013, ADR-0014 and `templates/architect.md` are unamended** — `md5` identical to their pre-edit values.
20. **Distribution regenerated, never hand-edited.** `prime-agent/skills/**` is produced only by `node scripts/build-prime-agent.mjs`; `node scripts/build-prime-agent.mjs --check` exits 0 afterwards.
21. **No-regression floor holds**: `clean-code-gates` 225 passing / 0 failing, `node scripts/build-prime-agent.mjs --check` exit 0, `cd prime-agent && npm test` exit 0.
22. **SF-1 ruling is recorded** in the Progress Log — deferred, with the load-bearing content a wholesale merge would destroy enumerated by name.
23. **SF-2 is recorded as a convention, not a correction.** A **new** dated entry is appended to the parent FEAT plan's `.progress.md` stating the numeral-count extraction convention; lines `:49` and `:122` are byte-identical and the diff is a pure append.
24. **No behavioural or executable test is emitted, and the plan says so.** `parallelism` defaults to `off` in this repository and the `full` level with `k >= 2` is unreachable here, so no path executes the span rule. Verification is structural and arithmetic.

## Out of Scope

- **Any repricing.** No change to `M_flat`, `M_nested`, `M_seq`, `T`, `g`, `c`, `span_base`, `span_max`, `A`, `J`, the `0.25` interface-point conversion, the `70%` threshold, the aggregate `I > T` guard, or the `max_parallel_lanes` ceiling. Moving any numeral means the work was mis-scoped.
- **Adding a `min(S, X)` claim to `config.md`.** It lives in ADR-0016 (`:141`, `:144`, `:183`) and stays there.
- **Amending ADR-0016.** §5's heading is already correct; the citing documents were wrong. ADR-0016 stays `Accepted` and append-only, and this plan appends nothing to it.
- **Amending ADR-0012, ADR-0013, or ADR-0014.**
- **Changing `templates/architect.md`** — it names `span_base` / `span_max` / `span(L)` referentially and restates no formula. Genuinely unamended, and stays so.
- **Changing the Step 2p.2 *flat* print block.** ADR-0016 §5 covers it by name and by heading; its expanded on-screen form is a real, recorded legibility decision. Only the **nested** block's `span_max` line and `:546`'s prose are in scope, because §5 does not reach them.
- **Rewriting the parent FEAT plan's Out of Scope bullet or its Progress Log entries.** That plan is DONE and already reviewed; the CR's AC table cites its text. The corrected §5 reading is recorded **here** (this plan's Out of Scope and Technical Notes) and in ADR-0017 — the durable homes — and a new append-only entry is added to the parent's `.progress.md`. Rewriting a reviewed artifact's body would break the audit trail the CR depends on.
- **Any heading rename, deletion, addition, or re-levelling.**
- **Hand-editing `prime-agent/skills/**`.** Generated by `rmSync` + full rewrite.
- **opencode port work.** `orchestrator` has no `.opencode/skills/orchestrator/` override port, so the `opencode-port-parity` invariant does not bind (only `pr-review-report` and `spec-driven-eval` have ports).
- **Any behavioural or executable test.** None is reachable — see Technical Notes.
- **Superseding ADR-0017 with an ADR-0018.** ADR-0017 is untracked (`?? docs/adr/0017-…`) work-in-flight from this same uncommitted cycle; its errors are corrected in place before it lands, not layered over.
- **Committing or pushing.** The pipeline ends at `READY_TO_COMMIT`.

## Technical Notes

- **ADR-0016 §5's heading is the whole argument.** It reads *"Step 2p.2's **flat** print block divides by `span_base`"* and its body covers only that block's four lines. It is silent on the nested block at `SKILL.md:526–542`. The parent plan's exemption cited a section that does not reach the site it exempted. Do not "fix" this by widening §5 — that would rewrite an Accepted ADR to match a mistake made downstream of it.
- **MF-3's `SKILL.md` edit is licensed by the parent plan's own AC-14**, which permits changing `SKILL.md` "only on a proven normative restatement". `:534` **is** a normative restatement — of the superseded pre-ADR-0016 form. The CR proves it. The edit satisfies AC-14 rather than violating it.
- **The nested block has no correct filling today, which is why a display-only reading fails.** `{span_base}` is populated from the flat block at `:505`, which **does** carry `+ integration({n})`; `{span_max}` at `:534` decomposes without it. On example 5 the model must either print `= 16` after a decomposition that yields 12, or print 12 and then render `g = 24 − 12 = 12` against a true 8. A pure display decision cannot produce a self-contradictory line; this is arithmetic leaking into the template.
- **`:546` is incomplete, not wrong.** Its micro-example declares no top-level integration lane (`i(run) = none`), so its stated numbers hold. It needs one added clause, not a rewrite, and its 16 → `{5, 5}` + integration 6 example must survive intact — it is the sub-lane-level illustration the `span(L)` vs `span_max` distinction rests on.
- **MF-1's two sites are only safe read together, and the realistic read is not together.** `SKILL.md:512` points a reader at *The baseline* for `span_base`; the *Marginal-gain rule* section is where the gain is defined, so the post-split term is taken from there. That pairing is the third row of the CR's table: `g` = 12 against a true 8. Both sites are corrected; correcting only one leaves a different cross-read broken.
- **`config.md:459` is the in-document proof.** *What this example is actually pinning* names `max(20, 4)` = 20 and `max(12, 4)` = 12 as the uncorrected model. `:316` and `:309` produce exactly those two numbers on exactly that lane set. That paragraph is not edited — it is the oracle MF-1 is checked against.
- **MF-2 is the only defect this change introduced**, and it is the most dangerous form: an Accepted ADR asserting the absence of the very condition currently causing MF-1 and MF-3, which a future editor will trust instead of re-auditing. Scope it; do not delete it. Even after MF-1 and MF-3 land, `SKILL.md:505` still legitimately re-expands the shape (ADR-0016 §5) and `config.md:314` / `SKILL.md:533` still re-expand it at the sub-lane level, so the unbounded claim can never become true.
- **`through a **single sequential coder invocation**` is NOT an overlay build anchor.** The orchestrator overlay contains no `find` string matching `sequential coder`, `span`, `integration`, or `makespan`. Its count constraint is **cross-document quote fidelity** — `config.md:243` quotes it unbolded and must keep matching the `SKILL.md` wording it cites. Do not plan a build-failure mitigation for it, and do not therefore skip the check, which the build also does not enforce.
- **Anchor risk is real this cycle, unlike the last.** The parent plan never modified `SKILL.md`; this one does. `applyReplacements` (`scripts/build-prime-agent.mjs:77`–`:81`) hard-fails the build on any occurrence-count drift, and the nearest anchors to the edit region are `SKILL.md:456`, `:458`, `:488` (Step 2p.1) — outside the 2p.2 print block, but close. Run the census immediately after the `SKILL.md` edit, not only at the end.
- **`config.md` carries exactly one overlay anchor** (the ADR-0001 link at `:86`), far outside the edit region.
- **The pre-edit oracle is the TDD analogue.** No test can be written, so the ordering discipline is: capture the expected outputs (numerals, anchor counts, heading inventory, cross-reference targets, floor results, file digests) **before** touching a line; state each Must Fix as a re-runnable assertion that currently **fails**; edit; assert it passes and the captured oracle still holds. Phase 0 exists for this and must not be skipped or reordered after the edits.
- **No executable path exists for this change, and none can be written.** `parallelism` defaults to `off` in this repo and the `full` level with `k >= 2` is unreachable here, so nothing would execute the span rule. This matches `PROJECT-CONTEXT.md` → *Test tooling* ("No automated test framework for doc-skill changes… verification is structural"). **Do not invent a behavioural test to satisfy a coverage habit** — the tester was right to report coverage inapplicable rather than below floor, and that reading stands for this plan too.
- **SF-2's fix must be an append, not an edit.** The `.progress.md` contract is append-only ("Agents append below. Never rewrite entries."). Restating the figures at `:49` / `:122` would rewrite entries. The CR itself prefers recording the convention, which is append-safe and makes the oracle reproducible rather than merely self-consistent. The AC-20 verdict needs no correction: it compared 147/147 and 131/131 under one convention, and an identical offset on both sides cancels.
- **SF-1 is ruled DEFER.** The CR is explicit that a wholesale merge deletes load-bearing content and "would be worse than leaving both". `:243` uniquely carries the exact unbolded Step 3s quotation (a quote-fidelity anchor pinned at exactly 1), its Step 3s citation, and its "overstates the gain rather than understating the cost" defect-class point with ADR-0012 attribution; `:246` uniquely carries Step 3j **and** Step 3L citations, the counts-in-full-in-`span_base`/`span_max`/`M_flat`/`T` scope limit, and its ADR-0016 attribution. Collapsing only the shared clause is a genuinely narrow surgical edit on prose that three Must Fix items are already moving in the same file — the risk of collateral drift in this cycle outweighs the prose economy. Recorded, with an optional task pair if the coder elects to attempt it under the stated scope.
- **`PROJECT-CONTEXT.md` conventions that shape the edit:** *Single-source-of-truth references* — `references/config.md` remains the sole normative owner of the arithmetic; MF-1 and MF-2 restore that ownership at two sites that drifted from it, and MF-3 removes the one place `SKILL.md` had quietly taken a share of it. *Mirror machinery* — the nested block's `span_max` line is brought to the same shape as the flat block's `span_base` line and `:533`'s `span({lane})` line, which is the established idiom, not a new one.
- **Backward compatibility** is trivially satisfied: no persisted artifact encodes the span formulas or the print-block strings. The Step 2p digest is transient and `.orchestrator/run-manifest.json` persists none of it.
- **Line numbers are current as of `d297e6c` plus the parent plan's uncommitted edits.** Re-locate every site by content, never by line number.
- **No open product decision** is touched by this plan.
- **Per-method cyclomatic complexity is not applicable** — this plan introduces no service, handler, use-case, or dispatcher class. It is a documentation-and-template change.

## Tasks

> Tasks are ordered oracle-first: for each Must Fix, the failing assertion is written and observed to fail before the edit that makes it pass. This is the reachable analogue of TDD for normative prose, per Technical Notes.
> The coder will check off `[ ]` → `[x]` as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run and assert green before checking the last task in the phase.
> **MF-2 is sequenced after MF-1 and MF-3 on purpose** — its corrected text describes the site census as it stands *after* those two land, and writing it earlier would state a second claim that is false at the moment it is written.

### Phase 0 — Capture the pre-edit oracle (must run first, must not be reordered)

- [x] Record the pre-edit numeral sequence of each of the five worked-example subsections (*the gate verdict and the ladder figure must agree*, *one lane carries all the work*, *a split carrying an integration sub-lane*, *`k = 2`*, *a declared top-level integration lane*), **and state the extraction convention in the record itself** (whether the subsection heading line is included). One convention, applied identically pre and post.
- [x] Record the pre-edit anchor + quote-fidelity census — `':(exclude).claude'` in `SKILL.md`, `the call shape from *How to spawn a subagent*` in `SKILL.md`, `through a **single sequential coder invocation**` in `SKILL.md`, its unbolded quotation in `references/config.md`, and the count of overlay `find` strings from `prime-agent/overlays/orchestrator.json` occurring in `references/config.md`. Expected 3, 3, 2, 1, 1. Record `grep -c 'min(S' references/config.md` = 0.
- [x] Record the pre-edit heading inventory: every heading line of `references/config.md` (byte-exact text and level) and every heading in `SKILL.md`'s Step 2p region; plus the inventory of cross-reference targets the parent plan pinned at ten.
- [x] Record `md5` of `SKILL.md`, `templates/architect.md`, `docs/adr/0012-*.md`, `docs/adr/0013-*.md`, `docs/adr/0014-*.md`, `docs/adr/0016-*.md`, and capture `git diff --stat HEAD -- docs/adr/0016-*.md` (expected `11 +`, `0 −`).
- [x] Record the pre-edit floors: `cd plugins/my-skills/skills/clean-code-gates && npm test` (expect 225 pass / 0 fail), `node scripts/build-prime-agent.mjs --check` exit code, `cd prime-agent && npm test` exit code.
- [x] Write the three Must Fix oracles as explicit re-runnable assertions with their **current (failing)** values recorded: **O1** — `:316` re-expansion present (count 1, must become 0), the `:309` fence carries no `tasks(i(run))` (count 0, must become 1), and the cross-read derivation of example 5 yields `g` = 12 (must become 8). **O2** — the unbounded claim strings present at `config.md:234` and ADR-0017's Consequences (must become bounded), and `Skills affected` asserts `SKILL.md` unamended (must become corrected). **O3** — `:534` carries no `integration({n})` (count 0, must become 1), no slot filling of the nested block is both self-consistent and correct on example 5, and `:546` names no run-level serial remainder.

### Phase 0 verification

- [x] All five worked-example numeral sequences recorded, with the extraction convention stated alongside them.
- [x] Census recorded at 3 / 3 / 2 / 1 / 1; `min(S` = 0.
- [x] Heading inventory and cross-reference target list recorded.
- [x] File digests recorded; ADR-0016 diff confirmed pure-append with `Status: Accepted` on line 3.
- [x] All three floors recorded green.
- [x] O1, O2, O3 written down and **observed to fail** at their recorded current values.

### Phase 1 — MF-1: the two stale normative sites in `references/config.md`

- [x] Re-assert O1 fails, recording exact current values: the `:316` clause "which is `max` over lanes of `tasks(L)` under a viable flat verdict and `T` under a non-viable one" present verbatim; the fenced formula under *Marginal-gain rule* reading `max(second_largest_span, span(L after the split))` with no serial remainder; and the hand cross-read of worked example 5 (`span_base` from *The baseline* = 24, post-split term from `:309` = 12) producing `g` = **12** against the printed 8.
- [x] Rewrite the `:316` sentence to reference `span_base` **by name** — as defined in *The makespan model* → *The baseline*, the span rule over the run's lane set with every lane unsplit under a viable flat verdict, and `T` under a non-viable one. Do not re-expand; do not restate the rule; keep the sentence's existing role (what "the current `span_max`" is before the first adoption) and the paragraph's following sentences intact.
- [x] Rewrite the `:309` fenced formula to carry the serial remainder — `max(second_largest_span, span(L after the split)) + tasks(i(run))` — and add a following clause stating that `tasks(i(run))` is a run constant and therefore cancels in `g`, which is what makes the shorter form correct as a *delta* and wrong as a *span*. Leave the surrounding paragraphs' arguments (the `span(L)`-not-largest-sub-lane point, the not-a-`makespan` point) unchanged.
- [x] Assert O1 now passes: the `:316` re-expansion count is 0; the `:309` fence contains `tasks(i(run))`; the cross-read derivation of example 5 yields `g` = **8**. Record the before (12) / after (8) derivation explicitly.
- [x] Assert `:314`'s sub-lane micro-example (`max(10, 5 + 6)` = **11**, `max(10, 5)` = **10**, overstating by 1) is byte-identical, and that no numeral anywhere in the *Marginal-gain rule* section moved.

### Phase 1 verification

- [x] `grep` for the `:316` re-expansion clause returns 0; `span_base` at that site is referenced by name.
- [x] The `:309` fence carries `+ tasks(i(run))` and is followed by the run-constant/cancels clause.
- [x] Worked example 5 cross-read derivation recorded: before `g` = 12, after `g` = 8, matching the printed 8.
- [x] `:314` byte-identical; no numeral moved in the section.
- [x] `grep 'min(S' references/config.md` still 0.
- [x] `node scripts/build-prime-agent.mjs --check` run; any failure is expected source drift against the not-yet-regenerated distribution and **not** an occurrence-count mismatch.

### Phase 2 — MF-3: the Step 2p.2 nested print block in `SKILL.md`

- [x] Re-assert O3 fails, and record the §5 finding that licenses this edit: ADR-0016 §5's heading is *"Step 2p.2's **flat** print block divides by `span_base`"* and its body covers only that block's four lines, so the parent plan's exemption does not reach the nested block; and `:534` is a **proven normative restatement** (of the superseded form), which is exactly the condition the parent plan's AC-14 permits a `SKILL.md` change on.
- [x] Add the serial remainder to the nested block's `span_max` line so its decomposition equals its result, mirroring the `integration({n})` idiom already used at `:505` and `:533`: `span_max     = max(second-largest span {n}, span({lane}) {span_L}) + integration({n}) = {span_max}`. Preserve the block's existing column alignment.
- [x] Extend `:546`'s prose with **one clause** noting that the run-level term carries the top-level integration lane after the `max`, as `span_base` does — pointing at `references/config.md` → *The makespan model*, restating no rule. Leave the `span(L)` vs `span_max` distinction, the 16 → `{5, 5}` + integration 6 micro-example, and the "printing one line labelled `span_max` that actually holds a lane span" warning unchanged.
- [x] Assert O3 now passes: `:534` contains `integration({n})`; the nested block has a self-consistent, correct filling on example 5 — `span_max = max(second-largest span 12, span(backend) 8) + integration(4) = 16` and the next line `g = 24 − 16 = 8` — recorded as a filled-slot walkthrough; `:546` names the run-level serial remainder and cites *The makespan model*.
- [x] Assert every other Step 2p.2 line is byte-identical: the whole flat print block, its `Estimated speedup:` paragraph, the `span({lane})` line at `:533`, the `g` / `c` / `{adopted | rejected}` / `Lanes left flat:` / `Leaf set:` / `Contracts to freeze:` / `Verdict:` lines, the two-integration-slots paragraph, and the `c`-cost table below `:548`.
- [x] Run the anchor + quote-fidelity census **immediately** (`SKILL.md` is now modified for the first time this cycle) and match 3 / 3 / 2 / 1 / 1 exactly, confirming in particular that `through a **single sequential coder invocation**` still counts 2 in `SKILL.md` and that `config.md:243`'s unbolded quotation still matches its wording character for character.

### Phase 2 verification

- [x] `:534` carries `+ integration({n})`; example-5 filled-slot walkthrough recorded and self-consistent (`= 16`, then `g = 24 − 16 = 8`).
- [x] `:546` extended by exactly one clause; its micro-example and existing warnings unchanged.
- [x] Flat print block and all other Step 2p.2 lines byte-identical (diff confined to `:534` and the `:546` clause).
- [x] Census 3 / 3 / 2 / 1 / 1 with zero drift; cross-document quote fidelity confirmed by character comparison.
- [x] No heading in the Step 2p region renamed, added, removed, or re-levelled.
- [x] `node scripts/build-prime-agent.mjs --check` run; it does **not** fail on an occurrence-count mismatch.

### Phase 3 — MF-2: scope the one-site claim in `config.md` and ADR-0017

- [x] Re-assert O2 fails, and re-run the site census of the concurrent-`max`-plus-serial-remainder shape **as it now stands after Phases 1 and 2**, classifying each surviving site by level (run / sub-lane) and kind (normative / display): `config.md:309` and `:316` now corrected; `config.md:314` sub-lane re-expansion (correct, stays); `SKILL.md:505` run-level display expansion (correct, ADR-0016 §5, stays); `SKILL.md:533` / `:544` sub-lane display (correct, stays); `SKILL.md:534` now corrected; `SKILL.md:546` now completed. Record the resulting count and use it as the factual basis for the two rewrites below.
- [x] Rewrite `config.md:234`'s claim to the bounded form: a **one-site edit of the normative arithmetic**, instead of four separately-maintained **normative** statements a later change has to move in agreement — followed by a sentence naming the Step 2p.2 print blocks as showing the shape expanded for on-screen legibility, a display decision recorded in ADR-0016 §5 rather than a normative statement, and the only other place the shape appears.
- [x] Rewrite ADR-0017's Consequence: replace "There is no longer a set of statements that must be moved in agreement" with the bounded form, name the display sites as the recorded exception, and state explicitly that ADR-0016 §5 covers the **flat** block only and that the nested block was **fixed rather than exempted**.
- [x] Correct ADR-0017's `Skills affected` line: drop the assertion that `SKILL.md` is unamended, record the one amended site (`:534`'s `span_max` line plus the `:546` clause) and why it was amended — it restated the arithmetic, in its superseded form — and keep `templates/architect.md` recorded as genuinely unamended.
- [x] Correct ADR-0017's *What stands* entry for the Step 2p.2 print-block template strings: the byte-for-byte guarantee holds for the **flat** block, and the nested block's `span_max` line was corrected because §5's heading scopes it to the flat block and its body does not reach the nested one.
- [x] Assert O2 now passes: neither unbounded claim string survives; both rewrites are true against the Phase 3 site census; `Skills affected` and *What stands* match the shipped tree.
- [x] Assert ADR-0016 is untouched by this phase — `md5` unchanged from Phase 0, `Status: Accepted` intact, `git diff --stat HEAD` still `11 +`, `0 −` — and that ADR-0012 / ADR-0013 / ADR-0014 and `templates/architect.md` are `md5`-identical to their Phase 0 values.

### Phase 3 verification

- [x] Post-Phase-1/2 site census recorded, with every surviving site classified normative-vs-display and run-vs-sub-lane.
- [x] `config.md:234` bounded to the normative arithmetic and naming the display exception.
- [x] ADR-0017 Consequence bounded; §5's flat-only scope and the fixed-not-exempted outcome both stated.
- [x] ADR-0017 `Skills affected` and *What stands* corrected and true against the tree.
- [x] ADR-0016 `md5` unchanged, `Status: Accepted`, diff still pure-append.
- [x] ADR-0012 / 0013 / 0014 and `templates/architect.md` `md5`-identical to Phase 0.
- [x] No numeral moved by this phase.

### Phase 4 — Should Fix rulings

- [x] Record the **SF-1 ruling — DEFER** — in this plan's Progress Log, enumerating by name the load-bearing content a wholesale merge would destroy: `:243`'s exact unbolded Step 3s quotation (quote-fidelity anchor pinned at exactly 1), its Step 3s citation, its "overstates the gain rather than understating the cost" defect-class point and ADR-0012 attribution; `:246`'s Step 3j **and** Step 3L citations, its counts-in-full-in-`span_base`/`span_max`/`M_flat`/`T` scope limit, and its ADR-0016 attribution — plus the reason to defer: three Must Fix items are already moving prose in this same file this cycle.
- [x] *(optional — NOT ATTEMPTED; SF-1 DEFER ruling upheld, see Progress Log)* If SF-1 is attempted despite the ruling: **first** write the oracle — `:243`'s Step 3s quotation byte-exact and counted at exactly 1, and every item enumerated above still present at its site — and observe it pass pre-edit.
- [x] *(optional — NOT ATTEMPTED; SF-1 DEFER ruling upheld, see Progress Log)* Collapse **only** the shared "serial and must be modelled as serial / a `max` including it would model an execution order the skill forbids, optimistically" clause that `:232` now states generically, leaving both blockquotes' unique citations, scope limits, attributions and the quotation intact; then re-assert the oracle and re-run the census.
- [x] SF-2 — append a **new** dated entry to `plans/feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.progress.md` recording the numeral-count extraction convention ("counts include the subsection heading line, which carries a numeral for the `k = 2` and `tasks(integration) > 0` examples only"), noting the AC-20 verdict needs no correction because the identical offset cancels on both sides. Do **not** rewrite lines `:49` or `:122`.
- [x] Assert the parent `.progress.md` diff is a pure append and that lines `:49` and `:122` are byte-identical.

### Phase 4 verification

- [x] SF-1 ruling recorded with the enumerated load-bearing content and the deferral reason.
- [x] *(vacuous — SF-1 not attempted)* If SF-1 was attempted: oracle green, census still 3 / 3 / 2 / 1 / 1, and both blockquotes' unique content intact.
- [x] Parent `.progress.md` diff is `+` only; `:49` and `:122` byte-identical.
- [x] No numeral moved in `references/config.md` by this phase.

### Phase 5 — Re-prove that no figure moved (two independent checks)

- [x] **Check A — mechanical no-numeral-drift.** Extract the numeral sequence of all five worked-example subsections under the Phase 0 convention and diff against the Phase 0 record. Any difference is a hard stop.
- [x] **Check B — full hand re-derivation.** Re-derive all five worked examples end to end **from the corrected text** — `:309`'s new fence, `:316`'s by-name reference, `:234`'s bounded claim, and the corrected nested print block — and record the derivation per example. Example 5 must reproduce `T` = 42, `span_base` = 24, `M_flat` = 29, post-adoption `span_max` = 16, `M_nested` = 25.5, `g` = 8, `c` = 4.5, reconciliation 3.5. **A disagreement means the rewritten text is wrong; it routes through BLOCKED and no numeral is ever adjusted to make a derivation agree.**
- [x] Assert `:459`'s *What this example is actually pinning* paragraph is byte-identical — it is the in-document oracle MF-1 was checked against and must not have been edited to agree with the fix.
- [x] Assert the structural invariants: heading inventory byte-identical to Phase 0 in both files; all ten pinned cross-reference targets resolve, plus the two by-name references this plan introduced (`:316` → *The baseline*, `:546` → *The makespan model*); `grep 'min(S' references/config.md` = 0.

### Phase 5 verification

- [x] Check A green — numeral sequences identical for all five subsections under one stated convention.
- [x] Check B green — all five examples re-derive by hand from the corrected text, recorded per example.
- [x] `:459` byte-identical.
- [x] Heading inventory byte-identical; twelve cross-references resolve; `min(S` = 0.
- [x] `node scripts/build-prime-agent.mjs --check` does not fail on occurrence-count drift.

### Phase 6 — Regenerate the distribution and prove the floor

- [x] Regenerate with `node scripts/build-prime-agent.mjs`. `prime-agent/skills/**` is `rmSync`-and-rewritten by this script and is **never** hand-edited.
- [x] `node scripts/build-prime-agent.mjs --check` exits **0**.
- [x] `cd prime-agent && npm test` exits **0** (install + parity).
- [x] `cd plugins/my-skills/skills/clean-code-gates && npm test` — **225** passing, **0** failing, matching the Phase 0 floor.
- [x] Re-run the anchor + quote-fidelity census post-regeneration and match 3 / 3 / 2 / 1 / 1 exactly.
- [x] Confirm `git status` shows changes confined to `references/config.md`, `SKILL.md`, `docs/adr/0017-…md`, `prime-agent/**` (generated), the parent `.progress.md` (append), and this plan's own files — and that no commit or push was made.

### Phase 6 verification

- [x] Distribution regenerated by script only; no hand-edit under `prime-agent/skills/**`.
- [x] `--check` exit 0.
- [x] `cd prime-agent && npm test` exit 0.
- [x] `clean-code-gates` 225 / 225 / 0.
- [x] Post-regeneration census 3 / 3 / 2 / 1 / 1.
- [x] Change set confined to the expected paths; nothing committed or pushed.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands from the Commands section of `PROJECT-CONTEXT.md` that apply to the phase's touched paths and asserts each exits 0. A failure routes through the coder's BLOCKED step, not a silent rewrite.

Applying `PROJECT-CONTEXT.md` → **Commands** to this change:

- **No build step and no markdown lint** exist for doc-skill authoring — neither is emitted.
- **`clean-code-gates` JS test suite** (`cd plugins/my-skills/skills/clean-code-gates && npm test`) — its path condition (`plugins/my-skills/skills/clean-code-gates/**`) is **not** matched by any phase's diff. It runs only as the Phase 0 and Phase 6 no-regression floor, never as a per-phase gate. `PROJECT-CONTEXT.md` is explicit that it must not be invoked against non-JS doc skills.
- **`node scripts/build-prime-agent.mjs --check`** — path condition `plugins/my-skills/skills/orchestrator/**`, matched by Phases 1, 2, 3 and 5 (Phase 3 additionally touches `docs/adr/`, which the script does not read). This is the one mechanical gate that applies to the edit region, because it hard-fails on overlay-anchor occurrence-count drift (`applyReplacements`, `scripts/build-prime-agent.mjs:77`–`:81`). In Phases 1–5 it may legitimately report source drift against the not-yet-regenerated distribution; the assertion in those phases is specifically that it does **not** fail on an occurrence-count mismatch. In Phase 6, after regeneration, it must exit **0** outright.
- **`cd prime-agent && npm test`** — path condition `prime-agent/**`, matched only by Phase 6 (regeneration). Must exit 0 there.
- **Phase 4** touches only `plans/**` and (optionally) `references/config.md`. If the optional SF-1 tasks are performed, `--check` applies to that phase on the same terms as Phases 1–3; if they are skipped, no gate command's path condition is matched.

Phase exit criterion: ALL applicable commands above exit 0 (or, for `--check` in Phases 1–5, fail on nothing but expected source drift) on the changed set, **and** every item in that phase's `### Phase N verification` checklist is green. No silent rewrite of `references/config.md`, `SKILL.md` or `docs/adr/0017-…md` to make a check pass without a corresponding plan task — and in particular, **no numeral is ever adjusted to make a hand re-derivation agree**. A hand re-derivation that disagrees with a printed figure means the corrected text is wrong; it routes through BLOCKED.

G1 (coverage) and G6 (mutation) are QA-only and are not emitted here. No structural or behavioural test is emitted at any phase, because none is reachable — see Technical Notes.

## Dependencies

- `FEAT-20260819T101153Z-e883` — DONE. This plan edits the text that plan produced; it cannot start before it.
- `CR-20260819T104419Z-fc4f` — the source review. No other plan is in flight over `references/config.md`, `SKILL.md`, or `docs/adr/`.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T11:28:37Z | REVIEWER

CR-20260819T112837Z-9e42 created. Status: REQUEST_CHANGES. Must Fix: 2. Should Fix: 3.

Cycle-1 MF-1 and MF-3 verified closed (`:309` correct as a span — `max(8, 12, 6) + 4` = 16 matches the fence; nested block decomposition equals its own result). MF-1 (this CR): MF-2 remains open — `config.md:234`'s and ADR-0017's replacement enumeration is falsified by `config.md:309`, created by this cycle's own AC-2, and by `SKILL.md:546`; `:208`/`:234` now contradict. MF-2 (this CR): `SKILL.md:544`'s "two integration slots" is a false count and false source; upheld as a PLAN defect (AC-5 vs AC-8), not a coder defect. Should Fix: `second_largest_span` undefined (SF-1), `:243`/`:246` DEFER upheld (SF-2), progress-log baseline conflation (SF-3).

### 2026-08-19T11:18:53Z | TESTER

TEST-20260819T111853Z-17d4 created. Status: PASS. Coverage: n/a → n/a (inapplicable — no executable path; `parallelism` is `off` and `full` with `k >= 2` is unreachable here).

MF-1 and MF-3 independently verified closed: the cross-read now yields `g` = `24 − 16` = 8 (was 12), `:309` is correct as a **span** and not merely as a cancelling delta, and the nested print block's `span_max` decomposition equals its own result on the `X > 0` example (`max(12, 8) + integration(4) = 16`, then `g = 24 − 16 = 8`). All five worked examples re-derive by hand from the corrected text; 448/448 numeral tokens identical; exactly one line differs across the whole worked-example region vs HEAD (the parent cycle's permitted cancellation-identity rewording). Census 3 / 3 / 2 / 1 / 1, `min(S` = 0, 31 headings byte-identical, ADR-0016 `11 +` / `0 −` and `Accepted`, ADR-0012/0013/0014 and `templates/architect.md` unamended, parent `.progress.md` a pure append. Floors green: 225 / 0, `--check` exit 0, `prime-agent && npm test` exit 0.

Two Must-Fix-grade findings routed to the reviewer. **F1** — MF-2's replacement enumeration at `config.md:234` (and reproduced in ADR-0017's Consequences) is still false: the shape survives at `config.md:309`, a run-level normative fence **created by MF-1's own fix this cycle**, and at `SKILL.md:546`'s prose; `:208` and `:234` now also contradict each other. **F2** — the coder's flagged `SKILL.md:544` item is **ruled against the coder's judgement**: "The two integration slots" is now a false count *and* a false source (the third is fed from the lane-level field), and the mis-fill it fails to guard prints `g = 24 − 12 = 12` — the exact defect this cycle removed. F2 is a plan defect (AC-5 vs AC-8), not a coder defect; the coder was right to flag rather than edit against an explicit AC. Plus F3 (`second_largest_span` undefined, low, pre-existing) and F4 (SF-1 DEFER upheld, informational).

### 2026-08-19T12:18:44Z | CODER — Phase 6 complete; all tasks done

**Distribution regenerated by script only.** `node scripts/build-prime-agent.mjs` → "wrote prime-agent/skills with 11 skills (154 files)", exit **0**. `prime-agent/skills/**` is `rmSync`-and-rewritten wholesale by that script and was **never** hand-edited at any point in this plan. `node scripts/build-prime-agent.mjs --check` now exits **0** ("up to date, 11 skills, 154 files") — the first clean `--check` since Phase 1, and the assertion that the source edits carry through the overlay pipeline without an occurrence-count failure. Both fixes are present in the generated tree: `+ tasks(i(run))` appears in the distributed `references/config.md`, and the corrected nested `span_max` line in the distributed `SKILL.md`.

**Floors, all matching or exceeding Phase 0.** `cd prime-agent && npm test` exit **0** (install preflight, containment, all-or-nothing install, mid-loop rollback, and parity all ok). `cd plugins/my-skills/skills/clean-code-gates && npm test` — **225 passing, 0 failing**, identical to the Phase 0 floor. No regression anywhere.

**Post-regeneration census: 3 / 3 / 2 / 1 / 1**, zero drift, and `grep 'min(S' references/config.md` still **0**. Final digest sweep: `templates/architect.md` `5a1dac61…`, ADR-0012 `70eb1eca…`, ADR-0013 `56b8f4a9…`, ADR-0014 `bc16761f…`, ADR-0016 `757d241b…` — every one `md5`-identical to Phase 0. ADR-0016's diff against HEAD is still **11 +, 0 −** and it remains `Accepted`; this plan appended nothing to it, because §5's heading was already correct and the defect was in the citing documents.

**Final oracle state — all three green together**, with every frozen site still at its captured count: O1a 0, O1b 1, O2a–d 0, O3a 1, O3b 1; `:316`'s sub-lane micro-example 1, `:459` 1, `:505` 1, `:533` 2, `:535` 1.

**Change set confined and nothing committed.** `git status` shows modifications only in `plugins/my-skills/skills/orchestrator/SKILL.md`, `plugins/my-skills/skills/orchestrator/references/config.md`, `prime-agent/skills/orchestrator/{SKILL.md,references/config.md}` (generated), the untracked `docs/adr/0017-…md`, the untracked parent `.progress.md` (append only), and this plan's own files. `docs/adr/0016-…md` shows as modified from the **parent** plan's uncommitted append, not from this one. No commit, no push — the pipeline ends at `READY_TO_COMMIT`.

**No behavioural or executable test was emitted, and none could be.** `parallelism` defaults to `off` in this repository and the `full` level with `k >= 2` is unreachable here, so no path executes the span rule. Verification was structural and arithmetic throughout, per `PROJECT-CONTEXT.md` → *Test tooling*. The TDD analogue was honoured in full: every Must Fix was written as a re-runnable assertion and **observed to fail** in Phase 0 before the edit that made it pass.

All **79** plan checkboxes complete (39 tasks plus every per-phase verification item). Plan status → DONE. Ready for reviewer.

### 2026-08-19T12:09:52Z | CODER — Phase 5 complete (no figure moved, two independent checks)

**Check A — mechanical no-numeral-drift: GREEN.** All five worked-example subsections re-extracted under the Phase 0 convention and diffed against the Phase 0 record: **453 numeral tokens, token-for-token identical**, counts 45 / 63 / 62 / 147 / 131 unchanged. The only difference the extractor reports is the `[start..end]` line-range label on each subsection header, shifted by +2 by the lines Phase 1 added upstream; no counted token moved.

A **stronger** result than Check A required also holds, and is recorded because it makes the check unfalsifiable rather than merely passing: comparing each subsection body against the not-yet-regenerated distribution copy (which still holds the pre-edit text), **all five bodies are byte-identical** — not one character moved inside any worked example. The parent plan could only report four of five byte-identical; this plan touches none of them.

**Check B — full hand re-derivation from the corrected text: GREEN.** Each example re-derived end to end from `:309`'s new fence, `:318`'s by-name reference, `:234`'s bounded claim and the corrected nested print block:

1. *The gate verdict and the ladder figure must agree* — lanes `{12, 6}`, `X` = 0. `span_base` = `max(12, 6) + 0` = **12**; flat overhead `A + J` = **4**; `M_flat` = **16**. `span(L)` = `max(6, 6) + 0` = 6; post-adoption `span_max` = `max(6, 6) + 0` = **6**; nested overhead **8**; `M_nested` = **14**. `g` = `12 − 6` = **6**; `c` = `8 − 4` = **4**; adopted. Reconciliation `16 − 14` = 2 = `6 − 4`. Exact.
2. *One lane carries all the work* — flat **non-viable** (condition 1), so `span_base` = `T` = **24** as a **sum**, not the rule. `span(mobile)` = `max(8, 8, 8) + 0` = 8; `span_max` = `max(0, 8) + 0` = **8**; overhead `A + A + J + J + I(2×0.25)` = **8.5**; `M_nested` = **16.5**. `g` = `24 − 8` = **16** (the sequential form `g = T − (S + X)` = `24 − (8 + 0)`); `c` = **8.5**; adopted. Reconciliation `24 − 16.5` = 7.5 = `16 − 8.5`. The `{20, 4}` counter-case re-derives too: `span_max` 20, `g` **4** < `c` 8.5 → rejected, degrade to `off`.
3. *A split carrying an integration sub-lane* — `span(mobile)` = `max(concurrent) + tasks(i(L))` = `5 + 6` = **11**; `span_max` = `11 + 0` = **11**; overhead `A + A + J + J + I(8×0.25)` = **10**; `M_nested` = **21**. `g` = `24 − 11` = **13**; `c` = **10**; adopted at a margin of **3**, a `3/24` = **12.5%** improvement. The pre-declared-field counterfactual reproduces: `tasks(integration)` read as 0 gives `span_max` 5 and `g` **19**, wrong by exactly **6**.
4. *`k = 2`* — `T` = **38**, largest lane `24/38` = **63%**, viable. `span_base` = **24**, `M_flat` = **28**. Adoption 1: `span(A)` = 8, `span_max` = `max(10, 8) + 0` = **10**, `g₁` = **14**, `c₁` = **4.5**, `M_nested` = **18.5**. Adoption 2: `span(B)` = 5, `span_max` = `max(8, 5, 4)` = **8**, `g₂` = **2**, `c₂` = `I(0.5)` = **0.5** (no second `A`, no second `J`), `M_nested` = **17**. Both reconciliations hold: cost `9 − 4` = **5** = `4.5 + 0.5`; gain `24 → 8` = **16** = `14 + 2`; overall `28 − 17` = 11 = `16 − 5`. The superseded serialized charge reproduces at `2.5` against `g₂` = 2, with its own `M_nested` = **19** > 18.5.
5. *A declared top-level integration lane* — every figure the plan named reproduces: `T` = **42**, `span_base` = `max(20, 12, 6) + 4` = **24**, `M_flat` = `24 + 5` = **29**, post-adoption `span_max` = `max(12, 8) + 4` = **16**, `M_nested` = `16 + 9.5` = **25.5**, `g` = `24 − 16` = **8**, `c` = **4.5**, reconciliation `29 − 25.5` = **3.5** = `8 − 4.5`. The cancellation identity agrees independently: `g` = `M − S` = `20 − 12` = **8**. Lanes left flat re-derive: `frontend` `{11, 1}` fails condition 2 at `11/12` = **92%**; `admin` is off the critical path so `span_max` stays 16 and `g = 0`; `wiring` is never a candidate. Remaining gates: `4 + 2` = **6** ≤ 42; 4 leaves, largest `12/42` = **29%**; 4 ≤ ceiling **6**.

**No derivation disagreed with any printed figure**, so the BLOCKED route was not taken and no numeral was adjusted anywhere. Worth stating plainly, since it is the point of running Check B at all: example 5 is the case that would have exposed a wrong fix, because it is the only example where `X > 0` — and it is the one whose cross-read was broken before Phase 1.

**`:459` is byte-identical.** The *What this example is actually pinning* paragraph — the in-document oracle MF-1 was checked against — is unchanged, verified by string comparison against the pre-edit copy. It was **not** edited to agree with the fix; the fix was checked against it. Its statement that the uncorrected model read `max(20, 4)` = 20 and `max(12, 4)` = 12 remains exactly the pair of numbers the pre-edit `:316` and `:309` produced.

**Structural invariants.** `references/config.md` heading inventory `md5` `f84d6a09…` and `SKILL.md` Step 2p inventory `md5` `a933a64a…` — both byte-identical to Phase 0; 31 and 9 headings, none renamed, added, removed or re-levelled. All **ten** pinned cross-reference targets resolve, plus the **two** this plan introduced — `:318` → *The makespan model* → *The baseline*, and `:546` → *The makespan model* — for **12 / 12**. `grep 'min(S' references/config.md` = **0**.

Gate: `--check` exits 1 on `stale` for the two edited source files only, not on occurrence-count drift.

### 2026-08-19T11:58:30Z | CODER — Phase 4 complete (Should Fix rulings)

**SF-1 — DEFER upheld. Not attempted.** The architect's ruling stands, and the oracle did not show the collapse to be free — three Must Fix items moved prose in `references/config.md` in this same cycle, two of them (`:309`, `:316`) inside the very *Marginal-gain rule* / *The makespan model* neighbourhood the blockquotes sit in. Enumerating, by name, the load-bearing content a wholesale merge of `:243` / `:246` would destroy:

*Unique to `:243` (the sub-lane blockquote):*
- the **exact unbolded Step 3s quotation** — "through a single sequential coder invocation — after its sibling sub-lanes are DONE, never concurrently with them" — which is a **cross-document quote-fidelity anchor pinned at exactly 1** and must keep matching `SKILL.md`'s bolded wording character for character;
- its **Step 3s** citation;
- its defect-class point that this error **overstates the gain rather than understating the cost**, with the **ADR-0012** attribution.

*Unique to `:246` (the run-level blockquote):*
- its **Step 3j** *and* **Step 3L** citations — two, where `:243` has one;
- the scope limit that the lane **counts in full in `span_base`, `span_max`, `M_flat`, and `T`** while being excluded from the two work-concentration conditions and those conditions only;
- its **ADR-0016** attribution.

The CR is explicit that a wholesale merge "would be worse than leaving both". The narrow alternative — collapsing only the shared "serial and must be modelled as serial / a `max` including it would model an execution order the skill forbids, optimistically" clause that `:232` now states generically — is a genuinely surgical edit, but on prose immediately adjacent to three edits already landed this cycle. Collateral-drift risk outweighs the prose economy; the two optional tasks are recorded as **not attempted** rather than checked off as done, and both remain a clean, well-scoped candidate for a later cycle with a quiet file.

**SF-2 — accepted as an append.** A new dated entry was appended to `plans/feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.progress.md`, at EOF, following the precedent already set in that file by its SIMPLIFY / TESTER / REVIEWER entries. It records the numeral-count extraction convention (subsection heading line **included**; only the `` `k = 2` `` and `` tasks(integration) > 0 `` headings carry a numeral, which is the whole of the 147/146 and 131/130 difference) and states that the **AC-20 verdict needs no correction** — that check compared pre against post under one convention, so an identical offset on both sides cancels exactly.

**Append proven, not asserted.** A pre-image was taken before writing. Against it: **0** removed lines; the entire pre-existing prefix byte-identical; **12** lines added, all at EOF; line `:49` and line `:122` byte-identical **and** still at those line numbers, since appending at EOF shifts nothing. Nothing above the append was rewritten, per that file's "Agents append below. Never rewrite entries." contract.

Gate: Phase 4 touched only `plans/**` (the optional SF-1 tasks were skipped, so `references/config.md` was not touched by this phase) — no gate command's path condition is matched, per the plan's Verification section. Census re-confirmed unchanged at **3 / 3 / 2 / 1 / 1** regardless, and no numeral moved in `references/config.md`.

### 2026-08-19T11:52:07Z | CODER — Phase 3 complete (MF-2)

**Site census of the concurrent-`max`-plus-serial-remainder shape, as it stands *after* Phases 1 and 2** — this is the factual basis the two rewrites are written against, which is why MF-2 was sequenced last:

| Site | Level | Kind | Status |
| ---- | ----- | ---- | ------ |
| `config.md:227` (the fenced rule) + `:232` | generic | **normative** | the one canonical statement |
| `config.md:309` | run | normative | **corrected this cycle** — now the rule applied to the post-adoption lane set |
| `config.md:316` (was `:314`) | sub-lane | illustrative | correct, byte-identical, stays |
| `config.md:318` (was `:316`) | run | normative | **corrected this cycle** — now by-name |
| `config.md` baseline table, `M_flat`, `M_nested`, the cancellation paragraph | run | normative | reference by name; no re-expansion |
| `SKILL.md:505` (flat block) | run | **display** | correct, ADR-0016 §5, stays |
| `SKILL.md:533` + its quotation at `:544` | sub-lane | display | correct, stays |
| `SKILL.md:534` (nested block) | run | display | **corrected this cycle** |
| `SKILL.md:546` | run | prose | **completed this cycle** |

Resulting count: **one** normative statement of the shape in `references/config.md`; **three** display expansions in `SKILL.md` Step 2p.2 (plus one in-prose quotation); **one** sub-lane illustration in `config.md`. The unbounded claim can never become true, which is exactly why it is scoped rather than deleted.

**`config.md:234` bounded.** "a **one-site** edit, instead of four separately-maintained statements" → "a **one-site edit of the normative arithmetic**, instead of four separately-maintained *normative* statements", followed by a new sentence naming the two kinds of surviving expansion — Step 2p.2's two print blocks (a display decision recorded in ADR-0016 §5) and the sub-lane micro-examples under *Marginal-gain rule* — and stating that a change to how a serial remainder is charged must still be carried into them by hand. The achievement it records is real and stays stated; only its reach is bounded.

**ADR-0017 Consequence bounded.** "There is no longer a set of statements that must be moved in agreement" → "No set of *normative* statements has to be moved in agreement any more", with the display sites named as the recorded exception, §5's **flat-only** scope stated explicitly (heading and body both), and the nested block recorded as **fixed rather than exempted**, citing `CR-20260819T104419Z-fc4f` MF-3.

**ADR-0017 `Skills affected` corrected.** It no longer asserts `SKILL.md` is unamended. It now records `templates/architect.md` as genuinely unamended (referential mentions, no formula) and `SKILL.md` as amended at exactly one site — `:534`'s `span_max` line plus the `:546` clause — with the reason: it restated the arithmetic, in its superseded pre-ADR-0016 form.

**ADR-0017 *What stands* corrected.** The byte-for-byte guarantee is now scoped to the ***flat*** print-block template strings, quoting §5's own heading, and recording that the nested block's `span_max` line was corrected because §5 does not reach it. Every other nested-block line still stands byte for byte.

**O2 now passes**: O2a 1 → **0**, O2b 1 → **0**, O2c 1 → **0**, O2d 1 → **0**. All three oracles O1 / O2 / O3 are green simultaneously, and every frozen site still counts as captured in Phase 0.

**Invariants re-asserted after this phase.** ADR-0016 `md5` **`757d241bf78ff338762b55a4b88ea164`** — unchanged from Phase 0; `Status: Accepted` intact on line 3; `git diff --stat HEAD` still **11 +, 0 −** (pure append). ADR-0012 `70eb1eca…`, ADR-0013 `56b8f4a9…`, ADR-0014 `bc16761f…`, `templates/architect.md` `5a1dac61…` — all `md5`-identical to their Phase 0 values. `references/config.md` heading inventory `md5` `f84d6a09…` and `SKILL.md` Step 2p inventory `md5` `a933a64a…` — both unchanged.

**No figure moved.** The full five-subsection numeral extraction re-run after this phase is token-for-token identical to Phase 0 — **453 numeral tokens**, counts 45 / 63 / 62 / 147 / 131. The only numerals this phase added anywhere are the `ADR-0016 §5` citations at `config.md:234` and in ADR-0017, which sit outside every worked-example subsection and outside the *Marginal-gain rule* section, and the document already cites `ADR-0016 §2` in the same idiom.

Gate: `--check` exits 1 on `stale` for the two edited source files only — expected drift against the not-yet-regenerated distribution, not an occurrence-count mismatch. (ADR files are not read by the build script.)

### 2026-08-19T11:38:44Z | CODER — Phase 2 complete (MF-3)

**The §5 finding that licenses this edit, re-confirmed against the text.** ADR-0016 §5's heading reads *"Step 2p.2's **flat** print block divides by `span_base`"* and its body covers only that block's four lines; it is silent on the nested block. The parent plan's exemption therefore cited a section that does not reach the site it exempted. `SKILL.md:534` **is** a proven normative restatement — of the superseded pre-ADR-0016 form — which is exactly the condition the parent plan's AC-14 permits a `SKILL.md` change on. The edit satisfies AC-14 rather than violating it, and ADR-0016 was not widened to cover the nested block.

**`:534`** now reads `  span_max     = max(second-largest span {n}, span({lane}) {span_L}) + integration({n}) = {span_max}`, mirroring the `integration({n})` idiom already at `:505` (flat block) and `:533` (`span({lane})`). Leading column alignment preserved byte for byte; the term is inserted after the `max`, where the serial remainder belongs.

**`:546`** gained exactly one clause: "The run-level term carries the top-level integration lane after the `max`, exactly as `span_base` does — which is why the `span_max` line above ends `+ integration({n})`, and why a run declaring `none` at the lane level still prints `integration(0)` there rather than dropping the term; that arithmetic is normative in `references/config.md` → *The makespan model* and is not restated here." It **points at** the reference and restates no rule. The `span(L)` vs `span_max` distinction, the 16 → `{5, 5}` + integration 6 micro-example, and the "printing one line labelled `span_max` that actually holds a lane span" warning are all untouched.

**O3 now passes.** O3a 0 → **1**; the bare pre-edit `:534` form 1 → **0**; O3b 0 → **1**.

**Filled-slot walkthrough — worked example 5**, the case with `tasks(i(run))` = 4:

```
  span(backend) = max(concurrent 8, 8) + integration(0) = 8
  span_max      = max(second-largest span 12, span(backend) 8) + integration(4) = 16
  g    = 24 − 16 = 8
```

`max(12, 8)` = 12, `+ integration(4)` = **16**, which equals the `{span_max}` slot — the decomposition now equals its own stated result. The next line renders `g = 24 − 16 = 8`, matching the printed 8, the cancellation identity `M − S` = `20 − 12` = 8, and the corrected `config.md:309`. Pre-edit no filling existed that was both self-consistent and correct: `{span_base}` is populated from `:505`, which does carry the term (24), while `:534` decomposed without it (12) — forcing either `= 16` after a decomposition yielding 12, or `g = 24 − 12 = 12` against a true 8.

**Everything else byte-identical.** `git diff` on `SKILL.md` is **2 insertions / 2 deletions**, at exactly `:534` and `:546` and nowhere else — so the entire flat print block, its `Estimated speedup:` paragraph, `:533`'s `span({lane})` line, the `g` / `c` / `{adopted | rejected}` / `Lanes left flat:` / `Leaf set:` / `Contracts to freeze:` / `Verdict:` lines, the two-integration-slots paragraph and the `c`-cost table are all untouched. `SKILL.md` Step 2p heading inventory md5 `a933a64a8da917ac3ea3bc4058c3d09c` — identical to Phase 0; no heading renamed, added, removed or re-levelled.

**Census re-run immediately after the edit** (first cycle to modify `SKILL.md`): **3 / 3 / 2 / 1 / 1**, zero drift. Quote fidelity confirmed by character comparison, not merely by count: stripping the `**` markers from `SKILL.md`'s `through a **single sequential coder invocation**` yields exactly the string `config.md:243` quotes, character for character.

Gate: `--check` exits 1 listing both files as `stale` against the not-yet-regenerated distribution — expected source drift, **not** an occurrence-count mismatch.

**Two notes recorded for the reviewer rather than acted on unilaterally:**

1. *Oracle anchor trimmed for a case artifact.* O3b was pre-registered as the lowercase paraphrase "the run-level term carries…", but the clause lands sentence-initially as "The run-level term carries…". The anchor was trimmed past the article to `run-level term carries the top-level integration lane after the \`max\`` — an exact, case-clean substring of the same clause. The assertion was not weakened in substance; the prose was reworded twice to meet the oracle before the anchor itself was touched.
2. *The two-integration-slots paragraph now enumerates two of three slots.* `:543`'s "**The two integration slots** are populated from the digest's declared `integration` field…" names the `span({lane})` slot and the `Nested plan:` slot; `:534` now carries a third, fed from the **lane-level** declared field. Nothing that paragraph asserts became false — the new slot is likewise populated from a declared field, and the `:546` clause documents it — but the count is now under-inclusive. The plan pins that paragraph byte-identical (Phase 2 task list, Out of Scope) and confines the diff to `:534` and the `:546` clause, so it was **not** touched. Flagging it as a candidate Should Fix for the next cycle rather than widening scope here.

### 2026-08-19T11:26:10Z | CODER — Phase 1 complete (MF-1)

**`:309` — the fenced post-split formula now carries the serial remainder.** It reads `max(second_largest_span, span(L after the split)) + tasks(i(run))`, and is followed by two additions: a clause naming it as the span rule applied to the **post-adoption lane set** with the same declared `i(run)`, and a paragraph stating that `tasks(i(run))` is a **run constant** (the top-level integration lane is never a sub-split candidate), so it sits in both the minuend and the subtrahend and cancels in `g`. That is precisely what makes the shorter form correct as a **delta** — dropping it from *both* sides leaves `g` unchanged — and wrong as a **span**: the value in the fence is a `span_max`, the run's post-adoption critical path, and without the term it understates that path by exactly the serial work. Closing instruction: write the delta by subtracting two spans, never by subtracting a span from a bare `max`.

**`:316` — `span_base` is now referenced by name.** "which is `max` over lanes of `tasks(L)` under a viable flat verdict and `T` under a non-viable one" → "taken from there **by name** and not re-expanded here — the span rule over the run's lane set with **every lane unsplit** under a viable flat verdict, and `T` under a non-viable one". The sentence keeps its role (what "the current `span_max`" is before the first adoption) and every following sentence of the paragraph is untouched. No `max`-plus-`tasks(…)` re-expansion of a run-level span quantity survives at the site.

**O1 now passes.** O1a 1 → **0**; O1b 0 → **1**; the bare pre-edit fence 1 → **0**.

**The cross-read derivation, before and after** — worked example 5, lane set `{backend: 20, frontend: 12, admin: 6}` + `wiring` at `tasks(i(run))` = 4, `backend` split into `{8, 8}` with `integration: none` so `span(backend)` = 8, `second_largest_span` = 12:

- **Before.** `span_base` from *The baseline* = `max(20, 12, 6) + 4` = **24**. Post-split term from `:309` = `max(12, 8)` = **12** — no serial remainder. `g` = `24 − 12` = **12**. The printed figure is **8**. Overstated by exactly `X` = 4, and the mismatch is invisible within either site read alone.
- **After.** Post-split term from `:309` = `max(12, 8) + 4` = **16**. `g` = `24 − 16` = **8**. Agrees with the printed 8, with the cancellation identity `g = M − S` = `20 − 12` = 8, and with `:459`'s statement of what the uncorrected model produced.

**Nothing moved.** `:314`'s sub-lane micro-example is **byte-identical** (verified by string comparison against the not-yet-regenerated distribution copy, which still holds the pre-edit text): `max(10, 5 + 6)` = 11, `max(10, 5)` = 10, overstating by 1. The *Marginal-gain rule* section's full numeral sequence is byte-identical pre and post — `0 16 5 5 6 10 10 5 6 11 10 5 10 1`, 14 tokens. One rewrite iteration was required here: the first draft of the run-constant paragraph referred to "the `ask` ladder's option 3", whose numeral token would have drifted the section sequence to 15. It was reworded to "the `ask` ladder quotes for the nested plan" — same referent, no numeral. All five worked-example sequences are unchanged (only their line-range labels shifted by +2, which the extractor records but does not count).

`grep 'min(S' references/config.md` = **0**. Gate: `node scripts/build-prime-agent.mjs --check` exits 1 reporting `stale: prime-agent/skills/orchestrator/references/config.md` — expected source drift against the not-yet-regenerated distribution, and **not** an occurrence-count mismatch, which is the Phase 1 assertion.

### 2026-08-19T11:14:36Z | CODER — Phase 0 complete (pre-edit oracle captured)

**Numeral-sequence extraction convention** (stated once, applied identically pre- and post-edit): a worked-example subsection spans from its own `#### Worked example …` heading line through the line before the next `####` heading; **the subsection heading line is included**; a numeral is a maximal `[0-9]+(\.[0-9]+)?` run (so `25.5` is one token, `4×0.25` is two, `70%` is one); order is document order.

Pre-edit sequences (full token lists retained in the run scratchpad; counts and boundaries here):

| # | subsection | lines | numeral count |
| - | ---------- | ----- | ------------- |
| 1 | the gate verdict and the ladder figure must agree | 338–353 | **45** |
| 2 | one lane carries all the work (sequential baseline) | 354–373 | **63** |
| 3 | a split carrying an integration sub-lane | 374–393 | **62** |
| 4 | `k = 2`, the case the overlap exists for | 394–430 | **147** |
| 5 | a declared top-level integration lane | 431–460 | **131** |

Note for SF-2: 147 / 131 are the **heading-included** counts. The parent plan recorded 146 / 130 under a heading-excluded convention; the heading lines of examples 4 and 5 each carry exactly one numeral (`k = 2`, `> 0`), which is the whole of the offset.

**Census: 3 / 3 / 2 / 1 / 1** — `':(exclude).claude'` 3 in `SKILL.md`; `the call shape from *How to spawn a subagent*` 3; `through a **single sequential coder invocation**` 2; its unbolded quotation 1 in `references/config.md`; overlay `find` strings from `prime-agent/overlays/orchestrator.json` occurring in `references/config.md` 1. `grep -c 'min(S' references/config.md` = **0**.

**Heading inventory** — `references/config.md` 31 headings, md5 `f84d6a09e50a6e32c1e5b13cb445db67`; `SKILL.md` Step 2p region (`:444`–`:703`) 9 headings, md5 `a933a64a8da917ac3ea3bc4058c3d09c`. **Cross-references 10 / 10 resolve** (*The makespan model*, *The baseline*, *The two work-concentration conditions are evaluated at leaf granularity*, *Leaf-level re-application…*, *Per-sub-lane re-application…*, *Containment*, *Owned-glob rejection*, *The cost side*, *Greedy, recomputed adoption*, *Degradation*).

**Digests** — `SKILL.md` `a81395dbaab1f79b64f81d7ea7373acb`; `templates/architect.md` `5a1dac6171ec6c1f10df419c5ab299ce`; ADR-0012 `70eb1ecaa71039a1346a71869bd65290`; ADR-0013 `56b8f4a9d75c55b9a889e61bde56dc99`; ADR-0014 `bc16761f3fd2355309e5a7ed94849298`; ADR-0016 `757d241bf78ff338762b55a4b88ea164`. `git diff --stat HEAD -- docs/adr/0016-*.md` = **11 insertions, 0 deletions** (pure append), `Status: Accepted` on line 3.

**Floors green** — `clean-code-gates` **225 pass / 0 fail**; `node scripts/build-prime-agent.mjs --check` exit **0** ("up to date, 11 skills, 154 files"); `cd prime-agent && npm test` exit **0**.

**O1 / O2 / O3 written and observed to FAIL** at these current values:

- **O1a** `:316` re-expansion clause "which is `max` over lanes of `tasks(L)` under a viable flat verdict and `T` under a non-viable one" present = **1** (target 0).
- **O1b** `:309` fence carrying `+ tasks(i(run))` = **0** (target 1); the bare pre-edit fence `max(second_largest_span, span(L after the split))` present = 1.
- **O1c** cross-read of worked example 5 — `span_base` from *The baseline* = 24, post-split term from `:309` = `max(12, 8)` = 12 — yields `g` = **12** against the printed **8**. Overstated by exactly `X` = 4.
- **O2a** `config.md:234` "instead of four separately-maintained statements that a later change has to move in agreement" = **1** (target 0).
- **O2b** ADR-0017 Consequence "There is no longer a set of…" = **1** (target 0).
- **O2c** ADR-0017 `Skills affected` "`SKILL.md` and `templates/architect.md` are **unamended**" = **1** (target 0).
- **O2d** ADR-0017 *What stands* "**Step 2p.2's print-block template strings**, byte for byte." = **1** (target 0).
- **O3a** `:534` carrying `+ integration({n})` = **0** (target 1); the bare pre-edit form present = 1.
- **O3b** `:546` naming the run-level serial remainder = **0** (target 1).
- **O3c** no slot filling of the nested block is both self-consistent and correct on example 5: `{span_base}` comes from `:505` which carries `+ integration({n})` (24), while `:534` decomposes without it (`max(12, 8)` = 12) — so the block must either print `= 16` after a decomposition yielding 12, or print 12 and render `g = 24 − 12 = 12` against the true 8.

Frozen sites confirmed present at count 1 pre-edit: `:314`'s `max(10, 5 + 6)` = 11 micro-example, `:459`'s in-document oracle, `:505`'s flat-block `Estimated speedup:` line, `:535`'s `g` line. `:533`'s `span({lane})` string counts **2** in `SKILL.md` (the print-block line and its quotation in the `:544` prose) — expected, and pinned at 2.

### 2026-08-19T11:00:02Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task (Phase 0, oracle capture).

### 2026-08-19T10:51:59Z | ARCHITECT

Plan `FIX-20260819T105159Z-3cd7` created. Type: fix. Tasks: 39.

Derived from `CR-20260819T104419Z-fc4f` (REQUEST_CHANGES on `FEAT-20260819T101153Z-e883`). Each Must Fix became an oracle-first task pair: MF-1 → Phase 1 (`config.md:309` / `:316`), MF-3 → Phase 2 (`SKILL.md:534` / `:546`), MF-2 → Phase 3 (`config.md:234` + ADR-0017), sequenced so MF-2's corrected text describes the site census as it stands after MF-1 and MF-3 land. Should Fix rulings: SF-1 **deferred** (wholesale merge destroys enumerated load-bearing content; optional scoped task pair emitted), SF-2 **accepted as an append** (record the numeral-count convention; the AC-20 verdict needs no correction).

No figure moves; re-proved by both independent checks. `prime-agent/skills/**` regenerated only. Census 3 / 3 / 2 / 1 / 1. ADR-0016 unamended.

Status: PLANNED. Ready for coder.
