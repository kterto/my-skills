'use strict';
// The `live` block of PROJECT-CONTEXT's `## Test tooling` (contract §8.1): a YAML subset parsed here, since the engine
// has no dependencies. The parser fails closed: anything outside the subset is an error naming its line, never a guess.
const { ISOLATION } = require('./vocab.cjs');

const KEY = '[A-Za-z0-9_][A-Za-z0-9_-]*';
const LINE = new RegExp(`^( {2})?(${KEY}):( .*)?$`);
const FLOW_KEY = new RegExp(`^(${KEY}): +`);
const BARE = /[A-Za-z0-9_./:@+-]/;
const WORDS = new Map([['true', true], ['false', false], ['null', null]]);

function put(obj, key, value, fail) {
  if (key === '__proto__' || Object.hasOwn(obj, key)) fail(`${key === '__proto__' ? 'reserved' : 'duplicate'} key "${key}"`);
  obj[key] = value;
}

/** One value on one line: a quoted string, a bare scalar or a flow collection; undefined when empty. */
function parseValue(src, fail) {
  let i = 0;
  const skip = () => { while (src[i] === ' ') i++; };
  const quoted = () => {
    const q = src[i++];
    for (let out = ''; ;) {
      if (i >= src.length) fail('unterminated string');
      let c = src[i++];
      if (c === q && !(q === "'" && src[i] === "'")) return out;
      if (c === q || (c === '\\' && q === '"')) { // '' in single quotes; \" or \\ in double quotes
        c = src[i++];
        if (q === '"' && c !== '"' && c !== '\\') fail(`unsupported escape "\\${c || ''}"`);
      }
      out += c;
    }
  };
  const atom = () => {
    if (src[i] === '"' || src[i] === "'") return quoted();
    const start = i;
    while (i < src.length && BARE.test(src[i])) i++;
    const word = src.slice(start, i);
    if (!word) fail(`unexpected ${i < src.length ? `"${src[i]}"` : 'end of line'}`);
    return /^[-+]?\d+(\.\d+)?$/.test(word) ? Number(word) : WORDS.has(word) ? WORDS.get(word) : word;
  };
  const flow = (close, entry) => {
    i++; skip();
    if (src[i] !== close) {
      for (entry(), skip(); src[i] !== close; entry(), skip()) {
        if (src[i] !== ',') fail(`expected "," or "${close}"`);
        i++; skip();
      }
    }
    i++;
  };
  const seq = () => { const out = []; flow(']', () => out.push(atom())); return out; };
  const map = () => {
    const out = {};
    flow('}', () => {
      const m = FLOW_KEY.exec(src.slice(i)) || fail('expected "key: value" in a flow mapping');
      i += m[0].length;
      put(out, m[1], src[i] === '[' ? seq() : atom(), fail);
    });
    return out;
  };
  skip();
  if (i >= src.length || src[i] === '#') return undefined;
  const value = src[i] === '[' ? seq() : src[i] === '{' ? map() : atom();
  skip();
  if (i < src.length && src[i] !== '#') fail(`unexpected "${src.slice(i)}" after the value`);
  return value;
}

