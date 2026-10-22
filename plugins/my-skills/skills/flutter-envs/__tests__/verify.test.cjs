"use strict";
// verify's tiers against fake gradlew, flutter, fvm, make, plutil, xcodebuild and aapt2: each check reads pass, fail or
// not-run with a reason, offline Gradle and missing tools are not-run (never pass, never fail), the guard proofs expect
// the guard's own message where a file is CI-provided, nothing builds below --tier build, and the CLI exits 1 on a
// failed check.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { materialize, bundle } = require("./helpers/project.cjs");
const { drop, PBX } = require("./helpers/edit.cjs");
const { fakeTools, zip } = require("./helpers/fake-tools.cjs");
const { tempDir } = require("./helpers/firebase/fake.cjs");
const { checkProject, run } = require("../scripts/envs.cjs");
const { verify, exec, zipCrcs } = require("../scripts/verify.cjs");
const { validate } = require("../scripts/writers/pbxproj.cjs");

const ENVS = path.join(__dirname, "..", "scripts", "envs.cjs");
const VARIANTS = ["Dev", "Staging", "Production"].flatMap((e) => ["Debug", "Profile", "Release"].map((m) => `assemble${e}${m} - Assembles main output for variant ${e.toLowerCase()}${m}`)).join("\n");
const TOOLS = { flutter: { path: "/fake/flutter" }, make: { path: "/fake/make" }, fvm: { path: "/fake/fvm" } };
const MAC = { ...TOOLS, xcodebuild: { path: "/fake/xcodebuild" }, plutil: { path: "/fake/plutil" } };
const IDS = { dev: "com.acme.shop.dev", staging: "com.acme.shop.staging", production: "com.acme.shop" };
const NAMES = { dev: "Shop Dev", staging: "Shop Staging", production: "Shop" };
const SETS = { dev: "AppIcon-dev", staging: "AppIcon-staging", production: "AppIcon" };
const PROJECTS = { dev: "acme-dev-staging", staging: "acme-dev-staging", production: "acme-prod" };
const CONFIGS = Object.keys(IDS).flatMap((env) => ["Debug", "Profile", "Release"].map((mode) => `${mode}-${env}`));
const envOf = (key, re = /--flavor (\w+)/) => re.exec(key)[1];

// A fake runner: answers by tool and arguments, the last matching pattern winning so a later key overrides a spread
// one; stdout defaults to the output. Records every call.
function fake(answers = {}) {
  const calls = [];
  const runner = (cmd, args, opts) => {
    calls.push({ cmd: path.basename(cmd), path: cmd, args, cwd: opts.cwd, timeout: opts.timeout });
    const key = `${path.basename(cmd)} ${args.join(" ")}`;
    const hit = Object.entries(answers).reverse().find(([pattern]) => new RegExp(pattern).test(key));
    if (!hit) return { code: 0, out: "", stdout: "" };
    const a = typeof hit[1] === "function" ? hit[1](key, opts) : hit[1];
    return { stdout: a.out, ...a };
  };
  return { runner, calls };
}

// What a Mac answers for a configured app: plutil, --config-only, and Xcode's list and settings, which
// `change(env, config, settings)` may edit.
function mac(change = () => {}) {
  return {
    "plutil -lint": { code: 0, out: "ios/Runner.xcodeproj/project.pbxproj: OK\nios/Runner/Info.plist: OK\n" },
    "flutter build ios --config-only --flavor (\\w+)": (key) => ({ code: 0, out: `Running pod install...\nBuilding ${IDS[envOf(key)]} for device (ios-release)...\n` }),
    "xcodebuild -list -json": { code: 0, out: JSON.stringify({ project: { configurations: CONFIGS, name: "Runner", schemes: Object.keys(IDS), targets: ["Runner", "RunnerTests"] } }) },
    "xcodebuild .*-showBuildSettings -json": (key) => {
      const [, env, config] = / -scheme (\w+) -configuration (\S+) /.exec(key);
      const s = { PRODUCT_BUNDLE_IDENTIFIER: IDS[env], DISPLAY_NAME: NAMES[env], ASSETCATALOG_COMPILER_APPICON_NAME: SETS[env], PODS_ROOT: "/tmp/app/ios/Pods" };
      change(env, config, s);
      return { code: 0, out: JSON.stringify([{ action: "build", target: "RunnerTests", buildSettings: {} }, { action: "build", target: "Runner", buildSettings: s }]) };
    },
  };
}

// What the builds leave and the readers answer: an APK whose launcher icons are `icon(env)`, a simulator app, its
// Info.plist and bundled GoogleService-Info.plist, each read back as `info(env)` and `google(env)`.
function builds(dir, { icon = (env) => `${env} pixels`, info = (env) => ({}), google = (env) => ({}) } = {}) {
  const app = path.join(dir, "build/ios/iphonesimulator/Runner.app");
  const built = () => fs.readFileSync(path.join(app, "Info.plist"), "utf8");
  return {
    "flutter build apk --debug --flavor (\\w+)": (key) => {
      const env = envOf(key);
      const rel = `build/app/outputs/flutter-apk/app-${env}-debug.apk`;
      fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), zip({ "AndroidManifest.xml": env, "res/mipmap-mdpi-v4/ic_launcher.png": icon(env), "res/mipmap-xhdpi-v4/ic_launcher.png": `${icon(env)} 2x` }));
      return { code: 0, out: `Running Gradle task 'assemble${env}Debug'...\n✓ Built ${rel} (61.2MB)\n` };
    },
    "aapt2 dump badging .*app-(\\w+)-debug\\.apk": (key) => {
      const env = envOf(key, /app-(\w+)-debug/);
      return { code: 0, out: `package: name='${IDS[env]}' versionCode='1' versionName='1.0.0'\napplication-label:'${NAMES[env]}'\napplication-icon-160:'res/mipmap-mdpi-v4/ic_launcher.png'\napplication-icon-320:'res/mipmap-xhdpi-v4/ic_launcher.png'\n` };
    },
    "flutter build ios --simulator --debug --flavor (\\w+)": (key) => {
      fs.mkdirSync(app, { recursive: true });
      fs.writeFileSync(path.join(app, "Info.plist"), envOf(key));
      fs.writeFileSync(path.join(app, "GoogleService-Info.plist"), envOf(key));
      return { code: 0, out: "Building com.acme.shop for simulator (ios)...\n✓ Built build/ios/iphonesimulator/Runner.app\n" };
    },
    "plutil -convert json -o - .*Runner\\.app/Info\\.plist": () => {
      const env = built();
      return { code: 0, out: JSON.stringify({ CFBundleIdentifier: IDS[env], CFBundleDisplayName: NAMES[env], CFBundleIcons: { CFBundlePrimaryIcon: { CFBundleIconName: SETS[env] } }, ...info(env) }) };
    },
    "plutil -convert json -o - .*Runner\\.app/GoogleService-Info\\.plist": () => {
      const env = built();
      return { code: 0, out: JSON.stringify({ PROJECT_ID: PROJECTS[env], BUNDLE_ID: IDS[env], ...google(env) }) };
    },
  };
}

