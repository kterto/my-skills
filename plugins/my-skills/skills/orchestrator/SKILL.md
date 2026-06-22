---
name: orchestrator
description: Multi-role pipeline orchestrator. Use when the user invokes "/orchestrator", says "orchestrate", or asks to "run the full pipeline". Auto-detects whether to run bootstrap (first-time setup) or go straight to the pipeline based on the presence of `.orchestrator/config.json`; pass `--setup` to force bootstrap. Spawns each role (brainstormer → architect → coder → tester → reviewer → qa) as a subagent via `subagent_type`. Never commits or pushes.
---

# orchestrator

This skill runs in the caller session and has the `Agent` tool. It spawns each pipeline role via `subagent_type`. It is project-agnostic — no project facts are hard-coded.

## Lifecycle — auto-detect

On invocation with a plain-language task description (and optional `--setup`):

1. Resolve config (see `references/config.md`): CLI args > `.orchestrator/config.json` > defaults.
2. If `--setup` is present OR `.orchestrator/config.json` does not exist → run **Bootstrap** (Steps B1–B3), then continue.
3. Run **Pipeline** (Steps 0–6).
4. On `READY_TO_COMMIT` → run **Spec eval + report** (Step 7).

## Bootstrap

Bootstrap runs when `--setup` is passed or `.orchestrator/config.json` is absent. It has three steps: B1 context gate, B2 dependency check, B3 materialize.

### B1 — Context gate

1. **Explore scan** (the only subagent in the gate): spawn an `Explore` subagent with the prompt:
   > "Scan this repo and return a structured digest of stack, build/test/lint/e2e/coverage commands, directory layout, naming conventions, and any documented domain rules. Read CLAUDE.md, AGENTS.md, README, and config/manifest files."
   Collect the digest.

2. **AskUserQuestion interview**: using the digest, call `AskUserQuestion` to ask the user only about sections of `context-schema.md` that the scan left ambiguous. Do not ask about sections the scan already covered clearly.

3. **Self-rate confidence**: after each interview round, rate holistic confidence (0–1) that the context is clear and complete across all required sections.

4. **Loop**: repeat steps 2–3 until confidence ≥ `context_threshold`. If the user ends the loop early, record the achieved confidence as-is.

5. **Write PROJECT-CONTEXT.md**: render `templates/PROJECT-CONTEXT.template.md` into `.orchestrator/PROJECT-CONTEXT.md`, filling every section with the information gathered. Every `##` heading in the template corresponds to a required section in `references/context-schema.md`; all must be present.

### B2 — Dependency check

Check whether the `spec-driven-eval` skill is available (look for it in the skills registry or installed skill paths). If it is not found:

- Offer the user to run `npx @tech-leads-club/agent-skills install --skill spec-driven-eval` to install it. Confirm with the user before executing.
- If the user declines, instruct them to run the command manually later.

Record availability in memory for the current run. Do **not** block bootstrap on decline — the eval stage (Step 7) will handle a missing skill gracefully.

### B3 — Materialize

1. **Render agent templates**: copy each of the six files `templates/{role}.md` verbatim into `target/.claude/agents/{role}.md` (roles: brainstormer, architect, coder, tester, reviewer, qa). No substitution is needed — templates are project-agnostic and read `.orchestrator/PROJECT-CONTEXT.md` at runtime.

2. **Materialize artifact rules + html scaffolds (load-bearing).** Subagents cannot read the skill's own `references/` or `templates/html/` directories — those paths do not exist in the target project. Copy them into `.orchestrator/` so every role can read them:
   - `references/artifact-format.md` → `.orchestrator/artifact-format.md`
   - `templates/html/*.template.html` → `.orchestrator/html-templates/` (all seven: spec, plan, test-report, code-review, qa-report, final-report, progress-timeline)

   Re-copy these on every bootstrap (including `--setup` re-runs) so they stay in sync with the installed skill version. If this step is skipped, `output_format=html` silently degrades to md because agents cannot find the scaffolds.

