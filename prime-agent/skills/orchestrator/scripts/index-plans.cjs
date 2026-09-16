#!/usr/bin/env node
/**
 * Generates `plans/index.html` — one read view over the whole planning tree, so a
 * human can answer "what happened to feature X", "what is open right now" and
 * "what did this pipeline produce lately" by opening a file instead of grepping
 * seven flat directories holding hundreds of artifacts each.
 *
 * It is a READ view on purpose. Reorganising the tree itself is uncommittable:
 * `gate-scope.cjs` passes `--no-renames`, so every `git mv` surfaces as an Add and
 * drags the whole corpus back into gate scope, thousands of inter-artifact links
 * would have to be rewritten, and run membership cannot be recovered from disk at
 * all because no artifact carries a run id. This script therefore changes nothing
 * on disk except the one page it writes, and it walks the tree rather than
 * assuming its shape — today's flat `plans/<kind>/` layout and any future
 * per-run-folder layout both index correctly, at any nesting depth.
 *
 *   node .orchestrator/index-plans.cjs [--out <path>] [--check] [--root <plans dir>]
 *
 * The unit it groups by is the FAMILY — every artifact answering one `SPEC-*`,
 * across all the runs that touched it — as `.orchestrator/artifact-format.md` →
 * "The run family" defines it. The run is the wrong unit: a feature's story spans
 * two to four runs and 94% of families use more than one slug, so anything keyed
 * on a run or a slug splits one feature into pieces. The load-bearing half of that
 * rule is provenance: a code review carries `plan:` and, measured across both
 * reference projects, 0 of 222 carry `related_to` at all, so a family resolved
 * from `related_to` alone silently loses every review — which reads as a family
 * that was never reviewed rather than as a bug in this script. Anything that still
 * resolves to no family is listed under an explicit "Unattached" heading with its
 * count in the headline band: that number is the provenance debt the tree carries,
 * and hiding it in a footnote is what let it grow.
 *
 * NOT EVERY REFERENCE IS A PARENT, and the two ways of getting that wrong pull in
 * opposite directions, so each is answered separately:
 *
 *   OVER-JOINING. A reference key routinely names two or three parents, and only
 *   the first is the artifact's own — the rest are prior art ("builds on SPEC-x",
 *   "see FEAT-y"). Following all of them makes every downstream artifact propagate
 *   into every cited feature: measured, that grafted the whole splash-auth run onto
 *   account-settings and grew one family to 94 artifacts spanning 46 slugs and ten
 *   separate features, which answers "what happened to feature X" with nine other
 *   features. So a spec never joins another family at all, and an artifact that
 *   names its own spec keeps THAT reference and discards the rest — including
 *   foreign plans, which re-import the same family one hop below a spec-only cut
 *   and were the reason the four largest families survived that cut unchanged.
 *   After both cuts the largest family is 39 artifacts and is one feature.
 *
 *   UNDER-JOINING. The normative family rule's own command is a body grep, and for
 *   23 of the 24 artifacts that resolve from no reference key the body DOES say
 *   which spec they answer — typically a `**Related:**` line. Those are attached
 *   too, but a prose mention is measurably weaker evidence than a `related_to` or
 *   a `plan:` key (a bare id grep over-collects: 8 of 20 hits on one family were
 *   other features citing the spec in passing), so it is used only where reference
 *   keys resolve nothing, only the first id is taken, and every row and family
 *   count that depends on one says `by mention` on the page. Presenting a grep hit
 *   as provenance is what would make the page confidently wrong.
 *
 * Ambiguity is shown rather than resolved. Nine legacy ids in the measured corpus
 * are held by two artifacts each, so a `plan:` naming one propagates into both
 * families; the rows and families that stand on such an id are tagged instead of
 * being silently unioned, because a review filed under three unrelated features
 * with nothing on the page saying so is worse than one that admits it.
 *
 * DETERMINISM IS PART OF THE CONTRACT — the output is a committed file, so two
 * runs over an unchanged tree must be byte-identical or every regeneration shows
 * up as a diff and `--check` goes red on a clean checkout. That means no
 * `Date.now()` / `new Date()` "generated at" stamp, no reliance on filesystem
 * iteration order (every `readdirSync` is sorted), and no `localeCompare`
 * anywhere: collation is machine-dependent, and the sibling
 * `scripts/stamp-orchestrator-version.mjs` was caught by exactly that bug, where a
 * Thai default locale reordered two unmodified filenames and digested the same
 * tree to a different value. Every comparison here is by code unit.
 *
 * `--check` writes nothing and exits 1 when the file on disk differs from a fresh
 * generation, matching the other `--check` flags in this repo.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LABEL = 'index-plans';

/** The canonical prefix allow-list from `artifact-format.md`. Order is display order. */
const PREFIXES = ['SPEC', 'QNA', 'FEAT', 'PACT', 'FIX', 'QAF', 'TEST', 'CR', 'QA', 'EVAL', 'FINAL'];
const PREFIX_SET = new Set(PREFIXES);

/** `<PREFIX>-<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>.md` — the current ID grammar. */
const CANONICAL = /^([A-Z]+)-([0-9]{8}T[0-9]{6}Z-[0-9a-f]{4})-(.+)\.md$/;

/**
 * Frontmatter keys that point at an artifact's parents. `related_to` is the
 * normative one, `plan` is how every code review has always named its parent, and
 * `spec` is how the final report and the spec evaluations name theirs.
 */
const REF_KEYS = ['related_to', 'plan', 'spec'];

