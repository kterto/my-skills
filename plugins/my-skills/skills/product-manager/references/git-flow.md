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

After the orchestrator completes implementation and produces its proposed commit message and QA report, PM executes the six steps below in order. The ordering is load-bearing, and two constraints drive it:

- **Sync-after-commit:** `/roadmap sync` reads trailers from `git log`, so the trailer commit must exist first (steps 1 → 2).
- **Log-after-PR:** the `pm-progress.md` row records the PR URL, and the `human-validation-queue.md` row embeds `(PR <url>)` — neither URL exists until `gh pr create` returns. So PM's own log writes are committed *after* the PR is opened, in a dedicated commit, not folded into the pre-PR sync-docs commit (steps 5 → 6). The clean-tree invariant is still satisfied because the log commit lands before the next story's branch is cut.

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

3. **Commit the roadmap sync docs (lock + READMEs only).**
   The files modified by `/roadmap sync` (`roadmap.lock.json`, READMEs) are committed with a conventional message. Do **not** append a story trailer to this commit, and do **not** stage PM's own logs here — they need the PR URL, which does not exist yet (see step 6). Staging only the roadmap docs here keeps this commit part of the PR diff that reviewers see.

   ```bash
   git add /roadmap/roadmap.lock.json /roadmap/**/README.* /roadmap/README.*
   git commit -m "docs(roadmap): sync <id>"
   ```

   (Globs assume `globstar`; if it is off, stage the specific README paths the sync touched.)

4. **Push the branch.**

   ```bash
   git push -u origin pm/<id>-<slug>
   ```

5. **Open the PR.**

   First run the human-validation check (`references/human-validation.md` → Detection sources) so the `{{human_validation_note}}` token is known. Then fill all tokens in `templates/pr-body.template.md` and write the result to a repo-local, git-ignored scratch path (not `/tmp`). Use the orchestrator's already-present `.orchestrator/` dir, which is git-ignored by the orchestrator setup — write under `.orchestrator/tmp/`:

   ```bash
   # PM renders the template (substitutes all {{ }} tokens) and saves the result:
   # (token substitution is done inline — the output is a plain Markdown file)
   mkdir -p .orchestrator/tmp
   # -> .orchestrator/tmp/pm-pr-body-<id>.md
   ```

   Then open the PR using `--body-file`, capturing the URL it prints:

   ```bash
   PR_URL=$(gh pr create --base <base> --head pm/<id>-<slug> \
              --body-file .orchestrator/tmp/pm-pr-body-<id>.md)
   rm -f .orchestrator/tmp/pm-pr-body-<id>.md
   ```

   where `<base>` is:
   - The **predecessor branch** (`pm/<dep-id>-<slug>` of the latest-ordered dependency) for stories that have in-scope dependencies — this is a stacked PR that targets another feature branch, not the run base.
   - The **run base** (`--base` flag, else `pm.config.json.base_branch`, else the branch PM started on) for independent stories.

   The scratch file is repo-local and git-ignored; delete it after the PR is opened so it never lands in a commit.

6. **Write and commit PM's logs (needs `PR_URL`).**
   Now that the PR URL is known, append PM's own audit rows and commit them in a dedicated commit so the working tree is clean before the next story's branch is cut:

   - Append the `pm-progress.md` row (see `references/resume-and-logging.md` → Entry fields), filling `commit` from step 1's SHA, `pr` from `PR_URL`, and `state` from the orchestrator's terminal banner.
   - In autonomous mode, if the story was flagged, append the `human-validation-queue.md` row embedding `(PR ${PR_URL})` (see `references/human-validation.md` → autonomous mode).

   ```bash
   git add /roadmap/pm-progress.md /roadmap/human-validation-queue.md
   git commit -m "chore(pm): log <id>"
   git push          # updates the PR with the log commit; keeps remote == local
   ```

   (Stage `human-validation-queue.md` only when it was touched this story.) After this commit the working tree is clean, satisfying the next iteration's clean-tree precondition and the orchestrator's Step 0 dirty-tree gate (Case C). A stacked child branch cut from this branch inherits the log commit; an independent next story branches from the run base, so the accumulated log lives on the latest story branch in each stack.

---

## Worked example — one story, end to end

Concrete trace for story `001.2.1` (slug `setup-ci`, title `Set up CI`, no in-scope dependencies), run base `main`, autonomous mode, story flagged `none`.

```bash
# Base resolution: no in-scope deps -> run base = main
git checkout -b pm/001.2.1-setup-ci main          # cut branch

# (PM invokes orchestrator with the story's ## Brief; answers Step 0 -> "use this branch")
# Orchestrator prints: ORCHESTRATOR — pipeline complete ... QA: READY_TO_COMMIT

# 1. Commit implementation with trailer (message from orchestrator report)
git add -A && git commit -m "$(cat <<'EOF'
feat(ci): add CI pipeline

Roadmap-Story: 001.2.1
EOF
)"
# -> [pm/001.2.1-setup-ci 3a1b2c3] feat(ci): add CI pipeline

# 2. Sync roadmap from the trailer just committed
/roadmap sync
# -> stamps 001.2.1 done, rolls up 001.2 / 001, updates lock + READMEs

# 3. Commit the sync docs only (in the PR diff; no logs, no trailer)
git add /roadmap/roadmap.lock.json /roadmap/**/README.* /roadmap/README.*
git commit -m "docs(roadmap): sync 001.2.1"

# 4. Push
git push -u origin pm/001.2.1-setup-ci

# 5. Render PR body + open PR, capture URL
mkdir -p .orchestrator/tmp
# (render templates/pr-body.template.md -> .orchestrator/tmp/pm-pr-body-001.2.1.md)
PR_URL=$(gh pr create --base main --head pm/001.2.1-setup-ci \
           --body-file .orchestrator/tmp/pm-pr-body-001.2.1.md)
rm -f .orchestrator/tmp/pm-pr-body-001.2.1.md
# -> PR_URL=https://github.com/acme/app/pull/42

# 6. Now that PR_URL exists, write + commit logs
#    pm-progress.md row: when | 001.2.1 Set up CI | main | pm/001.2.1-setup-ci |
#                        READY_TO_COMMIT | 3a1b2c3 | $PR_URL | none | (empty)
#    (flagged: none -> no human-validation-queue row this story)
git add /roadmap/pm-progress.md
git commit -m "chore(pm): log 001.2.1"
git push
# tree clean -> proceed to next story in the queue
```

If this story had been `flagged: acceptance` in **conservative** mode, every step above is identical through the log commit (step 6); PM then **halts** and surfaces the story id + `PR_URL` + the matched markers, instead of continuing to the next story.

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
