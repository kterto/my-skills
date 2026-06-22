# User-Story Rename + Progress-Timeline Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the roadmap leaf `task` → `user-story` coherently across every contract hook, and wire the orchestrator to render `<plan>.progress.html` from `.progress.md` in html mode.

**Architecture:** The rename is a single atomic change across the roadmap skill (every hook — `kind`, `data-kind`, list token, commit trailer, lock `kind`, sync grep, render rule, index wording, filename — moves together so nothing desyncs); the design-prompts are re-synced separately; the progress wiring adds a terminal-state render step to the orchestrator SKILL. Doc/template deliverables — verification is structural grep (no code execution).

**Tech Stack:** Markdown + self-contained HTML templates, prose render rules. No build/runtime.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-06-22-userstory-rename-and-progress-wiring-design.md`.
- New roadmap-leaf contract values (exact): `kind: user-story`; `data-kind="user-story"`; template `templates/user-story.template.{md,html}`; list token `{{story_list_ordered_by_sequence}}`; commit trailer `Roadmap-Story: <id>`; display `User Story {{id}}`; index wording `stories done`.
- After the rename, a grep across `plugins/my-skills/skills/roadmap/` for any of `Roadmap-Task`, `data-kind="task"`, `kind: task`, `task_list_ordered_by_sequence`, `task.template`, `tasks done` MUST return nothing.
- ID scheme `NNN.M.T` and the leaf filename pattern `NNN.M.T-slug` are UNCHANGED. Navigation relative paths UNCHANGED.
- No back-compat migration (no existing roadmaps / lock-files).
- Progress wiring: `.progress.md` stays the source-of-truth append log (md, roles unchanged); in html mode the orchestrator renders `<plan-path-without-.md>.progress.html` from `templates/html/progress-timeline.template.html` at terminal states (READY_TO_COMMIT, READY_WITH_WARNINGS, STALLED/BLOCKED stops). md mode unchanged.
- Machine contract otherwise intact: `<main data-*>`, other `{{tokens}}`, status enums, `type="checkbox" disabled`, `<span class="badge">cycle N</span>`. Self-contained outputs (no external assets).
- Doc/template deliverables: "verification" = each task's grep checks. Each prints its `OK_TASKn` sentinel.

---

### Task 1: Roadmap rename `task` → `user-story` (atomic)

The whole roadmap rename in one coherent change. Spec §3.

**Files:**
- Rename + edit: `plugins/my-skills/skills/roadmap/templates/task.template.md` → `templates/user-story.template.md`
- Rename + edit: `plugins/my-skills/skills/roadmap/templates/task.template.html` → `templates/user-story.template.html`
- Modify: `plugins/my-skills/skills/roadmap/templates/phase-readme.template.md`
- Modify: `plugins/my-skills/skills/roadmap/templates/phase-readme.template.html`
- Modify: `plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.md`
- Modify: `plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.html`
- Modify: `plugins/my-skills/skills/roadmap/SKILL.md`
- Modify: `plugins/my-skills/skills/roadmap/references/item-schema.md`
- Modify: `plugins/my-skills/skills/roadmap/references/directory-layout.md`
- Modify: `plugins/my-skills/skills/roadmap/references/sync-and-reeval.md`
- Modify: `plugins/my-skills/skills/roadmap/references/config.md`
- Modify: `README.md`
- Modify: `.claude-plugin/marketplace.json` (only if it names the leaf "task")

**Interfaces:**
- Produces: the `user-story` / `{{story_list_ordered_by_sequence}}` / `Roadmap-Story:` hooks that Task 2 (prompts) cites.

- [ ] **Step 1: Rename the leaf template files (preserve history)**

```bash
cd /Volumes/ssd/Developer/my-skills/plugins/my-skills/skills/roadmap/templates
git mv task.template.md user-story.template.md
git mv task.template.html user-story.template.html
```

- [ ] **Step 2: Edit the renamed leaf templates**

In `user-story.template.md`: frontmatter `kind: task` → `kind: user-story`; both `Roadmap-Task: {{id}}` occurrences → `Roadmap-Story: {{id}}` (the `commit_trailer:` frontmatter value if present and the Brief body line). Leave all other tokens (`{{id}}`, `{{title}}`, `{{status}}`, `{{brief}}`, `{{acceptance}}`, audit seed row) intact.

In `user-story.template.html`: both `data-kind="task"` → `data-kind="user-story"`; the heading `Task {{id}}` (or equivalent display label) → `User Story {{id}}`; `Roadmap-Task: {{id}}` → `Roadmap-Story: {{id}}`. Keep the 5 `<main data-*>` attrs, breadcrumb nav, `.crumbs` CSS, audit table, and `<script>` intact.

- [ ] **Step 3: Edit phase templates (child token + wording)**

In `phase-readme.template.md` and `phase-readme.template.html`: `{{task_list_ordered_by_sequence}}` → `{{story_list_ordered_by_sequence}}`; any section heading/label "Tasks" referring to the children → "User stories" (e.g. `## Tasks (in execution order)` → `## User stories (in execution order)`; html `<summary>Tasks …` → `<summary>User stories …`). Do not touch the `type="checkbox" disabled` rows markup or the breadcrumb.