3. **Write config**: merge `templates/config.template.json` with any CLI overrides (precedence: CLI arg > `.orchestrator/config.json` > default) and write the result to `.orchestrator/config.json`.

4. **Print bootstrap summary**: list all created/updated paths (including `.orchestrator/artifact-format.md` and `.orchestrator/html-templates/`) and the achieved context confidence.

## Pipeline

> **Important — skill execution context:** this skill runs in the caller's session (typically the main conversation), not as an isolated subagent. You DO have the `Agent` tool here, and you MUST use it to spawn each role as a real subagent via `subagent_type` (`brainstormer`, `architect`, `coder`, `tester`, `reviewer`, `qa`). Do not write specs, plans, code, test reports, CRs, or QA reports yourself — each artifact is produced inside its dedicated subagent context.

### Pipeline overview

```
brainstormer → architect → coder → tester → reviewer ──(APPROVED)──→ qa ──(READY_TO_COMMIT)──→ DONE
                             ↑                          │                   ↑        │
                             └──(REQUEST_CHANGES: architect→coder→[tester?]→reviewer)┘        └──(BLOCKED: architect→coder→reviewer→qa)
                                [max_review_cycles review cycles]                            [max_qa_cycles QA cycles]
```

Brainstormer runs once at the start of every pipeline. It produces a spec, which the architect turns into a plan. The fix and QA-remediation loops do not re-run brainstormer — they reuse the original spec via the plan's `related_to` field.

### How to spawn a subagent

Every subagent invocation uses the `Agent` tool with the appropriate `subagent_type`. Example:

```
Agent({
  description: "<3-5 word task summary>",
  subagent_type: "brainstormer",  // or architect | coder | tester | reviewer | qa
  prompt: "<self-contained brief — see step-specific templates below>"
})
```

The subagent prompt MUST be self-contained: it does not see this conversation. Include the user's raw input, the spec/plan path or ID, and any locked decisions.

#### Mandatory role-prompt preamble (every spawn)

