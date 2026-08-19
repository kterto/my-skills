---
id: CR-20260819T061027Z-4206
plan: FEAT-20260819T053237Z-236f
title: Review of Top-level integration lane pricing, report status vocabulary, and Prime scan child
status: APPROVED
created_at: 2026-08-19T06:10:27Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 5
---

**Related:** [FEAT-20260819T053237Z-236f](../feat/FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md) · [SPEC-20260819T052229Z-3d97](../specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md) · [TEST-20260819T060155Z-5bec](../test/TEST-20260819T060155Z-5bec-integration-lane-schema-prime-scan.md)

## Summary

Three concerns, three verification surfaces, all judged on their own terms and all verified independently rather than on report. The arithmetic was re-derived by hand — including the new `X > 0` example and the `M_flat − M_nested = g − c` identity — the `clean-code-gates` suite was run (225 passing, 0 failures), and the generated Prime tree was grepped against a fresh `--check`. Every one of the 38 acceptance criteria is met; the four open items routed here are ruled on below and none of them is a blocker.

Verdict: **APPROVED**, with five Should Fix items, four of which are follow-up filings rather than defects in this work.

## Independent verification (re-derived, not accepted on report)

**Floors, all re-run on this tree:**

| Floor | Required | Measured |
|---|---|---|
| `clean-code-gates` suite | 225, 0 failures | **225 pass, 0 fail** |
| `build-prime-agent.mjs --check` | exit 0 | **exit 0** (`11 skills, 154 files`, up to date) |
| Anchor `the call shape from *How to spawn a subagent*` | 3 | **3** |
| Anchor `:(exclude).claude` | 3 | **3** |
| Anchor `through a **single sequential coder invocation**` | 2 | **2** |
| Generated `How to spawn a subagent` | 0 | **0** |
| Generated `Explore`/`explore`/`general-purpose`/`general` | 0 | **0 hits of any kind** |
| Generated `subagent_type` (prohibitions only) | 2 | **2** — lines 17 and 632, both prohibitions |
| Generated `tracked\s+separately` (whitespace-insensitive) | 0 | **0** |

**The new `X > 0` worked example, re-derived from scratch.** Lanes `{backend: 20, frontend: 12, admin: 6}` + `wiring` at `X = 4`; parent contract 4 interface points, sub-contract 2; `A = J = 2`; interface point = 0.25 task-equivalents.

- `T` = 20 + 12 + 6 + 4 = **42**. Flat verdict: 3 non-integration lanes ≥ 2; `20/42` = 47.6% ≈ **48%** ≤ 70% → **viable**, baseline `M_flat`. ✅
- `M` = max(20, 12, 6) = 20 → `span_base` = `M + X` = **24**. Flat overhead = 2 + 2 + (4 × 0.25) = **5**. `M_flat` = **29**. ✅
- `backend` → `{8, 8}`, `integration: none` → `span(backend)` = 8. `S` = max(8, 12, 6) = 12 → `span_max` = `S + X` = **16**. Nested overhead = 2 + 2 + 2 + 2 + (6 × 0.25) = **9.5**. `M_nested` = **25.5**. ✅
- `g` = 24 − 16 = **8**; via the identity `g` = `M − S` = 20 − 12 = **8** — the two agree, as the cancellation requires. `c` = 2 + 2 + 0.5 = **4.5**, and it equals the overhead delta 9.5 − 5 = 4.5, so the cost side is internally consistent. `8 > 4.5` → **adopted**. ✅
- **Reconciliation: `M_flat − M_nested` = 29 − 25.5 = 3.5 = `g − c` = 8 − 4.5 = 3.5.** Exact. ✅
- Residual gates re-checked: aggregate interface count 4 + 2 = 6 ≤ `T` = 42 ✅; leaf set `{8, 8, 12, 6}` → 4 non-integration leaves ≥ 2, largest `12/42` = 28.6% ≈ 29% ≤ 70% ✅; 4 concurrent leaves ≤ `max_parallel_lanes` 6 ✅. `frontend` `{11, 1}` → `11/12` = 91.7% ≈ 92% > 70%, correctly rejected ✅. `admin` split leaves `span_max` at 16 → `g = 0`, correctly not adopted ✅.
- The example's *"what this is actually pinning"* paragraph also re-derives correctly under the old model: `span_base` = max(20, 4) = 20, `span_max` = max(12, 4) = 12, `g` = 8 either way, `25 − 21.5` = 3.5 reconciling either way, both makespans understated by exactly `X = 4`. ✅

