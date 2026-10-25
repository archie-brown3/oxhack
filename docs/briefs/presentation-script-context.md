# Doom Clock — brief for a demo-script partner

Help Archie develop a short script in his own words. Start with the idea, then use the technology to explain what the audience sees. Check every demo claim against the final build.

## The idea

**Doom Clock turns uncertain predictions about AI into a clock you can inspect and a future you can explore.** Dated prediction-market prices feed a model of when powerful AI might arrive and the chance of catastrophe. The clock points to the first date when the model reaches a **1-in-10 chance of AI catastrophe**. A globe plays one possible future drawn from the same model. That future is an illustration, not a claim that a particular event will happen.

The inspiration is the Bulletin's Doomsday Clock and the tension of *Plague Inc.* The intended game adds a human Guardian making interventions against a Rogue AI. The **real forecast** stays fixed as the reference; **your timeline** changes with the players' moves. Move effects are disclosed **game rules**, not measured forecasts.

## Why it fits TIME

Time drives the experience: rewind to what was knowable on a past date, reach today, then fast-forward through different futures quarter by quarter. The countdown translates a probability threshold into a question people can feel: *how much time might we have, and can a decision buy more?* Market questions have deadlines, and the evidence available to make a decision changes over time.

Today's hand is **set to the Bulletin's 85 seconds** as a visual starting point. The Bulletin's number covers broader existential risks; it is not an independently measured AI forecast. The market-based model supplies the 1-in-10 date and the clock's pace. If the script mentions 85 seconds, explain this distinction.

For HRT's **“Best use of Data for Predictions & Decision Making”** challenge, the story is dated evidence → an explicit probability model → possible futures → a decision with a visible time effect. Pitch an inspectable way to reason about uncertainty, not a known catastrophe date.

## Technical story, at a high level

1. **Dated inputs.** API data from prediction markets and real-world sources, including the AI Incident Database, are stored with public timestamps and provenance. The forecast uses four Manifold play-money market anchors. Thin markets are a real limitation. Historical views should use only information public before the selected date.
2. **One model, two views.** Market probabilities and an explicit assumption about the lag from superintelligence to catastrophe form a risk curve. The clock reads where that curve first crosses 10%. A seeded Monte Carlo draws **10,000 futures** from the same distribution; the globe replays one at a time. The sampled futures illustrate the model's range.
3. **A world around the numbers.** Real incidents and government actions supply historical context. MiroFish simulates X posts, government events and news for selected futures. Its society is visible in the Engine view. Real events, model results and simulated content must be labelled separately.
4. **Decisions and evidence.** The intended game changes a separate playable timeline through disclosed rules. A planned track record scores past market prices on resolved questions against simple baselines, using only data available at each checkpoint. It cannot validate the countdown date.

## Scope check before writing spoken claims

The checked-in app currently shows the clock, inputs, a browser-run 10,000-future simulation, globe replay, a “Why this time?” explanation and an Engine view using a labelled recorded test fixture. The full game, live MiroFish integration and measured track record are still on the task board. The latest owner instruction asks the team to build the full product for judging, so inspect the final demo before promising a playable Guardian/Rogue turn or a measured accuracy result.

## Suggested conversation with Archie

Ask him to choose **one promise for the first 20 seconds**: the clock, the playable decision, or the honest use of data. Then walk through the exact demo interaction he will show and test whether a judge can tell what is real, modelled and simulated. A useful closing line is **“A prediction, not a prophecy.”**

For detail, use the [current handoff](../HANDOFF.md), [UI brief](ui.md), [task board](../../.taskmaster/tasks/tasks.json) and [engine](../../doomclock/web/src/engine/timeline.ts). The board's latest notes override older scope in the other docs.
