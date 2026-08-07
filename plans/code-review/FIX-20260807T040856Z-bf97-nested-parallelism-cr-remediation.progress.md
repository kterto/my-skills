# Progress: FIX-20260807T040856Z-bf97 — Nested inner-lane parallelism — CR-25d5 remediation

**Plan**: [FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md](./FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md)
**Source CR**: [CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md](./CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md)
**Parent plan**: [FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md)
**Status**: DONE
**Created**: 2026-08-07T04:08:56Z

---

## Log

### 2026-08-07T04:53:01Z | REVIEWER

Code review complete (cycle 2).
CR: plans/code-review/CR-20260807T045301Z-4659-nested-parallelism-cr-remediation.md
Status: REQUEST_CHANGES
Must Fix: 4 | Should Fix: 5

Closed and verified against the live tree: MF-1 (SIMPLIFY prose not reverted — `3j.4` absent,
precedence sentence count exactly 1; five parent amendments recorded with the CR ID and
lateral-or-stronger), MF-2 (`leaves=` at `:944`/`:999`/`:1105` + resumed run at `:311`, fallback
narrowed to legacy), MF-3 (`grep -rn 'Parent contract:'` = zero hits; Step 3C keys on the preamble),
MF-5(b) (barrier justification names determinism, credits containment), MF-6 (both sites).
AC 9's Phase 6 rule is present and correctly worded at both Step 3 and Step 3j.

Not closed — all four of the tester's findings independently reproduced and ruled blocking:
- MF-1 (this CR) — `!` exempts a command from `set -e`. Reproduced; 31 negated assertions extracted
  and evaluated individually: 28 hold, **3 are false** (parent P1's wall-clock check, FIX P1's and
  FIX P4's old-literal absence checks). The latter two are unsatisfiable by construction — Phase 1
  task 2 requires the very literal they assert absent. Falsifies AC 10 and bounds AC 9's value.
- MF-2 — MF-4/MF-5(a) cost model does not close. Worked counterexample: lanes `{12,6}` split `{6,6}`
  prints `M_nested = 14 < M_flat = 16` at 2p.5 while 2p.3n rejects at `gain 6 / cost 6`. Cause:
  `A` per-candidate vs once-for-all-k, `A` charged twice, interface points absent from `M_nested`,
  bare-`max` after-value vs overhead-inclusive `makespan` definition.
- MF-3 — MF-8 swapped one false claim for another. `SKILL.md:926` states the contract-tree walk as
  normal behaviour two lines above `:928`'s "no role walks the contract tree", and `:150` calls it
  the legacy fallback; the "only … for the tester" enumeration omits `reviewer.md`'s new
  "Interface rows live at two levels" bullet; and `leaves=` (FEAT IDs only) cannot supply the
  sub-contract rows tester.md and reviewer.md now require.
- MF-4 — `references/config.md:149`, the normative file, still says such a lane "runs flat", the
  outcome `architect.md:162` forbids in bold and `SKILL.md:491` calls unrecoverable.

Ruled Should Fix on scope: the parent plan's 24 piped `grep -q` assertions (green today; all ranges
< 5 KB, so latent not present — sweep them in the same pass that fixes the negation form).
`gate-scope` / `gate-shell-injection` pre-existing red at `974b01a` — out of scope, not re-litigated.

Sequencing note for the architect: the negation sweep must land first, or no later assertion can be
confirmed failing before the prose that satisfies it.

Invoke /architect with plans/code-review/CR-20260807T045301Z-4659-nested-parallelism-cr-remediation.md to create FIX plan.

### 2026-08-07T04:48:36Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260807T043712Z-9b56-nested-parallelism-cr-remediation.md
Status: BELOW_FLOOR
Coverage: N/A% → N/A%

Coverage is inapplicable, not missed — the diff is 10 markdown files plus one JSON template line,
zero executable lines, zero files under `scripts/`. No e2e added: no addressable runtime surface.
Renderer 45/45, artifact-pairing and target-guard green; `gate-scope` / `gate-shell-injection`
pre-existing red at merge-base `974b01a`, not re-litigated.

All eleven gates (5 parent as amended + 6 this plan, 228 assertions) exit 0 **as written**,
re-run verbatim under `/usr/bin/grep`. **3 of 11 are RED once a harness defect is corrected.**

Four findings, in severity order:

