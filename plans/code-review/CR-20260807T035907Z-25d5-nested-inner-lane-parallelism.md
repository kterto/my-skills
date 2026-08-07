---
id: CR-20260807T035907Z-25d5
plan: FEAT-20260807T030642Z-6077
title: Review of Nested inner-lane parallelism — redefining the orchestrator's `full` level
status: REQUEST_CHANGES
created_at: 2026-08-07T03:59:07Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 8
should_fix_count: 6
---

**Related:** [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md) · [TEST-20260807T035031Z-230c](../test/TEST-20260807T035031Z-230c-nested-inner-lane-parallelism.md)

## Summary

Reviewed the working-tree diff for this plan — 10 files (9 markdown + `config.template.json`) under `plugins/my-skills/skills/{orchestrator,product-manager}/`, zero executable lines, `scripts/**` and `templates/html/**` untouched. The doc-authoring work itself is strong: the leaf abstraction is clean, the containment rule and its two-local-checks justification are genuinely load-bearing and correctly placed in the single normative rejection list, backward compatibility is stated and structurally defensible, and `config.template.json` deep-equals the canonical default object.

The blockers are almost all **prose/dispatch drift introduced by the mandatory SIMPLIFY pass**, which re-ran the renderer suite but not the plan's own five phase gates — the only gate covering this diff. Three of them are the classic "specified but never dispatched" shape that requirement 53 and `SKILL.md` Rules line 1222 exist to forbid, i.e. the exact defect that made the previous `full` a no-op, reintroduced. Two more are design defects in the marginal-gain gate that the SIMPLIFY pass correctly refused to decide and routed here.

Verdict: **REQUEST_CHANGES**. Every Must Fix is a bounded prose edit or a recorded gate amendment; none requires re-architecting the feature.

## Rulings on the escalated forks

Recorded here because the orchestrator asked for a verdict, not deference. Each ruling is implemented by the Must Fix / Should Fix item named after it.

**1. Phase 3 gate red on 3 assertions — reword the prose, or amend the assertions?**
**Ruling: amend the assertions. Do not revert the prose.** The SIMPLIFY pass's output is better on both counts and the assertions over-specified their requirements. Deleting `3j.4` removed a dangling reference to "requirement 53" — a spec number that exists nowhere in the shipped skill, so a downstream reader could never resolve it; the authoring rule survives intact at `SKILL.md:1222`. Hoisting the precedence rule out of `3j.1`/`3j.2` into one blockquote at the point where classification actually happens (`SKILL.md:811`) is what this project's own single-source-of-truth convention requires, and the plan's own Technical Notes forbid duplicating a rule into two places. Requirement 55's real demand is *"neither subsection may still describe itself as firing unconditionally"* — and neither does: both now open *"Reached for the leaves Step 3j's classification routed here."* The assertions pinned sentence-exact wording to a *location*, which is a proxy for the requirement, not the requirement. See **MF-1**.

**2(i). Gain/cost not computable in its own units.** **Ruling: agreed, and it blocks.** This is the feature's decision function; a comparison with no defined evaluation is not a gate. See **MF-4**.

**2(ii). Inner join is not early reconciliation.** **Ruling: split.** The *sequencing* is spec-mandated (SPEC requirement 45: "running after the leaf barrier and before Step 3j") and re-sequencing the joins is a design change beyond this plan — I am not requiring it here. But two things inside this diff are wrong and do block: `M_nested` prices `k` inner joins as undifferentiated "fixed overhead" when Step 3s serializes them on the critical path, so the number shown to the user at the `ask` ladder understates the nested plan; and `SKILL.md:770`'s justification for the global barrier contradicts the containment proof the same document relies on at 3L. See **MF-5**. Whether 3s should reconcile per-lane as soon as that lane's sub-lanes return is a **spec-level follow-up**, recorded in *Follow-ups* below.

