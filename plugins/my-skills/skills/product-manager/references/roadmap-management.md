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
| `park <selection>` | `set-release backlog <ids…>` | Sugar for `assign backlog <selection>`. Parks work out of the active plan. |
| `unpark <selection> [<release>]` | `set-release <release-or-null> <ids…>` | Sugar. With a release name → re-tier to that band; omitting the release → un-tier to `null` (active untiered). |
| `add-spec <path>` | `ingest-spec <path>` | Append a spec's new work as a targeted re-eval (new items default `release: null`). Location-agnostic explicit path. |
| `new-spec [raw idea]` | *(none directly)* | Two-step spec creation — see **Spec-creation two-step**. Spawns the orchestrator brainstormer, then STOPS. Does not mutate the roadmap. |
| `reorder <ids-in-order>` | `reorder <ids-in-order>` | Change `sequence`/`depends_on` of **not-done** items only. Accepts `--after <id>`. |
| `revise <id>` | `revise <id>` | Retitle / re-scope, or split/merge via new stable IDs + supersede — **not-done** items only. |
| `release <list\|reorder\|rename …>` | `release <list\|reorder\|rename …>` | Manage the ordered `releases[]` registry. `list` is read-only (no branch/PR). |

The staged-diff marker set (shared with re-eval + the roadmap ops) is `+ new`, `~ changed`, `! superseded`, `± release`. A band change (`assign`/`park`/`unpark`) shows as `± release`.

---

## Front-door flow (per management verb)

Every mutating verb runs this sequence (mirrors the `complete` machinery's base-resolution + PR flow; see `references/git-flow.md` → **Planning-PR flow**):

1. **Resolve selection** → an exact id set (see **Selection resolution**).
2. **Cut a planning branch** `pm/roadmap-<verb>-<slug>` off the PM starting branch (existing base resolution).
3. **Invoke the roadmap op**, which **stages a diff** listing the exact resolved id set and the `+ ~ ! ±` changes, then **gates** (see **Confirmation gate**).
4. **On approval** → the op writes files and prints a proposed commit message; PM commits `docs(roadmap): <verb> …`, pushes, and opens a planning PR (`templates/pr-body.template.md` planning variant).
5. **On reject** → PM discards the empty branch and returns to the starting branch (see **Reject-and-discard**).

`release list` is read-only: it prints the registry and exits with no branch, gate, or PR.

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
- `release list` has no gate (read-only).

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

Cross-references:
- Roadmap op semantics (the engine): `roadmap/references/mutation-ops.md`
- Planning-PR git flow (branch, commit, push, reject-discard): `references/git-flow.md`
- Release-as-scope + backlog exclusion for `complete`: `references/scope-resolution.md`
- Planning-PR body: `templates/pr-body.template.md`
