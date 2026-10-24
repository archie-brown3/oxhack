# Doom Clock: build plan (OxHack 2026)

Destination in the repo: `docs/superpowers/plans/2026-10-24-doom-clock-build-plan.md`. Written Sat 24 Oct 2026, ~17:55 BST, from the repo snapshot (`CLAUDE.md`, `.claude/skills/{lead,judging-criteria-review}`, `.tmp/grokbot/*`, `doomclock/pipeline/`, `.lavish/`, `context/`, `docs/superpowers/specs/`). It replaces the P1/P2/P3 plan (pass 3 is kept at `/tmp/PLAN.pass3.md` on the Grok Bot box).

**This plan coordinates; the specs define.** When this plan and a spec disagree, the spec wins, and the Lead fixes this file. The specs are:

| Spec | Path | Owner | State at 17:55 BST |
|---|---|---|---|
| Engine (A) | `docs/superpowers/specs/2026-10-24-ai-doom-clock-design.md` | Lead (edits by engine) | Exists. **Stale** in places: 24 monthly turns, the old leakage rules (T set from the resolution date; "resolved after the cutoff"), model not chosen. §10 lists the fixes |
| Backtest | `docs/superpowers/specs/2026-10-24-doom-clock-backtest-design.md` | backtest | Being written (Archie: "Gemini 2.5 Flash, write the spec") |
| Game layer (B) | `docs/superpowers/specs/2026-10-24-doom-clock-game-layer-design.md` | game-design | Being written, with w>0 and w=0 branches ("write the spec with both branches") |
| Globe UI | `docs/superpowers/specs/2026-10-24-doom-clock-globe-ui-design.md` (name proposed) | ui | Not started; waits on Archie's Lavish answers (Q1) |

**Time.** It's now ~17:55 BST. Hacking ends **Sun 12:00 GMT**. Clocks go back at Sun 02:00 BST, which becomes 01:00 GMT, so about **19 h of wall clock** are left. Times are **BST until 02:00 BST, then GMT**, and every time carries its label.

**The budget is agent wall-clock time plus Archie's review time.** The agents work in parallel and keep going overnight. Two things are scarce:
- **The Lead's serial review and commit loop.** Each task below includes about 10 min of Lead review.
- **Archie's attention.** About 3.5 h of review in total (§7), plus sleep, plus the Devpost workshop.

The decision queue for Archie is kept to six items (§9.2).

**Guiding rule (unchanged).** The **real line** is computed only from Manifold markets, the panel and `w`:

p = logit⁻¹(logit(pMarket) + w·mean dlogit)

No card, meter, MiroFish post or Kalshi price touches it. **Your timeline** is the real line plus the effects of cards and events. The HRT case rests on the real line and the backtest; the game is labelled game rules.

**Words.**
- A **turn** is one quarter. A full game is **12 turns, Q1 2027 to Q4 2029**. The **demo** is **4 turns, Q1–Q4 2027**.
- A **world year** is 4 turns and gets one MiroFish run with a fresh brief. A full game has 3 world years; the demo has 1.
- A **bit** is the card currency: a card costs **−log₂(p)**, where p is its market's price.

---

## 1. Owners and write scopes

Write scopes don't overlap. To change a file outside its scope, an agent asks the Lead. Only the Lead commits, using explicit paths (lead skill). Code agents work in the main checkout. A worktree is used only if two agents must touch one file, which this table is designed to prevent.

| Owner | Herdr tab | Writes (only) | Reads | Role |
|---|---|---|---|---|
| **Lead** | t1 (currently untitled "claude", cwd `~/dev`; rename to `lead` and `cd ~/dev/oxhack`) | git commits; `.taskmaster/`; `CLAUDE.md`; `docs/superpowers/plans/`; `doomclock/web/src/contracts.ts` (the shared types, §5); the engine spec | everything | Dispatches, reviews, commits and runs the gates. Takes screenshots for UI review. Spawns a fresh **reviewer** for non-trivial code |
| **backtest** | t5 (`backtest`) | backtest spec; `doomclock/pipeline/backtest/**`; `data/backtest.json`; `data/backtest/**` | parse libraries, panel | Question set, T rule, split, baselines, scoring and the leakage canary. Owns the warning-sign Brier headline |
| **game-design** | (`game-design`) | game-layer spec; `data/cards.json`; `doomclock/web/src/game/**` (pure reducer + tests) | market and signal inputs, card reactions | Rules, cards, meters, face-down/detection, expiry, the heuristic Rogue, the 4-turn demo seed and time-bought-per-bit |
| **ui** | (`ui`, "Doom Clock globe interface") | globe-ui spec; `.lavish/**`; `doomclock/web/src/ui/**`; `doomclock/web/public/geo/**`, `public/fonts/**` | contracts, fixtures | Globe (globe.gl), HUD, card tray, Track record view, end/replay. Owns the UI design (CLAUDE.md) |
| **data-markets** | (`data-markets`) | `doomclock/pipeline/fetch/{manifold,kalshi,polymarket}.ts`; `doomclock/pipeline/parse/{manifold,kalshi,polymarket}.ts`; `doomclock/pipeline/markets.json` (pins; `manifold.ts` already reads it); `data/raw/{manifold,kalshi,polymarket}/**`; `data/market-inputs.json` | — | Downloads; point-in-time `priceAt(id, T)`; pins; Kalshi AGI curve; card prices; Polymarket origin-lab odds |
| **data-signals** | (`data-signals`) | `doomclock/pipeline/fetch/{hn,epoch,metr,aiid,rss,arxiv,wikipedia}.ts`; `doomclock/pipeline/parse/{same}.ts`; `data/raw/{those}/**`; `data/signal-inputs.json`; `data/SOURCES.md` | — | HN headlines at T; the AIID event rate; Epoch region weights; the datacentre list; RSS for the ticker; licences |
| **engine** (new) | spawn 18:00 BST | `doomclock/web/src/engine/**` (`sim.ts`, `fanBand.ts`); `doomclock/pipeline/{panel,state,opponent}/**`; `doomclock/pipeline/{refresh,server}.ts`; `data/state.json`; `data/state.last-good.json`; `data/card-reactions.json` | parse libraries, cards | The Monte Carlo, the 3-persona panel (also used by backtest), `state.json`, the server, the LLM Rogue, and card reactions |
| **mirofish** (new) | spawn 18:00 BST | `doomclock/pipeline/world/**`; `data/rounds/**`; `data/world-setup.json`; `~/dev/MiroFish/.env` (keys from Archie) and that repo's sim configs | cards, game history | Install, spikes S1/S2, 12 archetypes, yearly briefs, runner, pre-bake, LLM fallback |
| **web** (new) | spawn 18:00 BST | `doomclock/web/{package.json,vite.config.ts,index.html,tsconfig*.json}`; `doomclock/web/src/{main.tsx,app/**,api.ts,fixtures/**}`; `doomclock/web/scripts/**` (`publish:cache`); `doomclock/README.md`; `out/devpost/**` | everything | Scaffold, fixtures, glue (the provider calls `sim.ts` twice a turn), auto/offline mode, build, Devpost draft, final ship |
| **reviewer** (spawn per review) | short-lived | nothing (read-only) | diffs | Fresh-eyes review of non-trivial code before the Lead commits |
| **doom-clock-concept-page** | t4, idle, cwd `~/dev` | nothing new | — | Close it unless Archie has more for it (Q6) |
| **Archie** | — | Notion edits, keys, money, pushes | — | Decisions (§9.2), keys (OpenRouter, Zep, the MiroFish LLM), spec reviews, Devpost and demo |

