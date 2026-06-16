'use strict';

function parseScope(raw) {
  if (!raw) return { kind: 'project' };
  const [kind, rest] = splitOnce(raw, ':');
  switch (kind) {
    case 'project': return { kind: 'project' };
    case 'diff': return { kind: 'diff', baseRef: rest || null };
    case 'module': return { kind: 'module', target: rest };
    case 'files': return { kind: 'files', files: rest.split(',').map(s => s.trim()).filter(Boolean) };
    default: throw new Error(`unknown scope kind: ${kind}`);
  }
}

function splitOnce(s, sep) {
  const i = s.indexOf(sep);
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

function parseArgs(argv) {
  const o = { scope: { kind: 'project' }, gates: null, skip: [], out: './.cleancode',
              scaffold: false, requireTools: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--scope': o.scope = parseScope(next()); break;
      case '--gates': o.gates = next().split(',').map(s => s.trim()).filter(Boolean); break;
      case '--skip': o.skip = next().split(',').map(s => s.trim()).filter(Boolean); break;
      case '--out': o.out = next(); break;
      case '--scaffold': o.scaffold = true; break;
      case '--require-tools': o.requireTools = true; break;
      default: throw new Error(`unknown argument: ${a}`);
    }
  }
  return o;
}

module.exports = { parseArgs, parseScope };
