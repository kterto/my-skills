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

`--dry-run` exits after printing the queue, mode, and git plan — without asking for confirmation.

---

## Per-story loop

For each story in the queue, PM executes the following steps in order:

1. **Resolve base and cut branch.** Determine the base commit using the rules in `references/git-flow.md` → **Base resolution**, then cut `pm/<id>-<slug>` from it per `references/git-flow.md` → **Branch naming** and **Cutting the branch**.

2. **Run the orchestrator.** Invoke the `orchestrator` skill with the story's `## Brief` section passed verbatim as the task input. Do not summarize, rewrite, or trim the brief — it is an orchestrator-ready contract and must be handed over exactly as written.

3. **Read terminal state.** Wait for the orchestrator to reach a terminal state.
   - Success states: `READY_TO_COMMIT` | `READY_WITH_WARNINGS` → proceed to step 4.
   - Stop states: `STALLED` | `BLOCKED` → halt the entire PM run. Report the terminal state, the story id, and the remaining queue. Do not proceed to any further story.

4. **Execute the success-path sequence** (see `references/git-flow.md` → **Success-path sequence**):
   - Commit with the `Roadmap-Story: <id>` trailer using the orchestrator's proposed commit message.
   - Run `/roadmap sync` (after the trailer commit exists in git log).
   - Commit the roadmap doc changes (`roadmap.lock.json`, READMEs) with `docs(roadmap): sync <id>`.
   - Push `pm/<id>-<slug>` to origin.
   - Render `templates/pr-body.template.md` with all tokens substituted and open the PR using `gh pr create --body-file`.

5. **Human-validation check.** Scan the story's `## Acceptance` section and the orchestrator's QA report for validation markers (see `references/human-validation.md` → **Detection sources**). Then apply mode behavior:
   - **conservative (default):** if flagged, halt the loop after the PR is open and surface a validation request. The user re-runs PM with the same scope to resume — the Filter step will skip the now-`done` story automatically.
   - **autonomous (`--conservative=false`):** if flagged, append to `/roadmap/human-validation-queue.md` and continue to the next story.

6. **Append log entry.** Write one row to `/roadmap/pm-progress.md` using `templates/pm-progress-entry.template.md` (see `references/resume-and-logging.md` → **Log** and **Entry fields**). The log is append-only; existing rows are never modified.

---

## Error handling

- **Missing `/roadmap/roadmap.lock.json`** → stop: `run /roadmap first`.
- **Missing `.orchestrator/config.json`** → stop: `run /orchestrator --setup first`.
- **Dirty working tree** → stop: commit or stash changes before running PM.
- **`gh` not found** → stop: install the GitHub CLI and ensure it is authenticated.
- **Orchestrator reaches `STALLED` or `BLOCKED`** → stop the entire run. Report the terminal state, the story id, and the unprocessed queue. Stories completed before the stall are preserved (their branches, commits, and PRs remain).
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
