---
id: CR-20260807T015046Z-032f
plan: FIX-20260807T013331Z-d607
title: Review of Fix parallel-path routing, lane-ID reuse, config.md materialization, and PM scope
status: APPROVED
created_at: 2026-08-07T01:50:46Z
reviewer: reviewer-agent
cycle: 2
must_fix_count: 0
should_fix_count: 2
---

**Related:** [FIX-20260807T013331Z-d607](./FIX-20260807T013331Z-d607-parallel-path-routing-fixes.md) · [CR-20260807T012541Z-a43d](./CR-20260807T012541Z-a43d-orchestrator-parallel-lane-execution.md) · [FEAT-20260807T004018Z-c4af](../feat/FEAT-20260807T004018Z-c4af-orchestrator-parallel-lane-execution.md)

## Summary

Reviewed the union working-tree diff (12 files, +800/−27) against this plan's 12 acceptance criteria, the four Must Fix and four Should Fix items of `CR-20260807T012541Z-a43d`, and `PROJECT-CONTEXT.md`'s invariants. **All four blockers are genuinely closed** — each verified by reading the current file text at the anchor, not by trusting the progress log. MF-4 in particular is closed at the strongest possible level: `product-manager/SKILL.md` shows **zero diff against HEAD**, so the "byte-identical to its pre-feature form" claim is not a prose assertion but a git fact.

All four Should Fix items were also implemented (none skipped), and the remediations are the ones the CR asked for rather than cheaper substitutes — SF-1's honest pricing lands in all three places (the `ask` ladder option 3, the 3j.3 join description, and `reviewer.md` Step 1a), and SF-2's recoverability rationale is written in terms a future `simplify` pass would have to argue against, which was the point.

**Both coder notes checked rather than taken on trust.** (a) The task-count discrepancy is real and benign: `grep -c '^- \[x\]'` returns **36**, `^- \[ \]` returns **0**, and the per-phase split is exactly 6+5+7+6+9+3 = 36. The plan header and the ARCHITECT log entry say 34. Every bullet written into the plan was executed; nothing was added or dropped. It is an architect arithmetic slip, already self-disclosed in both the plan and `.progress.md`, and not worth a finding. (b) The `references/config.md:47` ADR-0001 link concern is **valid and I am recording it** — as SF-2 below, alongside a second dangling link in the same file that is sharper than the one flagged. It is not a blocker; the reasoning is in the finding.

