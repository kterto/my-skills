# Product Manager — Scope Resolution Reference

This document is the single source of truth for turning the `<scope>` CLI argument into an ordered queue of user stories that the PM loop iterates.

`SKILL.md` references this document by name: **Scope matching**, **Filter**, **Ordering algorithm**, **Out-of-scope dependencies**.

---

## Scope matching

The `<scope>` argument controls which user stories enter the queue. The table below shows every accepted form and how it maps to a candidate story set.

| `<scope>` value | Candidate stories |
|---|---|
| `roadmap` | Every item in `roadmap.lock.json` with `kind: user-story`. |
| Milestone id (e.g. `001` or `001-bootstrap`) | User stories whose frontmatter `milestone` field matches. Bare ordinal (`001`) matches if it equals the numeric prefix of the milestone id or the full directory-slug (`001-bootstrap`). |
| Phase id (e.g. `001.2`) | User stories whose frontmatter `phase` field matches exactly. |
| Anything else | **Stop.** Print the list of valid scopes — the milestone ids and phase ids found in `roadmap.lock.json` — so the caller can correct the argument. |

### Milestone id matching rule

Accept both short and long forms: `001` matches a story whose `milestone` is either `001` or `001-bootstrap` (the bare ordinal matches the numeric prefix of the full slug, regardless of the name part). This means a user can type either form interchangeably without editing frontmatter.

---

## Filter

After scope matching, drop every story whose `status` is `done` or `superseded`. These stories are complete or obsolete and must not be re-executed.

Stories with status `todo`, `in_progress`, or `blocked` pass through the filter and proceed to ordering.

---

## Ordering algorithm

The filtered candidate set is ordered by a topological sort that respects declared dependencies and breaks ties by `sequence`.

### Steps

1. Build a directed graph: for each story in the candidate set, add an edge `dep → story` for each id listed in the story's `depends_on` frontmatter field. Nodes are user-story ids; edges point from prerequisite to dependent.
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
