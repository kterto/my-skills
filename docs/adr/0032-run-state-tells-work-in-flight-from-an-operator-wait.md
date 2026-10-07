# ADR-0032 — Run state tells work in flight from an operator wait, and only its conductor writes it

- **Status:** Accepted
- **Date:** 2026-10-07
- **Amends:** no earlier decision record. Increment 1 admitted the run state and its watchdog on history under [ADR-0026](0026-skill-byte-budgets-and-the-admission-rule.md) decision 4, and no ADR recorded their lifecycle until this one. It replaces two of their doctrines: that a run is either working or waiting for the operator, and that the Stop hook proves ownership by evidence alone, "never read from the lease".
- **Skills affected:** `orchestrator` (`scripts/run-state.cjs` → the `dispatch` command, the `in_flight` file, the lease state `dispatched`, lease v2, exit 5 and `--take-over`, `done`, `status` and `watch`; `SKILL.md` → the run-state rule's `wait` line, which now names `dispatch` too); the plugin's hooks (`hooks/orchestrator-stop.cjs`; `hooks/hooks.json` → `StopFailure`; `hooks/opencode/orchestrator-watchdog.js` → `shell.env`); `fixtures/admission.json` and three replay fixtures.
- **Source finding:** field runs of a private project, recorded privately. Every pattern below is generalized from them, and no figure in this ADR comes from them: the numbers here are this repository's own.
- **Precedent:** ADR-0026 decision 4, a new state, command, file or touchpoint enters with a replay fixture; ADR-0027, a run-state write that records a human act verbatim and makes it checkable rather than trusted.

## Context

At a turn end, the Increment 1 watchdog asks one question: is this a stall between steps, or a stop that waits for the operator on purpose? `pending_decision`, written by `wait`, was the only way to say "on purpose". Background subagents broke that question, in four ways the field showed:

1. **False blocks followed asynchronous dispatches.** Claude Code runs an `Agent` in the background by default. The conductor's turn ends while the work it handed out runs, and the host wakes the session when the work reports back. The hook saw an active run with no FINAL and no pending decision, and blocked.
2. **Conductors answered with `wait`.** Once blocked, they marked the run as waiting for the operator so that the hook would stop, and soon did it after every dispatch, before any block. A pending decision then stood whether or not the operator had anything to answer, and `watch`'s "waiting for your decision" no longer meant anything.
3. **A turn that ended on an API error ran no Stop hook.** A provider limit ended the conductor's turn mid-run. Nothing fired, and the run sat idle until the operator looked.
4. **Two sessions wrote one run.** A session resumed in a new window while the old one was still alive. The old one dispatched a duplicate role and wrote a `wait` that stood as a false operator question, and nothing in the run state said which session conducted the run.

Two smaller defects came with them. `done` left NEXT and `pending_decision` behind, so a finished run still read as a step to resume and a question to answer. And nothing watched a subagent that hung, because a hung subagent ends no turn.

## Decision

### 1. `dispatch`, `in_flight` and the state `dispatched`

`node .orchestrator/run-state.cjs dispatch <run> '<what>'` records work the conductor handed to a background subagent or shell. It appends `<ISO-8601 UTC> <what>` to `.orchestrator/runs/<run>/in_flight`, then writes the lease, so a hook that reads `dispatched` finds what is in flight. It prints `run-state: <run> in flight: <what>`, re-points an absent ACTIVE at the run and warns when ACTIVE names another one, as `next` and `wait` do.

**`lease.state` is authoritative** for the hook, the plugin, `status` and `watch`; `in_flight` is content. A reader that derived the state from the file would, under version skew, read an old `next`'s leftover file as work in flight.

| Command | State | Files | `blocks` |
|---|---|---|---|
| `start` | `active` | NEXT = Step 0; removes `pending_decision` and `in_flight` | 0 |
| `next` | `active` | removes `pending_decision` and `in_flight`; `dispatched_at` = null | reset only on a new label, or on a resume from `waiting` or `done` |
| `dispatch` | `dispatched`, or `waiting` while `pending_decision` exists | appends to `in_flight`; sets `dispatched_at` if unset | untouched |
| `wait` | `waiting` | writes `pending_decision`; keeps `in_flight` | untouched |
| `done` | `done` | removes NEXT, `pending_decision` and `in_flight` (decision 6) | untouched |

`wait` is for a question the operator must answer, and the `SKILL.md` rule says so: "end a turn awaiting the operator (`STALLED`, a question) by `wait <run> '{Status line or question}'`; after a background spawn, `dispatch <run> '{what}'`." `start`'s refusal (exit 3) counts a `dispatched` holder as live, and for one it ends `work in flight: ask the operator before superseding it`.

### 2. The Stop hook asks whether something will resume the session

The host now tells a Stop hook what is in flight: `background_tasks`, the session's running and pending background work, and `session_crons`, its scheduled wakeups. A new test, `willResume`, decides before any block is recorded:

- a scheduled wakeup with `recurring: false` will resume the session;
- a running or pending subagent, workflow, cloud session or MCP task will report back into it, by label or by internal type (`local_agent`, `local_workflow`, `remote_agent`, `mcp_task`);
- a background shell, a monitor, a teammate, a type this list does not know and a recurring wakeup count **only while the run is `dispatched`**: one leaked shell, one idle teammate or one `/loop` would otherwise let every later stall through;
- the host's own housekeeping (`dream`, `auto-mode scan`, `memory import`) never counts;
- with no task list at all, from an older build, a `dispatched` run will resume and an `active` one will not.

When something will resume the session, the stop goes through with nothing written and no block counted. The order is: eligible (state `active` or `dispatched`, heartbeat under 12 h, no FINAL, no `pending_decision`), owned (decision 5), will not resume, `stop_hook_active` with no progress (decision 4), and only then a block. A stall with nothing in flight is blocked exactly as before.

### 3. Two block reasons

An `active` run stalled between steps. A `dispatched` run whose work has reported back, with nothing left in flight, has a hand-back to act on. Each gets its own text, sent by both hosts. With `<run>` replaced by a 64-character run name, the first is 596 characters and the second 426, both inside the 600 the hook has always kept to:

- **stall:** Orchestrator watchdog: the run is active with no FINAL, no pending decision and nothing in flight; nothing will resume it. Dispatch the NEXT step `node .orchestrator/run-state.cjs status` prints, then record it: `node .orchestrator/run-state.cjs dispatch <run> '<what>'`. Use `wait <run> '<Status line or question>'` for a STALLED stop or an operator question (AskUserQuestion / question first), `done <run>` when over.

  The stall text names the STALLED stop beside the operator's question because the skill makes `wait` the duty there too: a conductor that ends on a STALLED banner must record it with `wait`, not dispatch another step.
- **returned:** Orchestrator watchdog: the work recorded with dispatch has reported back and nothing is in flight, so nothing will resume the run. Act on the hand-back now: record the step you move to with `next` and dispatch it, run `wait <run> '<question>'` if the operator must answer, or `done <run>` if the run is over.

Neither names `run-state.cjs` before `start` or `next`. The host writes the reason into the transcript, and the legacy ownership test (decision 5) takes that shape as evidence.

### 4. Progress, and three rescues per step

Claude Code keeps `stop_hook_active` set for the rest of the operator's turn, so the hook lets a rescued turn stop again unless the run has progressed. Progress used to mean only that NEXT had moved. A conductor blocked at a step that dispatches work, which then reports back in the same turn, would have been let through silently. So the hook now records `last_block_at`, and progress also means an `in_flight` line newer than it. Both are timestamped to the millisecond, because the dispatch that answers a block lands seconds after it.

That counts for this test only. A `dispatch` never resets `blocks`, and a `next` that leaves `dispatched` at the same label does not either; otherwise a loop of dispatch, block and same-label `next` would never trip the guard. **A step gets three rescues in all, whatever the conductor does in between**, and the fourth stop parks the run `waiting`, as before. A conductor whose work genuinely needs a fourth round at one label is parked and has to be resumed by the operator. That is the cost of a guard that cannot be bought back.

### 5. Only the conductor writes a live run

Claude Code gives every command it runs `CLAUDE_CODE_SESSION_ID`, the same id the Stop hook receives as `session_id`, and the opencode plugin now exports `ORCHESTRATOR_SESSION_ID` the same way (decision 9). Lease v2 records the conductor as `conductor_session`: `start` and `next` set it to the session they run in (`ORCHESTRATOR_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`), or keep the one on record when there is none.

On a **live** lease (active, dispatched or waiting, heartbeated within 12 h), when both ids are known and differ:

- `dispatch`, `wait`, `done`, `decide` and `raise` exit **5**, write nothing, print nothing on stdout, and print on stderr:

  ```
  run-state: <run> is conducted by session <8> (state <s>, last write <ISO>); this session (<8>) is not its conductor, so nothing was written. Stop unless the operator asked this session to take the run over; then move it here: next <run> '<its NEXT label>' --take-over
  ```

- `next` and `start` exit 5 the same way unless `--take-over` is given. `--take-over` moves `conductor_session`, appends `{from, to, at}` to `takeovers` and warns on stderr. A `--take-over` that moves nothing records nothing, and `--force` never implies it.
- `done` is allowed from any session once `plans/<run>/FINAL-*.md` exists: closing a finished run is safe.
- Reads (`status`, `lookup`, `budget`, `raises`, `watch`) are never checked. With no id on either side, from a plain terminal or an older host, nothing is checked.

A run that is done or abandoned has nobody left to protect, so it is not fenced. `status` prints `conductor: <8> (this session | another session: a write needs --take-over)`, or `none`, and `--json` adds `conductor_session` and `this_session_conducts`. A session resumed after `/clear` sees its first write refused with the way forward. The refusal names `next` with the flag last and no script name, so it is not an evidence shape either.

The Stop hook settles ownership by id first: when the lease names a conductor, the session owns the run exactly when its `session_id` is that one. A lease that names none falls back to the Increment 1 evidence, the session's own `run-state.cjs start` or `next` calls. A conductor that named its run through a shell variable, which the evidence never proved, is now owned.

**What the fence separates.** A subagent's Bash commands carry the same `CLAUDE_CODE_SESSION_ID` as the session that spawned it. The fence therefore separates sessions, not the conductor from its own subagents. A role that ran `run-state.cjs` would write as the conductor; none is told to.

### 6. `done` clears the resume state

`done` removes NEXT, `pending_decision` and `in_flight`, sets `stop_failure` to null and the state to `done`, and removes ACTIVE when it names the run. It deletes those named files and nothing else: the run folder also keeps `decisions.jsonl`, `budget-raises.jsonl` and evidence such as the barrier's `barrier/`. It writes the state before it removes the files, so a hook that reads between the two sees a done run, never an active one with no NEXT.

### 7. StopFailure: record, then notify

`hooks.json` registers `StopFailure`, the event the host fires when a turn ends on an API error, on the Stop hook's own script, with the same 10 s timeout. For a run this session owns (decision 5's test) that is live (active, dispatched or waiting, heartbeated within 12 h, no FINAL), the hook first writes

