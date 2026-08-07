# Progress: FIX-20260807T013331Z-d607 — Fix parallel-path routing, lane-ID reuse, config.md materialization, and PM scope

**Plan**: [FIX-20260807T013331Z-d607-parallel-path-routing-fixes.md](./FIX-20260807T013331Z-d607-parallel-path-routing-fixes.md)
**Status**: QA_READY_WITH_WARNINGS
**Created**: 2026-08-07T01:35:33Z

---

## Log

### 2026-08-07T02:01:01Z | QA

QA suite complete.
Report: plans/qa/QA-20260807T015610Z-de0d-parallel-path-routing-fixes.md
Status: READY_WITH_WARNINGS
Test failures: 0 | Lint errors: 0 | Type errors: 0

All blocking checks pass. Plan can ship; flagged for human root-cause investigation (G8).

**Precondition check**: Plan FIX-20260807T013331Z-d607 status=DONE, CR=CR-20260807T015046Z-032f
CR status=APPROVED. Proceeding.

**Scope**: the accumulated union of `FEAT-20260807T004018Z-c4af` and this plan — 12 modified
files, +800/−27 (10 markdown/JSON, 2 JS).

**Suites run** (each command run from the repo root or the noted app dir):

| Command | Result |
|---|---|
| `node --test plugins/my-skills/skills/orchestrator/scripts/render-artifact.test.cjs` | PASS — Total 45 \| Passed 45 \| Failed 0 \| Skipped 0 |
| `node --test .../orchestrator/scripts/check-artifact-pairing.test.cjs` | PASS — 3 assertions, 0 failed |
| `node --test .../orchestrator/scripts/gate-target-guard.test.cjs` | PASS — 7 assertions, 0 failed |
| `cd plugins/my-skills/skills/clean-code-gates && node --test` | PASS — Total 106 \| Passed 106 \| Failed 0 \| Skipped 0 |
| `node --test .../orchestrator/scripts/gate-scope.test.cjs` | FAIL — 24 assertion failures, **pre-existing** (see below) |
| `node --test .../orchestrator/scripts/gate-shell-injection.test.cjs` | FAIL — 3 assertion failures, **pre-existing** (see below) |
| `node -e "JSON.parse(… templates/config.template.json)"` | PASS — clean (parent plan Phase 1 gate) |

