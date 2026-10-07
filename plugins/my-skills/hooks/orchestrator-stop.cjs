#!/usr/bin/env node
/**
 * The Claude Code half of the orchestrator watchdog: a plugin Stop hook that hands
 * the turn back to a conductor that ended it mid-run. A run whose turn ends on
 * "Now Step 5 — QA" otherwise sits idle until someone happens to look.
 *
 * It blocks the stop only when every one of these holds:
 *   1. `.orchestrator/runs/ACTIVE` names a run whose `lease.json` is `active`, or
 *      `dispatched` — work the conductor recorded with `run-state.cjs dispatch`;
 *   2. the lease was heartbeated less than 12 h ago;
 *   3. there is no `plans/<run>/FINAL-*.md`;
 *   4. there is no `pending_decision`, the file a deliberate operator stop writes;
 *   5. this session conducts the run (below);
 *   6. nothing will resume the session on its own (`willResume`);
 *   7. `stop_hook_active` is not set, or the run has progressed since the last block:
 *      NEXT moved on, or work was dispatched after it;
 *   8. fewer than three blocks have landed on the same NEXT step.
 *
 * The reason the conductor reads comes in two variants. An `active` run stalled
 * between steps, and is told to dispatch the next one and record it. A `dispatched`
 * run had its work report back with nothing left in flight, and is told to act on the
 * hand-back.
 *
 * Ownership (5): lease v2 names the run's conductor, `conductor_session` — the session
 * id the host gives every command, recorded by the session's own `run-state.cjs start`
 * or `next` — and when it does, the session owns the run exactly when its `session_id`
 * is that one. A lease that names none, written before v2 or from a shell with no
 * session id, falls back to evidence: this session's own tool calls ran
 * `run-state.cjs start <run>` or `next <run>`. Only commands count there, never their
 * output or anyone's prose, so a `status` that printed a note naming the command hands
 * the run to nobody. The lease's `session_id` records who was blocked last, and moves
 * ownership rather than sharing it: once it names another session, this one must hold
 * the command that wrote the current NEXT — `next <run> "<that label>"`, or
 * `start <run>` at Step 0 — so a session the run has moved on from is never pushed
 * back into conducting it.
 *
 * The same script takes StopFailure, the turn that ended on an API error — a rate
 * limit, an overload — for which the host runs no Stop hook. For a live run this
 * session owns it records `stop_failure` in the lease, then notifies the operator:
 * ORCHESTRATOR_NOTIFY=0 sends nothing, any other value names the notifier command, and
 * unset is a macOS notification on darwin and nothing elsewhere. With
 * ORCHESTRATOR_HOOK_DEBUG set to an absolute path, every input is appended to that
 * file, one line each.
 *
 * Every error path exits 0 with no output. A watchdog that blocks a stop on its own
 * bug is worse than no watchdog.
 *
 * The opencode plugin (opencode/orchestrator-watchdog.js) requires this file for the
 * same rules, so they are exported, and the hook itself runs only as the main module.
 *
 *   node hooks/orchestrator-stop.cjs < stop-hook-input.json
 */
'use strict';
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const STALE_MS = 12 * 60 * 60 * 1000;
const MAX_BLOCKS = 3;
const CHUNK_BYTES = 1024 * 1024;
const SCAN_CAP_BYTES = 64 * 1024 * 1024;
// The minted shape is `<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>`, at most 62 characters.
// ACTIVE becomes a path segment, so nothing that could climb out of runs/ gets
// through, and the cap keeps the block reason under 600 characters.
const RUN_NAME = /^\w[\w.-]{0,63}$/;
// The label `run-state.cjs start` writes to NEXT, so the one a `start` proves.
const FIRST_STEP = 'Step 0 — preflight';
// run-state.cjs's flags that take no value; every other `--flag` consumes the next word.
const BOOLEAN_FLAGS = new Set(['--force', '--json', '--all', '--once', '--take-over']);
// Background work that reports back into the session, by the host's label and by its internal type.
const RESUMES = new Set(['subagent', 'local_agent', 'workflow', 'local_workflow', 'cloud session', 'remote_agent', 'mcp task', 'mcp_task']);
// The host's own housekeeping, which never wakes a conductor.
const HOUSEKEEPING = new Set(['dream', 'auto-mode scan', 'auto_mode_scan', 'memory import', 'local_memory_import']);
// The states of a run still under way, for StopFailure: a waiting run still has a conductor to fail.
const LIVE_STATES = new Set(['active', 'dispatched', 'waiting']);
// The default notifier on darwin, as run-state.cjs `watch` has it: the message is `item 1 of argv`, never source.
const OSASCRIPT = [
  'osascript',
  '-e', 'on run argv',
  '-e', 'display notification (item 1 of argv) with title "orchestrator"',
  '-e', 'end run',
];

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// The same whole-or-nothing write and timestamp as run-state.cjs, which owns these files.
function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Collapse whitespace the way run-state.cjs does before it writes a label. */
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * Where to look for a run: the given directories, then every ancestor of the last
 * one. The Stop hook passes CLAUDE_PROJECT_DIR and the session cwd, so a session that
 * moved into a `git worktree add` checkout, or into a package below `.orchestrator/`,
 * still finds the run it conducts there.
 */
