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
 * Six fixtures:
 *   missing-data      — visible value present, `data-updated-at` attribute absent → fail
 *   missing-visible   — `data-updated-at` present, visible `updated:` span absent → fail
 *   mismatch          — both present, differing values → fail (existing behaviour)
 *   valid             — both present, equal values → OK / exit 0
 *   missing-both-item — an item page (data-kind other than roadmap-index) with
 *                       neither marker → fail closed (bug-2: was skipped fail-open)
 *   noncanonical-index — a NON-README.html page self-declaring data-kind=
 *                       "roadmap-index" with neither marker → fail closed; the
 *                       exemption requires the canonical roadmap/README.html path
 *                       in every mode (bug-3). The positive index case is exercised
 *                       in a real temp canonical layout (canonical-index /
 *                       nested-index-rejected below), not by an arbitrary tmp file.
 * Plus a read-safety assertion (sec-2): a symlinked target pointing at an otherwise
 * valid page is rejected (not followed), so only its symlink-ness trips the guard.
 * Plus decoy-marker assertions (bug-3): a comment carrying a data-updated-at that
 * matches the visible value cannot mask the root <main>'s divergent timestamp, and
 * two divergent visible markers fail closed instead of first-match-wins.
 * Plus root-<main> selection assertions (bug-2/bug-1): a tag-aware parse selects the
 * single body > main. A decoy <main> hidden in an inert <template> (incl. NESTED),
 * <textarea>, or an iframe `srcdoc` attribute is not read as the root; duplicate-root
 * or no-<main> fails closed; the visible marker is read only from the main's .meta
 * block, so a misplaced <aside> marker cannot mask a missing one, and an identical or
 * divergent duplicate inside the block fails the exactly-one rule.
 *
 * Watched-to-fail: against the pre-bug-2 gate the missing-both-item fixture
 * prints `roadmap-timestamp-parity: OK` / exit 0 — the skip was keyed on "neither
 * marker present", so any page (even a real item page) fell through — so that
 * assertion is red first.
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
  // item page (a milestone) that dropped BOTH markers → must fail closed (bug-2)
  'missing-both-item': page('data-kind="milestone"', '<span class="meta__val_typo">2026-07-22</span>'),
  // a NON-canonical page declaring data-kind="roadmap-index" with neither timestamp
  // must NOT be exempted in explicit mode — the exemption now requires the canonical
  // roadmap/README.html path in every mode (bug-3). Audited as a plain tmp file
  // (basename != README.html), so it fails closed.
  'noncanonical-index': page('data-kind="roadmap-index"', '<span class="meta__val_typo">2026-07-22</span>'),
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
assertFail('missing-both-item', writeFixture(tmp, 'missing-both-item'), /missing both timestamp markers/i);
assertFail('noncanonical-index', writeFixture(tmp, 'noncanonical-index'), /missing both timestamp markers/i);

// bug-3: the index exemption is granted ONLY to the canonical roadmap/README.html
// path, in every mode. These cases run a COPY of the gate inside a real temporary
// canonical roadmap layout (rather than weakening production validation to let an
// arbitrary tmp file self-declare as the index):
//   - a canonical roadmap/README.html with data-kind="roadmap-index" and neither
//     timestamp → exempt → OK;
//   - a NESTED roadmap/<m>/README.html with the same content → NOT the canonical
//     index → fails closed.
function runInCanonicalLayout(subpath, html, args) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-parity-canon-'));
  const target = path.join(root, 'roadmap', subpath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  fs.copyFileSync(GATE, path.join(root, 'roadmap', 'check-timestamp-parity.cjs'));
  return spawnSync(NODE, [path.join(root, 'roadmap', 'check-timestamp-parity.cjs'), ...args], {
    cwd: root, encoding: 'utf8', env: process.env,
  });
}
const indexPage = page('data-kind="roadmap-index"', '<span class="meta__val_typo">x</span>');
{
  const r = runInCanonicalLayout('README.html', indexPage, ['--all']);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0 && out.includes(OK)) pass('canonical-index: OK (exempt)');
  else fail(`canonical-index: expected exit 0 + "${OK}", got status=${r.status} out=${JSON.stringify(out.trim())}`);
}
{
  const r = runInCanonicalLayout(path.join('001-m', 'README.html'), indexPage, ['--all']);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && !out.includes(OK) && /missing both timestamp markers/i.test(out)) {
    pass('nested-index-rejected: fail-closed (exit=' + r.status + ')');
  } else {
    fail(`nested-index-rejected: expected non-zero + missing-both diagnostic, got status=${r.status} out=${JSON.stringify(out.trim())}`);
  }
}

