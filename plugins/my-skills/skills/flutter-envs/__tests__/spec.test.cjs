"use strict";
// flutter_envs.json at the boundary: each parseSpec invariant refuses its own violation with one line, a production
// that shares a Firebase project above all; the draft asks two questions on a fresh app and none on a configured one.
const { test } = require("node:test");
const assert = require("node:assert");
const S = require("../scripts/lib/spec.cjs");
const { checkProject } = require("../scripts/envs.cjs");
const { materialize } = require("./helpers/project.cjs");

const good = () => ({
  version: 1, production: "production",
  environments: {
    dev: { id: "com.acme.shop.dev", name: "Shop Dev", firebase: "acme-dev-staging" },
    staging: { id: "com.acme.shop.staging", name: "Shop Staging", firebase: "acme-dev-staging" },
    production: { id: "com.acme.shop", name: "Shop", firebase: "acme-prod" },
  },
});
const refusal = (spec) => {
  try { S.parseSpec(typeof spec === "string" ? spec : JSON.stringify(spec)); } catch (e) { assert.ok(e instanceof S.SpecError); return e.lines; }
  return assert.fail("expected a refusal");
};
const one = (mutate, re) => { const s = good(); mutate(s); const lines = refusal(s); assert.strictEqual(lines.length, 1, lines.join("\n")); assert.match(lines[0], re); };

test("a well-formed spec parses, with dev and staging sharing a non-production project", () => {
  assert.deepStrictEqual(S.parseSpec(JSON.stringify(good())), good());
});

test("production's Firebase project may not be anyone else's: a parse-time refusal", () => {
  one((s) => { s.environments.staging.firebase = "acme-prod"; }, /production's Firebase project acme-prod is also staging's/);
});

test("each other invariant refuses its own violation, one line per reason", () => {
  assert.match(refusal("{nope")[0], /not valid JSON/);
  one((s) => { s.colour = "blue"; }, /unknown key "colour"/);
  one((s) => { s.version = 2; }, /version must be 1/);
  one((s) => { s.environments.Dev = s.environments.dev; delete s.environments.dev; }, /environments\.Dev: the name must be lowercase/);
  one((s) => { s.environments["qa-eu"] = { id: "com.acme.shop.qa", name: "Shop QA" }; }, /environments\.qa-eu: the name must be lowercase/);
  one((s) => { s.environments.main = { id: "com.acme.shop.main", name: "Shop Main" }; }, /environments\.main: the name/);
  one((s) => { s.production = "live"; }, /production must name one of the environments/);
  assert.match(refusal({ version: 1, production: "production", environments: { production: good().environments.production } })[0], /at least one other environment/);
  one((s) => { s.environments.dev.id = "com.acme_shop.dev"; }, /dev\.id must be a valid application id on both platforms/);
  one((s) => { s.environments.dev.iosId = "com.acme_shop.dev"; }, /dev\.iosId must be a valid bundle id/);
  one((s) => { s.environments.dev.name = 'Shop "Dev"'; }, /name must not contain/);
  one((s) => { s.environments.dev.name = "Shop // Dev"; }, /name must not contain/);
  one((s) => { s.environments.staging.id = "com.acme.shop.dev"; }, /staging and dev share the id com\.acme\.shop\.dev/);
  one((s) => { s.environments.staging.name = "Shop Dev"; }, /staging and dev share the name Shop Dev/);
  one((s) => { s.environments.dev.colour = "green"; }, /environments\.dev: unknown key "colour"/);
  one((s) => { s.environments.dev.firebase = "Acme Dev"; }, /dev\.firebase must be a Firebase project id/);
  one((s) => { s.environments.dev.badge = { label: "DEV", color: "green" }; }, /dev\.badge must be/);
});

test("an id may differ on iOS through iosId, and firebase may be null while production has no project", () => {
  const s = good();
  s.environments.dev.id = "com.acme.shop_app.dev";
  s.environments.dev.iosId = "com.acme.shop-app.dev";
  s.environments.production.firebase = null;
  assert.deepStrictEqual(S.parseSpec(JSON.stringify(s)).environments.dev.iosId, "com.acme.shop-app.dev");
});