**2(iii). Step 2s's second global barrier.** **Ruling: not a blocker.** Spec requirement 41 mandates "all of Step 2s, then all of Step 2L, then all of Step 3L", the recoverability argument holds unchanged (nothing is written to the workspace at either barrier), and the cost is one architect pass — real but bounded, and correctly charged on the cost side. Recorded as **SF-1** and as a spec follow-up, not as a change to this plan.

**3. `templates/{qa,reviewer,tester}.md` in scope?** **Ruling: two of three, yes; one, no.** `qa.md:42` and `reviewer.md:31` each described the dropped per-lane tester/reviewer rung as **live behavior**, so removing them is squarely AC 1 / requirement 3 ("no file anywhere in the repo") and squarely the Phase 5 sweep. `tester.md` is different: neither line it changed stated the old `full` meaning. Its edits are new nesting behavior added by the SIMPLIFY pass (`leaves=`, and "include the rows of every adopted sub-contract"). That is not scope creep worth blocking on its own — it is a reasonable consequence of the redefinition — but it falsifies a sentence this diff also ships. See **MF-8**.

**4. `gate-scope` / `gate-shell-injection` pre-existing red.** **Confirmed independently.** `gate-scope.test.cjs` fails at HEAD with the same `MODULE_NOT_FOUND` signature the tester recorded at merge-base `974b01a`; this plan touches zero files under `scripts/`. **Out of scope.** `render-artifact.test.cjs` is 45/45 green. The root cause is this repo's own stale `.orchestrator/` materialization, resolved by the next bootstrap — also out of scope.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `full` redefined; no file retains the shipped per-lane meaning | ✅ | Repo-wide sweep clean; only `previously`-marked historical mentions survive, as requirement 65 demands. |
| 2 | `sublanes` + `max_parallel_lanes` documented, all four surfaces agree | ✅ | Keys table, default object, CLI-args table, absent-key paragraph verified consistent. |
| 3 | Lane grammar inlined with keep-in-sync marker; every rule in a B3-materialized file | ✅ | B3 copies both `references/config.md` and `references/artifact-format.md` (`SKILL.md:49–50`). |
| 4 | Containment as a case in the **single** rejection list, with what it buys | ✅ | `config.md:141,145–147`. Well done — the "two local checks, not an n-way check" framing is the strongest part of the diff. |
| 5 | `span`/`makespan`/`M_flat`/`M_nested`/marginal gain/cost/greedy/aggregate/ceiling defined | ❌ | Definitions present but the adoption test is not evaluable (**MF-4**) and `M_nested` misprices serialized inner joins (**MF-5**). |
| 6 | Sub-contract as a `PACT`; `related_to` both edges; Inherited region + its reason | ✅ | `artifact-format.md:109–143`. |
| 7 | One-level walk; leaf-set `DONE` check; absent column = all-flat | ✅ | `artifact-format.md:158–180`. Grammar nit at line 171 — **SF-5**. |
| 8 | 2s/3s stdout rows; `LANES —` at leaf granularity; pre-existing rows byte-unchanged | ✅ | Byte-exact preservation assertions green. |
| 9 | Numbered 2s/3s; leaf-granularity 2L; flat 3L; no level-specific behavior only in a join/ladder | ⚠️ | Substance present, but the gate that proves it is red (**MF-1**) and `leaves=` reproduces the no-dispatch-point shape (**MF-2**). |
| 10 | Every added spawn pre-generates its ID; 2s the sole sub-lane allocation site | ✅ | `SKILL.md:637–646`; failure mode correctly restated. |
| 11 | Halt/amend precedence stated where both are specified | ⚠️ | Substantively satisfied at `SKILL.md:811`; gate assertion red (**MF-1**). |
| 12 | `PARTIAL` resume: detection, opt-in, hint, skip list, leaf rebuild, re-entry, `RESUME —` | ❌ | Mechanism is sound and the never-prompt simplification is an improvement, but two stale references to a confirmation that no longer exists (**MF-6**). |
| 13 | `full` → `lanes` degradation; two gates composed, never conflated; option 3 omitted with reason | ✅ | `config.md:55–60`, `SKILL.md:485–522`. |
| 14 | architect Step 3C extends (not forks) for sub-contracts; coder spellings correct at both depths | ❌ | Coder side correct. Architect Step 3C routes on inputs the orchestrator never sends (**MF-3**), and its degradation outcome is unexecutable (**MF-7**). |
| 15 | `config.template.json` ≡ canonical default object | ✅ | Verified programmatically: key order and values deep-equal. |
| 16 | `off` byte-identical; `lanes` behaviorally unchanged | ✅ | 0r correctly gated below 0b. Minor skip-list drift — **SF-3**. |
| 17 | PM guard verified, not assumed; bounded docs-only remedy | ❌ | Ladder text correct; the resume paragraph documents a prompt that does not exist (**MF-6**). |
| 18 | Every new cross-reference resolves; no parity/renderer/scaffold work | ⚠️ | No renderer or parity work — confirmed. One cross-reference points at the wrong step (**MF-7**). |

