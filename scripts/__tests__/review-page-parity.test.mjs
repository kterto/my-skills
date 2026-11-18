// review-page-parity.test.mjs — ADR-0036. context-builder and roadmap each ship the review page reference
// and checker, because a skill never loads another skill's files at run time. This test holds the copies
// byte for byte, and holds the checker's net.*, js.* and csp.* rules to envision's render.cjs, which they
// were lifted from: a fix made in one place and not the others fails here. One divergence is deliberate
// (ADR-0036 decision 4): the checker reads only a page's code, never the text between tags, so prose that
// names @import or javascript: passes here and fails envision. The pages below hold no such prose.
//
//   node --test scripts/__tests__/review-page-parity.test.mjs

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SKILLS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "plugins", "my-skills", "skills")
const COPIES = ["context-builder", "roadmap"]
const FILES = ["references/review-page.md", "scripts/review-page.cjs"]
const require = createRequire(import.meta.url)

for (const file of FILES) {
  test(`${file} is the same in ${COPIES.join(" and ")}`, () => {
    const [first, ...rest] = COPIES.map((skill) => readFileSync(join(SKILLS, skill, ...file.split("/"))))
    for (const [i, other] of rest.entries()) assert.ok(first.equals(other), `${COPIES[i + 1]}/${file} differs from ${COPIES[0]}'s; copy it over`)
  })
}

const review = require(join(SKILLS, "context-builder", "scripts", "review-page.cjs"))
const envision = require(join(SKILLS, "envision", "scripts", "render.cjs"))
const good = readFileSync(join(SKILLS, "context-builder", "__tests__", "fixtures", "review-page-good.html"), "utf8")
const bad = readFileSync(join(SKILLS, "context-builder", "__tests__", "fixtures", "review-page-bad.html"), "utf8")
const SHARED = /^(?:net|js|csp)\./
const shared = (problems) => [...new Set(problems.map((p) => p.split(":")[0]).filter((c) => SHARED.test(c)))].sort()
const at = (html, js) => html.replace("paint();\n})();", `paint(); ${js};\n})();`)
const PAGES = [
  ["the good fixture", good],
  ["the bad fixture", bad],
  ["a script file", good.replace("</body>", '<script src="app.js"></script></body>')],
  ["a remote image", good.replace("</main>", '<img alt="" src="https&#58;//example.com/a.png"></main>')],
  ["a web font", good.replace("<style>", "<style>@font-face{font-family:X;src:url(https://example.com/x.woff2)}")],
  ["an @import", good.replace("<style>", "<style>@import url(look.css);")],
  ["an iframe", good.replace("</main>", "<iframe></iframe></main>")],
  ["fetch", at(good, "fetch('/x')")],
  ["location", at(good, "location.reload()")],
  ["an inline handler", good.replace("<main ", '<main onclick="x()" ')],
  ["a javascript: URL", good.replace("</main>", '<a href="javascript:x()">x</a></main>')],
  ["no CSP", good.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "")],
  ["a loose CSP", good.replace("default-src 'none'", "default-src *").replace("img-src data:", "img-src https:")],
  ["a stale hash", good.replace("script-src 'unsafe-inline'", "script-src 'sha256-AAAA'")],
]

for (const [what, html] of PAGES) {
  test(`the net, js and csp codes match envision's check on ${what}`, () => {
    assert.deepEqual(shared(review.check(html)), shared(envision.check(html)))
  })
}
