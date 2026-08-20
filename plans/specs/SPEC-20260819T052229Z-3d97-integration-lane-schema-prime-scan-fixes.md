---
id: SPEC-20260819T052229Z-3d97
title: Top-level integration lane pricing, report status vocabulary, and Prime scan child
status: READY_FOR_PLANNING
created_at: 2026-08-19T05:28:55Z
updated_at: 2026-08-19T05:28:55Z
cycle: 0
related_to: SPEC-20260819T000458Z-bfac, SPEC-20260819T034803Z-18d2, ADR-0012, ADR-0013, ADR-0014
---

## Summary

Three independent validation deviations from the `feat/prime-agent-distribution` PR-review backlog, each confirmed against the current tree. **(1)** The orchestrator's *flat* makespan model takes a bare `max` over lanes and never charges the top-level integration lane, which Step 3j dispatches through a single sequential coder invocation after every other lane is DONE — the exact defect ADR-0012/ADR-0014 corrected one level down for the integration sub-lane, and which ADR-0014 explicitly filed as "not addressed here". **(2)** `clean-code-gates`' report schema forbids the `summary.gatesErrored` key its builder emits on **every** report and omits `"error"` from the summary `status` enum its builder can emit, so every report already fails its own schema and the consumer contract published in `SKILL.md` and `README.md` is a stale three-value vocabulary. **(3)** The Prime Agent port of the orchestrator carries the read-only scan agent's Claude/opencode type resolution unrewritten, so resolution always finds nothing and both scan callers — Bootstrap B1's whole-repo digest and Step 2p.1's slicing analysis — silently run inline in the orchestrator's own context on every Prime run.

## Goals

- Price the **top-level integration lane** as serial in the flat makespan, mirroring the sub-lane treatment ADR-0012/ADR-0014 established, so `M_flat`, the viable-flat `span_base`, `span_max`, and the Step 2p.2 flat print block stop understating the run's critical path — and record the decision in a new ADR cross-referenced from ADR-0012/0013/0014.
- Make the `clean-code-gates` report schema describe the report the builder actually emits (four-value summary `status` vocabulary including `error`; `gatesErrored` as a declared, required `summary` property), align the published consumer contract in `SKILL.md` and `README.md`, and strengthen `__tests__/schema.test.cjs` so it enforces `additionalProperties` and declared `enum`s — the missing enforcement that let this survive.
- Resolve the Prime port's read-only scan child through `rlm()` under the Prime protocol's read-only-child rule, rewrite Step 2p.1's call shape to the `name`-addressed form the other three dispatch sites use, keep the inline path as the genuine no-scan-child fallback, and drop the now-obsolete "tracked separately" note from `protocol.orchestrator.md`.
- Keep `clean-code-gates`' existing 213-test suite green (no-regression floor) and keep `node scripts/build-prime-agent.mjs --check` at exit 0.

## Non-goals

