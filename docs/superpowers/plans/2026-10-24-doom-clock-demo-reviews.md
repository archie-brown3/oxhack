# Demo reviews of the game plan (24 Oct 2026)

Inputs for phase 2 (the game). The plan was not rewritten: the owner chose to build the clock simulation first.

## judging-criteria-review

**Sitrep**
- Exists: `sim.ts` with tests, 250,795 timestamped rows (`data/clean/`), the Twitter-only patch (aa1321a) and spikes S1–S4. The UI is a placeholder (`doomclock/web/src/app/App.tsx:2`). There is no reducer, cast or cards yet.
- 16.3 h left (`date` says 19:43 UTC), about 15.3 h after the workshop. The kill gate at 22:30 is 2.8 h away.
- Biggest risk: the analog clock centrepiece has no task on the board (plan.md:553-579), but the 49 recorded nodes do (plan.md:484).

**HRT**
| Criterion | Evidence | Gap |
|---|---|---|
| Baseline beaten out of sample | none; `priceAt` not built (verdict.md:37) | backtest scores the markets, not our work (plan.md:534) |
| Calibrated probabilities | whole-year `p10Year` only (sim.ts:39) | Mapping A fixes the real hand at 85 s. The lag moves the date from Jan 2031 to Oct 2037, and the clock never shows it (plan.md:323) |
| Decision with cost | card price −log₂p (plan.md:261) | effects are game rules (plan.md:248) |
| Data care | `data/clean/` | AIID `ts` fix pending (plan.md:437); CLAUDE.md:8 still cites HN |

**Delta**
| Criterion | Wt | Evidence | Gap |
|---|---|---|---|
| Speed | 30% | ≤2 s/turn target (plan.md:65) | not built; 6 s ticker every turn (plan.md:135) |
| Tech | 25% | `sim.test.ts`, `patches/` | no game code |
| Innovation | 25% | two-hand clock, simulated X | not built |
| Polish | 20% | none | recorded replay; live play is the first cut (plan.md:16,507) |

**Devil's advocate**
1. "Your real hand reads 85 s by construction, and the Bulletin's 85 s is about nuclear risk" (`doomsday_clock.jsonl:3`). Fix: 1 s = 1 month to the 1-in-10 date (about 74 s today). Show the Bulletin's 85 s as a ghost tick and the lag range as a shaded arc. 1.5 h.
2. "Did my card change the simulation, or just pick a recording?" In S3b nothing shifted, and 0 of 29 answers mentioned the caps (spikes:18). Fix: run T7 before 22:30 and show the effect and p beside the card. If it fails, say "the society narrates, the rules decide". 1 h, about $0.50.
3. "I can't follow it." The judge meets bits, Trust, Oversight, Alarm, 13 chips and 7 labels (plan.md:18,57-60,331-335). Fix: show only the clock, 3 cards, the X feed and the news, with 3 labels. Everything else goes on the end screen. Saves about 2 h.

**PM call**
- Next: build the two-hand clock and its "how it's calculated" strip on `sim.ts`. The owner confirms the mapping (5 min).
- Cut now: shrink the depth-2 tree to the canonical path plus one-turn alternatives (plan.md:510), and drop the globe.
- If time runs short: cut the full backtest to the T8 pilot.

Files:
- plan.md: /private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/wf1/plan.md
- verdict.md: /private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/wf1/verdict.md
- spikes: /Users/archiebrown/dev/oxhack/docs/research/spikes-2026-10-24.md

## 5-minute-judge

**Verdict:** the plan as written fails the 30-second test. With the clock moved to the first screen and about 20 of the plan's 25 concepts hidden, it passes. Today the evidence of prediction quality is fixture data only, and the backtest it relies on scores the wrong thing.

## Minute by minute, as written (plan.md:55-61, plus owner decisions)

- **0:00–0:30:** a blocking prologue of real AIID incidents, "about 30 s, no interaction" (plan.md:426). Then a headline date, a two-line chart and a "Kalshi 39%… clock's pace" bar (plan.md:57). No analog clock appears anywhere in §1. The Bulletin clock only shows up as a data point and a ticker item (plan.md:390, 424, 441).
- **0:30–1:30:** the turn screen. It shows a face-down "?", 3 cards with market, price, traders and bits, a month ticker, 6–8 posts, 13 decision chips, Support, Alarm, "+N months" and tells (plan.md:58-59). I am reading badges, not playing.
- **1:30–2:30:** Fast-forward, then an end screen with Rogue cards, footholds, "months bought per bit" and both lines (plan.md:60).
- **2:30+:** the Track record tab (plan.md:61). If I get that far, I find numbers that have nothing to do with the clock (see section 3).

