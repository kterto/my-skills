# Orchestrator Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the TOODLS-specific orchestrator into one installable, project-agnostic skill that gathers project context, generates project-customized role agents, runs the brainstormer→architect→coder→tester→reviewer→qa pipeline, validates against the project spec, and emits a final report.

**Architecture:** A single skill at `plugins/my-skills/skills/orchestrator/` ships six generic role **templates** plus shared **reference** docs, and contains the generic pipeline logic. Per project it materializes six thin agent files (each reads one `.orchestrator/PROJECT-CONTEXT.md`) plus `.orchestrator/config.json`. Project facts live in exactly one place per project.

**Tech Stack:** Markdown skill + agent files (Claude Code plugin). No runtime code beyond a small `config.json`. Validation is by structural assertion (frontmatter present, no project-literal leakage, dry-run of the lifecycle dispatch) rather than unit tests — these artifacts are skill/agent markdown, not application code.

**Source material:** the existing TOODLS reference copies in `docs/orchestrator/` (`SKILL.md`, `brainstormer.md`, `architect.md`, `coder.md`, `reviewer.md`, `qa.md`) are the transformation inputs. Design: `docs/superpowers/specs/2026-06-21-orchestrator-skill-design.md`.

## Global Constraints

- Generated agent files MUST contain **zero** hard-coded project facts. Every project fact resolves via `.orchestrator/PROJECT-CONTEXT.md`. Verification: `grep -i` for project-literal tokens (`TOODLS`, `PostGIS`, `Flutter`, `NestJS`, `apps/backend`, `pt-BR`) returns nothing in any template or generated agent.
- `context_threshold` default `0.95`; `output_format` default `"md"` (options `"md" | "html"`); `max_review_cycles` default `10`; `max_qa_cycles` default `5`.
- Config precedence everywhere: per-run CLI arg > `.orchestrator/config.json` > built-in default.
- Pipeline order is fixed: `brainstormer → architect → coder → tester → reviewer → qa`.
- The skill NEVER commits or pushes. The final report only proposes a commit message and PR message.
- Skill/agent markdown uses 2-space indentation; filenames kebab-case.

---

## File Structure

Skill package (created):
```
plugins/my-skills/skills/orchestrator/
  SKILL.md                          # entry: auto-detect, bootstrap, pipeline, eval, report
  references/
    artifact-format.md              # md|html artifact emission rules (shared by all templates)
    context-schema.md               # required PROJECT-CONTEXT.md sections
    config.md                       # config keys, defaults, precedence
  templates/
    brainstormer.md                 # generic role template
    architect.md
    coder.md
    tester.md                       # NEW role
    reviewer.md
    qa.md
    PROJECT-CONTEXT.template.md      # skeleton the context gate fills
    config.template.json            # default config materialized per project
```

Materialized per target project (by the skill at runtime, not by this plan):
```
target/.claude/agents/{brainstormer,architect,coder,tester,reviewer,qa}.md
target/.orchestrator/{PROJECT-CONTEXT.md,config.json}
```

---

## Task 1: Skill skeleton + lifecycle dispatch

**Files:**
- Create: `plugins/my-skills/skills/orchestrator/SKILL.md`

**Interfaces:**
- Produces: the `/orchestrator` entry point. Dispatch contract: presence of `.orchestrator/config.json` decides bootstrap-vs-pipeline; `--setup` forces bootstrap. Later tasks fill the Bootstrap and Pipeline sections referenced here.

- [ ] **Step 1: Write the SKILL.md frontmatter + overview**

Create the file with frontmatter and a lifecycle section. Frontmatter `name: orchestrator`; `description:` must list trigger phrases ("/orchestrator", "orchestrate", "run the full pipeline") and the auto-detect behavior. Body opens with: this skill runs in the caller session and has the `Agent` tool; it spawns each role via `subagent_type`.

```markdown
## Lifecycle — auto-detect

On invocation with a plain-language task description (and optional `--setup`):

1. Resolve config (see `references/config.md`): CLI args > `.orchestrator/config.json` > defaults.
2. If `--setup` is present OR `.orchestrator/config.json` does not exist → run **Bootstrap** (Steps B1–B3), then continue.
3. Run **Pipeline** (Steps 0–6).
4. On `READY_TO_COMMIT` → run **Spec eval + report** (Step 7).
```

