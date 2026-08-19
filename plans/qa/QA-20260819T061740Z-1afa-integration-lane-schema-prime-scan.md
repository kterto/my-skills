---
id: QA-20260819T061740Z-1afa
plan: FEAT-20260819T053237Z-236f
cr: CR-20260819T061027Z-4206
title: QA Report — Top-level integration lane pricing, report status vocabulary, and Prime scan child
status: READY_TO_COMMIT
created_at: 2026-08-19T06:17:40Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FEAT-20260819T053237Z-236f](../feat/FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md) · [CR-20260819T061027Z-4206](../code-review/CR-20260819T061027Z-4206-integration-lane-schema-prime-scan.md) · [TEST-20260819T060155Z-5bec](../test/TEST-20260819T060155Z-5bec-integration-lane-schema-prime-scan.md) · [SPEC-20260819T052229Z-3d97](../specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md)

## Summary

Three concerns judged on three separate verification surfaces and reported separately rather than averaged. The one executable surface (`clean-code-gates`) is green at **225 passing / 0 failures**, and I proved the strengthened validator genuinely catches the pre-fix defect by cross-running the new suite against the restored base schema (**4 failures**) — then went past the tester by also running the true pre-fix state (old tests + old schema), which is **213/213 green**, showing the defect was invisible by *omission* rather than by validator weakness. The orchestrator cost-model change is docs-only with no executable path, so it was verified by independent hand re-derivation; every figure reconciles exactly. The generated Prime tree carries **zero** resolvable host agent types with both prohibitions intact.

Verdict: **READY_TO_COMMIT**. No blocking failure on any surface. Two advisory findings are recorded below that neither the tester nor the reviewer identified — one of them a genuine (narrow, non-production) capability regression.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| `clean-code-gates` (`cd plugins/my-skills/skills/clean-code-gates && npm test`) | 225 | 225 | 0 | 0 | ✅ |
| `prime-agent` (`cd prime-agent && npm test` — install + parity) | — | pass | 0 | 0 | ✅ |
| Build / generated-tree check (`node scripts/build-prime-agent.mjs --check`) | — | — | — | — | ✅ exit 0 (`11 skills, 154 files`, up to date) |
| Lint | — | — | — | — | N/A — none configured (see *Gate applicability*) |
| Format check | — | — | — | — | N/A — none configured |

`--check` was re-run at the end of the QA pass and still exits 0, confirming the tree was not drifted by anything QA did.

### Gate applicability — stated plainly, not scored as a failure

`PROJECT-CONTEXT.md` → *Commands* declares **no build, no lint, and no automated test** for markdown/template authoring, and the plan's own `## Verification (per phase)` block restates that. Concerns 1 and 3 are markdown-authoring changes; `parallelism` is `off` in this repo's `.orchestrator/config.json` and `full` is unreachable, so **no executable path exists and no behavioural test can exist for them**. That is *inapplicability*, not a coverage shortfall — it is reported here as N/A, consistent with prior QA runs on this repo for doc-skill changes, and no BELOW_FLOOR is claimed. No test was invented for those surfaces.

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | ✅ N/A — **zero changed production files**; see note |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | ⚠️ advisory — 2 exceedances, hand-measured (A-2) |
| G4 Naming | intent-revealing | 0 violations | ⚠️ advisory — 1 shadowing finding (A-3) |
| G5 No comments | inline comment audit | 0 violations | ✅ 3 comments, all allowed — **net improvement** |
| G6 Mutation score (changed files) | killed / total | ≥70% | ✅ N/A — no changed production files; no tool configured |
| G7 Dependency structure | layering, cycles | 0 violations | ✅ clean — depth-1 graph, no cycles, no boundary crossing |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ✅ **0.0** (0 REQUEST_CHANGES, 0 FIX/QAF, 1 CR) |

**G1 framing (verified, not assumed).** `git diff --name-only 4c2deec.. -- .../clean-code-gates/src/` is **empty** — `src/` is untouched, satisfying AC-8. The only executable file in the whole change set is `__tests__/schema.test.cjs` (plus its byte-identical generated mirror, which is the same artifact and is not double-counted). A test file is not a coverage target, so G1 has no subject matter here rather than a missing measurement. For reference the suite still reports **87.18% line / 88.34% branch** overall, with `src/report.cjs` — the one production module this test exercises — at **100% line**.

