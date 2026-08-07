---
id: FIX-20260807T013331Z-d607
title: Fix parallel-path routing, lane-ID reuse, config.md materialization, and PM scope
type: fix
status: DONE
created_at: 2026-08-07T01:35:33Z
updated_at: 2026-08-07T02:10:45Z
cycle: 0
related_to: CR-20260807T012541Z-a43d, FEAT-20260807T004018Z-c4af, SPEC-20260807T003303Z-62e3
---

**Related:** [CR-20260807T012541Z-a43d](./CR-20260807T012541Z-a43d-orchestrator-parallel-lane-execution.md) · [FEAT-20260807T004018Z-c4af](../feat/FEAT-20260807T004018Z-c4af-orchestrator-parallel-lane-execution.md) · [SPEC-20260807T003303Z-62e3](../specs/SPEC-20260807T003303Z-62e3-orchestrator-parallel-lane-execution.md)

## Overview

Remediates the four Must Fix blockers and four Should Fix warnings raised by `CR-20260807T012541Z-a43d` against `FEAT-20260807T004018Z-c4af` (optional layer-sliced parallel execution for the orchestrator pipeline). Three blockers are the same class of defect — the documents describe the parallel machinery correctly but do not correctly route into or between it: `SKILL.md` never branches away from Steps 2/3 (MF-1), Step 2L re-generates lane IDs that Step 2c already froze into the contract (MF-3), and five cross-references point at `.orchestrator/config.md`, a file Bootstrap B3 never materializes (MF-2). The fourth (MF-4) is a scope breach: `product-manager` gained a runtime flag the parent plan puts explicitly out of scope.

This is a documentation-only change across four files — `orchestrator/SKILL.md`, `orchestrator/templates/architect.md`, `orchestrator/templates/reviewer.md`, `product-manager/SKILL.md`, and `product-manager/references/git-flow.md`. No `scripts/` file is touched, so no executable gate applies; verification is structural review per `PROJECT-CONTEXT.md` → **Test tooling**, following the same check-list-first shape the parent plan used.

## Acceptance Criteria

1. Step 2p ends with an explicit branch instruction: adopting `lanes`/`full` goes to Step 2c and Steps 2 and 3 do not run for that run; adopting `off` continues to Step 2.
2. Step 2 and Step 3 each carry a **Sequential path only** gate naming the step that replaces them on the parallel path, phrased to match the `Parallel path only` gates the parallel steps already use.
3. Step 2L contains no imperative to call `newid FEAT`; it states that Step 2c is the sole allocation site and that the 2c set is reused verbatim, and its spawn line reads `ID to use: {the FEAT-<id> Step 2c assigned to this lane}`.
4. Step 2L retains a rationale explaining why allocation-without-a-directory-scan makes an accidental re-generation silent.
5. Bootstrap B3 step 2 copies `references/config.md` → `.orchestrator/config.md`, B3 step 4's summary line lists it, and the "Re-copy all …" sentence agrees with the new item count.
6. The three `.orchestrator/config.md` references inside `SKILL.md` are changed to `references/config.md`, matching the existing form at `SKILL.md:14`; the two in `templates/architect.md` remain `.orchestrator/config.md` and now resolve because of AC 5.
7. `product-manager/SKILL.md`'s per-story loop step 2 no longer passes `--parallel off` and no longer describes the flag as mandatory; its orchestrator invocation text is byte-identical to its pre-`FEAT-…-c4af` form.
8. `product-manager/references/git-flow.md` carries exactly one bounded docs-only paragraph on Step 2p, stating that PM answers the prompt with option 1 (`off`), symmetric in shape to the adjacent Step 0 paragraph, and adding no flag or command-surface change.
9. `orchestrator/SKILL.md`'s Step 2p.4 closing sentence no longer asserts `product-manager` passes `--parallel off`.
10. AC 14 of the parent plan holds without qualification: with `parallelism` unset or `off`, every role prompt, artifact, status line, and stdout header line across the union of `FEAT-…-c4af` and this plan is identical to the pre-feature text.
11. No new top-level directory under `plans/` is introduced, and no existing allow-list row is modified.
12. Every cross-reference added or changed by this plan resolves to a real file and a real heading.

## Out of Scope

