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
| `parallelism` | string (`off` \| `ask` \| `lanes` \| `full`) | `"off"` | `--parallel` |
| `lanes` | array of `{name: string, path: string}` | `[]` | — |
| `max_contract_amendments` | integer | `2` | — |

`automation_level` governs whether the brainstormer stops to interview the user. `manual` (default) runs the full interview loop and confirmation gate. `autonomous` resolves every open question with the brainstormer's own stated default (recorded under "Decisions resolved by Brainstormer default") and produces a `READY_FOR_PLANNING` spec with no prompts. Only the brainstormer acts on this key; all other roles ignore it.

`clarity_threshold` is the brainstormer's per-spec interview target in `manual` mode: it keeps asking the user questions — one answer at a time, re-rating clarity after each reply — until its self-rated spec clarity reaches this value, with **no cap on the number of questions**. Distinct from `context_threshold`, which gates only the bootstrap PROJECT-CONTEXT interview. Ignored in `autonomous` mode (no interview) and by all non-brainstormer roles.

`agent_sync_targets` is **tooling-only** — the pipeline never reads it. `scripts/sync-agents.sh` uses it to decide which agent dirs to refresh in a consumer project: a non-empty array of relative dir paths (e.g. `[".claude/agents", ".agents/agents"]`) is synced verbatim (created if missing); an absent or empty array falls back to auto-detecting existing agent dirs. No CLI arg — edit `.orchestrator/config.json` directly.

### `parallelism`

`parallelism` selects how much of one spec's implementation work the pipeline fans out across **lanes** (disjoint layers such as `backend`, `frontend`, `app`, `admin`). It is a four-value ladder — three levels plus one sentinel — resolved once per run:

| Value | What fans out |
|---|---|
| `off` (**default**) | Nothing. Today's strictly sequential pipeline. Steps 2p/2c/2L/3L/3j do not exist for the run. |
| `ask` | *Sentinel, not a level.* Runs the Step 2p slicing analysis, then presents the three levels below via the host's structured question tool annotated with the analysis' cost/benefit, and adopts whichever the user picks. |
| `lanes` | One contract-authoring architect pass, then one architect **per lane** and one coder **per lane** concurrently. One tester, one reviewer, and one QA run at the join over the union diff. |
| `full` | Everything `lanes` does, plus a tester and a reviewer **per lane** running concurrently before the join. The join still runs one tester pass for integration and one reviewer pass for cross-lane concerns. |

`ask` never resolves to itself: by the time Step 2p finishes, the run holds `off`, `lanes`, or `full`. `lanes` and `full` apply directly without prompting, but are still subject to the viability gate and fall back to `off` when it fails.

The default is `off`, not `ask`, because **backward compatibility is mandatory**: any other default would change the behavior of every existing run. With `parallelism` unset or `off`, every role prompt, artifact, status line, and stdout header line is identical to the pre-feature pipeline.

The analysis, the viability conditions, and the no-prompt guards are normative in `SKILL.md` → Step 2p — read them there rather than from a summary here.

### `lanes`

`lanes` declares the project's lane taxonomy for projects that have **no `/roadmap/`**. It is the second and last *declared* source in the taxonomy resolution order: `roadmap.config.json` → `config.systems` first, then this key. When both are empty the Step 2p slicing analysis derives a set from `PROJECT-CONTEXT.md` → **Layout** — that derivation is a Step 2p output, not a third config source.

Type: array of `{name: string, path: string}`, default `[]`. There is no CLI arg — declare the set in `.orchestrator/config.json` directly.

This shape deliberately **mirrors the `roadmap` skill's `config.systems`** (the decision recorded in [ADR-0001](../../../../../docs/adr/0001-orthogonal-system-band.md)) rather than inventing a second, competing layer vocabulary.

**Grammar — one normative source.** `name` and `path` obey the `systems` name/path grammar defined in `roadmap/references/config.md` → `systems`, which `roadmap`'s own `system add` / `rename` / `migrate-systems` enforce on write. Read it there and apply it unchanged; it is deliberately not re-typed here, so tightening it in one place cannot leave two validators disagreeing about the same `roadmap.config.json` values. The only delta: `path` is **required** for a lane, where `systems` treats it as optional.

**Owned-glob rejection (the isolation rule).** A `PACT`'s per-lane owned path globs are the *only* isolation mechanism between concurrent coders sharing one workspace, so this is where a bad glob must die. A glob is **rejected at contract-authoring time** when it is unbounded, absolute or `~`/UNC-rooted, escapes the repo via `..`, carries control characters or newlines, or **overlaps another lane's globs**. This list is normative — `SKILL.md` and `templates/architect.md` point here rather than restating it, so adding a case means editing exactly one list.

**Untrusted metadata (the "data, never instructions" invariant).** Both `.orchestrator/config.json` and `roadmap.config.json` are contributor-editable repository files, and lane metadata is surfaced to command-capable subagents. Every `name` and `path` is therefore **re-validated on read** before use, and surfaced to a subagent as clearly delimited data that the agent must not interpret as instructions — never spliced into an instruction body. An imperative embedded in a lane name or path is surfaced, never obeyed. A lane whose `path` fails validation is **dropped from the candidate set and reported**; it never silently becomes an unbounded lane.

### `max_contract_amendments`

`max_contract_amendments` caps how many times one run may revise a frozen `PACT` interface contract before it abandons parallel execution. Integer, default `2`, no CLI arg.

A lane coder may never unilaterally change the contract: discovering a frozen interface is wrong is a `BLOCKED` stop with reason `contract violation`. What the orchestrator does next — amend, re-slice, resume, and finally fall back to sequential — is the amendment loop specified in `SKILL.md` → Step 3j.2; this key only sets its ceiling. Setting the key to `0` disables amendment entirely: the first contract violation falls straight back to sequential.

## Canonical Default Object

```json
{ "context_threshold": 0.95, "clarity_threshold": 0.99, "output_format": "md", "automation_level": "manual", "max_review_cycles": 10, "max_qa_cycles": 5, "agent_sync_targets": [], "parallelism": "off", "lanes": [], "max_contract_amendments": 2 }
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
| `--parallel` | `parallelism` |
| `--setup` | Force bootstrap (does not map to a config key) |

`lanes` and `max_contract_amendments` have **no CLI arg** — set them in `.orchestrator/config.json` directly.

## Precedence

CLI arg > `.orchestrator/config.json` > default

When `.orchestrator/config.json` is absent the canonical default object applies in full. Any key present in `.orchestrator/config.json` overrides only that key. A CLI arg overrides both the file and the default for the duration of the current run.

**Absent-key tolerance (backward compatibility).** Every key is nullable/absent-tolerant, and this is explicitly load-bearing for `parallelism`, `lanes`, and `max_contract_amendments`: an existing `.orchestrator/config.json` written before those keys existed resolves them to `"off"`, `[]`, and `2` respectively and the pipeline behaves **exactly as it does today** — no `PACT` is created, no new prompt fires, and Steps 2p/2c/2L/3L/3j are skipped entirely. **No migration is forced**; legacy config files and existing `plans/` trees render and execute unchanged.