`web/` at the repo root (Haggle) stays frozen; changing it needs Archie's approval.

---

## 2. Already done (don't redo)

| Item | Who | Evidence |
|---|---|---|
| ✅ 10 fetchers + `lib/raw.ts` (raw cache, retry/backoff, resumable, no dependencies, plain `node` v26) | data-markets / data-signals | `doomclock/pipeline/fetch/*.ts` |
| 🔄 Raw download, **in progress** | data-markets / data-signals | `data-files.txt`, 410 files at ~17:4x BST: aiid 49 (snapshot 2026-10-19, extracted); kalshi 226 (series + markets, **no candles yet**); manifold 76 (**search pages only**: no `markets/` or `bets/` yet); polymarket 29 (**lists only**: no events or prices); epoch 3; metr 6; wikipedia 16; rss 3; hn 1; arxiv 1. Both agents' screens were empty in the snapshot, so their live state is unverified |
| ✅ Panel model: **`google/gemini-2.5-flash` via OpenRouter**, for the panel, the blind-LLM baseline and the Rogue opponent | Archie | OpenRouter `/api/v1/models` read from the Grok Bot box at ~17:5x BST: `knowledge_cutoff` 2025-01-31, $0.30/M input, $2.50/M output (self-reported) |
| ✅ Backtest design: baselines coin, base rate, market and blind LLM; paired Brier with a block bootstrap; split at 1 Jan 2026; leakage canary; cutoff + 1 month ≤ T; T chosen without the outcome | Archie + backtest | backtest agent screen; spec in writing |
| ✅ Game-layer decisions | Archie + game-design | game-design screen; spec in writing. Details: quarterly turns (12 + a 4-turn demo); market cards at −log₂(p) bits; 4 game-rule meters; no tech tree, cards expire at their market's deadline; 5 Guardian and 4 Rogue cards, the Rogue face-down; capability baseline = the Kalshi AGI curve; regions US 0.58 / China 0.30 / rest 0.12 (Epoch); MiroFish with 12 archetypes on one Zep graph and a fresh brief each year, plus an LLM fallback; Rogue origin lab from Polymarket; warning events at the AIID rate; card effects from the panel if w>0, fixed disclosed numbers if w=0 |
| ✅ Notion Data section (8 sources, endpoints, what each feeds, scraping strategy) | backtest (Archie asked) | backtest screen |
| ✅ Globe mockups (3 styles × 3 layouts, datacentre "Monopoly houses") and a Plague Inc UI board (9 patterns) | ui | `.lavish/globe-options.html`, `.lavish/plague-board.html` |
| ✅ Context research | earlier sessions | `context/*.md` |

**Removed as superseded:**
- The P1/P2/P3 owners and hour budgets.
- `moves.json` and its 10 moves. Market cards replace them.
- 24 monthly turns and 6-turn cycles.
- The capital formula (D11).
- gpt-4.1-mini (old D3).
- "No map" (old D16).
- The training-cutoff spike (old S3).
- The move-data-hooks spike (old S6).
- UI-PREP's U0–U6/F0/G0 tasks. `ui/UI-PREP.md` is now input only; the Herdr ui agent owns the UI.

---

## 3. Tracer bullet: **CP1, Sat 22:00 BST**

Thinnest end-to-end path, offline from the raw cache:

1. **data-markets** pins the 4 engine anchors in `markets.json` (ASI by 2030/2040/2100 and cat2100; IDs are TBD until pinned) and exposes `priceAt(id, now)` from `data/raw/manifold`.
2. **engine** builds `data/state.json` from them, with no panel yet: `w = 0`, `stale` set, `asOf` set.
3. **web** runs `npm run publish:cache` and the app loads the state.
4. `sim.ts` returns the real line. The UI shows the countdown and the two-line chart (yours = real at turn 0).
5. The **ui** globe renders **offline** with Natural Earth 110m and the region tint.
6. One hard-coded Guardian card with a fixed `game_rule` effect, then **End turn**. The quarter advances, the yours-line and the globe tint move, and the real line does not.

**Done-check (Lead):**
- `npm run build && node doomclock/pipeline/server.ts`.
- A headless screenshot before and after End turn.
- The same run with networking off.
- The required tests pass: sim determinism and hitting the market points.

---

## 4. Tasks

Estimates are **agent wall-clock**, including the Lead's review. "Dep" is what must land first; anything with a dep starts on fixtures from **W1** if the dep is late. Every task has a done-check the Lead runs before committing.

### Lead (L)

