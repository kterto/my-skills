'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseLiveBlock, extractLiveBlock, parseSubset } = require('../src/instruments/liveblock.cjs');

const HEAD = 'version: 1\nisolation: shared-dev\n';
const ok = (text) => {
  const { block, error } = parseLiveBlock(text);
  assert.equal(error, null, `unexpected error: ${error}`);
  return block;
};
const err = (text) => {
  const { block, error } = parseLiveBlock(text);
  assert.equal(block, null);
  assert.equal(typeof error, 'string');
  return error;
};

test('the reference\'s consent example parses, as the two-level mapping it shows', () => {
  const ref = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'references', 'instruments.md'), 'utf8');
  const example = /\n```\n(consent:\n[\s\S]*?)```\n/.exec(ref);
  assert.ok(example, 'references/instruments.md shows no consent example');
  const block = ok(`${HEAD}${example[1]}`);
  assert.deepEqual(Object.keys(block.consent.prisma_reset).sort(), ['container', 'url']);
});

// ---- the subset grammar: value forms -------------------------------------------------

test('a full neutral block parses into the declared shape', () => {
  const block = ok([
    'version: 1',
    'isolation: ephemeral   # a throwaway stack',
    'db_build: migrate-deploy',
    'db: { build: "npx prisma migrate deploy", bound_minutes: 5 }',
    'services:',
    '  api: { up: "docker compose up -d api", ready: "http://127.0.0.1:3000/health", down: "docker compose stop api", bound_minutes: 2.5 }',
    "  worker: { up: 'sh -c ''node worker.js >worker.log 2>&1 &''', ready: \"cmd:test -f worker.pid\" }",
    'allowed_repairs: ["docker compose up -d db", "make seed"]',
    'surfaces:',
    '  web: { kind: cypress, run: "npx cypress run --spec $SELECT", entry: / }',
    'flows:',
    '  checkout: { surface: web, paths: ["apps/web/src/orders/**", "apps/api/src/orders/**"] }',
    'readback:',
    '  pg: { run: "docker exec db psql -At -c", read_only: true }',
    'consent:',
    '  prisma_reset: { url: "postgresql://u:p@127.0.0.1:55432/app", container: ccg-app-db }',
  ].join('\n'));
  assert.deepEqual(block, {
    version: 1,
    isolation: 'ephemeral',
    db_build: 'migrate-deploy',
    db: { build: 'npx prisma migrate deploy', bound_minutes: 5 },
    services: {
      api: { up: 'docker compose up -d api', ready: 'http://127.0.0.1:3000/health', down: 'docker compose stop api', bound_minutes: 2.5 },
      worker: { up: "sh -c 'node worker.js >worker.log 2>&1 &'", ready: 'cmd:test -f worker.pid' },
    },
    allowed_repairs: ['docker compose up -d db', 'make seed'],
    surfaces: { web: { kind: 'cypress', run: 'npx cypress run --spec $SELECT', entry: '/' } },
    flows: { checkout: { surface: 'web', paths: ['apps/web/src/orders/**', 'apps/api/src/orders/**'] } },
    readback: { pg: { run: 'docker exec db psql -At -c', read_only: true } },
    consent: { prisma_reset: { url: 'postgresql://u:p@127.0.0.1:55432/app', container: 'ccg-app-db' } },
  });
});

test('a bare scalar reads as a number, true, false or null only when it is one', () => {
  const v = parseSubset('a: 12\nb: 0.02\nc: -3\nd: true\ne: false\nf: null\ng: 1.2.3\nh: False\ni: nulls\nj: "007"\n'
    + 'k: [1, x, true, null]\nl: { m: 2, n: no }\no: http://127.0.0.1:3000/x@y+z');
  assert.deepEqual(v, {
    a: 12, b: 0.02, c: -3, d: true, e: false, f: null, g: '1.2.3', h: 'False', i: 'nulls', j: '007',
    k: [1, 'x', true, null], l: { m: 2, n: 'no' }, o: 'http://127.0.0.1:3000/x@y+z',
  });
});

