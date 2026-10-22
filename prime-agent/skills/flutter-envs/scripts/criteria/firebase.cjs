"use strict";
// Criterion 4, Firebase per environment: production has a project nobody else uses, on every source; each environment
// has its own native files, delivered on iOS by configuration; env keys agree with the native files they project.
// Rules are pure over the context; values are compared by digest only.

const path = require("node:path");
const { CONVENTIONS, PLATFORMS, finding, edit } = require("../lib/vocab.cjs");
const { render } = require("../lib/templates.cjs");
const { firebaseSteps } = require("../lib/firebase-steps.cjs");

const MODE = /^(Debug|Release|Profile)[-_ ](.+)$/i;
const and = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const runner = (facts) => facts.pbxproj.targets.find((t) => t.name === "Runner") || null;
const flavored = (facts, m) => facts.gradle.flavors.length > 0 || m.sources.ios.length > 0;
const glob = (p) => new RegExp(`^${p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);

// The configuration-to-environment map an existing delivery script implements, from its case arms or if/elif chain.
function branches(script) {
  const out = [];
  const caseBody = /case\s+"?\$\{?CONFIGURATION\}?"?\s+in([\s\S]*?)\besac\b/.exec(script);
  if (caseBody) {
    for (const arm of caseBody[1].matchAll(/^\s*([^)\n]+)\)\s*([\s\S]*?);;/gm)) {
      const target = (/FLAVOU?R=["']?(\w+)/.exec(arm[2]) || /config\/(\w+)\//.exec(arm[2]) || [])[1] || null;
      out.push({ patterns: arm[1].split("|").map((p) => p.trim().replace(/^["']|["']$/g, "")).filter((p) => p && p !== "*"), target });
    }
  }
  for (const b of script.matchAll(/\b(?:if|elif)\s+(\[\[?[\s\S]*?\]\]?(?:\s*(?:\|\||&&)\s*\[\[?[\s\S]*?\]\]?)*)\s*;?\s*then([\s\S]*?)(?=\n\s*(?:elif|else|fi)\b)/g)) {
    const patterns = [...b[1].matchAll(/==?\s*["']([^"']+)["']/g)].map((m) => m[1]);
    const target = (/config\/(\w+)\//.exec(b[2]) || /FLAVOU?R=["']?(\w+)/.exec(b[2]) || [])[1] || null;
    if (patterns.length) out.push({ patterns, target });
  }
  return out;
}

function delivery(facts) {
  const r = runner(facts);
  const phases = r ? r.phases.filter((p) => p.isa === "PBXShellScriptBuildPhase" && p.script && /googleservice-info\.plist/i.test(p.script) && /CONFIGURATION/.test(p.script)) : [];
  const configs = r ? r.configs.map((c) => c.name).filter((n) => MODE.test(n || "")) : [];
  return phases.map((p) => {
    const script = p.script.replace(/^\s*#.*$/gm, "").replace(/\s+#\s.*$/gm, "");
    const derived = /\$\{CONFIGURATION##\*-\}/.test(script);
    const arms = derived ? [] : branches(script);
    const faults = [];
    if (/googleservice-info\.plist/i.test(script.replace(/GoogleService-Info\.plist/g, ""))) faults.push("uses a GoogleService-info.plist spelling Xcode does not bundle");
    if (!derived) {
      const tokens = new Map();
      for (const a of arms) for (const pat of a.patterns.filter((x) => !/[*?]/.test(x))) { if (!tokens.has(pat)) tokens.set(pat, new Set()); tokens.get(pat).add(a.target); }
      const twice = [...tokens].filter(([, t]) => t.size > 1).map(([tok]) => tok);
      if (twice.length) faults.push(`maps ${and(twice)} to more than one environment`);
      const target = (cfg) => { const a = arms.find((x) => x.patterns.some((pat) => glob(pat).test(cfg))); return a ? a.target : undefined; };
      const misrouted = configs.filter((c) => { const t = target(c); return t !== undefined && t !== null && t.toLowerCase() !== MODE.exec(c)[2].toLowerCase(); });
      if (misrouted.length) faults.push(`sends ${and(misrouted)} to another environment's file`);
      const envsSeen = new Set(configs.filter((c) => target(c) !== undefined).map((c) => MODE.exec(c)[2].toLowerCase()));
      const skipped = configs.filter((c) => /^Profile/i.test(c) && target(c) === undefined && envsSeen.has(MODE.exec(c)[2].toLowerCase()));
      if (skipped.length) faults.push(`skips ${and(skipped)}`);
    }
    return { ...p, derived, arms, faults };
  });
}

