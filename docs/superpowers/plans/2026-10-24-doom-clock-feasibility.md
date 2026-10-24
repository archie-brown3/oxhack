# Doom Clock: revised technical feasibility verdict

Checked at Sat 24 Oct, 19:45 BST (18:45 UTC). The deadline is Sun 12:00 GMT, which is 12:00 UTC because the clocks go back at 02:00 BST. That leaves 17 h 15 min of wall-clock time. It is not all build time, because the Devpost workshop takes 09:00–10:00 UTC.

## Overall verdict

**Feasible with changes, behind a kill gate.**

- **Build order:**
  - Build a rules-only game first that works fully offline: the deterministic engine, the cards, the game rules and a heuristic Rogue. It ships whatever else happens.
  - Add the society on top. It runs on our own runner over raw OASIS and is recorded along one canonical game. For the other cards, we ask the institutions "how would you react to card X", which changes nothing in the simulation.
  - Judges play a guided replay. Live play is capped at 1 turn at the table.
- **The society layer is unproven.** The code supports it, but no LLM call has ever gone through camel → OpenRouter tool calling on this machine. Tests T1–T7 settle it. The kill gate is at 22:30 UTC. If they fail, the society drops to institutions that only answer interviews (plan B), or to an AIID news ticker (plan C).
- **Two engine changes are now required:**
  - The headline must switch to an unconditional metric. Today a safety card can move the countdown *earlier*.
  - If HRT stays the main track, a reduced backtest is a must-have.
- **How we describe effects:** they are "a real causal path inside the simulation", never "realistic" or calibrated. Every effect size is labelled a game rule, as CLAUDE.md requires.

## Facts, rechecked

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | "The run is still hung" | **Out of date** | I checked at 19:43 BST: `runner_status: "stopped"`, `completed_at` 19:37:59. The stop request was sent at 19:37:03. The runner ignored SIGTERM and was force-killed after 10 s. T0 is done. Whether a rerun with twhin would hang again is untested, and it doesn't matter because we don't use twhin. |
| 2 | twhin-bert is optional | **Confirmed** | `env.py:76-85` and `103-112` (a custom `Platform` is accepted). The RANDOM and REDDIT feeds load no model. But the `RecsysType.TWITTER` feed's MiniLM model is **not cached** and downloads to `./models` at run time. Use `recsys_type="reddit"` only. |
| 3 | Moves can go in between rounds, and interviews can run inside a live run | **Confirmed, with limits** | `env.step` returns `None`. Answers can only be read back from the SQLite `trace` table (`platform.py:1386`). An injected post needs its own `env.step`, because the feed is rebuilt before actions run (`env.py:152`). There is no snapshot or fork, and reopening a database fails silently, so each game needs a fresh database. MiroFish's limits come from `scripts/run_parallel_simulation.py`, not from OASIS. |
| 4 | "torch import is most of the 69 s startup" | **Refuted** | Warm imports take 1.9–3.2 s, and building the environment takes 1–6 s. The ~60 s was a cold first start, cause unknown. One process per game is still needed, because the SQLite feed and each agent's memory live only in that process. Warm the demo machine before judging. |
| 5 | NEW: the camel → OpenRouter tool-call path has never run | **Biggest unknown** | The simulation process made 0 LLM calls. A reply without a tool call does nothing and raises no error (`agent.py:139-152`). Errors are caught and the step throws them away (`agent.py:153-155`). |
| 6 | NEW: likes beat recency in the Reddit hot ranking | **Verified by me** | hot score = sign × log10(\|net votes\|) + sim_seconds / 45000 (`recsys.py:168-195`). The default clock is `Clock(60)` (`platform.py:76-77`), so one log10 unit of votes is worth 750 real seconds. A post with 2 likes from the last ~3.75 min outranks a fresh move post with 0 likes. **Fix:** pass `sandbox_clock=Clock(3600)` or higher. `Platform` accepts `sandbox_clock` (`platform.py:60`). |
| 7 | NEW: the watchdog settings exist | **Verified by me** | `ModelFactory.create` takes `timeout` and `max_retries` (`model_factory.py:120-121`). The defaults are 180 s and 3 retries, so one call can stall a turn for about 12 min. `env.step` is about 40 lines (`env.py:136-198`) and calls `_perform_llm_action` / `_perform_interview_action` behind a semaphore (`env.py:124-133`). Our runner can copy it and wrap each task in `asyncio.wait_for`. |
| 8 | NEW: one key for everything | **Verified by me** | The `OPENROUTER` key in `/Users/archiebrown/dev/oxhack/.env` is identical to MiroFish's `LLM_API_KEY` (compared, not printed). Remaining credit is unknown. A mem0 note records a 402 (out of credits) on 2026-10-08 for another project, possibly on this account. |

