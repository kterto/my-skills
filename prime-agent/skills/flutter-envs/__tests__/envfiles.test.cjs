"use strict";
// The env-files writer: env/.gitignore lines, the sample derived from what Dart reads, skeletons that never overwrite,
// key merges with a backup before a value changes, the app .gitignore blocks, the Makefile block (and make -n on it),
// and default-flavor on the line after flutter:.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { ops } = require("../scripts/writers/envfiles.cjs");
const { readBlock } = require("../scripts/lib/managed.cjs");
const { optree, twice } = require("./helpers/optree.cjs");
const { materialize } = require("./helpers/project.cjs");
const { applyProject, checkProject } = require("../scripts/envs.cjs");

const CTX = { stamp: "20261021T000000Z" };
const PUBSPEC = "name: shop\n\ndependencies:\n  flutter:\n    sdk: flutter\n\nflutter:\n\n  # The following line ensures that the Material Icons font is\n  uses-material-design: true\n";

test("env/.gitignore: written when absent, its missing lines added after '*', and left alone when complete", () => {
  const fresh = optree();
  ops["env-gitignore"](fresh.tree);
  assert.strictEqual(fresh.text("env/.gitignore"), "*\n!.gitignore\n!sample.json\n");
  const self = optree({ "env/.gitignore": "*\n!sample.json\n" });
  ops["env-gitignore"](self.tree);
  assert.strictEqual(self.text("env/.gitignore"), "*\n!sample.json\n!.gitignore\n", "a self-ignoring file gains !.gitignore");
  const none = optree({ "env/.gitignore": "secrets/\n!.gitignore\n" });
  ops["env-gitignore"](none.tree);
  assert.strictEqual(none.text("env/.gitignore"), "secrets/\n!.gitignore\n*\n!.gitignore\n!sample.json\n", "the negations come after the new '*'");
  const crlf = optree({ "env/.gitignore": "*\r\n" });
  ops["env-gitignore"](crlf.tree);
  assert.strictEqual(crlf.text("env/.gitignore"), "*\r\n!.gitignore\r\n!sample.json\r\n");
  const [a, b] = twice(ops["env-gitignore"], { "env/.gitignore": "*\n!.gitignore\n!sample.json\n" });
  assert.strictEqual(a.text("env/.gitignore"), b.text("env/.gitignore"));
});

test("the sample: new with every key empty; an existing one keeps its keys, order and format, empties every value, gains missing keys", () => {
  const fresh = optree();
  ops.sample(fresh.tree, { keys: ["NAME", "BASE_URL"] });
  assert.strictEqual(fresh.text("env/sample.json"), '{\n  "NAME": "",\n  "BASE_URL": ""\n}\n');
  const held = '{\n    "NAME": "DEV",\n    "APP_ID": "com.acme.shop.dev",\n    "EXTRA": ""\n}\n';
  const t = optree({ "env/sample.json": held });
  ops.sample(t.tree, { keys: ["NAME", "APP_ID", "RADIUS"] });
  assert.strictEqual(t.text("env/sample.json"), '{\n    "NAME": "",\n    "APP_ID": "",\n    "EXTRA": "",\n    "RADIUS": ""\n}\n', "4-space indent kept, every value emptied, the owner's extra key kept");
  const odd = '{ "NAME": "", "LOG": "" }';
  const same = optree({ "env/sample.json": odd });
  ops.sample(same.tree, { keys: ["NAME", "LOG"] });
  assert.strictEqual(same.text("env/sample.json"), odd, "nothing to change keeps the owner's formatting byte for byte");
  const bad = optree({ "env/sample.json": "[1, 2]" });
  ops.sample(bad.tree, { keys: ["NAME"] });
  assert.ok(bad.conflicts.has("env/sample.json"));
});