```
stop_failure = {at, error: String(input.error ?? 'unknown'), details: oneLine(input.error_details ?? '').slice(0, 200) || null}
```

and then notifies the operator, with `watch`'s own words for it: `orchestrator run <run>: the conductor's turn failed at HH:MMZ (<error>[: <details>]); continue the session once it clears`. `ORCHESTRATOR_NOTIFY=0` sends nothing. Any other value is a command, split the way `watch --notify` splits one, with the message appended as one argv element. Unset, it is a macOS notification on darwin and nothing elsewhere. The notifier is spawned detached, with its output ignored, and left to run. Any later run-state write clears `stop_failure`: a write is the conductor at work again.

The notification goes out from the hook because `watch` has no deployment owner, and a record alone would reach nobody. A hung subagent with no error still fires no event; only `watch` can see it (decision 8).

### 8. `watch` sees work in flight

`watch` reports, in this order, once per episode:

1. a `stop_failure` newer than the heartbeat (decision 7);
2. a pending decision, unchanged, with ` (in flight: <what>)` appended while `in_flight` holds anything;
3. `dispatched` work with no activity: `orchestrator run <run>: <what> in flight since HH:MMZ, no activity for N min — check the subagent and the session`;
4. an `active` run idle for `--idle-minutes`, now measured from the last activity rather than the heartbeat.

The last activity is the newest mtime of the conductor's Claude Code transcript, `<projects>/*/<sid>.jsonl`, and of its subagents' transcripts under `<sid>/subagents/`, taken together with the heartbeat. A subagent writes its transcript as it works, so a long but busy subagent is activity and a hung one is not. When there is a transcript to read, `--idle-minutes` (30) applies to dispatched work. When there is none (another host, or no session id on record), activity is the heartbeat alone, and dispatched work is reported after `--inflight-minutes` (180), a default the first real runs will check. A stale `dispatched` run therefore reads as work in flight, never as "waiting for your decision".

### 9. opencode

opencode runs a plugin's `shell.env` hook before every shell command, with the session's id. The plugin sets `ORCHESTRATOR_SESSION_ID` there (guarded: the terminal pane fires it with no session), and run-state records and checks the conductor on opencode as on Claude Code. Its ownership test also checks that id first, then the message scan.

opencode runs a `task` synchronously unless its experimental background subagents are on (`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS` true or 1, or, with that unset, `OPENCODE_EXPERIMENTAL`), and it lists no background work to a plugin. So the plugin counts a `dispatched` run as in flight only when they are on. Otherwise the declared work has already come back by the time the session goes idle, and the run is re-prompted with the `returned` reason under the same three-block guard. Without this, the stall text's own advice, to record a dispatch, would have disarmed the plugin after the first synchronous task. Compaction's resume line covers `dispatched` runs.

### 10. Lease v2, and version skew

The lease keeps the v1 keys, with `version: 2`, then `conductor_session`, `dispatched_at`, `takeovers` and `stop_failure`; the hook adds `last_block_at` once it blocks. Every write by `run-state.cjs` leaves that shape. `start` keeps a prior `takeovers`, and a v1 lease reads with defaults.

Three pieces ship separately: the hook from the plugin cache, `run-state.cjs` from each project's materialized copy, and `SKILL.md` from the plugin.

- **A new hook and a v1 lease** decide as before: the legacy evidence path, the same blocks and the same guard. A test runs both hooks over the same v1 leases and compares their decisions.
- **An old hook and a v2 lease:** the old hook blocks only `active`, so it lets a `dispatched` run stop, and it writes the whole lease back, so the v2 fields survive. A test runs the hook as it shipped before lease v2, a fixture held to its git blob id.
- **A new `SKILL.md` and an old project copy of `run-state.cjs`:** `dispatch` exits 64 until the project re-bootstraps. The orchestrator's stamp covers `run-state.cjs`, so the next run does.

### 11. A debug dump of the hook's input

With `ORCHESTRATOR_HOOK_DEBUG` set to an absolute path, the hook appends every input it receives, Stop and StopFailure alike, to that file, one line each, and fails open if it cannot. It exists to confirm, on a live host, what `background_tasks` lists at a dispatch-then-stop. Every test suite that spawns the hook or `run-state.cjs` builds each child's environment through one helper, copied into the two run-state suites because they ship without `hooks/`, which removes the session ids, the debug sink and the config dir, and turns notifications off. A suite run inside a host session would otherwise plant that session as every test run's conductor, and its probe would read the host's real transcripts.

## Host facts this rests on

- **Claude Code's Stop input** carries `background_tasks`, the session's in-flight background work (an empty array when nothing is in flight), and `session_crons`, its scheduled wakeups. A task has an `id`, a `type` (`subagent`, `workflow`, `shell`, `monitor`, `MCP task`, `teammate`, `cloud session`, or a housekeeping label) and a `status`; a wakeup has `recurring`.
- **`StopFailure`** fires when a turn ends on an API error, with `error` (`rate_limit`, `overloaded`, `server_error`, `authentication_failed`, `billing_error`, `unknown` and others) and an optional `error_details`. It is skipped for subagents.
- **`CLAUDE_CODE_SESSION_ID`** is set for every tool command, equals the Stop input's `session_id`, and survives `--resume` and compaction. A subagent's commands carry the spawning session's id.
- **opencode** fires `shell.env` with `{cwd, sessionID, callID}` for the bash tool, and merges the hook's `env` into the command's environment.

`background_tasks` was read from the host's schema, not yet captured from a live conductor's Stop. The fallback in decision 2 and the dump in decision 11 cover the gap until it is.

## Alternatives considered

**Synchronous spawns** (`run_in_background: false`, or a project setting that disables background tasks). Rejected: it fights the host's default, loses the overlap of a parallel run's inner joins with its still-running leaves, and a project switch would disable background shells too. It stays possible as a project's own choice.

**Parse the transcript**, reading asynchronous launches minus their completion notifications. Feasible, but it couples the hook to the host's internal row formats, which change between builds, when the host now states the answer in `background_tasks`.

**Pair each `start` or `next` with its tool result.** Rejected: compound and redirected commands print no receipt, and it would make output into evidence again, which the run state has refused since Increment 1.

**A per-run token** that `start` prints and every write passes back. Rejected: ceremony and `SKILL.md` bytes for every write, and a secret in every transcript. The host already gives every command a session id.

**Observation only, no `dispatch`.** Viable on Claude Code alone. Rejected: `status`, `watch`, opencode and the host without a task list would have no record of what is in flight, and conductors would keep reaching for `wait`, the only sanctioned way to explain a turn end.

**Declaration only, trusting `dispatched`.** Rejected: a stale declaration disarms the hook exactly as `wait` did. The host's list wins wherever the host sends one, and a declared run whose work came back gets the `returned` block.

**An automatic takeover** when the recorded conductor has been silent for a while. Rejected for now: a takeover is one refusal and one retry, and the operator decides whether the run moves.

## Consequences

- **A turn that ends after a dispatch is let through.** The hook writes nothing, and a block, when it comes, says which of two things happened.
- **`wait` is the operator's again.** A pending decision means a question, and `watch` can say so.
- **A run has one writer.** A second live session gets exit 5 and the way to take the run over; the `takeovers` log shows every move.
- **The stamp moves.** `run-state.cjs` is materialized, so every project re-bootstraps on its next run.

**Residual risks, named:**

- **A leaked shell beside a stale `dispatched`** hides the `returned` block until the next `next`, because a shell counts while the run is dispatched. `watch`'s activity probe is the backstop.
- **Older builds without `background_tasks`** fall back to the declaration: a dispatch the conductor did not record is blocked as a stall, and the stall text teaches `dispatch`.
- **Unknown task types** count only while the run is dispatched: safe for stalls, and a new host type that does wake the session would be blocked once while active.
- **A takeover is a judgement.** A stale session told to stop may still pass `--take-over`; the log makes that visible but nothing prevents it. Its role spawns before any run-state call are not fenced at all; only a tool-use fence on role spawns would stop them.
- **A write from another session revives an abandoned run without moving its conductor.** Only `start` and `next` move it, so the reviving session's next write is fenced and needs `--take-over`. The resume header runs `next` first, which avoids this.
- **`watch` still has no deployment owner.** The StopFailure notification is the only operator-visible signal without it.

**Costs.** `in-flight` costs one run-state call per background dispatch, by construction of the rule. `conductor-lease` and `stop-failure` are unmeasured: the first real runs measure them. In the meantime their fixtures say so rather than presume a number.

**The falsifier:** a block recorded while `background_tasks` listed a running subagent; a `wait` written after a dispatch with no question behind it; a run written by two live sessions with no takeover on record; or a turn that ended on an API error with no `stop_failure` recorded for its live run.
