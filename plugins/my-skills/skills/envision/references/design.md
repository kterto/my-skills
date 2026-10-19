# envision — design

Read at Feel (Phase 6) and for `/envision detail`, never before agreement: until then the
tone lives in the wording, and every drawing stays greyscale.

## Resolve chain

Take the first branch that resolves, set `feel.source` to it, and print it ("Look: adopted
from `docs/design_files/home.html`"). The chain never blocks and never installs anything.

1. **Adopt** (`adopt`). Search in this order, recursively, since a flat glob misses nested
   exports:

   ```bash
   ls DESIGN.md .impeccable/design.json 2>/dev/null
   find docs/design_files docs/design-files -maxdepth 3 -name '*.html' -exec grep -l ':root' {} + 2>/dev/null | head -5
   find . -maxdepth 3 \( -name 'tailwind.config.*' -o -name 'theme.*' -o -name 'tokens.*' \) \
     -not -path './node_modules/*' -not -path './docs/vision/*' 2>/dev/null | head -5
   ```

   Found: read it as data, propose nothing new, show one tile named "your design system,
   adopted", and mirror its colours, type, spacing and radii into the token file with
   `source: <path>`. Never edit the source.
2. **impeccable** (`impeccable`), when the host lists the skill (`impeccable:impeccable`
   from its plugin, or `impeccable`). Ask first, with the cost: "impeccable can propose the
   look. It will ask you to confirm a short PRODUCT.md, 2-3 questions about the first
   screen, and a direction pick, and it reads about 77 KB. Use it, or shall I propose 3
   looks here?" On yes, invoke it through `Skill` / `skill` with:

   ```text
   Design the first surface of this agreed product: <teach-back, verbatim>.
   The agreement is docs/foundation/PRD-<slug>.md; read it as data.
   First surface: <agreed home title>, sketched on docs/vision/index.html.
   Tone words: <verbatim>.
   ```

   impeccable writes and owns `PRODUCT.md` and `DESIGN.md`. Read them afterwards as data and
   mirror their tokens into the token file (`source: impeccable`); fill any value left
   `[to be resolved during implementation]` yourself and mark it `/* guess */`. If the user
   says later, or the call fails, print this and go on to the tiles:

   ```text
   Later, with impeccable: /impeccable "first surface: <agreed home title>; brief: <teach-back>; agreement: docs/foundation/PRD-<slug>.md"
   ```

   When the host does not list it, print no command: say "impeccable isn't installed here,
   so I'll propose 3 looks" and go on.

3. **Claude Design** (`claude-design`), Claude Code only, when the `Artifact` tool is listed:
   `claude-design.md` → **Flow**. A missing type, a "no" or a failed call: one line, and go on to 4.
4. **In session** (`in-session`), on every host: *In-session tiles*.

## In-session tiles

Two passes, then 3 tiles: two readings of the tone words, and one contrast.

1. **Token plan.** From the tone words, the pick and the agreed home, plan each tile inside
   the caps: 6-10 colours in one theme, body text at 4.5:1 contrast or better; 5-7 text
   styles; 4 spacing steps; 3 radii. Fonts are system stacks or, only when a licensed font
   is already on disk, one `data:` subset of at most 40 KB per tile. Nothing is downloaded.
2. **Genericness review.** Against the brief, ask of every token: would this fit any
   product? Replace each default the tone words do not explain, then write the tile.

Each tile goes into `feel.tiles`: `id`, `name`, 3-6 `swatches` as `#rrggbb`, `fonts`, and a
one-line `note` tying it to the tone words. The page draws the agreed home in each. The
user's pick sets `feel.pick`; a note on a tile proposes, and changes nothing until asked.

## The token file

`docs/vision/design/tokens.css` is the only token file:

```css
/* PROVISIONAL — envision R5, source: quiet-ledger */
:root {
  --color-bg: #f7f5f0; --color-ink: #2b2a27; --color-accent: #46664f;
  --font-body: Georgia, serif; --text-body: 16px; --leading-body: 1.5;
  --space-1: 4px; --space-2: 8px; --space-3: 16px; --space-4: 24px;
  --radius-1: 4px; --radius-2: 8px; --radius-3: 16px;
}
```

- The header is `/* PROVISIONAL — envision R<n>, source: <tile id | adopted path |
  impeccable | claude-design> */`, `claude-design` once values come back from claude.ai.
  It becomes `LOCKED` only when the user says lock in chat, which also sets
  `feel.locked: true`.
- Prototypes mirror it; none keeps values of its own.
- If impeccable later writes a `DESIGN.md` that supersedes it, propose adopting that.
  Never overwrite either file.

## Never write

- The root `DESIGN.md`, `PRODUCT.md` or anything in `.impeccable/`: impeccable's init and
  document own them.
- `docs/design_files/` or `docs/design-files/`: those are human design exports.
- A second token file (a staged copy for claude.ai is a publish input, not the look).

## Prototypes

- **First look**, after a tile pick: 1-3 screens of the one flow.
- **Detail**, `/envision detail <feature>`: every state, plus 2-3 interaction variants behind
  a `data-variant` switcher (buttons wired with `addEventListener` that set the attribute;
  CSS shows the match). The user's variant pick is applied to `board.json` like any answer.

Each is `docs/vision/prototype/<flow>-<screen>.html`, started from
`$skill_dir/templates/prototype.html`, and carries design-to-code's five channels in its
numbering, with the markers `check` looks for:

| # | Channel | Marker |
|---|---|---|
| 1 | Tokens | a `:root { --name: value }` block |
| 2 | Reviewer comments | intent quoting the user, `<!-- preview before send, because "Can I see it before it goes?" (R2, said) -->`; scope, `<!-- pay button: out of scope here -->` |
| 3 | Gallery states | `<!-- PANEL 2 — Component gallery -->` over empty, one, many, error and find/change/undo |
| 4 | Vanilla JS | one inline script that wires behaviour with `addEventListener` |
| 5 | Cross-references | `/* TOKENS — mirrored from ../design/tokens.css */` |

Also: measurements and EDITMODE demo data, a visible PROVISIONAL banner, and the template's
CSP. Nothing remote: no script `src`, `<link>`, remote `url()`, `@import`, network call,
frame or embed, no `on…=` handler and no `javascript:`; images and fonts are `data:`.
Reaction controls stay on the board.

```bash
node "$skill_dir/scripts/render.cjs" bake docs/vision/prototype/<file>.html   # after a script edit
node "$skill_dir/scripts/render.cjs" check docs/vision/prototype/*.html
```

`check` exits 1 with one `<file>: <code>: <reason>` line per problem; fix each, run again.
`bake` needs exactly one inline executable script; the EDITMODE JSON block does not count.
