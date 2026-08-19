# Progress: FIX-20260819T135107Z-3895 — Prime RLM dispatch protocol block and validator keyword-set hygiene

**Plan**: [FIX-20260819T135107Z-3895-rlm-dispatch-protocol-keyword-hygiene.md](./FIX-20260819T135107Z-3895-rlm-dispatch-protocol-keyword-hygiene.md)
**Status**: QA_READY_WITH_WARNINGS
**Created**: 2026-08-19T13:53:08Z

---

## Log

### 2026-08-19T14:12:20Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: **27** (Phase 0: 2, Phase 1: 7, Phase 2: 8, Phase 3: 10).

**Lane A (SF-1 + SF-2/3 doc)** — one file: `clean-code-gates/__tests__/schema.test.cjs`.
TDD honoured: the AC-19 test was written first and confirmed RED with exactly the expected failure
(six documentary keywords missing from the four-element set), then made GREEN by splitting
`$schema`/`$id` into `CORE_KEYWORDS` and completing `ANNOTATION_KEYWORDS` to all eight annotation
keywords. Both sets are registered in one `NON_ASSERTING_SETS` registry that `unhandledKeywords`
*and* the disjointness guard read, so the production filter and its guard cannot drift. The
disjointness guard was generalized first and confirmed green before *and* after the split. AC-20 is
a docblock only — proven comment-only mechanically (comment-stripped before/after both 16977 bytes).
**249 → 250 pass, 0 fail. No test deleted or weakened**; the single changed existing assertion is
the disjointness test, renamed and widened because the old one hard-coded a set name that would have
left `CORE_KEYWORDS` unchecked after the split.

**Lane B (MF-1/2/3 + SF-4)** — overlays only, `prime-agent/skills/**` never hand-edited.
New shared `protocol.rlm-dispatch.md` carries all four AC-1 contract elements plus the read-only
clause, is registered after `preamble.md` in both overlays (4-of-4 dispatch-porting overlays now
carry a protocol block), and adds **no file** to the generated tree — 154 before and after.
`simplify`'s wave is now bound (`handles`/`by_angle`), so the retry clause's `receiver_name` resolves
to something the same emitted text binds; each angle carries the completion contract and returns
findings by message, restoring the bound AC-17 lost. "Wait for every angle" is now defined against
completion messages, not `gather` resolving, with an un-joinable angle routed to the single-pass
fallback and its disclosure line. `roadmap`'s scan child has a return path and the parent waits for
it before the very next line's "Using the digest"; the fallback trigger covers the
admitted-but-no-digest state.

**Two defects caught that no gate would have caught**, both recorded in the plan's Progress Log:
mirroring `explain-codebase`'s prohibition line verbatim would have broken AC-22/AC-23 by injecting
host vocabulary into two skills at once; and the block's `jobs` was unbound on a regeneration where
`--check` had already exited 0. Both fixed in the overlay, never in the generated tree.

**Floors, simultaneously:** `clean-code-gates` 250/0 · `--check` exit 0 at 11 skills / 154 files ·
`prime-agent` `npm test` exit 0. **Census unchanged:** host vocabulary 4, `subagent` in generated
`roadmap` 1 / `simplify` 0. AC-28 held throughout — zero bare-`diff` exit-status checks, zero
multi-file grep censuses. Plugin sources byte-identical to HEAD; `explain-codebase` untouched.

Ready for reviewer.

### 2026-08-19T13:57:32Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T13:53:08Z | ARCHITECT

Created plan `FIX-20260819T135107Z-3895`. Type: fix. Tasks: 26.

Source CR `CR-20260819T134321Z-bfb9` — REQUEST_CHANGES, 3 Must Fix (all Lane B, one root cause), 5 Should Fix.

- **MF-1** → shared `prime-agent/overlays/protocol.rlm-dispatch.md` listed in both overlays' `insertAfterFrontmatter` (CR Ruling 1's shape, implemented not re-litigated). Fixing it also restores the 4-of-4 dispatch-porting-overlay rule, so **no separate C1 task** (CR Ruling 2).
- **MF-2** → `simplify`'s dispatch bound, completion contract carried per angle, join rule made concrete, fallback + disclosure reachable. Restores AC-17's dropped findings-return bound.
- **MF-3** → `roadmap`'s scan child gets a return path; fallback trigger widened to the admitted-but-empty state.
- **AC-23** carried in its **amended** form as this plan's AC-22 (CR Ruling 3): exactly one `subagent` hit in generated `roadmap` — the Out-of-Scope non-site at line 87 — and zero in `simplify`. Not charged to the coder.

Should Fix rulings: **SF-1 ADOPT** (AC-16–19, highest value-per-line); **SF-2 / SF-3 DECLINE as code, ADOPT as documentation** (AC-20 — latent with zero live sites, already armed loud by `unsupportedKeywordForms`, and the walker-narrowing direction would make the coverage guard *more permissive*); **SF-4 ADOPT** (AC-21, `explain-codebase.json` precedent, file already open); **SF-5 ADOPT as carry-forward** into Technical Notes.

