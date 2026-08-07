---
id: CR-20260807T045301Z-4659
plan: FIX-20260807T040856Z-bf97
title: Review of Nested inner-lane parallelism — CR-25d5 remediation
status: REQUEST_CHANGES
created_at: 2026-08-07T04:53:01Z
reviewer: reviewer-agent
cycle: 2
must_fix_count: 4
should_fix_count: 5
---

**Related:** [FIX-20260807T040856Z-bf97](./FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md) · [CR-20260807T035907Z-25d5](./CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md) · [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md) · [TEST-20260807T043712Z-9b56](../test/TEST-20260807T043712Z-9b56-nested-parallelism-cr-remediation.md)

## Summary

Reviewed the full uncommitted prose diff (10 files, 823 insertions / 140 deletions) against this plan's ten acceptance criteria, `CR-20260807T035907Z-25d5`'s eight Must Fix items, and `PROJECT-CONTEXT.md`'s invariants. Five of the eight blockers — MF-1, MF-2, MF-3, MF-5(b), MF-6 — are genuinely and cleanly closed, verified against the live tree rather than against the plan's own claims. The core ruling was honoured: the SIMPLIFY prose was not reverted (`#### 3j.4` absent, the precedence sentence appears exactly once), and all five parent-plan gate amendments carry the CR ID inline and are lateral-or-stronger.

Three blockers are not closed, and a fourth defect was introduced by the remediation itself. I independently reproduced every one of the tester's four findings and rule all four in scope: **all four are Must Fix.** The unifying problem is that this plan's deliverable is a set of *gates* and a set of *claims*, and both classes shipped with defects the other class was supposed to catch — 14% of the assertions cannot report failure, and three of the prose claims the assertions do cover are false in ways a presence check is structurally unable to detect.

Verdict: **REQUEST_CHANGES**. The remaining work is bounded — a mechanical sweep of one shell idiom, one arithmetic reconciliation in `references/config.md`, and two sentence-level sweeps that the plan's own "sweep the definition's consumers" discipline should already have caught.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | MF-1 — three brittle Phase-3 assertions amended claim-based, SIMPLIFY prose not reverted, amendment recorded | ✅ | Verified directly, not via gate: `#### 3j.4` = 0 hits; precedence sentence count = exactly 1 (`SKILL.md:840`); both 3j.1 and 3j.2 open conditionally. Amendments recorded at `FEAT-…:243,293,300,308,353,410,435` with the CR ID. |
| 2 | MF-2 — `leaves=` emitted by every join-level spawn, Step 0r covered, fallback narrowed to legacy | ✅ | 10 `leaves=` hits (> the 2 definition-only). Emitted in the Step 3b (`:944`), Step 4 (`:999`), Step 5 (`:1105`) prompt blocks with identical gating prose; resumed-run coverage at `:311`; fallback narrowed to legacy at `:150`. |
| 3 | MF-3 — Step 3C routes on non-empty `lane=` in the preamble; no `Parent contract:` body-line routing anywhere | ✅ | `grep -rn 'Parent contract:'` over the skill returns **zero** hits. `architect.md` Step 3C row 2 keys on "a **non-empty `lane=`** in the preamble (`contract=` names the parent contract)", with an explicit rationale for why a body-line key would silently author a second parent contract. |
| 4 | MF-4 — one declared unit + fixed conversions so `g > c` is ordinary arithmetic; unit named at 2p.3n and 2p.5 | ❌ | The unit half is real and well done. The arithmetic does not close: the gate's `c` and the ladder's `M_nested` are computed from mutually inconsistent overhead accounts. Reproduced — see **MF-2** below. |
| 5 | MF-5 — overhead split by shape (concurrent-`A` / serialized-`k × J`), cost side charges `k × J`; barrier justification replaced | ⚠️ | (b) fully met — `Step 3s` now names "a single deterministic reconciliation order and one join state machine — **not** input wholeness", credits containment, and adds the early-per-lane-join follow-up note. (a) half met — the split and `k × J` are correct, but the reciprocal was never applied to `A` and interface points never reached `M_nested`. Folded into **MF-2**. |
| 6 | MF-6 — no document describes a resume confirmation that no longer exists | ✅ | `SKILL.md:1254` now reads "Step 0r (resume opt-in, which never prompts at all) … 0r's guarantee is structural — there is no question to gate". `git-flow.md`'s new paragraph states the two-outcome shape, "PM passes no `--resume` flag", and the structural guarantee, within AC 17's one-paragraph bound. |
| 7 | MF-7 — `<2-viable-sub-lanes` has exactly one owner and the documents agree | ❌ | `SKILL.md` and `architect.md` do agree. `references/config.md:149` — the **normative** file — asserts the exact outcome `architect.md:162` forbids in bold. See **MF-4** below. |
| 8 | MF-8 — 3j.3 states what is true about the three join templates | ❌ | The false claim was replaced with a different false claim, contradicted two lines above it in the same diff. See **MF-3** below. |
| 9 | Systemic — Step 3 and Step 3j both mandate re-running the plan's own per-phase gates; suite is not a substitute; red routes to fix or recorded amendment | ✅ | Present and correctly worded at both sites, including "**Whatever executable test suite happens to exist in the repo is not a substitute for the plan's phase gates**" and the explicit two-outcome red routing. Its *value*, however, is bounded by **MF-1**. |
| 10 | No regression — all eleven gates exit 0 as one aggregate batch; scripts/html untouched; cross-references resolve | ❌ | I re-ran all eleven from a clean extraction: **11/11 exit 0 as written**. With the `!` exemption corrected, **3 are red** — and two of those three are unsatisfiable by construction. `scripts/**` and `templates/html/**` diff is empty (verified); every `test -f` cross-reference resolves. |

