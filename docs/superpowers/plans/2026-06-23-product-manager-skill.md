# product-manager Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an action skill `product-manager` that autonomously drives a scoped branch of a roadmap to completion — feeding each user story's brief to the orchestrator, then committing with the roadmap trailer, syncing the roadmap, pushing, and opening a stacked PR per story.

**Architecture:** A prose-instruction skill in the same idiom as the existing `roadmap` and `orchestrator` skills — `SKILL.md` drives the flow; `references/*.md` hold the algorithms (scope resolution, git flow, human-validation detection, resume/logging); `templates/*` hold the rendered artifacts (PR body, progress-log entry). It glues the two existing skills: it reads roadmap output (`roadmap.lock.json` + user-story files), invokes the `orchestrator` skill per story, and performs the git/commit/sync/PR work that both other skills deliberately leave out.

**Tech Stack:** Markdown + YAML frontmatter, `git` + `gh` CLI for the action layer. No build step. Verification is structural (grep / key-presence / cross-ref integrity), since the deliverables are documents, not executable code.

## Global Constraints

- Skill root: `plugins/my-skills/skills/product-manager/` — all paths below are under it.
- **Action skill** (not doc-only): it runs `git`, invokes the orchestrator (which runs code), commits, pushes, and opens PRs. State this explicitly in SKILL.md.
- PM MUST NOT: bootstrap the orchestrator, build or re-evaluate the roadmap, merge PRs, or write specs/plans/code itself.
- Commit trailer consumed (exact): `Roadmap-Story: <id>` — taken verbatim from the story frontmatter `commit_trailer`.
- Story branch naming (exact): `pm/<id>-<slug>`.
- Default autonomy: `conservative=true`. Flag: `--conservative=true|false`.
- Config precedence (exact): `CLI flag > /roadmap/pm.config.json > built-in default`.
- Orchestrator terminal states consumed: success = `READY_TO_COMMIT` | `READY_WITH_WARNINGS`; stop = `STALLED` | `BLOCKED` (any variant).
- Roadmap status enum (exact): `todo | in_progress | done | superseded | blocked`. PM skips `done` and `superseded`.
- Stacked-PR base = predecessor's branch (story has `depends_on`) else the run base.
- Roadmap contract consumed: `roadmap.lock.json` items `{id, kind, status, sequence}`; user-story frontmatter `id, status, depends_on, sequence, milestone, phase, commit_trailer`; body sections `## Brief`, `## Acceptance`.
- Spec of record: `docs/superpowers/specs/2026-06-23-product-manager-skill-design.md` — cited per task by section.

---

### Task 1: Scope-resolution reference

Defines how PM turns the `<scope>` arg into an ordered story queue. Spec §Invocation, §Scope resolution.

**Files:**
- Create: `plugins/my-skills/skills/product-manager/references/scope-resolution.md`

**Interfaces:**
- Consumes: roadmap `roadmap.lock.json` items `{id, kind, status, sequence}`; story frontmatter `id, status, depends_on, sequence, milestone, phase`.
- Produces (names later tasks + SKILL.md rely on):
  - The ordered-queue concept the loop iterates: "in-scope, not `done`/`superseded`, topo-sorted by `depends_on` then `sequence`".
  - Scope kinds: `roadmap` | milestone-id | phase-id.
  - Cycle-detection stop behavior; unmatched-scope stop behavior; out-of-scope-dependency check.

- [ ] **Step 1: Write `references/scope-resolution.md`**

Content must include, verbatim where marked:
- Intro line: this is the single source of truth for turning `<scope>` into the story queue.
- **Scope matching** table:
  - `roadmap` → every `roadmap.lock.json` item with `kind: user-story`.
  - milestone id → user stories whose frontmatter `milestone` matches; accept both `001` and `001-bootstrap` forms (bare ordinal matches the milestone id or the directory-slug prefix).
  - phase id (`001.2`) → user stories whose frontmatter `phase` matches.
  - Unmatched scope → stop and print the list of valid scopes (milestone ids + phase ids found in the lock).
- **Filter:** drop stories with `status` ∈ {`done`, `superseded`} (verbatim enum values).
- **Ordering algorithm** (prose + numbered steps):
  1. Build a directed graph: edge `dep -> story` for each id in the story's `depends_on`.
  2. Topologically sort; break ties by `sequence` (ascending).
  3. On a cycle, stop and report the offending ids ("roadmap should never emit a cycle; PM verifies").
