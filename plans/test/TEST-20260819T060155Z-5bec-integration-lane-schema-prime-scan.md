---
id: TEST-20260819T060155Z-5bec
plan: FEAT-20260819T053237Z-236f
title: Test Report — Top-level integration lane pricing, report status vocabulary, and Prime scan child
status: PASS
created_at: 2026-08-19T06:07:39Z
cycle: 0
---

**Related:** [FEAT-20260819T053237Z-236f](../feat/FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md)

## Summary

This plan carries **three concerns with three different verification surfaces**, and this report treats them differently on purpose. Only concern 2 (`clean-code-gates` schema) has executable code; concerns 1 and 3 are markdown-authoring changes with **no executable path on this tree** — `parallelism` is unset in `.orchestrator/config.json` (hence `off`), and `full` is unreachable. No behavioural test exists for them and none was manufactured. Their verification is **arithmetic re-derivation by hand** (concern 1) and **greps against the generated distribution** (concern 3).

Verdict: **PASS**. All three concerns verified. The `clean-code-gates` suite is green at **225 passing** (was 219 on arrival; I added 6 negative cases — see *E2E / Tests Added*). Line coverage on that suite is **87.18%**, comfortably above the 70% floor. All three re-runnable floors and all three overlay anchor counts hold after my additions.

**The single substantive finding is a false-confidence gap, not a defect:** the strengthened schema validator honours exactly the seven keywords the plan named, but the schema document uses **ten** — `minimum`, `pattern`, and `format` are unenforced, and I confirmed that independently rather than taking the simplify pass's word for it. Details and a judgement in *Test-Quality Audit*.

## Flows Triaged

"Flow" here means a verifiable behaviour, not a UI path — this repo has no e2e framework and no runtime application (`PROJECT-CONTEXT.md` → *Test tooling*: e2e is **none**; flows are skill behaviours described in prose).

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| Schema validates every report `buildReport` emits, including an errored gate | **High** (user impact: every report failed its own schema; breakage likelihood: certain — it was already broken; not covered by unit: it *was* covered, weakly) | **Verified as unit tests — already present, plus mutation-tested by me** | This is the only concern with executable code. Covered by two positive conformance tests. I additionally reverted the schema to its pre-fix state and re-ran the suite to prove the validator genuinely fails on the defect. |
| Strengthened validator rejects structurally invalid reports | **High** (this is the machinery that let the defect survive) | **Verified + extended** (5 → 11 negative cases) | 5 negative cases exercised only 2 of the 7 supported keywords. I added 6 more so every supported keyword has a negative case. |
| Flat makespan arithmetic (`span_base`/`span_max`/`M_flat` + `tasks(integration)`) | High impact, **zero executable surface** | **Excluded from e2e — verified by hand arithmetic** | `parallelism: off`; `full` is unreachable; the model exists only as normative prose. An e2e test here would have to test the markdown, which is what the hand re-derivation below does honestly. Plan *Out of Scope* forbids inventing one. |
| Prime port scan-child resolution | High impact, **generated-artifact surface** | **Excluded from e2e — verified by grep against the generated tree** | The correctness question is "what text does the builder emit", not "what does a program do". `--check` passing only proves the tree is in sync with the overlays; it does not prove the emitted text is right, so I checked the emitted text directly. |
| `clean-code-gates` CLI end-to-end (`bin/gates.cjs` invocation) | Low for **this** plan | **Excluded** | Untouched by the diff (`src/report.cjs` is explicitly unmodified per AC-8, verified). Its existing 200+ tests already cover it and are green. Adding e2e here would test unchanged code. |

**No e2e tests were added.** There is no e2e framework in this repo and no critical flow in this diff has an executable path that a new e2e test could exercise. Every flow above is either already unit-covered or has no executable surface at all.

## E2E Tests Added

**None** — and this is a deliberate, justified zero, not a gap:

- **Concern 1** — no executable path. `parallelism` is unset (`off`) in `.orchestrator/config.json`; the `full` level whose gate this arithmetic drives is unreachable on this tree. There is nothing to drive.
- **Concern 3** — a generated documentation tree. The build's own `--check` and `prime-agent/tests/parity.sh` are the executable guards, and both are green; the *content* question is answered by grep, below.
- **Concern 2** — has real code, but its critical behaviours are unit-testable and already unit-tested; an e2e layer would add nothing over the `node --test` suite.

**Unit tests added** (test files only, per my remit — 6 new negative cases in `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs`):

```
missing required key in summary        (exercises `required`)
missing required key in a finding      (exercises `required`, nested)
wrong type for gates                   (exercises `type`)
wrong item type inside scope.files     (exercises `items`)
wrong item type inside gates           (exercises `items`, object-in-array)
schemaVersion violating its const      (exercises `const`)
```

Rationale: the shipped negative-case table exercised only `additionalProperties` (2 cases) and `enum` (3 cases). The other five supported keywords — `type`, `required`, `properties`, `items`, `const` — had **no** negative case, so a future regression in `checkType`, the `required` loop, the `items` recursion, or the `const` branch would pass the suite silently. Each new case was first confirmed to be genuinely caught by the current validator (so none is a tautology) before being committed to the table. `properties` recursion is covered transitively — every nested case above resolves through it and its path label (`$.gates[0].findings[0]`) proves the walk reached the right node.

`src/` was not touched. The validator function itself was **not** modified.

The generated Prime tree was regenerated afterwards via `node scripts/build-prime-agent.mjs` (nothing under `prime-agent/skills/` was hand-edited, per AC-37), and `--check` is green again.

## Coverage

| | Before | After |
|---|---|---|
| `clean-code-gates` suite | 219 passing, 0 failing | **225 passing, 0 failing** |
| Line coverage (`node --test --experimental-test-coverage`) | 87.18% | **87.18%** |
| Branch coverage | 88.34% | 88.34% |
| Function coverage | 92.46% | 92.46% |

Coverage floor of 70% is **met** (87.18%). The figure is unchanged by my additions because the new tests exercise the test-file validator helper, not `src/` — which is the correct outcome: the plan's `src/` surface is deliberately unmodified (AC-8), so there was no under-covered production path in this diff to close.

**Coverage for concerns 1 and 3 is not BELOW_FLOOR — it is not applicable.** There is no executable code in either concern, so there is nothing to instrument. Reporting them as "below floor" would misrepresent a documentation change as untested code.

### Floors — all re-run and green after my test addition

| Floor | Result |
|---|---|
| `cd plugins/my-skills/skills/clean-code-gates && npm test` | **225 pass / 0 fail** |
| `node scripts/build-prime-agent.mjs --check` | **exit 0** — up to date, 11 skills, 154 files |
| `cd prime-agent && npm test` | **install ok + parity ok** |

### Overlay anchor census — held at 3 / 3 / 2

Re-run against `plugins/my-skills/skills/orchestrator/SKILL.md` after regeneration:

| Anchor | Required | Actual |
|---|---|---|
| ``the call shape from *How to spawn a subagent*`` | 3 | **3** |
| `:(exclude).claude` | 3 | **3** |
| ``through a **single sequential coder invocation**`` | 2 | **2** |

## Concern 1 — flat cost model (docs-only, verified by hand arithmetic)

The coder's claim was **verified, not accepted**. Two independent checks:

**(a) Structural — no existing figure could have moved.** I diffed `references/config.md` against `HEAD` and filtered for changed lines containing a bolded figure. **Zero.** Every deletion in the four pre-existing worked examples is a prose preamble line, rewritten only to add an explicit lane-level `integration: none` declaration; every table row and every `**bold**` number in all four examples is byte-identical. The claim "all four have `X = tasks(integration) = 0` so no figure moved" is therefore true by construction, not by assertion.

**(b) Arithmetic — all five examples re-derived by hand.** Every figure checks out:

| Example | Key figures re-derived | Reconciliation `M_base − M_nested = g − c` |
|---|---|---|
| `{12, 6}`, gate-vs-ladder | `span_max` 12→6, overhead 4 vs 8, `M_flat` 16, `M_nested` 14, `g` 6, `c` 4 | `16 − 14 = 2 = 6 − 4` ✓ |
| one lane carries all (seq baseline) | `T` 24, `span_max` 8, overhead 8.5, `M_nested` 16.5, `g` 16, `c` 8.5; alt `{20,4}` → `g` 4, rejected | `24 − 16.5 = 7.5 = 16 − 8.5` ✓ |
| integration **sub**-lane of 6 | `span_max` `5 + 6 = 11`, `I(8×0.25)=2`, overhead 10, `M_nested` 21, `g` 13, `c` 10, margin 3, improvement `3/24 = 12.5%` | `24 − 21 = 3 = 13 − 10` ✓ |
| `k = 2`, `{A:24, B:10, C:4}` | `T` 38, `24/38 = 63%`, `M_flat` 28; adoption 1 `g₁` 14 / `c₁` 4.5 / `M_nested` 18.5; adoption 2 `g₂` 2 / `c₂` 0.5 / `M_nested` 17; superseded serialized `M_nested` = **19**; leaves `{8,8,8,5,5,4}` sum 38, largest `8/38 = 21%`, 6 ≤ 6 | overhead `9 − 4 = 5 = 4.5 + 0.5` ✓; span `24 → 8 = 16 = 14 + 2` ✓; `28 − 17 = 11 = 16 − 5` ✓ |
| **new** `{backend:20, frontend:12, admin:6}` + `wiring: 4` | `T` 42; `20/42 = 48%`; `M = 20`, `X = 4`, `span_base = 24`; flat overhead `A+J+I(4×0.25)= 5`; `M_flat` **29**; `S = max(8,12,6) = 12`, `span_max = 16`; nested overhead `2+2+2+2+I(6×0.25=1.5) = 9.5`; `M_nested` **25.5**; `g = 24−16 = 8`; identity `g = M − S = 20−12 = 8`; `c = 4.5` | `29 − 25.5 = 3.5 = 8 − 4.5 = 3.5` ✓ **exact**, as required |

The new example's ancillary claims also check out by hand: `frontend {11,1}` → `11/12 = 92%` fails condition 2; `admin` split leaves `span_max` at 16 so `g = 0`; aggregate interface `4 + 2 = 6 ≤ 42`; leaf set `{8,8,12,6}` → 4 non-integration leaves, largest `12/42 = 29%`; 4 concurrent leaves ≤ 6. Its "what this pins" paragraph is also correct: the uncorrected model read `span_base = max(20,4) = 20` and `span_max = max(12,4) = 12`, giving the **same** `g = 8` and a reconciliation that **still balanced** (`25 − 21.5 = 3.5`) — both makespans understated by exactly `X = 4`.

**The spec's central derivation is present verbatim in the shipped text** (`references/config.md` → *The makespan model* → *The baseline*), as a fenced block:

```
span_base = M + X          span_max = S + X          g = (M + X) − (S + X) = M − S
```

with `X` named as a run constant, `c` stated as unchanged at every branch, and the sequential-baseline case (`g = T − (S + X)`, nothing to cancel) stated separately. Both work-concentration exclusion sites are present (AC-13), the never-a-sub-split-candidate rule is stated in both `The makespan model` and `Greedy, recomputed adoption` (AC-14), and Step 2p.2's print block uses the expanded flat `span_base` as the `Estimated speedup:` denominator with the integration summand shown separately (AC-16).

**I independently re-derived ADR-0016's `min(S, X)` claim**, which the plan flagged as needing derivation rather than assertion: under a sequential baseline the old model read `span_max = max(S, X)` and the corrected one reads `S + X`, so the gain falls by `(S + X) − max(S, X) = min(S, X)`. Correct. ADR-0016 is Accepted, dated 2026-08-19, carries ADR-0014's section structure, and is cross-referenced from ADR-0012 (L160), ADR-0013 (L8), and ADR-0014 (L125). ADR-0014's deferred bullet was **replaced** by an "Addressed separately, and now filed" pointer to ADR-0016; the one remaining "Not addressed here" bullet in ADR-0014 is a different bullet (about ADR-0013's overlapped inner joins) and correctly left alone.

