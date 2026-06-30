# pr-review-report — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation plan

## Purpose

A distributable workspace skill that produces a rich, interactive HTML PR code-review
report. On invocation the agent reviews the current branch against an auto-detected base
branch, then authors a single self-contained HTML artifact organized into three review
lenses: architecture, security, and bugs/improvements. The report renders the actual diff
with inline margin annotations and color-coded findings by severity.

## Key Decisions

| Decision | Choice |
|---|---|
| HTML generation | Agent authors the complete self-contained HTML each run |
| "Iterable" output | Interactive single artifact (filter/collapse/jump); no persisted triage state between runs |
| Findings source | Pure LLM review over the diff (no external tool integration) |
| ADR handling | Recommend only — flag decision + draft ADR title/context in report; write no files |
| Diff base | Auto-detect default branch + merge-base; show and let user override before generating |
| Output path | `docs/reviews/<branch>-<YYYY-MM-DD>.html` (committed, shareable) |
| Severity scheme | Critical / High / Medium / Low / Info (red/orange/yellow/blue/gray) |

## Skill Layout

```
plugins/my-skills/skills/pr-review-report/
  SKILL.md           # frontmatter (name, description) + procedure
  references/
    html-template.md # reference structure + required CSS/JS behaviors for the HTML
    review-rubric.md # what each lens looks for; severity definitions; ADR-worthy criteria
```

Distribution follows the existing repo convention (other skills under
`plugins/my-skills/skills/<name>/SKILL.md`). No build step; the skill is markdown +
references only.

## Procedure (SKILL.md)

1. **Resolve base branch.**
   - Detect default branch: `git symbolic-ref refs/remotes/origin/HEAD` → fall back to
     `main` → `master` → `dev` (first that exists).
   - Compute range: `git merge-base <base> HEAD` for the three-dot diff.
   - Show user: base branch, merge-base sha, commit count, changed-file count.
   - Let user override the base before continuing.

2. **Gather diff.**
   - `git diff <base>...HEAD` (three-dot = changes on current branch since divergence).
   - `git diff --stat <base>...HEAD` for the file/line summary.
   - Agent reads the full diff. For large diffs, prioritize by stat and note any files
     skipped in the report (no silent truncation).

3. **Review — three lenses, pure LLM.**
   - **Architecture:** design decisions, module boundaries, coupling/cohesion,
     dependency direction, abstraction fit. Each notable decision is tagged
     **ADR-worthy?** with a draft ADR title + 1–2 sentence context/consequence. No files
     written.
   - **Security:** injection (SQL/command/template), authz/authn gaps, secret exposure,
     unsafe deserialization, SSRF, path traversal, missing validation, dependency risk.
   - **Bugs & improvements:** correctness, edge cases, null/error handling, race
     conditions, performance, and clean-code/readability improvements.

4. **Emit HTML.** Agent authors the complete self-contained file at the output path —
   inline CSS + JS only, zero network dependencies — following `references/html-template.md`.

## HTML Artifact

**Self-contained:** one `.html` file, all CSS/JS inline, no external fetches, opens
offline.

**Header / summary bar**
- Branch name, base branch, merge-base sha, commit range, generated-at timestamp.
- Per-severity finding counts (badges) and per-section counts.

**Three collapsible sections** — Architecture, Security, Bugs & Improvements.

**Finding card** (repeated within each section)
- Severity chip — Critical=red, High=orange, Medium=yellow, Low=blue, Info=gray.
- Title, `file:line` link (jumps to the annotated diff line).
- Rationale (why it matters).
- Suggested fix.
- Architecture findings additionally show an **ADR** badge with draft title + context
  when flagged ADR-worthy.

**Diff viewer**
- Per-file rendered diff (added/removed line coloring, light syntax treatment).
- **Inline margin annotations:** finding markers anchored in the gutter at their line;
  clicking a marker scrolls to the finding card and vice-versa (bidirectional anchor).
- Files collapsible; jump-to-file control.

**Controls (client-side JS only — no persisted state)**
- Filter by severity (multi-toggle).
- Filter by section.
- Collapse / expand all.
- Jump-to-file navigation.

## Severity Definitions

- **Critical** — exploitable security hole or data-loss/corruption bug; must fix before merge.
- **High** — likely-incorrect behavior or serious security weakness; should fix before merge.
- **Medium** — real bug or design issue in a narrower case; fix soon.
- **Low** — minor correctness/readability/perf nit.
- **Info** — observation, context, or ADR-worthy architectural note with no defect.

## ADR-Worthy Criteria

Flag an architectural finding ADR-worthy when the diff introduces a decision that is
(a) hard to reverse, (b) affects multiple modules or future work, or (c) chooses among
viable alternatives with real trade-offs. Report a draft ADR title and context only;
the human decides whether to persist it.

## Out of Scope (YAGNI)

- Persisted triage state across runs.
- Integration with clean-code-gates / security-review tooling.
- Auto-writing ADR or fix files.
- Posting findings to GitHub PR comments.

## Success Criteria

- Running the skill on a branch with changes yields one self-contained HTML opening
  offline with the diff rendered.
- Findings appear under the correct lens, color-coded by severity, each with file:line,
  rationale, and suggested fix.
- Inline margin annotations link bidirectionally between diff lines and finding cards.
- Architectural decisions meeting the ADR criteria are flagged with a draft ADR title;
  no ADR files are written.
- Base branch is auto-detected, shown, and overridable before generation.