- **Out-of-scope dependencies:** if a story's `depends_on` references an id outside the resolved scope whose `roadmap.lock.json` status is not `done` → warn; in conservative mode stop; in autonomous mode proceed and record the unmet dependency in the log + PR body. (Cross-reference: `references/human-validation.md` for mode, `references/resume-and-logging.md` for the log.)

- [ ] **Step 2: Verify required content present**

Run:
```bash
f=plugins/my-skills/skills/product-manager/references/scope-resolution.md
grep -q 'kind: user-story' "$f" && \
grep -q 'depends_on' "$f" && \
grep -q 'topolog' "$f" && \
grep -qi 'cycle' "$f" && \
grep -q 'superseded' "$f" && echo OK
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/my-skills/skills/product-manager/references/scope-resolution.md
git commit -m "feat(product-manager): scope-resolution reference"
```

---

### Task 2: Git-flow reference + PR body template

Defines the stacked-branch git model, the commit+trailer+sync ordering, and stacked PR creation. Spec §Per-story loop, §File layout.

**Files:**
- Create: `plugins/my-skills/skills/product-manager/references/git-flow.md`
- Create: `plugins/my-skills/skills/product-manager/templates/pr-body.template.md`

**Interfaces:**
- Consumes: story frontmatter `commit_trailer`, `depends_on`; orchestrator final report (proposed commit message, QA report path); `--base` / run base.
- Produces (names SKILL.md relies on):
  - Branch naming: `pm/<id>-<slug>`.
  - Base resolution rule (predecessor branch vs run base).
  - The exact success-path sequence: commit-with-trailer → `/roadmap sync` → commit sync docs → push → `gh pr create --base <base>`.
  - PR body template token list.

- [ ] **Step 1: Write `references/git-flow.md`**

Content must include, verbatim where marked:
- **Branch naming (exact):** `pm/<id>-<slug>` where `<slug>` is the story's directory/file slug.
- **Base resolution:**
  - Story has `depends_on` satisfied within the run → base = `pm/<dep-id>-<slug>` of the latest-ordered dependency.
  - Otherwise → base = run base (`--base` value, else the branch PM started on).
- **Cut branch:** `git checkout -b pm/<id>-<slug> <base>` — yields a clean, non-protected branch so the orchestrator's Step 0 pre-flight selects "use this branch" without prompting.
- **Success-path sequence** (numbered, exact order; explain *why* sync runs after the trailer commit):
  1. `git add -A && git commit` using the orchestrator's proposed commit message, appending the trailer line `Roadmap-Story: <id>` (verbatim from `commit_trailer`).
  2. Run `/roadmap sync` — it reads trailers from `git log`, so the trailer commit MUST already exist; it stamps the story `done`, rolls up, updates `roadmap.lock.json` + READMEs.
  3. Commit the roadmap doc changes from sync separately: `docs(roadmap): sync <id>` (no story trailer).
  4. `git push -u origin pm/<id>-<slug>`.
  5. `gh pr create --base <base> --head pm/<id>-<slug>` with body rendered from `templates/pr-body.template.md`. State that `--base` is the predecessor branch for dependents (stacked PR) or the run base for independent stories.
- **Trailer-mismatch guard:** if sync stamps nothing for a story whose trailer commit exists, warn and stop (roadmap would drift from git truth).
- Note: PM never merges PRs.

- [ ] **Step 2: Write `templates/pr-body.template.md`**

Must contain these tokens/sections (verbatim token names so SKILL.md and git-flow agree):
```
## Summary
{{summary}}

## Story
{{story_id}} — {{story_title}}

## Test plan
{{test_plan}}

## Human validation
{{human_validation_note}}
```
Add a comment line documenting that `{{human_validation_note}}` is `none` unless a human-validation spot was detected (see `references/human-validation.md`).

- [ ] **Step 3: Verify required content present**

Run:
```bash
g=plugins/my-skills/skills/product-manager/references/git-flow.md
p=plugins/my-skills/skills/product-manager/templates/pr-body.template.md
grep -q 'pm/<id>-<slug>' "$g" && \
grep -q 'Roadmap-Story: <id>' "$g" && \
grep -q '/roadmap sync' "$g" && \
grep -q 'gh pr create --base' "$g" && \
grep -q '{{human_validation_note}}' "$p" && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add plugins/my-skills/skills/product-manager/references/git-flow.md plugins/my-skills/skills/product-manager/templates/pr-body.template.md
git commit -m "feat(product-manager): git-flow reference + PR body template"
```