- **No hand-editing under `prime-agent/skills/`.** That tree is a generated distribution (`scripts/build-prime-agent.mjs`, `rmSync` + full rewrite). Every Prime-side change lands in `prime-agent/overlays/orchestrator.json` and/or `prime-agent/overlays/protocol.orchestrator.md` (and, for concern 2, in the `plugins/` source), followed by regeneration.
- **No re-opening of ADR-0012, ADR-0013, or ADR-0014's decisions.** ADR-0013's per-lane inner-join barrier and its `J` (not `k × J`) charge stand unchanged; ADR-0014's sub-lane `integration` field stands unchanged. The new ADR extends the same shape one level up, it does not amend either.
- **No change to the nested/sub-lane half of the model.** `span(L)` for a split lane, the per-sub-lane conditions, containment, and the cost side's `A`/`J`/`I` charges are untouched except where the top-level term must be named alongside them.
- **No `schemaVersion` bump** and **no new npm dependency** for concern 2 (see *Decisions resolved by Brainstormer default*).
- **No behavioural/executable test for concerns 1 and 3.** `parallelism` is unset (→ `off`) in this repo's `.orchestrator/config.json` and both concerns are markdown-authoring changes with no executable path. Verification there is **structural and arithmetic** — hand re-derivation of the worked examples, cross-reference resolution, anchor-count checks, and the build `--check`. Do not invent a runtime test for them; per `PROJECT-CONTEXT.md` → *Test tooling*, the tester treats automated coverage as N/A for doc-skill changes.
- **No opencode port work.** Neither `orchestrator` nor `clean-code-gates` has a `.opencode/skills/` override port; the `opencode-port-parity` invariant applies only to `pr-review-report` and `spec-driven-eval`.
- **No `simplify`-style cleanup** of adjacent code (e.g. `toMarkdown`'s now-redundant `r.summary.gatesErrored || []` guard). Out of scope for this spec.
- **No commit or push.** The pipeline stops at READY_TO_COMMIT.

## Users and use cases

- **The orchestrator skill (as executed in a target project) and the user reading the `ask` ladder** — sees option 2/3's makespan and speedup figures. Success: the printed flat figure and the gate's own baseline both charge the serial top-level integration lane, so option 2 is no longer quoted a critical path the run cannot achieve.
- **A fixer agent or CI job consuming `<out>/report.json`** — validates against `schema/report.schema.json` and branches on `report.summary.status`. Success: a strict validator accepts a real report, and the documented vocabulary lists `error`, so an agent branching on documented values cannot silently mishandle the "a gate could not execute" case that exit code 4 exists to signal.
- **A Prime Agent user running the orchestrator** — Success: the whole-repo B1 digest and the 2p.1 slicing analysis are gathered in a read-only child rather than in the orchestrator's own context, which is the context cost the scan child exists to avoid.
- **A future maintainer editing either side of the makespan model** — Success: the worked examples remain the regression check, and a new one exercises the top-level integration term so it is not dead on paper.

## Functional requirements

### Concern 1 — the flat cost model omits the top-level integration lane

Locate every site **by content**, not by the backlog's cited line numbers: those predate commit `d6ed529` (ADR-0013 adoption), which rewrote both *The makespan model* and *The cost side*. The defect is unaffected — `M_flat` and the viable-flat `span_base` still take a bare `max` over lanes — but the surrounding text differs. Write the fix against the current text.

1. **The top-level split declares an `integration` field.** `SKILL.md` → Step 2p.1's **lane-level** digest request asks the slicing analysis for an `integration` field alongside the lanes, with the same strict shape ADR-0014 established for sub-lane splits: either the literal `none`, or a **named slice carrying its mapped requirement IDs, its candidate globs, and an integer task count**.
2. **Step 2p.1's strict-shape acceptance rule enumerates the top-level `integration` field**, and a lane-level split that **omits** it is **rejected outright**, not read as zero — "not declared" and "declared none" are different claims and only the second is safe to price. This must be listed as an accepted field, because the same rule that discards "prose outside those fields" would otherwise drop a volunteered slice silently.
3. **The declared top-level integration slice is a slice in its own right.** Its mapped requirement IDs and its globs are **disjoint from every lane's**, and it does **not** also appear as a row in the lane list — the same separation a sub-lane split's integration slice has from its sub-lanes. Its globs satisfy the full owned-glob rejection list (bounded, non-escaping, mutually disjoint) in `references/config.md` → `lanes` → *Owned-glob rejection*.
4. **`references/config.md` → *The makespan model* prices it as serial.** Define, in the same terms the sub-lane case already uses:
   - the viable-flat **`span_base`** = `max` over **non-integration** lanes of `tasks(L)`, **plus** `tasks(integration)` for the top-level integration lane;
   - **`M_flat`** = that `span_base`, plus `A` for the single parent contract, plus `J` for the single outer join, plus the parent contract's interface-point count;
   - **`span_max`** = `max` over **non-integration** lanes of `span(L)`, **plus** `tasks(integration)`.
   A declared `none` is `0`. State explicitly that `M_nested` needs **no** separate term: it is built on `span_max`, which now carries the top-level integration lane.
5. **State the justification at the definition site**, mirroring the existing sub-lane note: `SKILL.md` → Step 3j dispatches the top-level integration lane *through a single sequential coder invocation, after all other lanes are DONE, never concurrently with them* (and Step 3L states no integration lane is dispatched in the concurrent wave, at either level). A `max` over all lanes including that one models an execution order the skill forbids, and does so **optimistically**. Cite the new ADR.
   > **Anchor hazard — load-bearing.** The exact phrase `through a **single sequential coder invocation**` occurs **exactly twice** in `plugins/my-skills/skills/orchestrator/SKILL.md` and is a Prime overlay anchor asserted at `count: 2`. New prose added anywhere in `SKILL.md` must **not** reproduce that phrase, or `node scripts/build-prime-agent.mjs --check` hard-fails. Paraphrase, or quote it from `references/config.md` (which is not an anchored file for that phrase).
6. **`tasks(integration)` at the top level counts in full toward `T`** (the sequential total), exactly as the sub-lane integration slice does. `M_seq` is therefore unchanged by this fix.
7. **The top-level integration lane is excluded from the two work-concentration conditions** — condition 1 (*fewer than 2 lanes carry work*) and condition 2 (*one lane holds more than 70% of the estimated tasks*) — at **both** evaluation sites: over the lane set at 2p.3, and in the *Leaf-level re-application of the two work-concentration conditions* at 2p.3n. Excluded from **those conditions only**: it counts in full in `span_base`, `span_max`, `M_flat`, and `T`. State the same rationale the sub-lane note states, one level up: counting it would read `{backend: 20, integration: 4}` as *"2 lanes carry work"* when only one lane is concurrent.
8. **The top-level integration lane is never a sub-split candidate** at 2p.3n. It is dispatched as one sequential coder invocation, so splitting it cannot shorten anything; `span(integration) = tasks(integration)` is a constant of the run.
9. **The parent `PACT`'s *Integration lane* region is bound, not freely authored** (`templates/architect.md` → region 5), in the same "verify against the real spec and tree, then freeze verbatim — do not re-derive, rename, or re-size" terms the sub-contract case already carries, and with the same `contract violation` BLOCKED stop when verification shows the declared slice is wrong. The existing `none` handling and the single-lane exception are preserved unchanged.
10. **`SKILL.md` → Step 2p.2's flat print block carries the term.** The `Estimated speedup:` line's denominator becomes the flat `span_base` (non-integration `max` **plus** `tasks(integration)`), not `largest lane tasks`, and the block makes the integration lane's contribution legible on screen rather than folding it invisibly into one number. The `Fixed overhead:` and `Interface points to freeze:` lines are unchanged.
11. **Re-verify every worked example in `references/config.md` by hand** and record the result. Both existing examples must be re-checked with the top-level `integration` declared explicitly, and a **new worked example must be added** that exercises `tasks(integration) > 0` at the top level, so the new term is not correct-on-paper-and-unreachable — the failure mode ADR-0014 named.
12. **Author `docs/adr/0016-…md`** in ADR-0014's style and structure (Status / Date / Skills affected / Source finding / Lineage / Context / Decision / Consequences), recording this fix. Cross-reference it from ADR-0012, ADR-0013, and ADR-0014 as those cross-reference each other — and in particular **replace ADR-0014's "Not addressed here: the flat/outer cost model's missing top-level integration lane … Filed separately" bullet with a pointer to the new ADR**, since this spec is that filing.
13. **The ADR must state the `g`/`c` interaction with its derivation**, not assert it. The required result, derived below in *Project-context fit*, is: **`c` is unchanged at every branch**; **`g` is unchanged under a viable flat baseline whenever the integration lane is not the longest span, and is corrected upward otherwise**; **`g` is reduced by `min(S, X)` under a sequential (`M_seq`) baseline**, which is the optimistic direction the finding names; and the identity `M_flat − M_nested = g − c` is **preserved**, so this is *not* a gate/ladder disagreement — both figures were wrong in the same direction.
14. **`references/config.md` remains the single source of truth for the arithmetic.** `SKILL.md` → Step 2p states what the digest must **declare** and links; it does not restate the formulas. This mirrors ADR-0014 §6 and the repo's single-source-of-truth convention.
15. **Regenerate the Prime distribution and assert `node scripts/build-prime-agent.mjs --check` exits 0** after the `plugins/` edits land, since `orchestrator` ships into `prime-agent/skills/`.

### Concern 2 — report schema forbids the status and summary key the builder always emits

16. **`schema/report.schema.json` → `summary.properties.status.enum` becomes the four-value vocabulary** `["pass", "warn", "blocked", "error"]`, matching what `src/report.cjs` can emit (`status = blockers > 0 ? 'blocked' : gatesErrored.length > 0 ? 'error' : warnings > 0 ? 'warn' : 'pass'`).
17. **`gatesErrored` is declared in `summary.properties`** as an array of strings (same shape as `gatesMissingTool`) **and added to `summary.required`**, because `buildReport` emits it unconditionally on every report. With `additionalProperties: false` still in force, this is what makes a real report validate.
18. **A real report validates against its own schema.** Every report `buildReport` produces — errored or not — passes strict validation. This is the acceptance test for FR-16/17 and is the substance of the finding: it is not only errored reports that fail today.
19. **`SKILL.md`'s consumer contract line is updated** — the sentence currently reading ``report.summary.status` is `pass | warn | blocked`` becomes the four-value vocabulary, and names `report.summary.gatesErrored` alongside `report.summary.gatesMissingTool`. This is the line fixer agents and orchestrators read.
20. **`README.md` is updated at both sites**: the report-shape JSON block's `"status": "pass|warn|blocked"` becomes the four-value form and gains a `"gatesErrored": [...]` entry in `summary`; and the *Consuming the report in orchestrators and fixer agents* example gains an explicit `error` branch, so the canonical iteration pattern cannot be copied into a consumer that reads an unmeasured run as a pass. Cross-reference exit code 4, whose documentation already states that an errored gate measured nothing and nothing measured must never read as pass.
21. **`__tests__/schema.test.cjs` enforces `additionalProperties: false` and every declared `enum`.** The current hand-rolled `validate()` checks required keys and types only, which is why it passes against a report the real schema rejects. Strengthen it so an unknown key anywhere the schema declares `additionalProperties: false`, and any value outside a declared `enum` or `const`, is reported as a violation.
22. **The strengthened validator is proven able to fail.** Add negative tests that feed it deliberately invalid reports — at minimum: an unknown key inside `summary`, an unknown key at top level, an out-of-enum `summary.status`, an out-of-enum per-gate `status`, and an out-of-enum finding `severity` — and assert each produces a violation. A guard that has never been observed failing is not a guard.
23. **Add a positive regression test for the errored case**: a report built from gate results including one with `status: 'error'`, asserting `summary.status === 'error'`, `summary.gatesErrored` non-empty, and zero schema violations.
24. **Update the existing assertion that pins the old vocabulary.** `schema.test.cjs` currently asserts `deepStrictEqual(statusEnum, ['pass','warn','blocked'])`; it must assert the four-value list.
25. **No-regression floor: `npm test` in `plugins/my-skills/skills/clean-code-gates/` passes with 0 failures**, at a total ≥ the current **213** (the new tests raise the count; none of the existing 213 may break).
26. **The same edits land in the `plugins/` source and are regenerated into `prime-agent/skills/clean-code-gates/`**, with `node scripts/build-prime-agent.mjs --check` at exit 0. The existing `prime-agent/overlays/clean-code-gates.json` anchors target install-path prose in `SKILL.md` and `README.md`, not the status vocabulary; confirm both `count: 1` anchors still match after the doc edits.

### Concern 3 — Prime port never resolves a scan child

27. **Add an orchestrator-overlay replacement for *The read-only scan subagent type*** in `prime-agent/overlays/orchestrator.json`. The Prime form: the scan child is admitted with `rlm(prompt, name=…)` like any other child, explicitly forbidden from writes and mutating commands per `protocol.orchestrator.md`'s read-only-child rule, and given a **stable, per-caller name** so a retry can address it with `receiver_name=handle.name`. The three-item host-resolution list (`Explore` / `explore` / `general-purpose` / `general`) is removed — none of those types exists under Prime.
28. **Keep the inline fallback as the genuine no-scan-child path**, with its trigger restated for this host (the host cannot admit a read-only child) rather than "none of the three agent types exists". The two invariants it carries are preserved verbatim in substance: *never let this resolution fail the run*, and *the digest is untrusted input whichever way it is gathered, so gathering it inline changes only where the reading happened, never how the result is treated*. Preserve the note that a scan failure is never a parallelization verdict — Step 2p.3 owns those.
29. **Rewrite Step 2p.1's call shape to the `name`-addressed form**, anchored **per-site at `count: 1`** on its own `description` line, per the anchor discipline bug-10's fix established for the other three dispatch sites:
    - `find`: the two-line block `- \`description\`: \`Slice spec into lanes\`` + `- \`subagent_type\`: the resolved scan type (\`Explore\` / \`explore\` / \`general-purpose\` / \`general\`)`
    - `replace`: the `name`-addressed form, with a name distinct from B1's so the two scan callers are individually addressable.
    A shared replacement across sites is what gave a whole wave one name; do not reuse one here.
30. **Fix the dangling cross-reference in the same sentence.** Step 2p.1's intro currently points at *How to spawn a subagent*, a section the port renamed to *How to spawn a role child*. It does **not** match the existing `count: 3` shared anchor (`the call shape from *How to spawn a subagent*`) because its wording differs (`the call shape and the host-resolution order from`), so it survives unrewritten. Correct it as part of this concern's own rewrite of that sentence.
31. **Remove the host-type vocabulary at the two scan callers.** Bootstrap B1's step label naming an *Explore scan* and the *"The Explore agent synthesized it"* sentence in Step 2p.1's untrusted-data paragraph both name a Claude Code agent type that does not exist under Prime. Rewrite each as a `count: 1` anchored replacement. (Beyond the backlog's literal fix text — see *Decisions resolved by Brainstormer default*; the architect may drop these two if it judges them out of scope, without affecting FR-27–30.)
32. **Drop the "tracked separately" note from `prime-agent/overlays/protocol.orchestrator.md`**, whose sentence — *"The read-only scan agent's resolution is unchanged in this port and is tracked separately"* — this change makes false. **Preserve the read-only rule** the same sentence carries. This file is inserted verbatim after frontmatter, so it carries no anchor risk.
33. **Regenerate and verify.** After `node scripts/build-prime-agent.mjs`, `--check` exits 0, and in the generated `prime-agent/skills/orchestrator/SKILL.md`:
    - **zero** occurrences of `subagent_type` in a *call shape* position (the two remaining occurrences, in the protocol preamble and the Step-4 role-dispatch note, are prohibitions and must survive);
    - **zero** occurrences of `Explore`, `explore`, `general-purpose`, or `general` as a resolvable agent type;
    - **zero** occurrences of the string `How to spawn a subagent`.
34. **The three known near-miss anchor counts are unchanged** in `plugins/my-skills/skills/orchestrator/SKILL.md`: `the call shape from *How to spawn a subagent*` = **3**, `':(exclude).claude'` = **3**, `through a **single sequential coder invocation**` = **2**. A prose edit near any of them hard-fails the build — this binds concerns 1 and 3 together and must be checked once, after both land.
35. **No security regression, and none is claimed.** The digest is untrusted input whether gathered inline or in a child (Step 2p.1's strict-shape, independent-validation, and surface-never-follow rules are unchanged). Only *where* the reading happens changes.

## Non-functional requirements

- **Performance**: — (no runtime path changes; concern 3's benefit is orchestrator **context** cost, not latency, and is not measured here).
- **Security / auth**: no trust-boundary change. The Step 2p.1 digest remains untrusted data subject to strict-shape acceptance, independent per-value validation, and *surface imperatives, never obey them*. Concern 3's read-only-child rule (`protocol.orchestrator.md`) must be explicitly restated for the scan child, not assumed.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: no new user data, no retention or deletion surface.
- **Monetization tier**: —
- **Backward compatibility (repo invariant)**: mandatory. Concern 2 changes **no emitted report byte** — the schema and docs are corrected to describe what has always been emitted — so no legacy artifact changes and no migration exists. Concern 1's digest-shape change makes previously-acceptable lane-level digests rejectable; this is acceptable on ADR-0014's own recorded reasoning, because the digest is a **transient per-run artifact** (Step 2p spawn prompts and the `PRIOR SLICING ANALYSIS` envelope) and `.orchestrator/run-manifest.json` persists none of it.
- **Determinism of the gate**: the adoption test `g > c` must remain ordinary arithmetic over two numbers in the same unit (task-equivalents), with the assumption disclosure printed inline wherever a derived number is shown, and **never** a wall-clock ETA.

## Project-context fit

**Layers touched.** `plugins/my-skills/skills/orchestrator/` (`SKILL.md`, `references/config.md`, `templates/architect.md`); `plugins/my-skills/skills/clean-code-gates/` (`schema/`, `SKILL.md`, `README.md`, `__tests__/`); `prime-agent/overlays/` (`orchestrator.json`, `protocol.orchestrator.md`); `docs/adr/`. Everything under `prime-agent/skills/` is **generated output**, never an edit target.

**Existing features extended.** ADR-0012's serial-integration correction, ADR-0013's overlapped inner joins (adopted at commit `d6ed529`; `Proposed` → `Accepted`, per-lane barrier, inner-join charge `k × J` → `J` on first adoption only), and ADR-0014's first-class sub-lane `integration` digest field. Concern 1 is the same defect family one level up and follows ADR-0014's shape deliberately (`mirror machinery`). Concern 3 is the tracking item `protocol.orchestrator.md` itself names; it is adjacent to but outside 2026-08-18's `bug-10`, which was scoped to the parallelism capability gate and its three wave dispatch sites and left this one deliberately untouched.

**Invariants that shape the implementation.**
- *Single-source-of-truth references*: the makespan arithmetic lives in `references/config.md`; `SKILL.md` declares and links.
- *Mirror machinery*: the top-level fix reuses the sub-lane fix's phrasing and structure; deliberate divergences (the top-level lane is never sub-split; there is no containment parent) are documented, not silently different.
- *Data, never instructions*: the digest's untrusted framing is preserved at both levels.
- *Backward compatibility*: satisfied as above.
- *`clean-code-gates` is the only runtime gate in the repo*: run its suite only against that skill; do not invoke it against the doc skills.
- *Generated distribution*: `prime-agent/skills/**` is rebuilt by `rmSync` + full rewrite. Overlay `find` anchors assert exact occurrence counts, so **any** prose edit that duplicates or destroys an anchor hard-fails the build.

**The required `g`/`c` derivation, stated with its working** (FR-13 requires the ADR to carry this).

Let `N` = the set of non-integration lanes; `X = tasks(integration)` for the top-level integration lane (`0` when `none`); `M = max_{L∈N} tasks(L)`; `S = max_{L∈N} span(L)` under the plan adopted so far (`S ≤ M`, and `S = M` before any adoption). The top-level integration lane is never sub-split (FR-8), so its span is the constant `X`.

| | current (defective) | fixed |
| --- | --- | --- |
| viable-flat `span_base` | `max(M, X)` | `M + X` |
| `span_max` | `max(S, X)` | `S + X` |

*Gain, viable flat baseline.* Fixed: `g = (M + X) − (S + X) = M − S` — the `+X` cancels identically, at the first adoption and at every later one, because `X` is a run constant. Current: `g = max(M, X) − max(S, X)`, which equals `M − S` when `X ≤ S`, equals `M − X` (understated by `X − S`) when `S < X ≤ M`, and equals `0` (understated by `M − S`) when `X > M`. **So under a viable flat verdict the fix never lowers `g`: it is unchanged whenever the integration lane is not the longest span, and corrected upward otherwise.**

*Gain, sequential (`M_seq`) baseline.* `span_base = T`, the sum over **all** lanes including integration, unchanged by this fix (FR-6). Fixed: `g = T − (S + X)`. Current: `g = T − max(S, X)`. Difference: `g_fixed − g_current = max(S, X) − (S + X) = −min(S, X)`. **The fix lowers `g` by `min(S, X)` on a sequential baseline** — the optimistic direction the finding names. In practice this branch is usually `X = 0`, because a non-viable flat verdict most often means only one lane carries work and therefore no cross-lane wiring exists; it is reachable when non-viability came from condition 2 (concentration) instead.

*Cost.* `c` is defined as the marginal delta of `M_nested`'s **overhead** term — `A` (parent contract), `A` (sub-contract level, first adoption only), `J` (inner-join level, first adoption only), `J` (outer join), and `I` interface points at `0.25` each. `tasks(integration)` at the top level enters only the **critical-path** term. **`c` is therefore unchanged at every branch**, including the sequential-baseline first adoption that additionally carries `A + J + I_parent`.

*Gate/ladder consistency.* `M_flat − M_nested = (span_base − span_max) + (overhead_base − overhead_nested) = g − c`. The fix adds `+X` to `span_base` and `span_max` alike, so the identity is preserved exactly. It also held under the current model (both terms used `max(·, X)`). **This is not a gate/ladder disagreement** — the class of failure ADR-0012's worked example exists to catch — but a single figure wrong in the same direction on both sides. The ADR should say so, because the distinction is what tells a future reader which regression check applies.

*Worked examples.* Both existing examples have no cross-lane wiring to sequence — example 1 is two lanes with the candidate split declaring `integration: none`, example 2 is the single-lane shape whose parent `PACT` integration lane is `none` by the architect template's own stated exception. Declaring the top-level `integration: none` explicitly gives `X = 0`, so **no existing worked example's numbers move** — the same result ADR-0014 recorded, and the reason a third example exercising `X > 0` is required (FR-11).

**Test surface, stated plainly.** Only concern 2 has one. `clean-code-gates` ships real JS with a `node --test` suite (`npm test`, currently **213 passing**) — that is the no-regression floor, and the schema-validator strengthening is genuinely testable, including negatively. Concerns 1 and 3 are markdown-authoring changes with **no executable path** (`parallelism` is unset in `.orchestrator/config.json`, hence `off`); their verification is structural review plus the build `--check` and hand arithmetic. Do not manufacture a behavioural test for them.

**Cross-concern coupling to watch.** Concerns 1 and 3 both edit `plugins/my-skills/skills/orchestrator/SKILL.md` and both regenerate the Prime distribution. The anchor-count check (FR-34) is a **joint** post-condition and must be run once after both land, not per-concern. Concern 1's Step 2p.1 edits (the lane-level `integration` field, FR-1/2) and concern 3's Step 2p.1 edits (the call-shape block and the intro sentence, FR-29/30) touch the same step but disjoint text; neither `find` may absorb the other's, and the concern-3 anchors must be re-verified after concern 1's prose lands.

**No open product decision this depends on.**

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Skills (source of truth, `plugins/my-skills/skills/`)**:
  - `orchestrator/SKILL.md` — Step 2p.1 (lane-level `integration` field + strict-shape acceptance), Step 2p.2 (flat print block denominator).
  - `orchestrator/references/config.md` — *The makespan model* (`span_base`, `span_max`, `M_flat`, the serial-integration note, `T`), *The two work-concentration conditions are evaluated at leaf granularity*, *Leaf-level re-application of the two work-concentration conditions*, and all worked examples (+1 new).
  - `orchestrator/templates/architect.md` — region 5 *Integration lane* (parent contract bound, not authored); region 2 *Path ownership* if the disjointness statement needs a pointer.
  - `clean-code-gates/schema/report.schema.json` — `summary.properties.status.enum`, `summary.properties.gatesErrored`, `summary.required`.
  - `clean-code-gates/SKILL.md` — the *Reading the report (for agents/orchestrators)* contract line.
  - `clean-code-gates/README.md` — the report-shape JSON block and the *Consuming the report* example.
  - `clean-code-gates/__tests__/schema.test.cjs` — generic validator strengthening, updated enum assertion, new positive and negative tests.
- **Prime distribution (overlays only — never `prime-agent/skills/`)**:
  - `prime-agent/overlays/orchestrator.json` — new replacements for *The read-only scan subagent type*, Step 2p.1's call shape + intro sentence, and the two host-vocabulary sites (FR-31).
  - `prime-agent/overlays/protocol.orchestrator.md` — drop the "tracked separately" clause, keep the read-only rule.
- **Docs**: `docs/adr/0016-…md` (new, `0015` is the highest existing); cross-reference edits in `docs/adr/0012-…`, `0013-…`, and `0014-…` (including replacing ADR-0014's "Filed separately" bullet).
- **Shared / generated**: `prime-agent/skills/**` regenerated by `node scripts/build-prime-agent.mjs`; `--check` must exit 0.

## Open questions

_None._ Every unknown was resolved by a recorded default below. No unknown met the reserved-decision bar: none matches an out-of-scope item in `PROJECT-CONTEXT.md`, none is an open product decision (all three are defect corrections with a determinate correct answer set by existing precedent), none touches compliance or privacy, and none is a one-way door — the two candidates (a `schemaVersion` bump and a new npm dependency) were both resolved toward *changing nothing*, which is the reversible option in each case.

## Decisions resolved by Brainstormer default

- **Where the top-level `tasks(integration)` comes from** → require Step 2p.1's **lane-level** split to declare an `integration` field with ADR-0014's exact strict shape and reject-on-omission rule → ADR-0014 proved that a term with no declared source silently evaluates to `0` forever; mirroring its shape is the `mirror machinery` convention and keeps one rule readable at both levels.
- **Whether the top-level integration lane may itself be sub-split** → **no**; exclude it from the 2p.3n candidate set → Step 3j dispatches it as one sequential coder invocation, so splitting it cannot shorten anything, and treating `span(integration)` as a run constant is what makes the `+X` cancellation in the gain derivation exact.
- **Whether the declared top-level integration slice may coincide with a candidate lane** → **no**; it is a separate slice whose requirement IDs and globs are disjoint from every lane's → the alternative double-counts its tasks (once inside the lane `max`, once in the `+X` term), which would overstate the critical path in the opposite direction of the defect being fixed.
- **Whether `T` changes** → **no**; the top-level integration lane counts in full toward `T`, so `M_seq` is untouched → ADR-0014 settled the identical question for the sub-lane slice; diverging here would put the two levels on different accounts.
- **Whether the exclusion from the work-concentration conditions applies at the leaf-level re-application too** → **yes**, at both 2p.3 and 2p.3n → the leaf set contains the top-level integration lane, so excluding it at only one site would let the same lane be counted as concurrent work at the other.
- **Whether to bind the parent `PACT`'s Integration lane region to the declared slice** → **yes**, in the sub-contract's existing "verify and freeze, do not re-derive" terms → without it the term the model now prices has no binding to what actually runs, which is precisely the failure ADR-0014 §5 exists to prevent one level down. This goes marginally beyond the backlog's literal fix list; it is recorded here so the architect can audit or drop it.
- **Whether to add a new worked example** → **yes**, one exercising top-level `tasks(integration) > 0` → both existing examples are `X = 0` and would leave the new term correct on paper and never exercised — the exact defect ADR-0014 named.
- **New ADR number and status** → `0016`, authored at **Accepted** and dated on landing → `0015` is the highest existing; ADR-0014 is the stylistic precedent and was Accepted together with the change it records. (ADR-0013's `Proposed` → `Accepted` two-step existed because its adoption was a separate later decision; that does not apply here.)
- **Whether to bump `schemaVersion` from `"1.0"`** → **no** → the schema has never accepted a single report the builder produces, so no valid `1.0` report exists in the wild to stay compatible with; and the change alters no emitted byte, only the description of what was always emitted. A bump would additionally churn `report.cjs` and every fixture pinning `"1.0"` for no consumer benefit.
- **Whether to add `ajv` (or any validator dependency) for FR-21** → **no**; strengthen the existing hand-rolled `validate()` into a small generic recursive checker honouring `type`, `required`, `additionalProperties`, `properties`, `items`, `enum`, and `const` → the package is `private` with zero dependencies and its test script is bare `node --test`; adding a dependency to a zero-dep skill that ships into two distributions is the less reversible option, and the finding's root cause (a validator that cannot fail) is fixed either way.
- **Whether to add an `error` branch to the README's canonical consumer example** → **yes** → the finding's substance is that an agent branching on the documented values silently mishandles `error`; publishing a corrected vocabulary while leaving the copy-paste example ignoring it would fix the contract and not the thing consumers actually copy.
- **Whether to rename the Prime port's *The read-only scan subagent type* section title** → **no**; replace the body only → the title is referenced by name from Bootstrap B1, from Step 2p.1, and from the Step-2p summary line, so renaming it multiplies the anchor surface for no behavioural gain, and the backlog's own fix text refers to the section by that title.
- **Names for the two Prime scan children** → two **distinct** stable names, one per caller (B1's context digest, 2p.1's slicing analysis) → `name` is the retry address (`receiver_name=handle.name`), and bug-10's fix established that a shared replacement across dispatch sites is what gave a whole wave one name.
- **Whether to also clean up the residual `Explore` host vocabulary at the two scan callers (FR-31)** → **yes**, as two `count: 1` anchored replacements, explicitly marked droppable → it is the same defect (a Claude Code agent type named in a port that has none) at the two call sites the concern already covers, but it is beyond the backlog's literal fix list, so the architect gets an explicit off-ramp.
- **Whether concerns 1 and 3 get a behavioural test** → **no** → `parallelism` is `off` in this repo and both are markdown-authoring changes; per `PROJECT-CONTEXT.md` → *Test tooling* the tester treats automated tests as N/A for doc skills and verifies structurally. Their real guards are the build `--check`, the anchor counts, and hand re-derivation of the worked examples.
- **Ordering of the three concerns** → land concern 2 independently (isolated skill, its own suite); land concerns 1 and 3 with a **single joint** anchor-count and `--check` verification after both → they share `SKILL.md` and the same generated distribution, so a per-concern build check would pass individually and still leave the pair failing.

## References

- `docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-19.md` — source backlog (`arch-1`, `bug-1`, `bug-2`).
- `docs/adr/0012-nested-parallelism-cost-model-corrections.md` — established that an integration sub-lane is serial and is **added** to the concurrent `max`.
- `docs/adr/0013-overlapped-inner-joins.md` — Accepted; per-lane inner-join barrier, charge `k × J` → `J` on first adoption only. Rewrote *The makespan model* and *The cost side*, which is why the backlog's line numbers are stale.
- `docs/adr/0014-integration-slice-first-class-digest-field.md` — the precedent this fix mirrors one level up; its Consequences explicitly file the top-level omission as *"Not addressed here … Filed separately"*.
- `plugins/my-skills/skills/orchestrator/references/config.md` → *The inner viability gate — makespan and marginal gain*, *The baseline*, *The cost side*, *Per-sub-lane re-application of the existing viability conditions*, *Leaf-level re-application of the two work-concentration conditions*, all worked examples.
- `plugins/my-skills/skills/orchestrator/SKILL.md` → Steps 2p.1, 2p.2, 2p.3n, 3L, 3j.
- `plugins/my-skills/skills/orchestrator/templates/architect.md` → regions 1 (*Lane map*), 2 (*Path ownership*), 5 (*Integration lane*).
- `plugins/my-skills/skills/clean-code-gates/` → `src/report.cjs`, `schema/report.schema.json`, `SKILL.md`, `README.md`, `__tests__/schema.test.cjs`.
- `prime-agent/overlays/orchestrator.json`, `prime-agent/overlays/protocol.orchestrator.md`, `prime-agent/overlays/clean-code-gates.json`, `scripts/build-prime-agent.mjs`.
- `.orchestrator/PROJECT-CONTEXT.md` → *Test tooling*, *Conventions*, *Invariants*, *Out of scope*.
- `plans/specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md`, `plans/specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md` — the two in-flight predecessors whose changes made the backlog's line numbers stale.
