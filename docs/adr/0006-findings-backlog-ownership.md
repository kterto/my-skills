# ADR-0006 — Findings-backlog ownership & regeneration semantics

- **Status:** Accepted
- **Date:** 2026-07-20
- **Skills affected:** `pr-review-report` (both ports: `plugins/my-skills/`, `.opencode/`); `validation-fixer` (the backlog's consumer — **this ADR's merge decision requires no change to it**; its own consumer-side contract on this branch — per-item clean-tree precondition, untrusted-evidence trust boundary, and per-item commit ownership + rollback — is defined by its `SKILL.md` and **ADR-0007**, not here)
- **Source finding:** arch-2 — "Re-review overwrites the consumer-owned backlog" (`SKILL.md` Step 6b, `references/findings-md-schema.md`)

## Context

`pr-review-report` Step 6b emits a Markdown findings backlog at the **stable** path
`docs/reviews/<branch_slug>-<YYYY-MM-DD>.md` (same basename as the HTML report;
`<branch_slug>` is the filesystem-safe, injective branch slug — a sanitized form plus a
deterministic digest of the raw branch so two distinct branches never collide on one file
(bug-2, bug-8); the raw branch, which may contain `/`, appears only in the title heading,
never in the path). That file
is the hand-off to `validation-fixer`, which **edits it in place** as its resumable
source of truth: it flips `- [ ]` → `- [x]` on a fixed item, writes `- [~]` for an
attempted-no-commit item, and appends a `_fixed via <sha> · <date>_` /
`_attempted via … needs attention_` status line (its `SKILL.md` — "record the outcome
back in the same file so progress is resumable").

The backlog was specified as **additive with no round-trip**: dispositions are tracked
`.md`-natively and are deliberately **never** written back into
`.pr-review/review-state.json`. That severance is the root of the defect. Two
components write the same mutable path with unequal contracts:

1. **The producer** (`pr-review-report` Step 6b) regenerates the whole file from
   `REVIEW_DATA.findings`.
2. **The consumer** (`validation-fixer`) mutates it in place.

Because Step 6b was a **blind overwrite**, a second review of the same branch on the
same day — or any re-run while `validation-fixer` is mid-progress — resolves to the
same path and destroys the consumer's `[x]`/`[~]` marks, commit SHAs, dates, and
attempt notes. `review-state.json` cannot rescue them: the no-round-trip rule means
this file is their **only** home. Step-4 re-verification recovers at most `resolved`
(the fix actually left the diff); it recovers neither the attempt narrative nor the
commit evidence nor a mid-run resume position. The sharpest loss is a `[~]`
attempted-no-commit item silently reverting to a bare `[ ]`, discarding the "already
tried, needs hands-on" signal with no warning.

## Decision

**The backlog is a single shared artifact with split ownership; the producer merges
into it rather than overwriting it.**

1. **Split ownership.** The producer owns finding *identity and content*
   (`title` / `Rationale` / `Fix` / severity / `file` / `line`) — taken fresh from
   each run. The consumer owns each finding's *disposition* (the `[x]`/`[~]` prefix and
   its single `_fixed via …_` / `_attempted via …_` status line).
2. **Merge, never blind-overwrite.** If a backlog already exists at the path, Step 6b
   parses it into `{ fingerprint → { prefix, statusLine } }`, then layers this run's
   freshly-derived rows on top, carrying each recorded disposition forward by
   `fingerprint` (the line-independent identity already on every row).
3. **Re-verification wins, history preserved.** When this run's derived state and the
   recorded disposition disagree on a fingerprint, the producer's diff-evidence
   re-verification is authoritative for the **checkbox**, but the consumer's recorded
   **evidence** is never discarded — a prior `[x]` whose concern reappears reopens as
   `- [ ]` with a `_prior fix <sha> regressed <date>_` note; a `[~]` still open keeps
   its attempt line. This mirrors `review-state.json`'s append-on-transition
   `history[]` (ADR-0002): state may change, the trail may not be erased.
4. **Read-only-future guard.** An optional header marker `<!-- backlog-schema: vN -->`
   (absent = `v1`) lets a future producer detect a newer on-disk schema and skip the
   write rather than downgrade it — the same forward-version protection Step 7b gives
   `review-state.json` (bug-1).
