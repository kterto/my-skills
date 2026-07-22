---
id: CR-20260722T042857Z-6f19
plan: FEAT-20260722T041913Z-916b
title: Review of Resolve collapse-all (Q3) vs. no-cross-file (Q4) conflict in validation-fixer directory mode
status: APPROVED
created_at: 2026-07-22T04:30:57Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260722T041913Z-916b](../feat/FEAT-20260722T041913Z-916b-collapse-all-per-file-batch.md)

## Summary

Doc-only prose change resolving the bug-2 latent contradiction between routing rules Q3 ("collapse everything into a single batch") and Q4 ("a batch never spans files") in `validation-fixer/SKILL.md`, per SPEC-...-a3f5. The change makes Q4 the governing invariant and redefines collapse-all in directory mode as one collapsed batch per file (one shared commit per file), with commit/rollback/recording/Step-6 semantics stated consistently, a new 2-file worked trace, and a one-line ADR-0008 note. Scope is contained to the two intended files; all 10 acceptance criteria are met with zero blockers. **Verdict: APPROVED.**

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Q4 stated as governing invariant over Q3; "collapse everything" never spans files; "overriding all lane defaults" clarified to lane defaults not file boundary | ✅ | `SKILL.md:309-327` — Q4 titled "the hard invariant that governs Q3"; Q3 explicitly says overriding lane defaults "never overrides the Q4 file boundary" |
| 2 | Collapse-all over ≥2 files = one collapsed batch per file; N files → N batches/commits | ✅ | `SKILL.md:313-317` |
| 3 | Single-file mode noted as degenerate case; wording is a superset, not a change | ✅ | `SKILL.md:319-321` |
| 4 | Commit semantics: each per-file batch one shared commit covering only that file's paths; no commit spans two files; message = joined batch summary under unchanged sec-3 construction | ✅ | `SKILL.md:739-744` |
| 5 | Rollback semantics: whole-batch rollback to `$BEFORE_SHA` via validation-file-preserving rollback; marks members `[~]`; one file's failure never rolls back another's committed batch; independent revertible unit | ✅ | `SKILL.md:757-761` |
| 6 | Recording: every member `[x]` in its own file with that file's shared SHA; no shared SHA across files | ✅ | `SKILL.md:749-752` |
| 7 | Step-6 per-file summary consistent: own counts + own single shared SHA; no cross-file SHA aggregation | ✅ | `SKILL.md:939-942` |
| 8 | Worked 2-file directory-mode trace: two per-file batches, two shared commits, independent whole-batch rollback per file | ✅ | `SKILL.md:896-930` — new `## Collapse-all per-file batch lifecycle` trace in the bug-11 trace style |
| 9 | Q1/Q2 preserved: severity-descending order (Q1); single-member group collapses to dedicated (Q2); collapse-all changes grouping only | ✅ | `SKILL.md:329-333` |
| 10 | Backward compatibility in prose: single-file, existing records, legacy single-SHA lines unchanged; additive, no migration | ✅ | `SKILL.md:319-321`; ADR-0008 backward-compat bullet unchanged |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — "N batches and N shared commits" over-generalizes the single-item-file edge

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:316-317`
**Problem**: Q3 states that N collapse-all files "yield **N batches and N shared commits**." Strictly, a collapse-all file that holds exactly **one** open item does not form a batch — per Q2 (and the preservation clause at lines 329-333) that single-member group collapses to the dedicated single-item path, yielding a per-item commit, not a batch/shared commit. So the count "N batches" is imprecise for a directory where some files have a lone open item. The immediately-following "Collapse-all preserves Q1 and Q2" paragraph (329-333) does reconcile this, so the meaning is recoverable — this is a tightness nit, not a contradiction.
**Fix**: Optionally soften to "N collapse-all files yield up to N batches / N shared commits (a file with a single open item collapses to a dedicated per-item commit per Q2)," or add a parenthetical pointer to the Q2 clause at the count. Non-blocking.

---

## Verdict

**Status**: APPROVED

All 10 acceptance criteria are met, the Q3/Q4 contradiction is resolved with Q4 stated as governing, every clause is internally consistent and cross-references resolve, invariants (opencode-port-parity N/A — no port; backward compatibility; trust frame and sec-3 unchanged; clean-code-gates untouched) hold, and scope is contained to `SKILL.md` plus the one optional ADR-0008 line; the lone Should Fix is a non-blocking wording tightness note.

Invoke `/qa` with plan ID `FEAT-20260722T041913Z-916b` to run the QA suite.
