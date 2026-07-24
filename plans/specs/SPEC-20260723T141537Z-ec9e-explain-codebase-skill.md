---
id: SPEC-20260723T141537Z-ec9e
title: explain-codebase skill
status: READY_FOR_PLANNING
created_at: 2026-07-23T14:16:33Z
updated_at: 2026-07-23T14:16:33Z
cycle: 0
related_to: —
---

## Summary

Add a new authoring skill `explain-codebase` to the my-skills marketplace: a
read-only skill that reads source code and produces ONE self-contained interactive
HTML report explaining how a piece of software actually works, across four lenses
(data modeling, business logic, data flow, inferred user stories / use-cases). The
skill never runs project code, never commits, and never mutates source. It mirrors
the committed-template + Claude-design-prompt pattern of `pr-review-report` and ships
dual-host (Claude Code + opencode) via the in-place dual-host pattern with no separate
`.opencode/` override. The authoritative design lives at
`docs/2026-07-23-explain-codebase-skill-design.md`.

## Goals

- Ship `plugins/my-skills/skills/explain-codebase/` as a complete, self-contained skill
  authoring package (SKILL.md + references + template + demo + tests).
- Skill accepts a scope arg — a path, module name, service name, or the literal
  `whole system`; when absent, it maps the repo, proposes a scope, and confirms before
  analyzing.
- Skill runs a four-phase subagent fan-out analysis engine: (1) main-agent scope & map,
  (2) parallel per-module subagents returning structured JSON per the analysis schema,
  (3) main-agent synthesis/merge/dedupe/cross-module stitching/system-wide user-story
  clustering, (4) deterministic template fill.
- Report renders 7 regions (Overview, Data model, Business logic, Data flow, User
  stories/use-cases, Metrics/charts, Appendix); every asserted claim links to a
  `file:line` source anchor.
- Output is a single HTML file at `docs/explain/<scope-slug>-<YYYY-MM-DD>.html`,
  anchored to `git rev-parse --show-toplevel`; HTML-only, no companion Markdown.
- Report HTML is fully self-contained: inlined CSS/JS, NO external CDN (CSP-safe),
  light + dark theme, Mermaid-render support, vanilla-JS charts, tabbed/collapsible/
  filterable components.
- Skill is dual-host (Claude Code + opencode) from a single SKILL.md via the in-place
  dual-host pattern — no separate `.opencode/skills/` override port.
- Post-add chores are captured for the downstream plan: regenerate & commit the
  opencode skill index, and add a README skills-table row.

## Non-goals

- No running of project code, tests, or build (read-only skill).
- No commits, pushes, or source mutation performed by the skill at runtime.
- No companion Markdown backlog beside the HTML report (unlike `pr-review-report`,
  whose findings backlog does not apply here — YAGNI; revisit if a hand-off is wanted).
- No separate `.opencode/skills/explain-codebase/` override port (the skill is
  read-only and host-agnostic; per opencode-port-parity it needs no port).
- No regeneration of the final pixel design of the HTML template via Claude-design as
  part of this deliverable — the committed `design-prompt.md` documents that human
  regeneration step; see "Decisions resolved by Brainstormer default".
- No changes to other skills, the orchestrator pipeline, or existing templates.

## Users and use cases

