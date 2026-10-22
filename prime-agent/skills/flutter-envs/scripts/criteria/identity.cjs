"use strict";
// Criterion 2, identity: each environment shows its own display name and launcher icon on both platforms, and the
// names match flutter_envs.json (or, with no file, each other). Rules are pure over the context.

const { CONVENTIONS, finding, edit } = require("../lib/vocab.cjs");
const { badgeOf } = require("../lib/spec.cjs");

const NAME_KEY = /^(app_?name|app_display_name|display_name|appName|app_label)$/i;
const NAME_SETTING = /^(DISPLAY_NAME|APP_DISPLAY_NAME|BUNDLE_DISPLAY_NAME|APP_NAME|FLAVOR_NAME|PRODUCT_DISPLAY_NAME)$/;
const MODE = /^(Debug|Release|Profile)[-_ ](.+)$/i;
const and = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const few = (items, n = 3) => (items.length > n ? `${items.slice(0, n).join(", ")} and ${items.length - n} more` : and(items));
const flavored = (facts, m) => facts.gradle.flavors.length > 0 || m.sources.ios.length > 0;
const unique = (byConfig) => [...new Set(Object.values(byConfig || {}).filter((v) => v !== null && v !== undefined))];
// A value an existing configuration takes from an xcconfig is the owner's convention, so apply leaves it.
const heldOutside = (facts, setting) => !!setting && !!setting.at && !setting.at.startsWith(facts.pbxproj.file);

// An iOS icon set against production's: the images its Contents.json names that are missing, and those that hold
// production's image of the same name byte for byte.
function iosGaps(facts, set, prodSet) {
  const s = facts.icons.ios[set];
  const prodFiles = (facts.icons.ios[prodSet] || { files: [] }).files;
  const names = (files) => [...new Set(files.map((f) => f.name))];
  if (!s) return { missing: [], copies: [] };
  return {
    missing: names(s.files.filter((f) => f.digest === null)),
    copies: set === prodSet ? [] : names(s.files.filter((f) => f.digest && prodFiles.some((p) => p.name === f.name && p.digest === f.digest))),
  };
}

// Why an environment's Android launcher set still shows production's icon, from its matrix cell.
function androidClaim(env, v) {
  if (!v.files) return `${env} has no launcher icon of its own, so it shows src/main's`;
  if (!v.missing.length && !v.vector.length && v.copies.length === v.badged) return `${env}'s launcher icons are byte-identical to src/main's`;
  const parts = [
    v.missing.length && `${env} lacks ${few(v.missing)}`,
    v.copies.length && `${env}'s ${few(v.copies)} ${v.copies.length > 1 ? "match" : "matches"} src/main's byte for byte`,
    v.vector.length && `${env} draws no foreground of its own for ${few(v.vector)}, a vector the badge cannot draw`,
  ].filter(Boolean);
  return `${parts.join(", and ")}, so production's icon shows there`;
}

function groups(envs, read) {
  const by = new Map();
  for (const env of envs) { const v = read(env); if (v === null || v === undefined) continue; if (!by.has(v)) by.set(v, []); by.get(v).push(env); }
  return [...by].filter(([, owners]) => owners.length > 1);
}

