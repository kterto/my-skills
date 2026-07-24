# Re-validation — explain-codebase skill (delivered tree)

**Plan**: FEAT-20260723T141806Z-d784-explain-codebase-skill
**Validated commit**: `f302e70` (branch `orch/2026-07-23-explain-codebase-skill`)
**Date**: 2026-07-24
**Supersedes for the delivered tree**: CR-20260723T144300Z-c7e2 (14:43) and
QA-20260723T144808Z-9096 (14:49)

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
template swap (15:06), the standalone-Mermaid runtime (15:44), and **four** subsequent
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

So the earlier approval trail (which described "13 tests, three test files, the pre-runtime
implementation") does not cover what is being merged. This artifact re-validates the
**delivered** tree; the earlier CR/QA remain as historical records of their snapshots.

## Evidence at `f302e70`

- **Automated tests — 54 cjs tests across 5 files, all pass; plus the shell gate:**
  - `__tests__/analysis-schema.test.cjs` — schema shape, required fields, enums, canonical
    ids, allowlist-bound anchors, **identity-catalog enforcement** (arch-2 r5), **cross-file
    anchor rejection** (bug-3 r5).
  - `__tests__/placeholder-fill.test.cjs` — fill contract (13 scalars, 11 REPEAT blocks),
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
- **Security posture covered by the trail (4 rounds)** — scope resolution + canonical
  containment, source-snapshot pinning by **working-tree hash** with drift check (arch-1 r5),
  **literal pathspecs** (sec-1 r5), allowlist- + **catalog**-bound provenance (sec-3 r2 /
  arch-2 r5), Mermaid label sanitization + `default-src 'none'` CSP, **runtime upgraded to
  10.9.6** (sec-4 r5), a **non-material-logging, broad** secret scanner (sec-2/sec-3 r5),
  symlink-safe **and portable/random-temp** atomic writes (sec-1 r4) for the report and the
  demo builder, and the vendored-runtime checksum gate.

## Verdict

`RE_VALIDATED` — the delivered tree at `f302e70` passes every automated gate (54 cjs tests +
`self-contained.test.sh` PASS, index fresh, 7↔7 region parity) and **all four** rounds of
adversarial review findings (13 + 17 + 4 + 13 = 47) are each closed with a per-finding fix
commit (provenance in `docs/reviews/orch-…-explain-codebase-skill-…{md,html}`). This artifact
is the current evidence of record for the merge.