1. **BLOCKING — `!` disables `set -e`.** Bash exempts a command from `set -e` when its return
   value is inverted with `!`, so all **31 `! grep -q …` assertions (14% of 228) are no-ops**:
   they can report false and the gate still prints OK and exits 0. Three are genuinely false —
   parent P1's `! grep -qiE '\b(minutes|hours|seconds)\b'` (`config.md:211` reads "minutes would
   be fabricated precision"; this plan narrowed its own copy at P3 but left the parent's blanket
   copy unamended), and FIX P1/P4's `! grep -qF "<old assertion literal>" "$P"`, which are
   **unsatisfiable by construction** — the same plan requires that literal recorded as the
   amendment's justification, so its recording requirement and its gate are mutually exclusive.
   Same species as the coder's finding (verdict decided by a shell artifact, not by the claim),
   different mechanism; the coder swept the pipeline form and missed the negation form. This also
   bounds the value of the new Phase 6 rule: mandating a gate re-run is worth only what the gate's
   ability to go red is worth.

2. **BLOCKING — MF-8's replacement claim is itself false.** `SKILL.md:928` swaps "templates are
   unchanged" for an enumeration that is incomplete (`reviewer.md` gained an unlisted
   *"Interface rows live at two levels"* bullet plus a two-level ownership clause; `qa.md` dropped
   per-lane-CR reconciliation), and its "Crucially, **no role walks the contract tree**" clause is
   contradicted by `SKILL.md:926` **two lines above, added in the same diff** ("walking the
   `Sub-contract` column one level"), and by `:150` (walk is the *legacy fallback*). It is also
   false on the merits: `leaves=` carries `FEAT` IDs only, but `tester.md` now needs every adopted
   sub-contract's rows and `reviewer.md` the sub-contract's *Inherited interface assignments*
   region — reachable only through the parent `PACT`'s `Sub-contract` column. The same
   definition-changed-without-sweeping-consumers shape the plan was written to close.

3. **BLOCKING against AC 4 — MF-4's arithmetic does not close.** The unit work is real
   (`config.md:176` declares task-equivalents ahead of every formula; conversions at `:179–182`;
   every quantity restated), and MF-5(a)'s shape-split is correct (`k × J` on both formula and
   cost side). But gain and cost use different overhead accounts: `A` is charged per candidate at
   `:231` while `:194`/`:202` charge it once for all `k`; `A` is charged twice (`:231` and `:234`)
   against two `A` terms in `M_nested`; interface points are costed at `:233` but absent from
   `:200–205`. Lanes `{12,6}` split `{6,6}`: the 2p.5 ladder shows `M_flat=16` / `M_nested=14` (a
   2-unit win) while the 2p.3n gate computes `gain 4` vs `cost 6` and prints `sub-split rejected`.

4. **SHOULD FIX — MF-7 still has more than one owner.** `SKILL.md:489`/`:491` and
   `architect.md:160`/`:162` do agree, the Step 0c cross-reference is gone, and `2s.3` (`:700`)
   defines a real halt path. But `config.md:149` — under a heading scoped to *"rejected at
   contract-authoring time"* — says such a lane "runs flat", verbatim the outcome
   `architect.md:162` forbids in bold. The sweep reached `SKILL.md` and `architect.md` but not the
   normative reference this project's conventions make authoritative. `SKILL.md:340` and
   `config.md:130` additionally falsify `:489`'s "decided here and nowhere else".

Verified favourable, by direct check rather than by gate:

- **SIMPLIFY prose not reverted.** `3j.4` absent; the precedence sentence appears **exactly once**
  at `:840`, in Step 3j's body ahead of both subsections; neither 3j.1 (`:874`) nor 3j.2 (`:891`)
  fires unconditionally; the Rules-section authoring rule stands at `:1264`. Ruling honoured.
- **All five parent-plan amendments are recorded and lateral-or-stronger**, each with the CR ID
  inline and a per-assertion rationale in the parent's Progress Log. Three are strict
  strengthenings (the P4 one replaced an assertion that was green *because the routing was wrong*).
- **Both coder-reported harness defects confirmed independently.** (a) `awk '/2p\.3n/,/2p\.4/'`
  spans **765** lines vs **34** anchored; the sibling `Step 5→Step 6` (no such heading, 279 lines
  to EOF) and `### Step 0r` (authored `#### 0r —`, matched no start line) corrections also hold,
  and all three tighten. (b) `awk … | grep -q` returns **141** under `pipefail`; measured
  threshold is the producer exceeding the pipe buffer (~32–64 KB), not match position — 4/16/32 KB
  give 0, 60 KB and above give 141, and the `>/dev/null` rewrite is 0 at every size.
