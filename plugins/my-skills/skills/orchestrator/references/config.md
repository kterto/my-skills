# Orchestrator — Config Reference

## Keys, Types, and Defaults

| Key | Type | Default | CLI arg |
|---|---|---|---|
| `context_threshold` | float (0–1) | `0.95` | `--threshold` |
| `output_format` | string (`md` \| `html`) | `"md"` | `--format` |
| `max_review_cycles` | integer | `10` | `--max-review` |
| `max_qa_cycles` | integer | `5` | `--max-qa` |

## Canonical Default Object

```json
{ "context_threshold": 0.95, "output_format": "md", "max_review_cycles": 10, "max_qa_cycles": 5 }
```

## Accepted CLI Args

| Arg | Maps to |
|---|---|
| `--threshold` | `context_threshold` |
| `--format` | `output_format` |
| `--max-review` | `max_review_cycles` |
| `--max-qa` | `max_qa_cycles` |
| `--setup` | Force bootstrap (does not map to a config key) |

## Precedence

CLI arg > `.orchestrator/config.json` > default

When `.orchestrator/config.json` is absent the canonical default object applies in full. Any key present in `.orchestrator/config.json` overrides only that key. A CLI arg overrides both the file and the default for the duration of the current run.
