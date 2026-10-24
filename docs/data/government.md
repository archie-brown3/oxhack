# Government AI actions (`data/clean/government.jsonl`)

**What / feeds:** dated, real government AI actions (US executive orders and federal rules, UK government announcements, EU AI Act application dates). It is the baseline for the globe, the ticker and the "government events" stream that MiroFish simulates.

- **Sources** (all keyless JSON; fetched 24 Oct 2026):
  - **US Federal Register API**, `https://www.federalregister.gov/api/v1/documents.json`. Two queries, both with `per_page=200, order=oldest, conditions[term]="artificial intelligence", conditions[publication_date][gte]=2024-10-24`:
    - `conditions[type][]=PRESDOCU`: 41 hits.
    - `conditions[type][]=RULE&conditions[type][]=PRORULE`: 170 hits.
    - Fields: `title, publication_date, signing_date, html_url, subtype, executive_order_number, document_number, type, agencies`. The script follows `next_page_url` when there is more than one page.
  - **GOV.UK Search API**, `https://www.gov.uk/api/search.json`. The query is `count=500, order=public_timestamp, q=AI, filter_public_timestamp=from:2024-10-24`, with document types `press_release, policy_paper, news_story, speech` and organisations `department-for-science-innovation-and-technology, ai-security-institute, prime-ministers-office-10-downing-street`. It returns 392 hits.
  - **GOV.UK Content API**, `https://www.gov.uk/api/content<link>`, called once per kept search hit, 200 ms apart, to get `first_published_at`, `publishing_scheduled_at` and `scheduled_publishing_delay_seconds`.
  - **EU AI Act**: no API. Two rows are transcribed from Regulation (EU) 2024/1689, Art. 113 (`https://eur-lex.europa.eu/eli/reg/2024/1689/oj`).
- **Re-run:** `node doomclock/pipeline/fetch/government.ts`. This one script fetches whatever raw is missing, parses the saved raw and writes the clean file. It is resumable: raw that already exists is reused, so a second run the same day makes no network calls.
  - Raw: `data/raw/federal-register/{presdocu,rules}.2026-10-24.json` (180 KB). Pages after the first would be saved as `.p2.json` and so on.
  - Raw: `data/raw/govuk/search.2026-10-24.json` and `data/raw/govuk/content/<link with / replaced by _>.json`, 44 files (1.0 MB), next to a 1.0 MB search file.
  - Content files are keyed by link, not date, so later days only fetch new items.
- **Record:** `ts, source, kind:"government", id, url, title, region, issuer, doc_type`.
  - `source`: `"federal-register" | "gov.uk" | "eur-lex"`.
  - `id`: `fr:<document_number>`, `govuk:<link>` or `eu:ai-act-<date>`.
  - `title` is the display title:
    - `US Executive Order <n>: <title>` for EOs;
    - `<first agency> rule: <title>` for rules, or `proposed rule` when the type is PRORULE;
    - `UK government: <title>`;
    - `EU AI Act: …`.
  - `region`: `US` for the Federal Register, `rest` for the UK and the EU.
  - `issuer`: the first Federal Register agency, the first GOV.UK organisation title, or `European Union`.
  - `doc_type`: the FR `subtype`, or else its `type`; the GOV.UK `content_store_document_type`; or `statutory milestone`.
  - Optional fields: `executive_order_number` (a number), `signing_date` (FR, YYYY-MM-DD) and `citation` (EU).
- **`ts`** (second-precision ISO UTC):
  - **FR:** `publication_date` + `T00:00:00Z`. Documents go on public inspection the business day before, so this is never early. `signing_date` is kept as a field but is not used as `ts`.
  - **GOV.UK:** the later of the Content API's `first_published_at` and, when the item was scheduled, `publishing_scheduled_at + scheduled_publishing_delay_seconds` (the real go-live). If `first_published_at` is exactly local midnight and there is no schedule, it is a date the publisher typed, so `ts` is the next UK local midnight (+24 h). Normalised to `Z` with no milliseconds. See the midnight quirk below. The search API's `public_timestamp` is not used, because it is the *last update*. For example, "AI Safety Summit 2023: The Bletchley Declaration" shows 2025-02-13 there but was first published on 2023-11-01. The copyright consultation shows 2025-02-20 but was first published on 2024-12-17.
  - **EU:** the date the obligation starts to apply, at 00:00Z. See the quirks below.
