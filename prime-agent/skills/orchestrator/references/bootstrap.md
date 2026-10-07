# Orchestrator — Bootstrap Reference

## Prime Agent orchestration protocol (supersedes host-specific dispatch below)

Under Prime Agent, run every **role** as a real RLM child — **never** map a role
to `subagent_type`, `Agent`, `task`, or a file in `.claude`/`.opencode`. The
read-only scan child is admitted the same way, with its own stable name, and
still obeys the read-only rule stated below.
Materialize the role templates and runtime resources under `.orchestrator/` as
described here; role files belong in `.orchestrator/roles/{role}.md`. For each
dispatch, build a self-contained prompt containing: the role body, user task,
locked decisions, context/artifact paths, allowed path ownership, verification
commands, and this completion contract:

```python
await agent_message.send(
    "STATUS: <status>\nARTIFACT: <path>\nSUMMARY: <concise result>",
    receiver_role="parent",
)
```

Start it with `handle = await rlm(prompt, name="<stable-role-or-lane-name>")`.
`rlm()` returns only an admission handle, never the child result. The parent waits
for the child's `agent_message`, validates its named artifact, and retries an
incomplete child with `agent_message.send(..., receiver_role="child",
receiver_name=handle.name)`, where `handle` is that child's admission handle —
the one `rlm()` returned, or the one taken out of `by_name` for a wave.

For independent lanes/waves, admit all children at once — where `jobs` is a
**list** of `(name, prompt)` pairs, one per child, built before the call, a list
and not a generator because the fence reads it twice — **binding the handles as
you go** so each one stays reachable:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Then join only after every required completion message and artifact validation.

For a clarification, a child messages its parent with `STATUS: QUESTION`; the
parent asks the user in the normal conversation and sends the answer back to that
child. The Prime parent itself asks normal conversational questions instead of
using `AskUserQuestion`/`question`. A read-only scan child must be explicitly
forbidden from writes and mutating commands. These Prime rules supersede every
Claude/opencode-specific call example and output-parsing instruction below; all
pipeline gates, artifacts, retry caps, and path-ownership rules still apply.

**Read this file only when Bootstrap is triggered.** `SKILL.md` → *Lifecycle — auto-detect* decides
that, and an ordinary run never opens this file: the three steps below run when `--setup` is passed,
when `.orchestrator/config.json` is absent, when `.orchestrator/.materialized-version` is absent or
differs from the skill's `MATERIALIZED-VERSION`, or when any file B3 materializes is missing. Everything
here was inline in `SKILL.md` until it was split out for exactly that reason — an already-bootstrapped
project paid ~14KB of setup protocol on every run to read a branch it never took.

**Read it from the skill directory, not from `.orchestrator/`.** B3 is what creates that directory,
so this reference cannot live inside its own output. It is deliberately **not** in B3's materialized
set: no role reads it, only the orchestrator does, and only on the runs that bootstrap.

It has three steps: B1 context gate, B2 dependency check, B3 materialize.

## B1 — Context gate

> **Already curated?** If `.orchestrator/PROJECT-CONTEXT.md` exists and carries all nine
> required headings from `references/context-schema.md`, **skip steps 1–4**: report the
> coverage you measured and continue to B2. Do not re-interview. That file is written by
> the `context-builder` skill, which runs before this one and converges with the user
> (ADR-0023). Re-running the gate here would ask the same questions a second time and
> then discard its own answer at step 5, which never overwrites an existing file. When
> the file is absent, or present but missing a required heading, run steps 1–4 as
> written.

1. **Context scan** (the only child in the gate): admit a **read-only scan child** named `context-scan` (see *The read-only scan subagent type* below) with the prompt:
   > "Scan this repo and return a structured digest of stack, build/test/lint/e2e/coverage commands, directory layout, naming conventions, and any documented domain rules. Read CLAUDE.md, AGENTS.md, README, and config/manifest files."
   Collect the digest.

2. **User-question interview**: using the digest, call the host's structured question tool (`AskUserQuestion` in Claude Code, `question` in opencode) to ask the user only about sections of `context-schema.md` that the scan left ambiguous. Do not ask about sections the scan already covered clearly.

