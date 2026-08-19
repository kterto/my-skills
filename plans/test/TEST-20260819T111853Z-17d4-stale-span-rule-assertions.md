---
id: TEST-20260819T111853Z-17d4
plan: FIX-20260819T105159Z-3cd7
title: Test Report — Correct three stale span-rule assertions (CR-20260819T104419Z-fc4f)
status: PASS
created_at: 2026-08-19T11:18:53Z
cycle: 0
---

**Related:** [FIX-20260819T105159Z-3cd7](../code-review/FIX-20260819T105159Z-3cd7-stale-span-rule-assertions.md)

## Summary

Fix cycle for the three Must Fix findings of `CR-20260819T104419Z-fc4f`. Docs-only; no executable path exists for this surface and none can be written (`parallelism` is `off` here, `full` with `k >= 2` unreachable). Coverage is **inapplicable, not below floor**; verification is arithmetic and structural, per `PROJECT-CONTEXT.md` → *Test tooling*.

**Two of the three Must Fix findings (MF-1, MF-3) originated as this tester's own F1/F2.** They were therefore re-derived from the shipped text rather than confirmed against the prior report's reasoning.

**MF-1 and MF-3 are genuinely closed.** The cross-read that produced `g = 24 − 12 = 12` now produces `g = 24 − 16 = 8`; the new `:309` form is correct as a **span**, not merely as a delta that happens to cancel; the nested print block's `span_max` decomposition now equals its own stated result on the `X > 0` example. All five worked examples re-derive by hand from the corrected text with every printed figure reproduced, and the numeral sequence is token-identical (448/448 across the five subsections).

**MF-2 is not closed.** The claim was scoped rather than deleted, as the plan required — but the *replacement* enumeration is itself false in the shipped tree, and one of the sites falsifying it was created by MF-1's own fix earlier in the same cycle. This is the finding that existed because a claim was false; an inaccurate replacement claim is the same defect again. Routed as **F1 (Must-Fix-grade)**.

**The coder's flagged `SKILL.md:544` judgement does not hold.** Ruled explicitly in §*Ruling on the coder's flagged item* below; routed as **F2 (Must-Fix-grade)**, with the note that the coder was constrained by the plan's own AC-8 and was right to flag rather than silently edit.

All three no-regression floors green. Nothing committed or pushed.

## Flows Triaged

Skill behaviours here are prose, not executable flows. Criticality scored as user impact × breakage likelihood × not-covered-by-review.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| MF-1 cross-read closure (`span_base` from *The baseline* × post-split term from *Marginal-gain rule*) | **High** | **Verified by independent hand derivation** | This is the defect the fix exists for, and it is my own prior finding — the coder's arithmetic is not evidence for it. |
| The new `:309` form is correct as a **span**, not only as a delta | **High** | **Verified against the rule at `:227`** | A form that cancels correctly in `g` while being wrong as a `span_max` is exactly the defect `:314` now warns about; the fix must not reproduce it. |
| MF-3 nested-block filling when `X > 0` (`{span_base}` and `{span_max}` on the same footing) | **High** | **Verified by filled-slot walkthrough on example 5** | The CR's charge was that no filling was both self-consistent and correct. Must be re-checked against the shipped template, not the plan's promise. |
| MF-2's replacement claim is TRUE in the shipped tree | **High** | **Verified by an independent site census** | A false claim is the whole of MF-2. A replacement claim gets the same audit as the original. |
| All five worked examples re-derive; no figure moved | **High** | **Full hand re-derivation + mechanical numeral diff** | The fix edits the very prose the examples are checked against; the prior cycle's green does not carry over. |
| `SKILL.md:544`'s "two integration slots" paragraph after a third slot was added | **High** | **Ruled on merits** (coder raised it) | The paragraph's job is preventing a slot mis-fill; the fix created a new, more-confusable one. |
| Pinned structural constraints (`min(S`, headings, anchor census, ADR immutability, append-only progress) | **Medium** | **Verified mechanically** | `SKILL.md` is modified for the first time in this work stream, so the anchor census is load-bearing rather than precautionary. |
| Distribution parity + no-regression floors | **Medium** | **Run as a floor** | Unrelated surface; a floor, not evidence about this change. |
| e2e for the `full` parallel gate | — | **EXCLUDED** | Unreachable. `parallelism` is `off` here; `full` with `k >= 2` never executes. An e2e test would assert on a code path that cannot run. |
| Unit/integration tests for `config.md` / `SKILL.md` prose | — | **EXCLUDED** | Normative markdown has no executable surface. `clean-code-gates` is the repo's only JS island and is explicitly not to be run against doc skills. |

