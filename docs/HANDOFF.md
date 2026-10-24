# Doom Clock: team handoff

## Part 1: Read this first

### What we are building

Doom Clock shows how AI risk could change over time. It uses real data, including bets on when powerful AI will arrive and how much harm it could cause.

The model calculates a risk curve. It also runs 10,000 possible futures. The app lets you watch one future on a globe and see the data behind it. These futures are examples, not facts.

The clock shows time left until the model's risk of AI catastrophe reaches 10%. This is a model result, not a known date. The current display starts at the Bulletin's 85 seconds to midnight. The forecast sets how fast the hand moves. See the latest notes in tasks 1 and 5 for the clock rules.

The demo has four main views:

- **Inputs:** See the source data. Move the date slider to see what was known at that time.
- **World:** Watch a possible future on the globe. See why the clock moves.
- **Engine:** See simulated posts on X, government events and news from MiroFish.
- **Why this time?:** Check the model's inputs, assumptions and past prediction scores.

The hackathon build is a simulation. The Guardian versus Rogue AI game is for later. Do not build the game now.

### Start work with the task board

**The most important file is [`.taskmaster/tasks/tasks.json`](../.taskmaster/tasks/tasks.json).**

It tells you what remains, what comes first, what each task needs, and how to check the result. Read the whole task, including its latest notes. Some titles, descriptions and status fields lag behind those notes.

Every code change must follow a task. Use an active task with no unmet dependencies. Do not work on deferred or cancelled tasks. If the team changes the scope, update the board first. Keep task status and check results current. Commit and push task updates with the related work.

Archie is stepping away. **The team can make decisions.** The Lead agent continues to assign work, review changes, commit and push. Tell the Lead before changing another agent's files. Do not wait for Archie to make routine decisions.

At this handoff, the existing Lead and UI Claude sessions have hit their usage limits. If they cannot respond, use a fresh agent to take over coordination. Check the board and unfinished file changes first.

### What is done, and what needs work

This is a snapshot. Check the board and ask the Lead for changes before you start.

- Real market and event data are in the repo. The approved mockup is in `.lavish/prototype/`.
- The Engine page is built (task **19**): feed, government/news, cast, graph, run stats and full-screen views. It uses recorded test data until task **11** supplies the run library. It does not run MiroFish live.
- Globe zoom is built (task **145**). The graph also has zoom in, zoom out and reset controls, including full screen.
- Replay now takes eight seconds per quarter at normal speed. News stays still. Use the arrows to read other events; this pauses replay (task **146**).
- The World map uses `!` for incidents, `§` for government actions, `≋` for news and `@` for simulated X posts. Open **Map key** for these icons, real/simulated rings, datacentre dots and catastrophe marks.
- Some engine work is still in files that are not yet committed. Do not replace it or start a second copy.
- Tasks **14 and 3** cover data at a chosen date and the engine timeline.
- Tasks **4, 5 and 15** cover the globe, clock, explanations and Inputs view.
- Tasks **6 and 7** cover past prediction scores and their display. A sample display is not proof that the backtest works.
- Task **11** covers recorded MiroFish runs: three futures, four quarters each.
- Tasks **8, 9, 13 and 17** cover integration, offline use, review, deployment and submission.
- Task **16**, live MiroFish, is optional. Tasks **101–144**, the game, are deferred.

Known issues to check first:

- The Kalshi data cleaner misses some price fields. Fix this for task 6, or leave that source out and state the limit.
- The MiroFish seed still needs to use the current event data instead of Hacker News.
- The catastrophe market has few traders. Show that limit beside its result.
- The public site is [doomclock-web.vercel.app](https://doomclock-web.vercel.app). Pushes to `main` auto-deploy through Vercel. Check that the build succeeds before saying changes are live. See [deployment steps](deploy.md).
- Track record has no measured result yet. The UI hides the sample scores. Finishing task **6** is a key remaining task for the HRT pitch.

Latest checks for this handoff: 37 tests passed in the commit snapshot; four checks skipped because their data files do not exist yet. The web build passed with a large-bundle warning. Engine, graph, roster and news were checked in Chrome, including mobile layout. These checks do not prove prediction accuracy.

Aim to freeze changes at **11:30 GMT on Sunday 25 October** and submit by **11:45 GMT**. Hacking ends at noon. The clocks go back overnight; use GMT for these deadlines.

### Read the project docs

Start with the board. Then use this guide. The repo is <https://github.com/archie-brown3/oxhack>.

| Document | What it is for |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Rules for agents, data, tests and shared work. `CLAUDE.md` links to it. |
| [UI brief](briefs/ui.md) | Screens, demo flow and required context for each event and clock move. |
| [Design system](../context/design-system/README.md) | Visual rules. Read before UI work. Includes tokens, screen rules and component guides. |
| [Reference index](../context/README.md) | Links to the source research, data notes and hackathon material. |
| [Data docs](data/) | Source formats, public dates, filters and build steps. |
| [MiroFish spike results](research/spikes-2026-10-24.md) | Measured run times and costs. |
| [MiroFish docs](mirofish/README.md) and [patches](../patches/README.md) | Setup, API, seed data and local changes. Some setup notes are old. |
| [Demo reviews](superpowers/plans/2026-10-24-doom-clock-demo-reviews.md) | Demo risks and scope cuts. |
| [Feasibility review](superpowers/plans/2026-10-24-doom-clock-feasibility.md) | Why we cut the scope. |
| [Full game plan](superpowers/plans/2026-10-24-doom-clock-game-plan-full.md) | Future work. Do not use it as the current task list. |
| [Plans](superpowers/plans/), [specs](superpowers/specs/) and [research](research/) | Other agent documents and design background. Check their date and scope. |
| [Judging review skill](../.claude/skills/judging-criteria-review/) | Check the demo against the judging criteria. |

**Some older docs conflict with current decisions.** The latest task notes record the clock change to 85 seconds. Older docs say one minute equals one year. Hacker News and the LLM panel are out of the current build. MiroFish uses X only, in English. The game is deferred. If documents disagree, check the latest owner decision with the Lead and correct the board.

### Keep these rules

- Use only data that was public before the chosen date. Keep source dates and links.
- Keep real events, model results and simulated content clearly labelled.
- News gives context. Do not claim that a news event caused a market or clock move.
- Score past market predictions honestly. Do not claim that the countdown date has been proved correct.
- New app code goes in `doomclock/`. The old `web/` app is frozen.
- Do not put keys in Git or in the handoff. Use the existing local environment setup.

### Run the app

From the repo root:

```sh
cd doomclock/web
npm run dev
```

Checks and offline build:

```sh
# From the repo root
node --test doomclock/web/src/engine/ doomclock/pipeline/lib/
cd doomclock/web
npm test
npm run publish:cache
npm run build
npm run preview
```

These are run commands, not a claim that the latest work passes. Ask the Lead for the latest results. The configured MiroFish checkout is separate, at `~/dev/MiroFish`; check its setup before starting a run.

## Part 2: Paste this into your agent

```text
I am taking over work on OxHack Doom Clock while Archie is away. The team owns decisions. Help me finish the current hackathon demo.

First read docs/HANDOFF.md for the product and handover.

CRITICAL: Read .taskmaster/tasks/tasks.json before any coding. This is the shared source of truth for remaining work, priorities, dependencies, acceptance checks and review gates. Read each task's latest notes as well as its description and status. Every code change must follow an active, unblocked task. Do not implement deferred or cancelled work. Update the board before implementing a new scope. Keep task status and verification notes current, and commit and push task updates with related work.

Read AGENTS.md (CLAUDE.md links to it). Read docs/briefs/ui.md and context/README.md. For UI work, also read context/design-system/README.md and the relevant component guides. Use docs/data/ for source schemas and date rules. Use the handoff's document guide to find the other plans, specs, research and MiroFish docs. Older documents contain superseded scope; do not blindly follow them.

The current build is a simulation, not the Guardian versus Rogue AI game. It uses real market data, a model risk curve and 10,000 sampled futures. The latest owner notes in tasks 1 and 5 set today's clock display to the Bulletin's 85 seconds; the forecast sets its pace. Hacker News and the LLM panel are out of this phase. MiroFish uses X only, in English. Clearly label simulations and disclose limits in the data.

Before editing, inspect git status and the running agents. If Herdr is available, use herdr agent list and herdr tab list to find the Lead. Ask the Lead for current ownership, work in progress, blockers and recent check results. Do not overwrite another agent's work. The Lead continues to assign work, review changes, commit and push. Coordinate the task and file scope with it. Do not stage unrelated files.

If Herdr is not available, use the task board and Git state to identify what is safe to work on. Ask the team about unclear ownership before editing files with existing changes.

Give me a short report: what works, what remains, which active task you recommend next, and why. Then carry out the agreed task, run its required checks, and record the results on the board. Verify UI changes by viewing them. Keep the implementation small. The team can settle routine decisions without waiting for Archie.

Freeze target: Sunday 25 October 2026, 11:30 GMT. Submission target: 11:45 GMT. Cut optional scope before risking the demo.
```
