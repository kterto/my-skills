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

function writeReport(dest, content) {
  const dir = path.dirname(dest);
  // The output dir must be a real directory (not a symlink) and the dest must not be a symlink.
  const ds = lstatOrNull(dir);
  if (!ds || !ds.isDirectory() || ds.isSymbolicLink()) refuse(`${dir} is not a real directory`);
  const cur = lstatOrNull(dest);
  if (cur && cur.isSymbolicLink()) refuse(`${dest} is a symlink`);

  // Exclusive, no-follow temp in the SAME directory (same filesystem → atomic rename).
  let fd, tmp;
  for (let i = 0; i < 8; i++) {
    tmp = path.join(dir, `.report-${process.pid}-${i}-${Buffer.from([i, Date.now() & 0xff]).toString("hex")}.tmp`);
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
    const st = fs.fstatSync(fd);
    if (!st.isFile()) { fs.closeSync(fd); fs.rmSync(tmp, { force: true }); refuse("temp is not a regular file"); }
  } catch (e) {
    try { fs.closeSync(fd); } catch {}
    fs.rmSync(tmp, { force: true });
    refuse(`write failed: ${e.message}`);
  }
  fs.closeSync(fd);
  // Final symlink re-check on the destination, then atomic rename of OUR exclusive temp.
  const cur2 = lstatOrNull(dest);
  if (cur2 && cur2.isSymbolicLink()) { fs.rmSync(tmp, { force: true }); refuse(`${dest} became a symlink`); }
  fs.renameSync(tmp, dest);
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
