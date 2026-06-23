---
name: product-manager
description: Autonomously drives a scoped branch of the roadmap to completion — feeds each user story's brief to the orchestrator, then commits with the Roadmap-Story trailer, syncs the roadmap, pushes, and opens a stacked PR per story. Use when the user invokes "/product-manager complete <scope>", says "complete the milestone/phase/roadmap autonomously", or wants the roadmap implemented story by story. Action skill — runs git, invokes the orchestrator, commits, pushes, and opens PRs. Default conservative=true (stops at human-validation spots).
---

# product-manager

**PM is the glue between the roadmap skill (plans and tracks, never runs code) and the orchestrator skill (implements, never commits).** Given a scope argument, PM resolves which user stories to execute, feeds each story's `## Brief` to the orchestrator, and drives the full git-and-PR sequence to completion. The roadmap and orchestrator never communicate directly — PM is the connector.

For each story in the resolved queue, PM: (1) cuts a stacked branch, (2) invokes the orchestrator, (3) commits with the `Roadmap-Story:` trailer, (4) runs `/roadmap sync`, (5) commits the sync docs, (6) pushes, and (7) opens a PR. Conservative mode (the default) halts after any story that requires human validation; autonomous mode records the spot and continues.

---

## What this skill does NOT do

- Does **not** bootstrap the orchestrator (`.orchestrator/config.json` must already exist — run `/orchestrator --setup first` if missing).
- Does **not** build or re-evaluate the roadmap (`/roadmap/roadmap.lock.json` must already exist — run `/roadmap first` if missing).
- Does **not** merge pull requests — merging is a human action performed after code review and CI.
- Does **not** write specs, plans, or implementation code itself — those are orchestrator responsibilities.

---

## Invocation + Config

```
/product-manager complete <scope> [--conservative=true|false] [--base <branch>] [--dry-run]
```

| Argument / Flag | Values | Description |
|---|---|---|
| `<scope>` | `roadmap`, milestone id (e.g. `001` or `001-bootstrap`), phase id (e.g. `001.2`) | Which user stories to execute. See `references/scope-resolution.md` → **Scope matching**. |
| `--conservative` | `true` (default) \| `false` | When `true`, halt after any story that requires human validation. When `false`, continue and queue the validation spot. |
| `--base <branch>` | branch name | Override the run base branch (the branch PM started on is used if omitted). |
| `--dry-run` | flag | Print the resolved story queue, mode, and git plan — then stop without asking for confirmation and without executing anything. |

**Config precedence:**

```
CLI flag > /roadmap/pm.config.json > built-in default
```

Default: `conservative=true`.

**Config keys (`/roadmap/pm.config.json`):**

| Key | Type | Precedence | Description |
|---|---|---|---|
| `conservative` | bool | `--conservative` flag > `pm.config.json.conservative` > `true` | Halt after a human-validation spot when `true`. |
| `base_branch` | string | `--base` flag > `pm.config.json.base_branch` > the starting branch | The run base branch used by `references/git-flow.md` → Base resolution. When neither `--base` nor `base_branch` is set, the branch PM was invoked on is the run base. |

---

## Pre-flight

PM performs the following checks and preparations before executing any story. All checks run up-front; the first failure stops the run with a specific remedy.

1. **Require `/roadmap/roadmap.lock.json`.** If the file is absent, stop: `run /roadmap first`.
2. **Require `.orchestrator/config.json`.** If the file is absent, stop: `run /orchestrator --setup first`.
3. **Require a clean working tree.** Run `git status --porcelain`. If any modified, staged, or untracked files exist, stop and ask the user to commit or stash before continuing.
4. **Require `gh` available.** Run `gh --version`. If the command is not found, stop and tell the user to install the GitHub CLI.
5. **Resolve scope.** Apply the full scope matching algorithm from `references/scope-resolution.md` → **Scope matching** to convert `<scope>` into a candidate story set. On an unrecognized scope value, stop and print valid scope ids.
6. **Filter.** Drop every candidate story whose `status` is `done` or `superseded` (see `references/scope-resolution.md` → **Filter**).
7. **Topo-sort.** Apply the ordering algorithm from `references/scope-resolution.md` → **Ordering algorithm** to produce the story queue. On a dependency cycle, stop and report the offending ids. Check all out-of-scope dependencies per `references/scope-resolution.md` → **Out-of-scope dependencies**; in conservative mode, stop if any unmet out-of-scope dependency is found.
8. **Print queue + confirmation.** Display the story queue in execution order, the active mode (`conservative` or `autonomous`), and the git plan (base branch, branch names that will be cut, PR targets). Then ask a **single up-front confirmation** — approving this prompt authorizes PM to push branches and open PRs for all stories in the queue. No further confirmation is requested per story.

