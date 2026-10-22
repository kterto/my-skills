"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const F = require("../scripts/firebase-cli.cjs");
const { run: envs } = require("../scripts/envs.cjs");
const { nativeFacts } = require("../scripts/lib/firebase-keys.cjs");
const { ACCOUNT, baseWorld, fakeFirebase, tempDir } = require("./helpers/firebase/fake.cjs");
const { shopSpec } = require("./helpers/firebase/spec.cjs");
const { materialize } = require("./helpers/project.cjs");
const { drop, replace } = require("./helpers/edit.cjs");

const CONFIG = {
  android: (env) => `android/app/src/${env}/google-services.json`,
  ios: (env) => `ios/config/${env}/GoogleService-Info.plist`,
};
const factsOf = (root) => ({
  platforms: ["android", "ios"],
  present: ["dev", "staging", "production"].flatMap((e) => [CONFIG.android(e), CONFIG.ios(e)]).filter((p) => fs.existsSync(path.join(root, p))),
});
const write = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const WRITES = new Set(["apps:create", "apps:sdkconfig", "apps:android:sha:create", "projects:create", "login", "logout", "use", "init"]);

// dev's apps exist (and a legacy app whose package no environment uses); staging and production have none.
function partlySetUp(flavor = "15.34") {
  const w = baseWorld(flavor);
  w.apps.push(
    { projectId: "acme-dev-staging", platform: "ANDROID", appId: "1:111111111111:android:dev0", packageName: "com.acme.shop.dev", displayName: "Shop Dev" },
    { projectId: "acme-dev-staging", platform: "IOS", appId: "1:111111111111:ios:dev0", bundleId: "com.acme.shop.dev", displayName: "Shop Dev" },
    { projectId: "acme-dev-staging", platform: "ANDROID", appId: "1:111111111111:android:old0", packageName: "com.acme.shop.legacy", displayName: "Legacy" },
  );
  return w;
}

function setUp(t, world = partlySetUp()) {
  const fake = fakeFirebase(t, world);
  write(fake.app, CONFIG.android("dev"), "LOCAL dev google-services.json\n");
  return fake;
}

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

test("the plan lists only the missing apps and files, runs only lookups, and keeps its id", (t) => {
  const fake = setUp(t);
  const spec = shopSpec();
  const p = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });

  assert.deepStrictEqual(p.steps.map((s) => s.id), [
    "apps:sdkconfig:dev:ios",
    "apps:create:staging:android", "apps:sdkconfig:staging:android",
    "apps:create:staging:ios", "apps:sdkconfig:staging:ios",
    "apps:create:production:android", "apps:create:production:ios",
  ], "dev's apps and dev's Android file exist; production's files are CI's");
  const byId = Object.fromEntries(p.steps.map((s) => [s.id, s]));
  assert.deepStrictEqual(byId["apps:sdkconfig:dev:ios"], {
    id: "apps:sdkconfig:dev:ios", env: "dev", platform: "ios",
    args: ["apps:sdkconfig", "IOS", "1:111111111111:ios:dev0", "--project", "acme-dev-staging"],
    places: "ios/config/dev/GoogleService-Info.plist",
  });
  assert.deepStrictEqual(byId["apps:create:staging:android"].args,
    ["apps:create", "ANDROID", "Shop Staging", "--package-name", "com.acme.shop.staging", "--project", "acme-dev-staging"]);
  assert.deepStrictEqual(byId["apps:create:production:ios"].args,
    ["apps:create", "IOS", "Shop", "--bundle-id", "com.acme.shop", "--project", "acme-prod"]);
  assert.deepStrictEqual(byId["apps:sdkconfig:staging:android"].args,
    ["apps:sdkconfig", "ANDROID", "<app-id:staging:android>", "--project", "acme-dev-staging"]);
  assert.strictEqual(byId["apps:create:staging:android"].yields, "<app-id:staging:android>");
  assert.deepStrictEqual(p.blocked, []);
  assert.strictEqual(p.account, ACCOUNT);
  assert.deepStrictEqual(p.apps, { dev: { android: "1:111111111111:android:dev0", ios: "1:111111111111:ios:dev0" } });

  const calls = fake.calls();
  assert.ok(calls.length > 0 && calls.every((argv) => !WRITES.has(argv[0])), `a plan ran a write: ${JSON.stringify(calls)}`);
  assert.ok(calls.every((argv) => argv.includes("--json")));
  assert.ok(calls.filter((argv) => argv[0] === "apps:list").every((argv) => argv.includes("--project")));

  const again = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
  assert.strictEqual(again.id, p.id, "the same world gives the same id");
  const expected = crypto.createHash("sha1").update(JSON.stringify(sortKeys({ account: ACCOUNT, steps: p.steps }))).digest("hex").slice(0, 8);
  assert.strictEqual(p.id, expected, "the id is the first 8 hex of sha1 over the canonical JSON");
});

