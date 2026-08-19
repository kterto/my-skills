<!-- backlog-schema: v1 -->
<!-- backlog-branch: fix/2026-08-14-nested-gate-cost-model -->
# PR Review Findings — fix/2026-08-14-nested-gate-cost-model  (base main@a0ed81d, 2026-08-14)

/validation-fixer docs/reviews/fix-2026-08-14-nested-gate-cost-model-4eacadf8061f3fdfa5e12c6d0930b3f-2026-08-14.md  ·  framework: orchestrator

Counts: crit 0 · high 2 · med 1 · low 1 · info 0 · acknowledged 0

## Architecture

## Security

## Bugs & Improvements

- [x] [bug-1|high] Ask mode still requires the flat split to pass (plugins/my-skills/skills/orchestrator/SKILL.md:650)
  _fixed via main-agent · a2cdcf1 · 2026-08-14_
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/SKILL.md|ask-mode-still-requires-the-flat-split-to-pass
  Rationale: The new flow explicitly supports a non-viable flat verdict followed by a viable nested option, but the ladder still runs only when Step 2p.3 found the split viable. For the single-lane case this branch is meant to unlock, ask mode therefore skips the off-versus-full question before the new option-omission logic can run.
  Fix: Gate the ladder only on conditions 3-6 not terminating the run and on Step 2p.3n completing; allow condition 1 or 2 to leave a non-viable flat verdict while still offering a viable full option.

- [x] [bug-3|high] Printed candidate cost uses total plan overhead (plugins/my-skills/skills/orchestrator/SKILL.md:527)
  _fixed via main-agent · c1835c6 · 2026-08-14_
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/SKILL.md|printed-candidate-cost-uses-total-plan-overhead
  Rationale: The displayed c formula always includes both architect passes, every inner join, the outer join, and aggregate interfaces, then immediately uses that c for the adopted/rejected predicate. On a viable flat baseline the first candidate's marginal cost is only A + J + its sub-contract interfaces; the documented 12/6 example should use c=4, while this formula yields 8 and rejects a valid split.
  Fix: Separate whole-plan M_nested overhead from per-candidate marginal c. Print candidate-specific terms: A + J + sub-contract interfaces for the first flat-baseline adoption, J + interfaces thereafter, and the full nested overhead only for the first sequential-baseline adoption.

- [x] [bug-2|med] Nested evaluation still mandates the flat baseline (plugins/my-skills/skills/orchestrator/SKILL.md:516)
  _fixed via main-agent · f9b9cde · 2026-08-14_
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/SKILL.md|nested-evaluation-still-mandates-the-flat-baseline
  Rationale: This instruction still says every full run is priced against lanes and never sequential, directly contradicting the newly added sequential baseline for a non-viable flat verdict. An executor following the skill text can reproduce the underpriced model ADR-0012 is intended to fix despite the later reference text.
  Fix: Rewrite this paragraph to cover full and speculative ask evaluations and select M_flat only for a viable flat verdict, otherwise M_seq; remove the unconditional warning against the sequential baseline.

- [x] [bug-4|low] README still documents the removed minimum slice guard (README.md:77)
  _fixed via main-agent · b2f029f · 2026-08-14_
  fingerprint: bugs|README.md|readme-still-documents-the-removed-minimum-slice-guard
  Rationale: The summary says contract cost is compared with the smallest slice, while this branch changes condition 4 to compare interface-point count with total run tasks T. Users reading the overview receive the exact superseded rule ADR-0012 removes.
  Fix: Replace contract cost vs the smallest slice with interface-point count vs the run's total task count T.