function searchRoots(...dirs) {
  const roots = dirs.filter(Boolean).map((dir) => path.resolve(dir));
  for (let dir = roots.at(-1); dir && path.dirname(dir) !== dir; ) {
    dir = path.dirname(dir);
    roots.push(dir);
  }
  return [...new Set(roots)];
}

/**
 * Every checkout `git worktree add` made of the project at `root`, when `root` holds
 * `.orchestrator/`. A run Step 0a moved into a new worktree keeps its state there,
 * and neither host tells a hook where a session's shell went: opencode runs each
 * command in its project directory. Read from git's own registry,
 * `.git/worktrees/<name>/gitdir`, rather than by spawning `git worktree list`: a hook
 * that waits on a busy machine's git answers late or not at all. When `root` is itself
 * a linked worktree, its `.git` file leads to the same registry. Any failure is an
 * empty list.
 */
function linkedWorktrees(root) {
  if (!root || !fs.existsSync(path.join(root, '.orchestrator'))) return [];
  try {
    let common = path.join(root, '.git');
    const found = [];
    if (fs.statSync(common).isFile()) {
      const own = /^gitdir: (.+)$/m.exec(fs.readFileSync(common, 'utf8'))[1].trim();
      common = path.resolve(root, own, '..', '..');
      found.push(path.dirname(common));
    }
    const registry = path.join(common, 'worktrees');
    for (const name of fs.readdirSync(registry)) {
      try {
        // Absolute, or relative to its own entry under `worktrees.useRelativePaths`.
        found.push(path.dirname(path.resolve(registry, name, fs.readFileSync(path.join(registry, name, 'gitdir'), 'utf8').trim())));
      } catch {
        // A pruned or half-written entry names no checkout.
      }
    }
    return found;
  } catch {
    return [];
  }
}

function readLease(dir) {
  const lease = JSON.parse(fs.readFileSync(path.join(dir, 'lease.json'), 'utf8'));
  if (!lease || typeof lease !== 'object' || Array.isArray(lease)) throw new Error('lease.json is not an object');
  return lease;
}

/**
 * Every run an ACTIVE file names under the given roots, in root order, each with its
 * parsed lease. A root whose ACTIVE or lease is malformed is skipped, never followed:
 * one broken project must not hide a live run in the next root, and a parked run in
 * the project root must not hide the one in the worktree the session moved into.
 */
function activeRuns(roots) {
  const found = [];
  for (const root of roots) {
    try {
      const runs = path.join(root, '.orchestrator', 'runs');
      const active = readIfExists(path.join(runs, 'ACTIVE'));
      if (active === null) continue;
      const run = active.split(/\r?\n/)[0].trim();
      if (!RUN_NAME.test(run)) continue;
      const dir = path.join(runs, run);
      found.push({ root, run, dir, lease: readLease(dir) });
    } catch {
      // Unreadable: this root proves nothing.
    }
  }
  return found;
}

