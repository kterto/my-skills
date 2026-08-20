'use strict';

/**
 * `--scope diff:<baseRef>` is caller-supplied and reaches Git. Every Git call is
 * made with an argv array and no shell, so this allow-list is defence in depth
 * rather than the only barrier: it keeps the revision syntax people actually
 * type (`origin/main`, `HEAD~2`, `v1.0^{}`, `@{u}`) and rejects everything a
 * shell would read as a control character, plus a leading `-` that Git itself
 * would read as an option.
 */
const BASE_REF_SHAPE = /^[A-Za-z0-9._@/^~{}+-]+$/;

function assertBaseRefShape(baseRef) {
  if (typeof baseRef !== 'string' || baseRef === '') throw new Error('invalid base ref — must be a non-empty string');
  if (baseRef.startsWith('-')) throw new Error(`invalid base ref — must not start with "-": ${baseRef}`);
  if (!BASE_REF_SHAPE.test(baseRef)) throw new Error(`invalid base ref — contains characters outside the allowed ref shape: ${baseRef}`);
  return baseRef;
}

module.exports = { assertBaseRefShape };
