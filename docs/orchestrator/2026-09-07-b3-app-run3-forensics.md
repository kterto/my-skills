# b3-app run forensics — the fourth pass, and the first one that found less than it expected

**Date:** 2026-09-07 · **Corpus:** `b3-app` run 3 (`SPEC-20260906T203433Z-9c56`, 22h, HEAD `dfcc0c7`)
**Predecessor:** [2026-09-04-b3-app-forensics.md](./2026-09-04-b3-app-forensics.md) — run 1, which
produced the fixes in `5750c79`, `5892e31`, `e7bdf78`.

## Why this one exists

Run 3 is the first full run after the 2026-09-04 fixes. They landed 21:33–22:05 on 09-04; the run
started 09-06 20:34. Every one of them was live. The predecessor's verdict — **"Containment worked;
convergence did not"** — reproduced exactly, and the cycle count went the wrong way.

| | RUN1 | RUN2 | RUN3 |
| --- | --- | --- | --- |
| Review cycles | 6 | 5 | **7** (budget 8) |
| Production source shipped | 3,719 | 3,107 | **1,436** |
| Markdown artifact lines | 15,074 | 12,420 | **22,409** |
| Markdown : production source | 4.05:1 | 4.00:1 | **15.61:1** |
| Progress-log lines per source line | 1.46 | 1.29 | **7.34** |

`lib/` is byte-identical from tree `654a3b54` (end of the build phase) to the shipped commit.
`mock_server/lib/` moved once, in cycle 1 (+33/−5 across three files), and never again.
**Five of the seven review cycles reviewed change sets containing no production code at all.**
37.6% of the run ran after the reviewer's first `APPROVED` with zero Must Fix. The loop was ended by
a human decision typed into `FIX-…c018.progress.md:2392` at 13:27:56Z — *"user decision: one final
cycle on the guard-vacuity class, then hand it forward"* — 19 minutes before the budget warning could
have printed.

## The chain

One spec requirement, R52 — *"a presence-scan must additionally assert its input set is non-empty so
it cannot pass by matching nothing"* — accounts for six of the seven cycles.

```
CR#1 REQUEST_CHANGES  R52 at 1 site                              requirements_unmet: 1
CR#2 REQUEST_CHANGES  same class, 2 more ("missed by me then")   unmet: 0
CR#3 REQUEST_CHANGES  both MFs filed against .progress.md        unmet: 0
CR#4 APPROVED         reviewer RECORDED the class rather than blocking:
                      "a Must Fix here would buy a fifth remediation cycle" (CR-8695:180)
EVAL#1                re-graded R52 "3/5 — PARTIAL" on the exact sites CR#4 recorded
CR#5 REQUEST_CHANGES  R52 at 11 sites, "the fifth recurrence of one defect class"  unmet: 1
CR#6 REQUEST_CHANGES  7 more, "one of which no artifact in this run has named"     unmet: 1
CR#7 APPROVED                                                    unmet: 0
```

1. **R52 quantifies over a population the pipeline itself grows.** Every remediation cycle writes new
   pinned collections — new guard tests, and two new FIX documents the document guard must then scan.
   The fix for cycle N is a member of the class in cycle N+1. The class grew from 8 open sites to 29
   under six cycles of repair.
2. **The coverage map dropped R52's second clause.** `architect.md:101`/`:265` mandate a 5–10-word
   row; `reviewer.md:19` forbids re-deriving it from the spec. The run's own FINAL: *"The root plan's
   coverage map states R52 without its second clause, which is why the class was invisible to seven
   reviews."*
3. **Reviewer discretion exists, was exercised, and is not honoured downstream.** CR#4 recorded rather
   than blocked, explicitly to save a cycle. `EVAL-…2d1c:246` then graded those same sites `PARTIAL`.
   Nothing binds the eval to a reviewer's recorded class.
4. **The eval widened the population for a 0.01 grade delta.** `EVAL-…2d1c` §1(ii): *"Frozen
   population: (b) … It is also the stricter reading, which is the right default for a borderline"*,
   and, two sentences later, *"`AC_score` moves from 0.56 to 0.57 and the gap stands either way."*
   The choice multiplied the remediation surface ~4.5× and bought cycles 5, 6 and 7. Its root is
   `spec-driven-eval/SKILL.md:65` — *"treat borderline checks as UNMET"* — correct for comparable
   grading, where conservatism is free; wired here to a work generator, where it is not.
5. **The remediation floor could not filter it.** `SKILL.md:1347` fires on a `Met-by-plan` row the
   eval scores **`unmet`**. The eval emits `PARTIAL` and never that word, and the `Met-by-plan`
   conjunct is vacuous on a plan with zero deferrals. The same PARTIAL-shaped gap was remediated at
   eval cycle 1 and recorded-not-remediated at eval cycle 2, for a grade that moved 0.99 → 0.99.
