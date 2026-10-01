'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { byCodeUnit, envelope, redact } = require('./envelope.cjs');
const { evaluate, reader } = require('./shapes.cjs');
const { prove } = require('./plants.cjs');

const CAP = 200;
const EXIT = { pass: 0, red: 1, 'not-run': 4 };
const usage = (message) => Object.assign(new Error(message), { exitCode: 3 });
const once = (f) => { let v; return () => (v === undefined ? (v = f()) : v); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const capped = (hits) => ({ hits: hits.slice(0, CAP), ...(hits.length > CAP ? { truncated: hits.length - CAP } : {}) });

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--all' || argv[i] === '--changed') o[argv[i].slice(2)] = true;
    else if (['--guard', '--shape', '--prove'].includes(argv[i]) && i + 1 < argv.length) o[argv[i].slice(2)] = argv[++i];
    else throw usage(`sweep: unknown flag or missing value: ${argv[i]}`);
  }
  const picked = ['guard', 'shape', 'prove'].filter((k) => k in o);
  const mode = picked.length ? !o.all && !o.changed && picked.length === 1 && picked[0] : o.changed ? 'changed' : o.all && 'all';
  if (!mode) throw usage('sweep takes one of --guard <id>, --all, --changed [--all], --shape <json | @file>, --prove <id>');
  return { ...o, mode };
}

function parseShape(root, arg) {
  let shape;
  try { shape = JSON.parse(arg.startsWith('@') ? fs.readFileSync(path.resolve(root, arg.slice(1)), 'utf8') : arg); } catch (e) { throw usage(`sweep --shape: ${e.message}`); }
  const error = require('./anchor.cjs').validateShape(shape, '--shape');
  if (error) throw usage(`sweep ${error}`);
  return shape;
}

// Read before any guard runs, as the envelope's tree is: a command guard may write to the tree.
function facts(ctx) {
  const git = require('./git.cjs');
  const [files, changed] = [git.listFiles(ctx.root), git.changedFiles(ctx.root, ctx.base.sha)];
  return { files: () => files, match: git.matchesAny, changed: () => changed, inScope: (f, spec) => git.matchesAny(f, spec.files) && !git.matchesAny(f, spec.exclude || []),
    graph: once(() => require('./graph.cjs').buildGraph(ctx.root, [...new Set([...files, ...changed])].sort())) };
}

// A shape that scanned no file measured nothing: its globs no longer name anything, so it is not a green.
function shapeResult(repo, shape, read) {
  const { visited, hits } = evaluate(shape, repo.files().filter((f) => repo.inScope(f, shape)), read, repo.files());
  return { status: !visited ? 'not-run' : hits.length ? 'red' : 'green', reason: visited ? null : 'vacuous', visited, hits };
}

// Every in-scope file that imports a trigger (the chain is kept; a deleted trigger stays a graph node) or
// matches a pattern. Listing never fails the sweep: routing consumers is the comparator's job (Increment 4).
// Files with pattern hits come first, the most hits first, so the capped summary keeps the actionable ones.
function consumers(repo, c, read) {
  const changed = new Set(repo.changed());
  if (![...changed].some((f) => repo.match(f, c.trigger))) return { status: 'quiet', consumers: [] };
  const triggers = new Set([...repo.files(), ...changed].filter((f) => repo.match(f, c.trigger)));
  const graph = repo.graph();
  const chains = require('./graph.cjs').importersOf(graph, triggers);
  const patterns = (c.patterns || []).map((p) => new RegExp(p));
  const scope = repo.files().filter((f) => repo.inScope(f, c) && !triggers.has(f));
  const list = [];
  for (const file of scope) {
    const chain = chains.get(file);
    const lines = (read(file) ?? '').split('\n');
    const hits = new Map((chain ? graph.edges.get(file) : []).filter((e) => e.to === chain[1]).map((e) => [e.line, lines[e.line - 1] || '']));
    const matched = lines.filter((l, i) => patterns.some((re) => re.test(l)) && hits.set(i + 1, l)).length;
    if (chain || hits.size) list.push([matched, { file, via: chain ? `imports ${chain.join(' → ')}` : 'pattern', changed_in_diff: changed.has(file),
      hits: [...hits].sort((a, b) => a[0] - b[0]).map(([line, text]) => ({ line, text: redact(text.trim()).slice(0, 200) })) }]);
  }
  return { status: 'listed', visited: scope.length, consumers: list.sort((a, b) => b[0] - a[0] || byCodeUnit(a[1].file, b[1].file)).map((x) => x[1]) };
}

async function command(ctx, g, tag) {
  const { cwd, run, bound_minutes } = g.command;
  const log = path.join(ctx.outDir, 'logs', `sweep-${g.id}${tag ? `.${tag}` : ''}.log`);
  const r = await require('./proc.cjs').runBounded({ command: run, cwd: path.join(ctx.root, cwd), env: ctx.env, boundMs: bound_minutes * 60000, logFile: log });
  return { status: r.timedOut ? 'not-run' : r.exitCode === 0 ? 'green' : 'red', reason: r.timedOut ? 'timeout' : null,
    evidence: { exit: r.exitCode, bound_minutes, timed_out: r.timedOut, survivors: r.survivors, log: path.relative(ctx.root, log),
      log_sha256: r.logSha256, head: r.head, tail: r.tail } };
}

