# Re-validation — explain-codebase skill (delivered tree)

**Plan**: FEAT-20260723T141806Z-d784-explain-codebase-skill
**Validated commit**: `3c6ffaf` (branch `orch/2026-07-23-explain-codebase-skill`)
**Date**: 2026-07-24
**Supersedes for the delivered tree**: CR-20260723T144300Z-c7e2 (14:43) and
QA-20260723T144808Z-9096 (14:49)

## Why this exists (bug-2)

The original REVIEWER `APPROVED` and QA `READY_TO_COMMIT` were produced **before** the
template swap (15:06), the standalone-Mermaid runtime (15:44), and **two** subsequent
`pr-review-report` hardening rounds routed through `/validation-fixer` (main-agent):

- **Round 1** — 13 findings (arch-1..3, sec-1..4, bug-1..6): provenance taxonomy, qualified
  identities, bounded fan-out, scope containment, symlink-safe write, Mermaid sanitization +
  CSP, secret redaction, index freshness, faithful validator, file/metric source data, CSP
  wording, re-validation, demo runtime de-duplication.
- **Round 2** — 17 findings (arch-1..6, sec-1..4, bug-1..7): source-snapshot pinning,
  partial-analysis disclosure, canonical identity catalog, per-unit budgets, artifact
  hygiene, vendor manifest, exclusive-temp write (regression fix), complete secret scanner,
  allowlist-bound anchors, symlink-safe demo builder, semantic-scope resolution, this
  re-validation, installed-skill command anchoring, cross-module highlighting, demo-builder
  scoping, schema-conformant demo, domain-grouped rules.

So the earlier approval trail (which described "13 tests, three test files, the pre-runtime
implementation") does not cover what is being merged. This artifact re-validates the
**delivered** tree; the earlier CR/QA remain as historical records of their snapshots.

## Evidence at `3c6ffaf`

- **Automated tests — 43 cjs tests across 5 files, all pass; plus the shell gate:**
  - `__tests__/analysis-schema.test.cjs` — schema shape, required fields, enums, canonical
    ids, allowlist-bound anchors.
  - `__tests__/placeholder-fill.test.cjs` — fill contract (13 scalars, 11 REPEAT blocks),
    region parity, demo expansion, cross-module highlighting, demo conformance, domain grouping.
  - `__tests__/mermaid-safety.test.cjs` — label sanitizer + network-denying CSP.
  - `__tests__/secret-scan.test.cjs` — adversarial fixtures per credential class.
  - `__tests__/vendor-manifest.test.cjs` — vendored runtime sha256 + byte-size integrity.
  - `__tests__/self-contained.test.sh` — no external loads, CSP present, marker/fill-state,
    lean-demo (no inlined runtime). PASS.
- **Hosted index** — `node scripts/generate-opencode-skill-index.mjs --check` up to date.
- **Region parity** — 7 region ids in both template and demo.
- **Security posture covered by the trail** — scope resolution + canonical containment
  (bug-1, sec-1 round1), source-snapshot pinning + drift (arch-1 round2), allowlist-bound
  provenance (sec-3 round2), Mermaid label sanitization + `default-src 'none'` CSP (sec-3
  round1), deterministic secret scanner (sec-2 round2), symlink-safe atomic writes for the
  report (sec-1 round2) and the demo builder (sec-4 round2), vendored-runtime checksum gate
  (arch-6 round2).

## Verdict

`RE_VALIDATED` — the delivered tree at `3c6ffaf` passes every automated gate and the two
rounds of adversarial review findings are each closed with a per-finding fix commit
(provenance in `docs/reviews/orch-…-explain-codebase-skill-…md`). This artifact is the
current evidence of record for the merge.