| ID | Task | When | Est | Done-check |
|---|---|---|---|---|
| L0 | Rename tab t1 to `lead`, `cd ~/dev/oxhack`. Commit this plan to `docs/superpowers/plans/`. Fix `CLAUDE.md`: model = Gemini 2.5 Flash; turns = quarters; globe (and the camera note); raw-file naming (§10, item 8). Put §4 on `.taskmaster/` | 18:00 BST | 0.5 h | `git show --stat` lists only these paths |
| L1 | Spawn **engine**, **mirofish** and **web** with briefs (goal, write scope from §1, done-check, "ask before paid calls"). Name the tabs | 18:05 BST | 0.25 h | `herdr agent list` shows the names |
| L2 | Write `doomclock/web/src/contracts.ts` from §5 (types only). Agents propose changes, and the Lead edits | 18:30 BST | 0.5 h | `tsc --noEmit` passes; web fixtures type-check |
| L3 | Gates CP1–CP4 (§7) and the commit loop. Fresh **reviewer** for `sim.ts`, the panel, the backtest scorer and the game reducer | continuous | — | — |
| L4 | **Pre-registration note** `docs/superpowers/plans/backtest-prereg.md`: T rule, split, metrics and headline wording, committed **before** B4's paid run (§12, objection 2) | 23:30 BST | 0.25 h | The commit timestamp is before B4 |

### backtest (B). Spec defines method; this is the sequence

