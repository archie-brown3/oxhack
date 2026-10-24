# AI Doom Clock — design

Status: draft for review, 24 Oct 2026 16:00. Items marked **[default]** are my choices; change any.

## Pitch

The Doomsday Clock is one expert opinion set once a year. Ours is a live, checkable forecast:
prediction-market odds, nudged by a panel of AI agents reading today's AI news, run through a
Monte Carlo of how AI could go wrong. The clock counts down to the median catastrophe date and
says how likely that is at all. Then we show the panel's track record on questions that have
already resolved, so judges can see whether to trust it.

Tracks: HRT "Best use of Data for Predictions & Decision Making" (main), theme TIME. The clocks
go back at 02:00 Sunday, and the clock can show humanity "gaining an hour" as a gag.

## Success criteria

1. Judge opens the page, sees the countdown and the scenario fan chart within 1 s.
2. Judge presses **Read today's news**. Within about 20 s the panel's reasoning appears and the clock moves.
3. Judge drags a slider (e.g. "P(loss of control | superintelligence)") and the Monte Carlo
   re-runs instantly.
4. A **Track record** view shows Brier score for panel vs market vs 50% coin on resolved AI
   markets, with the panel's weight chosen on one half of the data and scored on the other.
   We report the result honestly even if the panel loses.

## Non-goals

MiroFish or any social simulation. Accounts, persistence and deploys beyond a laptop. Metaculus
(returns 403 without a token). Training any model.

## Components

Two parts: an offline/refresh **pipeline** (Node + TypeScript) that writes JSON, and a
**web app** (Vite + React + TypeScript) that reads it and runs the Monte Carlo in the browser.
New folder `doomclock/`; the Haggle app in `web/` stays untouched. **[default]** TypeScript
everywhere so the whole team works in one language.

### 1. Market anchors (`pipeline/markets.ts`)

A fixed list of Manifold market IDs, one per model node, fetched from
`api.manifold.markets/v0`. No key needed. Verified 24 Oct: open market probabilities:

| Node | Market (current p) |
|---|---|
| Superintelligence timing | ASI by 2030 (0.36), by 2040 (0.75), by 2100 (0.86), all "conditional on no existential catastrophe" |
| Catastrophe | AI kills ≥10% of humans before 2100 (0.30) |
| Near-term catastrophe | Massive AI catastrophe before 2030 (0.39). Shown on the timeline only, not fed into the sim: "massive" is a lower bar than 10% of humans, and the sim would give it only ~0.13 |
| Warning signs (event timeline) | $100M loss-of-control incident (0.27), agent proliferation event before 2035 (0.81), serious incident with backlash (0.73) |

The exact IDs get pinned in `markets.json` during build. Each node stores `p`, horizon year, URL.

### 2. News feed (`pipeline/news.ts`)

Hacker News Algolia `search_by_date`, query terms AI/LLM/AGI/OpenAI/Anthropic/DeepMind,
`points>50`, a 7-day window ending at time T. It returns about 30 headlines with URL and date.
The same function serves live (T = now) and the backtest (T = past), so the backtest only
sees news that existed then. **[default]** HN only; GDELT returned 429 on first try.

### 3. Agent panel (`pipeline/panel.ts`)

Three persona prompts: **Doomer**, **Accelerationist**, **Superforecaster**. Each gets the
headlines and the current node probabilities. Each returns JSON per node: a log-odds nudge
clamped to ±0.5, a one-line reason, and the headline it cites. The panel nudge is the mean of
the three. Final node p = `logit⁻¹(logit(market) + w · nudge)`, where `w` comes from the backtest.
Three LLM calls per refresh, run in parallel.
**[default]** Called through OpenRouter (the Delta slides supply OpenRouter tokens), one cheap
fast model, temperature 0.

### 4. Monte Carlo (`web/src/sim.ts`, pure function)

10,000 paths, each a short story:
1. **Superintelligence arrival year**: inverse-CDF sample from a piecewise-linear CDF through the
   market points (2026: 0, 2030: 0.36, 2040: 0.75, 2100: 0.86; else "not by 2100").
