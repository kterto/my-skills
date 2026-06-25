# Design Contract — Skill HTML Templates

Translating the 11 Claude-design files in `docs/design-files/*.html` into the actual self-contained
`.template.html` files for the `roadmap` and `orchestrator` skills.

- **Run scope:** whole flow (11 files), one shared design system ("Editorial Design System v1").
- **Target "stack":** self-contained HTML template files inside the skills — NOT a foreign app stack.
  The "code" output is template HTML that preserves each template's machine contract.
- **Sources are self-contained:** 0 external assets in every file (verified). Keep it that way.

## The five channels (assessment)

1. **Tokens (CSS `:root`)** — the editorial design system: ivory/ink light + dark via
   `prefers-color-scheme`, indigo accent, serif/sans/mono stacks. KEEP the entire `<style>` block as-is
   per file (it is the visual deliverable). Remove only gallery-scoped CSS rules (see strip rules).
2. **Reviewer comments** — the `<!-- … -->` section banners ("1. Page header", etc.) and the gallery
   banner ("Component gallery — design review only … removed at render"). The gallery comment is an
   explicit instruction to strip. KEEP the structural section banners.
3. **Component-gallery states** — each file has exactly one `<details data-gallery>` block (verified:
   1 per file). STRIP it. The single rendered artifact already shows the real state; the gallery is
   design-review scaffolding only.
4. **Vanilla JS** — one `<script>` per file. KEEP it. It drives collapsible sections and, for the
   status-bearing artifacts, maps the rendered `data-status` to the correct status-pill token/class
   (e.g. task.html `STATUS_TO_TOKEN`). It targets the real artifact (`main[data-kind=…]`,
   `.h1__pill .pill`), NOT the gallery, so stripping the gallery does not break it.
5. **Cross-references** — all 11 share Editorial Design System v1 (same tokens/components). They must
   continue to look like one framework; do not diverge styling during translation.

## Shared transform (every file)

1. **Strip the gallery:** remove the `<details data-gallery> … </details>` block and its preceding
   "Component gallery — design review only" comment banner.
2. **Strip dead gallery CSS:** remove gallery-only rules — `[data-gallery]`, `.gallery__group`,
   `.gallery__*`, and `.cardstub*` (cardstub markup exists only inside the gallery). KEEP `.pill` and
   all other rules (the real artifact uses them — plan.html even labels `.pill` "gallery / general use").
3. **Keep:** the full `<head>`/`<style>` editorial system, the `<main data-*>` shell, every
   `<details>`/`<section>` of the real artifact, the section-banner comments, and the `<script>`.
4. **Self-contained:** confirm no external URL was introduced. No CDN, no web-font URL.
5. **Place** at the target path (below).

## Per-skill rules

### Roadmap (tokenized templates — these are filled by `{{token}}` substitution)
The roadmap skill renders by substituting `{{tokens}}` and appending audit rows programmatically.
The design files already inject lists via the correct tokens
(`{{milestone_list_ordered_by_sequence}}`, `{{phase_list_ordered_by_sequence}}`,
`{{task_list_ordered_by_sequence}}`) in the REAL artifact — keep those as the live injection points.
**Restore the tokenized audit seed row** (the design replaced it with literal sample rows): the
audit-log `<tbody>` of the real artifact must be exactly ONE seed row matching the existing template
contract, with the design's table styling:

- task: `<tr><td>{{created_at}}</td><td>…pill {{status}}…</td><td>roadmap-skill</td><td>/roadmap plan</td></tr>`
- milestone / phase: same, but status cell uses `{{rollup_status}}`.
- index: no audit log (it is the progress dashboard) — nothing to restore.

Any other literal sample data in the real artifact (header crumbs, dates, "planner", etc.) that is NOT
a token must be replaced by its corresponding `{{token}}` from the existing template. The complete
token set per file is the binding contract (see Per-file table). The rendered status pill is driven by
the JS from `data-status`; keep the JS.

### Orchestrator (styled exemplar scaffolds — "templates + light wiring")
Orchestrator has no `{{token}}` convention; roles emit HTML inline. These templates are concrete
styled scaffolds a role fills by example. **Keep the representative sample content** (it illustrates
the structure) — do NOT tokenize. Only strip the gallery, keep the `<main data-*>` 5-attribute
contract, `<details><summary>` sections, disabled checkboxes (plan), and the
`<span class="badge">cycle N</span>` badge. Place under a new `templates/html/` dir and add a pointer
in `artifact-format.md` (see Wiring).

## Per-file mapping + contract hooks to preserve

