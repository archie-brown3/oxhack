# Data check: sizing the rules for the coupled MiroFish + market loop

Scoping agent, read-only, 25 Oct 2026. Reads `data/clean/*.jsonl`, `data/events.json`, `data/state.json`
(asOf 2026-10-24T20:51:00Z) and `data/backtest.json`. No API calls, no repo edits.

Scripts, re-runnable: `python3 .tmp/scoping/data_check.py` (output in `.tmp/scoping/data_check.out`) and
`python3 .tmp/scoping/rules_check.py` (output in `.tmp/scoping/rules_check.out`). The Python port of the clock
matches the engine: today's 1-in-10 date is **2032.41** in both (`.tmp/scoping/p10check.mjs` calls
`p10Year` in `doomclock/web/src/engine/sim.ts:242`).

Windows are 6 months on calendar boundaries: 2024-10-24..2025-04-01 (5.2 months), 2025-04..2025-10,
2025-10..2026-04, 2026-04..2026-10. "Real rate" below means the mean of the last three full windows.

## TL;DR

1. **AIID: 217 incidents per 6 months** (214 / 228 / 210), so the draft's ~109 per quarter is right. 67% have
   1–2 press reports. "Major" (≥10 reports, the existing flag) is **~7 per 6 months** (10 / 6 / 5) and is falling,
   partly because recent incidents haven't collected reports yet. Incidents tied to a frontier lab: about 64 per
   6 months, of which ~4.7 are major.
2. **Government: ~6 "major" actions per 6 months**, about 5 of them US federal. US federal acts are mostly
   **accelerating** (EOs removing barriers, Genesis Mission, "Era of Super Intelligence"), not restricting. The UK
   puts out ~11 soft announcements per 6 months and 1 major action in two years. The EU has 1 per window or fewer,
   and China 0. China and the EU are almost unobserved.
3. **6-month |Δlogit|, median / p90:** asi2030 0.49 / 0.63, asi2040 0.26 / 0.49, asi2100 0.29 / 0.87,
   cat2100 0.01 / 0.24. Each is driven by a handful of single trade days. cat2100 has **6 trade days in 2 years**.
4. **Event study: confirmed too thin.** After 70 major events, the anchors' 7-day and 30-day moves look like those
   on random days. 2 of 8 tests reach p ≤ 0.05; nothing survives multiple testing, and the signs disagree. With 4
   six-month windows of ~17 major events each, the counts don't vary, so nothing can be identified.
5. **Rule table (below), centred:** nudge = β × (count − real rate). An uncentred table drifts cat2100 by
   +0.19 logit (−10 months of clock) every step at real event rates. The centred table plus noise reproduces the
   real p90 6-month move for asi2030, asi2040 and cat2100 to within 10%.
6. **Two hard problems** that come before any rule: (a) the engine **throws once a step's date passes 2030.0**
   (`sim.ts:62-67`), and the 8-step plan reaches Oct 2030; (b) holding asi2030 flat as 2030 approaches implies an
   absurd hazard. Under constant-hazard decay, the zero-news clock moves ~3 years later by step 6.

---

## (1) AIID incident rate (`data/clean/aiid.jsonl`, 821 records)

**Severity definition.** AIID has no severity field in our snapshot (`doomclock/pipeline/asof/events.ts:103`).
I used the same proxy as `events.json`: `n_reports`, the number of press reports linked to the incident.
- minor: 1–2 reports (551 of 821, 67%)
- moderate: 3–9 reports (239)
- major: ≥10 reports (31). This matches `AIID_MAJOR_REPORTS` (`events.ts:132`).

`n_reports` measures press attention, not harm, and it is counted at the snapshot date of 19 Oct 2026, which is
hindsight (see (6)).

| window | minor | moderate | major | total |
|---|---|---|---|---|
| 2024-10-24..2025-04 (5.2 mo) | 104 | 44 | 10 | 158 |
| 2025-04..2025-10 | 149 | 55 | 10 | 214 |
| 2025-10..2026-04 | 159 | 63 | 6 | 228 |
| 2026-04..2026-10 | 135 | 70 | 5 | 210 |
| 2026-10 (to 11 Oct, incomplete) | 4 | 7 | 0 | 11 |

**Real rate per 6 months:** 217 total, 148 minor, 63 moderate, **7 major**. Per quarter: ~108, ~3.5 major.