function hasFinal(runDir) {
  let names;
  try {
    names = fs.readdirSync(runDir);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  return names.some((name) => name.startsWith('FINAL-') && name.endsWith('.md'));
}

const fresh = (lease, now) => now - Date.parse(lease.heartbeat_at) < STALE_MS;

/** Conditions 1-4: the run is live, unfinished, and not waiting for the operator on purpose. */
function blockable({ root, run, dir, lease }, now = Date.now()) {
  if (lease.state !== 'active' && lease.state !== 'dispatched') return false;
  if (!fresh(lease, now)) return false;
  if (hasFinal(path.join(root, 'plans', run))) return false;
  return fs.statSync(path.join(dir, 'pending_decision'), { throwIfNoEntry: false }) === undefined;
}

/** StopFailure's test: a run still under way — active, dispatched or waiting, heartbeated within 12 h, with no FINAL. */
function live({ root, run, lease }, now = Date.now()) {
  return LIVE_STATES.has(lease.state) && fresh(lease, now) && !hasFinal(path.join(root, 'plans', run));
}

/** NEXT's first line, the step the run is at; empty when NEXT is missing. */
function nextStep(dir) {
  return (readIfExists(path.join(dir, 'NEXT')) || '').split(/\r?\n/)[0].trim();
}

/** The session lease v2 names as the run's conductor, or null for a lease that names none. */
function conductorOf(lease) {
  return typeof lease?.conductor_session === 'string' && lease.conductor_session ? lease.conductor_session : null;
}

/**
 * Condition 6: will something wake this session without the operator? The host lists
 * the session's background work in `background_tasks`, and its scheduled wakeups in
 * `session_crons`. A subagent, a workflow, a cloud session or an MCP task reports back
 * into the session, and so does a one-shot wakeup: either lets the turn end. A
 * background shell, a monitor, a teammate, a type this list does not know and a
 * recurring wakeup count only while the run is `dispatched` — one leaked shell, one
 * idle teammate or one `/loop` would otherwise let every later stall through. The
 * host's own housekeeping never counts. A host that sends no task list, an older
 * build, is trusted only on what the conductor declared: a `dispatched` run will
 * resume, an `active` one will not.
 */
function willResume({ lease }, input) {
  const dispatched = lease.state === 'dispatched';
  const crons = Array.isArray(input?.session_crons) ? input.session_crons : [];
  if (crons.some((cron) => cron && typeof cron === 'object' && (cron.recurring === false || dispatched))) return true;
  if (!Array.isArray(input?.background_tasks)) return dispatched;
  return input.background_tasks.some((task) => {
    if (!task || (task.status !== 'running' && task.status !== 'pending')) return false;
    const type = String(task.type ?? '').toLowerCase();
    if (HOUSEKEEPING.has(type)) return false;
    return RESUMES.has(type) || dispatched;
  });
}

/** The newest time `in_flight` records, in ms, or NaN when nothing was dispatched since the step began. */
function lastDispatch(dir) {
  let newest = NaN;
  for (const line of (readIfExists(path.join(dir, 'in_flight')) || '').split('\n')) {
    const at = Date.parse(line.trim().split(/\s/)[0]);
    if (Number.isFinite(at) && !(at <= newest)) newest = at;
  }
  return newest;
}

/**
 * Condition 7's test: has the run moved since the last block? Claude Code keeps
 * `stop_hook_active` set for the rest of the operator's turn, so on its own it would
 * rescue one stall per turn and leave every later one in an unattended run idle. A
 * block leaves `blocks` at 1 or more on `last_block_next`, and `run-state.cjs next`
 * resets `blocks` whenever the step changes — so a step that moved away and back
 * reads as progress. So does work dispatched after the block, an `in_flight` line
 * newer than `last_block_at`: the conductor acted on the block, and when that work
 * reports back at the same step, the hand-back is blocked rather than let through.
 * That is progress for this condition only. A dispatch never resets `blocks`, so a
 * step still gets three rescues in all.
 */
function progressed(lease, step, dir) {
  if (step !== lease.last_block_next || !(Number(lease.blocks) > 0)) return true;
  const blockedAt = Date.parse(lease.last_block_at);
  return Number.isFinite(blockedAt) && lastDispatch(dir) > blockedAt;
}

/**
 * A shell command split into words the way a shell splits them, quotes removed, with
 * each control operator (`;`, `&`, `|`, `(`, `)`, a newline) as a `null` word, so one
 * command never runs into the next. Nothing is expanded: this only reads what was run.
 */
function shellWords(command) {
  const words = [];
  let word = null;
  let quote = null;
  const end = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && '"\\$`'.includes(command[i + 1] ?? '')) word += command[++i];
      else word += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      word = word ?? '';
    } else if (c === '\\' && i + 1 < command.length) {
      word = (word ?? '') + command[++i];
    } else if (';&|()\n'.includes(c)) {
      end();
      words.push(null);
    } else if (/\s/.test(c)) {
      end();
    } else {
      word = (word ?? '') + c;
    }
  }
  end();
  return words;
}

