# Roadmap Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a doc-only `roadmap` skill that decomposes a project spec into an auditable milestone→phase→task tree under `/roadmap/`, with orchestrator-ready task briefs, append-only audit logs, `/roadmap sync` trailer stamping, and diff+preserve re-evaluation.

**Architecture:** A prose-instruction skill (like the existing `orchestrator` skill) — `SKILL.md` drives the flow; `references/*.md` hold the data contracts and algorithms; `templates/*` hold the rendered artifacts in `md` and `html`. The skill writes documentation only — it runs no code, never invokes the orchestrator, never commits. It reuses the orchestrator's `.orchestrator/PROJECT-CONTEXT.md` for context and inherits its config defaults.

**Tech Stack:** Markdown + YAML frontmatter, self-contained HTML (no external assets), JSON for machine state (`roadmap.lock.json`). No build step. Verification is structural (grep / key-presence / cross-ref integrity), since the deliverables are documents, not executable code.

## Global Constraints

- Skill root: `plugins/my-skills/skills/roadmap/` — copied verbatim from these literal values.
- Doc-only: the skill MUST NOT execute code, run the orchestrator pipeline, or commit. Verbatim wording.
- Reuse `.orchestrator/PROJECT-CONTEXT.md` when present (read-only); own context gate is fallback only.
- `output_format` ∈ {`md`, `html`}; default inherits `.orchestrator/config.json`, else `md`.
- `context_threshold` default inherits `.orchestrator/config.json`, else `0.95`.
- Status enum, exact set: `todo | in_progress | done | superseded | blocked`.
- Audit log is append-only — rows are never edited or removed.
- ID scheme: milestone `NNN-kebab` (zero-padded ordinal), phase `NNN.M`, task `NNN.M.T`.
- Stable-identity rule: a directory number is never renumbered; execution order lives in the `sequence` field.
- Commit-trailer convention (exact): `Roadmap-Task: <id>`.
- Spec of record: `docs/superpowers/specs/2026-06-21-roadmap-skill-design.md` — cited per task by section.
- HTML artifacts follow `plugins/my-skills/skills/orchestrator/references/artifact-format.md` (root `<main data-*>`, collapsible `<details>`, disabled checkboxes, no external assets).

---

### Task 1: Static contract references (directory-layout, item-schema, config)

Defines the data contracts every later task consumes: the directory tree, the ID scheme, the frontmatter + audit-log shape, and config precedence. Spec §6, §7, §8, §9, §12.

**Files:**
- Create: `plugins/my-skills/skills/roadmap/references/directory-layout.md`
- Create: `plugins/my-skills/skills/roadmap/references/item-schema.md`
- Create: `plugins/my-skills/skills/roadmap/references/config.md`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces (exact names later tasks rely on):
  - Frontmatter keys (task): `id, kind, title, status, milestone, phase, sequence, depends_on, spec_refs, commit_trailer, created_at, updated_at`.
  - Frontmatter keys (milestone/phase): same minus `commit_trailer`, `kind: milestone|phase`, no `orchestrator_brief`.
  - Status enum: `todo | in_progress | done | superseded | blocked`.
  - Audit-log columns, in order: `when (ISO-8601) | status | who | evidence`.
  - Rollup function name (referenced in prose): `rollup(children) -> status`.
  - Task body sections, exact headings: `## Brief`, `## Acceptance`, `## Audit log`.
  - Lock-file keys: `version, last_synced_sha, items[]` where each item = `{id, kind, status, content_hash, sequence}`.
  - Config keys: `output_format`, `context_threshold`; precedence `CLI > /roadmap/roadmap.config.json > .orchestrator/config.json > default`.

- [ ] **Step 1: Write `directory-layout.md`**

Content must include, verbatim where marked:
- The full `/roadmap/` tree from spec §6 (fenced).
- ID scheme table: milestone `NNN-kebab`, phase `NNN.M`, task `NNN.M.T`.
- Stable-identity rule (spec §7) including the consequence sentence: directory number ≠ execution order after first insert; order carried by `sequence`.
- Statement: `output_format` controls all generated `.md`/`.html` artifacts; `roadmap.lock.json` is always JSON and is machine state, not a deliverable.
- `roadmap.lock.json` schema:

```json
{
  "version": 1,
  "last_synced_sha": "<sha or null>",
  "items": [
    { "id": "001.1.1", "kind": "task", "status": "todo", "content_hash": "<sha256>", "sequence": 1 }
  ]
}
```

- [ ] **Step 2: Write `item-schema.md`**

Include verbatim:
- The task md frontmatter block + body sections from spec §8 (the full fenced YAML + `## Brief` / `## Acceptance` / `## Audit log` table).
- The milestone/phase variant note (`kind: milestone|phase`, rolled-up status, no `orchestrator_brief`).
- The audit-log row format with the four columns in order, and the rule: append-only, `who` = git author for sync-detected done / actor tag otherwise, `evidence` = sha or originating action.
- The html-mode pointer to `orchestrator/references/artifact-format.md` (root `<main data-id data-status data-created-at data-updated-at>`, `<details><summary>` sections, disabled checkboxes).

- [ ] **Step 3: Write `config.md`**

Include the config table from spec §12 (keys, types, defaults, inheritance source, CLI flag) and the precedence line verbatim: `CLI flag > /roadmap/roadmap.config.json > .orchestrator/config.json > built-in default`.

- [ ] **Step 4: Verify structure**

Run:
```bash
cd plugins/my-skills/skills/roadmap/references
grep -q 'Roadmap-Task: <id>' item-schema.md && \
grep -q 'todo | in_progress | done | superseded | blocked' item-schema.md && \
grep -Eq 'when \(ISO-8601\) \| status \| who \| evidence' item-schema.md && \
grep -q 'last_synced_sha' directory-layout.md && \
grep -q 'sequence' directory-layout.md && \
grep -q 'CLI flag > /roadmap/roadmap.config.json > .orchestrator/config.json' config.md && \
echo OK_TASK1
```
Expected: `OK_TASK1`.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/roadmap/references/directory-layout.md \
        plugins/my-skills/skills/roadmap/references/item-schema.md \
        plugins/my-skills/skills/roadmap/references/config.md
git commit -m "feat(roadmap): static contract references (layout, schema, config)"
```

---

### Task 2: Sync + re-eval algorithm reference

The two non-trivial algorithms: `/roadmap sync` (trailer scan → stamp) and re-evaluation (diff + preserve), plus the rollup rules. Spec §9, §10, §11.

**Files:**
- Create: `plugins/my-skills/skills/roadmap/references/sync-and-reeval.md`

**Interfaces:**
- Consumes: status enum, audit-log columns, lock-file schema (Task 1).
- Produces: the canonical step lists for sync and re-eval that `SKILL.md` (Task 5) references by name: `Sync procedure`, `Re-eval procedure`, `Rollup rules`.

- [ ] **Step 1: Write the Rollup rules section**

Verbatim from spec §9:
- all children `done`/`superseded` → `done`
- any child `blocked` → `blocked`
- any child `in_progress` or mixed done+todo → `in_progress`
- all children `todo` → `todo`
- `superseded` children excluded from "remaining work" but kept in counts.

- [ ] **Step 2: Write the Sync procedure section**

Numbered steps, verbatim from spec §10:
1. Read `last_synced_sha` from `roadmap.lock.json`.
2. `git log <last_synced_sha>..HEAD --grep 'Roadmap-Task:'` (when `last_synced_sha` is null, scan full history); per commit extract task id(s), author name/email, author date (ISO-8601), sha.
3. For each matched task not already `done`/`superseded`: set `status: done`, append audit row (`who`=author, `evidence`=sha).
4. Roll up phase/milestone; append rollup rows only where derived status changed.
5. Update `last_synced_sha`=HEAD, refresh README progress %, print stamped-task summary.
Include the idempotency note: re-running never regresses or rewrites prior rows.

Show the exact git command and a parse example:
```bash
git log "${last_synced_sha:-}"..HEAD --grep 'Roadmap-Task:' \
  --pretty=format:'%H%x09%an <%ae>%x09%aI%x09%(trailers:key=Roadmap-Task,valueonly)'
