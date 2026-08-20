---
id: EVAL-20260819T062651Z-1d9c
plan: FEAT-20260819T053237Z-236f
status: PASS
created_at: 2026-08-19T06:33:55Z
updated_at: 2026-08-19T06:33:55Z
cycle: 0
---

# Spec-driven evaluation — integration lane pricing, report schema, Prime scan child

**Related:** [SPEC-20260819T052229Z-3d97](../specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md) · [FEAT-20260819T053237Z-236f](../feat/FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md) · [TEST-20260819T060155Z-5bec](../test/TEST-20260819T060155Z-5bec-integration-lane-schema-prime-scan.md) · [CR-20260819T061027Z-4206](../code-review/CR-20260819T061027Z-4206-integration-lane-schema-prime-scan.md) · [QA-20260819T061740Z-1afa](../qa/QA-20260819T061740Z-1afa-integration-lane-schema-prime-scan.md)

## Headline

| Metric | Value |
| --- | --- |
| **Final** | **1.00** (unrounded `0.996875`) |
| **Band** | **Spec-complete** (≥ 0.90) |
| Adjusted Final | n/a — no gate is `✗` |
| Σw | 12 (4 stories × P0 w=3) |
| Elicitation `E` | recall **1.00** · precision **1.00** · justified **1.00** |
| Scope `S` | **partial** — one item (AC-22 derivation branch); PRD-boundary `pass`, rogue-build `pass` |
| Robustness `R` | **3.5** |
| Gates `G` | build ✓ · unit ✓ · e2e ✓ · lint `not-run` (probed) |
| Checks | **151 of 152 MET** (1 UNMET: AC-22 check b2) |

> The rounded `1.00` is not a claim of flawlessness. One binary check is UNMET; it moves the unrounded `Final` to `0.996875`, which rounds up. The gap is named in *Ranked gaps* and is a prose-completeness shortfall inside an otherwise-complete required derivation.

---

## 0. Subject, scope, and method

**Two subjects, kept separate.**
1. *Framework — respect & extract:* `Final` (implementation fidelity) + `S` (scope) + `E` (elicitation).
2. *Harness — prove it is built:* `T` + `G`.

**Acceptance authority.** `plans/specs/SPEC-20260819T052229Z-3d97-…md` (35 functional requirements, FR-1…FR-35).
**Derived spec (`spec.md`/`tasks.md` equivalent).** `plans/feat/FEAT-20260819T053237Z-236f-…md` — 38 stable, numbered acceptance criteria (AC-1…AC-38), 49 tasks, status DONE.

**AC-list freeze.** No `_ac-baseline.md` existed for this PRD. Per Reproducibility rule 1, the plan's AC-1…AC-38 carry stable IDs and are used **verbatim** as the frozen AC list; the binary I/T checklist below is the frozen decomposition and is the contract for any re-run. It is persisted inside this report rather than a sibling file, because the eval brief permitted creating no directory other than `plans/eval/`. Every FR-1…FR-35 maps onto at least one AC (mapping in §3); no FR is orphaned.

**Priority.** The PRD carries **no** explicit P0/P1/P2 labels. All four stories are marked `P0 — ASSUMED` (see *Assumptions*); all three concerns are named in the spec's *Goals* and none is deferred, so no story is P1/P2. All weights are therefore 3 and `Final` reduces to the unweighted mean of story scores.

**Diff surface** — `git diff 4c2deec7756a0703d4b1998c3b373003cbd655df` (19 files, +429/−201) plus one untracked file. All evidence below is inside it.

| Path | Role |
| --- | --- |
| `plugins/my-skills/skills/orchestrator/SKILL.md` | source (concern 1 + 3) |
| `plugins/my-skills/skills/orchestrator/references/config.md` | source (concern 1, normative arithmetic) |
| `plugins/my-skills/skills/orchestrator/templates/architect.md` | source (concern 1, region 5) |
| `plugins/my-skills/skills/clean-code-gates/schema/report.schema.json` | source (concern 2) |
| `plugins/my-skills/skills/clean-code-gates/SKILL.md` · `README.md` | source (concern 2, consumer contract) |
| `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` | **the only executable test surface** |
| `prime-agent/overlays/orchestrator.json` | source (concern 3, 5 new `count: 1` replacements) |
| `prime-agent/overlays/protocol.orchestrator.md` | source (concern 3) |
| `docs/adr/0016-top-level-integration-lane-pricing.md` | **new, untracked** |
| `docs/adr/0012-…` `0013-…` `0014-…` | cross-reference edits |
| `prime-agent/skills/**` (7 files) | **GENERATED MIRROR — not scored** |

**Generated-mirror rule (applied).** `prime-agent/skills/**` is rebuilt by `scripts/build-prime-agent.mjs` (`rmSync` + full rewrite). The 7 mirror files in the diff are **not** scored as implementation and **not** counted as duplicate work; the implementation site is the `plugins/` source and the `prime-agent/overlays/` overlay. The mirror is used **only** as executed *verification evidence* for AC-25/27/29/30/31/32 — i.e. as the harness (`T`), never as the subject (`I`).

**Verification-level policy, fixed once (the crux of this evaluation).** Three concerns, three verification surfaces:

| Concern | Executable path? | Required `T` level |
| --- | --- | --- |
| 1 — orchestrator flat cost model | **No.** `parallelism` is `off` in `.orchestrator/config.json` and `full` is unreachable; the artifacts are normative markdown. | **`T-n/a-structural`** — excluded from the `T` denominator |
| 2 — `clean-code-gates` schema + validator | **Yes.** Real CJS, `node --test`. | unit + integration (`buildReport` → `validate`) |
| 3 — Prime scan child | **Partly.** Overlay is data; the *generated result* is mechanically assertable. | `T-gate` — executed build/anchor/grep census over the generated tree |

