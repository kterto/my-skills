'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { resolveBase, showFile } = require('./git.cjs');
const { stableJson, byCodeUnit } = require('./envelope.cjs');
const V = require('./vocab.cjs');

const CONFIG = '.cleancode-gates.json';
const CONTEXT = '.orchestrator/PROJECT-CONTEXT.md';
const R = true;

// Predicates answer true, false, or a nested error string that already names its path.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v !== '';
const all = (ok) => (v) => Array.isArray(v) && v.every(ok);
const some = (ok) => (v) => all(ok)(v) && v.length > 0;
const one = (...values) => (v) => values.includes(v);
// Minutes: above 0 and at most a week, so every bound fits a timer (2^31-1 ms is about 24.8 days).
const minutes = (v) => typeof v === 'number' && v > 0 && v <= 10080;
const rel = (v) => str(v) && !path.isAbsolute(v) && !v.split('/').includes('..');
const id = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(v);
const env = (v) => isObj(v) && Object.values(v).every((x) => typeof x === 'string');
const re = (v) => { try { return str(v) && Boolean(new RegExp(v)); } catch { return false; } };
const obj = (spec) => (v, p) => check(v, spec, p) || true;
const list = (spec) => (v, p) => Array.isArray(v) && (v.map((x, i) => check(x, spec, `${p}[${i}]`)).find(Boolean) || true);
// Fails closed: a missing or wrong value first, then any key the spec does not name.
function check(o, spec, p) {
  if (!isObj(o)) return `${p}: must be an object`;
  for (const [k, [ok, required]] of Object.entries(spec)) {
    if (o[k] === undefined && required) return `${p}.${k}: required`;
    const r = o[k] === undefined || ok(o[k], `${p}.${k}`);
    if (r !== true) return typeof r === 'string' ? r : `${p}.${k}: invalid value ${JSON.stringify(o[k])}`;
  }
  const unknown = Object.keys(o).find((k) => !Object.hasOwn(spec, k));
  return unknown === undefined ? null : `${p}.${unknown}: unknown key`;
}

const TIER = {
  id: [id, R], cwd: [rel, R], run: [str, R], report: [one('jest-json', 'junit', 'flutter-json', 'exit-code'), R],
  scope: [one('whole', 'change-selected'), R], bound_minutes: [minutes, R], isolation: [one(...V.ISOLATION)],
  env: [env], rerun: [str], cleanup: [str], whole_run: [str], runner_cwd: [(v) => str(v) && path.isAbsolute(v)],
  cache_scope: [one('tree', 'cwd')], whole_minutes: [minutes],
  select: [obj({ tests: [some(str), R], sources: [some(str), R], by: [some(one('imports', 'routes'))],
    max: [(v) => Number.isInteger(v) && v > 0], whole_on: [all(str)] })],
  base: [obj({ mode: [one('worktree', 'inherit-only')], prepare: [str], prepare_minutes: [minutes], env: [env] })],
};
function validateTier(t, p) {
  const selected = isObj(t) && t.scope === 'change-selected';
  const rule = (broken, message) => (broken ? `${p}.${message}` : null);
  return check(t, TIER, p) || rule(selected && !t.select, 'select: required when scope is change-selected')
    || rule(selected && !t.whole_run, 'whole_run: required when scope is change-selected')
    || rule(!selected && t.select, 'select: only allowed when scope is change-selected')
    || rule(!selected && t.whole_minutes !== undefined, 'whole_minutes: only allowed when scope is change-selected')
    || rule(t.runner_cwd && t.base && t.base.mode === 'worktree', 'runner_cwd: a fixed runner path cannot run a worktree base');
}
const SHAPES = {
  regex: { files: [some(str), R], exclude: [all(str)], pattern: [re, R], flags: [(v) => /^(?!.*(.).*\1)[gimsu]*$/.test(v)] },
  'decorated-fields': { files: [some(str), R], exclude: [all(str)], classes: [some(str), R], field: [str, R],
    validators_from: [all(str)], validator_markers: [all(str)], inherit: [all(str)], optional: [all(str)],
    checks: [some(one('undecorated', 'nullable-without-optional')), R] },
};
// A regex shape must also compile under its own flags: `u` refuses escapes and quantifiers plain mode accepts.
const flagged = (s, p) => { try { return new RegExp(s.pattern, s.flags) && null; } catch (e) { return `${p}.pattern: ${e.message}`; } };
function validateShape(s, p) {
  if (isObj(s) && !V.SHAPE_TYPES.includes(s.type)) return `${p}.type: must be one of ${V.SHAPE_TYPES.join(', ')}`;
  return check(s, { type: [str, R], ...SHAPES[isObj(s) ? s.type : 'regex'] }, p) || (s.type === 'regex' ? flagged(s, p)
    : s.checks.includes('nullable-without-optional') && !(s.optional || []).length
      ? `${p}.optional: required when checks include nullable-without-optional` : null);
}
const CLASS = { shape: [str, R], pattern: [str, R], confirm: [str, R] };
const PLANT = { name: [str, R], file: [rel, R], find: [str, R], replace: [(v) => typeof v === 'string', R],
  expect: [one('red', 'green'), R] };
