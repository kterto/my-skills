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

## Stdout structured summary (identical in both modes)

The orchestrator parses stdout for control flow, not the artifact file. Every role MUST print the following structured block to stdout regardless of `output_format`:

```
ARTIFACT_SUMMARY
id: <ID>
status: <status>
artifact: <relative path to the written file>
END_ARTIFACT_SUMMARY
```

The on-disk file format changes between `md` and `html`; the stdout summary format never changes.
