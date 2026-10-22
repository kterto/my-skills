"use strict";
// The Apple files around the pbxproj. The read half: shared and per-user schemes, the xcconfig include chain, the
// Podfile and its configuration map, Info.plist, and every GoogleService-Info.plist (ids printed, values digested).
// The write half: one scheme per environment, the per-configuration base xcconfigs, the Podfile's managed map and
// platform line, and Info.plist's display name. The write helpers are pure, text in and text out; `ops` meets the engine.

const path = require("node:path");
const { at, digest, lineAt } = require("../lib/io.cjs");
const { readBlock, ensureBlock } = require("../lib/managed.cjs");
const { CONVENTIONS } = require("../lib/vocab.cjs");

const SCHEMES = "ios/Runner.xcodeproj/xcshareddata/xcschemes";
const ACTIONS = ["TestAction", "LaunchAction", "ProfileAction", "AnalyzeAction", "ArchiveAction"];

const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, "\n").replace(/&amp;/g, "&");

// A small XML plist reader: the top-level dict, each value with the line of its key.
function plist(text) {
  const tokens = [...text.matchAll(/<(\/?)(dict|array|key|string|integer|real|date|data|true|false)\s*(\/?)>|([^<]+)/g)];
  let i = 0;
  const skipText = () => { while (i < tokens.length && tokens[i][4] !== undefined) i++; };
  const textUntil = (tag) => {
    let out = "";
    while (i < tokens.length && !(tokens[i][1] === "/" && tokens[i][2] === tag)) { out += tokens[i][4] || ""; i++; }
    i++;
    return unescape(out);
  };
  function value() {
    skipText();
    const t = tokens[i++];
    if (!t) throw new Error("plist: unexpected end");
    const [, close, tag, self] = t;
    if (close) throw new Error(`plist: unexpected </${tag}>`);
    if (tag === "true" || tag === "false") { if (!self) textUntil(tag); return tag === "true"; }
    if (self) return tag === "dict" ? {} : tag === "array" ? [] : "";
    if (tag === "dict") return dict();
    if (tag === "array") { const out = []; for (skipText(); tokens[i] && !(tokens[i][1] && tokens[i][2] === "array"); skipText()) out.push(value()); i++; return out; }
    return textUntil(tag);
  }
  function dict(withLines) {
    const out = {};
    for (skipText(); tokens[i] && !(tokens[i][1] && tokens[i][2] === "dict"); skipText()) {
      const t = tokens[i++];
      if (t[2] !== "key") throw new Error("plist: expected <key>");
      const key = textUntil("key");
      const v = value();
      out[key] = withLines ? { value: v, line: lineAt(text, t.index) } : v;
    }
    i++;
    return out;
  }
  while (i < tokens.length && tokens[i][2] !== "dict") i++;
  if (i >= tokens.length) throw new Error("plist: no top-level dict");
  i++;
  return dict(true);
}

