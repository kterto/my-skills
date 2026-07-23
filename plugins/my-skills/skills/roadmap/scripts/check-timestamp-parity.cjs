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

// --- Tag-aware HTML scan (bug-1) --------------------------------------------
// A regex over the raw document can be fooled by markup a real HTML parser treats
// as inert or as text: a <main>/marker inside a comment, inside a raw-text element
// (script/style/textarea/title/iframe/noscript), inside a <template> (possibly
// nested), or inside a quoted attribute value (an iframe `srcdoc="<main …>"`). This
// scan consumes those contexts the way a parser would — skipping their contents and
// never mis-reading markup inside a quoted attribute — then locates the single
// body-level <main> and the single `updated:` marker inside its `.meta` block.
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAWTEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title', 'iframe', 'noscript']);

// End index (just past '>') of the start tag beginning at `lt`, honoring quoted
// attribute values so markup inside an attribute is never read as a tag.
function endOfStartTag(html, lt) {
  const n = html.length;
  let j = lt;
  let q = null;
  while (j < n) {
    const c = html[j];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') return j + 1;
    j++;
  }
  return n;
}

// Tokenize to real start/end tags, skipping comments, declarations, and the entire
// contents of raw-text and <template> elements (template nests). Each token:
// { name, kind:'start'|'end', tag, start, end, selfClosed }.
function scanTags(html) {
  const out = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) { const e = html.indexOf('>', lt + 1); i = e < 0 ? n : e + 1; continue; }
    if (html.startsWith('</', lt)) {
      const m = /^<\/([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 64));
      const e = html.indexOf('>', lt);
      const end = e < 0 ? n : e + 1;
      if (m) out.push({ name: m[1].toLowerCase(), kind: 'end', tag: html.slice(lt, end), start: lt, end });
      i = end;
      continue;
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 64));
    if (!m) { i = lt + 1; continue; }
    const name = m[1].toLowerCase();
    const end = endOfStartTag(html, lt);
    const selfClosed = html[end - 2] === '/';
    out.push({ name, kind: 'start', tag: html.slice(lt, end), start: lt, end, selfClosed });
    i = end;
    if (!selfClosed && (RAWTEXT_ELEMENTS.has(name) || name === 'template')) {
      // Skip the element's content to its matching close (template nests).
      let depth = 1;
      while (depth > 0 && i < n) {
        const lower = html.toLowerCase();
        const nextClose = lower.indexOf('</' + name, i);
        if (nextClose < 0) { i = n; break; }
        if (name === 'template') {
          const nextOpen = lower.indexOf('<' + name, i);
          if (nextOpen >= 0 && nextOpen < nextClose) { depth++; i = endOfStartTag(html, nextOpen); continue; }
        }
        depth--;
        const e = html.indexOf('>', nextClose);
        i = e < 0 ? n : e + 1;
      }
      out.push({ name, kind: 'end', tag: '', start: i, end: i });
    }
  }
  return out;
}

// Locate the single body-level <main>; return { mainTag, inner } or { error }.
function extractMain(html) {
  const toks = scanTags(html);
  const stack = [];
  const mains = [];
  for (let t = 0; t < toks.length; t++) {
    const tk = toks[t];
    if (tk.kind === 'start') {
      if (tk.name === 'main') mains.push({ t, tk, parent: stack[stack.length - 1] });
      if (!tk.selfClosed && !VOID_ELEMENTS.has(tk.name)) stack.push(tk.name);
    } else {
      const idx = stack.lastIndexOf(tk.name);
      if (idx >= 0) stack.length = idx;
    }
  }
  if (mains.length !== 1) return { error: `expected exactly one root <main>, found ${mains.length}` };
  const only = mains[0];
  if (only.parent !== 'body') return { error: 'the <main> is not a direct child of <body>' };
  const endTok = toks.find((x, idx) => idx > only.t && x.name === 'main' && x.kind === 'end');
  const inner = html.slice(only.tk.end, endTok ? endTok.start : html.length);
  return { mainTag: only.tk.tag, inner };
}

// Extract the content of the element carrying the `meta` class inside a main's
// inner HTML (word-boundaried, so `meta__key`/`meta__val` never match), by tag
// depth. Returns the block's inner string, or null when there is no `.meta` block.
function metaBlock(inner) {
  const toks = scanTags(inner);
  let mi = -1;
  for (let t = 0; t < toks.length; t++) {
    const tk = toks[t];
    if (tk.kind !== 'start') continue;
    const cls = (tk.tag.match(/class="([^"]*)"/) || [])[1] || '';
    if (/\bmeta\b/.test(cls)) { mi = t; break; }
  }
  if (mi < 0) return null;
  const openName = toks[mi].name;
  let depth = 1;
  let endStart = inner.length;
  for (let t = mi + 1; t < toks.length; t++) {
    const tk = toks[t];
    if (tk.kind === 'start' && tk.name === openName && !tk.selfClosed && !VOID_ELEMENTS.has(tk.name)) depth++;
    else if (tk.kind === 'end' && tk.name === openName) { depth--; if (depth === 0) { endStart = tk.start; break; } }
  }
  return inner.slice(toks[mi].end, endStart);
}

const argv = process.argv.slice(2);
const dashDash = argv.indexOf('--');
const flags = (dashDash >= 0 ? argv.slice(0, dashDash) : argv);
const explicit = dashDash >= 0 ? argv.slice(dashDash + 1) : [];
const baseRef = flags.find((a) => !a.startsWith('--'));
const all = flags.includes('--all');
const allowEmpty = flags.includes('--allow-empty');

