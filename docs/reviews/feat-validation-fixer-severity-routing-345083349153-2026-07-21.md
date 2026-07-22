<!-- backlog-schema: v1 -->
# PR Review Findings — feat/validation-fixer-severity-routing  (base main@b1b8b9d, 2026-07-21)

/validation-fixer docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md  ·  framework: orchestrator

Counts: crit 0 · high 5 · med 7 · low 1 · info 0 · acknowledged 0

## Architecture

- [x] [arch-1|high] Batch commits violate the approved per-item transaction boundary (plugins/my-skills/skills/validation-fixer/SKILL.md:451)
  fingerprint: architecture|plugins/my-skills/skills/validation-fixer/SKILL.md|batch-commits-violate-the-approved-peritem-transaction-boundary
  Rationale: ADR-0007 authorizes validation-fixer to commit only the single item currently being reconciled and explicitly rejects batch commits, but the new batch lane combines multiple findings into one commit and rollback unit.
  Fix: Keep one commit per finding, or supersede ADR-0007 and redefine authorization, provenance, rollback, and resumability around an explicitly approved multi-item work unit.
  ADR: ADR-0008: Work-unit commit ownership and batch atomicity
  _fixed via orchestrator · ef25a2f · 2026-07-21_

## Security

- [x] [sec-1|high] Framework-owned commits bypass transaction validation (plugins/my-skills/skills/validation-fixer/SKILL.md:324)
  fingerprint: security|plugins/my-skills/skills/validation-fixer/SKILL.md|frameworkowned-commits-bypass-transaction-validation
  Rationale: Any successful HEAD advance is accepted without proving the branch stayed unchanged, BEFORE_SHA remains an ancestor, committed paths exclude validation files, or the remaining tree is clean. A commit-capable framework can therefore switch branches, include unrelated files, or leave uncommitted fix work while the item is marked fixed.
  Fix: Accept framework commits only after verifying the original branch, linear ancestry, expected committed paths, and a clean non-validation tree; reject and safely isolate any run that violates those invariants.
  _fixed via orchestrator · 0f2e01a · 2026-07-21_

- [x] [sec-2|high] Autonomous rollback can erase concurrent work (plugins/my-skills/skills/validation-fixer/SKILL.md:268)
  fingerprint: security|plugins/my-skills/skills/validation-fixer/SKILL.md|autonomous-rollback-can-erase-concurrent-work
  Rationale: The skill snapshots a clean shared worktree before a potentially long framework run, then uses reset --hard and git clean on failure. User or parallel-agent edits created after the snapshot are indistinguishable from framework output and can be deleted without confirmation.
  Fix: Run each work unit in an isolated disposable worktree or clone and discard that environment on failure instead of resetting and cleaning the shared user worktree.
  _fixed via orchestrator · 4cedb0c · 2026-07-21_

- [x] [sec-3|high] The default protected set misses the repository default branch (plugins/my-skills/skills/validation-fixer/SKILL.md:127)
  fingerprint: security|plugins/my-skills/skills/validation-fixer/SKILL.md|the-default-protected-set-misses-the-repository-default-branch
  Rationale: When a repository uses trunk, production, or another undocumented default branch, the fallback protects only main, master, and dev, allowing autonomous framework or validation-fixer commits directly on the actual default branch.
  Fix: Always resolve and protect origin/HEAD or the hosting provider's default branch, add trunk to the fallback, and merge in any additional protected names from merge-base-trusted policy.
  _fixed via orchestrator · 5531b4b · 2026-07-21_

- [x] [sec-4|med] Untrusted severity selects the reduced-review lane (plugins/my-skills/skills/validation-fixer/SKILL.md:151)
  fingerprint: security|plugins/my-skills/skills/validation-fixer/SKILL.md|untrusted-severity-selects-the-reducedreview-lane
  Rationale: The procedure declares backlog text attacker-influenced, yet trusts its low or info token to bypass the orchestrator pipeline and route directly to an inline main-agent fix; autonomous mode accepts that downgrade without review.
  Fix: Independently verify severity before lane assignment, treating unverified values as unknown and requiring explicit confirmation before any item enters the main-agent lane.
  _fixed via orchestrator · 477ea7c · 2026-07-21_

- [x] [sec-5|med] A fixed backtick fence does not contain untrusted item text (plugins/my-skills/skills/validation-fixer/SKILL.md:294)
  fingerprint: security|plugins/my-skills/skills/validation-fixer/SKILL.md|a-fixed-backtick-fence-does-not-contain-untrusted-item-text
  Rationale: An item containing a line of four backticks closes the quoted evidence block, so following attacker-controlled text is presented outside the data boundary to the downstream agent.
  Fix: Choose a fence longer than the longest backtick run in the item, or serialize the evidence as escaped JSON with a generated delimiter that cannot occur in the input.
  _fixed via orchestrator · 071523a · 2026-07-22_

