---
id: TEST-20260819T103448Z-5a36
plan: FEAT-20260819T101153Z-e883
title: Test Report — One span rule over any slice set, at any depth (ADR-0017)
status: PASS
created_at: 2026-08-19T10:34:48Z
cycle: 0
---

**Related:** [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md)

## Summary

The change is docs-only and is a **reframing, not a repricing**: `plugins/my-skills/skills/orchestrator/references/config.md` now states the concurrent-`max`-plus-serial-remainder shape **once**, as `span(P) = max over non-integration members m of P of span(m) + tasks(i(P))`, and derives `span(L)`, `span_max`, `M_flat`'s span term and the viable-flat `span_base` from it.

**No executable path exists for this surface and none can be written.** `parallelism` is `off` in this repo and the `full` level with `k >= 2` is unreachable, so nothing would execute the span rule. Per `PROJECT-CONTEXT.md` → *Test tooling*, verification for doc-skill changes is **structural** and, here, **arithmetic**. Coverage is **inapplicable**, not below floor — no behavioural test was invented to satisfy a coverage habit.

**The central claim — "no figure moved" — is verified independently and holds.** I re-derived all five worked examples by hand from the rewritten rule and recomputed every derived quantity under the new rule against the old literal formula; all nine derivation sites are value-identical, and every printed figure is reproduced. This was verified adversarially, not by accepting the coder's own two checks.

Three findings are routed to the reviewer. None moves a figure; all are pre-existing text that this change's **new** one-site claim now over-reaches.

## Flows Triaged

Skill behaviours here are prose, not executable flows. Criticality is scored as user impact × breakage likelihood × not-covered-by-review.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| Span-rule arithmetic reproduces every printed figure | **High** | **Verified by hand re-derivation + mechanical recomputation** | This *is* the change's central claim. No e2e possible; hand derivation from the rewritten rule is the only honest oracle, and the coder's own verification does not carry over as evidence. |
| Rule actually derives its four dependents without re-expansion | **High** | **Verified by applying the rule to each named slice set** | A quantity could keep its number while silently changing meaning. Checked each of the four against its pre-edit formula. |
| `T` / `M_seq` excluded from the rule | **High** | **Verified by reading all three exclusion statements** | Folding a sum into the span rule would be a silent repricing of the sequential baseline. |
| Structural invariants (headings, cross-refs, anchors, `min(S`) | **Medium** | **Verified mechanically** | Cross-references resolve by title; the build hard-fails on anchor-count drift. |
| Distribution parity + no-regression floors | **Medium** | **Run as a floor** | Unrelated surface; a floor, not evidence about this change. |
| e2e for the `full` parallel gate | — | **EXCLUDED** | Unreachable: `parallelism` is `off` here and `full` with `k >= 2` never executes. An e2e test would assert on a code path that cannot run. |
| e2e / unit tests for `config.md` prose | — | **EXCLUDED** | Normative markdown has no executable surface. `clean-code-gates` is the repo's only JS island and is explicitly not to be run against doc skills. |

## E2E Tests Added

**None, and none is possible.** Justified above and in the plan's Technical Notes. No test file was created or modified; no production source was touched.

## Coverage

**Inapplicable — not measured, not below floor.**

`PROJECT-CONTEXT.md` → *Test tooling* states coverage is not measured outside `clean-code-gates`, and that the tester treats automated tests + coverage as N/A/advisory for doc-skill changes. There is no coverage command for this surface to run. The 70% floor does not bind on markdown with no executable path.

No-regression floors (unrelated surface, run as a floor only):

| Floor | Expected | Observed | Result |
| --- | --- | --- | --- |
| `clean-code-gates && npm test` | 225 passing | `# pass 225 / # fail 0`, exit 0 | PASS |
| `node scripts/build-prime-agent.mjs --check` | exit 0 | `prime-agent/skills is up to date (11 skills, 154 files)`, exit 0 | PASS |
| `cd prime-agent && npm test` | green | `install ok` + `parity ok`, exit 0 | PASS |

## Verification performed

### 1. Hand re-derivation of all five worked examples — PASS

Each example recomputed from the **rewritten** rule, not from the old formula. Every printed figure reproduced:

