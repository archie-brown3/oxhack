// Doom Clock data contracts. Types only: no runtime code.
// DRAFT by web, from docs/superpowers/plans/2026-10-24-doom-clock-build-plan.md §5.
// The Lead reviews and owns this file after the draft (change rule: plan §5).
//
// Each type names its OWNER, the agent who writes the file or value.
// `ASSUMPTION:` marks a shape the plan or specs don't pin down. The Lead should confirm or fix it.
//
// Conventions (plan §5): probabilities are in [0, 1]; log-odds deltas are named `dlogit`;
// times are ISO 8601 UTC; every file carries a `schema` field.

// ---------- shared ----------

/** ISO 8601 UTC time, e.g. "2026-10-24T17:55:00Z". */
export type IsoTime = string
/** Probability in [0, 1]. */
export type Prob = number
/** A log-odds delta. */
export type Dlogit = number
/** A game quarter label, e.g. "2027Q1". */
export type QuarterLabel = `${number}Q${1 | 2 | 3 | 4}`
/** Rogue origin regions. Epoch-derived weights; see SignalInputs.regions. */
export type Region = 'US' | 'China' | 'rest'

/**
 * A headline or ticker line, source-agnostic: HN is dropped and the news source is undecided.
 * `ts` is the ISO time the item became public (CLAUDE.md clean-data rule).
 * ASSUMPTION: `source` is a free-text source id such as "guardian", "nyt", "gdelt", "aiid", "rss:<feed>".
 * Owner: data-signals.
 */
export interface NewsItem {
  title: string
  url: string
  ts: IsoTime
  source: string
}

/** The two panel dimensions a card moves, and what a card effect applies to. Owner: engine / game-design. */
export interface AsiCatDlogit {
  asi: Dlogit
  cat: Dlogit
}

// ---------- markets.json ----------

/**
 * `doomclock/pipeline/markets.json`. Owner: data-markets.
 * ASSUMPTION: plan §5 lists no `schema` field for this file, although it says every file has one.
 * The type has none. The Lead should decide whether to add `schema: "doomclock.markets/1"`.
 */
export interface MarketsFile {
  manifold: ManifoldPin[]
  kalshi: KalshiPin[]
  polymarket: PolymarketPin[]
}

export type ManifoldRole = 'anchor' | 'warning' | 'card' | 'backtest'

/** Owner: data-markets. `manifold.ts` already reads `manifold[].id` from this file. */
export interface ManifoldPin {
  id: string
  role: ManifoldRole
  label: string
  url: string
  /** Question text, copied from the API. */
  question: string
  /** Market deadline (close time), ISO. */
  deadline: IsoTime
  /** ASSUMPTION: S3/S5 record rules in `criteriaNote` (plan §6 S3). It's optional here. */
  criteriaNote?: string
  /** Anchors only: the engine node this market feeds. */
  node?: NodeId
  /** Anchors only: the year the question resolves by. */
  horizonYear?: number
}

/** Owner: data-markets. */
export interface KalshiPin {
  ticker: string
  role: 'capability_curve' | 'card'
  /** ASSUMPTION: card pins carry the same text fields as Manifold pins; plan §5 lists only ticker and role. */
  label?: string
  url?: string
  question?: string
  deadline?: IsoTime
  criteriaNote?: string
}

/** Owner: data-markets. */
export interface PolymarketPin {
  eventId: string
  role: 'origin_lab'
}

// ---------- data/state.json ----------

/** The four engine anchors that feed the real line (plan §3: ASI by 2030/2040/2100 and cat2100). */
export type NodeId = 'asi2030' | 'asi2040' | 'asi2100' | 'cat2100'

export type PersonaName = 'doomer' | 'accelerationist' | 'superforecaster'
/** Panel call outcome. `ok` is a valid reply; everything else gives a zero nudge (CLAUDE.md panel test). */
export type PersonaStatus = 'ok' | 'bad_json' | 'timeout' | 'skipped'

