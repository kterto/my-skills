"use strict";
// The skill's own files: templates/ through one loader and one renderer, so every writer fills placeholders the same
// way and a placeholder left without a value is an error, never output, plus the blocks of references/recipes.md.
// `{{name}}` takes a value; `{{#list}}`...`{{/list}}` repeats its body once per item of an array, with the item's
// fields added to the values.

const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "..", "templates");
const loaded = new Map();

function load(name) {
  if (!loaded.has(name)) loaded.set(name, fs.readFileSync(path.join(DIR, name), "utf8"));
  return loaded.get(name);
}

function fill(text, values, name) {
  const repeated = text.replace(/\{\{#(\w+)\}\}\n?([\s\S]*?)\{\{\/\1\}\}\n?/g, (_, key, body) => {
    if (!Array.isArray(values[key])) throw new Error(`template ${name}: {{#${key}}} needs a list`);
    return values[key].map((item) => fill(body, { ...values, ...item }, name)).join("");
  });
  return repeated.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values) || values[key] === undefined || values[key] === null) throw new Error(`template ${name}: no value for {{${key}}}`);
    return String(values[key]);
  });
}

const render = (name, values = {}) => fill(load(name), values, name);

// One block of references/recipes.md, from its `## <id>` heading to the next heading; null when there is none.
function recipe(id) {
  const md = fs.readFileSync(path.join(DIR, "..", "references", "recipes.md"), "utf8");
  const start = md.indexOf(`\n## ${id}\n`);
  if (start < 0) return null;
  const end = md.indexOf("\n## ", start + 1);
  return md.slice(start + 1, end < 0 ? md.length : end).trim();
}

module.exports = { render, recipe, DIR };