function scheme(io, rel, shared) {
  const text = io.read(rel);
  const actions = {};
  for (const a of ACTIONS) {
    const m = new RegExp(`<${a}\\b[^>]*?buildConfiguration\\s*=\\s*"([^"]*)"`, "s").exec(text);
    if (m) actions[a] = { config: m[1], at: at(rel, text, m.index) };
  }
  const build = /<BuildAction\b[\s\S]*?<\/BuildAction>/.exec(text);
  return {
    name: path.basename(rel, ".xcscheme"), file: rel, shared, actions,
    prepareAction: !!build && /xcode_backend\.sh(&quot;|")?\s+prepare|Run Prepare Flutter Framework Script/.test(build[0]),
    testables: (text.match(/<TestableReference\b/g) || []).length,
  };
}

function schemes(io) {
  const out = [];
  for (const e of io.list(SCHEMES)) if (e.name.endsWith(".xcscheme")) out.push(scheme(io, `${SCHEMES}/${e.name}`, true));
  for (const u of io.list("ios/Runner.xcodeproj/xcuserdata")) {
    const dir = `ios/Runner.xcodeproj/xcuserdata/${u.name}/xcschemes`;
    for (const e of io.list(dir)) if (e.name.endsWith(".xcscheme")) out.push(scheme(io, `${dir}/${e.name}`, false));
  }
  return out;
}

// Each xcconfig as ordered lines: { include, raw, optional } or { key, value, line }. Includes resolve against the
// including file's folder first, then ios/, which is how Xcode finds Pods/ from ios/Flutter.
function xcconfigs(io) {
  const out = {};
  for (const rel of io.walk("ios", { test: (p) => p.endsWith(".xcconfig") })) {
    const text = io.read(rel);
    const lines = [];
    text.split("\n").forEach((rawLine, n) => {
      const line = rawLine.replace(/\/\/.*$/, "").trim();
      const inc = /^#include(\?)?\s+"([^"]+)"/.exec(line);
      if (inc) {
        const near = path.posix.normalize(`${path.posix.dirname(rel)}/${inc[2]}`);
        const fromIos = path.posix.normalize(`ios/${inc[2]}`);
        lines.push({ include: io.exists(near) || !io.exists(fromIos) ? near : fromIos, raw: inc[2], optional: !!inc[1], line: n + 1 });
        return;
      }
      const kv = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (kv) lines.push({ key: kv[1], value: kv[2].trim(), line: n + 1 });
    });
    out[rel] = { lines };
  }
  return out;
}

function podfile(io) {
  const rel = "ios/Podfile";
  const text = io.read(rel);
  if (text === null) return null;
  const live = text.split("\n").map((l) => l.replace(/#.*$/, "")).join("\n");
  const mapAt = /^\s*project\s+['"]Runner['"]\s*,\s*\{([\s\S]*?)\}/m.exec(live);
  const map = mapAt ? Object.fromEntries([...mapAt[1].matchAll(/['"]([^'"]+)['"]\s*=>\s*:(debug|release)/g)].map((m) => [m[1], m[2]])) : null;
  const platform = /^\s*platform\s+:ios\s*,\s*['"]([\d.]+)['"]/m.exec(live);
  return {
    file: rel, map, mapAt: mapAt ? at(rel, live, mapAt.index) : null, platform: platform ? platform[1] : null,
    managed: !!readBlock(text, { id: "podfile-map", syntax: "hash" }),
  };
}

function infoPlist(io, errors) {
  const rel = "ios/Runner/Info.plist";
  const text = io.read(rel);
  if (text === null) return null;
  try {
    const keys = plist(text);
    const field = (k) => (keys[k] ? { value: keys[k].value, at: `${rel}:${keys[k].line}` } : null);
    return { file: rel, displayName: field("CFBundleDisplayName"), bundleName: field("CFBundleName"), bundleId: field("CFBundleIdentifier") };
  } catch (e) {
    errors.push({ at: rel, why: e.message });
    return null;
  }
}

const FIREBASE_DIGESTS = Object.values(CONVENTIONS.firebaseKeys.ios);

function firebasePlists(io, errors) {
  return io.walk("ios", { test: (p) => /googleservice-info\.plist$/i.test(p) }).map((rel) => {
    try {
      const keys = plist(io.read(rel));
      const v = (k) => (keys[k] ? keys[k].value : null);
      return {
        file: rel, exactName: path.basename(rel) === "GoogleService-Info.plist",
        projectId: v("PROJECT_ID"), bundleId: v("BUNDLE_ID"),
        digests: Object.fromEntries(FIREBASE_DIGESTS.filter((k) => v(k)).map((k) => [k, digest(v(k))])),
      };
    } catch (e) {
      errors.push({ at: rel, why: e.message });
      return null;
    }
  }).filter(Boolean);
}

function read(io) {
  const errors = [];
  return {
    schemes: schemes(io), xcconfigs: xcconfigs(io), podfile: podfile(io),
    info: infoPlist(io, errors), firebase: firebasePlists(io, errors), errors,
  };
}

const SCHEME_ACTIONS = { TestAction: "Debug", LaunchAction: "Debug", AnalyzeAction: "Debug", ProfileAction: "Profile", ArchiveAction: "Release" };

// Only the five buildConfiguration values change, so pre-actions, testables and every other byte are kept.
function cloneScheme(xml, env) {
  let out = xml;
  for (const [tag, mode] of Object.entries(SCHEME_ACTIONS)) {
    const re = new RegExp(`(<${tag}\\b[^>]*?\\bbuildConfiguration\\s*=\\s*")[^"]*(")`);
    if (!re.test(out)) throw new Error(`scheme: <${tag}> has no buildConfiguration`);
    out = out.replace(re, `$1${mode}-${env}$2`);
  }
  return out;
}

// schemes: the shared scheme directory, file name to XML. <production>.xcscheme comes from Runner.xcscheme (from
// itself once Runner is gone), the other environments are clones of the same base. A scheme that exists and differs
// from its render is a conflict and is not written, and Runner.xcscheme goes last, only when nothing conflicts.
function planSchemes({ schemes, envs, production }) {
  const base = schemes["Runner.xcscheme"] ?? schemes[`${production}.xcscheme`];
  if (base === undefined) throw new Error(`scheme: neither Runner.xcscheme nor ${production}.xcscheme exists to clone`);
  const write = [production, ...envs.filter((e) => e !== production)].map((env) => {
    const file = `${env}.xcscheme`;
    const text = cloneScheme(base, env);
    const current = schemes[file];
    return { file, text, state: current === undefined ? "created" : current === text ? "unchanged" : "conflict" };
  });
  const remove = "Runner.xcscheme" in schemes && write.every((w) => w.state !== "conflict") ? ["Runner.xcscheme"] : [];
  return { write, remove };
}

// The template file each mode's configurations were based on. Flutter's Profile builds on Release.xcconfig.
const MODE_XCCONFIG = { Debug: "Debug.xcconfig", Profile: "Release.xcconfig", Release: "Release.xcconfig" };
const PODS_RUNNER = /^#include\??\s+"Pods\/Target Support Files\/Pods-Runner\/Pods-Runner\.[^"]*\.xcconfig"\s*$/;
const GENERATED = /^#include\??\s+"Generated\.xcconfig"\s*$/;

const xcconfigIncludes = (text) => text.split("\n").map((l) => l.trim()).filter((l) => /^#include\??\s+"/.test(l));

// The flavored Pods xcconfig, Generated.xcconfig, then the template's other includes. Its Pods include is dropped
// because the renamed configurations have no plain Pods xcconfig.
function renderModeXcconfig({ mode, env, extraIncludes = [] }) {
  const extras = extraIncludes.map((l) => l.trim()).filter((l) => !PODS_RUNNER.test(l) && !GENERATED.test(l));
  const pods = `Pods/Target Support Files/Pods-Runner/Pods-Runner.${`${mode}-${env}`.toLowerCase()}.xcconfig`;
  return [`#include? "${pods}"`, '#include "Generated.xcconfig"', ...extras].join("\n") + "\n";
}

const POD_KIND = { Debug: "debug", Profile: "release", Release: "release" };

// The CocoaPods build kind of each configuration, for the planner: Debug builds its pods as :debug, the rest :release.
function podKinds(configs) {
  return Object.fromEntries(configs.map((c) => {
    const mode = CONVENTIONS.modes.find((m) => c.startsWith(`${m}-`));
    if (!mode) throw new Error(`podfile: configuration ${c} names no build mode`);
    return [c, POD_KIND[mode]];
  }));
}

// The managed block's body, one row per configuration in the order given, in the template's own layout.
function podfileMapBlock(kinds) {
  const rows = Object.entries(kinds).map(([c, kind]) => `  '${c}' => :${kind},`);
  return `project 'Runner', {\n${rows.join("\n")}\n}\n`;
}

const PROJECT_STATEMENT = /^[ \t]*project[ \t]+['"]Runner['"][ \t]*,[ \t]*\{([^}]*)\}[ \t]*\n?/m;
const TEMPLATE_ENTRIES = "Debug=debug,Profile=release,Release=release";

// Where the managed map goes, for the marker writer's anchor: { text, at }. The template's own statement (its three
// entries, any layout) is cut from `text` and the block takes its place. With no statement the block goes before
// `target 'Runner'`. A statement with other entries is the owner's, so at is -1 and nothing is placed.
function podfileMapAnchor(podfile) {
  const s = PROJECT_STATEMENT.exec(podfile);
  if (s) {
    const entries = [...s[1].matchAll(/['"]([^'"]+)['"]\s*=>\s*:(\w+)/g)].map(([, k, v]) => `${k}=${v}`).sort().join(",");
    if (entries !== TEMPLATE_ENTRIES) return { text: podfile, at: -1 };
    return { text: podfile.slice(0, s.index) + podfile.slice(s.index + s[0].length), at: s.index };
  }
  const target = /^target[ \t]+['"]Runner['"]/m.exec(podfile);
  return { text: podfile, at: target ? target.index : -1 };
}

const PLIST_TOKEN = /<(\/?)(dict|array)(\/?)>|<key>([^<]*)<\/key>/g;

function rootDict(xml) {
  const keys = [];
  let depth = 0;
  for (const t of xml.matchAll(PLIST_TOKEN)) {
    if (t[4] !== undefined) { if (depth === 1) keys.push({ key: t[4], start: t.index, end: t.index + t[0].length }); continue; }
    if (t[3]) continue;
    depth += t[1] ? -1 : 1;
    if (depth === 0 && t[1]) return { keys, close: t.index };
  }
  throw new Error("plist: no root dict");
}

const lineIndent = (text, pos) => /[ \t]*$/.exec(text.slice(text.lastIndexOf("\n", pos - 1) + 1, pos))[0];

// CFBundleDisplayName = $(<variable>) in the root dict of an XML Info.plist, edited as text.
function setInfoPlistDisplayName(xml, variable) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) throw new Error(`plist: ${JSON.stringify(variable)} is not a build setting name`);
  const value = `<string>$(${variable})</string>`;
  const { keys, close } = rootDict(xml);
  const hit = keys.find((k) => k.key === "CFBundleDisplayName");
  if (hit) {
    const re = /(\s*)(<string>[^<]*<\/string>|<string\/>)/y;
    re.lastIndex = hit.end;
    const m = re.exec(xml);
    if (!m) throw new Error("plist: CFBundleDisplayName does not hold a string");
    if (m[2] === value) return xml;
    const at = hit.end + m[1].length;
    return xml.slice(0, at) + value + xml.slice(at + m[2].length);
  }
  const next = keys.find((k) => k.key > "CFBundleDisplayName");
  const pos = next ? next.start : close;
  const ind = next ? lineIndent(xml, pos) : `${lineIndent(xml, pos)}\t`;
  const at = xml.lastIndexOf("\n", pos - 1) + 1;
  return xml.slice(0, at) + `${ind}<key>CFBundleDisplayName</key>\n${ind}${value}\n` + xml.slice(at);
}

const FLUTTER = "ios/Flutter";
const PODFILE = "ios/Podfile";
const INFO_PLIST = "ios/Runner/Info.plist";

const version = (min) => (/^\d+$/.test(String(min)) ? `${min}.0` : String(min));
const versionBelow = (v, min) => {
  const a = v.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  return false;
};

// Raises a live `platform :ios` line to `min`, or uncomments the template's line at `min`. A Podfile with neither is
// left alone: CocoaPods then takes the project's deployment target, which pbxproj.deployment-target raises.
function setPodfilePlatform(podfile, min) {
  const live = /^([ \t]*platform[ \t]+:ios[ \t]*,[ \t]*)(['"])([\d.]+)\2/m.exec(podfile);
  if (live) return versionBelow(live[3], min) ? `${podfile.slice(0, live.index)}${live[1]}${live[2]}${min}${live[2]}${podfile.slice(live.index + live[0].length)}` : podfile;
  const template = /^#[ \t]*platform[ \t]+:ios[ \t]*,[ \t]*['"][\d.]+['"][ \t]*$/m.exec(podfile);
  return template ? `${podfile.slice(0, template.index)}platform :ios, '${min}'${podfile.slice(template.index + template[0].length)}` : podfile;
}

// The writer ops, by edit id apple.<op>. A rendered file that differs on disk is a conflict and is not written.
const ops = {
  "xcconfig-files": (tree, { configs }) => {
    for (const { mode, env } of configs) {
      const file = `${FLUTTER}/${mode}-${env}.xcconfig`;
      const text = renderModeXcconfig({ mode, env, extraIncludes: xcconfigIncludes(tree.read(`${FLUTTER}/${MODE_XCCONFIG[mode]}`) || "") });
      const current = tree.read(file);
      if (current !== null && current !== text) tree.conflict(file, `it differs from the base xcconfig flutter-envs renders for ${mode}-${env}`);
      else tree.write(file, text);
    }
  },
  "podfile-map": (tree, { configs }) => {
    const podfile = tree.read(PODFILE);
    if (podfile === null) return;
    const { text, at } = podfileMapAnchor(podfile);
    const block = ensureBlock(text, { id: "podfile-map", syntax: "hash", body: podfileMapBlock(configs), anchor: () => at });
    if (block.state === "conflict") tree.conflict(PODFILE, "its project 'Runner' map is the owner's own or was edited by hand, so it is left as it is");
    else tree.write(PODFILE, block.text);
  },
  "podfile-platform": (tree, { min }) => {
    const podfile = tree.read(PODFILE);
    if (podfile !== null) tree.write(PODFILE, setPodfilePlatform(podfile, version(min)));
  },
  schemes: (tree, { envs, production }) => {
    const schemes = {};
    for (const name of new Set(["Runner", production, ...envs])) {
      const text = tree.read(`${SCHEMES}/${name}.xcscheme`);
      if (text !== null) schemes[`${name}.xcscheme`] = text;
    }
    const plan = planSchemes({ schemes, envs, production });
    for (const w of plan.write) {
      if (w.state === "conflict") tree.conflict(`${SCHEMES}/${w.file}`, "it differs from the clone of Runner.xcscheme for its environment");
      else tree.write(`${SCHEMES}/${w.file}`, w.text);
    }
    for (const file of plan.remove) tree.remove(`${SCHEMES}/${file}`);
  },
  "infoplist-name": (tree, { variable }) => {
    const text = tree.read(INFO_PLIST);
    if (text === null) throw new Error(`apple: ${INFO_PLIST} is missing`);
    tree.write(INFO_PLIST, setInfoPlistDisplayName(text, variable));
  },
};

module.exports = {
  read, plist, cloneScheme, planSchemes, MODE_XCCONFIG, xcconfigIncludes, renderModeXcconfig, podKinds, podfileMapBlock,
  podfileMapAnchor, setPodfilePlatform, setInfoPlistDisplayName, ops,
};