// An Android SDK holding an (empty) aapt2 under each build-tools version.
function sdkWith(t, versions) {
  const sdk = tempDir(t, "fake-sdk-");
  for (const v of versions) {
    fs.mkdirSync(path.join(sdk, "build-tools", v), { recursive: true });
    fs.writeFileSync(path.join(sdk, "build-tools", v, "aapt2"), "");
  }
  return sdk;
}

const project = (base = "configured-flutter-3.47", mutate) => {
  const dir = materialize(base, mutate);
  fs.writeFileSync(path.join(dir, "android", "gradlew"), "#!/bin/sh\n", { mode: 0o755 });
  return { dir, ...checkProject(dir) };
};
const byId = (result) => Object.fromEntries(result.checks.map((c) => [c.id, c]));
const flutterBuilds = (calls) => calls.filter((c) => c.cmd === "flutter" && c.args[0] === "build" && !c.args.includes("--config-only"));

test("static tier: a configured app passes every static check it can run, and runs no tool", () => {
  const { ctx, ev } = project();
  const f = fake();
  const r = byId(verify(ctx, ev, { tier: "static", run: f.runner, tool: () => null, validate }));
  for (const id of ["static.banner", "static.matrix", "static.ignore", "static.isolation", "static.env-native", "static.pbxproj"]) assert.strictEqual(r[id].result, "pass", id);
  assert.ok(Object.keys(r).every((id) => id.startsWith("static.")), "static runs only static checks");
  assert.deepStrictEqual(f.calls, [], "static runs no tool");
});

test("static tier: an unset project fails the banner check and reads the Firebase checks as not-run", () => {
  const { ctx, ev } = project("pristine-flutter-3.47");
  const r = byId(verify(ctx, ev, { tier: "static", tool: () => null, validate }));
  assert.strictEqual(r["static.banner"].result, "fail");
  assert.strictEqual(r["static.isolation"].result, "not-run");
  assert.match(r["static.isolation"].why, /not in use/);
});

test("static.pbxproj fails a structural fault the commit lacks, passes one the commit already had, and the CLI passes it the validator", () => {
  const planted = bundle("configured-flutter-3.47")[PBX].replace("children = (", "children = (\n\t\t\t\tDEADBEEFDEADBEEFDEADBEEF,");
  const gitOnly = (name) => (name === "git" ? { path: "git" } : null);
  const fresh = materialize("configured-flutter-3.47", () => ({ post: { [PBX]: planted } }));
  const a = checkProject(fresh);
  const r = byId(verify(a.ctx, a.ev, { tier: "static", tool: gitOnly, validate }));
  assert.deepStrictEqual([r["static.pbxproj"].result, r["static.pbxproj"].got], ["fail", "dangling id DEADBEEFDEADBEEFDEADBEEF"]);
  const committed = materialize("configured-flutter-3.47", (f) => { f[PBX] = planted; });
  const b = checkProject(committed);
  assert.deepStrictEqual(Object.values(byId(verify(b.ctx, b.ev, { tier: "static", tool: gitOnly, validate }))["static.pbxproj"]).slice(-2), ["pass", "no fault the committed copy lacks"], "the commit already had it, so it is the owner's");
  const out = [];
  assert.strictEqual(run(["verify", "--tier", "static"], { cwd: fresh, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } }), 1);
  assert.match(out.join(""), /^ {2}fail {5}static\.pbxproj +dangling id DEADBEEFDEADBEEFDEADBEEF$/m);
});

test("config tier: every variant listed, the banner test, make -n and the guard proof all pass on a configured app", () => {
  const { ctx, ev } = project("configured-flutter-3.47", (f) => drop(f, "android/app/src/production/google-services.json"));
  const f = fake({
    "gradlew --offline :app:tasks --all": { code: 0, out: VARIANTS },
    "gradlew --offline :app:processProductionDebugGoogleServices": { code: 1, out: "> android/app/src/production/google-services.json is missing. CI writes it from GOOGLE_SERVICES_JSON_PRODUCTION; locally, run /flutter-envs." },
    "flutter test test/env_banner_test.dart": { code: 0, out: "00:01 +0: loading\n00:02 +6: All tests passed!" },
    "make -n run-debug env=(\\w+)": (key) => { const env = /env=(\w+)/.exec(key)[1]; return { code: 0, out: `flutter run  --flavor ${env} -t lib/main.dart --dart-define-from-file=env/${env}.json \n` }; },
  });
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => TOOLS[n] || null }));
  assert.strictEqual(r["config.android.variants"].result, "pass");
  assert.strictEqual(r["config.android.firebase:dev"].result, "pass");
  assert.strictEqual(r["config.android.firebase:production"].result, "pass", "the guard stopped production, as it should");
  assert.match(r["config.android.firebase:production"].got, /guard stopped/);
  assert.strictEqual(r["config.dart.banner-test"].result, "pass");
  assert.strictEqual(r["config.dart.banner-test"].got, "+6: All tests passed!");
  for (const env of ["dev", "staging", "production"]) assert.strictEqual(r[`config.make:${env}`].result, "pass", env);
  for (const id of ["config.ios.plutil", "config.ios.config-only:dev", "config.ios.list", "config.ios.settings:dev"]) assert.strictEqual(r[id].result, "not-run", `${id} without plutil or xcodebuild`);
  assert.ok(f.calls.every((c) => c.cmd !== "gradlew" || c.args[0] === "--offline"), "Gradle runs offline only");
});

