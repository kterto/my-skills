"use strict";
// The Dart writer: one builder: inserted into the single MaterialApp( that has none (and the reader then sees the app
// wired), refusal on an existing builder: or a second root, the banner's import in its sorted place, the banner and
// options templates only where they are the skill's to write, and the Firebase region inside an adopted Env class.
// Every render on every banner branch stays as dart format leaves it, and the reader reads back what the writer wrote.
const { test } = require("node:test");
const assert = require("node:assert");
const D = require("../scripts/writers/dart.cjs");
const banner = require("../scripts/criteria/banner.cjs");
const { optree, twice } = require("./helpers/optree.cjs");
const { bundle, materialize } = require("./helpers/project.cjs");
const { replace, json, drop } = require("./helpers/edit.cjs");
const { applyProject, checkProject } = require("../scripts/envs.cjs");

const MAIN = "lib/main.dart";
const facts = (files) => D.read({
  read: (rel) => (rel in files ? files[rel] : null),
  walk: (dir, { test: keep }) => Object.keys(files).filter((f) => f.startsWith(`${dir}/`) && keep(f)).sort(),
});
const codesOf = (dir) => { const { ev } = checkProject(dir); return [...Object.values(ev.criteria).flatMap((c) => c.findings), ...ev.repo].map((f) => f.code).sort(); };
const BANNER = { envImport: [{ path: "env.dart" }], nameExpr: "Env.name", production: "PRODUCTION", guard: true };
const OPTIONS = { envImport: "import 'env/env.dart';", fields: { apiKeyAndroid: "Env.a", appIdAndroid: "Env.b", apiKeyIos: "Env.c", appIdIos: "Env.d", iosBundleId: "Env.e", projectId: "Env.f", messagingSenderId: "Env.g", storageBucket: "Env.h" } };

