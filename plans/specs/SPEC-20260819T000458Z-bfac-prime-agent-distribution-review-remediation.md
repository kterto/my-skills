---
id: SPEC-20260819T000458Z-bfac
title: Prime Agent distribution review remediation
status: READY_FOR_PLANNING
created_at: 2026-08-19T00:12:17Z
updated_at: 2026-08-19T00:12:17Z
cycle: 0
related_to: docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-18.md, docs/adr/0012-nested-parallelism-cost-model-corrections.md, docs/adr/0013-overlapped-inner-joins.md
---

## Summary

Remediates the 17 findings raised by the PR review of `feat/prime-agent-distribution` — the branch that shipped the generated `prime-agent/` npm distribution alongside `spec-driven-eval`. The findings split into four families: a shell-injection and an installer path-traversal hole; four `clean-code-gates` defects that let a gate run report green while measuring nothing; five Prime-port adaptation gaps where the generated distribution still instructs Claude Code / opencode mechanisms that do not exist under Prime Agent; and packaging/documentation defects (lost file modes, an unshippable `npm test`, dead marketplace and ADR links). The user-facing outcome is a distribution whose gates cannot report a false pass, whose installer cannot write outside the project, and whose Prime port actually runs on Prime.

All 17 were independently confirmed against the code before this spec was written — including an empirically reproduced command execution via `--scope diff:<baseRef>`. Two findings were confirmed with a corrected premise (see FR-7 and FR-17), and three genuinely adjacent defects were discovered and deliberately excluded (see **Non-goals**).

## Goals

- A `clean-code-gates` run can no longer exit `0` while having measured nothing, gated nothing, or crashed every gate.
- A user-supplied `--scope diff:<baseRef>` can no longer execute commands as the gate-runner user.
- `prime-agent/install.sh` cannot create, copy into, or delete a path outside the resolved installation root, and cannot leave a half-installed tree behind.
- The Prime Agent port dispatches, materializes roles, and invokes sibling skills using mechanisms that exist under Prime Agent, so `orchestrator`, `explain-codebase`, and `validation-fixer` are runnable there.
- The orchestrator's nested viability gate prices the serial integration sub-lane it already knows it will execute, so `g > c` stops adopting plans that are slower than advertised.
- The published npm package ships working file modes, a `npm test` that runs, and documentation whose paths and links resolve after installation.

## Non-goals

- **Implementing G3 as a separate runtime gate.** `README.md:38` and `SKILL.md:42` already document G3 (length/nesting) as deliberately folded into G2 with the same thresholds and tools, and `defaults.cjs:5` + `node-ts.cjs:335-338` show it genuinely is enforced there. FR-7 therefore fixes the vacuous pass, not the gate inventory.
- **Correcting the flat/outer cost model's treatment of the top-level integration lane.** Verification found `references/config.md:228` (`M_flat`) and the Step 2p.2 flat print block omit the top-level integration lane entirely, so the outer model prices a serial lane as concurrent inside `max` over lanes. This is a real defect of the same family, but it is **not** one of the 17 findings (arch-1 is explicitly scoped to the *nested* sub-lane split). File it as a new backlog item.
- **Repairing the `report.schema.json` / documented-status mismatch.** `src/report.cjs:13,20` emit `status: "error"` and `summary.gatesErrored`, while `schema/report.schema.json:52-77` declares `additionalProperties: false` with `"enum": ["pass","warn","blocked"]` and no `gatesErrored`. Every real report already violates its own schema, independent of this work. FR-5 updates the **exit-code** documentation it changes; the schema/status-vocabulary correction is a separate finding to file.
- **Rewriting the orchestrator's read-only scan-agent resolution for Prime.** `SKILL.md:135` resolves the scan type to `Explore` / `explore` / `general-purpose` / `general` and is unrewritten by the Prime overlay. Adjacent to bug-10 but not among the 17; file separately.
- **Adopting ADR-0013** (`Proposed`, overlapped inner joins). FR-1 must not change Step 3s's barrier discipline or the `k × J` term.
- Committing or pushing. The pipeline ends at `READY_TO_COMMIT` per the project invariant.
- Any behavior change to `commit-pr`, `design-to-code`, `simplify`, or `product-manager` beyond the link/path rewrites named in FR-17.

## Users and use cases

- **Prime Agent end user (installs the npm package)**: runs `install.sh`, then `/skill:orchestrator`, `/skill:explain-codebase`, or `/skill:validation-fixer`. Success = the workflow dispatches and completes on Prime instead of stalling on an absent `Agent`/`task` tool or degrading to `parallelism: off`.
- **Target-project developer / CI running `clean-code-gates`**: runs `node <skill-dir>/bin/gates.cjs` over a repo. Success = a green run means gates actually ran and passed; a crashed, empty, or unmeasured run is loudly non-zero.
- **Skill maintainer (this repo)**: edits `plugins/my-skills/skills/**` or `prime-agent/overlays/**` and regenerates. Success = `node scripts/build-prime-agent.mjs --check` passes, `prime-agent` `npm test` passes, and `cd plugins/my-skills/skills/clean-code-gates && node --test` passes.
- **Marketplace (Claude Code / opencode) user**: unaffected. Every Prime-only correction lands in an overlay, never in the plugins source, so the marketplace hosts keep their correct host-specific instructions.

