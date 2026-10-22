"use strict";
// The app's own files around the environment: env/*.json (key names and digests; only the label and project-id values
// are read as text), the ignore files, the Makefile, pubspec.yaml, the FVM pins, firebase.json, CI files and the git
// state of signing material. The write half: env/.gitignore, the sample, the skeletons, key merges (with a backup
// before a value changes), the app .gitignore blocks, the Makefile block and default-flavor. Values never leave here.

const { at, digest } = require("../lib/io.cjs");
const { readBlock, ensureBlock } = require("../lib/managed.cjs");
const { CONVENTIONS } = require("../lib/vocab.cjs");
const { render } = require("../lib/templates.cjs");
const { nativeFacts, deriveKeys } = require("../lib/firebase-keys.cjs");

const SAMPLE = /(^|\/|[._-])(sample|example|template)\.json$/i;
const LABEL_KEYS = ["NAME", "ENV", "ENVIRONMENT", "FLAVOR", "APP_ENV", "name", "env", "environment"];
const PROJECT_KEYS = ["FIREBASE_PROJECT_ID", "firebase_projectId", "FIREBASE_PROJECTID"];

function envFile(io, rel) {
  const text = io.read(rel);
  let json;
  try { json = JSON.parse(text); } catch (e) { return { file: rel, error: e.message, keys: [], digests: {}, empty: [], nested: [] }; }
  if (!json || typeof json !== "object" || Array.isArray(json)) return { file: rel, error: "not a JSON object", keys: [], digests: {}, empty: [], nested: [] };
  const keys = Object.keys(json);
  const scalar = (v) => v !== null && v !== undefined && typeof v !== "object";
  const pick = (names) => { const k = names.find((n) => scalar(json[n]) && String(json[n]) !== ""); return k ? { key: k, value: String(json[k]) } : null; };
  return {
    file: rel, error: null, keys,
    label: pick(LABEL_KEYS), project: pick(PROJECT_KEYS),
    digests: Object.fromEntries(keys.filter((k) => scalar(json[k]) && String(json[k]) !== "").map((k) => [k, digest(String(json[k]))])),
    empty: keys.filter((k) => json[k] === "" || json[k] === null),
    nested: keys.filter((k) => !scalar(json[k]) && json[k] !== null),
    at: Object.fromEntries(keys.map((k) => { const i = text.indexOf(JSON.stringify(k)); return [k, at(rel, text, Math.max(i, 0))]; })),
  };
}

