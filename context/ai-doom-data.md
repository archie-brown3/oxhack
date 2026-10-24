# AI Doom Clock — data sources

Each source was checked with one request on 24 Oct 2026, about 16:30. ✅ = works with no key or
sign-up. ❌ = blocked. Facts not checked are marked "unverified".

## Probabilities (the model's inputs)

| Source | Status | What we get |
|---|---|---|
| Manifold `api.manifold.markets/v0` | ✅ | Open: ASI by 2030 0.36, by 2040 0.75, by 2100 0.86; AI kills ≥10% of humans before 2100 0.30; massive AI catastrophe before 2030 0.39; $100M loss-of-control incident 0.27; agent proliferation event before 2035 0.81. Resolved: 28 of the 100 most popular AI markets resolved after Sep 2025. `/bets?contractId=` gives full price history (1,000 bets on one market, Feb 2025 to Jun 2026). Backtest source. |
| Kalshi `api.elections.kalshi.com/trade-api/v2` | ✅ | **"When will any company achieve AGI?"** (`KXAGICO-COMP`), a ready-made CDF with real money: before 1 Jan 2027 6%, 1 Jul 2027 28%, 1 Jan 2028 39%, 1 Jul 2028 73%, 1 Jan 2030 81%. Thin at long dates (2031 is 78%, below 2030). Resolution rules unverified; likely "a company announces AGI", which is a much lower bar than Manifold's ASI. Also "US government takes control of an AI company before 2030" (`KXUSTAKEOVER-30`). |
| Polymarket gamma + CLOB | ✅ | Mostly "which lab has the best model" markets, no doom markets found. `clob.polymarket.com/prices-history` works (71 daily points on one market). Useful for a "who's leading the race" panel and more backtest questions. |
| Metaculus | ❌ 403 | Needs a token. |

## Capability trend ("how fast is the clock running")

| Source | Status | What we get |
|---|---|---|
| Epoch AI `epoch.ai/data/notable_ai_models.csv` | ✅ | 1,079 models, 47 columns, 1950 to 30 Sep 2026: publication date, organisation, country, parameters, training compute (FLOP), training cost (USD). Supports a compute-doubling trend line. `all_ai_models.csv` (6.8 MB) is larger. |
| METR time horizons (GitHub `METR/eval-analysis-public`) | ✅ | `reports/time-horizon-1-1/data/raw/runs.jsonl`: raw agent task runs behind "the length of task AI can do doubles every ~7 months" (doubling figure unverified here). This is the most on-theme TIME dataset. |
| OpenRouter `/api/v1/models` | ✅ | Every model available now, with created dates. Gives a live count of model releases. |
| LMArena | ❌ 403 | Use Polymarket's "best model" markets instead. |

## Incidents (warning signs)

| Source | Status | What we get |
|---|---|---|
| AI Incident Database snapshots | ✅ | Weekly full backup, latest 19 Oct 2026, 120 MB `.tar.bz2` (MongoDB export, format unverified). Incidents with dates allow an incident-rate trend. The GraphQL API is ❌ (origin-restricted). |
| OECD AI Incidents Monitor `oecd.ai/en/incidents` | ✅ page | HTML page only; no API checked. |

## News (what the agent panel reads)

| Source | Status | What we get |
|---|---|---|
| Hacker News Algolia | ✅ | Dated search (`numericFilters=created_at_i>…`), points filter, so the backtest sees only past news. |
| Google News RSS | ✅ | Live AI-safety headlines (127 KB feed). Live only, no date filter. |
| arXiv API | ✅ | Papers by query and date, e.g. an "AI safety" paper count per month. |
| GDELT doc API | ❌ 429 twice | Rate-limited from here; don't rely on it. |
| Reddit JSON | ❌ 403 | |

## Context and attention

| Source | Status | What we get |
|---|---|---|
| Wikipedia "Doomsday Clock" wikitext | ✅ | Full timeline table 1947→now (year, minutes to midnight, reason). Plot ours against theirs. |
| Wikimedia pageviews API | ✅ | Daily or monthly views per article. "Existential risk from AI" only returned data from Sep 2024 (the article was likely renamed), so query the old titles too. |
| Doomsday Clock 2026 statement | ✅ | See `doomsday-clock-2026.md`. |