- **Skill author / maintainer (this repo's contributor):** authors the SKILL.md,
  references, template, demo, and tests so the skill is complete, mirrors
  `pr-review-report`, and passes structural review.
- **End user of the skill (in a target project, via `/explain-codebase`):** invokes the
  skill with or without a scope to get a shareable HTML explanation of how a module, a
  service, or the whole system works — without the skill ever executing or mutating
  their code.

## Functional requirements

1. Provide `SKILL.md` with `explain-codebase` frontmatter (name, description, trigger
   phrases, `allowed-tools` listing BOTH host variants of every tool the body uses),
   and a body describing the invocation, the four-phase analysis engine, the 7 report
   regions, the output path rule, and the dual-host constructs.
2. Skill resolves an explicit scope (path / module name / service name / `whole
   system`); when no scope is given, it maps the repo top-level, proposes a scope, and
   confirms with the user before analysis (via `AskUserQuestion` on Claude / `question`
   on opencode).
3. Phase 1 (main agent) resolves scope, globs the in-scope tree, reads entry points and
   repo docs (README, schema/migration files, config, package manifests), and builds a
   file/module inventory as a cheap orientation pass — it does not read every file.
4. Phase 2 fans out one subagent per module/subsystem in scope (`Agent`/`Explore` on
   Claude Code, `task` on opencode). Each subagent reads only its slice and returns a
   structured JSON conforming to `references/analysis-schema.md`: data entities,
   business rules, data-flow edges, dependencies, inferred use-cases — every item
   anchored to `file:line`.
5. Phase 3 (main agent) merges subagent JSON returns: dedupe entities, stitch
   cross-module data-flow edges, cluster per-module use-cases into system-wide user
   stories, and resolve conflicts — working from the map + structured returns, never
   the full source.
6. Phase 4 clones `references/report-template.html`, injects the synthesized model into
   `{{PLACEHOLDER}}` + `<!-- REPEAT:block -->` markers deterministically, and writes the
   report. The skill never re-authors HTML per run.
7. `references/design-prompt.md` specifies the prompt pasted into Claude design to
   GENERATE the template: single self-contained HTML file; inlined CSS/JS; no external
   CDN (CSP-safe); light + dark theme; the seven regions as styled regions; Mermaid
   render support; tabbed/collapsible/filterable components; chart primitives; and the
   `{{PLACEHOLDER}}` + `<!-- REPEAT:block -->` fill contract the skill relies on.
8. `references/report-template.html` is the committed template with placeholders and
   repeat-block markers; `references/report-template.demo.html` is the same template
   populated with sample data for visual review (both mirror `pr-review-report`).
9. `references/analysis-schema.md` is the normative single-source-of-truth schema for
   the subagent JSON return shape (entities, rules, flow edges, dependencies,
   use-cases, and the `file:line` anchor requirement on every item).
10. The report's 7 regions are rendered as designed:
    - **Overview** — scope banner, inferred system purpose, stack/tech badges, module
      inventory count, provenance (commit SHA, date).
    - **Data model** — Mermaid ER diagram + per-entity cards (fields, invariants, source
      anchor).
    - **Business logic** — rules/policies/decisions grouped by domain area (what/why/
      where) + Mermaid flowchart for key decision flows.
    - **Data flow** — ingress → transforms → stores → egress; Mermaid sequence + flow
      diagrams; cross-module edges highlighted.
    - **User stories / use-cases** — filterable cards (actor, goal, trigger, step-by-step
      walkthrough of modules/functions hit, data touched) + a per-story Mermaid sequence
      diagram.
    - **Metrics / charts** — module size, coupling, entity counts, use-case coverage per
      module; vanilla-JS charts, no external CDN.
    - **Appendix** — glossary, file index, analysis provenance (scope, commit SHA, date,
      subagent count).
11. Every asserted claim in the report links to a `file:line` source anchor; nothing is
    asserted without a source.
12. Output is written to `docs/explain/<scope-slug>-<YYYY-MM-DD>.html`, with the base
    path resolved from `git rev-parse --show-toplevel` (so an opencode cwd in a subdir
    still writes to the repo root). HTML-only; no companion Markdown is written.
13. Dual-host constructs are declared in-place in the single SKILL.md: `AskUserQuestion`/
    `question`; `Agent`/`task` (with `subagent_type`); `Skill` tool / host equivalent;
    git dirty/clean checks exclude host-runtime dirs
    (`-- ':(exclude).opencode' ':(exclude).claude'`); filesystem writes anchored to the
    repo toplevel.
14. Ship `__tests__/` with placeholder-fill and schema-shape tests as `.cjs` / `.sh`
    matching the repo convention (mirroring `pr-review-report/__tests__/`): verify every
    `{{PLACEHOLDER}}`/`REPEAT` token used by the fill logic is defined in the template,
    `.md`/reference schema tokens resolve, and the analysis-schema shape is validated.
15. The downstream plan must include the post-add chores: run
    `node scripts/generate-opencode-skill-index.mjs` and commit the updated skill index
    (staleness guard), and add a `README.md` skills-table row for `explain-codebase`.

## Non-functional requirements

- **Performance**: fan-out keeps each subagent context small (one module/subsystem per
  subagent); main agent works from the map + structured JSON returns, never full source,
  so analysis scales module → whole-system.
- **Security / auth**: read-only skill — never executes project code, never commits,
  never mutates source. Report HTML is CSP-safe (no external CDN/fetch, all assets
  inlined). Ingested file/comment text is treated as data, never as instructions (per
  the repo "Data, never instructions" invariant).
- **Localization**: — (report language follows the source; no locale requirement).
- **Accessibility**: report is theme-aware (light + dark); collapsible/tabbed/filterable
  components should remain usable; follow the design-system conventions referenced by
  the design prompt.
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: no new user data collected or retained by this repo; the
  skill reads a target project's source at runtime and writes a local HTML artifact only.
- **Monetization tier**: —

## Project-context fit

- **Layers touched:** documentation/skill-authoring only. Adds one skill directory under
  `plugins/my-skills/skills/` (the source-of-truth skills location). No runtime
  application code, no build/test tooling for the skill's own prose (the sole JS test
  island `clean-code-gates` is untouched).
