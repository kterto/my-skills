# Product Manager — Direct-Add Verbs (`add-milestone` / `add-phase` / `add-ticket`)

**Status:** Approved design
**Date:** 2026-07-13
**Skills touched:** `product-manager`, `roadmap` (+ their `.opencode/` ports)

---

## Problem

The `product-manager` (PM) and `roadmap` skills let a user *reshape* an existing roadmap through management verbs (`assign`, `park`, `unpark`, `add-spec`, `new-spec`, `reorder`, `revise`, `release`), each mapping to one of the roadmap skill's five mutation ops (`set-release`, `ingest-spec`, `reorder`, `revise`, `release`).

There is **no lightweight path to append a single new work item**. Today an item can only enter the roadmap via:

- `ingest-spec` — requires a written spec file (`plans/specs/SPEC-*.md`), and the `new-spec → add-spec` two-step opens two planning PRs; or
- a full `/roadmap` re-evaluation of the whole project context.

Both are too heavy for the common case: *"I have a few fix tickets to drop onto the roadmap so I don't lose sight of them — maybe under a new 'Stabilization' milestone."*

## Goal

Add a **direct-add** path: single-verb, single-PR creation of one milestone, phase, or user-story, without authoring a spec file. A ticket is grilled from raw input into a proper, orchestrator-ready user-story so PM can later `complete` it like any other story.

## Non-goals

- No new item **kind**. A "ticket" is a `user-story` (the roadmap's atomic executable unit). `add-ticket` and `add-userstory` are aliases.
- No bug/feat **type tag** in the schema. Bug vs feature is expressed in the story's title and Brief prose only.
- No change to the one-writer invariant, the stable-identity rule, or structural immutability of `done`/`superseded` work.
- No merging of PRs (unchanged PM boundary).

## Definitions

- **Ticket** = a `user-story`. Bug or feature — same path, same schema.
- **Direct-add** = appending a new item to an existing `/roadmap/` without a spec file, via a new roadmap mutation op driven by a PM front-door verb.
- **Clarity threshold** = the bar the raw ticket text must clear for PM to write the story without asking questions: a self-contained Brief plus at least one testable Acceptance criterion can be composed from the input as given.

---

## Design

### 1. New roadmap mutation op — `add-item` (the engine)

A sixth mutation op in `roadmap/references/mutation-ops.md`. The roadmap skill remains the **sole writer** of `/roadmap/`; PM resolves inputs and does the git.

**Signature (conceptual):**

```
add-item <kind> [--to <parent-id>]
```

with the item body (title, and for a story the Brief-body + Acceptance) supplied by the caller.

- `<kind>` ∈ `milestone | phase | user-story`.
- `--to <parent-id>` names the parent scope:
  - `user-story` → a **phase** id, or a **milestone** id (auto-phase, see §3).
  - `phase` → a **milestone** id.
  - `milestone` → no parent.

**Apply contract (identical to the other ops):**

1. **Stage** — compute the new item against the current tree + `roadmap.lock.json`; list it in a staged diff with the `+ new` marker (and `+ new` for an auto-created default phase, when applicable). The staged diff for a story shows its resolved parent, composed Brief, and Acceptance.
2. **Gate** — present the staged diff; require explicit approval. `--yes` (passed through from the PM front-door) skips the gate — see §4.
3. **Write** — on approval, materialize the item file(s), append the creation audit row, and update `roadmap.lock.json`.
4. **Propose commit** — print a `docs(roadmap): add-<kind> …` message. **Never commit.**
5. Never commit / never run the orchestrator.

**ID assignment (stable-identity rule).** The new item takes the **next available number** in its parent scope: `NNN` for a milestone, `NNN.M` for a phase, `NNN.M.T` for a story. Numbers are identity, never renumbered. New item frontmatter:

- `status: todo`
- `release: null` (untiered — inherits no band; user re-bands later via `assign` if desired)
- `sequence` = (max existing `sequence` in the parent scope) + 1
- `created_at` / `updated_at` = write timestamp
- creation audit row seeded (see below)

**Per-kind write behavior:**

- **`user-story`.** The op **owns the id-dependent fields**: it assigns the id, sets `commit_trailer: Roadmap-Story: <id>`, and appends the line `Commit with trailer: Roadmap-Story: <id>` as the final line of the `## Brief`. The caller (PM) supplies only `title`, the Brief body, and the `## Acceptance` content. This keeps id assignment inside the single writer. The three body sections (`## Brief`, `## Acceptance`, `## Audit log`) are written in schema order.
- **`milestone`.** Creates `NNN-<slug>/README.md`, then **seeds one default phase** `NNN.1-general/README.md` (empty) so a subsequent `add-ticket --to <milestone>` has a landing phase. Both the milestone and its default phase appear as `+ new` rows in the staged diff.
- **`phase`.** Creates `NNN.M-<slug>/README.md` under the target milestone.

**Empty-scope rollup.** A phase or milestone with no not-done descendant stories derives `status: todo` and renders **no release badge** (extends the rollup table in `item-schema.md`). This covers a freshly seeded default phase and a new empty milestone.

**Creation audit row.** One row appended to the new item's `## Audit log`:

| Column | Value |
|---|---|
| `when` | write timestamp |
| `status` | `todo` |
| `who` | `roadmap-skill` (or a user handle) |
| `evidence` | `/roadmap add-item` — a front-door caller may append its attribution suffix, e.g. `/roadmap add-item (via /product-manager add-ticket)`, mirroring the `set-release` evidence-suffix convention. |

**`roadmap.lock.json`.** Append one `items[]` entry per new file (milestone + default phase, or phase, or story) with `id`, `kind`, `status: todo`, `release: null`, freshly computed `content_hash`, and `sequence`.

**Backward compatibility.** `add-item` never rewrites or renumbers existing items and never touches `done`/`superseded` work — it only appends, exactly like an `ingest-spec` append.

### 2. New PM front-door verbs

Three verbs (one aliased) in `product-manager/SKILL.md` and `product-manager/references/roadmap-management.md`, all mapping to `add-item` and reusing the **existing management-verb front-door** (`references/roadmap-management.md` → Front-door flow, `references/git-flow.md` → Planning-PR flow):

| PM verb | Roadmap op | Notes |
|---|---|---|
| `add-milestone "<title>"` | `add-item milestone` | Seeds a default phase so tickets can drop straight in. |
| `add-phase "<title>" --to <milestone>` | `add-item phase` | Rounds out the hierarchy without a new milestone. |
| `add-ticket "<raw>" [--to <phase\|milestone>]` | `add-item user-story` | Inline interview (§3) composes the story. |
| `add-userstory …` | *(alias of `add-ticket`)* | Identical behavior. |

**Front-door sequence (per add verb):**

1. Parse the raw argument, optional `--to <parent>`, optional `--title`, optional `--yes`.
2. For `add-ticket`: run the inline interview (§3) to produce `title` + Brief-body + Acceptance; resolve the target scope (§3 placement).
3. Cut planning branch `pm/roadmap-add-<kind>-<slug>` off the PM starting branch (existing base resolution).
4. Invoke `add-item` → stages the `+ new` diff and gates.
5. **On approval** → commit `docs(roadmap): add-<kind> …`, push, open the planning PR (`templates/pr-body.template.md` planning variant).
6. **On reject / empty** → discard the empty branch, return to the starting branch, no PR (`references/git-flow.md` → Reject-and-discard).

### 3. Inline interview + placement (`add-ticket` only)

**Interview.** PM assesses the raw input against the **clarity threshold**. If the input already yields a self-contained Brief and ≥1 testable Acceptance criterion, PM composes the story and asks nothing. Otherwise PM grills **one question at a time** (`AskUserQuestion` in Claude Code, the `question` tool in opencode) until the threshold is met, then composes:

- `title` — short, human-readable.
- `## Brief` body — plain-language, self-contained (the orchestrator never sees the conversation). PM does **not** write the trailer line; the op appends it (§1).
- `## Acceptance` — testable criteria.

**Bugs.** A bug ticket is composed as: Brief = reproduction steps + expected-vs-actual + fix intent; Acceptance = "the bug no longer reproduces" + "a regression test covers it". No schema affordance — the bug framing lives in the prose.

**Placement resolution (`--to`):**

| `--to` value | Behavior |
|---|---|
| a **phase** id | Append the story to that phase. |
| a **milestone** id with **no** phase | Auto-create the default phase (`add-item phase` internally), then append the story to it. Both appear as `+ new`. |
| a **milestone** id **with** phases | Append to that milestone's default/`-general` phase; if none exists, auto-create one. |
| omitted | PM asks the user for a target (existing phase/milestone, or offer to create a milestone first). |

### 4. Guardrails (unchanged invariants)

- **One writer.** Only the roadmap skill writes `/roadmap/`. PM cuts branches, commits, pushes, opens PRs.
- **Structural immutability.** `add-item` only appends new stable ids; it never edits, renumbers, or supersedes existing items, and never mutates `done`/`superseded` work.
- **`--yes` semantics.** Skips the staged-diff gate for `add-milestone` / `add-phase` (unambiguous structural adds). For `add-ticket` the composed story is always shown in the staged diff before write (the interview output is the thing worth reviewing), so `--yes` on `add-ticket` still shows the diff. In all cases the **planning PR is always opened** — the change stays reviewable.
- **Pre-flight.** The add verbs run under PM's existing pre-flight (lock present, `gh` present, clean tree excluding host-runtime scaffolding). `config: MISSING` (orchestrator) does **not** block add verbs — they never invoke the orchestrator; only `complete` and `new-spec` need it. (`add-ticket` uses PM's own inline interview, not the orchestrator brainstormer.)