test("config tier: a missing variant, a failing banner test, a guard that let the build through and a wrong make line all fail", () => {
  const { ctx, ev } = project("configured-flutter-3.47", (f) => drop(f, "android/app/src/production/google-services.json"));
  const f = fake({
    "gradlew --offline :app:tasks --all": { code: 0, out: VARIANTS.replace(/^assembleStagingRelease.*$/m, "") },
    "gradlew --offline :app:processProductionDebugGoogleServices": { code: 0, out: "BUILD SUCCESSFUL" },
    "flutter test": { code: 1, out: "00:02 +5 -1: Some tests failed." },
    "make -n": { code: 0, out: "flutter run -t lib/main.dart\n" },
  });
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => TOOLS[n] || null }));
  assert.strictEqual(r["config.android.variants"].result, "fail");
  assert.match(r["config.android.variants"].got, /assembleStagingRelease/);
  assert.strictEqual(r["config.android.firebase:production"].result, "fail");
  assert.match(r["config.android.firebase:production"].got, /passed without android\/app\/src\/production\/google-services\.json/);
  assert.deepStrictEqual([r["config.dart.banner-test"].result, r["config.dart.banner-test"].got], ["fail", "+5 -1: Some tests failed."]);
  assert.strictEqual(r["config.make:dev"].result, "fail");
});

test("config and build tiers: Gradle that cannot run offline and tools that are missing read not-run with the reason, never pass", () => {
  const { ctx, ev } = project();
  const f = fake({ "gradlew --offline": { code: 1, out: "Could not resolve com.android.tools.build:gradle:9.1.0.\n> No cached version of com.android.tools.build:gradle:9.1.0 available for offline mode." } });
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: () => null }));
  assert.strictEqual(r["config.android.variants"].result, "not-run");
  assert.match(r["config.android.variants"].why, /offline/);
  assert.strictEqual(r["config.dart.banner-test"].result, "not-run");
  assert.match(r["config.dart.banner-test"].why, /no flutter on PATH/);
  assert.strictEqual(r["config.make:dev"].result, "not-run");
  assert.match(r["config.ios.plutil"].why, /no plutil on PATH/);
  for (const id of ["config.ios.config-only:dev", "config.ios.list", "config.ios.settings:production"]) assert.match(r[id].why, /no xcodebuild on PATH/, id);
  assert.ok(Object.values(r).filter((c) => c.result === "pass").every((c) => c.tier === "static"), "nothing that did not run reads pass");
  const b = byId(verify(ctx, ev, { tier: "build", run: f.runner, tool: () => null, environ: {} }));
  assert.match(b["build.android:dev"].why, /no flutter on PATH/);
  assert.match(b["build.ios:dev"].why, /no xcodebuild on PATH/);
  assert.strictEqual(b["build.android.icons"].result, "not-run");
  assert.ok(Object.values(b).filter((c) => c.result === "pass").every((c) => c.tier === "static"), "nothing that did not run reads pass");
});

test("config tier: a Gradle failure that is not about the offline cache is a fail, and a missing gradlew is made with --config-only", () => {
  const dir = materialize("configured-flutter-3.47");
  const { ctx, ev } = checkProject(dir);
  const f = fake({
    "flutter build apk --config-only --flavor dev": () => { fs.writeFileSync(path.join(dir, "android", "gradlew"), "#!/bin/sh\n", { mode: 0o755 }); return { code: 0, out: "Config complete." }; },
    "gradlew --offline :app:tasks": { code: 1, out: "Script compilation error:\n  Line 33: flavorDimensions += \"env\"\n" },
  });
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => TOOLS[n] || null }));
  assert.ok(f.calls.some((c) => c.cmd === "flutter" && c.args.includes("--config-only")), "gradlew was created through flutter");
  assert.strictEqual(r["config.android.variants"].result, "fail");
});

test("with .fvmrc, flutter runs through fvm, the banner test and the iOS --config-only alike", () => {
  const { ctx, ev } = project("configured-flutter-3.47", (f) => { f[".fvmrc"] = '{\n  "flutter": "3.47.4"\n}\n'; });
  const f = fake({ "fvm flutter test": { code: 0, out: "00:02 +6: All tests passed!" }, "fvm flutter build ios --config-only --flavor (\\w+)": (key) => ({ code: 0, out: `Building ${IDS[envOf(key)]} for device (ios-release)...\n` }) });
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => MAC[n] || null }));
  assert.strictEqual(r["config.dart.banner-test"].result, "pass");
  assert.ok(f.calls.some((c) => c.cmd === "fvm" && c.args[0] === "flutter" && c.args[1] === "test"));
  assert.strictEqual(r["config.ios.config-only:staging"].result, "pass");
  assert.ok(!f.calls.some((c) => c.cmd === "flutter"), "no flutter outside fvm");
});

test("with .fvmrc and no fvm on PATH, every flutter check reads not-run instead of running another SDK", () => {
  const { ctx, ev } = project("configured-flutter-3.47", (f) => { f[".fvmrc"] = '{\n  "flutter": "3.47.4"\n}\n'; });
  const f = fake(mac());
  const r = byId(verify(ctx, ev, { tier: "build", run: f.runner, tool: (n) => (n === "fvm" ? null : MAC[n] || null), environ: {} }));
  for (const id of ["config.dart.banner-test", "config.ios.config-only:dev", "build.android:dev", "build.ios:dev"]) assert.match(r[id].why, /pins Flutter in \.fvmrc and no fvm is on PATH/, id);
  assert.ok(!f.calls.some((c) => c.cmd === "flutter"), "the flutter on PATH never runs");
});