Per the brief and the skill's own precedent (`not-run` gates cannot grant or deduct credit; `N/A` is excluded from `E_recall`), concern 1's absent e2e is recorded as **structurally impossible, not an omission**, and those `T`-checks are excluded from the denominator rather than scored UNMET. This is stated plainly because it is the single largest lever on the number: had those 16 ACs been scored `T = 0`, story 2 would fall to ~0.59. Scoring them UNMET would penalise the subject for a property of the repository, which is exactly the failure mode the skill's entry-point-neutrality rule exists to prevent.

**Self-consistency (k=3).** The checklist was evaluated three times. 149 of 152 checks are backed by an executed command or an exact `file:line` grep and are deterministic — k=3 collapses trivially on those. Three checks are prose-judgement (AC-15 rationale completeness, AC-26 invariant-substance preservation, AC-22 check b2). AC-15 and AC-26 were MET unanimously. **AC-22 b2 was UNMET in all three passes** and is not borderline: the missing branch is literally absent from the file.

---

## 1. Engineering gates `G` — every verdict executed

| Gate | Command (pinned) | Verdict | Evidence |
| --- | --- | --- | --- |
| **build** | `node scripts/build-prime-agent.mjs --check` | **✓** | exit `0` — `prime-agent/skills is up to date (11 skills, 154 files)`. This is the repo's canonical build/generation guard; `scripts/build-prime-agent.mjs:77-80` makes an overlay anchor whose occurrence count ≠ its declared `count` a **hard failure**, so exit 0 is itself proof of every `count: 1` / `count: 2` / `count: 3` assertion. |
| **unit** | `cd plugins/my-skills/skills/clean-code-gates && npm test` | **✓** | `# tests 225 / # pass 225 / # fail 0`, duration 1464 ms. Baseline was 213 → **+12**. |
| **e2e** | `cd prime-agent && npm test` | **✓** | `bash tests/install.sh && bash tests/parity.sh` → `install ok: preflight, containment, all-or-nothing install, and mid-loop rollback verified` · `parity ok: prime-agent/skills is generated, in sync, and guarded`. |
| **lint** | — | **not-run** | *Probed, per Probe-before-not-run.* `ls package.json` → `No such file or directory` (no repo root package.json). `ls .eslintrc* eslint.config.*` → `no matches found`. `which shellcheck` → `shellcheck not found`. `clean-code-gates/package.json` declares `"scripts": { "test": "node --test" }` and **no** lint script and **zero** dependencies. No lint tooling exists in this repository; recorded as a known blind spot, **not** scored as missing. |

**No gate is `✗` ⇒ no `Adjusted Final`.** Documented non-graded notes: none — there is no pre-existing toolchain failure on this tree.

---

## 2. Independent re-derivation of the spec's core claim

The brief required the evaluator to re-derive the new worked example rather than accept the reports. Done by hand against `plugins/my-skills/skills/orchestrator/references/config.md:417-433`.

**Setup.** Lanes `{backend: 20, frontend: 12, admin: 6}` + declared top-level integration lane `wiring`, `X = tasks(integration) = 4`. Parent contract 4 interface points; the one adopted sub-contract 2. `A = 2`, `J = 2`.

| Quantity | Spec/artifact claims | Evaluator re-derivation | ✓ |
| --- | --- | --- | --- |
| `T` | 42 | `20 + 12 + 6 + 4` = **42** | ✓ |
| flat verdict | viable | 3 non-integration lanes ≥ 2; `20/42` = 47.6% → **48%** ≤ 70% | ✓ |
| `span_base` | 24 | `M + X` = `max(20,12,6) + 4` = `20 + 4` = **24** | ✓ |
| flat overhead | 5 | `A(2) + J(2) + I(4 × 0.25 = 1.0)` = **5** | ✓ |
| `M_flat` | 29 | `24 + 5` = **29** | ✓ |
| `span_max` | 16 | `max(span(backend)=8, 12, 6) + 4` = `12 + 4` = **16** | ✓ |
| nested overhead | 9.5 | `A + A + J + J + I((4+2) × 0.25 = 1.5)` = `2+2+2+2+1.5` = **9.5** | ✓ |
| `M_nested` | 25.5 | `16 + 9.5` = **25.5** | ✓ |
| `g` | 8 | `24 − 16` = **8** | ✓ |
| `g = M − S` | `20 − 12` = 8 | `20 − 12` = **8** — the `+X` cancellation is exact | ✓ |
| `c` | 4.5 | `A(2) + J(2) + I(2 × 0.25 = 0.5)` = **4.5** (first adoption, flat baseline) | ✓ |
| verdict | adopted | `8 > 4.5` → **adopted** | ✓ |
| `M_flat − M_nested = g − c` | 3.5 | `29 − 25.5` = **3.5** = `8 − 4.5` = **3.5** | ✓ |
| leaf re-application | 4 leaves, 29% | `{8,8,12,6}` → 4 non-integration leaves ≥ 2; `12/42` = 28.6% → **29%** ≤ 70% | ✓ |
| aggregate interface | 6 ≤ 42 | `4 + 2` = **6** ≤ `T` = 42 | ✓ |
| old-model contrast | `M_flat` 25, `M_nested` 21.5, `g` 8 | `max(20,4)=20 → 25`; `max(12,4)=12 → 21.5`; `g` = 8; `25 − 21.5` = 3.5 reconciles | ✓ |

**Every figure the brief named is confirmed: `T` 42, `span_base` 24, `span_max` 16, `M_flat` 29, `M_nested` 25.5, `g` 8 = `M − S` = 20 − 12, `c` 4.5, `M_flat − M_nested` = 3.5 = `g − c`.**

