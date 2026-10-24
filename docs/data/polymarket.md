# Polymarket

**What it is:** crypto prediction market, real-money prices. **Feeds the Doom Clock:** the "who is leading the race" panel (monthly "which company has the best AI model" events) and extra resolved questions for the backtest.

## Fetch
- Endpoints: `gamma-api.polymarket.com/events?tag_slug=&closed=&limit=100&offset=` and `/public-search?q=&page=` (discovery); `clob.polymarket.com/prices-history?market=<tokenId>&interval=max&fidelity=1440` (daily Yes price).
- Script: `node doomclock/pipeline/fetch/polymarket.ts` then `node doomclock/pipeline/fetch/clean-polymarket.ts`. Resumable, 200 ms between calls.
- Discovery produces ~3,800 events from tags/search; 855 are AI-looking and in the window (saved verbatim as `data/raw/polymarket/events/<id>.json`). Discovery pages (`lists/`, ~480 MB raw) are gzipped; delete `events/` to re-run discovery (the script reads plain `.json`, so gunzip `lists/` first).
- Quality filter: events whose title matches "which company has (the) best AI model", plus AI events with event volume >= $50k, excluding "what will X say/mention/post" markets. Within them only markets with volume >= $5k. Price history is the **Yes token only** (No = 1 − Yes).
- Raw: `data/raw/polymarket/{events,prices,lists}/`.

## Clean schema: `data/clean/polymarket.jsonl`
Common: `ts, source:"polymarket", kind, id:"pm:<marketId>", url` (event page).
All times are ISO UTC to the second (no ms); sub-second source times are rounded up.
- `kind=market`: `ts` = market `startDate`. `event_id, event_title, question, outcome` (candidate name in multi-outcome events), `monthly_best_model` (true for the monthly best-model events), `end_date, volume, description` (resolution rules text).
- `kind=price`: `ts` = CLOB point time, `p` = Yes price. About one point per day.
- `kind=resolution`: `ts` = market `closedTime` (fallback event close / end date), `result` YES|NO from the final outcome price (>= 0.99 / <= 0.01). 2,060 of 2,095 resolved markets have price history: that is this source's backtest pool.

## Quirks and caveats
- Window 24 Oct 2024 → 24 Oct 2026, but most volume is 2025-26. A few markets start before the window (their price points are clipped to it).
- Best-model markets resolve on the arena.ai text leaderboard rank at a stated time (not "best" in general) — read `description`. Weekly "best AI model on <date>" events are kept only when >= $50k volume.
- `closedTime` can lag the real outcome (UMA dispute window), so for as-of-T use treat a resolution as known only after its `ts`.
- Multi-outcome events: each candidate is its own market; the Yes prices of an event sum to roughly 1, not exactly.
- Tag discovery is capped at 100 events/page, so very old low-volume events may be missed.

149534 records (market 2483, price 144956, resolution 2095), clean file 31.5 MB, raw cache 105 MB.

## Records per month (by ts)

| month | market | price | resolution |
|---|---|---|---|
| 2023-12 | 1 | 0 | 0 |
| 2024-04 | 4 | 0 | 0 |
| 2024-07 | 1 | 0 | 1 |
| 2024-08 | 1 | 0 | 0 |
| 2024-09 | 3 | 0 | 0 |
| 2024-10 | 0 | 64 | 1 |
| 2024-11 | 0 | 240 | 0 |
| 2024-12 | 35 | 387 | 7 |
| 2025-01 | 36 | 964 | 14 |
| 2025-02 | 18 | 1675 | 12 |
| 2025-03 | 9 | 1854 | 11 |
| 2025-04 | 17 | 1816 | 13 |
| 2025-05 | 9 | 1764 | 13 |
| 2025-06 | 10 | 1708 | 9 |
| 2025-07 | 11 | 1621 | 20 |
| 2025-08 | 40 | 1696 | 33 |
| 2025-09 | 76 | 2888 | 40 |
| 2025-10 | 128 | 4897 | 48 |
| 2025-11 | 79 | 5434 | 69 |
| 2025-12 | 258 | 10381 | 130 |
| 2026-01 | 125 | 8430 | 124 |
| 2026-02 | 106 | 8439 | 182 |
| 2026-03 | 105 | 6764 | 88 |
| 2026-04 | 237 | 4909 | 185 |
| 2026-05 | 177 | 11018 | 121 |
| 2026-06 | 254 | 13236 | 210 |
| 2026-07 | 347 | 11999 | 254 |
| 2026-08 | 215 | 17599 | 172 |
| 2026-09 | 144 | 16441 | 257 |
| 2026-10 | 37 | 8732 | 81 |
