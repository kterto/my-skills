"use strict";
// Materialize an IMMUTABLE source snapshot (arch-1). Hashing the working tree before/after
// fan-out does not freeze the bytes a subagent reads: a collaborator can swap an allowlisted
// file (or a directory component) during the Read and restore it before the final hash — an
// ABA change, or a transient symlink, injects different or outside-repo content while both
// hashes match. So instead of hashing in place, COPY each vetted file's bytes ONCE into a
// scratch snapshot with a **no-follow** open, and dispatch subagents to read only the snapshot
// (which the analyzed repo cannot mutate). Original repo-relative paths are preserved as the
// report anchors.
//
// materializeSnapshot(root, paths, destDir) -> { copied: [...], skipped: [{path, reason}] }
//   root    absolute repo root (already canonicalized by the caller)
//   paths   array of repo-relative paths — the ONE canonical, vetted, secret-excluded
//           inventory (sec-1); this helper does NOT re-enumerate git, it only copies.
//   destDir absolute scratch dir OUTSIDE the analyzed repo.
//
// CLI: node snapshot-scope.cjs <root> <inventory-NUL-file> <destDir>
//   reads a NUL-delimited inventory file and materializes it; exits non-zero if any path is
//   refused (symlink / not a regular file / escapes containment).

const fs = require("node:fs");
const path = require("node:path");

const O_NOFOLLOW = fs.constants.O_NOFOLLOW || 0; // 0 on platforms without it (best-effort)

function isContained(root, p) {
  const rel = path.relative(root, path.resolve(root, p));
  return rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
}

function materializeSnapshot(root, paths, destDir) {
  const copied = [];
  const skipped = [];
  for (const rel of paths) {
    if (typeof rel !== "string" || rel.length === 0) continue;
    if (rel.startsWith("/") || rel.split("/").includes("..") || !isContained(root, rel)) {
      skipped.push({ path: rel, reason: "escapes containment" });
      continue;
    }
    const abs = path.join(root, rel);
    let fd;
    try {
      // O_NOFOLLOW: if the final component is a symlink, the open fails (ELOOP) — no swap-in
      // symlink can be followed at copy time. Read through this fd only.
      fd = fs.openSync(abs, fs.constants.O_RDONLY | O_NOFOLLOW);
    } catch (e) {
      skipped.push({ path: rel, reason: e.code === "ELOOP" ? "symlink (no-follow)" : `open failed: ${e.code}` });
      continue;
    }
    try {
      const st = fs.fstatSync(fd);
      if (!st.isFile()) { skipped.push({ path: rel, reason: "not a regular file" }); continue; }
      const buf = Buffer.allocUnsafe(st.size);
      let off = 0;
      while (off < st.size) {
        const n = fs.readSync(fd, buf, off, st.size - off, off);
        if (n <= 0) break;
        off += n;
      }
      const dest = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf.subarray(0, off), { flag: "wx", mode: 0o400 }); // exclusive, read-only
      copied.push(rel);
    } finally {
      fs.closeSync(fd);
    }
  }
  return { copied, skipped };
}

module.exports = { materializeSnapshot };

// --- CLI ------------------------------------------------------------------------------
if (require.main === module) {
  const [root, invFile, destDir] = process.argv.slice(2);
  if (!root || !invFile || !destDir) {
    console.error("usage: snapshot-scope.cjs <root> <inventory-NUL-file> <destDir>");
    process.exit(2);
  }
  const paths = fs.readFileSync(invFile, "utf8").split("\0").filter(Boolean);
  const { copied, skipped } = materializeSnapshot(path.resolve(root), paths, path.resolve(destDir));
  console.log(`snapshot: ${copied.length} file(s) materialized, ${skipped.length} skipped`);
  for (const s of skipped) console.error(`skipped ${s.path}: ${s.reason}`);
  process.exit(skipped.length ? 1 : 0);
}
