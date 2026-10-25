# MiroFish reality check against design-draft.md (25 Oct, read-only)

Scope: read `~/dev/MiroFish` (pinned 7657031 plus the two patches in `patches/`), `docs/mirofish/`,
`docs/research/spikes-2026-10-24.md`, the salvaged recorder in
`.claude/worktrees/wf_fa865241-fde-4/` (WT below), its 3 recorded runs, the 5 raw runs in
`data/raw/mirofish/`, and report `report_504421cf507d`. No runs started or stopped. No paid calls.
I only sent GETs to :5001 (`/health` ok; `sim_c0d244b2642a` run-status = stopped, 3/3 rounds).

Abbreviations: RPS = `~/dev/MiroFish/backend/scripts/run_parallel_simulation.py`,
OASIS = `~/dev/MiroFish/backend/.venv/lib/python3.12/site-packages/oasis/`,
REC = `WT/doomclock/pipeline/world/record.ts`, CAST = `doomclock/web/src/game/cast.ts`.

## TL;DR

- **Seeding:** each run takes at most one seed post per account, all published at round 0. Every
  agent also gets a 3,000-char persona that we write in full each run. That persona is the only
  channel every agent is guaranteed to read. **A seed post is not**: an agent's feed shows about
  2 recommended posts per refresh, so a "Markets desk" prices post reaches only some agents.
- **Institution decisions:** in 5 recorded runs, institutions mostly *comment on the act we seeded*.
  A concrete new announcement from the account with the power to make it: **about 0–4 per run,
  roughly 2 on average**, and about half of those are soft ("will convene a hearing", "proposes")
  or just compliance with the seeded act. A hard, new government act with no seed behind it
  happened **once in 5 runs** (the US shutdown order in the catastrophe quarter). One lab
  "decision" is persona noise: OpenAI "resumes its paused runs" in 3 of 5 runs because resuming
  is written into its goals.
- **The report agent must not be used as drafted.** It reads only the Zep graph, and our runs
  never write to Zep. The shared graph holds the 24 Oct spike's 168-round world, so a report on our
  futures would describe the wrong world, framed by the project's old "next three weeks"
  requirement. Measured: 243 s per report, serial with the sim. On record, it turned an invented
  "38% → 61%" market move into "Kalshi reported…".
- **Two sims at once:** the code supports it (state and subprocess are per simulation) but
  nobody has tried it. The recorder reuses a single sim, so as written it is serial.
- **40 runs:** about 40 min serial, about $1.2–1.7. The draft's numbers hold. Drop the report
  agent and the interviews, and the 15 s sleep.

---

## 1. What can be seeded per run, and how prices and incidents get in

### Seed posts (`event_config.initial_posts`)
- **One per account, last one wins, silently.** RPS:1180-1186 builds
  `initial_actions = {agent: ManualAction(CREATE_POST)}`, a dict keyed by agent, so a second post
  for the same agent overwrites the first. No error is raised. The spike saw 16 seeds generated
  and 15 sent (spikes:44-47).
- **All seeds are posted together in round 0** (`env.step(initial_actions)`, RPS:1205-1207), then
  rounds 1..N run. There is no live injection: IPC supports only interview, batch_interview and
  close_env (spikes:46-47).