## Functional requirements

> **Traceability.** Each FR carries its backlog finding id. `docs/reviews/feat-prime-agent-distribution-…-2026-08-18.md` is the source; the coder marks each `- [ ]` item there per the validation-fixer contract.

### Source-of-truth rule (applies to every FR below)

1. **No file under `prime-agent/skills/` may be hand-edited.** `scripts/build-prime-agent.mjs` regenerates that tree wholesale (`rmSync(destRoot, …)` then rewrite) from `plugins/my-skills/skills/` plus `prime-agent/overlays/<skill>.json`. Every fix to a `prime-agent/skills/**` symptom lands in **either** the plugins-side source (when the defect is host-neutral) **or** the skill's overlay (when the correct text differs per host). Hand-maintained, non-generated files in scope: `prime-agent/install.sh`, `prime-agent/package.json`, `prime-agent/tests/**`, `prime-agent/README.md`, `prime-agent/overlays/**`, `scripts/build-prime-agent.mjs`.
2. **`node scripts/build-prime-agent.mjs --check` must exit 0** at the end of the work, and `prime-agent/skills/` must be committed in its regenerated state. An overlay `find` string must match its plugins-side anchor exactly and its `count` must hold — the builder hard-fails otherwise, which is the intended drift guard.
3. **When an FR changes a plugins-side anchor that an overlay `find` targets, both change together** in the same unit of work.

### arch-1 — Nested cost model must price the integration sub-lane

