---
id: FIX-20260807T040856Z-bf97
title: Nested inner-lane parallelism — CR-25d5 remediation
type: fix
status: DONE
created_at: 2026-08-07T04:08:56Z
updated_at: 2026-08-07T05:08:00Z
cycle: 0
related_to: CR-20260807T035907Z-25d5, FEAT-20260807T030642Z-6077, SPEC-20260807T025822Z-2a6f, TEST-20260807T035031Z-230c
---

**Related:** [CR-20260807T035907Z-25d5](./CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md) · [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md) · [SPEC-20260807T025822Z-2a6f](../specs/SPEC-20260807T025822Z-2a6f-orchestrator-nested-inner-lane-parallelism.md)

## Overview

Remediates all eight Must Fix items in `CR-20260807T035907Z-25d5`, the REQUEST_CHANGES review of `FEAT-20260807T030642Z-6077` (nested inner-lane parallelism). Every blocker is a bounded prose edit or a **recorded** gate amendment; the CR is explicit that the design is sound and no re-architecture is required.

Six of the eight blockers (MF-1, MF-2, MF-3, MF-6, MF-7, MF-8) originate in the mandatory post-coder `simplify` pass, not the coder's session: that pass made 12 edits and re-ran only `render-artifact.test.cjs` — a suite this work does not touch — never the plan's five structural phase gates, which are the only verification covering a prose diff. Several of its edits changed a definition without sweeping the definition's consumers. This plan therefore fixes the eight defects **and** closes the systemic hole that produced them: Phase 6 makes re-running the plan's own per-phase gates mandatory for whatever runs after the coder, so an available executable suite can never again stand in for the gate that actually covers the diff.

Per the CR's ruling on MF-1, the SIMPLIFY prose is **correct and is not reverted** — instead the three brittle Phase-3 assertions that pinned sentence-exact wording to a location are amended to be claim-based, as an explicit recorded task in this plan so it can never read as a silently relaxed gate.

## Acceptance Criteria

1. **MF-1** — The parent plan's three red Phase-3 assertions are replaced with claim-based equivalents that exit 0 against the live tree; the SIMPLIFY prose is **not** reverted, `3j.4` is **not** resurrected, the precedence sentence is **not** re-duplicated into `3j.1`/`3j.2`, and the amendment is recorded in this plan's task list and in both plans' Progress Logs with `CR-20260807T035907Z-25d5` named as its justification.
2. **MF-2** — `leaves=` is emitted by every join-level spawn that the preamble declares it for: the Step 3b, Step 4, and Step 5 prompt blocks in `orchestrator/SKILL.md` each carry a `leaves=` line gated on the parallel path (omitted on an `off` run, like `lane=`/`contract=`), Step 0r states that a resumed run carries it too, and the three join templates' fallback narrows to legacy runs. `grep -c 'leaves='` on `SKILL.md` returns strictly more than the 2 definition-only hits.
3. **MF-3** — `templates/architect.md`'s Step 3C case table selects the sub-contract case on a **non-empty `lane=` in the preamble** (with `contract=` naming the parent), matching the already-correct Inputs paragraph; no routing anywhere in the skill keys on a `Parent contract:` or `Lane:` body line that nothing emits; and the parent plan's Phase 4 gate asserts the preamble form instead of the stale `Parent contract:` string.
4. **MF-4** — `references/config.md` → *The makespan model* declares **one unit (task-equivalents)** and the fixed conversions for a contract-authoring pass, a join pass, and an interface point, stated before any formula uses them, so `g > c` is ordinary arithmetic; the assumption line covers the conversion and not only concurrency; and both `{g}` and `{c}` are printed with the unit named at Step 2p.3n and 2p.5.
5. **MF-5** — `references/config.md` splits the overhead term by shape — contract-authoring passes at one level are concurrent and cost slowest-of-`k`, inner-join passes are serialized after the leaf barrier and cost the **sum** of `k` — and charges a `k`-way plan `k × J` on the cost side; and `SKILL.md`'s Step 3s barrier justification is replaced with the honest one (a single deterministic reconciliation order and one join state machine, **not** input wholeness, which containment already guarantees).
6. **MF-6** — No document describes a resume confirmation that no longer exists: `product-manager/references/git-flow.md`'s Step 0r paragraph states the actual two-outcome shape (PM passes no `--resume`, so a PM-driven run always gets the non-blocking hint and starts fresh; PM's guarantee is structural, not an answer it gives), and `SKILL.md`'s Rules line names *"Step 0r (resume opt-in, which never prompts at all)"*.
7. **MF-7** — The `<2-viable-sub-lanes` outcome has exactly one owner and both documents agree on it: the decision moves into the 2p.3n gate where the lane can still be left flat before the parent contract is frozen, `templates/architect.md`'s sub-contract delta 2 states that a lane reaching the architect has already cleared that condition and that a refusal **halts the run at 2s.3 rather than degrading to flat**, and the `SKILL.md` → Step 0c cross-reference is deleted and replaced with the step that actually owns the outcome.
8. **MF-8** — `SKILL.md` 3j.3 no longer claims the three join role templates are unchanged; it states what is true (they changed only to name the outer join, to accept the pre-resolved `leaves=` set, and — for the tester — to fold sub-contract interface rows into its existing triage input; no role walks the contract tree and none has a per-lane or per-sub-lane pass).
9. **Systemic** — `SKILL.md`'s Simplification pass (Step 3) and the Step 3j union-diff `simplify` both require re-running **the plan's own `## Verification (per phase)` gates** for every phase whose touched paths the post-coder diff intersects, asserting exit 0 before the tester is invoked; the rule states explicitly that whatever executable suite happens to exist in the repo is **not** a substitute; and a red gate routes to a fix or to a **recorded** amendment task, never to a silent rewrite and never to proceeding.
10. **No regression** — All five of the parent plan's phase gates plus this plan's own gates exit 0 over the final tree as one aggregate batch; `plugins/my-skills/skills/orchestrator/scripts/**` and `templates/html/**` are untouched; no renderer, HTML scaffold, or `.md`/`.html` parity change is introduced; every cross-reference this plan touches resolves on disk.

## Out of Scope