- [ ] **Step 4: Edit index templates (progress wording)**

In `roadmap-readme.template.md`: `{{done_count}}/{{total_count}} tasks done ({{pct}}%)` → `{{done_count}}/{{total_count}} stories done ({{pct}}%)`.
In `roadmap-readme.template.html`: both `tasks done` occurrences (the `progress__headline` "… of … tasks done" and `progress__label` "…/… tasks done (…%)") → `stories done`. Keep `{{done_count}}`/`{{total_count}}`/`{{pct}}` tokens.

- [ ] **Step 5: Edit SKILL.md**

In `SKILL.md`: decomposition prose "milestones → phases → tasks" / "task" leaf references → "user stories"; Step 4 render rule `{{task_list_ordered_by_sequence}}` → `{{story_list_ordered_by_sequence}}`, leaf link target wording and `data-kind="user-story"`, the trailer `Roadmap-Task:` → `Roadmap-Story:`; the template-table rows `templates/task.template.md|html` → `templates/user-story.template.md|html` (and the description "Task file" → "User-story file"); any "task file" → "user-story file".

- [ ] **Step 6: Edit the reference docs**

- `references/item-schema.md`: `kind: task` → `kind: user-story`; every `Roadmap-Task:` → `Roadmap-Story:`; "task file" → "user-story file"; Output-navigation "phase task rows" wording → "phase user-story rows" (path target `<NNN.M.T-slug>.<ext>` unchanged).
- `references/directory-layout.md`: the tree comment for the leaf and the ID-scheme example label mention "user story" (keep filename pattern `001.1.1-init-repo.<ext>`); lock-file `kind` example `"task"` → `"user-story"`.
- `references/sync-and-reeval.md`: all three `Roadmap-Task` occurrences → `Roadmap-Story` (incl. the `git log --grep 'Roadmap-Task:'` pattern → `'Roadmap-Story:'`); rollup wording "phase from tasks" → "phase from user stories"; any `kind` task references → user-story.
- `references/config.md`: "task file" → "user-story file" (the one incidental leaf mention).

- [ ] **Step 7: Edit README.md (+ marketplace.json if applicable)**

In `README.md`: skills-table row "milestone→phase→task" → "milestone→phase→user-story", "orchestrator-ready task briefs" → "orchestrator-ready user-story briefs"; the `## roadmap` section prose "nested milestones → phases → tasks" → "… → user stories", "Each task is an orchestrator-ready brief" → "Each user story is an orchestrator-ready brief"; usage "stamp matched tasks done" → "stamp matched stories done", "Open a task brief" → "Open a user-story brief", "marks the task `done`" → "marks the story `done`"; the trailer example `Roadmap-Task: 001.1.1` → `Roadmap-Story: 001.1.1`.
Check `.claude-plugin/marketplace.json`: if the `my-skills` plugin description names the roadmap leaf as "task", update to "user story"; otherwise leave it.

- [ ] **Step 8: Verify (atomic coherence)**

Run:
```bash
cd /Volumes/ssd/Developer/my-skills
ok=1
# zero stale hooks in the roadmap skill
stale=$(grep -rnoE 'Roadmap-Task|data-kind="task"|kind: task|task_list_ordered_by_sequence|task\.template|tasks done' plugins/my-skills/skills/roadmap) && { echo "STALE:"; echo "$stale"; ok=0; }
# new hooks present
grep -q 'kind: user-story' plugins/my-skills/skills/roadmap/templates/user-story.template.md || ok=0
grep -q 'data-kind="user-story"' plugins/my-skills/skills/roadmap/templates/user-story.template.html || ok=0
grep -q 'Roadmap-Story: {{id}}' plugins/my-skills/skills/roadmap/templates/user-story.template.md || ok=0
grep -q '{{story_list_ordered_by_sequence}}' plugins/my-skills/skills/roadmap/templates/phase-readme.template.md || ok=0
grep -q '{{story_list_ordered_by_sequence}}' plugins/my-skills/skills/roadmap/templates/phase-readme.template.html || ok=0
grep -q 'stories done' plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.md || ok=0
grep -q "grep 'Roadmap-Story:'" plugins/my-skills/skills/roadmap/references/sync-and-reeval.md || ok=0
# files renamed (old gone, new tracked)
git ls-files plugins/my-skills/skills/roadmap/templates/ | grep -q 'user-story.template.md' || ok=0
git ls-files plugins/my-skills/skills/roadmap/templates/ | grep -q 'task.template' && { echo "OLD TEMPLATE STILL TRACKED"; ok=0; }
# README trailer example updated
grep -q 'Roadmap-Story: 001.1.1' README.md || ok=0
grep -q 'Roadmap-Task' README.md && { echo "README STALE TRAILER"; ok=0; }
# machine contract intact on the leaf
grep -q 'data-created-at="{{created_at}}"' plugins/my-skills/skills/roadmap/templates/user-story.template.html || ok=0
grep -q 'class="crumbs"' plugins/my-skills/skills/roadmap/templates/user-story.template.html || ok=0
[ $ok -eq 1 ] && echo OK_TASK1
```
Expected: `OK_TASK1`, no `STALE`/`OLD`/`README STALE` output.

