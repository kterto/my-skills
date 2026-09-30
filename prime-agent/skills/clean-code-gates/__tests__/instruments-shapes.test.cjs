'use strict';
// The two sweep shapes (§7.2), evaluated over in-memory fixture trees. The
// `decorated-fields` cases pin the class of defect a presence-only guard
// misses: a field with no validator under a pipe that forbids unknown
// properties, and a nullable field whose validators still reject an omitted
// value. Every "is not a hit" case is paired with the flip that makes it one,
// so no case can pass by finding nothing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../src/instruments/shapes.cjs');

const SHAPE = {
  type: 'decorated-fields',
  files: ['src/**/*.ts'],
  exclude: ['**/*.spec.ts'],
  classes: ['InputType', 'ArgsType'],
  field: 'Field',
  validators_from: ['class-validator'],
  validator_markers: ['registerDecorator(', 'ValidateBy('],
  inherit: ['PartialType', 'PickType', 'OmitType', 'IntersectionType'],
  checks: ['undecorated', 'nullable-without-optional'],
  optional: ['IsOptional', 'ValidateIf'],
};

const TREE = {
  'src/common/is-sku.decorator.ts': [
    "import { registerDecorator, ValidationOptions } from 'class-validator';",
    '',
    'export function IsSku(options?: ValidationOptions) {',
    '  return (target: object, propertyName: string) =>',
    "    registerDecorator({ name: 'isSku', target: target.constructor, propertyName, options, validator: { validate: () => true } });",
    '}',
  ],
  'src/common/is-label.ts': [
    'export function IsLabel() {',
    '  return () => undefined;',
    '}',
  ],
  'src/widgets/create-widget.input.ts': [
    "import { Field, InputType, Int } from '@nestjs/graphql';",
    "import { IsInt, IsOptional, IsString, Min } from 'class-validator';",
    "import { IsSku } from '../common/is-sku.decorator';",
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
    '  @Min(1)',
    '  size?: number;',
    '',
    '  @Field()',
    '  @IsSku()',
    '  sku: string;',
    '}',
  ],
  'src/widgets/update-widget.input.ts': [
    "import { Field, InputType, PartialType } from '@nestjs/graphql';",
    "import { CreateWidgetInput } from './create-widget.input';",
    '',
    '@InputType()',
    'export class UpdateWidgetInput extends PartialType(CreateWidgetInput) {',
    '  @Field({ nullable: true })',
    '  name?: string;',
    '',
    '  @Field({ nullable: true })',
    '  color?: string;',
    '}',
  ],
  'src/orders/create-order.input.ts': [
    "import { Field, InputType, Int } from '@nestjs/graphql';",
    "import { IsInt } from 'class-validator';",
    "import { IsLabel } from '../common/is-label';",
    '',
    '@InputType()',
    'export class CreateOrderInput {',
    '  @Field()',
    '  note: string;',
    '',
    '  @Field(() => Int, { nullable: true })',
    '  @IsInt()',
    '  quantity?: number;',
    '',
    '  @Field()',
    '  @IsLabel()',
    '  label: string;',
    '}',
  ],
  'src/orders/order.view.ts': [
    "import { Field, ObjectType } from '@nestjs/graphql';",
    '',
    '@ObjectType()',
    'export class OrderView {',
    '  @Field()',
    '  note: string;',
    '}',
  ],
};

function tree(extra = {}) {
  const files = { ...TREE, ...extra };
  const text = Object.fromEntries(Object.entries(files).map(([f, lines]) => [f, lines.join('\n') + '\n']));
  return { files: Object.keys(text).sort(), read: (f) => (Object.hasOwn(text, f) ? text[f] : null), text };
}

/** The 1-based line of the first line of `file` that contains `needle`. */
function lineOf(t, file, needle) {
  const i = t.text[file].split('\n').findIndex((l) => l.includes(needle));
  assert.ok(i >= 0, `${needle} not in ${file}`);
  return i + 1;
}

const labels = (hits) => hits.map((h) => `${h.text} ${h.check}`);

test('an undecorated field is a hit, at the line of its property, and an output type is not scanned', () => {
  const t = tree();
  const { hits, visited } = evaluate(SHAPE, t.files, t.read);
  const file = 'src/orders/create-order.input.ts';
  assert.deepEqual(hits.find((h) => h.text === 'CreateOrderInput.note'),
    { file, line: lineOf(t, file, 'note: string;'), text: 'CreateOrderInput.note', check: 'undecorated' });
  assert.equal(hits.some((h) => h.text.startsWith('OrderView.')), false);
  assert.equal(visited, t.files.length);
});