function check(ctx) {
  const { facts, matrix: m, spec } = ctx;
  if (!flavored(facts, m)) return [];
  const out = [];
  const listed = Object.keys(spec.environments);
  const envs = spec.source === "file" ? m.envs.filter((e) => listed.includes(e)) : m.envs;
  const prod = spec.production;
  const label = facts.android.manifest && facts.android.manifest.label;
  const decided = (env) => { const f = spec.fields[`environments.${env}.name`]; return !!f && (spec.source === "file" || f.source === "asked"); };

  const aCells = envs.filter((e) => m.cell("androidName", e));
  const same = { android: new Set(), ios: new Set() };
  if (label && label.literal !== null && aCells.length > 1) {
    aCells.forEach((e) => same.android.add(e));
    out.push(finding("identity.name-same", null, `android:label is the literal "${label.literal}", so every flavor shows it`, [label.at], { ref: "android.label" }));
  } else {
    for (const [value, owners] of groups(aCells, (e) => m.cell("androidName", e).value.value)) {
      owners.forEach((e) => same.android.add(e));
      const borrowed = owners.filter((e) => m.cell("androidName", e).value.from === "main" && e !== prod);
      out.push(finding("identity.name-same", owners[owners.length - 1], `${and(owners)} all show "${value}" on Android${borrowed.length ? ` (${and(borrowed)} set no ${label.key || "label"} of their own)` : ""}`,
        owners.map((e) => m.cell("androidName", e).at), { ref: "android.strings" }));
    }
  }

  const resValues = facts.gradle.flavors.flatMap((f) => f.resValues.map((r) => ({ ...r, flavor: f.name })));
  const deadNames = resValues.filter((r) => NAME_KEY.test(r.key) && !(label && label.key === r.key));
  if (deadNames.length) {
    out.push(finding("identity.android.resvalue-unread", null, `resValue ${[...new Set(deadNames.map((r) => r.key))].join(", ")} is set in ${and([...new Set(deadNames.map((r) => r.flavor))])}, but the manifest reads ${label ? label.raw : "no string"}`,
      deadNames.map((r) => r.at), { ref: "identity.remove-resvalue" }));
  }
  const agp = Number((facts.gradle.agp || "0").split(".")[0]);
  if (resValues.length && agp >= 9 && !facts.gradle.resValuesEnabled) {
    out.push(finding("identity.android.resvalue-agp9", null, `${resValues.length} resValue call(s) on AGP ${facts.gradle.agp} without buildFeatures { resValues = true }`, resValues.map((r) => r.at), { ref: "identity.remove-resvalue" }));
  }

  const iCells = envs.filter((e) => m.cell("iosName", e));
  if (iCells.length) {
    const variable = m.cell("iosName", iCells[0]).value.variable;
    const info = facts.apple.info;
    const runner = facts.pbxproj.targets.find((t) => t.name === "Runner");
    const set = (key) => iCells.map((e) => unique((runner ? runner.configs : []).filter((c) => (m.cell("iosName", e).value.byConfig[c.name] !== undefined)).map((c) => (c.settings[key] || {}).value)).join("|"));
    const unread = runner && [...new Set(runner.configs.flatMap((c) => Object.keys(c.settings)))].filter((k) => NAME_SETTING.test(k) && k !== variable && new Set(set(k)).size > 1);
    if (variable === null && iCells.length > 1) {
      iCells.forEach((e) => same.ios.add(e));
      out.push(finding("identity.name-same", null, `CFBundleDisplayName is the literal "${(info.displayName || info.bundleName).value}", so every flavor shows it`, [(info.displayName || info.bundleName).at], { ref: "apple.infoplist-name" }));
    } else if (variable && unread && unread.length && groups(iCells, (e) => unique(m.cell("iosName", e).value.byConfig).join("|")).length) {
      iCells.forEach((e) => same.ios.add(e));
      out.push(finding("identity.name-same", null, `Info.plist reads $(${variable}), but the configurations set ${unread.join(", ")} per environment`, [(info.displayName || info.bundleName).at], { ref: "apple.infoplist-name" }));
    } else {
      for (const [value, owners] of groups(iCells, (e) => { const u = unique(m.cell("iosName", e).value.byConfig); return u.length === 1 ? u[0] : null; })) {
        owners.forEach((e) => same.ios.add(e));
        out.push(finding("identity.name-same", owners[owners.length - 1], `${and(owners)} all show "${value}" on iOS`, owners.map((e) => m.cell("iosName", e).at), { ref: "pbxproj.set-settings" }));
      }
    }
  }

  for (const env of envs) {
    const want = (spec.environments[env] || {}).name;
    const a = m.cell("androidName", env);
    const i = m.cell("iosName", env);
    const iValues = i ? unique(i.value.byConfig) : [];
    if (want && decided(env)) {
      if (a && a.value.value !== null && !same.android.has(env) && a.value.value !== want) {
        out.push(finding("identity.name-differs", env, `${env} shows "${a.value.value}" on Android; ${spec.source === "file" ? "flutter_envs.json" : "--set"} says "${want}"`, [a.at], { ref: "android.strings" }));
      }
      const off = i && i.value.variable && !same.ios.has(env) ? Object.entries(i.value.byConfig).filter(([, v]) => v !== want) : [];
      const runnerTarget = facts.pbxproj.targets.find((t) => t.name === "Runner");
      const held = off.some(([c]) => heldOutside(facts, (((runnerTarget ? runnerTarget.configs : []).find((x) => x.name === c) || {}).settings || {})[i.value.variable]));
      if (off.length) out.push(finding("identity.name-differs", env, `${off.map(([c, v]) => `${c} shows "${v}"`).join(", ")} on iOS; ${spec.source === "file" ? "flutter_envs.json" : "--set"} says "${want}"`, [i.at], { ref: "pbxproj.set-settings", ...(held ? { blocked: "foreign" } : {}) }));
    } else if (spec.source === "draft") {
      // The draft records one name per environment with its basis, and apply writes that name to both platforms.
      const androidOwn = a && (a.value.from === "flavor" || a.value.from === "resValue" || (a.value.from === "main" && env === prod)) ? a.value.value : null;
      const drift = [...new Set([androidOwn, ...(i && i.value.variable ? iValues : [])].filter(Boolean))];
      if (drift.length > 1) out.push(finding("identity.names-drift", env, `${env} shows ${drift.map((v) => `"${v}"`).join(" and ")} across Android and its iOS configurations`, [a && a.at, i && i.at], { ref: "android.strings" }));
    }
  }

  // Production is compared first, so a set it shares is named as production's.
  const sharing = (env, ii) => [prod, ...envs].filter((o) => o && o !== env).map((o) => [o, m.cell("iosIcon", o)])
    .find(([, c]) => c && c.value.exists && (c.value.set === ii.value.set || (!!ii.value.digest && c.value.digest === ii.value.digest)));
  const prodIcon = prod && m.cell("iosIcon", prod);
  const prodSet = prodIcon && prodIcon.value.exists ? prodIcon.value.set : null;
  for (const env of envs) {
    const ai = m.cell("androidIcon", env);
    if (env !== prod && ai && ai.value.sameAsMain) {
      out.push(finding("identity.icon-same", env, androidClaim(env, ai.value), [ai.at || facts.android.manifest && facts.android.manifest.icon && facts.android.manifest.icon.at], { ref: "icons.android" }));
    }
    const ii = m.cell("iosIcon", env);
    const gaps = ii && ii.value.exists ? iosGaps(facts, ii.value.set, prodSet) : null;
    if (ii && !ii.value.exists) out.push(finding("identity.ios.icon-set-missing", env, `${env}'s configurations name ${ii.value.set}, which Assets.xcassets does not contain`, [ii.at], { ref: "icons.ios" }));
    else if (gaps && gaps.missing.length) out.push(finding("identity.ios.icon-set-missing", env, `${ii.value.set} lacks ${few(gaps.missing)}, which its Contents.json names`, [ii.at], { ref: "icons.ios" }));
    else if (ii && env !== prod) {
      const shared = sharing(env, ii);
      if (shared) {
        const [other, c] = shared;
        const whose = other === prod ? "production's" : `${other}'s`;
        out.push(finding("identity.icon-same", env, c.value.set === ii.value.set ? `${env} uses ${ii.value.set}, ${whose} icon set` : `${env}'s icon set ${ii.value.set} holds the same images as ${whose} ${c.value.set}`, [ii.at], { ref: "icons.ios" }));
      } else if (gaps.copies.length) {
        out.push(finding("identity.icon-same", env, `${ii.value.set}'s ${few(gaps.copies)} ${gaps.copies.length > 1 ? "match" : "matches"} production's byte for byte`, [ii.at], { ref: "icons.ios" }));
      }
    }
  }
  const alpha = [...new Set(envs.map((e) => m.cell("iosIcon", e)).filter((c) => c && c.value.exists).map((c) => c.value.set))]
    .filter((set) => { const s = facts.icons.ios[set]; return s && s.marketing && s.marketing.png && s.marketing.png.alpha; });
  if (alpha.length) out.push(finding("identity.ios.icon-alpha-marketing", null, `the 1024 px icon of ${and(alpha)} has an alpha channel`, alpha.map((s) => facts.icons.ios[s].marketing.rel)));
  return out;
}

