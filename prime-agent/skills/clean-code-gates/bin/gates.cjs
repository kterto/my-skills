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
  const { report, exitCode, warnings = [] } = result;
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
  // Non-suppressible, and on stderr so it survives `--out -` being piped into a
  // consumer. There is no flag that turns it off: a disclosure a run can silence
  // is the loophole with one more step in it.
  const { formatInstrumentLine } = require('../src/instrument.cjs');
  const moved = formatInstrumentLine(report.instrument);
  if (moved) process.stderr.write(moved + '\n');
  const { formatRigorLine } = require('../src/report.cjs');
  const rigorLine = formatRigorLine(report.rigor);
  if (rigorLine) process.stderr.write(rigorLine + '\n');
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
// --help and -h answer before any repository, base or config is read, and exit 0: the usage, or the common flags and the
// kind's section of this engine's own reference (a copy without it says so).
function help(kind) {
  if (!kind) return 'usage: gates.cjs [--scope project|diff[:<ref>]|module:<path>|files:<a,b>] [--gates G1,…] [--skip G6] [--out <dir>|-]\n'
    + '         [--rigor sketch|delivery|hardened] [--base-ref <ref>] [--require-tools] [--scaffold]\n'
    + '       gates.cjs <barrier|select|sweep|live> [flags] (gates.cjs <kind> --help)\n';
  let ref = '';
  try { ref = fs.readFileSync(path.join(__dirname, '..', 'references', 'instruments.md'), 'utf8'); } catch { /* not in this copy */ }
  const section = ref.split(/^(?=## )/m).find((s) => s.startsWith(`## \`${kind}\`\n`));
  return `common flags: --base <ref> --instruments-from <ref>|file:<path> --out <dir>|- --now <ISO 8601>\n\n${section ? section.trimEnd() : '(kind reference not found)'}\n`;
}
// Instruments set exitCode rather than exit: exiting right after a large write can cut a darwin pipe.
const argv = process.argv.slice(2);
const kind = require('../src/instruments/vocab.cjs').KINDS.includes(argv[0]) ? argv[0] : null;
if (argv.includes('--help') || argv.includes('-h')) process.stdout.write(help(kind));
else if (!kind) main();
else require('../src/instruments/cli.cjs').main(kind, argv.slice(1)).then((code) => { process.exitCode = code; });