- Adding a `--parallel` flag, or any other flag, to `product-manager`'s command surface. If the flag is genuinely the better guard it needs its own spec and plan — see **Decision — MF-4** below.
- Changing `full` mode's per-lane fan-out shape (dropping the per-lane reviewer). SF-1 is resolved by making the existing design's purpose explicit, not by removing a spec'd mode's behavior.
- Restructuring Step 2L/3L into per-lane architect→coder chaining. SF-2's ruling is to keep the barrier and document why.
- Any change to `scripts/render-artifact.cjs` or its test suite — Phase 2 of the parent plan is `✅` in the CR and stays untouched.
- Steps 4, 5, and 7 machinery, the `FIX`/`QAF` loops, and per-lane worktrees or branches — all still out of scope from the parent plan.
- Committing or pushing; the pipeline ends at `READY_TO_COMMIT`.

## Technical Notes

### Decision — MF-4: restore scope (the CR's preferred option)

The orchestrator noted that the `--parallel off` edit came from the mandatory post-coder `simplify` pass rather than the coder. That changes the provenance, not the verdict. **Ruling: revert it and land the authorized docs-only mirror instead.** Four reasons, in order of weight:

1. **The plan pre-authorized a specific remediation for exactly this case.** AC 13 is conditional: *if* the trace finds a reachable path, the response is a bounded one-paragraph docs-only mirror in `git-flow.md`. The CR confirms the trace is written and correct, so the condition fired and the authorized remediation was already specified. Substituting a different one is not a judgment call the plan left open.
2. **The flag is a behavior regression, not just a scope breach.** A project that deliberately sets `parallelism: lanes` has its choice silently overridden on every PM-driven run with no way to opt in. PM does not actually need that: lane fan-out is a within-run concern, and the orchestrator still ends at one `READY_TO_COMMIT` over one union diff, which is exactly PM's one-story → one-run → one-commit contract. The only thing PM needs to guard is a *blocking prompt* mid-autonomous-run — which answering option 1 covers.
3. **It breaks AC 14's byte-identical claim**, which is the parent plan's load-bearing backward-compatibility guarantee and the reason `parallelism` ships as `off` rather than `ask`.
4. **Answering the prompt is the established mirror.** `git-flow.md` already documents PM answering the orchestrator's Step 0 workspace question on the user's behalf with option 1. A second paragraph in the same shape follows the **Mirror machinery** convention; a flag invents a parallel mechanism for the same problem.

The alternative (legitimize the flag via an amended spec) stays open and is cheap. It is deliberately **not** taken here: authorizing a `product-manager` behavior change inside a `FIX` plan derived from a CR that flags that very change as unauthorized would launder the scope breach rather than resolve it.

### Ruling — SF-1: keep `full`'s per-lane reviewer, price it honestly

The CR's analysis is correct that the per-lane reviewer buys no wall-clock. But dropping it removes behavior the spec defines for `full` mode and that `reviewer.md` Step 1a already has machinery for (carrying per-lane findings into the join pass). The smaller, in-scope fix is to state what it *is* — early lane-local signal fed into the join, explicitly not remediation — and to annotate `ask` ladder option 3 so a user picking it is not choosing an unpriced option.

### Ruling — SF-2: keep the Step 2L barrier, document the recoverability rationale

Adopt the CR's ruling verbatim. The barrier is a deliberate recoverability boundary, not an unoptimized sequence, and saying so is what stops a future `simplify` pass from removing it.

### Testing posture

`PROJECT-CONTEXT.md` → **Test tooling**: doc-skill changes have no automated framework and are verified structurally. This plan touches zero files under `scripts/`, so **no command gate matches any phase's touched paths** and no `## Verification (per phase)` section is emitted. Each phase instead opens with an explicit structural check list and closes with an assertion task — the same TDD-shaped substitution the parent plan used for its seven doc phases. Phase 6 re-runs the renderer suite once over the union diff purely as a collateral-regression guard, not as a path-matched gate.

### Conventions in play

- **Single source of truth.** MF-2's fix must not create a second normative copy of the owned-glob rejection list. `config.md` stays the sole normative statement; `SKILL.md` and `architect.md` stay pointers. The fix is to make the pointer's target reachable, not to inline it.
- **Mirror machinery.** The Step 2/Step 3 gates must reuse the exact phrasing shape of the existing `Parallel path only` gates. The `git-flow.md` Step 2p paragraph must mirror the adjacent Step 0 paragraph.
- **Backward compatibility.** Every edit in this plan is either on the parallel path (which does not exist for an `off` run) or a revert toward the pre-feature text. Nothing here may add a token to the `off` path.

