---
id: TEST-20260819T120312Z-5d31
plan: FIX-20260819T113512Z-438c
title: Test Report — Replace the closed span-shape census with an open form and repair the slot guard (CR-20260819T112837Z-9e42)
status: PASS
created_at: 2026-08-19T12:03:12Z
cycle: 0
---

**Related:** [FIX-20260819T113512Z-438c](../code-review/FIX-20260819T113512Z-438c-open-span-claim-slot-guard.md)

## Summary

Cycle 3 of the span-rule chain. Docs-only; no executable path exists for this surface and none can be written (`parallelism` is `off` in this repo, `full` with `k >= 2` unreachable). **Coverage is inapplicable, not below floor** — per `PROJECT-CONTEXT.md` → *Test tooling* and the plan's AC-30. No behavioural test was invented.

**MF-2 (`SKILL.md:544`, the slot guard) is genuinely closed.** Three slots, three distinct declared sources, and the copy hazard on the `:533`↔`:534` pair is named explicitly, including the `none`-vs-declared asymmetry that is exactly worked example 5's shape. The mis-fill that printed `g = 24 − 12 = 12` is **not reachable** from the guard's text. This cycle's `SKILL.md` diff is exactly one line (`:544`), independently confirmed.

**SF-1 is closed and is better than the CR's own suggestion.** `second_largest_span` is defined at `:312` without touching the fence; `:309` is byte-identical, corroborated by three artifacts written *before* this cycle. The definition also silently repairs a latent naming ambiguity (see §5).

**MF-1 (the open claim) is closed *as a form* but ships a new false attribution.** The universal classification is genuinely open and genuinely self-maintaining — that half survives adversarial attack, and the post-edit census finds **zero** second normative definitions. But the *examples* attached to it carry a substantive attribution that is false in the shipped tree, and it regresses a Must Fix already fixed in cycle 1 (`CR-20260819T104419Z-fc4f` MF-3). Routed as **F1 (Must-Fix-grade)**.

**No figure moved**, verified by a stronger oracle than the plan required: all five worked-example numeral sequences are **byte-identical to `HEAD` (`d297e6c`)** — spanning all three uncommitted cycles, not just this one.

## Flows Triaged

Skill behaviours here are prose/arithmetic contracts, not executable paths. Criticality = user impact × breakage likelihood × not-covered-by-unit.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| The open claim at `config.md:234` is true of the post-edit, post-regeneration tree | **High** | **e2e-equivalent: full classified census over the post-edit tree** | A claim about the ABSENCE of duplication shipped false twice; the census is what caught it both times. Re-run over the regenerated tree, including this cycle's own outputs. |
| The claim is genuinely self-maintaining (survives a future added site) | **High** | **e2e-equivalent: prescriptive-vs-descriptive analysis** | The whole point of replacing the list. A closed census in open clothes would fail identically next cycle. |
| `SKILL.md:544` slot guard — three slots, three sources, copy hazard | **High** | **e2e-equivalent: fill the template by hand from the guard's text alone, on worked example 5** | This is the defect the whole chain was convened to remove; the guard is where a template-filler actually looks. |
| No figure moves (both independent checks, in full) | **High** | **Both re-run in full, plus a HEAD-anchored superset** | This cycle rewrites the text the examples are checked against; prior green does not carry. |
| `:309` / `:546` / nested block byte-identity | **High** | **Verified against pre-cycle artifacts, not against the coder's own snapshot** | The coder's baseline is an uncommitted snapshot only it observed; independent corroboration was required. |
| Pinned invariants (3/3/2/1, `min(S`, 31 headings, ADR-0016, md5s) | Medium | Re-run in full | Cheap, and the `SKILL.md` edit puts overlay anchors at risk. |
| No-regression floors (`clean-code-gates`, `--check`, `npm test`) | Medium | Re-run in full | Unrelated surface; no-regression only. |
| Behavioural/executable test of the span rule | **Excluded** | **Not emitted** | `parallelism` is `off`; `full` with `k >= 2` is unreachable. No path executes the span rule — there is nothing to drive. Inventing one to satisfy a coverage habit is explicitly out of scope (AC-30). |
| `opencode` port parity | **Excluded** | Not applicable | `orchestrator` has no `.opencode/skills/orchestrator/` override port. |

