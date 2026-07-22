---
id: CR-20260722T121831Z-3c40
plan: FEAT-20260722T120454Z-f2c0
title: Review of Rejected vs attempted-blocked item state — carry explicit outcome into Step 4
status: APPROVED
created_at: 2026-07-22T12:18:31Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260722T120454Z-f2c0](../feat/FEAT-20260722T120454Z-f2c0-rejected-vs-attempted-item-state.md)

## Summary

Doc-only, single-file change to `plugins/my-skills/skills/validation-fixer/SKILL.md` (+92/−28) that introduces an explicit three-outcome taxonomy (**fixed | rejected | attempted**) at the end of Step 3.4 and keys Step 4 recording on it instead of a bare commit-presence test. Every previously-contradictory recording site — Step 4 shared rule, main-agent lane, batch lane, Step 5, Notes, Edge cases, Step 6 attention list, and the Autonomous two-item lifecycle example — is reconciled onto the one taxonomy: rejected → bare `- [ ]` (checkpoint-only), attempted → `- [~]`. All 8 acceptance criteria are met, no new status token is introduced, backward-compat prose holds, and there is no opencode-port/references/template drift. Verdict: **APPROVED** with one non-blocking readability nit.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Three-outcome taxonomy in Step 3/3.4 with each outcome's recorded state | ✅ | Taxonomy table + prose at SKILL.md:757–775. fixed → `[x]` + `_fixed via …_`; rejected → bare `[ ]` no status line; attempted → `[~]` + `_attempted via … needs attention_`. Exactly the FR1 mapping. |
| 2 | Step 4 keys on explicit outcome (not commit-presence); no-commit branch splits rejected vs attempted | ✅ | SKILL.md:951–975. "Record from the Step-3.4 outcome, not from a commit count." Two distinct branches: rejected → bare `[ ]` (drop prior status line); attempted → `[~]` + status line. |
| 3 | Step 3.4 rejection branch and Step 4 read as one rule | ✅ | Step 3.4 emits explicit `rejected` (SKILL.md:701–704); Step 4 consumes it (SKILL.md:951–958). No contradiction. |
| 4 | Main-agent lane splits rejection → `[ ]` vs error/blocked/no-op → `[~]` | ✅ | SKILL.md:852–857. Defers to the taxonomy; checkpoint rejection → bare `[ ]`, error/blocked/no-op (incl. all autonomous no-commit) → `[~]`. |
| 5 | Batch checkpoint rejection → every member `[ ]`; BLOCKED/errored batch → every member `[~]` | ✅ | SKILL.md:900–910, incl. the collapse-all per-file case. Whole-batch rollback either way; outcome differs by taxonomy. |
| 6 | Notes / Edge cases carry the user-rejection carve-out; Step 5 consistent + cross-referenced | ✅ | Notes SKILL.md:1182–1191, Edge cases 1130–1136 and 1170–1171, Step 5 986–992 (cross-references the same Step-3.4 rejected outcome). |
| 7 | Rejected is checkpoint-mode-only; every autonomous no-commit → attempted `[~]` | ✅ | SKILL.md:771–775 states it explicitly and repeats the qualifier at every reconciled site. |
| 8 | Step-1 parse + Step-6 summary preserved; both `[ ]`/`[~]` OPEN; attention list `[~]`-only; no schema change | ✅ | Step-1 table unchanged (SKILL.md:57–59: both OPEN); attention-list note SKILL.md:1122–1125 excludes rejected `[ ]`; rejected drops the status line so no `_attempted via` metadata dangles (59–61). No new token. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Spec-artifact label "FR1" leaked into the shipped doc

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:855`
**Problem**: The main-agent lane's failure-handling bullet says it "defers to the **FR1** taxonomy for *which* state to record." `FR1` is the source spec's functional-requirement numbering, not a concept defined anywhere in `SKILL.md` — it is the lone occurrence of the token in the whole file. Every other reconciled site refers to the same table as "the taxonomy above", "the Step-3.4 taxonomy", or "Step-3.4 / Step-4 taxonomy", so a reader of the skill hits an undefined cross-reference here. The meaning is inferable from context, so this is a readability/consistency nit, not a correctness defect.
**Fix**: Rename to match the file's own vocabulary, e.g. "defers to the **outcome taxonomy above** for *which* state to record." This aligns the one outlier with the phrasing used at SKILL.md:768, 908, 958, 1136, and 1191.

---

## Verdict

**Status**: APPROVED

All 8 acceptance criteria are met with zero Must Fix items; the taxonomy is internally consistent across every entangled site, backward-compat and the no-new-token invariant hold, and scope stayed to the single file — the lone `FR1` label is a non-blocking readability nit.

Invoke `/qa` with plan ID `FEAT-20260722T120454Z-f2c0` to run the QA suite.
