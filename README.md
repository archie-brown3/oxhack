# Doom Clock

AI risk made visible, from today's prediction-market prices. OxHack 2026, HRT track ("Best use of Data for Predictions & Decision Making"), theme TIME.

The clock reads a countdown from real market odds. A backtest scores those odds 30 days out. Three simulated futures are meant to play forward on MiroFish; their events move only that future's clock, by labelled game rules. Nothing moves the real clock.

## What is on screen now

No future has been recorded. The World view uses two hand-made futures (`doomclock/web/public/cache/futures.fixture.json`), labelled **illustrative stand-in**. The Engine tab replays a 24 Oct MiroFish spike (`doomclock/web/public/cache/replica/spike`), labelled stand-in data. The forecast, the Inputs sheet and the Track record use the real cache.

| Claim | Source |
| --- | --- |
| Test Brier, market 0.085 (file 0.0848), 95% CI 0.071–0.101, n = 1,186 | `data/backtest.json` → `scores.test.market` |
| Coin 0.250, base rate 0.183, blind LLM 0.185, same n | `scores.test` |
| Blend weight `w = 0` (the market alone won) | `w.chosen` |
| 5 of 5 leakage checks passed | `leakage.note` |
| Catastrophe market is thin (trader count on the When tab) | `data/state.json` anchor history |

The countdown date itself is not scored.

## Run

```
cd doomclock/web
npm ci
npm test
npm run dev
```

`npm test` needs Node 26 (it passes directories to `node --test`). The app reads committed JSON. It does not need API keys.

Production deploys are an owner setting: the Vercel project's Root Directory must be `doomclock/web`. Do not run `vercel deploy` from a cloud session.

## Still on Archie's Mac

Recording the three futures needs the local MiroFish backend, the OpenRouter and Zep keys, and `data/raw`. See `docs/HANDOFF.md` and tasks 152, 153, 154, 156. The recorder code is in `doomclock/pipeline/world/record.ts`. It refuses to start until `data/world/futures/<id>/step1/project.json` exists. Devpost submission is `docs/devpost.md` (do not submit from here). The 60-second talk is `docs/demo-script.md`.