- [ ] **Step 9: Commit**

```bash
cd /Volumes/ssd/Developer/my-skills
git add -A plugins/my-skills/skills/roadmap README.md .claude-plugin/marketplace.json
git commit -m "refactor(roadmap): rename leaf task -> user-story (kind, trailer, token, docs)"
```
(`git add -A <paths>` here is scoped to the renamed/edited roadmap paths so the `git mv` rename is recorded; do not stage unrelated untracked dirs.)

---

### Task 2: Sync design-prompts to user-story naming

Keep the source-of-truth prompts aligned. Spec §3.2.

**Files:**
- Rename + edit: `docs/design-prompts/04-roadmap-task.md` → `docs/design-prompts/04-roadmap-user-story.md`
- Modify: `docs/design-prompts/03-roadmap-phase.md`

**Interfaces:**
- Consumes: the `user-story` hooks from Task 1.

- [ ] **Step 1: Rename the prompt file**

```bash
cd /Volumes/ssd/Developer/my-skills/docs/design-prompts
git mv 04-roadmap-task.md 04-roadmap-user-story.md
```

- [ ] **Step 2: Edit `04-roadmap-user-story.md`**

Replace leaf-naming throughout: "task" (the artifact) → "user story"; `data-kind="task"` → `data-kind="user-story"`; `Roadmap-Task: {{id}}` → `Roadmap-Story: {{id}}`; the `## Navigation` story-row target stays `<NNN.M.T-slug>.<ext>`; keep the `EDITORIAL DESIGN SYSTEM v1` block, the six `##` section headings, and all other tokens intact. (Do not rename the heading words "Role & context" etc.)

- [ ] **Step 3: Edit `03-roadmap-phase.md`**

In its `## Content & data contract` and `## Navigation`, the phase's child rows are user stories: `{{task_list_ordered_by_sequence}}` → `{{story_list_ordered_by_sequence}}`; "task" child wording → "user story".

- [ ] **Step 4: Verify**

Run:
```bash
cd /Volumes/ssd/Developer/my-skills/docs/design-prompts
ok=1
git ls-files | grep -q '04-roadmap-user-story.md' || ok=0
git ls-files | grep -q '04-roadmap-task.md' && { echo "OLD PROMPT TRACKED"; ok=0; }
grep -q 'data-kind="user-story"' 04-roadmap-user-story.md || ok=0
grep -q 'Roadmap-Story: {{id}}' 04-roadmap-user-story.md || ok=0
grep -q 'Roadmap-Task' 04-roadmap-user-story.md && { echo "STALE TRAILER 04"; ok=0; }
grep -q '{{story_list_ordered_by_sequence}}' 03-roadmap-phase.md || ok=0
grep -q 'task_list_ordered_by_sequence' 03-roadmap-phase.md && { echo "STALE TOKEN 03"; ok=0; }
# sentinel + anatomy intact on 04
grep -q 'EDITORIAL DESIGN SYSTEM v1' 04-roadmap-user-story.md || ok=0
for h in '## Role & context' '## Design system' '## Content & data contract' '## States & component gallery' '## Interactions' '## Guardrails'; do grep -qF "$h" 04-roadmap-user-story.md || { echo "MISSING $h"; ok=0; }; done
[ $ok -eq 1 ] && echo OK_TASK2
```
Expected: `OK_TASK2`.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ssd/Developer/my-skills
git add -A docs/design-prompts
git commit -m "docs(design-prompts): rename roadmap leaf prompt to user-story"
```

---

### Task 3: Wire the progress-timeline (orchestrator)

Render `<plan>.progress.html` from `.progress.md` in html mode at terminal states. Spec §4.

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator/SKILL.md`
- Modify: `plugins/my-skills/skills/orchestrator/references/artifact-format.md`

