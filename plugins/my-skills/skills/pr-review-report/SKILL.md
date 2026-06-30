---
name: pr-review-report
description: Review the current branch against an auto-detected base branch and author one self-contained interactive HTML PR-review report — architecture (with ADR recommendations), security, and bugs/improvements lenses, the rendered diff with inline margin annotations, findings color-coded by severity. Use when the user invokes /pr-review-report, says "review this PR", "generate a code review report", "html review of my branch", or asks for a shareable review artifact of the current branch.
---

# PR Review Report

Produce one self-contained interactive HTML code-review report for the current branch.

## Procedure

1. Resolve the base branch. _(filled in Task 4)_
2. Gather the diff. _(filled in Task 4)_
3. Review across three lenses using `references/review-rubric.md`. _(filled in Task 4)_
4. Author the HTML per `references/html-template.md`. _(filled in Task 4)_

## References

- `references/review-rubric.md` — what each lens looks for, severity definitions, ADR-worthy criteria.
- `references/html-template.md` — required structure, CSS tokens, and JS behaviors for the HTML artifact.
