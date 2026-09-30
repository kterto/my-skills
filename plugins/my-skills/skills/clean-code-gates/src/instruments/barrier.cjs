'use strict';
// barrier (contract §5): each declared tier runs at the candidate tree under its
// bound. A red suite fails the tier only when the same tier at base did not fail
// it by the same tests; the base comes from the cache (a pass only), a worktree,
// or nowhere, and it is consulted only when the candidate has a red suite.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runBounded, childEnv, hold, atStop } = require('./proc.cjs');
const { parseReport, totals } = require('./reports.cjs');
const { envelope, stableJson, byCodeUnit, fmtDuration, redact } = require('./envelope.cjs');
const { changedFiles, subtreeOf, worktreeAdd, worktreeRemove } = require('./git.cjs');
const { selectTests } = require('./select.cjs');

const MIN = 60000;
const RED = new Set(['fail', 'error']);
const EXIT = { pass: 0, red: 1, 'not-run': 4 };
const TIMES = ['candidate_ms', 'base_ms', 'rerun_ms', 'cleanup_ms'];
const FAILURES_CAP = 50;
const quote = (s) => `'${s.replace(/'/g, "'\\''")}'`;
const byFile = (a, b) => byCodeUnit(a.file, b.file);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function parseArgs(argv) {
  const o = { tiers: null, cache: null, whole: false, ifChanged: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--whole' || flag === '--if-changed') { o[flag === '--whole' ? 'whole' : 'ifChanged'] = true; continue; }
    if (flag !== '--tier' && flag !== '--cache') throw new Error(`barrier: unknown flag ${flag}`);
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`barrier: ${flag} needs a value`);
    Object.assign(o, flag === '--tier' ? { tiers: value.split(',') } : { cache: value });
  }
  // Skipping on an unchanged key is only sound for a run that measures the whole tier and compares nothing.
  if (o.ifChanged && !o.whole) throw new Error('barrier: --if-changed needs --whole');
  return o;
}

// ---- the cache: `<tierDigest>@<key>` → the last completed side at that key ----

const tierDigest = ({ base, ...tier }) => crypto.createHash('sha256').update(stableJson(tier)).digest('hex');
// The key is the tree, or with `cache_scope: cwd` the tier's own folder, so a commit elsewhere keeps it; null: no folder there.
const keyOf = (x, tree) => (x.tier.cache_scope === 'cwd' ? subtreeOf(x.ctx.root, tree, path.posix.normalize(x.tier.cwd).replace(/\/$/, '')) : tree);

function readCache(file) {
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (c && c.records && typeof c.records === 'object') return { seq: Number(c.seq) || 0, records: c.records };
  } catch { /* no cache yet, or an unreadable one: start empty */ }
  return { seq: 0, records: {} };
}

// A record keeps the seq its tree was first recorded at, so first_seen stays the oldest red. Only a whole run
// replaces a whole run's record: a compared run at that key (QA's base side, say) must not reset its verdict.
const put = (cache, key, rec) => {
  const old = cache.records[key];
  if (!old || !old.whole || rec.whole) cache.records[key] = { ...rec, seq: old ? old.seq : (cache.seq += 1) };
};

