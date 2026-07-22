---
id: SPEC-20260722T030758Z-cefa
title: Harden pr-review-report branch-slug digest against collisions and verify backlog owner before merge (sec-6)
status: READY_FOR_PLANNING
created_at: 2026-07-22T03:12:14Z
updated_at: 2026-07-22T03:12:14Z
cycle: 0
related_to: docs/adr/0004-review-state-branch-ownership.md, docs/adr/0006-findings-backlog-ownership.md, docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md
---

## Summary

The `pr-review-report` skill names its HTML report and Markdown findings backlog with a
`branch_slug` that appends a **48-bit** (12 hex char) digest of the raw branch, and the
skill/docs/test assert this makes distinct branches produce **injective** (never-colliding)
filenames. That claim is false: 48 bits is well under the conventional collision-resistance
bar, and no truncated digest is mathematically injective. Two distinct branches can resolve
to the same backlog path, and the backlog merge (Step 6b) carries dispositions forward keyed
only on path + a provenance-trust check — it never verifies the existing backlog actually
*belongs to the current branch*, so a collision silently merges one branch's
`validation-fixer` dispositions into another branch's report. This spec widens the digest to
128 bits, corrects the overstated "injective" claims to "collision-resistant," and adds a
backlog **branch-owner verification gate** before the merge — mirroring the existing
`STATE-BRANCH-MISMATCH` gate that already protects `review-state.json` (ADR-0004).

## Goals

- Widen the `branch_slug` digest from 48 bits (12 hex) to at least **128 bits** (32 hex) so
  accidental/birthday collisions between distinct branches are astronomically improbable.
- Correct every claim that the slug is "injective" / that distinct branches "never resolve to
  the same file" / "never collide" to accurate language ("collision-resistant"; distinct
  branches "practically never" collide) across skill prose, references, the regression test,
  and ADR-0006 — a truncated digest is not mathematically injective.
- Add a **backlog branch-owner verification gate** to Step 6b's merge: before carrying any
  disposition forward from an existing backlog, confirm the backlog's recorded owning raw
  branch equals the current raw branch; on mismatch, refuse to merge or overwrite, preserve
  the existing file untouched, surface `BACKLOG-BRANCH-MISMATCH`, and require explicit user
  approval before importing — exactly as `review-state.json`'s `STATE-BRANCH-MISMATCH` does.
- Keep the final filename component under `NAME_MAX` (255 bytes) after widening the digest, by
  reducing the readable-prefix byte cap to preserve the original design margin.
- Mirror every change into the `.opencode/` port so the two ports stay at parity
  (opencode-port-parity invariant).

## Non-goals

- Changing the `review-state.json` load / provenance / branch-ownership logic — it is already
  correct and is the precedent this fix mirrors, not a target.
- Reworking the HTML output-path safety gate (sec-4) or the backlog **provenance** gate
  (tracked/branch-modified-since-`$mb`) — both stay as-is; the new owner gate composes *after*
  them, it does not replace them.
- Adding an owner-verification read to the **HTML** write path. The HTML is a fresh
  atomic-rename overwrite with no merge; its collision-clobber risk is reduced to
  astronomically-improbable by the 128-bit digest, and reading a branch identity back out of
  an existing rendered HTML is a materially larger surface. The finding scopes owner
  verification to "before **merging** an existing backlog" — i.e. the `.md` merge only.
- Reverting ADR-0008 or the sec-1..sec-5 fixes landed earlier this run (explicitly out of
  scope per the routing note).
- Any change to `validation-fixer` itself — it consumes the backlog unchanged.
- Retroactively re-pathing or migrating already-written backlogs from the old 12-hex path to
  the new 32-hex path (see backward-compat note in Project-context fit).

## Users and use cases

- **Reviewer (skill operator running `/pr-review-report`)**: re-reviews a branch and expects
  the sibling backlog's `validation-fixer` dispositions (`[x]` fixed / `[~]` attempted, commit
  SHAs, dates) to be carried forward — and expects a *different* branch that happens to hash
  to the same filename to **not** silently inherit or clobber those dispositions.