**Interfaces:**
- Consumes: the existing `templates/html/progress-timeline.template.html` scaffold (status pill classes `.pill--success|active|warning|danger|muted`).

- [ ] **Step 1: Add the render instruction to artifact-format.md**

In `references/artifact-format.md`, replace the sentence that currently reads
`` `progress-timeline.template.html` is provided for a future progress-as-HTML artifact; `.progress.md` remains markdown-only today. ``
with:
```markdown
`progress-timeline.template.html` is wired: in `html` mode the orchestrator renders `<plan-path-without-.md>.progress.html` from a plan's `.progress.md` append-log at each pipeline terminal state. `.progress.md` remains the markdown source-of-truth log (roles append to it); the html file is a regenerated read-only view.
```

- [ ] **Step 2: Add the render step to SKILL.md**

In orchestrator `SKILL.md`, add a subsection (place it in the "Spec eval + report" area, after Step 7b, titled `### Step 7c — Progress timeline (html mode)`):
```markdown
### Step 7c — Progress timeline (html mode)

When `output_format=html`, after the pipeline reaches a terminal state, render a progress timeline for the active plan:

1. Read the plan's `.progress.md` log entries (each entry is a role/action with a status word and an ISO-8601 timestamp).
2. Fill `templates/html/progress-timeline.template.html`: emit one timeline row per log entry (role → action/status → timestamp), mapping each status word to its pill class via the standard mapping (`success | active | warning | danger | muted` — done/PASS/APPROVED/READY_TO_COMMIT→success; in_progress/DRAFT→active; BELOW_FLOOR/READY_WITH_WARNINGS→warning; BLOCKED/REQUEST_CHANGES→danger; todo/superseded→muted). Fill the `<main data-*>` shell and the Related link to the plan.
3. Write the result to `<plan-path-without-.md>.progress.html` (e.g. `plans/feat/FEAT-003-slug.progress.html`).

This step ALSO runs at the STALLED/BLOCKED stop points (review-cycle limit, qa-cycle limit, tester BLOCKED, qa BLOCKED_STALE) so a halted run still produces a timeline. In `md` mode this step is skipped — `.progress.md` is the only progress artifact.
```
Add a one-line pointer at Step 7b and at the STALLED/BLOCKED stop messages: "If `output_format=html`, run Step 7c (progress timeline render)."

- [ ] **Step 3: Verify**

Run:
```bash
cd /Volumes/ssd/Developer/my-skills/plugins/my-skills/skills/orchestrator
ok=1
grep -q 'progress-timeline.template.html` is wired' references/artifact-format.md || ok=0
grep -q 'markdown-only today' references/artifact-format.md && { echo "STILL UNWIRED NOTE"; ok=0; }
grep -q '### Step 7c — Progress timeline' SKILL.md || ok=0
grep -q '.progress.html' SKILL.md || ok=0
grep -q 'templates/html/progress-timeline.template.html' SKILL.md || ok=0
[ $ok -eq 1 ] && echo OK_TASK3
```
Expected: `OK_TASK3`.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/ssd/Developer/my-skills
git add plugins/my-skills/skills/orchestrator/SKILL.md plugins/my-skills/skills/orchestrator/references/artifact-format.md
git commit -m "feat(orchestrator): wire progress-timeline html render at terminal states"
```

---

## Self-Review

**Spec coverage** (spec § → task):
- §3.1 contract values → Task 1 (Global Constraints carry exact values).
- §3.2 cascading edits → Task 1 (skill/refs/templates/README) + Task 2 (prompts).
- §3.3 sync-contract coherence → Task 1 Step 8 atomic verify (zero stale hooks + new trailer in sync grep).
- §4.1 wiring model → Task 3 Global Constraints + Step 2.
- §4.2 SKILL + artifact-format edits → Task 3.
- §4.3 md mode unchanged → Task 3 Step 2 ("in md mode this step is skipped").
- §5 files touched → Tasks 1–3 cover every listed path.
- §6 constraints → Task 1 Step 8 (contract intact, files renamed) + Task 3 (self-contained render).
No uncovered sections.

**Placeholder scan:** `{{token}}` strings are real contract hooks (must appear verbatim). `<NNN.M.T-slug>`/`<ext>`/`<plan-path-without-.md>` are documented convention syntax. No "TBD"/"similar to"/"add X".

**Consistency:** the new hook set (`user-story`, `{{story_list_ordered_by_sequence}}`, `Roadmap-Story:`, `stories done`, `user-story.template.*`) is defined once in Global Constraints and reused verbatim in Tasks 1–2; Task 1 Step 8 asserts zero stale `task` hooks remain, guaranteeing atomic coherence. Task 3's status→pill mapping matches the five tokens already in the progress-timeline scaffold (`--status-success|active|warning|danger|muted`).