## 1. At 30 s: what is it, and why TIME?

**As written: no.** The prologue uses up the 30 s, so I would describe it as "an AI incident ticker". There are also three different "clocks":
- the Doomsday Clock;
- the game calendar (quarters and months, plan.md:85, 93);
- the "market-paced clock" (plan.md:57, 296-300).

**With the clock first: yes.** "Seconds to midnight = time until the world reaches a 1-in-10 chance of AI catastrophe. Play cards against a hidden rogue AI to buy seconds."

Three issues with mapping A:
- **The 85 s is set by us, not measured.** The real hand reads 85 s by construction. One line has to say so: "today's real forecast (Dec 2032) is set to the Bulletin's 85 s; 1 s ≈ 26 days". The arithmetic is 2026-10-24 → Dec 2032 ≈ 2,246 days ÷ 85.
- **At true scale the hand barely moves.** A minute hand turns 6° per minute, so 85 s is 8.5° and a 6-month gain (about 7 s) is 0.7°. Nobody will see that. The face needs to be magnified (for example, the last 3 minutes fill the quarter-face), with a digital readout under each hand.
- **The 3-year lag behind the 1-in-10 date is an assumption.** It is "a default, not market-backed" (sim.ts:16). At a fixed 26 days per second, lag 1 → Jan 2031 is about 58 s and lag 10 → Oct 2037 is about 152 s (plan.md:323). A data scientist will ask about this.

## 2. Every concept a judge must learn

**KEEP**
- The clock: seconds = time until the 1-in-10 date (plan.md:15).
- Two hands: the real forecast never moves; yours does (plan.md:318-322).
- Cards: you propose, simulated institutions decide (plan.md:264-272, 336).
- The Rogue: a hidden opponent that moves first and is revealed at the end (plan.md:349-358).
- Labels, cut to 3: REAL, SIMULATED and GAME RULE.

**HIDE (tooltip, colour or Model drawer)**
- **Bits** (−log₂p, plan.md:261): show the market % on the card instead.
- **Internal meters**:
  - Trust (plan.md:334);
  - Oversight (plan.md:335);
  - Support share and Alarm with its stage names (plan.md:312-313);
  - Reach (plan.md:315).
- **Capability band** (plan.md:341).
- **Rogue internals**: stealth, CU and the surfacing maths (plan.md:290-291).
- **Tells**: turn them into a "suspicious" tint on the lab chip (plan.md:314).
- **Decision codes**: drop C/GF/D/R, A/R, E/X/W/B and J/D/RT and use green, amber or red plus a one-line reason (plan.md:184-188).
- **Engine maths**: gates, Epoch share weights and throttle T_L (plan.md:250-256).
- **Hazards**: show them only as events, such as "regulator acts anyway (Kalshi ~18%/qtr)" (plan.md:409-415).
- **The lag**: put it in the drawer as a slider.

**CUT or RENAME**
- **4 of the 7 labels** (plan.md:18):
  - RECORDED becomes one footer line;
  - PROJECTED becomes SIMULATED;
  - RULES-ONLY and HEURISTIC appear only as small footnotes when they occur.
- **"Market-paced clock" bar**: rename it to "Rogue growth pace" and move it to the drawer.
- **"Footholds"**: say "compromised labs", shown as pins (plan.md:5, 278).
- **Recorded tree, depth-2, continuations and `?live=1`**: never shown to the judge (plan.md:16).
- **"Months bought per bit"**: use "seconds bought" (plan.md:60).
- **Blocking prologue**: make it an ambient REAL feed instead.
- **"Plague Inc turned around"**: pitch only.
- **The Guardian vs Guardian RSS clash**: the player is "the Guardian" and the newspaper is a REAL headline source (plan.md:445). Rename one of them.
- **Merge the feeds**: Newswire, ticker, X feed and prologue become one dated feed plus one "government actions" strip (owner decision 4).