**G2/G4/G7 tooling.** No ESLint, tsconfig, Stryker, dependency-cruiser, or madge exists anywhere in the repo, and no `node_modules` is installed; `package.json` has no `devDependencies` at all. Per `PROJECT-CONTEXT.md`, that is the project's declared design, not an unconfigured gate. These are therefore reported as **N/A-by-project-design with hand measurement**, not as `MISSING_TOOL` blocks — treating them as blocks would contradict the authoritative project context and would block every change this repo can ever make.

## Concern-by-concern verification

### Concern 1 — orchestrator flat cost model (docs-only, arithmetic surface)

Re-derived independently from the shipped text in `references/config.md`, not read back from the CR:

- `T` = 20 + 12 + 6 + 4 = **42**. Flat verdict: 3 non-integration lanes ≥ 2; `20/42` = 47.6% ≈ **48%** ≤ 70% → **viable**, baseline `M_flat`. ✅
- `M` = max(20, 12, 6) = 20 → `span_base` = `M + X` = **24**. Flat overhead = 2 + 2 + (4 × 0.25) = **5**. `M_flat` = **29**. ✅
- `backend` → `{8, 8}`, `integration: none` → `span(backend)` = 8. `S` = max(8, 12, 6) = 12 → `span_max` = `S + X` = **16**. Nested overhead = 2 + 2 + 2 + 2 + (6 × 0.25) = **9.5**. `M_nested` = **25.5**. ✅
- **`g` = 24 − 16 = 8**, and via the cancellation identity **`g` = `M − S` = 20 − 12 = 8** — the two agree. `c` = 2 + 2 + 0.5 = **4.5**, which also equals the overhead delta 9.5 − 5 = 4.5, so gain and cost sit on one account. `8 > 4.5` → adopted. ✅
- **Reconciliation: `M_flat − M_nested` = 29 − 25.5 = 3.5 = `g − c` = 8 − 4.5 = 3.5.** Exact. ✅

Residual gates re-checked rather than assumed: aggregate interface 4 + 2 = 6 ≤ `T` = 42 ✅; leaf set `{8, 8, 12, 6}` → 4 non-integration leaves, largest `12/42` = 28.6% ≈ 29% ≤ 70% ✅; 4 concurrent leaves ≤ `max_parallel_lanes` 6 ✅; `frontend` `{11, 1}` = 91.7% ≈ 92% > 70% correctly rejected ✅; `admin` split leaves `span_max` at 16 → `g = 0`, correctly not adopted ✅. The old-model comparison also re-derives: `span_base` = max(20, 4) = 20, `span_max` = max(12, 4) = 12, `g` = 8 either way, `25 − 21.5` = 3.5 reconciling either way, both makespans understated by exactly `X = 4` ✅.

**No figure moved in any of the four pre-existing examples — proven structurally, not by inspection.** I filtered the `config.md` diff to *every* removed line: the only deletions are the four model definitions, the two baseline-table rows, the four example **setup sentences**, and the two leaf-condition lines. **Zero removed lines fall inside any pre-existing example's derivation body**, so no figure in them can have changed. The setup-sentence edits add only the explicit lane-level `integration: none` declaration; all counts (`{12,6}`/`{6,6}`; `24`/`{8,8,8}`; `24`/5-sublanes+6; `{A:24,B:10,C:4}`, `T=38`, 63%) are byte-identical across the edit.

AC-13 confirmed at **both** evaluation sites (leaf-granularity deferral and leaf-level re-application), each carrying the `{backend: 20, integration: 4}` rationale and bounding the exclusion to those two conditions. AC-16's print block uses the expanded flat `span_base` denominator with a separate `Integration lane:` line, and `Fixed overhead:` / `Interface points to freeze:` are unchanged. ADR-0016 exists at Accepted; ADR-0012/0013/0014 each cross-reference it; ADR-0014's "Filed separately" bullet is **gone** (grep count 0), i.e. replaced rather than appended to.

### Concern 2 — schema + validator (the only executable surface)

Falsification run in an isolated scratch tree (the repo working tree was verified byte-unchanged before and after):

