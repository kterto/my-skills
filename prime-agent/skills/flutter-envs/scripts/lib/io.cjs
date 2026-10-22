"use strict";
// The only door to the disk and to git. A read-through cache over the app root, git facts that never write
// (GIT_OPTIONAL_LOCKS=0 keeps `git status` from refreshing the index), a PATH probe that runs nothing, the app-root
// search, the guarded atomic writes apply uses, and the helpers that keep values out of output: digests and redaction.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const PRUNE = new Set(["build", ".dart_tool", "Pods", "node_modules", ".git", ".gradle", ".fvm", ".idea", "ephemeral", ".symlinks"]);
const digest = (value) => crypto.createHash("sha1").update(Buffer.isBuffer(value) ? value : String(value)).digest("hex").slice(0, 8);
// One newline index, kept for the last text asked about: readers ask many lines of one file in a row.
let indexed = { text: null, breaks: [] };
function lineAt(text, index) {
  if (indexed.text !== text) {
    const breaks = [];
    for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) breaks.push(i);
    indexed = { text, breaks };
  }
  let lo = 0;
  let hi = indexed.breaks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (indexed.breaks[mid] < index) lo = mid + 1;
    else hi = mid;
  }
  return lo + 1;
}
const at = (file, text, index) => `${file}:${lineAt(text, index)}`;

function attempt(fn) {
  try { return fn(); } catch { return null; }
}

function runGit(cwd, args, input) {
  const r = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  });
  return r.error ? { code: 128, out: "" } : { code: r.status, out: r.stdout };
}

const NO_GIT = Object.freeze({
  repo: false, toplevel: null, head: null, branch: null, clean: null, trackedFiles: [], tracked: () => null,
  ignored: (rels) => new Map(rels.map((r) => [r, null])),
});

function gitFacts(root) {
  const top = runGit(root, ["rev-parse", "--show-toplevel"]);
  if (top.code !== 0) return NO_GIT;
  const head = runGit(root, ["rev-parse", "--short", "HEAD"]);
  const branch = runGit(root, ["symbolic-ref", "--short", "-q", "HEAD"]);
  const files = runGit(root, ["ls-files", "-z"]).out.split("\0").filter(Boolean);
  const tracked = new Set(files);
  const status = runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=no", "--", "."]);
  const ignoredCache = new Map();
  return {
    repo: true,
    toplevel: top.out.trim(),
    head: head.code === 0 ? head.out.trim() : null,
    branch: branch.code === 0 ? branch.out.trim() : null,
    clean: status.code === 0 ? status.out.length === 0 : null,
    trackedFiles: files,
    tracked: (rel) => tracked.has(rel),
    // -> Map rel -> boolean, from one `check-ignore --no-index` call per batch (the index does not hide a rule).
    ignored(rels) {
      const ask = rels.filter((r) => !ignoredCache.has(r));
      if (ask.length) {
        const r = runGit(root, ["check-ignore", "--no-index", "-z", "--stdin"], ask.join("\0") + "\0");
        const hit = new Set(r.code === 0 ? r.out.split("\0").filter(Boolean) : []);
        for (const rel of ask) ignoredCache.set(rel, hit.has(rel));
      }
      return new Map(rels.map((r) => [r, ignoredCache.get(r)]));
    },
  };
}

function createIO(root, { git = true } = {}) {
  const base = path.resolve(root);
  const full = (rel) => {
    const p = path.resolve(base, rel);
    if (p !== base && !p.startsWith(base + path.sep)) throw new Error(`path outside the app root: ${rel}`);
    return p;
  };
  const texts = new Map();
  const bins = new Map();
  const dirs = new Map();
  let facts = null;
  const io = {
    root: base,
    read(rel) {
      if (!texts.has(rel)) texts.set(rel, attempt(() => fs.readFileSync(full(rel), "utf8")));
      return texts.get(rel);
    },
    readBinary(rel) {
      if (!bins.has(rel)) bins.set(rel, attempt(() => fs.readFileSync(full(rel))));
      return bins.get(rel);
    },
    exists: (rel) => attempt(() => fs.statSync(full(rel))) !== null,
    isDir: (rel) => attempt(() => fs.statSync(full(rel)).isDirectory()) === true,
    // -> sorted [{ name, dir }] of one directory, [] when absent.
    list(rel) {
      if (!dirs.has(rel)) {
        const entries = attempt(() => fs.readdirSync(full(rel), { withFileTypes: true })) || [];
        dirs.set(rel, entries.map((e) => ({ name: e.name, dir: e.isDirectory() })).sort((a, b) => (a.name < b.name ? -1 : 1)));
      }
      return dirs.get(rel);
    },
    // -> every file path under rel (relative to the app root), skipping build output and dependency trees.
    walk(rel, { maxDepth = 12, test = () => true } = {}) {
      const out = [];
      const visit = (dir, depth) => {
        for (const e of io.list(dir)) {
          const child = dir ? `${dir}/${e.name}` : e.name;
          if (e.dir) { if (depth < maxDepth && !PRUNE.has(e.name)) visit(child, depth + 1); }
          else if (test(child)) out.push(child);
        }
      };
      visit(rel, 0);
      return out;
    },
    get git() {
      if (!facts) facts = git ? gitFacts(base) : NO_GIT;
      return facts;
    },
    // A file of the enclosing git repository (CI configs live at a monorepo's root), read-only like the rest.
    readTop(rel) {
      const top = io.git.toplevel;
      if (!top || top === base) return top === base ? io.read(rel) : null;
      const p = path.resolve(top, rel);
      return p.startsWith(top + path.sep) ? attempt(() => fs.readFileSync(p, "utf8")) : null;
    },
    listTop(rel) {
      const top = io.git.toplevel;
      if (!top) return [];
      return (attempt(() => fs.readdirSync(path.resolve(top, rel), { withFileTypes: true })) || []).filter((e) => e.isFile()).map((e) => e.name).sort();
    },
    tool: (name) => findOnPath(name),
  };
  return io;
}

