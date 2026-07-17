# Roadmap — Sync + Re-eval Algorithm Reference

This document is the single source of truth for the three non-trivial algorithms used by the `roadmap` skill: rollup derivation, the `/roadmap sync` procedure, and the re-evaluation (diff + preserve) procedure.

`SKILL.md` references these sections by name: **Rollup rules**, **Sync procedure**, **Re-eval procedure**.

---

## Rollup rules

Rollup derives a phase status from its user stories, and a milestone status from its phases. The function is applied bottom-up after every sync or re-eval run, and audit rows are appended only where the derived status changed.

| Condition | Derived status |
|---|---|
| All children `done` or `superseded` | `done` |
| Any child `blocked` | `blocked` |
| Any child `in_progress` or mixed `done` + `todo` | `in_progress` |
| All children `todo` | `todo` |

`superseded` children are excluded from "is there remaining work" but kept in the count.

---

## Sync procedure

`/roadmap sync` stamps user-story items `done` by scanning git commit trailers. It is **idempotent and additive** — re-running it never regresses or rewrites prior rows.

### Steps

1. Read `last_synced_sha` from `roadmap.lock.json`.
2. Run the git trailer scan (see command below). When `last_synced_sha` is `null`, scan full history. Per commit, extract: matched user-story id(s), author name/email, author date (ISO-8601), sha.
3. For each matched user story not already `done` or `superseded`: set `status: done`, append a full audit row (`when` = commit author date, `status` = `done`, `who` = author name/email, `evidence` = commit sha).
4. Roll up phase and milestone statuses (see Rollup rules above); append rollup audit rows only where the derived status changed.
5. Update `last_synced_sha` to `HEAD`, refresh README progress %, print a summary of stamped stories.

### Git command

```bash
git log ${last_synced_sha:+"$last_synced_sha.."}HEAD --grep 'Roadmap-Story:' \
  --pretty=format:'%H%x09%an <%ae>%x09%aI%x09%(trailers:key=Roadmap-Story,valueonly)'
```

When `last_synced_sha` is set, `${last_synced_sha:+"$last_synced_sha.."}` expands to `<sha>..`, giving the range `<sha>..HEAD`. When it is `null` (before first sync) the prefix expands to nothing, leaving just `HEAD` — which scans the full history reachable from `HEAD`. Do **not** write `"${last_synced_sha:-}"..HEAD`: an empty left side makes `..HEAD`, which git reads as `HEAD..HEAD` (empty), so the first sync would scan nothing.

### Parse example

Given a commit with trailer `Roadmap-Story: 001.1.1`, the output line is:

```
a3f9c2e	Jane Smith <jane@example.com>	2026-06-21T14:30:00+00:00	001.1.1
```

Fields (tab-separated): `sha`, `author name <email>`, `author date (ISO-8601)`, `user-story id(s)`.

---

## Re-eval procedure

Triggered by running `/roadmap` when `/roadmap/` already exists. Re-evaluation reconciles the roadmap with a changed context or spec without destroying completed-work history.

**Immutability rule.** Completed work is never renumbered, never deleted. The roadmap converges on the new spec by adding and superseding, not by rewriting history.

### Steps

1. Re-read context/spec; re-derive the target tree.
2. Diff target vs `roadmap.lock.json` (compare by `id`, detect scope change via `content_hash`):
   - **New** items → stage as appends with next stable IDs (`+ new`).
   - **Scope-changed** items → stage body/acceptance update; status unchanged unless the change obsoletes the item (`~ changed`).
   - **Obsoleted** items: if `done` → `status: superseded` (kept + flagged, audit row); if not-done → `status: superseded` as well (kept for audit; never hard-deleted) (`! superseded`).
3. Present the staged diff with markers `+ new`, `~ changed`, `! superseded`; require user approval before applying.
4. On approval → apply changes, append audit rows for every status transition, update `roadmap.lock.json`.

### Band preservation (`release` and `system`)

Re-eval is **band-preserving for both bands**: it **never changes an item's existing `release` value, and never changes its existing `system` value**. New items introduced by a re-eval default to `release: null` (untiered) **and `system: null` (untagged)** unless a spec explicitly pins a band. Band changes are the job of the `set-release` / `set-system` ops (and the `migrate-systems` procedure) — see `mutation-ops.md` — not re-eval.

### `ingest-spec` — targeted re-eval

`ingest-spec <path>` is the Re-eval procedure above **scoped to a single explicit spec path**: only the milestones/phases/stories that spec introduces or changes are staged; the rest of the tree is untouched. Band-preservation (above — both `release` and `system`) and `done`-immutability apply exactly as in a full re-eval: existing `system` values are preserved and new items default to `system: null`. It is the mutation invoked by the PM `add-spec` verb. Full op semantics live in `references/mutation-ops.md` → `ingest-spec`.
