
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
