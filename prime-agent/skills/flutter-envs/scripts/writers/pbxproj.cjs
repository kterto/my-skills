"use strict";
// ios/Runner.xcodeproj/project.pbxproj, the OpenStep plist Xcode writes. The read half: a parser that keeps source
// offsets, the object model and the build-setting resolver through the xcconfig chain. The write half: the structural
// validator, which counts only what an edit adds, and the splice ops. A splice never re-serialises the file, so every
// byte it does not mean to change stays as written, and each op returns its input when its end state already holds.

const crypto = require("node:crypto");
const { posix } = require("node:path");
const { at } = require("../lib/io.cjs");
const { CONVENTIONS } = require("../lib/vocab.cjs");

const FILE = "ios/Runner.xcodeproj/project.pbxproj";
const BARE = /[A-Za-z0-9_$/.:+*~-]+/y;

function parse(text) {
  let i = 0;
  const n = text.length;
  const fail = (msg) => { throw new Error(`pbxproj: ${msg} at offset ${i}`); };
  function skip() {
    for (;;) {
      while (i < n && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r")) i++;
      if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); if (e < 0) fail("open comment"); i = e + 2; continue; }
      if (text.startsWith("//", i)) { while (i < n && text[i] !== "\n") i++; continue; }
      return;
    }
  }
  function string() {
    const start = i;
    if (text[i] === '"') {
      i++;
      let out = "";
      while (i < n && text[i] !== '"') {
        if (text[i] === "\\") { const c = text[i + 1]; out += c === "n" ? "\n" : c === "t" ? "\t" : c; i += 2; }
        else out += text[i++];
      }
      if (i >= n) fail("open string");
      i++;
      return { t: "str", v: out, start, end: i, quoted: true };
    }
    BARE.lastIndex = i;
    const m = BARE.exec(text);
    if (!m) fail(`unexpected ${JSON.stringify(text[i])}`);
    i += m[0].length;
    return { t: "str", v: m[0], start, end: i, quoted: false };
  }
  function value() {
    skip();
    if (text[i] === "{") return dict();
    if (text[i] === "(") return array();
    return string();
  }
  function dict() {
    const start = i++;
    const entries = [];
    const index = new Map();
    for (;;) {
      skip();
      if (text[i] === "}") { i++; break; }
      const keyStart = i;
      const k = string();
      skip();
      if (text[i] !== "=") fail("expected =");
      i++;
      const v = value();
      skip();
      if (text[i] !== ";") fail("expected ;");
      i++;
      const entry = { key: k.v, keyStart, v, end: i };
      entries.push(entry);
      if (!index.has(k.v)) index.set(k.v, entry);
    }
    return { t: "dict", entries, start, end: i, get: (key) => (index.get(key) || {}).v };
  }
  function array() {
    const start = i++;
    const items = [];
    for (;;) {
      skip();
      if (text[i] === ")") { i++; break; }
      items.push(value());
      skip();
      if (text[i] === ",") i++;
    }
    return { t: "arr", items, start, end: i };
  }
  skip();
  return dict();
}

function model(text) {
  const root = parse(text);
  const objects = root.get("objects");
  const byId = new Map();
  for (const e of objects.entries) {
    const isa = e.v.t === "dict" && e.v.get("isa");
    byId.set(e.key, { id: e.key, node: e.v, entry: e, isa: isa ? isa.v : null });
  }
  const lists = (isa) => [...byId.values()].filter((o) => o.isa === isa);
  const parent = new Map();
  for (const o of byId.values()) {
    const children = (o.isa === "PBXGroup" || o.isa === "PBXVariantGroup") && o.node.get("children");
    for (const c of children ? children.items : []) parent.set(c.v, o.id);
  }
  return { root, objects, byId, lists, parent, text };
}

const str = (node, key) => { const v = node && node.get && node.get(key); return v && v.t === "str" ? v.v : null; };

function configsOf(m, listId) {
  const list = m.byId.get(listId);
  const items = list && list.node.get("buildConfigurations");
  return (items ? items.items : []).map((it) => {
    const o = m.byId.get(it.v);
    return { id: it.v, name: o ? str(o.node, "name") : null, obj: o, item: it };
  }).filter((c) => c.obj);
}