// This gate is refreshed on every html write, but its branch-scope runtime
// dependency `.orchestrator/gate-scope.cjs` is refreshed only when orchestrator
// setup reruns — so an upgraded project can pair this hardened gate with an OLDER
// helper that still omits type changes / dangling symlinks. Version-gate the
// dependency: refuse branch scope against an incompatible (or unversioned =
// pre-versioning) helper and fail closed, rather than silently auditing a stale
// scope (arch-1, ADR-0010). The self-contained --all / explicit -- modes need no
// helper and are unaffected.
// The gate accepts only the helper versions it was written against — a CLOSED
// range [MIN, MAX], NOT an open ">= MIN". Per ADR-0010 a SCOPE_API_VERSION bump
// marks a discovery-contract change consumers must not run against, so an
// unknown-NEWER helper (v > MAX) is as incompatible as a stale one (v < MIN): an
// old materialized gate must fail closed against a future v2 helper too, not
// silently accept it (arch-1). Widen MAX only when a new helper version is verified
// compatible with this gate.
const MIN_SCOPE_API = 1;
const MAX_SCOPE_API = 1;
function branchScopeVersioned() {
  const scope = require('../.orchestrator/gate-scope.cjs');
  const v = scope.SCOPE_API_VERSION;
  const supported = MIN_SCOPE_API === MAX_SCOPE_API ? `${MIN_SCOPE_API}` : `${MIN_SCOPE_API}..${MAX_SCOPE_API}`;
  if (typeof v !== 'number' || v < MIN_SCOPE_API || v > MAX_SCOPE_API) {
    const newer = typeof v === 'number' && v > MAX_SCOPE_API;
    console.error(
      `roadmap-timestamp-parity: incompatible .orchestrator/gate-scope.cjs ` +
      `(SCOPE_API_VERSION ${v == null ? 'absent' : v}; this gate supports ${supported}). ` +
      (newer
        ? 'The helper is newer than this gate — re-materialize the roadmap gate (or audit with --all).'
        : 'Re-run orchestrator setup to refresh the helper, or audit with --all.')
    );
    process.exit(1);
  }
  return scope.branchScope({
    root: ROOT, auditPath: 'roadmap', ext: '.html', baseRef, label: 'roadmap-timestamp-parity', allowEmpty,
  });
}

const targets = explicit.length
  // Do NOT filter out non-existent explicit paths (bug-2): silently dropping a
  // typo'd `-- roadmap/missing.html` left zero targets and printed OK / exit 0,
  // defeating the fail-closed contract. Resolve them all; the per-target guard
  // below fails closed on a missing / non-regular / non-.html target.
  ? explicit.map((f) => path.resolve(ROOT, f))
  : all ? walk(ROADMAP, [])
  // Branch scope: version-gated lazy-require of the orchestrator's shared helper.
  : branchScopeVersioned();

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
  // Locate the single body-level <main> with a tag-aware scan (bug-1/bug-2): a
  // decoy <main> in a comment / raw-text element / <template> / quoted attribute is
  // not a real body > main; zero or two+ real mains fails closed.
  const parsed = extractMain(s);
  if (parsed.error) { problems.push(`${rel}: ${parsed.error}`); continue; }
  // The machine-readable timestamp and the kind live ONLY on that root <main>
  // opening tag (bug-3 / bug-4).
  const rootMain = parsed.mainTag;
  const data = (rootMain.match(/data-updated-at="([^"]*)"/) || [])[1];
  const kind = (rootMain.match(/data-kind="([^"]*)"/) || [])[1];
  // Visible timestamp: read markers ONLY from the main's `.meta` block, so a
  // misplaced marker (e.g. in an <aside>) neither counts nor masks a marker that is
  // MISSING from the expected block, and require EXACTLY ONE — an identical or
  // divergent duplicate inside the block fails closed rather than first-match-wins
  // (bug-1/bug-3).
  const meta = metaBlock(parsed.inner);
  const markers = meta == null
    ? []
    : [...meta.matchAll(/updated:<\/span>\s*<span class="meta__val">([^<]*)</g)].map((m) => m[1]);
  if (markers.length > 1) {
    problems.push(`${rel}: expected exactly one visible updated marker in the metadata block, found ${markers.length} (${markers.join(', ')})`);
    continue;
  }
  const visible = markers.length ? markers[0] : undefined;
  if (data == null && visible == null) {
    // Only the top-level roadmap index legitimately carries neither timestamp —
    // it is a derived aggregate view and self-identifies with a root
    // <main data-kind="roadmap-index">. Every other roadmap page (milestone /
    // phase / story / release-matrix, incl. nested README.html) is an item page
    // that MUST carry both markers, so dropping both is a fail-closed error, not
    // a silent skip (bug-2: keying the skip on "neither marker present" let any
    // page fail open). The index is exactly `roadmap/README.html`, so the
    // exemption requires that **canonical path in EVERY mode** — a hand-forged
    // roadmap-index kind on any other page (including an explicitly-audited nested
    // item) still fails; explicit mode no longer bypasses the path check (bug-3,
    // hardening bug-4 which only enforced the path under containment).
    const resolved = path.resolve(ROOT, file);
    const isCanonicalIndex =
      path.basename(resolved) === 'README.html' && path.dirname(resolved) === ROADMAP;
    if (kind === 'roadmap-index' && isCanonicalIndex) continue;
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
