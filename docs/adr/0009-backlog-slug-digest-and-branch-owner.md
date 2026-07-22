# ADR-0009 — Backlog slug digest width & branch-owner verification

- **Status:** Accepted
- **Date:** 2026-07-22
- **Skills affected:** `pr-review-report` (both ports: `plugins/my-skills/`, `.opencode/`)
- **Source finding:** sec-6 — "Branch-slug digest is only 48-bit and wrongly claimed to be a unique one-to-one mapping; the findings backlog has no branch-owner gate" (`SKILL.md` Step 1 / Step 6b, `references/findings-md-schema.md`, `docs/adr/0006`)
- **Builds on:** [ADR-0004](0004-review-state-branch-ownership.md) (the `review-state.json` branch-ownership gate this mirrors), [ADR-0006](0006-findings-backlog-ownership.md) (backlog ownership & merge semantics this hardens)

## Context

`pr-review-report` Step 6b emits a Markdown findings backlog at the **stable** path
`docs/reviews/<branch_slug>-<YYYY-MM-DD>.md`. `<branch_slug>` (Step 1) is a sanitized
readable prefix plus a digest of the **raw** branch, appended so that distinct branches
whose sanitized prefixes alias (`feat/foo` vs `feat-foo`, case-folds, Unicode-empty
fallbacks) do not land on one filename. `validation-fixer` then edits that file **in place**
as its resumable source of truth, and Step 6b **merges** into it by `fingerprint` (ADR-0006),
carrying the consumer's `[x]`/`[~]` dispositions and `_fixed via <sha>_` evidence forward.

Two defects, one root:

1. **The digest was 48-bit (12 hex).** Forty-eight bits is well inside birthday-collision
   range for a shared filename namespace, and the readable-prefix byte cap (200) left the
   `NAME_MAX` budget tight.
2. **The docs claimed the slug was a unique one-to-one mapping — that two distinct branches
   could not land on one filename.** A digest is a hash — it offers **no** uniqueness
   guarantee. The absolute-uniqueness language was false and, worse, it justified the absence
   of any downstream check: because the backlog merge keys on branch-independent
   `fingerprint`s (the same property that forced ADR-0004's `STATE-BRANCH-MISMATCH` gate on
   `review-state.json`), a filename collision — or a hand-copied/renamed backlog — would
   silently graft **one branch's dispositions onto another branch's findings**, with no gate
   to stop it. The backlog had branch ownership only implicitly (the title line), never
   enforced.

## Decision

**Widen the digest to 128 bits and add an explicit backlog branch-owner gate that mirrors
`review-state.json`'s `STATE-BRANCH-MISMATCH` (ADR-0004). Stop claiming injectivity.**

1. **128-bit digest.** Step 1 truncates `git hash-object --stdin` of the raw branch to
   **32 hex chars (128 bits)** (was 12/48). The readable-prefix byte cap drops **200 → 180**
   so the final component `<raw(≤180)>-<digest(32)>-<date(10)>.<ext(5)>` = `180 + 49 = 229`
   bytes stays under `NAME_MAX` (255) with ~26 B slack. Same branch → same digest → same file
   (re-review still resolves in place); distinct branches → distinct digest with
   overwhelming probability.
2. **Accurate language.** Every absolute-uniqueness claim (that the slug was one-to-one, that
   two branches could not share a file) in `SKILL.md` Step 1,
   `references/findings-md-schema.md`, the `branch-slug.test.sh` fixture, and ADR-0006 is
   reworded to **strong 128-bit collision resistance** — no claim of mathematical uniqueness.
3. **Branch-owner marker (producer).** The backlog stamps its owning **raw** branch in an
   own-line header comment `<!-- backlog-branch: <raw-branch> -->`, mirroring
   `<!-- backlog-schema: v1 -->`. Every `>` in the raw branch is escaped `&gt;` so an embedded
   `-->` cannot terminate the comment early. The marker is invisible in rendered Markdown and
   is not a `##` section / `- ` item / `_italic_` line, so `validation-fixer` ignores it. It is
   the backlog analogue of `review-state.json`'s `branch` field (ADR-0004).
