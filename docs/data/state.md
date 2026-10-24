# State: market anchors and the capability curve

**What it is:** the market prices engine A reads at one instant `asOf`, built from the clean Manifold and Kalshi files. **Feeds the Doom Clock:** the Monte Carlo (the four anchors, `nodes[].p`), the real frames since Oct 2024 (`nodes[].history`), "Why this time?" (label, price, traders and link per anchor), and `WorldFrame.capability` (the KXAGICO curve). Types: `StateFile` and `MarketInputs` in `doomclock/web/src/contracts.ts`.

## Build
- `node doomclock/pipeline/state/pin-markets.ts` rewrites `doomclock/pipeline/markets.json` (pins only, no prices) in one write. Run it when a pin changes; it keeps the Manifold ids, `url` and `question` already in the file.
- `node doomclock/pipeline/state/build-state.ts [--asOf=ISO]` writes `data/state.json` and `data/market-inputs.json`. It reads `markets.json` and `data/clean/{manifold,kalshi}.jsonl` (read-only). No network, no LLM, about 0.2 s.
- **asOf:** `--asOf` if given, else now. Either way it is truncated to the second (ISO, no ms). Truncating can only drop data, never leak it. Both files carry the same `asOf`: when `market-inputs.json` cannot be built, the old one is deleted, never left beside a `state.json` from another `asOf`.
- A historical `--asOf` works and overwrites the live files, so rerun without it afterwards. Up to 2026-03-04T05:00:00Z there is no KXAGICO price, so the script writes `state.json`, **deletes** `market-inputs.json`, warns and exits 1 (the pair is incomplete; the engine has no capability curve for that `asOf`).

## priceAt (`doomclock/pipeline/lib/price-at.ts`)
Public API, shared with the backtest.
- `loadPrices(source)`: the `kind=price` rows of `data/clean/<source>.jsonl` as `Map<record id, {t, p}[]>`, sorted by `t` (epoch ms). Ids are the clean record ids: `manifold:<id>`, `kalshi:<ticker>`, `pm:<id>`.
- `priceAt(series, T)`: the **last row with `ts < T`**, strictly before (a row exactly at T is excluded), carried forward however old it is. `null` if no row is before T. Binary search. Returns `{p, ts}` with `ts` as ISO to the second.
- Times are compared as **numbers** (`Date.parse`), never as strings: the clean files have held both `…59.000Z` and `…59Z`, and as strings `.` sorts before `Z`.
- A price row is a daily close: Manifold `ts` is 23:59:59Z of the trade day, Kalshi `ts` is the end of the daily candle (see `manifold.md`, `kalshi.md`).
- Tests: `node --test doomclock/pipeline/lib/price-at.test.ts` (inline fixture: last-before-T, exact-T excluded, a 0.999 poison row after T never returned, null before the first row, mixed ms/no-ms order).

## `doomclock/pipeline/markets.json` (MarketsFile)
- `manifold[]`: `{id, role, node?, horizonYear?, label, url, question, deadline, criteriaNote?}`. `deadline` is the market's `close_time` (ISO, no ms).
  - 4 anchors (`role: "anchor"`, with `node` and `horizonYear`): `F3WW5VQthbykdojxr0Ef` asi2030, `cSmn5bvykckNzpKJYz1a` asi2040, `kRyHJpIcEOnokT5KnP0a` asi2100 (criteriaNote "Conditional on no existential catastrophe"), `wn5c8MBJNO0BfGjLmyJ2` cat2100 (criteriaNote: the thin-market line below).
  - 4 warnings (`role: "warning"`): `czck4zd672`, `ZZRAP59Egn`, `IxrSYXN8z93GJRVi7VjG`, `nZNhbZsrUglzyUWclEiS`.
- `kalshi[]`: `KXAGICO` (`capability_curve`; `question` and `criteriaNote` from its latest-closing market, plus "AGI-like/near-AGI statements do not count.") and `KXUSTAKEOVER` (`card`, a phase-2 pin).
- `polymarket: []`.
- Prices, traders and resolution flags are no longer in this file; they are in `data/state.json`.

## `data/state.json` (StateFile, `doomclock.state/2`)
Top level: `schema, asOf, stale: false, w: 0, panel: {model: "none", trainingCutoff: "", personas: []}, nodes, warnings: [], headlines: []`.

`nodes`, in sim order asi2030, asi2040, asi2100, cat2100:

| field | meaning |
|---|---|
| `id, marketId, label, url, horizonYear` | from the anchor pin in `markets.json` (`marketId` is the bare Manifold id) |
| `pMarket` | `priceAt(asOf).p` |
| `dlogit`, `p` | 0 and `pMarket` in phase 1 (no panel) |
| `traders` | unique traders **at the 24 Oct 2026 fetch, not at `asOf`**: Manifold gives no trader-count history |
| `nPrices` | daily closes in the clean file before `asOf`: the clean window (from 24 Oct 2024) plus the one carried-in earlier row. Not every trade day since the market opened (cat2100: 7 here, 19 trade days in all) |
| `lastTradeTs` | `ts` of the close `pMarket` came from |
| `pRange12m` | `[min, max]` of the price carried in at `asOf − 365 d` and every close in `[asOf − 365 d, asOf)`. The clean files start 24 Oct 2024 (plus one carried-in row per market), so ranges for an `asOf` before Oct 2025 are partial. |
| `history` | `[{q, T, p}]`: `T` = 2024-10-24T00:00:00Z for `2024Q4`, then each quarter start (2025-01-01T00:00:00Z, …) while `T ≤ asOf`. `p = priceAt(T)?.p ?? null`. 9 points for an `asOf` in 2026Q4. |

