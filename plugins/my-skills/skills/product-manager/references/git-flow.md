# Product Manager — Git-Flow Reference

This document is the single source of truth for the stacked-branch git model used by PM: how branches are named, how the base is resolved, the exact success-path commit-and-sync sequence, and how stacked PRs are created.

`SKILL.md` references this document by name: **Branch naming**, **Base resolution**, **Success-path sequence**, **Stacked PR ordering**.

---

## Branch naming

Every story branch follows the pattern:

```
pm/<id>-<slug>
```

where `<id>` is the story's frontmatter `id` field and `<slug>` is the story's directory/file slug (the filesystem identifier, not the human-readable title).

Example: `pm/001.2.1-setup-ci`

---

## Base resolution

Before cutting a branch, PM determines the correct base commit using the following rule:

| Condition | Base |
|---|---|
| Story has one or more `depends_on` ids that are all within the current run's scope | `pm/<dep-id>-<slug>` of the **latest-ordered** dependency (the last dep in topological order). This produces a stacked branch. |
| Story has no in-scope dependencies (independent story, or all deps are already `done`) | The **run base**: `--base` flag if provided, else `pm.config.json.base_branch` if set, else the branch PM started on. |

The run base is captured once at PM startup and held constant for the entire run.

> A dependency that is already `done` has its work in the base branch — its `pm/` branch may be gone — so dependents of it stack on the run base, not a stale predecessor branch.

### Cycle guard

If dependency resolution would produce a cycle, PM stops before cutting any branch and reports the offending ids. See `references/scope-resolution.md` for the cycle-detection algorithm.

---

## Cutting the branch

```bash
git checkout -b pm/<id>-<slug> <base>
```

This yields a clean, non-protected branch. The branch PM cuts here is the branch the orchestrator must commit onto.

> **Step 0 is always interactive — PM must answer it.** The orchestrator's Step 0 pre-flight (orchestrator `SKILL.md` → Step 0, Case A) **always** asks a workspace question and **never** auto-selects, even on a clean non-protected branch. The four options are: 1. use this branch, 2. new branch from here, 3. new worktree, 4. cancel. Because PM has already cut and checked out `pm/<id>-<slug>` and the single up-front confirmation (Pre-flight step 8) authorizes the whole run, PM answers Step 0 on the user's behalf with **option 1 ("use this branch")**. PM MUST NOT choose new-branch, new-worktree, or cancel: those would move the run off the `pm/<id>-<slug>` branch PM tracks, leaving the implementation commit on a branch PM never pushes — producing an empty PR and a trailer mismatch at `/roadmap sync`.

---

## Success-path sequence

After the orchestrator completes implementation and produces its proposed commit message and QA report, PM executes the following steps in order. The ordering is not arbitrary — steps 1 and 2 have a hard dependency described below.

1. **Commit with trailer.**
   Stage all implementation changes and commit using the orchestrator's proposed commit message, appending a blank line followed by the trailer:

   ```
   Roadmap-Story: <id>
   ```

   The trailer value is taken verbatim from the story frontmatter field `commit_trailer`. Example:

   ```bash
   git add -A && git commit -m "$(cat <<'EOF'
   <orchestrator proposed message>

   Roadmap-Story: <id>
   EOF
   )"
   ```

2. **Run `/roadmap sync`.**
   `/roadmap sync` reads `Roadmap-Story:` trailers from `git log` to discover which stories are implemented. **The trailer commit from Step 1 MUST already exist before this step runs** — if sync executes before the commit, it finds no trailer and stamps nothing, leaving `roadmap.lock.json` out of sync with git truth.

   Sync stamps the story `done`, rolls up milestone/phase completion, and updates `roadmap.lock.json` + READMEs.

3. **Commit the roadmap doc changes AND PM's own logs together.**
   The files modified by `/roadmap sync` (`roadmap.lock.json`, READMEs) are committed with a conventional message. Do **not** append a story trailer to this commit.

   **Critical — fold PM's log writes into this same commit.** PM appends to `/roadmap/pm-progress.md` (always) and, in autonomous mode, to `/roadmap/human-validation-queue.md`. These are write-then-commit, not write-and-leave: write the `pm-progress.md` row (per-story loop step 6) and any `human-validation-queue.md` row **before** this commit, then stage them alongside the sync docs so they land in the `docs(roadmap): sync <id>` commit. If left uncommitted they dirty the working tree, and the next story's `git checkout -b` either carries them over or trips the orchestrator's Step 0 dirty-tree gate (Case C). The working tree MUST be clean before the next story's branch is cut.

   ```bash
   # Stage: roadmap sync output + PM's own logs, then one commit.
   git add /roadmap/roadmap.lock.json /roadmap/**/README.* /roadmap/README.* \
           /roadmap/pm-progress.md /roadmap/human-validation-queue.md
   git commit -m "docs(roadmap): sync <id>"
   ```

   (Stage `human-validation-queue.md` only when it exists / was touched this story.)

4. **Push the branch.**

   ```bash
   git push -u origin pm/<id>-<slug>
   ```

5. **Open the PR.**

   First, fill all tokens in `templates/pr-body.template.md` and write the result to a repo-local, git-ignored scratch path (not `/tmp`). Use the orchestrator's already-present `.orchestrator/` dir, which is git-ignored by the orchestrator setup — write under `.orchestrator/tmp/`:

   ```bash
   # PM renders the template (substitutes all {{ }} tokens) and saves the result:
   # (token substitution is done inline — the output is a plain Markdown file)
   mkdir -p .orchestrator/tmp
   .orchestrator/tmp/pm-pr-body-<id>.md
   ```

   Then open the PR using `--body-file`:

   ```bash
   gh pr create --base <base> --head pm/<id>-<slug> --body-file .orchestrator/tmp/pm-pr-body-<id>.md
   ```

   where `<base>` is:
   - The **predecessor branch** (`pm/<dep-id>-<slug>` of the latest-ordered dependency) for stories that have in-scope dependencies — this is a stacked PR that targets another feature branch, not the run base.
   - The **run base** (`--base` flag, else `pm.config.json.base_branch`, else the branch PM started on) for independent stories.

   The PR body is rendered from `templates/pr-body.template.md` with all tokens substituted. PM writes the rendered result to `.orchestrator/tmp/pm-pr-body-<id>.md` before invoking `gh pr create`. This scratch file is repo-local and git-ignored; delete it after the PR is opened (e.g. `rm -f .orchestrator/tmp/pm-pr-body-<id>.md`). If `.orchestrator/tmp/` is not already git-ignored in the target repo, the file must be cleaned up so it never lands in a commit.

---

## Trailer-mismatch guard

After `/roadmap sync` completes, verify that the story's status in `roadmap.lock.json` is now `done`. If the trailer commit exists in `git log` but sync did not stamp the story `done`, **warn and stop** — proceeding would allow `roadmap.lock.json` to drift from git truth. Investigate the trailer value for typos before continuing.

---

## PM never merges PRs

PM opens PRs and stops. Merging is a human action, performed after code review and any CI gates pass.

---

## Stacked PR ordering

When a run produces multiple stories, each story's PR is opened immediately after that story's push. The order follows the story queue (see `references/scope-resolution.md`), which means dependent stories are pushed and PR'd after their predecessors — ensuring `gh pr create --base <predecessor-branch>` targets a branch that already exists on the remote.

---

Cross-references:
- Scope and story queue ordering: `references/scope-resolution.md`
- Human-validation spots (affects PR body `{{human_validation_note}}`): `references/human-validation.md`
- Run log and resume behavior: `references/resume-and-logging.md`
- PR body token definitions: `templates/pr-body.template.md`