### Anchors

`orchestrator/SKILL.md`: B3 step 2 ~line 50, B3 step 4 ~line 57, Step 0b `parallelism` resolution ~line 256, Step 0c lane validation ~line 277, Step 2p.4 closing ~line 397, Step 2p.5 end ~line 409, Step 2 header ~line 411, Step 3 header ~line 440, Step 2c end ~line 492, Step 2L opening ~line 504, `full` join ~line 611, Step 3b prompt ~line 629, Rules ~line 925. `templates/architect.md`: hard rule 1 ~line 31, rejection-rule pointer ~line 157/161. `templates/reviewer.md`: ~line 30. `product-manager/SKILL.md`: per-story loop step 2 ~line 94. `product-manager/references/git-flow.md`: Step 2p paragraph ~line 63.

## Tasks

> Tasks are ordered TDD-first. Because no phase touches an executable path, each
> phase's "test" is its structural check list, written **before** the edits it
> constrains, and asserted in the phase's final task — the substitution
> `PROJECT-CONTEXT.md` → Test tooling mandates for doc skills and the parent plan
> used throughout.
> The coder will check off [ ] → [x] as each task is verified.
> A check that cannot be made true routes through the coder's BLOCKED step, never
> a silent rewrite.

### Phase 1 — MF-1: a `lanes`/`full` run must branch away from Steps 2 and 3

- [x] Write the Phase 1 structural check list: Step 2p ends with an explicit go-to-2c instruction naming both branches; Step 2 and Step 3 each carry a gate naming their replacement step; the three gate sentences use the same phrasing shape as the existing `Parallel path only` gates; no gate text is added to any step that runs on the `off` path only
- [x] Add the closing branch line to Step 2p (after the `lanes`/`full` direct-apply sentence at the end of 2p.5): **On adopting `lanes` or `full`, go to Step 2c — Steps 2 and 3 do not run for this run.** On `off`, continue to Step 2.
- [x] Add the mirror gate under the Step 2 heading: *Sequential path only* (resolved `parallelism` is `off`); on the parallel path Step 2c replaces this step
- [x] Add the mirror gate under the Step 3 heading: *Sequential path only* (resolved `parallelism` is `off`); on the parallel path Step 3L replaces this step, and the simplification pass moves to Step 3j.3
- [x] Confirm Step 2c's existing "Replaces Step 2 for this run" sentence and Step 3L's equivalent still read correctly now that the fork is declared upstream — keep them as confirmation, not as the only statement of the branch
- [x] Assert every Phase 1 structural check passes by walking the document top-to-bottom once as a `lanes` run and once as an `off` run, confirming each visits exactly one of the two paths

### Phase 2 — MF-3: Step 2c is the sole lane-ID allocation site

- [x] Write the Phase 2 structural check list: `SKILL.md` contains exactly one instruction to generate lane `FEAT` IDs and it is in Step 2c; Step 2L contains no `newid FEAT` imperative; the 2L spawn line names the 2c-assigned ID unambiguously; the no-directory-scan rationale survives somewhere it still explains 2c's pre-generation
- [x] Replace Step 2L's opening generate instruction with the reuse instruction: the lane IDs were already generated in Step 2c (that is what let the contract's lane map carry real plan IDs), reuse that exact set verbatim, and never call `newid FEAT` a second time — stating that allocating without a directory scan is what makes concurrent allocation safe, which is also why a re-generation silently produces a different set that no longer matches the `PACT` lane map
- [x] Change the Step 2L spawn line from `ID to use: {that lane's FEAT-<id>}` to `ID to use: {the FEAT-<id> Step 2c assigned to this lane}`
- [x] Confirm Step 2c's "Pre-generate every lane `FEAT` ID with `newid FEAT` **before** this spawn" sentence is now the only allocation instruction, and that its cross-reference to Step 2L still resolves after the 2L rewrite
- [x] Assert every Phase 2 structural check passes, and trace the `PACT` lane map's `Lane plan ID` column through `artifact-format.md` → `PACT` ID resolution to confirm the join reads the same IDs the lane architects were given

### Phase 3 — MF-2: materialize `config.md` and repoint the cross-references

