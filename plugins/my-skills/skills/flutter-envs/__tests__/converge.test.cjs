"use strict";
// apply converges: one pass on each template, iOS and icons included, leaving no finding, and a second apply that
// changes no byte; a run cut short after any writer that re-runs to the same bytes; configured projects that are
// already fixed points and that apply reaches from the pristine templates given the same inputs; a dry run whose diff
// is exactly the change; and an edit whose claimed finding stays open (or whose op throws) rolling every byte back.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { materialize, bundle } = require("./helpers/project.cjs");
const { inputsOf } = require("./helpers/configured.cjs");
const { applyProject, checkProject, evaluateProject } = require("../scripts/envs.cjs");
const { WRITERS } = require("../scripts/plan.cjs");

const SET = ["prodId=com.acme.shop"];
const NOW = "20261021T000000Z";
const TEMPLATES = ["pristine-flutter-3.47", "pristine-flutter-3.41-pods"];
const PAIRS = [["pristine-flutter-3.47", "configured-flutter-3.47"], ["pristine-flutter-3.41-pods", "configured-flutter-3.41-pods"]];
const SCHEMES = "ios/Runner.xcodeproj/xcshareddata/xcschemes";
const ICON = /\.png$/;
const findings = (ev) => [...Object.values(ev.criteria).flatMap((c) => c.findings), ...ev.repo].map((f) => `${f.code}${f.env ? `:${f.env}` : ""}`);

// Every file and folder under dir but .git, with a digest per file, so a stray folder counts as a difference.
function snapshot(dir) {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (child === ".git") continue;
      if (e.isDirectory()) { out[`${child}/`] = "dir"; walk(child); }
      else out[child] = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, child))).digest("hex");
    }
  };
  walk("");
  return out;
}

const withOp = (writer, op, fn) => ({ ...WRITERS, [writer]: { ...WRITERS[writer], ops: { ...WRITERS[writer].ops, [op]: fn } } });

