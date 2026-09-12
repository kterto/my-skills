'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { defaultStackConfig } = require('../defaults.cjs');
const { anchorInstrument } = require('./instrument.cjs');
const { assertBaseRefShape } = require('./baseref.cjs');

const CONFIG_NAME = '.cleancode-gates.json';

function deepMerge(base, over) {
  if (Array.isArray(over) || over === null || typeof over !== 'object') return over ?? base;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base ? base[k] : undefined, over[k]);
  return out;
}

/**
 * `detected` is either the historical array of stack names or the richer
 * `{ stack, dir }` package list from `detectPackages`. Both are accepted so an
 * existing caller — and an existing config written by one — keeps working.
 */
function packagesByStack(detected) {
  const byStack = new Map();
  for (const d of detected || []) {
    const { stack, dir } = typeof d === 'string' ? { stack: d, dir: '' } : d;
    if (!byStack.has(stack)) byStack.set(stack, []);
    byStack.get(stack).push(dir);
  }
  return byStack;
}

function buildDefaults(detected) {
  const stacksCfg = {};
  for (const [stack, dirs] of packagesByStack(detected)) stacksCfg[stack] = defaultStackConfig(stack, dirs);
  return { schemaVersion: '1.0', stacks: stacksCfg };
}

/**
 * The merge-base copy of the config, as text. Git is called with an argv array
 * and no shell, and the ref is shape-checked first, so nothing in a caller's
 * `--base-ref` reaches a command. A ref that has no such file — the ordinary
 * case on the branch that first adopts the gates — is not an error: it means the
 * merge-base measured at the built-in defaults, and that is what we anchor to.
 */
function gitShowConfig(root) {
  return (baseRef) => {
    try {
      return cp.execFileSync('git', ['-C', root, 'show', `${assertBaseRefShape(baseRef)}:./${CONFIG_NAME}`],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { return null; }
  };
}

function parseBase(text) {
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * `opts.baseRef` anchors the instrument. Without it the resolution is exactly
 * what it has always been and `instrument.anchored` is `false` — a project-scope
 * or explicit-file run has no base to be measured against and claims none.
 */
function loadConfig(root, detected, opts = {}) {
  const file = path.join(root, CONFIG_NAME);
  const defaults = buildDefaults(detected);
  let created = false;
  let user = {};
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaults, null, 2) + '\n');
    created = true;
  } else {
    try { user = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { throw new Error(`invalid config ${CONFIG_NAME}: ${e.message}`); }
  }
  const working = { ...deepMerge(defaults, user), created };
  if (!opts.baseRef) return { ...working, instrument: { anchored: false, baseRef: null, source: 'working-tree', moves: [] } };

  const readBase = opts.readBase || gitShowConfig(root);
  const baseUser = parseBase(readBase(opts.baseRef, CONFIG_NAME));
  const anchor = baseUser ? deepMerge(defaults, baseUser) : defaults;
  const { cfg, moves } = anchorInstrument(working, anchor);
  return { ...cfg, instrument: { anchored: true, baseRef: opts.baseRef, source: baseUser ? 'merge-base' : 'defaults', moves } };
}

module.exports = { loadConfig, CONFIG_NAME, deepMerge };