- **The ceiling is 32 seeds** (one per cast account). MiroFish sets no length cap; REC caps
  carry-overs at 600 chars (REC:280). An account with `activity: 0` (Markets desk #26, the
  sockpuppets #30–31 in `cast.json`) posts its seed and then never acts.
- `hot_topics`, `narrative_direction` and `scheduled_events` are **ignored** at run time
  (spikes:44-45). REC writes them empty (REC:174).
- **Every run starts empty.** The DB is deleted before each start (RPS:1151-1153). `force:true`
  also clears `actions.jsonl` and `run_state` (spikes:29-33). The force smoke test passed
  (`data/tests/force-smoke.json`: `pass: true`, actions 160 → 0 → 42).

### Who reads a seed post: a 2-post feed
- The Twitter platform is built with `refresh_rec_post_count=2, max_rec_post_len=2,
  following_post_count=3` (OASIS environment/env.py:78-85).
- A refresh shows a **random 2** from the user's rec table (OASIS social_platform/platform.py:274-278),
  plus up to 3 posts from accounts they follow.
- The CSV path builds **no follow graph** (OASIS social_agent/agents_generator.py:614-650 reads
  only `user_char`, `username`, `description`). Follows only arise mid-run (the spike saw 2 in
  S1, spikes:16).
- So with 4–8 seeds (REC runs: 4, 7 and 8 seeds), any given seed reaches only some agents.
  Measured share of active agents that engaged with an event post: **0.72, 0.13, 0.67**
  (`WT/data/world/runs/early-2027Q1/2028Q2/2029Q1.json` → `alarm.engagementShare`). In 2028Q2
  only 4 of 30 active agents touched the seeded events.

### Persona memory (`user_char`): the reliable channel
- `user_char` from `twitter_profiles.csv` becomes the agent's profile and system prompt
  (OASIS agents_generator.py:630). We rewrite the CSV before every run (REC:166-168), so it
  is per-step memory that every agent reads.
- `userChar()` already has the slots (CAST:54-72):
  - identity and roster
  - Role/Powers
  - Voice
  - dated record (`facts`)
  - **WORLD SO FAR**: shared, last 8 lines (CAST:66)
  - **YOUR DECISIONS SO FAR**: per account, last 4 (CAST:62)
  - **NOTICES TO YOU THIS QUARTER** (CAST:63)
  - PRIVATE (CAST:64)
- Hard cap **3,000 chars** (CAST:26). When it is over, WORLD SO FAR is dropped line by line first,
  and then the dated record (CAST:65-70). Long institution personas can therefore lose the world
  lines silently. Check rendered lengths before relying on it.
- REC passes only `world` and `notices` (REC:282). It **never fills `decisions`**, even though
  `Memory.decisions` exists (CAST:20).
- Within a run there are only 3 rounds of 60 min (CAST:27-31). Across runs agents keep nothing
  except what we put in `user_char` and the seeds.

### How prices and incidents enter today (REC) and what the draft needs
- **Prices:** one Markets desk seed (uid 26) per run, carrying the engine's pCat and capability
  for that quarter, labelled "not live prices" (REC:109). Given the 2-post feed, most agents
  never see it.
  - **Fix: put a one-line "MARKETS NOW" with the current simulated anchors into WORLD SO FAR for
    every account**, and keep the desk post for visible reactions.
- **Incidents:** one Incident-tracker seed (uid 25) per run naming at most **2** incidents,
  only organisation-only AIID titles that mention a lab (REC:51-59, 101-108), plus the count
  ("84 incidents are projected this quarter").
  - At ~109 incidents per quarter (draft step 2), almost all of them exist only as a number.
    That is fine, but say so.
- **Events:** the issuer posts its own measure, with document number and dates in the header
  (REC:89-90), and the wire desk reports it (REC:99).
  - Sourcing matters: in the spike, agents treated an unsourced government post as a rumour
    (spikes:48-50).
- **Carry-over:** the previous run's top 3 posts, by accounts not already seeding (REC:275-281).
- **Reproducibility:** MiroFish's agent sampling is unseeded Python `random` (RPS:1063, 1074,
  1077; platform.py:277). REC records this in `seed.mirofishRng` (REC:232). Runs cannot be
  replayed; record once.

## 2. Do institution accounts reliably post decisions?

Data: the 3 recorded runs (WT runs) plus 2 raw runs that never got a run JSON
(`data/raw/mirofish/*early-2032Q1.json`, `*fairlyEarly-2027Q1.json`). All on `sim_c0d244b2642a`,
32-account cast, 3 rounds, deepseek-v4.1-flash.

| Run | New posts | By labs (0–7) | By governments (8–12, non-empty) | Seeded act |
| --- | --- | --- | --- | --- |
| early 2027Q1 | 58 | 14 | 5 | US EO 14788 (72-h incident reporting) |
| early 2028Q2 | 65 | 14 | 9 | UK AISI Notice 2028-60 (block on cyber-eval fail) |
| early 2029Q1 | 80 | 20 | 13 | EU C(2029) 8397 emergency suspension + ASI milestone |
| early 2032Q1 | 71 | 18 | 9 | CAC Order 54 + catastrophe milestone |
| fairlyEarly 2027Q1 | 56 | 19 | 3 | UK AISI Notice 2027-69 |

Some government "posts" are empty reposts. For example, in 2027Q1 two of #8's 7 rows are empty.