for (const base of TEMPLATES) {
  const pods = base.includes("pods");
  test(`${base}: one apply converges with iOS and icons, leaves no finding, and a second apply changes no byte`, () => {
    const dir = materialize(base);
    const first = applyProject(dir, { sets: SET, now: NOW });
    assert.strictEqual(first.code, 0, JSON.stringify(first.error || first.refused));
    assert.strictEqual(first.receipt.passes, 1, "desired-state planning needs no second pass");
    assert.strictEqual(first.receipt.converged, true);
    assert.deepStrictEqual(first.receipt.leftovers, []);
    const states = Object.fromEntries(first.receipt.changes.map((c) => [c.file, c.state]));
    const expected = {
      "ios/Runner.xcodeproj/project.pbxproj": "updated", "ios/Runner/Info.plist": "updated", [`${SCHEMES}/Runner.xcscheme`]: "removed",
      ...Object.fromEntries(["dev", "staging", "production"].map((e) => [`${SCHEMES}/${e}.xcscheme`, "created"])),
      ...Object.fromEntries(["dev", "staging"].map((e) => [`ios/Runner/Assets.xcassets/AppIcon-${e}.appiconset/Contents.json`, "created"])),
      ...Object.fromEntries(["dev", "staging"].map((e) => [`android/app/src/${e}/res/mipmap-xxxhdpi/ic_launcher.png`, "created"])),
      ...(pods ? { "ios/Podfile": "updated", "ios/Flutter/Release-staging.xcconfig": "created" } : {}),
    };
    for (const [file, state] of Object.entries(expected)) assert.strictEqual(states[file], state, file);
    // Files are written in the order the receipt lists them, so a run cut short leaves no pbxproj that names an icon set
    // or xcconfig not yet written, and no scheme that names a configuration not yet there.
    const order = first.receipt.changes.map((c) => c.file);
    const at = (file) => order.indexOf(file);
    const pbx = at("ios/Runner.xcodeproj/project.pbxproj");
    assert.ok(at("ios/Runner/Assets.xcassets/AppIcon-staging.appiconset/Contents.json") < pbx, "the icon sets are written before the pbxproj names them");
    if (pods) assert.ok(at("ios/Flutter/Release-staging.xcconfig") < pbx, "the base xcconfigs are written before the pbxproj names them");
    assert.ok(at(`${SCHEMES}/dev.xcscheme`) > pbx && at(`${SCHEMES}/Runner.xcscheme`) > at(`${SCHEMES}/staging.xcscheme`), "the schemes follow the pbxproj, and Runner.xcscheme goes last");
    assert.strictEqual(Object.keys(states).filter((f) => /^ios\/Flutter\/[^/]+-[a-z]+\.xcconfig$/.test(f)).length, pods ? 9 : 0, "the per-configuration Pods layer exists only under CocoaPods");
    assert.deepStrictEqual(findings(checkProject(dir).ev), [], "the end state carries no finding");
    assert.deepStrictEqual(evaluateProject(dir, SET).edits.filter((e) => /^(pbxproj|apple|icons)\./.test(e.id)).map((e) => e.id), [], "a converged project plans no iOS or icon edit");

    const after = snapshot(dir);
    const second = applyProject(dir, { sets: SET, now: NOW });
    assert.strictEqual(second.code, 0);
    assert.deepStrictEqual(second.receipt.changes.filter((c) => c.state !== "unchanged").map((c) => c.file), [], "every file reads unchanged");
    assert.deepStrictEqual(second.receipt.changes.map((c) => c.file).filter((f) => !(f in states)), [], "the second run lists only files the first one did");
    assert.deepStrictEqual(snapshot(dir), after, "no byte moved");
  });

  test(`${base}: a run cut short after any writer re-runs to the bytes of an uninterrupted run`, () => {
    const ref = materialize(base);
    const full = applyProject(ref, { sets: SET, now: NOW });
    const written = full.receipt.changes.filter((c) => c.state !== "unchanged");
    const target = snapshot(ref);
    // Each point where the writer changes, the middle of every run of four files or more, and three files into every run
    // of six or more, which leaves one environment's icon set half written (the middles fall between environments).
    const cuts = new Set();
    for (let start = 0, k = 1; k <= written.length; k++) {
      if (k < written.length && written[k].writer === written[start].writer) continue;
      if (k < written.length) cuts.add(k);
      if (k - start >= 4) cuts.add(start + Math.floor((k - start) / 2));
      if (k - start >= 6) cuts.add(start + 3);
      start = k;
    }
    assert.ok(cuts.size >= 8, `${cuts.size} cut points`);
    for (const k of [...cuts].sort((a, b) => a - b)) {
      const dir = materialize(base);
      for (const c of written.slice(0, k)) {
        if (c.state === "removed") { fs.rmSync(path.join(dir, c.file), { force: true }); continue; }
        fs.mkdirSync(path.dirname(path.join(dir, c.file)), { recursive: true });
        fs.copyFileSync(path.join(ref, c.file), path.join(dir, c.file));
      }
      // The cut-short run left tracked files modified, so the re-run takes the owner's --allow-dirty.
      const again = applyProject(dir, { sets: SET, now: NOW, allowDirty: true });
      assert.strictEqual(again.code, 0, `after ${k} files: ${again.error || JSON.stringify(again.receipt && again.receipt.leftovers)}`);
      assert.deepStrictEqual(snapshot(dir), target, `cut after ${written[k - 1].file}`);
    }
  });
}

for (const base of ["configured-flutter-3.47", "configured-flutter-3.41-pods"]) {
  test(`${base} is already a fixed point: apply reads every file unchanged`, () => {
    const dir = materialize(base);
    const before = snapshot(dir);
    const r = applyProject(dir, { now: NOW });
    assert.strictEqual(r.code, 0);
    assert.deepStrictEqual(r.receipt.changes.filter((c) => c.state !== "unchanged").map((c) => `${c.state} ${c.file}`), []);
    assert.ok(r.receipt.changes.length >= 15, "the Android, env, Dart and Make files are all planned");
    assert.deepStrictEqual(snapshot(dir), before);
  });
}

// The configured bundles are the state apply converges to. Given their inputs (the spec, the native Firebase files,
// the CI workflow, the env values and the app's own Dart) the pristine templates reach them byte for byte, the icon
// bytes aside: the configured icons were badged by Increment 1's probe, apply's by lib/badge.cjs.
for (const [pristine, configured] of PAIRS) {
  test(`${pristine} with ${configured}'s inputs converges to ${configured}, icon bytes aside`, () => {
    const want = bundle(configured);
    const dir = materialize(pristine, (files) => inputsOf(files, want));
    const r = applyProject(dir, { now: NOW });
    assert.strictEqual(r.code, 0, JSON.stringify(r.error || r.receipt.leftovers));
    assert.strictEqual(r.receipt.passes, 1);
    assert.deepStrictEqual(findings(checkProject(dir).ev), []);
    const got = Object.fromEntries(Object.keys(snapshot(dir)).filter((k) => !k.endsWith("/")).map((k) => [k, fs.readFileSync(path.join(dir, k))]));
    const paths = [...new Set([...Object.keys(got), ...Object.keys(want)])].sort();
    assert.deepStrictEqual(paths.filter((k) => !(k in got) || !(k in want)), [], "the same files");
    assert.deepStrictEqual(paths.filter((k) => !ICON.test(k) && !got[k].equals(Buffer.from(want[k]))), [], "every file but the icons is byte for byte the configured one");
  });
}

