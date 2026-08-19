# Progress: FIX-20260819T105159Z-3cd7 — Correct three stale span-rule assertions (CR-20260819T104419Z-fc4f)

**Plan**: [FIX-20260819T105159Z-3cd7-stale-span-rule-assertions.md](./FIX-20260819T105159Z-3cd7-stale-span-rule-assertions.md)
**Status**: DONE
**Created**: 2026-08-19T10:51:59Z

---

## Log

### 2026-08-19T11:28:37Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T112837Z-9e42-stale-span-rule-assertions.md
Status: REQUEST_CHANGES
Must Fix: 2 | Should Fix: 3
Invoke /architect with plans/code-review/CR-20260819T112837Z-9e42-stale-span-rule-assertions.md to create FIX plan.

Cycle-1 MF-1 and MF-3 verified closed on the shipped text: `config.md:309` is correct as a **span**, not merely a cancelling delta (`:227`'s rule over the post-adoption lane set gives `max(8, 12, 6) + 4` = 16, exactly what the fence computes), and `SKILL.md:534`'s decomposition equals its own result (`max(12, 8) + integration(4)` = 16, then `g = 24 − 16 = 8`).

Both Must-Fix-grade findings the tester routed are upheld. **MF-1** — MF-2 is not closed: `config.md:234`'s and ADR-0017 `:189`–`:195`'s replacement enumeration ("the only other places the shape appears") is false, falsified by `config.md:309` — a run-level normative fence created by this cycle's own AC-2 — and by `SKILL.md:546`; the same paragraph's preceding sentence ("`span_max` … written that way rather than re-expanded") is falsified too; `:208` and `:234` now directly contradict, 26 lines apart. Second consecutive cycle in which a no-duplication claim was itself inaccurate: ruled that the fix is a **different kind of claim** — an open, self-maintaining form — not a harder enumeration, and that `:309` must not be touched. **MF-2** — `SKILL.md:544`'s "two integration slots" is a false count and a false source; `:533`/`:534` are adjacent lines with the character-identical token `+ integration({n})` from declaration levels 0 and 4, and the uncovered mis-fill prints `g = 24 − 12 = 12`. Upheld as a **plan defect** (AC-5 adds the slot, AC-8 pins the paragraph byte-identical): the coder was right to flag rather than edit against an explicit AC, and this is not counted against the coder.

Should Fix: SF-1 `second_largest_span` undefined and double-charging `i(run)` on the naive read (pre-existing, made load-bearing this cycle — sweep into MF-1's edit); SF-2 the `:243`/`:246` duplication, DEFER upheld on independent re-assessment; SF-3 the progress-log baseline conflation (5/5 vs pre-fix, still 4/5 vs HEAD — ADR-0017 records it correctly, only the session summary drifted; append-only, correction on record here).

Pinned constraints re-checked and holding: census 3 / 3 / 2 / 1, `grep 'min(S'` = 0, 31 headings, ADR-0016 `11 +` / `0 −` and `Accepted`, ADR-0012/0013/0014 and `templates/architect.md` clean, `--check` exit 0. No behavioural test asked for — no executable path exists; coverage inapplicable, not below floor. `prime-agent/skills/**` reviewed as build output only.


### 2026-08-19T11:18:53Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T111853Z-17d4-stale-span-rule-assertions.md
Status: PASS
Coverage: n/a → n/a (inapplicable — no executable path exists for this surface and none can be written)

No e2e emitted and none is possible; coverage is inapplicable, not below floor. All three no-regression floors green (`clean-code-gates` 225 / 0, `build-prime-agent --check` exit 0, `prime-agent && npm test` exit 0).

MF-1 and MF-3 verified closed by independent hand derivation, not by confirming the prior report's reasoning: the *The baseline* × *Marginal-gain rule* cross-read now yields `g` = 8 (was 12); the new `:309` form equals the span rule applied to the post-adoption lane set, so it is correct as a **span** and not only as a delta that cancels; the nested print block fills self-consistently on the `X > 0` example. All five worked examples re-derive with every printed figure reproduced; 448/448 numeral tokens identical; exactly one worked-example line differs vs HEAD (parent cycle's permitted rewording). The coder's "all five bodies byte-identical" is true against the pre-fix tree but is **not** stronger than the parent's four of five — different baselines; ADR-0017 records the four-of-five figure correctly.

Two Must-Fix-grade findings routed to the reviewer: **F1** MF-2's replacement enumeration is still false in the shipped tree (falsified by `config.md:309`, which MF-1's own fix created, and by `SKILL.md:546`; also reproduced into Accepted ADR-0017, and now contradicting `config.md:208`). **F2** the coder's flagged `SKILL.md:544` "two integration slots" ruling is overturned — false count and false source, with a reachable mis-fill that prints `g = 24 − 12 = 12`; a plan defect (AC-5 vs AC-8), not a coder defect. F3 (low, pre-existing) and F4 (informational) also recorded.

### 2026-08-19T12:18:44Z | CODER

