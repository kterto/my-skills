'use strict';
// Advice-only scaffold: detect which gate tooling is present in the target
// project and print the exact install commands for what's missing. Never mutates
// the project — it only reads and reports.
const fs = require('node:fs');
const path = require('node:path');

function hasBin(root, name) {
  return fs.existsSync(path.join(root, 'node_modules', '.bin', name));
}

function resolvable(root, pkg) {
  try {
    require.resolve(pkg, { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

/** Presence check without executing anything — scan PATH for the binary. */
function onPath(cmd) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  return dirs.some((d) => {
    try {
      return fs.existsSync(path.join(d, cmd));
    } catch {
      return false;
    }
  });
}

function hasDartPkg(root, name) {
  try {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(root, '.dart_tool', 'package_config.json'), 'utf8'),
    );
    return (cfg.packages || []).some((p) => p.name === name);
  } catch {
    return false;
  }
}

function nodeTsTools(root) {
  const hasJest = hasBin(root, 'jest');
  const hasVitest = hasBin(root, 'vitest');
  const tools = [
    {
      gates: 'G1',
      label: 'test runner (coverage)',
      present: hasJest || hasVitest,
      install: 'npm i -D vitest @vitest/coverage-v8   # or: npm i -D jest',
    },
  ];
  if (hasVitest && !hasJest) {
    tools.push({
      gates: 'G1',
      label: 'vitest coverage provider',
      present:
        resolvable(root, '@vitest/coverage-v8') ||
        resolvable(root, '@vitest/coverage-istanbul'),
      install: 'npm i -D @vitest/coverage-v8   # or @vitest/coverage-istanbul',
    });
  }
  tools.push(
    {
      gates: 'G2/G4',
      label: 'eslint + typescript-eslint',
      present: hasBin(root, 'eslint') && resolvable(root, 'typescript-eslint'),
      install: 'npm i -D eslint typescript-eslint',
    },
    {
      gates: 'G6',
      label: 'stryker (mutation)',
      present: hasBin(root, 'stryker'),
      install:
        'npm i -D @stryker-mutator/core @stryker-mutator/jest-runner   # vitest: @stryker-mutator/vitest-runner',
    },
    {
      gates: 'G7',
      label: 'dependency-cruiser',
      present: hasBin(root, 'depcruise'),
      install: 'npm i -D dependency-cruiser',
    },
  );
  return tools;
}

function dartFlutterTools(root) {
  return [
    {
      gates: 'G1',
      label: 'Flutter SDK',
      present: onPath('flutter'),
      install: 'install Flutter — https://docs.flutter.dev/get-started/install',
    },
    {
      gates: 'G2/G4',
      label: 'dart_code_linter',
      present: hasDartPkg(root, 'dart_code_linter'),
      install: 'dart pub add -d dart_code_linter',
    },
    {
      gates: 'G6',
      label: 'dart_mutant (external CLI)',
      present: onPath('dart_mutant'),
      install: 'brew install dart_mutant',
    },
  ];
}

function toolsFor(stack, root) {
  if (stack === 'node-ts') return nodeTsTools(root);
  if (stack === 'dart-flutter') return dartFlutterTools(root);
  return [];
}

/** Per-stack tooling presence + install advice. Reads only; mutates nothing. */
function scaffoldAdvice(root, stacks) {
  const out = [];
  for (const stack of stacks) {
    for (const t of toolsFor(stack, root)) out.push({ stack, ...t });
  }
  return out;
}

function formatAdvice(advice, stacks) {
  const lines = ['clean-code-gates — tooling scaffold (advice only, no changes made)'];
  if (!stacks.length) {
    lines.push('  no supported stack detected (need package.json + tsconfig.json, or pubspec.yaml).');
    return lines.join('\n');
  }
  for (const stack of stacks) {
    lines.push(`\n[${stack}]`);
    for (const a of advice.filter((x) => x.stack === stack)) {
      lines.push(`  ${a.present ? 'ok  ' : 'MISS'} ${a.gates.padEnd(6)} ${a.label}`);
      if (!a.present) lines.push(`         ↳ ${a.install}`);
    }
  }
  const missing = advice.filter((a) => !a.present).length;
  lines.push(
    missing
      ? `\n${missing} tool group(s) missing — install the above, then re-run the gates. G5 (no-comments) needs no tooling.`
      : '\nAll gate tooling present. G5 (no-comments) needs no tooling.',
  );
  return lines.join('\n');
}

module.exports = { scaffoldAdvice, formatAdvice };