## Must Fix (Blockers)

### MF-1 — Phase 3 gate is red against the tree it gates; amend the three assertions

**File**: `plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md:292,294,295`
**Problem**: The plan's Phase 3 gate is the *only* verification covering this diff, and its exit criterion is "every assertion in the phase's set exits 0". Three assertions are red, independently confirmed:

- `grep -qi 'no level-specific behavior may be specified only inside a join step'` → 0 hits (rule survives reworded at `SKILL.md:1222`).
- `awk '/^#### 3j.1 /,/^#### 3j.2 /' | grep -q 'amendment loop is evaluated first'` → 0 hits.
- `awk '/^#### 3j.2 /,/^#### 3j.3 /' | grep -q 'amendment loop is evaluated first'` → 0 hits (rule hoisted to `SKILL.md:811`).

AC 9 and AC 11 therefore have no green verification, even though both are substantively satisfied. Leaving a red gate on a DONE plan means the next reader cannot tell a wording drift from a lost rule.

**Fix**: Amend the three assertions to be **claim-based rather than sentence-exact**, and record the amendment as an explicit plan task so it can never read as a silently relaxed gate (the plan forbids exactly that). Suggested replacements:

```bash
# req-53 authoring rule survives somewhere normative in SKILL.md (Rules is fine)
grep -qi 'level-specific behavior only in a join step' "$K"
# precedence is stated ONCE, in Step 3j's body, ahead of both subsections
awk '/^### Step 3j — /,/^#### 3j.1 /' "$K" | grep -q 'amendment loop (3j.2), evaluated \*\*first\*\*'
# and neither subsection describes itself as firing unconditionally
awk '/^#### 3j.1 /,/^#### 3j.2 /' "$K" | grep -q "Step 3j's classification routed here"
awk '/^#### 3j.2 /,/^#### 3j.3 /' "$K" | grep -q "Step 3j's classification routed here"
```

Do **not** re-duplicate the precedence sentence back into `3j.1`/`3j.2`, and do not resurrect `3j.4` — see the ruling above.

---

