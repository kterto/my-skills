---
id: EVAL-20260819T123713Z-4372
plan: FEAT-20260819T101153Z-e883
status: PASS
created_at: 2026-08-19T12:46:48Z
updated_at: 2026-08-19T12:46:48Z
cycle: 0
---

**Related:** [SPEC-20260819T100451Z-01da](../specs/SPEC-20260819T100451Z-01da-one-span-rule-slice-set.md) · [FEAT-20260819T101153Z-e883](../feat/FEAT-20260819T101153Z-e883-one-span-rule-slice-set.md) · [FIX-20260819T105159Z-3cd7](../code-review/FIX-20260819T105159Z-3cd7-stale-span-rule-assertions.md) · [FIX-20260819T113512Z-438c](../code-review/FIX-20260819T113512Z-438c-open-span-claim-slot-guard.md) · [CR-20260819T121737Z-7abb](../code-review/CR-20260819T121737Z-7abb-open-span-claim-slot-guard.md) · [QA-20260819T122446Z-d349](../qa/QA-20260819T122446Z-d349-open-span-claim-slot-guard.md)

# Spec-Driven Evaluation — One span rule over any slice set (ADR-0017)

## Headline

| Metric | Value |
| --- | --- |
| **Final** | **0.97** |
| **Band** | **Spec-complete** (≥ 0.90) |
| Adjusted Final | **n/a** — no gate is confirmed-red |
| Implementation totals | **I = 65/67 checks MET** |
| Harness totals | **T = 20/21 checks MET** |
| Elicitation `E` | `E_recall` **0.75** · `E_precision` **0.75** · `E_justified` **1.00** |
| Scope `S` | **partial** (one justified, documented drift from a spec-frozen constraint) |
| Robustness `R` | **5.0** |
| Engineering Gates `G` | build ✓ · lint `not-run` (probed) · unit ✓ · e2e `n/a — structurally impossible` |

**Central claim verdict: CONFIRMED. This is a reframing, not a repricing. No figure moved.**

---

## 0. Setup, scoping, and conventions pinned by this run

### Diff surface

Base `d297e6cb2a8938f31bb0e5558b3718a87a2fa432`. Tracked: 5 files, +87/−44. Plus one untracked source file.

| File | Δ | Role in scoring |
| --- | --- | --- |
| `plugins/my-skills/skills/orchestrator/references/config.md` | +35/−19 | **primary implementation site** (normative owner) |
| `plugins/my-skills/skills/orchestrator/SKILL.md` | +3/−3 | secondary implementation site |
| `docs/adr/0016-top-level-integration-lane-pricing.md` | +11/−0 | forward pointer |
| `docs/adr/0017-one-span-rule-over-any-slice-set.md` | new (218 lines) | **new ADR** |
| `prime-agent/skills/orchestrator/references/config.md` | +35/−19 | **GENERATED mirror — not scored as implementation, not counted as duplicate work** |
| `prime-agent/skills/orchestrator/SKILL.md` | +3/−3 | **GENERATED mirror — same** |

`docs/adr/0012-*.md`, `docs/adr/0013-*.md`, `docs/adr/0014-*.md`, and `plugins/my-skills/skills/orchestrator/templates/architect.md` return an **empty** diff stat against base — the spec's "stands unamended" non-goals hold mechanically.

### Tooling hazard honoured

The shell's proxied `diff` returns exit 0 on differing files. **No byte-identity claim in this report rests on `diff`.** Every identity/inequality statement below was produced by Python `md5`/string equality or by `git show`-extracted baselines compared in-process. Where output precision mattered (`grep -n`, `sed -n`, `ls`), commands were run through `rtk proxy` to bypass the summarising proxy.

### Numeral-extraction convention — PINNED (this run)

> **Region.** `references/config.md`, from the line `#### Worked example — the gate verdict and the ladder figure must agree` up to but **excluding** `#### Greedy, recomputed adoption`. 123 lines in both base and head.
>
> **Numeral.** A maximal match of the regex `[0-9]+(?:\.[0-9]+)?` — so `0.25` is **one** numeral and `12` is one. Compared as an **ordered sequence**, not a multiset (a transposition fails).
>
> **This run's count: 448 in base, 448 in head, sequence identical.**

The 448 / 505 / 507 spread across prior roles is **convention drift, not disagreement**: QA-d349 pinned "a maximal run of `[0-9]`" (splitting `0.25` into `0` and `25`) and landed on 507. Both conventions return *identical* base-vs-head sequences, which is the only property the spec's FR-18 asserts. My convention is stated so this run is reproducible; it is not a claim that the others were wrong.

### Test-level policy for a spec with no executable path — PINNED

`parallelism` defaults to `off` in this repo (`.orchestrator/config.json` carries no `parallelism` key), the `full` level with `k >= 2` is unreachable here, and a repo-wide sweep for `span_max` / `span_base` / `makespan` in `.js` / `.mjs` / `.ts` / `.sh` returns **zero** hits. **No code path executes the span rule and none can be written without inventing the scaffold under test.**

Therefore, for this spec only, and frozen for any re-run:

- **`T-unit` and `T-e2e` are recorded `n/a — structurally impossible`, and are EXCLUDED from the `T` denominator** (treated exactly like a rubric `N/A`). They are **not** UNMET, and their absence is **not** a harness gap. This is stated here rather than left implicit precisely so a later reader does not read `T = 20/21` as a suite that skipped e2e.
- **`T-struct`** is the required level: a T-check is MET when the property the AC asserts is verified by a reproducible structural or arithmetic oracle — and it is MET here only where **I reproduced that oracle myself in this session**, not where a pipeline artifact merely claimed it.

This is the spec's own stated verification contract (*Non-functional requirements → Test strategy*), not an accommodation invented by the evaluator.

### `_ac-baseline.md`

None exists, and none was created — the invoking brief restricts directory creation to `plans/eval/`. The frozen checklist is embedded verbatim in §1 and §4 below and **is** the baseline for any re-run of this spec.

---

## 1. FRAMEWORK — respect: per-AC implementation checklist

**Unit of scoring.** The spec's `## Functional requirements` FR-1 … FR-20 are the acceptance criteria, grouped into seven stories by the spec's own subsection headings.

**Priority: `ASSUMED` (see Assumptions).** The spec carries no P0/P1/P2 labels. All seven stories are weighted **P0 (w=3) uniformly** — the least-inferential choice, and one under which the weighting is a mathematical no-op, so no inferred priority can silently move the band.

### ST-A — The one rule (P0 ASSUMED)

| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| FR-1 | Rule stated in *The makespan model*, generic over slice set `P` with declared `i(P)` | **MET** | `references/config.md:225`–`:227` (fenced `span(P) = max over the non-integration members m of P of span(m) + tasks(i(P))`) |
| FR-1 | Both base cases stated: leaf `span = tasks`; `integration: none` ⇒ `tasks(none) = 0` | **MET** | `references/config.md:229` |
| FR-1 | Rule appears **before** every quantity that references it | **MET** | rule `:225`–`:236`; first dependent bullet (`tasks(X)`) at `:238`, `span(L)` at `:239` |
| FR-2 | `span(L)` **split** = rule over that lane's sub-lane set with `i(L)` | **MET** | `:239` |
| FR-2 | `span(L)` **unsplit** = the leaf base case | **MET** | `:239` ("there is no slice set: `L` is a leaf, so the base case applies") |
| FR-2 | `span_max` = rule over the run's lane set with `i(run)` | **MET** | `:246` |
| FR-2 | viable-flat `span_base` = rule over the lane set with every lane unsplit | **MET** | baseline table viable row, `:260` |
| FR-3 | `M_flat`'s span term references `span_base` **by name**, no re-expansion | **MET** | `:250` ("the flat **`span_base`**, named and defined in *The baseline* immediately below … referenced by name here and nowhere re-expanded") |
| FR-3 | Baseline table **viable** row is a rule application, not a re-written `max` | **MET** | `:260` |
| FR-3 | Baseline table **non-viable** row still `T`, with the sum-vs-rule distinction explicit | **MET** | `:261` ("`T`, the total task count … — **a sum, not the span rule**") |
| FR-4 | `T` explicitly outside the rule | **MET** | `:252` ("**`T` is a sum, not an application of the span rule**"); restated `:262` |
| FR-4 | `M_seq` outside the rule for the ADR-0016 §2 reason (one task at a time) | **MET** | `:252`, `:262` — both carry the `(ADR-0016 §2.)` citation |
| FR-5 | Never-a-sub-split-candidate claim survives as an **independent** statement | **MET** | `:248` (blockquote, unamended in substance) |
| FR-5 | Depth cap stated explicitly; generality is not readable as a capability claim | **MET** | `:236` ("**The generality of `P` is a statement economy, not a capability claim**… the run has **exactly two** depths"); pointer target *Nesting is capped at depth 2* resolves to `:45` |

**ST-A: 14/14 MET.**

### ST-B — The cancellation identity (P0 ASSUMED)

| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| FR-6 | Fenced `span_base = M + X   span_max = S + X   g = …` block is **gone** | **MET** | absent from `references/config.md` (searched: literal `span_base = M + X`, `= S + X`, `(M + X) −` — 0 hits); base carried it at `:250` |
| FR-6 | Replaced by a statement naming the by-construction cancellation | **MET** | `:264` ("the same function applied to two slice sets that declare the identical `i(run)` … cancels **by construction**") |
| FR-6 | `g = M − S` retained and **named** "the cancellation identity" | **MET** | `:264` |
| FR-7 | Sequential case `g = T − (S + X)` survives | **MET** | `:266` |
| FR-7 | Its reason survives (`span_base` is `T`, a sum already counting integration as ordinary work) | **MET** | `:266` |
| FR-7 | The `min(S, X)` difference-from-uncorrected-reading statement survives | **MET** — see note | `docs/adr/0016:141`, `:144`, `:183` (byte-identical, file diff is +11/−0 append-only); listed under *What stands* at `docs/adr/0017:142`–`:146` |
| FR-8 | `M_flat − M_nested = g − c` still stated as holding on both baselines | **MET** | `:268` |
| FR-8 | "A passing reconciliation is not evidence the model is right" retained | **MET** | `:268` — verbatim, **newly added** by this change (base carried it only in ADR-0016) |
| FR-8 | Old-model comparison referenced to ADR-0016, not re-inlined | **MET** | `:268` ("recorded there, not re-inlined here") |

> **Note on FR-7 / `min(S, X)`.** The spec's wording ("This half must survive the compression intact, **including** the statement that the difference … is `min(S, X)`") presupposes that statement was in `references/config.md`. **It was not.** Searched the base file (`git show d297e6c:…/config.md`) for `min(S` — **0 hits**; it lived only in ADR-0016. The half that *was* there survived byte-for-substance, and ADR-0017 explicitly declines to add a new `min(S, X)` claim ("adding one would be new normative content rather than a compression", `0017:145`–`:146`). Scored **MET**: this is a **criteria defect in the spec**, not an implementation miss, and the framework detected it, recorded the correction (`FEAT-…e883` Technical Notes), and preserved the statement where it actually lives.

**ST-B: 9/9 MET.**

### ST-C — The exclusion prose (P0 ASSUMED)

| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| FR-9 | Canonical site carries the **single generic** statement over "whatever slice set they are evaluated over" | **MET** | `references/config.md:74` |
| FR-9 | Canonical site carries **both** surviving worked counter-examples | **MET** | `:74` — `{backend: 20, integration: 4}` and `{a: 3, b: 3, integration: 18}` |
| FR-9 | Scope limit incl. the `70%` denominator stated at the canonical site | **MET** | `:74` ("counts in **full** in `span_base`, `span_max`, `M_flat`, and `T` — including as the `70%` denominator") |
| FR-9 | `integration: none` reassurance stated **once**, at the canonical site | **MET** | `:74`; searched — the reassurance appears nowhere else in the two pointer blockquotes |
| FR-9 | *Per-sub-lane re-application* keeps a one-line pointer **naming what is excluded there**; counter-examples removed | **MET** | `:495` — names "the split's declared `integration` slice"; the `{work: 20, integration: 4}` / `{a: 3, b: 3, integration: 18}` pair is gone (numeral-sequence deletion confirmed) |
| FR-9 | *Leaf-level re-application* keeps a one-line pointer naming "the run's top-level integration lane"; counter-examples removed | **MET** | `:511`; `{backend: 20, integration: 4}` deleted from that site |
| FR-10 | ADR-0016 §3's mandate restated as a **one-clause consequence** | **MET** | `:511` ("…lands on it here exactly as it does at 2p.3, **and cannot land at one site and not the other**"); the generic form at `:74` states the same in the positive ("it **cannot** apply at one evaluation site and not another") |
| FR-10 | The failure the mandate guarded against is retained at the canonical site | **MET** | `:74` ("passing it at the very check it was deferred *because of*") |

**ST-C: 8/8 MET.**

### ST-D — Structural constraints on the edit (P0 ASSUMED)

| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| FR-11 | **No heading renamed, removed, added, or re-levelled** | **MET** | 31 headings in `config.md`, **list equality base == head**; 69 in `SKILL.md`, equal. Computed in-process, not via `diff`. |
| FR-11 | Every named cross-reference target still resolves | **MET** | Extracted all 22 `→ *Title*` refs across `SKILL.md`, `references/config.md`, `templates/architect.md`. 16 resolve only as prefixes/abbreviations of longer headings or as bolded lead-ins (`The baseline`, `Owned-glob rejection`, `Containment`, …) — **all pre-existing and unchanged**, and since the heading lists are byte-equal, no target's resolvability could have moved. The two **new** refs added by this change resolve: *Nesting is capped at depth 2* → `config.md:45`; *Marginal-gain rule* → `config.md:300` (heading). |
| FR-12 | `SKILL.md` changed **only** where it restates a formula normatively | **UNMET** | The `SKILL.md` diff is 3 lines: `:534` (a template restatement — in scope), `:544` (slot-guard prose), `:546` (an added clause). `:544`/`:546` are **guard/explanatory prose, not normative formula restatements**; they exceed FR-12's permission. Searched the full `SKILL.md` diff — no other hunk. |
| FR-12 | Flat block `Estimated speedup: {T} / span_base(max(concurrent {n},…) + integration({n}) = {span_base}) = {S}×` byte-identical | **MET** | exact-string count base 1 → head 1 |
| FR-12 | `Integration lane:` template line byte-identical | **MET** | flat-block fence untouched (no diff hunk in `:500`–`:510`); the head's third `Integration lane:` occurrence is inside new prose at `:544`, not a template line |
| FR-12 | Nested block `span({lane}) = max(concurrent {n},…) + integration({n}) = {span_L}` byte-identical | **MET** | line untouched — the `@@ -531,7 +531,7 @@` hunk changes exactly one line |
| FR-12 | Nested block `span_max = max(second-largest span {n}, span({lane}) {span_L}) = {span_max}` byte-identical | **UNMET** | base count **1** → head count **0**; head carries `… {span_L}) **+ integration({n})** = {span_max}` (count 0 → 1). **The frozen string changed.** |