## E2E Tests Added

**None, and none is possible.** No test file was created or modified; no production source was touched. Justified above, in the plan's Technical Notes, and in ADR-0017's Consequences. No behavioural test was invented to satisfy a coverage habit.

## Coverage

**Inapplicable — not measured, not below floor.** There is no coverage command for this surface. The 70% floor does not bind on markdown with no executable path.

No-regression floors (unrelated surface):

| Floor | Expected | Observed | Result |
| --- | --- | --- | --- |
| `cd plugins/my-skills/skills/clean-code-gates && npm test` | 225 passing | `# pass 225 / # fail 0` | PASS |
| `node scripts/build-prime-agent.mjs --check` | exit 0 | `prime-agent/skills is up to date (11 skills, 154 files)`, exit 0 | PASS |
| `cd prime-agent && npm test` | exit 0 | `install ok` + `parity ok` | PASS |

`prime-agent/skills/**` was not hand-edited: `--check` exits 0, and the only lines differing from the plugin source are the overlay's own `fileReplacements` (1 line in `references/config.md` — the ADR-0001 link; the description line + the Prime Agent protocol block in `SKILL.md`).

## Verification performed

### 1. MF-1 — the cross-read is genuinely closed, and the new form is a correct span — PASS

Taking `span_base` from *The baseline* and the post-split term from *Marginal-gain rule* — the realistic pairing, and the one `SKILL.md:524` steers a reader into — on worked example 5 (`{backend: 20, frontend: 12, admin: 6}` + `wiring: 4`, `X = 4`):

| | source | value | `g` |
| --- | --- | --- | --- |
| **before** | `:259` `span_base` = 24; old `:309` = `max(12, 8)` = 12 | 24, 12 | **12** ✗ (printed 8) |
| **after** | `:259` `span_base` = 24; new `:309` = `max(12, 8) + 4` = 16 | 24, 16 | **8** ✓ |

Independently derived, not read off the coder's record.

**Correct as a SPAN, not merely as a cancelling delta.** Applying the rule at `:227` to the post-adoption lane set `{backend(split, span 8), frontend 12, admin 6}` with `i(run) = wiring(4)`: `max(8, 12, 6) + 4` = **16**. `:309`'s `max(second_largest_span, span(L after the split)) + tasks(i(run))` computes exactly that quantity, so the fence now *is* the span rule applied to a named slice set rather than a shorthand that happens to cancel. `:314` states the delta-vs-span distinction explicitly and correctly ("Write the delta by subtracting two spans, never by subtracting a span from a bare `max`"), which is the sentence that makes the shorter form unrecoverable as a future shortcut.

The `:316` site's re-expansion is gone: `grep -c 'max\` over lanes of \`tasks(L)\` under a viable flat verdict'` = **0**, and `:318` now takes `span_base` from *The baseline* **by name**. `:316`'s sub-lane micro-example (`max(10, 5 + 6)` = 11 vs `max(10, 5)` = 10) is byte-identical to HEAD, as AC-3 required.

`:461` *What this example is actually pinning* — the in-document oracle MF-1 was checked against — is byte-identical to HEAD. It was not edited to agree with the fix.

### 2. MF-3 — the nested print block now has a correct filling when `X > 0` — PASS

`SKILL.md:534` gained `+ integration({n})`; `git diff` on the file is exactly **2 + / 2 −**, confirmed.

Filled-slot walkthrough, worked example 5 (`backend` split into `{8, 8}` declaring `integration: none`; run declares `wiring = 4`):