The subagent cannot see `.orchestrator/config.json` semantics on its own, and self-numbering by subagents is the root cause of duplicate IDs. So the orchestrator resolves both centrally and **prepends this preamble to EVERY role prompt** (brainstormer, architect, coder, tester, reviewer, qa):

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {PREFIX}-{NNN}      ← producing roles ONLY; use verbatim, do not compute your own
```

- `output_format` is resolved once per run (CLI arg > `.orchestrator/config.json` > default `md`).
- `ID to use:` is included for the roles that create a numbered artifact (brainstormer→SPEC, architect→FEAT/FIX/QAF, tester→TEST, reviewer→CR, qa→QA). The coder creates no new artifact, so it gets the preamble WITHOUT an `ID to use:` line.
- Always emit the `.md` artifact; when `output_format=html`, ALSO emit the `.html` rendered view (per `artifact-format.md`).

#### Computing `{PREFIX}-{NNN}` before each producing spawn

Run this exact command (extension-agnostic, correct across the md→html transition) for the role's (dir, prefix) from `artifact-format.md`'s allow-list, then put the result in the `ID to use:` line:

```bash
nextid() {  # $1=dir  $2=prefix
  n=$(ls "$1" 2>/dev/null | grep -oE "^$2-[0-9]{3}" | grep -oE '[0-9]{3}' | sort -n | tail -1)
  printf "%s-%03d\n" "$2" "$(( 10#${n:-0} + 1 ))"
}
# examples:
# nextid plans/specs SPEC ; nextid plans/feat FEAT ; nextid plans/code-review FIX
# nextid plans/qa QAF ; nextid plans/test TEST ; nextid plans/code-review CR
# nextid plans/qa QA ; nextid plans/eval EVAL ; nextid plans/final FINAL
```

Reviewer/architect-fix runs honor an explicit pre-chosen path env var when set (e.g. `MAESTRO_CR_TARGET_PATH`) — in that case use that path's number and skip `nextid`.

### Step 0 — Pre-flight

This step runs before anything else. Its goal: **always start the pipeline in a clean, isolated workspace** — a fresh feature branch or a git worktree. Never run on a protected branch (`main` / `master` / `dev` / `develop` / `trunk`) and never run with a dirty working tree.

#### 0a — Ensure clean isolated workspace

Inspect the workspace. Run in parallel:

- `git rev-parse --abbrev-ref HEAD` — current branch.
- `git status --porcelain=v1` — clean vs dirty.
- `git rev-parse --show-toplevel` — repo root.

Define `protected_branches = {main, master, dev, develop, trunk}`.

##### Case A — Tree clean AND current branch is NOT protected

Ask the user (single question):

> Working tree is clean on `{branch}`. Where should the orchestrator run?
>
> 1. **Use this branch** — continue on `{branch}`.
> 2. **New branch from here** — cut a fresh branch off `{branch}` (recommended).
> 3. **New worktree** — create a git worktree so the pipeline runs in an isolated checkout.
> 4. **Cancel.**

##### Case B — Tree clean AND current branch IS protected

The pipeline must not run on a protected branch. Ask:

> You are on protected branch `{branch}`. The orchestrator cannot run here. Choose:
>
> 1. **New branch from `{branch}`** — recommended.
> 2. **New worktree from `{branch}`** — isolated checkout on a new branch.
> 3. **Cancel.**

(No "use this branch" option in Case B.)

##### Case C — Tree dirty

Print the changed file list (`git status --short`), then ask:

> Working tree has uncommitted changes ({N} files). The orchestrator needs a clean starting point. Choose:
>
> 1. **Commit current changes first** — propose a commit message, commit on `{branch}`, then re-detect.
> 2. **Stash, then proceed** — `git stash push -u -m "orchestrator pre-flight {timestamp}"`. Tell the user they must `git stash pop` manually after the pipeline finishes.
> 3. **New worktree from clean HEAD** — leave the dirty files in place on `{branch}`; the pipeline runs in an isolated checkout from `HEAD`.
> 4. **Cancel.**

If the current branch is also protected (dirty + protected), drop option 1 from the prompt — never commit to a protected branch as a side effect of the orchestrator.

##### Executing the choice

- **Use current branch:** no-op. Continue to Step 0b.
- **New branch:** ask for a branch name. Default: `orch/{YYYY-MM-DD-HHMM}-{first-3-or-4-kebab-words-of-input}` (e.g. `orch/2026-05-21-1430-add-list-sharing`). Run `git checkout -b {name}`. Verify with `git rev-parse --abbrev-ref HEAD`.
- **New worktree:** ask for branch name (same default as above) and worktree path. Default path: `../{repo-name}-{slug}`, or `.worktrees/{slug}` if `.worktrees/` already exists in the repo. Run `git worktree add {path} -b {name}`. `cd {path}` for the rest of the pipeline — every subagent invocation, every file path, every `git` call from here on is rooted at the worktree.
- **Commit first:** show `git diff --stat` and `git diff` (truncated) and propose a Conventional-Commit message based on the dirty diff. Confirm with the user, then `git add` the affected paths explicitly (never `git add -A`) and `git commit`. After commit, re-run the case detection.
- **Stash:** run `git stash push -u -m "orchestrator pre-flight {ISO-timestamp}"`. Explicitly tell the user: *"Your changes are stashed as `{stash-ref}`. Run `git stash pop` after the pipeline finishes."* After the stash, re-run the case detection.
- **Cancel:** stop. Print:

  ```
  ORCHESTRATOR — cancelled at pre-flight
  Reason: user cancelled
  ```

After applying the choice, re-verify:

- `git status --porcelain=v1` is empty.
- Current branch is NOT in `protected_branches`.

If either check still fails, loop back into the appropriate Case prompt — never advance to Step 0b on a dirty or protected workspace.

Log the resolution:

```
ORCHESTRATOR — pre-flight resolved
Workspace: {repo-root | worktree-path}
Branch: {branch}
Strategy: {use-current | new-branch | new-worktree | commit+... | stash+...}
```

#### 0b — Initialise counters

Read cycle caps from config:

- `max_review_cycles` — from `.orchestrator/config.json`; default 10 if absent.
- `max_qa_cycles` — from `.orchestrator/config.json`; default 5 if absent.

Set:

- `review_cycle = 0`
- `qa_cycle = 0`

Log to your running status output:

```
ORCHESTRATOR — pipeline started
Input: {input summary}
max_review_cycles: {max_review_cycles}
max_qa_cycles: {max_qa_cycles}
```

### Step 1 — Brainstormer: capture an unambiguous spec

Compute the spec ID: `nextid plans/specs SPEC`. Invoke the **brainstormer** subagent with the user's raw input, prepending the mandatory role-prompt preamble.

Prompt to send:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed SPEC-NNN}

{user input}

Follow your full brainstormer workflow. Interview the user as needed, then write the spec file. Print the structured output summary.
```