test('quoted strings keep their text: escapes in double quotes, doubled quotes in single quotes, # inside quotes', () => {
  const v = parseSubset(`a: ["a \\"b\\" \\\\c", 'it''s # not a comment', "x#y", '', ""]\nb: 'single'  # c\nc: "k: v, [x]"`);
  assert.deepEqual(v, { a: ['a "b" \\c', "it's # not a comment", 'x#y', '', ''], b: 'single', c: 'k: v, [x]' });
});

test('parseSubset throws an error naming the line; parseLiveBlock returns the same text', () => {
  assert.throws(() => parseSubset('a: 1\nb: [x'), /^Error: line 2: /);
  assert.match(parseLiveBlock('a: 1\nb: [x').error, /^line 2: /);
});

test('flow collections: empty ones, spacing, and sequences inside flow mappings', () => {
  const b = ok(`${HEAD}allowed_repairs: []\nflows:\n  f: {surface: web,paths: [ "a/**" ,b.ts ]}\nsurfaces:\n  web: { kind: k, run: r }`);
  assert.deepEqual(b.allowed_repairs, []);
  assert.deepEqual(b.flows.f, { surface: 'web', paths: ['a/**', 'b.ts'] });
});

test('comments, blank lines and CRLF are ignored; a key with only a comment opens a mapping', () => {
  const b = ok('# leading comment\r\n\r\nversion: 1 # trailing\r\n   \r\nisolation: shared-dev\r\n'
    + 'readback: # the stores\r\n  # an indented comment line\r\n\r\n  pg: { run: psql, read_only: false }\r\n');
  assert.deepEqual(b, { version: 1, isolation: 'shared-dev', readback: { pg: { run: 'psql', read_only: false } } });
});

test('the nested mapping closes at the next column-0 key, and an empty one is an empty mapping', () => {
  const b = ok(`version: 1\nservices:\nisolation: shared-dev\nreadback:\n  pg: { run: psql, read_only: true }`);
  assert.deepEqual(b.services, {});
  assert.deepEqual(Object.keys(b), ['version', 'services', 'isolation', 'readback']);
});

// ---- the subset grammar: every error names its line ----------------------------------

const GRAMMAR_ERRORS = [
  ['a tab', `${HEAD}services:\n\tapi: { up: u, ready: "cmd:r" }`, 4, /tab/],
  ['a tab inside quotes', `${HEAD}allowed_repairs: ["a\tb"]`, 3, /tab/],
  ['a block sequence', `${HEAD}allowed_repairs:\n  - make seed`, 4, /key: value/],
  ['a document marker', `---\n${HEAD}`, 1, /key: value/],
  ['no space after the colon', `version:1`, 1, /key: value/],
  ['one-space indent', `${HEAD}services:\n api: { up: u, ready: "cmd:r" }`, 4, /key: value/],
  ['four-space indent', `${HEAD}services:\n    api: { up: u, ready: "cmd:r" }`, 4, /key: value/],
  ['an indented entry outside a mapping', `${HEAD}  db: { build: b }`, 3, /outside a mapping/],
  ['a mapping two levels deep', `${HEAD}services:\n  api:\n    up: u`, 4, /one level/],
  ['a duplicate top-level key', `${HEAD}version: 1`, 3, /duplicate key "version"/],
  ['a duplicate nested key', `${HEAD}readback:\n  pg: { run: a, read_only: true }\n  pg: { run: b, read_only: true }`, 5, /duplicate key "pg"/],
  ['a duplicate flow-mapping key', `${HEAD}db: { build: a, build: b }`, 3, /duplicate key "build"/],
  ['a reserved key', `${HEAD}readback:\n  __proto__: { run: a, read_only: true }`, 4, /reserved key/],
  ['an unterminated double-quoted string', `${HEAD}db: { build: "abc }`, 3, /unterminated string/],
  ['an unterminated single-quoted string', `${HEAD}allowed_repairs: ['abc]`, 3, /unterminated string/],
  ['an unsupported escape', `${HEAD}allowed_repairs: ["a\\nb"]`, 3, /unsupported escape/],
  ['two bare words', `${HEAD}db_build: migrate deploy`, 3, /after the value/],
  ['text after a closing quote', `${HEAD}db_build: "migrate"deploy`, 3, /after the value/],
  ['an unterminated flow sequence', `${HEAD}allowed_repairs: [a, b`, 3, /expected "," or "\]"/],
  ['a missing comma', `${HEAD}allowed_repairs: [a b]`, 3, /expected "," or "\]"/],
  ['a trailing comma', `${HEAD}allowed_repairs: [a, ]`, 3, /unexpected "\]"/],
  ['a line that ends after a comma', `${HEAD}allowed_repairs: [a,`, 3, /unexpected end of line/],
  ['a line that ends after a flow key', `${HEAD}db: { build: `, 3, /unexpected end of line/],
  ['a flow entry with no space after the colon', `${HEAD}db: {build:b}`, 3, /key: value/],
  ['a flow mapping inside a flow mapping', `${HEAD}consent: { prisma_reset: { url: u, container: c } }`, 3, /unexpected "\{"/],
  ['a flow sequence inside a flow sequence', `${HEAD}allowed_repairs: [[a]]`, 3, /unexpected "\["/],
  ['a character outside the bare set', `${HEAD}db: { build: make*all }`, 3, /expected "," or "\}"/],
  ['a bare glob', `${HEAD}allowed_repairs: [**/x]`, 3, /unexpected "\*"/],
  ['an empty flow value', `${HEAD}db: { build: }`, 3, /unexpected "\}"/],
];