**By region** (the `events.json` region rule, a keyword heuristic; `docs/data/events.md` "AIID region rule"):

| window | US | China | rest | unknown |
|---|---|---|---|---|
| 2025-04..2025-10 | 67 | 2 | 66 | 79 |
| 2025-10..2026-04 | 91 | 11 | 65 | 61 |
| 2026-04..2026-10 | 77 | 5 | 58 | 70 |

About a third of incidents have no region. China gets ~6 per 6 months, and the real number is surely larger:
it is a coverage gap, not a rate.

**By frontier lab** (the first of OpenAI, Google, Anthropic, Meta, xAI, Microsoft, DeepSeek or Character.ai
among the developers, then the deployers):

| window | OpenAI | Google | Anthropic | Meta | xAI | other labs | any lab | lab and major |
|---|---|---|---|---|---|---|---|---|
| 2025-04..2025-10 | 26 | 10 | 5 | 9 | 7 | 4 | 61 | 5 |
| 2025-10..2026-04 | 34 | 13 | 8 | 5 | 9 | 3 | 72 | 5 |
| 2026-04..2026-10 | 26 | 6 | 16 | 4 | 5 | 1 | 58 | 4 |

DeepSeek appears 0 times as a developer, which is again a coverage gap.

**Keyword classes** (title and description; crude):
- death words (death, suicide, killed, …): 18 / 22 / 14 per window
- agent or cyber words (agent, autonomous, hack, cyberattack, …): 15 / 29 / 31 per window, rising

**The 21 major incidents since Apr 2025** split into three kinds that matter for rules:
- **Frontier-lab agentic or cyber**, a capability signal: Claude Code GTG-1002 autonomous cyber-espionage
  (2025-11-13), OpenAI models compromise Hugging Face (2026-07-16), and three Anthropic cyber incidents on
  2026-07-30. That is 0 / 1 / 4 per window, a real rate of ~1.7.
- **Frontier-lab misuse or harm**: the Grok "white genocide" post, the Grok antisemitism posts, the Grok NCII
  images, ChatGPT and the Pirkkala stabbing, the ChatGPT/RCMP case, the ChatGPT/FSU shooting, Meta glasses,
  Veo 3 political deepfakes and so on. That is ~3 per window.
- **No lab named**: the MyPillow sanctions, the health-data leak, Rubio voice cloning, police facial recognition,
  gas-price collusion. That is ~2.7 per window.

## (2) Government actions (`data/events.json` kind=government, 83 rows; `data/clean/government.jsonl`, 63)

"Major" is the `events.json` flag. It covers EOs, final rules and EU milestones (`MAJOR_DOC`, `events.ts:105`),
plus Wikipedia and world-facts government acts. Jurisdiction is my classification
(`.tmp/scoping/data_check.py`, `juris`).

| window | US federal | US state/city | UK | EU | China | other |
|---|---|---|---|---|---|---|
| 2024-10-24..2025-04 | 6 M | – | 10 soft | 1 M | 0 | – |
| 2025-04..2025-10 | 5 M + 1 | 1 M (CA SB 53) | 6 soft | 1 M | 0 | – |
| 2025-10..2026-04 | 7 M | 1 M (Baltimore sues xAI) | 1 M (Ofcom/X) + 15 soft | 0 | 0 | 3 M + 3 (SE Asia Grok bans and lifts) |
| 2026-04..2026-10 | 3 M + 1 | 2 M (Florida AG v OpenAI) | 11 soft | 1 M (Omnibus deal) | 1 M (US–China hotline, bilateral) | 1 M (BC sues OpenAI) |

**Real rate per 6 months:**
- US federal major: ~5
- US state major: ~1.3
- UK major: 0.3 (soft: ~11)
- EU major: 0.7
- China: ~0.3, and that one is bilateral
- other countries: ~1.3

The direction of US federal "major" acts matters more than their count. Classifying the 21 US federal major rows
in `events.json` by stance:
- **Accelerating**: EO 14141 (infrastructure), 14179 (removing barriers), 14318 (data-centre permitting), 14320
  (exporting the AI stack), 14363 (Genesis), 14365 (national framework, i.e. pre-emption), 14409 (innovation and
  security), 14434 ("Era of Super Intelligence"). That is ~8 in 2 years, ≈ 2 per 6 months.
