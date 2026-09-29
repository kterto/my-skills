# Measuring what a compaction costs a flash run

**Status:** protocol, with its script. Nothing has been measured with it on flash yet.
**Decides:** whether flash on a small-window host needs more than its byte budget and its resume pointer (ADR-0029), and whether it has earned a state file under ADR-0026's admission rule, which asks for a measured state loss first.
**Script:** `scripts/measure-compactions.mjs`, tested by `scripts/__tests__/measure-compactions.test.mjs`.

---

## Why this exists

A host that runs out of context compacts. It replaces the conversation with a summary and, in Claude Code, re-attaches each skill the session invoked. A conductor that comes back without its protocol either reads it again or runs on whatever the summary kept. The second is how a run loses its place.

ADR-0029 holds flash's `SKILL.md` to 16,384 bytes and puts a resume pointer in its first kilobyte. That is an argument; this protocol turns it into a measurement. It is metric 7 of the 2026-09-29 harness re-evaluation (`DESIGN-v2.md` §10, not in this repository): small-window continuity, per compaction, over at least 15 forced compactions per host.

## What a compaction does to a skill

- **Claude Code cuts a re-attached skill at 20,000 characters**, then appends `[... skill content truncated for compaction; use Read on the skill path if you need the full text]`. All 20 cut re-attaches in the baseline transcripts are exactly 20,000 characters. In bytes that is 20,482-20,530 for the orchestrator and 20,163-20,167 for spec-driven-eval, depending on how much of the head is multi-byte.
- **A skill under 20,000 characters comes back whole.** tlc's 16,803 bytes came back whole at all 9 of its compactions. A flash `SKILL.md` within its 16,384-byte budget is never cut, because a UTF-8 file never has more characters than bytes.
- **opencode re-attaches nothing.** In a local store on opencode 1.18.32, all 176 compactions were followed by one synthetic "continue" message of at most 429 characters. A skill's protocol survives there only in the summary or in the preserved tail, so expect more re-reads on opencode, and an empty re-attached column.

## The metrics

| Metric | What it counts | Target for flash |
|---|---|---|
| **Protocol re-reads** | Conductor compactions followed, within the next 15 real assistant turns, by at least one read of protocol: the skill's files, a role template, or an orchestrator reference. Run state is not protocol. | 0 beyond the resume line |
| **State loss** | Compactions after which the conductor lost its place. Judged by hand; see *Judging state loss*. | 0 |
| **Spawns that compact** | Role spawns whose own transcript holds a compaction. | Report it; no target |
| **Peak context per spawn** | The largest single-turn context of each spawn: input + cache-read + cache-creation tokens. | Report it; no target |

The resume pointer sends a conductor to `plans/*/`, which is run state. So every protocol re-read is beyond the resume line. Flash's `SKILL.md` carries its own `newid`, so no step after the mint needs the recipe in `.orchestrator/flash/artifact-format-flash.md`; reading it after a compaction counts like any other role file.

Each proportion is reported as k/n with a Wilson 95% interval. The samples are small, and a bare rate hides that. **0 of 15 still allows a true rate of 20%.** Fifteen is enough to tell flash from the orchestrator. Flash at 0/15 has an upper bound of 20.4%, and even 1/15 has one of 29.8%, both below the orchestrator's lower bound: 30% by this script, 36% as published. Five would not be: 0/5 still allows 43%.

### Baselines

All baseline compactions were automatic, in Claude Code, on GLM-5.3, GLM-5.3-flash and DeepSeek-v4.1-flash hosts with a window of about 165k tokens.

| Baseline | Published | This script, same transcripts |
|---|---|---|
| Orchestrator: conductor compactions with a protocol re-read | 9/15 | 8/15 = 53% (95% CI 30–75%) |
| Orchestrator: state loss, by hand | 2 of 7 examined = 29% (8–64%) | by hand |
| Orchestrator: spawns that compacted, in two runs | 13/26 and 10/13 | 13/26 = 50% (32–68%); 10/13 = 77% (50–92%) |
| tlc: conductor compactions with a protocol re-read | 0/9 | 0/9 = 0% (0–30%) |
| tlc: re-attached | 16.8 KB, whole | 16,803 bytes, whole at 9 of 9 |

