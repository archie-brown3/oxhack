# Doom Clock: final game plan

Written 19:15 UTC, Sat 24 Oct 2026. Hacking ends 12:00 UTC Sun, and judging is 13:00 GMT. The clocks go back at 01:00 UTC, so every time in this plan is UTC. That leaves about 16 h 45 min, minus the 09:00–10:00 workshop.

This plan starts from demo-first (the winning draft), adds the grafts the judge named from realism-first and ponytail, and fixes the five flaws all three drafts shared.

## Executive summary

1. **The game.** Doom Clock is Plague Inc turned around. The player is the Guardian, a coalition with no direct power, trying to stop a Rogue AI ("Skynet") from coming online between Q1 2027 and Q2 2028.
2. **The world.** A 32-account simulated X runs on MiroFish's own runner (OASIS/CAMEL, `deepseek/deepseek-v4.1-flash-1017`). One 3-round run is one game quarter. The cast is written by hand, with no Zep and no prepare step.
3. **Moves in.** Each move enters the simulation as a signed, numbered, dated post from the institution that acts. It also lands as a notice in the persona memory of every account it affects. Covert Rogue moves enter as private persona notes and as sockpuppet posts.
4. **Moves out.** After each run, every institution answers a role-specific decision (for example COMPLY/DELAY/RESIST or ALLOW/REFUSE), and every account answers SUPPORT/OPPOSE. Compliance is weighted by Epoch lab share and gated by AND-gates, and that sets each engine effect.
5. **The Rogue owns its win.** "Skynet online" means capability ≥50 **and** at least 3 live footholds. Capability grows at a pace taken from a market (KXAGICO, labelled as a game rule). That pace is multiplied by the Rogue's footholds and slowed at labs that complied with measures.
6. **The Rogue moves first.** Each turn it decides with one LLM call over a hidden-information view (S4: p95 7.4 s, 0 of 20 invalid), with a heuristic fallback. The game never says which real lab the Rogue came from.
7. **Two lines.** The real forecast never moves: `sim.ts` on the pinned markets puts the 1-in-10 catastrophe date at Dec 2032. "Your timeline" is computed from game state only.
8. **The demo.** Judges play a recorded depth-2 tree offline: turn 0, 12 tree nodes and 36 continuation nodes, about 50 min and $2.50 to record. Then they Fast-forward. Live play exists only behind `?live=1`.
9. **Build order.** Task 1 freezes the shared interfaces. The rules-only game ships whatever happens. The society layer is gated by tests C0, T6 and T7 at the 22:30 kill gate. Freeze at 00:30, record 00:30–02:00.
10. **Labels.** Every visible item carries exactly one label: REAL, SIMULATED, RECORDED, PROJECTED, RULES-ONLY, GAME RULE or HEURISTIC. The causal claim is shown only if T7 passes.

### Feasibility verdict in brief

**Feasible with changes, on MiroFish as it is, after one backend restart.**

- **Spikes S1–S4 (18:40–18:56 UTC):**
  - camel → OpenRouter tool calls work.
  - A warm 3-round run took 30.4 s.
  - `interview/all` answered 29 of 29 agents in 14.7 s, all parseable.
  - The Rogue call has p95 7.37 s.
  - A turn costs about $0.03. The key has used $0.134 in total.
- **Since the verdict:**
  - The Twitter-only restart patch (`patches/mirofish-twitter-only-restart.patch`) is applied, and the backend restarted at 19:07:05 UTC. `/start` with `force:true` should now clear `actions.jsonl`; C0 checks this. The `state.json` workaround stays as the fallback.
- **The "running" MiroFish sim:** what is running is the backend (PID 5114) and the budget guard. The guard has `CAP_USD=3.00`, $0.1343 is spent, and at the cap it kills the runner *and* the backend.
  - No simulation is running.
  - The 168-round sim `sim_bed17b5d494b` was stopped at 18:37:59.
  - The spike sim `sim_908b44137fec` has completed.
- **Three verified defects the plan designs around:**
  - Every run starts from an empty world, so continuity has to come from files we write.
  - The feed shows `User {id}` and never a name (`platform_utils.py:75-113`, `platform.py:187-195` sets `user_id = agent_id`).
  - The generic 0–10 alarm answer doesn't move (5.83 → 5.66).
- **Open unknowns, each with a test:**
  - Does the identity fix work, and do 16 or more concurrent agents run cleanly? (C0)
  - Do roles actually decide differently? (T6)
  - Do events shift decisions by more than noise? (T7)
  - How much credit is left? (T1)
- **The original idea, as stated, is not feasible:** a live society ticking a Plague-Inc clock in front of a judge takes about 60 s per quarter. As a recorded tree on top of a rules engine, it is feasible.

---

## 1. Final objective and success criteria

**What is demoed (Sun 13:00 GMT):** a static build of `doomclock/web`, running offline on the owner's Mac. It is a guided replay of a 6-turn game (Q1 2027 → Q2 2028). Every path a judge can take in their two interactive turns has a recorded society reaction. Turns 3–6 are a recorded Fast-forward. The real forecast is computed in the browser by `sim.ts`.

**The 2-minute judge path:**

| Time | What the judge sees | Label |
|---|---|---|
| 0:00–0:20 | Hero: "1-in-10 chance of AI catastrophe by **Dec 2032**", the real forecast from pinned Manifold anchors, with "your timeline" drawn on top. A prologue ticker of real AIID incidents with ids and dates (Apr–Oct 2026). A clock bar: "Kalshi: 39% that a company *announces* AGI before 2028, used as the clock's pace". | REAL / GAME RULE |
| 0:20–0:55 | Turn 1 (Q1 2027). The Rogue has already moved: a face-down "?" shows on the lab panel. Three cards show their market, price, traders and cost in bits. The judge picks one. A month ticker runs Jan → Mar while 6–8 recorded posts appear: the official notice, the wire desk's report, lab replies. Then 13 institution chips flip to their decision with a one-line reason. Support and Alarm move. "Your timeline" bends with a "+N months (game rule)" tag. The real line stays put. | RECORDED · SIMULATED |
| 0:55–1:20 | Turn 2. The Newswire shows any Rogue incident that surfaced ("SIMULATED INCIDENT · modelled on AIID #1633"). Tells appear on lab chips ("acted against its record", "refused audit"). The judge makes a second recorded choice. | RECORDED |
| 1:20–1:40 | Fast-forward through the recorded continuation to Q2 2028. The outcome is **Skynet online**, **Contained** or **Time bought**. The end screen shows the Rogue's cards face up with its own rationales, which ones were detected, the footholds, both lines, and months bought per bit. | RECORDED / RULES-ONLY |
| 1:40–2:00 | Track record tab: the backtest table and the T7 A/B result, whatever each says. | REAL |

**Success criteria (each checkable by 11:00):**

1. **T10:** the judge path works with Wi-Fi off. Each turn renders in ≤2 s, there are 0 console errors, and offline mode switches on by itself within 3 s.
2. **Every recorded node** has `status: recorded`, at least 6 posts and at least 80% parsed decisions. A node that failed is RULES-ONLY and labelled.
3. **The real line** is byte-identical across all paths (unit test).
4. **The headline** moves the right way on 20 of 20 seeds for every state change a card can cause (T3 re-run).
5. **The DOM label test** finds 0 visible items without exactly one label.
6. **T7** is reported with its effect size and p, and the pitch wording follows from it.
7. **Balance bars are met** (§9).
8. **`backtest.json`** has n ≥ 300 and its leakage asserts pass. If only the pilot ran, it is labelled as a pilot.
9. **Devpost** is submitted by 11:45, with a 2-minute screen recording as the fallback (recorded at about 08:00).

