---
id: CR-20260721T190637Z-0819
plan: FIX-20260721T185705Z-a3ae
title: Review of Reconcile the never-fabricates-a-fix invariant with the no-framework main-agent lane
status: APPROVED
created_at: 2026-07-21T19:06:37Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 0
---

**Related:** [FIX-20260721T185705Z-a3ae](./FIX-20260721T185705Z-a3ae-main-agent-lane-invariant-reconcile.md)

## Summary

Prose-only review of the FIX-a3ae edits to `plugins/my-skills/skills/validation-fixer/SKILL.md`, which resolve CR-20260721T185132Z-138e (MF-1 blocker + SF-1, SF-2). All three findings are correctly and non-contradictorily resolved: the two authoritative success predicates (Notes guard and Step-4 leading condition) are generalized to a "fix producer" predicate that admits the main-agent inline fix while still requiring a real commit; the `main-agent` provenance token is deterministically defined; and the Step-3 loop sub-step carries an inline carve-out. The generalization weakens no load-bearing invariant — the real-commit requirement, bug-12, the bug-6/7/11/15 rollback/gate semantics, sec-3 shell-safe commit construction, and ADR-0007 single-committer all remain intact. Verdict: APPROVED.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Notes guard states a success predicate admitting a completed main-agent inline fix + real commit, while still requiring a real commit and preserving bug-12 | ✅ | Lines 623–629: "the fix producer **signaled success** — a framework's normal completion / `READY_TO_COMMIT`, **or the main-agent lane's completed inline fix** — *and* a real commit exists for it". Real-commit requirement kept; "committed-then-blocked → `[~]`" (bug-12) preserved verbatim |
| 2 | Step-4 leading condition carries the same predicate and agrees with the per-work-unit paragraph | ✅ | Lines 470–476 mirror the Notes predicate; per-work-unit paragraph (491–498) agrees; bug-12 partial-commit clause unchanged |
| 3 | Deterministic provenance token for the main-agent lane | ✅ | Lines 486–489: `<framework>` = literal `main-agent` → `_fixed via main-agent · <sha> · <date>_`, explicitly mirroring the batch/dedicated `orchestrator` resolution; restated at 491–492 |
| 4 | Step 3 sub-step 3 carve-out pointing at the main-agent lane | ✅ | Lines 297–300: parenthetical notes no framework is spawned, this step *is* the host main agent's inline fix under the untrusted-evidence frame, → "Orchestrator routing lanes → Main-agent lane"; skip the invocation table |
| 5 | Whole-file self-consistency: no framework-only success phrasing contradicts the main-agent lane; no locked invariant weakened | ✅ | Both success predicates generalized; 3.4's framework-worded success branch is explicitly claimed by the main-agent lane (425–431, "exactly the 'HEAD unchanged, tree dirty, success' branch of 3.4"); all invariant tags resolve; no locked decision weakened (see below) |

## Invariant verification (per review charge)

- **Real-commit requirement — HELD.** Both generalized predicates still gate `[x]` on "*and* a real commit exists for it." The main-agent lane produces that commit through the Step-3.4 commit-ownership path (425–431); the generalization admits the lane without dropping the commit requirement.
- **bug-12 (committed-then-blocked → `[~]`) — INTACT.** Notes guard (628–629), Step-4 leading condition (474–476), per-work-unit paragraph (496–498), and the Edge-cases bullet (611–614) all retain the "a commit alone never means fixed" rule.
- **bug-6/7/11/15 rollback & gate semantics — UNCHANGED.** The 3.1 clean-tree gate, the bug-7 preflight, and the validation-file-preserving rollback are untouched; the main-agent lane's failure handling (436–438) delegates to the bug-11/bug-15 rollback rather than inventing a new one.
- **sec-3 shell-safe commit construction — INTACT.** The main-agent lane commits "under the full sec-3 shell-safe construction … exactly as 3.4 specifies … This lane adds **no** commit divergence — 3.4 is the single authoritative recipe" (425–431). No parallel weaker commit path was introduced.
- **ADR-0007 single-committer — TRUE.** Across all lanes the only committer remains validation-fixer via Step-3.4 commit-ownership. The main-agent lane changes only *who fixed it* (the host main agent), not *who commits* — validation-fixer still owns every commit.
- **No residual contradiction elsewhere.** The Step-3.4 success branches and the Edge-cases no-commit bullet (608–610) are framework-worded, but (a) the main-agent lane explicitly maps itself onto the 3.4 "HEAD unchanged, tree dirty, success" branch, and (b) the 608 bullet is a *failure/no-commit → `[~]`* rule, not a success predicate — it neither gates nor forbids a legitimate main-agent `[x]`. Neither contradicts the main-agent lane.

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

None — no warnings found.

## Verdict

**Status**: APPROVED

The three CR-138e findings are resolved without contradiction, and the generalized success predicate admits the main-agent inline fix while leaving every load-bearing invariant (real-commit, bug-12, bug-6/7/11/15, sec-3, ADR-0007) intact.

Invoke `/qa` with plan ID `FIX-20260721T185705Z-a3ae` to run the QA suite.
