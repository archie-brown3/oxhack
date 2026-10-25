# Devpost submission

Archie submits this (owner task 142); agents do not. Workshop 09:00 GMT, submit by 11:45 GMT, hacking ends 12:00 GMT on Sun 25 Oct 2026.

## Title

Minutes to Midnight

## Tagline (elevator pitch, 193 chars)

A countdown to AI catastrophe, read from today's prediction-market odds. Out of sample, AI markets scored a Brier of 0.085 vs 0.250 for a coin on 1,186 resolved questions. Rewind it to any day.

## What it is

The clock is a countdown to the first day on which today's market prices, joined by one labelled game rule (a 3-year gap from superintelligence to catastrophe), reach a 1-in-10 chance of AI catastrophe. The hand reads those prices. Drag Inputs back in time and the globe, the news and the hand use only what was public by that date.

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
- Blind LLM 0.185 (n = 1,170, the replies that parsed)
- A 50% coin 0.250
- Chosen blend weight **w = 0**. Adding the blind model did not help.
- Leakage checks: **5 of 5 passed**

The countdown date is not one of these scores. The catastrophe market is thin; the When tab shows the trader count next to the price.

## What a judge sees

The real forecast and the Track record are real. The two futures and the Engine graph are labelled stand-ins (an illustrative pair, and a 24 Oct MiroFish spike). Three recorded futures are the next step, on a machine that has the MiroFish backend. Do not describe the stand-in clocks as results.

## Real MiroFish this morning (the next step, not a result)

On 25 Oct we built the Step 1 knowledge graph for all three futures on real MiroFish: 92, 83 and 89 nodes (`data/world/futures/{1,2,3}/step1/project.json`), after shrinking the seed pack to about 5 KB (5,189 characters). The first six-month step of futures 1 and 2 then ran all 5 rounds of the simulated X society, 228 and 207 agent actions (`data/world/futures/{1,2}/step-1/api-run-status.json`, posts saved beside it). Zep Cloud then timed out writing those rounds into the graph, with 31 and 28 episodes pending (`data/world/logs/2026-10-25-zep-timeout.log`), and MiroFish marked both runs failed. So no step report and no recorded future exists, and nothing from these runs is on screen. Recording three futures of six steps is the next step.

## Built with

TypeScript, Vite, React, globe.gl, MiroFish (replica of a saved run). No scrape of HTML. Live fetches, when they run, save the raw response first.

## Devpost story (the seven form fields, checked against the build on 25 Oct 10:50)

### Inspiration

Everyone talks about AI risk, and talk creates no urgency. The Bulletin's Doomsday Clock works because it turns a judgement into one picture anyone can read. We wanted that picture for AI, set by data rather than a panel: a hand placed by what prediction markets say today, the incidents, laws and datacentres behind them on a globe, and a track record you can check before you trust it.

The theme was TIME. A countdown to a date, a hand that has to move when the odds move, and a slider that hides anything not yet public were the most literal answers we could give.

### What it does

The clock counts down to the first day on which today's market prices, joined by one labelled game rule (a 3-year gap from superintelligence to catastrophe), reach a 1-in-10 chance of AI catastrophe. Today that is 31 May 2032, five years and seven months away, and the countdown runs to it live. The face is pinned to the Bulletin's own setting of 85 seconds today, so one second on the face is about 24 days; before today the hand shows the Bulletin's real settings, and from today the market forecast drives it.

Behind the clock is a globe. 973 dated real events sit on it as solid rings: AI incidents, US, UK and EU government actions, the Wikipedia AI timeline and the Bulletin's own announcements. 77 datacentres are grey dots that glow red as the hand nears midnight. A news feed and a ticker read the events, and turning points come up as a newsflash.

Open Inputs and you see what the engine knows: 4 market prices, 821 incidents, 83 government actions, 69 news items and 77 datacentres, each dated by when it became public. Drag the as-of slider back to any day since October 2024 and everything published later disappears, so the forecast cannot peek ahead.

Press play and an illustrative stand-in future (hand-made, not a MiroFish recording; the caption says so) runs from 2027 to 2029, six months a step. Each step's events land on the globe as dashed rings and nudge that future's clock by a labelled game rule, and a report scores the world from 0 to 3 on loss of control, misuse, oversight and race pressure. A ghost hand shows today's reading beside the simulated one, and three lines separate how much of each move is events, report or luck. Everything simulated is marked as such, and nothing simulated moves the real clock. On this build both futures are hand-made: the 0 to 3 scores are made up, the report text comes from a 24 Oct MiroFish spike, and the three lines show the game rules, not a recorded luck share.

Why this time? explains the date in three tabs: When, the four market prices with their trader counts and last trades; How dangerous, the step's report and rubric; and Track record, how AI prediction markets scored 30 days out on 2,371 other AI questions that have since resolved.

### How we built it

Data first. We call APIs only, never scrape, and save every raw response before parsing it. Every record carries the time it became public and the files are sorted by it, so point-in-time code reads only what was known before the chosen date. The sources are Manifold, Polymarket and Kalshi, pinned by market ID; the AI Incident Database; the Federal Register, GOV.UK and EUR-Lex; the Wikipedia timeline of AI; Epoch AI's datacentre list; and the Bulletin's own clock announcements.