- **Filters:**
  - **FR presidential documents:** the title matches `/artificial intelligence|\bAI\b|super ?intelligence|genesis mission|data cent(er|re)/i`. This keeps 11, all EOs: 14141, 14179, 14277, 14318, 14319, 14320, 14355, 14363, 14365, 14409 and 14434.
  - **FR rules:** the title matches `/artificial intelligence|\bAI\b|advanced computing/i`. This keeps 7: 6 rules and 1 proposed rule, 5 of them from Commerce/BIS. They include "Framework for Artificial Intelligence Diffusion" (2025-01-15) and the 2026-01-15 revision of the licence-review policy for advanced computing.
  - **GOV.UK:** the title matches the topic regex `/\bAI\b|artificial intelligence|frontier|superintelligen|AI Security Institute|AISI/` (case-sensitive) **and** the action regex `/safety|security|\brisks?\b|defen[cs]e|evaluation|regulat|legislat|\bbill\b|\blaw\b|frontier|superintelligen|action plan|strategy|agreement|partnership|summit|declaration|compute|supercomput|growth zone|copyright|sovereign|\bchips?\b|hardware plan|opportunities/i`. That leaves 44 candidates. After that, anything with a `ts` before 2024-10-24 is dropped, which removes 1 (the Bletchley Declaration).
  - **All sources:** `ts` must be on or after 2024-10-24 and before the time of the run. A record with no date is dropped.
- **Counts:** 63 records (32 KB): 18 from the Federal Register (11 EOs and 7 rules), 43 from GOV.UK (38 DSIT, 3 No10, 1 IPO and 1 Cabinet Office) and 2 from the EU. Records run from 2024-12-05 to 2026-10-12.

  | Month | FR | GOV.UK | EU | Total |
  |---|---|---|---|---|
  | 2024-12 | 1 | 1 | | 2 |
  | 2025-01 | 5 | 4 | | 9 |
  | 2025-02 | | 3 | 1 | 4 |
  | 2025-03 | | 2 | | 2 |
  | 2025-04 | 1 | 1 | | 2 |
  | 2025-05 | | 1 | | 1 |
  | 2025-07 | 4 | 3 | | 7 |
  | 2025-08 | | | 1 | 1 |
  | 2025-09 | | 1 | | 1 |
  | 2025-10 | 1 | 1 | | 2 |
  | 2025-11 | 1 | 4 | | 5 |
  | 2025-12 | 1 | 4 | | 5 |
  | 2026-01 | 1 | 5 | | 6 |
  | 2026-02 | | 1 | | 1 |
  | 2026-04 | 1 | 3 | | 4 |
  | 2026-05 | | 3 | | 3 |
  | 2026-06 | 1 | 4 | | 5 |
  | 2026-08 | | 1 | | 1 |
  | 2026-10 | 1 | 1 | | 2 |

  Months not listed have no records: 2024-10, 2024-11, 2025-06, 2026-03, 2026-07 and 2026-09.
- **Quirks:**
  - **FR lag:** an EO is published in the Federal Register 3 to 8 days after it is signed (3 to 8 days in this data). So the US `ts` is late compared with the White House announcement. That is safe for point-in-time use, but the events land a few days late on the ticker.
  - **GOV.UK is limited to DSIT, AISI and No10.** Other departments that touch AI, such as the Home Office, MoD and CMA, are not included. The IPO and Cabinet Office records are DSIT/AISI-tagged items whose first organisation is another body. Searching for `q=AI` and then filtering titles misses announcements whose titles don't say "AI". Organisation tags can list several bodies, and `issuer` is just the first one.
  - **GOV.UK midnight dates:** 11 of the 43 records have a `first_published_at` of exactly local midnight. That is a date the publisher typed, not the go-live time: e.g. "New Google partnership…" says 2025-07-09 00:00 BST but went live at 06:00:07Z, and "AI for Science Strategy" says 2025-11-20 00:00 but went live at 22:30:04Z. 7 of the 11 carry a schedule, so `ts` is the scheduled time + delay. The other 4 have none and get the next local midnight, which is safe but up to a day late (the copyright consultation went live 2024-12-17T10:30Z and gets 2024-12-18T00:00Z; the cyber-security code went live 2025-01-31T14:00Z and gets 2025-02-01T00:00Z). Non-midnight times with `:00` seconds and no schedule (e.g. 12:00:00) may also be typed; they are kept as given and have not been checked.
  - **No China source.** The CAC (Cyberspace Administration of China) has no keyless English API. Item E's Wikipedia items cover some Chinese actions.
  - **The EU milestones are transcribed from the regulation, not fetched.** The obligations were public from Official Journal publication on 2024-07-12. `ts` is the date they apply, so a `ts < T` filter "learns" of each one on the day it takes effect, which is conservative and leaks nothing. The general application date of 2026-08-02 is **deliberately left out**: the Digital Omnibus proposal COM(2025)836 (Nov 2025) may have moved it, and no keyless API was used to check. GOV.UK's explanatory memorandum on that proposal (2026-01-30) is in the file as a UK record.
  - The GOV.UK search reads up to 500 hits and prints a warning if `total` is larger. Today `total` is 392.
