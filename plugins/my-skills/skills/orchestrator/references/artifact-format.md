# Orchestrator — Artifact Format Reference

All six role templates (brainstormer, architect, coder, tester, reviewer, qa) write artifacts using the format controlled by `output_format`. This document is the single source of truth — role templates reference it instead of duplicating emission rules.

> **Materialized location.** Bootstrap (Step B3) copies this file to `.orchestrator/artifact-format.md`, the html scaffolds to `.orchestrator/html-templates/`, and the runtime scripts (`render-artifact.cjs`, `check-artifact-pairing.cjs`, `check-artifact-links.cjs`, `gate-scope.cjs`) into `.orchestrator/`. Subagents read those `.orchestrator/` paths — they do NOT have access to the skill's own `references/`, `templates/html/`, or `scripts/` directories. Always reference the `.orchestrator/` copies in role prompts.

> **HTML is rendered, never hand-written.** In `html` mode the `.html` view is produced by running `node .orchestrator/render-artifact.cjs <artifact.md>` — the renderer fills the correct scaffold, mirrors the frontmatter into `<main data-*>`, escapes every attribute/URL, and self-validates the structure before writing. Roles and the orchestrator NEVER author HTML by hand; they write the `.md` and invoke the renderer. This is the single source of the one-source/two-render guarantee, and its escaping is what keeps generated artifacts XSS-safe.

## Core rule — markdown is always the source of truth

**The `.md` artifact is ALWAYS written, in every mode.** Its YAML frontmatter is the canonical state: it is what the orchestrator scans for ID allocation and what the coder/architect mutate (`status:`, `updated_at:`, task checkboxes). When `output_format=html` the role ALSO writes a styled `.html` rendered *view* alongside the `.md`. The html file is a read-only render — never the place state lives.

This means:

- Numbering scans never break, because `<ID>-<slug>.md` always exists.
- State mutation (status flips, `[ ] → [x]`) always targets the `.md` first — it is authoritative.
- The `.html` view is a snapshot rendered from the `.md` at write time.

**One exception — the coder keeps the plan html task state live.** While executing a plan in `html` mode (and only when the plan `<ID>-<slug>.html` exists beside the `.md`), the coder keeps the rendered plan in sync with reality instead of freezing it at creation time by **re-running the renderer on the plan** — `node .orchestrator/render-artifact.cjs plans/<dir>/<ID>-<slug>.md` — after it flips checkboxes and updates `status`/`updated_at` in the authoritative `.md`. The renderer regenerates the `.html` from the current `.md`, so task state, progress overview, and `data-*` all follow automatically. The `.md` still wins on any disagreement, and every other artifact's `.html` is likewise a render of its `.md`. See the coder role template, Step 4b-html.

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

Written IN ADDITION to the `.md`, never instead of it, and **always produced by the renderer** — never authored by hand.

After the authoritative `.md` is on disk, produce its view with:

```bash
node .orchestrator/render-artifact.cjs plans/<dir>/<ID>-<slug>.md
```

The renderer writes the paired `<ID>-<slug>.html` beside it and prints `rendered <path>`; it exits non-zero (writing nothing) if the source escapes `plans/`, is not a `.md` regular file, or the emitted structure is non-conformant. What it guarantees, so roles don't have to reproduce it:

- Filename `<ID>-<slug>.html` beside the `.md`; one self-contained file — no external assets, no CDN links.
- Root `<main>` with `data-*` attributes mirroring the md frontmatter (the `.md` is authoritative if they ever disagree):

  ```html
  <main data-id="<ID>" data-status="<status>" data-created-at="<ISO-8601>"
        data-updated-at="<ISO-8601>" data-cycle="<integer>">
  ```

- Sections wrapped in collapsible `<details><summary>Section Title</summary>…</details>`.
- Task lists as `<input type="checkbox" disabled>` checkboxes (checked iff `- [x]`).
- Cycle counters as inline `<span class="badge">cycle N</span>` badges.
- Every attribute, link URL, and text node escaped (attribute-escaping + a scheme allowlist for `href`), plus a `default-src 'none'` CSP with a per-render script hash.

**Scaffold selection is automatic** (from the `.md` path): `*.progress.md` → `progress-timeline.template.html`; a source under `plans/eval/` → `qa-report.template.html`; otherwise the same-named `<artifact>.template.html` (spec, plan, test-report, code-review, qa-report, final-report) in `.orchestrator/html-templates/`. The renderer also produces the progress view: `node .orchestrator/render-artifact.cjs plans/<dir>/<ID>-<slug>.progress.md` writes `<plan-path-without-.md>.progress.html` from the plan's `.progress.md` append-log. `.progress.md` remains the markdown source-of-truth log (roles append to it); the html file is a regenerated read-only view.

## Validation gates (html mode — blocking)

Before the pipeline prints its `pipeline complete` banner, the orchestrator runs both gates over the artifacts this branch introduced. They are shell-free and **fail closed** (a broken git or unresolvable base ref exits non-zero rather than passing a vacuous empty scope), so a green verdict is trustworthy:

```bash
node .orchestrator/check-artifact-pairing.cjs   # every branch-added plans/**.md has its .html sibling + complete frontmatter
node .orchestrator/check-artifact-links.cjs     # every local link in a branch-added plans/**.html resolves on disk
```

Each prints `<gate>: OK` and exits 0 on success, or lists violations and exits non-zero. A non-zero gate blocks completion — see SKILL.md → Step 7d. Scope is the branch's added/modified files under `plans/` vs the merge-base with the base branch; legacy artifacts are not re-audited. Pass an explicit base ref as the first argument, `-- <file>…` to check specific files, or `--allow-empty` to opt out of the fail-closed base guard.

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