### MF-2 — `leaves=` is declared in the mandatory preamble but emitted by no spawn

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:142,150`
**Problem**: The *"Mandatory role-prompt preamble (every spawn)"* block declares `leaves={FEAT-a},{FEAT-b},…` for "join-level spawns ONLY (tester/reviewer/qa)", and all three role templates were rewritten to consume it (`tester.md`, `reviewer.md`, `qa.md`: *"When your preamble carries a `leaves=` line, that is the leaf plan set — use it as given."*). But the three join-level spawn prompt blocks — Step 3b (`SKILL.md:905–914`), Step 4 (`SKILL.md:958–966`), Step 5 (`SKILL.md:1061–1069`) — are byte-unchanged and **contain no `leaves=` line**. `grep -n 'leaves=' SKILL.md` returns exactly two hits, both in the preamble *definition*.

So the line is never emitted, all three roles always take the documented fallback, and SIMPLIFY fix #7's entire claimed saving (3×(1+k) redundant contract reads per role, repeated on every review cycle up to 10 and QA cycle up to 5) is never realized. This is precisely the shape `SKILL.md:1222` forbids — *"Never specify a level-specific behavior only in a join step or in ladder option text — every one needs a numbered dispatch step"* — and it is the same defect that made the previous `full` a no-op, reintroduced one commit later by the pass that was supposed to clean the diff up.

**Fix**: Add the `leaves=` line to the three spawn prompt blocks at Steps 3b, 4, and 5, gated on the parallel path (omit on an `off` run, like `lane=`/`contract=`), e.g.:

```
ID to use: {computed TEST-<id>}
leaves={comma-separated leaf FEAT IDs, in dispatch order}   ← parallel path ONLY; omit on a sequential run
```

Also state at Step 0r that a **resumed** run holds the rebuilt leaf set too (0r step 3 already rebuilds it), so `leaves=` is present there as well and the templates' "resumed run" fallback narrows to legacy runs only. Alternatively, if the optimization is judged not worth wiring, delete `leaves=` from the preamble and from all three templates — but do not ship it half-wired.

---

### MF-3 — architect Step 3C routes the sub-contract case on inputs the orchestrator never sends

**File**: `plugins/my-skills/skills/orchestrator/templates/architect.md:149`
**Problem**: Step 3C's *"Which case you are in"* table selects the sub-contract case on:

```
| `Type: contract` + a spec path + **`Parent contract:`** + **`Lane:`** | that lane's **sub-contract** | … |
```

But SIMPLIFY fix #6 moved level detection to the preamble, and `SKILL.md` Step 2s.2's prompt body (`SKILL.md:656–670`) carries **no** `Parent contract:` line and **no** `Lane:` line — only `Source spec:`, `Type: contract`, `Sub-lane plan IDs to use:`, the metadata envelope and the digest, with `lane=` / `contract=` in the preamble. `grep -rn 'Parent contract:'` across the skill returns exactly one hit: this table. Nothing emits it.

An architect executing Step 3C for a sub-contract therefore matches the **first** row (`Type: contract` + a spec path) and authors a **second parent contract** — cross-lane rows for the whole run, no `Inherited interface assignments` region, no containment applied. 2s.3's verification would catch the missing region and stop the run after one retry, so the failure is loud rather than silent, but the feature cannot complete a nested run as written.

The same drift is why the Phase 4 gate's `grep -q 'Parent contract:' "$AR"` still passes: it is asserting against the stale text.

**Fix**: Rewrite the table's second row to key on the preamble, matching the (already-correct) Inputs paragraph at `architect.md:19`:

```markdown
| `Type: contract` + a spec path + a **non-empty `lane=`** in the preamble (`contract=` names the parent) | that lane's **sub-contract** | that lane's **sub-lanes** | **intra-lane** rows |
```

and update the Phase 4 gate assertion from `grep -q 'Parent contract:'` to a preamble-based claim (e.g. `awk '/^## Step 3C /,/^## Step 3L /' "$AR" | grep -q 'non-empty \`lane=\`'`).

---

### MF-4 — the gain/cost adoption test is not computable in the units it is written in

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:174–208`
**Problem**: The gate that decides whether the entire feature engages compares two quantities in incompatible units, with no stated conversion:

- **gain** is a makespan delta, and `makespan` is itself already unit-mixed — *"`max` over all lanes `L` of `span(L)`, **plus the fixed overhead** (every contract-authoring pass plus every join pass)"* — i.e. task counts plus agent passes.
- **cost** is *"one sub-contract architect pass (Step 2s), one inner-join pass (Step 3s), the sub-contract's interface-point count, as reconciliation units"* — i.e. two agent passes plus a table row count.
- The adoption rule is *"adopted **only when its marginal gain exceeds that cost**. Equal is not enough."*

