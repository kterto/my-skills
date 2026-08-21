# Orchestrator — Artifact Format Reference

All six role templates (brainstormer, architect, coder, tester, reviewer, qa) write artifacts using the format controlled by `output_format`. This document is the single source of truth — role templates reference it instead of duplicating emission rules.

> **Materialized location.** Bootstrap (Step B3) copies this file to `.orchestrator/artifact-format.md`, the html scaffolds to `.orchestrator/html-templates/`, and the runtime scripts (`render-artifact.cjs`, `check-artifact-pairing.cjs`, `check-artifact-links.cjs`, `gate-scope.cjs`) into `.orchestrator/`. Subagents read those `.orchestrator/` paths — they do NOT have access to the skill's own `references/`, `templates/html/`, or `scripts/` directories. Always reference the `.orchestrator/` copies in role prompts.

> **HTML is rendered, never hand-written.** In `html` mode the `.html` view is produced by running `node .orchestrator/render-artifact.cjs <artifact.md>` — the renderer fills the correct scaffold, mirrors the frontmatter into `<main data-*>`, escapes every attribute/URL, and self-validates the structure before writing. Roles and the orchestrator NEVER author HTML by hand; they write the `.md` and invoke the renderer. This is the single source of the one-source/two-render guarantee, and its escaping is what keeps generated artifacts XSS-safe.

## Core rule — markdown is always the source of truth

**The `.md` artifact is ALWAYS written, in every mode.** Its YAML frontmatter is the canonical state: it is what the orchestrator scans for ID allocation and what the coder/architect mutate (`status:`, `updated_at:`, task checkboxes). When `output_format=html` the role ALSO writes a styled `.html` rendered *view* alongside the `.md`. The html file is a read-only render — never the place state lives.

This means:

- Numbering scans never break, because `<ID>-<slug>.md` always exists.
- State mutation (status flips, `[ ] → [x]`) always targets the `.md` first — it is authoritative.
- The `.html` view is a snapshot rendered from the `.md` at write time.

**One exception — the coder keeps the plan html task state live.** While executing a plan in `html` mode (and only when the plan `<ID>-<slug>.html` exists beside the `.md`), the coder keeps the rendered plan in sync with reality instead of freezing it at creation time by **re-running the renderer on the plan** — `node .orchestrator/render-artifact.cjs plans/<dir>/<ID>-<slug>.md` — after it flips checkboxes and updates `status`/`updated_at` in the authoritative `.md`. The renderer regenerates the `.html` from the current `.md`, so task state, progress overview, and `data-*` all follow automatically. The `.md` still wins on any disagreement, and every other artifact's `.html` is likewise a render of its `.md`. See the coder role template, Step 4b-html.

## md artifact (always written)

- Filename: `<ID>-<slug>.md` (e.g. `FEAT-003-add-list-sharing.md`)
- Structure: YAML frontmatter block followed by a markdown body.

Frontmatter fields:

```yaml
---
id: <ID>
status: <status>          # e.g. DRAFT | READY | APPROVED | BLOCKED
created_at: <ISO-8601>
updated_at: <ISO-8601>
cycle: <integer>          # review or qa cycle number (0-based)
---
```

Body: free-form markdown with headings, lists, and fenced code blocks as appropriate for the role.

## html rendered view (additional, only when output_format=html)

Written IN ADDITION to the `.md`, never instead of it, and **always produced by the renderer** — never authored by hand.

After the authoritative `.md` is on disk, produce its view with:

```bash
node .orchestrator/render-artifact.cjs plans/<dir>/<ID>-<slug>.md
```

The renderer writes the paired `<ID>-<slug>.html` beside it and prints `rendered <path>`; it exits non-zero (writing nothing) if the source escapes `plans/`, is not a `.md` regular file, or the emitted structure is non-conformant. What it guarantees, so roles don't have to reproduce it:

- Filename `<ID>-<slug>.html` beside the `.md`; one self-contained file — no external assets, no CDN links.
- Root `<main>` with `data-*` attributes mirroring the md frontmatter (the `.md` is authoritative if they ever disagree):

  ```html
  <main data-id="<ID>" data-status="<status>" data-created-at="<ISO-8601>"
        data-updated-at="<ISO-8601>" data-cycle="<integer>">
  ```