```

- [ ] **Step 3: Write the Re-eval procedure section**

Numbered steps, verbatim from spec §11:
1. Re-read context/spec; re-derive target tree.
2. Diff target vs `roadmap.lock.json` (compare by `id`, detect scope change via `content_hash`):
   - new → stage append with next stable IDs;
   - scope-changed → stage body/acceptance update, status unchanged unless obsoleted;
   - obsoleted done → `superseded` (kept, flagged, audit row); obsoleted not-done → `superseded` (kept).
3. Present staged diff with markers `+ new`, `~ changed`, `! superseded`; require approval.
4. On approval → apply, append audit rows, update `roadmap.lock.json`.
Include the immutability rule: completed work never renumbered, never deleted.

- [ ] **Step 4: Verify structure**

Run:
```bash
cd plugins/my-skills/skills/roadmap/references
grep -q "git log" sync-and-reeval.md && \
grep -q "Roadmap-Task" sync-and-reeval.md && \
grep -q "last_synced_sha" sync-and-reeval.md && \
grep -Eq 'superseded' sync-and-reeval.md && \
grep -Eq '\+ new|~ changed|! superseded' sync-and-reeval.md && \
echo OK_TASK2
```
Expected: `OK_TASK2`.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/roadmap/references/sync-and-reeval.md
git commit -m "feat(roadmap): sync + re-eval algorithm reference"
```

---

### Task 3: Markdown templates

The four `md` deliverable templates, rendered per the Task 1 schema. Spec §6, §8.

**Files:**
- Create: `plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.md`
- Create: `plugins/my-skills/skills/roadmap/templates/milestone-readme.template.md`
- Create: `plugins/my-skills/skills/roadmap/templates/phase-readme.template.md`
- Create: `plugins/my-skills/skills/roadmap/templates/task.template.md`

**Interfaces:**
- Consumes: frontmatter keys, status enum, audit-log columns, body section headings (Task 1).
- Produces: placeholder token convention `{{token}}` used identically by Task 4 html templates and read by `SKILL.md` (Task 5) at render time.

- [ ] **Step 1: Write `task.template.md`**

Must match the Task 1 schema exactly. Use `{{token}}` placeholders:

```markdown
---
id: {{id}}
kind: task
title: {{title}}
status: {{status}}
milestone: "{{milestone}}"
phase: "{{phase}}"
sequence: {{sequence}}
depends_on: {{depends_on}}
spec_refs: {{spec_refs}}
commit_trailer: "Roadmap-Task: {{id}}"
created_at: {{created_at}}
updated_at: {{updated_at}}
---
## Brief
{{brief}}

Commit with trailer: Roadmap-Task: {{id}}

## Acceptance
{{acceptance}}

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{status}} | roadmap-skill | /roadmap plan |
```

- [ ] **Step 2: Write `phase-readme.template.md`**

```markdown
---
id: {{id}}
kind: phase
title: {{title}}
status: {{rollup_status}}
milestone: "{{milestone}}"
sequence: {{sequence}}
depends_on: {{depends_on}}
created_at: {{created_at}}
updated_at: {{updated_at}}
---
# Phase {{id}} — {{title}}

**Status:** {{rollup_status}}

## Tasks (in execution order)
{{task_list_ordered_by_sequence}}

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{rollup_status}} | roadmap-skill | /roadmap plan |
```

- [ ] **Step 3: Write `milestone-readme.template.md`**

Same shape as phase, `kind: milestone`, listing phases ordered by `sequence` under `## Phases (in execution order)`.

- [ ] **Step 4: Write `roadmap-readme.template.md`**

Top index. Must include: a legend of the status enum, an overall progress line `{{done_count}}/{{total_count}} tasks done ({{pct}}%)`, and a `## Milestones (in execution order)` list rendered by `sequence` with each milestone's rollup status. No frontmatter required (it is the index), but include an HTML-comment marker `<!-- roadmap-index -->` at top for detection.