## 3. Evidence that the prediction is any good

- **Where it is:** only in the Track record tab, the last step of the path (plan.md:61, 72). It is one click if the tab is visible.
- **It doesn't exist yet.** `doomclock/web/src/fixtures/backtest.ts:5-21` has invented numbers ("Fixture headline: the panel did not beat the market."). There is no `backtest.json`, and `App.tsx` renders only the words "Doom Clock".
- **It scores the wrong thing.** The backtest scores only the LLM panel's adjustments, and "the countdown date itself can't be scored" (CLAUDE.md Rules). But the panel is cut at runtime (plan.md:462), and w = 0 until B4 (`contracts.ts:111`). So the tab grades something that doesn't feed the clock. A data scientist will spot that in 10 seconds.
- **The evidence that does support the clock**, all of which the project already has or plans:
  1. Market calibration on the 429 Manifold questions open at 2026-01-01, 106 of which resolved YES (plan.md:434): Brier and reliability against a coin and the base rate.
  2. The Monte Carlo reproduces each market point within 0.01 (`sim.test.ts:26`).
  3. Anchor thinness: the catastrophe market has 19 traders (plan.md:608).
  4. Sensitivity to the lag.
  5. T7, a paired Wilcoxon test with effect size, for "moves cause effects" (plan.md:530).
  6. One honest line: "the date itself can't be backtested".

## 4. What would raise my score within 5 minutes

1. The clock is the first and only screen, with two hands, a date under each, and "1 s ≈ 26 days".
2. One causal line per move, labelled GAME RULE, for example "Licence → 9 of 13 comply (71% weighted) → Rogue growth ×0.72 at US labs → +6 s". This hits "Decision Making" in the HRT track title.
3. Each card shows its market probability ("Kalshi: 72% a US regulator by 2028"). That ties data to decisions without the word "bits".
4. A "How is this calculated?" link on the clock opens one panel:
   - 4 anchors with price, trader count and date;
   - 10k paths, P(catastrophe) by year, first crossing of 10% = Dec 2032 = 85 s;
   - a lag slider that moves a *ghost* hand live in the browser (2 ms per 10k paths, plan.md:133);
   - the evidence block from section 3.
5. The judge controls the pace: no 30 s prologue and no forced 6 s ticker (plan.md:135).
6. A Rogue reveal at the end: its moves face up with its own rationales, and which ones you caught.

## 5. Proposed 5-minute judge path (3 actions, 5 concepts)

| Time | Action | What they see | Concept learned |
|---|---|---|---|
| 0:00–0:30 | none | Magnified analog clock. Grey REAL hand: 85 s → Dec 2032, "set to the Bulletin's 85 s, 1 s ≈ 26 days". Red YOUR hand on top. "Q1 2027 · turn 1/6". A dated REAL AIID feed on the side. A "?" card: "the Rogue has moved". | 1 Clock, 2 Two hands |
| 0:30–1:45 | **1. Pick a card** (3 offered, market % on each) | A dated government post, X and news reactions, 13 chips flip colour with reasons, then the red hand moves "+N s (game rule)" with a one-line causal chain | 3 Cards, 5 Labels |
| 1:45–2:45 | **2. Fast-forward to Q2 2028** | The hand moves once per quarter, one dated headline per quarter (a surfaced incident "modelled on AIID #1633"). Outcome: Skynet online, Contained or "held at X s". Rogue moves revealed. | 4 Rogue |
| 2:45–4:00 | **3. Click "How is this calculated? Is it any good?"** on the clock | Anchors → Monte Carlo curve → Dec 2032 → 85 s, the lag slider with a ghost hand, the calibration and T7 numbers, and "the date itself can't be tested" | (reuses 1, 2, 5) |
| 4:00–5:00 | Q&A | — | — |

**Build implication (ponytail):** only one turn is interactive, so make depth-1 the default instead of depth-2. That means 3 turn-1 nodes plus continuations, 18 nodes in total, which is already the plan's cut-line 4 (plan.md:510). It replaces about 48 nodes and roughly halves the recording time and cost.

