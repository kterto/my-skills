# Progress: FIX-20260819T043728Z-13ae — Correct the surviving inner-join run-site prose and fold back the corrected counterfactual

**Plan**: [FIX-20260819T043728Z-13ae-inner-join-run-site-prose.md](./FIX-20260819T043728Z-13ae-inner-join-run-site-prose.md)
**Status**: QA_READY_TO_COMMIT
**Created**: 2026-08-19T04:40:21Z

---

## Log

### 2026-08-19T04:40:21Z | ARCHITECT

Created plan `FIX-20260819T043728Z-13ae`. Type: fix. Tasks: 29 work tasks across 4 phases (plus 40 verification checklist rows).

Source CR: `CR-20260819T043042Z-a7b9` — REQUEST_CHANGES, 1 Must Fix, 4 Should Fix, against `FEAT-20260819T035826Z-835a`.

Disposition of every CR finding:

| Finding | Disposition | Phase |
| --- | --- | --- |
| MF-1 — `SKILL.md:958` names the inner join as a deferred-gate run site | In scope, blocker | 2 |
| SF-1 — `references/config.md:437` condition 4 stops one hop short | In scope, mandatory | 2 |
| SF-2 — `templates/coder.md:153` explanatory clauses now false | In scope via explicit scope amendment, mandatory; coder's **action** unchanged | 2 |
| SF-3 — deferred-gate run order at Step 3j item 4 unpinned | **Architect ruling: in scope, non-optional** — one clause in the same file, rides the same rebuild; the change itself enlarged the seam | 2 |
| SF-4 — fold `19` (not 20) back into spec FR-16 and the FEAT plan | In scope, docs-only, no rebuild | 4 |

Scope amendment recorded: the FEAT plan's out-of-scope entry *"No edit to `templates/*.md`"* justified itself on *"the coder's defer-a-gate instruction is unchanged"*. That is true of the instruction and false of the two explanatory clauses around it, so the surrounding explanation is re-scoped **in**. No action the coder takes changes.

Deviation from the default Should-Fix treatment, stated deliberately: nothing in this plan is `(optional)`. A phase landing three of the four sites reproduces the exact class of defect the CR found — one site telling the truth while its neighbour does not.

Discrepancy surfaced, not worked around: the orchestrator's brief cites **19** assertion rows in the FEAT plan's Phase-2 set; that checklist as written carries **26** (21 grep assertions, 2 exact-count anchors, 1 hand-re-derivation, 2 command rows). All 26 are re-run in Phase 3. One of them — `--check` exits **non-zero** — is a mid-phase assertion about a stale tree, not a steady-state property; it holds at the end of this plan's Phase 2 (three-file drift set) and is superseded by `--check` exit **0** after Phase 3.

Constraints carried into the plan:
- `prime-agent/skills/**` is generated; regeneration only, never a hand edit; `--check` must exit 0 at the end.
- `templates/coder.md` is a build input, so the expected Phase-2 drift set is **three** files, not two.
- Both near-miss exact-count overlay anchors (`the call shape from *How to spawn a subagent*` = 3, `:(exclude).claude` = 3) plus `through a **single sequential coder invocation**` (= 2) are censused in Phase 1 and re-asserted in Phases 2–4.
- No-regression floors: `clean-code-gates` 213 passing, `cd prime-agent && npm test`, `node scripts/build-prime-agent.mjs --check`.
- Docs-only change; `parallelism` is `off` here and a `full` run with `k ≥ 2` is unreachable, so verification is structural + arithmetic. No behavioural test is planned, deliberately.

### 2026-08-19T04:46:10Z | CODER

Session started. Plan status → IN_PROGRESS.

---

### 2026-08-19T04:52:00Z | CODER — Phase 1 (red baseline and anchor census)

#### Verbatim text of the four target sites, before any edit

**1. `SKILL.md` L958 — lane preamble (MF-1):**

> **Path-scoped gates defer to the nearest enclosing join** — the **inner** join for a sub-lane, the **outer** join for an unsplit lane. A sub-lane never defers a gate all the way to the outer join when its own inner join can run it.

**2. `references/config.md` L437 — per-sub-lane viability condition 4 (SF-1):**

> 4. the project's gate commands from `PROJECT-CONTEXT.md` → **Commands** can be **scoped to a sub-lane's paths** — otherwise that gate defers to the inner join;

**3. `templates/coder.md` L153 — the defer paragraph (SF-2):**

> If a gate has **no path-scoped form** in `PROJECT-CONTEXT.md` → Commands, **defer it to the nearest enclosing join** instead of running it concurrently — the **inner** join if you are a sub-lane, the **outer** join if you are an unsplit lane. Note the deferral in `.progress.md` and proceed; that join runs it once over its own scope. Deferring is the correct outcome here, not a failure. A sub-lane never defers a gate past its own inner join when that join can run it.

