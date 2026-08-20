# Progress: FIX-20260819T012309Z-b208 — Prime Agent remediation CR fixes

**Plan**: [FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md](./FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md)
**Status**: DONE
**Created**: 2026-08-19T01:25:26Z

---

## Log

### 2026-08-19T01:56:53Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T015653Z-4511-prime-agent-remediation-cr-fixes.md
Status: REQUEST_CHANGES
Must Fix: 2 | Should Fix: 6
Prior MF-2, MF-3, MF-4 confirmed genuinely closed (verified against the real binary and the real generated tree). MF-1 NOT closed: reproduced independently on all four scope kinds — `diff`, `files:`, `module:`, and `project` each exit 0 with `status: "pass"` and `gatesRun: ["G5"]` when the only scoped file is `src/theme.css`; AC 1 unmet and `README.md:157` publishes the guarantee anyway. New blocker: SF-4b's `install.sh` rollback skips freshly-installed skills, so a mid-loop `mv` failure on a first install leaves 3 of 11 skills behind while printing "the destination was restored to its previous state", and the retry is then refused without `--force`.
Ruled on the tester's three open items: D1 → blocking code fix (MF-1, not a doc correction). D2 → Should Fix, and the backward-compat premise is wrong — node-ts never had a `TS_FILE_RE` filter in `runG1` before this change set, so `!entry &&` preserves legacy behaviour while dart's SF-7b restored its own; close the test gap now, decide the narrowing on its own merits. W3 → Should Fix (rename + fix the stale comment).
Invoke /architect with plans/code-review/CR-20260819T015653Z-4511-prime-agent-remediation-cr-fixes.md to create FIX plan.

### 2026-08-19T01:52:00Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T014354Z-d58f-prime-agent-remediation-cr-fixes.md
Status: PASS
Coverage: 75.16% → 75.39%
All e2e flows green. Coverage floor met. Test count 197 (floor 180); V1/V2/V3 all exit 0; V4 untriggered.
MF-2, MF-3, MF-4 independently verified closed. MF-1 closed on its reported reproduction but narrowed rather than eliminated — see D1 in the report (a diff confined to non-source files *inside* a stack root still exits 0 `pass`). D2: the SF-7b coverage widening remains open on the node-ts side. W1/W2/W3: three tests whose input or name sits beside the property they claim.

### 2026-08-19T02:12:00Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: 38 (22 required, 15 optional Should Fix, 1 close-out regeneration) plus every phase-verification checklist.
Phase 5: `prime-agent/skills/` regenerated wholesale and never hand-edited (`--check` exits 0); `opencode-port-parity` re-verified as untriggered; full gate set green (`node --test` 197, builder + `--check`, `prime-agent` npm test); all four CR reproductions closed.

### 2026-08-19T02:05:00Z | CODER

Phase 4 complete — all 8 Should Fix warnings taken, none deferred.
- SF-1/SF-1b: `templates/architect.md` §5 now binds the sub-contract's integration sub-lane to the slice the `PRIOR SLICING ANALYSIS` envelope declared (verify + freeze, never re-derive; a mismatch is a `contract violation` stop) and splits the `none` justification into a parent-contract and a sub-contract wording. Step 2s.3 gained a bullet confirming the declared name and integer task count.
- SF-2: the strict-shape enumeration at Step 2p.1 now lists the nested level — per-sub-lane requirement IDs, task count and globs, plus the intra-lane overlap list — alongside `integration`.
- SF-6: the `integration`-field paragraph is reduced to the request plus the pointer into `references/config.md` (*The makespan model*, *Containment*, *Per-sub-lane re-application…*, ADR-0014).
- SF-5: the `Nested plan:` integration slot now reads the **critical leaf's own lane's** count, not the candidate lane's.
- SF-3a/b/c: B2's `simplify` justification and the frontmatter discovery blurb are overlaid for Prime, and the protocol block is narrowed to "every **role**", explicitly leaving the read-only scan agent's resolution unchanged and tracked separately.
- SF-4/SF-4b: RED first — a shimmed `mv` that fails on the Nth call left 10 of 11 skills installed. `install.sh` now moves each live skill aside into staging instead of `rm -rf`, and an `EXIT` trap rolls every committed skill back on any failure before clearing staging. Both injection points (mv-aside and mv-in) are covered.
- SF-7a: the mis-named G1 test now says what it asserts. SF-7b: RED first — a non-Dart file carrying an lcov entry was scored; `fileCoverageFindings` now gates on `DART_FILE_RE` unconditionally.
- SF-8a/8b: the port's `README.md` defines `<skill-dir>`, and `UPSTREAM.md`'s *Local modifications* section is reframed for the shipped distribution with the CC-BY-4.0 attribution untouched.

One builder change was needed and is recorded here rather than made silently: `replacements` only ever saw the SKILL.md body, so SF-3b (a frontmatter sentence) was unreachable. `scripts/build-prime-agent.mjs` gained a `frontmatterReplacements` key that runs the **same** matcher over the kept frontmatter lines, so an anchor that stops matching hard-fails the build exactly as a body anchor does.

One observation carried to the reviewer rather than fixed: `src/adapters/node-ts.cjs:246` has the same `!entry && !TS_FILE_RE.test(rel)` shape SF-7b closed in the Dart adapter. SF-7b names `dart-flutter.cjs` only, so node-ts is left unchanged rather than edited without a task.