test("config tier, iOS: plutil, --config-only per flavor, then xcodebuild -list and every configuration's settings pass", () => {
  const { ctx, ev } = project();
  const f = fake(mac());
  const r = verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => MAC[n] || null });
  assert.deepStrictEqual(r.checks.filter((c) => c.platform === "ios" && c.tier === "config").map((c) => [c.id, c.result]), [
    ["config.ios.plutil", "pass"], ["config.ios.config-only:dev", "pass"], ["config.ios.config-only:staging", "pass"], ["config.ios.config-only:production", "pass"],
    ["config.ios.list", "pass"], ["config.ios.settings:dev", "pass"], ["config.ios.settings:staging", "pass"], ["config.ios.settings:production", "pass"],
  ]);
  const got = byId(r);
  const [read, values] = got["config.ios.settings:dev"].got.split(": ");
  assert.deepStrictEqual([read.split(", ").sort(), values], [["Debug-dev", "Profile-dev", "Release-dev"], 'com.acme.shop.dev, "Shop Dev", AppIcon-dev']);
  assert.strictEqual(got["config.ios.config-only:production"].got, "Building com.acme.shop for device");
  assert.ok(f.calls.filter((c) => c.args.includes("--config-only")).every((c) => c.timeout >= 30 * 60 * 1000), "--config-only runs pod install, which a cold CocoaPods cache can make slower than a quarter of an hour");
  const order = f.calls.map((c) => (c.args.includes("--config-only") ? "configure" : c.args.includes("-showBuildSettings") ? "settings" : null)).filter(Boolean);
  assert.ok(order.lastIndexOf("configure") < order.indexOf("settings"), "pod install and Generated.xcconfig come before Xcode is asked");
  assert.strictEqual(order.filter((o) => o === "settings").length, 9, "every configuration of every flavor is read");
});

test("config tier, iOS: the display name is read from the variable Info.plist uses, not DISPLAY_NAME by default", () => {
  const { ctx, ev } = project("configured-flutter-3.47", (f) => { f["ios/Runner/Info.plist"] = f["ios/Runner/Info.plist"].replace("$(DISPLAY_NAME)", "$(APP_DISPLAY_NAME)"); });
  const f = fake(mac((env, config, s) => { s.APP_DISPLAY_NAME = s.DISPLAY_NAME; s.DISPLAY_NAME = "stale"; }));
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => MAC[n] || null }));
  assert.strictEqual(r["config.ios.settings:staging"].result, "pass", r["config.ios.settings:staging"].got);
  const g = fake(mac((env, config, s) => { s.APP_DISPLAY_NAME = "Shop"; }));
  assert.match(byId(verify(ctx, ev, { tier: "config", run: g.runner, tool: (n) => MAC[n] || null }))["config.ios.settings:dev"].got, /Debug-dev APP_DISPLAY_NAME "Shop"/);
});

test("config tier, iOS: a wrong id or name, production's or a missing icon set, a missing PODS_ROOT, a missing scheme and a failed --config-only each fail", () => {
  const pods = project("configured-flutter-3.41-pods");
  const f = fake(mac((env, config, s) => {
    if (config === "Release-dev") s.PRODUCT_BUNDLE_IDENTIFIER = "com.acme.shop";
    if (config === "Debug-staging") s.ASSETCATALOG_COMPILER_APPICON_NAME = "AppIcon";
    if (config === "Release-staging") s.ASSETCATALOG_COMPILER_APPICON_NAME = "AppIcon-qa";
    if (config === "Debug-production") delete s.PODS_ROOT;
    if (config === "Profile-production") s.DISPLAY_NAME = "Shop Dev";
  }));
  const r = byId(verify(pods.ctx, pods.ev, { tier: "config", run: f.runner, tool: (n) => MAC[n] || null }));
  assert.deepStrictEqual([r["config.ios.settings:dev"].result, r["config.ios.settings:dev"].got], ["fail", "Release-dev PRODUCT_BUNDLE_IDENTIFIER com.acme.shop"]);
  assert.strictEqual(r["config.ios.settings:staging"].got, "Debug-staging ASSETCATALOG_COMPILER_APPICON_NAME AppIcon is production's; Release-staging ASSETCATALOG_COMPILER_APPICON_NAME AppIcon-qa names no icon set in the asset catalog");
  assert.strictEqual(r["config.ios.settings:production"].got, 'Debug-production has no PODS_ROOT; Profile-production DISPLAY_NAME "Shop Dev"');
  const g = fake({
    ...mac(),
    "plutil -lint": { code: 1, out: "ios/Runner.xcodeproj/project.pbxproj: Unexpected character { at line 1\nios/Runner/Info.plist: OK\n" },
    "xcodebuild -list -json": { code: 0, out: JSON.stringify({ project: { configurations: CONFIGS.filter((c) => c !== "Profile-staging"), schemes: ["production", "staging"] } }) },
    "flutter build ios --config-only --flavor dev": { code: 1, out: "The Xcode project does not define custom schemes. You cannot use the --flavor option.\n" },
    "flutter build ios --config-only --flavor staging": { code: 0, out: "Building com.acme.shop.dev for device (ios-release)...\n" },
  });
  const q = byId(verify(pods.ctx, pods.ev, { tier: "config", run: g.runner, tool: (n) => MAC[n] || null }));
  assert.deepStrictEqual([q["config.ios.plutil"].result, q["config.ios.plutil"].got], ["fail", "project.pbxproj: Unexpected character { at line 1, Info.plist: OK"]);
  assert.deepStrictEqual([q["config.ios.list"].result, q["config.ios.list"].got], ["fail", "missing the dev scheme, a Profile configuration for staging"]);
  assert.deepStrictEqual([q["config.ios.settings:dev"].result, q["config.ios.settings:staging"].result], ["not-run", "pass"]);
  assert.deepStrictEqual([q["config.ios.config-only:dev"].result, q["config.ios.config-only:dev"].got], ["fail", "The Xcode project does not define custom schemes. You cannot use the --flavor option."]);
  assert.deepStrictEqual([q["config.ios.config-only:staging"].result, q["config.ios.config-only:staging"].got], ["fail", "it configures com.acme.shop.dev"]);
  const h = fake({ ...mac(), "xcodebuild -list -json": { code: 70, out: "xcodebuild: error: 'ios/Runner.xcodeproj' does not exist.\n" } });
  const x = byId(verify(pods.ctx, pods.ev, { tier: "config", run: h.runner, tool: (n) => MAC[n] || null }));
  assert.deepStrictEqual([x["config.ios.list"].result, x["config.ios.settings:dev"].result, x["config.ios.settings:dev"].why], ["fail", "not-run", "xcodebuild -list did not answer"]);
  const odd = fake({ ...mac(), "xcodebuild -list -json": { code: 0, out: '{ "project": { "name": "Runner" } }' } });
  const y = byId(verify(pods.ctx, pods.ev, { tier: "config", run: odd.runner, tool: (n) => MAC[n] || null }));
  assert.deepStrictEqual([y["config.ios.list"].result, y["config.ios.list"].got], ["fail", "xcodebuild -list: no schemes and configurations in its JSON"]);
});