// Every source's claim about an environment's project. A root google-services.json the build falls back to counts:
// that is the project the build really uses.
function projectsOf(m, env) {
  const out = [];
  for (const [facet, source] of [["fbAndroid", "the Android file"], ["fbIos", "the iOS file"], ["fbEnv", `env/${env}.json`]]) {
    const c = m.cell(facet, env);
    const id = c && c.value.projectId;
    if (id && !/PROJECT_ID/.test(id)) out.push({ id, source: c.value.fallback ? "the Android fallback file android/app/google-services.json" : source, at: c.at });
  }
  return out;
}

// The native-file problems of every environment: missing, from another app, or from another project. One source for
// the three findings and for the download step that resolves them.
function nativeProblems(ctx) {
  const { facts, matrix: m, spec } = ctx;
  const listed = Object.keys(spec.environments);
  const envs = spec.source === "file" ? m.envs.filter((e) => listed.includes(e)) : m.envs;
  const iosEnvs = new Set(m.sources.ios.map((e) => e.toLowerCase()));
  const androidEnvs = new Set(facts.gradle.flavors.map((f) => f.name.toLowerCase()));
  const out = [];
  for (const env of envs) {
    const want = (spec.environments[env] || {}).firebase;
    const field = spec.fields[`environments.${env}.firebase`];
    const decided = typeof want === "string" && field && (spec.source === "file" || field.source === "asked");
    const fa = m.cell("fbAndroid", env);
    const fi = m.cell("fbIos", env);
    const androidId = m.cell("androidId", env) && m.cell("androidId", env).value;
    const iosCell = m.cell("iosId", env);
    const iosIds = iosCell ? [...new Set(Object.values(iosCell.value.byConfig).filter(Boolean))] : [];
    const plat = [
      { platform: "android", has: androidEnvs.has(env), cell: fa, id: androidId, file: CONVENTIONS.fbAndroidFile(env), kind: "google-services.json" },
      { platform: "ios", has: iosEnvs.has(env), cell: fi, id: iosIds.length === 1 ? iosIds[0] : null, file: CONVENTIONS.fbIosFile(env), kind: "GoogleService-Info.plist" },
    ];
    for (const p of plat) {
      if (p.has && (!p.cell || (!p.cell.value.present && !p.cell.value.ciProvided))) out.push({ ...p, env, want, problem: "missing" });
      else if (p.cell && p.cell.value.present && p.id && (p.platform === "android" ? !p.cell.value.ids.includes(p.id) : p.cell.value.ids[0] !== p.id)) out.push({ ...p, env, want, problem: "wrong-app" });
      else if (decided && p.cell && p.cell.value.present && !p.cell.value.fallback && p.cell.value.projectId && p.cell.value.projectId !== want) out.push({ ...p, env, want, problem: "foreign" });
    }
    const native = plat.map((p) => p.cell).filter((c) => c && c.value.present && !c.value.fallback && c.value.projectId);
    if (!decided && native.length === 2 && native[0].value.projectId !== native[1].value.projectId) out.push({ ...plat[1], env, want: native[0].value.projectId, problem: "platforms-disagree", other: native[0] });
  }
  return out;
}

// A build can miss its google-services.json only when some flavor's own file is absent, CI-provided or a root
// fallback; with every file committed the guard has nothing to stop.
function guardNeeded({ facts, matrix: m }) {
  const flavors = facts.gradle.flavors.map((f) => f.name.toLowerCase()).filter((e) => m.envs.includes(e));
  return flavors.some((e) => { const c = m.cell("fbAndroid", e); return !c || !c.value.present || c.value.ciProvided || c.value.fallback; });
}