Phase 4 verification: `node --test` 197 pass / 0 fail; `build-prime-agent.mjs` + `--check` exit 0; `cd prime-agent && npm test` exits 0; structural review green.
Plan tasks remaining: 4 unchecked (Phase 5 close-out)

### 2026-08-19T01:52:00Z | CODER

Phase 3 complete (MF-4, symptom + anchor fragility). The shared `count: 2` architect replacement is split into two `description`-anchored `count: 1` replacements, and the coder replacement is re-anchored the same way, so every dispatch replacement in `prime-agent/overlays/orchestrator.json` addresses exactly one site. Generated `prime-agent/skills/orchestrator/SKILL.md` now carries three distinct wave names: `architect:{lane}` (:872), `architect:{qualified leaf name}` (:931), `coder:{qualified leaf name}` (:968).
Overlay audit: the only remaining `count` > 1 replacements are `':(exclude).claude'` (commit-pr, orchestrator, product-manager) and the *How to spawn a role child* cross-reference; none addresses dispatch, role identity, or child naming, and each `why` now records that its replacement text is site-independent.
The protocol block's fallback sentence is left unchanged — it still governs the one remaining `description`-only dispatch site (the deferred read-only scan child at generated :494-495) and does not misdirect at the three wave sites, which now list explicit names.
Plugins-side `orchestrator/SKILL.md` dispatch bullets unchanged (`subagent_type` still at :836, :895, :932) — this is a Prime-port-only adaptation. Nothing under `prime-agent/skills/` was hand-edited.
Phase 3 verification: `build-prime-agent.mjs` + `--check` exit 0; `cd prime-agent && npm test` exits 0 (install + parity); structural review green.
Plan tasks remaining: 15 unchecked

### 2026-08-19T01:44:00Z | CODER

Phase 2 complete (MF-3). RED confirmed on `i++ / 2; // c` and `i-- / 2; // c` (2 failures), then closed with a `++`/`--` digraph short-circuit at the top of `startsRegex`. `+` and `-` remain in `REGEX_PRECEDERS`; the `const ok = a + /re/.test(s);` negative control and the three `+`/`-`/`*` division positives are pinned as their own tests, and the pre-existing "a division is not mistaken for a regex" test is untouched.
Phase 2 verification: `node --test` 196 pass / 0 fail; `build-prime-agent.mjs` + `--check` both exit 0.
Plan tasks remaining: 21 unchecked

### 2026-08-19T01:40:00Z | CODER

Phase 1 complete (MF-1 + MF-2). Tasks completed: the empty-scope fixture (`__tests__/fixtures/empty-scope.cjs`), 4 failing `run()` tests, the CR's exact CLI reproduction (`--scope diff:HEAD~1` over a docs-only commit), the two `--gates G9` empty-scope CLI variants, 3 regression controls, the `assertNonEmptyScope` guard in `src/run.cjs` (extracted so `run()` gains zero branches — still 9), and the exit-3 documentation in all three publishing places plus the caller-facing behaviour-change note.
`resolveGatePlan` is structurally unchanged; the early return stays.
Phase 1 verification: `node --test` 190 pass / 0 fail (floor 180); `build-prime-agent.mjs` + `--check` both exit 0; structural review green.
Plan tasks remaining: 27 unchecked (excluding phase-verification checklists)

### 2026-08-19T01:33:00Z | CODER

Completed task: "Write the shared empty-scope fixture as a reusable helper under `__tests__/fixtures/empty-scope.cjs`"
Completed task: "Write failing test (`run.test.cjs`): `run()` over an empty resolved scope throws"
RED confirmed: 4 new run.test.cjs assertions fail with "Missing expected exception".
Plan tasks remaining: 36 unchecked

### 2026-08-19T01:29:09Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T01:25:26Z | ARCHITECT

Created plan `FIX-20260819T012309Z-b208`. Type: fix. Tasks: 38.

Source CR: `CR-20260819T010844Z-f9ea` (REQUEST_CHANGES — 4 Must Fix, 8 Should Fix) against `FEAT-20260819T001630Z-be84`.

Phase map:
- **Phase 1** — MF-1 + MF-2 together (shared root cause: no empty-scope fixture exists anywhere in the 180-test suite). Guard placed in `run()` before `resolveGatePlan`, routed to exit 3; `resolveGatePlan`'s early return deliberately retained.
- **Phase 2** — MF-3. `+`/`-` stay in `REGEX_PRECEDERS`; the `++`/`--` digraphs are special-cased in `startsRegex`.
- **Phase 3** — MF-4, symptom *and* cause: lane-qualified `name` at the three concurrent-wave dispatch sites, plus re-anchoring the context-free overlay `find`/`count` replacements that made the mis-rename possible.
- **Phase 4** — the 8 Should Fix warnings, every task annotated `(optional)`.
- **Phase 5** — regeneration, `opencode-port-parity` re-verification, full gate run, and re-running the CR's four reproductions.

Every generated-path finding is fixed in `plugins/my-skills/skills/**` or `prime-agent/overlays/*.json` and regenerated — no hand-edit under `prime-agent/skills/`.

Status: PLANNED. Ready for coder.

---

## Handoff

| From      | To        | Condition                  | Action                                                        |
| --------- | --------- | -------------------------- | ------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260819T012309Z-b208`        |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260819T012309Z-b208`     |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`                 |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260819T012309Z-b208`           |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`              |