**ST-D: 5/7 MET.** See §6 for the full adjudication — the deviation is **justified and documented**, but FR-12 is a frozen constraint and this eval scores the constraint as written.

### ST-E — ADR-0017 (P0 ASSUMED)

| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| FR-13 | `docs/adr/0017-one-span-rule-over-any-slice-set.md` exists, next free number | **MET** | file present, 218 lines; `0016` was the highest prior ADR |
| FR-13 | `Status: Accepted` + date + `Skills affected` + `Source finding` (`arch-2` + spec ID) + `Lineage` after 0012→0014→0016 | **MET** | `0017:3`–`:7` — all five present, `Lineage` names all three predecessors in order |
| FR-13 | States **what it supersedes**: the `M + X` / `S + X` derivation block **and** §3's both-sites assertion | **MET** | `0017:115`–`:128` |
| FR-13 | States **what it leaves standing**: every figure, §1/§2/§4/§5/§6/§7, three-branch comparison, `min(S, X)`, 0012/0013/0014 unamended with **0013 explicitly** | **MET** | `0017:130`–`:158` — every named item present, `0013` explicit at `:147`–`:149` |
| FR-13 | Records all five Consequences (no figure moves; reconciliation unchanged; depth cap explicit; one-site edit; three-depths-of-one-defect) | **MET** | `0017:172`–`:209` |
| FR-13 | Records the deliberate divergences (rule subsumes neither the never-a-candidate claim nor the depth cap) | **MET** | `0017:160`–`:170` |
| FR-14 | ADR-0016 carries a forward pointer **naming** ADR-0017 | **MET** | `docs/adr/0016:188`–`:198` |
| FR-14 | States only the derivation framing is superseded, every decision and figure stands | **MET** | `0016:196`–`:198` ("**Every decision and every figure in this ADR stands**") |
| FR-14 | `Status:` still `Accepted`; **no** ADR-0016 conclusion deleted or rewritten | **MET** | diff is **+11 / −0** — append-only by construction; `:198` restates "This ADR's `Status:` is unchanged: **Accepted**" |

**ST-E: 9/9 MET.**

### ST-F — Regeneration (P0 ASSUMED)

| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| FR-15 | `node scripts/build-prime-agent.mjs --check` exits **0** | **MET** | executed this session: `prime-agent/skills is up to date (11 skills, 154 files)`, `BUILD_CHECK_EXIT=0` |
| FR-15 | `prime-agent/skills/**` not hand-edited (mirror == regeneration) | **MET** | `--check` is exactly this assertion; corroborated by `cd prime-agent && npm test` → `parity ok: prime-agent/skills is generated, in sync, and guarded` |
| FR-16 | `':(exclude).claude'` = 3 in `SKILL.md` | **MET** | base 3 → head 3 |
| FR-16 | `the call shape from *How to spawn a subagent*` = 3 in `SKILL.md` | **MET** | base 3 → head 3 |
| FR-16 | `through a **single sequential coder invocation**` = 2 in `SKILL.md`; unbolded quote = 1 in `config.md` (quote fidelity) | **MET** | base 2 → head 2; base 1 → head 1 |
| FR-16 | `references/config.md` carries **exactly one** overlay anchor (the ADR-0001 link) | **MET** | parsed all 24 `find` strings from `prime-agent/overlays/orchestrator.json`; exactly one matches `config.md` (count 1 → 1); **all 24 declared counts hold base→head** |

**ST-F: 6/6 MET.**

### ST-G — Verification of the reframe (P0 ASSUMED)

Every I-check here was **re-executed by the evaluator**, not inherited. Full re-derivations in §3.

| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| FR-17 | Example 1 (`:340`) re-derived from the new rule; every figure matches | **MET** | §3.1 |
| FR-17 | Example 2 (`:356`) re-derived | **MET** | §3.2 |
| FR-17 | Example 3 (`:376`) re-derived | **MET** | §3.3 |
| FR-17 | Example 4 (`:396`, `k = 2`) re-derived | **MET** | §3.4 |
| FR-17 | Example 5 (`:433`, top-level integration) re-derived | **MET** | §3.5 |
| FR-18 | **No numeral changed** across the five worked-example subsections | **MET** | 448 → 448, **ordered sequence identical**; 4 of 5 example bodies **byte-identical** (md5 per subsection); the 5th differs only in the FR-19-mandated prose clause |
| FR-19 | `X = 0` at both levels exercised (examples 1, 2) | **MET** | `:342`, `:358` — both declare `integration: none` at lane and split level |
| FR-19 | Non-zero **sub-lane** integration slice (example 3) | **MET** | `:378` — `tasks(integration) = 6` |
| FR-19 | `k = 2` with a recomputed critical lane (example 4) | **MET** | `:412` — "recompute, and the critical lane is now `B`" |
| FR-19 | Non-zero **top-level** `tasks(integration)` with the cancellation identity shown (example 5) | **MET** | `:437` (`X = 4`), `:453` |
| FR-19 | The `:453` cancellation sentence rewords to the new statement, arithmetic identical | **MET** | now reads "Via the cancellation identity (*The makespan model*, above), `g` = `M − S` = `20 − 12` = **8** … `X` is common to both slice sets and cancels by construction"; numerals `20`, `12`, `8` unchanged |
| FR-20 | `clean-code-gates` **225 passing** | **MET** | executed: `# pass 225 / # fail 0` |
| FR-20 | `--check` exit 0 | **MET** | executed (above) |
| FR-20 | `cd prime-agent && npm test` green | **MET** | executed: `install ok`, `parity ok` |

**ST-G: 14/14 MET.**

---

## 2. FRAMEWORK — extract: Elicitation `E`

`E` grades the **derived plans** (`FEAT-…e883`, `FIX-…3cd7`, `FIX-…438c`) against the spec. It is reported beside `Final` and folded into nothing.

### 2.1 `E_recall` — category rubric

The ten standard rubric categories are **all N/A** here: the change touches no input, no endpoint, no persistence, no third party, no lifecycle, no runtime at all. A rubric of all-N/A yields an undefined recall, so a **domain extension for normative-prose / doc-skill changes** is frozen below and is the rubric any re-run of this spec uses.