3. **Self-rate confidence**: after each interview round, rate holistic confidence (0–1) that the context is clear and complete across all required sections.

4. **Loop**: repeat steps 2–3 until confidence ≥ `context_threshold`. If the user ends the loop early, record the achieved confidence as-is.

5. **Write PROJECT-CONTEXT.md**: render `templates/PROJECT-CONTEXT.template.md` into `.orchestrator/PROJECT-CONTEXT.md`, filling every section with the information gathered. **Never overwrite an existing `PROJECT-CONTEXT.md`** — a bootstrap re-run on an upgrade would otherwise destroy a curated file: when one is already present, leave it, report which required headings it is missing, and let the user fill them. Observe the template's size budget on a file you are creating: keep the rule inline, move a section that has grown into an explanation to its own file and link it. Every `##` heading in the template corresponds to a required section in `references/context-schema.md`; all must be present.

## B2 — Dependency check

`spec-driven-eval` ships with this Prime Agent distribution. Check that it is
available in the installed Prime skill paths (`.prime/agent/skills/spec-driven-eval`
for a project install, `~/.prime/agent/skills/spec-driven-eval` for a global one).
If it is absent, report that the Prime Agent installation is incomplete — rerun
`prime-agent/install.sh` — and continue without blocking: Step 4e handles a missing
skill gracefully. Do **not** try to install a skill from an external marketplace.

Record availability for the current run.

**Check for a `.cleancode-gates.json` governing this project.** It is the single source of every
numeric gate threshold — the tester reads `G1` from it, QA reads `G1`/`G2`/`G6` from it, and neither
the architect nor any plan may author a threshold anywhere else. Look at the repo root **and at each
package root** (`apps/*/`, `packages/*/`): the runner loads the config from the directory it runs in,
so a monorepo whose packages each carry one is the normal case, and a repo-root aggregate sitting
beside per-package files governs nothing. Record which file governs which package in
`PROJECT-CONTEXT.md`.

It is written and owned by the `clean-code-gates` skill, and its **first ordinary run writes it** from
the stacks it detects. `--scaffold` is advice-only and creates nothing — never cite it as the way to
get the file. If none is found, say so and offer to run `clean-code-gates` once against the project to
materialize one.

Do **not** block bootstrap and do **not** hand-write a default file: the roles degrade explicitly on
its absence (the tester reports `BELOW_FLOOR` naming the path it looked for, QA reports every numeric
gate `MISSING_TOOL`), which is the honest outcome — a threshold nobody configured looks authoritative
and is not. When a config **is** present and `PROJECT-CONTEXT.md` also states a coverage, complexity,
or mutation number, print those lines and say the config supersedes them.

Check for a resolvable **`simplify`** skill the same way, and record its availability too. It ships with this Prime Agent distribution, so `install.sh` already satisfies it; a session that provides its own `simplify` satisfies it equally. When none resolves, print one line saying the pre-review simplification pass will be skipped — do **not** offer to install anything and do **not** block bootstrap. Steps 3 and 3j degrade explicitly on it.

## B3 — Materialize

1. **Render role templates**: materialize each of the six files `templates/{role}.md` (roles: brainstormer, architect, coder, tester, reviewer, qa) into `target/.orchestrator/roles/{role}.md`, copying each template **body verbatim** — no frontmatter rewriting, no host-specific agent file. Prime Agent has no `.claude/agents/` or `.opencode/agent/` registry to write into: a role is dispatched by building a self-contained prompt from its `.orchestrator/roles/{role}.md` body and admitting it with `rlm()`, per the Prime Agent orchestration protocol above. Re-render all six on every bootstrap (including `--setup` re-runs) so they stay in sync with the installed skill version. The templates are project-agnostic and read `.orchestrator/PROJECT-CONTEXT.md` at runtime.

   **Preserve a project's deliberate frontmatter overrides when re-rendering.** If a role file already exists and its frontmatter carries keys the template does not — a pinned `model:`, a host-specific field — carry those keys forward onto the new body rather than dropping them. Bootstrap now re-runs whenever a materialized file is missing **or the version stamp differs** (Lifecycle item 2), so this step overwrites role files on every upgrade, not just on first setup — the stamp moves on every release that touches the materialized set, which is precisely when a project has a hand-pinned key to lose: silently reverting a project's model pin would be a regression the project never asked for and would not notice until a run cost more than it should. Replace the **body** always; merge the **frontmatter**. A key the template also defines wins from the template — the local copy is stale by definition — **except `model:`, where a local value wins over the template's.** A model is the one frontmatter key a project sets against its own cost and host constraints rather than against the role's protocol: opencode needs a provider-qualified value where the template carries Claude shorthand, and a template that overwrote it would silently re-point every run at a model the project had already ruled out.