## E2E Tests Added

**None, and none is reachable.** See AC-30 and the exclusion row above. The structural/arithmetic equivalents below were executed instead.

## Findings

### F1 — Must-Fix-grade — `config.md:208` and `:234` attribute the **nested** print block's expansion to ADR-0016 §5, which does not cover it

Both paragraphs rewritten this cycle name Step 2p.2's print blocks **in the plural** and attribute their expanded form to ADR-0016 §5:

- `:208` — *"where Step 2p writes one of them out expanded rather than referencing it by name — **its two Step 2p.2 print blocks** — that is **ADR-0016 §5's deliberate legibility decision**, a display of the arithmetic defined here and not a second definition of it."*
- `:234` — *"and `SKILL.md` → Step 2p.2's **print blocks**, where the shape is expanded so the integration slice's contribution is legible on screen — **a display decision recorded in ADR-0016 §5**, which is why **those blocks** restate rather than reference."*

ADR-0016 §5's own heading is **"Step 2p.2's *flat* print block divides by `span_base`"** and its body speaks only of the `Estimated speedup:` denominator (`SKILL.md:505`). It says nothing about the nested block.

ADR-0017 says so twice, in text this same cycle wrote or preserved:

- `:152`–`:158` (*What stands*) — *"§5's own heading … scopes that guarantee to the flat block. The **nested** block is **not** covered by it. Its `span_max` line was still carrying the superseded pre-ADR-0016 shape, so it was **corrected** rather than exempted."*
- `:196`–`:198` (Consequences, rewritten this cycle) — makes the same plural attribution **and then immediately scopes it** in the next sentence.

`config.md` makes the attribution with **no scoping sentence at all**.

Why this is Must-Fix-grade and not pedantry:

1. **It regresses a closed Must Fix.** `CR-20260819T104419Z-fc4f` MF-3 was precisely *"ADR-0016 §5's byte-for-byte guarantee is scoped by its own heading to the flat block and does not reach the nested one."* That correction now stands in the ADR and is contradicted in the **normative reference**, which outranks the ADR for an editor working in the skill.
2. **It is the load-bearing direction of the error.** An editor reading `:208` concludes the nested block is protected by a byte-for-byte legibility guarantee and declines to correct it — which is exactly the reasoning that left the nested `span_max` line carrying the superseded pre-ADR-0016 shape through two cycles.
3. **The "not a census" disclaimer does not cover it.** The disclaimer protects the example list's *completeness*. It does not protect the *correctness* of a substantive attribution attached to a named example. This is the seam the open form left open, and the first thing to land in it did so in the same cycle.

**Provenance note (not a coder defect).** The plan's own AC-1(d) instructed *"`SKILL.md` → Step 2p.2's print blocks (**with ADR-0016 §5 attribution for the display decision**)"* — plural blocks, unscoped attribution. The coder implemented the AC as written. This is a plan defect propagated, in the same class as the AC-5/AC-8 pair the CR corrected last cycle.

**Suggested repair** (text-only, moves no figure): scope both sentences the way ADR-0017 already does — attribute the **flat** block's expanded form to ADR-0016 §5, and record the **nested** block's expanded form as the correction ADR-0017 made (`CR-20260819T104419Z-fc4f` MF-3), not as an ADR-0016 §5 exemption.

### F2 — Should-Fix-grade — `:208` reintroduces a count ("its **two** Step 2p.2 print blocks")

True today: 2p.2 spans `SKILL.md:496`–`:568` and contains exactly two print-block fences (`:500`–`:510` flat, `:526`–`:542` nested). Verified.