/**
 * A spec id as it appears in PROSE — both grammars, stopping at the id so a full
 * basename (`SPEC-…-6b85-kyc-wizard`) and a markdown link target truncate to the
 * same id the reference keys would have named. Hits are intersected with the specs
 * that actually exist before any of them is believed, which is what keeps a stray
 * `SPEC-0021` or a retired id from opening a family that has no spec behind it.
 */
const BODY_SPEC = /\bSPEC-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}\b|\bSPEC-[0-9]+\b/g;

/**
 * The recent list is capped because `gate-scope.cjs` refuses any gate target over
 * `MAX_GATE_BYTES` (5 MiB) — a page that grew past it would stop being auditable
 * by the link gate that keeps its hrefs honest. The cap is disclosed in the page
 * whenever it bites: a silent truncation reads as "this is everything".
 */
const RECENT_LIMIT = 200;

/** Same status→pill mapping the renderer uses, so a status reads the same colour everywhere. */
const STATUS_PILL = {
  READY_TO_COMMIT: 'success', READY_FOR_PLANNING: 'success', DONE: 'success',
  PASS: 'success', APPROVED: 'success', READY: 'success',
  IN_PROGRESS: 'active', DRAFT: 'active',
  BELOW_FLOOR: 'warning', READY_WITH_WARNINGS: 'warning', ISSUES: 'warning',
  BLOCKED: 'danger', BLOCKED_STALE: 'danger', REQUEST_CHANGES: 'danger', STALLED: 'danger',
  SKIPPED: 'muted', TODO: 'muted', SUPERSEDED: 'muted',
};

/** Code-unit ordering. See the determinism note in the header — never `localeCompare`. */
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * One escaper, attribute-grade, used at every interpolation. Artifact slugs and
 * frontmatter are untrusted text that reaches this page verbatim, and there is no
 * context here where the weaker content-only escape would be correct — keeping two
 * of them around only creates the opportunity to reach for the wrong one.
 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\x00-\x1F\x7F]/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

/** The same regex frontmatter reader the other scripts use — no YAML dependency. */
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

/**
 * A comparable, fixed-width stamp (`YYYYMMDDHHMMSS`) from either an ISO timestamp
 * or an ID token, so a legacy `2026-05-21T15:50:00Z` and a canonical
 * `20260706T154622Z` order against each other without ever constructing a `Date`.
 */
function stampOf(value) {
  if (!value) return '';
  const digits = String(value).replace(/[^0-9]/g, '').slice(0, 14);
  return digits ? digits.padEnd(14, '0') : '';
}

const dateOf = (stamp) => (stamp ? `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}` : '—');

/**
 * Every file under `dir`, depth-first, with each directory's entries sorted by
 * code unit so the walk order never depends on the filesystem. Symlinks are
 * skipped rather than followed: a link loop would hang the walk, and a link
 * pointing out of the tree would index files this pipeline never produced.
 */
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => byKey(a.name, b.name))) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

/**
 * The parent ids an artifact names, deduplicated, in key order. Values are
 * comma- or space-separated lists that also carry prose placeholders (a real
 * corpus has `related_to: —`), so a token counts only when it looks like an ID
 * whose prefix is on the allow-list; everything else is dropped rather than
 * guessed at.
 */
function refsOf(fm) {
  const seen = new Set();
  const refs = [];
  for (const key of REF_KEYS) {
    if (!fm[key]) continue;
    for (const raw of String(fm[key]).split(/[,\s]+/)) {
      const token = raw.replace(/^[`[(]+|[`\])]+$/g, '').trim();
      const prefix = token.split('-')[0];
      if (!PREFIX_SET.has(prefix) || !/^[A-Z]+-[A-Za-z0-9._-]+$/.test(token)) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      refs.push(token);
      // A real corpus also writes the FULL basename where the id belongs
      // (`related_to: SPEC-20260805T174719Z-6b85-kyc-wizard-native-age-range`), so
      // the bare id is offered alongside the raw token. This is not the forbidden
      // guess-by-slug: the id is read out of the value the artifact itself wrote in
      // a reference key, and the timestamp+hex it contains is unique. Measured, it
      // is what 21 references across 9 artifacts depend on to resolve at all.
      const canon = token.match(/^([A-Z]+-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4})-.+$/);
      if (canon && !seen.has(canon[1])) { seen.add(canon[1]); refs.push(canon[1]); }
    }
  }
  return refs;
}

/**
 * The spec ids an artifact's BODY names, deduplicated, in the order they appear.
 * Only the first of these is ever believed (see the header), and reading order is
 * what makes "first" mean the right thing: a `**Related:**` line sits above the
 * prose that cites prior art, so the artifact's own spec is the id that comes
 * first — measured true for all 23 artifacts this attaches in the reference corpus.
 */