// A SwiftPM app has no Pods settings for its renamed configurations to lose, so it gets no per-configuration xcconfig
// layer, like the configured 3.47 bundle. When a plugin later needs CocoaPods, Flutter adds a Podfile with the plain map
// and plain Pods includes (taken here from the CocoaPods template), and the next apply lays the layer down in one pass.
test("a SwiftPM app gets the per-configuration xcconfig layer in one apply once a Podfile arrives", () => {
  const commit = (dir, message) => {
    for (const args of [["add", "-A"], ["commit", "-qm", message]]) spawnSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args]);
  };
  const dir = materialize("pristine-flutter-3.47");
  assert.strictEqual(applyProject(dir, { sets: SET, now: NOW }).code, 0);
  commit(dir, "configured");
  const pods = bundle("pristine-flutter-3.41-pods");
  for (const rel of ["ios/Podfile", "ios/Flutter/Debug.xcconfig", "ios/Flutter/Release.xcconfig"]) fs.writeFileSync(path.join(dir, rel), pods[rel]);
  commit(dir, "a plugin brings CocoaPods");
  assert.deepStrictEqual(findings(checkProject(dir).ev), ["ids.ios.podfile-map-missing"]);
  const r = applyProject(dir, { sets: SET, now: NOW });
  assert.strictEqual(r.code, 0, JSON.stringify(r.error || r.receipt.leftovers));
  assert.strictEqual(r.receipt.passes, 1);
  const layer = ["dev", "staging", "production"].flatMap((env) => ["Debug", "Profile", "Release"].map((mode) => `created ios/Flutter/${mode}-${env}.xcconfig`));
  assert.deepStrictEqual(r.receipt.changes.filter((c) => c.state !== "unchanged").map((c) => `${c.state} ${c.file}`).sort(), [...layer, "updated ios/Podfile", "updated ios/Runner.xcodeproj/project.pbxproj"].sort());
  assert.deepStrictEqual(findings(checkProject(dir).ev), []);
  assert.deepStrictEqual(applyProject(dir, { sets: SET, now: NOW }).receipt.changes.filter((c) => c.state !== "unchanged").map((c) => c.file), []);
});

// An Env class adopted at another path still gets the skill's options file planned on every run, so a later apply
// keeps it in step; an options file with FlutterFire's header that reads Env is the owner's and is not planned.
test("with an adopted Env class, the skill's own firebase_options.dart stays planned, and a FlutterFire one reading Env is left alone", () => {
  const OPTIONS = "lib/firebase_options.dart";
  const dir = materialize("pristine-flutter-3.47", (files) => {
    const post = inputsOf(files, bundle("configured-flutter-3.47"));
    files["lib/config/app_env.dart"] = files["lib/env/env.dart"];
    delete files["lib/env/env.dart"];
    return post;
  });
  const first = applyProject(dir, { now: NOW });
  assert.strictEqual(first.code, 0, JSON.stringify(first.error || first.receipt.leftovers));
  assert.match(fs.readFileSync(path.join(dir, OPTIONS), "utf8"), /^import 'config\/app_env\.dart';$/m, "the options read the adopted Env");
  const second = applyProject(dir, { now: NOW });
  assert.strictEqual(second.receipt.changes.find((c) => c.file === OPTIONS).state, "unchanged", "the skill's render is planned again and reads unchanged");
  const flutterFire = `// File generated by FlutterFire CLI.\n${fs.readFileSync(path.join(dir, OPTIONS), "utf8")}`;
  fs.writeFileSync(path.join(dir, OPTIONS), flutterFire);
  spawnSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qam", "options by FlutterFire"]);
  const third = applyProject(dir, { now: NOW });
  assert.strictEqual(third.code, 0);
  assert.ok(!third.receipt.changes.some((c) => c.file === OPTIONS), "a FlutterFire file that reads Env is not planned");
  assert.strictEqual(fs.readFileSync(path.join(dir, OPTIONS), "utf8"), flutterFire);
});

