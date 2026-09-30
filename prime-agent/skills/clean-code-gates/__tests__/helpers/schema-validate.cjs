'use strict';

// The hand-rolled JSON-schema validator every schema test shares. It sits outside
// Node's default test glob, so it is loaded by tests and never run as one.

const TYPE_PREDICATES = {
  object: v => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: v => Array.isArray(v),
  string: v => typeof v === 'string',
  integer: v => Number.isInteger(v),
  number: v => typeof v === 'number',
  boolean: v => typeof v === 'boolean',
  null: v => v === null,
};

function describeValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function checkType(value, type, path, errs) {
  if (!type) return true;
  const allowed = Array.isArray(type) ? type : [type];
  if (allowed.some(t => TYPE_PREDICATES[t] && TYPE_PREDICATES[t](value))) return true;
  errs.push(`${path}: expected type ${allowed.join('|')}, got ${describeValue(value)}`);
  return false;
}

/** `format` asserts, it does not annotate; an unrecognized value is a validator error, never a silent pass. */
const FORMAT_PREDICATES = {
  'date-time': v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v),
};

/** One entry per honoured assertion keyword; `checkNode` dispatches through this table and nothing else. */
const ASSERTIONS = {
  type: (value, schema, path, errs) => checkType(value, schema.type, path, errs),
  const: (value, schema, path, errs) => {
    if (value === schema.const) return;
    errs.push(`${path}: must equal ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  },
  enum: (value, schema, path, errs) => {
    if (schema.enum.includes(value)) return;
    errs.push(`${path}: must be one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
  },
  minimum: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.number(value) || value >= schema.minimum) return;
    errs.push(`${path}: must be >= ${schema.minimum}, got ${JSON.stringify(value)}`);
  },
  pattern: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.string(value) || new RegExp(schema.pattern).test(value)) return;
    errs.push(`${path}: must match ${schema.pattern}, got ${JSON.stringify(value)}`);
  },
  format: (value, schema, path, errs) => {
    const matchesFormat = FORMAT_PREDICATES[schema.format];
    if (!matchesFormat) throw new Error(`${path}: unsupported schema format "${schema.format}"`);
    if (!TYPE_PREDICATES.string(value) || matchesFormat(value)) return;
    errs.push(`${path}: must be a valid ${schema.format}, got ${JSON.stringify(value)}`);
  },
  required: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.object(value)) return;
    for (const key of schema.required) {
      if (!Object.hasOwn(value, key)) errs.push(`${path}: missing required key "${key}"`);
    }
  },
  additionalProperties: (value, schema, path, errs) => {
    if (schema.additionalProperties !== false || !TYPE_PREDICATES.object(value)) return;
    const known = schema.properties || {};
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(known, key)) errs.push(`${path}: unknown key "${key}"`);
    }
  },
  properties: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.object(value)) return;
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in value) checkNode(value[key], subSchema, `${path}.${key}`, errs);
    }
  },
  items: (value, schema, path, errs) => {
    if (!Array.isArray(value)) return;
    value.forEach((item, i) => checkNode(item, schema.items, `${path}[${i}]`, errs));
  },
};

const POST_TYPE_KEYWORDS = Object.keys(ASSERTIONS).filter(keyword => keyword !== 'type');

/** Generic recursive check. The honoured keyword set is exactly the keys of `ASSERTIONS`. */
function checkNode(value, schema, path, errs) {
  if (!TYPE_PREDICATES.object(schema)) return;
  if (!ASSERTIONS.type(value, schema, path, errs)) return;
  for (const keyword of POST_TYPE_KEYWORDS) {
    if (keyword in schema) ASSERTIONS[keyword](value, schema, path, errs);
  }
}

/** Core keywords: they identify and version the schema document itself and constrain no instance. */
const CORE_KEYWORDS = new Set(['$schema', '$id']);

/** Keywords that annotate rather than assert; they are allowed to be unimplemented. */
const ANNOTATION_KEYWORDS = new Set([
  'title', 'description', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly', '$comment',
]);

