'use strict';
// barrier (contract §5): each declared tier runs at the candidate tree under its
// bound, unless the cache already holds its pass there. A red suite fails the tier only when
// the same tier at base did not fail it by the same tests; the base comes from the cache (a pass,
// or a whole run's named fail), a worktree, or nowhere, and only when the candidate has a red suite.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runBounded, childEnv, hold, atStop } = require('./proc.cjs');
const { parseReport, totals, progress } = require('./reports.cjs');
const { envelope, stableJson, byCodeUnit, fmtDuration, redact } = require('./envelope.cjs');
const { changedFiles, subtreeOf, filesAt, isTracked, worktreeAdd, worktreeRemove } = require('./git.cjs');
const { selectTests } = require('./select.cjs');

const MIN = 60000;
const RED = new Set(['fail', 'error']);
const IN_PLACE = ['candidate', 'whole']; // a record's `from`: measured in the checkout, never in a base worktree
const EXIT = { pass: 0, red: 1, 'not-run': 4 };
const TIMES = ['candidate_ms', 'base_ms', 'rerun_ms', 'cleanup_ms'];
const [FAILURES_CAP, NAMES_CAP] = [50, 200];
const TIMED_OUT = /TimeoutException|timed out|Exceeded timeout/i; // a failure's first line that says the test ran out of time
const quote = (s) => `'${s.replace(/'/g, "'\\''")}'`;
const byFile = (a, b) => byCodeUnit(a.file, b.file);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const recordAt = (x, key) => key && x.cache.records[`${tierDigest(x.tier)}@${key}`];
const copyOf = (tier) => (tier.base && tier.base.copy) || [];
// The declared base.copy paths where a side ran: sorted ([] when none is declared), or false when one is missing there.
const inputsAt = (x, dir) => copyOf(x.tier).every((p) => fs.existsSync(path.join(dir, p))) && [...copyOf(x.tier)].sort(byCodeUnit);
// A record serves a red or a reuse only if measured with every input the tier declares now (by path: contents are unseen).
const fed = (x, rec) => Array.isArray(rec.inputs) && copyOf(x.tier).every((p) => rec.inputs.includes(p));
// A file's failing names in a record (an error suite's: null); none when it passed there, or its rerun excused it as flaky.
const namesOf = (rec, file) => (rec.failing && Object.hasOwn(rec.failing, file) && !(rec.flaky || []).includes(file) ? rec.failing[file] : undefined);

function readCache(file) {
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (c && c.records && typeof c.records === 'object') return { seq: Number(c.seq) || 0, records: c.records };
  } catch { /* no cache yet, or an unreadable one: start empty */ }
  return { seq: 0, records: {} };
}

// A record keeps the seq its tree was first recorded at, so first_seen stays the oldest red. Only a whole run replaces a
// whole run's record, and a base worktree's never replaces one measured in place: a compared run must not reset a verdict.
const put = (cache, key, rec) => {
  const old = cache.records[key];
  if (old && ((old.whole && !rec.whole) || (rec.from === 'base' && IN_PLACE.includes(old.from)))) return;
  cache.records[key] = { ...rec, seq: old ? old.seq : (cache.seq += 1) };
};

// A lock's holder, and whether it is stale: its pid is gone, or the lock is over a minute old (one that vanished: neither).
function holder(lock) {
  let pid = '?';
  try { pid = fs.readFileSync(lock, 'utf8').trim() || '?'; if (Date.now() - fs.statSync(lock).mtimeMs > MIN) return [pid, true]; } catch { return [pid, false]; }
  try { if (Number(pid) > 0) process.kill(Number(pid), 0); return [pid, false]; } catch (e) { return [pid, e.code === 'ESRCH']; }
}
const pidIn = (file) => { try { return fs.readFileSync(file, 'utf8').trim() || '?'; } catch { return null; } };

