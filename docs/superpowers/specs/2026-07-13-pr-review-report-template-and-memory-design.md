# pr-review-report — HTML template + stateful memory

**Date:** 2026-07-13
**Skill:** `plugins/my-skills/skills/pr-review-report`
**Status:** approved (design)

## Problem

Two weaknesses in the current skill:

1. **No HTML template.** `references/html-template.md` is a prose *contract*. The
   model re-authors the whole HTML report every run → visual drift between
   reports and wasted tokens designing chrome that never changes.
2. **No project context / memory.** The reviewer has no knowledge of intentional
   project decisions. Example: an MVP where auth was deliberately deferred to
   ship core/risky features first. Every review re-flags "auth missing" as a
   security hole. The skill should read project context and keep an evolving,
   review-owned memory so acknowledged decisions stop generating noise.

## Approved decisions

| Fork | Decision |
|---|---|
| Template shape | **Data-injection skeleton** — fixed chrome + JS, skill emits a `REVIEW_DATA` JSON blob injected into one seam |
| Memory source | **Read `PROJECT-CONTEXT.md` (read-only) + own `.pr-review/memory.md`** (evolving) |
| Evolution | **Propose-and-confirm** — reviewer proposes deltas at review end, user approves, then append |
| Deferred-area findings | **Acknowledge, don't drop** — moved to a collapsed "Acknowledged / out-of-scope" group, excluded from severity counts |
| Scope match | **Semantic judgment + optional keyword hints** in each entry's `scope:` line |

## Deliverable 1 — data-injection template

Claude Design generates `references/report-template.html`. It carries **all**
fixed structure and behavior; the skill only supplies data.

- **Fixed by the template:** `<head>` + `<meta charset>` + `<title>`; inline
  `<style>` with severity tokens
  (`--sev-critical:#dc2626; --sev-high:#ea580c; --sev-medium:#ca8a04; --sev-low:#2563eb; --sev-info:#6b7280;`);
  summary bar; controls (severity multi-toggle, section filter, collapse/expand
  all, jump-to-file `<select>`); empty `<section>` shells for Architecture,
  Security, Bugs & Improvements, plus the **Acknowledged / out-of-scope** group;
  the diff viewer container; and all vanilla inline JS.
- **The injection seam** (exactly one):
  ```html
  <script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>
  ```
- **Template JS renders everything from data:** finding cards, per-file diff with
  added/removed tinting, gutter annotation markers, `finding-<id>` and
  `diffline-<file-slug>-<line>` anchors, bidirectional jump (marker ⇄ card,
  `scrollIntoView` + `.flash` 1.2s), severity filter, section filter, coordinated
  filter (a gutter marker hides whenever its card is hidden by severity OR
  section), collapse/expand all, jump-to-file (scroll then reset the select),
  empty-state notes per lens, and the collapsed acknowledged group.
- **Self-contained:** no remote CSS/JS/fonts/images; opens by double-click,
  offline. Outbound `<a href>` links in finding text are allowed.

Constraints (offline, anchors, filter coordination, severity tokens) are
non-negotiable — they move verbatim from the retiring `html-template.md` into the
template's JS and into the Claude Design prompt.

### `REVIEW_DATA` schema (skill emits this)

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
      "id": "sec-1", "severity": "high", "section": "security",
      "title": "…", "file": "src/a.ts", "line": 42,
      "rationale": "…", "fix": "…",
      "adr": { "title": "…", "context": "…" },   // architecture only, optional
      "acknowledged": false,                        // true → acknowledged group, not counted
      "memoryRef": null                             // e.g. "MEM-1" when acknowledged
    }
  ],
  "files": [
    {
      "path": "src/a.ts", "slug": "src-a-ts",
      "lines": [
        { "n": 42, "side": "new", "kind": "add", "text": "…", "findingId": "sec-1" },
        { "n": 41, "side": "new", "kind": "context", "text": "…", "findingId": null }
      ]
    }
  ]
}
```

Lives in `references/review-data-schema.md`.

## Deliverable 2 — context + evolving memory

Two reads, one gated write-target.

### Reads

1. **Static context** — `PROJECT-CONTEXT.md` at repo root, sections **Out of
   scope** and **Invariants** (read-only). Skill loads if present; absent → skip.
2. **Evolving memory** — `.pr-review/memory.md` in the reviewed repo. Committed,
   shareable, review-owned.

### `.pr-review/memory.md` entry format

```markdown
## MEM-1 · acknowledged
scope: auth, session, login, jwt
directive: Auth intentionally deferred for MVP; core/risky features first.
effect: acknowledge        # acknowledge | suppress | downgrade
added: 2026-07-13 · source: user-confirmed
```

- `effect: acknowledge` — surface but move to the acknowledged group, drop from
  counts (approved default).
- `effect: suppress`/`downgrade` — supported by the schema for future use; the
  approved behavior for deferred areas is `acknowledge`.
- `scope:` — keyword hints; matching is the reviewer's **semantic judgment**
  guided by these hints, not a strict glob.

Lives in `references/memory-schema.md`.

### Matching & application (in the review lenses)

For each candidate finding, the reviewer asks: does this finding's area match an
`acknowledged` memory entry's `scope`/`directive`, AND is the finding merely
restating the known-deferred fact (not a fresh defect in that area)? If yes →
mark `acknowledged: true`, set `memoryRef`, keep it out of `counts`. A genuine
new regression touching a deferred area stays a normal, counted finding.

### Propose-and-confirm loop (evolution)

After producing findings, before writing memory:

1. Reviewer identifies recurring/whole-scope observations that look like
   intentional decisions (e.g. several findings all restating "auth missing").
2. Reviewer **proposes** a memory delta to the user: the draft entry + why.
3. User approves / edits / rejects each proposal.
4. On approval, skill appends the entry to `.pr-review/memory.md` (creating the
   file + `.pr-review/` dir if absent). **Nothing is written without approval.**

This is the automatic-yet-gated evolution the user asked for: the skill drives
the suggestion, the human keeps the veto.

## SKILL.md procedure (new shape)

```
1. Resolve base branch            (unchanged)
2. Load context + memory          (NEW: PROJECT-CONTEXT.md §Out-of-scope/§Invariants
                                        + .pr-review/memory.md)
3. Gather diff                    (unchanged)
4. Review across 3 lenses         (apply acknowledged/suppress rules from memory)
5. Build REVIEW_DATA JSON         (emit data, not HTML)
6. Inject into report-template.html → docs/reviews/<branch>-<YYYY-MM-DD>.html
7. Propose memory updates         (propose-and-confirm; append on approval)
8. Report path + per-severity counts (+ acknowledged count)
```

Fallback: until `report-template.html` exists, step 6 falls back to the current
authoring path so the skill stays functional.

## Files touched

| File | Action |
|---|---|
| `references/report-template.html` | **new** — generated via Claude Design, pasted back |
| `references/review-data-schema.md` | **new** — `REVIEW_DATA` JSON shape |
| `references/memory-schema.md` | **new** — `.pr-review/memory.md` format + matching rules |
| `references/html-template.md` | **retire** — folded into template + data schema |
| `SKILL.md` | rewrite steps 2, 4, 5–7 |
| `references/review-rubric.md` | add "applying memory" note |
| `docs/superpowers/prompts/claude-design-pr-review-template.md` | **new** — the prompt the user runs in Claude Design |

## Out of scope

- Auto-writing memory with no gate.
- Skill-global (cross-repo) memory.
- Hard-suppressing deferred-area findings by default.
- Changing the three review lenses or severity taxonomy.