/**
 * `data/state.json`, schema `doomclock.state/2`. Owner: engine.
 * ASSUMPTION: plan §5 defers the field list to "pass 3, §4.1", which isn't in the repo. This shape is
 * inferred from the engine spec §1–§3, §6 and the plan's deltas (model + cutoff, no Kalshi in `nodes`,
 * `w` from backtest.json and 0 until B4, `stale`, `asOf`).
 */
export interface StateFile {
  schema: 'doomclock.state/2'
  /** When the underlying data was read. The UI shows this when `stale`. */
  asOf: IsoTime
  /** True when this is the last-good file served after a failed live fetch. */
  stale: boolean
  /** Panel weight from backtest.json (`wChosen`). 0 until B4. */
  w: number
  panel: StatePanel
  /** The four anchors the Monte Carlo reads. Kalshi is not here. */
  nodes: StateNode[]
  /** Near-term event markets for the warning-sign timeline. Shown only, not fed into the sim. */
  warnings: StateWarning[]
  /** Headlines the panel read at `asOf`. Empty when the panel didn't run. */
  headlines: NewsItem[]
}

export interface StatePanel {
  /** "google/gemini-2.5-flash" */
  model: string
  /** "2025-01-31" */
  trainingCutoff: string
  /** Empty when the panel didn't run (w = 0, offline). */
  personas: StatePersona[]
}

export interface StatePersona {
  name: PersonaName
  status: PersonaStatus
  /** Clamped to ±0.5 per node (engine spec §3). Absent nodes mean no nudge. */
  nudges: Partial<Record<NodeId, PersonaNudge>>
}

export interface PersonaNudge {
  dlogit: Dlogit
  reason: string
  /** The headline cited. ASSUMPTION: the headline URL; the engine spec says only "the headline it cites". */
  cite: string
}

export interface StateNode {
  id: NodeId
  /** Manifold market id (pinned in markets.json). */
  marketId: string
  label: string
  url: string
  /** Year the node's question resolves by, e.g. 2030. */
  horizonYear: number
  /** Raw market price. */
  pMarket: Prob
  /** Mean persona dlogit across `ok` personas. 0 when none. */
  dlogit: Dlogit
  /** logit⁻¹(logit(pMarket) + w · dlogit). The only value `sim.ts` reads. */
  p: Prob
  /** Unique traders at the latest fetch, not at asOf (Manifold gives no trader history). */
  traders: number
  /** Daily closes before asOf. */
  nPrices: number
  lastTradeTs: IsoTime
  /** [lo, hi] of the daily closes in the 12 months before asOf: the market-uncertainty input. */
  pRange12m: [Prob, Prob]
  /** One reading per quarter, 2024Q4 to asOf's quarter. */
  history: AnchorQuarter[]
}

/** priceAt(T) for one quarter. T is the quarter's start, or the window start (2024-10-24) for 2024Q4. */
export interface AnchorQuarter {
  q: QuarterLabel
  T: IsoTime
  p: Prob
  /** The daily close that set p (priceAt's ts), when the pipeline supplies it. */
  ts?: IsoTime
}

export interface StateWarning {
  marketId: string
  label: string
  url: string
  horizonYear: number
  pMarket: Prob
  /** Panel-adjusted, as for nodes. */
  p: Prob
}

// ---------- SimResult ----------

/**
 * `sim.ts` output, schema `doomclock.sim/1`. Owner: engine. `src/engine/sim.ts` holds the types; this
 * re-exports them so there is one source. The sim is internal to the engine: screens read a Timeline.
 */
export type { FanPoint, Scenario, SimResult } from './engine/sim.ts'

// ---------- data/events.json ----------