**The central derivation holds in the shipped text.** `references/config.md:237` fixes `span_base = M + X`, `:235` fixes `span_max = S + X`, and the block at `:240` states `g = (M + X) − (S + X) = M − S` with the `+X` cancelling because `X` is a run constant — which `:234` and the *Greedy, recomputed adoption* addition make exact by declaring the lane never a sub-split candidate. `c` is confirmed unchanged at every branch: `X` enters no overhead term at either level, and I checked that against the cost side rather than taking the ADR's word.

**Both existing-example claims verified.** All four pre-existing worked examples declare `integration: none` at the lane level and the diff moves **no figure** in any of them — the only changes inside those examples are the setup sentences adding the explicit declaration. The ADR-0013 example is the one where a mistake would show (`max(24, 10, 4)` under both models): 24 either way. ✅

**`gatesErrored` provenance verified against history, not asserted.** `git log -L` confirms the emitter has produced `gatesErrored` unconditionally since **56daf17** (`fix(clean-code-gates): a gate that cannot run must not report pass`), and `merge-base --is-ancestor` confirms 56daf17 is in `main` and an ancestor of the review base. The compat debt was incurred there, not here.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Schema: 4-value enum, `gatesErrored` array, in `required`, `additionalProperties`/`schemaVersion` untouched | ✅ | `report.schema.json:54,59,69` — verified by read, not diff |
| 2 | Every `buildReport` output incl. an errored gate validates with zero violations | ✅ | Positive tests green under the strengthened validator |
| 3 | ≥1 violation for each of five deliberately invalid reports | ✅ | 11 negative cases shipped, the required 5 among them |
| 4 | `npm test` exit 0, 0 failures, total ≥ 213 | ✅ | **225 pass, 0 fail** — re-run |
| 5 | `deepStrictEqual(statusEnum, …)` updated, not deleted | ✅ | `schema.test.cjs:107` |
| 6 | `SKILL.md` contract line: 4-value vocabulary + `gatesErrored` | ✅ | Names both `gatesErrored` and `gatesMissingTool` |
| 7 | `README.md` corrected at both sites incl. explicit `error` branch + exit 4 | ✅ | Both sites, plus the `missing_tool` paragraph extended |
| 8 | No emitted report byte changes — `src/report.cjs` not modified | ✅ | `git diff --stat -- src/` empty |
| 9 | `span_base` / `span_max` / `M_flat` defined with `+ tasks(integration)`; `none` = 0; `M_nested` needs no term | ✅ | `config.md:235,237,239` |
| 10 | `tasks(integration)` counts in full toward `T`; `M_seq` unchanged, stated | ✅ | `config.md:238` |
| 11 | Step 2p.1 lane-level `integration` field in ADR-0014's strict shape; omission rejected outright | ✅ | `SKILL.md:463` + strict-shape rule at `:490` |
| 12 | Slice disjoint from every lane, not a lane row, globs pass owned-glob rejection | ✅ | Stated at both `SKILL.md` and `config.md:230` |
| 13 | Excluded from conditions 1 & 2 at **both** sites, with rationale, exclusion bounded | ✅ | `config.md:74` and `:495` — both carry the `{backend: 20, integration: 4}` rationale |
| 14 | Never a sub-split candidate; `span(integration)` a run constant | ✅ | `config.md:234` + *Greedy, recomputed adoption* |
| 15 | Serial justification at the definition site, citing the new ADR | ✅ | `config.md:232` — cites 3j and 3L at both levels |
| 16 | Step 2p.2 denominator is flat `span_base`, integration legible; overhead lines unchanged | ✅ | `SKILL.md:503`+ — new `Integration lane:` line, expanded denominator |
| 17 | `templates/architect.md` region 5 binds the **parent** integration lane, verify-and-freeze, BLOCKED stop | ✅ | Existing `none` handling and single-lane exception preserved; multi-lane `none` distinguished |
| 18 | `config.md` remains single source of truth; Step 2p declares and links | ✅ | Both new SKILL.md blocks explicitly disclaim restating |
| 19 | Both existing examples re-derived with `integration: none`; **no figure moves** | ✅ | Re-derived here independently — confirmed |
| 20 | New `X > 0` example internally consistent, `M_flat − M_nested = g − c` | ✅ | Re-derived here — exact at 3.5 |
| 21 | ADR-0016 exists, Accepted, dated, in ADR-0014's section structure | ✅ | All eight sections present |
| 22 | ADR-0016 states the `g`/`c` interaction **with derivation** | ✅ | Derivation present and correct; one case gap → SF-1 |
| 23 | Cross-referenced from 0012/0013/0014; 0014's "Filed separately" bullet **replaced** | ✅ | Replaced, not appended — verified in the diff |
| 24 | No 0012/0013/0014 decision re-opened or amended | ✅ | Additions are pointers only |
| 25 | Overlay replaces the **body** of *The read-only scan subagent type*; title unchanged; resolution list gone | ✅ | Generated `:171–181` |
| 26 | Inline fallback survives with host-correct trigger + both invariants + the no-verdict note | ✅ | `:179–181` — trigger reads "host cannot admit a read-only child" |
| 27 | Two **distinct** stable names, one per caller | ✅ | `context-scan` (B1) / `slicing-scan` (2p.1) |
| 28 | Step 2p.1 call shape rewritten as a per-site `count: 1` on its own two-line block | ✅ | Overlay `find` matches the exact two-line block |
| 29 | Fourth stale site corrected to *How to spawn a role child* | ✅ | Generated `:494` |
| 30 | Two `count: 1` removals of residual `Explore` vocabulary at the scan callers | ✅ | B1 step label → *Context scan*; *"The scan child synthesized it"* |
| 31 | `protocol.orchestrator.md` "tracked separately" clause gone; read-only rule preserved | ✅ | Line-break trap handled; whitespace-insensitive grep = 0 |
| 32 | Generated tree: zero call-shape `subagent_type` / zero host agent types / zero `How to spawn a subagent` | ✅ | Counted, not assumed — 2 prohibitions survive at `:17`, `:632` |
| 33 | No trust-boundary change made or claimed | ✅ | Strict-shape acceptance, per-value validation, *surface never obey* all textually intact |
| 34 | Joint anchor census 3 / 3 / 2 | ✅ | Re-run |
| 35 | Both `clean-code-gates.json` overlay anchors still match | ✅ | Implied and proven by `--check` exit 0 (exact-count assertion) |
| 36 | `--check` exits 0 at the end of every phase | ✅ | Verified green on the final tree; per-phase greens taken from the Progress Log |
| 37 | Nothing under `prime-agent/skills/` hand-edited | ✅ | `--check` exit 0 proves byte-identity with build output |
| 38 | Backward compatibility holds | ✅ | See ruling R2 |