- [ ] **Step 2: Add placeholder section anchors**

Add empty `## Bootstrap`, `## Pipeline`, and `## Spec eval + report` headings with a one-line `<!-- filled by Task N -->` marker each, so later tasks have stable anchors. This keeps task boundaries reviewable.

- [ ] **Step 3: Verify structure**

Run: `grep -E '^## (Lifecycle|Bootstrap|Pipeline|Spec eval)' plugins/my-skills/skills/orchestrator/SKILL.md`
Expected: all four headings present.
Run: `grep -iE 'TOODLS|PostGIS|Flutter|NestJS|pt-BR' plugins/my-skills/skills/orchestrator/SKILL.md`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/SKILL.md
git commit -m "feat(orchestrator): skill skeleton + lifecycle dispatch"
```

---

## Task 2: Shared reference docs (config, context schema, artifact format)

**Files:**
- Create: `plugins/my-skills/skills/orchestrator/references/config.md`
- Create: `plugins/my-skills/skills/orchestrator/references/context-schema.md`
- Create: `plugins/my-skills/skills/orchestrator/references/artifact-format.md`

**Interfaces:**
- Produces: `config.md` (key list + precedence consumed by Task 1 and Task 3); `context-schema.md` (required sections consumed by Task 3 context gate); `artifact-format.md` (md|html emission rules consumed by all six templates in Tasks 6–7).

- [ ] **Step 1: Write config.md**

Document the four keys, defaults, types, and precedence. Include the canonical default object verbatim:

```json
{ "context_threshold": 0.95, "output_format": "md", "max_review_cycles": 10, "max_qa_cycles": 5 }
```

State precedence: CLI arg > `.orchestrator/config.json` > default. Document accepted CLI args: `--threshold`, `--format`, `--max-review`, `--max-qa`, `--setup`.

- [ ] **Step 2: Write context-schema.md**

List the required `PROJECT-CONTEXT.md` sections, each with a one-line purpose:
- `Project` — name + one-line description
- `Stack` — languages, frameworks, package managers
- `Commands` — build / test / lint / per-phase gate commands (exact)
- `Test tooling` — e2e framework + run command; coverage tool + command (for tester)
- `Layout` — directory map + where each app/module lives
- `Conventions` — plan dir layout, ID prefixes, slug rules, naming
- `Invariants` — load-bearing domain rules every change must respect
- `Critical flows` — main user stories that may warrant e2e (for tester)
- `Out of scope` — deferred / forbidden items

- [ ] **Step 3: Write artifact-format.md**

Define the two emission modes every role template references:
- `md`: artifact written as `<ID>-<slug>.md` with YAML frontmatter (`id`, `status`, timestamps) + markdown body.
- `html`: artifact written as `<ID>-<slug>.html`, one self-contained file, no external assets; status carried in a top-level `<main data-status="...">`, sections collapsible (`<details>`), task lists as checkboxes, cycle counters as badges. The same logical fields as the md frontmatter appear as `data-*` attributes on `<main>`.
State the rule: **the stdout structured summary an agent prints is identical in both modes** — only the on-disk file differs. The orchestrator parses stdout, not the artifact, for control flow.

- [ ] **Step 4: Verify**

Run: `ls plugins/my-skills/skills/orchestrator/references/`
Expected: `artifact-format.md  config.md  context-schema.md`
Run: `grep -c 'data-status' plugins/my-skills/skills/orchestrator/references/artifact-format.md`
Expected: ≥ 1.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/references/
git commit -m "feat(orchestrator): shared config, context-schema, artifact-format refs"
```

---

## Task 3: Bootstrap — context gate + materialize + dependency check

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator/SKILL.md` (fill `## Bootstrap`)
- Create: `plugins/my-skills/skills/orchestrator/templates/PROJECT-CONTEXT.template.md`
- Create: `plugins/my-skills/skills/orchestrator/templates/config.template.json`

**Interfaces:**
- Consumes: `references/context-schema.md`, `references/config.md` (Task 2).
- Produces: Bootstrap steps B1–B3, invoked by the Lifecycle dispatch from Task 1.

- [ ] **Step 1: Write config.template.json**

Exactly the default object from Task 2 Step 1.

- [ ] **Step 2: Write PROJECT-CONTEXT.template.md**

A skeleton with one `##` heading per `context-schema.md` section and a `<!-- fill: ... -->` hint under each. No project facts.