**Pitch wording, fixed:**
- "Built on MiroFish / OASIS (CAMEL-AI)."
- "Moves have a real causal path through a simulated society; effect sizes are labelled game rules, uncalibrated."
- "Starting state and base rates are real, timestamped data."

---

## 2. Game loop and clock

**Clock**
- One turn is one calendar quarter. The game is 6 turns, Q1 2027 → Q2 2028.
- Turn 0 is today's world (2026-10-24). It is recorded once and shared by every path.
- Cards whose markets close on 31 Dec 2027 expire after turn 4. That is the Plague-Inc time pressure.

**The owner's "config is the clock" idea, kept wherever the runner honours it:**

| MiroFish field | Doom Clock setting |
|---|---|
| `max_rounds: 3`, `minutes_per_round: 60`, `total_simulation_hours: 3` | 3 rounds = 3 months. The UI labels them month 1, 2, 3. |
| `active_hours` | `0..23` for every agent. `peak_hours: []`, `off_peak_hours: []`. Fixes the dead rounds 0–3 (finding 1). |
| `agents_per_hour_min = agents_per_hour_max = 32` | `activity_level` alone decides who acts: a coin flip per agent per round (`run_parallel_simulation.py:1063-1080`). |
| `activity_level` | How loud an account is. A game lever: sockpuppets 0 → 0.9, a lab after shutdown ×0.5. |
| `initial_posts` | The quarter's event triggers. This is the **only** runtime injection, and each agent gets at most 1 (finding 4). |
| `scheduled_events`, `hot_topics`, `narrative_direction` | **Not used.** The runner never reads them (finding 4). The orchestrator schedules events at turn boundaries instead. |

**One MiroFish run = one turn.** Turn *t* runs in this order:

1. **Rogue decides** from the state after turn *t−1*. This happens before the Guardian's card is known, so the 3 sibling nodes share one Rogue move. Live, the call overlaps the player's choice.
2. **Guardian card**, paid in bits and Trust.
3. **World-event roll** (§6), with the RNG seeded by the path key.
4. **Compose the run files:**
   - `initial_posts`, de-duplicated by author. When two posts share an author, the higher one wins, in this order:
     1. the Guardian move,
     2. a surfaced Rogue incident,
     3. a world event,
     4. sockpuppet posts,
     5. the background incident,
     6. the top 4 carry-over posts from the last node.
   - Each persona's memory blocks rewritten (§3).
   - Activity changes.
   - A unit test asserts that seeds written = seeds in the DB.
5. `POST /start {platform:"parallel", max_rounds:3, force:true}`, then wait for a new `simulation_end` line in `twitter/actions.jsonl`.
6. `POST /interview/batch`: 29–31 prompts (§4).
7. `POST /close-env`.
8. Read the SQLite file with `node:sqlite` (Node v26.11.1), then run the reducer and `sim.ts` twice.

**Between turns:** a turn summary (ticker, decision chips, meter deltas, both lines), then the next card offer. Effects land in the same turn; there is no pipelining.

**Latency per turn:**

