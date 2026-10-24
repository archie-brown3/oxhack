# METR time horizons (`data/clean/metr.jsonl`)

**What / feeds:** the length of task (in human minutes) an AI agent completes with 50% success, per model; feeds the capability trend, the most on-theme TIME series.

- **Source:** GitHub `METR/eval-analysis-public` raw runs (`runs.jsonl` for reports time-horizon-1-0 and 1-1), `data/external/release_dates.yaml`, `params.yaml`. The repo ships no summary CSVs (DVC-tracked, not downloadable), so horizons are **recomputed by us, not METR's published figures**.
- **Re-run:** `node doomclock/pipeline/fetch/metr.ts` then `node doomclock/pipeline/fetch/clean.ts metr`. Raw: `data/raw/metr/` (37 MB, repo paths preserved).
- **Method:** per model, ridge-regularised logistic fit of `score_binarized` on log2(`human_minutes`) weighted by `invsqrt_task_weight`; horizon = 2^(−a/b). CI = percentile 2.5–97.5 of 300 task-cluster bootstrap fits (fixed seed). The 1-1 report is preferred, the 1-0 report fills models absent from it.
- **Record:** `ts, source:"metr", kind:"eval", id, url, model, report, time_horizon_50_min, ci95_low_min, ci95_high_min, n_runs, n_tasks`.
- **`ts`:** the model's release date from `release_dates.yaml` (00:00Z). METR's own publication of each result came later, so for a strict "known at" test add a lag.
- **Filters:** release date ≥ 2024-10-24; aliases without a release date, and the `human` baseline, dropped.
- **Counts:** 23 models, 2024-12-05 → 2026-02-05; 8 KB. Sanity: o3 ≈ 120 min, Claude 3.7 Sonnet ≈ 60 min, GPT-5 ≈ 203 min, Claude Opus 4.6 ≈ 720 min (CI 355–2,387).
- **Quirks:** public repo stops at Feb 2026. Our fit is close to, not identical to, METR's (different regularisation/bootstrap, so values differ by tens of percent). Pre-range models (e.g. Claude 3.5 Sonnet, GPT-4o) are excluded by the date filter, so the first points are Dec 2024.
