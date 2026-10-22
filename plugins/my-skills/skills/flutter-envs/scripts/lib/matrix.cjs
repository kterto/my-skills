"use strict";
// Facts to the environment matrix. `readFacts` calls each writer's read half once; `buildMatrix` unions the environment
// names every source knows, asks git once for the per-environment ignore state, and builds one cell per facet and
// environment. Criteria read columns, rows and pairs from it and never touch a file.

const { CONVENTIONS } = require("./vocab.cjs");
const gradle = require("../writers/gradle.cjs");
const android = require("../writers/android.cjs");
const pbxproj = require("../writers/pbxproj.cjs");
const apple = require("../writers/apple.cjs");
const icons = require("../writers/icons.cjs");
const envfiles = require("../writers/envfiles.cjs");
const dart = require("../writers/dart.cjs");

const MODE = /^(Debug|Release|Profile)[-_ ](.+)$/i;
const BUILD_SETS = new Set(["main", "debug", "profile", "release", "test", "androidtest"]);
// Settings that name the build product, which a display name must never take over.
const BUILD_NAMES = new Set(["PRODUCT_NAME", "TARGET_NAME", "EXECUTABLE_NAME"]);
const RTL = "ar|fa|he|ur|ps|sd|ug|yi|dv";

// The right-to-left languages the app declares: an ARB file for one (app_ar.arb, intl_he.arb, under lib/ or l10n.yaml's
// arb-dir), or a supportedLocales list naming one in lib/.
function rtlLocales(io) {
  const found = new Set();
  const l10n = io.read("l10n.yaml");
  const named = l10n && ((/^arb-dir:\s*["']?([^"'\s#]+)/m.exec(l10n) || [])[1] || "").replace(/\/+$/, "");
  const arbDir = named && !/(^\/|(^|\/)\.\.(\/|$))/.test(named) ? named : null;
  const arbName = new RegExp(`(?:^|[_-])(${RTL})(?:[_-][A-Za-z0-9]+)*\\.arb$`);
  for (const dir of [...new Set(["lib", arbDir].filter(Boolean))]) {
    for (const rel of io.walk(dir, { test: (p) => p.endsWith(".arb") })) { const m = arbName.exec(rel.split("/").pop()); if (m) found.add(m[1]); }
  }
  const locale = new RegExp(`Locale(?:\\.fromSubtags)?\\(\\s*(?:languageCode:\\s*)?['"](${RTL})['"]`, "g");
  for (const rel of io.walk("lib", { test: (p) => p.endsWith(".dart") })) {
    for (const list of (io.read(rel) || "").matchAll(/supportedLocales\s*[:=]\s*(?:const\s*)?(\[[^\]]*\]|[^,;)]*)/g)) {
      for (const m of list[1].matchAll(locale)) found.add(m[1]);
    }
  }
  return [...found].sort();
}

function readFacts(io) {
  const a = android.read(io);
  const ap = apple.read(io);
  const pbx = pbxproj.read(io, { xcconfigs: ap.xcconfigs });
  const writes = [...new Set(pbx.targets.flatMap((t) => t.phases.flatMap((p) => p.copies.map((c) => c.to).filter(Boolean))))];
  return {
    gradle: gradle.read(io),
    android: a,
    apple: ap,
    pbxproj: pbx,
    icons: icons.read(io, { androidIcon: (a.manifest && a.manifest.icon && a.manifest.icon.name) || "ic_launcher" }),
    envfiles: envfiles.read(io),
    dart: dart.read(io),
    l10n: { rtl: rtlLocales(io) },
    git: { repo: io.git.repo, head: io.git.head, branch: io.git.branch, clean: io.git.clean },
    // The probe is a path no env file uses, so its ignore state says whether any rule covers env/*.json.
    ignored: Object.fromEntries(io.git.ignored([CONVENTIONS.envProbe, CONVENTIONS.sampleFile, ...writes])),
  };
}

const runnerOf = (facts) => facts.pbxproj.targets.find((t) => t.name === "Runner") || null;

// Every environment name each source spells, raw, in source order.
function sources(facts) {
  const runner = runnerOf(facts);
  const iosNames = [];
  for (const c of runner ? runner.configs : []) { const m = MODE.exec(c.name || ""); if (m && !iosNames.includes(m[2])) iosNames.push(m[2]); }
  const fbAndroid = facts.android.firebase.filter((f) => f.set && !BUILD_SETS.has(f.set.toLowerCase())).map((f) => f.set);
  const fbIos = facts.apple.firebase.map((f) => (/^ios\/(?:config|Runner)\/([^/]+)\//.exec(f.file) || [])[1]).filter(Boolean);
  return {
    gradle: facts.gradle.flavors.map((f) => f.name),
    ios: iosNames,
    envFiles: facts.envfiles.files.map((f) => f.file.replace(/^env\//, "").replace(/\.json$/, "")),
    firebase: [...new Set([...fbAndroid, ...fbIos])],
    schemes: facts.apple.schemes.map((s) => s.name).filter((n) => n.toLowerCase() !== "runner" && iosNames.some((i) => i.toLowerCase() === n.toLowerCase())),
  };
}

const lower = (s) => s.toLowerCase();

function buildMatrix(facts, io, spec) {
  const src = sources(facts);
  const order = [];
  const add = (name) => { const k = lower(name); if (!order.includes(k)) order.push(k); };
  if (spec) Object.keys(spec.environments).forEach(add);
  for (const list of [src.gradle, src.ios, src.envFiles, src.firebase, src.schemes]) list.forEach(add);
  const named = order.filter((e) => CONVENTIONS.productionNames.includes(e));
  const production = spec ? spec.production : named.length === 1 ? named[0] : null;
  const envs = production && order.includes(production) ? [...order.filter((e) => e !== production), production] : order;

  const runner = runnerOf(facts);
  const firebaseInUse = !!(facts.envfiles.pubspec && facts.envfiles.pubspec.deps.includes("firebase_core")) || facts.android.firebase.length > 0 || facts.apple.firebase.length > 0;
  const own = (env) => ({ android: CONVENTIONS.fbAndroidFile(env), ios: CONVENTIONS.fbIosFile(env), env: `env/${env}.json` });
  const ignored = io.git.ignored(envs.flatMap((e) => Object.values(own(e))));

  const cells = new Map();
  const put = (facet, env, value, at) => { if (!cells.has(facet)) cells.set(facet, new Map()); cells.get(facet).set(env, { value, at: at || null }); };
  const appIcon = (cfg) => (cfg && cfg.settings.ASSETCATALOG_COMPILER_APPICON_NAME) || null;
  const label = facts.android.manifest && facts.android.manifest.label;
  const plistName = facts.apple.info && (facts.apple.info.displayName || facts.apple.info.bundleName);
  const plistVar = plistName && /^\$[({]([A-Za-z_][\w]*)[)}]$/.exec(plistName.value.trim());
  // Xcode reads $$ in a build setting as a literal $, which is how a display name keeps one.
  const shown = (v) => (typeof v === "string" ? v.replace(/\$\$/g, "$") : v);
  const displayVar = facts.apple.info && facts.apple.info.displayName && /^\$[({]([A-Za-z_][\w]*)[)}]$/.exec(String(facts.apple.info.displayName.value).trim());
  const iosNameVariable = displayVar && !BUILD_NAMES.has(displayVar[1]) ? displayVar[1] : null;
  // An environment's Android launcher set against main's. Gradle merges resources one by one, so each icon layer of
  // main's that the set lacks, or holds byte for byte, is production's icon at that density: the legacy and round icons
  // always, and main's adaptive foreground while the set has no adaptive icon of its own; with one, the foreground its
  // own XML names, which comes from main when the set lacks it. A foreground that no PNG or webp draws (a vector) is a
  // layer the set lacks too, unless the set draws a file of that name or an adaptive icon of its own names another.
  const androidIcon = (env) => {
    const ownSet = Object.keys(facts.icons.android).find((s) => lower(s) === env);
    const mine = ownSet ? facts.icons.android[ownSet] : null;
    const main = facts.icons.android.main;
    const own = (name) => (mine ? mine.files.find((f) => icons.resourceOf(f.name) === icons.resourceOf(name)) : null);
    const layer = icons.launcherLayer(main);
    const ownForegrounds = new Set(((mine && mine.adaptive) || []).map((a) => a.foreground).filter(Boolean));
    const shown = main ? main.files.filter((f) => {
      const role = layer(f.name);
      if (role === "full") return true;
      if (role !== "safe") return false;
      return !ownForegrounds.size || ownForegrounds.has(icons.baseOf(f.name));
    }) : [];
    const missing = shown.filter((f) => !own(f.name)).map((f) => f.name);
    const copies = shown.filter((f) => own(f.name) && own(f.name).digest === f.digest).map((f) => f.name);
    const vector = main ? icons.undrawnForegrounds(main).filter((fg) => (!ownForegrounds.size || ownForegrounds.has(fg)) && !(mine && mine.files.some((f) => icons.baseOf(f.name) === fg))) : [];
    return { files: mine ? mine.files.length : 0, sameAsMain: !mine || missing.length + copies.length + vector.length > 0, badged: shown.length, missing, copies, vector, set: ownSet || "main", webp: !!(main && main.files.some((f) => f.webp)) };
  };

  for (const env of envs) {
    const flavor = facts.gradle.flavors.find((f) => lower(f.name) === env);
    if (flavor) put("androidId", env, flavor.computed ? null : flavor.effectiveId, flavor.idAt || flavor.at);

    const configs = runner ? runner.configs.filter((c) => { const m = MODE.exec(c.name || ""); return m && lower(m[2]) === env; }) : [];
    if (configs.length) {
      const byConfig = Object.fromEntries(configs.map((c) => [c.name, (c.settings.PRODUCT_BUNDLE_IDENTIFIER || {}).value || null]));
      put("iosId", env, { byConfig }, ((configs[0].settings.PRODUCT_BUNDLE_IDENTIFIER) || {}).at || configs[0].at);
      if (plistName) {
        const names = Object.fromEntries(configs.map((c) => [c.name, plistVar ? (shown((c.settings[plistVar[1]] || {}).value) || null) : plistName.value]));
        const where = plistVar ? (Object.values(configs.map((c) => c.settings[plistVar[1]]).filter(Boolean))[0] || {}).at : plistName.at;
        put("iosName", env, { variable: plistVar ? plistVar[1] : null, byConfig: names }, where || plistName.at);
      }
      const release = configs.find((c) => /^Release/i.test(c.name)) || configs[0];
      const set = appIcon(release);
      if (set) {
        const found = facts.icons.ios[set.value];
        put("iosIcon", env, { set: set.value, exists: !!found, digest: found ? found.digest : null }, set.at);
      }
    }

    if (flavor && label) {
      const sets = facts.android.sourceSets.filter((s) => lower(s) === env);
      let value = null;
      let from = "main";
      let where = label.at;
      if (label.literal !== null && label.literal !== undefined) { value = label.literal; from = "literal"; }
      else if (label.key) {
        const ownString = sets.map((s) => (facts.android.strings[s] || {})[label.key]).find(Boolean);
        const resValue = flavor.resValues.find((r) => r.key === label.key);
        const main = (facts.android.strings.main || {})[label.key];
        if (ownString) { value = ownString.value; from = "flavor"; where = ownString.at; }
        else if (resValue) { value = resValue.value; from = "resValue"; where = resValue.at; }
        else if (main) { value = main.value; from = "main"; where = main.at; }
      } else if (label.placeholder) {
        value = flavor.placeholders[label.placeholder] || null;
        from = value ? "placeholder" : "main";
      }
      put("androidName", env, { key: label.key || label.placeholder || null, value, from }, where);
    }

    if (flavor) {
      const icon = androidIcon(env);
      put("androidIcon", env, icon, icon.files ? facts.icons.android[icon.set].files[0].rel : null);
    }

    const scheme = facts.apple.schemes.filter((s) => lower(s.name) === env).sort((a, b) => Number(b.shared) - Number(a.shared))[0];
    if (scheme) {
      put("scheme", env, {
        launch: scheme.actions.LaunchAction ? scheme.actions.LaunchAction.config : null,
        archive: scheme.actions.ArchiveAction ? scheme.actions.ArchiveAction.config : null,
        shared: scheme.shared, prepareAction: scheme.prepareAction, testables: scheme.testables, file: scheme.file,
      }, (scheme.actions.LaunchAction || {}).at || scheme.file);
    }

    if (firebaseInUse) {
      const paths = own(env);
      const fileFor = facts.android.firebase.find((f) => f.set && lower(f.set) === env);
      const root = facts.android.firebase.find((f) => f.set === null);
      const ci = !!ignored.get(paths.android);
      const pkg = flavor && flavor.effectiveId;
      if (fileFor) put("fbAndroid", env, native(fileFor, { ciProvided: ci, fallback: false, file: fileFor.file, packageName: pkg }), fileFor.file);
      else if (ci) put("fbAndroid", env, native(null, { ciProvided: true, fallback: false, file: paths.android }), paths.android);
      else if (flavor && root) put("fbAndroid", env, native(root, { ciProvided: false, fallback: true, file: root.file, packageName: pkg }), root.file);
      const plist = facts.apple.firebase.find((f) => new RegExp(`^ios/(config|Runner)/${env}/`, "i").test(f.file));
      if (plist || ignored.get(paths.ios)) {
        put("fbIos", env, nativeIos(plist, { ciProvided: !!ignored.get(paths.ios), file: plist ? plist.file : paths.ios }), plist ? plist.file : paths.ios);
      }
    }

    const file = facts.envfiles.files.find((f) => lower(f.file) === `env/${env}.json`);
    if (file) {
      const fb = file.keys.filter((k) => /^FIREBASE_|^OAUTH_GOOGLE_SERVER_CLIENT_ID$/.test(k));
      if (firebaseInUse && (fb.length || file.project)) {
        put("fbEnv", env, { projectId: file.project ? file.project.value : null, keys: fb, digests: Object.fromEntries(fb.filter((k) => file.digests[k]).map((k) => [k, file.digests[k]])) }, file.project ? file.at[file.project.key] : file.file);
      }
      put("envFile", env, {
        file: file.file, keys: file.keys, name: file.label ? file.label.value : null, labelKey: file.label ? file.label.key : null,
        empty: file.empty, nested: file.nested, error: file.error,
        tracked: io.git.repo ? io.git.tracked(file.file) : null, ignored: io.git.repo ? !!ignored.get(file.file) : null,
      }, file.file);
    }
  }

  return {
    envs, production, firebaseInUse, iosNameVariable, androidIcon, sources: { ...src, first: (facts.gradle.flavorsAt || (runner && runner.configs[0] && runner.configs[0].at)) || null },
    cell: (facet, env) => (cells.get(facet) && cells.get(facet).get(env)) || null,
    column: (facet) => envs.map((e) => [e, (cells.get(facet) && cells.get(facet).get(e)) || null]),
    row: (env) => Object.fromEntries([...cells].filter(([, m]) => m.has(env)).map(([f, m]) => [f, m.get(env)])),
    toJSON: () => ({ envs, production, cells: Object.fromEntries([...cells].map(([f, m]) => [f, Object.fromEntries(m)])) }),
  };
}

// A google-services.json as seen by one environment: its project, its packages, and the env-key digests it implies.
function native(gs, { ciProvided, fallback, file, packageName }) {
  if (!gs) return { present: false, ciProvided, fallback: false, file, projectId: null, appId: null, ids: [], derived: {}, type1Count: null };
  const keys = CONVENTIONS.firebaseKeys.android;
  const client = gs.clients.find((c) => c.packageName === packageName) || null;
  const pick = (field) => gs.digests[field] || (client && client.digests[field]) || null;
  const derived = Object.fromEntries(Object.entries(keys).map(([k, field]) => [k, pick(field)]).filter(([, v]) => v));
  return {
    present: true, ciProvided, fallback, file, projectId: gs.projectId, appId: client ? client.digests.mobilesdk_app_id || null : null,
    ids: gs.clients.map((c) => c.packageName).filter(Boolean), derived, type1Count: client ? client.type1Count : null,
  };
}

function nativeIos(plist, { ciProvided, file }) {
  if (!plist) return { present: false, ciProvided, fallback: false, file, projectId: null, appId: null, ids: [], derived: {} };
  const derived = Object.fromEntries(Object.entries(CONVENTIONS.firebaseKeys.ios).map(([k, field]) => [k, plist.digests[field] || null]).filter(([, v]) => v));
  return {
    present: true, ciProvided, fallback: false, file, projectId: plist.projectId, appId: plist.digests.GOOGLE_APP_ID || null,
    ids: plist.bundleId ? [plist.bundleId] : [], derived, exactName: plist.exactName,
  };
}

module.exports = { readFacts, buildMatrix, sources, runnerOf, MODE };
