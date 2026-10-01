'use strict';
// The planted-offender proof (§7.5). A guard is proven only when every plant
// flips it the way it expects; a guard that is red on every tree proves
// nothing. Shape plants live in memory. Command plants must be written to disk,
// so every exit path — a normal one, SIGTERM, SIGKILL then the next run — has to
// leave the planted file byte for byte as it was.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prove, recover } = require('../src/instruments/plants.cjs');
const { evaluate, reader } = require('../src/instruments/shapes.cjs');

const PLANTS = path.join(__dirname, '..', 'src', 'instruments', 'plants.cjs');
const SHAPES = path.join(__dirname, '..', 'src', 'instruments', 'shapes.cjs');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function tmp(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-plants-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 }));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

const journal = (root) => path.join(root, '.cleancode', 'plant-journal.json');

const INPUT = [
  "import { Field, InputType, Int } from '@nestjs/graphql';",
  "import { IsInt, IsOptional, IsString } from 'class-validator';",
  '',
  '@InputType()',
  'export class CreateWidgetInput {',
  '  @Field()',
  '  @IsString()',
  '  name: string;',
  '',
  '  @Field(() => Int, { nullable: true })',
  '  @IsOptional()',
  '  @IsInt()',
  '  size?: number;',
  '}',
  '',
].join('\n');

const SHAPE = {
  type: 'decorated-fields', files: ['src/**/*.ts'], classes: ['InputType'], field: 'Field',
  validators_from: ['class-validator'], checks: ['undecorated', 'nullable-without-optional'], optional: ['IsOptional'],
};

/** A shape guard evaluated the way the sweep does: every file, read through the plant overlay. */
const shapeRun = (root, shape, files) => async (overlay) => {
  const { hits } = evaluate(shape, files, reader(root, overlay));
  return { id: 'g', status: hits.length ? 'red' : 'green', hits };
};

test('shape plants are proven in memory: unplanted green, both planted kinds red, nothing written', async (t) => {
  const root = tmp(t, { 'src/widgets/create-widget.input.ts': INPUT });
  const file = path.join(root, 'src/widgets/create-widget.input.ts');
  const guard = {
    id: 'widget-fields', kind: 'shape', shape: SHAPE,
    plants: [
      { name: 'undecorated field', file: 'src/widgets/create-widget.input.ts', find: '  name: string;\n',
        replace: '  name: string;\n\n  @Field()\n  probe: string;\n', expect: 'red' },
      { name: 'optional made required', file: 'src/widgets/create-widget.input.ts', find: '  @IsOptional()\n',
        replace: '', expect: 'red' },
    ],
  };
  fs.chmodSync(file, 0o444);
  fs.chmodSync(path.dirname(file), 0o555);
  let result;
  try {
    result = await prove(guard, shapeRun(root, SHAPE, ['src/widgets/create-widget.input.ts']), root, reader(root));
  } finally {
    fs.chmodSync(path.dirname(file), 0o755);
  }
  const { entry, proof } = result;
  assert.equal(entry.status, 'green');
  assert.deepEqual(proof, {
    guard: 'widget-fields', unplanted: 'green',
    plants: [
      { name: 'optional made required', expect: 'red', got: 'red', ok: true },
      { name: 'undecorated field', expect: 'red', got: 'red', ok: true },
    ],
    proven: true,
  });
  assert.equal(fs.readFileSync(file, 'utf8'), INPUT);
  assert.equal(fs.existsSync(path.join(root, '.cleancode')), false, 'an in-memory proof writes nothing, not even a journal');
});

test('a guard that is red on every tree is not proven by plants that expect red', async (t) => {
  const root = tmp(t, { 'src/a.ts': 'export const a = 1;\n' });
  const always = { type: 'regex', files: ['src/**'], pattern: '.', flags: '' };
  const guard = { id: 'always-red', kind: 'shape', shape: always,
    plants: [{ name: 'anything', file: 'src/a.ts', find: '= 1', replace: '= 2', expect: 'red' }] };
  const { proof } = await prove(guard, shapeRun(root, always, ['src/a.ts']), root, reader(root));
  assert.deepEqual(proof.plants, [{ name: 'anything', expect: 'red', got: 'red', ok: false }]);
  assert.equal(proof.unplanted, 'red');
  assert.equal(proof.proven, false);
});

