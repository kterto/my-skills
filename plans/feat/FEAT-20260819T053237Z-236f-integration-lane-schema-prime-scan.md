---
id: FEAT-20260819T053237Z-236f
title: Top-level integration lane pricing, report status vocabulary, and Prime scan child
type: feat
status: DONE
created_at: 2026-08-19T05:34:56Z
updated_at: 2026-08-19T07:30:00Z
cycle: 0
related_to: SPEC-20260819T052229Z-3d97, ADR-0012, ADR-0013, ADR-0014, ADR-0016 (new)
---

**Related:** [SPEC-20260819T052229Z-3d97](../specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md)

## Overview

Three independent validation deviations from the `feat/prime-agent-distribution` PR-review backlog, planned as one run because two of them collide in the same file and the same generated distribution. **(1)** The orchestrator's *flat* makespan model takes a bare `max` over lanes and never charges the top-level integration lane, which Step 3j dispatches serially after every other lane is DONE — the defect ADR-0012/0014 corrected one level down and ADR-0014 explicitly filed as "not addressed here". **(2)** `clean-code-gates`' report schema forbids the `summary.gatesErrored` key its builder emits on every report and omits `"error"` from the summary `status` enum, so *every* report already fails its own schema, and the published consumer contract is a stale three-value vocabulary. **(3)** The Prime Agent port carries the read-only scan agent's Claude/opencode type resolution unrewritten, so resolution always finds nothing and both scan callers silently run inline in the orchestrator's own context on every Prime run.

Concern 2 is isolated (its own skill, its own suite) and lands first. Concerns 1 and 3 share `plugins/my-skills/skills/orchestrator/SKILL.md` and the same generated tree, so concern 1's prose lands **before** concern 3 authors its `count: 1` overlay anchors against that final text — the reverse order would have concern 1 invalidate anchors written against text that no longer exists.

## Acceptance Criteria

### Concern 2 — report status vocabulary

1. `plugins/my-skills/skills/clean-code-gates/schema/report.schema.json` declares `summary.properties.status.enum` as exactly `["pass", "warn", "blocked", "error"]`, declares `summary.properties.gatesErrored` as an array of strings (same shape as `gatesMissingTool`), and lists `gatesErrored` in `summary.required`. `additionalProperties: false` stays in force and `schemaVersion` stays `"1.0"`.
2. Every report `buildReport` emits — including one whose gate results contain a gate with `status: 'error'` — validates against `schema/report.schema.json` with **zero** violations under a validator that enforces `type`, `required`, `additionalProperties`, `properties`, `items`, `enum`, and `const`.
3. `__tests__/schema.test.cjs`'s validator reports at least one violation for each of five deliberately invalid reports: an unknown key inside `summary`, an unknown key at top level, an out-of-enum `summary.status`, an out-of-enum per-gate `status`, and an out-of-enum finding `severity`.
4. `npm test` in `plugins/my-skills/skills/clean-code-gates/` exits 0 with **0 failures** and a total test count **≥ 213** (the current baseline, re-confirmed green on this tree at planning time).
5. The existing `deepStrictEqual(statusEnum, ['pass','warn','blocked'])` assertion is **updated** to the four-value list, not deleted.
6. `clean-code-gates/SKILL.md`'s *Reading the report* contract line states the four-value `summary.status` vocabulary and names `report.summary.gatesErrored` alongside `report.summary.gatesMissingTool`.
7. `clean-code-gates/README.md` is corrected at both sites: the report-shape JSON block shows the four-value `status` and a `"gatesErrored": [...]` entry under `summary`; the *Consuming the report in orchestrators and fixer agents* example carries an explicit `error` branch cross-referencing exit code 4.
8. No emitted report byte changes — `src/report.cjs` is not modified.

### Concern 1 — top-level integration lane pricing