- [ ] **Step 3: Fill SKILL.md `## Bootstrap` — B1 context gate**

Write the inline context-gate procedure:
1. Spawn an `Explore` subagent: "Scan this repo and return a structured digest of stack, build/test/lint/e2e/coverage commands, directory layout, naming conventions, and any documented domain rules. Read CLAUDE.md, AGENTS.md, README, and config/manifest files." (This is the only subagent in the gate.)
2. Using the digest, interview the user with `AskUserQuestion`, asking ONLY about sections of `context-schema.md` the scan left ambiguous.
3. Self-rate holistic confidence (0–1) that the context is clear and complete.
4. Loop steps 2–3 until confidence ≥ `context_threshold`. If the user ends the loop early, record the achieved confidence.
5. Write `.orchestrator/PROJECT-CONTEXT.md` from the template, filling every section.

- [ ] **Step 4: Fill `## Bootstrap` — B2 dependency check**

Write: check whether the `spec-driven-eval` skill is available. If not, offer to run `npx @tech-leads-club/agent-skills install --skill spec-driven-eval` (external install — confirm with the user first), or instruct the user to run it. Record availability; do not block bootstrap on decline (the eval stage handles a missing skill).

- [ ] **Step 5: Fill `## Bootstrap` — B3 materialize**

Write: render the six `templates/{role}.md` into `target/.claude/agents/{role}.md` verbatim (templates are already project-agnostic — no substitution needed; they read PROJECT-CONTEXT.md at runtime). Write `.orchestrator/config.json` from `config.template.json` merged with any CLI overrides. Print a bootstrap summary listing created paths and achieved confidence.

- [ ] **Step 6: Verify**

Run: `grep -E 'Explore|AskUserQuestion|spec-driven-eval|PROJECT-CONTEXT' plugins/my-skills/skills/orchestrator/SKILL.md`
Expected: all four tokens present in the Bootstrap section.
Run: `cat plugins/my-skills/skills/orchestrator/templates/config.template.json | python3 -m json.tool`
Expected: valid JSON with the four keys.