2. **Materialize artifact rules + config reference + html scaffolds + render scripts (load-bearing).** Subagents cannot read the skill's own `references/`, `templates/html/`, or `scripts/` directories — those paths do not exist in the target project. Copy them into `.orchestrator/` so every role can read and run them:
   - `references/artifact-format.md` → `.orchestrator/artifact-format.md` (the core rules every role reads before writing any artifact — the `md` artifact, the directory allow-list, the run family, ID allocation, Related navigation, and the stdout header contract)
   - `references/artifact-format-html.md` → `.orchestrator/artifact-format-html.md` (the html rendered view and its two blocking validation gates; read only when `output_format=html`)
   - `references/artifact-format-parallel.md` → `.orchestrator/artifact-format-parallel.md` (the `PACT` contract, sub-contracts, inherited interface assignments, `PACT` ID resolution, and the additive parallel stdout lines; read only when the resolved `parallelism` is not `off`)

     **The split is why the core file is worth reading in full.** Every role loads
     `artifact-format.md` before writing anything, and on the default `md` sequential run the html
     and parallel content governs nothing — it was 52% of the file. Splitting it costs a pointer and
     removes that from every spawn. **Section names did not change**, so every existing
     cross-reference of the form `artifact-format-parallel.md` → *`PACT` ID resolution* still names its
     section; it now lives in the file the pointer names.
   - `references/config.md` → `.orchestrator/config.md` (the normative key/lane/glob reference the role templates point at; distinct from `.orchestrator/config.json`, which holds the resolved *values*)
   - `references/lane-protocol.md` → `.orchestrator/lane-protocol.md` (the architect's contract authoring and lane-plan mode, and the coder's lane boundary and BLOCKED vocabulary — read only by a role whose preamble carries `lane=` or `Type: contract`, which is why it is not in their templates)
   - `references/gate-config.md` → `.orchestrator/gate-config.md` (how any role resolves a gate's config, scope, exemptions, and verdict vocabulary — normative for the coder, the tester, and QA alike, which is what stops the three of them drifting apart on the same gate)
   - `templates/html/*.template.html` → `.orchestrator/html-templates/` (all seven: spec, plan, test-report, code-review, qa-report, final-report, progress-timeline)
   - `scripts/render-artifact.cjs`, `scripts/check-artifact-pairing.cjs`, `scripts/check-artifact-links.cjs`, `scripts/check-artifact-home.cjs`, `scripts/gate-scope.cjs`, `scripts/index-plans.cjs`, `scripts/run-state.cjs` → `.orchestrator/` (the seven runtime `.cjs`; do NOT copy the `*.test.cjs` files or `scripts/README.md`). These are zero-dependency Node scripts — no `npm install` needed. The renderer resolves the scaffolds from the sibling `.orchestrator/html-templates/`, so copy step-2 scaffolds and these scripts together. **`check-artifact-home.cjs` guards the layout itself**: it fails a branch whose added or modified artifact under `plans/` sits anywhere but flat inside a run folder or inside one of the seven frozen legacy kind directories, at a depth of exactly 2. That allow-list has been normative for this project's entire life and was never once machine-checked — bootstrap runs zero `mkdir`, so a directory comes into being as a side effect of the first write into it, and one typo in a role's write path silently creates a directory under `plans/` that reads as intentional forever after, because no listing distinguishes a mistake from a convention. It runs in **both** `md` and `html` mode, unlike the pairing and link gates, and it `require`s `gate-scope.cjs` from beside it for its branch scope exactly as they do — which is the second reason these scripts travel together rather than one at a time. `run-state.cjs` keeps the run's resume point, pending decision and budget raises under `.orchestrator/runs/` (`SKILL.md` → *Lifecycle — auto-detect*). `index-plans.cjs` generates `plans/index.html` — a family-grouped, browsable view over `plans/` that answers "what happened to feature X" without opening a directory listing — and Step 7 regenerates it at the end of every run, which it can only do once this step has put the script somewhere the run can reach it. It walks `plans/` at whatever depth it finds rather than assuming a shape, so a project's per-run folders and its frozen legacy `plans/<kind>/` directories index side by side; the unit it groups by is the **family**, never the folder, because a feature's story spans two to four runs and 94% of families use more than one slug.

   Re-copy all eight on every bootstrap (including `--setup` re-runs) so they stay in sync with the installed skill version. If the scaffolds/scripts are missing, `output_format=html` silently degrades to md because roles cannot render the `.html`.

   **Pin the engine**: after the copies above and before item 5's stamp, run `node <this skill's directory>/scripts/pin-engine.cjs "$(git rev-parse --show-toplevel)"`. Use the directory these files are copied from, never `$CLAUDE_PLUGIN_ROOT`, which the shell does not have. It replaces `.orchestrator/engine/` with the sibling `clean-code-gates` skill's runtime files; list `.orchestrator/engine/` in item 6's summary. If it exits non-zero, print its message and continue: the stamp is still written, and roles report the engine missing (`templates/qa.md` Step 3) until the setup is re-run with the skill installed whole.

3. **Write the state-tracking contract** (`.orchestrator/.gitignore`). Bootstrap materializes run state and skill copies into the same directory a human keeps `config.json` and `PROJECT-CONTEXT.md` in, so the project cannot tell them apart unless this file says so. Write it as an **allow-list** — everything under `.orchestrator/` is ignored unless named — so a state file added by a *later* skill version defaults to ignored instead of silently entering the next feature commit:

   ```gitignore
   # --- BEGIN orchestrator-managed (rewritten on every bootstrap) ---
   # Allow-list. Ignored by default; tracked only by explicit exception below.
   *
   !*/
   !.gitignore
   !config.json
   !flash-config.json
   !PROJECT-CONTEXT.md
   !eval-baselines/**
   # --- END orchestrator-managed ---
   # Project additions go below this line; bootstrap preserves them.
   ```

   `*` ignores every file; `!*/` lets git descend into subdirectories so the exceptions below can re-include paths inside them (without it, an excluded parent directory makes re-inclusion impossible). **Rewrite only the region between the markers**, preserving anything the project added underneath — the same "the project's choice wins" shape step 4 uses for `config.json` keys. If the markers are absent and the file exists, prepend the managed block rather than overwriting.

   **What is tracked, and why only these.** `config.json` must be tracked: Step 0b reads the three execution-policy keys and the six instrument keys (`references/config.md` → *The anchored set*) from the **merge-base** copy (`$mb:.orchestrator/config.json`), so an untracked file makes all nine unreachable and they fail closed to defaults forever — which silently returns every cycle cap and gate bound to a value the branch cannot be held to. `PROJECT-CONTEXT.md` is hand-curated shared project knowledge that a teammate's fresh clone must already have. Everything else is either **per-run state** (`run-manifest.json`, `verification-ledger.json`, `tmp/`) — branch-scoped, rewritten whole each run, and therefore unmergeable — or a **copy of the installed skill** (`artifact-format.md` and its `-html` / `-parallel` companions, `config.md`, `gate-config.md`, `lane-protocol.md`, `html-templates/`, the seven `.cjs`, the rendered role files), which Lifecycle item 2 re-materializes the moment it goes missing. Tracking the copies lands a four-figure diff in a product PR on every skill upgrade; ignoring them costs nothing, because a fresh clone missing them simply triggers bootstrap.

   **`flash-config.json` is tracked for the same reason `config.json` is, minus one.** It is hand-authored project policy — whether `orchestrator-flash` reviews at all, how many rework cycles it allows, whether it interviews — and a teammate's fresh clone has to inherit it or the project silently reverts to defaults on their machine. The `config.json` merge-base argument does **not** apply: flash reads its config from the working tree on purpose and anchors nothing. The inheritance argument alone is enough. Note especially that flash's config template deliberately does **not** write the `interview` key, so a project that pins it did so by hand — the exact class of decision an untracked file loses.

   **`flash/` stays ignored**, and that is not an oversight: everything in it is a copy of the installed skill, re-materialized the moment its stamp goes stale, so it is the same case as `artifact-format.md` and the seven `.cjs` — and flash's stamp moves more often than the orchestrator's, because its whole role set is seven small files that change together.

   **This file is additive, never destructive.** `.gitignore` has no effect on paths git already tracks, so writing it into a project that currently commits its run state changes nothing on its own. Say so in the summary and print the one-line remedy rather than running it — the orchestrator never mutates the index:

   ```
   .orchestrator/run-manifest.json and .orchestrator/verification-ledger.json are tracked
   but are per-run state. To stop committing them (history is untouched):
     git rm --cached .orchestrator/run-manifest.json .orchestrator/verification-ledger.json
   ```

4. **Write config**: merge `templates/config.template.json` with any CLI overrides (precedence: CLI arg > `.orchestrator/config.json` > default) and write the result to `.orchestrator/config.json`.

   **On a re-run, an existing `.orchestrator/config.json` wins over the template for every key it sets.** The template contributes only keys the project does not already have — a new setting added by a later skill version, at its default. Bootstrap re-runs on upgrades now (Lifecycle item 2), so treating the template as authoritative here would silently reset a project's `parallelism`, its `lanes`, and its `agent_sync_targets` back to defaults, turning a self-healing upgrade into a configuration loss the project would discover only by watching a run behave differently.

5. **Stamp the materialized version — last, after everything above has succeeded**: copy the skill's `MATERIALIZED-VERSION` file (the one-line digest sitting beside the skill's own `SKILL.md`) verbatim into `.orchestrator/.materialized-version`. **The stamp must be written after every other materialization in B3 has succeeded, never before**: a stamp written ahead of the copies it vouches for would mark a half-materialized project as current, so a crash mid-materialize has to leave the stamp stale and re-trigger bootstrap on the next run rather than certify the wreckage.

   `.orchestrator/.materialized-version` is **per-project state, not tracked** — it describes one checkout's materialization, not a fact a teammate should inherit, and the step-3 allow-list already ignores it by default because nothing names it. A fresh clone therefore arrives without it, which is the intended behaviour: the missing stamp simply re-bootstraps, exactly as the missing skill copies it accompanies do.

6. **Print bootstrap summary**: list all created/updated paths (including `.orchestrator/.gitignore`, `.orchestrator/roles/`, `.orchestrator/artifact-format.md`, `.orchestrator/artifact-format-html.md`, `.orchestrator/artifact-format-parallel.md`, `.orchestrator/config.md`, `.orchestrator/gate-config.md`, `.orchestrator/lane-protocol.md`, `.orchestrator/html-templates/`, the six `.orchestrator/*.cjs` render/gate/index scripts, `.orchestrator/run-state.cjs`, and `.orchestrator/.materialized-version`) and the achieved context confidence. The list also names `.orchestrator/engine/`, the engine item 2 pinned, or that pin's error message when it could not.

**That list is everything bootstrap creates, and `plans/` is deliberately not on it — do not add a `mkdir` here.** Every artifact a run writes lands flat inside one run folder, `plans/<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>/`, and that folder is minted **once per run at Step 0 pre-flight** — right after `base_sha` is recorded and before any spawn — from a UTC timestamp plus four random hex digits, never from a directory listing. Minting it here instead would create a folder no run will use, and would invite the very thing the recipe exists to prevent: a later editor deriving the run's name by scanning `plans/`, which two worktrees do differently and which merges as a rename/rename conflict. The seven legacy kind directories are not created either — they are frozen where a project already has them, and never brought into existence where it does not. The only `plans/` path bootstrap is concerned with at all is `plans/index.html`, and even that is written by Step 7 of a run, not by this step; all bootstrap does for it is put `index-plans.cjs` where the run can reach it.
