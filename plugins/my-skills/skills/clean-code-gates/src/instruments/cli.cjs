'use strict';
const path = require('node:path');
const { assertBaseRefShape } = require('../baseref.cjs');
const { KINDS } = require('./vocab.cjs');
const { repoRoot, resolveBase, excludeOutputs } = require('./git.cjs');
const { loadInstruments } = require('./anchor.cjs');
const { summarize, writeReport } = require('./envelope.cjs');
const { recover } = require('./plants.cjs');
const { version: VERSION } = require('../../package.json');

const EXIT = { pass: 0, red: 1, 'not-run': 4 };
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const fail = (message) => { throw new Error(message); };
const FLAGS = {
  '--base': ['base', assertBaseRefShape],
  '--instruments-from': ['from', (v) => (v.startsWith('file:') ? v : assertBaseRefShape(v))],
  '--out': ['out', (v) => v],
  '--now': ['now', (v) => (DATE_TIME.test(v) && !Number.isNaN(Date.parse(v)) ? v : fail(`not an ISO 8601 date-time: ${v}`))],
};

// Common flags may sit anywhere; every other token is the kind's, in order.
function parseCommon(argv) {
  const opts = { base: null, from: null, out: '.cleancode', now: null, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!Object.hasOwn(FLAGS, flag)) { opts.rest.push(flag); continue; }
    const value = argv[++i];
    if (!value || value.startsWith('--')) fail(`${flag} needs a value`);
    try { opts[FLAGS[flag][0]] = FLAGS[flag][1](value); } catch (e) { fail(`${flag}: ${e.message}`); }
  }
  return opts;
}

function movedLine({ source, moves }, ref) {
  const list = moves.map((m) => `${m.key} ${m.change} (${m.direction})`).join(', ');
  const against = source === 'defaults' ? 'built-in defaults' : `merge-base (${ref})`;
  return moves.length ? `INSTRUMENT MOVED — ${list} — measured against ${against} values\n` : '';
}

// Resolves to the exit code and never exits, so a piped stdout is never cut short.
// `io` holds seams (cwd, stdout, stderr, kinds, …) and reaches the kind as ctx.io.
async function main(kind, argv, io = {}) {
  const [out, err] = [io.stdout || ((s) => process.stdout.write(s)), io.stderr || ((s) => process.stderr.write(s))];
  // §7.5.3, for every kind: a plant a killed proof left behind goes back before anything measures, or refuses.
  try { recover(repoRoot(io.cwd || process.cwd())).forEach((w) => err(`warning: ${w}\n`)); } catch { /* reported below */ }
  let opts;
  try { opts = KINDS.includes(kind) ? parseCommon(argv) : fail(`unknown instrument: ${kind}`); }
  catch (e) { err(`usage error: ${e.message}\n`); return 3; }
  try {
    const root = repoRoot(io.cwd || process.cwd());
    const base = resolveBase(root, opts.base);
    const instruments = loadInstruments(root, { baseSha: base.sha, from: opts.from, warn: (w) => err(`warning: ${w}\n`) });
    const kindModule = (io.kinds && io.kinds[kind]) || require(`./${kind}.cjs`);
    // The engine's own output inside the repo (--out, a barrier --cache) never enters a measured tree.
    const [outDir, at] = [path.resolve(root, opts.out), kind === 'barrier' ? opts.rest.indexOf('--cache') : -1];
    const inRepo = (abs, globs) => { const r = path.relative(root, abs); return r.startsWith('..') || path.isAbsolute(r) ? [] : globs(r); };
    excludeOutputs([...inRepo(outDir, (r) => (r ? [`${r}/**`] : [...KINDS.map((k) => `${k}.json`), 'logs/**', 'barrier-cache.json'])),
      ...(at < 0 ? [] : inRepo(path.resolve(root, String(opts.rest[at + 1])), (r) => [r]))]);
    const ctx = { root, args: opts.rest, base, instruments, outDir,
      now: opts.now || new Date().toISOString(), version: VERSION, env: io.env || process.env, io,
      signal: io.signal || new AbortController().signal };
    const { report, lines = [], exitCode, warnings = [] } = await kindModule.run(ctx);
    if (report) out(summarize(lines, writeReport(ctx.outDir, kind, report)));
    else for (const line of lines) err(`${line}\n`);
    for (const w of warnings) err(`warning: ${w}\n`);
    err(movedLine(instruments, base.ref));
    return Number.isInteger(exitCode) ? exitCode : (EXIT[report && report.status] ?? 3);
  } catch (e) {
    err(`error: ${e.message}\n`);
    return Number.isInteger(e.exitCode) ? e.exitCode : 3;
  } finally {
    excludeOutputs([]);
  }
}

module.exports = { main };