| Source (`docs/design-files/`) | Target | Live injection / contract hooks to KEEP |
|---|---|---|
| roadmap-index.html | `roadmap/templates/roadmap-readme.template.html` | `<main data-kind="roadmap-index">`; `{{done_count}} {{total_count}} {{pct}} {{milestone_list_ordered_by_sequence}}` |
| milestone.html | `roadmap/templates/milestone-readme.template.html` | `<main data-id="{{id}}" data-kind="milestone" data-status="{{rollup_status}}" data-created-at="{{created_at}}" data-updated-at="{{updated_at}}">`; `{{phase_list_ordered_by_sequence}}`, `{{sequence}} {{depends_on}} {{title}}`; audit seed row (rollup_status); columns `when (ISO-8601) \| status \| who \| evidence` |
| phase.html | `roadmap/templates/phase-readme.template.html` | as milestone but `data-kind="phase"`, `{{task_list_ordered_by_sequence}}`, `{{milestone}}`, `type="checkbox" disabled` rows; audit seed row (rollup_status) |
| task.html | `roadmap/templates/task.template.html` | `<main … data-kind="task" data-status="{{status}}" …5 attrs>`; `{{brief}} {{acceptance}} {{milestone}} {{phase}} {{sequence}} {{depends_on}} {{spec_refs}} {{title}}`; `Roadmap-Task: {{id}}`; audit seed row (status); KEEP status-pill JS |
| spec.html | `orchestrator/templates/html/spec.template.html` | `<main data-id data-status data-created-at data-updated-at data-cycle>`; status `READY_FOR_PLANNING\|DRAFT`; `<details><summary>`; cycle badge. Keep sample content. |
| plan.html | `orchestrator/templates/html/plan.template.html` | 5 `data-*`; `type="checkbox" disabled` task list; `<span class="badge">cycle N</span>`; no status pill (architect). Keep sample. |
| test-report.html | `orchestrator/templates/html/test-report.template.html` | 5 `data-*`; status `PASS\|BELOW_FLOOR\|BLOCKED`; coverage bar. Keep sample. |
| code-review.html | `orchestrator/templates/html/code-review.template.html` | 5 `data-*`; status `APPROVED\|REQUEST_CHANGES`; severity groups; cycle badge. Keep sample. |
| qa-report.html | `orchestrator/templates/html/qa-report.template.html` | 5 `data-*`; status `READY_TO_COMMIT\|BLOCKED\|READY_WITH_WARNINGS`; gate grid; cycle badge. Keep sample. |
| progress-timeline.html | `orchestrator/templates/html/progress-timeline.template.html` | 5 `data-*`; vertical timeline. **New artifact** — `.progress.md` is md-only; placing the template only, NOT wiring role emission (out of scope, noted in artifact-format.md). |
| final-report.html | `orchestrator/templates/html/final-report.template.html` | 5 `data-*`; status `READY_TO_COMMIT\|READY_WITH_WARNINGS`; commit-message + PR-message `<pre>` blocks must stay copy-pasteable plain text; spec-eval `PASS\|ISSUES\|SKIPPED`. Keep sample. |

## Wiring (orchestrator only)

Append to `plugins/my-skills/skills/orchestrator/references/artifact-format.md`, in the `## html mode`
section, a pointer:

> **Styled templates.** In `html` mode, each role fills the matching self-contained scaffold in
> `templates/html/<artifact>.template.html` (spec, plan, test-report, code-review, qa-report,
> final-report). These define the Editorial Design System v1 look and the required `<main data-*>`
> shell; roles replace the sample content with the real artifact content, preserving the `data-*`
> attributes, `<details><summary>` sections, disabled checkboxes, and the `<span class="badge">cycle N</span>`
> badge. `progress-timeline.template.html` is provided for a future progress-as-HTML artifact;
> `.progress.md` remains markdown-only today.

No role-template rewrites and no `output_format` logic changes in this pass — the pointer makes the
scaffolds discoverable and authoritative for styling without changing pipeline behavior.

## Coverage checklist (Phase 3 gate)

- [ ] All 11 files placed at their target paths; old roadmap 4 `.template.html` overwritten.
- [ ] Gallery `<details data-gallery>` removed from all 11; `grep -rl 'data-gallery' targets` → none.
- [ ] Gallery-only CSS removed; `.pill` and real-artifact CSS intact (spot-render check).
- [ ] Roadmap tokens: each file retains its exact `{{token}}` set; audit `<tbody>` is the single
      tokenized seed row (not literal sample rows).
- [ ] Roadmap `<main>` 5-attribute contract intact (milestone/phase/task); index `data-kind="roadmap-index"`.
- [ ] Roadmap JS retained (status-pill sync, collapsible).
- [ ] Orchestrator: 5 `data-*` on `<main>`, `<details><summary>`, disabled checkboxes (plan),
      `<span class="badge">cycle N</span>` present; sample content kept.
- [ ] `artifact-format.md` pointer added.
- [ ] No external assets in any output (no CDN / web-font URL).
- [ ] No remaining `C{n}` cycle-badge wording; cycle badge is `cycle N`.
