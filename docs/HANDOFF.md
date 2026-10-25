# Doom Clock: handoff to the cloud session (25 Oct 2026, 02:55 GMT)

Hacking ends **12:00 GMT**. Freeze **11:30**, Devpost submission by **11:45** (owner). The clocks
have gone back; use GMT/UTC (`date -u`). The previous handoff is in git history.

## 1. Start here: the task board is the source of truth

**Read `.taskmaster/tasks/tasks.json` before anything else.** Every remaining task is there, with
its scope, dependencies, checks, and, in its latest dated notes, exactly what landed (commit shas),
what is half-done (file paths) and the precise next step. **The latest notes beat the description
and the status.** This handoff only orients you; when it and the board disagree, the board wins.

- Read it with `tasks --once` (CLI) or directly. Update it with
  `node scripts/board.mjs <id> --status <pending|in-progress|done|blocked> --note "<what, checks, numbers>"`,
  in the same commit as the work. Commit and push board changes with the work.
- `master` holds the live tasks. The `archive` tag holds the cancelled ones (the dropped game,
  old scopes). Don't work on archived tasks.
- Work order: unblocked tasks first, in the order below, following each task's notes.

## 2. What to read next (referenced, not repeated)

- `AGENTS.md` (CLAUDE.md links to it): rules for data, labels, leakage, tests. Its intro has the
  current plan.
- **Spec:** `docs/superpowers/specs/2026-10-25-doom-clock-coupled-loop-design.md`. Three layers:
  body → Amendments → Amendments 2; **the later layer wins** on any conflict.
- Scoping evidence behind the spec: `docs/research/scoping-2026-10-25/`.
- The brief the overnight lanes followed (landing protocol, seams between engine / recorder / ui):
  `docs/lanes-brief.md`.
- Brief and decisions: Notion "⏰ Doom Clock",
  https://app.notion.com/p/45a9a3b74a37472884408f8b9eafd39b. The talk lives in Archie's Obsidian
  vault (note "Oxhack Presentation", only on his Mac); the deck is in `docs/presentation/`.
- Design system before any UI work: `context/design-system/README.md`.

## 3. Where things stand

The product: one forecast, three scenarios. Today's clock reads real prediction-market odds; the
backtest scores them (Brier 0.085 vs coin 0.250 on 1,186 later questions, w = 0 for a blind LLM,
5/5 leakage checks; `data/backtest.json`). Three futures are meant to be played forward on real
MiroFish; their events nudge the "when" odds and MiroFish's report sets "how dangerous", by
labelled GAME RULE effects. Nothing moves the real clock. The Engine tab is a 1:1 replica of
MiroFish's UI; the World view has a live news feed with severity-driven legibility.

- **Done and on `main`:** the engine for the loop (task 149), the World view on recorded futures
  with the simulated clock, switcher, feed and severity tiers (151, mostly), the replica's five
  cut-order items (155, on stand-in data), the recorder's persona renderer, read-out, rubric,
  baseline and Step 1 script (150/152, partly), the real backtest, Track record, walkthrough,
  globe, offline build, iframe embedding. `npm test` (125) and `npm run build` pass.
- **No future has been recorded.** Future 1's Zep graph build stalled (task 152 note has the
  diagnosis and the fix). The app runs on **labelled stand-in data**:
  `doomclock/web/public/cache/futures.fixture.json` (2 hand-made futures) and
  `public/cache/replica/spike` (the 24 Oct spike run). It loads real data automatically once
  `public/cache/futures.json` and `public/cache/replica/<future>/` exist.
- **Blocked in the cloud (need Archie's Mac):** 152, 153, 154, 156. They need the local MiroFish
  backend (Herdr pane `wR:pC`, `:5001`, `sh doomclock/pipeline/mirofish/backend.sh`), the
  OpenRouter and Zep keys, and `data/raw`. Their notes say how to resume there.

## 4. What the cloud session can do now (check each task's notes first)

1. **151** World view: the next steps in its wrap-up note (re-screenshot the judge path, show the
   report prose labelled SIMULATED in Why → How dangerous).
2. **155** replica: items (b)–(e) in its wrap-up note; headless screenshots of Graph, Split and
   Workbench for Steps 1–4.
3. **150** recorder: the code half of the Amendments 2 rework can be written and unit-tested
   against saved fixtures; running it needs the Mac.
4. **139** release-candidate gate: apply the **fallback** recorded there if no real futures exist
   (stand-in data labelled ILLUSTRATIVE, claims adjusted; never present fixture numbers as
   results). That fallback is a Lead default for Archie to confirm.
5. **17** Devpost draft, README, 60-second demo script: describe what is actually on screen at
   submit time; every number traces to a file. Don't submit (owner, 142).
6. **138** label and offline tests, **9** demo-able gate, **141** play-through fixes by 10:30.
7. Owner-only: 140, 142, 143, 144. Prepare everything they need; leave them to Archie.

## 5. Production deploys: fixed (10:30 GMT)

The cloud agent's branch (`cursor/handoff-remaining-f63a`) was fast-forwarded onto main. Its
repo-root `package.json` and `vercel.json` build `doomclock/web` while the dashboard Root Directory
stays `.`. Production https://doomclock-web.vercel.app serves the latest main with
`frame-ancestors *`; a headless walk of the judge path there shows 0 console errors and 0 external
requests (task 141). Final build archived at `~/Desktop/doomclock-final-2026-10-25.zip`.

## 6. Rules that bit us overnight

- **Every push to `main` deploys production (Vercel).** Never push unless
  `cd doomclock/web && npm test && npm run build` passes. Never run `vercel deploy`.
- Rebase before pushing. If `tasks.json` conflicts during a rebase, take upstream
  (`git checkout --ours`), re-run your `board.mjs` command, continue; never drop another task's
  notes.
- Labels: REAL, SIMULATED, RECORDED, PROJECTED, GAME RULE. Fixture and spike data must say so on
  screen. Nothing after today copies a real story. The backtest scores 30-day market calibration
  only, never the loop or the countdown date. The replica must never call
  `/api/simulation/start`.
- Unverified partial work from stopped workflows is on `wip/*` branches (`wip/remove-game`,
  `wip/society-cast-move`, `wip/rogue-llm`, `wip/society-first-salvage`, `wip/strays`). It is not
  on main on purpose; use it only as reference.
- Archie's preferences: short status reports; decide routine things and mark them as defaults;
  check big framing changes with him before building (he stopped two overnight workflows that
  built the wrong thing).

## 7. Suggested skills

- `superpowers:verification-before-completion` before any "done", gate PASS or claim.
- `judging-criteria-review` for the pre-freeze review against the HRT and Delta criteria.
- `ponytail` to cut scope late (Archie uses it).
- `superpowers:systematic-debugging` if the build, tests or replica break.
- `artifact-design` only if a shareable page is asked for.
- `herdr` and `brain` only work on Archie's Mac (Herdr panes, the Obsidian vault).
