# Roadmap — Directory Layout Reference

This document is the single source of truth for the `/roadmap/` directory structure, the ID scheme, the stable-identity rule, and the `roadmap.lock.json` schema.

## Directory tree

```
/roadmap/
  README.md              # index: milestones, rollup status, progress %, legend, sequence order
  CONTEXT.md             # roadmap context (own gate) OR roadmap addendum (orchestrator base exists)
  roadmap.lock.json      # machine state: IDs, statuses, content hashes, last-synced sha
  roadmap.config.json    # optional: roadmap-specific config overrides
  001-bootstrap/
    README.md            # milestone overview + rollup status + audit log + ordered phase list
    001.1-scaffold/
      README.md          # phase overview + rollup status + audit log + user story list
      001.1.1-init-repo.md   # user story
      001.1.2-....md
  002-auth/
  ...
```

## ID scheme

| Level | Pattern | Example |
|---|---|---|
| Milestone | `NNN-kebab` (zero-padded ordinal + kebab name) | `001-bootstrap`, `002-auth` |
| Phase | `NNN.M` | `001.1`, `001.2` |
| User Story | `NNN.M.T` | `001.1.1`, `001.1.2` |

The directory name uses the full ID pattern as its prefix (e.g. `001-bootstrap/`, `001.1-scaffold/`, `001.1.1-init-repo.md`).

## Stable-identity rule

A directory number, once assigned, is **never renumbered**. It is identity, not position. New milestones, phases, and user stories append as the next available number. Logical execution order is carried by the `sequence` (and `depends_on`) field and rendered in that order in every README.

**Consequence:** after the first re-evaluation insert, directory number ≠ execution order. This is intentional — it keeps the audit identity of completed work intact (a `done` item is never rewritten by renumbering).

## Artifact format

`output_format` controls all generated `.md`/`.html` artifacts (every README and item file). `roadmap.lock.json` is always JSON and is machine state, not a deliverable.

### Navigation link targets

Items link to each other by relative path derived from the ID scheme: a milestone is `<NNN-slug>/README.<ext>`, a phase is `<NNN.M-slug>/README.<ext>`, a user story is `<NNN.M.T-slug>.<ext>` (`<ext>` per `output_format`). See `item-schema.md` → Output navigation.

## `roadmap.lock.json` schema

```json
{
  "version": 1,
  "last_synced_sha": "<sha or null>",
  "releases": ["mvp", "v1.1"],
  "items": [
    { "id": "001.1.1", "kind": "user-story", "status": "todo", "release": "mvp", "system": "backend", "content_hash": "<sha256>", "sequence": 1 }
  ]
}
```

Keys:

| Key | Type | Description |
|---|---|---|
| `version` | integer | Schema version (currently `1`). |
| `last_synced_sha` | string \| null | The git SHA of the last `/roadmap sync` run. `null` before first sync. |
| `releases` | array of strings | **Ordered** registry of named release trains. Array order defines both the render order and the "runs before" semantics across bands (`releases[0]` renders and runs before `releases[1]`, …). The reserved band `backlog` is **never** listed here. |
| `items` | array | One entry per tracked milestone, phase, and user story. |
| `items[].id` | string | Stable ID (e.g. `001.1.1`). |
| `items[].kind` | string | `milestone` \| `phase` \| `user-story`. |
| `items[].status` | string | Current status (see item-schema.md for the status enum). |
| `items[].release` | string \| null | Release band for this item (see item-schema.md → `release`). `null`/absent = active untiered; `backlog` = parked; any other value must appear in the top-level `releases[]` registry. For `kind: milestone`/`kind: phase` entries this stored value is **non-authoritative for rendering** — the badge is derived from not-done descendants (see item-schema.md → derived display, mutation-ops.md → Cascade); release-scope matching (`scope-resolution.md`) reads this field only for `kind: user-story` items. |
| `items[].system` | string \| null | **System band** for this item (see item-schema.md → `system`). `null`/absent = untagged; any other value must be a `name` declared in `config.systems` (see `config.md`). The lock stores only the per-item value — scope matching reads this field without opening every story file. For `kind: milestone`/`kind: phase` entries the stored value is **non-authoritative for rendering** — the badge is derived from not-done descendants (`[<system>]`/`[cross-cutting]`/none), consistent with `release`. The systems *set* lives in config, not the lock — see the section below. |
| `items[].content_hash` | string | SHA-256 of the item file body, used for change detection during re-evaluation. |
| `items[].sequence` | integer | Logical execution order within the parent scope. |

### `releases[]` registry rules

- **Ordered, not a set.** Position is meaningful: it is the render order and the cross-band "runs before" order. `backlog` is reserved, is never a registry entry, and always sorts after every named band.
- **Implicit create on first use.** The first time the `set-release` op assigns a release name that is not already present, that name is appended to `releases[]` in order. Re-ordering and renaming are done explicitly via the `release` op (see `mutation-ops.md`).
- **Backward compatibility (legacy roadmaps).** An absent or empty `releases[]` is treated as an empty registry; items with no `release` field are untiered (`null`). **No migration is performed** — a legacy `roadmap.lock.json` without `releases` and items without `release` is valid and renders/executes unchanged. The keys are added lazily only when the first band is assigned.

### The `system` set lives in config (not the lock)

Unlike `releases[]`, there is **no `systems` registry in `roadmap.lock.json`** — the declared set of systems is owned by `roadmap.config.json` → `systems` (see `config.md`). The lock carries only the per-item `items[].system` value. This is the deliberate `system`-vs-`release` difference: the release set is a lazily-grown lock registry, while the system set is config-declared and typo-guarded. Consequently:

- **No lazy creation.** The lock is never extended with a new system name on assignment; an undeclared system is rejected at the op layer (`mutation-ops.md` → `set-system`).
- **Backward compatibility.** A lock whose items carry no `system` field is valid — those items are untagged (`null`). No migration is performed; the `system` field is written lazily, only when a story is first tagged (or `migrate-systems` runs). A legacy roadmap with no `systems` config and no item `system` fields renders and executes unchanged.
