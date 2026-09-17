# orchestrator-flash — a lightweight, higher-risk sibling of the orchestrator

**Date:** 2026-09-16
**Target:** new skill `plugins/my-skills/skills/orchestrator-flash/`, plus its ship surface (prime-agent overlay, index, README, one ADR).
**Status:** design — implementation deferred until approved.

## Problem

The orchestrator produces good results and is not fit for hackathon-speed validation. Measured on its own default path (`parallelism: off`, `output_format: md`, `rigor: hardened`, project already bootstrapped):

- **8 agent-level invocations** on the happy path — brainstormer (`SKILL.md:798`), architect (`:865`), coder (`:992`), tester (`:1039`), reviewer (`:1107`), qa (`:1550`), plus `simplify` (`:1019`) and `spec-driven-eval` (`:1295`). A fresh repo adds a 9th (bootstrap B1's scan subagent, `references/bootstrap.md:27`).
- **~45–50 spawns** at the cycle ceiling from a single brief. A REQUEST_CHANGES cycle is up to 5 spawns (`SKILL.md:1103-1266`); a QA BLOCKED cycle is 4 and nests a whole review pass inside it (`:1728`).
- **Two uncapped human interview loops before any code exists** — bootstrap B1 to `context_threshold` 0.95 (`bootstrap.md:16-37`) and the brainstormer to `clarity_threshold` 0.99, one question per turn, explicitly uncapped (`templates/brainstormer.md:58`, `:261`: "Do not cap the number of interview questions"). Estimated 15–40 minutes of a 120-minute budget.
- **~25–30 files and >200KB** written into the user's repo by bootstrap B3 before the first line of the idea (`bootstrap.md:70-130`, enumerated at `SKILL.md:17`).
- **10 artifacts per run**, none of which is code.
- **19 hard stops**, several of which will fire on this audience — spec `status: DRAFT` (`:833`), eval red Engineering Gate (`:1467`, whose own rationale records a run waiting "4 hours 43 minutes, overnight, on formatter line-wrap in three generated localization files"), QA `BLOCKED_STALE` (`:1618`).

### Why the existing `rigor: sketch` tier is not the answer

`config.md:54` names `sketch`'s audience as "POC, hackathon, spike, throwaway", and its preset table (`config.md:64-79`) promises exactly what this problem needs. It does not deliver it, for four independently sufficient reasons — all verified in-repo:

1. `templates/config.template.json` writes every cap **explicitly** (`"automation_level": "manual"`, `"max_review_cycles": 10`, `"max_qa_cycles": 5`, `"max_eval_cycles": 2`, `"max_family_cycles": 6`, `"rigor": "hardened"`), and `SKILL.md:605` states "An explicit key overrides its preset: the preset is a default set, not a lock." On any bootstrapped project `--rigor sketch` therefore reads **10 / 5 / 2 / 6** — a review cap *above* `hardened`'s own preset of 6.
2. `automation_level` is not in Step 0b's preset-application list (`SKILL.md:605-611`, which covers only the six anchored numeric keys), and `:710` confirms it "keeps reading from the working tree as before". `sketch`'s `autonomous` row cannot fire by either route; the uncapped interview survives.
3. `grep -ci rigor` returns **0** for `templates/architect.md`, `templates/coder.md` and `templates/reviewer.md`, while `SKILL.md:136` tells the reader those roles branch on rigor. Only `qa.md` and `tester.md` implement it.
4. On a fresh repo `$mb` holds no `config.json`, so `SKILL.md:695` falls back to **defaults**, "never to the working-tree copy". A user who writes `{"rigor":"sketch"}` into the file they just created gets a hardened run, silently.

Even a perfectly-wired `sketch` would not help enough: it is a config value, not a pipeline shape. It does not remove the tester spawn (Step 3b is unconditional), the QA spawn (Step 5 is unconditional; only block-or-report changes), the reviewer spawn, the Step 0a workspace question, bootstrap, the FINAL artifact, or `check-artifact-home.cjs`. A fully-wired `sketch` is still **6 role spawns, ~25 bootstrap files, 2 blocking prompts, ~10 artifacts**.

**orchestrator-flash ≈ (a `sketch` that actually fires) + six structural cuts.**

The `sketch` wiring gaps above are a live defect in the shipped orchestrator. They are **out of scope for this spec** and warrant their own fix run.

## Goal

A sibling skill that reaches working code fast enough to validate an idea inside a hackathon, that leaves a trail thin enough to be free and complete enough to hand to `/orchestrator` later, and that **never lets its cheaper green be mistaken for the orchestrator's**.

## Decisions

Each was taken explicitly; the rationale matters more than the choice.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Deliverable: running code + a thin trail.** A small run folder (spec, plan, what was built) that a later `/orchestrator` run can pick up. The trail is a byproduct, never a gate. | The idea has to survive the hackathon without being re-derived. |
| D2 | **Own spine, own slim roles, shared artifact contract.** Flash writes its own `SKILL.md` and its own short role templates, but keeps orchestrator's ID minting, run-folder grammar and artifact frontmatter verbatim. | The grammar is machine-enforced (see Couplings B, C); the prose is not. Sharing the enforced part costs nothing and keeps `plans/index.html` and a later pickup working. |
| D3 | **Emits `READY_TO_COMMIT` verbatim.** | `product-manager/SKILL.md:139` defines pipeline success as that exact string; reusing it keeps flash drivable by existing wrappers. The cost — one green string now meaning two amounts of verification — is paid down by D9. |
| D4 | **Config file with `review` and `simplify` as params; review is a gating cycle with its own budget.** | Matches the orchestrator's shape, which is what makes the skill learnable for someone who already knows the orchestrator. |
| D5 | **Materializes config + 4 role prompts + a slim artifact-format into `.orchestrator/flash/`.** | Subagents cannot read a skill's own `references/`; they read the repo. Per-project editability was wanted explicitly. Accepts the staleness class (Coupling CC) with the mitigation in §5. |
| D6 | **Quality gates: typecheck + build only, advisory. No `clean-code-gates`.** | Because nothing is ever committed (`SKILL.md:1758`), a gate scoped `base..HEAD` resolves to zero files and "the report renders green with no gate having run" (`gate-config.md:114-149`). A vacuous green is worse than no gate, and this audience will believe it. Typecheck/build catch the class that actually kills a demo, with no scoping trap. |
| D7 | **Clock is advisory** (`warn_after_minutes`, default 90). Elapsed prints at every step boundary; nothing stops mid-run. | A hard stop mid-coder destroys in-flight work, which is worse than a long run for this audience. Named `warn_after_minutes` rather than `max_run_minutes` because a `max_*` key that does not bound is the same naming trap that made `sketch` inert. |
| D8 | **`max_review_cycles` is a plain integer, default 1, no ceiling.** `0` = the reviewer runs once and its CR is advisory, with no rework loop. | Flash has no family budget, so nothing silently clamps it — avoiding `review_budget = max(1, min(...))` (`SKILL.md:235`) and the "structurally inert `max_review_cycles`" trap at `:677`. A disabled loop must not bind. |
| D9 | **Banner names every skipped check by category.** | `docs/effort-tiers-design-note.md:27` — "Cheap green and expensive green must not look alike." With the machine string shared (D3), the banner is the only layer where a human can tell them apart. |
| D10 | **Brainstormer interviews uncapped but always batched** — never one question per turn. | Preserves spec quality (the thing the orchestrator is actually good at) while cutting round-trips by roughly 5×. |
| D11 | **Workspace: refuse protected branches, auto-cut `flash/<slug>` on a clean tree, ask only on a dirty tree** (proceed-or-cancel). | Three cases with 3–4 options each (`SKILL.md:253-321`) is the first thing a user sees today. Running three code-writing agents on a dirty `main` is the worst available outcome, and preventing it is seconds of git. |

## Design

### 1. Shape

```
plugins/my-skills/skills/orchestrator-flash/
  SKILL.md                            # ~300 lines (orchestrator's is 2,030)
  MATERIALIZED-VERSION
  templates/
    flash-config.template.json
    artifact-format-flash.md
    brainstormer.md  architect.md  coder.md  reviewer.md
```

No `references/`. No html mode. No parallel path. Size benchmark in this repo: `simplify` does real multi-step work in 121 lines, `commit-pr` in 159.

**Roles are not registered agent types.** `scripts/sync-agents.sh:58` holds a closed list — `MANAGED=(architect.md brainstormer.md coder.md qa.md reviewer.md tester.md)` — and `--prune` deletes any other `.md` in `.claude/agents`, `.agents/agents`, `.opencode/agent`, `.orchestrator/roles`. Flash role files placed there are destructible by routine maintenance. Instead, flash spawns the host's generic agent type (`general-purpose` on Claude Code, `general` on opencode) with a prompt whose first instruction is to read `.orchestrator/flash/<role>.md` and follow it. This is the same indirection the orchestrator already uses for its scan subagent (`SKILL.md:101-107`), it requires no new registration, and it works identically on both hosts.

### 2. Pipeline

| Step | What it does | Spawn |
|---|---|---|
| 0 | Parse args → load config → workspace guard (D11) → capture `base_sha` → record `run_started_at` → mint run folder → resolve the generic agent type once | — |
| 0b | Bootstrap when flash's materialized files are missing or stale | — |
| 1 | Brainstormer → `SPEC` | 1 |
| 2 | Architect → `FEAT` plan with an FR→AC map | 2 |
| 3 | Coder → TDD; runs the tests it wrote for its changed scope; flips `status: DONE`. `simplify` skill runs here when `simplify: true` | 3 |
| 3b | Typecheck + build, advisory, never blocking | — |
| 4 | Reviewer when `review: true` → `CR`. On `REQUEST_CHANGES`, the CR goes **straight to the coder** (no architect FIX plan), bounded by `max_review_cycles`; at `0` the CR is advisory and the run ends on the first verdict | 4 |
| 5 | `FINAL` artifact + completion banner | — |

**Spawn count: 4 nominal, 6 at a review budget of 1**, versus the orchestrator's 8 nominal and ~45–50 ceiling. **Artifacts: 4** (`SPEC`, `FEAT`, `CR`, `FINAL`) versus 10.

The review cycle deliberately diverges from the orchestrator's, which routes a CR through the architect as a FIX plan, then the coder, then the tester, then the reviewer (4–5 spawns per cycle, `SKILL.md:1103-1266`). Flash's cycle is coder → reviewer, 2 spawns. It still requires `root_plan_id` (Coupling H).

Elapsed time prints at every step boundary. Past `warn_after_minutes` the boundary line carries a warning. Nothing halts.

### 3. Configuration

`.orchestrator/flash-config.json`, read **directly from the working tree**. Flash does not implement the orchestrator's merge-base config anchoring (`SKILL.md:684-712`), so it inherits neither the "must be git-tracked or ten keys fail closed to defaults permanently" requirement (Coupling U) nor the silently-hardened-on-a-fresh-repo failure.

```json
{
  "review": true,
  "simplify": false,
  "max_review_cycles": 1,
  "warn_after_minutes": 90,
  "test_cmd": null,
  "typecheck_cmd": null,
  "build_cmd": null
}
```

Seven keys, every one absent-tolerant. The three command keys auto-detect from the project and exist only to override. CLI flags mirror them: `--no-review`, `--simplify`, `--max-review N`, `--setup`.

**The template must not pin a value its flag is supposed to move.** That is the exact mechanism by which `sketch` became inert, and it is the one thing this config file must not repeat.

### 4. Artifacts — what is inherited verbatim

Copied byte-exact rather than paraphrased, because scripts enforce them:

- `slugify()` and `newrun()` (`references/artifact-format.md:202-217`), including the trailing-hyphen trim **after** the 40-character truncation and the `run` fallback when nothing alphanumeric survives.
- **Run-folder depth is exactly 2** — `plans/<run-folder>/<file>`. `check-artifact-home.cjs:84` fails on more, and `plans/index.html` is the only filename the gate allows at the `plans/` root.
- Central `newid` minting; a role's write path is `{run_dir}/{the ID it was given}-{its slug}.md`, checked by string equality, never by listing a directory.
- `run_dir=` on **every** spawn, unconditionally.
- `MAESTRO_REVIEW_BASE={base_sha}` on every role that scopes a diff.
- `related_to: <spec id>` frontmatter on every artifact, so `index-plans.cjs` groups the run as a family and a later `/orchestrator` run can join it.
- `Status: STALLED` verbatim for every halt.

Dropped: the `TEST`, `EVAL` and `QA` artifacts, the `.progress.md` sidecar, and the `QNA` artifact.

`plans/index.html` is regenerated only when `index-plans.cjs` already exists in the project. When it does not, the banner states that the run is not indexed rather than leaving the omission silent.

### 5. Bootstrap and staleness

Flash materializes six files into `.orchestrator/flash/`: four role prompts, `artifact-format-flash.md`, and `flash-config.json`. It carries its own `MATERIALIZED-VERSION` and its own stamp script; it never touches the orchestrator's.

This accepts a known failure class. `SKILL.md:17` records the orchestrator running **five commits** with materialized role files behind their templates, so that "the `rigor=` preamble field shipped in the templates never reached the materialized tester role and no run ever carried it" — the fast path was inert in production and nothing noticed. Mitigations:

1. The stamp is a **digest over `templates/`**, compared on every run, not a hand-bumped version.
2. The staleness trigger lists materialized files **by literal name**, so adding or removing one means editing the trigger, the bootstrap step and the stamp together, or the skill re-bootstraps on every run (Coupling T).

### 6. Role templates

**Brainstormer** (283 → ~90 lines). Keeps: numbered `## Functional requirements`, `## Acceptance Criteria`, and the `## Output to user` line shapes verbatim. Interviews uncapped but **always batched into one message**. Drops: the QNA artifact, spec immutability, the prior-art skim, the `## Affected surface` and `## Non-functional requirements` sub-bullets, and **the reserved-decision `DRAFT` rule**. A flash spec is never `DRAFT`; unknowns become recorded assumptions in the spec body.

**Architect** (436 → ~110). Keeps: TDD-first task ordering, a two-column FR→AC map, `## Acceptance Criteria`, and its `## Output to user` line shapes. Drops: the `### Gate coverage` table, `## Optional (non-gating)`, the `deferred-to-join` scope token, the 22-bullet Rules block, and the `.progress.md` sidecar.

**Coder** (387 → ~120). Keeps: strict TDD, `never modify a test to make it pass` (`coder.md:288`) verbatim, and the `Status: DONE|BLOCKED` output line. Runs the tests it wrote **for its changed scope** at task exit. Drops: the 137-line gate block (`coder.md:145-281`, whose only reader was QA), the per-checkbox `.progress.md` append, and nine of ten bookkeeping edits — one `status` flip at start and one at end.

**Reviewer** (310 → ~100). Keeps **verbatim**: the isolated `GIT_INDEX_FILE` working-tree snapshot (`reviewer.md:25-38`), the Must Fix / Should Fix split, the "what would close this finding" test, and the two lenses no other role covers (`reviewer.md:122`). Drops: `## Read scope`, `delta=`, the four-rule write-path precedence, ten of fourteen frontmatter keys, and one of two progress-log appends. Its `status:` frontmatter remains `APPROVED | REQUEST_CHANGES`.

### 7. The completion banner

```
ORCHESTRATOR-FLASH — pipeline complete
Status: READY_TO_COMMIT
Pipeline: flash (reduced verification — see below)

Spec:        plans/<run>/SPEC-<id>-<slug>.md
Plan:        plans/<run>/FEAT-<id>-<slug>.md
Built:       <one line per acceptance criterion delivered>
Verified:    coder TDD tests (changed scope) · typecheck · build (advisory)
NOT VERIFIED: e2e · coverage floor (G1 — asserted by nobody) · mutation (G6)
              · spec grading · QA regression · full test suite
Elapsed:     <mm>m   Review cycles: <n>/<budget>
Commit:      <proposed commit message>
```

Every line under `NOT VERIFIED` names a check by category. A step that did not run must never look like one that ran and found nothing — the doctrine at `SKILL.md:1017`.

## Couplings this implementation must honor

Removals that silently break something else. Each was verified against the source. The letters are carried over from the analysis ledger this design was built on, so the gaps in the sequence are intentional — they are couplings that turned out not to bind flash.

- **A — write path is one mechanism in three parts.** `run_dir=` + central `newid` + string-equality path construction. Remove `newid` and subagents self-number, which `SKILL.md:113` names as "the root cause of duplicate IDs". Remove `run_dir=` and every producing role starts searching `plans/`.
- **B — `slugify` is enforced by a regex in a script.** `check-artifact-home.cjs:56`. `SKILL.md:358-363` records the failure of paraphrasing it: an undefined `slugify` printed `command not found`, the substitution returned empty, the script continued at exit 0, `mkdir` created `plans/<ts>-<hex>-`, and the home gate then rejected **every artifact that run wrote**.
- **C — depth is exactly 2.** `check-artifact-home.cjs:84`. Artifacts emit `href="../../docs/adr/015.md"`, which resolves at that depth and breaks one level deeper.
- **D — `base_sha` is consumed under a different name.** Captured once, shipped as `MAESTRO_REVIEW_BASE`. Without it "the reviewer falls back to `git merge-base`, which is not the base the rest of the run measured against" (`SKILL.md:1724`).
- **E — the pipeline never commits, which is what makes the reviewer's snapshot non-negotiable.** `SKILL.md:1758`, `reviewer.md:25`. Any lighter reviewer reaching for `git diff main...HEAD` gets an **empty** diff on a fresh branch — staged, unstaged and untracked files all invisible — and approves code it never read, silently, every time. Carry `reviewer.md:27-34`'s five-line recipe exactly. **This is the single most dangerous thing to simplify away.**
- **G — `.progress.md` drops together with the step that verifies it.** `SKILL.md:896` re-reads the sidecar and stops the run when it is absent; `:1147` requires a `REVIEWER` entry in it. Flash omits both the sidecar and those checks.
- **H — `root_plan_id` keeps requirement coverage alive across a fix loop.** A cycle-2 reviewer handed only the fix's `plan_id` gates on the CR's own Must Fixes and "silently drops everything cycle 1 was checking" (`SKILL.md:1136`, `:1724`).
- **J — spec numbering is a three-step contract.** Numbered FRs (`brainstormer.md:197-199`) → the architect refuses an unnumbered spec as "unusable" (`architect.md:313`) → the orchestrator counts those numbers against the plan's map (`SKILL.md:898`).
- **K — `DRAFT` is a run-ending stop set by two independent rules.** `SKILL.md:833-843` STALLs; `brainstormer.md:231`/`:247` set it on any non-empty `## Open questions` and `:111` on any unauthorized reserved decision — a list that includes "external provider selection", i.e. what a hackathon decides unilaterally. Flash's brainstormer must be structurally unable to emit `DRAFT`.
- **N — the coder produces the tests, not the tester.** `coder.md:106-121`, `:283-290`. Dropping the tester does not leave flash test-less; state this so nobody restores the tester to get tests back. Conversely, `architect.md:168` mandates TDD-first ordering and the coder assumes it — if flash's architect stops emitting test tasks, **the run produces zero tests**. The two templates change together.
- **O — the whole-suite prohibition names three barriers flash deletes.** `coder.md:266-281` forbids a whole-app suite at phase exit and delegates it to the tester, QA and the parallel join. All three are gone. Flash re-homes it as the coder's **changed-scope** run, and the banner states that no full suite ran.
- **Q — the parsing rules are a wire protocol with a named trap.** Six exact stdout strings (`SKILL.md:1738-1745`); the fallback on a miss is a silent, expensive degradation rather than an error (`:1747`). **Never add a `Plan:` line to an architect prompt** — the architect's *output* `Plan:` line is what the step extracts, which is why the architect is handed `Source spec:` instead (`:1749`).
- **R — absence is the signal for four preamble keys.** `lane=`, `contract=`, `leaves=`, `aggregate=` signal by being omitted; there is explicitly no `aggregate=none`. Flash omits them entirely and never emits them blank.
- **T — the staleness trigger names files literally.** See §5.
- **V — the home gate is not a standalone script.** `check-artifact-home.cjs:36` requires `gate-scope.cjs` beside it, and `gate-scope.cjs:16-20` exits **non-zero rather than passing** when neither `main` nor `origin/main` resolves and no base ref is passed — so on a hackathon repo with no `main` branch it hard-fails. Flash does not run the home gate at all; it writes into one folder it just minted with the user watching the terminal. The banner says the run was not gate-checked.
- **X — the run clock has no ledger to read from.** The orchestrator binds elapsed from `boundaries[0].at` in the verification ledger (`SKILL.md:661`), which flash drops. `run_started_at` is held as a shell variable in the orchestrator's own context for the run. Flash has no resume, so nothing needs to recover it across sessions.
- **BB — the pre-mint stops must not `rmdir` an unbound path.** `SKILL.md:413-415`. Flash's workspace-cancel stop (D11) precedes the run-folder mint, where `$run_dir` does not yet exist. Any cleanup on that path must be guarded.
- **CC — a stale materialized copy is invisible to a missing-file test.** See §5.

## Ship surface

Every item below has teeth; each was verified.

1. `prime-agent/overlays/orchestrator-flash.json` — **required**. `scripts/build-prime-agent.mjs:150` fails the whole distribution ("every skill needs one") and `:199-203` refuses to write `prime-agent/skills` at all. The floor is the 85-byte `design-to-code.json`.
2. `prime-agent/tests/install.sh` — hardcoded `12` at `:112` and `:113` becomes `13`.
3. `prime-agent/tests/parity.sh:278` pins the emitted python-fence count at exactly `21`. Re-check after authoring and, if it moves, update it with a reason comment in the style of `:272`.
4. `plugins/my-skills/skills/index.json` — regenerated after **every** file added inside the skill, not once.
5. `README.md` — one table row at the skill catalog.
6. **No `.opencode/skills/orchestrator-flash/` override.** Creating one makes a `PORTS` entry mandatory (`scripts/check-host-parity.mjs:117-119`) and doubles every future edit by hand. Opencode reads the shared path directly and its slash command auto-generates.
7. `docs/adr/0025-*.md` — records the `READY_TO_COMMIT` reuse by a weaker pipeline. ADR-0024:132-133 anticipated this question; a sibling skill with its own weaker promise is the honest place to have it, provided the promise is stated.

## Risks accepted

Stated plainly because flash's whole value proposition is being explicit about what it does not do:

- **G1 coverage is asserted by nobody.** With both the tester and QA gone, no role asserts the coverage floor.
- **No e2e, no mutation testing, no spec grading, no QA regression pass.**
- **No full test suite runs anywhere.** Only the coder's changed-scope tests.
- **The spec is mutable.** No immutability rule, so a shifting idea does not force a new spec and a new run folder — and nothing records that it shifted.
- **Nothing hard-bounds a flash run.** The clock is advisory by decision (D7); review cycles are finite by construction; the brainstormer interview is not. A run can go long, and the only stop is a human.
- **`READY_TO_COMMIT` now means two different amounts of verification.** Mitigated by the banner (D9), not eliminated.
- **Flash inherits the materialization staleness class** (§5), mitigated by a content digest rather than designed out.

## Out of scope

- Fixing the `sketch` wiring defects in the orchestrator. Documented in this spec's Problem section; needs its own run.
- Any parallel or lane support in flash.
- html output mode in flash.
- Making `product-manager` aware of which pipeline produced a given green.
