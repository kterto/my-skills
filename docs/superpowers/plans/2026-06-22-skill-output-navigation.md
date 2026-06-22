# Skill Output Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add relative-link navigation between dependent skill outputs — roadmap tree (down-links + ID-chain breadcrumbs) and orchestrator dependency cross-links — in both md and html, preserving every machine contract.

**Architecture:** Roadmap down-links are emitted by the skill when it fills the child-list tokens (a render rule in `SKILL.md` + `references/item-schema.md`); roadmap breadcrumbs are template-static markup added to the milestone/phase/task templates (md+html). Orchestrator cross-links are a "Related" nav region in the 7 html scaffolds, filled by the roles from the related artifact paths they already hold (a render rule in `artifact-format.md` + role templates). Design-prompts are updated to keep the source of truth in sync.

**Tech Stack:** Markdown + self-contained HTML templates, prose render rules. No build, no runtime. Verification is structural (grep for the added nav markup/rules + confirmation the machine contract is untouched).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-06-22-skill-output-navigation-design.md`.
- Relative links only — no external assets, no CDN, no JS navigation. Self-contained outputs stay self-contained.
- Machine contract untouched: `<main data-*>`, `{{token}}` placeholders, status enums, `type="checkbox" disabled`, `<span class="badge">cycle N</span>`. Links wrap labels; never replace a contract hook.
- Breadcrumbs = ID chain + a `Roadmap` home link; current item is plain text (not a link). No ancestor-title injection.
- Roadmap on-disk layout / link targets (exact): index `/roadmap/README.<ext>`; milestone `<NNN-slug>/README.<ext>`; phase `<NNN.M-slug>/README.<ext>`; task `<NNN.M.T-slug>.<ext>`. `<ext>` = `md` or `html` per `output_format`.
- Breadcrumb hrefs (exact, per level): milestone → `Roadmap=../README.<ext>`; phase → `Roadmap=../../README.<ext>`, `{{milestone}}=../README.<ext>`; task → `Roadmap=../../README.<ext>`, `{{milestone}}=../README.<ext>`, `{{phase}}=README.<ext>`.
- Orchestrator artifact dirs: specs `plans/specs/`, plans `plans/feat/`, test `plans/test/`, code-review `plans/code-review/`, qa `plans/qa/`. Related links are relative across these sibling dirs.
- Orchestrator Related edges: plan→spec; test→plan; code-review→plan; qa→plan; final-report→{spec,plan,test,code-review,qa}; spec→none.
- These are doc/template deliverables: "verification" = each task's grep checks (no unit tests). Each prints its `OK_TASKn` sentinel.

---

### Task 1: Roadmap render rules + reference docs

The contract for roadmap navigation: the child-link render rule (skill-side) and the breadcrumb/target convention (reference docs). Spec §3.2–§3.4.

**Files:**
- Modify: `plugins/my-skills/skills/roadmap/SKILL.md` (Step 4 — Materialize)
- Modify: `plugins/my-skills/skills/roadmap/references/item-schema.md` (new "Output navigation" subsection)
- Modify: `plugins/my-skills/skills/roadmap/references/directory-layout.md` (link-target naming note)

**Interfaces:**
- Produces: the `<ext>` convention and the per-level link/breadcrumb targets that Task 2 (templates) and Task 3 (prompts) cite verbatim.

- [ ] **Step 1: Add the child-link render rule to SKILL.md Step 4**

In `SKILL.md`, Step 4 (Materialize), after item "1. Render each artifact…", insert a new numbered item:

```markdown
2. **Child navigation links.** When filling the child-list tokens, render each child row as a relative link (`<ext>` = `html` in html mode, `md` in md mode):
   - index `{{milestone_list_ordered_by_sequence}}` → each milestone links to `<NNN-slug>/README.<ext>`
   - milestone `{{phase_list_ordered_by_sequence}}` → each phase links to `<NNN.M-slug>/README.<ext>`
   - phase `{{task_list_ordered_by_sequence}}` → each task links to `<NNN.M.T-slug>.<ext>`
   In md: `- [<id> — <title>](<target>) <status>`. In html: wrap the row label in `<a href="<target>">…</a>`, keeping the status pill and (phase task rows) the `<input type="checkbox" disabled>` outside the link. `<NNN-slug>` etc. is the same slug used to name the child's directory/file.
