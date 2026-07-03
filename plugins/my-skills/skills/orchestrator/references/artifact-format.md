# Orchestrator — Artifact Format Reference

All six role templates (brainstormer, architect, coder, tester, reviewer, qa) write artifacts using the format controlled by `output_format`. This document is the single source of truth — role templates reference it instead of duplicating emission rules.

> **Materialized location.** Bootstrap (Step B3) copies this file to `.orchestrator/artifact-format.md` and the html scaffolds to `.orchestrator/html-templates/`. Subagents read those `.orchestrator/` paths — they do NOT have access to the skill's own `references/` or `templates/html/` directories. Always reference the `.orchestrator/` copies in role prompts.

## Core rule — markdown is always the source of truth

**The `.md` artifact is ALWAYS written, in every mode.** Its YAML frontmatter is the canonical state: it is what the orchestrator scans for ID allocation and what the coder/architect mutate (`status:`, `updated_at:`, task checkboxes). When `output_format=html` the role ALSO writes a styled `.html` rendered *view* alongside the `.md`. The html file is a read-only render — never the place state lives.

This means:

- Numbering scans never break, because `<ID>-<slug>.md` always exists.
- State mutation (status flips, `[ ] → [x]`) always targets the `.md` first — it is authoritative.
- The `.html` view is a snapshot rendered from the `.md` at write time.

**One exception — the coder keeps the plan html task state live.** While executing a plan in `html` mode (and only when the plan `<ID>-<slug>.html` exists beside the `.md`), the coder mirrors each `[ ] → [x]`, the progress overview, and `data-status`/`data-updated-at` into that one plan html view as it goes, so the rendered plan tracks reality instead of freezing at creation time. The `.md` still wins on any disagreement, and every other artifact's `.html` remains a read-only render regenerated downstream. See the coder role template, Step 4b-html.

## md artifact (always written)

- Filename: `<ID>-<slug>.md` (e.g. `FEAT-003-add-list-sharing.md`)
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

## html rendered view (additional, only when output_format=html)

Written IN ADDITION to the `.md`, never instead of it.

- Filename: `<ID>-<slug>.html` (same `<ID>-<slug>` stem as the `.md`, sitting beside it).
- One self-contained file — no external assets, no CDN links.
- The root element is `<main>` with `data-*` attributes mirroring the md frontmatter (the `.md` is authoritative if the two ever disagree):

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

**Styled scaffolds.** In `html` mode, each role fills the matching self-contained scaffold in `.orchestrator/html-templates/<artifact>.template.html` (spec, plan, test-report, code-review, qa-report, final-report, progress-timeline). These define the Editorial Design System v1 look and the required `<main data-*>` shell; roles replace the sample content with the real artifact content, preserving the `data-*` attributes, `<details><summary>` sections, disabled checkboxes, and the `<span class="badge">cycle N</span>` badge. `progress-timeline.template.html` is wired: in `html` mode the orchestrator renders `<plan-path-without-.md>.progress.html` from a plan's `.progress.md` append-log at each pipeline terminal state. `.progress.md` remains the markdown source-of-truth log (roles append to it); the html file is a regenerated read-only view.

## Canonical directories & prefixes (allow-list — load-bearing)

The ONLY directories permitted under `plans/`. No role or step may invent any other directory.

| Artifact      | Directory            | Prefix  | Owner (who creates it)         |
| ------------- | -------------------- | ------- | ------------------------------ |
| spec          | `plans/specs/`       | `SPEC`  | brainstormer                   |
| feature plan  | `plans/feat/`        | `FEAT`  | architect (type `feat`)        |
| fix plan      | `plans/code-review/` | `FIX`   | architect (type `fix`)         |
| qa-fix plan   | `plans/qa/`          | `QAF`   | architect (type `qa`)          |
| test report   | `plans/test/`        | `TEST`  | tester                         |
| code review   | `plans/code-review/` | `CR`    | reviewer                       |
| qa report     | `plans/qa/`          | `QA`    | qa                             |
| spec eval     | `plans/eval/`        | `EVAL`  | orchestrator (Step 7a)         |
| final report  | `plans/final/`       | `FINAL` | orchestrator (Step 7b)         |

`QNA-{NNN}` files (brainstormer, non-interactive mode) share the paired SPEC's **ID token** (the `{NNN}` part only, without the `SPEC-` prefix) and live in `plans/specs/`.

## ID allocation — timestamp-based, collision-free

An artifact ID is `<PREFIX>-<ID-TOKEN>` where the ID token is a UTC creation timestamp plus a short random suffix:

```
<PREFIX>-<YYYYMMDD>T<HHMMSS>Z-<4 hex>
e.g.  FEAT-20260703T142530Z-a1b2   SPEC-20260703T142531Z-9f0c   TEST-20260703T142600Z-7d3e
```

**Why not an incrementing counter.** The old `<PREFIX>-001` scheme scanned the target directory for the highest existing number and added one. Two coworkers working in separate branches/worktrees each see only their own tree, both allocate the same next number, and the IDs collide on merge. Timestamp IDs are allocated **without listing the directory at all**, so parallel actors never race: the second-resolution UTC timestamp orders artifacts by creation time, and the random suffix guarantees uniqueness even if two artifacts of the same prefix are created in the same second.

IDs are **assigned by the orchestrator and passed into each role's prompt** (`ID to use: <PREFIX>-<ID-TOKEN>`). A role MUST use the provided ID verbatim and MUST NOT compute its own when one is supplied.

The orchestrator generates an ID with a fixed command — no scan, no dir argument:

```bash
# arg: $1 = prefix (e.g. FEAT). Emits e.g. FEAT-20260703T142530Z-a1b2
newid() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf '%s-%s-%s\n' "$1" "$ts" "$rnd"
}
```

Fallback: if a role is run standalone (no `ID to use:` in its prompt), it runs the same generator itself before writing.

**Validation & ordering.** An ID token matches `[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}`; a full artifact filename matches `^<PREFIX>-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}-<slug>\.(md|html)$`. Because the timestamp is fixed-width and leads the token, `ls <dir> | sort` lists artifacts in chronological order.

> **Placeholder note.** Throughout these templates and the role prompts, `{NNN}` (and any `-NNN` shown in an example path) is shorthand for this per-artifact **ID token** — no longer a zero-padded number. Read `SPEC-{NNN}` as `SPEC-<YYYYMMDD>T<HHMMSS>Z-<hex>`.

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