**Pre-existing red verified, not assumed.** Built a detached worktree at the merge-base
(`974b01a`) and re-ran both suites there. Failure counts are identical across the boundary:
`gate-scope` 24 → 24, `gate-shell-injection` 3 → 3, `render-artifact` 0 → 0 (40 tests → 45,
+5 from the parent plan's Phase 2). Cause is `MODULE_NOT_FOUND` on a materialized
`.orchestrator/` layout absent from this authoring repo; `scripts/README.md` documents both
files as not runnable from this source tree. Neither file is touched by the change set.
Zero regression; out of scope; no QAF warranted.

**Lint / build / format**: none configured for this repo's surface per
`PROJECT-CONTEXT.md` → Commands. Not skipped — nonexistent.

**Clean Code gates.** Invoked this repo's own engine (`clean-code-gates/bin/gates.cjs
--scope diff --out -`) at the repo root: returned `stacks: []`, `files: []`, `status: pass`
— no stack detectable at the root, matching `PROJECT-CONTEXT.md`. The stray
`.cleancode-gates.json` the probe auto-created was removed; the working tree is unchanged
by this QA run.

| Gate | Result |
|---|---|
| G1 Coverage (changed files) | N/A — not measured at project scope; both changed JS files are directly test-bound |
| G2 Complexity | MISSING_TOOL — no ESLint in repo, no stack detected |
| G4 Naming | MISSING_TOOL — same cause |
| G5 No comments | WARN — 11 added inline comments in `render-artifact.test.cjs`; baseline already carries 9 in the same file (now 20); gate not enforced in this repo |
| G6 Mutation | MISSING_TOOL — no Stryker |
| G7 Dependency structure | MISSING_TOOL — no dependency-cruiser; changed files are zero-dependency by design |
| G8 Rework ratio (this plan) | PASS — 0.0 (1 CR, APPROVED; 0 REQUEST_CHANGES; 0 plans spawned) |
| G8 Rework ratio (union line) | **HIGH_REWORK — 1.0** = (1 REQUEST_CHANGES + 1 FIX) / 2 CRs |

The `MISSING_TOOL` entries are not treated as blocking: `PROJECT-CONTEXT.md` declares this
repo has no such tooling for the doc-authoring surface and treats automated metrics as
advisory, and both plans' verification sections are explicit and consistent about it.

**Three documentation defects, all non-blocking:**
- **D-1 (new, not in any CR)** — `.../orchestrator/scripts/README.md:18` still says "40
  zero-dep … tests"; the suite is now 45 and the README is not in the change set.
- **D-2 (= CR SF-1, confirmed)** — `SKILL.md:87` "three no-prompt guards" vs `:389`
  "Two hard no-prompt guards" and `:397` "not a third guard". The CR's anchor (`:78`) is
  off by nine; the defect is real, and the line is one this change set added.
- **D-3 (= CR SF-2, confirmed)** — `references/config.md:47` ADR-0001 link and `:49`
  `roadmap/references/config.md` pointer both break once B3 materializes the file into a
  target project. Safety-critical content in that section is self-contained.

Artifact link check clean: every relative link across all six new `plans/` artifacts resolves.

### 2026-08-07T01:50:46Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260807T015046Z-032f-parallel-path-routing-fixes.md
Status: APPROVED
Must Fix: 0 | Should Fix: 2

All four Must Fix items from `CR-20260807T012541Z-a43d` verified closed at their source
anchors, independently of the coder's report:
- MF-1 — `SKILL.md:412-417` (new Step 2p.6 fork) + Sequential-path gates at `:421`, `:452`.
  Document walked top-to-bottom as a `lanes` run and as an `off` run; each visits exactly
  one branch, and the double-execution scenario is unreachable.
- MF-2 — B3 step 2 `:52`, "Re-copy all four" `:56`, summary `:60`; the three `SKILL.md`
  refs repointed to `references/config.md` (`:257`, `:278`, `:948`); `architect.md:157`/`:161`
  correctly left at `.orchestrator/config.md`. One normative copy of the rejection list intact.
- MF-3 — `:516`/`:518`/`:524`. Repo-wide `newid FEAT` now appears only at `:150` (generator
  comment) and `:504` (Step 2c).
- MF-4 — `git diff --stat` over `product-manager/` reports **only** `references/git-flow.md`
  (+2 −0). `product-manager/SKILL.md` has zero diff against HEAD, so the byte-identity claim
  is a git fact, not a prose assertion.

Both coder notes checked, not taken on trust:
- Task count: `grep -c '^- \[x\]'` = 36, `^- \[ \]` = 0, per-phase 6+5+7+6+9+3 = 36. Confirmed
  an architect arithmetic slip (header says 34); every planned bullet executed, none added or
  dropped. Self-disclosed and benign — not recorded as a finding.
- `references/config.md:47` ADR-0001 link: confirmed real, recorded as **SF-2**, together with
  a second and sharper dangling link at `:49` (the normative `roadmap/references/config.md`
  grammar pointer). Ruled a warning rather than a blocker because MF-2's safety-critical
  content — the owned-glob rejection list at `config.md:51` — is fully self-contained and now
  reachable, and Step 0c already drops invalid lanes before the contract architect is spawned.

Also recorded SF-1: Pipeline overview `:78` says "three no-prompt guards" while Step 2p.4 says
two and explicitly denies a third — pre-existing drift from the FEAT's simplify pass, covered
by no task in this plan.

Collateral-regression guard re-run independently: `node --test scripts/render-artifact.test.cjs`
→ 45 pass / 0 fail, matching the count `CR-…-a43d` recorded.

Ready for QA — invoke /qa with plan ID FIX-20260807T013331Z-d607.

### 2026-08-07T02:10:45Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: 36

Note on the count: the plan header and this file's ARCHITECT entry both say "34 across 6 phases",
but the actual bullet count is 6 + 5 + 7 + 6 + 9 + 3 = **36**. Architect arithmetic slip, not a
scope change — every bullet the plan wrote was executed and checked, none added, none dropped.

---

### 2026-08-07T02:10:20Z | CODER

Completed task: "Confirm this plan introduced no new top-level directory under `plans/`, modified
no existing allow-list row, and left every cross-reference it added or changed resolving to a real
file and heading"

- **No new directory.** `ls plans/` → `code-review/ eval/ feat/ final/ qa/ specs/ test/`, the
  allow-list exactly. This plan wrote only to files that already existed plus its own two artifacts
  in `plans/code-review/`.
- **No allow-list row modified.** `references/artifact-format.md` was not touched by any edit in
  this plan (the `PACT` row there is the parent plan's, unchanged).
- **Every cross-reference resolves**, verified by grep for each target heading:

  | Reference added/changed | Target | Resolves |
  |---|---|---|
  | `references/config.md` → `parallelism` | `config.md:24` | ✓ |
  | `references/config.md` → `lanes` (×2) | `config.md:41` | ✓ |
  | `.orchestrator/artifact-format.md` → **`PACT` ID resolution** (Step 2L rationale) | `artifact-format.md:109` | ✓ |
  | Step 2c / Step 2L / Step 3L / Step 3j | `SKILL.md:476 / 512 / 541 / 562` | ✓ |
  | Step 2 / Step 3 | `SKILL.md:419 / 450` | ✓ |
  | Step 3j.3 (×3, the SF-4 notes) | `SKILL.md:624` | ✓ |
  | Step 3j item 3 (Step 3 gate, simplify relocation) | `SKILL.md:562`, ordered-list item 3 | ✓ |
  | Step 2p / Step 2p.4 (git-flow paragraph) | `SKILL.md:337 / 389` | ✓ |
  | Pre-flight step 8 (git-flow paragraph) | `product-manager/SKILL.md` Pre-flight step 8, "single up-front confirmation" | ✓ |

Plan tasks remaining: 0 unchecked

---

### 2026-08-07T02:09:50Z | CODER

Completed task: "Confirm all four Must Fix items are closed by re-reading each CR anchor"

- **MF-1** — `SKILL.md` Step 2p now ends in `#### 2p.6 — The fork`, which names both branches;
  Step 2 (`:419`) and Step 3 (`:450`) each carry a `Sequential path only` gate naming their
  replacement. A `lanes` run can no longer fall through into Steps 2/3. **Closed.**
- **MF-3** — Step 2L (`:512`) states Step 2c is the sole allocation site, reuses the 2c set
  verbatim, prohibits a second `newid FEAT`, and its spawn line reads
  `ID to use: {the FEAT-<id> Step 2c assigned to this lane}`. `grep 'newid FEAT'` leaves exactly
  one lane allocation instruction, in 2c. **Closed.**
- **MF-2** — B3 step 2 copies `references/config.md` → `.orchestrator/config.md`; B3 step 4's
  summary lists it; "Re-copy all four" matches the four-bullet list. All five pointers now resolve:
  `SKILL.md`'s three read `references/config.md` (skill dir), `architect.md`'s two keep
  `.orchestrator/config.md` (materialized agent). **Closed.**
- **MF-4** — `product-manager/SKILL.md` diff against HEAD is empty; no `--parallel` token anywhere
  in `product-manager/`; `git-flow.md` carries exactly one docs-only Step 2p paragraph;
  `orchestrator/SKILL.md:398` no longer claims what PM passes. **Closed.**

Plan tasks remaining: 1 unchecked

---

### 2026-08-07T02:08:40Z | CODER

Completed task: "Run `node --test plugins/my-skills/skills/orchestrator/scripts/render-artifact.test.cjs`
once over the union diff as a collateral-regression guard and confirm it exits 0 with the same pass
count the CR recorded (45 pass / 0 fail)"

```
1..45
# tests 45
# pass 45
# fail 0
```

Exit 0, 45 pass / 0 fail — identical to the count the CR recorded. This plan touched no file under
`scripts/`, so this is a collateral guard only, not a path-matched gate.

Plan tasks remaining: 2 unchecked

---

### 2026-08-07T02:07:30Z | CODER

Completed task: "(optional) Assert every Phase 5 structural check passes for each SF item actually
implemented, and record in the progress log which SF items were implemented and which were skipped"

**All four Should Fix items were implemented. None skipped.** They are small, the plan's Technical
Notes already ruled on each, and leaving a CR warning open when the ruling is written costs the
reviewer a second pass.

| Item | Implemented at | Check |
|---|---|---|
| SF-1 | `SKILL.md:406` (`ask` ladder option 3), `SKILL.md:629` (`full` join description), `templates/reviewer.md:31` | ✓ purpose stated at both the join description and `reviewer.md`; option 3 annotated with what it trades |
| SF-2 | `SKILL.md:528` (Step 2L) | ✓ barrier rationale stated in terms a simplify pass must argue against: re-invoke at zero cost vs. re-invoke against a half-mutated shared workspace |
| SF-3 | `templates/architect.md:31` | ✓ parenthetical now says "the three **directories** in the table above — `contract` co-locates in `plans/feat/`", which agrees with the now-four-row table |
| SF-4 | `SKILL.md:650` (Step 3b), `:702` (Step 4), `:805` (Step 5) | ✓ one blockquote note **beside** each block, never inside it; all three blocks byte-unchanged; `Step 3j.3` resolves (`SKILL.md:624`) |

SF-4 note on placement: each note sits between the closing fence and the following "Parse …"
paragraph, so the `off`-path prompt text stays byte-identical — which is the whole reason the plan
required a note rather than an edit.

Plan tasks remaining: 3 unchecked

---

### 2026-08-07T02:06:10Z | CODER

Completed task: "(optional) Write the SF-4 structural check" and "(optional) Implement SF-4"

Check: each of the Steps 3b, 4, and 5 prompt blocks carries an adjacent note that `{plan_id}` is
the `PACT` ID on the parallel path, and the block text itself is unedited.

Implemented at `SKILL.md:650`, `:702`, `:805` — one blockquote line each, placed immediately after
the closing fence. Each also restates that on an `off` run `{plan_id}` is the plan ID exactly as
before, so the note cannot be misread as a change to the sequential prompt.

Plan tasks remaining: 4 unchecked (was 6)

---

### 2026-08-07T02:05:20Z | CODER

Completed task: "(optional) Write the SF-3 structural check" and "(optional) Implement SF-3"

Check: `architect.md` hard rule 1's parenthetical matches the table it references.

The table gained a fourth row (`contract`) in the parent plan while the parenthetical still said
"the three rows in the table above". Changed to "the three directories in the table above —
`contract` co-locates in `plans/feat/`" (`templates/architect.md:31`), which is true of the
four-row table: four types, three directories.

Plan tasks remaining: 6 unchecked (was 8)

---

### 2026-08-07T02:04:30Z | CODER

Completed task: "(optional) Write the SF-2 structural check" and "(optional) Implement SF-2"

Check: Step 2L states why the global architect barrier exists, in terms a future simplify pass would
have to argue against.

Implemented at `SKILL.md:528`, immediately after the lane-plan verification sentence. States the
barrier is deliberate; that a failing lane plan is re-invoked at zero cost because nothing is
written yet; and that under per-lane architect→coder chaining the same re-invoke would land while
other lanes are already mutating the shared workspace. Framed as a *price paid for recoverability*,
which is the argument a simplify pass would have to rebut rather than silently delete.

Plan tasks remaining: 8 unchecked (was 10)

---

### 2026-08-07T02:03:20Z | CODER

Completed task: "(optional) Write the SF-1 structural check" and "(optional) Implement SF-1"

Check: `full` mode's per-lane reviewer has a stated purpose at both the join description and
`reviewer.md`, and `ask` ladder option 3 is annotated with what it trades.

Implemented at three sites:
- `SKILL.md:629` (Step 3j.3, `full` join description) — a new bullet stating the per-lane reviewer
  buys early lane-local signal, is explicitly not remediation (no fix plan, no coder re-invocation,
  no cycle counted), and that its whole output is input to the one join pass.
- `SKILL.md:406` (`ask` ladder option 3) — annotated with what it trades: findings earlier, N extra
  reviewer passes and N extra `CR` artifacts, same {S}× estimate, no wall-clock gain over `lanes`.
- `templates/reviewer.md:31` — the same purpose stated where the reviewer reads it, folded into the
  existing "carrying per-lane findings" bullet rather than added as a second bullet.

Per the plan's SF-1 ruling, `full`'s per-lane reviewer is **kept** — the fix is to price it, not to
remove spec'd behavior that `reviewer.md` Step 1a already has machinery for.

Plan tasks remaining: 10 unchecked (was 12)

---

### 2026-08-07T02:00:40Z | CODER

Completed task: "Assert every Phase 4 structural check passes, and record in the progress log that
MF-4 was resolved by restoring scope, naming the two reverted sites and the one rewritten paragraph
so the change is traceable"

**MF-4 resolved by restoring scope**, per the plan's Decision — MF-4 ruling. Three sites, all
traceable:

| # | Site | Action |
|---|---|---|
| 1 | `plugins/my-skills/skills/product-manager/SKILL.md:97` (per-story loop step 2) | **Reverted** to its pre-`FEAT-…-c4af` text. `git diff` against HEAD for this file is now **empty** — byte-identical, not merely equivalent. |
| 2 | `plugins/my-skills/skills/orchestrator/SKILL.md:398` (Step 2p.4 closing sentence) | **Reverted** the PM-specific claim; the generic statement survives. |
| 3 | `plugins/my-skills/skills/product-manager/references/git-flow.md:65` (Step 2p paragraph) | **Rewritten** as the AC-13-authorized bounded docs-only mirror. |

No flag was added to `product-manager`'s command surface, and none was legitimized by an amended
spec — the two alternatives the plan's Out of Scope section closes off.

Phase 4 checks:
- **P4-C1** ✓ — `grep -rn -- '--parallel' plugins/my-skills/skills/product-manager/` → no matches.
- **P4-C2** ✓ — `git diff product-manager/SKILL.md` → empty.
- **P4-C3** ✓ — `grep -c 'Step 2p' git-flow.md` → 1. Docs-only; the paragraph's own closing clause
  says so ("PM's command surface is unchanged and PM passes no parallelism flag").
- **P4-C4** ✓ — the two surviving `product-manager` mentions in `orchestrator/SKILL.md` are
  `:280` (PM is cited as the *source of the LANE METADATA envelope format*) and `:990`
  (pre-existing, about the QA report). Neither claims anything about PM's invocation flags.
- **P4-C5** ✓ — see the AC-14 re-verification entry below.

Also confirmed against the **opencode-port-parity** invariant: `.opencode/skills/` contains only
`pr-review-report/` and `spec-driven-eval/`. Neither `orchestrator` nor `product-manager` has an
override port, so no mirror edit is owed.

Plan tasks remaining: 10 unchecked

---

### 2026-08-07T02:00:05Z | CODER

Completed task: "Re-verify the parent plan's AC 14 across the union diff now that the flag is gone:
diff the `off` execution path against the pre-feature documents and confirm every role prompt,
artifact, status line, and stdout header line is identical, with Steps 0c/2p/2c/2L/3L/3j skipped
entirely"

`git diff -U0 orchestrator/SKILL.md` yields 13 hunks. Classified against the `off` path:

| Hunk | Region | `off`-path effect |
|---|---|---|
| `:50,:52,:56,:60` | Bootstrap B3 (this plan, Phase 3) | Bootstrap-time only; adds a copied file and one summary-line item. Not a pipeline role prompt, artifact, status line, or stdout header line. AC 5 mandates it, so AC 10 is necessarily scoped to the run, not to bootstrap. |
| `:77 +17` | Pipeline-overview parallel-branch note | Prose describing the other branch. No `off` behavior. |
| `:129 +2, :137 +1` | Preamble `lane=` / `contract=` lines | Both annotated "parallel path ONLY; omit the line entirely on a sequential run", and the bullet states omission is what keeps an `off` run's prompts byte-identical. |
| `:150` | `newid` comment gains `; newid PACT` | A comment inside the orchestrator's own generator fence. Not emitted anywhere. |
| `:257 +36` | Step 0b `parallelism` resolution + Step 0c | 0b's `off` branch explicitly prints nothing and routes to 1 → 2 → 3 → 3b → 4 → 5 → 7; 0c is gated "only when `parallelism` is not `off`". |
| `:337 +82` | Step 2p | "Runs only when the resolved `parallelism` is not `off`." |
| `:421 +2, :452 +2` | This plan's Step 2 / Step 3 gates | Two annotation lines above the step bodies. **The `Prompt to send:` fenced blocks in Steps 1, 2, 3, 3b, 4, and 5 are untouched by every hunk** — no hunk lands inside one. |
| `:476 +154` | Steps 2c / 2L / 3L / 3j | All four carry `Parallel path only` gates. |
| `:934 +13` | Rules → "Parallel mode (only when `parallelism` ≠ `off`)" | Its own gated block; the seven pre-existing rules above it are unchanged. |

Role templates (`coder`, `tester`, `reviewer`, `qa`) — every addition is gated on either the
`PACT-` prefix (`Step 1a — PACT ID input (parallel mode only)`) or the presence of `lane=`/
`contract=` (`Step 2L — Lane boundary (parallel mode only)`). `architect.md`'s edits extend the type
table with `contract`, renumber a hard rule 4→5, and widen a sanity-check regex to a superset;
a `feat`/`fix`/`qa` invocation reads and behaves identically. `config.template.json` adds three keys
at their documented defaults (`"off"`, `[]`, `2`), which `references/config.md` → Precedence already
declares absent-key-tolerant.

**AC 14 holds without qualification for the pipeline run.** The one thing that broke it in the CR —
`product-manager` passing `--parallel off` — is gone.

Plan tasks remaining: 11 unchecked

---

### 2026-08-07T01:58:20Z | CODER

Completed task: "Remove the \"— `product-manager` does —\" clause from `orchestrator/SKILL.md`'s
Step 2p.4 closing sentence"

`orchestrator/SKILL.md:398`. Now reads: "A non-interactive caller **may** additionally pass
`--parallel off` explicitly, so the step does not exist for its run at all rather than depending on
the default." Generic, still true, and no longer asserts a behavior `product-manager` does not have.

Plan tasks remaining: 12 unchecked

---

### 2026-08-07T01:57:45Z | CODER

Completed task: "Rewrite the `git-flow.md` Step 2p paragraph as the authorized bounded docs-only
mirror, in the same shape as the adjacent Step 0 paragraph"

`product-manager/references/git-flow.md:65`, one blockquote paragraph, immediately below the Step 0
paragraph it mirrors. Shape parity with Step 0: bolded lead → what the orchestrator step does and
when → the option list → "PM answers it on the user's behalf with **option 1**" → the contract
reason. Content required by AC 8 all present: default `off`; `.orchestrator/config.json` may set
`ask`; PM sets no `automation_level` so the 2p.4 autonomous guard does not cover it; answer is
option 1 (`off`); rationale is one story → one run → one commit on `pm/<id>-<slug>` and lane fan-out
is a within-run concern the single up-front confirmation never authorized; a project explicitly
configuring `lanes`/`full` is opting in and does not break the contract because the orchestrator
still ends at one `READY_TO_COMMIT` over one union diff. Closes by stating explicitly that it is a
documentation note and PM's command surface is unchanged.

Plan tasks remaining: 13 unchecked

---

### 2026-08-07T01:57:10Z | CODER

Completed task: "Revert `product-manager/SKILL.md`'s per-story loop step 2 to its pre-change text"

`product-manager/SKILL.md:97`. Restored "Invoke the `orchestrator` skill with the story's `## Brief`
section passed verbatim as the task input"; deleted the `--parallel off` argument, the "The flag is
not optional…" sentence, and its `references/git-flow.md` → Step 2p pointer. The **System context
block** subsection and everything after it were not touched. Verified by `git diff` on the file
returning empty output.

Plan tasks remaining: 14 unchecked

---

### 2026-08-07T01:56:20Z | CODER

Completed task: "Write the Phase 4 structural check list: `product-manager/SKILL.md` contains no
`--parallel` token anywhere; its per-story loop step 2 invocation sentence is byte-identical to its
pre-`FEAT-…-c4af` form; `git-flow.md` carries exactly one Step 2p paragraph and it is docs-only;
`orchestrator/SKILL.md` makes no claim about what `product-manager` passes; the `off` path across
the union diff adds no token to any PM-driven invocation"

Phase 4 check list (written before the edits it constrains):

- **P4-C1** — `grep -rn -- '--parallel' plugins/my-skills/skills/product-manager/` returns nothing.
- **P4-C2** — `git diff plugins/my-skills/skills/product-manager/SKILL.md` is **empty**. The
  parent feature's only PM edit is this one line, so an empty diff *is* the byte-identity proof.
- **P4-C3** — `git-flow.md` contains exactly one occurrence of "Step 2p", it is a blockquote
  paragraph adjacent to the Step 0 paragraph, and it introduces no flag or command-surface change.
- **P4-C4** — no sentence in `orchestrator/SKILL.md` asserts what `product-manager` passes.
- **P4-C5** — across the union diff, no hunk lands inside a `Prompt to send:` fenced block for
  Steps 1, 2, 3, 3b, 4, or 5.

Plan tasks remaining: 15 unchecked

---

### 2026-08-07T01:53:20Z | CODER

Completed task: "Assert every Phase 3 structural check passes, and re-read the `lanes` →
*Owned-glob rejection* heading in `references/config.md` to confirm every one of the five pointers
names a heading that actually exists"

`grep -rn '\.orchestrator/config\.md|references/config\.md'` over the orchestrator skill now
returns:

| Site | Form | Reads from | Target heading | Exists |
|---|---|---|---|---|
| `SKILL.md:14` (pre-existing) | `references/config.md` | skill dir | file | ✓ |
| `SKILL.md:52` | copy instruction, not a pointer | — | — | n/a |
| `SKILL.md:60` | summary line item | — | — | n/a |
| `SKILL.md:257` | `references/config.md` → `parallelism` | skill dir | `### \`parallelism\`` (`config.md:24`) | ✓ |
| `SKILL.md:278` | `references/config.md` → `lanes` | skill dir | `### \`lanes\`` (`config.md:41`) | ✓ |
| `SKILL.md:939` | `references/config.md` → `lanes` | skill dir | `### \`lanes\`` (`config.md:41`) | ✓ |
| `architect.md:157` | `.orchestrator/config.md` → `lanes` → *Owned-glob rejection* | materialized agent | `config.md:51`, inside `### \`lanes\`` | ✓ |
| `architect.md:161` | `.orchestrator/config.md` → `lanes` | materialized agent | `### \`lanes\`` (`config.md:41`) | ✓ |

Note on *Owned-glob rejection*: it is a **bolded named subsection lead** inside `### \`lanes\``,
not an `###`-level heading. It is uniquely named (one occurrence in the file), so the pointer
resolves unambiguously. Recorded rather than "corrected" — the pointer form is the one the parent
plan authored and it is unambiguous as written.

P3-C1…P3-C5 all pass. Copy-list bullet count = 4 (artifact-format.md, config.md, html-templates,
`.cjs` scripts) and the sentence now reads "Re-copy all four". ✓

Plan tasks remaining: 16 unchecked

---

### 2026-08-07T01:52:40Z | CODER

Completed task: "Confirm no normative content was copied out of `config.md` into `SKILL.md` or
`architect.md` by this phase — the fix makes the pointer reachable, it does not inline the target"

Confirmed. The only prose added to `SKILL.md` in this phase is the B3 copy-list bullet and its
parenthetical, which describes *what the file is* (`the normative key/lane/glob reference the role
templates point at; distinct from .orchestrator/config.json, which holds the resolved values`) —
it restates no key table, no lane grammar, and no item of the owned-glob rejection list. The
rejection list still has exactly one normative copy, at `references/config.md:51`.

Plan tasks remaining: 17 unchecked

---

### 2026-08-07T01:52:15Z | CODER

Completed task: "Confirm `templates/architect.md`'s two `.orchestrator/config.md` references are
left unchanged and now resolve, since `architect.md` is materialized into `target/.claude/agents/`
and cannot read the skill's `references/`"

Both left byte-unchanged (`architect.md:157`, `:161`). B3 step 1 materializes `templates/{role}.md`
into `target/.claude/agents/{role}.md`, so the architect runs with no access to the skill's
`references/` — `.orchestrator/config.md` is the only form that can work for it, and after this
phase that path exists.

Plan tasks remaining: 18 unchecked

---

### 2026-08-07T01:51:50Z | CODER

Completed task: "Change the three `.orchestrator/config.md` references inside `orchestrator/SKILL.md`
(Step 0b `parallelism` resolution, Step 0c lane validation, and the Rules section's glob-rejection
pointer) to `references/config.md`, matching the existing form at `SKILL.md:14`"

`SKILL.md:257` (Step 0b), `:278` (Step 0c), `:939` (Rules). `SKILL.md` executes in the caller's
session with the skill directory available — same reader as the pre-existing `:14` pointer.

Plan tasks remaining: 19 unchecked

---

### 2026-08-07T01:51:20Z | CODER

Completed task: "Update B3's \"Re-copy all three on every bootstrap\" sentence so its count matches
the new item total, and add `.orchestrator/config.md` to B3 step 4's printed bootstrap-summary line"

"Re-copy all three" → "Re-copy all four" (`SKILL.md:54`); summary line at `SKILL.md:60` now lists
`.orchestrator/config.md`.

Plan tasks remaining: 20 unchecked

---

### 2026-08-07T01:50:55Z | CODER

Completed task: "Add `references/config.md` → `.orchestrator/config.md` to Bootstrap B3 step 2's
copy list, alongside `references/artifact-format.md`"

`SKILL.md:52`. The step's bolded title also gained "+ config reference" so the title matches the
list it introduces. The bullet carries a disambiguating parenthetical because
`.orchestrator/config.md` (normative reference, copied here) and `.orchestrator/config.json`
(resolved values, written by B3 step 3) now sit side by side in the same directory.

Plan tasks remaining: 21 unchecked

---

### 2026-08-07T01:50:10Z | CODER

Completed task: "Write the Phase 3 structural check list: `references/config.md` appears in B3
step 2's copy list and B3 step 4's summary; the \"Re-copy all …\" count matches the new item total;
every `.orchestrator/config.md` reference in the repo sits in a file that is itself materialized
into the target project; every `references/config.md` reference sits in a file that reads the skill
directory; the owned-glob rejection list still has exactly one normative copy"

Phase 3 check list (written before the edits it constrains):

- **P3-C1** — `references/config.md` → `.orchestrator/config.md` appears in B3 step 2's copy list,
  and `.orchestrator/config.md` appears in B3 step 4's summary line.
- **P3-C2** — the "Re-copy all …" sentence's number equals the number of bullets in the copy list.
- **P3-C3** — every surviving `.orchestrator/config.md` *pointer* lives in a file materialized into
  the target project (i.e. `templates/*.md`, copied by B3 step 1). None lives in `SKILL.md`, which
  is never materialized.
- **P3-C4** — every `references/config.md` pointer lives in a file that reads the skill directory
  (i.e. `SKILL.md`, which runs in the caller's session).
- **P3-C5** — the owned-glob rejection list has exactly one normative copy, at
  `references/config.md` → `lanes` → *Owned-glob rejection*. No phase-3 edit inlines any of it.

Plan tasks remaining: 22 unchecked

---

### 2026-08-07T01:48:30Z | CODER

Completed task: "Assert every Phase 2 structural check passes, and trace the `PACT` lane map's
`Lane plan ID` column through `artifact-format.md` → `PACT` ID resolution to confirm the join reads
the same IDs the lane architects were given"

`grep -n 'newid FEAT'` over `orchestrator/SKILL.md` returns five hits, all accounted for:
- `:149` — the `newid()` generator definition (a code fence listing every prefix), not an allocation.
- `:422` — Step 2, the single-plan sequential path. `off`-run only, not a lane ID.
- `:503` — Step 2c. **The one lane-`FEAT` allocation instruction.** (P2-C1 ✓)
- `:515`, `:517` — Step 2L, both inside the *prohibition* and its rationale, no imperative. (P2-C2 ✓)

P2-C3 ✓ — spawn line now reads `ID to use: {the FEAT-<id> Step 2c assigned to this lane}`;
"that lane's" (which read as "allocate one for that lane") is gone.
P2-C4 ✓ — the no-directory-scan rationale survives in 2L and now explains 2c's pre-generation
rather than a second allocation.

**End-to-end ID trace.** `newid FEAT` × N at Step 2c (`SKILL.md:503`) → passed into the contract
architect's prompt as `Lane plan IDs to use (verbatim, one per lane)` (`:490`) → architect writes
them into the `PACT` lane map's `Lane plan ID` column (`templates/architect.md` → lane-map region,
"Lane plan IDs are **pre-generated by the orchestrator and passed to you** — use them verbatim") →
Step 2L hands each lane architect that same ID (`:521`) → the join resolves the lane plan set from
that column (`references/artifact-format.md` → **`PACT` ID resolution**, step 2: "the `Lane plan
ID` column gives one `FEAT` ID per lane"). One allocation, four readers, no second generator on the
path. ✓

Plan tasks remaining: 23 unchecked

---

### 2026-08-07T01:48:05Z | CODER

Completed task: "Confirm Step 2c's \"Pre-generate every lane `FEAT` ID with `newid FEAT`
**before** this spawn\" sentence is now the only allocation instruction, and that its
cross-reference to Step 2L still resolves after the 2L rewrite"

`SKILL.md:503` left unedited and is now the only lane allocation instruction. Its `(see Step 2L)`
pointer still resolves — `### Step 2L` is a real heading — and now reads better than before: it
leads to the reuse rule and the silent-re-generation rationale, i.e. the complement of the
allocation rather than a duplicate of it.

Plan tasks remaining: 24 unchecked

---

### 2026-08-07T01:47:40Z | CODER

Completed task: "Change the Step 2L spawn line from `ID to use: {that lane's FEAT-<id>}` to
`ID to use: {the FEAT-<id> Step 2c assigned to this lane}`"

`orchestrator/SKILL.md:521`.

Plan tasks remaining: 25 unchecked

---

### 2026-08-07T01:47:15Z | CODER

Completed task: "Replace Step 2L's opening generate instruction with the reuse instruction"

`orchestrator/SKILL.md:515–517`. Step 2c is named as the sole allocation site; the set is reused
verbatim; `newid FEAT` a second time is prohibited outright. The no-directory-scan property is kept
and re-pointed: it is what makes concurrent allocation safe **and** what makes an accidental
re-generation silent (nothing to collide with → always succeeds → always a different set → lane
plans no longer match the frozen `PACT` lane map, which is what the join reads).

Plan tasks remaining: 26 unchecked

---

### 2026-08-07T01:46:30Z | CODER

Completed task: "Write the Phase 2 structural check list: `SKILL.md` contains exactly one
instruction to generate lane `FEAT` IDs and it is in Step 2c; Step 2L contains no `newid FEAT`
imperative; the 2L spawn line names the 2c-assigned ID unambiguously; the no-directory-scan
rationale survives somewhere it still explains 2c's pre-generation"

Phase 2 check list (written before the edits it constrains):

- **P2-C1** — `grep -n 'newid FEAT' SKILL.md`: every hit is either the generator definition
  (Step 0 code fence), Step 2's single-plan sequential allocation, Step 2c's lane pre-generation,
  or a Step 2L *prohibition*. Exactly one lane-`FEAT` allocation instruction, and it is in 2c.
- **P2-C2** — Step 2L contains no imperative mood `newid FEAT`.
- **P2-C3** — Step 2L's spawn line reads `ID to use: {the FEAT-<id> Step 2c assigned to this lane}`.
- **P2-C4** — the "allocated without listing the directory" rationale still appears in Step 2L and
  now explains why re-generation is *silent*, not why 2L should generate.
- **P2-C5** — the ID trace 2c → `PACT` prompt → lane map column → 2L spawn → join resolution is
  unbroken and reads one set at every hop.

Plan tasks remaining: 27 unchecked

---

### 2026-08-07T01:44:55Z | CODER

Completed task: "Assert every Phase 1 structural check passes by walking the document
top-to-bottom once as a `lanes` run and once as an `off` run, confirming each visits exactly one
of the two paths"

Walk as a **`lanes` run**: 0b (prints `parallelism: lanes`) → 0c → 1 → 2p.0…2p.5 → **2p.6 fork →
Step 2c** → Step 2 gate reads `off`, skipped → 2c → 2L → Step 3 gate reads `off`, skipped → 3L →
3j → 3b → 4 → 5 → 7. Visits exactly one of {Step 2, Step 2c} and one of {Step 3, Step 3L}. ✓

Walk as an **`off` run**: 0b already declares "Steps 0c, 2p, 2c, 2L, 3L, and 3j do not exist for
this run … follow Steps 1 → 2 → 3 → 3b → 4 → 5 → 7 exactly as written" → 1 → Step 2 (gate matches)
→ Step 3 (gate matches) → 3b → 4 → 5 → 7. ✓

Third path checked — `ask` resolving to `off` (ladder pick, 2p.4 guard, or 2p.3 viability
fallback): 2p.0 says "go to Step 2", 2p.3 says "continue to Step 2", and the new 2p.6 says the
same, so all three exits agree. ✓

P1-C1…P1-C6 all pass. Grep confirms exactly two `Sequential path only` gates (Steps 2 and 3,
lines 420 and 451) and the four pre-existing `Parallel path only` gates (2c, 2L, 3L, 3j)
unchanged; no other step gained gate text.

Plan tasks remaining: 28 unchecked

---

### 2026-08-07T01:44:40Z | CODER

Completed task: "Confirm Step 2c's existing \"Replaces Step 2 for this run\" sentence and Step 3L's
equivalent still read correctly now that the fork is declared upstream — keep them as
confirmation, not as the only statement of the branch"

Both left unedited and both still read correctly as local confirmation of an upstream fork:
Step 2c — "Replaces Step 2 for this run; Step 2's single-plan path is what an `off` run uses";
Step 3L — "Replaces Step 3 for this run; an `off` run uses Step 3's single-coder path unchanged".
Step 2L's gate has no replacement clause and correctly stays that way — 2L has no sequential
counterpart to replace.

Plan tasks remaining: 29 unchecked

---

### 2026-08-07T01:44:20Z | CODER

Completed task: "Add the mirror gate under the Step 3 heading: *Sequential path only* (resolved
`parallelism` is `off`); on the parallel path Step 3L replaces this step, and the simplification
pass moves to Step 3j.3"

`orchestrator/SKILL.md:451`. **Deviation recorded (disambiguation, not a rewrite):** the task text
names "Step 3j.3" for the relocated simplification pass, but `#### 3j.3` is *Downstream roles at
the join* — `simplify` is **item 3 of Step 3j's ordered list**. Written as "Step 3j, item 3 of its
ordered list, run once over the union diff instead of once per lane" so the cross-reference
resolves to the place `simplify` actually runs, satisfying AC 12.

Plan tasks remaining: 30 unchecked

---

### 2026-08-07T01:44:05Z | CODER

Completed task: "Add the mirror gate under the Step 2 heading: *Sequential path only* (resolved
`parallelism` is `off`); on the parallel path Step 2c replaces this step"