The brainstormer will run an interactive interview directly with the user. **Do not rephrase or shortcut its questions.** When the brainstormer pauses for user input, return control to the user and resume the pipeline only after the brainstormer has emitted its output line.

Parse the brainstormer's output to extract:

- `spec_id` — e.g. `SPEC-007` (from line `BRAINSTORMER — SPEC-{NNN} created`)
- `spec_path` — e.g. `plans/specs/SPEC-007-slug.md` (from line `Spec: {path}`)
- `spec_status` — `READY_FOR_PLANNING` or `DRAFT`

**File verification (mandatory before continuing):**

Read the spec file at `spec_path`. If the file does not exist or is empty, re-invoke the brainstormer once with the same input. If still missing after retry, stop and report to user.

If `spec_status` is `DRAFT` (open questions remain), stop:

```
ORCHESTRATOR — spec still in DRAFT
Spec: {spec_path}
Status: STALLED — resolve open questions and re-run the orchestrator
```

Only continue when `spec_status` is `READY_FOR_PLANNING`.

### Step 2 — Architect: create the initial plan from the spec

Compute the plan ID: `nextid plans/feat FEAT`. Invoke the **architect** subagent with the spec path, prepending the role-prompt preamble.

Prompt to send:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed FEAT-NNN}

Source spec: {spec_path}
Type: feat — derive scope from the spec's functional requirements and project-context fit.
Follow your full architect workflow and print the structured output summary.
```

Parse the architect's output to extract:

- `plan_id` — e.g. `FEAT-003` (from line `ARCHITECT — {ID} created`)
- `plan_path` — e.g. `plans/feat/FEAT-003-slug.md`

If the architect reports an error or does not produce a plan ID, stop and report to user.

**File verification (mandatory before continuing):**

Read the plan file at `plan_path` and the paired `.progress.md` (same path with `.progress.md` suffix replacing `.md`). If either file does not exist or is empty, re-invoke the architect once more with the same prompt. If files still missing after the retry, stop and report to user. Confirm the plan's `related_to` frontmatter references `spec_id`; if not, re-invoke the architect once with the spec path explicitly stated.

### Step 3 — Coder: implement the plan

Invoke the **coder** subagent with the role-prompt preamble (no `ID to use:` line — the coder creates no new artifact; it mutates the existing plan's `.md`):

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)

Implement plan {plan_id}.
Follow your full coder workflow and print the structured session summary.
```

Parse coder's output to confirm `Status: DONE`. If `BLOCKED`, stop and report the blocker to the user — do not continue.

**File verification (mandatory before continuing):**

Read the plan file at `plan_path` and confirm `status: DONE` is present in the frontmatter. If `status` is not `DONE`, or all tasks are not checked `[x]`, re-invoke the coder subagent with the same plan ID to continue. If still not DONE after retry, stop and report to user.