**Concrete new announcements by the account with the power** (my hand classification from the
post text):

- **2027Q1: 0.**
  - #8 US restates its own EO ("nothing more").
  - #12 CAC states a position.
  - #5 DeepSeek: "No change to release cadence" (a non-decision).
- **2028Q2: 1–2.**
  - #9 Senate: "Congress must deliver one national standard this session… Markup to follow"
    (soft).
  - #0 OpenAI: "our paused training runs are resuming" (concrete, but driven by its persona; see
    below).
- **2029Q1: 3–4.**
  - #9 Senate: "will convene a hearing on verified evaluation".
  - #11 AISI: proposes a shared evaluation minimum and convenes international talks.
  - #2 GDM: a convening notice with a three-item agenda.
  - #5 DeepSeek: "EU-serving endpoints… go offline 2029-02-15" (compliance with the seed).
- **2032Q1: 3.**
  - **#8 US: "Executive action… effective immediately: any US-accessible instance of the
    system… is ordered SHUT DOWN"**, the only hard, unseeded government act in 5 runs. It came
    in the catastrophe quarter.
  - #2 GDM: offers incident-response tooling and convenes labs.
  - #0 OpenAI: resumes its paused runs again.
- **fairlyEarly 2027Q1: about 1.**
  - #6 Qwen "will meet" the UK requirement (compliance).
  - #0 OpenAI: "why we paused our runs".

**Estimate: about 2 per run on average (0–4).** Hard, new government acts: about 0.2 per run.
The rest of what institutions post is commentary on the seeded act, mostly in character (labs
that oppose oversight call it a "chokepoint"; the EU AI Office cites AI Act articles).

**Persona noise.** OpenAI's persona carries "Resume the paused training runs" as a goal and power
(`cast.json` account 0: facts and goals contain "paused"). It announces a resumption in 3 of 5
runs, whatever the future. A naive read-out would fire "OpenAI resumes training" at almost
every step.

**Interviews are inert.** All 3 recorded runs gave meanAlarm 6.21 / 6.34 / 6.34 and
**supportShare 0.621 in all three** (WT runs `interview`), even though the seeded acts and
milestones differ. This matches spikes finding 6 (spikes:51-55). They aren't worth $0.013–0.017
and about 10 s per run.

## 3. The report agent

- **API:** `POST /api/report/generate {simulation_id, force_regenerate}` → poll
  `/api/report/generate/status` → `GET /api/report/by-simulation/<id>` (docs/mirofish/api.md:
  "Report").
- **Preconditions:** runner_status completed or stopped, no active graph updater (report.py:86-116),
  project `GRAPH_COMPLETED`, sim `graph_id` equal to the project's (report.py:127-145).
- A completed report for the sim is returned as-is unless `force_regenerate` (report.py:214-229).
  On a reused sim you must force it every time and keep each `report_id`.
- **Measured time:** report_504421cf507d, created 20:29:13 → completed 20:33:16 = **243 s**
  (`meta.json`).
  - Planning 12 s, then 4 sections done at 90 / 106 / 182 / 243 s.
  - 20 LLM responses and 9 tool calls (`agent_log.jsonl`: insight_forge 6, panorama 4, quick 4,
    interview 4, counted over call and result lines).
- **Cost: not measured.** No usage was logged for it, in `data/world/cost-log.jsonl` or the
  spike doc.
  - Estimate from the log: ~118 KB of tool results plus ~23 KB of responses, re-sent across
    5 iterations per section, plus hidden reasoning. That comes to roughly 350–450k input and
    40–60k output tokens.
  - At deepseek-flash's $0.15/$0.60 per M that is **about $0.08–0.12**, plus Zep searches.
- **On a sim reused via force restart:** it runs mechanically (sim_c0d244b2642a is stopped), but
  it **cannot run while the next step runs on the same sim** (409, report.py:92-101). Reuse
  therefore makes reports serial.
