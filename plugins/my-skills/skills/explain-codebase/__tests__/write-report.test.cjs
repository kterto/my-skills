// TOCTOU-safe report writer tests (sec-2): writes through one exclusive no-follow descriptor,
// refuses a symlinked destination, and lands atomically.
// Run: node --test   (or: node __tests__/write-report.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { writeReport } = require("../references/write-report.cjs");

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), "wr-")); }

test("writes content atomically into a real directory", () => {
  const dir = tmpDir();
  const dest = path.join(dir, "report.html");
  writeReport(dest, "<html>ok</html>");
  assert.strictEqual(fs.readFileSync(dest, "utf8"), "<html>ok</html>");
  // No temp residue left behind.
  assert.deepStrictEqual(fs.readdirSync(dir).filter((f) => f.startsWith(".report-")), []);
});

test("overwrites a prior regular file (atomic replace)", () => {
  const dir = tmpDir();
  const dest = path.join(dir, "report.html");
  fs.writeFileSync(dest, "OLD");
  writeReport(dest, "NEW");
  assert.strictEqual(fs.readFileSync(dest, "utf8"), "NEW");
});

test("refuses a symlinked destination (no redirect)", () => {
  const dir = tmpDir();
  const outside = path.join(tmpDir(), "victim");
  fs.writeFileSync(outside, "PROTECTED");
  const dest = path.join(dir, "report.html");
  fs.symlinkSync(outside, dest);
  assert.throws(() => writeReport(dest, "<html>evil</html>"), /process\.exit|refus/i);
  // The symlink target must be untouched.
  assert.strictEqual(fs.readFileSync(outside, "utf8"), "PROTECTED");
});

test("refuses when the output dir is a symlink", () => {
  const realDir = tmpDir();
  const linkDir = path.join(tmpDir(), "linkdir");
  fs.symlinkSync(realDir, linkDir);
  assert.throws(() => writeReport(path.join(linkDir, "r.html"), "x"), /process\.exit|refus/i);
});