for (const [name, text, line, why] of GRAMMAR_ERRORS) {
  test(`grammar error names its line: ${name}`, () => {
    const e = err(text);
    assert.match(e, new RegExp(`^line ${line}: `));
    assert.match(e, why);
  });
}

// ---- the schema: every error names its JSON path --------------------------------------

const SERVICE = '  api: { up: u, ready: "http://127.0.0.1:1/" }';
const SCHEMA_ERRORS = [
  ['version missing', 'isolation: shared-dev', /^version: required/],
  ['version not 1', 'version: 2\nisolation: shared-dev', /^version: expected 1/],
  ['isolation missing', 'version: 1', /^isolation: required/],
  ['isolation unknown', 'version: 1\nisolation: shared', /^isolation: expected shared-dev \| ephemeral/],
  ['an unknown top-level key', `${HEAD}servces:\n${SERVICE}`, /^servces: unknown key/],
  ['db_build unknown', `${HEAD}db_build: push`, /^db_build: expected migrate-deploy \| schema-push \| none/],
  ['db without build', `${HEAD}db: { bound_minutes: 1 }`, /^db\.build: required/],
  ['services not a mapping', `${HEAD}services: api`, /^services: expected a mapping/],
  ['a service not a mapping', `${HEAD}services:\n  api: up`, /^services\.api: expected a mapping/],
  ['an unknown service key', `${HEAD}services:\n  api: { up: u, ready: "cmd:r", upp: x }`, /^services\.api\.upp: unknown key/],
  ['a service without up', `${HEAD}services:\n  api: { ready: "cmd:r" }`, /^services\.api\.up: required/],
  ['an empty up command', `${HEAD}services:\n  api: { up: "  ", ready: "cmd:r" }`, /^services\.api\.up: expected a non-empty command/],
  ['a ready that is neither a URL nor cmd:', `${HEAD}services:\n  api: { up: u, ready: "127.0.0.1:3000" }`, /^services\.api\.ready: expected an http\(s\) URL or "cmd:<command>"/],
  ['an empty cmd: probe', `${HEAD}services:\n  api: { up: u, ready: "cmd: " }`, /^services\.api\.ready: expected/],
  ['a zero bound', `${HEAD}services:\n  api: { up: u, ready: "cmd:r", bound_minutes: 0 }`, /^services\.api\.bound_minutes: expected a number > 0/],
  ['a string bound', `${HEAD}db: { build: b, bound_minutes: "5" }`, /^db\.bound_minutes: expected a number > 0/],
  ['a bound past a week', `${HEAD}db: { build: b, bound_minutes: 10081 }`, /^db\.bound_minutes: expected a number > 0, at most 10080 \(a week\)/],
  ['a service bound past a week', `${HEAD}services:\n  api: { up: u, ready: "cmd:r", bound_minutes: 40000 }`, /^services\.api\.bound_minutes: expected a number > 0, at most 10080/],
  ['allowed_repairs not a sequence', `${HEAD}allowed_repairs: "make up"`, /^allowed_repairs: expected a sequence of non-empty strings/],
  ['allowed_repairs with a number', `${HEAD}allowed_repairs: [make, 3]`, /^allowed_repairs: expected a sequence of non-empty strings/],
  ['a surface without run', `${HEAD}surfaces:\n  web: { kind: cypress }`, /^surfaces\.web\.run: required/],
  ['a flow whose paths are not strings', `${HEAD}flows:\n  f: { surface: web, paths: [1] }`, /^flows\.f\.paths: expected a sequence/],
  ['a store without read_only', `${HEAD}readback:\n  pg: { run: psql }`, /^readback\.pg\.read_only: required/],
  ['a store whose read_only is a string', `${HEAD}readback:\n  pg: { run: psql, read_only: "true" }`, /^readback\.pg\.read_only: expected true or false/],
  ['consent without prisma_reset', `${HEAD}consent:\n  other: { url: u, container: c }`, /^consent\.other: unknown key/],
  ['a flow-mapping consent', `${HEAD}consent: { url: u }`, /^consent\.url: unknown key/],
  ['prisma_reset without a container', `${HEAD}consent:\n  prisma_reset: { url: "postgresql://127.0.0.1:1/x" }`, /^consent\.prisma_reset\.container: required/],
];