## Rulings on the four routed open items

### R1 — Validator honours 7 of the schema's 10 keywords: **file it, do not widen here**

I tested the tester's framing rather than accepting it, and it holds — with one correction that makes the case stronger, not weaker.

AC-2 and AC-3 do not merely happen to name seven keywords; they name them as the *definition* of the guard: "a validator that enforces `type`, `required`, `additionalProperties`, `properties`, `items`, `enum`, and `const`". The plan's Technical Notes name the same seven and add an explicit instruction against exactly the widening being proposed: *"keep it small and single-purpose; a recursive schema walker is the kind of function that balloons."* The implementation honours exactly seven. The criteria are met literally and in spirit; the gap is in the criteria's ambition, not in the work.

The correction: the unenforced set is `pattern` (1 site), `format` (1 site), and `minimum` at **four** sites — `summary.blockers`, `summary.warnings`, `findings.line`, `findings.endLine` — not two.

On the named live risk, I checked rather than reasoned. **`line: 0` is not reachable on this tree.** Every finding-construction site already floors the value: `g5-no-comments.cjs:66` uses `idx + 1`; `node-ts.cjs` uses `line: 1` or `m.line || 1` at all five sites; `dart-flutter.cjs` uses `line: 1` or `Number(lineNo) || 1` at all five. So the risk is not "an adapter reporting a file-level finding violates `minimum: 1` silently" today — it is that a *future* adapter could regress there and the fixture would not notice. Combined with the tester's own point that nothing in `src/` validates at runtime, the exposure is: a latent regression-detection gap in a test fixture, one class of regression deep, on a value every current producer already normalizes.

That is a follow-up, not a blocker, and widening it inside this plan would be scope creep against an explicitly bounded task. **Ruling: file it.** The follow-up should amend AC-2/AC-3 to the full keyword set and add `pattern`/`minimum` to the checker in the same change, so the criteria and the implementation move together rather than the implementation drifting ahead of what was specified. Recorded as SF-2.

### R2 — `gatesErrored` in `summary.required`: **keep it; the invariant is not breached**

The conventions check pointed at a real invariant, and the routing was right — this deserved a ruling rather than a silent flip. It resolves in favour of keeping it.

