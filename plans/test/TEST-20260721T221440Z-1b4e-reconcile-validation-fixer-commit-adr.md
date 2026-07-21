---
id: TEST-20260721T221440Z-1b4e
plan: FEAT-20260721T220140Z-7b61
title: Test Report — Reconcile validation-fixer batch commits with the commit-ownership ADR
status: PASS
created_at: 2026-07-21T22:16:15Z
cycle: 0
---

**Related:** [FEAT-20260721T220140Z-7b61](../feat/FEAT-20260721T220140Z-7b61-reconcile-validation-fixer-commit-adr.md)

## Summary

This is a **documentation-only** plan: it authors ADR-0008, supersedes ADR-0007, repoints
`validation-fixer/SKILL.md` citations, reconciles the batch/dedicated/main-agent lane wording
and the bug-6/bug-11 worked traces, and amends the `.orchestrator/PROJECT-CONTEXT.md`
§Invariants trust anchor. **There is no runtime code, no build, and no automated test/coverage
tooling in scope** — per PROJECT-CONTEXT §Commands and §Test tooling, the applicable automated
gate set for markdown doc-skill changes is **empty**, and the `clean-code-gates` JS suite is an
Invariant-scoped island that MUST NOT run against doc skills. Per the tester posture,
automated tests + coverage are treated as **N/A / advisory, not a hard block**, and
verification is **structural review** of the changed artifacts. All structural critical-flow
checks pass; nothing e2e-appropriate exists to add. **Status: PASS.**

## Flows Triaged

"Flows" for this repo are skill behaviors described in prose; they are verified by structural
review, not execution (PROJECT-CONTEXT §Critical flows, §Test tooling → "e2e: none").

| Flow (candidate)                                              | Criticality | Decision       | Rationale |
| ------------------------------------------------------------ | ----------- | -------------- | --------- |
| validation-fixer commit-ownership citation → governing ADR   | High        | Structural (no e2e) | No runtime; correctness = every ADR-0007 citation now points at an ADR that authorizes the behavior. Verified by grep + read, not execution. |
| Batch lane authorized under the work-unit contract           | High        | Structural (no e2e) | Core of the reconciliation (AC-4). No executable path — it is prose describing shared-commit / shared-SHA / whole-batch rollback. Verified by read. |
| ADR-0007 superseded, body preserved                          | High        | Structural (no e2e) | AC-2 is a documentary invariant; verified by `git diff` (+3/-1, status line + forward pointer only). Not e2e-able. |
| PROJECT-CONTEXT §Invariants trust-anchor amendment           | High        | Structural (no e2e) | AC-5 policy anchor; correctness = wording (per-work-unit rollback, 3 safeguards, "no other skill may commit", narrow exception). Verified by diff. |
| Backward-compat of legacy single-SHA `_fixed via …_` line    | Medium      | Structural (no e2e) | AC-8; additive-not-migration claim is a prose guarantee, no parser in this repo to exercise. Verified by read. |
| sec-3 shell-safe commit construction preserved verbatim      | Medium      | Structural (no e2e) | AC-7 security preservation; verified the recipe block is unchanged in meaning (diff shows only citation/authorization wording moved). |
| `clean-code-gates` JS suite                                  | —           | **Excluded**   | Out of scope by Invariant — that suite is scoped to its own skill and MUST NOT run against doc-skill changes; no `clean-code-gates` file was touched. |
| Any Playwright/HTTP/CLI e2e                                   | —           | **Excluded**   | No runnable application, server, or CLI is produced by this plan; there is nothing to drive end-to-end. e2e is expensive and here has zero surface. |

**e2e selected: none** — justified: the plan produces no executable surface. Every acceptance
criterion is a documentary/structural invariant, best (and only) verified by inspecting the
artifacts. Writing an e2e harness for markdown edits would be pure overhead with no flow to
exercise.

## E2E Tests Added

**None.** No runtime code, server, or CLI exists to drive. Adding e2e here is inapplicable
(PROJECT-CONTEXT §Test tooling → "e2e: none — flows are skill behaviors described in prose").

## Coverage