- **Coder's claim (c) confirmed:** the parent plan's gates still use `grep -q` in pipes — **24 of
  24 piped assertions** — and are green only because every `awk` range is small (largest 11.8 KB,
  well under the threshold). This plan correctly rewrote **19 of its own**. Latent and monotonic:
  it flips when a section grows or text merely moves.


### 2026-08-07T05:10:00Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: 48 (8 Must Fix + 6 Should Fix, across 6 phases)

Aggregate: **11 gates (5 parent as amended + 6 this plan) exit 0**, run twice.

### 2026-08-07T05:08:00Z | CODER

**Phase 6 complete — 8/8 tasks.** The systemic post-coder verification hole, then the sweep.

Red-first confirmed: neither `simplify` site mentioned the plan's `## Verification (per phase)`
gates, nothing named an executable suite as a non-substitute, and nothing forbade proceeding to
the tester on a red gate.

- `SKILL.md` **Step 3 — Simplification pass** now requires, after `simplify` edits the diff and
  **before the tester**, re-running the plan's own `## Verification (per phase)` gate for every
  phase whose touched paths the simplify diff intersects, asserting exit 0 for each. The reason is
  stated rather than assumed: the coder's green is evidence about a tree `simplify` then changed.
- The same paragraph states explicitly that **whatever executable suite happens to exist in the
  repo is not a substitute** for the plan's phase gates — the two answer different questions, and
  on a doc-authoring plan the phase gate is the *only* verification covering the diff, so a green
  unrelated suite proves nothing about it. Running a suite is never wrong; accepting it *in place
  of* the gate is.
- **Red-gate routing** specified as exactly two outcomes: fix the prose/code, **or** amend the
  assertion as a **recorded plan task** with its justification logged to the plan's Progress Log
  and `.progress.md`. Never a silent rewrite of either side, and **never proceed to the tester on
  a red gate** — an unrecorded relaxation is indistinguishable, one reader later, from a lost rule.
- The identical rule is **mirrored at Step 3j's union-diff `simplify`**, scoped to every leaf plan
  in the resolved leaf set, with an explicit note that this does not disturb the
  *"`simplify` and the full test suite run exactly once per run"* cadence rule — the gates re-run
  there because that is where `simplify` runs.

**SIMPLIFY-pass provenance (task 6 — recorded so the next reader sees why the rule exists).**
Six of the eight blockers trace to specific edits in the parent plan's 12-edit SIMPLIFY pass:

| CR item | SIMPLIFY edit | What went wrong |
| ------- | ------------- | --------------- |
| **MF-1** | #5 — deleted `3j.4` + the "what `full` no longer means" note; #3 — hoisted the BLOCKED-routing precedence out of `3j.1`/`3j.2` into one line at Step 3j | Both edits were **correct**. The Phase 3 gate's three assertions pinned sentence-exact wording to a *location*, so improving the prose turned the gate red without any rule being lost. |
| **MF-2** | #7 — added `leaves=` to the join-level preamble and rewrote all three role templates to consume it | The **definition and the consumers** were added; the **three spawn blocks that had to emit it** were not. Declared, consumed, never dispatched. |
| **MF-3** | #6 — moved the sub-contract architect's level detection to the preamble | The **Inputs paragraph** was updated; the **Step 3C case table** that actually routes was left keyed on `Parent contract:` / `Lane:` body lines. Definition changed, consumer not swept. |
| **MF-6** | #1 — dropped Step 0r's confirmation prompt (a genuine improvement: the never-block guarantee became structural) | Two documents still described the removed prompt — `git-flow.md`'s Step 0r paragraph and `SKILL.md`'s Rules line. Same shape: definition changed, consumers not swept. |
| **MF-7** | #12 — "reconciled" the sub-lane drop outcome by having `architect.md` state both halves | Reconciled the two documents to each other but not to the **pipeline**: 2s.3 hard-halts and Step 2c has already frozen the parent contract, so the "runs flat" half was never executable, and it cited Step 0c, which cannot act on a mid-run refusal. |
| **MF-8** | #8 — removed the `Sub-contract` walk clause from all three role templates; #7 also edited all three | `SKILL.md` 3j.3's *"their templates are unchanged"* became false in the same diff that changed them — and it is the sentence justifying the design. |

