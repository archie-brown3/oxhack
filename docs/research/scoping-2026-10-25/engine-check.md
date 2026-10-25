# Engine seam check: coupled MiroFish + market loop

Read-only scoping, 25 Oct. I made no repo edits, no paid calls and no MiroFish calls. Numbers come from
running the engine in Node (v26.11.1) against `doomclock/web/public/cache/world.json`, which is
the same World the browser loads (`app/data.ts:19`). The probe scripts are in the session scratchpad,
not in the repo.

## TL;DR

1. **Price nudges need no change to sim.ts.** A future's state is just 4 anchor probabilities.
   One step is `logit(p) + Σ rule dlogits + noise`, converted back to p, then the existing
   `simInput` → `p10Year` / `analyticCdf`. sim.ts is pure and has no dependencies. The recorder
   already imports the engine from Node (`record.ts:15`). Costs: 10k paths take 1.2 ms, one exact
   date10 takes 0.005 ms, and a full `buildTimeline` takes 9 ms.
2. **Blocker: the 2030 knot.** `asiKnots` throws once `startYear >= 2030` (`sim.ts:64`). With
   6-month steps from 2027-01-01, steps 7 and 8 start on 2030-01-01 and 2030-07-01, so they crash.
   Dropping the resolved knot is a one-line fix. But holding the asi2030 price until then makes
   date10 jump **+3.3 years** at the boundary (2033.24 → 2036.54). Pick one of these, or a rule that
   decays asi2030 (see §2.3).
3. **The headline clock should stay `readClock(world)`**, the real markets. Don't pool the 5 coupled
   futures into it. The backtest chose `w = 0` for LLM adjustments, and MiroFish-derived nudges are
   rule-table effects. Each future gets its own SIMULATED hand. "Markets alone" is that hand with
   the same time rule and no event nudges (§3).
4. **WorldEvent needs 5 optional fields.** The globe, ticker and popover already render
   `provenance: 'simulated'`. Two gaps: the globe draws only the first 10 events of each quarter,
   by ts, among about 109 projected incidents. Newsflashes fire only for real events (§4).
5. **The game layer is dead code on main.** The app bundle doesn't import it (`App.tsx:1-18`). Keep
   `game/cast.ts` and `game/data/cast.json`; the recorder needs them. The rest can go after the
   loop works (§5).

---

## 1. Per-step price nudges: the smallest entry point

### What exists

- `SimInput` (`sim.ts:12-18`) has 3 ASI knots and `pCat2100`. `timeline.ts:103-114` (`simInput`)
  maps `Record<NodeId, Prob>` to it, with knots at 2030, 2040 and 2100. Every reading in the engine
  goes through `reading(a, at, L, ranges)` (`timeline.ts:134`), which takes **anchors plus a
  reading time**. That is the whole state a step needs.
- `withDlogits` (`sim.ts:263-270`, task 107) shifts only `asi[0]` (asi2030) and `pCat2100`. That's
  too narrow for per-anchor nudges, and it is labelled "your timeline only".
- `state.json` nodes carry `dlogit` (all 0, `w = 0`), `pMarket`, `p`, `pRange12m` and `nPrices`
  (`contracts.ts:149-171`). Today: asi2030 0.3608, asi2040 0.75, asi2100 0.8635, cat2100 0.297.

### Least change

Add one small pure module, `engine/step.ts`, that both Node and the browser import:

```ts
// anchors after one step: logit + rule nudges + seeded noise, then back to p
export function stepAnchors(a: Record<NodeId, Prob>, nudges: Partial<Record<NodeId, Dlogit>>[],
  sd: Record<NodeId, number>, rand: () => number): Record<NodeId, Prob>
```

- Work in logit space so p never reaches 0 or 1. `isProb` stays happy (`sim.ts:231`).
  Non-monotone results (for example asi2030 > asi2040) are pooled by `monotonise`, not rejected
  (`sim.ts:70-75`), so a large nudge cannot crash the clock.
- Gaussian noise from `mulberry32` (`rng.ts`) via Box-Muller, seeded by `hash(futureId, step)`.
  `game/paths.ts:19-28` has `hash32`/`rngFor` for this; move it rather than rewrite it.
- **Noise size from `pRange12m`.** The logit widths of the 12-month ranges are: asi2030 0.889,
  asi2040 0.908, asi2100 0.353, cat2100 0.240. If a range is about ±2σ over 12 months, the
  per-6-month σ is width/4/√2: **0.157, 0.161, 0.062, 0.042**. Caveat: cat2100's range comes from
  only 7 prices and asi2100's from 22 (`nPrices`), so those two are thin.