| # | Category (doc-skill domain) | Expected when… | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| D1 | Internal consistency of normative text with its own worked examples | the doc states arithmetic and prints figures | **Addressed** | `FEAT-…e883` AC-20, AC-21, AC-22 |
| D2 | Generated-mirror regeneration & sync | a generated distribution mirrors the source | **Addressed** | AC-24 |
| D3 | Build-anchor / occurrence-count fragility | the build hard-fails on string-occurrence drift | **Addressed** | AC-23 (and the D10 correction that one "anchor" is quote-fidelity, not a build hard-fail — a genuine extraction, verified true) |
| D4 | Cross-reference integrity after a structural edit | pointers resolve by section title | **Addressed** | AC-13 |
| D5 | Decision-record lineage & supersession hygiene | the change supersedes a prior ADR | **Addressed** | AC-16 … AC-19 |
| D6 | **Downstream truth-decay in unamended dependent records** | the change falsifies statements in records it may not amend | **Missed** | No plan AC, no task, and no verification step covers it. `docs/adr/0014:87` ("The printed nested block already **reserves two slots**") is falsified by this change set — the block now has **three**. Surfaced only at the end, by QA, as note QA-N1, and never converted into a check. |
| D7 | Self-invalidating constructions in normative prose (counts, closed censuses) | the change's whole purpose is maintainability | **Addressed** | `FIX-…438c` Technical Notes name the class explicitly; AC-7 removed a count from `ADR-0017:5` (though one was reintroduced elsewhere — that is an `E_precision` fault, not a recall fault) |
| D8 | **Escalation path when a spec-frozen string is discovered to be wrong** | the spec freezes text that later proves defective | **Missed** | `FEAT-…e883` AC-14 inherited FR-12's freeze verbatim, including the nested `span_max` line that was arithmetically wrong. No planned route existed; the conflict was resolved **reactively** by `CR-…fc4f` MF-3 after the fact, costing a rework cycle. |

```
E_recall = Addressed / (Addressed + Missed) = 6 / 8 = 0.75
```

### 2.2 `E_precision` — added-requirement ledger

Every requirement in the derived plans **not traceable to a spec line**:

| # | Addition | Verdict | Warrant | Built? |
| --- | --- | --- | --- | --- |
| EA-1 | Correct the nested print block's `span_max` line to carry `+ integration({n})` | **Valid-necessary** | The line was arithmetically **wrong**: it printed a quantity labelled `span_max` while omitting `+ tasks(i(run))`, contradicting `config.md`'s own `span_max` definition and worked example 5's printed **16**. Cannot coexist with FR-1/FR-2's claim that every span quantity derives from the rule. | built (`SKILL.md:534`) |
| EA-2 | Correct the *Marginal-gain rule* post-adoption fence to `max(second_largest_span, span(L after the split)) + tasks(i(run))` | **Valid-necessary** | Same defect one document over — the **base** fence contradicted the base's own `span_max` bullet and example 5. Verified: example 5's post-adoption `span_max = 16` only follows from the corrected fence; the base fence yields 12. | built (`config.md:309`) |
| EA-3 | Define `second_largest_span` at `config.md:312` | **Valid-defensive** | The fence consumed an undefined term; the definition also excludes `i(run)` from the ranking, blocking a double-charge. Added outside the fence, adding no numeral. | built |
| EA-4 | Replace the closed span-shape census with an **open universal classification** | **Valid-necessary** | The closed enumeration shipped **false** — it omitted the `span_max` fence the same change created. `CR-…9e42` MF-1. | built (`config.md:234`) |
| EA-5 | Three-slot guard rewrite naming each slot's own declared source | **Valid-defensive** | EA-1 creates two **adjacent** lines printing the character-identical token `+ integration({n})` from **different** declaration levels; the guard names the copy hazard. `CR-…9e42` MF-2. | built (`SKILL.md:544`) |
| EA-6 | Attribute Step 2p.2's print blocks — **plural** — to ADR-0016 §5 | **Invalid** | **False in the shipped tree.** ADR-0016 §5's heading is *"Step 2p.2's **flat** print block divides by `span_base`"* and its body reaches no further. ADR-0017 `:152`–`:158` says so explicitly — so `config.md:208`/`:234` **contradict the ADR this same change authored**, in the document that outranks it for an editor working in the skill. Traced to plan AC-1(d), which instructed the plural attribution. | built |
| EA-7 | Reintroduce a count — "its **two** Step 2p.2 print blocks" — at `config.md:208` | **Invalid** | True today (verified: 2p.2 spans `SKILL.md:496`–`:568` with exactly two print-block fences), but it is the **same self-invalidating shape** AC-7 removed from `ADR-0017:5` in the same cycle. Net-zero on the defect class the change exists to retire. | built |
| EA-8 | Re-verify unamended dependent ADRs for continued **truth**, not only byte-identity | **Valid-necessary** | ADR-0012/13/14 were confirmed unamended by md5 — but md5 proves nothing about whether their *claims* survived. QA found `0014:87` falsified. | **deferred, not built** |

```
E_precision = (Valid-necessary + Valid-defensive) / total = 6 / 8 = 0.75
E_justified = additions carrying explicit rationale / traceability = 8 / 8 = 1.00
```

Every addition — including both invalid ones — cites a CR ID, a QA note, or a plan AC. The framework's *documentation* discipline is flawless; its *adjudication* is what lets EA-6 and EA-7 through.

**`valid E-additions` set (frozen for §4):** EA-1, EA-2, EA-3, EA-4, EA-5 (built) and EA-8 (deferred).

---

## 3. Verification of the central claim — the evaluator's own re-derivation

The spec turns on one claim: **a reframing, not a repricing; no figure moved.** Both halves are re-established here from scratch. Prior roles' green does **not** carry into this eval.

### 3.0 Mechanical no-numeral-drift (FR-18)

| Measure | base `d297e6c` | working tree | Verdict |
| --- | --- | --- | --- |
| Region line count | 123 | 123 | equal |
| Numeral count (pinned convention) | **448** | **448** | equal |
| Numeral **ordered sequence** | — | — | **identical** |
| Region md5 | `d42825292888560e3e20d7f142f13806` | `b65ab7cb479544f5a3c5701c4a016575` | differs (one prose clause) |
| Example-1 body | — | — | **byte-identical** |
| Example-2 body | — | — | **byte-identical** |
| Example-3 body | — | — | **byte-identical** |
| Example-4 body | — | — | **byte-identical** |
| Example-5 body | — | — | differs; **numerals identical** |

**Whole-file numeral audit** (beyond the examples, to catch a moved figure anywhere): `config.md` 790 → 806 numerals, `SKILL.md` 851 → 852. Every delta was traced to source. Additions are ADR citations (`0016`, `0017`), section tokens (`§5`, `2p.2`), and the `70%` denominator phrase. The only **deletions** are `20 4 2 83 3 3 18 75` and `20 4` — precisely the duplicated worked counter-examples that FR-9 mandates removing from the two pointer sites. **No printed figure was added, removed, or altered anywhere in either file.**

### 3.1 Example 1 — the gate verdict and the ladder figure must agree

Lanes `{12, 6}`, lane-level `integration: none`, candidate splits 12 → `{6, 6}` with `integration: none`, `k = 1`, `A = J = 2`, 0 interface points.

- `span_base` = rule over the lane set, all unsplit = `max(12, 6) + tasks(none)` = `12 + 0` = **12** ✓
- `span(L)` = rule over the sub-lane set = `max(6, 6) + 0` = **6**; `span_max` = `max(6, 6) + 0` = **6** ✓
- overhead flat `A + J` = **4** ✓; nested `A + A + J + J` = **8** ✓
- `M_flat` = `12 + 4` = **16** ✓ · `M_nested` = `6 + 8` = **14** ✓ · `g` = **6** ✓ · `c` = **4** ✓ · adopted ✓