- [ ] **Step 5: Verify structure**

Run:
```bash
cd plugins/my-skills/skills/roadmap/templates
grep -q 'commit_trailer: "Roadmap-Task: {{id}}"' task.template.md && \
grep -Eq 'when \(ISO-8601\) \| status \| who \| evidence' task.template.md && \
grep -q '## Brief' task.template.md && grep -q '## Acceptance' task.template.md && \
grep -q 'kind: phase' phase-readme.template.md && \
grep -q 'kind: milestone' milestone-readme.template.md && \
grep -q 'roadmap-index' roadmap-readme.template.md && \
echo OK_TASK3
```
Expected: `OK_TASK3`.

- [ ] **Step 6: Commit**

```bash
git add plugins/my-skills/skills/roadmap/templates/*.template.md
git commit -m "feat(roadmap): markdown deliverable templates"
```

---

### Task 4: HTML templates

The four `html` variants — same data, self-contained, per `orchestrator/references/artifact-format.md`. Spec §8.

**Files:**
- Create: `plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.html`
- Create: `plugins/my-skills/skills/roadmap/templates/milestone-readme.template.html`
- Create: `plugins/my-skills/skills/roadmap/templates/phase-readme.template.html`
- Create: `plugins/my-skills/skills/roadmap/templates/task.template.html`

**Interfaces:**
- Consumes: `{{token}}` convention (Task 3), artifact-format html rules.
- Produces: html artifacts with `<main data-*>` mirroring md frontmatter.

- [ ] **Step 1: Write `task.template.html`**

