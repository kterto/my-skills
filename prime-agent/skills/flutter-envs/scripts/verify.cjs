"use strict";
// The proof ladder (spec 8.2). Each check runs against this machine's tools and reads pass, fail or not-run with its
// reason, never a pass it did not observe. `static` reads the evaluation again and runs the pbxproj validator; `config`
// asks Gradle, flutter test, make, plutil, xcodebuild and flutter build ios --config-only; `build` builds each flavor's
// debug APK and simulator app and reads back what they carry. A tier runs every tier below it, and only `build` builds.

const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { CRITERIA, FINDINGS, CONVENTIONS, STATIC_PROOFS, TIERS } = require("./lib/vocab.cjs");

const MINUTE = 60 * 1000;
const SUPERVISE = path.join(__dirname, "lib", "supervise.cjs");
const title = (env) => env.charAt(0).toUpperCase() + env.slice(1);
const check = (id, tier, { env = null, platform = null, expect }, outcome) => ({ id, tier, env, platform, expect, ...outcome });
const pass = (got) => ({ result: "pass", ...(got ? { got } : {}) });
const fail = (got) => ({ result: "fail", got });
const notRun = (why) => ({ result: "not-run", why });
const NO_XCODE = "no xcodebuild on PATH (Xcode runs on macOS only)";
// The Xcode project around the pbxproj the reader found, and the workspace beside it.
const xcodeOf = (facts) => { const project = path.dirname(facts.pbxproj.file); return { project, workspace: project.replace(/\.xcodeproj$/, ".xcworkspace") }; };
const iosIdOf = (spec, env) => spec.environments[env].iosId || spec.environments[env].id;