test("build tier: each flavor's APK and simulator app are built and read back, and the launcher icons differ", (t) => {
  const { dir, ctx, ev } = project();
  const f = fake({ ...mac(), ...builds(dir) });
  const r = byId(verify(ctx, ev, { tier: "build", run: f.runner, tool: (n) => MAC[n] || null, environ: { ANDROID_HOME: sdkWith(t, ["9.0.0", "36.0.0", "35.0.3"]) } }));
  for (const env of Object.keys(IDS)) {
    for (const id of [`build.android:${env}`, `build.ios:${env}`, `build.ios.firebase:${env}`]) assert.strictEqual(r[id].result, "pass", `${id}: ${r[id].got || r[id].why}`);
  }
  assert.strictEqual(r["build.android:dev"].got, 'com.acme.shop.dev, "Shop Dev"');
  assert.strictEqual(r["build.ios:staging"].got, 'com.acme.shop.staging, "Shop Staging", icon AppIcon-staging');
  assert.strictEqual(r["build.ios.firebase:production"].got, "PROJECT_ID acme-prod, BUNDLE_ID com.acme.shop");
  assert.deepStrictEqual([r["build.android.icons"].result, r["build.android.icons"].got], ["pass", "dev, staging differ from production in all 2 icon files"]);
  const aapt2 = f.calls.filter((c) => c.cmd === "aapt2").map((c) => path.basename(path.dirname(c.path)));
  assert.deepStrictEqual([...new Set(aapt2)], ["36.0.0"], "the newest build-tools by version, not by name");
});

test("build tier: a wrong package, label, id, name or icon, an unbundled plist, a shared launcher icon and a missing APK each fail or read not-run", (t) => {
  const { dir, ctx, ev } = project();
  const f = fake({
    ...mac(),
    ...builds(dir, {
      icon: (env) => (env === "staging" ? "production pixels" : `${env} pixels`),
      info: (env) => (env === "dev" ? { CFBundleDisplayName: "Shop", CFBundleIcons: { CFBundlePrimaryIcon: { CFBundleIconName: "AppIcon" } } } : {}),
      google: (env) => (env === "staging" ? { BUNDLE_ID: "com.acme.shop.dev" } : {}),
    }),
    "aapt2 dump badging .*app-dev-debug\\.apk": { code: 0, out: "package: name='com.acme.shop' versionCode='1'\napplication-label:'Joe's Shop'\napplication-icon-160:'res/mipmap-mdpi-v4/ic_launcher.png'\n" },
  });
  const r = byId(verify(ctx, ev, { tier: "build", run: f.runner, tool: (n) => MAC[n] || null, environ: { ANDROID_HOME: sdkWith(t, ["35.0.0"]) } }));
  assert.deepStrictEqual([r["build.android:dev"].result, r["build.android:dev"].got], ["fail", 'package com.acme.shop, label "Joe\'s Shop"']);
  assert.deepStrictEqual([r["build.ios:dev"].result, r["build.ios:dev"].got], ["fail", 'CFBundleDisplayName "Shop", CFBundleIconName AppIcon is production\'s']);
  assert.deepStrictEqual([r["build.ios.firebase:staging"].result, r["build.ios.firebase:staging"].got], ["fail", "PROJECT_ID acme-dev-staging, BUNDLE_ID com.acme.shop.dev"]);
  assert.deepStrictEqual([r["build.android.icons"].result, r["build.android.icons"].got], ["fail", "staging shows production's launcher icon in 2 of 2 files"]);
  const lost = fake({ ...mac(), ...builds(dir), "flutter build apk --debug --flavor dev": { code: 0, out: "✓ Built build/app/outputs/flutter-apk/app-dev-debug.apk\n" } });
  fs.rmSync(path.join(dir, "build"), { recursive: true, force: true });
  const n = byId(verify(ctx, ev, { tier: "build", env: "dev", run: lost.runner, tool: (x) => MAC[x] || null, environ: { ANDROID_HOME: sdkWith(t, ["35.0.0"]) } }));
  assert.match(n["build.android:dev"].why, /no APK sits where flutter said/);
  assert.match(n["build.android.icons"].why, /production is not built under --env/);
});

test("build tier: an APK whose icon files cannot all be compared reads not-run, never pass", (t) => {
  const { dir, ctx, ev } = project();
  const f = fake({ ...mac(), ...builds(dir), "aapt2 dump badging .*app-staging-debug\\.apk": { code: 0, out: "package: name='com.acme.shop.staging' versionCode='1'\napplication-label:'Shop Staging'\napplication-icon-65534:'res/mipmap-anydpi-v26/ic_launcher.xml'\n" } });
  const r = byId(verify(ctx, ev, { tier: "build", run: f.runner, tool: (n) => MAC[n] || null, environ: { ANDROID_HOME: sdkWith(t, ["35.0.0"]) } }));
  assert.strictEqual(r["build.android:staging"].result, "pass");
  assert.deepStrictEqual([r["build.android.icons"].result, r["build.android.icons"].why], ["not-run", "staging lacks an icon file production's APK has, so not every file was compared"]);
});

