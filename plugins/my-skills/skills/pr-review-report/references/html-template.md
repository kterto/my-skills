# HTML Artifact Contract

Author ONE self-contained `.html` file. All CSS and JS inline in `<style>` /
`<script>`. **No external references** — no CDN links, fonts, or images by URL.
Must open by double-click, offline.

## Anchor scheme (powers the bidirectional jump)

- Each finding card: `id="finding-<id>"` (e.g. `finding-sec-1`).
- Each annotated diff line: `id="diffline-<file-slug>-<line>"` where `<file-slug>`
  is the file path with `/` and `.` replaced by `-`.
- Each gutter marker stores `data-finding="<id>"`; each finding card stores
  `data-diffline="diffline-<file-slug>-<line>"`. Clicking either scrolls to and
  briefly highlights the other (see JS below).

## Document structure

1. **`<head>`** — `<meta charset>`, `<title>PR Review — <branch></title>`, inline
   `<style>` with the severity color custom properties:
   `--sev-critical:#dc2626; --sev-high:#ea580c; --sev-medium:#ca8a04; --sev-low:#2563eb; --sev-info:#6b7280;`
2. **Summary bar** — branch, base branch, merge-base sha, commit range,
   generated-at; a row of severity count badges and per-section counts.
3. **Controls** — severity multi-toggle, section filter, "collapse/expand all",
   jump-to-file `<select>`.
4. **Three `<section>`s** — Architecture, Security, Bugs & Improvements; each
   collapsible, each lists finding cards.
5. **Finding card** — severity chip (background = matching `--sev-*`), title,
   `file:line` link (`href="#diffline-..."`), rationale, suggested fix. Architecture
   cards add an **ADR** badge with draft title + context when `adr` is present.
6. **Diff viewer** — per-file collapsible blocks. Render added lines on a green
   tint, removed on red. Lines that have a finding get a gutter marker
   (`class="ann" data-finding="..."`) and the `id="diffline-..."`.

## Required JS behaviors (vanilla, inline)

- **Bidirectional jump:** clicking a gutter `.ann` marker → `scrollIntoView` its
  `finding-<data-finding>` and add `.flash` for 1.2s; clicking a finding card's
  `file:line` link → same to its `data-diffline` target.
- **Severity filter:** toggling a severity hides/shows all finding cards AND their
  gutter markers of that severity.
- **Section filter:** show/hide whole sections.
- **Collapse/expand all:** toggle every `<section>` and diff-file block.
- **Jump-to-file:** selecting a file scrolls its diff block into view.

No persisted state — filters reset on reload. Keep total JS small and dependency-free.

## Empty state

If a lens has no findings, still render the section with a "No findings" note so the
report shape is consistent. Render this inside the section body when a lens has zero
findings:

```html
<p class="no-findings">No findings in this lens.</p>
```