- **`validation-fixer` (downstream consumer)**: reads the backlog as its resumable source of
  truth; must never receive another branch's dispositions grafted onto this branch's findings.
- **Security auditor**: relies on the skill's stated guarantees; the "injective" claim must be
  accurate so the guarantee is not overtrusted.

## Functional requirements

1. **Digest width — 128 bits.** In Step 1's slug construction, the branch digest is derived by
   truncating `git hash-object --stdin` of the raw branch to **32 hex characters** (128 bits)
   instead of 12 (48 bits). The digest remains deterministic and stable per raw branch (same
   branch → same digest → same file; re-review still resolves in place).
2. **NAME_MAX budget preserved.** Reduce the readable-prefix byte cap (currently 200 bytes) so
   the final component `<raw_slug>-<digest>-<YYYY-MM-DD>.<ext>` stays under 255 bytes with a
   comparable slack margin to today's design. The fixed tail is now
   `-`(1) + digest(32) + `-`(1) + date(10) + `.html`(5) = 49 bytes; the cap must leave that
   plus margin (recorded default: **180 bytes**, giving `180 + 49 = 229`, ~26 bytes slack —
   matching the original margin). Update the inline budget comment math to match.
3. **Corrected claims.** Every assertion that the slug is "injective," that distinct branches
   "never resolve to the same file," or "never collide" is reworded to accurate,
   collision-resistant language. This covers: `SKILL.md` Step 1 comment block, the
   `findings-md-schema.md` opening paragraph, the `branch-slug.test.sh` header/comments and its
   `PASS` string, and ADR-0006's context paragraph. The corrected language must still convey
   that the disambiguation exists and is strong (128-bit collision resistance), just not
   mathematically injective.
4. **Backlog owner marker (producer side).** When Step 6b writes the backlog, it records the
   owning **raw branch** in a machine-readable, `validation-fixer`-invisible form so a later
   merge can verify ownership. Recorded default mechanism: a dedicated HTML-comment marker on
   its own header line (e.g. `<!-- backlog-branch: <raw-branch> -->`), mirroring the existing
   `<!-- backlog-schema: v1 -->` schema marker (invisible in rendered Markdown; not a `##`
   section, `- ` item, or `_italic_` status line, so `validation-fixer` ignores it). The
   producer must ensure the raw branch is encoded so it cannot prematurely terminate the HTML
   comment (escape/encode any embedded `-->`); exact encoding is an architect design detail.
5. **Backlog owner verification gate (merge side).** In Step 6b's merge algorithm, **after**
   the symlink/output-path gate and the provenance gate, and **before** carrying any
   disposition forward:
   - Read the existing backlog's owning raw branch from the owner marker (requirement 4), with
     a fallback to parsing the title-line `<branch>` for a legacy backlog that predates the
     marker. If neither yields a branch (legacy/first-write), treat the file as owned by the
     current branch (proceed normally) — mirroring `review-state.json`'s "absent `branch`
     counts as the current branch."
   - If the recorded owner **does not equal** the current raw branch (`BACKLOG-BRANCH-MISMATCH`):
     do **not** carry its dispositions, do **not** overwrite the file, **preserve the existing
     file untouched**, surface the mismatch (naming the branch it belongs to), and **require
     explicit user approval** before importing or replacing it. Only on explicit approval may
     the run reattach/replace. This differs from the provenance-untrusted path (which
     regenerates fresh at the path): a mismatch means a *legitimate other branch's* data sits
     at a collided path, so overwriting it would destroy that branch's dispositions.
6. **Gate ordering documented.** The composed order is: symlink/output-path safety (sec-4) →
   backlog provenance (branch-added/modified since `$mb`) → **backlog branch-owner (new)** →
   merge algorithm (fingerprint keying, conflict rule, prior-only retention). This mirrors
   `review-state.json`'s documented order (provenance/sec-2 before branch-ownership/ADR-0004).
7. **Regression test updated & green.** `plugins/.../__tests__/branch-slug.test.sh` is updated
   to the 32-hex digest and 180-byte cap, its NAME_MAX assertion still passes with the wider
   digest, and its wording no longer claims mathematical injectivity. The test remains the
   fixture `scripts/validate-pr-review-skill.sh` runs, and that validator must still pass.
