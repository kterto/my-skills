# pr-review-report Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a distributable workspace skill that reviews the current branch vs an auto-detected base and authors one self-contained interactive HTML PR-review report (architecture / security / bugs lenses, rendered diff with inline annotations, severity color-coding).

**Architecture:** The deliverable is a markdown skill — `SKILL.md` (procedure the agent follows) plus two `references/` docs (the review rubric and the HTML artifact contract). No runtime code; the agent reads the diff, reviews with pure LLM reasoning, and writes the HTML per the template contract. Skill is auto-discovered by `sync.sh`/`install-opencode.sh`; only `index.json` must be regenerated.

**Tech Stack:** Markdown (CC skill format), git plumbing in SKILL.md bash snippets, vanilla HTML/CSS/JS authored at runtime by the agent.

## Global Constraints

- Skill path: `plugins/my-skills/skills/pr-review-report/` — matches existing repo convention.
- Frontmatter keys exactly `name` and `description`; `name` must equal the directory name `pr-review-report`.
- Output HTML is **self-contained**: inline CSS + JS only, zero `http(s)://` external references, opens offline.
- Findings source is **pure LLM** — no calls to clean-code-gates / security-review.
- ADR handling is **recommend-only** — never write ADR files.
- Severity scheme: Critical=red `#dc2626`, High=orange `#ea580c`, Medium=yellow `#ca8a04`, Low=blue `#2563eb`, Info=gray `#6b7280`.
- Output path: `docs/reviews/<branch>-<YYYY-MM-DD>.html`.

---

### Task 1: Scaffold skill directory + frontmatter + procedure skeleton

**Files:**
- Create: `plugins/my-skills/skills/pr-review-report/SKILL.md`

**Interfaces:**
- Produces: the skill directory and a valid `SKILL.md` with frontmatter `name: pr-review-report`. Later tasks fill the procedure body and add `references/` files referenced here.

- [ ] **Step 1: Write the validation test (frontmatter + name match)**

Create `scripts/validate-pr-review-skill.sh`:

```bash
#!/usr/bin/env bash
# Validates the pr-review-report skill: frontmatter name matches dir,
# references exist, and any sample report is self-contained.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$ROOT/plugins/my-skills/skills/pr-review-report"
fail=0

# 1. SKILL.md exists with name matching directory
if [ ! -f "$SKILL_DIR/SKILL.md" ]; then echo "FAIL: no SKILL.md"; fail=1; fi
name="$(awk -F': *' '/^name:/{print $2; exit}' "$SKILL_DIR/SKILL.md" 2>/dev/null || true)"
if [ "$name" != "pr-review-report" ]; then echo "FAIL: name '$name' != pr-review-report"; fail=1; fi
if ! grep -q '^description:' "$SKILL_DIR/SKILL.md"; then echo "FAIL: no description"; fail=1; fi

[ "$fail" -eq 0 ] && echo "PASS: frontmatter" || true
exit "$fail"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `chmod +x scripts/validate-pr-review-skill.sh && scripts/validate-pr-review-skill.sh`
Expected: FAIL with "FAIL: no SKILL.md"

- [ ] **Step 3: Write SKILL.md frontmatter + skeleton**

Create `plugins/my-skills/skills/pr-review-report/SKILL.md`:

```markdown
---
name: pr-review-report
description: Review the current branch against an auto-detected base branch and author one self-contained interactive HTML PR-review report — architecture (with ADR recommendations), security, and bugs/improvements lenses, the rendered diff with inline margin annotations, findings color-coded by severity. Use when the user invokes /pr-review-report, says "review this PR", "generate a code review report", "html review of my branch", or asks for a shareable review artifact of the current branch.
---

# PR Review Report

Produce one self-contained interactive HTML code-review report for the current branch.

## Procedure

1. Resolve the base branch. _(filled in Task 4)_
2. Gather the diff. _(filled in Task 4)_
3. Review across three lenses using `references/review-rubric.md`. _(filled in Task 4)_
4. Author the HTML per `references/html-template.md`. _(filled in Task 4)_

## References