Phases 5 and 6 complete — 21 tasks. **Check A** (mechanical no-numeral-drift) green: 453 numeral tokens token-for-token identical, 45 / 63 / 62 / 147 / 131; additionally all five worked-example bodies are **byte-identical**. **Check B** (full hand re-derivation from the corrected text) green: all five examples re-derive, example 5 reproducing T=42, span_base=24, M_flat=29, span_max=16, M_nested=25.5, g=8, c=4.5, reconciliation 3.5. No derivation disagreed with any printed figure, so no numeral was ever adjusted and BLOCKED was not routed. `:459` byte-identical. 12/12 cross-references resolve; heading inventories md5-identical; `min(S` = 0.

Distribution regenerated by script only; `--check` exit **0**; `prime-agent && npm test` exit **0**; `clean-code-gates` **225 / 0**. Post-regeneration census 3 / 3 / 2 / 1 / 1. ADR-0016 md5 unchanged, `Accepted`, diff 11 + / 0 −; ADR-0012/0013/0014 and `templates/architect.md` md5-identical to Phase 0. Change set confined; nothing committed or pushed.

All tasks complete. Plan status → DONE.
Total tasks completed this session: 79 checkboxes (39 plan tasks + all per-phase verification items)

### 2026-08-19T11:58:30Z | CODER

Phase 4 complete (Should Fix rulings) — 9 checkboxes. **SF-1: DEFER upheld, not attempted** — the oracle did not show the collapse to be free, and three Must Fix items moved prose in `references/config.md` this same cycle, two of them adjacent to the `:243` / `:246` blockquotes. The load-bearing content a wholesale merge would destroy is enumerated by name in the plan's Progress Log: `:243`'s exact unbolded Step 3s quotation (a quote-fidelity anchor pinned at exactly 1), its Step 3s citation, its overstates-the-gain defect-class point and ADR-0012 attribution; `:246`'s Step 3j **and** Step 3L citations, its counts-in-full-in-`span_base`/`span_max`/`M_flat`/`T` scope limit, and its ADR-0016 attribution. The two optional tasks are recorded as **not attempted** rather than checked off as done.

**SF-2: accepted as an append.** A new dated entry was appended at EOF to the parent `plans/feat/FEAT-20260819T101153Z-e883-…progress.md`, following the precedent its own SIMPLIFY / TESTER / REVIEWER entries set, recording the numeral-count extraction convention and stating that the AC-20 verdict needs no correction (identical offset on both sides cancels). Proven against a pre-image: **0** removed lines, entire prefix byte-identical, 12 lines added, and lines `:49` and `:122` byte-identical **and** still at those line numbers. No gate command's path condition was matched by this phase.

Plan tasks remaining: 21 unchecked

### 2026-08-19T11:52:07Z | CODER

Phase 3 complete (MF-2) — 14 tasks. Post-Phase-1/2 site census recorded and classified (1 normative statement in `config.md`; 3 display expansions + 1 quotation in `SKILL.md`; 1 sub-lane illustration). `config.md:234` and ADR-0017's Consequence **scoped, not deleted** — bounded to the *normative* arithmetic with the Step 2p.2 print blocks named as the ADR-0016 §5 display exception. ADR-0017's `Skills affected` now records the one amended `SKILL.md` site and keeps `templates/architect.md` as genuinely unamended; *What stands* now scopes the byte-for-byte guarantee to the **flat** block and records the nested block as fixed-not-exempted. O2 flipped to passing; all three oracles green together. ADR-0016 md5 unchanged, `Status: Accepted`, diff still 11 + / 0 −; ADR-0012/0013/0014 and `templates/architect.md` md5-identical. Numeral extraction identical at 453 tokens.

Plan tasks remaining: 30 unchecked

### 2026-08-19T11:38:44Z | CODER

Phase 2 complete (MF-3) — 12 tasks. `SKILL.md:534` now carries `+ integration({n})`; `:546` gained exactly one pointing clause. O3 flipped to passing. Filled-slot walkthrough on example 5 is self-consistent **and** correct: `max(12, 8) + integration(4) = 16`, then `g = 24 − 16 = 8`. `git diff` on `SKILL.md` is 2 + / 2 − at `:534` and `:546` only — flat print block and every other Step 2p.2 line byte-identical. Census re-run immediately: **3 / 3 / 2 / 1 / 1**, quote fidelity confirmed character for character. Step 2p heading md5 unchanged. `--check` fails only on staleness.

Two reviewer notes recorded in the plan's Progress Log: an O3b oracle anchor trimmed for a sentence-initial case artifact, and the `:543` "two integration slots" paragraph now enumerating two of three slots (left byte-identical as the plan pins it; flagged as a candidate Should Fix rather than widening scope).

Plan tasks remaining: 44 unchecked

### 2026-08-19T11:26:10Z | CODER

