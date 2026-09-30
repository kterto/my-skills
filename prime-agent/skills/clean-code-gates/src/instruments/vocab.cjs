'use strict';
// Closed vocabularies: the admission registry must name every value, so an unregistered one fails CI.
// One `exports.X =` per array: ESM sees a name only in that form, never inside a frozen object literal.
const frozen = (...values) => Object.freeze(values);
exports.KINDS = frozen('barrier', 'select', 'sweep', 'live');
exports.MODES = frozen('select:tier', 'select:adhoc', 'sweep:guard', 'sweep:all', 'sweep:changed', 'sweep:shape',
  'sweep:prove', 'live:check', 'live:up', 'live:readback', 'live:down');
exports.RESULTS = frozen('pass', 'fail', 'not-run');
exports.REASONS = frozen('assertion', 'timeout', 'vacuous', 'empty-scope', 'flaky', 'unmeasured', 'blocked-env',
  'repo-defect', 'no-live-recipe');
exports.STATUSES = frozen('pass', 'red', 'not-run');
exports.SUITE_RESULTS = frozen('pass', 'fail', 'error', 'skipped');
exports.BASE_SOURCES = frozen('inherited', 'worktree', 'none');
exports.GUARD_KINDS = frozen('shape', 'command', 'consumers');
exports.SHAPE_TYPES = frozen('regex', 'decorated-fields');
exports.GUARD_STATUSES = frozen('green', 'red', 'not-run', 'quiet', 'listed');
exports.ON_TIMEOUT = frozen('not-done', 'retry-2x');
exports.ISOLATION = frozen('shared-dev', 'ephemeral');
Object.freeze(module.exports);
