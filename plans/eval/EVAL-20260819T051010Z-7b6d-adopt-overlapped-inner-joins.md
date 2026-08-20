---
id: EVAL-20260819T051010Z-7b6d
plan: FEAT-20260819T035826Z-835a
status: PASS
created_at: 2026-08-19T05:10:10Z
updated_at: 2026-08-19T05:10:10Z
cycle: 0
---

# Evaluation — Adopt ADR-0013: overlap inner joins and reprice the inner-join level

**Feature**: orchestrator `full`-mode nested parallelism — per-lane inner-join barrier + inner-join level repriced `k × J` → `J`
**Source of truth**: `plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md` (FR-1 … FR-20 are the acceptance criteria)
**AC baseline**: none pre-existed; the checklist below is frozen from the spec's *Functional requirements* section verbatim (FR ids are the spec's own stable ids — not re-split, not merged). Persist-forward baseline for any re-run of this spec.
**Judge model**: claude-opus-5[1m] (author model: same family — flagged under *Assumptions*; borderline checks resolved UNMET)
**Module / paths**: `plugins/my-skills/skills/orchestrator/` (`SKILL.md`, `references/config.md`, `templates/coder.md`), `docs/adr/0012|0013|0014`, generated mirror `prime-agent/skills/orchestrator/**`

**Related:** [SPEC-20260819T034803Z-18d2](../specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md) · [FEAT-20260819T035826Z-835a](../feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md) · [FIX-20260819T043728Z-13ae](../code-review/FIX-20260819T043728Z-13ae-inner-join-run-site-prose.md) · [TEST-20260819T042313Z-1acb](../test/TEST-20260819T042313Z-1acb-adopt-overlapped-inner-joins.md) · [CR-20260819T045602Z-221d](../code-review/CR-20260819T045602Z-221d-inner-join-run-site-prose.md) · [QA-20260819T050419Z-cfd2](../qa/QA-20260819T050419Z-cfd2-inner-join-run-site-prose.md)

## Diff surface (Step 1 — the primary search scope for all evidence below)

`git diff 5403eeee0a7852044a2e42a83f44f06439872e3d` — 9 files, +334 / −85:

| File | Role |
| --- | --- |
| `plugins/my-skills/skills/orchestrator/SKILL.md` | +61/−16 — **implementation site** (barrier half + printed-cost half) |
| `plugins/my-skills/skills/orchestrator/references/config.md` | +67/−14 — **implementation site** (normative cost model) |
| `plugins/my-skills/skills/orchestrator/templates/coder.md` | +1/−1 — implementation site (deferral prose) |
| `docs/adr/0013-overlapped-inner-joins.md` | +101/−20 — decision record, `Proposed` → `Accepted` |
| `docs/adr/0012-…md`, `docs/adr/0014-…md` | +4/−1, +3/−2 — cross-references |
| `prime-agent/skills/orchestrator/{SKILL.md,references/config.md,templates/coder.md}` | **GENERATED** by `scripts/build-prime-agent.mjs` — not scored as separate work (per the evaluation brief and the repo's own generated-tree contract) |

### The nature of this change, stated before scoring (it governs every gate verdict below)

This is a **docs-only** change to three markdown skill files plus three ADRs. **There is no executable path.** `parallelism` resolves to `off` by default in this repo, and the changed behaviour — a `full` run with `k ≥ 2` sub-split lanes — is **not reachable here at all**. A behavioural or e2e test would have to fabricate the multi-lane subagent fan-out it claims to exercise and then assert against the fabrication. **The absence of such a test is therefore not scored as a harness gap**, and none was invented. This matches the posture the spec (*Verification — stated honestly*), the plan, the test report, and `PROJECT-CONTEXT.md` → *Test tooling* all independently take.

What replaces it as the harness is the **persisted, re-runnable grep-shaped structural assertion set** (proven red before the edits, per the FEAT plan Phase 1 → Phase 2 ordering) plus **recorded hand re-derivation** of all four worked examples. `T` below is scored against *that* harness — the question being "can this requirement silently regress with nothing catching it?", not "is there a unit test?".

---

## Acceptance criteria (frozen — the spec's FR-1 … FR-20)

**The barrier half** — FR-1 per-lane barrier replaces the global one · FR-2 justification paragraph rewritten, containment proof carried forward · FR-3 pipeline-overview prose corrected.
**The seven concurrency resolutions** — FR-4 deferred gates move to the outer join · FR-5 sole-writer note under overlap · FR-6 determinism re-established at the two observable surfaces · FR-7 `PARTIAL` recorded at 3s, taken at 3j · FR-8 Step 3j gains an inner-join-completion wait · FR-9 amendment loop entered at 3j · FR-10 `max_parallel_lanes` counts integration coders.
**The charge half** — FR-11 *The makespan model* · FR-12 *The cost side* · FR-13 Step 2p.2's `c` table and trailing rule · FR-14 Step 2L disambiguation.
**Worked examples** — FR-15 three existing re-derived (unchanged) · FR-16 new `k = 2` example · FR-17 greedy-termination argument corrected.
**ADR and distribution** — FR-18 ADR-0013 `Accepted` + resolutions · FR-19 ADR-0012/0014 cross-references · FR-20 Prime distribution regenerated, never hand-edited.

Priority: the spec carries no P0/P1/P2 labels. Treated as **one story at P0 (`ASSUMED`)** — see *Assumptions*. The spec's own *Non-functional requirements* → *Internal consistency* makes the barrier half and the charge half a single indivisible deliverable, which is the reading that justifies one story rather than several.

---

## Implementation checklist (binary — MET/UNMET, `file:line` evidence required for MET)

Paths are relative to the repo root. `SKILL.md` = `plugins/my-skills/skills/orchestrator/SKILL.md`; `config.md` = `plugins/my-skills/skills/orchestrator/references/config.md`.

| AC | I-check (atomic, observable) | Verdict | Evidence (`file:line`) |
| --- | --- | --- | --- |
| FR-1 | I1. The global-barrier sentence ("every in-flight leaf … across all lanes") is gone | MET | `grep -nF "across all lanes, not just this lane's" SKILL.md` → no match; replaced at `SKILL.md:964` |
| FR-1 | I2. The per-lane barrier is stated as this join's **only** barrier, retaining from-the-artifact verification, single retry, `PARTIAL` routing | MET | `SKILL.md:964`, `SKILL.md:966` ("The all-sub-lanes-DONE check — this join's only barrier") |
| FR-2 | I1. The paragraph now states the change **is** taken and names ADR-0013 | MET | `SKILL.md:970` ("ADR-0013 takes the change that paragraph deferred") |
| FR-2 | I2. The containment paragraph is preserved and made the operative justification | MET | `SKILL.md:968` (containment) → `SKILL.md:970` ("the containment proof above is the operative justification for taking it") |
| FR-3 | I1. The **3s** overview bullet gains the concurrency clause | MET | `SKILL.md:102` |
| FR-3 | I2. "The joins compose bottom-up" reads per-lane barrier → 3s overlapping leaves → all-leaves **and** all-inner-joins barrier → 3j | MET | `SKILL.md:105` |
| FR-3 | I3. The `simplify`/full-suite cadence sentence is unchanged | MET | `SKILL.md:105` (trailing clause intact, byte-identical in diff) |
| FR-4 | I1. Step 3s item 3 **collects and records** deferrals and runs none | MET | `SKILL.md:987` |
| FR-4 | I2. Step 3j item 4 is named the single de-duplicated run site, blocking on non-zero exit | MET | `SKILL.md:1063`; `SKILL.md:958` (lane preamble states the same) |
| FR-4 | I3. The justification is the **scope** argument; option B and the "only when nothing else in flight" option are both rejected, on unsoundness and determinism respectively | MET | `SKILL.md:989`, `SKILL.md:991` |
| FR-4 | I4. Consequence (a) — a `SUBJOIN` reconciliation no longer implies deferred gates passed; the narrower-scope trade is stated, not dropped | MET | `SKILL.md:993` |
| FR-4 | I5. Consequence (b) — 3j item 4's failure output names the deferring lane(s) | MET | `SKILL.md:1063` + the `JOIN — deferred gate failed` block with `Deferred by: lane(s) {qualified names}` |
| FR-5 | I1. 3s.1 carries an explicit under-overlap sole-writer sentence | MET | `SKILL.md:1022` ("overlapping inner joins add no second writer") |
| FR-6 | I1. Artifact write order-independence is stated, not inferred (one writer per sub-contract table; disjoint pre-existing cells in the parent table) | MET | `SKILL.md:972` |
| FR-6 | I2. `SUBJOIN` blocks emitted in lane-map row order, at a single point, once every inner join completes | MET | `SKILL.md:1006` |
| FR-6 | I3. Routing/amendment evaluation order pinned to lane-map row order | MET | `SKILL.md:1016`; 3j item 4's de-dup set also row-ordered at `SKILL.md:1063` |
| FR-6 | I4. The net claim is asserted — same artifacts, same printed `SUBJOIN` sequence | MET | `SKILL.md:1008` |
| FR-7 | I1. An inner join **records** `PARTIAL` routing without halting the run | MET | `SKILL.md:1014` |
| FR-7 | I2. The halt is taken at 3j after both waits, and that is stated as what keeps 3j's classification consistent | MET | `SKILL.md:1014` |
| FR-8 | I1. Step 3j's opening wait names **both** conditions; the unsupported "has already completed" assertion is gone | MET | `SKILL.md:1028`; `grep -nF "has already completed" SKILL.md` → no match |
| FR-9 | I1. The amendment loop is entered at 3j, not at the inner join | MET | `SKILL.md:1016` |
| FR-9 | I2. Amendment **scoping** is explicitly unchanged (sub-contract row → that sub-contract; inherited row → escalates) | MET | `SKILL.md:1016` |
| FR-9 | I3. `max_contract_amendments` stated as one shared budget, one writer, deterministic order | MET | `SKILL.md:1016` |
| FR-10 | I1. Step 3L's wave sizing subtracts running integration coders | MET | `SKILL.md:926` |
| FR-10 | I2. The `max_parallel_lanes` key states the same rule in the same terms | MET | `config.md:481` |
| FR-10 | I3. Step 2L is explicitly untouched (architect fan-out never overlaps an inner join) | MET | `SKILL.md:926` (final sentence) |
| FR-11 | I1. The serialized-inner-join bullet becomes the concurrent form, citing Step 3s + ADR-0013 | MET | `config.md:248` |
| FR-11 | I2. `M_nested` carries a bare `+ J` for the inner-join level with the `slowest-of-k` annotation | MET | `config.md:256` (`+ J   k inner joins   (Step 3s — per-lane barrier, so slowest-of-k)`) |
| FR-11 | I3. The "opposite shapes" framing is restated so each level still says *why* it is slowest-of-k, without claiming an opposition | MET | `config.md:245` ("split by level, and each level is concurrent for its own reason"); dispatch-vs-barrier distinction at `config.md:248` |
| FR-11 | I4. The `(k − 1) × J` rationale is **preserved as recorded history** with an explicit ADR-0013 supersession note ("changing the machine", not re-reading it) | MET | `config.md:265` |
| FR-12 | I1. The inner-join cost bullet is rewritten to "charged on the **first** adoption only", mirroring the `A` bullet's shape | MET | `config.md:297` |
| FR-12 | I2. It explicitly notes that charging `J` per candidate bills `k` join passes for a level `M_nested` prices at `J` | MET | `config.md:297` |
| FR-12 | I3. Sequential-baseline paragraphs: first adoption still `A + A + J + J + I`; every later adoption is that sub-contract's **interface points alone** | MET | `config.md:308`, `config.md:311` (plus the "unchanged by ADR-0013 … at `k = 1` the two are the same quantity" note) |
| FR-13 | I1. Both baselines' "Every later adoption" cells become `I(…)` alone, with the reason widened to both levels | MET | `SKILL.md:547` (table rows for `M_flat` and `M_seq`) |
| FR-13 | I2. The trailing `k×J` rule is replaced: level charged once on the first adoption; a later candidate's `c` carries no `J` term | MET | `SKILL.md:554` |
| FR-13 | I3. The zero-cost expanded form survives (`c = I(0×0.25=0) = 0`, never a bare `0`) | MET | `SKILL.md:552`, `SKILL.md:554` |
| FR-14 | I1. The Step 2L paragraph names **which** barrier it means (Step 2s → 2L → 3L architect barrier) | MET | `SKILL.md:905` |
| FR-14 | I2. It states it is **not** the barrier ADR-0013 removes, and its arithmetic claim is untouched | MET | `SKILL.md:905` ("It is **not** the barrier ADR-0013 removes"; three-serial-round-trips claim byte-identical in diff) |
| FR-15 | I1. Example 1 re-derived and stated unchanged (span 6, overhead 8, `M_nested` 14 vs `M_flat` 16, `g` 6, `c` 4, adopted) | MET | `config.md:323` — independently re-derived below, matches |
| FR-15 | I2. Example 2 re-derived and stated unchanged (span 8, overhead 8.5, 16.5 vs 24, `g` 16, `c` 8.5) | MET | `config.md:343` — re-derived, matches |
| FR-15 | I3. Example 3 re-derived and stated unchanged (span 11, overhead 10, 21 vs 24, `g` 13, `c` 10) | MET | `config.md:363` — re-derived, matches |
| FR-16 | I1. A fourth worked example exists and is the `k = 2` case | MET | `config.md:365`; `grep -c '^#### Worked example' config.md` = **4** |
| FR-16 | I2. Its figures match those fixed in the spec (`M_flat` 28; adoption 1 `g` 14 / `c` 4.5 → 18.5; adoption 2 `g` 2 / `c` 0.5 → 17) | MET | `config.md:369-389` — re-derived by script below, exact match |
| FR-16 | I3. The behaviour-change bullet states the serialized counterfactual (`19`) and that the old rejection was self-consistent | MET | `config.md:391` — counterfactual re-derived as **19**, matches |
| FR-16 | I4. Both reconciliations are stated (Σ`c` = 5 = overhead delta; Σ`g` = 16 = span reduction) | MET | `config.md:393-396` — both re-derived, exact |
| FR-16 | I5. The remaining gates are checked in the example, and it carries the standing re-check instruction | MET | `config.md:398` (leaf sum 38, largest 21%, IP 4 ≤ T, 6 leaves ≤ ceiling); `config.md:400` |
| FR-17 | I1. The per-adoption increment is restated — `A + J` + IP for the first, **interface points alone** for every later one, both levels paid once | MET | `config.md:406` |
| FR-17 | I2. Termination restated on grounds that hold: monotonically shrinking gain, `g > c` rejects a wash (`0 > 0` false), finite lane set — and the false "strictly positive" claim is gone | MET | `config.md:408-412`; `grep -nF 'strictly positive amount to the accumulated overhead' config.md` → no match |
| FR-17 | I3. The three independent guards are named as the honest replacement | MET | `config.md:414` (leaf-width ceiling, aggregate diminishing-payback, per-sub-lane viability re-application) |
| FR-18 | I1. ADR-0013 reads `Status: Accepted`, dated to this change | MET | `docs/adr/0013-overlapped-inner-joins.md:3-4` |
| FR-18 | I2. All four open questions answered **in place**, incl. the "own framing was narrower than the defect" correction | MET | `docs/adr/0013-…md:63-134` (questions 1–4 each carry an *Answered* resolution) |
| FR-18 | I3. The three hazards the ADR did not name are recorded there (3j's second barrier, amendment entry point, `max_parallel_lanes`) | MET | `docs/adr/0013-…md:137-167` (§ *Three hazards this ADR did not name*, items 5–7) |
| FR-19 | I1. ADR-0012's cross-reference notes ADR-0013 is Accepted and implemented | MET | `docs/adr/0012-…md:150-153` |
| FR-19 | I2. ADR-0014 loses the false "Still `Proposed`" while keeping the true statement | MET | `docs/adr/0014-…md:127-129` |
| FR-20 | I1. `prime-agent/skills/**` was regenerated by the builder, not hand-edited — `--check` clean | MET | `node scripts/build-prime-agent.mjs --check` → exit **0**, `prime-agent/skills is up to date (11 skills, 154 files)` |
| FR-20 | I2. No overlay change was needed | MET | `git diff <base> --stat -- prime-agent/overlays/` → **empty** |
| FR-20 | I3. Both near-miss exact-count anchors are undisturbed at 3 | MET | `grep -cF 'the call shape from *How to spawn a subagent*' SKILL.md` = **3**; `grep -cF ':(exclude).claude' SKILL.md` = **3** |

**I per AC:** FR-1 2/2 · FR-2 2/2 · FR-3 3/3 · FR-4 5/5 · FR-5 1/1 · FR-6 4/4 · FR-7 2/2 · FR-8 1/1 · FR-9 3/3 · FR-10 3/3 · FR-11 4/4 · FR-12 3/3 · FR-13 3/3 · FR-14 2/2 · FR-15 3/3 · FR-16 5/5 · FR-17 3/3 · FR-18 3/3 · FR-19 2/2 · FR-20 3/3 — **57 / 57 = 1.00**

### Independent re-derivation of the spec's core claim (FR-16, `k = 2`)

Not accepted from the artifacts — recomputed from the model's own definitions (`A = 2`, `J = 2`, interface point `0.25`):

```
T 38  span_base 24  flatOverhead 4  M_flat 28   (largest lane 24/38 = 63% ≤ 70% → flat viable)
adopt1: span 10  g1 14  c1 4.5  overhead 8.5  M_nested 18.5  adopted true
adopt2: span  8  g2  2  c2 0.5  overhead 9    M_nested 17    adopted true
cost recon: overhead(9) − flatOverhead(4) = 5  =  c1(4.5) + c2(0.5)   ✓
gain recon: span 24 → 8 = 16                  =  g1(14)  + g2(2)      ✓
serialized counterfactual M_nested = 19  (> 18.5 of leaving B flat); serialized c2 = 2.5 > g2 = 2 → rejected ✓
remaining gates: leaf sum {8,8,8,5,5,4} = 38 = T · largest 8/38 = 21% ≤ 70% · aggregate IP 4 ≤ T · 6 leaves ≤ max_parallel_lanes 6 ✓
```

Every figure the evaluation brief named reconciles **exactly**. The three `k = 1` examples were re-derived the same way and are unchanged, confirming FR-15's "none of them move" claim rather than assuming it.

### Non-graded polish note (does not move any score)

`config.md:391` writes `I(4×0.25=1)` while `config.md:386`, five lines above, writes `I(4×0.25=1.0)`. Numerically identical, inside the same worked example. Already ruled cosmetic and non-blocking by both the reviewer and QA. **Confirmed to be the only such outlier**: an exhaustive sweep of every `I(n×0.25=v)` form in the file returns `0`, `0.5`, `0.5`, `1.0`, `0.5`, `1` — `config.md:369,376,379,386,389,391` — with `:391` the single deviation, and `I(0×0.25=0)` being the canonical form FR-13 itself mandates. Per this skill's rules, wording/notation polish is not an I-check and never moves `I`.

---

# FRAMEWORK — extract & respect

> **Reading note.** There is no upstream PRD separate from the spec — the spec *is* the acceptance authority for `Final`. `E` is therefore graded against the genuine upstream source the spec derives from: **ADR-0013** (its four filed open questions and its stated decision) plus the repo's standing invariants. This is a secondary reading, labelled as such, and it is more informative than reporting `E` as `n/a`.

## Elicitation E — category rubric (recall)

The rubric is applied with one domain extension (row 11), frozen here for any re-run of this spec.

| # | Category | Verdict | Evidence (`spec:line`) / why |
| --- | --- | --- | --- |
| 1 | Input validation & bounds | N/A | No user/external input surface; a cost-model and barrier-discipline change |
| 2 | Error taxonomy & messaging | Addressed | FR-4 consequence (b) — failure attribution must name the deferring lane(s); shipped as the `JOIN — deferred gate failed` block (`SPEC:59`) |
| 3 | AuthN / AuthZ | N/A | No endpoint, no user-owned data |
| 4 | Idempotency & dedup | Addressed | FR-4 — de-duplication of deferred gates moved to a single run site over the whole run (`SPEC:55`) |
| 5 | Concurrency & race conditions | Addressed | The spec's core contribution: FR-5 – FR-10, incl. **three races ADR-0013 never named** (`SPEC:63-81`) |
| 6 | Data lifecycle & consistency | Addressed | FR-6 artifact write disjointness (`SPEC:67`); FR-9 amendment atomicity vs. in-flight leaves (`SPEC:77-79`) |
| 7 | Observability | Addressed | FR-6 pinned `SUBJOIN` emission order (`SPEC:68`); FR-13 term-by-term printed arithmetic incl. the auditable zero (`SPEC:100`) |
| 8 | Limits, pagination & rate | Addressed | FR-10 — `max_parallel_lanes` in-flight ceiling re-established under overlap (`SPEC:81`) |
| 9 | External-dependency failure | Addressed | FR-4 — project gate commands may not be concurrency-safe even over disjoint paths (shared build dirs, lockfiles, ports) (`SPEC:57`) |
| 10 | State-transition integrity | Addressed | FR-7 `PARTIAL` routing (`SPEC:73`); FR-8 the second barrier at 3j (`SPEC:75`) |
| 11 | **Cross-reference / affected-surface completeness** (domain extension — mandatory for a single-source-of-truth doc skill, where a stale prose site at a second location *is* the defect class) | **Missed** | `SPEC:191` declares `templates/*.md` *"Not touched"* and its *Affected surface* names neither `SKILL.md`'s lane preamble nor `config.md`'s viability condition 4. All three describe the deferred-gate **run site** the change moved, and all three had to be corrected by a follow-up plan after `CR-20260819T043042Z-a7b9` raised MF-1 (blocker) + SF-1 + SF-2 |

**E_recall = 8 Addressed / (8 + 1 Missed) = 0.89** (2 N/A excluded)

## Elicitation E — added-requirement ledger (precision + justification)

Additions beyond what ADR-0013 filed:

| # | Requirement added beyond the ADR | Verdict | Built? | Justified? | Evidence + warrant |
| --- | --- | --- | --- | --- | --- |
| A1 | FR-8 — Step 3j gains an inner-join-completion wait | Valid-necessary | built | yes | `SPEC:75`, `SPEC:216` — 3j's "every inner join has already completed" was true *only* because of the barrier being removed; an integration coder writes files and can outlive the last leaf |
| A2 | FR-9 — the amendment loop's entry point moves to 3j | Valid-necessary | built | yes | `SPEC:77-79`, `SPEC:217` — an escalated amendment would invalidate an in-flight leaf, contradicting *never abandon a running leaf* |
| A3 | FR-10 — `max_parallel_lanes` counts integration coders | Valid-necessary | built | yes | `SPEC:81`, `SPEC:218` — both stated reasons for the key apply; tightens nothing previously allowed |
| A4 | FR-14 — Step 2L's barrier paragraph disambiguated | Valid-necessary | built | yes | `SPEC:102`, `SPEC:226` — ADR-0013 makes "the barrier discipline" ambiguous; without this a reader reads its follow-up as taken |
| A5 | FR-15 — mandatory re-derivation of the three existing examples, result stated explicitly | Valid-necessary | built | yes | `SPEC:106`, `SPEC:221` — both examples carry a standing "re-check whenever either side is edited" instruction |
| A6 | FR-16 — a `k = 2` worked example | Valid-necessary | built | yes | `SPEC:116`, `SPEC:222` — no existing example exercises `k > 1`, the entire subject of the change; file convention is one regression example per correction |
| A7 | FR-17 — the greedy-termination argument corrected | Valid-necessary | built | yes | `SPEC:127-131`, `SPEC:219` — "strictly positive cost" becomes **false** once a later adoption can cost 0 |
| A8 | Rejection of a **floor charge** for zero-cost later adoptions | Valid-necessary | built (as a non-goal) | yes | `SPEC:28`, `SPEC:219` — a floor would put gate and ladder back on two accounts, the exact defect the model was rewritten to prevent |
| A9 | FR-11 — preserve the superseded `(k − 1) × J` rationale as recorded history | Valid-defensive | built | yes | `SPEC:90`, `SPEC:220` — the file's established convention keeps every corrected defect on record |
| A10 | FR-19 / FR-20 — ADR cross-references and the generated-distribution contract, incl. the two exact-count near-miss anchors | Valid-necessary | built | yes | `SPEC:137`, `SPEC:139-141`, `SPEC:225` — repo invariants; the anchors are named as risks the plan must not disturb |
| A11 | Surface (do **not** apply) the `PROJECT-CONTEXT.md` out-of-scope carve-out for the builder | Valid-defensive | **deferred** | yes | `SPEC:174`, `SPEC:254` — documentation lag, explicitly left for a human to accept. Deferred-valid = good discipline, **not** an `S` penalty |

**E_precision = 11 valid / 11 = 1.00** · **E_justified = 11 / 11 = 1.00**
Every addition carries a one-line warrant in the spec's *Decisions resolved by Brainstormer default* section, in `→ decision → because` form — the strongest justification signal in the ledger.

`valid E-additions` set (used by `S` and the harness denominator): **[A1 … A11]** — all built except A11 (deferred by design).

## Scope S — traceability of built behaviour

| Built behaviour | Traces to | Verdict | Evidence |
| --- | --- | --- | --- |
| Per-lane barrier + all barrier/charge/ADR edits | FR-1 – FR-20 | pass | see the I-check table above, every row evidenced |
| `templates/coder.md` edited, though `SPEC:191` declared `templates/*.md` *"Not touched"* | FR-4 (via a **recorded scope amendment**) | pass — **not** rogue | `FIX-…-13ae:30` records the amendment explicitly: the spec's justification (*"the coder's defer-a-gate instruction is unchanged"*) is true of the **instruction** and false of the sentences around it. Verified: the instruction is byte-preserved (`templates/coder.md:153` still says defer to the nearest enclosing join, note it in `.progress.md`, proceed, deferring is correct-not-failure); only the false explanatory clause *"that join runs it once over its own scope"* and the now-false sentence *"A sub-lane never defers a gate past its own inner join"* changed. `grep -c 'A sub-lane never defers a gate past its own inner join'` = **0** |
| Guardrail-list ordering clause corrected (`SKILL.md:1488`) | FR-3's intent — a prose site asserting a global leaf barrier | pass | `FEAT-…-835a:72` records it as a spec gap **found during planning and named**, not silently absorbed |
| `prime-agent/skills/**` mirror updated | FR-20 | pass — generated, not authored | `--check` exit 0; `git diff` shows no overlay edit |
| Nothing built outside the spec's Non-goals | `SPEC:26-35` | pass | No new config key, no CLI arg, no re-slice retry, no `.opencode` port, no `M_flat` change, no default moved, no commit/push — all confirmed absent from the 9-file diff |
| Plan drift (sanctioned-but-unbuilt) | — | none | All 20 FRs built; both plans DONE; CR APPROVED (17/17 AC, zero Must-Fix); QA READY_TO_COMMIT (58 checks, 0 failures) |

**S = pass.** No PRD-boundary violation (the `templates/*.md` line sits in *Affected surface*, not in *Non-goals*, and the deviation is an explicitly recorded amendment traceable to FR-4). No rogue build. No plan drift. A11 is deferred-valid — good discipline, not penalised.

---

# HARNESS — ensure all implemented

## Test checklist (binary — over the sanctioned set = spec FRs ∪ valid E-additions)

The sanctioned set and the FR set coincide here: every valid `E`-addition (A1–A10) was folded into the spec as an FR before implementation, and A11 was deferred by design (nothing to verify). **Level policy for this change:** no executable path exists, so the required level is *a persisted, re-runnable structural assertion or a recorded hand re-derivation that pins this requirement's shipped text*. The check is: **can this FR silently regress with nothing catching it?**

| Requirement | Source | Level | T-check | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- |
| FR-1 | spec | structural | Global-barrier sentence pinned absent | MET | `FEAT:160` — `! grep -qF "across all lanes, not just this lane's" "$SK"` |
| FR-2 | spec | structural | Rewritten paragraph + ADR-0013 named | MET | `FEAT:161-162` — `! grep -qF 'deliberately **not** taken at this depth'`; `grep -qF 'ADR-0013'` |
| FR-3 | spec | structural | Pipeline-overview prose pinned | **UNMET** | Searched: FEAT Phase-2 (25 rows), Phase-3 (3), Phase-4 (6), FIX (29), and the QA report. `grep -nE 'compose bottom-up' plans/qa/QA-…md` → no match. No assertion anywhere pins `SKILL.md:105` or `:102`. The `SKILL.md:1488` guardrail assertion (`FEAT:175`) is a **different** site. Genuinely absent, not un-searched |
| FR-4 | spec + A-set | structural | Gate-run step absent, settled-union premise absent, lane attribution present, 3j run order pinned | MET | `FEAT:165-167`; FIX Phase-2 assertion set (29 rows) pins all four run-site prose corrections |
| FR-5 | spec | structural | Sole-writer-under-overlap sentence pinned | MET | `FEAT:168` — `grep -qF 'overlapping inner joins add no second writer'` |
| FR-6 | spec | structural | `SUBJOIN` emission order pinned | MET | `FEAT:169` — `grep -qF 'emitted in lane-map row order'` |
| FR-7 | spec | structural | `PARTIAL` recorded-at-3s / taken-at-3j pinned | **UNMET** | Searched both plans' assertion sets and the QA report for `Routing is recorded` — no match. `SKILL.md:1014` is verified by one-time human/QA read only |
| FR-8 | spec (A1) | structural | 3j's second wait pinned present, old claim pinned absent | MET | `FEAT:163-164` |
| FR-9 | spec (A2) | structural | Amendment-loop entry point pinned | **UNMET** | Searched both assertion sets and the QA report for `amendment loop is entered` — no match. `SKILL.md:1016` is audited once, not guarded |
| FR-10 | spec (A3) | structural | Ceiling accounting pinned at **both** sites | MET | `FEAT:170` — `grep -qF 'counting each inner join'` on `$SK` **and** `$CFG` |
| FR-11 | spec | structural | `M_nested` line + slowest-of-k pinned; `k × J` pinned absent | MET | `FEAT:156-157` |
| FR-12 | spec | structural | "every adoption" pinned absent, "first" pinned present | MET | `FEAT:158-159` |
| FR-13 | spec | structural | No `k × J` in `SKILL.md`; expanded zero form pinned | MET | `FEAT:156`, `FEAT:174` — `grep -qF 'I(0×0.25=0)'` |
| FR-14 | spec (A4) | structural | Step 2L disambiguation pinned | **UNMET** | Searched both assertion sets and the QA report for `Step 2s → Step 2L` — no match. `SKILL.md:905` is verified by read only |
| FR-15 | spec (A5) | arithmetic | All four examples hand re-derived against the edited model, matching the fixed figures | MET | `FEAT:176` — recorded in `.progress.md`; independently reproduced in this eval |
| FR-16 | spec (A6) | structural + arithmetic | Four examples, one `k = 2`; both reconciliations re-derived | MET | `FEAT:172-173` (`grep -c` = 4; `k = 2` = 1); `FEAT:176` (Σ`c` = 5, Σ`g` = 16) |
| FR-17 | spec (A7) | structural | False termination claim pinned absent | MET | `FEAT:171` — `! grep -qF 'strictly positive amount to the accumulated overhead'` |
| FR-18 | spec | structural | ADR status pinned both ways | MET | `FEAT:212` — `grep -qF '**Status:** Accepted'` and `! grep -qF '**Status:** Proposed'` |
| FR-19a | spec | structural | ADR-0012 cross-reference pinned | **UNMET** | Searched both assertion sets — only the ADR-0014 side is asserted. The ADR-0012 update at `:150-153` has no guard |
| FR-19b | spec | structural | ADR-0014's false "Still `Proposed`" pinned absent | MET | `FEAT:213` — `! grep -qF 'Still \`Proposed\`'` |
| FR-20 | spec (A10) | build gate | Builder drift guard + parity + both exact-count anchors + no `k × J` in the generated tree | MET | `FEAT:177-178` (anchors = 3/3), `FEAT:196-199` (`--check` 0, `npm test` 0, `! grep -rq k × J`) |

**T per AC:** FR-1 1/1 · FR-2 1/1 · FR-3 **0/1** · FR-4 1/1 · FR-5 1/1 · FR-6 1/1 · FR-7 **0/1** · FR-8 1/1 · FR-9 **0/1** · FR-10 1/1 · FR-11 1/1 · FR-12 1/1 · FR-13 1/1 · FR-14 **0/1** · FR-15 1/1 · FR-16 1/1 · FR-17 1/1 · FR-18 1/1 · FR-19 **1/2** · FR-20 1/1 — **16 / 21 = 0.76**

**Harness completeness over the sanctioned set:** 16 of 21 sanctioned propositions carry a re-runnable guard. All five gaps are the **same shape** — correctly-shipped prose (every corresponding I-check is MET, and the reviewer and QA both confirmed the text) that no persisted assertion pins, so it can be silently reverted by a future editor with nothing failing. This is the structural analogue of the skill's *exercised-not-asserted* anchor: audited once ≠ guarded.

## Extra tests (Robustness — not scored toward the FRs)

| # | Extra verification | Level | Evidence | Value |
| --- | --- | --- | --- | --- |
| E1 | The guardrail-list ordering clause (`SKILL.md:1488`) — a global-barrier assertion the spec's *Affected surface* never named — found in planning and pinned | structural | `FEAT:72`, `FEAT:175` | High |
| E2 | Three stale run-site prose sites found by code review and corrected (`SKILL.md:958` lane preamble, `config.md:437` viability condition 4, `templates/coder.md:153`) | structural | `CR-…-a7b9` MF-1/SF-1/SF-2 → `FIX-…-13ae` Phase 2 | High |
| E3 | SF-3 — the de-duplicated deferred-gate set's **run order** pinned at 3j item 4 (row order of first deferral, ties by command string) | structural | `SKILL.md:1063`; FIX Phase-2 | Med |
| E4 | Both overlay near-miss exact-count anchors asserted at 3/3 rather than assumed | build | `FEAT:177-178`; independently re-verified in this eval | Med |
| E5 | `! grep -rqE 'k × J' prime-agent/skills/orchestrator/` — the overlay did not reintroduce the superseded charge into the generated tree | build | `FEAT:198` | Med |
| E6 | Upstream fold-back of the corrected `k = 2` counterfactual (**19**, not 20) into spec FR-16 and the FEAT plan | structural | `SPEC:231-239`; `FIX-…-13ae` Phase 4 | Med |
| E7 | Three no-regression floors over unrelated surface (`clean-code-gates` 213, `prime-agent` install+parity, builder `--check`) | floor | re-run in this eval, all clean | Low ×3 |

**R = 1.0 + 1.0 + 0.5 + 0.5 + 0.5 + 0.5 + (0.25 × 3) = 4.75**

`R` is high and it is earned by the *review loop*, not the first pass: E1 and E2 are both cases where a downstream role caught a surface the spec's own affected-surface analysis missed. That is the same finding row 11 of the recall rubric records — counted once in `E`, reported once in `R`, never folded into `Final`.

## Test distribution by tier (D — reported, not scored)

Unit of classification: the persisted `[x]`-checked assertion rows across `FEAT-…-835a` (41) and `FIX-…-13ae` (29) = **70**.

| Tier | Count | % | Representative evidence |
| --- | --- | --- | --- |
| Necessary (pins the barrier half or the charge half — the change's core proposition) | 28 | 40% | `FEAT:156-167` (no `k × J`, `+ J` slowest-of-k, first-adoption charge, global barrier gone, gate-run step gone); FIX Phase-2 run-site rows |
| Secondary (supporting resolutions, determinism, ceiling, ADR record, generated-tree integrity, overlay anchors) | 29 | 41% | `FEAT:168-178`, `FEAT:196-199`, `FEAT:212-213`; the 13 builder `--check`/parity rows |
| Nice-to-have (no-regression floors over unrelated surface) | 13 | 19% | `clean-code-gates` 213-pass rows, `prime-agent && npm test` rows |
| **Total** | **70** | **100%** | — |

**Shape**: balanced and correctly weighted for the change — 40% pins the two halves the spec calls indivisible, and the 19% floor layer is honestly labelled as unrelated surface rather than passed off as evidence about this change. The one structural weakness is not a tier imbalance but a **coverage hole**: five FRs (3, 7, 9, 14, 19a) have zero rows in any tier. (Pre-existing tests excluded: the 213 `clean-code-gates` unit tests and the `prime-agent` install suite are counted only as floors, never as feature verification.)

## Engineering Gates G

Each gate actually executed in this evaluation; nothing assumed. The evaluator did not modify the subject.

| Gate | Command (pinned) | Result |
| --- | --- | --- |
| **build** | `node scripts/build-prime-agent.mjs --check` | **✓** exit 0 — `prime-agent/skills is up to date (11 skills, 154 files)`. This is the repo's canonical build/drift gate and the **only** gate that touches this change's surface |
| **lint** | — | **not-run** — probed, no tooling exists. `ls package.json` → *No such file or directory*; `ls .eslintrc* eslint.config.*` → *no matches found*; `which shellcheck` → *not found*. No lint gate is definable for a markdown-only diff in this repo |
| **unit** | `cd plugins/my-skills/skills/clean-code-gates && npm test` · `cd prime-agent && npm test` | **✓** 213 pass / 0 fail (exact expected baseline); `install ok` + `parity ok`, exit 0. **Both cover entirely unrelated surface** — a no-regression floor, not evidence about this change |
| **e2e** | — | **not-run** — structurally impossible, not merely unavailable. `parallelism` resolves to `off` in this repo and a `full` run with `k ≥ 2` is unreachable here, so the changed path cannot be driven by any entry point. An e2e test would assert against a fabricated fan-out. **Explicitly not scored as a harness gap** |

**No gate is `✗`, so `Adjusted Final` does not apply.** Per this skill's rules a `not-run` gate can neither grant nor deduct credit — both are reported as known blind spots, and the e2e one is a blind spot by construction rather than by omission.

---

## Result

| AC | I (MET/total) | T (MET/total) | AC_score = 0.6·I + 0.4·T |
| --- | --- | --- | --- |
| FR-1 | 2/2 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-2 | 2/2 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-3 | 3/3 = 1.00 | 0/1 = 0.00 | **0.60** |
| FR-4 | 5/5 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-5 | 1/1 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-6 | 4/4 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-7 | 2/2 = 1.00 | 0/1 = 0.00 | **0.60** |
| FR-8 | 1/1 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-9 | 3/3 = 1.00 | 0/1 = 0.00 | **0.60** |
| FR-10 | 3/3 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-11 | 4/4 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-12 | 3/3 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-13 | 3/3 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-14 | 2/2 = 1.00 | 0/1 = 0.00 | **0.60** |
| FR-15 | 3/3 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-16 | 5/5 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-17 | 3/3 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-18 | 3/3 = 1.00 | 1/1 = 1.00 | 1.00 |
| FR-19 | 2/2 = 1.00 | 1/2 = 0.50 | **0.80** |
| FR-20 | 3/3 = 1.00 | 1/1 = 1.00 | 1.00 |

### Roll-up — computed, not hand-calculated

Executed as a script (Reproducibility rule 4); `Σw` derived inside the script from the priority table, never typed:

```
I overall 57/57 = 1.0000
T overall 16/21 = 0.7619
Story_score = 0.9100 -> 0.91
Sigma_w = 3   Final = 0.9100 -> 0.91
Band: Spec-complete
R = 4.75
D Necessary 28 40% | Secondary 29 41% | Nice-to-have 13 19% | total 70
```

| Dimension | Subject | Value |
| --- | --- | --- |
| **Story_score / Final (spec fidelity)** | framework + harness | **0.91** |
| Elicitation E (recall / precision / justified) | framework | 0.89 / 1.00 / 1.00 |
| Scope Adherence S | framework | **pass** (one recorded scope amendment, traceable to FR-4; one deferred-valid addition, not penalised) |
| Harness completeness (T over sanctioned set) | harness | 16/21 = 0.76 |
| Engineering Gates G | harness | build **✓** · lint **not-run** (probed: no tooling) · unit **✓** (unrelated surface, floor only) · e2e **not-run** (path unreachable by construction) |
| Robustness Index R | harness | **4.75** |
| Test Distribution D | harness | Necessary 40% / Secondary 41% / Nice-to-have 19% (70 assertions) |
| Adjusted Final (only if a gate is ✗) | — | **n/a** — no gate is `✗` |
| k=3 disagreements | — | Two checks split across passes, both resolved to the majority: **FR-16 I3** (whether `config.md:391`'s `I(4×0.25=1)` notation invalidates the counterfactual — resolved **MET**, the figure 19 is correct and notation is not a check) and **`S` on `templates/coder.md`** (rogue-build vs. recorded-amendment — resolved **pass**, the amendment is documented at `FIX-…-13ae:30` and the coder's instruction is byte-preserved) |

**Verdict: Spec-complete (0.91).**
- **Framework — respect + extract:** exceptional. Every one of the 20 functional requirements is implemented and evidenced (`I = 1.00`), with zero scope violations (`S = pass`) and zero noise in the additions (`E_precision` and `E_justified` both 1.00). The spec did the thing the ADR could not do for itself: it resolved all four filed open questions *and* found three unnamed races (A1–A3) that would have shipped as real defects. The single recall miss is affected-surface completeness — three stale run-site prose sites the spec declared out of scope, which a code review then had to catch.
- **Harness — ensure implemented:** good, given the constraint, but incomplete. The grep-shaped assertion set is genuine regression protection, was proven red before the edits, and pins the whole load-bearing barrier/charge core. Five sanctioned propositions (FR-3, FR-7, FR-9, FR-14, FR-19a) ship correct but unguarded, and that — not any absent behavioural test — is the entire gap between 0.91 and 1.00.

---

## Gaps (ranked) and fixes to reach 1.00

**Harness (the whole of the shortfall — five unguarded propositions, ~0.09 of `Final`):**

1. **FR-3** — no assertion pins the corrected pipeline-overview prose → add `grep -qF 'per-lane sub-lane barrier' "$SK"` and `grep -qF 'concurrently with other lanes' "$SK"` (pins both `SKILL.md:105` and `:102`).
2. **FR-9** — no assertion pins the amendment loop's entry point, the resolution most likely to be "simplified" back by a future editor → add `grep -qF 'The contract-amendment loop is entered at Step 3j' "$SK"`.
3. **FR-7** — no assertion pins `PARTIAL` recorded-at-3s / taken-at-3j → add `grep -qF 'Routing is recorded here and taken at Step 3j' "$SK"`.
4. **FR-14** — no assertion pins the Step 2L disambiguation, whose whole purpose is to stop a later reader misreading ADR-0013 as having taken that follow-up → add `grep -qF 'It is **not** the barrier ADR-0013 removes' "$SK"`.
5. **FR-19a** — the ADR-0012 cross-reference update is unguarded while its ADR-0014 twin is guarded → add `grep -qF 'now **Accepted and' docs/adr/0012-nested-parallelism-cost-model-corrections.md`.

**Framework (does not move `Final`; improves `E_recall` from 0.89 to 1.00):**

6. **Affected-surface completeness** — the spec's *Affected surface* should be produced by an exhaustive grep sweep for the *concept* being changed (here: every prose site naming a deferred gate's run site), not by enumerating the sites the ADR happened to mention. That single method change would have caught `SKILL.md:958`, `config.md:437`, and `templates/coder.md:153` before the code review had to, and would have avoided the `templates/*.md` "Not touched" claim that a follow-up plan then had to formally amend.

**Cosmetic (non-graded, does not move any score):**

7. `config.md:391` → write `I(4×0.25=1.0)` to match `:386` five lines above. Confirmed the only such outlier in the file. Already ruled non-blocking by both the reviewer and QA; recorded here for completeness only.

---

## Assumptions

- **Priority is `ASSUMED`.** The spec carries no P0/P1/P2 labels. The change is treated as **one story at P0** (weight 3), on the strength of the spec's own *Internal consistency* clause making the barrier half and the charge half a single indivisible deliverable. With one story, `Final = Story_score` and the weight cannot shift the band.
- **Judge ≠ author is only partially satisfied** (Core rule 4): the evaluating model is from the same family as the authoring roles. Both borderline checks were therefore stress-tested and are recorded above; both resolved on documentary evidence (`FIX-…-13ae:30`; independent arithmetic re-derivation) rather than on judgment.
- **`E` is graded against ADR-0013 plus the repo's standing invariants**, since no PRD exists upstream of the spec — the spec *is* the acceptance authority for `Final`. This is a labelled secondary reading, not a substitute for a true PRD baseline.
- **The generated `prime-agent/skills/**` tree is not scored as separate work.** It is derived output; the plugins source is the implementation site, and `--check` exit 0 is the evidence that the derivation is faithful.
- **`e2e` `not-run` is structural, not incidental.** It carries no `Adjusted Final` and is not counted as a harness gap anywhere in this report.

## Reproducibility

Freeze this checklist as the baseline for any re-run of `SPEC-20260819T034803Z-18d2`: 20 ACs (the spec's own FR ids), **57 I-checks**, **21 T-checks**, the 11-row recall rubric (rows 1–10 standard + row 11 *Cross-reference / affected-surface completeness*), and the level policy *"a persisted, re-runnable structural assertion or recorded hand re-derivation"* in place of unit/e2e. Do not re-split or merge the FRs; do not re-derive the checklist per run.
