"use strict";
// A minimal in-memory tree for driving writer ops the way the engine does: the six methods an op receives, over a
// fixture's files or a directory on disk, plus what a test reads back (each touched path's state, conflicts, foreign
// files), an io view for the read halves, and `flush` for the live harness. It also holds SHOP, the example app the
// op tests and the live harness configure, with its iOS and icon edits in the order the planner emits them.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { CONVENTIONS } = require("../../scripts/lib/vocab.cjs");
const apple = require("../../scripts/writers/apple.cjs");

const WRITERS = path.join(__dirname, "..", "..", "scripts", "writers");
const asBuffer = (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v, "utf8"));

// source: { rel: string | Buffer } (a fixture's files), or the path of an app directory to read lazily.
function memtree(source) {
  const onDisk = typeof source === "string";
  const files = onDisk ? null : new Map(Object.entries(source).filter(([, v]) => v !== null && v !== undefined).map(([rel, v]) => [rel, asBuffer(v)]));
  const read = new Map();
  const original = (rel) => {
    if (!onDisk) return files.has(rel) ? files.get(rel) : null;
    if (!read.has(rel)) {
      const p = path.join(source, rel);
      read.set(rel, fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p) : null);
    }
    return read.get(rel);
  };
  const staged = new Map();
  const conflicts = new Map();
  const foreign = new Map();
  const current = (rel) => (staged.has(rel) ? staged.get(rel) : original(rel));
  const tree = {
    read: (rel) => { const b = current(rel); return b === null ? null : b.toString("utf8"); },
    readBytes: (rel) => current(rel),
    write: (rel, data) => { staged.set(rel, asBuffer(data)); },
    remove: (rel) => { staged.set(rel, null); },
    conflict: (rel, note) => { conflicts.set(rel, note); },
    foreign: (rel, note) => { foreign.set(rel, note); },
  };
  const state = (rel) => {
    if (conflicts.has(rel)) return "conflict";
    if (foreign.has(rel)) return "foreign";
    if (!staged.has(rel)) return null;
    const before = original(rel);
    const after = staged.get(rel);
    if (after === null) return before === null ? "unchanged" : "removed";
    if (before === null) return "created";
    return before.equals(after) ? "unchanged" : "updated";
  };
  const touched = () => [...new Set([...staged.keys(), ...conflicts.keys(), ...foreign.keys()])].sort();
  const all = () => {
    if (onDisk) throw new Error("memtree: files() needs a fixture source");
    const out = new Map(files);
    for (const [rel, b] of staged) { if (b === null) out.delete(rel); else out.set(rel, b); }
    return out;
  };
  const io = {
    read: tree.read,
    readBinary: tree.readBytes,
    exists: (rel) => current(rel) !== null || io.list(rel).length > 0,
    isDir: (rel) => io.list(rel).length > 0,
    list(dir) {
      const prefix = dir ? `${dir}/` : "";
      const seen = new Map();
      for (const rel of all().keys()) {
        if (!rel.startsWith(prefix)) continue;
        const rest = rel.slice(prefix.length).split("/");
        seen.set(rest[0], seen.get(rest[0]) || rest.length > 1);
      }
      return [...seen].map(([name, isDir]) => ({ name, dir: isDir })).sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    walk(dir, { test = () => true } = {}) { return [...all().keys()].filter((rel) => rel.startsWith(dir ? `${dir}/` : "") && test(rel)).sort(); },
  };
  return {
    tree,
    io,
    staged,
    conflicts,
    foreign,
    state,
    changes: () => touched().map((file) => ({ file, state: state(file), note: conflicts.get(file) || foreign.get(file) || null })),
    files: () => Object.fromEntries(all()),
    flush(dir) {
      for (const rel of staged.keys()) original(rel);
      for (const [rel, b] of staged) {
        const p = path.join(dir, rel);
        if (b === null) fs.rmSync(p, { force: true });
        else { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, b); }
      }
    },
  };
}

// Runs edits through the writers the way the engine selects them: <writer>.<op>[:<env>] is writers/<writer>.cjs ops[op].
function apply(tree, edits, ctx) {
  for (const e of edits) {
    const [writer, rest] = e.id.split(".");
    require(path.join(WRITERS, `${writer}.cjs`)).ops[rest.split(":")[0]](tree, e.args, ctx);
  }
}