| Cross-run | Result | Reading |
|---|---|---|
| NEW tests + NEW schema | **225 pass / 0 fail** | baseline green |
| **NEW tests + OLD schema** | **221 pass / 4 fail** | ✅ the strengthened guard genuinely sees the pre-fix defect |
| OLD tests + NEW schema | 212 pass / 1 fail | the single failure is a hardcoded enum literal, not a validation catch |
| **OLD tests + OLD schema** (true pre-fix state) | **213 pass / 0 fail** | 🚩 the defect was invisible **by omission** |

The two verbatim validator-driven catches under the old schema are `$.summary: unknown key "gatesErrored"` and `$.summary.status: must be one of ["pass","warn","blocked"], got "error"`. The pre-fix state being 213/213 green while the *unchanged* shipped `src/report.cjs` emits `{"status":"error","gatesErrored":["G1"]}` is the decisive evidence: no pre-fix test ever built an errored gate, so the suite was green by omission. The new *errored-gate* positive test is what closes that hole — this is stronger evidence for AC-2 than the plan required.

Validator strength proven independently of the schema swap (validator extracted to a scratch probe): all five required negative mutations are **rejected**, and the concrete gain over the old hand-rolled validator is `additionalProperties: false` enforcement at both the `summary` and top level — precisely the keyword that would have caught `gatesErrored`. AC-1 verified by parsing the schema: enum exactly `["pass","warn","blocked","error"]`, `gatesErrored` an array of strings matching `gatesMissingTool`'s shape and present in `summary.required`, `additionalProperties: false` in force at both levels, `schemaVersion` still `const "1.0"`. AC-8 verified: `src/` diff is empty.

### Concern 3 — Prime port scan-agent resolution (generated tree)

Verified against the **generated** tree, not against `--check` passing:

- `How to spawn a subagent` → **0**
- `Explore` / `explore` / `general-purpose` / `general` → **0 hits of any kind**, not merely zero as a resolvable type
- `subagent_type` → **exactly 2**, and both are prohibitions that must survive: line 17 (protocol preamble, *"…to `subagent_type`, `Agent`, `task`, or a file in `.claude`/`.opencode`"*) and line 632 (Step-4 role dispatch, *"a role is never a `subagent_type`/`Agent`/`task` call"*)
- `tracked\s+separately` (whitespace-insensitive, defeating the line-break trap) → **0** in both the generated tree and the overlay
- Two distinct stable names present: `context-scan` and `slicing-scan`

Joint anchor census on source `SKILL.md` holds at **3 / 3 / 2** exactly as required. `orchestrator.json` carries 21 replacements (19 at `count: 1`, 2 at `count: 3`). AC-35 confirmed: `clean-code-gates.json` has **two** `count: 1` anchors — one under `fileReplacements["README.md"]` and one under `replacements` — both targeting install-path prose, not the status vocabulary, and both still matching (a first read that inspected only `replacements` under-counted them; corrected here). AC-37 holds: `--check` exit 0 proves byte-identity with build output, so nothing under `prime-agent/skills/` was hand-edited.

## Failures

None — all suites passed and every gate command exited 0.

## Lint / Format / Type Issues

None — no lint, format, or type tooling is configured in this repo by design (`PROJECT-CONTEXT.md` → *Commands*).

## Advisory findings (non-blocking, new in QA)