I verified the mitigating facts rather than accepting them: `gatesErrored` has been emitted unconditionally since 56daf17, which `git merge-base --is-ancestor` confirms is in `main` and an ancestor of this change's base. So **no report the shipped CLI can emit is invalidated by this change**, and the only artifact class newly failing validation is one produced before 56daf17 by a CLI that no longer exists.

More decisively, read the invariant's operative clause: *"legacy artifacts render + execute unchanged, no forced migration."* Rendering and execution are untouched — `src/report.cjs`'s `toMarkdown` reads `(r.summary.gatesErrored || [])` defensively, and **nothing in `src/` validates against the schema at runtime at all**. There is no code path on which a legacy artifact newly fails. What changed is a documented contract's accuracy, and `required` is now the *true* statement about that contract: the emitter always emits the key. Making it optional would trade a correct contract for a weaker one in exchange for compatibility with artifacts no shipped code produces, reads, or validates.

The counter-consideration is the one that would have mattered if the compat exposure had been real: AC-1 specifies `required` explicitly, and reversing a spec'd decision inside a review pass is the wrong instrument. Both point the same way here.

### R3 — `schemaVersion` deliberately not bumped: **the reasoning holds, and AC-8 independently requires it**

The offered reasoning is sound on its own terms: the shape being described is the shape consumers have been receiving since 56daf17, so a bump would force every consumer pinning `"1.0"` to migrate in order to learn nothing new — the forced migration the invariant forbids. A version bump signals *"the payload changed"*; the payload did not.

It is also over-determined. `schemaVersion` is `const: "1.0"` in the schema and a literal `'1.0'` in `report.cjs`, so a bump would require editing `src/report.cjs` and changing emitted report bytes — which **AC-8 forbids outright**. And the plan's Out of Scope names the non-bump explicitly. Three independent reasons, no tension between them.

### R4 — The `span(P)` unification: **out of scope; file as a follow-up**

The finding is real, and I confirmed it at the source rather than taking the description. `config.md:225` defines `span(L)` for a split lane as `max` over non-integration sub-lanes `+ tasks(integration)`; `:235` defines `span_max` as `max` over non-integration lanes of `span(L)` `+ tasks(integration)`; `:237` gives the flat `span_base` the same shape a third time with `tasks` in place of `span`. One recursive form — `span(P) = max` over non-integration members `m` of `span(m)` `+ tasks(i(P))`, with `span(leaf) = tasks(leaf)` — subsumes all three, and would make the `+X` cancellation structural rather than something ADR-0016 has to derive in prose. The agent's judgement that it is *smaller* than what landed is credible.

It is nonetheless out of scope, on the plan's own terms rather than on a general preference for narrowness:

- The plan's **Out of Scope** names it almost exactly: *"Any change to the nested/sub-lane half of the model — `span(L)` for a split lane, per-sub-lane conditions, containment … except where the top-level term must be named alongside them."* The unification rewrites `span(L)`.
- **AC-24** forbids re-opening or amending ADR-0012/0013/0014. Superseding `span(L)`'s definition amends ADR-0014's framing.
- It would invalidate the coder's completed AC-19/AC-20 hand verification, which is the only real guard this half of the work has — there is no executable path here, so discarding the verification is not a cheap cost.

**Ruling: out of scope, file as a follow-up carrying ADR-0017.** The simplify pass was right to skip it and right to route it here rather than act. Recorded as SF-5.

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — ADR-0016's `g` derivation omits the middle case

**File**: `docs/adr/0016-top-level-integration-lane-pricing.md:125`
**Problem**: The section is titled *"The `g`/`c` interaction — derived, not asserted"*, which sets an exhaustiveness expectation the enumeration does not meet. With `S ≤ M` always, `X` falls in three regions, and only two are stated: *"When `X ≤ S ≤ M` the two agree at `M − S`. When `X ≥ M ≥ S` the uncorrected value is `X − X = 0`…"*. The middle region `S < X < M` is unenumerated. Its value is `g_uncorrected = max(M, X) − max(S, X) = M − X`, against `g_corrected = M − S` — corrected upward, consistent with the headline claim, so nothing stated is wrong. But a reader checking the derivation for completeness finds a gap in the one place the ADR advertises rigour, and this ADR's own Context section argues that a future reader must be able to hand-re-derive because the reconciliation identity cannot detect this defect class.
**Fix**: Add the middle case to the same sentence, e.g. *"When `S < X < M` the uncorrected value is `M − X`, short of the correct `M − S` by `X − S`."* Then the headline "unchanged when the integration lane is not the longest span, corrected upward when it is" reads exhaustively against `S`, which is what it means.