- **How much a nudge moves date10** (today, one anchor moved alone, ±0.5 logit):

  | anchor | −0.5 | +0.5 |
  |---|---|---|
  | asi2030 | +16.3 mo | −14.2 mo |
  | asi2040 | +2.0 mo | −1.2 mo |
  | asi2100 | −5.1 mo | +3.7 mo |
  | cat2100 | +32.3 mo | −16.4 mo |

  cat2100 and asi2030 drive the clock. A rule table that mostly nudges asi2040 will look like
  nothing happened. With noise alone, the typical move per step is about ±4.6 months from asi2030
  and ±1.4 months from cat2100. Rule nudges need |dlogit| ≥ 0.3 on those two anchors to show above
  the noise.

### Node (recorder) and browser

- **Node: yes, already proven.** `record.ts:15` imports `buildTimeline, PICKS` from
  `web/src/engine/index.ts` and runs under plain `node` (Node 26 strips types). My probe imported
  `sim.ts`/`index.ts` the same way.
- **Browser: yes.** The browser already runs a 10k Monte Carlo per pick (`App.tsx:42`), plus
  5 more for the ensemble (`App.tsx:69`, 29 ms for 5 timelines).
- **Recommendation:** the recorder computes the prices, because step k+1's MiroFish seed depends on
  step k's prices. It writes `anchors` for every step into the recording. The browser reads the
  saved anchors and does not recompute them. MiroFish is unseeded (`record.ts:232`, `mirofishRng:
  "unseeded"`), so the recording is the source of truth: a re-run gives a different future. Add a
  test that `stepAnchors(saved anchors[k], saved events[k].effect, sd, rng(seed, k))` reproduces
  `anchors[k+1]`. That keeps the browser's rule-table display honest without a second code path.

## 2. Mapping 8 six-month steps onto quarterly frames

### What exists

- There are 45 frames, 2024Q4 to 2035Q4 (`timeline.ts:32, 276-281`). Real frames run up to 2026Q4;
  the first projected frame is **2027Q1** (start 2027-01-01). Real frames read `quarterSnap` from
  `anchorHistory[id].history` (`timeline.ts:178-199`). Projected frames reuse **today's** snap, so
  their date10 never changes and only the minutes shrink (`timeline.ts:73-82`). Test
  `timeline.test.ts:164` pins this behaviour.
- Drivers come from `explain(prev, cur)` with leave-one-out per anchor (`timeline.ts:219-243`). They
  work for any pair of snaps, including simulated ones.
- **The hand ignores `frame.clock` on projected frames.** `scale.ts:41` uses
  `timeline.clock.date10` (today's). A simulated per-step clock will not show on the face until
  this changes.

### Proposed mapping

- **Align steps to half-years:** step s covers frames `first + 2(s−1)` and `first + 2(s−1) + 1`.
  Step 1 is 2027Q1–Q2, step 8 is 2030Q3–Q4, and the window ends on 2031-01-01. The gap from
  2026-10-24 to 2027-01-01 stays in today's real frame.
- **Prices:** both quarters of step s read the anchors in force at the step's start (that is, after
  step s−1's events; step 1 uses today's real prices). Read the clock at each quarter's own start:
  `reading(stepAnchors, msToYear(q.start), L, todayRanges(world))`. This is already a re-read, so
  it includes the "time passes" shift (`timeDays`).
  - In the first quarter of a step, `explain()` lists the anchors that moved, with from and to
    values.
  - In the second quarter, `drivers` is empty and only time moves.
  - Don't interpolate the middle quarter. It would invent a price.
- **Events:** each event's `ts` falls inside its step. `frameOf(ts)` (`timeline.ts:284`) puts it in
  the right quarter. The recorder already dates gov measures 5–25 days into the period
  (`record.ts:86`).
- **Provenance:** set the frames inside the window to `'simulated'`. The type already allows it
  (`contracts.ts:550`).
- **Signature:** `buildTimeline(world, pick, sim?: RecordedFuture)`. With `sim` absent, the output
  is unchanged and every existing test passes. With `sim`, the projected branch at
  `timeline.ts:73-75` looks up the step for each quarter. About 35 changed lines.

### 2.3 The 2030 knot (blocker)

`asiKnots` requires each knot year to be greater than `startYear` (`sim.ts:63-66`). The probe, with
anchors held at today's prices:

| step start | date10 | lead |
|---|---|---|
| 2026.81 (today) | 2032.41 | 5.60 y |
| 2027.81 | 2032.67 | 4.86 y |
| 2028.81 | 2032.94 | 4.13 y |
| 2029.81 | 2033.24 | 3.42 y |
| 2030.31 | **throws** | – |

The fix is to drop resolved knots in `simInput`: `.filter(k => k.year > startYear)`, one line.
That alone exposes a cliff. At 2029.81 a held asi2030 = 0.36 means "36% chance of ASI in the next
10 weeks". When the knot drops at 2030.0, date10 jumps from 2033.24 to **2036.54**.

Options:

- **(a) 6 steps (2027Q1 to 2029Q4) plus the filter.** No visible cliff. 30 runs ≈ 30 min ≈ $1.30.
  After the window, frames hold the final date10 (the existing projected rule), so the cliff never
  shows.
- **(b) 8 steps plus an asi2030 time-decay rule.** Before the nudges, apply
  `p ← 1 − (1 − p0)^((2030 − t)/(2030 − t0))`, which is a constant hazard. It is smooth through
  2030 (2036.33 → 2036.54). It is a rule, so label it.
- **This rule decides which way the clock drifts when nothing happens.**
  - With decay, the markets-alone date10 moves *away* from midnight: the lead goes 5.60 → 5.66 →
    5.85 → 6.05 → 6.23 → 6.38 → 6.48 → 6.54 y.
  - Held, it moves *toward* midnight: 5.60 → 3.42 y.
  - That drift (±1–3 years over the window) is larger than most single-step nudges. Archie or the
    Lead must decide this, not a Worker.

### After the last step

- Frames past the window should use the current projected rule: hold the final anchors and final
  date10, count the minutes down, and add AIID-rate projected incidents (`frameEvents`,
  `timeline.ts:305-338`).
- `frame.pCat` today is `analyticCdf(today's input, quarter end)` (`timeline.ts:90`). It is the
  10k-futures share and ignores the future's events. Leave it as it is and label it "of 10,000
  futures from today's markets". A cumulative pCat along a changing price path would need a survival
  chain (1 − Π(1 − h_s)) that ignores the lag carry-over from earlier ASI, which is an approximation
  I wouldn't ship tonight.
- For the remainder's sampled path (Spine asi/cat marks, `Hud.tsx:60-90`), run
  `simPaths(finalInput, seed 1)` and pick `{seed: futureId}` with the existing `choose`
  (`timeline.ts:248`).

## 3. The headline clock across 5 futures plus 10,000 draws

- **Headline = `readClock(world)`, unchanged:** 1 in 10 by **2032-05-31**, 5.60 min, 85 s, range
  2030-02-19 to 2043-09-26, pCat2100 0.295. This is what the backtest backs: market Brier 0.085 vs
  coin 0.250, with LLM weight `w = 0`.
  - The coupled futures move prices through an LLM read-out of LLM agents' posts and a rule table.
  - The backtest measured exactly this kind of adjustment (LLM on top of the market) and gave it
    weight 0.
  - So putting it into the headline would contradict our own result. AGENTS.md also still says
    MiroFish "never moves the clock". Reword that to "never moves the real clock" if the design lands.
- **Don't average the 5.** They are not a random sample. The current ensemble is picked by
  percentile `[0.05, 0.1, 0.25, 0.5, 0.9]` of the old Monte Carlo paths (`App.tsx:69`), so any
  mean would need arbitrary weights. With n = 5, a mean is noise. If a summary is wanted, show
  "5 simulated futures: 1 in 10 between X and Y at step k", labelled SIMULATED.
- **Per future, per step:** that future's date10 is the hand when you watch it, labelled
  SIMULATED. Each move breaks down as rule nudges + noise + time, all saved by the recorder.
- **The honest "markets alone" reference.** The same future's clock with the same time rule (held
  or decay, §2.3), no event nudges and no noise: `reading(today's anchors [decayed], t_k)`. It is
  deterministic and identical for all 5 futures, so "this future vs markets alone" isolates
  events + noise.
  - Offer "noise only, same seed" as a second line only if the Engine view wants to separate noise
    from events. Otherwise the recorder's per-event `effect` already gives that split.
  - Draw the reference as the face's second hand. `face.ts:22,54` has an unused `yours` option,
    and `TwoLine.tsx` has a dashed "yours" line slot.
- **The 10,000 draws** stay as the forecast (the fan and `frame.pCat`). After the window,
  `simPaths(final anchors)` gives each future's 10k continuation. It costs 1.2 ms per call.

## 4. WorldEvent fields and where events are rendered

### Add (all optional, so real and engine events are unchanged; `contracts.ts:557-575`)

