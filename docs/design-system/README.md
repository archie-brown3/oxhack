Doom Clock looks and talks like the Bulletin of the Atomic Scientists' Doomsday Clock and plays like Plague Inc. Black, white and one oxblood carry the look. A serif speaks only when the clock makes a statement, and the globe fills the screen. Everything here serves one job: make a forecast built from real data feel as weighty as the Bulletin's clock, and never let a game rule pass for a forecast.

## Voice

- Lead with the reading, in the Bulletin's formula: **"It is 6 minutes to midnight."** Title case for the reading line ("6 Minutes to Midnight"), sentence case for everything else.
- Always state the unit beside the face: "1 min = 1 year". The date follows as plain words: "until Dec 2032, when the chance of AI catastrophe passes 1 in 10."
- Write like a statement, not a game. Short declarative sentences, past tense for what happened ("An eval caught the Rogue AI's weights"), and numbers with units ("7 months toward midnight").
- Name the two sides **the Guardian** and **the Rogue AI**. Direction is always **toward midnight** or **away from midnight**, never "up" or "good".
- Close every explanation with the disclaimer, set in `display-2` italic: "A prediction, not a prophecy."
- No emoji, no exclamation marks, no "doom" puns in the UI copy.

## Two themes, one product

- **Stage** (`stage`, dark) is where you play: World and Engine. `ground` is near-black, the globe is the picture, and the HUD floats on `scrim`.
- **Paper** (`paper`, light) is where the clock makes statements: Why this time?, Track record and the end verdict. Paper slides over the dimmed globe as a sheet. It never replaces the globe.
- A Paper surface inside a Stage page sets `data-theme="paper"` on its wrapper. Never mix the two inside one panel.

## Colour

- Keep the Stage monochrome. Use `ink`, `ink-2` and `ink-3` on `ground`, `raised` and `scrim`. Land on the globe is `ink-3` to `ink`, never a hue.
- Hue means something, and on the Stage red means only **toward midnight**. `alarm` marks the Rogue AI, catastrophe, the midnight point and your timeline where it runs earlier. `ward` marks the Guardian, oversight and your timeline where it runs later. Always pair either with a word or a glyph.
- `oxblood` is the clock's voice, used only as a fill: the newsflash band, the one primary button per view, and the two rules around a sheet title. Put `on-oxblood` text on it. Never set `oxblood` as text on the Stage, where it reads at 2:1.
- Links and outline buttons use `action`. That is ink on the Stage, so red there keeps its one meaning, and oxblood on Paper, as the Bulletin does.
- `sim` is reserved for SIMULATED provenance: MiroFish posts, simulated government events and news, and the projected stretch of the time bar. Pair it with a hollow or dashed form.
- Draw hairlines in `rule`, which is decorative and below 3:1. Draw control borders in `rule-strong`. The focus ring is a solid 2px `ink` outline with a 2px offset, which holds at least 3:1 on every ground.

## Type

- Use `display-1` (PT Serif 56px) once per sheet, centred between two 360px `oxblood` rules, as the Bulletin sets "The Clock Shifts". `display-2` heads sections in a sheet and sets the verdict. `display-3` is the newsflash headline and the only serif allowed on the Stage.
- The interface face is the system sans (SF Pro on a Mac, with Roboto as the Bulletin's own fallback). Set the reading in `reading`, HUD copy in `body`, sheet copy in `body-l` at most 64 characters wide.
- Years are the Bulletin's signature. Set the selected year in `numeral-xl` (bold italic), key years in `numeral-l` and every other year in `numeral-s` in `ink-3`. Show one `numeral-xl` at a time.
- Set the countdown in `countdown`, with tabular figures, in the sans rather than mono. Keep `data` (mono) for timestamps, source ids and seeds.
- `eyebrow` (uppercase, 0.08em tracking) is for tabs and bands. `label` is for the three provenance labels and nothing else. No text goes below 12px.

## Layout

- World runs at 1440×900 first. The globe takes about 78% of the height, and the HUD is four corners, about 10% of the screen:
  - top-left: the clock
  - top-centre: World | Engine
  - top-right: the watched future
  - bottom: the ticker over the time bar
- Every corner sits `space-5` from the edges. Panels pad `space-4`, and controls in a row sit `space-3` apart.
- Leave the left edge and the top-centre strip empty for phase 2, which puts the opponent's last three moves on the left and Guardian vs Rogue AI at the top centre.
- On Paper, keep the Bulletin split: a narrow lead column (tabs and a clock thumbnail) beside a wide story column (headline, body, one link). Statement cards sit three across with `space-8` gaps on the grey `ground`.
- Corners are square. Buttons, sheets and cards take `radius-0`. HUD panels and chips take `radius-1` (3px). `radius-round` is for nodes, dots and rings only.
- Only HUD panels, the newsflash and Paper cards cast `lift`. Everything else separates with `rule`.

## The clock

- Draw only the last quarter of the face: midnight at the top, 15 minutes running anticlockwise to nine o'clock, and one minute for one year (`DoomClock.face()`).
- The white tapered hand is the **real forecast**, from engine A alone. No move ever touches it.
- Draw **your timeline** as a second, dashed hand in `alarm` or `ward`, depending on which way the moves bent it. Draw it only once phase 2 exists.
- The grey band is the 1–10 year lag range. The dashed `ink-3` tick is the Bulletin's 85 seconds (Jan 2026), labelled as theirs.
- The midnight point is an `alarm` dot. The face has no numerals beyond "5 y", "10 y" and "15 y".
- The Bulletin's clock mark is theirs and registered. Never copy its arc-and-dots drawing; ours is a tick-marked quarter face.

## The time spine

- Time is one 1px `ink` line with nodes, as on the Bulletin's timeline. On World it runs horizontally under the globe. On Replay it runs vertically on the left, with the story on the right.
- The past is solid `ink`. From today on it is dashed `sim`, because what follows today is simulated.
- Nodes: minor 5px `ink-3`, key 7px `ink-2`, selected 13px `ink`, and today a 2px ring. The selected year grows to `numeral-xl` as the scrubber or the scroll reaches it.

## Provenance

- There are only three labels: **REAL** (solid dot, `ink`), **SIMULATED** (hollow ring, italic, `sim`) and **GAME RULE** (open square, `ink-3`). Put one beside every number or claim whose source isn't obvious.
- Any move effect that no market or dataset backs is a **GAME RULE**, and is never styled as a forecast.
- Mark invented numbers with `mock` until real data replaces them.
- Track record cards show the panel's Brier against the market and a coin. The clock's reading at each checkpoint is context, never a scored claim.

## Motion

- The hand sweeps once per change, 600ms, `cubic-bezier(.2, .8, .2, 1)`. Nothing ticks or wobbles at rest except the countdown digits.
- An arc animates once when a Rogue move lands, then settles into a faint route. Motion means something has just happened.
- The newsflash appears for turning points only and closes itself after 4 s, drawing its `timer` hairline down. It never needs an OK.
- With `prefers-reduced-motion`, the hand jumps, arcs appear already drawn and the newsflash stays until it is dismissed.

## Iconography

- No icon set. The few glyphs are typographic: ✕ for catastrophe on the spine, a rotated square for catastrophe on the globe, a house for a datacentre, rings for events, and ⏎ and letter keys in `kbd`.
- No emoji, no photos and no texture on the globe. The Bulletin darkens archival photographs; we darken the globe instead (60% `scrim`) whenever Paper is over it.
