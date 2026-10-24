# AI Incident Database (`data/clean/aiid.jsonl`)

**What / feeds:** community catalogue of AI harm incidents; feeds the warning-signs incident trend.

- **Source:** weekly snapshot linked from `https://incidentdatabase.ai/research/snapshots/` (GraphQL API is origin-restricted). Snapshot used: `backup-20261019101022`, fetched 24 Oct 2026. OECD AI Incidents Monitor has no export/API (HTML only); not used.
- **Re-run:** `node doomclock/pipeline/fetch/aiid.ts` (download + extract; skips if present), then `node doomclock/pipeline/fetch/clean.ts aiid`. Raw: `data/raw/aiid/backup-20261019101022.tar.bz2` (115 MB). The extracted dump is deleted after cleaning; `aiid.ts` re-extracts it.
- **Record:** `ts, source:"aiid", kind:"incident", id` (incident_id)`, url` (incidentdatabase.ai/cite/<id>)`, event_date` (when it happened)`, title, description` (≤400 chars)`, deployers[], developers[], harmed[], n_reports, first_report_url`.
- **`ts`:** the earliest `date_published` of the incident's linked reports, i.e. when it was first public. **Not** the AIID submission date (later) and not `event_date` (earlier).
- **Filters:** ts ≥ 2024-10-24; incidents with no dated report dropped (report dates in an odd `$numberLong` form are ignored). Reports and classification tables are not kept.
- **Counts:** 821 records, 2024-10-24 → 2026-10-11; 0.9 MB. Per month: 2024-10 11, 11 13, 12 25; 2025: 30, 43, 39, 44, 34, 33, 41, 40, 19, 41, 27, 49; 2026: 41, 36, 36, 32, 32, 30, 58, 26, 31, Oct (to the 11th) 10.
- **Quirks:** recent months are undercounted (incidents are added weeks after the report). The snapshot is today's state: an incident that was added to AIID late still gets its early `ts`, which is correct for "public" but means the backtest sees it only because of hindsight about AIID inclusion. Treat the last ~month as incomplete.