test("--dry-run writes nothing, and its diff applied with git reproduces apply outside the masked env files and the icons", () => {
  const dir = materialize("pristine-flutter-3.47");
  const before = snapshot(dir);
  const dry = applyProject(dir, { sets: SET, now: NOW, dryRun: true });
  assert.strictEqual(dry.code, 0);
  assert.deepStrictEqual(snapshot(dir), before, "nothing written");
  assert.ok(dry.receipt.dryRun);
  const parts = dry.diff.split(/(?=^--- )/m).filter(Boolean);
  const binary = parts.filter((p) => /^\+\(binary, \d+ bytes, sha1 [0-9a-f]{8}\)$/m.test(p));
  assert.ok(binary.length >= 40, "the badged icons are named in the diff, not dumped");
  const plain = parts.filter((p) => !/^\+\+\+ b\/env\//m.test(p) && !binary.includes(p));
  assert.ok(parts.length > plain.length + binary.length, "env files are in the diff, masked");
  fs.writeFileSync(path.join(dir, ".plan.diff"), plain.join(""));
  const applied = spawnSync("git", ["-C", dir, "apply", "--unidiff-zero", ".plan.diff"], { encoding: "utf8" });
  assert.strictEqual(applied.status, 0, applied.stderr);
  fs.rmSync(path.join(dir, ".plan.diff"));
  const real = materialize("pristine-flutter-3.47");
  applyProject(real, { sets: SET, now: NOW });
  const strip = (snap) => Object.fromEntries(Object.entries(snap).filter(([rel]) => !rel.startsWith("env/") && !ICON.test(rel) && !/\.appiconset\/$|\/res\/mipmap-[^/]+\/$|\/res\/$|\/src\/(dev|staging)\/$/.test(rel)));
  assert.deepStrictEqual(strip(snapshot(dir)), strip(snapshot(real)));
});

test("an edit whose claimed finding stays open restores every byte and folder, and names the finding", () => {
  const dir = materialize("pristine-flutter-3.47");
  const before = snapshot(dir);
  // The op writes default-flavor commented out, which the reader rightly ignores.
  const writers = withOp("envfiles", "default-flavor", (tree) => tree.write("pubspec.yaml", tree.read("pubspec.yaml").replace(/^flutter:\n/m, "flutter:\n  # default-flavor: dev\n")));
  const r = applyProject(dir, { sets: SET, now: NOW, writers });
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.receipt.rolledBack, true);
  assert.deepStrictEqual(r.receipt.broken.map((b) => b.edit), ["envfiles.default-flavor"]);
  assert.deepStrictEqual(r.receipt.undo, { restore: [], remove: [] }, "nothing is left to undo");
  assert.deepStrictEqual(snapshot(dir), before, "the tree is byte-identical to before apply, new folders included");
});

test("an iOS edit whose claimed finding stays open rolls back every file of the run, the new scheme included", () => {
  const dir = materialize("configured-flutter-3.47", (f) => { delete f[`${SCHEMES}/staging.xcscheme`]; f["flutter_envs.json"] = f["flutter_envs.json"].replace('"com.acme.shop.dev"', '"com.acme.shop.develop"'); });
  const before = snapshot(dir);
  // set-settings writes the pbxproj back unchanged, so the id it claims to fix stays wrong.
  const r = applyProject(dir, { now: NOW, writers: withOp("pbxproj", "set-settings", (tree) => tree.write("ios/Runner.xcodeproj/project.pbxproj", tree.read("ios/Runner.xcodeproj/project.pbxproj"))) });
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.receipt.rolledBack, true);
  assert.ok(r.receipt.broken.some((b) => b.edit === "pbxproj.set-settings" && b.code === "ids.id-differs"), JSON.stringify(r.receipt.broken));
  assert.deepStrictEqual(snapshot(dir), before, "the scheme apply wrote is gone again, and every other byte is as it was");
});

test("an op that throws in the second pass rolls back what the first pass wrote", () => {
  const dir = materialize("pristine-flutter-3.47");
  const before = snapshot(dir);
  let calls = 0;
  const writers = withOp("envfiles", "makefile", (tree, args, ctx) => {
    calls++;
    if (calls === 1) return WRITERS.envfiles.ops.makefile(tree, args, ctx);
    throw new Error("planted fault");
  });
  const r = applyProject(dir, { sets: SET, now: NOW, writers });
  assert.strictEqual(r.code, 1);
  assert.match(r.error, /planted fault/);
  assert.deepStrictEqual(snapshot(dir), before);
});