// Runs a tool and returns its exit code, its stdout and its combined output; a tool that cannot start or outlives its
// deadline has code null and says why in `error`. supervise.cjs runs the tool in a group of its own and stops the whole
// group at the deadline, so nothing the tool started is left running into the next check.
function exec(cmd, args, { cwd, timeout = 30 * MINUTE }) {
  const r = spawnSync(process.execPath, [SUPERVISE, String(timeout), cmd, ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe", "pipe"], env: { ...process.env, CI: "true" } });
  const outcome = attempt(() => JSON.parse((r.output && r.output[3]) || "{}"), {});
  const error = r.error ? r.error.message : outcome.timedOut ? `spawnSync ${cmd} ETIMEDOUT` : outcome.error ? `spawnSync ${cmd} ${outcome.error}` : null;
  return { code: error ? null : r.status, stdout: r.stdout || "", out: `${r.stdout || ""}${r.stderr || ""}`, error };
}

const lastLine = (out) => (out.trim().split("\n").filter((l) => l.trim()).pop() || "").trim().slice(0, 200);

// What a failed build says went wrong. Its last line is usually a trailer that names no cause ("Error running pod
// install", "BUILD FAILED"), so this takes Gradle's "What went wrong" message, else Xcode's first error line, else the
// last three lines, which carry CocoaPods' reason ahead of its trailer.
function cause(out) {
  const lines = out.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  const wrong = lines.indexOf("* What went wrong:");
  if (wrong >= 0) return lines.slice(wrong + 1, wrong + 3).filter((l) => !l.startsWith("*")).join(" ").slice(0, 240);
  return (lines.find((l) => /\berror:/.test(l)) || lines.slice(-3).join(" | ")).slice(0, 240);
}
const attempt = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

// The JSON a tool printed on stdout, from its first [ or {, past any line printed before it.
function parseJson(stdout) {
  const at = stdout.search(/[[{]/);
  return at < 0 ? null : attempt(() => JSON.parse(stdout.slice(at)), null);
}

// Gradle in offline mode fails without a cache; that says nothing about the project, so it is not-run, not fail.
const OFFLINE = /No cached version|offline mode|Could not (download|resolve|GET)|Unable to load Maven meta-data|--offline/i;

// Whether an environment's own Firebase file is on this machine (a root fallback is not its own).
const ownFirebaseFile = (m, facet, env) => { const c = m.cell(facet, env); return !!(c && c.value.present && !c.value.fallback); };
const iconSetOf = (m, env) => ((m.cell("iosIcon", env) || {}).value || {}).set || null;

function staticChecks({ ctx, ev }) {
  const open = [...CRITERIA.flatMap((c) => ev.criteria[c].findings), ...ev.repo];
  const out = [];
  const banner = ev.criteria.banner;
  const bannerOpen = [...new Set(banner.findings.filter((f) => FINDINGS[f.code].severity !== "note").map((f) => f.code))];
  out.push(check("static.banner", "static", { expect: "the banner reads ok: top-left, ENVLESS, hidden in production, wired" },
    banner.status === "ok" ? pass("ok") : fail(`${banner.status}: ${bannerOpen.join(", ") || "no banner"}`)));
  for (const [id, proof] of Object.entries(STATIC_PROOFS)) {
    if (proof.firebase && !ctx.matrix.firebaseInUse) { out.push(check(`static.${id}`, "static", { expect: proof.expect }, notRun("Firebase is not in use"))); continue; }
    const hits = open.filter((f) => proof.codes.includes(f.code));
    out.push(check(`static.${id}`, "static", { expect: proof.expect }, hits.length ? fail(hits.map((f) => f.claim).join("; ").slice(0, 300)) : pass("none open")));
  }
  return out;
}

// The validator every pbxproj op runs, over the working file against its committed copy: a fault the commit already
// had is the owner's, and a new one is not.
function pbxprojCheck({ ctx, root, run, tools, validate }) {
  const file = ctx.facts.pbxproj.file;
  const c = (o) => [check("static.pbxproj", "static", { platform: "ios", expect: "the pbxproj validator finds no fault that the committed project.pbxproj lacks" }, o)];
  if (!file) return c(notRun("the project has no iOS app"));
  if (!validate) return c(notRun("no pbxproj validator was passed in"));
  const head = tools.git && ctx.facts.git.repo ? run(tools.git.path, ["show", `HEAD:./${file}`], { cwd: root, timeout: MINUTE }) : null;
  const committed = head && head.code === 0 ? head.stdout : "";
  const added = validate(committed, ctx.io.read(file));
  return c(added.length ? fail(added.join("; ").slice(0, 300)) : pass(committed ? "no fault the committed copy lacks" : "no fault, and no committed copy to compare with"));
}

function androidChecks({ ctx, root, envs, run, tools }) {
  const { facts, matrix: m } = ctx;
  const { flutter } = tools;
  const out = [];
  const expect = `assemble<Env>Debug and assemble<Env>Release for ${envs.join(", ")}`;
  if (!facts.gradle.file) return [check("config.android.variants", "config", { platform: "android", expect }, notRun("the project has no Android app"))];
  const android = path.join(root, "android");
  const gradlew = path.join(android, "gradlew");
  if (!fs.existsSync(gradlew)) {
    if (!flutter) return [check("config.android.variants", "config", { platform: "android", expect }, notRun(`android/gradlew is absent and nothing can create it: ${tools.noFlutter}`))];
    const made = run(flutter.cmd, [...flutter.args, "build", "apk", "--config-only", "--flavor", envs[0]], { cwd: root, timeout: 10 * MINUTE });
    if (made.code !== 0 || !fs.existsSync(gradlew)) return [check("config.android.variants", "config", { platform: "android", expect }, notRun(`android/gradlew is absent and flutter build apk --config-only did not create it: ${lastLine(made.out) || made.error}`))];
  }
  const tasks = run(gradlew, ["--offline", ":app:tasks", "--all"], { cwd: android, timeout: 15 * MINUTE });
  if (tasks.code !== 0) {
    const why = lastLine(tasks.out) || tasks.error || "no output";
    out.push(check("config.android.variants", "config", { platform: "android", expect }, OFFLINE.test(tasks.out) || tasks.code === null ? notRun(`Gradle did not run offline here: ${why}`) : fail(`./gradlew :app:tasks failed: ${why}`)));
    return out;
  }
  const listed = new Set([...tasks.out.matchAll(/^(assemble\w+)\s+-/gm)].map((x) => x[1]));
  const want = envs.flatMap((e) => ["Debug", "Release"].map((mode) => `assemble${title(e)}${mode}`));
  const missing = want.filter((t) => !listed.has(t));
  out.push(check("config.android.variants", "config", { platform: "android", expect }, missing.length ? fail(`missing ${missing.join(", ")}`) : pass(want.join(" "))));

  if (m.firebaseInUse && facts.gradle.gmsApplied) {
    for (const env of envs) {
      const present = ownFirebaseFile(m, "fbAndroid", env);
      const task = `:app:process${title(env)}DebugGoogleServices`;
      const vars = CONVENTIONS.ciVars(env);
      const expectFb = present ? `${task} passes` : `${task} fails with the guard's message naming ${vars.android}`;
      const r = run(gradlew, ["--offline", task], { cwd: android, timeout: 15 * MINUTE });
      let outcome;
      if (r.code === null) outcome = notRun(`Gradle did not finish: ${r.error}`);
      else if (present) outcome = r.code === 0 ? pass(`${task} passed`) : OFFLINE.test(r.out) ? notRun(`Gradle did not run offline here: ${lastLine(r.out)}`) : fail(lastLine(r.out));
      else outcome = r.code !== 0 && r.out.includes("google-services.json is missing") && r.out.includes(vars.android) ? pass("the guard stopped the build and named the file and its CI variable") : fail(r.code === 0 ? `${task} passed without ${CONVENTIONS.fbAndroidFile(env)}` : lastLine(r.out));
      out.push(check(`config.android.firebase:${env}`, "config", { env, platform: "android", expect: expectFb }, outcome));
    }
  }
  return out;
}

function dartCheck({ root, run, tools }) {
  const { flutter } = tools;
  const expect = "flutter test test/env_banner_test.dart passes";
  const c = (o) => [check("config.dart.banner-test", "config", { expect }, o)];
  if (!fs.existsSync(path.join(root, "test", "env_banner_test.dart"))) return c(notRun("test/env_banner_test.dart is absent (an adopted banner keeps its own tests)"));
  if (!flutter) return c(notRun(tools.noFlutter));
  const r = run(flutter.cmd, [...flutter.args, "test", "test/env_banner_test.dart"], { cwd: root, timeout: 10 * MINUTE });
  if (r.code === null) return c(notRun(`flutter test did not finish: ${r.error}`));
  // flutter test ends on a progress line such as "00:02 +5: All tests passed!" or "00:02 +4 -1: Some tests failed.";
  // Flutter 3.27 rewrites one line with carriage returns, so each \r starts a line too.
  const progress = r.out.split(/\r\n|\r|\n/).filter((l) => /\+\d+(?: ~\d+)?(?: -\d+)?: /.test(l));
  const summary = (progress.pop() || lastLine(r.out)).replace(/^\s*\d+:\d+\s*/, "").trim().slice(0, 200);
  return c(r.code === 0 ? pass(summary) : fail(summary));
}

function makeChecks({ ctx, root, envs, run, tools }) {
  const mk = ctx.facts.envfiles.makefile;
  return envs.map((env) => {
    const expect = `make -n run-debug env=${env} expands to --flavor ${env} and --dart-define-from-file=env/${env}.json`;
    if (!mk) return check(`config.make:${env}`, "config", { env, expect }, notRun("there is no Makefile"));
    if (!tools.make) return check(`config.make:${env}`, "config", { env, expect }, notRun("no make on PATH"));
    const r = run(tools.make.path, ["-n", "run-debug", `env=${env}`], { cwd: root, timeout: MINUTE });
    if (r.code === null) return check(`config.make:${env}`, "config", { env, expect }, notRun(`make did not finish: ${r.error}`));
    const line = r.out.split("\n").find((l) => /\bflutter\b.*\brun\b/.test(l)) || "";
    const ok = r.code === 0 && line.includes(`--flavor ${env}`) && line.includes(`--dart-define-from-file=env/${env}.json`);
    return check(`config.make:${env}`, "config", { env, expect }, ok ? pass(line.trim().replace(/\s+/g, " ")) : fail(r.code === 0 ? `the run-debug line is: ${line.trim() || "(none)"}` : lastLine(r.out)));
  });
}

// iOS at the config tier: plutil, then flutter build ios --config-only per flavor, which runs pod install and writes
// Generated.xcconfig and so goes before Xcode is asked anything, then what Xcode itself resolves.
function iosChecks(s) {
  if (!s.ctx.facts.pbxproj.file) return [check("config.ios", "config", { platform: "ios", expect: "the iOS checks" }, notRun("the project has no iOS app"))];
  return [plutilCheck(s), ...s.envs.map((env) => configOnlyCheck(s, env)), ...xcodeChecks(s)];
}

function plutilCheck({ ctx, root, run, tools }) {
  const files = [ctx.facts.pbxproj.file, ctx.facts.apple.info && ctx.facts.apple.info.file].filter((rel) => rel && ctx.io.exists(rel));
  const c = (o) => check("config.ios.plutil", "config", { platform: "ios", expect: `plutil -lint passes ${files.map((f) => path.basename(f)).join(" and ")}` }, o);
  if (!tools.plutil) return c(notRun("no plutil on PATH (it ships with macOS)"));
  const r = run(tools.plutil.path, ["-lint", ...files], { cwd: root, timeout: MINUTE });
  if (r.code === null) return c(notRun(`plutil did not finish: ${r.error}`));
  const said = r.out.trim().split("\n").map((l) => l.replace(/^.*\//, "")).join(", ").slice(0, 300);
  return c(r.code === 0 ? pass(said) : fail(said));
}

// The id is config.ios.settings' to prove; a Building line that names another id still fails here.
function configOnlyCheck({ ctx, root, run, tools }, env) {
  const id = iosIdOf(ctx.spec, env);
  const c = (o) => check(`config.ios.config-only:${env}`, "config", { env, platform: "ios", expect: `flutter build ios --config-only --flavor ${env} succeeds` }, o);
  if (!tools.xcodebuild) return c(notRun(NO_XCODE));
  if (!tools.flutter) return c(notRun(tools.noFlutter));
  // --config-only runs pod install, which takes longer than 15 minutes on a cold CocoaPods cache with git-sourced pods.
  const r = run(tools.flutter.cmd, [...tools.flutter.args, "build", "ios", "--config-only", "--flavor", env], { cwd: root, timeout: 30 * MINUTE });
  if (r.code === null) return c(notRun(`flutter build ios did not finish: ${r.error}`));
  if (r.code !== 0) return c(fail(cause(r.out)));
  const building = /Building ([\w.-]+) for (?:device|simulator)/.exec(r.out);
  return c(building && building[1] !== id ? fail(`it configures ${building[1]}`) : pass(building ? building[0] : lastLine(r.out)));
}

// What is wrong with the icon set a flavor resolves to: the asset catalog must hold it, and outside production it must
// differ from production's.
function iconWrong(ctx, env, set, prodSet, label) {
  if (!set || !ctx.facts.icons.ios[set]) return [`${label} ${set || "(unset)"} names no icon set in the asset catalog`];
  return env !== ctx.spec.production && set === prodSet ? [`${label} ${set} is production's`] : [];
}

// Xcode's own answers: the schemes and configurations, then every configuration's settings through its scheme.
function xcodeChecks({ ctx, root, envs, run, tools }) {
  const { spec, matrix: m, facts } = ctx;
  const pods = !!facts.apple.podfile;
  const list = (o) => check("config.ios.list", "config", { platform: "ios", expect: `xcodebuild -list shows a scheme and a ${CONVENTIONS.modes.join(", ")} configuration for ${envs.join(", ")}` }, o);
  const settings = (env, o) => check(`config.ios.settings:${env}`, "config", { env, platform: "ios", expect: `-showBuildSettings resolves each ${env} configuration to ${iosIdOf(spec, env)}, "${spec.environments[env].name}" and its own icon set${pods ? ", with PODS_ROOT" : ""}` }, o);
  const none = (why) => envs.map((env) => settings(env, notRun(why)));
  if (!tools.xcodebuild) return [list(notRun(NO_XCODE)), ...none(NO_XCODE)];
  const where = xcodeOf(facts);
  const r = run(tools.xcodebuild.path, ["-list", "-json", "-project", where.project], { cwd: root, timeout: 2 * MINUTE });
  const answer = r.code === 0 ? (parseJson(r.stdout) || {}).project : null;
  const project = answer && Array.isArray(answer.schemes) && Array.isArray(answer.configurations) ? answer : null;
  if (!project) return [list(r.code === null ? notRun(`xcodebuild did not finish: ${r.error}`) : fail(`xcodebuild -list: ${r.code === 0 ? "no schemes and configurations in its JSON" : lastLine(r.out)}`)), ...none("xcodebuild -list did not answer")];
  const configsOf = (env) => Object.keys(((m.cell("iosId", env) || {}).value || {}).byConfig || {}).filter((name) => project.configurations.includes(name));
  const missing = envs.flatMap((env) => [
    ...(project.schemes.includes(env) ? [] : [`the ${env} scheme`]),
    ...CONVENTIONS.modes.filter((mode) => !configsOf(env).some((name) => name.toLowerCase().startsWith(mode.toLowerCase()))).map((mode) => `a ${mode} configuration for ${env}`),
  ]);
  const container = fs.existsSync(path.join(root, where.workspace)) ? ["-workspace", where.workspace] : ["-project", where.project];
  // The first read of a SwiftPM app resolves its packages, and Firebase's is a large clone on a cold cache.
  const readEnv = (env) => configsOf(env).map((config) => {
    const x = run(tools.xcodebuild.path, [...container, "-scheme", env, "-configuration", config, "-showBuildSettings", "-json"], { cwd: root, timeout: 10 * MINUTE });
    const entry = x.code === 0 ? [].concat(parseJson(x.stdout) || []).find((t) => t && t.target === "Runner") : null;
    return { config, s: entry ? entry.buildSettings : null, why: x.code === null ? x.error : lastLine(x.out), unfinished: x.code === null };
  });
  const reads = new Map(envs.filter((env) => project.schemes.includes(env)).map((env) => [env, readEnv(env)]));
  const prodRead = (reads.get(spec.production) || []).find((x) => x.s);
  const prodSet = prodRead ? prodRead.s.ASSETCATALOG_COMPILER_APPICON_NAME : iconSetOf(m, spec.production);
  return [
    list(missing.length ? fail(`missing ${missing.join(", ")}`) : pass(`${project.configurations.length} configurations; schemes ${project.schemes.join(", ")}`)),
    ...envs.map((env) => settings(env, settingsOutcome(ctx, env, reads.get(env), prodSet, pods))),
  ];
}

function settingsOutcome(ctx, env, reads, prodSet, pods) {
  if (!reads) return notRun(`there is no ${env} scheme to read through; config.ios.list names it`);
  if (!reads.length) return notRun(`${env} has no configuration to read; config.ios.list names it`);
  const e = ctx.spec.environments[env];
  const id = iosIdOf(ctx.spec, env);
  const variable = ((ctx.matrix.cell("iosName", env) || {}).value || {}).variable || CONVENTIONS.iosNameSetting;
  const wrong = reads.filter((x) => !x.unfinished).flatMap(({ config, s, why }) => (!s ? [`${config}: -showBuildSettings failed: ${why}`] : [
    ...(s.PRODUCT_BUNDLE_IDENTIFIER === id ? [] : [`${config} PRODUCT_BUNDLE_IDENTIFIER ${s.PRODUCT_BUNDLE_IDENTIFIER || "(unset)"}`]),
    ...(s[variable] === e.name ? [] : [`${config} ${variable} ${s[variable] === undefined ? "(unset)" : JSON.stringify(s[variable])}`]),
    ...iconWrong(ctx, env, s.ASSETCATALOG_COMPILER_APPICON_NAME, prodSet, `${config} ASSETCATALOG_COMPILER_APPICON_NAME`),
    ...(pods && !s.PODS_ROOT ? [`${config} has no PODS_ROOT`] : []),
  ]));
  if (wrong.length) return fail(wrong.join("; ").slice(0, 400));
  const unfinished = reads.filter((x) => x.unfinished);
  if (unfinished.length) return notRun(`${unfinished.map((x) => x.config).join(", ")}: xcodebuild -showBuildSettings did not finish: ${unfinished[0].why}`);
  return pass(`${reads.map((x) => x.config).join(", ")}: ${id}, "${e.name}", ${reads[0].s.ASSETCATALOG_COMPILER_APPICON_NAME}${pods ? ", PODS_ROOT set" : ""}`);
}

// aapt2 from the Android SDK the project builds with: android/local.properties' sdk.dir, else ANDROID_HOME, else
// ANDROID_SDK_ROOT, each from its newest build-tools that has one; else aapt2 on PATH.
function aapt2Of(root, tool, environ) {
  const props = attempt(() => fs.readFileSync(path.join(root, "android", "local.properties"), "utf8"), "");
  const sdkDir = /^sdk\.dir=(.+)$/m.exec(props);
  for (const sdk of [sdkDir && sdkDir[1].trim().replace(/\\(.)/g, "$1"), environ.ANDROID_HOME, environ.ANDROID_SDK_ROOT].filter(Boolean)) {
    const dir = path.join(sdk, "build-tools");
    const versions = attempt(() => fs.readdirSync(dir), []).filter((v) => fs.existsSync(path.join(dir, v, "aapt2")));
    if (versions.length) return { path: path.join(dir, versions.sort((a, b) => a.localeCompare(b, "en", { numeric: true })).pop(), "aapt2") };
  }
  return tool("aapt2");
}

// The artifact a build named ("Built <path>"), else its conventional path; null when neither exists.
const artifact = (root, out, built, fallback) => [(built.exec(out) || [])[1], fallback].filter(Boolean).map((rel) => path.resolve(root, rel)).find((p) => fs.existsSync(p)) || null;

// The CRC-32 of each entry, from the zip's central directory (an APK is a zip); null when the file is not a zip.
function zipCrcs(file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const tail = Buffer.alloc(Math.min(size, 22 + 0xffff));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0 || end + 22 > tail.length) return null;
    const dir = Buffer.alloc(tail.readUInt32LE(end + 12));
    fs.readSync(fd, dir, 0, dir.length, tail.readUInt32LE(end + 16));
    const crcs = new Map();
    for (let at = 0; at + 46 <= dir.length && dir.readUInt32LE(at) === 0x02014b50;) {
      const name = dir.readUInt16LE(at + 28);
      crcs.set(dir.toString("utf8", at + 46, at + 46 + name), dir.readUInt32LE(at + 16));
      at += 46 + name + dir.readUInt16LE(at + 30) + dir.readUInt16LE(at + 32);
    }
    return crcs;
  } finally {
    fs.closeSync(fd);
  }
}

// The launcher icon PNGs aapt2 dump badging names, each with its CRC-32 in the APK.
function launcherIcons(apk, badging) {
  const entries = [...new Set([...badging.matchAll(/^application-icon-\d+:'([^']+\.png)'$/gm)].map((x) => x[1]))];
  const crcs = (entries.length && attempt(() => zipCrcs(apk), null)) || new Map();
  return new Map(entries.filter((e) => crcs.has(e)).map((e) => [e, crcs.get(e)]));
}

const readPlist = (run, plutil, file, root) => {
  const r = run(plutil.path, ["-convert", "json", "-o", "-", file], { cwd: root, timeout: MINUTE });
  return r.code === 0 ? parseJson(r.stdout) : null;
};

// The build tier on Android: each flavor's debug APK, its package and label read back by aapt2. Where Firebase is in
// use and a flavor's google-services.json is CI's, the build must stop with the guard's own message instead.
function androidBuilds({ ctx, root, envs, run, tools }) {
  if (!ctx.facts.gradle.file) return [check("build.android", "build", { platform: "android", expect: "each flavor's debug APK, read back" }, notRun("the project has no Android app"))];
  const aapt2 = tools.aapt2;
  const icons = new Map();
  const builds = envs.map((env) => {
    const e = ctx.spec.environments[env];
    const vars = CONVENTIONS.ciVars(env);
    const guarded = ctx.matrix.firebaseInUse && ctx.facts.gradle.gmsApplied && !ownFirebaseFile(ctx.matrix, "fbAndroid", env);
    const expect = guarded ? `flutter build apk --debug --flavor ${env} fails with the guard's message naming ${vars.android}` : `the ${env} debug APK carries ${e.id} and the label "${e.name}"`;
    const c = (o) => check(`build.android:${env}`, "build", { env, platform: "android", expect }, o);
    if (!tools.flutter) return c(notRun(tools.noFlutter));
    if (!guarded && !aapt2) return c(notRun("no aapt2: no build-tools under android/local.properties' sdk.dir, ANDROID_HOME or ANDROID_SDK_ROOT, and none on PATH"));
    const r = run(tools.flutter.cmd, [...tools.flutter.args, "build", "apk", "--debug", "--flavor", env], { cwd: root, timeout: 30 * MINUTE });
    if (r.code === null) return c(notRun(`flutter build apk did not finish: ${r.error}`));
    if (guarded) return c(r.code !== 0 && r.out.includes("google-services.json is missing") && r.out.includes(vars.android) ? pass("the guard stopped the build and named the file and its CI variable") : fail(r.code === 0 ? `the build passed without ${CONVENTIONS.fbAndroidFile(env)}` : cause(r.out)));
    if (r.code !== 0) return c(fail(cause(r.out)));
    const apk = artifact(root, r.out, /Built (\S+\.apk)/, `build/app/outputs/flutter-apk/app-${env}-debug.apk`);
    if (!apk) return c(notRun("the build passed, but no APK sits where flutter said or under build/app/outputs/flutter-apk"));
    const b = run(aapt2.path, ["dump", "badging", apk], { cwd: root, timeout: 2 * MINUTE });
    if (b.code !== 0) return c(b.code === null ? notRun(`aapt2 did not finish: ${b.error}`) : fail(`aapt2 dump badging: ${lastLine(b.out)}`));
    const id = (/^package: name='([^']*)'/m.exec(b.stdout) || [])[1];
    const label = (/^application-label:'(.*)'$/m.exec(b.stdout) || [])[1];
    icons.set(env, launcherIcons(apk, b.stdout));
    const wrong = [...(id === e.id ? [] : [`package ${id || "(none)"}`]), ...(label === e.name ? [] : [`label ${label === undefined ? "(none)" : JSON.stringify(label)}`])];
    return c(wrong.length ? fail(wrong.join(", ")) : pass(`${id}, "${label}"`));
  });
  return [...builds, iconCheck(ctx, envs, icons)];
}

// Every non-production APK's launcher icon must differ from production's, file by file, read from the APKs this run
// built. A badge changes every density, so one equal file is production's icon on that density's devices.
function iconCheck(ctx, envs, icons) {
  const production = ctx.spec.production;
  const c = (o) => check("build.android.icons", "build", { platform: "android", expect: "every non-production APK's launcher icon differs from production's in every icon file" }, o);
  const others = envs.filter((e) => e !== production && icons.has(e));
  if (!icons.has(production)) return c(notRun(envs.includes(production) ? "production's APK was not built and read in this run" : "production is not built under --env; run the build tier without it to compare the icons"));
  if (!others.length) return c(notRun("no non-production APK was built and read in this run"));
  const prod = icons.get(production);
  if (!prod.size) return c(notRun("aapt2 names no PNG launcher icon in production's APK"));
  const equal = others.map((e) => [e, [...prod].filter(([entry, crc]) => icons.get(e).get(entry) === crc).length]).filter(([, n]) => n);
  if (equal.length) return c(fail(equal.map(([e, n]) => `${e} shows production's launcher icon in ${n} of ${prod.size} files`).join("; ")));
  const unread = others.filter((e) => [...prod.keys()].some((entry) => !icons.get(e).has(entry)));
  if (unread.length) return c(notRun(`${unread.join(", ")} ${unread.length === 1 ? "lacks" : "lack"} an icon file production's APK has, so not every file was compared`));
  return c(pass(`${others.join(", ")} differ from production in all ${prod.size} icon files`));
}

// The build tier on iOS: each flavor's simulator app, its Info.plist read back by plutil, and with Firebase in use the
// GoogleService-Info.plist it bundles. Where a flavor's plist is CI's, the delivery phase must stop the build instead.
function iosBuilds({ ctx, root, envs, run, tools }) {
  if (!ctx.facts.pbxproj.file) return [check("build.ios", "build", { platform: "ios", expect: "each flavor's simulator app, read back" }, notRun("the project has no iOS app"))];
  const m = ctx.matrix;
  const prodSet = iconSetOf(m, ctx.spec.production);
  return envs.flatMap((env) => {
    const e = ctx.spec.environments[env];
    const id = iosIdOf(ctx.spec, env);
    const vars = CONVENTIONS.ciVars(env);
    const guarded = m.firebaseInUse && !ownFirebaseFile(m, "fbIos", env);
    const expect = guarded ? `flutter build ios --simulator --debug --flavor ${env} fails naming the missing GoogleService-Info.plist and ${vars.ios}` : `the ${env} simulator app carries ${id}, the name "${e.name}" and its own icon set`;
    const c = (o) => check(`build.ios:${env}`, "build", { env, platform: "ios", expect }, o);
    if (!tools.xcodebuild) return [c(notRun(NO_XCODE))];
    if (!tools.flutter) return [c(notRun(tools.noFlutter))];
    if (!guarded && !tools.plutil) return [c(notRun("no plutil on PATH to read the built Info.plist"))];
    const r = run(tools.flutter.cmd, [...tools.flutter.args, "build", "ios", "--simulator", "--debug", "--flavor", env], { cwd: root, timeout: 30 * MINUTE });
    if (r.code === null) return [c(notRun(`flutter build ios did not finish: ${r.error}`))];
    if (guarded) return [c(r.code !== 0 && r.out.includes("GoogleService-Info.plist is missing") && r.out.includes(vars.ios) ? pass("the delivery phase stopped the build and named the file and its CI variable") : fail(r.code === 0 ? `the build passed without ${CONVENTIONS.fbIosFile(env)}` : cause(r.out)))];
    if (r.code !== 0) return [c(fail(cause(r.out)))];
    const app = artifact(root, r.out, /Built (\S+\.app)\b/, "build/ios/iphonesimulator/Runner.app");
    if (!app) return [c(notRun("the build passed, but no app sits where flutter said or at build/ios/iphonesimulator/Runner.app"))];
    const info = readPlist(run, tools.plutil, path.join(app, "Info.plist"), root);
    if (!info) return [c(fail(`${path.basename(app)}/Info.plist could not be read`))];
    const icon = ((info.CFBundleIcons || {}).CFBundlePrimaryIcon || {}).CFBundleIconName;
    const wrong = [
      ...(info.CFBundleIdentifier === id ? [] : [`CFBundleIdentifier ${info.CFBundleIdentifier}`]),
      ...(info.CFBundleDisplayName === e.name ? [] : [`CFBundleDisplayName ${JSON.stringify(info.CFBundleDisplayName ?? null)}`]),
      ...iconWrong(ctx, env, icon, prodSet, "CFBundleIconName"),
    ];
    const out = [c(wrong.length ? fail(wrong.join(", ")) : pass(`${id}, "${e.name}", icon ${icon}`))];
    if (m.firebaseInUse) out.push(bundledFirebase({ ctx, root, run, tools }, env, app));
    return out;
  });
}

function bundledFirebase({ ctx, root, run, tools }, env, app) {
  const e = ctx.spec.environments[env];
  const id = iosIdOf(ctx.spec, env);
  const project = typeof e.firebase === "string" ? e.firebase : ((ctx.matrix.cell("fbIos", env) || {}).value || {}).projectId || null;
  const file = path.join(app, "GoogleService-Info.plist");
  const c = (o) => check(`build.ios.firebase:${env}`, "build", { env, platform: "ios", expect: `the app bundles a GoogleService-Info.plist for ${id}${project ? ` in ${project}` : ""}` }, o);
  if (!fs.existsSync(file)) return c(fail(`${path.basename(app)} bundles no GoogleService-Info.plist`));
  const g = readPlist(run, tools.plutil, file, root);
  if (!g) return c(fail("the bundled GoogleService-Info.plist could not be read"));
  const got = `PROJECT_ID ${g.PROJECT_ID}, BUNDLE_ID ${g.BUNDLE_ID}`;
  return c(g.BUNDLE_ID === id && (!project || g.PROJECT_ID === project) ? pass(got) : fail(got));
}

// Gradle leaves its daemon and the Kotlin compile daemon running after a build, each in a session of its own that
// supervise.cjs cannot reach, sized by the app's org.gradle.jvmargs (Flutter's template asks for 8 GB). Left alive they
// starve the iOS builds that follow, so the Android checks stop the daemons that appeared while they ran, and only those.
const DAEMON = /org\.gradle\.launcher\.daemon\.bootstrap\.GradleDaemon|org\.jetbrains\.kotlin\.daemon\.KotlinCompileDaemon/;
function daemons({ run, root, tools }) {
  if (!tools.ps) return new Set();
  const r = run(tools.ps.path, ["axo", "pid=,command="], { cwd: root, timeout: MINUTE });
  return new Set(r.code === 0 ? r.stdout.split("\n").filter((l) => DAEMON.test(l)).map((l) => Number(l.trim().split(/\s+/)[0])) : []);
}
const stopsNewDaemons = (checks) => (s) => {
  const before = daemons(s);
  try { return checks(s); } finally { for (const pid of daemons(s)) if (!before.has(pid)) attempt(() => s.kill(pid, "SIGTERM")); }
};

// Each tier's checks, in the order they run. A tier runs every tier before it in TIERS, so nothing builds below `build`.
const LADDER = Object.freeze({
  static: [staticChecks, pbxprojCheck],
  config: [stopsNewDaemons(androidChecks), dartCheck, makeChecks, iosChecks],
  build: [stopsNewDaemons(androidBuilds), iosBuilds],
});

// -> { schema, tier, checks }. `run`, `tool` and `environ` are injectable, so tests drive fake tools; `validate` is the
// pbxproj validator, which envs.cjs passes in because verify may not require a writer.
function verify(ctx, ev, { tier = "config", env = null, run = exec, tool = (name) => ctx.io.tool(name), validate = null, environ = process.env, kill = (pid, signal) => process.kill(pid, signal) } = {}) {
  const root = ctx.io.root;
  // A .fvmrc pin runs only through fvm: the flutter on PATH may be another SDK, and a pass there proves nothing.
  const pinned = !!ctx.facts.envfiles.pin && ctx.facts.envfiles.pin.via === ".fvmrc";
  const fvm = pinned && tool("fvm");
  const flutter = fvm ? { cmd: fvm.path, args: ["flutter"] } : !pinned && tool("flutter") ? { cmd: tool("flutter").path, args: [] } : null;
  const tools = {
    flutter, noFlutter: pinned ? "the project pins Flutter in .fvmrc and no fvm is on PATH" : "no flutter on PATH",
    make: tool("make"), git: tool("git"), ps: tool("ps"), plutil: tool("plutil"), xcodebuild: tool("xcodebuild"),
    get aapt2() { return aapt2Of(root, tool, environ); },
  };
  const s = { ctx, ev, root, envs: Object.keys(ctx.spec.environments).filter((e) => !env || e === env), run, tools, validate, kill };
  return { schema: 1, tier, checks: TIERS.slice(0, TIERS.indexOf(tier) + 1).flatMap((t) => LADDER[t].flatMap((f) => f(s))) };
}

module.exports = { verify, exec, zipCrcs };
