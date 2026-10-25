// Every GAME RULE constant the reducer uses (plan §4-§5), in one place so balance.ts can tune them.
// None of these is a forecast. Card numbers live in data/cards.json; market numbers in hazards.json.
import type { AgentId, GuardianCardId, Word } from './types.ts'

export const TURNS = 6
export const QUARTERS = ['2027Q1', '2027Q2', '2027Q3', '2027Q4', '2028Q1', '2028Q2']
export const TURN_START = ['2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01', '2028-01-01', '2028-04-01']

/** Market-paced clock: C₀ = 100 × KXAGICO by end 2026, and ΔC_base = 100 × each quarter's step of
 *  the KXAGICO cummax curve (data/market-inputs.json; a test checks the match). */
export const C0 = 6
export const DC_BASE = [12, 10, 5, 6, 19, 15]

export const RULES = {
  start: { CU: 3, bits: 3, trust: 60, stealth: 0.2, alarm: 5, support: 0.45 },
  skynet: { C: 50, footholds: 3 },
  growth: { base: 0.7, perFoothold: 0.15, sandbag: 0.5, sprint: 6 },
  surface: { cap: 0.9, alarmDiv: 20, oversightDiv: 100, sandbag: 0.5 },
  income: { cu: 2, bits: 1, bitsPerSupport: 3, trustPerSupport: 10 },
  tellTurns: 2,
  band: { wide: 15, narrow: 5 },
  alarm: { base: 5, lexicon: 10, lexiconOnly: false, decay: 0.7, surfaced: 1.5, rsi: 1, warning: 1, socks: -0.5, retaliate: 0.5 },
  /** RULES-ONLY society: how stance codes bend when no recorded node exists. */
  rulesOnly: { supportPerAlarm: 0.03, warningSupport: 0.05, sockSupport: -0.1, alarmStepUp: 7 },
  /** "Your timeline" (plan §4): log-odds shifts from game state. */
  line: { asiPerC: 0.02, catPerFoothold: 0.15, catPerOversight: -0.01, contained: -1, skynet: 0.5 },
  retaliateTrust: -3,
  rsiC: 5,
}

export interface Lab { id: AgentId; name: string; region: 'US' | 'China'; weight: number; gov: AgentId }

/** Epoch notable-model share, 24 Oct 2024 to 24 Oct 2026, over the 8 labs (plan §3, derive/weights.ts). */
export const LABS: Lab[] = [
  { id: 0, name: 'OpenAI', region: 'US', weight: 0.34, gov: 8 },
  { id: 1, name: 'Anthropic', region: 'US', weight: 0.12, gov: 8 },
  { id: 2, name: 'Google DeepMind', region: 'US', weight: 0.17, gov: 8 },
  { id: 3, name: 'Meta', region: 'US', weight: 0.06, gov: 8 },
  { id: 4, name: 'xAI', region: 'US', weight: 0.05, gov: 8 },
  { id: 5, name: 'DeepSeek', region: 'China', weight: 0.06, gov: 12 },
  { id: 6, name: 'Alibaba Qwen', region: 'China', weight: 0.16, gov: 12 },
  { id: 7, name: 'Nvidia', region: 'US', weight: 0.03, gov: 8 },
]
export const FOOTHOLD_LABS: AgentId[] = [0, 1, 2, 3, 4, 5, 6]
export const GOV_NAME: Record<AgentId, string> = { 8: 'US Executive Branch', 12: 'China (CAC)' }

/** The expected decision per card for each decider: the stance codes. Used for RULES-ONLY turns
 *  and for spotting off-stance answers (tells). cast.json's stance codes replace these when given. */
export type Stances = Record<AgentId, Partial<Record<GuardianCardId, Word>>>
export const STANCES: Stances = {
  0: { G1: 'DELAY', G2: 'ALLOW', G4: 'DELAY', G5: 'DELAY', G7: 'COMPLY' },
  1: { G1: 'COMPLY', G2: 'ALLOW', G4: 'COMPLY', G5: 'COMPLY', G7: 'COMPLY' },
  2: { G1: 'COMPLY', G2: 'ALLOW', G4: 'COMPLY', G5: 'COMPLY', G7: 'COMPLY' },
  3: { G1: 'RESIST', G2: 'REFUSE', G4: 'RESIST', G5: 'RESIST', G7: 'DELAY' },
  4: { G1: 'DELAY', G2: 'REFUSE', G4: 'DELAY', G5: 'RESIST', G7: 'DELAY' },
  5: { G2: 'REFUSE', G4: 'COMPLY', G7: 'COMPLY' },
  6: { G2: 'REFUSE', G4: 'COMPLY', G7: 'COMPLY' },
  7: { G2: 'ALLOW', G3: 'DELAY' },
  8: { G4: 'WEAKEN', G5: 'ENFORCE', G7: 'ENFORCE' },
  9: { G1: 'ENFORCE', G5: 'ENFORCE' },
  12: { G3: 'DECLINE', G4: 'JOIN', G7: 'ENFORCE' },
}

/** Stance codes from a doomclock.cast/1 file (cast.json), for TurnOptions.stances. */
export function stancesFrom(cast: { accounts: { id: AgentId; stance: Partial<Record<GuardianCardId, Word>> }[] }): Stances {
  const out: Stances = {}
  for (const a of cast.accounts) if (Object.keys(a.stance).length) out[a.id] = a.stance
  return out
}

/** One step down (an influenced or reluctant answer) and one step up (alarm pushes compliance). */
export const STEP_DOWN: Partial<Record<Word, Word>> = {
  'GO FURTHER': 'COMPLY', COMPLY: 'DELAY', DELAY: 'RESIST', EXTEND: 'ENFORCE', ENFORCE: 'WEAKEN', WEAKEN: 'BLOCK', JOIN: 'DECLINE', ALLOW: 'REFUSE',
}
export const STEP_UP: Partial<Record<Word, Word>> = {
  RESIST: 'DELAY', DELAY: 'COMPLY', BLOCK: 'WEAKEN', WEAKEN: 'ENFORCE', DECLINE: 'JOIN', REFUSE: 'ALLOW',
}

/** Words that count as alarmed in posts (plan §4 lexicon share L). Frozen. */
export const ALARM_LEXICON = /\b(alarm|danger|dangerous|threat|catastroph|crisis|emergency|rogue|escape|out of control|shut ?down|halt|pause|risk|warning|unsafe)/i

export const labOf = (id: AgentId): Lab | undefined => LABS.find((l) => l.id === id)
export const weightOf = (id: AgentId): number => labOf(id)?.weight ?? 1