`orchestrator/SKILL.md:420`. Phrasing inverts the existing `Parallel path only` shape verbatim
(P1-C4).

Plan tasks remaining: 31 unchecked

---

### 2026-08-07T01:43:40Z | CODER

Completed task: "Add the closing branch line to Step 2p (after the `lanes`/`full` direct-apply
sentence at the end of 2p.5)"

Added as a new `#### 2p.6 — The fork (where this step hands off)` subsection at
`orchestrator/SKILL.md:411`, rather than as a bare trailing sentence inside 2p.5. Reason: 2p.5 is
the `ask`-ladder subsection and only fires for `ask`, but the fork applies to **every** 2p exit
(ladder pick, direct apply, 2p.4 guard, 2p.3 fallback). A sentence buried at the end of 2p.5 would
have reproduced MF-1 for the `lanes`/`full` direct-apply path — the exact defect being fixed. Both
branches are named in one place, satisfying AC 1.

Plan tasks remaining: 32 unchecked

---

### 2026-08-07T01:41:10Z | CODER

Completed task: "Write the Phase 1 structural check list: Step 2p ends with an explicit go-to-2c
instruction naming both branches; Step 2 and Step 3 each carry a gate naming their replacement
step; the three gate sentences use the same phrasing shape as the existing `Parallel path only`
gates; no gate text is added to any step that runs on the `off` path only"

