# Dated news archives for the Doom Clock (replacing Hacker News)

Research input, not design. Checked 24 Oct 2026 with real keyless requests from this machine. No accounts were created and
nothing was signed up for. "Verified" = I saw it in a response; "unverified" = from docs/search snippets, with the source.

Need: records for Oct 2024 → now with `ts` = when the piece became public, so point-in-time code can filter `ts < T`
(CLAUDE.md "Clean data"). Free, API-only (no HTML scraping), and the backtest needs history, not just today's feed.

## Summary

| Source | Keyless? | History Oct 2024 → now | Text | `ts` | Cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **GDELT DOC 2.0** | yes | one-day window in Jan 2025 verified; month windows untested (429) | headline only | `seendate`, **seconds**, but it is when GDELT *saw* it | free | Discovery layer for headlines across outlets; not a text archive; throttled hard. |
| **Guardian Open Platform** | **no** (free key) | full archive; ~1.9m items | **full article text** with the free key | `webPublicationDate`, seconds | free for non-commercial | Best single source if the key terms fit. |
| **NYT Archive API** | **no** (free key) | every month back to 1851 | headline, abstract, lead paragraph, snippet; no body | `pub_date`, seconds | free | Good metadata and monthly bulk; no full text. |
| **NYT Article Search** | **no** | same corpus | same fields as Archive | `pub_date` | free | Filtered queries; tight limits. |
| **Common Crawl CC-NEWS** | yes (public S3/HTTPS) | monthly WARC files, ~370–510 per month | full HTML | WARC date + page's own date | free, but large | Real archive, heavy to process; not feasible in 25 h. |
| **BBC / Guardian / NYT RSS** | yes | last ~days only | headline + blurb | feed date | free | Live feed only; useful for the final "today" step. |

## 1. GDELT DOC 2.0 API

`https://api.gdeltproject.org/api/v2/doc/doc?query=…&mode=artlist&format=json`

**What I verified**

- Keyless: one successful call returned articles for `query=openai&timespan=1d` with fields `url`, `url_mobile`, `title`,
  `seendate` (`20261023T230000Z`), `socialimage`, `domain`, `language`, `sourcecountry`. **No body text, no description.**
- Rate limit: the server answers HTTP 429 with the message "Please limit requests to one every 5 seconds". In practice it was
  much stricter from this machine: a request after a quiet minute sometimes worked, but most of my ~17 calls over
  ~60 minutes got 429 (each 429 took ~12 s to return) even when spaced 45–75 s apart. The existing note in
  `context/ai-doom-data.md` ("429 twice, don't rely on it") matches. Treat as **at most a few calls a minute, with retries**.
- `seendate` is when GDELT's crawler *saw* the page, not the article's publication time; for most outlets they are close,
  but a late-seen old article gets a late `ts`. That is conservative for no-leakage (it can only be later than the real
  publication), so it is safe for `ts < T` filtering.
- Outlet filter is `domain:`; my multi-outlet query (BBC, CNN, WSJ, Reuters, Guardian, NYT) is in the results below.

