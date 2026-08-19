---
id: FINAL-20260819T123713Z-1c38
title: Final Report — One span rule over any slice set
status: READY_WITH_WARNINGS
created_at: 2026-08-19T12:37:13Z
updated_at: 2026-08-19T12:37:13Z
cycle: 0
---

## Related

- Spec: [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md)
- Plan: [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md)
- Fix plan (cycle 1): [FIX-20260819T105159Z-3cd7](../code-review/FIX-20260819T105159Z-3cd7-stale-span-rule-assertions.md)
- Fix plan (cycle 2): [FIX-20260819T113512Z-438c](../code-review/FIX-20260819T113512Z-438c-open-span-claim-slot-guard.md)
- Test report: [TEST-20260819T120312Z-5d31](../test/TEST-20260819T120312Z-5d31-open-span-claim-slot-guard.md)
- Code review: [CR-20260819T121737Z-7abb](../code-review/CR-20260819T121737Z-7abb-open-span-claim-slot-guard.md)
- QA report: [QA-20260819T122446Z-d349](../qa/QA-20260819T122446Z-d349-open-span-claim-slot-guard.md)
- Spec eval: [EVAL-20260819T123713Z-4372](../eval/EVAL-20260819T123713Z-4372-one-span-rule-slice-set.md)

## Summary

Closes `arch-2` of the 2026-08-19 backlog. `references/config.md` now states the "concurrent max plus serial remainder" shape **once** —

```
span(P) = max over the non-integration members m of P of span(m)   +   tasks(i(P))
```

— with two base cases, and derives `span(L)` (split and leaf), `span_max`, `M_flat`'s span term and the viable-flat `span_base` as that rule applied to a named slice set. `T` and `M_seq` are deliberately **not** applications and say so where they are defined.

A reframing, not a repricing: **no figure moved.** Aggregate against base `d297e6c`: 5 files, +87/-44, plus ADR-0017.

## What the cycles actually found

Three review cycles, each finding a real defect — and the eval identified the root cause of all three: **the spec froze a string that was arithmetically wrong, and no escalation path existed for a frozen-but-wrong constraint.**

- **Cycle 1** — two normative sites computed the wrong number when `X > 0`. `config.md:316` gave `span_base` = 20 where the rule yields 24; `:309` gave post-split `span_max` = 12 where it yields 16. Safe only when read together, and the realistic pairing was not together: `span_base` from *The baseline* with the post-split term from *Marginal-gain rule* yielded `g` = 12 against a true 8.
- **Cycle 2** — the "only other places the shape appears" claim was false in the shipped tree, falsified by `config.md:309` — created by cycle 1's own fix one phase before the enumeration was written. And `SKILL.md:544`'s guard was wrong in both count and source: three slots exist, the new one fed from the lane-level field.
- **Cycle 3** — a provenance clause over-reaching by one item: `:208`/`:234` attribute both Step 2p.2 print blocks to ADR-0016 §5, which covers only the flat block.

Severity falls monotonically and `must_fix` runs **3 → 2 → 0**; the failure mode changed kind from self-invalidating to static. Converging, not churning — but every cycle traces to a *plan* defect propagated faithfully by the coder, which is the pattern worth fixing.

## Issues found

1. **`config.md:208`/`:234` cite ADR-0016 §5 for both print blocks**, where §5's heading and body cover only the flat one. A false citation attached to a *correct* instruction — both sentences end by requiring the change be carried by hand into those blocks — and unlike its predecessors it does not decay. Load-bearing in the dangerous direction: an editor reading `:208` concludes the nested block is byte-frozen and declines to fix it, the exact reasoning that left it wrong for two cycles.
2. **`:208` reintroduces a count** ("its two Step 2p.2 print blocks") — true today, but the same self-invalidating shape removed from ADR-0017 `:5` in the same cycle. `:5`'s repair (named rather than counted) is the model.
3. **The "not a census" disclaimer protects completeness, not attribution correctness.** Proposed oracle: any sentence citing an ADR section as a site's governing decision must have that section's heading and body re-read and asserted to reach the site.
4. **`docs/adr/0014:87` says the nested block "reserves two slots" — now three.** ADR-0014 was verified `md5`-identical (unamended) and mistaken for truth-preserving. The generalisable blind spot: *the harness verified the documents it edited, never the documents it invalidated.*
5. **Pre-existing, confirmed by diff, not regressions:** `M_flat`'s interface term omits the 0.25 conversion (literal reading gives 32 vs the printed 29 on example 5), and examples 2/3 label a sub-lane-set span as `span_max`.
6. **No escalation path for a frozen-but-wrong constraint** — the root cause of the aggregate G8 of 1.33.
7. **Tooling hazard, verified independently:** the shell's proxied `diff` prints differences correctly but returns **exit 0** on differing files, so `diff a b && …` falsely reports identical. Every byte-identity claim here was re-established with `cmp`/`shasum`/`md5`/`git diff --no-index`.

## Test plan

- **No behavioural test exists or can exist.** `parallelism` defaults to `off` and `full` with k >= 2 is unreachable; probed — zero hits for `span_max`/`span_base`/`makespan` in any `.js`/`.mjs`/`.ts`/`.sh`. Recorded as structurally impossible, not as an omission. Coverage inapplicable, not below floor.
- **No figure moved**, verified on four independent conventions across three roles; the 448/505/507 spread is convention drift only (a maximal-`[0-9]`-run convention splits `0.25` into two tokens). Every convention returns identical base-vs-head sequences. Four of five example bodies byte-identical by md5; the fifth differs only in a mandated prose clause.
- All five worked examples hand re-derived from the rewritten rule at four separate stages — no disagreement, no numeral ever adjusted to make a check agree.
- Post-regeneration census: exactly **one** normative definition (`config.md:227`); 12 applications / 12 illustrations / 3 displays; zero second definitions.
- Slot guard proved complete: filling `:531`/`:533`/`:534` from `:544`'s text alone yields `span_max = max(12, 8) + integration(4) = 16` and `g = 8`; the `g = 24 − 12 = 12` mis-fill is unreachable.
- No-regression floor over unrelated surface: `clean-code-gates` 225/225, `node scripts/build-prime-agent.mjs --check` exit 0 (11 skills, 154 files), `prime-agent && npm test` exit 0.