async function runGuard(ctx, repo, g, overlay, tag) {
  const read = reader(ctx.root, overlay);
  const r = g.kind === 'command' ? await command(ctx, g, tag) : g.kind === 'consumers' ? consumers(repo, g.consumers, read) : shapeResult(repo, g.shape, read);
  return { id: g.id, kind: g.kind, class: g.class, status: r.status, reason: r.reason || null, visited: r.visited ?? null,
    ...capped(r.hits || []), consumers: r.consumers || null, ...(r.evidence ? { evidence: r.evidence } : {}) };
}

function described(x) {
  if (x.reason) return ` (${x.reason})`;
  if (x.evidence) return x.status === 'green' ? '' : ` (exit ${x.evidence.exit})`;
  if (x.consumers) return x.status === 'listed' ? ` (${plural(x.consumers.length, 'file', 'files')})` : '';
  if (!x.hits.length) return ` (${plural(x.visited, 'file', 'files')})`;
  const regex = x.hits.every((h) => h.check === 'regex');
  const units = new Set(x.hits.map((h) => (regex ? h.file : `${h.file}#${h.text.split('.')[0]}`))).size;
  return ` (${plural(x.hits.length + (x.truncated || 0), 'hit', 'hits')} in ${regex ? plural(units, 'file', 'files') : plural(units, 'class', 'classes')})`;
}

// Plant lines go first: they are the verdict of a proof, and the summary cap drops details from the end.
function summary(r, shapeType) {
  const lines = (r.proof ? r.proof.plants : []).map((p) => `plant "${p.name}": expect ${p.expect}, got ${p.got}${p.ok ? '' : ' (not ok)'}`);
  const rows = r.shape_result ? [{ id: `shape ${shapeType}`, status: r.status === 'pass' ? 'green' : r.status,
    reason: r.status === 'not-run' ? 'vacuous' : null, ...r.shape_result }] : r.guards;
  const parts = rows.map((x) => {
    for (const h of x.hits) lines.push(`${x.id}: ${h.file}:${h.line} ${h.text} (${h.check})`);
    for (const c of x.consumers || []) lines.push(`${x.id}: ${c.file} via ${c.via}${c.changed_in_diff ? ' (changed in diff)' : ''}`);
    if (x.reason === 'timeout') lines.push(`timeout: ${x.id} after ${x.evidence.bound_minutes}m, survivors ${x.evidence.survivors}`);
    return `${x.id} ${x.status}${described(x)}`;
  });
  const { proof } = r;
  if (proof) parts.push(`proof ${proof.proven ? 'proven' : 'not proven'} (unplanted ${proof.unplanted}, ${proof.plants.filter((p) => p.ok).length}/${proof.plants.length} plants ok)`);
  return [`SWEEP ${r.status} · ${parts.join(' · ')}`, ...lines];
}

/** The `sweep` kind (§7). cli.cjs has already put back a plant a killed proof left behind (§7.5.3). */
async function run(ctx) {
  const o = parseArgs(ctx.args || []);
  ctx = { ...ctx, outDir: path.resolve(ctx.root, ctx.outDir || '.cleancode') };
  const guards = ctx.instruments.guards || [];
  const find = (id) => { const g = guards.find((x) => x.id === id); if (!g) throw usage(`sweep: no guard "${id}" (.cleancode-gates.json → guards)`); return g; };
  const shape = o.mode === 'shape' ? parseShape(ctx.root, o.shape) : null;
  const picked = shape ? [] : o.mode === 'guard' || o.mode === 'prove' ? [find(o.guard || o.prove)]
    : guards.filter((g) => o.all || g.kind === 'consumers').sort((a, b) => byCodeUnit(a.id, b.id));
  // Like the barrier, a sweep with nothing to measure has no verdict to give.
  if (!shape && !picked.length) throw usage(`no ${o.all ? '' : 'consumers '}guards declared at ${ctx.base.ref} (.cleancode-gates.json → guards)`);
  const report = envelope({ kind: 'sweep', mode: o.mode, root: ctx.root, base: ctx.base, instruments: ctx.instruments,
    isolation: null, now: ctx.now, version: ctx.version });
  const repo = facts(ctx);
  const timing = shape ? {} : { guards: {} };
  const timed = async (key, fn) => { const t = Date.now(); const r = await fn(); timing.guards[`${key}_ms`] = Date.now() - t; return r; };
  const [body, warnings] = [{ guards: [] }, []];
  let seen = [];
  if (shape) {
    const t = Date.now();
    const { status, visited, hits } = shapeResult(repo, shape, reader(ctx.root));
    [timing.shape_ms, seen, body.shape_result] = [Date.now() - t, [status], { visited, ...capped(hits) }];
  } else if (o.mode === 'prove') {
    const g = picked[0];
    const r = await prove(g, (overlay, tag) => timed(tag ? `${g.id}.${tag}` : g.id, () => runGuard(ctx, repo, g, overlay, tag)), ctx.root, reader(ctx.root));
    Object.assign(body, { guards: [r.entry], proof: r.proof });
    warnings.push(...r.warnings);
  } else {
    for (const g of picked) body.guards.push(await timed(g.id, () => runGuard(ctx, repo, g, null, null)));
    seen = body.guards.map((e) => e.status);
  }
  const status = body.proof ? (body.proof.proven ? 'pass' : 'red') : seen.includes('red') ? 'red' : seen.includes('not-run') ? 'not-run' : 'pass';
  Object.assign(report, { status, timing }, body);
  return { report, lines: summary(report, shape && shape.type), exitCode: EXIT[status], warnings };
}

module.exports = { run };
