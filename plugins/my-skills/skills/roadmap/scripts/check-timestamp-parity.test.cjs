#!/usr/bin/env node
/**
 * Regression harness (standalone; no dependencies) for the roadmap
 * timestamp-parity gate: proves the gate FAILS CLOSED when a page is missing
 * its machine-readable `data-updated-at` or its visible `updated:` value,
 * instead of silently skipping it (bug-5). Drives the real
 * `check-timestamp-parity.cjs` (its sibling in this directory) as a subprocess
 * over tmp fixture `.html` files via explicit `-- file.html` targeting,
 * asserting on exit code and stdout/stderr.
 *
 * Explicit `--` targeting bypasses branch-scope, so the gate never touches the
 * orchestrator's `gate-scope.cjs` here — the harness runs from the skill's own
 * `scripts/` directory with no `.orchestrator/` present.
 *
 * Five fixtures:
 *   missing-data    — visible value present, `data-updated-at` attribute absent → fail
 *   missing-visible — `data-updated-at` present, visible `updated:` span absent → fail
 *   mismatch        — both present, differing values → fail (existing behaviour)
 *   valid           — both present, equal values → OK / exit 0
 *   missing-both    — neither timestamp present (index/aggregate page) → OK / skip
 *
 * Watched-to-fail: against the UNPATCHED gate the missing-data and
 * missing-visible fixtures print `roadmap-timestamp-parity: OK` / exit 0, so
 * those assertions are red first.
 *
 *   node scripts/check-timestamp-parity.test.cjs
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const NODE = process.execPath;
const GATE = path.join(__dirname, 'check-timestamp-parity.cjs');
const OK = 'roadmap-timestamp-parity: OK';

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL: ' + m); };
const pass = (m) => console.log('pass: ' + m);

// ---- fixtures: each returns the HTML body for a single roadmap page --------
const page = (attr, visibleSpan) =>
  '<!doctype html><html><head></head><body>\n' +
  '<main ' + attr + '>\n' +
  '  <div class="meta">\n' +
  '    <span class="meta__key">updated:</span> ' + visibleSpan + '\n' +
  '  </div>\n' +
  '</main>\n' +
  '</body></html>\n';

const withData = (v) => 'data-updated-at="' + v + '"';
const withVisible = (v) => '<span class="meta__val">' + v + '</span>';

const FIXTURES = {
  'missing-data': page('id="p"', withVisible('2026-07-22')),
  'missing-visible': page(withData('2026-07-22'), '<span class="meta__val_typo">2026-07-22</span>'),
  'mismatch': page(withData('2026-07-22'), withVisible('2026-07-20')),
  'valid': page(withData('2026-07-22'), withVisible('2026-07-22')),
  'missing-both': page('id="p"', '<span class="meta__val_typo">2026-07-22</span>'),
};

function writeFixture(dir, name) {
  const file = path.join(dir, name + '.html');
  fs.writeFileSync(file, FIXTURES[name]);
  return file;
}

function runGate(file) {
  return spawnSync(NODE, [GATE, '--', file], { cwd: __dirname, encoding: 'utf8', env: process.env });
}

// ---- assertions ------------------------------------------------------------
function assertFail(label, file, diagnosticRe) {
  const r = runGate(file);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && !out.includes(OK)) {
    if (diagnosticRe && !diagnosticRe.test(out)) {
      return fail(`${label}: non-zero but missing expected diagnostic ${diagnosticRe}; out=${JSON.stringify(out.trim())}`);
    }
    return pass(`${label}: fail-closed (exit=${r.status})`);
  }
  fail(`${label}: expected non-zero + no "${OK}", got status=${r.status} out=${JSON.stringify(out.trim())}`);
}

function assertOk(label, file) {
  const r = runGate(file);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0 && out.includes(OK)) return pass(`${label}: ${OK} (exit 0)`);
  fail(`${label}: expected exit 0 + "${OK}", got status=${r.status} out=${JSON.stringify(out.trim())}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'timestamp-parity-'));

assertFail('missing-data', writeFixture(tmp, 'missing-data'), /missing data-updated-at/i);
assertFail('missing-visible', writeFixture(tmp, 'missing-visible'), /missing visible updated value/i);
assertFail('mismatch', writeFixture(tmp, 'mismatch'), /but visible updated=/i);
assertOk('valid', writeFixture(tmp, 'valid'));
assertOk('missing-both', writeFixture(tmp, 'missing-both'));

if (failures) {
  console.error(`\ncheck-timestamp-parity: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ncheck-timestamp-parity: OK');
