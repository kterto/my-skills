'use strict';
// The hardened git env (GIT_CONFIG_GLOBAL=/dev/null, contract §0.8) also drops the user's global excludes,
// so a .DS_Store that a desktop writes into a temp repo mid-test would count as a project file:
// an extra untracked file, a different candidate tree. A fixture repo ignores it itself, and the tests'
// temp-dir cleanups use fs.promises.rm with maxRetries, which re-sweeps a directory such a write refilled.
const fs = require('node:fs');
const path = require('node:path');

function ignoreDesktopLitter(dir) {
  fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '.DS_Store\n');
}

module.exports = { ignoreDesktopLitter };
