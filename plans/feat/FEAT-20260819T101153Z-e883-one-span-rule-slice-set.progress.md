# Progress: FEAT-20260819T101153Z-e883 — One span rule over any slice set, at any depth (ADR-0017)

**Plan**: [FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md](./FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md)
**Spec**: [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md)
**Status**: DONE
**Created**: 2026-08-19T10:13:42Z

---

## Log

### 2026-08-19T11:12:00Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: 38 (plus 26 phase-verification checks = 64 checkboxes), across 8 phases.

Phase 7 — regenerate, re-census, prove the floor:

Completed task: "Regenerate the distribution" — `node scripts/build-prime-agent.mjs` exit 0, "wrote prime-agent/skills with 11 skills (154 files)". `git status` on `prime-agent/skills` was **clean before regeneration**, proving no hand edit at any point, and shows exactly one modified file after it — `prime-agent/skills/orchestrator/references/config.md` (29 insertions, 15 deletions), matching the source edit one-for-one.
Completed task: "Post-edit anchor + quote-fidelity census" — `':(exclude).claude'` = **3**, `the call shape from *How to spawn a subagent*` = **3**, `through a **single sequential coder invocation**` = **2** in SKILL.md; the unbolded quotation = **1** in references/config.md, and the two strings still match word-for-word ("— after its sibling sub-lanes are DONE, never concurrently with them"); overlay `find` strings occurring in config.md = **1** (the ADR-0001 link). **Exact match to the Phase 0 census, zero drift.** Re-derived independently from the Phase 0 file snapshots as a cross-check.
Completed task: "Full no-regression floor" — `cd plugins/my-skills/skills/clean-code-gates && npm test` exit **0** at **225 passing / 0 fail**; `node scripts/build-prime-agent.mjs --check` exit **0** ("up to date (11 skills, 154 files)"); `cd prime-agent && npm test` exit **0** (install ok, parity ok). These prove nothing else broke; they are not evidence this change is correct — that is what Phase 5's two independent arithmetic checks are for.

Phase 7 verification: `--check` exits **0** outright (tightened from the Phases 1-4 source-drift allowance); `prime-agent npm test` exit 0; `clean-code-gates` exit 0 at 225 passing; post-edit census matches Phase 0 exactly.