/**
 * Every `run-state.cjs start <run>` and `next <run> "<label>"` in one shell command, as
 * `{ command, label }`. The run is matched as a word, so a quoted name, flags before
 * the subcommand and extra spaces all count, while a mention inside another word —
 * a `--note` that quotes the command, a `grep` pattern — never does.
 */
function runStateCalls(command, run) {
  const calls = [];
  if (typeof command !== 'string' || !command.includes('run-state.cjs')) return calls;
  const words = shellWords(command);
  for (let i = 0; i < words.length; i++) {
    if (words[i] === null || path.basename(words[i]) !== 'run-state.cjs') continue;
    // The positionals, parsed as run-state.cjs parses them: `--` ends the flags.
    const args = [];
    for (let j = i + 1; j < words.length && words[j] !== null; j++) {
      const w = words[j];
      if (w === '--') {
        for (j++; j < words.length && words[j] !== null; j++) args.push(words[j]);
        break;
      }
      if (!w.startsWith('--')) args.push(w);
      else if (!BOOLEAN_FLAGS.has(w) && j + 1 < words.length && words[j + 1] !== null) j++;
    }
    const [subcommand, name, label] = args;
    if ((subcommand === 'start' || subcommand === 'next') && name === run) {
      calls.push({ command: subcommand, label: subcommand === 'next' && label !== undefined ? oneLine(label) : null });
    }
  }
  return calls;
}

/**
 * The evidence test over one proved call, for a lease that names no conductor. With
 * nobody on record, or with this session on record, any `start` or `next` of the run
 * proves it. Once the lease names another session, only the call that wrote the
 * current NEXT does.
 */
function provesOwnership({ lease }, step, sessionId) {
  const owner = typeof lease.session_id === 'string' && lease.session_id ? lease.session_id : null;
  if (!owner || owner === sessionId) return () => true;
  return (call) => (call.command === 'next' ? call.label === step : step === FIRST_STEP);
}

/**
 * The transcript's complete lines, newest first: read backwards in fixed chunks, and
 * no further back than the last 64 MB. A line cut by that floor is dropped. A line
 * that spans chunks is kept as its pieces until its start turns up, then joined
 * once, so one huge tool result costs a copy of itself and not one per chunk.
 */