test("build tier: where production's Firebase files are CI's, both of its builds must stop with the guard's own message", (t) => {
  const { dir, ctx, ev } = project("configured-flutter-3.47", (f) => { drop(f, "android/app/src/production/google-services.json"); drop(f, "ios/config/production/GoogleService-Info.plist"); });
  const stopped = {
    "flutter build apk --debug --flavor production": { code: 1, out: "FAILURE: Build failed with an exception.\n* What went wrong:\nandroid/app/src/production/google-services.json is missing. CI writes it from GOOGLE_SERVICES_JSON_PRODUCTION; locally, run /flutter-envs.\n" },
    "flutter build ios --simulator --debug --flavor production": { code: 1, out: "Error (Xcode): error: /tmp/app/ios/config/production/GoogleService-Info.plist is missing. CI writes it from GOOGLE_SERVICE_INFO_PLIST_PRODUCTION; locally, run /flutter-envs.\n\nFailed to build iOS app\n" },
  };
  const environ = { ANDROID_HOME: sdkWith(t, ["35.0.0"]) };
  const r = byId(verify(ctx, ev, { tier: "build", env: "production", run: fake({ ...mac(), ...stopped }).runner, tool: (n) => MAC[n] || null, environ }));
  assert.deepStrictEqual([r["build.android:production"].result, r["build.ios:production"].result], ["pass", "pass"]);
  assert.match(r["build.ios:production"].got, /delivery phase stopped the build/);
  assert.strictEqual(r["build.ios.firebase:production"], undefined, "no app was built to read");
  assert.match(r["build.android.icons"].why, /production's APK was not built/);
  const through = byId(verify(ctx, ev, { tier: "build", env: "production", run: fake({ ...mac(), ...builds(dir) }).runner, tool: (n) => MAC[n] || null, environ }));
  assert.deepStrictEqual([through["build.android:production"].result, through["build.android:production"].got], ["fail", "the build passed without android/app/src/production/google-services.json"]);
  assert.deepStrictEqual([through["build.ios:production"].result, through["build.ios:production"].got], ["fail", "the build passed without ios/config/production/GoogleService-Info.plist"]);
});

test("build tier: aapt2 comes from android/local.properties before ANDROID_HOME, and without any SDK nothing is built for nothing", (t) => {
  const { dir, ctx, ev } = project();
  const own = sdkWith(t, ["34.0.0"]);
  fs.writeFileSync(path.join(dir, "android", "local.properties"), `sdk.dir=${own}\nflutter.sdk=/tmp/flutter\n`);
  const f = fake({ ...mac(), ...builds(dir) });
  verify(ctx, ev, { tier: "build", env: "dev", run: f.runner, tool: (n) => MAC[n] || null, environ: { ANDROID_HOME: sdkWith(t, ["36.0.0"]) } });
  assert.deepStrictEqual([...new Set(f.calls.filter((c) => c.cmd === "aapt2").map((c) => c.path))], [path.join(own, "build-tools", "34.0.0", "aapt2")]);
  fs.rmSync(path.join(dir, "android", "local.properties"));
  const g = fake({ ...mac(), ...builds(dir) });
  const r = byId(verify(ctx, ev, { tier: "build", env: "dev", run: g.runner, tool: (n) => MAC[n] || null, environ: {} }));
  assert.match(r["build.android:dev"].why, /no aapt2/);
  assert.ok(!g.calls.some((c) => c.args.join(" ").startsWith("build apk --debug")), "no APK is built when nothing could read it");
});

test("build consent: static runs nothing, config builds no APK and no app, and only --tier build does", (t) => {
  const { dir, ctx, ev } = project();
  const environ = { ANDROID_HOME: sdkWith(t, ["35.0.0"]) };
  const ran = (tier) => { const f = fake({ ...mac(), ...builds(dir) }); verify(ctx, ev, { tier, run: f.runner, tool: (n) => MAC[n] || null, validate, environ }); return f.calls; };
  assert.deepStrictEqual(ran("static"), [], "static runs no tool");
  assert.deepStrictEqual(flutterBuilds(ran("config")), [], "config runs only --config-only builds");
  assert.deepStrictEqual(flutterBuilds(ran("build")).map((c) => `${c.args[1]} ${c.args.at(-1)}`), ["apk dev", "apk staging", "apk production", "ios dev", "ios staging", "ios production"]);
});

test("the CLI verifies at the config tier by default and builds only on --tier build, with fake tools first on PATH", (t) => {
  const app = materialize("configured-flutter-3.47");
  const fakes = fakeTools(t, [{ tool: "xcodebuild", match: "-list", stdout: JSON.stringify({ project: { configurations: CONFIGS, schemes: Object.keys(IDS) } }) }]);
  fakes.install(path.join(app, "android", "gradlew"));
  const verifyRun = (...args) => JSON.parse(spawnSync(process.execPath, [ENVS, "verify", "--json", ...args], { cwd: app, env: fakes.env, encoding: "utf8" }).stdout);
  const builtBy = (calls) => calls.filter(([tool, verb, ...rest]) => tool === "flutter" && verb === "build" && !rest.includes("--config-only")).map(([, , kind]) => kind);
  const config = verifyRun();
  assert.strictEqual(config.tier, "config");
  assert.deepStrictEqual(builtBy(fakes.calls()), [], "the default tier builds nothing");
  assert.ok(fakes.calls().some(([tool, ...args]) => tool === "flutter" && args.join(" ") === "build ios --config-only --flavor dev"), "the config tier reached the fake flutter on PATH");
  assert.ok(fakes.calls().some(([tool, ...args]) => tool === "xcodebuild" && args[0] === "-list"), "and the fake xcodebuild");
  const before = fakes.calls().length;
  const build = verifyRun("--tier", "build", "--env", "dev");
  assert.deepStrictEqual(builtBy(fakes.calls().slice(before)), ["apk", "ios"], "--tier build builds the APK and the app");
  assert.match(build.checks.find((c) => c.id === "build.android:dev").why, /no APK sits where flutter said/, "the fake flutter writes no APK, so nothing is read");
});

test("the CLI: verify exits 1 on a failed check and 0 otherwise, refuses an unknown tier or environment, and filters by --env", () => {
  const dir = materialize("pristine-flutter-3.47");
  const capture = (argv) => { const out = []; const err = []; const code = run(argv, { cwd: dir, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } }); return { code, out: out.join(""), err: err.join("") }; };
  const r = capture(["verify", "--tier", "static"]);
  assert.strictEqual(r.code, 1, "the pristine app fails the banner check");
  assert.match(r.out, /^ {2}fail {5}static\.banner/m);
  assert.strictEqual(capture(["verify", "--tier", "deep"]).code, 2);
  assert.strictEqual(capture(["verify", "--env", "qa"]).code, 2);
  const cfg = materialize("configured-flutter-3.47");
  const out = [];
  assert.strictEqual(run(["verify", "--tier", "static", "--json"], { cwd: cfg, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } }), 0);
  assert.ok(JSON.parse(out.join("")).checks.every((c) => ["pass", "fail", "not-run"].includes(c.result)));
});