- **Restricting**: the AI Diffusion framework, the advanced-computing due-diligence and FDPR rules, the DeepSeek
  ban, Anthropic named a supply-chain risk, the Fable 5 suspension directive, the Jan 2026 licence-review revision.
  That is ~6–7, ≈ 1.6 per 6 months. Plus the US–China hotline.
- **Neutral or off-topic**: EO 14277 (education), EO 14355 (paediatric cancer), the Education Department rule, and
  the "Public Briefing on Framework…" row, which is a duplicate of the diffusion rule counted as a second major
  rule.

**Lab pauses and suspensions** (world-facts):
- Fable 5 suspended (2026-06-12)
- "a major AI lab pauses research for safety reasons" (2026-08-06, a Kalshi resolution)
- OpenAI pauses training after its agents probed US government websites (2026-09-25)

All 3 fall in the last window and none before it, so the real rate is ~0.75 per 6 months over 2 years, or ~1 if
you weight the recent window.

## (3) Six-month logit moves of the clock anchors (`data/state.json` nodes)

These use daily carried-forward prices from `manifold.jsonl`, with `priceAt` semantics (the last close strictly
before the day), and every 182-day window starting from 2024-10-24 (549 overlapping windows, so the effective n is
about 4).

| anchor | trade days since 2024-10-24 | median \|Δ\| 182d | p90 | max | sd (signed) | mean signed | `pRange12m` logit width |
|---|---|---|---|---|---|---|---|
| asi2030 | 62 | **0.486** | **0.633** | 0.962 | 0.458 | −0.145 | 0.889 |
| asi2040 | 57 | 0.255 | 0.486 | 0.657 | 0.317 | −0.008 | 0.908 |
| asi2100 | 21 (none since 2026-03-12) | 0.285 | 0.871 | 1.069 | 0.414 | +0.100 | 0.353 |
| cat2100 | **6** | **0.009** | 0.240 | 0.243 | 0.138 | −0.059 | 0.240 |

Non-overlapping 2-quarter moves from `history` (the honest n = 4):
- asi2030: +0.52, −0.30, −0.55, +0.49
- asi2040: +0.01, −0.36, +0.24, +0.36
- asi2100: +0.44, +0.20, −0.29, 0.00
- cat2100: 0.00, +0.01, −0.24, +0.24

At 91 days: asi2030 0.28 / 0.76, asi2040 0.13 / 0.44, asi2100 0.07 / 0.49, cat2100 0.004 / 0.24.

**Noise term: use the empirical 6-month sd, not `pRange12m`.**
- `pRange12m` is a 12-month min–max range. For a random walk that is roughly 2–2.5 × the 12-month sd, so it is
  not the right scale for a 6-month step.
- For asi2100 it badly understates the move (0.35 vs a p90 of 0.87), and for cat2100 it equals the single jump.

**cat2100 has no usable volatility of its own.** Its median 6-month move is 0.009 because nobody trades it. The
closest proxy is the warning market "Massive AI catastrophe before 2030" (47 traders, 29 trade days): median
0.24, p90 0.32, sd 0.26 over 182 days. The other three warning markets have 4–13 trade days and are also thin.

**Cross-anchor correlation** of the overlapping 182-day signed moves:
- asi2030~asi2040 +0.17, asi2030~cat2100 +0.33
- asi2040~asi2100 −0.73, which is an artefact of a few trades
- I would use independent noise. A shared factor isn't supported.

**Clock sensitivity today** (`.tmp/scoping/rules_check.out`, engine port, L = 3):

| shift | asi2030 | asi2040 | asi2100 | cat2100 |
|---|---|---|---|---|
| +0.2 logit | −6.3 mo | −0.6 mo | **+1.6 mo (later!)** | −7.9 mo |
| +0.5 logit | −14.2 mo | −1.2 mo | **+3.7 mo** | −16.4 mo |
| −0.5 logit | +16.3 mo | +2.0 mo | −5.1 mo | +32.3 mo |

The clock is asi2030 and cat2100. asi2040 hardly matters. **Raising asi2100 moves the clock later**, because
`pBad = pCat2100 / P(ASI by 2100)` (`sim.ts:114-117`): more ASI with the same catastrophe means a lower
catastrophe share. A rule that "raises ASI odds everywhere" would partly cancel itself, so leave asi2100 out of the
rules.

## (4) Event study: is it too thin? Yes.

