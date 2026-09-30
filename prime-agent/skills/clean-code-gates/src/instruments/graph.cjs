'use strict';
const fs = require('node:fs');
const path = require('node:path');

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.dart'];
// NodeNext and ESM specifiers name the emitted file: `./x.js` is `x.ts` or `x.tsx` in the source tree.
const EMITTED = { '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };
const IGNORE = Symbol('ignore');

// `import … from`, `import '…'`, `export … from`, then `import(`, `require(` and `jest.mock(`.
// The `from` clause may span lines but never a quote, `;` or parenthesis, so it stays in one statement.
const TS_RE = /\b(?:import|export)\s+(?:[^'"`;()]*?\s+from\s+)?(['"])([^'"\n]+)\1|\b(?:import|require|jest\.mock)\s*\(\s*(['"])([^'"\n]+)\3/g;
const DART_RE = /^[ \t]*(import|export|part(?:\s+of)?)\s+(['"])([^'"\n]+)\2/gm;

const readText = (abs) => { try { return fs.readFileSync(abs, 'utf8'); } catch { return null; } };

/** Maps an offset to its 1-based line: offsets met in increasing order cost one pass; one that goes back recounts. */
function lineCounter(text) {
  let [at, line] = [0, 1];
  return (pos) => { if (pos < at) [at, line] = [0, 1]; for (; at < pos; at++) if (text.charCodeAt(at) === 10) line++; return line; };
}

/** JSONC: a BOM, comments and trailing commas go, but never inside a string (`"@/*"` is a path, not a comment). */
function readJsonc(abs) {
  try {
    return JSON.parse(readText(abs).replace(/^\uFEFF/, '')
      .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, s) => s || '')
      .replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (m, s, tail) => s || tail));
  } catch { return null; } // unreadable, or not JSON
}

/** baseUrl and paths after one level of relative `extends`; each resolves against the file that declares it. */
function loadTsconfig(root, rel) {
  const own = readJsonc(path.join(root, rel));
  if (!own) return null;
  const dir = path.posix.dirname(rel);
  let parent = {};
  let pdir = dir;
  if (typeof own.extends === 'string' && own.extends.startsWith('.')) {
    const p = path.posix.join(dir, own.extends);
    parent = readJsonc(path.join(root, p)) || readJsonc(path.join(root, `${p}.json`)) || {};
    pdir = path.posix.dirname(p);
  }
  const co = own.compilerOptions || {};
  const pco = parent.compilerOptions || {};
  const baseUrl = co.baseUrl != null ? path.posix.join(dir, co.baseUrl)
    : pco.baseUrl != null ? path.posix.join(pdir, pco.baseUrl) : null;
  return { baseUrl, paths: co.paths || pco.paths || null, pathsBase: baseUrl ?? (co.paths ? dir : pdir) };
}

function capture(pattern, spec) {
  const star = pattern.indexOf('*');
  if (star < 0) return pattern === spec ? '' : null;
  const [pre, post] = [pattern.slice(0, star), pattern.slice(star + 1)];
  const fits = spec.length >= pre.length + post.length && spec.startsWith(pre) && spec.endsWith(post);
  return fits ? spec.slice(pre.length, spec.length - post.length) : null;
}

function specifiers(file, text) {
  const lineAt = lineCounter(text);
  if (file.endsWith('.dart')) {
    return [...text.matchAll(DART_RE)].map(m => ({ spec: m[3], line: lineAt(m.index), part: m[1].startsWith('part') }));
  }
  return [...text.matchAll(TS_RE)].map(m => ({ spec: m[2] || m[4], line: lineAt(m.index), part: false }));
}

function makeResolver(root, files, texts) {
  const listed = new Set(files);
  const pkgs = new Map();
  for (const f of files.filter(f => path.posix.basename(f) === 'pubspec.yaml')) {
    const m = /^name:\s*['"]?(\w+)/m.exec(readText(path.join(root, f)) || '');
    if (m) pkgs.set(m[1], path.posix.dirname(f));
  }
  const workspace = new Set(files.filter(f => path.posix.basename(f) === 'package.json').map(f => (readJsonc(path.join(root, f)) || {}).name));
  const tsconfigs = new Map();
  const tsconfigFor = (dir) => {
    if (!tsconfigs.has(dir)) {
      const rel = path.posix.join(dir, 'tsconfig.json');
      tsconfigs.set(dir, fs.existsSync(path.join(root, rel)) ? loadTsconfig(root, rel)
        : dir === '.' ? null : tsconfigFor(path.posix.dirname(dir)));
    }
    return tsconfigs.get(dir);
  };
  // A listed path absent from disk is a deleted changed file: still a target, marked missing.
  const lookup = (base) => {
    const emitted = (EMITTED[path.posix.extname(base)] || []).map(e => base.replace(/\.\w+$/, e));
    for (const c of [base, ...emitted, ...EXTS.map(e => base + e), ...EXTS.map(e => `${base}/index${e}`)]) {
      if (!listed.has(c)) continue;
      const present = texts.has(c) || (!EXTS.includes(path.posix.extname(c)) && fs.existsSync(path.join(root, c)));
      return { to: c, missing: !present };
    }
    return null;
  };
  return (file, spec) => {
    const dir = path.posix.dirname(file);
    if (file.endsWith('.dart')) {
      const pkg = /^package:([^/]+)\/(.+)$/.exec(spec);
      if (!pkg) return spec.startsWith('dart:') ? IGNORE : lookup(path.posix.join(dir, spec));
      return pkgs.has(pkg[1]) ? lookup(path.posix.join(pkgs.get(pkg[1]), 'lib', pkg[2])) : IGNORE;
    }
    if (spec.startsWith('.')) return lookup(path.posix.join(dir, spec));
    const cfg = tsconfigFor(dir);
    // As tsc: an exact pattern first, else the one with the longest prefix before its `*`.
    const rank = (p) => (p.includes('*') ? p.indexOf('*') : Infinity);
    const hit = cfg && cfg.paths && Object.entries(cfg.paths).filter(([p]) => capture(p, spec) !== null)
      .reduce((best, e) => (best && rank(best[0]) >= rank(e[0]) ? best : e), null);
    if (hit) {
      const cap = capture(hit[0], spec);
      for (const sub of [].concat(hit[1])) {
        const r = lookup(path.posix.join(cfg.pathsBase, sub.replace('*', cap)));
        if (r) return r;
      }
      return null;
    }
    // A bare specifier naming a workspace package is an edge this graph cannot follow: counted, never ignored.
    const pkg = spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
    return (cfg && cfg.baseUrl !== null && lookup(path.posix.join(cfg.baseUrl, spec))) || (workspace.has(pkg) ? null : IGNORE);
  };
}

/**
 * Nodes are the listed files with a graph extension; an edge may also end at any other listed
 * file (a JSON fixture). Bare packages are ignored, bar the repo's own; any other specifier that
 * resolves nowhere is counted per file in `unresolved`. A part and its library are linked both ways.
 */
function buildGraph(root, files) {
  const texts = new Map();
  for (const f of files.filter(f => EXTS.includes(path.posix.extname(f)))) {
    const text = readText(path.join(root, f));
    if (text !== null) texts.set(f, text);
  }
  const resolve = makeResolver(root, files, texts);
  const found = new Map();
  const back = new Set();
  const unresolved = new Map();
  const add = (from, to, line, missing, isBack) => {
    const key = `${from}\0${to}`;
    if (found.has(key) && (isBack || !back.has(key))) return;
    if (isBack) back.add(key); else back.delete(key);
    found.set(key, missing ? { to, line, missing: true } : { to, line });
  };
  for (const [file, text] of texts) {
    for (const { spec, line, part } of specifiers(file, text)) {
      const r = resolve(file, spec);
      if (r === IGNORE) continue;
      if (!r) unresolved.set(file, (unresolved.get(file) || 0) + 1);
      else {
        add(file, r.to, line, r.missing, false);
        if (part) add(r.to, file, line, false, true);
      }
    }
  }
  const edges = new Map([...texts.keys()].map(f => [f, []]));
  const rev = new Map();
  for (const key of [...found.keys()].sort()) {
    const from = key.slice(0, key.indexOf('\0'));
    const edge = found.get(key);
    (edges.get(from) || edges.set(from, []).get(from)).push(edge);
    (rev.get(edge.to) || rev.set(edge.to, []).get(edge.to)).push({ from, line: edge.line });
  }
  return { edges, rev, unresolved };
}

const unwind = (links, file) => { const chain = []; for (let f = file; f !== null; f = links.get(f)) chain.push(f); return chain; };

/** Forward BFS to the nearest target. `skip` blocks passing through a file, never a target or the start. */
function shortestChain(graph, from, targets, { skip = () => false } = {}) {
  const prev = new Map([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (targets.has(cur)) return unwind(prev, cur).reverse();
    if (cur !== from && skip(cur)) continue;
    for (const { to } of graph.edges.get(cur) || []) if (!prev.has(to)) { prev.set(to, cur); queue.push(to); }
  }
  return null;
}

/** Reverse multi-source BFS: every non-target file that reaches a target, with its shortest chain to one. */
function importersOf(graph, targets, { skip = () => false } = {}) {
  const next = new Map();
  const queue = [...targets].sort();
  for (const t of queue) next.set(t, null);
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (!targets.has(cur) && skip(cur)) continue;
    for (const { from } of graph.rev.get(cur) || []) if (!next.has(from)) { next.set(from, cur); queue.push(from); }
  }
  const out = new Map();
  for (const f of next.keys()) if (!targets.has(f)) out.set(f, unwind(next, f));
  return out;
}

module.exports = { buildGraph, shortestChain, importersOf, lineCounter };
