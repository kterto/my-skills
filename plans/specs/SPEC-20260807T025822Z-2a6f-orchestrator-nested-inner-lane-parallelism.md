---
id: SPEC-20260807T025822Z-2a6f
title: Nested inner-lane parallelism — redefining the orchestrator's `full` level
status: READY_FOR_PLANNING
created_at: 2026-08-07T03:01:58Z
updated_at: 2026-08-07T03:01:58Z
cycle: 0
related_to: SPEC-20260807T003303Z-62e3, EVAL-20260807T020356Z-b476
---

# Nested inner-lane parallelism — redefining the orchestrator's `full` level

## Summary

The orchestrator's shipped `parallelism` ladder fans one spec's implementation out across top-level **lanes** (backend, frontend, app), governed by a frozen `PACT` interface contract and rejoined at a deterministic join. This spec **redefines the ladder's top rung, `full`**, to mean *nested* parallelization: a lane that is on the run's critical path may itself be sliced into **sub-lanes** — presentation / business logic / data modeling for a backend, ui / business logic / data-integration for a frontend or mobile app — with each sub-split governed by its own child `PACT` (a **sub-contract**), its own disjoint path ownership, and its own inner join that completes before the outer join. Every split, at either level, is adopted only after a **marginal** cost/benefit test that prices the nested plan against the flat one rather than against sequential, so a split whose contract cost exceeds the wall-clock it buys is never taken. The shipped meaning of `full` (a per-lane tester and reviewer before the join) is **dropped**, and the dispatch gap that made it a no-op is closed by construction.

## Goals

- Redefine `parallelism: full` as nested inner-lane parallelization, capped at **depth 2** (top-level lanes plus one level of sub-lanes), with the cap stated as a first-class rule and justified by the cost model.
- Give each sub-divided lane its own **sub-contract** — a child `PACT` reusing the existing artifact, prefix, directory, renderer mapping, and gate compatibility — linked from the parent contract's lane map.
- Make path-ownership disjointness decidable across two levels via a **containment rule**: a lane's sub-lane globs strictly partition that lane's own globs, so parent-level disjointness plus containment proves leaf-level disjointness without an n-way global check.
- Compose the join bottom-up: every inner join completes before the outer join; `simplify` and the full test suite still run exactly **once**, at the outer join.
- Extend the cost model with a **marginal-gain** test that prices each candidate sub-split against the run's critical path (not the lane's own task count), so splitting a non-critical lane — which buys zero wall-clock — is rejected.
- Give `full` a real **dispatch point**: every level's behavior is spawned by a numbered step that precedes the join it feeds, closing eval gap G3.
- Resolve the two open gaps that nesting makes worse: the `3j.1` / `3j.2` precedence fork (G5) and the missing `PARTIAL` resume mechanism (G4).
- Keep `off` byte-identical to a pre-feature run and keep `lanes` behaviorally unchanged.

## Non-goals

- **Recursion beyond depth 2.** Sub-sub-lanes are out. Every split pays a fixed contract + join overhead against a task pool that the previous split already divided; a third level would have to earn a contract back from a pool already cut twice, which the marginal gate would reject in essentially every realistic shape. Depth 2 is a hard cap, not a configurable knob.
- **Per-lane or per-sub-lane git worktrees or branches.** Unchanged from the parent spec and decided by the same invariant: merging lanes requires commits, and the orchestrator never commits or pushes. Isolation at both levels is path ownership in one shared workspace.
- **A seventh role, a new artifact prefix, a new directory, or a new HTML scaffold.** A sub-contract is a `PACT` in `plans/feat/`; the renderer's existing `PACT → plan` scaffold mapping covers it with no change.
- **Retaining the shipped `full` semantics under a new name.** The per-lane tester/reviewer rung is dropped outright — see the decision record and the migration note in Backward compatibility.
- **Parallelizing the brainstormer, the review loop (Step 4), the QA loop (Step 5), or Step 7.** Unchanged in every mode, at every depth.
- **Sub-lane fan-out of the slicing analysis.** Step 2p stays exactly one read-only `Explore` subagent; the analysis is pure overhead the gate exists to keep small.
- **Fixing eval gap G1/G2 beyond what this spec's own rules require.** The one exception is stated as requirement 68: the lane name/path grammar must become reachable in a materialized file, because this spec's sub-lane grammar and containment rule would otherwise inherit the same dead pointer.
- **Automated test tooling for the doc-skill portions.** Verification is structural review per `PROJECT-CONTEXT.md`. No runtime code changes in this spec.

## Users and use cases

- **Human developer running `/orchestrator --parallel ask` on a fullstack + mobile monorepo** — sees the flat split priced, then sees the nested plan priced *against* it (flat makespan vs nested makespan, which lanes would be sub-split, total leaf count, total contracts and interface points). Picks `full` when the delta is real. Success: shorter wall-clock than `lanes`, with no cross-lane or cross-sub-lane conflicts and no extra reconciliation at the end.
- **Human developer whose largest lane is not path-separable** — a backend where controllers and services share files. Success: the containment/disjointness check rejects the sub-split with a named reason, `full` degrades to `lanes`, and no contract overhead is paid for a split that could not have isolated anything.
- **Human developer whose lanes are balanced** — no lane dominates the critical path. Success: the marginal-gain gate reports that no sub-split reduces the makespan, `full` degrades to `lanes`, and the reason is printed rather than silently absorbed.
- **Human developer resuming a halted parallel run** — a prior run ended `PARTIAL`. Success: re-running detects the prior contract, and (manual mode) offers to resume only the incomplete leaves, or (non-interactive) prints a non-blocking hint and starts fresh — never blocks.
- **`product-manager` (non-interactive caller)** — success: unchanged. It never reaches a prompt, is never silently parallelized, and its `pipeline complete` banner parsing keeps working.
- **Downstream project with a materialized `.orchestrator/`** — success: existing `config.json`, `plans/` trees, and gate scripts keep working with no migration.