| Example | Key derivations checked | Result |
| --- | --- | --- |
| the gate verdict and the ladder figure must agree | `span_base` 12, `span(L)` 6, `span_max` 6, `M_flat` 16, `M_nested` 14, `g` 6, `c` 4 | all match |
| one lane carries all the work (sequential baseline) | `T` 24, `span_max` 8, overhead 8.5, `M_nested` 16.5, `g` 16, `c` 8.5, `8/24`=33%; the `{20,4}` rejection branch `g`=4 | all match |
| a split carrying an integration sub-lane | `span(mobile)` = 5+6 = 11, overhead 10, `M_nested` 21, `g` 13, margin 3, 12.5% improvement, the pre-field `g`=19 / error-of-6 branch, aggregate `8 ≤ 24` | all match |
| `k = 2`, the case the overlap exists for | `T` 38, `24/38`=63%, `span_base` 24, `M_flat` 28, `span(A)` 8, `span_max` 10→8, `g₁` 14, `c₁` 4.5, `g₂` 2, `c₂` 0.5, superseded `M_nested` 19, both reconciliations, `8/38`=21% | all match |
| a declared top-level integration lane | `T` 42, `20/42`=48%, `M`=20, `span_base` = M+X = 24, `M_flat` 29, `span(backend)` 8, `span_max` = 12+4 = 16, `M_nested` 25.5, `g` 8, cancellation identity `M−S` = 20−12 = 8, reconciliation 3.5, `11/12`=92%, `12/42`=29%, uncorrected 25 / 21.5 | all match |

Independently, every derived quantity was recomputed under the new rule and under the old literal formula at all **nine** derivation sites across the five examples: **value-identical at every site**. The generalization from `tasks(s)` to the recursive `span(m)` coincides exactly under the depth-2 cap, which is precisely what the new guard blockquote forecloses.

### 2. Mechanical no-numeral-drift — PASS (coder's characterization confirmed, with one clarification)

Numeral sequences per worked-example subsection, HEAD vs working tree — **identical sequences, not merely identical counts**:

| Example | numerals | sequence equal | body byte-identical |
| --- | --- | --- | --- |
| gate verdict / ladder figure | 45 | yes | **yes** |
| one lane carries all the work | 63 | yes | **yes** |
| a split carrying an integration sub-lane | 62 | yes | **yes** |
| `k = 2` | **146** | yes | **yes** |
| declared top-level integration lane | **130** | yes | no — one line |

The coder reported 45/63/62/**147**/**131**. The discrepancy is a section-boundary convention, not an error: the coder's count includes the heading line, which carries a numeral for exactly those two examples (`k = 2` and `> 0`) and none for the other three. Both conventions agree; the load-bearing fact (sequences identical before/after) holds under either.

The fifth example's single changed line is exactly the permitted cancellation-identity rewording, with arithmetic untouched:

```
-`g` = `24 − 16` = **8**. Via the cancellation identity, `g` = `M − S` = `20 − 12` = **8** — the same number, as it must be. `c` = …
+`g` = `24 − 16` = **8**. Via the cancellation identity (*The makespan model*, above), `g` = `M − S` = `20 − 12` = **8** — the same number, as it must be: `X` is common to both slice sets and cancels by construction, not by coincidence. `c` = …
```

### 3. The rule derives what it claims — PASS

Each of the four dependents applies the rule to a named slice set and recovers its pre-edit formula exactly. **No quantity silently changed meaning while keeping its number.**

| Quantity | Pre-edit formula | Post-edit statement | Recovers? |
| --- | --- | --- | --- |
| `span(L)` split | `max` over non-integration sub-lanes of `tasks(s)` + `tasks(integration)` | rule over the lane's sub-lane set, `i(L)` = the split's declared slice | yes (sub-lanes are leaves under the depth cap, so `span(m)` = `tasks(m)`) |
| `span(L)` unsplit | `tasks(L)` | leaf base case | yes |
| `span_max` | `max` over non-integration lanes of `span(L)` + `tasks(integration)` | rule over the run's lane set, `i(run)` = top-level integration lane, each lane at its own `span(L)` | yes |
| viable `span_base` | `max` over non-integration lanes of `tasks(L)` + `tasks(integration)` | rule over the run's lane set with every lane unsplit, each lane at its leaf `span` | yes |
| `M_flat` span term | re-expanded inline | references `span_base` by name only | yes (value unchanged) |

The four pre-edit re-expansions (`plus** tasks(integration)` at HEAD `:225`, `:235`, `:237`, `:245`) are all gone. The rule is stated once, at `:227`, ahead of every quantity that references it.

### 4. `T` and `M_seq` are outside the rule — PASS

Both say so, and neither was folded in:

- `:252` (the `M_seq` bullet, where `T` is defined) — "**`T` is a sum, not an application of the span rule** — an `off` run forms no slice set at all, so there is no `max` and no serial remainder to separate."
- `:260` (baseline table, non-viable row) — "`T`, the total task count (integration lane included in full) — **a sum, not the span rule**"
- `:262` — "`T` and `M_seq` are therefore **outside** the rule and the rule is never applied to them"

