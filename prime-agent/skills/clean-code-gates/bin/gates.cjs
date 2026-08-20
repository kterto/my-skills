#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('../src/args.cjs');
const { run } = require('../src/run.cjs');

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (e) { process.stderr.write(`usage error: ${e.message}\n`); process.exit(3); }
  const root = process.cwd();

  if (options.scaffold) {
    const { detectStacks } = require('../src/detect.cjs');
    const { scaffoldAdvice, formatAdvice } = require('../src/scaffold.cjs');
    const stacks = detectStacks(root);
    process.stdout.write(formatAdvice(scaffoldAdvice(root, stacks), stacks) + '\n');
    process.exit(0);
  }

  let result;
  try { result = run({ root, options, io: { version: require('../package.json').version } }); }
  catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(3); }
  const { report, exitCode } = result;
  if (options.out === '-') { process.stdout.write(JSON.stringify(report, null, 2) + '\n'); }
  else {
    fs.mkdirSync(path.join(root, options.out), { recursive: true });
    fs.writeFileSync(path.join(root, options.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    const { toMarkdown } = require('../src/report.cjs');
    fs.writeFileSync(path.join(root, options.out, 'report.md'), toMarkdown(report) + '\n');
    process.stderr.write(`report → ${options.out}/report.json (status: ${report.summary.status})\n`);
  }
  process.exit(exitCode);
}
main();
