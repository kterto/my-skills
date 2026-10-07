#!/usr/bin/env node
/**
 * Run state for the orchestrator: where a run is, kept on disk where a new session
 * can find it. The conductor writes it at every step boundary, and three readers
 * depend on it — a conductor that lost its place to a compaction or a new session
 * (`status`), the Claude Code Stop hook and the opencode idle plugin that keep a run
 * from stalling between steps, and the operator's heartbeat notifier (`watch`).
 *
 * The stall it exists for is a turn that ends between steps: the conductor announces
 * the next step, the turn ends, and the run sits for hours, until a human looks. A
 * watchdog may push past that stop only if it can tell it from the two stops that are
 * not stalls. One waits for the operator on purpose, and `wait` marks it with
 * `pending_decision`. The other waits for work the conductor handed to a background
 * subagent or shell, which reports back into the session on its own; `dispatch`
 * records it in `in_flight` and sets the lease state `dispatched` (ADR-0032).
 *
 *   .orchestrator/runs/ACTIVE                     one line, the active run; absent means none
 *   .orchestrator/runs/<run>/lease.json           state, heartbeat, conductor, and the hooks' block counter
 *   .orchestrator/runs/<run>/NEXT                 the step label, then optional free text
 *   .orchestrator/runs/<run>/pending_decision     `<ISO-8601 UTC> <reason>`: waiting on purpose
 *   .orchestrator/runs/<run>/in_flight            `<ISO-8601 UTC> <what>`, one line per dispatch since the step began
 *   .orchestrator/runs/<run>/decisions.jsonl      operator answers keyed by FR, gap, AC or requirement id
 *   .orchestrator/runs/<run>/budget-raises.jsonl  approved in-session raises of the six execution budgets
 *
 * `<run>` is the folder name Step 0a mints for `plans/<run>/`. None of this is
 * tracked — bootstrap's `.orchestrator/.gitignore` is an allow-list — and none of it
 * needs to be: it describes one run on one machine.
 *
 * ACTIVE is the only pointer. The hook, the plugin, `status` and `watch` follow it
 * and nothing else, so a run it does not name is invisible to all four. The project
 * root is the directory that holds `.orchestrator/` when this script runs from there,
 * as it does once bootstrap materializes it, which is how its sibling scripts resolve
 * theirs; run from anywhere else, it is `git rev-parse --show-toplevel`, else the cwd.
 * `--root` overrides all three.
 *
 * The lease names its conductor. `start` and `next` record the session they run in as
 * `conductor_session`: ORCHESTRATOR_SESSION_ID, which the opencode plugin sets, else
 * CLAUDE_CODE_SESSION_ID, which Claude Code sets for every command. While the run is
 * live, a write from another known session exits 5 and changes nothing, unless a
 * `start` or `next` moves the run with `--take-over`; a second session resumed beside
 * the first no longer writes over it. A subagent's commands carry its session's id, so
 * this separates sessions, not a conductor from its own subagents. With no id on either
 * side — a plain terminal, an older host — nothing is checked.
 *
 * The Stop hook takes ownership from `conductor_session` when the lease names one. For
 * a lease that names none, it falls back to evidence: this script's name followed by
 * `start <run>` or `next <run>`, run by a session itself. So one rule about output
 * stands: nothing here prints that command with a real run name. The hook reads only
 * the session's own tool calls, never their output, but a refusal or a status line that
 * printed the command would still be one host format change away from handing the run
 * to whichever session read it. Free text a conductor wrote — a NEXT note, a label — is
 * its own and is printed as written.
 *
 * The commands, their arguments and the exit codes are in USAGE below.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const LABEL = 'run-state';

const HOSTS = ['claude-code', 'opencode', 'prime', 'unknown'];

/** The label `start` writes to NEXT. Everything after it is the conductor's to name. */
const FIRST_STEP = 'Step 0 — preflight';

/**
 * The six execution budgets a recorded operator approval may raise mid-run
 * (ADR-0027). Everything else stays anchored at the merge-base and is refused here by
 * omission — `max_eval_cycles`, `max_spec_requirements`, `rigor`, `parallelism` and
 * `max_parallel_lanes` among them. A raise only ever raises; lowering a budget still
 * takes a PR.
 */
const RAISABLE = [
  'max_contract_amendments',
  'max_review_cycles',
  'max_family_cycles',
  'max_qa_cycles',
  'max_run_minutes',
  'gate_wall_clock_minutes',
];

/** A lease heartbeated within this window belongs to a live run; an older one was abandoned. */
const LIVE_MS = 12 * 60 * 60 * 1000;

/** The states of a run still under way. Only these hold the project, or fence a write by another session. */
const LIVE_STATES = ['active', 'dispatched', 'waiting'];

/**
 * Lease v2: the v1 keys, then the four v2 adds. A v1 lease — written before v2, or by a
 * project copy of this script bootstrap has not refreshed yet — reads with these
 * defaults, and every write leaves the v2 shape.
 */
const V1_KEYS = ['run', 'run_dir', 'host', 'session_id', 'state', 'started_at', 'heartbeat_at', 'blocks', 'last_block_next', 'version'];

const POLL_MS = 60 * 1000;

/** `watch`'s defaults, in minutes: no activity at all, and in-flight work whose session has no transcript to read. */
const IDLE_MINUTES = 30;
const INFLIGHT_MINUTES = 180;

/** How long `watch` lets a notifier run before it gives up on it and carries on. */
const NOTIFY_TIMEOUT_MS = 10 * 1000;

/**
 * The default notifier on darwin. The message travels as `item 1 of argv` and is
 * never spliced into the AppleScript source: it carries a NEXT label, which is free
 * text, and a quote in it would otherwise end the string and run whatever followed.
 */
const OSASCRIPT = [
  'osascript',
  '-e', 'on run argv',
  '-e', 'display notification (item 1 of argv) with title "orchestrator"',
  '-e', 'end run',
];

const EXIT_NOT_CONDUCTOR = 5;
const EXIT_USAGE = 64;