4. **Branch-owner gate (merge).** Before carrying **any** disposition forward, and **after**
   the symlink/output-path guard (sec-4) and the backlog provenance gate (sec-4), Step 6b
   resolves the existing backlog's owner — **marker → title-line `<branch>` → absent = current
   branch** — and compares it to `git branch --show-current`. On a **`BACKLOG-BRANCH-MISMATCH`**
   it does **not** carry dispositions, does **not** overwrite, **preserves the existing file
   untouched**, surfaces the owning branch, and **requires explicit user approval** before
   importing the mismatched dispositions (this branch takes ownership — the rewrite restamps
   the marker) or replacing the file fresh. Reject by default. This is decisions 3–5 of
   ADR-0004, transposed to the `.md` backlog.
5. **Composed gate order.** The `.md` merge runs **symlink/output-path → backlog provenance →
   backlog branch-owner (new) → merge algorithm**, the same left-to-right discipline
   `review-state.json` documents (symlink guard → provenance → `STATE-BRANCH-MISMATCH` →
   fingerprint reconcile). The owner gate is **independent** of provenance: a backlog can be
   perfectly reviewer-local yet still belong to a *different branch* whose slug collided —
   provenance judges *trustworthiness of content*, the owner gate judges *whose content it is*.

The normative detail (marker format + escaping, owner-resolution precedence, the full gate)
lives in `references/findings-md-schema.md` (§File layout header block, §Regeneration & merge,
§Branch-owner gate); `SKILL.md` Step 6b summarizes and links. This ADR is **non-blocking** —
it records the decision; it introduces no new blocking gate beyond what sec-6 already lands.

## Alternatives considered

- **(A) Keep the 48-bit digest, add only the owner gate.** Rejected: the gate is a
  defense-in-depth backstop, not a licence to keep a weak namespace. 128 bits makes the
  collision itself vanishingly unlikely; the gate covers the residual (and the
  copy/rename case) — belt and braces, cheaply.
- **(B) Per-branch subdirectory or branch-keyed filename** (`docs/reviews/<branch>/…`).
  Rejected for the same reasons ADR-0004 rejected a per-branch state file: it breaks the
  HTML-basename parity and the `/validation-fixer <path>` hand-off line, and adds path
  machinery. The gate achieves the safety property with no path restructure.
- **(C) Widen digest but skip the owner gate, trusting 128-bit resistance.** Rejected: a hash
  still cannot *guarantee* uniqueness, and the merge carries dispositions in place — a
  copied/renamed/rare-collision file would silently graft another branch's `_fixed via <sha>_`
  onto live findings. The same reasoning that put `STATE-BRANCH-MISMATCH` on the JSON side
  applies here; consistency with ADR-0004 is itself a benefit.
- **(D) Fold the record into ADR-0006 instead of a new ADR.** Considered and permitted by the
  spec; a standalone ADR was chosen so the digest-width + owner-gate decision is discoverable
  on its own and cleanly cross-links ADR-0004 and ADR-0006. ADR-0006's stale injectivity line
  is corrected regardless.

## Consequences

- Already-written 12-hex backlogs resolve to a **new** 32-hex path on the next review (a
  one-time re-path); there is **no legacy-path fallback probing** (recorded default per the
  spec). A stale 12-hex file is inert and pruned by the user if desired.
- The owner marker is **optional / nullable**: a legacy backlog with no marker falls back to
  the title line, then to the current branch. Legacy backlogs parse and merge unchanged; no
  migration is forced (project backward-compat invariant).
- The marker value is **mechanical ownership data** — surfaced and compared, never obeyed
  (data-never-instructions); the `>`→`&gt;` escaping is applied symmetrically on write, compare,
  and display.
- Both ports change together; `references/findings-md-schema.md` stays byte-identical across
  ports and the `SKILL.md` summary edits mirror, preserving the port's intentional host
  divergences (opencode-port-parity invariant). The `branch-slug.test.sh` fixture is updated to
  the 32-hex / 180-byte invariants and a new `backlog-owner-gate.test.sh` fixture asserts the
  marker + gate + ordering; both run under `scripts/validate-pr-review-skill.sh`.
- No change to `validation-fixer`: it consumes the backlog unchanged and ignores the marker.