4. The nested slicing digest requested at `plugins/my-skills/skills/orchestrator/SKILL.md:471` (Step 2p.1) MUST require each proposed sub-lane split to declare an **integration slice** as a first-class field: either `none`, or a named slice carrying its mapped requirement IDs, its candidate globs, and an integer task count.
5. The strict-shape acceptance rule at `SKILL.md:486` MUST list the integration-slice field among the fields the digest is accepted as, so a digest that omits it is **rejected** rather than silently read as zero. (Today the rule discards any volunteered integration slice as "prose outside those fields".)
6. The declared integration-slice task count MUST feed `span(L)` exactly as `references/config.md:223` already specifies (`max` over non-integration sub-lanes **plus** `tasks(integration sub-lane)`), and therefore into `g = span_base − span_max` and the `g > c` admission decision at `references/config.md:283,289`. A declared `none` yields `tasks(integration) = 0`.
7. Integration-slice globs MUST satisfy the same **containment** rule as ordinary sub-lane globs (contained within the parent lane's globs).
8. The integration slice MUST remain **excluded** from the two work-concentration conditions per `references/config.md:375-378` (ADR-0012) — it is serial, so counting it measures concurrency that does not exist.
9. The Step 2p.2 printed nested block MUST populate its existing integration slot with the declared value: `span({lane}) = max(concurrent {n},…) + integration({n}) = {span_L}` (`SKILL.md:526`) and the `{, + integration sub-lane {n}}` slot at `SKILL.md:524`.
10. The `PRIOR SLICING ANALYSIS` envelope handed to the sub-contract architect at `SKILL.md:845` MUST carry the declared integration slice alongside the per-sub-lane requirements, task counts, globs, and intra-lane overlaps, so the sub-contract's required `### 5. Integration lane` region (`templates/architect.md:241-245`, verified at `SKILL.md:865`) is authored against the slice that was actually priced.
11. Normative detail MUST live in `references/config.md` (which owns the makespan model and the inner viability gate); `SKILL.md` Step 2p summarizes and links, per the repo's single-source-of-truth convention.
12. The **three worked examples** in `references/config.md` (including the integration-sub-lane example at `:337-349`) MUST be re-checked and, where the change moves a number, recomputed — `config.md` designates them as the regression check for any edit to either side of the model.
13. The decision MUST be recorded as an ADR under `docs/adr/`, as a follow-up to ADR-0012 (whose item 3 established `span(L)`'s integration term but left the digest input unplumbed). Amending ADR-0012 in place is acceptable if the architect prefers, provided the lineage is explicit.

### arch-2 — Prime bootstrap must materialize `.orchestrator/roles/`

14. `prime-agent/overlays/orchestrator.json` MUST gain a replacement covering bootstrap step **B3 item 1** (`plugins/my-skills/skills/orchestrator/SKILL.md:51`) that writes each of the six role templates to `.orchestrator/roles/{role}.md` and **removes** the Claude (`target/.claude/agents/{role}.md`) and opencode (`target/.opencode/agent/{role}.md`) branches, matching `prime-agent/overlays/protocol.orchestrator.md` ("role files belong in `.orchestrator/roles/{role}.md`") and `prime-agent/README.md:27-28`.
15. The B3 bootstrap summary (item 4, `SKILL.md:57`) MUST list `.orchestrator/roles/` among the created paths in the Prime port.
16. The plugins-side B3 MUST be left unchanged — `.claude/agents/` and `.opencode/agent/` are correct for those hosts.
17. Role bodies MUST be copied verbatim from `templates/{role}.md` (which ship intact at `prime-agent/skills/orchestrator/templates/`); the templates are project-agnostic and read `.orchestrator/PROJECT-CONTEXT.md` at runtime.

### sec-1 — Diff base ref must not reach a shell

18. Every Git invocation in `plugins/my-skills/skills/clean-code-gates/src/scope.cjs` (the `run()` helper at `:55` and its four call sites `:63`, `:68`, `:69`, `:70`) MUST use `execFileSync` with an argv array and no shell, matching the pattern already used everywhere else in the codebase (`src/adapters/node-ts.cjs:202,360,601,673`; `src/adapters/dart-flutter.cjs:123,241,381,434,594`).
19. The `baseRef` accepted at `src/args.cjs:8` MUST be validated before it reaches Git: it MUST be rejected unless it both matches a conservative ref-shape allow-list (no shell metacharacters, no leading `-`, no whitespace) and resolves via `git rev-parse --verify`.
20. A rejected or unresolvable base ref MUST fail loudly as a **usage/config error (exit 3)** with a clear message. It MUST NOT be swallowed into an empty file list — the current `try/catch` at `:54-58` returns `[]`, which downstream reads as an empty scope and reports a green pass.
21. A regression test MUST prove that a `baseRef` containing a command-substitution payload executes nothing and is rejected. (No existing test exercises a tainted `baseRef`.)

### sec-2 — Installer must not follow symlinked destination components

22. `prime-agent/install.sh` MUST resolve a canonical installation root — the physical path of the project (`--project`) or `$HOME` (`--global`) — and MUST reject the run when any component of the destination path (`.prime`, `.prime/agent`, `.prime/agent/skills`, or any per-skill `dest`) is a symlink, or when the fully resolved destination falls outside that canonical root.
23. The check MUST run **before** any `mkdir -p` (`:41`), `cp -R` (`:55`), or `rm -rf` (`:53`) — `--force` currently makes `rm -rf` capable of recursively deleting an external directory reached through a project-controlled symlink.
24. Rejection MUST be a non-zero exit with a message naming the offending component. Existing installer behavior for legitimate paths MUST be unchanged so `prime-agent/tests/install.sh` continues to pass.

### bug-1 — Gate execution errors must exit non-zero

25. `src/run.cjs:42-43` MUST map `report.summary.status === 'error'` to a **non-zero exit code distinct from `1` (blockers), `2` (missing tools with `--require-tools`), and `3` (usage/config)**. Default: **`4`**.
26. The mapping MUST be independent of `--require-tools`, which only inspects `summary.gatesMissingTool`; errored gates land in the separate `summary.gatesErrored` list (`src/report.cjs:6,20`).
27. The exit-code documentation MUST be updated in both places that publish it: the table at `plugins/my-skills/skills/clean-code-gates/README.md:143-150` and the `### Exit codes` line at `SKILL.md:33`.

### bug-2 — Coverage gate must not skip files absent from the report

28. In **both** adapters — `src/adapters/node-ts.cjs:295` and `src/adapters/dart-flutter.cjs:280` — a scoped source file that is **not exempt** and has **no entry** in the coverage report MUST produce a finding instead of `continue`. Default: a **zero-coverage blocker** (statement 0 %, branch 0 %), reusing the existing `coverageFindings` shape and message vocabulary.
29. The new rule MUST apply only to files matching the stack's source-file pattern (`TS_FILE_RE` for node-ts, `DART_FILE_RE` for dart-flutter — the node-ts loop currently applies no such filter), so non-source files that happen to sit under a stack root are not blocked.
30. The existing three-layer exemption vocabulary MUST remain the sanctioned way to declare a legitimately uncovered file: `stackCfg.exclude`, the G1-only `G1_EXEMPTIONS` (`defaults.cjs:8-11`), the per-gate `gates.G1.exempt` array, and `TEST_FILE_RE` (`isExempt`, `node-ts.cjs:183-189` / `dart-flutter.cjs:110-116`). No new exemption mechanism is introduced.
31. Regression tests MUST cover a scoped, non-exempt source file absent from the coverage report for both adapters.

### bug-3 — Requested unsupported gates must not become a vacuous pass

32. `selectGates` (`src/gates/registry.cjs:9`) MUST NOT silently drop a gate the caller **explicitly requested** via `--gates`. An explicitly requested gate that is either an unknown id or known-but-unsupported by the detected stack MUST fail as a **usage/config error (exit 3)**, naming the offending ids.
33. The two failure modes MUST be distinguishable in the message: an **unknown id** (e.g. `G9`, `g5`) versus a **known gate unsupported by this stack**. The `GATES` table at `registry.cjs:2-11` — currently dead code referenced only by its own definition and export — MUST become the canonical id registry that makes this distinction, or be removed if the architect finds a cleaner source.
34. A resolved gate set that is **empty** after `--gates`/`--skip` MUST also be a usage/config error rather than an empty, `status: "pass"`, exit-0 report. This is the same vacuous-pass harm reaching the same code path (`run.cjs:39` never loops → `report.cjs:12-15` yields zero blockers → `pass`).
35. Gates dropped **implicitly** (no `--gates` given; the stack simply does not support one) MUST keep their current silent behavior — only an explicit request is an error.
36. `README.md:24`'s claim that "Gates not supported by the detected stack are silently dropped" MUST be corrected to describe the new explicit-request behavior.

### bug-4 — Generated defaults must preserve monorepo package locations

37. `src/detect.cjs:7-26` already walks the whole tree and finds nested `pubspec.yaml` / `package.json`+`tsconfig.json` markers, then discards the directory (`found` is a `Set` of stack ids). Detection MUST instead **preserve the package directory** for every marker it finds, including **multiple packages of the same stack**.
38. `defaults.cjs:17-44` MUST derive `roots` **relative to each detected package** (e.g. `apps/mobile/lib`, `packages/api/src`) instead of hardcoding root-level `['src']` / `['lib']`.
39. A single-package repo rooted at the project root MUST keep producing today's defaults, so existing behavior is unchanged for the common case.
40. **Backward compatibility (project invariant):** an existing `.cleancode-gates.json` MUST continue to load and execute unchanged. Only *generated* defaults change; no migration is forced, and `roots` stays an array of strings.
41. The Dart `resolvePackageDir` walk-up (`dart-flutter.cjs:138-152`) and the manual `stackCfg.packageDir` override MUST keep working against the newly derived roots.
42. Regression tests MUST cover a node-ts monorepo layout and a repo containing two packages of the same stack. (`__tests__/dart-monorepo-g1.test.cjs` is the existing precedent for this class.)

### bug-6 — Installer must not leave a partial installation

43. `prime-agent/install.sh` MUST **preflight every destination** — collision checks for all bundled skills, plus the FR-22 symlink/containment checks — **before** mutating anything. Today the collision check sits inside the copy loop (`:47-52`), so a collision on a later skill exits after earlier skills are already installed, leaving a tree that a non-`--force` rerun then refuses.
44. Copies MUST land through a **staging directory**, moved into place only after every preflight check has passed; on any failure the staging directory is removed and the destination tree is left untouched.
45. `prime-agent/tests/install.sh` MUST be extended to prove that a collision on a later skill leaves **no** earlier skill installed.

### bug-10 — Prime capability gate must recognize RLM fan-out

46. `prime-agent/overlays/orchestrator.json` MUST gain a replacement rewriting **"How condition 6 is determined"** (`plugins/my-skills/skills/orchestrator/SKILL.md:584-588`) so the Prime port tests **`rlm()` availability and concurrent RLM admission** instead of the presence of a `subagent_type`/`Agent`/`task` subagent tool.
47. The rewritten rules MUST recognize the concurrency form the Prime protocol actually defines — `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` inside one call (`prime-agent/overlays/protocol.orchestrator.md`) — rather than "multiple subagent calls emitted together", which is unsatisfiable under Prime and currently makes rule 1 fire on **every** Prime run, degrading it to `parallelism: off` before the slicing analysis is even spawned (`SKILL.md:448,452`).
48. Condition 6's host-agnostic rationale sentence (`SKILL.md:582`, which names "concurrent `task` fan-out … on every opencode host") MUST be rewritten for the Prime port. Condition 6's own reason line and its status as a **static** pre-spawn guard MUST be preserved — a Prime host that genuinely cannot admit concurrent RLM children must still degrade to `off` rather than fail.
49. The plugins-side condition 6 MUST be left unchanged.

### bug-11 — Prime explain-codebase must have an RLM execution path

50. `prime-agent/overlays/explain-codebase.json` (today: only `dropFrontmatterKeys`, one git-pathspec replacement, and the generic preamble) MUST gain a Prime dispatch adaptation covering the Phase 2 fan-out at `plugins/my-skills/skills/explain-codebase/SKILL.md:235-243`, which currently names only `Agent` (`subagent_type: Explore` / `general-purpose`) and opencode `task`.
51. The adaptation MUST preserve the skill's existing contract while changing only the dispatch mechanism: **bounded waves** (`WAVE_SIZE = 8`, `MAX_UNITS = 24`), the per-unit allowlist slice, the canonical identity catalog issued once by the main agent, the **result-return contract**, **retry-once** on an invalid return, and the `partial` disclosure path.
52. The dispatch MUST mirror the established `prime-agent/overlays/protocol.orchestrator.md` precedent: `handle = await rlm(prompt, name=…)` for admission, `agent_message` for the child's completion/result, `asyncio.gather` for a wave, retry via `agent_message.send(…, receiver_role="child", receiver_name=handle.name)`, and the explicit "a read-only scan child must be forbidden from writes and mutating commands" clause — which matches explain-codebase's read-only containment posture.
53. The runtime validator MUST continue to gate every return; it already ships intact at `prime-agent/skills/explain-codebase/references/validate-subagent-return.cjs`.
54. The dual-host paragraph at `SKILL.md:41-46` MUST be corrected in the Prime port: it names `AskUserQuestion`/`question` and `Agent`/`task` as the only host variants, and its final sentence ("The `allowed-tools` frontmatter lists both host variants of every tool the body uses") is **false in the port**, because the overlay drops `allowed-tools`. This paragraph is the finding's cited anchor.

### bug-12 — Prime validation-fixer must invoke an available skill

55. `prime-agent/overlays/validation-fixer.json` (today: zero `replacements`) MUST rewrite the `my-skills:orchestrator` handoff to the documented Prime form **`/skill:orchestrator`** at both occurrences: the framework description (`plugins/my-skills/skills/validation-fixer/SKILL.md:93`) and the invocation-table row (`SKILL.md:605`). `/skill:<name>` is established by `prime-agent/overlays/preamble.md` and `prime-agent/README.md:21`, and `orchestrator` is installed by the same installer.
56. The invocation-table preamble that names only `Skill` (Claude Code) and the opencode skill mechanism (`SKILL.md:603-605` region) MUST be rewritten for Prime.
57. The optional external frameworks MUST be **gated on actual availability** before being offered. `superpowers` and `gsd` ship in neither the Prime distribution nor the installer, so a bare Prime install currently presents two guaranteed dead ends as equally valid choices in the Step 2 framework question. The gate MUST mirror the established precedent already in `prime-agent/overlays/orchestrator.json` for `spec-driven-eval`: check the installed Prime skill paths (`.prime/agent/skills/<name>` project, `~/.prime/agent/skills/<name>` global), and degrade explicitly rather than blocking.
58. The plugins-side `my-skills:orchestrator` MUST be left unchanged — it is correct for Claude Code.

### bug-5 — No-comments gate must catch inline comments

59. `src/gates/g5-no-comments.cjs` MUST detect comments beyond line starts. All eight recognizers (`:2-10`) are `^`-anchored, so `const x = 1; // inline what-comment` and `const y = /* inline */ 2;` produce **zero** findings today — trailing comments being the most common form of exactly the what-comment the gate exists to ban.
60. Detection MUST be **string-aware**: comment delimiters inside string, template, and character literals MUST NOT be treated as comments. The gate currently has no quote tracking and false-positives on a template-literal continuation line beginning with `//`, so it both under- and over-reports.
61. The existing allowance vocabulary MUST be preserved with position-sensitive semantics: `///` Dart doc, `/** */` TS doc blocks, plan-ID citations (`SPEC-`, `FEAT-`, `FIX-`, `CR-`, `QAF-`, `QA-`), `TODO(REF)`, analyzer directives (`// ignore:` / `// ignore_for_file:`), and the unindented licence banner in the first 5 lines. An **inline trailing** comment is a finding unless it matches the citation or analyzer-directive allow-lists.
62. G5 MUST be restricted to source files of the detected stack. It currently runs over **every** file in scope with no extension check (`src/run.cjs:17-23`), unlike the adapters which gate on `TS_FILE_RE`/`DART_FILE_RE` — so it reads `.json`, `.yaml`, and `.md` files with C-style recognizers. This is required for "language-aware handling" and removes a false-positive class.
63. Regression tests MUST cover: an inline trailing `//`, an inline `/* */`, a comment delimiter inside a string and inside a template literal, and each preserved allowance.
64. The strictness increase is **intended and user-visible**: repos that passed G5 on inline comments will now fail. Document it in the G5 row of `README.md` and the G5 bullet of `SKILL.md`.

### bug-7 — Distribution build must preserve executable file modes

65. `scripts/build-prime-agent.mjs:176-178` MUST preserve each source file's mode when writing the generated tree — via `writeFileSync(path, content, { mode })` from `statSync(file).mode`, or `chmodSync` after writing. Confirmed impact: `plugins/my-skills/skills/pr-review-report/__tests__/branch-slug.test.sh` is executable in source and mode `0644` in the distribution (source has 1 executable file; the generated tree has 0).
66. `--check` MUST detect **mode drift** in addition to content drift, so a regression here is caught by the same guard rail that catches a hand edit. Today `--check` compares bytes only, leaving the defect invisible.
67. `prime-agent/tests/parity.sh` MUST gain a case proving an executable source file arrives executable, consistent with that file's existing purpose as the builder's guard-rail regression suite.

### bug-8 — Published test command must resolve

68. `prime-agent/package.json` MUST make `npm test` work for an installed consumer. Default: add **`tests`** to the `files` allowlist (currently `["skills","install.sh","README.md","LICENSE","NOTICE"]`) while keeping the `test` script.
69. This is coherent with the existing design: `prime-agent/tests/parity.sh:14-17` already self-skips when the builder and source skills are absent ("skip: not a repository checkout"), and `prime-agent/tests/install.sh` runs correctly against an installed package. `prime-agent/README.md:50` documents `npm test` as the checkout workflow, which must keep working.

### bug-9 — Packaged clean-code-gates docs must name installed paths

70. `prime-agent/overlays/clean-code-gates.json` MUST gain a **`fileReplacements`** entry for `README.md` rewriting the install command at `plugins/my-skills/skills/clean-code-gates/README.md:12` — `node ~/.claude/skills/clean-code-gates/bin/gates.cjs` — to a Prime-installed path or the host-neutral `node <skill-dir>/bin/gates.cjs` form. The overlay currently declares neither `replacements` nor `fileReplacements`, so `README.md` is copied as raw bytes (`scripts/build-prime-agent.mjs:135-140`); `fileReplacements` is the correct mechanism and is already proven in `prime-agent/overlays/orchestrator.json`.
71. The same overlay MUST also rewrite `SKILL.md:66` (Prime `:74`), which names both wrong hosts *and* a marketplace path: "Claude Code personal install `~/.claude/skills/clean-code-gates`; opencode local installer `~/.config/opencode/my-skills/plugins/my-skills/skills/clean-code-gates`". This one is in `SKILL.md`, so plain `replacements` suffices.
72. The host-neutral `<skill-dir>` placeholder already used at `SKILL.md:15` and `:58` is the pattern to generalize. `bin/gates.cjs` is confirmed to exist at that relative path.
73. The plugins-side README/SKILL.md paths MUST be left unchanged — they are correct for the marketplace hosts.

### bug-13 — Packaged skills must not reference marketplace paths or unshipped ADRs

74. All **6** surviving `plugins/my-skills` references in the distribution MUST be rewritten via overlays. Confirmed inventory — `roadmap/SKILL.md:239` and `product-manager/SKILL.md:240` ("All normative details live in these files (relative to `plugins/my-skills/skills/<skill>/`)"), `clean-code-gates/SKILL.md:74` (covered by FR-71), `validation-fixer/SKILL.md:225`, `orchestrator/SKILL.md:796`, and `spec-driven-eval/UPSTREAM.md:28`. The first five are in `SKILL.md` (plain `replacements`); `UPSTREAM.md` needs `fileReplacements`.
75. The reference-file paths in `roadmap` and `product-manager` MUST point at the **installed** location. The files themselves ship correctly at `prime-agent/skills/<skill>/references/`; only the label is wrong. Use the host-neutral "relative to this skill directory" / `<skill-dir>` form.
76. `orchestrator/SKILL.md:796` additionally carries the distribution's last surviving `/my-skills:` slash-command form (`/my-skills:simplify`). It MUST become `/skill:simplify`. `simplify` does ship. The orchestrator overlay already rewrote the other two skill-resolution passages (B2 and Step 7a) and missed this one.
77. `spec-driven-eval/UPSTREAM.md:28` MUST have its maintainer-facing re-sync path clarified as belonging to the **source repository** rather than the installed package. Its third-party attribution content MUST NOT be removed (CC-BY-4.0, see `NOTICE`).
78. All **8** `docs/adr` links in the distribution MUST be repaired. Confirmed inventory: `roadmap/SKILL.md:155,228`, `roadmap/references/config.md:33`, `roadmap/references/item-schema.md:46`, `roadmap/references/mutation-ops.md:7`, `product-manager/references/scope-resolution.md:59`, `orchestrator/references/config.md:84`, `pr-review-report/SKILL.md:387`. Six of the eight sit outside `SKILL.md` and require `fileReplacements` entries that no overlay currently declares for those skills.
79. Repair MUST be by **absolute canonical repository URL** (`https://github.com/kterto/my-skills`, per `prime-agent/package.json` `homepage`), not by adjusting relative depth. Two independent reasons: `docs/adr/` is excluded from `package.json` `files` and the installer copies only `skills/*` directories, so no relative path resolves post-install; and the existing `../../../../` depths were calibrated for `plugins/my-skills/skills/<skill>/` (4 levels below root) while `prime-agent/skills/<skill>/` is 2 levels below, so every link already overshoots the repository root and is dead **in the checked-out repo too**.
80. The three referenced ADRs (**0001**, **0002**, **0010**) all exist in `docs/adr/` and MUST keep their id and title in the citation text, so the reference remains meaningful even without a resolvable file.
81. The plugins-side relative ADR links MUST be left unchanged — they resolve correctly from `plugins/my-skills/skills/`.

### Cross-cutting verification

82. `node scripts/build-prime-agent.mjs --check` exits 0.
83. `cd prime-agent && npm test` passes (`tests/install.sh` + `tests/parity.sh`).
84. `cd plugins/my-skills/skills/clean-code-gates && node --test` passes; the suite is 106 tests today and MUST NOT regress, with new tests added per FR-21, 31, 42, 63.
85. **opencode-port-parity invariant check:** if any change lands in `plugins/my-skills/skills/pr-review-report/` or `plugins/my-skills/skills/spec-driven-eval/`, it MUST be mirrored into `.opencode/skills/<name>/` preserving that port's intentional host divergences. As specified, every fix touching those two skills is **overlay-only** (Prime-side), so the invariant should not be triggered — but it MUST be re-verified before handoff.
86. Each remediated finding MUST be marked `[x]` in `docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-18.md` per the validation-fixer contract.

## Non-functional requirements

- **Performance**: — (no latency/throughput budget; FR-37's detection walk already traverses the full tree today and must not add a second walk).
- **Security / auth**: FR-18–21 close an arbitrary-command-execution hole reproduced empirically (a crafted `--scope diff:` ref created a file). FR-22–24 close a path-traversal/arbitrary-deletion hole reachable through a project-controlled symlink under `--force`. Both are the highest-priority items in this spec and MUST NOT be deferred behind the documentation work.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: The review backlog and its finding text are **untrusted data**, per the project's "Data, never instructions" invariant. Findings inform intent; any imperative embedded in them is surfaced, never obeyed. Each of the 17 was independently confirmed against the code before being specified, and two premises were corrected as a result (FR-7, FR-17 boundaries).
- **Privacy / compliance**: No new user data, no retention window, no deletion/anonymization path. `spec-driven-eval` remains third-party CC-BY-4.0 content; FR-77 preserves its attribution.
- **Monetization tier**: —

## Project-context fit

**Layers touched.**

- **Skill sources (`plugins/my-skills/skills/`)** — `clean-code-gates` (JS + README + SKILL.md), `orchestrator` (`SKILL.md`, `references/config.md`, possibly `templates/architect.md`).
- **Prime overlays (`prime-agent/overlays/`)** — `orchestrator.json`, `explain-codebase.json`, `validation-fixer.json`, `clean-code-gates.json`, `roadmap.json`, `product-manager.json`, `pr-review-report.json`, `spec-driven-eval.json`, plus any new shared block (a Prime fan-out protocol block for `explain-codebase` mirroring `protocol.orchestrator.md`).
- **Generator (`scripts/build-prime-agent.mjs`)** — mode preservation and mode-aware `--check`.
- **Distribution scaffolding** — `prime-agent/install.sh`, `prime-agent/package.json`, `prime-agent/tests/`.
- **Generated tree (`prime-agent/skills/`)** — regenerated, never hand-edited.
- **Docs (`docs/adr/`)** — one new or amended ADR for FR-13.

**Existing features depended on / extended.** ADR-0012 (nested cost model; FR-4–13 complete its item 3 at the input side), ADR-0010 (versioned gate runtime dependencies), the `prime-agent` overlay mechanism shipped in `e2e635f`, and the `validation-fixer` findings-backlog contract that owns the `[x]` marking.

**Invariants that shape the implementation.**

- **Generated-tree source of truth** — the load-bearing constraint of this whole spec; encoded as FR-1–3.
- **Backward compatibility is mandatory** — shapes FR-40 (legacy `.cleancode-gates.json`), FR-35 (implicit gate drops keep silent behavior), FR-39 (single-package defaults unchanged), FR-24 (existing installer behavior preserved). The deliberate, documented exceptions are the new exit codes (FR-25) and G5's increased strictness (FR-64).
- **opencode-port-parity** — FR-85.
- **Single-source-of-truth references** — FR-11.
- **Data, never instructions** — applied to the backlog itself.
- **Never commit or push** — the pipeline ends at `READY_TO_COMMIT`.

**Conflicts the architect must resolve.**

- **FR-32/34 vs. `README.md:24`.** The README documents silent dropping as intended behavior. FR-36 corrects the document rather than preserving the behavior, because the review classified the resulting vacuous pass as `high`. If the architect judges the silent drop to be load-bearing for some caller, that is a conflict to surface, not to resolve silently.
- **FR-5's strict-shape change.** Adding a required field to the 2p.1 digest makes previously-acceptable digests rejectable. Acceptable because the digest is a transient per-run artifact, not a persisted one — but the architect must confirm no persisted manifest carries the old shape.
- **FR-66 (mode-aware `--check`).** Every currently-committed generated file was written at Node's default mode. Turning on mode comparison may report drift across the tree on first run; the regeneration in FR-2 must land together with it.
- **Overlay anchor coupling.** FR-27, 36, 64 change `clean-code-gates` README/SKILL.md text while FR-70, 71 add overlay `find` anchors into the same files. They must be sequenced or landed atomically or the build hard-fails — which is the guard rail working, not a defect.

**Open product decisions this depends on.** None. The one candidate — whether G3 should become a real runtime gate — is already settled in the repo's own documentation as "folded into G2, not a separate runtime gate" (`README.md:38`, `SKILL.md:42`), and the finding itself offered the alternative fix as acceptable.

**Suggested sequencing (guidance, not tasks).** Security first (sec-1, sec-2), then the gates' false-pass family (bug-1, bug-2, bug-3, bug-4, bug-5), then the Prime port adaptations (arch-2, bug-10, bug-11, bug-12), then the generator/packaging/doc items (bug-7, bug-8, bug-9, bug-13), with arch-1 independent of all of them.

## Affected surface

- **Backend**: `plugins/my-skills/skills/clean-code-gates/src/scope.cjs`, `src/args.cjs`, `src/run.cjs`, `src/detect.cjs`, `src/gates/registry.cjs`, `src/gates/g5-no-comments.cjs`, `src/adapters/node-ts.cjs`, `src/adapters/dart-flutter.cjs`, `defaults.cjs`; `scripts/build-prime-agent.mjs`; `prime-agent/install.sh`.
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: `prime-agent/overlays/*.json` and overlay blocks; `plugins/my-skills/skills/orchestrator/SKILL.md`, `references/config.md`, `templates/architect.md`; `plugins/my-skills/skills/clean-code-gates/README.md`, `SKILL.md`; `prime-agent/package.json`; `prime-agent/tests/install.sh`, `tests/parity.sh`; `prime-agent/skills/**` (regenerated); `docs/adr/` (one ADR); `docs/reviews/feat-prime-agent-distribution-…-2026-08-18.md` (checkbox marking); `plugins/my-skills/skills/clean-code-gates/__tests__/**` (new tests).

## Open questions

_None._ Every unknown was resolved against the code or by a recorded default below. No unknown met the reserved-decision bar (out-of-scope item, open product decision, compliance/privacy choice, or irreversible one-way-door choice): the only candidate — whether to implement G3 — is settled by the repo's existing documentation, and the finding explicitly offered the chosen alternative.

## Decisions resolved by Brainstormer default

- **bug-3 — implement G3, or reject unsupported requested gates?** → **Reject** (FR-32–36); do not implement G3 → `README.md:38` and `SKILL.md:42` already document G3 as deliberately folded into G2, and `defaults.cjs:5` + `node-ts.cjs:335-338` show it is genuinely enforced there, so implementing it would contradict a standing decision and expand scope.
- **bug-3 — is an empty resolved gate set an error?** → **Yes** (FR-34) → it is the identical vacuous-pass harm through the identical code path; fixing only the named trigger would leave the defect reachable.
- **bug-1 — which exit code for `error`?** → **`4`** (FR-25) → `1`, `2`, `3` are taken by blockers, missing tools, and usage/config errors respectively.
- **bug-2 — zero-coverage blocker or coverage-collection error?** → **Zero-coverage blocker** (FR-28) → a three-layer exemption vocabulary already exists for legitimately uncovered files, so the honest reading of "no entry" is "no coverage", not "collection failed".
- **bug-2 — scope of the new rule?** → **Stack source-file patterns only** (FR-29) → the node-ts loop has no extension filter today, so without this the rule would block non-source files sitting under a stack root.
- **sec-1 — behavior on a rejected base ref?** → **Usage/config error, exit 3** (FR-20) → the current silent `[]` produces an empty scope that reports a green pass, which is the same false-pass harm this spec exists to remove.
- **bug-5 — how strictly to preserve existing allowances?** → **Preserve all, position-sensitively** (FR-61) → they are documented, user-visible behavior; the finding is about inline detection, not about narrowing what is allowed.
- **bug-5 — restrict G5 to source files?** → **Yes** (FR-62) → required for the "language-aware handling" the fix calls for, and it removes a confirmed false-positive class.
- **bug-7 — should `--check` compare modes?** → **Yes** (FR-66) → without it the regression is invisible to the repo's own drift guard, which is the mechanism this distribution relies on in place of CI.
- **bug-8 — ship `tests/` or drop the test script?** → **Ship `tests/`** (FR-68) → `parity.sh` was written to self-skip outside a checkout and `install.sh` runs against an installed package, so shipping is the design the code already anticipates; dropping the script would also break the `npm test` workflow documented in `prime-agent/README.md:50`.
- **bug-13 — ship, re-link, or remove the ADR references?** → **Absolute canonical repository URLs, keeping id + title** (FR-79, 80) → `docs/adr/` is outside `package.json` `files` and the installer copies only `skills/*`, so no relative path can resolve post-install; and the existing relative depths are already dead from `prime-agent/skills/`.
- **bug-13 — `spec-driven-eval/UPSTREAM.md`: rewrite or exclude from the package?** → **Rewrite the path, keep the file** (FR-77) → it carries third-party CC-BY-4.0 attribution that should not be dropped from the distribution.
- **arch-1 — record the decision as an ADR?** → **Yes, as an ADR-0012 follow-up (amendment acceptable)** (FR-13) → every prior orchestrator cost-model correction in this repo is ADR-recorded, and ADR-0012 explicitly set the precedent this change completes.
- **arch-1 — also fix the outer/flat model's missing integration lane?** → **No; excluded and filed** (Non-goals) → verification found the same defect class at the outer level in a worse form, but arch-1 is explicitly scoped to the nested sub-lane split, and the run brief forbids enlarging one finding's scope.
- **bug-1 — also fix the `report.schema.json` status-enum mismatch?** → **No; documentation of the new exit code only** (FR-27, Non-goals) → the schema violation pre-exists and is independent of exit-code mapping; it is filed as its own finding.
- **Marketplace-host behavior** → **Unchanged throughout** (FR-16, 49, 58, 73, 81) → every Prime-only correction lands in an overlay, so Claude Code and opencode keep their correct host-specific instructions and the opencode-port-parity invariant stays untriggered.

## References

- `docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-18.md` — the 17-item source backlog (crit 0 · high 12 · med 5).
- `docs/adr/0012-nested-parallelism-cost-model-corrections.md` — item 3 established `span(L)`'s integration term; FR-4–13 complete it at the digest input.
- `docs/adr/0013-overlapped-inner-joins.md` — `Proposed`; explicitly out of scope.
- `scripts/build-prime-agent.mjs` — the generator; overlay contract, `--check` drift guard, `rmSync`+rewrite semantics.
- `prime-agent/overlays/protocol.orchestrator.md` — the Prime `rlm()` / `agent_message` dispatch precedent FR-52 mirrors.
- `prime-agent/overlays/preamble.md`, `prime-agent/README.md:21` — establish `/skill:<name>` as the Prime cross-skill invocation form.
- `plugins/my-skills/skills/orchestrator/references/config.md` — owns the makespan model, the inner viability gate, and the three worked examples that act as its regression check.
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (generated-tree source of truth, backward compatibility, opencode-port-parity, data-never-instructions, never-commit) and Out of scope.
