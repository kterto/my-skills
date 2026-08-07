---
id: FEAT-20260807T030642Z-6077
title: Nested inner-lane parallelism — redefining the orchestrator's `full` level
type: feat
status: DONE
created_at: 2026-08-07T03:09:07Z
updated_at: 2026-08-07T04:15:59Z
cycle: 0
related_to: SPEC-20260807T025822Z-2a6f, SPEC-20260807T003303Z-62e3, EVAL-20260807T020356Z-b476
---

**Related:** [SPEC-20260807T025822Z-2a6f](../specs/SPEC-20260807T025822Z-2a6f-orchestrator-nested-inner-lane-parallelism.md)

## Overview

Redefine the `orchestrator` skill's `parallelism: full` level from "a per-lane tester and reviewer before the join" (shipped one commit earlier on this branch, and proven a no-op by `EVAL-20260807T020356Z-b476` gap G3 — it had no dispatch point) to **nested inner-lane parallelism**: a lane on the run's critical path may be sliced into sub-lanes governed by a child `PACT` sub-contract, with its own contained/disjoint path ownership and its own inner join that completes before the outer join. Implements `SPEC-20260807T025822Z-2a6f` requirements 1–68 across `SKILL.md`, `references/config.md`, `references/artifact-format.md`, `templates/architect.md`, `templates/coder.md`, and `templates/config.template.json`, plus the one bounded cross-skill mirror this plan's Phase 5 proves necessary in `product-manager/references/git-flow.md`.

This is **doc-skill authoring work only** — no runtime code changes. Per `PROJECT-CONTEXT.md` → Test tooling, verification is **structural review**, so every phase is gated by an explicit, grep-checkable assertion set written *before* the prose it checks (the honest TDD analogue for a markdown-authored skill). The work plans against the **live state** of `plugins/my-skills/skills/orchestrator/` — which already contains Steps 0c / 2p / 2c / 2L / 3L / 3j and the `PACT` artifact — not against a clean slate; every phase edits existing text rather than adding a parallel vocabulary beside it.

## Acceptance Criteria

1. `references/config.md` documents `parallelism: full` as nested inner-lane parallelism, states the **depth-2 hard cap with its reasoning** normatively, and **no file anywhere in the repo** retains the shipped per-lane-tester/reviewer meaning of `full` (requirements 2–4, 63, 65).
2. `references/config.md` documents the optional `lanes[].sublanes` array (`{name, path}`, absent by default) and `max_parallel_lanes` (integer, default `6`, no CLI arg), both absent-tolerant, and the keys table, canonical default object, CLI-args table, and absent-key-tolerance paragraph all agree (requirements 7, 26, 66).
3. The lane `name`/`path` grammar is **inlined** into `references/config.md` with a "mirrored from `roadmap`; keep in sync" marker, and every normative rule this plan introduces (sub-lane grammar, containment rule, glob-rejection list, depth cap, makespan/marginal-gain definitions) is stated in a file Bootstrap B3 materializes into `.orchestrator/` — `references/config.md` or `references/artifact-format.md`. No new rule's only home is a file B3 does not copy (requirement 68).
4. The **containment rule** — sub-lane globs strictly partition the parent lane's globs — is added as a case in the **single** normative owned-glob rejection list in `references/config.md`, together with the statement of what it buys (parent disjointness + containment proves leaf-level disjointness, reducing an n-way check to two local ones) (requirements 12–14).
5. `references/config.md` defines `span`, `makespan`, `M_flat`, `M_nested`, the marginal-gain critical-path test, the cost side, greedy recomputed adoption, the aggregate diminishing-payback rule, and the leaf-width ceiling — each with the "task counts proxy effort equally" assumption stated inline, and with no wall-clock ETA anywhere (requirements 20–26).
6. `references/artifact-format.md` specifies the sub-contract as a `PACT` in `plans/feat/` (no new prefix, directory, scaffold, or frontmatter key), with `related_to` referencing both the spec and the parent `PACT`, and the required **Inherited interface assignments** region together with the reason it is required rather than optional (requirements 32–34).
7. `references/artifact-format.md` → `PACT` ID resolution walks a lane-map `Sub-contract` ID **exactly one level**, applies the all-`DONE` check to the resolved **leaf** set, and reads an absent `Sub-contract` column on a legacy `PACT` as all-flat rather than an error (requirements 35, 49, 67).
8. `references/artifact-format.md` → Parallel-mode lines carries rows for Step 2s and Step 3s and updates the `LANES —` rows to leaf counts and qualified leaf names, with every pre-existing row byte-unchanged and the additive backward-compatibility guarantee intact (requirement 51).
9. `SKILL.md` contains numbered dispatch steps **2s** (sub-contract fan-out) and **3s** (inner join), fans 2L and 3L out at leaf granularity with 3L a single flat concurrent dispatch, and **every** behavior that distinguishes `full` from `lanes` is dispatched by a numbered step preceding the join it feeds — nothing level-specific lives only in a join step or in ladder option text (requirements 31, 39–41, 45, 53).
10. Every spawn `SKILL.md` adds pre-generates its `ID to use:` before the spawn, and Step 2s is stated as the **sole** allocation site for a split lane's sub-lane `FEAT` IDs, with the double-allocation failure mode restated for the sub-lane case (requirements 36, 54).
11. `SKILL.md` states the halt/amend precedence explicitly where both are specified — the amendment loop is evaluated first; `contract violation` amends, any other reason halts `PARTIAL`; amend at the narrowest contract; a parent amendment re-authors affected sub-contracts; one shared `max_contract_amendments` budget across both levels; an exhausted budget turns an unresolved violation into a `PARTIAL` halt (requirements 55–58).
12. `SKILL.md` gives `PARTIAL` resume a mechanism: Step 0 detection, opt-in via `--resume` or a manual-mode confirmation, a **single non-blocking hint** otherwise, skip of Steps 1/2p/2c/2s/2L, leaf-set rebuild via the `Sub-contract` column, re-entry at Step 3L restricted to non-`DONE` leaves, and a `RESUME —` print (requirements 59–62).
13. `full` degrades to `lanes` (never to `off`) with a printed reason when no lane clears the inner gate; the two gates compose in that order and are never conflated; option 3 is **omitted** from the `ask` ladder in that case with a reason line; all existing no-prompt guards are unchanged and still applied at 2p.0 (requirements 6, 28–30).
14. `templates/architect.md`'s `Type: contract` workflow covers the sub-contract case within Step 3C (containment, Inherited interface assignments, intra-lane rows, `Sub-contract` column) — as an extension, not a second parallel workflow — and `templates/coder.md`'s existing boundary text and reserved `lane boundary` / `contract violation` spellings are explicitly correct for a qualified leaf name and a sub-contract (requirements 38, 42–44).
15. `templates/config.template.json` contains the two new keys and is byte-identical in key set and defaults to the canonical default object in `references/config.md`.
16. With `parallelism` unset or `off` the pipeline is documented as byte-identical to a pre-feature run (Steps 0c/2p/2c/2s/2L/3L/3s/3j do not exist), and `parallelism: lanes` is documented as behaviorally unchanged — no sub-lane analysis requested, no sub-contract authored, lane-granularity fan-out, outer join alone (requirements 11, 19, 63, 64).
17. The cross-skill PM guard is **verified, not assumed**: no path lets `product-manager` be blocked by the new resume prompt, and every place PM documents the orchestrator's ladder reflects the new option-3 meaning. Any remedy is a one-paragraph docs-only mirror in `product-manager/references/git-flow.md` and nothing more.
18. Every cross-reference this plan introduces resolves on disk, and no `.md`/`.html` template-parity work, renderer change, or new HTML scaffold is introduced (the sub-contract reuses the `PACT → plan` scaffold mapping unchanged).