On 24 Oct 2026: asi2030 0.3608, asi2040 0.75, asi2100 0.8635, cat2100 0.297.

## `data/market-inputs.json` (MarketInputs, `doomclock.market-inputs/1`)
Top level: `schema, asOf, capabilityCurve, cardPrices: [], originLab: []`.

`capabilityCurve = {ticker: "KXAGICO", rule, monotonised: true, quarters}`, one `{q, p}` per quarter from 2024Q4 to 2035Q4 (45). `p` is P(some company officially announces AGI) by the end of quarter `q` (`E_q`, the first instant of the next quarter):
- `E_q ≤ asOf`: **0**. This is realised: no qualifying announcement, and KXAGICO-COMP-26Q2 and 26Q3 resolved NO.
- Otherwise, from the KXAGICO-COMP ladder priced at `asOf`. Each open "Before <date>" market (`close_time > asOf`) with a price before `asOf` is a knot at (`close_time`, `priceAt(asOf)`), plus a knot (`asOf`, 0). Linear in time between knots, flat after the last (2031-01-01, the "Before Jan 1, 2031" market), rounded to 4 dp, then a running max (cummax).
- This is an **announcement**, not ASI, and a much lower bar than the Manifold anchors. Kalshi is real money.
- On 24 Oct 2026: 2026Q4 0.0598, 2027Q4 0.3899, 2028Q4 0.7699, 0.81 from 2029Q4 on. The raw ladder is not monotone ("Before Jan 1, 2031" 0.78 < "Before Jan 1, 2030" 0.81); cummax holds 0.81.

## cat2100 is a thin market
`wn5c8MBJNO0BfGjLmyJ2` ("AI kills ≥10% before 2100") is play money with **19 traders** (3,763 mana volume) and **7 daily closes since 2024-05-22**, out of 19 trade days since the market opened on 2023-07-21: 0.2959, 0.2978 (2025-05-25), 0.2502 (2025-10-05), 0.2508, 0.2495, 0.2812, 0.297 (2026-09-24). Between trades the price is carried forward for months; the 12-month range is 0.2495–0.297. `state.json` carries the facts (`traders`, `nPrices`, `lastTradeTs`, `pRange12m`, `history`); **the engine owns how the clock shows that uncertainty** (fan, range arc or label). This file does not widen or smooth the price.

## KXAGICO starts in March 2026
KXAGICO was created in March 2026: its first price is **2026-03-04**, not mid-2025 as the brief assumed. Before that there is no curve and none is invented: for an `asOf` up to 2026-03-04T05:00:00Z (its first daily close; `priceAt` is strictly before), `build-state.ts` deletes `market-inputs.json` and exits 1.

**Historical curves before 2026-07-01 lack the 26Q2 knot.** `KXAGICO-COMP-26Q2` ("Before Jul 1, 2026", resolved NO) has 114 raw candles but **0 clean price rows**: `clean-kalshi.ts` reads only the `*_dollars` candle fields, and settled markets' candles use `close`/`previous` with no suffix (1,265 resolved Kalshi markets are hit; upstream bug, owned by the Kalshi lane). So for an `asOf` in [2026-03-04, 2026-07-01) the curve interpolates from (`asOf`, 0) straight to the 26Q3 knot: at 2026-05-01, 2026Q2 is 0.0358 although 26Q2's last close before then was 0.09. The live `asOf` is unaffected (26Q2 closed before it), and `build-state.ts` needs no change once `kalshi.jsonl` is re-cleaned. An engine option, not built: `KXOAIAGI` (OpenAI only announces AGI) has prices from 2024-10-24 for "Before 2030" and from mid-2025 for 2026/2027. It is a narrower question (one company).

## Contract changes for the Lead
- `ManifoldPin` gains `node?: NodeId` and `horizonYear?: number` (set on anchors).
- `StateNode` gains `traders: number`, `nPrices: number`, `lastTradeTs: IsoTime`, `pRange12m: [Prob, Prob]` and `history: {q: QuarterLabel; T: IsoTime; p: Prob | null}[]`.
- `CapabilityCurve` covers 2024Q4 to 2035Q4 (45 quarters), with quarters that ended by `asOf` at 0; `ticker` is the series `KXAGICO`, not `KXAGICO-COMP`.
- `panel.model` is `"none"` (and `trainingCutoff` `""`) in phase 1, when no panel runs.
- `state.json` `warnings` is `[]` for now, although the 4 warning pins exist.
