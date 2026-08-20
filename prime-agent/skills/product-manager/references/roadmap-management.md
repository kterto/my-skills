# Product Manager — Roadmap-Management Reference

This document is the single source of truth for PM's **management verb surface** — the intent-driven front-door that mutates the roadmap. Where `complete <scope>` *executes* stories, the management verbs *reshape the plan*: they resolve a selection, cut a planning branch, invoke a roadmap mutation op (which stages a diff, gates on approval, and writes files), then commit / push / open a planning PR.

`SKILL.md` references this document by name: **Verb catalog**, **Selection resolution**, **Confirmation gate**, **Reject-and-discard**, **Spec-creation two-step**.

**Division of labor (unchanged invariant).** Exactly one skill — `roadmap` — writes `/roadmap/`. PM never edits roadmap files itself; it invokes the roadmap op, which owns the staged-diff → approve → write → propose-commit model. PM then does the git: branch, commit, push, PR. See `roadmap/references/mutation-ops.md` for op semantics.

---

## Verb catalog

Each management verb maps to exactly one roadmap mutation op. Sugar verbs are thin aliases over `set-release`.

| PM verb | Roadmap op | Notes |
|---|---|---|
| `assign <release> <selection>` | `set-release <release> <ids…>` | Assign a named band (or `backlog`) to the resolved id set. Implicitly creates the band in `releases[]` on first use. |
| `assign-system <system> <selection>` | `set-system <system> <ids…>` | Assign a **system** band to the resolved id set. `<system>` must be declared in `config.systems` (typo-guarded) or `null` to untag — unknown stops and prints the valid system names. Does **not** create a band lazily (unlike `assign`). |
| `migrate-systems` | `migrate-systems` | Adopt the `system` band on the existing roadmap via the roadmap `migrate-systems` procedure (collect systems declaration → per-untagged-story inference incl. done items → one staged diff **incl. the config change** → apply-on-approval, reject writes nothing). Wrapped in the planning-PR flow. |
| `park <selection>` | `set-release backlog <ids…>` | Sugar for `assign backlog <selection>`. Parks work out of the active plan. |
| `unpark <selection> [<release>]` | `set-release <release-or-null> <ids…>` | Sugar. With a release name → re-tier to that band; omitting the release → un-tier to `null` (active untiered). |
| `add-spec <path>` | `ingest-spec <path>` | Append a spec's new work as a targeted re-eval (new items default `release: null`). Location-agnostic explicit path. |
| `new-spec [raw idea]` | *(none directly)* | Two-step spec creation — see **Spec-creation two-step**. Spawns the orchestrator brainstormer, then STOPS. Does not mutate the roadmap. |
| `reorder <ids-in-order>` | `reorder <ids-in-order>` | Change `sequence`/`depends_on` of **not-done** items only. Accepts `--after <id>`. |
| `revise <id>` | `revise <id>` | Retitle / re-scope, or split/merge via new stable IDs + supersede — **not-done** items only. |
| `release <list\|reorder\|rename …>` | `release <list\|reorder\|rename …>` | Manage the ordered `releases[]` registry. `list` is read-only (no branch/PR). |
| `system <list\|add\|rename\|remove …>` | `system <list\|add\|rename\|remove …>` | Manage the config-owned `config.systems` set with **referential integrity**: `rename` cascades to referencing stories; `remove` is guarded (refuses while referenced, or `--untag`); `add` is collision-guarded; `list` is read-only and reports orphan references. Prevents hand-edits from orphaning story `system` values. `list` runs with no branch/PR. |
| `add-milestone <title> [--system <name\|null>]` | `add-item milestone [--system …]` | Create a milestone; seeds a default phase `NNN.1-general` so tickets can drop straight in. |
| `add-phase <title> --to <milestone> [--system <name\|null>]` | `add-item phase [--system …]` | Create a phase under a milestone. |
| `add-ticket <raw> [--to <phase\|milestone>] [--system <name\|null>]` | `add-item user-story [--system …]` | Inline interview composes a story from raw text (bug or feat). `--to` a milestone auto-creates/uses a default phase. |
| `add-userstory …` | `add-item user-story [--system …]` | Alias of `add-ticket`. |

