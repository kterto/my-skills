"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const K = require("../scripts/lib/firebase-keys.cjs");
const { CONVENTIONS } = require("../scripts/lib/vocab.cjs");
const { devPair, googleServicesJson, infoPlist } = require("./helpers/firebase/native.cjs");

const DEV = { androidId: "com.acme.shop.dev", iosId: "com.acme.shop.dev" };
const derive = (pair, ids = DEV) => K.deriveKeys({ ...K.nativeFacts(pair.json, pair.plist), ...ids });

test("the derivation table holds for synthetic native files", () => {
  assert.deepStrictEqual(derive(devPair()), {
    FIREBASE_PROJECT_ID: "acme-dev-staging",
    FIREBASE_STORAGE_BUCKET: "acme-dev-staging.appspot.com",
    FIREBASE_MESSAGING_SENDER_ID: "111111111111",
    FIREBASE_ANDROID_APP_ID: "1:111111111111:android:aaaa",
    FIREBASE_ANDROID_API_KEY: "AIza-SENTINEL-ANDROID-DEV",
    FIREBASE_IOS_APP_ID: "1:111111111111:ios:cccc",
    FIREBASE_IOS_API_KEY: "AIza-SENTINEL-IOS-DEV",
    FIREBASE_IOS_BUNDLE_ID: "com.acme.shop.dev",
    FIREBASE_IOS_CLIENT_ID: "111-dev-ios.apps.googleusercontent.com",
    FIREBASE_ANDROID_CLIENT_ID: "111-dev-android.apps.googleusercontent.com",
    OAUTH_GOOGLE_SERVER_CLIENT_ID: "111-web-first.apps.googleusercontent.com",
  });
});

test("the Android client rule: one type-1 client derives, three give absent", () => {
  const one = derive(devPair());
  assert.strictEqual(one.FIREBASE_ANDROID_CLIENT_ID, "111-dev-android.apps.googleusercontent.com");

  const three = devPair();
  three.android.clients[0].type1 = ["111-cert-a.apps", "111-cert-b.apps", "111-cert-c.apps"];
  const derived = derive({ ...three, json: googleServicesJson(three.android) });
  assert.ok(!("FIREBASE_ANDROID_CLIENT_ID" in derived), "one client per signing certificate names a machine, so the key is absent");
  assert.deepStrictEqual(
    K.compareKeys({ FIREBASE_ANDROID_CLIENT_ID: "111-cert-a.apps" }, derived).find((r) => r.key === "FIREBASE_ANDROID_CLIENT_ID"),
    { key: "FIREBASE_ANDROID_CLIENT_ID", state: "not-derivable" },
  );
});

test("a type-1 client registered for another package does not count toward the environment's client", () => {
  const pair = devPair();
  pair.android.clients[0].foreignType1 = [{ pkg: "com.acme.shop.legacy", id: "111-legacy.apps" }];
  assert.strictEqual(derive({ ...pair, json: googleServicesJson(pair.android) }).FIREBASE_ANDROID_CLIENT_ID, "111-dev-android.apps.googleusercontent.com");
});

test("OAUTH_GOOGLE_SERVER_CLIENT_ID takes the first type-3 client of the environment's package", () => {
  const pair = devPair();
  pair.android.clients[0].type3 = ["111-web-b.apps", "111-web-a.apps"];
  assert.strictEqual(derive({ ...pair, json: googleServicesJson(pair.android) }).OAUTH_GOOGLE_SERVER_CLIENT_ID, "111-web-b.apps");
});

test("a native file from another app contributes no key, not even the project's", () => {
  const androidOnly = K.deriveKeys({ ...K.nativeFacts(devPair().json, null), androidId: "com.acme.shop.qa", iosId: "com.acme.shop.qa" });
  assert.deepStrictEqual(androidOnly, {}, "no client has the package, so the file says nothing about this environment");

  const iosOther = K.deriveKeys({ ...K.nativeFacts(null, devPair().plist), androidId: "com.acme.shop.qa", iosId: "com.acme.shop.qa" });
  assert.deepStrictEqual(iosOther, {}, "a plist whose BUNDLE_ID is another app's is not this environment's file");

  const iosUnknownId = K.deriveKeys({ ...K.nativeFacts(null, devPair().plist), androidId: null, iosId: null });
  assert.strictEqual(iosUnknownId.FIREBASE_IOS_APP_ID, "1:111111111111:ios:cccc", "without a known iOS id the plist is taken as it is");
});

