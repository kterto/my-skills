---
id: CR-20260721T221802Z-32c8
plan: FEAT-20260721T220140Z-7b61
title: Review of Reconcile validation-fixer batch commits with the commit-ownership ADR
status: APPROVED
created_at: 2026-07-21T22:20:03Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 0
---

**Related:** [FEAT-20260721T220140Z-7b61](../feat/FEAT-20260721T220140Z-7b61-reconcile-validation-fixer-commit-adr.md)

## Summary

Doc-only reconciliation that closes finding `arch-1`: the `validation-fixer` severity-routing batch lane lands one shared commit but cited ADR-0007, whose Decision authorizes commit ownership only for a single item and whose Alternatives section explicitly rejects batch commits. The change authors ADR-0008 (work-unit commit ownership + batch atomicity) superseding ADR-0007, repoints all four SKILL.md citations, reconciles the batch lane and the bug-6/bug-11 worked traces, and amends the PROJECT-CONTEXT §Invariants trust anchor. All eight acceptance criteria hold under structural review; the security recipe, trust rules, and superpowers/gsd paths are untouched. Verdict: APPROVED.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | ADR-0008 exists, Accepted, mirrors 0007's four-section shape, states supersession, covers all four dimensions at work-unit granularity | ✅ | Context / Decision / Alternatives / Consequences present; authorization (two gates), provenance (shared-SHA N→1 mapping with reader interpretation), rollback (whole-work-unit, tracked+untracked, validation-file-preserving), resumability (per-work-unit `[x]`/`[~]`) all defined around work unit = single item OR batch ≥2. |
| 2 | ADR-0007 Status reads "Superseded by ADR-0008" + forward pointer; rest of body preserved | ✅ | Diff is +3/-1: status line flipped, forward-pointer paragraph added; rejected batch sub-decision and reasoning preserved verbatim. |
| 3 | Every ADR-0007 citation in SKILL.md repointed to the governing ADR; none points at an ADR that forbids the behavior | ✅ | The four anchors (3.4 commit-ownership, dedicated lane, main-agent lane, batch lane) now cite ADR-0008; the single residual "ADR-0007" mention (line 338) is the supersession clause, not a live-authority citation. |
| 4 | Batch lane described as authorized under work-unit contract; single-item lanes remain authorized as size-1 work units | ✅ | Batch lane (~444-476) frames shared-commit / shared-SHA / whole-batch rollback / joint resumability as authorized by the two ADR-0008 gates; dedicated and main-agent lanes labeled work-units-of-size-1 with per-item commit intact. |
| 5 | PROJECT-CONTEXT §Invariants cites ADR-0008, per-work-unit rollback wording, same three safeguards, still "no other skill may commit", exception narrow | ✅ | Line amended to cite ADR-0008 (superseding ADR-0007), "atomic per-work-unit rollback (…validation-file-preserving; a batch rolls back whole)", checkpoint/standing + Step-2.5 batch approval, protected-branch STOP, closing "No other skill may commit." Exception stays `validation-fixer`-only. |
| 6 | bug-6 and bug-11 worked traces + batch-note addenda consistent with the boundary | ✅ | bug-6 note: A and B are two size-1 work units → two commits; a batch would be one shared commit. bug-11 note: two size-1 units → two independent rollbacks; a batch rolls back whole to `[~]`. |
| 7 | No behavioral change to superpowers/gsd or severity-routing mechanics beyond commit/rollback/provenance/resumability wording; Step-1 trust rule, untrusted-evidence frame, sec-3 shell-safe construction preserved | ✅ | Diff touches only citation/authorization prose; grep confirms the sec-3 heredoc recipe, one-line-per-concern rule, and superpowers/gsd path text are unchanged. |
| 8 | Backward compatibility holds: legacy single-SHA line parses; shared-SHA batch line additive | ✅ | ADR-0008 Consequences states the legacy single-SHA line is the size-1 record, unchanged; shared-SHA batch line is additive, not a migration. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

None — no warnings found.

## Verdict

**Status**: APPROVED

All eight acceptance criteria are satisfied, the change is scoped exactly to the plan's four target files (ADR-0008 authored, ADR-0007 status flipped, SKILL.md citations reconciled, PROJECT-CONTEXT invariant amended), no security or non-scope prose was altered, and the load-bearing invariants (single narrow commit exception, backward compatibility, no unwarranted opencode port) are respected.

Invoke `/qa` with plan ID `FEAT-20260721T220140Z-7b61` to run the QA suite.
