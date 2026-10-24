# Doomsday Clock (`data/clean/doomsday_clock.jsonl`)

**What / feeds:** the Bulletin of the Atomic Scientists' clock setting; context line to plot ours against.

- **Source:** Wikipedia article wikitext, `https://en.wikipedia.org/w/index.php?title=Doomsday_Clock&action=raw` (timeline table).
- **Re-run:** `node doomclock/pipeline/fetch/wikipedia.ts` then `node doomclock/pipeline/fetch/clean.ts doomsday_clock`. Raw: `data/raw/wikipedia/doomsday-clock.2026-10-24.wikitext` (64 KB).
- **Record:** `ts, source:"doomsday_clock", kind:"setting", id` (year)`, url` (Bulletin statement page)`, seconds_to_midnight, change_seconds, reason` (≤500 chars, wiki markup stripped).
- **`ts`:** the statement date (00:00Z), taken from the article's own references and hard-coded in `clean.ts`: 2023-01-24, 2025-01-28, 2026-01-27. The table only lists years, so older rows have no exact date and are dropped.
- **Counts:** 3 records, 2023 (90 s), 2025 (89 s), 2026 (85 s); 2 KB. 2024 has no row because the setting was unchanged (90 s, statement 2024-01-23), so the 2023 record is the one in force at 24 Oct 2024.
- **Quirks:** next statement is expected late Jan 2027. Pageview series were dropped from scope.