test("11.19 and 15.34 output shapes give the same plan", (t) => {
  const ids = ["11.19", "15.34"].map((flavor) => {
    const fake = setUp(t, partlySetUp(flavor));
    return F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  });
  assert.strictEqual(ids[0].id, ids[1].id);
  assert.deepStrictEqual(ids[0].steps, ids[1].steps);
});

test("--confirm against a changed world runs nothing: a new app, a new file, another account", (t) => {
  const changes = {
    "a new app appeared": (fake) => fake.edit((w) => w.apps.push({ projectId: "acme-dev-staging", platform: "ANDROID", appId: "1:111111111111:android:stg9", packageName: "com.acme.shop.staging", displayName: "Shop Staging" })),
    "a config file appeared": (fake) => write(fake.app, CONFIG.ios("dev"), "placed by hand\n"),
    "the account changed": (fake) => fake.edit((w) => { w.account = "someone-else@example.invalid"; }),
  };
  for (const [what, change] of Object.entries(changes)) {
    const fake = setUp(t);
    const spec = shopSpec();
    const p = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
    const before = fake.calls().length;
    change(fake);
    const filesBefore = fs.readdirSync(fake.app, { recursive: true }).sort();
    const r = F.confirm({ id: p.id, spec, facts: factsOf(fake.app), cli: fake.call, io: F.nodeIo(fake.app) });
    assert.strictEqual(r.status, "refused", what);
    assert.notStrictEqual(r.plan.id, p.id, what);
    assert.deepStrictEqual(r.ran, [], what);
    const after = fake.calls().slice(before);
    assert.ok(after.every((argv) => !WRITES.has(argv[0])), `${what}: a write ran: ${JSON.stringify(after)}`);
    assert.deepStrictEqual(fs.readdirSync(fake.app, { recursive: true }).sort(), filesBefore, `${what}: a file changed`);
  }
});

test("confirm resolves each app-id symbol from apps:create and places every file at its spec path", (t) => {
  const fake = setUp(t);
  const spec = shopSpec();
  const p = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
  const r = F.confirm({ id: p.id, spec, facts: factsOf(fake.app), cli: fake.call, io: F.nodeIo(fake.app) });
  assert.strictEqual(r.status, "done");
  assert.deepStrictEqual(r.ran.map((x) => x.id), p.steps.map((s) => s.id));

  const world = fake.world();
  const created = (pkg, platform) => world.apps.find((a) => a.platform === platform && (a.packageName === pkg || a.bundleId === pkg)).appId;
  const stagingAndroid = created("com.acme.shop.staging", "ANDROID");
  const stagingIos = created("com.acme.shop.staging", "IOS");
  assert.deepStrictEqual(r.ran.find((x) => x.id === "apps:create:staging:android").appId, stagingAndroid);
  const sdkconfigs = fake.calls().filter((argv) => argv[0] === "apps:sdkconfig").map((argv) => argv[2]);
  assert.deepStrictEqual(sdkconfigs, ["1:111111111111:ios:dev0", stagingAndroid, stagingIos], "each symbol became the id apps:create returned");
  assert.ok(!fake.calls().some((argv) => argv.some((a) => a.startsWith("<app-id:"))), "no symbol reached the CLI");

  const android = nativeFacts(read(fake.app, CONFIG.android("staging")), null).android;
  assert.strictEqual(android.projectId, "acme-dev-staging");
  assert.ok(android.clients.some((c) => c.packageName === "com.acme.shop.staging" && c.appId === stagingAndroid));
  const ios = nativeFacts(null, read(fake.app, CONFIG.ios("staging"))).ios;
  assert.deepStrictEqual([ios.BUNDLE_ID, ios.GOOGLE_APP_ID, ios.PROJECT_ID], ["com.acme.shop.staging", stagingIos, "acme-dev-staging"]);
  assert.strictEqual(read(fake.app, CONFIG.android("dev")), "LOCAL dev google-services.json\n", "an existing file is left alone");
  assert.ok(!fs.existsSync(path.join(fake.app, CONFIG.android("production"))), "production's files stay CI's");

  const settled = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual(settled.steps.map((s) => s.id), [], "a second plan converges to nothing");
  const leftovers = fs.readdirSync(fake.app, { recursive: true }).filter((f) => f.endsWith(".flutter-envs.tmp"));
  assert.deepStrictEqual(leftovers, []);
});

