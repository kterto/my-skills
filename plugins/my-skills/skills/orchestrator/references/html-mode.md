# Orchestrator — html-mode Steps Reference

**Read this file only when `output_format=html`.** Both steps below are skipped entirely in `md`
mode — there are no `.html` artifacts to render, pair or link-check — which is why they live here
rather than in `SKILL.md`: the default `md` run should not read a branch it never takes.

**One line inside Step 7d is not html-only, and it is the single exception on this page.**
`check-artifact-home.cjs` gates *where* an artifact was written, which is a question every run
answers, so it runs in `md` mode too; it is listed in Step 7d because that is where the other two
gates already run, and `SKILL.md` → Step 7 is its site on the `md` path. Nothing else in this file
executes in `md` mode.

**Orchestrator-only, and deliberately not materialized.** These are steps the orchestrator runs
itself, not rules a role obeys, so B3 does not copy this file into `.orchestrator/` the way it copies
`artifact-format-html.md`. Read it from the skill directory. The rules roles follow when they render
their own artifacts stay in `.orchestrator/artifact-format-html.md`, unchanged.

Both steps run after `SKILL.md` → *Step 7b — Final report composer* has persisted the report, and
Step 7d gates the completion banner. Return to `SKILL.md` when they are done.

## Step 7c — Progress timeline (html mode)

When `output_format=html`, after the pipeline reaches a terminal state, render a progress timeline for **every plan-shaped artifact the run produced** — not only the active one — by running the renderer on each `.progress.md` append-log:

```bash
node .orchestrator/render-artifact.cjs {run_dir}/<ID>-<slug>.progress.md
```

**Every one of those logs is flat inside this run's own folder**, so each path is `{run_dir}` — the folder minted at Step 0 pre-flight, recorded in the manifest and sent to every role on the preamble's `run_dir=` line — concatenated with the ID the manifest names. There is no directory to resolve, no `plans/<kind>/` hop, and nothing to search for. On a resumed run `run_dir` is the manifest's value rather than the folder this session minted (Step 0r item 4), which is the whole point of recording it. The one exception is a resumed **legacy** run, whose manifest carries no `run_dir` field at all: its artifacts predate this layout and sit in the frozen kind directories, so locate each recorded ID with the quoted recursive `find` that same item specifies, never a shell glob.

**Render the whole set, from the run manifest.** Every artifact the architect creates gets a paired `.progress.md` (Step 2c, 2s, 2L, and each `FIX`/`QAF`), and Step 7d's pairing gate requires an `.html` sibling for **every** branch-added `plans/**.md` — a `.progress.md` included. Rendering only the active plan therefore leaves every other log unpaired, so **an `html` run on the parallel path could never pass its own blocking gate**. The set to render is:

- the **parent contract** and, on a `full` run, **every sub-contract** (`contract_ids` in `.orchestrator/run-manifest.json`);
- **every leaf plan** (`leaf_ids`), including the integration leaves;
- **every `FIX` and `QAF` plan** produced by the review and QA loops;
- on a sequential run this collapses to the single active plan — the previous behavior, unchanged.

The manifest is the enumeration source precisely because it already holds the run's complete artifact set (Step 0r → *The run manifest*); a directory scan would also sweep in artifacts from earlier runs on the branch, which this step must not re-render.

The renderer auto-selects the `progress-timeline` scaffold for a `*.progress.md` source, emits one timeline row per log entry (role → action/status → timestamp) with the status→pill mapping, fills the `<main data-*>` shell and the Related link to the plan, and writes `<plan-path-without-.md>.progress.html`. `.progress.md` stays the markdown source-of-truth log; the `.html` is a regenerated read-only view.

This step ALSO runs at the STALLED/BLOCKED stop points (review-cycle limit, qa-cycle limit, spec-eval-cycle limit, tester BLOCKED, qa BLOCKED_STALE) so a halted run still produces a timeline — and there too it renders the **whole** manifest set, since a `PARTIAL` parallel run has exactly the same unpaired-log problem. In `md` mode this step is skipped — `.progress.md` is the only progress artifact. **The family-budget stop is not on that list**, and deliberately: it fires before the workspace gate, which is before the run folder is minted and before the manifest this step enumerates from exists. There is nothing to render and nothing to clean up — `$run_dir` is not yet bound.

## Step 7d — Artifact validation gates (html mode — blocking)

When `output_format=html`, after Step 7b persists the final report and BEFORE printing the `pipeline complete` banner, run the two html artifact gates over the branch's artifacts. They are shell-free and fail closed, so a green verdict is trustworthy. **The home gate is not one of them and must not be repeated here** — Step 7b has already run `check-artifact-home.cjs` unconditionally, in both modes, because it audits a path rather than a render:

```bash
node .orchestrator/check-artifact-pairing.cjs   # branch-added plans/**.md each have a .html sibling + the 5 required frontmatter keys
node .orchestrator/check-artifact-links.cjs     # every local link in a branch-added plans/**.html resolves on disk
```

**The home gate is the one gate in this block that is not an html-mode gate, and it runs first.** Its scope is the branch's added and modified `.md` under `plans/`, which exist in **both** modes, where pairing and links have nothing to check until a render has produced an `.html` — so it runs on **every** run, `md` and `html` alike. It appears here because this is where the other two already run and an `html` run must not run it twice; **on an `md` run the orchestrator runs it at `SKILL.md` → Step 7, at this same point before the completion banner**, since this file is not read at all in `md` mode. Running it first is not arbitrary: an artifact written one level too deep is precisely what turns a valid `href="../../docs/adr/015.md"` into the `1 broken local link(s)` the link gate reports, so the home gate names the cause where the link gate can only show the symptom.

- If all three print `<gate>: OK` and exit 0 → proceed to the banner.
- If any exits non-zero → it lists the offending artifacts. A red **pairing** or **links** gate almost always means a `.md` was written without its renderer pass (missing `.html` sibling), a `.md` is missing a required frontmatter key, or a report links to an artifact that was never rendered: **re-render the named artifacts** (`node .orchestrator/render-artifact.cjs <artifact.md>`) or fix the frontmatter, then re-run the failing gate. A red **home** gate means an artifact landed somewhere the layout does not allow — a kind subdirectory inside a run folder, a `plans/runs/` wrapper, a new top-level directory a typo created, or a legacy kind directory written into again. **Move the named file into the run folder its role's `run_dir=` names and re-render it there; never create the directory it landed in**, which is how one typo becomes a convention nothing can later tell from an intentional one. Do **NOT** print the `pipeline complete` banner while any gate is red — a red gate is the html-mode analogue of the file-verification guard in Step 7b.

If the pipeline halts at a STALLED/BLOCKED stop point (so no final report is produced), the gates are skipped — there is no completion banner to guard. In `md` mode this step is skipped entirely: there are no `.html` artifacts to pair or link-check, and the home gate is not skipped with them — it is not an html-mode gate at all, and Step 7 runs it on that path.
