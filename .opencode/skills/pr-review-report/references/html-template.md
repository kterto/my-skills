# HTML Artifact Contract

Author one self-contained `.html` file. All CSS and JS must be inline in `<style>` and `<script>`. Do not use external references, CDN links, remote fonts, remote images, or network fetches. The file must open offline by double-clicking.

## Anchor Scheme

- Each finding card: `id="finding-<id>"`, e.g. `finding-sec-1`.
- Each annotated diff line: `id="diffline-<file-slug>-<line>"`, where `<file-slug>` is the file path with `/` and `.` replaced by `-`.
- Each gutter marker stores `data-finding="<id>"`.
- Each finding card stores `data-diffline="diffline-<file-slug>-<line>"`.
- Clicking either side scrolls to and briefly highlights the other side.

## Document Structure

1. `<head>` with `<meta charset>`, `<title>PR Review - <branch></title>`, and inline `<style>`.
2. CSS custom properties for severities: `--sev-critical:#dc2626`, `--sev-high:#ea580c`, `--sev-medium:#ca8a04`, `--sev-low:#2563eb`, `--sev-info:#6b7280`.
3. Summary bar with branch, base branch, merge-base SHA, commit range, generated-at timestamp, severity count badges, and per-section counts.
4. Controls for severity multi-toggle, section filter, collapse/expand all, and jump-to-file.
5. Three collapsible sections: Architecture, Security, Bugs & Improvements.
6. Finding cards with severity chip, title, `file:line` link, rationale, suggested fix, and optional ADR badge/context for architecture findings.
7. Diff viewer with per-file collapsible blocks, added-line green tint, removed-line red tint, and gutter markers for annotated lines.

## Required JS Behaviors

- Bidirectional jump: clicking a gutter marker scrolls to `finding-<data-finding>` and adds `.flash` for 1.2 seconds.
- Finding link jump: clicking a finding card's `file:line` link scrolls to its `data-diffline` target and flashes it.
- Severity filter: toggling a severity hides or shows all finding cards and their gutter markers.
- Section filter: show or hide whole sections.
- Collapse/expand all: toggle every review section and diff-file block.
- Jump-to-file: selecting a file scrolls its diff block into view.

No persisted state. Filters reset on reload. Keep JavaScript small and dependency-free.

## Empty State

If a lens has no findings, still render the section with this shape:

```html
<p class="no-findings">No findings in this lens.</p>
```