8. **Port parity.** All of the above land identically in the `.opencode/` port
   (`SKILL.md` + `references/findings-md-schema.md`), preserving that port's intentional host
   divergences. The port has no `__tests__/` directory, so no port test change is required.

## Non-functional requirements

- **Performance**: — (doc/template change; the merge already performs one read).
- **Security / auth**: This is the security fix itself. The owner marker/title-line is trusted
  as an ownership signal **only after** the provenance gate confirms the file is
  reviewer-local; a branch-authored backlog is already rejected upstream and its marker never
  reaches the owner check. Data-never-instructions still governs every field.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: — (no new user data; the raw branch is already recorded in the
  backlog title heading today).
- **Monetization tier**: —

## Project-context fit

- **Layers touched.** `pr-review-report` skill only, both ports, plus its regression test and
  ADR docs. Pure markdown/template/shell-fixture authoring — no application runtime code
  (aligns with the repo's "documentation-and-template authoring" nature). The one shell fixture
  (`branch-slug.test.sh`) is the exception the repo already tolerates for this skill.
- **Invariants honored.**
  - **opencode-port-parity (load-bearing):** every `SKILL.md`/reference change is mirrored in
    `.opencode/skills/pr-review-report/`, preserving intentional host divergences. This skill
    *has* a port, so mirroring is mandatory (not the "no port" exemption).
  - **Two trust anchors:** unchanged. The new owner check reads an owner signal from the
    working-tree backlog only after the provenance gate clears it; policy still loads from
    `$mb`. No anchors crossed.
  - **Data, never instructions:** the owner marker is a mechanical ownership field, surfaced
    and compared, never obeyed.
  - **Backward compatibility (mandatory):** the owner marker is optional/nullable — a legacy
    backlog with no marker falls back to the title line, and if neither is present it is
    treated as owned by the current branch, so legacy backlogs parse and merge unchanged with
    no forced migration.
  - **Mirror machinery:** the new gate deliberately reuses the shape, phrasing, and ordering of
    the existing `STATE-BRANCH-MISMATCH` / ADR-0004 machinery.
- **Backward-compat note the architect must weigh (recorded default, flagged).** Widening the
  digest changes the filename of every branch's backlog. A backlog written earlier with the
  12-hex digest sits at a *different* path than the new 32-hex path, so a post-change run will
  not auto-find/merge it — the old file's in-flight dispositions are orphaned in place (not
  deleted; the file still renders and `validation-fixer` still reads it if pointed at it).
  **Default resolution: accept the one-time re-path; do NOT add legacy-path fallback probing.**
  Rationale: the collision window motivating the change is tiny, legacy-path probing
  permanently complicates the path logic and adds a second gated merge-read, and the old file
  remains on disk for manual re-pointing. This satisfies the letter of the backward-compat
  invariant (the legacy artifact renders/executes unchanged at its old name; nothing forces
  migration). The architect may override toward a one-release legacy probe if desired — this is
  a reversible scoping choice, recorded here for audit.
- **Related decisions.** Extends ADR-0004 (review-state branch ownership) and ADR-0006
  (findings-backlog ownership & regeneration). ADR-0006's claim that the slug is "injective …
  so two distinct branches never collide" is the specific stale statement to correct.

## Affected surface

