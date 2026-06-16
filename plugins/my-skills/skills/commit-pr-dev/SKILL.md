---
name: commit-pr-dev
description: Stage and commit the working tree, push the current branch, and open a pull request targeting the `dev` branch (or the supplied base). Use when user invokes `/commit-pr-dev`, says "ship to dev", "commit and PR to dev", or asks to push current work for review on the dev branch. Confirms before any remote-state mutation.
---

# commit-pr-dev

Take the work in the current worktree from "diff in my editor" → "PR open against `dev`" in one flow. Always run from the repo root unless the user is already inside a sub-directory of a single repo.

## Inputs

- Optional base branch via slash arg: `/commit-pr-dev main`, `/commit-pr-dev release/2026-q2`. Default base: `dev`.
- Optional title hint via slash arg: `/commit-pr-dev dev "fix login regression"`. Otherwise infer.
- Optional flags inferred from natural language:
  - "draft" / "as draft" → `--draft`
  - "no commit" / "PR only" → skip the commit step (assume already committed)
  - "amend" → amend the last commit instead of creating a new one (only if HEAD is not pushed)

## Workflow

### Step 0 — Repo + branch sanity

Run in parallel:
- `git rev-parse --show-toplevel` — confirm inside a git repo. Stop if not.
- `git rev-parse --abbrev-ref HEAD` — current branch.
- `git status --porcelain=v1` — staged/unstaged state.
- `git log -3 --oneline` — recent commit style for matching tone.
- `git remote -v` — confirm a remote exists. Stop if not.
- `git fetch --quiet origin` — refresh remote refs (tolerate failure on offline).

Hard stops (report and exit, do not mutate):
- Detached HEAD.
- Current branch IS the base branch (e.g. on `dev` and asked to PR to `dev`). Suggest creating a feature branch first.
- Current branch is `main` / `master` / `trunk`. Refuse without explicit "yes I really mean main → dev" from user.

### Step 1 — Inspect changes

Read the diff:
- `git diff --stat HEAD` — overview of changed files
- `git diff --cached` and `git diff` — actual content

If the working tree is clean AND HEAD is already pushed to origin: skip Step 2 and Step 3, jump to Step 4 (PR-only path).

### Step 2 — Stage + commit (unless "no commit")

- Stage files explicitly by path, never blanket `git add -A` / `git add .` — sensitive files (`.env`, credentials, generated secrets) must not slip in.
- Refuse to stage anything matching: `*.env`, `*.env.*` (except `.env.example`), `*credentials*`, `*service-account*.json`, `*.pem`, `*.key`. If the user explicitly insists, surface the file and require a typed confirmation.
- Draft a commit message:
  - Match existing repo tone (read `git log -10 --oneline`). Most repos use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
  - Subject ≤ 72 chars, imperative mood, no trailing period.
  - Body wraps at 72 cols. Cover *why* + *what changed at a high level*, not file-by-file.
  - End with the project's standard co-author trailer if the repo's recent commits include one (look for `Co-Authored-By:` in `git log -20`).
- Show the message to the user, ask for confirmation. Edit on request.
- Commit with HEREDOC:
  ```
  git commit -m "$(cat <<'EOF'
  <subject>

  <body>
  EOF
  )"
  ```
- If a pre-commit hook fails: do NOT `--amend`. Fix the underlying issue, re-stage, create a NEW commit. Never `--no-verify`.

### Step 3 — Push (CONFIRM FIRST)

This is a remote-state mutation. Always confirm before pushing.

- Show the user:
  - Branch being pushed
  - Whether it's a new branch or existing one (track status)
  - Number of commits ahead/behind upstream
- Wait for explicit confirmation ("yes" / "push" / "go").
- Run `git push -u origin HEAD` (always set upstream so future pushes / `gh pr create` work). Never `--force` / `--force-with-lease` unless the user explicitly asks AND the branch is not protected.

### Step 4 — Open PR

- Verify base branch exists on remote: `git ls-remote --exit-code --heads origin <base>`. If not, stop and ask.
- Build PR title:
  - If user passed a title hint, use it.
  - Else, if the branch has exactly 1 new commit since base: use that commit's subject.
  - Else, summarize the range (e.g. "feat: auth module + onboarding wiring") drawing from the commits in `git log origin/<base>..HEAD --oneline`.
  - Strip Conventional-Commit prefix only if the user prefers PR titles without it (check recent merged PRs via `gh pr list --base <base> --state merged --limit 5`).
  - Cap at ≈ 70 chars.
- Build PR body using the template below, populated from the commit range.
- Run `gh pr create --base <base> --head <current-branch> --title "<title>" --body "$(cat <<'EOF' ... EOF)"`. Add `--draft` if requested.
- After creation, print the PR URL.

## PR body template

Generate this every time. Keep sections present even if a section is short — empty sections are deleted, not stubbed.

```markdown
## Summary

<2–4 sentence description of what this PR does and why. Lead with the user-visible outcome or the bug being fixed. No file lists here.>

## Changes

- **<area / module>**: <one-sentence description of the change>
- **<area / module>**: <one-sentence description of the change>

## Screenshots / recordings

<Only include for UI changes. Drop the section otherwise. Use `<details>` if more than two assets.>

## Test plan

- [ ] <Concrete verification step the reviewer can run locally>
- [ ] <Edge case to exercise>
- [ ] <Regression check on adjacent feature>

## Risks & rollback

<Call out anything risky: migrations, feature flags, breaking changes, infra touches. State the rollback path. Drop the section if the change is internal-only and trivially reversible.>

## Notes

<Follow-ups, known caveats, deferred items, links to related issues / specs / ADRs. Drop the section if empty.>

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Section rules when populating:

- **Summary**: derived from the commit-range subjects + bodies. Never just rephrase the title.
- **Changes**: one bullet per logical area. Group related files. If only one area, single bullet is fine.
- **Screenshots**: include only when the diff touches Flutter widgets, web components, CSS, or any visual surface. If no asset is at hand, write `_To be added before merge._`.
- **Test plan**: actionable steps. If unsure, infer from changed files (e.g. test commands from `package.json` / `Makefile` / `pubspec.yaml`).
- **Risks & rollback**: required when diff touches migrations, infra, env-config, auth, payment, or external APIs. Optional otherwise.
- **Notes**: optional.
- The trailer at the bottom is fixed — keep it.

## Hard rules

- Never `git add -A` / `.` blanket-stage. Path-by-path only.
- Never `--no-verify`, `--no-gpg-sign`, or any other hook/sign bypass.
- Never `--amend` a pushed commit.
- Never force-push without explicit user instruction. Never force-push to `main` / `master` / `dev`.
- Always confirm before `git push`. Always confirm before `gh pr create` if the base branch is `main` / `master` / production.
- Never include `.env`, credential, or key files in a commit. Surface and refuse.
- If `gh` CLI is missing or not authenticated, stop and tell the user to run `gh auth login`.
- If the branch already has an open PR against the requested base, do not open a duplicate. Print the existing PR URL and stop.

## Output

After completion, print:

```
commit-pr-dev — done
Branch: <branch>
Base: <base>
Commits pushed: <N>
PR: <url> (draft? yes/no)
```

If stopped before completion, print which step blocked + the reason.