const USAGE = `usage: node .orchestrator/run-state.cjs <command> [arguments] [--root <dir>]

  start <run> [--host ${HOSTS.join('|')}] [--force] [--take-over]
      Create the run, point ACTIVE at it and set NEXT to "${FIRST_STEP}". Exit 3,
      naming the holder, when ACTIVE names another run that is active, dispatched or
      waiting and was heartbeated within 12 h; --force starts anyway.
  next <run> "<label>" [--note "<text>"] [--take-over]
      Overwrite NEXT, set the run active, and remove pending_decision and in_flight.
      Reset blocks when the step changes or the run resumes from waiting or done.
  dispatch <run> "<what>"
      Record work handed to a background subagent or shell: append it to in_flight and
      set the run dispatched (a run waiting for the operator stays waiting). The block
      count is left as it is.
  wait <run> "<reason>"
      Write pending_decision and set the run waiting: this stop waits for the operator.
  done <run>
      Set the run done, remove NEXT, pending_decision and in_flight, and remove ACTIVE
      if it names this run. From another session, only once the run has a FINAL.
  status [--json]
      The active run: state, conductor, NEXT, pending_decision, in_flight, idle minutes,
      FINAL. Exit 1 when none.
  decide <run> <id> [--spec <spec-id>] --question "<q>" --answer "<a>" [--by human|default] [--host <h>]
      Record an answer, or an applied default, against an FR, gap, AC or requirement id.
  lookup <run> <id> [--spec <spec-id>] [--all]
      The latest decision for <id>, as JSON. --all, which needs --spec, also searches
      every other run, for decisions recorded against the same spec. Exit 1 when none.
  raise <run> <key> <to> --from <n> --approval "<the operator's answer, verbatim>"
      Raise one of the six execution budgets: ${RAISABLE.slice(0, 3).join(', ')},
      ${RAISABLE.slice(3).join(', ')}. Exit 2, recording nothing, unless
      from >= 1, to > from, from is not below a raise already recorded for the key,
      and the approval is non-empty.
  budget <run> <key>
      The highest raise recorded for <key>. Exit 1 when none.
  raises <run>
      One line per raise, for the FINAL.
  watch [--idle-minutes ${IDLE_MINUTES}] [--inflight-minutes ${INFLIGHT_MINUTES}] [--once] [--notify "<command>"]
      Poll every 60 s and notify once per episode: a conductor turn that ended on an API
      error; a pending decision; dispatched work with no activity for --idle-minutes
      (its session's transcripts and the heartbeat; with no transcript to read, the
      heartbeat alone, after --inflight-minutes); an active run with no FINAL and no
      pending decision idle for --idle-minutes. The message is the notifier's last
      argument; the default is a macOS notification, elsewhere a terminal bell. --once
      checks once: exit 4 if it notified, else 0.

  start and next record this session as the run's conductor (ORCHESTRATOR_SESSION_ID,
  else CLAUDE_CODE_SESSION_ID). On a live run, a write from another known session exits
  5 and writes nothing; --take-over lets start or next move the run to this session.

exit: 0 ok, 1 nothing found or a failure, 2 raise refused, 3 another run active,
      4 watch notified, 5 not the run's conductor, 64 usage`;

/**
 * Each command's positionals, all required, and the flags it accepts beyond `--root`.
 * An argument a command does not take is a usage error rather than something to
 * ignore: an unquoted label arrives as several words, and recording the first of them
 * as the step would be worse than refusing.
 */
const COMMANDS = {
  start: { args: ['run'], flags: ['--host', '--force', '--take-over'], fn: cmdStart },
  next: { args: ['run', 'label'], flags: ['--note', '--take-over'], fn: cmdNext },
  dispatch: { args: ['run', 'what'], flags: [], fn: cmdDispatch },
  wait: { args: ['run', 'reason'], flags: [], fn: cmdWait },
  done: { args: ['run'], flags: [], fn: cmdDone },
  status: { args: [], flags: ['--json'], fn: cmdStatus },
  decide: { args: ['run', 'id'], flags: ['--spec', '--question', '--answer', '--by', '--host'], fn: cmdDecide },
  lookup: { args: ['run', 'id'], flags: ['--spec', '--all'], fn: cmdLookup },
  raise: { args: ['run', 'key', 'to'], flags: ['--from', '--approval'], fn: cmdRaise },
  budget: { args: ['run', 'key'], flags: [], fn: cmdBudget },
  raises: { args: ['run'], flags: [], fn: cmdRaises },
  watch: { args: [], flags: ['--idle-minutes', '--inflight-minutes', '--once', '--notify'], fn: cmdWatch },
};

const VALUE_FLAGS = new Set([
  '--root', '--host', '--note', '--spec', '--question', '--answer', '--by', '--from', '--approval', '--idle-minutes',
  '--inflight-minutes', '--notify',
]);
// The Stop hook keeps its own copy of this set, so that `next --take-over <run>` does not hide the run from it.
const BOOLEAN_FLAGS = new Set(['--force', '--json', '--all', '--once', '--take-over']);

/** Code-unit ordering, as in the sibling scripts — never `localeCompare`, whose answer depends on the machine. */
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** UTC to the second, the shape the artifacts' own timestamps use. */
const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * UTC to the millisecond, for an `in_flight` line: the Stop hook compares it with the
 * block it recorded moments earlier, and a second is too coarse to order the two.
 */
const isoMs = () => new Date().toISOString();

/** `HH:MMZ`, the time of day a notification names. */
const clock = (ms) => (Number.isFinite(ms) ? `${new Date(ms).toISOString().slice(11, 16)}Z` : 'an unknown time');

/** Collapse every run of whitespace, newlines included, so a one-line file stays one line. */
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

/** A session id as a message shows it: its first eight characters. */
const short = (id) => String(id).slice(0, 8);

/** The session this command runs in: the opencode plugin's id, else Claude Code's, else null. */
const sessionNow = () => process.env.ORCHESTRATOR_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || null;

/** A non-negative integer in plain digits, or null: `-1`, `+4`, `2.0` and `1e3` are all null. */
function wholeNumber(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function usage(message) {
  if (message) console.error(`${LABEL}: ${message}`);
  console.error(USAGE);
  process.exit(EXIT_USAGE);
}

function die(message) {
  console.error(`${LABEL}: ${message}`);
  process.exit(1);
}

/**
 * `<run>` becomes a path component under `.orchestrator/runs/`, so it is checked
 * before it touches the filesystem: `[A-Za-z0-9._-]` leaves no room for a separator,
 * and an alphanumeric first character rules out `.`, `..` and a dotfile. The cap of 64
 * is the Stop hook's own, so a run this script starts is never one the hook ignores;
 * a minted run folder is at most 62 characters and always passes. `ACTIVE` is refused
 * in any case, because the pointer file already holds that name and a
 * case-insensitive filesystem — macOS by default — would let `active` collide with it.
 */
function runProblem(run) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(run)) {
    return `invalid run name ${JSON.stringify(run)}: ` +
      'expected 1 to 64 letters, digits, ".", "_" or "-", starting with a letter or digit';
  }
  if (run.toUpperCase() === 'ACTIVE') {
    return `invalid run name ${JSON.stringify(run)}: .orchestrator/runs/ACTIVE is the pointer file`;
  }
  return null;
}

