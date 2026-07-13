# Roadmap — Config Reference

## Keys, Types, and Defaults

| Key | Type | Default | Override file | CLI flag |
|---|---|---|---|---|
| `output_format` | `md`\|`html` | inherit `.orchestrator/config.json`, else `md` | `/roadmap/roadmap.config.json` | `--format` |
| `context_threshold` | float 0–1 | inherit `.orchestrator/config.json`, else `0.95` | `/roadmap/roadmap.config.json` | `--threshold` |

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

## `roadmap.config.json`

Place this file at `/roadmap/roadmap.config.json` to set roadmap-specific overrides. Any key present here overrides the inherited value from `.orchestrator/config.json` for the duration of roadmap operations. Keys not present here fall through to `.orchestrator/config.json` and then to the built-in default.

Example:

```json
{ "output_format": "html", "context_threshold": 0.90 }
```

## Relationship to orchestrator config

The roadmap skill reads `.orchestrator/config.json` as an inheritance source — it never writes to it. The orchestrator's own keys (`max_review_cycles`, `max_qa_cycles`, etc.) are ignored by the roadmap skill.
