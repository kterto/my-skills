#!/usr/bin/env node
/**
 * Run state for the orchestrator: where a run is, kept on disk where a new session
 * can find it. The conductor writes it at every step boundary, and three readers
 * depend on it — a conductor that lost its place to a compaction or a new session
 * (`status`), the Claude Code Stop hook and the opencode idle plugin that keep a run
 * from stalling between steps, and the operator's heartbeat notifier (`watch`).
 *
 * The stall it exists for is a turn that ends between steps: the conductor announces
 * the next step, the turn ends, and the run sits until a human looks — 3.9 h on one
 * run. A watchdog may push past that stop only if it can tell it from a stop that
 * waits for the operator on purpose, and `pending_decision` is how it tells.
 *
 *   .orchestrator/runs/ACTIVE                     one line, the active run; absent means none
 *   .orchestrator/runs/<run>/lease.json           state, heartbeat, and the hooks' block counter
 *   .orchestrator/runs/<run>/NEXT                 the step label, then optional free text
 *   .orchestrator/runs/<run>/pending_decision     `<ISO-8601 UTC> <reason>`: waiting on purpose
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
 * One rule about output backs up the watchdog: nothing here prints this script's name
 * followed by `start <run>` or `next <run>` with a real run name. The Stop hook takes
 * that command, run by a session itself, as evidence that the session conducts the
 * run. It reads only the session's own tool calls, never their output, but a refusal
 * or a status line that printed the command would still be one host format change
 * away from handing the run to whichever session read it. Free text a conductor
 * wrote — a NEXT note, a label — is its own and is printed as written.
 *
 * The commands, their arguments and the exit codes are in USAGE below.
 */
'use strict';
const fs = require('fs');
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

const POLL_MS = 60 * 1000;

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

const EXIT_USAGE = 64;

const USAGE = `usage: node .orchestrator/run-state.cjs <command> [arguments] [--root <dir>]

  start <run> [--host ${HOSTS.join('|')}] [--force]
      Create the run, point ACTIVE at it and set NEXT to "${FIRST_STEP}". Exit 3,
      naming the holder, when ACTIVE names another run that is active or waiting and
      was heartbeated within 12 h; --force starts anyway.
  next <run> "<label>" [--note "<text>"]
      Overwrite NEXT, set the run active and remove pending_decision. Reset blocks
      unless the run was already active at this same step.
  wait <run> "<reason>"
      Write pending_decision and set the run waiting: this stop is on purpose.
  done <run>
      Set the run done, and remove ACTIVE if it names this run.
  status [--json]
      The active run: state, NEXT, pending_decision, idle minutes, FINAL. Exit 1 when none.
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
  watch [--idle-minutes 30] [--once] [--notify "<command>"]
      Poll every 60 s. Notify once per idle episode of an active run with no FINAL and no
      pending decision, and once per pending decision. The message is the notifier's last
      argument; the default is a macOS notification, elsewhere a terminal bell. --once
      checks once: exit 4 if it notified, else 0.

exit: 0 ok, 1 nothing found or a failure, 2 raise refused, 3 another run active,
      4 watch notified, 64 usage`;

/**
 * Each command's positionals, all required, and the flags it accepts beyond `--root`.
 * An argument a command does not take is a usage error rather than something to
 * ignore: an unquoted label arrives as several words, and recording the first of them
 * as the step would be worse than refusing.
 */
const COMMANDS = {
  start: { args: ['run'], flags: ['--host', '--force'], fn: cmdStart },
  next: { args: ['run', 'label'], flags: ['--note'], fn: cmdNext },
  wait: { args: ['run', 'reason'], flags: [], fn: cmdWait },
  done: { args: ['run'], flags: [], fn: cmdDone },
  status: { args: [], flags: ['--json'], fn: cmdStatus },
  decide: { args: ['run', 'id'], flags: ['--spec', '--question', '--answer', '--by', '--host'], fn: cmdDecide },
  lookup: { args: ['run', 'id'], flags: ['--spec', '--all'], fn: cmdLookup },
  raise: { args: ['run', 'key', 'to'], flags: ['--from', '--approval'], fn: cmdRaise },
  budget: { args: ['run', 'key'], flags: [], fn: cmdBudget },
  raises: { args: ['run'], flags: [], fn: cmdRaises },
  watch: { args: [], flags: ['--idle-minutes', '--once', '--notify'], fn: cmdWatch },
};