test("skeletons take the sample's keys empty with the label set, copy no value, and never overwrite an env file", () => {
  const t = optree({ "env/sample.json": '{\n  "NAME": "",\n  "BASE_URL": "",\n  "APP_ID": "com.acme.shop.dev"\n}\n', "env/dev.json": '{"NAME":"MINE"}' });
  ops.skeletons(t.tree, { envs: [{ env: "dev", name: "DEV" }, { env: "staging", name: "STAGING" }], keys: ["NAME", "TOKEN"], label: "NAME" });
  assert.strictEqual(t.text("env/dev.json"), '{"NAME":"MINE"}');
  assert.deepStrictEqual(JSON.parse(t.text("env/staging.json")), { NAME: "STAGING", BASE_URL: "", APP_ID: "", TOKEN: "" }, "a value one environment left in the sample reaches no other");
  assert.ok(!t.written.has("env/dev.json"));
});

test("key merges add what Dart needs empty, set the label, and back the file up only when a value changes", () => {
  const files = { "env/dev.json": '{\n  "NAME": "STAGING",\n  "TOKEN": "x"\n}\n', "env/staging.json": '{\n  "TOKEN": "y"\n}\n' };
  const t = optree(files);
  ops.keys(t.tree, { envs: ["dev", "staging", "production"], required: ["TOKEN", "BASE_URL"], label: "NAME", names: { dev: "DEV", staging: "STAGING" } }, CTX);
  assert.deepStrictEqual(JSON.parse(t.text("env/dev.json")), { NAME: "DEV", TOKEN: "x", BASE_URL: "" });
  assert.strictEqual(t.text("env/.flutter-envs-backup/dev.json.20261021T000000Z"), files["env/dev.json"], "dev's NAME changed, so its old bytes are kept");
  assert.deepStrictEqual(JSON.parse(t.text("env/staging.json")), { TOKEN: "y", BASE_URL: "", NAME: "STAGING" });
  assert.strictEqual(t.text("env/.flutter-envs-backup/staging.json.20261021T000000Z"), null, "adding keys changes no value, so no backup");
  assert.strictEqual(t.text("env/production.json"), null, "a missing file is the skeletons' job");
  const [a, b] = twice(ops.keys, t.files(), { envs: ["dev"], required: ["TOKEN"], label: "NAME", names: { dev: "DEV" } });
  assert.strictEqual(a.text("env/dev.json"), b.text("env/dev.json"));
  assert.ok(![...b.written].some((f) => f.includes("backup")), "a value already right is not backed up again");
});

test("the sample takes NAME plus every key Dart reads; a key with a defaultValue goes into the sample only", () => {
  const dir = materialize("pristine-flutter-3.47", (f) => {
    f["lib/config.dart"] = "const base = String.fromEnvironment('BASE_URL');\nconst timeout = int.fromEnvironment(\n  'TIMEOUT',\n  defaultValue: 5,\n);\n";
  });
  const r = applyProject(dir, { sets: ["prodId=com.acme.shop"], now: CTX.stamp });
  assert.strictEqual(r.code, 0);
  const read = (rel) => JSON.parse(fs.readFileSync(path.join(dir, rel), "utf8"));
  assert.deepStrictEqual(read("env/sample.json"), { NAME: "", BASE_URL: "", TIMEOUT: "" });
  assert.deepStrictEqual(read("env/dev.json"), { NAME: "DEV", BASE_URL: "", TIMEOUT: "" }, "a skeleton is the sample with NAME set");
  const { ev } = checkProject(dir);
  assert.deepStrictEqual(ev.criteria.envfiles.findings.map((f) => f.code), []);
});

