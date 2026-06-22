# User-Story Rename + Progress-Timeline Wiring — Design Spec

- **Date:** 2026-06-22
- **Status:** approved (design)
- **Author:** Kainã Terto
- **Related:** `plugins/my-skills/skills/roadmap/`, `plugins/my-skills/skills/orchestrator/`, `docs/design-prompts/`, `docs/superpowers/specs/2026-06-21-roadmap-skill-design.md`, `docs/superpowers/specs/2026-06-22-skill-output-navigation-design.md`

## 1. Purpose

Two changes to the existing skills:

**A. Rename the roadmap leaf `task` → `user story`.** The roadmap decomposes a project into milestones → phases → leaves. The leaf is renamed from "task" to "user story" because it is a still-sizable unit of scope that the **orchestrator** pipeline then breaks into smaller executable units it already calls "tasks". Keeping "task" only at the orchestrator's granularity removes the term collision.

**B. Wire the progress-timeline template.** The orchestrator's `progress-timeline.template.html` exists but is unwired (`.progress.md` is markdown-only). Wire it so that, in html mode, the orchestrator renders a `<plan>.progress.html` timeline from the plan's `.progress.md` append-log.

## 2. Goals & non-goals

### Goals
- Rename the roadmap leaf concept to "user story" everywhere in the roadmap skill, consistently across every contract hook (kind, data-kind, filename, list token, commit trailer, index wording, prompts).
- Wire progress-timeline so html-mode pipelines emit a rendered progress view, without changing role behavior or the `.progress.md` log contract.

### Non-goals
- No change to the ID scheme (`NNN.M.T` stays — positional, leaf is still the 3rd level).
- No back-compat migration (no real roadmaps exist yet; no old `kind: task` lock-files in the wild).
- No change to the orchestrator's own internal "task" terminology (its plans still break into tasks).
- No change to `.progress.md` as the source-of-truth log; no role-template edits for wiring.

## 3. Rename: `task` → `user-story`

### 3.1 Contract values (new)
| Aspect | Old | New |
|---|---|---|
| `kind` / `data-kind` | `task` | `user-story` |
| template file | `templates/task.template.{md,html}` | `templates/user-story.template.{md,html}` |
| child-list token | `{{task_list_ordered_by_sequence}}` | `{{story_list_ordered_by_sequence}}` |
| commit trailer | `Roadmap-Task: <id>` | `Roadmap-Story: <id>` |
| index progress wording | `… tasks done` | `… stories done` |
| display label | "Task {{id}}" | "User Story {{id}}" |
| design-prompt file | `docs/design-prompts/04-roadmap-task.md` | `docs/design-prompts/04-roadmap-user-story.md` |

The leaf still carries `orchestrator_brief`, `spec_refs`, `depends_on`, `sequence`, and the `## Brief` / `## Acceptance` / `## Audit log` body sections — unchanged except the trailer line inside Brief becomes `Commit with trailer: Roadmap-Story: {{id}}`.

### 3.2 Cascading edits
- **SKILL.md** (roadmap): decomposition prose (milestones → phases → user stories), Step 4 render rule (`{{story_list_ordered_by_sequence}}`, leaf file naming, `data-kind="user-story"`), template-table row (`user-story.template.*`).
- **references/item-schema.md**: leaf frontmatter `kind: user-story`; html rules; the audit/trailer line; "Output navigation" — phase children are user-story rows linking to `<NNN.M.T-slug>.<ext>` (path scheme unchanged).
- **references/directory-layout.md**: tree comment + ID-scheme example mention "user story" for the leaf (filename pattern `NNN.M.T-slug` unchanged); lock-file `kind` example `user-story`.
- **references/sync-and-reeval.md**: trailer grep `Roadmap-Story:`; the `git log --grep` example; rollup wording (phase rolls up from user stories); kind references.
- **references/config.md**: only if it references "task" substantively (verify; likely incidental — leave non-leaf matches like "context" untouched).
- **templates/phase-readme.template.{md,html}**: child section heading "User stories (in execution order)"; token `{{story_list_ordered_by_sequence}}`; rollup over user stories.
- **templates/roadmap-readme.template.{md,html}**: progress wording "stories done"; legend.
- **templates/user-story.template.{md,html}** (renamed): `kind/data-kind="user-story"`, display "User Story {{id}}", trailer `Roadmap-Story: {{id}}`, breadcrumb (html) unchanged in shape, audit seed row.
- **README.md** + **.claude-plugin/marketplace.json**: roadmap description wording if it names "task".
- **docs/design-prompts/04-roadmap-user-story.md** (renamed): content reflects user-story naming, `data-kind="user-story"`, trailer `Roadmap-Story: {{id}}`, `## Navigation` story-row target. Update any sibling prompt that references the leaf (e.g. `03-roadmap-phase.md` child-row wording → user-story).