**Not measured — N/A by project design.** PROJECT-CONTEXT §Test tooling: "Coverage: not
measured except within `clean-code-gates`." No code in this plan's diff is instrumentable; the
70% line-coverage floor does not apply to markdown+template authoring. Before → after:
**N/A → N/A** (no coverage tool in scope; not a BELOW_FLOOR condition — the floor is defined
as inapplicable, not missed).

## Test-Quality Audit

No coder-authored automated tests exist for this plan (none are applicable), so there are no
weak assertions, empty asserts, or tautologies to flag. In lieu of a test-quality audit, I
re-ran the plan's **structural checks** against the live artifacts:

- **AC-1 (ADR-0008 exists, complete):** present at `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md`;
  headings Context / Decision / Alternatives / Consequences all present; Status **Accepted**;
  explicitly **Supersedes ADR-0007**; all four dimensions covered — authorization (two gates:
  Step-2.5 routing + Step-3.4 per-commit), provenance (shared SHA = intentional N→1 mapping
  with reader interpretation), rollback ("one work unit = one commit = one revertible unit",
  whole-batch, tracked+untracked, validation-file-preserving), resumability (all members
  `[x]`/`[~]` together) — at work-unit granularity (single item OR batch ≥2). **PASS.**
- **AC-2 (ADR-0007 superseded, body preserved):** `git diff` = +3/-1 — Status line flipped to
  "Superseded by ADR-0008" + a forward-pointer blockquote; the rejected "Batch-commit
  sub-decision" and all reasoning unchanged. **PASS.**
- **AC-3 (SKILL.md citations):** `grep -n 'ADR-0007'` returns exactly **one** hit (line 338),
  and it is the "supersedes ADR-0007" framing — not a live sole-authority citation. **Ten**
  ADR-0008 citations govern the commit branches (337, 408, 429, 448-455, 465, 472, 579, 610).
  No citation presents an ADR that forbids the behavior at that citation. **PASS.**
- **AC-4 (batch lane authorized):** lines ~445-479 describe the batch as a work unit of size
  ≥2, shared commit / shared-SHA / whole-batch rollback / joint resumability all read as
  **authorized** by the two ADR-0008 gates; dedicated (line 408) and main-agent (429) lanes
  named work-units-of-size-1 with per-item commit intact. **PASS.**
- **AC-5 (PROJECT-CONTEXT invariant):** line 68 cites **ADR-0008 (superseding ADR-0007)**,
  uses "per-work-unit" rollback wording (validation-file-preserving; batch rolls back whole),
  names all three safeguards (checkpoint/standing approval + Step-2.5 batch approval,
  per-work-unit rollback, protected-branch STOP), reaffirms "**No other skill may commit**",
  exception kept narrow. **PASS.**
- **AC-6 (worked traces consistent):** bug-6 batch note (lines 577-582) and bug-11 batch note
  (609-612) both state a batch is one shared-commit revertible unit while two dedicated items
  remain two separate commits. **PASS.**
- **AC-7 (no behavioral drift; security preserved):** diff adds **zero** lines touching the
  superpowers/gsd paths; the sec-3 shell-safe construction block (349-369: single-quoted
  heredoc `git commit -F -`, `git add -- <path>`, one-physical-line collapse, never
  interpolate item text), the one-line-per-concern trust rule, and the untrusted-evidence
  frame are unchanged in meaning. **PASS.**
- **AC-8 (backward compat):** ADR-0008 Consequences + SKILL.md state the shared-SHA batch line
  is **additive**; a legacy single-SHA `_fixed via <framework> · <sha> · <date>_` line still
  parses/renders as a size-1 work unit; no migration. **PASS.**
- **Scope hygiene:** only 3 files modified (`PROJECT-CONTEXT.md`, ADR-0007, SKILL.md) + 1 new
  (ADR-0008); **no `.opencode/` port created** (correct — single-copy skill); cross-links
  ADR-0008 ↔ ADR-0007 resolve both directions.

## Verdict

**PASS.** All eight acceptance criteria hold under structural review; the ADR-0008 ↔ ADR-0007
status ↔ SKILL.md citations ↔ PROJECT-CONTEXT invariant chain is internally consistent on the
work-unit contract. No e2e is applicable (no executable surface) and the coverage floor is
N/A by project design (markdown doc-skill authoring). No weak tests found (none exist / none
applicable). Ready for the reviewer.