But it is a **count in normative prose**, falsifiable by any later edit that adds a print block to 2p.2 — the identical self-invalidating shape the plan's own Technical Notes name (*"A count in a durable record is the same self-invalidating shape as a closed census"*) and that AC-7 removed from ADR-0017 `:5` in this very cycle. Removing a count from the ADR while adding one to the reference is a net-zero on the defect class. `:5`'s own repair — *"named rather than counted"* — is the model: *"its Step 2p.2 print blocks"* costs nothing and cannot be falsified.

### F3 — Advisory — the census's fourth classification word

The coder's census table classifies the ADR rows (`ADR-0016:89`/`:114`/`:143`, `ADR-0017:5`/`:46`/`:143`/`:157`) as **"illustration/record"**, then asserts the universal *"covers every non-definition row."* **"Record" is not one of the three classes** the universal names (application / illustration / display). The rows are all defensibly displays or illustrations — `ADR-0017:46` in particular is introduced by *"`references/config.md` → *The makespan model* states … :"*, which frames the fence as a quotation of config.md's statement, not as a rival one — so the universal does hold. But the census's own wording quietly widened the taxonomy while claiming it did not. No text change required; noted so the next census does not inherit a fourth class by accident.

## Verification Executed

### 1. Post-edit, post-regeneration census — every site writing the shape, classified

Scope: `references/config.md`, `SKILL.md`, `templates/architect.md`, `docs/adr/0016-*.md`, `docs/adr/0017-*.md`, plus the regenerated `prime-agent/skills/orchestrator/**`. Taken over the tree **as it stands now**, after regeneration — not against a carried-forward site list.

Commands: `grep -nE 'max[ (]' … | grep '\+'`, `grep -n '+ *tasks(\|+ *integration\|max over'`, plus a full sweep of every `span` mention in `SKILL.md` to catch prose forms the notation greps would miss.

| Site | Writes shape? | Classification |
| --- | --- | --- |
| `config.md:227` | yes (fence) | **normative definition — the sole one** |
| `config.md:309` | yes (fence) | **application**, normative, named as one by `:312` |
| `config.md:232`, `:316` | prose/micro-example | illustration |
| `config.md:248`, `:253`, `:264`, `:312`, `:314` | referential | application / reference |
| `config.md:346`, `:364`, `:382`, `:400`, `:402`, `:406`, `:416`, `:422`, `:441`, `:443`, `:447`, `:448`, `:461` | yes | illustration (worked examples) |
| `config.md:208`, `:234` | no — states the classification | claim about ownership |
| `SKILL.md:505` | yes | **display** — flat print block, 2p.2, ADR-0016 §5 |
| `SKILL.md:533`, `:534` | yes | **display** — nested print block, 2p.2 |
| `SKILL.md:544` | no formula restated | prose guard |
| `SKILL.md:546` | micro-example | illustration |
| `templates/architect.md` | **zero sites** — `grep -c 'max('` = 0; names `span_base`/`span_max`/`span(L)` referentially only (1 each) | n/a |
| `ADR-0016:89`, `:114`, `:123`, `:143`–`:144`, `:191`, `:196` | yes | display/illustration in a decision record |
| `ADR-0017:18`, `:46`, `:77`, `:82`, `:143`, `:145` | yes | display/illustration in a decision record; `:46` explicitly framed as quoting config.md |
| `prime-agent/skills/orchestrator/**` | regenerated mirrors | same classifications; `--check` exit 0 proves byte-sync |

