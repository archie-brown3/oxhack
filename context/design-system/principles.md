# Principles

These rules come from the two references. The Bulletin's Doomsday Clock timeline (thebulletin.org/doomsday-clock/timeline, read with Firecrawl on 24 Oct 2026, with computed styles and four screenshots) leads. The Plague Inc board (22 Steam screenshots grouped into nine patterns) supplies the game layer.

## From the Bulletin timeline

| Rule | What the Bulletin does | Where it lands |
| --- | --- | --- |
| **The reading is the headline.** | "85 Seconds to Midnight" is the biggest sans line on the page (40px bold), and every card repeats it: "IT IS 85 SECONDS TO MIDNIGHT". | `reading` under the face. Cards and thumbnails carry "It is 6 minutes to midnight". |
| **Only the last quarter matters.** | The clock glyph is a partial face, and the hand sits near the top. | The quarter face: 0–15 minutes, one minute for one year. |
| **One spine, fisheye years.** | A 1px white line with nodes. Minor years are 15px grey, change years 36px bold, and the active year 75px bold italic with a bigger white node. | `TimeBar` (horizontal, World) and `ReplaySpine` (vertical, End). `numeral-s`, `numeral-l` and `numeral-xl`. |
| **Split: spine and clock left, story right.** | The left column holds tabs, a clock thumbnail with a bold caption, and the spine. The right column holds a bold headline, 20px body and one "Read the … statement" link. | `ReplaySpine` and `StatementSheet` keep the split. |
| **Darken the picture, don't decorate it.** | Full-bleed archival photos under a 60% black overlay, with white text straight on top. No cards or panels. | The globe is our photograph. `scrim` sits at 0.64, and Paper sheets dim the globe rather than hide it. |
| **A serif only for the institution.** | Section titles are PT Serif 60px regular, centred between two short oxblood rules. Everything else is sans. | `display-1` between 360px `oxblood` rules, on Paper only. |
| **One red, used sparingly.** | #851618 for the banner, buttons, rules and the active tab. Text on dark photos is #f1f1f1, not white. | `oxblood` as fill. `ink` on the Stage is #f1f1f1. |
| **Square and flat.** | Buttons are 0 radius and outlined in oxblood. Statement cards are white on #f1f1f1 with a faint shadow. | `radius-0`, `dc-btn--outline`, `TrackRecordCard`, `lift` on Paper. |
| **Caps tabs for chapters.** | "THE CLOCK SHIFTS · CULTURE & THE CLOCK · STATEMENTS" at 14px bold caps, active white, inactive grey. | `eyebrow` tabs: World / Engine, Anchors / Fan / Date / Hand, Moves / Society / Track record. |
| **The statement is the source of truth.** | Every year links to its statement PDF ("Read the 1963 statement"). The grid of statements is its own section. | Every claim links to its source: an AIID id, a market, a MiroFish run. Track record is the statements grid. |
| **The current reading is always on screen.** | The masthead carries "IT IS 85 SECONDS TO MIDNIGHT" with the glyph on every page. | The clock corner never hides, on World, Engine or under a sheet. |

## From the Plague Inc board

| Pattern | Kept as |
| --- | --- |
| 01 · The map fills the screen with four HUD corners, about 10% chrome. | `WorldScreen`: the globe takes about 78% of the height, with four corners `space-5` from the edges. |
| 02 · Spread shows as dot density. | Hex-dot globe. The share of a region's dots lit `alarm` is Rogue influence, and the share lit `ward` is oversight (`GlobeMarks`). |
| 03 · Bright arcs only at the moment of spread. | An arc draws once in `alarm`, then fades to a faint route. |
| 04 · Bubbles to click on the map. | Rings on the globe: solid for real incidents, dashed `sim` for simulated posts, and a `ward` bubble for political capital (a game rule). |
| 05 · Newsflash cards, rare. | `Newsflash` with an oxblood band and a serif headline. It closes itself after 4 s and never needs an OK. |
| 06 · Versus in one strip; opponent log at the edge. | `VersusStrip` at the top centre and the last three moves on the left edge, both phase 2. |
| 07 · Dated history beside a trend graph. | The End screen is `ReplaySpine`: a dated move list as the Bulletin timeline, with the chart one tab away. |
| 09 · One status phrase and an ETA. | The reading plus "until Dec 2032". A world-alarm stage label can sit under it later. |
| Skip: menus, bevelled red chrome, satellite map, tiny caps. | No menus, flat square panels, no texture, and nothing under 12px. |