// Re-read before writing: the cache is shared, and another run may have written since.
function writeCache(file, added) {
  const cache = readCache(file);
  for (const [key, rec] of Object.entries(added)) put(cache, key, rec);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.${process.pid}`, `${JSON.stringify({ version: 1, ...cache }, null, 2)}\n`);
  fs.renameSync(`${file}.${process.pid}`, file);
}

function record(x, at, side, selection, flaky = [], whole = false) {
  const tree = keyOf(x, at);
  if (!tree) return;
  const key = `${tierDigest(x.tier)}@${tree}`;
  x.added[key] = { tree, result: side.result, selection, tests: side.tests,
    red: side.suites.filter((s) => RED.has(s.result)).map((s) => s.file), ...(flaky.length ? { flaky } : {}), ...(whole ? { whole } : {}) };
  put(x.cache, key, x.added[key]);
}

function firstSeen(x, file) {
  const prefix = `${tierDigest(x.tier)}@`;
  const reds = Object.entries(x.cache.records).filter(([k, r]) => k.startsWith(prefix) && (r.red || []).includes(file));
  const oldest = reds.map(([, r]) => r).sort((p, q) => p.seq - q.seq)[0];
  return oldest ? oldest.tree : x.tree.baseTree; // none cached (a key naming no folder never is): seen at this base
}

// ---- one side of one tier ---------------------------------------------------

const logFile = (x, name) => path.join(x.ctx.outDir, 'logs', `barrier-${x.tier.id}-${name}.log`);
const shown = (root, p) => (path.relative(root, p).startsWith('..') ? p : path.relative(root, p));

async function cleanup(x, name, cwd, env) {
  const c = await runBounded({ command: x.tier.cleanup, cwd, env, boundMs: MIN, logFile: logFile(x, `${name}-cleanup`) });
  x.cleanup.push({ side: name, exit: c.exitCode });
  x.ms.cleanup_ms = (x.ms.cleanup_ms || 0) + c.ms;
}

async function attempt(x, name, { command, cwd, env, boundMs, rel }) {
  const report = path.join(cwd, rel);
  const made = fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.rmSync(report, { force: true });
  // Interrupted mid-run, the engine runs the tier's cleanup before it re-raises; after a timeout, the run does.
  const drop = x.tier.cleanup ? atStop(() => cleanup(x, name, cwd, env)) : () => {};
  const r = await runBounded({ command, cwd, env, boundMs, logFile: logFile(x, name) });
  drop();
  let text = null;
  try { text = fs.readFileSync(report, 'utf8'); } catch { /* no report was written */ }
  fs.rmSync(report, { force: true });
  // Leave the tree as it was found: remove only the directories this run created.
  for (let d = path.dirname(report); made; d = path.dirname(d)) {
    try { fs.rmdirSync(d); } catch { break; }
    if (d === made) break;
  }
  if (r.timedOut && x.tier.cleanup) await cleanup(x, name, cwd, env);
  return { ...r, text };
}

async function side(x, name, { dir, select, env, expect }) {
  const { tier } = x;
  const cwd = path.join(dir, tier.cwd);
  const rel = `.cleancode/barrier/${tier.id}.${name}.${tier.report === 'junit' ? 'xml' : 'json'}`;
  const picked = select ? select.map((f) => quote(path.posix.relative(tier.cwd, f))).join(' ') : '';
  // A function replacement: a `$&` or `$'` in a selected path reaches the runner as written.
  const command = (name === 'rerun' ? tier.rerun : tier.run).replace(/\$(REPORT|SELECT)\b/g, (m, k) => (k === 'REPORT' ? rel : picked));
  const opts = { command, cwd, env: childEnv(x.ctx.env, env), rel };
  // A run that is whole (--whole, a whole_on selection, a whole rerun) or past select.max, nearly whole, takes
  // whole_minutes when that is longer: a bound sized for a typical selection would end it as a timeout.
  const big = select === null || (tier.select && tier.select.max !== undefined && select.length > tier.select.max);
  let bound = big ? Math.max(tier.whole_minutes || 0, tier.bound_minutes) : tier.bound_minutes;
  let r = await attempt(x, name, { ...opts, boundMs: bound * MIN });
  let ms = r.ms;
  if (r.timedOut && x.onTimeout === 'retry-2x' && name !== 'rerun') {
    bound *= 2;
    r = await attempt(x, name, { ...opts, boundMs: bound * MIN });
    ms += r.ms;
  }
  const out = {
    command, ms, bounded: { bound_minutes: bound, timed_out: r.timedOut, survivors: r.survivors },
    evidence: { exit: r.exitCode, log: shown(x.ctx.root, logFile(x, name)), log_sha256: r.logSha256, head: r.head, tail: r.tail },
  };
  const vacuous = (tests, detail, missing) => ({ ...out, result: 'not-run', reason: 'vacuous', tests, suites: [], detail, missing });
  if (r.timedOut) return { ...out, result: 'not-run', reason: 'timeout', tests: null, suites: [] };
  // A runner killed mid-run proved nothing, whatever its report says.
  if (r.exitCode >= 128 || r.signal) return vacuous(null, `the runner died (exit ${r.exitCode}${r.signal ? `, ${r.signal}` : ''})`);
  const parsed = parseReport(tier.report, r.text, { cwd: tier.cwd, runnerCwd: tier.runner_cwd || cwd, tierId: tier.id, exit: r.exitCode });
  const tests = parsed && totals(parsed.suites);
  // No report, or no test executed: boot evidence is missing, so nothing was measured.
  if (!parsed || tests.executed === 0) return vacuous(tests);
  // A selected file the runner skipped (a path it read as a pattern, say) is no evidence of a pass.
  const missing = (expect || []).filter((f) => !parsed.suites.some((s) => s.file === f));
  if (missing.length) return vacuous(tests, `${plural(missing.length, 'selected file')} never ran`, missing);
  const red = parsed.suites.some((s) => RED.has(s.result));
  return { ...out, result: red ? 'fail' : 'pass', reason: red ? 'assertion' : null, tests, suites: parsed.suites };
}