test("a file that appears during the run is kept, and nothing is overwritten without refresh", (t) => {
  const world = partlySetUp();
  const fake = setUp(t, world);
  const target = path.join(fake.app, CONFIG.ios("dev"));
  fake.edit((w) => { w.appearOnSdkconfig = { path: target, text: "someone else's plist\n" }; });
  const spec = shopSpec();
  const p = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
  const r = F.confirm({ id: p.id, spec, facts: factsOf(fake.app), cli: fake.call, io: F.nodeIo(fake.app) });
  assert.strictEqual(r.status, "failed");
  assert.strictEqual(fs.readFileSync(target, "utf8"), "someone else's plist\n", "the late file was not replaced");
  assert.deepStrictEqual(fs.readdirSync(path.dirname(target)), ["GoogleService-Info.plist"], "no temp file is left beside it");
  const failure = r.failure;
  assert.ok(r.blocked.includes(failure));
  assert.strictEqual(failure.id, "firebase.failed:apps:sdkconfig:dev:ios");
  assert.match(failure.why, /appeared during the run and was kept as it is/);
  assert.deepStrictEqual(r.ran, [], "it stopped at the first step");
  assert.ok(!fake.calls().some((argv) => argv[0] === "apps:create"), "nothing after the failed step ran");
});

test("refresh replaces existing config files, atomically, and changes the plan id", (t) => {
  const fake = setUp(t);
  const spec = shopSpec();
  const facts = factsOf(fake.app);
  const plain = F.plan({ spec, facts, cli: fake.call });
  const fresh = F.plan({ spec, facts, cli: fake.call, settings: { refresh: true } });
  assert.notStrictEqual(fresh.id, plain.id);
  const step = fresh.steps.find((s) => s.id === "apps:sdkconfig:dev:android");
  assert.deepStrictEqual(step, {
    id: "apps:sdkconfig:dev:android", env: "dev", platform: "android",
    args: ["apps:sdkconfig", "ANDROID", "1:111111111111:android:dev0", "--project", "acme-dev-staging"],
    places: "android/app/src/dev/google-services.json", overwrite: true,
  });
  const r = F.confirm({ id: fresh.id, spec, facts, cli: fake.call, io: F.nodeIo(fake.app), settings: { refresh: true } });
  assert.strictEqual(r.status, "done");
  const android = nativeFacts(read(fake.app, CONFIG.android("dev")), null).android;
  assert.ok(android.clients.some((c) => c.packageName === "com.acme.shop.dev"), "the local file was replaced by the download");
  assert.deepStrictEqual(fs.readdirSync(path.join(fake.app, "android/app/src/dev")), ["google-services.json"]);
});

test("a downloaded config for another app or project is not placed, on either platform", (t) => {
  const spec = shopSpec((s) => { delete s.environments.dev; s.environments.production.firebase = null; return s; });
  const androidConfig = (project, pkg) => ({ project_info: { project_id: project, project_number: "111111111111" }, client: [{ client_info: { mobilesdk_app_id: "1:111111111111:android:ffff", android_client_info: { package_name: pkg } } }] });
  const cases = [
    ["android", { ANDROID: androidConfig("acme-dev-staging", "com.other.app") }],
    ["android", { ANDROID: androidConfig("acme-other", "com.acme.shop.staging") }],
    ["ios", { IOS: { BUNDLE_ID: "com.other.app" } }],
    ["ios", { IOS: { PROJECT_ID: "acme-other" } }],
  ];
  for (const [platform, override] of cases) {
    const fake = setUp(t);
    const before = fs.readdirSync(fake.app, { recursive: true }).sort();
    fake.edit((w) => { w.sdkconfigOverride = override; });
    const facts = { platforms: [platform], present: [] };
    const p = F.plan({ spec, facts, cli: fake.call });
    const r = F.confirm({ id: p.id, spec, facts, cli: fake.call, io: F.nodeIo(fake.app) });
    const label = JSON.stringify(override);
    assert.strictEqual(r.status, "failed", label);
    assert.match(r.failure.why, new RegExp(`not the staging ${platform} app's`), label);
    assert.deepStrictEqual(fs.readdirSync(fake.app, { recursive: true }).sort(), before, `${label}: no file, temp file or directory was made`);
  }
});

test("productionFiles other than ci downloads production's files too", (t) => {
  const fake = setUp(t);
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call, settings: { productionFiles: "committed" } });
  assert.deepStrictEqual(p.steps.filter((s) => s.env === "production").map((s) => s.id), [
    "apps:create:production:android", "apps:sdkconfig:production:android", "apps:create:production:ios", "apps:sdkconfig:production:ios",
  ]);
});

test("no sign-in becomes the firebase login step, and nothing else is looked up", (t) => {
  const world = partlySetUp();
  world.account = null;
  const fake = setUp(t, world);
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual(p.steps, []);
  assert.deepStrictEqual(p.blocked.map((s) => [s.id, s.do]), [["firebase.login", ["firebase login"]]]);
  assert.deepStrictEqual(p.blocked[0].blocks, ["firebase.apps:dev", "firebase.apps:staging", "firebase.apps:production"]);
  assert.deepStrictEqual(fake.calls().map((argv) => argv[0]), ["login:list"]);
});