## Concern 3 — Prime scan-agent resolution (verified in the generated tree)

`--check` passing proves only that the tree matches the overlays. I checked the **emitted text** of `prime-agent/skills/orchestrator/SKILL.md` directly:

| Check | Required | Actual |
|---|---|---|
| `Explore` | 0 | **0** |
| `explore` | 0 | **0** |
| `general-purpose` | 0 | **0** |
| `general` (as a resolvable type) | 0 | **0** |
| `How to spawn a subagent` | 0 | **0** |
| `subagent_type` | exactly 2, both prohibitions | **2 — both prohibitions, confirmed by reading them** |

The two surviving `subagent_type` occurrences are the protocol preamble (L17: *"never map a role to `subagent_type`, `Agent`, `task`…"*) and the condition-6 role-dispatch note (L632: *"a role is never a `subagent_type`/`Agent`/`task` call"*). Both are prohibitions; neither is a call shape. Correct.

Also confirmed in the emitted text: two **distinct** stable names (`context-scan` for Bootstrap B1, `slicing-scan` for Step 2p.1) with the ambiguous-retry rationale stated; the section title *The read-only scan subagent type* unchanged (it is referenced by name from three places); the inline fallback preserved with its trigger correctly restated for this host (*"If the host cannot admit a read-only child"*, not "none of the three agent types exists"); both invariants intact (*never let this fail the run*; the digest is untrusted either way, so inline changes only *where* the reading happened); the "a scan failure is never a parallelization verdict" note preserved (L181); the Step 2p.1 intro sentence pointing at the renamed *How to spawn a role child*; and the untrusted-data sentence rewritten from *"The Explore agent synthesized it"* to *"The scan child synthesized it"*. The `plugins/` source correctly still says `Explore` at that site — the Claude Code host has that agent type; only the Prime port lacks it.

`prime-agent/overlays/protocol.orchestrator.md` no longer carries the *"resolution is unchanged in this port and is tracked separately"* clause, and the read-only-child rule the same sentence carried survives.

**Observation, out of scope for this plan:** three *sibling* Prime skills still carry unrewritten Claude-host agent vocabulary — `prime-agent/skills/explain-codebase/SKILL.md:17`, `roadmap/SKILL.md:58`, and `simplify/SKILL.md:67` all name `Explore` / `general-purpose`. AC-32 scopes the zero-occurrence requirement to the orchestrator's `SKILL.md`, so this is **not** a regression and **not** a failure of this plan — but it is the same class of port defect one skill over, and worth filing.

## Test-Quality Audit

**No weak, empty, or tautological assertions found in the coder's tests.** Every added assertion is a real one: the two positive conformance tests use `deepStrictEqual(errs, [])` with the violation list interpolated into the failure message; the enum test uses `deepStrictEqual` against the full four-value list (AC-5 correctly *updated* the existing three-value assertion rather than deleting it — verified); the errored-gate test asserts both `summary.status === 'error'` and `deepStrictEqual(gatesErrored, ['G1'])` before validating. The negative cases assert `errs.length >= 1` with a labelled failure message.

### Mutation test — the validator genuinely catches the defect

I did not take this on trust. I copied the skill to a scratch tree, restored the **pre-fix** schema from `HEAD`, and re-ran the schema suite:

```
not ok 1 - buildReport output conforms to report.schema.json
    schema violations: $.summary: unknown key "gatesErrored"
not ok 4 - schema: summary.status enum values accepted
not ok 5 - buildReport output with an errored gate conforms to report.schema.json
    schema violations: $.summary: unknown key "gatesErrored";
                       $.summary.status: must be one of ["pass","warn","blocked"], got "error"
# tests 11  # pass 8  # fail 3
```

