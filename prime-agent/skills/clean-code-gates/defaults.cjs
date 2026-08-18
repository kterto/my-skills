'use strict';
// qa.md-derived defaults. Per-gate thresholds + G1 exemption globs.
const THRESHOLDS = {
  G1: { statements: 85, branches: 80 },
  G2: { complexity: 8, maxDepth: 2, maxLinesPerFunction: 30, maxParams: 4, maxStatements: 15 },
  G6: { mutationScore: 70 },
};
const G1_EXEMPTIONS = [
  '**/main.dart', '**/firebase_options.dart', '**/*_strings.dart',
  '**/*.interface.ts', '**/prisma/**', '**/*.stories.tsx',
];
// Generated / machine-authored files: never gated by content gates (G5, etc.).
const GENERATED_EXCLUDES = {
  'dart-flutter': ['**/*.g.dart', '**/*.freezed.dart', '**/*.gql.dart', '**/*.config.dart', '**/__generated__/**'],
  'node-ts': ['**/*.d.ts', '**/__generated__/**', '**/generated/**', '**/prisma/**'],
};
function defaultStackConfig(stack) {
  if (stack === 'node-ts') return {
    roots: ['src'],
    exclude: GENERATED_EXCLUDES['node-ts'],
    gates: {
      G1: { tool: 'auto', thresholds: THRESHOLDS.G1 },
      G2: { tool: 'eslint', thresholds: THRESHOLDS.G2 },
      G4: { tool: 'eslint' },
      G5: { tool: 'builtin' },
      G6: { tool: 'stryker', runner: 'auto', thresholds: THRESHOLDS.G6 },
      G7: { tool: 'dependency-cruiser' },
    },
    baseline: '.eslint-baseline.json',
  };
  if (stack === 'dart-flutter') return {
    roots: ['lib'],
    exclude: GENERATED_EXCLUDES['dart-flutter'],
    gates: {
      G1: { tool: 'flutter', thresholds: THRESHOLDS.G1 },
      G2: { tool: 'dart_code_linter', thresholds: { 'cyclomatic-complexity': 8, 'maximum-nesting-level': 2, 'number-of-parameters': 4, 'source-lines-of-code': 30 } },
      G4: { tool: 'dart_code_linter' },
      G5: { tool: 'builtin' },
      G6: { tool: 'dart_mutant', thresholds: THRESHOLDS.G6 },
      G7: { tool: 'builtin' },
    },
    baseline: '.dart_code_linter_baseline.yaml',
  };
  return { roots: [], gates: {} };
}
module.exports = { THRESHOLDS, G1_EXEMPTIONS, GENERATED_EXCLUDES, defaultStackConfig };