test("a key the two files disagree on is left out, and the agreeing keys stay", () => {
  const pair = devPair({ ios: { PROJECT_ID: "acme-other", GCM_SENDER_ID: "111111111111" } });
  const derived = derive(pair);
  assert.ok(!("FIREBASE_PROJECT_ID" in derived));
  assert.strictEqual(derived.FIREBASE_MESSAGING_SENDER_ID, "111111111111");
  assert.strictEqual(derived.FIREBASE_IOS_APP_ID, "1:111111111111:ios:cccc");
});

test("compareKeys gives each state, compares numbers as text, and skips optional keys the env file does not set", () => {
  const derived = derive(devPair());
  const env = {
    NAME: "DEV",
    API_URL: "https://dev.example.invalid",
    FIREBASE_PROJECT_ID: "acme-dev-staging",
    FIREBASE_MESSAGING_SENDER_ID: 111111111111,
    FIREBASE_IOS_CLIENT_ID: "111-stale-ios.apps",
    FIREBASE_WEB_APP_ID: "1:111:web:dddd",
  };
  delete derived.FIREBASE_STORAGE_BUCKET;
  const rows = K.compareKeys(env, derived);
  assert.deepStrictEqual(rows, [
    { key: "FIREBASE_PROJECT_ID", state: "match" },
    { key: "FIREBASE_MESSAGING_SENDER_ID", state: "match" },
    { key: "FIREBASE_ANDROID_APP_ID", state: "missing-in-env" },
    { key: "FIREBASE_ANDROID_API_KEY", state: "missing-in-env" },
    { key: "FIREBASE_IOS_APP_ID", state: "missing-in-env" },
    { key: "FIREBASE_IOS_API_KEY", state: "missing-in-env" },
    { key: "FIREBASE_IOS_BUNDLE_ID", state: "missing-in-env" },
    { key: "FIREBASE_IOS_CLIENT_ID", state: "differs" },
  ]);

  const noNative = K.compareKeys({ FIREBASE_PROJECT_ID: "acme-prod", OAUTH_GOOGLE_SERVER_CLIENT_ID: "x" }, {});
  assert.deepStrictEqual(noNative, [
    { key: "FIREBASE_PROJECT_ID", state: "not-derivable" },
    { key: "OAUTH_GOOGLE_SERVER_CLIENT_ID", state: "not-derivable" },
  ]);
  assert.deepStrictEqual(K.compareKeys(null, {}), []);
});

test("compareKeys returns no value and no digest, from either side", () => {
  const pair = devPair();
  const derived = derive(pair);
  const env = {
    FIREBASE_ANDROID_API_KEY: "AIza-SENTINEL-ENV-ANDROID",
    FIREBASE_IOS_API_KEY: "AIza-SENTINEL-IOS-DEV",
    FIREBASE_ANDROID_CLIENT_ID: "SENTINEL-ENV-CLIENT",
  };
  const rows = K.compareKeys(env, derived);
  const printed = JSON.stringify(rows);
  for (const value of [...Object.values(env), ...Object.values(derived)]) {
    assert.ok(!printed.includes(value), `a value leaked into the comparison: ${value.slice(0, 4)}...`);
  }
  assert.ok(!/SENTINEL/.test(printed));
  assert.ok(!/[0-9a-f]{8,}/.test(printed), "no digest is returned either");
  for (const r of rows) assert.deepStrictEqual(Object.keys(r), ["key", "state"]);
});

test("the plist reader handles entities, empty strings, booleans, integers, comments and CDATA", () => {
  const xml = infoPlist({ BUNDLE_ID: "com.acme.shop", NOTE: "a<b & \"c\"", EMPTY: "", ON: true, OFF: false, COUNT: 7 })
    .replace("<string></string>", "<string/>")
    .replace("<dict>", "<dict>\n\t<!-- downloaded from the console -->\n\t<key>RAW</key>\n\t<string><![CDATA[x<y]]></string>");
  assert.deepStrictEqual(K.nativeFacts(null, xml).ios, {
    RAW: "x<y", BUNDLE_ID: "com.acme.shop", NOTE: 'a<b & "c"', EMPTY: "", ON: true, OFF: false, COUNT: 7,
  });
});

test("malformed native files raise NativeParseError naming the file and never quoting its content", () => {
  const cases = [
    ["not json SENTINEL-CONTENT {", null, "google-services.json"],
    ["[1, 2]", null, "google-services.json"],
    [null, "<plist><dict><key>K</key><array><string>SENTINEL-CONTENT</string></array></dict></plist>", "GoogleService-Info.plist"],
    [null, "<plist><dict><key>K</key><string>SENTINEL-CONTENT</string></dict>", "GoogleService-Info.plist"],
    [null, "<plist><dict>SENTINEL-CONTENT</dict></plist>", "GoogleService-Info.plist"],
    [null, "<plist><dict><key>K</key><string>&bogus; SENTINEL-CONTENT</string></dict></plist>", "GoogleService-Info.plist"],
  ];
  for (const [json, plist, file] of cases) {
    assert.throws(() => K.nativeFacts(json, plist), (e) => {
      assert.ok(e instanceof K.NativeParseError);
      assert.strictEqual(e.file, file);
      assert.ok(!e.message.includes("SENTINEL"), `the error quotes the file: ${e.message}`);
      return true;
    });
  }
  assert.deepStrictEqual(K.nativeFacts(null, null), { android: null, ios: null });
});

