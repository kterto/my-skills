#!/usr/bin/env node
/**
 * FR-9 regression harness (standalone; no dependencies): proves the shared
 * scope-discovery module and the three CI gates FAIL CLOSED when Git is unusable
 * or no base ref resolves, while a *trustworthy* empty scope, explicit `-- file`
 * targeting, `--all`, and `--allow-empty` still pass exactly as before.
 *
 * Two layers:
 *   module — drives `.orchestrator/gate-scope.cjs` in isolation via a tmp stub,
 *            under `git` shims injected on PATH.
 *   gates  — drives each of the three real gates as a subprocess: fail-closed
 *            cases under the shims; the invalid-explicit-ref rejection under real
 *            git; and the caller-supplied `-- file`/`--all` scopes under the fail
 *            shim to prove they bypass the base guard (identical verdict, no
 *            base-unresolvable diagnostic, whether or not git is usable).
 *
 * Watched-to-fail: against the UNPATCHED gates the failing-git and
 * unresolvable-base cases print `… : OK` / exit 0, so the gates layer fails.
 *
 *   node .orchestrator/gate-scope.test.cjs                # both layers
 *   node .orchestrator/gate-scope.test.cjs --module-only  # module layer only
 *   node .orchestrator/gate-scope.test.cjs --gates-only   # gates layer only
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const MODULE = path.join(ROOT, '.orchestrator', 'gate-scope.cjs');

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL: ' + m); };
const pass = (m) => console.log('pass: ' + m);

// ---- git shims: named `git`, injected as the first PATH entry -------------
const SHIMS = {
  // Every invocation fails — Git wholly unusable.
  fail: '#!/bin/sh\nexit 1\n',
  // Repo usable (git-dir probe succeeds) but no base resolves (merge-base fails).
  unresolvable:
    '#!/bin/sh\n' +
    'if [ "$1" = "rev-parse" ] && [ "$2" = "--git-dir" ]; then echo .git; exit 0; fi\n' +
    'exit 1\n',
  // Repo usable, base resolves, but every scope query is genuinely empty.
  empty:
    '#!/bin/sh\n' +
    'case "$1" in\n' +
    '  rev-parse) echo .git; exit 0 ;;\n' +
    '  merge-base) echo 0000000000000000000000000000000000000000; exit 0 ;;\n' +
    '  diff) exit 0 ;;\n' +
    '  ls-files) exit 0 ;;\n' +
    'esac\n' +
    'exit 0\n',
};

function shimEnv(mode, tmp) {
  const dir = path.join(tmp, 'shim-' + mode);
  fs.mkdirSync(dir, { recursive: true });
  const bin = path.join(dir, 'git');
  fs.writeFileSync(bin, SHIMS[mode], { mode: 0o755 });
  fs.chmodSync(bin, 0o755);
  return { ...process.env, PATH: dir + path.delimiter + process.env.PATH };
}

const GATES = [
  {
    name: 'artifact-pairing',
    script: '.orchestrator/check-artifact-pairing.cjs',
    ok: 'artifact-pairing: OK',
    auditPath: 'plans',
    ext: '.md',
    benign: (tmp) => {
      const md = path.join(tmp, 'benign.progress.md');
      fs.writeFileSync(md, '# benign\n');
      fs.writeFileSync(path.join(tmp, 'benign.progress.html'), '<!doctype html>\n');
      return md;
    },
  },
  {
    name: 'artifact-links',
    script: '.orchestrator/check-artifact-links.cjs',
    ok: 'artifact-links: OK',
    auditPath: 'plans',
    ext: '.html',
    benign: (tmp) => {
      const html = path.join(tmp, 'benign.html');
      fs.writeFileSync(html, '<a href="https://example.com">ext</a>\n');
      return html;
    },
  },
  {
    name: 'roadmap-timestamp-parity',
    script: 'roadmap/check-timestamp-parity.cjs',
    ok: 'roadmap-timestamp-parity: OK',
    auditPath: 'roadmap',
    ext: '.html',
    all: true,
    benign: (tmp) => {
      const html = path.join(tmp, 'benign.html');
      fs.writeFileSync(html, '<!doctype html><p>no timestamps here</p>\n');
      return html;
    },
  },
];

function runGate(script, args, env) {
  return spawnSync(NODE, [path.join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8', env });
}

// ---- module layer ---------------------------------------------------------
function moduleLayer(tmp) {
  const stub = path.join(tmp, 'gate-scope.stub.cjs');
  fs.writeFileSync(
    stub,
    "'use strict';\n" +
      'const { branchScope } = require(process.env.GS_MODULE);\n' +
      'const files = branchScope(JSON.parse(process.env.GS_OPTS));\n' +
      "process.stdout.write('STUB_OK n=' + files.length + '\\n');\n"
  );
  const runStub = (opts, env) =>
    spawnSync(NODE, [stub], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...env, GS_MODULE: MODULE, GS_OPTS: JSON.stringify(opts) },
    });

  const fatal = (label, r, stderrRe) => {
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status !== 0 && !out.includes('STUB_OK')) {
      if (stderrRe && !stderrRe.test(out)) {
        return fail(`${label}: fatal but missing diagnostic; out=${JSON.stringify(out.trim())}`);
      }
      return pass(`${label}: fail-closed (exit=${r.status})`);
    }
    fail(`${label}: expected fatal non-zero + no STUB_OK, got status=${r.status} out=${JSON.stringify(out.trim())}`);
  };
  const emptyPass = (label, r) => {
    if (r.status === 0 && /STUB_OK n=0/.test(r.stdout || '')) return pass(`${label}: empty pass (exit 0)`);
    const out = (r.stdout || '') + (r.stderr || '');
    fail(`${label}: expected exit 0 + STUB_OK n=0, got status=${r.status} out=${JSON.stringify(out.trim())}`);
  };

  for (const g of GATES) {
    const base = { root: ROOT, auditPath: g.auditPath, ext: g.ext, label: g.name };
    fatal(`module/${g.name}: failing-git`, runStub({ ...base, allowEmpty: false }, shimEnv('fail', tmp)));
    fatal(`module/${g.name}: unresolvable base`, runStub({ ...base, allowEmpty: false }, shimEnv('unresolvable', tmp)), /base ref/i);
    emptyPass(`module/${g.name}: unresolvable + allowEmpty`, runStub({ ...base, allowEmpty: true }, shimEnv('unresolvable', tmp)));
    emptyPass(`module/${g.name}: trustworthy empty`, runStub({ ...base, allowEmpty: false }, shimEnv('empty', tmp)));
  }
}

// ---- gates layer ----------------------------------------------------------
function gatesLayer(tmp) {
  const failClosed = (label, r, ok, stderrRe) => {
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status !== 0 && !out.includes(ok)) {
      if (stderrRe && !stderrRe.test(out)) {
        return fail(`${label}: non-zero but missing diagnostic; out=${JSON.stringify(out.trim())}`);
      }
      return pass(`${label}: fail-closed (exit=${r.status})`);
    }
    fail(`${label}: expected non-zero + no "${ok}", got status=${r.status} out=${JSON.stringify(out.trim())}`);
  };
  const okPass = (label, r, ok) => {
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status === 0 && out.includes(ok)) return pass(`${label}: ${ok} (exit 0)`);
    fail(`${label}: expected exit 0 + "${ok}", got status=${r.status} out=${JSON.stringify(out.trim())}`);
  };

  for (const g of GATES) {
    failClosed(`gate/${g.name}: failing-git`, runGate(g.script, [], shimEnv('fail', tmp)), g.ok);
    failClosed(`gate/${g.name}: unresolvable base`, runGate(g.script, [], shimEnv('unresolvable', tmp)), g.ok, /base ref/i);
    okPass(`gate/${g.name}: unresolvable + --allow-empty`, runGate(g.script, ['--allow-empty'], shimEnv('unresolvable', tmp)), g.ok);
    okPass(`gate/${g.name}: trustworthy empty`, runGate(g.script, [], shimEnv('empty', tmp)), g.ok);

    // Invalid EXPLICIT base ref is still rejected non-zero, naming the ref (sec-1, real git).
    const badRef = 'no-such-ref-xyzzy';
    const rBad = runGate(g.script, [badRef], process.env);
    const badOut = (rBad.stdout || '') + (rBad.stderr || '');
    if (rBad.status !== 0 && badOut.includes('invalid base ref') && badOut.includes(badRef)) {
      pass(`gate/${g.name}: invalid explicit ref rejected (names ref)`);
    } else {
      fail(`gate/${g.name}: invalid explicit ref expected rejection naming ref, got status=${rBad.status} out=${JSON.stringify(badOut.trim())}`);
    }

    // Explicit `-- file` bypasses the base guard: audits exactly the given file even
    // when git is wholly unusable (fail shim), producing the benign OK verdict.
    const btmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-scope-benign-'));
    okPass(`gate/${g.name}: explicit -- file (bypasses guard under failing-git)`, runGate(g.script, ['--', g.benign(btmp)], shimEnv('fail', tmp)), g.ok);

    // `--all` bypasses the base guard too: its verdict over the real corpus is
    // identical with a broken git and with real git, and never fail-closed on base.
    if (g.all) {
      const rReal = runGate(g.script, ['--all'], process.env);
      const rBroken = runGate(g.script, ['--all'], shimEnv('fail', tmp));
      const outReal = (rReal.stdout || '') + (rReal.stderr || '');
      const outBroken = (rBroken.stdout || '') + (rBroken.stderr || '');
      if (rBroken.status === rReal.status && outBroken === outReal && !/base ref/i.test(outBroken)) {
        pass(`gate/${g.name}: --all bypasses guard (identical verdict under failing-git, exit=${rBroken.status})`);
      } else {
        fail(`gate/${g.name}: --all expected identical verdict under failing-git and no base-ref guard; realStatus=${rReal.status} brokenStatus=${rBroken.status} identical=${outBroken === outReal}`);
      }
    }
  }
}

const mode = process.argv[2];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-scope-'));
if (mode !== '--gates-only') moduleLayer(tmp);
if (mode !== '--module-only') gatesLayer(tmp);

if (failures) {
  console.error(`\ngate-scope: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ngate-scope: OK');