`--dry-run` exits after printing the queue, mode, and git plan — without asking for confirmation. Dry-run never errors: an unmet out-of-scope dependency (see `references/scope-resolution.md` → **Out-of-scope dependencies**) is **reported** as part of the printed plan rather than hard-stopping. The conservative out-of-scope stop applies only to a real (non-dry-run) execution; `--dry-run` always just prints and exits.

> **Note — protected starting branch is allowed.** The branch PM is invoked on may be protected (`main`/`master`/`dev`/`develop`/`trunk`). That is fine: PM never runs the orchestrator on the starting branch directly — it always cuts non-protected `pm/<id>-<slug>` branches off it (per-story loop step 1). When the starting branch is protected, it serves as the **integration base**: each story's PR targets it (for independent stories) or the predecessor `pm/` branch (for stacked stories), so the orchestrator never runs on a protected branch.

---

## Per-story loop

For each story in the queue, PM executes the following steps in order:

1. **Resolve base and cut branch.** Determine the base commit using the rules in `references/git-flow.md` → **Base resolution**, then cut `pm/<id>-<slug>` from it per `references/git-flow.md` → **Branch naming** and **Cutting the branch**.

2. **Run the orchestrator.** Invoke the `orchestrator` skill with the story's `## Brief` section passed verbatim as the task input. Do not summarize, rewrite, or trim the brief — it is an orchestrator-ready contract and must be handed over exactly as written.

   **Answer the orchestrator's Step 0 prompt with option 1.** The orchestrator's Step 0 pre-flight always asks a workspace question and never auto-selects (orchestrator `SKILL.md` → Step 0, Case A). PM has already cut and checked out `pm/<id>-<slug>`, and the single up-front confirmation authorizes this run, so PM answers Step 0 on the user's behalf by choosing **"use this branch"**. PM MUST NOT pick new-branch, new-worktree, or cancel — those move the work off the `pm/<id>-<slug>` branch PM tracks and push, yielding an empty PR / trailer mismatch.