**Simplification pass (mandatory before tester):**

After coder DONE is confirmed, invoke the `simplify` skill on the changes from this plan. This is the cheap pre-review pass for simplicity. Any fixes the skill produces are folded into the same diff — they belong to this plan, not a new one — and the plan stays at `status: DONE`. If `simplify` reports no issues, continue. Log the result to `.progress.md` as a `SIMPLIFY` entry. Do not loop on simplify; it runs once.

### Step 3b — Tester

After coder reports DONE (and the simplification pass has run), compute the report ID: `nextid plans/test TEST`. Invoke the **tester** subagent with the plan ID, prepending the role-prompt preamble.

Prompt to send:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed TEST-NNN}

Run tests for plan {plan_id}.
Follow your full tester workflow and print the structured output summary.
```

Parse the tester's output to extract:

- `tester_status` — `PASS`, `BELOW_FLOOR`, or `BLOCKED`
- `test_report_path` — e.g. `plans/test/TEST-{NNN}-slug.md` (from line `Report: {path}`)

**File verification (mandatory before continuing):**

Read the test report file at `test_report_path` (expect `.md` or `.html` extension per `output_format` in config). If the file does not exist or is empty, re-invoke the tester once with the same plan ID. If still missing after retry, stop and report to user.

**Status handling:**

- If `BLOCKED` → stop and report a tooling gap to the user:

  ```
  ORCHESTRATOR — tester blocked
  Plan: {plan_id}
  Test report: {test_report_path}
  Status: STALLED — tooling gap; human intervention required before continuing
  ```

  If `output_format=html`, run Step 7c (progress timeline render).

- If `BELOW_FLOOR` → surface a soft warning to the user (coverage floor is advisory, not a hard stop — reviewer and qa still run), then continue to Step 4 (Reviewer):

  ```
  ORCHESTRATOR — tester BELOW_FLOOR (soft warning)
  Plan: {plan_id}
  Test report: {test_report_path}
  Coverage is below the configured floor. Continuing to reviewer — reviewer and QA will still run.
  ```

- If `PASS` → continue to Step 4 (Reviewer).

### Step 4 — Reviewer: review the plan

Increment `review_cycle` by 1.

Compute the CR ID: `nextid plans/code-review CR` (unless `MAESTRO_CR_TARGET_PATH` is set — then use that path's number). Invoke the **reviewer** subagent with the role-prompt preamble:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed CR-NNN}

Review plan {plan_id}. The plan is in DONE status.
Follow your full reviewer workflow and print the structured output summary.
```

Parse reviewer's output to extract:

- `cr_status` — `APPROVED` or `REQUEST_CHANGES`
- `cr_path` — e.g. `plans/code-review/CR-005-slug.md` (from line `CR file: {path}`)

**File verification (mandatory before continuing):**

Read the CR file at `cr_path`. If the file does not exist or is empty, re-invoke the reviewer once more with the same plan ID. If still missing after retry, stop and report to user. Also confirm the plan's `.progress.md` has been updated with a `REVIEWER` log entry.

#### If APPROVED → go to Step 5 (QA).

#### If REQUEST_CHANGES:

Check `review_cycle`. If `review_cycle >= max_review_cycles`:

```
ORCHESTRATOR — review cycle limit reached ({max_review_cycles})
Last CR: {cr_path}
Status: STALLED — human intervention required
```

If `output_format=html`, run Step 7c (progress timeline render).

Stop.

Otherwise:

**4a — Architect on CR:**
Compute the fix-plan ID: `nextid plans/code-review FIX`. Invoke **architect** with the role-prompt preamble:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed FIX-NNN}