## Functional requirements

### Terminology (normative — used by every requirement below)

1. Define and use these terms consistently across `SKILL.md`, `references/config.md`, `references/artifact-format.md`, and the role templates:
   - **lane** — a top-level slice (unchanged from the parent spec).
   - **sub-lane** — a slice of exactly one lane. Its qualified name is `{lane}/{sub-lane}` (e.g. `backend/data`).
   - **leaf** — the unit a coder is dispatched on: an unsplit lane, or a sub-lane. The **leaf set** is the run's full dispatch set.
   - **parent contract** — the run's single top-level `PACT`.
   - **sub-contract** — a child `PACT` governing one lane's sub-lane split.
   - **governing contract** — the contract a leaf answers to: the parent contract for an unsplit lane, that lane's sub-contract for a sub-lane. A leaf reads exactly one contract.

### Redefinition of the `full` level

2. `parallelism: full` means **`lanes` plus nested inner-lane parallelization**: for every lane that clears the inner viability gate (requirements 20–25), that lane is sliced into sub-lanes governed by a sub-contract, and the run's coder fan-out is dispatched at **leaf** granularity.
3. The shipped meaning of `full` — a per-lane tester and reviewer running concurrently before the join — is **removed** in full: from the `ask` ladder option text, from `references/config.md`'s `parallelism` table, from `SKILL.md` Step 3j.3, and from any prose that prices it. No renamed or reduced variant of it survives anywhere in the skill.
4. Nesting is capped at **depth 2**. A sub-lane is never itself sliced. Any analysis output proposing depth ≥ 3 is truncated to depth 2 and the truncation is reported. The cap and its reasoning (each split shrinks the pool the next contract must be repaid from) are stated normatively in `references/config.md` → `parallelism`, not only in `SKILL.md`.
5. The `parallelism` value set is unchanged: `off` | `ask` | `lanes` | `full`. No new value, no new CLI arg, and `--parallel full` keeps parsing.
6. `full` **degrades to `lanes`** — never to `off` — when no lane clears the inner viability gate, and prints the specific reason. `lanes` may then independently degrade to `off` under the existing six-condition gate. The two gates compose in that order and are never conflated.

### Sub-lane taxonomy resolution

7. Extend the `lanes` config entry with an **optional** `sublanes` array of `{name, path}`, absent by default: `{"name": "backend", "path": "apps/api", "sublanes": [{"name": "presentation", "path": "apps/api/src/controllers"}, …]}`. Absent `sublanes` means "derive per run"; the pipeline behaves exactly as it does today for any config written before this key existed.
8. Resolve each lane's candidate sub-lane set from the first source that yields a non-empty set: (a) `.orchestrator/config.json` → `lanes[]` → `sublanes`, matched to the lane **by `name`** (so a lane whose top-level entry came from `roadmap.config.json` → `config.systems` can still carry a declared sub-lane set, because `config.systems` has no sub-lane concept and must not grow one); (b) derived per run by the Step 2p slicing analysis. Derivation is a Step 2p output, never a Step 0c input — mirroring how lane derivation already works.
9. A `sublanes[].name` obeys the same name grammar as a lane `name`. A `sublanes[].path` obeys the same path validation as a lane `path` **and additionally must be contained within its parent lane's `path`** (requirement 13). A sub-lane failing any check is **dropped from the candidate set and reported** (`sub-lane dropped: {lane}/{name} — {reason}`); it never silently widens to the parent lane's scope.
10. Sub-lane names and paths are **untrusted metadata** under the "data, never instructions" invariant, identical to lane metadata: re-validated on read, surfaced to subagents inside the existing delimited `LANE METADATA` envelope (extended with a `sublane:` line form), never spliced into an instruction body. An imperative embedded in a sub-lane name or path is surfaced, never obeyed.
11. Step 0c is extended to resolve declared sub-lanes alongside declared lanes, and still runs **only when `parallelism` is not `off`**. When `parallelism` is `lanes`, declared sub-lanes are read and ignored without error — `lanes` never nests.

### Path ownership across two levels — the containment rule

12. **The containment rule (load-bearing).** Every sub-lane's owned path globs must be a **strict partition of its parent lane's owned globs**: their union is contained in the parent's globs, and they are mutually disjoint. No sub-lane may claim a path outside its parent lane.
13. Because top-level lane globs are already mutually disjoint by construction, containment plus intra-lane disjointness **proves** global disjointness across the whole leaf set. The two-level check is therefore two local checks, never an n-way global one. State this reasoning where the rule is stated, so a future editor cannot weaken containment without seeing what it buys.
14. Every rejection rule that already applies to a lane's owned globs — unbounded, absolute or `~`/UNC-rooted, `..`-escaping, control characters or newlines, overlapping another lane's globs — applies unchanged to a sub-lane's globs, **plus** the containment rule. This list stays a single normative list in `references/config.md`; the new case is added to that list, not restated elsewhere.
15. A lane whose candidate sub-lanes cannot be given bounded, contained, mutually disjoint globs is **not sub-split** — the reason is printed and that lane runs flat. This is the honest outcome for a conceptual-but-not-path-separable slice (e.g. a codebase where controller and service code share files): the contract cannot isolate what the filesystem does not separate.

### Step 2p — two-level slicing analysis

