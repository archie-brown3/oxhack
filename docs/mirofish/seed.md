# What a MiroFish round takes, and our round-1 seed

## What MiroFish accepts

From `api/graph.py` and `config.py` (pinned `7657031`):

| Item | Rule |
| --- | --- |
| File types | `.pdf`, `.md`, `.markdown`, `.txt` (anything else is skipped silently) |
| Request size | 50 MB total (`MAX_CONTENT_LENGTH`) |
| Files | one or more, sent as repeated `files` fields; the text of all files is concatenated under `=== filename ===` headers |
| Ontology LLM input | the first 50,000 chars of the combined text (longer text is excerpted per document) |
| Graph chunks | 500 chars with 50 overlap (settable at build); every chunk becomes a Zep episode, so **seed size = Zep cost and build time** |
| Requirement | the free-text form field `simulation_requirement` (required). It is stored on the project and read by the ontology, persona, config and report prompts. |
| Extra | optional `additional_context` field, passed to the ontology prompt only |

So the seed is plain prose. Structure that helps: short dated bullets, named actors (the ontology turns named
organisations, people and groups into entity types, and each entity becomes one agent), and no tables or numbers-only
lines (they chunk badly).

## Round-1 design

One MiroFish round per game cycle. Round 1 has no moves and no events yet, so it is seeded from real data only, as of
a date T (default now; only data with `ts < T`, read from `data/clean/<source>.jsonl`).

| File in `data/seed/round-1/` | Content | Size target |
| --- | --- | --- |
| `world-events.md` | from `asOf(T).events()` (`docs/data/asof.md`): every government action and news line from the 60 days before T, the 12 most-reported AI incidents of those 60 days, and up to 18 turning points (`major`) from the year before. One dated line each: date, country code, the specific sentence (`detail`), who acted and the source. Hacker News is dropped | ~9–10 KB |
| `market-odds.md` | the pinned markets priced at T: the 4 Manifold anchors (with traders and last trade), the 4 warning pins and the Kalshi AGI-announcement curve at each year end | ~1 KB |
| `scenario-brief.md` | who plays (Guardian vs Rogue AI), which kinds of actors react, and that move effects are game rules, only news and odds are real | ~1 KB |
| `requirement.txt` | the prediction requirement, sent as `simulation_requirement` (not uploaded as a file) | ~0.4 KB |
| `meta.json` | T, the 60-day window, counts, byte sizes | – |

Total about 12 KB of seed, roughly 25 Zep chunks. This is deliberately small: the extra detail in more headlines
doesn't change what 10 agents say, but every chunk costs Zep time. Do **not** put the raw data dump, long articles,
Epoch/METR numbers or AIID incidents in round 1. They aren't news that a social network would react to, and the
panel/Monte Carlo already use them.

Later rounds (cycle N) add, as extra dated bullets in a `cycle-N.md` file: the previous round's headlines (from the
simulated posts), the events the game fired last cycle, and the moves played so far (worded as news: "The Guardian
pushed through compute caps"), plus a fresh news digest. Each round gets a new project and graph; nothing is carried
over inside MiroFish, so continuity is whatever we put in the seed.

### Requirement prompt (round 1)

> Simulate how public opinion, media coverage and institutions react over the next three weeks as frontier AI labs
> race to scale capabilities while regulators, safety researchers and the public push for oversight. Use the AI news
> digest and the prediction-market odds as the starting facts. Predict which headlines would appear, whether alarm
> about AI risk rises or falls, and which actors escalate or de-escalate.

It is built to give two outputs we can use: *headlines* (the ticker) and *alarm up or down* (the world alarm).

### What we read back

- Ticker: top posts per round from `GET /api/simulation/<id>/posts`, filtered and shortened by an OpenRouter call of our
  own (MiroFish posts are unedited agent text). Label as simulated.
- World alarm: from the report text (`/api/report/by-simulation/<id>`) or a simple count of alarmed vs reassuring
  posts. Decide which when the first run exists. The alarm is a game input, not a forecast.

## Building it

```bash
node doomclock/pipeline/mirofish/seed.ts [ISO date T]
```

Reads `data/clean/{hn,manifold,kalshi,polymarket}.jsonl` (override with `CLEAN_DIR`, output with `SEED_OUT`), filters
`ts < T`, and exits with code 2 without writing if either the HN stories or the market odds are missing. The `ts`
contract is in CLAUDE.md; the field names it tries (`title`, `points`, `num_comments`; `id`/`ticker`, `question`/`title`,
`p`/`probability`/`price`) are at the top of `seed.ts`, to be matched to `docs/data/<source>.md` once those exist.

Core markets are picked by regex on the question text until `markets.json` pins their ids.