// The path of a file reference relative to the project directory (ios/), walking its groups for <group> paths.
function refPath(m, refId) {
  const ref = m.byId.get(refId);
  if (!ref) return null;
  const parts = [str(ref.node, "path") || str(ref.node, "name")];
  if (str(ref.node, "sourceTree") === "<group>") {
    for (let g = m.parent.get(refId); g; g = m.parent.get(g)) { const p = str(m.byId.get(g).node, "path"); if (p) parts.unshift(p); }
  }
  return parts.filter(Boolean).join("/");
}

function settingsOf(m, cfg, file) {
  const out = {};
  const bs = cfg.obj.node.get("buildSettings");
  for (const e of bs && bs.entries ? bs.entries : []) {
    out[e.key] = { value: e.v.t === "str" ? e.v.v : e.v.t === "arr" ? e.v.items.map((x) => x.v).join(" ") : "", at: at(file, m.text, e.keyStart) };
  }
  return out;
}

const SKIP_INCLUDE = /(^|\/)Pods\/|Generated\.xcconfig$/;

// xcconfig settings in effect after every line, last definition wins, Pods and Generated includes skipped.
function flatten(xcconfigs, rel, seen = new Set()) {
  const file = xcconfigs[rel];
  if (!file || seen.has(rel)) return {};
  seen.add(rel);
  const out = {};
  for (const line of file.lines) {
    if (line.include) { if (!SKIP_INCLUDE.test(line.include)) Object.assign(out, flatten(xcconfigs, line.include, seen)); }
    else out[line.key] = { value: line.value, at: `${rel}:${line.line}` };
  }
  return out;
}

const VAR = /\$\(([^)]+)\)|\$\{([^}]+)\}/g;

// -> { KEY: { value, at } } for one configuration of a target, through target, its xcconfig, project, project xcconfig.
function resolveConfig(m, xcconfigs, targetName, targetCfg, projectCfg) {
  const base = (cfg) => { const r = cfg && cfg.obj.node.get("baseConfigurationReference"); const p = r && refPath(m, r.v); return p ? `ios/${p}` : null; };
  const chain = [settingsOf(m, targetCfg, FILE), flatten(xcconfigs, base(targetCfg)), projectCfg ? settingsOf(m, projectCfg, FILE) : {}, flatten(xcconfigs, base(projectCfg))];
  const raw = (k) => { for (const layer of chain) if (k in layer) return layer[k]; return null; };
  const expand = (v, depth = 0) => (depth > 8 ? v : v.replace(VAR, (whole, a, b) => {
    const key = (a || b).split(":")[0];
    if (key === "inherited") return "";
    if (key === "TARGET_NAME") return targetName;
    const hit = raw(key);
    return hit ? expand(hit.value, depth + 1) : whole;
  })).trim().replace(/^"|"$/g, "");
  const keys = new Set(chain.flatMap((l) => Object.keys(l)));
  return { base: base(targetCfg), settings: Object.fromEntries([...keys].map((k) => { const hit = raw(k); return [k, { value: expand(hit.value), at: hit.at }]; })) };
}