---

### Task 3: Human-validation reference

Defines detection sources, the marker list, and conservative vs autonomous behavior. Spec §Human validation.

**Files:**
- Create: `plugins/my-skills/skills/product-manager/references/human-validation.md`

**Interfaces:**
- Consumes: story `## Acceptance` section text; orchestrator QA report file.
- Produces (names SKILL.md relies on):
  - Detection result: `none` | `flagged: acceptance` | `flagged: qa-report`.
  - The two mode behaviors (conservative halt-after-completion; autonomous document-and-continue).
  - The `/roadmap/human-validation-queue.md` append-only artifact.

- [ ] **Step 1: Write `references/human-validation.md`**

Content must include, verbatim where marked:
- **Detection sources:**
  - Pre-run: scan the story's `## Acceptance` for case-insensitive markers. Marker list (exact, fenced so it is copy-pastable): `manual`, `manually`, `human`, `by hand`, `visually`, `visual check`, `real device`, `physical`, `user acceptance`, `UAT`, `eyeball`, `in person`.
  - Post-run: scan the orchestrator QA report (path from the final report) for manual-validation flags / sections indicating human verification is required.
- **Invariant (verbatim):** "A flagged story is always implemented fully — PM still commits, syncs, pushes, and opens the PR. The mode only governs whether the loop continues."
- **conservative (default):** after completing the current story, halt the loop and surface a validation request — story id, PR link, and the specific items needing validation. The user validates, then re-runs PM (resume skips the now-`done` story).
- **autonomous (`--conservative=false`):** append the spot to `/roadmap/human-validation-queue.md` (append-only checklist; show the row format `- [ ] <story-id> <title> — <what to validate> (PR <url>)`) and set the PR body `{{human_validation_note}}`, then continue.

- [ ] **Step 2: Verify required content present**

Run:
```bash
f=plugins/my-skills/skills/product-manager/references/human-validation.md
grep -q '## Acceptance' "$f" && \
grep -qi 'real device' "$f" && \
grep -q 'human-validation-queue.md' "$f" && \
grep -qi 'always implemented fully' "$f" && \
grep -q -- '--conservative=false' "$f" && echo OK
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/my-skills/skills/product-manager/references/human-validation.md
git commit -m "feat(product-manager): human-validation reference"
```

---

### Task 4: Resume-and-logging reference + progress-entry template

Defines the append-only run log, its entry template, and the stateless resume algorithm. Spec §Logging, §Resume.

**Files:**
- Create: `plugins/my-skills/skills/product-manager/references/resume-and-logging.md`
- Create: `plugins/my-skills/skills/product-manager/templates/pm-progress-entry.template.md`

**Interfaces:**
- Consumes: `roadmap.lock.json` statuses; deterministic branch naming `pm/<id>-<slug>`.
- Produces (names SKILL.md relies on):
  - Log path: `/roadmap/pm-progress.md`, actor `product-manager`.
  - Entry field set: `when, story, base, branch, state, commit, pr, human_validation, notes`.
  - Resume rule: re-resolve scope, drop `done`/`superseded`, reconstruct stack from branch naming.

- [ ] **Step 1: Write `references/resume-and-logging.md`**

Content must include, verbatim where marked:
- **Log:** append-only `/roadmap/pm-progress.md`, actor `product-manager`. One entry per story attempt. Field table with these exact field names: `when` (ISO-8601), `story` (id + title), `base`, `branch`, `state` (orchestrator terminal state), `commit` (sha or `—`), `pr` (url or `—`), `human_validation` (`none` | `flagged: <source>`), `notes` (unmet deps / warnings / stop reason).
- **Resume (verbatim):** "PM is restart-safe with no extra state file." On re-run: re-resolve scope, re-read `roadmap.lock.json`, drop stories already `done`/`superseded`. Stacked-branch reconstruction relies on the deterministic `pm/<id>-<slug>` naming so a dependent story can locate its predecessor branch after a restart.

- [ ] **Step 2: Write `templates/pm-progress-entry.template.md`**

A single Markdown table-row (or block) template using the exact field names from Step 1, e.g.:
```
| {{when}} | {{story}} | {{base}} | {{branch}} | {{state}} | {{commit}} | {{pr}} | {{human_validation}} | {{notes}} |
```
Include the header row + separator above it as a comment showing column order: `when | story | base | branch | state | commit | pr | human_validation | notes`.