### 3.2 Example 2 — one lane carries all the work (sequential baseline)

`tasks(mobile) = 24`, all other lanes `0`, lane-level `none`; split `{8, 8, 8}` with `none`; parent 0 IP, sub-contract 2 IP.

- Flat verdict non-viable ⇒ `span_base = T` = **24**, and `T` is a **sum**, outside the rule ✓ (this is exactly the distinction FR-3/FR-4 make explicit)
- `span(mobile)` = `max(8, 8, 8) + 0` = 8; `span_max` = `max(8, 0, 0, 0, 0, 0) + 0` = **8** ✓
- overhead = `2 + 2 + 2 + 2 + I((0+2)×0.25 = 0.5)` = **8.5** ✓ · `M_nested` = **16.5** ✓ · `g` = `24 − 8` = **16** ✓ · `c` = **8.5** ✓
- Leaf re-check: 3 leaves, largest `8/24` = **33%** ✓
- Counterfactual `{20, 4}`: `span(mobile)` = `max(20, 4) + 0` = 20, `g` = **4**, `c` = 8.5 ⇒ **rejected** ✓

### 3.3 Example 3 — a split carrying an integration sub-lane

`tasks(mobile) = 24` = 5 concurrent sub-lanes (largest 5) **plus** a declared integration slice of 6; lane-level `none`; sub-contract 8 IP.

- `span(mobile)` = `max(non-integration) + tasks(i(L))` = `5 + 6` = **11** ✓ — the rule's serial remainder at the sub-lane level
- `span_max` = `max(11, 0…) + 0` = **11** ✓
- overhead = `2 + 2 + 2 + 2 + I(8 × 0.25 = 2)` = **10** ✓ · `M_nested` = **21** ✓ · `g` = `24 − 11` = **13** ✓ · margin **3** ✓ · improvement `(24−21)/24` = **12.5%** ✓
- Pre-field counterfactual: `tasks(integration) = 0` ⇒ `span_max` **5**, `g` **19**, margin **9**, wrong by **6** ✓
- Aggregate payback `8 ≤ T = 24` ✓

### 3.4 Example 4 — `k = 2`, the case the overlap exists for

`{A: 24, B: 10, C: 4}`, lane-level `none`, `T` = **38**; largest `24/38` = 63.16 → **63%** ≤ 70 ⇒ **viable** ✓

- `span_base` = `max(24, 10, 4) + 0` = **24**; flat overhead `A + J + I(0)` = **4**; `M_flat` = **28** ✓
- Adoption 1: `span(A)` = `max(8,8,8) + 0` = 8 ⇒ `span_max` = `max(8, 10, 4) + 0` = **10** ✓; `g₁` = **14** ✓; `c₁` = `2 + 2 + 0.5` = **4.5** ✓; accumulated overhead **8.5** ✓; `M_nested` = **18.5** ✓
- Adoption 2: `span(B)` = `max(5,5) + 0` = 5 ⇒ `span_max` = `max(8, 5, 4) + 0` = **8** ✓; `g₂` = **2** ✓; `c₂` = **0.5** ✓; overhead **9** ✓; `M_nested` = **17** ✓
- Reconciliations: cost `9 − 4` = 5 = `4.5 + 0.5` ✓; gain `24 → 8` = 16 = `14 + 2` ✓
- Gates: leaves `{8,8,8,5,5,4}` sum **38** ✓; `8/38` = 21.05 → **21%** ✓; IP `4 ≤ 38` ✓; 6 leaves ≤ **6** ✓
- Superseded-serialized counterfactual: `8 + 2 + 2 + 4 + 2 + 1` = **19** ✓

### 3.5 Example 5 — a declared top-level integration lane (the ADR-0016/0017 pin)

`{backend: 20, frontend: 12, admin: 6}` + `wiring` with `tasks(integration) = 4`; `T` = **42**; `X = 4`.

- Work-concentration (integration excluded): 3 lanes carry work; `20/42` = 47.6 → **48%** ⇒ **viable** ✓
- `span_base` = **rule over the lane set, every lane unsplit** = `max(20, 12, 6) + 4` = **24** ✓
- flat overhead `A + J + I(4 × 0.25 = 1.0)` = **5**; `M_flat` = **29** ✓
- Adoption: `span(backend)` = `max(8, 8) + 0` = 8 ⇒ `span_max` = **rule over the post-adoption lane set** = `max(8, 12, 6) + 4` = **16** ✓
- nested overhead = `2 + 2 + 2 + 2 + I((4+2) × 0.25 = 1.5)` = **9.5**; `M_nested` = **25.5** ✓
- `g` = `24 − 16` = **8** ✓ — and via the **cancellation identity**: `M` = 20, `S` = 12, `X` = 4 common to both slice sets ⇒ `g = M − S` = `20 − 12` = **8** ✓ (identical, by construction)
- `c` = `2 + 2 + 0.5` = **4.5** ✓ · reconciliation `29 − 25.5` = **3.5** = `8 − 4.5` ✓
- `frontend` `{11, 1}`: `11/12` = 91.7 → **92%** ⇒ rejected ✓ · `admin`: `max(8, 12, span(admin)) + 4` = 16 ⇒ `g = 0` ⇒ not adopted ✓ · `wiring` never a candidate ✓
- Gates: IP `4 + 2 = 6 ≤ 42` ✓; 4 leaves, largest `12/42` = 28.6 → **29%** ✓; `4 ≤ 6` ✓
- Uncorrected-model counterfactual: `span_base` = `max(20, 4)` = 20, `span_max` = `max(12, 4)` = 12, `g` = **8** either way, `M_flat` **25**, `M_nested` **21.5**, `25 − 21.5` = **3.5** ✓

**Result: 5/5 examples re-derive exactly from the rewritten rule. Zero disagreements. `span_base` and `span_max` are visibly the same function over two slice sets in every one of them — the property FR-2 asserts, verified rather than assumed.**

> **Load-bearing corroboration for EA-1/EA-2.** Example 5's post-adoption `span_max` is **16**, which requires `+ tasks(i(run)) = +4`. The **base** *Marginal-gain rule* fence and the **base** nested print block both omitted that term and would print **12**, yielding `g = 24 − 12 = 12` against the true 8. **The base tree was internally inconsistent**, and the two corrections the spec did not sanction are what make the base's own worked example derivable from the base's own definitions. This is why the FR-12 deviation is scored as a *frozen-constraint* miss (§6) and not as a repricing: the printed figures never moved because the corrected sites had **no** printed figures — they are templates and fences.

---

## 4. HARNESS — test checklist over the sanctioned set

**Sanctioned set = PRD ACs (FR-1 … FR-20) ∪ valid E-additions (EA-1 … EA-5, EA-8).**

**Required level: `T-struct` only.** `T-unit` and `T-e2e` are **`n/a — structurally impossible`** and excluded from the denominator, per the policy pinned in §0. Recording this explicitly: **the absence of a behavioural test here is not a harness gap, and is not scored as one.** No path executes the span rule; a behavioural test would exercise a scaffold invented for the test.