---

### SF-2 — The schema validator enforces 7 of the 10 keywords the schema uses

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs:48-62`
**Problem**: `pattern` (`gates[].gate`), `format` (`generatedAt`), and `minimum` (four sites: `summary.blockers`, `summary.warnings`, `findings.line`, `findings.endLine`) are declared in the schema and ignored by the checker, so `blockers: -5`, `gate: "NOTAGATE"`, and `line: 0` all validate clean. Per ruling R1 this is not a defect against AC-2/AC-3 — which name exactly the seven implemented keywords — and it cannot mis-accept a report in production, because nothing in `src/` validates at runtime. Its only cost is a regression the fixture would not catch, and the named instance (`line: 0`) is currently unreachable: every adapter site already coerces via `|| 1` or a literal `1`.
**Fix**: Follow-up, not this plan. Amend AC-2/AC-3 to the full keyword set and add `pattern` and `minimum` to `checkNode` in the same change so criteria and implementation move together — roughly four lines beside the existing `enum`/`const` checks. Leave `format` alone unless a real consumer parses `generatedAt` strictly.

---

### SF-3 — `checkObject` mixes `Object.hasOwn` and `in` after the simplify pass closed two of three sites

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs:43`
**Problem**: The simplify pass replaced `in` with `Object.hasOwn` at the required-key check (`:35`) and the unknown-key check (`:39`), but the property-descent at `:43` still reads `if (key in value)`. `in` walks the prototype chain, so a schema property name colliding with an `Object.prototype` member would descend into an inherited value. It is inert today — the schema's property names (`schemaVersion`, `summary`, `gatesRun`, `line`, …) collide with nothing on `Object.prototype`, and inputs are `JSON.parse` products — so this is consistency, not a live hole. But leaving one of three sites on the old idiom is precisely the shape that lets the hole reopen when a property name changes.
**Fix**: `if (Object.hasOwn(value, key)) checkNode(...)`. One-word change, same semantics on every current input.

---

### SF-4 — Three sibling Prime skills still carry unrewritten host vocabulary

**File**: `plugins/my-skills/skills/explain-codebase/SKILL.md:237`, `roadmap/SKILL.md:50`, `simplify/SKILL.md:59`
**Problem**: All three name Claude Code agent types (`subagent_type: Explore`, `general-purpose`, `Explore`/`explore`) and all three reach the generated Prime tree unrewritten — I confirmed one hit each in `prime-agent/skills/{explain-codebase,roadmap,simplify}/SKILL.md`. That is the same defect class concern 3 just fixed in the orchestrator: a port with no host agent types describing resolution against agent types it does not have.
**Confirmed not a regression of this plan**: `git diff HEAD --stat` shows **0 lines changed** in all three source files, and AC-32 scopes its zero-occurrence check to the orchestrator's generated `SKILL.md` only — where it is genuinely zero. The tester was right to report it and right to scope it out.
**Fix**: Follow-up spec covering the three siblings, mirroring concern 3's overlay approach. Worth doing as one batch rather than three, since the rewrite shape is identical.

---

### SF-5 — `span(P)` unification: two normative prose blocks, four co-moving sites

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:225`, `:235`, `:237`
**Problem**: "Concurrent max plus serial remainder" is now written three times in three vocabularies — `span(L)` over sub-lanes, `span_max` over lanes, and the flat `span_base` over lanes with `tasks` in place of `span`. They must move in agreement and nothing enforces that they do. A single recursive form over any slice set `P` with declared integration slice `i(P)` would subsume all three and make ADR-0016's cancellation identity true by construction.
**Fix**: Out of scope here — see ruling R4. File as a follow-up carrying **ADR-0017**, and note in the filing that it supersedes ADR-0016's framing and will require re-verifying all five worked examples against the unified form. ADR-0012 → 0014 → 0016 is the same defect at three depths; the fourth depth is the one that stops the sequence, which is an argument for doing it deliberately with its own plan rather than folding it into a review pass.

---

## Verdict

**Status**: APPROVED

All 38 acceptance criteria are met, every floor was re-measured rather than accepted on report, the arithmetic re-derives exactly including the `M_flat − M_nested = g − c = 3.5` identity, and the four routed open items resolve without a blocker — two as correct decisions to keep (R2, R3) and two as follow-up filings (R1, R4).

Invoke `/qa` with plan ID `FEAT-20260819T053237Z-236f` to run the QA suite.
