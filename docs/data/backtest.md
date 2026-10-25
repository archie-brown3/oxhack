# Backtest

**What it is:** the Track record. It asks whether the clock's inputs, market prices, were any good,
out of sample, and whether a blind AI model's guess improves them. **Writes:** `data/backtest.json`
(shown in the Track record tab) and `data/tests/t8-pilot.json`. It scores market prices and the
model's nudges on resolved questions. The countdown date itself cannot be scored, and is not.

## Run
```
node --env-file=.env doomclock/pipeline/backtest/llm.ts [--limit 40] [--budget 1.5] [--stop-at <ISO>]
node doomclock/pipeline/backtest/run.ts
node --test doomclock/pipeline/backtest/
```
`llm.ts` resumes: it skips questions already in `forecasts.jsonl` for the current prompt version.
`run.ts` makes no API calls. It reads the clean files and `forecasts.jsonl`, so it reruns anywhere.

## Pool (`pool.ts`)
Resolved YES/NO AI questions in `data/clean/{manifold,polymarket,kalshi}.jsonl`.
- **Forecast date T = resolution − 30 days**, the same rule for every question.
- **Market price at T** = the last price row with `ts < T` (`lib/price-at.ts`, carried forward).
  `buildPool` throws if a price is not strictly before T.
- **T ≥ 2025-03-01**: the model's training cutoff (2025-01-31) plus one month. The same pool is used
  for every method, so all rows of the table are scored on the same questions.
- The question must have opened before T. Manifold questions need ≥ 20 traders (the clean file's
  filter); Kalshi keeps markets with ≥ 1,000 contracts and Polymarket ≥ $5k volume (their fetch filters).
- 24 Oct 2026 run: 2,371 questions (Manifold 801, Polymarket 1,223, Kalshi 347). Drop counts per
  reason are in `backtest.json` → `n.dropped`.

## Split
The cut is the median T (2026-03-01). Test = questions forecast on or after the cut. Train = questions
that **resolved** before the cut, so the base rate and `w` were knowable before the first test
forecast. Questions forecast before the cut but resolved after it (53) are used by neither half.

## Methods, all scored on the test half
- **Market**: the price at T.
- **50% coin**: always 0.5 (Brier 0.25).
- **Base rate**: the share of train questions from the same site that resolved YES.
- **Blind model** (`llm.ts`): `google/gemini-2.5-flash` on OpenRouter, temperature 0, no reasoning.
  It sees only the question text and the date T (`prompt()`), never the price, outcome or resolution
  date. Bad JSON or a refusal gives no forecast; it is logged and counted in the parse rate.
- **Blend**: `market + w·(model − market)`, clamped to [0, 1]; no model forecast means no nudge.
  `w` is picked on train from 0, 0.1, …, 1 (ties to the smaller w) and reported on test, even when
  `w = 0` wins. The live news panel is not backtested, so `scores.test.panel` is null.

Brier with a 95% bootstrap CI: 2,000 resamples of whole events (a Polymarket event or a Kalshi strike
ladder is one cluster, a Manifold market is its own). Paired differences use the same resampling.
Reliability: 10 equal-width bins of the market price (and the model) on test; empty bins left out.

## Leakage checks (`backtest.json` → `leakage.checks`)
Computed from the data on every run: every price is before its T; every T is resolution − 30 days;
every T is ≥ cutoff + 1 month; every train question resolved before the first test forecast; every
saved request in `data/raw/backtest/` equals `prompt(question, T)` exactly.

## Raw and spend
Every API body is saved to `data/raw/backtest/<fetched_at>__<id>.json` (request, status, body) before
parsing. Spend is OpenRouter's `usage.cost`, summed over `forecasts.jsonl`; the lane cap is $3.00.
Pilot (T8): v1 prompt 40 calls, 35 parsed ($0.023); v2 adds a JSON schema and "never refuse",
40 of 40 parsed ($0.002). Prompt changes were judged on parse rate only. Full run: 2,371 asked,
2,351 parsed (99.2%), total spend $0.138 including the pilot.

## Caveats
- Survivorship: only questions resolved YES or NO count; open, cancelled and N/A ones are left out.
- T comes from the resolution date. A question that resolved early (often YES) is forecast 30 days
  before that early date, so this measures accuracy 30 days out, not at a random time.
- Manifold is play money. Kalshi ladders and Polymarket events hold many correlated questions,
  hence the clustered CIs. The model is not deterministic even at temperature 0.