**4. `SKILL.md` L1063 — Step 3j item 4 opening (SF-3's target):**

> 4. **Run every deferred gate — mandatory, blocking, and the single place any of them runs.** This is the **only** site at which a deferred gate executes, at either depth: Step 3s collects and records its lane's deferrals but runs none of them (Step 3s item 3). So this step collects the deferrals recorded by every **unsplit** lane's coder **and** every deferral each inner join recorded, **de-duplicates them across the whole run**, and runs each **once over the union**. …

#### Red baseline — assertion-by-assertion (18 greppable Phase-2 rows)

| Row | AC | Assertion | Baseline |
| --- | --- | --- | --- |
| A1 | AC-2 | no `when its own inner join can run it` in `$SK` | **RED** |
| A2 | AC-1 | lane preamble names `record` **and** `Step 3j item 4` | **RED** |
| A3 | AC-3 | lane preamble carries a never-drops phrasing | **RED** |
| A4 | AC-1 | `ADR-0013` in `$SK` **and** cited in the preamble paragraph | **RED** (file-level holds; paragraph-level does not) |
| A5 | AC-4 | cond-4 line has `records it for the outer join` **and** `Step 3j item 4` | **RED** |
| A6 | AC-4 | `ADR-0013` on that same `$CFG` condition line | **RED** |
| A7 | AC-6 | no `that join runs it once over its own scope` in `$CODER` | **RED** |
| A8 | AC-6 | no `when that join can run it` in `$CODER` | **RED** |
| A9 | AC-5 | `Note the deferral in ``.progress.md`` and proceed` present | GREEN (must survive) |
| A10 | AC-5 | `Deferring is the correct outcome here, not a failure` present | GREEN (must survive) |
| A11 | AC-6 | `$CODER` names `Step 3j item 4` | **RED** |
| A12 | AC-8 | `$SK` pins `lane-map row order of first deferral` | **RED** |
| A13 | AC-8 | 3j item 4 keeps `de-duplicates them across the whole run` + `lane(s) that deferred` | GREEN (out-of-scope guard) |
| A14 | guard | Step 3s still runs no deferred gates | GREEN (parent-plan invariant) |
| A15 | AC-9 | no literal `k × J` / `k×J` in the three source files | GREEN (must stay) |
| A16 | AC-10 | `the call shape from *How to spawn a subagent*` = 3 | GREEN (anchor) |
| A17 | AC-10 | `:(exclude).claude` = 3 | GREEN (anchor) |
| A18 | AC-10 | `through a **single sequential coder invocation**` = 2 | GREEN (anchor) |

**10 red / 8 green.** The red set is non-empty, and the classification is clean: **every** assertion whose subject this change rewrites (A1–A8, A11, A12) is currently failing. The 8 green rows are all either *survival* rows (A9, A10 — text that must be preserved verbatim), *out-of-scope guards* (A13, A14), the forbidden-literal guard (A15), or the exact-count overlay anchors (A16–A18). None of them is an assertion this change is supposed to turn from red to green, so no target text is misplaced and the CR's site locations are confirmed.

#### Anchor census (before any edit)

- `the call shape from *How to spawn a subagent*` → **3** (expected 3) ✓
- `:(exclude).claude` → **3** (expected 3) ✓
- `through a **single sequential coder invocation**` → **2** (expected 2) ✓

#### Deviation surfaced, not worked around — the `git status --porcelain prime-agent/skills/` baseline row

The plan's Phase-1 task and AC-11 both assert `git status --porcelain prime-agent/skills/` is **empty** as the clean starting point. **It is not empty**, and it could not have been:

```
 M prime-agent/skills/orchestrator/SKILL.md
 M prime-agent/skills/orchestrator/references/config.md
```

Those two entries are the **parent FEAT plan's own Phase-3 regeneration output, still uncommitted** — `FEAT-20260819T035826Z-835a` ran `node scripts/build-prime-agent.mjs` and the pipeline invariant (*never commit, never push — stop at READY_TO_COMMIT*) means that output necessarily sits in the working tree. `git diff --stat prime-agent/` confirms the diff is confined to exactly those two files (110 insertions, 28 deletions) and nothing else.

The assertion is therefore **unsatisfiable by construction** in this pipeline, not violated by anything this session did. Its *purpose* — *nothing under the generated tree was hand-edited* — is served in full, and more strongly, by two checks that **do** hold:

1. `node scripts/build-prime-agent.mjs --check` exits **0** — proof that the generated tree matches its sources byte-for-byte, which is exactly the property "no hand edit" is trying to establish. A hand edit would show here as drift.
2. A recorded pre-edit content hash of the whole generated tree, used as the operative no-hand-edit test at the start of Phase 3 (it is strictly stronger than porcelain-emptiness, because it is insensitive to the uncommitted parent baseline):

```
find prime-agent/skills -type f | sort | xargs shasum -a 256 | shasum -a 256
c2998413184c6e4a396e5f311d5ce1192acb0e1be5b974ab0e53ddde23e9ac0d  -
```

This is recorded as a **re-reading of a state-dependent row**, in the same spirit the plan already applies to the `--check`-exits-non-zero row, and it is surfaced here for the reviewer rather than being silently absorbed. No source was rewritten to make anything pass.

#### Phase 1 verification checklist

- [x] `node scripts/build-prime-agent.mjs --check` exits **0** — output: `prime-agent/skills is up to date (11 skills, 154 files)`
- [x] `git status --porcelain prime-agent/skills/` — **re-read per the deviation above**; the substitute checks (`--check` exit 0 + recorded tree hash) both hold
- [x] The three anchor counts are **3 / 3 / 2**
- [x] The red assertion log is written above, one line per assertion
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits **0**, `# pass 213 / # fail 0`

Phase 1 complete. 6 tasks checked. No source file edited in this phase, by design.
### 2026-08-19T04:58:00Z | CODER — Phase 2, scope amendment recorded before editing `templates/coder.md` [AC-7]

The parent plan `FEAT-20260819T035826Z-835a` carries the out-of-scope entry:

> **No edit to `templates/*.md`** — the coder's defer-a-gate instruction is unchanged.

**That entry is amended by this plan, and the amendment is narrow.** Its justification is true of the *instruction* and false of the *explanation wrapped around it*. In `templates/coder.md` L153 the instruction proper — *defer a gate with no path-scoped form to the nearest enclosing join, note the deferral in `.progress.md`, proceed, and treat deferring as the correct outcome rather than a failure* — is indeed unchanged by ADR-0013, and this plan does not change it. But the same paragraph also carried two **explanatory** clauses that ADR-0013 falsified:

1. `that join runs it once over its own scope` — false: after ADR-0013 the inner join runs no deferred gate at all (Step 3s item 3); it records and passes outward.
2. `A sub-lane never defers a gate past its own inner join when that join can run it.` — vacuous: there is no longer any case it selects, because the inner join can run none of them.

So the surrounding **explanation** is re-scoped **in**; the **action** stays out of scope and stays byte-identical. This is recorded here, before the edit, exactly as the plan's task ordering requires, so the amendment is auditable rather than implicit in a diff.

### 2026-08-19T05:04:00Z | CODER — Phase 2 complete (all four prose sites, one working state)

All four sites landed together, as the plan mandates. No sub-phasing, no partial landing.

#### The edits

**MF-1 — `SKILL.md` L958 (lane preamble), rewritten:**

> **Path-scoped gates defer to the nearest enclosing join, which *records* the deferral rather than running the gate** — the **inner** join for a sub-lane, the **outer** join for an unsplit lane. A sub-lane's inner join records its sub-lanes' deferrals and passes them outward (Step 3s item 3); **every deferred gate runs at the outer join** — Step 3j item 4, the single de-duplicated run site, and the first point at which nothing else is in flight (ADR-0013). Deferral therefore only ever moves a gate **outward** to a wider scope; it never drops one, at any depth.

The two hops are now named separately (recorded at the nearest enclosing join, run at Step 3j item 4), the vacuous clause is **deleted outright** rather than softened, and the deferral-moves-outward-never-drops guarantee **survives in the paragraph's own words** — the true half was not spent paying for the false half's removal [AC-1, AC-2, AC-3].

**SF-1 — `references/config.md` L437, viability condition 4, extended:**

> 4. … can be **scoped to a sub-lane's paths** — otherwise that gate defers to the inner join, which records it for the outer join rather than running it (`SKILL.md` → Step 3j item 4 is the single run site for every deferred gate, at either depth; ADR-0013);

The condition's own test (*can be scoped to a sub-lane's paths*) is **textually unchanged** — it was never wrong. What was added is the second hop plus a **citation**, not a second normative formulation of the rule [AC-4].