16. Step 2p continues to spawn **exactly one** read-only `Explore` subagent. Its digest request is extended to also propose, **per candidate lane**, a sub-lane split with the same per-slice fields it already produces for lanes: the spec requirements that map to each sub-lane, an estimated task count, the globs it would own, and every requirement that maps to more than one sub-lane (an intra-lane overlap).
17. One analysis pass covers both levels. The marginal gate needs both levels' numbers simultaneously to price nested against flat, and a second pass would double the fixed overhead the gate exists to keep visible.
18. The digest is kept and handed verbatim to the contract architects — the lane-level portion to Step 2c, each lane's sub-lane portion to that lane's Step 2s spawn — so no architect re-derives a split the user already saw priced.
19. When `parallelism` is `lanes`, Step 2p requests the lane-level digest only. The sub-lane analysis is `full`-only work and is not paid for by a `lanes` run.

### The inner viability gate — marginal cost/benefit

20. Define the **makespan model** used by every gate and every printed evaluation, with its assumption stated inline exactly as the existing speedup estimate does:
    - `span(L)` = `tasks(L)` for an unsplit lane; `max over sub-lanes s of tasks(s)` for a split lane.
    - `makespan` = `max over lanes L of span(L)`, plus the fixed overhead (contract passes + join passes).
    - `M_flat` is the makespan with no lane split; `M_nested` is the makespan under the adopted nested plan.
    Never print a wall-clock ETA. Task counts are the honest, checkable proxy, and the assumption that they proxy effort equally is stated every time a number derived from them is shown.
21. **Marginal-gain rule (the critical-path test).** A candidate sub-split of lane `L` is evaluated by the reduction it produces in the **run's** makespan, not in `L`'s own task count. Splitting a lane that is not the current critical path yields a marginal gain of zero — the run still waits for the largest lane — and is rejected. Formally, splitting the critical lane `L` lowers the makespan only to `max(second_largest_span, largest_sublane_of_L)`.
22. **Cost side.** A sub-split's cost is: one sub-contract architect pass, one inner-join pass, and the sub-contract's interface-point count as reconciliation units. A sub-split is adopted only when its marginal gain **exceeds** that cost. Equal is not enough — a wash means paying contract overhead for no wall-clock.
23. **Greedy, recomputed adoption.** Evaluate candidates critical-lane-first; after each adoption, recompute the makespan and re-evaluate the remaining candidates against the new critical path. Stop when no remaining candidate's marginal gain exceeds its cost, or when the leaf-width ceiling (requirement 26) is reached. **Partial adoption is the normal outcome** — `full` routinely sub-splits some lanes and leaves others flat, and the printed plan says which.
24. **Diminishing-payback rule (aggregate).** After the nested plan is assembled, reject the whole nested plan and fall back to flat `lanes` when the **aggregate** interface-point count across the parent contract plus every adopted sub-contract exceeds the smallest **leaf's** task count. This is the two-level form of the shipped condition-4 and is the direct expression of the concern that each split shrinks each slice's payback.
25. Re-apply every existing per-lane viability condition at **sub-lane granularity** for each candidate split: at least 2 sub-lanes carry work; no sub-lane holds more than 70% of the lane's tasks; sub-lane globs are contained and disjoint (requirement 12); the sub-contract's interface points do not exceed the smallest sub-lane's task count; the project's gate commands from `PROJECT-CONTEXT.md` → **Commands** can be scoped to a sub-lane's paths (otherwise that gate defers to the inner join); and the host can fan out at the resulting leaf width. Any failure rejects that lane's split with a named reason and leaves the lane flat.
26. Add config key `max_parallel_lanes`, integer, default `6`, no CLI arg. It caps the **leaf-set width of any single concurrent dispatch**. When the adopted nested plan would exceed it, drop the **lowest-marginal-gain** sub-splits (those lanes run flat) until the leaf set fits, and print each drop with its lane name and the ceiling. It is absent-tolerant like every other key.
27. Print the nested evaluation as an extension of the existing slicing-analysis block, showing **flat vs nested side by side** so `full` is priced against `lanes` rather than against sequential:

    ```
    ORCHESTRATOR — nested slicing analysis
    Flat plan:   makespan {M_flat} (critical lane {name}={n} tasks)
    Nested plan: makespan {M_nested} (critical leaf {qualified name}={n} tasks)
    Sub-split lanes: {lane}→{k} sub-lanes ({marginal gain} tasks off the critical path, cost {c}), …
    Lanes left flat: {name} — {reason}, …
    Leaf set: {N} leaves (ceiling {max_parallel_lanes})
    Contracts to freeze: 1 parent + {k} sub-contracts; {I} interface points total
      Assumption: leaves run concurrently and task counts proxy wall-clock effort equally.
    Verdict: {nested viable | nested non-viable — reason → degrading to lanes}
    ```

### The `ask` ladder

28. The ladder keeps three options and the `ask` sentinel. Option 3 is rewritten:
    1. **Sequential (`off`)** — today's pipeline; zero contract overhead.
    2. **Lane-parallel (`lanes`)** — parent contract + N lane plans + N concurrent coders; one tester, one reviewer, one QA at the join. Estimated makespan `M_flat`.
    3. **Nested lane-parallel (`full`)** — everything `lanes` does, **plus** a sub-contract and concurrent sub-lane coders for each lane that clears the marginal gate. Estimated makespan `M_nested`; costs `{k}` extra contract passes and `{k}` extra inner joins; sub-splits `{lanes}`.
29. **Option 3 is omitted from the ladder** when no lane clears the inner gate, with a single reason line printed above the question (`nested split not offered: {reason}`). The user is never offered a level that would immediately degrade.
30. Option 1 is always offered and is always the recommendation when the flat verdict is non-viable. All existing no-prompt guards (`automation_level=autonomous`, host cannot present a structured question) are unchanged and still applied at Step 2p.0 before any spawn. The guarantee that **no non-interactive caller can ever be blocked by Step 2p** is preserved verbatim.

### Step 2s — sub-contract authoring

