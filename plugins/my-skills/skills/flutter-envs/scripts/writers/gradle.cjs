"use strict";
// Gradle build files, Kotlin and Groovy DSL alike. The read half: a comment- and string-aware mask and block finder,
// then flavors, ids, resValues, the google-services guard and plugin, and AGP. Comments are masked before anything is
// read, so a commented-out flavor block is invisible to the flavor read and reported only as itself. The write half:
// the flavors and guard managed blocks, the placeholder default id, the google-services plugin lines and minSdk.

const { at, lineAt } = require("../lib/io.cjs");
const { readBlock, ensureBlock, legacyMarkers } = require("../lib/managed.cjs");
const { render } = require("../lib/templates.cjs");

const APP_FILES = ["android/app/build.gradle.kts", "android/app/build.gradle"];

// A same-length copy with comments (and, by default, string contents) blanked, so offsets still index `text`.
function mask(text, { strings = true } = {}) {
  const out = text.split("");
  for (let i = 0; i < text.length;) {
    if (text.startsWith("//", i)) { while (i < text.length && text[i] !== "\n") out[i++] = " "; }
    else if (text.startsWith("/*", i)) {
      const e = text.indexOf("*/", i + 2);
      const end = e < 0 ? text.length : e + 2;
      for (; i < end; i++) if (text[i] !== "\n") out[i] = " ";
    } else if (strings && (text[i] === '"' || text[i] === "'")) {
      const q = text[i++];
      while (i < text.length && text[i] !== q && text[i] !== "\n") { if (text[i] === "\\") out[i++] = " "; out[i++] = " "; }
      i++;
    } else i++;
  }
  return out.join("");
}

const closeOf = (masked, open) => {
  for (let i = open, d = 0; i < masked.length; i++) {
    if (masked[i] === "{") d++;
    else if (masked[i] === "}" && --d === 0) return i;
  }
  return -1;
};

// -> { open, close } of the first `name {` that is a direct child of `within` (or of the file), on a masked text.
function block(masked, name, within) {
  const from = within ? within.open + 1 : 0;
  const to = within ? within.close : masked.length;
  const re = new RegExp(`(^|[^\\w.])${name}\\s*\\{`, "g");
  re.lastIndex = from;
  for (let hit; (hit = re.exec(masked)) && hit.index < to;) {
    const open = hit.index + hit[0].length - 1;
    let depth = 0;
    for (let i = from; i < open; i++) { if (masked[i] === "{") depth++; else if (masked[i] === "}") depth--; }
    const close = closeOf(masked, open);
    if (close < 0) return null;
    if (depth === 0) return { open, close };
    re.lastIndex = close;
  }
  return null;
}

// The first literal `key = "v"`, `key "v"` or `key("v")` in text[from, to) whose key sits in live code.
function literal(text, code, key, from, to) {
  const re = new RegExp(`(?<![\\w.])${key}(?![\\w])\\s*(=|\\(|\\s)\\s*\\(?\\s*(["'])([^"'\\n]*)\\2`, "g");
  re.lastIndex = from;
  for (let m; (m = re.exec(text)) && m.index < to;) {
    if (code[m.index] !== " ") { const end = m.index + m[0].length - 1; return { value: m[3], index: m.index, start: end - m[3].length, end }; }
  }
  return null;
}

// An assignment whose right side is not a plain string, such as appConfigProperties.getProperty('APP_ID').
function computed(text, code, key, from, to) {
  const re = new RegExp(`(?<![\\w.])${key}(?![\\w])\\s*=?\\s*([^\\n]+)`, "g");
  re.lastIndex = from;
  for (let m; (m = re.exec(text)) && m.index < to;) {
    if (code[m.index] === " ") continue;
    const rhs = m[1].trim();
    if (!/^\(?\s*["'][^"']*["']\s*\)?\s*$/.test(rhs)) return { expr: rhs, index: m.index };
  }
  return null;
}