**SF-2 — `templates/coder.md` L153, the two false explanatory clauses only:**

> … Note the deferral in `.progress.md` and proceed; that join **records** the deferral rather than running the gate, and passes it outward — every deferred gate runs once, at the **outer** join (`SKILL.md` → Step 3j item 4), the first point at which nothing else is in flight. Deferring is the correct outcome here, not a failure.

`that join runs it once over its own scope` → replaced by the true destination. The trailing sentence `A sub-lane never defers a gate past its own inner join when that join can run it.` → deleted. **No action the coder takes changed**: it still defers a gate with no path-scoped form to the nearest enclosing join, still notes the deferral in `.progress.md`, still proceeds, and deferring is still stated to be the correct outcome rather than a failure [AC-5, AC-6, AC-7].

**SF-3 — `SKILL.md` Step 3j item 4, one ordering clause added:**

> **The de-duplicated set runs in lane-map row order of first deferral**, ties broken by the gate's command string — never analysis order and never completion order, so two runs over the same contract execute the same gates in the same sequence.

Phrased in the style Step 3s already uses to pin `SUBJOIN` emission (*never analysis order and never completion order*), and **placed after** the de-duplication rule and union scope so both read unchanged. Item 4's blocking non-zero exit, `PARTIAL` routing, and `JOIN — deferred gate failed` block are untouched [AC-8].