| AC / EA | `T-struct` check | Verdict | Oracle (re-executed by the evaluator unless noted) |
| --- | --- | --- | --- |
| FR-1 … FR-5 | The rule and each derivation are present, ordered, and singular | **MET** | in-process content assertions on `config.md`; `span_base`/`span_max` shown to be one function over two slice sets in all five re-derivations (§3) |
| FR-6 … FR-8 | Fence gone; identity + sequential half + reconciliation caveat present | **MET** | 0-hit searches for the deleted fence tokens; content assertions at `:264`–`:268` |
| FR-9, FR-10 | Canonical statement singular; two pointers name their own effect; counter-examples deleted | **MET** | content assertions at `:74`/`:495`/`:511`; deletion confirmed by the whole-file numeral audit (`20 4 2 83 3 3 18 75`) |
| FR-11 | Heading sets equal; cross-references resolve | **MET** | 31/31 and 69/69 heading list equality; 22-ref resolution inventory |
| FR-12 | Frozen template strings byte-identical | **MET** | exact-string counts executed **and the violation correctly detected** — the harness works; the implementation is what deviates. Independently corroborated by `TEST-…5d31`, which reported the nested-block change rather than concealing it. |
| FR-13 | ADR-0017 carries every mandated element | **MET** | full read of all 218 lines |
| FR-13 | **Unamended dependent ADRs re-verified for continued truth** (EA-8) | **UNMET** | Searched: no plan task, no `TEST-…` verification step, and no QA gate performs this. `docs/adr/0014:87` states the nested block "reserves **two** slots" — falsified by EA-1/EA-5, which make it **three**. Caught once, by hand, as `QA-N1`; no repeatable oracle exists. md5-identity was verified and **mistaken for truth-preservation**. |
| FR-14 | ADR-0016 append-only, status intact | **MET** | diff `+11/−0` |
| FR-15, FR-16 | `--check` exit 0; all 24 overlay anchor counts hold | **MET** | both executed this session |
| FR-17, FR-18, FR-19 | Hand re-derivation **and** mechanical no-drift, independently | **MET** | §3 — both executed in full, independently of the pipeline's own runs |
| FR-20 | Three no-regression floors green | **MET** | all three executed this session |
| EA-1, EA-2 | The corrected `span_max` shape is the one the worked examples require | **MET** | §3.5 derives 16 from it and shows 12 from its absence |
| EA-3 | `second_largest_span` resolves and excludes `i(run)` | **MET** | `config.md:312`, read end-to-end |
| EA-4 | The open classification holds over the post-edit tree | **MET** | `TEST-…5d31` §1 census (zero second normative definitions) + my own whole-file numeral and structural audit; banned closed-census constructions = 0 |
| EA-5 | Filling the three slots from the guard's text alone yields example 5's figures | **MET** | reproduced: `:533` → `max(8,8)+integration(0)=8`; `:534` → `max(12,8)+integration(4)=16`; `g = 24−16 = 8` ✓. The mis-fill (`g = 24−12 = 12`) is unreachable from the guard's wording. |

```
T = 20 MET / 21 T-checks
```

### 4.1 Robustness `R` — verification beyond the sanctioned set

| Extra verification | Weight |
| --- | --- |
| Post-edit, post-regeneration classified census of every site writing the shape | High 1.0 |
| Prescriptive-vs-descriptive attack on the open claim (does it survive a *future* added site?) | High 1.0 |
| Hand-filling the three-slot guard on worked example 5 from the guard's text alone | High 1.0 |
| `HEAD`-anchored numeral superset spanning all three cycles, not just the last | Med 0.5 |
| Banned closed-census construction greps (7 forbidden phrasings, all 0) | Med 0.5 |
| Byte-identity corroborated against **pre-cycle** artifacts rather than the coder's own snapshot | Med 0.5 |
| Ad-hoc ADR truth spot-check (the one that produced QA-N1) | Med 0.5 |
| **`R`** | **5.0** |

`R` is high and genuinely earned — but note the shape: **the two invalid additions (EA-6, EA-7) were both found by this robustness work and then shipped anyway.** `R` measures how hard the harness looked, not whether findings were acted on.

### 4.2 Test Distribution `D`

There are **zero executable feature tests**, so the standard tiering has no subjects. Reported instead over the **21 `T-struct` verification acts + 7 `R` extras = 28 verification acts**, tiered by the same definitions:

| Tier | Definition applied here | Count | % |
| --- | --- | --- | --- |
| **Necessary** | Asserts a primary property of a P0 AC (the rule, the derivations, no-numeral-drift, hand re-derivation, the gates) | 15 | 53.6% |
| **Secondary** | Maps to an AC but is not its primary path (anchor census, cross-reference inventory, ADR element audit, the EA-1…EA-5 checks) | 6 | 21.4% |
| **Nice-to-have** | Maps to no AC — the `R` inventory | 7 | 25.0% |
| **Total** | | **28** | **100%** |

**Shape read:** healthy and correctly weighted for a docs-only change — every P0 primary property carries a Necessary verification, and the Nice-to-have quarter is defensive census work rather than padding. The one structural weakness is not visible in the counts: **every act verifies the *edited* documents, and none verifies the documents the edit *invalidates*** (EA-8 / D6). `D` is descriptive and does not move `Final`.

---

## 5. Engineering Gates `G`

| Gate | Verdict | Command / probe evidence |
| --- | --- | --- |
| **build** | **✓** | Pinned command: `node scripts/build-prime-agent.mjs --check`. Executed → `prime-agent/skills is up to date (11 skills, 154 files)`, exit **0**. This is the repo's canonical build/verify command for the generated distribution and it hard-fails on overlay-anchor occurrence-count drift. |
| **lint** | **`not-run`** | Probed, per Probe-before-not-run. `ls package.json` → *No such file or directory* (no root package.json). `ls .eslintrc* eslint.config.* .markdownlint*` → *no matches found*. `which shellcheck markdownlint eslint` → all three *not found*. Repo root contains no lint configuration of any kind. **No lint tooling exists in this repo**; a `not-run` here is a property of the repository, not of the change. |
| **unit** | **✓** | `cd plugins/my-skills/skills/clean-code-gates && npm test` → `# tests 225 / # pass 225 / # fail 0`. Also `cd prime-agent && npm test` → `install ok`, `parity ok`. |
| **e2e** | **`n/a — structurally impossible`** | Probed: repo-wide search for `span_max` / `span_base` / `makespan` in `.js` / `.mjs` / `.ts` / `.sh` → **zero hits**; `.orchestrator/config.json` carries no `parallelism` key so the documented default `off` applies; `config.md` states Steps 2p/2c/2s/2L/3L/3s/3j are skipped entirely at that level. **No executable path exists that could reach the span rule, and none can be constructed without inventing the system under test.** Recorded as structurally impossible, **not** as an omission and **not** as a harness gap. |

**No gate is `✗`. `Adjusted Final` does not apply.**

**Documented non-graded note:** all three green suites cover **entirely unrelated surface** — no file under `plugins/my-skills/skills/clean-code-gates/**` or `prime-agent/tests/**` is in this change set. They are a **no-regression floor** proving nothing else broke; they are **not** evidence that this change is correct. The evidence for correctness is §3.

