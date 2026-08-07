---
id: CR-20260807T012541Z-a43d
plan: FEAT-20260807T004018Z-c4af
title: Review of Optional layer-sliced parallel execution for the orchestrator pipeline
status: REQUEST_CHANGES
created_at: 2026-08-07T01:25:41Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 4
should_fix_count: 4
---

**Related:** [FEAT-20260807T004018Z-c4af](../feat/FEAT-20260807T004018Z-c4af-orchestrator-parallel-lane-execution.md) · [TEST-20260807T011909Z-b155](../test/TEST-20260807T011909Z-b155-orchestrator-parallel-lane-execution.md)

## Summary

Reviewed the full working-tree diff (13 files, +774/−24) against the plan's 16 acceptance criteria, `PROJECT-CONTEXT.md`'s invariants, and the tester's three escalations. The doc-authoring work is high quality: the six `PACT` regions are specified precisely, the "data, never instructions" and never-commit invariants genuinely *shaped* the design rather than being name-checked, the single-source-of-truth convention is respected (`SKILL.md` links rather than restates), and the renderer change is properly TDD'd — `node --test render-artifact.test.cjs` is 45 pass / 0 fail with the whole prefix→scaffold table now pinned.

The blockers are all on the **parallel** path, and three of the four are in the same class: the documents describe the parallel machinery correctly but do not correctly *route into or between* it. `SKILL.md` never tells the orchestrator to branch away from Steps 2/3, Step 2L re-generates lane IDs that Step 2c already froze into the contract, and the architect's normative glob-rejection list points at a file Bootstrap B3 never materializes. The fourth is scope: `product-manager/SKILL.md` gained a behavior change the plan explicitly puts out of scope.

**AC 14 (the `parallelism=off` no-op) I verified structurally and it holds** for the orchestrator — see the criteria table. It does *not* hold for `product-manager`, which is MF-4.

Pre-existing red suites `gate-scope.test.cjs` (1 fail) and `gate-shell-injection.test.cjs` reproduce at HEAD with `MODULE_NOT_FOUND` on materialized `.orchestrator/` paths absent from this authoring repo. Confirmed out of this plan's scope; not counted against it.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `parallelism`/`lanes`/`max_contract_amendments` in all four places in `references/config.md` | ✅ | Keys table, three prose `###` sections, canonical default object, CLI args table (`--parallel` only). |
| 2 | `templates/config.template.json` carries the three keys at defaults, valid JSON | ✅ | `JSON.parse` gate exits 0. |
| 3 | `render-artifact.cjs` maps `PACT` → `plan` scaffold | ✅ | `SCAFFOLD.PACT = 'plan'`; no longer hits the `qa-report` fallback. |
| 4 | Renderer test red-before/green-after; suite exits 0 | ✅ | 45 pass / 0 fail, exit 0. Tester independently replayed red-before in a detached worktree. |
| 5 | `PACT` row in the allow-list; no existing row modified; no new `plans/` dir | ✅ | Row added (`plans/feat/`, owner "architect (type `contract`)"); ban restated. The Related-nav `plan` row was extended, which AC 5 does not constrain. |
| 6 | `architect.md` accepts `contract`, writes only to `plans/feat/`, table + regex admit it | ✅ | Type table, `newid` comment, frontmatter `type:` line, and sanity regex all extended. See SF-3. |
| 7 | `PACT` body specifies all six required regions | ✅ | Step 3C regions 1–6, plus the orchestrator-owned lane-status table. Interface table carries all six columns and all six kinds. |
| 8 | `coder.md` lane boundary rule + exactly two new BLOCKED reasons, both wired | ✅ | Step 2L, both reasons in the BLOCKED procedure and the output summary, explicit prohibition on editing the `PACT`. |
| 9 | tester/reviewer/qa accept a `PACT` ID; single-plan path unchanged | ✅ | Shared resolution hoisted to `artifact-format.md` → `PACT` ID resolution; each template keeps only its delta. See SF-4. |
| 10 | `SKILL.md` defines 2p/2c/2L/3L/3j; diagram and Rules reflect them | ⚠️ | All five steps and both the diagram and Rules are present — but the branch into them is never taken. See **MF-1**. |
| 11 | Six non-viability conditions; prompt hard-gated for autonomous / non-viable / no question tool | ✅ | Six conditions enumerated with printed reasons. The three prompt-off cases all resolve to `off` and print a reason; simplify reclassified the non-viable case as 2p.3's own outcome (2p.5 gates on it explicitly), which preserves the behavior AC 11 requires. |
| 12 | Every fan-out spawn expressed for both hosts | ✅ | Spawns now defer to *How to spawn a subagent*, which carries both `Agent` and `task`; the `ask` ladder names `AskUserQuestion` and `question`. No Claude-only tool name in any role template. |
| 13 | Written PM reachability trace; `git-flow.md` changed only if reachable, only as the bounded paragraph | ❌ | Trace is written and correct, but the remediation exceeded what AC 13 authorizes. See **MF-4**. |
| 14 | `off` path byte-identical; 2p/2c/2L/3L/3j skipped entirely | ⚠️ | Holds for the orchestrator: 0b suppresses the banner line, all five steps carry explicit gates, `lane=`/`contract=` are omitted from the preamble, and every role-template addition is conditional. Broken only by the PM change in **MF-4**. |
| 15 | Legacy config → documented defaults, no migration; existing `plans/` render | ✅ | Absent-key tolerance paragraph under Precedence; renderer behavior for all 9 pre-existing prefixes pinned by `MAP(a)`. |
| 16 | Added cross-references resolve; no config/prefix detail duplicated into `SKILL.md` | ❌ | No duplication (correct). But five references resolve to a nonexistent file. See **MF-2**. |