3. **Read terminal state.** Wait for the orchestrator to reach a terminal state, then read the result from the orchestrator's final printed report (it prints exactly one of the two banners below at the end of the run).
   - **Success** = the orchestrator prints its `ORCHESTRATOR — pipeline complete` final report, which only happens when QA returned `READY_TO_COMMIT` or `READY_WITH_WARNINGS` (the report's QA line shows which). The proposed commit message and PR message PM uses in step 4 are read from this report. → proceed to step 4.
   - **Stop** = the orchestrator prints any stop banner with a `Status: STALLED` line (cycle-limit reached, tester BLOCKED, qa BLOCKED_STALE, or spec still in DRAFT). There is no terminal `BLOCKED` status — `BLOCKED` is only an internal intermediate the orchestrator resolves via its fix/QA loops and never the final printed state. On any `Status: STALLED` banner, halt the entire PM run: report the stop banner, the story id, and the remaining queue. Do not proceed to any further story.

4. **Execute the success-path sequence** (see `references/git-flow.md` → **Success-path sequence**). The ordering below is load-bearing — PM's own log/queue writes must be staged into the sync-docs commit so the working tree is clean before the next story's branch is cut:
   - Commit with the `Roadmap-Story: <id>` trailer using the orchestrator's proposed commit message.
   - Run `/roadmap sync` (after the trailer commit exists in git log).
   - **Human-validation check** (step 5 below) — runs here so its outcome (autonomous-mode queue row, PR-body note) is known before the sync-docs commit and the PR are created.
   - **Append the `pm-progress.md` log row** (step 6 below) — written now, before the sync-docs commit.
   - Commit the roadmap doc changes (`roadmap.lock.json`, READMEs) **together with** the just-written `/roadmap/pm-progress.md` row and any `/roadmap/human-validation-queue.md` change, in one `docs(roadmap): sync <id>` commit. Folding PM's logs into this commit keeps the tree clean for the next iteration (see `references/git-flow.md` → Success-path sequence step 3).
   - Push `pm/<id>-<slug>` to origin.
   - Render `templates/pr-body.template.md` with all tokens substituted and open the PR using `gh pr create --body-file`.

5. **Human-validation check.** Scan the story's `## Acceptance` section and the orchestrator's QA report for validation markers (see `references/human-validation.md` → **Detection sources**). Then apply mode behavior:
   - **conservative (default):** if flagged, halt the loop after the PR is open and surface a validation request. The user re-runs PM with the same scope to resume — the Filter step will skip the now-`done` story automatically.
   - **autonomous (`--conservative=false`):** if flagged, append a row to `/roadmap/human-validation-queue.md` (this change is committed as part of the `docs(roadmap): sync <id>` commit in step 4) and continue to the next story.

6. **Append log entry.** Write one row to `/roadmap/pm-progress.md` using `templates/pm-progress-entry.template.md` (see `references/resume-and-logging.md` → **Log** and **Entry fields**). The log is append-only; existing rows are never modified. This row is staged into the same `docs(roadmap): sync <id>` commit (step 4) so it does not dirty the tree for the next story.

---

## Error handling

- **Missing `/roadmap/roadmap.lock.json`** → stop: `run /roadmap first`.
- **Missing `.orchestrator/config.json`** → stop: `run /orchestrator --setup first`.
- **Dirty working tree** → stop: commit or stash changes before running PM.
- **`gh` not found** → stop: install the GitHub CLI and ensure it is authenticated.
- **Orchestrator prints a `Status: STALLED` stop banner** (cycle-limit, tester BLOCKED, qa BLOCKED_STALE, or spec DRAFT) → stop the entire run. Report the stop banner, the story id, and the unprocessed queue. Stories completed before the stall are preserved (their branches, commits, and PRs remain). Note: there is no terminal `BLOCKED` status — `BLOCKED` is an internal intermediate only; PM keys off the orchestrator's printed STALLED banner.
- **Dependency cycle detected** → stop before executing any story and report the offending story ids.
- **Unrecognized `<scope>` argument** → stop and print the list of valid milestone ids and phase ids from `roadmap.lock.json`.
- **Trailer mismatch after `/roadmap sync`** → warn and stop. If the story's `roadmap.lock.json` status is not `done` after sync, the trailer may contain a typo. See `references/git-flow.md` → **Trailer-mismatch guard**.

---

## References

All normative details live in these files (relative to `plugins/my-skills/skills/product-manager/`):

| File | Content |
|---|---|
| `references/scope-resolution.md` | Scope matching, Filter, Ordering algorithm, Out-of-scope dependencies |
| `references/git-flow.md` | Base resolution, Branch naming (`pm/<id>-<slug>`), Success-path sequence (commit+trailer → /roadmap sync → commit sync docs → push → stacked PR), Stacked PR ordering, Trailer-mismatch guard |
| `references/human-validation.md` | Detection sources, conservative mode, autonomous mode, Marker list, Invariant |
| `references/resume-and-logging.md` | `/roadmap/pm-progress.md` log, Entry fields, Resume algorithm (including stacked-branch reconstruction) |

Templates:

| Template | Used for |
|---|---|
| `templates/pr-body.template.md` | PR body rendered per story before `gh pr create` |
| `templates/pm-progress-entry.template.md` | One appended row per story attempt in `/roadmap/pm-progress.md` |
