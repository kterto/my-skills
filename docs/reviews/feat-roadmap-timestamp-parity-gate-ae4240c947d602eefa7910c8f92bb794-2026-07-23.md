<!-- backlog-schema: v1 -->
<!-- backlog-branch: feat/roadmap-timestamp-parity-gate -->
# PR Review Findings — feat/roadmap-timestamp-parity-gate  (base main@b0ffdf6, 2026-07-23)

/validation-fixer docs/reviews/feat-roadmap-timestamp-parity-gate-ae4240c947d602eefa7910c8f92bb794-2026-07-23.md  ·  framework: orchestrator

Counts: crit 0 · high 0 · med 3 · low 1 · info 0 · acknowledged 0

## Architecture

- [x] [arch-1|med] Gate and scope helper have independent upgrade lifecycles (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:58)
  _fixed via main-agent · 5568d1c · 2026-07-23_
  _prior fix main-agent · 9ab8d4a · 2026-07-23 regressed 2026-07-23_
  fingerprint: architecture|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|gate-and-scope-helper-have-independent-upgrade-lifecycles
  Rationale: The new minimum-only API check rejects stale helpers but accepts every unknown newer version. ADR-0010 says the helper version is bumped when discovery semantics change in a way consumers must not run against, so an old materialized gate can still execute an incompatible v2 helper after orchestrator setup refreshes first.
  Fix: Require an exact supported version or an explicit compatible range/capability contract, test unknown-newer versions, and update ADR-0010 with the forward-compatibility rule.
  ADR: Amend ADR-0010: Define forward compatibility for gate runtime APIs

- [x] [arch-1|low] Canonical roadmap layout omits the gate asset (plugins/my-skills/skills/roadmap/SKILL.md:115)
  _fixed via main-agent · 3da4a46 · 2026-07-23_
  fingerprint: architecture|plugins/my-skills/skills/roadmap/SKILL.md|canonical-roadmap-layout-omits-the-gate-asset
  Rationale: The roadmap now materializes an executable check-timestamp-parity.cjs asset, but references/directory-layout.md still declares itself the single source of truth for /roadmap/ without listing it. Consumers cannot distinguish the supported HTML-mode asset from an unexpected file.
  Fix: Add roadmap/check-timestamp-parity.cjs to the canonical directory tree and artifact-format notes, explicitly scoped to HTML mode.
  _prior-only: finding left this review's diff (2026-07-23)_

## Security