function* linesNewestFirst(transcriptPath) {
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const floor = Math.max(0, size - SCAN_CAP_BYTES);
    let end = size;
    let pieces = []; // the newer part of a line whose start is in an older chunk, oldest first
    while (end > floor) {
      const start = Math.max(floor, end - CHUNK_BYTES);
      const buffer = Buffer.alloc(end - start);
      let filled = 0;
      while (filled < buffer.length) {
        const read = fs.readSync(fd, buffer, filled, buffer.length - filled, start + filled);
        if (read === 0) break;
        filled += read;
      }
      const chunk = buffer.subarray(0, filled);
      let cut = chunk.length;
      while (cut > 0) {
        const nl = chunk.lastIndexOf(0x0a, cut - 1);
        if (nl === -1) break;
        const piece = chunk.subarray(nl + 1, cut);
        if (pieces.length) {
          yield Buffer.concat([piece, ...pieces]);
          pieces = [];
        } else if (piece.length) {
          yield piece;
        }
        cut = nl;
      }
      if (cut > 0) pieces.unshift(chunk.subarray(0, cut));
      end = start;
    }
    if (floor === 0 && pieces.length) yield Buffer.concat(pieces);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * The evidence path for Claude Code. Only this session's own Bash calls count — an
 * assistant `tool_use` input — never a tool result, a hook's feedback, or text.
 * Stops at the first call `accepts` takes.
 */
function transcriptHasEvidence(transcriptPath, run, accepts = () => true) {
  const needles = [Buffer.from('run-state.cjs'), Buffer.from(run)];
  for (const line of linesNewestFirst(transcriptPath)) {
    if (!needles.every((needle) => line.includes(needle))) continue;
    let entry;
    try {
      entry = JSON.parse(line.toString('utf8'));
    } catch {
      continue;
    }
    if (entry?.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      if (block?.type !== 'tool_use') continue;
      if (runStateCalls(block.input?.command, run).some(accepts)) return true;
    }
  }
  return false;
}

/**
 * Condition 5 for Claude Code: the conductor the lease names, by id, and only for a
 * lease that names none, the session's own `start` or `next` in its transcript.
 */
function owned(found, input, step) {
  const conductor = conductorOf(found.lease);
  if (conductor) return conductor === input.session_id;
  if (typeof input.transcript_path !== 'string') return false;
  return transcriptHasEvidence(input.transcript_path, found.run, provesOwnership(found, step, input.session_id));
}

/**
 * Condition 8, and the lease write that goes with every proved stop. `blocks` counts
 * consecutive blocks on an unchanged NEXT first line; `run-state.cjs next` resets it
 * when the step changes. A fourth stop on the same step trips the guard instead: the
 * run is parked `waiting` with a `pending_decision`, and the operator's
 * `run-state.cjs watch` notifies.
 *
 * It re-reads the lease and re-checks conditions 1-4 right before writing, and asks
 * `resumes` whether the run as it now stands will resume on its own: a `wait`, `done`,
 * `next` or `dispatch` that landed while this stop was being proved — the plugin awaits
 * two client calls in between — must neither be reverted nor pushed past. Returns the
 * reason's variant, `returned` for a `dispatched` run and `stall` otherwise, or false
 * to let the stop through.
 */
function recordBlock({ root, run, dir }, sessionId, resumes = () => false) {
  const lease = readLease(dir);
  const found = { root, run, dir, lease };
  if (!blockable(found) || resumes(found)) return false;
  const step = nextStep(dir);
  const prior = lease.last_block_next === step ? Number(lease.blocks) || 0 : 0;
  const kind = lease.state === 'dispatched' ? 'returned' : 'stall';
  if (sessionId) lease.session_id = sessionId;
  if (prior >= MAX_BLOCKS) {
    writeAtomic(path.join(dir, 'pending_decision'), `${isoNow()} watchdog: ${MAX_BLOCKS} blocks without progress\n`);
    lease.state = 'waiting';
  } else {
    lease.blocks = prior + 1;
    lease.last_block_next = step;
    // To the millisecond: a dispatch that answers this block lands seconds later, and must read as later.
    lease.last_block_at = new Date().toISOString();
  }
  writeAtomic(path.join(dir, 'lease.json'), `${JSON.stringify(lease, null, 2)}\n`);
  return prior < MAX_BLOCKS ? kind : false;
}

/**
 * What the conductor reads instead of stopping. Both hosts send the same text. Neither
 * variant names `run-state.cjs` before `start` or `next`, the evidence shape: the host
 * writes the reason into the transcript, and it must hand the run to nobody.
 */
function blockReason(run, kind = 'stall') {
  if (kind === 'returned') {
    return 'Orchestrator watchdog: the work recorded with dispatch has reported back and nothing is in flight, '
      + 'so nothing will resume the run. Act on the hand-back now: record the step you move to with `next` and '
      + `dispatch it, run \`wait ${run} '<question>'\` if the operator must answer, or \`done ${run}\` if the run is over.`;
  }
  const runState = 'node .orchestrator/run-state.cjs';
  return 'Orchestrator watchdog: the run is active with no FINAL, no pending decision and nothing in flight; '
    + `nothing will resume it. Dispatch the NEXT step \`${runState} status\` prints, then record it: `
    + `\`${runState} dispatch ${run} '<what>'\`. Use \`wait ${run} '<Status line or question>'\` for a STALLED stop `
    + `or an operator question (AskUserQuestion / question first), \`done ${run}\` when over.`;
}

/**
 * `--notify` and ORCHESTRATOR_NOTIFY split into words the way a shell splits them —
 * whitespace separates, single quotes are literal, double quotes and a backslash escape
 * — and nothing else is done. A copy of run-state.cjs's `splitCommand`, which the
 * integration suite holds it to. Returns null for an unterminated quote.
 */
function splitCommand(line) {
  const words = [];
  let word = null;
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) word += line[++i];
      else word += c;
    } else if (/\s/.test(c)) {
      if (word !== null) words.push(word);
      word = null;
    } else {
      if (word === null) word = '';
      if (c === "'" || c === '"') quote = c;
      else if (c === '\\' && i + 1 < line.length) word += line[++i];
      else word += c;
    }
  }
  if (quote) return null;
  if (word !== null) words.push(word);
  return words;
}