/**
 * Every keyword set that carries no assertion, keyed by name. `unhandledKeywords` and the
 * disjointness guard both read this registry, so a set added here is covered by both at once and
 * a set added anywhere else is covered by neither — there is one place to look.
 */
const NON_ASSERTING_SETS = { CORE_KEYWORDS, ANNOTATION_KEYWORDS };

/** True when the keyword belongs to any non-asserting set, so the coverage guard may skip it. */
function isNonAsserting(keyword) {
  return Object.values(NON_ASSERTING_SETS).some(set => set.has(keyword));
}

/**
 * Schema-aware walk: keys of a schema node are keywords, but keys under `properties` are
 * property names. Only `properties.*`, `items`, and an object-valued `additionalProperties`
 * are sub-schemas; `required`/`enum` array contents and boolean `additionalProperties` are values.
 *
 * Deliberate divergence from `checkNode`: this walk descends an object-valued
 * `additionalProperties`, a form `checkNode` does not enforce. The divergence is the safe
 * direction — descending finds MORE keywords, so the coverage guard stays stricter; teaching this
 * walk to stop descending would leave keywords nested inside an object-form sub-schema uncounted
 * and make the guard silently permissive. `unsupportedKeywordForms` is the guard that closes the
 * loop: it goes red the day `report.schema.json` actually adopts the object form (or tuple-form
 * `items`), so the unenforced form can never arrive unannounced.
 */
function collectSchemaKeywords(node, found = new Set()) {
  if (!TYPE_PREDICATES.object(node)) return found;
  for (const [keyword, sub] of Object.entries(node)) {
    found.add(keyword);
    if (keyword === 'properties') Object.values(sub).forEach(s => collectSchemaKeywords(s, found));
    if (keyword === 'items' || keyword === 'additionalProperties') collectSchemaKeywords(sub, found);
  }
  return found;
}

/** Keywords the given schema asserts with that `checkNode` would silently ignore. */
function unhandledKeywords(schemaNode) {
  const implemented = new Set(Object.keys(ASSERTIONS));
  return [...collectSchemaKeywords(schemaNode)]
    .filter(keyword => !implemented.has(keyword) && !isNonAsserting(keyword))
    .sort();
}

/**
 * Structural validator (no external deps). The schema comes first, and a first argument that
 * is not a schema throws: a swapped call would otherwise walk the report as if it were the
 * schema, find no keyword to enforce, and pass vacuously.
 */
function validate(schema, value) {
  if (!TYPE_PREDICATES.object(schema) || !('$schema' in schema || 'type' in schema)) {
    throw new Error('validate(schema, value): the first argument has neither $schema nor type (arguments swapped?)');
  }
  const errs = [];
  checkNode(value, schema, '$', errs);
  return errs;
}

/**
 * `unhandledKeywords` guards keyword *names*. `additionalProperties` and `items` are each honoured
 * in one form only — the boolean form and the single-sub-schema form — so the schema adopting the
 * object form or the tuple form would be unenforced AND unreported by that guard. This guards the
 * forms, and goes red the day the schema starts using one the validator does not walk.
 */
function unsupportedKeywordForms(node, path = '$', found = []) {
  if (!TYPE_PREDICATES.object(node)) return found;
  if (Array.isArray(node.items)) found.push(`${path}.items: tuple form`);
  if (TYPE_PREDICATES.object(node.additionalProperties)) found.push(`${path}.additionalProperties: sub-schema form`);
  if (node.properties) {
    for (const [key, sub] of Object.entries(node.properties)) unsupportedKeywordForms(sub, `${path}.${key}`, found);
  }
  if (TYPE_PREDICATES.object(node.items)) unsupportedKeywordForms(node.items, `${path}[]`, found);
  return found;
}

module.exports = { validate, unhandledKeywords, unsupportedKeywordForms, ASSERTIONS, NON_ASSERTING_SETS };