**Result: exactly zero sites classified as a second normative definition.** AC-21 holds. Every non-definition site is covered by the universal (subject to F3's wording note). The site that shipped MF-1 last cycle — `config.md:309` — is now named in `:234` itself.

### 2. Is the claim genuinely self-maintaining? — attacked directly

The claim is **prescriptive, not merely descriptive**: *"That classification is universal, and it is the test to apply to any such site, one standing here today or one added tomorrow."*

- A future site added as an application/illustration/display → claim stays true. ✅
- A future site added as an independent definition → the claim tells the editor that site is a **violation**, rather than being silently falsified by it. ✅

That is a real structural difference from both predecessors, which asserted a fact about the current tree and were falsified the moment the tree moved. Verdict: **genuinely self-maintaining**, and it survives the test its two predecessors failed.

**Residual maintenance obligation the claim does not retire, and does not flag:** the named examples still carry substantive attributions that are falsifiable independently of completeness. F1 is exactly that failure, landing in the same cycle the form was adopted. The "not a census" disclaimer covers completeness, not attribution correctness.

Banned closed-census constructions, `references/config.md`: `Those are the only other places the shape appears` = **0**; `it does not restate them` = **0**; `the only other` = **0**; `two kinds of place` = **0**; `and nowhere else` = **0**; `exactly two places` = **0**; `exactly three places` = **0**. Open markers present (`include, for example`, `today`), classification stated as a universal. ✅
ADR-0017: `the shape survives **expanded** at the display sites` = **0**; `is amended at **one** site` = **0**. ✅

### 3. `SKILL.md:544` — the slot guard, filled by hand from the guard's text alone

Three slots, three sources, as read off `:544` with no other text consulted:

| Slot | Line | Source per the guard | Worked example 5 value |
| --- | --- | --- | --- |
| `{, + integration sub-lane {n}}` | `:531` | the critical leaf's **own lane's** declared field | (leaf in `backend`, `none`) |
| `+ integration({n})` | `:533` | the **candidate split's own** declared count | `integration(0)` — `backend` declared `none` |
| `+ integration({n})` | `:534` | the **lane-level** count, the run's top-level integration lane, the one `Integration lane:` reports | `integration(4)` — `wiring` |

Filling from the guard alone yields `span({backend}) = max(8, 8) + integration(0) = 8`, then `span_max = max(second-largest span 12, span(backend) 8) + integration(4) = 16`, then **`g = 24 − 16 = 8`** — matching `config.md:449`'s printed `span_max` of **16** and `:453`'s `g` of **8**.

**The mis-fill is not reachable.** Copying `:533` into `:534` yields `span_max = 12` and `g = 24 − 12 = 12`. The guard blocks it three ways: (a) it names the `span_max` slot's source as the lane-level field; (b) it states the slot is *"**never copied from the line directly above it**"*; (c) it names the exact trap shape — *"including when the candidate split declared `none` and the run did not"* — which **is** worked example 5. It further states the consequence in the error's direction (understates the critical path, overstates `g`). ✅ AC-10, AC-11, AC-16.

AC-12 preserved: never literal placeholders ✅; `none` prints `integration(0)` and omits the `Nested plan:` slot ✅; the original `Nested plan:` guard survives in substance (*"never copied from the first"*) ✅; **restates no formula** ✅. AC-13: `grep -c 'The two integration slots are populated' SKILL.md` = **0** ✅; `three integration slots` = **1** ✅.

*Minor imprecision, not raised as a finding:* "The three describe different lanes whenever the critical leaf does not belong to the candidate lane under evaluation, **or** the run declares a top-level integration lane" — each disjunct separates a different pair; under only the second, slots 1 and 2 may still coincide. Harmless, and the per-slot sourcing that follows is exact.

### 4. No figure moved — both checks in full, plus a stronger HEAD-anchored oracle

**Mechanical (superset of what the plan asked).** Extraction convention: each `#### Worked example — …` heading line inclusive through the line before the next heading of any level; every maximal `[0-9]` run in document order.

`diff` of the five subsections' numeral sequences, **`HEAD` (`d297e6c`) vs the working tree**: **identical**, 5 sections, 507 numerals, zero differences. This spans **all three uncommitted cycles**, not just this one — a strictly stronger statement than "identical to this cycle's pre-edit snapshot," and it does not depend on any snapshot only the coder observed.

*Note on conventions:* the three cycles have quoted three different totals (448, 505, 507) under three slightly different extraction conventions. Each is internally consistent pre-vs-post; none is comparable across reports. The HEAD-anchored `diff` above is convention-independent for the purpose it serves.

**The coder's `+8` characterisation — verified, not accepted.** `config.md:208`, `HEAD` vs now:

- `HEAD`: numerals `2 2` (two `Step 2p` citations).
- Now: `2 2 2 2 2 0016 5` (`Step 2p` ×3, `Step 2p.2` → `2 2`, `ADR-0016`, `§5`).
- Delta: the added tokens are exactly `2 2 2 0016 5` = **8 digit characters**. ✅ Exactly the claimed `+8`, entirely cross-reference identifiers, entirely on `:208`.

`:234` numerals: `2 2 0016 5` — all citation identifiers, no figure. `:312` numerals: **none**, pre and post. ✅

Whole-file numeral-sequence diff `HEAD` → now shows the only non-citation movement anywhere in `config.md` is the **parent FEAT's** consolidation of three duplicate exclusion blockquotes into one canonical statement (`{backend: 20, integration: 4}` / `83%` / `{a: 3, b: 3, integration: 18}` / `75%` each losing duplicate copies while surviving in the canonical text). Not this cycle, and no computed figure moved.

**`SKILL.md` numeral delta for this cycle: zero.** `:544` carries `0` (from `integration(0)`) pre and post. The file's single `+1` vs `HEAD` is a `0` on `:546`, added by the **prior** cycle. `grep -c '24 − 12'` in `SKILL.md` = **0** — the counter-example is recorded in the progress log and printed nowhere in the skill. ✅

**Hand re-derivation, re-run in full.** All five worked examples re-derive from the post-edit text; spot-verified independently against the printed table for example 5 (`max(20,12,6)=20`; `max(span(backend)=8,12,6)=12`; `+ tasks(integration) = +4`; `span_base` **24** / `span_max` **16**; `g = 24 − 16 = 8` cross-checked by `M − S = 20 − 12 = 8`; reconciliation `29 − 25.5 = 3.5 = 8 − 4.5`). ✅

### 5. Byte-identity — corroborated independently of the coder's snapshot

**`config.md:309`.** Current text: `max(second_largest_span, span(L after the split)) + tasks(i(run))`. This exact string occurs in **`CR-20260819T112837Z-9e42` (2×)**, **`FIX-20260819T105159Z-3cd7` (3×)** and **`TEST-20260819T111853Z-17d4` (2×)** — three artifacts written **before** this cycle. `:309` is byte-identical to the prior cycle's output. ✅ AC-5.

**`SKILL.md`.** `diff` vs `HEAD` reports exactly three single-line changes, `534c534`, `544c544`, `546c546`, with line count unchanged (1618 → 1618). `:534` and `:546` were the prior cycles' edits (`CR-9e42` quotes `HEAD`'s `:544` verbatim as the pre-edit text, proving `:544` was untouched before this cycle). **Therefore this cycle's `SKILL.md` diff is exactly one line, `:544`** — independently derived, not taken on report. The nested block `:526`–`:542` and `:546` are byte-identical to this cycle's pre-edit tree. ✅ AC-14, AC-15.