```

Renumber the following items (old 2→3, old 3→4).

- [ ] **Step 2: Add the "Output navigation" subsection to item-schema.md**

Append to `references/item-schema.md`:

```markdown
## Output navigation

Every rendered item links to its neighbours with **relative** links (md and html). `<ext>` = `md` or `html` per `output_format`.

**Down-links (children)** are emitted by the skill when it fills the child-list tokens (see SKILL.md Step 4): index→`<NNN-slug>/README.<ext>`, milestone→`<NNN.M-slug>/README.<ext>`, phase→`<NNN.M.T-slug>.<ext>`.

**Up-links (breadcrumb)** are template-static, near the top of each non-root item, showing the ID chain plus a `Roadmap` home link (current item unlinked):

| Level | Breadcrumb |
|---|---|
| index | none (root) |
| milestone | `Roadmap`(`../README.<ext>`) / `{{id}}` |
| phase | `Roadmap`(`../../README.<ext>`) / `{{milestone}}`(`../README.<ext>`) / `{{id}}` |
| task | `Roadmap`(`../../README.<ext>`) / `{{milestone}}`(`../README.<ext>`) / `{{phase}}`(`README.<ext>`) / `{{id}}` |

Links are plain relative hrefs; an unrendered target simply 404s (no script error).
```

- [ ] **Step 3: Add the link-target note to directory-layout.md**

In `references/directory-layout.md`, after the "Artifact format" paragraph, append:

```markdown
### Navigation link targets

Items link to each other by relative path derived from the ID scheme: a milestone is `<NNN-slug>/README.<ext>`, a phase is `<NNN.M-slug>/README.<ext>`, a task is `<NNN.M.T-slug>.<ext>` (`<ext>` per `output_format`). See `item-schema.md` → Output navigation.
```

- [ ] **Step 4: Verify**

Run:
```bash
cd plugins/my-skills/skills/roadmap
grep -q 'Child navigation links' SKILL.md && \
grep -q '<NNN.M.T-slug>.<ext>' SKILL.md && \
grep -q '## Output navigation' references/item-schema.md && \
grep -q '`Roadmap`(`../../README.<ext>`)' references/item-schema.md && \
grep -q 'Navigation link targets' references/directory-layout.md && \
echo OK_TASK1
```
Expected: `OK_TASK1`.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/roadmap/SKILL.md plugins/my-skills/skills/roadmap/references/item-schema.md plugins/my-skills/skills/roadmap/references/directory-layout.md
git commit -m "feat(roadmap): navigation render rule + reference docs"
```

---

### Task 2: Roadmap breadcrumb regions in templates

Template-static breadcrumbs on milestone/phase/task, both formats. Spec §3.3. The index gets no breadcrumb (root); child-link wrapping is the skill's job (Task 1), so templates need no per-row link markup.

**Files:**
- Modify: `plugins/my-skills/skills/roadmap/templates/milestone-readme.template.md`
- Modify: `plugins/my-skills/skills/roadmap/templates/phase-readme.template.md`
- Modify: `plugins/my-skills/skills/roadmap/templates/task.template.md`
- Modify: `plugins/my-skills/skills/roadmap/templates/milestone-readme.template.html`
- Modify: `plugins/my-skills/skills/roadmap/templates/phase-readme.template.html`
- Modify: `plugins/my-skills/skills/roadmap/templates/task.template.html`

**Interfaces:**
- Consumes: breadcrumb hrefs from Task 1 / Global Constraints (exact).

- [ ] **Step 1: Add md breadcrumbs**

