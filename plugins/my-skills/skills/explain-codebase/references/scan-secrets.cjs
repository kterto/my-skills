"use strict";
// Deterministic secret scanner for the FINAL rendered report (sec-2), replacing the earlier
// inline grep gate that missed ordinary password/api_key assignments and common token
// families and used a non-portable POSIX-ERE `\s`. This is a Node module (portable JS
// regex) exporting scanSecrets(text) -> [{ type, match }] and a CLI that exits non-zero when
// the report still contains a credential/private-key/token/connection-string pattern.
//
// It is the LAST gate before a shareable report is written (SKILL.md step 6); a hit means
// redaction (SKILL.md §"Secret-redaction boundary") failed for that item — redact and
// re-render, never publish. Redacted markers («redacted») and mere key NAMES are not hits.

const fs = require("node:fs");

// The rendered report inlines the 3.3 MB vendored Mermaid runtime, whose minified source is
// full of hex/base64-shaped substrings. Strip that block before scanning so it cannot
// drown the scan in false positives (same convention as the test/self-contained scripts).
function stripRuntime(text) {
  return text.replace(/<script id="mermaid-runtime">[\s\S]*?<\/script>/i, "");
}

// A value that is an obvious placeholder / already-redacted marker is NOT a leaked secret.
const PLACEHOLDER = /^(?:«redacted»|redacted|x{3,}|\*{3,}|example|changeme|your[-_]|<[^>]*>|\.\.\.|null|none|true|false|\d+)$/i;

// Ordered, named detectors. Token families are deterministic; the entropy thresholds are set
// ABOVE a 40-char git SHA (hex ≥ 64) and above incidental base64 (≥ 44) to avoid flagging the
// report's own COMMIT_SHA or short color hex.
const DETECTORS = [
  ["private-key-block", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ["aws-access-key-id", /\b(?:AKIA|ASIA|AROA|AIDA)[0-9A-Z]{16}\b/g],
  ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/g],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ["openai-key", /\b(?:sk|rk)-[A-Za-z0-9]{20,}\b/g],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["stripe-key", /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ["slack-webhook", /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g],
  // Connection string / URL with embedded credentials — JS regex, portable (no POSIX \s issue).
  ["connection-string-credentials", /\b[a-z][a-z0-9+.-]*:\/\/[^/@:\s"'<>]+:[^/@\s"'<>]+@/gi],
  // High-entropy standalone blobs (after runtime strip): hex ≥ 64 (avoids 40-char SHAs),
  // base64 ≥ 44 (≈ 32-byte key). Word-bounded to reduce incidental matches.
  ["hex-secret", /\b[0-9a-fA-F]{64,}\b/g],
  ["base64-secret", /\b[A-Za-z0-9+/]{44,}={0,2}(?=\b|=)/g],
];

// Credential-key assignment: key = value where the value is a real, non-placeholder secret.
// Catches "password: hunter2", api_key="AKIA…", secret=deadbeef… that the token families miss.
// A leading `[A-Za-z0-9_]*?` lazily absorbs env-var prefixes (DB_PASSWORD, MY_API_KEY) that a
// bare `\b` would miss because `_` is not a word boundary.
const CRED_KEY = /\b[A-Za-z0-9_]*?(pass(?:word|wd)?|secret|token|api[_-]?key|access[_-]?key|secret[_-]?key|private[_-]?key|client[_-]?secret|auth(?:[_-]?token)?|credential|conn(?:ection)?[_-]?string|dsn)\s*["']?\s*[:=]\s*["']?([^\s"'<>]{6,})/gi;

function scanSecrets(text) {
  if (typeof text !== "string") return [];
  const body = stripRuntime(text);
  const hits = [];
  for (const [type, re] of DETECTORS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) hits.push({ type, match: m[0].slice(0, 60) });
  }
  CRED_KEY.lastIndex = 0;
  let m;
  while ((m = CRED_KEY.exec(body)) !== null) {
    const value = m[2];
    if (!PLACEHOLDER.test(value)) hits.push({ type: "credential-assignment", match: `${m[1]}=${value.slice(0, 40)}` });
  }
  return hits;
}

module.exports = { scanSecrets, stripRuntime };

// --- CLI ------------------------------------------------------------------------------
if (require.main === module) {
  const file = process.argv[2];
  let raw;
  try {
    raw = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
  } catch (e) {
    console.error(`cannot read input: ${e.message}`);
    process.exit(2);
  }
  const hits = scanSecrets(raw);
  if (hits.length) {
    for (const h of hits) console.error(`secret[${h.type}]: ${h.match}`);
    console.error(`refusing: report matches ${hits.length} secret pattern(s) — redact and re-render`);
    process.exit(1);
  }
  console.log("no secret patterns found");
}