6. **Once reopened, the reviewer had no discretion.** `reviewer.md:101`, `:112`, `:237`. Both CR#5 and
   CR#6 file under `**Requirement**: 52`, not under the census rule.

## Method, and what it cost the conclusions

Two workflows, 249 agents. Seven forensic lenses, a three-lens refutation panel per finding, then four
independent remediation designs and a two-lens safety/efficacy critique per proposed change.

**The adversarial passes relocated the cause and killed every proposed remedy.** That is the finding
worth recording:

- The first pass blamed the **census rule** (`reviewer.md:115-133`) and the **missing severity floor**.
  Refuters showed both are latent: cycles 5–7 file under the requirement rule, and the reviewer *did*
  de-escalate near the end without any contract change (CR#6:312, CR#6:461, CR#7:233).
- "Reviewer records instead of blocking" was refuted **empirically** — it is what CR#4 did, and it
  cost cycles rather than saving them.
- "Stop blocking a class after its Nth filing" was refuted on safety: the condition is
  indistinguishable from a coder who swept 3 of 10 sites, which `architect.md:336` documents as the norm.
- The `Met-by-plan` "unbreakable loop" was refuted by the data: `requirements_unmet` ran 1→0→0→0→1→1→0,
  and the `STALLED` terminal state at `SKILL.md:1134-1141` was never reached.
- All **fourteen** merged remediation proposals were rejected by at least one critic, and the
  synthesist agreed with the critics.

**Honest ceiling: one cycle of seven was provably waste** — cycle 4 (`CR-…ea0c` → `FIX-…3afe` →
`CR-…8695`), 46 minutes, 1,645 markdown lines, `lib/` byte-identical, and the CR says so itself:
*"What blocks is the record, not the code."* Cycles 2 and 3 found real vacuous guards; cycles 5, 6 and
7 found eighteen more, two proven vacuous by execution. Those are not waste.

## Disposition

Eight patches shipped, to `templates/architect.md`, `templates/reviewer.md` and
`references/artifact-format.md`, both hosts. Two of them (the `FIX`-plan criteria split and the
what-would-close-this test) delete cycle 4. One (the guard-corpus refusal) attacks the self-growth
mechanism at the generator rather than the gate. Five are plan-bloat, plumbing and a contract-conflict
repair worth zero cycles. No config key was added: every proposal that needed one died in critique.

**The largest remaining sinks are untouched and are named here so the next pass starts from them:**

- **The eval/review authority boundary.** Causal item 4 above is unfixed. Both attempted fixes shipped
  real vacuous guards in the critics' reconstruction.
- **Progress logs** — 632,974 B, 40.5% of all artifact bytes, written by the coder and read in full
  exactly once by that cycle's reviewer, then never again. The right approach is from the reader side
  (`reviewer.md:19`'s "fully read"), not by capping what the coder may write.
- **The reviewer's whole-union re-read** — 564 KB on all 7 cycles against deltas of 1–10 files.
  ADR-0022 declined per-cycle *narrowing* on value; ledger-based *inheritance* at an unchanged tree
  hash is a different shape and was not evaluated.
- **The coder is still the only role with no source artifact.** `templates/coder.md` contains
  "Acceptance Criteria", "Requirement Coverage", "spec", "CR", "vacuity" and "guard" zero times.

## Expected effect, stated so it can be falsified

6 cycles next run from the patches alone; 5 if the project-side changes land. Not 2. The markdown
ratio should improve to 8–11:1, but run 3's 15.61:1 was extreme mostly because production collapsed to
1,436 lines — 22,409 markdown lines over a 3,100-line deliverable is 7.2:1 without any change at all.
**Do not read a ratio improvement as evidence these patches worked.**

Checkable after run 4:
1. Grep the first FIX plan's `## Acceptance Criteria` for `appended|quoted|recorded|reconciled|withdrawn|stated`. Any hit means the criteria-split rule is not being applied.
2. A Must Fix whose `**File**:` is a `.progress.md` and whose closure is a document edit means the what-would-close-this test is not firing — unless it cites a PROJECT-CONTEXT invariant, in which case it is working as designed.
3. If `declaredPlanDocuments` grows during the run, the guard corpus is still a fixed point of the loop that produces it.
4. If `## Record-only notes` is longer than `## Must Fix` in any CR, the disclosure channel has become a dumping ground.
5. If the cycle count stays at 7 but the cycles are *different* ones, the change is neutral, not harmful — say so plainly rather than counting it as progress.
