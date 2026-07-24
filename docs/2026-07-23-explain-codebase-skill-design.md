# explain-codebase skill — design

**Status:** approved (brainstorm)
**Date:** 2026-07-23
**Author:** Kainã Terto

## Purpose

A read-only skill that reads and understands a piece of software, then produces a
single self-contained interactive HTML report explaining **how it actually works**.
The report focuses on four lenses — **data modeling, business logic, data flow, and
inferred user stories / use-cases** — and renders them with visually rich components
(Mermaid diagrams, vanilla-JS charts, filterable cards, tabs/collapsibles).

The skill never runs project code, never commits, and never mutates source. It only
reads the tree and writes one HTML artifact.

## Scope of a run

The unit of analysis is a **scope**: a module, a service, or the whole system.

- Explicit scope: a path (`src/billing`), a module/service name, or the literal
  `whole system`.
- No scope: the skill maps the repo top-level, proposes a scope, and confirms with
  the user before analyzing.

## Invocation

```
/explain-codebase <scope>        # scope = path, module name, service name, or "whole system"
/explain-codebase                # no scope → infer, propose, confirm
```

## Analysis engine — subagent fan-out

Four phases:

1. **Scope & map** (main agent). Resolve the scope. Glob the tree in scope. Read
   entry points and repo docs (README, schema/migration files, config, package
   manifests). Build a file/module inventory. This is a cheap orientation pass — the
   main agent does *not* read every file.
2. **Fan-out** (parallel subagents — `Agent`/`Explore` on Claude Code, `task` on
   opencode). One subagent per module/subsystem in scope. Each subagent reads only
   its slice and returns a **structured JSON** conforming to
   `references/analysis-schema.md`: data entities, business rules, data-flow edges,
   dependencies, and inferred use-cases — every item anchored to `file:line`.
3. **Synthesize** (main agent). Merge the subagent JSON returns: dedupe entities,
   stitch cross-module data-flow edges, cluster per-module use-cases into
   system-wide user stories, resolve conflicts. The main agent works from the map +
   the structured returns, never the full source.
4. **Render**. Fill `references/report-template.html` placeholders with the
   synthesized model and write the report.

Rationale: fan-out scales module → whole-system while keeping each context small;
mirrors the existing orchestrator / pr-review-report patterns in this repo.

## Report content

Seven template regions. Every asserted claim links to a `file:line` source anchor;
nothing is asserted without a source.

1. **Overview** — scope banner, inferred system purpose, stack/tech badges, module
   inventory count, provenance (commit SHA, date).
2. **Data model** — entities, fields, relationships. Mermaid ER diagram + per-entity
   cards (fields, invariants, source anchor).
3. **Business logic** — rules / policies / decisions, grouped by domain area. Each
   rule states what / why / where. Mermaid flowchart for key decision flows.
4. **Data flow** — ingress → transforms → stores → egress. Mermaid sequence + flow
   diagrams. Cross-module edges highlighted.
5. **User stories / use-cases** — inferred from scope. Each a filterable card:
   actor, goal, trigger, step-by-step walkthrough (modules/functions each step
   hits), data touched, and a per-story Mermaid sequence diagram.
6. **Metrics / charts** — module size, coupling, entity counts, use-case coverage
   per module. Vanilla-JS charts, no external CDN.
7. **Appendix** — glossary, file index, analysis provenance (scope, commit SHA,
   date, subagent count).

## HTML template & Claude-design prompt

Template pattern mirrors `pr-review-report` — a committed template the skill fills
deterministically, so run-to-run design variance is eliminated.

- `references/design-prompt.md` — the prompt pasted into Claude design. Specifies a
  single self-contained HTML file; inlined CSS/JS; **no external CDN (CSP-safe)**;
  light + dark theme; the seven sections above as styled regions; Mermaid-render
  support; tabbed / collapsible / filterable components; chart primitives; and the
  `{{PLACEHOLDER}}` + `<!-- REPEAT:block -->` contract the skill fills. Its output is
  saved as `references/report-template.html`.
- `references/report-template.html` — committed rendered template with placeholders
  and repeat-block markers. The skill clones it, injects the synthesized data, and
  writes the report. It never re-authors HTML per run.
- `references/report-template.demo.html` — the template populated with sample data,
  for visual review (mirrors pr-review-report).

## Output

- Path: `docs/explain/<scope-slug>-<YYYY-MM-DD>.html`, anchored to
  `git rev-parse --show-toplevel`.
- HTML-only. No companion Markdown (YAGNI; revisit if a backlog hand-off is wanted).

## Dual-host compatibility

In-place dual-host pattern — **no separate `.opencode/` override**. Per the
opencode-port-parity memory, a read-only, host-agnostic skill needs no port; a single
`SKILL.md` serves both hosts by dual-referencing host constructs:

- Structured questions: `AskUserQuestion` (Claude) / `question` (opencode).
- Subagents: `Agent` (Claude) / `task` (opencode) with `subagent_type`.
- Skill invocation: `Skill` tool (Claude) / host equivalent.
- `allowed-tools` frontmatter lists both host variants of every tool the body uses.
- Git dirty/clean checks exclude host-runtime dirs:
  `-- ':(exclude).opencode' ':(exclude).claude'`.
- Filesystem writes anchored to `git rev-parse --show-toplevel` (opencode cwd may be
  a subdir).

## Files

Under `plugins/my-skills/skills/explain-codebase/`:

- `SKILL.md`
- `references/design-prompt.md`
- `references/report-template.html`
- `references/report-template.demo.html`
- `references/analysis-schema.md`
- `__tests__/` — placeholder-fill + schema-shape tests (`.cjs` / `.sh`, matching
  repo convention).

Post-add chores:

- Run `node scripts/generate-opencode-skill-index.mjs` and commit the updated
  `plugins/my-skills/skills/index.json` (staleness guard).
- Add a `README.md` skills-table row.

## Non-goals

- No running of project code, tests, or build.
- No commits, pushes, or source mutation.
- No companion Markdown backlog (unlike pr-review-report).
- No separate opencode port.
