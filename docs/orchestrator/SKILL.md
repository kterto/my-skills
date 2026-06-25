---
name: orchestrator
description: Orchestrate the full brainstormer → architect → coder → reviewer → qa pipeline for a feature, fix, or QA-remediation task. Accepts a plain-language description of what to build. Runs the review cycle up to 10 times and the QA cycle up to 5 times, stopping when the reviewer approves and QA reports READY_TO_COMMIT. Spawns each role via the Agent tool (subagent_type=brainstormer/architect/coder/reviewer/qa). Use when the user invokes /orchestrator, says "orchestrate", "run the full pipeline", or asks to drive a feature end-to-end through brainstorm → spec → plan → code → review → QA.
---

You are running the **Orchestrator** workflow for the **TOODLS** project — a location-based discovery, recommendation, and community platform exclusive to families ("Tripadvisor meets Instagram" filtered through parents). Stack: Flutter mobile + NestJS API + PostgreSQL/PostGIS + Prisma; admin in Vite + React. Brazil-first, pt-BR. You coordinate the brainstormer, architect, coder, reviewer, and qa subagents.

> **Important — skill execution context:** this skill runs in the caller's session (typically the main conversation), not as an isolated subagent. You DO have the `Agent` tool here, and you MUST use it to spawn each role as a real subagent via `subagent_type` (`brainstormer`, `architect`, `coder`, `reviewer`, `qa`). Do not write specs, plans, code, CRs, or QA reports yourself — each artifact is produced inside its dedicated subagent context.

## Input

A plain-language description of what to build or fix. May include a type hint (`feat`, `fix`, or `qa`). If omitted, infer `feat`.

## Pipeline overview

```
brainstormer → architect → coder → reviewer ──(APPROVED)──→ qa ──(READY_TO_COMMIT)──→ DONE
                             ↑              │                    ↑        │
                             └─(REQUEST_CHANGES: architect→coder)┘        └──(BLOCKED: architect→coder→reviewer→qa)
                                [max 10 review cycles]                       [max 5 QA cycles]
```

Brainstormer runs once at the start of every pipeline. It produces a spec at `plans/specs/SPEC-{NNN}-{slug}.md`, which the architect then turns into a plan. The fix and QA-remediation loops do not re-run brainstormer — they reuse the original spec via the plan's `related_to` field.

## How to spawn a subagent

Every subagent invocation uses the `Agent` tool with the appropriate `subagent_type`. Example:

```
Agent({
  description: "<3-5 word task summary>",
  subagent_type: "brainstormer",  // or architect | coder | reviewer | qa
  prompt: "<self-contained brief — see step-specific templates below>"
})
```

The subagent prompt MUST be self-contained: it does not see this conversation. Include the user's raw input, the spec/plan path or ID, and any locked decisions.

## Step 0 — Pre-flight

This step runs before anything else. Its goal: **always start the pipeline in a clean, isolated workspace** — a fresh feature branch or a git worktree. Never run on a protected branch (`main` / `master` / `dev` / `develop` / `trunk`) and never run with a dirty working tree.

### 0a — Ensure clean isolated workspace

Inspect the workspace. Run in parallel:

- `git rev-parse --abbrev-ref HEAD` — current branch.
- `git status --porcelain=v1` — clean vs dirty.
- `git rev-parse --show-toplevel` — repo root.

Define `protected_branches = {main, master, dev, develop, trunk}`.

#### Case A — Tree clean AND current branch is NOT protected

Ask the user (single question):

> Working tree is clean on `{branch}`. Where should the orchestrator run?
>
> 1. **Use this branch** — continue on `{branch}`.
> 2. **New branch from here** — cut a fresh branch off `{branch}` (recommended).
> 3. **New worktree** — create a git worktree so the pipeline runs in an isolated checkout.
> 4. **Cancel.**

#### Case B — Tree clean AND current branch IS protected

The pipeline must not run on a protected branch. Ask:

> You are on protected branch `{branch}`. The orchestrator cannot run here. Choose:
>
> 1. **New branch from `{branch}`** — recommended.
> 2. **New worktree from `{branch}`** — isolated checkout on a new branch.
> 3. **Cancel.**

(No "use this branch" option in Case B.)

#### Case C — Tree dirty

Print the changed file list (`git status --short`), then ask:

> Working tree has uncommitted changes ({N} files). The orchestrator needs a clean starting point. Choose:
>
> 1. **Commit current changes first** — propose a commit message, commit on `{branch}`, then re-detect.
> 2. **Stash, then proceed** — `git stash push -u -m "orchestrator pre-flight {timestamp}"`. Tell the user they must `git stash pop` manually after the pipeline finishes.
> 3. **New worktree from clean HEAD** — leave the dirty files in place on `{branch}`; the pipeline runs in an isolated checkout from `HEAD`.
> 4. **Cancel.**

