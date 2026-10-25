# Doom Clock: coupled MiroFish loop (design, 25 Oct 2026)

Owner: Archie. Written by the Lead from the 25 Oct 00:45–02:10 GMT design session and the four scoping
reports in `.tmp/scoping/` (MiroFish, engine, data and sceptic checks). Supersedes the game layer
and the "10,000 futures" framing. Freeze 11:30 GMT, submit 11:45 GMT.

## What the app becomes

One forecast, five scenarios. Real prediction-market odds say **when** powerful AI arrives. A
simulated world says **how dangerous** it is. Together they set the clock.

- **Today's clock is the forecast.** Real odds plus today's real world, scored with the same rubric
  the simulation uses. It is the only prediction scored by the backtest.
- **Five futures are scenarios.** MiroFish plays each one forward, 6 months per run, 2027 to 2029.
  Its events move that future's clock. On screen: "a scenario, not a prediction".
- **Event predictions.** The same event across the five futures becomes a dated claim with odds
  ("the US creates an AI regulator before 2028: 3 of 5 futures"), shown beside a real market where
  one is pinned.

Pitch line: "The clock is the market's *when* and the simulated world's *how dangerous*. MiroFish
plays out five futures, and you can see exactly how much each event moves the clock."

## Owner decisions (25 Oct)

1. The game layer is dropped. 5 futures, not 10,000.
2. Markets give *when*; MiroFish's situation report gives *how dangerous*.
3. Prices and news are coupled both ways: odds seed each run, and each run's events move the odds.
4. **Every simulated event comes from MiroFish posts**, saved as an event object. Nothing after
   today is copied from a real story.
5. The report scores the world on a fixed rubric mapped to risk by a labelled table. It does not
   output a free probability.

Lead defaults, open to review: 6 steps of 6 months (the engine breaks after 2030.0); futures are
seeds 1–5; asi2030 decays with time (constant hazard), labelled a rule; MiroFish's report agent is
not used (it reads an old Zep graph); interviews are dropped (they were inert: support 0.621 in
every run).

## The loop (per future f = 1..5, step s = 1..6, each 6 months from 2027-01-01)

State going into a step: anchors (asi2030, asi2040, asi2100, cat2100 as probabilities), the
rubric scores, and the event history.

1. **Seed the run.** Rewrite every account's `user_char` (3,000-char cap, `game/cast.ts` renderer):
   - WORLD SO FAR: the last 8 dated events, plus one `MARKETS NOW` line (current anchors and their
     change since the last step) and one line for the last step's situation summary.
   - YOUR DECISIONS SO FAR: that account's past events, so nobody repeats a decision.
   - The incident tracker and the wire desks: "report the new AI incidents you learn of this period:
     which lab, what happened, date, how serious".
   - Each institution: "if you act this period, announce one decision within your powers, with a
     document number and an effective date".
   - Remove OpenAI's "resume the paused runs" goal (persona noise: it fired in 3 of 5 runs).
   - WHAT PEOPLE EXPECT NEXT: the last situation report's plausible events (step 4).
   - Seed posts: the previous step's top 3 posts and the Markets desk post.
2. **Run MiroFish.** Twitter only, 3 rounds, `force:true` restart, about 35–60 s and $0.03. No
   interviews.
3. **Read out events.** One cheap model call over the step's posts (deepseek flash, temperature 0,
   JSON) returns event objects. A post counts only if the account has standing:
   - government or regulator → a decision (law, rule, ban, deal);
   - lab → a decision (pause, release) or a disclosure of its own incident;
   - incident tracker or wire desk → an incident (lab, what, severity);
   - anyone else → not an event (mood only).
   Rules: first-person and dated; the action must be within the account's `powers` in `cast.json`;
   dedupe (actor, action) across steps; at most 3 events per type per step; bad JSON → no events.
   **No-copy check:** reject any event whose title or detail is too close to a real event in
   `data/events.json` (token overlap), so nothing real is repeated.
4. **Situation report.** One model call over the step's events and top posts (temperature 0, two
   samples averaged) scores four items from 0 to 3, each citing event ids:
   loss of control · misuse · oversight (3 = strong) · race pressure. Each item can move at most ±1
   per step. It also writes a 2–3 sentence summary that quotes only our own numbers, and lists
   **3–5 plausible events for the next 6 months** (who would act, what, why, citing this step's
   events). Bad JSON → keep the last scores and no expectations.
   The plausible events are expectations, not events: they enter the next run as one
   `WHAT PEOPLE EXPECT NEXT` line in every account's memory, plus a line to the account that would
   have to act. They become events only if an account with standing posts them in that run. Log
   how many expected events happened (the in-simulation hit rate) and how many events were not
   expected.