function mentionsOf(body) {
  const seen = new Set();
  const out = [];
  for (const id of body.match(BODY_SPEC) || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Describe one `.md` artifact. Legacy basenames that predate the timestamp grammar
 * (101 of 752 in the measured corpus, including 3-digit ids like `FEAT-001-…`) must
 * still be indexed, so identity degrades in steps: the canonical basename first,
 * then the frontmatter `id`, then the basename itself. The prefix degrades the same
 * way, which is what types a spec evaluation filed as `P0-<topic>-<stamp>.md` with
 * `id: EVAL-…` as an EVAL rather than as an unknown.
 */
function describe(abs, root, present) {
  const base = path.basename(abs);
  // The walk offers every `.md` it finds, and one of them being unreadable — a
  // permission bit, a dangling entry, a directory named `x.md` — is a fact about
  // the tree, not a bug in this script. Reporting it the way every sibling reports
  // a bad path beats a raw ENOENT stack trace that names no artifact.
  let src;
  try {
    src = fs.readFileSync(abs, 'utf8');
  } catch (e) {
    die(`cannot read artifact: ${display(abs)} (${(e && e.code) || 'unreadable'})`);
  }
  const { fm, body } = parseFrontmatter(src);
  const canon = base.match(CANONICAL);
  const stem = base.slice(0, -3);
  const id = canon ? `${canon[1]}-${canon[2]}` : (fm.id || stem);
  const prefixes = [canon && canon[1], (String(fm.id || '').match(/^([A-Z]+)-/) || [])[1], (base.match(/^([A-Z]+)-/) || [])[1]];
  const prefix = prefixes.find((p) => p && PREFIX_SET.has(p)) || null;
  const slug = canon ? canon[3] : (stem.startsWith(id + '-') ? stem.slice(id.length + 1) : stem);
  const created = stampOf(fm.created_at) || stampOf(canon && canon[2]);
  const updated = stampOf(fm.updated_at) || created;
  const dir = path.relative(root, path.dirname(abs)) || '.';
  return {
    abs,
    id,
    prefix,
    slug,
    dir,
    title: fm.title || (body.match(/^#\s+(.+)$/m) || [, ''])[1] || slug,
    status: fm.status || '',
    cycle: fm.cycle || '',
    created,
    updated,
    refs: refsOf(fm),
    mentions: mentionsOf(body),
    html: present.has(abs.slice(0, -3) + '.html') ? abs.slice(0, -3) + '.html' : null,
    progress: present.has(abs.slice(0, -3) + '.progress.md') ? abs.slice(0, -3) + '.progress.md' : null,
    // Two artifacts can carry the same id (the measured corpus has two distinct
    // `SPEC-006` specs), so the path is the final tiebreak that keeps ordering total.
    sort: `${updated || created}|${id}|${path.relative(root, abs)}`,
  };
}

/** Every indexable artifact under `root`: all `.md` except the `.progress.md` sidecars. */
function collect(root) {
  const files = walk(root, []);
  const present = new Set(files);
  return files
    .filter((f) => f.endsWith('.md') && !f.endsWith('.progress.md'))
    .map((f) => describe(f, root, present));
}

/**
 * Assign every artifact to the families it belongs to, per the normative rules.
 * A `SPEC-*` opens a family keyed by its own id; anything naming that id joins it;
 * a review inherits the family of the plan its `plan:` names; and the whole thing
 * repeats until the assignment stops changing, so a fix plan that cites a review
 * that cites a plan lands in the plan's family. Membership only ever grows, which
 * is what makes the loop terminate — and an artifact that lands in several
 * families is listed in each (13 of 753 in the measured corpus belong to two,
 * none to more), because collapsing one to a single home would quietly misattribute
 * shared work. That number is what is left once prior-art citations are cut; before
 * the cut it was 262 spread over two to five families, and nearly all of the
 * difference was one feature's subtree sitting inside another's.
 *
 * Nothing is inferred from a slug or from timestamp adjacency: both were measured
 * unreliable — 37 slugs appear in more than one family, and 39 of 54 active days
 * touch more than one spec — so what does not resolve is reported as unresolved.
 */
function resolveFamilies(artifacts) {
  const specIds = new Set(artifacts.filter((a) => a.prefix === 'SPEC').map((a) => a.id));
  const indexById = new Map();
  artifacts.forEach((a, i) => {
    if (!indexById.has(a.id)) indexById.set(a.id, []);
    indexById.get(a.id).push(i);
  });

  // The subset of each artifact's references that are actually PARENTS. Two cuts,
  // both measured against the reference corpus:
  //
  //   A spec OPENS a family; it never joins one. 39 of 55 specs name other specs
  //   as prior art, and honouring those edges makes one spec inherit another's
  //   whole subtree — five features collapsed into a single 100-artifact family.
  //
  //   A non-spec artifact that names a spec keeps THAT ONE REFERENCE and nothing
  //   else. The first spec id is the one the run was written against — the
  //   convention every plan in the corpus follows, and the one its own
  //   `**Related:**` line repeats — so every later reference is a citation, whether
  //   it names another spec or another feature's plan. Cutting only the spec ids
  //   was measured and was not enough: 37 artifacts name their own spec AND a
  //   foreign plan, and the plan re-imports the same family one hop down, carrying
  //   its whole downstream subtree. That single hop is what left the four largest
  //   families completely unchanged after the spec-level cut — 45 of one family's
  //   59 members belonged to four other features. Cutting both drops cross-family
  //   membership from 262 artifacts to 13 and the largest family from 94 to 39.
  //
  //   An artifact that names NO spec is a different case and keeps every reference:
  //   the `plan:`/review chain is its only route to a family.
  const edges = artifacts.map((a) => {
    if (a.prefix === 'SPEC') return [];
    const ownSpec = a.refs.find((ref) => specIds.has(ref));
    // An artifact that declares its own spec has told you where it lives, and every
    // other reference it carries is a citation. Keep the spec and drop the rest.
    if (ownSpec) return [ownSpec];
    // No spec named: provenance through the plan/review chain is the only route to a
    // family, so follow every reference and let the fixed point resolve it. This is
    // the path every `CR` takes — none of the 222 in the reference corpora carries
    // `related_to` at all, only a `plan:`.
    return a.refs.slice();
  });

  const members = artifacts.map((a) => new Set(specIds.has(a.id) ? [a.id] : []));

  /**
   * Grow membership until it stops changing, so a fix plan that cites a review that
   * cites a plan lands in the plan's family however the artifacts happen to be
   * ordered — one pass only resolves a chain that is already in dependency order,
   * and nothing on disk guarantees that (a FIX whose `updated_at` predates the CR
   * it cites sorts ahead of it). Membership only ever grows, which is what makes
   * the loop terminate. When `weak` is passed, every family this run newly adds is
   * recorded there as well; see the seeding below for why that is exactly the set
   * that rests on a prose mention.
   */
  const propagate = (weak) => {
    let changed = true;
    while (changed) {
      changed = false;
      artifacts.forEach((a, i) => {
        const join = (fam) => {
          if (members[i].has(fam)) return;
          members[i].add(fam);
          if (weak) weak[i].add(fam);
          changed = true;
        };
        for (const ref of edges[i]) {
          if (specIds.has(ref)) { join(ref); continue; }
          for (const parent of indexById.get(ref) || []) for (const fam of members[parent]) join(fam);
        }
      });
    }
  };

  propagate(null);

  // Only now, with reference-key provenance at its fixed point, does the weakest
  // edge get a turn: an artifact that still resolves to nothing falls back to the
  // first spec id its prose names. Running it as a fallback rather than as a fourth
  // key is the whole safety margin — a bare id grep over-collects, so it is asked
  // only about artifacts where the strong keys already came back empty. Because the
  // strong pass has finished, every family added from here on is downstream of a
  // mention, which is what makes `weak` an exact record rather than an estimate.
  const weak = artifacts.map(() => new Set());
  artifacts.forEach((a, i) => {
    if (members[i].size) return;
    const mention = a.mentions.find((id) => specIds.has(id));
    if (!mention) return;
    members[i].add(mention);
    weak[i].add(mention);
  });
  propagate(weak);

  artifacts.forEach((a, i) => {
    a.families = [...members[i]].sort(byKey);
    a.byMention = [...weak[i]].sort(byKey);
    // References the page FOLLOWED that name more than one artifact. Nine legacy
    // ids in the measured corpus are held by two artifacts each, so such a
    // reference silently carries its holder into both families; the row says so
    // rather than letting the reader assume a single resolution.
    a.ambiguous = edges[i].filter((ref) => (indexById.get(ref) || []).length > 1);
  });

  const families = [...specIds].sort(byKey).map((specId) => {
    const list = artifacts.filter((a) => a.families.includes(specId)).sort((x, y) => byKey(x.sort, y.sort));
    const spec = list.find((a) => a.id === specId && a.prefix === 'SPEC');
    const newest = list[list.length - 1];
    return {
      id: specId,
      title: spec ? spec.title : specId,
      slug: spec ? spec.slug : '',
      members: list,
      newest,
      // The count of code reviews, NOT the largest `cycle:` any member carries: a
      // rework loop writes one CR per turn, and a family whose members happen to
      // sit at `cycle: 5` because an unrelated role numbered them that way has not
      // been reviewed five times.
      reviews: list.filter((a) => a.prefix === 'CR').length,
      mentioned: list.filter((a) => a.byMention.includes(specId)).length,
      // Two specs answering to one id is the duplicate-id defect at its root: every
      // artifact naming that id joins this family whichever spec it meant.
      specs: list.filter((a) => a.prefix === 'SPEC' && a.id === specId).length,
      from: list.reduce((lo, a) => (a.created && (!lo || a.created < lo) ? a.created : lo), ''),
      to: list.reduce((hi, a) => (a.updated && a.updated > hi ? a.updated : hi), ''),
      // Work that stopped mid-flight: the last thing that happened to this feature
      // was a review asking for changes, or a QA report that blocked the commit.
      open: !!newest && ((newest.prefix === 'CR' && newest.status === 'REQUEST_CHANGES') ||
        (newest.prefix === 'QA' && newest.status === 'BLOCKED')),
    };
  });
  // Newest activity first; the spec id breaks ties so the order is total.
  families.sort((a, b) => byKey(b.to, a.to) || byKey(a.id, b.id));
  return { families, unattached: artifacts.filter((a) => a.families.length === 0) };
}

/** A relative, on-disk-resolvable href from the index's own directory to `target`. */
const hrefTo = (outDir, target) => path.relative(outDir, target).split(path.sep).join('/');

const pillFor = (status) => `<span class="pill pill--${esc(STATUS_PILL[status] || 'muted')}">${esc(status || 'n/a')}</span>`;

/**
 * One artifact, on ONE line. Single-line rows keep the page greppable with the
 * line-oriented tools a human already has open next to it.
 */
function row(a, outDir, options) {
  const opts = options || {};
  const meta = [esc(dateOf(a.created)), esc(a.dir)];
  // `cycle: 0` means the role ran outside a loop, which is the common case and says
  // nothing; a non-zero cycle is the one number that places an artifact inside the
  // rework it came from, so only that is worth a row's width.
  if (/^[1-9][0-9]*$/.test(a.cycle)) meta.push(`<span class="tag">cycle ${esc(a.cycle)}</span>`);
  if (a.html) meta.push(`<a href="${esc(hrefTo(outDir, a.html))}">html</a>`);
  if (a.progress) meta.push(`<a href="${esc(hrefTo(outDir, a.progress))}">log</a>`);
  if (a.families.length > 1) meta.push(`<span class="tag">shared &times;${a.families.length}</span>`);
  // Inside a family block the question is "how did THIS artifact get into THIS
  // family", so the tag is per-family; in a flat list there is no family in view
  // and any weak edge at all is worth disclosing.
  if (opts.familyId ? a.byMention.includes(opts.familyId) : a.byMention.length > 0) {
    meta.push('<span class="tag tag--weak" title="attached by a spec id in its prose, not by a reference key">by mention</span>');
  }
  if (a.ambiguous.length) {
    meta.push(`<span class="tag tag--warn" title="${esc(a.ambiguous.join(', '))}">ambiguous ref` +
      (a.ambiguous.length > 1 ? ` &times;${a.ambiguous.length}` : '') + '</span>');
  }
  if (opts.family && a.families.length) {
    meta.push(`<span class="tag tag--fam">${esc(opts.familyTitles.get(a.families[0]) || a.families[0])}` +
      (a.families.length > 1 ? ` +${a.families.length - 1}` : '') + '</span>');
  }
  return `<li class="row" data-id="${esc(a.id)}">${pillFor(a.status)}` +
    `<a class="row__id" href="${esc(hrefTo(outDir, a.abs))}" title="${esc(a.title)}">${esc(a.id)}</a>` +
    `<span class="row__title">${esc(a.title)}</span>` +
    `<span class="row__meta">${meta.join(' &middot; ')}</span></li>`;
}

function statCard(label, value, name, tone) {
  return `<div class="stat${tone ? ' stat--' + tone : ''}">` +
    `<span class="stat__value" data-stat="${esc(name)}">${esc(value)}</span>` +
    `<span class="stat__label">${esc(label)}</span></div>`;
}

function countTable(rows, attr) {
  const body = rows.map(([key, n]) =>
    `<tr><th>${esc(key)}</th><td data-${attr}="${esc(key)}">${esc(n)}</td></tr>`).join('\n');
  return `<table class="counts"><tbody>\n${body}\n</tbody></table>`;
}

function familyBlock(family, outDir) {
  const span = family.from === family.to
    ? esc(dateOf(family.to))
    : `${esc(dateOf(family.from))} &rarr; ${esc(dateOf(family.to))}`;
  const facts = [
    `${family.members.length} artifact${family.members.length === 1 ? '' : 's'}`,
    span,
    `${family.reviews} review cycle${family.reviews === 1 ? '' : 's'}`,
  ];
  if (family.mentioned) facts.push(`<span class="tag tag--weak">${esc(family.mentioned)} by mention</span>`);
  if (family.specs > 1) facts.push(`<span class="tag tag--warn">duplicate id &times;${esc(family.specs)}</span>`);
  // The id and the slug ride in the SUMMARY, not in the collapsed body: they are the
  // identifiers the reader arrives holding — the ones in the filename they are
  // navigating away from — and a page that hides them behind a disclosure triangle
  // cannot be searched by the only keys the reader has.
  return `<details class="family${family.open ? ' family--open' : ''}" data-family="${esc(family.id)}">
<summary><span class="family__title">${esc(family.title)}</span>` +
    `<span class="family__ident"><span class="badge">${esc(family.id)}</span>` +
    (family.slug ? `<span class="family__slug">${esc(family.slug)}</span>` : '') +
    `</span><span class="summary__meta">` +
    `${pillFor(family.newest ? family.newest.status : '')} ${facts.join(' &middot; ')}</span></summary>
<div class="details__body">
<ol class="rows">
${family.members.map((a) => row(a, outDir, { familyId: family.id })).join('\n')}
</ol>
</div>
</details>`;
}

/** Build the page. Pure: same tree in, same bytes out. */
function buildIndex(root, outPath) {
  const outDir = path.dirname(outPath);
  const artifacts = collect(root).sort((a, b) => byKey(a.sort, b.sort));
  const { families, unattached } = resolveFamilies(artifacts);
  const familyTitles = new Map(families.map((f) => [f.id, f.title]));
  const shared = artifacts.filter((a) => a.families.length > 1).length;
  // Weak attachments are a headline number for the same reason the unattached count
  // is: they are provenance debt that a family page would otherwise absorb silently,
  // and a debt nobody can see is a debt nobody pays down.
  const mentioned = artifacts.filter((a) => a.byMention.length > 0).length;
  const open = families.filter((f) => f.open);

  const byPrefix = PREFIXES.map((p) => [p, artifacts.filter((a) => a.prefix === p).length])
    .filter(([, n]) => n > 0);
  const other = artifacts.filter((a) => !a.prefix).length;
  if (other) byPrefix.push(['(unrecognised)', other]);
  const dirs = [...new Set(artifacts.map((a) => a.dir))].sort(byKey)
    .map((d) => [d, artifacts.filter((a) => a.dir === d).length]);

  const recent = artifacts.slice().reverse();
  const shown = recent.slice(0, RECENT_LIMIT);
  const recentNote = recent.length > shown.length
    ? `The ${shown.length} most recent of ${recent.length} artifacts &mdash; this list is capped, ` +
      'the family sections above carry the rest.'
    : `All ${recent.length} artifact${recent.length === 1 ? '' : 's'}, newest first.`;

  const openSection = open.length
    ? `<ul class="open-list">\n${open.map((f) => `<li data-family="${esc(f.id)}">${pillFor(f.newest.status)}` +
        `<a class="row__id" href="${esc(hrefTo(outDir, f.newest.abs))}" title="${esc(f.newest.title)}">${esc(f.newest.id)}</a>` +
        `<span class="row__title">${esc(f.title)}</span>` +
        `<span class="row__meta">${esc(dateOf(f.newest.updated))} &middot; ${esc(f.newest.dir)}</span></li>`).join('\n')}\n</ul>`
    : '<p class="empty">Nothing is mid-flight: no family ends on a review asking for changes or a blocked QA report.</p>';

  const unattachedSection = unattached.length
    ? `<details data-family="__unattached__">
<summary><span class="family__title">Unattached</span><span class="summary__meta">` +
      `${unattached.length} artifact${unattached.length === 1 ? '' : 's'} with no resolvable family</span></summary>
<div class="details__body">
<p class="note">Everything here was asked all four questions and answered none of them: no <code>related_to</code>, <code>plan:</code> or <code>spec:</code> key that resolves, no parent that resolves one hop further out, and no spec id anywhere in the prose either. Nothing on disk says which feature these belong to. Adding the spec id to <code>related_to</code> is what moves one out of this list.</p>
<ol class="rows">
${unattached.slice().reverse().map((a) => row(a, outDir)).join('\n')}
</ol>
</div>
</details>`
    : '<p class="empty">Every artifact resolves to a family.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">
<title>Plans index</title>
${STYLE}
</head>
<body>
<main>
<header class="masthead">
<p class="masthead__kicker"><span>Pipeline index</span></p>
<h1>Plans index</h1>
<p class="masthead__lede">Every artifact under this tree, grouped into the family of the spec it answers &mdash; across all the runs that touched it. Families resolve from <code>related_to</code>, from a review's <code>plan:</code> provenance, and transitively through both; only the <em>first</em> spec id an artifact names is its own, the rest are prior art. Where no key resolves, a spec id in the artifact's own prose attaches it and the row says <span class="tag tag--weak">by mention</span>, because a grep hit is weaker evidence than a key. Nothing is inferred from a slug or from timestamp adjacency; what does not resolve is listed as unattached.</p>
</header>

<section class="stats">
${statCard('Artifacts', artifacts.length, 'artifacts')}
${statCard('Families', families.length, 'families')}
${statCard('Open now', open.length, 'open', open.length ? 'danger' : '')}
${statCard('Shared', shared, 'shared')}
${statCard('By mention', mentioned, 'mentioned', mentioned ? 'warning' : '')}
${statCard('Unattached', unattached.length, 'unattached', unattached.length ? 'warning' : '')}
</section>

<section class="section" id="open">
<h2>Open right now</h2>
<p class="note">Families whose newest artifact is a review asking for changes, or a QA report that blocked the commit.</p>
${openSection}
</section>

<section class="section" id="families">
<h2>Families <span class="count">${esc(families.length)}</span></h2>
<p class="note">Newest activity first. Each opens to its artifacts in the order they were written.</p>
${families.map((f) => familyBlock(f, outDir)).join('\n')}
${families.length ? '' : '<p class="empty">No spec artifacts found, so no families could be opened.</p>'}
</section>

<section class="section" id="recent">
<h2>Recent <span class="count">${esc(shown.length)}</span></h2>
<p class="note">${recentNote}</p>
<ol class="rows">
${shown.map((a) => row(a, outDir, { family: true, familyTitles })).join('\n')}
</ol>
${shown.length ? '' : '<p class="empty">Nothing here yet.</p>'}
</section>

<section class="section" id="unattached">
<h2>Unattached <span class="count">${esc(unattached.length)}</span></h2>
${unattachedSection}
</section>

<section class="section" id="shape">
<h2>Shape of the corpus</h2>
<div class="shape">
<div><h3>By prefix</h3>${countTable(byPrefix, 'prefix')}</div>
<div><h3>By directory</h3>${countTable(dirs, 'dir')}</div>
</div>
<p class="note">Generated by <code>index-plans.cjs</code>. It is a read view: regenerate it, never hand-edit it. No generation timestamp is recorded, so an unchanged tree always produces an identical file.</p>
</section>
</main>
</body>
</html>
`;
}

/**
 * The EDITORIAL DESIGN SYSTEM v1 token block from
 * `templates/html/final-report.template.html`, so the index reads as part of the
 * same pipeline output as the artifacts it links to. The tokens are inlined rather
 * than lifted from the scaffold at run time (which is what `render-artifact.cjs`
 * does) because this page's components — the stat band, the family rows, the count
 * tables — do not exist in any scaffold, and because the index has to be
 * generatable from a plans tree alone, with no `html-templates/` beside it.
 */
const STYLE = `<style>
:root {
  --bg-page:        #faf9f7;
  --bg-surface:     #f3f1ee;
  --bg-overlay:     #ece9e4;
  --text-primary:   #1a1917;
  --text-secondary: #4a4844;
  --text-muted:     #8a8680;
  --accent:         #3730a3;
  --accent-subtle:  #e0e7ff;
  --accent-focus:   #4f46e5;
  --rule:           #d6d2cb;
  --rule-heavy:     #b5b0a8;
  --status-success: #166534;
  --status-success-bg: #dcfce7;
  --status-active:  #92400e;
  --status-active-bg: #fef3c7;
  --status-warning: #9a3412;
  --status-warning-bg: #ffedd5;
  --status-danger:  #991b1b;
  --status-danger-bg: #fee2e2;
  --status-muted:   #374151;
  --status-muted-bg: #f3f4f6;
  --font-serif: Georgia, "Times New Roman", serif;
  --font-sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                "Helvetica Neue", Arial, sans-serif;
  --font-mono:  ui-monospace, "SF Mono", "Cascadia Code", "Fira Mono",
                Menlo, Consolas, monospace;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  2rem;
  --sp-1:  0.25rem;
  --sp-2:  0.5rem;
  --sp-3:  0.75rem;
  --sp-4:  1rem;
  --sp-6:  1.5rem;
  --sp-8:  2rem;
  --sp-12: 3rem;
  --sp-16: 4rem;
  --measure: 70ch;
  --line-height-body: 1.65;
  --line-height-heading: 1.2;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-page:        #141312;
    --bg-surface:     #1e1c1a;
    --bg-overlay:     #272420;
    --text-primary:   #f0ece6;
    --text-secondary: #b8b3ab;
    --text-muted:     #7a7570;
    --accent:         #818cf8;
    --accent-subtle:  #1e1b4b;
    --accent-focus:   #a5b4fc;
    --rule:           #2e2b28;
    --rule-heavy:     #3d3a36;
    --status-success: #86efac;
    --status-success-bg: #14532d;
    --status-active:  #fcd34d;
    --status-active-bg: #451a03;
    --status-warning: #fb923c;
    --status-warning-bg: #431407;
    --status-danger:  #fca5a5;
    --status-danger-bg: #450a0a;
    --status-muted:   #9ca3af;
    --status-muted-bg: #1f2937;
  }
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--line-height-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

main { max-width: 72rem; margin: 0 auto; padding: var(--sp-16) var(--sp-8); }
@media (max-width: 640px) { main { padding: var(--sp-12) var(--sp-4); } }

::selection { background: var(--accent-subtle); color: var(--accent); }
a { color: var(--accent); }

.masthead__kicker {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--text-muted);
  margin: 0 0 var(--sp-2);
}

h1 {
  font-family: var(--font-serif);
  font-size: var(--text-3xl);
  line-height: var(--line-height-heading);
  margin: 0 0 var(--sp-4);
}

h2 {
  font-family: var(--font-serif);
  font-size: var(--text-2xl);
  line-height: var(--line-height-heading);
  margin: 0 0 var(--sp-2);
}

h3 {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 0 0 var(--sp-2);
}

.masthead__lede { max-width: var(--measure); color: var(--text-secondary); margin: 0; }
.note { color: var(--text-muted); font-size: var(--text-sm); max-width: var(--measure); margin: 0 0 var(--sp-4); }
.empty { color: var(--text-muted); font-size: var(--text-sm); font-style: italic; }
code { font-family: var(--font-mono); font-size: 0.9em; }

.count {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
  vertical-align: middle;
}

.badge {
  font-family: var(--font-mono);
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: var(--text-xs);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--bg-overlay);
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

/*
 * A family title is prose, not a token: it runs to 57 characters in the measured
 * corpus, and inheriting the nowrap above made every row in Recent set a minimum
 * width wider than a phone and scroll the whole page sideways.
 */
.tag--fam { background: transparent; color: var(--text-muted); padding: 0; white-space: normal; overflow-wrap: anywhere; }

/* Weaker evidence, drawn weaker: outlined rather than filled, so a prose mention
   never reads with the confidence of a reference key. */
.tag--weak { background: transparent; color: var(--text-muted); border: 1px dashed var(--rule-heavy); padding: 0 5px; }

/* An unresolved ambiguity is a defect in the tree, not a fact about the artifact. */
.tag--warn { background: var(--status-warning-bg); color: var(--status-warning); }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 9px;
  border-radius: 999px;
  white-space: nowrap;
  line-height: 1.6;
  flex: none;
}

.pill::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.pill--success { background: var(--status-success-bg); color: var(--status-success); }
.pill--active  { background: var(--status-active-bg);  color: var(--status-active);  }
.pill--warning { background: var(--status-warning-bg); color: var(--status-warning); }
.pill--danger  { background: var(--status-danger-bg);  color: var(--status-danger);  }
.pill--muted   { background: var(--status-muted-bg);   color: var(--status-muted);   }

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--sp-3);
  margin-top: var(--sp-8);
}

.stat {
  background: var(--bg-surface);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.stat--warning { border-color: var(--status-warning); }
.stat--danger { border-color: var(--status-danger); }

.stat__value {
  font-family: var(--font-serif);
  font-size: var(--text-3xl);
  line-height: 1;
}

.stat--warning .stat__value { color: var(--status-warning); }
.stat--danger .stat__value { color: var(--status-danger); }

.stat__label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.section { margin-top: var(--sp-12); }

details { border-top: 1px solid var(--rule); }

summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  user-select: none;
}

summary::-webkit-details-marker { display: none; }

summary::before {
  content: "\\25B6";
  font-size: 0.7em;
  color: var(--accent);
  transition: transform 0.18s ease;
  flex: none;
}

details[open] > summary::before { transform: rotate(90deg); }

summary:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 3px; border-radius: 3px; }

