#!/usr/bin/env node
/**
 * Gate: a roadmap `.html` page's machine-readable `data-updated-at` and its
 * visible `updated:` metadata value must be the same timestamp, so automated
 * and human readers see one update history (bug-6: the two disagreed on a
 * story page after an in-place re-render touched one and not the other).
 *
 * Applies to HTML-mode roadmaps only — the `.md` variants carry `updated_at`
 * once (frontmatter), so there is nothing to diverge. A roadmap built in md
 * mode simply has no `.html` pages and the gate passes (empty scope).
 *
 * Scope is the branch's added/modified `roadmap/**.html` vs the base merge-base
 * (plus untracked), so the long tail of legacy pages generated before the fix
 * is not re-audited. Pass explicit `.html` paths after `--` to check just those,
 * or `--all` to audit every roadmap page. The default (branch) scope is the only
 * mode that needs the orchestrator's shared `.orchestrator/gate-scope.cjs`; the
 * `--all` and explicit-`--` modes are self-contained, so a standalone roadmap
 * (no orchestrator bootstrap) can still run the gate over `--all`.
 *
 *   node roadmap/check-timestamp-parity.cjs [base-ref] [--all] [--allow-empty] [-- file.html ...]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROADMAP = path.join(ROOT, 'roadmap');

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const argv = process.argv.slice(2);
const dashDash = argv.indexOf('--');
const flags = (dashDash >= 0 ? argv.slice(0, dashDash) : argv);
const explicit = dashDash >= 0 ? argv.slice(dashDash + 1) : [];
const baseRef = flags.find((a) => !a.startsWith('--'));
const all = flags.includes('--all');
const allowEmpty = flags.includes('--allow-empty');

const targets = explicit.length
  // Do NOT filter out non-existent explicit paths (bug-2): silently dropping a
  // typo'd `-- roadmap/missing.html` left zero targets and printed OK / exit 0,
  // defeating the fail-closed contract. Resolve them all; the per-target guard
  // below fails closed on a missing / non-regular / non-.html target.
  ? explicit.map((f) => path.resolve(ROOT, f))
  : all ? walk(ROADMAP, [])
  // Branch scope only: lazy-require the orchestrator's shared gate-scope so the
  // self-contained modes above never depend on `.orchestrator/` being present.
  : require('../.orchestrator/gate-scope.cjs').branchScope({
      root: ROOT, auditPath: 'roadmap', ext: '.html', baseRef, label: 'roadmap-timestamp-parity', allowEmpty,
    });

// Safe-target guards (sec-2): an untrusted branch can add a `roadmap/*.html`
// symlink pointing at an external or unbounded file; `readFileSync` would follow
// it, reading outside the repo, leaking matching text in diagnostics, or
// exhausting the runner. So before every read: reject non-regular files
// (symlinks included — `lstat` never follows), require an `.html` suffix, and
// cap the accepted size. Canonical containment (the file's realpath stays under
// the roadmap dir) is additionally enforced for the **auto-discovery** modes
// (`--all` walk / branch scope), where an attacker-planted path is picked up
// automatically. Explicit `-- file.html` targets are a deliberate audit list
// (the regression harness audits tmp fixtures) so they skip only the
// under-roadmap path restriction — they still get the symlink/regular/.html/size
// guards.
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const realOrNull = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const enforceContainment = explicit.length === 0;
const roadmapReal = enforceContainment ? realOrNull(ROADMAP) : null;

const problems = [];
for (const file of targets) {
  const rel = path.relative(ROOT, file);
  let st;
  try { st = fs.lstatSync(file); } catch (e) {
    problems.push(`${rel}: ${e && e.code === 'ENOENT' ? 'missing target (does not exist)' : 'cannot stat target'}`);
    continue;
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    problems.push(`${rel}: not a regular file (symlink / non-file rejected)`);
    continue;
  }
  if (!file.endsWith('.html')) { problems.push(`${rel}: not an .html file`); continue; }
  if (st.size > MAX_HTML_BYTES) {
    problems.push(`${rel}: exceeds ${MAX_HTML_BYTES}-byte size cap (${st.size})`);
    continue;
  }
  if (enforceContainment) {
    const fileReal = realOrNull(file);
    if (roadmapReal == null || fileReal == null ||
        (fileReal !== roadmapReal && !fileReal.startsWith(roadmapReal + path.sep))) {
      problems.push(`${rel}: escapes the roadmap directory`);
      continue;
    }
  }
  const s = fs.readFileSync(file, 'utf8');
  const data = (s.match(/data-updated-at="([^"]*)"/) || [])[1];
  const visible = (s.match(/updated:<\/span>\s*<span class="meta__val">([^<]*)</) || [])[1];
  // Read data-kind from the ROOT <main> opening tag only — NOT from anywhere in
  // the document — so a stray data-kind="roadmap-index" in a comment, script, or
  // nested element on an item page cannot spoof the index exemption (bug-4).
  const rootMain = (s.match(/<main\b[^>]*>/i) || [])[0] || '';
  const kind = (rootMain.match(/data-kind="([^"]*)"/) || [])[1];
  if (data == null && visible == null) {
    // Only the top-level roadmap index legitimately carries neither timestamp —
    // it is a derived aggregate view and self-identifies with a root
    // <main data-kind="roadmap-index">. Every other roadmap page (milestone /
    // phase / story / release-matrix, incl. nested README.html) is an item page
    // that MUST carry both markers, so dropping both is a fail-closed error, not
    // a silent skip (bug-2: keying the skip on "neither marker present" let any
    // page fail open). In the real roadmap tree the index is exactly
    // roadmap/README.html, so containment modes ALSO require that canonical path
    // — an item page whose root main was hand-forged to roadmap-index still fails
    // unless it is literally the index file (bug-4).
    const resolved = path.resolve(ROOT, file);
    const isCanonicalIndex =
      path.basename(resolved) === 'README.html' && path.dirname(resolved) === ROADMAP;
    if (kind === 'roadmap-index' && (!enforceContainment || isCanonicalIndex)) continue;
    problems.push(`${rel}: missing both timestamp markers (data-updated-at + visible updated:)`);
    continue;
  }
  if (data == null) {
    problems.push(`${rel}: missing data-updated-at attribute`);
  } else if (visible == null) {
    problems.push(`${rel}: missing visible updated value`);
  } else if (data !== visible) {
    problems.push(`${rel}: data-updated-at=${data} but visible updated=${visible}`);
  }
}

if (problems.length) {
  console.error(`roadmap-timestamp-parity: ${problems.length} mismatch(es)`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('roadmap-timestamp-parity: OK');