### 3.3 Sync-contract coherence
The trailer (`Roadmap-Story:`), the sync `git log --grep` pattern, the render rule that writes the trailer into each leaf's Brief, and the lock-file `kind` all change **together** so nothing desyncs. After this change a commit must carry `Roadmap-Story: <id>` for `/roadmap sync` to stamp the story `done`.

## 4. Progress-timeline wiring

### 4.1 Model
- `.progress.md` remains the per-plan source-of-truth append log (always markdown; the architect creates it, coder/reviewer/qa append). **Roles are unchanged.**
- When `output_format=html`, the orchestrator (caller session) renders `<plan-path>.progress.html` from `templates/html/progress-timeline.template.html`, parsing the `.progress.md` log entries (role → status/action → ISO-8601 timestamp) into the timeline component.
- Rendering happens at each pipeline **terminal state**: `READY_TO_COMMIT`, `READY_WITH_WARNINGS`, and the STALLED/BLOCKED stops (so a halted run still produces a timeline of what happened).
- `.progress.html` is a rendered **view**, not a log the roles write to; it is regenerated wholesale from `.progress.md` each time.

### 4.2 SKILL edits (orchestrator)
- Add a "Render progress timeline (html mode)" step invoked at terminal states (in/near Step 7b for success states; and at each STALLED/BLOCKED stop). It reads the active plan's `.progress.md`, fills `progress-timeline.template.html`, and writes `<plan-path-without-.md>.progress.html` (e.g. `plans/feat/FEAT-003-x.progress.html`). The Related nav in the scaffold links to the plan (already present).
- `references/artifact-format.md`: update the line that says progress-timeline is "future / `.progress.md` remains markdown-only today" to state it is wired — in html mode the orchestrator renders `<plan>.progress.html` from `.progress.md` at pipeline terminal states; `.progress.md` remains the source log.

### 4.3 md mode
No progress html in md mode — `.progress.md` only. The wiring is html-mode-additive.

## 5. Files touched (summary)

**Rename (roadmap):** `SKILL.md`; `references/{item-schema,directory-layout,sync-and-reeval}.md` (+ `config.md` only if it substantively names the leaf); `templates/{roadmap-readme,phase-readme}.template.{md,html}`; rename `task.template.{md,html}`→`user-story.template.{md,html}` (edit contents); `README.md`; `.claude-plugin/marketplace.json` (if applicable); rename `docs/design-prompts/04-roadmap-task.md`→`04-roadmap-user-story.md` (edit), edit `03-roadmap-phase.md` child-row wording.

**Progress wiring (orchestrator):** `SKILL.md` (terminal-state render step); `references/artifact-format.md` (wire note). The 7 scaffolds are unchanged (progress-timeline scaffold already exists from the design-to-code pass).

## 6. Constraints preserved

- **Machine-contract coherence:** every renamed hook (`data-kind`, list token, trailer, lock `kind`, sync grep, render rule) moves together; a post-change `git grep 'Roadmap-Task'` / `data-kind="task"` / `task_list_ordered_by_sequence` in the roadmap skill returns nothing.
- **Self-contained outputs:** progress.html is a self-contained render (no external assets), like every other artifact.
- **Navigation intact:** phase→leaf links now target user-story files; the relative-path scheme is unchanged (filenames keep `NNN.M.T-slug`).
- **No role/pipeline behavior change** beyond the additive html progress render; `.progress.md` log contract untouched.
- **Design-prompt source of truth** stays in sync (renamed/edited prompt + sentinel/anatomy preserved).

## 7. Open considerations (resolved)

- **Naming:** `user-story` (kind/data-kind/file) + trailer `Roadmap-Story:`. ✅
- **Progress wiring:** render `<plan>.progress.html` from `.progress.md` at terminal states, html mode only, roles unchanged. ✅
- **ID scheme / back-compat:** unchanged; no migration. ✅
- **Orchestrator "task":** unchanged (its plans still break into tasks). ✅
