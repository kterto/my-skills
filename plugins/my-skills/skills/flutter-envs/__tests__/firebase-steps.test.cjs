"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const S = require("../scripts/lib/firebase-steps.cjs");
const { WHERE } = require("../scripts/lib/vocab.cjs");
const { shopSpec } = require("./helpers/firebase/spec.cjs");

const ALL_DEPS = ["firebase_core", "firebase_storage", "cloud_functions", "firebase_messaging", "firebase_auth", "google_sign_in", "firebase_app_check"];
const APPS = {
  dev: { android: "1:111111111111:android:aaaa", ios: "1:111111111111:ios:cccc" },
  staging: { android: "1:111111111111:android:bbbb" },
  production: { android: "1:222222222222:android:eeee", ios: "1:222222222222:ios:ffff" },
};
const ids = (steps) => steps.map((s) => s.id);
const PLACEHOLDER = /<[^>]*>|\{[^}]*\}|\bundefined\b|\bnull\b|\bNaN\b|\[object/;

function everyStep() {
  const failure = (kind) => ({ kind, args: ["apps:list", "ANDROID", "--project", "acme-prod"], message: "Failed to list Firebase ANDROID apps." });
  return [
    ...S.firebaseSteps({ spec: shopSpec(), deps: ALL_DEPS, apps: APPS }),
    ...S.firebaseSteps({ spec: shopSpec((s) => { s.environments.production.firebase = null; return s; }), deps: ALL_DEPS, apps: APPS }),
    ...["missing", "auth", "denied", "error"].map((k) => S.forFailure(failure(k), { envs: ["production"], projects: ["acme-prod"], account: "owner@example.invalid" })),
    S.forFailure(failure("error"), { envs: ["dev"], write: { id: "apps:create:dev:android", env: "dev", args: ["apps:create", "ANDROID", "Shop Dev"] } }),
    S.login({ envs: ["dev"] }),
    S.createProject({ project: "acme-prod", envs: ["production"] }),
  ];
}

test("the dependency gates: each optional step appears only with the package that needs it", () => {
  const spec = shopSpec();
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["firebase_core"], apps: APPS })), ["firebase.ci-secrets:production"]);
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["cloud_functions"], apps: APPS })),
    ["firebase.billing:acme-dev-staging", "firebase.billing:acme-prod", "firebase.ci-secrets:production"]);
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["firebase_storage"], apps: APPS })).filter((i) => i.includes("billing")).length, 2);
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["firebase_messaging"], apps: APPS })),
    ["firebase.apns:acme-dev-staging", "firebase.apns:acme-prod", "firebase.ci-secrets:production"]);
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["firebase_messaging"], platforms: ["android"], apps: APPS })),
    ["firebase.ci-secrets:production"], "no APNs step for an app without iOS");
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["google_sign_in"], apps: APPS })), [
    "firebase.auth-providers:acme-dev-staging", "firebase.auth-providers:acme-prod",
    "firebase.release-sha:dev", "firebase.release-sha:staging", "firebase.release-sha:production",
    "firebase.ci-secrets:production",
  ]);
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["firebase_auth"], apps: { dev: APPS.dev } })).filter((i) => i.includes("release-sha")),
    ["firebase.release-sha:dev"], "a fingerprint step waits until its Android app id is known");
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ["firebase_app_check"], apps: APPS })),
    ["firebase.app-check:acme-dev-staging", "firebase.app-check:acme-prod", "firebase.ci-secrets:production"]);
  assert.deepStrictEqual(ids(S.firebaseSteps({ spec, deps: ALL_DEPS, apps: APPS, settings: { productionFiles: "committed" } })).includes("firebase.ci-secrets:production"), false);
});

test("a production without a Firebase project gets the creation step and no CI step", () => {
  const spec = shopSpec((s) => { s.environments.production.firebase = null; return s; });
  const steps = S.firebaseSteps({ spec, deps: ["firebase_core"] });
  assert.deepStrictEqual(ids(steps), ["firebase.production-project"]);
  assert.strictEqual(steps[0].do[0], "firebase projects:create");
  assert.deepStrictEqual(steps[0].blocks, ["firebase.apps:production"]);
  assert.strictEqual(steps[0].done({ account: "a", projects: ["acme-prod"] }), false, "only a new spec id closes it");
});

test("the fingerprint step carries the exact apps:android:sha:create commands and how to print the SHA with keytool", () => {
  const sha = S.firebaseSteps({ spec: shopSpec(), deps: ["firebase_auth"], apps: APPS }).find((s) => s.id === "firebase.release-sha:production");
  assert.strictEqual(sha.where, "terminal");
  assert.ok(sha.do.includes('firebase apps:android:sha:create 1:222222222222:android:eeee "$SHA1" --project acme-prod'));
  assert.ok(sha.do.includes('firebase apps:android:sha:create 1:222222222222:android:eeee "$SHA256" --project acme-prod'));
  assert.ok(sha.do.some((line) => line.startsWith("keytool -list -v -keystore ")));
  assert.ok(sha.do.some((line) => line.includes("productionRelease")));
  assert.strictEqual(sha.done, null, "nothing here can see which certificate is registered");
});