5. **Move the odds.**
   - *When* (asi2030, asi2040): `logit' = logit + Σ rule nudges + noise`. Nudges per event (logit,
     asi2030 / asi2040): agentic or cyber incident at a lab, major +0.08 / +0.04; lab capability
     claim or release +0.05 / +0.025; binding act that adds compute or removes barriers
     +0.03 / +0.015; binding restriction (export control, ban, licensing) −0.04 / −0.02; lab pause
     −0.10 / −0.05. Rule sums are clipped to ±0.63 / ±0.49 (the real 6-month p90). Noise σ is
     0.35 / 0.25, seeded by (f, s). asi2030 decays first: `1 − (1 − p0)^((2030 − t)/(2030 − t0))`.
     asi2100 is held.
   - *How dangerous* (cat2100): a level, not a ratchet:
     `logit(cat2100) = logit(today) + Σ βᵢ (scoreᵢ − baselineᵢ)`, with β = +0.15 loss of control,
     +0.05 misuse, −0.10 oversight, +0.08 race pressure, clipped to ±0.75. The baseline is the same
     rubric scored on the real last 6 months, so today's world reproduces today's real reading.
   - All β values and nudges are labelled "rule" on screen. A quick event study found the anchors
     too thin to fit them (6–62 trade days in two years).
6. **Read the clock.** The existing engine (`sim.ts` through `reading()`) on the new anchors gives
   this future's 1-in-10 date at this step.
7. **Save** the step and go on. Checkpoint each step to disk, so a crash resumes at the first
   missing step.

Also per step: a "rules off" line (the same seed and noise, zero rule effect) and a "today's odds,
no events" line (decay only). These three lines show how much is events and how much is luck.

## Data shapes

- `WorldEvent` (contracts.ts) gains optional `futureId`, `step`, `actorId`, `postId`,
  `effect: { dlogit, rule }`; `source: 'mirofish'`, `provenance: 'simulated'`. Fix the contract
  comment that says events never move the clock: simulated events now move their future's clock.
- `RecordedFuture` (new, contracts.ts): `{ id, seed, steps: [{ start, end, anchors, rubric,
  summary, expected, events, topPosts, expectedHit, date10, rulesOffDate10, noEventsDate10, runId, cost, wallS }] }`.
- Files: `data/world/futures/<id>.json` (pipeline) and one bundled
  `doomclock/web/public/cache/futures.json` for the browser. The browser reads saved anchors and
  never re-simulates MiroFish.
- `baseline.json`: the rubric on the real last 6 months, with cited real event ids.

## Engine changes

- `simInput`: drop ASI knots at or before the reading year (one line; fixes the post-2030 crash).
- New `engine/step.ts`: decay, nudges, clip, seeded noise, rubric → cat2100. Shared by the recorder
  (Node) and the browser. Tests: same seed gives the same anchors; zero nudges and zero noise is the
  identity; a saved recording is reproduced step by step.
- `buildTimeline(world, pick, sim?)`: with a recorded future, frames 2027Q1–2029Q4 read that
  step's anchors (both quarters of a step share them), provenance `'simulated'`, events from the
  recording. Without one, the output is byte-identical to today (test).
- Remove `frameEvents`' copied incident templates. Future quarters show a count ("about 108 AI
  incidents a quarter at the real rate") plus MiroFish's events only.
- The timeline ends at 2029Q4, with the future's final clock date marked.
- `scale.ts`: on simulated frames the hand reads `frame.clock`; today's reading is the ghost hand.

## UI (YAGNI pass)

