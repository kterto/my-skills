"use strict";
// Android resources and Firebase files. The read half: the manifest's label and icon, the strings of every source set,
// and every google-services.json, with project ids and package names printed and every other value digested. The write
// half: the manifest label and the display-name strings, escaped the way AAPT2 reads them.

const { at, digest } = require("../lib/io.cjs");
const { readBlock, ensureBlock } = require("../lib/managed.cjs");
const { render } = require("../lib/templates.cjs");

const MANIFEST = "android/app/src/main/AndroidManifest.xml";

// XML entities first, then AAPT2's own backslash escapes (apostrophe, quote, @, ?, backslash, n, t, uXXXX), the way
// aapt2 compiles a value.
const xmlText = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
  .replace(/^"(.*)"$/s, "$1").replace(/\\(u[0-9a-fA-F]{4}|.)/g, (m, c) => (c.length === 5 ? String.fromCharCode(parseInt(c.slice(1), 16)) : c === "n" ? "\n" : c === "t" ? "\t" : c));

function manifest(io) {
  const text = io.read(MANIFEST);
  if (text === null) return null;
  const app = /<application\b([^>]*)>/.exec(text.replace(/<!--[\s\S]*?-->/g, (c) => " ".repeat(c.length)));
  if (!app) return { file: MANIFEST, label: null, icon: null };
  const attr = (name) => {
    const m = new RegExp(`android:${name}\\s*=\\s*"([^"]*)"`).exec(app[1]);
    return m ? { raw: m[1], at: at(MANIFEST, text, app.index + app[0].indexOf(m[0])) } : null;
  };
  const label = attr("label");
  const ref = label && /^@string\/(\w+)$/.exec(label.raw);
  const placeholder = label && /^\$\{(\w+)\}$/.exec(label.raw);
  const icon = attr("icon");
  return {
    file: MANIFEST,
    label: label && { ...label, key: ref ? ref[1] : null, placeholder: placeholder ? placeholder[1] : null, literal: ref || placeholder ? null : label.raw },
    icon: icon && { ...icon, name: (/^@(?:mipmap|drawable)\/(\w+)$/.exec(icon.raw) || [])[1] || null },
  };
}

// -> { set: { key: { value, at } } } from res/values/*.xml of every source set.
function strings(io, sets) {
  const out = {};
  for (const set of sets) {
    const dir = `android/app/src/${set}/res/values`;
    for (const f of io.list(dir).filter((e) => !e.dir && e.name.endsWith(".xml"))) {
      const rel = `${dir}/${f.name}`;
      const text = io.read(rel);
      const live = text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));
      for (const m of live.matchAll(/<string\s+name\s*=\s*"(\w+)"[^>]*>([\s\S]*?)<\/string>/g)) {
        (out[set] ||= {})[m[1]] = { value: xmlText(m[2].trim()), at: at(rel, text, m.index) };
      }
    }
  }
  return out;
}

function googleServices(io, sets, errors) {
  const candidates = ["android/app/google-services.json", ...sets.map((s) => `android/app/src/${s}/google-services.json`)];
  return candidates.filter((rel) => io.exists(rel)).map((rel) => {
    let json;
    try { json = JSON.parse(io.read(rel)); }
    catch (e) { errors.push({ at: rel, why: e.message }); return null; }
    const info = json.project_info || {};
    const project = { project_id: info.project_id, storage_bucket: info.storage_bucket, project_number: info.project_number };
    const clients = (json.client || []).map((c) => {
      const pkg = ((c.client_info || {}).android_client_info || {}).package_name || null;
      const oauth = c.oauth_client || [];
      const type1 = oauth.filter((o) => String(o.client_type) === "1" && (!o.android_info || o.android_info.package_name === pkg));
      const type3 = oauth.find((o) => String(o.client_type) === "3");
      const fields = {
        mobilesdk_app_id: (c.client_info || {}).mobilesdk_app_id,
        current_key: ((c.api_key || [])[0] || {}).current_key,
        oauth_type_1: type1.length === 1 ? type1[0].client_id : null,
        oauth_type_3: type3 ? type3.client_id : null,
      };
      return { packageName: pkg, type1Count: type1.length, digests: digests(fields) };
    });
    return {
      file: rel, set: rel === "android/app/google-services.json" ? null : rel.split("/")[3],
      projectId: info.project_id || null, digests: digests(project), clients,
    };
  }).filter(Boolean);
}