// arch-1: branch scope version-gates the orchestrator's gate-scope helper against a
// CLOSED supported range [MIN, MAX] (both 1). An absent, older, or unknown-NEWER
// helper version must fail closed; the compatible version proceeds. Runs a copy of
// the gate in branch mode against a stub .orchestrator/gate-scope.cjs.
function runBranchWithHelper(helperBody) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-parity-ver-'));
  fs.mkdirSync(path.join(root, 'roadmap'));
  fs.mkdirSync(path.join(root, '.orchestrator'));
  fs.copyFileSync(GATE, path.join(root, 'roadmap', 'check-timestamp-parity.cjs'));
  fs.writeFileSync(path.join(root, '.orchestrator', 'gate-scope.cjs'), helperBody);
  return spawnSync(NODE, [path.join(root, 'roadmap', 'check-timestamp-parity.cjs')], {
    cwd: root, encoding: 'utf8', env: process.env,
  });
}
{
  const r = runBranchWithHelper('module.exports = { SCOPE_API_VERSION: 2, branchScope: () => [] };');
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && /newer than this gate/i.test(out)) pass('scope-api-newer: fail-closed');
  else fail(`scope-api-newer: expected fail-closed + "newer" diagnostic, got status=${r.status} out=${JSON.stringify(out.trim())}`);
}
{
  const r = runBranchWithHelper('module.exports = { branchScope: () => [] };');
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && /SCOPE_API_VERSION absent/i.test(out)) pass('scope-api-absent: fail-closed');
  else fail(`scope-api-absent: expected fail-closed + "absent" diagnostic, got status=${r.status} out=${JSON.stringify(out.trim())}`);
}
{
  const r = runBranchWithHelper('module.exports = { SCOPE_API_VERSION: 1, branchScope: () => [] };');
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0 && out.includes(OK)) pass('scope-api-compatible: OK (empty scope)');
  else fail(`scope-api-compatible: expected exit 0 + "${OK}", got status=${r.status} out=${JSON.stringify(out.trim())}`);
}

// sec-2: a symlinked target must be REJECTED (not followed), even when it points at
// a perfectly valid page — so only its symlink-ness, not its content, trips the
// guard. This is the read-safety defense against a branch planting a roadmap/*.html
// symlink to an external/unbounded file.
const linkReal = path.join(tmp, 'symlink-real-target.html');
fs.writeFileSync(linkReal, FIXTURES['valid']);
const linkPath = path.join(tmp, 'symlink-evil.html');
try {
  fs.symlinkSync(linkReal, linkPath);
  assertFail('symlink-target', linkPath, /not a regular file/i);
} catch (e) {
  if (e && (e.code === 'EPERM' || e.code === 'ENOSYS')) pass('symlink-target: skipped (symlink unsupported here)');
  else throw e;
}

// bug-4: an item page must NOT be exempted by a stray data-kind="roadmap-index"
// that sits OUTSIDE its root <main> (here, a decoy in an HTML comment). The root
// main is a milestone and both timestamps are dropped → must fail closed.
const spoof =
  '<!doctype html><html><head></head><body>\n' +
  '<!-- data-kind="roadmap-index" (decoy in a comment) -->\n' +
  '<main data-kind="milestone">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val_typo">2026-07-22</span></div>\n' +
  '</main>\n</body></html>\n';
const spoofFile = path.join(tmp, 'spoofed-index-comment.html');
fs.writeFileSync(spoofFile, spoof);
assertFail('spoofed-index-comment', spoofFile, /missing both timestamp markers/i);

