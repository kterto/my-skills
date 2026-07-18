# ADR-0002 — Authoritative review-state writer & merge protocol

- **Status:** Accepted
- **Date:** 2026-07-18
- **Skills affected:** `pr-review-report` (both ports: `plugins/my-skills/`, `.opencode/`)
- **Source finding:** arch-1 — "The browser writer cannot preserve the authoritative state contract" (`references/report-template.html`, browser writer vs. `review-state-schema.md`)

## Context

`pr-review-report` is cyclical: `.pr-review/review-state.json` carries each
finding's triage (`state`), comment `thread`, append-only `history`, and
prior-only **orphans** forward across runs. `review-state-schema.md` is the single
source of truth for that file's shape and its **skill-side three-way merge** (prior
∪ browser-saved ∪ this-run-derived, never a wholesale overwrite).

Two components write that file:

1. **The skill** (`SKILL.md` step 7b) — does the correct merge and preserves
   `history`, orphans, and the source `version`.
2. **The browser** (`report-template.html` — `buildStore` / `buildSaveObject`,
   surfaced by the "Save review state" button) — rebuilds a **complete
   `version: 1` file** purely from `REVIEW_DATA` + its own `localStorage`.

`REVIEW_DATA` is a **lossy projection**: per the data schema it carries per-finding
`state` and `thread` but **not** `history`, **not** prior-only orphans, and **not**
the on-disk file's `version`. So the browser writer cannot see the authoritative
state it is overwriting:

- `buildStore` seeds `history: []` for every finding → a browser save **erases the
  append-only audit trail**.
- `buildSaveObject` writes only fingerprints present in `STORE` (seeded from
  `REVIEW_DATA.findings`) → **orphans not re-emitted this run are dropped**.
- `buildSaveObject` hardcodes `version: 1` → a **newer, unknown on-disk version is
  silently downgraded/clobbered**, violating the schema's "read conservatively,
  never rewrite a forward-version file" rule.

Merely opening a freshly generated report and clicking **Save** can therefore
destroy the audit trail, retained orphans, and forward-version metadata the
persisted-store contract requires. Two competing full-state writers with unequal
inputs is the root cause.

## Decision

**The browser and the skill share ONE complete state envelope; the browser is a
faithful editor of it, not a lossy re-constructor.**

1. **Embed the complete envelope in `REVIEW_DATA`.** The skill adds an optional
   top-level `reviewState` field to `REVIEW_DATA` holding the *exact* merged
   `.pr-review/review-state.json` object it writes in step 7b — all fingerprints
   (**including orphans**), full `history`, `lastFinding`, `thread`, and the source
   `version`. The same object is written to disk and embedded, so they never
   diverge.
2. **The browser seeds `STORE` from that envelope** (authoritative), applies the
   user's edits on top, and `buildSaveObject` writes the **same complete envelope
   back** — preserving `history`, orphans, and the source `version` (no longer
   hardcoded).
3. **Unknown forward versions are read-only in both ports.** If the embedded
   envelope's `version` exceeds the version the code understands, the browser
   **disables all writes** (Save button, per-finding mutations, and `localStorage`
   autosave) and surfaces a read-only notice — mirroring the skill's
   preserve-and-show-read-only behavior. Neither port ever rewrites or downgrades a
   forward-version file.

`reviewState` is **additive and optional**: a legacy `REVIEW_DATA` without it falls
back to the previous behavior (seed from per-finding `state`/`thread`, empty
`history`), so old reports still render and the "strict superset" guarantee holds.

## Alternatives considered

- **(A) Browser exports operation deltas; skill replays them.** The browser would
  save only the `setState` / `addComment` operations the user performed, and the
  skill would replay them onto the authoritative on-disk file. Rejected: it adds a
  second file and a delta-replay protocol, re-creating the same "two artifacts can
  disagree" failure class (replay ordering, a stale canonical file if the skill is
  never re-run). It solves the symptom by adding surface area rather than removing
  the asymmetry.
- **(B — chosen) Embed the complete envelope; both ports merge into it.** Keeps one
  file, one format, one save UX. The browser gets exactly the input it was missing,
  so its complete-file write becomes correct. Minimal, lowest-risk protocol change:
  carry the envelope through and merge instead of rebuild.

## Consequences

- `REVIEW_DATA` grows by the embedded envelope (orphans + `history`). Acceptable —
  it is a local, self-contained HTML artifact.
- The skill remains the **primary merger** (step 7b unchanged); the browser becomes
  a faithful editor. "Competing full-state writers" → "one shared envelope, two
  editors that both preserve it."
- Round-trip safety: opening a report and saving preserves history, orphans, and
  version even when the user changes nothing.
- Forward compatibility: a newer-schema state file is never destroyed by an older
  report — it renders read-only in the browser and is preserved by the skill.
- Both ports (`plugins/my-skills/` and `.opencode/`) must change together; the
  template is byte-identical across ports and the schema/skill edits mirror.
