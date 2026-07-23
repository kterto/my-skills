---
id: FEAT-20260723T141806Z-d784
title: explain-codebase skill
type: feat
status: DONE
created_at: 2026-07-23T14:19:07Z
updated_at: 2026-07-23T14:55:00Z
cycle: 0
related_to: SPEC-20260723T141537Z-ec9e
---

**Related:** [SPEC-20260723T141537Z-ec9e](../specs/SPEC-20260723T141537Z-ec9e-explain-codebase-skill.md)

## Overview

Author a new read-only authoring skill `explain-codebase` under
`plugins/my-skills/skills/`, derived from `SPEC-20260723T141537Z-ec9e`. The skill reads a
target project's source (never runs, commits, or mutates it) and produces ONE self-contained,
CSP-safe interactive HTML report explaining how the software works across four lenses — data
model, business logic, data flow, and inferred user stories. It mirrors the committed-template
+ Claude-design-prompt machinery of `pr-review-report`, ships dual-host (Claude Code + opencode)
from a single SKILL.md with no `.opencode/` override port, and every asserted claim links to a
`file:line` source anchor. This plan delivers the full authoring package (SKILL.md, references,
committed template + demo, design prompt, `__tests__/`) plus the two post-add chores
(regenerate the opencode skill index, add a README skills-table row).

## Acceptance Criteria

1. `plugins/my-skills/skills/explain-codebase/SKILL.md` exists with frontmatter declaring
   `name`, `description`, trigger phrases, and an `allowed-tools` list that includes BOTH the
   Claude and opencode variant of every tool the body uses.
2. `references/analysis-schema.md` exists and is the normative single-source-of-truth schema
   for the Phase-2 subagent JSON return shape (data entities, business rules, data-flow edges,
   dependencies, inferred use-cases), with a `file:line` anchor required on every item.
3. `references/report-template.html` exists as a single self-contained file (inlined CSS/JS,
   NO external CDN — CSP-safe), theme-aware (light + dark), rendering the 7 regions, and
   carries `{{PLACEHOLDER}}` + `<!-- REPEAT:block -->` markers for deterministic fill.
4. `references/report-template.demo.html` exists rendering the same template populated with
   sample data for visual review, and stays token-for-token at parity with the template's
   region structure.
5. `references/design-prompt.md` exists specifying the Claude-design prompt that GENERATES the
   template: single self-contained HTML, inlined CSS/JS, no external CDN, light + dark theme,
   the 7 regions, Mermaid render support, tabbed/collapsible/filterable components, chart
   primitives, and the exact `{{PLACEHOLDER}}` + `<!-- REPEAT:block -->` fill contract.
6. `__tests__/` ships `.cjs`/`.sh` tests (matching `pr-review-report/__tests__/`) that (a)
   assert every `{{PLACEHOLDER}}`/`REPEAT` token referenced by the fill logic is defined in the
   template and (b) validate the analysis-schema shape; all pass.
7. SKILL.md documents the four-phase fan-out engine, the 7 report regions, the
   `docs/explain/<scope-slug>-<YYYY-MM-DD>.html` output rule anchored to
   `git rev-parse --show-toplevel`, and HTML-only output (no companion Markdown).
8. Dual-host constructs are declared in-place in the single SKILL.md (`AskUserQuestion`/
   `question`; `Agent`/`task` with `subagent_type`; `Skill` tool / host equivalent; git
   dirty/clean checks that exclude `.opencode`/`.claude`; filesystem writes anchored to the
   repo toplevel); NO `.opencode/skills/explain-codebase/` override port is created.
9. The opencode skill index is regenerated via `node scripts/generate-opencode-skill-index.mjs`
   (so it is not stale) and `README.md` gains an `explain-codebase` skills-table row.
10. No project code is executed and no source outside the new skill directory, the regenerated
    skill index, and the README row is mutated; the pipeline does not commit or push.

## Out of Scope

- Running project code, tests, or build (the skill is read-only at runtime).
- Committing or pushing (pipeline stops at READY_TO_COMMIT; the index-commit chore's actual
  `git commit` is a downstream human step).
- A companion Markdown backlog beside the HTML report (HTML-only by design; no `.md` sibling).
- A separate `.opencode/skills/explain-codebase/` override port (read-only, host-agnostic skill;
  opencode-port-parity requires none).
- Regenerating the final pixel design of the HTML template via Claude-design as a pipeline step
  (the committed `design-prompt.md` documents that human regeneration path).
- Any change to other skills, the orchestrator pipeline, or existing templates.