/** The grammar alone, without the schema. Throws an Error naming the line. */
function parseSubset(text) {
  const root = {};
  let open = null;
  String(text).split(/\r?\n/).forEach((raw, n) => {
    const fail = (msg) => { throw new Error(`line ${n + 1}: ${msg}`); };
    if (raw.includes('\t')) fail('a tab (indent with two spaces)');
    if (/^ *(#.*)?$/.test(raw)) return;
    const [, indent, key, rest = ''] = LINE.exec(raw) || fail('expected "key: value" at column 0, or a two-space "key: value" under "key:"');
    if (indent && !open) fail('an indented entry outside a mapping');
    const value = parseValue(rest, fail);
    if (value === undefined && indent) fail('mappings nest one level deep');
    put(indent ? open : root, key, value === undefined ? {} : value, fail);
    if (!indent) open = value === undefined ? root[key] : null;
  });
  return root;
}

const DB_BUILD = ['migrate-deploy', 'schema-push', 'none'];
const text = (v) => typeof v === 'string' && v.trim() !== '';
const TYPES = {
  cmd: [text, 'a non-empty command string'], str: [text, 'a non-empty string'],
  minutes: [(v) => typeof v === 'number' && v > 0 && v <= 10080, 'a number > 0, at most 10080 (a week)'], bool: [(v) => typeof v === 'boolean', 'true or false'],
  strs: [(v) => Array.isArray(v) && v.every(text), 'a sequence of non-empty strings'], version: [(v) => v === 1, '1'],
  isolation: [(v) => ISOLATION.includes(v), ISOLATION.join(' | ')], db_build: [(v) => DB_BUILD.includes(v), DB_BUILD.join(' | ')],
  ready: [(v) => typeof v === 'string' && /^(https?:\/\/\S+|cmd:.*\S.*)$/.test(v), 'an http(s) URL or "cmd:<command>"'],
};
// `?` marks an optional key, `{s` a mapping of shape s, and `*s` a mapping of names to shape s.
const SHAPES = {
  block: { version: 'version', isolation: 'isolation', db_build: '?db_build', db: '?{db', services: '?*service',
    allowed_repairs: '?strs', surfaces: '?*surface', flows: '?*flow', readback: '?*store', consent: '?{consent' },
  db: { build: 'cmd', bound_minutes: '?minutes' }, service: { up: 'cmd', ready: 'ready', down: '?cmd', bound_minutes: '?minutes' },
  surface: { kind: 'str', run: 'cmd', entry: '?str' }, flow: { surface: 'str', paths: 'strs' }, store: { run: 'cmd', read_only: 'bool' },
  consent: { prisma_reset: '{prisma_reset' }, prisma_reset: { url: 'str', container: 'str' },
};
const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkShape(value, shape, at) {
  const sub = (k) => (at ? `${at}.${k}` : k);
  if (!isMap(value)) return `${at}: expected a mapping`;
  const unknown = Object.keys(value).find((k) => !Object.hasOwn(SHAPES[shape], k));
  if (unknown !== undefined) return `${sub(unknown)}: unknown key`;
  for (const [k, spec] of Object.entries(SHAPES[shape])) {
    const [, optional, nest, type] = /^(\?)?([{*]?)(\w+)$/.exec(spec);
    if (!Object.hasOwn(value, k)) { if (optional) continue; return `${sub(k)}: required`; }
    const v = value[k];
    const error = nest === '{' ? checkShape(v, type, sub(k))
      : nest !== '*' ? (TYPES[type][0](v) ? null : `${sub(k)}: expected ${TYPES[type][1]}`)
        : isMap(v) ? Object.keys(v).map((n) => checkShape(v[n], type, `${sub(k)}.${n}`)).find(Boolean) : `${sub(k)}: expected a mapping`;
    if (error) return error;
  }
  return null;
}

/** The block per §8.1, or an error string naming a line or a key path. Never throws. */
function parseLiveBlock(source) {
  try {
    const block = parseSubset(source);
    const error = checkShape(block, 'block', '');
    return { block: error ? null : block, error };
  } catch (e) { return { block: null, error: e.message }; }
}

/** The first ```live fence after `## Test tooling` and before the next `## `. Other fences are skipped whole. */
function extractLiveBlock(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  let fence = null;
  for (let i = lines.findIndex((l) => /^## Test tooling\s*$/.test(l)) + 1; i > 0 && i < lines.length; i++) {
    const close = /^(`{3,}|~{3,})\s*$/.exec(lines[i]);
    if (fence) { if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null; }
    else if (lines[i].startsWith('## ')) return null;
    else if (/^```live\s*$/.test(lines[i])) {
      const end = lines.findIndex((l, j) => j > i && /^`{3,}\s*$/.test(l));
      return lines.slice(i + 1, end < 0 ? lines.length : end).join('\n');
    } else fence = (/^(`{3,}|~{3,})/.exec(lines[i]) || [])[1] || null;
  }
  return null;
}

module.exports = { parseLiveBlock, extractLiveBlock, parseSubset };
