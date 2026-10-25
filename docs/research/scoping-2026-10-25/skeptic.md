# Sceptic review: coupled MiroFish + market loop (25 Oct, ~01:20 GMT)

Read-only. Inputs: `design-draft.md` (DD), `miro-check.md` (MC), `engine-check.md` (EC), `data-check.md` (DC),
`.claude/skills/judging-criteria-review/criteria.md`. I spot-checked these: `sim.ts:62-67` throws on knot ≤ startYear;
`App.tsx:93` says "no future moves it"; `contracts.ts:553-556` says events are "never the cause of a clock move";
`AGENTS.md:27` says MiroFish "never moves the clock"; `backtest.json` `design.horizonDays = 30`. The salvage
`record.ts`, `data/world/runs/` (3 files), `library.json` and the EngineScreen diff are **untracked/uncommitted** in
worktree `wf_fa865241-fde-4`, based on 109ae75.

**Verdict: GO with the changes listed below.** The loop is cheap to run (about $1, 30 min, MC §5) and the engine
seam is small (EC §1). The draft as written fails in four places:
1. 8 steps crash the engine after 2030.0.
2. Noise sized from `pRange12m` is the wrong scale.
3. An uncentred rule table ratchets toward doom.
4. The report agent describes the wrong world.

And the pitch must not claim more than the loop does. MiroFish yields about 2 decisions per run, and per-future
spread is about half RNG.

---

## 1. The HRT quant judge, one minute at the table

### What they will misunderstand
- **"So the clock is driven by an LLM society?"** If the headline hand moves with MiroFish, they will think so. It
  must not move. The backtest gave LLM adjustments on top of the market weight **w = 0** (DD:36, EC:178-185).
  MiroFish-derived nudges are the same kind of thing (LLM output on top of market prices), so moving the headline
  with them would contradict our own best evidence. The headline stays `readClock(world)`. Each future gets its
  own hand, labelled SIMULATED.
- **"5 futures = a distribution."** It isn't one. n = 5, coupled paths, unseeded MiroFish (MC:107-109). Never
  average them (EC:186-189). The distribution is the 10k Monte Carlo.
- **"Events move prices" will be heard as "we estimated how events move prices."** We tested this and couldn't.
  2 of 8 permutation tests reach p ≤ 0.05, the signs are mixed, and counts are flat across windows (DC:184-214).
  Say so out loud. It is a point in our favour.

### What they will distrust
- **The rule table is uncalibrated, not fitted.** Replaying the real 2026-04..10 event counts gives asi2030
  −0.07 and cat2100 −0.055. Reality moved +0.49 and +0.24 (DC:210-211, 259). The signs are game logic. That is
  defensible only if every nudge is labelled "rule" on screen (AGENTS rule "Effect sizes") and the talk says it
  can't reproduce history. Do not call it a model of how the world responds.
- **The noise is as large as the signal.** One noise sd on asi2030 is about 10.5 months of clock, about the same
  as a heavy event step (DC:274-275, 338-341). The judge will ask "how much of this is MiroFish and how much is the
  RNG?" Unless we show that split, the honest answer is "about half luck".
- **MiroFish rarely decides anything.** About 2 concrete announcements per run (0–4). About 0.2 hard government
  acts. OpenAI "resumes paused runs" in 3 of 5 runs because its persona says so (MC:19-25, 154-161). Incidents
  are rolled by dice at the real rate and centred (DC:277-279), so their mean push is zero. In practice the clock
  moves from (a) the read-out of a few institution posts, (b) the noise and (c) the time rule. If the pitch says
  "MiroFish drives the forecast", a judge who asks will find that the dice and the RNG do most of it.
- **The most powerful anchor is the thinnest.** cat2100 moves the clock +32 months at −0.5 logit. It is play
  money, 19 traders, 6 trade days in 2 years (DC:305-308). Its noise σ is borrowed from another market. Say that.
- **The time rule beats the events.** Held vs decayed asi2030 shifts the zero-news clock by 1–3 years over the
  window, more than most event steps (EC:155-160, DC:292-303). Holding asi2030 at 0.36 in late 2029 means "36% ASI
  in 10 weeks". A quant will spot that at once.

### What they will call circular
- Prices seed the agents (DD:19-20). The agents' posts become events through an LLM read-out (DD:21-24). The
  events move prices through hand-set rules (DD:25-27). Those prices seed the next step. **Nothing external
  checks the loop.** It measures how the 32 personas react to numbers we feed them, not the world. That is fine
  for an illustration and bad as a forecast. Present it as a *what-if engine on top of the forecast*, not part of
  the forecast.
- "Mood changes how likely institutions are to act" (DD:23-24) adds a second loop, and nothing supports it. The
  interviews are inert: supportShare is 0.621 in all three runs (MC:163-166). No mood metric has been built.

### Is "markets alone" honest?
Only with two fixes:
- **Rename it "Today's prices, no events".** After today there are no markets, only today's prices plus our time
  rule. "Markets alone" suggests a market path we don't have.