Fix plan for code review. Input type: fix.
Source CR file: {cr_path}
Follow your full architect workflow and print the structured output summary.
```

Extract new `fix_plan_id` and `fix_plan_path`. **Verify** both `fix_plan_path` and its `.progress.md` exist by reading them. If missing, re-invoke architect once; if still missing, stop and report.

**4b — Coder on fix plan:**
Invoke **coder** with the role-prompt preamble (no `ID to use:` line):

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)

Implement plan {fix_plan_id}.
Follow your full coder workflow and print the structured session summary.
```

Confirm `Status: DONE`. **Verify** plan file has `status: DONE` in frontmatter and all tasks are `[x]`. If not, re-invoke coder once; if still not DONE, stop and report.

**4b2 — Tester re-run (conditional):**
Re-invoke the **tester** before the next reviewer pass ONLY if either condition is true:

- The coder's session summary indicates non-test files were changed (production code touched), OR
- The reviewer CR (`cr_path`) flagged a test gap.

If neither condition applies, skip the tester re-run and proceed directly to 4c.

When re-running tester, compute a fresh report ID (`nextid plans/test TEST`) and use the same preamble as Step 3b but with the active `fix_plan_id`:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed TEST-NNN}

Run tests for plan {fix_plan_id}.
Follow your full tester workflow and print the structured output summary.
```

Apply the same `tester_status` logic: `BLOCKED` → stop; `BELOW_FLOOR` → soft warning, continue; `PASS` → continue.

**4c — Update `plan_id` to `fix_plan_id`**, then loop back to Step 4.

### Step 5 — QA: validate the approved plan

Increment `qa_cycle` by 1.

Compute the QA report ID: `nextid plans/qa QA`. Invoke the **qa** subagent with the role-prompt preamble:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed QA-NNN}

Run the QA suite for plan {plan_id}. The plan is DONE and has an APPROVED CR.
Follow your full QA workflow and print the structured output summary.
```

Parse QA's output to extract:

- `qa_status` — `READY_TO_COMMIT`, `BLOCKED`, or `BLOCKED_STALE`
- `qa_report_path` — e.g. `plans/qa/QA-003-slug.md` (from line `Report: {path}`)

**File verification (mandatory before continuing):**

Read the QA report file at `qa_report_path` (expect `.md` or `.html` extension per `output_format` in config). If the file does not exist or is empty, re-invoke the QA subagent once more with the same plan ID. If still missing after retry, stop and report to user. Also confirm the plan's `.progress.md` has been updated with a `QA` log entry.

#### If READY_TO_COMMIT → proceed to Spec eval + report (Step 7).

#### If READY_WITH_WARNINGS:

All blocking gates passed; the plan is safe to commit. This status indicates that the G8 rework-risk gate scored > 0.5 (HIGH_REWORK), which is advisory only. Treat this as equivalent to READY_TO_COMMIT for flow purposes:

1. Surface the warning to the user:

   ```
   ORCHESTRATOR — QA READY_WITH_WARNINGS
   QA report: {qa_report_path}
   Warning: G8 HIGH_REWORK — rework risk above threshold (non-blocking). Review the QA report before committing.
   ```

2. Carry the warning into the final report (Step 7).
3. Proceed to Spec eval + report (Step 7).

#### If BLOCKED_STALE:

A `BLOCKED_STALE` status means one or more gates exceeded their wall-clock budget (per QA Step 0). The result is unknown, not failed. Do NOT enter the QA-remediation loop — gate timeouts are an operator decision, not an architect remediation target. Stop and report to the user:

```
ORCHESTRATOR — QA stale
QA report: {qa_report_path}
Stale gates: {list from report frontmatter `stale_gates:`}
Status: STALLED — operator decision required
```

If `output_format=html`, run Step 7c (progress timeline render).

The user can choose to re-run QA (perhaps with more budget), commit without the stale gate, or remediate manually.

#### If BLOCKED:

Check `qa_cycle`. If `qa_cycle >= max_qa_cycles`:

```
ORCHESTRATOR — QA cycle limit reached ({max_qa_cycles})
Last QA report: {qa_report_path}
Status: STALLED — human intervention required
```