test("the Android rows read google-services.json the way the Gradle plugin does", () => {
  const json = JSON.stringify({
    project_info: { project_number: "111111111111", project_id: "acme-dev-staging", storage_bucket: "acme-dev-staging.appspot.com" },
    client: [{
      client_info: { mobilesdk_app_id: "1:111111111111:android:aaaa", android_client_info: { package_name: "com.acme.shop.dev" } },
      oauth_client: [
        { client_type: "3" },
        { client_id: "111-web-string-type.apps", client_type: "3" },
        { client_id: "111-android-string-type.apps", client_type: "1" },
      ],
      api_key: [{}, { current_key: "AIza-SENTINEL-SECOND-ENTRY" }],
    }],
  });
  const d = K.deriveKeys({ ...K.nativeFacts(json, null), androidId: "com.acme.shop.dev", iosId: null });
  assert.strictEqual(d.OAUTH_GOOGLE_SERVER_CLIENT_ID, "111-web-string-type.apps", "the first type-3 entry that has a client_id, with client_type read as text");
  assert.strictEqual(d.FIREBASE_ANDROID_CLIENT_ID, "111-android-string-type.apps", "a type-1 entry without android_info is its client's");
  assert.strictEqual(d.FIREBASE_ANDROID_API_KEY, "AIza-SENTINEL-SECOND-ENTRY", "the first api_key entry that has a current_key");
});

test("plist integers read as text, so they agree or disagree with the JSON's strings", () => {
  assert.strictEqual(derive(devPair({ ios: { GCM_SENDER_ID: 111111111111 } })).FIREBASE_MESSAGING_SENDER_ID, "111111111111");
  assert.ok(!("FIREBASE_MESSAGING_SENDER_ID" in derive(devPair({ ios: { GCM_SENDER_ID: 999 } }))), "an integer that differs is a disagreement");
  const iosOnly = K.deriveKeys({ ...K.nativeFacts(null, devPair({ ios: { GCM_SENDER_ID: 111111111111 } }).plist), androidId: null, iosId: "com.acme.shop.dev" });
  assert.strictEqual(iosOnly.FIREBASE_MESSAGING_SENDER_ID, "111111111111");
});

test("every key in the table is one of the spec's Firebase env keys", () => {
  assert.deepStrictEqual(K.KEYS.map((r) => r.key).sort(), [
    "FIREBASE_ANDROID_API_KEY", "FIREBASE_ANDROID_APP_ID", "FIREBASE_ANDROID_CLIENT_ID", "FIREBASE_IOS_API_KEY",
    "FIREBASE_IOS_APP_ID", "FIREBASE_IOS_BUNDLE_ID", "FIREBASE_IOS_CLIENT_ID", "FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET", "OAUTH_GOOGLE_SERVER_CLIENT_ID",
  ]);
  assert.deepStrictEqual(K.KEYS.filter((r) => r.optional).map((r) => r.key), ["FIREBASE_ANDROID_CLIENT_ID", "OAUTH_GOOGLE_SERVER_CLIENT_ID"]);
});

test("the table is the vocabulary's: every key CONVENTIONS.firebaseKeys names, read from the field it names", () => {
  const { android, ios } = CONVENTIONS.firebaseKeys;
  assert.deepStrictEqual(K.KEYS.map((r) => r.key).sort(), [...new Set([...Object.keys(android), ...Object.keys(ios)])].sort());
  for (const r of K.KEYS) {
    assert.strictEqual(Boolean(r.android), r.key in android, `${r.key} reads google-services.json`);
    assert.strictEqual(Boolean(r.ios), r.key in ios, `${r.key} reads GoogleService-Info.plist`);
    if (r.ios) assert.strictEqual(r.ios({ [ios[r.key]]: "SENTINEL-FIELD" }), "SENTINEL-FIELD", `${r.key} reads ${ios[r.key]}`);
  }
});

test("a vocabulary field the reader does not know fails at load instead of dropping its key", () => {
  assert.throws(() => K.table({ android: { FIREBASE_PROJECT_ID: "project_id", FIREBASE_NEW_KEY: "some_new_field" }, ios: {} }), /no reader for the google-services\.json field some_new_field of FIREBASE_NEW_KEY/);
});