31. Add pipeline step **2s**, after Step 2c and before Step 2L. It runs only when `parallelism` resolved to `full` **and** at least one lane was adopted for sub-splitting. It spawns **one architect per sub-split lane, concurrently**, each with `Type: contract`, the spec path, the parent contract path, that lane's name, that lane's sub-lane portion of the 2p digest, and its own pre-generated `PACT` ID.
32. A **sub-contract** is a `PACT` artifact in `plans/feat/` — same prefix, same directory, same five required frontmatter keys, same renderer scaffold mapping, same pairing/link-gate compatibility. Its `related_to` references **both** the spec and the parent `PACT`. No new prefix, directory, scaffold, or frontmatter key is introduced.
33. A sub-contract carries the same regions as the parent contract, interpreted one level down — sub-lane map, path ownership, interface points, unowned files, integration sub-lane, per-sub-lane definition of done — **plus one new required region**: **Inherited interface assignments**. That region assigns every parent-contract interface row whose producer or consumer is this lane to exactly one named sub-lane, so both sides of a parent row remain verifiable at leaf granularity.
34. The Inherited-interface-assignments region is what lets `templates/coder.md`'s existing rule — *"Read the `PACT` at `contract=`. It is the authority on what you own."* — stay true verbatim at both levels: a leaf reads exactly one contract and finds both its intra-lane rows and its inherited rows there. This is the reason the region is required rather than optional; state it where the region is specified.
35. The **parent contract's lane map gains one column, `Sub-contract`** — empty for a flat lane, the child `PACT` ID for a sub-split lane. This is the parent's single machine-readable index of the nesting, and it is what downstream `PACT` ID resolution walks. The parent contract remains the run-level index; a sub-contract never links sideways to a sibling.
36. Every leaf `FEAT` ID is pre-generated with `newid FEAT` **before** the contract spawns that must carry it, exactly as the shipped design requires for lane IDs. Step 2c remains the sole allocation site for unsplit lanes' plan IDs; **Step 2s's spawn prompt is the sole allocation site for a split lane's sub-lane plan IDs**, generated by the orchestrator immediately before the 2s fan-out. `newid FEAT` is never called twice for the same leaf, and the reasoning already documented at Step 2L (a second allocation succeeds silently and yields a different set, orphaning the plans the contract lists) is restated for the sub-lane case.
37. **File verification is mandatory** after Step 2s, mirroring Step 2c's: read each sub-contract and its `.progress.md`; confirm `related_to` references both the spec and the parent `PACT`; confirm every required region including Inherited interface assignments is present; confirm the parent's `Sub-contract` column now names it. Re-invoke once on failure, then stop and report.
38. `templates/architect.md`'s `Type: contract` workflow (Step 3C) is extended to cover the sub-contract case — the containment rule, the Inherited-interface-assignments region, and the fact that a sub-contract's interface rows are intra-lane by definition — rather than a second parallel workflow being added. Deliberate divergences between the parent-contract and sub-contract cases are documented; everything else is shared.

### Steps 2L / 3L — leaf-granularity fan-out

