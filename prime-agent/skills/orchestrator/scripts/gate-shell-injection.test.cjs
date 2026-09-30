#!/usr/bin/env node
/**
 * Regression harness (standalone; no dependencies): proves the three CI gate
 * scripts do NOT execute a caller-supplied base ref as a shell command
 * (command injection), and still behave correctly on a benign explicit scope.
 *
 * For EACH gate it (a) invokes the gate with an explicit base ref carrying
 * shell metacharacters engineered to `touch` a unique sentinel, then asserts
 * the sentinel was NOT created AND the gate exited non-zero; and (b) invokes
 * the gate with a benign explicit `-- <file>` scope and asserts it prints its
 * `… : OK` line and exits 0.
 *
 * Watched-to-fail: against the UNPATCHED scripts the injection creates the
 * sentinel (and the gate exits 0), so this harness fails. Against the patched
 * scripts the metacharacter ref is rejected non-zero with no sentinel.
 *
 *   node .orchestrator/gate-shell-injection.test.cjs
 *
 * It tests the gates as a consumer project holds them. In this repository, the
 * marketplace, that layout never exists, so consumerProject() builds it (below).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const scratch = [];
process.on('exit', () => { for (const dir of scratch) fs.rmSync(dir, { recursive: true, force: true }); });
function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

/**
 * The project root the gates run in. In a consumer project that is the directory
 * whose `.orchestrator/` holds gate-scope.cjs, as it does once bootstrap copies it
 * there. Here gate-scope.cjs sits in the skill's `scripts/` beside this file, so the
 * layout is built in a temp project instead: a git repository with one commit (the
 * injected refs must be rejected by git, not by a missing repository) and a `plans/`
 * directory (without one the pairing gate exits 0 before it reads its ref), the
 * orchestrator's three scripts copied into `.orchestrator/`, and the roadmap skill's
 * parity gate into `roadmap/`, where that skill materializes it and whence it
 * requires `../.orchestrator/gate-scope.cjs`.
 */
function consumerProject() {
  const root = path.resolve(__dirname, '..');
  const here = path.join(__dirname, 'gate-scope.cjs');
  if (fs.existsSync(path.join(root, '.orchestrator', 'gate-scope.cjs')) || !fs.existsSync(here)) return root;
  const project = tempDir('gate-inj-project-');
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.test', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.test',
  };
  execFileSync('git', ['-C', project, 'init', '-q', '--template='], { env, stdio: 'ignore' });
  execFileSync('git', ['-C', project, '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'consumer project'], { env, stdio: 'ignore' });
  fs.mkdirSync(path.join(project, 'plans'));
  fs.mkdirSync(path.join(project, '.orchestrator'));
  for (const script of ['gate-scope.cjs', 'check-artifact-pairing.cjs', 'check-artifact-links.cjs']) {
    fs.copyFileSync(path.join(__dirname, script), path.join(project, '.orchestrator', script));
  }
  fs.mkdirSync(path.join(project, 'roadmap'));
  fs.copyFileSync(path.join(__dirname, '..', '..', 'roadmap', 'scripts', 'check-timestamp-parity.cjs'),
    path.join(project, 'roadmap', 'check-timestamp-parity.cjs'));
  return project;
}

const ROOT = consumerProject();
const NODE = process.execPath;

const GATES = [
  { name: 'artifact-links', script: '.orchestrator/check-artifact-links.cjs', ok: 'artifact-links: OK' },
  { name: 'artifact-pairing', script: '.orchestrator/check-artifact-pairing.cjs', ok: 'artifact-pairing: OK' },
  { name: 'roadmap-timestamp-parity', script: 'roadmap/check-timestamp-parity.cjs', ok: 'roadmap-timestamp-parity: OK' },
];

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL: ' + msg); };
const pass = (msg) => console.log('pass: ' + msg);

function runGate(script, args) {
  return spawnSync(NODE, [path.join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8' });
}

function benignTarget(tmp, gate) {
  if (gate.name === 'artifact-pairing') {
    // A .progress.md skips the frontmatter check; only its html sibling must exist.
    const md = path.join(tmp, 'benign.progress.md');
    fs.writeFileSync(md, '# benign\n');
    fs.writeFileSync(path.join(tmp, 'benign.progress.html'), '<!doctype html>\n');
    return md;
  }
  if (gate.name === 'artifact-links') {
    // Only an external href — no local link to resolve, so the gate reports OK.
    const html = path.join(tmp, 'benign.html');
    fs.writeFileSync(html, '<a href="https://example.com">ext</a>\n');
    return html;
  }
  // roadmap-timestamp-parity: a normal item page with EQUAL machine-readable +
  // visible timestamps -> parity holds -> OK. (A marker-free page now fails closed
  // for item pages, so it can no longer stand in as the benign fixture — bug-5.)
  const html = path.join(tmp, 'benign.html');
  fs.writeFileSync(
    html,
    '<!doctype html><html><head></head><body>\n' +
    '<main data-kind="milestone" data-updated-at="2026-07-22">\n' +
    '  <div class="meta"><span class="meta__key">updated:</span> ' +
    '<span class="meta__val">2026-07-22</span></div>\n' +
    '</main>\n</body></html>\n'
  );
  return html;
}

for (const gate of GATES) {
  const tmp = tempDir('gate-inj-');

  // (a) Injection attempts: each engineered to create a unique sentinel file.
  const variants = [
    (s) => `$(touch ${s})`,
    (s) => `; touch ${s} #`,
    (s) => `\`touch ${s}\``,
  ];
  variants.forEach((mk, i) => {
    const sentinelBase = `sentinel-${gate.name}-${i}`;
    const sentinel = path.join(tmp, sentinelBase);
    const ref = mk(sentinel);
    const res = runGate(gate.script, [ref]);
    const created = fs.readdirSync(tmp).some((f) => f.startsWith(sentinelBase));
    if (created) fail(`${gate.name}: injection via "${ref}" created a sentinel file`);
    else pass(`${gate.name}: injection via "${ref}" created no sentinel`);
    if (res.status === 0) fail(`${gate.name}: injection via "${ref}" exited 0 (expected non-zero rejection)`);
    else pass(`${gate.name}: injection via "${ref}" rejected non-zero (exit=${res.status})`);
  });

  // (b) Benign explicit scope still produces the OK verdict and exit 0.
  const target = benignTarget(tmp, gate);
  const res = runGate(gate.script, ['--', target]);
  const out = (res.stdout || '') + (res.stderr || '');
  if (res.status === 0 && out.includes(gate.ok)) {
    pass(`${gate.name}: benign explicit scope prints "${gate.ok}" and exits 0`);
  } else {
    fail(`${gate.name}: benign scope expected "${gate.ok}" exit 0, got status=${res.status} out=${JSON.stringify(out.trim())}`);
  }
}

if (failures) {
  console.error(`\ngate-shell-injection: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ngate-shell-injection: OK');