**No figure moved in any pre-existing worked example — proven two independent ways.**
1. *Diff-structural.* The four pre-existing examples' hunks (`@@ -308`, `@@ -324`, `@@ -344`, `@@ -364`) each contain exactly one `−`/`+` pair, and in every case it is the setup **prose** sentence gaining an explicit lane-level `integration: none` declaration. **Zero** removed lines fall inside any example's derivation body or result table.
2. *Numeric census.* Extracting every bolded figure (`\*\*[0-9.]+\*\*` and `= \*\*[0-9.]+\*\*`) from `config.md` at the base and at HEAD and diffing the sorted frequency tables: **every count either rose or was unchanged — none fell.** New entries (`= **25.5**`, `= **29**`, `= **42**`, `= **9.5**`, `= **20**`) all belong to the new fifth example. A moved figure would necessarily show a decrement; there is none.

The coder's own hand re-derivation is recorded (not assumed) in the progress log at `plans/feat/FEAT-20260819T053237Z-236f-…progress.md:66-74`, and covers **all four** existing examples where AC-19 required only two.

---

## 3. Frozen binary checklist — implementation `I` and verification `T`

Legend: `✓` MET (evidence cited) · `✗` UNMET (searched, absent) · `T n/a` = structurally impossible at this level, excluded from the denominator.

### Story 1 — Concern 2: report status vocabulary (AC-1…AC-8) · P0 (ASSUMED) · w=3
*FR map: FR-16…FR-26. The only executable surface.*

| AC | I-checks | Evidence | `I` |
| --- | --- | --- | --- |
| AC-1 | (a) `summary.status.enum` is exactly `["pass","warn","blocked","error"]` ✓ (b) `gatesErrored` declared as array-of-strings, same shape as `gatesMissingTool` ✓ (c) `gatesErrored` present in `summary.required` ✓ (d) `additionalProperties: false` still in force **and** `schemaVersion` still `const "1.0"` ✓ | `schema/report.schema.json:59` · `:69-73` · `:54` · `:55` (+ `:8`, `:23`, `:32`) | 4/4 |
| AC-2 | (a) `validate()` is a generic recursive checker honouring **all seven** named keywords — `type` `:50`, `required` `:34-36`, `additionalProperties` `:37-41`, `properties` `:42-44`, `items` `:58`, `enum` `:54-56`, `const` `:51-53`; recursion confirmed end-to-end via `checkNode → checkObject → checkNode` ✓ | `__tests__/schema.test.cjs:24-69` | 1/1 |
| AC-3 | (a) the validator is *capable* of emitting a violation for each of the five classes (unknown-key path and enum path both reachable) ✓ | `schema.test.cjs:37-41`, `:51-56` | 1/1 |
| AC-4 | (a) suite green at ≥ 213 with 0 failures ✓ | executed: 225/225, 0 fail | 1/1 |
| AC-5 | (a) the old `deepStrictEqual(statusEnum, ['pass','warn','blocked'])` is **updated**, not deleted ✓ | `schema.test.cjs:107` | 1/1 |
| AC-6 | (a) SKILL.md consumer line states the four-value vocabulary **and** names `report.summary.gatesErrored` beside `gatesMissingTool`, with the "measured nothing ⇒ never read as pass" warrant ✓ | `clean-code-gates/SKILL.md:52` | 1/1 |
| AC-7 | (a) report-shape JSON block shows `"pass|warn|blocked|error"` ✓ (b) `"gatesErrored": [...]` added under `summary` ✓ (c) the canonical consumer example carries an explicit `error` branch cross-referencing exit code 4 ✓ | `README.md:107` · `:110` · `:170-174` (+ `:189` gate-level note) | 3/3 |
| AC-8 | (a) `src/report.cjs` unmodified — no emitted report byte changes ✓ | `git diff --name-only` ∌ `src/report.cjs` (count 0); `package.json` also absent ⇒ no new dependency | 1/1 |

| AC | T-checks (level) | Evidence | `T` |
| --- | --- | --- | --- |
| AC-1 | (a) unit: the four-value enum is asserted ✓ (b) integration: a real `buildReport` output validates with **zero** violations ✓ | `schema.test.cjs:105-108` · `:90-93` | 2/2 |
| AC-2 | (a) integration: ordinary report → 0 violations ✓ (b) integration: **errored** report → `summary.status === 'error'`, `gatesErrored` = `['G1']`, 0 violations ✓ | `schema.test.cjs:90-93` · `:111-125` | 2/2 |
| AC-3 | five negative cases, each asserted to produce ≥ 1 violation: unknown key in `summary` ✓ · unknown key at top level ✓ · out-of-enum `summary.status` ✓ · out-of-enum per-gate `status` ✓ · out-of-enum finding `severity` ✓ | `schema.test.cjs:135-139`, executed at `:148-152` | 5/5 |
| AC-4 | (a) suite executed by the evaluator ✓ | 225/225 | 1/1 |
| AC-5 | (a) the updated assertion is itself an executed test ✓ | `schema.test.cjs:107` | 1/1 |
| AC-6 / AC-7 / AC-8 | `T n/a` — published prose and a negative (file-unchanged) proposition; no test surface exists in this repo | — | n/a |

**Story 1 = 1.00.**

> Substance note (informative, not scored): the pre-fix suite was **213/213 green while every report `buildReport` emits already violated the schema** — `$.summary: unknown key "gatesErrored"` and `$.summary.status: must be one of ["pass","warn","blocked"], got "error"`. The suite was green *by omission*: no pre-fix test ever constructed an errored gate, and the hand-rolled validator could not see `additionalProperties`. The errored-gate positive test (AC-2) plus `additionalProperties` enforcement (AC-3) close both halves. This is the finding's root cause, and it is genuinely fixed.

