'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { listFiles, changedFiles, matchesAny, showFile } = require('./git.cjs');
const { envelope, byCodeUnit } = require('./envelope.cjs');
const { buildGraph, importersOf } = require('./graph.cjs');
const { controllerRoutes, callSites, matchRoute } = require('./routes.cjs');

const BY = ['imports', 'routes'];
const MODULE_RE = /\.module\.ts$/;
const MAX_REASONS = 8;
const MAX_OTHER = 3; // every route reason stays: they are equal evidence, and a cap hid the one that failed
// Route reasons first, by method then path (the space after a path sorts below every path character), then the rest.
const byRank = (a, b) => Number(!a.startsWith('route ')) - Number(!b.startsWith('route ')) || byCodeUnit(a, b);
const FLAGS = { '--tier': 'tier', '--tests': 'tests', '--sources': 'sources', '--by': 'by', '--max': 'max' };

/** A usage or config error: `cli.cjs` maps a thrown error to exit 3, as the legacy CLI does. */
const usage = (message) => Object.assign(new Error(message), { exitCode: 3 });
const read = (root, f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } };

function importsReason(root, graph, chain) {
  const { line } = graph.edges.get(chain[0]).find(e => e.to === chain[1]);
  return `imports ${chain[0]}:${line} → ${chain.slice(1).join(' → ')} (${stateOf(root, chain[chain.length - 1])})`;
}
const stateOf = (root, f) => (fs.existsSync(path.join(root, f)) ? 'changed' : 'deleted');

/** Unresolved specifiers in the tests' dependency closure: only there can one hide a selection. */
function unresolvedFrom(graph, tests) {
  const seen = new Set(tests);
  const queue = [...tests];
  for (let i = 0; i < queue.length; i++) {
    for (const { to } of graph.edges.get(queue[i]) || []) if (!seen.has(to)) { seen.add(to); queue.push(to); }
  }
  return [...seen].reduce((n, f) => n + (graph.unresolved.get(f) || 0), 0);
}

/**
 * §6.4. An unchanged `*.module.ts` blocks every walk toward a non-module change, since each spec boots the app
 * module. A changed module is wiring every app importing it boots: the walk to it may pass unchanged modules, and
 * it selects every test that reaches it. A changed controller keeps the base routes it lost, so a removed,
 * re-verbed or re-prefixed endpoint still selects its callers. A change that no controller or changed module
 * reaches is wired by the unchanged modules importing it, which then select as a changed module would.
 */
function byRoutes(root, graph, { listed, testFiles, sources, changedSet, base }, note) {
  const changedAll = [...changedSet];
  const skip = (f) => MODULE_RE.test(f) && !changedSet.has(f);
  const reach = new Map([
    ...importersOf(graph, new Set(changedAll.filter(f => MODULE_RE.test(f)))),
    ...importersOf(graph, new Set(changedAll.filter(f => !MODULE_RE.test(f))), { skip }),
  ]);
  for (const t of testFiles) if (reach.has(t)) note(t, importsReason(root, graph, reach.get(t)));
  const controllers = new Map(listed.filter(f => matchesAny(f, sources)).map(f => [f, read(root, f)]).filter(([, t]) => t.includes('@Controller(')));
  const affected = [];
  for (const [f, text] of controllers) {
    const chain = changedSet.has(f) ? [f] : reach.get(f);
    if (chain) affected.push(...controllerRoutes(f, text).map(r => ({ r, chain })));
  }
  for (const f of changedAll.filter(f => base && matchesAny(f, sources))) {
    const now = new Set(controllerRoutes(f, controllers.get(f) || '').map(r => `${r.method} ${r.path}`));
    const was = controllerRoutes(f, showFile(root, base, f) || '').filter(r => !now.has(`${r.method} ${r.path}`));
    affected.push(...was.map(r => ({ r: { ...r, line: `${r.line} at base` }, chain: [f] })));
  }
  const tests = new Set(testFiles);
  for (const f of changedAll.filter(f => !MODULE_RE.test(f))) {
    const up = importersOf(graph, new Set([f]), { skip });
    if ([f, ...up.keys()].some(x => controllers.has(x) || (MODULE_RE.test(x) && !skip(x)))) continue;
    for (const [m, chain] of [...up].filter(([x]) => skip(x))) {
      for (const t of importersOf(graph, new Set([m])).keys()) if (tests.has(t)) note(t, `wired by ${chain.join(' → ')} (${stateOf(root, f)})`);
    }
  }
  let unresolved = 0;
  for (const t of testFiles) {
    const { sites, unresolved: u } = callSites(read(root, t));
    unresolved += u;
    const hit = new Set();
    for (const s of sites) {
      for (const a of affected.filter(a => !hit.has(a) && matchRoute(a.r, s))) {
        hit.add(a);
        const via = a.chain.slice(1).map(f => ` → ${f}`).join('');
        const state = stateOf(root, a.chain[a.chain.length - 1]);
        note(t, `route ${a.r.method} ${a.r.path} (${a.r.file}:${a.r.line})${via} (${state}) · called at ${t}:${s.line}`);
      }
    }
  }
  return unresolved;
}