const digests = (fields) => Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, digest(v)]));

function read(io) {
  const errors = [];
  const sets = io.list("android/app/src").filter((e) => e.dir).map((e) => e.name);
  return { manifest: manifest(io), sourceSets: sets, strings: strings(io, sets), firebase: googleServices(io, sets, errors), errors };
}

// ---- write half: ops over the engine's tree ----

const valuesFile = (set) => `android/app/src/${set}/res/values/strings.xml`;
const hide = (text) => text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));

// What AAPT2 needs to read a display name back as itself: XML's three specials as entities, a backslash before every
// backslash, apostrophe and double quote, and before a leading @ or ? (which would read as a resource reference).
function escape(value) {
  const s = value.replace(/\\/g, "\\\\").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "\\'").replace(/"/g, '\\"');
  return /^[@?]/.test(s) ? `\\${s}` : s;
}

// Sets <string name="key"> in a resources file, outside comments: replaces its text when it reads as another value,
// or adds the element before </resources>. -> the new text, or null when the file has no </resources>.
function setString(text, key, value) {
  const live = hide(text);
  const el = new RegExp(`(<string\\s+name\\s*=\\s*"${key}"[^>]*>)([\\s\\S]*?)(</string>)`).exec(live);
  if (el) {
    const open = el.index + el[1].length;
    const inner = text.slice(open, open + el[2].length);
    return xmlText(inner.trim()) === value ? text : `${text.slice(0, open)}${escape(value)}${text.slice(open + el[2].length)}`;
  }
  const close = live.lastIndexOf("</resources>");
  if (close < 0) return null;
  const at = text.lastIndexOf("\n", close - 1) + 1;
  const indent = (/^([ \t]+)</m.exec(live.slice(live.indexOf("<resources"), close)) || [, "    "])[1];
  return `${text.slice(0, at)}${indent}<string name="${key}">${escape(value)}</string>\n${text.slice(at)}`;
}

const ops = {
  // android:label on <application> points at the name resource every flavor sets.
  label(tree, { key }) {
    const text = tree.read(MANIFEST);
    if (text === null) return tree.conflict(MANIFEST, "AndroidManifest.xml is missing");
    const app = /<application\b[^>]*>/.exec(hide(text));
    const attr = app && /(android:label\s*=\s*")([^"]*)(")/.exec(text.slice(app.index, app.index + app[0].length));
    if (!attr) return tree.conflict(MANIFEST, "<application> has no android:label to point at the name resource");
    const at = app.index + attr.index + attr[1].length;
    tree.write(MANIFEST, `${text.slice(0, at)}@string/${key}${text.slice(at + attr[2].length)}`);
  },

  // One display name per source set: a new strings.xml for a flavor without one, the value set in place where the
  // key already exists, and production's name in a managed block in src/main unless main already spells the key.
  strings(tree, { key, files }) {
    for (const { set, name, block } of files) {
      const rel = valuesFile(set);
      const text = tree.read(rel);
      if (text === null && !block) { tree.write(rel, render("strings-flavor.xml", { key, value: escape(name) })); continue; }
      const base = text === null ? render("strings-main.xml") : text;
      const own = readBlock(base, { id: "app-name", syntax: "xml" });
      const outside = own ? base.slice(0, own.start) + base.slice(own.end) : base;
      if (!block || (!own && new RegExp(`<string\\s+name\\s*=\\s*"${key}"`).test(hide(outside)))) {
        const next = setString(base, key, name);
        if (next === null) { tree.conflict(rel, `${rel} has no </resources> to hold ${key}`); continue; }
        tree.write(rel, next);
        continue;
      }
      const anchor = (t) => { const close = hide(t).lastIndexOf("</resources>"); return close < 0 ? -1 : t.lastIndexOf("\n", close - 1) + 1; };
      const r = ensureBlock(base, { id: "app-name", syntax: "xml", body: `<string name="${key}">${escape(name)}</string>\n`, anchor, indent: "    " });
      if (r.state === "conflict") { tree.conflict(rel, own ? "the app-name block was edited by hand" : `${rel} has no </resources> to place the app-name block before`); continue; }
      tree.write(rel, r.text);
    }
  },
};

module.exports = { read, ops, escape, xmlText };
