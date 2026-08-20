---
id: FIX-20260819T113512Z-438c
title: Replace the closed span-shape census with an open form and repair the slot guard (CR-20260819T112837Z-9e42)
type: fix
status: DONE
created_at: 2026-08-19T11:35:12Z
updated_at: 2026-08-19T12:50:00Z
cycle: 2
related_to: CR-20260819T112837Z-9e42, FIX-20260819T105159Z-3cd7, CR-20260819T104419Z-fc4f, FEAT-20260819T101153Z-e883, SPEC-20260819T100451Z-01da, TEST-20260819T111853Z-17d4
---

**Related:** [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md) · [CR-20260819T112837Z-9e42](./CR-20260819T112837Z-9e42-stale-span-rule-assertions.md) · [FIX-20260819T105159Z-3cd7](./FIX-20260819T105159Z-3cd7-stale-span-rule-assertions.md) · [CR-20260819T104419Z-fc4f](./CR-20260819T104419Z-fc4f-one-span-rule-slice-set.md) · [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md) · [TEST-20260819T111853Z-17d4](../test/TEST-20260819T111853Z-17d4-stale-span-rule-assertions.md)

## Overview

`CR-20260819T112837Z-9e42` returned REQUEST_CHANGES on `FIX-20260819T105159Z-3cd7` with two Must Fix findings, both text-only, both moving no figure. **MF-1**: `config.md:234`'s replacement enumeration — *"Those are the only other places the shape appears"* — is false in the shipped tree, falsified by the prior cycle's own AC-2 output (`config.md:309`, a run-level, symbolic, **normative** fence created one phase before the enumeration was written) and by `SKILL.md:546`; its preceding sentence, which names `span_max` as never re-expanded, is falsified by the same site; `config.md:208` ("it does not restate them") is directly contradicted by `:234` 26 lines later; and the whole enumeration is reproduced into an **Accepted** ADR at `docs/adr/0017-…:189`–`:195`. **MF-2**: `SKILL.md:544`'s *"The two integration slots are populated from the digest's declared `integration` field"* is false in both count (three slots now) and source (the third is fed from the **lane-level** field), and its guard covers the wrong pair — `:533` and `:534` are adjacent lines carrying the character-identical token `+ integration({n})` from different declaration levels, so a mis-fill reprints `g = 24 − 12 = 12`, the exact defect these cycles exist to remove.

This plan implements the reviewer's two structural rulings rather than re-litigating them. **A closed census is self-invalidating** — it must be re-audited on every edit that touches the shape, which is the maintenance burden ADR-0017 claims to have retired — so `:234` and ADR-0017 are rewritten into an **open, self-maintaining form** that classifies every other site universally (applications, illustrations, or displays of the rule, never independent definitions of it) instead of enumerating them exhaustively. And the prior plan's **byte-identical pin on `SKILL.md:544` is dropped**: holding AC-5 (add the third slot) and AC-8 (pin the two-slots paragraph) simultaneously was unsatisfiable, which is why MF-2 is a plan defect and the coder was right to flag rather than edit against an explicit AC.

`config.md:309` is **not** touched — cycle-1 MF-1 proved the expanded form is required there. The entire MF-1 fix is on the claim side.

## Acceptance Criteria

### MF-1 — the claim side: an open form in `config.md` and in ADR-0017

1. **`config.md:234`'s closed census is replaced by an open, self-maintaining statement of the same achievement.** The replacement (a) keeps the bound — pricing an integration slice is a **one-site edit of the normative arithmetic**; (b) keeps naming `span(L)` at either level, `span_max`, and the viable baseline's `span_base` as named applications of the rule that follow it automatically; (c) states a **universal classification** — every site that writes the shape out summand by summand is an **application, illustration, or display** of the rule, never an independent definition of it; (d) names the sites known today as **examples only**, in an explicitly non-exhaustive construction, covering at minimum the post-adoption `span_max` fence under *Marginal-gain rule*, the sub-lane micro-examples beside it, and `SKILL.md` → Step 2p.2's print blocks (with ADR-0016 §5 attribution for the display decision); and (e) keeps the by-hand carrying obligation — a change to how a serial remainder is charged edits the rule here and must then be carried into every site that writes it out.
2. **No closed-census construction survives in that paragraph.** `grep -c 'Those are the only other places the shape appears' references/config.md` returns **0**, and no replacement closed form ("the only other", "two kinds of place", "and nowhere else", "exactly N places") is introduced. An open marker ("including", "for example", "such as", "today") is present and the classification in AC-1(c) is stated as a universal, not as a list.
3. **The paragraph's preceding sentence no longer contradicts `config.md:309`.** The unqualified claim that every span quantity is written as a named application "rather than re-expanded into a `max` and a `+ tasks(…)` of its own" — with `span_max` named — is either scoped to the **normative definitions** of those quantities or otherwise reconciled, so that a post-adoption `span_max` written as `max(…) + tasks(i(run))` at `:309` does not falsify it. After the edit, the paragraph is internally consistent when read end to end, and consistent with `:312`'s "That value is a `span_max`" / `:314`.
4. **`config.md:208` is narrowed and reconciled with `:234`.** It records that `SKILL.md` → Step 2p **applies** these rules and is not their normative home, and that where Step 2p displays the shape expanded, that is ADR-0016 §5's legibility decision and not a second definition. `grep -c 'it does not restate them' references/config.md` returns **0**. `:208` and `:234` are true when read together.
5. **`config.md:309`'s fence is byte-identical.** `max(second_largest_span, span(L after the split)) + tasks(i(run))` survives unchanged, as do `:314` and `:316`. No AC in this plan requires or permits an edit inside that fence.
6. **ADR-0017's Consequences bullet (`:185`–`:195`) mirrors the same bounded, open form.** `grep -c 'the shape survives \*\*expanded\*\* at the display sites' docs/adr/0017-*.md` returns **0**. The replacement either names the normative post-adoption `span_max` fence alongside the display sites and the micro-examples **under the same universal classification as AC-1(c)**, or stops enumerating entirely. No closed enumeration of shape sites remains anywhere in ADR-0017.
7. **ADR-0017's `Skills affected` line (`:5`) is true of the post-edit tree.** `grep -c 'is amended at \*\*one\*\* site' docs/adr/0017-*.md` returns **0**. It records the `SKILL.md` locations this ADR's work amended — the nested print block's `span_max` line, the slot-guard paragraph, and the `span(L)`/`span_max` paragraph's added clause — and why, **without a count that a later edit falsifies**. `templates/architect.md` is still recorded unamended and still is.
8. **Every other ADR-0017 claim about what is unamended is re-audited against the post-edit tree, not the pre-edit one.** In particular *What stands* `:152`–`:158` (the **flat** print-block template strings byte for byte; "Every other line of the nested block stands byte for byte") and `:150`–`:151` (every heading in `references/config.md`) are re-verified after the `SKILL.md` edit lands. Any claim found false is **corrected in this cycle**, not deferred; each verification is recorded with the command that produced it.

### MF-2 — `SKILL.md:544`: three slots, three sources, one copy hazard

9. **The byte-identical pin on the two-integration-slots paragraph is dropped.** This plan explicitly exempts `SKILL.md:544` from every byte-identity requirement it states, and **no acceptance criterion in this plan both requires editing a line and pins that same line byte-identical**. (This is the structural correction the CR's verdict demands; the prior plan's AC-5/AC-8 pair was unsatisfiable as written.)
10. **`:544` states three slots and names each slot's source**: `:531`'s `{, + integration sub-lane {n}}` from **the critical leaf's own lane's** declared field; `:533`'s `span({lane}) … + integration({n})` from **the candidate split's** declared field; `:534`'s `span_max … + integration({n})` from the **lane-level** declared field — the run's top-level integration lane, the one the `Integration lane:` line above reports.
11. **`:544` names the copy hazard for the newly-confusable pair.** It states that `:533` and `:534` print the character-identical token `+ integration({n})` drawn from **different declaration levels**, that the `span_max` slot is **never copied from the `span({lane})` line directly above it**, and that the two differ whenever the run declares a top-level integration lane. The existing guard on the `Nested plan:` slot ("read from that lane's declared field, never copied from the first") survives in substance.
12. **`:544` keeps everything it correctly asserted**: the slots are never left as literal placeholders; a declared `none` prints `integration(0)` and omits the `Nested plan:` slot entirely (`none` is a printed answer, not an absent one); the arithmetic is normative in `references/config.md` → *The makespan model* and this block only displays it. It restates **no** formula.
13. `grep -c 'The two integration slots are populated' SKILL.md` returns **0**.
14. **`SKILL.md:546` is byte-identical**, including its `span(L)` vs `span_max` distinction, its 16 → `{5, 5}` + integration 6 micro-example, and the run-level serial-remainder clause added last cycle. It is not in this plan's fix scope and is not touched.
15. **Every other line of Step 2p.2 is byte-identical** — the whole nested print block `:526`–`:542` (in particular `:533` and `:534`), the flat print block, the `g` / `c` / `{adopted | rejected}` lines, and the `c` cost table below. `git diff -- SKILL.md` is confined to the `:544` paragraph.
16. **The filled-slot walkthrough is re-recorded on worked example 5** after the edit: `span_max = max(second-largest span 12, span(backend) 8) + integration(4) = 16`, then `g = 24 − 16 = 8`. The mis-fill the amended guard now blocks — copying `:533`'s `integration(0)` into `:534`, yielding `span_max = 12` and `g = 24 − 12 = 12` — is recorded alongside it as the counter-example, and is **not** printed anywhere in the skill.

### Should Fix rulings

