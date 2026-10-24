# Hacker News (`data/clean/hn.jsonl`)

**What / feeds:** AI-related HN stories; what the three-persona panel reads as "news" at a date T.

- **Source:** Algolia `https://hn.algolia.com/api/v1/search_by_date?tags=story` with `created_at_i` windows. Queries: AI, LLM, AGI, OpenAI, Anthropic, DeepMind, GPT, Claude, Gemini, superintelligence, alignment.
- **Re-run:** `node doomclock/pipeline/fetch/hn.ts` (resumable; ~45 min, ~0.15 s between requests) then `node doomclock/pipeline/fetch/clean.ts hn`. Raw: `data/raw/hn/<query>/<from>_<to>.json` (epoch seconds, 7-day windows over 2024-10-24 → 2026-10-24; 429 MB). Each file is `{query, from, to, nbHits, hits[]}` as returned. A `.split` marker means the window had >1,000 hits (Algolia's cap) and was halved until each part fit.
- **No points filter at download** (final points would leak future popularity); raw keeps `points`/`num_comments` as fetched on 24 Oct 2026.
- **Record:** `ts, source:"hn", kind:"story", id` (HN objectID)`, url` (HN item page)`, title, link` (external URL or null)`, points, num_comments, queries[]` (which queries matched).
- **`ts`:** story `created_at` (submission time).
- **Filters:** points ≥ 20; deduplicated across queries; Algolia prefix-matches ("AI" hits "AirPods", "AGI" hits "agent"), so a story is kept only if its title matches an AI regex (ai, llm, gpt*, chatgpt, openai, anthropic, deepmind, neural, language model, machine learning, agi, claude, gemini <variant>, copilot, alignment, superintelligence) or the query "OpenAI"/"Anthropic"/"DeepMind"/"superintelligence" matched.
- **Leakage rule for the backtest:** `points` and `num_comments` are final values. At time T use only stories with `ts ≤ T − 48 h`, by which point points have mostly settled; the ≥20 cut is then safe.
- **Counts:** 9,078 stories, 2024-10-24 → 2026-10-24; 2.8 MB. Per month: 2024-10 66 (from the 24th), 11 175, 12 192; 2025: 261, 267, 301, 278, 310, 336, 375, 401, 314, 343, 298, 334; 2026: 397, 488, 508, 491, 430, 465, 557, 507, 606, Oct (to the 24th) 378.
- **Quirks:** some noise remains (e.g. "LLM" matching non-AI words in the title is filtered out only if the title lacks every AI term). Stories deleted/flagged before the fetch are absent. The last window (Oct 2026) was fetched on 24 Oct and is incomplete; re-run to extend.
