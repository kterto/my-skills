"use strict";
// The apply engine. It orders the planned edits by `requires`, runs each through its writer's op on an in-memory
// working copy, writes what changed atomically behind the clean-target gate, keeps every before-byte in a journal,
// re-plans until nothing changes (two passes at most), and restores every file it touched when a finding one of its
// edits claimed to fix is still open. Writers own their file formats; this file owns everything around them.

const { CRITERIA, FINDINGS, CONVENTIONS } = require("./lib/vocab.cjs");
const { digest, safePath, readRaw, writeAtomic, removeFile, removeEmptyDir, gitDirty } = require("./lib/io.cjs");
const { unified } = require("./lib/diff.cjs");

const WRITERS = Object.freeze({
  gradle: require("./writers/gradle.cjs"),
  android: require("./writers/android.cjs"),
  pbxproj: require("./writers/pbxproj.cjs"),
  apple: require("./writers/apple.cjs"),
  icons: require("./writers/icons.cjs"),
  envfiles: require("./writers/envfiles.cjs"),
  dart: require("./writers/dart.cjs"),
});
const MAX_PASSES = 2;
const SECRET = /^env\/|(^|\/)google-services\.json$|GoogleService-Info\.plist$/;

const base = (e) => `${e.writer}.${e.op}`;
const same = (a, b) => (a === null || b === null ? a === b : a.equals(b));
const findingsOf = (ev) => [...CRITERIA.flatMap((c) => ev.criteria[c].findings), ...ev.repo];
const keyOf = (f) => `${f.code}|${f.env || ""}|${f.ref || ""}`;

// Depth-first over `requires`, keeping the planned order otherwise. A requirement names an edit id, or its base id
// for every per-environment edit of that op; one that is not planned this pass is already satisfied.
function order(edits) {
  const ids = new Set();
  for (const e of edits) { if (ids.has(e.id)) throw new Error(`the plan holds ${e.id} twice`); ids.add(e.id); }
  const out = [];
  const state = new Map();
  const visit = (e, trail) => {
    if (state.get(e.id) === "done") return;
    if (state.get(e.id) === "open") throw new Error(`edit cycle: ${[...trail, e.id].join(" -> ")}`);
    state.set(e.id, "open");
    for (const r of e.requires) for (const dep of edits.filter((x) => x.id === r || x.id.startsWith(`${r}:`))) visit(dep, [...trail, e.id]);
    state.set(e.id, "done");
    out.push(e);
  };
  for (const e of edits) visit(e, []);
  return out;
}

// The tree an op sees. Ops on one file chain through `staged`; the disk is read once per path.
function workingCopy(root) {
  const disk = new Map();
  const staged = new Map();
  const notes = [];
  const original = (rel) => { if (!disk.has(rel)) disk.set(rel, readRaw(root, rel)); return disk.get(rel); };
  const current = (rel) => (staged.has(rel) ? staged.get(rel).data : original(rel));
  const stage = (rel, id, data) => {
    safePath(root, rel);
    const s = staged.get(rel) || { data: null, edits: new Set() };
    s.data = data;
    s.edits.add(id);
    staged.set(rel, s);
  };
  const note = (rel, id, kind, text) => { safePath(root, rel); notes.push({ file: rel, edit: id, kind, note: String(text) }); };
  const tree = (e) => ({
    read: (rel) => { const b = current(rel); return b === null ? null : b.toString("utf8"); },
    readBytes: (rel) => { const b = current(rel); return b === null ? null : Buffer.from(b); },
    write: (rel, content) => stage(rel, e.id, Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8")),
    remove: (rel) => stage(rel, e.id, null),
    conflict: (rel, text) => note(rel, e.id, "conflict", text),
    foreign: (rel, text) => note(rel, e.id, "foreign", text),
  });
  const changed = () => [...staged].filter(([rel, s]) => !same(original(rel), s.data)).map(([rel, s]) => ({ file: rel, before: original(rel), after: s.data, edits: [...s.edits] }));
  return { tree, changed, staged, notes, original };
}

function runPass(root, edits, ctx, writers) {
  const wc = workingCopy(root);
  const ran = [];
  for (const e of order(edits)) {
    const op = writers[e.writer] && writers[e.writer].ops && writers[e.writer].ops[e.op];
    if (!op) throw new Error(`${e.id} is planned, but writers/${e.writer}.cjs has no op ${e.op}`);
    const from = wc.notes.length;
    op(wc.tree(e), e.args, ctx);
    ran.push({ edit: e, notes: wc.notes.slice(from) });
  }
  return { wc, ran };
}

// The findings of `ev` that an edit claimed: its code is in the edit's `fixes`, its ref is the edit's op, and the edit
// met no conflict or foreign file. Each must be gone after the writes.
function claims(ev, ran) {
  const open = findingsOf(ev).filter((f) => FINDINGS[f.code].fix === "edit" && !f.blocked);
  const out = [];
  for (const { edit, notes } of ran) {
    if (!edit.fixes.length || notes.length) continue;
    for (const f of open) if (f.ref === base(edit) && edit.fixes.includes(f.code) && (!edit.env || !f.env || f.env === edit.env)) out.push({ edit: edit.id, finding: f });
  }
  return out;
}

function gate(root, rels, { allowDirty, repo }) {
  if (allowDirty || !rels.length) return null;
  if (!repo) return ["refused: the app is not in a git repository, so nothing would show or undo what apply writes; pass --allow-dirty only on the owner's word"];
  const dirty = gitDirty(root, rels);
  if (!dirty.length) return null;
  return [`refused: apply would modify ${dirty.length === 1 ? "a file that has" : `${dirty.length} files that have`} uncommitted changes; commit them first, or pass --allow-dirty on the owner's word`, ...dirty.map((d) => `  ${d}`)];
}

// What a dry run prints for one file: env and Firebase values become their 8-hex digest before diffing, so a changed
// value shows as a changed line and no value is printed; binaries are named only.
function shown(rel, buf) {
  if (buf === null) return null;
  if (buf.includes(0)) return `(binary, ${buf.length} bytes, sha1 ${digest(buf)})\n`;
  const text = buf.toString("utf8");
  if (!SECRET.test(rel)) return text;
  return text.replace(/(:\s*)"((?:[^"\\]|\\.)*)"/g, (m, pre, v) => `${pre}"${v ? `<value ${digest(v)}>` : ""}"`)
    .replace(/(:\s*)(-?\d[\w.+-]*|true|false)(?=\s*[,}\n])/g, (m, pre, v) => `${pre}<value ${digest(v)}>`)
    .replace(/<string>([^<]*)<\/string>/g, (m, v) => `<string><value ${digest(v)}></string>`);
}