## Must Fix (Blockers)

### MF-1 — A `lanes`/`full` run never branches away from Steps 2 and 3

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:409` (end of Step 2p.5), `:411` (Step 2), `:440` (Step 3)

**Problem**: Every parallel step carries an explicit gate (`Parallel path only`, `Runs only when the resolved parallelism is not off`), but **Steps 2 and 3 carry no complementary gate**, and Step 2p never emits a "go to Step 2c" instruction. Step 2p.3/2p.4 say "continue to Step 2" on *fallback*; the success path says only "apply the level directly" and then the document continues into Step 2.

Document order is `2p → 2 → 3 → 2c → 2L → 3L → 3j → 3b`. An orchestrator executing top-to-bottom on a viable `lanes` run therefore runs Step 2 (one architect, one whole-spec `FEAT` plan), Step 3 (one coder implements it sequentially), Step 3's mandatory `simplify` pass, and only *then* reaches Step 2c — which announces it "replaces Step 2 for this run" after Step 2 has already run. The replacement is declared in the replacing step, which the reader reaches too late.

**Failure scenario**: `parallelism=lanes`, three viable lanes. Step 2 writes `FEAT-A` covering the whole spec; Step 3's coder implements the entire feature sequentially and runs `simplify`; Step 2c then authors a `PACT` slicing work that is already done; Step 2L/3L fan out three lane coders into a workspace that already contains the complete change, and 3j runs `simplify` a second time over the union. This is the exact double-execution the "Replaces Step 2 for this run" sentence was meant to prevent.

**Fix**: Make the branch explicit at the fork rather than at the destination. Add a closing line to Step 2p:

> **On adopting `lanes` or `full`, go to Step 2c — Steps 2 and 3 do not run for this run.** On `off`, continue to Step 2.

and add the mirror gate to both replaced steps, matching the phrasing the parallel steps already use:

> *Step 2* — **Sequential path only** (resolved `parallelism` is `off`). On the parallel path Step 2c replaces this step.
> *Step 3* — **Sequential path only** (resolved `parallelism` is `off`). On the parallel path Step 3L replaces this step, and the simplification pass moves to Step 3j.3.

---

### MF-2 — Five new cross-references point at `.orchestrator/config.md`, which Bootstrap B3 never materializes

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:256`, `:277`, `:925`; `plugins/my-skills/skills/orchestrator/templates/architect.md:157`, `:161`