`g > c` has no defined evaluation. Step 2p.3n prints `sub-split rejected: lane {name} — gain {g} does not exceed cost {c}` — two bare numbers whose units are never stated — and 2p.5 shows the user `M_nested` derived from the same arithmetic. An executing agent will invent a conversion, silently and differently on each run, under an `Assumption:` line that discloses only *"task counts proxy wall-clock effort equally"* and says nothing about passes or interface points. Two identical runs will adopt different nested plans.

This directly defeats the stated purpose of the block: *"the whole point of the gate is that the cost is visible, not hidden."* An invented conversion is hidden cost.

**Fix**: Declare **one unit — task-equivalents — and convert everything into it** in `references/config.md` → *The makespan model*, before any formula uses it. For example:

```markdown
**Everything below is denominated in task-equivalents.** Three fixed conversions, stated
here so no executing agent invents its own:

- one **contract-authoring architect pass** = `A` task-equivalents (default `A = 2`)
- one **join pass** = `J` task-equivalents (default `J = 2`)
- one **interface point** = `1` task-equivalent (one reconciliation unit)

`span`, `makespan`, `M_flat`, `M_nested`, every marginal gain, and every cost are computed
in this single unit, so `g > c` is ordinary arithmetic. Print both `{g}` and `{c}` with the
unit named: `gain 4 task-equivalents does not exceed cost 5 task-equivalents`.
```

Then restate the assumption line to cover the conversion, not just concurrency, and extend the 2p.3n printed vocabulary to name the unit.

---