test("config tier: flutter test progress joined by carriage returns (Flutter 3.27) reports its final line", () => {
  const { ctx, ev } = project();
  const out = "00:00 +0: loading /app/test/env_banner_test.dart\r00:01 +0: an empty NAME shows ENVLESS, not MISMATCH\r00:01 +6: All tests passed!\n";
  const f = fake({ "flutter test test/env_banner_test.dart": { code: 0, out } });
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => TOOLS[n] || null }));
  assert.deepStrictEqual([r["config.dart.banner-test"].result, r["config.dart.banner-test"].got], ["pass", "+6: All tests passed!"]);
});

test("a project without iOS reads every iOS check as not-run, and zipCrcs reads a zip's central directory", (t) => {
  const { ctx, ev } = project("configured-flutter-3.47", (f) => drop(f, "ios"));
  const r = byId(verify(ctx, ev, { tier: "build", run: fake().runner, tool: (n) => MAC[n] || null, validate, environ: {} }));
  for (const id of ["static.pbxproj", "config.ios", "build.ios"]) assert.deepStrictEqual([r[id].result, r[id].why], ["not-run", "the project has no iOS app"], id);
  const file = path.join(tempDir(t, "zip-"), "app.apk");
  fs.writeFileSync(file, zip({ "AndroidManifest.xml": "manifest", "res/mipmap-mdpi-v4/ic_launcher.png": "pixels" }));
  assert.deepStrictEqual(Object.fromEntries(zipCrcs(file)), { "AndroidManifest.xml": zlib.crc32("manifest"), "res/mipmap-mdpi-v4/ic_launcher.png": zlib.crc32("pixels") });
  fs.writeFileSync(file, "not a zip");
  assert.strictEqual(zipCrcs(file), null);
});

// A failed build ends on a trailer that names no cause ("Error running pod install", "BUILD FAILED"), so the check says
// what went wrong instead: Gradle's message, Xcode's first error line, else the last three lines of the output.
test("a failed config-only or build step names what went wrong, not the tool's trailer", (t) => {
  const { ctx, ev } = project("configured-flutter-3.41-pods");
  const pods = "Running pod install...\nError output from CocoaPods:\n↳\n    [!] Error installing FirebaseFirestore\n    fatal: unable to access 'https://github.com/firebase/firebase-ios-sdk.git/': Could not resolve host\nError running pod install\n";
  const gradle = "FAILURE: Build failed with an exception.\n\n* What went wrong:\nExecution failed for task ':app:processDevDebugGoogleServices'.\n> No matching client found for package name 'com.acme.shop.dev'\n\n* Try:\n> Run with --stacktrace option to get the stack trace.\n\nBUILD FAILED in 4s\nGradle task assembleDevDebug failed with exit code 1\n";
  const xcode = "Failed to build iOS app\nError output from Xcode build:\n↳\n    ** BUILD FAILED **\n\nXcode's output:\n↳\n    /tmp/app/ios/Runner/AppDelegate.swift:5:3: error: cannot find 'Missing' in scope\nCould not build the application for the simulator.\nError launching application on iPhone 15.\n";
  const f = fake({
    ...mac(),
    "flutter build ios --config-only --flavor dev": { code: 1, out: pods },
    "flutter build apk --debug --flavor dev": { code: 1, out: gradle },
    "flutter build ios --simulator --debug --flavor dev": { code: 1, out: xcode },
  });
  const r = byId(verify(ctx, ev, { tier: "build", env: "dev", run: f.runner, tool: (n) => MAC[n] || null, environ: { ANDROID_HOME: sdkWith(t, ["35.0.0"]) } }));
  assert.deepStrictEqual([r["config.ios.config-only:dev"].result, r["config.ios.config-only:dev"].got], ["fail", "[!] Error installing FirebaseFirestore | fatal: unable to access 'https://github.com/firebase/firebase-ios-sdk.git/': Could not resolve host | Error running pod install"]);
  assert.deepStrictEqual([r["build.android:dev"].result, r["build.android:dev"].got], ["fail", "Execution failed for task ':app:processDevDebugGoogleServices'. > No matching client found for package name 'com.acme.shop.dev'"]);
  assert.deepStrictEqual([r["build.ios:dev"].result, r["build.ios:dev"].got], ["fail", "/tmp/app/ios/Runner/AppDelegate.swift:5:3: error: cannot find 'Missing' in scope"]);
});

// The first -showBuildSettings of a SwiftPM app resolves its packages; with Firebase that clones firebase-ios-sdk, and on
// a cold cache the first two dev reads outlived a 2-minute budget and read as a fail (synthetic Firebase app, 2026-10-22).
test("config tier, iOS: a settings read that did not finish is not-run, unless a finished read is wrong, and each read may take ten minutes", () => {
  const { ctx, ev } = project();
  const late = (wrong) => {
    const settings = mac((env, config, s) => { if (wrong && config === "Profile-dev") s.PRODUCT_BUNDLE_IDENTIFIER = "com.acme.shop"; })["xcodebuild .*-showBuildSettings -json"];
    return fake({ ...mac(), "xcodebuild .*-showBuildSettings -json": (key) => (/-configuration (Debug|Release)-dev /.test(key) ? { code: null, out: "Resolving Package Graph\n", error: "spawnSync /fake/xcodebuild ETIMEDOUT" } : settings(key)) });
  };
  const f = late(false);
  const r = byId(verify(ctx, ev, { tier: "config", run: f.runner, tool: (n) => MAC[n] || null }));
  assert.deepStrictEqual([r["config.ios.settings:dev"].result, r["config.ios.settings:dev"].why], ["not-run", "Debug-dev, Release-dev: xcodebuild -showBuildSettings did not finish: spawnSync /fake/xcodebuild ETIMEDOUT"]);
  assert.strictEqual(r["config.ios.settings:staging"].result, "pass");
  assert.ok(f.calls.filter((c) => c.args.includes("-showBuildSettings")).every((c) => c.timeout >= 10 * 60 * 1000), "the first read may resolve Swift packages");
  const w = byId(verify(ctx, ev, { tier: "config", run: late(true).runner, tool: (n) => MAC[n] || null }));
  assert.deepStrictEqual([w["config.ios.settings:dev"].result, w["config.ios.settings:dev"].got], ["fail", "Profile-dev PRODUCT_BUNDLE_IDENTIFIER com.acme.shop"]);
});

