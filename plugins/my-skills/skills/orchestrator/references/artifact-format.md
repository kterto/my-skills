# Orchestrator — Artifact Format Reference

All six role templates (brainstormer, architect, coder, tester, reviewer, qa) write artifacts in one of two formats controlled by `output_format`. This document is the single source of truth — role templates reference it instead of duplicating emission rules.

## md mode (default)

- Filename: `<ID>-<slug>.md` (e.g. `B1-brainstorm-ideas.md`)
- Structure: YAML frontmatter block followed by a markdown body.

Frontmatter fields:

```yaml
---
id: <ID>
status: <status>          # e.g. DRAFT | READY | APPROVED | BLOCKED
created_at: <ISO-8601>
updated_at: <ISO-8601>
cycle: <integer>          # review or qa cycle number (0-based)
---
```

Body: free-form markdown with headings, lists, and fenced code blocks as appropriate for the role.

## html mode

- Filename: `<ID>-<slug>.html` (e.g. `B1-brainstorm-ideas.html`)
- One self-contained file — no external assets, no CDN links.
- The root element is `<main>` with `data-*` attributes mirroring the md frontmatter:

```html
<main
  data-id="<ID>"
  data-status="<status>"
  data-created-at="<ISO-8601>"
  data-updated-at="<ISO-8601>"
  data-cycle="<integer>"
>
```

- Sections are wrapped in `<details><summary>Section Title</summary>…</details>` to make them collapsible.
- Task lists rendered as `<input type="checkbox" disabled>` checkboxes.
- Cycle counters displayed as inline `<span class="badge">cycle N</span>` badges; style the badge inline (no external CSS).

**Styled templates.** In `html` mode, each role fills the matching self-contained scaffold in `templates/html/<artifact>.template.html` (spec, plan, test-report, code-review, qa-report, final-report). These define the Editorial Design System v1 look and the required `<main data-*>` shell; roles replace the sample content with the real artifact content, preserving the `data-*` attributes, `<details><summary>` sections, disabled checkboxes, and the `<span class="badge">cycle N</span>` badge. `progress-timeline.template.html` is wired: in `html` mode the orchestrator renders `<plan-path-without-.md>.progress.html` from a plan's `.progress.md` append-log at each pipeline terminal state. `.progress.md` remains the markdown source-of-truth log (roles append to it); the html file is a regenerated read-only view.

## Related navigation (md + html)

Each artifact carries a **Related** region linking to the artifact(s) it derives from, using **relative** paths across the `plans/<dir>/` tree (`plans/specs/`, `plans/feat/`, `plans/test/`, `plans/code-review/`, `plans/qa/`). `<ext>` = `md` or `html` per `output_format`.

Edges (each role fills the links it knows the paths of; omit a link when that artifact was not produced):

| Artifact | Related links |
|---|---|
| spec | none |
| plan (FEAT/FIX/QAF) | source spec (and source CR/QA for fix/qa plans) |
| test report | the plan |
| code-review | the plan |
| qa report | the plan |
| final report | spec, plan, test, code-review, qa |

Compute the relative href from the artifact's own dir to the target's dir, e.g. a CR at `plans/code-review/CR-005-x.<ext>` links to its plan at `../feat/FEAT-003-y.<ext>`. In html the region is `<nav class="related">…<a href="…">ID</a>…</nav>`; in md a `**Related:** [ID](path) · …` line.

## Stdout header-line contract (identical in both modes)

The orchestrator parses stdout for control flow, not the artifact file. Each role prints a fixed set of header lines; these lines are the same regardless of `output_format` (only the on-disk artifact file changes between `md` and `html`).

Required header lines per role:

| Role         | ID header line                              | Status line                                                   | Path line           |
| ------------ | ------------------------------------------- | ------------------------------------------------------------- | ------------------- |
| brainstormer | `BRAINSTORMER — SPEC-{NNN} created`         | `Status: READY_FOR_PLANNING \| DRAFT`                         | `Spec: {path}`      |
| architect    | `ARCHITECT — {ID} created`                  | —                                                             | `Plan: {path}`      |
| coder        | `CODER — {PLAN-ID} session complete`        | `Status: IN_PROGRESS \| DONE \| BLOCKED`                      | —                   |
| tester       | `TESTER — TEST-{NNN} created`               | `Status: PASS \| BELOW_FLOOR \| BLOCKED`                      | `Report: {path}`    |
| reviewer     | `REVIEWER — CR-{NNN} created`               | `Status: APPROVED \| REQUEST_CHANGES`                         | `CR file: {path}`   |
| qa           | `QA — QA-{NNN} created`                    | `Status: READY_TO_COMMIT \| BLOCKED \| READY_WITH_WARNINGS`   | `Report: {path}`    |

Roles that have a path line also print it immediately after the Status line (or after the ID line for architect, which has no Status line). Additional informational lines (e.g. `Coverage:`, `Next:`) may follow but are not parsed by the orchestrator for control flow.