#### Cross-site consistency re-read (the check that would have caught the original defect)

All four passages re-read against Step 3s item 3 and Step 3j item 4. No site states a rule another contradicts:

| Site | Recording hop | Run site | Restates the rule? |
| --- | --- | --- | --- |
| Step 3s item 3 (normative) | inner join records for the outer join | Step 3j item 4 | **owns** the rule |
| `SKILL.md` preamble (MF-1) | nearest enclosing join | Step 3j item 4 | cites |
| `config.md` cond 4 (SF-1) | inner join records for the outer join | Step 3j item 4 | cites |
| `coder.md` (SF-2) | nearest enclosing join records, passes outward | Step 3j item 4 | cites |
| Step 3j item 4 (SF-3) | — | itself; order now pinned | **owns** the rule |

Single-source-of-truth is preserved: the two normative statements live in `SKILL.md` Steps 3s/3j, and the other three sites **cite** them rather than restating them as parallel formulations — which is also what stops them drifting apart again. The unsplit-lane case is consistent, not a special case: there the nearest enclosing join *is* the outer join, so recording and running coincide in the same join at different steps (3j item 4 explicitly collects "the deferrals recorded by every **unsplit** lane's coder").

#### Phase 2 verification checklist — 21 rows, all green

Structural rows A1–A18 (`SK`/`CFG`/`CODER`): **18 pass / 0 fail**, up from the 10-red baseline. Every red row flipped green; every green-throughout invariant held.

- [x] A1 `! grep -qF 'when its own inner join can run it' "$SK"` [AC-2]
- [x] A2 preamble names `record` **and** `Step 3j item 4` [AC-1]
- [x] A3 preamble matches `never drops` [AC-3]
- [x] A4 `ADR-0013` in `$SK` and cited in the rewritten preamble [AC-1]
- [x] A5 cond-4 line has `records it for the outer join` **and** `Step 3j item 4` [AC-4]
- [x] A6 `ADR-0013` on that condition's line [AC-4]
- [x] A7 `! grep -qF 'that join runs it once over its own scope' "$CODER"` [AC-6]
- [x] A8 `! grep -qF 'when that join can run it' "$CODER"` [AC-6]
- [x] A9 ``grep -qF 'Note the deferral in `.progress.md` and proceed' "$CODER"`` — coder action verbatim [AC-5]
- [x] A10 `Deferring is the correct outcome here, not a failure` unchanged [AC-5]
- [x] A11 `grep -qF 'Step 3j item 4' "$CODER"` [AC-6]
- [x] A12 `grep -qF 'lane-map row order of first deferral' "$SK"` [AC-8]
- [x] A13 3j item 4 still matches `de-duplicates them across the whole run` + `lane(s) that deferred` [AC-8]
- [x] A14 `! grep -qF "Run every gate this lane's sub-lanes deferred" "$SK"` — parent-plan invariant intact
- [x] A15 `! grep -qE 'k × J|k×J'` across all three source files [AC-9]
- [x] A16 `the call shape from *How to spawn a subagent*` = **3** [AC-10]
- [x] A17 `:(exclude).claude` = **3** [AC-10]
- [x] A18 `through a **single sequential coder invocation**` = **2** [AC-10]

Command rows:

- [x] `node scripts/build-prime-agent.mjs --check` exits **1** (non-zero, as designed at this point), reporting **exactly three** stale files and **no other drift line**:

```
stale:   prime-agent/skills/orchestrator/SKILL.md
stale:   prime-agent/skills/orchestrator/references/config.md
stale:   prime-agent/skills/orchestrator/templates/coder.md

3 file(s) out of date.
```

  This is the bounded blast radius the plan predicts, and it confirms the Technical Note that `templates/coder.md` **is** a build input — the drift set is three files, not two. Not "fixed" by regenerating early; Phase 3 owns that.

- [x] No hand edit under `prime-agent/skills/**` [AC-11] — verified by the recorded tree hash, unchanged from the Phase-1 baseline:
  `c2998413184c6e4a396e5f311d5ce1192acb0e1be5b974ab0e53ddde23e9ac0d` (see the Phase-1 deviation note for why this substitutes for the porcelain-empty form).
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` → exit **0**, `# pass 213 / # fail 0` [AC-14]

Phase 2 complete. 11 tasks checked.

### 2026-08-19T05:12:00Z | CODER — Phase 3 complete (regeneration + parent-plan regression set)

#### No hand edit, then regenerate [AC-11]

Pre-build tree hash re-confirmed **identical** to the Phase-1 baseline — nothing under `prime-agent/skills/**` was touched by hand during Phase 2:

```
c2998413184c6e4a396e5f311d5ce1192acb0e1be5b974ab0e53ddde23e9ac0d  -
```

`node scripts/build-prime-agent.mjs` → exit 0, `wrote prime-agent/skills with 11 skills (154 files)`.

#### The regenerated diff is confined to the three source-edited files

`git diff --stat prime-agent/` after the build shows exactly three files, and the third is new to this plan (the parent plan's uncommitted baseline held the first two):

```
prime-agent/skills/orchestrator/SKILL.md           | 61 +++++++++++-----
prime-agent/skills/orchestrator/references/config.md | 81 ++++++++++++++++++----
prime-agent/skills/orchestrator/templates/coder.md |  2 +-
```

Hunk-for-hunk correspondence verified rather than assumed. `templates/coder.md`'s generated diff is a **single line**, byte-identical to the source edit — the overlay rewrote nothing there. For all four edited passages the occurrence count matches between source and generated tree:

| Passage | source | generated |
| --- | --- | --- |
| MF-1 `which *records* the deferral rather than running the gate` | 1 | 1 |
| MF-1 `it never drops one, at any depth.` | 1 | 1 |
| MF-1 vacuous clause `when its own inner join can run it` | **0** | **0** |
| SF-1 `records it for the outer join rather than running it` | 1 | 1 |
| SF-3 `The de-duplicated set runs in lane-map row order of first deferral` | 1 | 1 |

`k × J` / `k×J`: **no hits** anywhere under `prime-agent/skills/orchestrator/` — the overlay did not reintroduce the superseded charge.

**Anchor note, resolved rather than flagged.** In the *generated* `SKILL.md`, `the call shape from *How to spawn a subagent*` counts **0**, not 3. That is correct and expected: `prime-agent/overlays/orchestrator.json` `replacements[10].find` targets that exact string and rewrites it, so the anchor is *consumed* by the build. The exact-count contract is enforced on the **source** side (3, asserted green) and validated by the builder itself — a wrong count raises an exact-count overlay error and fails the build. Build exit 0 plus `--check` exit 0 is that proof. `:(exclude).claude` remains **3** in the generated tree (`replacements[0]` appends `:(exclude).prime` beside it rather than replacing it), and `through a **single sequential coder invocation**` remains **2**.

#### Parent FEAT plan's Phase-2 assertion set — all 26 rows re-run

**Rows 1–23 (greppable): 23 pass / 0 fail.** Every row green on the edited source tree — including row 10 (`! grep -qF "Run every gate this lane's sub-lanes deferred"`), row 12 (`lane(s) that deferred`), row 14 (`emitted in lane-map row order`) and row 21 (`through a **single sequential coder invocation**`), which are the rows most exposed to this plan's edits.

**Row 24 — hand re-derivation of all four worked examples + both FR-16 reconciliations. Green.**

| Example | span_max | overhead | makespan | g | c | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 — `{12,6}`, 12→`{6,6}` | `max(6,6)` = 6 | `A+A+J+J` = 8 | 14 vs `M_flat` 16 | 12−6 = **6** | 8−4 = **4** | adopted (6 > 4) ✓ |
| 2 — one lane 24→`{8,8,8}` | `max(8,8,8)+0` = 8 | `A+A+J+J+I(2×0.25)` = 8.5 | 16.5 vs `M_seq` 24 | 24−8 = **16** | 8.5−0 = **8.5** | adopted ✓ (leaves 3 ≥ 2; 8/24 = 33% ≤ 70%) |
| 2b — counterfactual `{20,4}` | 20 | 8.5 | — | **4** | **8.5** | rejected ✓ |
| 3 — 24 → 5 concurrent (max 5) + integration 6 | 5+6 = 11 | `A+A+J+J+I(8×0.25=2)` = 10 | 21 vs `M_seq` 24 | 24−11 = **13** | **10** | adopted, margin 3 ✓ (aggregate 8 ≤ T = 24 ✓) |
| 4 — `k = 2`, `{A:24,B:10,C:4}`, T = 38 | see below | see below | see below | see below | see below | both adopted ✓ |

Example 4 in full: flat viable (3 lanes carry work; 24/38 = 63% ≤ 70%); `span_base` = 24, flat overhead `A+J+I(0×0.25=0)` = 4, `M_flat` = **28**.
- **Adoption 1** (`A`→`{8,8,8}`): `span_max` = `max(8,10,4)` = **10**; accumulated overhead `A+A+J+J+I(2×0.25=0.5)` = **8.5**; `M_nested` = **18.5**. `g₁` = 24−10 = **14**; `c₁` = `A(2)+J(2)+I(0.5)` = **4.5**; 14 > 4.5 → adopted ✓
- **Adoption 2** (`B`=10→`{5,5}`): `span_max` = `max(8,5,4)` = **8**; accumulated overhead `A+A+J+J+I(4×0.25=1.0)` = **9**; `M_nested` = **17**. `g₂` = 10−8 = **2**; `c₂` = `I(2×0.25=0.5)` = **0.5** — no `A` (Step 2s level exists, architects concurrent) and **no `J`** (Step 3s level exists, joins now overlap); 2 > 0.5 → adopted ✓

**Both FR-16 reconciliations hold:** Σ`c` = 4.5 + 0.5 = **5** = accumulated-overhead delta (9 − 4 = **5**) ✓; Σ`g` = 14 + 2 = **16** = total span reduction (24 − 8 = **16**) ✓.

**Row 25 — `--check` exits non-zero, re-read per this plan's Technical Notes.** As a mid-phase assertion about a stale tree it **held at the end of this plan's Phase 2** (exit 1, exactly three stale files, no other drift line). It is now **superseded** by its steady-state successor: after this phase's regeneration `--check` exits **0**. Asserted in that order; the two are sequential states of the same tree, not a contradiction.

**Row 26 — `clean-code-gates` floor.** Exit 0, 213 passing (re-run below).

**All 26 rows green.**

#### Phase 3 verification checklist

- [x] `node scripts/build-prime-agent.mjs --check` exits **0** — `prime-agent/skills is up to date (11 skills, 154 files)` [AC-11]
- [x] `cd prime-agent && npm test` exits **0** — `install ok: preflight, containment, all-or-nothing install, and mid-loop rollback verified` / `parity ok: prime-agent/skills is generated, in sync, and guarded` [AC-12]
- [x] Exact-count anchors consistent with the build; **no exact-count overlay error raised** (build exit 0, `--check` exit 0) [AC-10]
- [x] All **26** rows of the parent FEAT plan's Phase-2 set green, with the one state-dependent row re-read as documented [AC-13]
- [x] Every Phase-2 assertion row still holds after regeneration — structural set re-run: **18 pass / 0 fail** [AC-1 – AC-10]
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits **0** with 213 passing [AC-14]

Phase 3 complete. 5 tasks checked.

### 2026-08-19T05:22:00Z | CODER — Phase 4 complete (SF-4 fold-back, docs-only)

#### Hand re-derivation of the counterfactual [AC-15]

`span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)`
= `8 + 2 + 2 + 4 + 2 + 1` = **19**

19 > 18.5, so the serialized machine's rejection of adoption 2 was self-consistent with its own ladder. The qualitative role of the counterfactual is intact [AC-16].

#### The shipped worked example was always right [AC-17]

`references/config.md`'s `k = 2` example already carries **19**, verbatim:

> the serialized plan's own `M_nested` would have been `span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1)` = **19**

**No figure in it moved in this phase** — the fold-back moves the upstream artifacts to the shipped example, never the reverse. `M_nested` **17** and `M_flat` **28** confirmed intact.

> **Notation note for the reviewer.** The shipped example writes the interface term as `I(4×0.25=1)`; AC-15 specifies the upstream form as `I(4×0.25=1.0)`. I wrote `1.0` in the spec and FEAT plan exactly as AC-15 dictates, and left the shipped `1` untouched exactly as AC-17 dictates. Same quantity, and both ACs are satisfied as written; flagging the cosmetic divergence rather than unilaterally harmonizing it, since AC-17 forbids touching the shipped example.

#### Spec FR-16 corrected

`20` → `19`, in expanded term-by-term form so the figure is self-checking, with `2 join passes` preserved (never the banned expansion). The old string `` `8 + (A + A + 2J + J + I)` = **20** `` no longer occurs.

#### Correction logged in the spec [AC-16]

The spec had no dedicated log region, so a **`## Corrections`** section was added immediately before `## References` — the spec's natural post-hoc record position. It names this FIX plan (`FIX-20260819T043728Z-13ae`) and the CR (`CR-20260819T043042Z-a7b9`), records that **the shipped example was always 19**, and states the diagnosis precisely: **the slip was in the stated total, not in the expression** — `8 + (A + A + 2J + J + I)` evaluates to `8+2+2+4+2+1` = 19 under the spec's own defaults, so only the number printed after the `=` was ever wrong.

#### FEAT plan corrected — figure only, verified by reconstruction

`20` → `19` with the same expanded form, in the Phase-2 task at L142. **Nothing else moved**, proven rather than asserted: the pre-edit file was reconstructed by reversing the replacement and diffed against the current file.

- Exactly **one line** differs (L142)
- That line is still `- [x]` — the checkbox did not flip
- `- [x]` count **103**, identical in both; `- [ ]` count **0**
- Frontmatter byte-identical; `status: DONE` intact

#### Two verification rows re-read, and why — surfaced, not absorbed

Both Phase-4 rows below are phrased absolutely but serve delta-shaped ACs, and both are unsatisfiable in their literal form for reasons that predate this session:

1. **`! grep -qE 'k × J|k×J'` over the spec and the FEAT plan.** Both artifacts contain that literal **15 lines each**, and always did — they are pipeline documents *about removing it from the skill files*, so the string is their subject vocabulary. The parent plan's own AC-1 (its L26) scopes the ban to `SKILL.md`, `references/config.md`, and the generated Prime copies — **not** to `plans/`. Deleting the 30 occurrences would destroy the parent plan's own acceptance-criterion text. AC-9's operative wording is *"no literal … is **introduced**"*, so the correct test is a **delta**: lines-with-hit measured **15 / 15 before and 15 / 15 after** — nothing introduced. (An earlier count in this session read 23/22 because it counted *occurrences* rather than *lines*; both metrics are unchanged by the edits.) The ban **does** hold absolutely where it is meant to — `$SK`, `$CFG`, `$CODER`, and the whole generated tree — all asserted clean.

2. **`git diff --stat plans/feat/` shows only the figure changed.** The FEAT plan is **untracked** (`?? plans/feat/FEAT-20260819T035826Z-835a-…`) — created by this pipeline run and never committed, per the never-commit invariant — so `git diff` over it is empty by construction and can prove nothing either way. The reconstruction diff above is the operative substitute and is **strictly stronger**: it compares against the exact pre-edit content rather than a commit that does not exist.

#### Phase 4 verification checklist

- [x] No forbidden literal introduced in either artifact — **15 / 15 lines-with-hit, unchanged** (re-read per the note above) [AC-9]
- [x] `` `8 + (A + A + 2J + J + I)` = **20** `` gone; no `**20**` remains as the counterfactual total in either artifact [AC-15]
- [x] Both artifacts state **19** in expanded term-by-term form [AC-15]
- [x] `FIX-20260819T043728Z-13ae` present in the spec — correction traceable [AC-16]
- [x] FEAT plan: only the counterfactual figure changed — no checkbox, no `status:`, no other line (reconstruction diff; `git diff` row re-read per the note above) [AC-15]
- [x] `node scripts/build-prime-agent.mjs --check` still exits **0** — nothing under `plugins/` or `prime-agent/` moved in this phase [AC-11]
- [x] Full Phase-2 structural set re-run: **18 pass / 0 fail** [AC-1 – AC-10]
- [x] Parent FEAT 26-row set re-run: rows 1–23 **23 pass / 0 fail**, row 24 hand-derived green, row 25 superseded by `--check` exit 0, row 26 green [AC-13]
- [x] `cd prime-agent && npm test` exits **0** [AC-12]
- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits **0**, `# pass 213 / # fail 0` [AC-14]

Phase 4 complete. 7 tasks checked.

---

### 2026-08-19T05:24:00Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: **29 work tasks** across 4 phases (6 + 11 + 5 + 7), plus all **40** verification checklist rows — 69 checkboxes, 0 left unchecked.

All 17 acceptance criteria satisfied. Three verification rows were **re-read rather than silently passed**, each surfaced above with its substitute check and its reason: the `prime-agent/skills/` porcelain-empty row (Phase 1/2), the `k × J` absolute-grep row over `plans/` (Phase 4), and the `git diff --stat plans/feat/` row (Phase 4). All three are artifacts of the never-commit pipeline invariant or of a doc's own subject vocabulary; in each case the AC's substance was verified by a stronger, state-independent check. **No source text was rewritten to make any assertion pass.**

Ready for reviewer.

---

### 2026-08-19T05:01:33Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T045602Z-221d-inner-join-run-site-prose.md
Status: APPROVED
Must Fix: 0 | Should Fix: 3
Ready for QA — invoke /qa with plan ID FIX-20260819T043728Z-13ae.

Cycle-1 MF-1 confirmed closed: the vacuous clause is deleted outright (0 occurrences, source and generated), the never-drops guarantee survives in the paragraph's own words, and the recording hop and the run site are named separately at all three prose sites. SF-1 (config.md condition 4, both hops + citation, own test unchanged), SF-2 (coder.md — action verified unchanged verbatim, only the two false clauses moved), SF-3 (Step 3j item 4 ordering clause in Step 3s's style, deterministic under overlap) and SF-4 (19 folded into spec FR-16 + FEAT Phase-2 text, new `## Corrections` section) all closed.