- [x] [sec-1|high] Shared scope hardening exposes symlinks to unguarded consumers (plugins/my-skills/skills/orchestrator/scripts/gate-scope.cjs:121)
  _fixed via main-agent · 3fd0950 · 2026-07-23_
  fingerprint: security|plugins/my-skills/skills/orchestrator/scripts/gate-scope.cjs|shared-scope-hardening-exposes-symlinks-to-unguarded-consumers
  Rationale: branchScope now deliberately returns missing and type-changed symlink paths to every consumer, but check-artifact-links.cjs and check-artifact-pairing.cjs immediately read those paths without lstat, containment, or size checks. A branch can type-change a plans artifact to a symlink and make either gate read outside the repository or exhaust the runner.
  Fix: Centralize mandatory regular-file, canonical-containment, and size validation in the shared scope API, or add equivalent fail-closed validation to both artifact gates and their explicit-target modes. Add type-changed and untracked symlink contract tests for all consumers.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [sec-1|med] Branch scope drops adversarial HTML paths before validation (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:54)
  _fixed via main-agent · f0eb673 · 2026-07-23_
  fingerprint: security|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|branch-scope-drops-adversarial-html-paths-before-validation
  Rationale: The default mode delegates discovery to gate-scope.cjs, whose --diff-filter=AM omits type changes and renames and whose existsSync filter drops dangling symlinks. A tracked page changed to a dangling symlink is therefore removed before this gate's new lstat checks and can yield a false OK; newline-quoted Git paths are also parsed unsafely.
  Fix: Make gate-scope use NUL-delimited Git output, include type changes and renames (or disable rename detection), and return Git-reported paths without existsSync filtering so the parity gate can reject missing, symlinked, and non-regular targets.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [sec-1|high] Gate refresh can overwrite through a roadmap symlink (plugins/my-skills/skills/roadmap/SKILL.md:221)
  _fixed via main-agent · df4a418 · 2026-07-23_
  fingerprint: security|plugins/my-skills/skills/roadmap/SKILL.md|gate-refresh-can-overwrite-through-a-roadmap-symlink
  Rationale: Every HTML write pass is instructed to copy trusted bytes to roadmap/check-timestamp-parity.cjs, but the contract has no symlink or canonical-containment guard. A repository-controlled symlink at that destination can redirect a normal copy to overwrite a file outside roadmap with the reviewer's privileges.
  Fix: Specify a symlink-safe atomic refresh: reject symlinked roadmap parents and targets, verify the canonical parent is the repository roadmap directory, write a same-directory temporary regular file, re-check the target, then atomically rename it into place.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [sec-2|med] Gate follows symlinked audit targets outside the roadmap (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:57)
  _fixed via main-agent · a3a51df · 2026-07-23_
  fingerprint: security|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|gate-follows-symlinked-audit-targets-outside-the-roadmap
  Rationale: readFileSync follows symlinks returned by branch scope, --all, and explicit targeting. An untrusted branch can add a roadmap/*.html symlink to an external or unbounded file, causing the gate to read outside the repository, leak matching timestamp text in diagnostics, or exhaust the runner.
  Fix: Use lstat and realpath before every read, reject symlinks and non-regular files, enforce canonical containment under the roadmap directory, require an .html suffix, and cap the accepted file size.
  _prior-only: finding left this review's diff (2026-07-23)_

## Bugs & Improvements

- [x] [bug-1|med] Inert template markup can spoof the root main (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:130)
  _fixed via main-agent · 6f9aaa2 · 2026-07-23_
  _prior fix main-agent · 0aff731 · 2026-07-23 regressed 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|inert-template-markup-can-spoof-the-root-main
  Rationale: The attempted structural fix still uses regexes. A main and matching marker inside iframe or other unstripped raw/inert contexts is accepted as the document root, and a matching marker in an aside can replace a missing marker in the expected metadata block; duplicate identical markers also pass despite the exactly-one contract.
  Fix: Parse the document as HTML, require exactly one body > main, and require exactly one updated marker in that main’s expected metadata element while rejecting misplaced or duplicate markers. Add iframe, nested-template, misplaced-marker, and identical-duplicate regressions.

- [x] [bug-2|med] Pairing guard is bypassed when plans is absent (plugins/my-skills/skills/orchestrator/scripts/check-artifact-pairing.cjs:42)
  _fixed via main-agent · 040b6b6 · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/orchestrator/scripts/check-artifact-pairing.cjs|pairing-guard-is-bypassed-when-plans-is-absent
  Rationale: The script exits before parsing explicit arguments or calling the new targetProblem guard. In a project without plans/, `-- missing.md` or a symlink target therefore exits zero with no diagnostic, contradicting the branch’s fail-closed explicit-target hardening.
  Fix: Parse mode before the plans existence check and allow the no-plans shortcut only for automatic branch scope; explicit mode must validate every supplied target. Add a no-plans explicit missing/symlink integration test.

- [x] [bug-3|low] Empty explicit mode falls through to branch scope (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:71)
  _fixed via main-agent · 33d7aac · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|empty-explicit-mode-falls-through-to-branch-scope
  Rationale: Explicit mode is inferred from explicit.length rather than the presence of --. An invocation ending in bare -- unexpectedly loads branch scope instead of rejecting an empty audit list; the same pattern remains in both orchestrator artifact gates.
  Fix: Set explicitMode from dashDash >= 0, reject an empty explicit target list with a nonzero diagnostic, and use that flag consistently for target selection and containment in all three gates.

- [x] [bug-1|med] Primary management flow still omits the gate (plugins/my-skills/skills/product-manager/references/roadmap-management.md:46)
  _fixed via main-agent · cc48fc4 · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/product-manager/references/roadmap-management.md|primary-management-flow-still-omits-the-gate
  Rationale: The detailed roadmap-management and git-flow references now gate every HTML-writing mutation, but product-manager/SKILL.md still tells the primary front-door to proceed directly from roadmap write to commit. An agent following the entry skill can therefore skip the mandatory gate despite the corrected secondary references.
  Fix: Insert an explicit HTML-mode timestamp-parity gate step in product-manager/SKILL.md between the roadmap op write and commit, covering every mutation that writes any roadmap HTML page.
  _prior fix main-agent · e0dc3a5 · 2026-07-23 regressed 2026-07-23_
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-3|low] Explicit mode exempts noncanonical index pages (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:140)
  _fixed via main-agent · d49bb00 · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|explicit-mode-exempts-noncanonical-index-pages
  Rationale: The index exemption accepts any explicit target declaring data-kind="roadmap-index" because !enforceContainment bypasses the canonical-path check. Explicitly auditing a nested roadmap item that removes both timestamps and changes its kind therefore returns OK.
  Fix: Require the exemption target to be the canonical roadmap/README.html path in every mode. Rework the recognized-index test around a temporary canonical roadmap layout instead of weakening production validation.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-1|high] Gate invocation ignores PM's resolved base and standalone mode (plugins/my-skills/skills/product-manager/references/git-flow.md:241)
  _fixed via main-agent · b12dcd6 · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/product-manager/references/git-flow.md|gate-invocation-ignores-pms-resolved-base-and-standalone-mode
  Rationale: The fix invokes node "$gate" "$base", but no command in the flow assigns a shell variable named base; base resolution only describes a conceptual value and uses placeholders elsewhere. An empty variable falls back to main/origin/main, while set -u aborts, so configured and stacked PRs still do not reliably audit their actual base.
  Fix: Assign and validate a concrete base variable when PM resolves the story or planning base, then use that same non-empty value for checkout, the parity gate, and gh pr create. Add configured-base and stacked-base execution tests.
  _prior fix main-agent · 3db79fd · 2026-07-23 regressed 2026-07-23_
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-3|med] Timestamp extraction accepts decoy markers (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:102)
  _fixed via main-agent · 99f4eed · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|timestamp-extraction-accepts-decoy-markers
  Rationale: Although data-kind is now read from the root main, data-updated-at and the visible value still use first-match regexes over the entire document. A matching marker in a leading comment or nested element can hide a missing or divergent root timestamp and make the gate print OK.
  Fix: Extract data-updated-at from the actual root main opening tag and the visible timestamp from its expected metadata element, ignoring comments, scripts, styles, nested decoys, and duplicate marker locations. Add comment and nested-element decoy tests.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-1|high] Markdown-mode sync cannot stage an absent HTML gate (plugins/my-skills/skills/product-manager/references/git-flow.md:90)
  _fixed via main-agent · 224461d · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/product-manager/references/git-flow.md|markdownmode-sync-cannot-stage-an-absent-html-gate
  Rationale: The success path unconditionally passes roadmap/check-timestamp-parity.cjs to git add, although default Markdown mode intentionally never creates that file. Git treats the missing pathspec as fatal, so every Markdown-mode PM run stops before committing its sync documents.
  Fix: Stage the lock and README paths first, then add roadmap/check-timestamp-parity.cjs only when it exists. Apply the same conditional staging to the worked example.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-2|med] Missing explicit targets produce a false OK (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:47)
  _fixed via main-agent · 0d99ca3 · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|missing-explicit-targets-produce-a-false-ok
  Rationale: Explicit paths that do not exist are silently removed by the existsSync filter. A typo such as -- roadmap/missing.html audits zero files, prints roadmap-timestamp-parity: OK, and exits successfully despite the advertised fail-closed behavior.
  Fix: Validate every explicit target and exit nonzero when any target is missing, not a regular file, or not an HTML file. Add tests for a missing path and a mixed existing/missing target list.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-4|low] Index exemption trusts spoofable page content (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:70)
  _fixed via main-agent · 4942892 · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|index-exemption-trusts-spoofable-page-content
  Rationale: The missing-both exemption accepts the first data-kind="roadmap-index" string anywhere in the document. An item page containing that text in a comment, script, or nested element can lose both timestamps and still be skipped.
  Fix: Grant the exemption only to the canonical roadmap/README.html target, optionally also verifying its root main element, rather than trusting an unconstrained content regex.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-5|low] Integration fixtures still expect missing markers to pass (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.test.cjs:107)
  _fixed via main-agent · 8a0ff7f · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.test.cjs|integration-fixtures-still-expect-missing-markers-to-pass
  Rationale: The focused test now allows missing markers only for a recognized index, but orchestrator gate-scope.test.cjs and gate-shell-injection.test.cjs still create a generic marker-free HTML page and expect OK. Once the new gate is materialized, those existing integration assertions fail.
  Fix: Update both orchestrator fixtures to use either a recognized roadmap index or a normal item page with equal machine-readable and visible timestamps, and revise their stale comments.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-1|high] Hosted index omits the timestamp-parity scripts (plugins/my-skills/skills/roadmap/SKILL.md:238)
  _fixed via main-agent · 3ac74e4 · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/SKILL.md|hosted-index-omits-the-timestampparity-scripts
  Rationale: The roadmap entry in plugins/my-skills/skills/index.json still excludes both new scripts, and the repository freshness check fails. Hosted installs download only indexed files, so the installed skill will instruct agents to copy a gate asset that was never installed.
  Fix: Run node scripts/generate-opencode-skill-index.mjs and commit the regenerated plugins/my-skills/skills/index.json so both scripts ship with hosted roadmap installs.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-2|med] Dropping both timestamp markers passes the gate (plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs:61)
  _fixed via main-agent · 6adf4bb · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/scripts/check-timestamp-parity.cjs|dropping-both-timestamp-markers-passes-the-gate
  Rationale: Any HTML file with neither marker is treated as an aggregate and skipped. A milestone, phase, story, or release-matrix render that accidentally drops both timestamp representations therefore prints OK; the generic missing-both fixture explicitly codifies that fail-open result.
  Fix: Recognize the intentionally untimestamped roadmap index explicitly, then report missing markers for every other roadmap HTML page. Change the missing-both fixture to an item page that must fail and add a separate recognized-index pass case.
  _prior-only: finding left this review's diff (2026-07-23)_

- [x] [bug-3|med] Existing HTML roadmaps silently skip the gate (plugins/my-skills/skills/roadmap/SKILL.md:115)
  _fixed via main-agent · c2170fc · 2026-07-23_
  fingerprint: bugs|plugins/my-skills/skills/roadmap/SKILL.md|existing-html-roadmaps-silently-skip-the-gate
  Rationale: The asset is copied only during initial Step 4 materialization. Existing HTML roadmaps use sync, re-eval, or mutation flows instead, while product-manager guards execution with -f and silently skips when the file is absent. Upgraded projects therefore receive none of the promised protection.
  Fix: Refresh or migrate the gate asset during every HTML-mode sync, re-eval, and mutation write, and make product-manager fail closed when roadmap HTML exists but the asset is missing. Ensure the asset is included in the subsequent roadmap docs commit.
  _prior-only: finding left this review's diff (2026-07-23)_