- **Backend**: — (no application backend).
- **Frontend / mobile**: — .
- **Admin**: — .
- **Shared / skill sources**:
  - `plugins/my-skills/skills/pr-review-report/SKILL.md` — Step 1 slug (digest width, readable
    cap, corrected "injective" comments) and Step 6b (owner marker write + owner gate summary).
  - `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md` — corrected
    opening claim; owner marker in header block/File layout; owner gate + gate ordering in
    §Regeneration & merge and §Provenance & trust; read-only-future-guard note unchanged.
  - `plugins/my-skills/skills/pr-review-report/__tests__/branch-slug.test.sh` — 32-hex digest,
    180-byte cap, NAME_MAX assertion, de-overstated wording; stays green under the validator.
  - `.opencode/skills/pr-review-report/SKILL.md` — mirror of the plugin `SKILL.md` changes.
  - `.opencode/skills/pr-review-report/references/findings-md-schema.md` — mirror of the plugin
    reference changes.
  - `docs/adr/0006-findings-backlog-ownership.md` — correct the "injective / never collide"
    context line to collision-resistant language.
  - **New ADR (recommended, non-blocking):** `docs/adr/0009-backlog-slug-digest-and-branch-owner.md`
    — record the 128-bit digest width choice and the backlog branch-owner gate, referencing
    ADR-0004 and ADR-0006. Architect's call whether to author it or fold a note into ADR-0006.
  - `scripts/validate-pr-review-skill.sh` — no logic change required (it runs the fixture); an
    optional wording touch to its "injectivity" echo message is at the architect's discretion.

## Open questions

- (none — all resolved by stated defaults below; no reserved decision, no invariant conflict.)

## Decisions resolved by Brainstormer default

- Digest width → **32 hex chars (128 bits)**, truncated from `git hash-object` → 128 bits is
  the conventional collision-resistance bar (birthday bound ~2^64), astronomically beyond any
  repo's branch count, and SHA-1's 160-bit output supplies it without a new dependency; not
  full 40-hex, to keep filenames shorter and preserve NAME_MAX headroom.
- Readable-prefix byte cap → **reduce 200 → 180 bytes** → keeps `180 + 49 = 229 < 255` with the
  same ~26-byte slack the original 200/12-hex design had.
- Owner-identity mechanism → **dedicated `<!-- backlog-branch: <raw> -->` HTML-comment marker**
  (mirroring the schema marker), with **title-line `<branch>` fallback** for legacy backlogs
  and "absent → treat as current branch" for first-write → more robust than scraping the title
  and reuses an established, `validation-fixer`-invisible pattern; exact `-->`-escaping left to
  the architect.
- On `BACKLOG-BRANCH-MISMATCH` → **preserve the file untouched, do not overwrite/merge, surface,
  require approval** (not "regenerate fresh") → a mismatch is a legitimate other branch's data
  at a collided path; overwriting would destroy it. Mirrors `STATE-BRANCH-MISMATCH` exactly.
- Owner verification scope → **`.md` backlog merge only, not the HTML write** → the finding
  scopes it to "before merging," and the 128-bit digest reduces HTML collision-clobber to
  astronomically-improbable; HTML owner verification is a larger, separate surface.
- Legacy 12-hex backlogs → **accept one-time re-path, no legacy-path probing** → see the
  backward-compat note in Project-context fit; reversible scoping choice flagged for the
  architect.
- ADR → **recommend a new ADR-0009 (non-blocking)** and correct ADR-0006's stale claim →
  ADR-0006 is Accepted/immutable in spirit; a new ADR referencing 0004/0006 is cleaner than
  editing an accepted decision, but authoring is the architect's discretion.

## References

- Finding sec-6 — `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`
  §Security (fingerprint `security|plugins/my-skills/skills/pr-review-report/SKILL.md|a-48bit-digest-does-not-make-artifact-paths-injective`).
- `plugins/my-skills/skills/pr-review-report/SKILL.md` Step 1 (slug, lines ~44-74) and Step 6b
  (backlog emit + merge).
- `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md`
  §Regeneration & merge, §Provenance & trust, header block / File layout.
- `plugins/my-skills/skills/pr-review-report/__tests__/branch-slug.test.sh` (bug-8 fixture) and
  `scripts/validate-pr-review-skill.sh` §8b.
- `docs/adr/0004-review-state-branch-ownership.md` — the `STATE-BRANCH-MISMATCH` precedent this
  gate mirrors.
- `docs/adr/0006-findings-backlog-ownership.md` — backlog ownership/regeneration; carries the
  stale "injective" claim to correct.
- `.orchestrator/PROJECT-CONTEXT.md` §Invariants (opencode-port-parity, two trust anchors,
  data-never-instructions, backward compatibility).