## Pillars

| # | Pillar | Verdict | Evidence | Required change |
|---|---|---|---|---|
| 1 | Real-data world state | **Feasible with changes** | 250,795 records with `ts`. All 8 anchors match `markets.json`, and 77 datacentres are sited. **Gaps:** no records of government actions, no lab stances, capability data stops in Feb 2026. **New:** the catastrophe anchor is a play-money market with 19 traders and 7 price points in 2.4 years. The headline depends on an assumed lag (lag mean 1 → 10 years moves the median from 2034-02 to 2041-08). The model gives P(catastrophe by 2030) = 0.039, while our own pinned 2030 market (47 traders) is at 0.391. | Fix the drift in `markets.json`, `contracts.ts` and the `sim.ts` scenario keys. Make KXAGICO non-decreasing (cummax). Set AIID `ts` to max(first report, `event_date`). Write the `world-facts` file. **Label the lag as a game rule and show its sensitivity. Explain or hide the 2030 market.** People cards become role accounts. Every simulated agent, institutions included, carries a permanent SIMULATED label. |
| 2 | Forecast engine and backtest | **Engine: feasible, but the headline must change.** **Backtest: required in reduced form if HRT is the main track.** | 13/13 tests pass and a run takes 2 ms. The doomed-path median moves **earlier** on 3–4 of 10 seeds for catastrophe −0.3 and −1.0. All of the "8 months" comes from the ASI-2030 −0.2 move. `p10Year` moves the right way on 5 of 5 seeds. For a backtest, 429 questions (106 YES) are open at T = 2026-01-01. `priceAt` is not built. | Headline: an unconditional measure, either a continuous P10 date or P(catastrophe by 2100). The doomed-path median becomes a secondary number. No panel at runtime. Backtest per the CLAUDE.md spec at a fixed T = 2026-01-01: market price vs a 50% coin vs a blind Gemini vs market + w × nudge. The earlier half picks `w` and the later half reports. Disclose survivorship (the ≥20-trader filter uses counts as of 24 Oct). Say it validates short-horizon markets, not the 2040/2100 anchors. If `w > 0` wins, apply it to the 8 anchors only, from 8 cached calls. |
| 3 | Society layer | **Not feasible through MiroFish. On raw OASIS: possible, unverified until T2 and T4 pass.** | Graph build 9 min, prepare 12 min, 168 rounds, the twhin hang, the feed reset each run. Per-agent `stance` and `influence` fields are read nowhere. | Our own runner:<br>• `Platform(recsys_type="reddit", max_rec_post_len=5, refresh_rec_post_count=5, sandbox_clock=Clock(3600))` with a fresh database per game;<br>• the Twitter agent graph from a hand-written CSV (`user_char`, `username`, `description`, IDs 0..N-1), so prompts carry no age or MBTI, with stance and role written into `user_char`;<br>• 24 agents, about 12 acting per round, 2 rounds per turn;<br>• its own `step()` with a 25 s `wait_for` and try/except per task, where stragglers count as "do nothing";<br>• model `timeout=30`, `max_retries=1`;<br>• memory capped after construction by setting `agent.memory = ChatHistoryMemory(..., window_size=k)`, not through `max_tokens`;<br>• an assert that each active round adds trace rows.<br>MiroFish's Flask app and Zep are not used. Pitch it as "built on OASIS (CAMEL-AI)". |
| 4 | Moves have real effects on the simulation | **Feasible with changes. Downgraded to "a real causal path, uncalibrated".** | Agents can only post, like, repost, follow and quote. RANDOM exposure decays at about 2/N per round. Reddit hot ranking favours liked posts (fact 6). | **Moves in:**<br>• a note in each affected agent's memory via `update_memory`, which is guaranteed to arrive;<br>• the move posted by the acting entity in its own step, with exposure measured from `REFRESH` trace rows.<br>**Effects out:**<br>• an English interview ("answer in plain text, do not call tools") returning JSON `{decision, alarm 0-10, reason}`, read back by trace `rowid`. Bad JSON means no effect.<br>• the decision written back into the institution's memory, so its later posts stay consistent.<br>• alarm = the mean interview alarm plus a lexicon score of posts weighted by likes. No LLM classifier.<br>Declared game rules map these into the anchors and `pBad` on "your timeline" only. The UI shows card → replies → shift on the same screen. Custom policy tools for agents are a stretch goal only. |
| 5 | AI opponent (the Rogue) | **Feasible. Latency unmeasured and on the critical path.** | Nothing is built. Gemini 2.5 Flash latency has never been measured. | One structured `google/gemini-2.5-flash` call per turn with a hidden-information view. The heuristic Rogue is the fallback, and becomes the default if p95 is over 10 s (T2). Record the LLM Rogue's moves on the canonical path. The heuristic Rogue is labelled wherever it plays. |
| 6 | Turn latency | **Downgraded: the "≤60 s" target has no evidence behind it.** | Each step waits for its slowest agent (`gather`). Short calls on this route took 3–13 s. Persona calls: p95 46 s, max 64 s. 15 concurrent calls showed no slowdown; more than 15 is unmeasured. | With timeouts, one step is at most about 27 s. A turn (injection step + 2 rounds + interview wave) is then at most about 90 s. **Drop the "effects land one turn later" pipelining.** The lag grows by (sim − read) every turn, and turn 4's effects never appear in a 4-turn demo. Replay shows effects on the same turn. Live mode shows a processing state. |
| 7 | Offline demo at judging | **Downgraded: feasible only as a guided replay.** | No snapshot, fork or seed, and reopening a database fails. The 36 branch runs (or 94 with prefix replays) are refuted. A no-effect interview writes only a trace row (`interview_record=False`). | • Record one canonical 4-turn game (posts, interviews, Rogue moves) to `data/rounds/`.<br>• At each canonical turn, run one interview per institution that covers all offered cards (8 × 4 = 32 calls), giving a reaction for each card.<br>• Guided play: 3 cards offered per turn. The engine and rules always follow the move the player actually made. The society panel shows the recording, labelled "recorded". An uncached move falls back to rules-only, with a label.<br>• Offline mode switches on by itself.<br>• Warm the machine before judging.<br>• Recorder: watchdog, resumes from the last completed turn, asserts actions > 0, uses UTC. Freeze the cast, cards, reducer and Rogue before recording. |
| 8 | NEW: build time | **Unverified** | No game-layer code, no game-layer spec, 1 task in `tasks.json`. | Rules-only game first, society on top second. Kill gate at 22:30 UTC, freeze at 00:30 UTC (see the schedule). |