test("a sign-in that expires during the lookups plans nothing", (t) => {
  const fake = setUp(t);
  fake.edit((w) => {
    w.canned = { "apps:list ANDROID --project acme-prod": { stdout: JSON.stringify({ status: "error", error: "Authentication Error: Your credentials are no longer valid. Please run firebase login --reauth" }), code: 1 } };
  });
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual(p.steps, [], "the writes for the projects looked up first would fail the same way");
  assert.deepStrictEqual(p.blocked.map((s) => s.do), [["firebase login --reauth"]]);
});

test("an expired sign-in becomes firebase login --reauth", (t) => {
  const world = partlySetUp();
  world.reauth = true;
  const fake = setUp(t, world);
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual(p.blocked.map((s) => s.do), [["firebase login --reauth"]]);
});

test("a 403 becomes the Terms step, and the other project is still planned", (t) => {
  const world = partlySetUp("11.19");
  world.projects[1].denyApps = true;
  const fake = setUp(t, world);
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual(p.blocked.map((s) => s.id), ["firebase.terms"]);
  assert.ok(p.blocked[0].do[0].startsWith("Open https://console.firebase.google.com/ "));
  assert.deepStrictEqual(p.blocked[0].blocks, ["firebase.apps:production"]);
  assert.ok(p.steps.length > 0 && p.steps.every((s) => s.env !== "production"));
});

test("a project the account cannot read becomes firebase projects:create, and its apps are not looked up", (t) => {
  const world = partlySetUp();
  world.projects[1].listed = false;
  const fake = setUp(t, world);
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual(p.blocked.map((s) => s.id), ["firebase.project:acme-prod"]);
  assert.strictEqual(p.blocked[0].do[0], "firebase projects:create acme-prod");
  assert.ok(!fake.calls().some((argv) => argv.includes("acme-prod")), "no lookup touched the unreadable project");
  assert.ok(p.steps.every((s) => s.env !== "production"));
});

test("a production without a project is planned for nobody, and a spec without Firebase runs no command", (t) => {
  const fake = setUp(t);
  const p = F.plan({ spec: shopSpec((s) => { s.environments.production.firebase = null; return s; }), facts: factsOf(fake.app), cli: fake.call });
  assert.ok(p.steps.every((s) => s.env !== "production"));
  const none = F.plan({
    spec: shopSpec((s) => { for (const e of Object.values(s.environments)) delete e.firebase; return s; }),
    facts: factsOf(fake.app), cli: fake.call,
  });
  assert.deepStrictEqual([none.steps, none.blocked], [[], []]);
});

test("a failed write stops the run and becomes a step; the steps before it ran", (t) => {
  const fake = setUp(t);
  fake.edit((w) => {
    w.canned = { "apps:create ANDROID Shop Staging --package-name com.acme.shop.staging --project acme-dev-staging": { stdout: JSON.stringify({ status: "error", error: "Failed to create Android app for project acme-dev-staging. See firebase-debug.log for more info." }), code: 2 } };
  });
  const spec = shopSpec();
  const p = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
  const r = F.confirm({ id: p.id, spec, facts: factsOf(fake.app), cli: fake.call, io: F.nodeIo(fake.app) });
  assert.strictEqual(r.status, "failed");
  assert.deepStrictEqual(r.ran.map((x) => x.id), ["apps:sdkconfig:dev:ios"]);
  assert.ok(fs.existsSync(path.join(fake.app, CONFIG.ios("dev"))));
  const failure = r.failure;
  assert.deepStrictEqual([failure.id, failure.do], ["firebase.failed:apps:create:staging:android", ["/flutter-envs"]]);
  assert.ok(!fake.calls().some((argv) => argv[0] === "apps:create" && argv.includes("IOS")), "nothing after the failure ran");
});

test("an apps:create that answers without an appId stops the run before anything uses it", (t) => {
  const fake = setUp(t);
  fake.edit((w) => {
    w.canned = { "apps:create ANDROID Shop Staging --package-name com.acme.shop.staging --project acme-dev-staging": { stdout: JSON.stringify({ status: "success", result: { name: "operations/create" } }) } };
  });
  const spec = shopSpec();
  const p = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
  const r = F.confirm({ id: p.id, spec, facts: factsOf(fake.app), cli: fake.call, io: F.nodeIo(fake.app) });
  assert.strictEqual(r.status, "failed");
  assert.strictEqual(r.failure.id, "firebase.failed:apps:create:staging:android");
  assert.ok(!fake.calls().some((argv) => argv[0] === "apps:sdkconfig" && argv[1] === "ANDROID"), "no download ran on an unknown id");
});