- [ ] **Step 3: Verify required content present**

Run:
```bash
f=plugins/my-skills/skills/product-manager/references/resume-and-logging.md
t=plugins/my-skills/skills/product-manager/templates/pm-progress-entry.template.md
grep -q 'pm-progress.md' "$f" && \
grep -q 'product-manager' "$f" && \
grep -qi 'restart-safe' "$f" && \
grep -q 'human_validation' "$t" && \
grep -q '{{branch}}' "$t" && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add plugins/my-skills/skills/product-manager/references/resume-and-logging.md plugins/my-skills/skills/product-manager/templates/pm-progress-entry.template.md
git commit -m "feat(product-manager): resume/logging reference + progress template"
```

---

### Task 5: SKILL.md (entry point, pre-flight, loop, gates)

The driver that ties the references together: frontmatter, invocation, pre-flight gate, per-story loop, and the references table. Spec §Purpose, §Non-goals, §Invocation, §Pre-flight, §Per-story loop, §Error handling.

**Files:**
- Create: `plugins/my-skills/skills/product-manager/SKILL.md`

**Interfaces:**
- Consumes: all four references + both templates from Tasks 1–4 (by relative path).
- Produces: the user-facing `/product-manager` contract.

- [ ] **Step 1: Write the frontmatter**

Exact frontmatter:
```yaml
---
name: product-manager
description: Autonomously drives a scoped branch of the roadmap to completion — feeds each user story's brief to the orchestrator, then commits with the Roadmap-Story trailer, syncs the roadmap, pushes, and opens a stacked PR per story. Use when the user invokes "/product-manager complete <scope>", says "complete the milestone/phase/roadmap autonomously", or wants the roadmap implemented story by story. Action skill — runs git, invokes the orchestrator, commits, pushes, and opens PRs. Default conservative=true (stops at human-validation spots).
---
```

- [ ] **Step 2: Write the body sections**

Required `##` sections, in order, with the content noted:

1. `# product-manager` + a 2-3 sentence purpose: glue between roadmap (plans/tracks, never runs code) and orchestrator (implements, never commits). PM resolves a scope, runs the orchestrator per story, then commits/syncs/pushes/PRs.
2. `## What this skill does NOT do` — bullet list (verbatim from Global Constraints): no orchestrator bootstrap, no roadmap build/re-eval, no PR merge, no writing specs/plans/code itself.
3. `## Invocation + Config` — the invocation line `/product-manager complete <scope> [--conservative=true|false] [--base <branch>] [--dry-run]`, the scope/flags table, and the config precedence line `CLI flag > /roadmap/pm.config.json > built-in default` with default `conservative=true`.
4. `## Pre-flight` — numbered gate: (1) require `/roadmap/roadmap.lock.json` else "run /roadmap first"; (2) require `.orchestrator/config.json` else "run /orchestrator --setup first"; (3) require clean tree; (4) require `gh` available; (5) resolve scope (→ `references/scope-resolution.md`); (6) drop `done`/`superseded`; (7) topo-sort; (8) print queue + mode + git plan and ask a **single up-front confirmation** (approving authorizes per-story push/PR). `--dry-run` stops after step 8 without asking.
5. `## Per-story loop` — numbered steps referencing the references: resolve base + cut branch (→ `git-flow.md`); run the `orchestrator` skill with the story's `## Brief` verbatim as the task; read terminal state; on success run the success-path sequence (→ `git-flow.md`) and the human-validation check (→ `human-validation.md`) and append a log entry (→ `resume-and-logging.md`); on `STALLED`/`BLOCKED` stop the whole run and report state + remaining queue.
6. `## Error handling` — bullets: missing roadmap/orchestrator-config/dirty-tree/missing-gh → stop with specific remedy; orchestrator stall → stop, preserve completed stories; cycle/unmatched scope → stop; trailer-mismatch → warn + stop.
7. `## References` — table mapping each `references/*.md` and `templates/*` to its purpose (all four references + both templates).

Cross-reference rule: every reference/template path mentioned MUST exist (created in Tasks 1–4).

- [ ] **Step 3: Verify frontmatter + section structure**

Run:
```bash
f=plugins/my-skills/skills/product-manager/SKILL.md
grep -q '^name: product-manager$' "$f" && \
grep -q '/product-manager complete <scope>' "$f" && \
grep -q 'run /orchestrator --setup first' "$f" && \
grep -q 'single up-front confirmation' "$f" && \
grep -qi 'STALLED' "$f" && echo OK
```
Expected: `OK`

