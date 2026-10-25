# Devpost draft (do not submit)

Owner task 142 submits this. Workshop 09:00 GMT, submit by 11:45 GMT, hacking ends 12:00 GMT on Sun 25 Oct 2026.

## Title

Minutes to Midnight

## Tagline (elevator pitch, 199 chars)

A countdown to the date prediction markets put AI catastrophe at 1 in 10. Agents built from real labs, regulators and news desks, with their own memories, play out three futures from today's real data.

## What it is

The clock is a countdown to the date when prediction markets put the chance of an AI catastrophe at 1 in 10. The hand reads those prices. Drag Inputs back in time and the globe, the news and the hand use only what was public by that date.

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

## Devpost story (the seven form fields)

### Inspiration

Everyone talks about AI risk, and talking about it creates no urgency. The Bulletin's Doomsday Clock works because it turns a committee's judgement into one picture anyone can read. We wanted that picture for AI, set by data rather than a panel: a clock whose hand is placed by what prediction markets, incident databases and government records say today, with a track record you can check.

The theme was TIME. A clock that counts down to a date, with a slider that hides anything not yet public, was the most literal answer we could give.

### What it does

The clock counts down to the first date on which prediction markets put the chance of an AI catastrophe at 1 in 10. Today that is around May 2032, which the face shows as 5.6 minutes to midnight; one minute on the face is one year. The hand reads the market curve exactly.

Drag the date back and everything on screen, the globe, the news feed and the hand, uses only what was public by then. The Track record tab shows how good the inputs are: thirty days before 1,186 recent AI questions resolved, the markets scored a Brier of 0.085, against 0.25 for a coin flip.

Beside today's clock, three futures play forward from 2027 to 2029. Each is a simulated society on MiroFish: 30 agents built from real labs, regulators and news desks, with their own memories and a knowledge graph per future, reacting to the news and the current odds on a simulated X. When an account with the power to act does something, a government passing a rule, a lab pausing, the incident tracker logging a new case, it becomes an event on the globe and nudges that future's clock by a labelled game rule. At the end of each six-month step MiroFish's report agent scores that world on loss of control, misuse, oversight and race pressure. Nothing a simulation does moves the real clock.

### How we built it

Data first. We call APIs only, never scrape, and save every raw response before parsing it. Prices come from Manifold, Polymarket and Kalshi, pinned by market ID; incidents from the AI Incident Database; government actions and datacentre records alongside. Every record carries the time it became public and the files are sorted by it, so point-in-time code filters on that timestamp and nothing from the future leaks in.

The engine is TypeScript in the browser: Vite and React, the clock and the timeline as pure functions, and a globe.gl sphere on Natural Earth GeoJSON that works offline. A small Node pipeline fetches, cleans, runs the backtest and writes the JSON the app reads.

The backtest is out of sample. We take the market price 30 days before each question resolved, on questions dated after the blind model's training cutoff. The earlier half of the questions picks the blend weight between the markets and a blind LLM; the later half reports the score. The markets won on their own, so the weight is zero and today's clock is the markets alone.

The futures run on MiroFish, an open-source "predict anything" engine. For each future we build a knowledge graph in Zep from a seed pack of today's news and odds, turn the entities into agents with personas and memory, and run them in parallel on the OASIS social engine for five rounds per six-month step. We patched MiroFish to run Twitter-only, write its Zep episodes in English and restart cleanly, and wrote a recorder that saves every round, so the Engine tab replays the real screens of a saved run rather than launching a simulation live during the demo.

### Challenges we ran into

Leakage. A backtest of forecasting data is easy to cheat by accident, so we wrote the rules before the code: pick the date without looking at the outcome, count a question only when the model's cutoff plus a month is before it, split by date, and report the result even if the clever part loses. It did lose: the blind LLM added nothing, and we say so on screen.

The catastrophe market itself is thin, play money with 19 traders and only a handful of trading days in two years, so we show the trader count next to the price and never claim the countdown date is scored. The backtest scores the inputs, not the date.

MiroFish was built for one run from one seed. We needed three futures with continuity across six steps, each on its own graph, in English. The Zep graph builds stalled on our first 38 KB seed pack of 115 episodes; shrinking it to 12 KB got a build through, and the first real recording ran in the final hour before submission. Where a recording is not yet in the build, the screen shows a hand-made future and says so. We dropped a whole game layer, cards and a rogue AI, in the small hours of Sunday to protect the forecast and the labelling.

### Accomplishments that we're proud of

The clock reads real data and you can see how good that data is without leaving the app: a measured Brier score with a confidence interval, a coin and a blind model for comparison, and five leakage checks, all beside the hand. Every number on screen traces to a file in the repo.

Everything is labelled by its standing: REAL, SIMULATED, RECORDED or GAME RULE. When a rule moves a future's clock, the screen says it is our rule and not a measurement, and each future shows three lines so you can see how much is the simulation and how much is dice.

And it runs offline, from committed JSON, with no API keys, which is how a demo should run.

### What we learned

Honest forecasting is mostly plumbing. Timestamps, a raw-response archive and a date split did more for credibility than any model. Reporting a weight of zero was uncomfortable and right: thirty days out, the markets beat a model reasoning blind.

Agent societies are a storytelling tool, not a forecaster. MiroFish gives you a vivid, coherent world and a report on it, but how far any event should move the odds is a judgement, so the right design keeps two dials apart: the markets say when, the simulated world says how dangerous, and the labels keep them separate.

Cutting scope is the feature. Dropping the game layer at 3am bought the time to get the backtest and the labelling right.

### What's next for Doomsday Clock

Finish recording the three futures end to end, six steps each, and hand-check every event before it lands on the globe. Then a live mode on a machine running the MiroFish backend, so a judge can press Run and watch the graph grow round by round.

On the forecast side: more catastrophe-relevant markets and a daily refresh, so the clock moves as the odds move; a calibration curve on the Track record page; and a news source to replace Hacker News, probably the Guardian and NYT archives or GDELT. Then a public page that posts the reading every morning, with the date and the data behind it.
