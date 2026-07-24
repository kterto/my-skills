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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ref = join(repoRoot, "plugins", "my-skills", "skills", "explain-codebase", "references");
const demoPath = join(ref, "report-template.demo.html");
const runtimePath = join(ref, "vendor", "mermaid.min.js");
const outDir = join(repoRoot, "build", "explain-codebase");
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

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, out);
console.log(`wrote ${outPath} (${out.length} bytes) — non-shipped, git-ignored`);
