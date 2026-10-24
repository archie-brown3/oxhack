# Screens

The five screens of the phase 1 mockup (task 10) and the end screen, with their theme and parts. World and Engine are where you play. The sheets are where the clock speaks.

| Screen | Theme | Built from | Notes |
| --- | --- | --- | --- |
| **World** | Stage | `WorldScreen`, `QuarterClock`, `FutureChip`, `Ticker`, `TimeBar`, `GlobeMarks` | The globe takes about 78% of the height, with four corners. A `Newsflash` appears over the right of the globe at turning points. |
| **Engine** | Stage | Same corners. The centre swaps the globe for the society panes, all `dc-panel`, every item `SIMULATED`. | The clock and time bar stay. The X feed, government and news, and cast and graph sit under `eyebrow` tabs. The overlay variant is the same panes as a sheet over the globe. |
| **Why this time?** | Paper sheet over a dimmed globe | `StatementSheet` | Four tabs (Anchors, Fan, Date, Hand). The lead column holds the clock thumbnail, and the story column holds the step. It ends with "A prediction, not a prophecy." |
| **Track record** | Paper sheet | `TrackRecordCard` grid | One card per backtest checkpoint T. It scores the panel against the market and a coin, never the date. |
| **End / Replay** | Stage, globe frozen at the selected quarter under `scrim` | `ReplaySpine` | One node per turn. The selected quarter is in `numeral-xl`, and the story of that move is on the right with its labels. |

## Calls this proposal changes

These differ from the task 10 spec or the current prototype, so the owner should decide on each.

1. **REAL turns from amber to `ink`** (solid dot, solid ring). Hue then means only the two sides and SIMULATED. Amber exists nowhere in the Bulletin's palette, and white reads as "the record".
2. **Panels go square.** HUD panels drop from 14px to 3px (`radius-1`), and buttons go to 0.
3. **The countdown moves from mono to tabular sans** (`countdown`). Mono stays for ids and timestamps.
4. **Why this time? and Track record become Paper sheets.** A light sheet over the dimmed globe borrows the Bulletin's statement and makes them feel like the institution speaking.
5. **The time bar becomes the Bulletin spine.** The selected quarter grows to bold italic as you scrub, and today is a ring.
6. **The End screen becomes the Bulletin timeline**, a vertical spine of turns with the story on the right, in place of a plain list.
7. **The ground goes neutral black** (`#0b0b0b`) instead of blue-black (`#05070b` with a radial glow), as on the Bulletin's darkened photos.