test("the app .gitignore blocks: created for paths no rule covers, unchanged on a re-run, removed when emptied, never over a hand edit", () => {
  const blocks = { "firebase-production": ["android/app/src/production/google-services.json", "ios/config/production/GoogleService-Info.plist"] };
  const t = optree({ ".gitignore": "/build/" });
  ops.gitignore(t.tree, { blocks });
  const text = t.text(".gitignore");
  assert.match(text, /^\/build\/\n# flutter-envs:begin firebase-production sha=[0-9a-f]{8}\nandroid\/app\/src\/production\/google-services\.json\nios\/config\/production\/GoogleService-Info\.plist\n# flutter-envs:end firebase-production\n$/);
  const [, again] = twice(ops.gitignore, { ".gitignore": text }, { blocks });
  assert.strictEqual(again.text(".gitignore"), text);
  const emptied = optree({ ".gitignore": text });
  ops.gitignore(emptied.tree, { blocks: { "firebase-production": [] } });
  assert.strictEqual(emptied.text(".gitignore"), "/build/\n");
  const edited = optree({ ".gitignore": text.replace("ios/config", "ios/configs") });
  ops.gitignore(edited.tree, { blocks });
  assert.ok(edited.conflicts.has(".gitignore"));
  const none = optree();
  ops.gitignore(none.tree, { blocks: { "env-backups": [] } });
  assert.strictEqual(none.text(".gitignore"), null, "nothing to ignore creates no file");
});

test("the Makefile block: a new Makefile, appended after the owner's targets, refused over a hand edit", () => {
  const fresh = optree();
  ops.makefile(fresh.tree, { default: "dev" });
  const made = fresh.text("Makefile");
  assert.ok(readBlock(made, { id: "makefile", syntax: "hash" }), "the block reads back");
  assert.match(made, /^env \?= dev$/m);
  assert.match(made, /^run-debug: env\/\$\(env\)\.json\n\t\$\(FLUTTER\) run /m, "recipes keep their tab");
  const owner = optree({ Makefile: "lint:\n\tdart analyze" });
  ops.makefile(owner.tree, { default: "staging", envless: true });
  const appended = owner.text("Makefile");
  assert.ok(appended.startsWith("lint:\n\tdart analyze\n# flutter-envs:begin makefile"), "the owner's default goal stays first");
  assert.match(appended, /^run-debug-envless:\n\t\$\(FLUTTER\) run \$\(if \$\(device\),-d \$\(device\)\) --flavor \$\(env\)$/m, "default-flavor off: envless targets pass --flavor");
  const edited = optree({ Makefile: made.replace("env ?= dev", "env ?= staging") });
  ops.makefile(edited.tree, { default: "dev" });
  assert.ok(edited.conflicts.has("Makefile"));
});

test("make -n run-debug expands the flavor and the env file, and a missing env file is a readable error", { skip: !spawnSync("make", ["--version"]).stdout && "make is not on PATH" }, (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-envs-make-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const tree = optree();
  ops.makefile(tree.tree, { default: "dev" });
  fs.writeFileSync(path.join(dir, "Makefile"), tree.text("Makefile"));
  fs.mkdirSync(path.join(dir, "env"));
  fs.writeFileSync(path.join(dir, "env", "staging.json"), "{}");
  const n = spawnSync("make", ["-n", "run-debug", "env=staging"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(n.status, 0, n.stderr);
  assert.match(n.stdout, /flutter run +--flavor staging -t lib\/main\.dart --dart-define-from-file=env\/staging\.json/);
  const missing = spawnSync("make", ["run-debug", "env=qa"], { cwd: dir, encoding: "utf8" });
  assert.notStrictEqual(missing.status, 0);
  assert.match(missing.stderr, /env\/qa\.json is missing; copy env\/sample\.json/);
});

test("default-flavor goes on the line right after flutter:, stays when set, and starts a flutter: section when there is none", () => {
  const t = optree({ "pubspec.yaml": PUBSPEC });
  ops["default-flavor"](t.tree, { flavor: "dev" });
  assert.strictEqual(t.text("pubspec.yaml"), PUBSPEC.replace("\nflutter:\n\n", "\nflutter:\n  default-flavor: dev\n\n"));
  const [a, b] = twice(ops["default-flavor"], { "pubspec.yaml": t.text("pubspec.yaml") }, { flavor: "staging" });
  assert.strictEqual(b.text("pubspec.yaml"), a.text("pubspec.yaml"));
  assert.match(a.text("pubspec.yaml"), /default-flavor: dev/, "an existing default-flavor is the owner's choice");
  const bare = optree({ "pubspec.yaml": "name: shop\ndependencies:\n  flutter:\n    sdk: flutter" });
  ops["default-flavor"](bare.tree, { flavor: "dev" });
  assert.match(bare.text("pubspec.yaml"), /\n\nflutter:\n {2}default-flavor: dev\n$/);
  const crlf = optree({ "pubspec.yaml": PUBSPEC.replace(/\n/g, "\r\n") });
  ops["default-flavor"](crlf.tree, { flavor: "dev" });
  assert.match(crlf.text("pubspec.yaml"), /\r\nflutter:\r\n {2}default-flavor: dev\r\n\r\n/);
});