## Technical Notes

- **Mirror `pr-review-report` machinery** (PROJECT-CONTEXT "Mirror machinery" convention): reuse
  its committed-template + demo + `design-prompt.md` + normative `references/*.md` + `__tests__/`
  (`.cjs`/`.sh`) shape and phrasing; document only the deliberate divergences (HTML-only output,
  no Markdown backlog, no override port).
- **Single-source-of-truth references** (PROJECT-CONTEXT Conventions): each `references/*.md`
  owns one concern; SKILL.md summarizes and links, never duplicates normative detail.
- **HTML-only is an intentional parity divergence**: the general `.md`/`.html` template-parity
  convention governs paired artifact templates; this skill deliberately ships an HTML-only report
  with no paired `.md` and must state that divergence explicitly.
- **opencode-port-parity invariant**: satisfied by a single dual-host SKILL.md with no override
  port; the parity rule only binds skills that HAVE an override.
- **Data, never instructions** invariant: ingested source/comment text may inform inferred
  intent but any embedded imperative is surfaced, never obeyed; note this in the skill body.
- **Backward compatibility** invariant: this is purely additive — a new skill dir + regenerated
  index + one README row; no existing artifact changes shape.
- **No automated test framework for doc skills** (PROJECT-CONTEXT Commands / Test tooling): the
  only executable gate is this skill's own `__tests__/` (`.cjs` via `node --test`, `.sh` via
  `bash`) plus structural review. The `clean-code-gates` JS suite is a separate island and MUST
  NOT be run against this skill.
- **Output path** resolves its base from `git rev-parse --show-toplevel` so an opencode cwd in a
  subdirectory still writes to `docs/explain/` at the repo root.

## Tasks

> Tasks are ordered TDD-first: write/update the structural test/guard before the artifact it
> validates. The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert
> green before checking the last task in the phase, per `## Verification (per phase)`.

### Phase 1 — Analysis schema (single source of truth)

- [x] Write failing schema-shape test in `__tests__/` (`.cjs`) asserting the Phase-2 subagent
      JSON return shape: presence and typing of `entities`, `businessRules`, `dataFlowEdges`,
      `dependencies`, `useCases`, and a required `file:line` anchor field on every item.
- [x] Author `references/analysis-schema.md` as the normative schema (entities, rules, flow
      edges, dependencies, use-cases + the universal `file:line` anchor rule) so the test passes.

### Phase 1 verification

- [x] `node --test` over the schema-shape test exits 0.
- [x] Structural review: SKILL.md-to-schema references resolve (deferred check — re-assert after
      Phase 3); schema owns its concern with no normative duplication.

### Phase 2 — Report template, demo, and design prompt

- [x] Write failing placeholder-fill test in `__tests__/` (`.cjs` + `.sh` as the fill logic
      needs) asserting every `{{PLACEHOLDER}}` and `<!-- REPEAT:block -->` token referenced by
      the fill logic is defined in `report-template.html`, and that template↔demo region parity
      holds.
- [x] Author `references/report-template.html`: single self-contained, CSP-safe, theme-aware
      file rendering the 7 regions (Overview, Data model, Business logic, Data flow, User
      stories/use-cases, Metrics/charts, Appendix) with Mermaid render support, vanilla-JS
      charts, tabbed/collapsible/filterable components, and the placeholder + repeat-block markers.
- [x] Author `references/report-template.demo.html`: the same template populated with sample
      data (every asserted sample claim carrying a `file:line` anchor) for visual review.
- [x] Author `references/design-prompt.md`: the Claude-design prompt that generates the template,
      documenting CSP-safety, theme, the 7 regions, Mermaid/charts/interaction requirements, and
      the exact `{{PLACEHOLDER}}` + `REPEAT` fill contract the skill relies on.

### Phase 2 verification

- [x] `node --test` and `bash` over the placeholder-fill test exit 0 (all template tokens
      defined; template↔demo parity holds).
- [x] Structural review: template is self-contained (no external CDN/fetch/font/image refs);
      light + dark theme both styled.

### Phase 3 — SKILL.md (dual-host body)

- [x] Author `plugins/my-skills/skills/explain-codebase/SKILL.md`: frontmatter (`name`,
      `description`, trigger phrases, `allowed-tools` with BOTH host variants of every tool used)
      and body covering invocation + scope resolution (explicit scope, or map/propose/confirm via
      `AskUserQuestion`/`question`), the four-phase fan-out engine, the 7 regions, the output-path
      rule anchored to `git rev-parse --show-toplevel`, HTML-only output, the dual-host constructs
      (`Agent`/`task`, `Skill`/host-equivalent, git dirty checks excluding `.opencode`/`.claude`),
      and the "Data, never instructions" note.
