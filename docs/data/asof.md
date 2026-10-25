# asOf(T): what was known at time T

**What it is:** the one point-in-time module (`doomclock/pipeline/asof/asof.ts`). Every reader of `data/clean/` goes
through it: `state/build-state.ts` (`data/state.json`, `data/market-inputs.json`), `events/build-events.ts`
(`data/events.json`), `mirofish/seed.ts` (the MiroFish seed), `web/scripts/publish-cache.ts` (the browser's
`cache/world.json`) and the backtest. `lib/price-at.ts` is now a re-export of it, kept so old imports still work.

**The rule:** nothing with `ts >= T` is ever returned. Times are compared as numbers (`Date.parse`), never strings,
so `…00Z` and `…00.000Z` are the same instant; a `ts` may also be epoch seconds or ms. A record with no parseable
`ts` is dropped. `T` is truncated to the second, which can only drop data, never leak it.

## API

```ts
import { asOf } from "doomclock/pipeline/asof/asof.ts";
const a = asOf("2026-10-24T20:51:00Z");        // or epoch ms, or a Date; opts {clean?: dir, markets?: MarketsFile}
a.T, a.t                                        // T as ISO (to the second) and epoch ms
a.records("aiid")                               // clean rows with ts < T, sorted by ts (any source in data/clean)
a.series("manifold:F3WW…") / a.priceAt(id)      // daily closes with t < T / the last one, {p, ts}
a.anchors()                                     // StateNode[]: the 4 anchors with history, pRange12m, lastTradeTs
a.anchorHistory()                               // World.anchorHistory (Record<NodeId, AnchorHistory>)
a.warnings()                                    // StateWarning[]: the 4 Manifold warning pins priced at T
a.capabilityCurve()                             // the KXAGICO curve (CapabilityCurve), null before 2026-03-04
a.events()                                      // WorldEvent[], 2024-10-24 <= ts < T, with who/where/detail/major
a.government()                                  // government.jsonl rows with ts < T
a.state() / a.marketInputs() / a.eventsFile()   // the three data files, exactly as the builders write them
```

Market ids: `manifold:<id>`, `kalshi:<ticker>`, `pm:<id>`, or bare (an upper-case id is a Kalshi ticker, a numeric
one Polymarket, anything else Manifold). The clean files are read once per process and cached.

## What is not point-in-time

- `traders` on each anchor is the count at the 24 Oct 2026 fetch: Manifold gives no trader history.
- `data/signal-inputs.json` (region weights, the AIID rate) is built by `derive/signal-inputs.ts` over a fixed
  window (2025-01 to 2026-09); `publish:cache` reads it as is.

## The browser World

`npm run publish:cache` (in `doomclock/web`) builds `public/cache/world.json` from `asOf(T)`, where T is the
`asOf` of `data/state.json` (the data freeze, 2026-10-24T20:51:00Z) or `--asOf=ISO`. State, curve, events and the
Bulletin setting all come from the same `asOf(T)`, so they can't drift apart.

## Tests

`node --test doomclock/pipeline/asof/` (also part of `npm test` in `doomclock/web`). A fixture with every source holds
rows before T in three formats (`Z`, `.000Z`, epoch seconds), a row exactly at T (`.000Z`), poison rows after T
(price 0.999, title "POISON") and an undated row; no poison and no time after T comes out of any function. The same
property is then checked on the real `data/clean` files at three T.
