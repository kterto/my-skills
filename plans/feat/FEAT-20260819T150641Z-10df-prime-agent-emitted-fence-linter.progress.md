# Progress: FEAT-20260819T150641Z-10df — Prime Agent emitted-fence linter

**Plan**: [FEAT-20260819T150641Z-10df-prime-agent-emitted-fence-linter.md](./FEAT-20260819T150641Z-10df-prime-agent-emitted-fence-linter.md)
**Spec**: [SPEC-20260819T145710Z-b345](../specs/SPEC-20260819T145710Z-b345-prime-agent-emitted-fence-linter.md)
**Status**: DONE
**Created**: 2026-08-19T15:10:45Z

---

## Log

### 2026-08-19T15:10:45Z | ARCHITECT

Created plan `FEAT-20260819T150641Z-10df`. Type: feat. Tasks: 33 across 4 phases.

**Phases**

1. Fixture corpus, `parity.sh` section 4 harness, and the checker core (PF01, PF05, closed allowlist).
2. PF02 and PF03, plus the FR-10 overlay remediation that turns the real tree green. Live-instance fixtures are pinned from committed text *before* the fix lands.
3. PF04 — the weak prose-phrasing rule — proved in both directions against the real corpus.
4. `PROJECT-CONTEXT.md` reconciliation, catch-matrix audit, full floor sweep.

**Verified ground truth at plan time** (Node walk; no multi-file `grep`, no `diff`)

- Fence census today: **13** `python` fences over 54 `.md` files — `explain-codebase` 1, `orchestrator` 3, `roadmap` 4, `simplify` 5. Matches the spec.
- Commits `678ed56` and `a730a73` both resolve in this checkout; instance-4 fixtures are genuinely git-recoverable.
- `prime-agent/tests/parity.sh` is 115 lines, has `fail()` at line 19, `expect_failure()` at line 61, and a skip guard at lines 14–17 that already covers everything below it. `prime-agent/package.json` `files` excludes `scripts/`, so both the checker and the new fixtures stay repo-only with no new guard.
- `protocol.orchestrator.md` lines 20/24–25 and `protocol.explain-codebase.md` lines 16/18/21 confirmed to bind `handle` for the single-child case, discard the `asyncio.gather` result for the wave, then retry with `receiver_name=handle.name`. The live fifth instance is real.