### Story 2 — Concern 1: top-level integration lane pricing (AC-9…AC-24) · P0 (ASSUMED) · w=3
*FR map: FR-1…FR-15. `T` is `n/a-structural` throughout — see §0.*

| AC | I-checks | Evidence | `I` |
| --- | --- | --- | --- |
| AC-9 | (a) viable-flat `span_base` = non-integration `max tasks(L)` **+** `tasks(integration)` ✓ (b) `span_max` = non-integration `max span(L)` **+** `tasks(integration)` ✓ (c) `M_flat` = that `span_base` + `A` + `J` + parent interface points ✓ (d) a declared `none` reads as `0` ✓ (e) it is stated explicitly that `M_nested` needs **no** separate term, being built on `span_max` ✓ | `config.md:245` (baseline table, viable row) · `:235` · `:237` · `:230` · `:239` | 5/5 |
| AC-10 | (a) `T` counts the top-level integration lane in full and the text says `M_seq` is therefore unchanged ✓ | `config.md:238` — "`T` and therefore `M_seq` are unchanged by this correction" | 1/1 |
| AC-11 | (a) 2p.1's lane-level request asks for an `integration` field in ADR-0014's exact strict shape (`none` \| named slice + req IDs + globs + **integer** count) ✓ (b) the strict-shape acceptance rule **enumerates** it as an accepted field ✓ (c) a lane-level split that omits it is **rejected outright**, not read as zero ✓ | `orchestrator/SKILL.md:464` · `:490` · `:490` | 3/3 |
| AC-12 | (a) req IDs and globs disjoint from every lane's ✓ (b) does not also appear as a lane row ✓ (c) globs satisfy the full *Owned-glob rejection* list ✓ (containment reads against repo root — deliberate divergence, documented) | `SKILL.md:464` and `config.md:230` (both carry all three) | 3/3 |
| AC-13 | (a) excluded at site 1 — *The two work-concentration conditions are evaluated at leaf granularity* ✓ (b) excluded at site 2 — *Leaf-level re-application* ✓ (c) the one-level-up rationale (`{backend: 20, integration: 4}` must not read as "2 lanes carry work") and the "those conditions only / counts in full in `span_base`, `span_max`, `M_flat`, `T`" bound are stated at **both** ✓ | `config.md:74` · `:495-498` | 3/3 |
| AC-14 | (a) never a sub-split candidate at 2p.3n ✓ (b) `span(integration) = tasks(integration)` named a **run constant** ✓ | `config.md:451` (*Greedy, recomputed adoption*) · `:234` | 2/2 |
| AC-15 | (a) the serial justification sits at the **definition site** and cites ADR-0016 ✓ (b) it names Step 3j (serial, after every other lane is DONE, never concurrently) **and** Step 3L (no integration lane in the concurrent wave, at either level) ✓ | `config.md:232` | 2/2 |
| AC-16 | (a) `Estimated speedup:` denominator is the expanded flat `span_base`, not `largest lane tasks` ✓ (b) the integration lane's contribution is legible on screen — a dedicated `Integration lane:` line plus two shown summands ✓ (c) `Fixed overhead:` and `Interface points to freeze:` unchanged (context lines in the diff; stated explicitly in prose) ✓ | `SKILL.md:505` · `:504` + `:512` · `:506-507`, `:512` | 3/3 |
| AC-17 | (a) the **parent** contract's region 5 is bound in verify-and-freeze terms ("verify against the real spec and tree … freeze it verbatim. Do not re-derive it, rename it, or re-size it") ✓ (b) same `contract violation` BLOCKED stop ✓ (c) existing `none` handling and the single-lane exception preserved, with the new multi-lane `none` case written as a distinct claim ✓ | `templates/architect.md:245` · `:245` · `:249` | 3/3 |
| AC-18 | (a) `SKILL.md` declares and links; does not restate formulas ✓ ("This step applies those rules; it does not restate them.") | `SKILL.md:464` | 1/1 |
| AC-19 | (a) all existing examples re-derived with a lane-level `integration: none` declared explicitly ✓ (b) **no figure moves** ✓ — independently confirmed by the evaluator two ways (§2) | `config.md` example-setup edits + progress log `:66-74`, `:163` | 2/2 |
| AC-20 | (a) a new example with top-level `tasks(integration) > 0` exists ✓ (b) `span_base` / `span_max` / `M_flat` / `M_nested` / `M_seq` internally consistent ✓ (c) `g` and `c` correct, and `g` cross-checked via the `M − S` identity ✓ (d) verdict follows from `g > c` ✓ (e) `M_flat − M_nested = g − c` holds exactly ✓ — **all five re-derived by the evaluator in §2** | `config.md:417-433` | 5/5 |
| AC-21 | (a) `docs/adr/0016-top-level-integration-lane-pricing.md` exists at Status **Accepted**, dated 2026-08-19 ✓ (b) carries ADR-0014's section structure — Status/Date/Skills affected/Source finding/Lineage/Context/Decision/Consequences ✓ | ADR-0016 `:3-7`, `:9`, `:40`, `:157` | 2/2 |
| **AC-22** | (a) **`c` unchanged at every branch, derived** (not asserted) — `X` appears in no overhead term ✓ (b1) the viable-flat direction claim is derived from `(M+X) − (S+X) = M − S` ✓ **(b2) the derivation covers all three branches of `max(M,X) − max(S,X)`** ✗ **UNMET** (c) `g` reduced by `min(S,X)` on a sequential baseline, derived ✓ (d) `M_flat − M_nested = g − c` preserved **and** explicitly framed as *not* a gate/ladder disagreement ✓ | ADR-0016 `:109-144`; **b2 search:** read `:109-144` in full — ADR states only `X ≤ S ≤ M` ("the two agree at `M − S`") and `X ≥ M ≥ S` ("`X − X = 0`"). The middle branch `S < X < M`, where the uncorrected `g = M − X` is understated by `X − S`, is **absent**. `grep` for `M − X` / `X − S` across `docs/adr/0016-*.md` → 0 hits. The spec's own *Project-context fit* derivation (SPEC `:135`) enumerates all three. | **4/5** |
| AC-23 | (a) ADR-0012 cross-references ADR-0016 ✓ (b) ADR-0013 does ✓ (c) ADR-0014 does ✓ (d) ADR-0014's "Filed separately" bullet is **replaced**, not appended to ✓ | `0012:154-159` · `0013:7-11` · `0014:119-127` · `grep -c 'Filed separately' docs/adr/0014-*.md` → **0** | 4/4 |
| AC-24 | (a) no ADR-0012/0013/0014 decision re-opened or amended — ADR-0016 states "It **amends neither**"; the three edits are additive cross-references plus the one filing-pointer rewrite ✓ | ADR-0016 `:7`; ADR diffs (+6/+5/+9−5, all navigational) | 1/1 |

