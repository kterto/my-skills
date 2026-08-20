---
id: CR-20260819T104419Z-fc4f
plan: FEAT-20260819T101153Z-e883
title: Review of One span rule over any slice set, at any depth (ADR-0017)
status: REQUEST_CHANGES
created_at: 2026-08-19T10:49:05Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 3
should_fix_count: 2
---

**Related:** [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md) · [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md) · [TEST-20260819T103448Z-5a36](../test/TEST-20260819T103448Z-5a36-one-span-rule-slice-set.md)

## Summary

The reframing itself is well executed and its central claim holds under independent check. The span rule is stated once at `references/config.md:224–236`, `span(L)`, `span_max`, `M_flat`'s span term and the viable-flat `span_base` each derive from it by name, the fenced `M + X` / `S + X` block is gone with the identity preserved, and every figure is unmoved — I re-derived worked example 5 end to end from the rewritten rule (`T` = 42, `span_base` = 24, `M_flat` = 29, post-adoption `span_max` = 16, `M_nested` = 25.5, `g` = 8, `c` = 4.5, reconciliation 3.5) and it reproduces exactly. Every pinned constraint I spot-checked holds: `grep 'min(S'` = 0, the 31 headings are byte-identical by text diff, the anchor census is 3/3/2/1/1, ADR-0016 is append-only (11/0) with `Status: Accepted` intact, ADR-0012/0013/0014 and `templates/architect.md` are untouched, `SKILL.md` is unchanged against HEAD, and all three floors are green (225 passing, `build-prime-agent.mjs --check` exit 0, `prime-agent` install+parity ok). The tester was right to report coverage inapplicable rather than below floor — no executable path exists and inventing one would be the wrong instinct here.

The blockers are not in what the change did but in what it now **asserts**. The new text claims the concurrent-`max`-plus-serial-remainder shape has been reduced to one site and that "there is no longer a set of statements that must be moved in agreement". Four sites still carry the shape, and three of them encode the **pre-ADR-0016** form — the document's own example 5 at `:459` names those exact expressions as "the uncorrected model". That is not a stylistic overstatement: pairing the now-canonical `span_base` at `:259` with the stale post-split `span_max` at `:309` yields `g` = 12 on example 5 where the true gain is 8, overstating by exactly `X`. Verdict: **REQUEST_CHANGES** on three findings, all of which are text-only, move no figure, and stay inside this plan's own "reframing, not repricing" boundary.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Rule stated exactly once in *The makespan model*, generic over `P`, before any dependent quantity | ✅ | `:224–:230`; base cases at `:230`; first dependent quantity at `:238`. |
| 2 | `span(L)` (split + leaf), `span_max`, viable `span_base` each stated as the rule over a named slice set, **not** as a re-expanded `max`-plus-`tasks(integration)` formula | ❌ | The four named sites are done (`:239`, `:249`, `:259`). But `span_base` is **also** stated at `:316` as a re-expanded formula — and in its pre-ADR-0016 form. See MF-1. |
| 3 | `M_flat`'s span term and the viable row reference `span_base` by name; shape in neither | ✅ | `:251` ("referenced by name here and nowhere re-expanded"), `:259`. |
| 4 | Non-viable row still `span_base = T`, explicitly a sum, not the rule | ✅ | `:260` cell + `:262` paragraph. |
| 5 | `T` and `M_seq` explicitly outside the rule, ADR-0016 §2 reason | ✅ | `:252` and `:262`, both cited to ADR-0016 §2. |
| 6 | Never-a-sub-split-candidate and the depth cap survive as independent claims | ✅ | `:248` and `:236` respectively. |
| 7 | Fenced `span_base = M + X` block replaced by one sentence; identity + name survive | ✅ | Block absent; `:264` carries the by-construction cancellation and names the cancellation identity. |
| 8 | Sequential half intact: `g = T − (S + X)` with its reason | ✅ | `:266`; no `min(S, X)` added (`grep` = 0). |
| 9 | `M_flat − M_nested = g − c` on both baselines + "not evidence the model is right"; old-model comparison referenced, not re-inlined | ✅ | `:268`. |
| 10 | `:74` canonical generic exclusion with the only surviving counter-examples, scope limit, `none` reassurance once | ✅ | `{a: 3, b: 3, integration: 18}` count = 1; `none` reassurance count = 1; `70%` denominator scope limit present. |
| 11 | Two one-line pointers naming what is excluded in site vocabulary, duplicated counter-examples removed, neither a bare "see above" | ✅ | Per-sub-lane and leaf-level blockquotes both name the slice and state counts-in-full. |
| 12 | ADR-0016 §3 both-sites restated as a one-clause consequence, guarded failure retained at canonical site | ✅ | "it cannot apply at one evaluation site and not another"; `{backend: 20, integration: 4}` retained at `:74`. |
| 13 | No heading renamed/removed/added/re-levelled; ten cross-references resolve | ✅ | Heading-text diff vs base is byte-identical, 31/31; tester's 10/10 resolution re-spot-checked. |
| 14 | `SKILL.md` changed only on a proven normative restatement; 2p.2 print block byte-identical; outcome recorded | ✅ | `git diff HEAD -- SKILL.md` empty; outcome recorded in the Progress Log. The AC is literally met — but its supporting rationale is wrong, see MF-3. |
| 15 | `templates/architect.md` unamended | ✅ | `git diff` empty. |
| 16 | ADR-0017 exists in ADR-0016's style with Status/Date/Skills affected/Source finding/Lineage | ✅ | `Status: Accepted`, 2026-08-19, `arch-2` + spec ID, lineage ADR-0012 → 0014 → 0016. |
| 17 | ADR-0017 states what it supersedes and what it leaves standing | ✅ | `## What this supersedes` (`:115`), `## What stands` (`:130`) incl. `min(S, X)` and ADR-0013 explicitly. |
| 18 | ADR-0017 records Consequences + the deliberate divergence | ✅ | `## Consequences` (`:167`), `## Deliberate divergences` (`:155`). One consequence is factually false — see MF-2. |
| 19 | ADR-0016 forward pointer; `Status: Accepted`; nothing deleted or rewritten | ✅ | Diff is `11 +0 −` (pure append); `Status: Accepted` on line 3, untouched. |
| 20 | Mechanical no-numeral-drift over the five worked-example subsections | ✅ | Identical numeral sequences; four of five bodies byte-identical; the one permitted `:451` rewording carries `20 − 12 = 8` unchanged. |
| 21 | Hand re-derivation of all five examples, recorded per example | ✅ | Recorded per example; I independently re-derived example 5 and it matches printed values exactly. |
| 22 | Five-example coverage re-confirmed (`X = 0` ×2, sub-lane slice, `k = 2`, top-level `X > 0`) | ✅ | Examples at `:338`, `:354`, `:374`, `:394`, `:431`. |
| 23 | Overlay-anchor + quote-fidelity census 3 / 3 / 2 / 1 / 1 | ✅ | Re-run and confirmed exactly. |
| 24 | Distribution regenerated; `--check` exit 0; `prime-agent/skills/**` never hand-edited | ✅ | `--check` exit 0, "11 skills, 154 files"; parity test confirms generated + in sync. |
| 25 | No-regression floor: 225 passing, `--check` 0, `prime-agent` green | ✅ | `# tests 225 / # pass 225 / # fail 0`; `--check` exit 0; install + parity ok. |
| 26 | *Untrusted metadata* and the `SKILL.md` digest untrusted framing byte-identical | ✅ | Neither appears in the diff; `SKILL.md` unchanged entirely. |

## Must Fix (Blockers)

### MF-1 — `config.md:309` and `:316` still state the pre-ADR-0016 span formulas; cross-reading them with the corrected `:259` overstates `g` by `X`

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:309`, `:316`

**Problem**: Both sites sit under `#### Marginal-gain rule (the critical-path test)` and both drop the `+ tasks(i(run))` serial remainder.

- `:309` gives the post-split critical path as the fenced formula `max(second_largest_span, span(L after the split))`.
- `:316` states outright that `span_base` "is `max` over lanes of `tasks(L)` under a viable flat verdict" — a second, contradictory definition of a quantity the change just made canonical at `:259`.

This is not a judgement call about phrasing. The document convicts itself at `:459`, in the *What this example is actually pinning* paragraph of worked example 5:

> Under the uncorrected model — which took a bare `max` over lanes, folding `wiring` in rather than charging it after them — `span_base` read `max(20, 4)` = 20 and `span_max` read `max(12, 4)` = 12.

`:316` and `:309` produce exactly those two numbers on exactly that lane set. They are the uncorrected model, still stated normatively, in the same file that names them as the defect ADR-0016 fixed.

I verified the arithmetic on example 5 (`{backend: 20, frontend: 12, admin: 6}`, `wiring` = 4, `backend` split to `{8, 8}`):

| Source of `span_base` | Source of post-split `span_max` | `g` | Correct? |
|---|---|---|---|
| `:316` (stale) = 20 | `:309` (stale) = `max(12, 8)` = 12 | **8** | correct, by accident — `X` cancels |
| `:259` (canonical) = 24 | `:447` (example) = 16 | **8** | correct |
| `:259` (canonical) = **24** | `:309` (stale) = **12** | **12** | **wrong — overstated by exactly `X` = 4** |

The third row is the realistic read, and this change makes it more likely, not less. A model computing `g` takes `span_base` from *The baseline* — which `SKILL.md:512` explicitly points at as the `Estimated speedup:` denominator, and which this change made unambiguous — then takes the post-split term from the *Marginal-gain rule* section, because that is the section that defines the gain. That pairing now yields `g` = 12 against a true 8. `c` = 4.5 either way, so the candidate is still adopted here, but the gain quoted to the user in option 3 of the `ask` ladder is inflated by the whole serial tail — the precise failure class ADR-0012, ADR-0014 and ADR-0016 were each filed for.

The two stale sites are only safe when read **together and only together**, which is exactly the "set of statements that must be moved in agreement" this plan exists to eliminate.

**In scope?** Yes, and squarely. It moves no numeral in any worked example — `:439` and `:447` already print 24 and 16 — so it does not touch the "reframing, not repricing" boundary. It is not on the Out of Scope list. And AC-2 already forbids stating `span_base` "as a re-expanded `max`-plus-`tasks(integration)` formula"; `:316` is such a statement that the plan's site inventory missed.

**Fix**: Restate both by name rather than by re-expansion, in keeping with the pattern the change established at `:251`:

- `:316` — replace "which is `max` over lanes of `tasks(L)` under a viable flat verdict and `T` under a non-viable one" with a by-name reference: `span_base` as defined in *The baseline* above — the span rule over the run's lane set with every lane unsplit under a viable flat verdict, and `T` under a non-viable one. Do not re-expand.
- `:309` — carry the serial remainder into the fenced formula so it is the span rule applied to the post-adoption lane set, e.g. `max(second_largest_span, span(L after the split)) + tasks(i(run))`, with a following clause noting that `tasks(i(run))` is a run constant and therefore cancels in `g` — which is what makes the shorter form people remember correct as a *delta* and wrong as a *span*. `:314`'s worked micro-example (`max(10, 5 + 6)` = 11) is at the sub-lane level and stays correct as written.

---

### MF-2 — `config.md:234` and ADR-0017's Consequences assert a one-site property the document does not have

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:234`; `docs/adr/0017-one-span-rule-over-any-slice-set.md:180–183`

**Problem**: The change adds, at `:234`:

> Writing the shape once is what makes pricing an integration slice a **one-site** edit, instead of four separately-maintained statements that a later change has to move in agreement.

and ADR-0017 records as a Consequence:

> A future change to how a serial remainder is charged edits the rule; the four named quantities follow automatically. **There is no longer a set of statements that must be moved in agreement.**

Both are false in the shipped tree. Census of sites still carrying the concurrent-`max`-plus-serial-remainder shape after this change:

| Site | Level | Status |
|---|---|---|
| `config.md:309` | run | **stale — pre-ADR-0016 form** (MF-1) |
| `config.md:314` | sub-lane | correct; re-expands `span(L)` |
| `config.md:316` | run | **stale — pre-ADR-0016 form** (MF-1) |
| `SKILL.md:505` | run | correct; deliberate display expansion, genuinely covered by ADR-0016 §5 |
| `SKILL.md:533` / `:544` | sub-lane | correct; display |
| `SKILL.md:534` | run | **stale — pre-ADR-0016 form** (MF-3) |
| `SKILL.md:546` | run | describes `span_max` with no serial remainder; its example has `i(run) = none` so it is incomplete rather than wrong |

Seven sites, three of them already out of agreement — the ADR asserts the absence of the exact condition that is currently causing MF-1 and MF-3. An Accepted ADR recording a property the codebase does not have is the strongest form of this defect, because it is what a future editor will trust instead of re-auditing.

This is a claim **this change introduced**; it is not pre-existing text. Unlike MF-1 and MF-3 it is not fixable by editing elsewhere — even after those two land, `SKILL.md:505` will still legitimately re-expand the shape by ADR-0016 §5, and `:314`/`:533` will still re-expand it at the sub-lane level.

**Fix**: Scope the claim to what is true rather than deleting it — the underlying achievement is real and worth stating.

- `config.md:234` — bound it to the normative arithmetic, e.g. "…makes pricing an integration slice a **one-site edit of the normative arithmetic**, instead of four separately-maintained normative statements that a later change has to move in agreement. The Step 2p.2 print blocks (`SKILL.md`) show the shape expanded for on-screen legibility — a display decision recorded in ADR-0016 §5, not a normative statement — and they are the only other place the shape appears."
- ADR-0017 `:180–183` — replace "There is no longer a set of statements that must be moved in agreement" with the bounded form, and name the display sites as the recorded exception. If MF-3 is fixed rather than exempted, say so explicitly and name which print blocks §5 covers.

---

### MF-3 — the Step 2p.2 **nested** print block is exempted on an ADR-0016 §5 reading that §5 does not support, and it renders an inconsistent line when `X > 0`

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:534` (and `:546`); plan Out of Scope line; `docs/adr/0017-…:6` ("Skills affected")

**Problem**: The plan exempts both print blocks with:

> **Changing the Step 2p.2 print-block template strings.** Their expanded on-screen form is a deliberate ADR-0016 §5 legibility decision, not a fifth normative statement.

I read §5. Its heading is *"Step 2p.2's **flat** print block divides by `span_base`"* and its body covers only the flat block's four lines — the `Estimated speedup:` denominator, the new `Integration lane:` line, and `Fixed overhead:` / `Interface points to freeze:` being unchanged. It says nothing about the nested block at `SKILL.md:526–542`. The exemption is therefore unfounded for the nested block: the ADR it cites does not reach it.

And the nested block is defective when `X > 0`:

```
  span_max     = max(second-largest span {n}, span({lane}) {span_L}) = {span_max}
  g    = {span_base} − {span_max} = {g}
```

`{span_base}` is populated from the flat block at `:505`, which **does** carry `+ integration({n})`. `{span_max}` on `:534` is decomposed without it. On example 5 the model must either print `span_max = max(second-largest span 12, span(backend) 8) = 16` — a line whose decomposition does not equal its own stated result — or print 12, in which case the very next line renders `g = 24 − 12 = 12` against a true gain of 8. There is no filling of the slots that is both self-consistent and correct. Note this is the same stale shape as `config.md:309`, which is unsurprising: the template mirrors it.

`:546`'s supporting prose has the same gap ("`span_max` is what the **run** takes, which is that value only when `L` is still the critical path"), though its worked micro-example declares no top-level integration lane so it is incomplete rather than wrong. ADR-0017's own `Skills affected` line compounds this by asserting "`SKILL.md` and `templates/architect.md` are **unamended** — both point at the arithmetic rather than restating it"; `:534` restates it, and restates the superseded form.

**Fix**: Add the serial remainder to the nested block's `span_max` line so its decomposition matches its result and matches the flat block's treatment of the same term, mirroring the `integration({n})` idiom already used on `:505` and `:533`:

```
  span_max     = max(second-largest span {n}, span({lane}) {span_L}) + integration({n}) = {span_max}
```

Then extend `:546`'s prose with one clause noting that the run-level term carries the top-level integration lane after the `max`, as `span_base` does — pointing at *The makespan model*, not restating the rule. Update the plan's Out of Scope entry and ADR-0017's `Skills affected` to record the corrected reading: ADR-0016 §5 exempts the **flat** block only. If the nested block is instead to stay byte-identical, that needs its own recorded decision naming the inconsistency it accepts — not a citation to a section that does not cover it.

## Should Fix (Warnings)

### SF-1 — `config.md:243` and `:246` now restate the general serial-remainder argument the new `:232` paragraph makes once

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:243`, `:246`

**Problem**: Both blockquotes open with "The … integration [sub-]lane is serial and must be modelled as serial" and both then argue that a `max` including it "would model an execution order the skill forbids … **optimistically**". The new `:232` paragraph now makes precisely that argument generically, once, for any `P`. That is three statements of one clause that must move in agreement — the exact duplication class this plan's Technical Notes name as the target ("removing *duplication that must move in agreement*"). The simplify pass was right to defer it: the spec scoped its collapse to the three **exclusion** blockquotes at `:74` / `:482` / `:498`, which are a different set.

Not blocking: it is prose economy, not arithmetic, and nothing here is wrong.

**Fix**: If addressed, scope the collapse to the **shared clause only** and preserve everything each blockquote uniquely carries — `:243`'s exact unbolded Step 3s quotation (a quote-fidelity anchor pinned at exactly 1 against `SKILL.md`), its Step 3s citation and its "overstates the gain rather than understating the cost" defect-class point with the ADR-0012 attribution; `:246`'s Step 3j **and** Step 3L citations, its counts-in-full-in-`span_base`/`span_max`/`M_flat`/`T` scope limit, and its ADR-0016 attribution. A wholesale merge deletes load-bearing content and would be worse than leaving both. Better handled as its own scoped item than folded into this cycle.

---

### SF-2 — the Progress Log's numeral counts are off by one for examples 4 and 5

**File**: `plans/feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.progress.md:49`, `:122`

**Problem**: The log records 147 and 131 numerals for the `k = 2` and top-level-integration examples; the true body counts are 146 and 130. The coder's extraction convention included the subsection heading line, which carries a numeral for exactly those two examples (`k = 2`, `tasks(integration) > 0`) and no other.

Not load-bearing, and the AC-20 check itself is unaffected: it compares pre-edit against post-edit under one convention (147/147, 131/131), so an identical offset on both sides cancels. The trap is a future re-run under a different convention reading 146 against a recorded 147 and diagnosing drift that does not exist.

**Fix**: No correction of the verdict is needed. Either restate the two figures as 146 and 130, or — better — record the convention alongside them ("counts include the subsection heading line"), so the oracle is reproducible rather than merely self-consistent.

## Verdict

**Status**: REQUEST_CHANGES

The reframing is sound and every figure it claims to preserve does survive independent re-derivation, but the change ships three assertions its own file contradicts — two stale pre-ADR-0016 formulas at `config.md:309`/`:316` that overstate `g` by `X` when cross-read with the corrected `:259`, a "one-site edit" claim promoted into an Accepted ADR, and a nested print block exempted by an ADR section whose heading limits it to the flat block.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260819T104419Z-fc4f-one-span-rule-slice-set.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair.

Two notes for the FIX plan, both inherited from this plan and still binding: all three fixes are text-only and must move **no numeral** in any of the five worked examples (`:439` and `:447` already print the corrected 24 and 16, so MF-1 requires no arithmetic change), and `prime-agent/skills/**` must be regenerated via `node scripts/build-prime-agent.mjs`, never hand-edited. Re-run the anchor census after touching `SKILL.md` for MF-3 — `:534` and `:546` sit near the `:456`/`:458`/`:488` anchors, and `applyReplacements` hard-fails the build on any occurrence-count drift.
