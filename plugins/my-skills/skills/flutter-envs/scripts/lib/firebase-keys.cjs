"use strict";
// FIREBASE_* env keys as a projection of the native Firebase files (spec 7.4). Pure: text in, facts out, keys out.
// Values stay inside: compareKeys answers with key names and states only. The table is CONVENTIONS.firebaseKeys.

const crypto = require("node:crypto");
const { CONVENTIONS } = require("./vocab.cjs");

class NativeParseError extends Error {
  constructor(file, reason) {
    super(`${file}: ${reason}`);
    this.name = "NativeParseError";
    this.file = file;
    this.reason = reason;
  }
}

const str = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const list = (v) => (Array.isArray(v) ? v : []);

function androidFacts(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new NativeParseError("google-services.json", "not JSON");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new NativeParseError("google-services.json", "not a JSON object");
  const info = json.project_info || {};
  return {
    projectId: str(info.project_id),
    projectNumber: str(info.project_number),
    storageBucket: str(info.storage_bucket),
    clients: list(json.client).map((c) => ({
      packageName: str(c?.client_info?.android_client_info?.package_name),
      appId: str(c?.client_info?.mobilesdk_app_id),
      apiKey: str(list(c?.api_key).find((k) => str(k?.current_key) !== null)?.current_key),
      oauth: list(c?.oauth_client).map((o) => ({
        type: str(o?.client_type),
        clientId: str(o?.client_id),
        packageName: str(o?.android_info?.package_name),
      })),
    })),
  };
}

// The XML plist subset GoogleService-Info.plist uses: dict, key, string, true, false, integer.
const PLIST = "GoogleService-Info.plist";
const MARKUP = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z][\w.-]*)(?:\s[^>]*?)?(\/?)>/g;
const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, name) => {
    if (name[0] === "#") return String.fromCodePoint(name[1] === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    if (!(name in ENTITIES)) throw new NativeParseError(PLIST, `unknown entity &${name};`);
    return ENTITIES[name];
  });
}

function lex(xml) {
  const tokens = [];
  const text = (t) => {
    const last = tokens[tokens.length - 1];
    if (last && last.text !== undefined) last.text += t;
    else tokens.push({ text: t });
  };
  let at = 0;
  for (const m of xml.matchAll(MARKUP)) {
    if (m.index > at) text(decode(xml.slice(at, m.index)));
    at = m.index + m[0].length;
    if (m[1] !== undefined) text(m[1]);
    else if (m[3]) tokens.push({ tag: m[3], close: m[2] === "/", empty: m[4] === "/" });
  }
  if (at < xml.length) text(decode(xml.slice(at)));
  return tokens;
}

function parsePlist(xml) {
  const tokens = lex(xml);
  let i = 0;
  const fail = (reason) => {
    throw new NativeParseError(PLIST, reason);
  };
  const skipBlank = () => {
    while (i < tokens.length && tokens[i].text !== undefined) {
      if (tokens[i].text.trim()) fail("text outside an element");
      i++;
    }
  };
  const closeOf = (tag) => {
    const body = tokens[i] && tokens[i].text !== undefined ? tokens[i++].text : "";
    const end = tokens[i++];
    if (!end || end.tag !== tag || !end.close) fail(`<${tag}> holds markup or is not closed`);
    return body;
  };
  const value = () => {
    skipBlank();
    const t = tokens[i++];
    if (!t || !t.tag || t.close) fail("a value is missing");
    if (t.tag === "dict") return t.empty ? {} : dict();
    if (t.tag === "string") return t.empty ? "" : closeOf("string");
    if (t.tag === "true" || t.tag === "false") {
      if (!t.empty && closeOf(t.tag).trim()) fail(`<${t.tag}> holds text`);
      return t.tag === "true";
    }
    if (t.tag === "integer") {
      const digits = closeOf("integer").trim();
      if (!/^[+-]?\d+$/.test(digits)) fail("an <integer> is not a whole number");
      return Number(digits);
    }
    return fail(`<${t.tag}> is not supported`);
  };
  const dict = () => {
    const out = {};
    for (;;) {
      skipBlank();
      const t = tokens[i++];
      if (t && t.tag === "dict" && t.close) return out;
      if (!t || t.tag !== "key" || t.close || t.empty) fail("a <dict> entry has no <key>");
      out[closeOf("key")] = value();
    }
  };
  skipBlank();
  const root = tokens[i++];
  if (!root || root.tag !== "plist" || root.close || root.empty) fail("no <plist> root");
  const top = value();
  skipBlank();
  const end = tokens[i++];
  if (!end || end.tag !== "plist" || !end.close) fail("<plist> is not closed");
  skipBlank();
  if (i < tokens.length) fail("content after </plist>");
  if (!top || typeof top !== "object") fail("the root is not a <dict>");
  return top;
}