/**
 * The project root: `--root` when given; else, for the materialized copy in
 * `.orchestrator/`, the directory that holds it; else the git top level, else the cwd.
 * The materialized rule is the one the sibling scripts use, and the one that keeps the
 * run state beside `plans/` when `.orchestrator/` is not at the top of the repository —
 * a package in a monorepo — where the git top level would put it beside neither. `git`
 * runs shell-free, and a missing binary or a cwd outside any repository both fall
 * through to the cwd.
 */
function resolveRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  if (path.basename(__dirname) === '.orchestrator') return path.dirname(__dirname);
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (top) return top;
  } catch {
    /* not a repository, or no git: the cwd is the root */
  }
  return process.cwd();
}

function paths(root, run) {
  const dir = path.join(root, '.orchestrator', 'runs', run);
  return {
    dir,
    lease: path.join(dir, 'lease.json'),
    next: path.join(dir, 'NEXT'),
    pending: path.join(dir, 'pending_decision'),
    inFlight: path.join(dir, 'in_flight'),
    decisions: path.join(dir, 'decisions.jsonl'),
    raises: path.join(dir, 'budget-raises.jsonl'),
  };
}

const activePath = (root) => path.join(root, '.orchestrator', 'runs', 'ACTIVE');

/**
 * Every write lands whole or not at all: a temp file beside the target, then a rename
 * over it. The Stop hook reads these files while the conductor writes them, and a
 * torn `lease.json` reads as no run at all, which fails the watchdog open exactly
 * when it is needed. The temp file is removed if the rename fails.
 */
function writeAtomic(file, data) {
  const suffix = `${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${suffix}`);
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* nothing to clean up */
    }
    throw e;
  }
}

/** The file's text, or null when it is absent. Any other failure is real and propagates. */
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}

/**
 * Every JSON object in a `.jsonl` file, in order. A line that does not parse to an
 * object is skipped rather than fatal: one hand-edited line must not hide every
 * decision recorded after it.
 */
function readJsonl(file) {
  const text = readText(file);
  if (!text) return [];
  const records = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (value && typeof value === 'object' && !Array.isArray(value)) records.push(value);
    } catch {
      /* skipped, as above */
    }
  }
  return records;
}

/** Append one line by rewriting the file through `writeAtomic`, so no reader ever sees half a line. */
function appendLine(file, line) {
  const text = readText(file) || '';
  writeAtomic(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`);
}

const appendJsonl = (file, record) => appendLine(file, JSON.stringify(record));

/**
 * The run's lease, or null when it has none. A lease that exists but is not a JSON
 * object throws: to a writer that is worth stopping for, while the readers that must
 * fail open — `status`, `watch`, the refusal check in `start` — catch it and treat
 * the run as unprovable.
 */
function loadLease(root, run) {
  const file = paths(root, run).lease;
  const text = readText(file);
  if (text === null) return null;
  let lease = null;
  try {
    lease = JSON.parse(text);
  } catch {
    /* reported below */
  }
  if (!lease || typeof lease !== 'object' || Array.isArray(lease)) {
    throw new Error(`${path.relative(root, file)} is not a JSON object`);
  }
  return lease;
}

/** The session the lease names as the run's conductor, or null: a v1 lease, or one started with no session id. */
const conductorOf = (lease) =>
  (typeof lease?.conductor_session === 'string' && lease.conductor_session ? lease.conductor_session : null);

/**
 * The lease in the v2 shape: the v1 keys it has, `version: 2`, the four v2 keys — its
 * own values, else their defaults — and then anything else it carries, such as the
 * Stop hook's `last_block_at`, in its own order.
 */
function leaseV2(lease) {
  const out = {};
  for (const key of V1_KEYS) if (Object.hasOwn(lease, key)) out[key] = lease[key];
  out.version = 2;
  out.conductor_session = conductorOf(lease);
  out.dispatched_at = lease.dispatched_at ?? null;
  out.takeovers = Array.isArray(lease.takeovers) ? lease.takeovers : [];
  out.stop_failure = lease.stop_failure ?? null;
  for (const [key, value] of Object.entries(lease)) if (!Object.hasOwn(out, key)) out[key] = value;
  return out;
}

function saveLease(root, run, lease) {
  writeAtomic(paths(root, run).lease, JSON.stringify(leaseV2(lease), null, 2) + '\n');
}

/**
 * The lease a write command updates. A run with no lease was never started here, and
 * the likeliest cause is a mistyped run name, so this stops instead of creating one:
 * a second lease would split one run's state across two directories.
 */
function requireLease(root, run) {
  const lease = loadLease(root, run);
  if (!lease) {
    die(`no lease for run ${run} (.orchestrator/runs/${run}/lease.json): ` +
      'it was never started in this project; start it first');
  }
  return lease;
}

/**
 * Merge `fields` into the run's lease and bump `heartbeat_at`, the last step of every
 * write command. It re-reads the lease instead of reusing an earlier copy, because the
 * Stop hook writes `blocks`, `session_id` and `stop_failure` into the same file
 * between turns. A write is the conductor at work again, so it clears `stop_failure`,
 * the turn that ended on an API error.
 */
function touch(root, run, fields) {
  saveLease(root, run, { ...requireLease(root, run), stop_failure: null, ...fields, heartbeat_at: isoNow() });
}

/** The run ACTIVE names, or null when there is none or the file does not hold a valid run name. */
function activeRun(root) {
  const text = readText(activePath(root));
  if (text === null) return null;
  const run = text.split('\n')[0].trim();
  return run && !runProblem(run) ? run : null;
}

/** Whether a lease belongs to a run still under way: active, dispatched or waiting, heartbeated within 12 h. */
function isLive(lease, now = Date.now()) {
  if (!lease || !LIVE_STATES.includes(lease.state)) return false;
  const beat = Date.parse(lease.heartbeat_at);
  return Number.isFinite(beat) && now - beat < LIVE_MS;
}

/** The lease of a run that is still alive, or null. An unreadable lease is no proof of life, so it is null too. */
function liveLease(root, run, now) {
  let lease;
  try {
    lease = loadLease(root, run);
  } catch {
    return null;
  }
  return isLive(lease, now) ? lease : null;
}

/**
 * The conductor that fences this session out of the run, or null when nothing does.
 * Only a live run is fenced — a done or abandoned run has nobody left to protect — and
 * only when both sessions are known and differ.
 */
function foreignConductor(lease) {
  const conductor = conductorOf(lease);
  const self = sessionNow();
  if (!conductor || !self || conductor === self || !isLive(lease)) return null;
  return conductor;
}

/**
 * The refusal of a write from a session that does not conduct the run: exit 5, nothing
 * written, nothing on stdout. It names how to take the run over, as a `next` with the
 * flag last and no script name, so the line is never ownership evidence.
 */
function refuseForeign(root, run, lease, conductor) {
  const { label } = readNext(root, run);
  const step = label ? `'${label.replace(/'/g, "'\\''")}'` : "'<its NEXT label>'";
  console.error(
    `${LABEL}: ${run} is conducted by session ${short(conductor)} (state ${lease.state}, last write ${lease.heartbeat_at}); ` +
      `this session (${short(sessionNow())}) is not its conductor, so nothing was written. ` +
      `Stop unless the operator asked this session to take the run over; then move it here: next ${run} ${step} --take-over`,
  );
  return EXIT_NOT_CONDUCTOR;
}

