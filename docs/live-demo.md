# Live demo: MiroFish and the coupled-loop step, in real time, on the demo Mac

Board task 156, branch `live-demo`. Local only. The deployed site never runs this: the production bundle
names no MiroFish endpoint (`npm run build` ends with `scripts/check-inert.mjs`, which fails the build if it
does), the live client only ever asks its own origin for `/live/…`, and that path is forwarded only by the
Vite dev and preview servers. Everything on screen is labelled LIVE · SIMULATED or SIMULATED · RECORDED, the
clock effects are GAME RULE, and nothing moves the real clock.

## Before the judge arrives (once, about 7 minutes, under $0.20)

Everything slow is prepared ahead. The button only starts a simulation.

```sh
# 1. MiroFish backend on :5001 (Herdr pane wR:pC). Only if it is down:
sh doomclock/pipeline/mirofish/backend.sh

# 2. From the repo root. --epoch runs one whole 6-month step end to end (simulation about 75 s, report
#    agent about 4.5 min) and saves it for the report tab; then it arms a fresh simulation for the button.
#    Both use future 1's existing Step 1 knowledge graph; nothing is rebuilt. Keep the Mac awake.
caffeinate -i node doomclock/pipeline/world/live.ts prepare --future=1 --epoch

# 3. The live server the app polls (leave it running in its own pane):
node doomclock/pipeline/world/live.ts serve

# 4. The app, dev server on a fixed port (from doomclock/web):
npx vite --port 5180 --strictPort --host 127.0.0.1
```

What `prepare` writes: `data/world/live/armed.json` (the armed simulation: its id, future, rounds, seeds) and
`data/world/live/epoch/` (the prepared epoch: the replica payload with the finished report). Personas, the
simulation config and the seed post are written from `cast.json` at arm time, no LLM call. Graph memory
updates are off for all live runs (see "Why graph memory is off").

## The two tabs

| Tab | URL | Shows |
| --- | --- | --- |
| Live run | `http://127.0.0.1:5180/?view=engine&live=1` | The armed simulation, the Run live button, then the rounds streaming, then the step result |
| Report | `http://127.0.0.1:5180/?view=engine&live=report` | The prepared epoch at MiroFish's Step 4: a finished report with sections, agent log and console; Step 5 chats with its report agent |

Open both before the judge sits down. The live tab shows "Armed" in the header when the server, the backend
and an unused armed simulation are all there.

## The button flow (what the judge sees)

1. **Armed** (0 s). The Engine tab shows the Step 1 knowledge graph of future 1 on the left and the "Run
   MiroFish live" card on the right: the simulation id, when it was prepared, the backend address, and the
   one **Run live** button (also in the header).
2. **Press Run live.** The server POSTs `/api/simulation/start` on the armed simulation. Within about 10 s the
   first round lands: the Markets desk seed post, then the 32 accounts posting, quoting, liking and following
   on the simulated X, card by card in MiroFish's Step 3 view. The header reads "Running · round n/5"; the
   simulation monitor at the bottom shows the server's log.
   Measured today: round 1 at 10 s, round 3 at 32 s, round 5 at 64 s, simulation end at 85 s; 209 actions,
   126 posts; run cost $0.10 on the key.