async function baseSide(x, select) {
  const { ctx, tier } = x;
  const tree = x.tree.baseTree;
  const none = (source, reason, detail) => ({ source, tree, result: 'not-run', reason, tests: null, suites: [], detail });
  const key = keyOf(x, tree);
  const rec = key && x.cache.records[`${tierDigest(tier)}@${key}`];
  const covers = rec && (rec.selection === null || (select !== null && select.every((f) => rec.selection.includes(f))));
  if (rec && rec.result === 'pass' && covers) return { source: 'inherited', tree, result: 'pass', reason: null, tests: rec.tests, suites: [] };
  if (!tier.base || tier.base.mode !== 'worktree') return none('none', 'unmeasured');
  const started = Date.now();
  const home = ctx.env.CCG_WORKTREE_DIR || os.tmpdir();
  fs.mkdirSync(home, { recursive: true });
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(home, 'ccg-barrier-')));
  const dir = path.join(parent, 'tree');
  const env = { ...tier.env, ...tier.base.env };
  // Removed on every path, a signal's included (the engine holds signals for the whole run), even mid-add.
  const gone = () => { worktreeRemove(ctx.root, dir); fs.rmSync(parent, { recursive: true, force: true }); };
  const drop = atStop(gone);
  try {
    try { worktreeAdd(ctx.root, ctx.base.sha, dir); }
    catch (e) { return none('worktree', 'vacuous', redact(e.message.split(dir).join('<worktree>')).replace(/\s+/g, ' ').slice(0, 300)); }
    if (tier.base.prepare) {
      const p = await runBounded({ command: tier.base.prepare, cwd: path.join(dir, tier.cwd), env: childEnv(ctx.env, env),
        boundMs: (tier.base.prepare_minutes || 15) * MIN, logFile: logFile(x, 'base-prepare') });
      if (p.exitCode !== 0) return none('worktree', 'vacuous', `prepare ${p.timedOut ? 'timed out' : `exit ${p.exitCode}`}`);
    }
    const s = await side(x, 'base', { dir, select, env });
    if (s.result !== 'not-run') record(x, tree, s, select);
    return { source: 'worktree', tree, ...s };
  } finally { drop(); gone(); x.ms.base_ms = Date.now() - started; }
}

// ---- one tier -----------------------------------------------------------------

