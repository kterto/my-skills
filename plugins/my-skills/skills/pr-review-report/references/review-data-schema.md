# REVIEW_DATA schema

The skill emits ONE JSON object and injects it into `report-template.html` by
replacing the seam `/*__REVIEW_DATA__*/` inside:

```html
<script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>
```

The template's inline JS renders the entire report from this object — summary
bar, finding cards, acknowledged group, diff viewer, anchors, filters. Do not
author report HTML; only produce this data. Field names and enum values below are
consumed verbatim by the template — match them exactly.

## Shape

```jsonc
{
  "meta": {
    "branch": "feat/x",           // string; sets <title> and header
    "base": "main",               // string
    "mergeBase": "ab12cd3",       // short sha string
    "commitRange": "ab12cd3..HEAD",
    "generatedAt": "2026-07-13",  // YYYY-MM-DD
    "commitCount": 7,             // integer
    "filesChanged": 4             // integer; falls back to files.length if absent
  },

  // Severity totals for the badges. EXCLUDE acknowledged findings from these
  // five; put their total in "acknowledged".
  "counts": {
    "critical": 1, "high": 2, "medium": 3, "low": 1, "info": 2,
    "acknowledged": 2
  },

  // One entry per finding. Acknowledged findings live here too (see below) —
  // the template routes them to the collapsed acknowledged group by the flag.
  "findings": [
    {
      "id": "sec-1",              // stable slug, unique; drives finding-<id> anchor
      "severity": "critical",     // critical | high | medium | low | info  (lowercase)
      "section": "security",      // architecture | security | bugs        (lowercase)
      "title": "One-line title",
      "file": "src/export/download.ts",  // repo-relative path
      "line": 42,                 // integer, new-side line (old-side for deletions)
      "rationale": "Why it matters.",
      "fix": "Concrete suggested change.",

      // architecture findings only, optional:
      "adr": { "title": "ADR-014: …", "context": "1–2 sentences." },

      // acknowledged findings only:
      "acknowledged": true,       // omit or false for normal findings
      "memoryRef": "MEM-7"        // the .pr-review/memory.md entry that acknowledged it
    }
  ],

  // One entry per changed file, in --stat magnitude order. Powers the diff
  // viewer, gutter markers, and diffline-<slug>-<line> anchors.
  "files": [
    {
      "path": "src/export/download.ts",
      "slug": "src-export-download-ts",   // path with / and . replaced by -
      "lines": [
        { "n": 41, "side": "new", "kind": "context", "text": "…", "findingId": null },
        { "n": 42, "side": "new", "kind": "add",     "text": "…", "findingId": "sec-1" },
        { "n": 40, "side": "old", "kind": "del",     "text": "…", "findingId": null }
      ]
    }
  ]
}
```

## Field rules

- **`section`** must be one of `architecture` / `security` / `bugs`. Any other
  value drops the card from every lens.
- **`severity`** lowercase, one of the five. Tints the chip, gutter marker, and
  count badge via the `--sev-*` tokens.
- **`kind`** — `add` (green), `del` (red), `context` (neutral).
- **`findingId`** on a diff line: set it to a finding `id` to make that line
  annotated (clickable gutter marker + `id="diffline-<slug>-<line>"`). The
  finding's own `file`+`line` must resolve to the same `diffline-<slug>-<line>`
  so the bidirectional jump lines up — i.e. the finding's `line` equals the
  diff line's `n`, and the file slug matches.
- **`slug`** — if you omit it the template derives it from `path`; emit it anyway
  for determinism, using the same `/`→`-`, `.`→`-` rule the finding anchors use.
- **Counts must reconcile:** `counts.{critical..info}` = number of non-acknowledged
  findings at each severity; `counts.acknowledged` = number with
  `acknowledged: true`. The template also recomputes section/lens counts itself.

## Acknowledged findings

A finding an entry in `.pr-review/memory.md` marks as intentional (see
`memory-schema.md`) gets `acknowledged: true` + `memoryRef: "<MEM-id>"` and is
**excluded from the five severity counts**. The template surfaces it in a
collapsed "Acknowledged / out-of-scope" group with its `memoryRef` tag — visible
for transparency, out of the noise. A *genuine new defect* in a deferred area is
NOT acknowledged; it stays a normal counted finding.

## Injection

1. Read `references/report-template.html`.
2. Replace the **full seam element** — this exact, unique string:
   ```
   <script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>
   ```
   with `<script id="review-data" type="application/json">` + the JSON text +
   `</script>`. Replace the whole element, **not** the bare `/*__REVIEW_DATA__*/`
   substring — that placeholder also appears in the template's JS guard
   (`raw === "/*__REVIEW_DATA__*/"`), so a bare-substring replace is
   order-dependent and must not be used. The full element occurs exactly once.
3. Write the result to `docs/reviews/<branch>-<YYYY-MM-DD>.html`.

Validate the JSON parses before injecting. Loading the file offline must render a
full report; if the seam is left as the placeholder the template shows an empty
shell.