- **Re-sequencing the joins.** SPEC requirement 45 mandates Step 3s after a global leaf barrier and requirement 41 mandates `all of 2s → all of 2L → all of 3L`. Early per-lane inner joins and concurrent 2s / unsplit-lane 2L are recorded as spec-level follow-ups in the CR (*Follow-ups* 1 and 2) and are **not** implemented here.
- **A contract-node abstraction** collapsing 2s/3s into 2c/3j (CR *Follow-up* 3) — the parent plan's ACs are written in terms of numbered steps 2s and 3s.
- **Materializing `roadmap/references/config.md` at B3** (CR *Follow-up* 4). Requirement 68's inlining stands.
- **`gate-scope.test.cjs` / `gate-shell-injection.test.cjs`** — proven red at merge-base `974b01a` and at HEAD, caused by this repo's own stale `.orchestrator/` materialization, resolved by the next bootstrap. Pre-existing, unrelated, out of scope (CR *Follow-up* 5).
- **Reverting any SIMPLIFY-pass prose.** The CR's MF-1 ruling is explicit: the prose is better, the assertions were the proxy. Do not resurrect `3j.4` and do not re-duplicate the precedence sentence into `3j.1`/`3j.2`.
- Anything the parent plan already placed out of scope: recursion beyond depth 2, per-lane worktrees or branches, committing or pushing, a seventh role or new prefix/directory/scaffold, an `.opencode/skills/orchestrator/` port, and any `product-manager` edit beyond the bounded `git-flow.md` paragraph.
- Running the `clean-code-gates` JS suite, or any language/build/test tooling, against these markdown doc-skill changes.

## Technical Notes