**Problem**: B3 step 2 (`SKILL.md:50-55`) materializes exactly `references/artifact-format.md` → `.orchestrator/artifact-format.md`, the seven html scaffolds, and four `.cjs` scripts. `references/config.md` is **not** in that list, and `.orchestrator/config.md` does not exist in this repo either (`ls .orchestrator/` → `config.json`, `PROJECT-CONTEXT.md`, `artifact-format.md`, `html-templates/`). The pre-existing reference at `SKILL.md:14` correctly says `references/config.md`; the five new ones invented a materialized path that was never created.

This is load-bearing rather than cosmetic because of simplify fix 8: the owned-glob rejection list was deliberately de-duplicated down to **one** normative copy in `config.md` → `lanes` → *Owned-glob rejection*, with `SKILL.md` and `architect.md` reduced to pointers. `architect.md` is materialized into `target/.claude/agents/architect.md` and, per B3's own note, **a subagent cannot read the skill's `references/` directory**. So the contract architect is instructed to "read it there and apply it unchanged rather than from memory" for a file it cannot reach.

**Failure scenario**: A `lanes` run in a bootstrapped target project. The Step 2c architect follows `architect.md:157`, tries to read `.orchestrator/config.md`, finds nothing, and falls back to applying the rejection rules from memory — precisely what the sentence forbids. An unbounded glob (`**`) or a `..`-escaping glob passes into the `PACT`. Two lane coders then run concurrently in one shared workspace with overlapping ownership, and path globs are, by the plan's own Technical Notes, "the *only* isolation mechanism between concurrent coders".

**Fix**: Two edits, both small.

1. Add `references/config.md` → `.orchestrator/config.md` to B3 step 2's copy list and to B3 step 4's summary line, alongside `artifact-format.md`. Update the "Re-copy all three on every bootstrap" sentence accordingly.
2. In `SKILL.md` (which reads its own skill directory, not `.orchestrator/`), change the three references to `references/config.md` so they match line 14's existing form. Leave `architect.md`'s two as `.orchestrator/config.md` — that is correct *once* step 1 makes the file exist.

---