function check(ctx) {
  const { facts, matrix: m, spec } = ctx;
  if (!m.firebaseInUse || !flavored(facts, m)) return [];
  const out = [];
  const listed = Object.keys(spec.environments);
  const envs = spec.source === "file" ? m.envs.filter((e) => listed.includes(e)) : m.envs;
  const prod = spec.production;
  const r = runner(facts);
  const iosEnvs = new Set(m.sources.ios.map((e) => e.toLowerCase()));

  if (prod && envs.includes(prod)) {
    const mine = projectsOf(m, prod);
    for (const p of mine) {
      const users = envs.filter((e) => e !== prod && projectsOf(m, e).some((x) => x.id === p.id));
      if (users.length) out.push(finding("firebase.production-shares-project", prod, `production's ${p.source} names ${p.id}, which ${and(users)} also use`, [p.at, ...users.flatMap((e) => projectsOf(m, e).filter((x) => x.id === p.id).map((x) => x.at))], { ref: "firebase.isolate-production" }));
    }
    if ((spec.environments[prod] || {}).firebase === null) out.push(finding("firebase.production-unregistered", prod, "production has no Firebase project of its own yet", [m.cell("fbAndroid", prod) && m.cell("fbAndroid", prod).at], { ref: "firebase.production-project" }));
  }

  for (const p of nativeProblems(ctx)) {
    const c = p.cell;
    if (p.problem === "missing") out.push(finding("firebase.native-missing", p.env, `${p.env} has no ${p.file}`, [], { ref: "firebase.download-config" }));
    if (p.problem === "wrong-app") out.push(finding("firebase.native-wrong-app", p.env, p.platform === "android" ? `${c.value.file} has no client for ${p.id}` : `${c.value.file} is for ${c.value.ids[0] || "no bundle id"}, not ${p.id}`, [c.at], { ref: "firebase.download-config" }));
    if (p.problem === "foreign") out.push(finding("firebase.native-foreign-project", p.env, `${c.value.file} is project ${c.value.projectId}; ${spec.source === "file" ? "flutter_envs.json" : "--set"} says ${p.want}`, [c.at], { ref: "firebase.download-config" }));
    if (p.problem === "platforms-disagree") out.push(finding("firebase.native-foreign-project", p.env, `${p.env}'s Android file is ${p.other.value.projectId} and its iOS file ${c.value.projectId}`, [p.other.at, c.at], { ref: "firebase.download-config" }));
  }

  for (const env of envs) {
    const fa = m.cell("fbAndroid", env);
    const fi = m.cell("fbIos", env);
    const fe = m.cell("fbEnv", env);
    const androidId = m.cell("androidId", env) && m.cell("androidId", env).value;
    const iosCell = m.cell("iosId", env);
    const iosIds = iosCell ? [...new Set(Object.values(iosCell.value.byConfig).filter(Boolean))] : [];
    if (fe) {
      const derivable = { ...((fa && fa.value.present) ? fa.value.derived : {}), ...((fi && fi.value.present) ? fi.value.derived : {}) };
      const sources = [fa && fa.value.present && fa.value.derived, fi && fi.value.present && fi.value.derived].filter(Boolean);
      const off = Object.entries(fe.value.digests).filter(([k, d]) => k in derivable && !sources.some((s) => s[k] === d)).map(([k]) => k);
      if (off.length) out.push(finding("firebase.env-native-disagree", env, `env/${env}.json's ${and(off)} ${off.length === 1 ? "differs" : "differ"} from ${env}'s native Firebase files`, [fe.at], { ref: "envfiles.keys" }));
      const ciOnly = [fa, fi].some((c) => c && !c.value.present && c.value.ciProvided);
      if (ciOnly && fe.value.keys.length) out.push(finding("firebase.env-unverifiable", env, `${env}'s native Firebase files are CI-provided and absent here, so env/${env}.json's FIREBASE_* keys cannot be compared`, [fe.at]));
      if (fe.value.keys.includes("FIREBASE_ANDROID_CLIENT_ID") && fa && fa.value.present && fa.value.type1Count !== null && fa.value.type1Count !== 1) {
        out.push(finding("firebase.android-client-ambiguous", env, `${fa.value.file} has ${fa.value.type1Count} type-1 OAuth clients for ${androidId}, so FIREBASE_ANDROID_CLIENT_ID is left as it is`, [fa.at]));
      }
    }
  }

  const g = facts.gradle;
  const androidFirebase = facts.android.firebase.length > 0 || envs.some((e) => m.cell("fbAndroid", e));
  if (g.flavors.length && androidFirebase && guardNeeded(ctx) && !g.guardAt) out.push(finding("firebase.android-guard-missing", null, `no Gradle check stops a build whose environment has no google-services.json (${g.file})`, [g.file], { ref: "gradle.guard" }));
  if (g.file && (androidFirebase || (facts.envfiles.pubspec && facts.envfiles.pubspec.deps.includes("firebase_core"))) && !g.gmsApplied) {
    out.push(finding("firebase.gradle-plugin-missing", null, `${g.file} does not apply com.google.gms.google-services`, [g.file], { ref: "gradle.gms-plugin" }));
  }

  const misplaced = facts.android.firebase.filter((f) => f.set === "main");
  if (misplaced.length) out.push(finding("firebase.native-misplaced", null, `${and(misplaced.map((f) => f.file))} is never read by the google-services plugin`, misplaced.map((f) => f.file), { ref: "firebase.move-misplaced" }));

  const phases = delivery(facts);
  const iosFirebase = facts.apple.firebase.length > 0 || envs.some((e) => m.cell("fbIos", e));
  if (iosEnvs.size && iosFirebase && !phases.length) {
    const make = facts.envfiles.makefile && facts.envfiles.makefile.targets.some((t) => t.recipe.some((l) => /GoogleService-Info\.plist/i.test(l)));
    out.push(finding("firebase.ios-delivery-missing", null, `no Run Script phase of the Runner target picks GoogleService-Info.plist by configuration${make ? " (the Makefile copies it, which Xcode and CI builds skip)" : ""}`, [facts.pbxproj.file], { ref: "pbxproj.shell-phase" }));
  }
  for (const p of phases.filter((x) => x.faults.length)) {
    out.push(finding("firebase.ios-delivery-wrong", null, `the "${p.name || "Run Script"}" phase ${and(p.faults)}`, [p.at], { ref: "firebase.delivery-adopted" }));
  }
  const sandboxed = r && r.configs.some((c) => MODE.test(c.name || "") && (c.settings.ENABLE_USER_SCRIPT_SANDBOXING || {}).value === "YES");
  for (const p of phases) {
    const strays = p.copies.filter((c) => c.to && c.to !== "ios" && facts.ignored[c.to] === false).map((c) => c.to);
    const blocked = sandboxed && p.copies.some((c) => c.to) && !p.outputs.length;
    if (strays.length || blocked) {
      out.push(finding("firebase.ios-delivery-source-tree", null, `the "${p.name || "Run Script"}" phase writes ${strays.length ? `${and(strays)}, which no .gitignore covers` : "into the source tree with ENABLE_USER_SCRIPT_SANDBOXING = YES and no declared outputs"}`, [p.at], { ref: strays.length ? "envfiles.gitignore" : "pbxproj.shell-phase" }));
    }
  }

  const opts = facts.dart.firebase;
  if (opts.main && opts.main.literal && !opts.main.fromEnv && new Set(opts.main.projectIds).size <= 1 && !opts.perFlavor.length) {
    out.push(finding("firebase.options-not-env", null, `${opts.main.file} holds literal options${opts.main.projectIds.length ? ` (${and(opts.main.projectIds)})` : ""}, so every environment initialises one project`, [opts.main.file],
      opts.main.generated ? { ref: "dart.firebase-options" } : { ref: "firebase.options-hand-edited", blocked: "foreign" }));
  }
  if (opts.defaultsToProd) out.push(finding("firebase.options-default-prod", null, `the options switch at ${opts.defaultsToProd} falls back to production`, [opts.defaultsToProd], { ref: "firebase.switch-fallback" }));

  const fj = facts.envfiles.firebaseJson;
  const copyTarget = (o) => o === "ios/Runner/GoogleService-Info.plist" || o === "android/app/google-services.json";
  if (fj && (fj.missing.length || fj.outputs.some(copyTarget))) {
    const why = [fj.missing.length && `names ${and(fj.missing)}, which do not exist`, fj.outputs.some(copyTarget) && `targets ${and(fj.outputs.filter(copyTarget))}`].filter(Boolean);
    out.push(finding("firebase.firebasejson-stale", null, `firebase.json ${and(why)}`, [fj.file]));
  }
  const pinned = r && r.phases.find((p) => p.script && /upload-crashlytics-symbols/.test(p.script) && /--default-config[= ]default\b/.test(p.script));
  if (pinned) out.push(finding("firebase.symbols-pinned-default", null, `the "${pinned.name}" phase uploads every configuration's symbols with --default-config=default`, [pinned.at]));

  if (prod && spec.settings["firebase.productionFiles"] !== "tracked") {
    const ci = ["fbAndroid", "fbIos"].map((f) => m.cell(f, prod)).filter((c) => c && c.value.ciProvided);
    if (ci.length && !facts.envfiles.ci.some((c) => c.writesFirebase)) {
      out.push(finding("firebase.ci-materialization-missing", prod, `${and(ci.map((c) => c.value.file))} are gitignored for CI, but no CI file writes them`, ci.map((c) => c.at), { ref: "firebase.ci-materialize" }));
    }
  }
  const targets = r ? r.configs.filter((c) => MODE.test(c.name || "")).map((c) => parseFloat((c.settings.IPHONEOS_DEPLOYMENT_TARGET || {}).value)).filter((v) => !Number.isNaN(v)) : [];
  const podPlatform = facts.apple.podfile && facts.apple.podfile.platform ? parseFloat(facts.apple.podfile.platform) : null;
  const low = [...targets, ...(podPlatform !== null ? [podPlatform] : [])].filter((v) => v < CONVENTIONS.firebaseMinIos);
  // A Runner configuration's target is raised by pbxproj.deployment-target, the Podfile's platform alone by apple.podfile-platform.
  const raisedBy = targets.some((v) => v < CONVENTIONS.firebaseMinIos) ? "pbxproj.deployment-target" : "apple.podfile-platform";
  if (iosEnvs.size && low.length) out.push(finding("firebase.min-platform", null, `the iOS deployment target is ${Math.min(...low)}, below Firebase's iOS ${CONVENTIONS.firebaseMinIos}`, [facts.pbxproj.file], { ref: raisedBy }));
  return out;
}