function apply({ root, evaluate, spec = null, dryRun = false, allowDirty = false, now = null, writers = WRITERS }) {
  const stamp = now || new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const journal = new Map();
  const dirs = [];
  const rows = new Map();
  const notes = [];
  const rounds = [];
  const remember = (rel, writer, ids) => {
    const row = rows.get(rel) || { writer, edits: new Set() };
    for (const id of ids) row.edits.add(id);
    rows.set(rel, row);
  };
  const absorb = (pass) => {
    for (const [rel, s] of pass.wc.staged) remember(rel, [...s.edits][0].split(".")[0], [...s.edits]);
    for (const n of pass.wc.notes) { remember(n.file, n.edit.split(".")[0], [n.edit]); notes.push(n); }
  };
  const write = (list) => {
    for (const c of list) {
      if (!journal.has(c.file)) journal.set(c.file, c.before);
      if (c.after === null) removeFile(root, c.file);
      else dirs.push(...writeAtomic(root, c.file, c.after));
    }
  };
  const restore = () => {
    for (const [rel, bytes] of [...journal].reverse()) { if (bytes === null) removeFile(root, rel); else writeAtomic(root, rel, bytes); }
    for (const d of [...dirs].reverse()) removeEmptyDir(root, d);
  };
  const withStamp = (ctx) => ({ ...ctx, stamp });

  let first = evaluate();
  const repo = first.ctx.facts.git.repo;
  const tracked = (rel) => !!(repo && first.ctx.io.git.tracked(rel));
  let pass;
  try { pass = runPass(root, first.edits, withStamp(first.ctx), writers); }
  catch (e) { return { code: 1, error: e.message, receipt: null }; }
  const specChange = spec === null ? null : (() => {
    const before = readRaw(root, CONVENTIONS.specFile);
    const after = Buffer.from(spec, "utf8");
    if (!same(before, after)) return { file: CONVENTIONS.specFile, before, after, edits: [] };
    return null;
  })();
  if (spec !== null) remember(CONVENTIONS.specFile, "envfiles", []);
  absorb(pass);
  const pending = [...(specChange ? [specChange] : []), ...pass.wc.changed()];

  if (dryRun) {
    const diff = pending.map((c) => unified(c.file, shown(c.file, c.before), shown(c.file, c.after))).join("");
    const final = new Map(pending.map((c) => [c.file, c.after]));
    const receipt = build({ rows, notes, original: (rel) => readRaw(root, rel), final: (rel) => (final.has(rel) ? final.get(rel) : readRaw(root, rel)), tracked, leftovers: [], converged: false, rolledBack: false, passes: 0 });
    return { code: 0, diff, receipt: { ...receipt, dryRun: true } };
  }

  const refusal = gate(root, pending.map((c) => c.file), { allowDirty, repo });
  if (refusal) return { code: 2, refused: refusal, receipt: null };
  const pre = new Map();
  const before = (rel) => { if (!pre.has(rel)) pre.set(rel, journal.has(rel) ? journal.get(rel) : readRaw(root, rel)); return pre.get(rel); };
  for (const rel of rows.keys()) before(rel);
  try { write(pending); }
  catch (e) { restore(); return { code: 1, error: `a write failed, so every file was restored: ${e.message}`, receipt: null }; }
  rounds.push({ ev: first.ev, ran: pass.ran });

  let passes = 1;
  let final;
  let settled = null;
  try {
    for (;;) {
      final = evaluate();
      const next = runPass(root, final.edits, withStamp(final.ctx), writers);
      for (const rel of next.wc.staged.keys()) before(rel);
      for (const n of next.wc.notes) before(n.file);
      const changes = next.wc.changed();
      if (!changes.length || passes >= MAX_PASSES) { settled = { pass: next, changes }; break; }
      absorb(next);
      const again = gate(root, changes.map((c) => c.file).filter((f) => !journal.has(f)), { allowDirty, repo });
      if (again) { restore(); return { code: 2, refused: [...again, "the first pass's writes were restored, so the tree is as it was"], receipt: null, rolledBack: true }; }
      write(changes);
      rounds.push({ ev: final.ev, ran: next.ran });
      passes++;
    }
  } catch (e) {
    restore();
    return { code: 1, error: `${e.message}; every file was restored`, receipt: null, rolledBack: true };
  }
  absorb({ wc: { staged: new Map(), notes: settled.pass.wc.notes.filter((n) => !notes.some((o) => o.file === n.file && o.edit === n.edit)) } });

  const open = new Set(findingsOf(final.ev).map(keyOf));
  const broken = rounds.flatMap((r) => claims(r.ev, r.ran)).filter((c) => open.has(keyOf(c.finding)));
  const planned = new Set(final.edits.map(base));
  const conflicted = new Set(notes.filter((n) => n.kind === "conflict").map((n) => n.edit.split(":")[0]));
  // A finding whose edit met a file the owner replaced is left for them, with the writer's way to take it back.
  const skipped = (f) => notes.some((n) => n.kind === "foreign" && n.edit.split(":")[0] === f.ref && (!f.env || !n.edit.includes(":") || n.edit.split(":")[1] === f.env));
  const remedy = (f) => { const w = writers[f.ref.split(".")[0]]; return w && w.remedies && w.remedies.foreign ? `foreign: ${w.remedies.foreign}` : "foreign"; };
  const leftovers = findingsOf(final.ev).filter((f) => FINDINGS[f.code].fix === "edit").map((f) => ({
    ...f, pending: f.blocked ? `blocked: ${f.blocked}` : conflicted.has(f.ref) ? "conflict" : skipped(f) ? remedy(f) : !planned.has(f.ref) ? "no edit planned" : "not closed by its edit",
  }));
  if (broken.length) {
    // The receipt shows what was written before the restore; nothing is left to undo.
    const receipt = build({ rows, notes, original: before, final: (rel) => readRaw(root, rel), tracked, leftovers, converged: false, rolledBack: true, passes });
    restore();
    const named = [...new Map(broken.map((b) => [keyOf(b.finding), b])).values()];
    return { code: 1, receipt: { ...receipt, undo: { restore: [], remove: [] }, broken: named.map((b) => ({ code: b.finding.code, env: b.finding.env, claim: b.finding.claim, edit: b.edit })) } };
  }
  const converged = settled.changes.length === 0 && !conflicted.size;
  const receipt = build({ rows, notes, original: before, final: (rel) => readRaw(root, rel), tracked, leftovers, converged, rolledBack: false, passes });
  return { code: conflicted.size ? 1 : 0, receipt };
}

