"use strict";
// flutter_envs.json, the one committed record of what the project cannot say about itself. `parseSpec` is the boundary:
// it refuses a bad file with one line per reason, production sharing a Firebase project above all, and what it returns
// is trusted. `draftSpec` derives the same shape from the matrix, each field with its provenance, plus the questions.
// `answer` applies --set values on either.

const { CONVENTIONS, INPUT_KEYS } = require("./vocab.cjs");

const ANDROID_ID = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const IOS_ID = /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/;
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const COLOR = /^[0-9A-Fa-f]{6}$/;
const TOP_KEYS = ["version", "production", "environments"];
const ENV_KEYS = ["id", "name", "firebase", "iosId", "badge"];

class SpecError extends Error {
  constructor(lines) { super(lines[0]); this.lines = lines; }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const validEnv = (name) => CONVENTIONS.envPattern.test(name) && !CONVENTIONS.reservedEnvs.includes(name.toLowerCase());
const title = (env) => env.charAt(0).toUpperCase() + env.slice(1);
const badgeFor = (env, index) => ({
  label: CONVENTIONS.badgeLabels[env] || env.replace(/[aeiou]/g, "").slice(0, 3).toUpperCase() || env.slice(0, 3).toUpperCase(),
  color: CONVENTIONS.badgeColors[index % CONVENTIONS.badgeColors.length],
});
// An environment's badge: the one the spec records, else the table's, coloured by its place among the non-production
// environments, so the draft, the committed file and every later run badge it alike.
const badgeOf = (spec, env) => spec.environments[env].badge || badgeFor(env, Object.keys(spec.environments).filter((e) => e !== spec.production).indexOf(env));

function parseSpec(text) {
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new SpecError([`flutter_envs.json is not valid JSON: ${e.message}`]); }
  if (!isObj(json)) throw new SpecError(["flutter_envs.json must hold one JSON object"]);
  const out = [];
  for (const k of Object.keys(json)) if (!TOP_KEYS.includes(k)) out.push(`flutter_envs.json: unknown key "${k}"`);
  if (json.version !== 1) out.push("flutter_envs.json: version must be 1");
  const envs = isObj(json.environments) ? json.environments : null;
  if (!envs) out.push("flutter_envs.json: environments must be an object of environment name to settings");
  const names = envs ? Object.keys(envs) : [];
  for (const name of names) {
    const e = envs[name];
    const where = `flutter_envs.json: environments.${name}`;
    if (!validEnv(name)) out.push(`${where}: the name must be lowercase letters and digits, starting with a letter, and not ${CONVENTIONS.reservedEnvs.join(", ")}`);
    if (!isObj(e)) { out.push(`${where} must be an object`); continue; }
    for (const k of Object.keys(e)) if (!ENV_KEYS.includes(k)) out.push(`${where}: unknown key "${k}"`);
    const iosOwn = typeof e.iosId === "string";
    if (typeof e.id !== "string" || !ANDROID_ID.test(e.id) || (!iosOwn && !IOS_ID.test(e.id))) {
      out.push(`${where}.id must be a valid application id on ${iosOwn ? "Android" : "both platforms"} (dot-separated segments starting with a letter${iosOwn ? "" : ", no _"})`);
    }
    if (e.iosId !== undefined && (!iosOwn || !IOS_ID.test(e.iosId))) out.push(`${where}.iosId must be a valid bundle id (segments start with a letter, no _)`);
    if (typeof e.name !== "string" || !e.name.trim()) out.push(`${where}.name must be a non-empty string`);
    else if (/\/\/|"/.test(e.name)) out.push(`${where}.name must not contain // or "`);
    if (e.firebase !== undefined && e.firebase !== null && (typeof e.firebase !== "string" || !PROJECT_ID.test(e.firebase))) {
      out.push(`${where}.firebase must be a Firebase project id (6 to 30 lowercase letters, digits and hyphens) or null`);
    }
    if (e.badge !== undefined) {
      if (!isObj(e.badge) || typeof e.badge.label !== "string" || !e.badge.label.trim() || !COLOR.test(e.badge.color || "") || Object.keys(e.badge).some((k) => k !== "label" && k !== "color")) {
        out.push(`${where}.badge must be { "label": "<text>", "color": "<6 hex digits>" }`);
      }
    }
  }
  if (typeof json.production !== "string" || !names.includes(json.production)) out.push("flutter_envs.json: production must name one of the environments");
  else if (names.length < 2) out.push("flutter_envs.json: production needs at least one other environment");
  const repeats = (label, values, already = () => false) => {
    const seen = new Map();
    for (const [env, v] of values) {
      if (typeof v !== "string") continue;
      if (seen.has(v) && !already(env, seen.get(v))) out.push(`flutter_envs.json: ${env} and ${seen.get(v)} share the ${label} ${v}`);
      if (!seen.has(v)) seen.set(v, env);
    }
  };
  if (envs) {
    const entries = names.filter((n) => isObj(envs[n])).map((n) => [n, envs[n]]);
    repeats("id", entries.map(([n, e]) => [n, e.id]));
    repeats("iOS id", entries.map(([n, e]) => [n, e.iosId || e.id]), (a, b) => !envs[a].iosId && !envs[b].iosId);
    repeats("name", entries.map(([n, e]) => [n, e.name]));
    const prod = envs[json.production];
    if (isObj(prod) && typeof prod.firebase === "string") {
      for (const [n, e] of entries) {
        if (n !== json.production && e.firebase === prod.firebase) out.push(`flutter_envs.json: production's Firebase project ${prod.firebase} is also ${n}'s; production must have its own`);
      }
    }
  }
  if (out.length) throw new SpecError(out);
  return { version: 1, production: json.production, environments: envs };
}

const input = (value, source, at, basis) => ({ value, source, ...(at ? { at } : {}), ...(basis ? { basis } : {}) });
const isTemplateId = (id) => typeof id === "string" && id.startsWith("com.example");
const isPlaceholderName = (name, pubspecName) =>
  !name || /^(flutter_base|flutter demo)$/i.test(name.trim()) || /^[a-z0-9]+(_[a-z0-9]+)+$/.test(name) || (pubspecName && name === pubspecName && /_/.test(name));

// The app name for new labels: a literal CFBundleDisplayName, else a literal Android label, else the pubspec name.
function appName(facts) {
  const info = facts.apple.info;
  const ios = info && info.displayName && !/\$\(|\$\{/.test(info.displayName.value) ? info.displayName : null;
  const label = facts.android.manifest && facts.android.manifest.label;
  const pubspec = facts.envfiles.pubspec && facts.envfiles.pubspec.name;
  if (ios && !isPlaceholderName(ios.value, pubspec)) return { value: ios.value, at: ios.at, placeholder: false };
  if (label && label.literal && !isPlaceholderName(label.literal, pubspec)) return { value: label.literal, at: label.at, placeholder: false };
  const fallback = (pubspec || "app").split("_").map(title).join(" ");
  return { value: fallback, at: "pubspec.yaml", placeholder: true };
}

const consistent = (byConfig) => { const v = [...new Set(Object.values(byConfig || {}).filter(Boolean))]; return v.length === 1 ? v[0] : null; };

// -> { source: 'draft', production, environments, fields, questions }. Pure over the facts and the matrix.
function draftSpec(facts, matrix) {
  const fields = {};
  const questions = [];
  const ask = (id, text, dflt, basis) => questions.push({ id, ask: text, default: dflt, basis });
  const known = matrix.envs.length > 0;
  const envs = known ? matrix.envs : [...CONVENTIONS.defaultEnvs];
  fields.environments = known
    ? input(envs, "derived", matrix.sources.first || undefined)
    : input(envs, "default", undefined, "dev, staging and production, the owner's most common set");
  if (!known) ask("envs", `Environments: keep ${envs.join(", ")}, with production shipping to the stores?`, envs, "nothing in the project names an environment yet");
  let production = known ? matrix.production : "production";
  fields.production = production ? input(production, known ? "derived" : "default") : input(null, "default", undefined, "no environment is named production, prod, prd or live");
  if (known && !production) ask("envs", `Which environment ships to the stores: ${envs.join(", ")}?`, null, "no environment is named production, prod, prd or live, or several are");
  const nonProd = envs.filter((e) => e !== production);
  const environments = {};
  const name = appName(facts);
  const gradleDefault = facts.gradle.defaultId;
  const iosPlain = (facts.pbxproj.targets.find((t) => t.name === "Runner") || { configs: [] }).configs.find((c) => /^(Release|Debug)$/.test(c.name));
  const iosPlainId = iosPlain && iosPlain.settings.PRODUCT_BUNDLE_IDENTIFIER;
  const prodAndroid = production && matrix.cell("androidId", production);
  const prodIos = production && matrix.cell("iosId", production);
  const prodId = (prodAndroid && prodAndroid.value) || (prodIos && consistent(prodIos.value.byConfig)) || (gradleDefault && gradleDefault.value) || (iosPlainId && iosPlainId.value) || null;
  const prodIdAt = (prodAndroid && prodAndroid.at) || (prodIos && prodIos.at) || (gradleDefault && gradleDefault.at) || (iosPlainId && iosPlainId.at) || null;
  const firebaseInUse = matrix.firebaseInUse;
  let unknownNonProdFirebase = 0;
  envs.forEach((env, index) => {
    const e = {};
    const path = (k) => `environments.${env}.${k}`;
    const a = matrix.cell("androidId", env);
    const i = matrix.cell("iosId", env);
    const iosValue = i && consistent(i.value.byConfig);
    if (env === production) {
      if (!prodId || isTemplateId(prodId)) {
        fields[path("id")] = input(null, "default", prodIdAt, prodId ? `${prodId} is the flutter create placeholder` : "no application id exists yet");
        if (!questions.some((q) => q.id === "prodId")) ask("prodId", "Production application id (for example com.acme.shop)?", null, prodId ? `${prodId} is the flutter create placeholder` : "no application id exists yet");
      } else fields[path("id")] = input(prodId, "derived", prodIdAt);
    } else if (a && a.value) fields[path("id")] = input(a.value, "derived", a.at);
    else if (iosValue) fields[path("id")] = input(iosValue, "derived", i.at);
    else fields[path("id")] = input(prodId && !isTemplateId(prodId) ? `${prodId}.${env}` : null, "default", undefined, "the production id plus .<env>");
    if (a && a.value && iosValue && iosValue !== a.value) fields[path("iosId")] = input(iosValue, "derived", i.at);

    const an = matrix.cell("androidName", env);
    const inn = matrix.cell("iosName", env);
    const androidOwn = an && an.value.from !== "main" && an.value.from !== "literal" && an.value.value ? an.value.value : null;
    const iosOwn = inn ? consistent(inn.value.byConfig) : null;
    const fallbackName = env === production ? name.value : `${name.value} ${title(env)}`;
    if (androidOwn && iosOwn && androidOwn !== iosOwn) {
      fields[path("name")] = input(androidOwn, "default", an.at, `Android shows "${androidOwn}" and iOS "${iosOwn}"`);
      if (!questions.some((q) => q.id === "appName")) ask("appName", "Display name of the app in production?", name.value, "the platforms show different names");
    } else if (androidOwn || iosOwn) fields[path("name")] = input(androidOwn || iosOwn, "derived", androidOwn ? an.at : inn.at);
    else if (env === production && an && an.value.value && an.value.from !== "literal") fields[path("name")] = input(an.value.value, "derived", an.at);
    else fields[path("name")] = input(fallbackName, "default", name.at, env === production ? "the app name" : "the app name plus the environment");
    if (name.placeholder && !questions.some((q) => q.id === "appName") && fields[path("name")].source === "default") {
      ask("appName", "Display name of the app in production?", name.value, `the current label is a placeholder; ${name.value} is derived from the pubspec name`);
    }

    if (firebaseInUse) {
      const fa = matrix.cell("fbAndroid", env);
      const fi = matrix.cell("fbIos", env);
      const fe = matrix.cell("fbEnv", env);
      const native = (fa && fa.value.present && !fa.value.fallback && fa.value.projectId) ? fa : (fi && fi.value.present && fi.value.projectId) ? fi : null;
      const nativeId = native && native.value.projectId;
      const envId = fe && fe.value.projectId && !/PROJECT_ID/.test(fe.value.projectId) ? fe.value.projectId : null;
      const literal = (facts.dart.firebase.main && facts.dart.firebase.main.projectIds.length === 1) ? facts.dart.firebase.main.projectIds[0] : null;
      const candidate = nativeId || envId || literal;
      const at = nativeId ? native.at : envId ? fe.at : literal ? "lib/firebase_options.dart" : undefined;
      if (env === production) {
        const shared = candidate && nonProd.some((o) => projectOf(matrix, o) === candidate);
        if (candidate && !shared) fields[path("firebase")] = input(candidate, "derived", at);
        else {
          fields[path("firebase")] = input(null, "default", at, candidate ? `the production sources name ${candidate}, a non-production project` : "production's Firebase files are not on this machine");
          ask("firebaseProd", "Production's Firebase project id (it must be its own), or none if it is not created yet?", null, fields[path("firebase")].basis);
        }
      } else if (candidate) fields[path("firebase")] = input(candidate, "derived", at);
      else { fields[path("firebase")] = input(null, "default", undefined, "non-production environments share one project, the owner's usual layout"); unknownNonProdFirebase++; }
    }
    if (env !== production) fields[path("badge")] = input(badgeFor(env, nonProd.indexOf(env)), "default", undefined, "the badge table");
    environments[env] = e;
  });
  if (firebaseInUse && nonProd.length >= 2 && unknownNonProdFirebase === nonProd.length) {
    ask("firebaseNonprod", `Should ${nonProd.join(" and ")} share one Firebase project (less to set up; their data and logins mix) or get one each? Production always gets its own.`, "shared", "the owner's usual layout");
  }
  return assemble("draft", production, envs, fields, questions.slice(0, CONVENTIONS.maxQuestions));
}

const projectOf = (matrix, env) => {
  for (const facet of ["fbAndroid", "fbIos", "fbEnv"]) { const c = matrix.cell(facet, env); if (c && c.value.projectId && !(c.value.fallback)) return c.value.projectId; }
  return null;
};

// A parsed file spec in the same shape as a draft: every field derived from the committed file.
function fromFile(parsed, text) {
  const fields = {};
  const lineOf = (needle) => { const i = text.indexOf(needle); return i < 0 ? "flutter_envs.json" : `flutter_envs.json:${text.slice(0, i).split("\n").length}`; };
  fields.environments = input(Object.keys(parsed.environments), "derived", "flutter_envs.json");
  fields.production = input(parsed.production, "derived", lineOf('"production"'));
  for (const [env, e] of Object.entries(parsed.environments)) {
    for (const k of ENV_KEYS) if (e[k] !== undefined) fields[`environments.${env}.${k}`] = input(e[k], "derived", lineOf(`"${env}"`));
  }
  return assemble("file", parsed.production, Object.keys(parsed.environments), fields, []);
}

function assemble(source, production, envs, fields, questions) {
  const environments = {};
  for (const env of envs) {
    const e = {};
    for (const k of ENV_KEYS) { const f = fields[`environments.${env}.${k}`]; if (f && (f.value !== null || k === "firebase")) e[k] = f.value; }
    environments[env] = e;
  }
  return { source, production, environments, fields, questions, settings: {} };
}

// --set values, validated at the boundary: -> { values } or throws SpecError with one line per bad value.
const SETTINGS = { bannerGuard: ["on", "off"], icons: ["keep", "regen"], defaultFlavor: ["on", "off"], "firebase.nonprod": ["shared", "separate"], "firebase.productionFiles": ["ci", "tracked"], "firebase.refresh": ["yes", "no"] };
function parseSets(pairs) {
  const values = {};
  const bad = [];
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    const value = eq < 0 ? "" : pair.slice(eq + 1);
    if (!INPUT_KEYS.includes(key)) { bad.push(`--set ${key}: unknown key; the keys are ${INPUT_KEYS.join(", ")}`); continue; }
    const fail = (why) => bad.push(`--set ${key}=${value}: ${why}`);
    if (SETTINGS[key]) { if (!SETTINGS[key].includes(value)) fail(`must be ${SETTINGS[key].join(" or ")}`); else values[key] = value; continue; }
    if (key === "envs") { const list = value.split(",").map((s) => s.trim()).filter(Boolean); if (list.length < 2 || !list.every(validEnv)) fail("must list two or more lowercase environment names"); else values.envs = list; continue; }
    if (key === "production") { if (!validEnv(value)) fail("must be an environment name"); else values.production = value; continue; }
    if (key === "appName") { if (!value.trim() || /\/\/|"/.test(value)) fail('must be a name without // or "'); else values.appName = value.trim(); continue; }
    if (key === "prodId" || key === "androidId") { if (!ANDROID_ID.test(value) || (key === "prodId" && !IOS_ID.test(value))) fail("must be a valid application id"); else values[key] = value; continue; }
    if (key === "iosId") { if (!IOS_ID.test(value)) fail("must be a valid bundle id"); else values.iosId = value; continue; }
    if (key === "labels" || key === "firebase.projects") {
      const map = {};
      for (const item of value.split(",").filter(Boolean)) {
        const [env, a, b] = item.split(":");
        if (!validEnv(env || "")) { fail(`${item}: ${env} is not an environment name`); continue; }
        if (key === "labels") { if (!a || (b !== undefined && !COLOR.test(b))) fail(`${item}: use env:LABEL or env:LABEL:RRGGBB`); else map[env] = { label: a, ...(b ? { color: b.toUpperCase() } : {}) }; }
        else if (a === "none") map[env] = null;
        else if (!PROJECT_ID.test(a || "")) fail(`${item}: ${a} is not a Firebase project id`);
        else map[env] = a;
      }
      values[key] = map;
    }
  }
  if (bad.length) throw new SpecError(bad);
  return values;
}

// Applies parsed --set values to a spec (file or draft): each value it changes becomes `asked`. An environment the spec
// does not hold yet is named after the app: production's name when the spec has one, else `appName`, which the caller
// derives from the project.
function answer(spec, values, appName = "App") {
  const fields = { ...spec.fields };
  const asked = (path, value) => { fields[path] = input(value, "asked", "--set"); };
  let envs = Object.keys(spec.environments);
  let production = spec.production;
  if (values.envs) { envs = values.envs; asked("environments", envs); }
  if (values.production) production = values.production;
  else if (values.envs && !envs.includes(production)) production = envs.find((e) => CONVENTIONS.productionNames.includes(e)) || null;
  if (production !== spec.production || values.production) asked("production", production);
  const prodId = values.prodId || values.androidId;
  const baseName = (production && spec.environments[production] && spec.environments[production].name) || appName;
  for (const env of envs) {
    const p = (k) => `environments.${env}.${k}`;
    if (env === production && prodId) asked(p("id"), prodId);
    else if (prodId && (!fields[p("id")] || fields[p("id")].source !== "derived")) asked(p("id"), `${prodId}.${env}`);
    if (env === production && values.iosId) asked(p("iosId"), values.iosId);
    if (values.appName) asked(p("name"), env === production ? values.appName : `${values.appName} ${title(env)}`);
    if (values.labels && values.labels[env]) asked(p("badge"), { ...badgeFor(env, 0), ...values.labels[env] });
    if (values["firebase.projects"] && env in values["firebase.projects"]) asked(p("firebase"), values["firebase.projects"][env]);
    if (!fields[p("name")]) fields[p("name")] = input(env === production ? baseName : `${baseName} ${title(env)}`, "default", undefined, "no name known");
  }
  const answered = new Set(Object.entries(fields).filter(([, f]) => f.source === "asked").map(([k]) => k));
  const questions = spec.questions.filter((q) => !(
    (q.id === "prodId" && prodId) || (q.id === "envs" && values.envs) || (q.id === "appName" && values.appName)
    || (q.id === "firebaseProd" && values["firebase.projects"] && production in values["firebase.projects"])
    || (q.id === "firebaseNonprod" && values["firebase.nonprod"])));
  const out = assemble(spec.source, production, envs, fields, questions);
  out.settings = Object.fromEntries(Object.entries(values).filter(([k]) => SETTINGS[k]));
  out.answered = [...answered];
  return out;
}

// The text of flutter_envs.json for a spec: the decisions only, in generation order. A badge stays out while it is the
// table's default, since the table can say it again. The caller runs parseSpec over the result before writing it.
function toFile(spec) {
  const environments = {};
  for (const [env, e] of Object.entries(spec.environments)) {
    const badge = spec.fields[`environments.${env}.badge`];
    environments[env] = {
      ...(e.id !== undefined ? { id: e.id } : {}),
      name: e.name,
      ...("firebase" in e ? { firebase: e.firebase } : {}),
      ...(e.iosId ? { iosId: e.iosId } : {}),
      ...(e.badge && badge && badge.source !== "default" ? { badge: e.badge } : {}),
    };
  }
  return `${JSON.stringify({ version: 1, production: spec.production, environments }, null, 2)}\n`;
}

module.exports = { SpecError, parseSpec, draftSpec, fromFile, parseSets, answer, toFile, validEnv, isTemplateId, badgeOf, appName, ANDROID_ID, IOS_ID };