function classify(x, out, red, base) {
  const at = new Map(base.suites.map((s) => [s.file, s]));
  for (const s of red) {
    const failing = s.failures.map((f) => f.name);
    const was = at.get(s.file);
    const before = new Set(was ? was.failures.map((f) => f.name) : []);
    // Carried: red at base by assertion, and no test fails now that did not fail then.
    if (s.result === 'fail' && failing.length && was && was.result === 'fail' && failing.every((n) => before.has(n))) {
      out.carried.push({ file: s.file, failing, first_seen: firstSeen(x, s.file), owner: null });
    } else {
      out.newly_red.push({ file: s.file, basis: base.result === 'not-run' ? 'no-base' : 'base', failing, reproduced: false });
    }
  }
}

async function rerun(x, out, cand) {
  const files = out.newly_red.map((n) => n.file);
  const selectable = files.every((f) => cand.suites.find((s) => s.file === f).hasFile);
  const again = await side(x, 'rerun', { dir: x.ctx.root, select: selectable ? files : null, env: x.tier.env });
  x.ms.rerun_ms = again.ms;
  const now = new Map(again.suites.map((s) => [s.file, s.result]));
  for (const n of out.newly_red) n.reproduced = RED.has(now.get(n.file));
  out.flaky.push(...out.newly_red.filter((n) => now.get(n.file) === 'pass').map((n) => n.file));
  out.newly_red = out.newly_red.filter((n) => now.get(n.file) !== 'pass');
}

const shownSuite = (s) => ({ file: s.file, result: s.result, executed: s.executed, failed: s.failed, failures: s.failures.slice(0, FAILURES_CAP),
  ...(s.failures.length > FAILURES_CAP ? { truncated: s.failures.length - FAILURES_CAP } : {}), ...(s.message ? { message: s.message } : {}) });