| ID | Task | Dep | Est | Done-check |
|---|---|---|---|---|
| B0 | Write and self-review the backtest spec; Archie reviews | — | 0.75 h (by ~19:00 BST) | Spec covers the T rule without the outcome and T ≥ cutoff + 1 month. With cutoff 2025-01-31, **T ≥ 2025-03-01** (unverified that OpenRouter's date is exact; use the later date if the provider page differs). Split at 2026-01-01; canary; baselines |
| B1 | Question set + T per question, from DM2's `priceAt` and resolved lists | DM2 (fixture first) | 1.5 h | N train / N test printed. No question uses a bet, news item or description dated after T |
| B2 | Baselines: coin; base rate (train YES share); market at T; blind LLM (title only, no price; Gemini). Calls the engine panel via `runPanel()` (E3) | E3 | 1.5 h | Required test: price-at-T and Brier on a fixture |
| B3 | Paired Brier deltas with a block bootstrap; `w` grid on train, scored on test; 5-bin reliability; leakage canary; `outcomeMix`; warning-sign subset headline → `data/backtest.json` (shape in spec) | B2 | 1.5 h | A dry run on 20 questions with mocked LLM answers produces the full JSON |
| B4 | **Paid run** (Q2 approves the cap). About 1,000 questions × (3 personas + blind) ≈ 4,000 calls ≈ **$4–6** at list price with reasoning off (estimate) | B3, L4, Q2 | ~1 h unattended | Cost logged; `backtest.json` committed |
| B5 | Notion "Why it fits HRT" fix (old leakage rules), only if Q3 = yes | B0 approved | 0.25 h | Archie sees the diff text first |

Total ≈ 6.75 h. B4 runs overnight.

### data-markets (DM)

| ID | Task | Dep | Est | Done-check |
|---|---|---|---|---|
| DM0 | Finish the downloads: Manifold `markets/` + `bets/`, Kalshi candles, Polymarket events + prices. Report counts to the Lead | running | — | Counts per folder |
| DM1 | Pin `doomclock/pipeline/markets.json`: 4 engine anchors + warning signs (most traders wins); Kalshi AGI series; 9 card markets (from the game-design packet); Polymarket "best model" for the origin lab | game-design card list (GD0) | 1 h (anchors by 20:30 BST, cards by 21:30 BST) | Every ID resolves on the live API; no invented IDs; question text and deadline copied |
| DM2 | Parse libraries: `priceAt(id, T)` from bets/candles/prices strictly before T; resolved-question lists with `resolvedAt` and outcome | DM0 | 2 h | Fixture test: a known bet sequence gives the expected price at T, and nothing after T is read |
| DM3 | `data/market-inputs.json`: the Kalshi AGI curve **monotonised** (cummax; the live curve dips, 2031 78% < 2030 81%, per `context/ai-doom-data.md`) and interpolated per quarter; card `pNow`; origin-lab odds | DM1, DM2 | 1 h | Curve non-decreasing; every card has p and `asOf` |
| DM4 | Live refresh for pinned IDs only (`/api/refresh` calls it) | DM1 | 0.5 h | Two runs give two raw files; the last-good fallback works |

Spikes S3 and S5 are also DM's (§6). Total ≈ 5.25 h.

### data-signals (DS)

| ID | Task | Dep | Est | Done-check |
|---|---|---|---|---|
| DS0 | Finish the HN, arXiv and Wikipedia downloads | running | — | Counts |
| DS1 | `headlinesAt(T, k)`: HN stories with `created_at ≤ T − 2 d`. Points are measured at fetch time; the 2-day lag limits that leak, and it's disclosed | DS0 | 1 h | Fixture: no story after T − 2 d |
| DS2 | AIID warning-event rate per quarter (incidents dated 2025-01 → 2026-09) → `signal-inputs.json` | — | 1 h | λ and its window printed; the method is in `SOURCES.md` |
| DS3 | Reproduce the region weights from `epoch/notable_ai_models.*.csv`; document the metric (model count or compute share?). The **0.58/0.30/0.12** values come from game-design and are **unverified** | — | 0.75 h | The script prints the three weights; if they differ, flag it to the Lead |
| DS4 | **Datacentre list for the globe.** Nothing in `data/raw` has locations. The mockup houses (Ashburn, Abu Dhabi, Riyadh, Johannesburg) are illustrative. Find an API/CSV source (e.g. an Epoch data-centre dataset, if one exists; unverified), or a hand list with a source URL per row, labelled | — | 1 h | Every row has lat/lon + source, or the globe drops houses |
| DS5 | RSS snapshot for the ticker; `data/SOURCES.md` with each source's licence/terms (Manifold, Kalshi, Polymarket, HN, AIID, Epoch, METR, Wikipedia, Natural Earth) | — | 0.75 h | The Lead reads it |

Total ≈ 4.5 h.

### engine (E). Engine spec + §5 define

| ID | Task | Dep | Est | Done-check |
|---|---|---|---|---|
| E1 | `sim.ts`: seeded 10k paths, 6-node CDF, lag, `p_bad`; `SimResult` | fixture state | 2 h (by 21:00 BST) | **Required:** determinism (same seed, same output) and the CDF hitting the market points within 0.01; < 50 ms on the laptop |
| E2 | `state.json` builder from DM2 + last-good fallback with timestamp | DM1 anchors | 1 h (by 21:30 BST) | Kill the network: the last-good file is served with `stale: true` |
| E3 | Panel: 3 personas, Gemini 2.5 Flash, strict JSON, **reasoning off**, timeouts. `runPanel(asOf, questions, headlines)` is exported for backtest | DS1 (fixture first) | 2 h | **Required:** bad JSON → zero nudge; a 5-call smoke test ≤ $0.05 |
| E4 | `server.ts` (`node:http`): serves `web/dist`, `POST /api/refresh`, `POST /api/opponent`, `POST /api/world/next`, `GET /api/world/:year` | E2 | 1 h | curl each route; offline returns cache |
| E5 | LLM Rogue opponent: state in, `{cardIds[], taunt}` out; picks face-down cards within its bits budget; heuristic fallback from GD3 | S4, GD2 | 1.5 h | 20 calls: p95 and invalid-JSON rate recorded |
| E6 | `card-reactions.json`: for each card, a synthetic headline ("<market question> — happened, <quarter>") → panel dlogits. Used only when `w > 0` | E3, DM1 | 0.5 h | 9 cards × 3 personas; cost logged |
| E7 | Fan band p10/p50/p90 on the real line ("model assumption") | E1 | 0.75 h | < 200 ms; cut first if late |

Spike S4 is also engine's. Total ≈ 9.25 h.

### game-design (GD). Game-layer spec defines

| ID | Task | Dep | Est | Done-check |
|---|---|---|---|---|
| GD0 | Write the spec with both branches; save the council packet into the repo (it lives in `/private/tmp/claude-501/...`, which is not durable). Archie reviews | — | 1 h (by ~19:00 BST) | Spec has cards, meters, expiry, face-down/detection, win/lose, the demo seed, and both effect branches |
| GD1 | `data/cards.json`: 5 Guardian + 4 Rogue, market refs from DM1, `priceBits`, `expiresAt`, effects for both branches, `firmCriteria` from S5 | DM1, S5 | 0.5 h | No card expires before Q1 2027, or else it's flagged |
| GD2 | Pure reducer `game/`: quarters; bits budgets; meters; expiry; face-down plays + detection; AIID-rate events (seeded); origin lab sampled from Polymarket odds; regions; capability baseline from the Kalshi curve; win/lose | GD1, DM3, DS2/DS3 (fixtures first) | 3 h | Unit tests: a 12-turn game with the stub opponent finishes 100/100 seeds; the real line is never read-modified |
| GD3 | Heuristic Rogue (fallback for E5) | GD2 | 0.5 h | Deterministic per seed |
| GD4 | Demo seed: 4 turns, a scripted face-down Rogue play on turn 2 that detection reveals on turn 3 | GD2 | 1 h | Same screen sequence on 3 runs |
| GD5 | Attribution: time bought per bit for each card (end screen, HRT decision) | GD2 | 1 h | Sums match the yours-minus-real gap |

Total ≈ 7 h.

### ui (U). Globe-ui spec defines

| ID | Task | Dep | Est | Done-check (Lead screenshots) |
|---|---|---|---|---|
| U0 | Globe-ui spec from Archie's Lavish answers (Q1) + the plague board. Stop the background Lavish poll once Q1 is answered | Q1 | 1 h (by ~19:30 BST) | Archie reviews |
| U1 | Globe in Vite: `react-globe.gl`/globe.gl with `three` imported directly (the Lavish built-in-three workaround doesn't carry over); Natural Earth 110m bundled; region tint; datacentre houses (DS4) grey/red/blue; arcs animate once and then settle | W1 | 2.5 h | First render < 2 s offline; ≥ 30 fps while rotating; works with wifi off |
| U2 | HUD: yours countdown (hero) vs real (small); two-line chart; meters strip (Guardian oversight vs Rogue capability, Plague lesson 2); alarm stage label; quarter + year header; ticker | W2, E1 | 2 h | Words: "catastrophe", never "takeover" (the Lavish mock says "takeover in"); meters say "game rule" |
| U3 | Card tray: each card shows its market question, p, **bits**, expiry quarter, effect source (panel or game rule), source link; face-down Rogue "?" pins on the globe, revealed on detection | GD1, W2 | 2 h | Hotkeys 1–5, Enter = End turn, R = Reset |
| U4 | Track record view (backtest table, CIs, reliability, warning-sign headline) and a **Model** drawer holding the **p_bad slider**. Lavish cut "sliders" from the game screen, but the slider stays here | B3 fixture | 1.5 h | Slider moves both lines; an off-default value badges the real line |
| U5 | End/replay: dated card list for both sides + the two lines replayed, with markers | GD5 | 1.5 h | Plague lesson 9 |
| U6 | Perf + polish pass (12 px minimum at 1440×900; one colour per side) | all | 1 h | Lead screenshots at CP3 |

Total ≈ 11.5 h. This is the longest chain; it runs through the night.

### web (W)

| ID | Task | Dep | Est | Done-check |
|---|---|---|---|---|
| W1 | Scaffold `doomclock/web` (Vite + React + TS), deps vendored for offline use, `npm run publish:cache` copying `data/*.json` into `public/cache/` | L2 | 0.75 h (by 19:00 BST) | `npm run build` works offline |
| W2 | Fixtures for every §5 file + a contract test; `api.ts` + `GameProvider` (calls `sim.ts` on real and on yours each turn) | L2, W1 | 1.5 h (by 20:30 BST) | The contract test fails on drift |
| W3 | Tracer integration | E1, E2, U1, U2 | 0.5 h (21:30 BST) | CP1 |
| W4 | Auto mode (health check at load and each turn; silent fallback to cache and the heuristic opponent) + `?offline=1` | E4 | 1 h | Both modes demoed at CP4 |
| W5 | Devpost draft, README, a 60-s video script for Archie, a provenance paragraph from `SOURCES.md` | B3, DS5 | 1.5 h (by 08:30 GMT) | Archie edits |
| W6 | Final ship: refresh, publish, build, `git tag demo` (the Lead commits; tagging is local) | all | 0.5 h (11:15 GMT) | Offline run passes |

Total ≈ 5.75 h.

### mirofish (M)

| ID | Task | Dep | Est | Done-check |
|---|---|---|---|---|
| M0 | Start the backend install immediately (`uv sync` pulls torch + CUDA wheels; the Docker image is the alternative). `.env` at the MiroFish repo root with the keys from Archie (Q4); **don't** set `ZEP_API_URL` | Q4 keys | 0.5 h + background | Backend answers on :5001 |
| M1 | World seed: 12 fictional archetypes (labs, governments, press, public; fictional names), one Zep graph, one prepared sim | S1, S2 | 2 h | One graph id in `world-setup.json` |
| M2 | Runner `world/`: the yearly brief (previous year's cards and events, as headlines) → rewrite `initial_posts`/`hot_topics` + the activity config → force-start → poll `env-status` (10 min cap) → `/posts` (drop seed posts) → `interview/all` → `data/rounds/year-N.json` (ticker + alarm meter only) | M1 | 2 h | ≥ 10 non-seed posts; alarm parsed from ≥ 8 answers |
| M3 | Pre-bake: year 1 (shared, also the demo) + years 2–3 × {guardian_ahead, rogue_ahead} = **5 files**, unattended overnight | M2 | ~2 h unattended | 5 files with `source: cached` |
| M4 | LLM fallback world (Gemini; same JSON, `source: llm-fallback`) | — | 1 h | Works with MiroFish down |

Total ≈ 5.5 h active + background.

---

## 5. Contracts (owners in brackets; detailed shapes live in the specs)

All files have a `schema` field. Probabilities are in [0, 1]; log-odds deltas are named `dlogit`; times are ISO 8601 UTC. `contracts.ts` [Lead] mirrors these.

- **`doomclock/pipeline/markets.json`** [DM]
  - `{ manifold: [{id, role: "anchor|warning|card|backtest", label, url, question, deadline}], kalshi: [{ticker, role: "capability_curve|card"}], polymarket: [{eventId, role: "origin_lab"}] }`
  - `manifold.ts` already reads `manifold[].id` from this path to pull bets for pinned markets.
- **`data/state.json`, `doomclock.state/2`** [engine]
  - As in pass 3, §4.1, with these changes:
    - `panel.model: "google/gemini-2.5-flash"` and `trainingCutoff: "2025-01-31"`.
    - Kalshi removed from `nodes`. It's not on the real line; the game reads it from `market-inputs.json`.
    - `w` comes from `backtest.json`, default 0 until B4.
  - `sim.ts` returns `SimResult`, `doomclock.sim/1`, unchanged: `pCat2100`, nullable `medianCatDate`, `p10Year`, `fan[]` with optional p10/p50/p90, `scenarioMix`, `ms`.
- **`data/market-inputs.json`** [DM]
  - `{ asOf, capabilityCurve: {ticker, rule: "company announces AGI", monotonised: true, quarters: [{q: "2027Q1", p}]}, cardPrices: [{cardMarketId, p, asOf}], originLab: [{lab, region: "US|China|rest", p, source}] }`
- **`data/signal-inputs.json`** [DS]
  - `{ regions: {US, China, rest, metric, source}, warningRate: {perQuarter, window, source: "AIID"}, datacentres: [{name, lat, lon, region, hotel: bool, source}], ticker: [{title, url, date, source}] }`
- **`data/cards.json`, `doomclock.cards/1`** [game-design]
  - One entry per card:
    - `id` and `side: "guardian|rogue"`.
    - `title` and `blurb`.
    - `market: {source: "manifold|kalshi", id, url, question, deadline}`.
    - `p` (from `cardPrices`, clamped to [0.02, 0.98] so the price stays ≤ 5.64 bits) and `priceBits = −log₂(p)`.
    - `expiresAt` = the market deadline. A card can't be played in a quarter that starts after it.
    - `faceDown` (true for every Rogue card) and `detection: {meter, threshold}`.
    - `effect: {source: "panel|game_rule", meters: {capability, oversight, trust, alarm}, regionWeights?, dlogit?: {asi, cat}}`. `dlogit` applies to yours only.
    - `firmCriteria: bool` and `criteriaNote` (from S5).
  - The branch is picked at load: `w > 0` → the `dlogit` comes from `card-reactions.json`; `w = 0` → the fixed numbers in this file, labelled game rule.
- **`data/card-reactions.json`** [engine]
  - `{ model, asOf, cards: [{cardId, headline, personas: [{name, status, dlogit: {asi, cat}}], meanDlogit}] }`
- **Game state, `doomclock.game/2`** [game-design; defined in the spec]
  - `quarter` (0–11, or 0–3 in the demo), `year`.
  - `bits: {guardian, rogue}` (income rule in the spec).
  - `meters` (all `game_rule`).
  - `hand`, `faceDownPlayed[]`, `detected[]`, `events[]` (AIID-rate draws).
  - `originLab`, `history[]` (per turn: cards played, bits spent, meter deltas, the yours `dlogit`, ticker lines), `seed`.
- **`data/rounds/year-N[-storyline].json`, `doomclock.world/2`** [mirofish]
  - As in pass 3, §4.4, with `cycle` → `year` and `source: live|cached|llm-fallback`.
  - The alarm feeds **only** the `alarm` meter; government responses move meters only.
- **`data/backtest.json`** [backtest]
  - The shape is in the backtest spec. The UI needs at least:
    - `scores.test.{coin, baseRate, market, blindLlm, panel}.{brier, ci95}`.
    - Paired diffs with CIs.
    - `wChosen`, `reliability[]`, `headline.text`.
    - `leakage.canary` result and `n.{train, test}`.
    - `model.trainingCutoff`, `split: "2026-01-01"`.

**Contract-change rule.** Propose the change to the Lead. The Lead edits `contracts.ts` and the fixtures (W2) in one commit, and the contract test catches drift.

---

## 6. Spikes (18:00–19:30 BST, in parallel)

| # | Spike | Owner | Timebox | PASS → | FAIL → |
|---|---|---|---|---|---|
| S1 | **Time one MiroFish world run end to end.** Use the verified flow from pass 3: ontology → build → create → prepare → `start {platform: twitter}` → poll `env-status` (Twitter-only writes no `actions.jsonl`) → `/posts` → `interview/all`. Split setup time from per-run time. Unverified: whether camel accepts an OpenRouter slug | mirofish | 60 min | Per run ≤ 45 s (a world year is ~40–60 s of play): live, pipelined one year ahead | 45 s – 10 min: **C1**. Nothing by 19:30 BST or no Zep key: **C2** at CP1 |
| S2 | **Zep reuse.** Create on an existing `graph_id`; force-start after rewriting `initial_posts`/`hot_topics`. Fix the activity: `minutes_per_round: 60`, `off_peak_hours: []`, `active_hours` 0–23 for every agent, `agents_per_hour` 10/20 (hour 0 is off-peak by default). Check for ≥ 10 non-seed posts | mirofish | 30 min | One setup; each year = edit the config + force-start | **C1** |
| S3 | **Kalshi rules.** Full rules for the AGI series used for capability (`KXAGICO-COMP` per `context/ai-doom-data.md`; **not in the 17:4x BST inventory**, so check the series name) and for each Kalshi card (`KXUSTAKEOVER`) | data-markets | 20 min | Rules recorded in `markets.json` `criteriaNote`; the curve is labelled "announcement" | Swap in another curve, or use a game-rule baseline, labelled |
| S4 | **Opponent latency.** 20 calls, Gemini 2.5 Flash, reasoning off, temperature 0, the real prompt | engine | 30 min | p95 ≤ 3 s: call on End turn | 3–8 s: prefetch one turn ahead. > 8 s or > 10% bad JSON: **C3** |
| S5 | **Do the containment-escape and datacentre-sabotage (and exfiltration) markets resolve on firm criteria?** Read each card market's resolution text, resolver, deadline and liquidity; also check that every card's deadline falls after Q1 2027 | data-markets + game-design | 30 min | `firmCriteria: true`: keep as a priced card | Replace with a firm-criteria market from the raw cache, or keep the card labelled "no firm market: game-rule price" (**C10**) |

**Spike review at 19:30 BST** (Lead, 10 min); results recorded inline here. Dropped: the training-cutoff spike (the cutoff comes from OpenRouter, and the canary covers leakage).

---

## 7. Timeline and gates

| When | Gate / event | Archie's time |
|---|---|---|
| Sat ~17:55 BST | Plan delivered | — |
| **18:00 BST** | L0–L1. Archie answers Q1–Q6 (§9.2) and pastes the keys (Q4). M0 install starts | 10 min |
| 18:00–19:30 BST | Spikes S1–S5. B0, GD0 and U0 specs written. W1 scaffold. E1 starts on a fixture | — |
| **19:00–19:45 BST** | **Spec review:** backtest (15), game layer (15), globe UI (10). After the review, the Lead turns approved specs into §4 tasks on the board | 40 min |
| 19:30 BST | Spike review. Decide **C1** | — |
| **22:00 BST** | **CP1: tracer** (§3). Decide **C2** | 10 min (screenshot) |
| 23:30 BST | L4 pre-registration committed. Archie OKs the B4 spend (if Q2 isn't pre-approved) | 5 min |
| **Sun 01:00 BST** (first pass) | **CP2**: a 12-turn game works against the heuristic Rogue on the w=0 branch. The globe shows regions, houses and "?" pins. One world year (live or fallback) is in `rounds/`. B4 is running. Decide **C9** (globe perf) | 15 min |
| **Sun 02:00 BST → 01:00 GMT** | **Clocks go back.** Every time after this is GMT; timers are unaffected; log timestamps repeat an hour | — |
| ~01:30–06:00 GMT | **Archie asleep.** Agents continue: B4, M3 pre-bake, U3–U5, GD4–GD5, E5–E7, the reviewer. The Lead commits but doesn't push, and queues every ask-Archie item | — |
| 02:00 GMT | Decide **C3** (LLM Rogue) | — |
| 04:00 GMT | M3 collected; decide **C1b** | — |
| **06:00–06:30 GMT** | **Morning review:** `backtest.json` + `wChosen`. This sets the card-effect branch automatically. Check that the Track record copy is honest. Decide **C4** | 20 min |
| **07:30 GMT** | **CP3: features in.** Decide **C5**, **C6**, **C-x** | 10 min |
| **08:00 GMT** | **CP4:** run the §8 demo with wifi off and with wifi on | 20 min |
| **08:30 GMT** | **Feature freeze.** Fixes, copy and the Devpost only. Decide **C7** | — |
| 09:00–10:00 GMT | Devpost workshop, room C1 (Archie); W5 draft ready | 60 min |
| **10:30 GMT** | Rehearsal 1, with a stranger as the judge. Decide **C8** | 20 min |
| 11:15 GMT | Rehearsal 2 + W6 ship (`git tag demo`) | 20 min |
| **11:45 GMT** | **Devpost submitted** (Archie) | 10 min |
| 12:00 GMT | Hacking ends. Judging 13:00–15:45 GMT | — |

**Archie total ≈ 3 h 40 min**, including the workshop. The longest agent chains:
- ui: ≈ 11.5 h from 18:00 BST to ~06:30 GMT, with dependency waits.
- engine: ≈ 9.75 h.
- game-design: ≈ 7 h.

All fit before CP3 (≈ 14.5 h of wall clock from 18:00 BST to 07:30 GMT), with the overnight hours as slack.

---

## 8. Cut lines, in order

| # | Trigger | Cut | Fallback |
|---|---|---|---|
| C1 | 19:30 BST: S1 per-run time > 45 s, or S2 fails | Live MiroFish years | Pre-baked `rounds/` chosen by storyline; one live run in the background with a "brewing" badge |
| C1b | 04:00 GMT: fewer than 5 pre-baked files | Missing years | M4 fills the gaps, badged `llm-fallback` |
| C2 | 22:00 BST: no completed MiroFish run, or no Zep key | MiroFish | M4 world + HN/RSS ticker; the pitch drops "simulated society" |
| C3 | 02:00 GMT: S4/E5 p95 > 8 s or > 10% bad JSON | LLM Rogue | GD3 heuristic; cached taunts |
| C4 | 06:30 GMT: B4 lacks panel rows, or N test < 40 | Panel rows | Coin / base rate / market / blind-LLM table, `w = 0`, panel "not run". Pitch: "the data didn't earn the agents a vote" |
| C5 | 07:30 GMT: `/api/refresh` fails > 1 in 5 | Live refresh | Cached state with its timestamp |
| C6 | 07:30 GMT: the 12-turn game fails 3 runs in a row | Full game | The **4-turn demo only**. If that fails too: the Doom Clock + Track record without the game |
| C9 | 01:00 BST (CP2): globe first render > 3 s or < 30 fps on the demo laptop | Houses, arcs, hex dots | Style A solid countries, tint only. Last resort: a flat equirectangular map with the same layers |
| C10 | S5: a card market has no firm resolution criteria | That card's market price | A firm-criteria replacement; otherwise the card keeps a game-rule price, labelled |
| C-x | 07:30 GMT: detection not done | Face-down Rogue | Rogue cards play face-up; drop the reveal beat |
| C7 | 08:30 GMT: the Doom Clock can't run §8 offline | Doom Clock | Haggle (`web/`, frozen) |
| C8 | 10:30 GMT: the stranger reads it as a stunt, or can't say what the real line is | Game-first opening | Open on Track record + the two lines |

---

## 9. Decisions

### 9.1 Decided (no action)

| # | Decision | Was |
|---|---|---|
| D1 | Turns are quarters: 12 turns (Q1 2027–Q4 2029) plus a 4-turn demo (Q1–Q4 2027) as the judge default. One MiroFish world per year | 24 monthly turns, 6-turn cycles |
| D2 | Countdown = median catastrophe date among doomed paths, with P(by 2100) and the P10 year under it; yours is the hero, real is small beside it | unchanged |
| D3 | **Gemini 2.5 Flash via OpenRouter** (cutoff 2025-01-31) for the panel, the blind baseline, card reactions, the Rogue and the M4 fallback. Reasoning off | gpt-4.1-mini |
| D5 | The judge plays the Guardian; Rogue is selectable | unchanged |
| D7 | Several markets match → the one with the most traders, ID recorded | unchanged |
| D8 | Kalshi is never on the real line. In the game it prices Kalshi cards and sets the capability baseline (labelled "announcement market") | display-only |
| D10 | Win/lose: defined in the game-layer spec | capital rule |
| D12 | Auto offline mode + `?offline=1` | unchanged |
| D16 | **The globe** (globe.gl, offline Natural Earth 110m) with region tint, datacentre houses (grey operating, red compromised, blue audited; Ashburn and Abu Dhabi are "hotels") and face-down "?" pins. Style and layout: Q1 | no map |
| D17 | End turn button; no speed controls (the plague board's "speed" idea is dropped); hotkeys | unchanged |
| D18 | "Catastrophe", never "takeover"/"extinction" | unchanged; the Lavish mock still says "takeover" (§10) |
| D19 | Market copy: Manifold rows "feed the forecast"; Kalshi/Polymarket rows "price the game" | Kalshi "display only" |
| D21 | Fan band = model assumption, real line only (E7) | unchanged |
| D22 | `publish:cache` copy step (W1) | unchanged |
| D23 | Cards: market price at −log₂(p) bits; no tech tree; expiry at the deadline; 5 Guardian + 4 Rogue; the Rogue is face-down | moves.json |
| D24 | Card effects: the panel's reaction to a synthetic headline if `w > 0`; fixed disclosed game-rule numbers if `w = 0`. Picked at load from `backtest.json` | effectSize game_rule |
| D25 | Backtest method as the backtest spec defines it (§2); the countdown is never claimed as scored | T = resolvedAt − 30 d |

### 9.2 Archie's queue (6 items; defaults hold if there's no answer by 18:30 BST)

| # | Question | DEFAULT |
|---|---|---|
| Q1 | Globe style and Play layout (the open Lavish queue) | **Style A (solid dark countries) + datacentre houses + face-down "?" pins; Layout A (full-bleed globe, small docked HUD; chart and cards slide up, per the plague board).** This is the ui agent's recommendation; houses on A need a check in U1 |
| Q2 | OpenRouter spend cap | **$25 total** (B4 ≈ $4–6 estimated, plus panels, reactions, the Rogue and the fallback). The Lead pauses paid jobs at $20 and asks |
| Q3 | Fix the Notion "Why it fits HRT" section (old leakage rules)? | **Yes**, done by the backtest agent after the spec is approved; Archie sees the text first |
| Q4 | Keys + MiroFish LLM | **Archie pastes OpenRouter and Zep keys into `.env` files himself. MiroFish uses `openai/gpt-4o-mini` via OpenRouter** (cheap at volume; MiroFish isn't scored, so its cutoff doesn't matter) |
| Q5 | Prize tracks | **HRT** (main). **MLH Gemini** only if its rules accept calls via OpenRouter (unverified; W5 checks). **Skip Delta** (not built with Delta) |
| Q6 | Overnight autonomy | **Yes:** the Lead may dispatch, review and commit locally while Archie sleeps; no push, no new spend beyond Q2, no Notion. Close the idle `doom-clock-concept-page` agent |

---

## 10. Conflicts and stale context the Lead must fix

1. **`CLAUDE.md` says the model is "not chosen yet."** It's Gemini 2.5 Flash (L0).
2. **The engine spec is stale:** 24 monthly turns, the old leakage rules, and no model. Patch it, or add a header that points to the backtest and game-layer specs (L0, Lead).
3. **Notion "Why it fits HRT"** still has the old leakage rules (Q3). The Notion "replay from 1 Jan 2025" is also wrong now: the earliest T is ~2025-03-01.
4. **The card branch depends on `w`, which lands only at ~06:00 GMT.** Both branches must be built and tested; E6 runs regardless.
5. **Kalshi's role changed** (old D8, display-only). It's now in the game, never on the real line. `KXAGICO-COMP` is missing from the 17:4x BST inventory (S3).
6. **UI conflicts.**
   - The Lavish mock uses "takeover" (D18) and "political capital" (now **bits**).
   - Lavish cuts sliders from the game, but the plan keeps the p_bad slider in a Model drawer (U4).
   - The plague board proposes speed controls (D17 says no).
   - `UI-PREP.md`'s flat map conflicts with the globe; it's input only.
   - The globe camera always looks at the centre, so houses near the centre read as blocks (U1: a tilted camera or bigger models).
7. **Region weights 0.58/0.30/0.12 are unverified.** The Epoch files on disk are model lists (`all_ai_models`, `notable_ai_models`), not compute by country (DS3). **No datacentre location data exists** (DS4).
8. **Raw-file naming vs `CLAUDE.md`** (`data/raw/{source}/{fetched_at}.json`). HN names files by window start, Kalshi by `live_0`/`hist_0`, Manifold by search key, and resumable fetchers skip existing files. So re-fetches don't keep a dated copy. Either amend `CLAUDE.md` ("one file per request key; fetch time in the file") or add `fetched_at`. DM/DS decide; the Lead amends.
9. **HN `points>50` is measured at fetch time**, a mild look-ahead in the backtest. DS1 lags by 2 days, and it's disclosed. The canary should include it.
10. **Data scope overlap risk.** Both data agents write under `data/raw/` and `pipeline/fetch/`. §1 splits by source. The ui pane capture showed HN raw files being created; confirm only data-signals runs `hn.ts`.
11. **Lead and concept-page agents have cwd `~/dev`, not `~/dev/oxhack`.** Relative paths in their briefs will miss.
12. **Game-design's council packet is in `/private/tmp/claude-501/...`.** Copy it into the repo (GD0) before a reboot or cleanup.
13. **The ui agent has a background Lavish poll running**, and its pane shows an open "autocompact" dialog. Archie should answer it; the Lead shouldn't send keys into that pane blindly.
14. **Card expiry vs horizon.** Any card market with a deadline before Q1 2027 (e.g. "by end of 2026") can never be played (S5).
15. **Plague Inc screenshots** (© Ndemic) are for internal reference only; never put them in the Devpost (W5).

---

## 11. Two-minute judge demo (4-turn demo seed, offline-capable)

**Setup.** `localhost:8787/`, auto mode. `?offline=1` with wifi off if the venue is bad. Demo seed loaded; Guardian.

| t | Say / do | Screen |
|---|---|---|
| 0:00 | "The Doomsday Clock is one opinion a year. Ours runs on real prediction markets." Point at the countdown and the globe | Countdown ticking; the globe tinted by region (US/China/rest) |
| 0:10 | "Each card is a real market. A likely event is cheap, a long shot is expensive: the price is −log₂ of its probability, in bits." The judge plays **pause** (example from the packet: 43% → 1.2 bits), then **End turn** | Within 5 s: the quarter advances, the yours-line moves off the white real line, houses turn blue |
| 0:30 | "The white line never moves when you play. That's the backtested forecast; you're playing the gap." Quarter 2: the Rogue plays face-down | A red "?" pin pulses on the globe |
| 0:50 | Quarter 3: a detection card reveals it | Newsflash card (closes itself after ~4 s); the house turns red |
| 1:05 | "The world is a simulated society. Its alarm moves the meters, never the forecast." | Ticker + alarm stage label |
| 1:15 | Hover a card: market link, p, bits, "effect: panel reaction" or "effect: game rule". Open Model and drag **p_bad** | Both lines move |
| 1:30 | **Track record:** "We replayed the forecaster with only what was known at each date. The model's cutoff is Jan 2025; we scored on questions from 2026 that it couldn't have seen. Coin, base rate, market, blind LLM, our panel. The data chose w = X." Point at the **warning-sign Brier** headline | Brier table with CIs, reliability, the canary passing |
| 1:45 | End screen: "Which card bought the most time per bit." | Ranking + replay |
| 1:55 | "Your turn to break it." Press **R** | Turn 0 in < 1 s |

---

## 12. Critic pass: judging-criteria review (Sat ~17:55 BST)

**Sitrep.**
- What exists: data fetchers, a partial raw cache, three specs in progress, and globe mockups.
- What doesn't: no app code, no `markets.json`, no state, no backtest numbers.
- The plan is tracer-first; the HRT evidence lands at ~06:00 GMT.

| Criterion | Status in this plan | Gap → fix |
|---|---|---|
| HRT: an honest baseline beaten out of sample | Coin, base rate, market and blind LLM; split at 2026-01-01; paired CIs | Beating the market is unlikely. Fix: pre-register the headline (L4), and treat "w = 0, panel ≈ market" as a valid finding (C4 copy). The warning-sign subset is the headline |
| HRT: calibration | 5-bin reliability (B3, U4) | n per bin is small: show n and CIs |
| HRT: a decision with a measurable cost | Bits = −log₂(p) per card; time bought per bit (GD5); `w` chosen by Brier out of sample | The cost must be on the card and on the end screen (U3, U5) |
| HRT: provenance, licences, leakage, splits | Raw cache + pins + canary + T ≥ cutoff + 1 month | Licences were missing → **DS5 `SOURCES.md`**. HN points look-ahead → DS1 lag (§10.9). The raw naming gap → §10.8 |
| Delta: speed 30% | — | Perf budget added: first render < 2 s, ≥ 30 fps, sim < 50 ms (U1, E1, C9) |
| Delta: technical 25% / innovation 25% / polish 20% | Globe + market-priced cards + a backtested forecaster | Not entering Delta by default (Q5); the same qualities serve HRT judges |
| Lands in seconds | The 4-turn demo is the default; the globe click is the first action | No start screen; the overlay closes on the first click (U2) |

**Three objections a judge will raise:**
1. **"Card effects are invented."** Fix: every card shows its effect source (panel or game rule). With w = 0 the numbers are fixed and published in `cards.json`; the real line is untouched. (+0.25 h U3, already in the estimate.)
2. **"You tuned until it looked good."** Fix: L4 pre-registration is committed before the paid run, and the canary result is shown. (+0.25 h Lead.)
3. **"The globe is decoration."** Fix: the tint comes from the Epoch-derived weights × the capability meter, and the houses come from a sourced list (DS4); otherwise they're dropped. The tooltip names the source. (+1 h DS4, in the estimate.)

**PM call.** Protect these, in order:
1. The tracer.
2. The backtest and the Track record view.
3. The 4-turn demo on the globe.

Cut, in order: live MiroFish, then hex/houses polish, then the 12-turn mode.

**Still unverified.**
- All MiroFish timings (S1/S2).
- Whether camel accepts an OpenRouter slug.
- The Zep free-tier capacity.
- The Kalshi series name and rules (S3).
- The firm criteria of the card markets (S5).
- The region weights (DS3).
- Any datacentre data source (DS4).
- OpenRouter's cutoff and prices (self-reported).
- The B4 cost estimate.
- Whether MLH Gemini accepts OpenRouter.
- The live state of both data agents (empty screens in the snapshot).