/** Refuse a write from a session that does not conduct the run: the exit code, or null to go on. */
function fenced(root, run, lease) {
  const conductor = foreignConductor(lease);
  return conductor ? refuseForeign(root, run, lease, conductor) : null;
}

/**
 * Who conducts the run after a `start` or `next` from this session: `{ conductor,
 * takeovers }`, or `{ refused }` with the exit code. Another session's live run moves
 * here only with `--take-over`, which logs `{from, to, at}` and says so on stderr. A
 * `--take-over` that moves nothing records nothing, and `--force` never implies it.
 */
function claim(root, run, prior, flags) {
  const self = sessionNow();
  const takeovers = Array.isArray(prior?.takeovers) ? [...prior.takeovers] : [];
  const holder = prior ? foreignConductor(prior) : null;
  if (holder) {
    if (!flags['--take-over']) return { refused: refuseForeign(root, run, prior, holder) };
    takeovers.push({ from: holder, to: self, at: isoNow() });
    console.error(`${LABEL}: warning: took ${run} over from session ${short(holder)}; this session (${short(self)}) conducts it now`);
  }
  return { conductor: self ?? conductorOf(prior), takeovers };
}

/** Every run directory under `.orchestrator/runs/`, in code-unit order. A name that is not a valid run is skipped. */
function listRuns(root) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, '.orchestrator', 'runs'), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isDirectory() && !runProblem(e.name)).map((e) => e.name).sort(byKey);
}

function readNext(root, run) {
  const text = readText(paths(root, run).next);
  if (text === null) return { label: null, note: null };
  const [first, ...rest] = text.replace(/\r/g, '').split('\n');
  const note = rest.join('\n').replace(/\s+$/, '');
  return { label: first || null, note: note || null };
}

/** The lines of `in_flight`, oldest first, as `{ line, at, what }`; `at` is NaN for a line with no timestamp. */
function readInFlight(root, run) {
  const text = readText(paths(root, run).inFlight);
  if (text === null) return [];
  return text.split('\n').filter((line) => line.trim()).map((line) => {
    const m = /^(\S+)\s+(.*)$/.exec(line.trim());
    return m ? { line: line.trim(), at: Date.parse(m[1]), what: m[2] } : { line: line.trim(), at: NaN, what: line.trim() };
  });
}

/** The newest `plans/<run>/FINAL-*.md`, repo-relative, or null. Its presence is what says a run finished. */
function finalOf(root, run) {
  let names;
  try {
    names = fs.readdirSync(path.join(root, 'plans', run));
  } catch {
    return null;
  }
  const finals = names.filter((n) => /^FINAL-.*\.md$/.test(n)).sort(byKey);
  return finals.length ? `plans/${run}/${finals[finals.length - 1]}` : null;
}

/**
 * Everything the files say about one run. A missing or unreadable lease leaves `lease`
 * null instead of throwing, because `status` and `watch` must fail open.
 */
function readRun(root, run) {
  let lease = null;
  try {
    lease = loadLease(root, run);
  } catch {
    lease = null;
  }
  const pending = readText(paths(root, run).pending);
  return {
    run,
    lease,
    ...readNext(root, run),
    pending: pending === null ? null : oneLine(pending),
    flight: readInFlight(root, run),
    final: finalOf(root, run),
  };
}

/** What `status` says about whoever conducts the run, from this session's point of view. */
function conductorLine(lease) {
  const conductor = conductorOf(lease);
  if (!conductor) return 'none';
  const self = sessionNow();
  if (!self) return `${short(conductor)} (this session's id is unknown)`;
  if (conductor === self) return `${short(conductor)} (this session)`;
  return isLive(lease)
    ? `${short(conductor)} (another session: a write needs --take-over)`
    : `${short(conductor)} (another session; the run is not live, so a write needs no --take-over)`;
}

/** The active run as `status` prints it, or null when ACTIVE names none. */
function snapshot(root, now) {
  const run = activeRun(root);
  if (!run) return null;
  const r = readRun(root, run);
  const beat = Date.parse(r.lease?.heartbeat_at);
  const conductor = conductorOf(r.lease);
  const self = sessionNow();
  return {
    run,
    run_dir: `plans/${run}`,
    host: r.lease?.host ?? null,
    state: r.lease?.state ?? null,
    next: r.label,
    note: r.note,
    pending_decision: r.pending,
    heartbeat_at: r.lease?.heartbeat_at ?? null,
    idle_minutes: Number.isFinite(beat) ? Math.max(0, Math.floor((now - beat) / 60000)) : null,
    final: r.final,
    in_flight: r.flight.length ? r.flight.map((f) => f.line) : null,
    dispatched_at: r.lease?.dispatched_at ?? null,
    conductor_session: conductor,
    this_session_conducts: self === null ? null : conductor === self,
    conductor_line: conductorLine(r.lease),
    stop_failure: r.lease?.stop_failure ?? null,
  };
}

