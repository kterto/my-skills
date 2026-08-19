# Progress: FEAT-20260819T035826Z-835a — Adopt ADR-0013 — overlap inner joins and reprice the inner-join level

**Plan**: [FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md](./FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md)
**Status**: DONE
**Created**: 2026-08-19T04:02:00Z

---

## Log

### 2026-08-19T04:02:00Z | ARCHITECT

Created plan `FEAT-20260819T035826Z-835a`. Type: feat. Tasks: 63 work tasks across 4 phases, plus 40 phase-verification assertions.

Source spec: `plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md` (READY_FOR_PLANNING, all 20 FRs carried into tasks).

Planning decisions worth carrying downstream:

- **Phase 2 is deliberately one large phase (43 tasks).** ADR-0013's hard constraint — change the barrier and the charge together, or neither — forbids any ordering that lands one half without the other, including transiently within the plan. Splitting `SKILL.md` and `references/config.md` into separate phases would put the gate and the ladder on two accounts, which is the exact defect the cost side exists to prevent. A reviewer should read the phase size as required, not as a planning miss.
- **Spec gap found and planned.** `SKILL.md` ~L1462 (guardrail list) reads *"Never abandon an in-flight leaf subagent. Wait for all of them, then join — inner joins first (Step 3s), then the outer join (Step 3j)."* It asserts the global leaf barrier and the strict 3s-after-all-leaves ordering FR-1 removes, and the spec's *Affected surface* does not name it. Planned as an explicit Phase 2 task under FR-3's intent; the never-abandon rule itself is unchanged, only its ordering clause.
- **Resolved contradiction between AC-1 and FR-11.** FR-13 demands no `k × J` survives anywhere; FR-11 preserves the superseded rationale as recorded history. Compatible only if the history note expresses the superseded quantity as `(k − 1) × J` and in prose, never re-introducing the literal `k × J`. Stated as a required phrasing in Technical Notes so coder and reviewer do not collide on it.
- **Baselines measured at planning time, not assumed:** `clean-code-gates` suite = 213 passing / 0 failing; `grep -cF 'the call shape from *How to spawn a subagent*'` = 3 and `grep -cF ':(exclude).claude'` = 3 in the plugin `SKILL.md`; `k × J` occurs once in `SKILL.md` (L554) and three times in `references/config.md` (L248, L256, L295), with the same four sites mirrored in the generated Prime tree; `references/config.md` currently carries 3 worked examples.
- **Phase 2's `--check` gate asserts a non-zero exit on purpose.** After the source edits and before Phase 3's regeneration, the builder must report exactly the two orchestrator files as stale and no other drift line — that bounded blast radius is the assertion, not a clean exit.
- **No behavioural test is planned, and that is the honest posture.** `parallelism` is `off` by default and a `full` run with `k ≥ 2` is unreachable in this repo, so no run here exercises the changed path. Verification is the red-then-green grep assertion set, hand re-derivation of all four worked examples, the builder drift guard, `prime-agent`'s suite, and `clean-code-gates` as an unchanged no-regression floor.
- **PROJECT-CONTEXT lag surfaced, not worked around.** Its Out-of-scope entry *"Running language/build/test tooling against markdown doc skills"* predates the Prime Agent distribution (`e2e635f`), which made `scripts/build-prime-agent.mjs` mandatory for any `plugins/my-skills/skills/**` change. Phase 4 records the suggested carve-out for a human to accept; this change does not edit `PROJECT-CONTEXT.md`.
- **No open product decision blocks this plan.** `parallelism` stays `off` by default and no default moves. opencode-port-parity is not applicable (`orchestrator` has no `.opencode` override port).

Status: PLANNED. Ready for coder.

### 2026-08-19T05:10:00Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T05:20:00Z | CODER — Phase 1 (red baseline and anchor census)

**Pre-change baselines (measured, not assumed):**

| Baseline | Result |
| --- | --- |
| `node scripts/build-prime-agent.mjs --check` | exit **0** — `prime-agent/skills is up to date (11 skills, 154 files)` |
| `cd prime-agent && npm test` | exit **0** — `install ok`, `parity ok` |
| `cd plugins/my-skills/skills/clean-code-gates && node --test` | exit **0** — `# tests 213 / # pass 213 / # fail 0` |
| `grep -cF 'the call shape from *How to spawn a subagent*' SKILL.md` | **3** |
| `grep -cF ':(exclude).claude' SKILL.md` | **3** |