for (const [name, text, why] of SCHEMA_ERRORS) {
  test(`schema error names its path: ${name}`, () => assert.match(err(text), why));
}

test('parseLiveBlock never throws, whatever it is handed', () => {
  for (const input of [undefined, null, 42, {}, '', '\u0000', 'version: 1\nisolation: shared-dev\n'.repeat(2)]) {
    assert.doesNotThrow(() => parseLiveBlock(input));
    assert.equal(typeof parseLiveBlock(input).error, 'string');
  }
});

// ---- extractLiveBlock -------------------------------------------------------------------

const doc = (...sections) => ['# Project context', '', ...sections].join('\n');
const BODY = 'version: 1\nisolation: shared-dev';

test('extractLiveBlock returns the body of the first live fence under ## Test tooling', () => {
  const text = doc('## Commands', '', 'make test', '', '## Test tooling', '', 'Jest for units.', '',
    '```live', BODY, '```', '', '```live', 'version: 2', '```', '', '## Layout', '');
  assert.equal(extractLiveBlock(text), BODY);
});

test('extractLiveBlock ignores a live fence outside the section, before or after it', () => {
  assert.equal(extractLiveBlock(doc('## Commands', '```live', BODY, '```', '## Test tooling', 'none', '## Layout', '```live', BODY, '```')), null);
  assert.equal(extractLiveBlock(doc('## Commands', '```live', BODY, '```')), null);
  assert.equal(extractLiveBlock(doc('## Test tooling', '```yaml', BODY, '```')), null);
});

test('a ## line inside another fence does not end the section, and a ### heading does not either', () => {
  const text = doc('## Test tooling', '```sh', '## run the suite', 'make test', '```', '### Live stack', '',
    '```live', BODY, '```', '## Layout');
  assert.equal(extractLiveBlock(text), BODY);
});

test('a ```live line inside another fence is content, not a fence', () => {
  const text = doc('## Test tooling', '````md', '```live', 'version: 9', '```', '````', '```live', BODY, '```');
  assert.equal(extractLiveBlock(text), BODY);
});

test('an unclosed live fence runs to the end of the document, and CRLF text works', () => {
  assert.equal(extractLiveBlock(doc('## Test tooling', '```live', BODY)), BODY);
  assert.equal(extractLiveBlock(doc('## Test tooling', '```live', BODY, '```').replace(/\n/g, '\r\n')), BODY);
  assert.equal(extractLiveBlock(doc('## Test tooling', '```live', '```')), '');
});

test('extractLiveBlock returns null without the section, and for non-text', () => {
  assert.equal(extractLiveBlock(doc('## Test toolings', '```live', BODY, '```')), null);
  assert.equal(extractLiveBlock(''), null);
  assert.equal(extractLiveBlock(null), null);
});
