'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { defaultStackConfig } = require('../defaults.cjs');

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

function loadConfig(root, detected) {
  const file = path.join(root, CONFIG_NAME);
  const defaults = buildDefaults(detected);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaults, null, 2) + '\n');
    return { ...defaults, created: true };
  }
  let user;
  try { user = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`invalid config ${CONFIG_NAME}: ${e.message}`); }
  return { ...deepMerge(defaults, user), created: false };
}

module.exports = { loadConfig, CONFIG_NAME, deepMerge };