```
Estimated speedup: 42 / span_base(max(concurrent 20,12,6) + integration(4) = 24) = 1.75×    :505
  span(backend) = max(concurrent 8, 8) + integration(0) = 8                                 :533
  span_max      = max(second-largest span 12, span(backend) 8) + integration(4) = 16        :534
  g    = 24 − 16 = 8                                                                        :535
```

`{span_base}` and `{span_max}` are now on the same footing: both are run-level spans over the same lane set with the same declared `i(run)`, and both show the serial remainder as a separate summand. Each printed decomposition equals its own stated result, and `:535` renders the true `g`. The asymmetry the CR named is removed.

`:546` gained the pointing sentence. The `span(L)` vs `span_max` distinction, the 16 → `{5, 5}` + integration 6 micro-example, and the "printing one line labelled `span_max` that actually holds a lane span" warning all survive unchanged.

### 3. All five worked examples re-derive by hand from the corrected text — PASS

Every figure recomputed from `:227` (the rule), `:239` (`span(L)`), `:249` (`span_max`), `:259` (`span_base`), `:309`/`:312`/`:318` (the corrected marginal-gain text). None read off the old formulas.

| Example | Derivations checked | Result |
| --- | --- | --- |
| gate verdict / ladder figure | `span_base` 12, `span(L)` 6, post-split `span_max` `max(6,6)+0` = 6, overhead 4→8, `M_flat` 16, `M_nested` 14, `g` 6, `c` 4 | all match |
| one lane carries all the work | `T` 24, `span(mobile)` `max(8,8,8)+0` = 8, `span_max` 8, overhead 8.5, `M_nested` 16.5, `g` = `T − (S+X)` = 16, `c` 8.5, `8/24` = 33%; `{20,4}` branch `g` 4 → rejected | all match |
| a split carrying an integration sub-lane | `span(mobile)` `5 + 6` = 11, `span_base` = `T` = 24, `g` 13, overhead 10, `M_nested` 21, margin 3, 12.5%; pre-field branch `span_max` 5 / `g` 19 / error 6; aggregate `8 ≤ 24` | all match |
| `k = 2` | `T` 38, `24/38` = 63%, `span_base` 24, `M_flat` 28, `span(A)` 8, `span_max` 24→10→8, `g₁` 14, `c₁` 4.5, `g₂` 2, `c₂` 0.5, superseded `M_nested` 19, both reconciliations (9−4 = 5 = 4.5+0.5; 24→8 = 16 = 14+2), `8/38` = 21%, 6 ≤ 6 | all match |
| a declared top-level integration lane | `T` 42, `20/42` = 48%, `M` 20, `span_base` = `M+X` = 24, `M_flat` 29, `span(backend)` 8, **post-adoption `span_max` = `max(12,8)+4` = 16**, `M_nested` 25.5, `g` 8, identity `M−S` = 20−12 = 8, `c` 4.5, reconciliation 3.5, `11/12` = 92%, `12/42` = 29%, uncorrected 25 / 21.5 | all match |

**Every printed figure reproduces from the corrected text.** No derivation disagreed with any printed number, so no BLOCKED route arose.

### 4. Mechanical no-numeral-drift — PASS, with a characterisation correction

Extracting the whole five-subsection worked-example region (`#### Worked example …` through the line before *Greedy, recomputed adoption*), HEAD vs working tree:

- **448 numeral tokens each, `cmp`-identical sequences.**
- **Exactly one line differs across the whole region**, and it is the parent cycle's permitted cancellation-identity rewording in example 5. Its arithmetic (`24 − 16` = 8; `M − S` = `20 − 12` = 8) is untouched.

**The coder's characterisation needs qualifying.** The claim relayed to the orchestrator — *all five bodies are now byte-identical to pre-edit, stronger than the parent plan's four of five* — conflates two baselines:

| Baseline | Byte-identical bodies | Meaning |
| --- | --- | --- |
| pre-**fix** edit (start of this cycle) | **5 of 5** ✓ | this cycle touched no worked-example line at all |
| HEAD (pre-**FEAT**, the parent's baseline) | **4 of 5** | example 5's cancellation-identity line still differs |

Both statements are true; neither is "stronger" than the other, because they are measured against different trees. Against the parent plan's own baseline the figure is still four of five, and ADR-0017's Consequences correctly records *"four of the five bodies byte-identical"* — so the durable artifact is right and only the session summary drifted. The unqualified *"additionally all five worked-example bodies are byte-identical"* at `FIX-…-3cd7.progress.md:13` sits in the record two files away from the parent's *"four of the five bodies are additionally byte-identical to their pre-edit sha256"*, and a reader comparing them concludes the fix restored a line it never touched. This is the same defect class SF-2 was raised for — an oracle figure recorded without its convention — recurring in the entry written to close it. Noted for the record; it moves no figure.

### 5. Pinned constraints — all held

| Constraint | Expected | Observed | Result |
| --- | --- | --- | --- |
| `grep -c 'min(S' references/config.md` | 0 | **0** | PASS |
| Section headings frozen | 31, byte-identical | **31, `cmp` exit 0** vs HEAD | PASS |
| `':(exclude).claude'` in `SKILL.md` | 3 | **3** | PASS |
| `the call shape from *How to spawn a subagent*` in `SKILL.md` | 3 | **3** | PASS |
| `through a **single sequential coder invocation**` in `SKILL.md` | 2 | **2** | PASS |
| its unbolded quotation in `config.md` | 1 | **1**, wording still matching | PASS |
| overlay `find` strings occurring in `config.md` | 1 | **1** of 24 (the ADR-0001 link; 22 target `SKILL.md`) | PASS |
| ADR-0016 `Accepted`, pure append | `11 +`, `0 −` | **`11 +`, `0 −`**, `- **Status:** Accepted` on line 3 | PASS |
| ADR-0012 / 0013 / 0014, `templates/architect.md` | unamended | **clean** (empty `git diff --stat`) | PASS |
| Cross-references introduced by this plan | resolve | `:318` → *The baseline* (bold label, `:255`) ✓; `:546` → *The makespan model* (`#### `, `:210`) ✓ | PASS |
| Parent `.progress.md` | append-only | new entry at EOF (`:206`), matching the append position TESTER/REVIEWER used; the `147`/`131` figures at `:49` and `:122` intact | PASS |
| Change set | confined | `config.md`, `SKILL.md`, ADR-0016 (append), ADR-0017 (new), `prime-agent/**` (generated), plan artifacts. **Nothing committed or pushed** | PASS |

The anchor census was load-bearing this cycle rather than precautionary — `SKILL.md` is modified for the first time in this work stream — and it holds at **3 / 3 / 2 / 1 / 1** with zero drift.

## Ruling on the coder's flagged item

> **Flag raised:** `SKILL.md:543`'s "two integration slots" paragraph now enumerates two of three slots. The coder judged nothing that paragraph asserts became false, noted the plan pins it byte-identical, left it, and flagged it as a candidate Should Fix.

**The judgement does not hold.** The paragraph (shipped at `:544`) opens:

> **The two integration slots are populated from the digest's declared `integration` field, never left as literal placeholders.**

After the MF-3 edit the nested block carries **three** integration slots, and the new one is fed from a **different declaration**:

| Slot | Line | Fed from |
| --- | --- | --- |
| `{, + integration sub-lane {n}}` | `:531` | the critical leaf's own lane's declared field |
| `span({lane}) = … + integration({n})` | `:533` | the candidate split's declared field |
| `span_max = … + integration({n})` | `:534` **(new)** | the **lane-level** declared field — the run's top-level integration lane |

So two assertions became false, not zero: the **count** ("The two integration slots"), and the **source** ("populated from the digest's declared `integration` field" — the third is not from that field, it is one level up). The paragraph then names the two slots explicitly, so it is an enumeration, not a loose plural that a third member quietly joins.

**The hazard is not theoretical, and its failure mode is the one MF-1 removed.** `:533` and `:534` are adjacent lines carrying the *character-identical* token `+ integration({n})` while drawing from different declaration levels. On worked example 5 they fill to `integration(0)` and `integration(4)`. An executing agent that copies the first into the second — the precise mistake `:544`'s "never copied from the first" clause exists to prevent, now uncovered at its most confusable instance — prints `span_max = max(12, 8) + integration(0) = 12` and then `g = 24 − 12 = 12`. That is the stale cross-read this fix cycle was convened to eliminate, reproduced inside the print block.

`:546`'s new sentence does state the correct source, which mitigates the hazard but does not repair `:544`: the guard paragraph is where a template-filler looks for slot provenance, and it now under-counts and mis-sources.

**Severity: Must-Fix-grade, not Should Fix.** It is a claim that is false in the shipped tree, which is exactly the criterion on which the CR made MF-2 blocking; and unlike MF-2 it has a reachable wrong-number consequence.

**The coder is not at fault.** Plan AC-8 pins "the two-integration-slots paragraph" byte-identical while AC-5 adds the third slot — the plan is internally inconsistent, and the coder correctly declined to edit against an explicit AC and raised it instead. This is a plan defect for the architect, not a coder defect.

**Minimal fix:** amend `:544` to *three* slots and name the third's source — e.g. "…and the `span_max` line's `integration({n})` is read from the **lane-level** declared field (the run's top-level integration lane), never copied from the `span({lane})` line above it, which reads the candidate split's own field." One sentence; moves no figure.

## Findings for the reviewer

### F1 — MF-2's replacement claim is still false in the shipped tree (Must-Fix-grade)

MF-2 existed because a claim was false. The claim was scoped rather than deleted, as AC-9/AC-10 required — but the bounded form carries a **closed enumeration** that the shipped tree contradicts. `config.md:234`:

> The shape is still written out summand by summand in **two** kinds of place… `SKILL.md` → Step 2p.2's two **print blocks** … and the sub-lane micro-examples that illustrate the rule, **here under *Marginal-gain rule***. **Those are the only other places the shape appears**, and a change to how a serial remainder is charged must still be carried into them by hand.

The same enumeration is reproduced in ADR-0017's Consequences — an **Accepted** ADR, the more dangerous home, and precisely the risk the plan's own Technical Notes name for MF-2.

Two sites falsify it:

1. **`config.md:309` — created by MF-1's own fix, earlier in this same cycle.**

   ```
   max(second_largest_span, span(L after the split)) + tasks(i(run))
   ```

   This is the shape written out summand by summand, symbolically, at **run** level, in a fenced **normative** formula. It is not a print block, and it is not a "sub-lane micro-example" — it is the normative post-adoption `span_max`, and `:316`'s genuinely-a-micro-example sits in the *same section*, which is what makes the enumeration's "here under *Marginal-gain rule*" read as covering only the latter. Apply the claim's own operational test: if a future change repriced the serial remainder, `:309` **would have to be edited by hand, in agreement**. That is the exact failure mode the "one-site edit of the normative arithmetic" bound denies.

   The internal inconsistency is sharper than the count: this cycle applied *reference-by-name, do not re-expand* at `:318` (AC-1) and *expand fully* at `:309` (AC-2), in the same section, and then wrote an enumeration at `:234` that accounts for only the first.

2. **`SKILL.md:546` — prose, in neither named category.** *"its concurrent sub-lanes' max plus its serialized integration sub-lane"* (pre-existing) is the shape summand by summand, in a paragraph that is not a print block and is not under `config.md`'s *Marginal-gain rule*. The clause **this fix added** — *"The run-level term carries the top-level integration lane after the `max`, exactly as `span_base` does"* — restates the shape's structure at run level while the same sentence declares "that arithmetic … is not restated here."

**Collateral: `config.md:208` and `:234` now contradict each other, 26 lines apart in one document.** `:208` (pre-existing, untouched): *"`SKILL.md` → Step 2p applies these rules; **it does not restate them**."* `:234` (new): the print blocks *"restate rather than reference."* The prior cycle flagged `:208` as merely over-reaching; this cycle put an explicit denial of it into the same file. Whichever way it is resolved, the two sentences cannot both stand.

**Fix is cheap and moves no figure:** extend the enumeration to name the post-adoption `span_max` fence under *Marginal-gain rule* and `SKILL.md`'s `:546` prose, in `config.md:234` and in ADR-0017's Consequences; and reconcile `:208` with `:234`.

### F2 — `SKILL.md:544`'s "two integration slots" is a false count with a reachable wrong-number consequence (Must-Fix-grade)

Ruled in full above. Plan-level defect (AC-5 vs AC-8), not a coder defect.

### F3 — `second_largest_span` is undefined, and the naive reading double-charges `i(run)` (low, pre-existing)

`:309` uses `second_largest_span` without defining it anywhere in the document. The correct reading — the max of `span(L)` over the **other non-integration** lanes — is pinned only indirectly, by `:312`'s "the span rule … applied to the post-adoption lane set" plus `:227`'s "non-integration members". A reader ranking **all** lanes gets the wrong number whenever `X` ranks second: on `{backend 20, frontend 12, admin 6}` with `wiring = 13`, the naive read gives `max(13, 8) + 13` = 26 against a true `max(8, 12, 6) + 13` = 25. Unreachable in this repo and pre-existing (the token predates this cycle), but the fix made the term load-bearing by attaching the serial remainder to it. One parenthetical — "(over the non-integration lanes)" — closes it.

### F4 — the SF-1 DEFER ruling still stands (informational)

Re-assessed independently. The `:243` / `:246` duplication is real and is now trebled by `:232`, but a wholesale merge would still delete the Step 3s quote-fidelity anchor (pinned at exactly 1), both ADR attributions, the Step 3j/3L citations, and the counts-in-full scope limit. Deferring was correct, and deferring again while three Must Fix items move prose in the same file was correct. No change to the prior recommendation: if ever acted on, scope to the shared general-argument clause only.

## Test-Quality Audit

No test files exist for this surface, so there are no assertions to audit for tautology or emptiness. The oracle discipline the plan substituted for TDD (capture expected outputs pre-edit, observe each Must Fix assertion fail, edit, re-assert) was followed in structure — Phase 0 ran first and O1/O2/O3 were recorded failing — and every oracle result was re-run here independently rather than accepted.

Two weaknesses in the coder's own evidence, neither load-bearing:

- **A baseline-unqualified byte-identity claim** (§4). "All five worked-example bodies are byte-identical" is recorded without its baseline, next to a parent-plan entry recording four of five. This is SF-2's own defect class — a figure without its convention — recurring in the entry written to close SF-2.
- **O2 was asserted to pass without an independent census.** The Phase 3 task required re-running the site census and using it "as the factual basis" for the rewrite. The census that was run enumerated `config.md:314`, `SKILL.md:505`/`:533`/`:534`/`:546` — but not `config.md:309`, the site the same coder had created one phase earlier. An oracle that does not include the change's own output cannot detect a claim the change falsified, which is how F1 shipped.

## Verdict

**PASS.**

MF-1 and MF-3 are independently verified closed. The cross-read now yields `g` = 8, the corrected `:309` is a correct **span** and not merely a cancelling delta, the nested print block's decomposition equals its own result on the `X > 0` example, and all five worked examples re-derive by hand from the corrected text with 448/448 numeral tokens identical and exactly one line differing across the whole worked-example region (the parent cycle's permitted rewording). Every pinned constraint held — `min(S` at 0, 31 headings byte-identical, census 3 / 3 / 2 / 1 / 1, ADR-0016 append-only and `Accepted`, ADR-0012/0013/0014 and `templates/architect.md` unamended, the parent `.progress.md` a pure append, the distribution regenerated by script only — and all three no-regression floors are green.

Coverage is **inapplicable** for this surface, not below floor.

**PASS is a statement about the tests, not a recommended review verdict.** Two Must-Fix-grade findings go to the reviewer: **F1**, MF-2's replacement enumeration is still false — falsified in part by MF-1's own output, and reproduced into an Accepted ADR; and **F2**, `SKILL.md:544`'s slot count, whose mis-fill reproduces the exact wrong number this cycle removed. Both are text-only, move no figure, and are one-sentence repairs. F1 in particular means the defect MF-2 named has not been retired, only re-scoped.
