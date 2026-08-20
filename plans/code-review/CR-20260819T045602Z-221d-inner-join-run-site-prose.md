---
id: CR-20260819T045602Z-221d
plan: FIX-20260819T043728Z-13ae
title: Review of Correct the surviving inner-join run-site prose and fold back the corrected counterfactual
status: APPROVED
created_at: 2026-08-19T05:01:33Z
reviewer: reviewer-agent
cycle: 2
must_fix_count: 0
should_fix_count: 3
---

**Related:** [FIX-20260819T043728Z-13ae](./FIX-20260819T043728Z-13ae-inner-join-run-site-prose.md) · [CR-20260819T043042Z-a7b9](./CR-20260819T043042Z-a7b9-adopt-overlapped-inner-joins.md) · [FEAT-20260819T035826Z-835a](../feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md) · [SPEC-20260819T034803Z-18d2](../specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md) · [TEST-20260819T042313Z-1acb](../test/TEST-20260819T042313Z-1acb-adopt-overlapped-inner-joins.md)

## Summary

Cycle-1's blocker is genuinely closed, and closed the way the CR asked: the vacuous clause is deleted outright rather than hedged, the never-drops guarantee survives in the paragraph's own words, and the recording hop and the run site are now named separately at all three prose sites plus the newly-pinned ordering clause. I re-ran the whole verification surface independently rather than reading the coder's log — all 21 grep-shaped rows of the parent plan's Phase-2 set, every row of this plan's own set, both exact-count overlay anchors (3 / 3, with the near-miss phrase still at 2), `--check` exit 0, `prime-agent` npm test exit 0, `clean-code-gates` 213/0 — and confirmed the generated tree carries all four corrections with no hand-edit residue.