// bug-3: a leading comment carrying a data-updated-at that MATCHES the visible value
// must NOT mask the real root <main>'s divergent timestamp. Root main = 2026-07-20,
// visible = 2026-07-22, decoy comment = 2026-07-22 → an old first-match read the decoy
// and printed OK; the gate must compare the ROOT timestamp and fail on the mismatch.
const decoyData =
  '<!doctype html><html><head></head><body>\n' +
  '<!-- data-updated-at="2026-07-22" decoy matching the visible value -->\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-20">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-22</span></div>\n' +
  '</main>\n</body></html>\n';
const decoyDataFile = path.join(tmp, 'decoy-comment-data.html');
fs.writeFileSync(decoyDataFile, decoyData);
assertFail('decoy-comment-data', decoyDataFile, /but visible updated=/i);

// bug-3/bug-1: two visible markers INSIDE the expected .meta block (divergent here)
// fail closed rather than first-match-wins — exactly one marker is required in the
// metadata element.
const decoyVisible =
  '<!doctype html><html><head></head><body>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-22">\n' +
  '  <div class="meta">\n' +
  '    <span class="meta__key">updated:</span> <span class="meta__val">2026-07-22</span>\n' +
  '    <span class="meta__key">updated:</span> <span class="meta__val">1999-01-01</span>\n' +
  '  </div>\n</main>\n</body></html>\n';
const decoyVisibleFile = path.join(tmp, 'decoy-nested-visible.html');
fs.writeFileSync(decoyVisibleFile, decoyVisible);
assertFail('decoy-nested-visible', decoyVisibleFile, /exactly one visible updated marker/i);

// bug-1: a decoy <main> hidden in an iframe srcdoc attribute (quoted markup) must
// not be read as the root. Real milestone main is divergent (2026-07-20); the
// srcdoc decoy matches the visible (2026-07-22).
const iframeDecoy =
  '<!doctype html><html><head></head><body>\n' +
  '<iframe srcdoc="<main data-kind=&quot;roadmap-index&quot; data-updated-at=&quot;2026-07-22&quot;></main>"></iframe>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-20">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-22</span></div>\n</main>\n</body></html>\n';
const iframeDecoyFile = path.join(tmp, 'iframe-srcdoc-decoy.html');
fs.writeFileSync(iframeDecoyFile, iframeDecoy);
assertFail('iframe-srcdoc-decoy', iframeDecoyFile, /but visible updated=/i);

// bug-1: a decoy <main> inside NESTED <template>s must not be read as the root.
const nestedTemplateDecoy =
  '<!doctype html><html><head></head><body>\n' +
  '<template><template><main data-kind="roadmap-index" data-updated-at="2026-07-22"></main></template></template>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-20">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-22</span></div>\n</main>\n</body></html>\n';
const nestedTemplateFile = path.join(tmp, 'nested-template-decoy.html');
fs.writeFileSync(nestedTemplateFile, nestedTemplateDecoy);
assertFail('nested-template-decoy', nestedTemplateFile, /but visible updated=/i);

// bug-1: a marker MISPLACED in an <aside> must not mask a marker MISSING from the
// expected .meta block — the .meta block here has no updated marker, so the page
// fails "missing visible" despite the aside carrying one.
const misplacedMarker =
  '<!doctype html><html><head></head><body>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-22">\n' +
  '  <div class="meta"><span class="meta__key">created:</span> ' +
  '<span class="meta__val">2026-07-01</span></div>\n' +
  '  <aside><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-22</span></aside>\n' +
  '</main>\n</body></html>\n';
const misplacedFile = path.join(tmp, 'misplaced-marker.html');
fs.writeFileSync(misplacedFile, misplacedMarker);
assertFail('misplaced-marker', misplacedFile, /missing visible updated value/i);

// bug-1: two IDENTICAL markers in the .meta block also fail the exactly-one rule
// (deduping would have hidden the duplication).
const identicalDup =
  '<!doctype html><html><head></head><body>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-22">\n' +
  '  <div class="meta">\n' +
  '    <span class="meta__key">updated:</span> <span class="meta__val">2026-07-22</span>\n' +
  '    <span class="meta__key">updated:</span> <span class="meta__val">2026-07-22</span>\n' +
  '  </div>\n</main>\n</body></html>\n';