9. `references/config.md` → *The makespan model* defines, in the terms the sub-lane case already uses: viable-flat **`span_base`** = `max` over **non-integration** lanes of `tasks(L)` **plus** `tasks(integration)`; **`span_max`** = `max` over **non-integration** lanes of `span(L)` **plus** `tasks(integration)`; **`M_flat`** = that `span_base` + `A` + `J` + the parent contract's interface-point count. A declared `none` is `0`. The text states explicitly that `M_nested` needs **no** separate term because it is built on `span_max`.
10. `tasks(integration)` at the top level counts in full toward `T`, so `M_seq` is unchanged; the text says so.
11. `SKILL.md` → Step 2p.1's **lane-level** digest request asks for an `integration` field in ADR-0014's exact strict shape — either the literal `none`, or a named slice carrying mapped requirement IDs, candidate globs, and an **integer** task count. The strict-shape acceptance rule **enumerates** `integration` as an accepted field, and a lane-level split that **omits** it is **rejected outright**, not read as zero.
12. The declared top-level integration slice's requirement IDs and globs are stated to be disjoint from every lane's, it does not also appear as a lane row, and its globs satisfy the full *Owned-glob rejection* list in `references/config.md` → `lanes`.
13. The top-level integration lane is excluded from work-concentration conditions 1 and 2 at **both** evaluation sites — `references/config.md` → *The two work-concentration conditions are evaluated at leaf granularity* and → *Leaf-level re-application of the two work-concentration conditions* — with the one-level-up rationale stated (`{backend: 20, integration: 4}` must not read as "2 lanes carry work"). It is excluded from **those conditions only**, and counts in full in `span_base`, `span_max`, `M_flat`, and `T`.
14. The top-level integration lane is stated to be **never a sub-split candidate** at 2p.3n; `span(integration) = tasks(integration)` is a run constant.
15. The serial justification is stated at the definition site in `references/config.md`, citing the new ADR: Step 3j dispatches the top-level integration lane serially after all other lanes are DONE, never concurrently, and Step 3L dispatches no integration lane in the concurrent wave at either level.
16. `SKILL.md` → Step 2p.2's flat print block uses the flat `span_base` (non-integration `max` **plus** `tasks(integration)`) as the `Estimated speedup:` denominator instead of `largest lane tasks`, and makes the integration lane's contribution legible on screen. `Fixed overhead:` and `Interface points to freeze:` are unchanged.
17. `templates/architect.md` → region 5 *Integration lane* binds the **parent** contract's integration lane to the declared slice in the sub-contract's existing "verify against the real spec and tree, then freeze verbatim — do not re-derive, rename, or re-size" terms, with the same `contract violation` BLOCKED stop when verification shows the declared slice is wrong. The existing `none` handling and the single-lane exception are preserved unchanged.
18. `references/config.md` remains the single source of truth for the arithmetic — `SKILL.md` Step 2p states what the digest must **declare** and links; it does not restate the formulas.
19. Both existing worked examples are re-derived by hand with top-level `integration: none` declared explicitly, and **no figure in either moves** (both are `X = 0`). The re-derivation is recorded in the Progress Log, not assumed.
20. A **new** worked example is added to `references/config.md` exercising top-level `tasks(integration) > 0`, whose `span_base`, `span_max`, `M_flat`, `M_nested`, `M_seq`, `g`, `c`, and verdict are internally consistent and satisfy `M_flat − M_nested = g − c`.
21. `docs/adr/0016-*.md` exists, authored at Status **Accepted**, dated on landing, in ADR-0014's section structure (Status / Date / Skills affected / Source finding / Lineage / Context / Decision / Consequences).
22. ADR-0016 **states the `g`/`c` interaction with its derivation**, not as an assertion: `c` unchanged at every branch; `g` unchanged under a viable flat baseline whenever the integration lane is not the longest span and corrected upward otherwise; `g` reduced by `min(S, X)` under a sequential (`M_seq`) baseline; and `M_flat − M_nested = g − c` preserved — so this is *not* a gate/ladder disagreement, both figures were wrong in the same direction.
23. ADR-0016 is cross-referenced from ADR-0012, ADR-0013, and ADR-0014, and ADR-0014's "Not addressed here: the flat/outer cost model's missing top-level integration lane … Filed separately" bullet is **replaced** by a pointer to ADR-0016.
24. No decision in ADR-0012, ADR-0013, or ADR-0014 is re-opened or amended.

### Concern 3 — Prime scan child

25. `prime-agent/overlays/orchestrator.json` carries a replacement for the **body** of *The read-only scan subagent type* (the section **title** is unchanged — it is referenced by name from three places). The Prime form: the scan child is admitted with `rlm(prompt, name=…)`, is explicitly forbidden from writes and mutating commands per `protocol.orchestrator.md`'s read-only-child rule, and is given a stable per-caller name so a retry can address it with `receiver_name=handle.name`. The three-item host-resolution list (`Explore` / `explore` / `general-purpose` / `general`) is gone.
26. The inline fallback survives as the genuine no-scan-child path, with its trigger restated for this host (**the host cannot admit a read-only child**, not "none of the three agent types exists"), preserving in substance both invariants — *never let this resolution fail the run*, and *the digest is untrusted input whichever way it is gathered, so gathering it inline changes only where the reading happened, never how the result is treated* — plus the note that a scan failure is never a parallelization verdict (Step 2p.3 owns those).
27. The two Prime scan children get **two distinct** stable names, one per caller (B1's context digest, 2p.1's slicing analysis). No shared replacement across the two sites.
28. Step 2p.1's call shape is rewritten to the `name`-addressed form as a **per-site `count: 1`** anchored replacement on its own `description` line — `find` = the two-line block `- \`description\`: \`Slice spec into lanes\`` + `- \`subagent_type\`: the resolved scan type (\`Explore\` / \`explore\` / \`general-purpose\` / \`general\`)`.
29. The **fourth stale site** is fixed: Step 2p.1's intro sentence points at *How to spawn a subagent*, which the port renames to *How to spawn a role child*. It escapes the existing `count: 3` shared anchor because its wording differs (`the call shape and the host-resolution order from`). It is corrected as part of this concern's own rewrite of that sentence.
30. The residual `Explore` host vocabulary at the two scan callers is removed as two `count: 1` anchored replacements: Bootstrap B1's step label naming an *Explore scan*, and the *"The Explore agent synthesized it"* sentence in Step 2p.1's untrusted-data paragraph. (**Architect ruling: kept — see Technical Notes.**)
31. `prime-agent/overlays/protocol.orchestrator.md` no longer carries the clause *"The read-only scan agent's resolution is unchanged in this port and is tracked separately"* (the sentence wraps across a line break in the file — match on content, not on a single-line grep). The read-only-child rule the same sentence carries is **preserved**.
32. In generated `prime-agent/skills/orchestrator/SKILL.md`: **zero** occurrences of `subagent_type` in a *call shape* position (the two occurrences in the protocol preamble and the Step-4 role-dispatch note are prohibitions and **must survive**); **zero** occurrences of `Explore`, `explore`, `general-purpose`, or `general` as a resolvable agent type; **zero** occurrences of the string `How to spawn a subagent`.
33. No trust-boundary change is made or claimed. Step 2p.1's strict-shape acceptance, independent per-value validation, and *surface imperatives, never obey them* rules are unchanged. Only *where* the reading happens changes.