- [ ] **Step 4: Verify every referenced path exists (cross-ref integrity)**

Run:
```bash
root=plugins/my-skills/skills/product-manager
for p in references/scope-resolution.md references/git-flow.md references/human-validation.md references/resume-and-logging.md templates/pr-body.template.md templates/pm-progress-entry.template.md; do
  grep -q "$p" "$root/SKILL.md" || { echo "MISSING REF IN SKILL.md: $p"; }
  test -f "$root/$p" || { echo "MISSING FILE: $p"; }
done
echo "cross-ref check done"
```
Expected: `cross-ref check done` with no `MISSING` lines.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/product-manager/SKILL.md
git commit -m "feat(product-manager): SKILL.md entry point, pre-flight, loop"
```

---

### Task 6: Wire into plugin + smoke-trace

Make the skill discoverable and validate the end-to-end contract by tracing a dry-run against the documented roadmap shape. Spec §Compatibility.

**Files:**
- Modify: `.claude-plugin/` plugin manifest if it enumerates skills (inspect first; many setups auto-discover `skills/*/SKILL.md`).

**Interfaces:**
- Consumes: the completed skill from Tasks 1–5.
- Produces: a discoverable `/product-manager` skill.

- [ ] **Step 1: Determine whether skills are auto-discovered or enumerated**

Run:
```bash
ls .claude-plugin/ 2>/dev/null; grep -rl 'roadmap\|orchestrator' .claude-plugin/ 2>/dev/null || echo "no explicit enumeration — auto-discovered"
```
Expected: either a manifest file listing skills, or `no explicit enumeration`.

- [ ] **Step 2: If enumerated, add the skill**

If a manifest enumerates skills (e.g. lists `roadmap`, `orchestrator`), add a `product-manager` entry mirroring the existing entries' shape. If auto-discovered, no change needed — note this in the commit.

- [ ] **Step 3: Smoke-trace the dry-run path (manual, no execution)**

Read `SKILL.md` + the four references end-to-end and confirm a `--dry-run` walkthrough resolves with no dangling reference: scope `001` → scope-resolution produces an ordered queue → loop step 1 base resolution → stops before any git mutation. Confirm every `→ references/*.md` pointer in SKILL.md resolves to a section that exists. Fix any dangling pointer inline.

- [ ] **Step 4: Final structural check**

Run:
```bash
root=plugins/my-skills/skills/product-manager
test -f "$root/SKILL.md" && \
test -f "$root/references/scope-resolution.md" && \
test -f "$root/references/git-flow.md" && \
test -f "$root/references/human-validation.md" && \
test -f "$root/references/resume-and-logging.md" && \
test -f "$root/templates/pr-body.template.md" && \
test -f "$root/templates/pm-progress-entry.template.md" && echo "all files present"
```
Expected: `all files present`

- [ ] **Step 5: Commit**

```bash
git add -A plugins/my-skills/skills/product-manager .claude-plugin
git commit -m "feat(product-manager): wire skill into plugin + smoke-trace"
```

---

## Self-Review

**Spec coverage:**
- Purpose / glue role → Task 5 §1.
- Non-goals → Task 5 §2.
- Invocation + flags + config precedence → Task 5 §3 (consumes scope-resolution Task 1).
- Pre-flight gate → Task 5 §4.
- Scope resolution + topo-sort + cycle + out-of-scope deps → Task 1.
- Per-story loop + stacked branches + base resolution → Task 2 + Task 5 §5.
- Commit+trailer → sync → push → stacked PR → Task 2.
- Human-validation detection + conservative/autonomous → Task 3 (+ PR note token from Task 2).
- Logging → Task 4.
- Resume → Task 4.
- Error handling → Task 5 §6.
- Compatibility / discoverability → Task 6.

**Placeholder scan:** No "TBD"/"handle edge cases" steps — each step names exact files, verbatim strings, and a grep verification.

**Type/name consistency:** Branch naming `pm/<id>-<slug>`, trailer `Roadmap-Story: <id>`, status enum `done|superseded`, terminal states `READY_TO_COMMIT|READY_WITH_WARNINGS|STALLED|BLOCKED`, log fields `when|story|base|branch|state|commit|pr|human_validation|notes`, PR token `{{human_validation_note}}` — all used identically across tasks.