test("a 401 in the debug log asks for a fresh sign-in", (t) => {
  const world = partlySetUp();
  world.canned = { "apps:list IOS --project acme-prod": { stdout: JSON.stringify({ status: "error", error: "Failed to list Firebase IOS apps. See firebase-debug.log for more info." }), code: 2, debugStatus: 401 } };
  const fake = setUp(t, world);
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual([p.steps, p.blocked.map((s) => s.do)], [[], [["firebase login --reauth"]]]);
});

test("an unparseable lookup becomes a step, and nothing is planned on what it could not see", (t) => {
  const fake = setUp(t);
  fake.edit((w) => { w.canned = { "apps:list IOS --project acme-prod": { stdout: "Error: SENTINEL-OUTPUT\n", code: 1 } }; });
  const p = F.plan({ spec: shopSpec(), facts: factsOf(fake.app), cli: fake.call });
  assert.deepStrictEqual(p.blocked.map((s) => [s.id, s.do]), [["firebase.lookup:apps:list:IOS:acme-prod", ["firebase apps:list IOS --project acme-prod"]]]);
  assert.ok(!p.blocked[0].why.includes("SENTINEL"));
  const production = p.steps.filter((s) => s.env === "production").map((s) => s.id);
  assert.deepStrictEqual(production, ["apps:create:production:android"], "no app is created where the lookup failed: it may exist");
});

test("a denied write folds into the Terms step the plan already has", (t) => {
  const world = partlySetUp();
  world.projects[1].denyApps = true;
  world.canned = { "apps:create ANDROID Shop Staging --package-name com.acme.shop.staging --project acme-dev-staging": { stdout: JSON.stringify({ status: "error", error: "Failed to create Android app for project acme-dev-staging. See firebase-debug.log for more info." }), code: 2, debugStatus: 403 } };
  const fake = setUp(t, world);
  const spec = shopSpec();
  const p = F.plan({ spec, facts: factsOf(fake.app), cli: fake.call });
  const r = F.confirm({ id: p.id, spec, facts: factsOf(fake.app), cli: fake.call, io: F.nodeIo(fake.app) });
  assert.strictEqual(r.status, "failed");
  assert.deepStrictEqual(r.blocked.map((s) => s.id), ["firebase.terms"], "one Terms step, not two with the same id");
  assert.strictEqual(r.failure.id, "firebase.terms");
  assert.deepStrictEqual(r.blocked[0].blocks, ["firebase.apps:production", "firebase.apps:staging"]);
  assert.strictEqual(r.blocked[0].do.length, 3, "the console line, then one access line per project");
});

test("a stale temp file left linked to the target by a crash never edits the target", (t) => {
  const root = tempDir(t, "io-");
  const io = F.nodeIo(root);
  write(root, "android/app/src/dev/google-services.json", "kept\n");
  fs.linkSync(path.join(root, "android/app/src/dev/google-services.json"), path.join(root, "android/app/src/dev/.google-services.json.flutter-envs.tmp"));
  assert.throws(() => io.place("android/app/src/dev/google-services.json", "new\n"), { code: "EEXIST" });
  assert.strictEqual(read(root, "android/app/src/dev/google-services.json"), "kept\n");
  assert.deepStrictEqual(fs.readdirSync(path.join(root, "android/app/src/dev")), ["google-services.json"]);
});

test("cli parses stdout only: stderr warnings, a line before the JSON, colour codes", (t) => {
  const fake = fakeFirebase(t, {
    ...baseWorld("11.19"),
    canned: {
      "apps:list ANDROID --project banner": { stdout: `Update available 11.19.0 -> 15.34.0\n${JSON.stringify({ status: "success", result: [] }, null, 2)}\n` },
      "apps:list ANDROID --project colour": { stdout: JSON.stringify({ status: "error", error: "\u001b[1mFailed\u001b[22m to list" }), code: 2 },
    },
  });
  assert.deepStrictEqual(fake.call(["projects:list"]).ok, true, "the fake always writes a deprecation warning to stderr");
  assert.deepStrictEqual(fake.call(["apps:list", "ANDROID", "--project", "banner"]), { ok: true, result: [] });
  assert.deepStrictEqual(fake.call(["apps:list", "ANDROID", "--project", "colour"]), { ok: false, kind: "error", message: "Failed to list", args: ["apps:list", "ANDROID", "--project", "colour"] });
});

