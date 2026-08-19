<!-- backlog-schema: v1 -->
<!-- backlog-branch: fix/2026-08-14-nested-gate-cost-model -->
# PR Review Findings — fix/2026-08-14-nested-gate-cost-model  (base main@a0ed81d, 2026-08-15)

/validation-fixer docs/reviews/fix-2026-08-14-nested-gate-cost-model-4eacadf8061f3fdfa5e12c6d0930b3f-2026-08-15.md  ·  framework: orchestrator

Counts: crit 0 · high 1 · med 1 · low 0 · info 0 · acknowledged 0

## Architecture

## Security

## Bugs & Improvements

- [x] [bug-5|high] Marginal gain formula drops serialized integration work (plugins/my-skills/skills/orchestrator/references/config.md:223)
  _fixed via main-agent · 00bf8fb · 2026-08-15_
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/references/config.md|marginal-gain-formula-drops-serialized-integration-work
  Rationale: The new span(L) definition correctly adds the integration sub-lane after concurrent work, but the formal after-split equation still uses only largest_sublane_of_L. With a {5,5}+6 split and another lane at 10, the real run span is max(10,11)=11 while this equation yields 10, overstating g and potentially adopting a split that does not clear its true cost.
  Fix: Replace largest_sublane_of_L with the post-split span(L), including integration, so the equation is max(second_largest_span, span(L after split)); update the Step 2p output to distinguish the lane span from the resulting run-level span_max.

- [x] [bug-1|high] Ask mode still requires the flat split to pass (plugins/my-skills/skills/orchestrator/SKILL.md:650)
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/SKILL.md|ask-mode-still-requires-the-flat-split-to-pass
  _resolved: fix verified_

- [x] [bug-3|high] Printed candidate cost uses total plan overhead (plugins/my-skills/skills/orchestrator/SKILL.md:527)
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/SKILL.md|printed-candidate-cost-uses-total-plan-overhead
  _resolved: fix verified_

- [x] [bug-6|med] Aggregate guard ignores the interface point conversion (plugins/my-skills/skills/orchestrator/references/config.md:361)
  _fixed via main-agent · 6f657d3 · 2026-08-15_
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/references/config.md|aggregate-guard-ignores-the-interface-point-conversion
  Rationale: The unit table prices each interface point at 0.25 task-equivalents, but this guard compares the raw row count I directly with T tasks and the emitted reason calls that contract cost. For T=10 and I=11, interface cost is only 2.75 task-equivalents, yet the guard rejects a plan even after g>c passed.
  Fix: If this is a cost backstop, compare I×0.25 with T, equivalently I>4T. If I>T is intentionally a separate variance heuristic, define it as dimensionless risk and change the reason and ADR rationale so it no longer claims interface cost exceeds the run's work.

- [x] [bug-2|med] Nested evaluation still mandates the flat baseline (plugins/my-skills/skills/orchestrator/SKILL.md:516)
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/SKILL.md|nested-evaluation-still-mandates-the-flat-baseline
  _resolved: fix verified_

- [x] [bug-4|low] README still documents the removed minimum slice guard (README.md:77)
  fingerprint: bugs|README.md|readme-still-documents-the-removed-minimum-slice-guard
  _resolved: fix verified_