5. **Prior-only retention — unmatched consumer-owned rows survive (arch-2 re-fix).**
   The matched-fingerprint merge (points 2–3) preserves a disposition **only while this
   run reproduces its finding**. But a finding whose concern *leaves the diff* — exactly
   what `validation-fixer` produces when it lands a fix — has no row in this run's
   `REVIEW_DATA.findings`, so points 2–3 alone would drop it and take its sole commit/
   attempt evidence with it. The no-round-trip severance makes this unrecoverable:
   `review-state.json` is not the home of these dispositions. Therefore an **unmatched
   consumer-owned row** (a `[x]` fixed / `[~]` attempted bullet, identified during the
   merge parse) is **retained** — re-emitted verbatim as a closed **prior-only `[x]`
   audit record** carrying its consumer status line plus a `_prior-only: finding left
   this review's diff (<date>)_` note — and persists across regenerations until a user
   **explicitly prunes** it. This is the `.md`-native analogue of Step 4's `review-state`
   orphan pass (bug-2), but independent of it: because dispositions never round-trip, the
   `.md` merge must preserve its own history even when no orphan is materialized (a lost,
   reset, or other-branch `review-state.json`). A migrated fingerprint (an alias
   re-attached to a reproduced finding in Step 2/4) is **excluded** from retention — its
   disposition already rides the live row, and emitting a prior-only row too would be a
   phantom duplicate, the same failure `review-state.json`'s bug-5 guard prevents.
   A `[ ]` fixer-untouched unmatched row carries no consumer evidence and is dropped.

The full protocol lives in `references/findings-md-schema.md` §Regeneration & merge
(single source of truth); `SKILL.md` Step 6b summarizes and links.

## Alternatives considered

- **(A) Immutable run-specific filenames** (e.g. append a timestamp). Rejected: breaks
  the HTML-basename parity and the `/validation-fixer <path>` hand-off line, and
  fragments the consumer's source of truth across N files — which one does
  `validation-fixer` resume? It trades a clobber for an ambiguity.
- **(B) Refuse to overwrite an existing backlog.** Rejected as the primary fix: a
  re-review could then never fold in **new** findings, defeating the point of
  re-reviewing, and it forces manual file juggling. Retained only as the spirit of the
  read-only-future guard (a hard skip, but scoped to unknown-newer schemas).
- **(C — chosen) Merge by fingerprint with split ownership.** Preserves the consumer's
  progress, still surfaces new findings, keeps the stable path and HTML parity, and
  reuses the exact discipline the JSON side already has (skill-side merge, never
  clobber, forward-version guard — ADR-0002). Minimal, lowest-surface change: teach the
  producer to read-then-merge instead of write-fresh.
- **Conflict rule sub-decision — recorded disposition wins (sticky `[x]`).** Rejected:
  a regressed fix would stay hidden as `[x]` until manually reopened, so the backlog
  could assert "done" against live code that still exhibits the concern. Diff evidence
  must be able to reopen an item.

## Consequences

- Step 6b gains a read-parse-merge path; the empty-file case is unchanged, so first
  runs are unaffected.
- `validation-fixer` needs **no change for this ADR's merge decision** — its in-place
  edits are now respected instead of clobbered; the producer adapts to the consumer, not
  the reverse. (Separately, this branch *does* change `validation-fixer` elsewhere — its
  per-item commit ownership + rollback and its untrusted-evidence trust boundary /
  clean-tree precondition — but those belong to its own `SKILL.md` and ADR-0007, not to
  the producer-side merge decided here.)
- The `.md` remains outside `review-state.json` (no round-trip), but is no longer a
  lossy artifact: its own content is the durable store, and the merge makes that store
  safe across regenerations — including when a finding leaves the diff, since prior-only
  retention (decision point 5) keeps its consumer evidence as an `[x]` audit record
  instead of dropping it.
- Prior-only rows accumulate as `[x]` audit history and are never auto-pruned; a stale
  one is inert (skipped by `validation-fixer`) and removed only by explicit user action.
  This is deliberate — silent pruning would reintroduce the exact evidence-loss arch-2
  closes. The bug-5 alias exclusion keeps a migrated finding from spawning a phantom
  prior-only twin.
- Backward-compatible per the project invariant: the schema marker is optional
  (absent = `v1`), legacy backlogs parse and merge unchanged, and no migration is
  forced.
- Both ports (`plugins/my-skills/` and `.opencode/`) change together; the
  `findings-md-schema.md` is byte-identical across ports and the `SKILL.md` summary
  edits mirror (opencode-port-parity invariant).