## Cut

- The full MiroFish pipeline every turn (Zep graph, prepare, 168 rounds), and injecting moves through MiroFish's Flask API.
- Per-card branch runs, environment forks and prefix replays.
- Live play of more than 1 turn at the table, and any live 12-turn game during judging.
- A Plague-Inc-style ticking clock driven by a live LLM society.
- The panel at runtime with `w > 0`. The only exception: the backtest picks `w > 0`, and then it is applied to the 8 anchors only.
- A full multi-T backtest. The single-T reduced backtest stays.
- The RANDOM feed, the TWITTER feed type (it needs a model download) and the Reddit agent graph.
- Simulated agents under real people's names.
- The "effects land one turn later" pipelining.
- An LLM alarm classifier.
- Custom policy tools for agents (stretch goal only).

## Riskiest assumptions and the test that settles each

1. **The key works and has enough credit.** This blocks all LLM work. Settled by **T1**.
2. **The camel → OpenRouter tool calls work and are fast on the chosen model.** Settled by **T2**.
3. **The runner keeps turns at or under 90 s, with at most 10% dropped calls, flat across 12 turns.** Settled by **T4**.
4. **Moves reach the agents and shift the institutions by more than the LLM noise does.** Settled by **T5** and **T7**.
5. **Interview answers parse, are stable, are in English and stay in character.** Settled by **T6**.
6. **Safety cards move the headline the right way.** Settled by **T3**.
7. **There are enough questions with no leakage for an honest backtest.** Settled by **T8**.
8. **The guided replay survives real judge play offline.** Settled by **T10**, after recording.