The staged-diff marker set (shared with re-eval + the roadmap ops) is `+ new`, `~ changed`, `! superseded`, `± release`, `⊞ system`. A release-band change (`assign`/`park`/`unpark`) shows as `± release`; a system-band change (`assign-system`, and the bulk `migrate-systems`) shows as `⊞ system`.

**Read-only reporting verb.** `release-status [release]` prints the derived `release × system` readiness matrix (per-cell `done/total`, `READY?`/laggards) and, like `release list`, runs with **no branch, no gate, no PR** — it maps to no mutation op. It computes exactly the matrix defined in `roadmap/SKILL.md` → Release readiness (no divergent logic). See `SKILL.md` → Verb → roadmap op mapping.

---

## Front-door flow (per management verb)

Every mutating verb runs this sequence (mirrors the `complete` machinery's base-resolution + PR flow; see `references/git-flow.md` → **Planning-PR flow**):

1. **Resolve selection** → an exact id set (see **Selection resolution**).
2. **Cut a planning branch** `pm/roadmap-<verb>-<slug>` off the PM starting branch (existing base resolution).
3. **Invoke the roadmap op**, which **stages a diff** listing the exact resolved id set and the `+ ~ ! ±` changes, then **gates** (see **Confirmation gate**).
4. **On approval** → the op writes files and prints a proposed commit message. **Then, in html mode, run the timestamp-parity gate** (see `git-flow.md` → **Timestamp-parity gate**) over any roadmap `.html` page the op re-rendered — **regardless of readiness-input classification**: `reorder`, an ordinary `revise`, and structural additions re-render pages (re-ordered child lists, bumped `updated:` stamps) without changing a readiness input, yet each can drift the dual timestamp, so the gate runs after **every** HTML-writing mutation, not only readiness-input ops (bug-2). A red gate **halts before the commit**. Otherwise PM commits `docs(roadmap): <verb> …`, pushes, and opens a planning PR (`templates/pr-body.template.md` planning variant).
5. **On reject** → PM discards the empty branch and returns to the starting branch (see **Reject-and-discard**).

`release list`, `system list`, and `release-status` are read-only: they print and exit with no branch, gate, or PR.

The `add-*` verbs follow this same flow; `add-ticket` first runs the inline interview (below) to compose the story body before invoking `add-item`.

**`assign-system` / `migrate-systems` specifics.**

- **`assign-system <system> <selection>`** resolves the selection to an id set (ids/globs **and** natural language, exactly like `assign`), cuts `pm/roadmap-assign-system-<slug>`, invokes roadmap `set-system` (which stages the `⊞ system` diff, gates, writes), then commits `docs(roadmap): assign-system …`, pushes, and opens the planning PR. `--yes` is supported (unambiguous ids). The system is **typo-guarded against `config.systems`**: an undeclared system stops before any branch is cut and prints the valid system names; `null` untags.
- **`migrate-systems`** takes no selection — it cuts `pm/roadmap-migrate-systems`, then invokes roadmap `migrate-systems`, whose **interactive** procedure collects the `config.systems` declaration (if empty — **held in memory, not written yet**), proposes a system for every untagged story (including `done` items), and presents one whole-roadmap staged diff that includes **both the pending config change and** the `⊞ system` rows, grouped by proposed system. On approval the op writes config then bulk-applies (a **reject writes nothing**, config included); PM then commits `docs(roadmap): migrate-systems`, pushes, and opens the planning PR. The bare `/roadmap migrate-systems` direct command performs the same doc-only write **without** the git/PR wrapper. Idempotent — re-running only proposes for still-untagged stories.

**`system <list | add | rename | remove>` specifics.** Manages the `config.systems` set with referential integrity — the system-band analog of `release <list|reorder|rename>` (there is no `reorder`; the set is unordered):

- **`system list`** is **read-only** (no branch/gate/PR): prints the declared systems with per-system story counts and reports both **orphan** references (a story whose `system` is non-null but undeclared) **and shadowed systems** (a declared name colliding with a reserved word / release / milestone / phase, so its bare-`complete <name>` scope is unreachable — fix via `system rename`, or select it with the explicit `system:<name>` form). Mirrors `release list` / `release-status`.
- **`system add <name> [path]`** cuts `pm/roadmap-system-add-<slug>`, invokes roadmap `system add`, commits `docs(roadmap): system add …`, pushes, opens the planning PR. **Name guard:** `<name>` is rejected if it collides with another declared system, a reserved scope word (`roadmap`, `backlog`), a registered release name, or a milestone/phase id/slug — a colliding system would be **shadowed** in the bare-`complete <name>` scope (use `system:<name>` to reach it). **Path guard:** a supplied `path` must pass the `roadmap/references/config.md` → `path` validation rule (normalized repo-relative; no absolute/`..`/control-char/newline) — this is a security control, since `path` is later surfaced into the command-capable orchestrator handoff. PM stops before cutting the branch and prints the conflict/invalid-path reason.
- **`system rename <old> <new>`** cuts `pm/roadmap-system-rename-<slug>`; roadmap `system rename` stages a `~ changed` (config) + `⊞ system` (each referencing story) diff, gates, writes; PM commits `docs(roadmap): system rename …`, pushes, opens the PR. The rename **cascades to every referencing story atomically** (frozen items included), so no orphan is produced. `<new>` is subject to the **same name guard** as `system add` (rejected on collision with a reserved word / release / milestone-phase id); `system rename` is also the fix for a shadowed or orphaned system surfaced by `system list`.
- **`system remove <name> [--untag]`** cuts `pm/roadmap-system-remove-<slug>`; roadmap `system remove` is **guarded** — it stops (before any write) while stories still reference `<name>`, printing the ids, unless `--untag` nulls them in the same staged diff. PM commits `docs(roadmap): system remove …`, pushes, opens the PR.

`--yes` is supported on the writing sub-ops (unambiguous). A **manual `roadmap.config.json` edit** that orphans references is surfaced defensively — `system list` and `release-status` show the orphans; readiness views render an `(unknown)` column (see `roadmap/references/config.md` → Orphan handling).

---

## Selection resolution

A verb's `<selection>` may be given two ways; both resolve to an **exact id set** that the staged diff lists before anything is applied:

- **Ids / globs** — explicit stable ids and glob patterns, e.g. `001.2.3`, `001.1.*`, `002.*.*`. Matched against the tree by id-prefix (same membership rule as `references/scope-resolution.md` → Data sources).
- **Natural language** — a phrase describing the intent, e.g. `"make auth and onboarding the MVP"`. PM resolves it against the roadmap tree (milestone/phase/story titles + briefs) to a concrete id set.

**Whichever form is used, the resolved id set is shown in the staged diff and requires approval before applying.** Natural-language selection never mutates blindly: the gate is where the user confirms PM resolved the right ids. If a phrase is ambiguous, PM presents its best-effort id set in the staged diff for the user to correct or reject.

Structural verbs (`reorder`, `revise`) resolve only **not-done** items; a selection that names a `done`/`superseded` item for a structural change is reported and excluded (bands are the only mutation allowed on frozen items — see `roadmap/references/mutation-ops.md` → Structural immutability).

---

## Confirmation gate

Every mutating verb shows the staged diff and requires explicit approval before the roadmap op writes any file:

- The gate displays the exact resolved id set and the `+ new` / `~ changed` / `! superseded` / `± release` rows the op will apply.
- **`--yes`** skips the gate for trusted quick edits — PM passes it through to the roadmap op, which writes without prompting. Use only when the selection is unambiguous (explicit ids). `--yes` never bypasses the PR: the planning PR is still opened so the change is reviewable.
- `release list`, `system list`, and `release-status` have no gate (read-only).

---

## Reject-and-discard

If the user rejects at the staged-diff gate (or the op yields an empty diff — nothing to change):

1. The roadmap op writes **nothing**.
2. PM discards the planning branch `pm/roadmap-<verb>-<slug>` (it has no commits) and returns to the starting branch, leaving the working tree exactly as it was.
3. PM reports the discard (verb, resolved id set, reason: rejected / empty-diff). No PR is opened.

See `references/git-flow.md` → **Reject-and-discard** for the git steps.

---

## Spec-creation two-step (`new-spec` → `add-spec`)

Turning a raw idea into roadmap work is deliberately **two-gated** so the spec is validated before it reshapes the plan, and the roadmap change is validated before commit:

1. **`new-spec "raw idea"`** — PM spawns the **orchestrator brainstormer subagent** (reused unchanged) with the raw idea. The brainstormer interviews as needed and writes `plans/specs/SPEC-{id}.md`.
2. **STOP for user review.** PM does **not** auto-append to the roadmap. It surfaces the written spec path and stops so the user can review/edit the spec.
3. **`add-spec plans/specs/SPEC-{id}.md`** — after the user approves the spec, they (or PM on request) run `add-spec` with the spec path. This maps to roadmap `ingest-spec`, which stages an append diff (`+ new`, new items default `release: null`), gates, and — on approval — writes; PM then commits / pushes / opens the planning PR.

`new-spec` itself never mutates the roadmap and opens no PR — it only produces a spec for review. The roadmap seed list recognizes `plans/specs/*` (roadmap `SKILL.md` → Context gate Step 3), and `ingest-spec` stays location-agnostic via its explicit path argument.

---

## Ticket-creation inline interview (`add-ticket` / `add-userstory`)

`add-ticket "<raw>"` composes a single **user-story** from raw text — no spec file, one planning PR. It reuses the management-verb front-door; the only addition is composing the story body before invoking `add-item`.

1. **Clarity threshold.** PM tests the raw input: can it write a self-contained `## Brief` plus at least one testable `## Acceptance` criterion from the text as given? If yes → compose the story and ask nothing. If gaps remain → grill **one question at a time** (`AskUserQuestion` in Claude Code, the `question` tool in opencode) until the threshold is met.
2. **Compose.** PM produces `title` (short), the `## Brief` body (plain-language, self-contained — the orchestrator never sees this conversation), and `## Acceptance` (testable criteria). PM does **not** write the trailer line; `add-item` appends `Commit with trailer: Roadmap-Story: <id>` and sets `commit_trailer` once it assigns the id.
3. **Placement (`--to`).**
   - a **phase** id → append the story to that phase.
   - a **milestone** id with **no** phase → `add-item` auto-creates the default phase, then appends (both shown as `+ new`).
   - a **milestone** id **with** phases → append to its `-general`/default phase (create one if absent).
   - omitted → PM asks for a target before cutting a branch.
4. **Invoke `add-item user-story`** with the composed body → it stages the `+ new` diff (showing resolved parent, Brief, Acceptance), gates, writes, and proposes the commit. PM then commits `docs(roadmap): add-ticket …`, pushes, opens the planning PR.

**Bugs.** A bug ticket is composed as: Brief = reproduction steps + expected-vs-actual + fix intent; Acceptance = "the bug no longer reproduces" + "a regression test covers it". No schema affordance — the bug framing lives entirely in the prose.

**Confirmation gate.** The composed story is **always** shown in the staged diff before write — it is the thing worth reviewing. Therefore `--yes` on `add-ticket` still shows the diff (unlike `add-milestone`/`add-phase`, where `--yes` skips the gate for unambiguous structural adds). The planning PR is always opened.

---

Cross-references:
- Roadmap op semantics (the engine): `roadmap/references/mutation-ops.md`
- Planning-PR git flow (branch, commit, push, reject-discard): `references/git-flow.md`
- Release-as-scope + backlog exclusion for `complete`: `references/scope-resolution.md`
- Planning-PR body: `templates/pr-body.template.md`