Collateral-regression guard re-run independently: `node --test scripts/render-artifact.test.cjs` → **45 pass / 0 fail**, matching the count `CR-…-a43d` recorded.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Step 2p ends with an explicit branch instruction (`lanes`/`full` → 2c, Steps 2/3 skipped; `off` → Step 2) | ✅ | New `#### 2p.6 — The fork (where this step hands off)` at `SKILL.md:412-417`. Names both branches and restates the 2c/2L/3L/3j skip for the `ask`→`off` case, which Step 0b's skip does not cover. |
| 2 | Step 2 and Step 3 each carry a **Sequential path only** gate naming their replacement | ✅ | `:421` and `:452`. Phrasing mirrors the existing `Parallel path only` gates at `:478`, `:514`, `:543`, `:563`. Step 3's gate also routes the simplification pass to 3j item 3. |
| 3 | Step 2L has no `newid FEAT` imperative; 2c is the sole allocation site; spawn line names the 2c-assigned ID | ✅ | `:516` declares 2c the sole allocation site and forbids a second call. `:524` reads `ID to use: {the FEAT-<id> Step 2c assigned to this lane}`. Repo-wide `newid FEAT` now appears only at `:150` (the generator comment) and `:504` (Step 2c). |
| 4 | Step 2L retains the no-directory-scan rationale explaining why re-generation is silent | ✅ | `:518` — kept and sharpened: "`newid FEAT` has nothing to collide with, so it always succeeds and always yields a **different** set", tied through to the join's lane-map lookup. |
| 5 | B3 step 2 copies `references/config.md`; B3 step 4 lists it; the "Re-copy all …" count agrees | ✅ | `:52` (with a useful disambiguation from `.orchestrator/config.json`), `:56` "Re-copy all four", `:60` summary line. Step 2's heading updated to "artifact rules + config reference + html scaffolds + render scripts". |
| 6 | Three `SKILL.md` refs → `references/config.md`; `architect.md`'s two stay `.orchestrator/config.md` | ✅ | `SKILL.md:257`, `:278`, `:948` now match `:14`'s pre-existing form. `architect.md:157`, `:161` unchanged and now reachable via AC 5. Verified by `grep -rn "config\.md"` across `SKILL.md`, `templates/`, `references/`. |
| 7 | PM `SKILL.md` no longer passes `--parallel off`; invocation byte-identical to pre-`FEAT-…-c4af` | ✅ | `git diff --stat -- plugins/my-skills/skills/product-manager/` reports **only** `references/git-flow.md`. `SKILL.md` has no diff against HEAD at all — byte-identity is a git fact, not a claim. |
| 8 | `git-flow.md` carries exactly one bounded docs-only Step 2p paragraph, symmetric to the Step 0 paragraph | ✅ | `+2 -0`, one blockquote at `:63`. Same `> **…**` blockquote shape as the adjacent Step 0 note. Covers the `ask`-reachability trace, the option-1 answer, the opt-in case, and closes "PM's command surface is unchanged and PM passes no parallelism flag." No `--parallel` token anywhere in the skill. |
| 9 | Step 2p.4's closing sentence no longer asserts what `product-manager` passes | ✅ | `:398` — generic and still true: "A non-interactive caller may additionally pass `--parallel off` explicitly…". The `— product-manager does —` clause is gone. |
| 10 | Parent AC 14 holds unqualified: `off` path identical to pre-feature text | ✅ | The only PM-side breach is removed. Every parallel addition remains gated; the two new gate lines at `:421`/`:452` are orchestrator-facing prose, not prompt-block or stdout text — no prompt block, status line, or header line changed on the `off` path. `artifact-format.md`'s Parallel-mode line table is explicitly additive. |
| 11 | No new top-level `plans/` directory; no allow-list row modified | ✅ | `grep -oE "plans/[a-z-]+/"` over `SKILL.md` yields exactly the seven allow-listed dirs. `PACT` was added as a **prefix** row co-locating in `plans/feat/`, with the ban restated at `artifact-format.md:97`. |
| 12 | Every cross-reference added or changed resolves to a real file and a real heading | ⚠️ | Every reference this plan added or changed resolves. But materializing `config.md` into `.orchestrator/` newly exposes two of *its own* outbound links, which do not resolve from a target project. See **SF-2** — the safety-critical content is self-contained, so this is a warning, not a blocker. |

## Must Fix (Blockers)

None — no blockers found.

All four Must Fix items from `CR-20260807T012541Z-a43d` are closed, verified at the source anchors:

- **MF-1** (parallel path never branched away from Steps 2/3) — closed by 2p.6 plus the two mirror gates. I walked the document top-to-bottom twice. As a `lanes` run: `0b → 0c → 1 → 2p → 2p.6 → 2c → 2L → 3L → 3j → 3b → 4 → 5 → 7`, with Steps 2 and 3 gated out. As an `off` run: `0b → 1 → 2 → 3 → 3b → 4 → 5 → 7`, with 0c/2p/2c/2L/3L/3j gated out. Each path visits exactly one of the two branches, and the double-execution scenario the CR described is no longer reachable.
- **MF-2** (five refs at an unmaterialized path) — closed on both sides of the split the CR prescribed: B3 now materializes the file, and `SKILL.md`'s three refs were repointed at the skill directory while `architect.md`'s two correctly stayed at `.orchestrator/`. The single-source-of-truth convention held: the owned-glob rejection list still has exactly one normative copy (`config.md:51`), and nothing was inlined into `SKILL.md` or `architect.md`.
- **MF-3** (lane IDs allocated twice) — closed. The `PACT` lane map's `Lane plan ID` column, the Step 2L spawn line, and `artifact-format.md` → `PACT` ID resolution step 2 now provably name one and the same ID set.
- **MF-4** (out-of-scope PM behavior change) — closed by restoring scope, which is the option the CR preferred and the one AC 13 had already pre-authorized. The ruling is recorded under Technical Notes with its reasoning, so a future reader can see *why* the flag was rejected rather than finding it silently absent.