test('no plants, or an unplanted run that measured nothing, is never proven', async (t) => {
  const root = tmp(t, { 'src/a.ts': 'export const a = 1;\n' });
  const none = await prove({ id: 'g', kind: 'shape', plants: [] }, async () => ({ status: 'green' }), root, reader(root));
  assert.deepEqual(none.proof, { guard: 'g', unplanted: 'green', plants: [], proven: false });
  const guard = { id: 'g', kind: 'shape', plants: [{ name: 'p', file: 'src/a.ts', find: '1', replace: '$&2', expect: 'red' }] };
  const overlays = [];
  const blind = await prove(guard, async (overlay) => {
    overlays.push(overlay && Object.fromEntries(overlay));
    return { status: overlay ? 'red' : 'not-run' };
  }, root, reader(root));
  assert.deepEqual(overlays, [null, { 'src/a.ts': 'export const a = $&2;\n' }], 'the replacement is spliced in literally');
  assert.equal(blind.proof.plants[0].ok, true);
  assert.equal(blind.proof.proven, false);
});

test('a red command guard is proven by a green fix planted on disk, and the file comes back byte for byte', async (t) => {
  const original = Buffer.concat([Buffer.from('rule = BUG\r\n'), Buffer.from([0xff, 0xfe]), Buffer.from('\ntail\n')]);
  const root = tmp(t, { 'src/rule.txt': original });
  const file = path.join(root, 'src/rule.txt');
  const seen = [];
  const run = async (overlay, tag) => {
    assert.equal(overlay, null, 'a command guard never gets an overlay');
    const onDisk = fs.readFileSync(file, 'latin1');
    if (tag) {
      const [entry] = JSON.parse(fs.readFileSync(journal(root), 'utf8'));
      assert.deepEqual(Object.keys(entry), ['file', 'sha256_original', 'original_base64', 'sha256_planted']);
      assert.equal(entry.file, 'src/rule.txt');
      assert.equal(entry.sha256_original, sha(original));
      assert.equal(entry.sha256_planted, sha(fs.readFileSync(file)));
      assert.deepEqual(Buffer.from(entry.original_base64, 'base64'), original);
    }
    seen.push(`${tag}:${onDisk.includes('BUG') ? 'bug' : 'fix'}`);
    return { status: onDisk.includes('BUG') ? 'red' : 'green' };
  };
  const guard = { id: 'rule-check', kind: 'command',
    plants: [{ name: 'the fix', file: 'src/rule.txt', find: 'BUG', replace: 'FIX', expect: 'green' }] };
  const { entry, proof } = await prove(guard, run, root, reader(root));
  assert.deepEqual(seen, ['null:bug', 'plant1:fix'], 'the plant was on disk while the guard ran, and only then');
  assert.equal(entry.status, 'red');
  assert.deepEqual(proof, { guard: 'rule-check', unplanted: 'red',
    plants: [{ name: 'the fix', expect: 'green', got: 'green', ok: true }], proven: true });
  assert.deepEqual(fs.readFileSync(file), original);
  assert.equal(fs.existsSync(journal(root)), false);
});

test('a plant whose find occurs twice, or never, is refused before anything runs', async (t) => {
  const root = tmp(t, { 'src/a.ts': 'x = 1;\nx = 1;\n' });
  let ran = false;
  const run = async () => { ran = true; return { status: 'green' }; };
  const twice = { id: 'g', kind: 'command', plants: [{ name: 'dup', file: 'src/a.ts', find: 'x = 1;', replace: 'x = 2;', expect: 'red' }] };
  await assert.rejects(prove(twice, run, root, reader(root)), (e) => e.exitCode === 3 && /dup/.test(e.message) && /2 times/.test(e.message));
  const never = { id: 'g', kind: 'command', plants: [{ name: 'gone', file: 'src/b.ts', find: 'x', replace: 'y', expect: 'red' }] };
  await assert.rejects(prove(never, run, root, reader(root)), (e) => e.exitCode === 3 && /gone/.test(e.message));
  assert.equal(ran, false);
  assert.equal(fs.readFileSync(path.join(root, 'src/a.ts'), 'utf8'), 'x = 1;\nx = 1;\n');
});

/**
 * A process that plants on disk and then hangs inside the guard run, so the
 * test can kill it mid-proof. With `cooperate`, another SIGTERM listener (like
 * the bounded runner's forwarder) owns the re-raise. With `alter`, the guard's
 * own command rewrites the planted file (a formatter, a code generator).
 */