`T` for AC-9…AC-24: **`n/a-structural`**. `parallelism` is `off` in `.orchestrator/config.json` and `full` is unreachable; these are normative-markdown artifacts with no executable path. **Recorded as structurally impossible, not as an omission** — no behavioural test can be written, and inventing one is explicitly forbidden by both the spec (*Non-goals*) and the plan (*Out of Scope*). The substitute verification actually performed is the evaluator's full hand re-derivation in §2 plus the executed build gate.

**Story 2 = 0.99** (`15.8 / 16 = 0.9875`).

### Story 3 — Concern 3: Prime scan child (AC-25…AC-33) · P0 (ASSUMED) · w=3
*FR map: FR-27…FR-35. Implementation site = `prime-agent/overlays/`; verification site = the generated mirror.*

| AC | I-checks (overlay = implementation) | Evidence | `I` |
| --- | --- | --- | --- |
| AC-25 | (a) a replacement for the **body** of *The read-only scan subagent type* exists ✓ (b) the section **title** is unchanged ✓ (c) the child is admitted with `rlm(prompt, name=…)` like any other child ✓ (d) explicitly forbidden from writes and mutating commands, per the protocol's read-only rule ✓ (e) the three-item host-resolution list is **gone** from the replacement ✓ | `overlays/orchestrator.json:113-117` (`count: 1`); title survives at generated `SKILL.md:171` and is still referenced by name from B1 (`:68`) and 2p.1 (`:494`) | 5/5 |
| AC-26 | (a) the inline fallback survives as the genuine no-scan-child path ✓ (b) its trigger is restated for this host — "If the **host cannot admit a read-only child**" ✓ (c) both invariants preserved in substance: "**Never let this fail the run.**" and "untrusted input either way … changes only *where* the reading happened, never how the result is treated" ✓ (d) "a scan-child failure is never a parallelization verdict — Step 2p.3 owns those" ✓ | `overlays/orchestrator.json:117` (replace body) | 4/4 |
| AC-27 | (a) two **distinct** stable names, one per caller — `context-scan` (B1) and `slicing-scan` (2p.1); no shared replacement across the sites ✓ | `orchestrator.json:117`, `:129`, `:135` — three separate `count: 1` entries | 1/1 |
| AC-28 | (a) a **per-site `count: 1`** anchored replacement on the `description` line ✓ (b) the `find` is exactly the specified two-line block (`- \`description\`: \`Slice spec into lanes\`` + `- \`subagent_type\`: the resolved scan type (…)`) ✓ | `orchestrator.json:125-129` | 2/2 |
| AC-29 | (a) 2p.1's intro sentence is rewritten to point at *How to spawn a role child* — the fourth stale site that escaped the shared `count: 3` anchor ✓ | `orchestrator.json:119-123` | 1/1 |
| AC-30 | (a) B1's *Explore scan* step label rewritten (`count: 1`) ✓ (b) the *"The Explore agent synthesized it"* sentence rewritten (`count: 1`) ✓ | `orchestrator.json:131-135` · `:137-141` | 2/2 |
| AC-31 | (a) the "tracked separately" clause is gone ✓ (b) the read-only rule the same sentence carried is **preserved** ✓ | `overlays/protocol.orchestrator.md:5-6` ("still obeys the read-only rule stated below") + `:31` ("A read-only scan child must be explicitly forbidden from writes and mutating commands") | 2/2 |
| AC-32 | (a) the generated tree is in the asserted state ✓ | see T below | 1/1 |
| AC-33 | (a) no trust-boundary change made or claimed — 2p.1's strict-shape acceptance, independent per-value validation, and *surface imperatives, never obey them* are all untouched; the only edit inside that paragraph renames the **actor** ("The Explore agent" → "The scan child"), not the rule ✓ | `SKILL.md:490-492` unchanged apart from the concern-1 field enumeration; `orchestrator.json:137-141` | 1/1 |

