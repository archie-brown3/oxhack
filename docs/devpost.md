# Devpost draft (do not submit)

Owner task 142 submits this. Workshop 09:00 GMT, submit by 11:45 GMT, hacking ends 12:00 GMT on Sun 25 Oct 2026.

## Title

Minutes to Midnight

## Tagline (elevator pitch, 156 chars)

A countdown to the date prediction markets put AI catastrophe at 1 in 10. The hand reads real odds, a Monte Carlo replays 10,000 futures, and a backtest shows the track record.

## What it is

The clock is a countdown to the date when prediction markets put the chance of an AI catastrophe at 1 in 10. The hand reads those prices. A Monte Carlo uses the same model. Drag Inputs back in time and the globe, the news and the hand use only what was public by that date.

Beside that, two illustrative futures show the shape of a coupled loop: a simulated society (MiroFish) plays six months, a report says how dangerous that period was, and labelled game rules nudge that future's clock. Those futures are a stand-in. They are not a forecast, and they do not move the real clock.

## How

- Market prices from Manifold, Polymarket and Kalshi, pinned in `markets.json`, cleaned to `data/clean/`.
- Events from the AI Incident Database, plus government and reference records that carry a public timestamp. Records that cannot be timestamped are dropped.
- The backtest scores the price 30 days before resolution, on questions whose forecast date is on or after 1 Mar 2025. The earlier half picks the blend weight. The later half is the score. A blind LLM (`google/gemini-2.5-flash`, cutoff 31 Jan 2025) is the other arm.
- The simulated loop is specified in `docs/superpowers/specs/2026-10-25-doom-clock-coupled-loop-design.md`. The Engine tab is a replica of MiroFish's own screens, played from a saved run. It never starts a simulation.

## The numbers, from `data/backtest.json`

Generated 25 Oct 2026 00:21 UTC. Test half, n = 1,186 questions:

- Market Brier **0.0848** (about 0.085), 95% CI 0.071–0.101
- Base rate 0.183
- Blind LLM 0.185
- A 50% coin 0.250
- Chosen blend weight **w = 0**. Adding the blind model did not help.
- Leakage checks: **5 of 5 passed**

The countdown date is not one of these scores. The catastrophe market is thin; the When tab shows the trader count next to the price.

## What a judge sees

The real forecast and the Track record are real. The two futures and the Engine graph are labelled stand-ins (an illustrative pair, and a 24 Oct MiroFish spike). Three recorded futures are the next step, on a machine that has the MiroFish backend. Do not describe the stand-in clocks as results.

## Built with

TypeScript, Vite, React, globe.gl, MiroFish (replica of a saved run). No scrape of HTML. Live fetches, when they run, save the raw response first.
