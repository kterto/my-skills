# ADR-0003 — Browser autosave is a revisioned op-log, not a state snapshot

- **Status:** Accepted
- **Date:** 2026-07-18
- **Skills affected:** `pr-review-report` (both ports: `plugins/my-skills/`, `.opencode/`)
- **Source finding:** arch-2 — "Stale localStorage overrides newer skill verification" (`references/report-template.html`, `overlayLocalStorage`)
- **Builds on:** [ADR-0002](0002-review-state-authoritative-writer.md)

## Context

ADR-0002 made the skill and browser share one complete state envelope. The browser
still autosaves the user's edits to a `localStorage` cache keyed only by branch
(`pr-review-state:<branch>`), and `overlayLocalStorage` **blindly replaced** the
envelope-seeded `STORE` state, thread, and history with that cache.

That cache is not revisioned, so it cannot tell "older than the report" from
"newer than the report". The failure:

1. Run 1 — user marks `sec-1` **fixed**, comments. Browser caches
   `{sec-1: {state: fixed, thread: [userTurn]}}`.
2. Run 2 — the skill re-reviews, verifies **fixed → resolved**, appends a `skill`
   reply, and writes the authoritative envelope (`state: resolved`, longer thread,
   `history` with the resolved transition).
3. User opens the run-2 report. `buildStore` seeds `STORE` from the envelope
   (`resolved`, full thread), then `overlayLocalStorage` **overwrites** it with the
   stale cache → `state` reverts to `fixed` and the `skill` reply is truncated.
   Saving writes the stale `fixed` back to disk, destroying the newer verification.

A branch-keyed full snapshot with no revision anchor is the root cause.

## Decision

**The browser autosave becomes a revisioned operation log replayed over the
envelope, never a snapshot that overwrites it.**

- **Report revision.** `EMITTED_REV` is the newest transition/thread `ts` the
  embedded envelope reflects — every user op up to that instant is already merged
  into the envelope by the skill.
- **Op-log cache.** `localStorage` stores `{ rev, ops: [...] }`, where each op is a
  user `state` change or `comment` with its own `ts`. `persist()` writes this;
  `setFindingState` / `addUserComment` append to it.
- **Revisioned replay.** On load, replay **only** ops with `ts > EMITTED_REV`; prune
  ops at/below it (already in the envelope). So a stale cache can never revert a
  newer skill-derived transition, and genuine post-report user edits still survive a
  refresh.
- **Merge, never truncate.** Thread turns and history records merge by stable
  identity (`author|text|ts`, `from|to|ts`) — idempotent replay, no duplication, no
  loss of `skill` turns the envelope added.
- **Legacy cache migration.** A pre-op-log full-snapshot cache is honored with the
  original full overlay **only when no envelope is present** (a legacy single-writer
  report). With an envelope, it contributes user comment turns (merged) but never
  clobbers state/history. The next `persist()` rewrites it as an op-log.

## Alternatives considered

- **Timestamp-guard the existing snapshot (per-field `updatedAt`).** Keep the full
  snapshot but only apply a cached field if its `updatedAt` beats the envelope's
  latest transition. Rejected: it still ships a whole snapshot (easy to clobber a
  field the guard misses) and needs per-field timestamps the snapshot never had. The
  op-log carries the timestamp *per operation* natively.
- **Drop the cache entirely; rely on the on-disk file.** Rejected: the cache exists
  to survive a browser refresh before the user saves to disk. Removing it loses
  un-saved in-browser edits.

## Consequences

- Stale cache can no longer overwrite a newer skill verification or truncate a
  thread (arch-2 closed).
- The cache stays bounded: superseded ops are pruned every time a newer report is
  opened.
- Replay is idempotent, so a double-open or refresh reconstructs identical state.
- One-time migration cost: un-saved in-browser edits made under the *old* template
  (full-snapshot cache) contribute only their comment turns when reopened against an
  envelope; their un-saved state changes are dropped in favor of the authoritative
  envelope. Acceptable — those edits were never persisted to disk.
- Both ports change together; the template is byte-identical across ports.
