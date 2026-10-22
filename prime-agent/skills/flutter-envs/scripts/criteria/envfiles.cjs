"use strict";
// Criterion 5, env files: every environment's variables live in env/<env>.json, kept out of git, described by a tracked
// sample with empty values, and passed by Make with --flavor and --dart-define-from-file. Rules are pure over the
// context and see key names and digests only.

const { CONVENTIONS, finding, edit } = require("../lib/vocab.cjs");
const { render } = require("../lib/templates.cjs");

const and = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const few = (items, n = 4) => (items.length > n ? `${items.slice(0, n).join(", ")} and ${items.length - n} more` : and(items));
const RESERVED = /^FLUTTER_(APP_FLAVOR|VERSION|CHANNEL|GIT_URL|FRAMEWORK_REVISION|ENGINE_REVISION|DART_VERSION|ENABLED_FEATURE_FLAGS)/;
const LABELS = ["NAME", "ENV", "ENVIRONMENT", "FLAVOR", "APP_ENV", "name", "env", "environment"];
const RUNS = /\bflutter\s+(run|build\s+(apk|appbundle|ipa|ios)|install)\b/;

const flavored = (facts, m) => facts.gradle.flavors.length > 0 || m.sources.ios.length > 0;
const wiredTargets = (mk) => (mk ? mk.targets.filter((t) => t.recipe.some((l) => /--dart-define-from-file/.test(l)) && t.recipe.concat(t.prereqs).some((l) => /\$\(env\)|\$</.test(l))) : []);
const nameKey = (facts) => LABELS.find((k) => facts.dart.fromEnvironment[k]) || "NAME";
const ID_FINDINGS = ["ids.no-flavors", "ids.env-missing", "ids.id-shared", "ids.id-differs", "ids.template-id"];