- `references/review-rubric.md` — what each lens looks for, severity definitions, ADR-worthy criteria.
- `references/html-template.md` — required structure, CSS tokens, and JS behaviors for the HTML artifact.
```

- [ ] **Step 4: Run validation to verify frontmatter passes**

Run: `scripts/validate-pr-review-skill.sh`
Expected: `PASS: frontmatter` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/pr-review-report/SKILL.md scripts/validate-pr-review-skill.sh
git commit -m "feat(pr-review-report): scaffold skill + validation script"
```

---

### Task 2: Write the review rubric reference

**Files:**
- Create: `plugins/my-skills/skills/pr-review-report/references/review-rubric.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `references/review-rubric.md` — the rubric SKILL.md step 3 points at. Defines the three lenses, the five severities (with the exact hex tokens from Global Constraints), the finding fields, and ADR-worthy criteria. Task 4's SKILL.md references this path; Task 3's template references the same finding fields and severities.

- [ ] **Step 1: Add a validation check for the rubric file**

Append to `scripts/validate-pr-review-skill.sh` before the final `[ "$fail" ... ]` line:

```bash
# 2. references exist
for ref in review-rubric.md html-template.md; do
  if [ ! -f "$SKILL_DIR/references/$ref" ]; then echo "FAIL: missing references/$ref"; fail=1; fi
done
```

- [ ] **Step 2: Run it to verify it fails**

Run: `scripts/validate-pr-review-skill.sh`
Expected: FAIL with "FAIL: missing references/review-rubric.md"

- [ ] **Step 3: Write the rubric**

Create `plugins/my-skills/skills/pr-review-report/references/review-rubric.md`:

```markdown
# Review Rubric

Three lenses. Pure LLM reasoning over the diff — no external tools. Every finding
gets: a severity, a one-line title, a `file:line` anchor (line numbers from the
**new** side of the diff; for deletions use the old-side line and note it), a
rationale (why it matters), and a concrete suggested fix.

## Lens 1 — Architecture

Look for: module boundaries, coupling/cohesion, dependency direction (do new
imports point the wrong way?), abstraction fit, duplication of an existing
concept, leaky interfaces, hidden global state, decisions that lock in a hard-to-
reverse path.

For each notable architectural decision, judge **ADR-worthy** (see criteria
below). When ADR-worthy, attach a draft ADR title and 1–2 sentence
context/consequence. **Never write ADR files** — recommend only.

## Lens 2 — Security

Look for: injection (SQL / command / template / NoSQL), authz & authn gaps,
secret or credential exposure, unsafe deserialization, SSRF, path traversal,
missing/weak input validation, unsafe defaults, sensitive data in logs,
dependency risk introduced by the diff. Prefer concrete exploit reasoning over
generic warnings.

## Lens 3 — Bugs & Improvements

Look for: correctness bugs, unhandled edge cases, null/undefined and error
handling, off-by-one, race conditions, resource leaks, performance regressions,
and clean-code/readability improvements.

## Severities

| Severity | Color token | Meaning |
|---|---|---|
| Critical | `#dc2626` (red) | Exploitable security hole or data-loss/corruption bug. Block merge. |
| High | `#ea580c` (orange) | Likely-incorrect behavior or serious security weakness. Fix before merge. |
| Medium | `#ca8a04` (yellow) | Real bug or design issue in a narrower case. Fix soon. |
| Low | `#2563eb` (blue) | Minor correctness / readability / perf nit. |
| Info | `#6b7280` (gray) | Observation or ADR-worthy architectural note with no defect. |

## ADR-Worthy Criteria

Flag a decision ADR-worthy when the diff introduces a choice that is **(a)** hard
to reverse, **(b)** affects multiple modules or future work, or **(c)** selects
among viable alternatives with real trade-offs. Output only a draft ADR title +
context; the human decides whether to persist it.

## Finding Object (the shape every finding must carry)

