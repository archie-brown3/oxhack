# Wikipedia "Year in AI" (`data/clean/wikipedia_ai.jsonl`)

**What / feeds:** the big dated AI headlines (DeepSeek-R1, Stargate, EO 14179, SB 53, the Grok bans) for the
real-frame news ticker, plus government actions outside the US that the official-register sources miss. This is the
keyless news source while Hacker News is dropped and the Guardian/NYT keys are pending (see the end).

- **Source:** the `== Events ==` sections of the English Wikipedia articles "2024 in artificial intelligence",
  "2025 in artificial intelligence" and "2026 in artificial intelligence". One MediaWiki API call, with no key:
  `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&format=json&formatversion=2&titles=2024_in_artificial_intelligence|2025_in_artificial_intelligence|2026_in_artificial_intelligence`
  (User-Agent `oxhack-doomclock/0.1 (hackathon project; contact via GitHub)`). Revisions fetched on 24 Oct 2026:
  2024 = 1369594157, 2025 = 1371121903, 2026 = 1380243437.
- **Re-run:** `node doomclock/pipeline/fetch/wikipedia-ai.ts`. It fetches and parses in one step. The raw response is
  saved as `data/raw/wikipedia/year-in-ai.<YYYY-MM-DD>.json` (66 KB). If today's file already exists, the script
  skips the fetch and parses the saved copy. The file's mtime is the fetch time.
- **Record:** `ts, source:"wikipedia", kind ("news" | "government"), id ("wiki:<YYYY-MM-DD>-<k>", where k is the
  item's 1-based position within that day, in article order), url, title, region? ("US" | "China" | "rest", left
  out when unknown), article (page title), revid`.
- **`ts`:** `YYYY-MM-DDT23:59:59Z`, the end of the event's UTC day. The articles give only a day, so this is the
  latest time at which the news was public. Records from before `2024-10-24T00:00:00Z` are dropped. Records with
  `ts` ≥ the fetch time are also dropped, because the 2026 article lists scheduled future events.

## Parse rules

- **Section:** only the `== Events ==` section, ending at the next level-2 heading.
- **Month:** taken from the `=== Month ===` headings. Spacing varies (`===January===` and `=== May ===` both appear).
  A month written in the item itself takes precedence over the heading.
- **Items:** `*` lines that start with `<day> [<Month>] <dash> text`, where the dash is `–`, `&ndash;` or `-`.
  - A date-only line such as `* 27 January` gives its date to each `**` line under it.
  - In date ranges (`10–11 February`, `10 February – 11 February –`), the first day is used.
  - Lines with no day are dropped, for example `* Unspecified date – …`.
- **title:** the item text with the markup stripped:
  - removed: `<ref …/>`, `<ref …>…</ref>`, `{{…}}` templates (here only maintenance tags such as
    `{{primary inline}}`), HTML comments and tags, and `''`/`'''`;
  - converted: `[[a|b]]` → b, `[[a]]` → a, and `&ndash;` and other HTML entities to their characters;
  - whitespace is collapsed;
  - text over 240 characters is cut at a word boundary and ends with `…` (31 records).
  - Items whose text is under 20 characters are dropped as too thin for a headline. One record:
    2026-02-13 "GPT-4o is retired.".
- **url:** the `url=` of the first `{{cite …}}` template with an http(s) url in the item's refs, in order. A named
  ref (`<ref name=x/>`) resolves to the first `<ref name=x>…</ref>` in the same article. If no ref has a url, the
  fallback is `https://en.wikipedia.org/wiki/<YYYY>_in_artificial_intelligence`. The fallback is used 0 times today.
- **kind:** `government` if the text contains "Executive Order", or if it contains a government actor together with
  an official action (case-insensitive). Otherwise `news`.
  - Actors from the brief: government, ministry, minister, parliament, congress, senate, president, White House,
    governor, European Commission, EU, state of.
  - Actions from the brief: signs/signed, passes/passed, enacts, bans/banned, blocks/blocked, orders, fines/fined,
    "publishes … plan/law/rules", become(s) applicable, takes effect, in force.
  - **Extension (added here, beyond the brief):**
    - extra actors: department, attorney general, council, Ofcom, city of, or text that opens with a country or
      place name from the region lists (e.g. "Indonesia blocks …");
    - extra actions: lifts, sues, files/filed a lawsuit, investigation, agreement.
  - The brief's lists alone give 5 government records, all from 2025. The 2026 article's government actions would
    all be `news`: the Grok bans by Indonesia, Malaysia and the Philippines and their lifting, Ofcom's investigation
    of X, Baltimore's and British Columbia's suits, Florida's probe and suit, the EU AI-rules agreement and the US
    export-control lift. The extension adds exactly these 13 records, and every one was checked by hand.
  - The brief's required cases still hold. EO 14179 (2025-01-23), SB 53 (2025-09-29) and the EU general-purpose AI
    obligations (2025-08-02) are `government`. Cloudflare blocking AI crawlers (2025-07-01) and Grok's antisemitic
    posts (2025-07-08) are `news`.
  - The classifier reads the full stripped text, not the cut title.