test("the CI step names the three secrets and the commands that print the production files", () => {
  const ci = S.firebaseSteps({ spec: shopSpec(), deps: [], apps: APPS }).find((s) => s.id === "firebase.ci-secrets:production");
  assert.strictEqual(ci.where, "ci");
  assert.deepStrictEqual(ci.do, [
    "Set GOOGLE_SERVICES_JSON_PRODUCTION to the output of firebase apps:sdkconfig ANDROID 1:222222222222:android:eeee --project acme-prod.",
    "Set GOOGLE_SERVICE_INFO_PLIST_PRODUCTION to the output of firebase apps:sdkconfig IOS 1:222222222222:ios:ffff --project acme-prod.",
    "Set ENV_PRODUCTION_JSON to the contents of env/production.json.",
  ]);
  const unknownApps = S.firebaseSteps({ spec: shopSpec(), deps: [], apps: {} }).find((s) => s.id === "firebase.ci-secrets:production");
  assert.strictEqual(unknownApps.do[0], "Set GOOGLE_SERVICES_JSON_PRODUCTION to the output of firebase apps:sdkconfig ANDROID --project acme-prod.");
});

test("APNs and App Check name every app of the project they apply to", () => {
  const steps = S.firebaseSteps({ spec: shopSpec(), deps: ["firebase_messaging", "firebase_app_check"], apps: APPS });
  const apns = steps.find((s) => s.id === "firebase.apns:acme-dev-staging");
  assert.match(apns.do[1], /settings\/cloudmessaging .*for com\.acme\.shop\.dev and com\.acme\.shop\.staging\.$/);
  const check = steps.find((s) => s.id === "firebase.app-check:acme-prod");
  assert.match(check.do[0], /register com\.acme\.shop with Play Integrity and com\.acme\.shop with App Attest\./);
});

test("no rendered step holds a placeholder, and every step has the spec's shape", () => {
  const steps = everyStep();
  assert.ok(steps.length >= 20);
  for (const s of steps) {
    assert.deepStrictEqual(Object.keys(s), ["id", "where", "title", "do", "why", "blocks", "done"], s.id);
    assert.ok(WHERE.includes(s.where), `${s.id}: where ${s.where}`);
    assert.ok(Array.isArray(s.do) && s.do.length > 0 && s.do.every((l) => typeof l === "string" && l.length > 0), s.id);
    assert.ok(Array.isArray(s.blocks), s.id);
    assert.ok(s.done === null || typeof s.done === "function", s.id);
    for (const text of [s.id, s.title, s.why, ...s.do, ...s.blocks]) {
      assert.ok(!PLACEHOLDER.test(text), `${s.id} holds a placeholder: ${text}`);
    }
  }
});

test("a failed CLI call becomes the step that fixes it", () => {
  const f = (kind) => ({ kind, args: ["apps:list", "IOS", "--project", "acme-prod"], message: "Failed to list Firebase IOS apps. See firebase-debug.log for more info." });
  const ctx = { envs: ["production"], projects: ["acme-prod"], account: "owner@example.invalid" };
  assert.deepStrictEqual(S.forFailure(f("missing"), ctx).do, ["npm install -g firebase-tools"]);
  assert.deepStrictEqual(S.forFailure(f("auth"), ctx).do, ["firebase login --reauth"]);
  assert.deepStrictEqual(S.forFailure(f("auth"), { ...ctx, account: null }).do, ["firebase login"]);
  const terms = S.forFailure(f("denied"), ctx);
  assert.strictEqual(terms.id, "firebase.terms");
  assert.ok(terms.do[0].includes("https://console.firebase.google.com/"));
  const lookup = S.forFailure(f("error"), ctx);
  assert.strictEqual(lookup.id, "firebase.lookup:apps:list:IOS:acme-prod");
  assert.deepStrictEqual(lookup.do, ["firebase apps:list IOS --project acme-prod"]);
  assert.deepStrictEqual(lookup.blocks, ["firebase.apps:production"]);
});

test("the done predicates close a step exactly when the probe shows it done", () => {
  assert.strictEqual(S.install().done({ version: "15.34.0" }), true);
  assert.strictEqual(S.install().done({ version: null }), false);
  assert.strictEqual(S.login({ envs: [] }).done({ account: "owner@example.invalid" }), true);
  assert.strictEqual(S.login({ envs: [] }).done({ account: null }), false);
  assert.strictEqual(S.login({ envs: [], reauth: true }).done({ account: "owner@example.invalid" }), false, "an expired sign-in still shows an account");
  const create = S.createProject({ project: "acme-prod", envs: ["production"] });
  assert.strictEqual(create.done({ account: "a", projects: ["acme-dev-staging", "acme-prod"] }), true);
  assert.strictEqual(create.done({ account: "a", projects: ["acme-dev-staging"] }), false);
  assert.strictEqual(create.done({ account: null, projects: null }), false);
  assert.ok(create.do.includes("firebase projects:create acme-prod"));
  assert.strictEqual(S.terms({ envs: [], projects: [] }).done, null);
});