const VALUE_FLAGS = new Set([
  '--root', '--host', '--note', '--spec', '--question', '--answer', '--by', '--from', '--approval', '--idle-minutes',
  '--notify',
]);
const BOOLEAN_FLAGS = new Set(['--force', '--json', '--all', '--once']);

/** Code-unit ordering, as in the sibling scripts — never `localeCompare`, whose answer depends on the machine. */
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** UTC to the second, the shape the artifacts' own timestamps use. */
const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Collapse every run of whitespace, newlines included, so a one-line file stays one line. */
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

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

/** Append one record by rewriting the file through `writeAtomic`, so no reader ever sees half a line. */
function appendJsonl(file, record) {
  const text = readText(file) || '';
  writeAtomic(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${JSON.stringify(record)}\n`);
}

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

function saveLease(root, run, lease) {
  writeAtomic(paths(root, run).lease, JSON.stringify(lease, null, 2) + '\n');
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
 * Stop hook writes `blocks` and `session_id` into the same file between turns.
 */
function touch(root, run, fields) {
  saveLease(root, run, { ...requireLease(root, run), ...fields, heartbeat_at: isoNow() });
}

/** The run ACTIVE names, or null when there is none or the file does not hold a valid run name. */
function activeRun(root) {
  const text = readText(activePath(root));
  if (text === null) return null;
  const run = text.split('\n')[0].trim();
  return run && !runProblem(run) ? run : null;
}

/**
 * The lease of a run that is still alive — `active` or `waiting`, heartbeated inside
 * 12 h — or null. An unreadable lease is no proof of life, so it is null too.
 */
function liveLease(root, run, now) {
  let lease;
  try {
    lease = loadLease(root, run);
  } catch {
    return null;
  }
  if (!lease || (lease.state !== 'active' && lease.state !== 'waiting')) return null;
  const beat = Date.parse(lease.heartbeat_at);
  return Number.isFinite(beat) && now - beat < LIVE_MS ? lease : null;
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
 * The active run as its files describe it, or null when ACTIVE names none. `status`
 * prints it and `watch` judges it. A missing or unreadable lease leaves `state` null
 * instead of throwing, because both readers must fail open.
 */
function snapshot(root, now) {
  const run = activeRun(root);
  if (!run) return null;
  let lease = null;
  try {
    lease = loadLease(root, run);
  } catch {
    lease = null;
  }
  const { label, note } = readNext(root, run);
  const pending = readText(paths(root, run).pending);
  const beat = Date.parse(lease?.heartbeat_at);
  return {
    run,
    run_dir: `plans/${run}`,
    host: lease?.host ?? null,
    state: lease?.state ?? null,
    next: label,
    note,
    pending_decision: pending === null ? null : oneLine(pending),
    heartbeat_at: lease?.heartbeat_at ?? null,
    idle_minutes: Number.isFinite(beat) ? Math.max(0, Math.floor((now - beat) / 60000)) : null,
    final: finalOf(root, run),
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
      console.error(
        `${LABEL}: another run is active: ${active} (state ${live.state}, last heartbeat ${live.heartbeat_at}). ` +
          `Finish it with done, or pass --force to start ${run} anyway.`,
      );
      return 3;
    }
  }
  const p = paths(root, run);
  fs.mkdirSync(p.dir, { recursive: true });
  // Starting a run twice is harmless: the second start keeps when the run began and
  // who last conducted it. An unreadable earlier lease is replaced, not preserved.
  let prior = null;
  try {
    prior = loadLease(root, run);
  } catch {
    prior = null;
  }
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
    version: 1,
  });
  writeAtomic(p.next, `${FIRST_STEP}\n`);
  fs.rmSync(p.pending, { force: true });
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
  const p = paths(root, run);
  // Re-recording the step an active run is already at is not progress. Resetting
  // `blocks` then would let a conductor that re-runs `next` on every re-prompt and
  // stops again slip the watchdog's three-block guard forever; a new step, or a
  // resume from `waiting` or `done`, starts the count over.
  const moved = lease.state !== 'active' || readNext(root, run).label !== step;
  const note = (flags['--note'] ?? '').replace(/^\n+|\s+$/g, '');
  writeAtomic(p.next, `${step}\n${note ? `${note}\n` : ''}`);
  fs.rmSync(p.pending, { force: true });
  touch(root, run, moved ? { state: 'active', blocks: 0 } : { state: 'active' });
  reclaimActive(root, run);
  warnUnfollowed(root, run);
  console.log(`${LABEL}: ${run} NEXT: ${step}`);
  return 0;
}

function cmdWait(root, [run, reason]) {
  const line = oneLine(reason);
  if (!line) usage('wait needs a non-empty reason');
  requireLease(root, run);
  // pending_decision before the state: the hook refuses to block the moment the file
  // exists, whether or not the lease has caught up.
  writeAtomic(paths(root, run).pending, `${isoNow()} ${line}\n`);
  touch(root, run, { state: 'waiting' });
  reclaimActive(root, run);
  warnUnfollowed(root, run);
  console.log(`${LABEL}: ${run} is waiting for the operator: ${line}`);
  return 0;
}

function cmdDone(root, [run]) {
  requireLease(root, run);
  touch(root, run, { state: 'done' });
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
  if (flags['--json']) {
    console.log(JSON.stringify(s));
    return 0;
  }
  const lines = [
    `run: ${s.run}`,
    `run_dir: ${s.run_dir}`,
    `host: ${s.host ?? 'unknown'}`,
    `state: ${s.state ?? 'unknown (the lease is missing or unreadable)'}`,
    `next: ${s.next ?? 'none'}`,
    ...(s.note ? s.note.split('\n').map((l) => `  ${l}`) : []),
    `pending_decision: ${s.pending_decision ?? 'none'}`,
    `idle_minutes: ${s.idle_minutes ?? 'unknown'}`,
    `final: ${s.final ?? 'none'}`,
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
  requireLease(root, run);
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
 * evaluated. Returns null for an unterminated quote.
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
 * What the notifier would report right now: null, or `{ key, message }`, where `key`
 * names the episode. An idle episode is keyed by the heartbeat the run went quiet at,
 * so any progress starts a new one; a pending decision by its own line, so each new
 * `wait` is announced once.
 */
function watchFinding(root, idleMinutes, now) {
  const s = snapshot(root, now);
  if (!s) return null;
  if (s.state === 'waiting') {
    const reason = (s.pending_decision ?? '').replace(/^\d{4}-\d\d-\d\dT\S*\s*/, '');
    return {
      key: `waiting ${s.run} ${s.pending_decision ?? s.heartbeat_at}`,
      message: `orchestrator run ${s.run} is waiting for your decision${reason ? `: ${reason}` : ''}`,
    };
  }
  if (s.state !== 'active' || s.final || s.pending_decision !== null) return null;
  if (s.idle_minutes === null || s.idle_minutes < idleMinutes) return null;
  return {
    key: `idle ${s.run} ${s.heartbeat_at}`,
    message: `orchestrator run ${s.run} has been idle ${s.idle_minutes} min at ${s.next ?? 'no NEXT'}`,
  };
}

/**
 * One poll of the notifier as a function of the clock, so the suite can drive it. It
 * remembers the last episode it announced: a run idle for three hours produces one
 * notification, not 180. That memory lives in the long-running process, so each
 * `--once` reports whatever it finds.
 */
function watcher(root, idleMinutes, notify) {
  let announced = null;
  return (now) => {
    const finding = watchFinding(root, idleMinutes, now);
    if (!finding || finding.key === announced) return false;
    announced = finding.key;
    notify(finding.message);
    return true;
  };
}

function cmdWatch(root, _args, flags) {
  const idle = flags['--idle-minutes'] === undefined ? 30 : wholeNumber(flags['--idle-minutes']);
  if (idle === null || idle < 1) usage('--idle-minutes must be a whole number of minutes, 1 or more');
  let command = null;
  if (flags['--notify'] !== undefined) {
    command = splitCommand(flags['--notify']);
    if (!command || !command.length) usage('--notify needs a command, with any quotes closed');
  }
  const tick = watcher(root, idle, (message) => sendNotification(command, message));
  if (flags['--once']) return tick(Date.now()) ? 4 : 0;
  console.log(`${LABEL}: watching ${root}, every ${POLL_MS / 1000} s, idle after ${idle} min`);
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

module.exports = { RAISABLE, splitCommand, watcher };

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