Phase 1 complete (MF-1) — 11 tasks. `config.md:309`'s fence now reads `max(second_largest_span, span(L after the split)) + tasks(i(run))` with the run-constant/cancels clause; `:316` references `span_base` by name instead of re-expanding it. O1 flipped from failing to passing (O1a 1→0, O1b 0→1). Cross-read of worked example 5: **before `g` = 24 − 12 = 12, after `g` = 24 − 16 = 8**, matching the printed 8 and the cancellation identity `M − S` = 20 − 12 = 8. `:314` byte-identical; *Marginal-gain rule* numeral sequence identical at 14 tokens (one reword needed to drop a stray `option 3` token); `min(S` = 0. `--check` fails only on expected staleness, not on occurrence-count drift.

Plan tasks remaining: 56 unchecked

### 2026-08-19T11:14:36Z | CODER

Phase 0 complete — 12 tasks. Pre-edit oracle captured: numeral counts 45 / 63 / 62 / 147 / 131 under a stated heading-included convention; census 3 / 3 / 2 / 1 / 1; `min(S` = 0; 31 + 9 headings inventoried; 10 / 10 cross-references resolve; six file digests recorded; ADR-0016 diff pure-append (11 +, 0 −). Floors green: `clean-code-gates` 225 / 0, `--check` exit 0, `prime-agent && npm test` exit 0. O1 / O2 / O3 written as re-runnable string assertions and **observed to fail** (O1a=1, O1b=0, O2a-d=1, O3a=0, O3b=0; cross-read `g` = 12 against printed 8).

Plan tasks remaining: 67 unchecked

### 2026-08-19T11:00:02Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T10:51:59Z | ARCHITECT

Created plan `FIX-20260819T105159Z-3cd7`. Type: fix. Tasks: 39.

Source CR: `CR-20260819T104419Z-fc4f` (REQUEST_CHANGES, 3 Must Fix, 2 Should Fix). Parent plan: `FEAT-20260819T101153Z-e883`.

**Must Fix → task pairs (oracle-first, the reachable TDD analogue for normative prose):**

- **MF-1** → Phase 1. `config.md:316`'s re-expanded `span_base` becomes a by-name reference to *The baseline*; `:309`'s fenced post-split formula gains `+ tasks(i(run))` plus the run-constant/cancels clause. Oracle: the cross-read derivation of worked example 5 goes from `g` = 12 to `g` = 8. `:314`'s sub-lane micro-example is byte-identical.
- **MF-3** → Phase 2. The Step 2p.2 **nested** print block's `span_max` line gains `+ integration({n})`, mirroring `:505`/`:533`; `:546` gains one pointing clause. Sequenced before MF-2 because MF-2's corrected text describes the site census as it stands *after* this lands.
- **MF-2** → Phase 3. `config.md:234` and ADR-0017's Consequence are **scoped, not deleted** — bounded to the normative arithmetic, with the Step 2p.2 display sites named as the ADR-0016 §5 exception. ADR-0017's `Skills affected` and *What stands* entries corrected to record the one amended `SKILL.md` site and §5's flat-only scope.

**Should Fix rulings (architect):**

- **SF-1 — DEFER.** The CR is explicit that a wholesale merge of `:243`/`:246` deletes load-bearing content. Three Must Fix items already move prose in this same file this cycle, so the collateral-drift risk outweighs the prose economy. Recorded with the unique content enumerated by name, plus an **optional** task pair if the coder elects the scoped shared-clause-only collapse under a pre-written oracle.
- **SF-2 — ACCEPT, as an append.** Record the numeral-count extraction convention rather than correcting the figures: AC-20 compared like against like (147/147, 131/131) so the off-by-one cancels and the verdict needs no correction. The fix is a **new** dated entry appended to the parent `.progress.md` — rewriting lines `:49`/`:122` would violate that file's append-only contract.

**Binding constraints carried into this plan:** no figure moves (re-proved by both a mechanical no-numeral-drift diff over all five worked examples **and** a full hand re-derivation, because these edits touch the text those examples are checked against); `prime-agent/skills/**` regenerated only, never hand-edited, `--check` exit 0; section headings frozen; anchor + quote-fidelity census 3 / 3 / 2 / 1 / 1, re-run immediately after the `SKILL.md` edit because this is the first cycle to modify that file; `grep 'min(S' references/config.md` = 0; ADR-0016 stays `Accepted` and append-only (it needs **no** amendment — §5's heading is already correct, the defect was in the citing documents); ADR-0012/0013/0014 and `templates/architect.md` unamended; floors `clean-code-gates` 225 / `--check` 0 / `prime-agent && npm test` 0.

**No behavioural test is planned, and none can exist.** `parallelism` defaults to `off` in this repository and the `full` level with `k >= 2` is unreachable here, so no path executes the span rule. Verification is structural and arithmetic, per `PROJECT-CONTEXT.md` → *Test tooling*.

**Not superseded by an ADR-0018.** `docs/adr/0017-…md` is untracked work-in-flight from this same uncommitted cycle; its two false assertions are corrected in place before it lands.

Status: PLANNED. Ready for coder.

---

## Handoff

| From      | To        | Condition                  | Action                                                          |
| --------- | --------- | -------------------------- | --------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260819T105159Z-3cd7`          |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260819T105159Z-3cd7`       |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`                   |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260819T105159Z-3cd7`             |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`                |
