---
id: CR-20260819T121737Z-7abb
plan: FIX-20260819T113512Z-438c
title: Review of Replace the closed span-shape census with an open form and repair the slot guard
status: APPROVED
created_at: 2026-08-19T12:17:37Z
reviewer: reviewer-agent
cycle: 3
must_fix_count: 0
should_fix_count: 3
---

**Related:** [FIX-20260819T113512Z-438c](./FIX-20260819T113512Z-438c-open-span-claim-slot-guard.md) · [CR-20260819T112837Z-9e42](./CR-20260819T112837Z-9e42-stale-span-rule-assertions.md) · [CR-20260819T104419Z-fc4f](./CR-20260819T104419Z-fc4f-one-span-rule-slice-set.md) · [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md) · [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md) · [TEST-20260819T120312Z-5d31](../test/TEST-20260819T120312Z-5d31-open-span-claim-slot-guard.md)

## Summary

Reviewed the whole aggregate change set against base `d297e6c` — the parent FEAT plus both FIX plans — covering `references/config.md`, `SKILL.md`, ADR-0016's append, new ADR-0017, and the regenerated `prime-agent/` distribution. Both of cycle 2's Must Fix findings are genuinely closed, and closed in a structurally different way than their two predecessors: the open claim at `config.md:234` is stated **prescriptively** ("the test to apply to any such site, one standing here today or one added tomorrow"), so a future independent definition is a violation of a standing rule rather than a silent falsification of a stale list — the property neither the closed census nor the count had. The three-slot guard at `SKILL.md:544` is correct and complete; I re-derived worked example 5 by hand and the guard's correct fill (`span_max = max(12, 8) + 4 = 16`, `g = 24 − 16 = 8`) and its blocked mis-fill (`g = 12`) both check out.