function harness(t, root, { cooperate = false, alter = false } = {}) {
  const script = path.join(root, 'harness.cjs');
  fs.writeFileSync(script, `
    const fs = require('node:fs');
    const { prove } = require(${JSON.stringify(PLANTS)});
    const { reader } = require(${JSON.stringify(SHAPES)});
    const root = ${JSON.stringify(root)};
    if (${cooperate}) process.on('SIGTERM', () => setTimeout(() => process.exit(42), 100));
    const guard = { id: 'g', kind: 'command', plants: [{ name: 'p', file: 'src/rule.txt', find: 'BUG', replace: 'FIX', expect: 'green' }] };
    prove(guard, async (overlay, tag) => {
      if (!tag) return { status: 'red' };
      if (${alter}) fs.appendFileSync(root + '/src/rule.txt', 'rewritten by the guard\\n');
      fs.writeFileSync(root + '/planted.flag', '');
      await new Promise((r) => setTimeout(r, 60000));
      return { status: 'green' };
    }, root, reader(root));
  `);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = cp.spawn(process.execPath, [script], { env, stdio: 'ignore' });
  t.after(() => child.kill('SIGKILL'));
  const exited = new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));
  return { child, exited };
}

async function untilPlanted(root, planted = 'rule = FIX\n') {
  for (let i = 0; i < 200 && !fs.existsSync(path.join(root, 'planted.flag')); i++) await new Promise((r) => setTimeout(r, 25));
  assert.ok(fs.existsSync(path.join(root, 'planted.flag')), 'the harness never reached the planted run');
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), planted);
  assert.ok(fs.existsSync(journal(root)), 'the journal is written before the edit');
}

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  test(`${signal} mid-proof restores the planted file, drops the journal and re-raises`, async (t) => {
    const root = tmp(t, { 'src/rule.txt': 'rule = BUG\n' });
    const { child, exited } = harness(t, root);
    await untilPlanted(root);
    child.kill(signal);
    assert.deepEqual(await exited, { code: null, signal });
    assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), 'rule = BUG\n');
    assert.equal(fs.existsSync(journal(root)), false);
  });
}

test('SIGTERM with another listener present restores the file and leaves the re-raise to that listener', async (t) => {
  const root = tmp(t, { 'src/rule.txt': 'rule = BUG\n' });
  const { child, exited } = harness(t, root, { cooperate: true });
  await untilPlanted(root);
  child.kill('SIGTERM');
  assert.deepEqual(await exited, { code: 42, signal: null });
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), 'rule = BUG\n');
});

// B4: bytes that are neither the plant nor the original are an edit made during the proof. They are never
// overwritten, and the journal, the only copy of the original, is kept as an orphan rather than deleted.
const orphans = (root) => fs.readdirSync(path.join(root, '.cleancode')).filter((f) => /^plant-journal\..+\.orphan\.json$/.test(f));
function assertOrphaned(root, text) {
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), text, 'the edit is left alone');
  assert.equal(fs.existsSync(journal(root)), false);
  const kept = orphans(root);
  assert.equal(kept.length, 1);
  const [entry] = JSON.parse(fs.readFileSync(path.join(root, '.cleancode', kept[0]), 'utf8'));
  assert.equal(Buffer.from(entry.original_base64, 'base64').toString(), 'rule = BUG\n', 'the orphan still holds the original');
  return path.join('.cleancode', kept[0]);
}

test('a signal never overwrites a planted file the guard rewrote: the file stays, and the journal is kept as an orphan', async (t) => {
  const root = tmp(t, { 'src/rule.txt': 'rule = BUG\n' });
  const { child, exited } = harness(t, root, { alter: true });
  await untilPlanted(root, 'rule = FIX\nrewritten by the guard\n');
  child.kill('SIGTERM');
  assert.deepEqual(await exited, { code: null, signal: 'SIGTERM' });
  assertOrphaned(root, 'rule = FIX\nrewritten by the guard\n');
});

