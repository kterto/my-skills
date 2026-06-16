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

function buildDefaults(stacks) {
  const stacksCfg = {};
  for (const s of stacks) stacksCfg[s] = defaultStackConfig(s);
  return { schemaVersion: '1.0', stacks: stacksCfg };
}

function loadConfig(root, stacks) {
  const file = path.join(root, CONFIG_NAME);
  const defaults = buildDefaults(stacks);
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
