"use strict";
// Live harness for the iOS writers, run by hand and never by CI (its name is not *.test.cjs). On a fresh
// `flutter create` app per template it drives every iOS and icon edit through memtree, the way the engine will, then
// proves the result with plutil, xcodebuild and real Flutter builds, and reruns every edit to show no file moves.
// usage: node ios.live.cjs [swiftpm|pods ...] [--keep]    Exit 1 when any check fails.
// The pods template runs the Flutter 3.41.2 binary that ENVS_FLUTTER_PODS names, and is skipped with its reason without it.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const icons = require("../../scripts/writers/icons.cjs");
const { createIO } = require("../../scripts/lib/io.cjs");
const { CONVENTIONS } = require("../../scripts/lib/vocab.cjs");
const { memtree, apply, SHOP, configsOf, iosEdits, lineDiff } = require("../helpers/memtree.cjs");

const PODS_FLUTTER = process.env.ENVS_FLUTTER_PODS;
const TEMPLATES = [
  { key: "swiftpm", flutter: "flutter", version: "3.47.4", plugins: [], settle: null, skip: false },
  {
    key: "pods", flutter: PODS_FLUTTER, version: "3.41.2", plugins: ["shared_preferences:2.5.6"], settle: ["build", "ios", "--config-only", "--debug"],
    skip: PODS_FLUTTER ? false : "set ENVS_FLUTTER_PODS=<path to a Flutter 3.41.2 flutter binary> to run the CocoaPods template",
  },
];
const ENV = { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8", CI: "true" };
const CONFIGS = configsOf(SHOP);
const OTHERS = SHOP.envs.filter((e) => e !== SHOP.production);
const iconSet = (env) => CONVENTIONS.iosIconSet(env, SHOP.production);
const firebasePlist = (env) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>BUNDLE_ID</key>
	<string>${SHOP.ids[env]}</string>
	<key>PROJECT_ID</key>
	<string>${env === SHOP.production ? "acme-prod" : "acme-dev-staging"}</string>
</dict>
</plist>
`;

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: "utf8", maxBuffer: 256 << 20 });
  return { ok: r.status === 0, stdout: r.stdout || "", out: `${r.stdout || ""}${r.stderr || ""}` };
}
const lastLines = (out, n = 6) => out.trim().split("\n").slice(-n).join(" | ");
const seconds = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

const results = [];
function check(template, label, fn) {
  const t0 = performance.now();
  let r;
  try { r = fn(); } catch (e) { r = { ok: false, detail: e.message.split("\n")[0] }; }
  const ms = performance.now() - t0;
  results.push({ template, label, ok: r.ok, ms });
  console.log(`  ${r.ok ? "ok  " : "FAIL"} ${label.padEnd(64)} ${seconds(ms).padStart(8)}  ${r.detail}`);
  return r;
}

// Every iOS and icon edit through memtree onto the app, plus each environment's Firebase plist (the envfiles writer's
// file, written here so the delivery phase has something to copy). Returns memtree's change list; flushes the rest.
function applyAll(app) {
  const t = memtree(app);
  const ctx = { spec: { production: SHOP.production }, facts: { icons: icons.read(createIO(app, { git: false })) } };
  apply(t.tree, iosEdits(SHOP), ctx);
  for (const env of SHOP.envs) {
    const rel = CONVENTIONS.fbIosFile(env);
    if (t.tree.read(rel) === null) t.tree.write(rel, firebasePlist(env));
    else if (t.tree.read(rel) !== firebasePlist(env)) t.tree.conflict(rel, "a different plist is already there");
    else t.tree.write(rel, firebasePlist(env));
  }
  t.flush(app);
  return t.changes();
}

const tally = (changes) => Object.entries(changes.reduce((acc, c) => ({ ...acc, [c.state]: (acc[c.state] || 0) + 1 }), {})).map(([k, v]) => `${v} ${k}`).join(", ");

// The project as the owner commits it: everything under ios/ except what pods, builds and Xcode's per-user state leave.
function treeHash(ios) {
  const skip = /^(Pods|\.symlinks|Flutter\/ephemeral|build)(\/|$)|(^|\/)xcuserdata(\/|$)|^Flutter\/(Generated\.xcconfig|flutter_export_environment\.sh)$/;
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ios, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (skip.test(rel)) continue;
      if (e.isDirectory()) walk(rel); else files.push(rel);
    }
  };
  walk("");
  const h = crypto.createHash("sha1");
  for (const f of files.sort()) h.update(f).update("\0").update(fs.readFileSync(path.join(ios, f))).update("\0");
  return { sha: h.digest("hex").slice(0, 12), files: files.length };
}

function settingsOf(stdout, target) {
  const json = JSON.parse(stdout.slice(stdout.indexOf("[")));
  return (json.find((e) => e.target === target) || {}).buildSettings || null;
}

function createApp(t, root) {
  const app = path.join(root, `shop-${t.key}`);
  const steps = [["create", "--org", "com.acme", "--project-name", "shop", "--platforms", "android,ios", app], ...t.plugins.map((p) => ["pub", "add", p]), ...(t.settle ? [t.settle] : [])];
  for (const args of steps) {
    const r = sh(t.flutter, args, args[0] === "create" ? root : app);
    if (!r.ok) throw new Error(`${t.flutter} ${args.join(" ")}: ${lastLines(r.out)}`);
  }
  const version = JSON.parse(sh(t.flutter, ["--version", "--machine"], app).stdout).frameworkVersion;
  if (version !== t.version) throw new Error(`${t.flutter} is ${version}, expected ${t.version}`);
  return app;
}

function liveRun(t, root) {
  const pods = t.plugins.length > 0;
  const tag = `fresh flutter create, Flutter ${t.version} (${pods ? "CocoaPods" : "SwiftPM"})`;
  console.log(`\n${tag}`);
  let app;
  if (!check(tag, `flutter create${t.plugins.length ? ` + pub add ${t.plugins.join(" ")} + ${t.settle.join(" ")}` : ""}`, () => { app = createApp(t, root); return { ok: true, detail: path.basename(app) }; }).ok) return;
  const ios = path.join(app, "ios");
  const flutter = (args) => sh(t.flutter, args, app);
  check(tag, "apply every iOS edit for dev, staging, production", () => {
    const changes = applyAll(app);
    return { ok: !changes.some((c) => c.state === "conflict" || c.state === "foreign"), detail: tally(changes) };
  });
  const pbxFile = path.join(ios, "Runner.xcodeproj", "project.pbxproj");
  const applied = fs.readFileSync(pbxFile, "utf8");
  check(tag, "plutil -lint project.pbxproj and Info.plist", () => {
    const r = sh("plutil", ["-lint", pbxFile, path.join(ios, "Runner", "Info.plist")], app);
    return { ok: r.ok, detail: r.out.trim().split("\n").map((l) => l.replace(/^.*\//, "")).join(", ") };
  });
  check(tag, "flutter build ios --config-only --flavor dev", () => {
    const r = flutter(["build", "ios", "--config-only", "--flavor", "dev"]);
    const line = r.out.split("\n").find((l) => l.includes("Building com.acme")) || lastLines(r.out);
    const podInstall = /Running pod install/.test(r.out);
    return { ok: r.ok && line.includes(`Building ${SHOP.ids.dev} `) && podInstall === pods, detail: `${line.trim()}${podInstall ? " (pod install ran)" : ""}` };
  });
  check(tag, "xcodebuild -list -json", () => {
    const r = sh("xcodebuild", ["-list", "-json", "-project", "ios/Runner.xcodeproj"], app);
    const p = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).project;
    const configsOk = JSON.stringify([...p.configurations].sort()) === JSON.stringify(CONFIGS.map((c) => c.name).sort());
    const schemesOk = SHOP.envs.every((e) => p.schemes.includes(e)) && !p.schemes.includes("Runner");
    return { ok: r.ok && configsOk && schemesOk, detail: `${p.configurations.length} configurations; schemes ${p.schemes.join(", ")}` };
  });
  for (const { name, env } of CONFIGS) {
    check(tag, `-showBuildSettings -scheme ${env} -configuration ${name}`, () => {
      const r = sh("xcodebuild", ["-workspace", "ios/Runner.xcworkspace", "-scheme", env, "-configuration", name, "-showBuildSettings", "-json"], app);
      const s = r.ok && settingsOf(r.stdout, "Runner");
      if (!s) return { ok: false, detail: lastLines(r.out, 3) };
      const want = { PRODUCT_BUNDLE_IDENTIFIER: SHOP.ids[env], DISPLAY_NAME: SHOP.names[env], ASSETCATALOG_COMPILER_APPICON_NAME: iconSet(env), IPHONEOS_DEPLOYMENT_TARGET: `${SHOP.minIos}.0` };
      const wrong = Object.entries(want).filter(([k, v]) => s[k] !== v).map(([k]) => `${k}=${s[k]}`);
      if (pods !== Boolean(s.PODS_ROOT)) wrong.push(`PODS_ROOT=${s.PODS_ROOT || "(absent)"}`);
      return { ok: wrong.length === 0, detail: wrong.length ? `wrong: ${wrong.join(", ")}` : `${s.PRODUCT_BUNDLE_IDENTIFIER}, "${s.DISPLAY_NAME}", ${s.ASSETCATALOG_COMPILER_APPICON_NAME}, iOS ${s.IPHONEOS_DEPLOYMENT_TARGET}, PODS_ROOT ${s.PODS_ROOT ? path.relative(s.SRCROOT, s.PODS_ROOT) : "(absent)"}` };
    });
  }
  for (const env of SHOP.envs) {
    check(tag, `-showBuildSettings -target RunnerTests -configuration Debug-${env}`, () => {
      const r = sh("xcodebuild", ["-project", "ios/Runner.xcodeproj", "-target", "RunnerTests", "-configuration", `Debug-${env}`, "-showBuildSettings", "-json"], app);
      const s = r.ok && settingsOf(r.stdout, "RunnerTests");
      return { ok: Boolean(s) && s.PRODUCT_BUNDLE_IDENTIFIER === `${SHOP.ids[env]}.RunnerTests`, detail: s ? s.PRODUCT_BUNDLE_IDENTIFIER : lastLines(r.out, 3) };
    });
  }
  for (const env of [...OTHERS.filter((e) => e !== "dev"), SHOP.production]) {
    check(tag, `flutter build ios --config-only --flavor ${env}`, () => {
      const r = flutter(["build", "ios", "--config-only", "--flavor", env]);
      const line = r.out.split("\n").find((l) => l.includes("Building com.acme")) || lastLines(r.out);
      return { ok: r.ok && line.includes(`Building ${SHOP.ids[env]} `), detail: line.trim() };
    });
  }
  const appDir = path.join(app, "build", "ios", "iphonesimulator", "Runner.app");
  check(tag, "flutter build ios --simulator --debug --flavor dev", () => {
    const r = flutter(["build", "ios", "--simulator", "--debug", "--flavor", "dev"]);
    return { ok: r.ok && fs.existsSync(appDir), detail: (r.out.split("\n").find((l) => l.includes("Built ")) || lastLines(r.out)).trim() };
  });
  check(tag, "Runner.app/Info.plist: id, display name, primary icon", () => {
    const info = JSON.parse(sh("plutil", ["-convert", "json", "-o", "-", path.join(appDir, "Info.plist")], app).out);
    const icon = info.CFBundleIcons && info.CFBundleIcons.CFBundlePrimaryIcon;
    const got = { id: info.CFBundleIdentifier, name: info.CFBundleDisplayName, icon: icon && icon.CFBundleIconName };
    const ok = got.id === SHOP.ids.dev && got.name === SHOP.names.dev && got.icon === iconSet("dev");
    return { ok, detail: `CFBundleIdentifier ${got.id}, CFBundleDisplayName "${got.name}", CFBundleIconName ${got.icon} (files ${((icon && icon.CFBundleIconFiles) || []).join(" ")})` };
  });
  check(tag, "Runner.app/GoogleService-Info.plist is the dev file", () => {
    const built = path.join(appDir, "GoogleService-Info.plist");
    const ok = fs.existsSync(built) && fs.readFileSync(built).equals(fs.readFileSync(path.join(app, CONVENTIONS.fbIosFile("dev"))));
    return { ok, detail: ok ? `PROJECT_ID ${sh("plutil", ["-extract", "PROJECT_ID", "raw", built], app).out.trim()}, BUNDLE_ID ${sh("plutil", ["-extract", "BUNDLE_ID", "raw", built], app).out.trim()}` : "missing or different" };
  });
  check(tag, "rerun every edit after the builds: nothing changes", () => {
    const toolEdits = lineDiff(applied, fs.readFileSync(pbxFile, "utf8"));
    const before = treeHash(ios);
    const changes = applyAll(app);
    const after = treeHash(ios);
    const moved = changes.filter((c) => c.state !== "unchanged");
    const ok = moved.length === 0 && before.sha === after.sha;
    return { ok, detail: `${changes.length} files unchanged; ios/ tree ${before.sha} = ${after.sha} over ${after.files} files; the tools edited the pbxproj by -${toolEdits.removed.length}/+${toolEdits.added.length} lines${moved.length ? `; MOVED ${moved.map((c) => `${c.file} ${c.state}`).join(", ")}` : ""}` };
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");
  const wanted = args.filter((a) => a !== "--keep");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-envs-ios-live-"));
  const t0 = performance.now();
  try {
    for (const t of TEMPLATES.filter((x) => !wanted.length || wanted.includes(x.key))) {
      if (t.skip) console.log(`\n${t.key}: skipped; ${t.skip}`);
      else liveRun(t, root);
    }
  } finally {
    if (keep) console.log(`\nkept ${root}`);
    else fs.rmSync(root, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed in ${seconds(performance.now() - t0)}`);
  process.exitCode = failed.length ? 1 : 0;
}