function check(ctx) {
  const { facts, matrix: m, spec } = ctx;
  const e = facts.envfiles;
  const mk = e.makefile;
  const out = [];
  const wired = wiredTargets(mk);
  const any = e.envDir || e.files.length || e.sample;
  if (!any && !wired.length) {
    out.push(finding("envfiles.none", null, "the project has no env/ folder and no target passes --dart-define-from-file", [], { ref: "envfiles.sample" }));
    return out.concat(makeRules(ctx));
  }
  const dartKeys = facts.dart.fromEnvironment;
  const required = Object.values(dartKeys).filter((k) => !k.hasDefault).map((k) => k.key);
  const label = nameKey(facts);

  const escaped = m.envs.map((env) => m.cell("envFile", env)).filter((c) => c && c.value.ignored === false && !c.value.tracked).map((c) => c.value.file);
  const noRule = e.envDir && facts.git.repo && facts.ignored[CONVENTIONS.envProbe] === false;
  if (escaped.length || noRule) out.push(finding("envfiles.not-ignored", null, escaped.length ? `${and(escaped)} ${escaped.length > 1 ? "are" : "is"} not ignored by git` : "no ignore rule covers env/*.json", escaped, { ref: "envfiles.env-gitignore" }));
  if (e.envGitignore && e.envGitignore.includes("*") && !e.envGitignore.includes("!.gitignore") && facts.git.repo && !e.envGitignoreTracked) {
    out.push(finding("envfiles.gitignore-self-ignored", null, "env/.gitignore ignores everything, itself included, so a fresh clone has no env rule", ["env/.gitignore"], { ref: "envfiles.env-gitignore" }));
  }
  const tracked = m.envs.map((env) => m.cell("envFile", env)).filter((c) => c && c.value.tracked).map((c) => c.value.file);
  if (tracked.length) out.push(finding("envfiles.tracked-real-file", null, `${and(tracked)} ${tracked.length > 1 ? "are" : "is"} tracked in git`, tracked));

  const s = e.sample;
  // An untracked sample git can commit is the owner's pending commit (apply never commits); an ignored one never ships.
  const unshippable = s && s.tracked === false && facts.ignored[CONVENTIONS.sampleFile] === true;
  if (!s || unshippable) out.push(finding("envfiles.sample-missing", null, s ? `${s.file} is ignored by git, so a clone never gets it` : "no env/sample.json lists the keys", s ? [s.file] : [], { ref: "envfiles.sample" }));
  if (s && !s.error) {
    const wanted = new Set([...e.files.flatMap((f) => f.keys), ...Object.keys(dartKeys)]);
    const lacking = [...wanted].filter((k) => !s.keys.includes(k)).sort();
    if (lacking.length) out.push(finding("envfiles.sample-drift", null, `${s.file} lacks ${few(lacking)}`, [s.file], { ref: "envfiles.sample" }));
    const held = s.keys.filter((k) => s.digests[k] && (k === label || e.files.some((f) => f.digests[k] === s.digests[k])));
    if (held.length) out.push(finding("envfiles.sample-holds-env-values", null, `${s.file} holds values for ${few(held)}`, held.map((k) => s.at[k]), { ref: "envfiles.sample" }));
  }

  if (Object.keys(dartKeys).length) {
    const unread = [...new Set(e.files.flatMap((f) => f.keys))].filter((k) => !dartKeys[k] && !RESERVED.test(k)).sort();
    if (unread.length) out.push(finding("envfiles.key-unread", null, `no Dart code reads ${few(unread)}`, [], { ref: "envfiles.remove-unread-keys" }));
  }
  for (const env of m.envs) {
    const c = m.cell("envFile", env);
    if (!c || c.value.error) continue;
    const lacking = required.filter((k) => k !== label && !c.value.keys.includes(k));
    if (lacking.length) out.push(finding("envfiles.key-missing", env, `${c.value.file} does not set ${few(lacking)}`, [c.at], { ref: "envfiles.keys" }));
    if (!c.value.name) out.push(finding("envfiles.name-key-missing", env, `${c.value.file} sets no ${label}`, [c.at], { ref: "envfiles.keys" }));
    const reserved = c.value.keys.filter((k) => RESERVED.test(k));
    if (reserved.length) out.push(finding("envfiles.reserved-key", env, `${c.value.file} sets ${and(reserved)}, which flutter reserves`, [c.at]));
  }
  if (e.files.length || s) {
    const natives = new Set([...facts.gradle.flavors.map((f) => f.name.toLowerCase()), ...m.sources.ios.map((x) => x.toLowerCase())]);
    for (const env of Object.keys(spec.environments).filter((x) => natives.has(x) && !m.cell("envFile", x))) {
      out.push(finding("envfiles.file-missing", env, `${env} has no env/${env}.json on this machine`, [], { ref: "envfiles.skeletons" }));
    }
  }
  if (!wired.length) out.push(finding("envfiles.run-not-wired", null, mk ? `no ${mk.file} target passes --dart-define-from-file=env/$(env).json` : "there is no Makefile with run and build targets", mk ? [mk.file] : [], { ref: "envfiles.makefile" }));
  if (e.dotenvs.length || e.dotenvIgnores.length || (mk && mk.awk)) {
    const what = [e.dotenvs.length && and(e.dotenvs), e.dotenvIgnores.length && `.gitignore lines for ${and(e.dotenvIgnores)}`, mk && mk.awk && "an awk --dart-define Make rule"].filter(Boolean);
    out.push(finding("envfiles.legacy-dotenv", null, `the .env generation is still present: ${and(what)}`, e.dotenvs));
  }
  const assets = (e.pubspec ? e.pubspec.assets : []).filter((a) => /(^|\/)\.env(\.|$)/.test(a) && !/(example|sample|template)/i.test(a));
  if (assets.length) out.push(finding("envfiles.dotenv-asset", null, `pubspec.yaml bundles ${and(assets)} as an asset`, ["pubspec.yaml"]));
  return out.concat(makeRules(ctx));
}

// Make targets judged against the native flavors and default-flavor, whatever else the env setup holds.
function makeRules({ facts, matrix: m, spec }) {
  const mk = facts.envfiles.makefile;
  const out = [];
  const flavors = flavored(facts, m);
  const passes = mk ? mk.targets.filter((t) => t.recipe.some((l) => /--flavor\b/.test(l))) : [];
  if (passes.length && !flavors) out.push(finding("envfiles.makefile-flavor-mismatch", null, `${and(passes.map((t) => t.name))} pass --flavor, but the native projects define no flavors`, passes.map((t) => t.at), { ref: "envfiles.makefile-existing" }));
  const pubspec = facts.envfiles.pubspec;
  if (flavors && pubspec && !pubspec.defaultFlavor && spec.settings.defaultFlavor !== "off") {
    const broken = mk ? mk.targets.filter((t) => t.recipe.some((l) => RUNS.test(l) && !/--flavor\b/.test(l) && !/--config-only/.test(l))) : [];
    if (broken.length) out.push(finding("envfiles.envless-target-breaks", null, `${and(broken.map((t) => t.name))} run flutter without --flavor, and pubspec.yaml sets no default-flavor`, broken.map((t) => t.at), { ref: "envfiles.default-flavor" }));
    else out.push(finding("envfiles.default-flavor-missing", null, "pubspec.yaml sets no flutter: default-flavor, so plain flutter run and flutter test cannot pick a flavor", ["pubspec.yaml"], { ref: "envfiles.default-flavor" }));
  }
  return out;
}

