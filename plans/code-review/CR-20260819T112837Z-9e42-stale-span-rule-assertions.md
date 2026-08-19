---
id: CR-20260819T112837Z-9e42
plan: FIX-20260819T105159Z-3cd7
title: Review of Correct three stale span-rule assertions (cycle 2)
status: REQUEST_CHANGES
created_at: 2026-08-19T11:28:37Z
reviewer: reviewer-agent
cycle: 1
must_fix_count: 2
should_fix_count: 3
---

**Related:** [FIX-20260819T105159Z-3cd7](./FIX-20260819T105159Z-3cd7-stale-span-rule-assertions.md) · [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md) · [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md) · [CR-20260819T104419Z-fc4f](./CR-20260819T104419Z-fc4f-one-span-rule-slice-set.md) · [TEST-20260819T111853Z-17d4](../test/TEST-20260819T111853Z-17d4-stale-span-rule-assertions.md)

## Summary

Reviewed the whole change set against base `d297e6c` — the parent `FEAT-20260819T101153Z-e883` plus this `FIX` cycle. Docs-only; no executable path exists (`parallelism` is `off`, `full` with `k >= 2` unreachable), so no behavioural test is asked for and the tester's `coverage inapplicable` reading stands.

**MF-1 and MF-3 of the cycle-1 CR are genuinely closed.** Spot-checked rather than re-derived exhaustively, and the check that mattered holds: `config.md:309`'s new fence `max(second_largest_span, span(L after the split)) + tasks(i(run))` is correct as a **span**, not merely as a delta that cancels — applying `:227`'s rule to the post-adoption lane set of worked example 5 gives `max(8, 12, 6) + 4` = **16**, exactly what the fence computes, and the cross-read now yields `g` = `24 − 16` = **8** against the printed 8. `SKILL.md:534` carries `+ integration({n})`, so the nested block's decomposition equals its own result (`max(12, 8) + integration(4) = 16`, then `g = 24 − 16 = 8`). Every pinned constraint I re-ran holds: census 3 / 3 / 2 / 1, `min(S` = 0, 31 headings, ADR-0016 `11 +` / `0 −` and `Accepted`, ADR-0012/0013/0014 and `templates/architect.md` clean, `--check` exit 0.

**MF-2 is not closed, and this cycle's own MF-1 fix is why.** Both Must-Fix-grade findings the tester routed are upheld on independent verification of the shipped text. **REQUEST_CHANGES**, 2 Must Fix — both text-only, both moving no figure.

## Acceptance Criteria Check