**SF-1 at `:312`.** `second_largest_span` now occurs **2×** (fence + definition); `other non-integration lanes` = **1**; the fence is untouched. On example 5 the new definition yields `second_largest_span` = 12 (`frontend` 12, `admin` 6; `wiring` excluded), so `:309` = `max(12, 8) + 4` = **16** — matching the printed figure. Excluding the integration lane changes no printed figure here (4 < 12) while blocking the double-charge in general. ✅ AC-17.

*Positive side effect worth recording:* the new wording — "the maximum of `span(L)` over the **other** non-integration lanes" — also resolves a latent ambiguity in the name `second_largest_span`. Read literally as "the second-largest lane span," `:309` would be wrong whenever `L` is *not* the critical lane; read as "max over the others," it correctly yields `g = 0` there, which is what the same section's zero-gain paragraph asserts. The definition makes that paragraph derivable rather than merely stated.

### 6. Pinned invariants

| Invariant | Result |
| --- | --- |
| `':(exclude).claude'` in `SKILL.md` | **3** ✅ |
| `the call shape from *How to spawn a subagent*` | **3** ✅ |
| `through a **single sequential coder invocation**` in `SKILL.md` | **2** ✅ |
| its unbolded quotation in `references/config.md` | **1** ✅ |
| overlay `find` strings from `prime-agent/overlays/orchestrator.json` occurring in `config.md` | **1** (the ADR-0001 link) ✅ — verified by parsing all 24 `find` strings, not by assertion |
| every other overlay anchor's occurrence count in `SKILL.md` | unchanged; `--check` exit 0 is the hard enforcement ✅ |
| `grep 'min(S' references/config.md` | **0** ✅ |
| `references/config.md` heading inventory | `md5` **identical to `HEAD`**, **31** headings ✅ |
| `SKILL.md` heading inventory | `md5` **identical to `HEAD`** (69 headings) ✅ |
| ADR-0016 vs `HEAD` | **0 lines removed, 11 added; `HEAD` is a strict prefix of the current file — pure append** ✅; `- **Status:** Accepted` on line 3 ✅ |
| ADR-0012 / 0013 / 0014 / `templates/architect.md` `md5` | `70eb1ec…`, `56b8f4a…`, `bc16761…`, `5a1dac6…` — **all identical to `HEAD`** and to the coder's Phase 0 values ✅ AC-26 |
| `prime-agent/**` hand-edits | none; `--check` exit 0; both fixes present in the mirrors by regeneration alone (`three integration slots` = 1, `never copied from the line directly above it` = 1, `The two integration slots are populated` = 0, `never an independent definition of it` = 1, both superseded `config.md` strings = 0) ✅ AC-27 |
| `.progress.md` append-only | all prior-cycle entries present and intact in the parent `FEAT`'s and prior `FIX`'s logs; only appends observed ✅ (untracked files — verified by content, not by `git`) |
| Cross-reference targets | *The makespan model*, *Marginal-gain rule*, *The baseline*, `2p.1`/`2p.2`, the `Integration lane:` line cited by the new `:544` (present at `SKILL.md:500`), ADR-0016 §5, ADR-0017 — **all resolve** ✅ AC-29 |