test('a field validated only through PartialType(Base) is not a hit; a field the base lacks still is', () => {
  const t = tree();
  const got = labels(evaluate(SHAPE, t.files, t.read).hits);
  assert.equal(got.includes('UpdateWidgetInput.name undecorated'), false);
  assert.ok(got.includes('UpdateWidgetInput.color undecorated'));
  const noInherit = labels(evaluate({ ...SHAPE, inherit: [] }, t.files, t.read).hits);
  assert.ok(noInherit.includes('UpdateWidgetInput.name undecorated'), 'without the inherit list the base is not an ancestor');
});

test('ancestors resolve through plain extends and nested helpers, and not through an undeclared wrapper', () => {
  const t = tree({
    'src/widgets/more.input.ts': [
      "import { Field, InputType, OmitType, PartialType } from '@nestjs/graphql';",
      '@InputType()',
      'export class RenameWidgetInput extends CreateWidgetInput {',
      '  @Field()',
      '  name: string;',
      '}',
      '@InputType()',
      "export class PatchWidgetInput extends PartialType(OmitType(CreateWidgetInput, ['sku'] as const)) {",
      '  @Field()',
      '  name: string;',
      '}',
      '@InputType()',
      'export class WrappedWidgetInput extends Wrapped(CreateWidgetInput) {',
      '  @Field()',
      '  name: string;',
      '}',
      '@InputType()',
      'export class NestedWrappedInput extends PartialType(Wrapped(CreateWidgetInput)) {',
      '  @Field()',
      '  name: string;',
      '}',
    ],
  });
  const got = labels(evaluate(SHAPE, t.files, t.read).hits);
  assert.equal(got.includes('RenameWidgetInput.name undecorated'), false);
  assert.equal(got.includes('PatchWidgetInput.name undecorated'), false);
  assert.ok(got.includes('WrappedWidgetInput.name undecorated'));
  assert.ok(got.includes('NestedWrappedInput.name undecorated'), 'a declared helper passes on only what it wraps directly');
});

test('a custom validator imported from a module that contains registerDecorator( is not a hit', () => {
  const t = tree();
  const got = labels(evaluate(SHAPE, t.files, t.read).hits);
  assert.equal(got.includes('CreateWidgetInput.sku undecorated'), false);
  assert.ok(got.includes('CreateOrderInput.label undecorated'), 'a helper from a module with no marker validates nothing');
  const noMarkers = labels(evaluate({ ...SHAPE, validator_markers: [] }, t.files, t.read).hits);
  assert.ok(noMarkers.includes('CreateWidgetInput.sku undecorated'), 'the marker is what clears it');
});

// Projects import their own validators through tsconfig aliases (`@/…`) or baseUrl paths (`src/…`). Each
// name here is imported only that way, so no other import can put it in V.
test('a custom validator imported through a path alias or a baseUrl path counts; its marker is still what clears it', () => {
  const file = 'src/notes/create-note.input.ts';
  const t = tree({
    'src/common/validators/is-code.decorator.ts': [
      "import { ValidateBy, ValidationOptions } from 'class-validator';",
      'export const IsCode = (options?: ValidationOptions) =>',
      "  ValidateBy({ name: 'isCode', validator: { validate: (v: unknown) => typeof v === 'string' } }, options);",
    ],
    'src/common/validators/is-tag.decorator.ts': [
      "import { registerDecorator } from 'class-validator';",
      "export const IsTag = () => (target: object, propertyName: string) => registerDecorator({ name: 'isTag', target: target.constructor, propertyName, validator: { validate: () => true } });",
    ],
    [file]: [
      "import { Field, InputType } from '@nestjs/graphql';",
      "import { IsCode } from '@/common/validators/is-code.decorator';",
      "import { IsTag } from 'src/common/validators/is-tag.decorator';",
      "import { IsLabel as IsTitle } from '@/common/is-label';",
      '@InputType()',
      'export class CreateNoteInput {',
      '  @Field()',
      '  @IsCode()',
      '  code: string;',
      '  @Field()',
      '  @IsTag()',
      '  tag: string;',
      '  @Field()',
      '  @IsTitle()',
      '  title: string;',
      '}',
    ],
  });
  const inFile = (shape) => labels(evaluate(shape, t.files, t.read).hits.filter((h) => h.file === file));
  assert.deepEqual(inFile(SHAPE), ['CreateNoteInput.title undecorated'], 'an aliased module with no marker validates nothing');
  assert.deepEqual(inFile({ ...SHAPE, validator_markers: [] }),
    ['CreateNoteInput.code undecorated', 'CreateNoteInput.tag undecorated', 'CreateNoteInput.title undecorated']);
});