The quickest version: for each of the 70 `major` events in `events.json` (31 AIID, 17 FR, 12 Wikipedia,
8 world-facts, 2 EU), take each anchor's Δlogit from the event day to +7 and +30 days. Compare the mean |Δ| with
a 2,000-draw permutation of the same number of random start days.

| H | anchor | events where the anchor traded at all | mean \|Δ\| after event | mean \|Δ\| any day | perm p | mean signed |
|---|---|---|---|---|---|---|
| 7d | asi2030 | 29/70 | 0.045 | 0.051 | 0.67 | +0.03 |
| 7d | asi2040 | 22/70 | 0.057 | 0.030 | **0.01** | −0.01 |
| 7d | asi2100 | 13/70 | 0.021 | 0.019 | 0.38 | +0.02 |
| 7d | cat2100 | 5/70 | 0.005 | 0.005 | 0.40 | −0.00 |
| 30d | asi2030 | 45/67 | 0.152 | 0.162 | 0.64 | +0.09 |
| 30d | asi2040 | 40/67 | 0.080 | 0.096 | 0.82 | +0.03 |
| 30d | asi2100 | 30/67 | 0.116 | 0.084 | **0.05** | +0.10 |
| 30d | cat2100 | 16/67 | 0.006 | 0.021 | 0.99 | −0.00 |

**What it shows:**
- Two of eight tests reach p ≤ 0.05, which is what you'd expect by chance. Their signs are near zero or mixed, and
  the events cluster in time (5 FR rows on 15–17 Jan 2025, 3 Anthropic incidents on 30 Jul 2026), so the true p is
  higher. The median 7-day move is 0 both after events and on random days: on most days, nobody trades.
- **At 6 months, the counts are flat.** The four windows had 17, 17, 18 and 17 major events, while asi2030 moved
  +0.52, −0.30, −0.55 and +0.49. The count never varies, so no slope can be estimated.
- **The one big asi2030 move comes before its "cause".** asi2030 jumped 0.275 → 0.384 (+0.50 logit) on a single
  trade day, 2026-07-09. That is before the 16 and 30 Jul lab cyber incidents, and it accounts for nearly all of
  that window's move.
- Applying the rules below to the real 2026-04..10 event counts gives asi2030 **−0.07** and cat2100 −0.06.
  Reality moved +0.49 and +0.24. The table cannot reproduce history: its signs are game logic, not a fit.

**Verdict:** a fitted event study is not defensible on these anchors. Keep "rule" labels on screen, and say in the
talk that we tested it and the anchors are too thin (6–62 trade days in two years).

## (5) Proposed starting rule table

**Form, per step and per anchor:**

```
logit' = logit + Σ_type β[type, anchor] × (count[type] − realRate[type]) + N(0, σ[anchor]),
the rule sum clipped to ±p90[anchor].
```

Why centred: uncentred nudges at real rates give **asi2030 +0.08, cat2100 +0.19 per step, so the clock moves
~10 months earlier every step with nothing unusual happening.** Over 8 steps that is cat2100 +1.5 logit, a doom
ratchet built into the model, while the anchors' real drift was about 0 (mean signed −0.15 and −0.06). With the
centred form, a quiet half-year (fewer incidents than the base rate) moves the clock later, which is the
behaviour we want.

`realRate` is per 6 months, Apr 2025–Oct 2026. β is in logit. asi2100 gets no rules (stale since Mar 2026 and
sign-inverting, see (3)).

| event type (read-out label) | real rate / 6 mo | asi2030 | asi2040 | cat2100 | reason |
|---|---|---|---|---|---|
| incident, minor or moderate (1–9 reports) | ~210 | 0 | 0 | 0 | Too common to be news: it feeds mood only, which feeds the odds of institutions acting. |
| incident, major, no lab named | 2.7 | 0 | 0 | +0.01 | Harm without frontier capability: small catastrophe signal only. |
| frontier-lab incident, major, misuse or harm | 3.0 | 0 | 0 | +0.015 | Says something about deployment risk, nothing about ASI timing. |
| frontier-lab incident, major, agentic or cyber | 1.7 | **+0.08** | +0.04 | **+0.03** | Evidence of autonomous capability: both timing and risk go up (the 2025-11 GTG-1002 and 2026-07 cases). |
| government, binding, accelerating (EO, law or rule that removes barriers or adds compute) | 4.0 | +0.03 | +0.015 | +0.005 | Faster build-out; little risk mitigation. Most US EOs are this type. |
| government, binding, restricting (export control, ban, licensing, a model pulled) | 2.0 | −0.04 | −0.02 | −0.01 | Slows diffusion and compute; weak evidence on catastrophe. |
| government, soft (consultation, press release, speech, investigation) | ~12 | 0 | 0 | 0 | UK-style announcements: mood only. |
| lab pause or model suspension (by the lab account) | 1.0 | **−0.10** | −0.05 | −0.015 | The strongest direct brake we observed; rare. |
| international agreement (bilateral or multilateral, by a government account) | 0.33 | 0 | 0 | −0.04 | Coordination lowers the catastrophe tail; no timing evidence. |