function flavorsIn(file, text, code, keep, pf) {
  const body = keep.slice(pf.open + 1, pf.close);
  const entry = /(?:create|register|maybeCreate|getByName)\(\s*"([^"]+)"\s*\)\s*\{|(?<![\w.])([A-Za-z_]\w*)\s*\{/g;
  const out = [];
  for (let e; (e = entry.exec(body));) {
    const name = e[1] || e[2];
    const open = pf.open + 1 + e.index + e[0].length - 1;
    const close = closeOf(code, open);
    if (close < 0) break;
    entry.lastIndex = close - (pf.open + 1) + 1;
    if (["all", "configureEach", "each", "whenObjectAdded"].includes(name)) continue;
    const id = literal(text, code, "applicationId", open, close);
    const suffix = literal(text, code, "applicationIdSuffix", open, close);
    const dimension = literal(text, code, "dimension", open, close);
    const resValues = [];
    const rv = /resValue\s*\(?\s*["']string["']\s*,\s*["'](\w+)["']\s*,\s*["']([^"'\n]*)["']/g;
    rv.lastIndex = open;
    for (let r; (r = rv.exec(text)) && r.index < close;) if (code[r.index] !== " ") resValues.push({ key: r[1], value: r[2], at: at(file, text, r.index) });
    const placeholders = {};
    const ph = /manifestPlaceholders\s*\[\s*["'](\w+)["']\s*\]\s*=\s*["']([^"'\n]*)["']|manifestPlaceholders\s*(?:\+=|=)\s*(?:mapOf\(|\[)([^\])\n]*)/g;
    ph.lastIndex = open;
    for (let p; (p = ph.exec(text)) && p.index < close;) {
      if (code[p.index] === " ") continue;
      if (p[1]) placeholders[p[1]] = p[2];
      else for (const kv of p[3].matchAll(/["'](\w+)["']\s*(?:to|:)\s*["']([^"']*)["']/g)) placeholders[kv[1]] = kv[2];
    }
    out.push({
      name, file, at: at(file, text, open), id: id && id.value, idAt: id ? at(file, text, id.index) : null,
      suffix: suffix && suffix.value, dimension: dimension && dimension.value, resValues, placeholders,
    });
  }
  return out;
}

function settingsFacts(io) {
  const out = { agp: null, gms: null };
  for (const file of ["android/settings.gradle.kts", "android/settings.gradle", "android/build.gradle.kts", "android/build.gradle"]) {
    const text = io.read(file);
    if (!text) continue;
    const code = mask(text, { strings: false });
    const agp = /com\.android\.application["']\s*\)?\s*version\s*\(?\s*["']([\d.]+)["']|com\.android\.tools\.build:gradle:([\d.]+)/.exec(code);
    if (agp && !out.agp) out.agp = agp[1] || agp[2];
    const gms = /com\.google\.gms\.google-services["']\s*\)?\s*version\s*\(?\s*["']([\d.]+)["']|com\.google\.gms:google-services:([\d.]+)/.exec(code);
    if (gms && !out.gms) out.gms = { version: gms[1] || gms[2], at: at(file, text, gms.index) };
  }
  return out;
}

function read(io) {
  const file = APP_FILES.find((f) => io.read(f) !== null);
  const settings = settingsFacts(io);
  if (!file) return { file: null, dialect: null, flavors: [], owner: "none", ...settings, errors: [] };
  const text = io.read(file);
  const code = mask(text);
  const keep = mask(text, { strings: false });
  const android = block(code, "android");
  const dc = android && block(code, "defaultConfig", android);
  const id = dc && literal(text, code, "applicationId", dc.open, dc.close);
  const idExpr = dc && !id && computed(text, code, "applicationId", dc.open, dc.close);
  const minSdk = dc && /minSdk(?:Version)?\s*=?\s*\(?\s*(\d+)/.exec(code.slice(dc.open, dc.close));

  const errors = [];
  for (const m of code.matchAll(/^[ \t]*#/gm)) errors.push({ at: at(file, text, m.index), why: "a line starts with '#', which Gradle does not accept" });

  const pfMain = android && block(code, "productFlavors", android);
  const strayFlavors = [...code.matchAll(/(^|[^\w.])productFlavors\s*\{/g)].map((m) => m.index + m[1].length)
    .filter((i) => !(android && i > android.open && i < android.close));
  for (const i of strayFlavors) errors.push({ at: at(file, text, i), why: "a productFlavors block sits outside android {}" });

  let flavors = pfMain ? flavorsIn(file, text, code, keep, pfMain) : [];
  const flavorsAt = pfMain ? at(file, text, pfMain.open) : null;
  const applied = [...keep.matchAll(/apply\s*\(?\s*from\s*[:=]\s*["']([^"']+)["']/g)].map((m) => m[1]);
  let appliedFrom = null;
  for (const rel of applied) {
    const sub = `android/app/${rel}`;
    const st = io.read(sub);
    if (!st) continue;
    const sc = mask(st);
    const pf = block(sc, "productFlavors", block(sc, "android") || undefined) || block(sc, "productFlavors");
    if (pf && !flavors.length) { flavors = flavorsIn(sub, st, sc, mask(st, { strings: false }), pf); appliedFrom = sub; }
  }

  const legacy = legacyMarkers(text).filter((l) => !/^\s*\/\/.*#/.test(l.line));
  const flavorizr = /autogenerated by flutter_flavorizr/.test(text) || (appliedFrom && /flavorizr/.test(appliedFrom));
  const skill = readBlock(text, { id: "flavors", syntax: "slash" });
  const owner = flavorizr ? "flavorizr" : legacy.length && pfMain ? "legacy" : skill ? "skill" : flavors.length ? "hand" : "none";

  const commented = [...text.matchAll(/productFlavors\s*\{/g)].filter((m) => keep[m.index] === " ")
    .map((m) => ({ at: at(file, text, m.index), line: lineAt(text, m.index) }));

  // The guard is recognised by what it does: live code that names google-services.json and throws near it.
  const guard = [...keep.matchAll(/google-services\.json/g)].find((m) => /throw|GradleException|error\(/.test(keep.slice(Math.max(0, m.index - 600), m.index + 600)));
  const guardAt = guard ? at(file, text, guard.index) : null;
  const gmsApplied = /com\.google\.gms\.google-services/.test(keep.replace(/^[^\n]*\bversion\b[^\n]*apply\s*\(?\s*false[^\n]*$/gm, ""));

  return {
    file, dialect: file.endsWith(".kts") ? "kts" : "groovy", ...settings, owner,
    defaultId: id ? { value: id.value, at: at(file, text, id.index) } : null,
    computedId: idExpr ? { expr: idExpr.expr, at: at(file, text, idExpr.index) } : null,
    minSdk: minSdk ? Number(minSdk[1]) : null,
    flavors: flavors.map((f) => ({ ...f, effectiveId: f.id || (id ? id.value + (f.suffix || "") : null), computed: !f.id && !!idExpr })),
    flavorsAt: flavorsAt || (flavors[0] && flavors[0].at) || null,
    appliedFrom,
    legacyAt: legacy.length ? at(file, text, legacy[0].index) : null,
    commentedDuplicate: commented[0] || null,
    guardAt,
    managedGuard: !!readBlock(text, { id: "guard", syntax: "slash" }),
    gmsApplied,
    resValuesEnabled: /resValues\s*(=\s*)?true/.test(code),
    errors,
  };
}

// ---- write half: ops over the engine's tree (read, write, conflict) ----

const SETTINGS_FILES = ["android/settings.gradle.kts", "android/settings.gradle"];
const ROOT_FILES = ["android/build.gradle.kts", "android/build.gradle"];
const GMS = "com.google.gms.google-services";
const dialectOf = (file) => (file.endsWith(".kts") ? "kts" : "groovy");
const appFile = (tree) => APP_FILES.find((f) => tree.read(f) !== null) || null;
const lineStart = (text, i) => text.lastIndexOf("\n", i - 1) + 1;
const withEol = (text) => (!text || text.endsWith("\n") ? text : `${text}\n`);

// android { defaultConfig { } } of a masked text, or null.
function defaultConfig(text) {
  const code = mask(text);
  const android = block(code, "android");
  const dc = android && block(code, "defaultConfig", android);
  return dc ? { code, dc } : null;
}

// The line after defaultConfig's closing brace, where the flavors block goes; -1 when there is no defaultConfig.
function afterDefaultConfig(text) {
  const found = defaultConfig(text);
  if (!found) return -1;
  const eol = text.indexOf("\n", found.dc.close);
  return eol < 0 ? text.length : eol + 1;
}

// The indentation of the `defaultConfig {` line, so the flavors block sits beside it.
function indentOf(text) {
  const found = defaultConfig(text);
  if (!found) return "    ";
  const head = text.slice(lineStart(text, found.dc.open), found.dc.open);
  return (/^[ \t]*/.exec(head) || [""])[0];
}

// Adds `line` after the `id ... com.android.application` line inside plugins {}, keeping that line's indentation.
// -> the new text, the same text when `already` matches live code, or null when the shape is not recognised.
function addPluginLine(text, line, already) {
  const keep = mask(text, { strings: false });
  if (already.test(keep)) return text;
  const code = mask(text);
  const plugins = block(code, "plugins");
  if (!plugins) return null;
  const app = /^([ \t]*)id\s*\(?\s*["']com\.android\.application["'][^\n]*$/m;
  const body = keep.slice(plugins.open, plugins.close);
  const hit = app.exec(body);
  if (!hit) return null;
  const end = plugins.open + hit.index + hit[0].length;
  return `${text.slice(0, end)}\n${hit[1]}${line}${text.slice(end)}`;
}

const ops = {
  flavors(tree, { flavors }) {
    const file = appFile(tree);
    if (!file) return;
    const text = tree.read(file);
    const body = render(`gradle-flavors.${dialectOf(file)}`, { flavors });
    const r = ensureBlock(text, { id: "flavors", syntax: "slash", body, anchor: afterDefaultConfig, indent: indentOf(text) });
    if (r.state === "conflict") return tree.conflict(file, readBlock(text, { id: "flavors", syntax: "slash" }) ? "the flavors block was edited by hand" : "no defaultConfig {} inside android {} to place the flavors block after");
    tree.write(file, r.text);
  },

  "default-id"(tree, { id }) {
    const file = appFile(tree);
    if (!file) return;
    const text = tree.read(file);
    const found = defaultConfig(text);
    const lit = found && literal(text, found.code, "applicationId", found.dc.open, found.dc.close);
    if (!lit) return tree.conflict(file, "defaultConfig has no literal applicationId to set");
    tree.write(file, `${text.slice(0, lit.start)}${id}${text.slice(lit.end)}`);
  },

  guard(tree, { envs }) {
    const file = appFile(tree);
    if (!file) return;
    const text = tree.read(file);
    const kts = dialectOf(file) === "kts";
    const body = render(`gradle-guard.${kts ? "kts" : "groovy"}`, { list: envs.map((e) => (kts ? `"${e}"` : `'${e}'`)).join(", ") });
    const own = readBlock(text, { id: "guard", syntax: "slash" });
    const r = ensureBlock(own ? text : withEol(text), { id: "guard", syntax: "slash", body, anchor: (t) => t.length });
    if (r.state === "conflict") return tree.conflict(file, "the google-services guard block was edited by hand");
    tree.write(file, r.text);
  },

  "gms-plugin"(tree, { version }) {
    const file = appFile(tree);
    if (!file) return;
    const kts = dialectOf(file) === "kts";
    const app = addPluginLine(tree.read(file), kts ? `id("${GMS}")` : `id "${GMS}"`, /com\.google\.gms\.google-services/);
    if (app === null) return tree.conflict(file, `no plugins { id("com.android.application") } to add ${GMS} after`);
    const settings = SETTINGS_FILES.find((f) => tree.read(f) !== null);
    const declared = [...SETTINGS_FILES, ...ROOT_FILES].some((f) => { const t = tree.read(f); return t !== null && /com\.google\.gms[.:]google-services/.test(mask(t, { strings: false })); });
    if (!declared) {
      if (!settings) return tree.conflict(file, "no android/settings.gradle(.kts) to declare the google-services plugin version in");
      const sKts = settings.endsWith(".kts");
      const next = addPluginLine(tree.read(settings), sKts ? `id("${GMS}") version "${version}" apply false` : `id "${GMS}" version "${version}" apply false`, /com\.google\.gms[.:]google-services/);
      if (next === null) return tree.conflict(settings, `no plugins { id("com.android.application") version ... } to declare ${GMS} after`);
      tree.write(settings, next);
    } else if (settings) tree.write(settings, tree.read(settings));
    tree.write(file, app);
  },

  "min-sdk"(tree, { min }) {
    const file = appFile(tree);
    if (!file) return;
    const text = tree.read(file);
    const found = defaultConfig(text);
    const m = found && /(minSdk(?:Version)?\s*=?\s*\(?\s*)(\d+)/.exec(found.code.slice(found.dc.open, found.dc.close));
    if (!m || Number(m[2]) >= min) return tree.write(file, text);
    const at = found.dc.open + m.index + m[1].length;
    tree.write(file, `${text.slice(0, at)}${min}${text.slice(at + m[2].length)}`);
  },
};

// What a recipe prints for this project: the managed flavors block to adopt, and the Groovy suffix lines to extend with.
const snippets = {
  flavors: ({ dialect, flavors }) => ensureBlock("", { id: "flavors", syntax: "slash", body: render(`gradle-flavors.${dialect}`, { flavors }), anchor: () => 0, indent: "    " }).text,
  suffix: ({ envs, dimension }) => envs.map((env) => `        ${env} {\n            dimension "${dimension}"\n            applicationIdSuffix ".${env}"\n        }\n`).join(""),
};

module.exports = { read, mask, block, ops, snippets };
