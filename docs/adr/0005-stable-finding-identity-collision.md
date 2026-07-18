# ADR-0005 — Stable finding identity & fingerprint collision handling

- **Status:** Accepted
- **Date:** 2026-07-18
- **Skills affected:** `pr-review-report` (both ports: `plugins/my-skills/`, `.opencode/`)
- **Source finding:** arch-4 — "Persisted finding identity has no collision strategy" (`references/review-state-schema.md` fingerprint definition)
- **Builds on:** [ADR-0002](0002-review-state-authoritative-writer.md), [ADR-0004](0004-review-state-branch-ownership.md)

## Context

A finding's persisted identity is the `fingerprint` = `section|file|normalized-title`.
It is deliberately line-independent so a finding re-identifies across runs after its
code moves. `.pr-review/review-state.json` keys its `findings` map by this
fingerprint, and it is also the key for browser persistence, semantic reattachment,
and the long-lived audit `history`.

Two findings in the **same file** with the **same normalized title** (e.g. two
"unvalidated input" findings in different functions of one file) produce an identical
fingerprint. Keyed by that composite, one finding's `state`, `history`, and `thread`
would then overwrite or attach to the other. The schema only *asserted* "two findings
must never share a fingerprint" — an unenforced hope, with no detection, no
deterministic tie-break, and no migration story. Identity spans both schemas, the
browser, semantic reattachment, and audit history, so changing it later is costly —
hence this ADR.

## Decision

**Append a deterministic discriminator only on collision, detect collisions as a
hard build-time invariant, and keep the key backward-compatible.**

The fingerprint becomes `section|file|normalized-title[|discriminator]`:

1. **Mandatory collision detection.** When building a report (`SKILL.md` step 5),
   every finding's fingerprint MUST be checked for uniqueness before emit. A shared
   base key MUST be disambiguated. No two findings may share a fingerprint — enforced,
   not asserted. The template also defensively `console.warn`s a duplicate rather than
   silently merging.
2. **Discriminator, chosen deterministically:**
   - **Normalized symbol (preferred)** — the enclosing function / method / class /
     type name, run through the same normalization recipe. Line-independent and stable
     across runs.
   - **Deterministic ordinal (fallback)** — when no distinguishing symbol exists
     (top-level code, config/data files) or symbols still tie: sort colliding findings
     by ascending `line` then `id`; the first keeps the bare base key, the rest get
     `|2`, `|3`, …. Guarantees uniqueness; reattachment is weaker than the symbol case
     (a same-title reorder can swap ordinals) — accepted for this rare
     double-collision-without-symbol case.
3. **First colliding finding keeps the bare key** so it still matches an existing
   `version: 1` stored entry (history preserved); only the additional colliding
   finding(s) gain a discriminator.
4. **Reconciliation for a newly-colliding stored key.** When a stored bare key now
   matches two-or-more findings, the semantic fallback attaches the stored triage to
   the finding it actually describes; the others get their discriminated key and start
   `open`.

## Alternatives considered

- **Always hash a symbol/location into the key** (`section|file|symbol|title` for
  every finding). Rejected: it changes *every* existing `version: 1` key, forcing a
  migration and orphaning all stored history; and it makes identity brittle to symbol
  renames even when there is no collision. Appending only on collision leaves the
  common case untouched.
- **Line or offset in the key.** Rejected: destroys the line-independence that lets a
  finding survive code movement — the very property the fingerprint exists for.
- **Keep asserting uniqueness, add nothing.** Rejected: that is the bug. The assertion
  had no detection or tie-break.

## Consequences

- No two findings can share identity; a real double-finding in one file now persists
  two independent states/threads/histories (arch-4 closed).
- **No version bump, no migration.** The key is a superset — a non-colliding key is
  byte-identical to the `version: 1` form, and a discriminator is only ever appended.
  Old files stay readable; their bare keys still match non-colliding findings. A
  `version: 1` file never stored the second colliding finding's state anyway, so there
  is nothing to migrate. Keep writing `version: 1`.
- Enforcement is procedural (SKILL.md step 5) plus a defensive template `console.warn`;
  both ports carry it identically.
- Slight reattachment weakness only in the rare ordinal-fallback case (same title,
  same file, no symbol, reordered). The symbol discriminator avoids it whenever a
  symbol exists.