### MF-5 — `M_nested` underprices the inner joins, and the barrier's stated justification contradicts the containment proof

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:178` and `plugins/my-skills/skills/orchestrator/SKILL.md:770`
**Problem**: Two related defects in the number the user is shown at the `ask` ladder.

*(a) Mispricing.* `makespan` adds *"the fixed overhead (every contract-authoring pass plus every join pass)"* as one undifferentiated term. But the two levels have opposite shapes in the shipped design: Step 2s spawns its `k` architects **concurrently** (`SKILL.md:648` — "All spawns issued together"), so `k` sub-contract passes cost **slowest-of-k**; Step 3s runs its `k` inner joins **serially** (`SKILL.md:772` — "for each sub-split lane, in a deterministic order") **after a global leaf barrier**, so `k` inner joins cost **sum-of-k**, entirely on the critical path. Summing both as flat overhead makes `M_nested` optimistic by roughly `(k − 1) × J`. Since `M_nested` is what option 3 of the ladder shows the user, and since `full`'s whole claim is wall-clock, a systematically optimistic number is a real defect in a decision input — not a rounding concern.

*(b) False justification.* `SKILL.md:770` justifies the global barrier as: *"Wait for **every** in-flight leaf subagent — across all lanes, not just this lane's — to return before beginning any inner join. The leaves share one workspace, so the barrier is what makes each inner join's inputs whole."* That reason is refuted by this same diff's containment proof: `config.md:145–147` establishes that a lane's sub-lane globs strictly partition that lane's globs and lane globs are mutually disjoint, so **no other lane's leaves can touch the paths a given inner join reconciles**. `SKILL.md:736` leans on exactly that argument to justify flat dispatch at 3L. The barrier may still be worth having (deterministic ordering, one simple state machine), but not for the reason given, and a load-bearing rationale that its own document disproves is the kind a future editor will correctly delete along with the barrier.

**Fix**:
1. In `config.md` → *The makespan model*, split the overhead term and state each level's shape explicitly, e.g. *"contract-authoring passes at one level run concurrently and cost slowest-of-k; inner-join passes are serialized after the leaf barrier and cost the **sum** of k."* Fold the same distinction into the cost side so a `k`-way plan is charged `k × J`, not `J`.
2. Replace the `SKILL.md:770` justification with the honest one — the barrier buys a single deterministic reconciliation order and one join state machine, **not** input wholeness, which containment already guarantees — and note that early per-lane inner joins are safe by containment but deliberately not taken at this depth (see *Follow-ups*).

---

### MF-6 — a resume confirmation is documented in two places but no longer exists

**File**: `plugins/my-skills/skills/product-manager/references/git-flow.md:67` and `plugins/my-skills/skills/orchestrator/SKILL.md:1212`
**Problem**: SIMPLIFY fix #1 removed Step 0r's confirmation prompt entirely. `SKILL.md:288` is now unambiguous: *"**Resume is opt-in and never prompts.** Two outcomes, no third"* — `--resume` passed, or hint + fresh run. Two documents still describe the removed prompt:

- `git-flow.md:67` — *"it applies only via an explicit `--resume` argument **or a manual-mode confirmation** … on a default-`manual` project **the confirmation** — like the Step 2p ladder — **can surface inside a PM-driven run**. If it appears, **PM answers 'start fresh'**."* This is the cross-skill mirror AC 17 required to be *verified, not assumed*, and it now asserts an orchestrator behavior the orchestrator explicitly denies. A PM reader is told to prepare an answer for a question that will never be asked.
- `SKILL.md:1212` — *"Never prompt a non-interactive caller — see Step 2p.4 (the ladder) and Step 0r (**the resume confirmation**)."*

**Fix**: Rewrite `git-flow.md`'s Step 0r paragraph to the actual two-outcome shape — the orchestrator never prompts for resume at all, PM passes no `--resume`, so a PM-driven run **always** gets the non-blocking hint and starts fresh; PM's guarantee is structural, not an answer it has to give. Change `SKILL.md:1212` to *"Step 0r (resume opt-in, which never prompts at all)"*. Note the design change itself is **accepted** — making the never-block guarantee structural rather than guarded is strictly better than what AC 12 specified; only the stale references block.

---

### MF-7 — the architect's sub-lane refusal path has no executable outcome, and cites the wrong step

**File**: `plugins/my-skills/skills/orchestrator/templates/architect.md` (Sub-contract deltas, item 2)
**Problem**: The template tells the sub-contract architect: *"if that leaves fewer than 2 sub-lanes carrying work, **stop and report the split as non-viable** rather than writing a one-sub-lane sub-contract. That report is **not a run failure** — the orchestrator's outcome for it is that this lane is simply **not sub-split and runs flat** (`SKILL.md` → Step 0c)."*

Neither half holds:

1. **The orchestrator cannot run that lane flat at this point.** Step 2s.3 (`SKILL.md:683,690`) says a missing or region-incomplete sub-contract is *"re-invoke[d] once … then stop and report"* — a hard halt, not a graceful demotion. And it could not demote even if it wanted to: Step 2c already froze the parent contract with that lane's `Lane plan ID` cell as `—` and its `Sub-contract` cell naming a child that will never exist (`SKILL.md:625`), so running it flat requires re-authoring the frozen parent. The architect is told its refusal is recoverable when the pipeline treats it as fatal.
2. **The cross-reference is wrong.** Step 0c is *lane taxonomy resolution*, which runs before Step 2p and handles a **config-validation** drop of a declared sub-lane. It says nothing about, and cannot act on, an architect's mid-run refusal at Step 2s.

**Fix**: Pick one and make both documents agree.
- *Preferred:* move the <2-viable-sub-lanes decision **into the 2p.3n gate**, where it can still leave the lane flat before the parent contract is frozen — the gate already re-applies "at least 2 sub-lanes carry work" as condition 1 (`config.md:228`) — and change the architect's instruction to *"a lane reaching you has already cleared that condition; if you nevertheless cannot give 2+ sub-lanes bounded, contained, disjoint globs, stop and report — this halts the run at 2s.3, it does not degrade to flat."*
- *Or:* give Step 2s.3 a real demotion path (re-author the parent contract's row, allocate a lane-level `FEAT` ID, continue flat) and document it there.

Either way, delete the `SKILL.md` → Step 0c cross-reference and point at whichever step actually owns the outcome.

---

### MF-8 — `SKILL.md` claims the three join role templates are unchanged; all three changed in this diff

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:895`
**Problem**: Step 3j.3 states: *"These three roles need no knowledge of nesting beyond that one rule, and **their templates are unchanged**."* In this same diff `templates/tester.md`, `templates/reviewer.md`, and `templates/qa.md` all changed, and `tester.md` gained a genuinely nesting-specific instruction — *"Include the rows of every adopted **sub-contract** alongside the parent's"* — which is knowledge of nesting beyond the `PACT` ID resolution rule. `reviewer.md` likewise gained an *Inherited interface assignments* lookup. The sentence is the justification for the design ("three copies would be three places to disagree"), so shipping it false undercuts the argument it is making.