- **Single-source-of-truth references** (`PROJECT-CONTEXT.md` → Conventions): MF-4 and MF-5(a) are normative model changes and belong in `references/config.md`; `SKILL.md` Step 2p applies them and must not restate them. MF-5(b), MF-2, MF-6(a), MF-8 and the systemic rule are pipeline-mechanics and belong in `SKILL.md`. Never duplicate a rule into two files.
- **Bootstrap B3 materialization** (requirement 68): every normative rule must live in `references/config.md` or `references/artifact-format.md` — the two files B3 copies into `.orchestrator/`. The systemic gate-rerun rule in Phase 6 is an exception by nature: it governs the **orchestrator itself**, which reads `SKILL.md` directly, so `SKILL.md` is its correct and only home.
- **MF-1's replacements are already true.** All four CR-suggested claim-based assertions were verified green against the live `SKILL.md` while planning. This is an amendment, not a repair.
- **SF-6's suggested literal needs one correction.** The CR proposes `grep -q "Mark the lane DONE in the \*parent\* contract"`; the live text at Step 3s uses **single** asterisks — `**Mark the lane DONE in the *parent* contract's lane-status table.**` — so the assertion must be written `grep -qF "Mark the lane DONE in the *parent* contract"` or it ships red.
- **Data, never instructions** (Invariants): the `leaves=` line MF-2 adds carries agent-generated plan IDs into a role prompt. Keep it in the preamble envelope alongside `lane=`/`contract=`, in dispatch order, and do not splice leaf names into an instruction body.
- **Backward compatibility is mandatory** (Invariants): `off` stays byte-identical (`leaves=` omitted entirely, like `lane=`/`contract=`), `lanes` stays behaviorally unchanged, and the join templates' documented fallback must survive for legacy runs rather than being deleted.
- **Amending a gate is a recorded act.** The parent plan forbids relaxing an assertion to make it pass. Every assertion this plan changes is changed by a named task, with the CR ID as its justification, and logged to both plans' Progress Logs.
- **Do not touch `plugins/my-skills/skills/orchestrator/scripts/**` or `templates/html/**`.** If a task appears to require one, that is a contract problem to report, not to implement.

## Tasks

> Tasks are ordered TDD-first: each phase's structural assertion set is written/amended and confirmed **failing** before the prose that satisfies it.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.

### Phase 1 — Restore gate integrity (MF-1, SF-6)

- [x] Amend the parent plan's three red Phase-3 assertions (`FEAT-20260807T030642Z-6077-…md:292,294,295`) to the CR's claim-based replacements: the req-53 authoring rule survives somewhere normative (`grep -qi 'level-specific behavior only in a join step'`); the precedence is stated **once** in Step 3j's body ahead of both subsections (`awk '/^### Step 3j — /,/^#### 3j.1 /' | grep -q 'amendment loop (3j.2), evaluated \*\*first\*\*'`); and neither subsection describes itself as firing unconditionally (`grep -q "Step 3j's classification routed here"` scoped to each of 3j.1 and 3j.2)
- [x] Add an inline comment above the amended assertions naming `CR-20260807T035907Z-25d5` and this FIX plan ID as the recorded justification, so a later reader can distinguish an amendment from a relaxation
- [x] Confirm the SIMPLIFY prose is untouched: `3j.4` is **not** restored, the precedence sentence is **not** re-duplicated into `3j.1`/`3j.2`, and `SKILL.md`'s Rules-section statement of the authoring rule is left as it is
- [x] Run the parent plan's amended Phase 3 gate and confirm exit 0, plus a read-through confirming AC 9 and AC 11's substance is present at the locations the amended assertions now point to
- [x] (optional) SF-6 — replace the tautological Step 3s assertion `awk '/^### Step 3s /,/^### Step 3j /' | grep -q 'parent'` with the actual claim, using the corrected literal `grep -qF "Mark the lane DONE in the *parent* contract"` (single asterisks — the CR's suggested double-asterisk form ships red)
- [x] (optional) SF-6 — replace the vacuous Phase 5 assertion `! grep -q 'passes --resume'` with the positive claim `grep -q 'PM passes no .--resume. flag'`
- [x] Run the Phase 1 gate and confirm every assertion exits 0

### Phase 2 — `SKILL.md`: wire `leaves=` and retire three false claims (MF-2, MF-5b, MF-6a, MF-8)

- [x] Write this phase's structural assertion set into `## Verification (per phase)` — `leaves=` present in all three join spawn blocks and in Step 0r; 3j.3 no longer claims the templates are unchanged; the Step 3s barrier justification names determinism rather than input wholeness; the Rules line no longer names a resume confirmation — and confirm **every one currently fails**
- [x] MF-2 — add the `leaves=` line to the Step 3b tester spawn prompt block, gated on the parallel path and omitted on an `off` run exactly as `lane=`/`contract=` are, with the leaf `FEAT` IDs comma-separated in dispatch order
- [x] MF-2 — add the same line to the Step 4 reviewer spawn prompt block and the Step 5 QA spawn prompt block, using identical phrasing and gating (mirror machinery — three copies of one line, not three variants)
- [x] MF-2 — state at Step 0r that a **resumed** run holds the rebuilt leaf set (0r step 3 already rebuilds it) and therefore emits `leaves=` too, and narrow the three join templates' documented fallback to **legacy** runs only, keeping the fallback itself intact for backward compatibility
- [x] MF-8 — replace `SKILL.md` 3j.3's *"their templates are unchanged"* sentence with what is true: beyond the `PACT` ID resolution rule the three roles need no knowledge of nesting; their templates changed only to name the outer join, to accept the pre-resolved `leaves=` set, and — for the tester — to fold sub-contract interface rows into its existing critical-flow triage input; no role walks the contract tree and none has a per-lane or per-sub-lane pass
- [x] MF-5(b) — replace the Step 3s barrier justification (*"the leaves share one workspace, so the barrier is what makes each inner join's inputs whole"*) with the honest one: the barrier buys a single deterministic reconciliation order and one join state machine, **not** input wholeness, which the containment rule already guarantees (`references/config.md` → owned-glob rejection, case 6 — the same argument Step 3L's flat dispatch leans on)
- [x] MF-5(b) — add the accompanying note that early per-lane inner joins are safe by containment but are deliberately not taken at this depth, pointing at the spec-level follow-up rather than implying the barrier is load-bearing for correctness
- [x] MF-6(a) — change the Rules-section reference from *"Step 0r (the resume confirmation)"* to *"Step 0r (resume opt-in, which never prompts at all)"*, so it agrees with Step 0r's own *"Resume is opt-in and never prompts. Two outcomes, no third."*
- [x] (optional) SF-2 — change *"This is the only place the key is enforced"* to *"Enforced here and at Step 2L, which is what makes it bind in both modes and at both depths"*, add the one-line wave rule to Step 2L's own body, and state explicitly whether Step 2s's `k`-wide architect fan-out is inside or outside the `max_parallel_lanes` ceiling
- [x] (optional) SF-3 — unify the three `off` skip lists to `0c, 0r, 2p, 2c, 2s, 2L, 3L, 3s, 3j` across `SKILL.md` and `references/config.md`, and update the Phase 1 and Phase 5 gate assertions that pin those strings byte-exactly in the same change
- [x] Run the Phase 2 gate and confirm every assertion exits 0

### Phase 3 — `references/config.md`: make the adoption gate computable (MF-4, MF-5a)

- [x] Write this phase's structural assertion set (one declared unit named before any formula; the three conversions present with defaults; the overhead term split by shape; the cost side charging `k × J`; the printed vocabulary naming the unit) and confirm **every one currently fails**
- [x] MF-4 — declare **task-equivalents** as the single unit at the head of *The makespan model*, with the three fixed conversions stated so no executing agent invents its own: one contract-authoring architect pass = `A` task-equivalents (default `A = 2`), one join pass = `J` task-equivalents (default `J = 2`), one interface point = `1` task-equivalent (one reconciliation unit)
- [x] MF-4 — restate `span`, `makespan`, `M_flat`, `M_nested`, every marginal gain, and every cost in that one unit so `g > c` is ordinary arithmetic, and rewrite the cost-side bullets from prose quantities into task-equivalent terms
- [x] MF-4 — restate the inline assumption line so it covers the **conversion**, not only concurrency (`task counts proxy wall-clock effort equally` alone is insufficient disclosure for a number that also prices passes and interface points)
- [x] MF-4 — extend the printed vocabulary so the unit is named in `SKILL.md`'s Step 2p.3n rejection line (`gain 4 task-equivalents does not exceed cost 5 task-equivalents`) and in the 2p.5 side-by-side block's `M_flat`/`M_nested` figures
- [x] MF-5(a) — split the `makespan` overhead term by shape: contract-authoring passes at one level are issued concurrently and cost **slowest-of-`k`**; inner-join passes are serialized after the leaf barrier and cost the **sum** of `k`, entirely on the critical path — so `M_nested` is no longer optimistic by roughly `(k − 1) × J`
- [x] MF-5(a) — fold the same distinction into the cost side so a `k`-way plan is charged `k × J`, not `J`, and confirm the greedy recomputed-adoption text still reads correctly against the corrected arithmetic
- [x] (optional) SF-1 — acknowledge the Step 2s barrier's honest cost in one sentence (*"an unsplit lane's architect could in principle be issued concurrently with 2s; it is not, so that the whole plan set is verified against one frozen contract tree before any of it is trusted"*) and fold that extra architect pass into the cost model
- [x] (optional) SF-5 — fix *"An absent column is **never as an error**"* to *"never an error"* in `references/artifact-format.md` and `references/config.md`, and relax the Phase 2 and Phase 5 gate assertions to `grep -q 'never an error'` in the same change
- [x] Run the Phase 3 gate and confirm every assertion exits 0

### Phase 4 — architect template: route on the preamble, make the refusal path executable (MF-3, MF-7)

- [x] Write this phase's structural assertion set — including **replacing** the parent plan's Phase 4 gate assertion `grep -q 'Parent contract:' "$AR"` with a preamble-based claim, recorded as an amendment with the CR ID — and confirm each currently fails
- [x] MF-3 — rewrite the Step 3C case table's second row to key on a **non-empty `lane=` in the preamble** (with `contract=` naming the parent contract), matching the already-correct Inputs paragraph at `architect.md:19`
- [x] MF-3 — sweep the whole skill for any remaining routing that keys on a `Parent contract:` or `Lane:` **body line**, confirm `grep -rn 'Parent contract:'` returns zero hits, and confirm Step 2s.2's prompt body and the architect's routing now agree on one channel
- [x] MF-7 — move the `<2-viable-sub-lanes` decision into the **2p.3n gate**, where the lane can still be left flat before Step 2c freezes the parent contract, reusing the gate's existing *"at least 2 sub-lanes carry work"* condition 1 and printing the same `sub-split rejected:` reason line every other shortfall prints
- [x] MF-7 — rewrite `templates/architect.md`'s sub-contract delta 2 accordingly: a lane reaching the architect has already cleared that condition; if the architect nevertheless cannot give 2+ sub-lanes bounded, contained, disjoint globs it stops and reports, and that **halts the run at Step 2s.3 — it does not degrade to flat**
- [x] MF-7 — delete the `SKILL.md` → Step 0c cross-reference from that delta (0c is config-validation-time lane taxonomy resolution and cannot act on a mid-run refusal) and point at the step that actually owns each outcome — 2p.3n for the pre-freeze demotion, 2s.3 for the mid-run halt
- [x] (optional) SF-4 — re-key `templates/architect.md`'s Step 3L heading and Inputs on the preamble (`lane=` / `contract=`) rather than on `Lane:` / `Contract:` body lines, so both levels use one channel and the template stops contradicting its own 3L.p rule
- [x] Run the Phase 4 gate and confirm every assertion exits 0

### Phase 5 — Cross-skill PM mirror (MF-6b)

- [x] Write this phase's structural assertion set (git-flow's Step 0r paragraph no longer describes a manual-mode confirmation or an answer PM gives; it states the two-outcome shape and the structural guarantee) and confirm each currently fails
- [x] MF-6(b) — rewrite `product-manager/references/git-flow.md`'s Step 0r paragraph to the actual two-outcome shape: the orchestrator never prompts for resume at all, PM passes no `--resume`, so a PM-driven run **always** gets the single non-blocking hint and starts fresh — PM's never-blocked guarantee is **structural**, not an answer it has to prepare
- [x] Confirm the rewrite stays within AC 17's bound — one paragraph in `git-flow.md`, no change to PM's command surface, and no other `product-manager` file touched — and that the Step 2p ladder paragraph beside it is left correct and unchanged
- [x] Run the Phase 5 gate and confirm every assertion exits 0

### Phase 6 — Close the post-coder verification hole, then sweep

- [x] Write this phase's structural assertion set (the Step 3 Simplification pass and the Step 3j union-diff `simplify` both mandate re-running the plan's own per-phase gates; an existing executable suite is explicitly named as not a substitute; a red gate routes to a fix or a recorded amendment and never to the tester) and confirm each currently fails
- [x] Extend `SKILL.md` Step 3's *Simplification pass (mandatory before tester)* so that after `simplify` edits the diff, the orchestrator re-runs **the plan's own `## Verification (per phase)` gate** for every phase whose touched paths the simplify diff intersects, and asserts each exits 0 before the tester is invoked
- [x] State explicitly in the same paragraph that whatever executable test suite happens to exist in the repo is **not** a substitute for the plan's phase gates — on a doc-authoring plan the phase gate is the only verification covering the diff, and running an unrelated suite green proves nothing about it
- [x] Specify the routing for a red gate: fix the prose, **or** amend the assertion as a recorded plan task with its justification (the same discipline Phase 1 of this plan follows) — never a silent rewrite of either side, and never proceeding to the tester on red
- [x] Mirror the identical rule at Step 3j's union-diff `simplify`, where the gates to re-run are those of every leaf plan in the resolved leaf set, keeping the *"`simplify` and the full test suite run exactly once per run"* cadence rule intact and unchanged
- [x] Log the SIMPLIFY-pass provenance in this plan's `.progress.md`: which of MF-1/2/3/6/7/8 traced to which of the pass's 12 edits, so the next reader can see why the rule was added rather than only that it was
- [x] Re-run **all five** of the parent plan's phase gates plus all six of this plan's gates over the final tree as one aggregate batch and confirm exit 0
- [x] Confirm no `plugins/my-skills/skills/orchestrator/scripts/**` or `templates/html/**` change, no renderer or HTML scaffold change, no `.md`/`.html` parity work, and that every cross-reference this plan touched resolves on disk

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands
> that apply to the phase's touched paths and asserts each exits 0. A failure routes
> through the coder's BLOCKED step, not a silent rewrite.

Applying the Commands section of `PROJECT-CONTEXT.md`: this repo has **no build, no lint, and no automated test command for doc-skill changes**, and `clean-code-gates`' JS suite is explicitly scoped to that skill only. Every path this plan touches is markdown under `plugins/my-skills/skills/{orchestrator,product-manager}/` or a plan file under `plans/`, so **no language/build/test tooling gate applies** — running one would violate `PROJECT-CONTEXT.md` → Out of scope, and is precisely the substitution Phase 6 exists to forbid.

The phase gate is therefore the phase's own **structural assertion set**, run from the repo root as `bash /dev/stdin <<'GATE' … GATE` with `set -euo pipefail`, so the **first** failing assertion aborts the set non-zero.

> **Harness note — piped assertions never use `grep -q` (recorded, `CR-20260807T035907Z-25d5` / this plan, Phase 3).** Under `set -euo pipefail`, `awk … | grep -q PATTERN` reports **141** whenever `grep -q` matches early enough to exit before `awk` has finished writing: `awk` dies of `SIGPIPE` and `pipefail` surfaces its status. The abort is a **property of where the match lands in the buffer**, not of the claim — the same assertion passes or fails depending on how far down the section the matching line sits, so a gate written that way can go red on a tree that satisfies it and, worse, can go green today and red tomorrow on an edit that only moved a paragraph. Every piped assertion in this plan's gates is therefore written `… | grep PATTERN >/dev/null`, which is exit-status-identical (0 iff matched) but consumes the whole stream. Unpiped `grep -q` is unaffected and is left as-is.
>
> **Correction (recorded, `CR-20260807T045301Z-4659` (SF-3) / `FIX-20260807T050208Z-9ac2`, Phase 1).** When first written the sentence above overstated: the Phase 3 gate's own wall-clock assertion was a piped `grep -qiE`, so "every" was false of the very note that asserted it. That assertion was rewritten in the same pass that removed this plan's `!`-inverted forms, and the claim now holds — verified by a mechanical scan of every fenced gate block in this file, which finds zero `grep -q` in pipe-consumer position. Where a gate must search for a *literal* containing `grep -q`, it uses the `-[q]` bracket idiom so the scanner cannot match its own line.
>
> **Harness note — absence assertions never use `!` (recorded, `CR-20260807T045301Z-4659` / `FIX-20260807T050208Z-9ac2`, Phase 1).** Bash exempts a command from `set -e` when its return value is inverted with `!`, and the exemption covers negated *pipelines* and brace-group negations as well as negated simple commands. A `! grep …` assertion therefore reports false and the gate still prints `OK` and exits 0 — it cannot fail. All eighteen `!`-inverted assertions in this plan's six gates, plus the one `{ ! grep …; }` brace-group variant, have been rewritten to `if <presence-probe>; then echo "FAIL: …" >&2; exit 1; fi`, each carrying a `FAIL:` message naming the violated claim.

Phase exit criterion: **every assertion in the phase's set exits 0**, plus a read-through confirming the prose actually says what the grep proves is present. No silent rewrite of a rule to make an assertion pass without a corresponding plan task.

### Phase 1 gate — parent-plan gate integrity

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
K="$S/SKILL.md"
P=plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md
# live assertion lines of ONE fenced gate block, `#`-comment lines stripped.
# RESCOPED (recorded, CR-20260807T045301Z-4659 / FIX-20260807T050208Z-9ac2, Phase 1): items 1
# and 3 below were unsatisfiable *by construction*. Item 3 REQUIRES the parent plan to record
# the old literal as the amendment's justification; item 1 asserted that same literal absent
# from the whole file. Deleting either side is wrong — the record is what keeps an amended gate
# from reading as a silently relaxed one, and the absence assertion is what proves the amendment
# landed. An absence assertion over a plan's gate therefore asserts absence from that gate's
# LIVE assertion lines, never from the whole file.
gate_body() { awk "/$2/,/$3/" "$1" | grep -v '^[[:space:]]*#'; }
# 1. the three brittle assertions are GONE from the parent plan's Phase 3 gate.
#    NOTE the `-[q]` bracket idiom: these scanners search gate code for a banned literal and live
#    in gate code themselves, so a fixed-string pattern would match its own line — and would also
#    read as a piped `grep -q` to the harness scanner in FIX-20260807T050208Z-9ac2's Phase 1 gate.
#    The bracket makes each pattern non-self-matching. The literals carry no ERE metacharacters.
if gate_body "$P" '^### Phase 3 gate' '^### Phase 4 gate' \
     | grep -E "grep -[q]i 'no level-specific behavior may be specified only inside a join step'" >/dev/null; then
  echo "FAIL: the brittle location-pinned assertion is still live in the parent's Phase 3 gate" >&2; exit 1
fi
if gate_body "$P" '^### Phase 3 gate' '^### Phase 4 gate' \
     | grep -E "grep -[q] 'amendment loop is evaluated first'" >/dev/null; then
  echo "FAIL: the old amendment-loop literal is still a live assertion in the parent's Phase 3 gate" >&2; exit 1
fi
# 2. their claim-based replacements are present
grep -qF "grep -qi 'level-specific behavior only in a join step'" "$P"
grep -qF "Step 3j's classification routed here" "$P"
# 3. the amendment is RECORDED, not silent
grep -qF 'CR-20260807T035907Z-25d5' "$P"
grep -qF 'FIX-20260807T040856Z-bf97' "$P"
# 4. the SIMPLIFY prose was NOT reverted
if grep -qE '^#### 3j\.4 ' "$K"; then
  echo "FAIL: 3j.4 was resurrected — the SIMPLIFY prose must not be reverted" >&2; exit 1
fi
test "$(grep -c 'amendment loop (3j.2), evaluated \*\*first\*\*' "$K")" -eq 1
# 5. and every amended claim is TRUE against the live tree
grep -qi 'level-specific behavior only in a join step' "$K"
awk '/^### Step 3j — /,/^#### 3j.1 /' "$K" | grep 'amendment loop (3j.2), evaluated \*\*first\*\*' >/dev/null
awk '/^#### 3j.1 /,/^#### 3j.2 /' "$K" | grep "Step 3j's classification routed here" >/dev/null
awk '/^#### 3j.2 /,/^#### 3j.3 /' "$K" | grep "Step 3j's classification routed here" >/dev/null
# 6. SF-6 — the corrected single-asterisk literal, never the CR's suggested double.
# WRAPPER DROPPED (recorded, CR-20260807T045301Z-4659 (SF-5) / FIX-20260807T050208Z-9ac2,
# Phase 1): this was guarded by `if grep -qF 'Mark the lane DONE in the' "$P"; then … fi`, whose
# condition is a prefix of the very literal the body asserts. A tree that dropped the claim
# entirely would fail the condition and skip the body silently, so the assertion could not
# distinguish "satisfied" from "absent". SF-6 was in fact taken, so it is asserted unconditionally.
grep -qF 'Mark the lane DONE in the *parent* contract' "$P"
awk '/^### Step 3s — /,/^### Step 3j — /' "$K" | grep -F 'Mark the lane DONE in the *parent* contract' >/dev/null
# 7. the parent plan's OWN Phase 3 gate now exits 0 (run it as written)
echo "phase 1 gate: OK"
```

### Phase 2 gate — `SKILL.md` dispatch and stale claims

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
K="$S/SKILL.md"
# 1. MF-2 — `leaves=` is EMITTED, not only defined: strictly more than the 2 definition hits
test "$(grep -c 'leaves=' "$K")" -gt 2
awk '/^### Step 3b — /,/^### Step 4 /' "$K" | grep 'leaves=' >/dev/null
awk '/^### Step 4 /,/^### Step 5 /' "$K" | grep 'leaves=' >/dev/null
# ANCHOR CORRECTED (recorded, CR-20260807T035907Z-25d5 / FIX-20260807T040856Z-bf97 Phase 2):
# there is no `### Step 6` heading in SKILL.md, so the original range ran to EOF and would have
# been satisfied by a `leaves=` hit anywhere downstream, including the Rules section. Narrowed
# to Step 5's real successor heading. This TIGHTENS the assertion; it does not relax it.
awk '/^### Step 5 /,/^## Spec eval \+ report/' "$K" | grep 'leaves=' >/dev/null
# 2. MF-2 — omitted on an `off` run, and present on a resumed run.
# ASSERTION REPLACED (recorded, CR-20260807T045301Z-4659 (SF-2) / FIX-20260807T050208Z-9ac2,
# Phase 1): the former `grep -q 'leaves=' "$K" && grep -qi 'parallel path' "$K"` was tautological.
# Both conjuncts are unavoidably true anywhere in a file that defines `leaves=` at all, so the
# assertion was green before the emission sites existed — the same "green because nothing is
# being checked" defect MF-2 was raised for. Replaced with the per-site claim: each of the three
# producing spawn blocks must carry the `parallel path ONLY` marker on its own `leaves=` line.
test "$(grep -c 'leaves=.*parallel path ONLY' "$K")" -eq 3
# ANCHOR CORRECTED (recorded, same justification): Step 0r is authored as `#### 0r — …`, a
# sub-step of Step 0, not `### Step 0r`. The original range matched no start line at all, so the
# assertion was unsatisfiable by construction and could never have gone green however the prose
# was written. Re-anchored to the real heading.
awk '/^#### 0r — /,/^#### 0c — /' "$K" | grep 'leaves=' >/dev/null
# 3. MF-8 — 3j.3 no longer claims the templates are unchanged
if grep -qF 'their templates are unchanged' "$K"; then
  echo "FAIL: 3j.3 still claims the consumer templates are unchanged" >&2; exit 1
fi
# ASSERTION AMENDED (recorded, CR-20260807T045301Z-4659 (MF-3) / FIX-20260807T050208Z-9ac2,
# Phase 2). This line required the literal `no role walks the contract tree` to be PRESENT in
# 3j.3. That claim has since been ruled FALSE: `leaves=` carries leaf `FEAT` plan IDs only, so
# the reviewer's *Inherited interface assignments* lookup and the tester's sub-contract interface
# rows are reachable ONLY through the parent `PACT`'s `Sub-contract` column — both roles
# legitimately traverse it, and the shipped templates instruct them to. The assertion was green
# because the prose was wrong, which is the failure mode a gate exists to catch. MF-8's actual
# demand — that 3j.3 stop overclaiming about the consumer templates — is untouched and still
# asserted directly above. Only the false absolute is replaced, by the narrower claim that holds.
# This is an amendment, NOT a relaxation: the new literal is strictly more specific.
awk '/^#### 3j.3 /,/^### Step 4 /' "$K" | grep 'no role recurses past one level' >/dev/null
# 4. MF-5(b) — the barrier justification names determinism, not input wholeness
if grep -qF "the barrier is what makes each inner join's inputs whole" "$K"; then
  echo "FAIL: the barrier justification still claims input wholeness, contradicting the containment proof" >&2; exit 1
fi
awk '/^### Step 3s — /,/^### Step 3j — /' "$K" | grep 'deterministic reconciliation order' >/dev/null
awk '/^### Step 3s — /,/^### Step 3j — /' "$K" | grep -i 'containment already guarantees' >/dev/null
# 5. MF-6(a) — the Rules line no longer names a resume confirmation
if grep -qF 'Step 0r (the resume confirmation)' "$K"; then
  echo "FAIL: the Rules line still names a resume confirmation" >&2; exit 1
fi
grep -qF 'never prompts at all' "$K"
# 6. unchanged invariants — cadence rule and `off` byte-identity survive
grep -q 'exactly once per run' "$K"
if grep -qi 'per-lane tester' "$K"; then
  echo "FAIL: the shipped per-lane-tester meaning of \`full\` survives in SKILL.md" >&2; exit 1
fi
echo "phase 2 gate: OK"
```

### Phase 3 gate — `references/config.md` decision model

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
C="$S/references/config.md"
K="$S/SKILL.md"
# 1. MF-4 — ONE unit, declared before any formula uses it
grep -q 'task-equivalents' "$C"
grep -q 'denominated in task-equivalents' "$C"
# 2. MF-4 — the three fixed conversions with their defaults
grep -q 'contract-authoring architect pass' "$C"
grep -qE 'default `A = 2`' "$C"
grep -qE 'default `J = 2`' "$C"
grep -q 'one reconciliation unit' "$C"
# 3. MF-4 — `g > c` is ordinary arithmetic and both are printed with the unit named
grep -q 'ordinary arithmetic' "$C"
grep -q 'task-equivalents' "$K"
# ANCHOR TIGHTENED (recorded, CR-20260807T035907Z-25d5 / FIX-20260807T040856Z-bf97 Phase 4):
# `2p.3n` is mentioned at five places in SKILL.md and `2p.4` at four, so the unanchored range
# closes at 2p.4's heading and then RE-OPENS at the next 2p.3n mention, running to the last
# 2p.4 mention in the Rules section — 746 lines, over half the file. A hit anywhere in that
# span would have satisfied an assertion meant to cover one 30-line step. Anchored to the two
# headings. This TIGHTENS the assertion; the claim it makes is unchanged and still green.
awk '/^#### 2p\.3n /,/^#### 2p\.4 /' "$K" | grep 'task-equivalents' >/dev/null
# 4. MF-4 — the assumption line covers the CONVERSION, not only concurrency
grep -q 'proxy wall-clock effort equally' "$C"
grep -qi 'conversion' "$C"
# 5. MF-5(a) — the overhead term is split by shape
grep -q 'slowest-of-k' "$C"
grep -q 'sum of k' "$C"
if grep -qF 'plus the fixed overhead** (every contract-authoring pass plus every join pass)' "$C"; then
  echo "FAIL: the unsplit fixed-overhead term survives in config.md" >&2; exit 1
fi
# 6. MF-5(a) — the cost side charges k join passes, not one
grep -qE 'k × J|k inner-join passes' "$C"
# 7. unchanged invariants — no wall-clock ETA anywhere
grep -q 'Never print a wall-clock ETA' "$C"
# ASSERTION CORRECTED (recorded, CR-20260807T035907Z-25d5 / FIX-20260807T040856Z-bf97 Phase 3):
# the original blanket `! grep -qiE '\b(minutes|hours|seconds)\b' "$C"` was unsatisfiable by
# construction — the very sentence that FORBIDS wall-clock units names one ("Task counts are the
# honest, checkable proxy; minutes would be fabricated precision"). As written the assertion
# could only go green by deleting the prohibition's own rationale, which is the opposite of the
# invariant it is guarding. Narrowed to the real claim: no time unit appears anywhere in the file
# EXCEPT on the line that prohibits it. This is a correction of a mis-specified assertion, not a
# relaxation — every other occurrence is still forbidden.
if grep -viE 'Never print a wall-clock ETA' "$C" | grep -iE '\b(minutes|hours|seconds)\b' >/dev/null; then
  echo "FAIL: a wall-clock time unit appears in config.md on a line other than the prohibition" >&2; exit 1
fi
# 8. SF-5 — the prose is fixed in BOTH files and the gates relaxed with it.
# WRAPPER DROPPED (recorded, CR-20260807T045301Z-4659 (SF-5) / FIX-20260807T050208Z-9ac2,
# Phase 1): the guard `if grep -q 'never an error' …; then … fi` made the body vacuous on exactly
# the tree it was meant to catch — a tree that never adopted the corrected phrasing skips the
# check silently. SF-5 was in fact taken, so the corrected phrasing is required and its
# ungrammatical predecessor is forbidden, both unconditionally.
grep -q 'never an error' "$S/references/artifact-format.md"
if grep -q 'never as an error' "$S/references/artifact-format.md"; then
  echo "FAIL: the ungrammatical 'never as an error' survives in artifact-format.md" >&2; exit 1
fi
if grep -q 'never as an error' "$C"; then
  echo "FAIL: the ungrammatical 'never as an error' survives in config.md" >&2; exit 1
fi
echo "phase 3 gate: OK"
```

### Phase 4 gate — architect template routing and the refusal path

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
AR="$S/templates/architect.md"
K="$S/SKILL.md"
P=plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md
# live assertion lines of ONE fenced gate block, `#`-comment lines stripped — see the Phase 1
# gate's note. Comment-stripping is load-bearing HERE specifically: the parent records this
# amendment's justification at two places, one of which (`FEAT-…:366`) is a `#`-comment line
# INSIDE the Phase 4 gate's own fence, so an awk range alone would not resolve the collision.
# (recorded, CR-20260807T045301Z-4659 / FIX-20260807T050208Z-9ac2, Phase 1)
gate_body() { awk "/$2/,/$3/" "$1" | grep -v '^[[:space:]]*#'; }
# 1. MF-3 — NOTHING routes on a body line nobody emits
if grep -rq 'Parent contract:' "$S"; then
  echo "FAIL: something still routes on the \`Parent contract:\` body line no spawn emits" >&2; exit 1
fi
# 2. MF-3 — Step 3C's case table keys on the preamble
awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep 'non-empty `lane=`' >/dev/null
awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep '`contract=` names the parent' >/dev/null
# 3. MF-3 — the parent plan's Phase 4 gate assertion was amended, and recorded
# `-[q]` bracket idiom — see the Phase 1 gate's note.
if gate_body "$P" '^### Phase 4 gate' '^### Phase 5 gate' \
     | grep -E "grep -[q] 'Parent contract:'" >/dev/null; then
  echo "FAIL: the stale Parent-contract assertion is still live in the parent's Phase 4 gate" >&2; exit 1
fi
grep -qF 'non-empty `lane=`' "$P"
grep -qF 'CR-20260807T035907Z-25d5' "$P"
# 4. MF-7 — the <2-sub-lane decision is owned by the 2p.3n gate
# ANCHOR TIGHTENED — same justification as the Phase 3 gate's note.
awk '/^#### 2p\.3n /,/^#### 2p\.4 /' "$K" | grep -i 'at least 2 sub-lanes' >/dev/null
# 5. MF-7 — the architect's refusal HALTS at 2s.3 and does not claim a flat degradation
if grep -qF 'not sub-split and runs flat' "$AR"; then
  echo "FAIL: architect.md still claims the flat degradation instead of halting" >&2; exit 1
fi
grep -qF 'halts the run at' "$AR"
grep -q '2s.3' "$AR"
# 6. MF-7 — the wrong Step 0c cross-reference is gone from the sub-contract deltas
if awk '/^#### Sub-contract deltas/,/^### /' "$AR" | grep 'Step 0c' >/dev/null; then
  echo "FAIL: the wrong Step 0c cross-reference survives in the sub-contract deltas" >&2; exit 1
fi
# 7. unchanged invariants — still ONE workflow, no new type value
if grep -qE '^\| `sub-?contract` +\|' "$AR"; then
  echo "FAIL: a new \`sub-contract\` type value was added to architect.md's canonical table" >&2; exit 1
fi
if grep -qE '^## Step 3S' "$AR"; then
  echo "FAIL: a second, parallel Step 3S workflow was added to architect.md" >&2; exit 1
fi
echo "phase 4 gate: OK"
```

### Phase 5 gate — PM cross-skill mirror

```bash
set -euo pipefail
PM=plugins/my-skills/skills/product-manager
G="$PM/references/git-flow.md"
# 1. MF-6(b) — no manual-mode confirmation, no answer PM has to give
if grep -qF 'or a manual-mode confirmation' "$G"; then
  echo "FAIL: git-flow.md still describes a manual-mode confirmation PM would have to answer" >&2; exit 1
fi
if grep -qF 'PM answers "start fresh"' "$G"; then
  echo "FAIL: git-flow.md still gives PM an answer to a prompt it never receives" >&2; exit 1
fi
# 2. MF-6(b) — the actual two-outcome shape and the STRUCTURAL guarantee
grep -q 'never prompts' "$G"
grep -q 'non-blocking hint' "$G"
grep -qi 'structural' "$G"
grep -q 'PM passes no `--resume` flag' "$G"
# 3. bounded remedy — command surface unchanged, ladder paragraph still correct
grep -q "PM's command surface is unchanged" "$G"
grep -q 'nested lane-parallel' "$G"
grep -q 'may be omitted' "$G"
# 4. nothing else in product-manager changed by this plan
test -z "$(git diff --name-only HEAD -- "$PM" | grep -v 'references/git-flow.md' || true)"
echo "phase 5 gate: OK"
```

### Phase 6 gate — post-coder gate re-run rule, then the sweep

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
K="$S/SKILL.md"
# 1. Step 3's simplification pass re-runs THE PLAN'S OWN phase gates
awk '/Simplification pass \(mandatory before tester\)/,/^### Step 2c /' "$K" \
  | grep 'Verification (per phase)' >/dev/null
awk '/Simplification pass \(mandatory before tester\)/,/^### Step 2c /' "$K" \
  | grep -i 'assert.*exit 0' >/dev/null
# 2. an existing executable suite is explicitly NOT a substitute
grep -qi 'is not a substitute for the plan' "$K"
# 3. a red gate routes to a fix or a RECORDED amendment — never silently, never onward
grep -qi 'never proceed to the tester on a red gate' "$K"
grep -qi 'recorded plan task' "$K"
# 4. the same rule is mirrored at Step 3j's union-diff simplify
awk '/^### Step 3j — /,/^#### 3j.1 /' "$K" | grep 'Verification (per phase)' >/dev/null
# 5. the cadence rule is INTACT and unchanged
grep -q 'exactly once per run' "$K"
grep -qF 'never per lane and never per sub-lane, at any depth' "$K"
# 6. SWEEP — no scripts / html scaffold / renderer change anywhere in this plan's diff
test -z "$(git diff --name-only HEAD -- "$S/scripts/" "$S/templates/html/")"
# 7. SWEEP — every cross-reference this plan touched resolves on disk
test -f "$S/references/config.md"
test -f "$S/references/artifact-format.md"
test -f "$S/templates/architect.md"
test -f "$S/templates/coder.md"
test -f plugins/my-skills/skills/product-manager/references/git-flow.md
test -f plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md
test -f plans/code-review/CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md
echo "phase 6 gate: OK"
```

**Aggregate gate (Phase 6's last task).** Run all five of the parent plan's phase gates *as amended* plus all six gates above in one batch and assert a single exit 0. A green aggregate is the only evidence that the parent plan's ACs 9, 11, 12, 14, 17 and 18 now have verification behind them.

**Path-conditional gate.** If — and only if — a phase's diff touches `plugins/my-skills/skills/orchestrator/scripts/**`, that phase must additionally run `node --test plugins/my-skills/skills/orchestrator/scripts/*.test.cjs` and assert exit 0. No phase in this plan is expected to touch that path; a phase that does has deviated from the CR and should stop and report rather than proceed.

G1 (coverage) and G6 (mutation) are **not** run here — they remain QA-only, and coverage is not measured outside `clean-code-gates` in this repo.

## Dependencies

`FEAT-20260807T030642Z-6077` is `DONE` and its diff is live in the working tree; this plan edits that state. `CR-20260807T035907Z-25d5` is the source review. No other plan blocks this one.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-07T05:15:07Z | CODER (FIX-20260807T050208Z-9ac2)

**Gate harness corrected — recorded, not relaxed.** Justification: `CR-20260807T045301Z-4659`
MF-1 (plus SF-2, SF-3, SF-5), implemented as named tasks in `FIX-20260807T050208Z-9ac2` Phase 1.
No prose in `plugins/**` was touched by this pass; only this plan's own gate blocks changed, and
no assertion's *claim* was weakened.

- **All eighteen `!`-inverted assertions** across the six gates, plus the one `{ ! grep …; }`
  brace-group variant at Phase 4 §6, rewritten to
  `if <presence-probe>; then echo "FAIL: …" >&2; exit 1; fi`. The `!` exempted each from `set -e`,
  so none could report failure. The brace-group form did abort correctly, but is normalized so
  these gates carry one form rather than two.
- **MF-1(b) — the two unsatisfiable-by-construction assertions rescoped.** Phase 1 §1's
  `amendment loop is evaluated first` check and Phase 4 §3's `Parent contract:` check asserted an
  old gate literal absent from the *whole* parent plan file, while item 3 of each simultaneously
  **requires** that file to record the same literal as the amendment's justification. Neither side
  could be deleted: the record is what keeps an amended gate from reading as a silently relaxed
  one, the absence assertion is what proves the amendment landed. Both now scope to the referenced
  gate block's **live (non-comment) assertion lines** via a `gate_body` helper. Comment-stripping
  is load-bearing for the Phase 4 case specifically — that literal sits at `FEAT-…:366`, a
  `#`-comment line *inside* the Phase 4 gate's own fence, which an awk range alone would not
  resolve. Both amendment records in the parent are untouched.
- **SF-2 — Phase 2 §2's tautology replaced.** `grep -q 'leaves=' "$K" && grep -qi 'parallel path' "$K"`
  is unavoidably true of any file that defines `leaves=` at all, so it was green before the
  emission sites existed. Replaced with the per-site claim
  `test "$(grep -c 'leaves=.*parallel path ONLY' "$K")" -eq 3`. Demonstrated: on a tree with one
  of the three spawn blocks regressed, the new assertion goes red and the old one stays green.
- **SF-3 — the piped-`grep -q` harness note corrected.** It claimed "**every** piped assertion in
  this plan's gates" already used `… | grep PATTERN >/dev/null` while Phase 3 §7 did not. That
  assertion was rewritten in the same pass, so the claim now holds; the overstatement is recorded
  above the note rather than quietly repaired.
- **SF-5 — the two conditionally-vacuous optional-item wrappers dropped** (Phase 1 §6, Phase 3 §8).
  Each guarded its body with a condition a regressed tree would simply fail, skipping the check
  silently. Both optional items were in fact taken, so both are now asserted unconditionally.

All six gates re-run after the sweep: **exit 0**, and now capable of exiting non-zero.

### 2026-08-07T04:53:01Z | REVIEWER

CR-20260807T045301Z-4659 created. Status: REQUEST_CHANGES. Must Fix: 4. Should Fix: 5.

### 2026-08-07T04:48:36Z | TESTER

TEST-20260807T043712Z-9b56 created. Status: BELOW_FLOOR. Coverage: N/A% → N/A%.

All eleven gates exit 0 **as written**; 3 of 11 are RED once a harness defect is corrected. Under
`set -euo pipefail` bash exempts a command from `set -e` when its value is inverted with `!`, so
all 31 `! grep -q …` assertions (14% of ~228) are no-ops — including the three the MF-1 ruling
leans on. Genuinely false: parent P1's `! grep -qiE '(minutes|hours|seconds)'` (config.md:211 says
"minutes"; this plan narrowed its own copy but not the parent's), and FIX P1/P4's `! grep -qF
"<old assertion literal>" "$P"`, which are unsatisfiable by construction because the same plan
requires that literal recorded as the amendment's justification.

Three prose defects the presence-checks cannot detect: **MF-8** — `SKILL.md:928`'s replacement
claim is false (reviewer.md gained an unlisted nesting bullet; "no role walks the contract tree" is
contradicted by `:926` two lines above and by tester/reviewer needing sub-contract rows that
`leaves=` cannot supply). **MF-4** — units declared but the accounts do not close: `A` charged
per-candidate vs slowest-of-`k`, `A` double-charged, interface points costed but absent from
`M_nested`; lanes `{12,6}` split `{6,6}` shows the ladder a 2-unit win while the gate rejects at
`4 > 6`. **MF-7** — `config.md:149`, under "rejected at contract-authoring time", says such a lane
"runs flat", the outcome `architect.md:162` forbids in bold.

Verified favourable: SIMPLIFY prose **not** reverted (`3j.4` absent, precedence sentence exactly
once at `:840`, both subsections conditional); all five parent amendments recorded with the CR ID
and lateral-or-stronger; both coder-reported harness defects independently confirmed (765-line vs
34-line awk range; SIGPIPE 141 above a ~32–64 KB producer). Parent plan's 24 piped `grep -q`
assertions confirmed un-rewritten and green only because its ranges are ≤ 11.8 KB.

Renderer 45/45, pairing and target-guard green. `gate-scope` / `gate-shell-injection` pre-existing
red at `974b01a` — not re-litigated.

### 2026-08-07T05:08:00Z | CODER

All 48 tasks complete. Plan status → DONE. Ready for reviewer.

All eight Must Fix items and all six Should Fix items implemented. Each phase's assertion set was
confirmed **red** before the prose that satisfies it, and the **aggregate batch — all five parent
gates as amended plus this plan's six, eleven gates — exits 0**, run twice for stability.

**Gate amendments, all recorded with `CR-20260807T035907Z-25d5` and this plan ID as justification,
inline at each assertion and in both plans' Progress Logs.** Five change what is asserted; four
correct assertions that were broken as written:

- **MF-1 / SF-6 / SF-3 / SF-5 / MF-3** — five parent-plan assertions amended to claim-based or
  updated forms. MF-3's is the notable one: `grep -q 'Parent contract:'` was green **because the
  routing was wrong**, asserting against text SIMPLIFY fix #6 had orphaned.
- **Four corrections to this plan's own gates**, none of which relaxes a claim:
  `awk '/^### Step 0r /…'` matched no start line (0r is a `####` sub-step) and was unsatisfiable;
  `awk '/^### Step 5 /,/^### Step 6 /'` ran to EOF (no `Step 6` heading exists);
  `! grep -qiE '\b(minutes|hours|seconds)\b'` could only pass by deleting the sentence that
  forbids wall-clock units, since that sentence names one; and `awk '/2p\.3n/,/2p\.4/'` spanned
  **746 lines** — over half the file — because both patterns recur and the range re-opens.
- **A harness defect** affecting every piped assertion: under `set -euo pipefail`,
  `awk … | grep -q` returns **141** when `grep -q` exits before `awk` finishes writing. Whether a
  gate goes red depends on where the match lands in the buffer, not on the claim. All 19 piped
  assertions rewritten to `… | grep PATTERN >/dev/null` — exit-status-identical, no early exit —
  with a harness note in `## Verification (per phase)`.

**No SIMPLIFY prose reverted**, per the CR's MF-1 ruling: `3j.4` stays deleted, the precedence
sentence still appears exactly once, and 0r's never-prompt simplification stands.

Sweep clean: `orchestrator/scripts/**` and `templates/html/**` untouched, no renderer or scaffold
change, no `.md`/`.html` parity work, every cross-reference resolves on disk.

### 2026-08-07T04:15:59Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-07T04:08:56Z | ARCHITECT

Plan `FIX-20260807T040856Z-bf97` created. Type: fix. Tasks: 48.
Status: PLANNED. Ready for coder.