test('a proof whose guard rewrote the planted file keeps that file and an orphan journal, and warns with its path', async (t) => {
  const root = tmp(t, { 'src/rule.txt': 'rule = BUG\n' });
  const guard = { id: 'g', kind: 'command', plants: [{ name: 'p', file: 'src/rule.txt', find: 'BUG', replace: 'FIX', expect: 'green' }] };
  const { proof, warnings } = await prove(guard, async (overlay, tag) => {
    if (tag) fs.appendFileSync(path.join(root, 'src/rule.txt'), 'formatted\n');
    return { status: tag ? 'green' : 'red' };
  }, root, reader(root));
  assert.equal(proof.proven, true);
  const kept = assertOrphaned(root, 'rule = FIX\nformatted\n');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^plant journal: src\/rule\.txt matches neither its original nor its planted bytes; left alone/);
  assert.ok(warnings[0].endsWith(kept), warnings[0]);
  assert.equal(fs.existsSync(path.join(root, '.cleancode', 'plant.lock')), false, 'the lock goes with the proof');
});

test('while a proof is alive its journal is left alone, and a second proof refuses with exit 3', async (t) => {
  const root = tmp(t, { 'src/rule.txt': 'rule = BUG\n' });
  const { child } = harness(t, root);
  await untilPlanted(root);
  assert.equal(fs.readFileSync(path.join(root, '.cleancode', 'plant.lock'), 'utf8'), String(child.pid));
  const warnings = recover(root);
  assert.deepEqual(warnings, [`plant journal left in place: the proof that wrote it is still running (pid ${child.pid})`]);
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), 'rule = FIX\n', 'the live plant is not undone');
  assert.ok(fs.existsSync(journal(root)));
  const guard = { id: 'g', kind: 'shape', plants: [{ name: 'p', file: 'src/rule.txt', find: 'FIX', replace: 'BUG', expect: 'red' }] };
  await assert.rejects(prove(guard, async () => ({ status: 'green' }), root, reader(root)),
    (e) => e.exitCode === 3 && e.message === `a planted-offender proof is already running (pid ${child.pid})`);
  child.kill('SIGKILL');
  await new Promise((r) => child.on('exit', r));
  assert.match(recover(root)[0], /^restored src\/rule\.txt/, 'a dead holder\'s lock is stale');
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), 'rule = BUG\n');
});

test('a journal left by a killed run is restored by the next recovery, with a warning', async (t) => {
  const root = tmp(t, { 'src/rule.txt': 'rule = BUG\n' });
  const { child, exited } = harness(t, root);
  await untilPlanted(root);
  child.kill('SIGKILL');
  assert.equal((await exited).signal, 'SIGKILL');
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), 'rule = FIX\n', 'SIGKILL leaves the plant behind');
  const warnings = recover(root);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /src\/rule\.txt/);
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), 'rule = BUG\n');
  assert.equal(fs.existsSync(journal(root)), false);
  assert.deepEqual(recover(root), [], 'with no journal there is nothing to do');
});

test('recovery leaves a file that matches neither hash alone, names it, and keeps the journal as an orphan', async (t) => {
  const root = tmp(t, { 'src/rule.txt': 'rule = EDITED\n', 'src/other.txt': 'kept\n' });
  const entry = (file, original, planted) => ({ file, sha256_original: sha(original), original_base64: Buffer.from(original).toString('base64'), sha256_planted: sha(planted) });
  fs.mkdirSync(path.dirname(journal(root)), { recursive: true });
  fs.writeFileSync(journal(root), JSON.stringify([
    entry('src/rule.txt', 'rule = BUG\n', 'rule = FIX\n'),
    entry('src/other.txt', 'kept\n', 'planted\n'),
  ]));
  const warnings = recover(root);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /src\/rule\.txt/);
  assert.equal(fs.readFileSync(path.join(root, 'src/rule.txt'), 'utf8'), 'rule = EDITED\n');
  assert.equal(fs.readFileSync(path.join(root, 'src/other.txt'), 'utf8'), 'kept\n', 'a file already back to its original needs nothing');
  assert.equal(fs.existsSync(journal(root)), false);
  const kept = orphans(root);
  assert.equal(kept.length, 1, 'the journal is kept as an orphan: it holds the only copy of the original');
  assert.ok(warnings[0].endsWith(path.join('.cleancode', kept[0])), warnings[0]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.cleancode', kept[0]), 'utf8'))[0].original_base64,
    Buffer.from('rule = BUG\n').toString('base64'));
  assert.deepEqual(recover(root), [], 'an orphan is never restored over the edit');
});