- Sections wrapped in collapsible `<details><summary>Section Title</summary>…</details>`.
- Task lists as `<input type="checkbox" disabled>` checkboxes (checked iff `- [x]`).
- Cycle counters as inline `<span class="badge">cycle N</span>` badges.
- Every attribute, link URL, and text node escaped (attribute-escaping + a scheme allowlist for `href`), plus a `default-src 'none'` CSP with a per-render script hash.

**Scaffold selection is automatic** (from the `.md` path): `*.progress.md` → `progress-timeline.template.html`; a source under `plans/eval/` → `qa-report.template.html`; otherwise the same-named `<artifact>.template.html` (spec, plan, test-report, code-review, qa-report, final-report) in `.orchestrator/html-templates/`. The renderer also produces the progress view: `node .orchestrator/render-artifact.cjs plans/<dir>/<ID>-<slug>.progress.md` writes `<plan-path-without-.md>.progress.html` from the plan's `.progress.md` append-log. `.progress.md` remains the markdown source-of-truth log (roles append to it); the html file is a regenerated read-only view.

## Validation gates (html mode — blocking)

Before the pipeline prints its `pipeline complete` banner, the orchestrator runs both gates over the artifacts this branch introduced. They are shell-free and **fail closed** (a broken git or unresolvable base ref exits non-zero rather than passing a vacuous empty scope), so a green verdict is trustworthy:

```bash
node .orchestrator/check-artifact-pairing.cjs   # every branch-added plans/**.md has its .html sibling + complete frontmatter
node .orchestrator/check-artifact-links.cjs     # every local link in a branch-added plans/**.html resolves on disk
```

Each prints `<gate>: OK` and exits 0 on success, or lists violations and exits non-zero. A non-zero gate blocks completion — see SKILL.md → Step 7d. Scope is the branch's added/modified files under `plans/` vs the merge-base with the base branch; legacy artifacts are not re-audited. Pass an explicit base ref as the first argument, `-- <file>…` to check specific files, or `--allow-empty` to opt out of the fail-closed base guard.

## Canonical directories & prefixes (allow-list — load-bearing)

The ONLY directories permitted under `plans/`. No role or step may invent any other directory.

| Artifact      | Directory            | Prefix  | Owner (who creates it)         |
| ------------- | -------------------- | ------- | ------------------------------ |
| spec          | `plans/specs/`       | `SPEC`  | brainstormer                   |
| feature plan  | `plans/feat/`        | `FEAT`  | architect (type `feat`)        |
| fix plan      | `plans/code-review/` | `FIX`   | architect (type `fix`)         |
| qa-fix plan   | `plans/qa/`          | `QAF`   | architect (type `qa`)          |
| test report   | `plans/test/`        | `TEST`  | tester                         |
| code review   | `plans/code-review/` | `CR`    | reviewer                       |
| qa report     | `plans/qa/`          | `QA`    | qa                             |
| spec eval     | `plans/eval/`        | `EVAL`  | orchestrator (Step 4e)         |
| final report  | `plans/final/`       | `FINAL` | orchestrator (Step 7b)         |
| interface contract | `plans/feat/`   | `PACT`  | architect (type `contract`)    |

`QNA-{NNN}` files (brainstormer, non-interactive mode) share the paired SPEC's **ID token** (the `{NNN}` part only, without the `SPEC-` prefix) and live in `plans/specs/`.

**The no-new-top-level-directory ban stands.** `PACT` is a new *prefix*, not a new directory: it is written into the existing `plans/feat/` alongside the lane `FEAT` plans it governs, exactly as `FIX` co-locates with `CR` in `plans/code-review/` and `QAF` with `QA` in `plans/qa/`. The table above remains the complete allow-list of directories under `plans/`; no role or step may invent another.

### `PACT` frontmatter contract

A `PACT` carries the **same five required frontmatter keys as every other artifact** (`id`, `status`, `created_at`, `updated_at`, `cycle`) plus `related_to` referencing the source spec, and a **Related** region linking back to it. Nothing about its shape is special-cased:

- `check-artifact-pairing.cjs` accepts it unchanged — it requires the `.html` sibling and the complete five-key frontmatter, both of which a `PACT` has.
- `check-artifact-links.cjs` accepts it unchanged — its Related link is an ordinary relative link that resolves on disk.
- The renderer maps prefix `PACT` to the existing **`plan` scaffold** (`plan.template.html`), so it renders with the same `<main data-*>` shell, collapsible sections, disabled task checkboxes, and cycle badge as a `FEAT`. No new scaffold is introduced. Its masthead kicker is **`Interface Contract`**, not `Execution Plan`: which chrome a prefix borrows and what the document *is* are two decisions, and a `PACT` carries no `## Tasks` and no `## Verification (per phase)`.

