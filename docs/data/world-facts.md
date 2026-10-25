# World facts (`data/clean/world-facts.jsonl`)

**What / feeds:** eight checked turning points of the starting state (game plan §6, task 103). They become major
`WorldEvent`s (`source: "world-facts"`) in `data/events.json`, the globe's newsflashes, the MiroFish seed's turning
points and the lab personas. Hand-written from records already in our data; nothing is invented.

- **Record:** `ts, id ("fact:<slug>"), kind (government|news), text (one sentence), detail (one sentence, with the
  evidence), who, where? (ISO 3166-1 alpha-3), source, url`. `source` is the record that proves it: a market id
  (`kalshi:<ticker>`, `pm:<id>`) or a URL.
- **`ts`:** when it was public, never earlier. For a Kalshi market that resolved YES: its `settlement_ts` from the raw
  market response (`data/raw/kalshi/markets/<series>/`), rounded up to the second. For a dated event described in a
  market's text or an article: 23:59:59Z of that day (the Wikipedia convention). Every `ts` is before 2026-10-24.
- **Rows:** DeepSeek government-device ban becomes law (Kalshi YES, 21 Dec 2025); the Pentagon names Anthropic a
  supply-chain risk (27 Feb 2026, Polymarket pm:1509260's text); Claude Fable 5 suspended after a US directive
  (12 Jun 2026, pm:2534929); the "Pacing the Frontier" letter (28 Jul 2026, Reuters); Nvidia H200 deliveries to China
  confirmed (Kalshi YES, 5 Aug 2026); a major lab pauses research for safety (KXAIPAUSE YES, 6 Aug 2026); OpenAI's
  training pause (25 Sep 2026, pm:5008726, see AIID #1710); the US-China AI hotline (Kalshi YES, 30 Sep 2026).
- **One substitution:** the plan lists a "pace essay, 2026-09-12". No record in our data backs that date, so the row
  is the "Pacing the Frontier" open letter of 28 Jul 2026 (Wikipedia's dated line, citing Reuters). The Wikipedia line
  with the same URL is dropped from `events.json` so the fact appears once.
- **KXAIPAUSE** resolved YES without naming the lab; the row says "a major AI lab".
- **RSS headlines** (`rss.jsonl`, optional): not written. The demo review cut it, and the data freeze had passed.
- **Check:** `node doomclock/pipeline/fetch/assert-p2.ts` (8 rows, every `ts` < 2026-10-24, every source a market id,
  AIID id or URL, every market source a market row in `data/clean`).
