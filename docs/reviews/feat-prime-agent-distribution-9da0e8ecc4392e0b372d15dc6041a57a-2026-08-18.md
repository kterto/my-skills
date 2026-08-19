<!-- backlog-schema: v1 -->
<!-- backlog-branch: feat/prime-agent-distribution -->
# PR Review Findings - feat/prime-agent-distribution  (base main@a0ed81d, 2026-08-18)

/validation-fixer docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-18.md  ·  framework: orchestrator

Counts: crit 0 · high 12 · med 5 · low 0 · info 0 · acknowledged 0

## Architecture

- [x] [arch-1|high] Nested cost model omits integration sub-lane work (plugins/my-skills/skills/orchestrator/SKILL.md:471)
  fingerprint: architecture|plugins/my-skills/skills/orchestrator/SKILL.md|nested-cost-model-omits-integration-sublane-work
  Rationale: The slicing digest collects sub-lane task counts and overlaps but never requires the serial integration sub-lane count. The advertised makespan and `g > c` admission decision can therefore underprice nested execution and select a slower plan.
  Fix: Require each proposed sub-lane split to declare an integration slice (`none` or name, requirements, globs, task count); validate it and use that value in the cost model and sub-contract.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [arch-2|high] Prime bootstrap materializes unusable host-specific roles (prime-agent/skills/orchestrator/SKILL.md:93)
  fingerprint: architecture|prime-agent/skills/orchestrator/SKILL.md|prime-bootstrap-materializes-unusable-hostspecific-roles
  Rationale: The Prime protocol requires `.orchestrator/roles`, but B3 still writes only Claude or opencode agent files. A fresh Prime setup has no roles where its protocol requires them.
  Fix: Add an orchestrator overlay replacement for B3 that writes `.orchestrator/roles/{role}.md` and removes the Claude/opencode branches.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

## Security

- [x] [sec-1|high] Diff base ref is executed through a shell command (prime-agent/skills/clean-code-gates/src/scope.cjs:69)
  fingerprint: security|prime-agent/skills/clean-code-gates/src/scope.cjs|diff-base-ref-is-executed-through-a-shell-command
  Rationale: A user-supplied `--scope diff:<baseRef>` is interpolated into `execSync`; double quotes still allow command substitution. A crafted base ref can execute commands with the gate runner user privileges.
  Fix: Use `execFileSync` with an argv array for every Git invocation and validate the resolved ref before passing it to Git.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [sec-2|high] Installer follows symlinked destination components (prime-agent/install.sh:41)
  fingerprint: security|prime-agent/install.sh|installer-follows-symlinked-destination-components
  Rationale: A project-controlled `.prime/agent/skills` path can point outside the project. Installation writes there, and `--force` can recursively delete external directories.
  Fix: Resolve the canonical project root and reject symlinked destination components or any resolved destination outside that root before creating, copying, or deleting files.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

## Bugs & Improvements

