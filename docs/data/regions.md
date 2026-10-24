# Region weights (US / China / rest)

**What / feeds:** DS3. Checks the game-design weights **US 0.58 / China 0.30 / rest 0.12**, said to come "from Epoch" but unverified.

- **Script:** `node doomclock/pipeline/derive/regions.ts` (prints the table; writes nothing). Reads `data/clean/epoch.jsonl` (last 24 months; the clean file is filtered to ≥ 2024-10-24) and the raw `data/raw/epoch/notable_ai_models.2026-10-24.csv` (all time). Both are read-only.
- **Method:** region from Epoch's "Country (of organization)". A model with several listed countries is split evenly between them; models with no country are left out. `US` = United States of America, `China` = China (Hong Kong counts as `rest`), everything else `rest`.

| Metric | US | China | rest | n | max abs diff vs 0.58/0.30/0.12 |
|---|---|---|---|---|---|
| notable models, all time | 0.60 | 0.15 | 0.25 | 1060 | 0.146 |
| **notable models, last 24 months** | **0.59** | **0.33** | **0.09** | 213 | **0.034** |
| training compute, all time | 0.91 | 0.08 | 0.01 | 525 | 0.326 |
| training compute, last 24 months | 0.92 | 0.07 | 0.01 | 67 | 0.339 |
| frontier models, all time | 0.74 | 0.04 | 0.23 | 116 | 0.264 |
| frontier models, last 24 months | 1.00 | 0.00 | 0.00 | 8 | 0.420 |

(n = models counted; compute needs a compute estimate, which about half the rows lack.)

## Finding

- **No metric reproduces 0.58/0.30/0.12 exactly.** The nearest is the **share of notable models published in the last 24 months** (0.59 / 0.33 / 0.09). It matches US within 0.01, China within 0.03, rest within 0.03. So the numbers are plausibly a rounded, hand-adjusted version of that count; there's no sign they came from compute.
- Compute share gives US ~0.9 and China < 0.1, and the AI datacentre list (`datacentres.md`) agrees: US ~89% of known power. By capacity the world is far more US-heavy than the game assumes.
- "Frontier" counts are too small (8 in 24 months) to use.

## Recommendation

Use **notable-model count, last 24 months: US 0.59 / China 0.33 / rest 0.09**, computed by this script and labelled "share of notable AI models, last 24 months (Epoch)". It's a real, reproducible number and close to what the game already assumes, so the 0.58/0.30/0.12 values can be replaced with it (or kept and cited as "≈"). The UI should say what it measures: it's a count of notable *models*, not of compute or capability, and under a compute measure China nearly vanishes. If the game wants a "who controls capability" weight, say so and pick the compute row instead; that is a design call for the Lead / game-design.

Caveats: Epoch revises rows after the fact, so the numbers move a little between fetches; a 24-month window of 213 models is noisy (±~0.03 per region).