/** `data/events.json`. Owner: data (build-events.ts). Real events only, sorted by ts. */
export interface EventsFile {
  schema: 'doomclock.events/1'
  asOf: IsoTime
  /** 2024-10-24 ≤ ts < asOf; provenance 'real'; kind never 'post'. */
  events: WorldEvent[]
}

// ---------- data/market-inputs.json ----------

/** `data/market-inputs.json`. Owner: data-markets. Feeds the game, never the real line. */
export interface MarketInputs {
  /** ASSUMPTION: plan §5 lists no `schema` here; added to match "every file has a schema". */
  schema: 'doomclock.market-inputs/1'
  asOf: IsoTime
  capabilityCurve: CapabilityCurve
  cardPrices: CardPrice[]
  originLab: OriginLabOdds[]
}

export interface CapabilityCurve {
  /** Kalshi series, e.g. "KXAGICO-COMP" (unverified, plan §6 S3). */
  ticker: string
  rule: string
  /** True once cummax has been applied. */
  monotonised: true
  /** Non-decreasing in `p`, one per game quarter. */
  quarters: { q: QuarterLabel; p: Prob }[]
}

export interface CardPrice {
  /** Id of the card's market (Manifold id or Kalshi ticker). */
  cardMarketId: string
  p: Prob
  asOf: IsoTime
}

export interface OriginLabOdds {
  lab: string
  region: Region
  p: Prob
  /** Polymarket event id or URL. */
  source: string
}

// ---------- data/signal-inputs.json ----------

/** `data/signal-inputs.json`. Owner: data-signals. */
export interface SignalInputs {
  /** ASSUMPTION: same as MarketInputs; plan lists no `schema`. */
  schema: 'doomclock.signal-inputs/1'
  regions: RegionWeights
  warningRate: WarningRate
  datacentres: Datacentre[]
  /** Ticker lines. ASSUMPTION: plan §5 says `{title, url, date, source}`; this uses `ts` to match NewsItem. */
  ticker: NewsItem[]
}

/** Region weights (0.58 / 0.30 / 0.12 are unverified, DS3) with their metric and source. */
export interface RegionWeights {
  US: number
  China: number
  rest: number
  /** What the weight measures (model count or compute share). */
  metric: string
  source: string
}

export interface WarningRate {
  /** AIID incident rate per quarter (λ). */
  perQuarter: number
  /** ASSUMPTION: plan says only "window" (incidents dated 2025-01 → 2026-09). Months, "YYYY-MM". */
  window: { from: string; to: string }
  source: 'AIID'
}

export interface Datacentre {
  name: string
  lat: number
  lon: number
  region: Region
  /** True for the "hotel" sites (Ashburn, Abu Dhabi). */
  hotel: boolean
  source: string
}

// ---------- data/cards.json ----------

export type Side = 'guardian' | 'rogue'
export type MeterName = 'capability' | 'oversight' | 'trust' | 'alarm'
/** Meter deltas. All four are "game rule", never forecasts. */
export type MeterDeltas = Record<MeterName, number>

/**
 * `data/cards.json`, schema `doomclock.cards/1`. Owner: game-design.
 * ASSUMPTION: plan §5 lists the per-card entry only. The `{schema, cards}` wrapper is assumed.
 */
export interface CardsFile {
  schema: 'doomclock.cards/1'
  cards: Card[]
}

export interface Card {
  id: string
  side: Side
  title: string
  blurb: string
  market: CardMarket
  /** From `cardPrices`, clamped to [0.02, 0.98] so priceBits ≤ 5.64. */
  p: Prob
  /** −log₂(p). */
  priceBits: number
  /** The market deadline. A card can't be played in a quarter that starts after it. */
  expiresAt: IsoTime
  /** True for every Rogue card. */
  faceDown: boolean
  detection: { meter: MeterName; threshold: number }
  effect: CardEffect
  /** From S5: does the market resolve on firm criteria? */
  firmCriteria: boolean
  criteriaNote: string
}