/*
 * A nowrap flex row cannot shrink below the sum of its children, so at 360px the
 * facts line — pill, counts, date span, and now the provenance tags — set a minimum
 * wider than the viewport. Wrapping makes its minimum the widest single child (the
 * status pill) instead, which fits.
 */
.summary__meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  gap: var(--sp-2) var(--sp-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 400;
  color: var(--text-muted);
}

.family--open > summary { color: var(--status-danger); }
.family--open > summary::before { color: var(--status-danger); }
.family__title { flex: 1 1 22rem; min-width: 0; }

.family__ident {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-width: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--text-muted);
}

.family__slug { overflow-wrap: anywhere; }

.details__body {
  border-left: 3px solid var(--accent);
  padding-left: var(--sp-4);
  margin: 0 0 var(--sp-6) 2px;
}

.family--open > .details__body { border-left-color: var(--status-danger); }

.rows, .open-list { list-style: none; margin: 0; padding: 0; }

.row, .open-list li {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-3);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--rule);
  font-size: var(--text-sm);
}

.row:last-child { border-bottom: none; }

/*
 * "flex: none" kept the id intact at every width, including widths where it did not
 * fit: a legacy basename used as an id runs to 56 characters
 * (P0-admin-revoke-store-premium-guarantee-20260826T144914Z) and pushed the page
 * 82px past a 360px viewport. "0 1 auto" still refuses to shrink while there is
 * room, so nothing changes on a desktop.
 */