The common shape in MF-2, MF-3, MF-6 and MF-8 is **a definition changed without sweeping the
definition's consumers** — exactly what a re-run of the plan's phase gates would have caught, and
exactly what the pass did not run. The pass's own gate line reads
`node --test scripts/render-artifact.test.cjs → 45 pass / 0 fail`: a suite over a directory this
plan touches **zero** files in, standing in for the five structural gates that were the only
verification covering a prose diff. Phase 6 exists to make that substitution impossible rather
than to re-litigate the pass — and the pass was right on the merits every time it was right
(MF-1's prose is kept, MF-6's design change is kept).

**Aggregate gate — all eleven gates in one batch, exit 0.** Five parent-plan gates *as amended*
plus this plan's six. Run **twice** to confirm stability after the `SIGPIPE` fix; identical both
times.

**Sweep clean.** `git diff --name-only HEAD -- orchestrator/scripts/ orchestrator/templates/html/`
is empty. No renderer, HTML scaffold, or `.md`/`.html` parity change. This session touched ten
files — `SKILL.md`, `references/{config,artifact-format}.md`,
`templates/{architect,tester,reviewer,qa}.md`, `product-manager/references/git-flow.md`, and the
two plan files. `templates/coder.md` and `templates/config.template.json` show in the diff
against HEAD but are the **parent plan's** uncommitted changes, untouched here. Every
cross-reference this plan touched resolves on disk.

Plan tasks remaining: 0 unchecked

### 2026-08-07T04:56:00Z | CODER

**Phase 4 complete — 8/8 tasks.** MF-3, MF-7 + optional SF-4.

Red-first confirmed: the Step 3C case table still keyed on the two body-line tokens, the 2p.3n
gate said nothing about condition 1's ownership, and the architect template still claimed its
refusal left the lane *"not sub-split and runs flat"* citing Step 0c.

- **MF-3** — Step 3C's case table now keys **both** rows on the preamble: empty/absent `lane=` →
  parent contract; non-empty `lane=` (with `contract=` naming the parent) → sub-contract. Matches
  the already-correct Inputs paragraph. Added the reason it matters: a table keyed on a token the
  orchestrator never sends does not fail loudly, it falls through to the parent-contract row and
  authors a **second parent contract**.
- **MF-3 sweep** — `grep -rn 'Parent contract:'` across the skill is now **0 hits**. Two further
  body-line routing sites found and re-keyed in the same pass: the type-routing intro
  (*"may additionally carry a `Lane:` line"*) and the Step 3 body-selection note. The warning
  sentence in the case table had to be reworded to avoid the literal token too — the gate asserts
  the string is absent skill-wide, and a sentence warning against it still contains it.
- **MF-3 gate amendment (recorded)** — the parent plan's Phase 4 assertion
  `grep -q 'Parent contract:' "$AR"` was green **because the routing was wrong**: it asserted
  against the stale text SIMPLIFY fix #6 had orphaned. Replaced with the preamble claim, with the
  CR ID and this plan ID as inline justification.
- **MF-7** — the `<2-viable-sub-lanes` outcome now has exactly one owner. Step 2p.3n states that
  it evaluates condition 1 and is the **last point at which a lane can still be left flat** (2c
  freezes the parent contract immediately after), prints the ordinary
  `sub-split rejected: lane {name} — {condition}` line, and states the downstream asymmetry
  explicitly. `templates/architect.md` sub-contract delta 2 now says a lane reaching the architect
  has already cleared that condition, and that a refusal **halts the run at Step 2s.3 — it does
  not degrade to flat**, with the frozen-contract reason. The `SKILL.md` → Step 0c cross-reference
  is deleted; each outcome now points at the step that owns it (2p.3n pre-freeze, 2s.3 mid-run).
- **SF-4** (optional, taken) — Step 3L's heading and Inputs re-keyed on `lane=` / `contract=`, so
  both levels and both roles use one channel and the template no longer contradicts its own 3L.p
  rule.