export interface CardMarket {
  source: 'manifold' | 'kalshi'
  /** Manifold id or Kalshi ticker. */
  id: string
  url: string
  question: string
  deadline: IsoTime
}

export interface CardEffect {
  /** `panel`: dlogit comes from card-reactions.json (w > 0). `game_rule`: fixed numbers here (w = 0). */
  source: 'panel' | 'game_rule'
  meters: MeterDeltas
  /** ASSUMPTION: shifts to the region weights, keyed by region. */
  regionWeights?: Partial<Record<Region, number>>
  /** Applies to YOUR timeline only. Never to the real line. */
  dlogit?: AsiCatDlogit
}

// ---------- data/card-reactions.json ----------

/**
 * `data/card-reactions.json`. Owner: engine. Used only when `w > 0`.
 * ASSUMPTION: plan lists `{model, asOf, cards}`; `schema` added. `meanDlogit` is `{asi, cat}`.
 */
export interface CardReactions {
  schema: 'doomclock.card-reactions/1'
  model: string
  asOf: IsoTime
  cards: CardReaction[]
}

export interface CardReaction {
  cardId: string
  /** Synthetic headline: "<market question> — happened, <quarter>". */
  headline: string
  personas: { name: PersonaName; status: PersonaStatus; dlogit: AsiCatDlogit }[]
  meanDlogit: AsiCatDlogit
}

// ---------- game state ----------

/**
 * Phase 2 (task 101): the game layer's types live in `src/game/types.ts` and its file formats in
 * `src/game/data/schemas/` (doomclock.cast/1, doomclock.cards/1, doomclock.node/1). The game's own
 * cards are `src/game/data/cards.json`. `GameState` below and `CardsFile` above are the phase-1
 * drafts that only the fixtures still use; new code imports from `src/game/`.
 */
export type { GameState as GameLayerState, GuardianView, Label, RogueView } from './game/types.ts'

/**
 * Game state, schema `doomclock.game/2`. Owner: game-design (`src/game/**`).
 * ASSUMPTION: the game-layer spec isn't written yet ("defined in the spec"). Fields below come from
 * plan §5's list only; element types are placeholders for game-design to replace.
 * Missing and needed, but unnamed in the plan: whether this is the demo (4 turns) or the full game,
 * and which side the player plays.
 */
export interface GameState {
  schema: 'doomclock.game/2'
  /** 0–11, or 0–3 in the demo. */
  quarter: number
  /** Game year, e.g. 2027. */
  year: number
  bits: { guardian: number; rogue: number }
  /** All four are "game rule". */
  meters: MeterDeltas
  /** Ids of cards the player can play. */
  hand: string[]
  /** Rogue cards played face-down and not yet revealed. */
  faceDownPlayed: FaceDownPlay[]
  /** Card ids revealed by detection. */
  detected: string[]
  /** AIID-rate warning events drawn so far. */
  events: GameEvent[]
  /** Sampled from the Polymarket odds. */
  originLab: { lab: string; region: Region }
  history: TurnRecord[]
  seed: number
}

export interface FaceDownPlay {
  cardId: string
  playedQuarter: number
}

export interface GameEvent {
  quarter: number
  /** ASSUMPTION: free text. */
  label: string
}

export interface TurnRecord {
  quarter: number
  played: { side: Side; cardId: string; bits: number; faceDown: boolean }[]
  meterDeltas: MeterDeltas
  /** The dlogit applied to your timeline this turn. */
  dlogit: AsiCatDlogit
  /** ASSUMPTION: ticker lines are plain strings (they come from MiroFish posts, which have no URL). */
  ticker: string[]
}

// ---------- data/rounds/year-N[-storyline].json ----------

export type WorldSource = 'live' | 'cached' | 'llm-fallback'
export type Storyline = 'guardian_ahead' | 'rogue_ahead'

