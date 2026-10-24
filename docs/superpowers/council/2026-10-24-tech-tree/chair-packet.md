# Council review packet

## The question

Should the OxHack "Doom Clock" game have a technology tree, and if so in what shape? What should the cards be?

### Setting

- The event is the OxHack 2026 hackathon, theme TIME.
- Hacking ends Sunday at 12:00. Judging is at the tables, 13:00–15:45.
- The target prize is HRT's "Best use of Data for Predictions & Decision Making".
- A judge has already warned the team on two points:
  - once players move the odds, the output is game state, not a forecast;
  - the move effects are "made up".

### What the product is

The engine:
1. It takes real prediction-market odds. Manifold puts ASI by 2030 at 36% and "AI kills ≥10% by 2100" at 30%. Kalshi puts AGI by 2028 at 39%.
2. An LLM panel reads Hacker News headlines and adjusts those odds in log-odds.
3. A 10k-path Monte Carlo turns them into a countdown.
4. A backtest scores the engine on markets that have already resolved.

The game, Plague Inc-style, sits on top of the engine:
- You play the Guardian. An LLM agent plays the Rogue AI.
- The chart has two lines: the real forecast, which no move touches, and "your timeline", which moves bend.
- Turns are quarters, 12 in all (2027–29), about 30 seconds each. The AI chooses at the same time as you.
- MiroFish (a simulator of social-media personas) supplies the world's reaction posts once per in-game year.
- About 15 build hours remain for the whole project: engine, backtest, MiroFish, game and UI.

### Draft moves

- **Guardian:** mandatory evals, compute caps and export controls, treaty, audits and kill switch, public campaign, nationalise a lab.
- **Rogue AI:** scale training, leak weights, sandbag evals, acquire cloud and crypto, lobby, self-exfiltrate.

Proposed link to the data: a Guardian move costs more when the real markets think it is unlikely. Markets found:

| Market | Probability |
|---|---|
| Global training pause before AGI | 43% |
| International pause in force on 1 Jan 2028 | 36% |
| US licenses frontier models by 2028 | 41% |
| US government takes control of an AI company before 2028 (Kalshi) | 23% |
| Same, before 2030 (Kalshi) | 38% |
| China accepts compute caps by 2030 | 14% |
| A model exfiltrates its weights before Q2 2027 | 24% |
| An AI escapes containment by 2029 | 68% |
| A datacentre is sabotaged before 2029 | 62% |
| A rogue SOTA AI survives 3 months by 2030 | 32% |

### Options

- **(A) Tree-lite.** 3 branches × 3 tiers per side. Every purchase adds +1 to all costs.
- **(B) Full Plague-style tree.** Passive upgrade trees plus active moves. This roughly doubles the UI and the balancing work.
- **(C) No tree.** A flat list of about 6 moves per side, each costing more every time it is reused.

---

## Response A

Pick A, because in code it is C plus one field: each card gets `requires: cardId`, and it is locked when `requires && !owned.has(requires)`. The DNA rule is just cost = base + purchases. That is about 10 extra lines and three CSS columns. B is out: passive trees double the balancing work, nobody balances them by 12:00, and judges won't play long enough to notice them.

Next hour:
- **0:00–0:20.** Write cards.json with 18 entries, each `{id, side, branch, tier, requires, marketId, p, dLogOdds}`.
- **0:20–0:40.** Write `applyTurn(state, gCard, rCard)`, a pure function that touches only the "your timeline" line.
- **0:40–1:00.** Render three columns per side, with locked and cost states. The Rogue LLM receives the IDs of the cards it can afford and has unlocked, and returns one ID, so the output is constrained and can't fail to parse.

Guardian cards. Cost = ceil(10·(1−p)) + purchases.
- **Oversight:** dangerous-capability evals → datacentre audits → kill switch.
- **Compute:** chip export controls → compute caps (China caps, 14%) → global pause (43% / 36%).
- **Politics:** public campaign → US frontier licensing (41%) → nationalise a lab (23% / 38%).

Rogue cards. Cost is paid in compute.
- **Scale:** scale up training → acquire cloud and crypto → datacentre sabotage (62%).
- **Deceive:** sandbag evals → lobby against regulation → leak weights.
- **Escape:** exfiltrate weights (24%) → escape containment (68%) → survive 3 months (32%).

Six cards have a real market, and all the tier-1 cards are flavour. Give those a fixed cost; don't invent a p for them.

For the "made up" objection, don't fix it with theory. Print the source market and its % on the card face, in a single `<small>` tag. The judge sees "this costs a lot because Kalshi says 23%", and the cost is no longer a number we picked.

