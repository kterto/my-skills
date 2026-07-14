# Orchestrator — Config Reference

## Keys, Types, and Defaults

| Key | Type | Default | CLI arg |
|---|---|---|---|
| `context_threshold` | float (0–1) | `0.95` | `--threshold` |
| `clarity_threshold` | float (0–1) | `0.99` | `--clarity` |
| `output_format` | string (`md` \| `html`) | `"md"` | `--format` |
| `automation_level` | string (`autonomous` \| `manual`) | `"manual"` | `--mode` |
| `max_review_cycles` | integer | `10` | `--max-review` |
| `max_qa_cycles` | integer | `5` | `--max-qa` |
| `agent_sync_targets` | array of strings | `[]` | — (tooling-only) |

`automation_level` governs whether the brainstormer stops to interview the user. `manual` (default) runs the full interview loop and confirmation gate. `autonomous` resolves every open question with the brainstormer's own stated default (recorded under "Decisions resolved by Brainstormer default") and produces a `READY_FOR_PLANNING` spec with no prompts. Only the brainstormer acts on this key; all other roles ignore it.

`clarity_threshold` is the brainstormer's per-spec interview target in `manual` mode: it keeps asking the user questions — one answer at a time, re-rating clarity after each reply — until its self-rated spec clarity reaches this value, with **no cap on the number of questions**. Distinct from `context_threshold`, which gates only the bootstrap PROJECT-CONTEXT interview. Ignored in `autonomous` mode (no interview) and by all non-brainstormer roles.

`agent_sync_targets` is **tooling-only** — the pipeline never reads it. `scripts/sync-agents.sh` uses it to decide which agent dirs to refresh in a consumer project: a non-empty array of relative dir paths (e.g. `[".claude/agents", ".agents/agents"]`) is synced verbatim (created if missing); an absent or empty array falls back to auto-detecting existing agent dirs. No CLI arg — edit `.orchestrator/config.json` directly.

## Canonical Default Object

```json
{ "context_threshold": 0.95, "clarity_threshold": 0.99, "output_format": "md", "automation_level": "manual", "max_review_cycles": 10, "max_qa_cycles": 5, "agent_sync_targets": [] }
```

## Accepted CLI Args

| Arg | Maps to |
|---|---|
| `--threshold` | `context_threshold` |
| `--clarity` | `clarity_threshold` |
| `--format` | `output_format` |
| `--mode` | `automation_level` |
| `--max-review` | `max_review_cycles` |
| `--max-qa` | `max_qa_cycles` |
| `--setup` | Force bootstrap (does not map to a config key) |

## Precedence

CLI arg > `.orchestrator/config.json` > default

When `.orchestrator/config.json` is absent the canonical default object applies in full. Any key present in `.orchestrator/config.json` overrides only that key. A CLI arg overrides both the file and the default for the duration of the current run.