test("cli turns unparseable output, a hang and a missing binary into failures that quote nothing", (t) => {
  const fake = fakeFirebase(t, {
    ...baseWorld(),
    canned: {
      "projects:list": { stdout: "Error: SENTINEL-OUTPUT is not JSON\n", code: 1 },
      "apps:list IOS --project slow": { sleepMs: 5000, stdout: "{}" },
    },
  });
  const bad = fake.call(["projects:list"]);
  assert.deepStrictEqual([bad.ok, bad.kind], [false, "unparseable"]);
  assert.ok(!bad.message.includes("SENTINEL"), "stdout is never echoed");
  const started = Date.now();
  const slow = fake.call(["apps:list", "IOS", "--project", "slow"], { timeoutMs: 400 });
  assert.deepStrictEqual([slow.ok, slow.kind], [false, "timeout"]);
  assert.ok(Date.now() - started < 4000, "the timeout cut the call short");
  const missing = F.cli(["login:list"], { env: { ...process.env, PATH: tempDir(t, "empty-path-") } });
  assert.deepStrictEqual([missing.ok, missing.kind], [false, "missing"]);
});

test("a failed call leaves no firebase-debug.log where the caller runs, and its 403 still counts", (t) => {
  const world = partlySetUp("11.19");
  world.projects[1].denyApps = true;
  const fake = fakeFirebase(t, world);
  const here = tempDir(t, "caller-");
  const back = process.cwd();
  process.chdir(here);
  try {
    const r = fake.call(["apps:list", "ANDROID", "--project", "acme-prod"]);
    assert.deepStrictEqual([r.ok, r.kind, r.message], [false, "denied", "Failed to list Firebase ANDROID apps. See firebase-debug.log for more info."]);
    assert.deepStrictEqual(fs.readdirSync(here), []);
  } finally {
    process.chdir(back);
  }
  const later = fakeFirebase(t, { ...world, flavor: "15.34" });
  assert.strictEqual(later.call(["apps:list", "ANDROID", "--project", "acme-prod"]).kind, "denied", "15.x writes the log to FIREBASE_DEBUG_PATH");
});

test("probe reports the version and the account, and no token", (t) => {
  const fake = fakeFirebase(t, baseWorld("11.19"));
  const p = F.probe({ env: fake.env });
  assert.deepStrictEqual(p, { version: "11.19.0", account: ACCOUNT });
  assert.ok(!JSON.stringify(p).includes("SENTINEL"));
  const signedOut = fakeFirebase(t, { ...baseWorld(), account: null });
  assert.deepStrictEqual(F.probe({ env: signedOut.env }), { version: "15.34.0", account: null });
  assert.deepStrictEqual(F.probe({ env: { ...process.env, PATH: tempDir(t, "empty-path-") } }), { version: null, account: null });
});

test("a missing firebase becomes the install step", (t) => {
  const empty = tempDir(t, "empty-path-");
  const p = F.plan({ spec: shopSpec(), facts: { platforms: ["android"], present: [] }, cli: (args, o) => F.cli(args, { ...o, env: { ...process.env, PATH: empty } }) });
  assert.deepStrictEqual(p.blocked.map((s) => [s.id, s.do]), [["firebase.install", ["npm install -g firebase-tools"]]]);
});

test("nodeIo follows no symlink out of the app root or into .git, and allows one that stays inside", (t) => {
  const root = tempDir(t, "io-");
  const outside = tempDir(t, "io-outside-");
  fs.symlinkSync(outside, path.join(root, "android"));
  assert.throws(() => F.nodeIo(root).place("android/app/src/dev/google-services.json", "x"), /refused/);
  assert.deepStrictEqual(fs.readdirSync(outside), [], "nothing was created outside, not even a directory");
  fs.mkdirSync(path.join(root, ".git"));
  fs.symlinkSync(path.join(root, ".git"), path.join(root, "config"));
  assert.throws(() => F.nodeIo(root).place("config/x.json", "x"), /refused/);
  fs.mkdirSync(path.join(root, "real-ios"));
  fs.symlinkSync(path.join(root, "real-ios"), path.join(root, "ios"));
  F.nodeIo(root).place("ios/config/dev/GoogleService-Info.plist", "y");
  assert.strictEqual(read(root, "real-ios/config/dev/GoogleService-Info.plist"), "y");
});

test("nodeIo refuses paths outside the app root and under .git", (t) => {
  const root = tempDir(t, "io-");
  const io = F.nodeIo(root);
  assert.throws(() => io.place("../outside.json", "x"), /refused/);
  assert.throws(() => io.place(".git/config", "x"), /refused/);
  assert.throws(() => io.place(path.join(root, "..", "abs.json"), "x"), /refused/);
  io.place("a/b.json", "one");
  assert.throws(() => io.place("a/b.json", "two"), { code: "EEXIST" });
  assert.strictEqual(fs.readFileSync(path.join(root, "a/b.json"), "utf8"), "one");
  io.place("a/b.json", "two", { overwrite: true });
  assert.strictEqual(fs.readFileSync(path.join(root, "a/b.json"), "utf8"), "two");
  assert.deepStrictEqual(fs.readdirSync(path.join(root, "a")), ["b.json"]);
});