Final re-assertion after regeneration: 31 headings byte-identical; `max`-plus-`tasks(integration)` shape written exactly once (the rule's own fence); `min(S` = 0 in config.md; no numeral drift across all five worked examples.

Files changed: `plugins/my-skills/skills/orchestrator/references/config.md` (29+/15-), `docs/adr/0016-top-level-integration-lane-pricing.md` (11+/0-), `docs/adr/0017-one-span-rule-over-any-slice-set.md` (new), `prime-agent/skills/orchestrator/references/config.md` (generated). `SKILL.md` and `templates/architect.md` deliberately untouched.

Plan tasks remaining: 0 unchecked

### 2026-08-19T11:04:00Z | CODER

Phase 6 complete — ADR-0017 authored and ADR-0016 forward-pointed. Tasks completed: 5 + 3 verification checks.

Completed task: "Re-confirm `0017` is next free, then author the ADR" — `ls docs/adr/` re-run immediately before writing: `0016` is still the highest, `0017` free. Wrote `docs/adr/0017-one-span-rule-over-any-slice-set.md` in ADR-0016's style: `Status: Accepted`, `Date: 2026-08-19`, `Skills affected` naming `orchestrator` and the specific `references/config.md` sections touched (and recording that `SKILL.md` / `templates/architect.md` are unamended), `Source finding` citing the `feat/prime-agent-distribution` backlog item **`arch-2`** and `SPEC-20260819T100451Z-01da`, and a `Lineage` paragraph placing it after ADR-0012 → ADR-0014 → ADR-0016 — framed as removing the surface a fourth instance could appear on rather than correcting a fourth instance.
Completed task: "State what is superseded" — a `## What this supersedes` section naming exactly two things, both framing only: ADR-0016's *The `g`/`c` interaction — derived, not asserted* `span_base = M + X` / `span_max = S + X` block, and §3's both-sites-or-neither assertion (superseded as a **mandate**, retained as a **consequence**). Explicitly records that ADR-0016's `Status:` stays `Accepted`.
Completed task: "State what stands" — a `## What stands` section: every ADR-0016 figure; §1, §2, §4, §5, §6, §7; the three-branch old-model comparison (kept in ADR-0016, deliberately not re-inlined); the **`min(S, X)` sequential-baseline result**, with the explicit note that `references/config.md` carries no `min(S, X)` claim because adding one would be new normative content rather than a compression (FR-7 satisfied here, per the plan's Technical Note); ADR-0012, ADR-0013 (**explicitly**), and ADR-0014 unamended; every config.md heading; and the Step 2p.2 template strings byte for byte.
Completed task: "Record Consequences" — no figure moves (with both independent checks named); the reconciliation identity unchanged, still carrying the "a passing reconciliation is not evidence the model is right" warning; the depth cap now explicit at the arithmetic; integration-lane pricing now a one-site edit; and the **"three depths of one defect"** observation ADR-0012 → ADR-0014 → ADR-0016 as the reason the ADR exists. A separate `## Deliberate divergences` section records, per *mirror machinery*, that the generic rule subsumes **neither** the never-a-sub-split-candidate claim **nor** the depth cap.
Completed task: "Add the ADR-0016 forward pointer" — one bullet appended to ADR-0016's Consequences, mirroring the precedent ADR-0016 itself set with ADR-0014's deferred bullet ("Addressed separately, and now filed"). It names ADR-0017, states that only the derivation framing is superseded, and asserts every decision and figure stands. **`git diff` on ADR-0016 is 11 insertions, 0 deletions** — no conclusion deleted or rewritten; `Status: Accepted` unchanged at line 3.

Phase 6 verification: `docs/adr/0017-one-span-rule-over-any-slice-set.md` exists and carries all 11 required sections/fields; `git diff docs/adr/0016-…` shows an added forward pointer only, `Status:` line untouched; every ADR cross-reference in 0017 (0012, 0013, 0014, 0016) resolves to an existing file.

Plan tasks remaining: 3 unchecked

### 2026-08-19T10:56:00Z | CODER

Phase 5 complete — the two independent arithmetic checks. Tasks completed: 7 + 3 verification checks. **No numeral moved anywhere, and no numeral was ever adjusted to make a check agree.**

Completed task: "Mechanical no-numeral-drift" — the five worked-example subsections re-extracted post-edit by heading text and compared numeral-sequence-for-numeral-sequence against the Phase 0 oracle: 45/45, 63/63, 62/62, 147/147, 131/131 — **identical sequences, zero drift**. Four of the five bodies are additionally **byte-identical** to their pre-edit sha256. The fifth (example 5) differs by exactly one line, the permitted one: `Via the cancellation identity,` → `Via the cancellation identity (*The makespan model*, above),` … `as it must be: X is common to both slice sets and cancels by construction, not by coincidence.` Its arithmetic (`g` = `M − S` = `20 − 12` = **8**) is untouched.

Hand re-derivations — every figure recomputed from the **rewritten** rule, none read off the old text:

Completed task: "**Example 1** — *the gate verdict and the ladder figure must agree*". Lane set `{12, 6}`, `i(run) = none` so `X = 0`. Rule over the unsplit lane set: `span_base = max(12, 6) + 0` = **12**. Candidate: rule over the 12-lane's sub-lane set `{6, 6}` with `i(L) = none` → `span(L) = max(6, 6) + 0` = **6**; rule over the lane set → `span_max = max(6, 6) + 0` = **6**. Overhead **4** flat / `A+A+J+J` = **8** nested. `M_flat` = **16**, `M_nested` = **14**. `g` = `12 − 6` = **6**, `c` = `8 − 4` = **4**, `6 > 4` → **adopted**, and 14 < 16. Cross-check via the cancellation identity: `M` = 12, `S` = 6, `M − S` = **6**. Every printed figure reproduced.
Completed task: "**Example 2** — *one lane carries all the work (sequential baseline)*". `T` = **24** as a **sum**, and the baseline `span_base` = `T` = **24** comes from that sum, **not** from the span rule — confirmed against the non-viable row's new "a sum, not the span rule" wording. `i(run) = none` (`X = 0`). Rule over `{ui: 8, data: 8, services: 8}` with `i(L) = none` → `span(mobile)` = **8**; rule over the lane set → `span_max` = **8**. Overhead `A+A+J+J+I((0+2)×0.25=0.5)` = **8.5**. `M_seq` = **24**, `M_nested` = **16.5**. `g` = `24 − 8` = **16**, `c` = **8.5**, **adopted**. Leaf re-application: **3** leaves ≥ 2; `8/24` = **33%** ≤ 70%. Counterfactual `{20, 4}`: `span_max` = **20**, `g` = **4** < `c` **8.5** → rejected, degrade to **`off`**. All reproduced.
Completed task: "**Example 3** — *a split carrying an integration sub-lane*". `X = 0` at the lane level; the sub-lane slice set declares `integration = 6`. Rule: `span(mobile)` = `max(concurrent) + tasks(i(L))` = `5 + 6` = **11** — the non-zero sub-lane integration slice is charged **after** the concurrent `max`, exactly as the rule's `+ tasks(i(P))` serial remainder requires. `span_max` = **11**. Overhead `A+A+J+J+I((0+8)×0.25=2)` = **10**. `M_seq` = **24**, `M_nested` = **21**. `g` = `24 − 11` = **13** > `c` **10**, margin **3**, improvement `3/24` = **12.5%**. Pre-field counterfactual: `tasks(i(L))` read as 0 → `span_max` **5**, `g` **19**, margin **9** — wrong by `11 − 5` = **6**. Aggregate payback `8 ≤ T = 24` passes; under the superseded `min(leaf) = 3` it failed. All reproduced.
Completed task: "**Example 4** — *`k = 2`, the case the overlap exists for*". `{A: 24, B: 10, C: 4}`, `X = 0`, `T` = **38**; flat viable (`24/38` = **63%**). `span_base` = `max(24, 10, 4) + 0` = **24**; flat overhead `A+J+I(0)` = **4**; `M_flat` = **28**. Adoption 1: `span(A)` = `max(8,8,8) + 0` = **8**, recomputed `span_max` = `max(8, 10, 4) + 0` = **10**, `g₁` = **14**, `c₁` = `A(2)+J(2)+I(0.5)` = **4.5** → adopted; overhead **8.5**, `M_nested` **18.5**. Adoption 2 — **critical lane recomputed to `B`**: `span(B)` = **5**, `span_max` = `max(8, 5, 4) + 0` = **8**, `g₂` = **2**, `c₂` = `I(0.5)` = **0.5** (no `A`, and — per ADR-0013 — no `J`, the inner-join level being `slowest-of-k`) → adopted; overhead **9**, `M_nested` **17**. Superseded serialized reading: `c₂` = **2.5** vs `g₂` **2** → rejected, and its own `M_nested` = **19** > 18.5 — self-consistent then, reversed now. Reconciliations: cost `9 − 4` = **5** = `4.5 + 0.5`; gain `24 → 8` = **16** = `14 + 2`. Remaining gates: leaves `{8,8,8,5,5,4}` sum **38** = `T`; largest `8/38` = **21%**; aggregate IP **4** ≤ 38; **6** leaves = ceiling **6**. The ADR-0013 inner-join `J` charge is unchanged. All reproduced.
Completed task: "**Example 5** — *a declared top-level integration lane*". `{backend: 20, frontend: 12, admin: 6}` + `wiring` at **4**; `T` = **42**; `X` = **4**. Flat verdict with `wiring` excluded from the two conditions: **3** lanes ≥ 2, `20/42` = **48%** ≤ 70% → viable. Rule over the unsplit lane set: `span_base` = `max(20, 12, 6) + 4` = **24** (`M` = 20); flat overhead `A+J+I(4×0.25=1.0)` = **5**; `M_flat` = **29**; `M_seq` = `T` = **42** (reference only). Adoption: `span(backend)` = `max(8, 8) + 0` = **8**; rule over the lane set → `span_max` = `max(8, 12, 6) + 4` = **16** (`S` = 12). Nested overhead `A+A+J+J+I((4+2)×0.25=1.5)` = **9.5**; `M_nested` = **25.5**. `g` = `24 − 16` = **8**, and independently via the cancellation identity `M − S` = `20 − 12` = **8**. `c` = **4.5** → adopted. Reconciliation `29 − 25.5` = **3.5** = `8 − 4.5`. Lanes left flat: `frontend` `{11, 1}` → `11/12` = **92%** > 70%; `admin` off the critical path → `g` = **0**; `wiring` not a candidate. Gates: IP `4 + 2` = **6** ≤ 42; **4** non-integration leaves, largest `12/42` = **29%** with `wiring` excluded from the conditions but in the `T` denominator; **4** ≤ ceiling **6**. Uncorrected-model contrast reproduces too: `M_flat` **25**, `M_nested` **21.5**, difference **3.5** — reconciling while both figures were understated by `X` = 4. Every figure matched; **zero disagreements, so no BLOCKED route was needed**.
Completed task: "Re-confirm the five-example coverage claim" — `X = 0` at both levels (examples **1** and **2**); a non-zero **sub-lane** integration slice (example **3**); `k = 2` with a recomputed critical lane (example **4**); a non-zero **top-level** `tasks(integration)` with the cancellation identity shown explicitly (example **5**). Coverage holds unchanged after the rewrite.

Phase 5 verification: the worked-example diff contains **zero** numeral changes and exactly one permitted textual change; all five hand re-derivations recorded above, each reproducing the printed figures exactly; `--check` fails on source drift only, as in Phase 1.

Plan tasks remaining: 8 unchecked

### 2026-08-19T10:48:00Z | CODER

Phase 4 complete — SKILL.md audit and cross-reference re-resolution. Tasks completed: 4 + 3 verification checks.

Completed task: "Audit `SKILL.md` for a normative restatement of the span shape" — **outcome: no normative restatement found; `SKILL.md` is UNTOUCHED** (AC-14's recorded-outcome branch). Every span-bearing line was read: `:505` / `:528`-`:535` are Step 2p.2 print-block template strings (frozen by AC-14, and by ADR-0016 §5 a deliberate legibility decision, not a fifth normative statement); `:512` explicitly points — "`span_base` is defined normatively in `references/config.md` → *The makespan model* → *The baseline*, and is **not redefined here**; this block only displays it"; `:544` closes with "The arithmetic those slots feed is normative in `references/config.md` → *The makespan model*; this block only displays it"; `:546` is a display gloss explaining why two *printed lines* differ (which line holds a lane span and which a run span) inside that display-framed block, not a definition; `:477`, `:565`, `:615`, `:636`, `:676`-`:678` and `:875` name `M_flat` / `M_nested` / `M_seq` / `span_base` referentially or as ladder display. Nothing restates the `max`-plus-serial-remainder shape as normative text, so nothing was edited.
Completed task: "Assert the Step 2p.2 print-block template strings byte-identical" — SKILL.md `#### 2p.2` whole-section sha256 matches Phase 0 (`bad154ea…`, 10625 B); all **3** fenced blocks hash-match individually; each of the four AC-14 strings still occurs exactly **once** — `Estimated speedup: {T} / span_base(max(concurrent {n},…) + integration({n}) = {span_base}) = {S}×`, the `Integration lane:` line, `span({lane})`, `span_max`.
Completed task: "Re-resolve every cross-reference target" — all **ten** Phase 0 targets resolve, each exactly once: *The makespan model*, *The baseline* (bolded paragraph label, not a heading), *The two work-concentration conditions are evaluated at leaf granularity*, *Leaf-level re-application…*, *Per-sub-lane re-application…*, *Containment* (resolves to `**Containment (case 6, load-bearing).**`), *Owned-glob rejection…*, *The cost side*, *Greedy, recomputed adoption*, *Degradation*. Zero unresolved. `templates/architect.md` re-read at `:245` / `:247`: both name `span_base` / `span_max` / `span(L)` purely referentially ("the one the run's `span_base` and `span_max` were priced against") and restate no formula — **no amendment needed** (AC-15).
Completed task: "Assert *Untrusted metadata* and the digest untrusted-framing paragraph byte-identical" — config.md *Untrusted metadata* sha256 `d4fdb142…` **matches**; SKILL.md:488 paragraph `2f515c10…` **matches**, and its 488-494 block `6734b0fb…` **matches** (AC-26).

Phase 4 verification: zero unresolved cross-references; print-block and untrusted-section hashes match Phase 0 exactly; `git diff --stat` shows only `references/config.md` changed (28 insertions, 14 deletions) — `templates/architect.md` and `SKILL.md` untouched; `--check` still fails on source drift only.

Plan tasks remaining: 8 unchecked

### 2026-08-19T10:42:00Z | CODER

Phase 3 complete — exclusion prose partially collapsed (generalized first, then merged). Tasks completed: 4 + 3 verification checks.

Completed task: "Rewrite the canonical blockquote at the deferral site" — now the **single generic statement**: both conditions exclude the declared integration slice of *whatever slice set they are evaluated over*. It names both instantiations explicitly (run's lanes → the top-level integration lane; one lane's sub-lanes → that split's declared integration slice), carries the only surviving worked counter-examples `{backend: 20, integration: 4}` and `{a: 3, b: 3, integration: 18}`, the "these two conditions only; counts in full in `span_base`, `span_max`, `M_flat`, and `T`, including as the `70%` denominator" scope limit, and the `integration: none` reassurance once.
Completed task: "Replace the *Per-sub-lane re-application* blockquote" — one-line pointer naming **the split's declared `integration` slice** in that site's own vocabulary, stating it is still charged in full toward `span(L)` and `T`. Duplicated counter-examples removed. Not a bare cross-reference.
Completed task: "Replace the *Leaf-level re-application* blockquote" — one-line pointer naming **the run's top-level integration lane**, stating it still counts in full in `span_base`, `span_max`, `M_flat`, and `T`, with the `70%` denominator still the run total `T` which includes it. Duplicated counter-examples removed. Not a bare cross-reference.
Completed task: "Restate ADR-0016 §3 as a one-clause consequence" — the canonical site now reads that because the rule is stated over the slice set rather than over one named level, it **cannot apply at one evaluation site and not another**; the both-sites-or-neither symmetry is a consequence and the asymmetry is not even statable. The failure it guards against (`{backend: 20, integration: 4}` passing the very check it was deferred *because of*) is retained at the canonical site, and the *Leaf-level* pointer echoes "cannot land at one site and not the other" in one clause.

Phase 3 verification: `{a: 3, b: 3, integration: 18}` appears **exactly once**; the `integration: none` reassurance ("has nothing to exclude") appears **exactly once**; `{backend: 20, integration: 4}` **once**, and the duplicate `{work: 20, integration: 4}` is **gone**; zero bare "see above" strings in the file; heading inventory still **31**, byte-identical; `--check` fails on source drift only.

Plan tasks remaining: 15 unchecked

### 2026-08-19T10:36:00Z | CODER

Phase 2 complete — cancellation identity compressed, not deleted. Tasks completed: 3 + 3 verification checks.

Completed task: "Replace the fenced derivation block" — the three-column fence is gone. Replaced by one sentence deriving the cancellation from the one rule: `span_base` and `span_max` are the same function applied to two slice sets declaring the identical `i(run)`, and `X = tasks(i(run))` is a run constant invariant under adoption (Phase 1's independent never-a-sub-split-candidate claim), so the `+ X` term cancels **by construction**, leaving **the cancellation identity** `g = M − S`. The `M` / `S` / `X` notation is still defined in prose, because worked example 5 prints `span_base` = `M + X` = `20 + 4` and must keep resolving.
Completed task: "Keep the sequential-baseline half intact" — `g = T − (S + X)` survives unabridged, with the reason stated (there `span_base` is `T`, a sum that already counts the integration work as ordinary work rather than holding it back to the end). No `min(S, X)` claim added to config.md — `grep 'min(S' references/config.md` still returns **0**, per the plan's Technical Note; FR-7 is satisfied via ADR-0017's *what stands* list in Phase 6.
Completed task: "Keep the `M_flat − M_nested = g − c` reconciliation" — retained as holding on both baselines, now carrying the ADR-0016 point explicitly: a defect in this term moves **both** makespans by the same amount, so the reconciliation goes on balancing while both figures are wrong — a passing reconciliation is not by itself evidence the model is right. The three-branch old-model comparison stays referenced to ADR-0016, not re-inlined.

Phase 2 verification: `span_base = M + X` fence absent (**False** on presence check); sequential sentence and reconciliation sentence both present; `min(S` = **0**; `node scripts/build-prime-agent.mjs --check` fails on source drift only, as in Phase 1.

Plan tasks remaining: 19 unchecked

### 2026-08-19T10:30:00Z | CODER

Phase 1 complete — the one rule and its four derivations. Tasks completed: 7 + 3 verification checks.

Completed task: "Write the single normative span rule" — added as lead text inside `#### The makespan model`, after the task-equivalent unit paragraph and **before** every quantity that references it. Generic over slice set `P` with declared integration slice `i(P)`, fenced as `span(P) = max over the non-integration members m of P of span(m)   +   tasks(i(P))`, with both base cases (`span(leaf) = tasks(leaf)`, `tasks(none) = 0`). No heading added.
Completed task: "Restate `span(L)` as two applications of the rule" — split case = the rule over that lane's sub-lane set with `i(L)` its declared `integration` slice; unsplit case = the leaf base case. Both attached blockquotes preserved verbatim, including the exact unbolded quotation `through a single sequential coder invocation — after its sibling sub-lanes are DONE, never concurrently with them`.
Completed task: "Restate `span_max`" — now the rule applied to the run's lane set with `i(run)` the top-level integration lane; kept "the bare critical-path term, carrying **no** overhead" and its role as the term the marginal gain is measured over.
Completed task: "Restate `M_flat`'s span term and the viable `span_base` cell" — `M_flat` references `span_base` **by name** ("named and defined in *The baseline* immediately below … nowhere re-expanded"); the viable row reads "the span rule over the run's lane set with **every lane unsplit** — each lane at its leaf `span`". Neither re-expands the shape.
Completed task: "Keep the non-viable row as `span_base = T` and state `T` is a sum" — row cell now carries "**a sum, not the span rule**", with a new paragraph after the table stating the two rows are different kinds of quantity.
Completed task: "State `T` and `M_seq` are outside the rule" — stated in the `M_seq` bullet and again in the post-table paragraph, both with the ADR-0016 §2 reason (an `off` run forms no slice set and implements integration work one task at a time).
Completed task: "Preserve the two independent statements" — (a) the never-a-sub-split-candidate blockquote is untouched, carrying the `tasks(i(run))` run-constancy the Phase 2 cancellation sentence depends on; (b) new blockquote states the depth cap explicitly — exactly two depths, Steps 2s/3s dispatch no third, the generality of `P` is a statement economy and not a capability claim.

Phase 1 verification: config.md heading count **31 = 31** with heading text byte-identical (zero renames/additions/re-levellings); the `max`-plus-`tasks(integration)` shape occurs **exactly once** inside `#### The makespan model` (the rule's own fence) and zero times in `span(L)`, `span_max`, `M_flat`, or the viable row; `node scripts/build-prime-agent.mjs --check` exits 1 on **source drift only** (`stale: prime-agent/skills/orchestrator/references/config.md`), never on an occurrence-count mismatch — the expected Phases 1-4 signal.

Plan tasks remaining: 22 unchecked

### 2026-08-19T10:22:00Z | CODER

Phase 0 complete — pre-edit oracle captured (5 artifacts in scratch). Tasks completed: 5 + 4 verification checks.

Completed task: "Record the pre-edit numeral oracle" — five worked-example subsections located by heading text; numeral counts + sha256 of each body recorded: `the gate verdict and the ladder figure must agree` (L324-339, 45 numerals), `one lane carries all the work (sequential baseline)` (L340-359, 63), `a split carrying an integration sub-lane` (L360-379, 62), `` `k = 2`, the case the overlap exists for `` (L380-416, 147), `a declared top-level integration lane` (L417-446, 131).
Completed task: "Record the pre-edit anchor + quote-fidelity census" — `':(exclude).claude'` = **3**, `the call shape from *How to spawn a subagent*` = **3**, `through a **single sequential coder invocation**` = **2** in SKILL.md; unbolded quotation = **1** in references/config.md; overlay `find` strings occurring in config.md = **1** (the ADR-0001 link). Matches the expected 3/3/2/1/1. Quote fidelity confirmed byte-for-byte modulo the bold markers.
Completed task: "Record the pre-edit cross-reference target inventory" — 78 occurrences across the ten named targets in SKILL.md / templates/architect.md / references/config.md; config.md heading count = **31**. Note: *The baseline* resolves to a bolded paragraph label at config.md:241, not a heading — recorded so Phase 1 preserves it.
Completed task: "Record the pre-edit byte hashes" — config.md *Untrusted metadata* sha256 `d4fdb142…` (1492 B); SKILL.md digest untrusted-framing paragraph sha256 `2f515c10…` (451 B) and its 488-494 block `6734b0fb…` (3163 B); SKILL.md Step 2p.2 section sha256 `bad154ea…` (10625 B) with its 3 fenced blocks hashed individually. All four AC-14 template strings present exactly once each.
Completed task: "Record the pre-edit no-regression floor" — `clean-code-gates npm test` exit 0 at **225 passing / 0 fail**; `node scripts/build-prime-agent.mjs --check` exit **0** ("up to date (11 skills, 154 files)"); `prime-agent npm test` exit **0** (install ok, parity ok).

Phase 0 verification: all five oracle artifacts non-empty; `--check` exit 0 on the clean starting tree; clean-code-gates 225 passing; prime-agent tests exit 0. All green.

Plan tasks remaining: 29 unchecked

### 2026-08-19T10:18:00Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T10:13:42Z | ARCHITECT

Created plan `FEAT-20260819T101153Z-e883`. Type: feat. Tasks: 38 across 8 phases.

Grounding checks run against the tree before planning (all confirmed):

- Anchor census pre-edit — `':(exclude).claude'` = **3** in `SKILL.md` (`:205`, `:235`, `:262`); `the call shape from *How to spawn a subagent*` = **3** (`:838`, `:898`, `:937`); `through a **single sequential coder invocation**` = **2** (`:981`, `:1047`) with its unbolded quotation = **1** in `references/config.md` (`:229`). Confirmed the spec's correction: no overlay `find` string in `prime-agent/overlays/orchestrator.json` matches `sequential coder`, `span`, `integration`, or `makespan` — that phrase is a **quote-fidelity** constraint, not a build hard-fail. `references/config.md` carries exactly **one** overlay anchor (the ADR-0001 link).
- `min(S, X)` is **not present in `references/config.md`** (0 matches); it lives in ADR-0016 at `:141`, `:144`, `:183`. Recorded as a Technical Note so the coder satisfies FR-7 by preserving `config.md`'s `g = T − (S + X)` sentence and listing the `min(S, X)` result under ADR-0017's *what stands* — **not** by adding new normative text to `config.md`.
- `docs/adr/` tops out at `0016` — `0017` is next free, to be re-confirmed before writing.
- Test floors exist and are real: `clean-code-gates` `"test": "node --test"`; `prime-agent` `"test": "bash tests/install.sh && bash tests/parity.sh"`.
- The three exclusion blockquotes were read in place and are confirmed **not** three copies of one rule — `:74` and `:498` are the top-level rule at two evaluation sites, `:482` is the sub-lane rule. The plan therefore requires the canonical statement to be generalized over the slice set *before* the collapse.

Status: PLANNED. Ready for coder.

---

## Handoff

| From      | To        | Condition                  | Action                                                           |
| --------- | --------- | -------------------------- | ---------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260819T101153Z-e883`          |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260819T101153Z-e883`       |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with CR-{NNN} file path`                       |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260819T101153Z-e883`             |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with QA-{NNN} file path`                       |

### SIMPLIFY — 2026-08-19
Single-pass inline over the plan's scope (one source file plus two ADRs; the generated mirror is excluded and rebuilt). Stated as single-pass rather than the 5-angle fan-out because the diff is one markdown file and reuse/efficiency have no purchase on normative prose at this size.

Fixed 0. The rewrite is deliberate and internally consistent: the rule is stated once before any quantity that references it, each span quantity is written as the rule applied to a named slice set rather than re-expanded, the two non-applications (T, M_seq) say so where they are defined, and the depth-cap guard at :236 correctly forecloses reading the generic `P` as licence to nest deeper.

Reported 1, not applied. config.md:242 and :246 are two near-verbatim blockquotes each arguing that an integration slice is serial and must be modelled as serial — one for the sub-lane, one for the top level — and both now restate the general argument the new paragraph at :232 makes once ("modelling it inside the max would model an execution order the skill forbids — optimistically, understating the critical path by exactly the serial work"). This is the same duplication family arch-2 addressed, one level over: the change unified the formula and left the justification stated three times. Each blockquote could keep only its site-specific content — the SKILL.md dispatch citation and the ADR attribution — and defer the shared argument to :232. NOT applied here for two reasons: the spec scoped the collapse to the three exclusion blockquotes and these are different blockquotes, and editing normative prose after the coder's completed two-check hand verification would invalidate that verification for a cleanup. Routed to the reviewer to rule on.

Bugs: none. No edits were made, so the coder's gates stand unchanged and were re-confirmed: clean-code-gates 225/225, build --check exit 0, prime-agent npm test exit 0.

### 2026-08-19T10:34:48Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T103448Z-5a36-one-span-rule-slice-set.md
Status: PASS
Coverage: N/A → N/A (inapplicable, not below floor)

No e2e added and none is possible: `parallelism` is `off` in this repo and the `full` level with `k >= 2` is unreachable, so no executable path exists for the span rule. Per PROJECT-CONTEXT → Test tooling, verification is structural + arithmetic. No behavioural test was invented to satisfy a coverage habit.

Central claim verified independently and adversarially: **no figure moved.** Five worked examples hand re-derived from the rewritten rule (every printed figure reproduced); nine derived quantities recomputed under the new rule vs the old literal formula (value-identical at every site); numeral sequences identical before/after; four of five bodies byte-identical, fifth differing only by the permitted cancellation-identity rewording. The four dependents each recover their pre-edit formula exactly — no silent meaning change. `T`/`M_seq` confirmed outside the rule.

Pinned constraints held: `min(S` = 0, 31 headings byte-identical, 10/10 cross-references resolve, anchor census 3/3/2/1/1 zero drift, ADR-0016 append-only with Accepted intact, ADR-0012/0013/0014 + architect.md unamended, `SKILL.md` unedited (audit verified, not assumed), distribution clean.

Floors green: clean-code-gates 225/225 exit 0; build --check exit 0; prime-agent npm test exit 0.

Three non-blocking findings for the reviewer (F1 overstated one-site claim + two incomplete surviving re-expansions; F2 `SKILL.md:534` outside the ADR-0016 §5 exemption; F3 simplify's `:243`/`:246` finding assessed as narrowly right). All pre-existing text; none moves a figure.

### 2026-08-19T10:49:05Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T104419Z-fc4f-one-span-rule-slice-set.md
Status: REQUEST_CHANGES
Must Fix: 3 | Should Fix: 2

Verdict rationale: the reframing itself holds — worked example 5 independently re-derived from the rewritten rule (T=42, span_base=24, M_flat=29, span_max=16, M_nested=25.5, g=8, c=4.5, reconciliation 3.5), 31/31 headings byte-identical by text diff, anchor census 3/3/2/1/1, `grep 'min(S'` = 0, ADR-0016 append-only 11/0 with Status: Accepted, ADR-0012/0013/0014 and templates/architect.md untouched, SKILL.md unchanged vs HEAD, all three floors green (225/225, build --check exit 0, prime-agent install+parity ok). Coverage correctly reported inapplicable, not below floor.

Blockers are in the change's own assertions, not its edits:
- MF-1 (upgraded from tester F1, medium → blocking): config.md:309 and :316 state the pre-ADR-0016 span_max/span_base shapes. config.md:459 names those exact expressions ("span_base read max(20,4)=20 and span_max read max(12,4)=12") as the uncorrected model. Pairing the now-canonical :259 span_base (24) with the stale :309 span_max (12) yields g=12 on example 5 against a true 8 — overstated by exactly X. Text-only, moves no numeral, not on the Out of Scope list, and AC-2 already forbids a re-expanded span_base statement.
- MF-2: config.md:234's "one-site edit" claim and ADR-0017:180-183's "there is no longer a set of statements that must be moved in agreement" are false in the shipped tree — 7 sites still carry the shape, 3 already out of agreement. Introduced by this change; needs scoping to the normative arithmetic, not deletion.
- MF-3 (upgraded from tester F2): ADR-0016 §5's heading and body cover the FLAT block only. The nested block at SKILL.md:534 is therefore unexempted and renders an inconsistent line when X > 0 — no slot filling is both self-consistent and correct. ADR-0017's "SKILL.md ... unamended, points rather than restates" compounds it.

Non-blocking: SF-1 (tester F3 — :243/:246 shared serial-remainder clause now trebled by the new :232; any collapse must scope to the shared clause and preserve the Step 3s quote-fidelity anchor, the Step 3j/3L citations, both ADR attributions and the scope limit); SF-2 (Progress Log numeral counts 147/131 are 146/130 under a heading-excluding convention — the AC-20 check is unaffected since the offset is identical on both sides; record the convention rather than correcting the verdict).

Invoke /architect with plans/code-review/CR-20260819T104419Z-fc4f-one-span-rule-slice-set.md to create FIX plan.

### 2026-08-19T11:58:30Z | CODER (FIX-20260819T105159Z-3cd7) — numeral-count extraction convention

Appended, not corrected — this file's contract is append-only, so nothing above is rewritten.

`CR-20260819T104419Z-fc4f` SF-2 observed that the numeral counts recorded in this log (`147` for the `k = 2` example and `131` for the declared-top-level-integration-lane example, at `:49` and `:122`) read as `146` and `130` under a heading-excluding extraction. Both readings are right; they differ only in the convention, which was never written down. It is written down here so the oracle is reproducible rather than merely self-consistent:

> **Convention.** A worked-example subsection spans from its own `#### Worked example …` heading line through the line before the next `####` heading, and **the subsection heading line is included** in the numeral extraction. A numeral is a maximal `[0-9]+(\.[0-9]+)?` run, so `25.5` is one token, `4×0.25` is two, and `70%` is one. Only two of the five heading lines carry a numeral at all — `` `k = 2` `` and `` tasks(integration) > 0 `` — which is the whole of the difference: those two subsections read one higher than they would under a heading-excluding extraction, and the other three are identical either way.

**The AC-20 verdict needs no correction.** That check compared a pre-edit extraction against a post-edit extraction under one and the same convention (`147/147`, `131/131`), so an identical offset on both sides cancels exactly. The no-numeral-drift result stands as recorded.

Re-verified under this stated convention while implementing `FIX-20260819T105159Z-3cd7`: the five subsections extract to **45 / 63 / 62 / 147 / 131**, matching the figures recorded above, and remain token-for-token identical across that plan's edits (453 numeral tokens in total).
