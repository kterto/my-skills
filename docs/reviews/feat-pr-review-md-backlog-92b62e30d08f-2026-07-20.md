<!-- backlog-schema: v1 -->
# PR Review Findings - feat/pr-review-md-backlog  (base main@b1b8b9d, 2026-07-20)

/validation-fixer docs/reviews/feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.md  -  framework: orchestrator

Counts: crit 0 - high 2 - med 2 - low 0 - info 0 - acknowledged 1

## Architecture

- [x] [arch-1|high] Preserve the commit-pr-dev public interface (plugins/my-skills/skills/commit-pr/SKILL.md:2)
  fingerprint: architecture|plugins/my-skills/skills/commit-pr/SKILL.md|preserve-the-commitprdev-public-interface
  _acknowledged: reviewer-marked intentional decision_
- [x] [arch-2|high] Re-review overwrites the consumer-owned backlog (plugins/my-skills/skills/pr-review-report/SKILL.md:436)
  fingerprint: architecture|plugins/my-skills/skills/pr-review-report/SKILL.md|rereview-overwrites-the-consumerowned-backlog
  _orphan: concern no longer reproduced in the current diff_
- [x] [arch-4|high] Validation-fixer takes commit ownership against trusted policy (plugins/my-skills/skills/validation-fixer/SKILL.md:153)
  fingerprint: architecture|plugins/my-skills/skills/validation-fixer/SKILL.md|validationfixer-takes-commit-ownership-against-trusted-policy
  _orphan: concern no longer reproduced in the current diff_
- [x] [arch-3|med] Step 6b contradicts its authoritative schema (plugins/my-skills/skills/pr-review-report/SKILL.md:417)
  fingerprint: architecture|plugins/my-skills/skills/pr-review-report/SKILL.md|step-6b-contradicts-its-authoritative-schema
  _orphan: concern no longer reproduced in the current diff_
- [x] [arch-5|med] Committed review state defeats its provenance model (.pr-review/review-state.json:1)
  fingerprint: architecture|.pr-review/review-state.json|committed-review-state-defeats-its-provenance-model
  _orphan: concern no longer reproduced in the current diff_
- [x] [arch-6|low] ADR-0006 misrecords the implemented consumer changes (docs/adr/0006-findings-backlog-ownership.md:5)
  fingerprint: architecture|docs/adr/0006-findings-backlog-ownership.md|adr0006-misrecords-the-implemented-consumer-changes
  _orphan: concern no longer reproduced in the current diff_
- [x] [arch-7|low] Parity validation omits the new normative schema (scripts/validate-pr-review-skill.sh:42)
  fingerprint: architecture|scripts/validate-pr-review-skill.sh|parity-validation-omits-the-new-normative-schema
  _orphan: concern no longer reproduced in the current diff_

## Security

- [x] [sec-1|high] Predictable backlog path permits symlink overwrite (plugins/my-skills/skills/pr-review-report/SKILL.md:363)
  fingerprint: security|plugins/my-skills/skills/pr-review-report/SKILL.md|predictable-backlog-path-permits-symlink-overwrite
  _orphan: concern no longer reproduced in the current diff_
- [x] [sec-2|high] Backlog data crosses unchanged into an autonomous-agent prompt (plugins/my-skills/skills/pr-review-report/SKILL.md:382)
  fingerprint: security|plugins/my-skills/skills/pr-review-report/SKILL.md|backlog-data-crosses-unchanged-into-an-autonomousagent-prompt
  _orphan: concern no longer reproduced in the current diff_
- [x] [sec-3|high] Untrusted item summary can become shell code (plugins/my-skills/skills/validation-fixer/SKILL.md:160)
  fingerprint: security|plugins/my-skills/skills/validation-fixer/SKILL.md|untrusted-item-summary-can-become-shell-code
  _orphan: concern no longer reproduced in the current diff_
- [x] [sec-4|med] Tracked backlog can veto or forge regeneration (plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md:240)
  fingerprint: security|plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md|tracked-backlog-can-veto-or-forge-regeneration
  _orphan: concern no longer reproduced in the current diff_

## Bugs & Improvements

- [ ] [bug-11|high] Rollback erases progress in tracked validation files (plugins/my-skills/skills/validation-fixer/SKILL.md:146)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|rollback-erases-progress-in-tracked-validation-files
  Rationale: The workflow accepts any Markdown file, and the backlog is explicitly shareable/committable, but safety is justified only by assuming it is untracked. If a tracked validation file contains completed item A, a later item B failure runs reset --hard to B's BEFORE_SHA and discards A's uncommitted [x]/SHA bookkeeping.
  Fix: Either reject tracked validation files up front or replace hard-reset rollback with cleanup that restores code paths while explicitly preserving every validation file; add a two-item tracked-file regression scenario.
