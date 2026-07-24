#!/usr/bin/env node
// Generate the fully-inlined explain-codebase demo as a NON-SHIPPED review artifact,
// through the same runtime-inlining path the skill uses at render time (SKILL.md Phase 4
// step 6). The shipped demo (references/report-template.demo.html) carries only the
// <!-- MERMAID_RUNTIME --> marker, so the 3.3 MB vendored runtime lives in exactly ONE
// place (references/vendor/mermaid.min.js) and is never duplicated in git (bug-6). Run
// this to eyeball the diagrams rendering; the output is .gitignored.
//
//   node scripts/build-explain-inlined-demo.mjs
//   -> build/explain-codebase/report-template.demo.inlined.html   (git-ignored)
//
// The output lands OUTSIDE the skills tree (repo-root build/) on purpose: the hosted skill
// index (scripts/generate-opencode-skill-index.mjs) walks the skill directories, so a heavy
// generated artifact placed under references/ would pollute the index. build/ is git-ignored.

import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))));
const ref = join(repoRoot, "plugins", "my-skills", "skills", "explain-codebase", "references");
const demoPath = join(ref, "report-template.demo.html");
const runtimePath = join(ref, "vendor", "mermaid.min.js");
const buildRoot = join(repoRoot, "build");
const outDir = join(buildRoot, "explain-codebase");
const outPath = join(outDir, "report-template.demo.inlined.html");

const MARKER = "<!-- MERMAID_RUNTIME -->";
const demo = readFileSync(demoPath, "utf8");
if (!demo.includes(MARKER)) {
  console.error(`${demoPath} has no ${MARKER} marker — nothing to inline`);
  process.exit(1);
}
// Escape any `</script` so the runtime can't close its wrapping <script> early (there are
// none in the vetted build, but stay safe), then substitute LITERALLY — a function
// replacement so `$&`/`$'`-shaped substrings in the minified runtime are not expanded.
const runtime = readFileSync(runtimePath, "utf8").replace(/<\/script/gi, "<\\/script");
const block = `<script id="mermaid-runtime">${runtime}</script>`;
const out = demo.replace(MARKER, () => block);

// --- Symlink-safe output write (sec-4) ------------------------------------------------
// mkdirSync/writeFileSync follow symlinked components, so a pre-planted symlink at build/,
// build/explain-codebase, or the target could redirect this developer command to overwrite a
// path outside the repo. Reject symlinked components, verify the canonical parent is the
// expected build dir under the repo, and write via an exclusive same-dir temp + atomic rename.
const refuse = (msg) => { console.error(`refusing: ${msg}`); process.exit(1); };
const lstatOrNull = (p) => { try { return lstatSync(p); } catch { return null; } };

for (const p of [buildRoot, outDir, outPath]) {
  const st = lstatOrNull(p);
  if (st && st.isSymbolicLink()) refuse(`${p} is a symlink`);
}
mkdirSync(outDir, { recursive: true });                 // real dirs only (guarded above)
const outDirReal = realpathSync(outDir);
if (outDirReal !== outDir || !(outDirReal + sep).startsWith(join(buildRoot) + sep)) {
  refuse(`build output dir escapes ${buildRoot}`);
}
const tmpPath = join(outDirReal, `.${basename(outPath)}.${process.pid}.tmp`);
const tmpExisting = lstatOrNull(tmpPath);
if (tmpExisting) unlinkSync(tmpPath);                    // clear a stale/planted temp
writeFileSync(tmpPath, out, { flag: "wx", mode: 0o644 }); // wx: exclusive create, never follow a symlink
const destExisting = lstatOrNull(outPath);
if (destExisting && destExisting.isSymbolicLink()) { rmSync(tmpPath, { force: true }); refuse(`${outPath} became a symlink`); }
renameSync(tmpPath, outPath);                            // atomic same-dir replace
console.log(`wrote ${outPath} (${out.length} bytes) — non-shipped, git-ignored`);