/**
 * `data/rounds/year-N[-storyline].json`, schema `doomclock.world/2`. Owner: mirofish.
 * ASSUMPTION: plan §5 defers the shape to "pass 3, §4.4", which isn't in the repo. This draft uses
 * only what plan §4 M2 / §5 say: `year`, `source`, "ticker + alarm meter only". The alarm feeds only
 * the `alarm` meter; it never touches the real line. Government responses are not modelled here.
 */
export interface WorldRound {
  schema: 'doomclock.world/2'
  year: number
  /** Present on years 2–3: the pre-baked storyline. Year 1 is shared. */
  storyline?: Storyline
  source: WorldSource
  generatedAt: IsoTime
  /** Non-seed posts. */
  ticker: WorldPost[]
  alarm: {
    /** Parsed from the interview answers. ASSUMPTION: 0–1. */
    value: number
    /** Number of answers parsed (M2 wants ≥ 8). */
    answers: number
  }
}

export interface WorldPost {
  text: string
  /** ASSUMPTION: the archetype that posted. */
  author?: string
}

// ---------- data/backtest.json ----------

export type BaselineName = 'coin' | 'baseRate' | 'market' | 'blindLlm' | 'blend' | 'panel'

/**
 * `data/backtest.json`, written by doomclock/pipeline/backtest/run.ts. Owner: backtest.
 * Design: docs/data/backtest.md. Resolved YES/NO AI questions (Manifold, Polymarket, Kalshi),
 * forecast at T = resolution − 30 days; split by date (train resolved before the cut, test
 * forecast after it). `panel` is null: the news panel is not backtested; `blend` is the market
 * nudged by the blind model with the w picked on train.
 */
export interface BacktestFile {
  schema: 'doomclock.backtest/1'
  /** 'pilot' when the blind model was asked only a sample of the pool. */
  label: 'full' | 'pilot'
  generatedAt: IsoTime
  model: { id: string; trainingCutoff: string; earliestT: IsoTime; promptVersion: number }
  design: { horizonDays: number; minTradersManifold: number; wGrid: number[]; bootstrap: string; baseRate: Record<string, Prob> }
  /** The cut date. Test questions were forecast on or after it. */
  split: IsoTime
  n: { pool: number; scored: number; train: number; test: number; gap: number; events: number; bySource: Record<string, { pool: number; test: number }>; dropped: Record<string, Record<string, number>> }
  llm: { asked: number; parsed: number; parseRate: number }
  scores: {
    test: Record<Exclude<BaselineName, 'panel'>, Score> & { panel: Score | null }
    bySource: Record<string, { n: number; yesShare: Prob; market: Score; coin: Score; baseRate: Score; blindLlm: Score | null }>
  }
  /** Paired Brier deltas on the test half (event-clustered bootstrap). */
  pairedDiffs: PairedDiff[]
  /** The weight the data chose, on the train half. */
  wChosen: number
  w: { chosen: number; trainScores: { w: number; brier: number }[]; trainN: number; test: { blend: Score; market: Score; diff: PairedDiff }; text: string }
  /** Market price reliability on the test half, 10 equal bins, empty ones left out. */
  reliability: ReliabilityBin[]
  reliabilityLlm: ReliabilityBin[]
  headline: { text: string }
  leakage: { canary: { passed: boolean; note: string }; checks: { name: string; passed: boolean; detail: string }[] }
  cost: { usd: number; calls: number; note: string }
  caveats: string[]
}

export interface Score {
  brier: number
  ci95: [number, number]
  n?: number
}

export interface PairedDiff {
  /** Brier(a) − Brier(b); negative means `a` is better. */
  a: BaselineName
  b: BaselineName
  delta: number
  ci95: [number, number]
  n?: number
}

export interface ReliabilityBin {
  lo: Prob
  hi: Prob
  n: number
  /** Mean forecast in the bin. */
  meanForecast: Prob
  /** Share of YES outcomes in the bin. */
  observed: Prob
}

