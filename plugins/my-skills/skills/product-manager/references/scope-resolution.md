# Product Manager — Scope Resolution Reference

This document is the single source of truth for turning the `<scope>` CLI argument into an ordered queue of user stories that the PM loop iterates.

`SKILL.md` references this document by name: **Scope matching**, **Filter**, **Ordering algorithm**, **Out-of-scope dependencies**.

---

## Data sources (read this first)

The information PM needs is split across two sources. Getting the split right matters: the lock does **not** carry the fields PM most often wants.

- **`roadmap.lock.json` items** carry ONLY `{ id, kind, status, release, content_hash, sequence }` (the top-level lock also carries the ordered `releases[]` registry). There is **no** `milestone`, `phase`, `depends_on`, `title`, or `commit_trailer` field in the lock. `release` (`string | null`) IS in the lock — it is the field release-scope matching and backlog exclusion read (absent/`null` on legacy roadmaps). The lock DOES contain `kind: milestone` and `kind: phase` items (identified by their `id`, e.g. `001`, `001.2`) alongside `kind: user-story` items.
- **The user-story file frontmatter** (`<NNN.M.T-slug>.md`) carries the per-story fields PM reads at execution time: `depends_on`, `title`, `commit_trailer`, and (when present) `milestone`/`phase`.

Implications used throughout this document:

- **Scope membership** for a milestone/phase scope is determined by the user-story **id-prefix** and/or the story-file frontmatter `milestone`/`phase` — never from lock fields that don't exist. A user-story id like `001.2.3` encodes its milestone (`001`) and phase (`001.2`) by id-prefix.
- **Valid milestone/phase scope ids** (printed when a scope is unrecognized) come from the lock's `kind: milestone` and `kind: phase` item `id`s (and/or a scan of the `/roadmap/` story files) — not from a non-existent lock field.
- **Status** for filtering comes from the lock (`status`). **`depends_on`** for ordering, **`title`** for log/PR rendering, and **`commit_trailer`** for the commit trailer come from each user-story file's frontmatter; the lock supplies only `id/kind/status/sequence`.

---

## Scope matching

The `<scope>` argument controls which user stories enter the queue. The table below shows every accepted form and how it maps to a candidate story set.

| `<scope>` value | Candidate stories |
|---|---|
| `roadmap` | Every item in `roadmap.lock.json` with `kind: user-story`, **excluding `backlog`-band items** (see **Backlog exclusion**). |
| Milestone id (e.g. `001` or `001-bootstrap`) | User stories belonging to that milestone — i.e. whose id-prefix is the milestone ordinal (`001.*.*`) and/or whose story-file frontmatter `milestone` matches — **excluding `backlog`-band items**. The bare ordinal (`001`) matches the numeric prefix of the milestone id or the full directory-slug (`001-bootstrap`). |
| Phase id (e.g. `001.2`) | User stories belonging to that phase — i.e. whose id-prefix is the phase id (`001.2.*`) and/or whose story-file frontmatter `phase` matches exactly — **excluding `backlog`-band items**. |
| **Release name** (e.g. `mvp`, `v1.1`, `backlog`) | Every `kind: user-story` item whose `release` band equals the name, **across all milestones** (see **Release scope**). A named band (`mvp`) selects that train's not-done stories; `backlog` selects parked stories — this is the **only** scope that runs parked work. |
| Anything else | **Stop.** Print the list of valid scopes — the milestone and phase ids from the lock's `kind: milestone` / `kind: phase` item `id`s (and/or a story-file scan), plus the release names from `roadmap.lock.json` → `releases[]` (and `backlog`) — so the caller can correct the argument. |

### Release scope (`complete mvp` / `complete v1.1` / `complete backlog`)

A `<scope>` that matches a registered release name in `roadmap.lock.json` → `releases[]`, or the reserved `backlog`, resolves to **every not-done `kind: user-story` item carrying that `release` band, across all milestones**. The candidate set spans the whole roadmap (not one milestone/phase) and is then ordered by the existing **Ordering algorithm** (topo-sort by `depends_on`, ties broken by `sequence`) exactly as any other scope. One band runs at a time — there is no multi-band ordering. Legacy/untiered roadmaps have no release names, so this form simply doesn't match (falls through to the unrecognized-scope stop).

### Backlog exclusion (active-scope runs)

The active-scope forms — `complete roadmap`, `complete <milestone>`, `complete <phase>` — **exclude every item whose `release` band is `backlog`**. Parked work never runs as a side effect of an active-scope run; it runs only via the explicit `complete backlog` release scope, or after un-parking it (PM `unpark`, which re-tiers the item to a named band or `null`). Untiered (`null`) and named-band items are **not** excluded from active-scope runs — only `backlog` is.

### Milestone id matching rule

Accept both short and long forms: `001` matches stories under milestone `001` whether identified by id-prefix (`001.*.*`) or by a story-file `milestone` frontmatter value of `001` or `001-bootstrap` (the bare ordinal matches the numeric prefix of the full slug, regardless of the name part). This means a user can type either form interchangeably. Note: `milestone`/`phase` are story-file frontmatter fields — they are **not** present in `roadmap.lock.json`, so membership is resolved from id-prefix and/or the story file, never from a lock field.

---

## Filter

After scope matching, drop every story whose `status` is `done` or `superseded`. These stories are complete or obsolete and must not be re-executed.

Stories with status `todo`, `in_progress`, or `blocked` pass through the filter and proceed to ordering.

---

## Ordering algorithm

The filtered candidate set is ordered by a topological sort that respects declared dependencies and breaks ties by `sequence`.

### Steps

1. Build a directed graph: for each story in the candidate set, add an edge `dep → story` for each id listed in the story's `depends_on` frontmatter field (read from the user-story file — `depends_on` is not in `roadmap.lock.json`). Nodes are user-story ids; edges point from prerequisite to dependent.
2. Topologically sort the graph (Kahn's algorithm or equivalent). Break ties — nodes with no ordering constraint relative to each other — by `sequence` ascending (lower sequence number executes first).
3. On a cycle, **stop** and report the offending ids. The roadmap should never emit a cycle; PM verifies this precondition on every run before executing any story.

The result is the **story queue**: an ordered list of user-story ids that the PM loop processes one at a time.

---

## Out-of-scope dependencies

A story in the queue may declare a `depends_on` id that is outside the resolved scope (i.e. not in the candidate set after scope matching). PM checks the `roadmap.lock.json` status of that external id:

- If the external dependency's `roadmap.lock.json` status is `done` → no action needed; the prerequisite is already satisfied.
- If the external dependency's status is **not** `done` → the dependency is unmet. PM behavior depends on mode:

| Mode | Behavior |
|---|---|
| Conservative | **Stop** and report the unmet out-of-scope dependency before executing any story. |
| Autonomous | **Warn**, then proceed. Record the unmet dependency in the run log and in the PR body so the human reviewer is informed. |

Cross-references:
- Mode determination: `references/human-validation.md`
- Run log format: `references/resume-and-logging.md`