## Must Fix (Blockers)

### MF-1 — `!` exempts a command from `set -e`: 31 of 228 assertions cannot fail, and 3 are genuinely false

**File**: `plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md` (Phase 1/3/4/5 gates) and `plans/code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md` (Phase 1–5 gates)

**Problem**: Bash exempts a command from `set -e` when its return value is inverted with `!`. Reproduced:

```bash
$ printf 'set -euo pipefail\n! true\necho REACHED\n' > t.sh && bash t.sh; echo "rc=$?"
REACHED
rc=0
```

Every `! grep …` assertion in both plans is therefore a no-op: it can report false and the gate still prints `OK` and exits 0. I extracted all eleven gate blocks programmatically and evaluated each negated assertion in isolation under `/usr/bin/grep`. The counts match the tester's exactly — **31 negated assertions across 9 of the 11 gates** (parent P1/P3/P4/P5 = 3/3/2/5; FIX P1/P2/P3/P4/P5 = 3/4/4/5/2). **28 hold. 3 do not:**

| Gate | Assertion | Why it is false |
|---|---|---|
| parent P1 | `! grep -qiE '(minutes\|hours\|seconds)' "$C"` | `references/config.md:211` reads *"…minutes would be fabricated precision."* This plan diagnosed exactly this and narrowed **its own** copy (FIX P3, recorded as an amendment) but left the parent's blanket copy unamended. Two copies of one claim now disagree and the strict one is red. |
| FIX P1 | `! grep -qF "grep -q 'amendment loop is evaluated first'" "$P"` | Literal present at `FEAT-…:476`. |
| FIX P4 | `! grep -qF "grep -q 'Parent contract:' \"\$AR\"" "$P"` | Literal present at `FEAT-…:354` and `:489`. |

The last two are **unsatisfiable by construction**, not merely false. This plan's Phase 1 task 2 *requires* the old assertion literal be recorded as the amendment's justification; the coder complied correctly. The recording requirement and the absence assertion are mutually exclusive — satisfying one necessarily reds the other. They read green only because `!` suppressed the failure.

This blocks for three reasons, not one. It falsifies AC 10 under a working harness. It leaves this plan shipping a self-contradictory gate. And it bounds the entire value of AC 9: the Phase 6 rule mandating a post-`simplify` gate re-run is worth exactly what the gate's ability to go red is worth, and 14% of the assertions it mandates re-running cannot go red at all. The plan swept the *pipeline* form of "a gate whose verdict is decided by a shell artifact rather than by the claim" and missed the *negation* form of the same species.

**Fix**, three parts:

1. Sweep the negation form in both plans exactly as the pipeline form was swept, and record it in the same `## Verification (per phase)` harness note:

   ```bash
   # NOT:  ! grep -qF 'X' "$F"
   if grep -qF 'X' "$F"; then echo "FAIL: X present" >&2; exit 1; fi
   ```

   Do **not** use `grep -qF 'X' && exit 1` — under `set -e` that aborts when the grep *fails*, which is the passing case.

