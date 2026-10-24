# Kalshi

**What it is:** CFTC-regulated prediction exchange, real-money prices. **Feeds the Doom Clock:** the "when will any company achieve AGI" CDF (`KXAGICO`), US takeover of an AI company (`KXUSTAKEOVER`), and AI-race/product markets (top model, releases, market share) as extra backtest questions.

## Fetch
- Endpoints (`api.elections.kalshi.com/trade-api/v2`, no key): `/series`, `/markets?series_ticker=` and `/historical/markets?series_ticker=` (settled markets move to historical), `/series/{s}/markets/{t}/candlesticks` and `/historical/markets/{t}/candlesticks` (`period_interval=1440`, daily).
- Script: `node doomclock/pipeline/fetch/kalshi.ts` then `node doomclock/pipeline/fetch/clean-kalshi.ts`. Resumable (skips files on disk), 150 ms between calls.
- Series kept: title matches an AI regex (AI, AGI, LLM, GPT, OpenAI, Anthropic, Gemini, Grok, Claude, DeepSeek, model, Arena, …) AND series volume >= 100k contracts, plus `KXAGICO` and `KXUSTAKEOVER` always. Markets with < 1,000 contracts traded are dropped (except the two must-have series).
- Raw: `data/raw/kalshi/series_all.json`, `markets/<series>/{live,hist}_<page>.json`, `candles/<ticker>.json` (verbatim API bodies).

## Clean schema: `data/clean/kalshi.jsonl`
Common: `ts, source:"kalshi", kind, id:"kalshi:<ticker>", url` (series page; per-market URLs are not stable), `series, event`.
- `kind=market`: `ts` = `open_time` (when it became tradable). `core` (true for KXAGICO/KXUSTAKEOVER), `title, subtitle, close_time, volume, rules_primary, rules_secondary`.
- `kind=price`: `ts` = end of the daily candle (UTC). `p` = yes price in dollars/probability: last trade close, else previous trade, else bid/ask mid. Also `bid, ask, volume, open_interest`. Days with no price information are dropped.
- `kind=resolution`: `ts` = `settlement_ts`, `result` YES|NO. Void/scalar results are dropped.
- Backtest pool: resolution records with >= 2 price points (the `id` joins market/price/resolution): 1,980 questions. Point-in-time use: filter `ts < T`; a market's resolution only counts when its resolution `ts < T`.

## Quirks and caveats
- Window 24 Oct 2024 → 24 Oct 2026, but almost nothing before Jan 2026: the AI series are new (KXAGICO created Mar 2026). There is no 2024-25 Kalshi history.
- Thin at long dates: KXAGICO 2031 is priced below 2030. Many series are noisy strike ladders (Vercel/token share, `KXTOPMODEL`); filter by `series` before use.
- **Rules caveat:** KXAGICO resolves on a company *officially announcing it achieved AGI* ("AGI-like/near-AGI" statements do not count) — a much lower bar than Manifold's ASI. Read `rules_primary/secondary` per market; resolution wording differs between series.
- Candle `price` fields are empty on days without trades; `p` then falls back to bid/ask mid or the previous price, so it is a quote, not a trade.

52513 records (market 3648, price 45594, resolution 3271), clean file 16.4 MB, raw cache 67 MB.

## Records per month (by ts)

| month | market | price | resolution |
|---|---|---|---|
| 2023-12 | 1 | 0 | 0 |
| 2024-01 | 1 | 0 | 0 |
| 2024-03 | 9 | 0 | 0 |
| 2024-04 | 2 | 0 | 0 |
| 2024-05 | 2 | 0 | 0 |
| 2024-06 | 2 | 0 | 0 |
| 2024-10 | 16 | 6 | 0 |
| 2024-11 | 28 | 18 | 1 |
| 2024-12 | 20 | 21 | 31 |
| 2025-01 | 7 | 22 | 15 |
| 2025-02 | 23 | 13 | 16 |
| 2025-03 | 17 | 14 | 16 |
| 2025-04 | 16 | 17 | 11 |
| 2025-05 | 11 | 31 | 11 |
| 2025-06 | 31 | 50 | 10 |
| 2025-07 | 38 | 149 | 37 |
| 2025-08 | 31 | 365 | 7 |
| 2025-09 | 4 | 389 | 14 |
| 2025-10 | 24 | 403 | 30 |
| 2025-11 | 18 | 390 | 9 |
| 2025-12 | 46 | 405 | 54 |
| 2026-01 | 109 | 1497 | 101 |
| 2026-02 | 56 | 1360 | 78 |
| 2026-03 | 161 | 1791 | 106 |
| 2026-04 | 147 | 2110 | 117 |
| 2026-05 | 113 | 2343 | 126 |
| 2026-06 | 191 | 2688 | 136 |
| 2026-07 | 181 | 3240 | 186 |
| 2026-08 | 476 | 6467 | 327 |
| 2026-09 | 830 | 10368 | 690 |
| 2026-10 | 1037 | 11437 | 1142 |