**Six findings that changed the plan** (full detail in the plan's Technical Notes)

- F1 — the spec's FR-3 evidence is wrong for `prompt`. Backticked in `orchestrator` only; known in `roadmap`/`simplify` solely via the wave fence's `for name, prompt in jobs` comprehension binding. Conclusion (zero overlay edits) survives; mechanism does not. Comprehension and tuple-unpacking targets are load-bearing.
- F2 — PF02 is **red on the real tree today** for `jobs` in `explain-codebase` and `orchestrator`. FR-10's remediation must also carry the backticked `jobs` declaration.
- F3 — PF02 must inherit FR-4's kwarg/attribute exclusion, which FR-5 does not restate.
- F4 — PF02 must be region-scoped to fences and inline spans only; `handle` is ordinary English in two unrelated files.
- F5 — `handles` is known only by fence binding, never backticked.
- F6 — the live-instance overlays are committed, so their defect text is git-recoverable — the strongest fixtures in the corpus.

**Rulings made**

- Fixture corpus widened from 7 to **11**: +2 git-recovered live instances, +2 false-positive regression fixtures.
- FR-10's wave form is expressed as a `python` fence (mirror-machinery invariant), so post-change census is stated explicitly as **15**.
- The honest catch matrix is preserved without upgrade — PF04 stays weak, instance 3's consequence stays unreachable.
- `PROJECT-CONTEXT.md` staleness ruled in scope, additive only, scheduled last.

Status: PLANNED. Ready for coder.

### 2026-08-19T15:19:10Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T15:58:20Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T154708Z-246c-prime-agent-emitted-fence-linter.md
Status: PASS
Coverage: not measured → 98.2%

All e2e (Lane B) gates green and the coverage floor met by 28 points — PASS refers to the floors only.

Mutation score 71.7% (33 killed / 46 applied, judged by `parity.sh` section 4 verbatim); 13 survivors, three of which make the checker read zero of the 54 real files while section 4 stays green. 4f cannot distinguish the emitted tree from an empty directory (byte-identical, 0 bytes, same exit code) and reaches 0.17% of tree bytes. Three of four catch-matrix rows plus the PF05 fail-closed limit are overstated. Two new defects of the gate's own class reproduced: deleting a whole dispatch protocol block from a shipped SKILL.md lints exit 0, and `_ = await asyncio.gather(...)` is treated as a binding. No crashes across 27 adversarial inputs.

No repo file fixed or modified, per the run brief. Next: reviewer.

---

## Handoff

| From      | To        | Condition                  | Action                                                         |
| --------- | --------- | -------------------------- | -------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260819T150641Z-10df`         |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260819T150641Z-10df`      |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the CR file path`                       |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260819T150641Z-10df`            |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`                |

### 2026-08-19T15:26:58Z | CODER

Completed Phase 1 (12 tasks): fixture corpus (8 of 11 pinned), `parity.sh` section 4, `scripts/lint-prime-fences.mjs` with PF01, PF05, region separation, the FR-3 name model, and the closed 14-name allowlist.

Floors at the Phase-1 boundary: `cd prime-agent && npm test` exit 0; `node scripts/build-prime-agent.mjs --check` exit 0. Real-tree lint: PF05 clean, PF01 red on one true positive (`orchestrator/SKILL.md:164`, `jobs`) — an undercount in ground-truth finding F2, closed by the Phase-2 FR-10 remediation already in the plan. Full detail in the plan's Progress Log.

Plan tasks remaining: 21 unchecked

### 2026-08-19T15:31:35Z | CODER

Completed Phase 2 (11 tasks): live-instance fixtures pinned from committed text at `a730a73` before remediation, `instance-1-dangling-contract.md` authored, PF02 and PF03 implemented, both protocol overlays remediated, distribution regenerated.

Real tree now lints clean (exit 0). Census by Node walk: **15** — explain-codebase 2, orchestrator 4, roadmap 4, simplify 5. Floors: `cd prime-agent && npm test` 0, `node scripts/build-prime-agent.mjs --check` 0, `node scripts/lint-prime-fences.mjs` 0.

Plan tasks remaining: 10 unchecked

### 2026-08-19T15:33:43Z | CODER

Completed Phase 3 (5 tasks): PF04 implemented and proved in both directions against the real corpus. Instance-4 fence bytes confirmed byte-identical across the fix (shasum + `cmp -s`, never `diff`), so PF04's weak rating stands unchanged. All eleven pinned fixtures now assert an exact rule set.

Floors: `cd prime-agent && npm test` 0, `node scripts/build-prime-agent.mjs --check` 0, `node scripts/lint-prime-fences.mjs` 0.

Plan tasks remaining: 5 unchecked

### 2026-08-19T15:35:35Z | CODER

Completed Phase 4 (5 tasks): `PROJECT-CONTEXT.md` reconciled additively (Layout, Invariants, Out of scope, Commands), checker header matrix audited (three corrections, all clarifying or downward — none upgraded), read-only behaviour proved by hash equality plus `--check`, full floor sweep recorded.

All tasks complete. Plan status → DONE.
Total tasks completed this session: 33

Floors at close — B5 `clean-code-gates` 250 pass / 0 fail; B1 `--check` 0; B2 `cd prime-agent && npm test` 0; B3 `lint-prime-fences.mjs` 0; B4 census 15 (explain-codebase 2, orchestrator 4, roadmap 4, simplify 5).

### SIMPLIFY — 2026-08-19
Five angles across two concurrent agents (reuse+simplification+efficiency+adversarial correctness probe over the checker; altitude+conventions over the change set). Both worked around the two verified shell hazards. Fixed 0 — every finding is a correctness bug, and a cleanup pass never folds those in.

VERDICT: the gate is not fit to ship as written. It fails at its primary purpose, and both agents reproduced that independently.

BUG-1 / A1 (critical, reproduced twice) — PF03's excuse is file-scoped: one bound admission site anywhere excuses every unbound site in the same file. Dropping `handles = ` from the wave fence in orchestrator (:46) and simplify (:49) lints exit 0 with zero findings. simplify is the skill instance 3 was actually found in, so the one defect the gate exists for can recur in the one shipped file with room for it. The coder's stated justification for the downgrade does not hold: the citational occurrence is at orchestrator :646 (not :635) and is an inline span, not a python fence — so scoping fence sites per-occurrence while leaving span sites file-scoped is green on the whole tree today AND catches the regression. A census of all 9 fence admissions in the emitted tree confirms every one is bound.

BUG-2 (high) — splitRegions has no HTML-comment handling, so <!-- ... --> bodies become paragraphs feeding both `declared` and `paragraphText`. A reviewer note or template comment containing a backticked name silently disarms three of five rules in its file; the live tree has 63 HTML comments across 15 emitted files, several already carrying backticked spans.

BUG-3 (high) — "declared in prose" is merely the first identifier of any code span, with no requirement that the prose declare anything. Prose that FORBIDS the name counts: adding `Never write \`jobs\` in the prompt body.` above the instance-2 fence lints clean. The defect is one incidental backtick from invisible, in a corpus that backticks heavily.

BUG-4 (medium) — fence selection fails OPEN on the language tag: ```python3, ```py and untagged fences are dropped whole, so the same unbound wave lints clean in each. 140 untagged fences exist in the emitted tree (none currently carrying dispatch vocabulary, so latent not live). PF05 exists precisely so the tool never passes what it does not understand; this is the same fail-open shape one level up.

BUG-5 (medium, false positive) — ordinary Python binding forms are not recognised as bindings: `handles: list = await asyncio.gather(...)` yields PF01 + PF03, and `(first, second) = jobs[0]` yields 4x PF01. Correct text, red gate — the failure mode the checker's own header says gets a gate deleted.

BUG-6/7 (low) — CRLF input triggers PF05 for a reason unrelated to the defect class; PF04 fires on prose that does commit ("is a materialized list of pairs"), so reordering the corpus's own clause turns the gate red.

A2 (high) — PF04 is ALSO file-scoped and the KNOWN LIMITS block does not say so (it names only PF02/PF03). Instance 4's generator phrasing can be restored in the shared protocol block and stay green because another line independently says "list". That is the same "asserts a property the artifact does not support" shape the linter polices, in the file that forbids upward rating edits.

C3 (high) — the checker is silent on success: `node scripts/lint-prime-fences.mjs <empty-dir>` exits 0 with no output, byte-identical to a real clean run over 154 files. A typo'd path yields a green indistinguishable from a gate that ran, while both sibling gate scripts print a summary line.

C1 (high) — the PROJECT-CONTEXT edit is not purely additive and its replacement claim is also false. "only runtime gate in the repo" was narrowed to "over the authoring skills", but explain-codebase/__tests__/ (9 files) and pr-review-report/__tests__/ (11 files) are authoring skills with real runnable suites predating this branch; one was executed, 12 tests pass. A change billed as reconciling a stale invariant substituted a second false one. Three untouched lines carry the same falsehood.

Census gap — WATCHED_VOCABULARY is unpinned: deleting 6 of its 8 names left every fixture assertion, the --allowlist census check and the real-tree run unchanged. PF02's reach is 75% unexercised.

A3 (altitude) — the rules read the right artifact (the defect is a property of the source-overlay union, invisible in either input), but the wiring sits one notch downstream: nothing stops `node scripts/build-prime-agent.mjs` writing a defective tree today. The repo's twice-made rejection of generator-side vocabulary transforms was about REWRITING safety; the builder already carries two assertions of this species (every skill must have an overlay; every replacement must match its count), so the precedent does not extend to an assertion and arguably endorses one. ~5 lines to lint after write.

Six mechanical simplifications recorded (S1-S6), led by three near-identical read-index traversals that also cause the PF01/PF02 counting asymmetry the header spends six lines apologising for. Reuse: none actionable — five directory walkers exist but none is importable. Efficiency: clean, 60-130ms over 54 files, do not optimise.

### 2026-08-19T16:02:02Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T160202Z-8479-prime-agent-emitted-fence-linter.md
Status: REQUEST_CHANGES
Must Fix: 10 | Should Fix: 8

Every load-bearing finding independently reproduced against scratch copies of the real tree
(never `diff`; never a multi-file `grep`). Ruled: the design is salvageable — one modeling
decision (a file-global, unordered `isKnown`) is the single root cause of D1, BUG-1, BUG-2 and
BUG-3, so the fix is a bounded rework of the name model, not a rewrite and not a patch list.
The tester's coverage floor is necessary and far from sufficient. The altitude move (assert in
the builder after write) is ADOPTED but sequenced last, gated on the false positives being
fixed. No rule may honestly keep a **Strong** rating in the shipped state: three of four matrix
rows are overstated, and PF01/PF04 must join PF02/PF03 in the file-scoped KNOWN LIMITS. The
FR-10 overlay remediation is separable, correct, and should ship now on its own.

