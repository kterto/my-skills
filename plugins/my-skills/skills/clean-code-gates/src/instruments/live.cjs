'use strict';
// `gates.cjs live` (contract §8): report the block, bring the stack up with typed failures, read a store back and take
// the stack down. Every command the block names runs through the bounded runner, from the repo root.
const cp = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { envelope, byCodeUnit, redact } = require('./envelope.cjs');
const { runBounded } = require('./proc.cjs');

const MIN = 60_000;
const VERDICT = { pass: ['pass', 0], fail: ['red', 1], 'not-run': ['not-run', 4] }; // result → status, exit
// The last eight are a database or container that is down, in libpq's and docker's own words.
const ENV_SIGNS = new RegExp(['Cannot connect to the Docker daemon', 'Is the docker daemon running', 'port is already allocated',
  'permission denied while trying to connect to the Docker daemon', 'address already in use', 'EADDRINUSE', 'ECONNREFUSED',
  '\\bP1001\\b', "Can't reach database server", 'getaddrinfo ENOTFOUND', 'no space left on device', 'connection refused',
  'could not connect to server', 'connection to server at', 'is the server running', 'no such container', 'error during connect',
  'docker\\.sock', 'timeout expired'].join('|'), 'i');
const SQLSTATES = '\\b(42701|42P07|42710|42P01|42703|42601)\\b';
const DEFECT_SIGNS = new RegExp(`\\bP30(18|09|06|05)\\b|duplicate key|syntax error at or near|${SQLSTATES}`, 'i');
const GENERIC = /already exists|does not exist/i;
// An error line: ERROR or FATAL (case-sensitive), a SQLSTATE, or a Prisma P30xx code heading it.
const ERROR_LINE = new RegExp(`ERROR|FATAL|SQLSTATE|${SQLSTATES}|^\\s*(Error: )?P30\\d\\d\\b`);
const signed = (l) => ENV_SIGNS.test(l) || DEFECT_SIGNS.test(l) || GENERIC.test(l) || ERROR_LINE.test(l);
// Matched with quotes stripped, so `npx prisma@6 …` and `migrate 'reset'` are resets too.
const isReset = (command) => /prisma(@\S+)?\s+(db\s+push\b[^\n]*--force-reset|migrate\s+reset)/i.test(command.replace(/['"]/g, ''));
const usage = (message) => Object.assign(new Error(message), { exitCode: 3 });
const USAGE = 'usage: live check | up [--service <name>] | readback <store> <sql> | down [--service <name>]';
const dockerInspect = (argv) => cp.execFileSync(argv[0], argv.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 });
const timed = async (timing, key, fn, started = Date.now()) => { try { return await fn(); } finally { timing[key] = Date.now() - started; } };

/**
 * The type of a failed step, from its own output. A repo-defect signature always wins (a repo defect is never typed
 * env), but only where a benign line cannot carry it: on an error line, or for the db build's codes, on any line.
 */
function classify(step, { log = '' } = {}) {
  const lines = String(log).split('\n');
  const defect = (l) => (ERROR_LINE.test(l) && (DEFECT_SIGNS.test(l) || GENERIC.test(l) || /ERROR: {2}/.test(l))) || (step === 'db' && DEFECT_SIGNS.test(l));
  if (lines.some(defect)) return 'repo-defect';
  return step === 'db' && !lines.some((l) => ENV_SIGNS.test(l)) ? 'repo-defect' : 'blocked-env';
}

/** Why a destructive Prisma command is refused, or null. Consent counts only from the anchored merge-base block. */
async function consentGap({ block, io, anchored }, command) {
  const c = anchored && block.consent && block.consent.prisma_reset;
  if (block.isolation !== 'ephemeral') return `isolation is ${block.isolation}`;
  if (!c) return 'the anchored block carries no consent.prisma_reset';
  const url = URL.canParse(c.url) ? new URL(c.url) : {};
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.port) return 'the consent url is not 127.0.0.1 or localhost with a port';
  if ((command.match(/\w[\w+.-]*:\/\/[^\s'"]+/g) || []).some((u) => u !== c.url)) return 'the command names a database url other than the consent url';
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(c.container)) return 'the consent container is not a container name';
  let info;
  try { [info = {}] = JSON.parse(await (io.dockerInspect || dockerInspect)(['docker', 'inspect', '--type', 'container', c.container])); }
  catch { return `docker inspect ${c.container} failed`; }
  const ports = Object.values(info.NetworkSettings?.Ports || {}).flat().filter(Boolean);
  // A bind or a named volume can hold data worth keeping; an anonymous volume (a 64-hex name) cannot.
  const kept = (info.Mounts || []).some((m) => m.Type === 'bind' || (m.Type === 'volume' && !/^[0-9a-f]{64}$/.test(m.Name || '')));
  return !info.State?.Running ? `${c.container} is not running`
    : !ports.some((p) => p.HostPort === url.port) ? `${c.container} does not publish port ${url.port}`
      : info.Config?.Labels?.['ccg.ephemeral'] !== 'true' ? `${c.container} lacks the label ccg.ephemeral=true`
        : kept ? `${c.container} has a bind or named-volume mount` : null;
}

/**
 * Runs one block command, bounded, under the Prisma consent rule; null if refused. A consented reset gets the consent url
 * as its DATABASE_URL too, which outranks a `.env`, so it wipes the inspected container and nothing else.
 */
async function exec(st, command, label, boundMs, { reap = true, argv } = {}) {
  const reset = isReset(command);
  const gap = reset && (await consentGap(st, command));
  if (gap) { st.refused.push(command); st.lines.push(`refused: destructive Prisma command without anchored consent: ${redact(command)} (${gap})`); return null; }
  const url = reset ? st.block.consent.prisma_reset.url : undefined;
  const logFile = path.join(st.logDir, `live-${label}.log`);
  // The consent variable is set for the reset alone and cleared for every other command, an ambient one included.
  const env = { ...st.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: url, ...(reset ? { DATABASE_URL: url } : {}) };
  // Only the lines a signature could match are kept for typing: the log itself is never read whole.
  const r = await runBounded({ command, argv, cwd: st.root, env, boundMs, reap, logFile, keep: signed });
  const evidence = { log: path.relative(st.root, logFile), log_sha256: r.logSha256, head: r.head, tail: r.tail };
  return { ok: r.exitCode === 0 && !r.timedOut, exit: r.exitCode, timedOut: r.timedOut, log: r.kept.join('\n'), evidence };
}

/** Records a step's typed failure on its record and, when it is the first, on the run. */
function mark(st, rec, reason, out, label) {
  if (!reason) return false;
  Object.assign(rec, { result: ['blocked-env', 'timeout'].includes(reason) ? 'not-run' : 'fail', reason });
  st.failure = st.failure || { result: rec.result, reason };
  const ev = out && out.evidence;
  st.lines.push(`${label}: ${reason}${ev ? ` (exit ${out.exit}) — ${ev.log}` : ''}`, ...(ev ? ev.tail.slice(-5).map((l) => `  ${l}`) : []));
  return true;
}

/** `allowed_repairs`, each once and in order, at most once per run; true when the failed step may retry. */
async function repair(st) {
  const commands = st.block.allowed_repairs || [];
  if (st.repaired || !commands.length) return false;
  st.repaired = true;
  await timed(st.timing, 'repairs_ms', async () => {
    for (const [i, command] of commands.entries()) {
      const out = await exec(st, command, `repair-${i + 1}`, 5 * MIN);
      st.repairs.push({ command, exit: out ? out.exit : null });
      st.lines.push(`repair: ${command} → ${out ? `exit ${out.exit}` : 'refused'}`);
      if (!out) return;
    }
  });
  return !st.refused.length;
}

/** Runs a step and types its failure from its own output; an env failure gets the repairs, then one retry. */
async function attempt(st, kind, fn) {
  const type = (out) => (!out ? 'repo-defect' : out.ok ? null : classify(kind, out));
  let out = await fn('');
  if (type(out) === 'blocked-env' && (await repair(st))) out = await fn('-retry');
  return { out, reason: type(out) };
}

const httpOk = (url) => new Promise((resolve) => {
  try {
    (url.startsWith('https:') ? https : http).get(url, { agent: false, timeout: 5000 }, (res) => resolve(res.resume() && res.statusCode < 400 && res.statusCode >= 200))
      .on('timeout', function onTimeout() { this.destroy(); }).on('error', () => resolve(false));
  } catch { resolve(false); }
});
/** Polls `ready` every 2 s until the bound: a URL must answer 2xx or 3xx, a `cmd:` probe must exit 0. */
async function poll(st, name, probe, boundMs, suffix) {
  for (const deadline = Date.now() + boundMs; ; await new Promise((wake) => setTimeout(wake, Math.min(2000, deadline - Date.now())))) {
    const out = probe.startsWith('cmd:') ? await exec(st, probe.slice(4).trim(), `ready-${name}${suffix}`, 30_000)
      : { ok: await httpOk(probe), log: '' };
    if (!out || out.ok || Date.now() >= deadline) return out;
  }
}

function pick(st, args) {
  const all = Object.keys(st.block.services || {}).sort(byCodeUnit);
  if (args.length && !all.includes(args[1])) throw usage(`unknown service "${args[1]}" (declared: ${all.join(', ') || 'none'})`);
  return args.length ? [args[1]] : all;
}
function check({ block: b }) {
  const names = (key) => Object.keys(b[key] || {}).sort(byCodeUnit);
  return { block: { version: b.version, isolation: b.isolation, db_build: b.db_build || null, db: Boolean(b.db), services: names('services'),
    allowed_repairs: (b.allowed_repairs || []).length, surfaces: names('surfaces'), flows: names('flows'), readback: names('readback'), consent: Boolean(b.consent) } };
}

/** Services in name order, `up` (its daemons outlive it) then `ready`; then the db build. The first failure stops. */
async function up(st, args) {
  const services = [];
  st.timing.services = {};
  for (const name of pick(st, args)) {
    const svc = st.block.services[name];
    const bound = (svc.bound_minutes || 10) * MIN;
    const rec = { name, up: null, ready: null, result: 'pass', reason: null };
    const t = (st.timing.services[name] = {});
    services.push(rec);
    const u = await timed(t, 'up_ms', () => attempt(st, 'up', (sfx) => exec(st, svc.up, `up-${name}${sfx}`, bound, { reap: false })));
    if (u.out) rec.up = { exit: u.out.exit, evidence: u.out.evidence };
    if (mark(st, rec, u.reason, u.out, `up ${name}`)) break;
    const r = await timed(t, 'ready_ms', () => attempt(st, 'ready', (sfx) => poll(st, name, svc.ready, bound, sfx)));
    rec.ready = { ok: !r.reason, probe: svc.ready };
    if (mark(st, rec, r.reason, r.out, `ready ${name} (${svc.ready})`)) break;
  }
  const { db } = st.block;
  if (!db || st.failure) return { services, db: null, repairs: st.repairs, refused: st.refused };
  const d = await timed(st.timing, 'db_ms', () => attempt(st, 'db', (sfx) => exec(st, db.build, `db${sfx}`, (db.bound_minutes || 10) * MIN)));
  const rec = { build: db.build, exit: d.out ? d.out.exit : null, evidence: d.out ? d.out.evidence : null, result: 'pass', reason: null };
  mark(st, rec, d.reason, d.out, 'db build');
  return { services, db: rec, repairs: st.repairs, refused: st.refused };
}

async function down(st, args) {
  const services = [];
  st.timing.services = {};
  for (const name of pick(st, args).filter((n) => st.block.services[n].down)) {
    const out = await timed((st.timing.services[name] = {}), 'down_ms', () => exec(st, st.block.services[name].down, `down-${name}`, 5 * MIN));
    const rec = { name, down: out && { exit: out.exit, evidence: out.evidence }, result: 'pass', reason: null };
    services.push(rec);
    if (!out || !out.ok) mark(st, rec, 'repo-defect', out, `down ${name}`);
  }
  return { services, refused: st.refused };
}

const READ_START = /^\s*(select|with|show|explain|values|table)\b/i;
const WRITE_WORD = /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|copy|call|do|lock|vacuum|into)\b/i;
// A comment, then a quoted string or identifier; a quote, `$` or backslash left over makes quoting ambiguous.
const SQL_TOKEN = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|'')*'|"(?:[^"]|"")*")|[\s\S]/g;
/** Why `sql` is not provably read-only, or null. Ambiguous quoting is refused, never guessed. */
function readOnlyViolation(sql) {
  let [code, words] = ['', ''];
  for (const [tok, comment, quoted] of String(sql).matchAll(SQL_TOKEN)) {
    if (comment && comment.startsWith('/*') && comment.slice(2).includes('/*')) return 'a nested comment';
    if (!comment && !quoted && /['"$\\]/.test(tok)) return `an unquoted ${tok}`;
    code += comment ? ' ' : quoted ? '?' : tok;
    words += quoted ? '?' : tok;
  }
  if (!READ_START.test(code)) return 'it does not start with SELECT, WITH, SHOW, EXPLAIN, VALUES or TABLE';
  if (String(sql).trimEnd().replace(/;$/, '').includes(';')) return 'a ; other than one trailing';
  const w = WRITE_WORD.exec(words);
  return w ? `the word ${w[1].toUpperCase()} outside quotes` : null;
}

/** `<run> "$1"` with the SQL as its own argv element; stdout becomes the rows, stderr stays in the log. */
async function readback(st, [store, sql]) {
  const stores = st.block.readback || {};
  if (!Object.hasOwn(stores, store)) throw usage(`unknown store "${store}" (declared: ${Object.keys(stores).join(', ') || 'none'})`);
  const why = stores[store].read_only && readOnlyViolation(sql);
  if (why) throw usage(`refused: read-only store (${why})`);
  const rows = path.join(st.logDir, `live-readback-${store}.rows`);
  fs.rmSync(rows, { force: true });
  const argv = ['/bin/sh', '-c', `${stores[store].run} "$1" >"$2"`, 'sh', sql, rows];
  const out = await timed(st.timing, 'readback_ms', () => exec(st, stores[store].run, `readback-${store}`, st.io.readbackMs || 2 * MIN, { argv }));
  const lines = fs.existsSync(rows) ? fs.readFileSync(rows, 'utf8').split('\n') : [];
  if (lines[lines.length - 1] === '') lines.pop();
  // Past its bound the read-back measured nothing: not-run (timeout), never a verdict.
  if (out && !out.ok) mark(st, {}, out.timedOut ? 'timeout' : 'assertion', out, `readback ${store}`);
  const result = { store, sql, exit: out ? out.exit : null, rows: lines.slice(0, 200), truncated: lines.length > 200, evidence: out ? out.evidence : null };
  return { readback: result, refused: st.refused };
}

const MODES = { check, up, readback, down };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const FACTS = {
  check: ({ block: b }) => `${plural(b.services.length, 'service')} · db_build ${b.db_build || 'undeclared'} · ${plural(b.readback.length, 'store')}`,
  up: ({ services, db }) => [...services.map((s) => `${s.name} ${s.reason || 'ready'}`), ...(db ? [`db ${db.reason || 'built'}`] : [])].join(' · '),
  readback: ({ readback: r }) => `${r.store} exit ${r.exit} · ${plural(r.rows.length, 'row')}${r.truncated ? ' (truncated)' : ''}`,
  down: ({ services }) => services.map((s) => `${s.name} ${s.reason || 'down'}`).join(' · '),
};

async function run(ctx) {
  const [mode, ...args] = ctx.args || [];
  // cli.cjs hands the kind every token it does not own, so an argv outside the mode's shape is refused before anything runs.
  const shaped = mode === 'readback' ? args.length === 2 : !args.length || (mode !== 'check' && args.length === 2 && args[0] === '--service');
  if (!Object.hasOwn(MODES, mode) || !shaped) throw usage(`${USAGE} (got: ${[mode, ...args].join(' ') || 'nothing'})`);
  const live = ctx.instruments.live;
  if (live && live.error) throw usage(`invalid live block: ${live.error}`);
  const block = live ? live.block : null;
  // The envelope hashes the tree before any command runs: an `up` may leave pid files behind.
  const report = envelope({ kind: 'live', mode, root: ctx.root, base: ctx.base, instruments: ctx.instruments,
    isolation: block ? block.isolation : null, now: ctx.now, version: ctx.version });
  const st = { root: ctx.root, block, logDir: path.join(ctx.outDir, 'logs'), env: ctx.env || process.env, io: ctx.io || {},
    anchored: ctx.instruments.source === 'merge-base', timing: {}, lines: [], refused: [], repairs: [], failure: null, repaired: false };
  const body = block ? await MODES[mode](st, args) : {};
  const verdict = !block ? { result: 'not-run', reason: 'no-live-recipe' }
    : st.refused.length ? { result: 'fail', reason: 'repo-defect' } : st.failure || { result: 'pass', reason: null };
  const [status, exitCode] = VERDICT[verdict.result];
  Object.assign(report, { status, timing: st.timing }, verdict, body);
  const facts = block ? FACTS[mode](body) || 'nothing to run' : 'no-live-recipe (no ```live block under ## Test tooling)';
  const first = `LIVE ${status} · ${mode} · ${facts}${block ? ` · isolation: ${block.isolation}` : ''}`;
  return { report, lines: [first, ...st.lines], exitCode, warnings: [] };
}

module.exports = { run, classify, readOnlyViolation };
