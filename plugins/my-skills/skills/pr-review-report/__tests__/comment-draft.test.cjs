// Regression fixture for bug-3: unsent comment drafts must survive a rerender (which
// rebuilds every finding card's HTML). Drafts are kept per-fingerprint in DRAFTS,
// restored when the comment box is rebuilt, and cleared once the comment is added.
// Run: node __tests__/comment-draft.test.cjs   (exits non-zero on failure)
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "references", "report-template.html"), "utf8");
function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert(start >= 0, "not found: " + name);
  let i = src.indexOf("{", start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error("unbalanced: " + name);
}

let DRAFTS = {}, STORE = {}, STATE_READONLY = false, OP_LOG = [];
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function nowTs(){return "2026-07-19T00:00:00Z";}
let persisted = false, rerendered = false;
function persist(){persisted = true;}
function rerender(){rerendered = true;}

eval(extractFn(html, "commentBox"));
eval(extractFn(html, "addUserComment"));

// 1) A stored draft is restored into the rebuilt textarea.
DRAFTS = { "bugs|f.ts|x": "half-written note" };
let box = commentBox("bugs|f.ts|x");
assert(/half-written note/.test(box), "draft restored into the rebuilt comment box");

// 2) A card with no draft renders an empty textarea.
let empty = commentBox("bugs|f.ts|y");
assert(/<textarea[^>]*><\/textarea>/.test(empty), "no-draft box is empty");

// 3) Draft text is HTML-escaped (never breaks out of the textarea).
DRAFTS = { "bugs|f.ts|z": "</textarea><script>alert(1)</script>" };
let evil = commentBox("bugs|f.ts|z");
assert(!/<\/textarea><script>/.test(evil), "draft is escaped, cannot terminate the textarea");
assert(/&lt;\/textarea&gt;/.test(evil), "draft angle brackets are entity-escaped");

// 4) Submitting a comment clears its draft (so the rebuilt box comes back empty).
STORE = { "bugs|f.ts|x": { state: "open", thread: [], history: [], lastFinding: null } };
DRAFTS = { "bugs|f.ts|x": "will be sent" };
addUserComment("bugs|f.ts|x", "will be sent");
assert.strictEqual(DRAFTS["bugs|f.ts|x"], undefined, "draft cleared after the comment is added");
assert.strictEqual(STORE["bugs|f.ts|x"].thread.length, 1, "comment appended to the thread");
assert(commentBox("bugs|f.ts|x").indexOf("will be sent") === -1 ||
       /<textarea[^>]*><\/textarea>/.test(commentBox("bugs|f.ts|x")), "rebuilt box is empty after send");

console.log("PASS: comment draft persistence (bug-3)");