- [x] [sec-6|med] A 48-bit digest does not make artifact paths injective (plugins/my-skills/skills/pr-review-report/SKILL.md:73)
  fingerprint: security|plugins/my-skills/skills/pr-review-report/SKILL.md|a-48bit-digest-does-not-make-artifact-paths-injective
  Rationale: The documentation claims distinct branches always produce distinct filenames, but truncating SHA-1 to 12 hex characters permits practical birthday collisions, which can merge one branch's backlog dispositions into another branch's report path.
  Fix: Use at least 128 digest bits, reduce the readable prefix cap accordingly, and verify the raw branch owner before merging an existing backlog.
  _fixed via orchestrator · adc107e · 2026-07-22_

## Bugs & Improvements

- [x] [bug-1|high] Review content still follows moving HEAD after snapshot capture (plugins/my-skills/skills/pr-review-report/SKILL.md:80)
  fingerprint: bugs|plugins/my-skills/skills/pr-review-report/SKILL.md|review-content-still-follows-moving-head-after-snapshot-capture
  Rationale: Step 1 records reviewed_head for immutable metadata, but later merge-base, policy, provenance, and full-diff commands still use HEAD. A new commit or branch switch can make the findings describe a different tree than meta.reviewedHead.
  Fix: Compute the merge-base against reviewed_head once, use reviewed_head in every subsequent range and provenance command, and emit only a final drift warning if the working HEAD changes.
  _fixed via orchestrator · 93e248c · 2026-07-22_

- [x] [bug-2|med] Collapse-all routing conflicts with the no-cross-file rule (plugins/my-skills/skills/validation-fixer/SKILL.md:202)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|collapseall-routing-conflicts-with-the-nocrossfile-rule
  Rationale: Directory mode simultaneously requires collapse everything to produce one batch and one shared commit while Q4 requires separate batches for every file, leaving no deterministic execution for that approved routing choice.
  Fix: Define collapse-all as one batch per file, or explicitly state that it overrides Q4 and document the resulting cross-file commit and rollback semantics.
  _fixed via orchestrator · 96aca23 · 2026-07-22_

- [x] [bug-3|med] Unrestricted lane edits violate the low-info main-agent bound (plugins/my-skills/skills/validation-fixer/SKILL.md:200)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|unrestricted-lane-edits-violate-the-lowinfo-mainagent-bound
  Rationale: Q3 permits any critical, high, medium, or unknown item to move into the main-agent lane, while the skill repeatedly defines that inline-fix exception as severity-bounded to low and info only.
  Fix: Disallow moving non-low/info items into main-agent while retaining edits between batch and dedicated, or redefine the exception as user-approval-bounded everywhere.
  _fixed via orchestrator · 67fdc68 · 2026-07-22_

- [x] [bug-4|med] Porcelain parsing is not path-exact for unusual filenames (plugins/my-skills/skills/validation-fixer/SKILL.md:236)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|porcelain-parsing-is-not-pathexact-for-unusual-filenames
  Rationale: Plain git status --porcelain C-quotes paths, encodes renames specially, and may collapse untracked directories, so textual comparison can fail to exempt the exact validation file or can misidentify the rollback baseline.
  Fix: Use git status --porcelain=v1 -z --untracked-files=all and parse NUL-delimited records, including both rename endpoints, without shell word splitting.
  _fixed via orchestrator · 74b6673 · 2026-07-22_

- [x] [bug-5|med] Rejected checkpoint commits receive contradictory item states (plugins/my-skills/skills/validation-fixer/SKILL.md:339)
  fingerprint: bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|rejected-checkpoint-commits-receive-contradictory-item-states
  Rationale: The commit branch says rejection rolls back and leaves the item open as [ ], while the shared recording rule maps every no-commit outcome to [~], so executors can persist different states for the same rejection.
  Fix: Carry an explicit fixed, attempted, or rejected outcome into Step 4; preserve [ ] for rejected work and reserve [~] for an actual blocked or failed attempt.
  _fixed via orchestrator · a63e548 · 2026-07-22_

- [x] [bug-6|low] Committed reports do not form one authoritative snapshot pair (docs/reviews/feat-pr-review-md-backlog-2026-07-20.html:1)
  fingerprint: bugs|docs/reviews/feat-pr-review-md-backlog-2026-07-20.html|committed-reports-do-not-form-one-authoritative-snapshot-pair
  Rationale: The legacy-name HTML has no same-basename Markdown sibling and describes a different reviewed HEAD from the digest-named HTML/Markdown pair, leaving two competing reports for one branch and date.
  Fix: Remove the unpaired legacy artifact and regenerate one digest-named HTML and Markdown pair from the same latest immutable reviewed HEAD.
  _fixed via orchestrator · c01a64e · 2026-07-22_
