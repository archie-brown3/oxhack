# Manifold

**What it is:** play-money prediction market with a deep AI-risk community. **Feeds the Doom Clock:** the market anchors (ASI timing, AI catastrophe, warning-sign events; pinned in `doomclock/pipeline/markets.json`) and the **resolved-binary backtest pool**.

## Fetch
- Endpoints (`api.manifold.markets/v0`, no key): `/search-markets` (17 AI terms x 5 sorts, paged by offset; deep offsets return 400 = end), `/market/{id}` (full object: description, resolution, resolutionTime), `/bets?contractId=&limit=1000&before=` (full trade history).
- Script: `node doomclock/pipeline/fetch/manifold.ts` then `node doomclock/pipeline/fetch/clean-manifold.ts`. Resumable (skips files on disk), 250 ms between calls.
- Kept: question matches an AI regex (AI, AGI, ASI, OpenAI, Anthropic, GPT, Claude, Gemini, superintelligence, alignment, x-risk, …), created or resolved since 24 Oct 2024, **>= 20 unique traders**. Bets are pulled for binary markets only. Eight core forecast markets from `markets.json` are always kept, even with < 20 traders or created earlier.
- Raw: `data/raw/manifold/{search,markets,bets/<id>}/` (verbatim API bodies, 2,829 search-surfaced market objects).

## Clean schema: `data/clean/manifold.jsonl`
Common: `ts, source:"manifold", kind, id:"manifold:<id>", url, question`.
- `kind=market`: `ts` = `createdTime`. `core` (true for the 8 pinned markets), `close_time, traders, volume` (mana), `description` (plain-text resolution criteria). `traders`/`volume` are as of fetch time (24 Oct 2026), not as of `ts`.
- `kind=price`: `ts` = end of the UTC day (23:59:59Z, or fetch time for today), `p` = `probAfter` of the day's last non-cancelled bet. Only days with trades; carry the last value forward when looking up as of T. Each market also has one anchor row for its last close before 24 Oct 2024 when it traded earlier.
- `kind=resolution`: `ts` = `resolutionTime`, `result` YES|NO|MKT|CANCEL, `resolution_probability`, `backtest_pool` (true = YES/NO result and >= 1 price row). Never treat a market as resolved before this record's `ts`.

## Backtest pool
1496 resolved binary AI questions (YES/NO) with price history. Split by resolution `ts` (earlier half picks `w`, later half scores); use a market only for T before its resolution `ts` and after its first price row.

## Caveats
- Play money: prices are noisier and more crowd-driven than Kalshi/Polymarket; low-liquidity markets can be swung by one trader (hence the 20-trader floor).
- Many markets are conditional ("conditional on no existential catastrophe") or have unusual resolution (e.g. "resolves N/A in 2027") — read `description`.
- Search is fuzzy and capped (~2,000 results/query), so coverage of low-activity AI markets is incomplete; high-traffic markets are covered by many term/sort combinations.
- Core markets (current p on 24 Oct 2026): see `doomclock/pipeline/markets.json`. "Massive AI catastrophe before 2030" (czck4zd672) is shown on the timeline only.

38532 records (market 1831, price 35135, resolution 1566), clean file 12.2 MB, raw cache 460 MB.

## Records per month (by ts)

| month | market | price | resolution |
|---|---|---|---|
| 2022-02 | 1 | 0 | 0 |
| 2022-04 | 3 | 0 | 0 |
| 2022-07 | 2 | 0 | 0 |
| 2022-08 | 3 | 0 | 0 |
| 2022-09 | 5 | 0 | 0 |
| 2022-10 | 8 | 0 | 0 |
| 2022-11 | 18 | 0 | 0 |
| 2022-12 | 23 | 0 | 0 |
| 2023-01 | 32 | 0 | 0 |
| 2023-02 | 22 | 0 | 0 |
| 2023-03 | 61 | 0 | 0 |
| 2023-04 | 54 | 0 | 0 |
| 2023-05 | 30 | 0 | 0 |
| 2023-06 | 18 | 0 | 0 |
| 2023-07 | 25 | 0 | 0 |
| 2023-08 | 35 | 0 | 0 |
| 2023-09 | 34 | 1 | 0 |
| 2023-10 | 29 | 2 | 0 |
| 2023-11 | 73 | 3 | 0 |
| 2023-12 | 68 | 6 | 0 |
| 2024-01 | 128 | 4 | 0 |
| 2024-02 | 61 | 5 | 0 |
| 2024-03 | 65 | 8 | 0 |
| 2024-04 | 29 | 20 | 0 |
| 2024-05 | 44 | 33 | 0 |
| 2024-06 | 28 | 50 | 0 |
| 2024-07 | 26 | 81 | 0 |
| 2024-08 | 26 | 152 | 0 |
| 2024-09 | 27 | 237 | 0 |
| 2024-10 | 22 | 828 | 2 |
| 2024-11 | 18 | 1857 | 47 |
| 2024-12 | 40 | 2652 | 73 |
| 2025-01 | 62 | 1900 | 300 |
| 2025-02 | 46 | 1536 | 69 |
| 2025-03 | 32 | 1258 | 48 |
| 2025-04 | 31 | 1436 | 31 |
| 2025-05 | 29 | 1418 | 50 |
| 2025-06 | 28 | 1309 | 22 |
| 2025-07 | 48 | 1793 | 68 |
| 2025-08 | 56 | 1569 | 83 |
| 2025-09 | 28 | 1117 | 31 |
| 2025-10 | 42 | 1611 | 37 |
| 2025-11 | 27 | 1437 | 30 |
| 2025-12 | 36 | 1970 | 47 |
| 2026-01 | 48 | 1231 | 257 |
| 2026-02 | 51 | 1222 | 54 |
| 2026-03 | 34 | 1132 | 41 |
| 2026-04 | 27 | 1119 | 33 |
| 2026-05 | 23 | 1156 | 43 |
| 2026-06 | 33 | 1087 | 39 |
| 2026-07 | 20 | 1033 | 35 |
| 2026-08 | 31 | 1048 | 35 |
| 2026-09 | 28 | 1064 | 58 |
| 2026-10 | 13 | 750 | 33 |
