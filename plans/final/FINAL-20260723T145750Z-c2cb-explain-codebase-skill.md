---
id: FINAL-20260723T145750Z-c2cb
status: READY_TO_COMMIT
plan: FEAT-20260723T141806Z-d784
spec: SPEC-20260723T141537Z-ec9e
created_at: 2026-07-23T14:57:50Z
---

# Final report — explain-codebase skill

New read-only authoring skill `explain-codebase` for the my-skills marketplace
(Claude Code + opencode). Reads a target project's source and produces one
self-contained, CSP-safe interactive HTML report across four lenses — data model,
business logic, data flow, inferred user stories — via a subagent fan-out, every
claim anchored to `file:line`.

## Pipeline outcome

| Stage | Result |
|---|---|
| Brainstormer | SPEC-20260723T141537Z-ec9e — READY_FOR_PLANNING (0 open questions) |
| Architect | FEAT-20260723T141806Z-d784 — 13 tasks, 4 phases |
| Coder | DONE — 0 unchecked boxes |
| Simplify | 3 cleanups applied (token-Set hoist, .sh dedup, unused `Skill` grant dropped) |
| Tester | TEST-20260723T144019Z-0432 — PASS (13/13 node + self-contained sh) |
| Reviewer | CR-20260723T144300Z-c7e2 — APPROVED (0 Must-Fix, 2 Should-Fix) |
| Review-fix | Both Should-Fixes folded into the diff (SF-1 theme, SF-2 provenance) |
| QA | QA-20260723T144808Z-9096 — READY_TO_COMMIT (G8 rework 0.00) |
| Spec eval | EVAL-20260723T145254Z-7db2 — PASS, 0.99 (Spec-complete) |

## Deliverables

- `plugins/my-skills/skills/explain-codebase/SKILL.md` — dual-host body (in-place
  pattern, no `.opencode` override); `allowed-tools` dual-lists every used tool.
- `references/analysis-schema.md` — normative Phase-2 subagent JSON schema.
- `references/report-template.html` — self-contained, CSP-safe, theme-aware
  template; `{{PLACEHOLDER}}` + `<!-- REPEAT:block -->` fill contract.
- `references/report-template.demo.html` — template filled with sample data.
- `references/design-prompt.md` — the Claude-design prompt to regenerate the template.
- `__tests__/` — `analysis-schema.test.cjs`, `placeholder-fill.test.cjs`,
  `self-contained.test.sh`.
- `README.md` skills-table row; regenerated `plugins/my-skills/skills/index.json`.

## Related

- Spec: [SPEC-20260723T141537Z-ec9e](../specs/SPEC-20260723T141537Z-ec9e-explain-codebase-skill.md)
- Plan: [FEAT-20260723T141806Z-d784](../feat/FEAT-20260723T141806Z-d784-explain-codebase-skill.md)
- Test: [TEST-20260723T144019Z-0432](../test/TEST-20260723T144019Z-0432-explain-codebase-skill.md)
- Code review: [CR-20260723T144300Z-c7e2](../code-review/CR-20260723T144300Z-c7e2-explain-codebase-skill.md)
- QA: [QA-20260723T144808Z-9096](../qa/QA-20260723T144808Z-9096-explain-codebase-skill.md)
- Eval: [EVAL-20260723T145254Z-7db2](../eval/EVAL-20260723T145254Z-7db2-explain-codebase-skill.md)

## Known notes (non-blocking)

- **FR13 / `Skill` construct:** the spec enumerated a `Skill`-tool dual-host
  construct, but the skill body invokes no other skill — the unused grant was
  correctly dropped (simplify), so `allowed-tools` omits it by design. Eval scored
  FR13 0.80 to stay literal; treated as N/A in practice.
- **Data-flow diagrams:** the template ships one `DATA_FLOW_MERMAID` block
  (per-use-case sequence diagrams live in the user-stories region). Meets intent;
  the design's "sequence + flow" wording is satisfied across the two regions.