39. Step 2L fans out architects at **leaf** granularity: one lane plan for each unsplit lane (today's behavior, unchanged) and one sub-lane plan for each sub-lane of a split lane. A split lane produces **no** lane-level `FEAT` plan of its own — its plans are its sub-lanes'.
40. Step 3L fans out coders at **leaf** granularity as **one flat concurrent dispatch over the whole leaf set**, not as per-lane nested groups. Flat dispatch is safe precisely because the containment rule (requirement 13) already proves global disjointness, and it is what actually delivers the extra concurrency the level exists for.
41. The existing **global barrier** discipline is preserved and extended: all of Step 2s, then all of Step 2L, then all of Step 3L. A contract or plan that fails verification is re-invoked while the workspace is still untouched; the recoverability argument already written at Step 2L applies unchanged and is the reason no lane is allowed to chain its own architect→coder ahead of the others.
42. The role-prompt preamble is unchanged in shape. For a leaf, `lane=` carries the **qualified leaf name** (`backend/data` for a sub-lane, `backend` for an unsplit lane) and `contract=` points to that leaf's **governing contract**. Both lines remain the single authoritative source of lane membership; a role never infers its lane or depth from a path, a plan ID, or plan prose. On an `off` run both lines are still omitted entirely.
43. `templates/coder.md` needs **no new boundary rule**: "every file you write must fall inside your lane's owned path globs, read from the `PACT` at `contract=`" is already correct for a sub-lane, because the governing contract states the sub-lane's globs. The reserved BLOCKED reasons `lane boundary` and `contract violation` keep their exact spellings and meanings at both levels. The only edit is to make the existing text explicitly cover a qualified leaf name and a sub-contract, so no reader concludes the rule is top-level-only.
44. Path-scoped gates, the deferral of unscopable gates to a join, and the prohibition on running the full test suite inside a lane all apply unchanged at sub-lane granularity. An unscopable gate defers to the **nearest enclosing join** — the inner join for a sub-lane, the outer join for an unsplit lane.

### Step 3s / 3j — bottom-up join composition

45. Add pipeline step **3s — inner join**, running after the leaf barrier and before Step 3j. For each sub-split lane, in a deterministic order: verify every sub-contract interface row on both producer and consumer sides using the same failure format the outer join already prints; run that lane's integration sub-lane, if declared, through a **single sequential coder invocation** after its other sub-lanes are DONE; update the sub-contract's sub-lane-status table; then mark the lane DONE in the **parent** contract's lane-status table.
46. **The orchestrator is the sole writer of every contract's status table, at both levels.** No subagent writes a `PACT` or a sub-contract. This keeps the run-level view single-writer and unraceable, exactly as the shipped design requires for the parent.
47. Step 3j (outer join) keeps its shape and order: verify every parent-contract row on both sides, run the top-level integration lane sequentially, run `simplify` **once** over the union diff, update the parent lane-status table. `simplify` and the full test suite run **exactly once per run**, at the outer join — never per lane, never per sub-lane, at any depth.
48. A parent-contract interface row whose producer or consumer lane was sub-split is verified against the **sub-lane the sub-contract assigned it to** (requirement 33). The outer join never has to guess which leaf owns a parent row.
49. `references/artifact-format.md` → **`PACT` ID resolution** is extended: when resolving the plan set from a lane map, a row carrying a `Sub-contract` ID resolves by reading that sub-contract and taking **its** leaf plan IDs in place of the row's own. The recursion is **one level only** (depth cap). The "every resolved plan must be `status: DONE`" check applies to the resolved **leaf** set, and the union-of-diffs evaluation is unchanged.
50. The tester, reviewer, and QA are still invoked **once each, at the outer join, with the parent `PACT` ID**. They need no knowledge of nesting beyond requirement 49's resolution rule — which lives in the artifact-format reference they already follow, not in three separate templates.
51. Extend the **Parallel-mode stdout lines** table in `references/artifact-format.md` with rows for Step 2s (`CONTRACTS — {k} sub-contracts dispatched`, then one `Lane: {name} → {PACT-ID}` per split lane) and Step 3s (`SUBJOIN — {PACT-ID} reconciled`, then `Status: JOINED | PARTIAL | AMENDED` and one `Sub-lane: {qualified name} — {DONE | BLOCKED} ({reason})`). Existing rows are untouched, and the `LANES —` dispatch lines are updated to report leaf counts and qualified leaf names.
52. Update the pipeline-overview diagram in `SKILL.md` to show the nested branch — a split lane expanding into sub-lanes with an inner join feeding the outer join — so no reader can follow the diagram and land on flat behavior for `full`.

### Closing the dispatch gap (eval G3)

53. **No level-specific behavior may be specified only inside a join step or only in ladder option text.** Every behavior that distinguishes `full` from `lanes` must be dispatched by a numbered step that precedes the join it feeds: sub-contracts at 2s, sub-lane plans at 2L, sub-lane coders at 3L, inner joins at 3s. This requirement exists because the shipped `full` was described exclusively in `3j.3` and the ladder, so an orchestrator executing the document top-to-bottom silently ran `lanes`; the redefinition must not reproduce that shape.
54. Every producing spawn this spec adds pre-generates its `ID to use:` before the spawn, per the mandatory preamble. There is no path on which a nested spawn is described without the ID it requires being allocated.

### Precedence: `PARTIAL` halt vs. contract amendment (eval G5)

55. State an explicit precedence rule where both are specified: **the amendment loop is evaluated first.** A leaf that stopped with the reserved reason `contract violation` enters the amendment loop; a leaf that stopped for any **other** reason (including `lane boundary`) halts the run `PARTIAL`. Neither subsection may continue to describe itself as firing unconditionally.
56. When both classes of block are present in one join, the amendment loop runs first for the violating leaves; if any non-amendable block remains after the amendment resolves, the run then halts `PARTIAL`. When the amendment budget is exhausted, a still-unresolved `contract violation` **becomes** a `PARTIAL` halt rather than looping.
57. **Amend at the narrowest contract that can fix the row.** A violation of a sub-contract row amends only that sub-contract and re-slices only that lane's sub-lanes. A violation of an **inherited** parent row escalates to a parent-contract amendment, which re-freezes the parent and **invalidates every sub-contract whose lane the amendment touches** — those sub-contracts are re-authored, not patched.
58. `max_contract_amendments` remains **one budget for the whole run**, shared across both levels. Nesting must not multiply the retry budget; every amendment at either depth decrements the same counter. On exhaustion the run abandons parallel execution and continues sequentially from the current state, unchanged.

### `PARTIAL` resume (eval G4)

59. Give the documented `PARTIAL` resume an actual mechanism. At Step 0, before Step 1, the orchestrator detects a prior halted parallel run: a `PACT` in `plans/feat/` whose lane-status table has at least one non-DONE lane and whose spec has no completed downstream terminal artifact.
60. On detection, resume is applied **only** when the user opts in — via an explicit `--resume` argument, or via the manual-mode confirmation. In **autonomous or otherwise non-interactive** mode without `--resume`, the orchestrator prints a **single non-blocking hint** naming the halted contract and starts a fresh run. This mirrors the existing detected-lanes hint pattern and preserves the guarantee that no non-interactive caller is ever blocked.
61. When resume is applied, the orchestrator **skips Steps 1, 2p, 2c, 2s, and 2L** — the spec, contracts, and plans already exist and are authoritative — recovers the parent contract, walks its `Sub-contract` column to rebuild the full leaf set, and **re-enters at Step 3L with the leaf set restricted to leaves whose `FEAT` plan is not `DONE`**. It then proceeds through 3s and 3j normally. The coder's existing resume-from-first-unchecked-task semantics carry the rest and are unchanged.
62. A resumed run prints what it recovered and what it is re-dispatching (`RESUME — {PACT-ID}` plus the recovered leaf set with each leaf's status), so a resumed run is never indistinguishable from a fresh one in the transcript.

### Backward compatibility

63. With `parallelism` unset or `off`, every role prompt, artifact, status line, and stdout header line is identical to a pre-feature run. Steps 0c, 2p, 2c, 2s, 2L, 3L, 3s, and 3j do not exist for the run.
64. `parallelism: lanes` is **behaviorally unchanged** by this spec: no sub-lane analysis is requested, no sub-contract is authored, the fan-out is at lane granularity, and the join is the outer join alone. The only observable deltas are internal renamings that leave its output identical.
65. `parallelism: full` **changes meaning**, and this is stated explicitly as a documented redefinition rather than papered over. The value keeps parsing — no config errors, no migration, no deprecation shim. The change is bounded by the fact that the shipped `full` had no dispatch point (eval G3), so it silently ran `lanes`; the redefinition therefore replaces a documented no-op, not working behavior. Every place that documents `full` must reflect the new meaning, and no place may retain the old one.
66. `sublanes` and `max_parallel_lanes` are nullable/absent-tolerant: an existing `.orchestrator/config.json` without them resolves to `[]`-equivalent and `6`, and the pipeline behaves exactly as it does today. No migration is forced; legacy artifacts and existing `plans/` trees render and execute unchanged.
67. Legacy `PACT` artifacts without a `Sub-contract` column resolve as all-flat under requirement 49 — an absent column is read as "no lane is sub-split", never as an error.

### Reference reachability

68. Every normative rule this spec introduces must be stated in a file that Bootstrap B3 **materializes** into a target project's `.orchestrator/` — specifically `references/config.md` and `references/artifact-format.md`. This applies to the sub-lane name/path grammar, the containment rule, the glob rejection list's new case, the depth cap, and the makespan/marginal-gain definitions. A pointer to a file that does not exist in a downstream project is not a specification. Because the sub-lane grammar is defined as "the same as the lane grammar", and the lane grammar currently points at `roadmap/references/config.md` — which B3 does not materialize (eval G2) — **the lane name/path grammar must be inlined into `references/config.md`** (with a "mirrored from `roadmap`; keep in sync" marker) as part of this change. That inlining is in scope precisely because this spec's own rules are unreachable without it.

## Non-functional requirements

- **Performance**: the feature's entire purpose is wall-clock reduction, and its own overhead is the thing the gate must keep visible. Every added fixed cost — one `Explore` digest extension, `k` sub-contract architect passes, `k` inner-join passes — appears in the printed nested evaluation and is an input to the marginal-gain test, never hidden. Nested is priced against flat, not against sequential, because pricing against sequential would make every nested plan look good.
- **Security / auth**: path globs remain the **only** isolation mechanism between concurrent coders, now at two levels, so an unbounded, escaping, overlapping, or non-contained glob is a correctness *and* safety failure and is rejected at contract-authoring time. Sub-lane names and paths from `.orchestrator/config.json` are untrusted, re-validated on read, surfaced as delimited data, and never spliced into instruction bodies. Widening the leaf set widens the blast radius of a bad glob, which is a second reason `max_parallel_lanes` has a finite default.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: no new user data is introduced, stored, or retained.
- **Monetization tier**: —

## Project-context fit

**Layers touched.** Doc-skill only — no runtime code changes:

- `plugins/my-skills/skills/orchestrator/SKILL.md` — redefined `full`; extended Step 0c and Step 2p; new Steps 2s and 3s; leaf-granularity 2L/3L; the 3j.1/3j.2 precedence rule; the `PARTIAL` resume detection and re-entry; the rewritten `ask` ladder; the updated pipeline-overview diagram.
- `references/config.md` — `sublanes`, `max_parallel_lanes`, the redefined `parallelism` table row, the depth cap, the containment rule added to the glob rejection list, the makespan/marginal-gain definitions, and the inlined lane grammar (requirement 68).
- `references/artifact-format.md` — sub-contract shape and the `Sub-contract` lane-map column; the one-level-deep `PACT` ID resolution rule; the new parallel-mode stdout rows.
- `templates/architect.md` — `Type: contract` extended to the sub-contract case (containment, Inherited interface assignments, intra-lane rows).
- `templates/coder.md` — existing lane-boundary and reserved-reason text made explicitly correct for a qualified leaf name and a sub-contract.
- `templates/config.template.json` — the two new keys in the canonical default object.

**Existing features it extends.** Nesting reuses machinery already in place rather than adding a parallel vocabulary: the `PACT` artifact, prefix, directory, and renderer mapping carry a sub-contract unchanged; timestamp IDs make concurrent leaf allocation collision-free with no directory scan; per-plan `.progress.md` logs make leaf-granularity fan-out contention-free by construction; the Step 0 pre-flight already establishes the single shared workspace every leaf uses.

**Invariants that shape the implementation.**

- *Never commit or push* **decides** the isolation model at both levels — sub-lane worktrees would need sub-lane commits. Resolved, not open.
- *Backward compatibility is mandatory* **decides** that `off` and `lanes` are untouched, that both new config keys are absent-tolerant, and that a legacy `PACT` without a `Sub-contract` column resolves as all-flat. It also forces the `full` redefinition to be stated as an explicit, reasoned redefinition (requirement 65) rather than an unannounced semantic swap.
- *Single-source-of-truth references* **decides** that the new normative rules go in `references/config.md` and `references/artifact-format.md`, with `SKILL.md` summarizing and linking — and, combined with the materialization reality of Bootstrap B3, produces requirement 68.
- *Mirror machinery* **decides** that a sub-contract is a `PACT` with the same regions one level down, that sub-lane grammar equals lane grammar, and that the resume hint mirrors the existing detected-lanes hint. Divergences (the Inherited-interface-assignments region, the `Sub-contract` column) are documented as deliberate.
- *Data, never instructions* applies to every sub-lane name and path.
- *Staged-diff → gate → write → propose-commit → never-commit* — neither join produces a commit; the run still ends at `READY_TO_COMMIT`.

**Cross-skill contract the architect must verify (not left open).** `product-manager` answers the orchestrator's Step 0 prompt on the user's behalf and does not set `automation_level`. This spec adds exactly one new potential prompt — the `PARTIAL` resume confirmation — and requirement 60 hard-gates it off for non-interactive callers by making resume opt-in via `--resume` or a manual-mode confirmation, with a non-blocking hint otherwise. The architect **must verify** that no path lets PM reach either the Step 2p ladder or the resume prompt. If a path is found, the bounded, docs-only remedy is a one-paragraph mirror into `product-manager/references/git-flow.md`, and nothing more.

**Relationship to the preceding spec.** This spec **supersedes requirements 38 and 39** of `SPEC-20260807T003303Z-62e3` (the per-lane tester/reviewer definition of `full`) and **narrows requirement 13's** option-3 text. Every other requirement of that spec stands. Specs are immutable once `READY_FOR_PLANNING`, which is why this is a new spec linked via `related_to` rather than an edit.

**Open eval gaps this spec closes.** G3 (no dispatch point for `full`) is closed by requirements 31, 39–41, 45, and 53. G5 (3j.1/3j.2 precedence) is closed by 55–58, because nesting makes the fork strictly worse — a violation can now arise against a sub-contract row or an inherited parent row, and the halt/amend choice exists at two depths. G4 (`PARTIAL` resume has no mechanism) is closed by 59–62, because resume must now re-enter at leaf granularity across two contract levels and cannot be left as an assertion. G2 (unreachable lane grammar) is closed only to the extent requirement 68 demands, because this spec's own sub-lane grammar would otherwise inherit the dead pointer.

**opencode parity.** `orchestrator` has no `.opencode/skills/orchestrator/` override port, so the opencode-port-parity invariant does not apply. Bootstrap B3 materializes role templates for both hosts, so every template change stays host-agnostic and every new fan-out is expressed for both `Agent` and `task`. The existing host-concurrency viability condition remains the fallback, and requirement 25 re-applies it at the wider leaf width — a host that can fan out 3 lanes but not 9 leaves runs flat rather than failing.

**Testing posture.** Structural review per `PROJECT-CONTEXT.md`: cross-references resolve (and now, per requirement 68, resolve *in a materialized file*), new machinery is described symmetrically to the machinery it mirrors, backward-compat claims hold in prose, and no surviving text states the old `full` meaning. No `.md`/`.html` template parity work and no renderer change are required, because the sub-contract reuses the `PACT` prefix and its existing scaffold mapping.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: `plugins/my-skills/skills/orchestrator/SKILL.md`; `references/config.md`; `references/artifact-format.md`; `templates/architect.md`; `templates/coder.md`; `templates/config.template.json`. Conditionally, and only if the architect proves the PM guard insufficient: `plugins/my-skills/skills/product-manager/references/git-flow.md`.

## Open questions

- None. Every unknown was resolved by a recorded default below or decided by a `PROJECT-CONTEXT.md` invariant. No reserved decision (out-of-scope item, open product decision, compliance choice, or one-way door) was defaulted: the one semantic redefinition — the meaning of `full` — was explicitly directed by the user's own message and the task prompt.

## Decisions resolved by Brainstormer default

- **What happens to the shipped `full` (per-lane tester + reviewer)?** → Dropped outright; not retained under another name, not folded in. → The eval proved it has no dispatch point, so no run ever got the behavior — dropping replaces a documented no-op, not working functionality. The skill's own honest pricing already states it buys zero wall-clock while costing N reviewer passes and N `CR` artifacts, so preserving it would add a ladder rung with negative stated value. The user's redefinition is authoritative for the name.
- **Recursive to arbitrary depth, or capped at 2?** → Hard cap at depth 2, with no config knob. → Every split pays a contract + join back from a pool the previous split already divided, so the marginal gate would reject depth 3 in essentially every realistic shape; arbitrary recursion would also turn a two-local-check disjointness proof into an n-level tree check and nest the join state indefinitely. The user's own example is exactly two levels. A knob would advertise a depth the gate would never adopt.
- **Nested `PACT` per split, or one extended parent contract?** → One sub-contract (child `PACT`) per sub-split lane, indexed from the parent's lane map via a new `Sub-contract` column. → The `PACT`'s six regions map 1:1 onto what a sub-split needs, so reuse beats inventing a nested sub-region syntax (mirror-machinery). Sub-splits are adopted per-lane *after* the parent freezes, so a single mega-contract would have to be authored before per-lane viability is known. Decisively: amendment scoping — a sub-contract amendment re-slices one lane, whereas a mega-contract forces every amendment through a global re-freeze, which is exactly the reconciliation cost contracts exist to prevent.
- **How is two-level path disjointness enforced?** → The containment rule: sub-lane globs strictly partition the parent lane's globs. → Parent-level disjointness is already enforced; containment plus intra-lane disjointness *proves* leaf-level disjointness, reducing an n-way global check to two local ones. It also gives the honest rejection for conceptual-but-not-path-separable slices.
- **How does the join compose?** → Bottom-up: leaf barrier → all inner joins (3s) → outer join (3j). `simplify` and the full suite still run exactly once, at the outer join. → Inner joins are lane-local mechanical verification plus one integration-sub-lane coder; running them before the outer join keeps the outer join's inputs whole. Running `simplify` per lane would multiply a pass whose whole value is seeing the union.
- **Flat leaf fan-out, or per-lane nested dispatch groups?** → One flat concurrent dispatch over the whole leaf set. → The containment rule already guarantees global disjointness, so flat is safe, simpler, and is where the extra concurrency actually materializes. Nested dispatch groups would serialize lanes against each other for no isolation benefit.
- **How does the cost model price a split whose sub-splits shrink each slice's payback?** → A marginal-gain test against the run's critical path, greedy and recomputed after each adoption, plus an aggregate diminishing-payback rejection, plus a leaf-width ceiling. → Splitting a non-critical lane buys zero wall-clock while paying a full contract — pricing a split by its own task count would systematically adopt those. Recomputing after each adoption is what makes "each split shrinks the next one's payback" fall out of the model instead of needing a separate heuristic.
- **Does `full` degrade to `off` or to `lanes` when no lane clears the inner gate?** → To `lanes`, with the reason printed; `lanes` may then independently degrade to `off`. → The two gates test different things; collapsing a failed inner test into a full sequential fallback would discard a flat split that already passed its own viability gate.
- **What does the `ask` ladder offer now?** → Three options still, with option 3 rewritten as nested and **omitted entirely** when no lane clears the inner gate. → Offering a level that would immediately degrade misrepresents the choice. The flat-vs-nested makespan pair is the honest framing the user asked for ("cost efficiency optics").
- **Ceiling on concurrent leaves?** → `max_parallel_lanes`, default 6, dropping lowest-marginal-gain sub-splits until the leaf set fits. → Three lanes × three sub-lanes is nine concurrent coders in one shared workspace; host concurrency limits and blast radius both argue for a finite default, and dropping by lowest marginal gain keeps the ceiling consistent with the cost model rather than arbitrary.
- **Where do sub-lane taxonomies come from?** → Optional `lanes[].sublanes` in `.orchestrator/config.json`, matched to a lane by `name`, else derived by the Step 2p analysis. `roadmap.config.json` → `config.systems` is **not** extended. → Intra-system layering is genuinely project-specific (NestJS controllers vs Django viewsets), so a declared override earns its place; but `config.systems` models deployable systems (ADR-0001) and growing a sub-lane concept there would fork a taxonomy this design deliberately reuses.
- **One analysis pass or two?** → One `Explore` subagent covering both levels. → The marginal gate needs both levels' numbers simultaneously to price nested against flat; a second pass would double the fixed overhead the gate exists to keep visible.
- **Does this spec have to resolve eval gaps G4 and G5?** → Yes, both. → Nesting makes each strictly worse: G5's undefined halt/amend fork now exists at two depths and against two row classes; G4's resume must now re-enter at leaf granularity across two contract levels. Inheriting either would ship a fork an executing LLM cannot resolve.
- **`PARTIAL` resume: automatic, or opt-in?** → Opt-in via `--resume` or a manual-mode confirmation; a non-blocking hint otherwise. → "No non-interactive caller can ever be blocked" is the strongest constraint in the shipped design and `product-manager` depends on it. Auto-resuming would also silently re-enter a prior run's contract on a fresh invocation, which is worse than starting clean.
- **How do amendments scope across levels, and do they share a budget?** → Amend at the narrowest contract that can fix the row; a parent amendment invalidates and re-authors affected sub-contracts; one shared `max_contract_amendments` budget for the whole run. → Narrow amendment is the point of splitting the contract at all. A per-level budget would let nesting multiply the retry ceiling, and an uncapped amendment loop erases exactly the speed gain the split was chosen for.
- **Do the tester/reviewer/QA templates change?** → No. Only `references/artifact-format.md` → `PACT` ID resolution gains the one-level `Sub-contract` walk. → Those three roles already follow that reference for contract-ID resolution; putting the rule in three templates would create three places to disagree.
- **Is any renderer or HTML-template work needed?** → No. → A sub-contract carries the `PACT` prefix, so the existing `PACT → plan` scaffold mapping and the pairing/link gates cover it unchanged. New scaffold pixel design is out of scope per `PROJECT-CONTEXT.md`.
- **Is inlining the lane grammar (eval G2) in scope?** → Yes, bounded to inlining it into `references/config.md` with a keep-in-sync marker. → This spec defines sub-lane grammar as "the same as lane grammar", and lane grammar currently points at a file Bootstrap B3 does not materialize. Without the inlining, this spec's own security-relevant validation rule is unreachable in every downstream project. It is in scope as a precondition, not as opportunistic gap-fixing.

## References

- `plans/specs/SPEC-20260807T003303Z-62e3-orchestrator-parallel-lane-execution.md` — the flat lane-parallel spec this one nests; requirements 38–39 superseded here.
- `plans/eval/EVAL-20260807T020356Z-b476-orchestrator-parallel-lane-execution.md` — gaps G2 (unreachable grammar), G3 (no `full` dispatch point), G4 (`PARTIAL` resume unmechanized), G5 (3j.1/3j.2 precedence).
- `plugins/my-skills/skills/orchestrator/SKILL.md` — Steps 0b/0c, 2p, 2c, 2L, 3L, 3j and its subsections; the mandatory role-prompt preamble; `newid`; the pipeline-overview diagram.
- `plugins/my-skills/skills/orchestrator/references/config.md` — `parallelism`, `lanes`, `max_contract_amendments`; the owned-glob rejection list; the untrusted-metadata rule.
- `plugins/my-skills/skills/orchestrator/references/artifact-format.md` — `PACT` frontmatter contract, `PACT` ID resolution, Related navigation, the parallel-mode stdout lines table.
- `plugins/my-skills/skills/orchestrator/templates/architect.md` — Step 3C, the `Type: contract` authoring workflow and the `PACT` regions.
- `plugins/my-skills/skills/orchestrator/templates/coder.md` — the lane boundary rule, lane-scoped gates, and the reserved `lane boundary` / `contract violation` BLOCKED reasons.
- `plugins/my-skills/skills/roadmap/references/config.md` — the `systems` name/path grammar this design mirrors and requirement 68 inlines.
- `docs/adr/0001-orthogonal-system-band.md` — the systems-as-orthogonal-band decision the lane taxonomy reuses and this spec declines to extend.
- `plugins/my-skills/skills/product-manager/references/git-flow.md` — PM's documented obligation to answer the orchestrator's Step 0 prompt.
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants, Test tooling, Out of scope.
- `docs/prompts/define-parallel-full.md` — the raw request this spec formalizes.