// §3.9: the tests a change selects, every route reason then at most three others; P1's barrier passes the tier's cwd and the base sha.
// A changed file matching whole_on selects every test; one under cwd no graph node or glob covers is unmapped: nothing shows it inert.
function selectTests(root, { changed, tests, sources = [], by = ['imports'], max = null, whole_on = [], cwd = '.', base = null }) {
  if (!by.length || by.some(b => !BY.includes(b))) throw usage(`select: --by takes imports and/or routes, got "${by.join(',')}"`);
  const listed = listFiles(root);
  const empty = tests.find(g => !listed.some(f => matchesAny(f, [g])));
  // `vacuous`: the barrier types such a tier not-run; on its own, select refuses it.
  if (empty !== undefined) throw Object.assign(usage(`select: tests glob matches no file: ${empty}`), { vacuous: true });
  const testFiles = listed.filter(f => matchesAny(f, tests));
  const changedSet = new Set(changed);
  const graph = buildGraph(root, [...new Set([...listed, ...changed])].sort(byCodeUnit));
  const reasons = new Map();
  const note = (file, reason) => (reasons.get(file) || reasons.set(file, new Set()).get(file)).add(reason);
  for (const t of testFiles) if (changedSet.has(t)) note(t, `changed ${t}`);
  let unresolved = unresolvedFrom(graph, testFiles);
  if (by.includes('imports')) {
    const reach = importersOf(graph, changedSet);
    for (const t of testFiles) if (reach.has(t)) note(t, importsReason(root, graph, reach.get(t)));
  }
  if (by.includes('routes')) unresolved += byRoutes(root, graph, { listed, testFiles, sources, changedSet, base }, note);
  const whole = whole_on.filter(g => changed.some(f => matchesAny(f, [g])));
  for (const g of whole) for (const t of testFiles) note(t, `whole_on ${g}`);
  const unmapped = changed.filter(f => !/^\.\.(\/|$)/.test(path.posix.relative(cwd, f)) && !graph.edges.has(f) && !graph.rev.has(f)
    && !matchesAny(f, [...tests, ...sources, ...whole_on])).sort(byCodeUnit);
  const selected = [...reasons.keys()].sort(byCodeUnit)
    .map(file => { const all = [...reasons.get(file)].sort(byRank), routes = all.filter(x => x.startsWith('route '));
      return { file, reasons: [...routes, ...all.slice(routes.length, routes.length + MAX_OTHER)] }; });
  const size = selected.length;
  return { tests_total: testFiles.length, size, max, within_max: max === null ? null : size <= max, whole: whole.length > 0,
    selected, unresolved, unmapped };
}

/** §3.9: the live-block flows (§8.1 `flows`) whose `paths` match a changed file. */
function selectFlows(liveBlock, changed) {
  const flows = (liveBlock && liveBlock.flows) || {};
  return Object.keys(flows).sort(byCodeUnit).map((name) => {
    const globs = [].concat(flows[name].paths || []);
    const reasons = changed.flatMap(f => globs.filter(g => matchesAny(f, [g])).slice(0, 1).map(g => `changed ${f} matches ${g}`));
    return { name, reasons: reasons.sort(byCodeUnit).slice(0, MAX_REASONS) };
  }).filter(f => f.reasons.length);
}