// Re-read before writing: the cache is shared, and another run may have written since. One writer at a time, by a lock holding
// its pid: a stale lock is broken at once, a live one waited on for waitMs, then left; a writer whose lock was broken writes nothing.
async function writeCache(file, added, waitMs = 30000) {
  const [lock, tmp, aside, warnings] = [`${file}.lock`, `${file}.${process.pid}`, `${file}.${process.pid}.stale`, []];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const until = Date.now() + waitMs; ;) {
    try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); break; } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const [pid, stale] = holder(lock);
    if (stale) { // moved aside, and dropped only if it still holds the pid judged gone: a lock taken since goes back, by a link
      try { fs.renameSync(lock, aside); if (pidIn(aside) === pid) warnings.push(`broke a stale cache lock ${lock} (pid ${pid})`); else fs.linkSync(aside, lock); }
      catch { /* another writer moved it first, or a newer lock took its place: the link never replaces one */ } finally { fs.rmSync(aside, { force: true }); }
    } else if (Date.now() >= until) return [...warnings, `cache not written: ${lock} held by ${pid}`];
    else await sleep(100);
  }
  try {
    const cache = readCache(file);
    for (const [key, rec] of Object.entries(added)) put(cache, key, rec);
    fs.writeFileSync(tmp, `${JSON.stringify({ version: 1, ...cache }, null, 2)}\n`);
    if (pidIn(lock) === String(process.pid)) fs.renameSync(tmp, file); else warnings.push(`cache not written: ${lock} was broken by another writer`);
  } finally { fs.rmSync(tmp, { force: true }); if (pidIn(lock) === String(process.pid)) fs.rmSync(lock, { force: true }); }
  return warnings;
}