- [x] [bug-1|high] Gate execution errors still exit successfully (prime-agent/skills/clean-code-gates/src/run.cjs:42)
  fingerprint: bugs|prime-agent/skills/clean-code-gates/src/run.cjs|gate-execution-errors-still-exit-successfully
  Rationale: Reports with `summary.status === "error"` return exit code 0 unless `--require-tools` is set. CI can accept a failed coverage, lint, or mutation invocation as a passing run.
  Fix: Return a nonzero exit code for `error` status, distinct from the blocker and missing-tool exit codes.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-2|high] Coverage gate skips source files absent from the report (prime-agent/skills/clean-code-gates/src/adapters/node-ts.cjs:295)
  fingerprint: bugs|prime-agent/skills/clean-code-gates/src/adapters/node-ts.cjs|coverage-gate-skips-source-files-absent-from-the-report
  Rationale: Coverage tools commonly omit unimported source files. The current loop ignores any scoped file with no coverage entry, so a newly added completely untested file can pass G1.
  Fix: Emit a zero-coverage blocker or coverage-collection error for every non-exempt scoped source file missing from the report; apply the same rule to the Dart adapter.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-3|high] Requested unsupported gates become a vacuous pass (prime-agent/skills/clean-code-gates/src/gates/registry.cjs:9)
  fingerprint: bugs|prime-agent/skills/clean-code-gates/src/gates/registry.cjs|requested-unsupported-gates-become-a-vacuous-pass
  Rationale: G3 is advertised but not configured for either default stack. Selecting `--gates G3` filters it out, producing no gate results and a pass report.
  Fix: Register and implement G3, or reject unsupported explicitly requested gates instead of silently dropping them.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-4|high] Generated defaults lose monorepo package locations (prime-agent/skills/clean-code-gates/defaults.cjs:19)
  fingerprint: bugs|prime-agent/skills/clean-code-gates/defaults.cjs|generated-defaults-lose-monorepo-package-locations
  Rationale: Stack detection records types, then defaults always use root `src` or `lib`. Nested packages can be excluded entirely or make project scope fail while reporting an empty or incomplete gate result.
  Fix: Preserve detected package directories and derive roots relative to each package, including multiple packages of the same stack.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-6|high] Installer leaves a partial installation on collision (prime-agent/install.sh:47)
  fingerprint: bugs|prime-agent/install.sh|installer-leaves-a-partial-installation-on-collision
  Rationale: The script detects collisions while it copies. If a later skill exists, earlier skills have already been installed before it exits, leaving a state that non-force reruns reject.
  Fix: Preflight every destination before mutation, then copy through a staging directory and rename atomically after all checks pass.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-10|high] Prime parallelism gate can disable its own RLM fan-out (prime-agent/skills/orchestrator/SKILL.md:626)
  fingerprint: bugs|prime-agent/skills/orchestrator/SKILL.md|prime-parallelism-gate-can-disable-its-own-rlm-fanout
  Rationale: The port requires `rlm()` for fan-out, but retained capability condition 6 only recognizes Claude/opencode subagent tooling. Valid Prime runs can be degraded to `off`.
  Fix: Override condition 6 in the Prime overlay to test RLM availability and concurrent RLM admission.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-11|high] Prime explain-codebase port has no RLM execution path (prime-agent/skills/explain-codebase/SKILL.md:41)
  fingerprint: bugs|prime-agent/skills/explain-codebase/SKILL.md|prime-explaincodebase-port-has-no-rlm-execution-path
  Rationale: The bundled skill retains only Claude/opencode fan-out mechanisms, so its required module analysis cannot run on the target runtime.
  Fix: Add a Prime overlay with bounded RLM waves, a result-return contract, and retry behavior.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-12|high] Prime validation-fixer invokes an unavailable plugin namespace (prime-agent/skills/validation-fixer/SKILL.md:594)
  fingerprint: bugs|prime-agent/skills/validation-fixer/SKILL.md|prime-validationfixer-invokes-an-unavailable-plugin-namespace
  Rationale: Its orchestrator handoff uses `my-skills:orchestrator`, which is unavailable in Prime. This breaks the advertised review-to-fix workflow.
  Fix: Invoke `/skill:orchestrator` in the Prime port and gate optional external frameworks on actual availability.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-5|med] No-comments gate misses inline comments (prime-agent/skills/clean-code-gates/src/gates/g5-no-comments.cjs:24)
  fingerprint: bugs|prime-agent/skills/clean-code-gates/src/gates/g5-no-comments.cjs|nocomments-gate-misses-inline-comments
  Rationale: The recognizers are anchored to the beginning of a line. Inline `//` and `/* */` comments inside code bodies evade a gate that claims to disallow them.
  Fix: Tokenize comments while excluding strings, or otherwise scan delimiters beyond line starts with language-aware handling.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-7|med] Distribution build drops executable file modes (scripts/build-prime-agent.mjs:178)
  fingerprint: bugs|scripts/build-prime-agent.mjs|distribution-build-drops-executable-file-modes
  Rationale: Generated files are written with Node defaults. Shell tests that are executable in the source become mode 0644 in the package, so direct execution fails.
  Fix: Preserve each source file mode via `statSync(file).mode` in `writeFileSync` or apply `chmodSync` after writing.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-8|med] Published test command references excluded test files (prime-agent/package.json:19)
  fingerprint: bugs|prime-agent/package.json|published-test-command-references-excluded-test-files
  Rationale: The package exposes `npm test` but the `files` allowlist omits `tests/`; installed consumers receive a package whose test script immediately fails.
  Fix: Include `tests/` in the published files or remove the test script from the distribution manifest.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-9|med] Packaged clean-code-gates README points to a nonexistent Claude path (prime-agent/skills/clean-code-gates/README.md:12)
  fingerprint: bugs|prime-agent/skills/clean-code-gates/README.md|packaged-cleancodegates-readme-points-to-a-nonexistent-claude-path
  Rationale: The installer creates Prime skill paths, not `~/.claude/skills`. Following the documented command after installation fails.
  Fix: Replace this via the clean-code-gates overlay with a Prime installed-skill path or a documented `<skill-dir>/bin/gates.cjs` invocation.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

- [x] [bug-13|med] Packaged skills reference marketplace paths and absent ADRs (prime-agent/skills/roadmap/SKILL.md:239)
  fingerprint: bugs|prime-agent/skills/roadmap/SKILL.md|packaged-skills-reference-marketplace-paths-and-absent-adrs
  Rationale: Several distributed skills retain `plugins/my-skills/skills/...` and relative `docs/adr/...` links that do not exist in the npm package, so runtime guidance cannot be followed.
  Fix: Use installed relative skill paths and ship, link externally, or remove referenced ADRs through the relevant overlays.
  _fixed via orchestrator · 860a9c7 · 2026-08-19_