function parseArgs(argv) {
  const o = { flows: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--flows') { o.flows = true; continue; }
    const key = FLAGS[argv[i]];
    if (!key) throw usage(`select: unknown flag ${argv[i]}`);
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw usage(`select: ${argv[i - 1]} needs a value`);
    o[key] = key === 'tier' || key === 'max' ? value : value.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (o.max !== undefined && !/^\d+$/.test(o.max)) throw usage(`select: --max takes a whole number, got "${o.max}"`);
  if (o.tier !== undefined && (o.tests || o.sources || o.by || o.max !== undefined)) throw usage('select: --tier excludes --tests, --sources, --by and --max');
  if (o.tier === undefined && !(o.tests && o.sources)) throw usage('select: pass --tier <id>, or --tests <globs> and --sources <globs>');
  return o;
}

function tierOf(instruments, id) {
  const tier = ((instruments.barrier && instruments.barrier.tiers) || []).find(t => t.id === id);
  if (!tier) throw usage(`select: no barrier tier "${id}" (.cleancode-gates.json → barrier.tiers)`);
  if (tier.scope !== 'change-selected' || !tier.select) throw usage(`select: tier "${id}" is not change-selected`);
  return tier;
}

function flowsFor(live, changed, warnings) {
  if (live && live.block) return selectFlows(live.block, changed);
  warnings.push(`select --flows: ${live && live.error ? `invalid live block (${live.error})` : 'no live block'}; flows is []`);
  return [];
}

function summaryLines(report, withFlows, B) {
  const s = report.selection;
  const k = B && s.size > B ? ` → ${Math.ceil(s.size / B)} batches of ≤ ${B}` : '';
  const facts = [`${s.size}/${s.tests_total} selected${s.max === null ? '' : ` (${B && !s.within_max ? 'over ' : ''}max ${s.max})`}${k}`,
    `by ${s.by.join(',')}`, `${s.unresolved} unresolved`, ...(s.unmapped.length ? [`unmapped: ${s.unmapped.length}`] : [])];
  if (withFlows) facts.push(`${report.flows.length} flows`);
  return [`SELECT ${report.status} · ${facts.join(' · ')}`,
    ...report.flows.map(f => `flow ${f.name}: ${f.reasons[0]}`), ...s.selected.map(t => `${t.file}: ${t.reasons[0]}`)];
}

/** §3.6 kind interface for `gates.cjs select`. */
async function run(ctx) {
  const started = Date.now();
  const o = parseArgs(ctx.args || []);
  const tier = o.tier === undefined ? null : tierOf(ctx.instruments, o.tier);
  const spec = tier ? tier.select : o;
  const by = [...(spec.by || ['imports'])].sort(byCodeUnit);
  const max = spec.max === undefined || spec.max === null ? null : Number(spec.max);
  const changed = changedFiles(ctx.root, ctx.base.sha);
  const sel = selectTests(ctx.root, { changed, tests: spec.tests, sources: spec.sources, by, max, whole_on: spec.whole_on || [],
    cwd: tier ? tier.cwd : '.', base: ctx.base.sha });
  const warnings = [];
  const flows = o.flows ? flowsFor(ctx.instruments.live, changed, warnings) : [];
  // A tier with batch_files runs a selection of any size, in batches under its bound: there, size is scope, never red.
  const B = tier && tier.select.batch_files;
  const status = sel.within_max === false && !B ? 'red' : 'pass';
  const head = envelope({ kind: 'select', mode: o.tier === undefined ? 'adhoc' : 'tier', root: ctx.root, base: ctx.base,
    instruments: ctx.instruments, isolation: null, now: ctx.now, version: ctx.version });
  const report = { ...head, status, timing: { select_ms: Date.now() - started }, changed,
    selection: { tier: o.tier === undefined ? null : o.tier, by, ...sel }, flows };
  return { report, lines: summaryLines(report, o.flows, B), exitCode: status === 'red' ? 1 : 0, warnings };
}

module.exports = { run, selectTests, selectFlows };