If `output_format=html`, run Step 7c (progress timeline render).

Stop.

Otherwise:

**5a — Architect on QA report:**
Compute the QAF plan ID: `nextid plans/qa QAF`. Invoke **architect** with the role-prompt preamble:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed QAF-NNN}

QA remediation plan. Input type: qa.
Source QA report: {qa_report_path}
Follow your full architect workflow and print the structured output summary.
```

Extract `qaf_plan_id` and `qaf_plan_path`. **Verify** both `qaf_plan_path` and its `.progress.md` exist by reading them. If missing, re-invoke architect once; if still missing, stop and report.

**5b — Coder on QAF plan:**
Invoke **coder** with the role-prompt preamble (no `ID to use:` line):

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)

Implement plan {qaf_plan_id}.
Follow your full coder workflow and print the structured session summary.
```

Confirm `Status: DONE`. **Verify** plan file has `status: DONE` and all tasks `[x]`. If not, re-invoke coder once; if still not DONE, stop and report.

**5c — Reviewer on QAF plan:**
Compute the CR ID: `nextid plans/code-review CR`. Invoke **reviewer** with the role-prompt preamble:

```
ORCHESTRATOR CONTEXT (authoritative — do not recompute):
output_format={resolved output_format}
Artifact rules: read .orchestrator/artifact-format.md before writing any artifact.
HTML scaffolds: .orchestrator/html-templates/<artifact>.template.html  (only used when output_format=html)
ID to use: {computed CR-NNN}

Review plan {qaf_plan_id}. The plan is in DONE status.
Follow your full reviewer workflow and print the structured output summary.
```

**Verify** the new CR file exists at the path reported in reviewer output. If missing, re-invoke reviewer once; if still missing, stop and report.

If `REQUEST_CHANGES`: increment `review_cycle`, apply the review fix loop (steps 4a–4c) with `qaf_plan_id` as the active plan, subject to the same `max_review_cycles` cap. When approved, continue.

**5d — Update `plan_id` to `qaf_plan_id`**, then loop back to Step 5.

### Parsing rules

Extract plan IDs and file paths from subagent output using these patterns:

| Agent        | ID line pattern                       | Status line pattern                             | Extra line pattern       |
| ------------ | ------------------------------------- | ----------------------------------------------- | ------------------------ |
| brainstormer | `BRAINSTORMER — SPEC-{NNN} created`   | `Status: READY_FOR_PLANNING \| DRAFT`                        | `Spec: {path}`           |
| architect    | `ARCHITECT — {ID} created`            | —                                                            | `Plan: {path}`           |
| coder        | `CODER — {ID} session complete`       | `Status: IN_PROGRESS \| DONE \| BLOCKED`                     | —                        |
| tester       | `TESTER — TEST-{NNN} created`         | `Status: PASS \| BELOW_FLOOR \| BLOCKED`                     | `Report: {path}`         |
| reviewer     | `REVIEWER — CR-{NNN} created`         | `Status: APPROVED \| REQUEST_CHANGES`                        | `CR file: {path}`        |
| qa           | `QA — QA-{NNN} created`              | `Status: READY_TO_COMMIT \| BLOCKED \| READY_WITH_WARNINGS`  | `Report: {path}`         |

If an agent output is ambiguous or missing the expected pattern, re-read the relevant plan file directly to determine status before continuing.

> **Note — BLOCKED_STALE is orchestrator-synthesized:** the qa agent never emits the literal string `BLOCKED_STALE`. The orchestrator infers it from the QA report's `stale_gates:` frontmatter (gate wall-clock timeout exceeded). Do not expect this value in the qa agent's `Status:` output line.

### Rules