const lines = (text) => (text || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

function makefile(io) {
  const rel = ["Makefile", "makefile", "GNUmakefile"].find((f) => io.read(f) !== null);
  if (!rel) return null;
  const text = io.read(rel);
  const targets = [];
  const vars = {};
  let current = null;
  text.split("\n").forEach((line, n) => {
    if (/^\t/.test(line) && current) { current.recipe.push(line.trim()); return; }
    const v = /^([A-Za-z_][\w-]*)\s*(\?=|:=|=)\s*(.*)$/.exec(line);
    if (v && !/^[\w.-]+\s*:[^=]/.test(line)) { vars[v[1]] = v[3].trim(); current = null; return; }
    const t = /^([A-Za-z0-9_.%/$()-][^:=#]*?)\s*:(?!=)\s*([^#]*)/.exec(line);
    if (t && !line.startsWith(".")) {
      for (const name of t[1].trim().split(/\s+/)) targets.push(current = { name, prereqs: t[2].trim(), recipe: [], at: `${rel}:${n + 1}` });
      return;
    }
    if (!/^\s*$/.test(line) && !/^\s*#/.test(line) && !/^\s*(ifeq|ifneq|ifdef|ifndef|else|endif)\b/.test(line)) current = null;
  });
  // Recipes with $(VAR) expanded, so a flag kept in a variable still counts; $(shell ...) that picks flutter reads as flutter.
  const expand = (line, depth = 0) => (depth > 6 ? line : line.replace(/\$[({]([A-Za-z_][\w-]*)[)}]/g, (whole, name) => {
    if (!(name in vars)) return whole;
    const value = vars[name];
    return /\$\(shell/.test(value) ? (/flutter/.test(value) ? "flutter" : "") : expand(value, depth + 1);
  }));
  for (const t of targets) t.recipe = t.recipe.map((l) => expand(l));
  return { file: rel, targets, vars, managed: !!readBlock(text, { id: "makefile", syntax: "hash" }), awk: /awk\s+'\{print\s+"--dart-define="/.test(text) };
}

// The few pubspec.yaml facts the checks need, from its indentation, without a YAML parser.
function pubspec(io) {
  const text = io.read("pubspec.yaml");
  if (text === null) return null;
  const section = (name) => {
    const m = new RegExp(`^${name}:[ \\t]*\\r?\\n((?:[ \\t]+.*\\r?\\n|[ \\t]*\\r?\\n|#.*\\r?\\n)*)`, "m").exec(`${text}\n`);
    return m ? m[1] : "";
  };
  const keys = (block) => [...block.matchAll(/^ {2}([A-Za-z0-9_]+):/gm)].map((m) => m[1]);
  const flutter = section("flutter");
  const defaultFlavor = /^[ \t]+default-flavor:[ \t]*["']?([\w-]+)/m.exec(flutter);
  const assets = [...flutter.matchAll(/^[ \t]+-[ \t]+["']?([^"'\s#]+)/gm)].map((m) => m[1]);
  const env = section("environment");
  return {
    name: (/^name:\s*["']?([\w]+)/m.exec(text) || [])[1] || null,
    deps: keys(section("dependencies")), devDeps: keys(section("dev_dependencies")),
    defaultFlavor: defaultFlavor ? { value: defaultFlavor[1], at: at("pubspec.yaml", text, text.indexOf(defaultFlavor[0].trim())) } : null,
    assets,
    sdk: (/^[ \t]+sdk:[ \t]*["']?([^"'\n]+)/m.exec(env) || [])[1] || null,
    flutterConstraint: (/^[ \t]+flutter:[ \t]*["']?([^"'\n]+)/m.exec(env) || [])[1] || null,
  };
}

function flutterPin(io) {
  const fvmrc = io.read(".fvmrc");
  const parsed = fvmrc && (() => { try { return JSON.parse(fvmrc); } catch { return null; } })();
  if (parsed && typeof parsed.flutter === "string") return { version: parsed.flutter, via: ".fvmrc" };
  const legacy = io.read(".fvm/fvm_config.json");
  const old = legacy && (() => { try { return JSON.parse(legacy); } catch { return null; } })();
  if (old && typeof old.flutterSdkVersion === "string") return { version: old.flutterSdkVersion, via: ".fvm/fvm_config.json" };
  return null;
}

function firebaseJson(io) {
  const text = io.read("firebase.json");
  if (text === null) return null;
  try {
    const platforms = ((JSON.parse(text).flutter) || {}).platforms || {};
    const outputs = (p) => Object.values(platforms[p] || {}).map((v) => v && v.fileOutput).filter(Boolean);
    const dart = Object.keys(platforms.dart || {});
    return { file: "firebase.json", dart, missing: dart.filter((d) => !io.exists(d)), outputs: [...outputs("android"), ...outputs("ios")] };
  } catch (e) {
    return { file: "firebase.json", error: e.message, dart: [], outputs: [] };
  }
}

function ciFiles(io) {
  const out = [];
  const add = (rel, text, where) => { if (text !== null) out.push({ file: rel, where, text }); };
  for (const rel of ["codemagic.yaml", "bitrise.yml", ".gitlab-ci.yml", "azure-pipelines.yml"]) { add(rel, io.read(rel), "app"); add(rel, io.readTop(rel), "repo"); }
  for (const name of io.list(".github/workflows").filter((e) => !e.dir).map((e) => e.name)) add(`.github/workflows/${name}`, io.read(`.github/workflows/${name}`), "app");
  for (const name of io.listTop(".github/workflows")) add(`.github/workflows/${name}`, io.readTop(`.github/workflows/${name}`), "repo");
  return out.filter((c, i) => !out.slice(0, i).some((o) => o.text === c.text)).map(({ file, where, text }) => ({
    file, where,
    writesFirebase: /google-services\.json|GoogleService-Info\.plist|GOOGLE_SERVICES_JSON|GOOGLE_SERVICE_INFO_PLIST/.test(text),
  }));
}

const SIGNING = /(\.p8|\.p12|\.jks|\.keystore|(^|\/)key\.properties|\.mobileprovision)$/i;
const CERTS = /(\.cer|\.certSigningRequest)$/i;

function read(io) {
  const envDir = io.list("env").filter((e) => !e.dir && e.name.endsWith(".json")).map((e) => `env/${e.name}`);
  const files = envDir.map((rel) => envFile(io, rel));
  const tracked = io.git.repo ? io.git.trackedFiles : [];
  const rootDotenvs = io.list("").filter((e) => !e.dir && /^\.env(\.[\w-]+)?$/.test(e.name)).map((e) => e.name);
  const gitignore = io.read(".gitignore");
  return {
    envDir: io.isDir("env"),
    // FlutterFire configs (firebase_dev.json) and old copies (dev.old.json) are not environments.
    files: files.filter((f) => !SAMPLE.test(f.file) && CONVENTIONS.envPattern.test(f.file.slice(4, -5))),
    sample: (() => { const f = files.find((x) => SAMPLE.test(x.file)); return f ? { ...f, tracked: io.git.repo ? io.git.tracked(f.file) : null } : null; })(),
    envGitignore: io.read("env/.gitignore") === null ? null : lines(io.read("env/.gitignore")),
    envGitignoreTracked: io.git.repo ? io.git.tracked("env/.gitignore") : null,
    rootGitignore: lines(gitignore),
    // The lines of each flutter-envs block in the app .gitignore, by block id.
    ignoreBlocks: Object.fromEntries(["firebase-production", "env-backups", "firebase-copies"].map((id) => [id, readBlock(gitignore || "", { id, syntax: "hash" })])
      .filter(([, b]) => b).map(([id, b]) => [id, lines(b.body)])),
    iosGitignore: lines(io.read("ios/.gitignore")),
    makefile: makefile(io),
    pubspec: pubspec(io),
    pin: flutterPin(io),
    firebaseJson: firebaseJson(io),
    ci: ciFiles(io),
    dotenvs: rootDotenvs,
    dotenvIgnores: lines(gitignore).filter((l) => /^\/?\.env(\.|$)/.test(l)),
    platforms: ["macos", "web", "linux", "windows"].filter((p) => io.isDir(p)),
    scripts: io.list("scripts").filter((e) => !e.dir).map((e) => `scripts/${e.name}`),
    signingTracked: tracked.filter((f) => SIGNING.test(f)),
    certificatesTracked: tracked.filter((f) => CERTS.test(f)),
  };
}

// ---- write half: ops over the engine's tree ----

const MAKEFILES = ["Makefile", "makefile", "GNUmakefile"];
const ENV_IGNORE = ["*", "!.gitignore", "!sample.json"];
const withEol = (text) => (!text || text.endsWith("\n") ? text : `${text}\n`);

// A flat JSON object with what re-serialising needs to keep the file's shape: its indent and its last newline.
function parseObject(text) {
  let value;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { value, indent: (/^([ \t]+)"/m.exec(text) || [, "  "])[1], newline: text.endsWith("\n") };
}
const serialize = (value, like = { indent: "  ", newline: true }) => `${JSON.stringify(value, null, like.indent)}${like.newline ? "\n" : ""}`;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Rewrites a JSON object file only when its content changes, so formatting a person chose survives a no-op.
function writeObject(tree, rel, text, parsed, next) {
  tree.write(rel, equal(parsed.value, next) ? text : serialize(next, parsed));
}

// The FIREBASE_* values an environment's native files imply (spec 7.4), read through the tree so a file placed in this
// pass counts. Nothing when it has none, or when one does not parse, which check reports as that file.
function derived(tree, from) {
  if (!from) return {};
  try {
    return deriveKeys({ ...nativeFacts(from.android ? tree.read(from.android) : null, from.ios ? tree.read(from.ios) : null), androidId: from.androidId, iosId: from.iosId });
  } catch (e) {
    if (e.name === "NativeParseError") return {};
    throw e;
  }
}

const ops = {
  // env/.gitignore ignores everything but itself and the sample: written when absent; otherwise '*' and the two
  // negations after it are added where missing, and nothing else in the file moves.
  "env-gitignore"(tree) {
    const rel = "env/.gitignore";
    const text = tree.read(rel);
    if (text === null) return tree.write(rel, render("env.gitignore"));
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const star = Math.max(lines.lastIndexOf("*"), lines.lastIndexOf("/*"));
    const missing = star < 0 ? ENV_IGNORE : ENV_IGNORE.slice(1).filter((n) => lines.lastIndexOf(n) < star);
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    tree.write(rel, missing.length ? `${withEol(text)}${missing.join(eol)}${eol}` : text);
  },

  // env/sample.json: every key an environment needs, all empty, so a copied sample builds ENVLESS instead of as some
  // environment. An existing sample keeps its keys, their order and its format; its values are emptied, missing keys added.
  sample(tree, { keys }) {
    const rel = CONVENTIONS.sampleFile;
    const text = tree.read(rel);
    if (text === null) return tree.write(rel, serialize(Object.fromEntries(keys.map((k) => [k, ""]))));
    const parsed = parseObject(text);
    if (!parsed) return tree.conflict(rel, `${rel} is not one JSON object`);
    const next = Object.fromEntries(Object.keys(parsed.value).map((k) => [k, ""]));
    for (const k of keys) if (!(k in next)) next[k] = "";
    writeObject(tree, rel, text, parsed, next);
  },

  // env/<env>.json for an environment that has none: the sample's keys, empty, with the label set. No value is copied,
  // so nothing one environment set reaches another. Never overwrites; an existing file is the keys op's.
  skeletons(tree, { envs, keys, label }) {
    const sample = parseObject(tree.read(CONVENTIONS.sampleFile) || "");
    const names = [...new Set([...(sample ? Object.keys(sample.value) : []), ...keys])];
    for (const { env, name } of envs) {
      const rel = `${CONVENTIONS.envDir}/${env}.json`;
      if (tree.read(rel) !== null) continue;
      tree.write(rel, serialize({ ...Object.fromEntries(names.map((k) => [k, ""])), [label]: name }, sample || undefined));
    }
  },

  // Existing env files gain the keys Dart reads without a default (empty), the label value in `names`, and every
  // FIREBASE_* key they hold set to the value their environment's native files imply (`firebase` names those files and
  // the ids that pick its app). A value that replaces another is backed up first under env/.flutter-envs-backup/, which
  // env/.gitignore's '*' keeps out of git; filling an empty key is not.
  keys(tree, { envs, required, label, names = {}, firebase = {} }, ctx) {
    for (const env of envs) {
      const rel = `${CONVENTIONS.envDir}/${env}.json`;
      const text = tree.read(rel);
      if (text === null) continue;
      const parsed = parseObject(text);
      if (!parsed) { tree.conflict(rel, `${rel} is not one JSON object`); continue; }
      const next = { ...parsed.value };
      for (const k of required) if (!(k in next)) next[k] = "";
      if (env in names) next[label] = names[env];
      for (const [k, v] of Object.entries(derived(tree, firebase[env]))) if (k in next && String(next[k]) !== v) next[k] = v;
      const was = parsed.value;
      const replaced = Object.keys(was).some((k) => next[k] !== was[k] && (k === label || (was[k] !== "" && was[k] !== null)));
      if (replaced) tree.write(`${CONVENTIONS.envDir}/.flutter-envs-backup/${env}.json.${ctx.stamp}`, text);
      writeObject(tree, rel, text, parsed, next);
    }
  },

  // The app .gitignore's managed blocks, one per id: each holds its paths, and an untouched block whose paths are
  // all gone is removed. A block edited by hand is a conflict.
  gitignore(tree, { blocks }) {
    const rel = ".gitignore";
    const original = tree.read(rel);
    let text = original === null ? "" : original;
    for (const [id, paths] of Object.entries(blocks)) {
      const found = readBlock(text, { id, syntax: "hash" });
      if (!paths.length) { if (found && !found.edited) text = text.slice(0, found.start) + text.slice(found.end); continue; }
      const r = ensureBlock(found ? text : withEol(text), { id, syntax: "hash", body: `${paths.join("\n")}\n`, anchor: (t) => t.length });
      if (r.state === "conflict") { tree.conflict(rel, `the ${id} block was edited by hand`); continue; }
      text = r.text;
    }
    if (original !== null || text) tree.write(rel, text);
  },

  // The Makefile's managed block, at the end of the file (a new Makefile when there is none), so the owner's default
  // goal stays first. `envless` adds --flavor $(env) to the envless targets when default-flavor is off.
  makefile(tree, { default: env, envless = false }) {
    const rel = MAKEFILES.find((f) => tree.read(f) !== null) || "Makefile";
    const text = tree.read(rel) || "";
    const body = render("Makefile.block", { default: env, envless: envless ? " --flavor $(env)" : "" });
    const own = readBlock(text, { id: "makefile", syntax: "hash" });
    const r = ensureBlock(own ? text : withEol(text), { id: "makefile", syntax: "hash", body, anchor: (t) => t.length });
    if (r.state === "conflict") return tree.conflict(rel, "the makefile block was edited by hand");
    tree.write(rel, r.text);
  },

  // `default-flavor: <env>` on the line right after the top-level `flutter:` (a new `flutter:` section when there is
  // none). A default-flavor already set is the owner's choice and stays.
  "default-flavor"(tree, { flavor }) {
    const rel = "pubspec.yaml";
    const text = tree.read(rel);
    if (text === null) return tree.conflict(rel, "pubspec.yaml is missing");
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const head = /^flutter:[ \t]*(?:#[^\r\n]*)?\r?\n/m.exec(text);
    if (!head) return tree.write(rel, `${withEol(text)}${eol}flutter:${eol}  default-flavor: ${flavor}${eol}`);
    const from = head.index + head[0].length;
    const section = /^(?:(?:[ \t]+[^\r\n]*|[ \t]*|#[^\r\n]*)(?:\r?\n|$))*/.exec(text.slice(from))[0];
    if (/^[ \t]+default-flavor:/m.test(section)) return tree.write(rel, text);
    const indent = (/^([ \t]+)[^\s#]/m.exec(section) || [, "  "])[1];
    tree.write(rel, `${text.slice(0, from)}${indent}default-flavor: ${flavor}${eol}${text.slice(from)}`);
  },
};

// What the makefile recipe prints: the skill's own block, to compare the owner's targets with.
const snippets = {
  makefile: ({ default: env, envless = false }) => ensureBlock("", { id: "makefile", syntax: "hash", body: render("Makefile.block", { default: env, envless: envless ? " --flavor $(env)" : "" }), anchor: () => 0 }).text,
};

module.exports = { read, SAMPLE, ops, snippets };