/**
 * `data/tests/t7.json` (task 122, owner: mirofish-world). Only the fields Track record reads;
 * ASSUMPTION: these names, since the producer is not written yet. Shown whatever the result.
 */
export interface T7File {
  /** True if p ≤ 0.05 and the mean difference ≥ 0.15. */
  pass?: boolean
  /** Exact one-sided Wilcoxon signed-rank p. */
  p?: number
  /** Mean treatment − control decision score over the 13 institutions. */
  meanDiff?: number
  /** The claim wording the result supports, as a plain sentence. */
  claim?: string
  [k: string]: unknown
}

// ---------------------------------------------------------------------------
// Timeline [engine produces, ui renders] — phase 1 foundation, extended by the game.
// Phase 1: one timeline, the real forecast replayed and projected quarter by quarter.
// Phase 2: the game applies actions between frames and recomputes a second timeline
// ("yours"); the real one is never modified. So every view renders Timeline, never game state.
// ---------------------------------------------------------------------------

/** Where a frame's content comes from. Shown as a label in the UI. */
export type Provenance = 'real' | 'projected' | 'simulated' | 'player'

/**
 * One dated thing that happened in a quarter (incident, government event, news, X post).
 * Real events are CONTEXT for a frame, never the cause of a clock move: only market moves
 * (ClockDriver) move the real clock, so the UI says "around the same time". Simulated events from
 * the coupled loop move their own future's clock by labelled game rules, never the real one.
 */
export interface WorldEvent {
  ts: IsoTime
  kind: 'incident' | 'government' | 'news' | 'post'
  title: string
  url?: string
  /** 'aiid', 'federal-register', 'gov.uk', 'eur-lex', 'wikipedia', 'bulletin', 'mirofish', 'game', or
   *  'engine' for a projected incident the engine resampled from a real AIID one. */
  source: string
  region?: Region
  provenance: Provenance
  /** The actor: an agency, a lab or a person's role ("US President", "OpenAI"). Shown verbatim. */
  who?: string
  /** Country, ISO 3166-1 alpha-3 ("USA"). */
  where?: string
  /** A turning point: worth a newsflash. */
  major?: boolean
  /** One specific sentence: who did what, where, when. Shown verbatim. */
  detail?: string
  // Simulated events (source 'mirofish', provenance 'simulated') from the coupled loop
  // (docs/superpowers/specs/2026-10-25-doom-clock-coupled-loop-design.md).
  futureId?: number
  step?: number
  /** cast.json account id of the account that posted it. */
  actorId?: number
  /** MiroFish post ids: the event's own post first, then any other reporters. */
  postIds?: number[]
  type?: SimEventType
  binding?: boolean
  severity?: 'minor' | 'moderate' | 'major'
  /** The GAME RULE push this event gave the "when" anchors (centred, before clipping). */
  effect?: { dlogit: Partial<Record<NodeId, Dlogit>>; rule: string }
}

/** The closed event vocabulary of the read-out. 'soft' and 'other' have zero effect. */
export type SimEventType =
  | 'lab-incident-agentic' // agentic or cyber incident at a frontier lab
  | 'incident-misuse'
  | 'incident-other'
  | 'act-accelerating' // binding act that adds compute or removes barriers
  | 'act-restricting' // export control, ban, licensing, a model pulled
  | 'lab-pause'
  | 'agreement' // bilateral or multilateral, by governments
  | 'soft'
  | 'other'

/** The situation report's rubric, each item 0..3 (oversight: 3 = strong). */
export interface Rubric { lossOfControl: number; misuse: number; oversight: number; racePressure: number }

