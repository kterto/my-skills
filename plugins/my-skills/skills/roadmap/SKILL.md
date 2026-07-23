---
name: roadmap
description: Decomposes a project spec into an auditable milestone→phase→user-story roadmap under /roadmap/. Use when the user invokes "/roadmap", says "build a roadmap", or "plan the milestones". Reads .orchestrator/PROJECT-CONTEXT.md when present; each user story is an orchestrator-ready brief. Doc-only — writes /roadmap docs, never runs code or commits. "/roadmap sync" stamps done stories from commit trailers; re-running re-evaluates and preserves completed work.
---

# roadmap

**Doc-only constraint.** This skill writes `/roadmap/` documentation. It never runs code, never invokes the orchestrator pipeline, and never commits. Every action it takes is a file write or an interactive question. If you are looking for a skill that executes tasks, use the `orchestrator` skill.

**Relationship to the orchestrator (§14).** Each user-story file this skill produces is a self-contained orchestrator-ready brief — it can be fed verbatim to the `orchestrator` skill for implementation. The roadmap skill and the orchestrator skill are complementary: the roadmap skill plans and tracks; the orchestrator skill implements. They share a context root (`.orchestrator/PROJECT-CONTEXT.md`) but have separate outputs.

---

## Invocation + Config

| Command | Behavior |
|---|---|
| `/roadmap` | Auto-detect: `/roadmap/` does not exist → **build** (context gate → decompose → materialize); `/roadmap/` exists → **re-evaluate** (diff + preserve, see Sync + Re-eval). |
| `/roadmap sync` | Scan git commit trailers, stamp matched stories `done`, roll up phase/milestone statuses, refresh progress %. |
| `/roadmap migrate-systems` | Adopt the `system` band on an existing roadmap by interactive inference (collect systems declaration → per-untagged-story proposal incl. done items → one staged diff **incl. the config change** → apply-on-approval → propose commit). Doc-only, apply-contract-compliant — a reject writes nothing; on approval it writes files and proposes a commit, never commits. See `references/mutation-ops.md` → `migrate-systems`. |
| `/roadmap set-system <system> <ids…>` | Assign the `system` band directly (parity with the other mutation ops; also driven via the PM `assign-system` front-door). Doc-only — stages a diff, gates, writes, proposes a commit, never commits. See `references/mutation-ops.md` → `set-system`. |

**Flags** (override config for the current run):

| Flag | Effect |
|---|---|
| `--format md\|html` | Override `output_format` for this run. |
| `--threshold <0-1>` | Override `context_threshold` for this run. |

**Config resolution** — full precedence rules, key descriptions, and the `roadmap.config.json` schema are in `references/config.md`:

```
CLI flag > /roadmap/roadmap.config.json > .orchestrator/config.json > built-in default
```

Key defaults: `output_format = md`, `context_threshold = 0.95`.

---

## Context gate

The goal of this step is to reach holistic confidence ≥ `context_threshold` on the project context and roadmap-specific questions before any decomposition work begins.

### Step 1 — Base context check

Check whether `.orchestrator/PROJECT-CONTEXT.md` exists.

- **If it exists:** read it as the base context. Do not edit it — it is orchestrator-owned. When `/roadmap/CONTEXT.md` is written later, write it as a **roadmap addendum** (milestones, sequencing decisions, release targets, and what "done" means per milestone) — not a full duplicate of the base context.
- **If it is absent:** run the own gate:
  1. Spawn an `Explore`/`explore` subagent: `"Scan this repo and return a structured digest of stack, build/test/lint commands, directory layout, naming conventions, documented domain rules, and any existing specs or PRD files. Read CLAUDE.md, AGENTS.md, README, and config/manifest files."`
  2. Using the digest, run structured user-question rounds (`AskUserQuestion` in Claude Code, `question` in opencode) to fill gaps the scan left ambiguous. Do not re-ask what the scan already covered.
  3. After each round, self-rate holistic confidence (0–1) that the context is complete across all required sections.
  4. Loop until confidence ≥ `context_threshold`. If the user ends the loop early, record the achieved confidence as-is.
  5. Write `/roadmap/CONTEXT.md` with the full gathered context.

### Step 2 — Roadmap-specific grilling (always runs)

In both cases (base context present or absent), grill **only roadmap gaps** the base context does not settle:

- Milestone boundaries: what constitutes each milestone?
- Sequencing / dependencies: what order do milestones and phases need to run in?
- Release targets: are there external dates or contractual milestones?
- Per-milestone "done" criteria: what does completion look like for each milestone?

Ask structured user questions on these gaps until roadmap-clarity confidence ≥ `context_threshold`.

### Step 3 — Seed decomposition

Pull spec and PRD content from `docs/superpowers/specs/*`, `plans/specs/*`, any PRD files found in the repo, and README to seed the decomposition step. These are read-only inputs. (`plans/specs/*` is where the orchestrator brainstormer writes specs; the `ingest-spec` op remains location-agnostic via its explicit path argument — see `references/mutation-ops.md`.)

---

## Decomposition

The decomposition step converts context + spec into a concrete tree and materializes it on disk, but only after the user approves the proposed structure.

### Step 1 — Derive the tree

From the gathered context and spec, derive a full milestone → phase → user-story tree. For each user story, compose a self-contained `orchestrator_brief` (plain language; never references the roadmap's own structure because the orchestrator subagents never see this conversation). The brief ends with: `Commit with trailer: Roadmap-Story: <id>`.

Assign IDs per the scheme in `references/directory-layout.md`:

| Level | Pattern | Example |
|---|---|---|
| Milestone | `NNN-kebab` | `001-bootstrap` |
| Phase | `NNN.M` | `001.1` |
| User Story | `NNN.M.T` | `001.1.1` |

Stable-identity rule (from `references/directory-layout.md`): a number, once assigned, is never renumbered. New items append as the next available number. Logical order is carried by the `sequence` field.

### Step 2 — Present tree summary

Present a tree summary to the user: per-milestone phase/user-story counts, sequence order, and a note of any items with `depends_on` constraints. Do not write any files yet.

### Step 3 — User confirmation

Wait for user approval. Accept edits (add/remove/reorder milestones, rename, adjust dependencies). Revise the tree summary and re-present until the user approves.

### Step 4 — Materialize

On approval:

1. Render each artifact using the template matched to `output_format`:
   - Top-level index: `templates/roadmap-readme.template.md` (or `templates/roadmap-readme.template.html`)
   - Milestone READMEs: `templates/milestone-readme.template.md` (or `templates/milestone-readme.template.html`)
   - Phase READMEs: `templates/phase-readme.template.md` (or `templates/phase-readme.template.html`)
   - User-story files: `templates/user-story.template.md` (or `templates/user-story.template.html`)
2. **Child navigation links.** When filling the child-list tokens, render each child row as a relative link (`<ext>` = `html` in html mode, `md` in md mode):
   - index `{{milestone_list_ordered_by_sequence}}` → each milestone links to `<NNN-slug>/README.<ext>`
   - milestone `{{phase_list_ordered_by_sequence}}` → each phase links to `<NNN.M-slug>/README.<ext>`
   - phase `{{story_list_ordered_by_sequence}}` → each user story links to `<NNN.M.T-slug>.<ext>`
   In md: `- [<id> — <title>](<target>) <status>`. In html: wrap the row label in `<a href="<target>">…</a>`, keeping the status pill and (phase user-story rows) the `<input type="checkbox" disabled>` outside the link. `<NNN-slug>` etc. is the same slug used to name the child's directory/file.
3. Write `/roadmap/roadmap.lock.json` with version, `last_synced_sha: null`, and one entry per item.
4. **Render the readiness views** (see Release readiness → Rendering): **always** render the embedded matrix in `/roadmap/README.<ext>` — a freshly-built untagged roadmap collapses it to a single `(untagged)` column, never omitted; **additionally** materialize the standalone dashboard `/roadmap/release-matrix.<ext>` (from `templates/release-matrix.template.<ext>`) only when the roadmap has ≥1 declared system OR ≥1 tagged story.
5. **Materialize the timestamp-parity gate — html mode only.** When `output_format = html`, copy `scripts/check-timestamp-parity.cjs` into `/roadmap/check-timestamp-parity.cjs` (a zero-dependency Node asset; re-copy on every build so it tracks the installed skill version). It is a shipped **gate asset**, not something this skill runs — see Timestamp-parity gate below. Skip in md mode (md pages carry no dual timestamp).
6. Print a summary of all written paths (including `release-matrix.<ext>` and — in html mode — `check-timestamp-parity.cjs` when rendered).

Item file schema (frontmatter keys, body sections, audit log format) is defined in `references/item-schema.md`. Every user-story file has exactly three body sections: `## Brief`, `## Acceptance`, `## Audit log`.

---

## Sync + Re-eval

The full algorithms — rollup rules, the Sync procedure, and the Re-eval procedure — are the source of truth in `references/sync-and-reeval.md`. This section states the entry conditions and global constraints.

### Entry conditions

| Command | Entry point |
|---|---|
| `/roadmap sync` | Run the **Sync procedure** from `references/sync-and-reeval.md`. Scans git trailers from `last_synced_sha` to HEAD, stamps matched stories `done`, rolls up, updates `roadmap.lock.json`. |
| `/roadmap` (when `/roadmap/` exists) | Run the **Re-eval procedure** from `references/sync-and-reeval.md`. Re-derives the target tree, diffs against `roadmap.lock.json`, presents a staged diff (`+ new`, `~ changed`, `! superseded`), and requires user approval before applying. |

### Global constraints (reaffirmed)

- **Never commit.** The skill writes files and prints proposed commit messages; the user commits.
- **Never run the orchestrator.** User-story briefs are produced for the orchestrator to consume; the roadmap skill does not invoke it.
- **Completed work is immutable.** The Re-eval procedure never deletes or renumbers a `done` item — it supersedes or appends, never rewrites.

---

## Mutation operations

Beyond building, syncing, and re-evaluating, the roadmap skill exposes doc-only **mutation operations** on an existing `/roadmap/`, plus the `migrate-systems` procedure. They are the engine behind the `product-manager` skill's management verbs; the full normative spec is in `references/mutation-ops.md`.

**Release band.** Every item carries an optional `release` band (`string | null`) — classification metadata **orthogonal to `status`**, editable on items of any status. `null`/absent = active untiered; the reserved value `backlog` = parked; any other value = a named release train (`mvp`, `v1.1`, …) registered in the ordered `releases[]` array in `roadmap.lock.json`. The band is nullable and the registry is lazily created, so legacy roadmaps are untouched (no migration). See `references/item-schema.md` and `references/directory-layout.md`.

**System band.** Every item also carries an optional `system` band (`string | null`) — a **second classification axis orthogonal to both `status` and `release`** (a monorepo story belongs to one deployable system, e.g. `backend`, and to one release train, e.g. `mvp`, at once). It mirrors the `release` band's machinery (nullable per-item field, cascade to not-done descendants, derived phase/milestone badge — `[cross-cutting]` in place of `[mixed]`, editable on frozen items) with deliberate differences: the set of systems is **config-declared** in `roadmap.config.json` → `systems` (not a lazily-grown lock registry) and managed with referential integrity by the `system <list\|add\|rename\|remove>` op (below), systems are an **unordered peer set**, each may carry an optional `path`, and assigning an **undeclared system is an error** (typo guard) — `null` (untag) is always permitted. The band is nullable and lazily written, so legacy roadmaps render and execute unchanged (no badges; no forced migration). The rationale for modeling systems as an orthogonal band (rather than directory structure) and the integrity/namespace obligations it imposes are recorded in [ADR-0001](../../../../docs/adr/0001-orthogonal-system-band.md). See `references/config.md`, `references/item-schema.md`, and `references/directory-layout.md`.

**The ops at a glance** (each: **stage a diff → gate on approval → write files → propose a commit → never commit**):

| Op | Purpose |
|---|---|
| `set-release <release> <ids…>` | Assign a release band; cascades to not-done descendant stories for a phase/milestone id, derived `[mixed]` badge when children differ. |
| `set-system <system> <ids…>` | Assign a system band (parallel to `set-release`); cascades to not-done descendant stories for a phase/milestone id, derived `[cross-cutting]` badge when children differ. `<system>` must be declared in `config.systems` or `null` — undeclared errors (typo guard). |
| `ingest-spec <path>` | Targeted re-eval scoped to one spec file; appends new work (default `release: null`, `system: null`), immutable to done work, preserves existing bands. |
| `reorder <ids-in-order>` | Change `sequence`/`depends_on` of **not-done** items only. |
| `revise <id>` | Retitle / re-scope, or split/merge via new stable IDs + supersede — **not-done** items only. |
| `release <list\|reorder\|rename>` | Manage the `releases[]` registry order and names. |
| `system <list\|add\|rename\|remove>` | Manage the config-owned `config.systems` set with **referential integrity**: `rename` cascades to every referencing story atomically; `remove` is guarded (refuses while referenced, or `--untag` nulls them in the same diff); `add`/`rename` reject names colliding with a reserved word / release / milestone-phase id (so the PM bare-`complete <name>` scope stays reachable); `list` reports orphan **and** shadowed-name references. Prevents hand-edits from orphaning story `system` values. |
| `add-item <kind> [--to <parent-id>] [--system <name\|null>]` | Append one new milestone/phase/user-story directly, without a spec file; owns id assignment and id-dependent fields. `--system` sets the band at creation (declared name or `null`, typo-guarded). |

Alongside the ops, the **`migrate-systems`** procedure adopts the `system` band on an existing roadmap: collect the systems declaration in memory (if `config.systems` is empty — **not written yet**) → per-untagged-story inference (including `done` items, so completed work counts toward readiness) → one whole-roadmap staged diff that includes **both the pending `config.systems` change and** the `⊞ system` story rows, grouped by proposed system → gate → on approval, write config then bulk-apply via `set-system` semantics → propose commit `docs(roadmap): migrate-systems`, never commit. Apply-contract-compliant: **a reject writes nothing** (config included). Idempotent; un-inferable stories stay `null` and are reported. See `references/mutation-ops.md` → `migrate-systems`.

The staged-diff marker set extends the re-eval markers with two band markers: `+ new`, `~ changed`, `! superseded`, `± release`, `⊞ system`. Structural edits (`reorder`, `revise`, split/merge) apply to not-done items only; a frozen `done`/`superseded` item may only have its `release` band or `system` band changed.

---

## Release readiness

Because `release` and `system` are **orthogonal** bands, a story sits in exactly one cell of a **`release × system` matrix**. Release readiness is the question "is this release shippable across *every* system, or is one lagging?" — answered by a **pure derivation** over story `status`, `release`, and `system`. **No new state is stored**; the matrix is recomputed on demand from `roadmap.lock.json` (the per-item `status`/`release`/`system` values) and the `config.systems` set.

### Derivation

```
cell(release r, system s) := { done:  |stories where release=r ∧ system=s ∧ status ∈ {done, superseded}|,
                               total: |stories where release=r ∧ system=s| }

READY(r) := every not-superseded story with release=r is done, regardless of system
          ( equivalently: no cell in row r — every declared-system column, the (untagged) column,
            AND the (unknown) column when present — has remaining not-done work )
```

- `superseded` stories count toward "no remaining work" exactly as in the rollup function (`references/sync-and-reeval.md` → Rollup rules) — they are done-or-gone.
- **Untagged (`system: null`) stories** appear in a dedicated **`(untagged)` column** so nothing is silently dropped. A legacy roadmap with nothing tagged collapses to this single column.
- **Orphan (undeclared) stories** — a story whose `system` is **non-null but not in `config.systems`** (an integrity violation, e.g. left by a manual `roadmap.config.json` rename/removal) is bucketed into an explicit **`(unknown)` column** rather than dropped. The column is rendered **only when ≥1 orphan exists**, and both views emit an **integrity note listing the affected story ids** (the fix is `system rename <orphan> <declared>` or `set-system null <ids>` — see `references/mutation-ops.md` → `system` / Orphan handling). The `(unknown)` column counts as a laggard in `READY` exactly like a declared column: a release with remaining not-done orphan work is **not** `READY`. Going through the `system` op never creates orphans — only hand-editing config can.
- Rows are the named releases in `roadmap.lock.json` → `releases[]` order, plus a single **untiered row** for `release: null` stories. **`backlog` is NOT a matrix row** — parked work is not a shippable release train, so a `READY?` verdict on it would be meaningless; stories with `release: backlog` are **excluded from the readiness matrix entirely** (they stay visible via `complete backlog`, the per-release progress summary, and the by-release grouping). Columns are the declared `config.systems` (any order — systems are unordered peers), then `(untagged)`, then `(unknown)` **only when orphans exist**.
- **Synthetic columns are identified by story state, never by a name string.** The `(untagged)` column holds `system: null` stories and `(unknown)` holds non-null-but-undeclared stories — routed structurally, not by matching any name against `"untagged"`/`"unknown"`. Their **parenthesized labels** are reserved display forms distinct from any bare (unparenthesized) `config.systems` name, so a real system legitimately named `untagged` or `unknown` renders as its **own** `untagged` / `unknown` column and is never conflated with the synthetic one (parallel to the badge state/name separation — see `references/item-schema.md`).

### Where it renders

The same derivation surfaces in **two** locations (both are pure views — neither stores state):

1. **Roadmap index README section** — an embedded compact readiness matrix in the top-level `/roadmap/README.<ext>` (see `templates/roadmap-readme.template.*` and design prompt `docs/design-prompts/13-roadmap-system-badge-and-matrix-additions.md`).
2. **Dedicated dashboard artifact** — a standalone file `/roadmap/release-matrix.<ext>` (rendered from `templates/release-matrix.template.*`; `<ext>` per `output_format`) showing the full `release × system` grid with per-cell `done/total`, a `READY?` verdict column, and laggard callouts (see design prompt `docs/design-prompts/12-roadmap-release-matrix.md`). It sits at the roadmap root beside `README.<ext>` (see `references/directory-layout.md`) and is linked from the index's Release-readiness section.

**Rendering (the two views render on different conditions).**

- **Embedded index section — always renders.** The Release-readiness section of `/roadmap/README.<ext>` is **always present** (it is a section of the always-materialized index). A roadmap with **no declared systems and nothing tagged collapses the matrix to a single `(untagged)` column** — the `(untagged)` column is **never dropped** and the section is **never omitted** (locked backward-compatibility contract; see `templates/roadmap-readme.template.*` and design prompt 13). Rows are the `releases[]` + the `(untiered)` row (release: `backlog` is excluded — see Derivation); a release-less roadmap shows just the `(untiered)` row × the `(untagged)` column.
- **Standalone dashboard file — gated.** `/roadmap/release-matrix.<ext>` is **materialized only when the roadmap has ≥1 declared system OR ≥1 tagged story** (a `release` or `system` band). Until then the embedded section is the sole readiness view; the first band assignment (`set-release`/`set-system`/`add-item` with a band, or `migrate-systems`) creates the file. This keeps a pristine roadmap from carrying a trivial standalone dashboard while the index still always shows readiness.

**Refresh rule (normative — the readiness views are derived, never stored).** Any lifecycle step that changes a **readiness input** MUST re-render the readiness views in the **same write pass** that applies the change: the **embedded index matrix always** (it always exists), and the **standalone dashboard** when it exists or the change first warrants it (per the gate above). The readiness inputs are: a story's `status`, `release`, or `system`; the `releases[]` registry order or names; and the `config.systems` set. Steps that touch **none** of these inputs (e.g. `reorder`, which changes only `sequence`) leave both untouched. The concrete lifecycle sites that carry this obligation are Materialize (build, below), the Sync and Re-eval procedures (`references/sync-and-reeval.md`), and the mutation ops apply contract (`references/mutation-ops.md`).

The `product-manager` skill exposes the same derivation read-only via its `release-status [release]` verb (`product-manager/references/scope-resolution.md` / `product-manager/SKILL.md`); it computes exactly the matrix defined here — no divergent logic.

---

## Timestamp-parity gate (html mode)

Every rendered `.html` page carries its update timestamp **twice** — machine-readable `data-updated-at="{{updated_at}}"` on the root `<main>` and the visible `updated:` metadata value — both filled from one `{{updated_at}}` at render time. They can silently **diverge** afterward, because every re-render site (Materialize, Sync, Re-eval, the mutation-ops apply contract) rewrites pages in place and an edit can touch one occurrence and miss the other. Automated readers then trust one history while humans read another.

`scripts/check-timestamp-parity.cjs` is a **fail-closed** gate that guards against this. It is materialized into `/roadmap/check-timestamp-parity.cjs` in html mode (build Step 5) as a shipped asset. **This skill is doc-only — it writes the gate but never runs it.** The gate is run by CI, by the orchestrator's gating, or by the user:

```
node roadmap/check-timestamp-parity.cjs            # branch scope: added/modified roadmap/**.html vs merge-base
node roadmap/check-timestamp-parity.cjs --all      # audit every roadmap page (self-contained)
node roadmap/check-timestamp-parity.cjs -- a.html  # audit explicit pages only (self-contained)
```

- **Fails closed on either half missing**, not only on a value mismatch: a page missing `data-updated-at` *or* the visible `updated:` value fails, so a half-rendered page can't slip through as a false OK. Only the **top-level roadmap index** — which self-identifies with `data-kind="roadmap-index"` — is allowed to carry **neither** timestamp and is skipped; every other roadmap page (milestone / phase / story / release-matrix, including nested `README.html`) that drops **both** markers fails closed (bug-2: keying the skip on "neither marker present" let a real item page fail open).
- **Branch scope** (the default) reuses the orchestrator's shared `.orchestrator/gate-scope.cjs` — present whenever the orchestrator/PM stack is bootstrapped alongside the roadmap. The `--all` and explicit `--` modes are **self-contained** (no `.orchestrator/` needed), so a standalone roadmap can still audit its pages.
- Regression harness: `scripts/check-timestamp-parity.test.cjs` (six fixtures proving fail-closed; run `node scripts/check-timestamp-parity.test.cjs`).

Applies to **html mode only** — the `.md` variants carry `updated_at` once (frontmatter), so there is nothing to diverge and no gate is shipped.

---

## References

All normative details live in these files (relative to `plugins/my-skills/skills/roadmap/`):

| File | Content |
|---|---|
| `references/directory-layout.md` | Directory tree, ID scheme, stable-identity rule, `roadmap.lock.json` schema (incl. `items[].system`; the `system` set lives in config) |
| `references/item-schema.md` | Frontmatter keys (incl. `release` and `system` bands), body sections, audit log format (incl. release-change + system-change rows), rollup function, derived badges (`[mixed]`/`[cross-cutting]`), html rendering rules |
| `references/config.md` | Config keys (incl. `systems: [{name, path?}]`), precedence chain, typo-guard rationale, `system`-op integrity lifecycle + orphan handling, `roadmap.config.json` schema |
| `references/sync-and-reeval.md` | Rollup rules, Sync procedure (git command + steps), Re-eval procedure (incl. band preservation for `release` + `system` + `ingest-spec`) |
| `references/mutation-ops.md` | Mutation ops (`set-release`, `set-system`, `ingest-spec`, `reorder`, `revise`, `release`, `system`, `add-item`) + `migrate-systems`, staged-diff markers (incl. `⊞ system`), cascade + `[mixed]`/`[cross-cutting]` badges, structural immutability, orphan handling |
| `scripts/check-timestamp-parity.cjs` | Fail-closed html-mode gate: a page's machine-readable `data-updated-at` must equal its visible `updated:` value (see Timestamp-parity gate). Materialized into `/roadmap/` in html mode; run by CI/orchestrator/user, never by this skill. |
| `scripts/check-timestamp-parity.test.cjs` | Standalone regression harness for the gate (six fixtures proving fail-closed). |

Templates (rendered per `output_format`):

| Template | Used for |
|---|---|
| `templates/roadmap-readme.template.md` | Top-level `/roadmap/README.md` (md mode) |
| `templates/roadmap-readme.template.html` | Top-level `/roadmap/README.html` (html mode) |
| `templates/milestone-readme.template.md` | Milestone `README.md` (md mode) |
| `templates/milestone-readme.template.html` | Milestone `README.html` (html mode) |
| `templates/phase-readme.template.md` | Phase `README.md` (md mode) |
| `templates/phase-readme.template.html` | Phase `README.html` (html mode) |
| `templates/user-story.template.md` | User-story file (md mode) |
| `templates/user-story.template.html` | User-story file (html mode) |
| `templates/release-matrix.template.md` | `release × system` readiness dashboard (md mode) |
| `templates/release-matrix.template.html` | `release × system` readiness dashboard (html mode) |

All four item templates (`roadmap-readme`, `milestone-readme`, `phase-readme`, `user-story`) carry a `system` badge token alongside the existing release badge; the `roadmap-readme` index additionally embeds a compact readiness-matrix section. Both `.md` and `.html` variants stay at parity. The Claude-design prompts that specify these templates are `docs/design-prompts/12-roadmap-release-matrix.md` (the dashboard) and `docs/design-prompts/13-roadmap-system-badge-and-matrix-additions.md` (the badge + embedded matrix additions).
