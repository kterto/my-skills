"use strict";
// Trusted, TOCTOU-safe report writer (sec-2). `mktemp` + the host Write tool splits the write
// into "create+close a checked temp" then "reopen that pathname and write" — between them an
// attacker who can mutate the output dir can replace the checked temp with a symlink and
// redirect the write. This helper never reopens by name: it opens the temp ONCE with
// O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW, writes+fsyncs+fstats through that same descriptor, then
// atomically renames it over the destination after a final symlink re-check — all in one
// process. Content comes from stdin (or a --content file); nothing else can interpose.
//
// CLI: node write-report.cjs <dest.html> [--content <file>]   (default: content on stdin)

const fs = require("node:fs");
const path = require("node:path");

const O_NOFOLLOW = fs.constants.O_NOFOLLOW || 0;

function refuse(msg) { throw new Error(`refusing: ${msg}`); } // CLI turns this into exit 1
function lstatOrNull(p) { try { return fs.lstatSync(p); } catch { return null; } }

const O_DIRECTORY = fs.constants.O_DIRECTORY || 0;

function writeReport(dest, content) {
  const dir = path.dirname(dest);
  // Open the output dir ONCE with O_NOFOLLOW|O_DIRECTORY and record its identity (dev+ino).
  // Node has no openat/renameat, so temp create + rename are still by path — but every such
  // step is bracketed by a re-verification that the dir path still resolves to the SAME real
  // directory (sec-2). A swap of `docs/explain` for a symlink between steps changes the identity
  // (or makes the path a symlink) and is refused, so the write can't be redirected outside.
  let dirFd;
  try { dirFd = fs.openSync(dir, fs.constants.O_RDONLY | O_NOFOLLOW | O_DIRECTORY); }
  catch (e) { refuse(`${dir} is not a real directory (${e.code})`); }
  const dirId = fs.fstatSync(dirFd);
  const assertSameDir = () => {
    const l = lstatOrNull(dir);
    if (!l || l.isSymbolicLink() || !l.isDirectory()) refuse(`${dir} is no longer a real directory (swapped?)`);
    const now = fs.statSync(dir);
    if (now.dev !== dirId.dev || now.ino !== dirId.ino) refuse(`${dir} identity changed mid-write (swap detected)`);
  };
  try {
    const cur = lstatOrNull(dest);
    if (cur && cur.isSymbolicLink()) refuse(`${dest} is a symlink`);

    // Exclusive, no-follow temp in the SAME (verified) directory.
    assertSameDir();
    let fd, tmp;
    for (let i = 0; i < 8; i++) {
      tmp = path.join(dir, `.report-${process.pid}-${i}-${Buffer.from([i, (i * 7 + 13) & 0xff]).toString("hex")}.tmp`);
      try {
        fd = fs.openSync(tmp, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | O_NOFOLLOW, 0o644);
        break;
      } catch (e) {
        if (e.code === "EEXIST") { tmp = null; continue; }
        refuse(`cannot create temp: ${e.code}`);
      }
    }
    if (fd === undefined) refuse("could not create an exclusive temp");
    try {
      const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
      let off = 0;
      while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
      fs.fsyncSync(fd);
      if (!fs.fstatSync(fd).isFile()) throw new Error("temp is not a regular file");
    } catch (e) {
      try { fs.closeSync(fd); } catch {}
      fs.rmSync(tmp, { force: true });
      refuse(`write failed: ${e.message}`);
    }
    fs.closeSync(fd);
    // Re-verify the dir identity and the destination just before the atomic rename.
    try {
      assertSameDir();
      const cur2 = lstatOrNull(dest);
      if (cur2 && cur2.isSymbolicLink()) throw new Error(`${dest} became a symlink`);
      // An existing destination must be a REGULAR file (bug-4): renaming onto a directory throws
      // AFTER the temp is created and would leak it; refuse (and clean up) explicitly.
      if (cur2 && !cur2.isFile()) throw new Error(`${dest} exists and is not a regular file`);
      fs.renameSync(tmp, dest);
    } catch (e) {
      fs.rmSync(tmp, { force: true }); // cleanup-on-error (bug-4): no .report-*.tmp left behind
      throw e;
    }
  } finally {
    fs.closeSync(dirFd);
  }
}

module.exports = { writeReport };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dest = args[0];
  if (!dest) { console.error("usage: write-report.cjs <dest.html> [--content <file>]"); process.exit(2); }
  const ci = args.indexOf("--content");
  const content = ci !== -1 ? fs.readFileSync(args[ci + 1]) : fs.readFileSync(0);
  try {
    writeReport(path.resolve(dest), content);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  console.log(`wrote ${dest} (${content.length} bytes)`);
}