/** One 6-month MiroFish step of one recorded future. */
export interface RecordedStep {
  step: number
  /** The step covers [start, end). */
  start: IsoTime
  end: IsoTime
  /** Anchors after this step's events: quarter 2 of the step reads these. */
  anchors: Record<NodeId, Prob>
  rubric: Rubric
  /** 2-3 sentences quoting only our own numbers. */
  summary: string
  /** Plausible next events from the situation report: expectations, not events. */
  expected: string[]
  events: WorldEvent[]
  topPosts: { postId: number; actorId: number; text: string }[]
  /** 1-in-10 dates (decimal years): this future; same noise with rules off; today's odds, no events. */
  date10: number
  rulesOffDate10: number
  noEventsDate10: number
  /** How many expected events an account with standing then posted. Logged, not shown. */
  followThrough?: number
  readoutOk: boolean
  runId: string
  costUsd: number
  wallS: number
}

export interface RecordedFuture {
  schema: 'doomclock.future/1'
  id: number
  seed: number
  /** True for the hand-made fixture the UI builds against before recordings land. */
  fixture?: boolean
  startAnchors: Record<NodeId, Prob>
  baselineRef: Rubric
  rulesVersion: string
  steps: RecordedStep[]
}

/** The world at the start of one quarter. */
export interface WorldFrame {
  quarter: QuarterLabel
  start: IsoTime
  provenance: Provenance // 'real' if the quarter started before asOf, 'projected' after
  /** Cumulative P(a company announces AGI) by the end of this quarter (Kalshi curve, monotonised). */
  capability: Prob
  /** Share of frontier activity by region; drives the map tint. */
  regions: Record<Region, number>
  /** P(AI catastrophe) by the end of this quarter: today's model, read exactly as the clock reads it (the
   *  10,000 futures agree within 0.01). 0 for quarters already over. */
  pCat: Prob
  /** Events that land in this quarter (map pings + ticker). */
  events: WorldEvent[]
  /**
   * The clock as the markets stood at this frame. Real frames: each anchor's reading for this quarter
   * (AnchorQuarter), read at its T; the market range is the readings in the 12 months to T. Projected
   * frames: today's clock, so only `minutesToMidnight` moves. Null when an anchor has no reading.
   */
  clock: ClockReading | null
  /**
   * Why date10 moved since the previous frame, in days (negative = toward midnight):
   * change = timeDays + sum of drivers' effectDays + residualDays (to rounding).
   * Market moves since the previous frame, largest |effectDays| first. Empty for the first frame.
   */
  drivers: ClockDriver[]
  /** The shift from reading the forecast later at the old prices: the ASI curve restarts at 0 at each
   *  reading, so standing still pushes date10 later. 0 between projected frames. */
  timeDays: number
  /** What the drivers taken one at a time don't explain: their interaction. */
  residualDays: number
  /** Projected and simulated frames: AI incidents expected in the quarter at the real (AIID) rate.
   *  A count, not events: nothing after today is copied from a real incident. */
  incidentsExpected?: number
}

/** One market move behind a change in the clock (leave-one-out: only this anchor moved). */
export interface ClockDriver {
  anchorId: NodeId
  /** The market question, verbatim. */
  label: string
  url: string
  /** Unique traders at the latest fetch (Manifold gives no history). */
  traders: number
  /** Price at the previous frame. */
  from: Prob
  /** Price at this frame. */
  to: Prob
  /** When the price moved: the daily close that set `to` (AnchorQuarter.ts), else when it was read. */
  ts: IsoTime
  /** Shift in date10 from this move alone, after time has passed, the other anchors held at the
   *  previous frame. Negative = toward midnight. */
  effectDays: number
}

/**
 * What the clock shows: a real predicted date, and the hand from 1 minute = 1 year. Every field is
 * read exactly from the model's continuous catastrophe curve (the distribution the 10,000 futures are
 * drawn from), not by counting futures: no sampling jitter, and fast enough for a clock per quarter.
 */
