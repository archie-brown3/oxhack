# Plague Inc research (two agents, 24 Oct 2026)

Condensed from two research reports, one on mechanics and one on design and UX. The fandom
wiki is community-written and many of its numbers are datamined. "Unverified" marks claims
the agents could not source.

## Mechanics

- **Loop.** Pick a plague and a start country. It spreads in real time. Spend **DNA points** on
  three trees: Transmission, Symptoms, Abilities. Win by killing everyone. Lose if the cure
  completes, or if the plague kills its hosts before infecting everyone.
- **DNA** comes from red and orange bubbles you tap, plus infection and death milestones.
  Every evolve or devolve adds +1 to the cost of every other trait. Mutation can evolve traits for free.
- **Core stats.** *Infectivity* spreads it. *Severity* triggers detection, cure funding and
  DNA. *Lethality* kills; deaths make countries close borders and also cut their research.
  Usual order: infectivity first, severity after detection, lethality last.
- **World.** Country groups have population, urban/rural, hot/cold, rich/poor (rich countries
  fund more research), and hidden traits: research budget and "global importance". Spread runs
  on air, sea and land routes. After detection, countries close borders and ports for good.
  Islands with no airport (Madagascar, Greenland) are the meme.
- **Government actions.** Each fires above a local or global priority threshold. Example:
  "Burning Corpses" at priority 80 with ≥10% dead gives −3 infectivity.
- **Cure.** 340 research facilities, funded by severity, lethality and each country's
  importance. Deaths and government collapse cut funding. Traits can raise the total work the
  cure needs or reset progress. Warnings at 25, 50, 75 and 95%.
- **News ticker.** A fixed escalation script ("New disease in X", then "riots", then "watch
  list", then "work on cure", then "maximum priority"). Headlines depend on traits (Bird 1 gives
  "X exterminates pigeons"). Random pop-culture filler gets crowded out as plague news grows.
- **The Cure (2020), playing as defender.** Built with WHO, CEPI and GOARN.
  - *Resources* scale with how bad the outbreak is.
  - *Authority* starts at 100; you lose at 0. Panic, deaths and non-compliance drain it.
  - *Non-compliance* (per country) rises with lockdowns and falls with economic support.
    At 100% the country ignores every measure and reopens its borders.
  - Defender tools: quarantine tiers, prevention (cost 3–20), contact tracing and testing,
    border screening, field operatives you move between countries, and a two-stage vaccine
    (research, then manufacturing).
  - Events: patient zero found (+10% cure), adverse vaccine reaction (−10%).
  - Against Nano-Virus you can hack it for one-time buffs, and the firewall locks once the
    hack is detected.
- **Versus multiplayer (2015).** Two plagues fight over one world.
  - Start countries are hidden, and you get bonus DNA while yours stays hidden.
  - You can steal stats from the other plague.
  - *Benign Mimic* tricks a country into curing your opponent.
  - You can make the opponent easier to cure.
  - In Co-op, the shared cure labs target the bigger threat.
- **Rogue-tech precedents.**
  - Nano-Virus: a rogue nanomachine with a kill switch.
  - Neurax Worm: alternative win by enslaving humanity.
  - Steam Workshop "Rise of the Machines" (2014, now removed): "You are a state of the art
    experimental AI." Its trees were Communications, Machines, Manipulation and Kill All Humans.
- **Score:** `10 × [(Severity × DNA × Difficulty × PlagueFactor) / (Cure% × log Time) + Death% × 100]`.
  Difficulty changes infection rate, cure speed and how countries respond.
- **Maths.** Per-country healthy, infected and dead counts, with daily research accounting.
  Whether it is an SIR model is unverified, as is the tick rate.

## Design and UX

- **One glance.** The map is the main display: red tint spreading, plane and ship routes,
  dark for dead countries. One blue cure bar "fills slowly but surely". There's a date counter
  (about one day per second, plus fast-forward) and a ticker along the top. One colour per
  state: red you, blue cure, grey dead.
- **Tension.** Three acts: hide, spread, race the cure. The core choice is **hidden vs
  visible**.
- **End screen.** Win/lose, a score, a 1–5 biohazard rating, and a **disease graph** of the
  stats over time, which works as an instant replay.
- **Why it works.** You play the villain ("Contagion from the other side"), and every run
  tells a different story. James Vaughan scopes to a few themes and avoids a "lumbering
  monstrosity". The CDC invited him to speak in 2013. The *Fake News* scenario (2019) reused
  the infection model for misinformation "perfectly".
- **Realism.** Ndemic: "It's not a scientific model." Epidemiologists say it makes
  eradication look too easy.
- **Related games:**
  - *Rebel Inc*: every helpful action has a visible side effect (corruption, inflation).
  - *Universal Paperclips*: one number going up, with panels that unlock in phases. About
    450k players in 11 days.
  - *Intelligence Rising* (Cambridge CSER) AI-futures role-play: races destabilise, treaties
    are fragile, shocks change the course.
  - *Pandemic*: chain-reaction outbreaks create the tension.
  - *DEFCON*: dark vector world map, staged levels 5→1, about 30 minutes. It **started as a
    24-hour game jam**.

## Lessons the agents picked for our game

1. Make the map the main display, with one colour per side.
2. Two opposing bars: takeover vs oversight.
3. Show time on screen: a date ticking and DEFCON-style stages.
4. Template headlines with player names inserted, filled with real news.
5. Tiered government responses.
6. Stealth vs capability as the core choice: more capability means faster detection.
7. Taps for rewards, and a visible cost on every defender action (public trust).
8. Each side uses the neutral world against the other.
9. 5–10 minute sessions ending in a timeline replay. That's where data-science judges will look.
10. Own the realism question: show the real inputs and call it a stylised model.

Sources: plagueinc.fandom.com (Core_stats, DNA_Points, Cure, News, Cure_Mode, Authority,
Non-Compliance, Multiplayer, Score), plagueinc.wiki.gg, en.wikipedia.org/wiki/Plague_Inc.,
who.int (The Cure), kotaku.com, avclub.com, engadget.com (Fake News), arxiv.org/abs/2410.03092
(Intelligence Rising), en.wikipedia.org/wiki/DEFCON_(video_game),
steamcommunity.com/sharedfiles/filedetails/?id=315603923.
