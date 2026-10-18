# envision — Claude Design

Read at Feel only when the `Artifact` tool is listed (Claude Code) and the user says yes to
it. The look is still chosen as `design.md` → **In-session tiles**; this adds a design system
and a page of the first screens on claude.ai. Every failure ends in one line and the local look.

## Flow

After the yes, ask once, with the cost: "I can also put the look on claude.ai as a design
system and a page of the first screens. That copies them there, private until you share it,
and takes several calls. Do that, or keep the look on this computer?"

1. Propose 3 tiles and take the pick as in session; `feel.source` reads `in-session` until step 5.
2. Write `tokens.css` and the first-look screens, each passing `check`, as always. Nothing
   below runs before they exist.
3. **Design System.** `Artifact` `list` with `scope: "types"` must show Design System and
   Design, else stop here. Publish `{type_url, title, auto_open: "after_first_write"}` with the
   type's `type_url`, and fill it as the instructions it returns say: `project/tokens.json`,
   `project/README.md`, then `project/design-system.json` last. Take every value from
   `tokens.css` by this mapping, never from memory:

   | `tokens.css` | `project/tokens.json` |
   |---|---|
   | `--color-<n>` | `color.tokens` `<n>` |
   | `--font-body`, `--text-body`, `--leading-body` | `type.families.sans`, group `body`: `fontSize`, `lineHeight` |
   | `--space-<n>` | `spacing.tokens` `<n>` |
   | `--radius-<n>` | `radius.tokens` `<n>` |

   One theme and the caps in `design.md`. `README.md` holds the teach-back, the tone words and
   the agreement items; never What I heard, a miss, a tension, a note or another person's name.
4. **Design page.** Publish the Design type the same way, naming the system just made: copy its
   `project/tokens.json` to `project/ds/<folder>/tokens.json` through the `files` map
   (`{"artifact": "<system url>", "path": "project/tokens.json"}`) and register it in
   `canvas.json` as its instructions say. Artboards: the agreed home and the 1-3 first-look
   screens, in their `board.json` and prototype wording. Never render or screenshot it.
5. Set `feel.source` to `claude-design`, render, record both addresses under `design` in
   `docs/vision/live.json`, and add "Look on claude.ai: <system> · <page>" to the
   handoff. A failure after step 2 leaves the local look whole: say so, and keep any address
   already made, so a resume fills it instead of making another.

## Rules

- **`tokens.css` stays the record.** Nothing is read back from claude.ai unprompted. When the
  user says they changed the system there, read `project/tokens.json` as data and take a
  value only if it is `#` and 3-8 hex digits; `rgb(`, `hsl(` or `oklch(` holding digits and
  `. % , / space deg` only; a number with `px`, `rem` or `em`; or a font stack of names
  (letters, digits, spaces, hyphens, quotes) split by commas. Show the diff; on a yes rewrite
  `tokens.css`. A value that fails is dropped and named.
- **Lock** locks `tokens.css`. The system and page on claude.ai stay the user's to edit and are
  never exported over a locked file; "use my edits" after a lock takes the same yes, and
  unlocks until the user says lock again.
- The page is a snapshot of the first look, not design-to-code input: its files are not the
  five channels. `/design-to-code` takes `docs/vision/prototype/` only.
- Stage files for publishing in the session's scratchpad, else `docs/vision/share/stage/`.