// The firebase verb: envs.cjs firebase --plan | --confirm <id> on a fixture app, through the same fake CLI.
const ENVS = path.join(__dirname, "..", "scripts", "envs.cjs");
const planIdOf = (out) => /plan ([0-9a-f]{8})/.exec(out)[1];
const verbIn = (cwd, env) => (...argv) => {
  const out = [];
  const err = [];
  const code = envs(argv, { cwd, env, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(""), err: err.join("") };
};

// The configured 3.47 app without staging's two config files, in the world where only dev's apps exist.
function verbSetUp(t, world = partlySetUp()) {
  const fake = fakeFirebase(t, world);
  const app = materialize("configured-flutter-3.47", (f) => { drop(f, CONFIG.android("staging")); drop(f, CONFIG.ios("staging")); });
  return { fake, app, verb: verbIn(app, fake.env) };
}

test("envs.cjs firebase --plan prints its id, each command with the file it saves, and runs only lookups", (t) => {
  const { fake, app, verb } = verbSetUp(t);
  const r = verb("firebase", "--plan");
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /^ {2}1\. firebase apps:create ANDROID "Shop Staging" --package-name com\.acme\.shop\.staging --project acme-dev-staging$/m);
  assert.match(r.out, /^ {2}2\. firebase apps:sdkconfig ANDROID <app-id:staging:android> --project acme-dev-staging {3}saves android\/app\/src\/staging\/google-services\.json$/m);
  assert.match(r.out, /^ {2}<app-id:staging:android> is the app id command 1 returns\.$/m);
  const json = JSON.parse(verb("firebase", "--plan", "--json").out);
  assert.deepStrictEqual([planIdOf(r.out), json.account], [json.id, ACCOUNT], "the text and the JSON name one plan and its account");
  const direct = F.plan({ spec: shopSpec(), facts: factsOf(app), cli: fake.call });
  assert.strictEqual(json.id, direct.id, "the verb plans from the app's spec, platforms and present files, as plan() does");
  assert.ok(json.steps.every((s) => s.env !== "production" || !s.places), "production's files stay CI's");
  assert.ok(!fake.calls().some((argv) => WRITES.has(argv[0])), "no write ran");
  assert.ok(!/SENTINEL/.test(`${r.out}${JSON.stringify(json)}`), "no token or key reached the output");
});

test("envs.cjs firebase --confirm <id> runs exactly the printed plan, places the files, and the next plan is empty", (t) => {
  const { app, verb } = verbSetUp(t);
  const id = planIdOf(verb("firebase", "--plan").out);
  const r = verb("firebase", "--confirm", id);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, new RegExp(`^flutter-envs firebase {3}\\. {3}confirm ${id} {3}done$`, "m"));
  assert.match(r.out, /^ {2}ran {5}4\. firebase apps:sdkconfig IOS 1:111111111111:ios:[0-9a-f]{12} --project acme-dev-staging {3}saved ios\/config\/staging\/GoogleService-Info\.plist$/m);
  assert.strictEqual(nativeFacts(null, read(app, CONFIG.ios("staging"))).ios.BUNDLE_ID, "com.acme.shop.staging");
  assert.match(r.out, /^Next: apply, which derives the FIREBASE_\* keys/m);
  assert.deepStrictEqual(JSON.parse(verb("firebase", "--plan", "--json").out).steps, [], "a second plan converges to nothing");
});

test("a stale plan id runs nothing and exits 1 through the real executable, and shows the new plan", (t) => {
  const { fake, app, verb } = verbSetUp(t);
  const id = planIdOf(verb("firebase", "--plan").out);
  fake.edit((w) => w.apps.push({ projectId: "acme-dev-staging", platform: "ANDROID", appId: "1:111111111111:android:stg0", packageName: "com.acme.shop.staging", displayName: "Shop Staging" }));
  const before = fake.calls().length;
  const r = spawnSync(process.execPath, [ENVS, "firebase", "--confirm", id], { cwd: app, env: fake.env, encoding: "utf8" });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, new RegExp(`confirm ${id} {3}refused`));
  const fresh = /the plan is now ([0-9a-f]{8})/.exec(r.stdout)[1];
  assert.notStrictEqual(fresh, id);
  assert.match(r.stdout, new RegExp(`^Next: firebase --confirm ${fresh}, once the owner has said yes`, "m"));
  assert.ok(!fake.calls().slice(before).some((argv) => WRITES.has(argv[0])), "nothing ran");
  assert.ok(!fs.existsSync(path.join(app, CONFIG.android("staging"))));
  assert.strictEqual(spawnSync(process.execPath, [ENVS, "firebase", "--plan"], { cwd: app, env: fake.env }).status, 0);
});