**Two Phase-3/Phase-4 gate ranges tightened — recorded, not relaxed.** `awk '/2p\.3n/,/2p\.4/'`
looked like a 30-line step scope but is not: `2p.3n` appears 5× and `2p.4` 4× in `SKILL.md`, so
the range closes at the 2p.4 heading and **re-opens** at the next `2p.3n` mention, running to the
last `2p.4` mention in the Rules section — **746 lines, over half the file**. A hit anywhere in
that span would have satisfied it. Both occurrences re-anchored to
`/^#### 2p\.3n /,/^#### 2p\.4 /`. Verified the Phase 3 claim was a **true** green beforehand (2
hits inside the real section), so this is a tightening with no change in verdict.

Phase 4 gate exits 0. All five parent-plan gates re-run: no regression.

Plan tasks remaining: 12 unchecked

### 2026-08-07T04:44:00Z | CODER

**Phase 3 complete — 10/10 tasks.** MF-4, MF-5(a) + optional SF-1, SF-5.

Red-first confirmed: every MF-4/MF-5(a) assertion failed before the prose — no `task-equivalents`
anywhere, no declared conversions, `slowest-of-k`/`sum of k` absent, and the undifferentiated
`plus the fixed overhead** (every contract-authoring pass plus every join pass)` literal present.

- **MF-4** — *The makespan model* now opens by declaring **task-equivalents** as the single unit,
  with a three-row conversion table (`A = 2` per contract-authoring architect pass, `J = 2` per
  join pass, `1` per interface point = one reconciliation unit) stated **before** any formula uses
  it. `tasks(X)` is named as the anchor the other two are defined against. Every downstream
  quantity is restated in that unit, so `g > c` is ordinary arithmetic. The assumption line now
  covers the **conversion** explicitly and says why that half is load-bearing — concurrency alone
  never explains how a *pass* becomes a number.
- **MF-4 printed vocabulary** — `SKILL.md` 2p.3n's rejection row is now
  `gain {g} task-equivalents does not exceed cost {c} task-equivalents`, with a paragraph stating
  that the unit is named in the line rather than assumed; 2p.5's ladder prints
  `{M_flat} task-equivalents` / `{M_nested} task-equivalents`.