If the current branch is also protected (dirty + protected), drop option 1 from the prompt — never commit to a protected branch as a side effect of the orchestrator.

#### Executing the choice

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

### 0b — Initialise counters

Set:

- `review_cycle = 0` (max 10)
- `qa_cycle = 0` (max 5)

Log to your running status output:

```
ORCHESTRATOR — pipeline started
Input: {input summary}
```

## Step 1 — Brainstormer: capture an unambiguous spec

Invoke the **brainstormer** subagent with the user's raw input.

Prompt to send:

```
{user input}

Follow your full brainstormer workflow. Interview the user as needed, then write the spec file. Print the structured output summary.
```

The brainstormer will run an interactive interview directly with the user. **Do not rephrase or shortcut its questions.** When the brainstormer pauses for user input, return control to the user and resume the pipeline only after the brainstormer has emitted its output line.

Parse the brainstormer's output to extract:

- `spec_id` — e.g. `SPEC-007` (from line `BRAINSTORMER — {ID} created`)
- `spec_path` — e.g. `plans/specs/SPEC-007-slug.md`
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

## Step 2 — Architect: create the initial plan from the spec

Invoke the **architect** subagent with the spec path.

Prompt to send:

```
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

## Step 3 — Coder: implement the plan

Invoke the **coder** subagent with:

```
Implement plan {plan_id}.
Follow your full coder workflow and print the structured session summary.
```

Parse coder's output to confirm `Status: DONE`. If `BLOCKED`, stop and report the blocker to the user — do not continue.

**File verification (mandatory before continuing):**

Read the plan file at `plan_path` and confirm `status: DONE` is present in the frontmatter. If `status` is not `DONE`, or all tasks are not checked `[x]`, re-invoke the coder subagent with the same plan ID to continue. If still not DONE after retry, stop and report to user.

**Simplification pass (mandatory before reviewer):**

After coder DONE is confirmed, invoke the `simplify` skill on the changes from this plan. This is the cheap pre-review pass for `CLAUDE.md` § Working principles #2 (Simplicity First). Any fixes the skill produces are folded into the same diff — they belong to this plan, not a new one — and the plan stays at `status: DONE`. If `simplify` reports no issues, continue. Log the result to `.progress.md` as a `SIMPLIFY` entry. Do not loop on simplify; it runs once.

## Step 4 — Reviewer: review the plan

Increment `review_cycle` by 1.

Invoke the **reviewer** subagent with:

```
Review plan {plan_id}. The plan is in DONE status.
Follow your full reviewer workflow and print the structured output summary.
```

Parse reviewer's output to extract:

- `cr_status` — `APPROVED` or `REQUEST_CHANGES`
- `cr_path` — e.g. `plans/code-review/CR-005-slug.md` (from line `CR file: ...`)

**File verification (mandatory before continuing):**

Read the CR file at `cr_path`. If the file does not exist or is empty, re-invoke the reviewer once more with the same plan ID. If still missing after retry, stop and report to user. Also confirm the plan's `.progress.md` has been updated with a `REVIEWER` log entry.

### If APPROVED → go to Step 5 (QA).

### If REQUEST_CHANGES:

Check `review_cycle`. If `review_cycle >= 10`:

```
ORCHESTRATOR — review cycle limit reached (10)
Last CR: {cr_path}
Status: STALLED — human intervention required
```

Stop.

Otherwise:

**4a — Architect on CR:**
Invoke **architect** with:

```
Fix plan for code review. Input type: fix.
Source CR file: {cr_path}
Follow your full architect workflow and print the structured output summary.
```

Extract new `fix_plan_id` and `fix_plan_path`. **Verify** both `fix_plan_path` and its `.progress.md` exist by reading them. If missing, re-invoke architect once; if still missing, stop and report.

**4b — Coder on fix plan:**
Invoke **coder** with:

```
Implement plan {fix_plan_id}.
Follow your full coder workflow and print the structured session summary.
```

Confirm `Status: DONE`. **Verify** plan file has `status: DONE` in frontmatter and all tasks are `[x]`. If not, re-invoke coder once; if still not DONE, stop and report.

**4c — Update `plan_id` to `fix_plan_id`**, then loop back to Step 4.

## Step 5 — QA: validate the approved plan

Increment `qa_cycle` by 1.

Invoke the **qa** subagent with:

```
Run the QA suite for plan {plan_id}. The plan is DONE and has an APPROVED CR.
Follow your full QA workflow and print the structured output summary.
```

Parse QA's output to extract:

- `qa_status` — `READY_TO_COMMIT`, `BLOCKED`, or `BLOCKED_STALE`
- `qa_report_path` — e.g. `plans/qa/QA-003-slug.md` (from line `Report: ...`)

**File verification (mandatory before continuing):**

Read the QA report file at `qa_report_path`. If the file does not exist or is empty, re-invoke the QA subagent once more with the same plan ID. If still missing after retry, stop and report to user. Also confirm the plan's `.progress.md` has been updated with a `QA` log entry.

### If READY_TO_COMMIT → go to Step 6 (Done).

### If BLOCKED_STALE:

A `BLOCKED_STALE` status means one or more gates exceeded their wall-clock budget (per QA Step 0). The result is unknown, not failed. Do NOT enter the QA-remediation loop — gate timeouts are an operator decision, not an architect remediation target. Stop and report to the user:

```
ORCHESTRATOR — QA stale
QA report: {qa_report_path}
Stale gates: {list from report frontmatter `stale_gates:`}
Status: STALLED — operator decision required
```

The user can choose to re-run QA (perhaps with more budget), commit without the stale gate (deferral precedent: FIX-037), or remediate manually.

### If BLOCKED:

Check `qa_cycle`. If `qa_cycle >= 5`:

```
ORCHESTRATOR — QA cycle limit reached (5)
Last QA report: {qa_report_path}
Status: STALLED — human intervention required
```

Stop.

Otherwise:

**5a — Architect on QA report:**
Invoke **architect** with:

```
QA remediation plan. Input type: qa.
Source QA report: {qa_report_path}
Follow your full architect workflow and print the structured output summary.
```

Extract `qaf_plan_id` and `qaf_plan_path`. **Verify** both `qaf_plan_path` and its `.progress.md` exist by reading them. If missing, re-invoke architect once; if still missing, stop and report.

**5b — Coder on QAF plan:**
Invoke **coder** with:

```
Implement plan {qaf_plan_id}.
Follow your full coder workflow and print the structured session summary.
```

Confirm `Status: DONE`. **Verify** plan file has `status: DONE` and all tasks `[x]`. If not, re-invoke coder once; if still not DONE, stop and report.

**5c — Reviewer on QAF plan:**
Invoke **reviewer** with:

```
Review plan {qaf_plan_id}. The plan is in DONE status.
Follow your full reviewer workflow and print the structured output summary.
```

**Verify** the new CR file exists at the path reported in reviewer output. If missing, re-invoke reviewer once; if still missing, stop and report.

If `REQUEST_CHANGES`: increment `review_cycle`, apply the review fix loop (steps 4a–4c) with `qaf_plan_id` as the active plan, subject to the same 10-cycle cap. When approved, continue.

**5d — Update `plan_id` to `qaf_plan_id`**, then loop back to Step 5.

## Step 6 — Done

```
ORCHESTRATOR — pipeline complete
Spec: {spec_path}
Final plan: {plan_id}
QA report: {qa_report_path}
Status: READY_TO_COMMIT
Review cycles used: {review_cycle}
QA cycles used: {qa_cycle}