function steps({ facts, matrix: m, spec }) {
  const out = [];
  const files = m.envs.map((e) => m.cell("envFile", e)).filter((c) => c && c.value.empty.length);
  if (files.length) out.push({ id: "envfiles.fill-values", where: "terminal", title: "Fill the empty values in the env files", do: files.map((c) => `${c.value.file}: ${few(c.value.empty, 6)}`), why: "an empty value builds as if the key were unset", blocks: ["envfiles.key-missing"], done: () => false });
  const ci = facts.envfiles.ci.length > 0;
  if (ci && Object.keys(spec.environments).length) out.push({ id: "envfiles.ci-secrets", where: "ci", title: "Keep each env file in a CI secret", do: Object.keys(spec.environments).map((e) => `${`ENV_${e.toUpperCase()}_JSON`} holds env/${e}.json`), why: "CI cannot read the gitignored env files", blocks: [], done: () => null });
  return out;
}

// The Make targets the skill's block defines, read off its template so the list has one home.
const OWN_TARGETS = [...render("Makefile.block", { default: "dev", envless: "" }).matchAll(/^([\w-]+):/gm)].map((m) => m[1]);

// The env setup as desired state: env/.gitignore, the sample, a skeleton per environment, key merges, the Make block,
// default-flavor and the app .gitignore blocks. Keys come from what Dart reads now plus what the Dart edits planned
// before this one will make it read, so one pass is enough.
function plan(ctx, { planned, findings }) {
  const { facts, matrix: m, spec } = ctx;
  const e = facts.envfiles;
  const envs = Object.keys(spec.environments);
  const prod = spec.production;
  const label = nameKey(facts);
  const dart = facts.dart.fromEnvironment;
  const coming = planned.flatMap((p) => (p.id === "dart.env" ? [CONVENTIONS.nameKey] : p.id === "dart.env-firebase-region" ? p.args.fields.map((f) => f.key) : []));
  const required = [...new Set([...Object.values(dart).filter((k) => !k.hasDefault).map((k) => k.key), ...coming])].filter((k) => k !== label);
  const keys = [...new Set([label, ...Object.keys(dart), ...coming, ...e.files.flatMap((f) => f.keys)])];
  const out = [];

  const ownIgnore = e.envGitignore !== null || facts.ignored[CONVENTIONS.envProbe] !== true;
  if (ownIgnore) out.push(edit("envfiles.env-gitignore", {}, { summary: "env/.gitignore keeps every env file but the sample out of git", fixes: ["envfiles.not-ignored", "envfiles.gitignore-self-ignored"] }));
  const held = e.sample && !e.sample.error ? Object.keys(e.sample.digests).length : 0;
  out.push(edit("envfiles.sample", { keys }, {
    requires: ["envfiles.env-gitignore"], summary: `${CONVENTIONS.sampleFile} with ${keys.length} empty keys${held ? `, ${held} values emptied` : ""}`,
    fixes: ["envfiles.none", "envfiles.sample-missing", "envfiles.sample-drift", "envfiles.sample-holds-env-values"],
  }));
  out.push(edit("envfiles.skeletons", { envs: envs.map((env) => ({ env, name: env.toUpperCase() })), keys, label }, {
    requires: ["envfiles.env-gitignore", "envfiles.sample"], summary: "env/<env>.json from the sample where missing", fixes: ["envfiles.file-missing"],
  }));
  const rename = new Set(findings.filter((f) => f.code === "envfiles.name-key-missing" || f.code === "banner.name-flavor-mismatch").map((f) => f.env));
  const names = Object.fromEntries(envs.filter((env) => rename.has(env)).map((env) => [env, env.toUpperCase()]));
  // Each environment's native Firebase files and the ids that pick its app in them: envfiles.keys sets every FIREBASE_*
  // key an env file holds to the value those files imply, after a backup when it replaces one.
  const firebase = m.firebaseInUse ? Object.fromEntries(envs.map((env) => {
    const fa = m.cell("fbAndroid", env);
    const fi = m.cell("fbIos", env);
    const own = spec.environments[env];
    return [env, { android: fa && fa.value.present ? fa.value.file : null, ios: fi && fi.value.present ? fi.value.file : null, androidId: own.id, iosId: own.iosId || own.id }];
  }).filter(([, f]) => f.android || f.ios)) : {};
  const derives = Object.keys(firebase).length > 0;
  // check compares the env files through the platform ids the project has now. While one of those is not the spec's
  // yet, a disagreement can be the id's, which no env file settles, so the edit claims it only once no id finding is open.
  const claimsNative = derives && !findings.some((f) => ID_FINDINGS.includes(f.code));
  out.push(edit("envfiles.keys", { envs, required, label, names, ...(derives ? { firebase } : {}) }, {
    requires: ["envfiles.env-gitignore", "envfiles.skeletons"], summary: `the keys Dart needs in every env file${Object.keys(names).length ? `, ${label} set for ${and(Object.keys(names))}` : ""}${derives ? ", FIREBASE_* from the native files" : ""}`,
    fixes: ["envfiles.key-missing", "envfiles.name-key-missing", "banner.name-flavor-mismatch", ...(claimsNative ? ["firebase.env-native-disagree"] : [])],
  }));

  const mk = e.makefile;
  const first = envs.find((x) => x !== prod) || envs[0];
  if (!mk || mk.managed || !mk.targets.some((t) => OWN_TARGETS.includes(t.name))) {
    out.push(edit("envfiles.makefile", { default: first, envless: spec.settings.defaultFlavor === "off" }, { summary: `the Make block (env ?= ${first})`, fixes: ["envfiles.run-not-wired"] }));
  }
  const flavors = facts.gradle.flavors.length > 0 || m.sources.ios.length > 0 || planned.some((p) => p.id === "gradle.flavors");
  if (flavors && e.pubspec && spec.settings.defaultFlavor !== "off") {
    out.push(edit("envfiles.default-flavor", { flavor: first }, { requires: ["gradle.flavors"], summary: `pubspec.yaml flutter: default-flavor: ${first}`, fixes: ["envfiles.default-flavor-missing", "envfiles.envless-target-breaks"] }));
  }

  // Each .gitignore block keeps the paths it already holds and adds the ones no other rule ignores, so a path the
  // block itself ignores never reads as covered elsewhere.
  const blocks = {};
  const settle = (id, paths, ignoredElsewhere) => {
    const held = e.ignoreBlocks[id] || [];
    const want = paths.filter((p) => held.includes(p) || !ignoredElsewhere(p));
    if (want.length || e.ignoreBlocks[id]) blocks[id] = want;
  };
  const ciFiles = m.firebaseInUse && prod && spec.settings["firebase.productionFiles"] !== "tracked";
  const prodPaths = ciFiles ? [facts.gradle.file && CONVENTIONS.fbAndroidFile(prod), facts.pbxproj.file && CONVENTIONS.fbIosFile(prod)].filter(Boolean) : [];
  settle("firebase-production", prodPaths, (p) => { const c = m.cell(p.startsWith("android/") ? "fbAndroid" : "fbIos", prod); return !!(c && c.value.ciProvided); });
  settle("env-backups", ownIgnore ? [] : [`${CONVENTIONS.envBackupDir}/`], () => false);
  const runner = facts.pbxproj.targets.find((t) => t.name === "Runner");
  const copies = runner ? [...new Set(runner.phases.filter((p) => p.isa === "PBXShellScriptBuildPhase" && /googleservice-info\.plist/i.test(p.script || "")).flatMap((p) => p.copies.map((c) => c.to)).filter((to) => to && to !== "ios"))] : [];
  settle("firebase-copies", copies, (p) => facts.ignored[p] !== false);
  if (Object.keys(blocks).length) out.push(edit("envfiles.gitignore", { blocks }, { summary: `.gitignore blocks: ${Object.entries(blocks).map(([id, l]) => `${id} (${l.length})`).join(", ")}`, fixes: ["firebase.ios-delivery-source-tree"] }));
  return out;
}

// The makefile recipe's snippet: the skill's own block, for this project's default environment.
function snippets({ spec }) {
  const envs = Object.keys(spec.environments);
  return { "envfiles.makefile-existing": { writer: "envfiles", name: "makefile", args: { default: envs.find((x) => x !== spec.production) || envs[0], envless: spec.settings.defaultFlavor === "off" } } };
}

function variant({ facts }) {
  const e = facts.envfiles;
  return `${e.files.length ? "env/<env>.json" : e.envDir ? "env/" : "-"}${wiredTargets(e.makefile).length ? " + make" : ""}`;
}

// Absent only when every facet the criterion reads is empty: env files, Dart keys, the .env generation and dotenv.
function empty({ facts }) {
  const e = facts.envfiles;
  const facets = [e.envDir, e.files.length, e.sample, e.dotenvs.length, e.dotenvIgnores.length, e.makefile && e.makefile.awk,
    facts.dart.dotenv, Object.keys(facts.dart.fromEnvironment).length, wiredTargets(e.makefile).length];
  return !facets.some(Boolean);
}

module.exports = { key: "envfiles", check, steps, plan, snippets, prove: () => [], empty, variant };