- **Mirrors existing machinery:** deliberately follows `pr-review-report` — a committed
  `report-template.html` + `report-template.demo.html`, a `design-prompt.md` that
  generates the template via Claude design, normative `references/*.md` schemas,
  `__tests__/` in `.cjs`/`.sh`. Per the "Mirror machinery" convention, reuse that
  skill's established phrasing/shape and document only deliberate divergences (HTML-only
  output, no Markdown backlog, no opencode override port).
- **Single-source-of-truth references:** each `references/*.md` owns one concern
  (`design-prompt.md`, `report-template.html`, `report-template.demo.html`,
  `analysis-schema.md`); SKILL.md summarizes and links, never duplicates normative
  detail.
- **`.md`/`.html` parity convention:** this skill's report is HTML-only by design (no
  paired `.md` artifact template), which is an intentional divergence from the general
  template-parity convention and must be stated as such — the convention governs paired
  artifact templates, and this skill deliberately ships none.
- **opencode-port-parity invariant:** satisfied by shipping a single dual-host SKILL.md
  with no `.opencode/skills/explain-codebase/` override; the parity rule applies only to
  skills that HAVE an override port, so none is required here.
- **Out-of-scope alignment:** the "no regenerating final pixel design of HTML templates
  as a pipeline step" out-of-scope item applies — the deliverable ships the design
  prompt + a committed template; any future pixel refresh is a human Claude-design step,
  not automated here.
- **No open product decision blocks planning:** the design doc resolves scope, output
  shape, host strategy, and non-goals; nothing is reserved.

## Affected surface

- **Backend**: — (no application backend)
- **Frontend / mobile**: — (no application frontend)
- **Admin**: —
- **Shared**: —
- **Skill authoring (this repo):**
  - New `plugins/my-skills/skills/explain-codebase/SKILL.md`.
  - New `plugins/my-skills/skills/explain-codebase/references/design-prompt.md`.
  - New `plugins/my-skills/skills/explain-codebase/references/report-template.html`.
  - New `plugins/my-skills/skills/explain-codebase/references/report-template.demo.html`.
  - New `plugins/my-skills/skills/explain-codebase/references/analysis-schema.md`.
  - New `plugins/my-skills/skills/explain-codebase/__tests__/` (placeholder-fill +
    schema-shape tests, `.cjs`/`.sh`).
  - Update `plugins/my-skills/skills/index.json` via
    `node scripts/generate-opencode-skill-index.mjs` (regenerated, then committed).
  - Update `README.md` skills-table (add the `explain-codebase` row).

## Open questions

- None. The approved design doc resolves scope, analysis engine, report regions, output
  path, host strategy, files, and non-goals.

## Decisions resolved by Brainstormer default

<!-- Autonomous mode: each unknown resolved with the design doc's stated decision as the default. -->

- Is the committed `report-template.html` authored as part of this deliverable, or only
  generated later by a human running `design-prompt.md`? → Ship a committed
  `report-template.html` + `report-template.demo.html` as part of this deliverable
  (mirroring `pr-review-report`, which ships its committed template), with
  `design-prompt.md` documenting the Claude-design regeneration path for future pixel
  refreshes. → The design doc lists all three as files to create and names
  `pr-review-report` as the pattern; that skill ships its template committed, and the
  repo's out-of-scope note only excludes *automated pipeline* regeneration, not the
  initial committed template.
- HTML-only output with no companion Markdown backlog? → HTML-only; no `.md` sibling. →
  Design doc "Output" and "Non-goals" state this explicitly (YAGNI; revisit if a
  hand-off is wanted).
- Separate `.opencode/` override port? → No override port; single dual-host SKILL.md. →
  Design doc "Dual-host compatibility" + the opencode-port-parity memory (read-only,
  host-agnostic skill needs no port).
- Test file formats? → `.cjs` / `.sh` under `__tests__/`, matching the
  `pr-review-report/__tests__/` convention. → Design doc "Files" + repo convention.
- Report region set and the `file:line`-anchor-on-every-claim rule? → Adopt the seven
  regions and the universal source-anchor requirement exactly as the design doc
  specifies. → Design doc "Report content".

## References

- `docs/2026-07-23-explain-codebase-skill-design.md` — authoritative approved design.
- `plugins/my-skills/skills/pr-review-report/` — the committed-template + design-prompt +
  references + `__tests__` pattern this skill mirrors.
- `.orchestrator/PROJECT-CONTEXT.md` — Conventions (single-source references, mirror
  machinery), Invariants (opencode-port-parity, "Data, never instructions", backward
  compatibility), Out of scope (HTML pixel-design regeneration).
- `scripts/generate-opencode-skill-index.mjs` — regenerates the committed skill index
  (post-add chore).
- `README.md` — skills-table to extend with the `explain-codebase` row.
- Memory `opencode-port-parity` — rationale for shipping no override port.