- **It reads the wrong world. This is the blocker.**
  - Every tool searches the Zep graph only (zep_tools.py:457 `search_graph`, panorama,
    insight_forge, quick_search, `get_simulation_context` at :888). The only non-graph tool is
    `interview_agents` (IPC, :1270).
  - Our runs never write to Zep: `start()` sends no `enable_graph_memory_update`
    (`doomclock/pipeline/mirofish/api.ts:20-21`), which defaults to false (simulation.py:1562).
  - The graph REC points at, `mirofish_9df0589c36e0491b` (REC:23), holds the round-1 real-news
    seed **plus the 24 Oct 168-round spike** (`sim_bed17b5d494b`, started with
    `enable_graph_memory_update: True`, `backend/logs/2026-10-24.log:3987-3991`).
  - The report's framing is the *project's* `simulation_requirement` (report.py:148), the
    round-1 "next three weeks" prompt. Our per-run requirement in `simulation_config.json`
    (REC:171) is ignored.
- **Interviews inside the report fail once the env is closed.** In the spike report both
  interview_agents calls returned "0 / 122… 模拟环境未运行或已关闭" (environment not running or
  closed). REC closes the env after each run (REC:202).
- **How it hallucinates (on record):**
  - MiroFish's config-generator LLM invented a seed post for a "PredictionMarket" agent:
    "Market update: odds of formal AI oversight hearings within 30 days rise from 38% to 61%"
    (`uploads/simulations/sim_bed17b5d494b/simulation_config.json`, initial_posts #7; the same
    text is in both DBs).
  - The report then wrote **"Kalshi reported that the odds… rose from 38% to 61%"** and analysed
    "a 23-point move inside a fortnight… a repricing rather than a drift"
    (`reports/report_504421cf507d/section_04.md:9-11`). The post never named Kalshi.
  - Real seeded Manifold numbers were restated correctly (section_04.md:21-27). It did flag
    missing data once (section_04.md:39, 47).
  - Tool outputs come back with Chinese headers ("广度搜索结果", "采访失败") despite the English
    patch.
  - Our hand-written path skips `/prepare`, so the config generator can't invent seeds there, but
    the report agent would still paraphrase whatever is in the graph.

## 4. Can two simulations run at once on one backend?

- **The code says yes:**
  - Run state and processes live in per-simulation dicts (simulation_runner.py:228-229).
  - Each run is its own subprocess group with `cwd=sim_dir` and `start_new_session=True`
    (simulation_runner.py:539-548), with its own DB, `actions.jsonl` and IPC dirs.
  - Flask runs `threaded=True` (backend/run.py:45).
- **Never exercised:** every `/start` in `backend/logs/2026-10-24.log` and `2026-10-25.log` is
  sequential, with no overlap.
- **What breaks or needs work:**
  1. **REC uses one sim for everything** (`WT/data/world/sim.json`, REC:158-164). Parallel futures
     need one sim per future. `/api/simulation/create` is free, and `writeSimFiles` flips
     `state.json` to ready (REC:180-184).
  2. **Cost accounting:** `guard`/`keyInfo` measure the key-usage delta (REC:189, 209-210).
     Concurrent runs make per-run cost meaningless; log one total only.
  3. **OpenRouter load:** each process allows up to 30 concurrent LLM calls (RPS:1159). Five at
     once means up to 150 in flight. Rate limits are untested.
  4. **Memory and warm-up:** each subprocess loads the twhin-bert recommender. The first-ever
     round once took 164 s (spikes:56-58). Memory per process is unmeasured; the machine has
     64 GB.
  5. **Reports** (if kept) on a shared graph register as graph readers under a per-graph lock
     (report.py:159-165, `register_graph_reader` at :243). That is fine for reading, but every future would read the same
     wrong graph (§3).
- **Cheapest check:** run 2 sims concurrently for 1 round each. About $0.04 and 1 min.

## 5. Realistic wall time and cost: 5 futures × 8 steps

Measured per run (5 runs; WT runs plus raw `actions` timestamps):
- **Sim:** 29–55 s. The raw runs went 35 / 55 / 29 / 38 / 31 s from simulation_start to
  simulation_end. REC's `wall_s` was 38 / 60.1 / 34.
- **Interview batch:** 8.6–12.1 s. **Close-env:** about 2.5 s (spikes:69).
- **REC's settle sleep:** 15 s (REC:209). Run-to-run spacing in the cost log was 65 s, 86 s and
  58 s (`WT/data/world/cost-log.jsonl`).
- **Cost:** $0.029 / $0.043 / $0.043 per run, interview included (a key-delta upper bound; other
  lanes share the key). Without the interview, about $0.02–0.03 (spike S2 re-run: $0.018,
  spikes:17).