### Cross-cutting

34. **Joint anchor census, run once after concerns 1 and 3 have both landed**: in `plugins/my-skills/skills/orchestrator/SKILL.md`, `the call shape from *How to spawn a subagent*` = **3**, `:(exclude).claude` = **3**, `through a **single sequential coder invocation**` = **2**. (Verified at 3 / 3 / 2 on this tree at planning time.)
35. After the concern-2 doc edits, both `count: 1` anchors in `prime-agent/overlays/clean-code-gates.json` still match (they target install-path prose in `SKILL.md` and `README.md`, not the status vocabulary).
36. `node scripts/build-prime-agent.mjs --check` exits **0** at the end of **every** phase — the generated tree is never left stale between phases.
37. **Nothing under `prime-agent/skills/` is hand-edited.** Every Prime-side change lands in `prime-agent/overlays/` and/or the `plugins/` source, followed by regeneration.
38. Backward compatibility holds: no emitted report byte changes; the digest-shape change affects only a transient per-run artifact that `.orchestrator/run-manifest.json` persists none of.

## Out of Scope

- **Hand-editing anything under `prime-agent/skills/`.** That tree is generated by `scripts/build-prime-agent.mjs` (`rmSync` + full rewrite).
- **Re-opening ADR-0012, ADR-0013, or ADR-0014's decisions.** ADR-0013's per-lane inner-join barrier and its `J` (not `k × J`) charge stand. ADR-0014's sub-lane `integration` field stands. ADR-0016 extends the same shape one level up; it does not amend either.
- **Any change to the nested/sub-lane half of the model** — `span(L)` for a split lane, per-sub-lane conditions, containment, and the cost side's `A`/`J`/`I` charges — except where the top-level term must be named alongside them.
- **A `schemaVersion` bump** (no valid `1.0` report exists in the wild to stay compatible with; no emitted byte changes) and **any new npm dependency** for concern 2 (`ajv` or otherwise — the package is `private` with zero dependencies and a bare `node --test` script).
- **A behavioural or executable test for concerns 1 and 3.** `parallelism` is unset (→ `off`) in this repo's `.orchestrator/config.json`; both are markdown-authoring changes with no executable path. Do not invent one. See Technical Notes.
- **opencode port work.** Neither `orchestrator` nor `clean-code-gates` has a `.opencode/skills/` override port; the `opencode-port-parity` invariant applies only to `pr-review-report` and `spec-driven-eval`.
- **`simplify`-style cleanup of adjacent code** — e.g. `toMarkdown`'s now-redundant `r.summary.gatesErrored || []` guard. Leave it.
- **Renaming the Prime port's *The read-only scan subagent type* section title.** Body only — the title is referenced by name from Bootstrap B1, Step 2p.1, and the Step-2p summary line.
- **Running any test tooling against the doc skills.** `clean-code-gates`' suite is the only runtime gate in the repo and is scoped to that skill.
- **Committing or pushing.** The pipeline stops at READY_TO_COMMIT.

## Technical Notes

**Two architect rulings on the spec's droppable defaults** (both recorded per the spec's explicit off-ramps):