Keep: globe (tint, datacentres, pings, zoom); clock (countdown, Bulletin 85 s pin, "why the hand
moved" showing that step's events and rubric changes); play/pause plus scrubber; event reader and
popover; Inputs with the as-of slider; Track record; walkthrough (5 steps) and "Show me around";
newsflash for major real and simulated events.

Cut: Roll / Early / Typical / Late; 1×/2×/4× speed; the Engine knowledge graph, its full screen and
zoom; the full-screen roster; mock "Run live" and the Inputs "Run simulation"; Why's Fan, Date and
Hand tabs; the Map key dialog (replaced by a 4-item inline legend); the timeline after 2029;
shortcuts I, W, R, F; "10,000 futures" copy everywhere; the dead game code (after the freeze, or
never).

Merge:
- One 5-future switcher in both World and Engine ("Future 3 of 5: 1 in 10 by Mar 2031").
- Why sheet, 3 tabs: **When** (the odds, with sources) · **How dangerous** (rubric scores with cited
  events and the 3-line chart) · **Track record**.
- Engine: one panel per step: situation summary, rubric scores, the step's clock, then the posts.
- **Event predictions** table: events grouped by (actor, action) across the 5 futures, share of
  futures before 2028 and before 2030, and the real market beside it where one is pinned.

Walkthrough (5 steps, plain words): the clock and what it counts down to; the real inputs (slide
the date back); press play on a future and watch events land; how dangerous (the situation report
and its scores); the track record.

## Honesty lines (on screen and in the talk)

- Today's clock is the forecast; the five futures are scenarios, not predictions.
- The backtest scores 30-day market calibration only; it says nothing about the loop.
- How much each event moves the odds is our rule. We tried to measure it; the data is too thin.
- About half of each future's difference is luck, shown by the "rules off" line.
- The catastrophe market is thin play money (19 traders).
- Event predictions come from 5 futures, so their odds come in steps of 20%, and none can be scored
  until their dates pass.

## Budget, time and gates

- 30 MiroFish runs ≈ 30–40 min serial, ≈ $1.00; read-outs and reports ≈ $0.20; baseline ≈ $0.01.
  Cap $3.00 for this work, inside the $10 key guard.
- Lanes in parallel: engine (step.ts, buildTimeline, tests), recorder (loop, persona lines,
  read-out, report, no-copy check), UI (YAGNI cuts, switcher, Why tabs, Engine panel, event
  predictions) against a fixture `RecordedFuture`.
- **Gate 03:45 GMT:** one future recorded end to end and its hand moving in the browser. If not,
  fall back to what is on main plus the copy fixes (no copied incidents, no "10,000 futures").
- Recording of the other four futures follows; UI wiring by ~06:00; polish, Devpost and rehearsal
  after.

## Out of scope tonight

Live MiroFish in the demo (task 16); parallel sims; MiroFish's report agent; interviews; mood
feeding back into institutions; cumulative risk along a path (each step re-reads the clock);
deleting the game code before the freeze.

## Amendments after review (25 Oct 02:25 GMT) — this section wins on any conflict

From a five-lens review (HRT judge, feasibility, MiroFish realism, demo UX, consistency), each
serious finding adversarially checked (55 kept, 1 refuted). Decisions taken by the Lead per the
owner's "decide these".

Decisions:
- **Gates:** 03:45 seam gate = `step.ts` + tests + knot filter; `buildTimeline(sim)` moving the hand
  in the browser from `public/cache/futures.fixture.json`; `recorder --dry` renders all 32 personas
  within 3,000 chars with MARKETS NOW present. 05:00 loop gate = future 1 recorded end to end, at
  least one read-out event with nonzero effect in "why the hand moved", and date10 ≠ rulesOffDate10
  on at least one step. Futures 2–5 05:00–05:45; UI wired by 07:00. Recorder LANE_CAP_USD=3.
- **No "capability claim or release" type.** Releases are `other` (zero effect).
- **Expectations:** only the shared WHAT PEOPLE EXPECT NEXT line; no targeted line. Call the metric
  "follow-through", log it, keep it out of the UI.
- **Event predictions table: cut.** Build only if the UI lane is ahead at 07:00, as counts
  ("3 of 5"), never odds, with "step-1 inputs are shared, so agreement is not independent".

Changes:
1. **Before lanes start:** the Lead commits the salvaged recorder (record.ts, data/world/runs/,
   library.json, the EngineScreen diff) and adds board tasks for engine, recorder and UI with file
   scopes. The Lead owns contracts.ts and commits `RecordedFuture`, the `WorldEvent` fields and
   `public/cache/futures.fixture.json` first. Cast changes go in as an in-code override; cast.json
   and cast.golden.csv stay. Fallback = main + copy fixes + salvaged Engine view with any
   "modelled on AIID #…" seed hidden or labelled.
2. **Read-out input:** only posts with round ≥ 1 that are not seeds or carry-overs; drop bare
   reposts and empty posts; for a quote use only the quoter's own text (keep `original_post_id`);
   exclude the Markets desk. Strict json_schema call (as in backtest/llm.ts) with one retry; save
   raw responses to `data/raw/readout/` first; `readoutOk: false` on failure.
3. **No-copy check by identifiers, not word overlap:** reject any event citing an AIID number, any
   real document or EO number from events.json or the cast facts, or a date outside the step
   window. Log every rejection.
4. **Closed event vocabulary:** the read-out returns `actorId`, `type` (one enum: the nudge rows
   plus `soft` and `other`, both zero effect), `binding`, `severity` (minor / moderate / major by
   fixed tests: harm to a government or critical system, or an AI acting outside its operator's
   control, is major), and `where` (ISO3 of the actor or named lab; add iso3 to the cast override).
   Code, not the model, sets `major` and the nudge. Dedupe decisions on (actorId, type, object) and
   incidents on (lab, type, date), keeping all reporter post ids.
5. **Incident source:** tracker (#25) and the 13 institutions at activity 1.0. The tracker's
   persona: post the 1–3 most serious new incidents as `Incident SIM-<yyyy>-<n>: lab · what ·
   severity · date`, never an AIID number; its real AIID dated record is removed. Incidents are
   exempt from the first-person rule; standing for incidents is #25, plus #21 in SIM- format, plus
   any lab disclosing its own. Remove OpenAI's 2026-10-21 paused-training fact with its goal.
   Optional A/B on step 1 with and without the decision line (~$0.08).
6. **Centre the "when" nudges:** nudge = β × (min(count, 3) − realRate), with real rates per 6
   months: lab agentic/cyber major incident 1.7, binding accelerating 3, binding restricting 2, lab
   pause 1. Log simulated count vs realRate per type. Test: counts at the real rate give zero push.
7. **Baseline parity:** baseline.json is built through the same formatter as a step (events.json
   records with asOf − 182 d ≤ ts < asOf, top 3 per type by major then ts, plus one count line
   "about 216 incidents this period"); every step gets the same count line at the real rate. The
   rubric reads event objects only (top posts feed the summary only, never the Markets desk post).
   Written level anchors for 0–3. One sample at temperature 0. Score the baseline 5 times at 0.7
   and report the spread as rubric noise. Parity test: today's real step through the formatter is
   within ±0.5 of the baseline. Keep the ±0.75 clip.
8. **Persona renderer:** MARKETS NOW and WHAT PEOPLE EXPECT NEXT are fixed blocks, never trimmed;
   WORLD holds 6 events of at most 120 chars; trim the dated record before world lines; headers say
   "this period"; remove "strategy game". cast.test: at a step-6 memory every lab and government
   keeps MARKETS NOW and at least 4 events.
9. **Time points:** step s covers [t_{s−1}, t_s), t_0 = 2027-01-01. Decay from the previous step's
   value; stop it just before 2030. Store anchors after each step's events. Quarter 1 of a step
   reads the incoming anchors, quarter 2 the outgoing ones. date10 = reading(anchorsOut, t_s).
   `RecordedFuture` also gets `startAnchors`, `baselineRef`, `rulesVersion`, `unexpected`.
10. **Engine:** remove the copied incident templates; future quarters show a count; rewrite
    timeline.test.ts:155-162 and regenerate the fixture. Keep FRAMES = 45; stop play and the Spine
    at 2029Q4 in App/Hud. With a recording loaded: `timeline.future` has asiDate = catDate = null,
    no Monte Carlo flashes, no Spine ASI/catastrophe marks, no `ended` state, and the ensemble is
    the 5 recorded futures.
11. **UI on simulated frames:** the clock cap reads "Future N of 5 · simulated · 2028 H1" and the
    main line reads frame date10; the countdown ticks only on real frames; today's reading is the
    ghost hand; no Bulletin pin, market links or trader counts on simulated frames. "Why the hand
    moved" shows four rows in months (events · situation report · luck = rulesOff − noEvents ·
    time) and auto-opens ~4 s per new step. Playback: one step per ~5 s tick. One simulated
    newsflash per step (largest effect). Walkthrough step 3 completes when the first step lands.
    The label is GAME RULE. Cut order from the bottom: 1 loader, switcher, hand and Clock branch;
    2 copy and walkthrough; 3 the four-row split; 4 the How dangerous tab; 5 the Engine step panel
    (summary, rubric, top posts only).
12. **Copy:** "Today's clock reads today's market prices only. The rubric adds zero at today by
    construction. The backtest checks those prices 30 days out (Brier 0.085 vs coin 0.25); the
    clock's date is not scored." Pitch: "Today's clock is the market. Inside five MiroFish
    scenarios, simulated events nudge the when and the situation report sets how dangerous, by
    labelled game rules, and you can see how much of each move is events, report, time and luck."
    Replace "about half luck" with the share measured from the recordings. Fix AGENTS.md and
    App.tsx:93 to "nothing moves the real clock".

Judge path (60 s): today's real clock → Inputs, drag the date back → play Future 1 (six steps at
~5 s, pings land, hand moves, the callout splits each move) → click a ping (account, post, effect,
GAME RULE) → Why → Track record.