```ts
futureId?: number      // 1..5
step?: number          // 1-based step in that future
actorId?: number       // cast.json accounts[].id (= MiroFish agent/user id, record.ts:90 uses uid)
postId?: number        // MiroFish post_id in that step's twitter_simulation.db (record.ts:119)
effect?: { dlogit: Partial<Record<NodeId, Dlogit>>; rule: string }   // same shape as PersonaNudge maps (contracts.ts:139)
```

- Use `source: 'mirofish'` (already in the source list, `contracts.ts:562`) and
  `provenance: 'simulated'`.
- Lab acts (a pause, withholding a model) don't fit `kind`'s four values. Use `'news'` with
  `who` set to the lab: the globe falls back to `'news'` for unknown kinds (`Globe.tsx:152`).
  Only add `'lab'` if the Map key gets an entry for it.
- `cast.json` already lists `powers` per account (for example `cast.json:138`: "Issue executive
  orders…"). The read-out can check "posted by the account with the power" against it.
- **Rewrite the contract comment at `contracts.ts:553-556`** ("Events are CONTEXT… never the cause
  of a clock move"). For simulated events with `effect`, it is now false.

### Where events render, and the gaps

| place | file:line | status |
|---|---|---|
| Ticker | `Hud.tsx:39-56` | Works: `labelOf('simulated')`, major-first. Add an `effect` line. |
| Event popover | `Hud.tsx:120-135` | Works: already says "Simulated by MiroFish." (`:133`). The avatar comes from `who` via aliases (`:14`); `actorId` would be more exact. Show `effect` with a game-rule label. |
| Globe bubbles | `Globe.tsx:150-166` | Dashed "sim" style works. **Gap:** `events.slice(0, 10)` by ts (`:164`) among about 109 engine incidents per quarter (probe: 111, 108, 103), so MiroFish events get cut. Sort simulated and major events first (in `App.tsx:84` or here, 1 line). The recorder could also drop the engine's Poisson for window quarters, since it rolls incidents itself (draft step 2). |
| Newsflash | `App.tsx:91` | **Gap:** only `provenance === 'real'`. Add a simulated major branch. |
| "Why the hand moved" | `Clock.tsx:101-104,135` | **Gap:** context is real-only, and the panel says "Only market prices move the hand". It needs simulated wording plus the event effects. |
| Today flash | `App.tsx:93` | **Wrong under the new design:** "no future moves it". Reword it to say the real clock. |
| Engine view | `EngineScreen.tsx:7,18` | Still reads `spike.fixture.json`. The salvage worktree has an uncommitted diff (+85/−62) to read `library.json`. Main hasn't touched EngineScreen since the salvage base (109ae75, 6 commits behind), so the diff applies cleanly. |

## 5. Game-layer code on main: reuse vs delete

The app doesn't import `src/game/` (`App.tsx` imports nothing from it). References outside it:

- the type re-export at `contracts.ts:374`;
- `fixtures/game.ts` and `fixtures/cards.ts`;
- the pipeline scripts `derive/hazards.ts`, `derive/incident-rates.ts` and `derive/weights.ts`,
  which write into `game/data/`, plus `fetch/assert-p2.ts` and `world/cast-weights.ts`, which read
  `cast.json`;
- `npm test` runs `node --test src/game/` (`web/package.json` scripts).

**Keep (the recorder needs these):**

- `game/cast.ts` (105 lines, no imports; it provides `agentConfigs`, `profilesCsv`, `TIME_CONFIG`
  and `MAX_ROUNDS`, used at `record.ts:16`);
- `game/data/cast.json` (32 accounts, with `powers`);
- `cast.test.ts` and `cast.golden.csv`, and the cast schema. Consider moving these to
  `src/society/`, but that is optional and touches 4 importers.

**Reuse:**

- `paths.ts` `hash32`/`rngFor` (28 lines) for step seeds;
- `rules.ts:104` `ALARM_LEXICON` for the mood metric;
- `data/events.json` `background`: re-dated, organisation-only AIID templates, a better incident
  source than `record.ts`'s regex filter (`record.ts:51-58`).

**Delete once the loop works:**

- `balance`, `cards`, `events`, `guardian`, `line` (task 107's real and your line), `recommend`,
  `reducer`, `rogue`, `rules`, `schema`, `types`, `index`, and their tests: about 1,900 lines of TS;
- `data/cards.json`, `hazards.json` and `incident-rates.json`, and the two derive scripts;
- in contracts: `GameState`, `CardsFile` and related types (`contracts.ts:291-424`), and
  `fixtures/game.ts` and `cards.ts`.

None of this blocks the loop. Do it as a separate commit, or leave it if time is short.

**Task 107 in sim.ts** (`sim.ts:235-270`, +37 lines since 109ae75):

- `p10Year` duplicates `timeline.ts:118-129` `year10` exactly. Keep `p10Year` and make timeline
  call it (−12 lines).
- Delete `withDlogits`/`LineDlogits`, which only `game/line.ts` uses; `step.ts` replaces them.

**UI "your timeline" slot:**

- `TwoLine.tsx:63-65` shows "Your timeline … appears when you play". It is visible in the tour,
  where `tourSteps.tsx:47` passes `yours={null}`, so **dead game text ships in the demo today.**
- Rename the slot to "This future (simulated)", or "Markets alone" as the dashed reference, and
  pass a line. About 4 lines.
- `face.ts:22,54` `yours` hand is unused; reuse it for the reference hand.
- `Timeline.line: 'real' | 'yours'` (`contracts.ts:674`): add `'simulated'`, or drop the field.

## 6. Change list, smallest first (rough lines)

| # | file | change | ~lines |
|---|---|---|---|
| 1 | `engine/timeline.ts` `simInput` | drop knots with year ≤ startYear (§2.3) | 1 |
| 2 | `ui/clock/scale.ts:41` | simulated frames read `frame.clock` for the hand and range | 3 |
| 3 | `app/App.tsx:93` | Today flash: "no future moves the real clock" | 1 |
| 4 | `ui/world/Globe.tsx:164` or `App.tsx:84` | sort simulated and major events before the 10-cap | 1–2 |
| 5 | `contracts.ts` | 5 WorldEvent fields, comment fix (553-556), `RecordedFuture` type, `line` adds `'simulated'` | 25 |
| 6 | `ui/chart/TwoLine.tsx`, `app/tourSteps.tsx:47` | rename the "Your timeline" slot, feed the reference line | 6 |
| 7 | `ui/clock/Clock.tsx:65,101-104,135` | SIMULATED label, simulated context events with effect, reworded caption | 10 |
| 8 | `ui/world/Hud.tsx` EventPop | show `effect` (rule, dlogit per anchor) with a game-rule label | 8 |
| 9 | `app/App.tsx:69,91,42` | ensemble from the recorded library (5 futures), simulated newsflash, pass `sim` to `buildTimeline` | 15 |
| 10 | `engine/sim.ts:235-270` | remove `withDlogits`/`LineDlogits`; timeline uses `p10Year` | −25 |
| 11 | `engine/step.ts` + test (new) | `stepAnchors` (logit + nudges + seeded noise), optional asi2030 decay, RULES table labelled rule; test: same seed gives the same anchors, a zero nudge with sd 0 is the identity, and the recording is reproduced | 50 + 40 |
| 12 | `engine/timeline.ts` + test | `buildTimeline(world, pick, sim?)`: step snaps per quarter, `'simulated'` provenance, merge `sim.events`, post-window path from final anchors; tests: absent `sim` gives byte-identical output, a step's first quarter has drivers, the second has only time | 35 + 50 |
| 13 | `ui/engine/EngineScreen.tsx` | apply the salvaged diff (library.json), keyed by futureId and step | +85/−62 (exists) |
| 14 | `pipeline/world/record.ts` (salvage) | change the loop from 3 picks × 4 chosen quarters to 5 futures × N steps: prices in → seed posts (Markets desk uid 26, `record.ts:109`); read-out LLM call → events with `effect`; `stepAnchors` → next step; save anchors and events per step; assemble writes `RecordedFuture` per future | ~120 changed of 347 |
| 15 | delete the game layer (§5) | separate commit, optional | −2,500 |

**Critical path:** #1, #5, #11, #12 and #14 are needed for recording to start. #2 and #9 are needed
for the clock to show the per-future hand. The rest is labels and polish.

## Things I could not confirm

- The cost and timing of the read-out LLM call. I made no calls. The salvaged run used $0.029 and
  38 s per MiroFish run (`early-2027Q1.json`: 62 posts, 29/25 interview parses, mean alarm 6.21,
  support share 0.62).
- Whether MiroFish's backend on :5001 is healthy. Not checked, because it wasn't needed for this
  question.
- How the 5 futures should be identified. I recommend seeds 1–5, not old Monte Carlo percentiles:
  the 0.05 path's catDate is 2030-01-15, inside the window, and coupled futures don't follow
  Monte Carlo paths. This is a design call.