const BLOCKS = {
  shape: (v, p) => validateShape(v, p) || true,
  command: obj({ cwd: [rel, R], run: [str, R], bound_minutes: [minutes, R] }),
  consumers: obj({ trigger: [some(str), R], files: [some(str), R], exclude: [all(str)], patterns: [all(re)] }),
};
function validateGuard(g, p) {
  const spec = { id: [id, R], kind: [one(...V.GUARD_KINDS), R], class: [obj(CLASS), R], plants: [list(PLANT)],
    added: [str], by: [str] };
  if (isObj(g) && V.GUARD_KINDS.includes(g.kind)) spec[g.kind] = [BLOCKS[g.kind], R];
  return check(g, spec, p);
}

const BARRIER = { on_timeout: [one(...V.ON_TIMEOUT)], tiers: [Array.isArray] };
const duplicate = (xs) => xs.map((x) => x.id).find((x, i, ids) => ids.indexOf(x) !== i);
const byId = (x, y) => byCodeUnit(x.id, y.id);
// [config, null] or [null, why it is invalid]. An entry `anchored(list, id)` names is not validated: the base's runs.
function configOf(c, anchored = () => false) {
  if (!isObj(c)) return [null, 'must be a JSON object'];
  const { barrier = null, guards = [] } = c;
  const entries = (xs, p, validate) => xs.map((x, i) => (isObj(x) && anchored(p, x.id) ? null : validate(x, `${p}[${i}]`)))
    .find(Boolean) || (duplicate(xs) === undefined ? null : `${p}: duplicate id "${duplicate(xs)}"`);
  const e = (barrier === null ? null : check(barrier, BARRIER, 'barrier') || entries(barrier.tiers || [], 'barrier.tiers', validateTier))
    || (Array.isArray(guards) ? entries(guards, 'guards', validateGuard) : 'guards: must be an array');
  return e ? [null, e] : [{ barrier: { on_timeout: (barrier && barrier.on_timeout) || 'not-done', tiers: (barrier && barrier.tiers) || [] }, guards }, null];
}
function readConfig(text, anchored) {
  try { return configOf(text === null ? {} : JSON.parse(text), anchored); } catch (e) { return [null, `invalid JSON (${e.message})`]; }
}
const strict = ([config, e], label) => { if (e) throw new Error(`${label}: ${e}`); return config; };
function readLive(text, lb) {
  const block = text === null ? null : lb().extractLiveBlock(text);
  return block == null ? null : { text: block, ...lb().parseLiveBlock(block) };
}

