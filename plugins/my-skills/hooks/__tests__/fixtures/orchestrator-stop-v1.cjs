#!/usr/bin/env node
/**
 * The Claude Code half of the orchestrator watchdog: a plugin Stop hook that hands
 * the turn back to a conductor that ended it mid-run. A run whose turn ends on
 * "Now Step 5 — QA" otherwise sits idle until someone happens to look.
 *
 * It blocks the stop only when every one of these holds:
 *   1. `.orchestrator/runs/ACTIVE` names a run whose `lease.json` is `active`;
 *   2. the lease was heartbeated less than 12 h ago;
 *   3. there is no `plans/<run>/FINAL-*.md`;
 *   4. there is no `pending_decision`, the file a deliberate operator stop writes;
 *   5. `stop_hook_active` is not set, or NEXT has moved on since the last block: a turn
 *      that already continued once on a block and made no progress is let stop;
 *   6. this session's own tool calls ran `run-state.cjs start <run>` or `next <run>`;
 *   7. fewer than three blocks have landed on the same NEXT step.
 *
 * Ownership (6) is proved by evidence, never read from the lease: an unrelated
 * session in the same project is never blocked, and a session that resumed the run
 * with `next` owns it. Only commands count, never their output or anyone's prose, so
 * a `status` that printed a note naming the command hands the run to nobody. The
 * lease's `session_id` records who proved it last, and moves ownership rather than
 * sharing it: once it names another session, this one must hold the command that
 * wrote the current NEXT — `next <run> "<that label>"`, or `start <run>` at Step 0 —
 * so a session the run has moved on from is never pushed back into conducting it.
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
const BOOLEAN_FLAGS = new Set(['--force', '--json', '--all', '--once']);

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

/** Conditions 1-4: the run is live, unfinished, and not waiting for the operator on purpose. */
function blockable({ root, run, dir, lease }, now = Date.now()) {
  if (lease.state !== 'active') return false;
  if (!(now - Date.parse(lease.heartbeat_at) < STALE_MS)) return false;
  if (hasFinal(path.join(root, 'plans', run))) return false;
  return fs.statSync(path.join(dir, 'pending_decision'), { throwIfNoEntry: false }) === undefined;
}

/** NEXT's first line, the step the run is at; empty when NEXT is missing. */
function nextStep(dir) {
  return (readIfExists(path.join(dir, 'NEXT')) || '').split(/\r?\n/)[0].trim();
}

/**
 * Condition 5's test: has the run moved since the last block? Claude Code keeps
 * `stop_hook_active` set for the rest of the operator's turn, so on its own it would
 * rescue one stall per turn and leave every later one in an unattended run idle. A
 * block leaves `blocks` at 1 or more on `last_block_next`, and `run-state.cjs next`
 * resets `blocks` whenever the step changes — so a step that moved away and back
 * reads as progress, and only a stop on the very step just blocked, with no `next`
 * to a new step in between, reads as none.
 */
function progressed(lease, step) {
  return step !== lease.last_block_next || !(Number(lease.blocks) > 0);
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
 * Condition 6 as a test over one proved call. With no conductor on record, or with
 * this session on record, any `start` or `next` of the run proves it. Once the lease
 * names another session, only the call that wrote the current NEXT does.
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
 * Condition 6 for Claude Code. Only this session's own Bash calls count — an
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
 * Condition 7, and the lease write that goes with every proved stop. `blocks` counts
 * consecutive blocks on an unchanged NEXT first line; `run-state.cjs next` resets it
 * when the step changes. Returns true to block. A fourth stop on the same step trips
 * the guard instead: the run is parked `waiting` with a `pending_decision`, and the
 * operator's `run-state.cjs watch` notifies.
 *
 * It re-reads the lease and re-checks conditions 1-4 right before writing: a `wait`,
 * `done` or `next` that landed while this stop was being proved — the plugin awaits
 * two client calls in between — must neither be reverted nor pushed past.
 */
function recordBlock({ root, run, dir }, sessionId) {
  const lease = readLease(dir);
  if (!blockable({ root, run, dir, lease })) return false;
  const step = nextStep(dir);
  const prior = lease.last_block_next === step ? Number(lease.blocks) || 0 : 0;
  if (sessionId) lease.session_id = sessionId;
  if (prior >= MAX_BLOCKS) {
    writeAtomic(path.join(dir, 'pending_decision'), `${isoNow()} watchdog: ${MAX_BLOCKS} blocks without progress\n`);
    lease.state = 'waiting';
  } else {
    lease.blocks = prior + 1;
    lease.last_block_next = step;
  }
  writeAtomic(path.join(dir, 'lease.json'), `${JSON.stringify(lease, null, 2)}\n`);
  return prior < MAX_BLOCKS;
}

/** What the conductor reads instead of stopping. Both hosts send the same text. */
function blockReason(run) {
  const runState = 'node .orchestrator/run-state.cjs';
  return 'Orchestrator watchdog: the run is still active, with no FINAL and no pending decision. '
    + `Read .orchestrator/runs/${run}/NEXT and dispatch that step now. `
    + `If the operator really must decide, ask with AskUserQuestion / question, then run \`${runState} wait ${run} '<reason>'\` before ending the turn. `
    + `If the run is truly over, run \`${runState} done ${run}\`.`;
}

function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (input.hook_event_name && input.hook_event_name !== 'Stop') return;
  if (typeof input.transcript_path !== 'string') return;
  const project = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  for (const found of activeRuns([...searchRoots(process.env.CLAUDE_PROJECT_DIR, input.cwd), ...linkedWorktrees(project)])) {
    if (!blockable(found)) continue;
    const step = nextStep(found.dir);
    if (!transcriptHasEvidence(input.transcript_path, found.run, provesOwnership(found, step, input.session_id))) continue;
    if (input.stop_hook_active === true && !progressed(found.lease, step)) return;
    if (recordBlock(found, input.session_id)) {
      process.stdout.write(`${JSON.stringify({ decision: 'block', reason: blockReason(found.run) })}\n`);
    }
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
  activeRuns, blockable, nextStep, runStateCalls, provesOwnership, recordBlock, blockReason, searchRoots,
  linkedWorktrees, CHUNK_BYTES, SCAN_CAP_BYTES,
};