**Red assertion log — Phase 2 assertion set run against the unedited tree** (`SK` = `plugins/my-skills/skills/orchestrator/SKILL.md`, `CFG` = `.../references/config.md`):

| # | Assertion | Baseline |
| --- | --- | --- |
| A01 | `! grep -qE 'k × J\|k×J' $SK $CFG` | **FAIL (red)** |
| A02a | `grep -qE '^\s*\+ J\s+k inner joins' $CFG` | **FAIL (red)** |
| A02b | that same line matches `slowest-of-k` | **FAIL (red)** |
| A03 | `! grep -qF 'charged on **every** adoption' $CFG` | **FAIL (red)** |
| A04 | `grep -qF 'first' $CFG` (inner-join cost bullet) | PASS — **weak assertion, see note 1** |
| A04′ | inner-join bullet contains `charged on the **first** adoption only` | **FAIL (red)** — strengthened form |
| A05 | `! grep -qF "across all lanes, not just this lane's" $SK` | **FAIL (red)** |
| A06 | `! grep -qF 'deliberately **not** taken at this depth' $SK` | **FAIL (red)** |
| A07 | `grep -qF 'ADR-0013' $SK` | **FAIL (red)** |
| A08 | `grep -qF 'and for every inner join to complete' $SK` | **FAIL (red)** |
| A09 | `! grep -qF 'has already completed' $SK` | **FAIL (red)** |
| A10 | `! grep -qF "Run every gate this lane's sub-lanes deferred" $SK` | **FAIL (red)** |
| A11 | `! grep -qF 'once over the **settled** lane union' $SK` | PASS — **transcription artifact, see note 2** |
| A11′ | `! grep -qF 'once over the settled lane union' $SK` | **FAIL (red)** — actual bolding |
| A12 | `grep -qF 'lane(s) that deferred' $SK` | **FAIL (red)** |
| A13 | `grep -qF 'overlapping inner joins add no second writer' $SK` | **FAIL (red)** |
| A14 | `grep -qF 'emitted in lane-map row order' $SK` | **FAIL (red)** |
| A15a | `grep -qF 'counting each inner join' $SK` | **FAIL (red)** |
| A15b | `grep -qF 'counting each inner join' $CFG` | **FAIL (red)** |
| A16 | `! grep -qF 'strictly positive amount to the accumulated overhead' $CFG` | **FAIL (red)** |
| A17 | 4 worked examples | **FAIL (red)** — currently 3 |
| A18 | one `k = 2` worked example | **FAIL (red)** — currently 0 |
| A19 | `grep -qF 'I(0×0.25=0)' $SK` | PASS — **invariant guard**, must stay green |
| A20 | `! grep -qF 'Wait for all of them, then join — inner joins first' $SK` | **FAIL (red)** |
| A21 | `grep -qF 'through a **single sequential coder invocation**' $SK` | PASS — **invariant guard**, must stay green |
| A22 | anchor `the call shape from *How to spawn a subagent*` = 3 | PASS — **invariant guard**, must stay green |
| A23 | anchor `:(exclude).claude` = 3 | PASS — **invariant guard**, must stay green |

Red set is **non-empty** (20 of 27 red). The four PASS-and-must-stay-PASS rows (A19, A21, A22, A23) are guards, not red-baseline rows — they assert text this change must *not* disturb, so passing at baseline is the intended state.

**Note 1 — A04 as written is unfalsifiable.** `grep -qF 'first' "$CFG"` matches the whole file (the word occurs dozens of times, including inside the very bullet being rewritten: *"does not overlap the first's"*). It can never go red, so it proves nothing. Recorded as PASS for fidelity to the plan, and a strengthened form **A04′** — the inner-join bullet must contain `charged on the **first** adoption only`, mirroring the `A` bullet — added and confirmed red. Both are asserted green at Phase 2 exit.

**Note 2 — A11 is a bold-marker transcription artifact, not a missing target.** The plan's literal is `once over the **settled** lane union`; the file (SKILL.md L983, Step 3s item 3) actually reads `run each **once over the settled lane union**` — the emphasis wraps the whole phrase. The target text **is** exactly where the spec says it is, so the Phase-1 stop condition (*"it means the target text is not where the spec says it is"*) is **not** triggered. Strengthened form **A11′** with the real bolding was added and confirmed red. Both forms are asserted green at Phase 2 exit, which is strictly stronger than the plan required.

