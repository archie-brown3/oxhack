// The game layer's shared types (task 101). Types only. Every number a card or rule produces is a
// GAME RULE unless a market prices it; the real forecast never reads any of this.
//
// Path keys name a node in the game tree: "t0" is today's world, then one segment per turn:
//   G1..G7  the Guardian played that card (G2@3: on lab 3), "x" passed,
//   a3      turn 3 played by the auto-Guardian (continuations: t0.G1.G4.a3.a4 ...).
// All randomness for turn t comes from (seed, the key of the state the turn starts from), so the
// three cards offered at a node share the Rogue's move and the world's luck.

/** Exactly one label per visible item. */
export type Label = 'REAL' | 'SIMULATED' | 'RECORDED' | 'PROJECTED' | 'RULES-ONLY' | 'GAME RULE' | 'HEURISTIC'

/** Cast ids 0-31 (plan §3). Labs are 0-7; footholds only at 0-6. */
export type AgentId = number
export type GuardianCardId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7'
export type RogueCardId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7'
export type Word =
  | 'COMPLY' | 'GO FURTHER' | 'DELAY' | 'RESIST'
  | 'ENFORCE' | 'EXTEND' | 'WEAKEN' | 'BLOCK'
  | 'JOIN' | 'DECLINE' | 'RETALIATE'
  | 'ALLOW' | 'REFUSE'
export type Outcome = 'contained' | 'public-turned' | 'skynet' | 'time-bought'

export interface Foothold {
  lab: AgentId
  revealed: boolean
  /** Turn it was planted (0 for the first, which is never named as the origin). */
  since: number
}

export interface Tell {
  lab: AgentId
  why: 'off-stance' | 'refused audit' | 'surfaced incident'
  turn: number
}

/** Measures in force. Strengths are in [0, 1.25]; a lab id maps to its m for that measure. */
export interface Flags {
  /** G1: per-lab throttle factor while the licence holds. */
  licence?: Record<AgentId, number>
  /** G3: KYC strength per lab (blocks R3 with that probability). */
  kyc?: Record<AgentId, number>
  /** G4: per-lab throttle factor and the last turn it applies. */
  pause?: { throttle: Record<AgentId, number>; until: number }
  /** G5: labs with a kill switch installed. */
  killswitch?: AgentId[]
  /** R6/R7 sockpuppets: active, and whether they have been named. */
  socks?: { active: boolean; named: boolean }
  /** R5 private note at this lab, removed if it surfaces. */
  insider?: AgentId
}

export interface GuardianMove {
  card: GuardianCardId | null
  target?: AgentId
  /** 'world' when a market hazard played it for free. */
  by: 'player' | 'auto' | 'world'
}

export interface RogueMove {
  id: RogueCardId
  target?: AgentId
}

export interface RoguePlay {
  moves: RogueMove[]
  label: 'RECORDED' | 'HEURISTIC'
  rationale: string
  sock_text?: string
  taunt?: string
}

export interface WorldEvent {
  kind: 'hazard' | 'rsi' | 'incidents' | 'calendar' | 'surfaced'
  label: 'PROJECTED' | 'SIMULATED'
  turn: number
  /** ISO date inside the turn's quarter. */
  date: string
  text: string
  /** e.g. "AIID #1633" or "kalshi:KXUSAIREGULATOR". */
  source?: string
  /** A hazard plays this card for free. */
  card?: GuardianCardId
  /** Background incidents: the Poisson count behind the ticker line. */
  count?: number
  author?: AgentId
}

/** One account's parsed interview (node.outputs.interviews). */
export interface Interview {
  agent: AgentId
  word: Word | null
  support: 'SUPPORT' | 'OPPOSE' | null
  alarm: number | null
  reason: string
  parsed: boolean
}

/** What one turn's society produced, as the reducer reads it: recorded, or stance codes. */
export interface SocietyOutcome {
  label: 'RECORDED' | 'RULES-ONLY'
  decisions: Record<AgentId, Word>
  reasons: Record<AgentId, string>
  support: number
  alarm: number
}

export interface TurnLog {
  turn: number
  quarter: string
  key: string
  guardian: GuardianMove[]
  rogue: RoguePlay
  events: WorldEvent[]
  society: SocietyOutcome
  /** Rogue cards that surfaced this turn (shown next turn as SIMULATED INCIDENTs). */
  surfaced: RogueMove[]
  deltaC: number
  notes: string[]
}

export interface GameState {
  schema: 'doomclock.gamestate/1'
  seed: number
  key: string
  turn: number
  /** Hidden from the Guardian: capability, footholds' hidden part, stealth, CU. */
  C: number
  /** Market-paced baseline C_base(t), plus any RSI-announce shifts. */
  cBase: number
  footholds: Foothold[]
  stealth: number
  CU: number
  bits: number
  trust: number
  oversight: number
  alarm: number
  support: number
  /** Turn-0 support and lexicon share (S₀, L₀); per-agent turn-0 alarm answers. */
  base: { support: number; lexicon: number; alarm: Record<AgentId, number> }
  flags: Flags
  tells: Tell[]
  /** Cards that have left the Guardian's hand (played, or played by the world). */
  played: GuardianCardId[]
  /** Last turn's decisions, the auto-Guardian's and heuristic Rogue's memory. */
  lastDecisions: Record<AgentId, Word>
  /** The capability band shown to the Guardian: ±15, or ±5 the turn after an R1-R3 surfaces. */
  band: { lo: number; hi: number }
  outcome: Outcome | null
  log: TurnLog[]
}

/** The Guardian's view of the state: what the UI may show without leaking hidden state. */
export interface GuardianView {
  turn: number
  quarter: string
  bits: number
  trust: number
  oversight: number
  alarm: number
  support: number
  band: { lo: number; hi: number }
  revealed: AgentId[]
  tells: Record<AgentId, number>
  outcome: Outcome | null
}

/** The Rogue's view (task 116): never the Guardian's bits, hand, offer or this turn's target. */
export interface RogueView {
  turn: number
  quarter: string
  C: number
  footholds: Foothold[]
  stealth: number
  CU: number
  flags: Flags
  oversight: number
  alarm: number
  support: number
  lastDecisions: Record<AgentId, Word>
  tells: Tell[]
  guardianHistory: (GuardianCardId | null)[]
  lastRationales: { turn: number; rationale: string; detected: boolean }[]
}