Files cited:
- /private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/wf1/plan.md
- /Users/archiebrown/dev/oxhack/CLAUDE.md
- /Users/archiebrown/dev/oxhack/doomclock/web/src/fixtures/backtest.ts
- /Users/archiebrown/dev/oxhack/doomclock/web/src/contracts.ts
- /Users/archiebrown/dev/oxhack/doomclock/web/src/engine/sim.ts
- /Users/archiebrown/dev/oxhack/doomclock/web/src/engine/sim.test.ts
- /Users/archiebrown/dev/oxhack/doomclock/web/src/app/App.tsx
- /Users/archiebrown/dev/oxhack/data/clean/doomsday_clock.jsonl

## scope-cutter

Scope-cut review of the Doom Clock plan and board (read-only; no files changed, no API calls)

P = /private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/wf1/plan.md
B = /private/tmp/claude-501/-Users-archiebrown-dev/a25c35e3-0f0f-479d-9f51-a74e8639828d/scratchpad/wf1/board.json (cited as line plus task number)

## 0. The centrepiece is missing from the plan

- **No analog clock exists anywhere in the plan.** The hero is a text headline plus a two-line chart (P:57, B:141 task 11). The Doomsday Clock appears only as a context line and two ticker items (P:390, P:424, P:441).
  - **Add to task 7:** `secondsToMidnight = k·(p10Date − now)`. To make today read 85 s, k = 85 s ÷ (Dec 2032 − 24 Oct 2026) ≈ 13.8 s per year.
  - **Add to task 11:** an SVG analog dial with two hands, pinned so it shows on every screen.
- **Use a zoomed dial.** On a real clock face, 85 s is 8.5° before 12 and a 10 s change is 1°, which nobody can see. Draw the Bulletin-style top-left quadrant with a zoomed scale (for example 0–5 min across it) and a numeric readout.
- **Honesty issues with mapping A (owner has not confirmed it):**
  - **85 s is set by calibration, not computed.** Only the date (Dec 2032) and changes to it carry information, and the calculation panel must say so.
  - **The REAL hand contains a non-market constant.** The lag is described as "a default, not market-backed" (doomclock/web/src/engine/sim.ts:16) and as "a 3-year lag (a game rule)" (P:323). With lag 1 the hand reads about 59 s; with lag 10 it reads about 152 s. The calculation panel must show this.
  - **Open question for the owner:** does "now" move forward with the game's quarters? If it does, the real hand gets about 21 s closer to midnight between Q1 2027 and Q2 2028 with no play at all. That is a strong TIME moment and does not break "never moved by play".

## 1. Components, mechanics, labels and data

### Clock and forecast

- **KEEP:** the real hand, `sim(pinned anchors)`, never given a game input (P:318-319). It is the centrepiece.
- **KEEP:** the "your timeline" hand, computed from game state only (P:320-322). This is the second hand.
- **KEEP as one "How the clock is calculated" panel.** It replaces the Model drawer and the Track record tab (P:61, P:323; B:380 task 27, B:526 task 36). It shows:
  - the 4 anchors with trader counts;
  - the Monte Carlo curve crossing 10%, then the conversion to seconds (the two-line chart moves here);
  - lag sensitivity in seconds;
  - one backtest line and one T7 line.
- **CUT** "1-in-10 by Dec 2032" as a separate headline (P:57). It becomes the clock caption.
- **CUT** the clock bar "Kalshi 39%… the clock's pace" (P:57). It is a second "clock" beside the Doomsday Clock and will confuse. The KXAGICO pace goes BACKSTAGE as one GAME RULE line in the calculation panel.
- **CUT from the UI:** the fan band (engine/fanBand.ts), the scenario mix and the `pBad` slider (sim.ts:17). None of them is needed to explain the 10% crossing.
- **BACKSTAGE:** why the Manifold 0.39 "catastrophe before 2030" market is hidden (P:401). Keep it for README and Q&A.

### Backtest

- **CUT** the LLM backtest: the blind Gemini baseline, the panel arm, the T8 pilot and the full run (B:67 task 6, B:242 task 18; P:534; contracts.ts:457-500; fixtures/backtest.ts).
  - The panel was already cut (P:462), so "blind LLM vs market" scores nothing on the clock.
  - It costs $1.50–3 and needs the model-cutoff dance.