- Never write code, plans, test reports, or QA reports yourself — always spawn a subagent via the `Agent` tool.
- Never skip a step — each agent must complete before the next is invoked.
- Always pass the exact plan ID or file path extracted from the previous agent's output.
- Never commit or push — the orchestrator's job ends at `READY_TO_COMMIT`.
- If a subagent returns an unexpected status or error, stop and report to the user with the last known state.
- Track and report `review_cycle` and `qa_cycle` counts in all status messages.
- Keep a running log of each agent invocation and its outcome in your response so the user can follow the pipeline progress.

## Spec eval + report

### Step 7a — Spec-driven-eval invocation

On READY_TO_COMMIT (or READY_WITH_WARNINGS):

1. If spec-driven-eval is unavailable (user declined install at bootstrap B2) → skip eval,
   note "eval skipped — skill not installed" in the report, continue to Step 7b.
2. Else invoke the `spec-driven-eval` skill, passing the brainstormer SPEC-{NNN} path and the
   accumulated diff (`git diff` against the pre-flight base recorded in Step 0). Capture its
   validation result.
   NOTE: the SPEC-{NNN} format may not match spec-driven-eval's expected input — verify its
   expected input shape; if it does not accept SPEC-{NNN} directly, adapt by passing the spec's
   Functional requirements section as the criteria.
3. **Persist the eval artifact** to the canonical `plans/eval/` directory (allow-listed in
   `artifact-format.md`). Compute the ID with `nextid plans/eval EVAL`, derive the slug from the
   plan title, and write `plans/eval/EVAL-{NNN}-{slug}.md` (canonical, with frontmatter
   `id`, `status: PASS | ISSUES | SKIPPED`, `plan`, `created_at`). When `output_format=html`,
   ALSO render `plans/eval/EVAL-{NNN}-{slug}.html` from
   `.orchestrator/html-templates/qa-report.template.html` (closest scaffold) following
   `artifact-format.md`. Never create any directory other than `plans/eval/` for eval output.

### Step 7b — Final report composer

If `output_format=html`, run Step 7c (progress timeline render).

**Persist the final report** to the canonical `plans/final/` directory (allow-listed in
`artifact-format.md`). Compute the ID with `nextid plans/final FINAL`, derive the slug from the
plan title, and ALWAYS write `plans/final/FINAL-{NNN}-{slug}.md` (canonical). When
`output_format=html`, ALSO render `plans/final/FINAL-{NNN}-{slug}.html` from
`.orchestrator/html-templates/final-report.template.html`, filling its Related region with
relative links to the spec, plan, test report, code review, and qa report (per
`artifact-format.md` → Related navigation). Never create any directory other than `plans/final/`
for the final report.

In addition, PRINT the report below to stdout (the printed summary is the same regardless of
mode). If READY_WITH_WARNINGS arrived from QA, carry the G8 warning into the Issues found list.

```
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

### Step 7c — Progress timeline (html mode)

When `output_format=html`, after the pipeline reaches a terminal state, render a progress timeline for the active plan:

1. Read the plan's `.progress.md` log entries (each entry is a role/action with a status word and an ISO-8601 timestamp).
2. Fill `.orchestrator/html-templates/progress-timeline.template.html`: emit one timeline row per log entry (role → action/status → timestamp), mapping each status word to its pill class via the standard mapping (`success | active | warning | danger | muted` — done/PASS/APPROVED/READY_TO_COMMIT→success; in_progress/DRAFT→active; BELOW_FLOOR/READY_WITH_WARNINGS→warning; BLOCKED/BLOCKED_STALE/REQUEST_CHANGES/STALLED→danger; todo/superseded→muted). Fill the `<main data-*>` shell and the Related link to the plan.
3. Write the result to `<plan-path-without-.md>.progress.html` (e.g. `plans/feat/FEAT-003-slug.progress.html`).

This step ALSO runs at the STALLED/BLOCKED stop points (review-cycle limit, qa-cycle limit, tester BLOCKED, qa BLOCKED_STALE) so a halted run still produces a timeline. In `md` mode this step is skipped — `.progress.md` is the only progress artifact.
