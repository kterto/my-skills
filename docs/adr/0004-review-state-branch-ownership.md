# ADR-0004 — Enforce branch ownership of the review-state file

- **Status:** Accepted
- **Date:** 2026-07-18
- **Skills affected:** `pr-review-report` (both ports: `plugins/my-skills/`, `.opencode/`)
- **Source finding:** arch-3 — "The state file declares branch ownership but never enforces it" (`references/review-state-schema.md`, `SKILL.md` steps 2b/4/7b)
- **Builds on:** [ADR-0002](0002-review-state-authoritative-writer.md), [ADR-0003](0003-browser-autosave-revisioned-op-log.md)

## Context

`.pr-review/review-state.json` is a single **uncommitted** working-tree file. Git
leaves uncommitted/untracked files in place across a `checkout`, so the file
**survives a branch switch**. The schema records the owning branch in a top-level
`branch` field, but nothing checked it: step 2b `cat`s the file, and step 4
reconciles purely by `fingerprint`.

A fingerprint is `section|file|normalized-title` — deliberately branch-independent
so a finding re-identifies across runs. That same property means a finding on
branch B whose file+title match one on branch A will **collide** with A's stored
entry. So after switching from A to B and re-running, B's review would silently
inherit A's `ignored` / `acknowledged` / `fixed` states and thread — altering B's
severity counts and hiding real findings. `branch` was a label, not a gate.

## Decision

**`branch` is a hard gate on reconciliation, and the write must not clobber a
different-branch file. Keep single-file storage.**

1. **Exact-match gate.** Reconcile prior state (step 4) **only when the file's
   `branch` equals the current branch**. An absent `branch` is treated as the
   current branch (legacy / first write) — back-compat, not a bypass.
2. **Mechanical mismatch signal.** Step 2b extracts the file's `branch` and compares
   it to `git branch --show-current`, emitting `STATE-BRANCH-MISMATCH` when they
   differ — a signal the skill cannot skim past.
3. **Preserve but ignore by default.** On mismatch, review as if no prior state
   exists (every finding `open`), never silently discard the file, surface which
   branch it belongs to, and **ask before importing**.
4. **Import is opt-in.** Only on explicit approval, reattach the mismatched triage by
   fingerprint into the current branch; the file's `branch` is rewritten to the
   current branch (this branch takes ownership).
5. **Never clobber without consent.** Because storage is one file, writing the
   current branch's state (step 7b) would overwrite a different-branch file. On an
   unresolved mismatch, **skip the write** and tell the user to commit or move the
   other branch's file first — preserving their triage over persisting this run.

## Alternatives considered

- **Branch-keyed map in one file** (`{ branches: { "<b>": {findings} } }`) **or a
  per-branch file** (`review-state.<slug>.json`). Naturally isolates branches on both
  read and write. Rejected for now: it breaks the ADR-0002 envelope contract — the
  browser writes the *whole* file it is given but would only see its own branch's
  slice, so it could not safely round-trip a multi-branch file without dropping the
  branches it cannot see. It also adds branch-name slugging and a migration. The gate
  achieves the safety property with no schema restructure; a keyed store can be
  revisited if multi-branch triage becomes a real workflow.
- **Auto-import on mismatch (trust the fingerprints).** Rejected: exactly the leak
  the finding reports. Cross-branch state transfer must be a deliberate user choice.

## Consequences

- Another branch's triage can no longer bleed into the current review or distort its
  counts (arch-3 closed).
- Single-file storage, and the ADR-0002/0003 envelope + autosave contracts, are
  unchanged.
- The browser side needed no change: its `localStorage` autosave is already keyed
  `pr-review-state:<branch>` and `buildSaveObject` stamps the current `branch`, so a
  mismatch cannot originate there.
- Edge cost: on an unresolved mismatch the skill does not persist this run's cycle
  state (favoring the other branch's un-committed triage). The user resolves it once
  by committing/moving the file or choosing import/overwrite.
- Enforcement is procedural (SKILL.md) plus a mechanical `STATE-BRANCH-MISMATCH`
  check; both ports carry it identically.
