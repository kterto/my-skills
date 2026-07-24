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
const crypto = require("node:crypto");

const O_NOFOLLOW = fs.constants.O_NOFOLLOW || 0; // 0 on platforms without it (best-effort)
const NUL = String.fromCharCode(0); // avoid a literal NUL byte in this source file

// git blob object id of a buffer = sha1("blob <len>\0" + bytes) — lets us compare the
// materialized snapshot bytes to HEAD's blob ids without shelling out per file.
function gitBlobId(buf) {
  const h = crypto.createHash("sha1");
  h.update(`blob ${buf.length}${NUL}`);
  h.update(buf);
  return h.digest("hex");
}

// Verify the COMPLETED snapshot against HEAD (arch-1): the report may only advertise a clean
// commit identity when every snapshot file's bytes equal HEAD's blob for that path. Any path
// missing from HEAD or differing means the working tree diverged from the commit at copy time —
// disclosed as dirty, never hidden behind the bare commit hash.
function verifyAgainstHead(destDir, copied, headBlobs) {
  const blobs = headBlobs instanceof Map ? headBlobs : new Map(Object.entries(headBlobs || {}));
  const dirty = [];
  for (const rel of copied) {
    const id = gitBlobId(fs.readFileSync(path.join(destDir, rel)));
    if (blobs.get(rel) !== id) dirty.push(rel);
  }
  return { clean: dirty.length === 0, dirty };
}

// Parse `git ls-tree -r -z HEAD` output → Map(path -> blobid).
function parseLsTreeZ(buf) {
  const m = new Map();
  for (const entry of buf.toString("utf8").split(NUL)) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    if (tab === -1) continue;
    const meta = entry.slice(0, tab).split(/\s+/); // <mode> <type> <sha>
    if (meta[1] === "blob") m.set(entry.slice(tab + 1), meta[2]);
  }
  return m;
}

function isContained(root, p) {
  const rel = path.relative(root, path.resolve(root, p));
  return rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
}

const O_DIRECTORY = fs.constants.O_DIRECTORY || 0;

// Open `root/rel` for reading with NO symlink anywhere in the path (sec-1). O_NOFOLLOW guards
// only the FINAL component, so a swapped-in symlinked PARENT could otherwise escape the repo. We
// (1) open EVERY ancestor directory with O_NOFOLLOW|O_DIRECTORY (a symlinked ancestor fails
// ELOOP), and (2) re-assert with realpath that the resolved file stays under the resolved root
// (catches any symlink that slipped a component). Node lacks openat, so this is the strongest
// portable form; the caller's pre/post fstat closes the in-place-mutation window. Returns the fd.
function openContainedNoFollow(root, rel) {
  const parts = rel.split("/").filter(Boolean);
  // Verify each ancestor directory is a real (non-symlink) directory.
  let acc = root;
  for (let i = 0; i < parts.length - 1; i++) {
    acc = path.join(acc, parts[i]);
    const dfd = fs.openSync(acc, fs.constants.O_RDONLY | O_NOFOLLOW | O_DIRECTORY); // ELOOP if symlink
    try {
      if (!fs.fstatSync(dfd).isDirectory()) { const e = new Error("not a directory"); e.code = "ENOTDIR"; throw e; }
    } finally { fs.closeSync(dfd); }
  }
  const abs = path.join(root, rel);
  const fd = fs.openSync(abs, fs.constants.O_RDONLY | O_NOFOLLOW); // ELOOP if the final is a symlink
  // Canonical-containment re-check: realpath resolves any symlink in the chain; if it escapes the
  // resolved root, refuse (defends the residual no-openat race on ancestors).
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(abs);
  if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) {
    fs.closeSync(fd);
    const e = new Error("resolves outside the repo root"); e.code = "EXDEV_CONTAIN"; throw e;
  }
  return fd;
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
    let fd;
    try {
      fd = openContainedNoFollow(root, rel);
    } catch (e) {
      const reason = e.code === "ELOOP" ? "symlink in path (no-follow)"
        : e.code === "EXDEV_CONTAIN" ? "resolves outside repo"
        : `open failed: ${e.code || e.message}`;
      skipped.push({ path: rel, reason });
      continue;
    }
    try {
      const st = fs.fstatSync(fd); // PRE-read metadata
      if (!st.isFile()) { skipped.push({ path: rel, reason: "not a regular file" }); continue; }
      const buf = Buffer.allocUnsafe(st.size);
      let off = 0;
      while (off < st.size) {
        const n = fs.readSync(fd, buf, off, st.size - off, off);
        if (n <= 0) break;
        off += n;
      }
      // POST-read metadata: abort if the file was mutated in place during the read (sec-1).
      const st2 = fs.fstatSync(fd);
      if (st2.ino !== st.ino || st2.size !== st.size || st2.mtimeMs !== st.mtimeMs) {
        skipped.push({ path: rel, reason: "changed during read (pre/post metadata differ)" });
        continue;
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

module.exports = { materializeSnapshot, gitBlobId, verifyAgainstHead, parseLsTreeZ };

// --- CLI ------------------------------------------------------------------------------
// node snapshot-scope.cjs <root> <inventory-NUL-file> <destDir> [head-lstree-z-file]
// With the optional `git ls-tree -r -z HEAD` file, prints `dirty: <n>` (0 = the snapshot
// bytes equal HEAD and the report may advertise a clean commit; >0 = disclose as dirty).
if (require.main === module) {
  const [root, invFile, destDir, headFile] = process.argv.slice(2);
  if (!root || !invFile || !destDir) {
    console.error("usage: snapshot-scope.cjs <root> <inventory-NUL-file> <destDir> [head-lstree-z-file]");
    process.exit(2);
  }
  const paths = fs.readFileSync(invFile, "utf8").split("\0").filter(Boolean);
  const { copied, skipped } = materializeSnapshot(path.resolve(root), paths, path.resolve(destDir));
  console.log(`snapshot: ${copied.length} file(s) materialized, ${skipped.length} skipped`);
  for (const s of skipped) console.error(`skipped ${s.path}: ${s.reason}`);
  if (headFile) {
    const { dirty } = verifyAgainstHead(path.resolve(destDir), copied, parseLsTreeZ(fs.readFileSync(headFile)));
    console.log(`dirty: ${dirty.length}`);
    for (const d of dirty) console.error(`differs from HEAD: ${d}`);
  }
  process.exit(skipped.length ? 1 : 0);
}
