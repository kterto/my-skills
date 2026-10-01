'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { byCodeUnit, redact } = require('./envelope.cjs');
const { lineCounter } = require('./graph.cjs');

const EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const GAP = /[\s;]*/y;
const DECO = /@(\w+(?:\.\w+)*)\s*/y;
const CLASS = /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)([^{]*)\{/y;
const PROP = /(?:(?:public|protected|private|readonly|declare|override|abstract)\s+)*(\w+)[?!]?\s*[:=]/y;
const IMPORT = /\b(?:import|export)\s+(?:type\s+)?([\w$\s{},*]+?)\s*from\s*['"]([^'"\n]+)['"]/g;
const NULLABLE = /\bnullable\s*:\s*true\b/;
const at = (re, s, i) => { re.lastIndex = i; return re.exec(s); };
const until = (s, what, from) => { const k = s.indexOf(what, from); return k < 0 ? s.length : k; };
const blankOut = (s) => s.replace(/[^\n]/g, ' ');

// Blanks comments (and, with `blank`, literal bodies) but keeps every newline, so offsets and lines
// still hold and a `(` or `//` inside a literal cannot unbalance the walk. `/` after an operator is a regex.
function strip(src, blank) {
  let out = '';
  for (let i = 0, j, prev = ''; i < src.length; i = j) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    j = i + 1;
    if (two === '//' || two === '/*') {
      j = two === '//' ? until(src, '\n', i) : until(src, '*/', i + 2) + 2;
      out += blankOut(src.slice(i, j));
    } else if ('\'"`'.includes(c) || (c === '/' && /^$|[(,=:[!&|?{};]/.test(prev))) {
      while (j < src.length && src[j] !== c && (c === '`' || src[j] !== '\n')) j += src[j] === '\\' ? 2 : 1;
      const body = src.slice(i + 1, j);
      if (src[j] === c) j++;
      out += c + (blank ? blankOut(body) : body) + src.slice(i + 1 + body.length, j);
      prev = c;
    } else {
      out += c;
      if (!/\s/.test(c)) prev = c;
    }
  }
  return out;
}

// Past the bracket closing the one at `i`; with `member`, past the `;` or newline ending the member at `i`.
function end(s, i, member) {
  for (let depth = 0; i < s.length; i++) {
    if ('({['.includes(s[i])) depth++;
    else if (')}]'.includes(s[i]) && --depth === 0 && !member) return i + 1;
    else if (member && depth <= 0 && (s[i] === ';' || s[i] === '\n')) return i + 1;
  }
  return i;
}

// Pairs each class and property with the decorators before it. A decorator runs until its
// parentheses balance, so one line may hold several, and the property they decorate.
function walk(s, from, to, lineAt, owner) {
  const found = [];
  let pending = [];
  for (let i = from; (i = at(GAP, s, i) && GAP.lastIndex) < to;) {
    const d = s[i] === '@' && at(DECO, s, i);
    if (d) {
      const stop = s[DECO.lastIndex] === '(' ? end(s, DECO.lastIndex) : DECO.lastIndex;
      pending.push({ name: d[1], text: s.slice(i, stop) });
      i = stop;
      continue;
    }
    const c = at(CLASS, s, i);
    const p = !c && owner && at(PROP, s, i);
    const decos = pending;
    pending = [];
    if (p) owner.props.push({ name: p[1], line: lineAt(i), decos });
    if (!c) { i = end(s, i, true); continue; }
    const cls = { name: c[1], head: c[2], at: CLASS.lastIndex - 1, decos, props: [] };
    i = end(s, CLASS.lastIndex - 1);
    found.push(cls, ...walk(s, CLASS.lastIndex, i - 1, lineAt, cls));
  }
  return found;
}

// Named and default imports by name; a namespace import (`* as cv`) as `cv.`, which validates every `@cv.X(`.
const names = (clause) => [...(/^\s*(\w+)\s*(?:,|$)/.exec(clause) || []).slice(1), ...(/\*\s*as\s+(\w+)/.exec(clause) || []).slice(1).map((n) => `${n}.`),
  ...((/\{([^}]*)\}/.exec(clause) || [])[1] || '').split(',')
    .map((part) => /^\s*(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(part)).filter(Boolean).map((m) => m[2] || m[1])];

// A relative specifier resolves against its file; any other (`@/x`, `src/x`) in each directory above it, whole or minus the alias.
function resolve(from, spec, known) {
  const up = path.posix.dirname(from).split('/').map((_, i, a) => a.slice(0, a.length - i).join('/')).concat('.');
  const bases = spec.startsWith('.') ? [path.posix.join(up[0], spec)] : up.flatMap((d) => [spec, spec.slice(spec.indexOf('/') + 1)].map((s) => path.posix.join(d, s)));
  return bases.flatMap((b) => [b, ...EXTS.map((e) => b + e), ...EXTS.map((e) => `${b}/index${e}`)]).find((f) => known.has(f));
}

// V holds every name imported from `validators_from`, or from a repo module whose source has a `validator_markers`
// string. Ancestors are `extends X` and `extends <inherit>(X, …)`, recursively; any other call hides what it wraps.
function decoratedFields(shape, files, read, known) {
  const V = new Set();
  const classes = [];
  const marked = new Map();
  const isValidatorModule = (file, spec) => {
    if ((shape.validators_from || []).includes(spec)) return true;
    const target = resolve(file, spec, known);
    if (target && !marked.has(target)) marked.set(target, (shape.validator_markers || []).some((m) => (read(target) ?? '').includes(m)));
    return Boolean(target && marked.get(target));
  };
  for (const file of files) {
    const src = read(file) ?? '';
    const kept = strip(src, false);
    for (const [, clause, spec] of kept.matchAll(IMPORT)) if (isValidatorModule(file, spec)) names(clause).forEach((n) => V.add(n));
    // The head keeps its literals: PickType and OmitType name their keys in strings.
    classes.push(...walk(strip(src, true), 0, src.length, lineCounter(src), null).map((c) => ({ ...c, file, head: kept.slice(c.at - c.head.length, c.at) })));
  }
  const byName = new Map();
  for (const c of classes) byName.set(c.name, [...(byName.get(c.name) || []), c]);
  const valid = (p) => p.decos.some((d) => V.has(d.name) || V.has(d.name.slice(0, d.name.indexOf('.') + 1)));
  // Each ancestor with the keys it passes on (PickType keeps its list, OmitType drops it); inner calls fold first into `#<i>`.
  const parents = (c) => {
    let ext = (/\bextends\s+([\s\S]*?)\s*(?:\bimplements\b[\s\S]*)?$/.exec(c.head) || [])[1] || '';
    if (!/^\w+\s*\(/.test(ext)) ext = /^\w*/.exec(ext)[0];
    const refs = [];
    const bind = (args, keep = () => true) => args.replace(/\[[^\]]*\]/g, ' ').replace(/#(\d+)|\w+/g, (m, i) => {
      if (i) refs[i].keeps.push(keep);
      return i ? m : byName.has(m) ? `#${refs.push({ name: m, keeps: [keep] }) - 1}` : ' ';
    });
    const fold = (_, fn, args) => {
      const keys = [...((/\[([^\]]*)\]/.exec(args) || [])[1] || '').matchAll(/['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
      const keep = fn === 'PickType' ? (p) => keys.includes(p) : fn === 'OmitType' ? (p) => !keys.includes(p) : undefined;
      return (shape.inherit || []).includes(fn) ? ` ${bind(args, keep)} ` : ' ';
    };
    for (let was; was !== ext;) [was, ext] = [ext, ext.replace(/(\w+)\s*\(([^()]*)\)/g, fold)];
    return [...bind(ext).matchAll(/#(\d+)/g)].map((m) => refs[m[1]]);
  };
  const inherited = (c, prop, seen) => parents(c).some(({ name, keeps }) => keeps.every((k) => k(prop)) && byName.get(name)
    .some((a) => !seen.has(a) && seen.add(a) && (a.props.some((x) => x.name === prop && valid(x)) || inherited(a, prop, seen))));
  const hits = [];
  for (const c of classes.filter((k) => k.decos.some((d) => shape.classes.includes(d.name)))) {
    for (const p of c.props) {
      const field = p.decos.find((d) => d.name === shape.field);
      const check = !field ? null : !valid(p) ? !inherited(c, p.name, new Set([c])) && 'undecorated'
        : NULLABLE.test(field.text) && !p.decos.some((d) => (shape.optional || []).includes(d.name)) && 'nullable-without-optional';
      if (check && shape.checks.includes(check)) hits.push({ file: c.file, line: p.line, text: `${c.name}.${p.name}`, check });
    }
  }
  return hits;
}

function regexHits(shape, files, read) {
  const re = new RegExp(shape.pattern, `${(shape.flags || '').replace('g', '')}g`);
  const hits = [];
  for (const file of files) {
    const src = read(file) ?? '';
    const lineAt = lineCounter(src);
    for (const m of src.matchAll(re)) hits.push({ file, line: lineAt(m.index), text: redact(m[0].split('\n')[0]).slice(0, 200), check: 'regex' });
  }
  return hits;
}

/** Runs a §7.2 shape over `files` (filtered by its globs); `read(rel)` gives text or null; imports resolve among `listed`. */
function evaluate(shape, files, read, listed = files) {
  const hits = (shape.type === 'regex' ? regexHits : decoratedFields)(shape, files, read, new Set(listed));
  hits.sort((a, b) => byCodeUnit(a.file, b.file) || a.line - b.line || byCodeUnit(a.check, b.check));
  return { visited: files.length, hits };
}

/** Reads repo-relative files, through an overlay of planted text when there is one. */
const reader = (root, overlay) => (rel) => {
  if (overlay && overlay.has(rel)) return overlay.get(rel);
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; }
};

module.exports = { evaluate, reader };