function steps({ facts, matrix: m, spec }) {
  if (!flavored(facts, m)) return [];
  const main = facts.icons.android.main;
  const needs = Object.keys(spec.environments).filter((e) => e !== spec.production && m.cell("androidIcon", e) && m.cell("androidIcon", e).value.sameAsMain);
  if (!main || !main.files.some((f) => f.webp) || !needs.length) return [];
  return [{ id: "identity.webp-icons", where: "terminal", title: "Convert production's webp launcher icons to PNG", do: main.files.filter((f) => f.webp).map((f) => `sips -s format png ${f.rel} --out ${f.rel.replace(/\.webp$/, ".png")}`), why: `the badge writer reads PNG, and ${and(needs)} need badged icons`, blocks: ["identity.icon-same"], done: () => !main.files.some((f) => f.webp) }];
}

// The Android display names: each flavor's own strings.xml, production's name where production reads it (its own
// source set, else src/main's managed block), and android:label pointed at the key. A flavorizr project or a
// manifestPlaceholders label is the project's own convention, so nothing is planned there.
function namesPlan({ facts, spec }, planned) {
  const label = facts.android.manifest && facts.android.manifest.label;
  const g = facts.gradle;
  const coming = planned.some((e) => e.id === "gradle.flavors");
  if (!label || label.placeholder || g.owner === "flavorizr" || (!g.flavors.length && !coming)) return [];
  const key = label.key || CONVENTIONS.androidNameKey;
  const sets = new Map(g.flavors.map((f) => [f.name.toLowerCase(), f.name]));
  const files = [];
  for (const env of Object.keys(spec.environments)) {
    const name = spec.environments[env].name;
    const set = coming ? env : sets.get(env);
    if (!set || !name) continue;
    const own = facts.android.strings[set] && facts.android.strings[set][key];
    files.push(env === spec.production && !own ? { set: "main", name, block: true } : { set, name, block: false });
  }
  if (!files.length) return [];
  const out = [edit("android.strings", { key, files }, { summary: `${key} per source set: ${files.map((f) => `${f.set} "${f.name}"`).join(", ")}`, fixes: ["identity.name-same", "identity.name-differs", "identity.names-drift"] })];
  const literal = label.literal !== null && label.literal !== undefined;
  out.push(edit("android.label", { key }, { requires: ["android.strings"], summary: literal ? `android:label "${label.literal}" becomes @string/${key}` : `android:label reads @string/${key}`, fixes: ["identity.name-same"] }));
  return out;
}

