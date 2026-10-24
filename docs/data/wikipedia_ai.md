# Wikipedia "Year in AI" (`data/clean/wikipedia_ai.jsonl`)

**What / feeds:** the big dated AI headlines (DeepSeek-R1, Stargate, EO 14179, SB 53, the Grok bans) for the
real-frame news ticker, plus government actions outside the US that the official-register sources miss. This is the
keyless news source while Hacker News is dropped and the Guardian/NYT keys are pending (see the end).

- **Source:** the `== Events ==` sections of the English Wikipedia articles "2024 in artificial intelligence",
  "2025 in artificial intelligence" and "2026 in artificial intelligence". One MediaWiki API call, with no key:
  `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&format=json&formatversion=2&titles=2024_in_artificial_intelligence|2025_in_artificial_intelligence|2026_in_artificial_intelligence`
  (User-Agent `oxhack-doomclock/0.1 (hackathon project; contact via GitHub)`). Revisions fetched on 24 Oct 2026:
  2024 = 1369594157, 2025 = 1371121903, 2026 = 1380243437.
- **Licence:** `title` is adapted from English Wikipedia text (CC BY-SA 4.0). Wherever titles are shown, credit
  Wikipedia, "<YYYY> in artificial intelligence" (the `article` field), with a link to
  `https://en.wikipedia.org/wiki/<YYYY>_in_artificial_intelligence`, and keep the adapted text under CC BY-SA. Each
  `url` points to the cited outlet, whose content stays under the outlet's copyright.
- **Re-run:** `node doomclock/pipeline/fetch/wikipedia-ai.ts`. It fetches and parses in one step. The raw response is
  saved as `data/raw/wikipedia/year-in-ai.<YYYY-MM-DD>.json` (66 KB). If today's file already exists, the script
  skips the fetch and parses the saved copy. The file's mtime is the fetch time.
- **Record:** `ts, source:"wikipedia", kind ("news" | "government"), id ("wiki:<YYYY-MM-DD>-<k>", where k is the
  item's 1-based position within that day, in article order), url, title, region? ("US" | "China" | "rest", left
  out when unknown), article (page title), revid`.
- **`ts`:** `YYYY-MM-DDT23:59:59Z`, the end of the event's UTC day. The articles give only a day, so this is the
  latest time at which the news was public. For a date range it is the end of the range's **last** day, because
  the item's text covers the whole range. Records from before `2024-10-24T00:00:00Z` are dropped. Records with
  `ts` ≥ the fetch time are also dropped, because the 2026 article lists scheduled future events.
- **Not point-in-time safe as text.** The titles come from the 24 Oct 2026 revisions, written after the fact. The
  parser removes the hindsight it can find (see `title` below), but the wording and the choice of events still
  reflect what later turned out to matter. Use the records as dated headlines (ticker, events); do not treat a
  title as exactly what was known at `ts` in a backtest prompt.

## Parse rules

- **Section:** only the `== Events ==` section, ending at the next level-2 heading.
- **Month:** taken from the `=== Month ===` headings. Spacing varies (`===January===` and `=== May ===` both appear).
  A month written in the item itself takes precedence over the heading.
