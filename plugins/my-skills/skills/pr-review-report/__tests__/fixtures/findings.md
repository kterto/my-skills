# PR Review Findings — feat/pr-review-md-findings-backlog  (base main@a1b2c3d, 2026-07-20)

/validation-fixer docs/reviews/feat-pr-review-md-findings-backlog-2026-07-20.md  ·  framework: orchestrator

Counts: crit 1 · high 2 · med 2 · low 1 · info 0 · acknowledged 1

## Architecture

- [ ] [arch-1|high] New emitter reaches across the report module boundary (skills/report/emit.ts:42)
  fingerprint: architecture|skills/report/emit.ts|new-emitter-crosses-boundary
  Rationale: The backlog writer imports the HTML renderer's private helpers, coupling two artifacts that should stay independent.
  Fix: Route both outputs through the shared REVIEW_DATA.findings set instead of importing renderer internals.
  ADR: Emit Markdown and HTML from one findings projection
- [ ] [arch-2|med] Section ordering is duplicated in two places (skills/report/order.ts:18)
  fingerprint: architecture|skills/report/order.ts|section-order-duplicated
  Rationale: Lens order is hard-coded in the HTML template and again in the Markdown writer, so they can drift.
  Fix: Derive lens order from a single constant consumed by both writers.
- [x] [arch-3|info] Prefer a value object for the counts summary (skills/report/counts.ts:7)
  _acknowledged: MEM-1_

## Security

- [ ] [sec-1|crit] Unescaped thread text reaches the orchestrator brief (skills/report/backlog.ts:88)
  fingerprint: security|skills/report/backlog.ts|thread-text-unescaped
  Rationale: Raw review-state thread[] text embedded in the backlog could smuggle an imperative into the fixer handoff.
  Fix: Embed only skill-authored fields; never write raw thread[] text into the .md.
- [ ] [sec-2|high] Reason note interpolates free user text (skills/report/backlog.ts:104)
  fingerprint: security|skills/report/backlog.ts|reason-note-free-text
  Rationale: The triaged reason label copies arbitrary comment text instead of a trusted memory-ref label.
  Fix: Limit the reason to a merge-base-trusted memory-ref label such as MEM-2.
- [x] [sec-3|med] Legacy path traversal in a removed helper (skills/report/gone.ts:12)
  _orphan: code left the diff_

## Bugs & Improvements

- [ ] [bug-1|med] Off-by-one when the diff has zero hunks (skills/report/diff.ts:56)
  fingerprint: bugs|skills/report/diff.ts|offbyone-zero-hunks
  Rationale: An empty diff yields a negative slice index and drops the final finding.
  Fix: Guard the slice against an empty hunk list before indexing.
- [ ] [bug-2|low] Redundant re-read of the template file (skills/report/render.ts:31)
  fingerprint: bugs|skills/report/render.ts|redundant-template-read
  Rationale: The template is read once per finding instead of once per run.
  Fix: Hoist the template read out of the finding loop.
- [x] [bug-3|low] Trailing-whitespace nit in the counts line (skills/report/counts.ts:22)
  _resolved: fix verified_
