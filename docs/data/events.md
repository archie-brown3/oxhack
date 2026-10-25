# Real world events (`data/events.json`)

**What / feeds:** the real `WorldEvent`s (`doomclock/web/src/contracts.ts`) behind the globe's event pings and the news ticker on the real frames, and the real events the MiroFish engine view seeds from. Every event has `provenance: "real"`.

- **Script:** `node doomclock/pipeline/events/build-events.ts [--asOf=ISO]`. Plain node, no deps, no network, no LLM. Writes `asOf(T).eventsFile()` (`doomclock/pipeline/asof/events.ts`, see `asof.md`) to `data/events.json`, reading `data/clean/*.jsonl` read-only. Re-runnable at any time.
- **Re-run after items C and E:** the orchestrator re-runs the script once `data/clean/government.jsonl` (item C) and `data/clean/wikipedia_ai.jsonl` (item E) land or change. Only `aiid.jsonl` is required; a missing optional file prints `warning: <file> missing, skipped` and the build carries on.

## Shape

```json
{ "schema": "doomclock.events/1", "asOf": "2026-10-24T20:48:02Z",
  "events": [ { "ts": "2024-10-24T00:00:00Z", "kind": "incident", "title": "…", "url": "https://incidentdatabase.ai/cite/850",
                "source": "aiid", "region": "US", "provenance": "real" } ] }
```