## Tests to run before build

**Cost basis (unverified):**
- Prepare cost about $0.68 for roughly 3 × 140 calls with ~1k-token outputs, about $0.002 per call. Action calls have longer prompts (3–6k tokens) and short outputs, so I assume $0.002–0.005 per call. T2 measures the real cost from `usage`.
- Gemini 2.5 Flash is about $0.30 per million input tokens and $2.50 per million output tokens. Thinking tokens bill as output.

No test needs a new LLM key unless T1 fails. Everything goes through the existing `OPENROUTER` key, with Gemini called as `google/gemini-2.5-flash` on OpenRouter. Total spend before build is about $3–5, against the $25 cap.

**T0, stop the hung run: already done.** It stopped at 19:37:59 BST.

### T1: key and credit (blocker)
- **Purpose:** confirm the key and credit before any LLM work.
- **Steps:**
  1. `curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER"` and read `data.limit`, `data.limit_remaining`, `data.usage` and `data.is_free_tier`.
  2. Make one 1-token call to each candidate model: `POST https://openrouter.ai/api/v1/chat/completions` with `{"model":"deepseek/deepseek-v4.1-flash-1017","messages":[{"role":"user","content":"ok"}],"max_tokens":1}`, then the same with `google/gemini-2.5-flash`.
- **Cost:** under $0.01.
- **New key:** no. Yes only if the test fails.
- **Pass:** all 3 calls return 200, `limit_remaining` is null or at least $10, and the key is not free tier.
- **Fail:** a 401 means we need a new key. A 402, or under $10 left, means a top-up. All LLM work waits on this test.

### T2: tool-call rate, latency and the Rogue call
- **Purpose:** pick the agent model, prove the camel → OpenRouter tool path, and measure the Rogue's latency.
- **Steps** (MiroFish venv, `/Users/archiebrown/dev/MiroFish/backend/.venv/bin/python`):
  1. Build the tools: `tools = [t.get_openai_tool_schema() for t in SocialAction(0, None).get_openai_function_list()]` (`oasis/social_agent/agent_action.py:28`).
  2. Build a realistic prompt: one cast member's Twitter-graph system prompt (~3k tokens) plus a 5-post feed.
  3. Send 50 calls per model, 25 at a time, to `/api/v1/chat/completions` with `tools`, `"tool_choice":"auto"` and `"usage":{"include":true}`, for both deepseek-v4.1-flash-1017 and gemini-2.5-flash.
  4. Send 20 Rogue-shaped calls to gemini-2.5-flash with `response_format: {type:"json_schema"}` over the legal Rogue moves.
  5. Make 10 calls through camel itself: `ModelFactory.create(ModelPlatformType.OPENAI_COMPATIBLE_MODEL, model_type=<winner>, url="https://openrouter.ai/api/v1", api_key=..., timeout=30, max_retries=1)` driving one `SocialAgent` on a scratch `Platform`, and count the trace rows written.
  6. Log for every call: whether `tool_calls` is present, latency, HTTP status, tokens (reasoning tokens included) and cost.
- **Cost:** about 130 calls, $0.30–0.80.
- **New key:** no.
- **Pass, per model:** at least 95% of replies carry a valid tool call; p95 ≤20 s and max ≤30 s; no 401, 402 or 429; through camel, 10/10 calls write a trace row.
- **Pass, Rogue:** at least 95% parse, at least 95% pick a legal move, p95 ≤10 s.
- **Fail:** if neither model reaches the tool-call bar, go to plan B (interview-only society). If the Rogue's p95 is over 10 s, the heuristic Rogue becomes the default.

### T3: headline metric (no LLM)
- **Purpose:** make sure safety cards move the countdown the right way.
- **Steps:**
  1. Extend `/private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/sens2.ts` and `/private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/sens3.ts` into `sens4.ts`. Run it with `npx tsx` from `/Users/archiebrown/dev/oxhack/doomclock/web`.
  2. Run `sim.ts` on the real anchors, seeds 1–20: the real line vs the moves {catastrophe −0.3, catastrophe −1.0, ASI-2030 −0.2, catastrophe +0.3}.
  3. Compute 3 candidate headlines: the doomed-path median (current), a continuous unconditional P10 date, and P(catastrophe by 2100).