- **MF-5(a)** — the overhead term is split by shape: `k` concurrent contract-authoring passes cost
  `slowest-of-k` (= `A`), `k` serialized inner joins cost the **sum of k** (= `k × J`), with the
  full `M_nested` decomposition written out and the `(k − 1) × J` optimism named as the defect
  being fixed. The cost side charges `k × J` for a `k`-way plan and says why (the second lane's
  join does not overlap the first's). The greedy recomputed-adoption text was re-read against the
  corrected arithmetic and **strengthened** by it — each adoption now both lowers the gain and
  raises the accumulated cost, so adoption terminates on its own.
- **SF-1** (optional, taken) — the Step 2L barrier paragraph now states the honest cost (an unsplit
  lane's architect could be issued concurrently with 2s and is not, so the plan set is verified
  against one frozen contract tree), and that extra architect pass is charged at `A` on the cost
  side rather than absorbed silently.
- **SF-5** (optional, taken) — *"never as an error"* → *"never an error"* in `artifact-format.md`
  and `config.md`, with the two byte-exact gate assertions relaxed to `grep -q 'never an error'`
  in the same change. `templates/architect.md`'s occurrence reads *"as all-flat, never as an
  error"* — grammatical in that parallel construction and outside SF-5's named files — so it was
  deliberately left alone rather than swept.

**Two gate-mechanics defects in this plan's own Phase 3 gate corrected — recorded, not relaxed.**
Both are logged inline in the gate block with the CR ID and this plan ID:

1. **`! grep -qiE '\b(minutes|hours|seconds)\b' "$C"` was unsatisfiable by construction.** The
   sentence that *forbids* wall-clock units names one — *"minutes would be fabricated precision"*.
   The assertion could only have gone green by deleting the prohibition's own rationale, which is
   the opposite of the invariant it guards. Narrowed to: no time unit anywhere **except** on the
   line that prohibits it. Every other occurrence is still forbidden.
2. **`awk … | grep -q` aborts the gate with 141 under `set -euo pipefail`.** When `grep -q`
   matches early enough to exit before `awk` finishes writing, `awk` dies of `SIGPIPE` and
   `pipefail` surfaces it. Reproduced deterministically here: the identical assertion returns 141
   with `grep -q` and 0 with `grep … >/dev/null`. The failure is a property of **where the match
   lands in the buffer**, not of the claim — so such a gate can go red on a tree that satisfies it,
   and can flip from green to red on an edit that merely moved a paragraph. All 19 piped
   assertions across this plan's six gates were rewritten to `… | grep PATTERN >/dev/null`, which
   is exit-status-identical but consumes the whole stream. Unpiped `grep -q` left untouched. A
   harness note recording this is now in `## Verification (per phase)`.

Phase 3 gate exits 0. All five parent-plan gates re-run: no regression.

Plan tasks remaining: 20 unchecked

### 2026-08-07T04:31:00Z | CODER

**Phase 2 complete — 11/11 tasks.** MF-2, MF-5(b), MF-6(a), MF-8 + optional SF-2, SF-3.

Red-first confirmed before any prose: `leaves=` hit count was exactly **2** (both in the preamble
*definition*, neither in a spawn), and all three stale claims were present verbatim.

- **MF-2** — `leaves={comma-separated leaf FEAT IDs, in dispatch order}` added to the Step 3b,
  Step 4, and Step 5 prompt blocks as three copies of one line (mirror machinery, not three
  variants), each with a following note gating it to the parallel path and stating the `off`-run
  omission that preserves byte-identical sequential prompts. Step 0r now states that a resumed
  run emits it too — over the **full** leaf set, not only the re-dispatched leaves, since the
  join roles evaluate the union — which narrows the three join templates' `PACT`-walk fallback
  to **legacy** runs. Fallback itself kept intact for backward compatibility. Count is now 8.
- **MF-8** — 3j.3's *"their templates are unchanged"* replaced with the true statement of what
  changed in each of the three, plus *"no role walks the contract tree, and none has a per-lane
  or per-sub-lane pass."*
- **MF-5(b)** — the Step 3s barrier justification no longer claims input wholeness. It now names
  determinism and one join state machine, credits wholeness to the containment rule (the same
  two-local-checks argument Step 3L leans on), and adds the note that early per-lane inner joins
  are safe by containment but deliberately not taken at this depth, pointing at the spec-level
  follow-up rather than implying the barrier is load-bearing for correctness.
- **MF-6(a)** — the Rules line now reads *"Step 0r (resume opt-in, which never prompts at all)"*.
- **SF-2** (optional, taken) — *"the only place the key is enforced"* → *"Enforced here and at
  Step 2L"*; the one-line wave rule added to Step 2L's own body; and Step 2s's `k`-wide fan-out
  stated explicitly as **outside** the ceiling, with the reason it cannot exceed it (`k` adopted
  lanes yield ≥ `2k` leaves, so 2L already bounds a strictly wider set).
- **SF-3** (optional, taken) — the two `off` skip lists unified to include `0r`
  (`SKILL.md`: `0c, 0r, 2p, …`; `config.md`: `0c/0r/2p/…`), with the three byte-exact gate
  assertions that pin them updated in the same change (parent plan Phase 3 item 10, Phase 5
  item 6). `SKILL.md:537`'s narrower list was deliberately left alone: it describes a run that
  resolves `off` *at Step 2p*, by which point 0c and 0r have already run, so widening it would
  have made it false.

**Two of this plan's own Phase 2 gate anchors corrected — recorded, not relaxed.** Justification
`CR-20260807T035907Z-25d5` / this plan, logged inline in the gate block:
- `awk '/^### Step 0r /,…'` matched **no** start line — Step 0r is authored as `#### 0r — …`, a
  sub-step of Step 0. The assertion was unsatisfiable by construction and could never have gone
  green however the prose was written. Re-anchored to `/^#### 0r — /,/^#### 0c — /`.
- `awk '/^### Step 5 /,/^### Step 6 /'` — there is no `### Step 6` heading, so the range ran to
  EOF and would have been satisfied by a `leaves=` hit anywhere downstream. Narrowed to Step 5's
  real successor, `## Spec eval + report`. This **tightens** the assertion.

Phase 2 gate exits 0. All five parent-plan gates re-run: no regression.

Plan tasks remaining: 30 unchecked

### 2026-08-07T04:22:00Z | CODER

**Phase 1 complete — 7/7 tasks.** MF-1 + optional SF-6.

Completed tasks:
- "Amend the parent plan's three red Phase-3 assertions … to the CR's claim-based replacements"
- "Add an inline comment above the amended assertions naming `CR-20260807T035907Z-25d5` and this FIX plan ID"
- "Confirm the SIMPLIFY prose is untouched"
- "Run the parent plan's amended Phase 3 gate and confirm exit 0"
- "(optional) SF-6 — replace the tautological Step 3s assertion"
- "(optional) SF-6 — replace the vacuous Phase 5 assertion"
- "Run the Phase 1 gate and confirm every assertion exits 0"

Red-first confirmed: the Phase 1 gate exited non-zero before the amendment (assertion 1 —
the brittle literal still present in the parent plan) and exits 0 after.

The four claim-based replacements were re-verified green against the live `SKILL.md` before
being written in, matching the architect's note that this is an amendment and not a repair.
SF-6's Step 3s literal uses **single** asterisks (`Mark the lane DONE in the *parent* contract`)
per the plan's Technical Notes; the CR's double-asterisk form would have shipped red.

`3j.4` stays deleted, the precedence sentence still appears exactly once, and the Rules-section
statement of the authoring rule is untouched — no SIMPLIFY prose reverted.

**All five parent-plan phase gates re-run: 1, 2, 3, 4, 5 all exit 0.** The amendment is recorded
in the parent plan's Progress Log with the CR ID and this FIX ID named as its justification.

Plan tasks remaining: 41 unchecked

### 2026-08-07T04:15:59Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-07T04:08:56Z | ARCHITECT

Created plan `FIX-20260807T040856Z-bf97`. Type: fix. Tasks: 48 across 6 phases.

All 8 Must Fix items mapped to task pairs; all 6 Should Fix items mapped to `(optional)` tasks.

- **Phase 1** — MF-1 (+ optional SF-6). Gate integrity: amend, do not revert.
- **Phase 2** — MF-2, MF-5(b), MF-6(a), MF-8 in `orchestrator/SKILL.md` (+ optional SF-2, SF-3).
- **Phase 3** — MF-4, MF-5(a) in `orchestrator/references/config.md` (+ optional SF-1, SF-5).
- **Phase 4** — MF-3, MF-7 in `orchestrator/templates/architect.md` + the 2p.3n gate (+ optional SF-4).
- **Phase 5** — MF-6(b) in `product-manager/references/git-flow.md`.
- **Phase 6** — the systemic post-coder gate-rerun rule, then the aggregate sweep.

**Provenance (recorded per the orchestrator's note, not inferred).** MF-1, MF-2, MF-3, MF-6,
MF-7 and MF-8 trace to the mandatory post-coder `simplify` pass — the SIMPLIFY entry in the
parent plan's `.progress.md`, 12 edits — not to the coder's session. That pass re-ran only
`render-artifact.test.cjs`, a suite this work does not touch, and never the plan's five
structural phase gates, which are the only verification covering a prose diff. Several of its
edits changed a definition without sweeping that definition's consumers. Phase 6 exists to
close that hole rather than to re-litigate the pass.

**MF-1 is an amendment, not a repair.** Per the CR's ruling the SIMPLIFY prose is correct and
stays; the three Phase-3 assertions over-specified their requirements by pinning sentence-exact
wording to a *location*. All four of the CR's suggested claim-based replacements were run
against the live `SKILL.md` while planning and are **already green** — so Phase 1 changes only
the parent plan's gate text, records `CR-20260807T035907Z-25d5` and this FIX ID as the written
justification, and asserts the SIMPLIFY prose was not reverted (`3j.4` absent, the precedence
sentence still appearing exactly once).

**One correction to the CR's suggested literals.** SF-6 proposes
`grep -q "Mark the lane DONE in the \*parent\* contract"`; the live Step 3s text uses **single**
asterisks (`the *parent* contract's lane-status table`), so the assertion must be written
`grep -qF 'Mark the lane DONE in the *parent* contract'` or it ships red. Noted in the plan's
Technical Notes and enforced by the Phase 1 gate.

Out of scope, carried from the CR's *Follow-ups*: early per-lane inner joins (SPEC req 45),
concurrent 2s / unsplit-lane 2L (SPEC req 41), a contract-node abstraction, B3-materializing
`roadmap/references/config.md`, and the pre-existing `gate-scope` / `gate-shell-injection` red
caused by this repo's stale `.orchestrator/` materialization.

---

## Handoff

| From      | To        | Condition                  | Action                                                     |
| --------- | --------- | -------------------------- | ---------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260807T040856Z-bf97`     |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260807T040856Z-bf97`  |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`               |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260807T040856Z-bf97`        |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`            |
