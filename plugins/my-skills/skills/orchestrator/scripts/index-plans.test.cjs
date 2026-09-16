#!/usr/bin/env node
'use strict';
/**
 * Contract tests for `index-plans.cjs` — the generated read view over `plans/`.
 *
 * The cases that matter are the ones where the index would be *quietly wrong*
 * rather than loudly broken: a code review dropped from its family because it
 * carries `plan:` and no `related_to` (0 of 222 real CRs carry one), a fix plan
 * lost because its family is two hops away, a legacy 3-digit artifact skipped
 * because it predates the timestamp grammar, an artifact silently shown in only
 * one of the families it belongs to, or a slug carrying markup straight into the
 * page. Each of those reads as a clean index, which is why they are pinned here.
 *
 * Byte-identity across two runs is pinned for the same reason the generator
 * refuses `localeCompare`: the output is a committed file, so a page that is
 * merely *equivalent* between runs shows up as a diff on every regeneration.
 *
 * Fixtures are built in a temp dir and the real `plans/` tree is never read.
 *
 *   node scripts/index-plans.test.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const NODE = process.execPath;
const SCRIPT = path.join(__dirname, 'index-plans.cjs');

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL: ' + m); };
const pass = (m) => console.log('pass: ' + m);
const check = (name, ok, detail) => (ok ? pass(name) : fail(detail ? `${name}: ${detail}` : name));

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'index-plans-'));
const run = (args, cwd) => spawnSync(NODE, [SCRIPT, ...args], { cwd: cwd || tmpRoot, encoding: 'utf8', env: process.env });

/** Write one `.md` artifact with a frontmatter block, creating its directory. */
function artifact(root, dir, basename, fm, body) {
  const d = path.join(root, dir);
  fs.mkdirSync(d, { recursive: true });
  const head = Object.keys(fm).map((k) => `${k}: ${fm[k]}`).join('\n');
  const file = path.join(d, basename);
  fs.writeFileSync(file, `---\n${head}\n---\n\n${body || '# ' + basename.replace(/\.md$/, '')}\n`);
  return file;
}

/**
 * The `<details>` block for one family (or for the unattached group), matched on
 * its `data-family` key. Family bodies never nest a `<details>`, so the lazy
 * match to the first `</details>` is exact.
 */