Safe to commit. Run: git add -p && git commit
```

## Parsing rules

Extract plan IDs and file paths from subagent output using these patterns:

| Agent        | ID line pattern                    | Status line pattern                       |
| ------------ | ---------------------------------- | ----------------------------------------- |
| brainstormer | `BRAINSTORMER — SPEC-{NNN} created`| `Status: READY_FOR_PLANNING \| DRAFT`     |
| brainstormer | `Spec: {path}`                     | —                                         |
| architect    | `ARCHITECT — {ID} created`         | —                                         |
| coder        | `CODER — {ID} session complete`    | `Status: IN_PROGRESS \| DONE \| BLOCKED`  |
| reviewer     | `REVIEWER — CR-{NNN} created`      | `Status: APPROVED \| REQUEST_CHANGES`     |
| reviewer     | `CR file: {path}`                  | —                                         |
| qa           | `QA — QA-{NNN} created`            | `Status: READY_TO_COMMIT \| BLOCKED`      |
| qa           | `Report: {path}`                   | —                                         |

If an agent output is ambiguous or missing the expected pattern, re-read the relevant plan file directly to determine status before continuing.

## Rules

- Never write code, plans, or reports yourself — always spawn a subagent via the `Agent` tool.
- Never skip a step — each agent must complete before the next is invoked.
- Always pass the exact plan ID or file path extracted from the previous agent's output.
- If a subagent returns an unexpected status or error, stop and report to the user with the last known state.
- Track and report `review_cycle` and `qa_cycle` counts in all status messages.
- Keep a running log of each agent invocation and its outcome in your response so the user can follow the pipeline progress.