- **region:** item B's AIID text rule, applied to the full stripped text:
  - China if it matches `China|Chinese|Beijing|Shanghai|Shenzhen`;
  - otherwise `rest` if it names any country or demonym on the rest-of-world list (UK, EU, European, Japan,
    Indonesia, …; Hong Kong and Taiwan count as `rest`);
  - otherwise US if it matches (case-sensitive) `U.S.|US|United States|American|America|California|Texas|New York|Florida|FBI|FTC|Congress|Pentagon|Trump|Biden`.
  - The field is left out when nothing matches.
  - Word edges use letter/digit lookarounds instead of `\b`, so that "U.S." matches before a space.
  - The rules run in order, so a text that names both the US and Japan is `rest`. Example: Sora 2 (2025-09-30)
    mentions Japan's minister.

## Counts (fetched 2026-10-24T20:48:29Z)

- **82 records** (36 KB): 64 news and 18 government.
  - By article: 2024 = 2, 2025 = 48, 2026 = 32.
  - By region: US 20, rest 13, China 1, none 48.
  - Before the panel's earliest T (2025-03-01): 14.
- **Per month:**

  | Month | Records |
  |---|---|
  | 2024-12 | 2 |
  | 2025-01 | 6 |
  | 2025-02 | 6 |
  | 2025-03 | 2 |
  | 2025-04 | 1 |
  | 2025-05 | 3 |
  | 2025-06 | 4 |
  | 2025-07 | 6 |
  | 2025-08 | 4 |
  | 2025-09 | 5 |
  | 2025-10 | 5 |
  | 2025-11 | 6 |
  | 2025-12 | 0 |
  | 2026-01 | 7 |
  | 2026-02 | 3 |
  | 2026-03 | 2 |
  | 2026-04 | 2 |
  | 2026-05 | 1 |
  | 2026-06 | 2 |
  | 2026-07 | 2 |
  | 2026-08 | 1 |
  | 2026-09 | 9 |
  | 2026-10 | 3 |

- **Dropped:**
  - 12 items dated before 24 Oct 2024 (2024 article);
  - 1 item with no day ("Unspecified date");
  - 1 item under 20 characters;
  - 0 items in the future.
- The earlier dry-run figure of 73 left out the 10 `**` children of date-only lines (27 Jan 2025 ×2, 20 May 2025 ×2,
  8, 24 and 29 Sep 2026 ×2 each). The brief says those children count.

## Quirks

- **Hindsight curation.** Editors pick the events after the fact. Like AIID, this is selection bias toward what
  turned out to matter. Some text also states later knowledge. For example, Grok Imagine (2025-08-05) "becomes the
  subject of regulatory action … the following year". The first citation can also postdate the event: DeepSeek-R1
  (2025-01-20) cites a September 2025 Nature piece. These records are fine for the ticker. Do not feed their text to
  a point-in-time panel as if it were known at `ts`.
- **Event date ≈ news date.** The day is the day of the event. For announcements and releases it matches the news
  day; for court filings and similar events the coverage can land a day later. The end-of-day `ts` absorbs part of
  this.
- **English only.** The data comes from English Wikipedia. Coverage is uneven: the 2025 article has no December
  section, and the 2026 article is thinner, with a cluster in September 2026.
- **Revisions move.** A re-fetch on a later day takes the current revision, so counts and titles can change. `revid`
  on each record says which version it came from.

## Pending news sources

These would add per-outlet coverage once keys exist (see `docs/research/news-archives.md`):

- **Guardian Open Platform:** free developer key, 500 calls a day, full article text, archive back past 2024. The
  licence question is open: whether a hackathon demo is non-commercial, and whether putting the text into LLM prompts
  counts as "training". The safe default is headline, `trailText` and link.
- **NYT Archive API:** free key, one call per month of the archive, headline, abstract and lead paragraph, no body.

GDELT DOC 2.0 is keyless but heavily throttled (most calls returned 429 on 24 Oct) and headline-only, so it is not
used.