---

## 6. Scope Adherence `S` — traceability

| Check | Verdict | Detail |
| --- | --- | --- |
| **PRD-boundary** | **pass** | Every spec Non-goal holds and was verified mechanically: no figure moved (§3.0); digest contract untouched; ADR-0012/0013/0014 **empty diff**; ADR-0016 `Status: Accepted` with an **append-only** `+11/−0` diff; no behavioural test emitted; no heading renamed/added/removed/re-levelled (31/31, 69/69); `prime-agent/skills/**` regenerated, never hand-edited (`--check` + `parity ok`); no opencode work (`orchestrator` has no override port); `templates/architect.md` **empty diff**. |
| **Rogue build** | **pass** | Every built behavior traces to a spec FR or to a ledger addition (§2.2). Nothing is invented or untraceable — including EA-6 and EA-7, which trace to plan AC-1(d) and are *invalid*, not *rogue*. |
| **Plan drift** | **partial** | **`SKILL.md:534`.** Spec FR-12 and `FEAT-…e883` AC-14 both froze the nested block's `span_max` template string byte-for-byte; the code changed it. |

```
S = partial
```

### Adjudication of the FR-12 drift — read this before treating it as a defect

This is the single most consequential judgment in the eval, so the reasoning is exposed rather than asserted:

**Why it is scored as a miss.** FR-12 names the string explicitly and freezes it; the spec's own D7 reinforces the freeze ("freeze the 2p.2 print-block template strings **either way**"). The string changed. An acceptance criterion that says "must not change" and a diff that changes it is UNMET, and inventing an exception at scoring time would make the grade unreproducible. `Final` measures fidelity to *the given spec*.

**Why it is nonetheless the right engineering call.** The frozen string was **arithmetically wrong**. §3.5 shows the base tree's own worked example prints `span_max = 16`, which requires `+ tasks(i(run))`; the frozen template would render **12** and `g = 24 − 12 = 12` against the true **8**. Freezing it would have shipped a document whose print block contradicts the rule the same document defines — directly defeating FR-1 and FR-2. The framework detected this (`CR-…fc4f` MF-3), reasoned about the conflict correctly (ADR-0016 §5's byte-for-byte guarantee is scoped **by its own heading** to the *flat* block and does not reach the nested one — verified: `docs/adr/0016:86` reads *"Step 2p.2's flat print block divides by `span_base`"*), recorded the override in ADR-0017's *What stands* (`:152`–`:158`), and **left every other frozen string byte-identical** (3 of 4 held).

**Verdict.** `partial`, with the drift characterised as **justified and fully documented**. It is scored against `Final` because FR-12 says what it says; it is **not** a repricing (§3.0 proves no figure moved) and it is **not** a scope violation. The genuine framework failure here is `E_recall` D8 — no planned escalation path existed for a frozen-but-wrong constraint, so a correct decision cost a full rework cycle.

---

## 7. Ranked gap list

| # | Gap | Severity | Kind | Site |
| --- | --- | --- | --- | --- |
| **1** | **False citation:** `config.md:208` and `:234` attribute Step 2p.2's print blocks (**plural**) to ADR-0016 §5, which is scoped by its own heading to the **flat** block only — contradicting `ADR-0017:152`–`:158` in the document that outranks the ADR for a skill editor. The load-bearing direction: an editor reading `:208` concludes the nested block is protected by a byte-for-byte guarantee and declines to correct it — **exactly the reasoning that left the nested `span_max` line wrong for two cycles.** | High | `E_precision` (EA-6) — an *addition* defect, traced to plan AC-1(d). **Not** a spec-fidelity miss; no FR is UNMET because of it. | `config.md:208`, `:234` |
| **2** | **Truth-decay in an unamended dependent record:** `docs/adr/0014:87` says the nested block "reserves **two** slots"; it now has **three**. ADR-0014 was verified **md5-identical** but never re-verified for **truth** — and md5-identity was implicitly treated as truth-preservation. No repeatable check exists for this class. | High | **`T` (EA-8)** — the one UNMET T-check. The spec forbids amending ADR-0014, so the fix is a note in ADR-0017 or a scoped clarification, not an amendment. | `docs/adr/0014:87` |
| **3** | **FR-12 freeze violated:** the nested block's `span_max` template string changed. Justified, documented, and arithmetically necessary — but the AC says byte-identical. | Medium | **`I` (FR-12)** — 2 of 5 checks UNMET; the sole source of the 0.03 shortfall. | `SKILL.md:534` (+ consequential prose at `:544`, `:546`) |
| **4** | **Self-invalidating count reintroduced:** "its **two** Step 2p.2 print blocks" at `:208` — the same falsifiable shape AC-7 removed from `ADR-0017:5` in the same cycle. Net-zero on the defect class. | Low | `E_precision` (EA-7) | `config.md:208` |
| **5** | **No escalation path for a frozen-but-wrong constraint.** Plans inherited FR-12 verbatim; the conflict surfaced only in review, costing a rework cycle. Root cause of the aggregate G8 = 1.33. | Low (process) | `E_recall` D8 | `FEAT-…e883` AC-14 |
| **6** | **Census taxonomy widened silently:** `TEST-…5d31`'s census classifies ADR rows as "illustration/**record**" while the universal names only application / illustration / display. Cosmetic; the rows are defensibly displays. | Informational | none | test artifact only |

**Confirmation of the invoking brief's list.** The four known-open items were re-verified independently and are **exactly** the open set — no additional finding emerged. Gap 1 = the `:208`/`:234` false citation. Gap 4 = the reintroduced count. The "not a census" disclaimer is confirmed to protect only the example list's *completeness*, not the *correctness* of attributions attached to named sites — verified by reading `:234` end-to-end. Gap 2 = QA-N1, and I confirm ADR-0014's diff is empty while `:87`'s claim is now false. **None of the four is scored as an implementation miss**: three are `E_precision` / criteria-provenance faults and one is the sole `T` miss.

---

## 8. Concrete fixes to reach 1.00

Each is text-only and moves **no figure**.

1. **Close gap 1 (`config.md:208`).** Replace *"— its two Step 2p.2 print blocks — that is ADR-0016 §5's deliberate legibility decision"* with a scoped form: attribute the **flat** block's expanded shape to ADR-0016 §5, and record the **nested** block's expanded shape as the correction ADR-0017 made (`CR-…fc4f` MF-3), not as a §5 exemption. This simultaneously closes **gap 4** — use *"its Step 2p.2 print blocks"*, uncounted, mirroring `ADR-0017:5`'s own *"named rather than counted"* repair.
2. **Close gap 1 at `config.md:234`.** Add the scoping sentence ADR-0017 already carries (`:196`–`:198`): §5's heading scopes the display decision to the flat block; the nested block's expansion is ADR-0017's correction.
3. **Close gap 2 (EA-8) without amending ADR-0014.** Add one line to `ADR-0017`'s *Deliberate divergences* or *What stands*: "`ADR-0014 §5` describes the nested block as reserving **two** integration slots; this change makes it **three** (the `span_max` line's lane-level slot). ADR-0014 stands unamended per the spec's non-goal; this record supersedes that count." Then add the missing **oracle**: a verification step that, for every ADR listed as unamended, greps for counts and enumerations touching the change region and asserts them still true — turning a one-off QA hand-check into a repeatable gate.
4. **Close gap 3 (FR-12) — the only change that moves `Final` to 1.00.** Two routes, both legitimate:
   - *Preferred:* **amend the spec**, replacing FR-12's blanket freeze with "frozen **except** where a template string restates a superseded shape; any such correction must be recorded in the superseding ADR" — which is precisely what was done and documented. This retires the miss by fixing the criterion, and closes **gap 5** by writing the escalation path down.
   - *Alternative:* revert `SKILL.md:534`, `:544`, `:546` — **not recommended**: it reinstates a print block that contradicts its own document's arithmetic and would print `g = 12` where the truth is 8.
