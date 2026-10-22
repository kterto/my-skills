"use strict";
// Runs one tool for verify in a process group of its own and, past the deadline, stops the whole group, so a tool that
// times out leaves nothing running behind it (spawnSync's timeout reaches only the child). The tool's exit code and output
// pass through. What verify needs besides them goes to fd 3 as one JSON object, { timedOut: true } or { error: <code> }.
// usage: node supervise.cjs <ms> <tool> [args...]

const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");

const [ms, tool, ...args] = process.argv.slice(2);
const child = spawn(tool, args, { stdio: ["ignore", "inherit", "inherit"], detached: true });
const stop = (signal) => { try { process.kill(-child.pid, signal); } catch {} };
const report = (outcome) => { try { fs.writeSync(3, JSON.stringify(outcome)); } catch {} };
let timedOut = false;

const deadline = setTimeout(() => {
  timedOut = true;
  stop("SIGTERM");
  setTimeout(() => stop("SIGKILL"), 3000).unref();
}, Number(ms));
// The tool sits in another group, so a signal meant for this run reaches it only through here.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop(signal));

child.on("error", (e) => {
  clearTimeout(deadline);
  report({ error: e.code || e.message });
  process.exit(127);
});
child.on("exit", (code, signal) => {
  clearTimeout(deadline);
  if (timedOut) {
    stop("SIGKILL");
    report({ timedOut: true });
    process.exit(124);
  }
  process.exit(code === null ? 128 + (os.constants.signals[signal] || 0) : code);
});