test("the wiring goes into the template's MaterialApp( as its first argument, with the import after the package imports", () => {
  const main = bundle("pristine-flutter-3.47")[MAIN];
  const [a, b] = twice(D.ops["wire-banner"], { [MAIN]: main }, { file: MAIN });
  const out = a.text(MAIN);
  assert.strictEqual(b.text(MAIN), out, "a re-run finds EnvBanner in the builder and writes the same bytes");
  assert.match(out, /^import 'package:flutter\/material\.dart';\n\nimport 'env\/env_banner\.dart';\n\nvoid main\(\)/);
  assert.match(out, /return MaterialApp\(\n {6}builder: \(context, child\) => EnvBanner\(child: child\),\n {6}title: 'Flutter Demo',/);
  const wired = facts({ [MAIN]: out, "lib/env/env_banner.dart": bundle("configured-flutter-3.47")["lib/env/env_banner.dart"], "lib/env/env.dart": "class Env {\n  static const name = String.fromEnvironment('NAME');\n}\n" });
  assert.strictEqual(wired.banner.wired, true, "the reader sees the banner wired");
  assert.deepStrictEqual(wired.roots.map((r) => r.wraps), [true]);
});

test("a one-line root takes the builder inline, a router root too, and a nested file imports with ../", () => {
  const inline = optree({ [MAIN]: "import 'package:flutter/material.dart';\n\nvoid main() => runApp(const MaterialApp(home: Text('x')));\n" });
  D.ops["wire-banner"](inline.tree, { file: MAIN });
  assert.match(inline.text(MAIN), /MaterialApp\(builder: \(context, child\) => EnvBanner\(child: child\), home: Text\('x'\)\)/);
  const router = optree({ "lib/app/app.dart": "import 'package:flutter/material.dart';\nimport 'routes.dart';\n\nWidget app() => MaterialApp.router(\n  routerConfig: routes,\n);\n" });
  D.ops["wire-banner"](router.tree, { file: "lib/app/app.dart" });
  const text = router.text("lib/app/app.dart");
  assert.match(text, /MaterialApp\.router\(\n {2}builder: \(context, child\) => EnvBanner\(child: child\),\n {2}routerConfig/);
  assert.match(text, /^import '\.\.\/env\/env_banner\.dart';\nimport 'routes\.dart';$/m, "sorted among the relative imports");
});

test("an existing builder: or a second root is refused, and the file keeps its bytes", () => {
  const builder = "import 'package:flutter/material.dart';\n\nWidget a() => MaterialApp(\n  builder: (c, w) => w!,\n);\n";
  const t = optree({ [MAIN]: builder });
  D.ops["wire-banner"](t.tree, { file: MAIN });
  assert.match(t.conflicts.get(MAIN), /already passes builder:/);
  assert.ok(!t.written.has(MAIN));
  const two = optree({ [MAIN]: `${builder.replace("  builder: (c, w) => w!,\n", "")}Widget b() => MaterialApp(home: null);\n` });
  D.ops["wire-banner"](two.tree, { file: MAIN });
  assert.match(two.conflicts.get(MAIN), /several app roots/);
});

test("the banner and its test are written when absent, unchanged when equal, and the owner's once edited", () => {
  const [a, b] = twice(D.ops.banner, {}, BANNER);
  const banner = a.text("lib/env/env_banner.dart");
  assert.strictEqual(b.text("lib/env/env_banner.dart"), banner);
  assert.ok(!banner.includes("{{"), "no placeholder is left");
  const edited = optree({ "lib/env/env_banner.dart": `${banner}// the owner's tweak\n` });
  D.ops.banner(edited.tree, BANNER);
  assert.ok(edited.foreign.has("lib/env/env_banner.dart"));
  assert.ok(!edited.written.has("lib/env/env_banner.dart"));
  const test = optree();
  D.ops["banner-test"](test.tree, { pkg: "shop", production: "PRODUCTION" });
  assert.match(test.text("test/env_banner_test.dart"), /package:shop\/env\/env_banner\.dart/);
  const seed = optree({ "lib/env/env.dart": "class Env {\n  static const name = String.fromEnvironment('NAME');\n  static const api = String.fromEnvironment('API');\n}\n" });
  D.ops.env(seed.tree);
  assert.ok(!seed.foreign.size && seed.text("lib/env/env.dart").includes("API"), "Env is a seed the owner extends, never foreign");
});

test("firebase_options.dart is written when absent or unmodified FlutterFire output, and left when it reads Env by hand", () => {
  const fresh = optree();
  D.ops["firebase-options"](fresh.tree, OPTIONS);
  const out = fresh.text("lib/firebase_options.dart");
  assert.match(out, /projectId: Env\.f/);
  const opts = facts({ "lib/firebase_options.dart": out }).firebase.main;
  assert.deepStrictEqual([opts.fromEnv, opts.literal, opts.generated], [true, false, false], "the reader sees options built from Env");
  const generated = "// File generated by FlutterFire CLI.\nimport 'package:firebase_core/firebase_core.dart';\n\nclass DefaultFirebaseOptions {\n  static const FirebaseOptions android = FirebaseOptions(apiKey: 'AIza-FAKE', appId: '1:1:android:1', messagingSenderId: '1', projectId: 'acme-dev-staging');\n}\n";
  const ff = optree({ "lib/firebase_options.dart": generated });
  D.ops["firebase-options"](ff.tree, OPTIONS);
  assert.strictEqual(ff.text("lib/firebase_options.dart"), out, "FlutterFire output is replaced");
  for (const cls of ["Env", "AppEnv", "EnvConfig"]) {
    const hand = generated.replace("apiKey: 'AIza-FAKE'", `apiKey: ${cls}.firebaseAndroidApiKey`);
    const kept = optree({ "lib/firebase_options.dart": hand });
    D.ops["firebase-options"](kept.tree, OPTIONS);
    assert.ok(kept.foreign.has("lib/firebase_options.dart"), `a FlutterFire header over options that read ${cls} is the owner's`);
    assert.strictEqual(kept.text("lib/firebase_options.dart"), hand);
    const adopted = facts({ "lib/firebase_options.dart": out.replace(/\bEnv\./g, `${cls}.`) }).firebase.main;
    assert.strictEqual(adopted.fromEnv, true, `the reader sees options built from ${cls}`);
  }
});

test("the Firebase region goes before an adopted Env class's closing brace, reads back, and is refused on a one-line class", () => {
  const file = "lib/src/config/env.dart";
  const env = "abstract class AppEnv {\n  static const name = String.fromEnvironment('NAME');\n}\n";
  const fields = [{ field: "firebaseProjectId", key: "FIREBASE_PROJECT_ID" }, { field: "firebaseIosAppId", key: "FIREBASE_IOS_APP_ID" }, { field: "firebaseIosBundleId", key: "FIREBASE_IOS_BUNDLE_ID" }];
  const [a, b] = twice(D.ops["env-firebase-region"], { [file]: env }, { file, className: "AppEnv", fields });
  const out = a.text(file);
  assert.strictEqual(b.text(file), out);
  assert.match(out, /NAME'\);\n {2}\/\/ flutter-envs:begin firebase sha=[0-9a-f]{8}\n {2}static const firebaseProjectId = String\.fromEnvironment\(\n {4}'FIREBASE_PROJECT_ID',\n {2}\);\n/, "an 81-column constant takes the split form dart format writes");
  assert.match(out, /\n {2}static const firebaseIosAppId = String\.fromEnvironment\('FIREBASE_IOS_APP_ID'\);\n/, "an 80-column constant stays on one line");
  assert.deepStrictEqual(out.split("\n").filter((l) => l.length > 80), [], "no region line passes 80 columns");
  const read = facts({ [file]: out }).env;
  assert.deepStrictEqual(read.fields.map((f) => [f.key, f.inRegion]), [["NAME", false], ["FIREBASE_PROJECT_ID", true], ["FIREBASE_IOS_APP_ID", true], ["FIREBASE_IOS_BUNDLE_ID", true]]);
  const oneLine = optree({ [file]: "class AppEnv { static const name = String.fromEnvironment('NAME'); }\n" });
  D.ops["env-firebase-region"](oneLine.tree, { file, className: "AppEnv", fields });
  assert.match(oneLine.conflicts.get(file), /closing brace/);
});

// The banner planner's edits for a project made of `files`, run through the writer ops on one tree.
function plannedDart(files, production = "PRODUCTION") {
  const ctx = {
    facts: { dart: facts(files), envfiles: { pubspec: { name: "shop" } } },
    matrix: { cell: (facet, env) => (facet === "envFile" && env === "production" ? { value: { name: production, file: "env/production.json" }, at: "env/production.json" } : null) },
    spec: { production: "production", settings: { bannerGuard: "on" } },
  };
  const t = optree(files);
  for (const e of banner.plan(ctx)) if (e.op !== "wire-banner") D.ops[e.op](t.tree, e.args);
  return t;
}

test("each banner branch renders its Env import or none, a constant NAME default, and nothing dart format would move", () => {
  const branches = [
    { files: {}, imports: "import 'env.dart';\n\n", name: "Env.name" },
    { files: { "lib/config/app_env.dart": "abstract class AppEnv {\n  static const environment = String.fromEnvironment('NAME');\n}\n" }, imports: "import '../config/app_env.dart';\n\n", name: "AppEnv.environment" },
    { files: { "lib/config/app_config.dart": "class AppConfig {\n  static const apiUrl = String.fromEnvironment('API_URL');\n}\n" }, imports: "", name: "const String.fromEnvironment('NAME')" },
  ];
  for (const b of branches) {
    const t = plannedDart(b.files);
    const text = t.text("lib/env/env_banner.dart");
    assert.ok(text.startsWith(`import 'package:flutter/material.dart';\nimport 'package:flutter/services.dart';\n\n${b.imports}/// Shows NAME`), `${b.name}: the imports, then one blank line`);
    assert.ok(text.includes(`    this.name = ${b.name},\n`), `${b.name}: the NAME default`);
    for (const rel of [...t.written].filter((r) => r.endsWith(".dart"))) {
      assert.ok(!/\n\n\n/.test(t.text(rel)), `${b.name}: ${rel} has no run of blank lines`);
      assert.deepStrictEqual(t.text(rel).split("\n").filter((l) => l.length > 80), [], `${b.name}: ${rel} stays within 80 columns`);
    }
  }
});

test("a production NAME with a backslash, a quote and a $ is escaped in both Dart literals and reads back unchanged", () => {
  const name = "Joe's $HOME C:\\prod";
  const dir = materialize("configured-flutter-3.47", (f) => {
    json(f, "env/production.json", (e) => { e.NAME = name; });
    drop(f, "lib/env/env_banner.dart");
    drop(f, "test/env_banner_test.dart");
  });
  const r = applyProject(dir, { now: "20261021T000000Z" });
  assert.strictEqual(r.code, 0, r.error);
  const literal = "'Joe\\'s \\$HOME C:\\\\prod'";
  assert.ok(require("node:fs").readFileSync(`${dir}/lib/env/env_banner.dart`, "utf8").includes(`  static const production = ${literal};\n`), "the banner's constant");
  assert.ok(require("node:fs").readFileSync(`${dir}/test/env_banner_test.dart`, "utf8").includes(`const production = ${literal};\n`), "the test's constant");
  assert.deepStrictEqual(codesOf(dir), [], "the banner hides for exactly env/production.json's NAME");
});

test("a banner pinned by textDirection alone would flip under a right-to-left locale: a note, while the app declares none", () => {
  const dir = materialize("configured-flutter-3.47", (f) => replace(f, "lib/env/env_banner.dart", /\n *layoutDirection: TextDirection\.ltr,/g, ""));
  assert.deepStrictEqual(codesOf(dir), ["banner.corner-unpinned"]);
  const { ev } = checkProject(dir);
  assert.match(ev.criteria.banner.findings[0].claim, /without layoutDirection: TextDirection\.ltr/);
  assert.strictEqual(ev.criteria.banner.status, "ok", "a note leaves the status ok");
});

test("the banner's own production constant wins over a same-named one in a file that sorts first", () => {
  const dir = materialize("configured-flutter-3.47", (f) => { f["lib/config/flavor.dart"] = "class Flavor {\n  static const production = 'prod';\n}\n"; });
  assert.deepStrictEqual(codesOf(dir), []);
});