/**
 * A run ACTIVE does not name is one the watchdog and `status` cannot see: a run
 * superseded by `start --force`, or one already marked done. Say so, instead of
 * letting the conductor believe the watchdog has it covered.
 */
function warnUnfollowed(root, run) {
  const active = activeRun(root);
  if (active === run) return;
  const pointer = active ? `ACTIVE names ${active}` : 'no run is ACTIVE';
  console.error(`${LABEL}: warning: ${pointer}, so the watchdog does not follow ${run}`);
}

/**
 * Point an absent ACTIVE back at a run that is going on after `done` released it: a
 * stop after the FINAL that waits for the operator, or a step that follows one. Left
 * absent, `status` finds no run and `watch` never announces the wait. ACTIVE that
 * names any other run is left alone; `warnUnfollowed` says so.
 */
function reclaimActive(root, run) {
  if (readText(activePath(root)) === null) writeAtomic(activePath(root), `${run}\n`);
}

function hostOf(flags) {
  const host = flags['--host'];
  if (host !== undefined && !HOSTS.includes(host)) usage(`--host must be one of ${HOSTS.join(', ')}`);
  return host ?? null;
}

function cmdStart(root, [run], flags) {
  const host = hostOf(flags);
  const active = activeRun(root);
  if (active && active !== run && !flags['--force']) {
    const live = liveLease(root, active, Date.now());
    if (live) {
      // Dispatched work reports back into the holder's session; superseding the run would orphan it.
      const end = live.state === 'dispatched' ? '; work in flight: ask the operator before superseding it' : '.';
      console.error(
        `${LABEL}: another run is active: ${active} (state ${live.state}, last heartbeat ${live.heartbeat_at}). ` +
          `Finish it with done, or pass --force to start ${run} anyway${end}`,
      );
      return 3;
    }
  }
  const p = paths(root, run);
  // Starting a run twice is harmless: the second start keeps when the run began, who
  // last conducted it and every takeover. An unreadable earlier lease is replaced, not
  // preserved.
  let prior = null;
  try {
    prior = loadLease(root, run);
  } catch {
    prior = null;
  }
  const claimed = claim(root, run, prior, flags);
  if (claimed.refused !== undefined) return claimed.refused;
  fs.mkdirSync(p.dir, { recursive: true });
  const now = isoNow();
  saveLease(root, run, {
    run,
    run_dir: `plans/${run}`,
    host: host ?? prior?.host ?? 'unknown',
    session_id: prior?.session_id ?? null,
    state: 'active',
    started_at: prior?.started_at ?? now,
    heartbeat_at: now,
    blocks: 0,
    last_block_next: null,
    version: 2,
    conductor_session: claimed.conductor,
    dispatched_at: null,
    takeovers: claimed.takeovers,
    stop_failure: null,
  });
  writeAtomic(p.next, `${FIRST_STEP}\n`);
  fs.rmSync(p.pending, { force: true });
  fs.rmSync(p.inFlight, { force: true });
  // ACTIVE last: the hook sees the run only once everything it reads is in place.
  writeAtomic(activePath(root), `${run}\n`);
  const superseded = active && active !== run ? `; ACTIVE named ${active}, which the watchdog no longer follows` : '';
  console.log(`${LABEL}: started ${run}${superseded}`);
  return 0;
}

function cmdNext(root, [run, label], flags) {
  const step = oneLine(label);
  if (!step) usage('next needs a non-empty step label');
  const lease = requireLease(root, run);
  const claimed = claim(root, run, lease, flags);
  if (claimed.refused !== undefined) return claimed.refused;
  const p = paths(root, run);
  // Re-recording the step a run is already at is not progress, whether it was active
  // or dispatched there. Resetting `blocks` then would let a conductor that re-runs
  // `next` on every re-prompt, or dispatches, is blocked and re-runs `next`, slip the
  // watchdog's three-block guard forever; a new step, or a resume from `waiting` or
  // `done`, starts the count over.
  const moved = !['active', 'dispatched'].includes(lease.state) || readNext(root, run).label !== step;
  const note = (flags['--note'] ?? '').replace(/^\n+|\s+$/g, '');
  writeAtomic(p.next, `${step}\n${note ? `${note}\n` : ''}`);
  fs.rmSync(p.pending, { force: true });
  fs.rmSync(p.inFlight, { force: true });
  touch(root, run, {
    state: 'active',
    ...(moved ? { blocks: 0 } : {}),
    dispatched_at: null,
    conductor_session: claimed.conductor,
    takeovers: claimed.takeovers,
  });
  reclaimActive(root, run);
  warnUnfollowed(root, run);
  console.log(`${LABEL}: ${run} NEXT: ${step}`);
  return 0;
}

function cmdDispatch(root, [run, what]) {
  const line = oneLine(what);
  if (!line) usage('dispatch needs a non-empty <what>');
  const lease = requireLease(root, run);
  const refused = fenced(root, run, lease);
  if (refused !== null) return refused;
  const p = paths(root, run);
  // in_flight before the lease, so a hook that reads `dispatched` finds what is in flight.
  appendLine(p.inFlight, `${isoMs()} ${line}`);
  // A dispatch never resets `blocks`: a declaration must not buy the guard back.
  const waiting = readText(p.pending) !== null;
  touch(root, run, { state: waiting ? 'waiting' : 'dispatched', dispatched_at: lease.dispatched_at ?? isoNow() });
  reclaimActive(root, run);
  warnUnfollowed(root, run);
  console.log(`${LABEL}: ${run} in flight: ${line}`);
  return 0;
}

function cmdWait(root, [run, reason]) {
  const line = oneLine(reason);
  if (!line) usage('wait needs a non-empty reason');
  const lease = requireLease(root, run);
  const refused = fenced(root, run, lease);
  if (refused !== null) return refused;
  // pending_decision before the state: the hook refuses to block the moment the file
  // exists, whether or not the lease has caught up. in_flight stays: the work it names
  // is still running while the operator answers.
  writeAtomic(paths(root, run).pending, `${isoNow()} ${line}\n`);
  touch(root, run, { state: 'waiting' });
  reclaimActive(root, run);
  warnUnfollowed(root, run);
  console.log(`${LABEL}: ${run} is waiting for the operator: ${line}`);
  return 0;
}

