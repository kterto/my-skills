---
name: pr-review-report
description: Review the current branch against an auto-detected base branch and author one self-contained interactive HTML PR-review report — architecture (with ADR recommendations), security, and bugs/improvements lenses, the rendered diff with inline margin annotations, findings color-coded by severity. Use when the user invokes /pr-review-report, says "review this PR", "generate a code review report", "html review of my branch", or asks for a shareable review artifact of the current branch.
---

# PR Review Report

Produce one self-contained interactive HTML code-review report for the current branch.

## Procedure

### 1. Resolve the base branch

Detect the default branch and the merge-base, then show the user and let them override:

```bash
# default branch: prefer origin/HEAD, then main, master, dev
guess="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"
base=""
for cand in "$guess" main master dev; do
  [ -n "$cand" ] || continue
  if git show-ref --verify --quiet "refs/heads/$cand"; then base="$cand"; break
  elif git show-ref --verify --quiet "refs/remotes/origin/$cand"; then base="origin/$cand"; break
  fi
done
base="${base:-origin/main}"   # last-resort fallback
branch="$(git branch --show-current)"
mb="$(git merge-base "$base" HEAD)"
git --no-pager log --oneline "$mb"..HEAD | wc -l   # commit count
git --no-pager diff --stat "$mb"..HEAD             # changed files / lines
```

Tell the user: base branch, merge-base sha (short), commit count, changed-file count.
Ask them to confirm or supply a different base before continuing. Re-run with the
chosen base if overridden.

### 2. Gather the diff

```bash
git --no-pager diff "$base"...HEAD          # three-dot: branch changes since divergence
git --no-pager diff --stat "$base"...HEAD
```

Read the full diff. If it is very large, prioritize files by `--stat` magnitude and
explicitly list in the report any file you did not fully review — never truncate silently.

### 3. Review across three lenses

Follow `references/review-rubric.md`. Produce findings for Architecture (with ADR
recommendations where criteria match — recommend only, write no files), Security,
and Bugs & Improvements. Give each finding the full finding object: id, severity,
title, file, line, rationale, fix, and (architecture only) optional adr.

### 4. Author the HTML report

Write ONE self-contained HTML file to `docs/reviews/<branch>-<YYYY-MM-DD>.html`
following `references/html-template.md` exactly — inline CSS+JS, severity color
tokens, the three sections, finding cards, the rendered per-file diff with inline
gutter annotations, and the bidirectional `finding-<id>` ⇄ `diffline-<file-slug>-<line>`
anchors. Create `docs/reviews/` if absent.

Then tell the user the path and a one-line summary (counts per severity).

## References

- `references/review-rubric.md` — what each lens looks for, severity definitions, ADR-worthy criteria.
- `references/html-template.md` — required structure, CSS tokens, and JS behaviors for the HTML artifact.
