"use strict";
// apply's safety rules: a hand-edited managed block and a foreign block are never written, a dirty tracked file it
// would modify is refused (and so is a folder git cannot undo), paths outside the app root or under .git are refused,
// an env value is backed up before it changes, no env or Firebase value reaches any output, and check writes nothing.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { materialize } = require("./helpers/project.cjs");
const { replace, json } = require("./helpers/edit.cjs");
const { run, applyProject } = require("../scripts/envs.cjs");
const { WRITERS } = require("../scripts/plan.cjs");

const GRADLE = "android/app/build.gradle.kts";
const SET = ["prodId=com.acme.shop"];
const NOW = "20261021T000000Z";
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
const git = (dir, ...args) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" }).stdout;
const capture = (argv, cwd) => {
  const out = [];
  const err = [];
  const code = run(argv, { cwd, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, stdout: out.join(""), stderr: err.join("") };
};

test("a managed block edited by hand is a conflict: the file keeps its bytes and apply exits 1", () => {
  const dir = materialize("configured-flutter-3.47", (f) => replace(f, GRADLE, '            applicationId = "com.acme.shop.staging"\n', '            applicationId = "com.acme.shop.staging"\n            versionNameSuffix = "-stg"\n'));
  const before = read(dir, GRADLE);
  const r = applyProject(dir, { now: NOW });
  assert.strictEqual(r.code, 1);
  const change = r.receipt.changes.find((c) => c.file === GRADLE);
  assert.strictEqual(change.state, "conflict");
  assert.match(change.note, /edited by hand/);
  assert.strictEqual(read(dir, GRADLE), before);
  assert.strictEqual(r.receipt.converged, false);
});

test("a flavor block the skill did not write is foreign: apply plans nothing for it and leaves its bytes", () => {
  const dir = materialize("configured-flutter-3.47", (f) => {
    replace(f, GRADLE, /    \/\/ flutter-envs:begin flavors sha=[0-9a-f]{8}\n/, "    // setup-flutter-envs: managed\n");
    replace(f, GRADLE, "    // flutter-envs:end flavors\n", "");
  });
  const before = read(dir, GRADLE);
  const r = applyProject(dir, { now: NOW });
  assert.strictEqual(r.code, 0);
  assert.ok(!r.receipt.changes.some((c) => c.file === GRADLE && c.edits.includes("gradle.flavors")), "no flavors edit is planned");
  assert.strictEqual(read(dir, GRADLE), before);
  assert.ok(r.receipt.leftovers.length === 0 || r.receipt.leftovers.every((f) => f.code !== "ids.android.foreign-block"), "a recipe finding is not an apply leftover");
});

test("a tracked file apply would modify that has uncommitted changes is refused with exit 2, and nothing is written", () => {
  const dir = materialize("pristine-flutter-3.47", (f) => ({ post: { "pubspec.yaml": `${f["pubspec.yaml"]}# a local edit\n` } }));
  const status = git(dir, "status", "--porcelain");
  const r = capture(["apply", "--set", SET[0]], dir);
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /uncommitted changes/);
  assert.match(r.stderr, /^ {2}pubspec\.yaml$/m);
  assert.strictEqual(git(dir, "status", "--porcelain"), status, "the refusal wrote nothing");
  assert.ok(!fs.existsSync(path.join(dir, "flutter_envs.json")));
});

test("--allow-dirty lets apply write over the owner's uncommitted changes", () => {
  const dir = materialize("pristine-flutter-3.47", () => ({ post: { "lib/main.dart": "import 'package:flutter/material.dart';\n\nvoid main() => runApp(const MaterialApp(home: Text('x')));\n" } }));
  const r = applyProject(dir, { sets: SET, now: NOW, allowDirty: true });
  assert.strictEqual(r.code, 0);
  assert.match(read(dir, "lib/main.dart"), /EnvBanner/);
});

test("an app outside git is refused unless the owner passes --allow-dirty", () => {
  const dir = materialize("pristine-flutter-3.47", undefined, { git: false });
  const r = capture(["apply", "--set", SET[0]], dir);
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /not in a git repository/);
  assert.ok(!fs.existsSync(path.join(dir, "flutter_envs.json")));
});

test("an op that writes outside the app root or under .git is refused and nothing is written", () => {
  for (const target of ["../escaped.txt", ".git/hooks/pre-commit", "/etc/passwd"]) {
    const dir = materialize("pristine-flutter-3.47");
    const writers = { ...WRITERS, envfiles: { ...WRITERS.envfiles, ops: { ...WRITERS.envfiles.ops, makefile: (tree) => tree.write(target, "x") } } };
    const r = applyProject(dir, { sets: SET, now: NOW, writers });
    assert.strictEqual(r.code, 1, target);
    assert.match(r.error, /refused path/);
    assert.ok(!fs.existsSync(path.join(dir, "flutter_envs.json")), `${target}: nothing written`);
    assert.ok(!fs.existsSync(path.resolve(dir, "..", "escaped.txt")));
  }
});