### A-1 — the validator rewrite **lost** a `line: 0` check the old one had

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs`
The base revision carried a bespoke check at line 83: `if (typeof finding.line !== 'number' || finding.line < 1) errs.push('...line must be integer >= 1')`. The generic rewrite dropped it and does not implement `minimum`, so **`findings[].line: 0` now validates clean where it previously did not**. Verified directly against both validators.

This refines CR **SF-2**, which framed the `minimum` gap as purely latent — it is latent in production (nothing in `src/` validates at runtime, and I re-confirmed every finding-construction site is floored, including `dart-flutter.cjs:469`'s `rec.line`, which is floored transitively at its `parseAnalyzeLine` construction site via `Number(lineNo) || 1`), but one fixture capability was actually lost. **Not a blocker**: no AC requires `minimum`; AC-2/AC-3 name exactly the seven keywords implemented; net across the eight probed mutations the new validator is strictly better (it gains `additionalProperties` at two sites, loses this one). It should be folded into the SF-2 follow-up so the check returns with `minimum`/`pattern`.

### A-2 — G2 exceedances in the new validator helper (hand-measured)

`checkNode` (15 lines): cyclomatic **11** vs ≤8 — unambiguous, all four `&&`/`||` are genuine guards. `checkObject` (14 lines): nesting depth **3** vs ≤2 (at `if` → `for` → `if`, lines 37–39), and cyclomatic **10** vs ≤8 under the strict counting rule, or **8** — exactly at threshold — if the two `|| {}` / `|| []` default-value idioms are excluded. Length (≤30), params (4, at ceiling), and statements (≤15) all pass.

The plan's Technical Notes explicitly ruled that "the per-method complexity AC does not attach" to this test-file helper while warning that "a recursive schema walker is the kind of function that balloons" — the length half of that warning was honoured, the nesting/complexity half was not. Recorded as advisory because it is a documented architect scoping decision the reviewer ratified, on a test fixture, in a repo with no complexity tooling. **Load-bearing for the follow-up**: SF-2 proposes adding `pattern` and `minimum` to `checkNode`, which will push it further past the threshold unless that change refactors at the same time.

### A-3 — G4: `path` shadows the `node:path` import

`const path = require('node:path')` at line 4 is shadowed by a parameter named `path` in `checkType` (:24), `checkObject` (:32), and `checkNode` (:48), where it means a JSON-pointer location string. Nothing breaks — the module binding is used only at module scope (:87) — but one name carries two unrelated meanings in a 165-line file. `jsonPath` or `pointer` would be intent-revealing. Single-letter lambda params (`v`, `t`, `r`) are one-expression closures whose meaning is fixed by context; `r` across the 11 `negativeCases` mutators is the only one worth renaming.

### A-4 — refinement of CR SF-1 (ADR-0016's middle case)

Confirmed: the derivation enumerates only `X ≤ S ≤ M` and `X ≥ M ≥ S`, omitting `S < X < M` where `g_uncorrected = M − X` against the correct `M − S`. Worth adding to the CR's framing — the true dividing line is **`X` vs `S`, not `X` vs `M`**: `g` is unchanged iff `X ≤ S` and corrected upward by `X − S` otherwise. The ADR's headline ("unchanged when the integration lane is not the longest span") is therefore correct only when "longest span" is read against `S`, the nested plan's critical path, which is the natural reading but is not stated. Prose precision only; no arithmetic in the ADR or in `config.md` is wrong.

## Confirmation of the five CR Should-Fix items as non-blocking

Each checked independently rather than assumed; **no gate failed on any of them**.

| Item | Independently confirmed non-blocking? |
|---|---|
| SF-1 ADR-0016 middle case | ✅ Prose completeness only; all stated arithmetic correct. Refined in A-4. |
| SF-2 validator honours 7 of 10 keywords | ✅ AC-2/AC-3 name exactly those 7. `line: 0` confirmed unreachable — all construction sites floored, incl. transitively at `dart-flutter.cjs:469`. Sharpened by A-1. |
| SF-3 `in` vs `Object.hasOwn` at `:43` | ✅ Verified: `:35` and `:39` use `Object.hasOwn`, `:43` still uses `in`. Inert — schema property names collide with nothing on `Object.prototype` and inputs are `JSON.parse` products. Consistency only. |
| SF-4 three sibling Prime skills | ✅ **Not a regression** — `git diff --numstat` returns **0 entries** for all three source files. Host vocabulary in their generated trees is pre-existing (2/1/1 hits). AC-32 scopes to the orchestrator, where it is genuinely zero. |
| SF-5 `span(P)` unification | ✅ Out of scope by the plan's own *Out of Scope* ("Any change to the nested/sub-lane half of the model — `span(L)` for a split lane…") and by AC-24. Correctly filed for ADR-0017. |

## Verdict

**Status**: READY_TO_COMMIT

All 38 acceptance criteria hold, the one executable suite is green at 225/0 with the pre-fix defect proven catchable by cross-run, the docs-only arithmetic re-derives exactly including `M_flat − M_nested = g − c = 3.5` and `g = M − S = 8`, and the generated Prime tree is clean with both prohibitions surviving; G8 = 0.0 and no CR Should-Fix item failed a gate.

All checks pass. Safe to commit and open PR. Four advisory findings (A-1 through A-4) are recorded for follow-up and none blocks this change — A-1 and A-2 should be folded into the SF-2 follow-up, which touches the same function and would otherwise worsen A-2.