Ordering is load-bearing: the lanes are **not** independent — the generated tree mirrors the plugin `__tests__/`, so Lane A reddens `--check` until Phase 3's single regeneration. Phase 1 records that expected-red state rather than resolving it early.

Lane B has **no executable path and none can be written**; `--check` passes on a wrong replacement. AC-29's read-the-emitted-text task is its only real verification and is marked non-skippable.

Both shell hazards specified as binding: no bare `diff` exit status (it returns 0 on differing files here), and every census is a Node walk or one-file-per-scan (the truncating proxied `grep` is what produced the wrong AC-23 baseline).

Status: PLANNED. Ready for coder.

---

### 2026-08-19T14:21:35Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T141514Z-b51c-rlm-dispatch-protocol-keyword-hygiene.md
Status: PASS
Coverage: N/A → N/A (no coverage command; PROJECT-CONTEXT declares it advisory for doc-skill changes)
All e2e flows green. Coverage floor met.
E2E deliberately not added — no e2e framework exists and no runtime executes a SKILL.md; a synthetic harness would restate the census and give false assurance (AC-29 forbids fabricating one). AC-29's read-the-emitted-text audit is the gate.
A1 independently confirmed CLOSED: zero unbound identifiers in the final emitted text of both ports; dispatch completable end to end (admit → return → join → retry → terminating fallback). AC-22/AC-23/AC-26/AC-28 re-derived by Node walk + cmp/shasum. Lane A registry prevents drift as claimed. Floors: clean-code-gates 250 pass / 0 fail; --check exit 0 (11 skills, 154 files); prime-agent npm test green.
Carried to reviewer — SF-A: `jobs` iterated twice in the shared block, a lazily-built `jobs` silently empties `by_name`/`by_angle` and the retry path raises KeyError (reproduced). SF-B: simplify's Prime frontmatter still claims "Dual-host (Claude Code + opencode)" — SF-4's defect class surviving in the only host-vocabulary description among 11 ports. Advisory A-2: this is the only one of four protocol blocks whose join has no filesystem-observable anchor.


---

## Handoff

