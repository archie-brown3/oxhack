# OxHack 2026 swarm, phase 1: industry scan

## Goal

Find the industry (sector) where a 24-hour hackathon team can build the strongest entry for
the **HRT track: "Best use of data for predictions and decision making"**. Ideas come in
phase 2, after the coordinator and the team pick an industry. Do not design projects here.

## Fixed context

- Event: OxHack 2026, Oxford. Theme: **TIME** (loose). Hacking runs Sat 24 Oct 12:00 to
  Sun 25 Oct 12:00. About 18 real build hours. Judges walk round tables on Sunday afternoon.
- Team goal: **a strong live demo that solves a real problem**, **consumer-facing**.
- HRT judges (algorithm developers, software engineers, data scientists) will likely reward:
  an honest baseline beaten out of sample, calibrated probabilities, a decision with a
  measurable cost or saving, and careful data work. They will not reward stock-price
  prediction, overnight deep nets, or accuracy measured on training data.
- Most consumer time decisions are one of: **timing** (when to act), **choice** (which
  option), **deadline** (will it be done in time), **early warning** (act before an event).
- Data must be free, need no approval or sign-up, have history (for a backtest) and ideally a
  live feed. Already verified on 24 Oct, no key needed: Environment Agency flood monitoring,
  National Grid carbon intensity, Octopus Agile prices, Open-Meteo forecasts and ensembles
  and pollen, TfL BikePoint, queue-times.com, UK fuel price feeds (current prices only), NHS
  England referral-to-treatment statistics page. Do not re-check these; build on them.

## Your job

You own one lens of industries (below). For **4 to 6 industries** in your lens:

1. Name 2 or 3 real consumer problems that are time decisions. Say who feels each one.
2. Find the open data that would power it. **Verify each new source with one `curl`**
   (status code and one fact: row count, date range or field names). Mark ✅ verified,
   ❌ failed, or ❓ needs sign-up.
3. Score the industry 1 to 5 on each: real problem, data (free, history, live), demo
   strength (judge takes part, visible change in 10 s), 24-hour feasibility, HRT fit
   (prediction drives a decision with a measurable cost), theme fit (time).
4. Note the main risk and any existing product that already solves it.

## Lenses (one per worker)

- **health**: health, social care, pharmacy, mental health, public services, education.
- **money**: personal finance, energy and home, housing and rent, groceries and retail,
  insurance, fuel.
- **move**: transport and commuting, travel, events and leisure, sport, weather,
  environment, food and agriculture.

## Output

Write **one file**: `industry-<lens>.md` in this folder, under 120 lines:

1. A ranked table: industry | total score | the best problem in one line | key data source
   with ✅/❌/❓.
2. One short section per industry with the problems, sources (URL and the fact you
   checked), scores and risk.
3. Your top pick in your lens and why, in 3 sentences.

## Rules

- Stay in this folder. Never search the whole disk (`find /`, `~/Library`).
- `curl` public URLs only. No sign-ups, no API keys, no posting anything anywhere.
- Short sentences. Facts you did not check are marked "unverified".
- Do not write other workers' files. Finish when your file meets the output section.
