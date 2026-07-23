# Product Manager — Git-Flow Reference

This document is the single source of truth for the stacked-branch git model used by PM: how branches are named, how the base is resolved, the exact success-path commit-and-sync sequence, and how stacked PRs are created.

`SKILL.md` references this document by name: **Branch naming**, **Base resolution**, **Success-path sequence**, **Stacked PR ordering**, **Planning-PR flow**.

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

   **2b. Timestamp-parity gate (html mode).** Sync re-renders roadmap `.html` pages, so before committing them run the timestamp-parity gate (see **Timestamp-parity gate** below). A red gate **halts the run** — do not commit the sync docs, push, or open the PR.

3. **Commit the roadmap sync docs (lock + READMEs only).**
   The files modified by `/roadmap sync` (`roadmap.lock.json`, READMEs) are committed with a conventional message. Do **not** append a story trailer to this commit, and do **not** stage PM's own logs here — they need the PR URL, which does not exist yet (see step 6). Staging only the roadmap docs here keeps this commit part of the PR diff that reviewers see.

   ```bash
   git -C "$(git rev-parse --show-toplevel)" add roadmap/roadmap.lock.json roadmap/**/README.* roadmap/README.* roadmap/check-timestamp-parity.cjs
   git commit -m "docs(roadmap): sync <id>"
   ```

   (Globs assume `globstar`; if it is off, stage the specific README paths the sync touched. `roadmap/check-timestamp-parity.cjs` is staged so a refreshed/newly-materialized gate asset ships in the same sync-docs commit — html mode only; the path is simply absent in md mode. `git add` of an unchanged asset is a no-op.)

4. **Push the branch.**

   ```bash
   git push -u origin pm/<id>-<slug>
   ```

5. **Open the PR.**

   First run the human-validation check (`references/human-validation.md` → Detection sources) so the `{{human_validation_note}}` token is known. Then fill all tokens in `templates/pr-body.template.md` and write the result to a repo-local, git-ignored scratch path (not `/tmp`). Use the orchestrator's already-present `.orchestrator/` dir, which is git-ignored by the orchestrator setup — write under `.orchestrator/tmp/`:

   ```bash
   # PM renders the template (substitutes all {{ }} tokens) and saves the result:
   # (token substitution is done inline — the output is a plain Markdown file)
   # Anchor to the git root — under opencode the session cwd may be a repo subdir.
   root="$(git rev-parse --show-toplevel)"
   mkdir -p "$root/.orchestrator/tmp"
   # -> $root/.orchestrator/tmp/pm-pr-body-<id>.md
   ```

   Then open the PR using `--body-file`, capturing the URL it prints:

   ```bash
   root="$(git rev-parse --show-toplevel)"
   PR_URL=$(gh pr create --base <base> --head pm/<id>-<slug> \
              --body-file "$root/.orchestrator/tmp/pm-pr-body-<id>.md")
   rm -f "$root/.orchestrator/tmp/pm-pr-body-<id>.md"
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
   git -C "$(git rev-parse --show-toplevel)" add roadmap/pm-progress.md roadmap/human-validation-queue.md
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
git -C "$(git rev-parse --show-toplevel)" add roadmap/roadmap.lock.json roadmap/**/README.* roadmap/README.* roadmap/check-timestamp-parity.cjs
git commit -m "docs(roadmap): sync 001.2.1"

# 4. Push
git push -u origin pm/001.2.1-setup-ci

# 5. Render PR body + open PR, capture URL
root="$(git rev-parse --show-toplevel)"   # opencode cwd may be a repo subdir
mkdir -p "$root/.orchestrator/tmp"
# (render templates/pr-body.template.md -> $root/.orchestrator/tmp/pm-pr-body-001.2.1.md)
PR_URL=$(gh pr create --base main --head pm/001.2.1-setup-ci \
           --body-file "$root/.orchestrator/tmp/pm-pr-body-001.2.1.md")
rm -f "$root/.orchestrator/tmp/pm-pr-body-001.2.1.md"
# -> PR_URL=https://github.com/acme/app/pull/42

# 6. Now that PR_URL exists, write + commit logs
#    pm-progress.md row: when | 001.2.1 Set up CI | main | pm/001.2.1-setup-ci |
#                        READY_TO_COMMIT | 3a1b2c3 | $PR_URL | none | (empty)
#    (flagged: none -> no human-validation-queue row this story)
git -C "$(git rev-parse --show-toplevel)" add roadmap/pm-progress.md
git commit -m "chore(pm): log 001.2.1"
git push
# tree clean -> proceed to next story in the queue
```

