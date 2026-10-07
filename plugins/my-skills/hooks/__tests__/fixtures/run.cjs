const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RUN = '20260929T101500Z-a1b2-watchdog';
const STEP = 'Step 4 — reviewer, cycle 2';

// Every directory these fixtures create, so each suite can remove them all when it
// ends: `after(cleanup)`. One suite run otherwise leaves some fifty behind, one of
// them holding a 65 MB sparse transcript.
const made = [];

function tempDir(prefix = 'orch-watchdog-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

function cleanup() {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * The environment every process these suites spawn runs with: this one's, minus what
 * would let a suite run inside a host session act as that session — the ids Claude
 * Code and the opencode plugin set for every command, a debug sink, the config dir the
 * watch probe reads transcripts from — and with notifications off. A case that needs
 * one of them sets it in `extra`, where `undefined` removes a variable.
 */
const SCRUBBED = ['CLAUDE_CODE_SESSION_ID', 'ORCHESTRATOR_SESSION_ID', 'ORCHESTRATOR_HOOK_DEBUG', 'CLAUDE_CONFIG_DIR'];
function childEnv(extra = {}) {
  const env = { ...process.env, ORCHESTRATOR_NOTIFY: '0' };
  for (const key of SCRUBBED) delete env[key];
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

/**
 * Write a run's lease and NEXT under `root`. The lease is v1 by default, the shape a
 * project copy of `run-state.cjs` from before lease v2 still writes; `v2(...)` gives
 * the fields `start` writes now.
 */
function writeRun(root, { run = RUN, lease = {}, next = STEP } = {}) {
  const dir = path.join(root, '.orchestrator', 'runs', run);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(root, '.orchestrator', 'runs', 'ACTIVE'), `${run}\n`);
  fs.writeFileSync(path.join(dir, 'lease.json'), `${JSON.stringify({
    run,
    run_dir: `plans/${run}`,
    host: 'claude-code',
    session_id: null,
    state: 'active',
    started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    heartbeat_at: new Date().toISOString(),
    blocks: 0,
    last_block_next: null,
    version: 1,
    ...lease,
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'NEXT'), `${next}\nread plans/${run}/REVIEW-002-watchdog.md\n`);
  return dir;
}

/** Lease v2's fields, over a v1 lease: a conductor on record, and nothing dispatched or failed yet. */
const v2 = (fields = {}) => ({ version: 2, conductor_session: null, dispatched_at: null, takeovers: [], stop_failure: null, ...fields });

/** A project holding one active run, as `run-state.cjs start` and `next` leave it. */
function project(options = {}) {
  const root = tempDir();
  return { root, dir: writeRun(root, options) };
}

function readLease(dir) {
  return fs.readFileSync(path.join(dir, 'lease.json'), 'utf8');
}

function writeFinal(root) {
  fs.mkdirSync(path.join(root, 'plans', RUN), { recursive: true });
  fs.writeFileSync(path.join(root, 'plans', RUN, 'FINAL-001-watchdog.md'), '# Final\n');
}

/** Record work in flight the way `run-state.cjs dispatch` does: one timestamped line, appended. */
function writeInFlight(dir, what, at = new Date()) {
  fs.appendFileSync(path.join(dir, 'in_flight'), `${at.toISOString()} ${what}\n`);
}

// run-state.cjs `wait` writes the same shape: ISO-8601 UTC to the second, then the reason.
const PENDING_LINE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ watchdog: 3 blocks without progress\n$/;

module.exports = {
  RUN, STEP, project, writeRun, v2, writeInFlight, tempDir, cleanup, childEnv, SCRUBBED, readLease, writeFinal, PENDING_LINE,
};
