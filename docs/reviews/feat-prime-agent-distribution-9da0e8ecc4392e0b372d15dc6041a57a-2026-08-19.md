<!-- backlog-schema: v1 -->
<!-- backlog-branch: feat/prime-agent-distribution -->
# PR Review Findings - feat/prime-agent-distribution  (base main@a0ed81d, 2026-08-19)

/validation-fixer docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-19.md  ·  framework: orchestrator

Counts: crit 0 · high 1 · med 0 · low 0 · info 0 · acknowledged 0

## Architecture

- [ ] [arch-1|high] Flat cost model omits the top-level integration lane (plugins/my-skills/skills/orchestrator/references/config.md:228)
  fingerprint: architecture|plugins/my-skills/skills/orchestrator/references/config.md|flat-cost-model-omits-toplevel-integration-lane
  Rationale: `M_flat` is defined as `max` over lanes of `tasks(L)` plus `A + J +` interface points, and `span_base` for a viable flat verdict as `max` over lanes of `tasks(L)`. Neither adds the top-level integration lane, which `SKILL.md`:1024 dispatches "through a single sequential coder invocation — after all other lanes are DONE, never concurrently with them". The outer model therefore prices a serial lane inside a `max` over concurrent lanes — the exact error ADR-0012 corrected one level down for the integration sub-lane, and the same direction: optimistic. The `Estimated speedup: {T} / {largest lane tasks}` line of the Step 2p.2 flat print block (`SKILL.md`:502) carries the same omission, so the `lanes` figure quoted at the `ask` ladder is understated by `tasks(integration)`. The contradiction is already visible in the source: `SKILL.md`:466 tells the slicing analysis to minimize integration-slice size because `references/config.md` → *The makespan model* "prices as serial" work that cannot be assigned to one slice — a pricing that exists for sub-lanes and does not exist for lanes. arch-1 of the 2026-08-18 backlog is explicitly scoped to the nested sub-lane split and does not reach this; the parent `PACT` has declared an integration-lane region since before that change (`SKILL.md`:814), so the defect predates it.
  Fix: Require the top-level split to declare an `integration` field with the same strict shape and reject-on-omission rule the sub-lane split now uses (`SKILL.md` Step 2p.1), then add `tasks(integration)` to `M_flat` and to the viable-flat `span_base` in `references/config.md` → *The makespan model*, and to the Step 2p.2 flat print block. Exclude the lane from the two work-concentration conditions exactly as the sub-lane integration slice is excluded, and re-verify the worked examples.
  ADR: Price the top-level integration lane as serial in the flat makespan