function block(html, key) {
  const re = new RegExp('<details[^>]*data-family="' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?</details>');
  const m = html.match(re);
  return m ? m[0] : '';
}

/** One top-level `<section id="…">`. Sections never nest, so the lazy match is exact. */
const section = (html, id) =>
  (html.match(new RegExp('<section class="section" id="' + id + '">[\\s\\S]*?</section>')) || [''])[0];

const rowIds = (fragment) => (fragment.match(/data-id="([^"]*)"/g) || []).map((s) => s.slice(9, -1));
const reLit = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The row a given id renders as, so an assertion can be about ONE row rather than the page. */
const rowFor = (fragment, id) =>
  (fragment.match(new RegExp('<li class="row" data-id="' + reLit(id) + '"[\\s\\S]*?</li>')) || [''])[0];
/** Every `href` of a row's PRIMARY link — the artifact the row is, not its siblings. */
const rowHrefs = (html) => (html.match(/class="row__id" href="[^"]*"/g) || []).map((s) => s.slice(22, -1));
const stat = (html, name) => {
  const m = html.match(new RegExp('data-stat="' + name + '"[^>]*>([^<]*)<'));
  return m ? m[1] : null;
};

// ---------------------------------------------------------------------------
// The well-formed corpus: three families, one shared artifact, one orphan, one
// legacy pair. Every basename here is a real-world-shaped slug, so this tree is
// also the one the link-resolution mirror below runs against.
// ---------------------------------------------------------------------------
const corpus = path.join(tmpRoot, 'corpus');
const PLANS = path.join(corpus, 'plans');

const SPEC_A = 'SPEC-20260101T000000Z-1111';
const SPEC_B = 'SPEC-20260102T000000Z-2222';
const SPEC_C = 'SPEC-20260104T000000Z-3333';
const FEAT_A = 'FEAT-20260101T010000Z-aaaa';
const CR_A = 'CR-20260101T020000Z-bbbb';
const FIX_A = 'FIX-20260101T030000Z-cccc';
const FEAT_X = 'FEAT-20260101T050000Z-dddd';
const FEAT_B = 'FEAT-20260102T010000Z-eeee';
const QA_B = 'QA-20260103T000000Z-ffff';
const TEST_A = 'TEST-20260101T040000Z-7777';
const FEAT_C = 'FEAT-20260104T010000Z-gggg';
const CR_C = 'CR-20260104T020000Z-hhhh';
const QA_ORPHAN = 'QA-20260105T000000Z-9999';
const FEAT_P = 'FEAT-20260104T003000Z-9a9a';
const FINAL_M = 'FINAL-20260102T120000Z-4d4d';
// An id with the right grammar that no artifact carries — the shape a deleted or
// renamed spec leaves behind in a body. The mention edge must step over it.
const SPEC_PHANTOM = 'SPEC-20260109T000000Z-dead';

artifact(PLANS, 'specs', `${SPEC_A}-alpha.md`, {
  id: SPEC_A, title: 'Alpha spec', status: 'READY_FOR_PLANNING',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', cycle: 0, related_to: '—',
});
artifact(PLANS, 'specs', `${SPEC_B}-beta.md`, {
  id: SPEC_B, title: 'Beta spec', status: 'READY_FOR_PLANNING',
  created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', cycle: 0,
});
// Gamma cites Alpha as prior art, the way a real spec does. A spec opens a family;
// it must not inherit one, or Gamma's whole subtree lands in Alpha.
artifact(PLANS, 'specs', `${SPEC_C}-gamma.md`, {
  id: SPEC_C, title: 'Gamma spec', status: 'READY_FOR_PLANNING',
  created_at: '2026-01-04T00:00:00Z', updated_at: '2026-01-04T00:00:00Z', cycle: 0, related_to: SPEC_A,
});

// Joins Alpha the ordinary way: `related_to` names the spec.
artifact(PLANS, 'feat', `${FEAT_A}-alpha-impl.md`, {
  id: FEAT_A, title: 'Alpha implementation', status: 'DONE',
  created_at: '2026-01-01T01:00:00Z', updated_at: '2026-01-01T01:30:00Z', cycle: 0, related_to: SPEC_A,
});
fs.writeFileSync(path.join(PLANS, 'feat', `${FEAT_A}-alpha-impl.html`), '<!DOCTYPE html><html></html>\n');
fs.writeFileSync(path.join(PLANS, 'feat', `${FEAT_A}-alpha-impl.progress.md`), '- 2026-01-01 IN_PROGRESS started\n');

// Joins Alpha by PROVENANCE only — `plan:` names the plan, there is no `related_to`.
artifact(PLANS, 'code-review', `${CR_A}-alpha-review.md`, {
  id: CR_A, plan: FEAT_A, title: 'Review of Alpha implementation', status: 'APPROVED',
  created_at: '2026-01-01T02:00:00Z', updated_at: '2026-01-01T02:00:00Z', cycle: 1,
});

// Joins Alpha transitively: FIX -> CR -> plan -> family.
artifact(PLANS, 'code-review', `${FIX_A}-alpha-fix.md`, {
  id: FIX_A, title: 'Alpha remediation', status: 'DONE',
  created_at: '2026-01-01T03:00:00Z', updated_at: '2026-01-01T03:00:00Z', cycle: 1, related_to: CR_A,
});

// Belongs to Alpha AND Beta. It gets there the way a real artifact does now that
// only the first spec id counts: Alpha is its OWN spec, and Beta arrives through
// A genuinely shared artifact: it names NO spec of its own and hangs off one plan in
// each family, which is the only route to cross-family membership that survives the
// rule below. An artifact that DOES name its own spec keeps that reference and
// nothing else — naming a second family's plan beside your own spec is a citation,
// and following it re-imported that family's whole subtree one hop below the spec
// cut. In the reference corpus that single hop left the four largest families
// entirely unchanged; closing it took cross-family membership from 262 artifacts to
// 13, and the 13 that remain are all this shape.
artifact(PLANS, 'feat', `${FEAT_X}-cross-cutting.md`, {
  id: FEAT_X, title: 'Cross-cutting work', status: 'DONE',
  created_at: '2026-01-01T05:00:00Z', updated_at: '2026-01-01T05:00:00Z', cycle: 0,
  related_to: `${FEAT_A}, ${FEAT_B}`,
});

// Beta's own plan, and a BLOCKED qa report on it -> Beta is open, and neither may
// leak into Alpha: they hang off a plan that belongs to Beta alone.
artifact(PLANS, 'feat', `${FEAT_B}-beta-impl.md`, {
  id: FEAT_B, title: 'Beta implementation', status: 'DONE',
  created_at: '2026-01-02T01:00:00Z', updated_at: '2026-01-02T01:00:00Z', cycle: 0, related_to: SPEC_B,
});
artifact(PLANS, 'qa', `${QA_B}-beta-qa.md`, {
  id: QA_B, plan: FEAT_B, title: 'QA Report — Beta', status: 'BLOCKED',
  created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z', cycle: 1,
});

// Gamma's newest artifact is a REQUEST_CHANGES review -> Gamma is open.
artifact(PLANS, 'feat', `${FEAT_C}-gamma-impl.md`, {
  id: FEAT_C, title: 'Gamma implementation', status: 'DONE',
  created_at: '2026-01-04T01:00:00Z', updated_at: '2026-01-04T01:00:00Z', cycle: 0, related_to: SPEC_C,
});
artifact(PLANS, 'code-review', `${CR_C}-gamma-review.md`, {
  id: CR_C, plan: FEAT_C, title: 'Review of Gamma implementation', status: 'REQUEST_CHANGES',
  created_at: '2026-01-04T02:00:00Z', updated_at: '2026-01-04T02:00:00Z', cycle: 1,
});

// Names its spec by FULL BASENAME rather than by id — the id is still in there.
artifact(PLANS, 'test', `${TEST_A}-alpha-tests.md`, {
  id: TEST_A, title: 'Alpha test report', status: 'PASS',
  created_at: '2026-01-01T04:00:00Z', updated_at: '2026-01-01T04:00:00Z', cycle: 0,
  related_to: `${SPEC_A}-alpha`,
});

// Names its OWN spec first and Alpha second, the way a plan cites prior art. Only
// the first counts, so this must land in Gamma and nowhere near Alpha's subtree.
artifact(PLANS, 'feat', `${FEAT_P}-gamma-prior-art.md`, {
  id: FEAT_P, title: 'Gamma groundwork, building on Alpha', status: 'DONE',
  created_at: '2026-01-04T00:30:00Z', updated_at: '2026-01-04T00:30:00Z', cycle: 0,
  related_to: `${SPEC_C}, ${SPEC_A}, ${FEAT_A}`,
});

// No reference key at all, but its prose names Beta's spec — the `**Related:**`
// shape that 23 of the reference corpus's 24 unattached artifacts carry. It must
// attach, and the page must say the evidence was weaker than a key.
artifact(PLANS, 'final', `${FINAL_M}-beta-final.md`, {
  id: FINAL_M, title: 'Final report — Beta', status: 'DONE',
  created_at: '2026-01-02T12:00:00Z', updated_at: '2026-01-02T12:00:00Z', cycle: 0,
}, `**Related:** [${SPEC_PHANTOM}](../specs/${SPEC_PHANTOM}-gone.md) [${SPEC_B}](../specs/${SPEC_B}-beta.md)\n\n# Final report\n\nBuilds on ${SPEC_A}.`);

// Cites nothing that resolves, and its prose names no spec either -> unattached,
// and the page must say so. The body is spelled out so no stray id can creep in:
// an orphan that accidentally mentions a spec would stop testing the orphan case.
artifact(PLANS, 'qa', `${QA_ORPHAN}-orphan-qa.md`, {
  id: QA_ORPHAN, title: 'Orphan QA', status: 'READY_TO_COMMIT',
  created_at: '2026-01-05T00:00:00Z', updated_at: '2026-01-05T00:00:00Z', cycle: 0,
}, '# Orphan QA\n\nNothing here names a spec.\n');

// Legacy 3-digit basenames: no timestamp token at all, id only in frontmatter.
artifact(PLANS, 'specs', 'SPEC-001-legacy-spec.md', {
  id: 'SPEC-001', title: 'Legacy spec', status: 'READY_FOR_PLANNING',
  created_at: '2025-12-01T00:00:00Z', updated_at: '2025-12-01T00:00:00Z', related_to: '—',
});
artifact(PLANS, 'feat', 'FEAT-001-legacy-impl.md', {
  id: 'FEAT-001', title: 'Legacy implementation', status: 'DONE',
  created_at: '2025-12-01T01:00:00Z', updated_at: '2025-12-01T01:00:00Z', related_to: 'SPEC-001',
});

const outA = path.join(tmpRoot, 'out-a.html');
const first = run(['--root', PLANS, '--out', outA]);
check('corpus generates', first.status === 0 && fs.existsSync(outA),
  `status=${first.status} out=${JSON.stringify(((first.stdout || '') + (first.stderr || '')).trim())}`);
const html = fs.existsSync(outA) ? fs.readFileSync(outA, 'utf8') : '';

// --- grouping -------------------------------------------------------------
const alpha = block(html, SPEC_A);
const beta = block(html, SPEC_B);
const gamma = block(html, SPEC_C);
const legacy = block(html, 'SPEC-001');
const unattached = block(html, '__unattached__');

check('related_to joins a family', rowIds(alpha).includes(FEAT_A), `alpha rows: ${rowIds(alpha).join(',')}`);
check('CR joins by plan: provenance with no related_to', rowIds(alpha).includes(CR_A), `alpha rows: ${rowIds(alpha).join(',')}`);
check('FIX joins transitively through its CR', rowIds(alpha).includes(FIX_A), `alpha rows: ${rowIds(alpha).join(',')}`);
check('a shared artifact is listed in both families',
  rowIds(alpha).includes(FEAT_X) && rowIds(beta).includes(FEAT_X),
  `alpha=${rowIds(alpha).join(',')} beta=${rowIds(beta).join(',')}`);
check('a shared artifact is marked as shared', new RegExp(`data-id="${FEAT_X}"[^\\n]*shared`).test(alpha));
check('a QA joins through its plan\'s family', rowIds(beta).includes(QA_B), `beta rows: ${rowIds(beta).join(',')}`);
check('a single-family chain does not leak into another family', !rowIds(alpha).includes(QA_B), `alpha rows: ${rowIds(alpha).join(',')}`);
check('a related_to naming the full basename still resolves', rowIds(alpha).includes(TEST_A), `alpha rows: ${rowIds(alpha).join(',')}`);
check('a spec citing another spec opens its own family, it does not join one',
  !rowIds(alpha).includes(SPEC_C) && !rowIds(alpha).includes(FEAT_C) && !rowIds(alpha).includes(CR_C),
  `alpha rows: ${rowIds(alpha).join(',')}`);
// The prior-art cut, one level down from a spec citing a spec. Without it a plan's
// second and third `related_to` ids drag its whole downstream subtree into features
// it only cited: the measured cost was a 94-artifact family holding ten of them.
check('a plan citing two specs joins only the FIRST one',
  rowIds(gamma).includes(FEAT_P) && !rowIds(alpha).includes(FEAT_P),
  `gamma=${rowIds(gamma).includes(FEAT_P)} alpha rows: ${rowIds(alpha).join(',')}`);
// The same cut one hop down. FEAT_P also names Alpha's PLAN, which re-imports Alpha
// through provenance if a spec-only cut is all that runs — the defect that left the
// four largest families of the reference corpus unchanged.
check('a plan naming its own spec drops a foreign plan parent too',
  rowIds(gamma).includes(FEAT_P) && !rowIds(alpha).includes(FEAT_P),
  `alpha rows: ${rowIds(alpha).join(',')}`);
check('an artifact citing nothing is unattached', rowIds(unattached).includes(QA_ORPHAN), `unattached: ${rowIds(unattached).join(',')}`);
check('an attached artifact is NOT in the unattached group', !rowIds(unattached).includes(CR_A));
check('legacy 3-digit artifacts form a family', rowIds(legacy).includes('FEAT-001'), `legacy rows: ${rowIds(legacy).join(',')}`);
check('the spec itself is a member of its own family', rowIds(alpha).includes(SPEC_A));
check('unattached count is a headline number', stat(html, 'unattached') === '1', `got ${stat(html, 'unattached')}`);
check('artifact count excludes .progress.md sidecars', stat(html, 'artifacts') === '17', `got ${stat(html, 'artifacts')}`);
check('family count counts spec-rooted families', stat(html, 'families') === '4', `got ${stat(html, 'families')}`);

// --- the fourth edge, and its disclosure --------------------------------------
check('a spec id in the BODY attaches an artifact with no reference key',
  rowIds(beta).includes(FINAL_M) && !rowIds(unattached).includes(FINAL_M),
  `beta rows: ${rowIds(beta).join(',')}`);
check('an artifact attached by prose is tagged `by mention`',
  /by mention/.test(rowFor(beta, FINAL_M)), rowFor(beta, FINAL_M));
check('an artifact attached by a reference key is NOT tagged `by mention`',
  !/by mention/.test(rowFor(beta, QA_B)), rowFor(beta, QA_B));
// Only the FIRST mention that resolves is believed. FINAL_M's prose names Beta and
// then Alpha; believing both would spread every prose citation across the tree, and
// a mention is the weakest edge on the page — the one that can least afford it.
check('only the first resolvable body mention is believed',
  !rowIds(alpha).includes(FINAL_M), `alpha rows: ${rowIds(alpha).join(',')}`);
// A mention is intersected with the specs that actually exist. Without that, a
// phantom id opens a family of one that no spec roots, and the artifact vanishes
// from the page: in no family block, and not counted as unattached either.
check('a body mention naming no existing spec is stepped over',
  rowIds(beta).includes(FINAL_M) && !html.includes(SPEC_PHANTOM),
  `beta rows: ${rowIds(beta).join(',')}`);
// The phantom must not open a family of its own either: an artifact seeded into a
// family no spec roots renders in no family block and is not counted as unattached,
// so it leaves the page entirely while every headline number still adds up.
check('a phantom mention opens no family of its own',
  stat(html, 'families') === '4', `families=${stat(html, 'families')}`);
check('the family says how many members arrived by mention',
  /1 by mention/.test((beta.match(/<summary>[\s\S]*?<\/summary>/) || [''])[0]),
  (beta.match(/<summary>[\s\S]*?<\/summary>/) || [''])[0]);
check('weak attachments are a headline number', stat(html, 'mentioned') === '1', `got ${stat(html, 'mentioned')}`);
// The prose the old page carried was false for 23 of the 24 artifacts it listed:
// it claimed nothing on disk said which feature they belonged to, while the
// normative rule's own command is a body grep that answers for almost all of them.
check('the unattached prose accounts for the body grep too',
  /prose/.test(unattached) && !/These name no spec, no plan and no review that resolves/.test(unattached),
  unattached.slice(0, 500));

// --- the open band --------------------------------------------------------
const openBand = (html.match(/<section class="section" id="open">[\s\S]*?<\/section>/) || [''])[0];
check('a family ending in REQUEST_CHANGES is open', openBand.includes(`data-family="${SPEC_C}"`), openBand.slice(0, 400));
check('a family ending in BLOCKED qa is open', openBand.includes(`data-family="${SPEC_B}"`), openBand.slice(0, 400));
check('a family that ended clean is not open', !openBand.includes(`data-family="${SPEC_A}"`));

// --- family ordering and the summary line ---------------------------------
// Newest activity first is the whole reason the page is browsable: the family
// somebody is looking for is nearly always the one just worked on.
check('families are ordered newest activity first',
  (section(html, 'families').match(/data-family="([^"]*)"/g) || []).map((s) => s.slice(13, -1))
    .join(',') === [SPEC_C, SPEC_B, SPEC_A, 'SPEC-001'].join(','),
  (section(html, 'families').match(/data-family="([^"]*)"/g) || []).join(','));
// The id and the slug are the keys a reader arrives holding, off a filename. A
// `<details>` body hides them until the right family is already open, which is the
// one thing they were needed for.
{
  const sum = (alpha.match(/<summary>[\s\S]*?<\/summary>/) || [''])[0];
  check('a family\'s id and slug are in the summary, not the collapsed body',
    sum.includes(`<span class="badge">${SPEC_A}</span>`) && sum.includes('alpha'), sum);
}

// --- sidecars and siblings ------------------------------------------------
// The old spelling of this asserted no `data-id` contained "progress", which a
// `.progress.md` row would satisfy anyway: its basename is canonical, so its id is
// its PLAN's id and the word never reaches the attribute. The href is what differs.
check('a .progress.md is not indexed as an artifact',
  rowHrefs(html).length > 0 && !rowHrefs(html).some((h) => h.endsWith('.progress.md')),
  rowHrefs(html).filter((h) => h.endsWith('.progress.md')).join(', '));
check('a .progress.md is noted on its plan', new RegExp(`data-id="${FEAT_A}"[^\\n]*alpha-impl\\.progress\\.md`).test(alpha));
check('an .html sibling is linked when it exists', new RegExp(`data-id="${FEAT_A}"[^\\n]*alpha-impl\\.html`).test(alpha));
check('no .html link is emitted when no sibling exists',
  !new RegExp(`data-id="${CR_A}"[^\\n]*alpha-review\\.html`).test(alpha));

// --- what a row says and does not say --------------------------------------
// `cycle: 0` is the common case and means "ran outside a loop", so printing it
// spends a row's width to say nothing; a non-zero cycle is what places an artifact
// inside the rework it came from.
check('a non-zero cycle is shown and `cycle: 0` is suppressed',
  /cycle 1/.test(rowFor(alpha, CR_A)) && !/cycle/.test(rowFor(alpha, SPEC_A)),
  `CR=${rowFor(alpha, CR_A)}\nSPEC=${rowFor(alpha, SPEC_A)}`);
// Every href must resolve from the index's own directory, wherever that is. An
// absolute path works on the machine that generated it and nowhere else, and the
// link gate would not notice because the file really is there.
check('an artifact link is relative to the index, not absolute',
  rowHrefs(html).includes(`corpus/plans/feat/${FEAT_A}-alpha-impl.md`) &&
    !rowHrefs(html).some((h) => h.startsWith('/')),
  rowHrefs(html).slice(0, 3).join(' | '));

// --- the shape of the corpus ---------------------------------------------
check('counts by directory are reported', /data-dir="code-review"[^>]*>3</.test(html), 'code-review should hold 3 artifacts');
check('counts by prefix are reported', /data-prefix="SPEC"[^>]*>4</.test(html), 'four SPEC artifacts');

// --- the page is safe and self-contained ----------------------------------
check('no script element', !/<script/i.test(html));
check('no inline event handler', !/\son[a-z]+\s*=/i.test(html));
check('no remote asset', !/(?:href|src)="(?:https?:)?\/\//i.test(html));
check('carries a locked-down CSP', /Content-Security-Policy/.test(html) && /script-src 'none'/.test(html));

// --- every local href resolves (mirrors check-artifact-links.cjs exactly) --
{
  const hrefs = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/^(https?:|mailto:|data:|#|\/\/)/.test(m[1])) continue;
    if (m[1].split('#')[0]) hrefs.push(m[1].split('#')[0]);
  }
  const broken = hrefs.filter((h) => !fs.existsSync(path.resolve(path.dirname(outA), h)));
  check('every local href resolves on disk', hrefs.length > 0 && broken.length === 0,
    `${hrefs.length} href(s), broken: ${broken.slice(0, 5).join(', ')}`);
}

// --- determinism ----------------------------------------------------------
{
  const outB = path.join(tmpRoot, 'out-b.html');
  const second = run(['--root', PLANS, '--out', outB]);
  const same = second.status === 0 && fs.readFileSync(outA).equals(fs.readFileSync(outB));
  check('two runs over an unchanged tree are byte-identical', same);
  const third = run(['--root', PLANS, '--out', outA]);
  check('regenerating in place is byte-identical', third.status === 0 && fs.readFileSync(outA).equals(fs.readFileSync(outB)));
  check('no wall-clock stamp leaks into the page', !/\b20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/.test(html.split('<main')[0]));
}

// --- --check --------------------------------------------------------------
{
  const clean = run(['--root', PLANS, '--out', outA, '--check']);
  check('--check passes on an up-to-date file', clean.status === 0,
    `status=${clean.status} out=${JSON.stringify(((clean.stdout || '') + (clean.stderr || '')).trim())}`);

  const stale = outA + '.stale';
  fs.writeFileSync(stale, html.replace('</main>', '<p>hand edit</p></main>'));
  const drifted = run(['--root', PLANS, '--out', stale, '--check']);
  const driftOut = (drifted.stdout || '') + (drifted.stderr || '');
  check('--check fails on a stale file', drifted.status === 1, `status=${drifted.status}`);
  check('--check writes nothing', fs.readFileSync(stale, 'utf8').includes('hand edit'), driftOut);

  const missing = run(['--root', PLANS, '--out', path.join(tmpRoot, 'never-written.html'), '--check']);
  check('--check fails when the file is absent', missing.status === 1 && !fs.existsSync(path.join(tmpRoot, 'never-written.html')),
    `status=${missing.status}`);
}

// ---------------------------------------------------------------------------
// Collation. The generator bans `localeCompare` because the sibling
// `stamp-orchestrator-version.mjs` was caught digesting one unchanged tree to two
// different values under a Thai default locale. These two ids are a real pair out
// of the reference corpus, and they are the pair that flips: by code unit `E`
// (U+0045) precedes `_` (U+005F), while ICU weights the underscore as punctuation
// and sorts it first. Identical stamps make the id the tiebreak, so the emitted
// order IS the comparator.
// ---------------------------------------------------------------------------
{
  const coll = path.join(tmpRoot, 'collation', 'plans');
  const STAMP = { created_at: '2026-08-06T10:47:50Z', updated_at: '2026-08-06T10:47:50Z', status: 'DONE', cycle: 0 };
  artifact(coll, 'eval', 'EVAL-20260806T104750Z-report.md',
    Object.assign({ id: 'EVAL-20260806T104750Z-report', title: 'Spec evaluation' }, STAMP));
  artifact(coll, 'eval', '_ac-baseline-SPEC-20260805T174719Z-6b85.md',
    Object.assign({ title: 'Acceptance-criteria baseline' }, STAMP));
  const out = path.join(tmpRoot, 'collation.html');
  const r = run(['--root', coll, '--out', out]);
  const page = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  // Recent is the sort reversed, so code-unit ascending (EVAL, _ac) prints _ac first.
  check('ordering is by code unit, never by locale collation',
    rowIds(section(page, 'recent')).join(',') ===
      '_ac-baseline-SPEC-20260805T174719Z-6b85,EVAL-20260806T104750Z-report',
    rowIds(section(page, 'recent')).join(','));
}

// ---------------------------------------------------------------------------
// The fixed point. Provenance is a chain, and nothing on disk orders artifacts
// along it: this FIX carries an `updated_at` EARLIER than the CR it cites, and that
// CR is earlier than the plan IT cites, so the array is in exactly reverse
// dependency order and membership needs three passes to settle. A single pass
// leaves both the FIX and the CR out of the family — which reads as a feature that
// was never reviewed or remediated. No body here names a spec, so the prose
// fallback cannot quietly stand in for the loop.
// ---------------------------------------------------------------------------
{
  const fp = path.join(tmpRoot, 'fixpoint', 'plans');
  const S = 'SPEC-20260201T000000Z-5555';
  const F = 'FEAT-20260201T050000Z-6666';
  const C = 'CR-20260201T040000Z-7777';
  const X = 'FIX-20260201T030000Z-8888';
  const body = '# artifact\n\nNo identifier in this prose.\n';
  artifact(fp, 'specs', `${S}-chain.md`, {
    id: S, title: 'Chain spec', status: 'READY_FOR_PLANNING',
    created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
  }, body);
  artifact(fp, 'feat', `${F}-chain.md`, {
    id: F, title: 'Chain plan', status: 'DONE', related_to: S,
    created_at: '2026-02-01T05:00:00Z', updated_at: '2026-02-01T05:00:00Z',
  }, body);
  artifact(fp, 'code-review', `${C}-chain.md`, {
    id: C, title: 'Chain review', status: 'REQUEST_CHANGES', plan: F,
    created_at: '2026-02-01T04:00:00Z', updated_at: '2026-02-01T04:00:00Z',
  }, body);
  artifact(fp, 'code-review', `${X}-chain.md`, {
    id: X, title: 'Chain remediation', status: 'DONE', related_to: C,
    created_at: '2026-02-01T03:00:00Z', updated_at: '2026-02-01T03:00:00Z',
  }, body);
  const out = path.join(tmpRoot, 'fixpoint.html');
  const r = run(['--root', fp, '--out', out]);
  const page = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  check('membership iterates to a fixed point, not one pass',
    rowIds(block(page, S)).includes(X) && rowIds(block(page, S)).includes(C),
    `family rows: ${rowIds(block(page, S)).join(',')}`);
}

// ---------------------------------------------------------------------------
// The recent cap and the sentence that discloses it. The cap exists because
// `gate-scope.cjs` refuses a gate target over 5 MiB; the sentence exists because a
// silent truncation reads as "this is everything", which is the failure the whole
// page is meant to prevent.
// ---------------------------------------------------------------------------
{
  const many = path.join(tmpRoot, 'many', 'plans');
  for (let i = 0; i < 205; i++) {
    const hh = String(Math.floor(i / 60)).padStart(2, '0');
    const mm = String(i % 60).padStart(2, '0');
    const at = `2026-03-01T${hh}:${mm}:00Z`;
    const id = `FEAT-20260301T${hh}${mm}00Z-${String(i).padStart(4, '0')}`;
    artifact(many, 'feat', `${id}-bulk.md`, {
      id, title: `Bulk ${i}`, status: 'DONE', created_at: at, updated_at: at, cycle: 0,
    }, '# bulk\n');
  }
  const out = path.join(tmpRoot, 'many.html');
  const r = run(['--root', many, '--out', out]);
  const page = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  check('the recent list is capped', rowIds(section(page, 'recent')).length === 200,
    `${rowIds(section(page, 'recent')).length} rows for 205 artifacts`);
  check('the recent cap is disclosed in the page',
    /The 200 most recent of 205 artifacts/.test(page) && /this list is capped/.test(page),
    (section(page, 'recent').match(/<p class="note">[\s\S]*?<\/p>/) || [''])[0]);
}

// ---------------------------------------------------------------------------
// "Review cycles" counts code reviews. A `cycle:` number is whatever the role that
// wrote the artifact was told to stamp on it, and reading the largest one as a
// review count would report five rounds of rework on a family reviewed twice.
// ---------------------------------------------------------------------------
{
  const cyc = path.join(tmpRoot, 'cycles', 'plans');
  const S = 'SPEC-20260301T000000Z-1a1a';
  const F = 'FEAT-20260301T010000Z-2b2b';
  artifact(cyc, 'specs', `${S}-cycles.md`, {
    id: S, title: 'Cycles spec', status: 'READY_FOR_PLANNING', cycle: 5,
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  }, '# spec\n');
  artifact(cyc, 'feat', `${F}-cycles.md`, {
    id: F, title: 'Cycles plan', status: 'DONE', related_to: S, cycle: 5,
    created_at: '2026-03-01T01:00:00Z', updated_at: '2026-03-01T01:00:00Z',
  }, '# plan\n');
  for (const [id, at] of [['CR-20260301T020000Z-3c3c', '02'], ['CR-20260301T030000Z-4d4d', '03']]) {
    artifact(cyc, 'code-review', `${id}-cycles.md`, {
      id, title: 'Cycles review', status: 'APPROVED', plan: F, cycle: 5,
      created_at: `2026-03-01T${at}:00:00Z`, updated_at: `2026-03-01T${at}:00:00Z`,
    }, '# review\n');
  }
  const out = path.join(tmpRoot, 'cycles.html');
  const r = run(['--root', cyc, '--out', out]);
  const page = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  const sum = (block(page, S).match(/<summary>[\s\S]*?<\/summary>/) || [''])[0];
  check('review cycles counts CRs, not the largest `cycle:` in frontmatter',
    /2 review cycles/.test(sum) && !/5 review cycles/.test(sum), sum);
}

// ---------------------------------------------------------------------------
// Duplicate ids. Nine legacy ids in the reference corpus are held by two artifacts
// each, so a `plan:` naming one resolves to both and carries its holder into two
// unrelated families. The page may not union them silently — a review filed under a
// feature it never touched, with nothing saying so, is the quiet wrongness this
// whole index exists to avoid.
// ---------------------------------------------------------------------------
{
  const dup = path.join(tmpRoot, 'dup', 'plans');
  artifact(dup, 'specs', 'SPEC-006-admin-events-crud.md', {
    id: 'SPEC-006', title: 'Admin events CRUD', status: 'READY_FOR_PLANNING',
    created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
  }, '# spec\n');
  artifact(dup, 'specs', 'SPEC-006-spot-comments-live-data.md', {
    id: 'SPEC-006', title: 'Spot comments live data', status: 'READY_FOR_PLANNING',
    created_at: '2026-04-01T00:10:00Z', updated_at: '2026-04-01T00:10:00Z',
  }, '# spec\n');
  artifact(dup, 'feat', 'FEAT-006-admin-events-crud.md', {
    id: 'FEAT-006', title: 'Admin events CRUD plan', status: 'DONE', related_to: 'SPEC-006',
    created_at: '2026-04-01T01:00:00Z', updated_at: '2026-04-01T01:00:00Z',
  }, '# plan\n');
  artifact(dup, 'feat', 'FEAT-006-spot-comments-live-data.md', {
    id: 'FEAT-006', title: 'Spot comments plan', status: 'DONE', related_to: 'SPEC-006',
    created_at: '2026-04-01T01:10:00Z', updated_at: '2026-04-01T01:10:00Z',
  }, '# plan\n');
  artifact(dup, 'code-review', 'CR-017-admin-events-crud.md', {
    id: 'CR-017', title: 'Review', status: 'APPROVED', plan: 'FEAT-006',
    created_at: '2026-04-01T02:00:00Z', updated_at: '2026-04-01T02:00:00Z',
  }, '# review\n');
  const out = path.join(tmpRoot, 'dup.html');
  const r = run(['--root', dup, '--out', out]);
  const page = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  const fam = block(page, 'SPEC-006');
  check('a reference resolving to two artifacts is tagged on the row',
    /ambiguous ref/.test(rowFor(fam, 'CR-017')), rowFor(fam, 'CR-017'));
  check('a family holding two specs of one id says so',
    /duplicate id/.test((fam.match(/<summary>[\s\S]*?<\/summary>/) || [''])[0]),
    (fam.match(/<summary>[\s\S]*?<\/summary>/) || [''])[0]);
  check('an unambiguous reference is not tagged', !/ambiguous ref/.test(block(html, SPEC_A)));
}

// ---------------------------------------------------------------------------
// Failing the way the siblings fail. A raw Node stack trace names a syscall instead
// of the artifact, and reads as a crash in this script rather than as a fact about
// the tree or the arguments.
// ---------------------------------------------------------------------------
{
  const bad = path.join(tmpRoot, 'unreadable', 'plans');
  const file = artifact(bad, 'specs', 'SPEC-20260501T000000Z-abcd-locked.md', {
    id: 'SPEC-20260501T000000Z-abcd', title: 'Locked', status: 'DRAFT',
    created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z',
  }, '# locked\n');
  fs.chmodSync(file, 0o000);
  // Running as root defeats the permission bit, and a test that silently passes for
  // the wrong reason is worse than one that says it did not run.
  const rootish = typeof process.getuid === 'function' && process.getuid() === 0;
  const r = run(['--root', bad, '--out', path.join(tmpRoot, 'unreadable.html')]);
  const msg = (r.stdout || '') + (r.stderr || '');
  check('an unreadable artifact fails in the script\'s own voice',
    rootish || (r.status === 1 && /^index-plans: cannot read artifact/m.test(msg) && !/at \w+ \(/.test(msg)),
    rootish ? 'skipped: running as root' : `status=${r.status} out=${JSON.stringify(msg.trim())}`);
  fs.chmodSync(file, 0o644);

  const asDir = path.join(tmpRoot, 'out-is-a-directory');
  fs.mkdirSync(asDir, { recursive: true });
  const w = run(['--root', PLANS, '--out', asDir]);
  const wMsg = (w.stdout || '') + (w.stderr || '');
  check('an --out naming a directory fails in the script\'s own voice',
    w.status === 1 && /^index-plans: cannot write/m.test(wMsg) && !/at \w+ \(/.test(wMsg),
    `status=${w.status} out=${JSON.stringify(wMsg.trim())}`);
}

// --- the page holds up at phone width -------------------------------------
// Both of these were real overflows at 360px: a family title is prose and ran to 57
// characters inside a `nowrap` tag, and a nested directory key is an unbroken
// 44-character path with no break opportunity in it.
check('the family tag in a Recent row may wrap',
  /\.tag--fam\s*\{[^}]*white-space:\s*normal/.test(html), 'tag--fam still inherits nowrap');
check('a long directory key may break inside the counts table',
  /\.counts th\s*\{[^}]*overflow-wrap:\s*anywhere/.test(html), 'counts th has no break opportunity');
// Found by measuring rather than by reading: with the two above fixed, a headless
// Chrome at 360px still scrolled 61px, from a nowrap facts line in every family
// summary and from 56-character legacy ids pinned at `flex: none`.
check('a family summary\'s facts line may wrap',
  /\.summary__meta\s*\{[^}]*flex-wrap:\s*wrap/.test(html), 'summary__meta cannot shrink below its children');
check('a long artifact id may shrink and break',
  /\.row__id\s*\{[^}]*overflow-wrap:\s*anywhere/.test(html) && !/\.row__id\s*\{[^}]*flex:\s*none/.test(html),
  'row__id is still unshrinkable');

// ---------------------------------------------------------------------------
// Hostile text. Kept in its own tree because an href carrying `<` is escaped for
// the attribute and would then not resolve literally for the link gate — a real
// slug never contains one, and the corpus tree above is what pins link health.
// ---------------------------------------------------------------------------
{
  const evil = path.join(tmpRoot, 'evil', 'plans');
  artifact(evil, 'specs', 'SPEC-20260101T000000Z-7777-safe.md', {
    id: 'SPEC-20260101T000000Z-7777', title: 'He said "danger" & <b>more</b>', status: 'DRAFT',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', cycle: 0,
  });
  artifact(evil, 'feat', 'FEAT-20260101T010000Z-8888-<script>alert(1).md', {
    id: 'FEAT-20260101T010000Z-8888', title: "it's <em>fine</em>", status: 'DONE',
    created_at: '2026-01-01T01:00:00Z', updated_at: '2026-01-01T01:00:00Z', cycle: 0,
    related_to: 'SPEC-20260101T000000Z-7777',
  });
  const out = path.join(tmpRoot, 'evil.html');
  const r = run(['--root', evil, '--out', out]);
  const page = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  check('hostile tree generates', r.status === 0, `status=${r.status} ${(r.stderr || '').trim()}`);
  check('a slug carrying markup is escaped', page.includes('&lt;script&gt;alert(1)') && !/<script/i.test(page));
  check('a frontmatter quote is escaped', page.includes('&quot;danger&quot;') && !page.includes('"danger"'));
  check('a frontmatter apostrophe is escaped', page.includes('&#39;s') && !page.includes("it's"));
  check('frontmatter markup is escaped', page.includes('&lt;b&gt;more&lt;/b&gt;') && !page.includes('<b>more</b>'));
}

// --- degenerate trees -----------------------------------------------------
{
  const empty = path.join(tmpRoot, 'empty', 'plans');
  fs.mkdirSync(empty, { recursive: true });
  const out = path.join(tmpRoot, 'empty.html');
  const r = run(['--root', empty, '--out', out]);
  const page = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  check('an empty tree still generates a page', r.status === 0 && /<\/html>/.test(page), `status=${r.status}`);
  check('an empty tree reports zeros', stat(page, 'artifacts') === '0' && stat(page, 'families') === '0',
    `artifacts=${stat(page, 'artifacts')} families=${stat(page, 'families')}`);
}

{
  const gone = path.join(tmpRoot, 'no-such-tree', 'plans');
  const out = path.join(tmpRoot, 'no-such-tree.html');
  const r = run(['--root', gone, '--out', out]);
  const msg = (r.stdout || '') + (r.stderr || '');
  check('a missing plans tree fails closed', r.status === 1 && /not (a directory|found)|does not exist/i.test(msg),
    `status=${r.status} out=${JSON.stringify(msg.trim())}`);
  check('a missing plans tree writes nothing', !fs.existsSync(out));
}

// --- argument handling ----------------------------------------------------
{
  const unknown = run(['--root', PLANS, '--nope']);
  check('an unknown flag is a usage error', unknown.status === 2, `status=${unknown.status}`);
  const dangling = run(['--root']);
  check('a flag missing its value is a usage error', dangling.status === 2, `status=${dangling.status}`);
}

if (failures) { console.error(`\nindex-plans: ${failures} failure(s)`); process.exit(1); }
console.log('\nindex-plans: OK');