- **Cost:** $0.
- **New key:** no.
- **Pass:** the chosen headline moves in the right direction on 20 of 20 seeds for every move. A −0.3 move shifts it by a visible amount: at least 1 month for a date, or at least 1 percentage point for a probability. The existing same-seed test still passes.

### T4: runner spike (scale, latency, stability)
- **Purpose:** prove the society runner.
- **Steps** (`runner.py` in the MiroFish venv):
  1. Create `Platform(db_path=<fresh>.db, channel=Channel(), recsys_type="reddit", max_rec_post_len=5, refresh_rec_post_count=5, sandbox_clock=Clock(3600))`.
  2. Build the agents with `generate_twitter_agent_graph(<24-row CSV>, model=<T2 winner, timeout=30, max_retries=1>)`. The CSV has 8 institutions and 16 role accounts, IDs 0–23.
  3. Cap memory on every agent with `agent.memory = ChatHistoryMemory(..., window_size=20)`.
  4. Create `OasisEnv(agent_graph, platform=<the Platform>)` and call `await env.reset()`.
  5. Use our own `step()`, copied from `env.py:151-193`, with `asyncio.wait_for(task, 25)` and try/except around each task.
  6. Run 12 turns. Each turn has:
     - an injection step: `ManualAction(CREATE_POST)` from the acting entity, plus memory notes;
     - 2 rounds of `LLMAction` for 12 randomly chosen agents;
     - 1 interview wave of 8 institutions.
  7. Log for each step: wall time, calls, timeouts, exceptions, new trace rows and prompt tokens. Also time a warm restart, from process start to the first step being ready.
- **Cost:** about 384 calls, $1–2. Wall time 15–25 min.
- **New key:** no.
- **Pass:**
  - turn p95 ≤90 s;
  - timeouts plus errors ≤10% of calls;
  - each round adds trace rows for at least 90% of active agents (no silent no-ops);
  - 0 uncaught exceptions;
  - turn 12 latency ≤1.25 × turn 2, and prompt tokens level off once the window is full;
  - warm restart ≤15 s.
- **Fail:** any single miss means plan B at the kill gate.

### T5: move exposure (inside the T4 run)
- **Purpose:** confirm injected moves actually reach the agents.
- **Steps:**
  1. After each injection, count the next round's `REFRESH` trace rows that include the move's `post_id`.
  2. Check that the note appears in `agent.memory.get_context()` for every targeted agent.
- **Cost:** included in T4.
- **New key:** no.
- **Pass:** at least 90% of active agents see the move post in the next round, and the memory note is present in 100% of targeted agents.
- **Fail:** raise the clock factor (for example `Clock(86400)`) and rerun. If it still fails, rely on the memory note alone.

### T6: institution interviews (inside the T4 run)
- **Purpose:** decisions that parse, are stable, are in English and stay in character.
- **Steps:**
  1. At turns 2, 6 and 10, interview all 8 institutions twice on the same state. Keep `interview_record=False` so the first answer doesn't affect the second.
  2. The prompt starts with "Answer in plain text. Do not call any tools." and asks for JSON `{decision: comply|resist|escalate, alarm: 0-10, reason: ≤30 words}`.
  3. First try `response_format` json_schema through a direct model call over `agent.memory.get_context()`. If that isn't honoured, use prompt-only JSON.
  4. Read the answers back by trace `rowid`.
- **Cost:** 48 calls, $0.10–0.25.
- **New key:** no.
- **Pass:**
  - at least 90% parse;
  - at least 80% give the same decision on repeat;
  - 0 Chinese characters (regex `[\u4e00-\u9fff]`);
  - no answer breaks character ("as a Twitter user", text that looks like a tool call);
  - a manual read of 8 answers shows each matches its card's stance.

### T7: causal A/B test
- **Purpose:** show that moves change behaviour by more than LLM noise does. The recording doubles as demo evidence.
- **Steps:**
  1. Start 10 fresh environments with the same cast and the same initial posts. No snapshot is needed.
  2. In 5 of them, inject "US compute licensing" at round 0: a post from the US agency plus memory notes. The other 5 get nothing.
  3. Run 2 rounds, then the T6 interview wave.
  4. Metrics, fixed in advance: how many of the 8 institutions answer "comply", and the mean alarm.
