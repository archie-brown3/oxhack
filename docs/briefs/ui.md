# ui brief: phase 1 mockup → build

Owner: the Lead. Updated 24 Oct 2026, 22:10 BST. This brief replaces the earlier messages to ui; where they conflict, this wins.

## What we're building (phase 1)

A **Monte Carlo simulation**, not a game.
- The engine runs **10,000 futures** from real, timestamped data.
- A Plague Inc-style **World** view plays **one sampled future at a time**.
- An **analog Doomsday Clock** reads the forecast.
- The MiroFish society is visible in a separate **Engine** screen.
- The game (Guardian vs Rogue AI) is phase 2, on the same screen. Keep its slots empty: the left edge, the top-centre strip, and a red/blue "your timeline" hand.

## Design system (binding)

`context/design-system/README.md` and `tokens.json`, from Archie's artifact (https://claude.ai/artifact/VGsoVrzhbyFcnM1otCMgJN, the source of truth).

- **Themes:** Stage (dark) is for World and Engine. Paper (light) sheets slide over the dimmed globe for Why this time?, Track record and Inputs.
- **Colour:** monochrome Stage.
  - `alarm` means only "toward midnight". `ward` means "away from midnight".
  - `sim` is used only for SIMULATED content, drawn hollow or dashed.
  - `oxblood` is a fill only.
- **Type:** PT Serif only for statements. `display-3` is the only serif on Stage. The countdown is set in `countdown` with tabular figures.
- **Clock:** a tick-marked last-quarter face, 1 min = 1 year.
  - white tapered hand (the real forecast)
  - grey lag band
  - dashed `ink-3` tick for the Bulletin's 85 s
  - `alarm` midnight dot
  - Never copy the Bulletin's mark.
- **Time spine:** a 1px `ink` line. Solid for the past, dashed `sim` for the future. Node sizes per the README; `numeral-xl` for the active year.
- **Labels:** REAL / SIMULATED / GAME RULE, plus `mock` for invented numbers.
- **Shape and motion:** square corners. Motion follows the README: a 600 ms sweep, a newsflash that closes itself after 4 s, and support for reduced motion.
- Generate CSS custom properties from `tokens.json`. Never hand-copy values.

## Screens

1. **Inputs: "What the engine knows."** The first demo step.
   - Shows all seed data, each item dated and sourced: market anchors (price history, traders, links), AIID incidents, government events, datacentres.
   - An **"as of" slider** hides everything after the chosen date, which proves there's no leakage. Data comes from the `asOf(T)` module (task 14).
2. **World (Stage).**
   - The globe takes about 78% of the height. A 4-corner HUD:
     - the large clock top-left (Archie's pick)
     - World | Engine top-centre
     - the watched-future chip top-right, with Roll and Early/Typical/Late. Typical is ranked over all futures (Archie's pick).
     - the ticker over the time spine at the bottom
   - Clickable event bubbles: REAL (AIID) or SIMULATED (MiroFish).
   - A newsflash for turning points only.
3. **Engine: a separate screen** (Archie's pick).
   - The MiroFish society for the watched future: the simulated X feed, government events and news (only these three are simulated), the cast and their roles, the knowledge graph, and run stats (rounds, actions, time, cost).
   - **Two states, clearly marked:** LIVE (a run streaming in, task 16) and RECORDED (from the replay library, with seed and run id, task 11).
   - **Expand to full screen** (Archie, 22:25): the cast and the knowledge graph can each be expanded to fill the screen, to show the MiroFish engine in full.
     - It's a maximise toggle on the panel, plus `F` for the panel in focus and `Esc` to close. Use CSS (a fixed panel at `inset: 0`), not a new route.
     - The graph re-fits to the new size. The cast becomes a full roster: role, country and stance per agent.
4. **Why this time? (Paper).** Anchors → Monte Carlo fan of 10,000 futures → 1-in-10 date → the hand. Ends with "A prediction, not a prophecy."
5. **Track record (Paper).** Market Brier against a 50% coin and the base rate, with CIs, a reliability curve and n. The caveats are visible.

## Specific context, always (Archie, 22:30: the main problem to solve)

The experience fails if events happen, or the clock moves, without a specific reason on screen. Be as specific as possible.

- **Why the clock moved:** every time the hand moves, show a callout under the clock built from the frame's `drivers`. Example: "Hand moved **4 months toward midnight**: Manifold 'ASI by 2030' rose **36% → 41%** (12 Mar 2026, 214 traders) [link]". List the top 1–3 drivers, plus "other: N days" for the residual. Only market moves are causes.
- **What happened:** every event shows who, what, where and when, plus its source link and provenance label, using `WorldEvent.detail`, `who`, `where` and `ts`. Example: "US Commerce Dept (BIS) published export rule 2026-04112 restricting AI chips to China · 3 Feb 2026 · Federal Register [link] · REAL". Never show a vague headline alone.
- **Events are context, never causes.** When an event lands in the same frame as a clock move, show it as "around the same time". Never "because of".
- **Major events on the main UI:** when a `major` event lands (real or simulated), show it on the World screen itself, not only in the ticker. Use the newsflash band (a `display-3` headline, then the specific detail line, then the source) and flare the country on the globe. Simulated majors carry the SIMULATED label and the `sim` style.
- **Account avatars:** every X-feed account and every government and news source shows its avatar from `doomclock/web/public/avatars/` (the assets agent is producing them; until then, monogram placeholders).

## The demo path (judge, about 3 minutes)

Inputs (with the as-of slider) → **Run live** (the Monte Carlo in the browser, plus one live MiroFish quarter streaming into Engine, with a recorded fallback) → **Replay** recorded futures on the globe → Why this time? + Track record.

## Mockup approved (23:10): Lead rulings on the design-system conflicts

- **Track record:** market vs coin vs base rate, as the brief says. There's no panel at w=0.
- **Accepted:** land capped at `ink-2`, the 12 px floor, the 48 px dock numeral, Inputs as a third top tab, the why callout to the right of the clock, and monochrome monogram avatars.

## Open decisions (Lead defaults, pending Archie)

| Decision | Default |
|---|---|
| Opening | Auto-replay Oct 2024 → today at 2x, with a Skip control |
| Scrubbing back | The clock is fixed at today's forecast for now. Historical replay (the clock as of each past quarter) is a stretch goal, once `asOf(T)` lands |
| Reactive globe (task 12) | A country impact score from dated, located events, decaying over time, with ripples when an event lands. Magnitudes are labelled GAME RULE. Plan only, not in the mockup until approved |
| Engine form | The separate screen stays. The overlay variant remains behind the review pill for comparison |

## Data available now

- Datacentres: Epoch's 77 (`data/clean/datacentres.jsonl`). `data/clean/datacentres-public.jsonl` (all publicly mapped sites) is still being built; swap it in when it lands, labelled "publicly mapped sites, not compute share".
- Incidents: `data/clean/aiid.jsonl`.
- Real simulated posts: the spike run `sim_908b44137fec`.
- Knowledge graph: `data/mirofish/smoke/graph.json`.
- Clock date: "Dec 2032", labelled mock.

## Scope and rules

- **Mockup:** `.lavish/prototype/**` only, reviewed in Lavish.
- **Build** (after approval): `doomclock/web/src/ui/{world,clock,why,track,inputs,engine}/**`.
- Render a `Timeline` and `ClockReading` (`contracts.ts`), never game state. Import the engine; never port `sim.ts` into the UI again.
- Check your own work with headless screenshots, and don't open windows on Archie's screen repeatedly.
- No paid calls, no MiroFish POSTs and no commits (the Lead commits).