test('an import of a listed file that cannot be read validates nothing, and the sweep goes on', () => {
  const t = tree();
  const file = 'src/notes/draft.input.ts';
  const text = ["import { IsDraft } from './gone.decorator';", '@InputType()', 'export class DraftInput {', '  @Field()', '  @IsDraft()',
    '  body: string;', '}', ''].join('\n');
  const read = (f) => (f === file ? text : t.read(f));
  const { hits } = evaluate(SHAPE, [...t.files, file], read, [...t.files, file, 'src/notes/gone.decorator.ts']);
  assert.ok(labels(hits).includes('DraftInput.body undecorated'));
});

test('a nullable: true field with @IsInt() and no @IsOptional() is a nullable-without-optional hit', () => {
  const t = tree();
  const file = 'src/orders/create-order.input.ts';
  const { hits } = evaluate(SHAPE, t.files, t.read);
  assert.deepEqual(hits.find((h) => h.check === 'nullable-without-optional'),
    { file, line: lineOf(t, file, 'quantity?: number;'), text: 'CreateOrderInput.quantity', check: 'nullable-without-optional' });
  assert.equal(labels(hits).includes('CreateWidgetInput.size nullable-without-optional'), false);
  const onlyFirst = evaluate({ ...SHAPE, checks: ['undecorated'] }, t.files, t.read).hits;
  assert.equal(onlyFirst.some((h) => h.check === 'nullable-without-optional'), false);
});

test('the complete hit list is sorted by file, then line, then check', () => {
  const t = tree();
  const { hits } = evaluate(SHAPE, t.files, t.read);
  assert.deepEqual(hits.map((h) => `${h.file}:${h.line} ${h.text} ${h.check}`), [
    `src/orders/create-order.input.ts:${lineOf(t, 'src/orders/create-order.input.ts', 'note: string;')} CreateOrderInput.note undecorated`,
    `src/orders/create-order.input.ts:${lineOf(t, 'src/orders/create-order.input.ts', 'quantity?: number;')} CreateOrderInput.quantity nullable-without-optional`,
    `src/orders/create-order.input.ts:${lineOf(t, 'src/orders/create-order.input.ts', 'label: string;')} CreateOrderInput.label undecorated`,
    `src/widgets/update-widget.input.ts:${lineOf(t, 'src/widgets/update-widget.input.ts', 'color?: string;')} UpdateWidgetInput.color undecorated`,
  ]);
});

test('comments, strings, regex literals and decorator layout do not move a verdict or a line', () => {
  const file = 'src/notes/note.args.ts';
  const t = tree({
    [file]: [
      "import { ArgsType, Field, Int } from '@nestjs/graphql';",
      "import { IsString, Matches, IsInt, IsOptional } from 'class-validator';",
      '/* @InputType() class Ghost { @Field() ghost: string; } */',
      '@ArgsType()',
      'export class NoteArgs {',
      "  @Field({ description: 'see http://example.test/{a}(' })",
      '  // @IsString()',
      '  title: string;',
      '',
      '  @Field() @IsString() body: string;',
      '',
      '  @Field() tag: string;',
      '',
      '  @Field(() => Int, {',
      '    nullable: true,',
      '  })',
      '  @Matches(/^[(a-z]+\\/\\//)',
      '  @IsInt()',
      '  rank?: number;',
      '',
      '  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() page?: number;',
      '}',
    ],
  });
  const got = evaluate(SHAPE, t.files, t.read).hits.filter((h) => h.file === file);
  assert.deepEqual(got.map((h) => `${h.line} ${h.text} ${h.check}`), [
    `${lineOf(t, file, 'title: string;')} NoteArgs.title undecorated`,
    `${lineOf(t, file, 'tag: string;')} NoteArgs.tag undecorated`,
    `${lineOf(t, file, 'rank?: number;')} NoteArgs.rank nullable-without-optional`,
  ]);
});

test('a namespace import validates through ns.X, before or after @Field; a default import from a marked module counts', () => {
  const file = 'src/notes/tag-note.input.ts';
  const t = tree({
    'src/common/is-slug.ts': ["import { registerDecorator } from 'class-validator';",
      'export default function IsSlug() { return (target: object, propertyName: string) => registerDecorator({ name: "s", target: target.constructor, propertyName, validator: { validate: () => true } }); }'],
    'src/common/is-plain.ts': ['export default function IsPlain() { return () => undefined; }'],
    [file]: [
      "import { Field, InputType } from '@nestjs/graphql';",
      "import * as cv from 'class-validator';",
      "import * as gql from '@nestjs/graphql';",
      "import IsSlug, { IsLabel } from '../common/is-slug';",
      "import IsPlain from '../common/is-plain';",
      '@InputType()',
      'export class TagNoteInput {',
      '  @cv.IsString()',
      '  @Field()',
      '  before: string;',
      '  @Field() @cv.MaxLength(5) after: string;',
      '  @Field()',
      '  @IsSlug()',
      '  slug: string;',
      '  @Field()',
      '  @IsPlain()',
      '  plain: string;',
      '  @Field()',
      '  @gql.Directive("@upper")',
      '  loud: string;',
      '}',
    ],
  });
  assert.deepEqual(labels(evaluate(SHAPE, t.files, t.read).hits.filter((h) => h.file === file)),
    ['TagNoteInput.plain undecorated', 'TagNoteInput.loud undecorated']);
});