Phase 1 check list (written before the edits it constrains):

- **P1-C1** — Step 2p's last paragraph (end of 2p.5) states, as an imperative, that adopting
  `lanes`/`full` goes to Step 2c and that Steps 2 and 3 do not run for that run; and that `off`
  continues to Step 2. Both branches named in one place.
- **P1-C2** — `### Step 2 —` is immediately followed by a gate naming Step 2c as its replacement.
- **P1-C3** — `### Step 3 —` is immediately followed by a gate naming Step 3L as its replacement
  and saying where the simplification pass goes on the parallel path.
- **P1-C4** — All three new sentences reuse the existing `**Parallel path only** (resolved
  `parallelism` is …)` shape, inverted to `**Sequential path only** (resolved `parallelism` is
  `off`)`, so the two families read as one mechanism.
- **P1-C5** — Gate text lands on exactly Steps 2 and 3. No step that runs on **both** paths
  (1, 3b, 4, 5, 6, 7) gains a gate, and no `Parallel path only` gate is added to an off-path step.
- **P1-C6** — Walking the document as a `lanes` run and as an `off` run each visits exactly one of
  {Step 2, Step 2c} and exactly one of {Step 3, Step 3L}.

Tasks remaining: 33 unchecked

---

### 2026-08-07T01:39:01Z | CODER