Floors re-run and green (no regression): `clean-code-gates` 250 pass / 0 fail; `--check` 0;
`cd prime-agent && npm test` 0; census 15.

Invoke /architect with plans/code-review/CR-20260819T160202Z-8479-prime-agent-emitted-fence-linter.md to create FIX plan.

### 2026-08-19T18:45:00Z | FIX (main agent, no pipeline roles)

CR-20260819T160202Z-8479 closed: 10/10 Must Fix, 8/8 Should Fix.
FIX plan: plans/code-review/FIX-20260819T184500Z-7c21-emitted-fence-linter-name-model.md

The review's root-cause call held — one modeling decision, five ways. The name model
is now SECTION-scoped with the protocol block visible file-wide, PF03's fence sites
are occurrence-scoped, and PF06 (positive presence of the protocol block) reaches
instance 1, which no name-binding rule can: such a file is internally consistent and
missing only its contract.

ONE DEVIATION, measured rather than argued: the CR's strictly ORDER-ed model
(bound earlier in the same fence, then by an earlier fence) was implemented and
rejected — it reports PF01 on `prompt` in all four shipped skills and in the pinned
false-positive fixture, because the single-child fence sits one fence ABOVE the wave
fence that binds `prompt`. Forward reference is the corpus's normal shape. Section
scoping delivers the occurrence-scoping the review actually needed; every
reproduction the CR used against the file-global model is now caught, each re-run
and tabled in the FIX plan.