2. Scope FIX P1's and FIX P4's absence checks to the fenced gate block rather than the whole plan file, so the provenance comment cannot collide with the assertion it justifies. The `awk` range that already isolates the gate is the natural scope, e.g.

   ```bash
   awk '/^### Phase 3 gate/,/^### Phase 4 gate/' "$P" \
     | { if grep -qF "grep -q 'amendment loop is evaluated first'"; then exit 1; fi; }
   ```

3. Amend the parent plan's `! grep -qiE '(minutes|hours|seconds)'` to the same narrowed form this plan already adopted for its own copy (`! grep -viE 'Never print a wall-clock ETA' "$C" | grep -qiE …`, rewritten per part 1), as a recorded task with this CR's ID — so the two copies of one claim stop disagreeing.

---

### MF-2 — MF-4/MF-5(a)'s cost model does not close: the ladder and the gate contradict each other on the same input

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:188–242`

**Problem**: The unit work AC 4 asks for is genuinely done — task-equivalents declared at `:176` ahead of every formula, the three conversions at `:179–182` with defaults, and `span`/`makespan`/`M_flat`/`M_nested`/gain/cost all restated in that unit. MF-5(a)'s shape-split is real too. But the gate's `c` and the ladder's `M_nested` are computed from **different overhead accounts**, so the number the gate decides on and the number the user is shown are not the same number.

Four concrete inconsistencies, all verified against the live file:

| # | Defect | Where |
|---|---|---|
| 1 | `A` is charged **per candidate** on the cost side but **once for all `k`** in `M_nested` ("Step 2s — concurrent, so slowest-of-k"). The reciprocal of the `k × J` correction was never applied to `A`. | `:231` vs `:194`/`:202` |
| 2 | `A` is charged **twice** on the cost side — bullet 1 (the Step 2s pass) and bullet 4 (the "extra architect round-trip Step 2s's barrier imposes"). But `full`'s third serial architect round-trip *is* the Step 2s pass, and `M_nested` carries only two `A` terms (2c, 2s), no third. | `:231` and `:234` vs `:202` |
| 3 | **Interface points** are charged as cost at 1 task-equivalent each but appear **nowhere** in `M_nested`. | `:233` vs `:200–205` |
| 4 | `makespan` is *defined* to include overhead (`:188`, "the overhead is never dropped from the number"), but the formal after-value at `:221` is a bare `max(second_largest_span, largest_sublane_of_L)` while `:225` calls the gain "the difference between the **makespan** before and after". | `:188` vs `:221`/`:225` |

**Failure scenario** (worked myself; the tester's version reaches the same contradiction but mis-states the gain as 4). Lanes `{12, 6}`; candidate splits the 12-lane into `{6, 6}`; `k = 1`; defaults `A = 2`, `J = 2`; no interface points.

- **Ladder at 2p.5.** `M_flat = 12 + A + J = 16`. `M_nested = max(6, 6) + A + A + k×J + J = 6 + 8 = 14`.
  → the user is shown **option 3 as 2 task-equivalents cheaper**.
- **Gate at 2p.3n**, reading `:221` literally: `gain = 12 − max(6, 6) = 6`. `cost = A + k×J + 0 + A = 6`.
  → `6 > 6` is false, and `:236` says **"Equal is not enough"** → `sub-split rejected: lane {name} — gain 6 task-equivalents does not exceed cost 6 task-equivalents`.
- Reading `makespan` per its own `:188` definition instead: `gain = 16 − 14 = 2`, `cost = 6` → still rejected.

Either reading, the same run prints the nested plan as the cheaper option **and** rejects every candidate that would produce it. The structural cause: the cost side charges `2A + kJ = 6` where the model's own overhead delta `M_nested − M_flat` is `A + (k−1)J = 2`. The discrepancy is `A + J` at `k = 1` and widens by a further `(k − 1) × A` for `k ≥ 2`.

The greedy-termination text at `:242` — "adds a further `J`", silent on `A` — sides with the `M_nested` account and so contradicts cost bullet `:231`, a second signal that `:231` is the stale side. Task 94 of this plan explicitly required "confirm the greedy recomputed-adoption text still reads correctly against the corrected arithmetic"; it does not.

This blocks against AC 4 as written ("so `g > c` is ordinary arithmetic") and against AC 5's second half. Arithmetic that is ordinary but yields a decision contradicting the figure printed beside it in the same step is not a closed remediation — `references/config.md` is the normative home of this model, so a contradiction here is a contradiction everywhere.

**Fix**: pick one account and derive the other from it. The cheapest correct form is to define cost as the *marginal makespan delta* the candidate causes, so the two sides cannot drift:

- Charge `A` on the cost side **only for the first adopted candidate** (or state that the per-candidate `A` is the aggregate `k × A` and correspondingly change `M_nested`'s second term from `A` to `k × A` — but that contradicts the concurrency claim at `:194`, so the first option is the consistent one).
- Delete cost bullet 4 (`:234`) or, if the barrier round-trip is a real separate cost, add the matching third `A` term to `M_nested`. It cannot be in one and not the other.
- Add the interface-point term to `M_nested`, or state explicitly that interface points are a *gate-only* charge and why the ladder omits them.
- Restate `:221` so the formal after-value carries the same overhead term `:188` says `makespan` always includes, or rename the bare `max` to `span` and define the gain over `span` rather than over `makespan`.
- Re-run the worked example above as a documented sanity check and extend the greedy text at `:242` to whatever the corrected per-adoption increment actually is.

---

### MF-3 — MF-8 replaced one false claim with another, contradicted two lines above it in the same diff

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:926,928` (and `:150`)