const identicalDupFile = path.join(tmp, 'identical-duplicate.html');
fs.writeFileSync(identicalDupFile, identicalDup);
assertFail('identical-duplicate', identicalDupFile, /exactly one visible updated marker.*found 2/i);

// bug-2: a decoy <main> inside an inert <template> before the real body > main must
// NOT be read as the root. The template main carries a data-updated-at MATCHING the
// visible value; the real milestone main is divergent (2026-07-20). Old first-main
// selection read the template decoy and printed OK; the gate must read the real main.
const templateDecoy =
  '<!doctype html><html><head></head><body>\n' +
  '<template><main data-kind="roadmap-index" data-updated-at="2026-07-22"></main></template>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-20">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-22</span></div>\n' +
  '</main>\n</body></html>\n';
const templateDecoyFile = path.join(tmp, 'template-decoy-main.html');
fs.writeFileSync(templateDecoyFile, templateDecoy);
assertFail('template-decoy-main', templateDecoyFile, /but visible updated=/i);

// bug-2: same, but the decoy <main> hides in a raw-text <textarea>.
const textareaDecoy =
  '<!doctype html><html><head></head><body>\n' +
  '<textarea><main data-kind="roadmap-index" data-updated-at="2026-07-22"></main></textarea>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-20">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-22</span></div>\n' +
  '</main>\n</body></html>\n';
const textareaDecoyFile = path.join(tmp, 'textarea-decoy-main.html');
fs.writeFileSync(textareaDecoyFile, textareaDecoy);
assertFail('textarea-decoy-main', textareaDecoyFile, /but visible updated=/i);

// bug-2: two genuine top-level <main> elements (malformed / duplicate root) fail closed.
const duplicateRoot =
  '<!doctype html><html><head></head><body>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-22">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-22</span></div>\n</main>\n' +
  '<main data-kind="milestone" data-updated-at="2026-07-20">\n' +
  '  <div class="meta"><span class="meta__key">updated:</span> ' +
  '<span class="meta__val">2026-07-20</span></div>\n</main>\n' +
  '</body></html>\n';
const duplicateRootFile = path.join(tmp, 'duplicate-root-main.html');
fs.writeFileSync(duplicateRootFile, duplicateRoot);
assertFail('duplicate-root-main', duplicateRootFile, /exactly one root <main>, found 2/i);

// bug-2: a malformed page with NO <main> but carrying timestamps fails closed
// (found 0) rather than reading stray markers.
const noMain =
  '<!doctype html><html><head></head><body>\n' +
  '<div data-updated-at="2026-07-22">\n' +
  '  <span class="meta__key">updated:</span> <span class="meta__val">2026-07-22</span>\n' +
  '</div>\n</body></html>\n';
const noMainFile = path.join(tmp, 'no-main.html');
fs.writeFileSync(noMainFile, noMain);
assertFail('no-main', noMainFile, /exactly one root <main>, found 0/i);

// bug-2: an explicit target that does not exist must FAIL closed, not be silently
// dropped into a zero-file OK (the old existsSync filter removed missing paths).
assertFail('missing-explicit-target', path.join(tmp, 'does-not-exist.html'), /missing target/i);

// bug-2: a mixed list (one valid page + one missing) must still fail on the missing
// member rather than pass because the surviving file is OK.
{
  const validFile = writeFixture(tmp, 'valid');
  const missingFile = path.join(tmp, 'also-missing.html');
  const r = spawnSync(NODE, [GATE, '--', validFile, missingFile], { cwd: __dirname, encoding: 'utf8', env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && !out.includes(OK) && /missing target/i.test(out)) {
    pass(`mixed-existing-missing: fail-closed (exit=${r.status})`);
  } else {
    fail(`mixed-existing-missing: expected non-zero + missing-target diagnostic, got status=${r.status} out=${JSON.stringify(out.trim())}`);
  }
}

if (failures) {
  console.error(`\ncheck-timestamp-parity: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ncheck-timestamp-parity: OK');