3. **Reading out** (about 10–20 s). When the run ends the tab switches to "Step result": the readout model
   lists which posts by accounts with standing count as events (today: 10 kept, 18 rejected), the danger rubric
   is scored from those events (baseline is today's real record), and the engine's rules move this future's
   odds. Phase lines appear in the log as they happen.
4. **Done** (about 105 s after the press). The result pane shows the events with their dates and types, the
   rubric before and after, and the future's 1-in-10 date before and after the step with the same-noise
   rules-off and no-events dates beside it, all marked SIMULATED and GAME RULE. Today: Jun 2032 → Nov 2034
   (rules off Aug 2032, no events Feb 2033).
5. **Interview the world** (optional, Step 5). "Chat with Report Agent" asks MiroFish's report agent, which
   searches the graph and the posts (10–60 s an answer). "Chat with any individual in the world" interviews one
   of the 32 simulated accounts in character; it needs the run's environment, which MiroFish keeps alive after
   a live run until the next `prepare`. On the report tab, Step 5 chats with the prepared epoch's report agent.

The real clock on the World tab is untouched throughout. The World and Inputs tabs still work in the live tab.

## Re-arming for the next judge (one command, about 5 s)

```sh
node doomclock/pipeline/world/live.ts prepare --future=1
```

It closes the previous live run's environment, creates a fresh simulation on the same Step 1 graph, writes
the personas, config and seed again, and the live tab's card switches back to "Armed" on its next 2 s poll (no
reload needed). Add `--epoch` only to make a new prepared report (another 6 minutes). `--future=2` or `3`
uses that future's Step 1 graph instead.

## If it stalls

- **"Live server down"** in the header: the serve process is not running or not on :5055. Restart step 3.
  The app also prints the exact command.
- **Run live greyed out and the card says "already ran"**: re-arm (above).
- **Nothing streams within 20 s**: check the serve pane for "HTTP 409" (the backend thinks that simulation is
  still running; re-arm) or a budget refusal (`budget: refusing … CAP_USD` or `LANE_CAP_USD`; the guard
  reads total key usage, raise with `LANE_CAP_USD=3 node … serve`).
- **The backend is dead** (`curl localhost:5001/api/simulation/list` fails): restart it with
  `sh doomclock/pipeline/mirofish/backend.sh`, re-arm, restart serve.
- **Fallback**: close the live tab and show the recorded Engine tab at `http://127.0.0.1:5180/?view=engine&q=18`
  (or the deployed site), which replays a saved step with no backend. The report tab keeps working as long
  as the serve process is up, because the epoch is read from disk.

## Why graph memory is off for live runs

With `enable_graph_memory_update: true` MiroFish holds a run in STOPPING until Zep Cloud has ingested every
episode; this morning Zep timed out with about 30 episodes pending, the runs were marked FAILED and the report
was refused (board 153, `data/world/logs/2026-10-25-zep-timeout.log`). Live runs therefore start with it off
(the live script sets `GRAPH_MEMORY=0`, the recorder's own switch in `loop.ts`; `GRAPH_MEMORY=1 node … serve`
turns it back on): the run ends cleanly in about 85 s and the report agent still reads the Step 1 graph. The graph panel says so
("Step 1 graph as built · graph memory off"), so the graph does not grow during a live run; the growing graph
is in the recorded replica.

## Known limits

- The live result is a one-step move from today's anchors; it is shown in the Engine tab only and is not fed
  into the World tab's futures or the time bar.
- The rubric of a live run is scored from the read-out events alone (no report is written for the live run,
  the prepared epoch has the report). The prompt says so.
- Interviews work on the latest live run only (its environment stays open); the prepared epoch's environment
  is closed, so its tab offers the report-agent chat but not interviews unless `prepare --epoch` is re-run with
  the current code (which keeps it open).
- Measured costs are key-usage deltas and so upper bounds; other lanes on the same key inflate them.

## Files

- `doomclock/pipeline/world/live.ts`: `prepare` and `serve`. Reuses the recorder's step pieces
  (`record.ts`: personas and sim files, the DB readout, the markets line; `loop.ts`: start body, report
  fetch; `readout.ts`, `report.ts`, `engine/step.ts`: the coupled-loop step) and the budget guard.
- `doomclock/web/src/ui/engine/live.ts`, `LivePanel.tsx`, `live.css`, `EngineScreen.tsx` (the `live` prop),
  `replica/Step5Interaction.tsx` (the live chat and interview), `app/App.tsx` (reads `?live=`),
  `vite.config.ts` (the `/live` proxy), `scripts/check-inert.mjs` and `live.test.ts` (the inertness proof).
