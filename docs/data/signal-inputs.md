# Signal inputs (`data/signal-inputs.json`)

**What / feeds:** `SignalInputs` in `doomclock/web/src/contracts.ts`. `regions` drives the map tint (`WorldFrame.regions`); `warningRate.perQuarter` is λ, the rate at which projected frames sample incident pings. Both come from clean data, so the engine holds no typed-in numbers.

- **Script:** `node doomclock/pipeline/derive/signal-inputs.ts`. Reads `data/clean/epoch.jsonl` and `data/clean/aiid.jsonl` (read-only) and writes `data/signal-inputs.json`.
- **Gate:** the script exits 1 with `wait for item B` if any AIID record has `ts` before its `event_date`. λ needs the fixed AIID `ts` (= max(first report, event_date)).

## Fields and method

- **`schema`:** `doomclock.signal-inputs/1`.
- **`regions` {US, China, rest, metric, source}:** share of Epoch notable AI models published in the last 24 months. Every row of `data/clean/epoch.jsonl` is used, because that file already holds only models from 2024-10-24 on. Same rules as `derive/regions.ts` (see `regions.md`):
  - region from "Country (of organization)": `United States of America` → US, `China` → China, everything else (Hong Kong included) → rest;
  - a model listing several countries is split evenly between them;
  - models with no country are left out (1 of 214);
  - normalised to sum 1, not rounded.
- **`warningRate` {perQuarter, window, source}:** λ = AIID incidents with `2025-01-01 ≤ ts < 2026-10-01`, divided by 7 quarters. `window` is `{from: "2025-01", to: "2026-09"}`. October 2026 is left out because AIID's latest month is undercounted (incidents are added weeks after the first report).
- **`datacentres`:** the datacentres agent owns this array. If `data/signal-inputs.json` already exists, the script keeps its `datacentres` exactly as they are; otherwise it writes `[]`.
- **`ticker`:** `[]`. In phase 1 the ticker reads `data/events.json`.

## Result (24 Oct 2026)

| Field | Value | n |
|---|---|---|
| regions.US | 0.589 | 213 models |
| regions.China | 0.326 | |
| regions.rest | 0.086 | |
| warningRate.perQuarter | 108.86 (762 / 7) | 762 incidents |

- Regions match `regions.md` (0.59 / 0.33 / 0.09). They are a count of notable *models*, not compute: under a compute measure China nearly vanishes (US ~0.92).
- Incidents per quarter, 2025 Q1 → 2026 Q3: 110, 112, 102, 116, 112, 94, 116. The rate is flat, so one λ fits the whole window.
- The item-B `ts` fix moved 31 incidents later; one entered the window and one left it, so the count stayed at 762.

## Notes

- **λ counts all AIID incidents** (about 109 a quarter), not a filtered "warning" subset. That is the same density the real frames show, so projected frames ping at the rate the real ones do.
- **The region weights are one static set, not per quarter.** The map tint does not change between frames; 213 models in 24 months is too few to split by quarter (±~0.03 per region already).
- **`datacentres` and `ticker` are deliberately empty in phase 1.** The datacentres agent fills the first; the ticker reads `data/events.json` instead.
- Epoch revises rows after the fact, and AIID backfills recent incidents, so both numbers move a little between fetches. Re-run the script after re-cleaning either source.