If this story had been `flagged: acceptance` in **conservative** mode, every step above is identical through the log commit (step 6); PM then **halts** and surfaces the story id + `PR_URL` + the matched markers, instead of continuing to the next story.

---

## Trailer-mismatch guard

After `/roadmap sync` completes, verify that the story's status in `roadmap.lock.json` is now `done`. If the trailer commit exists in `git log` but sync did not stamp the story `done`, **warn and stop** — proceeding would allow `roadmap.lock.json` to drift from git truth. Investigate the trailer value for typos before continuing.

---

## Timestamp-parity gate (html mode)

Both re-render sites — `/roadmap sync` in the **Success-path sequence** (step 2b) and a mutation op in the **Planning-PR flow** (step 2b) — rewrite roadmap `.html` pages in place. Each page stamps its update time twice (machine-readable `data-updated-at` + the visible `updated:` value), so an in-place re-render that touches one and misses the other lets the two **silently drift**. PM runs the roadmap skill's parity gate on the freshly re-rendered pages **before committing them**, so drifted docs never reach a PR:

```bash
root="$(git rev-parse --show-toplevel)"
gate="$root/roadmap/check-timestamp-parity.cjs"
if [ -f "$root/roadmap/README.html" ]; then
  # html-mode roadmap (the index is always materialized as README.html): the parity
  # gate is MANDATORY. If the asset is missing, the roadmap predates the gate or a
  # write pass failed to refresh it — fail closed, never silently skip (bug-3).
  if [ ! -f "$gate" ]; then
    echo "roadmap-timestamp-parity: gate asset missing on an html-mode roadmap — halt" >&2
    echo "  re-render the roadmap through the roadmap skill (its html-mode write pass" >&2
    echo "  re-materializes roadmap/check-timestamp-parity.cjs), then re-run PM." >&2
    exit 1
  fi
  node "$gate"   # branch scope: the pages this branch touched
fi
# md mode (no roadmap/README.html): nothing to check — .md pages carry the timestamp once.
```

- **Keyed on html mode, fail-closed on a missing asset — no-op in md mode.** Html mode is detected by the always-materialized `roadmap/README.html` index. When it exists, the gate is **mandatory**: a missing `roadmap/check-timestamp-parity.cjs` **halts the run** (an upgraded roadmap that predates the gate, or a write pass that failed to refresh it, must not slip through un-audited — bug-3). The roadmap skill's html-mode write passes (Materialize / Sync / Re-eval / mutation ops) re-materialize the asset, so under normal PM flow it is present by the time this runs; the halt is defense-in-depth. In md mode (no `roadmap/README.html`) the check is skipped — `.md` pages carry the timestamp once (frontmatter), so nothing can diverge.
- **Branch scope (default, no args).** The gate audits the pages this branch added or modified — including the just-re-rendered, still-**uncommitted** ones (the branch diff includes working-tree changes vs `HEAD`) — via the orchestrator's `.orchestrator/gate-scope.cjs`, present because PM runs the orchestrator. That is exactly the set of pages in the PR diff. (For a roadmap outside a PM/orchestrator context, `--all` runs the same check self-contained.)
- **Red gate → halt** (same discipline as the **Trailer-mismatch guard**): the gate exits non-zero and lists the offending pages. PM **stops** — it does not commit the sync/planning docs, push, or open the PR. The fix is to re-render the flagged pages through the `roadmap` skill so both timestamps agree, then re-run PM for the story.

---

## PM never merges PRs

PM opens PRs and stops. Merging is a human action, performed after code review and any CI gates pass.

---

## Stacked PR ordering

When a run produces multiple stories, each story's PR is opened immediately after that story's push. The order follows the story queue (see `references/scope-resolution.md`), which means dependent stories are pushed and PR'd after their predecessors — ensuring `gh pr create --base <predecessor-branch>` targets a branch that already exists on the remote.