**Hand re-derivation of the three existing worked examples under the CURRENT (serialized `k × J`) model** — the recorded baseline FR-15's "unchanged" claim is compared against. All three are `k = 1`, where `1 × J` = `J` identically, which is *why* they are expected to survive the reprice untouched:

| Example (`CFG` line) | `span_base` | `span_max` | baseline overhead | nested overhead | baseline makespan | `M_nested` | `g` | `c` | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *gate verdict / ladder figure* (L307) | 12 | 6 | `A + J` = 4 | `A + A + 1×J + J` = 8 | `M_flat` = 16 | 14 | 6 | 4 | adopted |
| *one lane carries all the work* (L321) | 24 (`T`) | 8 | 0 | `A + A + 1×J + J + I(2×0.25)` = 8.5 | `M_seq` = 24 | 16.5 | 16 | 8.5 | adopted |
| *a split carrying an integration sub-lane* (L339) | 24 (`T`) | 11 | 0 | `A + A + 1×J + J + I(8×0.25)` = 10 | `M_seq` = 24 | 21 | 13 | 10 | adopted |

Every figure re-derived by hand matches the figures currently printed in the file. Phase 2's re-derivation compares against this table, not against an assumption.

Phase 1 verification: all four checklist rows green.

### 2026-08-19T05:45:00Z | CODER — Phase 2 (the atomic change: barrier half + charge half)

Both halves landed in **one working state**, in a single unbroken edit sequence — no task in this phase was checked before both `SKILL.md` and `references/config.md` were consistent. Per ADR-0013's hard constraint, the phase was not split and no intermediate state where one half had landed was ever committed to the working tree as complete.