- `id` — stable slug, e.g. `sec-1`, `arch-2`, `bug-3`.
- `severity` — one of Critical/High/Medium/Low/Info.
- `title` — one line.
- `file` — repo-relative path.
- `line` — integer line on the new side (or old side, flagged).
- `rationale` — why it matters.
- `fix` — concrete suggested change.
- `adr` — (architecture only, optional) `{ title, context }` when ADR-worthy.
```

- [ ] **Step 4: Run validation to verify the rubric check passes**

Run: `scripts/validate-pr-review-skill.sh`
Expected: still FAIL (html-template.md missing) but NO "missing references/review-rubric.md" line.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/pr-review-report/references/review-rubric.md scripts/validate-pr-review-skill.sh
git commit -m "feat(pr-review-report): add review rubric reference"
```

---

### Task 3: Write the HTML artifact contract

**Files:**
- Create: `plugins/my-skills/skills/pr-review-report/references/html-template.md`

**Interfaces:**
- Consumes: the finding object + severities from `review-rubric.md` (Task 2).
- Produces: `references/html-template.md` — the structural + behavioral contract the agent follows when authoring the report. Defines the anchor id scheme (`finding-<id>` ⇄ `diffline-<file>-<line>`) that the bidirectional jump relies on, the required JS controls, and self-containment rules. Task 4's SKILL.md step 4 points here.

- [ ] **Step 1: Add the self-containment check to the validator**

Append to `scripts/validate-pr-review-skill.sh` before the final `[ "$fail" ... ]` line:

```bash
# 3. if a sample report exists, it must be self-contained (no external http refs,
#    no src/href to remote, anchors resolve loosely)
SAMPLE="$ROOT/docs/reviews/_sample-report.html"
if [ -f "$SAMPLE" ]; then
  if grep -Eq 'src="https?://|href="https?://|<link[^>]+https?://' "$SAMPLE"; then
    echo "FAIL: sample report has external references"; fail=1
  fi
  if ! grep -q 'id="finding-' "$SAMPLE"; then echo "FAIL: sample has no finding anchors"; fail=1; fi
  if ! grep -q 'id="diffline-' "$SAMPLE"; then echo "FAIL: sample has no diffline anchors"; fail=1; fi
fi
```

- [ ] **Step 2: Run it to verify it still fails on the missing template**

Run: `scripts/validate-pr-review-skill.sh`
Expected: FAIL with "FAIL: missing references/html-template.md" (sample checks skipped — no sample yet).

- [ ] **Step 3: Write the HTML contract**

Create `plugins/my-skills/skills/pr-review-report/references/html-template.md`:

```markdown
# HTML Artifact Contract

Author ONE self-contained `.html` file. All CSS and JS inline in `<style>` /
`<script>`. **No external references** — no CDN links, fonts, or images by URL.
Must open by double-click, offline.

## Anchor scheme (powers the bidirectional jump)

- Each finding card: `id="finding-<id>"` (e.g. `finding-sec-1`).
- Each annotated diff line: `id="diffline-<file-slug>-<line>"` where `<file-slug>`
  is the file path with `/` and `.` replaced by `-`.
- Each gutter marker stores `data-finding="<id>"`; each finding card stores
  `data-diffline="diffline-<file-slug>-<line>"`. Clicking either scrolls to and
  briefly highlights the other (see JS below).

## Document structure

1. **`<head>`** — `<meta charset>`, `<title>PR Review — <branch></title>`, inline
   `<style>` with the severity color custom properties:
   `--sev-critical:#dc2626; --sev-high:#ea580c; --sev-medium:#ca8a04; --sev-low:#2563eb; --sev-info:#6b7280;`
2. **Summary bar** — branch, base branch, merge-base sha, commit range,
   generated-at; a row of severity count badges and per-section counts.
3. **Controls** — severity multi-toggle, section filter, "collapse/expand all",
   jump-to-file `<select>`.
4. **Three `<section>`s** — Architecture, Security, Bugs & Improvements; each
   collapsible, each lists finding cards.
5. **Finding card** — severity chip (background = matching `--sev-*`), title,
   `file:line` link (`href="#diffline-..."`), rationale, suggested fix. Architecture
   cards add an **ADR** badge with draft title + context when `adr` is present.