- **KEEP instead a $0 version with no LLM:** the Brier score of Manifold prices at T = 2026-01-01 against a coin and the base rate, on resolved questions. The pool already exists (P:434), plus reliability bins. It justifies trusting markets for the real hand, and n ≥ 300 runs in seconds, so no pilot is needed.
- **Optional KEEP (owner call):** a "clock rewind" for the TIME theme, at $0. Recompute the real hand each quarter from anchor prices with `ts < T`. All 4 anchors have price history in data/clean/manifold.jsonl from 2024 to 2026-09, though the catastrophe anchor has only 8 points.

### Simulated world (in scope)

- **KEEP:**
  - government seed posts with issuer headers (P:169);
  - the X feed and the month ticker (P:58);
  - the 13 decision chips with reasons;
  - the Newswire, fed by the wire desk #21 and the incident tracker #25;
  - turn-0 REAL seeds from AIID and world-facts (P:400);
  - the roster identity fix (P:161);
  - the memory blocks WORLD SO FAR, YOUR DECISIONS, NOTICES and PRIVATE, with PRIVATE kept only for sockpuppets (P:165-168);
  - seed dedupe and carry-over;
  - the SUPPORT/OPPOSE wave driving bits income (P:312).
- **Cast KEEP:** labs 0–7, governments 8–12, desks 21–24, the incident tracker 25, public 27–29 and sockpuppets 30–31.
- **CUT** role voices from 8 to 4 (P:205). A judge cannot tell 8 commentators apart, and fewer agents means faster rounds.
- **CUT** the Markets desk #26 (P:208). Posting game-state odds into the feed as "SIMULATED odds" blurs REAL and SIMULATED. Fold the T0 prices into one wire-desk seed post.
- **CUT** the About-the-cast drawer and the display of `modelled_on`/`sources` (P:152, P:173). "Modelled on Hinton" is the one place the UI ties an account to a real person. BACKSTAGE the sources in README and Devpost.
- **CUT** the `ANON_LABS=all` codename toggle (P:178), which has no use in the demo. **KEEP** `ANON_LABS=origin`: it costs nothing and reduces harm.
- **CUT** the RSS outlet headlines (P:445; B:29 task 3 optional half; B:365 task 26). It is a second real-news pipeline; AIID plus world-facts cover T0.

### World events

- **CUT** market hazards that play G1 or G5 for free (P:405-415; B:228 task 17, B:350 task 25). The judge's own move becomes ambiguous ("why did my card vanish?") and every path gets more random branching.
- **CUT** the RSI-announce event (P:415).
- **CUT** the Poisson λ, `incident-rates.ts` and the count line (P:417-421).
- **KEEP** one fixed background incident per quarter, built from an AIID template and labelled "modelled on AIID #N". It is AIID realism and the noise the Guardian has to read.
- **KEEP** the EU high-risk rules seed post on 2027-12-02 (P:423): a real, dated government event, one post.
- **CUT** the Doomsday Clock ticker items in Q1 2027 and Q1 2028 (P:424). They would invent future Bulletin announcements, and the clock is already on screen.

### Game loop

- **Guardian cards: KEEP** G1, G2, G3, G4 and G7.
  - **CUT G5.** It costs 3.1 bits and is last in the offer order (P:262), so it is never offered on the 2-turn path. G7's gate becomes "government ENFORCE and host lab COMPLY".
  - **CUT G6** (P:271). It has no mechanical effect, so a judge who picks it sees nothing happen.
- **CUT card expiry** (P:87, P:266). It only bites after turn 4, inside Fast-forward, where nobody sees it.
- **KEEP** market-priced card costs (−log₂ p), with the market odds shown on the card. This is the visible link from real data to the game. Trader counts and thin-market flags move to the calculation panel.
- **Rogue cards: KEEP** R1, R2, R3, R4, R6 and R7.
  - **CUT R5** (P:286). It works only through a hidden PRIVATE note and is detectable only through the off-stance tell, so it is invisible in 5 minutes and needs its own machinery.
- **Meters:**
  - **KEEP** bits, Oversight, Support, the capability band and footholds.
  - **CUT Trust** (P:303, P:333, and the Trust column of the card table). It adds a second loss condition and a second cost; the support share already carries public mood. A failed G7 then just gives the Rogue +2 CU.
  - **CUT Alarm**: the meter, the lexicon, the ALARM interview line and the stage labels (P:313, P:237). The plan itself shows it doesn't move (P:39: 5.83 → 5.66). Surfacing then uses Oversight only.
  - **CUT** the rule that narrows the capability band (P:341).
  - **CUT** Reach (P:315) and "months bought per bit" (P:60).