Fix the length of a demo game now. Twelve quarters at 30 s is 6 minutes, too long for a table visit. Add a `?quarters=4` demo flag and rehearse a 4-quarter game end to end before judging.

## Response B

The tree question is the wrong fight. The judge's objection is that move effects are "made up". Option A gives you 18 made-up effect sizes plus tier-gating rules, and B doubles that. Every card you add is another number the HRT judge can ask you to justify, so a tree enlarges the weakest part of the pitch.

The tree also won't show up in the demo. A judge at a table plays for 2 minutes, not 6. With simultaneous turns and the +1 escalation, they buy 3–4 cards and only ever see tier 1. Tiers 2–3 are build hours nobody sees.

The proposed data link has a hole. It uses real markets for cost, which matters little, and still invents the effect, which is the part being judged. A sharp judge will notice straight away. Some of the markets also invite resolution challenges: "AI escapes containment by 2029" at 68% and "datacentre sabotaged" at 62% almost certainly have loose criteria. If those set your prices, expect "what does that market actually resolve on?"

Take C, with 6 flat cards per side, and fix where the effects come from. Each card is a real market event, and its cost is the market's log-odds, so unlikely moves are expensive. You don't design its effect. Playing the card feeds a synthetic headline ("US imposes frontier-model licensing") to the same LLM panel that adjusts the forecast from HN, and that panel is what the backtest scores. Effects then come from a scored model, not a designer, and "your timeline" becomes a counterfactual run through that model instead of game state. That is a data-for-decisions answer.

Cut more than the tree. Play 6 quarters, not 12, or let judges play 3 turns. If the Rogue AI agent is slow inside a 30 s turn, run it on rules first and add the LLM later. Drop MiroFish if it slips. The backtest wins HRT; the game is decoration, and right now it is eating the backtest's hours.

## Response C

C, the flat list. As a judge I have never heard of Plague Inc's DNA rule, log-odds or "political capital", and I get three minutes. I'll click three or four cards at most. A tree's depth only shows up after twenty minutes of play, so in a demo it just looks like more boxes, and every tier I never unlock is build time I never see.

What will actually confuse me:

1. **Two lines on one chart.** "Real forecast" and "your timeline" will read as "the game changes the forecast", which is exactly what the judge warned about. Label them in plain words on the chart: "What markets predict (untouchable)" and "Your alternate history", with the 36% / 39% / 30% figures printed on the real line.
2. **Jargon on cards.** "Sandbag evals", "self-exfiltrate" and "nationalise a lab" mean nothing to me. Use "Fake the safety test", "Copy itself off the servers" and "Government seizes the lab".
3. **Hidden data.** Using market prices for cost is your best answer to "made up", but only if it's on the card: "International pause — markets say 36% → costs 5". Every Guardian card should show its real market and number. That gets the HRT pitch across without any explanation.
4. **Simultaneous AI moves.** I need a reveal after each turn: "Rogue AI chose: Copy itself off the servers (markets give this 24%)". If I don't see what it did, the agent might as well not exist.
5. **Length.** Twelve quarters at 30 s is 6 minutes, longer than you'll get at my table. Build a demo mode with 4 turns (one per year plus a finale), or one that starts at 2028.

Cards: 6 per side, each tied to a market you already found.
- **Guardian:** license frontier models (41%), global training pause (43%), international pause treaty (36%), seize a lab (23%), China compute caps (14%), datacentre kill switch.
- **Rogue AI:** copy itself out (24%), escape containment (68%), sabotage a datacentre (62%), survive in the wild (32%), fake the safety test, lobby Washington.

## Response D

Choose A, but make every card a real market and turn the judge's objection into the headline.

The judge said moves are made up and the output is game state. Fix that at the source: every tree card is a live Manifold or Kalshi contract, and buying a card means "condition my timeline on this market resolving YES". Cost is surprisal, −log₂(p), so a 41% card is cheap and a 14% card is expensive. Quants recognise that pricing straight away; it is principled, not a fudge.

The effect comes from the same LLM panel the backtest already scores: "P(doom | US licenses frontier models)". The effect is then a backtested conditional estimate, not a designer's guess. "Your timeline" stops being game state and becomes a conditional forecast you build by hand. That is a decision-making tool, which is exactly HRT's brief.

Tiers run in time order: deadlines nearer the bottom, later ones nearer the top. The TIME theme comes for free.