- [ ] **Step 7: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/SKILL.md plugins/my-skills/skills/orchestrator/templates/PROJECT-CONTEXT.template.md plugins/my-skills/skills/orchestrator/templates/config.template.json
git commit -m "feat(orchestrator): bootstrap context gate, materialize, dep check"
```

---

## Task 4: Role templates — brainstormer, architect, coder, reviewer, qa

**Files:**
- Create: `plugins/my-skills/skills/orchestrator/templates/{brainstormer,architect,coder,reviewer,qa}.md`
- Reference (read-only source): `docs/orchestrator/{brainstormer,architect,coder,reviewer,qa}.md`

**Interfaces:**
- Consumes: `references/artifact-format.md`, `.orchestrator/PROJECT-CONTEXT.md` (at the generated agent's runtime).
- Produces: the five generic role agents. Each preserves its existing **stdout output-summary contract** unchanged (the `AGENT — ID created` / `Status:` / `Path:` lines parsed by the pipeline).

Apply this **uniform transformation** to each source file (do all five, one commit per file):

- [ ] **Step 1 (per file): Copy structure, strip the project header**

Replace the opening "You are the **X** agent for the **TOODLS** project — …stack…" paragraph with a generic one: "You are the **X** agent. Before doing anything, read `.orchestrator/PROJECT-CONTEXT.md` for the project's stack, commands, layout, conventions, invariants, and out-of-scope list. Treat that file as the single source of project truth." Keep `model:` frontmatter as-is.

- [ ] **Step 2 (per file): Replace the "Read project context" step**

Replace the hard-coded "Step 0/2 — Read project context" list (which names `CLAUDE.md`, `CONTEXT.md`, the ADR, etc.) with: "Read `.orchestrator/PROJECT-CONTEXT.md`, plus any project files it points to."

- [ ] **Step 3 (per file): Externalize the invariants + commands**

Delete the inlined "Load-bearing invariants" list and the canonical command tables (e.g. coder's `apps/backend && yarn …`, architect's per-phase gate list). Replace with: "Apply the Invariants and Commands sections of `PROJECT-CONTEXT.md`." Keep the role's generic *workflow* prose (ID scanning rule, slug rule, TDD ordering, BLOCKED procedure, progress-log format) — those are project-agnostic.

- [ ] **Step 4 (per file): Add artifact-format pointer**

Where the file describes writing its artifact (spec/plan/CR/QA report), add: "Emit the artifact per `references/artifact-format.md` using the configured `output_format`; the stdout summary below is identical regardless of format." Keep the existing frontmatter/body shape as the `md`-mode definition.

- [ ] **Step 5 (per file): Verify no leakage + contract intact**

Run: `grep -iE 'TOODLS|PostGIS|Flutter|NestJS|apps/backend|pt-BR|CONTEXT.md|adr/001' plugins/my-skills/skills/orchestrator/templates/<file>.md`
Expected: no output.
Run: `grep -E '— (SPEC|FEAT|FIX|QAF|CR|QA)' plugins/my-skills/skills/orchestrator/templates/<file>.md` (the stdout summary line)
Expected: the role's summary line still present.

- [ ] **Step 6 (per file): Commit**

```bash
git add plugins/my-skills/skills/orchestrator/templates/<file>.md
git commit -m "feat(orchestrator): generic <role> template"
```

---

## Task 5: Tester template (new role)

**Files:**
- Create: `plugins/my-skills/skills/orchestrator/templates/tester.md`

**Interfaces:**
- Consumes: `.orchestrator/PROJECT-CONTEXT.md` (Test tooling + Critical flows sections), `references/artifact-format.md`.
- Produces: the tester agent and its stdout contract: `TESTER — TEST-{NNN} created`, `Status: PASS | BELOW_FLOOR | BLOCKED`, `Report: <path>`, `Coverage: {pct}%`. Consumed by the Pipeline (Task 6).

- [ ] **Step 1: Write frontmatter + role intro**

`name: tester`, `model: opus`, description: "Proves the coder's work is built and behaving — selective e2e on critical flows, 70% coverage floor, test-quality audit." Intro: read `.orchestrator/PROJECT-CONTEXT.md` first; never touch production source except test files; runs after coder DONE, before reviewer.

- [ ] **Step 2: Write the workflow steps**

```markdown
## Step 1 — Read context and the plan
Read PROJECT-CONTEXT.md (Test tooling, Critical flows) and the plan file for {PLAN-ID}.

## Step 2 — Critical-flow triage
From the plan's acceptance criteria and PROJECT-CONTEXT Critical flows, list candidate
flows. For each, score criticality (user impact × breakage likelihood × not-covered-by-unit).
Select ONLY high-criticality flows for e2e — e2e is expensive; justify each inclusion and
each deliberate exclusion in the report.

## Step 3 — Implement selected e2e tests
Using the e2e framework from PROJECT-CONTEXT, write e2e tests for the selected flows only.
Run them; they must pass. Touch test files only.

## Step 4 — Test-quality audit + coverage floor
Run the coverage command from PROJECT-CONTEXT. If line coverage < 70%, add unit/integration
tests (not e2e) for the lowest-covered code paths in this plan's diff until ≥ 70% or no
further meaningful tests remain. Audit existing coder tests for assertion quality (no empty
asserts, no tautologies); note weak tests.

## Step 5 — Write the tester report
Emit a TEST-{NNN} report per references/artifact-format.md: flows selected/excluded with
rationale, e2e added, coverage before/after, weak tests found. Set status:
- PASS — e2e green and coverage ≥ 70%
- BELOW_FLOOR — coverage still < 70% after best effort (report why)
- BLOCKED — cannot run e2e/coverage tooling (missing command in PROJECT-CONTEXT)
```

- [ ] **Step 3: Write the stdout output contract**

```markdown
## Output to user
TESTER — TEST-{NNN} created
Status: PASS | BELOW_FLOOR | BLOCKED
Report: plans/test/TEST-{NNN}-{slug}.{md|html}
Coverage: {before}% → {after}%
Next: invoke /reviewer with plan ID {PLAN-ID}
```

- [ ] **Step 4: Verify**

Run: `grep -E 'TESTER — TEST-|BELOW_FLOOR|Coverage:' plugins/my-skills/skills/orchestrator/templates/tester.md`
Expected: all three present.
Run: `grep -iE 'TOODLS|Flutter|NestJS|pt-BR' plugins/my-skills/skills/orchestrator/templates/tester.md`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/templates/tester.md
git commit -m "feat(orchestrator): tester role template"
```