.row__id { font-family: var(--font-mono); font-size: var(--text-xs); text-decoration: none; flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; }
.row__id:hover { text-decoration: underline; }
.row__title { color: var(--text-primary); flex: 1 1 20rem; min-width: 0; }

.row__meta {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.shape { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--sp-8); margin-bottom: var(--sp-4); }

.counts { border-collapse: collapse; font-family: var(--font-mono); font-size: var(--text-sm); width: 100%; }

/*
 * A directory key is a path, and a nested tree produces unbroken 44-character ones
 * such as specs/evaluations/SPEC-20260805T174719Z-6b85. Without a break opportunity
 * the cell's min-content width is that whole string, which pushes the table — and
 * the page with it — past 360px. "anywhere" is the value that also shrinks
 * min-content; "break-word" still reserves the full width when computing
 * intrinsic size, so the table would overflow exactly as before.
 */
.counts th { text-align: left; font-weight: 400; color: var(--text-secondary); padding: var(--sp-1) 0; overflow-wrap: anywhere; }
.counts td { text-align: right; color: var(--text-primary); padding: var(--sp-1) 0; }
.counts tr + tr th, .counts tr + tr td { border-top: 1px solid var(--rule); }
</style>`;

/**
 * Repo-relative for the ordinary case, absolute once the path leaves the repo —
 * a `../../../../..` chain back out to a scratch directory is worse than the
 * absolute path it was trying to shorten.
 */
function display(target) {
  const rel = path.relative(ROOT, target);
  return rel && !rel.startsWith('..') ? rel : target;
}

/**
 * One exit path for every filesystem failure, so an unreadable artifact and an
 * `--out` pointing at a directory both surface as the `index-plans: …` + exit 1
 * this repo's other scripts use. A raw Node stack trace names the syscall instead
 * of the artifact and reads as a crash rather than as a fact about the tree.
 */
function die(message) {
  console.error(`${LABEL}: ${message}`);
  process.exit(1);
}

function usage(message) {
  if (message) console.error(`${LABEL}: ${message}`);
  console.error('usage: index-plans.cjs [--out <path>] [--check] [--root <plans dir>]');
  process.exit(2);
}

function parseArgs(args) {
  const opts = { out: null, root: null, check: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--check') { opts.check = true; continue; }
    if (arg === '--out' || arg === '--root') {
      const value = args[++i];
      if (value === undefined || value.startsWith('--')) usage(`${arg} needs a path`);
      opts[arg === '--out' ? 'out' : 'root'] = value;
      continue;
    }
    usage(`unknown argument: ${arg}`);
  }
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv.slice(2));
  const root = path.resolve(ROOT, opts.root || path.join(ROOT, 'plans'));
  // The index belongs at the top of the tree it indexes, so a caller who moves the
  // root without naming an output gets the index beside that root, not beside a
  // `plans/` that may not even be the tree they asked about.
  const outPath = path.resolve(ROOT, opts.out || path.join(root, 'index.html'));

  let stat;
  try {
    stat = fs.statSync(root);
  } catch {
    die(`plans root not found: ${display(root)}`);
  }
  if (!stat.isDirectory()) die(`plans root is not a directory: ${display(root)}`);

  const html = buildIndex(root, outPath);
  const rel = display(outPath);

  if (opts.check) {
    let current = null;
    try {
      current = fs.readFileSync(outPath, 'utf8');
    } catch {
      console.error(`${LABEL}: ${rel} does not exist; regenerate it with \`node ${path.basename(__filename)}\`.`);
      process.exit(1);
    }
    if (current !== html) {
      console.error(`${LABEL}: ${rel} is out of date; regenerate it with \`node ${path.basename(__filename)}\`.`);
      process.exit(1);
    }
    console.log(`${LABEL}: OK`);
    return;
  }

  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
  } catch (e) {
    // EISDIR when `--out` names an existing directory, EACCES on a read-only tree,
    // ENOTDIR when a path component is a file. All of them are the caller's path
    // being wrong, and all of them deserve the path back rather than a stack.
    die(`cannot write ${rel} (${(e && e.code) || 'write failed'})`);
  }
  console.log(`${LABEL}: wrote ${rel}`);
}

module.exports = { collect, resolveFamilies, buildIndex, parseFrontmatter, refsOf, esc, stampOf };

if (require.main === module) {
  main(process.argv);
}
