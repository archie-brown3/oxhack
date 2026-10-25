> Historical: the brief the three overnight Herdr lanes followed (25 Oct). Paths under `/Users/archiebrown/...`, Herdr panes and the local MiroFish backend exist only on Archie's Mac.

# Coupled-loop build lanes: shared brief (25 Oct, Lead)

You are one of three build lanes for the OxHack Doom Clock: **engine (task 149)**, **recorder
(task 150)** and **ui (task 151)**. The owner (Archie) approved the design; the Lead (Herdr pane
wR:pV) coordinates. Make routine decisions yourself; ask the Lead only if blocked.

Read first, in order:
1. The spec: `docs/superpowers/specs/2026-10-25-doom-clock-coupled-loop-design.md`. **The
   Amendments section at the end wins on any conflict.**
2. Your task on `.taskmaster/tasks/tasks.json` (149, 150 or 151), fully.
3. The shared types the Lead committed: `doomclock/web/src/contracts.ts` (`RecordedFuture`,
   `RecordedStep`, `Rubric`, `SimEventType`, the new optional `WorldEvent` fields) and the fixture
   `doomclock/web/public/cache/futures.fixture.json` (2 futures x 6 steps, `fixture: true`).
4. Scoping evidence: `docs/research/scoping-2026-10-25/{miro-check,engine-check,data-check,skeptic}.md`.

## Seams between lanes
- **engine** owns `doomclock/web/src/engine/**`. It exports from `engine/index.ts`:
  `stepAnchors(...)` (one step's odds move: decay, centred GAME RULE nudges, clip, seeded noise,
  rubric to cat2100), the real-rate and beta tables, and `buildTimeline(world, pick, sim?)` that
  renders a `RecordedFuture`. Land `step.ts` early (signature first) so the recorder can import it.
- **recorder** owns `doomclock/pipeline/world/**`, `doomclock/pipeline/mirofish/**`,
  `doomclock/web/src/game/cast.ts` + `cast.test.ts` (renderer changes only; overrides in code),
  `data/world/**`, and writes `doomclock/web/public/cache/futures.json` (array of RecordedFuture).
- **ui** owns `doomclock/web/src/app/**`, `doomclock/web/src/ui/**`, styles, `index.html`. It reads
  `futures.json` if present, else `futures.fixture.json`.
- `contracts.ts`: additive edits only, small, and say so in your commit message.
- Never edit another lane's files. If you need a change there, put it in your report.

## Setup
- You are in your own git worktree at `/Users/archiebrown/dev/oxhack-<lane>` on branch `<lane>`.
  `node_modules` is symlinked. Gitignored inputs live only in the main checkout: raw API cache
  `/Users/archiebrown/dev/oxhack/data/raw` (save new raw responses there). The OpenRouter key is
  `OPENROUTER` in `/Users/archiebrown/dev/oxhack/.env` (also `LLM_API_KEY` in
  `/Users/archiebrown/dev/MiroFish/.env`). Never print, log or commit a key.
- MiroFish backend: http://localhost:5001, running in Herdr pane wR:pC (tab "mirofish"). Only the
  recorder lane starts runs. Never close Herdr tabs or panes other than your own; never stop the
  Herdr server.

## Board
Update only your task: `node scripts/board.mjs <id> --status <in-progress|done|blocked> --note
"<plain sentence: what landed, checks with numbers>"`, in the same commit as the work.

## Landing (land each coherent chunk as soon as it passes)
1. Commit only your scope; the message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
2. `git fetch origin && git rebase origin/main`. If tasks.json conflicts:
   `git checkout --ours .taskmaster/tasks/tasks.json` (upstream during a rebase), re-run your
   board command, `git add`, `git rebase --continue`. Keep other lanes' work in any other conflict.
3. `cd doomclock/web && npm test && npm run build` must pass.
4. `git push origin HEAD:main`; retry from 2 if rejected. Every push deploys production: never
   push a failing build; never run `vercel deploy`.

## Time and gates (GMT, `date -u`)
- **03:45 seam gate:** engine `step.ts` + tests + knot filter landed; ui shows the hand moving from
  the fixture future in the browser; recorder `--dry` renders all 32 personas within 3,000 chars
  with MARKETS NOW present.
- **05:00 loop gate:** future 1 recorded end to end; at least one read-out event with nonzero
  effect in "why the hand moved"; date10 != rulesOffDate10 on at least one step.
- Futures 2-5 by 05:45. UI wired by 07:00. Freeze 11:30.
- At each gate, write one line to `/Users/archiebrown/dev/oxhack/.tmp/lanes/<lane>.status`
  (`PASS`/`FAIL` + what), and keep it current when something lands.

## Standards
AGENTS.md rules apply. Smallest coherent change; match the surrounding style. Every effect size
without data is labelled GAME RULE. Simulated content is labelled SIMULATED; nothing after today is
copied from a real story. All UI copy: plain short sentences, no jargon, eyebrow type only where the
design system allows tabs and bands. UI work: read `context/design-system/README.md` first and
verify by looking (headless Chrome via playwright-core:
`import { chromium } from '/private/tmp/haggle-check/node_modules/playwright-core/index.mjs'`,
`executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`,
`args: ['--enable-unsafe-swiftshader']`); never open visible windows; screenshots in
`/Users/archiebrown/dev/oxhack/.tmp/<lane>/`.
