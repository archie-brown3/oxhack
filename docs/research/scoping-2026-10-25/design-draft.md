# Doom Clock: coupled MiroFish + market loop (draft for scoping, 25 Oct ~01:30 GMT)

Owner decisions so far (Archie, this session):
- The game layer is dropped. MiroFish should drive the simulation and move the clock, but MiroFish alone
  is not accurate enough, so its events push a market-based forecast (Kalshi/Manifold), not replace it.
- 5 futures. One MiroFish run = one step of 3-6 months (draft: 6 months, 8 steps, to ~2030).
- Markets and news are coupled both ways: prices seed each MiroFish step, and the step's events move
  the prices for the next step. Not deterministic: different futures get different events and dates.
- Events are saved as objects, separate from posts, so a major government act outranks a random
  account. Posts still matter, as public mood.

The loop, per future, per step:
1. State: simulated anchor prices (start = real prices today, data/state.json `nodes`, logit `dlogit`),
   plus the event history so far.
2. Incidents: rolled with seeded dice at the real AIID rate (about 109 per quarter, most minor), fed into
   the run as news / incident-tracker seed posts. MiroFish cannot simulate world events; it only
   simulates posts (OASIS: post, quote, repost, like, follow).
3. MiroFish run (Twitter only, hand-written 32-account cast, doomclock/web/src/game/data/cast.json),
   seeded with: the step's incidents, the previous step's events and top posts, and the current prices
   posted by the Markets desk account.
4. Read-out: one cheap LLM call over the step's posts returns institution decisions as events. An event
   counts only if posted by the account with the power to do it (EU AI Office adopts a rule; a lab
   pauses). Rumours from other accounts don't count. Mood (alarm, support for oversight) is computed from
   all posts and changes how likely institutions are to act next step, not the prices directly.
5. Prices move: new logit = old + sum of rule-table nudges for the step's events + noise sized from the
   anchor's real 12-month range (`pRange12m`). The rule table is labelled "rule" on screen (an event
   study was judged too thin: the clock's anchors have ~63 price points in 2 years).
6. Clock: the same model (doomclock/web/src/engine/sim.ts) on the new prices gives this future's
   1-in-10 date at this step. After the last simulated step the Monte Carlo continues from there.
7. Saved: WorldEvent objects (contracts.ts) with optional actorId, postId, step, futureId, effect;
   provenance 'simulated'. The globe and event reader already render WorldEvents.
8. One full MiroFish report-agent report per future at the end (for the Engine view and the talk).

Budget so far: ~$0.043 and 35-60 s per run measured tonight, so 40 runs ≈ 40 min, ≈ $1.70.
Constraints: freeze 11:30 GMT, submit 11:45 GMT, hacking ends 12:00 GMT. Real backtest already landed
(data/backtest.json: market Brier 0.085 vs coin 0.250, n = 1,186 later questions, blind Gemini weight 0).
Salvage: an earlier lane left a working per-quarter recorder (uncommitted) in
/Users/archiebrown/dev/oxhack/.claude/worktrees/wf_fa865241-fde-4/doomclock/pipeline/world/record.ts
with 3 recorded quarters in data/world/runs/ there.