const clock = (ms) => (Number.isFinite(ms) ? `${new Date(ms).toISOString().slice(11, 16)}Z` : 'an unknown time');

/** The words run-state.cjs `watch` uses for the same failure, which the integration suite holds equal. */
function stopFailureMessage(run, failure) {
  const details = failure.details ? `: ${failure.details}` : '';
  return `orchestrator run ${run}: the conductor's turn failed at ${clock(Date.parse(failure.at))} ` +
    `(${failure.error}${details}); continue the session once it clears`;
}

/**
 * Tell the operator, without waiting for it. ORCHESTRATOR_NOTIFY=0 sends nothing; any
 * other value is a command, split like `watch --notify`, and the message is appended
 * as one argv element, never shell text; unset is a macOS notification on darwin and
 * nothing elsewhere. The notifier is detached and left to run: the hook has 10 s, and a
 * notification is not worth any of them.
 */
function notify(message, env = process.env) {
  const setting = env.ORCHESTRATOR_NOTIFY;
  if (setting === '0') return;
  let argv = null;
  if (setting) {
    const words = splitCommand(setting);
    if (words && words.length) argv = [...words, message];
  } else if (process.platform === 'darwin') {
    argv = [...OSASCRIPT, message];
  }
  if (!argv) return;
  const child = spawn(argv[0], argv.slice(1), { detached: true, stdio: 'ignore', env });
  child.on('error', () => {
    // A notifier that cannot start changes nothing: the lease already holds the failure.
  });
  child.unref();
}

/**
 * StopFailure: for the first live run this session owns, record the failure in the
 * lease — where `watch` and `status` find it, and where the conductor's next write
 * clears it — and only then notify.
 */
function recordStopFailure(input, roots) {
  for (const found of activeRuns(roots)) {
    if (!live(found) || !owned(found, input, nextStep(found.dir))) continue;
    const lease = readLease(found.dir);
    if (!live({ ...found, lease })) return;
    const failure = {
      at: new Date().toISOString(),
      error: String(input.error ?? 'unknown'),
      details: oneLine(input.error_details ?? '').slice(0, 200) || null,
    };
    lease.stop_failure = failure;
    writeAtomic(path.join(found.dir, 'lease.json'), `${JSON.stringify(lease, null, 2)}\n`);
    notify(stopFailureMessage(found.run, failure));
    return;
  }
}

/**
 * ORCHESTRATOR_HOOK_DEBUG: append the raw input, its newlines folded into spaces so it
 * stays one line, to the file the variable names — an absolute path only. A sink that
 * cannot be written changes nothing.
 */
function debugDump(raw, env = process.env) {
  const file = env.ORCHESTRATOR_HOOK_DEBUG;
  if (!file || !path.isAbsolute(file)) return;
  try {
    fs.appendFileSync(file, `${raw.replace(/[\r\n]+/g, ' ').trim()}\n`);
  } catch {
    // Fail open.
  }
}

function main() {
  const raw = fs.readFileSync(0, 'utf8');
  debugDump(raw);
  const input = JSON.parse(raw);
  if (!input || typeof input !== 'object') return;
  const project = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  const roots = [...searchRoots(process.env.CLAUDE_PROJECT_DIR, input.cwd), ...linkedWorktrees(project)];
  if (input.hook_event_name === 'StopFailure') {
    recordStopFailure(input, roots);
    return;
  }
  if (input.hook_event_name && input.hook_event_name !== 'Stop') return;
  for (const found of activeRuns(roots)) {
    if (!blockable(found)) continue;
    const step = nextStep(found.dir);
    if (!owned(found, input, step)) continue;
    if (willResume(found, input)) return;
    if (input.stop_hook_active === true && !progressed(found.lease, step, found.dir)) return;
    const kind = recordBlock(found, input.session_id, (now) => willResume(now, input));
    if (kind) process.stdout.write(`${JSON.stringify({ decision: 'block', reason: blockReason(found.run, kind) })}\n`);
    return;
  }
}

if (require.main === module) {
  try {
    main();
  } catch {
    // Fail open: unreadable stdin, lease or transcript never blocks a stop.
  }
}

module.exports = {
  activeRuns, blockable, live, nextStep, conductorOf, willResume, progressed, runStateCalls, provesOwnership, recordBlock,
  blockReason, splitCommand, stopFailureMessage, searchRoots, linkedWorktrees, CHUNK_BYTES, SCAN_CAP_BYTES,
};