**Depth and mode limits (unverified, from GDELT's own blog + third-party client docs)**

- GDELT's blog (18 May 2018) says DOC 2.0 searches "from January 1, 2017 to present", but that **non-timeline output modes
  (including `artlist`) only consider the last 3 months of the specified search window**. Reading: you can pass
  `startdatetime`/`enddatetime` for an old window, but a result set is capped to the three most recent months *within that
  window*. My own historical tests are reported in the results block.
- `maxrecords` up to 250 for `artlist` (client docs).
- `domain:` is a loose match (substring), so `domain:cnn.com` also matches look-alike domains.

**Outlets:** the Guardian, BBC, CNN, NYT, WSJ and Reuters are all domains GDELT monitors in general, but coverage per outlet
over the whole period is not confirmed; see results.

**Licence:** GDELT data is free to use with citation; the linked articles remain the outlets' copyright.

**Verdict.** Useful for "what headlines existed across outlets in week W" and for finding URLs, **not** as the backbone:
headline-only, throttled, and `artlist` depth for the backtest window (Mar 2025 →) is the open risk. Recommend asking
GDELT's author for a higher limit only if the team really needs it; otherwise skip.

### Results of my GDELT calls

| # | Request | Result |
| --- | --- | --- |
| 1 | `query=openai&timespan=1d`, artlist | **200**, articles with fields above (engadget.com, moneycontrol.com, …). |
| 2 | `openai domain:bbc.com`, `timespan=7d` | 200, **`{}`** (empty: no BBC match in a week for that query/domain form; `bbc.co.uk` untested successfully). |
| 3 | `openai`, `startdatetime=20250115000000&enddatetime=20250116000000`, 3 records | **200 in 17.8 s**, 3 articles dated `seendate` 2025-01-15 (engadget.com, tribune.com.pk, niemanlab.org). **A one-day window 9 months back works.** |
| 4 | multi-outlet (BBC, CNN, WSJ, Reuters, Guardian, NYT) × `timespan=30d`, 250 records | 429 |
| 5 | `openai` × 4 outlets, month window Nov 2024, 10 records | 429 (so the month-wide old-window test is **inconclusive**) |
| 6 | Single-outlet queries for `bbc.co.uk`, `cnn.com`, `wsj.com`, `reuters.com`, `theguardian.com`, `nytimes.com` | all 429 across several attempts; **no outlet-level coverage verified**. |
| 7 | `timelinevol` over Nov 2024 → Sep 2026 | not completed in time. |

Of about 17 calls over ~60 minutes, 2 returned data (plus one empty `{}`), the rest 429. The three articles in #3 and the
"top" in #1 were not from BBC/CNN/WSJ/Reuters/Guardian/NYT, which fits GDELT ranking by relevance/social signals, so even
a working call may not surface the big outlets you ask for without the `domain:` filter, and that is the filter I could
not get through.

## 2. Guardian Open Platform

Page read: `https://open-platform.theguardian.com/access/` and the terms
(`https://www.theguardian.com/open-platform/terms-and-conditions`, dated 4 Feb 2015, still the linked terms).

- **Key needed: yes.** Verified: no key → `HTTP 401 {"message":"No API key found in request"}`; `api-key=test` → 401 "Unauthorized".
  I did not register.
- **Developer key (free):** "any non-commercial usage… such as student dissertations, hackathons, nonprofit app developers".
  **Up to 1 call per second, up to 500 calls per day, access to article text, access to over 1,900,000 pieces of content.**
- **Commercial key:** priced by usage; required for "training models for generative artificial intelligence services, text
  and data mining solutions, sentiment analysis where content is not reproduced". Our use (feeding article text to LLM
  personas and a panel) is closest to that clause. **Question for Archie:** is a hackathon demo "non-commercial" enough, and
  is putting full text into LLM prompts "training"? Safest reading: use headlines + `trailText` (short standfirst) +
  link, and keep body text out of seeds, or ask `licensing@theguardian.com`.
- **Terms (2015 text):** developer service returns full text with embedded advertising; the older terms limit to 500
  requests/key/day and require attribution; Developer content may not be reproduced beyond what the terms allow.
  Read the current terms before storing the text in a repo.
- **Fields (unverified, from API docs I know; confirm with a key):** `webPublicationDate` (ISO, seconds), `webTitle`,
  `webUrl`, `sectionId`, `pillarName`; with `show-fields=trailText,standfirst,body,byline,wordcount` for text. Filters:
  `q`, `from-date`, `to-date`, `section`, `tag` (e.g. `technology/artificialintelligenceai`), `order-by`, `page-size` up
  to 50, `page`. The site's documentation page does not list them (the page only had a menu in my fetch).
- **Archive depth:** "all the content the Guardian creates"; ~1.9m items. Oct 2024 → now is certainly covered.
- **`ts`:** `webPublicationDate` is first publication; later edits update `lastModified` separately, so use the former.
- **Budget:** 500 calls/day × 50 items = 25,000 items/day. More than enough for an AI-tagged section over 24 months
  (a few thousand items).
- **Verdict:** **best fit.** Dated, full text, one key, small corpus if restricted to the AI tag. Needs a key (a 2-minute
  signup) and a decision on the licence question above.

## 3. NYT APIs

Developer portal pages are JavaScript-rendered and my fetch returned an empty shell, so **terms and limits below are
unverified, from search snippets**; read them at `developer.nytimes.com` before relying.