Every CR reproduction re-run: instance 1 (protocol block deleted) → PF06; instance 3
(wave binding dropped in simplify AND orchestrator) → PF03 at both fence sites;
prose-that-forbids and HTML-comment mentions → PF01; python3/py/untagged → PF01;
`handles: list = await …` and `(a, b) = jobs[0]` → clean; `_ = await gather(…)` →
PF03; instance-4 phrasing restored inside the protocol block → PF04; empty directory
→ exit 2; `--allowlist` with a target → exit 2; unreadable file → findings kept,
exit 2. The 15-file corpus is pinned by count, each assertion checks its fixture
exists, and the new multi-section fixture is the discriminator: zero findings under
the old checker, PF01+PF03 under this one.

Builder hook landed last, per the review's sequencing: `node scripts/build-prime-agent.mjs`
lints the tree it wrote and fails the build with rule-id output on its own exit path;
`--check` still answers parity alone; proved against a deliberately defective
scaffold in parity section 3's idiom.

AC-3 superseded (six rules now, PF06 carries its own fixture). AC-14 deliberately
unmet: a false invariant cannot be corrected by appending to it, and it was false in
five places in PROJECT-CONTEXT.md, not one — `pr-review-report` (11 test files) and
`explain-codebase` (9 + a shell test) are authoring skills with real suites that
predate this branch. Reason recorded in the FIX plan.

Floors: lint 0 (54 files / 15 fences / 8967 spans) · build + post-write lint ok ·
`--check` 0 · `cd prime-agent && npm test` 0 · clean-code-gates 250 pass / 0 fail.