- [x] Write the Phase 3 structural check list: `references/config.md` appears in B3 step 2's copy list and B3 step 4's summary; the "Re-copy all …" count matches the new item total; every `.orchestrator/config.md` reference in the repo sits in a file that is itself materialized into the target project; every `references/config.md` reference sits in a file that reads the skill directory; the owned-glob rejection list still has exactly one normative copy
- [x] Add `references/config.md` → `.orchestrator/config.md` to Bootstrap B3 step 2's copy list, alongside `references/artifact-format.md`
- [x] Update B3's "Re-copy all three on every bootstrap" sentence so its count matches the new item total, and add `.orchestrator/config.md` to B3 step 4's printed bootstrap-summary line
- [x] Change the three `.orchestrator/config.md` references inside `orchestrator/SKILL.md` (Step 0b `parallelism` resolution, Step 0c lane validation, and the Rules section's glob-rejection pointer) to `references/config.md`, matching the existing form at `SKILL.md:14` — `SKILL.md` runs in the caller's session and reads its own skill directory
- [x] Confirm `templates/architect.md`'s two `.orchestrator/config.md` references are left unchanged and now resolve, since `architect.md` is materialized into `target/.claude/agents/` and cannot read the skill's `references/`
- [x] Confirm no normative content was copied out of `config.md` into `SKILL.md` or `architect.md` by this phase — the fix makes the pointer reachable, it does not inline the target
- [x] Assert every Phase 3 structural check passes, and re-read the `lanes` → *Owned-glob rejection* heading in `references/config.md` to confirm every one of the five pointers names a heading that actually exists

### Phase 4 — MF-4: restore `product-manager` scope

- [x] Write the Phase 4 structural check list: `product-manager/SKILL.md` contains no `--parallel` token anywhere; its per-story loop step 2 invocation sentence is byte-identical to its pre-`FEAT-…-c4af` form; `git-flow.md` carries exactly one Step 2p paragraph and it is docs-only; `orchestrator/SKILL.md` makes no claim about what `product-manager` passes; the `off` path across the union diff adds no token to any PM-driven invocation
- [x] Revert `product-manager/SKILL.md`'s per-story loop step 2 to its pre-change text — restore "Invoke the `orchestrator` skill with the story's `## Brief` section passed verbatim as the task input" and delete the "The flag is not optional…" sentence and its `git-flow.md` → Step 2p pointer, leaving the untrusted **System context block** subsection and everything after it untouched
- [x] Rewrite the `git-flow.md` Step 2p paragraph as the authorized bounded docs-only mirror, in the same shape as the adjacent Step 0 paragraph: `parallelism` defaults to `off`, but a project's `.orchestrator/config.json` may set `ask`, and PM does not set `automation_level` so the autonomous no-prompt guard does not cover a PM run — therefore if the Step 2p prompt appears PM answers it on the user's behalf with **option 1, sequential (`off`)**, because PM's per-story contract is one story → one orchestrator run → one commit on `pm/<id>-<slug>` and lane fan-out is a within-run concern the single up-front confirmation never authorized. Within the same paragraph, state that a project explicitly configuring `lanes`/`full` is opting in and does not break PM's contract, since the orchestrator still ends at one `READY_TO_COMMIT` over one union diff
- [x] Remove the "— `product-manager` does —" clause from `orchestrator/SKILL.md`'s Step 2p.4 closing sentence, leaving the generic and still-true statement that a non-interactive caller may pass `--parallel off` explicitly so the step does not exist for its run rather than depending on the default
- [x] Re-verify the parent plan's AC 14 across the union diff now that the flag is gone: diff the `off` execution path against the pre-feature documents and confirm every role prompt, artifact, status line, and stdout header line is identical, with Steps 0c/2p/2c/2L/3L/3j skipped entirely
- [x] Assert every Phase 4 structural check passes, and record in the progress log that MF-4 was resolved by restoring scope, naming the two reverted sites and the one rewritten paragraph so the change is traceable

### Phase 5 — Should Fix items (optional)

- [x] (optional) Write the SF-1 structural check: `full` mode's per-lane reviewer has a stated purpose at both the join description and `reviewer.md`, and `ask` ladder option 3 is annotated with what it trades
- [x] (optional) Implement SF-1: state at the `full` join description and in `templates/reviewer.md` that the per-lane reviewer is early lane-local signal fed into the single join-level pass and explicitly not remediation, and annotate `ask` ladder option 3 so it prices what it buys (earlier findings, N extra reviewer passes and N extra CR artifacts, no wall-clock gain over `lanes`)
- [x] (optional) Write the SF-2 structural check: Step 2L states why the global architect barrier exists, in terms a future simplify pass would have to argue against
- [x] (optional) Implement SF-2: add one sentence to Step 2L stating that all lane plans are verified before any coder starts, that this barrier is deliberate, and that a lane plan failing verification is re-invoked at zero cost whereas under per-lane architect→coder chaining the re-invoke would happen while other lanes are already mutating the shared workspace
- [x] (optional) Write the SF-3 structural check: `architect.md` hard rule 1's parenthetical matches the table it references
- [x] (optional) Implement SF-3: change `architect.md` hard rule 1's "(the three rows in the table above)" to "(the three directories in the table above — `contract` co-locates in `plans/feat/`)"
- [x] (optional) Write the SF-4 structural check: each of the Steps 3b, 4, and 5 prompt blocks carries an adjacent note that `{plan_id}` is the `PACT` ID on the parallel path, and the block text itself is unedited
- [x] (optional) Implement SF-4: add one line under each of the three prompt blocks in Steps 3b, 4, and 5 stating that on the parallel path `{plan_id}` is the `PACT` ID (Step 3j.3) and the prompt is otherwise unchanged — added as a note beside the block, never as an edit inside it, so the `off`-path text stays byte-identical
- [x] (optional) Assert every Phase 5 structural check passes for each SF item actually implemented, and record in the progress log which SF items were implemented and which were skipped

### Phase 6 — Union verification and CR closure

- [x] Run `node --test plugins/my-skills/skills/orchestrator/scripts/render-artifact.test.cjs` once over the union diff as a collateral-regression guard and confirm it exits 0 with the same pass count the CR recorded (45 pass / 0 fail)
- [x] Confirm all four Must Fix items are closed by re-reading each CR anchor: `SKILL.md` Step 2p/2/3 (MF-1), Step 2L (MF-3), B3 plus the five cross-references (MF-2), and the three PM/orchestrator sites (MF-4)
- [x] Confirm this plan introduced no new top-level directory under `plans/`, modified no existing allow-list row, and left every cross-reference it added or changed resolving to a real file and heading

## Dependencies

- `FEAT-20260807T004018Z-c4af` must be `status: DONE` (it is) — this plan edits the files that plan authored.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-07T02:01:01Z | QA

QA-20260807T015610Z-de0d created. Status: READY_WITH_WARNINGS. Failures: 0. Lint/type errors: 0.

### 2026-08-07T01:50:46Z | REVIEWER

CR-20260807T015046Z-032f created. Status: APPROVED. Must Fix: 0. Should Fix: 2.

### 2026-08-07T02:10:45Z | CODER

All 36 tasks complete. Plan status → DONE. Ready for reviewer.

(The plan header and `.progress.md` both say "34 across 6 phases"; the actual bullet count is
6 + 5 + 7 + 6 + 9 + 3 = **36**. An architect arithmetic slip, not a scope change — every bullet
written in the plan was executed and checked, none added, none dropped.)

All four Must Fix items closed, all four Should Fix items implemented (none skipped).
MF-4 resolved by **restoring scope**: `product-manager/SKILL.md` reverted to byte-identical
pre-feature text, `orchestrator/SKILL.md` Step 2p.4's PM claim removed, and the AC-13-authorized
bounded docs-only paragraph landed in `product-manager/references/git-flow.md`.

Collateral-regression guard: `node --test scripts/render-artifact.test.cjs` → 45 pass / 0 fail,
matching the count the CR recorded.

### 2026-08-07T01:39:01Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-07T01:35:33Z | ARCHITECT

Plan `FIX-20260807T013331Z-d607` created. Type: fix. Tasks: 34 across 6 phases.
Source CR: `CR-20260807T012541Z-a43d` (4 Must Fix, 4 Should Fix).
MF-4 ruled: restore scope — revert the `--parallel off` flag, land the AC-13-authorized
docs-only mirror instead. Rationale recorded under Technical Notes → Decision — MF-4.
SF-1 ruled: keep `full`'s per-lane reviewer, state its purpose and price option 3.
SF-2 ruled: keep the Step 2L barrier, document the recoverability rationale.
Doc-only plan — no `## Verification (per phase)` section; no command gate matches any
phase's touched paths. Verification is structural review per `PROJECT-CONTEXT.md`.
Status: PLANNED. Ready for coder.