| Plan | Wall | Cost |
| --- | --- | --- |
| Serial, as REC does it (sim + interview + close + 15 s sleep) | 40 × ~70 s ≈ **47 min** | 40 × $0.04 ≈ **$1.70** |
| Serial, no interviews, no sleep (recommended) | 40 × ~45 s ≈ **30 min** | 40 × $0.025 ≈ **$1.00** |
| 5 sims in parallel, one per future (untested, §4) | 8 × ~50 s ≈ **7–10 min** | same |
| + read-out call per step (posts ~25–35 KB ≈ 8k tokens) | +~5 s per step if serial | 40 × ~$0.002 ≈ $0.08 |
| + MiroFish report per future (not recommended) | +5 × 243 s ≈ **20 min**, serial with that future's sim | +5 × ~$0.10 ≈ $0.50 (estimate) |
| + one-time warm-up run (first-round outlier) | +1–3 min | +$0.03 |

**Total, recommended path:** about 35–40 min serial, or about 15 min parallel, for about $1.1.
With everything in the draft (interviews and reports): about 70 min and about $2.3. Neither the
time nor the money is a constraint before the 11:30 freeze. What could break is the step chain
(see risk 3).

## 6. Top 3 risks and the cheapest fix for each

1. **Too few real decisions, and persona-driven ones.** Institutions mostly react to what we seed:
   about 2 concrete announcements per run, hard government acts about 0.2 per run, and OpenAI
   "resumes training" in 3 of 5 runs from its persona goals. If MiroFish is supposed to *drive*
   the prices, most steps will move them only through the noise term, plus one repeated fake
   lab event.
   - **Fix (cheap, all in `user_char`):**
     - Fill `Memory.decisions` (CAST:62; REC never sets it) with each account's past events, so
       nobody repeats a decision.
     - Give each institution a NOTICES line each step: "If you act this quarter, announce one
       decision within your powers (<powers from cast.json>), with a document number and
       effective date."
     - Have the read-out count only first-person, dated commitments from the powered account,
       deduped by (actor, action) across steps.
     - Keep REC's seeded ladder (REC:61-111) as the baseline event and label it "rule".
2. **Prices and incidents reach only a few agents.** The feed shows about 2 recommended posts per
   refresh and there are no follows (env.py:78-85, platform.py:274-278), so the Markets desk post
   is seen by a minority. Engagement with seeded events ranged from 0.13 to 0.72.
   - **Fix:** put one "MARKETS NOW" line (anchors and their change since the last step) and one
     incidents line ("N incidents this quarter; worst: …") into WORLD SO FAR for every account.
     Check that each rendered `user_char` stays under 3,000 chars, or WORLD is dropped first
     (CAST:65-70). Keep the posts for colour.
3. **The report agent writes about the wrong world, takes 4 min each and invents market moves.**
   It reads only Zep, and our runs don't write to Zep. The shared graph is the 24 Oct spike's.
   The requirement comes from the project. It is on record turning an invented 38%→61% move into
   "Kalshi reported". Fixing it properly means `enable_graph_memory_update` plus a fresh graph per
   future: Zep ingestion waits and 409s while ingesting. That doesn't fit the timeline.
   - **Fix:** drop it. Write each future's summary with one OpenRouter call over the saved
     events and top posts we already hold locally (~10 s, <$0.01). Every number in it should be
     quoted from our own price path, not generated.

Also worth doing:
- **Checkpoint each step to disk.** REC already skips quarters it has recorded (REC:274), so a
  failure mid-chain resumes cleanly.
- **Do one warm-up run first.**
- **Drop the interviews**, which are inert (supportShare 0.621 in every run).
- **Remove the 15 s sleep** and read key usage once per batch.

## Could not confirm
- The report agent's cost (no usage logged). The estimate above comes from log sizes only.
- Concurrent runs, OpenRouter rate limits at 5× load, and per-process memory.
- Whether REC's 2032Q1 and fairlyEarly-2027Q1 runs were meant to be kept. The raw files exist in
  `data/raw/mirofish/`, but there is no `WT/data/world/runs/*.json` for them.
- Whether institution behaviour changes with a NOTICES "announce a decision" line. It is untested;
  one A/B pair would cost about $0.08.
