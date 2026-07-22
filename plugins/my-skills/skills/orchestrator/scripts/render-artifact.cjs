#!/usr/bin/env node
/**
 * Renders a canonical `.md` planning artifact into its `.html` sibling using the
 * Editorial Design System v1 shell lifted from `.orchestrator/html-templates/`.
 *
 * The `.md` frontmatter stays authoritative; the `.html` is a read-only render
 * whose `<main data-*>` attributes mirror that frontmatter (per
 * `.orchestrator/artifact-format.md`). This keeps html-mode artifacts paired so
 * consumers relying on the one-source/two-render contract don't break.
 *
 *   node .orchestrator/render-artifact.cjs <artifact.md> [<artifact.md> ...]
 *
 * Type is inferred from the path: `*.progress.md` → progress-timeline scaffold,
 * `plans/eval/**` → qa-report scaffold, otherwise the same-named scaffold.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
// Runtime resolves the scaffolds from the sibling `html-templates/` that bootstrap
// materializes into `.orchestrator/`. `RENDER_ARTIFACT_TPL_DIR` is a test-only
// override so the skill-source unit tests can point at `templates/html/` without a
// bootstrapped project; it is never set in a materialized `.orchestrator/` run.
const TPL_DIR = process.env.RENDER_ARTIFACT_TPL_DIR
  ? path.resolve(process.env.RENDER_ARTIFACT_TPL_DIR)
  : path.join(__dirname, 'html-templates');

const STATUS_PILL = {
  READY_TO_COMMIT: 'success', READY_FOR_PLANNING: 'success', DONE: 'success',
  PASS: 'success', APPROVED: 'success', READY: 'success',
  IN_PROGRESS: 'active', DRAFT: 'active',
  BELOW_FLOOR: 'warning', READY_WITH_WARNINGS: 'warning', ISSUES: 'warning',
  BLOCKED: 'danger', BLOCKED_STALE: 'danger', REQUEST_CHANGES: 'danger', STALLED: 'danger',
  SKIPPED: 'muted', TODO: 'muted', SUPERSEDED: 'muted',
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\x00-\x1F\x7F]/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

const KICKER = {
  spec: 'Functional Specification',
  plan: 'Execution Plan',
  'test-report': 'Test Report',
  'code-review': 'Code Review',
  'qa-report': 'QA Report',
  'final-report': 'Final Report',
};

/**
 * A link target is allowed only when it is a scheme-less relative reference
 * (`/`, `./`, `../`, `#`, `?`, or a bare path) or an absolute URL whose scheme is
 * `http`, `https`, or `mailto`. Everything else (javascript:/data:/vbscript:/file:,
 * any other scheme, control chars, malformed refs) is rejected.
 */
function isSafeUrl(url) {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  if (u === '' || /[\x00-\x1F\x7F]/.test(u)) return false;
  const scheme = u.match(/^([a-zA-Z][a-zA-Z0-9+.\-]*):/);
  if (scheme) {
    const s = scheme[1].toLowerCase();
    return s === 'http' || s === 'https' || s === 'mailto';
  }
  // No valid scheme prefix: a ':' before the first '/', '?' or '#' is a
  // malformed/ambiguous absolute reference (e.g. "ht tp://x", "123:x") — reject.
  const colon = u.indexOf(':');
  if (colon !== -1) {
    const delim = u.search(/[/?#]/);
    if (delim === -1 || colon < delim) return false;
  }
  return true;
}

/** Inline markdown (code, bold) with no link handling; escapes for content context. */
function inlineNoLink(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Inline markdown → HTML. Links are parsed on the raw text so the URL is
 * validated against the scheme allowlist and attribute-escaped independently of
 * the (content-escaped) link text; rejected/malformed URLs drop to plain text.
 */
function inline(t) {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = linkRe.exec(t)) !== null) {
    out += inlineNoLink(t.slice(last, m.index));
    const text = m[1];
    const url = m[2].trim();
    out += isSafeUrl(url)
      ? `<a href="${escAttr(url)}">${inlineNoLink(text)}</a>`
      : inlineNoLink(text);
    last = linkRe.lastIndex;
  }
  out += inlineNoLink(t.slice(last));
  return out;
}

function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: src };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: src.slice(m[0].length) };
}