| From      | To        | Condition                  | Action                                                          |
| --------- | --------- | -------------------------- | --------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260819T135107Z-3895`          |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260819T135107Z-3895`       |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`                    |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260819T135107Z-3895`             |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`                 |

### 2026-08-19T14:29:56Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T142449Z-d603-rlm-dispatch-protocol-keyword-hygiene.md
Status: APPROVED
Must Fix: 0 | Should Fix: 2
Ready for QA — invoke /qa with plan ID FIX-20260819T135107Z-3895.

Cycle-2 review of the whole change set against base d214ff7. All 29 ACs met. MF-1/2/3 confirmed
closed by an independent read of the final emitted text (not by re-checking the tester's argument):
zero unbound identifiers in either port, dispatch completable end to end in both, silent-empty-review
path closed at three independent points. Floors re-run by the reviewer and green simultaneously —
clean-code-gates 250 pass / 0 fail, --check exit 0 at 11 skills / 154 files, prime-agent npm test
exit 0. Censuses re-derived by Node walk: host vocabulary 4, subagent in generated roadmap 1
(line 155, byte-identical to plugins/.../roadmap/SKILL.md:79, verified programmatically), simplify 0.

Rulings on the items carried to the reviewer:
- SF-A (`jobs` iterated twice in the shared block) — UPHELD as Should Fix (SF-1 in the CR). Reproduced
  (len(by_name)=0, KeyError on retry). Clears the bar: new to this block, one-word fix, and the
  KeyError pre-empts the terminating fallback. Below Must Fix: conditional on an authoring choice the
  prose steers away from, and no AC is unmet. Correction: the block is inherited by TWO skills
  (roadmap, simplify), not four — orchestrator and explain-codebase carry their own blocks.
- SF-B (simplify frontmatter still claims Dual-host) — UPHELD as Should Fix (SF-2 in the CR), and the
  stated mechanical constraint is FACTUALLY WRONG. build-prime-agent.mjs already applies
  applyReplacements to the frontmatter via `overlay.frontmatterReplacements` (renderSkillMd), with a
  docblock written for this exact case, and prime-agent/overlays/orchestrator.json ALREADY uses it for
  the identical defect class (CR SF-3b). Capability ships, precedent is exact, cost is one JSON entry —
  neither out of scope nor a builder-capability finding. Should not survive a third cycle.
- Advisory A-2 (join with no filesystem-observable anchor) — CONFIRMED, tester's call stands. Verified
  agent_message.send is the only form under prime-agent/ (22 occurrences, zero receive forms), but the
  same join shape ships at base in protocol.orchestrator.md and protocol.explain-codebase.md; the
  artifact-free divergence is plan-mandated (Out of Scope forbade explain-codebase-specific artefacts)
  and neither consumer produces a return artifact; a completion signal IS specified and distinguished
  from gather. Below Should Fix. Repo-level note only.

Also verified holding: the reasoned catch-all prohibition is as strong as the enumeration it replaced
(broader — a closed list is silent on unenumerated tools; supplies the reason; generalizes to the whole
body), with zero residual dispatch sites in either file confirmed one-file-per-scan. AC-22/AC-23 as
amended (87 -> 155 = exactly +68 pre-H1 lines, 13 -> 81). Lane A's NON_ASSERTING_SETS registry holds
references to the same Set objects both consumers read, so no desync path exists; the uncovered case
(unregistered set) fails red. SF-2/SF-3 decline-as-code reasoning re-derived and sound — narrowing the
walker would make the coverage guard strictly more permissive. Scope clean: exactly the seven named
files plus the parent plan's README and out-of-scope bookkeeping; Lane A touched __tests__/ only.

### 2026-08-19T14:32:37Z | QA

Precondition check: Plan FIX-20260819T135107Z-3895 status=DONE, CR=CR-20260819T142449Z-d603 CR status=APPROVED. Proceeding.

### 2026-08-19T14:34:10Z | QA

Ran: cd plugins/my-skills/skills/clean-code-gates && npm test
Result: PASS — Total: 250 | Passed: 250 | Failed: 0 | Skipped: 0

Ran: node scripts/build-prime-agent.mjs --check
Result: PASS — exit 0, "prime-agent/skills is up to date (11 skills, 154 files)"

Ran: cd prime-agent && npm test
Result: PASS — exit 0, install ok + parity ok

### 2026-08-19T14:42:00Z | QA

Gate G1 (Coverage) — Ran: node bin/gates.cjs --scope "files:__tests__/schema.test.cjs" --gates G5 --out -
Result: INAPPLICABLE — runner: "scope resolved to zero gateable files ... no verdict". defaults.cjs:31 sets node-ts root to ['src']; the one changed code file is in __tests__/, outside every gated root. Zero production files changed (git diff --numstat over src/bin/schema/defaults.cjs/README/SKILL = zero rows).

Gate G2/G3/G4/G7 (Complexity, Length, Naming, Dependencies)
Result: INAPPLICABLE — 0 gateable files changed; Lane B is markdown/JSON only. No eslint/dependency-cruiser installed and none required, since there is no gateable surface to measure.

Gate G5 (No comments)
Result: INAPPLICABLE as a gate; advisory read CLEAN — all 13 added comment lines are /** */ doc comments on declarations (allow-listed); zero inline "what" comments in function bodies.

Gate G6 (Mutation) — hand-run against the new NON_ASSERTING_SETS registry (no stryker installed)
Result: 3 mutants, 3 KILLED — P1 pollute CORE_KEYWORDS with 'minimum' -> guard RED naming CORE_KEYWORDS; P2 register new third set FUTURE_KEYWORDS={pattern} with no other edit -> guard RED naming FUTURE_KEYWORDS; P3 add '$defs' to one set only -> unhandledKeywords honours it. Probe files removed; suite re-run 250/250/0 with zero residue.

Gate G8 (Rework ratio)
Result: WARN HIGH_REWORK — aggregate (1 REQUEST_CHANGES + 1 FIX) / 2 CR = 1.00 > 0.5. Plan-scoped = 0.00 PASS.

### 2026-08-19T14:45:12Z | QA

QA suite complete.
Report: plans/qa/QA-20260819T143237Z-bda6-rlm-dispatch-protocol-keyword-hygiene.md
Status: READY_WITH_WARNINGS
Test failures: 0 | Lint errors: 0 | Type errors: 0
All blocking checks pass. Blocking defect (cycle-1 MF-1) independently confirmed closed by identifier
audit on the final emitted text: zero unbound identifiers in either port; dispatch completes
(admit -> return -> join -> retry -> terminating fallback). Censuses re-derived by Node walk: 154 files,
generated roadmap 1 `subagent` hit at line 155 (byte-identical to plugins/.../roadmap/SKILL.md:79),
generated simplify 0, host vocabulary exactly 4 (all in out-of-scope files). Generated tree regenerated
destructively and matched byte-for-byte -- never hand-edited.
Warning: G8 aggregate rework 1.00 (HIGH_REWORK). Root cause is a cycle-1 review that caught a real
unexecutable-skill defect, not process failure; the sharper signal is that Lane B has no gate able to
catch identifier-level defects, so `--check` keeps passing wrong text green.
SF-A and SF-B both re-verified as real and both confirmed non-blocking -- no gate fails on either.
Safe to commit.
