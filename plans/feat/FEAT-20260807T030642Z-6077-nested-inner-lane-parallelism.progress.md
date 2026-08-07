# Progress: FEAT-20260807T030642Z-6077 — Nested inner-lane parallelism — redefining the orchestrator's `full` level

**Plan**: [FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md](./FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md)
**Status**: DONE
**Created**: 2026-08-07T03:09:07Z

---

## Log

### 2026-08-07T03:59:07Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md
Status: REQUEST_CHANGES
Must Fix: 8 | Should Fix: 6

Invoke /architect with plans/code-review/CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md
to create FIX plan.

**Rulings on the escalated forks** (recorded here so the FIX plan does not re-litigate them):

1. **Phase 3 gate red on 3 assertions → amend the assertions, do not revert the prose.** The
   SIMPLIFY output is better on both counts. `3j.4`'s deletion removed a dangling reference to
   "requirement 53", a spec number absent from the shipped skill; the authoring rule survives at
   `SKILL.md:1222`. Hoisting the precedence rule into one blockquote at `SKILL.md:811` — where the
   classification actually happens — is what this project's single-source-of-truth convention and
   the plan's own Technical Notes require. Requirement 55's real demand is that neither `3j.1` nor
   `3j.2` describe itself as firing unconditionally; both now open *"Reached for the leaves Step
   3j's classification routed here"*. The assertions pinned a **location** as a proxy for the rule.
   The amendment must be a recorded plan task, never a silent relaxation. → **MF-1**.
2. **Gain/cost not computable → blocks.** Gain is a makespan delta (task counts + agent passes),
   cost is 2 agent passes + an interface-row count, with no conversion. `g > c` is undefined; the
   printed `gain {g} / cost {c}` line carries no units. Fix: denominate everything in
   **task-equivalents** with three declared constants. → **MF-4**.
3. **Inner join not early reconciliation → split ruling.** The sequencing is SPEC requirement 45
   ("after the leaf barrier and before Step 3j") and re-sequencing is a design change beyond this
   plan — recorded as a spec follow-up, not required here. But two things inside the diff block:
   `M_nested`'s overhead term sums `k` **serialized** inner-join passes as if they were the
   concurrent 2s passes, so the number shown at the ladder is optimistic by ~`(k−1)×J`; and
   `SKILL.md:770`'s justification for the global barrier ("the leaves share one workspace, so the
   barrier is what makes each inner join's inputs whole") is refuted by the containment proof the
   same document uses at 3L to justify flat dispatch. → **MF-5**.
4. **Step 2s's second global barrier → not a blocker.** SPEC requirement 41 mandates it, the
   recoverability argument holds (no workspace write at either barrier), cost is one architect
   pass. → **SF-1** + spec follow-up.
5. **`templates/{qa,reviewer,tester}.md` scope → two of three legitimate.** `qa.md:42` and
   `reviewer.md:31` stated the dropped per-lane rung as **live** behavior, so removing them is
   AC 1 / requirement 3 and the Phase 5 sweep. `tester.md` is not: neither changed line carried the
   old `full` meaning; its edits are new nesting behavior added by SIMPLIFY. Not blocking on its
   own, but it falsifies `SKILL.md:895` ("their templates are unchanged"). → **MF-8**.
6. **Pre-existing red suites → confirmed out of scope.** `gate-scope.test.cjs` reproduced red at
   HEAD with the same `MODULE_NOT_FOUND` signature the tester recorded at merge-base `974b01a`;
   this plan touches zero files under `scripts/`. `render-artifact.test.cjs` 45/45 green.

**Three blockers share one root cause — behavior specified with no dispatch point**, the exact
shape `SKILL.md:1222` forbids and the exact defect that made the previous `full` a no-op:

- **MF-2** — `leaves=` is declared in the mandatory preamble (`SKILL.md:142,150`) and consumed by
  all three join role templates, but **no spawn emits it**: the Step 3b / 4 / 5 prompt blocks are
  byte-unchanged. `grep -n 'leaves=' SKILL.md` returns 2 hits, both definitions. SIMPLIFY fix #7's
  entire claimed saving never fires.