- **It isolates events + noise, not events alone** (EC:192-197). With noise ≈ rules, a future that drifts from
  the reference could be pure luck. Add a third line, "same seed, rules off". In a coupled loop that counterfactual
  is open-loop: it reuses the same MiroFish events with zero rule effect, because the events would differ if
  prices had differed. Label it that way. It costs nothing: one extra `stepAnchors` call per step and no extra
  MiroFish runs.

### Leakage, and contradictions with the backtest claim
- **No leakage in the backtest from this loop.** The loop runs forward from today and doesn't touch the backtest
  pool. But it must not be presented as validated by it. The backtest scores **30-day market calibration**
  (`backtest.json design.horizonDays = 30`; DC:334-336). It says nothing about 6-month simulated-event moves.
- **Hindsight in the base rates.** The AIID "major" flag counts press reports as of the 19 Oct 2026 snapshot. Old
  incidents have had longer to collect reports (DC:316-320). Use the Apr 2025–Apr 2026 rate for major incidents
  (~8 per 6 months), or say so. Not fatal, because nothing is scored on it.
- **Wording contradictions in the repo that the judge may see:** `AGENTS.md:27`, `contracts.ts:553-556`,
  `App.tsx:93`. Reword each to "never moves the **real** clock" (EC:184-185, 222-223, 234).
- **Dead game text ships in the tour today.** `TwoLine.tsx:63-65` reads "Your timeline… appears when you play"
  (EC:281-282). Fix it regardless of the loop.

## 2. The delivery lead (01:20 now, freeze 11:30, core by ~06:00, owner asleep)

### Cannot be finished, so cut
- **The report agent** (DD:32). It reads only Zep, our runs never write to Zep, it would describe the 24 Oct spike's
  world, it takes 243 s each, and it invented a "Kalshi reported 38% → 61%" move (MC:26-31, 191-219). Replace it
  with one OpenRouter summary per future over saved events and our own price path, every number quoted.
- **Mood → institution likelihood** (DD:23-24): unbuilt, and the interviews are inert. Show mood as a stat only.
- **8 steps** (DD:5): they crash at 2030 (EC:15-19). Use 6 × 6 months, 2027Q1–2029Q4 (EC:149-151).
- **Parallel sims:** untested, and OpenRouter load is untested (MC:221-244). Serial takes ~30 min, which fits.
- **Interviews and the 15 s sleep** (MC:308-309).
- **Cumulative pCat along a simulated path** (EC:167-171). Keep `frame.pCat` labelled "of 10,000 futures from
  today's markets".
- **Game-layer deletion** (−2,500 lines, EC:263-271): after the freeze, or never.
- **Rendering 109 incidents per quarter on the globe:** sort simulated and major events first before the 10-cap
  (EC:231) and leave it there.

### Critical path (EC:308-309)
`#1` knot filter → `#5` contracts (`RecordedFuture`, 5 WorldEvent fields) → `#11` `step.ts` + test → `#14`
recorder rework (5 futures × 6 steps, read-out, persona lines) → **warm-up + 1-future smoke** → **record 5
futures (30 runs, ~30 min serial, checkpointed, MC:305-306)** → `#12` `buildTimeline(world, pick, sim?)` →
`#2` hand reads `frame.clock` (`scale.ts:41`) → `#9` App wiring.

Recording is the long pole. It is serial within a future, because step k+1 needs step k's prices, and it can't
start until the recorder and `step.ts` are done. `#12`/`#2`/`#9` and all the labels can run in parallel against a
fixture `RecordedFuture`.

### Plan

| GMT | Lane A: engine | Lane B: recorder | Lane C: UI |
|---|---|---|---|
| 01:20–01:45 | Lead: commit salvage, add task to board, fix the `RecordedFuture` type (the seam), choose the time rule (default: decay) | | |
| 01:45–03:15 | knot filter, `step.ts` (centred rules, clip, empirical σ, decay) + tests, `buildTimeline(sim?)` + tests | 5 × 6 loop, read-out call + parser (bad JSON → no events), MARKETS NOW/incidents/decisions in `user_char` | wording fixes, TwoLine rename, scale.ts hand, globe sort, EventPop `effect` + "rule", simulated newsflash, against a fixture |
| 03:15–03:45 | integrate | warm-up run + 1 future × 6 steps (~6 min) | |
| **03:45 gate** | One future recorded end to end, and the browser shows its hand moving. If not, take the fallback. | | |
| 03:45–04:45 | | record the other 4 futures (~25 min + read-outs) | Engine view: salvaged diff, keyed by futureId/step |
| 04:45–06:00 | wire library into App, verify in browser, fix | per-future summaries (1 call each) | |
| 06:00–11:30 | polish, owner review on waking, Devpost (workshop 09:00), rehearsal ×2, freeze 11:30 | | |

**Fallback at 03:45:** one-way seeding. Prices go into MiroFish, events don't move prices, and MiroFish stays
illustrative, which is what `AGENTS.md` says today. Use the existing 3 recorded quarters plus whatever was
recorded. The app on main already demos the real clock, the 10k MC and the backtest walkthrough. Keep
`buildTimeline` byte-identical when `sim` is absent (EC:126-128), so the fallback costs nothing.