// Time bounds are not anchored: each takes max(base, working), so a branch may lengthen
// a bound and never shorten it. raise() lifts the base copy in place; true if any differed.
const BOUNDS = { bound_minutes: 10, prepare_minutes: 15, whole_minutes: 0 }; // an absent whole_minutes is no bound
const unbound = (v) => JSON.parse(JSON.stringify(v, (k, x) => (Object.hasOwn(BOUNDS, k) ? undefined : x)));
const differ = (b, w) => stableJson(unbound(b)) !== stableJson(unbound(w));
function raise(b, w) {
  let moved = false;
  for (const k of new Set([...Object.keys(b), ...Object.keys(w)])) {
    if (!Object.hasOwn(BOUNDS, k)) moved = (isObj(b[k]) && isObj(w[k]) && raise(b[k], w[k])) || moved;
    else if (b[k] !== w[k]) { b[k] = Math.max(b[k] ?? BOUNDS[k], ...[w[k] ?? BOUNDS[k]].filter(minutes)); moved = true; }
  }
  return moved;
}
const move = (key, change, direction) => ({ key, change, direction });
// The base definition always runs; a working-tree entry counts only under a new id.
function anchorList(prefix, base, work, moves) {
  const added = new Map(work.map((e) => [e.id, e]));
  for (const e of base) {
    const w = added.get(e.id);
    added.delete(e.id);
    if (!w) moves.push(move(`${prefix}.${e.id}`, 'removed', 'loosening'));
    else if (differ(e, w)) moves.push(move(`${prefix}.${e.id}`, 'changed', 'changed'));
    if (w && raise(e, w)) moves.push(move(`${prefix}.${e.id}.bound_minutes`, 'changed', 'changed'));
  }
  for (const e of added.values()) moves.push(move(`${prefix}.${e.id}`, 'added', 'tightening'));
  return [...base, ...added.values()];
}
// Consent is honoured only from the anchored block, so a branch-added block loses it.
const CONSENT = /^consent[ \t]*:.*(?:\n(?:[ \t]*$|[ \t]+\S.*|#.*))*\n?/m;
function anchorLive(b, w, moves) {
  if (!b && w) {
    moves.push(move('live', 'added', 'tightening'));
    const { consent: _dropped, ...block } = w.block || {};
    return { text: w.text.replace(CONSENT, ''), block: w.block && block, error: w.error };
  }
  if (b && !w) moves.push(move('live', 'removed', 'loosening'));
  if (!b || !w) return b;
  if (b.block && w.block ? differ(b.block, w.block) : b.text !== w.text) moves.push(move('live', 'changed', 'changed'));
  if (b.block && w.block && raise(b.block, w.block)) moves.push(move('live.bound_minutes', 'changed', 'changed'));
  return b;
}

// An empty tier set resolves to no barrier at all, never to one that runs nothing and passes. A tier
// whose cwd is missing still loads: the barrier types it at run time, and no other kind depends on it.
function resolved(source, from, { barrier, guards, live }, moves) {
  const tiers = barrier.tiers.sort(byId);
  const inst = { barrier: tiers.length ? { on_timeout: barrier.on_timeout, tiers } : null, guards: guards.sort(byId), live };
  const digest = crypto.createHash('sha256').update(stableJson({ ...inst, live: live && live.text })).digest('hex');
  return { source, from, digest, moves: moves.sort((x, y) => byCodeUnit(x.key, y.key)), ...inst };
}
function fromFile(root, from, lb) {
  let f;
  try { f = JSON.parse(fs.readFileSync(path.resolve(root, from.slice('file:'.length)), 'utf8')); }
  catch (e) { throw new Error(`--instruments-from ${from}: ${e.message}`); }
  const e = check(f, { barrier: [() => true], guards: [() => true], live: [(v) => v === null || typeof v === 'string'] }, from);
  if (e) throw new Error(e);
  const live = f.live == null ? null : { text: f.live, ...lb().parseLiveBlock(f.live) };
  return resolved('instruments-from', from, { ...strict(configOf(f), from), live }, []);
}
function loadInstruments(root, { baseSha, from = null, liveblock, warn = () => {} } = {}) {
  const lb = () => liveblock || require('./liveblock.cjs');
  if (from && from.startsWith('file:')) return fromFile(root, from, lb);
  if (from) {
    const { sha } = resolveBase(root, from);
    const inst = strict(readConfig(showFile(root, sha, CONFIG)), `${CONFIG} at ${from}`);
    return resolved('instruments-from', from, { ...inst, live: readLive(showFile(root, sha, CONTEXT), lb) }, []);
  }
  const disk = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; } };
  const [baseConfig, baseContext] = [showFile(root, baseSha, CONFIG), showFile(root, baseSha, CONTEXT)];
  const b = strict(readConfig(baseConfig), `${CONFIG} at base ${baseSha.slice(0, 12)}`);
  const ids = { 'barrier.tiers': b.barrier.tiers, guards: b.guards };
  let [w, invalid] = readConfig(disk(CONFIG), (list, id) => ids[list].some((x) => x.id === id));
  const moves = [];
  // A branch cannot take the instruments down: a broken working config adds nothing, and only a broken base fails closed.
  if (invalid) {
    warn(`${CONFIG} in the working tree is invalid (${invalid}); its additions are ignored, and the base's instruments run`);
    [w, moves[0]] = [b, move('config', 'invalid', 'changed')];
  }
  if (b.barrier.on_timeout !== w.barrier.on_timeout) moves.push(move('barrier.on_timeout', 'changed', 'changed'));
  const barrier = { on_timeout: b.barrier.on_timeout, tiers: anchorList('barrier.tiers', b.barrier.tiers, w.barrier.tiers, moves) };
  const guards = anchorList('guards', b.guards, w.guards, moves);
  const live = anchorLive(readLive(baseContext, lb), readLive(disk(CONTEXT), lb), moves);
  const source = baseConfig === null && baseContext === null ? 'defaults' : 'merge-base';
  return resolved(source, null, { barrier, guards, live }, moves);
}

module.exports = { loadInstruments, validateTier, validateGuard, validateShape };