// The receipt: one change per file the run staged or noted, its state from the first before-bytes to the last
// after-bytes, and the two undo lists the skill prints and never runs.
function build({ rows, notes, original, final, tracked, leftovers, converged, rolledBack, passes }) {
  const changes = [...rows].map(([file, row]) => {
    const was = original(file);
    const now = final(file);
    const mine = notes.filter((n) => n.file === file);
    const conflict = mine.find((n) => n.kind === "conflict");
    const foreign = mine.find((n) => n.kind === "foreign");
    const state = !same(was, now) ? (was === null ? "created" : now === null ? "removed" : "updated") : conflict ? "conflict" : foreign ? "skipped" : "unchanged";
    const note = mine.map((n) => `${n.kind === "foreign" ? "foreign" : "conflict"}: ${n.note}`).join("; ");
    return {
      writer: row.writer, file, state,
      ...(was !== null ? { before: digest(was) } : {}), ...(now !== null ? { after: digest(now) } : {}),
      ...(note ? { note } : {}), edits: [...row.edits],
    };
  });
  return {
    schema: 1, changes, converged, rolledBack, passes,
    leftovers,
    undo: {
      restore: changes.filter((c) => (c.state === "updated" || c.state === "removed") && tracked(c.file)).map((c) => c.file),
      remove: changes.filter((c) => c.state === "created").map((c) => c.file),
    },
  };
}

// A recipe's snippet, rendered by the writer that owns the format, from the data a criterion described.
function snippet({ writer, name, args }, writers = WRITERS) {
  const fn = writers[writer] && writers[writer].snippets && writers[writer].snippets[name];
  if (!fn) throw new Error(`writers/${writer}.cjs renders no snippet ${name}`);
  return fn(args);
}

module.exports = { apply, snippet, order, WRITERS };