### 7. ADR-0017 re-audit against the post-edit tree (AC-8)

| Claim | Result |
| --- | --- |
| `:5` `Skills affected` — three `SKILL.md` locations named, **no count** | ✅ true and count-free; the three named locations are exactly the three changed lines (`:534`, `:544`, `:546`) |
| `:5` `templates/architect.md` **unamended**, names the quantities referentially, restates no formula | ✅ `md5` identical to `HEAD`; `span_base`/`span_max`/`span(L)` 1× each, `max(` = 0 |
| `:150`–`:151` every heading in `references/config.md` stands | ✅ heading `md5` identical to `HEAD` |
| `:152`–`:158` flat print-block template strings byte for byte; "every other line of the nested block stands byte for byte" | ✅ flat block `:500`–`:510` untouched vs `HEAD`; nested block's only changed line is `:534`, which this bullet itself records as corrected |
| `:147`–`:149` ADR-0012/0013/0014 unamended | ✅ `md5`-identical to `HEAD` |
| `:142`–`:146` `min(S, X)` lives here and in ADR-0016, not in `config.md` | ✅ `grep 'min(S' references/config.md` = 0 |
| `:176` "four of the five bodies byte-identical" | ✅ untouched (SF-3 honoured — append-only discipline held) |
| Consequences bullet rewritten to the open form, naming the `span_max` fence it had omitted | ✅ and it **scopes** the ADR-0016 §5 attribution in the following sentence — which is exactly what `config.md` fails to do (F1) |

## Coverage

**Inapplicable — not below floor.**