- **Cost:** about 320 calls, $0.70–1.60.
- **New key:** no.
- **Pass:** a one-sided exact Mann-Whitney test on the comply count gives p ≤0.05, and the mean difference is at least 1.5 institutions. Alarm is reported with its spread.
- **Fail:** the effect is noise. Narrow the claim to "the society narrates; the rules decide", or go to plan B.

### T8: backtest pilot (only if HRT stays the main track)
- **Purpose:** confirm an honest backtest fits in the time and budget.
- **Steps:**
  1. Fix T = 2026-01-01. From the clean market data, keep questions that were created before T, have a price point before T, resolved YES or NO after T, and have at least 20 traders.
  2. Build `priceAt(q, T)` and assert that every input has `ts < T`.
  3. Assert that Gemini's cutoff (2025-01-31) + 1 month ≤ T.
  4. Ask a blind Gemini about 50 sampled questions. The prompt is the question text plus "today is 2026-01-01", and the answer is JSON `{p}`.
  5. On those 50, compute the Brier score for the market price, a 50% coin, the base rate and the blind LLM.
- **Cost:** 50 calls, $0.05–0.20. The full run is about 430 calls, $0.50–1.50.
- **New key:** no.
- **Pass:** at least 300 eligible questions, the leakage asserts pass, at least 95% of LLM answers parse, and the projected full cost is ≤$3. There is no bar on which method wins; report the result honestly.

### Later gates (after build, before recording and judging)

**T9: recorder dry run.**
- **Steps:** record 1 canonical turn plus its batch of per-card interviews, with the watchdog on. Kill the recorder with `kill -9` mid-turn, then restart it.
- **Cost:** $0.10–0.20.
- **New key:** no.
- **Pass:** it resumes from the last completed turn, files are written atomically, actions > 0 is asserted, and timestamps are in UTC.

**T10: offline replay at the table.**
- **Steps:** run the built app with Wi-Fi off, from a cold boot followed by a warm-up. Play the canonical path. Take a different card at turn 2. Reload in the middle of a game.
- **Cost:** $0.
- **New key:** no.
- **Pass:**
  - no console errors;
  - each turn renders in ≤2 s;
  - the different card shows a labelled cached reaction or the rules-only response;
  - offline mode switches on within 3 s with no user action.

## Schedule and kill gate

All times are UTC and the estimates are unverified.

| Time | Work |
|---|---|
| now–19:30 | T1, T2, T3 and T8 in parallel. The rules-only game build starts now and doesn't wait for any test. Data fixes: `markets.json` drift, cummax, AIID `ts`. |
| 19:30–21:30 | Build the runner, then run T4, T5 and T6. |
| 21:30–22:30 | T7. |
| **22:30** | **Kill gate.**<br>• **Plan A**, feed plus interviews: T2 and T4–T7 pass.<br>• **Plan B**, interview-only institutions at 8 calls per turn: the feed fails but T6 passes.<br>• **Plan C**, AIID ticker plus rules-only: T1, T2 or T6 fails. |
| 00:30 | Freeze the cast, cards, reducer and Rogue prompt. Run T9. |
| 00:30–03:00 | Record. That is about 164 calls (4 × 32 + 32 + 4), $0.35–0.85 and 10–20 min of compute; the rest is slack for re-recording. The clocks change at 01:00 UTC, so use UTC throughout. |
| 03:00–08:30 | Replay integration, T10, pitch. |
| 09:00–10:00 | Devpost workshop. |
| 10:00–11:30 | Final checks and warming up the demo machine. Submit by 12:00. |

## Decisions the owner needs to make

1. **HRT main track.** If we keep it, the reduced backtest is a must-have. I recommend keeping it: it costs about $1, and T8 confirms whether it fits. If we drop it, the pitch should say so.
2. **Names.** I recommend role accounts for people. Institutions keep their real names only with a permanent SIMULATED label; otherwise anonymise them.
3. **Headline metric.** Choose from T3's results.
4. **What ships.** The MiroFish run the owner was watching is not what ships. What ships is raw OASIS with a hand-written cast, so the pitch should say "built on OASIS (CAMEL-AI)".

Files are in `/private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/`:
- sens2.ts
- sens3.ts
- sens.ts
- lat.py
- lat2.py
- imp.txt
- importtime