function steps(ctx) {
  const { facts, matrix: m, spec } = ctx;
  if (!m.firebaseInUse || !flavored(facts, m)) return [];
  const prod = spec.production;
  const deps = (facts.envfiles.pubspec && facts.envfiles.pubspec.deps) || [];
  const out = [];
  if (prod && m.envs.includes(prod)) {
    const others = m.envs.filter((e) => e !== prod).flatMap((e) => projectsOf(m, e).map((x) => x.id));
    const shared = projectsOf(m, prod).filter((p) => others.includes(p.id));
    if (shared.length) {
      out.push({ id: "firebase.isolate-production", where: "console", title: "Give production its own Firebase project on every source", do: shared.map((p) => `production's ${p.source} names ${p.id}; point it at production's own project`), why: "a production build must never report to a non-production project", blocks: ["firebase.production-shares-project"], done: () => false });
    }
  }
  const missing = nativeProblems(ctx).map((p) => `${p.kind} for ${p.id || p.env} from ${p.want || "its project"} to ${p.file}`);
  if (missing.length) {
    out.push({ id: "firebase.download-config", where: "console", title: "Download each environment's Firebase config file", do: missing.map((x) => `Firebase console, Project settings: download ${x}`), why: "each environment reads its own app's config", blocks: ["firebase.native-missing", "firebase.native-wrong-app", "firebase.native-foreign-project"], done: () => false });
  }
  if (prod) {
    const ci = ["fbAndroid", "fbIos"].map((f) => m.cell(f, prod)).filter((c) => c && c.value.ciProvided);
    const vars = CONVENTIONS.ciVars(prod);
    if (ci.length && !facts.envfiles.ci.some((c) => c.writesFirebase)) {
      out.push({ id: "firebase.ci-materialize", where: "ci", title: `Write ${prod}'s Firebase files in CI`, do: [`Before the build, write ${CONVENTIONS.fbAndroidFile(prod)} from ${vars.android} and ${CONVENTIONS.fbIosFile(prod)} from ${vars.ios}`], why: `${prod}'s files are gitignored, so only CI can provide them`, blocks: ["firebase.ci-materialization-missing"], done: () => null });
    }
  }
  for (const env of Object.keys(spec.environments)) {
    const ci = ["fbAndroid", "fbIos"].map((f) => m.cell(f, env)).filter((c) => c && !c.value.present && c.value.ciProvided);
    if (ci.length && m.cell("fbEnv", env)) {
      const vars = CONVENTIONS.ciVars(env);
      out.push({ id: `firebase.compare-ci:${env}`, where: "ci", title: `Check ${env}'s CI Firebase values`, do: [`Compare the FIREBASE_* keys of ${vars.env} with ${vars.android} and ${vars.ios}`], why: `${env}'s native files exist only in CI, so this machine cannot compare them`, blocks: ["firebase.env-unverifiable"], done: () => null });
    }
  }
  // The dependency-gated checklist only a person can take. Its done() reads the CLI probe, which check never runs, so
  // a step is either left for you (false) or cannot be checked from here (null).
  const platforms = PLATFORMS.filter((p) => (p === "android" ? facts.gradle.file : facts.pbxproj.file));
  const human = firebaseSteps({ spec, deps, platforms, settings: { productionFiles: spec.settings["firebase.productionFiles"] || "ci" } });
  out.push(...human.map((s) => ({ ...s, blocks: s.id === "firebase.production-project" ? ["firebase.production-unregistered"] : s.blocks, done: () => (typeof s.done === "function" ? s.done({}) : null) })));
  return out;
}