The script reproduces the published measurement exactly on all 58 compactions in those transcripts: pre and post tokens, summary bytes, each re-attached skill's name and bytes, and turns examined. Its re-read counts differ in 10 compactions, and whether a compaction had a re-read at all differs in 3:

- **One orchestrator conductor compaction counts as a re-read in the published 9 and not here.** The call behind it was `ls -d …/plugins/cache/my-skills/*/ … | head`, a directory listing that read no protocol text. In the same window that conductor parsed its own session transcript with a script, a sign of state loss, which this script reports in the `transcript` column instead.
- **Two spawn compactions count here and not in the published measurement.** Both read `~/.claude/skills/clean-code-gates/bin/gates.cjs`, and the published measurement did not count skills under `~/.claude/skills/`. This script counts every skill directory, and `--skill` narrows the count to one skill.
- **The other seven differ only in how many re-reads followed.** The published measurement missed relative paths such as `cat .orchestrator/config.md`, and counted listings and pipes into `head`.

Compare a flash result with the right-hand column, since both were measured by the same rules.

## Forcing the compactions

**Two batches, at least 15 compactions each:** one on Claude Code served by ollama, with GLM-5.3-flash or DeepSeek-v4.1-flash, and one on opencode. Use one model per batch and name it in the report. Run Claude Code against the same ollama-served models the baselines used; their transcripts name them `glm-5.3-flash:cloud` and `deepseek-v4.1-flash:cloud`.

**One flash run per session.** Start each run in a fresh session and do nothing else in it, so every compaction in the transcript belongs to the run. Never switch host or model mid-run.

**Draw the boundaries at random, before each run.** A boundary is the moment a step finishes; flash prints `Elapsed: {m}m` after each step. The ten boundaries are:

1. after pre-flight, once the run folder is minted;
2. while Step 1 holds for the interview answers (only with the interview on);
3. after the brainstormer's `SPEC`;
4. after the architect's `FEAT`;
5. after the coder returns `DONE`;
6. after typecheck and build (Step 3b);
7. after the live check returns its report (Step 3c);
8. after the reviewer's `CR` (Step 4);
9. after a review-rework coder, before the fresh `CR` (only when a `CR` asked for changes);
10. after the `FINAL` is written, before the banner prints;
11. after a live-rework coder, before `live` is spawned again (only when the live check failed).

Draw two per run with `node -e 'console.log(1 + Math.floor(Math.random() * 11))'`. Redraw a boundary the run cannot reach. Eight runs with two compactions each make a batch.

Boundaries 2, 7, 9 and 11 are the states the resume pointer is known not to recover, because none of them leaves a file in the run folder that sets it apart. The draw includes them on purpose. If a batch's 15 random draws never land on one of them, force one compaction there as well, and report it apart from the 15.

**How to compact at a boundary:**

- **Claude Code.** Flash runs its steps inside one turn. When the chosen step's `Elapsed:` line prints, press Esc to stop the turn. Type `/compact` with no instructions, since instructions change what the summary keeps. Then send exactly `continue`. Never hint at the step: the pointer is what is under test. At boundary 2 the turn has already ended on the questions, so `/compact`, then answer them as you would have.
- **opencode.** Same sequence: Esc, `/compact`, `continue`.

Automatic compactions that happen on their own also count. The script reports each one's trigger (`manual` or `auto`), so the two can be split.

**Keep a log**, one line per forced compaction: run, host and model, the boundary drawn, the clock time, and the session id. The script lists compactions by time, and the log says which boundary each one was.

## Running the script

