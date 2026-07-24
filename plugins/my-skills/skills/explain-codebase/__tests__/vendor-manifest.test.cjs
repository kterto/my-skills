// Vendored-runtime integrity gate for FEAT-20260723T141806Z-d784 (arch-6). The opaque
// 3.3 MB Mermaid runtime is coupled to the template, CSP, sanitizer, index, and demo
// builder. references/vendor/mermaid.manifest.json records its upstream identity; this test
// verifies the on-disk mermaid.min.js still matches that manifest (byte size + sha256), so a
// silent swap or corruption of the vendored blob is caught in CI/pre-commit.
// Run: node --test   (or: node __tests__/vendor-manifest.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const VENDOR = path.join(__dirname, "..", "references", "vendor");
const MANIFEST = path.join(VENDOR, "mermaid.manifest.json");

test("vendor manifest exists and records the required lifecycle fields", () => {
  assert.ok(fs.existsSync(MANIFEST), "references/vendor/mermaid.manifest.json must exist");
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  for (const key of ["package", "version", "file", "bytes", "sha256", "source", "license", "updateProcedure", "compatibilityGates"]) {
    assert.ok(m[key] !== undefined && m[key] !== "", `manifest must record ${key}`);
  }
  assert.match(m.sha256, /^[0-9a-f]{64}$/, "sha256 must be a 64-hex digest");
});

test("vendored runtime matches the manifest byte size and sha256", () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const runtimePath = path.join(VENDOR, m.file);
  assert.ok(fs.existsSync(runtimePath), `${m.file} must exist`);
  const buf = fs.readFileSync(runtimePath);
  assert.strictEqual(buf.length, m.bytes, `byte size drift: on disk ${buf.length}, manifest ${m.bytes}`);
  const digest = crypto.createHash("sha256").update(buf).digest("hex");
  assert.strictEqual(digest, m.sha256, "sha256 drift — vendored runtime changed without updating the manifest (arch-6)");
});