test("a failed confirm exits 1 and names the command it stopped at with its app id filled in, the ones before it, and the step", (t) => {
  const stagingAndroid = `1:111111111111:android:${crypto.createHash("sha1").update("acme-dev-staging/com.acme.shop.staging").digest("hex").slice(0, 12)}`;
  const world = partlySetUp();
  world.canned = { [`apps:sdkconfig ANDROID ${stagingAndroid} --project acme-dev-staging`]: { stdout: JSON.stringify({ status: "error", error: "Failed to get ANDROID app configuration. See firebase-debug.log for more info." }), code: 2 } };
  const { fake, app, verb } = verbSetUp(t, world);
  const id = planIdOf(verb("firebase", "--plan").out);
  const r = verb("firebase", "--confirm", id);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, new RegExp(`^flutter-envs firebase {3}\\. {3}confirm ${id} {3}failed at apps:sdkconfig:staging:android$`, "m"));
  assert.match(r.out, new RegExp(`^ {2}ran {5}1\\. firebase apps:create ANDROID "Shop Staging" --package-name com\\.acme\\.shop\\.staging --project acme-dev-staging {3}app id ${stagingAndroid}$`, "m"));
  assert.match(r.out, new RegExp(`^ {2}failed {2}2\\. firebase apps:sdkconfig ANDROID ${stagingAndroid} --project acme-dev-staging$`, "m"), "the symbol shows as the id apps:create returned");
  assert.match(r.out, /^ {2}- Finish the Firebase leg, which stopped at firebase apps:sdkconfig \[terminal\]$/m);
  assert.ok(fake.world().apps.some((a) => a.appId === stagingAndroid), "the command before the failure ran");
  assert.ok(!fs.existsSync(path.join(app, CONFIG.android("staging"))));
});

test("usage errors and refused gates exit 2 before any firebase call", (t) => {
  const { fake, verb } = verbSetUp(t);
  for (const argv of [["firebase"], ["firebase", "--plan", "--confirm", "0123abcd"], ["firebase", "--confirm", "NOTANID"]]) assert.strictEqual(verb(...argv).code, 2, argv.join(" "));
  const noFirebase = verbIn(materialize("pristine-flutter-3.47"), fake.env)("firebase", "--plan");
  assert.deepStrictEqual([noFirebase.code, /not in use/.test(noFirebase.err)], [2, true]);
  const draft = materialize("pristine-flutter-3.47", (f) => {
    replace(f, "pubspec.yaml", "dependencies:\n", "dependencies:\n  firebase_core: ^4.0.0\n");
    for (const rel of ["android/app/build.gradle.kts", "ios/Runner.xcodeproj/project.pbxproj"]) replace(f, rel, "com.acme.shop", "com.example.shop", { all: true });
  });
  const unanswered = verbIn(draft, fake.env)("firebase", "--plan", "--set", "firebase.projects=dev:acme-dev-staging,staging:acme-dev-staging,production:acme-prod");
  assert.strictEqual(unanswered.code, 2, "a draft whose ids are still the template's never reaches apps:create");
  assert.match(unanswered.err, /answer first:[\s\S]*--set prodId=/);
  assert.deepStrictEqual(fake.calls(), [], "nothing was looked up");
});

test("--set firebase.refresh=yes plans replacing an existing config file, says so, and changes the id", (t) => {
  const { verb } = verbSetUp(t);
  const plain = JSON.parse(verb("firebase", "--plan", "--json").out);
  const r = verb("firebase", "--plan", "--set", "firebase.refresh=yes");
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /apps:sdkconfig ANDROID 1:111111111111:android:dev0 --project acme-dev-staging {3}replaces android\/app\/src\/dev\/google-services\.json$/m);
  const id = planIdOf(r.out);
  assert.notStrictEqual(id, plain.id);
  assert.match(r.out, new RegExp(`^Next: firebase --confirm ${id} --set firebase\\.refresh=yes, once`, "m"), "the confirm it names repeats the flag that made the plan");
  assert.strictEqual(verb("firebase", "--confirm", id).code, 1, "the same id without the flag is another plan, so it is refused");
});

test("a confirm that runs nothing because the plan is blocked shows the blocked steps and sends the owner to them, not to apply", (t) => {
  const world = partlySetUp();
  world.account = null;
  const { verb } = verbSetUp(t, world);
  const id = planIdOf(verb("firebase", "--plan").out);
  const r = verb("firebase", "--confirm", id);
  assert.strictEqual(r.code, 0, "the plan ran as confirmed: it had no command");
  assert.match(r.out, new RegExp(`confirm ${id} {3}done\\nNothing ran: the plan has no commands\\.\\nBlocked \\(1\\):\\n {2}- Sign in to the Firebase CLI \\[terminal\\]\\n {6}firebase login\\n`));
  assert.match(r.out, /^Next: the blocked steps, then firebase --plan again$/m);
});