test("an env value that changes is backed up first, under a folder env/.gitignore keeps out of git", () => {
  const dir = materialize("configured-flutter-3.47", (f) => json(f, "env/staging.json", (e) => { e.NAME = "DEV"; }));
  const original = read(dir, "env/staging.json");
  const r = applyProject(dir, { now: NOW });
  assert.strictEqual(r.code, 0);
  const backup = `env/.flutter-envs-backup/staging.json.${NOW}`;
  assert.strictEqual(read(dir, backup), original);
  assert.strictEqual(JSON.parse(read(dir, "env/staging.json")).NAME, "STAGING");
  assert.strictEqual(spawnSync("git", ["-C", dir, "check-ignore", "-q", backup]).status, 0, "the backup is ignored");
  const again = applyProject(dir, { now: "20261021T000001Z" });
  assert.ok(!fs.existsSync(path.join(dir, "env/.flutter-envs-backup/staging.json.20261021T000001Z")), "no change, no new backup");
  assert.deepStrictEqual(again.receipt.changes.filter((c) => c.state !== "unchanged").map((c) => c.file), []);
});

test("sentinel env and Firebase values never reach stdout, stderr, the receipt or the dry-run diff", () => {
  const SECRETS = ["SENTINEL-ENV-VALUE-0001", "SENTINEL-FB-KEY-0002", "SENTINEL-BASE-0003"];
  const dir = materialize("configured-flutter-3.47", (f) => {
    json(f, "env/dev.json", (e) => { e.FIREBASE_ANDROID_API_KEY = SECRETS[0]; e.NAME = "STAGING"; delete e.BASE_URL; });
    json(f, "env/sample.json", (e) => { e.BASE_URL = SECRETS[2]; });
    json(f, "android/app/src/dev/google-services.json", (g) => { g.client[0].api_key[0].current_key = SECRETS[1]; });
  });
  const outputs = [
    capture(["apply", "--dry-run"], dir), capture(["apply", "--dry-run", "--json"], dir),
    capture(["check", "--json", "--all"], dir), capture(["verify", "--tier", "static", "--json"], dir),
    capture(["apply", "--json"], dir), capture(["recipe", "envfiles.remove-unread-keys"], dir),
  ];
  const dry = outputs[0].stdout;
  assert.match(dry, /^\+\+\+ b\/env\/dev\.json$/m, "the dry run does show the env file's change");
  const name = [...dry.matchAll(/^([-+]) {2}"NAME": "<value ([0-9a-f]{8})>",?$/gm)].filter((m) => dry.indexOf("+++ b/env/dev.json") < m.index);
  assert.deepStrictEqual(name.map((m) => m[1]), ["-", "+"], "a changed value is a changed line, shown as digests");
  assert.notStrictEqual(name[0][2], name[1][2]);
  for (const o of outputs) for (const s of SECRETS) assert.ok(!o.stdout.includes(s) && !o.stderr.includes(s), `${s} leaked`);
});

test("a launcher icon copied from production stays under icons=keep, and --set icons=regen rebadges it", () => {
  const DEV = "android/app/src/dev/res/mipmap-";
  const dir = materialize("configured-flutter-3.47", (f) => { for (const rel of Object.keys(f).filter((r) => r.startsWith(DEV))) f[rel] = f[rel.replace("/src/dev/", "/src/main/")]; });
  const icons = () => fs.readdirSync(path.join(dir, "android/app/src/dev/res")).filter((d) => d.startsWith("mipmap-")).map((d) => fs.readFileSync(path.join(dir, "android/app/src/dev/res", d, "ic_launcher.png")).toString("base64"));
  const before = icons();
  const keep = applyProject(dir, { now: NOW });
  assert.strictEqual(keep.code, 0);
  const rows = keep.receipt.changes.filter((c) => c.file.startsWith(DEV));
  assert.strictEqual(rows.length, 5);
  for (const c of rows) {
    assert.strictEqual(c.state, "skipped", c.file);
    assert.match(c.note, /^foreign: it is a copy of production's icon, not a badge of it; --set icons=regen rebadges it$/);
  }
  assert.deepStrictEqual(icons(), before, "icons=keep, the default, overwrites nothing that reads foreign");
  const left = keep.receipt.leftovers.filter((l) => l.code === "identity.icon-same");
  assert.deepStrictEqual(left.map((l) => [l.env, l.pending]), [["dev", "foreign: --set icons=regen rebadges it"]]);

  const regen = applyProject(dir, { sets: ["icons=regen"], now: NOW });
  assert.strictEqual(regen.code, 0, JSON.stringify(regen.error || regen.receipt.leftovers));
  assert.ok(regen.receipt.changes.filter((c) => c.file.startsWith(DEV)).every((c) => c.state === "updated"), "every dev icon is rebadged");
  assert.deepStrictEqual(regen.receipt.leftovers, []);
  assert.ok(icons().every((b, i) => b !== before[i]), "no dev icon is production's any more");
});

test("check changes neither git log nor git status", () => {
  const dir = materialize("configured-flutter-3.47");
  const before = [git(dir, "log", "--oneline"), git(dir, "status", "--porcelain", "--untracked-files=all")];
  assert.strictEqual(capture(["check"], dir).code, 0);
  assert.deepStrictEqual([git(dir, "log", "--oneline"), git(dir, "status", "--porcelain", "--untracked-files=all")], before);
});