const SHOP = Object.freeze({
  envs: ["dev", "staging", "production"],
  production: "production",
  ids: { dev: "com.acme.shop.dev", staging: "com.acme.shop.staging", production: "com.acme.shop" },
  names: { dev: "Shop Dev", staging: "Shop Staging", production: "Shop" },
  badges: { dev: { label: CONVENTIONS.badgeLabels.dev, color: CONVENTIONS.badgeColors[0] }, staging: { label: CONVENTIONS.badgeLabels.staging, color: CONVENTIONS.badgeColors[1] } },
  minIos: CONVENTIONS.firebaseMinIos,
});
const PHASE_SCRIPT = fs.readFileSync(path.join(__dirname, "..", "..", "templates", "googleservice-phase.sh"), "utf8");

const configsOf = (spec) => spec.envs.flatMap((env) => CONVENTIONS.modes.map((mode) => ({ name: `${mode}-${env}`, mode, env })));
const others = (spec) => spec.envs.filter((env) => env !== spec.production);

// The iOS and icon edits for a spec, in the order a crash leaves harmless: icon sets and xcconfigs before the pbxproj
// that names them, the schemes after it, and Runner.xcscheme removed last.
function iosEdits(spec, { script = PHASE_SCRIPT } = {}) {
  const configs = configsOf(spec);
  const by = (f) => Object.fromEntries(configs.map((c) => [c.name, f(c)]));
  return [
    ...others(spec).map((env) => ({ id: `icons.ios:${env}`, args: { env, ...spec.badges[env] } })),
    { id: "apple.xcconfig-files", args: { configs: configs.map(({ mode, env }) => ({ mode, env })) } },
    { id: "apple.infoplist-name", args: { variable: CONVENTIONS.iosNameSetting } },
    { id: "apple.podfile-map", args: { configs: apple.podKinds(configs.map((c) => c.name)) } },
    { id: "apple.podfile-platform", args: { min: spec.minIos } },
    { id: "pbxproj.rename-plain", args: { production: spec.production } },
    { id: "pbxproj.clone-flavors", args: { production: spec.production, envs: spec.envs } },
    {
      id: "pbxproj.set-settings",
      args: {
        byConfig: by(({ env }) => ({ PRODUCT_BUNDLE_IDENTIFIER: spec.ids[env], DISPLAY_NAME: spec.names[env], ASSETCATALOG_COMPILER_APPICON_NAME: CONVENTIONS.iosIconSet(env, spec.production) })),
        testsIds: by(({ env }) => `${spec.ids[env]}.RunnerTests`),
      },
    },
    { id: "pbxproj.base-xcconfigs", args: { configs: configs.map((c) => c.name) } },
    { id: "pbxproj.shell-phase", args: { name: CONVENTIONS.deliveryPhase, script } },
    { id: "pbxproj.deployment-target", args: { min: spec.minIos } },
    { id: "apple.schemes", args: { envs: spec.envs, production: spec.production } },
  ];
}
const androidIconEdits = (spec) => others(spec).map((env) => ({ id: `icons.android:${env}`, args: { env, ...spec.badges[env] } }));

// Lines removed from `a` and added in `b`, from a longest common subsequence over lines.
function lineDiff(a, b) {
  const x = a.split("\n");
  const y = b.split("\n");
  const w = y.length + 1;
  const lcs = new Uint32Array((x.length + 1) * w);
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) lcs[i * w + j] = x[i] === y[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
  const removed = [];
  const added = [];
  let i = 0;
  let j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { i++; j++; } else if (j < y.length && (i === x.length || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) added.push(y[j++]);
    else removed.push(x[i++]);
  }
  return { removed, added };
}

const hasTool = (name) => spawnSync("/usr/bin/which", [name]).status === 0;

// plutil -lint on text, from a file in `dir` that is removed again.
function plutilLint(text, dir, name = "project.pbxproj") {
  const tmp = fs.mkdtempSync(path.join(dir, "lint-"));
  const file = path.join(tmp, name);
  fs.writeFileSync(file, text);
  const r = spawnSync("plutil", ["-lint", file], { encoding: "utf8" });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}`.trim() };
}

module.exports = { memtree, apply, SHOP, PHASE_SCRIPT, configsOf, iosEdits, androidIconEdits, lineDiff, hasTool, plutilLint };
