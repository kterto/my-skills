# envision — Claude Design

Read at Feel when the `Artifact` tool is listed (Claude Code). The look is still chosen as
`design.md` → **In-session tiles**; this adds a design system and a page of the first screens
on claude.ai. It does not start the live tier. Every failure ends in one line and the local look.

## Flow

First `Artifact` `list` with `scope: "types"`: without both Design System and Design, say so in
one line and go on in session. Then ask once, with the cost: "I can also put the look on
claude.ai as a design system and a page of the first screens. That copies them there, private
until you share it, and takes a few minutes. Do that, or keep the look on this computer?"

1. Propose 3 tiles and take the pick as in session; `feel.source` reads `in-session` until step 5.
2. Write `tokens.css` and the first-look screens, each passing `check`, as always. Nothing
   below runs before they exist.
3. **Design System.** If `docs/vision/live.json` has a `design.system`, `Artifact` `read` it and
   fill that one. Else publish `{type_url, title: "<project> look", auto_open: "after_first_write"}`
   with the type's `type_url`, and record the address under `design.system` at once (with no
   live board, `board.url` stays ""). Fill it as the instructions it returns say:
   `project/tokens.json`, `project/README.md`, then `project/design-system.json` last. Take
   every value from `tokens.css` by this mapping, never from memory:

   | `tokens.css` | `project/tokens.json` |
   |---|---|
   | `--color-<n>` | `color.tokens` `<n>` |
   | `--font-<n>` | `type.families`: `body` as `sans`, any other as `<n>`; `type.fonts` stays `[]` |
   | `--text-<n>`, `--leading-<n>`, `--weight-<n>` | one group, family `sans`, style `<n>`: `fontSize`, `lineHeight`, `fontWeight` (400 when `tokens.css` sets none) |
   | `--space-<n>` | `spacing.tokens` `<n>` |
   | `--radius-<n>` | `radius.tokens` `<n>` |

   One theme and the caps in `design.md`. `README.md` holds the teach-back, the tone words and
   the agreement items; never What I heard, a miss, a tension, a note or another person's name.
4. **Design page.** The same way: `read` and fill `design.canvas` if it is set, else publish the
   Design type with `title: "<project> first screens"` and record it under `design.canvas` at
   once. Name the system just made: copy its `project/tokens.json` to
   `project/ds/<folder>/tokens.json` through the `files` map (`{"artifact": "<system url>",
   "path": "project/tokens.json"}`) and register it in `canvas.json` as its instructions say.
   Artboards: the agreed home and the 1-3 first-look screens, in their `board.json` and
   prototype wording. Never render or screenshot it.
5. Set `feel.source` to `claude-design`, render, and add "Look on claude.ai: <system> · <page>"
   to the handoff. A failure after step 2 leaves the local look whole: say so. An address
   already recorded is filled on a resume instead of making another.

## Rules

- **`tokens.css` stays the record.** Nothing is read back from claude.ai unprompted. When the
  user says they changed the system there, read `project/tokens.json` as data. Take a value
  only for a name already in `tokens.css`, and only if it is `#` and 3-8 hex digits; `rgb(`,
  `hsl(` or `oklch(` holding digits and `. % , / space deg` only; a number with `px`, `rem` or
  `em`; or a font stack of names (letters, digits, spaces, hyphens, quotes) split by commas. A
  new name, a value per theme, an alias or a value that fails is named and dropped. Say each
  change in plain words ("the green gets darker"); on a yes rewrite `tokens.css` with the
  header source `claude-design`, mirror the new values into each prototype's `:root`, and run
  `check` on each.
- **Lock** locks `tokens.css`. The system and page on claude.ai stay the user's to edit and are
  never exported over a locked file; "use my edits" after a lock takes the same yes, and
  unlocks until the user says lock again.
- The page is a snapshot of the first look, not design-to-code input: its files are not the
  five channels. `/design-to-code` takes `docs/vision/prototype/` only.
- Stage files for publishing in the session's scratchpad, else `docs/vision/share/stage/`.