The ADR-0016 §2 reason (an `off` run implements the integration work one task at a time) is retained at `:252` and `:262`. `M_seq`'s explicit exclusion lives at `:262` rather than at its `:252` definition site — a trivial imprecision against the forward claim at `:234` ("say so where they are defined"), noted for completeness, not a finding.

### 5. Pinned constraints — all held

| Constraint | Expected | Observed | Result |
| --- | --- | --- | --- |
| `grep 'min(S' config.md` | 0 | **0** (HEAD also 0); lives in ADR-0016 at `:141`, `:144`, `:183`, and the new `:199` | PASS |
| Section headings frozen | 31, byte-identical | **31, byte-identical** (`cmp` exit 0 on the extracted heading lists) | PASS |
| Cross-reference targets resolve | 10/10 | **10/10** — 8 as `####` headings, *The baseline* and *Containment* as bold-lead paragraphs | PASS |
| Anchor + quote-fidelity census | 3 / 3 / 2 / 1 / 1 | **3 / 3 / 2 / 1 / 1**, zero drift vs HEAD | PASS |
| Overlay anchors in `config.md` | 1 | **1** — the ADR-0001 link; the other 23 overlay `find` strings target `SKILL.md` / the PROJECT-CONTEXT template | PASS |
| ADR-0016 `Status: Accepted`, forward pointer only | 0 deletions | **11 insertions, 0 deletions**, append-only; `- **Status:** Accepted` intact | PASS |
| ADR-0012/0013/0014, `templates/architect.md` unamended | clean | **clean** | PASS |
| `SKILL.md` not edited | unmodified | **unmodified** — md5 identical to HEAD, so the Step 2p.2 print block is byte-identical by containment | PASS |
| `Untrusted metadata` section byte-identical | identical | **identical** (md5 `de72abdd…` both sides) | PASS |
| `prime-agent/skills/**` not hand-edited | regenerated only | `--check` exit 0; **exactly one** line differs from the plugin source, and it is verbatim the overlay's only `fileReplacements` pair for this file | PASS |
| Duplicate counter-examples removed | canonical site only | `{a: 3, b: 3, integration: 18}` 2→**1**; `{backend: 20, integration: 4}` 2→**1**; `{work: 20, integration: 4}` 1→**0**; `has nothing to exclude` 2→**1** | PASS |

Note on the census: `through a **single sequential coder invocation**` is confirmed **not** an overlay build anchor — no overlay `find` string matches `sequential coder`, `span`, `integration`, or `makespan`. Its constraint is cross-document quote fidelity between `SKILL.md` (bolded, ×2) and `config.md:243` (unbolded, ×1), which the build does **not** enforce. Checked manually: it holds.

## Test-Quality Audit

No test files exist for this surface, so there are no assertions to audit for tautology or emptiness. The **oracle** discipline the plan substituted for TDD (capture expected outputs pre-edit, then assert them post-edit) was followed, and I re-ran the oracle independently rather than trusting the recorded result. One weakness in the coder's own evidence is worth naming: **the reported numeral counts for two of five examples were off by one** (see §2). The counts were not load-bearing — the sequence equality was — but a reviewer reading only the Progress Log would have had two figures that do not reproduce.

## Findings for the reviewer

All three are **pre-existing text** and none moves a figure. They are reported because this change introduces a **new** claim that they falsify.

### F1 — the "one-site edit" claim at `config.md:234` is overstated (medium)

The new lead text asserts: *"Writing the shape once is what makes pricing an integration slice a **one-site** edit, instead of four separately-maintained statements that a later change has to move in agreement."*

Four statements were indeed unified. But the shape survives at **six** other sites that a later repricing would still have to move in agreement — three in `config.md`'s `#### Marginal-gain rule` section (byte-identical to HEAD, untouched by this change) and three in `SKILL.md`:

| Site | Text | Complete? |
| --- | --- | --- |
| `config.md:309` | `max(second_largest_span, span(L after the split))` | **no** — omits `+ tasks(i(run))` |
| `config.md:314` | "`span(L)` for a split lane is `max` over its **concurrent** sub-lanes **plus** its integration sub-lane" | yes (5th restatement of `span(L)`) |
| `config.md:316` | "`span_base` … is `max` over lanes of `tasks(L)` under a viable flat verdict" | **no** — omits `+ tasks(i(run))` |
| `SKILL.md:533` | `span({lane}) = max(concurrent {n},…) + integration({n}) = {span_L}` | yes |
| `SKILL.md:534` | `span_max = max(second-largest span {n}, span({lane}) {span_L}) = {span_max}` | **no** — omits `+ integration({n})` |
| `SKILL.md:546` | "`span(L)` is what the split lane itself takes — its concurrent sub-lanes' max plus its serialized integration sub-lane" | yes (prose, despite `config.md:208`'s claim that `SKILL.md` "does not restate" these rules) |

The two incomplete `config.md` forms are demonstrably wrong when `X > 0`. On worked example 5 (`X = 4`):

- per the definitions at `:249`/`:259`: `span_base` = 24, `span_max` = 16, `g` = **8** ✓ (the printed figure)
- per `:316`: `span_base` = `max(20,12,6)` = **20**, not 24
- per `:309`: post-split `span_max` = `max(12, 8)` = **12**, not 16
- `:316` + `:309` together give `g` = 20 − 12 = **8** — right answer, because both drop `X` and it cancels; this is the cancellation identity in disguise
- but `:259`'s correct `span_base` (24) combined with `:309` gives `g` = **12**, overstating the gain by exactly `X` = 4

So the example's figures are safe, but the Marginal-gain section is internally reachable to a wrong `g`. This is pre-existing and explicitly out of this plan's scope — it is reported because `:234` now claims a property the document does not have.

### F2 — `SKILL.md:534`'s `span_max` print line is not covered by the ADR-0016 §5 exemption (medium)

The plan puts the Step 2p.2 print-block template strings out of scope, citing them as "a deliberate ADR-0016 §5 legibility decision." I read §5: it covers **only** the *flat* block — the `Estimated speedup:` denominator, printed in expanded form with `+ integration({n})` shown as a separate summand precisely so the serial tail is not silently omitted, plus the new `Integration lane:` line.

§5 says nothing about the **nested** block. There, `span_base` is printed with its integration summand (`SKILL.md:505`) but `span_max` is not (`SKILL.md:534`), and the very next line prints `g = {span_base} − {span_max}`. On example 5 that block would render `span_max = max(second-largest span 12, span(backend) 8) = 16` — a line whose shown decomposition does not equal its own stated result. The asymmetry is the opposite of what §5 decided for the flat block, and the exemption invoked does not reach it.

### F3 — the simplify pass's deferred finding: assessed, and it is **narrowly** right (low)

The simplify pass reported `config.md:243` and `:246` as two near-verbatim blockquotes both restating the general argument the new paragraph at `:232` now makes once, and did not apply it because the spec scoped the collapse to the three *exclusion* blockquotes, which are different blockquotes. Assessed on merits:

- **The general argument is genuinely now stated three times** — `:232` generically, `:243` for the sub-lane, `:246` for the top level. The shared clause is roughly "a `max` taken over all X including that one would model an execution order the skill forbids, and would do so **optimistically**." That is real duplication introduced by this change, and it is the same duplication family the change exists to remove, one level up.
- **But a wholesale collapse would delete load-bearing content.** `:243` uniquely carries the `SKILL.md` → Step 3s quotation — which is the cross-document quote-fidelity anchor counted at exactly 1 — plus the ADR-0012 attribution and the "overstates the **gain** rather than understating the cost" effect classification. `:246` uniquely carries the Step 3j and Step 3L machine citations, the ADR-0016 attribution, and the "counts in **full** in `span_base`, `span_max`, `M_flat`, and `T`; excluded from those two conditions only" scope limit.

**Recommendation:** if the reviewer acts on this, scope it to the repeated general-argument clause only, deferring it to `:232` while each site keeps its machine citation, ADR attribution, and effect/scope lines. Deferring it wholesale would be wrong, and the simplify pass was right not to apply it mid-cycle.

### Minor observation (not a finding)

The rule is now stated generically over an arbitrary slice set `P`, which makes one edge case more visible than the lane-specific phrasing did: `max` over the non-integration members is undefined when a slice set declares an integration slice and no non-integration members. The pre-edit text had the same gap, it is unreachable under the viability conditions, and the depth-cap guard at `:236` already constrains how far the generality may be read. No action needed.

## Verdict

**PASS.**

The central claim is verified independently and adversarially: **no figure moved.** All five worked examples re-derive from the rewritten rule with every printed figure reproduced; all nine derived quantities are value-identical to the old formulas; numeral sequences are identical before and after; four of five example bodies are byte-identical and the fifth differs only by the permitted cancellation-identity rewording. Every pinned constraint held — `min(S` at 0, 31 headings byte-identical, 10/10 cross-references resolving, the anchor census at 3/3/2/1/1, ADR-0016 append-only with `Accepted` intact, `SKILL.md` genuinely unedited, and the generated distribution clean.

Coverage is **inapplicable** for this surface, not below floor: no executable path exists and none can be written. No behavioural test was invented.

Three findings (F1, F2, F3) go to the reviewer. None blocks: all are pre-existing text, and F1/F2 are matters of a new claim over-reaching what the document supports rather than of any figure being wrong.