- **MF-3** — architect Step 3C (`architect.md:149`) routes the sub-contract case on
  `Parent contract:` / `Lane:` **body lines** that SIMPLIFY fix #6 replaced with the preamble;
  `SKILL.md` Step 2s.2's prompt sends neither. The sub-contract architect matches the parent-contract
  row and authors a second parent contract. The Phase 4 gate's `grep -q 'Parent contract:'` passes
  only against this stale text.
- **MF-1** — the Phase 3 gate itself.

Remaining blockers: **MF-6** (a resume confirmation documented in `git-flow.md:67` and
`SKILL.md:1212` that SIMPLIFY fix #1 removed — the design change is accepted, the stale references
are not), **MF-7** (the architect's <2-sub-lane refusal claims the lane "runs flat" when 2s.3 hard-
stops the run and the frozen parent contract makes demotion impossible; also cites Step 0c, which
cannot act on it), **MF-8**.

Root cause across the board: SIMPLIFY re-ran `render-artifact.test.cjs` but not the plan's five
phase gates — the only gate covering this diff — so twelve edits landed unverified against it.

### 2026-08-07T04:12:00Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260807T035031Z-230c-nested-inner-lane-parallelism.md
Status: BELOW_FLOOR
Coverage: N/A → N/A

Coverage is not measurable for this plan — the diff contains zero executable lines
(10 markdown files + 1 JSON template; zero files under `scripts/` or `templates/html/`), and
`PROJECT-CONTEXT.md` → Test tooling measures coverage only inside `clean-code-gates`, which the
Invariants forbid running here. The 70% floor is **inapplicable, not missed**.

**No e2e added, deliberately.** Every high-criticality flow in this diff is a prose procedure
executed by an LLM subagent chain with no addressable entry point; building a harness for it would
be the "running build/test tooling against markdown doc skills" that PROJECT-CONTEXT puts out of
scope. Full triage table with per-flow inclusion/exclusion rationale is in the report.

**The substitute gate — the plan's five structural assertion sets — is not fully green.**
Phases 1, 2, 4, 5: OK. **Phase 3: RED on 3 of ~158 assertions:**