- **Items:** `*` lines that start with `<day> [<Month>] <dash> text`, where the dash is `–`, `&ndash;` or `-`.
  - A date-only line such as `* 27 January` gives its date to each `**` line under it.
  - In date ranges (`10–11 February`, `10 February – 11 February –`), the **last** day is used. A range that runs
    from December into January ends in the next year. Three records today: the AI Action Summit (10–11 Feb 2025 →
    2025-02-11, when the declaration and the US/UK refusal came), the IMO golds (19–21 Jul 2025 → 2025-07-21, the
    date of DeepMind's announcement) and Warner Music's settlements (19–25 Nov 2025 → 2025-11-25, the Suno
    settlement named in the text).
  - Lines with no day are dropped, for example `* Unspecified date – …`.
- **title:** the **first sentence** of the item text, with the markup stripped. Later sentences are dropped
  because they are often hindsight added after the event: "Within days … goes viral" (2025-03-25), "Warner Bros.
  Discovery files a parallel suit in September" (2025-06-11), "OpenAI restores it … within days" (2025-08-07),
  "reaches the top of the U.S. App Store within 24 hours" (2025-09-30), "The authors subsequently lengthen their own
  timelines" (2025-04-03), "It becomes the most-cited counterweight" (2025-07-10). 26 records had more than one
  sentence.
  - A sentence ends at `.`, `!` or `?` (plus any closing quote) followed by a space. It does not end after an
    initial (`U.S.`, `Richard S.`), after `v.` (`Bartz v. Anthropic`) or after `Bros`, `Inc`, `Ltd`, `Corp`, `Co`,
    `Jr`, `Sr`, `Dr`, `Mr`, `Mrs`, `Ms`, `St`, `vs`.
  - Two hindsight clauses sit inside a first sentence and are cut by hand (the `TRIM` list in the script): Meta's
    Scale AI deal (2025-06-12) loses ", opening a year-long industry-wide competition …" and Grok Imagine
    (2025-08-05) loses ", a design decision that becomes the subject of regulatory action … the following year".
    If a later revision changes either text, the script prints a warning and the clause must be re-checked by hand.
  - Markup is stripped before the split. Removed: `<ref …/>`, `<ref …>…</ref>`, `{{…}}` templates (here only
    maintenance tags such as `{{primary inline}}`), HTML comments and tags, and `''`/`'''`. Converted: `[[a|b]]` → b,
    `[[a]]` → a, and `&ndash;` and other HTML entities to their characters. Whitespace is collapsed.
  - A first sentence over 240 characters is cut at a word boundary and ends with `…` (11 records).
  - Items whose first sentence is under 20 characters are dropped as too thin for a headline. One record:
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
  - The classifier reads the first sentence (after the hand trims, before the 240-character cut).
- **region:** item B's AIID text rule, applied to the first sentence (as for `kind`):
  - China if it matches `China|Chinese|Beijing|Shanghai|Shenzhen`;
  - otherwise `rest` if it names any country or demonym on the rest-of-world list (UK, EU, European, Japan,
    Indonesia, …; Hong Kong and Taiwan count as `rest`);
  - otherwise US if it matches (case-sensitive) `U.S.|US|United States|American|America|California|Texas|New York|Florida|FBI|FTC|Congress|Pentagon|Trump|Biden`.
  - The field is left out when nothing matches.
  - Word edges use letter/digit lookarounds instead of `\b`, so that "U.S." matches before a space.
  - The rules run in order, so a text that names both the US and Japan is `rest` (no record today names both).
  - Reading only the first sentence loses the region of five records whose place was named later, often in
    hindsight text: AI Action Summit (2025-02-11; "Paris" is not on the list, France was in sentence 3), Grok's
    antisemitic posts (2025-07-08; the Congress letter), Anthropic's settlement (2025-09-05; "U.S. history"), Sora 2
    (2025-09-30; Japan's later request) and OpenAI's recapitalisation (2025-10-28; the California and Delaware
    attorneys general).

## Counts (fetched 2026-10-24T20:48:29Z)

- **82 records** (34 KB): 64 news and 18 government.
  - By article: 2024 = 2, 2025 = 48, 2026 = 32.
  - By region: US 17, rest 11, China 1, none 53.
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
  turned out to matter. The article text also states later knowledge; the first-sentence rule and the two hand trims
  remove the clauses found on 24 Oct (see `title`), but a sentence written in 2026 can still frame an event with
  hindsight. The first citation can also postdate the event: DeepSeek-R1 (2025-01-20) cites a September 2025 Nature
  piece. The records are fine for the ticker and as dated events. Do not feed their text to a point-in-time panel as
  if it were known at `ts`.
  - The fully point-in-time option, not built: fetch each article's revision as of T
    (`…&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&rvstart=<T>&rvdir=older&rvlimit=1&titles=<one title>`,
    one call per article per T) and parse that instead. That revision lists only the events editors had added by T.
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