17. **SF-1 is ruled ACCEPT** (deferring a third time is declined, per the CR's recommendation) **and is implemented without touching `:309`.** `second_largest_span` is defined where it is used: the prose immediately governing the fence (`:312`) names it as the maximum of `span(L)` over the **other non-integration** lanes of the post-adoption lane set, and states that ranking **all** lanes double-charges `i(run)` whenever the integration lane ranks second. **No numeral is added** and the fence at `:309` stays byte-identical (AC-5). If the coder judges this unachievable without editing the fence or introducing a figure, it routes through BLOCKED with the reason recorded — never by editing `:309`.
18. **SF-2 is ruled DEFER**, upheld a third time and recorded in the Progress Log with the load-bearing content a wholesale merge would destroy re-enumerated **by name**: `:243`'s exact unbolded Step 3s quotation (a cross-document quote-fidelity anchor pinned at exactly 1), its Step 3s citation, its "overstates the gain rather than understating the cost" defect-class point and ADR-0012 attribution; `:246`'s Step 3j **and** Step 3L citations, its counts-in-full scope limit over `span_base` / `span_max` / `M_flat` / `T`, and its ADR-0016 attribution; and `:232`'s generic statement, which now trebles the overlap. No edit is made to `:243`, `:246`, or `:232`.
19. **SF-3 is ruled NO REWRITE**, and its discipline is adopted as a rule of this plan: the `.progress.md` contract is append-only, the correction already stands on record in `TEST-20260819T111853Z-17d4` §4 and in `CR-20260819T112837Z-9e42`, and ADR-0017 `:176` records "four of the five bodies byte-identical" against the right baseline and is not touched. **Every byte-identity or numeral-count figure this cycle writes into any progress log, plan, or ADR names its baseline in the same sentence** (this cycle's pre-edit tree vs `HEAD` / `d297e6c`).

### The census — the post-edit tree, not the pre-edit one

20. **The site census enumerates the POST-EDIT tree.** After every edit in this plan has landed and the distribution has been regenerated, a fresh census of every occurrence of the concurrent-`max`-plus-serial-remainder shape is taken over the whole of `references/config.md`, `SKILL.md`, `templates/architect.md`, `docs/adr/0016-*.md`, and `docs/adr/0017-*.md` — **each surviving site classified** as normative definition / application / illustration / display, and each checked against the claims written by AC-1, AC-4, AC-6 and AC-7. **A census restricted to the pre-edit site list is an explicit failure of this criterion**: the prior cycle's O2 was asserted green without enumerating `config.md:309`, the change's own output from one phase earlier, which is exactly how MF-1 shipped. The census is recorded with its commands and its per-site classification.
21. **The census yields exactly zero sites classified as a second normative *definition* of the shape**, and every site it classifies as application / illustration / display is covered by the universal classification AC-1(c) states — verified by reading the new `:234` and ADR-0017 text against the census output, not from memory.

### Invariants that must hold unchanged

22. **No figure moves anywhere.** Every numeral in all five worked-example subsections is identical pre- and post-edit under one stated extraction convention, **and** every one of the five re-derives by hand from the post-edit text. **Both independent checks re-run in full; prior green does not carry over**, because this cycle rewrites text the examples are checked against.
23. `grep 'min(S' references/config.md` returns **0**. No `min(S, X)` claim is introduced; it stays in ADR-0016 and ADR-0017.
24. **No heading is renamed, removed, added, or re-levelled** — 31 headings in `references/config.md`, and `SKILL.md`'s Step 2p region heading inventory byte-identical.
25. **Anchor + quote-fidelity census holds at 3 / 3 / 2 / 1**, by exact string count: `':(exclude).claude'` = 3 in `SKILL.md`; `the call shape from *How to spawn a subagent*` = 3 in `SKILL.md`; `through a **single sequential coder invocation**` = 2 in `SKILL.md`; its unbolded quotation = 1 in `references/config.md`, still matching the `SKILL.md` wording it cites — plus exactly **1** overlay `find` string from `prime-agent/overlays/orchestrator.json` occurring in `references/config.md`. Re-run **immediately after the `SKILL.md` edit** and again after regeneration.
26. **ADR-0016 is unamended**, stays `Accepted`, and its diff against `HEAD` stays a pure append (`11 +`, `0 −`). **ADR-0012, ADR-0013, ADR-0014 and `templates/architect.md` are `md5`-identical** to their pre-edit values.
27. **Distribution regenerated, never hand-edited.** `prime-agent/skills/**` is produced only by `node scripts/build-prime-agent.mjs`; `node scripts/build-prime-agent.mjs --check` exits **0** afterwards. Both MF fixes are present in the distributed copies by regeneration alone.
28. **No-regression floor holds**: `clean-code-gates` **225** passing / 0 failing; `node scripts/build-prime-agent.mjs --check` exit **0**; `cd prime-agent && npm test` exit **0**.
29. **Cross-reference targets resolve**, including every by-name reference introduced or altered by this plan's rewrites at `config.md:208`, `:234`, `:312`, `SKILL.md:544`, and ADR-0017.
30. **No behavioural or executable test is emitted, and this plan says so.** `parallelism` defaults to `off` in this repository and the `full` level with `k >= 2` is unreachable here, so no path executes the span rule. Verification is structural and arithmetic. Coverage is **inapplicable**, not below floor.
31. **All `.progress.md` files stay append-only.** The parent `FEAT`'s and the prior `FIX`'s progress logs are appended to at most, never rewritten.

## Out of Scope

- **Touching `references/config.md:309` in any way.** The fence is the cycle-1 MF-1 fix and is correct. MF-1's entire remedy is on the claim side; SF-1's clarification goes in the surrounding prose, never inside the fence.
- **Any repricing.** No change to `M_flat`, `M_nested`, `M_seq`, `T`, `g`, `c`, `span_base`, `span_max`, `A`, `J`, the `0.25` interface-point conversion, the `70%` threshold, the aggregate `I > T` guard, or `max_parallel_lanes`. Moving any numeral means the work was mis-scoped.
- **Re-litigating either ruling.** Enumerating harder (a narrower closed census) and "stated normatively exactly once" are both ruled out by the CR — the second because `:309` writes it normatively today. The plan implements the open form.
- **Amending ADR-0016**, which stays `Accepted` and append-only; this plan appends nothing to it. Also out: amending ADR-0012, ADR-0013, ADR-0014, or `templates/architect.md`.
- **Changing `SKILL.md` anywhere but the `:544` paragraph** — the flat print block, the nested print block `:526`–`:542`, `:546`, the `c` cost table and the Step 2p headings all stand.
- **Acting on SF-2.** A wholesale `:243` / `:246` merge deletes load-bearing content; ruled DEFER for the third time (AC-18).
- **Rewriting any `.progress.md` entry**, including the SF-3 baseline conflation. Append-only; the correction is already on record in the TEST report and the CR.
- **Superseding ADR-0017 with an ADR-0018.** ADR-0017 is untracked work-in-flight from this same uncommitted cycle; its errors are corrected in place before it lands.
- **Rewriting the parent `FEAT` plan's or the prior `FIX` plan's body.** Both are reviewed artifacts the CR's AC table cites; corrections live in this plan and in ADR-0017.
- **Any heading rename, deletion, addition, or re-levelling.**
- **Hand-editing `prime-agent/skills/**`.** It is generated by `rmSync` + full rewrite; both defects propagate on regeneration and are fixed at source only.
- **opencode port work.** `orchestrator` has no `.opencode/skills/orchestrator/` override port, so `opencode-port-parity` does not bind (only `pr-review-report` and `spec-driven-eval` have ports).
- **Any behavioural or executable test.** None is reachable — see Technical Notes.
- **Committing or pushing.** The pipeline ends at `READY_TO_COMMIT`.

## Technical Notes

- **Why an open form and not a better list.** A closed census — "those are the only other places" — is self-invalidating by construction: it must be re-audited against the whole document on every edit that touches the shape, which is precisely the maintenance burden ADR-0017 claims to have retired. It has now failed twice; a third enumeration would fail the same way. The open form states the **bound** (a one-site edit of the *normative arithmetic*), states a **universal classification** of every other site (application / illustration / display, never an independent definition), names today's sites as examples, and stays true when the next site appears. The classification is the load-bearing half — it is what a future editor checks a new site against, and it needs no re-audit to remain true.
- **The `:309` / SF-1 reconciliation, stated explicitly so it is not read as an oversight.** The CR's suggested SF-1 fix places the parenthetical **inside** the `:309` fence. This plan does **not** adopt that placement, because the same CR's verdict makes "`config.md:309` must not be touched" a hard constraint, and a plan that both pins a line and edits it is the exact defect (AC-5/AC-8) that left MF-2 open. The substance of SF-1 is preserved in full by defining `second_largest_span` in the prose at `:312` that already characterizes the fence ("the span rule … applied to the post-adoption lane set"), which is where the CR says the correct reading is currently pinned only *indirectly*. The definition makes it direct without a fence edit.
- **Sequencing is load-bearing: every claim-writing edit comes after every shape-touching edit.** MF-2 (`SKILL.md:544`) and SF-1 (`config.md:312`) land **first**; MF-1's claim rewrites at `config.md:234` / `:208` and in ADR-0017 land **after**, so they describe the tree as it actually stands when they are written. Writing the claim first is exactly what shipped MF-1: the prior plan's AC-2 created `:309` one phase before AC-9 wrote an enumeration that omitted it.
- **The census oracle must enumerate what this change produced.** The tester's own O2 self-audit is the most useful finding of the last cycle: an oracle that excludes the change's own output cannot detect a claim the change falsified. AC-20 therefore requires the census to be taken over the **post-edit** tree, after regeneration, with every surviving site classified — not against a site list carried forward from the pre-edit state.
- **MF-2's classification is upheld: it is a plan defect, not a coder defect.** The prior plan held AC-5 (add the third slot) and AC-8 (pin the two-slots paragraph byte-identical) at once. The coder correctly declined to edit against an explicit AC and flagged instead; that is the right behaviour under the plan contract and must not be counted against the coder in cycle accounting. AC-9 exists to make the same trap structurally impossible in this plan.
- **The hazard MF-2 addresses is reachable inside the print block.** `:533` and `:534` are adjacent lines carrying the character-identical token `+ integration({n})` from declaration levels 0 and 4 on worked example 5. `:544` is where a template-filler looks for slot provenance, and it currently under-counts and mis-sources; a mis-fill prints `g = 24 − 12 = 12`, the defect this whole cycle chain was convened to remove. `:546` states the correct source and mitigates, but a mitigation one paragraph away is not the repair — hence AC-10/AC-11 at `:544` and AC-14 pinning `:546` untouched.
- **ADR-0017's `Skills affected` is the third instance of the same class.** `:5` says `SKILL.md` "is amended at **one** site" while already describing two locations, and MF-2's fix makes it three. A count in a durable record is the same self-invalidating shape as a closed census; AC-7 requires the record be accurate **and** free of a count a later edit can falsify.
- **`config.md:459` remains the in-document oracle.** *What this example is actually pinning* names `max(20, 4)` = 20 and `max(12, 4)` = 12 as the uncorrected model. It is not edited — it is what the hand re-derivations are checked against.
- **Anchor risk is real again this cycle**, because `SKILL.md` is edited. `applyReplacements` (`scripts/build-prime-agent.mjs:77`–`:81`) hard-fails the build on any overlay-anchor occurrence-count drift, and the nearest anchors to the edit region are at `SKILL.md:456`, `:458`, `:488` (Step 2p.1) — outside the 2p.2 region but close. Run the census immediately after the `SKILL.md` edit, not only at the end (AC-25).
- **`through a **single sequential coder invocation**` is NOT an overlay build anchor.** The orchestrator overlay carries no `find` string matching `sequential coder`, `span`, `integration`, or `makespan`. Its count constraint is cross-document **quote fidelity** — `config.md:243` quotes it unbolded and must keep matching the `SKILL.md` wording it cites. The build does not enforce it, which is why the plan does.
- **`config.md` carries exactly one overlay anchor** (the ADR-0001 link at `:86`), far outside every edit region.
- **The pre-edit oracle is the reachable TDD analogue.** No test can be written, so the ordering discipline is: capture the expected outputs (numerals, anchor counts, heading inventory, cross-reference targets, floor results, file digests) **before** touching a line; state each Must Fix as a re-runnable assertion that currently **fails**; edit; assert it passes and the captured oracle still holds. Phase 0 exists for this and must not be skipped or reordered after the edits.
- **No executable path exists for this change, and none can be written.** `parallelism` defaults to `off` in this repo and the `full` level with `k >= 2` is unreachable here. This matches `PROJECT-CONTEXT.md` → *Test tooling* ("No automated test framework for doc-skill changes… verification is structural"). **Do not invent a behavioural test to satisfy a coverage habit** — the tester and the reviewer both read coverage as inapplicable, not below floor, and that reading stands here.
- **`PROJECT-CONTEXT.md` conventions that shape the edit.** *Single-source-of-truth references* — `references/config.md` stays the sole normative owner of the arithmetic; the open form is what makes that ownership checkable without a census. *Mirror machinery* — `:544`'s three-slot statement reuses the established `integration({n})` / declared-field phrasing rather than inventing a second idiom, and records the lane-level source as the deliberate divergence it is.
- **Backward compatibility** is trivially satisfied: no persisted artifact encodes the span formulas or the print-block strings. The Step 2p digest is transient and `.orchestrator/run-manifest.json` persists none of it.
- **Line numbers are current as of `d297e6c` plus the parent and prior-fix uncommitted edits. Re-locate every site by content, never by line number** — the MF-1 edits shift line numbers in `config.md` and the MF-2 edit shifts them in `SKILL.md`.
- **No open product decision** is touched by this plan.
- **Per-method cyclomatic complexity is not applicable** — this plan introduces no service, handler, use-case, or dispatcher class. It is a documentation-and-template change.

## Tasks

> Tasks are ordered oracle-first: for each Must Fix, the failing assertion is written and observed to fail before the edit that makes it pass. This is the reachable analogue of TDD for normative prose, per Technical Notes.
> The coder will check off `[ ]` → `[x]` as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run and assert green before checking the last task in the phase.
> **MF-2 and SF-1 are sequenced BEFORE MF-1 on purpose** — MF-1's rewrites are claims *about the tree*, and writing a claim before the edits it describes is exactly what shipped the defect being fixed. Do not reorder.

### Phase 0 — Capture the pre-edit oracle (must run first, must not be reordered)

- [x] Record the pre-edit numeral sequence of each of the five worked-example subsections (*the gate verdict and the ladder figure must agree*, *one lane carries all the work*, *a split carrying an integration sub-lane*, *`k = 2`*, *a declared top-level integration lane*), **and state the extraction convention in the record itself** (whether the subsection heading line is included). One convention, applied identically pre and post. State the baseline in the same sentence (AC-19).
- [x] Record the pre-edit anchor + quote-fidelity census: `':(exclude).claude'` in `SKILL.md`, `the call shape from *How to spawn a subagent*` in `SKILL.md`, `through a **single sequential coder invocation**` in `SKILL.md`, its unbolded quotation in `references/config.md`, and the count of overlay `find` strings from `prime-agent/overlays/orchestrator.json` occurring in `references/config.md`. Expected **3, 3, 2, 1, 1**. Record `grep -c 'min(S' references/config.md` = **0**.
- [x] Record the pre-edit heading inventory: every heading line of `references/config.md` (byte-exact text and level — expected **31**) and every heading in `SKILL.md`'s Step 2p region; plus the inventory of cross-reference targets this cycle's rewrites will touch.
- [x] Record `md5` of `SKILL.md`, `references/config.md`, `templates/architect.md`, `docs/adr/0012-*.md`, `docs/adr/0013-*.md`, `docs/adr/0014-*.md`, `docs/adr/0016-*.md`, `docs/adr/0017-*.md`; capture `git diff --stat HEAD -- docs/adr/0016-*.md` (expected `11 +`, `0 −`) and confirm `- **Status:** Accepted` on line 3.
- [x] Record the pre-edit floors: `cd plugins/my-skills/skills/clean-code-gates && npm test` (expect **225** pass / 0 fail), `node scripts/build-prime-agent.mjs --check` exit code, `cd prime-agent && npm test` exit code.
- [x] Write the four oracles as explicit re-runnable assertions with their **current (failing)** values recorded:
      **O1 (MF-2)** — `grep -c 'The two integration slots are populated' SKILL.md` = **1** (must become 0); `:544` enumerates **two** slots while the nested block carries **three**; `:544` names the `span_max` slot's source as "the digest's declared `integration` field" when it is the **lane-level** field; and `:544` contains no guard against copying `:533` into `:534` (the mis-fill that prints `g = 24 − 12 = 12`).
      **O2 (MF-1, `config.md`)** — `grep -c 'Those are the only other places the shape appears' references/config.md` = **1** (→ 0); `grep -c 'it does not restate them' references/config.md` = **1** (→ 0); and the `:234` paragraph's opening sentence names `span_max` as never re-expanded while `:309` is a post-adoption `span_max` re-expanded into a `max` + `tasks(i(run))`, per `:314` — a self-contradiction count of **1** (→ 0).
      **O3 (MF-1, ADR-0017)** — `grep -c 'the shape survives \*\*expanded\*\* at the display sites' docs/adr/0017-*.md` = **1** (→ 0); `grep -c 'is amended at \*\*one\*\* site' docs/adr/0017-*.md` = **1** (→ 0).
      **O4 (SF-1)** — `grep -c 'second_largest_span' references/config.md` = **1** occurrence with **0** definitions anywhere in the document (→ the same 1 occurrence in an unchanged fence, plus ≥1 definitional statement in the governing prose naming the *non-integration* lanes).

### Phase 0 verification

- [x] All five worked-example numeral sequences recorded, with the extraction convention and the baseline stated alongside them.
- [x] Census recorded at 3 / 3 / 2 / 1 (+ 1 overlay string); `min(S` = 0.
- [x] Heading inventory (31 in `config.md`) and cross-reference target list recorded.
- [x] File digests recorded; ADR-0016 diff confirmed pure-append (`11 +`, `0 −`) with `Status: Accepted` on line 3.
- [x] All three floors recorded green (225 / 0, `--check` 0, `prime-agent` test 0).
- [x] O1, O2, O3, O4 written down and **observed to fail** at their recorded current values.

### Phase 1 — MF-2: `SKILL.md`'s slot guard (three slots, three sources, one copy hazard)

- [x] Re-assert **O1** fails, recording exact current values: the paragraph's opening string, its two-slot enumeration, its stated source for the `span({lane})` slot, and the absence of any guard covering the `:533` / `:534` pair.
- [x] **Record the plan-level exemption before editing**: this plan drops the prior cycle's byte-identical pin on this paragraph (AC-9). Note in the Progress Log that the prior AC-5/AC-8 pair was unsatisfiable and that the coder's flag last cycle was correct.
- [x] Rewrite the `:544` paragraph to state **three** slots, each with its source — `:531` from the critical leaf's own lane's declared field, `:533` from the candidate split's declared field, `:534` from the **lane-level** declared field (the run's top-level integration lane, the one the `Integration lane:` line reports) — per AC-10.
- [x] Extend the same paragraph with the copy-hazard guard: `:533` and `:534` print the character-identical token `+ integration({n})` from different declaration levels; the `span_max` slot is **never copied from the line directly above it**; the two differ whenever the run declares a top-level integration lane (AC-11). Preserve the existing `Nested plan:` guard, the never-literal-placeholders assertion, the declared-`none` behaviour, and the pointer to `references/config.md` → *The makespan model* (AC-12). Restate no formula.
- [x] Record the filled-slot walkthrough on worked example 5 — `span_max = max(second-largest span 12, span(backend) 8) + integration(4) = 16`, then `g = 24 − 16 = 8` — and the blocked mis-fill (`integration(0)` → `span_max = 12` → `g = 24 − 12 = 12`) as the counter-example the guard now forbids (AC-16).
- [x] Run the anchor + quote-fidelity census **immediately** — `SKILL.md` is now modified — and match 3 / 3 / 2 / 1 (+ 1 overlay). Run `node scripts/build-prime-agent.mjs --check`; it must **not** fail on an occurrence-count mismatch (source drift against the not-yet-regenerated distribution is expected at this point).
- [x] Assert **O1** now passes, and assert the `SKILL.md` diff is confined to the one paragraph: nested print block `:526`–`:542` (including `:533` and `:534`), flat print block, `:546`, the `g` / `c` / `{adopted | rejected}` lines and the `c` cost table all byte-identical (AC-14, AC-15).

### Phase 1 verification

- [x] O1 re-observed failing before the edit, and green after.
- [x] `:544` names three slots and three distinct sources; the lane-level source is named for the `span_max` slot.
- [x] The `:533` → `:534` copy hazard is stated explicitly; the `Nested plan:` guard survives; no formula is restated.
- [x] Filled-slot walkthrough (`= 16`, `g = 8`) and the blocked mis-fill both recorded; neither figure appears anywhere new in the skill text.
- [x] Anchor census 3 / 3 / 2 / 1 (+ 1 overlay) immediately after the edit; `--check` shows no occurrence-count failure.
- [x] `git diff -- SKILL.md` confined to the `:544` paragraph; `:546` and the whole nested block byte-identical.

### Phase 2 — SF-1: define `second_largest_span` without touching the fence *(optional — ruled ACCEPT, attempt expected)*

- [x] *(optional)* Re-assert **O4** fails: `second_largest_span` occurs once and is defined nowhere; the correct reading is pinned only indirectly by `:312` + `:227`.
- [x] *(optional)* Add the definitional statement to the prose governing the fence (`:312`), naming `second_largest_span` as the maximum of `span(L)` over the **other non-integration** lanes of the post-adoption lane set, and stating that ranking **all** lanes double-charges `i(run)` when the integration lane ranks second. Add **no numeral**; do **not** edit the fence at `:309` (AC-5, AC-17).
- [x] *(optional)* Assert **O4** passes, `:309` is byte-identical, no numeral was added anywhere, and `--check` shows no occurrence-count failure. If the task could not be completed under these constraints, route through BLOCKED and record the reason — never by editing `:309`.

### Phase 2 verification

- [x] If attempted: O4 green, `:309` byte-identical, zero numerals added, `--check` clean of anchor drift.
- [x] If not attempted: the declination and its reason are recorded in the Progress Log, and AC-17's BLOCKED route is honoured rather than a fence edit.

### Phase 3 — MF-1(a): `config.md`'s claim, rewritten in the open form against the post-edit tree

- [x] Re-assert **O2** fails, recording exact current values of all three assertions.
- [x] Take the **interim site census** over the tree as it stands *after* Phases 1–2: every place in `references/config.md`, `SKILL.md`, `templates/architect.md` and the ADRs where the concurrent-`max`-plus-serial-remainder shape is written out summand by summand, each classified as normative definition / application / illustration / display. This census — not the pre-edit site list — is the input to the sentence written next (AC-20).
- [x] Rewrite `:234`'s closed census into the **open, self-maintaining form**: keep the one-site-edit bound and the three named applications; state the **universal classification** (every site that writes the shape out is an application, illustration, or display of the rule, never an independent definition of it); name today's sites as **examples only** in an explicitly non-exhaustive construction covering at minimum the post-adoption `span_max` fence, the sub-lane micro-examples, and Step 2p.2's print blocks with their ADR-0016 §5 attribution; keep the by-hand carrying obligation (AC-1, AC-2).
- [x] Reconcile the paragraph's **preceding sentence** with `:309`: scope the "never re-expanded" claim to the **normative definitions** of `span(L)` / `span_max` / `span_base` (or otherwise reconcile it), so a post-adoption `span_max` written as `max(…) + tasks(i(run))` no longer falsifies it, and the paragraph is internally consistent with `:312` / `:314` (AC-3).
- [x] Narrow `:208`: Step 2p **applies** these rules and is not their normative home; where it displays the shape expanded that is ADR-0016 §5's legibility decision, not a second definition. Remove the "it does not restate them" over-reach (AC-4).
- [x] Assert **O2** now passes; assert `:309`, `:312`'s fence-governing role, `:314` and `:316` are otherwise unchanged; assert `:208` and `:234` are true when read together; run `--check` for anchor drift.

### Phase 3 verification

- [x] O2 re-observed failing before the edits, and green after: both grep counts 0, and the paragraph self-consistency assertion satisfied.
- [x] The replacement contains an open marker and a universal classification; no closed-census construction ("the only other", "two kinds of place", "and nowhere else", "exactly N places") is present.
- [x] The interim census was taken **before** the sentence was written, and the sentence is true of it.
- [x] `:309` byte-identical; `grep 'min(S' references/config.md` = 0; heading count still 31.
- [x] `--check` shows no occurrence-count failure.

### Phase 4 — MF-1(b): ADR-0017, corrected in place against the post-edit tree

- [x] Re-assert **O3** fails, recording both current grep counts.
- [x] Rewrite the Consequences bullet (`:185`–`:195`) into the same bounded, open form as `config.md:234`: either name the normative post-adoption `span_max` fence alongside the display sites and the micro-examples under the same universal classification, or stop enumerating. No closed enumeration of shape sites survives anywhere in the ADR (AC-6).
- [x] Correct `Skills affected` (`:5`) against the **post-edit** tree: record the `SKILL.md` locations this work amended — the nested block's `span_max` line, the slot-guard paragraph, and the `span(L)`/`span_max` paragraph's added clause — and why, **without a count a later edit can falsify**. Keep `templates/architect.md` recorded unamended (AC-7).
- [x] Re-audit every remaining ADR-0017 claim about what is unamended against the post-edit tree — in particular *What stands* `:150`–`:158` (headings; flat print-block strings byte for byte; "every other line of the nested block stands byte for byte") — recording the command that verified each. Correct any claim found false **in this cycle** (AC-8).
- [x] Assert **O3** passes; assert ADR-0016 is untouched, `Accepted`, and its diff still `11 +` / `0 −`; assert ADR-0012 / ADR-0013 / ADR-0014 and `templates/architect.md` are `md5`-identical to their Phase 0 values (AC-26).

### Phase 4 verification

- [x] O3 re-observed failing before the edits, and green after: both grep counts 0.
- [x] ADR-0017 carries no closed enumeration of shape sites and no falsifiable amendment count.
- [x] Every *What stands* claim re-verified against the post-edit tree, each with its verifying command recorded; any falsified claim corrected here.
- [x] ADR-0016 pure-append, `Accepted`; ADR-0012/0013/0014 and `templates/architect.md` `md5`-identical.
- [x] Any byte-identity or numeral figure written into the ADR names its baseline in the same sentence (AC-19).

### Phase 5 — Post-edit census, no-figure-moves, regeneration, floors

- [x] Regenerate the distribution: `node scripts/build-prime-agent.mjs`. `prime-agent/skills/**` is produced by the script only — **no hand-edit** (AC-27).
- [x] Take the **final post-edit census** (AC-20, AC-21) over the regenerated tree: every occurrence of the shape in `references/config.md`, `SKILL.md`, `templates/architect.md`, `docs/adr/0016-*.md`, `docs/adr/0017-*.md`, each classified; assert **zero** sites classified as a second normative definition; and check the new `:234`, `:208` and ADR-0017 text against the census output line by line. Record the commands and the per-site classification.
- [x] Re-run the **mechanical no-numeral-drift** check over all five worked-example subsections under the Phase 0 convention — identical numeral sequences pre- and post-edit (AC-22). Prior green does not carry over.
- [x] Re-run the **full hand re-derivation** of all five worked examples from the post-edit text, checking each against `config.md:459`'s uncorrected-model oracle (AC-22). A disagreement means the corrected text is wrong and routes through BLOCKED — **never** adjust a numeral to make a derivation agree.
- [x] Re-run the anchor + quote-fidelity census post-regeneration and match **3 / 3 / 2 / 1** (+ 1 overlay); `grep 'min(S' references/config.md` = **0** (AC-23, AC-25).
- [x] Re-verify the heading inventory (31 in `config.md`, `SKILL.md` Step 2p region byte-identical) and that every cross-reference target touched by this cycle's rewrites resolves by title (AC-24, AC-29).
- [x] Run the no-regression floors: `node scripts/build-prime-agent.mjs --check` exit **0**; `cd prime-agent && npm test` exit **0**; `cd plugins/my-skills/skills/clean-code-gates && npm test` **225** pass / 0 fail (AC-28).
- [x] Confirm `git status` shows changes confined to `references/config.md`, `SKILL.md`, `docs/adr/0017-*.md`, `prime-agent/skills/**` (regenerated), and `plans/**`.
- [x] Record the SF-1, SF-2 and SF-3 rulings in the Progress Log (AC-17, AC-18, AC-19) — SF-2's deferred content re-enumerated by name, and every byte-identity or numeral figure stating its baseline in the same sentence.
- [x] Record that **no behavioural or executable test was emitted and none is reachable**, with the reason (AC-30), and confirm every `.progress.md` touched this cycle is a pure append (AC-31).

### Phase 5 verification

- [x] Distribution regenerated by script only; `--check` exits 0; both MF fixes present in `prime-agent/skills/**` by regeneration alone.
- [x] Final post-edit census recorded with per-site classification; zero second normative definitions; every claim written this cycle checked true against it.
- [x] Both independent no-figure checks re-run **in full** and green: identical numeral sequences, and all five examples hand-re-derived.
- [x] Census 3 / 3 / 2 / 1 (+ 1 overlay) post-regeneration; `min(S` = 0; 31 headings; all cross-references resolve.
- [x] All three floors green (225 / 0, `--check` 0, `prime-agent` test 0).
- [x] `git status` confined to the expected paths; no hand-edit under `prime-agent/`.
- [x] SF rulings recorded with baselines; no `.progress.md` entry rewritten.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands from the Commands section of `PROJECT-CONTEXT.md` that apply to the phase's touched paths and asserts each exits 0. A failure routes through the coder's BLOCKED step, not a silent rewrite.

Applying `PROJECT-CONTEXT.md` → **Commands** to this change:

- **No build step and no markdown lint** exist for doc-skill authoring — neither is emitted.
- **`clean-code-gates` JS test suite** (`cd plugins/my-skills/skills/clean-code-gates && npm test`) — its path condition (`plugins/my-skills/skills/clean-code-gates/**`) is **not** matched by any phase's diff. It runs only as the Phase 0 and Phase 5 no-regression floor, never as a per-phase gate. `PROJECT-CONTEXT.md` is explicit that it must not be invoked against non-JS doc skills.
- **`node scripts/build-prime-agent.mjs --check`** — path condition `plugins/my-skills/skills/orchestrator/**`, matched by Phases 1, 2, 3 and 5 (Phase 4 touches `docs/adr/`, which the script does not read). This is the one mechanical gate that applies to the edit region, because it hard-fails on overlay-anchor occurrence-count drift (`applyReplacements`, `scripts/build-prime-agent.mjs:77`–`:81`). In Phases 1–4 it may legitimately report source drift against the not-yet-regenerated distribution; the assertion in those phases is specifically that it does **not** fail on an occurrence-count mismatch. In Phase 5, after regeneration, it must exit **0** outright.
- **`cd prime-agent && npm test`** — path condition `prime-agent/**`, matched only by Phase 5 (regeneration). Must exit 0 there.
- **Phase 0** touches only `plans/**` and reads the tree; no gate command's path condition is matched.

Phase exit criterion: ALL applicable commands above exit 0 (or, for `--check` in Phases 1–4, fail on nothing but expected source drift) on the changed set, **and** every item in that phase's `### Phase N verification` checklist is green. No silent rewrite of `references/config.md`, `SKILL.md` or `docs/adr/0017-*.md` to make a check pass without a corresponding plan task — and in particular, **no numeral is ever adjusted to make a hand re-derivation agree**. A hand re-derivation that disagrees with a printed figure means the corrected text is wrong; it routes through BLOCKED.

G1 (coverage) and G6 (mutation) are QA-only and are not emitted here. No structural or behavioural test is emitted at any phase, because none is reachable — see Technical Notes.

## Dependencies

- `FIX-20260819T105159Z-3cd7` — DONE. This plan corrects two claims that plan's own edits produced.
- `FEAT-20260819T101153Z-e883` — DONE. Its uncommitted edits are the base this plan reads.
- No other plan blocks this one.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T11:35:12Z | ARCHITECT

Plan `FIX-20260819T113512Z-438c` created. Type: fix. Tasks: 37 across 6 phases; 31 acceptance criteria. Source CR: `CR-20260819T112837Z-9e42` (2 Must Fix, 3 Should Fix, review cycle 2).

Both structural rulings from the CR's verdict are implemented, not re-litigated: (a) MF-1's fix is entirely on the **claim** side — an **open, self-maintaining** form at `config.md:234` and in ADR-0017, with `config.md:309` untouched; (b) the byte-identical pin on `SKILL.md:544` is **dropped**, and AC-9 states as a criterion that no AC both requires editing a line and pins it byte-identical — the prior AC-5/AC-8 pair was unsatisfiable, and the coder was right to flag rather than edit against an explicit AC.

Should Fix rulings: **SF-1 ACCEPT** (defined at `:312`, not inside the `:309` fence, to honour the hard "do not touch `:309`" constraint without losing the substance); **SF-2 DEFER** (third time, content re-enumerated by name); **SF-3 NO REWRITE** (append-only log; the discipline is adopted as AC-19).

Sequencing that must not be reordered: MF-2 and SF-1 land before MF-1, so every claim describes the tree as it stands when written; and AC-20's census enumerates the **post-edit** tree after regeneration with every site classified — the pre-edit-only census is what shipped MF-1 last cycle.

Status: PLANNED. Ready for coder.

### 2026-08-19T11:44:30Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task (Phase 0).

### 2026-08-19T11:52:00Z | CODER

**Phase 0 complete — pre-edit oracle captured (6 tasks + 6 verification items).**

Baseline named in every figure below: **this cycle's pre-edit tree** = `HEAD` (`d297e6c`) plus the uncommitted edits of `FEAT-20260819T101153Z-e883` and `FIX-20260819T105159Z-3cd7`. Not `HEAD` alone (AC-19).

**Numeral extraction convention (one convention, applied identically pre and post).** For each of the five `#### Worked example — …` subsections of `references/config.md`, the extracted span **starts at the subsection heading line inclusive** and ends at the line immediately before the next heading of any level; every maximal run of `[0-9]` characters in that span, in document order. Pre-edit result against the pre-edit tree: 5 subsections, **505 numerals** total (510 lines including the 5 section markers).

**Anchor + quote-fidelity census, pre-edit tree:** `':(exclude).claude'` in `SKILL.md` = **3**; `the call shape from *How to spawn a subagent*` in `SKILL.md` = **3**; `through a **single sequential coder invocation**` in `SKILL.md` = **2**; its unbolded quotation in `references/config.md` = **1**. Overlay `find` strings from `prime-agent/overlays/orchestrator.json` occurring in `references/config.md` = **1** (the ADR-0001 link at `:86`); 22 of the 24 occur in `SKILL.md`, per-anchor counts recorded (anchor#1 ×3, anchor#11 ×3, all others ×1). `grep -c 'min(S' references/config.md` = **0**.

**Heading inventory, pre-edit tree:** `references/config.md` = **31** headings, byte-exact text and level recorded. `SKILL.md` Step 2p region = 7 headings recorded (`Step 2p`, `2p.0`, `2p.1`, `2p.2`, `2p.3`, `2p.3n` in the 400–620 window; `2p.4`/`2p.5`/`2p.6` follow). Cross-reference targets this cycle's rewrites touch all resolve pre-edit: *The makespan model* (heading), *Marginal-gain rule* (heading), *The inner viability gate* (heading), *Owned-glob rejection* (heading), *Per-sub-lane re-application …* (heading), *The baseline* (bold in-paragraph anchor at `:255`), and `SKILL.md`'s `2p.0`–`2p.6` sub-headings, Step 3j / Step 3s / Step 3L.

**`md5` digests, pre-edit tree:** `SKILL.md` `476a526e56c489d97607e7838c65dc2c`; `references/config.md` `cbd383a9aa150798920331dc2eda14ce`; `templates/architect.md` `5a1dac6171ec6c1f10df419c5ab299ce`; ADR-0012 `70eb1ecaa71039a1346a71869bd65290`; ADR-0013 `56b8f4a9d75c55b9a889e61bde56dc99`; ADR-0014 `bc16761f3fd2355309e5a7ed94849298`; ADR-0016 `757d241bf78ff338762b55a4b88ea164`; ADR-0017 `38d8bf0b6ef9f8b4de1a661663945d45`. `git diff --numstat HEAD -- docs/adr/0016-*.md` = **`11  0`** — a pure append against `HEAD` (`d297e6c`) — and `- **Status:** Accepted` confirmed on line 3.

**Floors, pre-edit tree:** `clean-code-gates` `npm test` → **225 pass / 0 fail**; `node scripts/build-prime-agent.mjs --check` → exit **0** (`prime-agent/skills is up to date (11 skills, 154 files)`); `cd prime-agent && npm test` → exit **0**.

**The four oracles, written as re-runnable assertions and observed to FAIL at these current values:**

- **O1 (MF-2)** — `grep -c 'The two integration slots are populated' SKILL.md` = **1** (must become 0). `:544` enumerates **two** integration slots (`:531`'s `{, + integration sub-lane {n}}` and `:533`'s `+ integration({n})`) while the nested print block carries **three** — `:534`'s `span_max … + integration({n})` is not named at all. `:544` attributes both named slots to "the digest's declared `integration` field", which is not the source of `:534`'s slot (that is the **lane-level** field). No guard covering the `:533` / `:534` pair exists: `grep -c 'never copied from the line directly above it' SKILL.md` = **0**, `grep -c 'three integration slots' SKILL.md` = **0**.
- **O2 (MF-1, `config.md`)** — `grep -c 'Those are the only other places the shape appears' references/config.md` = **1** (→ 0); `grep -c 'it does not restate them' references/config.md` = **1** (→ 0); and `:234`'s opening sentence asserts unqualified that each span quantity is written as a named application "rather than re-expanded into a `max` and a `+ tasks(…)` of its own" — naming `span_max` — while `:309` is a post-adoption `span_max` written as exactly `max(second_largest_span, span(L after the split)) + tasks(i(run))`, per `:312`/`:314`. Self-contradiction count **1** (→ 0).
- **O3 (MF-1, ADR-0017)** — `grep -c 'the shape survives \*\*expanded\*\* at the display sites' docs/adr/0017-*.md` = **1** (→ 0); `grep -c 'is amended at \*\*one\*\* site' docs/adr/0017-*.md` = **1** (→ 0).
- **O4 (SF-1)** — `grep -c 'second_largest_span' references/config.md` = **1** occurrence (inside the `:309` fence) with **0** definitions anywhere in the document; `grep -c 'other non-integration lanes' references/config.md` = **0** (→ ≥1 definitional statement in the governing prose, with the fence still byte-identical).

Phase 0 gate commands: none applicable — Phase 0 touches only `plans/**` and reads the tree, so no `PROJECT-CONTEXT.md` → *Commands* path condition is matched. Phase 0 verification checklist: all 6 items green.

### 2026-08-19T12:04:00Z | CODER

**Phase 1 complete — MF-2: `SKILL.md`'s slot guard (7 tasks + 6 verification items).**

**Plan-level exemption, acknowledged before the edit was made (AC-9).** This plan explicitly drops the prior cycle's byte-identical pin on the `SKILL.md:544` paragraph. The prior plan held AC-5 ("add the third slot") and AC-8 ("pin this paragraph byte-identical") simultaneously, which is unsatisfiable; **that was a plan defect, not a coder defect**, and the prior cycle's coder was correct to flag rather than edit against an explicit AC. The exemption is scoped to that one paragraph only — `:546` and every other line of Step 2p.2 remain pinned, and both were verified byte-identical after the edit.

**O1 re-asserted FAILING immediately before the edit**, at these exact values: `grep -c 'The two integration slots are populated' SKILL.md` = **1**; the paragraph enumerated **two** integration slots (`:531`'s `{, + integration sub-lane {n}}` and `:533`'s `+ integration({n})`) while the nested print block carries **three** — `:534`'s `span_max … + integration({n})` was named nowhere in it; both named slots were attributed to "the digest's declared `integration` field", which is not the source of `:534`'s slot; and no guard covering the `:533` / `:534` pair existed (`grep -c 'never copied from the line directly above it' SKILL.md` = **0**, `grep -c 'three integration slots' SKILL.md` = **0**).

**The edit.** `:544` now names **three** slots and **three distinct sources**: the `Nested plan:` line's slot from **the critical leaf's own lane's** declared field; the `span({lane})` line's from **the candidate split's own** declared field; the `span_max` line's from the **lane-level** declared field — the run's top-level integration lane, which is the one the `Integration lane:` line of the flat block above (`:504`) reports. The copy hazard is stated explicitly: `:533` and `:534` are adjacent lines printing the character-identical token `+ integration({n})` drawn from **different declaration levels**, they differ by exactly the lane-level count whenever the run declares a top-level integration lane (**including when the candidate split declared `none` and the run did not** — precisely worked example 5's configuration), and the `span_max` slot is **never copied from the line directly above it**. The existing `Nested plan:` guard ("read from that lane's declared field, never copied from the first") survives in substance; the never-literal-placeholders assertion, the declared-`none` behaviour (`integration(0)` printed, `Nested plan:` slot omitted, "`none` is a printed answer, not an absent one"), and the pointer to `references/config.md` → *The makespan model* are all kept verbatim in substance. **No formula is restated** — the three lines are referenced by label, and the prior paragraph's inlined template arithmetic (`span({lane}) = max(concurrent {n},…) + integration({n}) = {span_L}`) was dropped rather than carried forward.

**Filled-slot walkthrough, worked example 5 (`references/config.md:433`–`:461`), recorded here and printed nowhere in the skill.** The run declares top-level integration lane `wiring` at 4; the adopted candidate `backend` splits `{8, 8}` with `integration: none`, so `span(backend)` = 8. Correctly filled: `:533` reads `span(backend) = max(concurrent 8, 8) + integration(0) = 8` from the **candidate split's** field, and `:534` reads `span_max = max(second-largest span 12, span(backend) 8) + integration(4) = 16` from the **lane-level** field — matching `:449`'s `span_max` of **16** — then `g = 24 − 16 = 8`, matching `:453`. **The blocked mis-fill, recorded as the counter-example the amended guard now forbids:** copying `:533`'s `integration(0)` into `:534` gives `span_max = max(12, 8) + 0 = 12` and `g = 24 − 12 = 12` — the run's critical path understated by exactly `X = 4` and the gain overstated by the same, which is the exact defect these cycles were convened to remove. Neither `16`/`8` nor `12` was added to `SKILL.md`; the character-class numeral count of `SKILL.md` is **958 pre-edit and 958 post-edit**, unchanged.

**Verification.** O1 green: `grep -c 'The two integration slots are populated' SKILL.md` = **0**; `three integration slots` = **1**; `never copied from the line directly above it` = **1**. `diff` against this cycle's pre-edit `SKILL.md` snapshot shows **exactly one changed line** (`:544`) — 1 removed / 1 added, nothing else. The whole nested print block `:526`–`:542` (including `:533` and `:534`) is **byte-identical**, `:546` is **byte-identical**, and the flat print block, the `g` / `c` / `{adopted | rejected}` lines and the `c` cost table are untouched, all against this cycle's pre-edit tree (`HEAD` `d297e6c` + the parent FEAT's and prior FIX's uncommitted edits). Anchor + quote-fidelity census immediately after the edit: **3 / 3 / 2 / 1**, and the full per-overlay-anchor occurrence table `diff`s clean against Phase 0 — **no occurrence-count drift**.

**Phase 1 gate command.** `node scripts/build-prime-agent.mjs --check` — path condition `plugins/my-skills/skills/orchestrator/**` matched. It reports `stale: prime-agent/skills/orchestrator/SKILL.md`, i.e. **expected source drift against the not-yet-regenerated distribution only**; it does **not** fail on an overlay-anchor occurrence-count mismatch (`applyReplacements`), which is the assertion this phase requires. Regeneration lands in Phase 5, where `--check` must exit 0 outright.

### 2026-08-19T12:10:00Z | CODER

**Phase 2 complete — SF-1 attempted and achieved without touching the fence (3 tasks + 2 verification items).**

SF-1 was **attempted**, as the plan expected, and succeeded under every constraint; the BLOCKED route at AC-17 was not needed.

**O4 re-asserted FAILING before the edit:** `grep -c 'second_largest_span' references/config.md` = **1**, that single occurrence being inside the `:309` fence, with **0** definitions anywhere in the document — the correct reading pinned only indirectly by `:312`'s "applied to the post-adoption lane set" plus `:227`'s statement of the rule. `grep -c 'other non-integration lanes' references/config.md` = **0**.

**The edit, placed per the plan's deliberate divergence from the CR's own suggestion.** The CR proposed a parenthetical **inside** the `:309` fence while the same verdict makes `:309` untouchable; the plan routes the substance into the prose at `:312` that already governs the fence instead. `:312` now states that `second_largest_span` is the span rule's concurrent term over the *rest* of the set — the maximum of `span(L)` over the post-adoption lane set's **other non-integration lanes**, every lane but the one being split, with the run's own integration lane excluded because that lane *is* `i(run)` and is already charged once by the `+ tasks(i(run))` term sitting outside the `max` — and that ranking **all** lanes instead would **double-charge `i(run)` whenever the integration lane ranks second**, adding its task count inside the `max` as well as after it: the mirror of the optimistic error the serial remainder exists to prevent, wrong in the opposite direction.

**Verification.** O4 green: `second_largest_span` now occurs **2** times — the unchanged fence occurrence plus the definitional statement in the governing prose — and `other non-integration lanes` = **1**. `:309` is **byte-identical** (`diff` against this cycle's pre-edit line snapshot: identical). **Zero numerals added anywhere**: the character-class numeral count of `references/config.md` is **1203 pre-edit and 1203 post-edit**, against this cycle's pre-edit tree (`HEAD` `d297e6c` + the parent FEAT's and prior FIX's uncommitted edits). `diff` against the pre-edit `config.md` snapshot shows **exactly one changed line** (`:312`). `grep 'min(S' references/config.md` = **0**; heading count still **31**.

**Phase 2 gate command.** `node scripts/build-prime-agent.mjs --check` — path condition matched; reports staleness of the two edited source files against the not-yet-regenerated distribution only, and the full per-overlay-anchor occurrence table `diff`s clean against Phase 0, so there is **no occurrence-count drift**. `config.md`'s single overlay anchor (the ADR-0001 link at `:86`) is far outside the edit region and still counts 1.

### 2026-08-19T12:22:00Z | CODER

**Phase 3 complete — MF-1(a): `config.md`'s claim, rewritten in the open form against the post-edit tree (5 tasks + 5 verification items).**

**O2 re-asserted FAILING before the edits**, at these exact values: `grep -c 'Those are the only other places the shape appears' references/config.md` = **1**; `grep -c 'it does not restate them' references/config.md` = **1**; and `:234`'s opening sentence asserted unqualified that each span quantity is written as a named application "rather than re-expanded into a `max` and a `+ tasks(…)` of its own" while naming `span_max`, which `:309` — a post-adoption `span_max` written as `max(second_largest_span, span(L after the split)) + tasks(i(run))`, per `:312`/`:314` — falsifies. Self-contradiction count **1**.

**Interim site census, taken over the tree as it stood AFTER Phases 1–2 and BEFORE this sentence was written** (commands: `grep -nE '\+ *(tasks\(|integration\()'` and `grep -n 'max(' | grep -E '\+ *(tasks\(|integration\(|X|[0-9])'` over `references/config.md`, `SKILL.md`, `templates/architect.md`, `docs/adr/0016-*.md`, `docs/adr/0017-*.md`). Per-site classification:

| Site | Classification |
| --- | --- |
| `config.md:227` (fence) | **normative definition** — the one and only |
| `config.md:232` | illustration (prose gloss naming the rule's two parts) |
| `config.md:309` (fence) | **application** — normative, written expanded; named as an application by `:312`'s governing prose |
| `config.md:316` | illustration (sub-lane micro-example under *Marginal-gain rule*) |
| `config.md:346`, `:364`, `:382`, `:400`, `:402`, `:441`, `:443`, `:448`, `:453` | illustration (the five worked examples' arithmetic) |
| `config.md:248`, `:253`, `:264`, `:314` | application/reference — name the term, do not write the shape out |
| `SKILL.md:505` | **display** — Step 2p.2 flat print block (ADR-0016 §5) |
| `SKILL.md:533`, `:534` | **display** — Step 2p.2 nested print block |
| `SKILL.md:544` | application/prose — refers to the three lines by label, restates no formula |
| `SKILL.md:546` | illustration (prose micro-example) |
| `templates/architect.md` | **zero sites** — referential only, confirming it is unamended and stays so |
| `ADR-0016:89`, `:114`, `:143`–`:144` | illustration/record (a decision record's own derivation notation) |
| `ADR-0017:5`, `:46`, `:157` | illustration/record (quotation of the rule and descriptions of it) |

**Zero sites classified as a second normative definition of the shape.** This census — not the pre-edit site list — is what the replacement sentence was written against.

**The `:234` rewrite (AC-1, AC-2, AC-3).** It keeps the bound (pricing an integration slice is a **one-site edit of the normative arithmetic**) and keeps naming `span(L)` at either level, `span_max` and `span_base` as the named applications that follow automatically. The "never re-expanded" claim is now **scoped to the normative definitions** of those quantities — "a claim about the **normative definitions** of those quantities, and about those only, not about every line that later writes one of them out" — so `:309` no longer falsifies it, and the paragraph reads consistently with `:312`'s "This is the span rule … applied to the post-adoption lane set" and with `:314`. It then states the **universal classification**: "**Every other site that writes the shape out summand by summand is an application, an illustration, or a display of this rule — never an independent definition of it**", explicitly framed as the test to apply to "one standing here today or one added tomorrow". Today's sites are named as **examples only** — the post-adoption `span_max` fence under *Marginal-gain rule* (named as a normative **application**), the sub-lane micro-examples beside that fence and in the worked examples, and `SKILL.md` → Step 2p.2's print blocks with their ADR-0016 §5 attribution — followed by the explicit disclaimer that "those examples are illustrative of the classification, **not a census of the tree**, and are not maintained as one: the classification holds whether or not they are complete." The by-hand carrying obligation survives, now sourced from the classification rather than from a list. The `T` / `M_seq` exclusion note is kept.

**No closed-census construction survives.** `Those are the only other places the shape appears` = **0**; `the only other` = **0**; `two kinds of place` = **0**; `and nowhere else` = **0**; `exactly two places` / `exactly three places` / `the only place` = **0**. Open markers present in `:234`: `today` ×2, `for example` ×1, `include` ×1.

**The `:208` narrowing (AC-4).** It now records that `SKILL.md` → Step 2p **applies** these rules and is not their normative home, and that where Step 2p writes one of them out expanded — its two Step 2p.2 print blocks — that is ADR-0016 §5's deliberate legibility decision, a **display** of the arithmetic defined here and not a second definition of it, with the change-here-carry-by-hand obligation restated. `grep -c 'it does not restate them' references/config.md` = **0**. `:208` and `:234` are true read together: both attribute the print blocks to ADR-0016 §5 and both classify them as displays, not definitions.

**Verification.** O2 green on all three assertions. `diff` against this cycle's pre-edit `config.md` snapshot shows **exactly three changed lines** — `:208`, `:234`, `:312` — and nothing else; `:309` is **byte-identical**, and `:314` and `:316` are untouched, `:312` retaining its fence-governing sentence verbatim with the Phase-2 definition appended. `grep 'min(S' references/config.md` = **0**; heading count still **31**. **All five worked-example numeral sequences `diff` identical** pre- and post-edit under the Phase 0 convention. The document's total character-class numeral count moved 1203 → 1211; the entire **+8** delta is on `:208` and is **cross-reference identifiers only** — the added `Step 2p`, `Step 2p.2` and `ADR-0016 §5` citations (`2 2 2 0016 5`). **No figure moved**: `:234`'s numeral sequence is `2 2 0016 5` pre and post, `:312`'s is empty pre and post.

**Phase 3 gate command.** `node scripts/build-prime-agent.mjs --check` — path condition matched; staleness of the two edited source files against the not-yet-regenerated distribution only, and the full per-overlay-anchor occurrence table `diff`s clean against Phase 0, so **no occurrence-count drift**.

### 2026-08-19T12:34:00Z | CODER

**Phase 4 complete — MF-1(b): ADR-0017, corrected in place against the post-edit tree (5 tasks + 5 verification items).**

**O3 re-asserted FAILING before the edits:** `grep -c 'the shape survives \*\*expanded\*\* at the display sites' docs/adr/0017-*.md` = **1**; `grep -c 'is amended at \*\*one\*\* site' docs/adr/0017-*.md` = **1**.

**The Consequences bullet rewrite (AC-6).** The bullet keeps the bound (a one-site edit of the normative arithmetic; the named quantities follow automatically; the ADR-0012 → ADR-0014 → ADR-0016 failure mode) and now mirrors `config.md:234`'s form exactly: it states that `references/config.md` carries the bound as a **universal classification rather than as a census** — every other site that writes the shape out summand by summand is an **application, an illustration, or a display** of the rule, never an independent definition of it — notes that the classification stays true as sites are added or removed "which is the property a list does not have", and names today's sites as non-exhaustive examples: the **normative post-adoption `span_max` fence** under *Marginal-gain rule* (named as an **application**, which is precisely the site the superseded enumeration omitted), the sub-lane micro-examples, and Step 2p.2's print blocks under ADR-0016 §5's display decision. §5's flat-only scoping and the nested block's fix-rather-than-exempt history are kept verbatim in substance. The bullet now also records its own correction: the earlier revision enumerated those sites as a **closed** set, that enumeration was false in the shipped tree because it omitted the fence this same change had created, and it is replaced because a closed census must be re-audited on every edit touching the shape — the maintenance burden this ADR claims to have retired (`CR-20260819T112837Z-9e42` MF-1). The bullet's two internal counts were removed with it: "the **four** named quantities" → "the named quantities", "keep **four** normative formulas" → "keep several normative formulas". **No closed enumeration of shape sites remains anywhere in ADR-0017** — `only other` / `nowhere else` / `two kinds of place` / `the only place` / `display sites` all return **0**. (`:89` and `:183`'s "exactly two depths" / "exactly two named levels" are retained: they are the hard depth cap, not an enumeration of shape sites. `:6`'s "four separate normative formulas" is retained: it is a verbatim quotation of the `arch-2` backlog item describing the **pre-ADR** state, not a claim about the current tree.)

**`Skills affected` (`:5`) corrected against the post-edit tree (AC-7).** `SKILL.md` is now recorded as amended "**only where it restated the arithmetic or described that restatement**, and the amended locations are **named rather than counted**, so that a later amendment cannot falsify this record" — then the three locations by name: Step 2p.2's **nested** print block, whose `span_max` line now carries `+ integration({n})`; the `span(L)` / `span_max` paragraph below it, which gained one clause pointing at *The makespan model*; and the slot-guard paragraph beside it, which now names each of the block's integration slots with its own declared source — the critical leaf's lane, the candidate split, and the **lane-level** field — and guards the copy hazard between the two adjacent lines printing the character-identical `+ integration({n})` token from different declaration levels (`CR-20260819T112837Z-9e42` MF-2). The "amended because they **did** restate the arithmetic" rationale and the ADR-0016 §5 flat-only scoping (`CR-20260819T104419Z-fc4f` MF-3) are kept. `templates/architect.md` is still recorded **unamended**, and still is (`md5` `5a1dac6171ec6c1f10df419c5ab299ce`, identical to its Phase 0 value on this cycle's pre-edit tree). `grep -c 'is amended at \*\*one\*\* site' docs/adr/0017-*.md` = **0**.

**Re-audit of every remaining ADR-0017 claim about what is unamended, against the POST-EDIT tree, each with its verifying command (AC-8). No claim was found false, so nothing needed correcting.**

| Claim | Command | Result |
| --- | --- | --- |
| `:147`–`:149` ADR-0012 / ADR-0013 / ADR-0014 unamended | `md5 -q docs/adr/001{2,3,4}-*.md` | `70eb1ec…`, `56b8f4a…`, `bc16761…` — all **identical** to Phase 0 |
| `:150`–`:151` every heading in `references/config.md`, none renamed / removed / added / re-levelled | `diff` of `grep '^#\{1,6\} '` against the Phase 0 inventory | **identical**, 31 headings |
| `:152`–`:157` Step 2p.2's **flat** print-block template strings byte for byte | `diff <(sed -n '500,512p' <pre-edit snapshot>) <(sed -n '500,512p' SKILL.md)` | **identical** (block and its governing paragraph) |
| `:158` "Every other line of the nested block stands byte for byte" | `diff` of `sed -n '526,542p' SKILL.md` against the Phase 0 snapshot | **identical** — this cycle's `SKILL.md` edit is confined to `:544`, prose *below* the block, so the claim survives |
| `templates/architect.md` unamended (`:5`) | `md5 -q` | `5a1dac6…` — **identical** to Phase 0 |

**Verification.** O3 green on both greps. `diff` against this cycle's pre-edit ADR-0017 snapshot is confined to `:5` and the Consequences bullet (`:186`–`:195` → `:186`–`:205`); nothing else moved. **SF-3 honoured**: `:176`'s "four of the five bodies byte-identical" is **untouched** and still reads against its own correct baseline. ADR-0016 is untouched — `md5` `757d241bf78ff338762b55a4b88ea164` identical to Phase 0, `git diff --numstat HEAD` still **`11  0`** (pure append), `- **Status:** Accepted` still on line 3. ADR-0012 / ADR-0013 / ADR-0014 and `templates/architect.md` are all **`md5`-identical** to their Phase 0 values (AC-26). **AC-19**: this phase wrote **no** new byte-identity or numeral figure into the ADR — the rewrite removed two counts and added none — so there is no unbaselined figure; every figure quoted in this log entry names this cycle's pre-edit tree (`HEAD` `d297e6c` + the parent FEAT's and prior FIX's uncommitted edits) as its baseline.

**Phase 4 gate command.** Phase 4 touches `docs/adr/` only, which `scripts/build-prime-agent.mjs` does not read, so no gate command's path condition is matched by this phase's diff — as the plan's *Verification (per phase)* section states.

### 2026-08-19T12:50:00Z | CODER

**Phase 5 complete — post-edit census, no-figure-moves, regeneration, floors (11 tasks + 7 verification items).**

**Regeneration (AC-27).** `node scripts/build-prime-agent.mjs` → `wrote prime-agent/skills with 11 skills (154 files)`. `prime-agent/skills/**` was produced by the script alone; **nothing under `prime-agent/` was hand-edited** at any point this cycle. `node scripts/build-prime-agent.mjs --check` then exits **0** (`prime-agent/skills is up to date (11 skills, 154 files)`). **Both MF fixes are present in the distributed copies by regeneration alone**: in `prime-agent/skills/orchestrator/SKILL.md`, `three integration slots` = 1, `never copied from the line directly above it` = 1, and the superseded `The two integration slots are populated` = **0**; in `prime-agent/skills/orchestrator/references/config.md`, `never an independent definition of it` = 1, `other non-integration lanes` = 1, and the superseded `Those are the only other places the shape appears` = **0** and `it does not restate them` = **0**.

**Final post-edit census, taken over the regenerated tree (AC-20, AC-21).** Commands: `grep -nE '\+ *(tasks\(|integration\()|max\(.*\+ '` over `references/config.md`, `SKILL.md`, `templates/architect.md`, `docs/adr/0016-*.md`, `docs/adr/0017-*.md`, **and** the regenerated `prime-agent/skills/orchestrator/{SKILL.md,references/config.md,templates/architect.md}`. Per-site classification of the surviving sites:

| Site | Classification |
| --- | --- |
| `config.md:227` (fence) | **normative definition** — the sole one |
| `config.md:232` | illustration (prose gloss of the rule's two parts) |
| `config.md:234`, `:208` | claim about the rule's ownership — states the classification, does not write the shape out |
| `config.md:309` (fence) | **application** — normative, expanded; named as an application by `:312` |
| `config.md:248`, `:253`, `:264`, `:312`, `:314`, `:316` | application / reference / illustration (`:316` carries the sub-lane micro-example) |
| `config.md:346`, `:364`, `:382`, `:400`, `:402`, `:422`, `:441`, `:443`, `:448` | illustration (the five worked examples' arithmetic) |
| `SKILL.md:505` | **display** — Step 2p.2 flat print block (ADR-0016 §5) |
| `SKILL.md:533`, `:534` | **display** — Step 2p.2 nested print block |
| `SKILL.md:544` | application/prose — names the three slots by label, restates no formula |
| `SKILL.md:546` | illustration (prose micro-example) |
| `templates/architect.md` | **zero sites** (source and distribution alike) |
| `ADR-0016:89`, `:114`, `:143`–`:144` | illustration/record |
| `ADR-0017:5`, `:46`, `:143`, `:157`, and the rewritten Consequences bullet | illustration/record |
| `prime-agent/skills/orchestrator/**` | byte-for-byte regenerated mirrors of the above; same classifications |

**Exactly zero sites are classified as a second normative *definition* of the shape** (AC-21). Checking the new text against this census output rather than from memory: the new `:234`'s universal classification — "every other site that writes the shape out summand by summand is an **application**, an **illustration**, or a **display** of this rule, never an independent definition of it" — covers **every** non-definition row in the table above, including the ones it does not name (`SKILL.md:546`, `config.md:316`, `:422`, the ADR rows and the regenerated mirrors), which is exactly the property the open form was adopted for. The sites `:234` *does* name — the post-adoption `span_max` fence, the sub-lane micro-examples and the worked examples, and Step 2p.2's print blocks — are all present in the census with the classification `:234` assigns them; `:309` in particular is now named, which is the omission that shipped MF-1. `:208`'s narrowed claim (Step 2p applies rather than defines; its print blocks are ADR-0016 §5 displays) is true of the `SKILL.md:505` / `:533` / `:534` rows. ADR-0017's rewritten `:5` names the three amended `SKILL.md` locations, all three of which appear in the census, and its rewritten Consequences bullet states the same universal classification, which the census satisfies.

**Mechanical no-numeral-drift check, re-run IN FULL (AC-22).** Under the Phase 0 extraction convention (subsection heading line inclusive, through the line before the next heading; every maximal `[0-9]` run in document order), all five worked-example numeral sequences `diff` **byte-identical** pre- and post-edit — **505 numerals across 5 subsections**, zero differences — against this cycle's pre-edit tree (`HEAD` `d297e6c` + the parent FEAT's and prior FIX's uncommitted edits). The same check against the **regenerated distribution** copy is also identical. Prior green was not carried over; this run is fresh.

**Full hand re-derivation of all five worked examples from the POST-EDIT text, re-run IN FULL (AC-22).** Every figure re-derives; no numeral was adjusted, and none needed to be.

1. *The gate verdict and the ladder figure must agree* — `span_max` flat `max(12, 6) + 0` = **12**, nested `max(max(6,6)+0, 6) + 0` = **6**; overhead `A+J` = **4** vs `A+A+J+J` = **8**; `M_flat` = **16**, `M_nested` = **14**; `g` = 12−6 = **6**, `c` = 8−4 = **4**; `6 > 4` → **adopted**, and 14 < 16. All agree.
2. *One lane carries all the work* — `M_seq` = `T` = **24**; nested `span_max` = `max(8,8,8) + 0` = **8**; overhead `A+A+J+J+I((0+2)×0.25)` = **8.5**; `M_nested` = **16.5**; `g` = 24−8 = **16**, `c` = **8.5** → **adopted**. Leaf check `8/24` = **33%** ≤ 70%, 3 leaves ≥ 2. Counterfactual `{20, 4}`: `span_max` = **20**, `g` = **4** ≤ `c` 8.5 → **rejected**. All agree.
3. *A split carrying an integration sub-lane* — `span(mobile)` = `max(concurrent) + tasks(integration)` = `5 + 6` = **11** = `span_max`; overhead `A+A+J+J+I(8×0.25)` = **10**; `M_nested` = **21** vs `M_seq` **24**; `g` = 24−11 = **13**, `c` = **10**, margin **3**, improvement `3/24` = **12.5%** → **adopted**. Pre-field defect re-derived: `tasks(integration)` = 0 → `span_max` **5**, `g` = 24−5 = **19**, margin **9**, error **6**. Aggregate `8 ≤ 24`; superseded `min(leaf)` = 3 would have rejected. All agree.
4. *`k = 2`* — `T` = **38**, largest `24/38` = **63%** ≤ 70% → flat viable; `span_base` = **24**, flat overhead **4**, `M_flat` = **28**. Adoption 1: `span(A)` = `max(8,8,8)+0` = **8**, `span_max` = `max(8,10,4)+0` = **10**, overhead **8.5**, `M_nested` = **18.5**, `g₁` = **14**, `c₁` = **4.5** → adopted. Adoption 2: `span(B)` = **5**, `span_max` = `max(8,5,4)+0` = **8**, overhead **9**, `M_nested` = **17**, `g₂` = **2**, `c₂` = **0.5** → adopted. Superseded serialized charge: `c₂` = **2.5** > `g₂` **2** → rejected, and its own `M_nested` = **19** > 18.5, so gate and ladder agreed then too. Reconciliations: overhead `9 − 4` = **5** = 4.5 + 0.5; span `24 → 8` = **16** = 14 + 2. Gates: 6 leaves summing to **38**, largest `8/38` = **21%**, interface `0+2+2` = **4** ≤ 38, 6 leaves ≤ **6**. All agree.
5. *A declared top-level integration lane* — `T` = **42**, `X` = **4**; largest `20/42` = **48%** ≤ 70% → viable; `M` = **20**, `span_base` = `M + X` = **24**, flat overhead `A+J+I(4×0.25)` = **5**, `M_flat` = **29**, `M_seq` = **42**. Adoption: `span(backend)` = `max(8,8)+0` = **8**; non-integration term `max(8,12,6)` = **12**; `span_max` = `12 + 4` = **16**; overhead `A+A+J+J+I(6×0.25)` = **9.5**; `M_nested` = **25.5**; `g` = 24−16 = **8**, cross-checked by the cancellation identity `M − S` = 20−12 = **8**; `c` = **4.5** → **adopted**. Reconciliation `29 − 25.5` = **3.5** = `8 − 4.5`. `frontend` `{11,1}`: `11/12` = **92%** > 70% → rejected; `admin` off the critical path → `g = 0`; `wiring` never a candidate. Gates: `4+2` = **6** ≤ 42; leaf set `{8,8,12,6}`, largest `12/42` = **29%** ≤ 70%; 4 leaves ≤ **6**. Checked against `config.md:461`'s **uncorrected-model oracle**: `span_base` `max(20, 4)` = **20** and `span_max` `max(12, 4)` = **12**, giving `g` = **8** either way and `25 − 21.5` = **3.5** reconciling either way, with both makespans understated by exactly `X = 4` — reproduced exactly as printed. All agree.

**The new SF-1 definition is consistent with every printed figure**, which is the check that matters most for a definition added this cycle: on worked example 5, `second_largest_span` under the new `:312` wording (the maximum of `span(L)` over the **other non-integration lanes** — `frontend` 12 and `admin` 6, with `wiring` excluded) is **12**, so `:309` gives `max(12, span(backend) 8) + tasks(i(run)) 4` = **16**, matching `:449`'s printed `span_max` of 16 and `SKILL.md:534`'s `max(second-largest span {n}, …)` slot. Excluding `wiring` from the ranking changes no printed figure here (4 < 12) while blocking the double-charge in the general case, exactly as intended.

**Anchor + quote-fidelity census post-regeneration (AC-23, AC-25).** **3 / 3 / 2 / 1** — `':(exclude).claude'` = 3, `the call shape from *How to spawn a subagent*` = 3, `through a **single sequential coder invocation**` = 2 in `SKILL.md`, its unbolded quotation = 1 in `references/config.md` — plus exactly **1** overlay `find` string from `prime-agent/overlays/orchestrator.json` occurring in `references/config.md`. The full per-overlay-anchor occurrence table `diff`s **identical** to Phase 0. Quote fidelity holds at full length: `config.md:243`'s unbolded quotation still matches the `SKILL.md` wording it cites, clause for clause (`— after its sibling sub-lanes are DONE, never concurrently with them`), 1 occurrence each. `grep 'min(S' references/config.md` = **0**; no `min(S, X)` claim was introduced, and it stays in ADR-0016 and ADR-0017.

**Heading inventory and cross-references (AC-24, AC-29).** `references/config.md`'s heading list `diff`s **identical** to Phase 0 — **31** headings, none renamed, removed, added or re-levelled — and `SKILL.md`'s Step 2p region heading inventory is **byte-identical**. Every cross-reference target touched or introduced by this cycle's rewrites resolves by title: *The makespan model*, *Marginal-gain rule*, *The inner viability gate* (headings, 1 each); *The baseline* (bold in-paragraph anchor); `SKILL.md`'s `2p.1` and `2p.2` sub-headings; the `Integration lane:` line that the new `:544` cites (present in the flat print block); ADR-0016 and ADR-0017 files.

**No-regression floors (AC-28).** `cd plugins/my-skills/skills/clean-code-gates && npm test` → **225 pass / 0 fail**. `node scripts/build-prime-agent.mjs --check` → exit **0**. `cd prime-agent && npm test` → exit **0**. All three identical to their Phase 0 values.

**`git status` (AC-27).** Changes confined to `plugins/my-skills/skills/orchestrator/references/config.md`, `plugins/my-skills/skills/orchestrator/SKILL.md`, `docs/adr/0017-*.md` (untracked, work-in-flight, corrected in place), `prime-agent/skills/orchestrator/{SKILL.md,references/config.md}` (regenerated), and `plans/**`. `docs/adr/0016-*.md` still shows as modified from the **parent FEAT's** pure append and was **not** touched this cycle (`md5` identical to Phase 0). No file under `prime-agent/` was hand-edited.

**SF rulings, recorded per AC-17 / AC-18 / AC-19.**

- **SF-1 — ACCEPT, implemented.** Deferring a third time was declined. `second_largest_span` is now defined in the prose at `:312` that already governs the fence, naming it as the maximum of `span(L)` over the post-adoption lane set's **other non-integration lanes** and stating that ranking **all** lanes double-charges `i(run)` whenever the integration lane ranks second. The CR's own suggested placement — a parenthetical inside the `:309` fence — was **not** adopted, because the same CR's verdict makes `:309` untouchable and a plan that both pins a line and edits it is the precise defect this cycle exists to correct. **No numeral was added** (`references/config.md` character-class numeral count **1203 → 1203** across Phase 2, measured against this cycle's pre-edit tree) and `:309` is **byte-identical**. The BLOCKED route was not needed.
- **SF-2 — DEFER, upheld a third time.** No edit was made to `:243`, `:246` or `:232`. The load-bearing content a wholesale merge would destroy, re-enumerated **by name**: `:243`'s exact **unbolded** Step 3s quotation — a cross-document quote-fidelity anchor pinned at exactly **1** occurrence against this cycle's pre-edit tree and re-verified at 1 post-regeneration — together with its Step 3s citation, its "overstates the **gain** rather than understating the cost" defect-class point, and its **ADR-0012** attribution; `:246`'s Step 3j **and** Step 3L citations, its counts-in-full scope limit over `span_base` / `span_max` / `M_flat` / `T`, and its **ADR-0016** attribution; and `:232`'s generic statement of the concurrent/serial split, which is what now trebles the overlap. Merging the three would collapse two distinct depth-specific attributions and one quote-fidelity anchor into a single paragraph that could carry at most one of each.
- **SF-3 — NO REWRITE, and its discipline adopted as a rule of this plan.** The `.progress.md` contract is append-only; the correction already stands on record in `TEST-20260819T111853Z-17d4` §4 and in `CR-20260819T112837Z-9e42`; and `ADR-0017:176` — "four of the five bodies byte-identical" — records its figure against the right baseline and was **not** touched (verified present and unchanged after the Phase 4 rewrite, whose diff is confined to `:5` and the Consequences bullet). **Every byte-identity and numeral figure this cycle wrote into any progress log, plan or ADR names its baseline in the same sentence**: throughout this log the baseline is **this cycle's pre-edit tree** = `HEAD` (`d297e6c`) plus the parent `FEAT-20260819T101153Z-e883`'s and the prior `FIX-20260819T105159Z-3cd7`'s uncommitted edits — never `HEAD` alone — except where `HEAD` is named explicitly, as in ADR-0016's `git diff --numstat HEAD` of `11  0`. Phase 4 wrote **no** new figure into ADR-0017; it removed two counts and added none.

**No behavioural or executable test was emitted, and none is reachable (AC-30).** `parallelism` defaults to `off` in this repository and the `full` level with `k >= 2` is unreachable here, so **no path executes the span rule**; there is nothing to drive. This matches `PROJECT-CONTEXT.md` → *Test tooling* ("No automated test framework for doc-skill changes… verification is structural"). Verification for this plan was therefore structural and arithmetic throughout: re-runnable `grep` oracles observed failing then passing, byte-identity `diff`s against a pre-edit snapshot, a classified site census, a mechanical numeral-sequence `diff`, and a full hand re-derivation. **Coverage is inapplicable, not below floor**, and no behavioural test was invented to satisfy a coverage habit. G1 (coverage) and G6 (mutation) remain QA-owned and were not emitted.

**All `.progress.md` files stayed append-only (AC-31).** Only this plan's own `.progress.md` was written, and only by inserting new entries ahead of the `## Handoff` section; the `ARCHITECT` entry is intact and no prior entry was altered. The parent `FEAT`'s and the prior `FIX`'s progress logs were **not written to at all** this session.

**Phase 5 gate commands.** `node scripts/build-prime-agent.mjs --check` → exit **0** outright (path condition `plugins/my-skills/skills/orchestrator/**` matched). `cd prime-agent && npm test` → exit **0** (path condition `prime-agent/**` matched by the regeneration). `clean-code-gates` ran as the no-regression floor only, **225 / 0**, never as a per-phase gate — its path condition `plugins/my-skills/skills/clean-code-gates/**` is matched by no phase's diff, and `PROJECT-CONTEXT.md` is explicit that it must not be invoked against non-JS doc skills.

### 2026-08-19T12:50:00Z | CODER

All 37 tasks complete. Plan status → DONE. Ready for reviewer.

### 2026-08-19T12:03:12Z | TESTER

TEST-20260819T120312Z-5d31 created. Status: PASS. Coverage: n/a → n/a (inapplicable — docs-only, no executable path; `parallelism` is `off`, `full` with `k >= 2` unreachable).

MF-2 and SF-1 verified closed. MF-1's open form verified genuinely self-maintaining, and the post-edit census finds **zero** second normative definitions. Two findings routed to the reviewer: **F1 (Must-Fix-grade)** — `config.md:208` and `:234` attribute the **nested** Step 2p.2 print block's expanded form to ADR-0016 §5, whose own heading scopes it to the **flat** block, regressing `CR-20260819T104419Z-fc4f` MF-3 into the normative reference (instructed by this plan's AC-1(d), so a plan defect propagated, not a coder defect); **F2 (Should-Fix-grade)** — `:208` reintroduces a count ("its **two** Step 2p.2 print blocks"), true today but the same self-invalidating shape AC-7 removed from ADR-0017 `:5` this cycle.

No figure moved, on a stronger oracle than required: all five worked-example numeral sequences are byte-identical to `HEAD` (`d297e6c`) across all three uncommitted cycles. This cycle's `SKILL.md` diff independently confirmed as exactly one line (`:544`); `:309`, `:546` and the nested block byte-identical, corroborated against artifacts written before this cycle. Floors green: `clean-code-gates` 225/0, `--check` exit 0, `prime-agent && npm test` exit 0.

### 2026-08-19T12:17:37Z | REVIEWER

CR-20260819T121737Z-7abb created. Status: APPROVED. Must Fix: 0. Should Fix: 3.

All 31 acceptance criteria met. Both cycle-2 Must Fix findings ruled structurally closed. The tester's F1 (ADR-0016 §5 attributed to both Step 2p.2 print blocks when §5 reaches only the flat one) was verified against §5 directly and confirmed as fact, but **ruled Should Fix rather than Must Fix**: it is a false citation attached to a correct maintenance instruction, in a file that does not own the claim, with the accurate scoping already recorded three times in Accepted ADR-0017, and it does not decay. Recorded as SF-1 with the one-clause repair specified; SF-2 (the reintroduced count at `:208`) shares that repair. SF-3 records the census oracle gap that let three cycles' defects reach review — the census verifies site membership but never the prose attached to each named site.

Reviewer's convergence judgment: **converging, not churning** — severity falls monotonically across the three cycles (wrong arithmetic → false census + wrong guard → over-reaching provenance clause), count falls 3 → 2 → 1, and the failure mode changed kind from self-invalidating to static.

Independently re-verified: worked-example region `md5`-identical to `d297e6c` (507 numerals); `:309` fence intact; census yields zero second normative definitions; worked example 5 re-derived by hand (`span_max = 16`, `g = 8`); distribution in sync (`--check` exit 0, 11 skills / 154 files); floors 225 pass / 0 fail.

### 2026-08-19T12:24:46Z | QA

QA-20260819T122446Z-d349 created. Status: READY_WITH_WARNINGS. Failures: 0. Lint/type errors: 0.