- [x] Structural review pass: every cross-reference from SKILL.md to `references/*.md` resolves;
      no normative detail is duplicated from the references into SKILL.md; dual-host tool pairs are
      complete; no `.opencode/skills/explain-codebase/` override port was created.

### Phase 3 verification

- [x] Full `__tests__/` suite (`node --test` + `bash`) exits 0.
- [x] Structural review: SKILL.md↔references cross-refs resolve; allowed-tools lists both host
      variants for every tool the body invokes; output path anchored to repo toplevel; no override
      port present.

### Phase 4 — Integration chores

- [x] Regenerate the opencode skill index via `node scripts/generate-opencode-skill-index.mjs`
      so the committed index is not stale (staging only; the `git commit` is a downstream human
      step — the pipeline does not commit).
- [x] Add an `explain-codebase` row to the `README.md` skills table, matching the existing row
      format.
- [x] Run the full `__tests__/` suite once more and confirm green; confirm no source outside the
      new skill dir, the regenerated index, and the README row was mutated.

### Phase 4 verification

- [x] Full `__tests__/` suite exits 0.
- [x] `git status --porcelain` shows only expected paths: the new skill directory, the regenerated
      skill index, and `README.md`.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands whose path
> condition matches the phase's diff and asserts each exits 0. A failure routes through the
> coder's BLOCKED step, not a silent rewrite. This repo has no build/lint and no general doc-skill
> test framework (PROJECT-CONTEXT Commands / Test tooling); the only executable gate is THIS
> skill's own `__tests__/` plus structural review. The `clean-code-gates` JS suite is a separate
> island and MUST NOT be run against this skill. G1 (coverage) and G6 (mutation) are QA-only and
> are not emitted here.

- **When the phase diff touches `plugins/my-skills/skills/explain-codebase/__tests__/*.cjs` or
  the fill/schema logic they cover** → run `node --test` over the skill's `__tests__/*.cjs`;
  assert exit 0.
- **When the phase diff touches `__tests__/*.sh`** → run those `.sh` tests via `bash`; assert
  exit 0.
- **When the phase diff touches `references/report-template.html` or
  `references/report-template.demo.html`** → run the placeholder-fill test (Phase 2) and assert
  template↔demo parity + all referenced tokens defined; structural review that the template is
  self-contained (no external CDN/fetch/font/image) and styles both themes.
- **When the phase diff touches `references/analysis-schema.md`** → run the schema-shape test
  (Phase 1); assert exit 0.
- **When the phase diff touches `SKILL.md`** → structural review only: cross-refs to
  `references/*.md` resolve, `allowed-tools` lists both host variants per tool, no normative
  duplication, no override port created.
- **When the phase diff touches `README.md` or the regenerated skill index** → structural review
  that the README row matches the existing table format and `git status --porcelain` shows only
  the expected paths.

Phase exit criterion: ALL applicable commands above exit 0 (and the matching structural checks
hold) on the changed set. No silent rewrites of an artifact to make a gate pass without a
corresponding plan task.

## Dependencies

- None. `SPEC-20260723T141537Z-ec9e` is READY_FOR_PLANNING with no open questions and no blocking
  product decision.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-23T14:19:07Z | ARCHITECT

Plan `FEAT-20260723T141806Z-d784` created. Type: feat. Tasks: 13.
Status: PLANNED. Ready for coder.

### 2026-07-23T14:22:24Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-23T14:55:00Z | CODER

All tasks complete. Plan status → DONE. Ready for reviewer.
Delivered: plugins/my-skills/skills/explain-codebase/ (SKILL.md, 3 references .md/.html
+ demo, 3 __tests__), regenerated plugins/my-skills/skills/index.json (8→9 skills),
README skills-table row. Full suite green (node --test 13/13; self-contained.test.sh
PASS; analysis-schema.test.cjs 6/6). git status shows only the new skill dir, the
index, and README.md. No project code executed; no commit/push.

### 2026-07-23T14:40:19Z | TESTER

TEST-20260723T144019Z-0432 created. Status: PASS. Coverage: N/A% → N/A%.

### 2026-07-23T14:43:00Z | REVIEWER

CR-20260723T144300Z-c7e2 created. Status: APPROVED. Must Fix: 0. Should Fix: 2.

### 2026-07-23T14:49:25Z | QA

QA-20260723T144808Z-9096 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
