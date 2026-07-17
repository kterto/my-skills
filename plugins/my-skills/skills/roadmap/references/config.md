# Roadmap — Config Reference

## Keys, Types, and Defaults

| Key | Type | Default | Override file | CLI flag |
|---|---|---|---|---|
| `output_format` | `md`\|`html` | inherit `.orchestrator/config.json`, else `md` | `/roadmap/roadmap.config.json` | `--format` |
| `context_threshold` | float 0–1 | inherit `.orchestrator/config.json`, else `0.95` | `/roadmap/roadmap.config.json` | `--threshold` |
| `systems` | array of `{name: string, path?: string}` | `[]` (no systems declared) | `/roadmap/roadmap.config.json` | — |

## Precedence

```
CLI flag > /roadmap/roadmap.config.json > .orchestrator/config.json > built-in default
```

The roadmap skill first checks for a CLI flag; if absent, checks `/roadmap/roadmap.config.json`; if that key is absent or the file does not exist, inherits from `.orchestrator/config.json`; if still absent, falls back to the built-in default.

## Key descriptions

### `output_format`

Controls **all** generated artifact files — every milestone README, phase README, user-story file, and the top-level `/roadmap/README.md`. Valid values: `md` (default) or `html`.

`roadmap.lock.json` is always JSON regardless of `output_format`; it is machine state, not a deliverable.

### `context_threshold`

Minimum holistic confidence score (0–1) the roadmap skill must reach before proceeding from the context gate to decomposition. Default `0.95`. The skill loops structured question rounds (`AskUserQuestion` in Claude Code, `question` in opencode), self-rating confidence after each, until the threshold is met.

### `systems`

The **declared set of systems** — the source of truth for the `system` band (a second orthogonal classification axis alongside `release`; see `item-schema.md` → `system`). A monorepo project typically comprises several distinct deployable systems (e.g. `backend`, `landing`, `admin`, `app`) that all advance toward a shared release; `systems` names them so roadmap work can be scoped by system and a `release × system` readiness matrix can be derived.

Type: `array of {name: string, path?: string}`. Default `[]` (no systems declared). There is **no CLI flag** — the set is declared only in `/roadmap/roadmap.config.json`.

- `name` — the system band value (e.g. `backend`). **Unique within the array.** This is the exact string a story's `system` field may take.
- `path` — optional monorepo package directory (e.g. `apps/api`). Advisory metadata only: it is **stored now and used for routing later** — the `product-manager` skill surfaces it (a context note on the orchestrator brief handoff and in the readiness matrix) but nothing changes where the orchestrator runs. Actual package-dir routing is a deferred future story.

**Config-declared, not lazily created.** Unlike the `release` band — whose named trains are lazily appended to the `releases[]` registry in `roadmap.lock.json` on first use — the `systems` set lives entirely in this config file and is never auto-extended by an assignment.

**Typo guard.** Assigning a `system` value not present in this set is an **error** (see `mutation-ops.md` → `set-system`). Rationale: systems are deployables, not free-form trains — a typo (`backedn`) should fail loudly rather than silently create a phantom system. `null` (untag) is always permitted.

**Backward compatibility.** An empty or absent `systems` array means the roadmap is **not system-partitioned** — fully backward-compatible: no `system` badges render anywhere, and the derived readiness matrix collapses to a single `(untagged)` column. `system` is nullable and lazily written; a legacy roadmap with no `systems` config and no story `system` fields renders and executes unchanged. No migration is forced (the opt-in `migrate-systems` procedure adopts systems on demand — see `mutation-ops.md`).

## `roadmap.config.json`

Place this file at `/roadmap/roadmap.config.json` to set roadmap-specific overrides. Any key present here overrides the inherited value from `.orchestrator/config.json` for the duration of roadmap operations. Keys not present here fall through to `.orchestrator/config.json` and then to the built-in default.

Example:

```json
{
  "output_format": "html",
  "context_threshold": 0.90,
  "systems": [
    { "name": "backend", "path": "apps/api" },
    { "name": "app", "path": "apps/mobile" },
    { "name": "admin" },
    { "name": "landing" }
  ]
}
```

The `systems` array has no inheritance source in `.orchestrator/config.json` — it is roadmap-owned and defaults to `[]` when absent.

## Relationship to orchestrator config

The roadmap skill reads `.orchestrator/config.json` as an inheritance source — it never writes to it. The orchestrator's own keys (`max_review_cycles`, `max_qa_cycles`, etc.) are ignored by the roadmap skill.