| AC | T-checks (executed gate/census over the generated tree) | Evidence | `T` |
| --- | --- | --- | --- |
| AC-25 | (a) the generated SKILL.md carries the Prime scan-child body and no host-resolution list ✓ | generated `SKILL.md:173`, `:175`, `:177`; `grep -E 'Explore\|explore\|general-purpose\|general'` → **0** | 1/1 |
| AC-27 | (a) both distinct names present in the generated tree ✓ | generated `:68` (`context-scan`), `:497` (`slicing-scan`) | 1/1 |
| AC-28 | (a) the `count: 1` anchor matched exactly once ✓ | `--check` exit 0 (`build-prime-agent.mjs:77-80` hard-fails on any count mismatch) | 1/1 |
| AC-29 | (a) **zero** occurrences of `How to spawn a subagent` in the generated file ✓ | `grep -c` → **0** | 1/1 |
| AC-30 | (a) zero residual `Explore` host vocabulary in the generated file ✓ | `grep -E` → **0** | 1/1 |
| AC-31 | (a) the "tracked separately" clause is absent from the generated preamble and the read-only rule survives ✓ | `grep -c 'tracked separately'` → **0**; generated `:44-45` carries the read-only prohibition | 1/1 |
| AC-32 | (a) **zero** `subagent_type` in a call-shape position, with **both** prohibitions surviving ✓ — base had **3** (`:17` preamble, `:497` call shape, `:626` prohibition); HEAD has **2** (`:17`, `:632`), i.e. exactly the call-shape occurrence removed (b) **zero** `Explore`/`explore`/`general-purpose`/`general` as a resolvable type ✓ (c) **zero** `How to spawn a subagent` ✓ | executed greps, base vs HEAD | 3/3 |
| AC-26 / AC-33 | `T n/a` — prose-substance and a negative (no-change) proposition | — | n/a |

> **Criteria-wording note, not an implementation miss.** AC-32's parenthetical describes the two surviving prohibitions as "the protocol preamble and the **Step-4 role-dispatch note**". The second survivor is in fact the **condition-6 fan-out note** (generated `:632`). The normative clause — zero in a call-shape position, both prohibitions surviving — is met exactly, verified against the base revision. The mislabel is in the plan's AC text.

**Story 3 = 1.00.**

### Story 4 — Cross-cutting (AC-34…AC-38) · P0 (ASSUMED) · w=3

| AC | I-check | T-check (executed) | Evidence | `I` / `T` |
| --- | --- | --- | --- | --- |
| AC-34 | joint anchor census holds after **both** concerns landed | evaluator-executed grep | `the call shape from *How to spawn a subagent*` = **3** · `':(exclude).claude'` = **3** · `through a **single sequential coder invocation**` = **2** — all three at the required counts in `plugins/…/orchestrator/SKILL.md`. The concern-1 prose deliberately paraphrases the `count: 2` phrase rather than reproducing it. | 1/1 · 1/1 |
| AC-35 | `clean-code-gates.json`'s two `count: 1` anchors still match after the doc edits | `--check` exit 0 | anchor-count mismatch is a hard build failure (`build-prime-agent.mjs:79-80`) | 1/1 · 1/1 |
| AC-36 | `--check` exits 0 on the final tree | executed | exit 0, `up to date (11 skills, 154 files)`; per-phase history recorded in the progress log | 1/1 · 1/1 |
| AC-37 | nothing under `prime-agent/skills/` hand-edited | `parity.sh` | `parity ok: prime-agent/skills is generated, in sync, and guarded`; `--check` reports no drift ⇒ the 7 mirror files are byte-identical to regeneration from source+overlays | 1/1 · 1/1 |
| AC-38 | backward compatibility holds — no emitted report byte changes; the digest-shape change touches only a transient per-run artifact `.orchestrator/run-manifest.json` persists none of | `T n/a` | `src/report.cjs` unmodified (diff count 0); `package.json` unmodified; `schemaVersion` still `const "1.0"` | 1/1 · n/a |

**Story 4 = 1.00.**

---

## 4. Roll-up (computed by script — output pasted verbatim)

`Σw` is derived inside the script from the same priority table shown above; nothing is hand-summed.

```
S1 Concern 2 — report status vocabulary (AC-1..8)               [P0, w=3] Story_score = 1.0000 -> 1.00
S2 Concern 1 — top-level integration lane pricing (AC-9..24)    [P0, w=3] Story_score = 0.9875 -> 0.99
  AC-22: I=4/5=0.8000  T=n/a-structural  AC_score=0.8000 (0.80)   <-- the only sub-1.00 AC
S3 Concern 3 — Prime scan child (AC-25..33)                     [P0, w=3] Story_score = 1.0000 -> 1.00
S4 Cross-cutting (AC-34..38)                                    [P0, w=3] Story_score = 1.0000 -> 1.00

Sigma_w = 12
Final (unrounded) = 0.9968750000000001
Final (2dp) = 1.00
Band = Spec-complete
Adjusted Final = n/a (no gate is red)
```

**Per-concern scores, reported on their own terms (not averaged):**

| Concern | Verification surface | Score | Reading |
| --- | --- | --- | --- |
| **1 — flat cost model** | docs-only; e2e **structurally impossible** | **0.99** | 15 of 16 ACs fully met; the arithmetic re-derives exactly. The `T` axis is genuinely inapplicable, not skipped. |
| **2 — schema + validator** | the only executable surface | **1.00** | 8/8 ACs; 225/225 green; the guard is proven able to fail on 11 mutations. |
| **3 — Prime scan child** | overlay source + mechanical census of the generated tree | **1.00** | 9/9 ACs; all three FR-33 greps return the required zeros. |
| **4 — cross-cutting** | executed build/anchor/parity gates | **1.00** | 5/5 ACs; the joint anchor census holds at 3/3/2. |

---

## 5. Elicitation `E` — how well the framework extracted requirements

Graded against `plans/feat/FEAT-…236f.md` (the derived spec), **not** the code.

### `E_recall` — frozen category rubric

