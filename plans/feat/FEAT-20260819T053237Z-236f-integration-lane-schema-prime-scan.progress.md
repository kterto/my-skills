# Progress: FEAT-20260819T053237Z-236f — Top-level integration lane pricing, report status vocabulary, and Prime scan child

**Plan**: [FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md](./FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md)
**Status**: QA_READY_TO_COMMIT
**Created**: 2026-08-19T05:34:56Z

---

## Log

### 2026-08-19T05:34:56Z | ARCHITECT

Created plan `FEAT-20260819T053237Z-236f`. Type: feat. Tasks: 49.

Source spec: `plans/specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md`.

Four phases, sequenced so the two concerns that share `plugins/my-skills/skills/orchestrator/SKILL.md` never fight over it and the generated tree is never left stale between phases:

1. **Phase 1 — Concern 2** (`clean-code-gates` schema + docs + tests). Isolated skill, the only phase with a real test surface. Genuine TDD: the enum pin update, the errored-case positive test, and the strengthened generic validator each go RED before the schema fix turns them GREEN. Floor: `npm test` 0 failures, total ≥ 213.
2. **Phase 2 — Concern 1a** (the makespan model, the Step 2p.1 digest declaration, the Step 2p.2 print block, the `templates/architect.md` region 5 binding).
3. **Phase 3 — Concern 1b** (hand re-derivation of both existing worked examples, the new `X > 0` example, ADR-0016 + cross-references incl. replacing ADR-0014's "Filed separately" bullet).
4. **Phase 4 — Concern 3** (Prime overlays only) **+ the joint anchor census and zero-occurrence greps**, run once after concerns 1 and 3 have both landed.

Verification is split by concern and stated per phase. Only Phase 1 has an executable path; Phases 2–4 verify structurally and arithmetically (`node scripts/build-prime-agent.mjs --check` exit 0, anchor counts, cross-reference resolution, hand-derived worked examples). `parallelism` is `off` in this repo and concerns 1 and 3 are markdown-authoring changes — the plan says plainly that a behavioural test for them cannot exist and must not be manufactured.

Two architect rulings on the spec's explicitly droppable defaults — **both kept**:
- Bind the parent `PACT`'s Integration-lane region to the priced slice. Without it the newly-priced `+X` term has no binding to what Step 3j actually dispatches — the failure ADR-0014 §5 prevents one level down.
- Clean the residual `Explore` host vocabulary at the two Prime scan callers. Not genuinely optional: the concern's own acceptance check (zero `Explore` / `explore` / `general-purpose` / `general` as a resolvable agent type in the generated Prime `SKILL.md`) fails without it.

### 2026-08-19T06:05:00Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T06:20:00Z | CODER

Phase 1 complete (Concern 2 — report status vocabulary). 10 tasks.

- Baseline: `npm test` 213 passing, 0 failures.
- RED 1: enum pin updated to `[pass, warn, blocked, error]` → failed against the unchanged schema.
- RED 2: errored-gate positive test added → failed with `summary.status must be one of pass,warn,blocked, got error`.
- RED 3: `validate()` replaced with a generic recursive checker (`type`, `required`, `additionalProperties`, `properties`, `items`, `enum`, `const`). The pre-existing positive report test then ALSO failed with `1summary: unknown key "gatesErrored"` — proving the strengthened guard sees the defect the old validator could not.
- 5 negative cases added, all reporting >= 1 violation.
- GREEN: schema `summary.status.enum` -> 4 values; `gatesErrored` declared (array of strings, mirroring `gatesMissingTool`) and added to `summary.required`. `additionalProperties: false` and `schemaVersion const 1.0` untouched. `src/report.cjs` NOT modified (git diff empty).
- Docs: `SKILL.md` Reading-the-report contract line + `README.md` both sites (JSON block, `error` branch cross-referencing exit code 4, missing_tool/error note).
- Phase 1 verification: `npm test` **219 passing, 0 failures** (floor >= 213); `build-prime-agent.mjs --check` exit 0. Both `count: 1` anchors in `prime-agent/overlays/clean-code-gates.json` still match (the build hard-fails on anchor drift and did not).

### 2026-08-19T06:45:00Z | CODER

Phase 2 complete (Concern 1a — the model, the digest declaration, the contract binding). 13 tasks.

**Sites located by content** (NOT by the backlog line numbers, which predate `d6ed529`):
- `references/config.md` — `#### The makespan model` (L210), `**The baseline — what the nested plan is priced against.**` (L241), `#### The two work-concentration conditions are evaluated at **leaf** granularity on a `full` run` (L64), `#### Leaf-level re-application of the two work-concentration conditions` (L461), `#### Greedy, recomputed adoption` (L417).
- `SKILL.md` — `#### 2p.1 — Slicing analysis`, `#### 2p.2 — Cost/benefit evaluation`, `#### 2p.3n — The inner viability gate`, `### Step 3L — Coder fan-out` (the "No integration lane is dispatched here" note, at either level), `### Step 3j — Join and contract reconciliation` (item 1, the serial integration lane).
- `templates/architect.md` — `### 5. Integration lane` (L241).

Edits: `span_max` and `M_flat` now take the non-integration `max` **plus** `tasks(integration)`; `M_seq`/`T` explicitly unchanged (an `off` run implements integration work like any other); `M_nested` explicitly needs no separate term (built on `span_max`); baseline table viable row updated; the `+X` cancellation identity recorded as a checkable block; both work-concentration sites exclude the top-level lane, from those conditions only; never-a-sub-split-candidate stated at the model and again at *Greedy, recomputed adoption*. `SKILL.md` 2p.1 gained the lane-level `integration` declaration + strict-shape enumeration + reject-outright rule + disjointness/not-a-lane-row/owned-glob statement; 2p.2 print block now prints `Integration lane:` and an expanded `span_base` denominator. `templates/architect.md` region 5 binds the parent contract to the declared slice in the sub-contract`s verify-and-freeze terms with the same `contract violation` BLOCKED stop; single-lane `none` preserved verbatim, multi-lane declared-`none` added alongside.

**Single-source-of-truth honoured**: the prose in 2p.2 names and links `span_base` rather than redefining it (an initial draft restated the formula and was trimmed). The print block`s expanded display mirrors the existing nested block`s `span({lane}) = max(concurrent …) + integration(…)` line — a display, not a definition.

Phase 2 verification: `build-prime-agent.mjs --check` exit 0. All seven cross-reference targets resolve. Anchor census held at **3 / 3 / 2**. The phrase `through a **single sequential coder invocation**` was NOT reproduced by any new prose (still exactly 2, both pre-existing at L981 / L1047).

### 2026-08-19T07:05:00Z | CODER

Phase 3 complete (Concern 1b — worked examples and ADR-0016). 11 tasks.

**Hand re-derivation of the existing worked examples, with top-level `integration: none` (`X = 0`). NO FIGURE MOVES in any of them.** All four were re-derived, not only the two the plan names:

*Example 1 — `{12, 6}`, viable flat baseline.* `M = max(12,6) = 12`; `span_base = M + X = 12 + 0 = **12**` (was 12). Post-split `span(12-lane) = max(6,6) + 0 = 6`, `span(6-lane) = 6`, so `S = 6` and `span_max = S + X = **6**` (was 6). Flat overhead `A+J = 4` → `M_flat = **16**` (was 16). Nested overhead `A+A+J+J = 8` → `M_nested = **14**` (was 14). `g = 12 − 6 = **6**` (was 6); `c = 8 − 4 = **4**` (was 4); `6 > 4` → **adopted** (was adopted). Reconcile `M_flat − M_nested = 2 = g − c = 2`.

*Example 2 — one lane carries all the work, sequential baseline.* `X = 0`, `T = 24` (unchanged — the integration lane contributes 0). `span_base = T = **24**` (was 24). `S = max(8,8,8) = 8`, `span_max = 8 + 0 = **8**` (was 8). `M_seq = **24**`; nested overhead `A+A+J+J+I(2×0.25) = **8.5**`; `M_nested = **16.5**` (was 16.5). `g = **16**`, `c = **8.5**`, `16 > 8.5` → **adopted**. Leaf re-application: 3 leaves ≥ 2; largest `8/24 = 33% ≤ 70%` — both unchanged. Rejected `{20, 4}` variant: `span_max = 20`, `g = 4`, `c = 8.5` → rejected, unchanged.

*Example 3 — split carrying an integration sub-lane.* Top-level `X = 0`; `S = span(mobile) = 5 + 6 = 11`; `span_max = **11**` (was 11); `g = 24 − 11 = **13**`, `c = **10**` — unchanged.

*Example 4 — `k = 2`.* Top-level `X = 0`; `span_base = max(24,10,4) + 0 = **24**`; adoption 1 `span_max = 10`, `g₁ = **14**`, `c₁ = **4.5**`; adoption 2 `span_max = 8`, `g₂ = **2**`, `c₂ = **0.5**` — every figure unchanged.

**New worked example (`X > 0`), verified by hand and re-checked numerically.** Lanes `{backend: 20, frontend: 12, admin: 6}` + declared top-level `wiring` with `X = 4`; `T = 42`; parent 4 interface points, sub-contract 2; flat verdict **viable** (3 non-integration lanes; largest `20/42 = 48% ≤ 70%`).

- `M = 20` → `span_base = 20 + 4 = **24**`; flat overhead `A+J+I(1.0) = 5` → `M_flat = **29**`. `M_seq = T = **42**` (reference only).
- Adopt `backend` → `{8, 8}`, `integration: none` → `span(backend) = 8`; `S = max(8, 12, 6) = 12` → `span_max = 12 + 4 = **16**`.
- `M_nested = 16 + A + A + J + J + I(6×0.25 = 1.5) = **25.5**`.
- `g = 24 − 16 = **8**`, and via the cancellation identity `M − S = 20 − 12 = **8**` — same number, as required. `c = A(2) + J(2) + I(0.5) = **4.5**`. `8 > 4.5` → **adopted**.
- **`M_flat − M_nested = 29 − 25.5 = 3.5 = g − c = 8 − 4.5 = 3.5`. Exact.**
- Remaining gates: aggregate `I = 6 ≤ T = 42`; 4 non-integration leaves ≥ 2; largest leaf `12/42 = 29% ≤ 70%`; 4 concurrent leaves ≤ ceiling 6 (`wiring` is not in the concurrent wave). `frontend` left flat on condition 2 (`11/12 = 92%`), `admin` left flat at `g = 0`.

**ADR-0016** authored at `docs/adr/0016-top-level-integration-lane-pricing.md`, Status **Accepted**, dated 2026-08-19, in ADR-0014's section structure. It carries the `g`/`c` derivation rather than asserting it: `c` unchanged at every branch (`X` enters no overhead term); `g` unchanged on a viable flat baseline when `X ≤ S ≤ M` and corrected **upward** from `0` to `M − S` when the integration lane was the longest span; `g` reduced by `min(S, X)` on a sequential baseline (`(S + X) − max(S, X)`); and `M_flat − M_nested = g − c` **preserved** — both makespans wrong in the same direction by the same amount, so this is NOT a gate/ladder disagreement and the reconciliation identity cannot detect it. The deliberate divergences from ADR-0014's sub-lane shape (never sub-split; no containment parent) are documented, not left silently different.

Cross-references: ADR-0012 gained a "Not addressed here: the *top-level* integration lane → see ADR-0016" bullet; ADR-0013 gained a "See also" line stating that neither ADR-0014 nor ADR-0016 amends its barrier or its `J` charge; **ADR-0014's "Filed separately" bullet was REPLACED** (0 occurrences of `Filed separately` remain) with a pointer to ADR-0016. No Decision section in 0012/0013/0014 was touched — the diff is 3 files, +20/−5, all in header/Consequences regions. All four ADRs cross-reference all four.

Phase 3 verification: `build-prime-agent.mjs --check` exit 0.

### 2026-08-19T07:30:00Z | CODER

Phase 4 complete (Concern 3 — Prime scan child, overlays only) + the joint census.

Five `count: 1` replacements appended to `prime-agent/overlays/orchestrator.json` (16 → 21): the scan-section **body** (title unchanged — referenced by name from three places), Step 2p.1's intro sentence (the fourth stale site), Step 2p.1's call-shape block, Bootstrap B1's *Explore scan* label, and the *"The Explore agent synthesized it"* sentence. Two distinct stable names: `context-scan` (B1) and `slicing-scan` (2p.1) — no shared replacement across dispatch sites.

`protocol.orchestrator.md`: the "tracked separately" clause dropped. **The documented grep trap was real** — the clause wraps across a line break, so a single-line grep returns zero and falsely reads as already-done. Matched on content across the break; verified after with `tracked\s+separately` = 0. The read-only-child rule the same sentence carried is preserved.

Zero-occurrence greps on generated `prime-agent/skills/orchestrator/SKILL.md`: `How to spawn a subagent` = **0**; `Explore` / `explore` / `general-purpose` / `general` = **0 hits of any kind**; `subagent_type` = **exactly 2** (counted, not assumed) — the protocol-preamble prohibition at L17 and the Step-4 role-dispatch note at L632, both of which must and do survive.

**Joint anchor census, run once after both concerns landed: 3 / 3 / 2 — GREEN.**

No trust-boundary change (strict-shape acceptance, per-value validation, surface-imperatives, untrusted-digest framing, prose-discard rule all textually intact). No hand-edit under `prime-agent/skills/` — `--check` exit 0 proves the tree is pure regeneration output.

**Final tree:** `npm test` 219 passing / 0 failures (floor ≥ 213); `build-prime-agent.mjs --check` exit 0.

All 49 tasks complete. Plan status → DONE.
Total tasks completed this session: 49

---

## Handoff

| From      | To        | Condition                  | Action                                                          |
| --------- | --------- | -------------------------- | --------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260819T053237Z-236f`         |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260819T053237Z-236f`      |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with CR-{NNN} file path`                      |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260819T053237Z-236f`            |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with QA-{NNN} file path`                      |

### SIMPLIFY — 2026-08-19
Five angles run across three concurrent agents (grouped, not dropped: reuse+simplification+efficiency over the one code-shaped file, altitude, conventions). The code angle verified the new validator by direct probing — 17 adversarial mutations covering nested additionalProperties, required two levels down, enum inside items at three depths, const, and union types — all correctly rejected; no enforcement bug.

Fixed 2. (1) docs/adr/0016: the Context section quoted ADR-0014 "in its own words", but this same change rewrote that bullet, so the quoted phrase and the "Not addressed here" label no longer existed in the file being cited; replaced with an accurate description plus an explicit note on why nothing is quoted. (2) __tests__/schema.test.cjs: `key in value` / `key in properties` consult the prototype chain, so a report carrying `toString`, `constructor` or `__proto__` passed the unknown-key check (confirmed by probe); switched both to Object.hasOwn.

Skipped 7, each with a reason. A1 (span(L) and span_max are the same "concurrent max plus serial remainder" formula written twice; one rule over any slice set would subsume both and make ADR-0016's cancellation identity true by construction) — genuinely compelling and smaller than what landed, but it supersedes the framing ADR-0016 was just written around and would invalidate the worked-example verification the coder completed; it deserves its own ADR and pipeline, not a cleanup edit. A2 (three near-verbatim exclusion blockquotes) — same reasoning; ADR-0016 §3 currently mandates the restatement at both sites. A3 (architect.md parent/sub-contract paragraph clone) — mirroring is this repo's established Mirror-machinery convention. B2 (fourth hand-written dispatch overlay entry; the right fix is source-side hoisting) and C (the validator belongs in src/ called on the report-writing path, not in a test) — both self-declared larger than this change should carry. Redundant assertions in schema.test.cjs — declined to remove assertions from the very guard this change strengthened, immediately after it was verified RED->GREEN; the duplication is cheap and the reviewer can rule. C-2 (gatesErrored added to schema `required` vs PROJECT-CONTEXT's "new fields nullable/lazy") — the backlog item's own Fix text specified it, so reversing it is the reviewer's call, not a cleanup's.

Bugs: none. Gates after the edits: clean-code-gates 219/219, build --check exit 0, prime-agent npm test exit 0, anchors 3/3/2; distribution regenerated.

### 2026-08-19T06:07:39Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T060155Z-5bec-integration-lane-schema-prime-scan.md
Status: PASS
Coverage: 87.18% → 87.18%
All floors green: clean-code-gates 225 pass / 0 fail (was 219 — 6 negative cases added);
`node scripts/build-prime-agent.mjs --check` exit 0; `cd prime-agent && npm test` install ok + parity ok.
Overlay anchors hold at 3 / 3 / 2. Coverage floor met.
No e2e added and none possible: concerns 1 and 3 are docs-only with no executable path
(`parallelism` is `off`, `full` unreachable) — verified by hand arithmetic and by grepping the
generated tree, not reported as BELOW_FLOOR.
Concern 2 mutation-tested: restoring the pre-fix schema makes the strengthened validator fail
3 tests with the exact defect messages, so it is real rather than confirmatory.
Advisory finding for the reviewer: the schema-test validator honours 7 of the 10 keywords the
schema document uses — `minimum`, `pattern`, and `format` are unenforced (confirmed independently
with a probe harness). Within AC-2/AC-3 as written; needs an explicit ruling.

### 2026-08-19T06:10:27Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T061027Z-4206-integration-lane-schema-prime-scan.md
Status: APPROVED
Must Fix: 0 | Should Fix: 5
All 38 acceptance criteria met. Floors re-measured independently, not accepted on report:
clean-code-gates 225 pass / 0 fail; `build-prime-agent.mjs --check` exit 0; anchors 3 / 3 / 2;
generated tree has 0 `How to spawn a subagent`, 0 host-agent-type hits, exactly 2 surviving
`subagent_type` prohibitions, 0 whitespace-insensitive `tracked separately`.
Arithmetic re-derived by hand: the new `X > 0` example checks out at span_base 24, span_max 16,
M_flat 29, M_nested 25.5, g 8 (= M - S = 20 - 12), c 4.5, and the identity
M_flat - M_nested = 29 - 25.5 = 3.5 = g - c = 8 - 4.5. `span_base = M + X`, `span_max = S + X`,
`g = M - S` with `+X` cancelling, `c` unchanged at every branch — all confirmed in the shipped text.
No figure moves in any of the four pre-existing examples.

Rulings on the four routed open items:
- R1 validator honours 7 of 10 keywords — FILE IT. AC-2/AC-3 name exactly the seven implemented;
  the plan explicitly bounded the keyword set. `line: 0` is not reachable today (every adapter site
  already coerces via `|| 1`). Unenforced set is `pattern`, `format`, and `minimum` at 4 sites, not 2.
- R2 `gatesErrored` in `summary.required` — KEEP. Verified 56daf17 is an ancestor of the base and in
  main, so no emittable report is invalidated; nothing in `src/` validates at runtime, so legacy
  artifacts still render and execute unchanged. The invariant is not breached, and AC-1 spec'd it.
- R3 `schemaVersion` not bumped — HOLDS, and is over-determined: AC-8 forbids changing emitted bytes,
  and `schemaVersion` is a literal in `src/report.cjs`.
- R4 `span(P)` unification — OUT OF SCOPE, file as follow-up carrying ADR-0017. The plan's own Out of
  Scope names `span(L)`, AC-24 forbids amending ADR-0014, and it would void the AC-19/AC-20 hand
  verification that is this half's only guard. The simplify pass was right to skip and route it.

Also confirmed NOT a regression of this plan: three sibling Prime skills (`explain-codebase`,
`roadmap`, `simplify`) carry unrewritten host vocabulary and leak it into the generated tree —
all three source files show 0 lines changed, and AC-32 scopes to the orchestrator only. Filed as SF-4.

Ready for QA — invoke /qa with plan ID FEAT-20260819T053237Z-236f.

### 2026-08-19T06:17:40Z | QA

Precondition check: Plan FEAT-20260819T053237Z-236f status=DONE, CR=CR-20260819T061027Z-4206 CR status=APPROVED. Proceeding.

### 2026-08-19T06:17:40Z | QA

Ran: cd plugins/my-skills/skills/clean-code-gates && npm test
Result: PASS — Total: 225 | Passed: 225 | Failed: 0 | Skipped: 0

Ran: node scripts/build-prime-agent.mjs --check
Result: PASS — exit 0 (11 skills, 154 files, up to date); re-run at end of QA, still 0

Ran: cd prime-agent && npm test
Result: PASS — install + parity ok

Gate G1 (coverage) — Result: N/A — zero changed production files (src/ diff empty, AC-8); suite 87.18% line / 88.34% branch, report.cjs 100% line
Gate G2 (complexity) — Result: WARN — hand-measured (no tool configured by project design): checkNode cyclomatic 11 > 8; checkObject nesting 3 > 2, cyclomatic 10 (8 lenient). Test-fixture helper the plan explicitly exempted. Advisory A-2.
Gate G4 (naming) — Result: WARN — `path` param shadows the `node:path` import at :24/:32/:48. Advisory A-3.
Gate G5 (no comments) — Result: PASS — 3 comments, all allowed doc comments; 7 inline "what" comments removed by this change (net improvement)
Gate G6 (mutation) — Result: N/A — no changed production files; no tool configured
Gate G7 (dependency structure) — Result: PASS — depth-1 graph, no cycles, no boundary crossing
Gate G8 (rework ratio) — Result: PASS — 0.0 (0 REQUEST_CHANGES, 0 FIX/QAF, 1 CR)

Concern-separated verification:
1. Flat cost model (docs-only, no executable path — inapplicable, not BELOW_FLOOR): re-derived by hand. M_flat − M_nested = 29 − 25.5 = 3.5 = g − c = 8 − 4.5; g = M − S = 20 − 12 = 8. No figure moved in any of the four pre-existing examples (proven structurally — zero removed lines inside any example derivation body).
2. Schema + validator: NEW tests vs OLD schema = 4 failures (guard genuinely sees the defect). Went beyond the tester: OLD tests + OLD schema = 213/213 green, proving the defect was invisible by omission, not by validator weakness.
3. Prime tree: 0 host agent types of any kind, 0 `How to spawn a subagent`, exactly 2 `subagent_type` (both prohibitions, lines 17 and 632), 0 `tracked\s+separately`. Anchors 3/3/2.

New advisory findings not raised by tester or reviewer:
A-1 — the validator rewrite DROPPED the base version's `finding.line >= 1` check (base :83); `line: 0` now validates clean. Narrow, non-production (nothing in src/ validates at runtime; all construction sites floored). Fold into the SF-2 follow-up.
A-2 — G2 exceedances in checkNode/checkObject; SF-2's proposed widening would worsen them unless it refactors concurrently.
A-4 — refines SF-1: the true dividing line is X vs S, not X vs M.

All five CR Should-Fix items independently confirmed non-blocking; no gate failed on any of them.

QA suite complete.
Report: plans/qa/QA-20260819T061740Z-1afa-integration-lane-schema-prime-scan.md
Status: READY_TO_COMMIT
Test failures: 0 | Lint errors: 0 | Type errors: 0
All checks pass. Safe to commit and open PR.