Three failures, with exactly the two defect messages the change exists to catch. The strengthened validator is real, not confirmatory. (The five original negative cases still pass against the old schema, correctly — they test the validator, not the schema version.)

### Finding — three schema keywords are unenforced (confirmed independently)

The simplify pass's claim checked out. I built a probe harness around the shipped `validate()` and mutated a real `buildReport` output:

```
MISSED  minimum: summary.blockers = -5
MISSED  minimum: finding.line = 0
MISSED  pattern: gate = "NOTAGATE"
MISSED  format: generatedAt = "not-a-date"
CAUGHT  const: schemaVersion = "9.9"        (control)
CAUGHT  type: summary.blockers = "many"     (control)
```

The schema document uses ten keywords — `type`, `required`, `additionalProperties`, `properties`, `items`, `enum`, `const`, **`minimum`**, **`pattern`**, **`format`** — and the validator honours seven. The controls confirm the harness is sound.

**Judgement: this matters, but it is low severity and should not block.** Reasoning:

- The validator is a **test fixture**, not runtime machinery. Nothing in `src/` validates reports against the schema at runtime, so an unenforced keyword cannot mis-accept a report in production — only fail to notice a builder regression in the test suite.
- The three unenforced keywords are **value-range and format** constraints. The defect class this change exists to catch — a key the builder emits that `additionalProperties: false` forbids, and a value outside a declared `enum` — is the **structural** class, and both halves are enforced and demonstrably fail on the pre-fix schema. The gap is orthogonal to the bug that was fixed.
- Real-defect likelihood is low but not zero. `blockers`/`warnings` are `.length` of filtered arrays, so `minimum: 0` cannot be violated by construction; `gate` values are `G1`..`G7` literals in source, so `pattern` cannot be violated either. The one live risk is **`line: 0`** from an adapter reporting a file-level finding with no line number — that violates `minimum: 1` and the suite would not notice.
- The plan's AC-2/AC-3 name exactly seven keywords, and the implementation honours exactly those seven. **The implementation meets its acceptance criteria**; the gap is in the criteria, not in the work. Closing it is ~6 lines in `checkNode` plus three negative cases.

I deliberately did **not** extend the validator to enforce `minimum`/`pattern`/`format`. That changes the helper's contract beyond what the architect ruled, and it is the reviewer's call whether to widen it now or file it. My additions stayed strictly inside the seven-keyword contract the plan defined.

### Secondary observation — resolved

The simplify pass also noted the negative-case table exercised only 2 of the 7 supported keywords. That is now closed: 11 negative cases cover all 7 (5 directly, `properties` transitively through the nested path labels). This was the lowest-covered path in the plan's actual diff, which is why I spent the addition there rather than manufacturing coverage elsewhere.

## Verdict

**PASS.**

- Concern 2 (the only executable surface): suite green at 225/0, coverage 87.18% ≥ 70%, and the strengthened validator **mutation-tested** against the pre-fix schema — it fails on the exact defect, with the exact messages.
- Concern 1 (docs-only, no executable path): all five worked examples re-derived by hand and correct; the `M_flat − M_nested = 29 − 25.5 = 3.5 = g − c = 8 − 4.5` identity confirmed exact; the four pre-existing examples proven `X = 0` structurally (zero figure lines changed in the diff) as well as arithmetically; the spec's central derivation present verbatim in the shipped text; ADR-0016 correct and cross-referenced.
- Concern 3 (docs-only, generated tree): verified in the **emitted** text, not just via `--check` — zero resolvable `Explore`/`explore`/`general-purpose`/`general`, zero `How to spawn a subagent`, and `subagent_type` surviving only at its two prohibition sites.
- All three floors re-run green after my test addition; all three overlay anchors hold at 3 / 3 / 2; the generated tree was regenerated through the builder, never hand-edited.

One advisory finding for the reviewer: **`minimum`/`pattern`/`format` are unenforced by the schema-test validator** (independently confirmed). Within AC as written; worth an explicit ruling. One out-of-scope observation: three sibling Prime skills still carry unrewritten `Explore`/`general-purpose` host vocabulary.
