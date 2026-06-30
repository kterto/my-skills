---
name: pr-review-report
description: Review the current branch against an auto-detected base branch and author one self-contained interactive HTML PR-review report: architecture with ADR recommendations, security, and bugs/improvements lenses, rendered diff with inline margin annotations, findings color-coded by severity. Use when the user invokes /pr-review-report, says "review this PR", "generate a code review report", "html review of my branch", or asks for a shareable review artifact of the current branch.
---

# PR Review Report

Opencode port of the Claude `pr-review-report` skill. Produce one self-contained interactive HTML code-review report for the current branch.

## Procedure

### 1. Resolve The Base Branch

Detect the default branch and merge-base, then show the user and let them override before reviewing.

Use git to determine:

- Current branch.
- Candidate base branch, preferring `origin/HEAD`, then `main`, `master`, `dev`.
- Merge-base SHA between the base and `HEAD`.
- Commit count and changed-file count for the branch diff.

Tell the user the base branch, merge-base SHA, commit count, and changed-file count. Use the `question` tool to ask whether to continue with that base or supply a different base. If overridden, recompute the merge-base and summary with the chosen base.

### 2. Gather The Diff

Gather:

```bash
git --no-pager diff <base>...HEAD
git --no-pager diff --stat <base>...HEAD
```

Read the full diff. If it is very large, prioritize files by `--stat` magnitude and explicitly list in the report any file you did not fully review. Never truncate silently.

### 3. Review Across Three Lenses

Follow `references/review-rubric.md`. Produce findings for:

- Architecture, including ADR recommendations where the criteria match. Recommend only; write no ADR files.
- Security.
- Bugs & Improvements.

Give each finding the full finding object: `id`, `severity`, `title`, `file`, `line`, `rationale`, `fix`, and architecture-only optional `adr`.

### 4. Author The HTML Report

Write one self-contained HTML file to `docs/reviews/<branch>-<YYYY-MM-DD>.html` following `references/html-template.md` exactly.

Requirements:

- Inline CSS and JS only.
- Use the required severity color tokens.
- Include the three review sections, finding cards, and rendered per-file diff.
- Include inline gutter annotations.
- Include bidirectional `finding-<id>` to `diffline-<file-slug>-<line>` anchors.
- Create `docs/reviews/` if absent.

Then tell the user the output path and a one-line summary with counts per severity.

## References

- `references/review-rubric.md` - what each lens looks for, severity definitions, ADR-worthy criteria.
- `references/html-template.md` - required structure, CSS tokens, and JS behaviors for the HTML artifact.
