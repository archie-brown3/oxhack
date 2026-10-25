# OxHack 2026: Doom Clock

## Coding priority: shared task board

**`.taskmaster/tasks/tasks.json` is the main priority and shared source of truth for
agent coding work. Every coding change must follow a task in this file.** Read it before
starting, identify the task ID, and follow its scope, priority, dependencies, acceptance
checks and review gates. Work on active, unblocked tasks; do not implement deferred or
cancelled work. If requested coding work has no matching task, add or update a task before
implementing it. Explicit owner instructions take precedence; reflect any changed scope in
the task board.

Keep task status and relevant implementation or verification notes current, and commit and
push task-board updates with the related work so the whole team has the same context.
All files under `.taskmaster/tasks/` must be tracked by Git and pushed; never ignore task
files or leave task updates local-only. Only machine-local CLI state and claims are ignored.
Use the tasks CLI against this repo's `.taskmaster/tasks/tasks.json`; do not keep a separate
local task list. Specs still define correctness, and the rules below still apply; the task
board determines what to code next. `CLAUDE.md` links to this file, so these instructions
apply to both entry points.

We are building the **Doom Clock**: AI risk made visible, run on real data. The world starts
from today's real prediction-market odds and AI news. A model turns them into a countdown: the
clock reads the model's catastrophe curve exactly, and a Monte Carlo of 10,000 futures drawn
from the same model gives the futures the globe replays (they agree with the clock within 1 pt).
MiroFish plays out 3 futures as a simulated society on X, recorded ahead of the demo on real
MiroFish (own Zep graph per future, its report agent per 6-month step). Its events and reports move
that future's clock by labelled game rules; nothing moves the real clock. Spec:
`docs/superpowers/specs/2026-10-25-doom-clock-coupled-loop-design.md`.

- **The forecast**: market odds and the Monte Carlo. The backtest scores the market inputs out
  of sample and sets the weight `w` for a blind LLM baseline (it chose `w = 0`).
- **The game layer is dropped** (owner, 25 Oct). Don't build cards, the Rogue or "your timeline".

## Where things live

- **Brief (source of truth):** Notion page "⏰ Doom Clock" under OxHack:
  https://app.notion.com/p/45a9a3b74a37472884408f8b9eafd39b. It holds the moves, the data
  sources and scraping strategy, the HRT fit, and the open decisions.
- **Specs:** `docs/superpowers/specs/`.
  - Engine: `2026-10-24-ai-doom-clock-design.md`. Its backtest section has two known leakage
    bugs; see "Rules" below.
  - Still to be written: `…-doom-clock-game-layer-design.md`, `…-doom-clock-backtest-design.md`
    and `…-doom-clock-globe-ui-design.md`.
- **Design system:** `context/design-system/`. Read its `README.md` before any UI work, mockup
  or code. It sets the voice, the Stage and Paper themes, colour, type, layout, the clock, the time
  spine, the provenance labels and motion.
  - `tokens.json` holds every token. Generate CSS from it with
    `node .lavish/prototype/gen-tokens.mjs`, and never hand-copy a value.
  - `principles.md` says what we took from the Bulletin and from Plague Inc. `screens.md` gives
    each screen's theme and parts. `components/<Name>/README.md` holds each component's rules,
    and `components/bundle.js` has `DoomClock.face()`, which draws the clock.
  - It is a copy of Archie's design-system artifact,
    https://claude.ai/artifact/VGsoVrzhbyFcnM1otCMgJN, which is the source of truth. `SOURCE.md`
    records the version and how to re-copy it.
- **UI brief:** `docs/briefs/ui.md`, the Lead's phase-1 brief. It covers the screens, the demo
  path and the open UI decisions.
- **Reference facts:** `context/`, indexed in `context/README.md`. This covers the design system,
  the hackathon slides, the data sources checked on 24 Oct, Plague Inc research and the Bulletin
  2026 statement. Ideas don't go here.
- **Mockups:** `.lavish/`. `prototype/` is the phase-1 mockup, `globe-options.html` has the globe
  styles and layouts, `plague-board.html` is the Plague Inc UI board (artifact:
  https://claude.ai/artifact/Qk9XBx7PydgjhgiJbvxPLd) and `ideas.html` holds the early mockup.
- **Old ideas and research:** `swarm/`, which is gitignored.
- **Judging:** `.claude/skills/judging-criteria-review/` (`/judging-criteria-review`).
- `web/` is the Haggle app, kept frozen as a fallback. Don't change it.

## Build

- New code goes in `doomclock/`, in TypeScript throughout:
  - `doomclock/pipeline/`: Node. It fetches data, runs the panel and the backtest, and writes
    `state.json` and `backtest.json`. It includes a small `node:http` server.
  - `doomclock/web/`: Vite + React. The engine (`src/engine/`, seam `index.ts`: `buildTimeline`,
    `readClock`, `worldFrom`) runs in the browser. It runs the Monte Carlo (`sim.ts`, a pure
    function with a seeded RNG).
- Globe: globe.gl / react-globe.gl on a dark sphere with Natural Earth 110m GeoJSON. It needs no
  texture and works offline.
- **LLM:** calls go through OpenRouter. The panel, the blind baseline and the Rogue use
  `google/gemini-2.5-flash` (cutoff 2025-01-31), so the backtest's earliest T is about 2025-03-01.
- **News:** Hacker News is dropped. The replacement (Guardian/NYT archives, GDELT, or both) is
  undecided. The AI Incident Database is the primary event source.
- **MiroFish:** Twitter (X) only, no Reddit (owner, 24 Oct). Only three kinds of thing are
  simulated: government events, the X feed and news. One game turn is one MiroFish run, and
  each run starts from an empty world, so continuity goes in through `initial_posts`. Patches
  live in `patches/`.
- **Plan:** owners, write scopes, tasks and gates are in
  `docs/superpowers/plans/2026-10-24-doom-clock-build-plan.md`. Specs override the plan.

## Rules

- **Clean data:** each source we use goes into `data/clean/<source>.jsonl`.
  - Every record carries `ts`, the ISO time it became public, and the file is sorted by `ts`.
  - Point-in-time code filters on `ts < T`.
  - Records that can't be timestamped are dropped.
  - Each source's schema and filters are in `docs/data/<source>.md`.
- **Data:** call APIs only, never scrape HTML. Save every response to
  `data/raw/{source}/{fetched_at}.json` before parsing it. Pin market IDs in `markets.json`.
  If a live fetch fails, serve the last good `state.json` and show its timestamp.
- **No leakage in the backtest:**
  - Fetchers take a date T and read only data from before T.
  - Choose T without looking at the outcome.
  - Count a question only if the model's cutoff + 1 month ≤ T.
  - Split by date: the earlier half picks `w`, the later half reports the score.
  - Report the result honestly, even when `w = 0` wins.
  - The backtest scores only the panel's adjustments, against the market price and a 50% coin.
    The countdown date itself can't be scored, so never claim that it was.
- **Effect sizes:** any move effect that no market or dataset backs is labelled a "game rule" in
  the UI. Never present one as a forecast.
- **Tests:**
  - `sim.ts`: the same seed gives the same output, and the sampler hits the market points.
  - Backtest: the price-at-T lookup and the Brier maths, checked on a fixture.
  - Panel: bad JSON gives a zero nudge.

## Deadline

Hacking runs until Sun 25 Oct 12:00. The clocks go back at 02:00 Sunday, which gives us 25
hours. The Devpost workshop is Sun 09:00 and judging is 13:00–15:45. Main track: HRT "Best use
of Data for Predictions & Decision Making". Theme: TIME. Cut scope before the deadline slips.
