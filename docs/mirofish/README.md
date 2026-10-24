# MiroFish in the Doom Clock

## What it is

[MiroFish](https://github.com/666ghj/MiroFish) (AGPL-3.0) is a multi-agent "swarm" prediction engine. You give it seed
documents (news, reports) and a prediction requirement in plain language. It then:

1. extracts an ontology (entity and relation types) from the seed with an LLM,
2. builds a knowledge graph of the seed in **Zep Cloud**,
3. turns graph entities into agents with LLM-written personas,
4. runs a Twitter-like and a Reddit-like social simulation (the OASIS engine) for N rounds,
5. has a ReportAgent write a prediction report from the simulation.

Backend: Flask (Python 3.11–3.12, `uv`) on `:5001`. Frontend: Vue/Vite on `:3000`. All state is on local disk under
`backend/uploads/` plus the graph in Zep Cloud.

## How the Doom Clock uses it

One MiroFish round per game cycle. The pipeline (`doomclock/pipeline/mirofish/`) seeds a round with real news, current
odds, last cycle's events and the moves so far, runs it, and reads back the simulated posts and report. The output
feeds the **news ticker** and sets the **world alarm** (which funds the Guardian's political capital).

The round for cycle N+1 runs in the background while the player plays cycle N on the Monte Carlo alone, so the ticker
and alarm react to moves two cycles late. MiroFish never touches the real forecast line (engine A). Its output is game
colour, not a forecast, and must be labelled that way in the UI.

Round-1 seed design: [seed.md](seed.md). HTTP calls: [api.md](api.md).

## Pinned version

Git submodule `vendor/mirofish`, pinned to **`7657031`**. Read-only: don't edit the submodule.

## Running it

Two copies exist. The submodule is the pinned source; `~/dev/MiroFish` is a configured checkout (same commit
`7657031`) with a `.env`, installed deps and a `backend/.venv`.

```bash
cd ~/dev/MiroFish
npm run backend     # Flask on :5001  (cd backend && uv run python run.py)
npm run frontend    # Vite on :3000
npm run dev         # both
```

First-time setup (only needed in a fresh checkout): `npm run setup:all` (root + frontend npm, backend `uv sync`).

`.env` (project root of the MiroFish checkout, loaded by `backend/app/config.py`):

| Var | Meaning | Default |
| --- | --- | --- |
| `LLM_API_KEY` | key for any OpenAI-format API | required |
| `LLM_BASE_URL` | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `LLM_MODEL_NAME` | model | `gpt-4o-mini` |
| `ZEP_API_KEY` | Zep Cloud key (Zep Cloud only; `ZEP_API_URL` is rejected) | required |
| `LLM_BOOST_API_KEY` / `_BASE_URL` / `_MODEL_NAME` | optional second LLM for the simulation script; leave out entirely if unused | unset |
| `OASIS_DEFAULT_MAX_ROUNDS` | default round cap | `10` |
| `REPORT_AGENT_MAX_TOOL_CALLS` / `_MAX_REFLECTION_ROUNDS` / `_TEMPERATURE` | report agent budget | `5` / `2` / `0.5` |
| `FLASK_HOST` / `FLASK_PORT` / `FLASK_DEBUG` | server | `0.0.0.0` / `5001` / `False` |

The backend only checks that the two keys are non-empty at boot, so it starts with placeholder keys and then fails on
the first LLM or Zep call.

**State on 24 Oct 2026:** `~/dev/MiroFish/.env` holds *placeholder* values for `LLM_API_KEY`, `ZEP_API_KEY` and
`LLM_BOOST_API_KEY`, and points at Alibaba DashScope (`qwen-plus`). Real keys are needed before any round can run.
Our other LLM calls go through OpenRouter; MiroFish can use it too (`LLM_BASE_URL=https://openrouter.ai/api/v1`).

Verified: the backend boots and answers `GET /health` → `{"service":"MiroFish Backend","status":"ok"}`.

## Cost and latency (estimates, nothing timed yet)

MiroFish has no cost controls beyond `max_rounds` and the seed size. Where the spend goes, from the source:

| Step | LLM | Zep | Scales with |
| --- | --- | --- | --- |
| Ontology | 1 call, reads up to 50,000 chars of seed | – | seed size (capped) |
| Graph build | none | 1 graph + one episode per 500-char chunk, then waits for Zep to process them | seed size |
| Prepare | 1 persona call per entity (5 in parallel) + several config calls | entity read + searches per entity | entity count (the ontology allows ~10 entity types) |
| Simulation | one call per agent action, per platform | optional memory writes (off by default) | rounds × agents active per round × 2 platforms |
| Report | 2–5 sections, up to 5 tool calls each plus reflection | searches | fixed small |

Defaults are heavy: the LLM-written config picks a 72 simulated-hour run at 60 minutes per round, so **72 rounds**,
with 5–20+ agents active per round, on two platforms. The README itself warns that consumption is high and suggests
under 40 rounds first. For the game, pass `max_rounds` (we plan 8–12) to `/start`.

Rough budget for the planned round-1 run (~10 KB seed, ~10 agents, `max_rounds=10`): about 20–25 Zep chunks and
roughly 150–400 LLM calls in total. Latency is unmeasured; expect on the order of 10–25 minutes end to end, dominated by
profile generation and the simulation. The brief lists "nobody has timed a run" as an open risk, so the first run is
also the timing run. The real cycle length must exceed it.

## Updating the submodule

```bash
git -C vendor/mirofish fetch
git -C vendor/mirofish checkout <new-sha>      # inspect the diff of backend/app/api/ first
git add vendor/mirofish && git commit          # records the new pin
```

Then update the pinned sha in this file and re-check [api.md](api.md) against `backend/app/api/*.py`. Mirror the same
sha into `~/dev/MiroFish` (`git -C ~/dev/MiroFish checkout <sha>`, then `uv sync` in `backend/` if
`pyproject.toml` or `uv.lock` changed).