## Out of Scope

- Recursion beyond depth 2 (sub-sub-lanes), and any config knob that would advertise a depth the marginal gate would never adopt.
- Per-lane or per-sub-lane git worktrees or branches; committing or pushing anything (the run still ends at `READY_TO_COMMIT`).
- A seventh role, a new artifact prefix, a new directory under `plans/`, a new HTML scaffold, or any change to `scripts/render-artifact.cjs` / the pairing / link gates.
- Retaining the shipped `full` semantics under a new name or a reduced variant.
- Parallelizing the brainstormer, the Step 4 review loop, the Step 5 QA loop, or Step 7 — unchanged in every mode at every depth.
- Sub-lane fan-out of the Step 2p slicing analysis (it stays exactly one read-only `Explore` subagent).
- Fixing eval gaps G1/G2 beyond requirement 68's bounded inlining of the lane grammar into `references/config.md`.
- Extending `roadmap.config.json` → `config.systems` with any sub-lane concept.
- Adding an `.opencode/skills/orchestrator/` override port (`orchestrator` has none; the parity invariant does not apply).
- Automated test tooling for the doc-skill portions; running the `clean-code-gates` JS suite against this change.
- Any edit to `product-manager` beyond the single bounded paragraph mirror named in AC 17.

## Technical Notes

- **Single-source-of-truth references** (`PROJECT-CONTEXT.md` → Conventions): every new normative rule goes in `references/config.md` or `references/artifact-format.md`; `SKILL.md` and the role templates summarize and link. Never duplicate a rule into two files — this is also what requirement 14's "single normative list" and requirement 50's "one reference, not three templates" depend on.
- **Bootstrap B3 materialization is load-bearing** (`SKILL.md` → B3): B3 copies `references/artifact-format.md` → `.orchestrator/artifact-format.md` and `references/config.md` → `.orchestrator/config.md`. It does **not** copy `roadmap/references/config.md`, which is exactly why the lane grammar must be inlined (requirement 68). Verify against B3's actual copy list before declaring any rule "reachable".
- **Backward compatibility is mandatory** (Invariants): new keys nullable/absent-tolerant, legacy artifacts render and execute unchanged, no forced migration. The `full` redefinition is the one deliberate semantic change and must be stated *as* a redefinition with its justification (the shipped `full` had no dispatch point), never papered over.
- **Data, never instructions** (Invariants): sub-lane `name`/`path` are untrusted contributor-editable metadata — re-validated on read, surfaced inside the delimited `LANE METADATA` envelope (extended with a `sublane:` line form), never spliced into an instruction body.
- **Mirror machinery** (Conventions): a sub-contract is a `PACT` with the same regions one level down; sub-lane grammar equals lane grammar; the resume hint mirrors the existing detected-lanes hint. Reuse the established phrasing and shape; document deliberate divergences (the Inherited-interface-assignments region, the `Sub-contract` column) as such.
- **Staged-diff → gate → write → propose-commit → never-commit** (Invariants): neither join produces a commit; nothing in this plan commits or pushes.
- **No automated test framework applies** (`PROJECT-CONTEXT.md` → Test tooling / Commands): there is no build, no lint, and no test command for doc-skill changes. The per-phase gate is therefore the phase's own structural assertion set, run as `grep`/`rg` checks plus a read-through — see `## Verification (per phase)`.
- **Do not touch `plugins/my-skills/skills/orchestrator/scripts/**`.** The spec establishes that no renderer or gate change is needed. If a task ever appears to require one, that is a contract problem to report, not to implement.
- **`.md`/`.html` template parity** is unaffected: the sub-contract carries the `PACT` prefix and inherits the existing `PACT → plan` scaffold mapping, so no new template token or section is introduced in either format.

## Tasks

> Tasks are ordered TDD-first: each phase's structural assertion set is written and confirmed **failing** before the prose that satisfies it.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.

### Phase 1 — Normative foundations in `references/config.md`

- [x] Write the Phase 1 structural assertion set (grep-checkable claims for: redefined `full` row, depth-2 cap + reasoning, `sublanes` key, `max_parallel_lanes` key, containment case inside the single glob-rejection list, makespan/marginal-gain definitions, inlined lane grammar + keep-in-sync marker, `--resume` in the CLI-args table, zero occurrences of the old per-lane-tester/reviewer `full` text) into the plan's Phase 1 verification block, and confirm **every one currently fails** against the live file
- [x] Rewrite the `parallelism` table's `full` row and the surrounding `### parallelism` prose to the nested meaning, and state the **depth-2 hard cap with its reasoning** (each split pays a contract + join back from a pool the previous split already divided) normatively here rather than only in `SKILL.md`
- [x] Add the `full` → `lanes` degradation rule and the statement that the inner gate and the existing six-condition `lanes` gate compose in that order and are never conflated
- [x] Extend the `### lanes` section with the optional `sublanes` array (`{name, path}`, absent by default, matched to a lane by `name`), the two-source resolution order, and the explicit statement that `roadmap.config.json` → `config.systems` is **not** extended
- [x] Inline the lane `name` grammar and `path` validation rules into `references/config.md`, replacing the pointer to `roadmap/references/config.md`, with a visible "mirrored from `roadmap/references/config.md` — keep in sync" marker and the retained `path`-is-required delta
- [x] State that a `sublanes[].name`/`[].path` obeys the same inlined grammar plus containment, and that a failing sub-lane is **dropped and reported** (`sub-lane dropped: {lane}/{name} — {reason}`), never silently widened to the parent's scope
- [x] Add the containment rule as a new case in the **single** owned-glob rejection list, with the two-local-checks-instead-of-an-n-way-check reasoning stated where the rule is stated
- [x] Extend the untrusted-metadata section to sub-lane `name`/`path`, including the `sublane:` line form of the delimited `LANE METADATA` envelope
- [x] Add the makespan model (`span`, `makespan`, `M_flat`, `M_nested`), the marginal-gain critical-path test, the cost side, greedy recomputed adoption with partial adoption as the normal outcome, the aggregate diminishing-payback rule, and the per-sub-lane re-application of the existing viability conditions — each carrying the inline assumption statement, none printing a wall-clock ETA
- [x] Add the `### max_parallel_lanes` section (integer, default `6`, no CLI arg, caps the leaf-set width of any single concurrent dispatch, drops lowest-marginal-gain sub-splits with a printed reason) and add both new keys to the keys/types/defaults table
- [x] Update the canonical default object, add the `--resume` row to the Accepted CLI Args table (no config key, like `--setup`), extend the "no CLI arg" note, and extend the absent-key-tolerance paragraph to `sublanes` and `max_parallel_lanes`
- [x] Run the Phase 1 assertion set and confirm every claim is green

### Phase 2 — `references/artifact-format.md`

