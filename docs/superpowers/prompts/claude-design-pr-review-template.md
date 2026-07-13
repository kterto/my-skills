# Claude Design prompt — pr-review-report HTML template

Paste everything under the line into Claude Design. Optionally attach
`docs/reviews/_sample-report.html` as a visual reference. It returns one
self-contained `.html` file — save it to
`plugins/my-skills/skills/pr-review-report/references/report-template.html`.

The one thing that MUST survive verbatim: the seam
`<script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>`.
The skill replaces that full seam element with the same element wrapping a JSON
blob at generation time; every other part of the page renders from that blob.

---

## Task

Design ONE self-contained, offline HTML **template** for an interactive
**pull-request code-review report**. This is a reusable template: it must render
a complete, polished report purely from a single JSON data blob it reads at load
time — it will NOT be hand-edited per report. Ship a great empty/loaded state and
all the interactive behavior; a program fills in the data.

## Hard constraints (non-negotiable)

1. **Fully self-contained and offline.** All CSS and JS inline in `<style>` /
   `<script>`. NO remotely-loaded resources — no CDN scripts, no external
   stylesheets, no web fonts, no `src="http…"` images, no `<link href="http…">`.
   The file must open by double-click with no network. (Outbound `<a href>` text
   links to docs/issue-trackers inside finding text are fine — they navigate,
   they don't load.)
2. **One data seam, exactly as written:**
   ```html
   <script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>
   ```
   On load, the page's JS parses this element's text as JSON and renders the
   whole report from it. So the template must ship with graceful behavior when
   the blob is the literal placeholder (show an empty shell), and full rendering
   when it is real JSON.
3. **Severity color tokens** as CSS custom properties, used everywhere severity
   is shown (chips, gutter markers, count badges):
   ```
   --sev-critical:#dc2626;  /* red    */
   --sev-high:    #ea580c;  /* orange */
   --sev-medium:  #ca8a04;  /* yellow */
   --sev-low:     #2563eb;  /* blue   */
   --sev-info:    #6b7280;  /* gray   */
   ```
4. **Vanilla JS only.** No frameworks, no build step, dependency-free. No
   persisted state — filters reset on reload.
5. **Light + dark aware.** Support `prefers-color-scheme`; keep the severity hues
   legible on both. A manual light/dark toggle in the controls is a plus.

## Data contract (the JSON the seam receives)

Design the render logic against exactly this shape:

```jsonc
{
  "meta": {
    "branch": "feat/x", "base": "main", "mergeBase": "ab12cd3",
    "commitRange": "ab12cd3..HEAD", "generatedAt": "2026-07-13",
    "commitCount": 7, "filesChanged": 12
  },
  "counts": { "critical": 0, "high": 2, "medium": 3, "low": 1, "info": 4,
              "acknowledged": 3 },
  "findings": [
    {
      "id": "sec-1",              // stable slug; drives anchors
      "severity": "high",         // critical | high | medium | low | info
      "section": "security",      // architecture | security | bugs
      "title": "One-line title",
      "file": "src/a.ts",
      "line": 42,                 // line on the new side of the diff
      "rationale": "Why it matters.",
      "fix": "Concrete suggested change.",
      "adr": { "title": "Draft ADR title", "context": "1–2 sentences." },
                                  // architecture findings only; may be absent
      "acknowledged": false,      // true → render in the Acknowledged group, not counted
      "memoryRef": null           // e.g. "MEM-1" when acknowledged; show as a small tag
    }
  ],
  "files": [
    {
      "path": "src/a.ts",
      "slug": "src-a-ts",         // path with / and . replaced by -
      "lines": [
        { "n": 41, "side": "new", "kind": "context", "text": "…", "findingId": null },
        { "n": 42, "side": "new", "kind": "add",     "text": "…", "findingId": "sec-1" },
        { "n": 40, "side": "old", "kind": "del",     "text": "…", "findingId": null }
      ]
    }
  ]
}
```

- `kind`: `add` (green tint), `del` (red tint), `context` (neutral).
- A diff line with a non-null `findingId` is annotated (gutter marker + anchor).

## Page structure

1. **`<head>`** — `<meta charset>`, responsive `<meta viewport>`,
   `<title>PR Review — <branch></title>` (set the branch from `meta.branch` at
   render; a sensible default title in the raw template is fine).
2. **Summary bar** — branch, base branch, merge-base sha, commit range,
   generated-at, commit count, files changed. A row of **severity count badges**
   (each tinted by its `--sev-*` token) plus per-section counts and an
   **acknowledged** count.
3. **Controls** — severity multi-toggle (5 severities), section filter
   (Architecture / Security / Bugs & Improvements), "collapse/expand all", and a
   **jump-to-file `<select>`** listing every file in `files`.
4. **Three finding `<section>`s** — Architecture, Security, Bugs &
   Improvements. Each collapsible; each lists its finding cards. If a section has
   zero (non-acknowledged) findings, render a subtle "No findings in this lens."
   note so the report shape stays consistent.
5. **Acknowledged / out-of-scope group** — a separate, **collapsed-by-default**
   group holding every finding with `acknowledged: true`. These are intentional
   project decisions (e.g. auth deferred for an MVP) — surfaced for transparency
   but excluded from the severity counts. Style it as muted/secondary; show each
   item's `memoryRef` as a small tag.
6. **Diff viewer** — per-file collapsible blocks (one per `files[]` entry).
   Render `add` lines on a green tint, `del` on red, `context` neutral, with line
   numbers. A line whose `findingId` is set gets a clickable **gutter marker**.

## Finding card

Severity chip (background = matching `--sev-*`), title, a `file:line` link, the
rationale, and the suggested fix (visually distinct — e.g. a "Suggested fix"
block). Architecture cards with an `adr` object add an **ADR** badge showing the
draft title + context. Acknowledged cards additionally show their `memoryRef`
tag.

## Anchors (bidirectional jump)

- Each finding card: `id="finding-<id>"` (e.g. `finding-sec-1`).
- Each annotated diff line: `id="diffline-<file-slug>-<line>"` (e.g.
  `diffline-src-a-ts-42`).
- Each gutter marker carries `data-finding="<id>"`; each finding card carries
  `data-diffline="diffline-<file-slug>-<line>"`.

## Required JS behaviors (all vanilla, inline)

1. **Render from data:** on `DOMContentLoaded`, parse `#review-data`; if it's the
   placeholder or empty, render the empty shell; otherwise build summary badges,
   all finding cards (into their sections + the acknowledged group), and the diff
   viewer.
2. **Bidirectional jump:** clicking a gutter `.ann` marker → `scrollIntoView` its
   `finding-<data-finding>` card and add a `.flash` highlight class for ~1.2s;
   clicking a card's `file:line` link → same, to its `data-diffline` target.
3. **Severity filter:** toggling a severity shows/hides all finding cards AND
   their gutter markers of that severity.
4. **Section filter:** show/hide whole sections.
5. **Coordinate both filters:** a gutter marker must be hidden whenever its
   finding card is hidden by EITHER filter. Resolve each marker's section via its
   `data-finding` card's enclosing `<section>`, and require both the marker's
   severity AND its section to be active before showing it. (Otherwise clicking a
   marker for a filtered-out finding scrolls to a hidden card.)
6. **Collapse/expand all:** toggle every `<section>`, the acknowledged group, and
   every diff-file block.
7. **Jump-to-file:** selecting a file scrolls its diff block into view, then
   resets the `<select>` to its empty default so re-selecting the same file fires
   `change` again.

Keep total JS small and readable. Comment the non-obvious coordination logic.

## Aesthetic direction

Clean, information-dense but calm developer tool — think a well-made code-review
surface. Monospace for code/diff and `file:line`, a comfortable sans for prose.
Severity communicated by the tokens above, never by hue alone (pair with a label
or icon for accessibility). Generous but efficient spacing; sticky summary/controls
bar is welcome. Prioritize scannability of many findings and fast navigation
between a finding and its diff line. Match the general feel of the attached
`_sample-report.html` if provided, but you may improve on it.

## Deliverable

One `.html` file, self-contained, that opens offline, renders a full report when
the seam holds real JSON, and shows a clean empty shell when it holds the
placeholder. Preserve the seam string exactly.