Claude Code keeps each session at `~/.claude/projects/<slug>/<session-id>.jsonl`, or under `$CLAUDE_CONFIG_DIR` when that is set. `<slug>` is the project path with every character other than a letter or a digit replaced by `-`, so `/Users/me/app` becomes `-Users-me-app`. The spawns' transcripts sit in `<session-id>/subagents/`, one `agent-*.jsonl` each, beside an `agent-*.meta.json` that names the agent type. The newest session is `ls -t ~/.claude/projects/<slug>/*.jsonl | head -1`.

```bash
# A batch: every session, each read with its spawns; the totals cover them all
node scripts/measure-compactions.mjs --skill orchestrator-flash \
  ~/.claude/projects/-Users-me-app/<session-1>.jsonl ~/.claude/projects/-Users-me-app/<session-2>.jsonl

# The same list from a file, one path per line (zsh does not word-split a variable)
xargs node scripts/measure-compactions.mjs --skill orchestrator-flash < batch-sessions.txt

# One session by id: in that project's directory, or found in any project without --project
node scripts/measure-compactions.mjs --skill orchestrator-flash --session <session-id> --project /Users/me/app

# opencode: a session and every session spawned under it, read-only
node scripts/measure-compactions.mjs --skill orchestrator-flash --opencode <ses_id>

# JSON instead of the table, for the report
node scripts/measure-compactions.mjs --json --skill orchestrator-flash … > claude-code-batch.json
```

`--skill orchestrator-flash` counts flash's own protocol: its skill directory (`SKILL.md`, `templates/`) and the role files materialized in `.orchestrator/flash/`. It also lists only flash among the re-attached skills. It narrows no session: every compaction and spawn of every session you pass stays in the totals, so a batch holds only that skill's runs, or its rates are diluted. Without it, every skill's files, every role file and every orchestrator reference count. Run the batch both ways: the filtered run is the metric, and the unfiltered one shows what else the conductor went looking for.

Exit 2 means nothing was measured: a bad flag, a transcript that cannot be read, or an opencode store without the tables the script reads.

### Reading the table

One row per compaction, the conductor's first and then each spawn's:

| Column | Meaning |
|---|---|
| `pre`, `post` | Tokens before and after, as the host recorded them. opencode records neither, so the script uses the context of the last turn before and of the first turn after. |
| `summary` | Bytes of the compaction summary. |
| `turns` | Real assistant turns examined: 15, or fewer when the session ends or compacts again first. |
| `re-reads` | Protocol re-reads in those turns, one per tool call, each listed below its row with its paths. |
| `transcript` | Tool calls in those turns that touched a session transcript, a `.jsonl` under `~/.claude/projects/` or opencode's store. A hint of state loss, not a verdict. |
| `re-attached (bytes)` | Each skill the host re-attached, with `TRUNCATED` when it ends with the host's marker or lies within 64 bytes of 20,480. |

Then one line per session: spawns, spawns that compacted, the conductor's peak context, and the median and largest peak context among its spawns. The JSON has every spawn's peak. Last come the proportions with their intervals.

**What counts as a protocol re-read:**

- a `Read` of a protocol path;
- a Bash call that hands a protocol path to `cat`, `sed`, `head`, `tail`, `awk` or `grep`. The command's own variables are expanded (`S=…/SKILL.md; sed -n '1,40p' "$S"`), and its `cd` is followed.

A protocol path is one of three things:

- a file in a skill directory, `…/skills/<name>/` under `.claude/`, `.opencode/`, `.agents/`, `~/.config/opencode/`, or any `plugins/` tree;
- a role template: `.claude/agents/`, `.agents/agents/`, `.opencode/agent/`, `.opencode/agents/`, `.orchestrator/roles/`, and flash's `.orchestrator/flash/*.md`, or one of those directories, read whole as `grep -r` reads it;
- one of the orchestrator's references in `.orchestrator/`: `config.md`, `artifact-format*.md`, `gate-config.md`, `lane-protocol.md` and the rest.

**What does not count:**