/**
 * `done` clears the run's resume state — NEXT, `pending_decision` and `in_flight` — so
 * nothing stale reads as a step to resume or a question to answer, and touches no other
 * file: the run folder also keeps decisions, raises and evidence such as `barrier/`.
 * Closing a run that has its FINAL is safe from any session; before that, only its
 * conductor closes it.
 */
function cmdDone(root, [run]) {
  const lease = requireLease(root, run);
  const refused = finalOf(root, run) ? null : fenced(root, run, lease);
  if (refused !== null) return refused;
  const p = paths(root, run);
  // The state first: a hook reading between the two writes sees a done run, never an active one with no NEXT.
  touch(root, run, { state: 'done', stop_failure: null });
  for (const file of [p.next, p.pending, p.inFlight]) fs.rmSync(file, { force: true });
  if (activeRun(root) === run) fs.rmSync(activePath(root), { force: true });
  console.log(`${LABEL}: ${run} done`);
  return 0;
}

function cmdStatus(root, _args, flags) {
  const s = snapshot(root, Date.now());
  if (!s) {
    console.error(`${LABEL}: no active run`);
    return 1;
  }
  const { conductor_line: conductorText, ...json } = s;
  if (flags['--json']) {
    console.log(JSON.stringify(json));
    return 0;
  }
  const failure = s.stop_failure;
  const lines = [
    `run: ${s.run}`,
    `run_dir: ${s.run_dir}`,
    `host: ${s.host ?? 'unknown'}`,
    `state: ${s.state ?? 'unknown (the lease is missing or unreadable)'}`,
    `conductor: ${conductorText}`,
    `next: ${s.next ?? 'none'}`,
    ...(s.note ? s.note.split('\n').map((l) => `  ${l}`) : []),
    `pending_decision: ${s.pending_decision ?? 'none'}`,
    ...(s.in_flight ? ['in_flight:', ...s.in_flight.map((l) => `  ${l}`)] : ['in_flight: none']),
    `idle_minutes: ${s.idle_minutes ?? 'unknown'}`,
    `final: ${s.final ?? 'none'}`,
    ...(failure ? [`stop_failure: ${failure.at} ${failure.error}${failure.details ? `: ${failure.details}` : ''}`] : []),
  ];
  console.log(lines.join('\n'));
  return 0;
}

/** `--spec`, trimmed, or null when it was not given. A blank one is a usage error. */
function specOf(flags) {
  if (flags['--spec'] === undefined) return null;
  const spec = oneLine(flags['--spec']);
  if (!spec) usage('--spec needs the spec id, e.g. SPEC-20260929T101500Z-a1b2');
  return spec;
}

function cmdDecide(root, [run, rawId], flags) {
  const id = rawId.trim();
  const question = flags['--question'];
  const answer = flags['--answer'];
  if (!id) usage('decide needs a non-empty <id>');
  if (!question?.trim()) usage('decide needs --question "<q>"');
  if (!answer?.trim()) usage('decide needs --answer "<a>"');
  const by = flags['--by'] ?? 'human';
  if (by !== 'human' && by !== 'default') usage('--by must be human or default');
  const host = hostOf(flags);
  const spec = specOf(flags);
  const lease = requireLease(root, run);
  const refused = fenced(root, run, lease);
  if (refused !== null) return refused;
  // Without --host the record carries the host the run was started on, the best
  // evidence there is of where the question was asked.
  appendJsonl(paths(root, run).decisions, {
    id, spec, question, answer, by, host: host ?? lease.host ?? 'unknown', at: isoNow(),
  });
  touch(root, run, {});
  console.log(`${LABEL}: decision ${id} recorded for ${run} (by ${by})`);
  return 0;
}

/**
 * The latest decision for an id, by its `at`. `--all` also reads every other run
 * under `.orchestrator/runs/`, which is what lets a run resumed on another host, or a
 * later run that reuses the spec, take an answer instead of asking again. Only a
 * decision recorded against the same `--spec` counts there: FR, AC and gap ids are the
 * numbered items of one spec, so another spec's FR-3 is a different question that
 * happens to share a name, and reusing its answer would be silent and wrong. That is
 * why `--all` refuses to run without `--spec`. The named run is read last, so on a
 * timestamp tie its own decision wins. The printed object adds `run`, the run it was
 * recorded in.
 */
function cmdLookup(root, [run, rawId], flags) {
  const id = rawId.trim();
  if (!id) usage('lookup needs a non-empty <id>');
  const spec = specOf(flags);
  if (flags['--all'] && !spec) usage('lookup --all needs --spec <spec-id>: ids are numbered per spec');
  const runs = flags['--all'] ? [...listRuns(root).filter((r) => r !== run), run] : [run];
  let best = null;
  let bestAt = -Infinity;
  for (const r of runs) {
    for (const decision of readJsonl(paths(root, r).decisions)) {
      if (decision.id !== id) continue;
      // In another run the spec must match; in this one, only a spec recorded otherwise rules a decision out.
      if (r === run ? spec && decision.spec && decision.spec !== spec : decision.spec !== spec) continue;
      const parsed = Date.parse(decision.at);
      const at = Number.isFinite(parsed) ? parsed : -Infinity;
      if (!best || at >= bestAt) {
        best = { ...decision, run: r };
        bestAt = at;
      }
    }
  }
  if (!best) {
    console.error(`${LABEL}: no decision recorded for ${id} ${flags['--all'] ? `in any run for ${spec}` : `in ${run}`}`);
    return 1;
  }
  console.log(JSON.stringify(best));
  return 0;
}