- [x] Write the Phase 2 structural assertion set (sub-contract section present; `related_to` references both spec and parent `PACT`; Inherited-interface-assignments region required **with its reason**; `Sub-contract` column; one-level-only resolution; leaf-set `DONE` check; legacy absent column = all-flat; 2s/3s stdout rows; every pre-existing stdout row byte-unchanged) and confirm each fails
- [x] Add the sub-contract shape subsection under the `PACT` frontmatter contract: same prefix, directory, five frontmatter keys, renderer scaffold mapping, and pairing/link-gate compatibility; `related_to` references both the spec and the parent `PACT`
- [x] Specify the required **Inherited interface assignments** region and state the reason it is required rather than optional (it is what keeps `templates/coder.md`'s "read the `PACT` at `contract=`; it is the authority on what you own" true verbatim at both levels — a leaf reads exactly one contract)
- [x] Specify the parent lane map's new `Sub-contract` column as the run's single machine-readable index of the nesting, with the rule that a sub-contract never links sideways to a sibling
- [x] Extend `PACT` ID resolution: a row carrying a `Sub-contract` ID resolves by reading that sub-contract and taking its leaf plan IDs in place of the row's own; recursion is **one level only**; the all-`DONE` check applies to the resolved leaf set; the union-of-diffs evaluation is unchanged; an absent column on a legacy `PACT` reads as all-flat, never an error
- [x] Add the Step 2s and Step 3s rows to the Parallel-mode lines table and update the `LANES —` rows to report leaf counts and qualified leaf names, leaving every other row byte-unchanged and the additive-backward-compatibility paragraph intact
- [x] Extend the Related-navigation edge table so a `PACT` that is a sub-contract links to both the spec and the parent `PACT`
- [x] Run the Phase 2 assertion set and confirm every claim is green

### Phase 3 — `SKILL.md` pipeline steps

- [x] Write the Phase 3 structural assertion set (numbered Steps 2s and 3s exist; leaf-granularity 2L/3L; flat 3L dispatch; requirement-53 audit — no `full`-distinguishing behavior lives only in a join step or ladder text; every added spawn pre-generates its ID; halt/amend precedence stated in both 3j.1 and 3j.2; resume detection at Step 0; diagram shows the nested branch; skip lists name 2s and 3s; zero occurrences of the old `full` semantics) and confirm each fails
- [x] Update the pipeline-overview diagram and its bullet list so the nested branch (a split lane expanding into sub-lanes with an inner join feeding the outer join) is visible, and so no reader following the diagram lands on flat behavior for `full`
- [x] Extend Step 0 with `--resume` argument parsing and prior-halted-run **detection** (a `PACT` in `plans/feat/` with at least one non-`DONE` lane and no completed downstream terminal artifact)
- [x] Specify resume opt-in: `--resume` or a manual-mode confirmation applies it; autonomous/non-interactive without `--resume` prints a **single non-blocking hint** naming the halted contract and starts fresh — mirroring the existing detected-lanes hint and preserving the never-block guarantee verbatim
- [x] Specify resume re-entry: skip Steps 1, 2p, 2c, 2s, 2L; recover the parent contract; walk its `Sub-contract` column to rebuild the full leaf set; re-enter at Step 3L restricted to leaves whose `FEAT` plan is not `DONE`; proceed through 3s and 3j normally; print `RESUME — {PACT-ID}` plus the recovered leaf set with each leaf's status
- [x] Update Step 0b's `off` skip list to include Steps 2s and 3s, and extend Step 0c to resolve declared sub-lanes alongside declared lanes — still only when `parallelism` is not `off`, and with declared sub-lanes read and **ignored without error** under `lanes`
- [x] Extend Step 2p.1's digest request to cover both levels in **one** pass (per candidate lane: a proposed sub-lane split with the same per-slice fields, plus every intra-lane overlap), state why one pass rather than two, route the lane-level portion to Step 2c and each lane's sub-lane portion to its Step 2s spawn verbatim, and state that a `lanes` run requests the lane-level digest only
- [x] Extend Step 2p.2's printed evaluation into the flat-vs-nested side-by-side block from the spec (flat/nested makespan, sub-split lanes with marginal gain and cost, lanes left flat with reasons, leaf set vs ceiling, contracts and interface points, inline assumption, verdict)
- [x] Add the inner viability gate to Step 2p: the marginal-gain critical-path test, greedy recomputed adoption, the aggregate diminishing-payback rejection, the leaf-width ceiling with its lowest-marginal-gain drops, and the per-sub-lane re-application of every existing viability condition — each rejection naming its reason and leaving that lane flat, and `full` degrading to `lanes` (never `off`) when no lane clears
- [x] Rewrite the Step 2p.5 `ask` ladder: option 3 becomes nested lane-parallel annotated with `M_nested`, the extra contract/inner-join passes, and the sub-split lanes; option 3 is **omitted** with a single printed reason line when no lane clears the inner gate; option 1 is still always offered and still the recommendation when the flat verdict is non-viable; the 2p.0/2p.4 no-prompt guards are unchanged
- [x] Update Step 2p.6's fork so the parallel path reads 2c → 2s → 2L → 3L → 3s → 3j, and the `off` path's non-existent-steps list names 2s and 3s
- [x] Add **Step 2s — sub-contract authoring** after 2c and before 2L: runs only when `full` resolved and at least one lane was adopted; one architect per sub-split lane, concurrently, each with `Type: contract`, the spec path, the parent contract path, the lane name, that lane's sub-lane digest portion, the delimited sub-lane metadata, and its own pre-generated `PACT` ID; plus the `CONTRACTS —` / `Lane: {name} → {PACT-ID}` prints
- [x] Specify Step 2s's sub-lane `FEAT` ID pre-generation as the **sole** allocation site for a split lane's leaf plan IDs (Step 2c remains sole allocation site for unsplit lanes), and restate the Step 2L double-allocation failure mode — a second `newid FEAT` succeeds silently, yields a different set, and orphans the plans the contract lists — for the sub-lane case
- [x] Add Step 2s's mandatory file verification mirroring 2c's: read each sub-contract and its `.progress.md`; confirm `related_to` references both the spec and the parent `PACT`; confirm every required region including Inherited interface assignments; confirm the parent's `Sub-contract` column now names it; re-invoke once on failure, then stop and report
- [x] Rework Step 2L to leaf granularity: one lane plan per unsplit lane (unchanged) and one sub-lane plan per sub-lane of a split lane, with a split lane producing **no** lane-level `FEAT` plan of its own; extend the global-barrier paragraph to cover 2s → 2L → 3L and restate the recoverability argument
- [x] Rework Step 3L into **one flat concurrent dispatch over the whole leaf set**, stating that flat is safe precisely because the containment rule already proves global disjointness and that this is where the extra concurrency materializes; keep the integration lane undispatched here
- [x] State the role-prompt preamble delta for leaves — `lane=` carries the qualified leaf name, `contract=` points at the leaf's **governing** contract, both remain the single authoritative source of lane membership, and both are still omitted entirely on an `off` run — and that path-scoped gates defer to the **nearest enclosing join**
- [x] Add **Step 3s — inner join** after the leaf barrier and before 3j: per sub-split lane in a deterministic order, verify every sub-contract interface row on both sides using the outer join's failure format, run that lane's integration sub-lane (if declared) through a single sequential coder invocation after its other sub-lanes are DONE, update the sub-contract's sub-lane-status table, then mark the lane DONE in the **parent** contract's lane-status table; plus the `SUBJOIN —` prints
- [x] State that the orchestrator is the **sole writer** of every contract's status table at both levels, and that no subagent ever writes a `PACT` or a sub-contract
- [x] Update Step 3j: a parent row whose producer or consumer lane was sub-split is verified against the sub-lane the sub-contract assigned it to (never guessed); `simplify` and the full test suite run **exactly once per run**, at the outer join, never per lane or per sub-lane at any depth
- [x] Rewrite Step 3j.3 to remove the shipped `full` meaning entirely and state that tester, reviewer, and QA are invoked once each at the outer join with the parent `PACT` ID, needing no knowledge of nesting beyond the artifact-format resolution rule
- [x] Add the explicit halt/amend precedence rule to **both** 3j.1 and 3j.2: the amendment loop is evaluated first; `contract violation` amends and any other reason (including `lane boundary`) halts `PARTIAL`; when both are present the amendment runs first and any remaining non-amendable block then halts `PARTIAL`; an exhausted budget turns a still-unresolved violation into a `PARTIAL` halt; neither subsection may still describe itself as firing unconditionally
- [x] Specify amendment scoping: amend at the **narrowest** contract that can fix the row; a sub-contract-row violation amends only that sub-contract and re-slices only that lane; an **inherited** parent-row violation escalates to a parent amendment that re-freezes the parent and **invalidates and re-authors** every affected sub-contract; `max_contract_amendments` stays one budget shared across both levels, decremented by every amendment at either depth
- [x] Run the requirement-53 audit as an explicit pass over the finished `SKILL.md`: confirm every `full`-vs-`lanes` behavior has a numbered dispatch step preceding the join it feeds, and that every added producing spawn pre-generates its `ID to use:`
- [x] Run the Phase 3 assertion set and confirm every claim is green

### Phase 4 — Role templates and the config template

- [x] Write the Phase 4 structural assertion set (architect Step 3C covers the sub-contract case as one extended workflow; coder text explicitly covers a qualified leaf name and a sub-contract; reserved reason spellings unchanged; `config.template.json` key set and defaults ≡ the canonical default object in `references/config.md`) and confirm each fails
- [x] Extend `templates/architect.md`'s Inputs section and canonical type table notes so a `Type: contract` invocation carrying a parent contract path and a lane name is recognized as the sub-contract case — without inventing a new `type` value, directory, or prefix
- [x] Extend Step 3C to the sub-contract case **within the existing workflow**: the containment rule applied to sub-lane globs, the required Inherited-interface-assignments region, the fact that a sub-contract's own interface rows are intra-lane by definition, `related_to` referencing both the spec and the parent `PACT`, and the parent's `Sub-contract` column — documenting deliberate divergences and sharing everything else
- [x] Update Step 3C region 1 to carry the `Sub-contract` column in the parent lane map (empty for a flat lane), and the lane-status table guidance to cover the sub-lane-status table a sub-contract ends with
- [x] Update `templates/coder.md` Step 2L and the Lane-BLOCKED-reasons section so the existing boundary rule reads correctly for a **qualified leaf name** and a **governing sub-contract**, keeping the `lane boundary` and `contract violation` spellings and meanings exactly as they are and adding no new boundary rule
- [x] Update the coder's gate guidance so an unscopable gate defers to the **nearest enclosing join** (inner join for a sub-lane, outer join for an unsplit lane) and the full test suite is still never run inside a leaf
- [x] Add `"sublanes"` (via the `lanes` entry documentation) and `"max_parallel_lanes": 6` to `templates/config.template.json` so it matches the canonical default object exactly
- [x] Run the Phase 4 assertion set and confirm every claim is green

### Phase 5 — Cross-skill verification and backward-compatibility sweep

- [x] Write the Phase 5 structural assertion set (no PM path reaches a blocking resume prompt; every PM mention of the ladder reflects the new option 3; zero repo-wide occurrences of the old `full` semantics; every new cross-reference resolves on disk; every new normative rule lives in a B3-materialized file) and confirm each fails or is unverified
- [x] Verify the PM guard against the live `product-manager` sources: confirm whether `product-manager` can reach the Step 2p ladder or the new resume confirmation, and record the finding with file:line evidence in the Progress Log
- [x] Apply the bounded docs-only remedy in `product-manager/references/git-flow.md`: update the ladder note's option-3 text to the nested meaning (including that option 3 may be omitted), and add the one paragraph stating how PM answers the resume confirmation — nothing beyond one paragraph, and no change to PM's command surface
- [x] Sweep the whole repo for surviving statements of the shipped `full` meaning (per-lane tester/reviewer) and remove or rewrite each, confirming requirement 3's "no renamed or reduced variant survives anywhere"
- [x] Audit every cross-reference introduced by Phases 1–4: each pointer resolves on disk, and each normative rule is stated in `references/config.md` or `references/artifact-format.md` — both of which Bootstrap B3 materializes — with no rule's only home in an unmaterialized file
- [x] Audit the backward-compatibility prose end to end: `off` byte-identical (Steps 0c/2p/2c/2s/2L/3L/3s/3j do not exist), `lanes` behaviorally unchanged, both new keys absent-tolerant, legacy `PACT` without a `Sub-contract` column resolving as all-flat, `--parallel full` still parsing, and the redefinition stated explicitly as a redefinition with its justification
- [x] Confirm no renderer, HTML scaffold, `.md`/`.html` parity, or `scripts/**` change was made, and that `plugins/my-skills/skills/orchestrator/scripts/` is untouched in the diff
- [x] Run the full assertion set from all five phases over the final tree and confirm green

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands
> that apply to the phase's touched paths and asserts each exits 0. A failure routes
> through the coder's BLOCKED step, not a silent rewrite.

Applying the Commands section of `PROJECT-CONTEXT.md`: this repo has **no build, no lint, and no automated test command for doc-skill changes**, and `clean-code-gates`' JS suite is explicitly scoped to that skill only. Every path this plan touches is markdown or a JSON template under `plugins/my-skills/skills/{orchestrator,product-manager}/`, so **no language/build/test tooling gate applies** — running one would violate `PROJECT-CONTEXT.md` → Out of scope.

The phase gate is therefore the phase's own **structural assertion set**, which the phase's first task wrote and confirmed failing. Run it as a shell-checkable batch and assert exit 0:

Each gate below is run from the repo root as `bash /dev/stdin <<'GATE' … GATE` with
`set -euo pipefail`, so the **first** failing assertion aborts the set non-zero.

> **Harness note — absence assertions never use `!` (recorded, `CR-20260807T045301Z-4659` / `FIX-20260807T050208Z-9ac2`, Phase 1).** Bash exempts a command from `set -e` when its return value is inverted with `!`, and the exemption covers negated *pipelines* as well as negated simple commands. A `! grep …` assertion therefore reports false and the gate still prints `OK` and exits 0 — it cannot fail. Verified: `printf 'set -euo pipefail\n! true\necho REACHED\n' | bash` prints `REACHED` and exits 0. All thirteen `!`-inverted assertions in this plan's five gates have been rewritten to `if <presence-probe>; then echo "FAIL: …" >&2; exit 1; fi`, each carrying a `FAIL:` message naming the violated claim. The form `grep -qF 'X' "$F" && exit 1` is **not** an acceptable substitute: as the last command of a gate block a non-matching `grep` makes the block's own exit status non-zero, a false red.

> **Harness note — piped assertions never use `grep -q` (recorded, `CR-20260807T035907Z-25d5` / `FIX-20260807T040856Z-bf97`, Phase 3; extended to this plan by `CR-20260807T045301Z-4659` / `FIX-20260807T050208Z-9ac2`, Phase 1, SF-1).** Under `set -euo pipefail`, `awk … | grep -q PATTERN` reports **141** whenever `grep -q` exits before `awk` has finished writing: `awk` dies of `SIGPIPE` and `pipefail` surfaces its status. The abort is a property of *where the match lands in the buffer*, not of the claim, so a gate written that way can go green today and red tomorrow on an edit that only moved a paragraph. All twenty-four piped assertions in this plan's gates are written `… | grep PATTERN >/dev/null`, which is exit-status-identical (0 iff matched) but consumes the whole stream. Unpiped `grep -q` is unaffected and is left as-is.

Phase exit criterion: **every assertion in the phase's set exits 0**, plus a read-through confirming the prose actually says what the grep proves is present. No silent rewrite of a rule to make an assertion pass without a corresponding plan task.

### Phase 1 gate — `references/config.md`

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
C="$S/references/config.md"
# 1. `full` redefined to the nested meaning in the parallelism table + prose
grep -q 'nested inner-lane parallelism' "$C"
grep -q 'leaf' "$C"
# 2. depth-2 hard cap stated normatively here, with its reasoning
grep -q 'depth 2' "$C"
grep -q 'pool the previous split already divided' "$C"
# 3. degradation to `lanes` (never `off`) + the two gates compose, never conflated
grep -q 'degrades to .*lanes' "$C"
grep -q 'never conflated' "$C"
# 4. optional `sublanes` array documented
grep -q 'sublanes' "$C"
grep -q 'config.systems' "$C"
# 5. lane name/path grammar INLINED + keep-in-sync marker (requirement 68)
grep -q '\^\[a-z0-9\]' "$C"
grep -q 'keep in sync' "$C"
grep -q 'no `\.\.` segments' "$C"
# 6. sub-lane grammar + drop-and-report message
grep -q 'sub-lane dropped' "$C"
# 7. containment rule inside the SINGLE owned-glob rejection list, with its reasoning
grep -q 'strict partition' "$C"
grep -q 'two local checks' "$C"
# 8. untrusted metadata extended to sub-lanes via the `sublane:` envelope line form
grep -q 'sublane:' "$C"
# 9. makespan / marginal-gain model
grep -q 'M_flat' "$C"; grep -q 'M_nested' "$C"
grep -q 'span(L)' "$C"; grep -q 'makespan' "$C"
grep -q 'marginal gain' "$C"
grep -q 'diminishing' "$C"
grep -q 'proxy wall-clock effort equally' "$C"
grep -q 'Never print a wall-clock ETA' "$C"
# ASSERTION NARROWED (recorded, CR-20260807T045301Z-4659 / FIX-20260807T050208Z-9ac2, Phase 1):
# the blanket form was BOTH unfailable — `!` exempted it from `set -e` — and, once made failable,
# unsatisfiable, because the very sentence that FORBIDS wall-clock units names one ("Task counts
# are the honest, checkable proxy; minutes would be fabricated precision"). As written it could
# only have gone green by deleting the prohibition's own rationale, which is the opposite of the
# invariant it guards. Narrowed to the real claim, in the same form the predecessor plan already
# adopted for its own copy (`FIX-20260807T040856Z-bf97` Phase 3 gate item 7), so the two copies
# of one claim now agree. This is a correction of a mis-specified assertion, not a relaxation:
# every occurrence other than the prohibition's own line is still forbidden.
if grep -viE 'Never print a wall-clock ETA' "$C" | grep -iE '\b(minutes|hours|seconds)\b' >/dev/null; then
  echo "FAIL: a wall-clock time unit appears in config.md outside the line that prohibits it" >&2; exit 1
fi
# 10. max_parallel_lanes section + keys table rows
grep -q '### `max_parallel_lanes`' "$C"
grep -qF '| `max_parallel_lanes` | integer | `6` | — |' "$C"
grep -q 'leaf-set width' "$C"
# 11. canonical default object carries both new keys
grep -q '"max_parallel_lanes": 6' "$C"
# 12. `--resume` row in the CLI-args table, mapping to no config key
grep -q '`--resume`' "$C"
# 13. absent-key tolerance extended to both new keys
grep -q 'Absent-key tolerance' "$C"
grep -q '2s' "$C"
# 14. ZERO surviving statements of the shipped per-lane-tester/reviewer `full`.
#     Requirement 65 REQUIRES one historical mention (the redefinition notice), so the
#     assertion is: no occurrence may appear on a line not marked as historical.
if grep -qi 'per-lane tester' "$C"; then
  echo "FAIL: the shipped per-lane-tester meaning of \`full\` survives in references/config.md" >&2; exit 1
fi
if grep -n 'tester and a reviewer' "$C" | grep -v 'previously' | grep . >/dev/null; then
  echo "FAIL: 'tester and a reviewer' appears in config.md on a line not marked historical" >&2; exit 1
fi
grep -q 'Redefinition notice' "$C"
echo "phase 1 gate: OK"
```

### Phase 2 gate — `references/artifact-format.md`

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
A="$S/references/artifact-format.md"
# 1. sub-contract shape documented under the PACT frontmatter contract
grep -q 'sub-contract' "$A"
grep -q 'no new prefix, directory, scaffold, or frontmatter key' "$A"
# 2. related_to references BOTH the spec and the parent PACT
grep -q 'both the source spec and the parent `PACT`' "$A"
# 3. the Inherited interface assignments region, REQUIRED, with its reason
grep -q 'Inherited interface assignments' "$A"
grep -q 'required rather than optional' "$A"
grep -q 'a leaf reads exactly one contract' "$A"
# 4. the parent lane map's `Sub-contract` column + no sideways sibling link
grep -q 'Sub-contract' "$A"
grep -q 'never links sideways to a sibling' "$A"
# 5. PACT ID resolution: one level ONLY, leaf-set DONE check, legacy absent column = all-flat
grep -q 'one level only' "$A"
grep -q 'resolved leaf set' "$A"
grep -q 'all-flat' "$A"
# AMENDED by CR-20260807T035907Z-25d5 (SF-5), recorded as a task in
# FIX-20260807T040856Z-bf97 Phase 3. The prose had been bent to fit this literal
# ("never **as** an error" is ungrammatical); the pattern is now bent to fit the prose.
grep -q 'never an error' "$A"
# 6. new stdout rows for 2s and 3s
grep -qE '^\| 2s \|' "$A"
grep -qE '^\| 3s \|' "$A"
grep -q 'CONTRACTS —' "$A"
grep -q 'SUBJOIN —' "$A"
# 7. LANES — rows now report leaf counts and qualified leaf names
grep -q 'leaf plans dispatched' "$A"
grep -q 'leaf coders dispatched' "$A"
# 8. EVERY pre-existing stdout row byte-unchanged (spot-check all six role rows + 2c + 3j)
grep -qF '| brainstormer | `BRAINSTORMER — SPEC-{NNN} created`         | `Status: READY_FOR_PLANNING \| DRAFT`                         | `Spec: {path}`      |' "$A"
grep -qF '| coder        | `CODER — {PLAN-ID} session complete`        | `Status: IN_PROGRESS \| DONE \| BLOCKED`                      | —                   |' "$A"
grep -qF '| qa           | `QA — QA-{NNN} created`                    | `Status: READY_TO_COMMIT \| BLOCKED \| READY_WITH_WARNINGS`   | `Report: {path}`    |' "$A"
grep -qF "| 2c | architect (type \`contract\`) | \`ARCHITECT — PACT-{NNN} created\` then \`Contract: {path}\`" "$A"
grep -qF '| 3j | orchestrator | `JOIN — PACT-{NNN} reconciled` then `Status: JOINED \| PARTIAL \| AMENDED`' "$A"
# 9. the additive backward-compatibility paragraph is intact
grep -q 'Additive backward-compatibility guarantee' "$A"
grep -q 'byte-identical to a pre-feature run' "$A"
# 10. Related-navigation edge covers a sub-contract PACT
grep -q 'parent `PACT` when this one is a sub-contract' "$A"
echo "phase 2 gate: OK"
```

### Phase 3 gate — `SKILL.md`

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
K="$S/SKILL.md"
# 1. numbered dispatch steps 2s and 3s exist as real headings
grep -qE '^### Step 2s — ' "$K"
grep -qE '^### Step 3s — ' "$K"
# 2. 2s runs only under `full` with >=1 adopted lane, and is the sole sub-lane ID allocation site.
#    Scoped to the 2s section — the unscoped form matched Step 2L's pre-existing lane-ID prose.
awk '/^### Step 2s — /,/^### Step 2L — /' "$K" | grep 'sole allocation site' >/dev/null
awk '/^### Step 2s — /,/^### Step 2L — /' "$K" | grep 'yields a \*\*different\*\* set' >/dev/null
# 3. every added producing spawn pre-generates its ID (2s carries an `ID to use:` line)
awk '/^### Step 2s — /,/^### Step 2L — /' "$K" | grep 'ID to use:' >/dev/null
awk '/^### Step 2s — /,/^### Step 2L — /' "$K" | grep 'newid PACT' >/dev/null
awk '/^### Step 2s — /,/^### Step 2L — /' "$K" | grep 'newid FEAT' >/dev/null
# 4. leaf-granularity 2L and a single FLAT concurrent 3L dispatch
awk '/^### Step 2L — /,/^### Step 3L — /' "$K" | grep 'leaf' >/dev/null
awk '/^### Step 3L — /,/^### Step 3s — /' "$K" | grep 'one flat concurrent dispatch' >/dev/null
awk '/^### Step 3L — /,/^### Step 3s — /' "$K" | grep 'containment rule' >/dev/null
# 5. inner join 3s: deterministic order, integration sub-lane, sub-contract status table, parent mark
awk '/^### Step 3s — /,/^### Step 3j — /' "$K" | grep 'SUBJOIN —' >/dev/null
awk '/^### Step 3s — /,/^### Step 3j — /' "$K" | grep 'deterministic order' >/dev/null
# AMENDED by CR-20260807T035907Z-25d5 (SF-6), recorded as a task in FIX-20260807T040856Z-bf97
# Phase 1. The former `grep -q 'parent'` was tautological — the word is unavoidable in that
# section, so the assertion was green before any prose existed. Replaced with the actual claim.
# NOTE the literal uses SINGLE asterisks, matching the live text; the CR's suggested
# double-asterisk form (`\*parent\*` escaped for a double) ships red.
awk '/^### Step 3s — /,/^### Step 3j — /' "$K" | grep -F 'Mark the lane DONE in the *parent* contract' >/dev/null
# 6. requirement-53: NO `full`-distinguishing behavior lives only in a join step or ladder text.
#    AMENDED by CR-20260807T035907Z-25d5 (MF-1), implemented as a recorded task in
#    FIX-20260807T040856Z-bf97 Phase 1. This is an amendment, NOT a relaxation: the original
#    assertion pinned sentence-exact wording to a location, which is a proxy for the requirement
#    rather than the requirement. The rule survives normatively in SKILL.md's Rules section, so
#    the claim is asserted where it is true instead of where it used to be written.
grep -qi 'level-specific behavior only in a join step' "$K"
# 7. halt/amend precedence stated ONCE in Step 3j's body ahead of both subsections, and NEITHER
#    subsection describes itself as firing unconditionally.
#    AMENDED by CR-20260807T035907Z-25d5 (MF-1), implemented as a recorded task in
#    FIX-20260807T040856Z-bf97 Phase 1. Requirement 55's real demand is that neither subsection
#    still claims to fire unconditionally — not that the precedence sentence be duplicated into
#    both. Hoisting it to one blockquote at the point classification happens is what this
#    project's single-source-of-truth convention requires, so the assertion now proves the
#    single statement plus each subsection's conditional opening.
awk '/^### Step 3j — /,/^#### 3j.1 /' "$K" | grep 'amendment loop (3j.2), evaluated \*\*first\*\*' >/dev/null
awk '/^#### 3j.1 /,/^#### 3j.2 /' "$K" | grep "Step 3j's classification routed here" >/dev/null
awk '/^#### 3j.2 /,/^#### 3j.3 /' "$K" | grep "Step 3j's classification routed here" >/dev/null
grep -q 'narrowest' "$K"
grep -q 'one budget for the whole run' "$K"
# 8. resume: detection at Step 0, opt-in, non-blocking hint, skip list, leaf rebuild, RESUME print
grep -q '`--resume`' "$K"
grep -q 'single non-blocking hint' "$K"
grep -q 'RESUME —' "$K"
grep -q 'restricted to leaves whose `FEAT` plan is not `DONE`' "$K"
grep -qi 'walk its `Sub-contract` column' "$K"
# 9. diagram shows the nested branch
awk '/^### Pipeline overview/,/^### How to spawn/' "$K" | grep '3s' >/dev/null
awk '/^### Pipeline overview/,/^### How to spawn/' "$K" | grep '2s' >/dev/null
# 10. skip lists name 2s and 3s
grep -q 'Steps 0c, 0r, 2p, 2c, 2s, 2L, 3L, 3s, and 3j do not exist' "$K"
# 11. ladder: option 3 is nested, omitted with a reason when no lane clears
grep -q 'Nested lane-parallel' "$K"
grep -q 'nested split not offered' "$K"
grep -q 'M_nested' "$K"
# 12. degrades to `lanes`, never to `off`
grep -q 'degrades to `lanes`' "$K"
# 13. simplify + full suite exactly once, at the outer join, at any depth
grep -q 'exactly once per run' "$K"
# 14. ZERO surviving statements of the shipped per-lane-tester/reviewer `full`
if grep -qi 'per-lane tester' "$K"; then
  echo "FAIL: the shipped per-lane-tester meaning of \`full\` survives in SKILL.md" >&2; exit 1
fi
if grep -qi 'per-lane reviewer' "$K"; then
  echo "FAIL: the shipped per-lane-reviewer meaning of \`full\` survives in SKILL.md" >&2; exit 1
fi
if grep -n 'tester and a reviewer' "$K" | grep -v 'previously' | grep . >/dev/null; then
  echo "FAIL: 'tester and a reviewer' appears in SKILL.md on a line not marked historical" >&2; exit 1
fi
echo "phase 3 gate: OK"
```

### Phase 4 gate — role templates and `config.template.json`

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
AR="$S/templates/architect.md"
CO="$S/templates/coder.md"
# 1. architect: the sub-contract case is recognized from its INPUTS, with no new type value.
#    AMENDED by CR-20260807T035907Z-25d5 (MF-3), implemented as a recorded task in
#    FIX-20260807T040856Z-bf97 Phase 4. The former `grep -q 'Parent contract:' "$AR"` asserted
#    against STALE text: SIMPLIFY fix #6 moved level detection to the preamble, and Step 2s.2's
#    prompt body sends no such line — `grep -rn 'Parent contract:'` across the skill returned
#    exactly one hit, this template's own case table. The assertion was green precisely because
#    the routing was wrong, which is the failure mode a gate exists to catch. Replaced with the
#    preamble form the orchestrator actually emits, and the stale token is now asserted ABSENT
#    skill-wide by this plan's Phase 4 gate.
awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep 'non-empty `lane=`' >/dev/null
grep -q 'sub-contract' "$AR"
# no new `type` value in the canonical table
if grep -qE '^\| `sub-?contract` +\|' "$AR"; then
  echo "FAIL: a new \`sub-contract\` type value was added to architect.md's canonical table" >&2; exit 1
fi
# no second, parallel workflow
if grep -qE '^## Step 3S' "$AR"; then
  echo "FAIL: a second, parallel Step 3S workflow was added to architect.md" >&2; exit 1
fi
# 2. architect Step 3C covers it as ONE EXTENDED workflow
awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep 'Inherited interface assignments' >/dev/null
awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep 'containment' >/dev/null
awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep 'intra-lane by definition' >/dev/null
awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep 'both the source spec and the parent' >/dev/null
# 3. architect region 1 carries the `Sub-contract` column; lane-status guidance covers sub-lanes
awk '/^### 1\. Lane map/,/^### 2\. Path ownership/' "$AR" | grep 'Sub-contract' >/dev/null
grep -q 'sub-lane-status table' "$AR"
# 4. coder: boundary text explicitly covers a qualified leaf name and a governing sub-contract
grep -q 'qualified leaf name' "$CO"
grep -q 'governing contract' "$CO"
grep -q 'nearest enclosing join' "$CO"
# 5. reserved reason spellings and meanings UNCHANGED (byte-exact)
grep -qF '**`lane boundary`** — a task requires editing a file outside your lane' "$CO"
grep -qF '**`contract violation`** — a frozen `PACT` interface row is wrong, unimplementable, or contradicts the spec.' "$CO"
grep -qF 'Reason: lane boundary — {path/to/offending/file} is outside lane `{my lane}`' "$CO"
grep -qF 'Reason: contract violation — PACT row {row id} ({producer} → {consumer}, {kind}) cannot be satisfied as frozen: {what is wrong}' "$CO"
# 6. the full test suite is still never run inside a leaf
grep -q 'never run inside a lane' "$CO"
# 7. config.template.json key set + defaults ≡ the canonical default object in references/config.md
python3 - <<'PY'
import json, re, sys
tpl = json.load(open('plugins/my-skills/skills/orchestrator/templates/config.template.json'))
ref = open('plugins/my-skills/skills/orchestrator/references/config.md').read()
block = re.search(r'## Canonical Default Object\s*```json\s*(\{.*?\})\s*```', ref, re.S).group(1)
canon = json.loads(block)
assert tpl == canon, f'template != canonical\n template={tpl}\n canonical={canon}'
assert tpl['max_parallel_lanes'] == 6, tpl
PY
echo "phase 4 gate: OK"
```

### Phase 5 gate — cross-skill, backward-compat, and reachability sweep

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
PM=plugins/my-skills/skills/product-manager
# 1. PM's ladder note reflects the NEW option 3 and its possible omission
grep -q 'nested lane-parallel' "$PM/references/git-flow.md"
grep -q 'may be omitted' "$PM/references/git-flow.md"
# 2. PM documents how it answers the resume detection, and that it is never blocked
grep -q 'resume' "$PM/references/git-flow.md"
grep -q 'non-blocking hint' "$PM/references/git-flow.md"
# 3. PM's command surface is unchanged — still passes no parallelism flag, no --resume.
#    AMENDED by CR-20260807T035907Z-25d5 (SF-6), recorded as a task in
#    FIX-20260807T040856Z-bf97 Phase 1. The former `! grep -q 'passes --resume'` was vacuous:
#    the file says "PM passes no `--resume` flag", which that pattern was never going to match
#    either way, so a negative assertion over it proved nothing. Replaced with the positive
#    claim of what PM actually does.
grep -q 'PM passes no .--resume. flag' "$PM/references/git-flow.md"
grep -q "PM's command surface is unchanged" "$PM/references/git-flow.md"
# 4. REPO-WIDE: no surviving statement of the shipped per-lane-tester/reviewer `full`.
#    Requirement 65 requires historical mentions; each must be marked as such.
if grep -rqi 'per-lane tester' plugins/ .orchestrator/ 2>/dev/null; then
  echo "FAIL: the shipped per-lane-tester meaning of \`full\` survives somewhere in the repo" >&2; exit 1
fi
if grep -rqi 'per-lane reviewer' plugins/ .orchestrator/ 2>/dev/null; then
  echo "FAIL: the shipped per-lane-reviewer meaning of \`full\` survives somewhere in the repo" >&2; exit 1
fi
if grep -rn 'tester and a reviewer' plugins/ .orchestrator/ 2>/dev/null | grep -v 'previously' | grep . >/dev/null; then
  echo "FAIL: 'tester and a reviewer' survives repo-wide on a line not marked historical" >&2; exit 1
fi
if grep -rq 'Full lane pipelines' plugins/ .orchestrator/ 2>/dev/null; then
  echo "FAIL: the old 'Full lane pipelines' phrasing survives somewhere in the repo" >&2; exit 1
fi
# 5. REACHABILITY (requirement 68): every new normative rule lives in a B3-materialized file.
#    B3 copies references/artifact-format.md and references/config.md — assert both are named there.
grep -q 'references/artifact-format.md` → `.orchestrator/artifact-format.md' "$S/SKILL.md"
grep -q 'references/config.md` → `.orchestrator/config.md' "$S/SKILL.md"
#    and that the sub-lane grammar no longer depends on the UNMATERIALIZED roadmap reference
if grep -q 'grammar defined in `roadmap/references/config.md`' "$S/references/config.md"; then
  echo "FAIL: the sub-lane grammar still depends on the unmaterialized roadmap reference" >&2; exit 1
fi
# 6. BACKWARD COMPAT: `off` byte-identical; `lanes` unchanged; keys absent-tolerant; legacy PACT flat
grep -q 'Steps 0c, 0r, 2p, 2c, 2s, 2L, 3L, 3s, and 3j do not exist' "$S/SKILL.md"
grep -q 'Steps 0c/0r/2p/2c/2s/2L/3L/3s/3j do not exist for the run' "$S/references/config.md"
grep -q 'read and ignored without error' "$S/SKILL.md"
grep -q 'Redefinition notice' "$S/references/config.md"
grep -q 'keeps parsing' "$S/references/config.md"
# AMENDED by CR-20260807T035907Z-25d5 (SF-5) — see the Phase 2 gate note.
grep -q 'never an error' "$S/references/artifact-format.md"
# 7. NO renderer / scaffold / scripts change introduced by THIS plan.
#    Scoped to HEAD, not the merge-base: `scripts/render-artifact.cjs` was legitimately changed
#    by the earlier branch commit 9888e50 (the flat lane-parallel feature), and a merge-base
#    diff would wrongly attribute that prior commit's work to this plan.
test -z "$(git diff --name-only HEAD -- "$S/scripts/" "$S/templates/html/")"
# 8. Every cross-reference introduced resolves on disk
test -f "$S/references/config.md"
test -f "$S/references/artifact-format.md"
test -f "$S/templates/architect.md"
test -f "$S/templates/coder.md"
test -f "$S/templates/config.template.json"
test -f docs/adr/0001-orthogonal-system-band.md
test -f "$PM/references/git-flow.md"
echo "phase 5 gate: OK"
```

**Path-conditional gate.** If — and only if — a phase's diff touches `plugins/my-skills/skills/orchestrator/scripts/**`, that phase must additionally run `node --test plugins/my-skills/skills/orchestrator/scripts/*.test.cjs` and assert exit 0. No phase in this plan is expected to touch that path; a phase that does has deviated from the spec and should stop and report rather than proceed.

G1 (coverage) and G6 (mutation) are **not** run here — they remain QA-only, and coverage is not measured outside `clean-code-gates` in this repo.

## Dependencies

None. `SPEC-20260807T003303Z-62e3`'s flat lane-parallel implementation is already on this branch (Steps 0c/2p/2c/2L/3L/3j and the `PACT` artifact are live); this plan edits that live state.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-07T05:15:07Z | CODER (FIX-20260807T050208Z-9ac2)

**Gate harness corrected — recorded, not relaxed.** Justification: `CR-20260807T045301Z-4659`
MF-1 (plus SF-1), implemented as named tasks in `FIX-20260807T050208Z-9ac2` Phase 1. No prose in
`plugins/**` was touched by this pass; only this plan's own gate blocks changed.

- **All thirteen `!`-inverted assertions** across the five gates (P1 §9/§14, P3, P4, P5) rewritten
  to `if <presence-probe>; then echo "FAIL: …" >&2; exit 1; fi`. Bash exempts a `!`-inverted
  command — and a `!`-inverted *pipeline* — from `set -e`, so every one of them reported false and
  still let the gate print `OK` and exit 0. They could not fail. Each now carries a `FAIL:` message
  naming the violated claim. Verified with a red canary: the same violated assertion exits 0 in the
  old form and 1 in the new one.
- **Phase 1 gate item 9 narrowed** — the blanket `! grep -qiE '\b(minutes|hours|seconds)\b' "$C"`
  was, once made failable, *unsatisfiable*: the sentence that forbids wall-clock units names one
  ("…minutes would be fabricated precision"), so it could only have gone green by deleting the
  prohibition's own rationale. Narrowed to the form the predecessor plan already adopted for its
  own copy (`FIX-…-bf97` Phase 3 gate item 7), so the two copies of one claim now agree. Every
  occurrence other than the prohibition's own line is still forbidden.
- **All twenty-four piped `grep -q` assertions** rewritten to `… | grep PATTERN >/dev/null`
  (SF-1). Exit-status-identical, but consumes the whole stream, so a `grep -q` that exits before
  `awk` finishes writing can no longer kill the producer with `SIGPIPE` and surface `141` through
  `pipefail`. Exposure here was latent only — largest measured `awk` range is well under the pipe
  buffer — but the failure is a property of where the match lands, not of the claim.
- Both harness notes are now recorded in this plan's `## Verification (per phase)` preamble.

All five gates re-run after the sweep: **exit 0**, and now capable of exiting non-zero.

### 2026-08-07T04:15:59Z | CODER (FIX-20260807T040856Z-bf97)

**Gate assertions amended — recorded, not relaxed.** Justification: `CR-20260807T035907Z-25d5`
(MF-1 ruling: *"amend the assertions. Do not revert the prose."* — plus SF-6). Implemented as
named tasks in `FIX-20260807T040856Z-bf97` Phases 1 and 4, never as a silent edit.

- **Phase 3 gate item 6** — `grep -qi 'no level-specific behavior may be specified only inside a
  join step'` → `grep -qi 'level-specific behavior only in a join step'`. The SIMPLIFY pass
  deleted `3j.4` (which carried a dangling "requirement 53" reference resolvable nowhere in the
  shipped skill); the authoring rule itself survives normatively in the Rules section. The
  assertion pinned sentence-exact wording to a *location*, which proxies the requirement.
- **Phase 3 gate item 7** — the two `grep -q 'amendment loop is evaluated first'` assertions over
  `3j.1`/`3j.2` → one assertion that the precedence is stated **once** in Step 3j's body ahead of
  both subsections, plus one per subsection that it opens conditionally (*"Step 3j's
  classification routed here"*). Requirement 55's demand is that neither subsection describe
  itself as firing unconditionally — not that the sentence be duplicated. Hoisting it to a single
  blockquote at the point classification happens is what this project's single-source-of-truth
  convention requires, and the plan's own Technical Notes forbid duplicating a rule into two
  places.
- **Phase 3 gate item 5 (SF-6)** — the tautological `grep -q 'parent'` over the Step 3s section →
  `grep -qF 'Mark the lane DONE in the *parent* contract'`. Single asterisks; the CR's suggested
  double-asterisk literal does not match the live text and would ship red.
- **Phase 5 gate item 3 (SF-6)** — the vacuous `! grep -q 'passes --resume'` → the positive claim
  `grep -q 'PM passes no .--resume. flag'`.
- **Phase 4 gate item 1 (MF-3)** — `grep -q 'Parent contract:' "$AR"` was asserting against stale
  text that nothing emits; replaced with the preamble-based claim. See the FIX plan's Phase 4.

The SIMPLIFY prose is **not** reverted: `3j.4` stays deleted, the precedence sentence still
appears exactly once, and the Rules-section statement of the authoring rule is untouched.
All five phase gates green over the tree as amended.

### 2026-08-07T03:59:07Z | REVIEWER

CR-20260807T035907Z-25d5 created. Status: REQUEST_CHANGES. Must Fix: 8. Should Fix: 6.

Ruled on all four escalated forks. **Phase 3 gate:** amend the three assertions to claim-based,
do NOT revert the SIMPLIFY prose (deleting `3j.4` removed a dangling "requirement 53" reference;
hoisting the precedence rule to one blockquote at `SKILL.md:811` is what single-source-of-truth
requires, and requirement 55's real demand — neither subsection firing unconditionally — is met).
**Gain/cost units:** agreed, blocks (MF-4). **Inner join:** sequencing is SPEC req 45, left alone;
but `M_nested` underprices `k` serialized inner joins and `SKILL.md:770`'s barrier justification
contradicts the containment proof — both block (MF-5). **Step 2s barrier:** SPEC req 41, not a
blocker (SF-1). **`templates/{qa,reviewer}.md`** in scope via AC 1; **`tester.md`** is not — its
edits are new nesting behavior from SIMPLIFY, which falsifies `SKILL.md:895` (MF-8).

Three blockers are the same "specified but never dispatched" shape this feature exists to fix:
`leaves=` is declared in the mandatory preamble and consumed by all three join templates but
emitted by **no** spawn (MF-2); architect Step 3C routes the sub-contract case on `Parent contract:`
/ `Lane:` body lines Step 2s.2 never sends (MF-3); plus the red gate itself (MF-1).

`gate-scope` / `gate-shell-injection` re-confirmed pre-existing red at HEAD; renderer 45/45 green.

### 2026-08-07T03:50:31Z | TESTER

TEST-20260807T035031Z-230c created. Status: BELOW_FLOOR. Coverage: N/A → N/A.

Diff is entirely prose (zero executable lines), so the 70% floor is inapplicable, not missed.
Phase gates 1, 2, 4, 5 green; **Phase 3 red on 3 assertions** (req-53 audit line; halt/amend
precedence in 3j.1 and 3j.2) — prose/gate drift from the SIMPLIFY pass, which de-duplicated the
exact prose those assertions require duplicated. AC 9 and AC 11 substance verified present by
read-through. Renderer (45), pairing, and target-guard suites green; `gate-scope` /
`gate-shell-injection` proven red identically at merge-base `974b01a`. No e2e added — no
addressable runtime surface. Reviewer decision required: reword prose, or amend the gate.

### 2026-08-07T03:37:17Z | CODER

All 61 tasks complete. Plan status → DONE. Ready for reviewer.

All five phase assertion sets re-run over the final tree as one aggregate batch — **139 assertions,
exit 0**. Each set was written and confirmed **red** before the prose that satisfies it.

### 2026-08-07T03:13:26Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-07T03:09:07Z | ARCHITECT

Plan `FEAT-20260807T030642Z-6077` created. Type: feat. Tasks: 44.
Status: PLANNED. Ready for coder.