- **Key needed: yes.** Verified: both `/svc/archive/v1/2025/1.json` and `/svc/search/v2/articlesearch.json` return 401
  `Failed to resolve API Key variable request.queryparam.api-key` without a key.
- **Archive API** (`/svc/archive/v1/{year}/{month}.json`): all articles for a month in one response; per third-party
  docs it spans 1851 → today. Fields (from API docs I know, confirm): `headline.main`, `abstract`, `snippet`,
  `lead_paragraph`, `pub_date` (ISO with seconds and offset), `web_url`, `section_name`, `news_desk`, `keywords`,
  `byline`, `word_count`. **No article body.** 25 months of Archive = 25 calls, but each month is a very large JSON
  (every NYT item, not just AI), so filter on keywords/section after download.
- **Article Search** (`/svc/search/v2/articlesearch.json`): `q`, `fq`, `begin_date`/`end_date`, `sort`, `page`; 10 results per
  page; deep paging is capped (one source: beyond the 1,000th result).
- **Rate limit:** search results disagree: 5/min and 500/day (two recent third-party docs) versus an older 10/min and 4,000/day.
  Plan on **5/min, 500/day**.
- **Terms:** I could not read them. NYT's API terms historically limit use to non-commercial and restrict caching and
  redistribution; treat the same as the Guardian: headline + abstract + link only. **Verify.**
- **Verdict:** good second source for high-quality dated headlines + abstracts (lead_paragraph is often enough for a
  persona). Not a text archive. Needs a key.

## 4. Common Crawl CC-NEWS

- **Verified:** `https://data.commoncrawl.org/crawl-data/CC-NEWS/<yyyy>/<mm>/warc.paths.gz` is public, no key: Oct 2024
  has files from `CC-NEWS-20241001011351-06337.warc.gz`; month file counts: **2024-11 = 510, 2025-03 = 462, 2026-09 = 374**
  (two earlier runs returned 596 for 2025-10). A single WARC is **about 1.07 GB** (HEAD on `CC-NEWS-20251001002341-04358.warc.gz`).
  So a month is 400–600 GB.
- Full HTML of articles from many (not all) news sites, listed by crawl time. `index.commoncrawl.org` did not respond
  from here (000), so I did not test the CDX index; without it you cannot look up one outlet/date cheaply.
- **`ts`:** crawl time (WARC-Date) plus the page's own `article:published_time` if present: needs parsing. Coverage of
  BBC/WSJ/NYT behind paywalls is partial.
- **Verdict:** a legitimate archive, but terabytes and an HTML-parsing stage. **Not feasible before 25 Oct 12:00.** Mention
  as the "if we had a week" route.

## 5. Live RSS (for "today")

Verified 200 on 24 Oct 2026: Guardian `https://www.theguardian.com/technology/artificialintelligenceai/rss`, BBC
`https://feeds.bbci.co.uk/news/technology/rss.xml`, NYT `https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml`.
Keyless, headline + summary + `pubDate`, last handful of days only. Fine for the live refresh step; useless for backtest.
(`context/ai-doom-data.md` already lists Google News RSS the same way: live only.)

## Recommendation (for the design, not a decision)

1. **Backbone: Guardian** (AI tag, 24 months, with `trailText`/`standfirst`; body only if the licence allows).
2. **Second: NYT Archive** monthly pulls, filtered to AI keywords, with abstract only. Two outlets, two key signups.
3. **GDELT only as a discovery/filler** for BBC, CNN, WSJ and Reuters headlines: at most a handful of queries per
   week of the backtest window, aware that most will 429.
4. BBC/CNN/WSJ/Reuters full coverage is **not** available free with dated archives; say so in the pitch rather than imply it.
5. Every record to `data/clean/<source>.jsonl` with `ts`, `url`, `title`, short `text`, `outlet`, per the existing schema in
   `docs/data/*.md`; write `docs/data/guardian.md` and `docs/data/nyt.md` with the same fields.

## Open points

- Guardian developer-key licence vs LLM use (needs a human decision, may need an email).
- NYT terms and limits could not be read here.
- Whether `artlist` honours long (month-wide) old windows and how many results BBC/CNN/WSJ/Reuters yield (every outlet-filtered call 429'd).
- Whether AIID-first design (CLAUDE.md: "AIID is the primary event source") makes news a secondary context layer only; the
  news volume needed is small.
