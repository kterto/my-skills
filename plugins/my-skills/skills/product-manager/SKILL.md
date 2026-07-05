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

**Run the environment checks (1–4) as the literal shell block below and decide each result ONLY from its printed output.** Do NOT infer a file's presence or absence from context — not from a dirty working tree, not from a prose expectation, not from a file-listing tool that may hide dotfile directories (`.orchestrator/`, `.opencode/`). If `test -f` prints `OK`, the file exists; report it present. Never emit "`.orchestrator/config.json` is missing" unless the block below actually printed `config: MISSING`. Paths are anchored to the git root (`git rev-parse --show-toplevel`) so the checks do not depend on the session's working directory — under opencode the session cwd may differ from the repo root even though `git` still resolves the repo.

Run this first, then read the four result lines:

```bash
root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "preflight: not-a-git-repo"; exit 0; }
test -f "$root/roadmap/roadmap.lock.json" && echo "lock: OK"   || echo "lock: MISSING"
test -f "$root/.orchestrator/config.json" && echo "config: OK" || echo "config: MISSING"
command -v gh >/dev/null 2>&1              && echo "gh: OK"     || echo "gh: MISSING"
# Clean-tree check EXCLUDES host-runtime scaffolding the harness writes into the
# project (opencode's .opencode/, Claude Code's .claude/) — otherwise the tree is
# permanently dirty and PM can never start. All other paths still count.
if [ -n "$(git -C "$root" status --porcelain -- . ':(exclude).opencode' ':(exclude).claude')" ]; then
  echo "tree: DIRTY"; else echo "tree: CLEAN"; fi
```

Apply the printed results in this fixed order; the first failure stops the run with the matching remedy:

1. **`lock: MISSING`** → stop: `run /roadmap first`.
2. **`config: MISSING`** → stop: `run /orchestrator --setup first`. If the line reads `config: OK`, the config exists — proceed; do not override a printed `OK` with an inferred "missing".
3. **`tree: DIRTY`** → stop; list the offending files with `git -C "$root" status --short -- . ':(exclude).opencode' ':(exclude).claude'` and ask the user to commit, stash, or `.gitignore` them before continuing. Host-runtime `.opencode/`/`.claude/` are already excluded here; also recommend the user add `.opencode/` to their project `.gitignore` so it never resurfaces. `.orchestrator/` project state (`PROJECT-CONTEXT.md`, `config.json`, materialized scaffolding) is **not** excluded — it is real project state; the user commits or gitignores it deliberately.
4. **`gh: MISSING`** → stop and tell the user to install the GitHub CLI.
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
   - **Success** = the orchestrator prints its `ORCHESTRATOR — pipeline complete` final report, which only happens when QA returned `READY_TO_COMMIT` or `READY_WITH_WARNINGS` (the report's QA line shows which). The proposed commit message and PR message PM uses in step 4 are read from this report, and `final_report_path` is read from its `Final report:` line. → run the **artifact verification** below, then proceed to step 4.
   - **Stop** = the orchestrator prints any stop banner with a `Status: STALLED` line (cycle-limit reached, tester BLOCKED, qa BLOCKED_STALE, or spec still in DRAFT). There is no terminal `BLOCKED` status — `BLOCKED` is only an internal intermediate the orchestrator resolves via its fix/QA loops and never the final printed state. On any `Status: STALLED` banner, halt the entire PM run: report the stop banner, the story id, and the remaining queue. Do not proceed to any further story.

   **Artifact verification (mandatory before step 4 — same retry pattern used for every other artifact).** The banner is a printed side effect; the orchestrator's Step 7 file-write is what must actually land, and under context pressure the write can be dropped while the banner still prints. Do **not** trust the banner alone. Read `final_report_path` (`plans/final/FINAL-{NNN}-{slug}.md`) on disk. If the `Final report:` line is absent from the banner, glob `plans/final/FINAL-*.md` and take the most recent as a fallback — with timestamp-based IDs (`FINAL-<YYYYMMDD>T<HHMMSS>Z-<hex>`), `ls plans/final/FINAL-*.md | sort | tail -1` is chronological. If the file does not exist or is empty, re-invoke the orchestrator once (answering Step 0 with option 1, per step 2) to force Step 7 to re-persist. If the FINAL artifact is still missing after the retry, halt the PM run exactly like a `Status: STALLED` stop — report the story id, the missing-artifact reason, and the remaining queue. **Never commit a story whose FINAL artifact is not on disk** — the pipeline did not actually finish.

4. **Execute the success-path sequence** (see `references/git-flow.md` → **Success-path sequence**). The ordering is load-bearing because of two constraints: `/roadmap sync` must run after the trailer commit (it reads `git log`), and PM's own logs must be committed *after* the PR (they record the PR URL). The six steps:
   - Commit with the `Roadmap-Story: <id>` trailer using the orchestrator's proposed commit message.
   - Run `/roadmap sync` (after the trailer commit exists in git log).
   - Commit the roadmap sync docs **only** (`roadmap.lock.json`, READMEs) in a `docs(roadmap): sync <id>` commit — no logs here; they need the PR URL.
   - Push `pm/<id>-<slug>` to origin.
   - Run the **human-validation check** (step 5), render `templates/pr-body.template.md` (its `{{human_validation_note}}` comes from that check), open the PR with `gh pr create --body-file`, and capture the PR URL.
   - **Write and commit PM's logs** (step 6): with the PR URL known, append the `pm-progress.md` row (and, autonomous-mode-flagged, the `human-validation-queue.md` row), commit them as `chore(pm): log <id>`, and push. This dedicated post-PR commit keeps the working tree clean before the next story's branch is cut.

5. **Human-validation check.** Scan the story's `## Acceptance` section and the orchestrator's QA report for validation markers (see `references/human-validation.md` → **Detection sources**). The result sets the PR-body `{{human_validation_note}}` before the PR is opened. Then apply mode behavior:
   - **conservative (default):** if flagged, halt the loop after the PR is open and its log commit is made, surfacing a validation request (story id, PR URL, matched items). The user re-runs PM with the same scope to resume — the Filter step skips the now-`done` story automatically.
   - **autonomous (`--conservative=false`):** if flagged, append a row to `/roadmap/human-validation-queue.md` embedding the PR URL (committed in the `chore(pm): log <id>` commit in step 6) and continue to the next story.

6. **Append log entry.** After the PR is open, write one row to `/roadmap/pm-progress.md` using `templates/pm-progress-entry.template.md` (see `references/resume-and-logging.md` → **Log** and **Entry fields**), filling `commit`, `pr` (the PR URL), and `state`. The log is append-only; existing rows are never modified. This row plus any `human-validation-queue.md` row are committed together as `chore(pm): log <id>` and pushed, so they do not dirty the tree for the next story.

---

## Roadmap-management verbs

Beyond `complete <scope>` (which *executes* stories), PM exposes a set of **management verbs** that *reshape the roadmap*. Each verb resolves a selection, cuts a planning branch, invokes a `roadmap` mutation op (which stages a diff, gates on approval, and writes `/roadmap/`), then commits / pushes / opens a **planning PR**. PM never edits roadmap files itself — the `roadmap` skill is the sole writer of `/roadmap/`. Full normative detail is in `references/roadmap-management.md`.

```
/product-manager <verb> <args> [--yes]
```

### Verb → roadmap op mapping

| PM verb | Roadmap op (`roadmap/references/mutation-ops.md`) | Notes |
|---|---|---|
| `assign <release> <selection>` | `set-release <release> <ids…>` | Assign a named band or `backlog`; implicitly registers a new band in `releases[]`. |
| `park <selection>` | `set-release backlog <ids…>` | Sugar for `assign backlog <selection>`. |
| `unpark <selection> [<release>]` | `set-release <release-or-null> <ids…>` | Sugar; with a release re-tiers to it, omitting the release un-tiers to `null`. |
| `add-spec <path>` | `ingest-spec <path>` | Targeted re-eval appending a spec's new work (new items default `release: null`). |
| `new-spec [raw idea]` | *(two-step; see below)* | Spawns the orchestrator brainstormer, writes `plans/specs/SPEC-{id}.md`, then STOPS. Does not touch the roadmap. |
| `reorder <ids-in-order>` | `reorder <ids-in-order>` | `sequence`/`depends_on` of **not-done** items only (`--after <id>` accepted). |
| `revise <id>` | `revise <id>` | Retitle / re-scope, or split/merge via new stable IDs + supersede — **not-done** only. |
| `release <list\|reorder\|rename …>` | `release <list\|reorder\|rename …>` | Manage the ordered `releases[]` registry. `list` is read-only. |

### Front-door flow (per mutating verb)

1. **Resolve selection** → an exact id set. Selection accepts **ids/globs** (`001.1.*`, `002.1.1`) **and natural language** ("make auth and onboarding the MVP"); either way the resolved id set is shown in the staged diff before applying (`references/roadmap-management.md` → Selection resolution).
2. **Cut** `pm/roadmap-<verb>-<slug>` off the PM starting branch (existing base resolution; `references/git-flow.md` → Planning-PR flow).
3. **Invoke the roadmap op** → it stages a diff (markers `+ new`, `~ changed`, `! superseded`, `± release`), **gates on approval**, then writes files and prints a proposed commit message.
4. **On approval** → commit `docs(roadmap): <verb> …`, push, open the planning PR (`templates/pr-body.template.md` planning variant).
5. **On reject / empty diff** → discard the empty branch and return to the starting branch (`references/git-flow.md` → Reject-and-discard). No PR.

### Confirmation gate and `--yes`

Every mutating verb shows the staged diff and requires approval. **`--yes`** skips the gate for trusted quick edits (unambiguous explicit ids) — PM passes it through to the roadmap op. `--yes` never skips the planning PR; the change stays reviewable.

### `new-spec` two-step

Raw-idea → roadmap is deliberately two-gated:

1. `new-spec "raw idea"` spawns the **orchestrator brainstormer subagent** (reused unchanged), which writes `plans/specs/SPEC-{id}.md`. PM then **STOPS** — it does not append to the roadmap.
2. After the user reviews/edits the spec, `add-spec plans/specs/SPEC-{id}.md` runs roadmap `ingest-spec`, which stages the append diff, gates, writes, and opens the planning PR.

See `references/roadmap-management.md` → Spec-creation two-step.

### Release name as a `complete` scope

`complete <scope>` additionally accepts a **release name**: `complete mvp` / `complete v1.1` / `complete backlog` runs every not-done story in that band across all milestones, topo-ordered. Active-scope runs (`complete roadmap`/`<milestone>`/`<phase>`) **exclude `backlog`**. See `references/scope-resolution.md` → Release scope + Backlog exclusion.

---

## Error handling

- **`lock: MISSING`** (Pre-flight block) → stop: `run /roadmap first`. Only when the block printed `lock: MISSING` — never inferred.
- **`config: MISSING`** (Pre-flight block) → stop: `run /orchestrator --setup first`. Only when the block printed `config: MISSING`. A `config: OK` line means the file exists and is readable from the git root; do not report it missing on the basis of a dirty tree, an untracked `PROJECT-CONTEXT.md`, or a listing tool that hides dotfile dirs — re-run the Pre-flight block and trust its output.
- **`tree: DIRTY`** → stop: commit, stash, or `.gitignore` the listed files before running PM. Host-runtime `.opencode/`/`.claude/` are excluded from this check and never block; `.orchestrator/` project state is not excluded.
- **`gh: MISSING`** → stop: install the GitHub CLI and ensure it is authenticated.
- **Unrecognized flag** (e.g. a mistyped `--conservative`) → stop and echo the **exact unrecognized token in backticks** (e.g. ``unknown flag `--corservative`; did you mean `--conservative`?``) so a one-letter typo is visible against the intended flag. Do not silently ignore or silently accept an unknown flag.
- **Orchestrator prints a `Status: STALLED` stop banner** (cycle-limit, tester BLOCKED, qa BLOCKED_STALE, or spec DRAFT) → stop the entire run. Report the stop banner, the story id, and the unprocessed queue. Stories completed before the stall are preserved (their branches, commits, and PRs remain). Note: there is no terminal `BLOCKED` status — `BLOCKED` is an internal intermediate only; PM keys off the orchestrator's printed STALLED banner.
- **`pipeline complete` banner but no FINAL artifact on disk** → the orchestrator's Step 7 write was dropped while the banner still printed. Re-invoke the orchestrator once to re-persist (per-story loop step 3, **Artifact verification**); if `plans/final/FINAL-{NNN}-{slug}.md` is still missing after the retry, halt the run like a STALLED stop. Never commit the story — the pipeline did not finish.
- **Dependency cycle detected** → stop before executing any story and report the offending story ids.
- **Unrecognized `<scope>` argument** → stop and print the list of valid milestone ids and phase ids from `roadmap.lock.json`.
- **Trailer mismatch after `/roadmap sync`** → warn and stop. If the story's `roadmap.lock.json` status is not `done` after sync, the trailer may contain a typo. See `references/git-flow.md` → **Trailer-mismatch guard**.

---

## References

All normative details live in these files (relative to `plugins/my-skills/skills/product-manager/`):

| File | Content |
|---|---|
| `references/roadmap-management.md` | Management verb catalog + op mapping, selection resolution (ids/globs + natural language), confirmation gate + `--yes`, reject-and-discard, `new-spec → add-spec` two-step |
| `references/scope-resolution.md` | Scope matching (incl. release-as-scope + backlog exclusion), Filter, Ordering algorithm, Out-of-scope dependencies |
| `references/git-flow.md` | Base resolution, Branch naming (`pm/<id>-<slug>`), Success-path sequence (commit+trailer → /roadmap sync → commit sync docs → push → stacked PR), Stacked PR ordering, Planning-PR flow (`pm/roadmap-<verb>-<slug>`, `docs(roadmap):`, reject-and-discard), Trailer-mismatch guard |
| `references/human-validation.md` | Detection sources, conservative mode, autonomous mode, Marker list, Invariant |
| `references/resume-and-logging.md` | `/roadmap/pm-progress.md` log, Entry fields, Resume algorithm (including stacked-branch reconstruction) |

Templates:

| Template | Used for |
|---|---|
| `templates/pr-body.template.md` | PR body rendered per story before `gh pr create` |
| `templates/pm-progress-entry.template.md` | One appended row per story attempt in `/roadmap/pm-progress.md` |