**Fix**: Replace with what is actually true, e.g.: *"Beyond that one rule these three roles need no knowledge of nesting: their templates changed only to name the outer join, to accept the pre-resolved `leaves=` set, and — for the tester — to fold sub-contract interface rows into its existing critical-flow triage input. No role walks the contract tree, and none has a per-lane or per-sub-lane pass."*

---

## Should Fix (Warnings)

### SF-1 — Step 2s's global barrier stalls unsplit lanes' architects on sub-contracts they do not depend on

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:715`
**Problem**: The barrier paragraph extends the discipline to *"all of Step 2s, then all of Step 2L, then all of Step 3L"*, so an **unsplit** lane's leaf architect waits on `k` sub-contracts whose content it will never read. `full` pays three serial architect round-trips where `lanes` pays two, and the added one is slowest-of-k. The stated justification ("nothing has been written to the workspace yet") is what makes the barrier *recoverable*, but it does not require serializing 2s ahead of unsplit lanes' 2L — no workspace write happens in either case.
**Fix**: Spec requirement 41 mandates the current sequence, so leave it. Add one sentence acknowledging the cost honestly — *"an unsplit lane's architect could in principle be issued concurrently with 2s; it is not, so that the whole plan set is verified against one frozen contract tree before any of it is trusted"* — and record the optimization as a follow-up. Also fold the extra architect pass into MF-4's cost model so `full` is charged for it.

### SF-2 — "the only place the key is enforced" contradicts the next sentence

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:734`
**Problem**: *"This is the only place the key is enforced … The same rule applies verbatim to Step 2L's architect dispatch."* Two enforcement sites, described as one. `config.md:254` correctly says "Steps 2L and 3L issue the leaf set in waves", but Step 2L's own body never mentions waves at all — a reader working forward through the document hits 2L's dispatch with no ceiling in sight. Separately, Step 2s's `k`-wide concurrent architect fan-out is bounded by nothing.
**Fix**: Change to *"Enforced here and at Step 2L, which is what makes it bind in both modes and at both depths"*, add the one-line wave rule to Step 2L's body, and state explicitly whether 2s's fan-out is in or out of the ceiling.