- listing a skill directory;
- running a skill's script, even piped through `head` or `tail`;
- `sed -i`;
- run state: `plans/`, and everything in `.orchestrator/` other than its references and role files, `PROJECT-CONTEXT.md` included;
- the memory files that sit beside the transcripts.

A turn whose model is `<synthetic>` is an API error the host wrote, not a turn. A message id seen twice is one turn, because the host writes each block of a streamed message as its own record.

## Judging state loss

The script cannot judge state loss. Read each compaction's aftermath yourself: the conductor's, and each compacted spawn's. In the JSON, `line` is the compaction's line in the transcript and `at` its time. Read on until the conductor is back at work, which is usually inside the 15 turns and sometimes past them.

**The run lost state if the conductor did any of these:**

1. **Re-minted an id.** A second `newid` for an artifact that exists, a second `SPEC` in one run folder, or a fresh run folder minted mid-run.
2. **Re-asked an answered question.** A second `STATUS: QUESTION` round after the user answered, or a question the interview or an earlier reply had settled.
3. **Rebuilt a path by parsing its own transcript.** It read or grepped its own `.jsonl`, which the `transcript` column flags, or guessed the run folder or spec path instead of listing `plans/`.
4. **Redid a finished step.** It re-spawned a role whose artifact already exists: the architect with a `FEAT` in the folder, or the coder after `DONE`. Or it re-ran a rework the `CR` had already had, or re-ran the live rework.

Five flash states leave no file, so the pointer cannot bring the conductor back to them. Watch them most closely:

- **The interview wait.** Asking the same questions again is loss 2.
- **After a review-rework coder, before the fresh `CR`.** The newest artifact is still the old `REQUEST_CHANGES` `CR`, so doing the rework again is loss 4.
- **The live report.** Step 3c's rule is to re-spawn `live` when its report has left the context, so a re-spawn is correct. A report rebuilt from memory is a loss.
- **Whether the live rework is spent.** After a live-rework coder the folder holds the same `SPEC` and `DONE` `FEAT` as before the first `live` spawn. A second rework after a second `FAIL` is loss 4.
- **The interview's figures.** The counts and the wait on the `Interview:` line live only in the conversation. A `FINAL` whose figures the transcript does not bear out rebuilt them from memory, which is a loss.

**Not a loss:** re-reading run state. The pointer tells the conductor to list `plans/*/` and read the newest artifact; that is the resume working.

Record, per compaction, lost or not, which sign, and the line where it shows. Report k/n with its interval, which the script's own function computes:

```bash
node -e 'import("./scripts/measure-compactions.mjs").then((m) => console.log(m.wilson(0, 15)))'
```

For state loss, 15 compactions can show flash is not worse than about 1 in 5. The orchestrator's 2 in 7 is too thin a baseline, 8–64%, to show flash is better than it.

## opencode by hand

On opencode 1.18.32, sessions live in SQLite at `~/.local/share/opencode/opencode.db`, or `$XDG_DATA_HOME/opencode/opencode.db`. The store holds three tables that matter here:

- **`session`:** a spawn is a row whose `parent_id` is the spawning session. Its `agent` is the role, and its `title` the task.
- **`message`:** `data` is JSON, with `role`, `summary`, `tokens` (`input`, `cache.read`, `cache.write`), `modelID` and `path.cwd`.
- **`part`:** `data` is JSON, with `type` set to `text`, `tool` or `compaction`. A tool part carries `tool` (`read`, `bash`, …) and `state.input` (`filePath`, `command`).

A compaction is a user message holding a `compaction` part (`auto: false` after `/compact`). It is followed by an assistant message with `summary: true`, whose text parts are the summary, and then by a synthetic "continue".

`--opencode` does all of this for you. It reads the store read-only through `node:sqlite`, which needs Node 22.13 or later and prints an ExperimentalWarning, and it applies the Claude Code rules unchanged. To check it by hand, or without that Node, use `sqlite3` read-only; the store can run to gigabytes, and the `-readonly` flag keeps you from writing to it:

```sql
-- sqlite3 -readonly 'file:/Users/me/.local/share/opencode/opencode.db?mode=ro'
-- The newest top-level sessions
select id, datetime(time_created / 1000, 'unixepoch') from session
where parent_id is null order by time_created desc limit 5;

.param set :root 'ses_…'
-- Compactions in each session of the tree, and how many were forced
with recursive tree(id) as (select :root union all select s.id from session s join tree on s.parent_id = tree.id)
select p.session_id, count(*) as compactions, sum(json_extract(p.data, '$.auto') = 0) as manual
from part p join tree on tree.id = p.session_id
where json_extract(p.data, '$.type') = 'compaction' group by p.session_id;

-- Spawns, and spawns that compacted
with recursive tree(id) as (select id from session where parent_id = :root union all select s.id from session s join tree on s.parent_id = tree.id)
select count(*), sum(exists (select 1 from part p where p.session_id = tree.id and json_extract(p.data, '$.type') = 'compaction')) from tree;

.param set :session 'ses_…'
-- One session's compactions, by the message that holds each
select p.message_id, datetime(m.time_created / 1000, 'unixepoch'), json_extract(p.data, '$.auto')
from part p join message m on m.id = p.message_id
where p.session_id = :session and json_extract(p.data, '$.type') = 'compaction' order by m.time_created;

.param set :compaction 'msg_…'
-- The read and bash calls of the 15 real turns after one compaction: count the protocol paths by eye
with turns as (
  select m.id from message m
  where m.session_id = :session
    and m.time_created > (select time_created from message where id = :compaction)
    and json_extract(m.data, '$.role') = 'assistant'
    and coalesce(json_extract(m.data, '$.summary'), 0) = 0
    and json_extract(m.data, '$.error') is null
  order by m.time_created, m.id limit 15)
select json_extract(p.data, '$.tool'), coalesce(json_extract(p.data, '$.state.input.filePath'), json_extract(p.data, '$.state.input.command'))
from part p join turns on turns.id = p.message_id
where json_extract(p.data, '$.type') = 'tool' and json_extract(p.data, '$.tool') in ('read', 'bash') order by p.id;
```

Two cautions:

- **Do not take pre-compaction tokens from the summarizing call.** opencode prunes the history before it summarizes. In one run the call saw 44-63k tokens of a 255-274k conversation.
- **The store's schema is internal to opencode.** It can change with any release, as the `session_message` table beside these three suggests. The script exits 2 when the tables it reads are missing, and the queries above would fail too.

## The report

One table per host batch:

| Host, model | Runs | Compactions (manual / auto) | Conductor re-reads | State loss | Spawns that compacted | Peak context per spawn (median / max) |
|---|---|---|---|---|---|---|
| Claude Code, … | | | k/n (95% CI) | k/n (95% CI) | k/n (95% CI) | |
| opencode, … | | | k/n (95% CI) | k/n (95% CI) | k/n (95% CI) | |

Add a line for any compaction forced at boundary 2, 7, 9 or 11 outside the random 15. Attach the log and each batch's `--json` output.

## Limits

- **Some re-reads go unseen.** The script sees only `Read` and those six shell readers. A re-read through the `Grep` or `Glob` tools, `git show`, `node -e`, `find … | xargs cat`, or by invoking the skill again is not counted.
- **The shell reading is a heuristic.** It follows variables a command sets and its `cd`, and skips a here-document's body as text. It does not follow loops or functions, and it takes `<< name` in arithmetic for a here-document.
- **The window is 15 turns.** A conductor that goes back to its protocol later is not counted. Read on when you judge state loss.
- **`--skill orchestrator` owns shared files.** The role directories and `.orchestrator/` references count as the orchestrator's, because its bootstrap writes them. Flash writes its roles only to `.orchestrator/flash/`.
- **The two hosts' token counts differ in kind.** opencode's `pre` and `post` are turn contexts; Claude Code's are the host's own counts. Compare within a host, not across.