// The `cp` lines of a shell phase, with ${PROJECT_DIR} and ${SRCROOT} mapped to ios/; a build-folder target is null.
function copiesOf(script) {
  const out = [];
  const where = (p) => {
    const v = p.replace(/^["']|["']$/g, "");
    const src = /^\$\{?(PROJECT_DIR|SRCROOT|SOURCE_ROOT)\}?\/?(.*)$/.exec(v);
    if (src) return src[2] ? `ios/${src[2]}` : "ios";
    return /^\$\{?(TARGET_BUILD_DIR|BUILT_PRODUCTS_DIR|CONFIGURATION_BUILD_DIR|UNLOCALIZED_RESOURCES_FOLDER_PATH)/.test(v) ? null : `ios/${v}`;
  };
  for (const m of (script || "").matchAll(/(?:^|[;&|\s])cp\s+(?:-\w+\s+)*("[^"]+"|'[^']+'|\S+)\s+("[^"]+"|'[^']+'|\S+)/gm)) {
    out.push({ from: where(m[1]), to: where(m[2]) });
  }
  return out;
}

function phasesOf(m, target) {
  const items = target.node.get("buildPhases");
  return (items ? items.items : []).map((it, index) => {
    const o = m.byId.get(it.v);
    if (!o) return { id: it.v, index, isa: null, name: null, at: null, script: null, inputs: [], outputs: [], copies: [], files: [] };
    const list = (key) => { const v = o.node.get(key); return v && v.t === "arr" ? v.items.map((x) => x.v) : []; };
    return {
      id: it.v, index, isa: o.isa, name: str(o.node, "name"), at: at(FILE, m.text, o.entry.keyStart),
      script: str(o.node, "shellScript"), inputs: list("inputPaths"), outputs: list("outputPaths"), copies: copiesOf(str(o.node, "shellScript")),
      files: list("files").map((f) => { const bf = m.byId.get(f); const ref = bf && str(bf.node, "fileRef"); return ref ? refPath(m, ref) : null; }).filter(Boolean),
    };
  });
}

// The plain object graph, shaped like `plutil -convert json`, for parity checks.
function toJSON(node) {
  if (node.t === "dict") return Object.fromEntries(node.entries.map((e) => [e.key, toJSON(e.v)]));
  if (node.t === "arr") return node.items.map(toJSON);
  return node.v;
}

// -> facts for every native target: configurations with resolved settings, and build phases in order.
function read(io, { xcconfigs = {} } = {}) {
  const text = io.read(FILE);
  if (text === null) return { file: null, targets: [], project: { configs: [] }, swiftpm: false, error: null };
  let m;
  try { m = model(text); } catch (e) { return { file: FILE, targets: [], project: { configs: [] }, swiftpm: false, error: e.message }; }
  const project = m.lists("PBXProject")[0];
  const projectCfgs = project ? configsOf(m, str(project.node, "buildConfigurationList")) : [];
  const targets = m.lists("PBXNativeTarget").map((t) => {
    const name = str(t.node, "name");
    const configs = configsOf(m, str(t.node, "buildConfigurationList")).map((c) => ({
      name: c.name, at: at(FILE, text, c.obj.entry.keyStart),
      ...resolveConfig(m, xcconfigs, name, c, projectCfgs.find((p) => p.name === c.name)),
    }));
    return { name, productType: str(t.node, "productType"), configs, phases: phasesOf(m, t) };
  });
  const swiftpm = m.lists("XCLocalSwiftPackageReference").some((o) => /FlutterGeneratedPluginSwiftPackage/.test(str(o.node, "relativePath") || ""));
  return { file: FILE, error: null, swiftpm, project: { configs: projectCfgs.map((c) => c.name) }, targets };
}

const MODES = CONVENTIONS.modes;
const FLAVORED = /^(Debug|Profile|Release)[-_ ]./i;
const idFor = (seed) => "E0E5" + crypto.createHash("sha1").update(seed).digest("hex").slice(0, 20).toUpperCase();
const targetNamed = (m, name) => m.lists("PBXNativeTarget").find((t) => t.node.get("name").v === name);

function mustTarget(m, name) {
  const t = targetNamed(m, name);
  if (!t) throw new Error(`pbxproj: no target named ${name}`);
  return t;
}

// Xcode's own rule: bare when only letters, digits, _ $ . / and neither // nor ___, quoted with \\ \" \n \t otherwise.
const ESCAPES = { "\\": "\\\\", '"': '\\"', "\n": "\\n", "\t": "\\t" };
function quote(s) {
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)) throw new Error(`pbxproj: refusing a control character in ${JSON.stringify(s)}`);
  if (/^[A-Za-z0-9_$./]+$/.test(s) && !s.includes("//") && !s.includes("___")) return s;
  return `"${s.replace(/[\\"\n\t]/g, (c) => ESCAPES[c])}"`;
}

// The build setting value that Xcode expands back to `s`: it expands $(VAR) and reads $$ as $, so a literal such as a
// display name doubles every $. Quoting is a separate layer and cannot stop that expansion.
const literal = (s) => s.replaceAll("$", () => "$$");

const OBJECT_ID = /^[0-9A-F]{24}$/;

function violations(text) {
  let m;
  try { m = model(text); } catch (e) { return new Set([`unparseable: ${e.message}`]); }
  const out = new Set();
  const seen = new Set();
  for (const e of m.objects.entries) { if (seen.has(e.key)) out.add(`duplicate object id ${e.key}`); seen.add(e.key); }
  // Keyed by the missing id alone: a clone of an object that already pointed at nothing copies that damage, it adds none.
  const walk = (node) => {
    if (node.t === "str") { if (OBJECT_ID.test(node.v) && !m.byId.has(node.v)) out.add(`dangling id ${node.v}`); }
    else if (node.t === "arr") for (const it of node.items) walk(it);
    else for (const e of node.entries) walk(e.v);
  };
  for (const o of m.byId.values()) for (const e of o.node.entries) if (e.key !== "isa") walk(e.v);
  const rootObject = m.root.get("rootObject");
  if (rootObject && !m.byId.has(rootObject.v)) out.add(`dangling rootObject ${rootObject.v}`);
  const names = new Map();
  for (const l of m.lists("XCConfigurationList")) {
    const list = [];
    for (const it of l.node.get("buildConfigurations").items) {
      const o = m.byId.get(it.v);
      if (!o) continue;
      if (o.isa !== "XCBuildConfiguration") { out.add(`${it.v} in list ${l.id} is ${o.isa}`); continue; }
      const name = (o.node.get("name") || {}).v;
      if (list.includes(name)) out.add(`duplicate configuration ${name} in list ${l.id}`);
      list.push(name);
    }
    const d = l.node.get("defaultConfigurationName");
    if (d && !list.includes(d.v)) out.add(`list ${l.id} default ${d.v} names no configuration`);
    names.set(l.id, [...new Set(list)].sort().join("|"));
  }
  const project = m.lists("PBXProject")[0];
  const want = project && names.get(project.node.get("buildConfigurationList").v);
  for (const t of [...m.lists("PBXNativeTarget"), ...m.lists("PBXAggregateTarget")]) {
    const got = names.get(t.node.get("buildConfigurationList").v);
    if (want !== undefined && got !== undefined && got !== want) out.add(`target ${t.id} configurations differ from the project's`);
  }
  return out;
}

// The violations an edit added: a dangling id, a duplicate configuration name, unequal lists, and the rest of
// violations(), counted only when `before` did not already have them.
function validate(before, after) {
  const was = violations(before);
  return [...violations(after)].filter((v) => !was.has(v));
}

function splice(text, edits) {
  const sorted = edits.map((e, i) => ({ ...e, i })).sort((a, b) => b.at - a.at || b.to - a.to || b.i - a.i);
  let out = text;
  let floor = Infinity;
  for (const e of sorted) {
    if (e.to > floor) throw new Error("pbxproj: overlapping edits");
    out = out.slice(0, e.at) + e.text + out.slice(e.to);
    floor = e.at;
  }
  return out;
}

const lineStart = (text, pos) => text.lastIndexOf("\n", pos - 1) + 1;
const nextLine = (text, pos) => { const nl = text.indexOf("\n", pos); return nl < 0 ? text.length : nl + 1; };
const indentAt = (text, pos) => { const lead = text.slice(lineStart(text, pos), pos); return /^[ \t]*$/.test(lead) ? lead : null; };
const objectIndent = (text, m) => indentAt(text, m.objects.entries[0].keyStart) ?? "\t\t";

function commentAfter(text, pos) {
  const re = /[ \t]*\/\*([\s\S]*?)\*\//y;
  re.lastIndex = pos;
  const c = re.exec(text);
  return c ? { start: pos, end: pos + c[0].length, body: c[1].trim() } : null;
}

function insertBefore(text, pos, line) {
  const ind = indentAt(text, pos);
  if (ind === null) return { at: pos, to: pos, text: `${line} ` };
  const at = lineStart(text, pos);
  return { at, to: at, text: `${ind}${line}\n` };
}

function insertAfter(text, start, end, line) {
  const ind = indentAt(text, start);
  if (ind === null) return { at: end, to: end, text: ` ${line}` };
  const at = nextLine(text, end);
  return { at, to: at, text: `${ind}${line}\n` };
}

function removeLine(text, start, end) {
  return indentAt(text, start) === null ? { at: start, to: end, text: "" } : { at: lineStart(text, start), to: nextLine(text, end), text: "" };
}

function appendItems(text, arr, items) {
  const last = arr.items[arr.items.length - 1];
  const lastIndent = last ? indentAt(text, last.start) : null;
  if (lastIndent !== null) {
    const after = commentAfter(text, last.end);
    const tail = after ? after.end : last.end;
    const comma = /^[ \t]*,/.test(text.slice(tail, tail + 16)) ? [] : [{ at: tail, to: tail, text: "," }];
    return [...comma, insertAfter(text, last.start, tail, items.map((s) => `${s},`).join(`\n${lastIndent}`))];
  }
  const close = arr.end - 1;
  const ind = indentAt(text, close);
  if (ind === null) return [{ at: close, to: close, text: items.map((s) => `${s}, `).join("") }];
  const at = lineStart(text, close);
  return [{ at, to: at, text: items.map((s) => `${ind}\t${s},\n`).join("") }];
}

function insertObjects(text, m, isa, bodies) {
  const marker = text.indexOf(`/* End ${isa} section */`);
  const last = m.lists(isa).at(-1);
  const at = marker >= 0 ? lineStart(text, marker) : last ? nextLine(text, last.entry.end) : -1;
  if (at < 0) throw new Error(`pbxproj: no ${isa} section to add to`);
  const ind = objectIndent(text, m);
  return { at, to: at, text: bodies.map((b) => `${ind}${b}\n`).join("") };
}

// Set string entries of one dict: an equal value is left alone, a different one is replaced in place, a new key goes in
// sorted position after `isa`, as Xcode orders them.
function setEntries(text, dict, values) {
  const edits = [];
  const adds = [];
  for (const [k, v] of Object.entries(values)) {
    const e = dict.entries.find((x) => x.key === k);
    if (e && e.v.t === "str" && e.v.v === v) continue;
    const line = `${quote(k)} = ${quote(v)};`;
    if (e) edits.push({ at: e.keyStart, to: e.end, text: line });
    else adds.push([k, line]);
  }
  adds.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [k, line] of adds) {
    const next = dict.entries.find((x) => x.key !== "isa" && x.key > k);
    const last = dict.entries.at(-1);
    if (next) edits.push(insertBefore(text, next.keyStart, line));
    else if (last) edits.push(insertAfter(text, last.keyStart, last.end, line));
    else {
      const close = dict.end - 1;
      const ind = indentAt(text, close);
      const at = ind === null ? close : lineStart(text, close);
      edits.push({ at, to: at, text: ind === null ? ` ${line} ` : `${ind}\t${line}\n` });
    }
  }
  return edits;
}

function renameConfig(text, c, to) {
  const nameNode = c.obj.node.get("name");
  const edits = [{ at: nameNode.start, to: nameNode.end, text: quote(to) }];
  for (const pos of [c.obj.entry.keyStart + c.id.length, c.item.end]) {
    const k = commentAfter(text, pos);
    if (k && k.body === c.name) edits.push({ at: k.start, to: k.end, text: ` /* ${to} */` });
  }
  return edits;
}

// Debug, Profile and Release become <Mode>-<production> in every configuration list, and defaultConfigurationName
// follows. Nothing happens once any flavored configuration exists: plain ones beside flavored ones are the owner's.
function renamePlainConfigs(text, production) {
  const m = model(text);
  const lists = m.lists("XCConfigurationList").map((l) => ({ l, cfgs: configsOf(m, l.id) }));
  if (lists.some(({ cfgs }) => cfgs.some((c) => FLAVORED.test(c.name)))) return text;
  const edits = [];
  for (const { l, cfgs } of lists) {
    for (const c of cfgs) if (MODES.includes(c.name)) edits.push(...renameConfig(text, c, `${c.name}-${production}`));
    const d = l.node.get("defaultConfigurationName");
    if (d && MODES.includes(d.v)) edits.push({ at: d.start, to: d.end, text: quote(`${d.v}-${production}`) });
  }
  return edits.length ? splice(text, edits) : text;
}

function cloneText(text, base, id, name) {
  const { entry, node } = base.obj;
  const after = commentAfter(text, entry.keyStart + base.id.length);
  const head = after ? after.end : entry.keyStart + base.id.length;
  const n = node.get("name");
  return `${id} /* ${name} */${text.slice(head, n.start)}${quote(name)}${text.slice(n.end, entry.end)}`;
}

// Every list's <Mode>-<from> is cloned into <Mode>-<env>, under an id derived from the list and the new name.
function cloneConfigs(text, { from, envs }) {
  const m = model(text);
  const edits = [];
  const objects = [];
  for (const l of m.lists("XCConfigurationList")) {
    const cfgs = configsOf(m, l.id);
    const items = [];
    for (const env of envs.filter((e) => e !== from)) {
      for (const base of cfgs) {
        const mode = MODES.find((md) => base.name === `${md}-${from}`);
        const name = `${mode}-${env}`;
        if (!mode || cfgs.some((c) => c.name === name)) continue;
        const id = idFor(`${l.id}:${name}`);
        if (m.byId.has(id)) throw new Error(`pbxproj: ${name} would reuse object id ${id}`);
        objects.push(cloneText(text, base, id, name));
        items.push(`${id} /* ${name} */`);
      }
    }
    if (items.length) edits.push(...appendItems(text, l.node.get("buildConfigurations"), items));
  }
  if (!objects.length) return text;
  edits.push(insertObjects(text, m, "XCBuildConfiguration", objects));
  return splice(text, edits);
}

// byConfig: { '<Mode>-<env>': { SETTING: 'value' } } on the named target's configurations.
function setTargetSettings(text, { target, byConfig }) {
  const m = model(text);
  const cfgs = configsOf(m, mustTarget(m, target).node.get("buildConfigurationList").v);
  const edits = [];
  for (const [name, values] of Object.entries(byConfig)) {
    const c = cfgs.find((x) => x.name === name);
    if (!c) throw new Error(`pbxproj: target ${target} has no configuration ${name}`);
    edits.push(...setEntries(text, c.obj.node.get("buildSettings"), values));
  }
  return edits.length ? splice(text, edits) : text;
}

// idByConfig: { '<Mode>-<env>': 'com.acme.shop.dev.RunnerTests' }. A project without RunnerTests has nothing to set.
function setRunnerTestsIds(text, idByConfig) {
  if (!targetNamed(model(text), "RunnerTests")) return text;
  const byConfig = Object.fromEntries(Object.entries(idByConfig).map(([name, id]) => [name, { PRODUCT_BUNDLE_IDENTIFIER: id }]));
  return setTargetSettings(text, { target: "RunnerTests", byConfig });
}

const baseName = (o) => posix.basename(((o && (o.node.get("path") || o.node.get("name"))) || {}).v || "");

function xcconfigHome(m) {
  for (const g of m.lists("PBXGroup")) {
    const ref = g.node.get("children").items.map((it) => m.byId.get(it.v)).find((o) => o && o.isa === "PBXFileReference" && baseName(o) === "Debug.xcconfig");
    if (ref) return { group: g, ref };
  }
  throw new Error("pbxproj: no group holds Debug.xcconfig");
}

// files: xcconfig basenames, referenced from the group that holds Debug.xcconfig and shaped like its reference.
function ensureXcconfigRefs(text, files) {
  const m = model(text);
  const { group, ref } = xcconfigHome(m);
  const have = new Set(group.node.get("children").items.map((it) => baseName(m.byId.get(it.v))));
  const add = [...new Set(files)].filter((f) => !have.has(f));
  if (!add.length) return text;
  const dir = posix.dirname((ref.node.get("path") || ref.node.get("name")).v);
  const tree = ref.node.get("sourceTree");
  const objects = [];
  const items = [];
  for (const f of add) {
    const p = dir === "." ? f : `${dir}/${f}`;
    const id = idFor(`fileref:${p}`);
    if (m.byId.has(id)) throw new Error(`pbxproj: ${p} would reuse object id ${id}`);
    const name = ref.node.get("name") ? `name = ${quote(f)}; ` : "";
    objects.push(`${id} /* ${f} */ = {isa = PBXFileReference; lastKnownFileType = text.xcconfig; ${name}path = ${quote(p)}; sourceTree = ${quote(tree ? tree.v : "<group>")}; };`);
    items.push(`${id} /* ${f} */`);
  }
  return splice(text, [insertObjects(text, m, "PBXFileReference", objects), ...appendItems(text, group.node.get("children"), items)]);
}

// byConfig: { '<Mode>-<env>': '<Mode>-<env>.xcconfig' }, pointing each configuration's base at that file reference.
function setBaseConfigs(text, { target, byConfig }) {
  const m = model(text);
  const { group } = xcconfigHome(m);
  const refs = new Map(group.node.get("children").items.map((it) => [baseName(m.byId.get(it.v)), it.v]));
  const cfgs = configsOf(m, mustTarget(m, target).node.get("buildConfigurationList").v);
  const edits = [];
  for (const [name, file] of Object.entries(byConfig)) {
    const c = cfgs.find((x) => x.name === name);
    if (!c) throw new Error(`pbxproj: target ${target} has no configuration ${name}`);
    const id = refs.get(file);
    if (!id) throw new Error(`pbxproj: no reference to ${file}; run ensureXcconfigRefs first`);
    const cur = c.obj.node.get("baseConfigurationReference");
    if (cur && cur.v === id) continue;
    if (cur) {
      const after = commentAfter(text, cur.end);
      edits.push({ at: cur.start, to: after ? after.end : cur.end, text: `${id} /* ${file} */` });
    } else {
      const isa = c.obj.node.entries.find((e) => e.key === "isa");
      edits.push(insertAfter(text, isa.keyStart, isa.end, `baseConfigurationReference = ${id} /* ${file} */;`));
    }
  }
  return edits.length ? splice(text, edits) : text;
}

const PHASE_NAMES = { PBXResourcesBuildPhase: "Resources", PBXSourcesBuildPhase: "Sources", PBXFrameworksBuildPhase: "Frameworks", PBXHeadersBuildPhase: "Headers", PBXCopyFilesBuildPhase: "CopyFiles", PBXShellScriptBuildPhase: "ShellScript" };
const phaseName = (o) => (o.node.get("name") || {}).v || PHASE_NAMES[o.isa];

function phaseObject(text, m, { id, name, script, alwaysOutOfDate }) {
  const ind = objectIndent(text, m);
  const I = `${ind}\t`;
  const empty = (key) => [`${I}${key} = (`, `${I});`];
  return [
    `${id} /* ${name} */ = {`,
    `${I}isa = PBXShellScriptBuildPhase;`,
    ...(alwaysOutOfDate ? [`${I}alwaysOutOfDate = 1;`] : []),
    `${I}buildActionMask = 2147483647;`,
    ...empty("files"), ...empty("inputFileListPaths"), ...empty("inputPaths"),
    `${I}name = ${quote(name)};`,
    ...empty("outputFileListPaths"), ...empty("outputPaths"),
    `${I}runOnlyForDeploymentPostprocessing = 0;`,
    `${I}shellPath = /bin/sh;`,
    `${I}shellScript = ${quote(script)};`,
    `${ind}};`,
  ].join("\n");
}

// One named Run Script phase of `target`, placed after the `after` phase. An existing one keeps its id and position
// (moved only when it sits before `after`), and gets the script and alwaysOutOfDate it should have.
function upsertShellPhase(text, { target, name, script, after = "Resources", alwaysOutOfDate = true }) {
  const m = model(text);
  const phases = mustTarget(m, target).node.get("buildPhases").items.map((item) => ({ item, o: m.byId.get(item.v) }));
  const anchor = phases.findIndex(({ o }) => o && phaseName(o) === after);
  if (anchor < 0) throw new Error(`pbxproj: target ${target} has no ${after} phase`);
  const anchorItem = phases[anchor].item;
  const at = phases.findIndex(({ o }) => o && o.isa === "PBXShellScriptBuildPhase" && phaseName(o) === name);
  if (at < 0) {
    const id = idFor(`phase:${target}:${name}`);
    if (m.byId.has(id)) throw new Error(`pbxproj: phase ${name} would reuse object id ${id}`);
    return splice(text, [
      insertObjects(text, m, "PBXShellScriptBuildPhase", [phaseObject(text, m, { id, name, script, alwaysOutOfDate })]),
      insertAfter(text, anchorItem.start, anchorItem.end, `${id} /* ${name} */,`),
    ]);
  }
  const { o, item } = phases[at];
  const edits = setEntries(text, o.node, { shellScript: script, ...(alwaysOutOfDate ? { alwaysOutOfDate: "1" } : {}) });
  const stale = !alwaysOutOfDate && o.node.entries.find((e) => e.key === "alwaysOutOfDate");
  if (stale) edits.push(removeLine(text, stale.keyStart, stale.end));
  if (at < anchor) {
    const tail = commentAfter(text, item.end);
    edits.push(removeLine(text, item.start, tail ? tail.end : item.end), insertAfter(text, anchorItem.start, anchorItem.end, `${o.id} /* ${name} */,`));
  }
  return edits.length ? splice(text, edits) : text;
}

const versionBelow = (v, min) => {
  if (!/^\d+(\.\d+)*$/.test(v)) return false;
  const a = v.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  return false;
};

// Raises every IPHONEOS_DEPLOYMENT_TARGET below `min` to `min`. A higher one, or a configuration without one, stays.
function setDeploymentTarget(text, min) {
  const m = model(text);
  const edits = [];
  for (const o of m.lists("XCBuildConfiguration")) {
    const e = o.node.get("buildSettings").entries.find((x) => x.key === "IPHONEOS_DEPLOYMENT_TARGET");
    if (e && e.v.t === "str" && versionBelow(e.v.v, min)) edits.push({ at: e.v.start, to: e.v.end, text: quote(min) });
  }
  return edits.length ? splice(text, edits) : text;
}

// Each op splices the working copy and refuses an output that adds a structural violation.
function edit(tree, change) {
  const before = tree.read(FILE);
  if (before === null) throw new Error(`pbxproj: ${FILE} is missing`);
  const after = change(before);
  const added = validate(before, after);
  if (added.length) throw new Error(`pbxproj: the edit would add ${added.join("; ")}`);
  tree.write(FILE, after);
}

const version = (min) => (/^\d+$/.test(String(min)) ? `${min}.0` : String(min));
const withLiteralName = (byConfig) => Object.fromEntries(Object.entries(byConfig).map(([name, values]) => [name, values.DISPLAY_NAME === undefined ? values : { ...values, DISPLAY_NAME: literal(values.DISPLAY_NAME) }]));
const xcconfigOf = (config) => `${config}.xcconfig`;

// The writer ops, by edit id pbxproj.<op>. The display name goes through literal(), so a $ in it reaches the app.
const ops = {
  "rename-plain": (tree, { production }) => edit(tree, (t) => renamePlainConfigs(t, production)),
  "clone-flavors": (tree, { production, envs }) => edit(tree, (t) => cloneConfigs(t, { from: production, envs })),
  "set-settings": (tree, { byConfig, testsIds = {} }) => edit(tree, (t) => setRunnerTestsIds(setTargetSettings(t, { target: "Runner", byConfig: withLiteralName(byConfig) }), testsIds)),
  "base-xcconfigs": (tree, { configs }) => edit(tree, (t) => setBaseConfigs(ensureXcconfigRefs(t, configs.map(xcconfigOf)), { target: "Runner", byConfig: Object.fromEntries(configs.map((c) => [c, xcconfigOf(c)])) })),
  "shell-phase": (tree, { name, script }) => edit(tree, (t) => upsertShellPhase(t, { target: "Runner", name, script, after: "Resources", alwaysOutOfDate: true })),
  "deployment-target": (tree, { min }) => edit(tree, (t) => setDeploymentTarget(t, version(min))),
};

module.exports = {
  FILE, read, parse, model, configsOf, refPath, toJSON, violations, validate, quote, literal, idFor,
  renamePlainConfigs, cloneConfigs, setTargetSettings, setRunnerTestsIds, ensureXcconfigRefs, setBaseConfigs, upsertShellPhase, setDeploymentTarget,
  ops,
};
