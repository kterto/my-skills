'use strict';
/**
 * Zero-dependency conformance tests for `render-artifact.cjs`, run via the
 * built-in Node test runner: `node --test .orchestrator/render-artifact.test.cjs`.
 * No jest / pnpm / yarn — this is standalone orchestrator tooling outside the workspaces.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Skill-source shims (no-ops in a materialized `.orchestrator/` run, where both
// env vars are unset and the sibling `plans/` + `html-templates/` already exist):
//   - point the renderer at the skill's canonical scaffolds (`templates/html/`);
//   - give the default allowed-base a real, existing dir (the skill root, which is
//     not an ancestor of the os.tmpdir fixtures) so the P4 containment cases still
//     reject instead of tripping on a missing `<repoRoot>/plans`.
// Children spawned below inherit these (they spread `...process.env`); per-test
// `RENDER_ARTIFACT_ALLOW_ROOT` overrides still win.
process.env.RENDER_ARTIFACT_TPL_DIR =
  process.env.RENDER_ARTIFACT_TPL_DIR || path.resolve(__dirname, '..', 'templates', 'html');
process.env.RENDER_ARTIFACT_ALLOW_ROOT =
  process.env.RENDER_ARTIFACT_ALLOW_ROOT || path.resolve(__dirname, '..');
const SCRIPT = path.join(__dirname, 'render-artifact.cjs');
const { toHtml, validateHtml, esc } = require('./render-artifact.cjs');

const PLAN_MD = `---
id: FEAT-20260101T000000Z-abcd
status: IN_PROGRESS
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-02T00:00:00Z
cycle: 1
---

**Related:** [SPEC-20260101T000000Z-0000](../specs/SPEC-20260101T000000Z-0000-x.md)

## Overview

Some overview text with **bold** and a [link](../specs/x.md).

## Tasks

- [ ] First task not done
- [x] Second task done
- plain non-task item

## Notes

A regular closing paragraph.
`;

const SPEC_MD = `---
id: SPEC-20260101T000000Z-abcd
status: DRAFT
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-02T00:00:00Z
cycle: 0
---

**Related:** —

## Problem Statement

A statement.

## Constraints

- one
- two
`;

const PROGRESS_MD = `# Progress: FEAT-20260101T000000Z-abcd

**Status**: IN_PROGRESS

---

## Log

### 2026-01-02T00:00:00Z | CODER

Completed task. Status IN_PROGRESS.

### 2026-01-01T00:00:00Z | ARCHITECT

Created plan. Status READY_FOR_PLANNING.
`;

const NO_SECTION_MD = `---
id: FEAT-20260101T000000Z-ffff
status: IN_PROGRESS
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-02T00:00:00Z
cycle: 0
---

# A title with no sections

Just a paragraph and no top-level headings at all.
`;

const planHtml = () => toHtml('/repo/plans/feat/FEAT-20260101T000000Z-abcd-fixture.md', PLAN_MD);
const specHtml = () => toHtml('/repo/plans/specs/SPEC-20260101T000000Z-abcd-fixture.md', SPEC_MD);
const progressHtml = () =>
  toHtml('/repo/plans/feat/FEAT-20260101T000000Z-abcd-fixture.progress.md', PROGRESS_MD);

// ---------- Phase 1 ----------

test('P1(a) each ## section becomes a <details open> block and no bare <article> remains', () => {
  const html = planHtml();
  assert.match(html, /<section class="section">\s*<details open>\s*<summary>Overview<\/summary>/);
  assert.match(html, /<summary>Tasks<\/summary>/);
  assert.match(html, /<div class="details__body">/);
  assert.doesNotMatch(html, /<article>/);
});

test('P1(b) - [ ] / - [x] items become disabled checkboxes, checked iff [x]', () => {
  const html = planHtml();
  assert.match(html, /<input type="checkbox" disabled>\s*<span[^>]*>First task not done<\/span>/);
  assert.match(html, /<input type="checkbox" disabled checked>\s*<span[^>]*>Second task done<\/span>/);
  // plain list item is unaffected (no checkbox)
  assert.match(html, /<li>plain non-task item<\/li>/);
});

test('P1(c) **Related:** becomes <nav class="related"> with <a href> preserved', () => {
  const html = planHtml();
  assert.match(html, /<nav class="related"><span class="label">Related:<\/span>/);
  assert.match(html, /<a href="\.\.\/specs\/SPEC-20260101T000000Z-0000-x\.md">/);
  // it must not be emitted as a plain paragraph
  assert.doesNotMatch(html, /<p>[^<]*Related:/);
});

test('P1(d) <main> keeps all five data-* attrs, the cycle badge, and a .meta block', () => {
  const html = planHtml();
  for (const attr of ['data-id', 'data-status', 'data-created-at', 'data-updated-at', 'data-cycle']) {
    assert.match(html, new RegExp(attr + '="'));
  }
  assert.match(html, /<span class="badge">cycle 1<\/span>/);
  assert.match(html, /<div class="meta">/);
});

test('P1(e) the template <script> block is present in the output', () => {
  const html = planHtml();
  assert.match(html, /<script>[\s\S]*?<\/script>/);
  assert.match(html, /"use strict"/);
});

// ---------- Phase 2 ----------

test('P2(a) a valid non-progress render exits 0 and writes the .html sibling', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-ok-'));
  const md = path.join(dir, 'FEAT-20260101T000000Z-abcd-fixture.md');
  fs.writeFileSync(md, PLAN_MD);
  const res = spawnSync(process.execPath, [SCRIPT, md], {
    encoding: 'utf8',
    env: { ...process.env, RENDER_ARTIFACT_ALLOW_ROOT: dir },
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /rendered/);
  assert.ok(fs.existsSync(md.replace(/\.md$/, '.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P2(b) a malformed render exits non-zero with a diagnostic naming the missing element', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-bad-'));
  const md = path.join(dir, 'FEAT-20260101T000000Z-ffff-fixture.md');
  fs.writeFileSync(md, NO_SECTION_MD);
  const res = spawnSync(process.execPath, [SCRIPT, md], {
    encoding: 'utf8',
    env: { ...process.env, RENDER_ARTIFACT_ALLOW_ROOT: dir },
  });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /details/i);
  assert.ok(!fs.existsSync(md.replace(/\.md$/, '.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P2(c) a spec with no task list still validates (no checkbox required)', () => {
  const html = specHtml();
  const problems = validateHtml(html, SPEC_MD, false);
  assert.deepEqual(problems, []);
});

test('P2(d) a .progress.md renders <ol class="timeline"> and is NOT failed by the non-progress set', () => {
  const html = progressHtml();
  assert.match(html, /<ol class="timeline/);
  const problems = validateHtml(html, PROGRESS_MD, true);
  assert.deepEqual(problems, []);
});

test('P2(e) esc() is unchanged for a known input and <main data-*> mirrors the frontmatter', () => {
  assert.equal(esc('<a> & <b>'), '&lt;a&gt; &amp; &lt;b&gt;');
  const html = planHtml();
  assert.match(html, /data-status="IN_PROGRESS"/);
  assert.match(html, /data-id="FEAT-20260101T000000Z-abcd"/);
  assert.match(html, /data-cycle="1"/);
});

test('P2(validate) non-progress render with all elements yields no problems', () => {
  const html = planHtml();
  const problems = validateHtml(html, PLAN_MD, false);
  assert.deepEqual(problems, []);
});

// ---------- Phase 3: branch-coverage top-up (QAF-20260721T231219Z-71fc) ----------

// A single section body that exercises the markdown branches the minimal fixtures
// above never reach: a fenced code block, extra heading levels (h3/h4), and a table.
const RICH_MD = `---
id: FEAT-20260101T000000Z-rich
status: DONE
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-02T00:00:00Z
cycle: 3
---

## Details

### Subsection heading

Some prose before the code sample.

\`\`\`
const x = 1 < 2 && 3 > 2;
line two
\`\`\`

#### Deeper heading

| Col A | Col B |
| ----- | ----- |
| a1 | b1 |
| a2 | b2 |
`;

const richHtml = () => toHtml('/repo/plans/feat/FEAT-20260101T000000Z-rich-fixture.md', RICH_MD);

test('P3(a) a fenced code block renders <pre><code> with its contents HTML-escaped', () => {
  const html = richHtml();
  assert.ok(
    html.includes('<pre><code>const x = 1 &lt; 2 &amp;&amp; 3 &gt; 2;\nline two</code></pre>'),
    'expected escaped <pre><code> fence markup, got:\n' + html,
  );
});

test('P3(b) additional heading levels map to the matching <hN> elements', () => {
  const html = richHtml();
  assert.match(html, /<h3>Subsection heading<\/h3>/);
  assert.match(html, /<h4>Deeper heading<\/h4>/);
});

test('P3(c) a Markdown table renders the full <table>/<thead>/<tbody>/<td> structure', () => {
  const html = richHtml();
  assert.match(html, /<table><thead><tr><th>Col A<\/th><th>Col B<\/th><\/tr><\/thead><tbody>/);
  assert.match(html, /<tr><td>a1<\/td><td>b1<\/td><\/tr>/);
  assert.match(html, /<tr><td>a2<\/td><td>b2<\/td><\/tr>/);
  assert.match(html, /<\/tbody><\/table>/);
});

test('P3(d) validateHtml flags a task/checkbox count mismatch (CLI error path)', () => {
  // A task line that renders no checkbox (taskCount > 0, cbCount = 0) is exactly the
  // "unrenderable" shape that drives render() to throw and the CLI to exit non-zero.
  const body = '## Tasks\n- [ ] a task that renders no checkbox\n';
  const html =
    '<main data-id="x" data-status="DONE" data-created-at="x" data-updated-at="x" data-cycle="0">' +
    '<span class="badge">cycle 0</span>' +
    '<details open><summary>Tasks</summary></details></main>';
  const problems = validateHtml(html, body, false);
  assert.ok(
    problems.some((p) => /task checkbox \(0\/1 rendered\)/.test(p)),
    'expected a task-checkbox mismatch problem, got: ' + JSON.stringify(problems),
  );
});

test('P3(e) invoking the CLI with no arguments prints usage and exits 2', () => {
  const res = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(res.status, 2, res.stderr);
  assert.match(res.stderr, /usage: render-artifact\.cjs/);
});

test('P3(f) a non-existent input file re-throws (ENOENT) and exits non-zero', () => {
  const res = spawnSync(process.execPath, [SCRIPT, '/no/such/dir/missing-artifact.md'], {
    encoding: 'utf8',
  });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /ENOENT|no such file/i);
});

// ---------- Hardening Phase 1: context-correct attribute escaping (escAttr) ----------

const { escAttr, inline } = require('./render-artifact.cjs');

// A frontmatter value carrying a double-quote + event-handler breakout attempt.
const INJECT_MD = `---
id: FEAT-20260101T000000Z-inj
status: ACTIVE" onload="alert(1)
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-02T00:00:00Z
cycle: 0
---

## Overview

Body text.
`;
const injectHtml = () => toHtml('/repo/plans/feat/FEAT-20260101T000000Z-inj-fixture.md', INJECT_MD);

test('H1(a) a " in a frontmatter value is attribute-escaped in <main data-*> and cannot terminate it', () => {
  const html = injectHtml();
  assert.match(html, /data-status="ACTIVE&quot; onload=&quot;alert\(1\)"/);
  // the raw quote must not survive to break the attribute open
  assert.doesNotMatch(html, /data-status="ACTIVE" onload=/);
});

test("H1(b) escAttr is exported and escapes & < > \" ' and C0 control chars", () => {
  assert.equal(typeof escAttr, 'function');
  assert.equal(escAttr('a&b<c>d"e\'f'), 'a&amp;b&lt;c&gt;d&quot;e&#39;f');
  assert.equal(escAttr('x\u0000y\u001fz'), 'x&#0;y&#31;z');
});

test('H1(c) the interpolated pill--… class value renders through attribute escaping', () => {
  const html = injectHtml();
  // an unknown status maps to the safe internal "muted" pill class, well-formed and unbroken
  assert.match(html, /class="pill pill--muted"/);
});

test('H1(d) esc() stays unchanged for content contexts (P2(e) invariant)', () => {
  assert.equal(esc('<a> & <b>'), '&lt;a&gt; &amp; &lt;b&gt;');
});

// ---------- Hardening Phase 2: link-URL validation, scheme allowlist, inert fallback ----------

test('H2(a) a quote-breakout URL is attribute-escaped and cannot break out of the href', () => {
  const out = inline('[t](http://a" onmouseover="x)');
  assert.match(out, /<a href="http:\/\/a&quot; onmouseover=&quot;x">t<\/a>/);
  // no live event-handler attribute survives
  assert.doesNotMatch(out, /onmouseover="x"/);
});

test('H2(b) disallowed schemes and malformed URLs render as escaped text with NO anchor and NO href', () => {
  for (const u of [
    'javascript:alert(1)',
    'data:text/html,x',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'ftp://h/x',
    'ht tp://evil',
  ]) {
    const out = inline(`[click](${u})`);
    assert.doesNotMatch(out, /<a\b/, `expected no anchor for ${u}, got: ${out}`);
    assert.doesNotMatch(out, /href=/, `expected no href for ${u}, got: ${out}`);
    assert.match(out, /click/, `link text should survive for ${u}, got: ${out}`);
  }
});

test('H2(c) relative and http/https/mailto links render as anchors with attribute-escaped href', () => {
  assert.match(inline('[s](../specs/x.md)'), /<a href="\.\.\/specs\/x\.md">s<\/a>/);
  assert.match(inline('[h](http://example.com/p)'), /<a href="http:\/\/example\.com\/p">h<\/a>/);
  assert.match(
    inline('[q](https://example.com/p?q=1&r=2)'),
    /<a href="https:\/\/example\.com\/p\?q=1&amp;r=2">q<\/a>/,
  );
  assert.match(inline('[m](mailto:x@y.com)'), /<a href="mailto:x@y\.com">m<\/a>/);
  assert.match(inline('[frag](#section)'), /<a href="#section">frag<\/a>/);
});

test('H2(d) P1(c) invariant: the Related nav relative href is still preserved (relatedNav inherits the fix)', () => {
  const html = planHtml();
  assert.match(html, /<a href="\.\.\/specs\/SPEC-20260101T000000Z-0000-x\.md">/);
});

test('H2(e) bold and inline code inside/around a link are still rendered', () => {
  const out = inline('see **bold** and `code` and [t](../a.md)');
  assert.match(out, /<strong>bold<\/strong>/);
  assert.match(out, /<code>code<\/code>/);
  assert.match(out, /<a href="\.\.\/a\.md">t<\/a>/);
});

// ---------- Hardening Phase 3: Content-Security-Policy + per-render script nonce/hash ----------

const crypto = require('node:crypto');

function cspOf(html) {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  return m ? m[1] : null;
}

test('H3(a) every rendered document (plan, spec, progress) carries the CSP meta with the required directives', () => {
  for (const html of [planHtml(), specHtml(), progressHtml()]) {
    const csp = cspOf(html);
    assert.ok(csp, 'CSP meta missing');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /style-src 'unsafe-inline'/);
    assert.match(csp, /img-src data:/);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /form-action 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /script-src /);
  }
});

test('H3(b) the CSP script-src sha256 hash matches the lifted <script> content in the same render', () => {
  const html = planHtml();
  const csp = cspOf(html);
  const hashM = csp.match(/script-src 'sha256-([A-Za-z0-9+/=]+)'/);
  assert.ok(hashM, 'expected a sha256 script-src hash, got: ' + csp);
  const scriptM = html.match(/<script(?: nonce="[^"]*")?>([\s\S]*?)<\/script>/);
  assert.ok(scriptM, 'expected a lifted <script>');
  const expected = crypto.createHash('sha256').update(scriptM[1], 'utf8').digest('base64');
  assert.equal(hashM[1], expected);
});

test('H3(c) the inline <style> block is still emitted (style-src unsafe-inline stays honored)', () => {
  const html = planHtml();
  assert.match(html, /<style>[\s\S]*?<\/style>/);
});

test('H3(d) P1(e) invariant: the template <script> is still present with "use strict"', () => {
  const html = planHtml();
  assert.match(html, /<script>[\s\S]*?<\/script>/);
  assert.match(html, /"use strict"/);
});

// ---------- Hardening Phase 4: source-path containment + no-follow write (FEAT-20260722T034239Z-9365) ----------

const { render } = require('./render-artifact.cjs');
const REPO_ROOT = path.resolve(__dirname, '..');

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function withAllowRoot(dir, fn) {
  const prev = process.env.RENDER_ARTIFACT_ALLOW_ROOT;
  process.env.RENDER_ARTIFACT_ALLOW_ROOT = dir;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.RENDER_ARTIFACT_ALLOW_ROOT;
    else process.env.RENDER_ARTIFACT_ALLOW_ROOT = prev;
  }
}

function expectRenderPath(fn) {
  let threw = null;
  try {
    fn();
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, 'expected render() to throw a path-validation error');
  assert.equal(
    threw.code,
    'ERENDERPATH',
    'expected ERENDERPATH, got: ' + (threw && (threw.code || threw.message)),
  );
  return threw;
}

test('P4(a) an absolute-path source outside the allowed base is rejected (ERENDERPATH), nothing written', () => {
  const dir = mkTmp('render-abs-');
  const md = path.join(dir, 'FEAT-20260101T000000Z-abcd-fixture.md');
  fs.writeFileSync(md, PLAN_MD);
  // default base is <repoRoot>/plans, so this absolute temp path escapes it
  expectRenderPath(() => render(md));
  assert.ok(!fs.existsSync(md.replace(/\.md$/, '.html')), 'no .html should be written');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(b) a ..-escaping relative source is rejected before any read/write', () => {
  const dir = mkTmp('render-esc-');
  const md = path.join(dir, 'FEAT-20260101T000000Z-abcd-fixture.md');
  fs.writeFileSync(md, PLAN_MD);
  const rel = path.relative(REPO_ROOT, md); // ../../… escaping the repo root and the plans base
  assert.ok(rel.startsWith('..'), 'fixture precondition: relative path must escape the repo');
  expectRenderPath(() => render(rel));
  assert.ok(!fs.existsSync(md.replace(/\.md$/, '.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(c) a non-.md source is rejected and left byte-for-byte untouched (self-overwrite vector closed)', () => {
  const dir = mkTmp('render-conf-');
  const conf = path.join(dir, 'evil.conf');
  fs.writeFileSync(conf, 'SECRET-CONTENTS\n');
  // even with containment satisfied, the .md suffix check must reject it
  withAllowRoot(dir, () => expectRenderPath(() => render(conf)));
  assert.equal(fs.readFileSync(conf, 'utf8'), 'SECRET-CONTENTS\n', 'non-.md input must be untouched');
  assert.ok(!fs.existsSync(path.join(dir, 'evil.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(d) a symlinked source is rejected via lstat (not stat); nothing written, target untouched', () => {
  const dir = mkTmp('render-sym-');
  const target = path.join(dir, 'FEAT-20260101T000000Z-abcd-target.md');
  fs.writeFileSync(target, PLAN_MD);
  const link = path.join(dir, 'FEAT-20260101T000000Z-abcd-link.md');
  fs.symlinkSync(target, link);
  withAllowRoot(dir, () => expectRenderPath(() => render(link)));
  assert.equal(fs.readFileSync(target, 'utf8'), PLAN_MD, 'symlink target must be untouched');
  assert.ok(!fs.existsSync(link.replace(/\.md$/, '.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(e) a missing source is rejected (ERENDERPATH) and reads/writes nothing', () => {
  const dir = mkTmp('render-miss-');
  const md = path.join(dir, 'does-not-exist.md');
  withAllowRoot(dir, () => expectRenderPath(() => render(md)));
  assert.ok(!fs.existsSync(md.replace(/\.md$/, '.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(f) a pre-existing symlinked .html target is replaced (not followed); its link target stays untouched', () => {
  const dir = mkTmp('render-symhtml-');
  const md = path.join(dir, 'FEAT-20260101T000000Z-abcd-fixture.md');
  fs.writeFileSync(md, PLAN_MD);
  const external = path.join(dir, 'external-keep.txt');
  fs.writeFileSync(external, 'EXTERNAL');
  const outHtml = md.replace(/\.md$/, '.html');
  fs.symlinkSync(external, outHtml);
  withAllowRoot(dir, () => render(md));
  assert.equal(fs.readFileSync(external, 'utf8'), 'EXTERNAL', 'symlink target must not be written through');
  assert.ok(!fs.lstatSync(outHtml).isSymbolicLink(), 'the .html entry should now be a regular file, not the symlink');
  assert.match(fs.readFileSync(outHtml, 'utf8'), /<main/, 'the .html should hold the fresh render');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(g) a pre-existing regular .html target is still legitimately replaced', () => {
  const dir = mkTmp('render-reghtml-');
  const md = path.join(dir, 'FEAT-20260101T000000Z-abcd-fixture.md');
  fs.writeFileSync(md, PLAN_MD);
  const outHtml = md.replace(/\.md$/, '.html');
  fs.writeFileSync(outHtml, 'OLD-CONTENT');
  withAllowRoot(dir, () => render(md));
  const written = fs.readFileSync(outHtml, 'utf8');
  assert.doesNotMatch(written, /OLD-CONTENT/);
  assert.match(written, /<main/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(h) render derives a distinct .html target and never returns the source path', () => {
  const dir = mkTmp('render-distinct-');
  const md = path.join(dir, 'FEAT-20260101T000000Z-abcd-fixture.md');
  fs.writeFileSync(md, PLAN_MD);
  const outRel = withAllowRoot(dir, () => render(md));
  assert.match(outRel, /\.html$/, 'output must be an .html path');
  assert.doesNotMatch(outRel, /\.md$/, 'output must never be the .md source');
  assert.ok(!fs.existsSync(path.join(dir, 'external-keep.txt')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(i) the CLI surfaces ERENDERPATH like ERENDERINVALID: concise render-artifact: stderr, exit 1, no stack trace', () => {
  const dir = mkTmp('render-cli-path-');
  const conf = path.join(dir, 'evil.conf');
  fs.writeFileSync(conf, 'SECRET');
  const res = spawnSync(process.execPath, [SCRIPT, conf], {
    encoding: 'utf8',
    env: { ...process.env, RENDER_ARTIFACT_ALLOW_ROOT: dir },
  });
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /^render-artifact: /m);
  assert.doesNotMatch(res.stderr, /\n\s+at /, 'no raw stack trace should leak');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P4(j) in a multi-arg batch the first offending arg fails and later args are not rendered', () => {
  const dir = mkTmp('render-cli-batch-');
  const bad = path.join(dir, 'evil.conf');
  fs.writeFileSync(bad, 'SECRET');
  const good = path.join(dir, 'FEAT-20260101T000000Z-abcd-fixture.md');
  fs.writeFileSync(good, PLAN_MD);
  const res = spawnSync(process.execPath, [SCRIPT, bad, good], {
    encoding: 'utf8',
    env: { ...process.env, RENDER_ARTIFACT_ALLOW_ROOT: dir },
  });
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /^render-artifact: /m);
  assert.ok(!fs.existsSync(good.replace(/\.md$/, '.html')), 'a later arg must not be rendered after the first failure');
  fs.rmSync(dir, { recursive: true, force: true });
});
