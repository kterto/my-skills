# Progress: FIX-20260819T113512Z-438c — Replace the closed span-shape census with an open form and repair the slot guard

**Plan**: [FIX-20260819T113512Z-438c-open-span-claim-slot-guard.md](./FIX-20260819T113512Z-438c-open-span-claim-slot-guard.md)
**Status**: QA_READY_WITH_WARNINGS
**Created**: 2026-08-19T11:35:12Z

---

## Log

### 2026-08-19T11:35:12Z | ARCHITECT

Created plan `FIX-20260819T113512Z-438c`. Type: fix. Tasks: 37 (across 6 phases), acceptance criteria: 31.

Source: `CR-20260819T112837Z-9e42` (REQUEST_CHANGES, review cycle 2 of max 10, 2 Must Fix / 3 Should Fix) on `FIX-20260819T105159Z-3cd7`.

Both of the reviewer's structural rulings are implemented rather than re-litigated:

- **MF-1** — the closed census at `references/config.md:234` and its reproduction in Accepted `ADR-0017:189`–`:195` are replaced by an **open, self-maintaining form** (universal classification: every site writing the shape out is an application, illustration, or display of the rule, never an independent definition), because a closed census is self-invalidating and has now failed twice. `config.md:309` is **not** touched — cycle-1 MF-1 proved the expanded form is required there. `config.md:208`'s "it does not restate them" over-reach is narrowed in the same phase, and `ADR-0017:5`'s "amended at **one** site" count — the third instance of the same self-invalidating shape — is corrected without a falsifiable count.
- **MF-2** — the byte-identical pin on `SKILL.md:544` is **dropped** (AC-9), and the plan asserts as an explicit criterion that no AC both requires editing a line and pins it byte-identical. The prior plan's AC-5 / AC-8 pair was unsatisfiable; the coder's flag last cycle was correct and is recorded as such.

Should Fix rulings: **SF-1 ACCEPT** — implemented by defining `second_largest_span` in the prose governing the fence (`:312`), **not** inside the `:309` fence as the CR suggested, because "`:309` must not be touched" is a hard constraint and a plan that both pins and edits a line is the exact defect being fixed; the substance (non-integration lanes only; the naive all-lanes read double-charges `i(run)`) is preserved in full. **SF-2 DEFER**, upheld a third time with the load-bearing content re-enumerated by name. **SF-3 NO REWRITE** — `.progress.md` is append-only and ADR-0017 `:176` already records the figure against the right baseline; the forward-looking discipline is adopted as AC-19 (every byte-identity or numeral figure names its baseline in the same sentence).

Two sequencing decisions are load-bearing and must not be reordered: MF-2 and SF-1 land **before** MF-1, so every claim describes the tree as it actually stands when written; and the site census (AC-20) enumerates the **post-edit** tree after regeneration, with every surviving site classified — a census restricted to the pre-edit site list is an explicit AC failure, since that omission is how the last cycle's O2 shipped green.

Constraints carried into the plan: no figure moves (both independent checks re-run in full; prior green does not carry over); `prime-agent/skills/**` fixed at source and regenerated, never hand-edited; headings frozen (31 in `config.md`); `grep 'min(S'` = 0; anchor census 3 / 3 / 2 / 1 (+ 1 overlay); ADR-0016 `Accepted` and append-only; ADR-0012/0013/0014 and `templates/architect.md` unamended; floors `clean-code-gates` 225, `--check` 0, `prime-agent && npm test` 0. No behavioural test is planned — `parallelism` is `off` and `full` with `k >= 2` is unreachable, so coverage is inapplicable, not below floor.

Status: PLANNED. Ready for coder.

### 2026-08-19T11:44:30Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T11:52:00Z | CODER

Completed Phase 0 (pre-edit oracle) — 6 tasks + 6 verification items.

- "Record the pre-edit numeral sequence of each of the five worked-example subsections…" — done. Convention: heading line INCLUSIVE, through the line before the next heading; every maximal `[0-9]` run in document order. 505 numerals across the 5 subsections. Baseline: this cycle's pre-edit tree (`HEAD` `d297e6c` + the parent FEAT's and prior FIX's uncommitted edits).
- "Record the pre-edit anchor + quote-fidelity census…" — done: 3 / 3 / 2 / 1, plus exactly 1 overlay `find` string in `references/config.md`. `min(S` = 0.
- "Record the pre-edit heading inventory…" — done: 31 headings in `references/config.md`; `SKILL.md` Step 2p region headings and the touched cross-reference target list recorded, all resolving.
- "Record `md5` of …" — done for all 8 files; ADR-0016 diff vs `HEAD` confirmed `11 +` / `0 −` with `- **Status:** Accepted` on line 3.
- "Record the pre-edit floors…" — done: 225 pass / 0 fail; `--check` exit 0; `prime-agent && npm test` exit 0.
- "Write the four oracles as explicit re-runnable assertions with their current (failing) values recorded" — done: O1, O2, O3, O4 all observed FAILING. O1a=1, O1b=0, O1c=0; O2a=1, O2b=1, O2c self-contradiction=1; O3a=1, O3b=1; O4a=1 occurrence / 0 definitions, O4b=0.