- [ ] [bug-12|high] Any framework commit marks a blocked item fixed (plugins/my-skills/skills/validation-fixer/SKILL.md:184)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|any-framework-commit-marks-a-blocked-item-fixed
  Rationale: The first reconciliation branch treats any HEAD advance as a real completed fix without checking the framework result. A framework can commit partial work and then return BLOCKED, yet validation-fixer records the finding [x] and leaves the partial commits in place.
  Fix: Require both HEAD advancement and an explicit successful terminal result before marking fixed; when a run blocks after committing, keep the item [~] and follow a deliberate rollback/review path for BEFORE_SHA..AFTER_SHA.
- [ ] [bug-13|med] Long branch names still break artifact writes (plugins/my-skills/skills/pr-review-report/SKILL.md:63)
  fingerprint: bugs|plugins/my-skills/skills/pr-review-report/SKILL.md|long-branch-names-still-break-artifact-writes
  Rationale: Git permits refs with multiple near-NAME_MAX path components, but the slug flattens the complete branch and then appends a digest. A valid long branch can therefore produce a single filename over 255 bytes, causing both report writes to fail.
  Fix: Bound the readable slug prefix by bytes before appending the digest, leaving enough room for the digest, date, extension, and separator; add a valid multi-component long-ref test.
- [ ] [bug-14|med] Committed report still points at moving HEAD (docs/reviews/feat-pr-review-interactions-cycles-2026-07-18.html:754)
  fingerprint: bugs|docs/reviews/feat-pr-review-interactions-cycles-2026-07-18.html|committed-report-still-points-at-moving-head
  Rationale: This branch adds a historical report whose embedded metadata says 1ce9af0..HEAD and has no reviewedHead. Opening it after later commits therefore presents a moving range that no longer identifies the snapshot actually reviewed, despite this branch adding immutable report metadata for exactly that defect.
  Fix: Regenerate the artifact with reviewedHead and a pinned merge-base..reviewed-head range, or remove the obsolete generated report from this branch.
- [x] [bug-1|high] Orchestrator fixes cannot satisfy the commit gate (plugins/my-skills/skills/pr-review-report/SKILL.md:358)
  fingerprint: bugs|plugins/my-skills/skills/pr-review-report/SKILL.md|orchestrator-fixes-cannot-satisfy-the-commit-gate
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-2|high] Slash-containing branches break the backlog path (plugins/my-skills/skills/pr-review-report/SKILL.md:364)
  fingerprint: bugs|plugins/my-skills/skills/pr-review-report/SKILL.md|slashcontaining-branches-break-the-backlog-path
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-6|high] Clean-tree gate prevents backlog processing (plugins/my-skills/skills/validation-fixer/SKILL.md:110)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|cleantree-gate-prevents-backlog-processing
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-7|high] Protected-branch guard runs after commit-capable frameworks (plugins/my-skills/skills/validation-fixer/SKILL.md:161)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|protectedbranch-guard-runs-after-commitcapable-frameworks
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-3|med] Hosted index omits the required schema (plugins/my-skills/skills/index.json:80)
  fingerprint: bugs|plugins/my-skills/skills/index.json|hosted-index-omits-the-required-schema
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-8|med] Branch slug aliases distinct branches (plugins/my-skills/skills/pr-review-report/SKILL.md:51)
  fingerprint: bugs|plugins/my-skills/skills/pr-review-report/SKILL.md|branch-slug-aliases-distinct-branches
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-9|med] Committed report publishes obsolete review state (docs/reviews/feat-pr-review-md-backlog-2026-07-19.html:907)
  fingerprint: bugs|docs/reviews/feat-pr-review-md-backlog-2026-07-19.html|committed-report-publishes-obsolete-review-state
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-10|low] README still documents an HTML-only report (README.md:183)
  fingerprint: bugs|README.md|readme-still-documents-an-htmlonly-report
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-4|low] Format test does not require rationale and fix (plugins/my-skills/skills/pr-review-report/__tests__/findings-md-format.test.cjs:100)
  fingerprint: bugs|plugins/my-skills/skills/pr-review-report/__tests__/findings-md-format.test.cjs|format-test-does-not-require-rationale-and-fix
  _orphan: concern no longer reproduced in the current diff_
- [x] [bug-5|low] Verification artifacts report an obsolete test result (plans/qa/QA-20260720T010641Z-d307-pr-review-md-findings-backlog.md:25)
  fingerprint: bugs|plans/qa/QA-20260720T010641Z-d307-pr-review-md-findings-backlog.md|verification-artifacts-report-an-obsolete-test-result
  _orphan: concern no longer reproduced in the current diff_