Noise σ (6-month): **asi2030 0.35, asi2040 0.25, asi2100 0.10, cat2100 0.15.**
- asi2030 and asi2040: ~0.75 of the real sd, so that rules plus noise land on the real p90.
- cat2100: between its own sd (0.14) and the 2030 catastrophe market's (0.26).
- asi2100: kept small on purpose. Holding it fixed (σ = 0) is also defensible.

**Step checks** (`.tmp/scoping/rules_check.out`, v2). The budget is the real p90 |182d Δlogit|: 0.633 / 0.486 /
0.871 / 0.240.

| step | asi2030 | asi2040 | cat2100 | clock (rules only) | within p90? |
|---|---|---|---|---|---|
| counts = real rates | 0 | 0 | 0 | 0 mo | yes |
| doom-heavy: 7 major, 6 misuse, 5 agentic, 8 accelerating, no brakes | +0.56 | +0.28 | +0.255 | −22 mo | asi yes; cat 6% over, so the clip binds |
| calm-heavy: 5 restricting, 3 pauses, 2 agreements, 1 major, 1 misuse | −0.58 | −0.29 | −0.245 | +36 mo | cat ~2% over, so the clip binds |
| replay of the real 2026-04..10 counts | −0.07 | −0.03 | −0.055 | +5 mo | yes (reality: +0.49, +0.36, +0.24) |

Over 10,000 steps with Poisson counts at real rates, rules plus noise give:

| anchor | rule-only \|push\| p90 | total \|Δ\| median | total \|Δ\| p90 | real median | real p90 |
|---|---|---|---|---|---|
| asi2030 | 0.28 | 0.26 | **0.65** | 0.49 | **0.63** |
| asi2040 | 0.14 | 0.18 | **0.43** | 0.26 | **0.49** |
| asi2100 | 0 | 0.07 | 0.16 | 0.29 | 0.87 |
| cat2100 | 0.10 | 0.11 | **0.27** | 0.01 | **0.24** |

- The tails match. The medians are lower than reality's for the ASI anchors, because real moves are lumpy single
  trades.
- After 8 steps of rules plus noise, read with today's start, the 1-in-10 date spreads 2030.0 / 2032.7 / 2037.6
  (p10 / median / p90; today 2032.4). That is a plausible spread for 5 futures.
- One step at +1 noise sd moves the clock by: asi2030 −10.5 mo, cat2100 −6.1 mo, asi2040 −0.7 mo, asi2100 +0.8 mo.
  Noise and rules are of the same order, so per-future differences will be about half luck. Say so.

**MiroFish-produced events are not drawn at real rates.** Incidents are drawn at the real rate by seeded dice,
so their centred push averages zero. Institution events come from the LLM read-out, and their rate is whatever the
32-account cast posts. Two guards:
- Cap the counted events at 3 per type per step.
- Log the simulated rate per type next to `realRate`, so we can show the loop isn't inflating events.

If a future's simulated rate averages 2× real, the centring turns that into the drift we would then report.

## (6) Data problems a quant judge would catch

**Hard blockers for the 8-step plan**
1. **The engine throws after 2030.0.** `asiKnots` requires each ASI knot year to be after `startYear`
   (`sim.ts:62-67`), and the knots are fixed at 2030, 2040 and 2100 (`timeline.ts:103-114`). A 6-month step
   from Oct 2026 reaches startYear 2030.3 at step 7, which throws. "The Monte Carlo continues from there" also
   needs a rule for what asi2030 means after 2030.