The clock reads four Manifold markets: superintelligence by 2030 (36%), by 2040 (75%), by 2100 (86%), and an AI catastrophe killing at least a tenth of humanity by 2100 (30%). A three-year mean gap from superintelligence to catastrophe turns those into a curve, and the date is the first day the curve passes 10%. No market backs the gap, so it is labelled a game rule and the clock shows the one-to-ten-year range as a band on the face.

The app is TypeScript, Vite and React, with the engine as pure functions and a globe.gl sphere on Natural Earth GeoJSON. It runs offline from committed JSON with no API keys. A Node pipeline fetches, cleans, runs the backtest and writes the files the app reads.

The backtest takes 2,371 AI questions from Kalshi, Polymarket and Manifold that have resolved yes or no and reads the market price 30 days before each answer was known. The earlier half picks the weight for a blind AI model, Gemini 2.5 Flash shown only the question and the date; the later 1,186 questions are the score. Confidence intervals resample whole events so ladders of related questions count once, and five leakage checks run on every build.

The futures are designed to run on MiroFish, an open-source agent society. Each future gets its own knowledge graph in Zep, built from a seed pack of today's news and odds. The entities in that graph, labs, regulators, news desks, safety researchers and the public, become agents with personas and memory, and they are meant to post, quote and follow each other on a simulated X for five rounds per six-month step. An account with the standing to act, a government, a lab, the incident tracker, produces an event; everyone else is mood. MiroFish's own report agent is meant to write each step's report. On 25 Oct the first step of two futures ran all five rounds (136 and 119 posts, `data/world/futures/{1,2}/step-1/api-posts.json`), but Zep timed out storing them, so no step report exists yet. We patched MiroFish to run Twitter-only, write its graph episodes in English and restart cleanly, and wrote a recorder that saves every round. The Engine tab is a replica of MiroFish's own screens, the graph, the split view and the workbench, played from a saved run; it never starts a live simulation.

### Challenges we ran into

Leakage. A backtest of forecasting data is easy to cheat by accident, so we wrote the rules before the code: pick the forecast date without looking at the outcome, count a question only when the model's cutoff plus a month is before it, split by date, and report the result even if the clever part loses. It did lose. Mixing in the blind model did not help on the earlier questions, so its weight is zero and the clock uses market prices alone.

The catastrophe market itself is thin: play money, 19 traders, below the 20-trader line we hold Manifold questions to in the backtest. So the trader count sits next to the price, and the When tab says in words that the clock's date is not scored.

The face. One minute per year put today's hand at five and a half minutes and the clock looked calm. We pinned today to the Bulletin's 85 seconds and let the forecast set the seconds per year instead, and the face shows the scale (1 s ≈ 24 days) next to the hand.

MiroFish was built for one run from one seed. We needed three futures with continuity across six steps, each on its own graph, in English. The Zep graph builds stalled on our first seed pack of 38 KB and 115 episodes; shrinking it to about 5 KB got all three graphs built on the final morning. The first real six-month step then ran all five rounds for two futures, but Zep timed out storing them and MiroFish failed both runs, so no recorded future exists. The build you can open therefore plays two hand-made futures, labelled "illustrative stand-in" on the clock and in the report tab, with "(fixture)" on their feed items, with a report from a real MiroFish run on 24 October attached and labelled as a stand-in too. We dropped a whole game layer, cards and a rogue AI, in the small hours of Sunday to protect the forecast and the labelling.

### Accomplishments that we're proud of

The clock reads real data and you can see how good that data is without leaving the app. Thirty days out, the markets scored a Brier of 0.085 against 0.250 for a coin, 0.183 for the base rate and 0.185 for the blind model, with 95% intervals, a calibration curve where the market sits two points from the diagonal and the model eleven, and five of five leakage checks. Every number on screen traces to a file in the repo.

Everything is labelled by its standing: real, simulated, recorded, game rule. The gap from superintelligence to catastrophe is marked as our rule. The stand-in futures say so in three places. The test of whether simulated events change the society's decisions has not run, and the Track record says so rather than claiming it.

The time slider makes the no-leakage rule visible: drag it back and the world shrinks to what was known. And the whole thing runs offline, from committed JSON, with no keys, which is how a demo should run.

### What we learned

Honest forecasting is mostly plumbing. Timestamps, a raw-response archive and a date split did more for credibility than any model. Thirty days out, real-money markets were the best forecaster we had, Polymarket at 0.071 and Kalshi at 0.102, with play-money Manifold at 0.124, and a model reasoning blind was not close.

Agent societies are a storytelling tool, not a forecaster. MiroFish gives you a vivid, coherent world and a report on it, but how far any event should move the odds is a judgement, so the design keeps two dials apart: the markets say when, the simulated world says how dangerous, and the labels keep them separate.

Cutting scope is the feature. Dropping the game layer at 3am bought the time to get the backtest and the labelling right.

### What's next for Doomsday Clock

Finish recording three futures of six steps each on real MiroFish, hand-check every event before it lands on the globe, and retire the stand-ins. Then run the society test, so the question of whether simulated events change the agents' decisions has an answer on the Track record page, and add a live mode on a machine running the MiroFish backend, so a judge can press Run and watch the graph grow round by round.

On the forecast side: more catastrophe-relevant markets, real-money ones where they exist, with a daily refresh so the clock moves as the odds move; a news source to replace Hacker News; and a public page that posts the reading every morning with the date and the data behind it.