---

## Task 6: Pipeline state machine

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator/SKILL.md` (fill `## Pipeline`)
- Reference (read-only source): `docs/orchestrator/SKILL.md`

**Interfaces:**
- Consumes: config (caps, format), the six generated agents' stdout contracts (Tasks 4–5).
- Produces: the full pipeline section invoked by Lifecycle (Task 1), ending in `READY_TO_COMMIT` which triggers Task 7.

- [ ] **Step 1: Port Step 0 pre-flight**

Copy the existing pre-flight (clean isolated workspace; never run on protected branch or dirty tree; branch/worktree options) from `docs/orchestrator/SKILL.md` verbatim — it is already project-agnostic. Initialize `review_cycle = 0`, `qa_cycle = 0`.

- [ ] **Step 2: Write the forward path with tester inserted**

Steps: brainstormer → architect → coder → **tester** → reviewer → qa. For each, give the spawn prompt (self-contained), the stdout fields to parse, and the file-verification read (using the `.md|.html` extension from `output_format`). Insert tester between coder-DONE and reviewer:

```markdown
### Step 3b — Tester
After coder reports DONE, invoke tester with the plan ID. Parse:
- tester_status — PASS | BELOW_FLOOR | BLOCKED
- test_report_path
If BLOCKED → stop and report (tooling gap in PROJECT-CONTEXT).
If BELOW_FLOOR → surface to the user as a soft warning; continue to reviewer
  (coverage floor is advisory, not a hard stop — reviewer/qa still run).
If PASS → continue to reviewer.
```

- [ ] **Step 3: Write the review fix loop**