All three verification-row substitutions are correct, and each is a plan-authoring bug the coder was right to surface rather than silently pass. I verified each premise myself: `git status --porcelain prime-agent/skills/` is indeed non-empty today (three modified generated files, from the parent plan's uncommitted regeneration under the never-commit invariant), the spec and FEAT plan each carry exactly 15 occurrences of the banned literal and always did, and the FEAT plan is untracked so `git diff` over it would have passed vacuously — the weakest possible outcome. In all three cases the substitute is the stronger check, not the more convenient one.

Three warnings, none blocking. Two are the same sentence: the corrected preamble's lead clause attaches *"records rather than running"* to "the nearest enclosing join" generically, which is false of the outer join it names in the same breath — and the clause it inherited that framing from is **AC-1's own wording**, so this is a plan-authoring artifact, not a coder deviation. The third is a `1` / `1.0` inconsistency that turns out to sit **inside** the shipped worked example, five lines apart, which changes the answer to the question the orchestrator raised.

Verdict: **APPROVED**. All 17 acceptance criteria met, zero Must Fix.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | MF-1 — preamble names the recording hop and the run site separately, citing Step 3s item 3 and ADR-0013 | ✅ | `SKILL.md:958`. Names Step 3j item 4 as "the single de-duplicated run site", cites Step 3s item 3 and ADR-0013. See **SF-1**/**SF-2** for two clauses in the same sentence that are imprecise but do not unmeet this criterion. |
| 2 | MF-1 — `when its own inner join can run it` deleted outright, not softened | ✅ | 0 occurrences in `SKILL.md`, 0 in the generated copy. No hedged variant substituted. |
| 3 | MF-1 — the never-drops guarantee survives in the paragraph's own words | ✅ | *"Deferral therefore only ever moves a gate **outward** to a wider scope; it never drops one, at any depth."* Deleting the false half did not cost the true half — the specific risk the CR named. |
| 4 | SF-1 — `config.md` condition 4 names both hops; its own test textually unchanged | ✅ | `config.md:437`. *"can be **scoped to a sub-lane's paths**"* is byte-identical to before; the tail now reads *"defers to the inner join, which records it for the outer join rather than running it (`SKILL.md` → Step 3j item 4 is the single run site for every deferred gate, at either depth; ADR-0013)"*. A citation, not a parallel formulation — which is what the single-source-of-truth convention required. |
| 5 | SF-2 — `templates/coder.md`'s instruction unchanged in substance | ✅ | Verified literally: *"defer it to the nearest enclosing join"*, *"Note the deferral in `.progress.md` and proceed"*, and *"Deferring is the correct outcome here, not a failure"* all survive verbatim. **No action the coder takes changed** — confirmed by diffing the line: the only edit is between the semicolon and the "Deferring is the correct outcome" sentence. |
| 6 | SF-2 — only the two false explanatory clauses change | ✅ | `that join runs it once over its own scope` → 0 occurrences; the trailing `A sub-lane never defers a gate past its own inner join when that join can run it.` → 0 occurrences; `Step 3j item 4` now named. Nothing else on the line moved. |
| 7 | SF-2 — the scope amendment is explicit | ✅ | Recorded in `.progress.md` at 2026-08-19T04:58:00Z, before the `templates/coder.md` edit, quoting the FEAT plan's out-of-scope entry and stating why its justification covers the instruction and not the explanation. Correct order: amendment recorded, then edit. |
| 8 | SF-3 — Step 3j item 4 pins the run order, in Step 3s's established style | ✅ | `SKILL.md:1063`: *"**The de-duplicated set runs in lane-map row order of first deferral**, ties broken by the gate's command string — never analysis order and never completion order"*. Reuses Step 3s's `SUBJOIN` vocabulary exactly, per the Mirror-machinery convention. The rule is well-defined: *first deferral* is resolved in row order, not wall-clock, so it is deterministic under overlap — which is the whole point. De-duplication rule, union scope, blocking non-zero exit and `PARTIAL` routing all read unchanged around it. |
| 9 | No literal `k × J` / `k×J` introduced in any edited file | ✅ | 0 in `SKILL.md`, `config.md`, `coder.md` and the generated tree. In the spec and FEAT plan: **15 / 15**, unchanged — see the substitution ruling below. |
| 10 | Both near-miss exact-count anchors still exactly 3; near-miss phrase still 2 | ✅ | Re-counted independently: 3 / 3 / 2. `--check` raised no exact-count overlay error. |
| 11 | `prime-agent/skills/**` regenerated, never hand-edited; `--check` exits 0 | ✅ | `--check` → *"prime-agent/skills is up to date (11 skills, 154 files)"*, exit 0. All four corrections present in the generated copies; both deleted clauses absent from them. The porcelain-empty half of this AC was unsatisfiable — see the substitution ruling. |
| 12 | `cd prime-agent && npm test` exits 0 | ✅ | Re-run: install ok (preflight, containment, all-or-nothing, mid-loop rollback) + parity ok. Exit 0. |
| 13 | The FEAT plan's full Phase-2 assertion set re-runs green | ✅ | I re-ran all 21 grep-shaped rows myself: every one passes. The arithmetic row is re-derived below. The state-dependent `--check`-non-zero row is correctly superseded by AC-11's exit 0 after Phase 3, exactly as the Technical Notes describe. |
| 14 | `clean-code-gates` still 213 passing / 0 failing | ✅ | Re-run: `# pass 213 / # fail 0`. Run as a floor only, never applied to the markdown — the PROJECT-CONTEXT boundary is respected. |
| 15 | SF-4 — spec FR-16 and the FEAT plan's Phase-2 task text state 19 in expanded form | ✅ | Both now read `span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)` = **19**. The `2 join passes` phrasing that dodges the banned literal is preserved in both. |
| 16 | SF-4 — the correction is logged where it will be found | ✅ | New `## Corrections` section in the spec (L229–239) naming `FIX-20260819T043728Z-13ae` and `CR-20260819T043042Z-a7b9`, stating that the slip was in the printed total and not the expression, that the shipped example always carried 19, and that 19 > 18.5 keeps the qualitative point intact. This is a better artifact than the CR asked for — it makes the figure self-checking against the terms beside it. |
| 17 | No worked-example figure in `config.md` changes | ✅ | The shipped `k = 2` example is untouched; the fold-back moved the upstream artifacts to it, never the reverse. See **SF-3** for a formatting inconsistency inside that example that predates this plan. |

### Verification re-run independently

I did not take the coder's log on report. Re-run from the working tree:

- **Parent plan's Phase-2 assertion set** — all 21 grep/count rows pass, including the four that guard against regressing the parent change (`! grep "Run every gate this lane's sub-lanes deferred"`, `! grep "once over the **settled** lane union"`, `! grep "has already completed"`, `! grep "Wait for all of them, then join — inner joins first"`).
- **This plan's assertion set** — every row passes on both the source and the generated tree.
- **Arithmetic (SF-4)** — `8 + 2 + 2 + 4 + 2 + 1` = **19**, against `A = 2`, `J = 2`, 4 aggregate interface points at `0.25`. The spec's superseded `20` was a slip in the printed total only; its own expression always evaluated to 19. The shipped example's `M_nested` = 17 and `M_flat` = 28 are untouched, and both FR-16 reconciliations still hold (Σ`c` = 4.5 + 0.5 = 5 = 9 − 4; Σ`g` = 14 + 2 = 16 = 24 − 8).
- **Floors** — `--check` 0, `npm test` 0, `clean-code-gates` 213/0.
- **Cross-site sweep** — I grepped every co-occurrence of "inner join" and "defer" across the whole `orchestrator` skill to check for a fourth site the plan missed. There is none: `SKILL.md:958`, `:970`, `:1014`, `:1063` and `config.md:437` are the complete set, and all five are mutually consistent about where a gate runs.

### Ruling on the three verification-row substitutions

All three are **correct**, and all three are plan-authoring bugs rather than implementation issues, exactly as the coder characterised them. I verified each premise rather than accepting the characterisation.

1. **`git status --porcelain prime-agent/skills/` is empty (AC-11, Phases 1–3).** Unsatisfiable by construction, confirmed: the command returns three modified files right now, because the parent plan's regeneration is uncommitted and the pipeline never commits. The row could only ever have passed on a tree where the parent plan's work had been committed — which the never-commit invariant forbids. The substitute (`--check` exit 0 plus a recorded tree-content hash held across Phase 2) is **strictly stronger** for the property AC-11 actually protects: porcelain-empty proves only *no change since HEAD*, whereas `--check` exit 0 proves the tree is byte-identical to what the builder produces from source, which is precisely "never hand-edited". Right call.
2. **`! grep -qE 'k × J|k×J'` over the spec and FEAT plan (Phase 4).** Confirmed unsatisfiable without vandalism: both documents carry exactly **15** occurrences each, today and before, because they are documents *about* banning that literal — the parent plan's AC-1 text, FR titles, and the References section all quote it. Satisfying the row literally would have deleted the parent plan's own acceptance criterion. AC-9 says *introduced*, and the delta test (15/15 before and after) is the faithful reading of it. Keeping the ban **absolute** over `$SK`, `$CFG`, `$CODER` and the generated tree — where it is both satisfiable and load-bearing — is the right split, and I verified it holds there (0 occurrences). Right call.
3. **`git diff --stat plans/feat/` (Phase 4).** Confirmed: the FEAT plan is untracked, so `git diff` over it emits nothing and the row would have "passed" while proving nothing — the worst kind of green. The reconstruction diff against exact pre-edit content is the only way to make the assertion mean what it says. I independently corroborated the outcome by structure: the FEAT plan is still `status: DONE`, with 103 checked and **0** unchecked boxes, and its Phase-2 counterfactual task still carries `[x]`. Right call.

The common thread is worth recording: in all three cases the honest substitute is *harder to pass* than the row it replaced. Nothing here reads as a convenience.

### Ruling on the skipped tester re-run

**Right call.** The change is four prose sites plus two figures in pipeline artifacts; no executable path exists (`parallelism` is `off` here, `full` with `k ≥ 2` unreachable); the cycle-1 TEST report already recorded coverage as N/A with structural-only verification for this exact surface; and the cycle-1 CR flagged no test gap to close. A tester pass would have re-emitted the same posture statement over a strictly smaller diff.

One condition on that, worth stating because it is what makes the skip safe rather than merely cheap: the skip is defensible **because** this review re-ran the parent plan's assertion set and all three floors independently rather than reading them off the coder's log. A future cycle that skips the tester *and* accepts the coder's floors on report would leave nothing independent between implementation and QA. Not a finding against this cycle — a note for the next one.

### Ruling on `I(4×0.25=1.0)` vs `I(4×0.25=1)`

The coder was right not to resolve this unilaterally — AC-15 and AC-17 pull in opposite directions and neither yields to the other without a ruling. But the framing in the brief is slightly off, and the correction changes the answer: **the divergence is not between the upstream artifacts and the shipped example. It is inside the shipped example.** `config.md:386` writes `I(4×0.25=1.0)` in the accumulated-overhead row; `config.md:391` writes `I(4×0.25=1)` in the counterfactual sentence five lines below. Both upstream artifacts agree with L386.

So the odd one out is a single occurrence at L391, contradicting its own example's local convention. It should be normalised **to `1.0`**, moving L391 to match L386 — not the other way round, and not by touching the upstream artifacts. Filed as **SF-3**: cosmetic, same quantity, no reader misled, and it needs a `prime-agent` rebuild it does not deserve on its own — so it should ride the next change that touches the file rather than triggering one.

## Must Fix (Blockers)

None — no blockers found. Cycle-1's MF-1 is closed.

## Should Fix (Warnings)

### SF-1 — `SKILL.md:958`'s subject inverts the deferral criterion (pre-existing)

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:958`

**Problem**: The paragraph opens *"**Path-scoped gates defer to the nearest enclosing join…**"*. It is gates with **no** path-scoped form that defer; a path-scoped gate is run in-lane. The skill says so twice within 31 lines — `SKILL.md:947` (*"runs only path-scoped gates, defers unscopable gates to the nearest enclosing join"*) and `SKILL.md:989` (*"A deferred gate is **by definition** one with no path-scoped form"*) — and `templates/coder.md:153` opens with the correct condition (*"If a gate has **no path-scoped form** … defer it"*).

This is **pre-existing**: the subject is unchanged from base `5403eee`, and neither the FEAT plan nor this FIX plan introduced it. It is a warning rather than a blocker for that reason, and because the authoritative instruction the leaf coder actually reads (`templates/coder.md`) states the condition correctly. But it is worth filing now for two reasons: cycle-1's own suggested rewrite silently repaired it (*"A gate with no path-scoped form defers to the nearest enclosing join…"*), and so did this plan's Phase-2 task text — the coder kept the old opening because **AC-1 quotes it as the paragraph's identifier**, which is a reasonable reading of a criterion that names the paragraph by its first words.

**Fix**: `**A gate with no path-scoped form defers to the nearest enclosing join…**`. One clause, same rebuild as SF-2 below — the two edits are in the same sentence.

---

### SF-2 — "records rather than running the gate" is attached to the wrong join, in two files

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:958`; `plugins/my-skills/skills/orchestrator/templates/coder.md:153`

**Problem**: Both corrected sites bind the record-don't-run predicate to *"the nearest enclosing join"* generically, then name two joins as its referents:

> `SKILL.md:958` — *"defer to the nearest enclosing join, **which records the deferral rather than running the gate*** — the **inner** join for a sub-lane, the **outer** join for an unsplit lane."*
>
> `coder.md:153` — *"…the **inner** join if you are a sub-lane, the **outer** join if you are an unsplit lane. … that join **records** the deferral rather than running the gate, and passes it outward…"*

For an unsplit lane the nearest enclosing join **is** the outer join, which does not record-and-pass-outward — it runs the gate, and there is nothing further out to pass it to. So each sentence is false of one of its own two named referents, and `SKILL.md:958` briefly contradicts itself: the outer join records rather than running, and the outer join is where every deferred gate runs.

This is materially milder than the MF-1 it replaced. Both paragraphs resolve themselves within the same sentence (*"every deferred gate runs at the outer join — Step 3j item 4"*), the citation lands on a step that is unambiguous (*"the single place any of them runs"*), and the coder's action is identical under either reading — defer, note, proceed. Nothing executable inverts. But it is the same shape of defect the cycle blocked on, half-reintroduced by over-generalising a rule that is only true of the inner join.

Note this is **not a coder deviation**: AC-1 itself reads *"It names the nearest enclosing join as where the deferral is **recorded**"*, so the imprecision is inherited from the criterion. The plan is where it should be fixed next time.

**Fix**: bind the predicate to the inner join and let the outer join keep both roles. E.g. at `SKILL.md:958`:

> **A gate with no path-scoped form defers to the nearest enclosing join** — the **inner** join for a sub-lane, the **outer** join for an unsplit lane. **A sub-lane's inner join records the deferral rather than running the gate**, and passes it outward (Step 3s item 3); **every deferred gate runs at the outer join** — Step 3j item 4, the single de-duplicated run site, and the first point at which nothing else is in flight (ADR-0013). Deferral therefore only ever moves a gate **outward** to a wider scope; it never drops one, at any depth.

and the parallel trim at `coder.md:153` (*"if you are a sub-lane, that join records the deferral and passes it outward; every deferred gate runs once, at the outer join…"*). Same rebuild as SF-1. Do **not** hand-edit `prime-agent/skills/**`.

---

### SF-3 — `config.md`'s `k = 2` example writes the same interface term two ways

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:386` and `:391`

**Problem**: L386's accumulated-overhead row reads `I(4×0.25=1.0)`; L391's counterfactual sentence reads `I(4×0.25=1)`. Same quantity, same example, five lines apart. Both upstream artifacts (spec FR-16, FEAT plan Phase-2 task) now agree with L386, so L391 is the sole outlier — including within its own file. The example carries a standing *"re-check this example whenever either side of the model is edited"* instruction, which makes it the one place a reader is explicitly invited to compare terms character by character.

Pre-existing (both forms shipped with the parent change) and cosmetic — no arithmetic is affected and no verdict moves.

**Fix**: `I(4×0.25=1)` → `I(4×0.25=1.0)` at L391 only. Leave the upstream artifacts alone; AC-17's rule that the shipped example is the anchor is right in spirit, and here the anchor's own two halves simply disagree. Not worth a rebuild of its own — fold it into the next change that touches `config.md`, alongside SF-1/SF-2 if those are taken.

---

## Verdict

**Status**: APPROVED

Cycle-1's blocker is closed correctly and without collateral damage, all 17 acceptance criteria are met, every floor and assertion re-runs green under independent verification, and the three substituted verification rows were each replaced by a stronger check and surfaced rather than passed.

Invoke `/qa` with plan ID `FIX-20260819T043728Z-13ae` to run the QA suite. The three warnings are all one-clause prose edits requiring a `prime-agent` rebuild; SF-1 and SF-2 sit in the same sentence and should travel together, and SF-3 should ride whichever change touches `config.md` next rather than triggering a rebuild alone.