/** Minimal, safe markdown → HTML: headings, bold, code, lists, tables, hr, links, paragraphs. */
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const lvl = line.match(/^(#{1,6})/)[1].length;
      out.push(`<h${lvl}>${inline(line.replace(/^#{1,6}\s/, ''))}</h${lvl}>`);
      i++;
      continue;
    }
    if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\s*[-*]\s/.test(line)) {
      const items = [];
      let hasTask = false;
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        const item = lines[i].replace(/^\s*[-*]\s/, '');
        const taskM = item.match(/^\[([ xX])\]\s?(.*)$/);
        if (taskM) {
          hasTask = true;
          const checked = taskM[1].toLowerCase() === 'x' ? ' checked' : '';
          items.push(`<li><input type="checkbox" disabled${checked}> <span class="task__desc">${inline(taskM[2])}</span></li>`);
        } else {
          items.push('<li>' + inline(item) + '</li>');
        }
        i++;
      }
      out.push(hasTask ? '<ul class="tasks">' : '<ul>');
      out.push(...items);
      out.push('</ul>');
      continue;
    }
    if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1])) {
      const row = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(line);
      i += 2;
      out.push('<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
      while (i < lines.length && /^\|.*\|/.test(lines[i])) {
        out.push('<tr>' + row(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
        i++;
      }
      out.push('</tbody></table>');
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|\s*[-*]\s|\|)/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }
  return out.join('\n');
}

function styleBlock(tplName) {
  const tpl = fs.readFileSync(path.join(TPL_DIR, tplName), 'utf8');
  const m = tpl.match(/<style>[\s\S]*?<\/style>/);
  return m ? m[0] : '<style></style>';
}

/** Lift the template's trailing behavior script, the same way styleBlock lifts <style>. */
function scriptBlock(tplName) {
  const tpl = fs.readFileSync(path.join(TPL_DIR, tplName), 'utf8');
  const m = tpl.match(/<script>[\s\S]*?<\/script>/);
  return m ? m[0] : '';
}

/** The text content between a lifted `<script>` and `</script>` (for CSP hashing). */
function scriptInner(scriptTag) {
  return scriptTag.replace(/^<script>/, '').replace(/<\/script>$/, '');
}

/**
 * Defense-in-depth CSP meta. `default-src 'none'` denies everything by default;
 * the lifted behavior script is allowed via a sha256 hash of its own content
 * (per-render, no inline event handlers), inline <style> stays allowed, images
 * are limited to data: URIs, and base/form/frame vectors are locked down.
 */
function cspMeta(scriptSrcToken) {
  const directives = [
    "default-src 'none'",
    `script-src ${scriptSrcToken}`,
    "style-src 'unsafe-inline'",
    'img-src data:',
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  return `<meta http-equiv="Content-Security-Policy" content="${directives}">`;
}

/**
 * Split a non-progress body into pre-first-`##` lede content and top-level `##`
 * sections. Fence-aware so a `##` inside a code block is not treated as a heading.
 * The H1 title line and the `**Related:**` line are stripped (rendered elsewhere).
 */
function buildSections(body) {
  const cleaned = body
    .replace(/^#\s+.+$/m, '')
    .replace(/^\*\*Related:\*\*.*$/m, '');
  const lede = [];
  const sections = [];
  let cur = null;
  let inFence = false;
  for (const line of cleaned.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    const h2 = inFence ? null : line.match(/^##\s+(.+)$/);
    if (h2) {
      cur = { title: h2[1].trim(), body: [] };
      sections.push(cur);
    } else if (cur) {
      cur.body.push(line);
    } else {
      lede.push(line);
    }
  }
  return { lede: lede.join('\n').trim(), sections };
}

function relatedNav(body) {
  const m = body.match(/^\*\*Related:\*\*\s*(.*)$/m);
  const content = m && m[1].trim() ? inline(m[1].trim()) : '<span>—</span>';
  return `  <nav class="related"><span class="label">Related:</span> ${content}</nav>`;
}

function documentBody(body, ctx) {
  const { lede, sections } = buildSections(body);
  const ledeHtml = lede ? `    <div class="masthead__lede prose">\n${mdToHtml(lede)}\n    </div>\n` : '';
  const header =
`  <header class="masthead">
    <p class="masthead__kicker"><span>${esc(ctx.kicker)}</span></p>
    <h1>
      <span class="h1__id">${esc(ctx.id)}</span>
      <span>${esc(ctx.title)}</span>
      <span class="h1__pill"><span class="pill pill--${escAttr(ctx.pill)}">${esc(ctx.status)}</span></span>
    </h1>
${ledeHtml}    <div class="meta">
      <span class="meta__id">${esc(ctx.id)}</span>
      <span class="meta__fields">
        <span><span class="meta__key">created:</span> <span class="meta__val">${esc(ctx.created)}</span></span>
        <span class="meta__sep">·</span>
        <span><span class="meta__key">updated:</span> <span class="meta__val">${esc(ctx.updated)}</span></span>
        <span class="meta__sep">·</span>
        <span class="badge">cycle ${esc(ctx.cycle)}</span>
      </span>
    </div>
  </header>`;
  const sectionsHtml = sections.map((s) =>
`  <section class="section">
    <details open>
      <summary>${inline(s.title)}</summary>
      <div class="details__body">
${mdToHtml(s.body.join('\n'))}
      </div>
    </details>
  </section>`).join('\n');
  return `${header}\n${sectionsHtml}\n\n${relatedNav(body)}`;
}

function progressBody(body, ctx) {
  return `  <header>
    <h1>${esc(ctx.title)}
      <span class="h1__pill"><span class="pill pill--${escAttr(ctx.pill)}">${esc(ctx.status)}</span></span>
    </h1>
    <p><span class="badge">${esc(ctx.id)}</span> <span class="badge">cycle ${esc(ctx.cycle)}</span></p>
  </header>
  <section aria-label="Pipeline event timeline">
  <ol class="timeline timeline--ended" style="list-style:none; margin:0;">
${timelineRows(body)}
  </ol>
  </section>`;
}

function timelineRows(body) {
  // `.progress.md` is an append-log; render each non-empty, non-heading line as a row.
  const rows = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || /^#/.test(line) || /^---/.test(line)) continue;
    const statusTok = (line.match(/\b(READY_TO_COMMIT|READY_FOR_PLANNING|IN_PROGRESS|BLOCKED_STALE|BLOCKED|APPROVED|REQUEST_CHANGES|BELOW_FLOOR|PASS|DONE|DRAFT|STALLED|SKIPPED|READY)\b/) || [])[1];
    const pill = STATUS_PILL[statusTok] || 'muted';
    const text = line.replace(/^[-*]\s*/, '');
    rows.push(
      `    <li style="position:relative; margin-bottom: var(--sp-4);">` +
      (statusTok ? `<span class="pill pill--${escAttr(pill)}">${esc(statusTok)}</span> ` : '') +
      `<span>${esc(text)}</span></li>`
    );
  }
  return rows.join('\n');
}

/** Build the full `.html` string for an artifact. `abs` is used only for type inference. */
function toHtml(abs, src) {
  const { fm, body } = parseFrontmatter(src);
  const isProgress = /\.progress\.md$/.test(abs);
  const tplName = isProgress
    ? 'progress-timeline.template.html'
    : /\/eval\//.test(abs) ? 'qa-report.template.html'
    : path.basename(abs).replace(/^([A-Z]+).*/, (_, p) => ({
        SPEC: 'spec', FEAT: 'plan', FIX: 'plan', QAF: 'plan',
        TEST: 'test-report', CR: 'code-review', QA: 'qa-report', FINAL: 'final-report',
      }[p] || 'qa-report')) + '.template.html';

  const id = fm.id || path.basename(abs).replace(/\.md$/, '');
  const status = fm.status || 'DONE';
  const created = fm.created_at || '';
  const updated = fm.updated_at || fm.created_at || '';
  const cycle = fm.cycle != null ? fm.cycle : '0';
  const pill = STATUS_PILL[status] || 'muted';
  const title = (body.match(/^#\s+(.+)$/m) || [, id])[1];
  const stem = tplName.replace(/\.template\.html$/, '');
  const ctx = { id, title, status, pill, created, updated, cycle, kicker: KICKER[stem] || 'Artifact' };

  const mainInner = isProgress ? progressBody(body, ctx) : documentBody(body, ctx);
  const main =
`<main
  data-id="${escAttr(id)}"
  data-status="${escAttr(status)}"
  data-created-at="${escAttr(created)}"
  data-updated-at="${escAttr(updated)}"
  data-cycle="${escAttr(cycle)}">
${mainInner}
</main>`;

  const scriptTag = isProgress ? '' : scriptBlock(tplName);
  const scriptSrc = scriptTag
    ? `'sha256-${crypto.createHash('sha256').update(scriptInner(scriptTag), 'utf8').digest('base64')}'`
    : "'none'";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${cspMeta(scriptSrc)}
<title>${esc(id)} — ${esc(title)}</title>
${styleBlock(tplName)}
</head>
<body>
${main}
${scriptTag}
</body>
</html>
`;
}

/**
 * Self-validate a rendered artifact. Returns a list of missing required elements
 * (empty = conformant). Progress artifacts use a timeline-appropriate required set.
 */
function validateHtml(html, body, isProgress) {
  const missing = [];
  for (const attr of ['data-id', 'data-status', 'data-created-at', 'data-updated-at', 'data-cycle']) {
    if (!html.includes(attr + '="')) missing.push('<main> ' + attr);
  }
  if (!/<span class="badge">cycle /.test(html)) missing.push('cycle badge');
  if (isProgress) {
    if (!/<ol class="timeline/.test(html)) missing.push('<ol class="timeline"> (progress)');
    return missing;
  }
  if (!/<details[^>]*>\s*<summary>/.test(html)) missing.push('<details><summary> section');
  const taskCount = (body.match(/^\s*[-*]\s+\[[ xX]\]/gm) || []).length;
  const cbCount = (html.match(/<input type="checkbox" disabled/g) || []).length;
  if (taskCount > 0 && cbCount < taskCount) {
    missing.push(`task checkbox (${cbCount}/${taskCount} rendered)`);
  }
  return missing;
}

/**
 * The canonical directory a source artifact must live beneath. Defaults to
 * `<repoRoot>/plans`, overridable via `RENDER_ARTIFACT_ALLOW_ROOT` (read here, not
 * at module load, so per-spawn env overrides take effect). Both are canonicalized
 * with `realpath` so containment is compared on real paths, not symlinked aliases.
 */
function resolveAllowedBase() {
  const raw = process.env.RENDER_ARTIFACT_ALLOW_ROOT || path.join(ROOT, 'plans');
  return fs.realpathSync(raw);
}

function renderPathError(message) {
  const err = new Error(message);
  err.code = 'ERENDERPATH';
  return err;
}

/**
 * Validate a caller-supplied source path and return its canonical (realpath) form.
 * Ordering is load-bearing and runs entirely before any read: existence/regular-file
 * via `lstat` (no symlink follow) → symlink rejection → regular-file → case-sensitive
 * `.md` suffix → `realpath` → `path.relative` containment beneath the allowed base.
 */
function validateSourcePath(mdPath) {
  const abs = path.resolve(ROOT, mdPath);
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch (e) {
    throw renderPathError(`source path cannot be read: ${mdPath} (${(e && e.code) || 'no such file'})`);
  }
  if (st.isSymbolicLink()) throw renderPathError(`source path is a symlink, refusing to follow: ${mdPath}`);
  if (!st.isFile()) throw renderPathError(`source path is not a regular file: ${mdPath}`);
  if (!/\.md$/.test(abs)) throw renderPathError(`source path is not a .md file: ${mdPath}`);
  const real = fs.realpathSync(abs);
  const base = resolveAllowedBase();
  const rel = path.relative(base, real);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw renderPathError(`source path escapes the allowed base (${base}): ${mdPath}`);
  }
  return real;
}

function render(mdPath) {
  const abs = validateSourcePath(mdPath);
  const src = fs.readFileSync(abs, 'utf8');
  const { body } = parseFrontmatter(src);
  const isProgress = /\.progress\.md$/.test(abs);
  const html = toHtml(abs, src);
  const problems = validateHtml(html, body, isProgress);
  if (problems.length) {
    const err = new Error(`invalid render of ${path.relative(ROOT, abs)}: missing ${problems.join('; ')}`);
    err.code = 'ERENDERINVALID';
    throw err;
  }
  const outPath = abs.replace(/\.md$/, '.html');
  if (outPath === abs) {
    throw renderPathError(`refusing to overwrite source: derived output equals input ${path.relative(ROOT, abs)}`);
  }
  writeFileNoFollow(outPath, html);
  return path.relative(ROOT, outPath);
}

/**
 * Write `data` to `outPath` without following a pre-existing symlink there: write a
 * randomly-named temp file in the target's own directory, then `rename` it into
 * place (rename replaces the directory entry itself rather than the symlink's target).
 * The temp file is removed if the rename fails, so no partial output is left behind.
 */
function writeFileNoFollow(outPath, data) {
  const dir = path.dirname(outPath);
  const tmp = path.join(dir, `.${path.basename(outPath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, outPath);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {
      /* nothing to clean up */
    }
    throw e;
  }
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0) {
    console.error('usage: render-artifact.cjs <artifact.md> [...]');
    process.exit(2);
  }
  for (const a of args) {
    try {
      console.log('rendered', render(a));
    } catch (e) {
      if (e && (e.code === 'ERENDERINVALID' || e.code === 'ERENDERPATH')) {
        console.error('render-artifact: ' + e.message);
        process.exit(1);
      }
      throw e;
    }
  }
}

module.exports = { esc, escAttr, inline, parseFrontmatter, mdToHtml, buildSections, toHtml, validateHtml, render };

if (require.main === module) {
  main(process.argv);
}