Verification re-run independently rather than read off the coder's log: all 21 grep-shaped rows of the parent plan's Phase-2 set green; this plan's full assertion set green on source and generated tree; anchors 3 / 3 / 2; `--check` exit 0; `prime-agent` npm test exit 0; `clean-code-gates` 213/0; SF-4 arithmetic re-derived (19) with both FR-16 reconciliations re-checked; cross-site sweep for a fourth inner-join/deferral site found none.

All three verification-row substitutions ruled **correct**, each premise verified independently — porcelain non-empty today (uncommitted parent regeneration under the never-commit invariant), 15/15 banned-literal occurrences in the spec and FEAT plan, FEAT plan untracked so `git diff` would have passed vacuously. In every case the substitute is the stronger check. Skipped tester re-run ruled the **right call** for a docs-only change with no executable path, conditional on the reviewer re-running the floors independently — which this cycle did.

Three non-blocking warnings, all pre-existing or inherited from AC wording, all one-clause prose edits needing a rebuild: SF-1 (`SKILL.md:958` opens "Path-scoped gates defer", inverting the criterion stated at :947 and :989), SF-2 ("records rather than running" bound to "the nearest enclosing join" generically, false of the outer join it names — same imprecision as AC-1's own text, present in both `SKILL.md:958` and `coder.md:153`), SF-3 (`config.md:391` writes `I(4×0.25=1)` where `:386` writes `1.0`, five lines apart in the same example — the divergence the orchestrator raised is inside the shipped file, not between shipped and upstream, so L391 should move to `1.0`).

---

## Handoff

| From      | To        | Condition                  | Action                                                          |
| --------- | --------- | -------------------------- | --------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260819T043728Z-13ae`          |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260819T043728Z-13ae`       |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`                    |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260819T043728Z-13ae`             |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`                 |

### 2026-08-19T05:04:19Z | QA

Precondition check: Plan FIX-20260819T043728Z-13ae status=DONE, CR=CR-20260819T045602Z-221d CR status=APPROVED. Proceeding.

### 2026-08-19T05:04:19Z | QA

Ran: node scripts/build-prime-agent.mjs --check
Result: PASS — "prime-agent/skills is up to date (11 skills, 154 files)", exit 0. Generated tree byte-identical to builder output from source; strong form of the never-hand-edited claim.

Ran: cd plugins/my-skills/skills/clean-code-gates && npm test
Result: PASS — Total: 213 | Passed: 213 | Failed: 0 | Skipped: 0. No-regression floor, unrelated surface, never applied to the edited markdown.

Ran: cd prime-agent && npm test (install.sh + parity.sh)
Result: PASS — install ok (preflight, containment, all-or-nothing, mid-loop rollback); parity ok. Exit 0. No-regression floor, unrelated surface.

Ran: structural assertion set over $SK / $CFG / $CODER + generated tree (23 rows)
Result: PASS — 23/23. Includes the 3 overlay exact-count anchors at 3 / 3 / 2, the parent-plan regression guard (Step 3s runs no deferred gates), and 0 occurrences of the banned k × J literal in all 3 source files and all 3 generated copies.

Ran: arithmetic re-derivation of all 4 worked examples + both reconciliations (31 checks)
Result: PASS — 31/31. k=2 case: g1 14 > c1 4.5 adopted, M_nested 18.5; g2 2 > c2 0.5 adopted (no A, newly no J), M_nested 17. Superseded-charge counterfactual re-derives to 19 (> 18.5, historical rejection self-consistent). Overlap saving 19-17 = 2 = (k-1)xJ. Sum c = 5 = 9-4; Sum g = 16 = 24-8 — gate and ladder on one account.

Ran: barrier/charge consistency sweep across SKILL.md and references/config.md
Result: PASS — every global-leaf-barrier mention is a negation, the explicitly-distinguished Step 2s architect barrier, or the labelled superseded-history note. Charge side charges J once, slowest-of-k, first adoption only. No site charges what another does not deliver.

Gate G1 (coverage)
Result: N/A — 0 executable files changed; no runtime path exists (parallelism = off, full with k >= 2 unreachable in this repo). PROJECT-CONTEXT makes the coverage floor inapplicable to doc-skill changes; the plan's own Verification section declares G1/G6 N/A. Not MISSING_TOOL — no tool is missing, there is no subject to measure.

Gates G2, G3, G4, G5, G6, G7
Result: N/A — no functions, identifiers, code comments, mutable code, or module graph in the change set (3 markdown skill files + 3 markdown ADRs + generated markdown mirror). G7's structural analogue verified instead: generated-tree dependency on sources proven exact by --check exit 0, and citation direction (config.md / coder.md cite SKILL.md Step 3j item 4 rather than restating) confirmed.

Gate G8 (rework ratio)
Result: PASS — 0.0 for this plan (1 CR total, 0 REQUEST_CHANGES, 0 spawned FIX/QAF). Aggregate reading across both plans is 1.0 (2 CRs, 1 REQUEST_CHANGES, 1 FIX), reported in full in the QA report with the caveat that 1.0 is the arithmetic floor for any change taking exactly one remediation cycle. Cycle 2 found 0 Must Fix; no root-cause investigation indicated.

Open cosmetic item confirmed, not blocking: references/config.md:391 writes I(4x0.25=1) vs :386's I(4x0.25=1.0). Same quantity, no arithmetic affected, no gate failed on it. Rides the next change touching that file.

QA suite complete.
Report: plans/qa/QA-20260819T050419Z-cfd2-inner-join-run-site-prose.md
Status: READY_TO_COMMIT
Test failures: 0 | Lint errors: 0 | Type errors: 0
All checks pass. Safe to commit and open PR.