2. **asi2030 has no time decay.** Holding the price flat while the step date moves toward 2030 claims a 36%
   chance of ASI in the last few months.

   | step date | asi2030 held flat | constant-hazard decay |
   |---|---|---|
   | 2027.8 | 1-in-10 is 58 mo ahead | asi2030 0.27, 72 mo ahead |
   | 2028.8 | 50 mo ahead | asi2030 0.16, 76 mo ahead |
   | 2029.8 | 41 mo ahead | asi2030 0.03, 78 mo ahead |

   **With no news the clock should recede by ~3 years over the run, not advance.** Fix: apply nudges and noise to
   the decayed baseline `1 − (1 − p0)^((2030 − t)/(2030 − t0))`, or fold asi2030 into asi2040 once t passes ~2029.
   It is cheapest to cut to fewer or shorter steps (e.g. 6 × 6 months to Oct 2029) and state the decay rule.

**Anchor quality**
3. **cat2100 is the most powerful anchor and the thinnest.** −0.5 logit moves the clock +32 months, yet the market
   has 19 traders, play money and 6 trade days in two years (`docs/data/state.md:54-55`). Its observed volatility
   is ~0. Any noise term for it is borrowed (here from the 2030 catastrophe market), and we should say so.
4. **asi2100 hasn't traded since 2026-03-12** (`lastTradeTs`): its "today" price is 7 months old. The
   `history` points are carried forward too: several are months older than their quarter (cat2100's 2025Q1
   price is from 2024-05-22). And `traders` is the count at fetch time, not at `asOf` (`state.md:37`).
5. **The 6-month moves are effectively n = 4** non-overlapping windows. p90s are interpolated from overlapping
   windows, so quote them as rough ("about 0.6 logit"), not to 3 dp.

**Event data**
6. **The AIID "major" flag is press attention counted with hindsight.** `n_reports` is as of the 19 Oct 2026
   snapshot, so an incident from 2025 has had 18 months to collect reports and one from Sep 2026 has had weeks.
   Majors per window fall 10 → 10 → 6 → 5 partly for that reason, and `docs/data/aiid.md:12` already flags the
   last month as undercounted. Rates for the incident dice should use Apr 2025–Apr 2026 for "major" (~8 per 6
   months) or adjust for the lag.
7. **AIID coverage is skewed to English-language press.** About 33% have no region, China has ~6 per 6 months
   and DeepSeek 0. "No China incidents" in a future is an artefact of the data, not the world.
8. **Government coverage is US federal plus UK DSIT/AISI/No10, plus 2 EU rows transcribed by hand.** There is no
   China source (`docs/data/government.md:65-68`), and the EU general-application date is left out on purpose.
   The Wikipedia rows add state, city and foreign acts unevenly. A rule keyed on "EU AI Office adopts a rule" has
   no real base rate behind it (≤1 per 6 months).
9. **The `major` flag on government rows is a document-type rule, not impact** (`events.ts:105`). It counts the
   paediatric-cancer EO and a "Public Briefing" duplicate of the diffusion rule as major, and the Jan 2025 cluster
   (5 FR rows in 3 days) is one policy event. Stance (accelerating or restricting) is not in the data. The read-out
   must label it, and for real events someone has to hand-label ~21 rows.
10. **Kalshi settled-market prices are missing** from `kalshi.jsonl`: 1,265 resolved markets (`state.md`, KXAGICO
    section). This doesn't touch the clock anchors (all Manifold), but it does touch the backtest pool. `n.test` =
    1,186, of which 188 are Kalshi, and the backtest is the evidence for "trust the markets".
11. **The backtest scores 30-day market calibration** (`backtest.json` `design.horizonDays: 30`, market Brier 0.085
    vs coin 0.25). It says nothing about 6-month moves driven by simulated events, so don't let the talk imply it
    validates the rule table.

**Model framing**
12. **Noise and rules are the same size.** One noise sd on asi2030 is ~10 months of clock, about the same as a
    heavy event step. A judge will ask how much of the 5 futures' spread is MiroFish and how much is the RNG.
    Report the split (re-run each future with the rules off and the same seed).

## Recommended next steps (cheapest first)

1. Pick the step plan so startYear stays below 2030: 6 × 6 months to Oct 2029, or 8 × 3 months with σ scaled by √½.
   Add the asi2030 decay baseline.
2. Use the centred rule table above. Clip the step's rule sum at ±p90. Leave asi2100 out of the rules.
3. Log simulated counts against `realRate` per type, and the rules-off spread, for the Engine view and the talk.