// What a side measured at its key: each red file with its failing names (sorted, capped; an error suite's: null), where it
// ran (`from`: candidate or whole in the checkout, base in a worktree), and the declared inputs it ran with.
function record(x, at, side, selection, { from, dir, flaky = [], reason = side.reason }) {
  const tree = keyOf(x, at);
  if (!tree) return;
  const key = `${tierDigest(x.tier)}@${tree}`;
  const red = side.suites.filter((s) => RED.has(s.result));
  const names = (s) => (s.result === 'error' ? null : s.failures.map((f) => f.name).sort(byCodeUnit).slice(0, NAMES_CAP));
  x.added[key] = { tree, result: side.result, reason, selection, tests: side.tests, red: red.map((s) => s.file),
    failing: Object.fromEntries(red.map((s) => [s.file, names(s)])), ...(flaky.length ? { flaky } : {}),
    ...(from === 'whole' ? { whole: true } : {}), from, inputs: inputsAt(x, dir) };
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
  const c = await runBounded({ command: x.tier.cleanup, cwd, env, boundMs: (x.tier.cleanup_minutes || 1) * MIN, logFile: logFile(x, `${name}-cleanup`) });
  x.cleanup.push({ side: name.replace(/-\d+$/, ''), exit: c.exitCode }); // a batch's cleanup is its side's
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

// One invocation over `select` (null: $SELECT empty), its bound doubled once after a timeout when `retry`. A runner killed
// mid-run proved nothing, whatever its report says; one that timed out keeps counts at most: its report read tolerantly, or
// its log's last progress line.
async function once(x, name, select, { dir, env, bound, retry }) {
  const { tier } = x;
  const cwd = path.join(dir, tier.cwd);
  const rel = `.cleancode/barrier/${tier.id}.${name}.${tier.report === 'junit' ? 'xml' : 'json'}`;
  const picked = select ? select.map((f) => quote(path.posix.relative(tier.cwd, f))).join(' ') : '';
  // A function replacement: a `$&` or `$'` in a selected path reaches the runner as written.
  const command = (name.startsWith('rerun') ? tier.rerun : tier.run).replace(/\$(REPORT|SELECT)\b/g, (m, k) => (k === 'REPORT' ? rel : picked));
  const opts = { command, cwd, env: childEnv(x.ctx.env, env), rel };
  let r = await attempt(x, name, { ...opts, boundMs: bound * MIN });
  let ms = r.ms;
  if (r.timedOut && retry) {
    bound *= 2;
    r = await attempt(x, name, { ...opts, boundMs: bound * MIN });
    ms += r.ms;
  }
  const died = !r.timedOut && (r.exitCode >= 128 || r.signal);
  const parsed = !died && parseReport(tier.report, r.text, { cwd: tier.cwd, runnerCwd: tier.runner_cwd || cwd, tierId: tier.id,
    exit: r.exitCode, partial: r.timedOut });
  const status = r.timedOut ? 'timeout' : died ? 'died' : parsed ? 'ok' : 'no-report';
  return { files: select, command, ms, bound, status, r, survivors: r.survivors, suites: status === 'ok' ? parsed.suites : [],
    partial: r.timedOut && (parsed && parsed.suites.length ? totals(parsed.suites) : progress(r.tail)),
    evidence: { exit: r.exitCode, log: shown(x.ctx.root, logFile(x, name)), log_sha256: r.logSha256, head: r.head, tail: r.tail } };
}

async function side(x, name, { dir, select, env, expect, list = select }) {
  const { tier } = x;
  const B = tier.select && tier.select.batch_files;
  // A whole run (--whole, a whole_on selection, a whole rerun) or one past select.max, nearly whole, takes whole_minutes when
  // longer. With batch_files only --whole does, and no side retries at twice its bound: the bound holds per invocation.
  const big = B ? x.whole : select === null || (tier.select && tier.select.max !== undefined && select.length > tier.select.max);
  const bound = big ? Math.max(tier.whole_minutes || 0, tier.bound_minutes) : tier.bound_minutes;
  const retry = !B && x.onTimeout === 'retry-2x' && name !== 'rerun';
  // A list past batch_files (a whole_on candidate's: every test file) runs sorted, in contiguous slices of at most B files.
  const sorted = B && !x.whole && list && list.length > B ? [...list].sort(byCodeUnit) : null;
  const cuts = sorted ? Array.from({ length: Math.ceil(sorted.length / B) }, (_, i) => sorted.slice(i * B, (i + 1) * B)) : [select];
  const slices = [];
  for (const [i, files] of cuts.entries()) slices.push(await once(x, sorted ? `${name}-${i + 1}` : name, files, { dir, env, bound, retry }));
  return merge(slices, Boolean(sorted), (sorted ? name !== 'base' && sorted : expect) || []);
}

// Only an ok slice gives suites; a timed-out one, counts. Unbatched, a timeout, a dead runner, no report, nothing run and a
// selected file the runner skipped (no evidence of a pass) each come before a red; batched, a red comes first, and `rest`
// keeps what else stands for when no red is newly red.
function merge(slices, batched, expect) {
  const ok = slices.filter((s) => s.status === 'ok');
  const suites = ok.flatMap((s) => s.suites).sort(byFile);
  const counted = [...suites, ...slices.map((s) => s.partial).filter(Boolean)];
  const tests = ok.length || counted.length ? totals(counted) : null;
  const at = (s, why) => [batched && `batch ${slices.indexOf(s) + 1}/${slices.length} (${s.files[0]})`, why].filter(Boolean).join(': ') || null;
  const [late, dead] = [slices.find((s) => s.status === 'timeout'), slices.find((s) => s.status === 'died' || s.status === 'no-report')];
  const missing = expect.filter((f) => !suites.some((s) => s.file === f));
  const vacuous = (detail, more) => ({ result: 'not-run', reason: 'vacuous', detail, ...more });
  const rest = late ? { result: 'not-run', reason: 'timeout', detail: at(late) }
    : dead ? vacuous(at(dead, dead.status === 'died' && `the runner died (exit ${dead.r.exitCode}${dead.r.signal ? `, ${dead.r.signal}` : ''})`))
      : tests.executed === 0 ? vacuous(null) : missing.length ? vacuous(`${plural(missing.length, 'selected file')} never ran`, { missing }) : null;
  const red = suites.some((s) => RED.has(s.result));
  const sum = (k) => (slices.some((s) => s[k] === null) ? null : slices.reduce((n, s) => n + s[k], 0));
  const shownSlice = slices.find((s) => s.status !== 'ok') || ok.find((s) => s.suites.some((t) => RED.has(t.result))) || slices[slices.length - 1];
  return { ...(red && (batched || !rest) ? { result: 'fail', reason: 'assertion' } : rest || { result: 'pass', reason: null }), rest,
    command: slices[0].command, ms: sum('ms'), tests, suites: batched || !rest ? suites : [], evidence: shownSlice.evidence,
    bounded: { bound_minutes: slices[0].bound, timed_out: Boolean(late), survivors: sum('survivors'), ...(batched ? { batches: slices.length } : {}) },
    ...(batched ? { ran: ok.flatMap((s) => s.files), unrun: slices.filter((s) => s.status !== 'ok').flatMap((s) => s.files),
      batches: slices.map((s) => ({ files: s.files, exit: s.r.exitCode, timed_out: s.r.timedOut, log: s.evidence.log })) } : {}) };
}

// The base, the first that applies: a record that serves (then no worktree runs, so a prepare that fails cannot flip a carried
// red), a worktree, none. A pass serves when it covers every red file; a named fail only from a whole run with the inputs
// declared now, as a compared run's red, or a worktree's, may be its environment's.
async function baseSide(x, select, red) {
  const { ctx, tier } = x;
  const tree = x.tree.baseTree;
  const none = (source, reason, detail) => ({ source, tree, result: 'not-run', reason, tests: null, suites: [], detail });
  const rec = recordAt(x, keyOf(x, tree));
  const files = red.map((s) => s.file);
  if (rec && rec.result === 'pass' && (rec.selection === null || files.every((f) => rec.selection.includes(f)))) {
    return { source: 'inherited', tree, result: 'pass', reason: null, tests: rec.tests, suites: [] };
  }
  if (rec && rec.whole === true && rec.result === 'fail' && rec.selection === null && rec.failing && fed(x, rec)) {
    const at = (file, names = namesOf(rec, file)) => ({ file, result: names === undefined ? 'pass' : names ? 'fail' : 'error',
      failures: (names || []).map((name) => ({ name })) });
    return { source: 'inherited', tree, result: 'fail', reason: rec.reason || 'assertion', tests: rec.tests, suites: files.map((f) => at(f)) };
  }
  if (!tier.base || tier.base.mode !== 'worktree') return none('none', 'unmeasured');
  // Only the red files, where each red suite has one, and of those only what git holds at base: one the branch added has no
  // base suite, so it is newly red against the base; when every red file is new, no worktree runs.
  const want = tier.scope === 'change-selected' && red.every((s) => s.hasFile) ? files : select;
  const list = want && filesAt(ctx.root, ctx.base.sha, want);
  if (list && !list.length) return { source: 'none', tree, result: 'pass', reason: null, tests: null, suites: [], detail: 'no red file exists at base' };
  const [copy, started] = [copyOf(tier), Date.now()];
  const copied = copy.length ? { copied: [...copy].sort(byCodeUnit) } : {};
  const home = ctx.env.CCG_WORKTREE_DIR || os.tmpdir();
  fs.mkdirSync(home, { recursive: true });
  // Named for its own unique folder, so git registers it as ccg-barrier-XXXXXX: ours alone, removed by that name.
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(home, 'ccg-barrier-')));
  const dir = path.join(parent, path.basename(parent));
  const env = { ...tier.env, ...tier.base.env };
  // Removed on every path, a signal's included (the engine holds signals for the whole run), even mid-add.
  const gone = () => { worktreeRemove(ctx.root, dir); fs.rmSync(parent, { recursive: true, force: true }); };
  const drop = atStop(gone);
  try {
    try { worktreeAdd(ctx.root, ctx.base.sha, dir); }
    catch (e) { return none('worktree', 'vacuous', redact(e.message.split(dir).join('<worktree>')).replace(/\s+/g, ' ').slice(0, 300)); }
    // Inputs git does not hold come from the checkout, links followed; one it holds, however spelled or reached, would bring the branch's bytes.
    const held = (p) => p.split('/').some((_, i, s) => { const at = fs.lstatSync(path.join(dir, ...s.slice(0, i + 1)), { throwIfNoEntry: false });
      return Boolean(at) && (i === s.length - 1 || !at.isDirectory()); }); // in the fresh worktree, or a link or file on the way (it may lead out)
    const real = (p) => fs.existsSync(path.join(ctx.root, p)) && path.relative(fs.realpathSync(ctx.root), fs.realpathSync(path.join(ctx.root, p)));
    const bad = copy.map((p) => ([p, real(p)].some((q) => q && isTracked(ctx.root, ctx.base.sha, q)) || held(p) ? `copy: ${p} is tracked`
      : fs.existsSync(path.join(ctx.root, p)) ? null : `copy: ${p} missing`)).find(Boolean);
    if (bad) return none('worktree', 'vacuous', bad);
    for (const p of copy) try { fs.cpSync(path.join(ctx.root, p), path.join(dir, p), { recursive: true, dereference: true }); }
    catch (e) { return none('worktree', 'vacuous', `copy: ${p}: ${e.code || 'failed'}`); } // a pipe, a socket, a permission
    if (tier.base.prepare) {
      const p = await runBounded({ command: tier.base.prepare, cwd: path.join(dir, tier.cwd), env: childEnv(ctx.env, env),
        boundMs: (tier.base.prepare_minutes || 15) * MIN, logFile: logFile(x, 'base-prepare') });
      if (p.exitCode !== 0) return { ...none('worktree', 'vacuous', `prepare ${p.timedOut ? 'timed out' : `exit ${p.exitCode}`}`), ...copied };
    }
    const s = await side(x, 'base', { dir, select: list, env });
    if (s.result !== 'not-run') record(x, tree, s, s.ran || list, { from: 'base', dir });
    return { source: 'worktree', tree, ...s, ...copied };
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
    } else { // no-base: the base measured nothing, or not this file (its batch never finished)
      out.newly_red.push({ file: s.file, basis: base.result === 'not-run' || (base.unrun || []).includes(s.file) ? 'no-base' : 'base', failing,
        reproduced: false });
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
    inherited: null, reused: null, command: null, result: 'pass', reason: null, detail: null, selection: null, unresolved: null,
    unmapped: null, candidate: null, base: null, newly_red: [], carried: [], flaky: [], cleanup: x.cleanup };
  const skip = (reason, detail = null) => ({ out: { ...out, result: 'not-run', reason, detail }, ms: {}, ran: false });
  // A branch that moved or dropped the tier's directory cannot take the barrier down: that tier alone measured nothing.
  if (!fs.existsSync(path.join(b.ctx.root, tier.cwd))) return skip('vacuous', 'cwd missing');
  const key = keyOf(x, x.tree.candidateTree);
  const rec = recordAt(x, key);
  if (b.ifChanged && rec && rec.whole) {
    // Same inputs, same whole-run verdict: report it again, never re-run it, a fail included (it was said once already).
    // Only a --whole run's own record counts: a compared run's side had no rerun, and its red may be carried.
    const flaky = rec.flaky || [];
    const red = rec.red.filter((file) => !flaky.includes(file));
    return { out: { ...out, inherited: key, result: red.length ? 'fail' : 'pass', reason: red.length ? rec.reason || 'assertion' : null, flaky,
      newly_red: red.map((file) => ({ file, basis: 'no-base', failing: namesOf(rec, file) || [], reproduced: false })) }, ms: {}, ran: false };
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
  // Never under --whole: a pass measured in place at this very key, with the inputs declared now and a selection covering
  // this one (a whole run: a whole pass), is reused and nothing runs. A fail is never reused.
  if (!b.whole && rec && IN_PLACE.includes(rec.from) && rec.result === 'pass' && fed(x, rec)
    && (rec.selection === null || (select !== null && select.every((f) => rec.selection.includes(f))))) {
    const tests = select === null || (rec.selection !== null && rec.selection.length === select.length) ? rec.tests : null;
    return { out: { ...out, reused: key, candidate: { result: 'pass', reason: null, tests, suites: [], bounded: null, evidence: null } }, ms: {}, ran: false };
  }
  const cand = await side(x, 'candidate', { dir: b.ctx.root, select, env: tier.env, expect: select, list: out.selection });
  x.ms.candidate_ms = cand.ms;
  const red = cand.suites.filter((s) => RED.has(s.result)).sort(byFile);
  // A whole run measures this tree's own state: it compares nothing, so every red suite is red.
  const base = !red.length ? null : b.whole ? { source: 'none', tree: x.tree.baseTree, result: 'not-run', reason: 'unmeasured', tests: null,
    suites: [], detail: 'a whole run compares nothing' } : await baseSide(x, select, red);
  if (base) classify(x, out, red, base);
  if (tier.rerun && out.newly_red.length) await rerun(x, out, cand);
  // A newly red suite fails the tier: by test timeouts when each of its failures' first line says so, else by assertion.
  // Otherwise a candidate that did not finish (a batch that never did, beside carried reds) is not-run, never a pass.
  const timedOut = (s) => s.result === 'fail' && s.failures.length > 0 && s.failures.every((f) => TIMED_OUT.test(f.message));
  const failed = out.newly_red.length ? (red.filter((s) => out.newly_red.some((n) => n.file === s.file)).every(timedOut) ? 'timeout' : 'assertion') : null;
  const left = failed ? null : cand.result === 'not-run' ? cand : cand.rest;
  Object.assign(out, { result: failed ? 'fail' : left ? 'not-run' : 'pass', reason: failed || (left && left.reason), detail: (left && left.detail) || null });
  // After the rerun, so the record keeps the flaky reds and the reason. A pass covers its ask (a whole_on list: null), a batched fail what finished.
  const [from, dir, ran] = [b.whole ? 'whole' : 'candidate', b.ctx.root, cand.result === 'pass' ? select : cand.ran || select];
  if (cand.result !== 'not-run') record(x, x.tree.candidateTree, cand, ran, { from, dir, flaky: out.flaky, reason: failed || cand.reason });
  out.command = cand.command;
  out.candidate = { result: cand.result, reason: cand.reason, tests: cand.tests, suites: red.map(shownSuite), bounded: cand.bounded,
    evidence: cand.evidence, ...((left || cand).missing ? { missing: (left || cand).missing } : {}), ...(cand.batches ? { batches: cand.batches } : {}) };
  out.base = base && { source: base.source, tree: base.tree, result: base.result, reason: base.reason, tests: base.tests,
    ...(base.detail ? { detail: base.detail } : {}), ...(base.copied ? { copied: base.copied } : {}) };
  const ms = Object.fromEntries(TIMES.filter((k) => x.ms[k] !== undefined).map((k) => [k, x.ms[k]]));
  return { out, ms, ran: true, exitOnly: tier.report === 'exit-code' };
}

