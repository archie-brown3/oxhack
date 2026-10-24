# Epoch AI notable models (`data/clean/epoch.jsonl`)

**What / feeds:** Epoch's database of notable AI models; feeds the capability trend (training-compute line).

- **Source:** `https://epoch.ai/data/notable_ai_models.csv` (whole file, 47 columns). `all_ai_models.csv` was fetched but is not used.
- **Re-run:** `node doomclock/pipeline/fetch/epoch.ts` (one copy per day) then `node doomclock/pipeline/fetch/clean.ts epoch`. Raw: `data/raw/epoch/*.2026-10-24.csv` (8.7 MB).
- **Record:** `ts, source:"epoch", kind:"model", id` (slug of model name)`, url` (Epoch's link, may be null)`, model, org, country, domain, parameters, training_compute_flop, training_cost_2023usd, frontier` (bool)`, open_weights`. Unknown numbers are `null`.
- **`ts`:** `Publication date` at 00:00Z (the model's release/paper date).
- **Filters:** publication date ≥ 2024-10-24 and a full `YYYY-MM-DD` date.
- **Counts:** 214 records, 2024-10-28 → 2026-09-30; 80 KB. Per month: 2024-10 1, 11 8, 12 13; 2025: 10, 4, 10, 6, 7, 4, 10, 11, 8, 6, 19, 12; 2026: 1, 9, 9, 17, 6, 9, 7, 8, 19.
- **Quirks:** Epoch adds and revises rows after the fact, so the file is today's knowledge: a model may have been listed weeks after its `ts`. Cost and compute are often empty for closed models. `Parameters`/compute are estimates.
