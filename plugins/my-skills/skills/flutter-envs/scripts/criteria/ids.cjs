"use strict";
// Criterion 1, distinct ids: each environment builds its own application id on both platforms, through a shared scheme
// that selects it, with the CocoaPods layer a renamed configuration needs. Rules are pure over the context.

const { CONVENTIONS, finding, edit } = require("../lib/vocab.cjs");

const MODE = /^(Debug|Release|Profile)[-_ ](.+)$/i;
const runner = (facts) => facts.pbxproj.targets.find((t) => t.name === "Runner") || null;
const configsFor = (facts, env) => (runner(facts) ? runner(facts).configs.filter((c) => { const m = MODE.exec(c.name || ""); return m && m[2].toLowerCase() === env; }) : []);
const unresolved = (v) => typeof v === "string" && /\$[({]/.test(v);
const isTemplate = (v) => typeof v === "string" && v.startsWith("com.example");
const list = (items, n = 3) => (items.length > n ? `${items.slice(0, n).join(", ")} and ${items.length - n} more` : items.join(", "));
const and = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const expected = (spec, env) => spec.environments[env] || {};
const says = (spec, env, key) => {
  const f = spec.fields[`environments.${env}.${key}`];
  return !f ? "the spec" : f.source === "asked" ? "--set" : spec.source === "file" ? "flutter_envs.json" : "the draft";
};

// apply edits only a flavor block it wrote; any other block is foreign, and a recipe names its lines.
const androidEdit = (g, edit) => (g.owner === "skill" || g.owner === "none" ? { ref: edit }
  : { ref: g.owner === "hand" && g.flavors.some((f) => !f.id) ? "ids.extend-suffix-style" : "ids.adopt-foreign-block", blocked: "foreign" });

function flavored(facts, m) { return facts.gradle.flavors.length > 0 || m.sources.ios.length > 0; }

function templateIds(ctx) {
  const { facts, matrix: m, spec } = ctx;
  const hits = [];
  // A template id is left to ids.id-differs only where that rule compares it: a flavor or a flavored configuration.
  const known = (env) => { const e = expected(spec, env); return e.id && !isTemplate(e.id); };
  const prod = spec.production;
  if (facts.gradle.flavors.length) {
    for (const f of facts.gradle.flavors) if (isTemplate(f.effectiveId) && !known(f.name.toLowerCase())) hits.push({ text: `${f.effectiveId} (Android ${f.name})`, at: f.idAt || f.at });
  } else if (facts.gradle.defaultId && isTemplate(facts.gradle.defaultId.value) && !(prod && known(prod))) {
    hits.push({ text: `${facts.gradle.defaultId.value} (Android defaultConfig)`, at: facts.gradle.defaultId.at });
  }
  const r = runner(facts);
  const flavoredIos = m.sources.ios.length > 0;
  for (const c of r ? r.configs : []) {
    const id = (c.settings.PRODUCT_BUNDLE_IDENTIFIER || {}).value;
    const mode = MODE.exec(c.name || "");
    if (!isTemplate(id) || (flavoredIos && !mode)) continue;
    if (mode && known(mode[2].toLowerCase())) continue;
    hits.push({ text: `${id} (iOS ${c.name})`, at: c.settings.PRODUCT_BUNDLE_IDENTIFIER.at });
  }
  if (!hits.length) return [];
  return [finding("ids.template-id", null, `the flutter create placeholder id is still in use: ${list(hits.map((h) => h.text))}`, hits.map((h) => h.at), { ref: "gradle.default-id" })];
}

function check(ctx) {
  const { facts, matrix: m, spec } = ctx;
  const g = facts.gradle;
  const r = runner(facts);
  const out = [];
  out.push(...templateIds(ctx));
  if (!flavored(facts, m)) {
    out.unshift(finding("ids.no-flavors", null, "neither the Gradle file nor the Runner target defines a flavor", [g.defaultId && g.defaultId.at, r && r.configs[0] && r.configs[0].at], { ref: "gradle.flavors" }));
    const prod = spec.production && expected(spec, spec.production);
    if (prod && prod.id && !isTemplate(prod.id)) {
      const differs = [];
      if (g.defaultId && g.defaultId.value !== prod.id && !isTemplate(g.defaultId.value)) differs.push({ text: `Android ${g.defaultId.value}`, at: g.defaultId.at });
      if (differs.length) out.push(finding("ids.id-differs", spec.production, `${spec.production}: ${differs.map((d) => d.text).join(", ")}; ${says(spec, spec.production, "id")} says ${prod.id}`, differs.map((d) => d.at), { ref: "gradle.default-id" }));
    }
    return out;
  }

  const listed = Object.keys(spec.environments);
  const envs = spec.source === "file" ? m.envs.filter((e) => listed.includes(e)) : m.envs;
  for (const env of m.envs.filter((e) => !envs.includes(e))) {
    const where = [g.flavors.some((f) => f.name.toLowerCase() === env) && "a Gradle flavor", configsFor(facts, env).length && "iOS configurations", m.cell("envFile", env) && `env/${env}.json`].filter(Boolean);
    out.push(finding("ids.env-unlisted", env, `${env} has ${and(where.length ? where : ["files"])}, but flutter_envs.json does not list it`, [m.cell("androidId", env) && m.cell("androidId", env).at, m.cell("iosId", env) && m.cell("iosId", env).at]));
  }

  for (const env of envs) {
    if (g.file && !g.flavors.some((f) => f.name.toLowerCase() === env)) {
      out.push(finding("ids.env-missing", env, `${env} has no Android flavor in ${g.file}`, [g.flavorsAt || g.file], androidEdit(g, "gradle.flavors")));
    }
    if (r) {
      const have = new Set(configsFor(facts, env).map((c) => MODE.exec(c.name)[1].toLowerCase()));
      const missing = CONVENTIONS.modes.filter((mode) => !have.has(mode.toLowerCase())).map((mode) => `${mode}-${env}`);
      if (missing.length) out.push(finding("ids.env-missing", env, `${env} has no ${and(missing)} configuration in the Runner target`, [facts.pbxproj.file], { ref: "pbxproj.clone-flavors" }));
    }
  }

  const shared = (facet, read, platform) => {
    const byId = new Map();
    for (const env of envs) {
      const c = m.cell(facet, env);
      for (const id of c ? read(c.value) : []) { if (!byId.has(id)) byId.set(id, []); if (!byId.get(id).includes(env)) byId.get(id).push(env); }
    }
    for (const [id, owners] of byId) {
      if (owners.length > 1) out.push(finding("ids.id-shared", owners[1], `${and(owners)} all resolve to ${id} on ${platform}`, owners.map((e) => m.cell(facet, e).at), { ref: platform === "Android" ? "gradle.flavors" : "pbxproj.set-settings" }));
    }
  };
  shared("androidId", (v) => (v && !unresolved(v) ? [v] : []), "Android");
  shared("iosId", (v) => [...new Set(Object.values(v.byConfig).filter((x) => x && !unresolved(x)))], "iOS");

  for (const env of envs) {
    const e = expected(spec, env);
    const a = m.cell("androidId", env);
    const i = m.cell("iosId", env);
    if (e.id && a && a.value && !unresolved(a.value) && a.value !== e.id) {
      out.push(finding("ids.id-differs", env, `${env}: Android applicationId is ${a.value}; ${says(spec, env, "id")} says ${e.id}`, [a.at], androidEdit(g, "gradle.flavors")));
    }
    const wantIos = e.iosId || e.id;
    if (wantIos && i) {
      const off = Object.entries(i.value.byConfig).filter(([, v]) => v && !unresolved(v) && v !== wantIos);
      const held = off.some(([c]) => heldOutside(facts, ((r.configs.find((x) => x.name === c) || {}).settings || {}).PRODUCT_BUNDLE_IDENTIFIER));
      if (off.length) out.push(finding("ids.id-differs", env, `${env}: ${off.map(([c, v]) => `${c} resolves to ${v}`).join(", ")}; ${says(spec, env, e.iosId ? "iosId" : "id")} says ${wantIos}`, [i.at], { ref: "pbxproj.set-settings", ...(held ? { blocked: "foreign" } : {}) }));
    }
    const iosOne = i && [...new Set(Object.values(i.value.byConfig).filter(Boolean))];
    if (spec.source === "draft" && a && a.value && iosOne && iosOne.length === 1 && iosOne[0] !== a.value && !unresolved(iosOne[0]) && !unresolved(a.value)) {
      out.push(finding("ids.cross-platform-mismatch", env, `${env}: Android ${a.value}, iOS ${iosOne[0]}`, [a.at, i.at]));
    }
  }

  const computed = [...g.flavors.filter((f) => f.computed).map((f) => `Android ${f.name}`),
    ...envs.flatMap((env) => { const i = m.cell("iosId", env); return i ? Object.entries(i.value.byConfig).filter(([, v]) => unresolved(v)).map(([c]) => `iOS ${c}`) : []; })];
  if (computed.length) out.push(finding("ids.id-computed", null, `the id is computed at build time for ${list(computed)}`, [g.computedId && g.computedId.at]));

  if (g.commentedDuplicate) out.push(finding("ids.android.commented-duplicate", null, `a commented-out productFlavors block sits at ${g.commentedDuplicate.at}`, [g.commentedDuplicate.at], { ref: "ids.remove-commented-duplicate" }));
  if (g.owner === "legacy") out.push(finding("ids.android.foreign-block", null, `the flavor block carries the earlier wizard's setup-flutter-envs marker (${g.legacyAt})`, [g.legacyAt], { ref: "ids.adopt-foreign-block" }));
  if (g.owner === "flavorizr") out.push(finding("ids.android.foreign-block", null, `flutter_flavorizr generates the flavors${g.appliedFrom ? ` (${g.appliedFrom})` : ""}; edit flavorizr.yaml, not the Gradle file`, [g.appliedFrom || g.flavorsAt], { ref: "ids.adopt-foreign-block" }));

  for (const env of envs.filter((e) => configsFor(facts, e).length)) {
    const s = m.cell("scheme", env);
    if (!s) { out.push(finding("ids.ios.scheme-missing", env, `${env} has iOS configurations but no shared scheme named ${env}`, [facts.pbxproj.file], { ref: "apple.schemes" })); continue; }
    if (!s.value.shared) out.push(finding("ids.ios.scheme-not-shared", env, `${s.value.file} is not under xcshareddata`, [s.value.file], { ref: "apple.schemes" }));
    const wrong = [["runs", s.value.launch], ["archives", s.value.archive]].filter(([, cfg]) => cfg && ((MODE.exec(cfg) || [])[2] || "").toLowerCase() !== env);
    if (wrong.length) out.push(finding("ids.ios.scheme-builds-other-flavor", env, `scheme ${env} ${wrong.map(([verb, cfg]) => `${verb} ${cfg}`).join(" and ")}`, [s.at], { ref: "apple.schemes" }));
    if (facts.pbxproj.swiftpm && !s.value.prepareAction) out.push(finding("ids.ios.scheme-prepare-action-missing", env, `scheme ${env} has no Run Prepare Flutter Framework Script pre-action`, [s.value.file], { ref: "apple.schemes" }));
  }

  const badNames = [...new Set([...m.sources.gradle, ...m.sources.ios, ...m.sources.schemes].filter((n) => !CONVENTIONS.envPattern.test(n) || CONVENTIONS.reservedEnvs.includes(n.toLowerCase())))];
  if (badNames.length) out.push(finding("ids.flavor-name", null, `environment names ${badNames.map((n) => `"${n}"`).join(", ")} must be lowercase letters and digits`, [g.flavorsAt, facts.pbxproj.file]));

  const pod = facts.apple.podfile;
  const flavoredConfigs = r ? r.configs.filter((c) => MODE.test(c.name || "")) : [];
  if (pod && flavoredConfigs.length) {
    const unmapped = flavoredConfigs.map((c) => c.name).filter((n) => !pod.map || !(n in pod.map));
    // A map that is neither the skill's block nor the template's three entries is the owner's.
    const ownersMap = !pod.managed && !!pod.map && Object.keys(pod.map).sort().join(",") !== "Debug,Profile,Release";
    if (unmapped.length) out.push(finding("ids.ios.podfile-map-missing", null, `the Podfile's project 'Runner' map lacks ${list(unmapped)}`, [pod.mapAt || pod.file], { ref: "apple.podfile-map", ...(ownersMap ? { blocked: "foreign" } : {}) }));
    // CocoaPods writes a Pods xcconfig for every Runner configuration and every key of the Podfile map.
    const names = new Set([...r.configs.map((c) => (c.name || "").toLowerCase()), ...Object.keys(pod.map || {}).map((k) => k.toLowerCase())]);
    const broken = flavoredConfigs.filter((c) => {
      if (/Pods-Runner\./.test(c.base || "")) return false;
      const included = podsIncludes(facts.apple.xcconfigs, c.base);
      return !included.includes(c.name.toLowerCase()) && !included.some((n) => names.has(n));
    }).map((c) => c.name);
    // apple.xcconfig-files writes <Mode>-<env>.xcconfig, so a configuration named another way keeps its own layer.
    const foreign = broken.some((n) => !/^(Debug|Profile|Release)-[a-z][a-z0-9]*$/.test(n));
    if (broken.length) out.push(finding("ids.ios.pods-xcconfig-missing", null, `${list(broken)} include no Pods xcconfig for a configuration that exists, so PODS_ROOT is unset`, [facts.pbxproj.file], { ref: "apple.xcconfig-files", ...(foreign ? { blocked: "foreign" } : {}) }));
  }
  return out;
}

// The Pods-Runner configuration names an xcconfig chain includes, lower-cased (Pods-Runner.debug-dev.xcconfig -> debug-dev).
function podsIncludes(xcconfigs, rel, seen = new Set()) {
  if (!rel || seen.has(rel) || !xcconfigs[rel]) return [];
  seen.add(rel);
  const out = [];
  for (const line of xcconfigs[rel].lines) {
    if (!line.include) continue;
    const pods = /Pods-Runner\.(.+)\.xcconfig$/.exec(line.raw);
    if (pods) out.push(pods[1].toLowerCase());
    else out.push(...podsIncludes(xcconfigs, line.include, seen));
  }
  return out;
}

function steps(ctx) {
  const { facts, matrix: m, spec } = ctx;
  if (!flavored(facts, m)) return [];
  const envs = Object.keys(spec.environments);
  const iosIds = envs.map((e) => expected(spec, e).iosId || expected(spec, e).id).filter(Boolean);
  const androidIds = envs.map((e) => expected(spec, e).id).filter(Boolean);
  const out = [];
  if (facts.pbxproj.file && iosIds.length) out.push({ id: "ids.apple-identifiers", where: "apple", title: "Register the bundle ids in Apple Developer, Identifiers", do: [`Register ${and(iosIds)}`], why: "Xcode signing needs each id before the first device build of that flavor", blocks: [], done: () => null });
  if (facts.gradle.file && androidIds.length) out.push({ id: "ids.play-apps", where: "play", title: "Create the Play Console apps that will be distributed", do: [`Create apps for ${and(androidIds)}`], why: "a release upload needs an app per application id", blocks: [], done: () => null });
  return out;
}

// The Gradle half of the ids, when the skill owns the flavors (none yet, or its own block): one flavor per
// environment with the spec's id, and the placeholder defaultConfig id replaced by production's. The template-id
// finding also names iOS ids, so the default-id edit claims it only when no iOS placeholder outlives this pass.
function androidPlan({ facts, spec }, iosTemplateLeft) {
  const g = facts.gradle;
  if (!g.file) return [];
  const out = [];
  const envs = Object.keys(spec.environments);
  const flavors = envs.map((name) => ({ name, id: spec.environments[name].id }));
  if ((g.owner === "none" || g.owner === "skill") && flavors.every((f) => f.id)) {
    out.push(edit("gradle.flavors", { flavors }, {
      summary: `one ${CONVENTIONS.dimension} flavor per environment: ${and(envs)}`,
      fixes: ["ids.no-flavors", "ids.env-missing", "ids.id-shared", "ids.id-differs"],
    }));
  }
  const prod = spec.production && expected(spec, spec.production);
  if (g.defaultId && isTemplate(g.defaultId.value) && prod && prod.id && !isTemplate(prod.id)) {
    out.push(edit("gradle.default-id", { id: prod.id }, { summary: `defaultConfig applicationId ${g.defaultId.value} becomes ${prod.id}`, fixes: iosTemplateLeft ? [] : ["ids.template-id"] }));
  }
  return out;
}

const MODES = CONVENTIONS.modes;
const POD_KIND = { Debug: "debug", Profile: "release", Release: "release" };
// A value an existing configuration takes from an xcconfig is the owner's convention, so apply leaves it.
const heldOutside = (facts, setting) => !!setting && !!setting.at && !setting.at.startsWith(facts.pbxproj.file);
const shown = (v) => (typeof v === "string" ? v.replace(/\$\$/g, "$") : v);

// The Runner configurations as they stand after this pass, one per mode and environment: the one that exists (the
// template's plain ones count as production's once renamed), or a clone of production's configuration of that mode.
// A clone needs production's under its exact <Mode>-<env> name and an environment whose own names are exact, because
// that is what pbxproj.clone-flavors copies from and skips.
function iosModel({ facts, spec }) {
  const r = runner(facts);
  const envs = Object.keys(spec.environments);
  const prod = spec.production;
  const rename = !r.configs.some((c) => MODE.test(c.name || "")) && r.configs.some((c) => MODES.includes(c.name));
  const own = (mode, env) => r.configs.find((c) => { const m = MODE.exec(c.name || ""); return m && m[1].toLowerCase() === mode.toLowerCase() && m[2].toLowerCase() === env; })
    || (rename && env === prod ? r.configs.find((c) => c.name === mode) : null) || null;
  const exact = (env) => MODES.every((mode) => { const c = own(mode, env); return !c || c.name === `${mode}-${env}` || (rename && c.name === mode); });
  const configs = [];
  for (const env of envs) {
    for (const mode of MODES) {
      const c = own(mode, env);
      const source = own(mode, prod);
      if (c) configs.push({ env, mode, name: c.name === mode ? `${mode}-${prod}` : c.name, cfg: c, from: c });
      else if (source && exact(env) && exact(prod)) configs.push({ env, mode, name: `${mode}-${env}`, cfg: null, from: source });
    }
  }
  return { r, envs, prod, rename, configs, cloned: [...new Set(configs.filter((c) => !c.cfg).map((c) => c.env))] };
}

// The iOS half of the ids and identity, while the Runner target exists and the spec names every environment's id:
// the plain configurations renamed to production's, a clone per missing configuration, every configuration's id,
// display name and icon set, RunnerTests' ids, the per-configuration Pods xcconfig layer and the Podfile map under
// CocoaPods, and one shared scheme per environment. Each edit is planned only where the end state differs.
function iosPlan(ctx) {
  const { facts, matrix: m, spec } = ctx;
  const r = runner(facts);
  const want = (env) => spec.environments[env].iosId || spec.environments[env].id;
  if (!r || facts.gradle.owner === "flavorizr" || !spec.production || Object.keys(spec.environments).some((e) => !want(e))) return { edits: [], templateLeft: !!r && r.configs.some((c) => isTemplate((c.settings.PRODUCT_BUNDLE_IDENTIFIER || {}).value)) };
  const model = iosModel(ctx);
  const { envs, prod, configs } = model;
  const out = [];
  const crashSafe = ["icons.ios", "apple.xcconfig-files"];

  const pod = facts.apple.podfile;
  const names = configs.map((c) => c.name);
  const ownMap = pod && (pod.managed || !pod.map || Object.keys(pod.map).sort().join(",") === "Debug,Profile,Release");
  const mapPlanned = !!pod && ownMap && names.some((n) => !pod.map || !(n in pod.map));
  if (pod) {
    // CocoaPods writes a Pods xcconfig for every Runner configuration and every key of the Podfile map, so a base
    // xcconfig chain works while it includes one of those.
    const known = new Set([...names, ...(mapPlanned ? [] : Object.keys(pod.map || {}))].map((n) => n.toLowerCase()));
    const broken = configs.filter((c) => c.name === `${c.mode}-${c.env}`).filter((c) => {
      if (/Pods-Runner\./.test(c.from.base || "")) return false;
      const included = podsIncludes(facts.apple.xcconfigs, c.from.base);
      return !included.includes(c.name.toLowerCase()) && !included.some((n) => known.has(n));
    });
    if (broken.length) {
      out.push(edit("apple.xcconfig-files", { configs: broken.map(({ mode, env }) => ({ mode, env })) }, { summary: `ios/Flutter/<Mode>-<env>.xcconfig for ${list(broken.map((c) => c.name))}`, fixes: ["ids.ios.pods-xcconfig-missing"] }));
    }
    if (mapPlanned) out.push(edit("apple.podfile-map", { configs: Object.fromEntries(names.map((n) => [n, POD_KIND[configs.find((c) => c.name === n).mode]])) }, { summary: `the Podfile's project 'Runner' map with ${names.length} configurations`, fixes: ["ids.ios.podfile-map-missing"] }));
    if (broken.length) out.push(edit("pbxproj.base-xcconfigs", { configs: broken.map((c) => c.name) }, { requires: ["pbxproj.clone-flavors", ...crashSafe], summary: `${list(broken.map((c) => c.name))} based on their own xcconfig` }));
  }

  if (model.rename) out.push(edit("pbxproj.rename-plain", { production: prod }, { requires: crashSafe, summary: `Debug, Profile and Release become <Mode>-${prod}` }));
  if (model.cloned.length) {
    out.push(edit("pbxproj.clone-flavors", { production: prod, envs: model.cloned }, { requires: ["pbxproj.rename-plain", ...crashSafe], summary: `<Mode>-${prod} cloned for ${and(model.cloned)}`, fixes: ["ids.env-missing"] }));
  }

  // Each configuration's id, display name and icon set, and RunnerTests' id, where they differ from the spec.
  const variable = m.iosNameVariable || CONVENTIONS.iosNameSetting;
  const prodCfg = configs.find((c) => c.env === prod && c.mode === "Release");
  const prodSet = (prodCfg && (prodCfg.from.settings.ASSETCATALOG_COMPILER_APPICON_NAME || {}).value) || CONVENTIONS.iosIconSet(prod, prod);
  // icons.ios badges AppIcon-<env> from AppIcon, so the convention's set names are only planned while that is production's.
  const canBadge = prodSet === CONVENTIONS.iosIconSet(prod, prod) && !!facts.icons.ios[prodSet];
  const kept = new Set([prodSet]);
  const iconSet = (env) => {
    if (env === prod) return prodSet;
    const c = configs.find((x) => x.env === env && x.mode === "Release");
    const current = c && c.cfg && (c.cfg.settings.ASSETCATALOG_COMPILER_APPICON_NAME || {}).value;
    if (current && facts.icons.ios[current] && !kept.has(current)) { kept.add(current); return current; }
    return canBadge ? CONVENTIONS.iosIconSet(env, prod) : current || prodSet;
  };
  const sets = Object.fromEntries(envs.map((env) => [env, iconSet(env)]));
  const byConfig = {};
  const held = { ids: false, names: false };
  for (const c of configs) {
    const desired = { PRODUCT_BUNDLE_IDENTIFIER: want(c.env), [variable]: spec.environments[c.env].name, ASSETCATALOG_COMPILER_APPICON_NAME: sets[c.env] };
    const set = {};
    for (const [key, value] of Object.entries(desired)) {
      const current = c.from.settings[key];
      if (current && shown(current.value) === value) continue;
      if (current && unresolved(current.value)) continue;
      if (c.cfg && heldOutside(facts, current)) { if (key === "PRODUCT_BUNDLE_IDENTIFIER") held.ids = true; if (key === variable) held.names = true; continue; }
      set[key] = value;
    }
    if (Object.keys(set).length) byConfig[c.name] = set;
  }
  const tests = facts.pbxproj.targets.find((t) => t.name === "RunnerTests");
  const testsIds = {};
  if (tests && Object.keys(byConfig).length) {
    const named = (name) => tests.configs.find((x) => x.name === name) || null;
    for (const c of configs) {
      const production = named(`${c.mode}-${prod}`) || (model.rename ? named(c.mode) : null);
      const t = c.cfg ? named(c.name) || (c.cfg.name === c.mode ? named(c.mode) : null) : production;
      const id = `${want(c.env)}.RunnerTests`;
      if (t && (t.settings.PRODUCT_BUNDLE_IDENTIFIER || {}).value !== id && !(t.name === c.name && heldOutside(facts, t.settings.PRODUCT_BUNDLE_IDENTIFIER))) testsIds[c.name] = id;
    }
  }
  if (Object.keys(byConfig).length) {
    out.push(edit("pbxproj.set-settings", { byConfig, ...(Object.keys(testsIds).length ? { testsIds } : {}) }, {
      requires: ["pbxproj.clone-flavors", ...crashSafe], summary: `id, ${variable} and icon set on ${Object.keys(byConfig).length} Runner configurations`,
      fixes: [...(held.ids ? [] : ["ids.id-shared", "ids.id-differs"]), ...(held.names ? [] : ["identity.name-same", "identity.name-differs"])],
    }));
  }

  // One shared scheme per environment, cloned from Runner.xcscheme or production's own.
  const base = facts.apple.schemes.some((s) => s.shared && (s.name === "Runner" || s.name === prod));
  const schemeOff = (env) => {
    const s = m.cell("scheme", env);
    if (!s || !s.value.shared) return true;
    const ofEnv = (cfg) => ((MODE.exec(cfg || "") || [])[2] || "").toLowerCase() === env;
    return !ofEnv(s.value.launch) || !ofEnv(s.value.archive) || (facts.pbxproj.swiftpm && !s.value.prepareAction);
  };
  if (base && envs.filter((env) => configs.some((c) => c.env === env)).some(schemeOff)) {
    out.push(edit("apple.schemes", { envs, production: prod }, {
      requires: ["pbxproj.clone-flavors", "pbxproj.set-settings", "pbxproj.base-xcconfigs"], summary: `a shared scheme per environment: ${and(envs)}`,
      fixes: ["ids.ios.scheme-missing", "ids.ios.scheme-builds-other-flavor", "ids.ios.scheme-not-shared", "ids.ios.scheme-prepare-action-missing"],
    }));
  }
  const templateLeft = configs.some((c) => isTemplate(((byConfig[c.name] || {}).PRODUCT_BUNDLE_IDENTIFIER) || (c.from.settings.PRODUCT_BUNDLE_IDENTIFIER || {}).value))
    || r.configs.some((c) => !MODE.test(c.name || "") && !(model.rename && MODES.includes(c.name)) && isTemplate((c.settings.PRODUCT_BUNDLE_IDENTIFIER || {}).value));
  return { edits: out, templateLeft };
}

function plan(ctx) {
  const ios = iosPlan(ctx);
  return [...androidPlan(ctx, ios.templateLeft), ...ios.edits];
}

// The recipes' snippets: the managed flavors block to adopt in place of a foreign one, and the suffix-style entries for
// the environments a Groovy suffix block lacks.
function snippets({ facts, spec }) {
  const g = facts.gradle;
  if (!g.file) return {};
  const envs = Object.keys(spec.environments);
  const flavors = envs.map((name) => ({ name, id: spec.environments[name].id || "" }));
  const missing = envs.filter((e) => !g.flavors.some((f) => f.name.toLowerCase() === e));
  return {
    "ids.adopt-foreign-block": { writer: "gradle", name: "flavors", args: { dialect: g.dialect, flavors } },
    "ids.extend-suffix-style": { writer: "gradle", name: "suffix", args: { envs: missing, dimension: (g.flavors.find((f) => f.dimension) || {}).dimension || CONVENTIONS.dimension } },
  };
}

function variant({ facts, matrix: m }) {
  const g = facts.gradle;
  const parts = [];
  if (g.flavors.length) parts.push(`A:${g.dialect}/${g.flavors.every((f) => f.id) ? "explicit" : "suffix"}/${g.owner}`);
  if (m.sources.ios.length) parts.push(`I:${facts.apple.podfile ? "pods" : "spm"}`);
  return parts.join(" ") || "-";
}

module.exports = { key: "ids", check, steps, plan, snippets, prove: () => [], empty: ({ facts, matrix }) => !flavored(facts, matrix), variant };