### MF-3 — Lane `FEAT` IDs are specified as generated twice, with no instruction to reuse the first set

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:492` (Step 2c) and `:504` (Step 2L)

**Problem**: Step 2c ends with "Pre-generate every lane `FEAT` ID with `newid FEAT` **before** this spawn (see Step 2L)" and passes them to the contract architect as `Lane plan IDs to use (verbatim, one per lane)`. Step 2L then opens with "Generate **every lane ID up front, before the fan-out**, with the existing generator — `newid FEAT` per lane" — an unqualified imperative to generate, with no "these are the IDs you already generated for Step 2c; reuse them verbatim". The 2L spawn spec then says only `ID to use: {that lane's FEAT-<id>}`, where "that lane's" resolves to either set.

Because `newid` is timestamp-plus-random by design and explicitly does *not* scan the directory, a second invocation is guaranteed to produce different IDs — the property that makes concurrent allocation safe is exactly what makes an accidental re-generation silent.

**Failure scenario**: The orchestrator reads 2L literally and calls `newid FEAT` again. The lane architects write `FEAT-…-9f21` etc., while the `PACT` lane map's `Lane plan ID` column still holds the 2c set (`FEAT-…-a1b2`). Every lane completes. At the join, tester/reviewer/QA follow `artifact-format.md` → `PACT` ID resolution step 2 — "the `Lane plan ID` column gives one `FEAT` ID per lane. Read every one of those lane plans" — and every read misses. Step 3 of that procedure ("Every lane plan must be `status: DONE`") then reports the whole fan-out incomplete despite all work being finished. 3j.4's lane-status table is written against IDs that do not exist on disk.

**Fix**: Make 2c the sole allocation site and 2L a consumer. In Step 2L, replace the generate instruction with:

> The lane IDs were **already generated in Step 2c** (that is what let the contract's lane map carry real plan IDs). **Reuse that exact set verbatim — never call `newid FEAT` a second time.** Allocating without a directory scan is what makes concurrent allocation safe, which also means a re-generation silently produces a *different* set that no longer matches the `PACT` lane map.

and change the spawn line to `ID to use: {the FEAT-<id> Step 2c assigned to this lane}`. Keep 2L's existing "no directory scan" rationale paragraph — it explains *why* 2c pre-generates.

---

### MF-4 — `product-manager/SKILL.md` gained a behavior change the plan puts out of scope

**File**: `plugins/my-skills/skills/product-manager/SKILL.md:94`; supporting text at `plugins/my-skills/skills/product-manager/references/git-flow.md:63` and `plugins/my-skills/skills/orchestrator/SKILL.md:397`

**Problem**: The plan's **Out of Scope** reads: *"Changing `product-manager`'s behavior, flags, or command surface, beyond the conditional bounded docs-only paragraph in AC 13."* AC 13 authorizes exactly one thing on a positive trace — a bounded one-paragraph **docs-only** mirror in `references/git-flow.md`.

What landed instead changes PM's runtime behavior: its per-story loop step 2 now reads *"Invoke the `orchestrator` skill with `--parallel off` and the story's `## Brief`… The flag is not optional."* That is a flag added to PM's command surface on **every** orchestrator invocation, on every run, including runs of projects that never enable parallelism. The `git-flow.md` paragraph was correspondingly rewritten from the authorized "PM answers Step 2p with option 1" mirror into a justification for the flag ("Making the prompt structurally impossible is stronger than answering it"), and `orchestrator/SKILL.md:397` now asserts the new PM behavior as fact.

It also breaks AC 14 as an unqualified claim: with `parallelism` unset, a PM-driven orchestrator run's invocation is no longer identical to the pre-change text — it carries a new argument.

Separately, this change traces to **no plan task and no log entry**. Phase 8 task 2's coder entry describes the *other* remediation ("PM answers it with option 1, sequential (`off`)"), and the SIMPLIFY entry's 12 applied fixes and 3 skips do not mention it. Per `PROJECT-CONTEXT.md`'s working principles, every changed line must trace to a task.

**Failure scenario**: This is a scope and traceability failure rather than a runtime crash — but it is the kind that compounds. A reviewer of a later PM change sees `--parallel off` hardcoded with no plan or ADR behind it, and either preserves it as load-bearing or removes it as dead, with no record of which is right. And a project that deliberately sets `parallelism: lanes` finds its PM runs silently overriding that config with no way to opt in.

**Fix**: Pick one, do not leave both.

- **Preferred — restore scope.** Revert `product-manager/SKILL.md:94` to its pre-change text, and rewrite the `git-flow.md` paragraph to the authorized mirror: PM does not set `automation_level`, so if a project's config sets `parallelism: ask` the Step 2p prompt can appear; PM answers it with **option 1, sequential (`off`)**, because its per-story contract is one story → one orchestrator run → one commit on `pm/<id>-<slug>`. Drop the "`product-manager` does" clause from `orchestrator/SKILL.md:397`.
- **Alternative — legitimize it.** If the flag really is the better guard (it is a defensible argument: it is deterministic where answering a prompt is not), it needs an amended spec/plan authorizing a `product-manager` behavior change, not a silent landing under a "docs-only" AC. Route it back through the architect rather than approving it here.

Note this is the only place AC 14's byte-identical claim actually fails, so MF-4 and AC 14 close together.

## Should Fix (Warnings)

### SF-1 — `full` mode's per-lane reviewer is net-negative as specified (tester escalation (b) — reviewer's ruling)

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:611-612`, `:405`; `plugins/my-skills/skills/orchestrator/templates/reviewer.md:30`

**Problem**: The escalation is correct, and I am ruling it a real design defect rather than a tolerable inefficiency. As specified, `full`'s per-lane reviewer (a) cannot remediate — 3j.3 forbids a per-lane fix fan-out; (b) costs N reviewer subagent passes and N CR artifacts; and (c) *adds* work to the join, because `reviewer.md` Step 1a requires the join reviewer to "Read every per-lane CR, carry its unresolved findings into this single join-level pass, and re-state them". So the concurrency buys nothing and the join gets slower. The per-lane *tester* does not share this problem — running tests earlier is genuine early signal.

Meanwhile the `ask` ladder (`SKILL.md:405`) offers `full` as option 3 with no annotation distinguishing its value from `lanes`, while option 2 carries a concrete `{S}×` estimate. A user picking option 3 for "more parallelism" gets strictly more cost.

**Fix**: Either drop the per-lane reviewer from `full` (keeping the per-lane tester, which is the part that pays), or keep it and make its purpose explicit in both places — that it is early lane-local signal *fed into* the join review, explicitly not remediation, and that it trades reviewer passes for earlier findings rather than for wall-clock. Annotate option 3 accordingly so the ladder is not offering an unpriced choice.

---

### SF-2 — Step 2L's global architect barrier is correct, but its rationale is undocumented (tester escalation (a) — reviewer's ruling)

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:500-523`

**Problem**: The escalation observes that 2L/3L as separate fan-out phases make wall-clock `max(architect) + max(coder)` instead of `max(architect + coder)`. That is accurate. **My ruling is to keep the barrier** — but the document does not say why, which is exactly how a future simplify pass removes it.

The barrier is load-bearing for recovery, not just for spec fidelity. Step 2L ends with a mandatory file-verification gate ("Verify every lane plan file and its `.progress.md` exist and are non-empty before continuing") that mirrors Step 2's re-invoke-once-then-stop semantics. Under per-lane architect→coder chaining, an architect that fails verification would be re-invoked *while other lanes' coders are already mutating the shared workspace* — and since lanes isolate by path globs alone, a run aborted at that point leaves a partially-written workspace with no clean stopping point. With the barrier, an architect failure costs nothing: no coder has started.

**Fix**: Add one sentence to Step 2L stating this, so the barrier reads as a deliberate recoverability boundary rather than an unoptimized sequence. Something like: *"All lane plans are verified before any coder starts. This barrier is deliberate: a lane plan that fails verification is re-invoked at zero cost, whereas under per-lane architect→coder chaining the re-invoke would happen while other lanes are already mutating the shared workspace."*

---

### SF-3 — `architect.md` hard rule 1 says "the three rows in the table above"; the table now has four

**File**: `plugins/my-skills/skills/orchestrator/templates/architect.md:31`

**Problem**: Hard rule 1 reads "The architect itself only ever writes to `plans/feat/`, `plans/code-review/`, and `plans/qa/` (the three rows in the table above)". The canonical type→directory+prefix table gained a fourth row (`contract`). The three *directories* are still right — `PACT` co-locates in `plans/feat/` — but the row count is now wrong in a rule labelled load-bearing and non-negotiable, which is the worst place for an off-by-one a reader has to reconcile.

**Fix**: Change "(the three rows in the table above)" to "(the three directories in the table above — `contract` co-locates in `plans/feat/`)".

---

### SF-4 — Steps 3b/4/5 prompt blocks hardcode `plan {plan_id}` with no `PACT` variant shown

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:629` (Step 3b), and the equivalent lines in Steps 4 and 5

**Problem**: 3j.3 states the join invokes tester/reviewer/QA "with the **`PACT` ID** in place of a plan ID", and all three templates handle it via Step 1a. But the literal prompt blocks in Steps 3b/4/5 — the text the orchestrator actually copies — say `Run tests for plan {plan_id}.` with no note that `{plan_id}` is the `PACT` ID on the parallel path. Every other parallel-mode substitution in this change is stated at the point of use; this one is stated only two steps earlier.

**Fix**: Add one line under each of the three prompt blocks: *"On the parallel path, `{plan_id}` is the `PACT` ID (Step 3j.3); the prompt is otherwise unchanged."* This also keeps the `off`-path text byte-identical, since it is an added note rather than an edit to the block.

## Verdict

**Status**: REQUEST_CHANGES

The design is sound and the doc work is genuinely careful, but the parallel path cannot execute as written — it never branches into itself (MF-1), re-allocates the IDs its own contract froze (MF-3), and points its only safety rule at a file that is never materialized (MF-2) — and MF-4 lands a `product-manager` behavior change the plan puts out of scope.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260807T012541Z-a43d-orchestrator-parallel-lane-execution.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair.