test("a fresh app with the template id asks two questions: the production id and the environments", () => {
  const dir = materialize("pristine-flutter-3.47", (f) => {
    f["android/app/build.gradle.kts"] = f["android/app/build.gradle.kts"].replace('applicationId = "com.acme.shop"', 'applicationId = "com.example.shop"');
    f["ios/Runner.xcodeproj/project.pbxproj"] = f["ios/Runner.xcodeproj/project.pbxproj"].split("PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop;").join("PRODUCT_BUNDLE_IDENTIFIER = com.example.shop;");
  });
  const { ctx } = checkProject(dir);
  assert.strictEqual(ctx.spec.source, "draft");
  assert.deepStrictEqual(ctx.spec.questions.map((q) => q.id).sort(), ["envs", "prodId"]);
  assert.deepStrictEqual(Object.keys(ctx.spec.environments), ["dev", "staging", "production"], "the default environments are drafted");
  assert.strictEqual(ctx.spec.fields.environments.source, "default");
  assert.strictEqual(ctx.spec.fields["environments.dev.name"].value, "Shop Dev", "names come from the literal display name plus the environment");
});

test("a configured app without flutter_envs.json drafts every id, name and project from the files and asks nothing", () => {
  const { ctx } = checkProject(materialize("configured-flutter-3.47", (f) => { delete f["flutter_envs.json"]; }));
  assert.deepStrictEqual(ctx.spec.questions, []);
  const want = good().environments;
  want.dev.badge = { label: "DEV", color: "2E7D32" };
  want.staging.badge = { label: "STG", color: "E65100" };
  assert.deepStrictEqual(ctx.spec.environments, want);
  const notDerived = Object.entries(ctx.spec.fields).filter(([, f]) => f.source !== "derived").map(([k]) => k);
  assert.deepStrictEqual(notDerived, ["environments.dev.badge", "environments.staging.badge"], "only the badges are defaults");
});

test("--set refuses an unknown key or a malformed value, and an answer becomes an asked field", () => {
  for (const bad of ["colour=blue", "envs=dev", "prodId=not an id", "bannerGuard=maybe", "firebase.projects=dev:Acme Dev", "labels=dev:DEV:green"]) {
    assert.throws(() => S.parseSets([bad]), S.SpecError, bad);
  }
  const values = S.parseSets(["prodId=com.acme.store", "appName=Store", "firebase.projects=production:acme-store-prod", "bannerGuard=off"]);
  const { ctx } = checkProject(materialize("pristine-flutter-3.47"), { sets: ["prodId=com.acme.store", "appName=Store"] });
  assert.strictEqual(ctx.spec.fields["environments.production.id"].source, "asked");
  assert.strictEqual(ctx.spec.environments.staging.id, "com.acme.store.staging", "a default id follows the answered production id");
  assert.strictEqual(ctx.spec.environments.dev.name, "Store Dev");
  assert.ok(!ctx.spec.questions.some((q) => q.id === "prodId"), "an answered question is not asked again");
  assert.deepStrictEqual(values.bannerGuard, "off");
});

// --set envs= may name an environment the project does not show yet. It takes the app's own name like every other
// environment does. With native Firebase files for dev and staging only, the draft knows two environments, and a
// production added by --set was named "App" (and written as that into the display-name settings by apply).
test("an environment that --set envs= adds takes the app's name, never a placeholder", () => {
  const { devPair } = require("./helpers/firebase/native.cjs");
  const dev = devPair();
  const staging = devPair({ ios: { BUNDLE_ID: "com.acme.shop.staging", GOOGLE_APP_ID: "1:111111111111:ios:dddd" } });
  const names = (ctx) => Object.fromEntries(Object.entries(ctx.spec.environments).map(([env, e]) => [env, e.name]));
  const firebaseOnly = materialize("pristine-flutter-3.47", (f) => {
    f["android/app/src/dev/google-services.json"] = dev.json;
    f["android/app/src/staging/google-services.json"] = dev.json;
    f["ios/config/dev/GoogleService-Info.plist"] = dev.plist;
    f["ios/config/staging/GoogleService-Info.plist"] = staging.plist;
  });
  const sets = ["prodId=com.acme.shop", "envs=dev,staging,production", "production=production"];
  assert.deepStrictEqual(names(checkProject(firebaseOnly, { sets }).ctx), { dev: "Shop Dev", staging: "Shop Staging", production: "Shop" }, "production is not known to the draft");
  const added = checkProject(materialize("configured-flutter-3.47"), { sets: ["envs=dev,staging,qa,production"] }).ctx;
  assert.deepStrictEqual(names(added), { dev: "Shop Dev", staging: "Shop Staging", qa: "Shop Qa", production: "Shop" }, "a new environment follows the committed production name");
  assert.deepStrictEqual(names(checkProject(materialize("pristine-flutter-3.47"), { sets: ["prodId=com.acme.store", "appName=Store"] }).ctx), { dev: "Store Dev", staging: "Store Staging", production: "Store" }, "an answered appName still wins");
});