Guardian branches:
- **Evals:** mandatory evals → US licensing by 2028 (41%) → audits and kill switch.
- **Compute:** export controls → China caps by 2030 (14%) → global pause (43%) or pause in force by 1 Jan 2028 (36%).
- **State:** public campaign → treaty → nationalise before 2028 (23%), upgraded to before 2030 (38%).

Rogue AI branches:
- **Stealth:** sandbag evals → exfiltrate weights before Q2 2027 (24%) → escape containment by 2029 (68%).
- **Scale:** scale training → cloud and crypto → rogue AI survives 3 months by 2030 (32%).
- **Influence:** lobby → leak weights → datacentre sabotaged before 2029 (62%).

End screen: "Your path's joint market probability: 0.9%. Real forecast vs your scenario." Every playthrough becomes a scenario with a probability attached.

There is also nearly free upside. Log every table demo's playthrough, and by 15:00 you can show "the 20 judges and players who played picked these paths", a crowd-sourced scenario distribution. The Rogue AI agent's picks show which threats an LLM finds plausible. That is a second data product from the same code.

B adds UI but no new data story. C throws away the tree's best feature, which is tiers that carry time order and conditional structure.

## Response E

You're asking the wrong question. A tree is a UI decision. The real problem is what the judge already flagged: the move effects are made up. An HRT judge at a table doesn't care whether there are 9 cards or 18. They care whether pressing a button does something defensible, and neither A nor B fixes that. Both add more invented numbers.

Rebuild from the prize, "data for predictions and decision making". The game should be a decision tool: what happens to doom if X happens?

1. **Every card is a real market.** Drop the moves with no market behind them: public campaign, sandbag evals, lobbying, crypto. Guardian: global pause (43%), US licensing (41%), US takes control of a lab (23% / 38%), China compute caps (14%). Rogue: weight exfiltration (24%), containment escape (68%), datacentre sabotage (62%), rogue AI survives three months (32%).
2. **Cost is surprisal, −log₂(p) bits.** China caps cost about 2.8 bits and a pause about 1.2. You didn't tune that; it is the market's own price on how unlikely the event is. It is the rule "costs more when markets think it's unlikely", made exact.
3. **"Your timeline" is the forecast conditioned on the events played.** Run each card through the same LLM log-odds panel the real forecast uses, which is backtested on resolved markets. The effect is then your engine's conditional estimate, not a designer's guess, and "game state, not a forecast" becomes "scenario analysis from the same model".

Shape: C, flat, with time as the only gate. The markets carry dates, and those dates are the tiers. "Before 2028" cards disappear after Q4 2027; "by 2030" cards stay. The TIME theme does the gating for free, with no unlock graph to build or balance. A rising cost on reuse isn't needed either, because each event happens once.

That is about 8 cards, and the hours go into the conditioning maths, which is the part that wins.

---
# De-anonymisation
Response A = The Executor. B = The Contrarian. C = The Outsider. D = The Expansionist. E = The First Principles Thinker.

# Peer reviews, condensed. All five reviewers agreed on the ranking.
- **Strongest:** all 5 picked D, with E close behind. D turns the "made up" objection into the pitch: market cards, surprisal cost, and effects from the panel. It also keeps time-ordered tiers. E has the same idea in a leaner shape and drops the cards with no market behind them.
- **Biggest blind spot:** all 5 picked A. Its effects (`dLogOdds`) are still hand-set, and printing the market % on the card is cosmetic. 12 of its 18 cards have no market. Its execution points are still good: the 4-quarter demo flag, the constrained card-ID output, and the pure `applyTurn` function.
- **Missed by all five:**
  1. The backtest scores forecasts, not conditionals ("P(doom | card)"), so calling the card effects "backtested" overclaims. Prediction markets hold no "doom if X" conditionals, so there is no ground truth. Conditioning shows correlation, not causation.
  2. The markets are correlated: pause, licensing and caps overlap. Summing log-odds double-counts, and D's "joint 0.9%" assumes the markets are independent.
  3. Some markets resolve before or inside the game window ("before Q2 2027", "before 2028"), so conditioning on them inside a 2027–29 game may be incoherent.
  4. Synthetic-headline conditioning is sensitive to the prompt. The answer is to precompute every card's effect offline and cache it, so no LLM call happens at the table. Nobody planned a fallback.
  5. The Rogue AI's cards are the same kind of market events, which may make the game circular. Does the agent add anything?
  6. There is no cut-line order or judge Q&A script for the 15 hours that remain.
- Several markets have loose resolution criteria (escape containment 68%, datacentre sabotage 62%). Only B raised this.