- **Tells: KEEP** "refused audit" and "surfaced incident". **CUT** the off-stance tell (it only existed for R5) and the 2-turn decay.
- **KEEP** the end states Contained, Skynet online and Time bought (P:301-305), without the Trust ≤ 0 condition.
- **KEEP:**
  - the LLM Rogue, with its rationales shown face up on the end screen;
  - `sock_text`, which enters the X feed;
  - the hidden-information view and its test;
  - the heuristic fallback;
  - the auto-Guardian;
  - Fast-forward;
  - the end screen.
- **CUT:**
  - the Rogue's `taunt` (P:370), which has no UI slot;
  - `?live=1` (P:507);
  - the offline auto-switch (P:65, B:511 task 35): a static build has no online mode to switch from;
  - off-tree free play and the player's target pick (P:336, P:609). The rules-only engine stays BACKSTAGE as the Plan C fallback.
- **CUT** the globe, the 77 datacentres and the coverage label (P:439, P:508; derive/datacentres.ts, derive/regions.ts).

### Labels

- **CUT 7 labels down to 3:** REAL, SIMULATED and GAME RULE (P:18).
  - RECORDED becomes one footer: "society recorded {UTC}".
  - PROJECTED and RULES-ONLY fold into SIMULATED.
  - HEURISTIC becomes a note on the end screen.
  - Nobody learns 7 labels in 5 minutes.
- **CUT** the DOM test that every visible item has exactly one label (P:69, P:533). Label at component level instead: post, chip, meter, card.

### Data

- **KEEP:**
  - AIID, with the `ts` fix;
  - world-facts.jsonl;
  - the Manifold anchors and the G4 price;
  - Kalshi for the KXAGICO pace and the G1 price;
  - data/clean/doomsday_clock.jsonl (85 s, 2026-01-27), the calibration source;
  - Polymarket, as fact citations only.
- **BACKSTAGE** the Epoch lab weights: hard-code the 8 numbers with a source comment, with no `derive/weights.ts` and no ±0.01 test.
- **CUT:**
  - METR (P:440);
  - datacentres;
  - HN everywhere: pipeline/fetch/hn.ts, clean.ts:43-65, data/clean/hn.jsonl (9,078 rows), and pipeline/mirofish/seed.ts, which is an HN digest (seed.ts:22-68, 142-155).
- **CUT** the legacy types in doomclock/web/src/contracts.ts, in task 1:
  - panel, persona and `w` (95-145);
  - regions, datacentres, origin-lab odds and warning rate (216-290);
  - card-reactions and `source:'panel'` (337-375);
  - `WorldSource` and `Storyline` (423-424);
  - the backtest's panel and blind-LLM arms (457-500).

## 2. The 44 board tasks