6. **Diff viewer** — per-file collapsible blocks. Render added lines on a green
   tint, removed on red. Lines that have a finding get a gutter marker
   (`class="ann" data-finding="..."`) and the `id="diffline-..."`.

## Required JS behaviors (vanilla, inline)

- **Bidirectional jump:** clicking a gutter `.ann` marker → `scrollIntoView` its
  `finding-<data-finding>` and add `.flash` for 1.2s; clicking a finding card's
  `file:line` link → same to its `data-diffline` target.
- **Severity filter:** toggling a severity hides/shows all finding cards AND their
  gutter markers of that severity.
- **Section filter:** show/hide whole sections.
- **Collapse/expand all:** toggle every `<section>` and diff-file block.
- **Jump-to-file:** selecting a file scrolls its diff block into view.

No persisted state — filters reset on reload. Keep total JS small and dependency-free.

## Empty state

If a lens has no findings, still render the section with a "No findings" note so the
report shape is consistent.
```

- [ ] **Step 4: Run validation (template now present)**

Run: `scripts/validate-pr-review-skill.sh`
Expected: `PASS: frontmatter` and no "missing references" lines (exit 0).

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/pr-review-report/references/html-template.md scripts/validate-pr-review-skill.sh
git commit -m "feat(pr-review-report): add HTML artifact contract"
```

---

### Task 4: Fill the full SKILL.md procedure

**Files:**
- Modify: `plugins/my-skills/skills/pr-review-report/SKILL.md`

**Interfaces:**
- Consumes: `references/review-rubric.md`, `references/html-template.md`.
- Produces: the complete operating procedure (base detection, diff gathering, review, emit) the agent runs at invocation.

- [ ] **Step 1: Replace the skeleton procedure with the full procedure**

In `plugins/my-skills/skills/pr-review-report/SKILL.md`, replace the `## Procedure` section (keep the frontmatter and `## References` unchanged) with:

```markdown
## Procedure

### 1. Resolve the base branch

Detect the default branch and the merge-base, then show the user and let them override:

\`\`\`bash
# default branch: prefer origin/HEAD, then main, master, dev
guess="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"
base=""
for cand in "$guess" main master dev; do
  [ -n "$cand" ] || continue
  if git show-ref --verify --quiet "refs/heads/$cand"; then base="$cand"; break
  elif git show-ref --verify --quiet "refs/remotes/origin/$cand"; then base="origin/$cand"; break
  fi
done
# last resort: only adopt a ref that actually resolves — never invent origin/main
# (it would crash merge-base in a local-only clone), and never silently pick a
# random branch (it would diff against the wrong base).
if [ -z "$base" ]; then
  for cand in main master origin/main origin/master; do
    git rev-parse --verify --quiet "$cand^{commit}" >/dev/null 2>&1 && base="$cand" && break
  done
fi
branch="$(git branch --show-current)"
if [ -z "$base" ]; then
  echo "Could not auto-detect a base branch — ask the user which branch to diff against, then set base."
else
  mb="$(git merge-base "$base" HEAD)"
  git --no-pager log --oneline "$mb"..HEAD | wc -l   # commit count
  git --no-pager diff --stat "$mb"..HEAD             # changed files / lines
fi
\`\`\`

Tell the user: base branch, merge-base sha (short), commit count, changed-file count.
Ask them to confirm or supply a different base before continuing. Re-run with the
chosen base if overridden.

### 2. Gather the diff

\`\`\`bash
git --no-pager diff "$base"...HEAD          # three-dot: branch changes since divergence
git --no-pager diff --stat "$base"...HEAD
\`\`\`

Read the full diff. If it is very large, prioritize files by `--stat` magnitude and
explicitly list in the report any file you did not fully review — never truncate silently.

### 3. Review across three lenses

Follow `references/review-rubric.md`. Produce findings for Architecture (with ADR
recommendations where criteria match — recommend only, write no files), Security,
and Bugs & Improvements. Give each finding the full finding object: id, severity,
title, file, line, rationale, fix, and (architecture only) optional adr.

### 4. Author the HTML report

Write ONE self-contained HTML file to `docs/reviews/<branch>-<YYYY-MM-DD>.html`
following `references/html-template.md` exactly — inline CSS+JS, severity color
tokens, the three sections, finding cards, the rendered per-file diff with inline
gutter annotations, and the bidirectional `finding-<id>` ⇄ `diffline-<file>-<line>`
anchors. Create `docs/reviews/` if absent.

Then tell the user the path and a one-line summary (counts per severity).
\`\`\`

(Use the real date via `date +%F`; the `\`\`\`` fences above are escaped only here in the plan — write normal triple backticks in the file.)
```

- [ ] **Step 2: Verify SKILL.md still validates**

Run: `scripts/validate-pr-review-skill.sh`
Expected: `PASS: frontmatter`, exit 0.

- [ ] **Step 3: Verify the procedure references resolve**

Run: `grep -c 'references/review-rubric.md\|references/html-template.md' plugins/my-skills/skills/pr-review-report/SKILL.md`
Expected: `>= 2` (both references mentioned).

- [ ] **Step 4: Commit**

```bash
git add plugins/my-skills/skills/pr-review-report/SKILL.md
git commit -m "feat(pr-review-report): full review procedure"
```

---

### Task 5: End-to-end dry run, sample report, and registration

**Files:**
- Create: `docs/reviews/_sample-report.html` (fixture proving the contract is satisfiable)
- Modify: `plugins/my-skills/skills/index.json` (regenerated by script)
- Modify: `.claude-plugin/marketplace.json` (description prose)

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a validated sample report, regenerated opencode index, updated marketplace description.

- [ ] **Step 1: Author a minimal sample report satisfying the contract**

Create `docs/reviews/_sample-report.html` — a hand-authored minimal instance proving
the anchor scheme works: a summary bar, one finding card per section, and a 2-file
diff block with at least one gutter annotation wired to a finding. It MUST contain:
inline `<style>` + `<script>` only (no `http(s)://` refs), at least one
`id="finding-..."`, at least one `id="diffline-..."`, a `.ann` marker with
`data-finding`, and working bidirectional click JS per `references/html-template.md`.
This file doubles as a worked example for the agent and as the validator's fixture.

