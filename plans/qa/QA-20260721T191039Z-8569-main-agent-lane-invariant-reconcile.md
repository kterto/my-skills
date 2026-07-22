---
id: QA-20260721T191039Z-8569
plan: FIX-20260721T185705Z-a3ae
cr: CR-20260721T190637Z-0819
title: QA Report — Reconcile the never-fabricates-a-fix invariant with the no-framework main-agent lane
status: READY_TO_COMMIT
created_at: 2026-07-21T19:12:44Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260721T185705Z-a3ae](../code-review/FIX-20260721T185705Z-a3ae-main-agent-lane-invariant-reconcile.md)

## Summary

QA of the prose-only FIX-a3ae edits to `plugins/my-skills/skills/validation-fixer/SKILL.md`, which finalize the larger orchestrator-is-a-Skill + severity-routing change (FEAT-ab8c / SPEC-1089). This is a doc skill with no build/test/lint/coverage/mutation tooling in scope (PROJECT-CONTEXT → Commands / Test tooling), so the code gates are N/A — not BLOCKED — and QA is a structural / consistency review of the final `SKILL.md`. All structural checks hold: both Change A and Change B are fully present and faithful to SPEC-1089 and the four locked decisions (Q1–Q4); the MF-1/SF-1/SF-2 reconciliations are self-consistent; every load-bearing invariant (bug-6/7/11/12/15, sec-3, ADR-0007, untrusted-evidence) is preserved and only extended; dual-host wording is intact; and no stray file changed outside the one SKILL.md (plus plan/report bookkeeping artifacts). Verdict: READY_TO_COMMIT.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Automated tests (doc skill) | — | — | — | — | N/A — no suite in scope |
| Lint | — | — | — | — | N/A — no markdown lint configured |
| Build / typecheck | — | — | — | — | N/A — no build for markdown authoring |
| Format check | — | — | — | — | N/A |
| Structural self-consistency (Read + grep) | — | ✅ | 0 | — | ✅ |

No automated suite exists for markdown doc skills in this repo (`clean-code-gates` is the lone JS+test island and is out of scope here). Verification is structural review per PROJECT-CONTEXT.

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | N/A — prose Markdown, no executable code |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | N/A — no code |
| G4 Naming | intent-revealing | 0 violations | N/A — no code |
| G5 No comments | inline comment audit | 0 violations | N/A — Markdown prose |
| G6 Mutation score (changed files) | killed / total | ≥70% | N/A — no test suite |
| G7 Dependency structure | layering, cycles | 0 violations | N/A — no code modules |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ✅ 0.0 (CR-0819 APPROVED first pass; no FIX/QAF spawned from this plan) |

The absence of code tooling for a doc-only prose change is **N/A**, not a BLOCK — consistent with the doc-skill posture stated in the QA brief and PROJECT-CONTEXT. The structural gates below stand in for the code gates.

## Structural QA Gates (doc-only)

| # | Structural check | Result |
|---|------------------|--------|
| S1 | Change A — orchestrator = host **Skill** (caller session, spawns own role subagents, stops at `READY_TO_COMMIT`, never commits, unattended-friendly) across Step-2 bullet (93–98), autonomous warning (109–113), Step-3.3 table row (309) | ✅ |
| S2 | Change A — no residual `subagent_type: orchestrator` / "Runs as a subagent" / orchestrator-run-AS-a-subagent phrasing (grep clean; line 309 "spawns its own … role subagents" is the orchestrator's correct internal behavior, not the forbidden framing) | ✅ |
| S3 | Change B — Step 2.5 severity routing present (137), orchestrator-only + skip for superpowers/gsd (139–143); severity token read + missing→`unknown` (153–162); three default lanes (168–172) | ✅ |
| S4 | Change B — three lanes documented: Dedicated (401–408), Main-agent (410–438), Batch (440–464); work-unit generalization of Step 3 (209–228) | ✅ |
| S5 | Four locked decisions Q1–Q4 present and faithful (193–206): Q1 severity-descending, Q2 batch-of-one→dedicated, Q3 unrestricted edits / collapse-everything, Q4 batches never span files | ✅ |
| S6 | Q5 main-agent mechanics: untrusted-evidence frame (417–420), inline fix + best-effort tests (421–424), commit via 3.4/ADR-0007 (425–431), checkpoint diff-approval = validation gate (432–435), failure rollback→`[~]` (436–438) | ✅ |
| S7 | MF-1 resolved: generalized fix-producer predicate admits main-agent inline fix + real commit — Notes guard (623–629) and Step-4 leading condition (470–476) agree with per-work-unit paragraph (491–498); real-commit requirement kept | ✅ |
| S8 | SF-1 resolved: `main-agent` provenance token deterministically defined → `_fixed via main-agent · <sha> · <date>_` (486–489, 491–492), mirroring batch/dedicated `orchestrator` resolution | ✅ |
| S9 | SF-2 resolved: Step-3 sub-step 3 carve-out (297–300) — inline fix, no framework spawned, points at "Orchestrator routing lanes → Main-agent lane"; matches preamble divergence note | ✅ |
| S10 | Invariants preserved & only extended: bug-6 (232–251), bug-7 (117–135, 367–371), bug-11 (252–282), bug-12 (320, 474–476, 611–614, 628–629), bug-15 (262–275, 379–382), sec-3 (346–366), ADR-0007 single-committer (334–338, 425–431), untrusted-evidence frame (72–80, 283–296) | ✅ |
| S11 | Dual-host wording intact: `Skill`/opencode skill mechanism, `Agent`/`task` in allowed-tools, `AskUserQuestion`/`question`; no opencode override port for validation-fixer → parity rule not triggered | ✅ |
| S12 | Cross-references resolve: step numbers, lane headings, bug-N / sec-3 / ADR-0007 tags, findings-md-schema reference — no dangling reference | ✅ |
| S13 | Scope: working tree modifies only `plugins/my-skills/skills/validation-fixer/SKILL.md`; remaining deltas are untracked plan/report bookkeeping artifacts under `plans/` | ✅ |

## Failures

None — all structural checks passed.

## Lint / Format / Type Issues

None — no markdown lint/format/type tooling in scope; nothing to report.

## Verdict

**Status**: READY_TO_COMMIT

All structural QA gates hold: Change A and Change B are fully and faithfully present, MF-1/SF-1/SF-2 are reconciled without contradiction, every locked invariant is intact, dual-host wording is preserved, and no stray file changed. Code gates are N/A for this doc-only prose change (absence of tooling is not a block). Safe to commit and open PR.