**Decisions waiting on the owner,** which the Lead should take as reviewable defaults:
- Time rule: decay, labelled "rule" (EC:159-160).
- Futures identified by seeds 1–5, not MC percentiles (EC:318-320).
- New wording for `AGENTS.md:27`.

---

## 3. Ranked changes (at most 10)

1. **Headline clock stays `readClock(world)`; coupled futures move only their own SIMULATED hands.** Reword
   `AGENTS.md:27`, `contracts.ts:553-556`, `App.tsx:93` to "the real clock".
   - *Why:* otherwise we contradict our own backtest (w = 0, EC:178-185), and it is the judge's first question.
   - *Cost:* ~15 min, text only.
2. **Commit the salvage first** (`record.ts`, `data/world/runs/`, `library.json`, the EngineScreen diff) and add
   or update the coupled-loop task on `.taskmaster/tasks/tasks.json` (AGENTS: every change follows a task).
   - *Why:* it is untracked in a worktree that can be cleaned up, and it is the base for the critical path.
   - *Cost:* 10 min.
3. **6 steps × 6 months (2027Q1–2029Q4) + knot filter + asi2030 constant-hazard decay, labelled rule.**
   - *Why:* 8 steps throw at 2030 (`sim.ts:62-67`). A held asi2030 implies 36% ASI in 10 weeks (DC:292-303).
   - *Cost:* 1 line + ~15 lines in `step.ts`, and it saves 10 runs.
4. **Use DC §5's centred rule table**, only on asi2030/asi2040/cat2100 (no asi2100, which is sign-inverting,
   DC:179-182). Clip the rule sum to ±p90, cap 3 events per type per step, and replace DD:25-26's
   `pRange12m` noise with empirical σ (0.35 / 0.25 / 0.10 / 0.15).
   - *Why:* uncentred nudges move the clock ~10 months earlier every step at normal event rates (DC:225-229).
     `pRange12m` is a 12-month min–max, the wrong scale (DC:157-160).
   - *Cost:* inside `step.ts`, ~30 min with tests.
5. **Three lines per future: "This future", "Same seed, rules off" (open-loop, labelled) and "Today's prices,
   no events" (renamed from "markets alone").** Log simulated event rates against `realRate` per type.
   - *Why:* noise ≈ rules (DC:338-341). Without the split the judge can't tell MiroFish from luck, and the
     "markets alone" name overclaims.
   - *Cost:* 1 extra `stepAnchors` per step, plus the unused `yours` hand and TwoLine slot (EC:198-199); ~30 min.
6. **Cut the report agent, interviews, mood coupling, parallel sims and the 15 s sleep.** Replace the report
   with one OpenRouter summary per future that quotes our own numbers.
   - *Why:* wrong world, hallucinated "Kalshi" move, inert interviews, unbuilt coupling (MC:26-31, 163-166).
   - *Cost:* saves ~20 min of runtime and ~1 h of build.
7. **Harden the read-out:**
   - count only first-person, dated commitments by the account whose `cast.json` `powers` allow it;
   - dedupe (actor, action) across steps;
   - fill `Memory.decisions` (REC never does, MC:86-87);
   - remove or neutralise OpenAI's "resume paused runs" goal;
   - add MARKETS NOW + incidents lines to WORLD SO FAR and check `user_char` stays under 3,000 chars;
   - bad JSON → zero events.
   - *Why:* a 2-post feed (MC:57-68), ~2 decisions per run, persona noise (MC:158-161).
   - *Cost:* ~1 h inside the recorder lane. Skip the $0.08 NOTICES A/B unless lane B is ahead.
8. **Hard gate at 03:45: one full future recorded and visible, or fall back to one-way seeding.**
   - *Why:* recording is serial, the long pole, and unrehearsed. With the owner asleep, nobody else will call
     the cut.
   - *Cost:* none. It is discipline.
9. **Minimum UI to make the loop visible:**
   - `scale.ts:41` reads `frame.clock` on simulated frames;
   - globe sorts simulated and major events before `slice(0,10)` (`Globe.tsx:164`);
   - TwoLine "Your timeline" rename (dead game text ships today);
   - EventPop shows `effect` with a "rule" label;
   - simulated newsflash branch (`App.tsx:91`).
   - *Why:* without these the per-future hand never moves on screen (EC:104-106).
   - *Cost:* ~1 h, in parallel against a fixture.
10. **Honesty lines for the talk and Devpost:**
    - the backtest scores 30-day market calibration only, and nothing about the loop;
    - we tried an event study and the anchors are too thin (6–62 trade days in 2 years), so the rules are game
      rules;
    - the rule table can't reproduce the real 2026 half-year;
    - roughly half of each future's spread is luck, shown by the rules-off line;
    - cat2100 is thin play money.
    - *Why:* each line answers a likely HRT objection before the judge raises it (DC §6).
    - *Cost:* 15 min.

**One-line pitch that survives the judge:** "The clock is the market. Our backtest says an LLM adds nothing to it,
so no LLM moves it. MiroFish plays out five futures on top of it. Inside each one, simulated events nudge
simulated prices by labelled rules, and we show how much of each future is events and how much is luck."