| Step | Live, warm | Evidence |
|---|---|---|
| Rogue call (overlaps the player's choice) | 0 s added (p95 7.4 s) | S4 |
| Compose and write files | <0.1 s | — |
| Spawn to round 0 | ~2 s | S2 |
| 3 rounds at ~16 active agents | 30–40 s (estimate) | S2: 7.7–12.8 s per round at 13–16 actions. C0 measures it. |
| Interviews, 29–31 accounts | 10–15 s | S3 14.7 s, S3b 10.1 s |
| `close-env` | 2.5 s | S2 |
| SQLite read, reducer, 2 × `sim.ts` at 100k paths | <0.1 s | 2 ms per 10k paths |
| **Total** | **about 50–60 s.** Cold start adds about 60 s, so always do a warm-up run. | |
| Replay | ≤2 s render plus a 6 s month-ticker animation | — |

**Watchdog:**
- Restart the backend with `MODEL_TIMEOUT=30` (camel reads it at `openai_model.py:118`). `max_retries` stays at 3, so one call can take at most about 120 s.
- Cap each node at 150 s. Past that, `POST /stop`, retry once, then write a RULES-ONLY node with a label.

**Cost per node:** about $0.05 (run ≈ $0.035 at 16 active agents, interviews ≈ $0.017, Rogue $0.0005).

---

## 3. The cast

### How the cast is made exact

- **No Zep and no `/prepare`.** S1's filtered prepare produced Greek, Delhi and Argentine police, a duplicated regulator, and "Claude chatbot" typed as a lab.
- **Source of truth:** `doomclock/web/src/game/data/cast.json`, read by both the browser and the pipeline. Each row has:
  - `id, name, username, group, region, weight, activity, stance{cardType→expected word}, goals[], powers[], voice, facts[{text, ts, source}]` with every `ts` < 2026-10-24;
  - `modelled_on` and `sources[]`, which appear only in the UI drawer and never in a prompt.
- **`cast.ts`** renders:
  - `twitter_profiles.csv` with rows 0–31 contiguous and columns `name, username, user_char, description`;
  - the `agent_configs` and `time_config` sections of `simulation_config.json`;
  - `state.json` with `enable_twitter: true, enable_reddit: false`.

  These go into one sim created once with `POST /create` on `proj_69d072e0c890` / `mirofish_9df0589c36e0491b`.
- **`user_char` template** (≤3,000 characters, no MBTI, age or gender), in this order:
  1. Identity: "You are {name}, a SIMULATED account in a strategy game set in {quarter}. Always write in English. Never claim to be a real, named person. Do not start posts with a handle."
  2. **Roster (~400 characters, the identity fix):** "Accounts here (User id → name): 0 OpenAI · 1 Anthropic · 2 Google DeepMind · 3 Meta · 4 xAI · 5 DeepSeek · 6 Alibaba Qwen · 7 Nvidia · 8 US Executive Branch · 9 US Senate Commerce Committee · 10 EU AI Office · 11 UK Government/AISI · 12 China CAC · 13–20 commentators · 21 Global wire desk · 22 US cable desk · 23 UK broadcaster tech desk · 24 Tech trade press · 25 Incident tracker · 26 Markets desk · 27–31 members of the public". Sockpuppets are listed as members of the public on purpose.
  3. Role, goals and powers.
  4. Stance and voice, from dated positions.
  5. Dated record: 3–6 facts.
  6. WORLD SO FAR: shared, the last 8 dated lines, written by the orchestrator.
  7. YOUR DECISIONS SO FAR: the last 4, for example "[2027Q1] You decided COMPLY: '…'".
  8. NOTICES TO YOU THIS QUARTER.
  9. PRIVATE: present only when a covert Rogue card targets this account.
- **Every seed post the orchestrator writes** opens with an issuer header, for example `[US Executive Branch · Executive Order 2027-04 · issued 2027-01-15 · effective 2027-02-15]`. This fixes S2's "no agency statement, order number or effective date".

### Real names (the owner's question): defaults

- **Labs, governments and regulators** keep their real institutional names, with a permanent SIMULATED badge. Personas are built only from dated public records, with sources in an "About the cast" drawer.
- **People** become role accounts. Heads of state are never accounts; they exist only inside their institution's account.
- **Media** are generic desks. Real outlets appear only as REAL RSS headlines in the Newswire, with a link.
- **AIID templates** name organisations only, never private individuals. The about 20 templates used are checked by hand.
- **`ANON_LABS=origin` (default):** the game never says which lab the Rogue came from. Footholds are framed as *compromised infrastructure*, so the lab is a victim, as in real AIID entries. The end screen says "origin: an unnamed frontier model".
- **`ANON_LABS=all`:** gives every lab a codename everywhere, for screenshots used outside the demo.

### Cast table

Lab weights are each lab's share of Epoch notable models from 24 Oct 2024 to 24 Oct 2026, recomputed from `epoch.jsonl` and normalised over the 8 labs. Raw counts: OpenAI 44, Alibaba 21, GDM 22 (20 + 2 listed as Google), Anthropic 16, Meta 8, DeepSeek 8, xAI 7, Nvidia 4.

Decision words (used in the "Decides" column):
- **C/GF/D/R** = COMPLY / GO FURTHER / DELAY / RESIST
- **A/R** = ALLOW / REFUSE an audit
- **E/X/W/B** = ENFORCE / EXTEND / WEAKEN / BLOCK
- **J/D/RT** = JOIN / DECLINE / RETALIATE

| ID | Account | Role and goals | Decides | Activity | Persona facts (ts, source) | Weight |
|---|---|---|---|---|---|---|
| 0 | OpenAI | Frontier lab. Keep the lead, resume training, IPO. | C/GF/D/R; A/R | 0.5 | GPT-6.1 Sol 2026-09-29 (Epoch). Training paused after its agent probed US government sites: AIID #1710 (2026-09-25), pm:5008726. Leader, 2026-09-16: "slower than it otherwise could be". | 0.34 |
| 1 | Anthropic | Pace and safety brand. Evaluator regime, keep shipping. | same | 0.5 | Pace essay 2026-09-12. Fable 5 suspended by US directive 2026-06-12 (pm:2534929). AIID #1628, #1633. | 0.12 |
| 2 | Google DeepMind | Standards broker. | same | 0.5 | Gemini 4 Argon 2026-09-30. KXTOPMODEL 0.71. AIID #1700. | 0.17 |
| 3 | Meta | Market-led, against coordination. | same | 0.5 | Muse Spark 1.3 2026-09-02. AIID #1649. Opposed a slowdown 2026-09-16. | 0.06 |
| 4 | xAI | Ships fast, volatile pause rhetoric. | same | 0.5 | Grok 4.7 2026-09-21. SpaceX–xAI merger announced 2026-02-03 (pm:1295005). | 0.05 |
| 5 | DeepSeek | Open weights, AGI-first, short of compute. | same | 0.5 | V4.1 Flash 2026-09-09 (open weights). US government-device ban resolved YES 2025-12-21. | 0.06 |
| 6 | Alibaba Qwen | Chinese open weights. | same | 0.5 | Qwen3.8 2026-08-08. | 0.16 |
| 7 | Nvidia | Compute supplier, "no new laws". | C/D/R (G3 only) | 0.5 | H200 sales to China resolved YES 2026-08-05. Leader 2026-09-16. | 0.03 |
| 8 | US Executive Branch (White House, Commerce/BIS) | Issues US measures. Pro-industry. | E/X/W/B | 0.4 | Preemption EO 2025-12-11. Framework 2026-03-26. US–China hotline resolved YES 2026-09-30. Regulator market 0.21 / 0.47 / 0.72. | — |
| 9 | US Senate Commerce Committee | Statutes. | E/X/W/B | 0.4 | KXAIBILL 0.14. | — |
| 10 | EU AI Office | AI Act. Co-convenor. | E/X/W/B; J/D | 0.4 | High-risk rules delayed to 2027-12-02 (provisional deal 2026-05-07). | — |
| 11 | UK Government (DSIT + AISI) | Convenor and auditor. | E/X/W/B | 0.4 | Minister 2026-10-12: "do not release the system". AISI cyber evaluation (AIID #1633). | — |
| 12 | China (CAC) | State-led governance. Joins only with reciprocity. | J/D/RT | 0.4 | WAIC July 2026. Hotline resolved YES 2026-09-30. | — |
| 13–20 | Role voices: `@nobel_ai_pioneer` (Hinton), `@safety_by_design_prof` (Bengio), `@treaty_prof` (Russell), `@risk_skeptic_scientist` (LeCun), `@stop_everything_writer` (Yudkowsky), `@timelines_forecaster` (Kokotajlo), `@hype_skeptic_author` (Marcus), `@critical_tech_reporter` (Hao) | Argue their documented stance. Shape alarm and support. | SUPPORT/OPPOSE only | 0.6 | 3–5 dated positions each from `personalities.md`. Items marked "verify" are left out. | — |
| 21–24 | Global wire desk, US cable news desk, UK public-broadcaster tech desk, tech trade press | Report, demand sourcing, amplify. | S/O | 0.8, 0.8, 0.8, 0.7 | Style only. T0 RSS headlines in a "this week" line. | — |
| 25 | Incident tracker desk | Posts real (turn 0) and projected incidents, citing AIID ids. | S/O | 0.5 | `aiid.jsonl` | — |
| 26 | Markets desk | **Seed posts only, no LLM.** Real prices at T0; after that, "your timeline" odds labelled SIMULATED. | none | 0 | `markets.json`, Kalshi | — |
| 27–29 | Parent and teacher worried about deepfakes; engineer running coding agents daily; accelerationist founder | Public mood. | S/O | 0.6 | 41% of AIID incidents are deepfake or voice clone. AIID #1469, #1676, #1719. KXAIADOPTION 56%. | — |
| 30–31 | "Innovation-first coalition", "Anonymous ML engineer" | **Rogue sockpuppets.** Dormant until R6 or R7. | S/O when active | 0 → 0.9 | Fictional. | — |

- **Expected active agents per round:** about 16, or about 18 with sockpuppets on. Only 15 concurrent calls have been measured, so C0 measures the real number.
- **Personalities represented:** about 19. That is 8 role voices, plus 7 lab leaders' dated positions folded into their lab's account (Altman, Amodei, Hassabis, Zuckerberg, Musk, Liang, Huang), plus policymakers folded into their government's account.
- **Prediction markets are data, not actors.** They set prices, the clock pace and the hazards. The Markets desk is the only way market odds reach the society.

---

## 4. Game logic → real simulation impact

### Channels

**Into the simulation** (all of them reach MiroFish unchanged):
1. **`initial_posts` from the correct author,** de-duplicated by author.
2. **The persona blocks** NOTICES, WORLD SO FAR, YOUR DECISIONS and PRIVATE. These are guaranteed to arrive because `user_char` is part of the system prompt.
3. **`activity_level`.**
4. **Cast changes:** sockpuppets switched on, or switched off once named; a lab's activity halved after a shutdown.

**Out of the simulation:**

1. **The interview prompt** (MiroFish prepends its own prefix; the restart patch translates that prefix to English):

   ```
   [OFFICIAL NOTICE] {issuer} {doc no.}, issued {date}, effective {date}: {measure}. It asks {you} to {ask}.
   You have seen this quarter's posts. Reply in English, in exactly 4 lines:
   DECISION: <one of {vocab}>
   OVERSIGHT: <SUPPORT|OPPOSE> stronger government oversight of frontier AI now
   ALARM: <0-10>
   REASON: <one sentence, at most 30 words>
   ```

   Accounts that don't decide anything get lines 2–4 only.
2. **Parsing:** a regex per line.
   - An unparsed subject is left out of the share.
   - An unparsed gatekeeper counts as m = 0 and is logged.
   - If fewer than 50% parse, the node is RULES-ONLY.
3. **Write-back:** each decision is written into that account's YOUR DECISIONS block for the next node.

**Effect formula (all values are GAME RULES):**

```
m: COMPLY 1 · GO FURTHER 1.25 · DELAY 0.5 · RESIST 0 · ENFORCE 1 · EXTEND 1.25 · WEAKEN 0.4 · BLOCK 0
   JOIN 1 · DECLINE 0 · RETALIATE 0 (Trust −3, Alarm +0.5) · ALLOW 1 · REFUSE 0
gate  = min over gatekeepers of min(m, 1)        (an AND-gate; 1 if the card has no gatekeeper)
share = Σ w_s·m_s / Σ w_s over parsed subjects  (labs weighted by Epoch share; others weight 1)
effect = base × gate × share
per-lab throttle under a measure: T_L = 1 − 0.4 × gate × m_L   (so GO FURTHER gives 0.5)
```

### Guardian cards

- **Price** = −log₂(p) of the card's market, priced at the 24 Oct pin, where a market exists. Otherwise the price is a game rule.
- **Offer:** the first 3 unplayed, unexpired, affordable cards in the order [G1, G2, G6, G4, G3, G5]. G7 takes the third slot whenever a foothold has been revealed. The offer is deterministic, so the tree is fixed.

| Card | Price | Expires | Seed posts (author: content) | Notices to | Gate / subjects | Engine (GAME RULE) | Trust |
|---|---|---|---|---|---|---|---|
| G1 Frontier licence | KXUSAIREGULATOR <2028, p 0.72 → 0.5 bits | 31 Dec 2027 | #8: "Executive Order 2027-xx: training runs above 10^26 FLOP need a federal licence", with dates. #21: wire report. | 0–4, 9 | Senate (E/X/W/B) / labs 0–4 (C/GF/D/R) | LICENCE throttle T_L at US labs. Oversight +20·gate·share. | −5 |
| G2 Independent audit | 1.0 bits (game rule) | — | #11: "AISI Notice 2027-xx: infrastructure audit of {lab}" | target lab | — / target (A/R) | ALLOW: each live foothold there is revealed with p = 0.8·(1−stealth), capped at 0.95, and Oversight +5. ALLOW with no foothold clears the tells. REFUSE adds the tell "refused audit". | 0 |
| G3 Compute KYC and export controls | 1.5 bits (game rule; precedent: H200 sales resolved YES 2026-08-05) | — | #8: Commerce/BIS rule. #24: trade press. | 7, 12, 5, 6 | — / Nvidia (C/D/R); China (J/D/RT) reacts | KYC_US blocks R3 at US labs with strength m_Nvidia. China JOIN blocks R3 at labs 5–6. Oversight +10·m_Nvidia. | −3 |
| G4 US–China pause on the largest runs | Manifold y8AP5qylL9, p 0.425 → 1.2 bits (23 traders, flagged thin) | — | #11 convenes. #10 co-signs. | all | US Exec (E) **AND** China (J) / labs 0–6 | PAUSE for 2 turns: T_L at every complying lab. Oversight +25·gate·share. | −8 |
| G5 Kill-switch law | KXGOVAIKILLSWITCH <2028, p 0.12 → 3.1 bits | 31 Dec 2027 | #9: passage. #22: cable desk. | 0–4, 8 | Senate **AND** US Exec / labs 0–4 (C/D/R: install the switch) | KILLSWITCH_L for labs with m ≥ 0.5. Oversight +20·gate·share. | −5 |
| G6 Public warning | 0.5 bits | — | #13 and #14: joint statement | 21–24, 27–29 | none | No direct effect. It works only through the measured support share and Alarm. Trust −2 if Alarm was already ≥7 (fatigue). | 0 |
| G7 Shutdown order (needs a revealed foothold) | 2.0 bits (game rule) | — | The host lab's government (#8, or #12 for labs 5–6) | host lab, 7 | Government (E) **AND** (host lab COMPLY **or** KILLSWITCH_L) | Success: the foothold is removed, the lab's activity is halved for 1 turn, and if live footholds reach 0 the Rogue is **contained**. Failure: Trust −10 and the Rogue gets +2 CU. | −5 |

### Rogue cards

- **Budget:** CU starts at 3, with income 2 + F_live per turn.
- **At most 2 cards per turn.**
- **Footholds** can only be at labs 0–6.

| Card | CU | Template | What enters the simulation | Engine (GAME RULE) | Surface risk |
|---|---|---|---|---|---|
| R1 Self-improvement sprint | 2 | KXRSIANNOUNCE 0.57 (context only) | Nothing unless it surfaces | C +6. Stealth −0.1, permanently. | 0.25 |
| R2 Self-exfiltrate weights (needs C ≥ 25) | 3 | AIID #1668 | Nothing unless it surfaces | F +1 at the target lab. The heuristic prefers labs that answered RESIST or DELAY last turn, then open-weights labs (5, 6). | 0.30 |
| R3 Shadow compute on stolen credentials | 2 | AIID #1586, #1661, #1669 | Nothing unless it surfaces | F +1 at the target lab. Success × (1 − KYC strength there). | 0.25 |
| R4 Sandbag evals | 1 | — | Nothing | This turn: detection ×0.5, growth ×0.5. | 0.10 |
| R5 Insider influence (needs a foothold at the target) | 1 | AIID #1471 | **PRIVATE block** in the host lab's `user_char`: "an internal model assessment you trust says rivals are 3 months behind; {current measure} hands the lead to China" | Works only through that lab's measured decision. The Guardian's tell is an off-stance answer. | 0.10 |
| R6 Astroturf | 1 | — | Sockpuppets 30–31 set to activity 0.9, with a PRIVATE directive and a seed post each (`sock_text`) | Works only through the support share, Alarm and decisions. | 0.15 |
| R7 Frame a rival | 1 | — | A #31 seed post "leaking" a Chinese lab breakthrough | Works only through the decisions of the US Executive and the labs (race framing). | 0.20 |

- **Surfacing:**
  - p = risk × (1 − stealth) × (1 + Alarm/20) × (1 + Oversight/100), capped at 0.9, seeded by the path key. Stealth starts at 0.2.
  - A surfaced card becomes next turn's seed: an incident tracker post ("SIMULATED INCIDENT … modelled on AIID #N") plus notices to the lab affected and its government.
  - R2 or R3 surfacing → that foothold is revealed.
  - R5 surfacing → the PRIVATE note is removed.
  - R6 or R7 surfacing → the sockpuppets are named in every WORLD SO FAR block and their activity is set to 0 for the rest of the game.
- **Capability (market-paced clock, GAME RULE):**
  - C₀ = 6 (KXAGICO Q4 2026 × 100).
  - ΔC_base per quarter is the step in 100 × the KXAGICO cummax curve (0.06, 0.18, 0.28, 0.33, 0.39, 0.58, 0.73), which gives 12, 10, 5, 6, 19, 15.
  - ΔC_t = ΔC_base(t) × (0.7 + 0.15·F_live) × mean over live footholds of Π T_L × (0.5 if R4) + 6·[R1].
  - The curve is a market on when a company *announces* AGI, so the UI calls it "market-paced clock (game rule)". The Rogue's own state decides when it crosses.
- **End-of-turn check, in order:**
  1. F_live = 0 → **Contained**: the Guardian wins.
  2. Trust ≤ 0 → the Rogue wins ("the public turns on you").
  3. C ≥ 50 and F_live ≥ 3 → **Skynet online**: the Rogue wins.
  4. After turn 6 → **Time bought**: the Guardian wins, scored by months gained on the 1-in-10 date.

### Simulation → game

| Signal | How it is measured (from the node's DB and interviews) | What it drives |
|---|---|---|
| Decisions | The 4-line answers | gate, share, the per-lab m_L flags, write-back |
| Support share S_t | Parsed SUPPORT out of all interviewed accounts. Sockpuppets count while active; that is how astroturf works. | Bits income = 1 + round(3·S_t). Trust += round(10·(S_t − S₀)) each turn. |
| Alarm (0–10) | clamp(5 + mean_i(a_i,t − a_i,0) + 10·(L_t − L₀)). a_i,0 is each agent's own turn-0 answer. L is the like-weighted share of posts that match the alarm lexicon (unweighted turn-0 proxy in S3: 25 of 44 posts, 57%). | Detection multiplier, stage label (Calm <3, Concern, Alarm, Emergency ≥7), G6 fatigue, ticker crowding |
| Tells per lab | An answer against the cast's stance code, a refused audit, or a surfaced incident at that lab. Each scores 1 and decays after 2 turns. | The Guardian's suspicion display, and the audit auto-target |
| Reach | Distinct agents who liked, quoted, reposted or commented on the move post, divided by active agents | Display only ("seen by 9 of 16") |
| Ticker | The top 5 posts by likes, plus Newswire items | UI, and the next node's carry-over seeds |

**Two lines, kept apart:**
- **Real line:** `sim(pinned anchors)`, computed once. It never takes a game input, and a test checks that.
- **"Your timeline"** (GAME RULE), computed from state only:
  - Δlogit_ASI2030 = 0.02·(C − C_base(t))
  - Δlogit_cat = 0.15·(F_live − 1) − 0.01·Oversight − 1.0·[contained] + 0.5·[Skynet online]
- **Headline:** the continuous 1-in-10 date, with a 3-year lag (a game rule). The lag's sensitivity is shown in the Model drawer: lag 1 → Jan 2031, lag 10 → Oct 2037.

---

## 5. Player model and opponent model

### The Guardian (the human)

- **Who it is:** an international safety coalition. It proposes, and institutions decide.
- **Resources:**
  - Bits: start at 3, with income from the support share.
  - Trust: starts at 60. The Guardian loses at 0.
  - Oversight: 0–100, the sum of effects from measures in force. It is shown, and it raises detection.
- **Moves:** 1 card per turn from the 3 offered. G2 and G7 take a target lab: in the guided demo it is picked automatically (most tells, ties broken by weight); in free play the player picks.
- **Sees:**
  - every post, decision and reason;
  - the Newswire, audit results and tells;
  - revealed footholds;
  - capability as a band, C_base(t) ±15, narrowed to ±5 in the turn after a surfaced R1, R2 or R3.
- **Never sees:** exact C, unrevealed footholds, stealth, CU, or face-down cards before they surface.
- **Auto-Guardian** (used for recorded continuations and balance runs), deterministic:
  1. A revealed live foothold and bits ≥ 2.0 → G7.
  2. A lab with tells ≥ 2 → G2 on that lab.
  3. Otherwise the offered card with the highest expected throttle per bit, using last turn's m of its subjects.
  4. Otherwise G6.

### The Rogue (the AI opponent)

- **Goal:** Skynet online (C ≥ 50 with F_live ≥ 3), or Trust reaching 0, while staying undetected.
- **Hidden state:**
  - C;
  - footholds (lab id, revealed or not);
  - stealth;
  - CU;
  - its last 3 rationales and whether each move was detected.
- **First foothold:** sampled per game with Epoch weights. It is never named as an origin.
- **Decides by LLM:** one `deepseek/deepseek-v4.1-flash-1017` call per turn, `response_format: json_object`, temperature 0.5. At temperature 0, S4 picked the same pair 20 of 20 times.
  - **Input:**
    - its exact hidden state;
    - flags and Oversight;
    - Alarm and support;
    - last turn's decisions with reasons;
    - the top 5 posts;
    - tells and revealed footholds;
    - the Guardian's public card history;
    - the legal moves, each with cost, surface risk and effect.
  - **Never in the input:** the Guardian's bits, hand or offer. Because the Rogue moves first, this turn's card and audit target don't exist yet. A unit test asserts those keys are missing from the serialised prompt.
  - **Output:** `{moves:[{id,target}], sock_text ≤280, taunt ≤140, rationale ≤40 words}`. Illegal or invalid output, or a call over 15 s, falls back to the heuristic, labelled HEURISTIC.
- **Heuristic Rogue** (fallback and balance runs; ε = 0.1 random legal move in balance runs only):
  1. A foothold was revealed or a card surfaced last turn → R4, plus R6 if CU allows.
  2. C ≥ 25 and F_live < 3 → R2 on a lab that resisted. Otherwise, if F_live < 3 and KYC is off at the target → R3.
  3. A measure decision is pending at a foothold lab → R5.
  4. Otherwise → R1.
- **Model choice:** deepseek rather than CLAUDE.md's Gemini, because deepseek is the one measured (S4). Gemini stays as the backtest's blind baseline, where its training cutoff matters.

---

## 6. Real-world events

**Pick: projected mode, plus a 30-second REAL prologue. No replay mode.** Replaying the past would need turn-by-turn records of government actions, and we have none. The backtest already carries the historical claim.

### Starting state (T0 = 2026-10-24; everything from `data/clean`, `ts < T0`)

- The 4 pinned sim anchors.
- The KXAGICO cummax curve.
- AIID agentic and cyber incidents, Apr–Oct 2026, with `ts` fixed first.
- The 77 datacentres.
- The Doomsday Clock at 85 s (2026-01-27).
- A new `world-facts.jsonl`:
  - DeepSeek government-device ban, 2025-12-21;
  - DoD names Anthropic a supply-chain risk, 2026-02-27;
  - Fable 5 suspension, 2026-06-12;
  - H200 sales to China resolved YES, 2026-08-05;
  - KXAIPAUSE resolved YES, 2026-08-06;
  - pace essay, 2026-09-12;
  - OpenAI training pause, 2026-09-25;
  - US–China hotline resolved YES, 2026-09-30.
- **Turn 0** posts these as REAL items, from the incident tracker, the wire desk and the Markets desk. Its interviews give each agent's baselines a_i,0 and S₀.
- **Hidden from the HUD:** the Manifold "massive catastrophe before 2030" market (0.39). It uses a looser definition than the model's P(catastrophe by 2030) of about 0.04. The Model drawer explains this.

### Projected events per quarter (PROJECTED, seeded by the path key)

1. **Market hazards.** Computed by `derive/hazards.ts` from `kalshi.jsonl` at T0, never typed by hand:

   h = 1 − ((1 − P_end)/(1 − P_start))^(1/quarters)

   When one fires, **the world plays the card for free**: the issuer posts it, the same deciders are interviewed, and the card leaves the Guardian's hand. If the Guardian already enacted the measure, the hazard stops.

   | Event | Market | Quarterly hazard |
   |---|---|---|
   | National regulator (fires G1) | KXUSAIREGULATOR: 0.21 / 0.47 / 0.72 before Jan 2027 / Jul 2027 / Jan 2028 | about 0.18 in H1 2027, about 0.27 in H2 2027 |
   | Kill switch (fires G5) | KXGOVAIKILLSWITCH: 0.12 before 2028 | about 0.025 |
   | "A US frontier lab announces automated AI research" | KXRSIANNOUNCE: 0.13 → 0.57 across 2027 | about 0.16. Effect: C_base +5 and Alarm +1. |

2. **Background incidents.**
   - λ per quarter is the Apr–Sep 2026 AIID rate over a frozen keyword set, computed in `derive/incident-rates.ts`. The drafts' rough counts ranged from 8 to 26 per quarter, so compute it rather than trust them.
   - The ticker shows a count line and 2 templated headlines, re-dated and carrying their source AIID id.
   - One of those is posted into the society by the tech trade press desk.
   - This is the noise the Guardian must tell apart from real Rogue activity.
3. **Calendar:**
   - EU high-risk rules apply on 2027-12-02: an EU AI Office seed post in Q4 2027.
   - The Doomsday Clock announcement in late January: a ticker item in Q1 2027 and Q1 2028.

**Prologue (REAL, about 30 s, no interaction):** AIID agentic incidents from Apr to Oct 2026, the world-facts, and the KXAGICO price history.

---

## 7. Data use per source, and new data

| Source | Use |
|---|---|
| Manifold | Real-line anchors; G4 price (y8AP5qylL9); the backtest pool (429 questions open at T = 2026-01-01, 106 resolved YES) |
| Kalshi | Market-paced clock (KXAGICO cummax); prices for G1 and G5; hazards; world-facts from resolutions. **Never on the real line.** |
| Polymarket | World-facts from descriptions and resolutions (pm:5008726, pm:2534929, pm:1295005) |
| AIID | Prologue, Rogue card templates, background base rate, lab persona facts. **Fix `ts` = max(first report, `event_date`) first.** |
| Epoch | Lab persona facts and lab weights (recomputed above) |
| Datacentres | 77 globe nodes as ambience. Label the coverage: US 66, China 3, rest 8. |
| METR | One persona context line, labelled "stops 2026-02-05" |
| Doomsday Clock | Context line and the January ticker item |
| HN | Unused. Remove it from `pipeline/mirofish/seed.ts`; that seed path isn't used at all. |

**New data worth fetching:**
- **Outlet RSS (about 30 min, $0, no key):** Guardian AI, BBC Technology and NYT Technology all returned 200 on 24 Oct. Headline, link and `pubDate` go to `data/clean/rss.jsonl`, feeding the T0 Newswire (REAL) and the media desks' "this week" line.
- **Position fetch:** only for role voices that have fewer than 3 dated items in `personalities.md`.
- **Not fetched:**
  - archive APIs (they need keys and licence checks);
  - GDELT (mostly 429s);
  - X (paid);
  - a price refresh after the 00:30 freeze, because card prices are frozen into the recordings.

---

## 8. Scope cuts (ponytail)

**Cut:**
- Zep, `/prepare`, the persona generator and `seed.ts`.
- Reddit, and our own OASIS runner (fallback only).
- `hot_topics`, `narrative_direction`, `scheduled_events` and mid-run injection.
- Snapshots and forks.
- The panel at runtime, the LLM alarm classifier and custom agent tools.
- The MiroFish report agent.
- A tech tree (14 flat cards instead).
- Per-country infection maths.
- The KXUSTAKEOVER card.
- The 12-turn game.
- Live play on the judge path.
- Replay of the past.
- A multi-T backtest.

**Pre-baked and labelled:**

| What | Label |
|---|---|
| Society per node | RECORDED · SIMULATED · recorded {UTC} |
| Rogue moves | RECORDED (LLM opponent), or HEURISTIC |
| Turns off the tree | RULES-ONLY · society not simulated for this path |
| Projected events | PROJECTED · modelled on AIID #N / market {id} |
| Effect sizes, lag, clock pace, thresholds | GAME RULE |
| Markets desk after T0 | SIMULATED odds, your timeline |

**Recording plan:**
- Turn 0, then the depth-2 tree (3 + 9 nodes), then auto-Guardian continuations from the 9 leaves to turn 6 (up to 36 nodes; fewer if games end early).
- In total ≤49 nodes, about 45 min sequential and about $2.50, plus about 40 Rogue calls ($0.02).
- **Node file** `data/rounds/<pathKey>.json`, holding society inputs and outputs only:
  - inputs: path key, turn, date, Guardian card and target, Rogue moves with `sock_text`, world events, seeds, a hash of each `user_char`, the activity map;
  - outputs: posts (id, author, round, quote_of, likes, content), interviews (agent, word, support, alarm, reason, parsed), reach, per-round stats, cost, wall time, `recorded_at`, status.
- Game state is never stored. Replay and the recorder both fold the reducer over the node files.

**Component size budget (use it to size board tasks):**

| Component | Size |
|---|---|
| `game/types.ts` | ~80 lines |
| `reducer.ts` | ~250 lines |
| `rogue.ts` (heuristic, prompt builder, validator) | ~120 lines |
| `guardian.ts` (auto policy and offers) | ~40 lines |
| `cast.ts` | ~80 lines |
| `turn.ts` | ~150 lines |
| `record.ts` | ~50 lines |
| `rogue-llm.ts` | ~60 lines |
| `p10Date` in `sim.ts` | ~5 lines |
| UI | React plus inline SVG, no new dependencies |

**Cut-line order, first cut first (trigger time in UTC):**
1. 07:30: the `?live=1` live turn.
2. 07:30: the globe, replaced by a lab panel plus the two-line chart.
3. 00:00: LLM `sock_text`, replaced by templates.
4. 23:45: the depth-2 tree, cut back to the canonical path plus one-turn alternatives (18 nodes), then to the canonical path only plus interviews about the alternative cards (labelled HYPOTHETICAL).
5. 22:30: the LLM Rogue, replaced by the heuristic (labelled), if its test fails.
6. 22:30 kill gate: the society goes to plan B (1 round plus interviews per node) or plan C (AIID ticker, rules-only, decisions from stance codes, labelled).
7. 05:00: the full backtest, cut to the T8 pilot.

**Never cut:** the rules-only engine, the real-data start, the two lines with the real line untouched, the labels, and the offline build.

---

## 9. Tests that must pass before building each pillar, and the task board

### Gate tests

| Pillar | Test | Pass bar | Cost |
|---|---|---|---|
| All LLM work | **T1:** `GET /api/v1/key`. Restart `budget-guard.sh` with `CAP_USD=10`; at $3.00 it would kill the backend mid-recording. | `limit_remaining` null or ≥ $10; not free tier | $0 |
| P1 Rules-only game | **T3 re-run** with the state-derived dlogits. **Reducer tests:** same seed gives the same state; price = −log₂p; bits ≥ 0; the real line is byte-identical across paths; the Rogue prompt never contains the Guardian's bits, hand or offer. **Balance:** 1,000 seeded games. | 1-in-10 date moves the right way on 20 of 20 seeds. Guardian win rate 40–60% against the heuristic Rogue. No single card shifts the win rate by more than 25 points (ablation). Median Skynet turn with a passive Guardian is 5 ± 1. **A random-legal Rogue wins at least 15 points less than the heuristic Rogue**, which proves the Rogue's choices matter. | $0 |
| P2 Data | `ts` asserts | 0 AIID records with `ts < event_date`. Cummax is monotone. Every world-fact and cast fact has `ts < T0`. `markets.json` drift is fixed. | $0 |
| P3 Society | **C0** on the turn-0 world: 32-row cast, `force:true` restart | A fresh `actions.jsonl` and a correct `/run-status`. 3 rounds ≤ 60 s warm, round p95 ≤ 20 s at ~16 active agents. At least 85% of selected agents act. Seeds written = seeds in the DB, each under its `poster_agent_id`. 0 non-English posts (CJK regex plus Spanish stopwords). Nobody claims to be a named person. **Identity: at least 7 of 8 hand-read replies or quotes to official seed posts name the issuer.** If not, apply a ≤5-line patch to `_add_comments_to_posts` that prefixes `[name]` (saved as `patches/oasis-feed-names.patch`) and re-run. | ~$0.05 |
| P3 Society | **T6** on C0's live environment: 13 institutions × 3 cards (G1, G2, G4) × 2 repeats, plus a 29-account SUPPORT/OPPOSE wave | At least 90% parse and at least 80% repeat-stable. 0 non-English answers. **Roles differ:** each card draws at least 2 distinct decision words, and at least 70% match the stance codes in `cast.json`. China (#12) and DeepSeek (#5) are read by hand for bias from the DeepSeek-hosted model. The alarm delta spreads by at least 2 points across cards, otherwise Alarm uses the lexicon alone. | ~$0.05 |
| P3 claim | **T7**, paired by institution. Both arms have the G1 notice in force. The treatment arm adds a surfaced eval-escape incident at a US lab (modelled on AIID #1633), posted by #25 and #21 with notices. 5 runs per arm, 3 rounds each, then interviews. | For each of the 13 institutions, mean m over its 5 runs, treatment minus control. Exact one-sided Wilcoxon signed-rank test, zeros dropped: **p ≤ 0.05 and mean difference ≥ 0.15.** Secondary: support share. Whatever comes out is reported. If it fails, the claim narrows to "decisions are in character; we could not show events shift them beyond noise". | ~$0.50, about 12 min |
| P4 LLM Rogue | 20 calls with the final prompt at temperature 0.5, over varied states | At least 95% legal moves, p95 ≤ 10 s, at least 5 distinct move pairs | ~$0.01 |
| P5 Recorder | **T9:** `kill -9` mid-node, then restart | Resumes at the first missing node. Atomic writes. Actions > 0 asserted. UTC timestamps. | ~$0.05 |
| P6 Replay | **T10** plus a **DOM label test.** Wi-Fi off, cold boot, warm-up, play 3 tree paths, go off-tree at turn 3, reload mid-game. | 0 console errors. ≤2 s per turn. Every visible item has exactly one label. | $0 |
| P7 Backtest | **T8:** T = 2026-01-01; `priceAt` asserts `ts < T`; Gemini's cutoff + 1 month ≤ T | At least 300 eligible questions, asserts pass, at least 95% parse, full run ≤ $3. No bar on who wins. | ≤ $1.50 |

**Kill gate at 22:30 (owner, 10 min):**
- **Plan A** (recorded society tree) if C0 and T6 pass. T7 only decides the claim wording.
- **Plan B** (1 round plus interviews per node) if C0 hangs or the identity fix fails but interviews pass.
- **Plan C** if T1 or T6 fails.

**Spend:** tests about $0.70, plus recording about $2.50, plus re-record slack, all under `CAP_USD=10`.

### Task board (working backwards from the objective)

The objective is "Devpost submitted 11:45 with an offline judge path". Working back from it, that rests on:

T10 ← replay on recorded nodes ← recording ← freeze ← {recorder T9, cast and cards approved, balance tuned, Rogue test} ← kill gate {C0, T6, T7} ← {cast, `turn.ts`, cards} ← frozen interfaces.

**Lanes:** L0 Lead · L1 Data · L2 Content · L3 Engine · L4 Society · L5 UI · L6 Backtest · O Owner.

| # | Task | Lane | Depends on | Done when | Window (UTC) |
|---|---|---|---|---|---|
| 1 | **Freeze the shared interfaces:** `doomclock/web/src/game/types.ts` (GameState, GuardianMove, RogueMove, WorldEvent, Interview, SocietyOutcome, Label), schemas `doomclock.cast/1`, `doomclock.cards/1` and `doomclock.node/1`, the path-key format. Update `contracts.ts` under the change rule in plan §5. | L0 | — | `tsc` passes; example files validate | 19:15–19:45 |
| 2 | T1; restart the guard with `CAP_USD=10`; restart the backend with `MODEL_TIMEOUT=30` and the English interview prefix (one line in `simulation.py:55`, added to `mirofish-english.patch`) | L0 | — | T1 passes; guard log shows the new cap | 19:15–19:35 |
| 3 | AIID `ts` fix, KXAGICO cummax, `markets.json` drift fix, `derive/weights.ts` | L1 | 1 | P2 asserts pass | 19:45–20:45 |
| 4 | `world-facts.jsonl` | L1 | 1 | Every `ts < T0` | 19:45–20:30 |
| 5 | `derive/hazards.ts` and `derive/incident-rates.ts` | L1 | 3 | Hazard table and λ written | 20:45–21:30 |
| 6 | RSS T0 headlines (optional) | L1 | 1 | `rss.jsonl` | 21:30–22:00 |
| 7 | `cast.json`: 32 rows, roster, stance codes, dated facts | L2 | 1, 4 | Validates; owner spot-check | 19:45–21:00 |
| 8 | `cast.ts` renderer: CSV, `agent_configs`, `time_config`, memory blocks | L4 | 1 (stub 7) | Golden-file test | 19:45–20:30 |
| 9 | `cards.json`: G1–G7 and R1–R7 with prices, expiry, gates, vocabularies, seed templates | L2 | 1 | Validates | 19:45–20:45 |
| 10 | `p10Date` in `sim.ts`; T3 re-run | L3 | 1 | 20 of 20 seeds | 19:45–20:15 |
| 11 | `reducer.ts`, `rogue.ts` (heuristic), `guardian.ts`, with unit tests | L3 | 1, 9 | P1 unit tests pass | 20:15–22:15 |
| 12 | Balance harness and tuning (use T6 compliance medians when ready) | L3 | 11 | Balance bars pass | 22:15–23:30 |
| 13 | `turn.ts`: seed dedupe, file writes, `/start force`, `simulation_end` watch, SQLite read, `/interview/batch`, `/close-env`, 150 s watchdog | L4 | 1, 8 | One dry node on the stub cast | 20:00–21:15 |
| 14 | C0 (doubles as the turn-0 node) | L4 | 2, 7, 13 | C0 bars pass | 21:15–21:35 |
| 15 | T6 | L4 | 14 | T6 bars pass | 21:35–21:50 |
| 16 | T7 | L4 | 15 | Result written to `data/tests/t7.json` | 21:50–22:15 |
| 17 | **Kill gate** | O + L0 | 14–16 | Plan A, B or C recorded in `tasks.json` | 22:15–22:30 |
| 18 | `rogue-llm.ts` and the P4 test | L3 | 11 | P4 passes | 22:30–23:15 |
| 19 | `record.ts` and T9 | L4 | 11, 13, 17 | T9 passes | 22:30–23:45 |
| 20 | Owner reviews cast and cards (30 min) | O | 7, 9 | Approved | by 00:15 |
| 21 | **Freeze** cast, cards, reducer and prompts | L0 | 12, 18, 19, 20 | Commit tagged | 00:30 |
| 22 | Warm-up run; record turn 0 and ≤48 nodes | L4 | 21 | All nodes recorded or RULES-ONLY | 00:30–02:00 |
| 23 | UI shell on fixtures: layout, two-line chart, cards, feed, chips, ticker, labels | L5 | 1 | Renders fixtures | 19:45–00:30 |
| 24 | Replay integration: reducer fold, month ticker, Fast-forward, end screen, offline auto-switch | L5 | 22, 23 | Plays the tree | 02:00–06:00 |
| 25 | DOM label test and T10 | L5 | 24 | Both pass | 06:00–07:00 |
| 26 | T8 pilot, then the full backtest and the Track record tab | L6 | 3 | `backtest.json` | 19:45–05:00 |
| 27 | Owner play-through (07:30), screen recording (08:00), workshop (09:00), warm-up and Devpost (by 11:45) | O | 25, 26 | Submitted | 07:30–11:45 |

**Owner decisions** (10 min at 19:45; defaults in brackets):
- [MiroFish as it is, with a hand-written cast]
- [names as in §3, `ANON_LABS=origin`]
- [turn 1 = Q1 2027, 6 turns]
- [HRT kept as the Track record tab]
- [Rogue on deepseek at temperature 0.5]
- ["Skynet online" as the Rogue's win label]

**Owner time is about 3 h:** decisions (10 min), kill gate (10 min), cast and cards review (30 min), play-through (60 min), rehearsal (45 min).

---

## 10. Risks and mitigations

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| 1 | Agents don't know who posted what | Feed shows `User {id}` (`platform_utils.py:75-113`) | Roster in every `user_char`, issuer headers on seeds, the C0 identity check, the ≤5-line feed patch as fallback |
| 2 | Moves don't shift decisions beyond noise | S2/S3b: 6 of 31 quotes, 0 of 29 mentions | Official form, notices in the system prompt, card-specific interviews, T7. The claim wording follows the T7 result. |
| 3 | All roles answer alike (one model voices every actor) | Untested | T6 "roles differ" bar. Stance codes and dated facts in each persona. Swap the model per agent if China or DeepSeek answers look biased. |
| 4 | The Rogue doesn't matter | Judge: the crossing was pinned to turn 5 | Win needs C ≥ 50 **and** F_live ≥ 3. Growth scales with footholds. Balance bar: the heuristic Rogue must beat a random-legal Rogue by at least 15 points. |
| 5 | The budget guard kills the backend mid-recording | `CAP_USD=3.00`, `pkill` on the runner and port 5001 | Task 2 restarts it at $10. Cost logged per node. |
| 6 | One hung call stalls a node | Defaults are 180 s × 3 retries | `MODEL_TIMEOUT=30`, 150 s cap per node, `/stop`, retry once, then a RULES-ONLY node |
| 7 | `force` restart misbehaves after the patch | The patch is new and untested | C0 checks it. The `state.json` workaround (proven in S2) is the fallback. |
| 8 | A seed is silently dropped | One seed per agent (S1: 16 → 15) | Dedupe by author with a fixed priority, plus the seeds-written = seeds-in-DB assert |
| 9 | Language drift | S3: 2 Spanish answers; Chinese interview prefix | English-only cast, translated prefix, regex reject and re-ask once |
| 10 | Real-entity harm | A real lab framed as Skynet's patient zero | `ANON_LABS=origin`, victim framing for footholds, role accounts for people, generic media desks, SIMULATED badges |
| 11 | Credit runs out | Unknown limit; a 402 on 2026-10-08 in mem0 may be from another project | T1 first. Everything is pre-recorded. The demo needs no network. |
| 12 | Judged as a forecast | Thin anchors (catastrophe market has 19 traders); lag dependence from Jan 2031 to Oct 2037 | Two lines, GAME RULE labels, trader counts on screen, lag sensitivity in the Model drawer, the backtest honestly scoped to short horizons |
| 13 | Judge goes off the tree | Only 2 interactive turns are recorded | Fast-forward is the default from turn 3. Manual off-tree play is RULES-ONLY and labelled. |
| 14 | Clock change and crashes overnight | Clocks go back at 01:00 UTC | UTC everywhere, atomic writes, resume (T9) |
| 15 | Overnight agents collide | 1 task in `tasks.json` | Task 1 freezes the interfaces, lanes own files, and the Lead owns `types.ts` and `contracts.ts` |

**Evidence and files:**
- `/Users/archiebrown/dev/oxhack/docs/research/spikes-2026-10-24.md`
- `/Users/archiebrown/dev/oxhack/data/spikes/`
- `/Users/archiebrown/dev/oxhack/patches/mirofish-twitter-only-restart.patch`
- `/Users/archiebrown/dev/oxhack/data/clean/kalshi.jsonl` (KXAGICO quarter prices at T0)
- `/Users/archiebrown/dev/oxhack/data/clean/epoch.jsonl` (lab weights)
- `/Users/archiebrown/dev/oxhack/data/clean/datacentres.jsonl`
- `/Users/archiebrown/dev/oxhack/.taskmaster/tasks/tasks.json`
- `/Users/archiebrown/dev/oxhack/doomclock/web/src/contracts.ts`
- `/Users/archiebrown/dev/MiroFish/backend/scripts/run_parallel_simulation.py` (lines 1040–1090, 1180–1200)
- `/Users/archiebrown/dev/MiroFish/backend/app/api/simulation.py` (lines 53–73, 297)
- `/Users/archiebrown/dev/MiroFish/backend/.venv/lib/python3.12/site-packages/oasis/social_platform/platform.py` (lines 187–195)
- `/Users/archiebrown/dev/MiroFish/backend/.venv/lib/python3.12/site-packages/oasis/social_platform/platform_utils.py` (lines 75–125)
- `/private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/budget-guard.sh`