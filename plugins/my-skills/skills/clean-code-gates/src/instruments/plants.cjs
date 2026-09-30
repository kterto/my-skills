'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { byCodeUnit } = require('./envelope.cjs');

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const journalOf = (root) => path.join(root, '.cleancode', 'plant-journal.json');
const lockOf = (root) => path.join(root, '.cleancode', 'plant.lock');
// The pid of a live proof that holds the lock, else null: a dead holder's lock is stale.
function holder(root) {
  let pid;
  try { pid = Number(fs.readFileSync(lockOf(root), 'utf8')); } catch { return null; }
  try { return pid > 0 && pid !== process.pid && process.kill(pid, 0) ? pid : null; } catch (e) { return e.code === 'EPERM' ? pid : null; }
}
// Bytes neither planted nor original are someone's edit: left alone, and the journal, the only copy of the original, is kept.
function orphan(root, files) {
  const kept = path.join('.cleancode', `plant-journal.${new Date().toISOString().replace(/:/g, '-')}.orphan.json`);
  if (fs.existsSync(journalOf(root))) fs.renameSync(journalOf(root), path.join(root, kept));
  return `plant journal: ${files} matches neither its original nor its planted bytes; left alone, the original kept in ${kept}`;
}

const count = (text, find) => { let n = 0; for (let i = text.indexOf(find); find && i !== -1; i = text.indexOf(find, i + 1)) n++; return n; };

// Undoes a proof that died mid-plant: a journalled file still holding its planted bytes gets its original back.
// A live proof's journal is left alone.
function recover(root) {
  const journal = journalOf(root);
  let entries;
  try { entries = JSON.parse(fs.readFileSync(journal, 'utf8')); } catch (e) {
    return e.code === 'ENOENT' ? [] : [`plant journal ${journal} is unreadable (${e.message}); left in place`];
  }
  const pid = holder(root);
  if (pid) return [`plant journal left in place: the proof that wrote it is still running (pid ${pid})`];
  const [warnings, stale] = [[], []];
  for (const e of entries) {
    const abs = path.join(root, e.file);
    let now = null;
    try { now = path.isAbsolute(e.file) || e.file.split('/').includes('..') ? null : sha(fs.readFileSync(abs)); } catch { /* gone */ }
    if (now === e.sha256_planted) {
      fs.writeFileSync(abs, Buffer.from(e.original_base64, 'base64'));
      warnings.push(`restored ${e.file}: a planted-offender proof was interrupted`);
    } else if (now !== e.sha256_original) stale.push(e.file);
  }
  if (stale.length) warnings.push(orphan(root, stale.join(', ')));
  fs.rmSync(journal, { force: true });
  return warnings;
}

// A command guard only sees disk. The journal lands before the edit, and every path, a signal too, writes back the original
// bytes from memory (bar an edit: see orphan), then drops the journal once they verify. A signal re-raises unless the runner will.
async function onDisk(root, plant, run, warnings) {
  const abs = path.join(root, plant.file);
  const original = fs.readFileSync(abs);
  const planted = Buffer.from(plant.planted);
  const journal = journalOf(root);
  fs.mkdirSync(path.dirname(journal), { recursive: true });
  fs.writeFileSync(`${journal}.tmp`, JSON.stringify([{ file: plant.file, sha256_original: sha(original),
    original_base64: original.toString('base64'), sha256_planted: sha(planted) }]));
  fs.renameSync(`${journal}.tmp`, journal);
  const restore = () => {
    const now = fs.existsSync(abs) ? sha(fs.readFileSync(abs)) : null;
    if (![null, sha(planted), sha(original)].includes(now)) return orphan(root, plant.file);
    fs.writeFileSync(abs, original);
    if (sha(fs.readFileSync(abs)) !== sha(original)) throw new Error(`plant restore failed for ${plant.file}; journal kept at ${journal}`);
    fs.rmSync(journal, { force: true });
    return null;
  };
  let caught = null;
  const off = () => SIGNALS.forEach((s) => process.removeListener(s, onSignal));
  function onSignal(sig) {
    caught = sig;
    off();
    try { const w = restore(); if (w) process.stderr.write(`warning: ${w}\n`); } catch { /* the journal stays for the next invocation */ }
    if (!process.listenerCount(sig)) process.kill(process.pid, sig);
  }
  SIGNALS.forEach((s) => process.on(s, onSignal));
  try {
    fs.writeFileSync(abs, planted);
    return await run();
  } finally {
    off();
    warnings.push(...[restore()].filter(Boolean));
    if (caught) throw new Error(`planted-offender proof interrupted by ${caught}`);
  }
}

/**
 * The planted-offender proof (§7.5). `run(overlay, tag)` resolves the guard's §7.6 entry; shape and consumers plants reach
 * it as an in-memory overlay. A plant is ok only when it flips the guard. An on-disk proof holds `.cleancode/plant.lock`:
 * no other proof starts while it is alive.
 */
async function prove(guard, run, root, read) {
  const plants = (guard.plants || []).map((p) => {
    const text = read(p.file);
    const n = text == null ? 0 : count(text, p.find);
    if (n !== 1) throw Object.assign(new Error(`plant "${p.name}" of guard ${guard.id}: find occurs ${n} times in ${p.file}; `
      + 'it must occur exactly once'), { exitCode: 3 });
    const i = text.indexOf(p.find);
    return { ...p, planted: text.slice(0, i) + p.replace + text.slice(i + p.find.length) };
  });
  const pid = holder(root);
  if (pid) throw Object.assign(new Error(`a planted-offender proof is already running (pid ${pid})`), { exitCode: 3 });
  const lock = guard.kind === 'command' && lockOf(root);
  if (lock) { fs.mkdirSync(path.dirname(lock), { recursive: true }); fs.writeFileSync(lock, String(process.pid)); }
  try {
    const [entry, results, warnings] = [await run(null, null), [], []];
    for (const [k, p] of plants.entries()) {
      const tag = `plant${k + 1}`;
      const { status: got } = guard.kind === 'command' ? await onDisk(root, p, () => run(null, tag), warnings)
        : await run(new Map([[p.file, p.planted]]), tag);
      results.push({ name: p.name, expect: p.expect, got, ok: got === p.expect && got !== entry.status });
    }
    results.sort((a, b) => byCodeUnit(a.name, b.name));
    const proven = results.length > 0 && results.every((r) => r.ok) && entry.status !== 'not-run';
    return { entry, proof: { guard: guard.id, unplanted: entry.status, plants: results, proven }, warnings };
  } finally {
    if (lock) fs.rmSync(lock, { force: true });
  }
}

module.exports = { prove, recover };