**Problem**: The gate assertion is a prose-presence check (`awk '/^#### 3j.3 /,/^### Step 4 /' | grep 'no role walks the contract tree'`) and is green. The sentence it proves present is not true, in three independent ways.

**(a) The enumeration is false as written.** `:928` reads *"Their templates changed **only** to name the outer join, to accept the pre-resolved `leaves=` set, and — **for the tester** — to fold sub-contract interface rows into its existing critical-flow triage input."* But `templates/reviewer.md` gained a bullet that is none of the three and is the reviewer's own analogue of what `:928` attributes to the tester alone:

> **Interface rows live at two levels.** … the sub-contract's **Inherited interface assignments** region names the sub-lane that owns that side — verify it there rather than guessing which leaf was responsible.

plus a two-level ownership clause on the boundary lens ("a sub-lane writing into a sibling sub-lane's globs is the same violation"). `templates/qa.md` additionally *deletes* the per-lane-CR reconciliation rule, and `reviewer.md` deletes the whole "`full` mode — carrying per-lane findings" bullet. Both "only" and "for the tester" are false.

**(b) "No role walks the contract tree" is contradicted two lines above, in the same diff.**

| Line | Text |
|---|---|
| `:926` (added here) | "Each resolves the **leaf** plan set from the parent `PACT`'s lane map — **walking the `Sub-contract` column one level** for any sub-split lane" |
| `:928` (added here) | "Crucially, **no role walks the contract tree**, and none has a per-lane or per-sub-lane pass." |
| `:150` (added here) | with `leaves=` present a role "**uses it as given and does not walk the contract tree**"; the walk "stays the **fallback** for a **legacy** run" |

`:926` states the walk as normal behaviour; `:150` states it is the legacy fallback only. `:926` was simply not swept when MF-2 introduced `leaves=`.

**(c) The claim is false on the merits regardless.** `leaves=` carries **`FEAT` plan IDs only** (`:142`, `:150`). But `tester.md` now requires *"Include the rows of every adopted **sub-contract**"* and `reviewer.md` requires reading *"the sub-contract's **Inherited interface assignments** region"*. Neither sub-contract identity nor its rows are derivable from a list of `FEAT` IDs — they are reachable only through the parent `PACT`'s `Sub-contract` column (`references/artifact-format.md` → *`PACT` ID resolution*, step 2). Both roles therefore **do** traverse the contract tree; `leaves=` spares them only the *plan-set* walk.

This is precisely the failure shape `CR-…-25d5` catalogued and this plan was written to close — *a definition changed without sweeping the definition's consumers* — reintroduced by the remediation for it. It fails AC 8, whose whole point is that 3j.3 "states what is true".

**Fix**:

- Sweep `:926` for `leaves=`: state that the leaf set arrives pre-resolved on `leaves=` and that the lane-map walk is the legacy fallback, matching `:150`. One sentence.
- Narrow `:928`'s claim to what is actually true and defensible: *no role recurses past one level, and none has a per-lane or per-sub-lane pass* — dropping "walks the contract tree" entirely, since `leaves=` does not carry sub-contract identity and two roles legitimately need it.
- Correct the enumeration: either replace "only … for the tester" with an accurate list covering the reviewer's two-level interface and boundary-ownership additions and QA's removed per-lane-CR rule, or replace the enumeration with the weaker true claim (their templates gained no depth-recursive logic and no new pass).
- Add a gate assertion that can catch this class — e.g. assert `:926`'s region does **not** state the walk unconditionally — since a presence check over a sentence can never detect that the sentence is contradicted elsewhere.

---

### MF-4 — the normative reference still states the flat degradation MF-7 exists to forbid

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:149`

**Problem**: MF-7's remediation is genuinely good where it landed. `SKILL.md:489–491` gives the 2p.3n gate sole ownership with a correct pre-freeze rationale; `architect.md:162` states the refusal "**halts the run at Step 2s.3 — it does not degrade to flat**"; `Step 2s.3` exists at `SKILL.md:700` and defines the halt it names; the wrong `Step 0c` cross-reference is gone (zero `0c` hits in the sub-contract deltas).

But `references/config.md:149` — under `#### Owned-glob rejection`, whose own intro at `:134` scopes the list to globs *"rejected at **contract-authoring time**"*, i.e. at the Step 2s architect — reads:

> **A lane whose candidate sub-lanes cannot be given bounded, contained, mutually disjoint globs is not sub-split** — the reason is printed and that lane **runs flat**.

That is verbatim the outcome `architect.md:162` forbids in bold and `SKILL.md:491` calls unrecoverable. It is not a stale duplicate in a summary file: per this plan's own Technical Notes and `PROJECT-CONTEXT.md` → Conventions ("Each `references/*.md` owns one concern and is **normative**"), `config.md` is the authoritative home, and `SKILL.md` explicitly points here rather than restating. An executing agent applying the normative file would demote a lane to flat *after* Step 2c froze the parent contract with that lane's `Lane plan ID` as `—` — precisely the unrecoverable state the other two documents were rewritten to prevent.

The sweep reached `SKILL.md` and `architect.md` but not the reference. AC 7 requires "exactly one owner"; there are still two, and the surviving second one is the authoritative file.

**Fix**: rewrite `:149` to route by stage rather than asserting a single outcome — the *candidate-set* stage (pre-2p.3n) leaves the lane flat; the *contract-authoring* stage (Step 2s, which is what `#### Owned-glob rejection` is scoped to) stops and reports, halting at Step 2s.3. Something like:

> **A lane whose candidate sub-lanes cannot be given bounded, contained, mutually disjoint globs is not sub-split.** Before the parent contract is frozen, the 2p.3n gate leaves that lane flat with the printed reason. At contract-authoring time — Step 2s, which is what this list governs — the sub-contract architect stops and reports instead: Step 2c has already frozen the lane's `Sub-contract` cell, so the run **halts at Step 2s.3 and does not degrade to flat** (`SKILL.md` → Step 2p.3n and Step 2s.3; `templates/architect.md` → *Sub-contract deltas*, item 2).

Add a Phase 4 gate assertion pinning the `#### Owned-glob rejection` region against the string `runs flat`, so the three documents cannot drift again.

## Should Fix (Warnings)

### SF-1 — the parent plan's 24 piped `grep -q` assertions were left un-rewritten while Phase 6 makes them load-bearing

**File**: `plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md` (all five gates)

**Problem**: This plan correctly diagnosed that `awk … | grep -q` returns **141** under `pipefail` once the producer's output exceeds the pipe buffer, and rewrote **18 of its own** piped assertions to `| grep … >/dev/null`. I counted the parent plan: **24 piped assertions, all 24 still using `grep -q`**; only 1 uses the safe form. They are green today only because every parent `awk` range is small (largest measured: `Step 2s → Step 2L` at 4,767 bytes; `Step 3j → 3j.1` at 4,562), well under the threshold. The exposure is latent and monotonic — it flips the day a section grows past the buffer, or on an edit that merely *moves* text. AC 9's new rule makes these parent gates mandatory re-runs after every `simplify`, so their verdicts are now load-bearing for this plan's central deliverable.