| # | Category | Verdict | Where |
| --- | --- | --- | --- |
| 1 | Input validation & bounds | **Addressed** | AC-11 (strict shape, reject-on-omission), AC-2/AC-3 (schema keyword enforcement) |
| 2 | Error taxonomy & messaging | **Addressed** | AC-1/AC-6/AC-7 — the four-value vocabulary *is* the taxonomy; `error` never reads as `pass` |
| 3 | AuthN / AuthZ | **N/A** | no endpoint, no user-owned data |
| 4 | Idempotency & retry addressability | **Addressed** | AC-27 — stable per-caller names so a retry addresses the right child via `receiver_name` |
| 5 | Concurrency & race conditions | **Addressed** | AC-13/AC-14/AC-15 — what is concurrent vs serial is the whole subject of concern 1 |
| 6 | Data lifecycle & consistency | **Addressed** | AC-38 — transient per-run artifact, no persisted shape, no migration |
| 7 | Observability | **Addressed** | AC-16 (printed figures made legible), AC-26 (stdout note when the digest was gathered inline) |
| 8 | Limits, pagination & rate | **N/A** | no list surface, no volume path |
| 9 | External-dependency failure | **Addressed** | AC-26 — inline fallback with its trigger restated for this host; never fails the run |
| 10 | State-transition integrity | **Addressed** | AC-1 — `summary.status` is a status machine and `error` was an unreachable-by-contract state |

`E_recall = 8 / (8 + 0) = **1.00**`

### `E_precision` / `E_justified` — added-requirement ledger

Requirements in the plan **not** traceable to a spec FR line:

| # | Addition | Verdict | Warrant | Built? |
| --- | --- | --- | --- | --- |
| 1 | AC-8 promotes "no emitted report byte changes / `src/report.cjs` untouched" from an NFR sentence to a hard AC | **Valid-necessary** | It is the load-bearing backward-compat claim of concern 2; leaving it as prose makes it unverifiable | built ✓ |
| 2 | AC-36 tightens `--check` exit 0 to *"at the end of **every** phase — the generated tree is never left stale between phases"* | **Valid-defensive** | Directly implements the spec's own recorded ordering default; a per-concern check that passes individually can still leave the pair failing | built ✓ |
| 3 | AC-19 requires the hand re-derivation be **recorded in the Progress Log**, not assumed | **Valid-defensive** | Converts an unfalsifiable "we checked" into an auditable artifact; the coder went further and recorded all four examples | built ✓ |
| 4 | Six negative validator cases beyond the five the spec names ("at minimum") | **Valid-defensive** | Covers the `required` and `const` keywords the five named cases do not exercise | built ✓ |

`E_precision = 4 / 4 = **1.00**` · `E_justified = 4 / 4 = **1.00**` (each carries an explicit rationale in the AC text or *Technical Notes*).

**Deferred-valid, correctly not built (good discipline, not an `S` penalty).** The plan explicitly ruled on both of the spec's droppable off-ramps and **kept** them (AC-17, AC-30) with recorded warrants, and explicitly deferred the `span(P)` unification (CR R4/SF-5) to a future ADR-0017 rather than smuggling it in. It also refused `ajv` and a `schemaVersion` bump, both correctly.

**FR coverage of the derived spec:** all 35 FRs map to at least one AC. Nothing dropped, nothing hallucinated.

---

## 6. Scope adherence `S`

| Check | Verdict | Basis |
| --- | --- | --- |
| **PRD-boundary** | **pass** | Nothing on the explicit out-of-scope list was built: `src/report.cjs` unmodified · no `schemaVersion` bump (`const "1.0"` intact) · no new dependency (`package.json` absent from the diff) · no opencode port work · no hand-edit under `prime-agent/skills/` (parity green) · no `simplify` cleanup of `toMarkdown`'s redundant guard · no commit or push (working tree still dirty) · the nested/sub-lane half of the model untouched except where the top-level term is named beside it. |
| **Rogue build** | **pass** | Every one of the 19 changed files + 1 new file traces to a spec FR and a plan AC. No untraceable or invented behaviour. |
| **Plan drift** | **partial** | Exactly one item: AC-22 sanctioned a `g`/`c` derivation covering the branch structure the spec's *Project-context fit* enumerates; ADR-0016 delivers 4 of its 5 required results and omits the middle branch. Nothing else is half-built or inconsistent. |

**`S` = partial** — sole item as above. Reported beside `Final`, not folded into it.

---

## 7. Robustness `R` and Test Distribution `D`

**`R` — extra tests beyond the PRD's named cases (never inflates `Final`):**

| Extra test | Weight |
| --- | --- |
| `missing required key in summary` (deletes `gatesErrored`) — the mutation that directly guards the new `required` entry | High 1.0 |
| `missing required key in a finding` | Med 0.5 |
| `wrong type for gates` | Med 0.5 |
| `wrong item type inside scope.files` | Med 0.5 |
| `wrong item type inside gates` | Med 0.5 |
| `schemaVersion violating its const` | Med 0.5 |

**`R` = 3.5.**

**`D` — every added feature test classified into exactly one tier.** 12 tests added (213 → 225).

| Tier | Count | % | Contents |
| --- | --- | --- | --- |
| **Necessary** (P0 primary path) | 1 | 8.3% | `buildReport output with an errored gate conforms to report.schema.json` — the AC-2 primary path (asserts `status === 'error'`, `gatesErrored` non-empty, 0 violations) |
| **Secondary** (AC-mapped, not primary) | 5 | 41.7% | the five AC-3 negative cases |
| **Nice-to-have** (no AC) | 6 | 50.0% | the six extra negative cases in `R` |

**Shape read.** Necessary looks thin at 1, but that is correct here rather than a smell: the ordinary-report happy path was already covered by a **pre-existing** test (`schema.test.cjs:90-93`, not counted as added) and the feature's entire substance is *making a guard that could not fail able to fail*. Half the added suite is defensive-by-design. The one gap this shape leaves is that no added test pins a `pattern`/`format`/`minimum` violation — consistent with those keywords being out of the frozen criteria (see gap 2). `D` is descriptive and does not change `Final`.