function findOnPath(name) {
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, name);
    if (attempt(() => (fs.accessSync(p, fs.constants.X_OK), fs.statSync(p).isFile()))) return { path: p };
  }
  return null;
}

const DEPENDS_ON_FLUTTER = /^[ \t]+flutter:[ \t]*\r?\n[ \t]+sdk:[ \t]*flutter\b/m;

function isApp(dir) {
  const pubspec = attempt(() => fs.readFileSync(path.join(dir, "pubspec.yaml"), "utf8"));
  if (!pubspec || !DEPENDS_ON_FLUTTER.test(pubspec)) return false;
  const has = (rel) => fs.existsSync(path.join(dir, rel));
  return has("android/app") || has("ios/Runner.xcodeproj");
}

// -> { root } or { candidates } when the search is ambiguous or empty. Looks at `start`, then at most three levels down.
function findRoot(start, maxDepth = 3) {
  const abs = path.resolve(start);
  if (isApp(abs)) return { root: abs, candidates: [abs] };
  const found = [];
  const visit = (dir, depth) => {
    if (depth > maxDepth) return;
    const entries = attempt(() => fs.readdirSync(dir, { withFileTypes: true })) || [];
    for (const e of entries) {
      if (!e.isDirectory() || PRUNE.has(e.name) || e.name.startsWith(".") || e.name === "example") continue;
      const child = path.join(dir, e.name);
      if (isApp(child)) found.push(child);
      else visit(child, depth + 1);
    }
  };
  visit(abs, 1);
  return found.length === 1 ? { root: found[0], candidates: found } : { root: null, candidates: found.sort() };
}

// The write side, for the apply engine only. These take the app root on every call and cache nothing, because an
// io instance caches its reads for one evaluation. A path that is absolute, leaves the root, enters .git or passes
// through a symbolic link is refused before any byte moves.
function safePath(root, rel) {
  if (typeof rel !== "string" || !rel || path.isAbsolute(rel)) throw new Error(`refused path ${JSON.stringify(rel)}: not relative to the app root`);
  const base = path.resolve(root);
  const p = path.resolve(base, rel);
  if (!p.startsWith(base + path.sep)) throw new Error(`refused path ${rel}: outside the app root`);
  const parts = path.relative(base, p).split(path.sep);
  if (parts.includes(".git")) throw new Error(`refused path ${rel}: under .git`);
  let cur = base;
  for (const part of parts) {
    cur = path.join(cur, part);
    const st = attempt(() => fs.lstatSync(cur));
    if (!st) break;
    if (st.isSymbolicLink()) throw new Error(`refused path ${rel}: ${path.relative(base, cur)} is a symbolic link`);
  }
  return p;
}

const readRaw = (root, rel) => { const p = safePath(root, rel); return attempt(() => fs.readFileSync(p)); };

// Writes through a temp file in the same folder and a rename, keeping an existing file's mode. -> the folders it had to
// create, outermost first, relative to the root, so a rollback can remove them again.
function writeAtomic(root, rel, data) {
  const p = safePath(root, rel);
  const created = [];
  for (let d = path.dirname(p); !fs.existsSync(d); d = path.dirname(d)) created.unshift(path.relative(path.resolve(root), d));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = path.join(path.dirname(p), `.${path.basename(p)}.flutter-envs-${process.pid}.tmp`);
  const mode = attempt(() => fs.statSync(p).mode);
  try {
    fs.writeFileSync(tmp, data);
    if (mode !== null) fs.chmodSync(tmp, mode & 0o7777);
    fs.renameSync(tmp, p);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return created;
}

const removeFile = (root, rel) => fs.rmSync(safePath(root, rel), { force: true });
// Removes a folder only when it is empty, so a rollback never deletes what someone else put there.
const removeEmptyDir = (root, rel) => { attempt(() => fs.rmdirSync(safePath(root, rel))); };

// -> the paths among rels (relative to root) that git tracks and that differ from HEAD or the index.
function gitDirty(root, rels) {
  if (!rels.length) return [];
  const prefix = runGit(root, ["rev-parse", "--show-prefix"]);
  const pre = prefix.code === 0 ? prefix.out.trim() : "";
  const r = runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=no", "--", ...rels]);
  const hit = new Set();
  const parts = r.out.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (!entry) continue;
    if (/[RC]/.test(entry.slice(0, 2))) i++;
    const file = entry.slice(3);
    if (file.startsWith(pre)) hit.add(file.slice(pre.length));
  }
  return rels.filter((rel) => hit.has(rel));
}

// Replaces every secret value (four characters or more) in text, longest first, so output can never carry one.
function redact(text, secrets) {
  let out = String(text);
  for (const s of [...new Set(secrets)].filter((x) => typeof x === "string" && x.length >= 4).sort((a, b) => b.length - a.length)) {
    out = out.split(s).join("<redacted>");
  }
  return out;
}

module.exports = { createIO, findRoot, isApp, redact, digest, lineAt, at, safePath, readRaw, writeAtomic, removeFile, removeEmptyDir, gitDirty };