// The launcher icons of each non-production environment, badged from production's: on Android while its flavor
// exists or is planned and some badged layer still shows production's icon, on iOS while its configurations name (or
// are about to name) AppIcon-<env> and that set is missing, incomplete or holds production's images. With
// --set icons=regen every environment is rebadged, over what is there. Copies stay the owner's otherwise.
function iconPlan({ facts, matrix: m, spec }, planned) {
  const prod = spec.production;
  if (!prod || facts.gradle.owner === "flavorizr") return [];
  const regen = spec.settings.icons === "regen";
  const coming = planned.some((e) => e.id === "gradle.flavors");
  const settings = planned.find((e) => e.id === "pbxproj.set-settings");
  const source = CONVENTIONS.iosIconSet(prod, prod);
  const release = (env) => (settings ? Object.entries(settings.args.byConfig).find(([n]) => { const x = MODE.exec(n); return x && x[1].toLowerCase() === "release" && x[2].toLowerCase() === env; }) : null);
  const projected = (env) => { const r = release(env); const c = m.cell("iosIcon", env); return (r && r[1].ASSETCATALOG_COMPILER_APPICON_NAME) || (c && c.value.set) || null; };
  // icons.ios badges from AppIcon, which must be production's own set (its Release configuration, plain or renamed).
  const runner = facts.pbxproj.targets.find((t) => t.name === "Runner");
  const prodRelease = runner && runner.configs.find((c) => { const x = MODE.exec(c.name || ""); return (x && x[1].toLowerCase() === "release" && x[2].toLowerCase() === prod) || c.name === "Release"; });
  const prodBadges = (projected(prod) || (prodRelease && (prodRelease.settings.ASSETCATALOG_COMPILER_APPICON_NAME || {}).value)) === source && !!facts.icons.ios[source];
  const out = [];
  for (const env of Object.keys(spec.environments).filter((e) => e !== prod)) {
    const args = { env, ...badgeOf(spec, env), ...(regen ? { regen: true } : {}) };
    const flavor = coming || facts.gradle.flavors.some((f) => f.name.toLowerCase() === env);
    if (facts.icons.android.main && flavor && (regen || m.androidIcon(env).sameAsMain)) {
      out.push(edit(`icons.android:${env}`, args, { summary: `${env}'s launcher icons badged ${args.label} from src/main's`, fixes: ["identity.icon-same"] }));
    }
    const set = projected(env);
    const gaps = iosGaps(facts, set, source);
    if (prodBadges && set === CONVENTIONS.iosIconSet(env, prod) && (regen || !facts.icons.ios[set] || gaps.missing.length || gaps.copies.length)) {
      out.push(edit(`icons.ios:${env}`, args, { summary: `${set} badged ${args.label} from ${source}`, fixes: ["identity.icon-same", "identity.ios.icon-set-missing"] }));
    }
  }
  return out;
}