export interface ClockReading {
  /** UTC midnight of the day the chance of AI catastrophe passes 1 in 10 (root of the continuous
   *  CDF). Null: it stays under 1 in 10 through 2100. */
  date10: IsoTime | null
  /** [earliest, latest] date10 over both uncertainties in `date10RangeBy`, shown as an arc.
   *  A null end is past 2100. */
  date10Range: [IsoTime | null, IsoTime | null]
  /** The arc's two inputs, each varied alone. `lag`: the mean lag at 1 y and 10 y. `market`: every
   *  anchor across its 12-month price range (pRange12m). */
  date10RangeBy: { lag: [IsoTime | null, IsoTime | null]; market: [IsoTime | null, IsoTime | null] }
  /** Minutes to midnight on the face: years from the reading's time to date10, floored at 0. */
  minutesToMidnight: number | null
  /** The face's hand in Bulletin seconds: k · minutesToMidnight, with k = the Bulletin's latest setting
   *  / today's minutesToMidnight (85 s → 1 s ≈ 24 days). Today's clock reads exactly the Bulletin's
   *  setting. A display calibration (owner, 24 Oct), not a forecast. Null with date10. */
  secondsToMidnight: number | null
  pCat2100: Prob
}

/** The one Monte Carlo path a timeline plays. */
export interface SampledFuture {
  /** Path number among the 10,000, from 1 ("Future #4,821"). */
  id: number
  /** Its rank by catastrophe date over ALL futures, in [0, 1): 0 is the earliest; futures with no
   *  catastrophe by 2100 rank last, ordered by superintelligence date. */
  percentile: number
  /** When superintelligence arrives in this future; null if not by 2100. */
  asiDate: IsoTime | null
  /** When catastrophe strikes in this future; null if not by 2100. Projected incidents stop here. */
  catDate: IsoTime | null
}

export interface Timeline {
  schema: 'doomclock.timeline/1'
  asOf: IsoTime
  /** Quarterly, 2024Q4 (real) to 2035Q4. */
  frames: WorldFrame[]
  /** Today's clock (anchors at asOf). The same for every future. */
  clock: ClockReading
  /** Which side produced it: 'real' now; the game adds 'yours'. */
  line: 'real' | 'yours'
  future: SampledFuture
}

/**
 * The engine's single input: everything known at `asOf`. `worldFrom()` (src/engine/world.ts) builds it
 * from the data files; the pipeline's asOf(T) can produce it for a past T.
 * `buildTimeline(world, pick)` and `readClock(world)` read nothing else.
 */
export interface World {
  schema: 'doomclock.world-input/1'
  asOf: IsoTime
  /** The p each anchor feeds the Monte Carlo at asOf (StateNode.p). ASI anchors are conditional on
   *  no catastrophe; their knots sit at the market deadlines, 1 Jan 2030 / 2040 / 2100. */
  anchors: Record<NodeId, Prob>
  /** Each anchor's market and its dated prices, for the per-frame clocks and their drivers. */
  anchorHistory: Record<NodeId, AnchorHistory>
  capabilityCurve: CapabilityCurve
  regions: RegionWeights
  /** AIID incident rate; projected frames sample incidents at `perQuarter`. */
  warningRate: WarningRate
  /** Real events, ts < asOf, sorted by ts (data/events.json). */
  events: WorldEvent[]
  /** Mean ASI → catastrophe lag in years. A default (3), not market-backed. */
  lagMeanYears: number
  /** The Bulletin's latest Doomsday Clock setting before asOf, in seconds (85 since Jan 2026). */
  bulletinSeconds: number
}

export interface AnchorHistory {
  /** The market question, verbatim (the node label if markets.json isn't given). */
  question: string
  url: string
  /** Unique traders at the latest fetch. */
  traders: number
  /** [lo, hi] of the daily closes in the 12 months before asOf. */
  pRange12m: [Prob, Prob]
  /** The last daily close before asOf: when today's price was set. */
  lastTradeTs: IsoTime
  /** One reading per real quarter (StateNode.history). Real frames' clocks read these. */
  history: AnchorQuarter[]
}