test('an initializer with no type closes the property, so an undecorated one is a hit at its line', () => {
  const file = 'src/notes/page.args.ts';
  const t = tree({
    [file]: ["import { ArgsType, Field, Int } from '@nestjs/graphql';", "import { IsInt } from 'class-validator';", '@ArgsType()',
      'export class PageArgs {', '  @Field(() => Int)', '  take = 20;', '  @Field(() => Int)', '  @IsInt()', '  skip = 0;', '}'],
  });
  assert.deepEqual(evaluate(SHAPE, t.files, t.read).hits.filter((h) => h.file === file),
    [{ file, line: 6, text: 'PageArgs.take', check: 'undecorated' }]);
});

test('PickType and OmitType pass on only the keys they keep', () => {
  const file = 'src/widgets/narrow.input.ts';
  const t = tree({
    [file]: [
      "import { Field, InputType, OmitType, PartialType, PickType } from '@nestjs/graphql';",
      '@InputType()',
      "export class OmitNameInput extends OmitType(CreateWidgetInput, ['name', 'size'] as const) {",
      '  @Field()', '  name: string;', '  @Field()', '  sku: string;', '}',
      '@InputType()',
      "export class PickSkuInput extends PartialType(PickType(CreateWidgetInput, ['sku'] as const)) {",
      '  @Field()', '  name: string;', '  @Field()', '  sku: string;', '}',
      '@InputType()',
      "export class BothInput extends PickType(OmitType(CreateWidgetInput, ['sku']), ['name', 'sku']) {",
      '  @Field()', '  name: string;', '  @Field()', '  sku: string;', '}',
    ],
  });
  assert.deepEqual(labels(evaluate(SHAPE, t.files, t.read).hits.filter((h) => h.file === file)), [
    'OmitNameInput.name undecorated', 'PickSkuInput.name undecorated', 'BothInput.sku undecorated',
  ]);
});

test('a validator re-exported through a barrel counts; a decorator from nowhere validates nothing', () => {
  const t = tree({
    'src/common/validators.ts': ["export { IsNotEmpty } from 'class-validator';"],
    'src/notes/create-note.input.ts': [
      "import { Field, InputType } from '@nestjs/graphql';",
      "import { IsNotEmpty } from '../common/validators';",
      '@InputType()',
      'export class CreateNoteInput {',
      '  @Field()',
      '  @IsNotEmpty()',
      '  body: string;',
      '  @Field()',
      '  @Unrelated()',
      '  extra: string;',
      '}',
    ],
  });
  const got = labels(evaluate(SHAPE, t.files, t.read).hits);
  assert.equal(got.includes('CreateNoteInput.body undecorated'), false);
  assert.ok(got.includes('CreateNoteInput.extra undecorated'));
});

test('regex reports every match at the line where it starts, honouring flags', () => {
  const read = (f) => ({
    'src/rules/limit.ts': 'export const widgetLimit = 3;\n',
    'src/a.ts': [
      "import { widgetLimit } from './rules/limit';",
      'export const over = (n: number) => widgetLimit < n || WIDGETLIMIT< n;',
      'export const under = (n: number) => widgetLimit',
      '  < n;',
    ].join('\n'),
  })[f] ?? null;
  const files = ['src/a.ts', 'src/rules/limit.ts'];
  const plain = evaluate({ type: 'regex', files: ['src/**'], pattern: 'widgetLimit\\s*<', flags: '' }, files, read);
  assert.deepEqual(plain.hits, [
    { file: 'src/a.ts', line: 2, text: 'widgetLimit <', check: 'regex' },
    { file: 'src/a.ts', line: 3, text: 'widgetLimit', check: 'regex' },
  ]);
  assert.equal(plain.visited, 2);
  const folded = evaluate({ type: 'regex', files: ['src/**'], pattern: 'widgetlimit\\s*<', flags: 'gi' }, files, read);
  assert.deepEqual(folded.hits.map((h) => `${h.line}:${h.text}`), ['2:widgetLimit <', '2:WIDGETLIMIT<', '3:widgetLimit']);
  const anchored = evaluate({ type: 'regex', files: ['src/**'], pattern: '^export const \\w+ = 3', flags: 'm' }, files, read);
  assert.deepEqual(anchored.hits.map((h) => `${h.file}:${h.line}`), ['src/rules/limit.ts:1']);
});