2. **Goes wrong?** Bernoulli with `p_bad = P(catastrophe by 2100) / P(ASI by 2100)` (≈0.35).
3. **Lag to catastrophe**: exponential, mean 3 years (slider) **[default]**.
4. Each path is tagged with a scenario: *No ASI by 2100*, *ASI, goes fine*, *Fast catastrophe
   (lag < 1 y)*, *Slow catastrophe*.

Outputs: P(catastrophe by 2100), the median catastrophe date among doomed paths (**the
countdown target [default]**), a cumulative-probability fan chart by year, and the scenario mix.
Seeded RNG, so the same inputs always give the same picture. It runs on the main thread
(10k × 3 draws takes a few ms).

### 5. Backtest (`pipeline/backtest.ts`)

- Pull resolved binary Manifold markets matching AI terms that resolved **after the LLM's
  training cutoff**, so the model can't already know the answer. Target 40 or more; 28 were found in the top 100 alone.
- For each market: forecast time T = 30 days before resolution **[default]**. Market prior = the
  `probAfter` of the last bet before T (`/v0/bets?contractId=`). Headlines from the 7 days before T.
- Panel gives a nudge. Score Brier for: coin (0.5), market at T, and market + w·nudge for
  w ∈ {0, 0.25, 0.5, 1}.
- Split markets by resolution date: the earlier half picks `w`, the later half reports the score.
  Bootstrap 95% CI. Write `backtest.json`.
- If `w = 0` wins, the live clock uses pure market odds and the pitch says "the agents didn't
  beat the market, so we don't let them move the clock much". That is still an honest, strong answer.

### 6. Web app

One page, dark:
- **Clock face** with a countdown (years / days / h:m:s) to the median catastrophe date, plus
  "P(it happens by 2100): 31%" underneath.
- **Fan chart** of cumulative P(catastrophe) by year, with the 2026 Doomsday Clock (85 s)
  mentioned as a footnote.
- **Scenario bar**: share of paths in each scenario.
- **Warning-sign timeline**: the near-term event markets with panel-adjusted probability.
- **Panel** cards: each persona's nudges, with reason and cited headline. Button: *Read today's news*.
- **Sliders**: lag mean, p_bad override, w. Changes re-run the sim instantly.
- **Track record** tab: Brier table + reliability plot from `backtest.json`.

Server: a ~30-line `node:http` server in `pipeline/server.ts` that serves the built app and
`POST /api/refresh` (fetch markets + news, run panel, return state JSON). **[default]** No framework.

## Data flow

```
Manifold ─┐
HN news ──┼─> panel (3 LLM calls) ─> state.json ─> browser: sim.ts ─> clock, charts
          └─> backtest.ts (offline, once) ─> backtest.json ─> Track record tab (+ sets w)
```

## Errors

- Manifold or HN down: serve the last good `state.json` and show its timestamp.
- LLM returns bad JSON or times out (15 s): that persona gives a zero nudge and its card says so.
- Clamp every nudge; never let one agent move a node by more than ±0.5 log-odds.

## Testing

- `sim.ts`: unit tests. Known inputs give P(catastrophe by 2100) within ±1 pt of the analytic
  value; the same seed gives the same output; the CDF sampler hits the market points.
- Backtest: unit-test the "price at T" lookup and the Brier maths on a hand-made fixture.
  One smoke run against the live API.
- Panel: a test that bad JSON gives zero nudges.

## Risks

- **Leakage:** we only count markets resolved after the model's cutoff. We need to confirm
  the chosen model's cutoff before running.
- **Small N:** about 40 questions gives wide CIs, so we show them and don't oversell.
- **Markets are hard to beat:** we expect `w` near 0; the honesty is part of the pitch.
- **Taste:** "countdown to extinction" can read as a stunt. The track-record tab is what makes it defensible.

## Open questions for review

1. Which OpenRouter model (and its training cutoff)?
2. Countdown target: median doomed-path date (current default) or the year cumulative P crosses 10%?
3. Who on the team owns pipeline vs web?