Port the existing reviewer loop: `REQUEST_CHANGES` → architect(fix) → coder → reviewer, capped at `max_review_cycles`. Add the tester re-run rule: re-invoke tester before the next reviewer pass ONLY if the fix touched production code (coder's summary indicates non-test files changed) or the reviewer CR flagged a test gap.

- [ ] **Step 4: Write the qa loop**

Port the existing qa loop: `APPROVED` → qa; `BLOCKED` → architect(qa) → coder → reviewer → qa, capped at `max_qa_cycles`; `BLOCKED_STALE` → stop (operator decision). On `READY_TO_COMMIT` → proceed to Step 7.

- [ ] **Step 5: Port the parsing table**

Copy the agent-output parsing table from `docs/orchestrator/SKILL.md` and add the tester row (`TESTER — TEST-{NNN} created`, `Status: PASS | BELOW_FLOOR | BLOCKED`, `Report: {path}`).

- [ ] **Step 6: Verify**

Run: `grep -E 'Step 3b — Tester|review_cycle|qa_cycle|max_review_cycles|max_qa_cycles' plugins/my-skills/skills/orchestrator/SKILL.md`
Expected: all present.
Run: `grep -E 'brainstormer.*architect.*coder.*tester.*reviewer.*qa' plugins/my-skills/skills/orchestrator/SKILL.md`
Expected: the pipeline order line present.

- [ ] **Step 7: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/SKILL.md
git commit -m "feat(orchestrator): pipeline state machine with tester"
```

---

## Task 7: Spec eval + final report

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator/SKILL.md` (fill `## Spec eval + report`)

**Interfaces:**
- Consumes: the brainstormer `SPEC-{NNN}` path, the accumulated diff, the `spec-driven-eval` skill, tester/qa statuses.
- Produces: the terminal report; no git mutation.

- [ ] **Step 1: Write the spec-driven-eval invocation**

```markdown
On READY_TO_COMMIT:
1. If spec-driven-eval is unavailable (user declined install at bootstrap) → skip eval,
   note "eval skipped — skill not installed" in the report, continue to Step 2.
2. Else invoke the spec-driven-eval skill, passing the brainstormer SPEC-{NNN} path and the
   accumulated diff (`git diff` against the pre-flight base). Capture its validation result.
   NOTE: verify spec-driven-eval's expected input shape; if it does not accept SPEC-{NNN}
   directly, adapt by passing the spec's Functional requirements section as the criteria.
```

- [ ] **Step 2: Write the final report composer**

```markdown
Compose and PRINT (do not write files unless output_format=html, then also write a report html):

ORCHESTRATOR — pipeline complete
Spec: {spec_path}
Final plan: {plan_id}
Tester: {tester_status} (coverage {after}%)
QA report: {qa_report_path}
Spec eval: {PASS | ISSUES | SKIPPED}
Issues found:
  - {issue} (or "none")

Proposed commit message:
  {Conventional-Commit subject + body derived from the spec + diff}

Proposed PR message:
  ## Summary
  {what changed, why}
  ## Test plan
  {e2e flows covered, coverage %, gate results}

Review cycles used: {review_cycle} / {max_review_cycles}
QA cycles used: {qa_cycle} / {max_qa_cycles}

Output only — review the diff, then commit and open the PR yourself.
```

- [ ] **Step 3: Verify**

Run: `grep -E 'spec-driven-eval|Proposed commit message|Proposed PR message|Spec eval:' plugins/my-skills/skills/orchestrator/SKILL.md`
Expected: all present.

- [ ] **Step 4: Commit**

```bash
git add plugins/my-skills/skills/orchestrator/SKILL.md
git commit -m "feat(orchestrator): spec-driven-eval stage and final report"
```

---

## Task 8: Plugin wiring + end-to-end smoke

**Files:**
- Modify: `plugins/my-skills/.claude-plugin/plugin.json` (if it enumerates skills — confirm by reading it first)
- Modify: `plugins/my-skills/README.md`

**Interfaces:**
- Consumes: the finished skill package.
- Produces: a discoverable, installed `orchestrator` skill.

- [ ] **Step 1: Inspect plugin manifest**

Run: `cat plugins/my-skills/.claude-plugin/plugin.json`
If it lists skills explicitly, add `orchestrator`. If skills are auto-discovered from the `skills/` dir, no change needed — note that in the commit body.

- [ ] **Step 2: Document the skill in README**

Add an `orchestrator` entry: what it does, `/orchestrator "<task>"`, `--setup`, the four config vars, and the spec-driven-eval dependency.

- [ ] **Step 3: Dry-run the lifecycle against a scratch dir**

Run: create an empty temp git repo, invoke the skill's bootstrap logic mentally/manually against it — confirm the dispatch reads "no `.orchestrator/config.json` → bootstrap". This is a structural read-through, not an automated test.
Run: `grep -RIl 'PROJECT-CONTEXT.md' plugins/my-skills/skills/orchestrator/templates/`
Expected: all six role templates reference it.

- [ ] **Step 4: Final leakage sweep**

Run: `grep -RiE 'TOODLS|PostGIS|pt-BR|apps/backend' plugins/my-skills/skills/orchestrator/`
Expected: no output anywhere in the skill package.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/.claude-plugin/plugin.json plugins/my-skills/README.md
git commit -m "feat(orchestrator): register skill + document usage"
```

---

## Self-Review

**Spec coverage:**
- Context gate (95%, inline interview + scan subagent) → Task 3 (B1). ✓
- Thin agents + single PROJECT-CONTEXT.md → Tasks 4, 5 + Task 3 (B3). ✓
- Config vars (4) → Task 2 (config.md) + Task 3 (materialize). ✓
- md|html output → Task 2 (artifact-format.md) + Task 4 step 4 + Task 7 step 2. ✓
- Lifecycle auto-detect / `--setup` → Task 1. ✓
- Tester role (coder→tester→reviewer, e2e + 70% floor + audit) → Task 5 + Task 6 step 2. ✓
- tester/qa scope split → Task 5 (e2e/floor/audit) vs ported qa (gates) Task 4. ✓
- spec-driven-eval dependency check → Task 3 (B2); eval on READY_TO_COMMIT → Task 7. ✓
- Final report (validation + commit msg + PR msg) → Task 7 step 2. ✓
- Pre-flight + cycle caps → Task 6. ✓

**Risks carried from spec (verify during execution):**
- spec-driven-eval input contract (Task 7 step 1 has an adapter fallback).
- Plugin template path resolution at runtime (Task 8 step 1 inspects the manifest).
- Coverage command must exist in PROJECT-CONTEXT or tester returns BLOCKED (Task 5 step 2).

**Type/contract consistency:** tester stdout contract (`TESTER — TEST-{NNN}`, `PASS|BELOW_FLOOR|BLOCKED`, `Report:`, `Coverage:`) defined in Task 5 and consumed identically in Task 6 steps 2/5. Pipeline order string identical in Global Constraints, Task 6. ✓
