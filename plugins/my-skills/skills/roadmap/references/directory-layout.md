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
  "items": [
    { "id": "001.1.1", "kind": "user-story", "status": "todo", "content_hash": "<sha256>", "sequence": 1 }
  ]
}
```

Keys:

| Key | Type | Description |
|---|---|---|
| `version` | integer | Schema version (currently `1`). |
| `last_synced_sha` | string \| null | The git SHA of the last `/roadmap sync` run. `null` before first sync. |
| `items` | array | One entry per tracked milestone, phase, and user story. |
| `items[].id` | string | Stable ID (e.g. `001.1.1`). |
| `items[].kind` | string | `milestone` \| `phase` \| `user-story`. |
| `items[].status` | string | Current status (see item-schema.md for the status enum). |
| `items[].content_hash` | string | SHA-256 of the item file body, used for change detection during re-evaluation. |
| `items[].sequence` | integer | Logical execution order within the parent scope. |