### SF-3 — the `off` skip lists disagree across three files

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:31`
**Problem**: `config.md`'s `parallelism` table says *"Steps 2p/2c/2s/2L/3L/3s/3j do not exist for the run"* — omitting **0c**, which `SKILL.md:274` includes. Neither list mentions **0r**, which is also `off`-gated. Both Phase 1 and Phase 5 gates assert these strings byte-exactly, so the drift is locked in.
**Fix**: Make all skip lists read `0c, 0r, 2p, 2c, 2s, 2L, 3L, 3s, 3j` and update the two gate assertions in the same change.

### SF-4 — architect Step 3L still triggers on body lines while 3L.p makes the preamble authoritative

**File**: `plugins/my-skills/skills/orchestrator/templates/architect.md` (Step 3L heading and Inputs)
**Problem**: *"Lane-plan mode (type `feat` with a `Lane:` line)"* / *"Runs when a `feat` invocation carries a `Lane:` name and a `Contract:` path."* Step 2L's prompt (`SKILL.md:711`) sends only preamble `lane=` / `contract=` lines. This predates the plan, but the plan's own new 3L.p states *"A role never infers its lane, its governing contract, or its depth from a path, a plan ID, or plan prose"* — so the diff now contradicts text it left standing, and it is the same root cause as MF-3.
**Fix**: Re-key Step 3L on the preamble in the same pass as MF-3, so both levels use one channel.

### SF-5 — "never as an error" is ungrammatical, and it is a gate-string artifact

**File**: `plugins/my-skills/skills/orchestrator/references/artifact-format.md:171`
**Problem**: *"An absent column is **never as an error**."* Also at `config.md:298`. The phrasing exists because the Phase 2 and Phase 5 gates assert the literal substring `never as an error`; the prose was bent to fit the pattern rather than the pattern to the prose.
**Fix**: *"An absent column is **never an error**."* and relax the assertions to `grep -q 'never an error'`.

### SF-6 — three weak assertions in the phase gates

**File**: `plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md:290,381`
**Problem**: Confirming the tester's audit. `awk '/^### Step 3s /,/^### Step 3j /' | grep -q 'parent'` is tautological — the word is unavoidable in that section. `! grep -q 'passes --resume' "$PM/references/git-flow.md"` is vacuous: the file says *"PM passes no `--resume` flag"*, which the pattern was never going to match either way, so it proves nothing. Both were green before any prose existed.
**Fix**: Replace the first with the actual claim (`grep -q "Mark the lane DONE in the \*parent\* contract"`), and the second with a positive assertion of what PM does (`grep -q 'PM passes no .--resume. flag'`).

---

## Follow-ups (not blockers — spec-level, for a future cycle)

Recorded so the escalated design questions are not lost by being ruled out-of-scope here:

1. **Early per-lane inner joins.** SPEC requirement 45 mandates 3s after a global leaf barrier. The containment proof shows a lane's inner-join inputs are whole as soon as **its own** sub-lanes return, so inner joins could run concurrently with still-running leaves elsewhere, converting `k` serialized passes into overlapped ones. This is the single largest wall-clock item in the feature and deserves its own spec.
2. **Concurrent 2s / unsplit-lane 2L.** See SF-1; requires amending SPEC requirement 41's barrier discipline.
3. **A contract-node abstraction.** The SIMPLIFY pass's observation stands: Steps 2s/3s are a depth-2 copy of 2c/3j, and the text says so itself. A contract-node abstraction would let one 2c and one 3j serve both depths and would stop the depth-2 cap being enumerated in step numbers. Correctly out of scope for a plan whose ACs are written in terms of numbered steps 2s and 3s.
4. **Materialize `roadmap/references/config.md` at B3** instead of inlining ~18 lines of injection-defense grammar into `orchestrator/references/config.md`. Requirement 68 forced the inlining; the cheaper long-run fix is one more B3 copy line. Two copies of a security grammar with a "keep in sync" comment is a drift hazard by construction.
5. **This repo's own `.orchestrator/` is stale** — `artifact-format.md` has diverged and `config.md` was never tracked, which is why `gate-scope.test.cjs` and `gate-shell-injection.test.cjs` are red at merge-base and HEAD. Pre-existing, unrelated to this plan, resolved by the next bootstrap.

## Verdict

**Status**: REQUEST_CHANGES

Eight blockers: three "specified but never dispatched" defects that reproduce the exact no-op shape this feature exists to fix (MF-2, MF-3, and the red gate MF-1), two real defects in the marginal-gain gate that make its adoption decision unevaluable and its user-facing number optimistic (MF-4, MF-5), and three documents asserting behavior the pipeline does not have (MF-6, MF-7, MF-8). Every fix is a bounded prose edit or a recorded gate amendment — the design is sound and no re-architecture is required.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair.