Session started. Plan status → IN_PROGRESS.

---

### 2026-08-07T01:35:33Z | ARCHITECT

Created plan `FIX-20260807T013331Z-d607`. Type: fix. Tasks: 34 across 6 phases.

Source CR: `CR-20260807T012541Z-a43d` (REQUEST_CHANGES; 4 Must Fix, 4 Should Fix)
against `FEAT-20260807T004018Z-c4af`.

Task mapping:
- MF-1 (parallel run never branches away from Steps 2/3) → Phase 1, 6 tasks.
- MF-3 (lane `FEAT` IDs generated twice) → Phase 2, 5 tasks.
- MF-2 (five refs point at unmaterialized `.orchestrator/config.md`) → Phase 3, 7 tasks.
- MF-4 (`product-manager` scope breach) → Phase 4, 6 tasks.
- SF-1…SF-4 → Phase 5, 9 tasks, all annotated `(optional)`.
- Union verification + CR closure → Phase 6, 3 tasks.

**MF-4 ruling — restore scope.** The orchestrator flagged that the `--parallel off`
edit to `product-manager/SKILL.md` originated in the mandatory post-coder `simplify`
pass, not the coder. Provenance noted; verdict unchanged. Reverting, because:
(1) AC 13 is conditional and pre-authorized a specific remediation for exactly the
case that fired — a bounded docs-only mirror, not a flag; (2) the flag is a behavior
regression, silently overriding a project that deliberately sets `parallelism: lanes`,
which PM does not need since lane fan-out is a within-run concern and the orchestrator
still ends at one `READY_TO_COMMIT` over one union diff; (3) it breaks AC 14's
byte-identical backward-compat claim; (4) `git-flow.md` already documents PM answering
the orchestrator's Step 0 question with option 1, so answering Step 2p the same way
follows the Mirror machinery convention while a flag invents a parallel mechanism.
The "legitimize via amended spec" alternative stays open and was deliberately not
taken here — authorizing a PM behavior change inside a FIX plan derived from the CR
that flags it would launder the scope breach rather than resolve it.

**SF-1 ruling** — keep `full`'s per-lane reviewer; state its purpose (early lane-local
signal fed into the join, not remediation) and price `ask` ladder option 3. Dropping it
would remove spec'd `full`-mode behavior that `reviewer.md` Step 1a already supports.

**SF-2 ruling** — keep the Step 2L global architect barrier; document the
recoverability rationale so a future simplify pass cannot remove it silently.

**Verification posture**: doc-only plan touching zero files under `scripts/`, so no
command gate matches any phase's touched paths and no `## Verification (per phase)`
section was emitted. Each phase opens with a structural check list and closes with an
assertion task, per `PROJECT-CONTEXT.md` → Test tooling and the parent plan's shape.
Phase 6 re-runs the renderer suite once over the union diff as a collateral-regression
guard only.

Status: PLANNED. Ready for coder.

---

## Handoff

| From      | To        | Condition                  | Action                                                        |
| --------- | --------- | -------------------------- | ------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260807T013331Z-d607`        |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260807T013331Z-d607`     |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`                 |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260807T013331Z-d607`           |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`              |