function cmdRaise(root, [run, key, rawTo], flags) {
  const refuse = (why) => {
    console.error(`${LABEL}: raise refused: ${why}`);
    return 2;
  };
  if (!RAISABLE.includes(key)) {
    return refuse(`${key} is not one of the six execution budgets (${RAISABLE.join(', ')}); ` +
      'everything else stays merge-base anchored');
  }
  const from = wholeNumber(flags['--from']);
  const to = wholeNumber(rawTo);
  if (from === null) return refuse('--from <n> must be the cap in force, as a whole number');
  if (from === 0) return refuse(`--from 0 means ${key} is unbounded or disabled: there is no cap to raise`);
  if (to === null) return refuse(`<to> must be a whole number, not ${JSON.stringify(rawTo)}`);
  if (to === from) return refuse(`${key} is already ${from}`);
  if (to < from) return refuse(`${from}→${to} would lower ${key}, and lowering a budget takes a PR`);
  const approval = flags['--approval'];
  if (!approval?.trim()) return refuse('--approval "<the operator\'s answer, verbatim>" is required');
  // A `--from` below an earlier raise names a cap no longer in force: the operator was
  // shown the wrong current value, and an approval of it would change nothing.
  const inForce = highestRaise(root, run, key);
  if (inForce !== null && from < inForce) {
    return refuse(`${key} is already ${inForce}, raised earlier in this run; --from must be the cap in force, not ${from}`);
  }
  const lease = requireLease(root, run);
  const refused = fenced(root, run, lease);
  if (refused !== null) return refused;
  appendJsonl(paths(root, run).raises, { key, from, to, approval, at: isoNow() });
  touch(root, run, {});
  console.log(`BUDGET RAISED ${key} ${from}→${to}`);
  return 0;
}

const isRaise = (r) => typeof r.key === 'string' && Number.isSafeInteger(r.from) && Number.isSafeInteger(r.to);

/** The highest `to` recorded for `key` in the run, or null when it was never raised. */
function highestRaise(root, run, key) {
  const raised = readJsonl(paths(root, run).raises).filter((r) => isRaise(r) && r.key === key).map((r) => r.to);
  return raised.length ? Math.max(...raised) : null;
}

function cmdBudget(root, [run, key]) {
  const raised = highestRaise(root, run, key);
  if (raised === null) {
    const why = RAISABLE.includes(key) ? '' : ` (${key} is not one of the six execution budgets, so it is never raised)`;
    console.error(`${LABEL}: no raise recorded for ${key} in ${run}${why}`);
    return 1;
  }
  console.log(String(raised));
  return 0;
}

/**
 * The approval is JSON-quoted: it is the operator's words verbatim, and a quote or a
 * newline in them must not break the line.
 */
function cmdRaises(root, [run]) {
  for (const r of readJsonl(paths(root, run).raises).filter(isRaise)) {
    console.log(`${r.key} ${r.from}→${r.to} (approved: ${JSON.stringify(String(r.approval ?? ''))})`);
  }
  return 0;
}

/**
 * `--notify` names a command line, split here into words the way a shell splits them —
 * whitespace separates, single quotes are literal, double quotes and a backslash escape
 * — and nothing else: no variables, no globs, no substitution, so nothing in it is ever
 * evaluated. Returns null for an unterminated quote. The Stop hook splits
 * ORCHESTRATOR_NOTIFY with a copy of this function.
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

/**
 * Deliver one notification. The message is always one argv element and never text in
 * a shell string, because it carries a run name and a NEXT label the conductor wrote.
 * Without `--notify` it is a macOS notification on darwin and a terminal bell
 * elsewhere, and a failed notifier falls back to the bell. The line on stdout is
 * printed either way, so the terminal the watcher runs in keeps a log of what it said.
 */
function sendNotification(command, message) {
  const argv = command ? [...command, message] : process.platform === 'darwin' ? [...OSASCRIPT, message] : null;
  let bell = argv === null;
  if (argv) {
    const r = spawnSync(argv[0], argv.slice(1), { stdio: ['ignore', 'inherit', 'inherit'], timeout: NOTIFY_TIMEOUT_MS });
    if (r.error || r.status !== 0) {
      bell = true;
      const why = r.error ? r.error.code || r.error.message : r.signal ? `killed by ${r.signal}` : `exit ${r.status}`;
      console.error(`${LABEL}: notifier ${argv[0]} failed (${why})`);
    }
  }
  process.stdout.write(`${bell ? '\x07' : ''}${LABEL}: ${isoNow()} ${message}\n`);
}

/**
 * The notification for a conductor turn that ended on an API error, which runs no Stop
 * hook. The StopFailure hook sends the same words the moment it happens; `watch` sends
 * them when nothing has written the run since.
 */
function stopFailureMessage(run, failure) {
  const details = failure.details ? `: ${failure.details}` : '';
  return `orchestrator run ${run}: the conductor's turn failed at ${clock(Date.parse(failure.at))} ` +
    `(${failure.error}${details}); continue the session once it clears`;
}

/** A session id safe to use as a file name: a Claude Code UUID, an opencode `ses_…`. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/**
 * When the run's Claude Code session last wrote anything, as an mtime in ms, or null
 * when no transcript of it can be found: the newest of `<projects>/*\/<sid>.jsonl` and
 * its subagents' `<sid>/subagents/*.jsonl`. A subagent writes its transcript as it
 * works, so a long but busy subagent reads as activity, and a hung one does not.
 */
function transcriptActivity(sid, configDir) {
  if (!sid || !SESSION_ID.test(sid)) return null;
  const projects = path.join(configDir, 'projects');
  let dirs;
  try {
    dirs = fs.readdirSync(projects, { withFileTypes: true });
  } catch {
    return null;
  }
  let newest = null;
  const consider = (file) => {
    try {
      const st = fs.statSync(file, { throwIfNoEntry: false });
      if (st && st.isFile() && (newest === null || st.mtimeMs > newest)) newest = st.mtimeMs;
    } catch {
      /* unreadable: no evidence either way */
    }
  };
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(projects, entry.name);
    consider(path.join(dir, `${sid}.jsonl`));
    let subagents = [];
    try {
      subagents = fs.readdirSync(path.join(dir, sid, 'subagents'));
    } catch {
      /* no subagents in this project */
    }
    for (const name of subagents) if (name.endsWith('.jsonl')) consider(path.join(dir, sid, 'subagents', name));
  }
  return newest;
}

/**
 * The run's last sign of life, in ms: the heartbeat, or a later write to its session's
 * transcripts. `probed` says whether a transcript was found; without one, the heartbeat
 * is all there is. Only a Claude Code session has transcripts to read.
 */
function lastActivity(lease, configDir) {
  const beat = Date.parse(lease?.heartbeat_at);
  const sid = conductorOf(lease) ?? (typeof lease?.session_id === 'string' ? lease.session_id : null);
  const transcripts = lease?.host === 'claude-code' || lease?.host === 'unknown' ? transcriptActivity(sid, configDir) : null;
  const at = Math.max(Number.isFinite(beat) ? beat : -Infinity, transcripts ?? -Infinity);
  return { at: Number.isFinite(at) ? at : null, probed: transcripts !== null };
}