`PROJECT-CONTEXT.md` → *Test tooling*: no automated test framework for doc-skill changes; coverage is not measured outside `clean-code-gates`. The plan's AC-30 states the same and forbids inventing a behavioural test. `parallelism` is `off` in this repository and `full` with `k >= 2` is unreachable, so **no path executes the span rule**. Before → after: **n/a → n/a**.

No-regression floors (unrelated surface):

| Floor | Result |
| --- | --- |
| `clean-code-gates` — `node --test` | **225 pass / 0 fail** ✅ |
| `node scripts/build-prime-agent.mjs --check` | exit **0** — `prime-agent/skills is up to date (11 skills, 154 files)` ✅ |
| `cd prime-agent && npm test` | exit **0** — `install ok`, `parity ok` ✅ |

## Test-Quality Audit

No executable tests exist on this surface, so the audit targets the **oracles** the coder used as tests. Assessed for tautology and for the specific failure that shipped MF-1 twice.

**Strong.** The oracle-first discipline (assert failing → edit → assert passing) was followed and each oracle is a re-runnable `grep` or `diff` with a recorded pre-value, not a narrative claim. The census was genuinely retaken over the post-edit, post-regeneration tree, and `config.md:309` — the omission that shipped MF-1 — is present in it this time. The Phase 0 `md5` baseline is independently corroborated: all four pinned digests match `HEAD` exactly.

**Weak oracle 1 — the census verified membership, not the attributions.** Every named example was checked for *presence in the census with the right class*. Nothing checked whether the **prose attached to** each named example was true. F1 sits precisely in that gap: `SKILL.md:505`/`:533`/`:534` are all correctly classified as displays, and the sentence attributing both blocks to ADR-0016 §5 is still false. A census that reads its own claim as *"are these sites present and correctly classed?"* rather than *"is every clause of this sentence true?"* cannot catch it. This is the third distinct way the same paragraph has shipped a false claim, and the third distinct oracle gap.

**Weak oracle 2 — baselines are self-witnessed.** Every byte-identity and numeral figure is quoted against "this cycle's pre-edit tree," an uncommitted snapshot only the coder observed. This report replaced those with `HEAD`-anchored and prior-artifact-anchored equivalents wherever possible (worked-example numerals, `:309`, the one-line `SKILL.md` diff, all four `md5`s, both heading inventories, ADR-0016's pure append) and every one reproduced. The claims are sound; the *method* was not independently checkable, and would not have been noticed had one been wrong.

**Weak oracle 3 — the numeral convention drifted silently across cycles** (448 → 505 → 507 under three conventions). Each is internally valid; none is comparable to the previous report's figure, and nothing in the logs flags that. AC-19's baseline-naming discipline should extend to naming the *convention*, not only the tree.

**Not weak, though it looks it — the "record" classification (F3).** The census introduced a fourth class word for the ADR rows while asserting the three-class universal covers them. The rows do fall inside the universal, so no claim is false; the taxonomy widened silently, which is worth catching before it becomes load-bearing.

## Verdict

**PASS**, with one Must-Fix-grade and one Should-Fix-grade finding routed to the reviewer.

- **MF-2 closed.** The three-slot guard is correct, complete, and blocks the `g = 24 − 12 = 12` mis-fill from its own text. This cycle's `SKILL.md` diff is exactly one line, independently confirmed.
- **SF-1 closed**, without touching `:309`, and it repairs a latent ambiguity in the bargain.
- **MF-1's form is closed and holds up under attack** — the classification is universal, prescriptive, self-maintaining, and the post-edit census finds zero second definitions. **MF-1's substance ships one new false claim**: the ADR-0016 §5 attribution over the nested print block (**F1**), which regresses `CR-20260819T104419Z-fc4f` MF-3 into the normative reference. The plan's AC-1(d) instructed it, so it is a plan defect propagated, not a coder defect.
- **No figure moved**, on a stronger oracle than required: the five worked examples are numeral-identical to `HEAD` across all three uncommitted cycles.
- All pinned invariants and all three no-regression floors are green. Coverage is inapplicable, not below floor.