async function runTier(b, tier) {
  const x = { ...b, tier, cleanup: [], ms: {} };
  const out = { id: tier.id, scope: tier.scope, isolation: tier.isolation || null, whole_run: tier.whole_run || null, whole: b.whole,
    inherited: null, command: null, result: 'pass', reason: null, detail: null, selection: null, unresolved: null, unmapped: null,
    candidate: null, base: null, newly_red: [], carried: [], flaky: [], cleanup: x.cleanup };
  const skip = (reason, detail = null) => ({ out: { ...out, result: 'not-run', reason, detail }, ms: {}, ran: false });
  // A branch that moved or dropped the tier's directory cannot take the barrier down: that tier alone measured nothing.
  if (!fs.existsSync(path.join(b.ctx.root, tier.cwd))) return skip('vacuous', 'cwd missing');
  if (b.ifChanged) {
    // Same inputs, same whole-run verdict: report it again, never re-run it, a fail included (it was said once already).
    // Only a --whole run's own record counts: a compared run's side had no rerun, and its red may be carried.
    const key = keyOf(x, x.tree.candidateTree);
    const rec = key && x.cache.records[`${tierDigest(tier)}@${key}`];
    if (rec && rec.whole) {
      const flaky = rec.flaky || [];
      const red = rec.red.filter((file) => !flaky.includes(file));
      return { out: { ...out, inherited: key, result: red.length ? 'fail' : 'pass', reason: red.length ? 'assertion' : null, flaky,
        newly_red: red.map((file) => ({ file, basis: 'no-base', failing: [], reproduced: false })) }, ms: {}, ran: false };
    }
  }
  let select = null;
  if (tier.scope === 'change-selected' && !b.whole) {
    let sel;
    try { sel = (b.ctx.io.selectTests || selectTests)(b.ctx.root, { changed: b.changed, ...tier.select, cwd: tier.cwd, base: b.ctx.base.sha }); }
    catch (e) { if (e.vacuous) return skip('vacuous', e.message); throw e; } // a tests glob that matches no file
    Object.assign(out, { selection: sel.selected.map((s) => s.file), unresolved: sel.unresolved, unmapped: sel.unmapped ?? null });
    // Nothing selected is proven empty only when every import resolved; otherwise a test may reach the change unseen.
    if (!out.selection.length) return sel.unresolved > 0 ? skip('unmeasured', `${plural(sel.unresolved, 'unresolved import')}`) : skip('empty-scope');
    // A whole selection runs the tier as a whole run, $SELECT empty.
    select = sel.whole ? null : out.selection;
  }
  const cand = await side(x, 'candidate', { dir: b.ctx.root, select, env: tier.env, expect: select });
  x.ms.candidate_ms = cand.ms;
  const red = cand.suites.filter((s) => RED.has(s.result)).sort(byFile);
  // A whole run measures this tree's own state: it compares nothing, so every red suite is red.
  const base = !red.length ? null : b.whole ? { source: 'none', tree: x.tree.baseTree, result: 'not-run', reason: 'unmeasured', tests: null,
    suites: [], detail: 'a whole run compares nothing' } : await baseSide(x, select);
  if (base) classify(x, out, red, base);
  if (tier.rerun && out.newly_red.length) await rerun(x, out, cand);
  // After the rerun, so the record keeps which red suites were flaky and --if-changed repeats this verdict.
  if (cand.result !== 'not-run') record(x, x.tree.candidateTree, cand, select, out.flaky, b.whole);
  out.result = out.newly_red.length ? 'fail' : cand.result === 'not-run' ? 'not-run' : 'pass';
  out.reason = out.newly_red.length ? 'assertion' : out.result === 'not-run' ? cand.reason : null;
  out.detail = out.result === 'not-run' ? cand.detail || null : null;
  out.command = cand.command;
  out.candidate = { result: cand.result, reason: cand.reason, tests: cand.tests, suites: red.map(shownSuite),
    bounded: cand.bounded, evidence: cand.evidence, ...(cand.missing ? { missing: cand.missing } : {}) };
  out.base = base && { source: base.source, tree: base.tree, result: base.result, reason: base.reason, tests: base.tests,
    ...(base.detail ? { detail: base.detail } : {}) };
  const ms = Object.fromEntries(TIMES.filter((k) => x.ms[k] !== undefined).map((k) => [k, x.ms[k]]));
  return { out, ms, ran: true, exitOnly: tier.report === 'exit-code' };
}

// ---- the summary ---------------------------------------------------------------

function summary(report, runs) {
  const facts = [];
  const [newly, timeouts, carried, flaky, unmapped, bases] = [[], [], [], [], [], []];
  for (const { out: t, ms, exitOnly } of runs) {
    const why = t.result === 'not-run' ? ` (${t.reason}${t.detail ? `: ${t.detail}` : ''})` : '';
    const kept = t.inherited ? ` (unchanged since a whole run at ${t.inherited.slice(0, 8)})` : '';
    const head = `${t.id}${t.whole ? ' whole' : t.scope === 'change-selected' ? ' change-selected' : ''} ${t.result}${why}${kept}`;
    // A changed file no graph node or glob covers may still reach a test: said even when nothing was selected.
    const u = t.unmapped || [];
    if (u.length) unmapped.push(`unmapped: ${t.id} ${u.length} (${u[0]}${u.length > 1 ? `, +${u.length - 1} more` : ''})`);
    if (!t.candidate) { // skipped or inherited: an inherited verdict names its suites, uncounted (nothing ran)
      facts.push(head);
      newly.push(...t.newly_red.map((n) => `newly red: ${n.file} (unchanged)`));
      flaky.push(...t.flaky.map((f) => `flaky: ${f} (unchanged)`));
      continue;
    }
    const suite = (file) => t.candidate.suites.find((s) => s.file === file);
    const counts = (s) => `${s.failed ?? '?'}/${s.executed ?? '?'}`;
    const first = t.newly_red[0] && suite(t.newly_red[0].file);
    const more = t.newly_red.length > 1 ? `, +${t.newly_red.length - 1} more` : '';
    facts.push(`${head} ${fmtDuration(ms.candidate_ms)}${first ? ` (newly red: ${first.file} ${counts(first)}${more})` : ''}`
      + `${exitOnly ? ' (exit-code only)' : ''}`);
    for (const n of t.newly_red) {
      const s = suite(n.file);
      newly.push(`newly red: ${n.file} ${counts(s)} — ${n.failing[0] || s.message || `exit ${t.candidate.evidence.exit}`}`);
    }
    const { bounded } = t.candidate;
    if (bounded.timed_out) timeouts.push(`timeout: ${t.id} after ${bounded.bound_minutes}m, survivors ${bounded.survivors ?? '?'}`);
    for (const c of t.carried) carried.push(`carried: ${c.file} (since ${c.first_seen.slice(0, 8)}, owner unassigned)`);
    for (const f of t.flaky) flaky.push(`flaky: ${f} ${counts(suite(f))} (green on rerun)`);
    if (t.base) bases.push(`base: ${t.id} ${t.base.source}${t.base.detail ? ` (${t.base.reason}: ${t.base.detail})` : ''}`);
  }
  const verdict = [`BARRIER ${report.status}`, ...facts, ...(report.isolation ? [`isolation: ${report.isolation}`] : [])];
  return [verdict.join(' · '), ...newly, ...timeouts, ...carried, ...flaky, ...unmapped, ...bases];
}