An **amended** `PACT` is a new artifact with its own ID whose `related_to` additionally references the superseded `PACT`; the superseded one is left on disk unmodified.

### Sub-contract — a `PACT` one level down (`parallelism: full` only)

Under `parallelism: full`, a lane adopted for sub-splitting is governed by its own **sub-contract**: a child `PACT` covering that one lane's sub-lanes. Nothing about it is new machinery — it is the **same artifact one level down**:

| Aspect | Sub-contract |
| ------ | ------------ |
| Prefix | `PACT` — **no new prefix** |
| Directory | `plans/feat/` — **no new directory** |
| Frontmatter | the same **five required keys** (`id`, `status`, `created_at`, `updated_at`, `cycle`) plus `related_to` — **no new frontmatter key** |
| Renderer | the existing `PACT → plan` scaffold mapping, masthead kicker `Interface Contract` — **no new scaffold** |
| Gates | `check-artifact-pairing.cjs` and `check-artifact-links.cjs` accept it unchanged |
| Body | the same six regions, read one level down (sub-lane map, path ownership, interface points, unowned files, integration sub-lane, per-sub-lane definition of done) **plus one new required region** (below) |

**There is no new prefix, directory, scaffold, or frontmatter key.** A reader who knows how to read a `PACT` already knows how to read a sub-contract.

**`related_to` references both the source spec and the parent `PACT`.** Both edges are required: the spec is what the work answers to, and the parent contract is what the sub-lane split partitions. A sub-contract **never links sideways to a sibling** sub-contract — the parent contract is the run's only index of the nesting, so sibling knowledge would create a second, race-prone one.

**Depth is capped at 2** (`config.md` → `parallelism`): a sub-contract never itself carries a `Sub-contract` column, and a sub-lane is never sliced further.

#### Required region — Inherited interface assignments

A sub-contract carries **one region the parent contract does not**: **Inherited interface assignments**. It assigns every **parent-contract** interface row whose producer or consumer is this lane to **exactly one named sub-lane**.

```markdown
## Inherited interface assignments

| Parent row | Side this lane owns | Assigned sub-lane |
| ---------- | ------------------- | ----------------- |
| I-1 | producer | backend/presentation |
| I-4 | consumer | backend/data |
```

**Why this region is required rather than optional** — state the reason wherever the region is specified, because it is what a future editor would otherwise relax: `templates/coder.md`'s existing rule is *"Read the `PACT` at `contract=`. It is the authority on what you own."* That sentence must stay true **verbatim at both levels**, and it only does so if **a leaf reads exactly one contract** and finds *both* its intra-lane rows *and* its inherited parent rows there. Without this region a sub-lane coder would have to read the parent contract too, discover which parent rows landed on its lane, and then guess which sub-lane owns each — three inferences the contract exists to eliminate. It is also what lets the outer join (Step 3j) verify a parent row against **the sub-lane the sub-contract assigned it to** rather than guessing which leaf owns it.

A sub-contract's **own** interface rows are **intra-lane by definition** — they connect two sub-lanes of the same parent lane. Cross-lane rows live in the parent contract and reach a sub-lane only through this region.

#### The parent lane map's `Sub-contract` column

The **parent** contract's lane map gains **one column, `Sub-contract`** — empty for a flat lane, the child `PACT` ID for a sub-split lane:

```markdown
| Lane | Owned path globs | Spec requirements | Lane plan ID | Sub-contract |
| ---- | ---------------- | ----------------- | ------------ | ------------ |
| backend | `apps/api/**` | 1, 2, 5 | — | PACT-{NNN} |
| app | `apps/mobile/**` | 3, 4 | FEAT-{NNN} | — |
```

This column is the run's **single machine-readable index of the nesting**, and it is what `PACT` ID resolution below walks. A **sub-split** lane carries no lane-level `FEAT` plan of its own (its plans are its sub-lanes'), so its `Lane plan ID` cell is `—` and its `Sub-contract` cell names the child. A **flat** lane is the reverse. The parent contract remains the run-level index at all times.

### `PACT` ID resolution — receiving a contract ID as a role input

The tester, reviewer, and QA roles can be invoked with a `PACT` ID where a plan ID would normally go. That is the **join-level invocation** in parallel mode: one pass over a whole lane fan-out. It resolves identically for all three, so it is specified once here and each role template carries only its own delta.

When the ID you were given carries the `PACT-` prefix:

1. **Read the `PACT`** at `plans/feat/{PACT-ID}-*.md`.
2. **Resolve the leaf plan set from its lane map.** For each row:
   - The row's **`Sub-contract` cell is empty** (a flat lane) → take the row's own `Lane plan ID`, exactly as before.
   - The row's **`Sub-contract` cell carries a `PACT` ID** (a sub-split lane) → **read that sub-contract** and take **its** leaf plan IDs **in place of** the row's own. The row's `Lane plan ID` cell is `—` for such a lane; there is no lane-level plan to also collect.

   **The recursion is one level only.** A sub-contract never carries a `Sub-contract` column of its own (depth is capped at 2 — `config.md` → `parallelism`), so resolution terminates after exactly one walk. Do not look for a third level; encountering one is a malformed artifact, not a deeper tree to follow.

   **An absent `Sub-contract` column resolves as all-flat.** A legacy `PACT` written before this column existed, or any `PACT` from a run where no lane was sub-split, has no such column — read that as *"no lane is sub-split"* and take every row's `Lane plan ID`, which is exactly the pre-feature behavior. An absent column is **never an error**.

   Read every plan in the resulting **leaf set** in place of the single plan your own Step 1 would have read.
3. **Every plan in the resolved leaf set must be `status: DONE`.** The check applies to the **resolved leaf set** — the sub-lane plans for a split lane, the lane plan for a flat one — not to the lane map's rows. If any is not DONE, stop and report which leaf is incomplete, naming it by its **qualified name** (`{lane}/{sub-lane}`) when it is a sub-lane: the union is not yet a complete change set, so any verdict over it would describe work that does not exist.
4. **Evaluate the union of the leaf diffs as one change set**, in a single join-level pass. Never once per lane and never once per sub-lane. The leaves share one workspace, so the ordinary diff range already yields the union; what changes is that you evaluate it against every resolved leaf plan's acceptance criteria plus the `PACT`, not one plan's. **This evaluation is unchanged by nesting** — only the set of plans feeding it is resolved differently.
5. **Write back at the join:** set `plan:` in your report frontmatter to the **parent** `PACT` ID, fill the Related region with a relative link to it, and append your Progress Log entry to **every** resolved leaf plan and its `.progress.md`, so no leaf's log is missing the join verdict.

The single-plan-ID path is otherwise **unchanged** — same steps, same statuses, same stdout header lines. A `PACT` ID simply appears where a plan ID would.

**This resolution rule is the tester's, reviewer's, and QA's *entire* knowledge of nesting.** All three are still invoked **once each, at the outer join, with the parent `PACT` ID**; they need nothing else. That is deliberate: the rule lives in this one reference all three already follow, rather than in three role templates that could drift apart.

## The run family — every artifact answering one spec

A **run family** is every artifact under `plans/` that answers the same `SPEC-*`, across **all** the
orchestrator runs that touched it. It is not the same as a run: the cycle caps (`max_review_cycles`,
`max_qa_cycles`, `max_eval_cycles`) are scoped to one invocation and reset to zero when a new run
starts on the same spec, so work that overflows a run leaves the reach of every counter that was
watching it. One measured feature produced 13 code reviews and 8 post-approval runs across 11 distinct
slugs this way, while no in-run counter ever passed 4 of a permitted 10. The family is the scope at
which that is visible.

**Membership is one grep, not a graph walk.** Every artifact a run writes names that run's `SPEC-*` id
in `related_to`, alongside its immediate parent — the plan it fixes, the CR it answers, the contract it
governs. So the family resolves in a single pass:

```bash
grep -rl "{spec_id}" plans --include='*.md' --exclude='*.progress.md'
```

Use `grep -r`, never a `**` glob: globstar is off by default in bash and does not exist in bash 3.2,
where `**` silently means `*` and misses every artifact below the first level; zsh aborts the command
outright on zero matches. A plan and its `.progress.md` sidecar are **one** artifact — count the plan.

**The grep resolves the plans; the reviews resolve by provenance.** `grep` matches the id anywhere in
a file, so it also pulls in artifacts that merely cite the spec in prose, and it misses every `CR`
written before this rule existed — 0 of 222 code reviews across both reference projects carry
`related_to` at all. A `CR` belongs to the family when its `plan:` frontmatter names a family plan,
which every reviewer has always written:

```bash
grep -rl "^plan: {plan_id}" plans/code-review --include='CR-*.md'
```

One pass per family plan. Using the bare grep as the denominator scored three already-shipped families
as blocking and missed a fourth that was genuinely over the line.

**This is why the rule is load-bearing rather than cosmetic.** An artifact that omits the spec id is
invisible to the family — it does not count toward the rework ratio, it does not count toward the
family budget, and the run it belongs to can therefore restart indefinitely without any gate noticing.
When you write an artifact and the run has a spec, its id belongs in `related_to`.

## ID allocation — timestamp-based, collision-free

An artifact ID is `<PREFIX>-<ID-TOKEN>` where the ID token is a UTC creation timestamp plus a short random suffix:

```
<PREFIX>-<YYYYMMDD>T<HHMMSS>Z-<4 hex>
e.g.  FEAT-20260703T142530Z-a1b2   SPEC-20260703T142531Z-9f0c   TEST-20260703T142600Z-7d3e
```

**Why not an incrementing counter.** The old `<PREFIX>-001` scheme scanned the target directory for the highest existing number and added one. Two coworkers working in separate branches/worktrees each see only their own tree, both allocate the same next number, and the IDs collide on merge. Timestamp IDs are allocated **without listing the directory at all**, so parallel actors never race: the second-resolution UTC timestamp orders artifacts by creation time, and the random suffix guarantees uniqueness even if two artifacts of the same prefix are created in the same second.

IDs are **assigned by the orchestrator and passed into each role's prompt** (`ID to use: <PREFIX>-<ID-TOKEN>`). A role MUST use the provided ID verbatim and MUST NOT compute its own when one is supplied.

The orchestrator generates an ID with a fixed command — no scan, no dir argument:

```bash
# arg: $1 = prefix (e.g. FEAT). Emits e.g. FEAT-20260703T142530Z-a1b2
newid() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf '%s-%s-%s\n' "$1" "$ts" "$rnd"
}
```

Fallback: if a role is run standalone (no `ID to use:` in its prompt), it runs the same generator itself before writing.

**Validation & ordering.** An ID token matches `[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}`; a full artifact filename matches `^<PREFIX>-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}-<slug>\.(md|html)$`. Because the timestamp is fixed-width and leads the token, `ls <dir> | sort` lists artifacts in chronological order.

> **Placeholder note.** Throughout these templates and the role prompts, `{NNN}` (and any `-NNN` shown in an example path) is shorthand for this per-artifact **ID token** — no longer a zero-padded number. Read `SPEC-{NNN}` as `SPEC-<YYYYMMDD>T<HHMMSS>Z-<hex>`.

## Related navigation (md + html)

Each artifact carries a **Related** region linking to the artifact(s) it derives from, using **relative** paths across the `plans/<dir>/` tree (`plans/specs/`, `plans/feat/`, `plans/test/`, `plans/code-review/`, `plans/qa/`). `<ext>` = `md` or `html` per `output_format`.

Edges (each role fills the links it knows the paths of; omit a link when that artifact was not produced):

| Artifact | Related links |
|---|---|
| spec | none |
| plan (FEAT/FIX/QAF) | source spec (and source CR/QA for fix/qa plans; and the **governing** `PACT` for a leaf plan — the parent contract for an unsplit lane, that lane's sub-contract for a sub-lane) |
| interface contract (PACT) | source spec; and the superseded `PACT` when this one is an amendment; and the parent `PACT` when this one is a sub-contract |
| test report | the plan |
| code-review | the plan |
| qa report | the plan |
| final report | spec, plan, test, code-review, qa |

Compute the relative href from the artifact's own dir to the target's dir, e.g. a CR at `plans/code-review/CR-005-x.<ext>` links to its plan at `../feat/FEAT-003-y.<ext>`. In html the region is `<nav class="related">…<a href="…">ID</a>…</nav>`; in md a `**Related:** [ID](path) · …` line.

## Stdout header-line contract (identical in both modes)

The orchestrator parses stdout for control flow, not the artifact file. Each role prints a fixed set of header lines; these lines are the same regardless of `output_format` (only the on-disk artifact file changes between `md` and `html`).

Required header lines per role:

| Role         | ID header line                              | Status line                                                   | Path line           |
| ------------ | ------------------------------------------- | ------------------------------------------------------------- | ------------------- |
| brainstormer | `BRAINSTORMER — SPEC-{NNN} created`         | `Status: READY_FOR_PLANNING \| DRAFT`                         | `Spec: {path}`      |
| architect    | `ARCHITECT — {ID} created`                  | —                                                             | `Plan: {path}`      |
| coder        | `CODER — {PLAN-ID} session complete`        | `Status: IN_PROGRESS \| DONE \| BLOCKED`                      | —                   |
| tester       | `TESTER — TEST-{NNN} created`               | `Status: PASS \| BELOW_FLOOR \| BLOCKED`                      | `Report: {path}`    |
| reviewer     | `REVIEWER — CR-{NNN} created`               | `Status: APPROVED \| REQUEST_CHANGES`                         | `CR file: {path}`   |
| qa           | `QA — QA-{NNN} created`                    | `Status: READY_TO_COMMIT \| BLOCKED \| READY_WITH_WARNINGS`   | `Report: {path}`    |

Roles that have a path line also print it immediately after the Status line (or after the ID line for architect, which has no Status line). Additional informational lines (e.g. `Coverage:`, `Next:`) may follow but are not parsed by the orchestrator for control flow.

### Parallel-mode lines (additive — only when `parallelism` is not `off`)

These lines exist only on the parallel path. Every row in the table above is **unchanged byte-for-byte**; nothing below replaces or reformats an existing line.

| Step | Printed by | Line |
| ---- | ---------- | ---- |
| 2c | architect (type `contract`) | `ARCHITECT — PACT-{NNN} created` then `Contract: {path}` — the architect's generic `ARCHITECT — {ID} created` row already covers the ID line; only the path label differs (`Contract:` rather than `Plan:`) |
| 2s | orchestrator | `CONTRACTS — {k} sub-contracts dispatched` then one `Lane: {name} → {PACT-ID}` per sub-split lane |
| 2L | orchestrator | `LANES — {N} leaf plans dispatched` then one `Lane: {qualified leaf name} → {FEAT-ID}` per leaf |
| 3L | orchestrator | `LANES — {N} leaf coders dispatched` then one `Lane: {qualified leaf name} → {FEAT-ID}` per leaf |
| 3s | orchestrator | `SUBJOIN — {PACT-ID} reconciled` then `Status: JOINED \| PARTIAL \| AMENDED` and one `Sub-lane: {qualified name} — {DONE \| BLOCKED} ({reason})` per sub-lane |
| 3j | orchestrator | `JOIN — PACT-{NNN} reconciled` then `Status: JOINED \| PARTIAL \| AMENDED` and one `Lane: {name} — {DONE \| BLOCKED} ({reason})` per lane |
| 0 (resume) | orchestrator | `RESUME — {PACT-ID}` then one `Leaf: {qualified name} — {DONE \| PENDING}` per recovered leaf |

**On the `2L` / `3L` rows.** `{N}` is the **leaf** count, not the lane count, and `{qualified leaf name}` is `{lane}/{sub-lane}` for a sub-lane and plain `{lane}` for an unsplit lane. On a `lanes` run — where no lane is sub-split — every leaf **is** a lane, so both lines read exactly as they did before this change. `2s` and `3s` are printed only on a `full` run in which at least one lane was adopted for sub-splitting; on a `lanes` run neither line is emitted at all.

A leaf's tester/reviewer/QA invocation prints that role's **existing** header lines verbatim — a `PACT` ID simply appears where a plan ID would.

**Additive backward-compatibility guarantee.** The header-line contract only ever gains rows for the new artifact and the new steps; no existing row's text, order, or format changes. Every downstream parser therefore keeps working unmodified — notably `product-manager`, which keys off the orchestrator's `pipeline complete` banner. That banner is untouched, is still printed exactly once at the end of a run in every mode, and is never emitted by the join. With `parallelism` unset or `off` none of the lines in this section is printed at all, so an `off`-mode run's stdout is byte-identical to a pre-feature run's.