One real defect survives, correctly found by the tester: `config.md:208` and `:234` attribute **both** Step 2p.2 print blocks' expanded form to ADR-0016 §5, whose own heading and body reach only the flat block. I verified §5 directly and confirm the over-reach. I rule it **Should Fix, not blocking** — the reasoning is in SF-1, and I do not treat it as a soft call: it is a false citation attached to a correct instruction, in a file that is not the normative owner of that claim, with the accurate scoping already on record three times in Accepted ADR-0017. Verdict: APPROVED, with the residue documented for the next touch of this file.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `:234`'s closed census replaced by an open, self-maintaining statement (bound / named applications / universal classification / examples only / by-hand carrying) | ✅ | All five sub-clauses present at `:234`. The universal classification is stated **prescriptively**, which is the structural fix — see Summary. Sub-clause (d) is the origin of SF-1. |
| 2 | No closed-census construction survives; open marker present | ✅ | All six banned constructions = 0 in `config.md`. Open markers at `:234`: `for example`, `include`, `not a census`, `never an independent definition`. (The two `and nowhere else` / `it does not restate them` hits in `SKILL.md` are at `:464`/`:475`/`:587`/`:630` — unrelated regions, outside the AC's scope.) |
| 3 | Preceding sentence reconciled with `:309` | ✅ | `:234` scopes the never-re-expanded claim to "the **normative definitions** of those quantities, and about those only, not about every line that later writes one of them out". `:309` no longer falsifies it; consistent with `:312`/`:314`. |
| 4 | `:208` narrowed; `it does not restate them` = 0 in `config.md` | ✅ | Count 0 in `config.md`. `:208` now records Step 2p as applying, not owning. Correct in substance; its §5 citation is SF-1. |
| 5 | `:309`'s fence byte-identical | ✅ | `max(second_largest_span, span(L after the split)) + tasks(i(run))` unchanged. The hunk `@@ -298 +312,3 @@` inserts **after** the fence, not inside it. |
| 6 | ADR-0017's Consequences bullet mirrors the open form; no closed enumeration anywhere in the ADR | ✅ | `:196` states the universal classification, names sites "for example", and records the superseded closed enumeration as corrected. |
| 7 | ADR-0017 `:5` true of the post-edit tree; locations named rather than counted | ✅ | Three `SKILL.md` locations named, no count. `templates/architect.md` recorded unamended and is (`md5` unchanged). This line is the model SF-2 cites. |
| 8 | Every other ADR-0017 unamended-claim re-audited against the post-edit tree | ✅ | `:152`–`:158` verified: flat template strings byte-identical, and it correctly states §5 "does **not** cover" the nested block. 31 headings hold. |
| 9 | Byte-identical pin on `:544` dropped; no AC both edits and pins a line | ✅ | AC-9 states the exemption explicitly; AC-15 scopes byte-identity to *every other* line. The prior cycle's unsatisfiable AC-5/AC-8 pair is structurally fixed. |
| 10 | `:544` states three slots, each with its source | ✅ | `Nested plan:` ← critical leaf's own lane; `span({lane})` ← candidate split's own; `span_max` ← **lane-level**. All three named. |
| 11 | `:544` names the copy hazard for the confusable pair | ✅ | States the two adjacent lines print the character-identical `+ integration({n})` from different declaration levels, and that `span_max` is "**never copied from the line directly above it**". |
| 12 | `:544` keeps what it correctly asserted; restates no formula | ✅ | Never-literal-placeholders, declared-`none` → `integration(0)`, *The makespan model* pointer, "this block only displays it". No formula restated. |
| 13 | `grep -c 'The two integration slots are populated'` = 0 | ✅ | 0. |
| 14 | `SKILL.md:546` byte-identical this cycle | ✅ | Unchanged this cycle. Its prior-cycle clause is recorded in ADR-0017 `:5` and is correct as read. |
| 15 | Every other line of Step 2p.2 byte-identical; `SKILL.md` diff confined to `:544` | ✅ | This cycle's `SKILL.md` diff is one line. Aggregate diff vs `d297e6c` is `:534`/`:544`/`:546`, all three recorded in ADR-0017 `:5`. |
| 16 | Filled-slot walkthrough re-recorded on worked example 5; mis-fill recorded, not printed | ✅ | **Independently re-derived**: `span_base = 24`, `span_max = max(12, 8) + 4 = 16`, `g = 8`; mis-fill → `span_max = 12`, `g = 12`. Neither figure appears in `SKILL.md`. |
| 17 | SF-1 ACCEPT — `second_largest_span` defined at `:312` without touching `:309`, no numeral added | ✅ | `:312` defines it over the post-adoption set's **other non-integration lanes** with the `i(run)` double-charge hazard stated. Fence byte-identical; no numeral added. |
| 18 | SF-2 DEFER upheld, content re-enumerated by name | ✅ | Recorded in the Progress Log; `:243`, `:246`, `:232` untouched. |
| 19 | SF-3 NO REWRITE; every figure names its baseline in the same sentence | ✅ | `.progress.md` files append-only; ADR-0017 `:176` untouched. The baseline-naming discipline is visible throughout this cycle's log. |
| 20 | Census enumerates the POST-EDIT tree, every surviving site classified | ✅ | 14 site groups over the regenerated tree, taken after regeneration. This is the criterion that fixed how cycle 2's O2 shipped green. |
| 21 | Census yields zero sites classified as a second normative definition | ✅ | **Independently re-run**: shape sites are `config.md:227` (the rule), `config.md:309` (application, named as one by `:312`), `SKILL.md:505`/`:533`/`:534` (displays). Zero second definitions. |
| 22 | No figure moves; both checks re-run in full | ✅ | **Independently verified on my own extraction convention**: the whole worked-example region is `md5`-identical vs `d297e6c` (507 numerals, `b6a09993…` both sides). Conclusion holds regardless of the convention drift noted in SF-3. |
| 23 | `grep 'min(S'` = 0 | ✅ | 0. |
| 24 | No heading renamed/removed/added/re-levelled — 31 in `config.md` | ✅ | 31 both sides. |
| 25 | Anchor + quote-fidelity census 3 / 3 / 2 / 1 (+1 overlay) | ✅ | Tester verified by parsing all 24 `find` strings; `--check` exit 0 corroborates no anchor drift. |
| 26 | ADR-0016 unamended, `Accepted`, pure append (`11 +`, `0 −`) | ✅ | `git diff --numstat` = `11 0`; `- **Status:** Accepted` on line 3. ADR-0012/0013/0014 and `templates/architect.md` `md5`-identical. |
| 27 | Distribution regenerated, never hand-edited; `--check` exit 0 | ✅ | **Re-run**: "11 skills, 154 files", exit 0. `:208`/`:234`/`:544` byte-identical between source and `prime-agent/` copies — both fixes present by regeneration alone. |
| 28 | Floors: 225 pass / 0 fail, `--check` 0, `prime-agent && npm test` 0 | ✅ | **Re-run**: `# tests 225 / # pass 225 / # fail 0`; `--check` exit 0. |
| 29 | Cross-reference targets resolve | ✅ | Every by-name reference at `:208`, `:234`, `:312`, `SKILL.md:544` and in ADR-0017 resolves against the 31-heading inventory. |
| 30 | No behavioural/executable test emitted, and the plan says so | ✅ | `parallelism` is `off`; `full` with `k >= 2` is unreachable here. Coverage inapplicable, not below floor. Per the review brief, no behavioural test is asked for. |
| 31 | All `.progress.md` files append-only | ✅ | Parent FEAT's and prior FIX's logs not written to at all. |

## Must Fix (Blockers)

None — no blockers found.

The tester routed F1 as Must-Fix-grade and asked me to rule. I verified the underlying fact and confirm it, but rule the finding **Should Fix**; it is recorded in full as SF-1 below, with the reasoning for the downgrade stated rather than assumed.

## Should Fix (Warnings)

### SF-1 — `config.md:208` and `:234` attribute both Step 2p.2 print blocks to ADR-0016 §5, which reaches only the flat block

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:208`, `:234`

**Problem**: The fact is as the tester reports, and I verified §5 directly rather than taking it on report.

`docs/adr/0016-…:86` — heading: *"Step 2p.2's **flat** print block divides by `span_base`"*. Its body speaks only of that block: the `Estimated speedup:` denominator, the new `Integration lane:` line, and `Fixed overhead:` / `Interface points to freeze:` being unchanged. It says nothing about the nested block at `SKILL.md:526`–`:542`.

Both rewritten sentences attribute the plural to it, unscoped:

- `:208` — "where Step 2p writes one of them out expanded rather than referencing it by name — its **two** Step 2p.2 print blocks — that is **ADR-0016 §5's** deliberate legibility decision"
- `:234` — "`SKILL.md` → Step 2p.2's **print blocks** … a display decision recorded in **ADR-0016 §5**, which is why **those blocks** restate rather than reference"

My own census confirms the split: `SKILL.md:505` (flat) is §5's subject; `:533` and `:534` (nested) are not. ADR-0017 makes the same attribution twice and **scopes it in the very next sentence both times** (`:5`: "§5's byte-for-byte guarantee is scoped by its own heading to the **flat** block and does not reach the nested one"; `:152`–`:158`; `:196`). `config.md` never scopes it. The accurate scoping is therefore on record three times in the ADR and zero times in the reference.

Provenance is the plan, not the coder: AC-1(d) instructed "Step 2p.2's print blocks **with their ADR-0016 §5 attribution**", and AC-4 instructed the same for `:208`. The coder executed both faithfully. A plan defect propagated.

**Why this is Should Fix and not Must Fix.** I weighed it against the two predecessors it resembles and it is a materially different and smaller class:

1. **It is a false citation attached to a correct instruction, not a false rule.** Both sentences impose the maintenance obligation on the very blocks they mis-cite: `:208` ends "A change to the arithmetic is made here and carried into those blocks by hand", and `:234` ends "…made here **and then carried by hand into every site that writes the shape out**". The dangerous inference — *the nested block is protected, leave it alone* — is contradicted in the same sentence that carries the bad citation. Cycle-1 MF-3 happened because a **plan's out-of-scope line** pinned the nested block byte-identical on the §5 reading; no such pin exists here, and the opposite instruction does.
2. **The byte-for-byte guarantee lives where it is correctly scoped.** "Byte for byte" appears in ADR-0017 `:152`, which explicitly excludes the nested block. `config.md` claims a *display classification*, not a freeze.
3. **`config.md` is not the normative owner of this claim.** Per PROJECT-CONTEXT, each `references/*.md` owns one concern; `config.md` owns *the arithmetic*. Provenance of display decisions is owned by the ADRs, and there it is right in three places.
4. **It does not decay.** Cycles 1 and 2 failed on self-invalidating constructions — a closed census and a count are guaranteed to go stale as the tree changes. This is a static factual error: wrong today, exactly as wrong tomorrow, no guard needed to keep it correct, one clause to repair.
5. Docs-only, no executable path, no figure moved, all 31 ACs met.

The residual risk is real and I am not dismissing it: a future planner who cites `config.md` rather than ADR-0017 could rebuild the cycle-1 exemption from the premise sitting here ready-made. That is second-order and mitigated by ADR-0017's three scopings, but it is why this is recorded rather than waived.

**Fix** (repair on the next touch of this file — one clause each, and it closes SF-2 at the same time):

At `:208`, name the blocks instead of counting them and attach §5 only to the flat one:

> …where Step 2p writes one of them out expanded rather than referencing it by name — the **flat** print block, whose expanded form is ADR-0016 §5's deliberate legibility decision, and the **nested** block, whose expanded form and post-ADR-0016 correction ADR-0017 records — those are **displays** of the arithmetic defined here, not second definitions of it.

At `:234`, scope the attribution the way ADR-0017 already does:

> …and `SKILL.md` → Step 2p.2's print blocks, where the shape is expanded so the integration slice's contribution is legible on screen — a display decision ADR-0016 §5 records for the **flat** block, its heading scoping it there and its body reaching no further, with the nested block's expanded form recorded by ADR-0017 instead.

---

### SF-2 — `:208` reintroduces a falsifiable count

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:208`

**Problem**: "its **two** Step 2p.2 print blocks" is true today, but it is the same self-invalidating shape that AC-7 removed from ADR-0017 `:5` in this very cycle. A third print block, or a merge of the two, silently falsifies it. `:5`'s repair — locations "**named rather than counted**" — is the model, and it is a repair this change set itself authored one file away.

**Fix**: Covered by the SF-1 rewrite above, which names the flat and nested blocks rather than counting them. The two findings share one repair.

---

### SF-3 — the classification census verifies site membership but not the prose attached to each named site

**File**: process — `FIX-20260819T113512Z-438c` AC-20 / AC-21; carry into the next plan that touches this paragraph

**Problem**: The tester's structural diagnosis is correct, and I confirm it: `:234`'s "not a census of the tree" disclaimer protects the example list's **completeness** but says nothing about the **correctness of the attributions** attached to the named examples. AC-20/AC-21 inherit the same blind spot — they enumerate sites and classify each as definition/application/illustration/display, then check that the classification covers them. Neither step reads the *descriptive clause* the prose hangs on each named site. SF-1 lives in exactly that gap: `SKILL.md:533`/`:534` are correctly classified as displays and correctly covered by the universal rule; only the provenance sentence about them is wrong. This is the third distinct oracle gap in the same paragraph (closed census → open-form soundness → attribution accuracy), and the tester is right that a fourth correction to the same sentence is not the durable answer.

The tester's self-audit surfaced two further items worth carrying, both of which I judge sound: every baseline figure in the prior cycle was self-witnessed against an uncommitted snapshot only the coder observed (repaired this cycle by re-anchoring each to `HEAD` or a prior artifact), and the numeral-extraction convention drifted silently across cycles (448 → 505 → 507). On the second: I re-ran the drift check on my own convention and got 507 with identical `md5` on both sides, so the *conclusion* holds independently of the convention — but a convention that changes without being restated is not an oracle, and should be pinned in the plan that states it.

**Fix**: When a plan asserts a classification census, make the oracle check both halves of each row — that the site is covered by the classification **and** that every factual claim the prose makes *about* that site (its provenance, its governing decision record, its count) is true of the cited source. Concretely, for any sentence citing an ADR section as the recorded decision for a named site, the oracle re-reads that section's heading and body and asserts it reaches the site. And pin the numeral-extraction convention by name and boundary in the plan, so a later cycle's figure is comparable to an earlier one's.

## Verdict

**Status**: APPROVED

All 31 acceptance criteria are met, both cycle-2 Must Fix findings are structurally closed rather than patched, and I independently confirmed the arithmetic is untouched (worked-example region `md5`-identical to `d297e6c`), the fence intact, the census clean of second definitions, the distribution regenerated in sync, and the floors green (225/0, `--check` 0). The one surviving defect is a false ADR citation decorating a correct maintenance instruction, in a file that does not own the claim, with the accurate scoping already recorded three times in Accepted ADR-0017 — recordable, not blocking.

**On converging versus churning — my explicit judgment: this is converging, not churning.** Three signals carry it. Severity falls monotonically: cycle 1 found arithmetic that was actually wrong in normative sites (`:309`, `:316`) plus a defective print block and an ADR asserting a property the tree lacked; cycle 2 found a census false in the shipped tree and a slot guard wrong in both count and source; cycle 3 finds a provenance clause that over-reaches by one item and moves no figure, breaks no formula, and contradicts no instruction. Count falls 3 → 2 → 1. And the failure *mode* changed kind: the first two were self-invalidating by construction and guaranteed to rot, while this one is static and needs one accurate clause, not a new guard. Churn would look like recurring severity, a fix reintroducing an equal-weight defect, or oscillation between two positions — none of which is present. The one fair worry is that each cycle's defect lives in the paragraph that fixed the previous one, but that is expected when the fix surface is a single dense paragraph, and SF-3 names the specific oracle gap that let it happen three times, so the next plan can close the class rather than the instance. Opening a fourth cycle over a one-clause citation would spend more risk on that paragraph than the defect carries.

Invoke `/qa` with plan ID `FIX-20260819T113512Z-438c` to run the QA suite. SF-1 and SF-2 share one repair and should be applied on the next touch of `references/config.md`; SF-3 is a process finding to carry into the next plan that asserts a classification census.