**Assertion set — all 27 green** (25 from the plan's Phase 2 checklist + the two strengthened forms added in Phase 1):

A01 ✓ A02a ✓ A02b ✓ A03 ✓ A04 ✓ **A04′ ✓** A05 ✓ A06 ✓ A07 ✓ A08 ✓ A09 ✓ A10 ✓ A11 ✓ **A11′ ✓** A12 ✓ A13 ✓ A14 ✓ A15a ✓ A15b ✓ A16 ✓ A17 ✓ A18 ✓ A19 ✓ A20 ✓ A21 ✓ A22 ✓ A23 ✓

Every one of the 20 rows that was red in Phase 1 is now green; the four invariant guards (A19, A21, A22, A23) that had to stay green did.

**Builder drift guard — the deliberately non-zero gate.** `node scripts/build-prime-agent.mjs --check` → **exit 1**, output exactly:

```
stale:   prime-agent/skills/orchestrator/SKILL.md
stale:   prime-agent/skills/orchestrator/references/config.md

2 file(s) out of date. Run: node scripts/build-prime-agent.mjs
```

Exactly the two orchestrator files, **no other drift line** — the bounded blast radius the plan asserts. Not "fixed" by regenerating early; Phase 3 owns that.

**No-regression floor.** `cd plugins/my-skills/skills/clean-code-gates && node --test` → exit 0, `# tests 213 / # pass 213 / # fail 0`. Unchanged from the Phase 1 baseline. The suite was run **unchanged, as a floor** — it was not applied to the edited markdown.

**Cross-references verified structurally** (PROJECT-CONTEXT's stated method for doc skills). Every `SKILL.md` → `references/config.md` section reference and every `references/config.md` → `SKILL.md` step reference resolves against an existing heading, including the ones this change added (`SKILL.md` → Step 3s / Step 3L from the `max_parallel_lanes` key and *The makespan model*; `references/config.md` → *The cost side* / `max_parallel_lanes` from Step 2p.2 and Step 3L). `config.md` L227's quotation of Step 3s's *"through a single sequential coder invocation — after its sibling sub-lanes are DONE"* still resolves — that phrasing was preserved verbatim as the exact-count overlay guard requires.

**Hand re-derivation of all four worked examples, against the EDITED model:**

| Example | `span_base` | `span_max` | baseline overhead | nested overhead | baseline makespan | `M_nested` | `g` | `c` | verdict | vs Phase 1 baseline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *gate verdict / ladder figure* | 12 | 6 | `A + J` = 4 | `A + A + J + J` = 8 | `M_flat` = 16 | 14 | 6 | 4 | adopted | **identical** |
| *one lane carries all the work* | 24 (`T`) | 8 | 0 | `A + A + J + J + I(2×0.25)` = 8.5 | `M_seq` = 24 | 16.5 | 16 | 8.5 | adopted | **identical** |
| *a split carrying an integration sub-lane* | 24 (`T`) | 11 | 0 | `A + A + J + J + I(8×0.25)` = 10 | `M_seq` = 24 | 21 | 13 | 10 | adopted | **identical** |
| *`k = 2`* (new) | 24 | 8 (after 2 adoptions) | `A + J` = 4 | `A + A + J + J + I(4×0.25)` = 9 | `M_flat` = 28 | 17 | 16 (Σ) | 5 (Σ) | both adopted | n/a — new |

FR-15's "unchanged" claim is therefore a **verified comparison against the Phase 1 recorded table**, not an assumption. All three survive because they are `k = 1`, where `1 × J` and slowest-of-one-`J` are the same quantity — which is exactly why a `k = 2` example was needed to pin the new arithmetic at all.

**`k = 2` example, term by term:**

- Baseline: `span_base = max(24, 10, 4)` = 24; flat overhead `A(2) + J(2) + I(0)` = 4; `M_flat` = 28. Flat viable: 3 lanes carry work, largest holds 24/38 = 63% ≤ 70%.
- Adoption 1 (`A: 24 → {8,8,8}`): `span_max` = `max(8,10,4)` = 10; `g₁` = 24 − 10 = **14**; `c₁` = `A(2) + J(2) + I(2×0.25=0.5)` = **4.5**; 14 > 4.5 → adopted. Accumulated overhead `A+A+J+J+I(0.5)` = **8.5**; `M_nested` = 10 + 8.5 = **18.5**.
- Adoption 2 (`B: 10 → {5,5}`): `span_max` = `max(8,5,4)` = 8; `g₂` = 10 − 8 = **2**; `c₂` = `I(2×0.25=0.5)` = **0.5** (no `A`, and newly no `J`); 2 > 0.5 → adopted. Accumulated overhead `A+A+J+J+I(4×0.25=1.0)` = **9**; `M_nested` = 8 + 9 = **17**.
- **Reconciliation 1 (cost):** `M_nested` overhead 9 − `M_flat` overhead 4 = **5** = `c₁`(4.5) + `c₂`(0.5). ✓
- **Reconciliation 2 (gain):** span reduction 24 → 8 = **16** = `g₁`(14) + `g₂`(2). ✓
- Remaining gates: 6 leaves `{8,8,8,5,5,4}` sum to `T` = 38 ✓; ≥ 2 leaves carry work ✓; largest leaf 8/38 = 21% ≤ 70% ✓; aggregate interface points 4 ≤ `T` = 38 ✓; 6 leaves ≤ `max_parallel_lanes` default 6 ✓.

**DEVIATION — one figure in FR-16 is arithmetically wrong and was corrected to the value the spec's own expression yields.**

Plan task and spec FR-16 both state that, under the superseded serialized charge, *"the serialized plan's own `M_nested` would have been `8 + (A + A + 2J + J + I)` = **20**"*. That expression does not evaluate to 20:

```
span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25 = 1.0) = 19
```

The **expression** in the spec is correct; the **total** is off by one. `I` is the aggregate interface term over the parent (0) plus both adopted sub-contracts (2 + 2) = 4 points × 0.25 = 1.0, and 8 + 2 + 2 + 4 + 2 + 1 = **19**.

**Written as 19**, in fully expanded term-by-term form so the figure is self-checking in the file. Reasons for correcting rather than transcribing:

- `references/config.md` is a **normative cost model** whose entire premise is that the gate and the ladder agree arithmetically. Writing a figure that fails its own re-derivation would plant, inside the very example added to pin the new arithmetic, the class of defect the file exists to prevent.
- The plan's own verification row mandates *"All four worked examples hand re-derived against the edited model"* and lists **hand arithmetic** as the gate for any change to a worked example. Under that gate the answer is 19.
- **Every load-bearing claim of AC-11 / FR-16 is preserved unchanged.** The figure appears only in the counterfactual sentence, and its qualitative role — *the serialized plan's `M_nested` was worse than the 18.5 of leaving `B` flat, so the rejection was self-consistent then* — holds identically at 19 (19 > 18.5). Both named reconciliations (Σ`c` = 5 = overhead delta; Σ`g` = 16 = span reduction) are untouched by it, as are all figures in AC-11's list.

**Flagged for the reviewer**, and for the architect to fold back into spec FR-16. This is the only deviation from the plan's stated figures in this session.

Phase 2 verification: all 27 assertions green, `--check` non-zero with exactly the two-file blast radius, `clean-code-gates` 213/213, worked examples re-derived and recorded above.

### 2026-08-19T05:55:00Z | CODER — Phase 3 (regenerate the Prime Agent distribution)

**No hand-edit of the generated tree.** `git status --porcelain prime-agent/skills/` was **empty** immediately before the build ran, proving Phase 2 touched only the two source files under `plugins/my-skills/skills/orchestrator/`.

`node scripts/build-prime-agent.mjs` → exit 0, `wrote prime-agent/skills with 11 skills (154 files)`.

**The regeneration changed exactly two files and nothing else:**

```
 M prime-agent/skills/orchestrator/SKILL.md
 M prime-agent/skills/orchestrator/references/config.md
```

**No overlay change was needed — verified anchor by anchor rather than assumed.** All 16 `replacements` anchors in `prime-agent/overlays/orchestrator.json` plus the one `references/config.md` `fileReplacements` anchor were matched against the edited sources and each resolves at its **declared count**:

- `':(exclude).claude'` → 3 (declared 3) ✓
- `the call shape from *How to spawn a subagent*` → 3 (declared 3) ✓
- all 15 remaining anchors → 1 each (declared 1) ✓

None of them targets text this change rewrote. In particular Step 3s's integration sub-lane invocation was **not** rewritten to reference the shared call shape — it still reads *"through a **single sequential coder invocation**"* — which is what keeps the near-miss anchor at 3 rather than taking it to 4 and hard-failing `--check` with an exact-count error. A clean `--check` is the proof.

**Phase 3 verification:**

| Gate | Result |
| --- | --- |
| `node scripts/build-prime-agent.mjs --check` | **exit 0** — `prime-agent/skills is up to date (11 skills, 154 files)`; no drift, no mode drift, no exact-count anchor failure |
| `cd prime-agent && npm test` | **exit 0** — `install ok`, `parity ok` (`tests/install.sh` + `tests/parity.sh`) |
| `! grep -rqE 'k × J\|k×J' prime-agent/skills/orchestrator/` | **absent** — the overlay did not reintroduce the superseded charge into the generated tree |
| `cd plugins/my-skills/skills/clean-code-gates && node --test` | **exit 0** — 213 passing / 0 failing |

Spot-checked the generated tree carries the change end-to-end: `and for every inner join to complete` ×1, `overlapping inner joins add no second writer` ×1, `emitted in lane-map row order` ×1, `counting each inner join` ×1, `lane(s) that deferred` ×1 in the generated `SKILL.md`; the `+ J … k inner joins … slowest-of-k` line and 4 worked examples in the generated `config.md`. The overlay's own rewrites still applied on top (`the call shape from *How to spawn a role child*` ×3; `':(exclude).claude' ':(exclude).prime'` ×3).

### 2026-08-19T06:05:00Z | CODER — Phase 4 (ADR record, cross-references, surfaced PROJECT-CONTEXT gap)

**`docs/adr/0013-overlapped-inner-joins.md` → `Accepted`**, amended in place rather than superseded by a new ADR — it is being accepted, not reversed, the same transition ADR-0014 records. Date line now reads `2026-08-14 (proposed) / 2026-08-19 (accepted and implemented)`, preserving the original proposal date rather than overwriting it.

**All four *What must be resolved before implementing* questions answered in place**, section retitled *"— resolved, 2026-08-19"*, each question kept verbatim as filed with its answer beneath it:

1. **Deferred-gate de-duplication** — option A **generalized** (3s runs none; Step 3j item 4 is the single run site for every deferred gate at either depth). The conditional form of option A ("only when more than one lane deferred the same gate") is recorded as rejected on determinism alongside option B and the "only when nothing else is in flight" option, each with its reason.
2. **Parent-contract lane-status writes** — confirmed orchestrator-side and safe; ordering not required either, because the writes are **disjoint cells of a pre-existing table**, which is order-independent.
3. **Reconciliation determinism** — re-established at the two observable surfaces (artifacts; `SUBJOIN` emission in lane-map row order at a single point), with execution order separated from observable order.
4. **`PARTIAL` routing** — recorded at 3s, taken at 3j after both waits.

**ADR-0013's own framing of question 1 recorded as narrower than the defect.** The ADR presented it as a *race between two lanes deferring the same gate*, which points at de-duplication or a lock. The real invalidator is definitional and bites with a **single** lane and a **single** gate: an unscopable gate reads outside the lane **by definition**, so containment proves nothing about it. That is what makes option B unsound rather than merely less convenient — it would have been unsound with only one lane deferring.

**The three hazards ADR-0013 does not name are recorded** in a new *"Three hazards this ADR did not name, resolved in the same change"* section, numbered 5–7 to continue the question list: Step 3j's second barrier (FR-8), the amendment loop's entry point moving to 3j so it cannot invalidate an in-flight leaf (FR-9), and `max_parallel_lanes` counting inner-join integration coders (FR-10). Each is stated as a race the barrier change would otherwise have shipped, which is why it landed in the same change.

**Stale cross-references corrected:**

- `docs/adr/0012-…` — the *"Not addressed here: `k × J` … See **ADR-0013**"* bullet now records ADR-0013 as **Accepted and implemented (2026-08-19)** and states what it did. The bullet's own historical claim is left standing as ADR-0012-era record.
- `docs/adr/0014-…` — the now-false *"Still `Proposed`"* claim removed; the true statement that ADR-0014 itself did not touch Step 3s's barrier discipline is kept verbatim, with the subsequent acceptance noted parenthetically as independent of it.

**SURFACED, NOT APPLIED — suggested `PROJECT-CONTEXT.md` Out-of-scope carve-out, for a human to accept.**

`.orchestrator/PROJECT-CONTEXT.md` → **Out of scope** currently reads *"Running language/build/test tooling against markdown doc skills (only `clean-code-gates` has a suite)."* That entry predates the Prime Agent distribution (commit `e2e635f`), after which `scripts/build-prime-agent.mjs` became the **mandatory, only-sanctioned** way to update `prime-agent/skills/**` — a hand edit there is a bug the next build overwrites and `--check` flags. Read literally, the entry forbids the one command the generated-tree contract requires.

Suggested amendment, for a human to accept — **not applied in this change** (`PROJECT-CONTEXT.md` is explicitly out of scope for this plan):

> - Running language/build/test tooling against markdown doc skills (only `clean-code-gates` has a suite). **Exception: `scripts/build-prime-agent.mjs` and `prime-agent/tests/parity.sh` are repo tooling that regenerates and guards the derived `prime-agent/skills/**` tree, not a test suite run against a doc skill. Any change under `plugins/my-skills/skills/**` must be followed by `node scripts/build-prime-agent.mjs` and must leave `--check` at exit 0.**

The builder was treated as **in scope** for this change on that reading, and the reading is recorded here rather than silently assumed.

**Phase 4 verification:**

| Gate | Result |
| --- | --- |
| `grep -qF '**Status:** Accepted' docs/adr/0013-…` | ✓ |
| `! grep -qF '**Status:** Proposed' docs/adr/0013-…` | ✓ |
| `! grep -qF 'Still \`Proposed\`' docs/adr/0014-…` | ✓ |
| `node scripts/build-prime-agent.mjs --check` | **exit 0** — proves the ADR edits touched no skill source (ADRs are not build inputs) |
| `cd prime-agent && npm test` | **exit 0** |
| `cd plugins/my-skills/skills/clean-code-gates && node --test` | **exit 0** — 213 passing / 0 failing |
| Full Phase 2 assertion set re-run | **all 27 green** |

### 2026-08-19T06:10:00Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: **103** (63 work tasks + 40 phase-verification assertions, across 4 phases).

Final state of every gate the plan names:

| Gate | Result |
| --- | --- |
| `node scripts/build-prime-agent.mjs --check` | exit **0** |
| `cd prime-agent && npm test` | exit **0** |
| Structural assertion set (25 plan rows + 2 strengthened) | **27 / 27 green** |
| Worked-example re-derivation | all **4** re-derived by hand and recorded |
| `cd plugins/my-skills/skills/clean-code-gates && node --test` | exit **0** — 213 passing / 0 failing (unchanged from baseline) |

Files changed (6): `plugins/my-skills/skills/orchestrator/SKILL.md`, `plugins/my-skills/skills/orchestrator/references/config.md`, `prime-agent/skills/orchestrator/SKILL.md` (generated), `prime-agent/skills/orchestrator/references/config.md` (generated), `docs/adr/0013-overlapped-inner-joins.md`, `docs/adr/0012-nested-parallelism-cost-model-corrections.md`, `docs/adr/0014-integration-slice-first-class-digest-field.md`.

Nothing committed, nothing pushed — the pipeline ends at READY_TO_COMMIT.

**Two items for the reviewer:**

1. **DEVIATION (Phase 2)** — spec FR-16's `M_nested` = **20** for the superseded serialized `k = 2` plan is arithmetically wrong; the spec's own expression yields **19**. Written as 19. No AC claim is weakened. Needs folding back into spec FR-16.
2. **SURFACED, NOT APPLIED (Phase 4)** — the suggested `PROJECT-CONTEXT.md` Out-of-scope carve-out for `scripts/build-prime-agent.mjs` / `prime-agent/tests/parity.sh` is recorded above for a human to accept.

---

## Handoff

| From      | To        | Condition                  | Action                                                            |
| --------- | --------- | -------------------------- | ----------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260819T035826Z-835a`           |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260819T035826Z-835a`        |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the CR file path`                          |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260819T035826Z-835a`              |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`                   |

### SIMPLIFY — 2026-08-19
Single-pass inline review over the plan's docs-only scope (two orchestrator markdown files plus three ADRs; the generated mirror is excluded and rebuilt). Stated as single-pass rather than the 5-angle fan-out because reuse and efficiency have no purchase on prose at this size — recorded so the pass is not read as the full fan-out. Fixed 1: Step 3s restated the containment proof and the per-lane-start definition verbatim from the two paragraphs immediately above it, in a SKILL.md that is loaded on every orchestrator invocation; the restatement was cut and every claim preserved. Skipped: the deliberate repetition of the serial-integration rule across Step 3s and Step 3j (each is normative at its own level, and the reviewer's two-level lens depends on both). Bugs: none. Gates re-run after the edit: 19/19 plan assertions, both near-miss overlay anchors still at 3, clean-code-gates 213/213, prime-agent npm test, build --check — all exit 0; distribution regenerated so the generated tree carries the edit.

### 2026-08-19T04:27:43Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T042313Z-1acb-adopt-overlapped-inner-joins.md
Status: PASS
Coverage: N/A% → N/A%
All e2e flows green. Coverage floor met.

Detail — the honest posture, stated rather than worked around: **no executable flow exists for this change; verification is structural and arithmetic.** `parallelism` defaults to `off` and a `full` run with k >= 2 is unreachable in this repo, so no e2e was written and no harness was scaffolded for the unreachable path. Coverage is N/A, not BELOW_FLOOR — the 70% floor is inapplicable by PROJECT-CONTEXT policy for doc-skill changes and no coverage was padded.

Verified by hand:
- All four worked examples re-derived from the model's own definitions. Gate (`c`) and ladder (`M_nested`) reconcile exactly on each. Both FR-16 reconciliations confirmed: Σ`c` = 4.5 + 0.5 = 5 = overhead delta (9 − 4); Σ`g` = 14 + 2 = 16 = span reduction (24 → 8). All remaining k=2 gates check out (leaves sum to T=38, largest leaf 21.1% <= 70%, interface points 4 <= 38, 6 leaves within the default ceiling of 6).
- Spec FR-16's serialized counterfactual `M_nested` = **20** is independently confirmed WRONG. The spec's own expression `8 + (A + A + 2J + J + I)` evaluates to 8+2+2+4+2+1 = **19**. Shipped text states 19 in expanded term-by-term form, phrased as `2 join passes(4)` so the forbidden `k × J` literal is not reintroduced. The figure's qualitative role survives intact (19 > 18.5, so the rejection was self-consistent then, exactly as at 20). Architect to fold 19 back into spec FR-16.
- Barrier half and charge half are mutually consistent at every site describing either — 9 barrier sites in SKILL.md, 7 charge sites across config.md and Step 2p.2. No site describes either half on the other's terms.
- All three spec-added hazards handled: (a) Step 3j's two explicit waits replace the unsupported "has already completed" assertion; (b) amendment loop recorded at 3s, entered at 3j in lane-map row order, with scoping unchanged and the shared budget consumed deterministically; (c) `max_parallel_lanes` counts inner-join integration coders at both sites, with a correct "tightens nothing previously allowed" backward-compat note.
- Determinism claim HOLDS as written at both claimed surfaces. Artifact writes: disjoint-cell writes to pre-existing rows are order-independent, and 3s.1's sole-writer sentence supplies the serialization ruling out lost updates. SUBJOIN order: buffering mechanism is explicit and off the critical path.
- Generated tree in sync (`--check` exit 0, 11 skills / 154 files; parity guard green). Both near-miss exact-count overlay anchors resolve at 3 in the source: `the call shape from *How to spawn a subagent*` (0 in the generated file — correct, the overlay replaces all three) and `:(exclude).claude` (3 in the generated file — correct, the overlay appends).
- ADR record correct: ADR-0013 Accepted and dated; ADR-0012 and ADR-0014 cross-references no longer assert Proposed.

No-regression floors (unrelated surface, reported as a floor and not as evidence about this change): clean-code-gates 213 pass / 0 fail; `cd prime-agent && npm test` exit 0 (install + parity); `node scripts/build-prime-agent.mjs --check` exit 0.

Carried to the reviewer — three surviving stale prose sites describing the deferred-gate discipline this change moved. All untouched, all propagated into the generated tree. Documentation-consistency defects, NOT races: Step 3s item 3 and Step 3j item 4 are explicit and mutually consistent, so no gate can be skipped. The risk is a future editor restoring the removed gate-run step at 3s.
1. `plugins/my-skills/skills/orchestrator/SKILL.md:958` — "A sub-lane never defers a gate all the way to the outer join when its own inner join can run it." Post-change the inner join can NEVER run one, so the guard is vacuously true while reading as a directive. In scope by FR-4's intent; same category as the ~L1462 guardrail gap the architect did catch. Highest of the three.
2. `plugins/my-skills/skills/orchestrator/references/config.md:437` — viability condition 4 names the wrong destination ("defers to the inner join"). Naming, not logic; notable because it sits in the file whose charge half was rewritten.
3. `plugins/my-skills/skills/orchestrator/templates/coder.md:153` — plan-declared out of scope and the coder's action is genuinely unchanged, but the explanatory clause is now false. Reviewer's judgement call.
Fixing 1 and 2 requires a rebuild of `prime-agent/skills/**`.

Advisory (not blocking, pre-existing): the run order of multiple distinct deferred gates at Step 3j item 4 is unpinned, so which of two failing gates blocks first is unspecified. Not a regression — 3j item 4 was equally unpinned before — but this change routes every deferred gate through that site rather than only the leftovers, enlarging the seam just as the surrounding text strengthens its determinism claim. One clause would close it (lane-map row order of the earliest lane that deferred each).

### 2026-08-19T04:35:06Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T043042Z-a7b9-adopt-overlapped-inner-joins.md
Status: REQUEST_CHANGES
Must Fix: 1 | Should Fix: 4

Independently verified, not taken on report: all four worked examples re-derived by hand (the three
existing ones unchanged; the new k = 2 example correct on every figure and both reconciliations);
the corrected counterfactual 19 confirmed right and the spec's 20 confirmed an arithmetic slip;
all three ADR-0013-adjacent hazards (3j's second barrier, amendment-loop entry point,
max_parallel_lanes counting integration coders) handled in the shipped text; the determinism
argument holds as written and is correctly scoped; build --check 0, prime-agent npm test green,
clean-code-gates 213/0, both overlay anchors still 3. The hard constraint held — barrier half and
charge half are in one working state.

MF-1: SKILL.md:958 still directs a sub-lane's deferred gate to the inner join as a run site
("when its own inner join can run it"), contradicting AC-7's single-run-site requirement.
SF-1: references/config.md:437 viability condition 4 names the wrong destination.
SF-2: templates/coder.md:153 explanatory clause now false (plan-declared out of scope — needs an
architect scope amendment; the coder correctly honoured the boundary).
SF-3: deferred-gate run order at Step 3j item 4 is unpinned; pre-existing but enlarged by this change.
SF-4: fold the 19 correction back into spec FR-16 and the plan's Phase-2 task text.

MF-1, SF-1, and SF-2 all require a prime-agent/skills/** rebuild — bundle them in one phase.
Invoke /architect with plans/code-review/CR-20260819T043042Z-a7b9-adopt-overlapped-inner-joins.md to create FIX plan.
