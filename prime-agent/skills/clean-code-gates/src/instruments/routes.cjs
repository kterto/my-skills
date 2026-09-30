'use strict';
const { lineCounter } = require('./graph.cjs');

const DECORATOR_RE = /@(Controller|Get|Post|Put|Patch|Delete|All|Options|Head)\s*\(([^)]*)\)/g;
const STRING_RE = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`$\\]*)`/g;
// Comments are consumed first, so a quote inside one never opens a literal.
const LITERAL_RE = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\[\s\S])*)`/g;
const CONST_RE = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`$\\\n]*)`)/g;
const CALL_RE = /\.(get|post|put|patch|delete)\s*\(\s*$/;
// Only a template that builds a path from its head counts: `${BASE}/…`, `${URL}?…` or `${URL}`.
const HEAD_RE = /^\$\{\s*([A-Za-z_$][\w$]*)\s*\}(?=[/?#]|$)/;

const strings = (src) => [...src.matchAll(STRING_RE)].map(m => m[1] ?? m[2] ?? m[3]);
const segments = (p) => p.split('/').filter(Boolean);

/** `{ method, path, file, line }` per method decorator; each belongs to the nearest `@Controller(` above it. */
function controllerRoutes(file, text) {
  const lineAt = lineCounter(text);
  const routes = [];
  let prefixes = null;
  for (const m of text.matchAll(DECORATOR_RE)) {
    const line = lineAt(m.index);
    if (m[1] === 'Controller') {
      const arg = m[2].trim();
      const found = strings(arg.startsWith('{') ? (/\bpath\s*:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/.exec(arg) || [])[1] || '' : arg);
      prefixes = found.length ? found : [''];
    } else if (prefixes) {
      const method = m[1] === 'All' ? '*' : m[1].toUpperCase();
      const sub = strings(m[2])[0] || '';
      for (const p of prefixes) routes.push({ method, path: `/${segments(`${p}/${sub}`).join('/')}`, file, line });
    }
  }
  return routes;
}

/**
 * Every string or template literal that reads as a path. `${…}` becomes the one-segment wildcard
 * `:`, `?…` and `#…` are cut, and the method is that of the `.get(`/`.post(`/… call the literal
 * opens on its line or the line before, else `*` (table-driven calls).
 */
function callSites(text) {
  const consts = new Map([...text.matchAll(CONST_RE)].map(m => [m[1], m[2] ?? m[3] ?? m[4]]));
  const lineAt = lineCounter(text);
  const sites = [];
  let unresolved = 0;
  for (const m of text.matchAll(LITERAL_RE)) {
    let lit = m[1] ?? m[2] ?? m[3];
    if (lit === undefined) continue;
    if (m[3] !== undefined) {
      const head = HEAD_RE.exec(lit);
      if (head && !consts.has(head[1])) { unresolved++; continue; }
      if (head) lit = consts.get(head[1]) + lit.slice(head[0].length);
      lit = lit.replace(/\$\{[^}]*\}/g, '\0');
    }
    if (!lit.startsWith('/')) continue;
    const lineStart = text.lastIndexOf('\n', m.index - 1);
    const call = CALL_RE.exec(text.slice(text.lastIndexOf('\n', lineStart - 1) + 1, m.index));
    const segs = segments(lit.split(/[?#]/)[0]).map(s => (s.includes('\0') || s.startsWith(':') ? ':' : s));
    sites.push({ method: call ? call[1].toUpperCase() : '*', segs, line: lineAt(m.index) });
  }
  return { sites, unresolved };
}

/** Segments pair up one to one; a route `:x` or a call-site `:` matches any one segment. */
function matchRoute(route, site) {
  if (route.method !== '*' && site.method !== '*' && route.method !== site.method) return false;
  const segs = segments(route.path);
  return segs.length === site.segs.length
    && segs.every((s, i) => s.startsWith(':') || site.segs[i] === ':' || s === site.segs[i]);
}

module.exports = { controllerRoutes, callSites, matchRoute };