Plan tasks remaining: 25 unchecked.

### 2026-08-19T12:04:00Z | CODER

Completed Phase 1 (MF-2 — `SKILL.md`'s slot guard) — 7 tasks + 6 verification items.

- "Re-assert O1 fails…" — done, observed failing at O1a=1, O1b=0, O1c=0, two slots enumerated against three in the block, `:534`'s lane-level source unnamed.
- "Record the plan-level exemption before editing" — done. AC-9 drops the byte-identical pin on `:544`; the prior AC-5/AC-8 pair was unsatisfiable and last cycle's coder flag was correct. Exemption scoped to that one paragraph.
- "Rewrite the `:544` paragraph to state three slots, each with its source" — done.
- "Extend the same paragraph with the copy-hazard guard" — done; `Nested plan:` guard, never-literal-placeholders, declared-`none` behaviour and the *The makespan model* pointer all preserved; no formula restated.
- "Record the filled-slot walkthrough on worked example 5" — done in the plan's Progress Log: correct fill `span_max = max(second-largest span 12, span(backend) 8) + integration(4) = 16`, `g = 24 − 16 = 8`; blocked mis-fill `integration(0)` → `span_max = 12` → `g = 24 − 12 = 12`. Neither printed in the skill; `SKILL.md` numeral count 958 pre and 958 post.
- "Run the anchor + quote-fidelity census immediately" — done: 3 / 3 / 2 / 1 (+ 1 overlay in `config.md`); full per-anchor occurrence table diffs clean against Phase 0. `--check` fails on expected staleness only, not on an occurrence-count mismatch.
- "Assert O1 now passes, and assert the `SKILL.md` diff is confined to the one paragraph" — done: O1a=0, O1b=1, O1c=1; diff against the pre-edit snapshot is exactly one changed line (`:544`); nested block `:526`–`:542` and `:546` byte-identical.

Plan tasks remaining: 18 unchecked.

### 2026-08-19T12:10:00Z | CODER

Completed Phase 2 (SF-1 — define `second_largest_span` without touching the fence) — 3 tasks + 2 verification items. Attempted, not declined; BLOCKED route not needed.

- "Re-assert O4 fails" — done: 1 occurrence (inside the `:309` fence), 0 definitions; `other non-integration lanes` = 0.
- "Add the definitional statement to the prose governing the fence (`:312`)" — done. `second_largest_span` = the maximum of `span(L)` over the post-adoption lane set's **other non-integration lanes**, the run's own integration lane excluded because it *is* `i(run)` and is charged once by the `+ tasks(i(run))` term outside the `max`; ranking all lanes double-charges `i(run)` when the integration lane ranks second.
- "Assert O4 passes, `:309` byte-identical, no numeral added, `--check` clean of anchor drift" — done: `second_largest_span` = 2 (unchanged fence + new definition), `other non-integration lanes` = 1; `:309` byte-identical; `config.md` numeral count 1203 pre and 1203 post; diff confined to `:312`; per-anchor occurrence table diffs clean.

Plan tasks remaining: 13 unchecked.

### 2026-08-19T12:22:00Z | CODER

Completed Phase 3 (MF-1a — `config.md`'s claim in the open form) — 5 tasks + 5 verification items.

- "Re-assert O2 fails" — done: O2a=1, O2b=1, self-contradiction=1.
- "Take the interim site census over the tree as it stands after Phases 1–2" — done BEFORE writing the sentence. 13 site groups classified across `config.md`, `SKILL.md`, `templates/architect.md`, ADR-0016, ADR-0017. Exactly **one** normative definition (`config.md:227`); `config.md:309` classified as a normative **application**; `templates/architect.md` has **zero** sites. Full table in the plan's Progress Log.
- "Rewrite `:234`'s closed census into the open, self-maintaining form" — done: bound kept, three named applications kept, universal classification stated ("never an independent definition of it"), today's sites named as non-exhaustive examples with the ADR-0016 §5 attribution, by-hand carrying obligation kept, explicit "not a census of the tree" disclaimer.
- "Reconcile the paragraph's preceding sentence with `:309`" — done: the "never re-expanded" claim is scoped to the **normative definitions** of the quantities, so `:309` no longer falsifies it; consistent with `:312` / `:314`.
- "Narrow `:208`" — done: Step 2p **applies** the rules and is not their normative home; its expanded print blocks are ADR-0016 §5 displays, not a second definition. `it does not restate them` = 0.
- "Assert O2 now passes; assert `:309` … unchanged; run `--check`" — done: O2a=0, O2b=0; all six banned closed-census constructions = 0; open markers present; diff confined to `:208`/`:234`/`:312`; `:309` byte-identical; `min(S` = 0; 31 headings; all five worked-example numeral sequences diff identical; per-anchor occurrence table clean.

Plan tasks remaining: 8 unchecked.

### 2026-08-19T12:34:00Z | CODER

Completed Phase 4 (MF-1b — ADR-0017 corrected in place) — 5 tasks + 5 verification items.

- "Re-assert O3 fails" — done: O3a=1, O3b=1.
- "Rewrite the Consequences bullet into the same bounded, open form" — done: universal classification mirroring `config.md:234`, today's sites as non-exhaustive examples (now including the normative `span_max` fence the superseded enumeration omitted), the closed-set revision recorded as corrected. Two internal counts ("four named quantities", "four normative formulas") removed. No closed enumeration of shape sites survives anywhere in the ADR.
- "Correct `Skills affected` (`:5`) against the post-edit tree" — done: three `SKILL.md` locations **named rather than counted**, `templates/architect.md` still recorded unamended and still is.
- "Re-audit every remaining ADR-0017 claim about what is unamended against the post-edit tree" — done, 5 claims, each with its verifying command recorded in the plan's Progress Log. **No claim found false**; nothing needed correcting.
- "Assert O3 passes; ADR-0016 untouched/Accepted/`11 +` `0 −`; ADR-0012/0013/0014 and `templates/architect.md` md5-identical" — done, all green. ADR-0017 diff confined to `:5` and the Consequences bullet. SF-3 honoured: `:176` untouched.

Plan tasks remaining: 17 unchecked.

### 2026-08-19T12:50:00Z | CODER

Completed Phase 5 (post-edit census, no-figure-moves, regeneration, floors) — 11 tasks + 7 verification items.

- Distribution regenerated by `node scripts/build-prime-agent.mjs` only (11 skills, 154 files); no hand-edit under `prime-agent/`. `--check` exits **0**. Both MF fixes present in the distributed copies by regeneration alone.
- Final post-edit census taken over the regenerated tree with per-site classification (14 site groups). **Zero** sites classified as a second normative definition. The new `:234`, `:208` and ADR-0017 text checked line by line against the census output — the universal classification covers every non-definition row, including rows it does not name.
- Mechanical no-numeral-drift check re-run **in full**: all five worked-example numeral sequences byte-identical, 505 numerals, zero differences; distribution copy identical too.
- Full hand re-derivation of all five worked examples re-run **in full** from the post-edit text, cross-checked against `config.md:461`'s uncorrected-model oracle. **Every figure agrees; no numeral was adjusted and none needed to be.** The new SF-1 definition is consistent with every printed figure (`second_largest_span` = 12 on worked example 5 → `span_max` = 16, as printed).
- Anchor + quote-fidelity census post-regeneration: **3 / 3 / 2 / 1** (+ 1 overlay in `config.md`); full per-anchor table diffs identical to Phase 0; `min(S` = 0.
- Heading inventory identical (**31** in `config.md`; `SKILL.md` Step 2p region byte-identical); every touched cross-reference target resolves.
- Floors green: **225 pass / 0 fail**, `--check` exit **0**, `prime-agent && npm test` exit **0**.
- `git status` confined to `references/config.md`, `SKILL.md`, `docs/adr/0017-*.md`, `prime-agent/skills/**` (regenerated), `plans/**`. ADR-0016 untouched this cycle.
- SF-1 (ACCEPT, implemented at `:312` with `:309` byte-identical and zero numerals added), SF-2 (DEFER, third time, content re-enumerated by name) and SF-3 (NO REWRITE, discipline adopted) all recorded in the plan's Progress Log, each figure naming its baseline in the same sentence.
- No behavioural or executable test emitted and none reachable (`parallelism` off; `full` with `k >= 2` unreachable). Coverage inapplicable, not below floor. All `.progress.md` files append-only; the parent FEAT's and prior FIX's logs were not written to at all.

### 2026-08-19T12:50:00Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: 37 (plus 31 phase-verification checklist items; 68 checkboxes total).

---

## Handoff

| From      | To        | Condition                  | Action                                                        |
| --------- | --------- | -------------------------- | ------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260819T113512Z-438c`        |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260819T113512Z-438c`     |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`                 |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260819T113512Z-438c`           |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`              |

### 2026-08-19T12:03:12Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T120312Z-5d31-open-span-claim-slot-guard.md
Status: PASS
Coverage: n/a → n/a (inapplicable, not below floor — docs-only, no executable path)
All selected structural/arithmetic flows green; no e2e emitted and none reachable (AC-30). Coverage floor not applicable.
Two findings routed to the reviewer: F1 (Must-Fix-grade) — `config.md:208`/`:234` attribute the nested Step 2p.2 print block to ADR-0016 §5, which its own heading scopes to the flat block (regresses CR-fc4f MF-3; instructed by AC-1(d)). F2 (Should-Fix-grade) — `:208` reintroduces a falsifiable count.
Floors: clean-code-gates 225/0; `build-prime-agent.mjs --check` exit 0; `prime-agent && npm test` exit 0.

### 2026-08-19T12:17:37Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T121737Z-7abb-open-span-claim-slot-guard.md
Status: APPROVED
Must Fix: 0 | Should Fix: 3
Reviewed the whole aggregate change set against base `d297e6c` (parent FEAT + both FIX plans). Tester's F1 verified as fact against ADR-0016 §5 but ruled Should Fix, not blocking — reasoning recorded in the CR under SF-1. Convergence judgment: converging, not churning.
Ready for QA — invoke /qa with plan ID FIX-20260819T113512Z-438c.

### 2026-08-19T12:24:46Z | QA

Precondition check: Plan FIX-20260819T113512Z-438c status=DONE, CR=CR-20260819T121737Z-7abb CR status=APPROVED. Proceeding.

### 2026-08-19T12:31:00Z | QA

Ran: cd plugins/my-skills/skills/clean-code-gates && npm test
Result: PASS — Total: 225 | Passed: 225 | Failed: 0 | Skipped: 0
Scope note: UNRELATED surface (no file under `plugins/my-skills/skills/clean-code-gates/**` is in this change set). Recorded as a no-regression floor, not as evidence about this change.

### 2026-08-19T12:31:30Z | QA

Ran: node scripts/build-prime-agent.mjs --check
Result: PASS — exit 0, "prime-agent/skills is up to date (11 skills, 154 files)". Strong form of the generated-tree gate: the committed distribution equals a fresh regeneration from `plugins/my-skills/skills/` + overlays. (`git status` cannot show this — the pipeline never commits.)

### 2026-08-19T12:32:00Z | QA

Ran: cd prime-agent && npm test
Result: PASS — install.sh + parity.sh both ok (preflight, containment, all-or-nothing install, mid-loop rollback; generated/in-sync/guarded). UNRELATED surface — no-regression floor.

### 2026-08-19T12:33:00Z | QA

Ran: git diff --name-only d297e6c + git ls-files --others --exclude-standard | extension census
Result: PASS — 19 files, ALL `.md`. Zero source-code files in the aggregate change set. Substantiates the docs-only framing; G1–G7 code gates have no subject matter.

### 2026-08-19T12:40:00Z | QA

Gate G1 (coverage)
Ran: extension census over the aggregate change set; `references/config.md:14`/`:51`/`:611` read for the parallelism default
Result: INAPPLICABLE — 19 changed files, all `.md`; zero code files. `parallelism` defaults to `off`, and `full` with k >= 2 is unreachable in this repo, so there is no executable path to cover. Deliberately NOT reported as BELOW_FLOOR: a coverage figure here would be undefined, not low. No behavioural test or harness was invented.

### 2026-08-19T12:40:30Z | QA

Gates G2/G3/G4/G5/G7 (complexity, length/nesting, naming, no-comments, dependency structure)
Ran: n/a — changed-file set contains no source-code file
Result: INAPPLICABLE — no subject matter. G5's comment audit has no code file to scan.

### 2026-08-19T12:41:00Z | QA

Gate G6 (mutation)
Ran: n/a
Result: INAPPLICABLE — no executable path; see G1.

### 2026-08-19T12:41:30Z | QA

Gate G8 (rework ratio)
Ran: CR frontmatter census across CR-...fc4f / CR-...9e42 / CR-...7abb
Result: WARN HIGH_REWORK — plan-scoped 0/1 = 0.00 (PASS); aggregate (2 REQUEST_CHANGES + 2 FIX) / 3 CR = 1.33 (> 0.5). Convergence verified independently rather than assumed: must_fix_count 3 -> 2 -> 0 (monotonic to zero, stronger than the reported 3 -> 2 -> 1); should_fix_count 2 -> 3 -> 3 (flat); failure mode changed kind from self-invalidating to static. Converging, not churning. Non-blocking.

### 2026-08-19T12:42:00Z | QA

Structural verification (in place of automated tests, per PROJECT-CONTEXT -> Test tooling)
Result: PASS on all four claims.
1. No figure moved: worked-example region numerals 507 both sides, ordered sequence md5 identical (e567488a...). Convention pinned: region = `#### Worked example — the gate verdict...` up to `#### Greedy, recomputed adoption`; numeral = maximal [0-9] run; ordered compare. Region is NOT byte-identical — exactly one prose clause added at region line 114 (+112 chars), no figure. Second check: all five examples re-derived by hand from the rule text, zero disagreements including every percentage and both identities.
2. Rule derives its dependents: span(L) split + leaf, span_max, M_flat's span term (now referenced by name, no longer re-expanded), viable-flat span_base all derive from :227. T and M_seq stated as NOT applications at :252, plus :234/:260/:262.
3. SKILL.md:544 three-slot guard correct and complete: filling :531/:533/:534 from :544 alone yields span_max = max(12, 8) + integration(4) = 16, g = 24 - 16 = 8. Mis-fill (g = 24 - 12 = 12) unreachable from the guard text and not printed anywhere in the skill. Cited source line `Integration lane:` resolves (SKILL.md:504); second_largest_span defined at config.md:312 outside the :309 fence, adding no numeral.
4. Open claim holds: post-edit, post-regeneration census = exactly 1 normative definition (config.md:227), 12 applications / 12 illustrations / 3 displays, zero second definitions. templates/architect.md carries referential mentions only.
5. Generated tree: --check exit 0; sole source/mirror config.md delta is an intentional overlay link rewrite at :86; Step 2p.2 region byte-identical; mirror carries both edits.

### 2026-08-19T12:42:30Z | QA

New findings (all non-blocking)
QA-N1 NEW — docs/adr/0014-...:87 "reserves two slots" is falsified by this change set (nested block now has three; SKILL.md:544 says "three"). ADR-0014 is outside AC-20's census scope and was verified md5-identical (unamended) but never re-verified for truth; ADR-0017 :147 lists it under "What stands". Fourth instance of the count-decay class, caused by this change set, and a direct instantiation of SF-3 read in the dual direction: unamended != still accurate.
QA-N2 PRE-EXISTING — M_flat's interface term (:251/:259) omits the 0.25 conversion; literal reading gives M_flat = 32 vs printed 29 in example 5. git diff shows the clause byte-identical either side of d297e6c — NOT a regression.
QA-N3 PRE-EXISTING — worked examples 2 and 3 label a sub-lane-set span as `span_max`; numbers coincide only because other lanes are 0 and X = 0. Region unchanged — NOT a regression.
CR Should-Fix items SF-1 / SF-2 / SF-3 each independently confirmed non-blocking; ADR-0016 §5 verified directly (heading + body flat-only, "nested" absent), over-attribution confined to config.md:208 and :234, ADR-0017 scopes it correctly in all 4 passages, and the instruction attached to the false citation is itself correct.

### 2026-08-19T12:43:00Z | QA

Method note — TOOLING HAZARD
The shell's proxied `diff` returned a false "Files are identical" (exit 0) on files that genuinely differ; reproduced on a 3-line control pair. All byte-identity assertions in this QA were made with cmp / shasum / git diff --no-index instead. Recommend re-confirming with `cmp` any byte-identity claim in the plans, TEST reports, or CRs that was established with bare `diff`.

### 2026-08-19T12:43:30Z | QA

QA suite complete.
Report: plans/qa/QA-20260819T122446Z-d349-open-span-claim-slot-guard.md
Status: READY_WITH_WARNINGS
Test failures: 0 | Lint errors: 0 | Type errors: 0
All blocking checks pass (225 clean-code-gates + prime-agent install/parity + build --check exit 0). G8 aggregate 1.33 > 0.5 -> HIGH_REWORK, flagged for human root-cause investigation; rework is converging, not churning. Plan can ship. Carry QA-N1/N2/N3 and SF-1/SF-2/SF-3 into the next touch of references/config.md.
