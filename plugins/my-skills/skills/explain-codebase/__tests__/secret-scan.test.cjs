// Adversarial fixtures for the final secret-scan gate (sec-2). One case per promised class,
// plus the false-positive guards that keep a legitimately-redacted report publishable.
// Run: node --test   (or: node __tests__/secret-scan.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const { scanSecrets } = require("../references/scan-secrets.cjs");

const hitTypes = (s) => scanSecrets(s).map((h) => h.type);

test("private key blocks are caught", () => {
  assert.ok(hitTypes("-----BEGIN RSA PRIVATE KEY-----\nMIIB...\n-----END").includes("private-key-block"));
  assert.ok(hitTypes("-----BEGIN OPENSSH PRIVATE KEY-----").includes("private-key-block"));
});

test("token families are caught", () => {
  assert.ok(hitTypes("AKIA1234567890ABCDEF").includes("aws-access-key-id"));
  assert.ok(hitTypes("ghp_" + "a".repeat(36)).includes("github-token"));
  assert.ok(hitTypes("github_pat_" + "a".repeat(30)).includes("github-token"));
  assert.ok(hitTypes("xoxb-123456789012-abcdefABCDEF").includes("slack-token"));
  assert.ok(hitTypes("sk-" + "A".repeat(32)).includes("openai-key"));
  assert.ok(hitTypes("AIza" + "B".repeat(35)).includes("google-api-key"));
  assert.ok(hitTypes("sk_live_" + "c".repeat(24)).includes("stripe-key"));
  assert.ok(hitTypes("eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2Q").includes("jwt"));
});

test("ordinary password / api_key assignments are caught (the earlier gap)", () => {
  assert.ok(hitTypes("password: hunter2secret").includes("credential-assignment"));
  assert.ok(hitTypes('api_key = "abcdef123456"').includes("credential-assignment"));
  assert.ok(hitTypes("DB_PASSWORD=s3cr3tvalue").includes("credential-assignment"));
});

test("connection strings with embedded credentials are caught (portable regex, no POSIX \\s)", () => {
  assert.ok(hitTypes("postgres://user:p4ssw0rd@db.example:5432/app").includes("connection-string-credentials"));
  assert.ok(hitTypes("mongodb://admin:secretpw@host/db").includes("connection-string-credentials"));
});

test("generic high-entropy hex/base64 blobs are caught", () => {
  assert.ok(hitTypes("deadbeef".repeat(8)).includes("hex-secret")); // 64 hex
  assert.ok(hitTypes("A1b2C3d4E5f6".repeat(4) + "==").includes("base64-secret")); // 48 base64
});

test("false positives are avoided: git SHA, redacted markers, key names, colors", () => {
  // 40-char git commit SHA is below the 64-hex threshold.
  assert.deepStrictEqual(scanSecrets("commit a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"), []);
  // A redacted value + shown key name is the INTENDED report shape, not a leak.
  assert.deepStrictEqual(scanSecrets("password: «redacted» (src/config.ts:4)"), []);
  assert.deepStrictEqual(scanSecrets('api_key = "«redacted»"'), []);
  // CSS color hex and short ids are far below thresholds.
  assert.deepStrictEqual(scanSecrets("color:#faf9f7; --accent:#3730a3;"), []);
});

test("the inlined mermaid runtime block is stripped before scanning", () => {
  const report = `<p>ok</p><script id="mermaid-runtime">${"ab12cd34".repeat(20)}</script><p>end</p>`;
  assert.deepStrictEqual(scanSecrets(report), [], "runtime block must not trip the scan");
});