// Gradle leaves its daemon and the Kotlin compile daemon running after a build, each in a session of its own, sized by
// the app's org.gradle.jvmargs (Flutter's template asks for 8 GB). Left alive they held about 6 GB, and two iOS simulator
// builds that followed took 11 to 12 minutes each; once they stopped, the next finished within a minute (2026-10-22).
test("config and build tiers stop the Gradle and Kotlin daemons that appeared during the Android checks, and only those", (t) => {
  const { dir, ctx, ev } = project();
  // The machine's JVMs by pid: the owner's two daemons and an unrelated JVM were there first; each Gradle run adds a
  // Gradle daemon and a Kotlin daemon.
  const daemon = (pid) => `${pid} /usr/bin/java -Xmx8G -cp gradle-launcher.jar org.gradle.launcher.daemon.bootstrap.GradleDaemon 8.14`;
  const kotlin = (pid) => `${pid} /usr/bin/java -cp kotlin.jar org.jetbrains.kotlin.daemon.KotlinCompileDaemon --daemon-runFilesPath x`;
  const scene = () => {
    const alive = new Map([[101, daemon(101)], [102, kotlin(102)], [103, "103 /usr/bin/java -jar unrelated.jar"]]);
    const log = [];
    let next = 200;
    const gradle = (answer) => (key, opts) => { alive.set(++next, daemon(next)); alive.set(++next, kotlin(next)); return typeof answer === "function" ? answer(key, opts) : answer; };
    const f = fake({
      ...mac(), ...builds(dir),
      "ps axo pid=,command=": () => ({ code: 0, out: [...alive.values()].map((l) => `  ${l}`).join("\n") }),
      "gradlew --offline :app:tasks --all": gradle({ code: 0, out: VARIANTS }),
      "flutter build apk --debug --flavor (\\w+)": gradle(builds(dir)["flutter build apk --debug --flavor (\\w+)"]),
    });
    const runner = (cmd, args, opts) => { log.push(path.basename(cmd)); return f.runner(cmd, args, opts); };
    const kill = (pid, signal) => { log.push(`kill ${pid} ${signal}`); alive.delete(pid); };
    return { alive, log, runner, kill };
  };
  const tools = (n) => (n === "ps" ? { path: "/bin/ps" } : MAC[n] || null);
  const c = scene();
  verify(ctx, ev, { tier: "config", env: "dev", run: c.runner, tool: tools, kill: c.kill });
  assert.deepStrictEqual([...c.alive.keys()], [101, 102, 103], "the owner's daemons and the unrelated JVM stay");
  assert.deepStrictEqual(c.log.filter((l) => l.startsWith("kill")), ["kill 201 SIGTERM", "kill 202 SIGTERM"]);
  assert.ok(c.log.lastIndexOf("kill 202 SIGTERM") < c.log.indexOf("xcodebuild"), "stopped before the iOS checks run");
  const b = scene();
  verify(ctx, ev, { tier: "build", env: "dev", run: b.runner, tool: tools, kill: b.kill, environ: { ANDROID_HOME: sdkWith(t, ["35.0.0"]) } });
  assert.deepStrictEqual([...b.alive.keys()], [101, 102, 103], "the build tier's own daemons are stopped too");
  assert.ok(b.log.indexOf("kill 204 SIGTERM") < b.log.lastIndexOf("plutil"), "the APK build's daemons stop before the simulator app is read");
  const n = scene();
  verify(ctx, ev, { tier: "config", env: "dev", run: n.runner, tool: (x) => MAC[x] || null, kill: n.kill });
  assert.ok(!n.log.some((l) => l.startsWith("kill")), "without ps nothing is stopped");
});

// exec runs each tool in a process group of its own. spawnSync's timeout reaches only the child, so a timed-out
// `flutter build ios --config-only` left its `pod install` and `git clone` running, and the next check started on top of
// them (the reference app's config tier, 2026-10-21).
const alive = (pid) => {
  const r = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
  if (r.error) throw r.error;
  return r.stdout.trim() !== "" && !r.stdout.trim().startsWith("Z");
};

test("exec passes a tool's exit code and both streams through", (t) => {
  const r = exec("sh", ["-c", "echo out; echo err >&2; exit 3"], { cwd: tempDir(t, "exec-"), timeout: 10000 });
  assert.deepStrictEqual([r.code, r.stdout, r.out, r.error], [3, "out\n", "out\nerr\n", null]);
});

test("exec stops a tool that outlives its deadline together with everything it started, and reads as not finished", (t) => {
  const dir = tempDir(t, "exec-");
  const pidFile = path.join(dir, "pid");
  let pid = null;
  t.after(() => { if (pid && alive(pid)) process.kill(pid, "SIGKILL"); });
  const r = exec("sh", ["-c", `sleep 120 & echo $! > ${pidFile}; wait`], { cwd: dir, timeout: 1500 });
  assert.ok(fs.existsSync(pidFile), "the tool ran before its deadline");
  pid = Number(fs.readFileSync(pidFile, "utf8"));
  assert.strictEqual(r.code, null);
  assert.match(r.error, /ETIMEDOUT/);
  assert.strictEqual(alive(pid), false, "the process the tool started is gone");
});

test("exec kills a tool that ignores SIGTERM, and what it started, once the grace period ends", (t) => {
  const dir = tempDir(t, "exec-");
  const pidFile = path.join(dir, "pid");
  let pid = null;
  t.after(() => { if (pid && alive(pid)) process.kill(pid, "SIGKILL"); });
  const r = exec("sh", ["-c", `trap '' TERM; sleep 120 & echo $! > ${pidFile}; wait`], { cwd: dir, timeout: 1000 });
  pid = Number(fs.readFileSync(pidFile, "utf8"));
  assert.strictEqual(r.code, null);
  assert.match(r.error, /ETIMEDOUT/);
  assert.strictEqual(alive(pid), false, "the process the tool started is gone");
});

test("exec reads a tool that cannot start as not finished, naming the cause", (t) => {
  const dir = tempDir(t, "exec-");
  const r = exec(path.join(dir, "no-such-tool"), ["--version"], { cwd: dir, timeout: 5000 });
  assert.strictEqual(r.code, null);
  assert.match(r.error, /ENOENT/);
});