const ENV_FILE = "lib/env/env.dart";
// Each FirebaseOptions argument of the template and the env key it reads.
const OPTIONS = Object.freeze({
  apiKeyAndroid: "FIREBASE_ANDROID_API_KEY", appIdAndroid: "FIREBASE_ANDROID_APP_ID", apiKeyIos: "FIREBASE_IOS_API_KEY",
  appIdIos: "FIREBASE_IOS_APP_ID", iosBundleId: "FIREBASE_IOS_BUNDLE_ID", projectId: "FIREBASE_PROJECT_ID",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID", storageBucket: "FIREBASE_STORAGE_BUCKET",
});

// Firebase's Android, iOS and Dart halves: the plugin lines, the guard while some flavor's file can be missing, minSdk,
// the delivery phase while no recognised one exists, the deployment targets, the Env constants the options read, and
// the options file when it is absent, unmodified FlutterFire output, or the skill's own render (it reads Env and
// carries no FlutterFire header, wherever Env lives).
function plan(ctx, { planned }) {
  const { facts, matrix: m, spec } = ctx;
  if (!m.firebaseInUse) return [];
  const g = facts.gradle;
  const out = [];
  const envs = Object.keys(spec.environments);
  const flavors = g.flavors.length > 0 || planned.some((e) => e.id === "gradle.flavors");
  if (g.file && !g.gmsApplied) out.push(edit("gradle.gms-plugin", { version: CONVENTIONS.googleServicesVersion }, { summary: `the ${CONVENTIONS.googleServicesVersion} google-services plugin`, fixes: ["firebase.gradle-plugin-missing"] }));
  // Production's files are CI's unless the spec keeps them tracked, and this pass's .gitignore block makes them so.
  const ciProduction = spec.settings["firebase.productionFiles"] !== "tracked";
  const exposed = envs.some((e) => { const c = m.cell("fbAndroid", e); return !c || !c.value.present || c.value.ciProvided || c.value.fallback || (ciProduction && e === spec.production); });
  if (g.file && flavors && (g.managedGuard || (!g.guardAt && exposed))) {
    out.push(edit("gradle.guard", { envs }, { requires: ["gradle.flavors"], summary: "a Gradle guard that names the missing google-services.json and its CI variable", fixes: ["firebase.android-guard-missing"] }));
  }
  if (g.minSdk !== null && g.minSdk < CONVENTIONS.firebaseMinSdk) out.push(edit("gradle.min-sdk", { min: CONVENTIONS.firebaseMinSdk }, { summary: `minSdk ${g.minSdk} becomes ${CONVENTIONS.firebaseMinSdk}, Firebase's minimum` }));

  const r = runner(facts);
  const crashSafe = ["icons.ios", "apple.xcconfig-files"];
  const iosFlavored = m.sources.ios.length > 0 || planned.some((e) => e.id === "pbxproj.clone-flavors");
  const iosFirebase = facts.apple.firebase.length > 0 || envs.some((e) => m.cell("fbIos", e));
  if (r && iosFlavored && iosFirebase && !delivery(facts).length) {
    out.push(edit("pbxproj.shell-phase", { name: CONVENTIONS.deliveryPhase, script: render("googleservice-phase.sh") }, {
      requires: ["pbxproj.clone-flavors", ...crashSafe], summary: `the "${CONVENTIONS.deliveryPhase}" Run Script phase after Copy Bundle Resources`, fixes: ["firebase.ios-delivery-missing"],
    }));
  }
  const min = CONVENTIONS.firebaseMinIos;
  const below = (v) => { const n = parseFloat(v); return !Number.isNaN(n) && n < min; };
  const lowTargets = !!r && r.configs.some((c) => below((c.settings.IPHONEOS_DEPLOYMENT_TARGET || {}).value));
  if (lowTargets) out.push(edit("pbxproj.deployment-target", { min }, { requires: crashSafe, summary: `IPHONEOS_DEPLOYMENT_TARGET raised to ${min}.0, Firebase's minimum`, fixes: ["firebase.min-platform"] }));
  const pod = facts.apple.podfile;
  if (r && pod && (lowTargets || below(pod.platform))) out.push(edit("apple.podfile-platform", { min }, { requires: ["apple.podfile-map"], summary: `the Podfile's platform :ios raised to ${min}.0`, fixes: ["firebase.min-platform"] }));

  const d = facts.dart;
  if (!d.env && !planned.some((e) => e.id === "dart.env")) out.push(edit("dart.env", {}, { summary: `${ENV_FILE}, the Env class` }));
  const { file, className, region, options } = envShape(ctx);
  if (region.length) out.push(edit("dart.env-firebase-region", { file, className, fields: region }, { requires: ["dart.env"], summary: `${region.length} Firebase constants in ${className}'s managed region` }));
  const opts = d.firebase.main;
  if (!opts || (opts.generated && opts.literal && !opts.fromEnv) || (opts.fromEnv && (file === ENV_FILE || !opts.generated))) {
    out.push(edit("dart.firebase-options", options, { requires: ["dart.env-firebase-region"], summary: "lib/firebase_options.dart built from Env", fixes: ["firebase.options-not-env"] }));
  }
  return out;
}