/**
 * What the notifier would report right now: null, or `{ key, message }`, where `key`
 * names the episode. In order: a turn that ended on an API error since the last write;
 * a pending decision, keyed by its own line, so each new `wait` is announced once;
 * dispatched work with no activity; an active run with none. The last two are keyed by
 * the activity they went quiet at, so any progress starts a new episode.
 */
function watchFinding(root, options, now) {
  const run = activeRun(root);
  if (!run) return null;
  const r = readRun(root, run);
  const lease = r.lease;
  const failure = lease?.stop_failure;
  const failedAt = Date.parse(failure?.at);
  if (typeof failure?.error === 'string' && Number.isFinite(failedAt) && !(failedAt <= Date.parse(lease.heartbeat_at))) {
    return { key: `failed ${run} ${failure.at}`, message: stopFailureMessage(run, failure) };
  }
  const newest = r.flight.at(-1) ?? null;
  if (lease?.state === 'waiting') {
    const reason = (r.pending ?? '').replace(/^\d{4}-\d\d-\d\dT\S*\s*/, '');
    const inFlight = newest ? ` (in flight: ${newest.what})` : '';
    return {
      key: `waiting ${run} ${r.pending ?? lease.heartbeat_at}`,
      message: `orchestrator run ${run} is waiting for your decision${reason ? `: ${reason}` : ''}${inFlight}`,
    };
  }
  if ((lease?.state !== 'active' && lease?.state !== 'dispatched') || r.final || r.pending !== null) return null;
  const activity = lastActivity(lease, options.configDir);
  if (activity.at === null) return null;
  const idle = Math.max(0, Math.floor((now - activity.at) / 60000));
  if (lease.state === 'dispatched') {
    if (idle < (activity.probed ? options.idleMinutes : options.inflightMinutes)) return null;
    const since = newest && Number.isFinite(newest.at) ? newest.at : Date.parse(lease.dispatched_at ?? lease.heartbeat_at);
    return {
      key: `inflight ${run} ${activity.at}`,
      message: `orchestrator run ${run}: ${newest?.what ?? 'dispatched work'} in flight since ${clock(since)}, ` +
        `no activity for ${idle} min — check the subagent and the session`,
    };
  }
  if (idle < options.idleMinutes) return null;
  return {
    key: `idle ${run} ${activity.at}`,
    message: `orchestrator run ${run} has been idle ${idle} min at ${r.label ?? 'no NEXT'}`,
  };
}

/**
 * One poll of the notifier as a function of the clock, so the suite can drive it. It
 * remembers the last episode it announced: a run idle for three hours produces one
 * notification, not 180. That memory lives in the long-running process, so each
 * `--once` reports whatever it finds. `configDir` is where Claude Code keeps its
 * transcripts: CLAUDE_CONFIG_DIR, else `.claude` in the home directory.
 */
function watcher(root, idleMinutes, notify, { inflightMinutes = INFLIGHT_MINUTES, configDir } = {}) {
  const options = {
    idleMinutes,
    inflightMinutes,
    configDir: configDir ?? (process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')),
  };
  let announced = null;
  return (now) => {
    const finding = watchFinding(root, options, now);
    if (!finding || finding.key === announced) return false;
    announced = finding.key;
    notify(finding.message);
    return true;
  };
}

/** A `watch` threshold in whole minutes, 1 or more, or the default when the flag is absent. */
function minutesFlag(flags, name, fallback) {
  if (flags[name] === undefined) return fallback;
  const value = wholeNumber(flags[name]);
  if (value === null || value < 1) usage(`${name} must be a whole number of minutes, 1 or more`);
  return value;
}

function cmdWatch(root, _args, flags) {
  const idle = minutesFlag(flags, '--idle-minutes', IDLE_MINUTES);
  const inflight = minutesFlag(flags, '--inflight-minutes', INFLIGHT_MINUTES);
  let command = null;
  if (flags['--notify'] !== undefined) {
    command = splitCommand(flags['--notify']);
    if (!command || !command.length) usage('--notify needs a command, with any quotes closed');
  }
  const tick = watcher(root, idle, (message) => sendNotification(command, message), { inflightMinutes: inflight });
  if (flags['--once']) return tick(Date.now()) ? 4 : 0;
  console.log(
    `${LABEL}: watching ${root}, every ${POLL_MS / 1000} s, idle after ${idle} min, ` +
      `in-flight work with no transcript to read after ${inflight} min`,
  );
  const poll = () => {
    try {
      tick(Date.now());
    } catch (e) {
      // One bad poll (a file mid-edit, a permission flip) must not end the watch.
      console.error(`${LABEL}: ${e.message}`);
    }
  };
  poll();
  setInterval(poll, POLL_MS);
  return undefined;
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      flags[arg] = true;
    } else if (VALUE_FLAGS.has(arg)) {
      if (i + 1 >= argv.length) usage(`${arg} needs a value`);
      flags[arg] = argv[++i];
    } else {
      usage(`unknown option: ${arg}`);
    }
  }
  return { positionals, flags };
}

function main(argv) {
  const args = argv.slice(2);
  if (['help', '--help', '-h'].includes(args[0])) {
    console.log(USAGE);
    return 0;
  }
  const { positionals, flags } = parseArgs(args);
  const [name, ...rest] = positionals;
  const command = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
  if (!command) usage(name === undefined ? 'no command given' : `unknown command: ${JSON.stringify(name)}`);
  for (const flag of Object.keys(flags)) {
    if (flag !== '--root' && !command.flags.includes(flag)) usage(`${name} does not take ${flag}`);
  }
  if (rest.length < command.args.length) usage(`${name} needs <${command.args[rest.length]}>`);
  if (rest.length > command.args.length) usage(`${name}: unexpected argument ${JSON.stringify(rest[command.args.length])}`);
  if (command.args[0] === 'run') {
    const problem = runProblem(rest[0]);
    if (problem) usage(problem);
  }
  return command.fn(resolveRoot(flags['--root']), rest, flags);
}

module.exports = { RAISABLE, splitCommand, watcher, stopFailureMessage };

if (require.main === module) {
  try {
    const code = main(process.argv);
    if (typeof code === 'number') process.exitCode = code;
  } catch (e) {
    // A filesystem failure surfaces as `run-state: <what failed>` and exit 1, the way
    // the sibling scripts report one, rather than as a stack trace naming a syscall.
    die(e && e.message ? e.message : String(e));
  }
}
