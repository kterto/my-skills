# Orchestrator — html-mode Steps Reference

**Read this file only when `output_format=html`.** Both steps below are skipped entirely in `md`
mode — there are no `.html` artifacts to render, pair or link-check — which is why they live here
rather than in `SKILL.md`: the default `md` run should not read a branch it never takes.

**Orchestrator-only, and deliberately not materialized.** These are steps the orchestrator runs
itself, not rules a role obeys, so B3 does not copy this file into `.orchestrator/` the way it copies
`artifact-format-html.md`. Read it from the skill directory. The rules roles follow when they render
their own artifacts stay in `.orchestrator/artifact-format-html.md`, unchanged.

Both steps run after `SKILL.md` → *Step 7b — Final report composer* has persisted the report, and
Step 7d gates the completion banner. Return to `SKILL.md` when they are done.

## Step 7c — Progress timeline (html mode)

When `output_format=html`, after the pipeline reaches a terminal state, render a progress timeline for **every plan-shaped artifact the run produced** — not only the active one — by running the renderer on each `.progress.md` append-log:

```bash
node .orchestrator/render-artifact.cjs plans/<dir>/<ID>-<slug>.progress.md
```

**Render the whole set, from the run manifest.** Every artifact the architect creates gets a paired `.progress.md` (Step 2c, 2s, 2L, and each `FIX`/`QAF`), and Step 7d's pairing gate requires an `.html` sibling for **every** branch-added `plans/**.md` — a `.progress.md` included. Rendering only the active plan therefore leaves every other log unpaired, so **an `html` run on the parallel path could never pass its own blocking gate**. The set to render is:

- the **parent contract** and, on a `full` run, **every sub-contract** (`contract_ids` in `.orchestrator/run-manifest.json`);
- **every leaf plan** (`leaf_ids`), including the integration leaves;
- **every `FIX` and `QAF` plan** produced by the review and QA loops;
- on a sequential run this collapses to the single active plan — the previous behavior, unchanged.

The manifest is the enumeration source precisely because it already holds the run's complete artifact set (Step 0r → *The run manifest*); a directory scan would also sweep in artifacts from earlier runs on the branch, which this step must not re-render.

The renderer auto-selects the `progress-timeline` scaffold for a `*.progress.md` source, emits one timeline row per log entry (role → action/status → timestamp) with the status→pill mapping, fills the `<main data-*>` shell and the Related link to the plan, and writes `<plan-path-without-.md>.progress.html`. `.progress.md` stays the markdown source-of-truth log; the `.html` is a regenerated read-only view.

This step ALSO runs at the STALLED/BLOCKED stop points (review-cycle limit, qa-cycle limit, spec-eval-cycle limit, family budget exhausted at pre-flight, tester BLOCKED, qa BLOCKED_STALE) so a halted run still produces a timeline — and there too it renders the **whole** manifest set, since a `PARTIAL` parallel run has exactly the same unpaired-log problem. In `md` mode this step is skipped — `.progress.md` is the only progress artifact.

## Step 7d — Artifact validation gates (html mode — blocking)

When `output_format=html`, after Step 7b persists the final report and BEFORE printing the `pipeline complete` banner, run both artifact gates over the branch's artifacts. They are shell-free and fail closed, so a green verdict is trustworthy:

```bash
node .orchestrator/check-artifact-pairing.cjs   # branch-added plans/**.md each have a .html sibling + the 5 required frontmatter keys
node .orchestrator/check-artifact-links.cjs     # every local link in a branch-added plans/**.html resolves on disk
```

- If both print `<gate>: OK` and exit 0 → proceed to the banner.
- If either exits non-zero → it lists the offending artifacts. This almost always means a `.md` was written without its renderer pass (missing `.html` sibling), a `.md` is missing a required frontmatter key, or a report links to an artifact that was never rendered. **Re-render the named artifacts** (`node .orchestrator/render-artifact.cjs <artifact.md>`) or fix the frontmatter, then re-run the failing gate. Do **NOT** print the `pipeline complete` banner while a gate is red — a red gate is the html-mode analogue of the file-verification guard in Step 7b.

If the pipeline halts at a STALLED/BLOCKED stop point (so no final report is produced), the gates are skipped — there is no completion banner to guard. In `md` mode this step is skipped entirely (no `.html` artifacts exist to pair or link-check).