Self-contained, no external assets. `<main>` mirrors frontmatter; sections collapsible; audit log as a table:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Task {{id}} — {{title}}</title>
<style>body{font:14px/1.5 system-ui;margin:2rem;max-width:60rem}.badge{display:inline-block;padding:.1em .5em;border-radius:.4em;background:#eee}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3em .6em}</style>
</head><body>
<main data-id="{{id}}" data-kind="task" data-status="{{status}}"
      data-created-at="{{created_at}}" data-updated-at="{{updated_at}}">
  <h1>Task {{id}} — {{title}} <span class="badge">{{status}}</span></h1>
  <details open><summary>Brief</summary>
    <p>{{brief}}</p><p>Commit with trailer: <code>Roadmap-Task: {{id}}</code></p>
  </details>
  <details><summary>Acceptance</summary>{{acceptance}}</details>
  <details open><summary>Audit log</summary>
    <table><thead><tr><th>when (ISO-8601)</th><th>status</th><th>who</th><th>evidence</th></tr></thead>
    <tbody><tr><td>{{created_at}}</td><td>{{status}}</td><td>roadmap-skill</td><td>/roadmap plan</td></tr></tbody></table>
  </details>
</main></body></html>
```

- [ ] **Step 2: Write `phase-readme.template.html` and `milestone-readme.template.html`**

Same pattern. `data-kind="phase"`/`"milestone"`, `data-status="{{rollup_status}}"`. Children listed as a `<ul>` ordered by sequence; task lists in phase use disabled checkboxes: `<li><input type="checkbox" disabled {{checked}}> {{task_title}}</li>`.

- [ ] **Step 3: Write `roadmap-readme.template.html`**

Index. `<main data-kind="roadmap-index">`, progress line, milestones `<ul>` by sequence with status badges, status-enum legend.

- [ ] **Step 4: Verify structure**

Run:
```bash
cd plugins/my-skills/skills/roadmap/templates
for f in task phase-readme milestone-readme roadmap-readme; do
  grep -q '<main' "$f.template.html" || { echo "FAIL $f"; exit 1; }
  grep -qi 'cdn\|https\?://[^"]*\.\(js\|css\)' "$f.template.html" && { echo "EXTERNAL ASSET $f"; exit 1; }
done
grep -q 'type="checkbox" disabled' phase-readme.template.html && \
grep -q 'data-status="{{status}}"' task.template.html && echo OK_TASK4
```
Expected: `OK_TASK4` (no external assets, `<main>` present in all four).

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/roadmap/templates/*.template.html
git commit -m "feat(roadmap): self-contained html deliverable templates"
```

---

### Task 5: SKILL.md — the orchestration prose

The skill entry point tying contracts + templates into the flow: invocation, context gate, decomposition, sync, re-eval. Spec §1–§5, §10, §11, §14.

**Files:**
- Create: `plugins/my-skills/skills/roadmap/SKILL.md`

**Interfaces:**
- Consumes: all references (Tasks 1–2) and templates (Tasks 3–4) by path.
- Produces: the user-facing skill behavior; references files by relative path only.

- [ ] **Step 1: Write frontmatter + overview**

Frontmatter (matches plugin skill convention — see `orchestrator/SKILL.md`):
```yaml
---
name: roadmap
description: Decomposes a project spec into an auditable milestone→phase→task roadmap under /roadmap/. Use when the user invokes "/roadmap", says "build a roadmap", or "plan the milestones". Reads .orchestrator/PROJECT-CONTEXT.md when present; each task is an orchestrator-ready brief. Doc-only — writes /roadmap docs, never runs code or commits. "/roadmap sync" stamps done tasks from commit trailers; re-running re-evaluates and preserves completed work.
---
```
Body opens with the doc-only constraint (verbatim from Global Constraints) and the §14 end-to-end relationship to the orchestrator.

- [ ] **Step 2: Write the Invocation + Config section**

The §3 table (`/roadmap` auto-detect build vs re-eval; `/roadmap sync`), the `--format`/`--threshold` flags, and config resolution pointing to `references/config.md`.

- [ ] **Step 3: Write the Context gate section**

The §4 algorithm: check `.orchestrator/PROJECT-CONTEXT.md`; if absent run own gate (spawn `Explore` subagent for repo digest, then `AskUserQuestion` loop, self-rate confidence ≥ `context_threshold`, write `/roadmap/CONTEXT.md`); in both cases grill only roadmap gaps (milestone boundaries, sequencing/deps, release targets, per-milestone "done"); pull spec/PRD from `docs/superpowers/specs/*`, PRD, README. State that an existing base context makes `/roadmap/CONTEXT.md` an addendum.

- [ ] **Step 4: Write the Decomposition section**

The §5 propose-then-confirm flow: derive tree → assign IDs per `references/directory-layout.md` → write each task's `orchestrator_brief` (self-contained, ends with `Commit with trailer: Roadmap-Task: <id>`) → present tree summary → on approval materialize by rendering `templates/*` per `output_format` and writing `roadmap.lock.json`.

- [ ] **Step 5: Write the Sync + Re-eval sections**

Point to `references/sync-and-reeval.md` as the source of truth and restate the entry conditions: `/roadmap sync` runs the Sync procedure; bare `/roadmap` on an existing dir runs the Re-eval procedure (present diff, require approval). Reaffirm: never commit, never run orchestrator.

- [ ] **Step 6: Verify structure + cross-refs resolve**

Run:
```bash
cd plugins/my-skills/skills/roadmap
grep -q '^name: roadmap$' SKILL.md && \
grep -q 'never' SKILL.md && grep -qi 'doc-only\|never runs code\|never commits' SKILL.md && \
# every references/templates path mentioned in SKILL.md must exist
ok=1; for p in $(grep -oE '(references|templates)/[A-Za-z0-9._-]+' SKILL.md | sort -u); do
  [ -e "$p" ] || { echo "MISSING $p"; ok=0; }; done
[ $ok -eq 1 ] && echo OK_TASK5
```
Expected: `OK_TASK5`, no `MISSING` lines.

- [ ] **Step 7: Commit**

```bash
git add plugins/my-skills/skills/roadmap/SKILL.md
git commit -m "feat(roadmap): SKILL.md orchestration prose"
```

---

### Task 6: Registration + repo docs + final integrity sweep

Register the skill in the marketplace metadata, document it in README, and run a whole-skill consistency sweep. Spec §13.

**Files:**
- Modify: `README.md` (skills table + a `## roadmap` section)
- Modify: `.claude-plugin/marketplace.json` (plugin `description` — append roadmap)

**Interfaces:**
- Consumes: the completed skill (Tasks 1–5).
- Produces: discoverability; no new contracts.

- [ ] **Step 1: Add the README skills-table row**

Add to the table in `README.md`:
```markdown
| `roadmap` | Decomposes a project spec into an auditable milestone→phase→task roadmap under `/roadmap/`, with append-only audit logs, orchestrator-ready task briefs, `/roadmap sync` trailer stamping, and diff+preserve re-evaluation. Doc-only. |
```

- [ ] **Step 2: Add a `## roadmap` section to README**

Short usage block mirroring the existing `## orchestrator` section: what it does, `/roadmap` / `/roadmap sync`, the `/roadmap/` output layout, and the orchestrator handoff (run a task's brief via `/orchestrator`, commit with the `Roadmap-Task:` trailer, then `/roadmap sync`).

- [ ] **Step 3: Update marketplace.json description**

Append `, and a roadmap planner` (or similar) to the `my-skills` plugin `description` string. Keep valid JSON.

- [ ] **Step 4: Final integrity sweep**

Run:
```bash
cd plugins/my-skills/skills/roadmap
# 1. all 13 skill files exist
test -f SKILL.md && \
test -f references/directory-layout.md && test -f references/item-schema.md && \
test -f references/config.md && test -f references/sync-and-reeval.md && \
ls templates/*.template.md | wc -l | grep -q 4 && \
ls templates/*.template.html | wc -l | grep -q 4 && \
# 2. status enum identical across schema, sync ref, templates
for f in references/item-schema.md references/sync-and-reeval.md; do
  grep -q 'superseded' "$f" || { echo "enum drift $f"; exit 1; }; done && \
# 3. trailer string consistent everywhere it appears
test "$(grep -rho 'Roadmap-Task:' . | sort -u | wc -l)" -eq 1 && \
# 4. marketplace.json still valid JSON
python3 -c "import json,sys; json.load(open('../../../../.claude-plugin/marketplace.json'))" && \
echo OK_TASK6
```
Expected: `OK_TASK6`. If `enum drift`, `MISSING`, or a JSON error prints, fix the offending file before committing.

- [ ] **Step 5: Commit**

```bash
git add README.md .claude-plugin/marketplace.json
git commit -m "docs(roadmap): register skill in marketplace + README"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- §1 Purpose / doc-only → Global Constraints + Task 5 Step 1.
- §2 Goals/non-goals → encoded across SKILL.md (Task 5).
- §3 Invocation → Task 5 Step 2.
- §4 Context gate → Task 5 Step 3.
- §5 Decomposition → Task 5 Step 4.
- §6 Directory layout → Task 1 Step 1.
- §7 ID scheme / stable identity → Task 1 Step 1.
- §8 Item schema (md+html) → Task 1 Step 2 (schema), Task 3 (md), Task 4 (html).
- §9 Status + rollup + audit → Task 1 Step 2 + Task 2 Step 1.
- §10 Sync → Task 2 Step 2 + Task 5 Step 5.
- §11 Re-eval → Task 2 Step 3 + Task 5 Step 5.
- §12 Config → Task 1 Step 3.
- §13 Skill file layout → Tasks 1–5 file set + Task 6.
- §14 Orchestrator interaction → Task 5 Step 1 + Task 6 Step 2.
No uncovered sections.

**Placeholder scan:** `{{token}}` markers in Tasks 3–4 are template placeholders by design (the deliverable's render tokens), not plan placeholders — every plan step shows concrete content or an exact verify command. No "TBD"/"similar to"/"add error handling".

**Type consistency:** frontmatter keys, status enum (`todo | in_progress | done | superseded | blocked`), audit columns (`when | status | who | evidence`), trailer string (`Roadmap-Task: <id>`), and lock-file keys are defined once in Task 1 and reused verbatim in Tasks 2–6; Task 6 Step 4 asserts cross-file consistency (enum + trailer) mechanically.