- [ ] **Step 2: Run the validator against the sample**

Run: `scripts/validate-pr-review-skill.sh`
Expected: `PASS: frontmatter`, no FAIL lines (sample self-containment + anchor checks pass), exit 0.

- [ ] **Step 3: Confirm it opens offline (no network)**

Run: `grep -Ec 'https?://' docs/reviews/_sample-report.html`
Expected: `0`.

- [ ] **Step 4: Regenerate the opencode skill index**

Run: `node scripts/generate-opencode-skill-index.mjs`
Expected: stdout `wrote plugins/my-skills/skills/index.json with N skills` where N increased by 1; `git diff --stat plugins/my-skills/skills/index.json` shows pr-review-report added.

- [ ] **Step 5: Update the marketplace plugin description**

In `.claude-plugin/marketplace.json`, append to the `my-skills` plugin `description` string: `, and a pr-review-report skill that emits an interactive HTML PR review.` (keep it one sentence, valid JSON).

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'));console.log('json ok')"`
Expected: `json ok`.

- [ ] **Step 6: Commit**

```bash
git add docs/reviews/_sample-report.html plugins/my-skills/skills/index.json .claude-plugin/marketplace.json
git commit -m "feat(pr-review-report): sample report fixture + register skill"
```

- [ ] **Step 7: Final full validation**

Run: `scripts/validate-pr-review-skill.sh && echo ALL_GREEN`
Expected: ends with `ALL_GREEN`.

---

## Notes for the implementer

- `sync.sh` and `install-opencode.sh` both auto-discover skills by directory; no edits to them are needed. Only `index.json` (generated) and the marketplace description prose change.
- The skill writes reports to `docs/reviews/`; the `_sample-report.html` fixture is committed intentionally as a worked example. Real reports generated per-run are also committed there by design (shareable/versioned).
- Keep the authored HTML's JS dependency-free and small — it must open offline by double-click.