// ---- the summary ---------------------------------------------------------------

function summary(report, runs) {
  const facts = [];
  const [newly, timeouts, carried, flaky, unmapped, bases] = [[], [], [], [], [], []];
  for (const { out: t, ms, exitOnly } of runs) {
    const why = t.result === 'not-run' ? ` (${t.reason}${t.detail ? `: ${t.detail}` : ''})` : t.reason === 'timeout' ? ' (test timeouts)' : '';
    const kept = t.inherited ? ` (unchanged since a whole run at ${t.inherited.slice(0, 8)})`
      : t.reused ? ` (reused, unchanged at ${t.reused.slice(0, 8)})` : '';
    const head = `${t.id}${t.whole ? ' whole' : t.scope === 'change-selected' ? ' change-selected' : ''} ${t.result}${why}${kept}`;
    // A changed file no graph node or glob covers may still reach a test: said even when nothing was selected.
    const u = t.unmapped || [];
    if (u.length) unmapped.push(`unmapped: ${t.id} ${u.length} (${u[0]}${u.length > 1 ? `, +${u.length - 1} more` : ''})`);
    if (!t.candidate || t.reused) { // skipped, inherited or reused: an inherited verdict names its suites, uncounted (nothing ran)
      facts.push(head);
      newly.push(...t.newly_red.map((n) => `newly red: ${n.file} (unchanged)`));
      flaky.push(...t.flaky.map((f) => `flaky: ${f} (unchanged)`));
      continue;
    }
    const suite = (file) => t.candidate.suites.find((s) => s.file === file);
    const counts = (s) => `${s.failed ?? '?'}/${s.executed ?? '?'}`;
    const first = t.newly_red[0] && suite(t.newly_red[0].file);
    const more = t.newly_red.length > 1 ? `, +${t.newly_red.length - 1} more` : '';
    // The tier's whole time (its cleanups too), then the base's and the rerun's where they ran.
    const parts = ['base', 'rerun'].filter((k) => ms[`${k}_ms`] !== undefined).map((k) => `${k} ${fmtDuration(ms[`${k}_ms`])}`);
    facts.push(`${head} ${fmtDuration(TIMES.reduce((n, k) => n + (ms[k] || 0), 0))}${parts.length ? ` (${parts.join(', ')})` : ''}`
      + `${first ? ` (newly red: ${first.file} ${counts(first)}${more})` : ''}${exitOnly ? ' (exit-code only)' : ''}`);
    for (const n of t.newly_red) {
      const s = suite(n.file);
      newly.push(`newly red: ${n.file} ${counts(s)} — ${n.failing[0] || s.message || `exit ${t.candidate.evidence.exit}`}`);
    }
    const { bounded } = t.candidate;
    if (bounded.timed_out) timeouts.push(`timeout: ${t.id} after ${bounded.bound_minutes}m, survivors ${bounded.survivors ?? '?'}`);
    for (const c of t.carried) carried.push(`carried: ${c.file} (since ${c.first_seen.slice(0, 8)}, owner unassigned)`);
    for (const f of t.flaky) flaky.push(`flaky: ${f} ${counts(suite(f))} (green on rerun)`);
    if (t.base) bases.push(`base: ${t.id} ${t.base.source}${t.base.detail ? ` (${[t.base.reason, t.base.detail].filter(Boolean).join(': ')})` : ''}`
      + `${t.base.copied ? ` (copied: ${t.base.copied.join(', ')})` : ''}`);
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
  const warnings = Object.keys(b.added).length ? await writeCache(cacheFile, b.added, ctx.io.lockWaitMs) : [];
  const tiers = runs.map((r) => r.out);
  const status = tiers.some((t) => t.result === 'fail') ? 'red'
    : tiers.some((t) => t.result === 'not-run' && t.reason !== 'empty-scope') ? 'not-run' : 'pass';
  const ran = runs.filter((r) => r.ran).map((r) => r.out.isolation);
  const isolation = ['shared-dev', 'ephemeral'].find((v) => ran.includes(v)) || null;
  const timing = { tiers: Object.fromEntries(runs.map((r) => [r.out.id, r.ms])) };
  const report = { ...env, isolation, status, timing, tiers };
  return { report, lines: summary(report, runs), exitCode: EXIT[status], warnings };
}

module.exports = { run };