- **Bind the parent `PACT`'s Integration-lane region to the priced slice (AC-17) — KEEP.** This goes marginally beyond the backlog's literal fix list, but without it the term the model now prices has no binding to what Step 3j actually dispatches: an architect could freely re-author, rename, or re-size the integration lane and the `+X` charged at 2p.2 would describe a run that never happens. That is precisely the failure ADR-0014 §5 exists to prevent one level down, and the edit is one region of `templates/architect.md` reusing the sub-contract's existing verify-and-freeze phrasing — `mirror machinery`, not new machinery.
- **Clean the residual `Explore` host vocabulary at the two Prime scan callers (AC-30) — KEEP.** Not genuinely optional: AC-32 (the spec's own FR-33) requires *zero* occurrences of `Explore` / `explore` / `general-purpose` / `general` as a resolvable agent type in the generated Prime `SKILL.md`. Both source sites (`SKILL.md` Bootstrap B1's *Explore scan* step label and Step 2p.1's *"The Explore agent synthesized it"* sentence) name a Claude Code agent type in a port that has none, and would survive unrewritten. Dropping AC-30 would make the concern's own acceptance check unverifiable by a clean grep, replacing a zero with "zero except two we decided were fine".

**Locate every concern-1 site by content, never by the backlog's cited line numbers.** Those predate commit `d6ed529` (ADR-0013 adoption), which rewrote both *The makespan model* and *The cost side*. The defect is unaffected — `M_flat` and the viable-flat `span_base` still take a bare `max` over lanes — but the surrounding text differs.

**Anchor hazard — load-bearing.** The exact phrase `through a **single sequential coder invocation**` occurs **exactly twice** in `plugins/my-skills/skills/orchestrator/SKILL.md` and is a Prime overlay anchor asserted at `count: 2`. New prose added anywhere in `SKILL.md` must **not** reproduce that phrase or the build hard-fails. Paraphrase it, or quote it from `references/config.md`, which is not an anchored file for that phrase. The same discipline applies to `the call shape from *How to spawn a subagent*` (3) and `:(exclude).claude` (3) — verified at those counts on this tree.

**Cross-concern coupling.** Concerns 1 and 3 both touch Step 2p.1, but disjoint text: concern 1 edits the lane-level `integration` field and the strict-shape acceptance rule; concern 3 edits the call-shape block and the intro sentence. Neither `find` may absorb the other's. Phase order puts concern 1's prose in place first so concern 3 authors its anchors against final text; the joint census (AC-34) still runs once at the end.

**The arithmetic is already derived in the source spec — do not re-derive it, but preserve it as a checkable assertion.** With `X = tasks(integration_top)`, `N` the non-integration lanes, `M = max_{L∈N} tasks(L)`, `S = max_{L∈N} span(L)` (`S ≤ M`, `S = M` before any adoption): fixed `span_base = M + X` and `span_max = S + X`, so on a viable flat baseline `g = (M + X) − (S + X) = M − S` — the `+X` cancels identically because `X` is a run constant (AC-14 is what makes that exact). `c` touches only the overhead term and is unchanged at every branch. Both existing worked examples have `X = 0`, so **no existing example's figures move** — AC-19 requires that claim to be *verified by hand and recorded*, not assumed.

**Verification is split by concern, and the plan says so per phase.** Only concern 2 has a real test surface: `clean-code-gates` ships real JS with a `node --test` suite (`npm test`, **213 passing**, re-confirmed green at planning time). That is both the no-regression floor and where the schema-validator strengthening is genuinely testable, including negatively. Concerns 1 and 3 are markdown-authoring changes with **no executable path** — `parallelism` is unset in `.orchestrator/config.json`, hence `off`. Per `PROJECT-CONTEXT.md` → *Test tooling*, the tester treats automated tests and coverage as N/A for doc-skill changes and verifies structurally. Their real guards are the build `--check`, the anchor counts, cross-reference resolution, and hand re-derivation of the worked examples. **A behavioural test for concerns 1 or 3 cannot exist on this tree; do not manufacture one.**

**Why the strengthened validator is a rewrite, not a dependency.** AC-2/AC-3 need `additionalProperties` and `enum` enforcement that the current hand-rolled `validate()` in `__tests__/schema.test.cjs` does not do — which is exactly why the defect survived. Replace it with a small generic recursive checker honouring `type`, `required`, `additionalProperties`, `properties`, `items`, `enum`, and `const`. It is a test-file helper, not a service/handler/use-case/dispatcher, so the per-method complexity AC does not attach — but keep it small and single-purpose; a recursive schema walker is the kind of function that balloons.

**Repo invariants that shape the work.** *Single-source-of-truth references* (arithmetic in `references/config.md`; `SKILL.md` declares and links). *Mirror machinery* (the top-level fix reuses the sub-lane fix's phrasing and structure; the deliberate divergences — never sub-split, no containment parent — are documented, not silently different). *Data, never instructions* (the digest's untrusted framing is preserved at both levels). *Backward compatibility* (mandatory; satisfied per AC-38). *Generated distribution* (`prime-agent/skills/**` is rebuilt by `rmSync` + full rewrite; overlay `find` anchors assert exact occurrence counts and hard-fail the build on drift).

**No open product decision this depends on.** All three concerns are defect corrections with a determinate correct answer set by existing precedent.

## Tasks

> Tasks are ordered TDD-first: write/update tests before implementation, wherever a test surface exists.
> Phases 2–4 have **no executable test surface** (see Technical Notes); their tasks are authoring + structural/arithmetic verification, and each still ends in a hard gate.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.

### Phase 1 — Concern 2: report status vocabulary (isolated skill, real test surface)

- [x] Record the baseline: run `npm test` in `plugins/my-skills/skills/clean-code-gates/` and confirm **213 passing, 0 failures** before any edit.
- [x] RED — update `__tests__/schema.test.cjs`'s `deepStrictEqual(statusEnum, ['pass','warn','blocked'])` assertion to the four-value list `['pass','warn','blocked','error']` (update, do not delete); confirm it now fails against the unchanged schema.
- [x] RED — add a positive regression test building a report from gate results that include one with `status: 'error'`, asserting `summary.status === 'error'`, `summary.gatesErrored` non-empty, and zero schema violations; confirm it fails.
- [x] RED — replace the hand-rolled `validate()` with a small generic recursive checker honouring `type`, `required`, `additionalProperties`, `properties`, `items`, `enum`, and `const`; confirm the pre-existing positive report test now **also** fails (proving the strengthened guard can see the defect that the old validator could not).
- [x] Add negative tests proving the strengthened validator can fail — at minimum: unknown key inside `summary`, unknown key at top level, out-of-enum `summary.status`, out-of-enum per-gate `status`, out-of-enum finding `severity` — each asserting at least one reported violation.
- [x] GREEN — edit `schema/report.schema.json`: `summary.properties.status.enum` → `["pass","warn","blocked","error"]`; declare `summary.properties.gatesErrored` as an array of strings (mirroring `gatesMissingTool`); add `gatesErrored` to `summary.required`. Leave `additionalProperties: false` and `schemaVersion` `const: "1.0"` untouched, and do not modify `src/report.cjs`.
- [x] Update `clean-code-gates/SKILL.md`'s *Reading the report (for agents/orchestrators)* contract line to the four-value vocabulary, naming `report.summary.gatesErrored` alongside `report.summary.gatesMissingTool`.
- [x] Update `clean-code-gates/README.md` at both sites: the report-shape JSON block (four-value `status`, plus a `"gatesErrored": [...]` entry under `summary`) and the *Consuming the report in orchestrators and fixer agents* example (explicit `error` branch, cross-referencing exit code 4 — an errored gate measured nothing, and nothing measured must never read as pass).
- [x] Confirm both `count: 1` anchors in `prime-agent/overlays/clean-code-gates.json` still match after the doc edits (they target install-path prose, not the status vocabulary).
- [x] Run `### Phase 1 verification` and assert every command green before checking this task.

### Phase 2 — Concern 1a: the model, the digest declaration, and the contract binding

> No executable test exists for this phase. Verification is structural + the build `--check`.

- [x] Locate every concern-1 site **by content** in `references/config.md` (*The makespan model*, *The two work-concentration conditions are evaluated at leaf granularity*, *Leaf-level re-application of the two work-concentration conditions*) and in `SKILL.md` (Steps 2p.1, 2p.2, 2p.3n, 3L, 3j); record the located headings in the Progress Log. Do **not** trust the backlog's line numbers — they predate commit `d6ed529`.
- [x] `references/config.md` → *The makespan model*: define viable-flat `span_base` = `max` over non-integration lanes of `tasks(L)` + `tasks(integration)`; `span_max` = `max` over non-integration lanes of `span(L)` + `tasks(integration)`; `M_flat` = that `span_base` + `A` + `J` + parent interface-point count; a declared `none` is `0`; and state explicitly that `M_nested` needs no separate term because it is built on `span_max`.
- [x] `references/config.md`: state that `tasks(integration)` at the top level counts in full toward `T`, so `M_seq` is unchanged by this fix.
- [x] `references/config.md`: state the serial justification at the definition site, mirroring the existing sub-lane note (Step 3j dispatches it serially after all other lanes are DONE, never concurrently; Step 3L dispatches no integration lane in the concurrent wave at either level; a `max` over all lanes models an execution order the skill forbids, and does so optimistically), citing ADR-0016. **Do not reproduce the phrase `through a **single sequential coder invocation**` in `SKILL.md`** — see the anchor hazard in Technical Notes.
- [x] `references/config.md`: exclude the top-level integration lane from work-concentration conditions 1 and 2 at **both** evaluation sites, with the one-level-up rationale, and state that the exclusion is from those conditions **only** — it counts in full in `span_base`, `span_max`, `M_flat`, and `T`.
- [x] `references/config.md` → 2p.3n coverage: state that the top-level integration lane is **never** a sub-split candidate, and that `span(integration) = tasks(integration)` is a run constant.
- [x] `SKILL.md` → Step 2p.1: add the `integration` field to the **lane-level** digest request in ADR-0014's strict shape (literal `none`, or a named slice with mapped requirement IDs + candidate globs + integer task count).
- [x] `SKILL.md` → Step 2p.1: enumerate `integration` in the strict-shape acceptance rule as an accepted field, and state that a lane-level split omitting it is **rejected outright**, not read as zero ("not declared" and "declared none" are different claims; only the second is safe to price).
- [x] `SKILL.md` → Step 2p.1: state that the declared top-level integration slice is a slice in its own right — requirement IDs and globs disjoint from every lane's, not also a lane row, globs satisfying the full *Owned-glob rejection* list.
- [x] `SKILL.md` → Step 2p.2: change the flat print block's `Estimated speedup:` denominator to the flat `span_base` (non-integration `max` **plus** `tasks(integration)`) instead of `largest lane tasks`, and make the integration lane's contribution legible on screen rather than folded invisibly into one number. Leave `Fixed overhead:` and `Interface points to freeze:` unchanged.
- [x] Verify `SKILL.md` Step 2p **declares and links** only — confirm no formula from `references/config.md` was restated there (single-source-of-truth convention).
- [x] `templates/architect.md` → region 5 *Integration lane*: bind the **parent** contract's integration lane to the declared slice in the sub-contract's existing "verify against the real spec and tree, then freeze verbatim — do not re-derive, rename, or re-size" terms, with the same `contract violation` BLOCKED stop; preserve the existing `none` handling and the single-lane exception unchanged. Add a pointer from region 2 *Path ownership* only if the disjointness statement needs one.
- [x] Run `### Phase 2 verification` and assert every command green before checking this task.

### Phase 3 — Concern 1b: worked examples and ADR-0016

> No executable test exists for this phase. Verification is hand arithmetic + structural + the build `--check`.

- [x] Re-derive **by hand** the two existing worked examples in `references/config.md` with top-level `integration: none` declared explicitly, and record the full working in the Progress Log. Assert **no figure in either example moves** (both are `X = 0`). If any figure does move, STOP and report — the derivation in Technical Notes is wrong and the plan needs revisiting.
- [x] Add the two existing examples' explicit top-level `integration: none` declaration to their digests so they exercise the new required field rather than silently predating it.
- [x] Add a **new** worked example to `references/config.md` exercising top-level `tasks(integration) > 0`, following the existing examples' shape and heading style.
- [x] Verify the new example by hand: `span_base`, `span_max`, `M_flat`, `M_nested`, `M_seq`, `g`, `c`, and the verdict are internally consistent, and `M_flat − M_nested = g − c` holds exactly. Record the working in the Progress Log.
- [x] Author `docs/adr/0016-*.md` at Status **Accepted**, dated on landing, in ADR-0014's section structure (Status / Date / Skills affected / Source finding / Lineage / Context / Decision / Consequences). `0015` is the highest existing ADR — confirmed on this tree.
- [x] In ADR-0016, state the `g`/`c` interaction **with its derivation**: `c` unchanged at every branch; `g` unchanged under a viable flat baseline whenever the integration lane is not the longest span and corrected upward otherwise; `g` reduced by `min(S, X)` under a sequential baseline (the optimistic direction the finding names); and `M_flat − M_nested = g − c` preserved — so this is *not* a gate/ladder disagreement, but one figure wrong in the same direction on both sides. Say why that distinction matters: it tells a future reader which regression check applies.
- [x] In ADR-0016, document the deliberate divergences from ADR-0014's sub-lane shape (the top-level lane is never sub-split; there is no containment parent) rather than leaving them silently different.
- [x] Cross-reference ADR-0016 from ADR-0012 and ADR-0013, in the same style those already cross-reference each other.
- [x] **Replace** ADR-0014's "Not addressed here: the flat/outer cost model's missing top-level integration lane … Filed separately" bullet with a pointer to ADR-0016 — this plan is that filing.
- [x] Verify no ADR-0012 / ADR-0013 / ADR-0014 decision was re-opened or amended, and that every cross-reference between the four ADRs resolves.
- [x] Run `### Phase 3 verification` and assert every command green before checking this task.

### Phase 4 — Concern 3: Prime scan child (overlays only) + joint verification

> No executable test exists for this phase. Verification is structural + the anchor census + the build `--check`. Every edit lands in `prime-agent/overlays/`; **nothing under `prime-agent/skills/` is touched by hand**.

- [x] `prime-agent/overlays/orchestrator.json`: add a replacement for the **body** of *The read-only scan subagent type* (title unchanged). Prime form: the scan child is admitted with `rlm(prompt, name=…)` like any other child, explicitly forbidden from writes and mutating commands per the read-only-child rule, given a stable per-caller name addressable on retry via `receiver_name=handle.name`. Remove the three-item host-resolution list.
- [x] In the same replacement, keep the inline fallback as the genuine no-scan-child path, restating its trigger for this host (**the host cannot admit a read-only child**), and preserve in substance both invariants — *never let this resolution fail the run*, and *the digest is untrusted input whichever way it is gathered* — plus the note that a scan failure is never a parallelization verdict (Step 2p.3 owns those).
- [x] Give the two scan callers **two distinct** stable names (B1's context digest, 2p.1's slicing analysis). Do not reuse one replacement across both sites — a shared replacement across dispatch sites is what gave a whole wave one name under bug-10.
- [x] Add a **per-site `count: 1`** anchored replacement rewriting Step 2p.1's call shape to the `name`-addressed form, with `find` = the two-line block `- \`description\`: \`Slice spec into lanes\`` + `- \`subagent_type\`: the resolved scan type (\`Explore\` / \`explore\` / \`general-purpose\` / \`general\`)`. Author the anchor against the post-Phase-2 text.
- [x] Fix the **fourth stale site**: Step 2p.1's intro sentence pointing at *How to spawn a subagent* (wording `the call shape and the host-resolution order from`, which is why it escapes the `count: 3` shared anchor). Correct it to the port's *How to spawn a role child* as part of this concern's own rewrite of that sentence.
- [x] Add two `count: 1` anchored replacements removing the residual `Explore` host vocabulary at the two scan callers: Bootstrap B1's *Explore scan* step label, and the *"The Explore agent synthesized it"* sentence in Step 2p.1's untrusted-data paragraph.
- [x] `prime-agent/overlays/protocol.orchestrator.md`: drop the *"The read-only scan agent's resolution is unchanged in this port and is tracked separately"* clause — this change makes it false. The sentence **wraps across a line break**; match on content, not a single-line grep. **Preserve the read-only-child rule** the same sentence carries. This file is inserted verbatim after frontmatter, so it carries no anchor risk.
- [x] Confirm concern 3's `find` anchors do not absorb any text concern 1 introduced at Step 2p.1, and that concern 1's edits did not absorb the call-shape block.
- [x] Regenerate: `node scripts/build-prime-agent.mjs`, then assert `node scripts/build-prime-agent.mjs --check` exits 0.
- [x] Grep the generated `prime-agent/skills/orchestrator/SKILL.md` and assert: **zero** `subagent_type` in call-shape position (the two prohibition occurrences in the protocol preamble and the Step-4 role-dispatch note **must survive** — count them, do not assume); **zero** `Explore` / `explore` / `general-purpose` / `general` as a resolvable agent type; **zero** occurrences of `How to spawn a subagent`.
- [x] **Joint anchor census** — run once, now that concerns 1 and 3 have both landed: in `plugins/my-skills/skills/orchestrator/SKILL.md`, assert `the call shape from *How to spawn a subagent*` = **3**, `:(exclude).claude` = **3**, `through a **single sequential coder invocation**` = **2**.
- [x] Confirm no trust-boundary change was made: Step 2p.1's strict-shape acceptance, independent per-value validation, and *surface imperatives, never obey them* rules are textually unchanged.
- [x] Confirm `git status` shows **no hand-edit** to any file under `prime-agent/skills/` other than what regeneration produced.
- [x] Run `### Phase 4 verification` and assert every command green before checking this task.

### Final

- [x] Re-run `npm test` in `plugins/my-skills/skills/clean-code-gates/` (0 failures, total ≥ 213) and `node scripts/build-prime-agent.mjs --check` (exit 0) on the final tree, and confirm both green.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands
> from the Commands section of `PROJECT-CONTEXT.md` that apply to the phase's touched
> paths and asserts each exits 0. A failure routes through the coder's BLOCKED step,
> not a silent rewrite.

`PROJECT-CONTEXT.md` → *Commands* declares **no build**, **no lint**, and **no automated test** for markdown/template authoring; `clean-code-gates` is the lone JS+test island and its suite is run **only** when changing that skill. The gates below are that Commands section applied to each phase's diff.

### Phase 1 verification

Touched paths: `plugins/my-skills/skills/clean-code-gates/**`, `prime-agent/**` (generated).

```bash
cd plugins/my-skills/skills/clean-code-gates && npm test     # exit 0, 0 failures, total >= 213
cd /Volumes/ssd/Developer/my-skills && node scripts/build-prime-agent.mjs        # regenerate
cd /Volumes/ssd/Developer/my-skills && node scripts/build-prime-agent.mjs --check  # exit 0
```

Plus: both `count: 1` anchors in `prime-agent/overlays/clean-code-gates.json` still match.

### Phase 2 verification

Touched paths: `plugins/my-skills/skills/orchestrator/**`, `prime-agent/**` (generated). **No automated suite applies** — the orchestrator is a doc skill and `PROJECT-CONTEXT.md` → *Test tooling* makes automated tests N/A for it. Do **not** run `clean-code-gates`' suite against it.

```bash
node scripts/build-prime-agent.mjs          # regenerate — never leave the tree stale
node scripts/build-prime-agent.mjs --check  # exit 0
```

Structural assertions (per `PROJECT-CONTEXT.md` → *Test tooling*):

- Every cross-reference introduced between `SKILL.md`, `references/config.md`, and `templates/architect.md` resolves.
- `SKILL.md` Step 2p declares and links; no `references/config.md` formula is restated there.
- The new prose does not reproduce `through a **single sequential coder invocation**` in `SKILL.md`.
- The new machinery is described symmetrically to the sub-lane machinery it mirrors; deliberate divergences are documented.

### Phase 3 verification

Touched paths: `plugins/my-skills/skills/orchestrator/references/config.md`, `docs/adr/**`, `prime-agent/**` (generated). **No automated suite applies.**

```bash
node scripts/build-prime-agent.mjs
node scripts/build-prime-agent.mjs --check  # exit 0
```

Arithmetic assertions (the real guard for this phase — hand-derived, working recorded in the Progress Log):

- Both existing worked examples re-derived with `integration: none`; **no figure moves**.
- The new `X > 0` example's `span_base`, `span_max`, `M_flat`, `M_nested`, `M_seq`, `g`, `c`, and verdict are internally consistent.
- `M_flat − M_nested = g − c` holds exactly in the new example.
- ADR-0016's stated `g`/`c` results match the derivation it carries.
- Every cross-reference among ADR-0012 / 0013 / 0014 / 0016 resolves; ADR-0014's "Filed separately" bullet is replaced, not merely appended to.

### Phase 4 verification

Touched paths: `prime-agent/overlays/**`, `prime-agent/**` (generated). **No automated suite applies.**

```bash
node scripts/build-prime-agent.mjs
node scripts/build-prime-agent.mjs --check  # exit 0
```

Structural assertions — the **joint** post-condition for concerns 1 and 3, run once here and not per-concern:

```bash
S=plugins/my-skills/skills/orchestrator/SKILL.md
grep -c 'the call shape from \*How to spawn a subagent\*' "$S"      # 3
grep -c ':(exclude).claude' "$S"                                     # 3
grep -c 'through a \*\*single sequential coder invocation\*\*' "$S"  # 2

G=prime-agent/skills/orchestrator/SKILL.md
grep -c 'How to spawn a subagent' "$G"                               # 0
grep -nE '\bExplore\b|\bexplore\b|general-purpose|\bgeneral\b' "$G"   # no resolvable-agent-type hits
grep -n 'subagent_type' "$G"                                          # only the 2 prohibitions survive
```

Plus: `git status` shows no hand-edit under `prime-agent/skills/` beyond regeneration output.

**Phase exit criterion (all phases):** ALL applicable commands exit 0 on the changed set, and every structural/arithmetic assertion listed for the phase holds. No silent rewrite of source to make a gate pass without a corresponding plan task.

G1 (coverage) and G6 (mutation) are NOT gates here — they remain QA-only.

## Dependencies

None. Both in-flight predecessor specs (`SPEC-20260819T000458Z-bfac`, `SPEC-20260819T034803Z-18d2`) are already reflected in the current tree — commit `d6ed529` adopted ADR-0013 — and every fact this plan asserts (ADR-0015 highest, anchor counts 3 / 3 / 2, 213 tests green, three-value enum still in the schema) was verified against the working tree at planning time.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T05:34:56Z | ARCHITECT

Plan `FEAT-20260819T053237Z-236f` created. Type: feat. Tasks: 49.
Status: PLANNED. Ready for coder.

Facts verified against the tree before writing (not taken from the spec on faith):
- `docs/adr/` — `0015` is the highest existing ADR; `0016` is free.
- `plugins/my-skills/skills/orchestrator/SKILL.md` anchor counts: `the call shape from *How to spawn a subagent*` = 3, `:(exclude).claude` = 3, `through a **single sequential coder invocation**` = 2.
- `clean-code-gates` `npm test` → 213 passing, 0 failures (the no-regression floor).
- `schema/report.schema.json` → `summary.properties.status.enum` is still `["pass","warn","blocked"]`; `summary.required` is `["status","gatesRun","gatesMissingTool","blockers","warnings"]` with no `gatesErrored`; `additionalProperties: false` in force. The defect reproduces as specified.
- `prime-agent/overlays/protocol.orchestrator.md` carries the "tracked separately" clause **wrapped across a line break** — a single-line grep misses it. Noted in AC-31 and the Phase 4 task.
- Generated `prime-agent/skills/orchestrator/SKILL.md` ~line 494 carries the fourth stale site (`the call shape and the host-resolution order from *How to spawn a subagent*`), confirming it escapes the `count: 3` shared anchor.
- Source `SKILL.md` `Explore` occurrences at lines 25, 137, 459, 486 — line 137 is the resolution list (concern 3's main target), 25 and 486 are the two caller-site vocabulary hits (AC-30), 459 is the call-shape block (AC-28).

Two architect rulings on the spec's droppable defaults, both **KEEP**, reasoning recorded in Technical Notes: binding the parent `PACT`'s Integration-lane region (AC-17), and cleaning the residual `Explore` host vocabulary at the two Prime scan callers (AC-30 — not genuinely optional, since AC-32's zero-occurrence check depends on it).

Phase ordering diverges deliberately from the spec's "concerns 1 and 3 land together": concern 1's prose lands in Phase 2–3 **before** concern 3 authors its `count: 1` overlay anchors in Phase 4, so those anchors are written against final text. The spec's joint anchor census is preserved unchanged — run once, at the end of Phase 4.

### 2026-08-19T06:05:00Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-19T07:30:00Z | CODER

Phase 4 complete (Concern 3 — Prime scan child, overlays only) + the joint census.

Five `count: 1` replacements appended to `prime-agent/overlays/orchestrator.json` (16 → 21):
1. The **body** of *The read-only scan subagent type* (title unchanged — referenced by name from B1, 2p.1, and the Step-2p summary line). Prime form: admitted with `rlm(prompt, name=…)`, explicitly forbidden from writes and mutating commands per the read-only-child rule, given a stable per-caller name addressable on retry via `receiver_name=handle.name`. The three-item host-resolution list is gone. The inline fallback survives with its trigger restated for this host (**the host cannot admit a read-only child**), both invariants preserved in substance, and the "a scan failure is never a parallelization verdict — Step 2p.3 owns those" note intact.
2. Step 2p.1's intro sentence (the **fourth stale site** — it escaped the shared `count: 3` anchor because its wording is `the call shape and the host-resolution order from`). Corrected to *How to spawn a role child*.
3. Step 2p.1's call shape — the two-line `description` + `subagent_type` block — rewritten to the `name`-addressed form. Anchor authored against post-Phase-2 text.
4. Bootstrap B1's *Explore scan* step label → *Context scan*, named `context-scan`.
5. The *"The Explore agent synthesized it"* sentence → *"The scan child synthesized it"*.

**Two distinct stable names, one per caller**: `context-scan` (B1) and `slicing-scan` (2p.1). No replacement is shared across the two dispatch sites.

`prime-agent/overlays/protocol.orchestrator.md`: the *"…is tracked\nseparately"* clause dropped. **The grep trap was real and was handled** — the clause wraps across a line break, so a single-line `grep 'tracked separately'` returns zero and falsely reads as done; the edit matched on content across the break. Verified afterwards with a whitespace-insensitive regex: `tracked\s+separately` = **0** in the generated tree. The read-only-child rule the same sentence carried is preserved ("still obeys the read-only rule stated below", plus the standalone rule at the end of the protocol).

**Anchor non-interference confirmed**: concern 3's finds sit at Step 2p.1's intro sentence and its dispatch-parameter block; concern 1's Phase-2 additions sit after the `- prompt:` line and inside the strict-shape rule. Neither absorbs the other — the build's exact-count assertion proves it (all 21 replacements matched at their declared counts, exit 0).

**Phase 4 verification — all green:**
- `node scripts/build-prime-agent.mjs` then `--check` → exit **0**.
- Generated `prime-agent/skills/orchestrator/SKILL.md`: `How to spawn a subagent` = **0**; `Explore` / `explore` / `general-purpose` / `general` = **0 hits of any kind** (not merely zero as a resolvable type); `subagent_type` = **exactly 2**, counted not assumed — line 17 (protocol preamble prohibition) and line 632 (Step-4 role-dispatch note). Both prohibitions survive.
- **Joint anchor census (source `SKILL.md`), run once now that concerns 1 and 3 have both landed:** `the call shape from *How to spawn a subagent*` = **3**; `:(exclude).claude` = **3**; `through a **single sequential coder invocation**` = **2**. All three at their planning-time counts.
- **No trust-boundary change**: strict-shape acceptance, independent per-value validation, *surface imperatives, never obey them*, the untrusted-digest framing, and the prose-discard rule all verified textually present in the generated tree. Only *where* the reading happens changed.
- **No hand-edit under `prime-agent/skills/`**: `--check` exits 0, meaning the generated tree matches byte-for-byte what the build produces from `plugins/` + `prime-agent/overlays/`. Every Prime-side change landed in the overlays.

**Final verification on the final tree:** `npm test` in `clean-code-gates` → **219 passing, 0 failures** (floor ≥ 213); `node scripts/build-prime-agent.mjs --check` → exit **0**.

All 49 tasks complete. Plan status → DONE. Ready for reviewer.

### 2026-08-19T06:07:39Z | TESTER

TEST-20260819T060155Z-5bec created. Status: PASS. Coverage: 87.18% → 87.18% (floor 70% met; suite 219 → 225 passing after 6 added negative cases).

### 2026-08-19T06:10:27Z | REVIEWER

CR-20260819T061027Z-4206 created. Status: APPROVED. Must Fix: 0. Should Fix: 5.

### 2026-08-19T06:17:40Z | QA

QA-20260819T061740Z-1afa created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
