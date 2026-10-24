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
 * `sim.ts` output, schema `doomclock.sim/1`. Owner: engine (`src/engine/sim.ts`).
 * Plan §5: `pCat2100`, nullable `medianCatDate`, `p10Year`, `fan[]` with optional p10/p50/p90,
 * `scenarioMix`, `ms`. The shape is not a file; the provider runs it on the real line and on yours.
 * ASSUMPTION: types below, including `fan[].p` as cumulative P(catastrophe by `year`) (engine spec §4, §6),
 * `p10Year` nullable like `medianCatDate`, and `scenarioMix` keys from engine spec §4.
 * `p10Year` is the year cumulative P crosses 10% (engine spec open question 2).
 */
export interface SimResult {
  schema: 'doomclock.sim/1'
  /** P(catastrophe by 2100). */
  pCat2100: Prob
  /** Median catastrophe date among doomed paths. Null when no path is doomed. */
  medianCatDate: IsoTime | null
  /** Year cumulative P first reaches 10%. Null if it never does. */
  p10Year: number | null
  fan: FanPoint[]
  scenarioMix: ScenarioMix
  /** Run time in ms. */
  ms: number
}

export interface FanPoint {
  year: number
  /** Cumulative P(catastrophe by year). */
  p: Prob
  /** Fan band (model assumption; real line only, E7). */
  p10?: Prob
  p50?: Prob
  p90?: Prob
}

/** Share of paths per scenario. Sums to 1. */
export interface ScenarioMix {
  noAsiBy2100: Prob
  asiFine: Prob
  fastCatastrophe: Prob
  slowCatastrophe: Prob
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

export type BaselineName = 'coin' | 'baseRate' | 'market' | 'blindLlm' | 'panel'

/**
 * `data/backtest.json`. Owner: backtest. The full shape is in the backtest spec (not written yet).
 * This draft has only the minimum the UI needs, per plan §5.
 * ASSUMPTIONS:
 * - `schema` is `doomclock.backtest/1` (the plan gives none).
 * - `panel` can be null for "panel not run" (plan cut C4).
 * - Paired-diff and reliability field names are guesses.
 */
export interface BacktestFile {
  schema: 'doomclock.backtest/1'
  model: { id: string; trainingCutoff: string }
  /** Date split, "2026-01-01". Earlier half picks `w`, later half reports the score. */
  split: string
  n: { train: number; test: number }
  scores: { test: Record<Exclude<BaselineName, 'panel'>, Score> & { panel: Score | null } }
  /** Paired Brier deltas (block bootstrap). */
  pairedDiffs: PairedDiff[]
  /** The weight the data chose, on the train half. */
  wChosen: number
  reliability: ReliabilityBin[]
  headline: { text: string }
  leakage: { canary: { passed: boolean; note: string } }
}

export interface Score {
  brier: number
  ci95: [number, number]
}

export interface PairedDiff {
  /** Brier(a) − Brier(b); negative means `a` is better. */
  a: BaselineName
  b: BaselineName
  delta: number
  ci95: [number, number]
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
