---
id: SPEC-20260722T122523Z-b0c5
title: Remove unpaired legacy PR-review artifact so one authoritative snapshot pair remains
status: READY_FOR_PLANNING
created_at: 2026-07-22T12:26:05Z
updated_at: 2026-07-22T12:26:05Z
cycle: 0
related_to: —
---

## Summary

The `docs/reviews/` directory currently holds two competing PR-review reports for the
same branch and date: a legacy-named `feat-pr-review-md-backlog-2026-07-20.html`
(tracked, reviewedHead `494e4169…`, with **no** same-basename Markdown sibling) and a
complete digest-named pair `feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.html` +
`.md` (reviewedHead `21d74f1b…`). Because the two describe different reviewed HEADs,
there is no single authoritative snapshot for that branch/date. This spec removes only
the unpaired legacy `.html`; the digest-named `.html` + `.md` pair already satisfies the
"one authoritative pair" requirement and is left untouched.

## Goals

- Delete the tracked, unpaired legacy artifact `docs/reviews/feat-pr-review-md-backlog-2026-07-20.html`.
- Leave exactly one authoritative report for the `feat-pr-review-md-backlog` / `2026-07-20`
  branch-date: the digest-named `…-92b62e30d08f-2026-07-20.html` + `.md` pair.
- Stage the deletion (`git rm`) so the working tree presents a clean, self-consistent
  `docs/reviews/` snapshot, stopping before any commit per repo policy.

## Non-goals

- **Do NOT regenerate** any PR-review report. The digest-named pair already exists and is
  complete; re-running `pr-review-report` is explicitly out of scope for this concern.
- Do NOT touch the digest-named pair (`…-92b62e30d08f-2026-07-20.html` / `.md`) or any
  other file under `docs/reviews/` (including the current-branch validation-fixer report).
- Do NOT modify any `SKILL.md`, reference, or template — this is a doc-artifact cleanup,
  not a skill/code change. In particular, the `pr-review-report` skill's digest-naming
  logic is not in scope here.
- Do NOT revert or alter any fix landed earlier in this run.
- Do NOT commit or push (repo invariant: stop at READY_TO_COMMIT).

## Users and use cases

- **Repo maintainer / reviewer (human) consuming `docs/reviews/`**: opens the reviews
  directory expecting exactly one authoritative report per branch/date. After this change,
  they find a single digest-named `.html` + `.md` pair for `feat-pr-review-md-backlog` on
  `2026-07-20`, with no stale competitor pointing at an older HEAD.

## Functional requirements

1. Remove the tracked file `docs/reviews/feat-pr-review-md-backlog-2026-07-20.html` from
   the repository, staging the deletion (e.g. `git rm docs/reviews/feat-pr-review-md-backlog-2026-07-20.html`).
2. After removal, `docs/reviews/` MUST contain, for the `feat-pr-review-md-backlog` /
   `2026-07-20` slice, exactly the digest-named pair
   `feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.html` and
   `feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.md`, and no legacy-named sibling.
3. No other file may be added, deleted, or modified by this change. The current-branch
   report `feat-validation-fixer-severity-routing-345083349153-2026-07-21.{md,html}` and
   all other review artifacts remain byte-for-byte unchanged.
4. The change stops at a staged deletion (READY_TO_COMMIT); the human performs the commit.

## Non-functional requirements

- **Performance**: —
- **Security / auth**: —
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: — (removed file is a generated review artifact, no user data)
- **Monetization tier**: —

## Project-context fit

- **Layer touched**: `docs/reviews/` only — generated PR-review output artifacts. No skill
  source (`plugins/my-skills/skills/…`), no reference, no template.
- **Reversibility**: a staged `git rm` of a tracked file is trivially reversible before
  commit (`git restore --staged` / `git checkout`), so this is not a one-way-door decision.
- **Invariant — never-commit**: this change stages a deletion but does not commit or push;
  the human owns the commit, consistent with the repo's staged-diff → propose-commit policy.
- **Reference integrity**: the legacy basename `feat-pr-review-md-backlog-2026-07-20.html`
  is referenced only by the current-branch validation-fixer review report that raised this
  concern (as evidence of the duplication), not by any consuming/index artifact. Removing
  the file therefore breaks no live cross-reference. The architect should confirm this holds
  at implementation time (no `index.json`, review-state, or template links to the basename).
- **Out-of-scope guard**: regenerating HTML review reports via the skill is out of scope
  per PROJECT-CONTEXT.md; this spec deliberately deletes-only and does not regenerate.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: —
- **Docs / artifacts**: `docs/reviews/feat-pr-review-md-backlog-2026-07-20.html` — deleted (staged).

## Open questions

- (none)

## Decisions resolved by Brainstormer default

- Regenerate a fresh digest-named report as part of this fix? → **No — delete only.** The
  digest-named `…-92b62e30d08f-2026-07-20` pair already exists and is complete, so "one
  authoritative pair" is satisfied by removal alone; the orchestrator scope and
  PROJECT-CONTEXT out-of-scope list both forbid regeneration here.
- How to remove the file — plain `rm` vs. `git rm`? → **`git rm` (staged deletion).** The
  file is tracked; staging the deletion yields a clean, reviewable diff and keeps the
  change reversible before the human commit, matching the repo's staged-diff policy.
- Whether removing the legacy file requires updating the report that references its
  basename? → **No.** The only reference is the current-branch validation-fixer report
  citing it as evidence of the duplication; that report is a point-in-time artifact and is
  explicitly out of scope, so it is left unchanged.

## References

- Concern source: `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md` (section "Bugs & Improvements", bug-6)
- File to remove: `docs/reviews/feat-pr-review-md-backlog-2026-07-20.html` (tracked, reviewedHead `494e4169…`, no `.md` sibling)
- Authoritative pair kept: `docs/reviews/feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.html` + `.md` (reviewedHead `21d74f1b…`)
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (never-commit; staged-diff policy), Out of scope (no regeneration of HTML review reports)