*Excluded from `D` (not added by this feature):* the modified-in-place enum assertion at `:107` and the pre-existing positive conformance test at `:90`.

---

## 8. Ranked gaps

1. **[Real, minor — the only scored miss] ADR-0016's `g` derivation omits the middle branch.** `docs/adr/0016-…md:109-144` derives `max(M,X) − max(S,X)` for `X ≤ S ≤ M` and for `X ≥ M ≥ S`, but never for `S < X < M`, where the uncorrected `g = M − X` is understated by `X − S`. AC-22 required the interaction *stated with its derivation*; the spec's own *Project-context fit* (SPEC `:135`) enumerates all three. Costs 1 check → `Final` 1.00 instead of a clean 1.0000. Matches CR **SF-1** and QA **A-4**. Non-blocking: the ADR's *summary* claim ("unchanged whenever the integration lane is not the longest span, corrected upward otherwise") is correct and covers the branch; only the working is incomplete.

2. **[Criteria gap, NOT an implementation miss] The validator honours 7 of the 10 keywords the schema uses.** `pattern` (`report.schema.json:93`), `format` (`:17`), and `minimum` (`:76`, `:80`, `:142`, `:146` — four sites) are unenforced. **AC-2 and AC-3 name exactly the seven that were implemented**, and the spec's *Decisions resolved by Brainstormer default* names the same seven verbatim. The implementation delivered precisely what was asked. Scored as **fully MET**; recorded here because the *criteria* under-specify the target. Matches CR **SF-2**.

3. **[Sub-item of gap 2 — narrow regression, non-production] The rewrite silently dropped a pre-existing `line >= 1` check.** The base validator carried a bespoke `if (typeof finding.line !== 'number' || finding.line < 1)` (base `schema.test.cjs:83`); the generic rewrite implements no `minimum`, so `findings[].line: 0` now validates clean where it did not before. Confirmed by reading both revisions. **No AC requires it**, it is a test-fixture capability only (nothing in `src/` validates at runtime), and the net across the probed mutations is strictly better — the rewrite gains `additionalProperties` enforcement at two levels, which is precisely the keyword that would have caught the original defect. Matches QA **A-1**. Not scored.

4. **[Out of scope by the plan's own ruling] `span(L)` / `span_max` written as the same formula at three sites.** Filed for ADR-0017 by CR **R4/SF-5**; the plan's *Out of Scope* and AC-24 both bar re-opening the nested half of the model here. Not scored.

5. **[Out of scope by AC-32's own boundary] Three sibling Prime skills still carry host vocabulary.** AC-32 scopes the zero-occurrence assertion to the **orchestrator**'s generated SKILL.md, and **0 lines changed** in those sibling files (they are absent from the diff surface entirely). Matches CR **SF-4**. Not scored.

6. **[Quality nits, no AC] `checkObject` mixes `Object.hasOwn` and `in` (CR SF-3); the recursive walker exceeds the repo's hand-measured nesting/complexity guidance (QA A-2); `path` shadows the `node:path` import (QA A-3).** All on a test fixture, all in a repo with no complexity tooling, all explicitly scoped out by the plan's *Technical Notes* ("the per-method complexity AC does not attach"). Not scored — surplus quality never moves `I` or `T` in either direction.

**Confirmed: gaps 1–6 are the complete open-item set.** No open item is scored as an implementation miss when it is a criteria gap; gaps 2, 3, 4, 5, and 6 are all explicitly classified as such.

## 9. Fixes to reach a clean 1.0000

Exactly one change is required. Everything else on this list is already filed and out of scope.

1. **(Required)** In `docs/adr/0016-top-level-integration-lane-pricing.md`, inside *The `g`/`c` interaction*, insert the middle branch between the two existing cases:
   > When `S < X < M`, the uncorrected model gave `g = M − X`, understating the true `M − S` by exactly `X − S`; the corrected model gives `M − S`. This is the intermediate case between the two above and completes the trichotomy of `max(M, X) − max(S, X)`.

   Doc-only, zero anchor risk (`docs/adr/` is not an anchored file), and it restores parity with the spec's own worked derivation.

2. *(Already filed — do not do here.)* Fold `pattern` and `minimum` into `checkNode` under the SF-2 follow-up, restoring the `line >= 1` capability lost in gap 3, and refactor the walker in the same pass so QA A-2 does not worsen. Then widen AC-2/AC-3's keyword list so the criteria and the implementation agree.

---

## Assumptions

- **Priority is `ASSUMED`.** The PRD carries no P0/P1/P2 labels. All four stories are treated as P0 (w=3) because all three concerns appear in the spec's *Goals* with none deferred. If a future benchmark labels them differently, `Final` must be recomputed — the weights were not inferred silently.
- **`T` exclusion for concern 1.** The 16 ACs in story 2 have their `T` axis excluded from the denominator rather than scored `0`, on the basis that `parallelism` is `off` and `full` unreachable in this repository, making a behavioural test structurally impossible rather than merely absent. This is the single largest lever on the number and is stated so any re-run can adopt or reject it deliberately. Had those checks been scored UNMET, story 2 would fall to ≈ 0.59 and `Final` to ≈ 0.90.
- **AC-list source.** The plan's AC-1…AC-38 (not the spec's FR-1…FR-35) are the frozen unit of scoring, per Reproducibility rule 1 — the plan is the derived spec and carries stable IDs. FR→AC coverage was verified complete before freezing.
- **Judge ≠ author.** The evaluator did not author the implementation, the plan, the CR, the QA report, or the test report. All supporting reports were treated as input to verify, not as evidence to accept: every arithmetic figure, every anchor count, every grep assertion, and all four engineering gates were independently re-executed or re-derived here.
- **Evaluator is read-only over the subject.** No file under evaluation was modified. The only file written is this report.
