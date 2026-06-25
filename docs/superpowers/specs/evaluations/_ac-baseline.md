# AC Baseline — product-manager Skill Design

Source PRD: `docs/superpowers/specs/2026-06-23-product-manager-skill-design.md`

Checklist frozen for evaluations of the product-manager skill implementation. One story is inferred because the PRD is a single-feature design document with no explicit story priorities.

Story: `product-manager` autonomous roadmap executor
Priority: ASSUMED P0

## AC1 — Purpose, Invocation, Config, And Boundaries

PRD refs: Purpose, Non-goals, Invocation.

I-checks:
- I1. Defines product-manager as the glue/action skill that runs roadmap stories via orchestrator, then commits, syncs, pushes, and opens PRs.
- I2. Documents `/product-manager complete <scope> [--conservative=true|false] [--base <branch>] [--dry-run]` with the allowed scope forms.
- I3. Defines `conservative=true` as default and documents `--base` and `--dry-run` behavior.
- I4. Defines config precedence `CLI flag > /roadmap/pm.config.json > built-in default` and the relevant config keys.
- I5. Preserves the non-goals: no orchestrator bootstrap, no roadmap build/re-eval, no PR merge, no specs/plans/code authored by PM.

T-checks:
- T1. Structural verification asserts frontmatter/name and invocation/config text exist.
- T2. Structural verification or review asserts non-goal/boundary text exists.

## AC2 — Pre-flight And Run Authorization

PRD refs: Pre-flight, Invocation.

I-checks:
- I1. Requires `/roadmap/roadmap.lock.json`, `.orchestrator/config.json`, clean working tree, and `gh` before execution.
- I2. Resolves scope, filters `done`/`superseded`, and topologically sorts by `depends_on` then `sequence` before the loop.
- I3. Prints the queue, mode, and git plan before asking for one up-front confirmation that authorizes per-story push/PR creation.
- I4. Implements `--dry-run` as print queue/git plan and exit without confirmation or execution.
- I5. Handles unmet out-of-scope dependencies according to conservative vs autonomous mode.

T-checks:
- T1. Structural verification asserts pre-flight required terms and confirmation text exist.
- T2. A dry-run walkthrough verifies scope resolution reaches printed plan and stops before mutation.
- T3. A scenario or structural check verifies out-of-scope dependency behavior is specified.

## AC3 — Scope Resolution And Ordering

PRD refs: Scope resolution, Compatibility.

I-checks:
- I1. Reads roadmap lock items and user-story files/frontmatter for the fields PM needs.
- I2. Maps `roadmap`, milestone id/slug/bare ordinal, and phase id to the correct candidate stories.
- I3. Rejects unmatched scope and reports valid scope ids.
- I4. Builds a dependency graph, topologically sorts it, breaks ties by sequence, and reports cycle ids.
- I5. Checks dependencies outside the resolved scope and records/warns/stops as specified by mode.

T-checks:
- T1. Structural verification asserts the scope-resolution reference contains the key scope/order/status terms.
- T2. A scenario or walkthrough verifies at least one milestone dry-run path.
- T3. A scenario or structural check verifies unmatched scope/cycle/out-of-scope dependency behavior.

## AC4 — Per-story Orchestration And Git/PR Flow

PRD refs: Per-story loop, Error handling, File layout.

I-checks:
- I1. Resolves the story base: latest in-scope dependency branch when dependent, otherwise the run base.
- I2. Cuts a deterministic `pm/<id>-<slug>` story branch.
- I3. Invokes the orchestrator with the story `## Brief` passed verbatim.
- I4. Reads orchestrator terminal output and proceeds on success or stops the whole run on stalled/blocked outcomes while preserving completed work.
- I5. Commits implementation changes with the orchestrator commit message and `Roadmap-Story: <id>` trailer.
- I6. Runs `/roadmap sync` only after the trailer commit exists and guards against trailer mismatch.
- I7. Commits roadmap sync docs separately with no story trailer and leaves the tree clean before the next story.
- I8. Pushes the story branch and opens a PR with the correct `--base`, `--head`, and rendered PR body.
- I9. Opens stacked PRs in queue order and continues through the scoped queue until completion or a stop condition.

T-checks:
- T1. Structural verification asserts branch naming, trailer, sync, and `gh pr create --base` are present.
- T2. Pointer audit or walkthrough verifies SKILL.md references the git-flow sections used by the loop.
- T3. A scenario or walkthrough verifies the full success path including sync, log writes, push, and PR creation.

## AC5 — Human Validation Handling

PRD refs: Human validation.

I-checks:
- I1. Scans the story `## Acceptance` section for the specified marker list case-insensitively before the run.
- I2. Scans the orchestrator QA report after the run for manual-validation indicators.
- I3. Ensures flagged stories are still fully implemented, committed, synced, pushed, and PR'd.
- I4. In conservative mode, halts after completing the flagged story and surfaces the story id, PR link, and validation items.
- I5. In autonomous mode, appends to `/roadmap/human-validation-queue.md`, adds a PR-body note, and continues.
- I6. Ensures validation queue entries and conservative validation requests can include the PR URL they promise.

T-checks:
- T1. Structural verification asserts marker list, invariant, queue path, and `--conservative=false` text exist.
- T2. A scenario or walkthrough verifies conservative flagged-story behavior.
- T3. A scenario or walkthrough verifies autonomous flagged-story behavior and PR-note rendering.

## AC6 — Logging And Resume

PRD refs: Logging, Resume.

I-checks:
- I1. Maintains append-only `/roadmap/pm-progress.md` with actor `product-manager` and one row per story attempt.
- I2. Defines all required log fields: `when`, `story`, `base`, `branch`, `state`, `commit`, `pr`, `human_validation`, and `notes`.
- I3. Provides a feasible ordering for writing the log row with the actual PR URL for successful story attempts.
- I4. Resumes without extra state by re-resolving scope and skipping `done`/`superseded` stories.
- I5. Reconstructs stacked branches from deterministic branch naming and handles missing done predecessor branches.

T-checks:
- T1. Structural verification asserts log path, actor, restart-safe text, and template tokens exist.
- T2. A scenario or walkthrough verifies log row rendering with the expected field values.
- T3. A scenario or walkthrough verifies resume behavior after a partial run.

## AC7 — File Layout, Discoverability, And Compatibility

PRD refs: File layout, Compatibility.

I-checks:
- I1. Creates the required `product-manager` skill root, four reference files, and two templates.
- I2. Makes the skill discoverable through the plugin mechanism or documents that auto-discovery applies.
- I3. Documents compatibility with roadmap output and orchestrator input/final-report contracts.

T-checks:
- T1. Structural check verifies all required files exist.
- T2. Pointer audit verifies SKILL.md reference links resolve to real sections/files.
- T3. Discovery check verifies no missing manifest entry is required or the manifest is updated.