In each md template, insert the breadcrumb line immediately after the closing frontmatter `---`, before the first `#`/`##` heading:
- `milestone-readme.template.md`: `[Roadmap](../README.md) / {{id}}`
- `phase-readme.template.md`: `[Roadmap](../../README.md) / [{{milestone}}](../README.md) / {{id}}`
- `task.template.md`: `[Roadmap](../../README.md) / [{{milestone}}](../README.md) / [{{phase}}](README.md) / {{id}}`

Add a blank line after the breadcrumb.

- [ ] **Step 2: Add html breadcrumbs + crumb style**

In each html template, FIRST read the file to find the existing accent/muted CSS custom-property names (the editorial design system already defines them, e.g. `--accent`, a muted text token). Add a `.crumbs` rule to the `<style>` block using those existing tokens (do NOT invent colors):

```css
.crumbs { font-size: 0.85rem; margin: 0 0 1.25rem; color: var(--ink-muted, #6b6b6b); }
.crumbs a { color: var(--accent); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.crumbs .sep { opacity: 0.5; margin: 0 0.4em; }
```
(Use the file's real muted-token name in the `var(--…, fallback)`; keep the fallback.)

Then insert the breadcrumb `<nav>` as the FIRST child inside `<main>` (before the existing header), per level:
- `milestone-readme.template.html`:
  `<nav class="crumbs"><a href="../README.html">Roadmap</a><span class="sep">/</span><span>{{id}}</span></nav>`
- `phase-readme.template.html`:
  `<nav class="crumbs"><a href="../../README.html">Roadmap</a><span class="sep">/</span><a href="../README.html">{{milestone}}</a><span class="sep">/</span><span>{{id}}</span></nav>`
- `task.template.html`:
  `<nav class="crumbs"><a href="../../README.html">Roadmap</a><span class="sep">/</span><a href="../README.html">{{milestone}}</a><span class="sep">/</span><a href="README.html">{{phase}}</a><span class="sep">/</span><span>{{id}}</span></nav>`

- [ ] **Step 3: Verify**

Run:
```bash
cd plugins/my-skills/skills/roadmap/templates
ok=1
grep -q '\[Roadmap\](../README.md) / {{id}}' milestone-readme.template.md || ok=0
grep -q '\[Roadmap\](../../README.md) / \[{{milestone}}\](../README.md) / {{id}}' phase-readme.template.md || ok=0
grep -q '\[{{phase}}\](README.md) / {{id}}' task.template.md || ok=0
grep -q 'href="../README.html">Roadmap' milestone-readme.template.html || ok=0
grep -q 'href="../../README.html">Roadmap' phase-readme.template.html || ok=0
grep -q 'href="README.html">{{milestone}}\|href="README.html">{{phase}}' task.template.html || ok=0
for f in milestone-readme phase-readme task; do grep -q 'class="crumbs"' "$f.template.html" || { echo "no crumbs $f"; ok=0; }; done
# machine contract intact
grep -q 'data-kind="task"' task.template.html && grep -q 'Roadmap-Task: {{id}}' task.template.html || ok=0
grep -q 'type="checkbox" disabled' phase-readme.template.html || ok=0
[ $ok -eq 1 ] && echo OK_TASK2
```
Expected: `OK_TASK2`.

- [ ] **Step 4: Commit**

```bash
git add plugins/my-skills/skills/roadmap/templates/milestone-readme.template.md plugins/my-skills/skills/roadmap/templates/phase-readme.template.md plugins/my-skills/skills/roadmap/templates/task.template.md plugins/my-skills/skills/roadmap/templates/milestone-readme.template.html plugins/my-skills/skills/roadmap/templates/phase-readme.template.html plugins/my-skills/skills/roadmap/templates/task.template.html
git commit -m "feat(roadmap): breadcrumb navigation in templates (md+html)"
```

---

### Task 3: Orchestrator "Related" render rule

The contract for orchestrator cross-links: the render rule in `artifact-format.md`, the per-role fill instruction, and the Step 7 composer. Spec §4.2–§4.3.

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator/references/artifact-format.md`
- Modify: `plugins/my-skills/skills/orchestrator/templates/architect.md`
- Modify: `plugins/my-skills/skills/orchestrator/templates/tester.md`
- Modify: `plugins/my-skills/skills/orchestrator/templates/reviewer.md`
- Modify: `plugins/my-skills/skills/orchestrator/templates/qa.md`
- Modify: `plugins/my-skills/skills/orchestrator/SKILL.md` (Step 7b composer)

**Interfaces:**
- Consumes: orchestrator artifact dirs + Related edges from Global Constraints.
- Produces: the Related convention the Task 4 scaffolds present.

- [ ] **Step 1: Add the Related render rule to artifact-format.md**

In `references/artifact-format.md`, add a subsection (after the html-mode "Styled templates" pointer):

```markdown
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
```

- [ ] **Step 2: Add the per-role fill instruction**

In each role template, add one line in its artifact-emission section:
- `architect.md`: "In the rendered plan, fill the Related region with a relative link to the source spec (and source CR/QA for fix/qa plans), per `artifact-format.md` → Related navigation."
- `tester.md`, `reviewer.md`, `qa.md`: "In the rendered report, fill the Related region with a relative link to the plan, per `artifact-format.md` → Related navigation."

- [ ] **Step 3: Add the composer instruction to SKILL.md Step 7b**

In orchestrator `SKILL.md`, Step 7b (final report composer), add a line: "When `output_format=html`, the html final report fills its Related region with relative links to the spec, plan, test report, code review, and qa report (per `artifact-format.md` → Related navigation)."

- [ ] **Step 4: Verify**

Run:
```bash
cd plugins/my-skills/skills/orchestrator
ok=1
grep -q '## Related navigation' references/artifact-format.md && grep -q 'class="related"' references/artifact-format.md || ok=0
grep -q 'Related region' templates/architect.md || ok=0
for f in tester reviewer qa; do grep -q 'Related region' templates/$f.md || { echo "no rule $f"; ok=0; }; done
grep -qi 'Related region' SKILL.md || ok=0
[ $ok -eq 1 ] && echo OK_TASK3
```
Expected: `OK_TASK3`.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/references/artifact-format.md plugins/my-skills/skills/orchestrator/templates/architect.md plugins/my-skills/skills/orchestrator/templates/tester.md plugins/my-skills/skills/orchestrator/templates/reviewer.md plugins/my-skills/skills/orchestrator/templates/qa.md plugins/my-skills/skills/orchestrator/SKILL.md
git commit -m "feat(orchestrator): Related cross-link render rule + role instructions"
```

---

### Task 4: Orchestrator "Related" region in html scaffolds

Add the Related nav region to the 7 styled scaffolds so roles have a concrete slot to fill. Spec §4.2.

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator/templates/html/spec.template.html`
- Modify: `plugins/my-skills/skills/orchestrator/templates/html/plan.template.html`
- Modify: `plugins/my-skills/skills/orchestrator/templates/html/test-report.template.html`
- Modify: `plugins/my-skills/skills/orchestrator/templates/html/code-review.template.html`
- Modify: `plugins/my-skills/skills/orchestrator/templates/html/qa-report.template.html`
- Modify: `plugins/my-skills/skills/orchestrator/templates/html/final-report.template.html`
- Modify: `plugins/my-skills/skills/orchestrator/templates/html/progress-timeline.template.html`

**Interfaces:**
- Consumes: the Related convention (Task 3).

- [ ] **Step 1: Add a `.related` style + region to each scaffold**

In each of the 7 html scaffolds, FIRST read the file for the existing accent/muted token names. Add a `.related` rule to the `<style>` block (reuse existing tokens):

```css
.related { font-size: 0.85rem; margin: 1.5rem 0 0; padding-top: 0.75rem; border-top: 1px solid var(--rule, #e3e0d8); }
.related .label { color: var(--ink-muted, #6b6b6b); margin-right: 0.5em; }
.related a { color: var(--accent); text-decoration: none; }
.related a:hover { text-decoration: underline; }
.related .sep { opacity: 0.5; margin: 0 0.4em; }
```

Then insert a Related `<nav>` as the LAST child inside `<main>` (after the existing content, before `</main>`), with representative sample links matching that artifact's edges:
- `spec.template.html`: `<nav class="related"><span class="label">Related:</span> <span>—</span></nav>` (spec has none; placeholder dash)
- `plan.template.html`: `<nav class="related"><span class="label">Related:</span> <a href="../specs/SPEC-042-stripe-webhooks.html">SPEC-042</a></nav>`
- `test-report.template.html`: `<nav class="related"><span class="label">Related:</span> <a href="../feat/FEAT-003-stripe-webhooks.html">FEAT-003</a></nav>`
- `code-review.template.html`: `<nav class="related"><span class="label">Related:</span> <a href="../feat/FEAT-003-stripe-webhooks.html">FEAT-003</a></nav>`
- `qa-report.template.html`: `<nav class="related"><span class="label">Related:</span> <a href="../feat/FEAT-003-stripe-webhooks.html">FEAT-003</a></nav>`
- `final-report.template.html`: `<nav class="related"><span class="label">Related:</span> <a href="plans/specs/SPEC-042-stripe-webhooks.html">SPEC-042</a><span class="sep">·</span><a href="plans/feat/FEAT-003-stripe-webhooks.html">FEAT-003</a><span class="sep">·</span><a href="plans/test/TEST-009-stripe-webhooks.html">TEST-009</a><span class="sep">·</span><a href="plans/code-review/CR-005-stripe-webhooks.html">CR-005</a><span class="sep">·</span><a href="plans/qa/QA-003-stripe-webhooks.html">QA-003</a></nav>`
- `progress-timeline.template.html`: `<nav class="related"><span class="label">Related:</span> <a href="feat/FEAT-003-stripe-webhooks.html">FEAT-003</a></nav>`

Keep these as sample exemplars (consistent with the scaffolds' sample-content nature). Do not remove or alter existing `<main data-*>`, `<details>`, checkboxes, or cycle badges.

- [ ] **Step 2: Verify**

Run:
```bash
cd plugins/my-skills/skills/orchestrator/templates/html
ok=1
for f in spec plan test-report code-review qa-report final-report progress-timeline; do
  grep -q 'class="related"' "$f.template.html" || { echo "no related $f"; ok=0; }
  grep -q 'data-cycle' "$f.template.html" || { echo "contract drift $f"; ok=0; }
  grep -qiE 'https?://[^"]+\.(js|css)|cdn\.[a-z]' "$f.template.html" && { echo "external $f"; ok=0; }
done
grep -q 'SPEC-042' plan.template.html || ok=0
grep -qE 'TEST-009.*QA-003|SPEC-042.*FEAT-003.*QA-003' final-report.template.html || ok=0
[ $ok -eq 1 ] && echo OK_TASK4
```
Expected: `OK_TASK4`.

- [ ] **Step 3: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/templates/html/spec.template.html plugins/my-skills/skills/orchestrator/templates/html/plan.template.html plugins/my-skills/skills/orchestrator/templates/html/test-report.template.html plugins/my-skills/skills/orchestrator/templates/html/code-review.template.html plugins/my-skills/skills/orchestrator/templates/html/qa-report.template.html plugins/my-skills/skills/orchestrator/templates/html/final-report.template.html plugins/my-skills/skills/orchestrator/templates/html/progress-timeline.template.html
git commit -m "feat(orchestrator): Related nav region in html scaffolds"
```

---

### Task 5: Sync design-prompts (source of truth)

Add a Navigation subsection to the design-prompts so regenerated designs include nav. Spec §5.

**Files:**
- Modify: `docs/design-prompts/01-roadmap-index.md`
- Modify: `docs/design-prompts/02-roadmap-milestone.md`
- Modify: `docs/design-prompts/03-roadmap-phase.md`
- Modify: `docs/design-prompts/04-roadmap-task.md`
- Modify: `docs/design-prompts/05-orchestrator-spec.md`
- Modify: `docs/design-prompts/06-orchestrator-plan.md`
- Modify: `docs/design-prompts/07-orchestrator-test-report.md`
- Modify: `docs/design-prompts/08-orchestrator-code-review.md`
- Modify: `docs/design-prompts/09-orchestrator-qa-report.md`
- Modify: `docs/design-prompts/10-orchestrator-progress-timeline.md`
- Modify: `docs/design-prompts/11-orchestrator-final-report.md`

**Interfaces:**
- Consumes: the breadcrumb/child-link convention (Tasks 1–2) and Related convention (Tasks 3–4).

- [ ] **Step 1: Add a `## Navigation` section to each prompt**

Insert a `## Navigation` section (before `## Guardrails`) in each file:
- Roadmap `02`/`03`/`04`: describe the breadcrumb region for that level (exact hrefs from Global Constraints) + note that child rows are relative links (`<NNN.M-slug>/README.<ext>` etc.) rendered by the skill. `01-roadmap-index.md`: note milestone rows link to `<NNN-slug>/README.<ext>`; index has no breadcrumb (root).
- Orchestrator `05`–`11`: describe the Related region for that artifact (its edges from Global Constraints), relative across `plans/<dir>/`.
Add a matching bullet to each file's `## Guardrails`: "Preserve the navigation region (breadcrumb / Related) and its relative hrefs; never make links absolute or external."

- [ ] **Step 2: Verify**

Run:
```bash
cd docs/design-prompts
ok=1
for f in 01-roadmap-index 02-roadmap-milestone 03-roadmap-phase 04-roadmap-task 05-orchestrator-spec 06-orchestrator-plan 07-orchestrator-test-report 08-orchestrator-code-review 09-orchestrator-qa-report 10-orchestrator-progress-timeline 11-orchestrator-final-report; do
  grep -qF '## Navigation' "$f.md" || { echo "no nav $f"; ok=0; }
done
grep -qiE 'breadcrumb' 04-roadmap-task.md || ok=0
grep -qiE 'related' 11-orchestrator-final-report.md || ok=0
# sentinel + six-section anatomy still intact (regression guard)
test "$(grep -lF 'EDITORIAL DESIGN SYSTEM v1' *.md | wc -l | tr -d ' ')" = 12 || ok=0
[ $ok -eq 1 ] && echo OK_TASK5
```
Expected: `OK_TASK5`.

- [ ] **Step 3: Commit**

```bash
git add docs/design-prompts/0*.md docs/design-prompts/1*.md
git commit -m "docs(design-prompts): add navigation contract to prompts"
```

---

## Self-Review

**Spec coverage** (spec § → task):
- §3.1 layout → Global Constraints.
- §3.2 down-links render rule → Task 1 Step 1.
- §3.3 breadcrumbs → Task 1 Step 2 (doc) + Task 2 (templates).
- §3.4 render-rule home → Task 1.
- §4.1 orch layout/relationships → Global Constraints.
- §4.2 Related region → Task 4 (scaffolds) + Task 3 (rule).
- §4.3 orch render-rule home → Task 3.
- §5 files touched → Tasks 1–5 cover every listed path.
- §6 constraints preserved → enforced by every task's verify (machine-contract + no-external greps).
No uncovered sections.

**Placeholder scan:** `{{token}}` strings and the `SPEC-042`/`FEAT-003`/etc. sample IDs in the orchestrator scaffolds are real exemplar content (the scaffolds are sample-bearing by design), not plan placeholders. `<ext>`/`<NNN-slug>` are the documented href-convention syntax, quoted verbatim. No "TBD"/"similar to"/"add X".

**Consistency:** breadcrumb hrefs, link targets, the `<ext>` convention, and the Related edges are defined once in Global Constraints and reused verbatim across Tasks 1–5. md uses `.md` hrefs, html uses `.html` hrefs (each format's template hardcodes its own extension). Task 5's regression guard re-asserts the design-prompt sentinel/anatomy from the prior feature stays intact.
