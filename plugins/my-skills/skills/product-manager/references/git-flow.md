# Product Manager — Git-Flow Reference

This document is the single source of truth for the stacked-branch git model used by PM: how branches are named, how the base is resolved, the exact success-path commit-and-sync sequence, and how stacked PRs are created.

`SKILL.md` references this document by name: **Branch naming**, **Base resolution**, **Success-path sequence**, **Stacked PR creation**.

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
| Story has no in-scope dependencies (independent story, or all deps are already `done`) | The **run base**: the value of `--base` if provided, otherwise the branch PM started on. |

The run base is captured once at PM startup and held constant for the entire run.

### Cycle guard

If dependency resolution would produce a cycle, PM stops before cutting any branch and reports the offending ids. See `references/scope-resolution.md` for the cycle-detection algorithm.

---

## Cutting the branch

```bash
git checkout -b pm/<id>-<slug> <base>
```

This yields a clean, non-protected branch. The orchestrator's Step 0 pre-flight detects a clean non-protected branch and selects **"use this branch"** without prompting — the branch PM cuts here is the branch the orchestrator will commit onto.

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

3. **Commit the roadmap doc changes.**
   The files modified by `/roadmap sync` (`roadmap.lock.json`, READMEs) are committed separately with a conventional message. Do **not** append a story trailer to this commit:

   ```bash
   git add -A && git commit -m "docs(roadmap): sync <id>"
   ```

4. **Push the branch.**

   ```bash
   git push -u origin pm/<id>-<slug>
   ```

5. **Open the PR.**

   ```bash
   gh pr create --base <base> --head pm/<id>-<slug> --body "$(cat pr-body.md)"
   ```

   where `<base>` is:
   - The **predecessor branch** (`pm/<dep-id>-<slug>` of the latest-ordered dependency) for stories that have in-scope dependencies — this is a stacked PR that targets another feature branch, not the run base.
   - The **run base** (`--base` value, else the branch PM started on) for independent stories.

   The PR body is rendered from `templates/pr-body.template.md` with all tokens substituted before passing to `gh`.

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