---

## Planning-PR flow

The management verbs (`assign`/`park`/`unpark`/`add-spec`/`reorder`/`revise`/`release`; see `references/roadmap-management.md`) **mutate the roadmap** rather than execute stories. They do **not** run the orchestrator, carry no `Roadmap-Story:` trailer, and produce a single documentation PR — the **planning PR**. The git model reuses base resolution but is simpler than the per-story success path.

### Branch naming

```
pm/roadmap-<verb>-<slug>
```

where `<verb>` is the management verb (`assign`, `park`, `unpark`, `add-spec`, `reorder`, `revise`, `release`) and `<slug>` is a short kebab-case slug of the change (e.g. the target band, or the primary resolved id). Example: `pm/roadmap-assign-mvp`, `pm/roadmap-park-002-1`.

The base is the **PM starting branch** (existing **Base resolution**: `--base` flag > `pm.config.json.base_branch` > the branch PM was invoked on). A planning branch never stacks — it always cuts off the starting branch:

```bash
git checkout -b pm/roadmap-<verb>-<slug> <starting-branch>
```

### Sequence

1. **Cut** `pm/roadmap-<verb>-<slug>` off the starting branch.
2. **Invoke the roadmap op** (`set-release` / `ingest-spec` / `reorder` / `revise` / `release`). The op stages a diff, gates on approval (`--yes` skips the gate), writes the `/roadmap/` files, and prints a proposed commit message. PM writes nothing itself.
   - **2b. Timestamp-parity gate (html mode).** When the op re-renders roadmap `.html` pages (any op that changes a readiness input), run the timestamp-parity gate (see **Timestamp-parity gate** below) before committing. A red gate **halts** — do not commit, push, or open the planning PR; re-render the flagged pages through the roadmap skill and re-run.
3. **Commit** the roadmap files the op wrote with a `docs(roadmap):` message using the op's proposed text:

   ```bash
   git -C "$(git rev-parse --show-toplevel)" add roadmap
   git commit -m "docs(roadmap): <verb> …"
   ```

   No `Roadmap-Story:` trailer (this is a plan change, not a story implementation), and no `/roadmap sync` (nothing was implemented).
4. **Push** the branch:

   ```bash
   git push -u origin pm/roadmap-<verb>-<slug>
   ```
5. **Open the planning PR** targeting the starting branch, using the planning-PR variant of `templates/pr-body.template.md` (staged-diff summary / resolved id set / verb):

   ```bash
   # render the planning-PR body to the git-root scratch dir first
   # (opencode cwd may be a repo subdir):
   root="$(git rev-parse --show-toplevel)"
   mkdir -p "$root/.orchestrator/tmp"
   # -> render templates/pr-body.template.md into
   #    "$root/.orchestrator/tmp/pm-roadmap-pr-body-<verb>.md"
   PR_URL=$(gh pr create --base <starting-branch> --head pm/roadmap-<verb>-<slug> \
              --body-file "$root/.orchestrator/tmp/pm-roadmap-pr-body-<verb>.md")
   rm -f "$root/.orchestrator/tmp/pm-roadmap-pr-body-<verb>.md"
   ```

As with story PRs, PM opens the planning PR and stops — it never merges.

### Reject-and-discard

If the user **rejects at the staged-diff gate** (or the op produces an empty diff), the roadmap op writes nothing, so the planning branch has **no commits**. PM discards it and returns to the starting branch, leaving the working tree untouched:

```bash
git checkout <starting-branch>
git branch -D pm/roadmap-<verb>-<slug>   # unpushed, no commits — safe to delete
```

PM then reports the discard (verb, resolved id set, reason). No push, no PR. See `references/roadmap-management.md` → **Reject-and-discard**.

---

Cross-references:
- Scope and story queue ordering: `references/scope-resolution.md`
- Management verbs + planning PR front-door: `references/roadmap-management.md`
- Human-validation spots (affects PR body `{{human_validation_note}}`): `references/human-validation.md`
- Run log and resume behavior: `references/resume-and-logging.md`
- PR body token definitions (story + planning variants): `templates/pr-body.template.md`
