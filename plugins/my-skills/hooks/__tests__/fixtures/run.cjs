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

/** Write a run's lease and NEXT under `root`, as `run-state.cjs start` and `next` leave them. */
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

// run-state.cjs `wait` writes the same shape: ISO-8601 UTC to the second, then the reason.
const PENDING_LINE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ watchdog: 3 blocks without progress\n$/;

module.exports = { RUN, STEP, project, writeRun, tempDir, cleanup, readLease, writeFinal, PENDING_LINE };