test("an op that throws in the first pass writes nothing at all", () => {
  const dir = materialize("pristine-flutter-3.47");
  const before = snapshot(dir);
  const r = applyProject(dir, { sets: SET, now: NOW, writers: withOp("gradle", "flavors", () => { throw new Error("planted fault"); }) });
  assert.strictEqual(r.code, 1);
  assert.match(r.error, /planted fault/);
  assert.deepStrictEqual(snapshot(dir), before);
});

// The sample's values belong to one environment, so no env file may inherit them. Each new env file gets its own NAME and
// the FIREBASE_* values its own native files imply (spec 7.4), which are the configured bundle's values for it.
test("a sample holding one environment's values, with no env files yet, is emptied in one pass, and each env file gets only its own values", () => {
  const dir = materialize("configured-flutter-3.47", (f) => {
    f["env/sample.json"] = f["env/dev.json"];
    for (const env of ["dev", "staging", "production"]) delete f[`env/${env}.json`];
  });
  const r = applyProject(dir, { now: NOW });
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.receipt.passes, 1, "the plan was complete in the first pass");
  const sample = JSON.parse(fs.readFileSync(path.join(dir, "env/sample.json"), "utf8"));
  assert.ok(Object.values(sample).every((v) => v === ""), "every sample value is empty");
  const configured = bundle("configured-flutter-3.47");
  for (const env of ["dev", "staging", "production"]) {
    const values = JSON.parse(fs.readFileSync(path.join(dir, `env/${env}.json`), "utf8"));
    const own = JSON.parse(configured[`env/${env}.json`]);
    const firebase = Object.keys(own).filter((k) => k.startsWith("FIREBASE_") && own[k] !== "");
    assert.ok(firebase.length > 0, `${env}'s configured env file holds Firebase values to compare with`);
    assert.deepStrictEqual(Object.keys(values).filter((k) => values[k] !== "").sort(), ["NAME", ...firebase].sort(), `${env} holds a value only for NAME and its Firebase keys`);
    assert.strictEqual(values.NAME, env.toUpperCase());
    assert.deepStrictEqual(firebase.filter((k) => values[k] !== own[k]), [], `${env}'s Firebase values are its own`);
  }
});

// A vector adaptive foreground cannot be badged, so every flavor keeps production's foreground on Android 8 and later.
// Apply names the layer on every run, not only the first, until the flavor draws its own.
test("a vector adaptive foreground is a conflict on every apply until the flavor draws its own", () => {
  const MAIN = "android/app/src/main/res";
  const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background"/>\n  <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n</adaptive-icon>\n';
  const vector = (shade) => `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#${shade}" android:pathData="M30,30h48v48h-48z"/></vector>\n`;
  const dir = materialize("pristine-flutter-3.47", (f) => { f[`${MAIN}/mipmap-anydpi-v26/ic_launcher.xml`] = adaptive; f[`${MAIN}/drawable/ic_launcher_foreground.xml`] = vector("FFFFFF"); });
  const layers = ["dev", "staging"].map((e) => `android/app/src/${e}/res/drawable/ic_launcher_foreground.xml`);
  const conflicts = (r) => r.receipt.changes.filter((c) => c.state === "conflict").map((c) => c.file);
  const left = (r) => r.receipt.leftovers.map((l) => `${l.code}:${l.env} ${l.pending}`);
  for (const [n, r] of [["first", applyProject(dir, { sets: SET, now: NOW })], ["second", applyProject(dir, { sets: SET, now: NOW })], ["third", applyProject(dir, { sets: SET, now: NOW })]]) {
    assert.strictEqual(r.code, 1, `the ${n} apply exits 1 with the conflict`);
    assert.deepStrictEqual(conflicts(r), layers, `the ${n} apply names each flavor's layer`);
    assert.deepStrictEqual(left(r), ["identity.icon-same:dev conflict", "identity.icon-same:staging conflict"], `the ${n} apply leaves the finding open`);
    assert.strictEqual(r.receipt.converged, false);
  }
  for (const layer of layers) {
    fs.mkdirSync(path.dirname(path.join(dir, layer)), { recursive: true });
    fs.writeFileSync(path.join(dir, layer), vector("00FF00"));
  }
  const own = applyProject(dir, { sets: SET, now: NOW });
  assert.strictEqual(own.code, 0, "flavors that draw their own foreground are told nothing");
  assert.deepStrictEqual(conflicts(own), []);
  assert.deepStrictEqual(left(own), []);
  assert.deepStrictEqual(findings(checkProject(dir).ev), []);
});