`FIX-20260819T105159Z-3cd7` (24 criteria). Parent `FEAT` criteria re-checked only where this cycle touched them.

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `:316` (now `:318`) no longer re-expands `span_base` | ✅ | By-name reference to *The baseline*; re-expansion clause count 0. |
| 2 | `:309` fence carries the serial remainder + cancels-in-`g` clause | ✅ | Fence and the run-constant paragraph at `:314` both present and correct. **But see MF-1** — satisfying this AC created the site that falsifies AC-9. |
| 3 | `:314` (now `:316`) sub-lane micro-example byte-identical | ✅ | `max(10, 5 + 6)` = 11 unchanged. |
| 4 | Cross-read derivation fixed, 12 → 8 recorded | ✅ | Independently reproduced. |
| 5 | `SKILL.md:534` carries `+ integration({n})` | ✅ | Verified in source and generated tree. **But see MF-2** — this AC and AC-8 are mutually inconsistent. |
| 6 | Nested block self-consistent and correct on example 5 | ✅ | Filled-slot walkthrough reproduces `= 16` then `g = 8`. |
| 7 | `:546` extended by one pointing clause | ✅ | Micro-example and `span(L)`/`span_max` warning survive. |
| 8 | Every other Step 2p.2 line byte-identical, incl. the two-integration-slots paragraph | ⚠️ | Literally met — `git diff` is 2 + / 2 −. But the AC is **wrong to require it**: AC-5 invalidates that paragraph. See MF-2. |
| 9 | `config.md:234`'s claim scoped, naming "the only other place the shape appears" | ❌ | Scoped, but the replacement enumeration is **false in the shipped tree**. See MF-1. |
| 10 | ADR-0017 Consequence corrected to the bounded form | ❌ | Bounded, but reproduces the same false enumeration into an **Accepted** ADR (`:189`–`:195`). See MF-1. |
| 11 | ADR-0017 `Skills affected` corrected | ✅ | `:5` records the one amended `SKILL.md` site and why; `templates/architect.md` still recorded unamended and is. |
| 12 | ADR-0017 *What stands* corrected (flat-only §5 scope) | ✅ | `:152`–`:158`, quoting §5's own heading. |
| 13 | ADR-0016 unamended, `Accepted`, pure append | ✅ | `11 +`, `0 −`; `- **Status:** Accepted` on line 3. |
| 14 | No figure moves anywhere | ✅ | Tester: 448/448 numeral tokens identical, one line differing region-wide (the parent's permitted rewording). Spot-checked example 5. |
| 15 | `grep 'min(S' references/config.md` = 0 | ✅ | 0. |
| 16 | No heading renamed / removed / added / re-levelled | ✅ | 31 headings in `config.md`. |
| 17 | Cross-reference targets resolve (10 + 2) | ✅ | `:318` → *The baseline*; `:546` → *The makespan model*. |
| 18 | Anchor + quote-fidelity census 3 / 3 / 2 / 1 / 1 | ✅ | Re-run: 3 / 3 / 2 / 1; overlay anchor count 1 per tester. |
| 19 | ADR-0012/0013/0014 + `templates/architect.md` unamended | ✅ | Empty `git diff --stat`. |
| 20 | Distribution regenerated, never hand-edited | ✅ | `--check` exit 0; both fixes present in `prime-agent/**`. |
| 21 | No-regression floor (225 / 0, `--check` 0, `prime-agent` test 0) | ✅ | `--check` re-run here at exit 0; other two per tester. |
| 22 | SF-1 ruling recorded (DEFER, content enumerated) | ✅ | Progress Log Phase 4; upheld independently by the tester and by me. |
| 23 | SF-2 recorded as an append to the parent `.progress.md` | ✅ | Pure append; `:49` / `:122` byte-identical. |
| 24 | No behavioural/executable test emitted, and the plan says so | ✅ | Correct call. No coverage habit was satisfied with an invented test. |

Parent `FEAT` AC-2 ("`span_max` … stated as **the rule applied to a named slice set**, not as a re-expanded `max`-plus-`tasks(integration)` formula") is now in tension with this plan's AC-2, which required exactly that re-expansion at `:309`. The re-expansion is the **right** call — cycle-1 MF-1 proved the bare form there is wrong — so the resolution is on the claim side, not the `:309` side. That is MF-1 below.

## Must Fix (Blockers)

### MF-1 — MF-2's replacement enumeration is false in the shipped tree, falsified by this cycle's own MF-1 fix, and reproduced into an Accepted ADR

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:234`; `docs/adr/0017-one-span-rule-over-any-slice-set.md:189`–`:195`; collateral at `references/config.md:208`

**Problem**: The tester's F1 is upheld in full, and one part of it is sharper than reported.

`config.md:234` now reads:

> The shape is still written out summand by summand in **two** kinds of place, neither of them a normative statement of it: `SKILL.md` → Step 2p.2's two **print blocks** … and the sub-lane micro-examples that illustrate the rule, here under *Marginal-gain rule*. **Those are the only other places the shape appears** …

Two sites falsify it:

1. **`config.md:309`** — `max(second_largest_span, span(L after the split)) + tasks(i(run))`. Run-level, symbolic, in a fenced **normative** formula under *Marginal-gain rule*. It is neither a print block nor a sub-lane micro-example. The claim's own operational test settles it: reprice the serial remainder and `:309` **must be edited by hand, in agreement** — the exact failure mode the "one-site edit of the normative arithmetic" bound denies. And this site was **created by AC-2 of this same plan, one phase before AC-9 wrote the enumeration.**

2. **`SKILL.md:546`** — prose in neither named category. Its pre-existing *"its concurrent sub-lanes' max plus its serialized integration sub-lane"* is the shape summand by summand, and the clause **this fix added** — *"The run-level term carries the top-level integration lane after the `max`, exactly as `span_base` does"* — restates the shape's structure at run level inside a sentence that declares "is not restated here."

The sharper point: the **preceding sentence in the same paragraph** is falsified too. `:234` opens *"Every span quantity below is this rule applied to a named slice set, and each is written that way rather than re-expanded into a `max` and a `+ tasks(…)` of its own: `span(L)` at either level, **`span_max`**, and the viable baseline's `span_base`."* `:309` **is** a post-adoption `span_max`, re-expanded into precisely a `max` and a `+ tasks(…)` — `:314` says so in terms ("That value is a `span_max`"). So the paragraph contradicts itself, not merely the tree.

The same enumeration is reproduced verbatim in **ADR-0017's Consequences** (`:189`–`:195`), an `Accepted` ADR — the durable, more dangerous home, and precisely the risk this plan's own Technical Notes named for MF-2.

**Collateral**: `config.md:208` (pre-existing, untouched) — *"`SKILL.md` → Step 2p applies these rules; **it does not restate them**"* — now sits 26 lines from `:234`'s *"which is why those blocks **restate** rather than reference."* The prior cycle flagged `:208` as over-reaching; this cycle put an explicit denial of it into the same document. Both cannot stand.

**On the recurrence.** This is the second consecutive cycle in which a claim about the absence of duplication was itself inaccurate, and the orchestrator is right to ask whether the answer is a narrower claim, a different kind of claim, or none. It is **a different kind of claim**. A closed census — "those are the only other places" — is self-invalidating by construction: it must be re-audited against the whole document on every edit that touches the shape, which is the very maintenance burden ADR-0017 claims to have retired. Enumerating harder will fail a third time. Narrowing to "stated normatively exactly once" also fails, because `:309` writes it out normatively today.

**Fix**: Do **not** touch `:309` — MF-1 of cycle 1 proved the expanded form is required there. Fix the claims:

1. **`config.md:234`** — replace the closed enumeration with an open, self-maintaining statement of the same achievement. Something of this shape:

   > Writing the shape once is what makes pricing an integration slice a **one-site edit of the definition**: `span(L)`, `span_max`, and the viable baseline's `span_base` are each named applications of the rule and follow it automatically. Sites that write the shape out are **applications, illustrations, or displays of the rule, never independent definitions of it** — the post-adoption `span_max` fence under *Marginal-gain rule* below, the sub-lane micro-examples beside it, and `SKILL.md` → Step 2p.2's print blocks (a display decision recorded in ADR-0016 §5). A change to how a serial remainder is charged edits the rule here, and must then be carried by hand into every site that writes it out.

   Note what this buys: it states the bound, names the sites known today **without closing the list**, and stays true when the next site appears.

2. **ADR-0017 Consequences (`:189`–`:195`)** — mirror the same bounded, open form. Delete "the shape survives expanded at the display sites … and at the sub-lane micro-examples" as a complete account; it must additionally name the normative post-adoption `span_max` fence, or stop enumerating.

3. **Reconcile `:208` with `:234`.** `:208`'s "it does not restate them" is false for the print blocks and now explicitly denied 26 lines later. Narrow `:208` to what it means — Step 2p **applies** these rules and is not their normative home; where it displays the shape expanded, that is ADR-0016 §5's legibility decision and not a second definition.

No figure moves. Three edits, all prose.

---

### MF-2 — `SKILL.md:544`'s "two integration slots" is now a false count *and* a false source, with a reachable wrong-number consequence

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:544` (paragraph); hazard at `:533`–`:534`

**Problem**: The coder's ruling that "nothing that paragraph asserts became false" does **not** hold. The tester overturned it correctly, and I uphold the reversal on the shipped text.

`:544` opens **"The two integration slots are populated from the digest's declared `integration` field, never left as literal placeholders"** and then names them explicitly — it is a closed enumeration, not a loose plural. After AC-5 the nested block carries **three**:

| Slot | Line | Fed from |
| --- | --- | --- |
| `{, + integration sub-lane {n}}` | `:531` | the critical leaf's own lane's declared field |
| `span({lane}) … + integration({n})` | `:533` | the candidate split's declared field |
| `span_max … + integration({n})` | `:534` **(new)** | the **lane-level** field — the run's top-level integration lane |

So two assertions became false: the **count**, and the **source** — the third slot is not from the digest split's `integration` field, it is one declaration level up.

**The hazard is the one this paragraph exists to prevent, at its most confusable instance.** `:533` and `:534` are **adjacent lines carrying the character-identical token `+ integration({n})` drawn from different declaration levels** — on worked example 5 they fill to `integration(0)` and `integration(4)`. `:544`'s guard clause ("never copied from the first") covers the `Nested plan:` slot and leaves the new, far more copyable pair uncovered. An agent that copies `:533` into `:534` prints `span_max = max(12, 8) + integration(0) = 12` and then `g = 24 − 12 = 12` — **the exact defect this fix cycle was convened to remove**, reproduced inside the print block.

`:546`'s new clause does state the correct source and mitigates the hazard, but does not repair it: `:544` is where a template-filler looks for slot provenance, and it now under-counts and mis-sources.

Severity is Must Fix on the cycle-1 CR's own criterion — a claim false in the shipped tree — and unlike MF-1 it has a reachable wrong-number consequence.

**On the classification** — the tester's ruling that this is a **plan defect, not a coder defect, is upheld.** Plan AC-5 adds the third slot while AC-8 pins "the two-integration-slots paragraph" byte-identical, and the Phase 2 task list names that paragraph explicitly. The plan is internally inconsistent, and the coder correctly declined to edit against an explicit AC and flagged instead. That is the right behaviour under the plan contract and should not be counted against the coder in any cycle accounting. The architect owns this: the next plan must drop AC-8's pin on that paragraph before AC-5's analogue can be satisfied coherently.

**Fix**: Amend `:544` to three slots and name the third's source and its copy hazard. One sentence, no figure moves — e.g.:

> **The three integration slots are each populated from a declared `integration` field, never left as literal placeholders** … and the `span_max` line's `integration({n})` is read from the **lane-level** declared field — the run's top-level integration lane, the one the `Integration lane:` line above reports — **never copied from the `span({lane})` line directly above it**, which reads the candidate split's own field. The two lines print the identical token from different declarations and will differ whenever the run declares a top-level lane.

---

## Should Fix (Warnings)

### SF-1 — `second_largest_span` is undefined, and the naive reading double-charges `i(run)`

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:309`

**Problem**: Confirmed — `second_largest_span` occurs exactly once in the document and is defined nowhere. The correct reading (the max of `span(L)` over the **other non-integration** lanes) is pinned only indirectly, by `:312`'s "the span rule … applied to the post-adoption lane set" plus `:227`'s "non-integration members". A reader ranking **all** lanes gets a wrong number whenever `X` ranks second: on `{backend 20, frontend 12, admin 6}` with `wiring = 13`, the naive read gives `max(13, 8) + 13` = 26 against a true `max(8, 12, 6) + 13` = 25 — the term charged twice.

Pre-existing (the token predates this cycle) and unreachable in this repo, which is why it is not blocking. The aggravating factor is that this cycle made the term **load-bearing** by attaching the serial remainder to it.

**Fix**: One parenthetical — `max(second_largest_span` **(over the non-integration lanes)**`, span(L after the split)) + tasks(i(run))`. If the architect is opening `:309`'s neighbourhood for MF-1 anyway, sweep this into the same edit rather than deferring it a third time.

---

### SF-2 — the `:243` / `:246` blockquote duplication: DEFER upheld

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:243`, `:246`

**Problem**: Carried forward from cycle 1's SF-1. The duplication is real and now trebled by `:232`'s generic statement, but a wholesale merge still deletes the Step 3s quote-fidelity anchor (pinned at exactly 1), both ADR attributions, the Step 3j/3L citations, and the counts-in-full scope limit.

**Fix**: No change this cycle. Deferring while three (now two more) Must Fix items move prose in the same file was correct and remains correct. If ever acted on, scope strictly to the shared general-argument clause. Independently re-assessed by both the tester and this review; the ruling is unchanged.

---

### SF-3 — a baseline-unqualified byte-identity figure in the session record

**File**: `plans/code-review/FIX-20260819T105159Z-3cd7.progress.md:13` (and the Phase 5 log entry)

**Problem**: The claim *"all five bodies byte-identical, stronger than the parent's four of five"* **conflates two baselines**. It is 5/5 against the pre-**fix** tree (this cycle touched no worked-example line) but still 4/5 against HEAD, the parent's own baseline. Neither is "stronger"; they measure different trees. A reader comparing it to the parent's entry two files away concludes the fix restored a line it never touched.

The durable artifact is **correct** — ADR-0017 `:176` records "four of the five bodies byte-identical" against the right baseline — so only the session summary drifted. Notable because it is the same defect class SF-2 of cycle 1 was raised for (a figure recorded without its convention), recurring in the very entry written to close it.

**Fix**: No rewrite — the progress log is append-only and the correction is now on record in `TEST-20260819T111853Z-17d4` §4 and here. The forward-looking fix is the discipline, not the file: any byte-identity or numeral-count figure entering a progress log states its baseline in the same sentence.

---

## Notes for the next cycle

- **Test quality.** The tester's self-audit is correct and is the most useful finding of the cycle: its own O2 check was asserted green without a census that included `config.md:309` — the change's own output from one phase earlier. An oracle that excludes what the same change produced cannot detect a claim the change falsified, which is exactly how MF-1 here shipped. The next plan's census task must be phrased to enumerate the **post-edit tree**, not the pre-edit site list.
- **Generated tree.** `prime-agent/skills/**` was reviewed only as build output. `--check` exits 0 and both fixes are present in the distributed copies; both defects above will propagate on the next regeneration and must be fixed at source, never in `prime-agent/`.
- **No test asked for.** Correct throughout: no executable path exists for this surface. Coverage is inapplicable, not below floor.

## Verdict

**Status**: REQUEST_CHANGES

MF-1 and MF-3 of the prior cycle are closed and verified, but the fix for MF-2 left the defect open — its replacement enumeration is falsified by the change's own MF-1 output and is reproduced into an Accepted ADR — and `SKILL.md:544`'s slot guard, pinned byte-identical by an AC that contradicts the AC adding the slot, now under-counts and mis-sources at the one place a mis-fill reprints `g = 12`.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260819T112837Z-9e42-stale-span-rule-assertions.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair. Two structural instructions for that plan: (a) MF-1's fix belongs on the **claim**, never on `config.md:309`, and must replace the closed enumeration with an open form rather than extending it; (b) the plan must **drop** the byte-identical pin on `SKILL.md`'s two-integration-slots paragraph — the previous plan's AC-5/AC-8 pair is unsatisfiable as written, and that inconsistency, not the coder, is what left MF-2 open.
