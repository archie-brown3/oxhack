# Doom Clock

AI risk made visible, from today's prediction-market prices. OxHack 2026, HRT track ("Best use of Data for Predictions & Decision Making"), theme TIME.

The clock reads a countdown from real market odds. A backtest scores AI prediction-market prices 30 days out on 2,371 resolved questions; the clock's own markets and its countdown date are not scored. Three simulated futures are meant to play forward on MiroFish; their events move only that future's clock, by labelled game rules. Nothing moves the real clock.

## What is on screen now

Production: https://doomclock-web.vercel.app (built from `main` by the repo-root `vercel.json`). No future has been recorded. The World view uses two hand-made futures (`doomclock/web/public/cache/futures.fixture.json`), labelled **illustrative stand-in**. The Engine tab replays a 24 Oct MiroFish spike (`doomclock/web/public/cache/replica/spike`), labelled stand-in data. The forecast, the Inputs sheet and the Track record use the real cache.

| Claim | Source |
| --- | --- |
| Test Brier, market 0.085 (file 0.0848), 95% CI 0.071–0.101, n = 1,186 | `data/backtest.json` → `scores.test.market` |
| Coin 0.250 and base rate 0.183 (same n); blind LLM 0.185 on n = 1,170 (replies that parsed) | `scores.test` |
| Blend weight `w = 0` (the market alone won) | `w.chosen` |
| 5 of 5 leakage checks passed | `leakage.canary.note` (5 entries in `leakage.checks`, each `passed: true`) |
| Catastrophe market is thin (trader count on the When tab) | `data/state.json` anchor history |

The countdown date itself is not scored.

## Run

```
cd doomclock/web
npm ci
npm test
npm run dev        # or: npm run build && npm run preview
```

`npm test` needs Node 26 (it passes directories to `node --test`). The app reads committed JSON. It does not need API keys.

Production builds use the repo-root `vercel.json` (install and build in `doomclock/web`, serve `doomclock/web/dist`). Do not run `vercel deploy` from a cloud session.

## MiroFish status

On 25 Oct the Step 1 graphs were built for all three futures (`data/world/futures/<id>/step1/project.json`), and the first step of futures 1 and 2 ran all 5 rounds, but Zep timed out storing them and MiroFish failed both runs (`data/world/logs/2026-10-25-zep-timeout.log`). Recording the futures is dropped for the hackathon (tasks 150, 153, 154, 156 cancelled). The recorder is `doomclock/pipeline/world/record.ts`; it needs the local MiroFish backend, the OpenRouter and Zep keys, and `data/raw` (see `docs/HANDOFF.md`). Devpost text is `docs/devpost.md` (Archie submits). The 60-second talk and demo checklist are in `docs/demo-script.md`.