| # | Verdict | Change |
|---|---|---|
| 1 (B:5) | KEEP | `Label` type gets 3 values; delete the legacy contract types listed above |
| 2 (B:17) | KEEP | — |
| 3 (B:29) | KEEP world-facts / CUT RSS half | — |
| 4 (B:41) | KEEP | Add: confirm mapping A, and whether "now" advances with quarters. Default (d) becomes the $0 calibration in the calculation panel |
| 5 (B:53) | KEEP | — |
| 6 (B:67) | CUT as written | Replace with the $0 market-calibration Brier, no LLM |
| 7 (B:81) | KEEP + ADD | `secondsToMidnight`, the k calibration, lag sensitivity in seconds |
| 8 (B:95) | KEEP, trimmed | G1–G4 and G7; R1–R4, R6, R7; no expiry, no Trust column |
| 9 (B:109) | KEEP | PRIVATE block only for sockpuppets |
| 10 (B:123) | KEEP / BACKSTAGE / CUT | KEEP AIID `ts`, cummax and the drift fix; BACKSTAGE weights; CUT the datacentre label |
| 11 (B:137) | REWRITE | Analog clock hero, always visible. CUT the clock bar, the blocking 30 s prologue (it becomes the Newswire's T0 items), the globe and the 7-label component |
| 12 (B:152) | KEEP, trimmed | 4 role voices, no #26, `modelled_on` never displayed |
| 13 (B:167) | KEEP | Pass `platform:"twitter"` on interviews |
| 14 (B:182) | KEEP | Drop the ALARM line |
| 15 (B:197) | KEEP, trimmed | No Trust, Alarm, KILLSWITCH, band narrowing or off-stance tell |
| 16 (B:213) | KEEP | Drop the R5 branch of the heuristic |
| 17 (B:228) | CUT | — |
| 18 (B:242) | CUT | Folded into 6 |
| 19 (B:256) | KEEP, trimmed | About 6 AIID background templates, surfacing for R1–R3/R6/R7, the EU calendar post. CUT the RSI post and the Doomsday Clock ticker items |
| 20 (B:271) | KEEP | Pass `enable_reddit:false` at `/create` |
| 21 (B:289) | KEEP | Drop the alarm-spread bar |
| 22 (B:304) | KEEP | Shown as one line in the calculation panel; it is the evidence for "moves cause effects" |
| 23 (B:318) | KEEP | — |
| 24 (B:335) | KEEP | Drop `taunt` |
| 25 (B:350) | SHRINK | A fixed per-quarter schedule: 1 AIID incident plus the EU calendar post; no hazards, no Poisson |
| 26 (B:365) | KEEP, trimmed | No Trust/Alarm meters, Reach, months-per-bit, thin flag or RSS |
| 27 (B:380) | CUT / MERGE | CUT the About-the-cast drawer and the `ANON_LABS=all` toggle; the Model drawer merges into the calculation panel |
| 28 (B:396) | KEEP record.ts / BACKSTAGE T9 | Atomic rename, skip existing nodes, one manual Ctrl-C check |
| 29 (B:414) | BACKSTAGE | 2 bars only: Guardian win rate 30–70%, heuristic Rogue beats random by ≥15 points. CUT the ablation and the median-turn bar |
| 30 (B:431) | KEEP | — |
| 31 (B:448) | KEEP | — |
| 32 (B:467) | KEEP | — |
| 33 (B:481) | BACKSTAGE | Plan C fallback only; no free-play UI |
| 34 (B:497) | KEEP | — |
| 35 (B:511) | KEEP | CUT `?live=1` and the offline auto-switch |
| 36 (B:526) | MERGE | Into the calculation panel |
| 37 (B:542) | KEEP | — |
| 38 (B:558) | KEEP T10, trimmed / CUT DOM test | T10 without the off-tree step and without the auto-switch check |
| 39 (B:573) | KEEP, trimmed | — |
| 40–44 (B:588–646) | KEEP | Task 43 refers to "Model and About-the-cast drawers"; that becomes the calculation panel only |

## 3. Reddit dependencies

1. **`/create` defaults to `enable_reddit=true`** (MiroFish backend/app/api/simulation.py:253). Task 20 (B:274) never says to pass `false`; only cast.ts's `state.json` does (P:156). If it stays `true`, the patched restart check requires `reddit_profiles.json` again (patches/mirofish-twitter-only-restart.patch:24-25) and every restart fails. **Must pass `false`.**
2. **`/start {platform:"parallel"}` (P:116) starts a Reddit half that exits at once** because there are no Reddit profiles (docs/research/spikes-2026-10-24.md:87-89). It has to stay "parallel", because "twitter" mode writes no `actions.jsonl`. KEEP, but never write `reddit_profiles.json`, or every round doubles in cost.
3. **An interview with no `platform` goes to both platforms** (backend/scripts/run_parallel_simulation.py:394-396, 444-448). Set `platform:"twitter"` on every interview item (tasks 13 and 14).
4. **`_get_default_platform` falls back to "reddit"** on any error loading the state (simulation.py:50). Pass `platform=twitter` on every read endpoint; turn.ts reads SQLite directly, so it is not affected.
5. **No Reddit code in doomclock/.** Only the docs mention it: docs/mirofish/README.md:11 and docs/mirofish/api.md:63-95.
6. **CLAUDE.md is out of date.** Lines 8-9, 37, 41-45 and 70 still describe the HN panel, `w`, the globe and gemini-2.5-flash.