- `asOf`: `--asOf` if given, else now; ISO UTC to the second (no ms).
- `events`: sorted by `ts` (ties by `source`, then `title`, so the output is deterministic).
- `ts`: ISO UTC to the second, the time the item became public (each source's own clean `ts`; sub-second times round up). The one exception is a government record that absorbs a Wikipedia duplicate, which takes the earlier date (see Dedupe). Records with no parseable `ts` or no title are dropped and counted.
- `url` and `region` are left out when unknown. `region` is `US`, `China` or `rest` (`docs/data/regions.md`: Hong Kong and Taiwan are `rest`).
- **Window:** `2024-10-24T00:00:00Z ≤ ts < asOf`.

## Sources

| File | `kind` | `source` | `title` / `url` | `region` |
|---|---|---|---|---|
| `aiid.jsonl` (required) | `incident` | `aiid` | AIID title / `https://incidentdatabase.ai/cite/<id>` | rule below |
| `government.jsonl` (item C) | `government` | as given: `federal-register`, `gov.uk`, `eur-lex` | as given | as given |
| `wikipedia_ai.jsonl` (item E) | as given: `government` stays, anything else becomes `news` | `wikipedia` | as given | as given |
| `doomsday_clock.jsonl` | `news` | `bulletin` | "Bulletin of the Atomic Scientists sets the Doomsday Clock to N seconds to midnight" / the statement URL | none |

A `region` given by C or E that isn't `US`, `China` or `rest` is dropped. Only the 2025 (89 s) and 2026 (85 s) Doomsday Clock settings fall inside the window.

## Enrichment: who, where, detail, major

Each event may carry four more fields (`WorldEvent` in `contracts.ts`); each is left out when unknown. They are labels for the UI, not inputs to the forecast.

| Source | `who` | `where` (ISO 3166-1 alpha-3) | `detail` (one sentence) | `major` |
|---|---|---|---|---|
| `aiid` | first named deployer, else developer (slug to words; `openai` to OpenAI); `unknown…` skipped | the country the region rule matched (below); none for EU/Europe | first sentence of the description, plus "Covered in N press reports." | **heuristic**: 10 or more press reports (AIID has no severity field in our snapshot); 30 incidents |
| `federal-register` | "US President" for an EO, else "US <issuer>" | `USA` | EO: who signed it, its number and title, signing and publication dates. Rule: the agency, final or proposed, the date and the document number | Executive Orders and final Rules |
| `gov.uk` | "UK <issuer>" | `GBR` | the department, the kind of document (press release, policy paper, speech), the date and the subject | no |
| `eur-lex` | European Union | none | the date, the AI Act citation and what applies | yes (statutory milestones) |
| `wikipedia` | the first lab or office the line names (short list), "US President" for Trump | the country the region rule matched in the title | none: the title already is one dated sentence | government actions, except a ban being lifted |
| `bulletin` | Bulletin of the Atomic Scientists | none | none | no |
| `world-facts` | as written in `world-facts.jsonl` | as written, else from the text | as written | yes: the hand-checked turning points |

A Wikipedia event with no `region` of its own now takes the region rule's answer from its title. On 24 Oct 2026: 62 major events, 942 with `who`, 476 with `where`, 884 with `detail`.

## AIID region rule

Case-sensitive. Test the title, then the description; in each, the first of these that matches wins:

1. `China|Chinese|Beijing|Shanghai|Shenzhen` → `China`.
2. Non-US countries and demonyms → `rest`: British Columbia (Canada, so it isn't read as British), UK, U.K., United Kingdom, British, England, London, Ireland, EU, European, Europe, France, French, Germany, German, Italy, Spain, Netherlands, India, Indian, Japan, Japanese, Korea, Korean, Australia, Australian, Canada, Canadian, Brazil, Mexico, Russia, Russian, Ukraine, Israel, Iran, Turkey, Indonesia, Philippines, Pakistan, Nigeria, Kenya, South Africa, Singapore, Malaysia, Vietnam, Thailand, Argentina, Poland, Sweden, Norway, Denmark, Kosovo, Serbia, Romania, Hungary, Greece, Moldova, Taiwan, Hong Kong, Bangladesh, New Zealand, Belgium, Switzerland, Austria, Finland, Portugal, Saudi, UAE, Dubai, Qatar, Egypt.
3. `U.S.|US|United States|American|America|California|Texas|New York|Florida|FBI|FTC|Congress|Pentagon|Trump|Biden` → `US`.

If neither text matches, the first of `deployers` then `developers` that is a known entity sets it: `openai, google, anthropic, meta, xai, microsoft, amazon, apple, waymo, tesla, character.ai, perplexity-ai, nvidia` → `US`; `deepseek, alibaba, baidu, bytedance, tencent, zhipu-ai, moonshot-ai, huawei` → `China`. Otherwise `region` is omitted.

Each term must start at a word boundary and must not be followed by a letter or digit (`(?!\w)`, not `\b`, so `U.S.` and `U.K.` match before a space).

**Coverage (24 Oct 2026, 821 incidents):** US 295, China 24, rest 235, unknown 267, so 554 (67%) get a region. Most of the unknowns name no place and only generic actors (`deepfake-technology-developers`, `scammers`, …). A plain `\b` ending would give US 274 and leave 285 unknown, because it misses `U.S. ` and `U.K. `.

Known limits: it is a keyword heuristic. A title that names a foreign target of a US actor (or the reverse) gets the first region in the order above; "Latin America" reads as `US`; demonyms not on the list (Italian, Turkish, Swiss, Norwegian, …) don't count, though the country names do.

## Dedupe

A Wikipedia record inside the window is dropped when a government record that is also inside the window already covers it:

- its title has `Executive Order NNNNN` (5 digits) and a `government.jsonl` record has that `executive_order_number`; or
- its title or description mentions `AI Act` or `Artificial Intelligence Act` and a `government.jsonl` record with `source: "eur-lex"` has the same UTC date.

The kept government event takes the earlier of the two `ts`, because Wikipedia dates an EO's signing and the Federal Register its later publication. For example, EO 14179 was signed and public on 2025-01-23 but published on 2025-01-31, so its event is at `2025-01-23T23:59:59Z`. Government records at or after `asOf` are not used to match, so a build at `--asOf=T` never depends on anything published after T. It gives the same file as a build from clean files cut to `ts < T`. With `--asOf=2025-01-27T00:00:00Z`, EO 14179 therefore shows as the Wikipedia event.

No other cross-source dedupe is done. On the 24 Oct data the rules drop two records: Wikipedia's "Trump signs Executive Order 14179" (kept as the Federal Register record) and the EU AI Act general-purpose-AI obligations on 2025-08-02 (kept as the eur-lex record). Two near-duplicates remain because Wikipedia doesn't give the EO number: "Trump signs three executive orders" (2025-07-23) vs EOs 14318/14319/14320 (2025-07-28), and the Genesis Mission (2025-11-24) vs EO 14363 (2025-11-28). Both are real and a few days apart.

## Counts

The script prints the counts by source, kind and region on every run. They change whenever items C and E re-run, so they are not copied here. Last build: asOf 2026-10-24T21:02:51Z, 966 events, about 330 KB.

## Contract note for the Lead

- Add an `EventsFile` type to `contracts.ts`:
  ```ts
  /** `data/events.json`. Owner: data (build-events.ts). Real events only, sorted by ts. */
  export interface EventsFile {
    schema: 'doomclock.events/1'
    asOf: IsoTime
    /** 2024-10-24 ≤ ts < asOf; provenance 'real'; kind never 'post'. */
    events: WorldEvent[]
  }
  ```
- `WorldEvent.source` values in this file: `aiid`, `federal-register`, `gov.uk`, `eur-lex`, `wikipedia`, `bulletin`, `world-facts`. The comment on `WorldEvent.source` (`'aiid', 'guardian', 'mirofish', 'game'`) should list these.
- `WorldEvent.region` is absent for about a third of AIID incidents and for the Bulletin rows; the globe needs a no-location treatment (ticker only, or a non-geographic ping).