## Should Fix (Warnings)

### SF-1 — Pipeline overview says "three no-prompt guards"; Step 2p.4 says two and explicitly denies a third

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:78`

**Problem**: The parallel-branch bullet in the Pipeline overview reads: *"Falls back to `off` on any of six non-viability conditions or three no-prompt guards."* Step 2p.4 is now headed **"Two hard no-prompt guards"**, lists exactly two, and closes with an explicit denial: *"A non-viable split (2p.3) also resolves to `off`, but that is 2p.3's own outcome, not a third guard."*

This is drift left over from the FEAT's `simplify` pass, which reclassified the non-viable case out of 2p.4 — the summary bullet was not updated with it. No task in this FIX plan covered it, so it is not a regression this plan introduced; it is a pre-existing inconsistency that the plan's Phase 1 document-walk passed over.

It is worth fixing because the overview and the normative step now *contradict* rather than merely differ in detail, and the contradiction is about a count in a safety-gate description — the same class of off-by-one SF-3 of the previous CR flagged in `architect.md` hard rule 1, which this plan did fix.

**Fix**: Change `:78` to "…on any of six non-viability conditions or two no-prompt guards", matching the 2p.4 heading.

---

### SF-2 — The newly materialized `.orchestrator/config.md` carries two repo-relative links that do not resolve in a target project

**File**: `plugins/my-skills/skills/orchestrator/references/config.md:47` and `:49`

**Problem**: MF-2's fix makes B3 copy `references/config.md` → `target/.orchestrator/config.md`. That is correct and is what makes the architect's rejection-rule pointer reachable. But the file was written for a location it no longer exclusively occupies, and two of its own outbound references break in the copy:

1. `:47` — `[ADR-0001](../../../../../docs/adr/0001-orthogonal-system-band.md)`. Five `..` from `plugins/my-skills/skills/orchestrator/references/` lands on this repo's root, so it resolves *here*. From `target/.orchestrator/` the same relative path lands five levels **above** the target repo root. (This is the item flagged for verification — confirmed real.)
2. `:49` — *"`name` and `path` obey the `systems` name/path grammar defined in `roadmap/references/config.md` → `systems` … Read it there and apply it unchanged."* This one is sharper than the ADR link, because it is **normative** and load-bearing for lane validation, and `roadmap/references/config.md` is a skill-directory path that does not exist in a bootstrapped target project at all.

Both are pre-existing lines that this plan neither added nor changed; the plan changed their *reachability context*, which is why they surface now.

**Why this is a warning and not a blocker.** MF-2's failure scenario was the contract architect falling back to memory for the **owned-glob rejection list**, letting an unbounded or `..`-escaping glob into the `PACT` and collapsing the only isolation mechanism between concurrent coders. That list at `config.md:51` is **fully self-contained** — it enumerates every rejection case inline — and it is now reachable. What remains unreachable is the secondary lane *name/path* grammar, and the isolation boundary does not rest on it: `SKILL.md` Step 0c already validates and **drops** invalid lanes before the contract architect is ever spawned (`:278-279`), and Step 0c runs in the caller's session where `references/config.md` and the roadmap skill's own reference both resolve. The architect's re-validation is defense in depth over an already-filtered set, so the degradation is real but bounded.

**Fix**: Two options, either is fine.

- Make the two references location-independent — cite ADR-0001 by identifier and title rather than by relative path, and state that the `systems` grammar is owned by the `roadmap` skill's `references/config.md` (naming the skill, not a path that only resolves inside this repo).
- Or add a one-line note at the top of `config.md` that it is materialized into `.orchestrator/config.md`, and that citations to files outside the orchestrator skill are provenance references resolvable in the authoring repo only.

The first is preferable — it keeps the materialized copy honest rather than annotating it as partly broken.

## Verdict

**Status**: APPROVED

All four Must Fix items are closed at their anchors and verified independently of the coder's report; the two remaining warnings are pre-existing documentation drift that neither blocks the parallel path nor touches the `off` path.

Invoke `/qa` with plan ID `FIX-20260807T013331Z-d607` to run the QA suite.