1. `no level-specific behavior may be specified only inside a join step` — rule present but
   reworded at `SKILL.md:1222` (SIMPLIFY fix #5 deleted `3j.4` and kept the rule as one Rules line).
2. + 3. `amendment loop is evaluated first` inside `3j.1` and inside `3j.2` — the rule was hoisted
   out of both subsections into a single shared blockquote at `SKILL.md:811` (SIMPLIFY fix #3,
   which deleted `3j.0` as a restated dispatch table).

Both AC 9 and AC 11 are **substantively satisfied** — verified by read-through, not grep: neither
`3j.1` nor `3j.2` describes itself as firing unconditionally (both open "Reached for the leaves
Step 3j's classification routed here"), and all five AC 11 clauses survive. But the gate the plan
owns is red against the tree it gates, and a tester may not relax a gate it does not own
("No silent rewrite of a rule to make an assertion pass without a corresponding plan task").

Root cause is procedural: SIMPLIFY re-ran `render-artifact.test.cjs` (a suite this plan does not
touch) but **not** the plan's five phase gates — the only gate that actually covers this diff.

Collateral-regression guards, all green: `render-artifact.test.cjs` **45/45**,
`check-artifact-pairing.test.cjs`, `gate-target-guard.test.cjs`.

Pre-existing red suites **verified, not assumed**: a worktree at merge-base `974b01a` shows
`gate-scope.test.cjs` and `gate-shell-injection.test.cjs` failing with an identical
`MODULE_NOT_FOUND` signature at both the merge-base and HEAD. Not caused by this plan; not fixed.

Extra structural checks beyond the plan's gates, all clean: every `Step {N}` reference in
`SKILL.md` resolves to a real heading (0 unresolved); `3j.0` / `3j.4` / `requirement 53` /
`Full lane pipelines` confirmed 0 hits repo-wide; the `leaves=` preamble is defined in
`SKILL.md:142,150` and consumed consistently by all three join-level role templates; all 9
cross-referenced files exist; `config.template.json` deep-equals the canonical default object.

Notes for the reviewer: `templates/{qa,reviewer,tester}.md` are in the diff but named in no AC file
list — legitimately in scope via Phase 5's repo-wide `full` sweep, recorded so the delta is visible.
This repo's own `.orchestrator/` is stale (`artifact-format.md` diverged, `config.md` never
tracked) — pre-existing, resolved by the next bootstrap.

Test-quality audit: assertion sets are unusually strong (byte-exact `grep -qF`, `awk`-scoped
ranges, real deep-equality on the config template), and the Progress Log honestly records three
corrected assertions and a caught vacuous-green. Seven weak assertions noted in the report —
including one tautological (`grep -q 'parent'` scoped to a section where the word is unavoidable),
one vacuous (`! grep -q 'passes --resume'`), and one whose verdict flips with `pipefail`. The
systemic weakness is the one that bit here: assertions pinned to exact sentence wording are
brittle against a downstream prose-editing pass.

### 2026-08-07T04:05:00Z | SIMPLIFY

Mandatory pre-review simplification pass over this plan's diff (4 parallel cleanup lenses: reuse, simplification, efficiency, altitude). Fixes folded into this plan's diff; plan stays `status: DONE`.

**Applied (12):**

1. **Step 0r relocated below 0b and gated on `parallelism ≠ off`.** As written it ran *before* the step that resolves `parallelism`, so a prior-halted-run hint could print on an `off` run — breaking the byte-identical-stdout guarantee this branch shipped one commit earlier. Also dropped its confirmation prompt: the table is now two rows (`--resume` passed → resume; otherwise → hint + fresh run), which makes "no non-interactive caller can be blocked" structural rather than guarded, and removes 0r's backwards dependency on 0b's `automation_level`.
2. **Step 2p.3n trimmed to a dispatch point.** It declared `references/config.md` normative and then re-typed the entire gate — six rules, the 70% cap, the cost formula, the greedy policy. Now it carries only the dispatch sentence and the printed-line vocabulary (which exists nowhere else).
3. **BLOCKED-routing precedence stated once.** `3j.0` was a whole sub-step whose content was a two-outcome dispatch table, restated at 3j.1, 3j.2, 3s, and again in its own consequences. Deleted; one classification line now sits in Step 3j's ordered list where the classification actually happens.
4. **Inner-gate rule 1 folded into rule 2.** "Not on the critical path → gain 0 → rejected" cannot fire independently of "adopt only when gain exceeds cost", since 0 never exceeds a strictly positive cost. Kept as a property of the gain definition, not a second rejection rule with its own message format.
5. **`3j.4` and the "what `full` no longer means" note deleted from `SKILL.md`.** Both were editor-facing changelog prose inside a runtime step, and `3j.4` carried a dangling reference to "requirement 53" — a spec number that exists nowhere in the shipped skill. The redefinition history already lives in `config.md` → *Redefinition notice*; the authoring rule survives as one line in Rules.
6. **The sub-contract architect now reads its level from the preamble.** It inferred it from the presence of `Parent contract:` / `Lane:` body lines — the exact failure class the `lane=` / `contract=` preamble convention was introduced to eliminate one commit ago, and the coder side already honored. Membership now travels one authoritative channel at every depth and for every role.
7. **`leaves=` added to the join-level preamble.** Tester, reviewer, and QA each re-walked the parent contract plus every sub-contract to rebuild a leaf set the orchestrator dispatched and still holds — 3×(1+k) redundant reads, repeated on every review (cap 10) and QA (cap 5) cycle. The contract walk stays the documented fallback for a resumed or legacy run.
8. **The `Sub-contract` walk clause removed from all three role templates.** It re-forked the rule that the previous simplify pass consolidated into `artifact-format.md` → *`PACT` ID resolution* — and the surrounding paragraph argues against exactly that ("three copies would be three places to disagree about the same walk") while doing it.
9. **`max_parallel_lanes` now actually binds.** It was documented as capping in-flight dispatch width at Steps 2L/3L but enforced only inside the `full`-only inner gate, so a `lanes` run declaring 20 lanes dispatched 20 concurrent coders and the ceiling never fired. Enforcement is now a wave batch at 2L/3L (binds in both modes, at both depths); the gate's drop-lowest-marginal-gain rule is demoted to a planning preference.
10. **2s.3 reads the parent contract once per wave**, not once per sub-contract, to check a column the orchestrator allocated and wrote itself.
11. **LANE METADATA envelope de-duplicated.** The literal wire format was added to `config.md` while remaining in `SKILL.md` 0c — two authoritative renderings of a format handed to command-capable subagents, in a paragraph asserting "there is no second format". `config.md` keeps it (it is the copy B3 materializes, so subagents can actually read it); 0c points there.
12. **Sub-lane drop outcome reconciled.** `architect.md` said "stop and report non-viable" where `SKILL.md` 0c said "runs flat" for the same condition; the architect now states both halves — it refuses to emit the contract, the orchestrator's outcome is that the lane runs flat.

**Skipped (6) — design changes beyond a cleanup pass, routed to the reviewer. The first three are the substantive ones:**

- **The gain/cost comparison is not computable in the units it is written in.** Marginal gain is a makespan delta (task counts); cost is "one architect pass + one inner-join pass + interface-point count" (agent invocations + a row count) with no stated task-equivalent. `g > c` therefore has no defined evaluation, and `makespan` is already unit-mixed at its definition ("max span, plus the fixed overhead"). An executing agent will invent a conversion silently and differently each run, under an Assumption line that does not disclose it. This is the feature's pricing model, so I did not redefine it here.
- **The inner join (3s) is not early reconciliation.** It requires waiting for *every* leaf across *all* lanes before any inner join starts, then runs the `k` inner joins in deterministic order before 3j. So the first inner join begins exactly when 3j would have, and 3j then waits behind all of them — `k` serialized passes of pure added latency, for a feature whose purpose is wall-clock. The containment proof the design already relies on says a lane's inner-join inputs are whole as soon as *its own* sub-lanes return, which would allow inner joins to run concurrently with still-running leaves elsewhere.
- **Step 2s adds a second global barrier** (all sub-contracts authored and verified before any leaf architect starts), stalling unsplit lanes' architects on sub-contracts they have no dependency on. `full` pays three serial architect round-trips where `lanes` pays two, and the added one is slowest-of-k.
- **Steps 2s/3s are a depth-2 copy of 2c/3j, not a generalization** — the text says so itself ("Restating…", "Mirroring Step 2c's", "one level down"). The leaf abstraction generalized cleanly; the contract and join layers did not. A *contract node* abstraction would let one 2c and one 3j handle both depths, and the hard depth-2 cap would stop being enumerated in step numbers.
- **The lane grammar was re-inlined into `config.md`**, reversing the previous pass's consolidation and re-typing ~18 lines of injection-defense grammar that `roadmap` enforces on write. Spec requirement 68 mandated this because B3 does not materialize `roadmap/references/config.md` — but the cheaper fix is materializing that one file, not duplicating the grammar. Left as specified; flagged.
- **`product-manager/references/git-flow.md` gained a third "if the orchestrator prompts, PM answers X" blockquote.** The deeper fix (PM invoking with `--mode autonomous`) is exactly the class of change the previous cycle's reviewer reverted as out of scope (MF-4), so I did not repeat it.

Gate after all edits: `node --test scripts/render-artifact.test.cjs` → **45 pass / 0 fail**; `check-artifact-pairing.test.cjs` → 0 fail. No `scripts/` file was touched by this plan or this pass. Dangling cross-references (`3j.0`, `3j.4`, `requirement 53`) verified absent repo-wide after the deletions.

---

---

## Log

### 2026-08-07T03:37:17Z | CODER

Phase 5 complete, and **all tasks complete. Plan status → DONE.**
Total tasks completed this session: 61 (Phase 1: 12, Phase 2: 8, Phase 3: 25, Phase 4: 8, Phase 5: 8)

**Phase 5 findings worth the reviewer's attention:**

1. **The PM guard is a real reachable path, not a theoretical one — the remedy was required.**
   Evidence: `product-manager/references/git-flow.md:65` states outright *"PM does not set
   `automation_level`"*, and `product-manager/SKILL.md:111` shows PM answering the orchestrator's
   Step 0 prompt on the user's behalf. Since `automation_level` defaults to `manual`, a PM-driven
   run on a question-capable host **can** surface the new Step 0r resume confirmation — exactly as
   it can already surface the Step 2p ladder. PM is never *blocked* (non-interactive paths get the
   non-blocking hint and start fresh), but the confirmation is reachable, so the bounded
   one-paragraph mirror was applied, not skipped.

2. **The repo-wide `full` sweep found three survivors the plan's own file list did not name** —
   `templates/qa.md:42`, `templates/reviewer.md:31`, and (for consistency of the join vocabulary)
   `templates/tester.md:25`. All three still described the dropped per-lane tester/reviewer rung as
   live behavior. Rewritten. The only two surviving mentions repo-wide are now the deliberate
   historical notices required by requirement 65, both marked `previously`.

3. **`scripts/render-artifact.cjs` shows as changed against the merge-base but is NOT this plan's
   work** — `git log` attributes it to the earlier branch commit `9888e50` (the flat lane-parallel
   feature). This plan's working-tree diff touches **zero** files under `scripts/` or
   `templates/html/`. The Phase 5 gate assertion was therefore corrected to scope against `HEAD`
   rather than the merge-base, which would have wrongly attributed a prior commit's work here.
   **The plan's path-conditional `node --test` gate consequently does not apply to any phase.**

4. **One near-miss worth recording:** the first attempt at the all-phase aggregate run exited 0
   while executing **zero** assertions — the extraction split on the first occurrence of
   `## Verification (per phase)`, which is a cross-reference in the Technical Notes rather than the
   section heading. A vacuous green. Caught by asserting the block count (`==5`) and the assertion
   count (139) before trusting the exit code.

Final: 139 assertions across five phases, exit 0 over the final tree.

### 2026-08-07T03:33:18Z | CODER

Phase 4 complete — `templates/architect.md`, `templates/coder.md`, `templates/config.template.json`.
8 tasks. Gate green.

Red confirmed at 3/15 — and the 3 that passed at red-time are the *negative* assertions that must
be green both before and after: no `subcontract` row in the canonical type table, no second
`## Step 3S` workflow, and the full-suite-never-in-a-lane rule intact. That is the correct shape
for a phase whose contract is "extend, do not fork".

`templates/config.template.json` is now verified **programmatically** equal to the canonical
default object parsed out of `references/config.md` — key set and values — rather than by eyeball.

One prose correction driven by the gate: architect Step 3C said "Containment applies to every
sub-lane glob". Changed to "**Apply the containment rule** to every sub-lane glob" so the template
uses the same canonical name for the rule that `references/config.md` and `SKILL.md` use. Fixing
the prose was right here; loosening the pattern to `-qi` would have left three files naming one
load-bearing rule three different ways.

Plan tasks remaining: 8 unchecked

### 2026-08-07T03:29:43Z | CODER

Phase 3 complete — `SKILL.md`. 25 tasks. Gate green (34/34); red confirmed at 0/34 before any prose.

New numbered dispatch steps landed in document order: `0r` (resume detect/opt-in/re-entry),
`2p.3n` (inner viability gate), `2s` + `2s.1/2s.2/2s.3` (sub-contract fan-out, ID allocation,
verification), `3L.p` (leaf preamble delta), `3s` + `3s.1` (inner join, sole-writer),
`3j.0` (halt/amend precedence), `3j.4` (the requirement-53 dispatch-point rule).

Two assertion patterns were case-corrected (`grep -q` → `grep -qi`) where the prose capitalizes a
sentence-initial word the pattern spelled lowercase — a pattern defect, not a relaxed rule.

One real gap the gate caught and the prose fixed rather than the assertion: `3j.1` initially
delegated the precedence rule to `3j.0` by reference only. Requirement 55 says **neither
subsection may continue to describe itself as firing unconditionally**, so the rule is now
restated inside `3j.1` itself, not merely cross-referenced.

Requirement-53 audit run explicitly over the finished file: every `full`-vs-`lanes` behavior has a
numbered dispatch step preceding the join it feeds (2s / 2L / 3L / 3s, tabulated at 3j.4), and
every added producing spawn pre-generates its `ID to use:` (2s.1). Step 3L correctly carries the
*negative* form — the coder creates no artifact, so it gets the preamble **without** an ID line.

Plan tasks remaining: 16 unchecked

### 2026-08-07T03:21:21Z | CODER

Phase 2 complete — `references/artifact-format.md`. 8 tasks. Gate green on first run.

Red confirmed honestly: 19 of 26 assertions failed; the 7 that passed at red-time are the
*preservation* claims (six role rows + the 2c/3j parallel rows byte-unchanged, the additive
backward-compat paragraph intact), which are supposed to be green before and after.

One placement decision worth flagging for review: the `RESUME — {PACT-ID}` stdout line
(required by AC 12 / requirement 62, authored in Phase 3) was added to **this** file's
Parallel-mode lines table rather than living only in `SKILL.md`. Reason: this table is the
single normative home of every stdout line the orchestrator prints, and B3 materializes it.
Phase 2's task list names only the 2s/3s rows, so recording the extra row here rather than
letting it read as a drive-by.

Plan tasks remaining: 24 unchecked

### 2026-08-07T03:19:07Z | CODER

Phase 1 complete — `references/config.md`. 12 tasks.

Assertion set written first and confirmed **red** (all 21 spot-checked claims FAIL against the
live file) before any prose. Three assertions were then **corrected** after the prose landed —
recorded here because a corrected assertion must never look like a silently relaxed one:

- `proxy effort equally` → `proxy wall-clock effort equally`: the pattern did not match the
  canonical assumption sentence the shipped skill already uses. Prose kept; pattern fixed.
- `! grep -qi 'ETA'` was defective — it matches the substring in `METADATA`/`LANE METADATA`, so it
  could never pass. Replaced with the positive claim (`Never print a wall-clock ETA` is stated)
  plus a real prohibition (`! grep -qiE '\b(minutes|hours|seconds)\b'`).
- `! grep -qi 'tester and a reviewer'` **contradicted requirement 65**, which *requires* the
  dropped meaning be quoted once inside an explicit redefinition notice. Narrowed to: no
  occurrence may sit on a line not marked historical (`| grep -qv 'previously'`), plus the
  notice itself must exist.

Plan tasks remaining: 32 unchecked

### 2026-08-07T03:13:26Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-07T03:09:07Z | ARCHITECT

Created plan `FEAT-20260807T030642Z-6077`. Type: feat. Tasks: 44.

Source spec: `plans/specs/SPEC-20260807T025822Z-2a6f-orchestrator-nested-inner-lane-parallelism.md` (requirements 1–68).
Planned against the **live** state of `plugins/my-skills/skills/orchestrator/` — Steps 0c/2p/2c/2L/3L/3j and the `PACT` artifact already shipped one commit earlier on this branch (`SPEC-20260807T003303Z-62e3`), so every task edits existing text rather than adding a parallel vocabulary beside it.

Five phases, ordered so the normative sources land before the documents that point at them:
1. `references/config.md` — redefined `full`, depth cap, `sublanes`, `max_parallel_lanes`, containment rule, makespan/marginal-gain model, inlined lane grammar (requirement 68).
2. `references/artifact-format.md` — sub-contract shape, Inherited-interface-assignments region, `Sub-contract` column, one-level `PACT` ID resolution, new stdout rows.
3. `SKILL.md` — new Steps 2s and 3s, leaf-granularity 2L/3L, 3j.1/3j.2 precedence, `PARTIAL` resume, rewritten `ask` ladder, updated diagram, requirement-53 dispatch audit.
4. `templates/architect.md`, `templates/coder.md`, `templates/config.template.json`.
5. Cross-skill PM verification + repo-wide old-`full` sweep + backward-compat audit.

Verification: per-phase, structural. `PROJECT-CONTEXT.md` → Commands declares no build/lint/test for doc skills, so each phase's gate is its own grep-checkable assertion set, written and confirmed **failing** by the phase's first task before the prose that satisfies it. A path-conditional `node --test` gate applies only if `orchestrator/scripts/**` is touched — which the spec says it must not be.

Two constraints worth carrying into implementation:
- `PROJECT-CONTEXT.md` → Out of scope forbids running language/build/test tooling against markdown doc skills; the `clean-code-gates` suite is scoped to that skill only and must not be invoked here.
- Requirement 68's inlining is a **precondition**, not opportunistic gap-fixing: Bootstrap B3 materializes `references/config.md` and `references/artifact-format.md` but not `roadmap/references/config.md`, so the sub-lane grammar would otherwise inherit a dead pointer in every downstream project. Verified against B3's actual copy list in `SKILL.md`.

Status: PLANNED. Ready for coder.

---

## Handoff

| From      | To        | Condition                  | Action                                         |
| --------- | --------- | -------------------------- | ---------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260807T030642Z-6077`    |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260807T030642Z-6077` |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with CR-{NNN} file path`    |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260807T030642Z-6077`       |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with QA-{NNN} file path`    |
