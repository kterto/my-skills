# product-manager skill — design

**Date:** 2026-06-23
**Status:** approved (brainstorming)

## Purpose

`product-manager` is an autonomous loop that drives a roadmap to completion, one
user story at a time, by gluing the two existing skills that deliberately stop
short of each other:

- the **roadmap** skill plans and tracks but never runs code or commits;
- the **orchestrator** skill implements but never commits or pushes.

product-manager (PM) sits between them: it resolves a scope of the roadmap,
feeds each user story's brief to the orchestrator, and on a successful pipeline
run it commits the work with the roadmap commit trailer, syncs the roadmap,
pushes, and opens a pull request — then proceeds to the next story until the
scoped branch of the roadmap is complete.

PM is an **action skill**, not doc-only: it runs git, invokes the orchestrator
(which runs code), commits, pushes, and opens PRs.

## Non-goals

- PM does not bootstrap the orchestrator. If `.orchestrator/config.json` is
  absent, PM stops and instructs the user to run `/orchestrator --setup` first.
- PM does not build or re-evaluate the roadmap. If `/roadmap/` is absent, PM
  stops and instructs the user to run `/roadmap` first.
- PM does not merge PRs. Merging stays a human decision.
- PM does not write specs, plans, or code itself — every implementation artifact
  is produced inside the orchestrator pipeline.

## Invocation

```
/product-manager complete <scope> [--conservative=true|false] [--base <branch>] [--dry-run]
```

| Token | Meaning |
|---|---|
| `complete <scope>` | `roadmap` (whole tree) \| milestone id (`001` or `001-bootstrap`) \| phase id (`001.2`). |
| `--conservative=<bool>` | Autonomy mode. **Default `true`.** See Human validation. |
| `--base <branch>` | Run base branch for independent stories. Default: current branch. |
| `--dry-run` | Resolve scope, print the queue + git plan, and exit. Runs nothing. |

**Config resolution** (mirrors roadmap/orchestrator precedence):

```
CLI flag > /roadmap/pm.config.json > built-in default
```

`pm.config.json` is optional and holds `{ "conservative": true, "base_branch": null }`.

## Pre-flight (once per run)

Run before the loop, then a single confirmation gate:

1. Require `/roadmap/roadmap.lock.json`. Absent → stop: "run /roadmap first".
2. Require `.orchestrator/config.json`. Absent → stop: "run /orchestrator --setup first".
3. Require a clean working tree (`git status --porcelain` empty).
4. Require `gh` CLI available (needed for PR creation).
5. Resolve scope to the set of in-scope user stories (see Scope resolution).
6. Drop stories with status `done` or `superseded`.
7. Topologically sort the remaining stories by `depends_on`, then by `sequence`
   within ties.
8. Print the ordered queue, the resolved mode, and the git plan (branch naming +
   stacked-PR layout). Ask for a **single up-front confirmation**. Approving the
   run authorizes the per-story push and PR creation for the whole run; PM does
   not re-ask per story (except where conservative mode halts the loop).

If `--dry-run`, stop after step 8 without asking for confirmation.

## Scope resolution

Read `roadmap.lock.json` and the in-scope user-story files.

- `roadmap` → every `user-story` item.
- milestone id (`001` or `001-bootstrap`) → user stories whose `milestone` matches.
- phase id (`001.2`) → user stories whose `phase` matches.

Match a bare ordinal (`001`) against either the milestone id or the directory
slug prefix. Reject an unmatched scope with the list of valid scopes.

**Ordering.** Build the dependency graph from each story's `depends_on`. Produce
a topological order; break ties by `sequence`. If a cycle is detected, stop and
report the offending ids (roadmap should never emit a cycle, but PM verifies).

Dependencies that fall **outside** the resolved scope are checked for status: if
an out-of-scope dependency is not `done`, PM warns and (in conservative mode)
stops; in autonomous mode it proceeds but records the unmet dependency in the log
and PR body.

## Per-story loop

For each story in queue order:

1. **Resolve base branch.**
   - If the story has `depends_on` within the run, base = the branch of the
     latest-ordered satisfied dependency (`pm/<dep-id>-<slug>`).
   - Otherwise base = the run base (`--base` or the starting branch).
2. **Cut the story branch:** `git checkout -b pm/<id>-<slug> <base>`. This yields
   a clean, non-protected branch, so the orchestrator's Step 0 pre-flight selects
   "use this branch" without prompting.
3. **Run the orchestrator.** Invoke the `orchestrator` skill with the story's
   `## Brief` section as the verbatim task input. PM passes the brief exactly as
   written (it is already a self-contained orchestrator brief).
