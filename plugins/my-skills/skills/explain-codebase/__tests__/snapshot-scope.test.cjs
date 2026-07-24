// Immutable-snapshot materialization tests (arch-1). The snapshot must copy working-tree
// bytes ONCE, refuse a symlink at copy time (no-follow), and refuse containment escapes — so
// subagents read frozen bytes the analyzed repo cannot ABA-swap.
// Run: node --test   (or: node __tests__/snapshot-scope.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { materializeSnapshot } = require("../references/snapshot-scope.cjs");

function tmpTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "snap-root-"));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "snap-dest-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "a.ts"), "export const a = 1;\n");
  fs.writeFileSync(path.join(root, "src", "with space.ts"), "spaced\n");
  return { root, dest };
}

test("copies vetted file bytes into the snapshot (paths with spaces survive)", () => {
  const { root, dest } = tmpTree();
  const res = materializeSnapshot(root, ["src/a.ts", "src/with space.ts"], dest);
  assert.deepStrictEqual(res.skipped, []);
  assert.strictEqual(fs.readFileSync(path.join(dest, "src/a.ts"), "utf8"), "export const a = 1;\n");
  assert.strictEqual(fs.readFileSync(path.join(dest, "src/with space.ts"), "utf8"), "spaced\n");
});

test("a symlink is refused at copy time (no-follow)", () => {
  const { root, dest } = tmpTree();
  fs.writeFileSync(path.join(os.tmpdir(), "snap-secret-target"), "SECRET");
  fs.symlinkSync(path.join(os.tmpdir(), "snap-secret-target"), path.join(root, "src", "evil.ts"));
  const res = materializeSnapshot(root, ["src/evil.ts"], dest);
  assert.deepStrictEqual(res.copied, [], "symlink must not be copied");
  assert.ok(res.skipped.some((s) => s.path === "src/evil.ts"), "symlink must be skipped");
  assert.ok(!fs.existsSync(path.join(dest, "src/evil.ts")), "no snapshot file for a symlink");
});

test("absolute / parent-traversal paths are refused", () => {
  const { root, dest } = tmpTree();
  const res = materializeSnapshot(root, ["/etc/passwd", "../outside.ts"], dest);
  assert.deepStrictEqual(res.copied, []);
  assert.strictEqual(res.skipped.length, 2);
  for (const s of res.skipped) assert.strictEqual(s.reason, "escapes containment");
});

test("snapshot copies are read-only regular files (immutable)", () => {
  const { root, dest } = tmpTree();
  materializeSnapshot(root, ["src/a.ts"], dest);
  const st = fs.statSync(path.join(dest, "src/a.ts"));
  assert.ok(st.isFile());
  assert.strictEqual(st.mode & 0o200, 0, "snapshot copy must not be writable");
});
