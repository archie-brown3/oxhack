// Every GAME RULE constant the reducer uses (plan §4-§5), in one place so balance.ts can tune them.
// None of these is a forecast. Card numbers live in data/cards.json; market numbers in hazards.json.
// Tuned by balance.ts on 25 Oct (task 129) from the plan's values: growth base 0.7 -> 0.55, sprint
// 6 -> 4, Rogue CU income 2 + F -> 1 + F, R3 succeeds 25% of the time, audits repeatable, and the
// auto-Guardian audits at 1 tell instead of 2. data/tests/balance.json has the bars and the hash.
import cast from './data/cast.json' with { type: 'json' }
import { hash32 } from './paths.ts'
import type { AgentId, GuardianCardId, Word } from './types.ts'

type CastRow = { id: AgentId; weight?: number | null; activity: number; support?: 'SUPPORT' | 'OPPOSE'; stance: Partial<Record<GuardianCardId, Word>> }
const ACCOUNTS = (cast as { accounts: CastRow[] }).accounts

export const TURNS = 6
export const QUARTERS = ['2027Q1', '2027Q2', '2027Q3', '2027Q4', '2028Q1', '2028Q2']
export const TURN_START = ['2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01', '2028-01-01', '2028-04-01']

/** Market-paced clock: C₀ = 100 × KXAGICO by end 2026, and ΔC_base = 100 × each quarter's step of
 *  the KXAGICO cummax curve (data/market-inputs.json; a test checks the match). */
export const C0 = 6
export const DC_BASE = [12, 10, 5, 6, 19, 15]

export const RULES = {
  /** Cards that stay in the hand after play (a second foothold needs a second order or audit). */
  repeatable: ['G7', 'G2'] as GuardianCardId[],
  /** support: S₀ for RULES-ONLY games, the share of active cast accounts whose code is SUPPORT. */
  start: { CU: 3, bits: 3, trust: 60, stealth: 0.2, alarm: 5, support: castSupport() },
  skynet: { C: 50, footholds: 3 },
  growth: { base: 0.55, perFoothold: 0.15, sandbag: 0.5, sprint: 4 },
  surface: { cap: 0.9, alarmDiv: 20, oversightDiv: 100, sandbag: 0.5 },
  income: { cu: 1, bits: 1, bitsPerSupport: 3, trustPerSupport: 10 },
  tellTurns: 2,
  band: { wide: 15, narrow: 5 },
  alarm: { base: 5, lexicon: 10, lexiconOnly: false, decay: 0.7, surfaced: 1.5, rsi: 1, warning: 1, socks: -0.5, retaliate: 0.5 },
  /** RULES-ONLY society: how stance codes bend when no recorded node exists. */
  rulesOnly: { supportPerAlarm: 0.03, warningSupport: 0.05, sockSupport: -0.1, alarmStepUp: 7 },
  /** "Your timeline" (plan §4): log-odds shifts from game state. */
  line: { asiPerC: 0.02, catPerFoothold: 0.15, catPerOversight: -0.01, contained: -1, skynet: 0.5 },
  /** R3's chance of working where no compute checks run ("success × (1 − KYC)", plan §4). */
  shadowSuccess: 0.25,
  /** Auto-Guardian: audit a lab once it shows this many tells (plan §5: 2). */
  auditTells: 1,
  retaliateTrust: -3,
  rsiC: 5,
}

export interface Lab { id: AgentId; name: string; region: 'US' | 'China'; weight: number; gov: AgentId }

/** Epoch notable-model share, 24 Oct 2024 to 24 Oct 2026, over the 8 labs (plan §3,
 *  derive/weights.ts), read from cast.json; the numbers here are the fallback. */
export const LABS: Lab[] = ([
  { id: 0, name: 'OpenAI', region: 'US', weight: 0.34, gov: 8 },
  { id: 1, name: 'Anthropic', region: 'US', weight: 0.12, gov: 8 },
  { id: 2, name: 'Google DeepMind', region: 'US', weight: 0.17, gov: 8 },
  { id: 3, name: 'Meta', region: 'US', weight: 0.06, gov: 8 },
  { id: 4, name: 'xAI', region: 'US', weight: 0.05, gov: 8 },
  { id: 5, name: 'DeepSeek', region: 'China', weight: 0.06, gov: 12 },
  { id: 6, name: 'Alibaba Qwen', region: 'China', weight: 0.16, gov: 12 },
  { id: 7, name: 'Nvidia', region: 'US', weight: 0.03, gov: 8 },
] as Lab[]).map((l) => ({ ...l, weight: ACCOUNTS.find((a) => a.id === l.id)?.weight ?? l.weight }))
export const FOOTHOLD_LABS: AgentId[] = [0, 1, 2, 3, 4, 5, 6]
export const GOV_NAME: Record<AgentId, string> = { 8: 'US Executive Branch', 12: 'China (CAC)' }

/** The expected decision per card for each decider: the stance codes. Used for RULES-ONLY turns
 *  and for spotting off-stance answers (tells). They come from cast.json (the content lane's dated
 *  positions); FALLBACK_STANCES only fills a decider cast.json leaves out. */
export type Stances = Record<AgentId, Partial<Record<GuardianCardId, Word>>>
export const FALLBACK_STANCES: Stances = {
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

export const STANCES: Stances = { ...FALLBACK_STANCES, ...stancesFrom({ accounts: ACCOUNTS }) }

function castSupport(): number {
  const coded = ACCOUNTS.filter((a) => a.activity > 0 && a.support)
  return coded.length ? Math.round((coded.filter((a) => a.support === 'SUPPORT').length / coded.length) * 1000) / 1000 : 0.45
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

/** A hash of the tuned constants (not the cast-derived S₀, so a cast edit never blocks a build). */
export function constantsHash(): string {
  const { start, ...rest } = RULES
  return hash32(JSON.stringify({ RULES: { ...rest, start: { ...start, support: null } }, DC_BASE })).toString(16)
}