// -> { android, ios }, each null when its text is absent. Throws NativeParseError naming the file, never its content.
function nativeFacts(googleServicesJsonText, plistXmlText) {
  return {
    android: googleServicesJsonText == null ? null : androidFacts(googleServicesJsonText),
    ios: plistXmlText == null ? null : parsePlist(plistXmlText),
  };
}

// A client id derives only when exactly one exists: with one type-1 client per signing certificate, picking one would
// pick a machine.
function sole(values) {
  const distinct = [...new Set(values.filter((v) => typeof v === "string" && v))];
  return distinct.length === 1 ? distinct[0] : undefined;
}

// How each google-services.json field CONVENTIONS.firebaseKeys names is read. The rows read what the google-services
// plugin (4.4.2) reads: the first api_key with a current_key, and for the type-3 client the first one, which it writes
// as default_web_client_id. The two OAuth clients are compared only when env/<env>.json already sets them.
const ANDROID_FIELDS = Object.freeze({
  project_id: (c, a) => a.projectId,
  storage_bucket: (c, a) => a.storageBucket,
  project_number: (c, a) => a.projectNumber,
  mobilesdk_app_id: (c) => c.appId,
  current_key: (c) => c.apiKey,
  oauth_type_1: (c, a, id) => sole(c.oauth.filter((o) => o.type === "1" && (o.packageName ?? id) === id).map((o) => o.clientId)),
  oauth_type_3: (c) => c.oauth.find((o) => o.type === "3" && o.clientId)?.clientId,
});
const WHEN_PRESENT = new Set(["oauth_type_1", "oauth_type_3"]);

// The spec's table from the vocabulary, in its order. A field without a reader fails at load, so a new row in the
// vocabulary cannot be skipped in silence.
function table({ android, ios }) {
  return Object.freeze([...new Set([...Object.keys(android), ...Object.keys(ios)])].map((key) => {
    if (key in android && !ANDROID_FIELDS[android[key]]) throw new Error(`firebase-keys: no reader for the google-services.json field ${android[key]} of ${key}`);
    return Object.freeze({
      key,
      optional: WHEN_PRESENT.has(android[key]),
      ...(key in android ? { android: ANDROID_FIELDS[android[key]] } : {}),
      ...(key in ios ? { ios: (p) => p[ios[key]] } : {}),
    });
  }));
}
const KEYS = table(CONVENTIONS.firebaseKeys);

// -> { [ENV_KEY]: value }. A file contributes only when it belongs to the environment's app: Android needs a client
// whose package is androidId, iOS needs BUNDLE_ID equal to iosId (when iosId is known). A key both files supply but
// disagree on is left out, because choosing one would be a decision. Values compare as text, so a plist <integer>
// and a JSON string of the same digits agree.
function deriveKeys({ android, ios, androidId, iosId }) {
  const client = android ? android.clients.find((c) => c.packageName === androidId) : undefined;
  const plist = ios && (iosId == null || ios.BUNDLE_ID === iosId) ? ios : null;
  const out = {};
  for (const r of KEYS) {
    const found = [];
    if (r.android && client) found.push(r.android(client, android, androidId));
    if (r.ios && plist) found.push(r.ios(plist));
    const values = found.map(str).filter((v) => v);
    if (values.length && values.every((v) => v === values[0])) out[r.key] = values[0];
  }
  return out;
}

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const asText = (v) => (typeof v === "string" ? v : JSON.stringify(v));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// -> [{ key, state }] in table order, for the Firebase keys only. No value and no digest leaves this function.
function compareKeys(envKeys, derived) {
  const env = envKeys || {};
  const out = [];
  for (const { key, optional } of KEYS) {
    const inEnv = has(env, key);
    const inDerived = has(derived, key);
    if (!inEnv && (optional || !inDerived)) continue;
    let state = "not-derivable";
    if (inEnv && inDerived) state = sha256(asText(env[key])) === sha256(derived[key]) ? "match" : "differs";
    else if (inDerived) state = "missing-in-env";
    out.push({ key, state });
  }
  return out;
}

module.exports = { KEYS, table, NativeParseError, nativeFacts, deriveKeys, compareKeys };