4. **Read the terminal state** from the orchestrator's final report:
   - `READY_TO_COMMIT` / `READY_WITH_WARNINGS` → success path (step 5).
   - `STALLED` / `BLOCKED` (any variant) → **stop the whole run**, report the
     story id, the orchestrator state, the artifact paths, and the remaining
     queue. The user resolves and re-runs; resume skips `done` stories.
5. **Success path:**
   1. Commit all working-tree changes using the orchestrator's proposed commit
      message, appending the trailer line `Roadmap-Story: <id>` (the exact
      `commit_trailer` from the story frontmatter).
   2. Run `/roadmap sync`. It scans commit trailers from `last_synced_sha` to
      `HEAD`, stamps this story `done`, rolls up phase/milestone status, and
      updates `roadmap.lock.json` + READMEs. (Sync must run *after* the trailer
      commit exists, because it reads trailers from `git log`.)
   3. Commit the roadmap doc changes from sync as a separate commit
      (`docs(roadmap): sync <id>`), with no story trailer.
   4. Push the branch and open a **stacked PR** whose target (`gh pr create
      --base`) is the story's base branch (the predecessor branch, or the run
      base for independent stories).
   5. Append a log entry to `/roadmap/pm-progress.md` (see Logging).
6. **Human-validation check** (see next section) runs around the success path.

## Human validation

PM detects "critical human testing required" spots from two sources:

- **Pre-run:** scan the story's `## Acceptance` section for manual-validation
  markers — case-insensitive match on phrases such as `manual`, `manually`,
  `human`, `by hand`, `visually`, `visual check`, `real device`, `physical`,
  `user acceptance`, `UAT`, `eyeball`, `in person`. (The exact marker list lives
  in `references/human-validation.md` so it can evolve without touching SKILL.md.)
- **Post-run:** scan the orchestrator QA report (path from the final report) for
  manual-validation flags / sections indicating human verification is required.

A story flagged by either source is **always implemented fully** — the pipeline
has already produced complete, reviewable work, so PM still commits, syncs,
pushes, and opens the PR. The mode only governs whether the loop continues:

- **conservative (default):** after completing the current story, **halt the
  loop** and surface a validation request: the story id, the PR link, and the
  specific items needing human validation. The user validates, then re-runs PM to
  continue (resume skips the now-`done` story and starts at the next).
- **autonomous (`--conservative=false`):** append the validation spot to
  `/roadmap/human-validation-queue.md` (append-only checklist) and add a note to
  the PR body, then continue to the next story without pausing.

## Logging

PM maintains an append-only `/roadmap/pm-progress.md`, actor `product-manager`.
One entry per story attempt:

| Field | Content |
|---|---|
| `when` | ISO-8601 timestamp |
| `story` | user-story id + title |
| `base` | base branch used |
| `branch` | story branch created |
| `state` | orchestrator terminal state |
| `commit` | implementing commit sha (or `—`) |
| `pr` | PR url (or `—`) |
| `human_validation` | `none` \| `flagged: <source>` |
| `notes` | unmet deps, warnings, stop reason |

## Resume

PM is restart-safe with no extra state file: on re-run it re-resolves the scope,
re-reads `roadmap.lock.json`, and drops stories already `done`/`superseded`.
Stacked-branch reconstruction relies on the deterministic `pm/<id>-<slug>`
naming, so a dependent story can locate its predecessor's branch after a restart.

## Error handling

- Missing roadmap / orchestrator config / dirty tree / missing `gh` → stop in
  pre-flight with a specific remedy message.
- Orchestrator `STALLED`/`BLOCKED` → stop whole run, report, preserve completed
  stories (already committed/pushed).
- Dependency cycle or unmatched scope → stop in pre-flight.
- Sync stamps nothing for a story whose trailer commit exists → warn (trailer
  mismatch) and stop, since the roadmap would otherwise drift from git truth.

## File layout

```
plugins/my-skills/skills/product-manager/
  SKILL.md                            # invocation, pre-flight, loop, gates
  references/scope-resolution.md      # arg parse, queue build, topo-sort, scope matching
  references/git-flow.md              # stacked branches, base resolution, commit+trailer, stacked PR
  references/human-validation.md      # marker list, conservative vs autonomous behavior
  references/resume-and-logging.md    # pm-progress.md format, resume-from-lock algorithm
  templates/pr-body.template.md       # PR body (summary, test plan, human-validation note)
  templates/pm-progress-entry.template.md
```

## Compatibility

- Consumes roadmap output verbatim: `roadmap.lock.json`, the user-story
  frontmatter (`id`, `status`, `depends_on`, `sequence`, `milestone`, `phase`,
  `commit_trailer`), and the `## Brief` / `## Acceptance` body sections.
- Drives the orchestrator through its documented entry contract (plain-language
  task in, final report out) and its terminal states.
- Closes the loop with `/roadmap sync`, which is idempotent and additive.
```
