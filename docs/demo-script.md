# 60-second demo script

Say only what is on the screen. Times are a guide. The forecast and the Track record are real. The futures and the Engine are stand-ins until a recording exists.

0:00 World, today. "This clock reads prediction markets. Midnight is not a prophecy. It is the date those market prices, plus one labelled game rule, reach a 1-in-10 chance of an AI catastrophe. The hand is the real forecast. The number of traders is on the Why sheet, and the catastrophe market is thin."

0:15 Inputs. Drag the date back to mid-2025. "The globe and the news drop anything that was not public yet. The count of incidents falls. That is the same file, filtered by time."

0:30 Press play on Future 1. "This future is an illustrative stand-in, two hand-made scenarios, not a recorded MiroFish run. The caption says so. Pings are simulated. Effects that no market backs are marked game rule. They move this future's hand only."

0:42 Click a ping, then Why. When: the four prices and the trader counts. How dangerous: the report text, labelled simulated, and on this build it is the 24 Oct spike, not this future. Track record: "On 1,186 later questions the market's Brier is 0.085 against 0.183 for always guessing the base rate and 0.250 for a coin. A blind model did not beat the market, so its weight is zero. We do not score the countdown date."

0:55 Engine. "This is a replica of MiroFish's own screens, from a saved spike, labelled stand-in. Graph, Split and Workbench. It does not start a live simulation."

If asked whether MiroFish ran for real: "Yes, this morning. All three graphs built, and step one of two futures ran five rounds on simulated X, 136 and 119 posts, saved in the repo. Zep Cloud timed out storing them, so there is no report, and we show nothing from it as a result."

## Owner, still to do

- 140: play the judge path once on production and note any must-fix bug.
- 142: submit `docs/devpost.md` on Devpost by 11:45 GMT. Attach a screen recording.
- 143: prepare the demo machine (checklist below) and rehearse this script twice, once offline.
- 144: the judged demo, 13:00–15:45.

## Demo machine checklist (143)

- Open production: https://doomclock-web.vercel.app. Close every other tab and app with notifications.
- Browser fullscreen, zoom 100%. Check the clock, globe and Why sheet all fit before judges arrive.
- Offline fallback: `~/Desktop/doomclock-final-2026-10-25.zip` holds the built `dist/`. Unzip it, then run `python3 -m http.server 8080 -d dist` in the unzipped folder (or `npx vite preview` from `doomclock/web` after `npm run build`, which serves http://localhost:4173) and open http://localhost:8080. Start it before the demo so it is ready.
- If Wi-Fi drops: switch to the localhost tab. The app reads committed JSON and makes no external requests, so it behaves the same.