Ruling on scope: **not blocking**, because the claims are correct today and the plan's harness note explicitly scoped the rewrite to its own gates. But the MF-1 fix must edit both plan files anyway, so sweep these in the same pass rather than deferring them again.

**Fix**: mechanical `| grep -q PATTERN` → `| grep PATTERN >/dev/null` across the parent plan's 24, with the same recorded harness note this plan already carries.

---

### SF-2 — FIX P2 §2's gating assertion is tautological

**File**: `plans/code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md:191`

**Problem**: `grep -q 'leaves=' "$K" && grep -qi 'parallel path' "$K"` is labelled *"omitted on an `off` run"* but proves only that the file contains each string somewhere, unrelated to each other. It cannot detect an ungated `leaves=` line. The actual gating claim — every `leaves=` emission site carries the parallel-path condition — is asserted nowhere. The prose is in fact correct at `:944`/`:999`/`:1105`; only the assertion is empty.

**Fix**: assert per-site, e.g. `test "$(grep -c 'leaves=.*parallel path ONLY' "$K")" -eq 3`, or scope each of the three spawn-block ranges and require both the `leaves=` line and its "omit the line entirely on a sequential run" annotation.

---

### SF-3 — the harness note overstates its own coverage

**File**: `plans/code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md:138` and `:257`

**Problem**: The note asserts *"**Every** piped assertion in this plan's gates is therefore written `… | grep PATTERN >/dev/null`."* I counted 18 rewritten and **1 remaining** — FIX P3 §7's `! grep -viE 'Never print a wall-clock ETA' "$C" | grep -qiE …`. Harmless in practice (small producer, and negated so it never fires today), but a note that overstates is the same class of defect as a gate that cannot fail.

**Fix**: rewrite the 20th to the safe form when MF-1's negation sweep touches it anyway, or amend the note to say "every piped assertion except the negated wall-clock check, which is …" and say why.

---

### SF-4 — `SKILL.md:489`'s "nowhere else" is falsified by two surviving statements

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:489`

**Problem**: "It is decided **here and nowhere else**" is absolute, but `SKILL.md:340` and `references/config.md:130` both say a lane left with fewer than 2 sub-lanes carrying work "is simply not sub-split and runs flat". Those are defensible as an *earlier, different* stage — 0c builds the candidate set, 2p.3n adopts — so this is not the MF-4 contradiction. It is a wording problem: as written, the sentence is false.

**Fix**: narrow to what is true — *"the **adoption** decision is made here and nowhere else; candidate-set construction at Step 0c may independently drop sub-lanes before this gate ever sees them."*

---

### SF-5 — two conditionally-vacuous optional-item wrappers

**File**: `plans/code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md:167` and `:259`

**Problem**: `if grep -qF 'Mark the lane DONE in the' …; then …; fi` (P1 §6) and `if grep -q 'never an error' …; then …; fi` (P3 §8) silently disappear entirely if the optional item was skipped. Both branches are in fact taken here, so there is no live defect — but a gate whose whole body is conditional on a string it also asserts is a pattern that reads green for the wrong reason.

**Fix**: since both optional items were taken, drop the `if` wrappers and assert unconditionally; or keep the wrapper and add an `else echo "SKIPPED: SF-6" >&2` so a skipped branch is visible rather than silent.

## Verdict

**Status**: REQUEST_CHANGES

Five of eight blockers (MF-1, MF-2, MF-3, MF-5b, MF-6) are cleanly and verifiably closed and the CR's central ruling was honoured, but MF-4, MF-7 and MF-8 are not closed and the harness that was supposed to prove any of it is 14% incapable of reporting failure.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260807T045301Z-4659-nested-parallelism-cr-remediation.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair.

**Explicitly out of scope for that plan** — do not re-litigate: `gate-scope.test.cjs` and `gate-shell-injection.test.cjs` are pre-existing red at merge-base `974b01a`, verified three times, unrelated to this diff. Also do not revert any SIMPLIFY prose, resurrect `3j.4`, or re-duplicate the precedence sentence — `CR-…-25d5`'s MF-1 ruling stands and this plan honoured it correctly.

**Sequencing note for the architect**: MF-1's negation sweep must land **first**. Until the gates can go red, no assertion written for MF-2, MF-3 or MF-4 can be confirmed failing before the prose that satisfies it, and the TDD-first discipline the plan template requires would be theatre.