// Where Env lives, the Firebase keys its managed region must add (those no field outside it reads), and the template
// values of firebase_options.dart that name each constant.
function envShape({ facts }) {
  const env = facts.dart.env;
  const file = env ? env.file : ENV_FILE;
  const className = env ? env.name : "Env";
  const outside = env ? env.fields.filter((f) => !f.inRegion) : [];
  const region = CONVENTIONS.firebaseFields.filter(([, key]) => !outside.some((f) => f.key === key)).map(([field, key]) => ({ field, key }));
  const fieldOf = (key) => { const f = outside.find((x) => x.key === key); return `${className}.${f ? f.field : CONVENTIONS.firebaseFields.find(([, k]) => k === key)[0]}`; };
  const options = { envImport: `import '${path.posix.relative("lib", file)}';`, fields: Object.fromEntries(Object.entries(OPTIONS).map(([arg, key]) => [arg, fieldOf(key)])) };
  return { file, className, region, options };
}

const snippets = (ctx) => (ctx.matrix.firebaseInUse ? { "firebase.options-hand-edited": { writer: "dart", name: "options", args: envShape(ctx).options } } : {});

function variant({ facts, matrix: m }) {
  const phases = delivery(facts);
  const opts = facts.dart.firebase.main;
  return `I:${phases.length ? (phases.some((p) => p.derived) ? "derived" : "case") : "none"} dart:${opts ? (opts.fromEnv ? "env" : opts.literal ? "literal" : "?") : facts.dart.firebase.perFlavor.length ? "per-flavor" : "native"}${m.firebaseInUse ? "" : " (not in use)"}`;
}

module.exports = { key: "firebase", check, steps, plan, snippets, prove: () => [], applies: ({ matrix }) => matrix.firebaseInUse, empty: ({ facts, matrix }) => !flavored(facts, matrix), variant, delivery };