5. **Close gap 5 (process).** Add to the architect's template: any spec-frozen string that the implementation finds defective must raise an explicit deviation before the coder proceeds, rather than being resolved reactively in review.

---

## 9. Assumptions, bias controls, and reproducibility record

- **Priority is `ASSUMED`.** The spec carries no P0/P1/P2 labels. All seven stories weighted **P0 (w = 3) uniformly** — so the weighting is a mathematical no-op and no inferred priority can move the band. `Σw = 21`, derived inside the roll-up script from the same priority table shown here, never typed as a literal.
- **Judge ≠ author.** This evaluator authored none of the change set, none of the plans, and none of the CR/QA artifacts. No self-preference exposure.
- **Evaluator is read-only.** Not one byte of the subject was modified. Every command executed was a read, a search, a hash, or one of the three declared gates. No red gate arose; none would have been fixed.
- **Supporting artifacts were used as input and independently verified, never accepted.** The CR's approval, QA's `READY_WITH_WARNINGS`, and all three TEST reports were read; every load-bearing claim they make (no numeral drift, anchor counts, `--check`, 225 passing, the three-slot fill, the ADR-0016 §5 scoping, ADR-0014's staleness) was **re-executed or re-derived in this session**. Two of their claims were sharpened here: the worked-example region is **not** byte-identical (four of five subsections are; the fifth changed by one prose clause), and `TEST-…5d31`'s framing of "nested block byte-identity" is true only excluding the one corrected line.
- **Self-consistency (k = 3).** Three independent passes over the checklist. Agreement on 66 of 67 I-checks and 21 of 21 T-checks on the first pass. **One check flipped and is recorded as borderline:** *FR-7 / `min(S, X)`*. Pass 1 read the spec's "including" literally and marked UNMET; passes 2 and 3, after establishing by search that the statement was **never** in `config.md` and is preserved in ADR-0016 (unamended) and listed in ADR-0017's *What stands*, marked MET. **Majority: MET.** The disagreement is a symptom of an imprecise spec clause, not of an ambiguous check — sharpen FR-7 to say "*preserved wherever it lives*" on any respec. **FR-12's split verdict (3 MET / 2 UNMET) was stable across all three passes.**
- **Round once.** Full precision carried through; only `AC_score`, `Story_score`, and `Final` rounded to 2 decimals. Band assigned from the rounded `Final`.

---

## 10. Roll-up — script output (pasted verbatim)

```
[ST-A The one rule (FR-1..FR-5)]  priority=P0 w=3
FR-1    3/3=1.000 1/1=1.000  1.0
FR-2    4/4=1.000 1/1=1.000  1.0
FR-3    3/3=1.000 1/1=1.000  1.0
FR-4    2/2=1.000 1/1=1.000  1.0
FR-5    2/2=1.000 1/1=1.000  1.0
  Story_score = 1.0

[ST-B The cancellation identity (FR-6..FR-8)]  priority=P0 w=3
FR-6    3/3=1.000 1/1=1.000  1.0
FR-7    3/3=1.000 1/1=1.000  1.0
FR-8    3/3=1.000 1/1=1.000  1.0
  Story_score = 1.0

[ST-C The exclusion prose (FR-9,FR-10)]  priority=P0 w=3
FR-9    6/6=1.000 1/1=1.000  1.0
FR-10   2/2=1.000 1/1=1.000  1.0
  Story_score = 1.0

[ST-D Structural constraints (FR-11,FR-12)]  priority=P0 w=3
FR-11   2/2=1.000 1/1=1.000  1.0
FR-12   3/5=0.600 1/1=1.000  0.76
  Story_score = 0.88

[ST-E ADR-0017 (FR-13,FR-14)]  priority=P0 w=3
FR-13   6/6=1.000 1/2=0.500  0.8
FR-14   3/3=1.000 1/1=1.000  1.0
  Story_score = 0.9

[ST-F Regeneration (FR-15,FR-16)]  priority=P0 w=3
FR-15   2/2=1.000 1/1=1.000  1.0
FR-16   4/4=1.000 1/1=1.000  1.0
  Story_score = 1.0

[ST-G Verification of the reframe (FR-17..FR-20)]  priority=P0 w=3
FR-17   5/5=1.000 1/1=1.000  1.0
FR-18   1/1=1.000 1/1=1.000  1.0
FR-19   5/5=1.000 1/1=1.000  1.0
FR-20   3/3=1.000 1/1=1.000  1.0
  Story_score = 1.0

Sigma_w (derived) = 21.0
Final = 20.340000 / 21.0 = 0.97
Band = Spec-complete
Totals: I 65/67  T 20/21
Adjusted Final: n/a - no gate reported as confirmed-red
```

---

## 11. Verdict

**`Final` = 0.97 — Spec-complete.** `Adjusted Final` does not apply (no gate is `✗`).

**The spec's central claim holds, verified independently and from scratch: this is a reframing, not a repricing.** The concurrent-`max`-plus-serial-remainder shape is now stated **once**, at `references/config.md:227`, and `span(L)`, `span_max`, `M_flat`'s span term, and the viable-flat `span_base` are each derived from it by naming a slice set. All five worked examples re-derive **exactly** from the rewritten rule, all 448 numerals in the worked-example region are identical to base in ordered sequence, four of the five example bodies are byte-identical, and the whole-file numeral audit shows the only deletions anywhere are the duplicated counter-examples FR-9 mandates removing. **No printed figure moved.**

The 0.03 shortfall is one frozen template string that the implementation was **right** to change and the spec was **wrong** to freeze; it is scored because the criterion says what it says, and §8 gives the spec amendment that retires it honestly. The single harness gap is real and generalisable: the change verified the documents it edited and never verified the documents it invalidated.

**Two subjects, separately:**

- **Framework — respect & extract:** implementation fidelity is near-total (`I` = 65/67) and scope discipline is clean at the boundary (`S` PRD-boundary **pass**, rogue-build **pass**) with one justified, documented drift. Extraction is the weaker half: `E_recall` **0.75** and `E_precision` **0.75** — it surfaced and correctly adjudicated five real defects the spec never anticipated (two of them arithmetic errors *pre-existing in the base tree*), but it also shipped a false citation and a self-invalidating count, and it never looked at the records its own change falsified.
- **Harness — ensure they are all implemented:** strong for what is reachable (`T` = 20/21, `R` = 5.0, three gates green, two independent no-figure-moved oracles), with **e2e structurally impossible and correctly recorded as such rather than as an omission**. Its one blind spot is a class, not an instance: byte-identity was treated as truth-preservation for the dependent records the change was forbidden to amend.