async function run(ctx) {
  const o = parseArgs(ctx.args);
  const declared = (ctx.instruments.barrier && ctx.instruments.barrier.tiers) || [];
  if (!declared.length) throw new Error(`no barrier tiers declared at ${ctx.base.ref} (.cleancode-gates.json → barrier.tiers)`);
  const unknown = (o.tiers || []).find((id) => !declared.some((t) => t.id === id));
  if (unknown) throw new Error(`barrier: no tier "${unknown}" declared (.cleancode-gates.json → barrier.tiers)`);
  const env = envelope({ kind: 'barrier', mode: null, root: ctx.root, base: ctx.base, instruments: ctx.instruments,
    now: ctx.now, version: ctx.version });
  const cacheFile = o.cache ? path.resolve(ctx.root, o.cache) : path.join(ctx.outDir, 'barrier-cache.json');
  const picked = [...declared].sort((p, q) => byCodeUnit(p.id, q.id)).filter((x) => !o.tiers || o.tiers.includes(x.id));
  // Read, like the tree, before any tier runs: a runner may write into the tree, and that is not the branch's change.
  const changed = !o.whole && picked.some((x) => x.scope === 'change-selected') ? changedFiles(ctx.root, ctx.base.sha) : [];
  const b = { ctx, tree: env.tree, changed, onTimeout: ctx.instruments.barrier.on_timeout || 'not-done', cache: readCache(cacheFile), added: {},
    whole: o.whole, ifChanged: o.ifChanged };
  const runs = [];
  const release = hold(); // a signal at any step, a synchronous `git worktree add` included, undoes before it re-raises
  try {
    for (const tier of picked) runs.push(await runTier(b, tier));
  } finally { release(); }
  if (Object.keys(b.added).length) writeCache(cacheFile, b.added);
  const tiers = runs.map((r) => r.out);
  const status = tiers.some((t) => t.result === 'fail') ? 'red'
    : tiers.some((t) => t.result === 'not-run' && t.reason !== 'empty-scope') ? 'not-run' : 'pass';
  const ran = runs.filter((r) => r.ran).map((r) => r.out.isolation);
  const isolation = ['shared-dev', 'ephemeral'].find((v) => ran.includes(v)) || null;
  const timing = { tiers: Object.fromEntries(runs.map((r) => [r.out.id, r.ms])) };
  const report = { ...env, isolation, status, timing, tiers };
  return { report, lines: summary(report, runs), exitCode: EXIT[status], warnings: [] };
}

module.exports = { run };