// CFBundleDisplayName reads the per-configuration display name, $(DISPLAY_NAME) unless it already reads a variable,
// once the Runner target has (or is about to have) flavored configurations.
function infoPlan({ facts, matrix: m }, planned) {
  const iosFlavored = m.sources.ios.length > 0 || planned.some((e) => e.id === "pbxproj.clone-flavors");
  if (!facts.apple.info || !iosFlavored || m.iosNameVariable || facts.gradle.owner === "flavorizr") return [];
  return [edit("apple.infoplist-name", { variable: CONVENTIONS.iosNameSetting }, { summary: `Info.plist's CFBundleDisplayName reads $(${CONVENTIONS.iosNameSetting})`, fixes: ["identity.name-same"] })];
}

const plan = (ctx, { planned }) => {
  const names = namesPlan(ctx, planned);
  const icons = iconPlan(ctx, planned);
  return [...names, ...icons, ...infoPlan(ctx, planned)];
};

function variant({ facts, matrix: m }) {
  const label = facts.android.manifest && facts.android.manifest.label;
  const ios = m.envs.map((e) => m.cell("iosName", e)).find(Boolean);
  return [`A name:${label ? label.key || (label.placeholder ? `\${${label.placeholder}}` : "literal") : "-"}`, `I name:${ios ? (ios.value.variable ? `$(${ios.value.variable})` : "literal") : "-"}`].join(" ");
}

// One environment has nothing to tell apart, so identity is absent until a second one exists.
const empty = ({ facts, matrix }) => !flavored(facts, matrix) || matrix.envs.length < 2;

module.exports = { key: "identity", check, steps, plan, prove: () => [], empty, variant };