---

## Files touched

1. `plugins/my-skills/skills/roadmap/references/mutation-ops.md` — add the `add-item` op; update the intro from "five ops" to "six".
2. `plugins/my-skills/skills/roadmap/references/item-schema.md` — empty-scope rollup (`todo`, no badge) + the `add-item` creation-audit evidence string.
3. `plugins/my-skills/skills/roadmap/SKILL.md` — light reference to `add-item` where the ops are mentioned.
4. `plugins/my-skills/skills/product-manager/SKILL.md` — add the three verbs to the verb→op table and verb list; add error cases (unknown `--to`, missing target).
5. `plugins/my-skills/skills/product-manager/references/roadmap-management.md` — verb catalog rows, the `add-ticket` inline-interview subsection, and the placement/auto-phase rules.
6. `.opencode/commands/product-manager.md` and `.opencode/commands/roadmap.md` — add the new verb / op names to the enumerated command surface (port parity — the ports are distributed and override the marketplace copy).

## Testing

These are doc-only prose skills; verification is by worked example + parity check:

- A worked `--dry-run`-style example for each verb (`add-milestone "Stabilization"`, `add-phase`, `add-ticket "<bug text>" --to <milestone>`) showing the resolved parent, the staged `+ new` diff, and the proposed commit/PR — including the auto-phase case and the interview-skipped (clear input) vs interview-grilled (vague input) paths.
- Confirm the `.opencode/` ports enumerate the new verbs (existing opencode parity validator).

## Open questions

None outstanding — all resolved during brainstorming (ticket = user-story via heavier grilled path; flexible target with auto-phase; inline PM interview; verb set = add-milestone/add-phase/add-ticket+add-userstory; no bug/feat type tag).
