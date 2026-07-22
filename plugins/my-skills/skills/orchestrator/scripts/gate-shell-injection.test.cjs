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
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
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
  // roadmap-timestamp-parity: neither timestamp marker present -> skipped -> OK.
  const html = path.join(tmp, 'benign.html');
  fs.writeFileSync(html, '<!doctype html><p>no timestamps here</p>\n');
  return html;
}

for (const gate of GATES) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-inj-'));

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
