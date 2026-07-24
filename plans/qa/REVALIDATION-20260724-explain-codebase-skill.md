# Re-validation — explain-codebase skill (delivered tree)

**Plan**: FEAT-20260723T141806Z-d784-explain-codebase-skill
**Validated commit**: `3ccf886` (branch `orch/2026-07-23-explain-codebase-skill`)
**Date**: 2026-07-24
**Supersedes for the delivered tree**: CR-20260723T144300Z-c7e2 (14:43), QA-20260723T144808Z-9096
(14:49), **and the terminal pipeline artifacts** TEST-20260723T144019Z-0432,
EVAL-20260723T145254Z-7db2, FINAL-20260723T145750Z-c2cb — all of which describe the initial
three-test package and the pre-runtime implementation, not the delivered tree.

> **Refreshed (bug-2, round 6).** Re-pinned to `3ccf886` (**75 cjs tests across 8 files** +
> the shell gate). Corrects an earlier miscount (the fill contract has **10** REPEAT blocks,
> not 11) and now supersedes the stale TEST/EVAL/FINAL terminal artifacts (which still described
> the initial 3-test package) in addition to CR/QA. Round-6 hardening since `f302e70`: an
> **immutable no-follow source snapshot** (ABA/TOCTOU), **module-ownership** binding in the
> identity catalog, a **single executable render boundary** imported by tests, one **canonical
> inventory** feeding snapshot+validator, a **TOCTOU-safe no-follow report writer**,
> Authorization/Proxy-Authorization detection, entity-decoding before secret classification,
> empty-file self-anchors, a non-dotfile whole-system slug, self-consistent demo counts, and
> generated review HTML moved out of the reviewed diff.

> **Refreshed (bug-4, round 5).** An earlier version of this artifact validated `3c6ffaf`,
> but four rounds of `/validation-fixer` hardening landed after it (through `f302e70`): the
> temp-file, snapshot-manifest, validator, and path-parsing fixes, then working-tree-hash
> snapshotting, in-validator identity-catalog enforcement, literal pathspecs, a
> non-material-logging + broader secret scanner, the **Mermaid 10.9.1 → 10.9.6** security
> upgrade, file-scope containment, an injective scope slug, cross-file anchor rejection,
> prototype-safe rule grouping, scratch-dir cleanup, and QA-artifact hygiene. This evidence is
> re-pinned to the current delivered tree `f302e70`.

## Why this exists (bug-2)

The original REVIEWER `APPROVED` and QA `READY_TO_COMMIT` were produced **before** the
template swap (15:06), the standalone-Mermaid runtime (15:44), and **five** subsequent
`pr-review-report` hardening rounds routed through `/validation-fixer` (main-agent):

- **Round 1** — 13 findings: provenance taxonomy, qualified identities, bounded fan-out, scope
  containment, symlink-safe write, Mermaid sanitization + CSP, secret redaction, index
  freshness, faithful validator, file/metric source data, CSP wording, demo runtime dedup.
- **Round 2** — 17 findings: source-snapshot pinning, partial-analysis disclosure, canonical
  identity catalog, per-unit budgets, artifact hygiene, vendor manifest, exclusive-temp write,
  broadened secret scanner, allowlist-bound anchors, symlink-safe demo builder, semantic-scope
  resolution, installed-skill command anchoring, cross-module highlighting, demo-builder
  scoping, schema-conformant demo, domain-grouped rules.
- **Round 3** — 4 findings: portable/random report temp file, defined `$snap_manifest`, dead
  validator code removed, tab/NUL-safe `ls-files` parsing.
- **Round 4** — 13 findings: **working-tree-hash** snapshot (not index blob ids),
  in-validator **identity-catalog** enforcement, **literal pathspecs**, secret scanner
  no-material-logging + more token families, **Mermaid 10.9.1 → 10.9.6**, file-scope
  containment, injective scope slug, cross-file anchor rejection, prototype-safe rule grouping,
  scratch-dir cleanup, QA-artifact hygiene, and this refreshed re-validation.
- **Round 5** — 12 findings: immutable no-follow source snapshot (ABA/TOCTOU), module-ownership
  in the identity catalog, single executable render boundary imported by tests, one canonical
  inventory feeding snapshot+validator, TOCTOU-safe no-follow report writer, Authorization/
  Proxy-Authorization detection, entity-decoding before secret classification, empty-file
  self-anchors, non-dotfile whole-system slug, self-consistent demo counts, generated review
  HTML out of the reviewed diff, and this corrected terminal evidence.

So the earlier approval trail (which described "13 tests, three test files, the pre-runtime
implementation") does not cover what is being merged. This artifact re-validates the
**delivered** tree; the earlier CR/QA remain as historical records of their snapshots.

## Evidence at `3ccf886`

- **Automated tests — 75 cjs tests across 8 files, all pass; plus the shell gate:**
  - `__tests__/analysis-schema.test.cjs` — schema shape, required fields, enums, canonical
    ids, allowlist-bound anchors, **identity-catalog enforcement** (arch-2 r5), **cross-file
    anchor rejection** (bug-3 r5).
  - `__tests__/placeholder-fill.test.cjs` — fill contract (13 scalars, 10 REPEAT blocks),
    region parity, demo expansion, cross-module highlighting, demo conformance, domain
    grouping, **prototype-key-safe grouping** (bug-5 r5).
  - `__tests__/mermaid-safety.test.cjs` — label sanitizer + network-denying CSP.
  - `__tests__/secret-scan.test.cjs` — adversarial fixtures per credential class, **new token
    families + length-independent + no-material-logged** (sec-2/sec-3 r5).
  - `__tests__/vendor-manifest.test.cjs` — vendored runtime sha256 + byte-size integrity
    (**Mermaid 10.9.6**).
  - `__tests__/self-contained.test.sh` — no external loads, CSP present, marker/fill-state,
    lean-demo (no inlined runtime). PASS.
- **Hosted index** — `node scripts/generate-opencode-skill-index.mjs --check` up to date.
- **Region parity** — 7 region ids in both template and demo.
- **Security posture covered by the trail (5 rounds)** — scope resolution + canonical
  containment, source-snapshot pinning by **working-tree hash** with drift check (arch-1 r5),
  **literal pathspecs** (sec-1 r5), allowlist- + **catalog**-bound provenance (sec-3 r2 /
  arch-2 r5), Mermaid label sanitization + `default-src 'none'` CSP, **runtime upgraded to
  10.9.6** (sec-4 r5), a **non-material-logging, broad** secret scanner (sec-2/sec-3 r5),
  symlink-safe **and portable/random-temp** atomic writes (sec-1 r4) for the report and the
  demo builder, and the vendored-runtime checksum gate.

## Verdict

`RE_VALIDATED` — the delivered tree at `3ccf886` passes every automated gate (75 cjs tests +
`self-contained.test.sh` PASS, index fresh, 7↔7 region parity) and **all five** rounds of
adversarial review findings (13 + 17 + 4 + 13 + 12 = 59) are each closed with a per-finding fix
commit (provenance in `docs/reviews/orch-…-explain-codebase-skill-…{md,html}`). This artifact
is the current evidence of record for the merge.
