// Renders cast.json plus the game's memory into the exact files MiroFish reads (task 109):
// twitter_profiles.csv, the agent_configs and time_config of simulation_config.json, and the
// platform flags of state.json. Pure; runs in the browser and under plain `node`.
// modelled_on and sources never reach a prompt; neither do MBTI, age or gender.

export type Group = 'lab' | 'government' | 'voice' | 'media' | 'tracker' | 'markets' | 'public' | 'sock'
export interface Fact { text: string; ts: string; source: string }
export interface CastAccount {
  id: number; name: string; username: string; group: Group; region: 'US' | 'China' | 'rest'; weight: number | null; activity: number
  /** Guardian card id -> expected decision word (deciders only); support: expected answer on oversight. */
  stance: Record<string, string>; support?: 'SUPPORT' | 'OPPOSE'; goals: string[]; powers: string[]; voice: string; facts: Fact[]
  modelled_on: string; sources: string[]
  /** ISO 3166-1 alpha-3 of the actor, set by loopCast; the read-out copies it into an event's `where`. */
  iso3?: string
}
export interface Cast { schema: 'doomclock.cast/1'; asOf: string; decisions: Record<string, string[]>; accounts: CastAccount[] }

/** What the orchestrator knows going into one node (one MiroFish run). All optional. */
export interface Memory {
  quarter: string // the period, e.g. "2027 H1"
  world?: string[] // shared dated lines, oldest first; the last 6 are shown, each cut to WORLD_LINE chars
  markets?: string // MARKETS NOW: a fixed block, never trimmed
  expected?: string[] // WHAT PEOPLE EXPECT NEXT: a fixed block, never trimmed
  decisions?: Record<number, string[]> // per account, oldest first; the last 4 are shown
  notices?: Record<number, string[]>
  private?: Record<number, string> // only when a covert card targets the account
  activity?: Record<number, number> // overrides cast activity (sockpuppets on, a lab halved)
}

export const MAX_CHARS = 3000
export const WORLD_LINES = 6
export const WORLD_LINE = 120
export const TIME_CONFIG = {
  total_simulation_hours: 5, minutes_per_round: 60, agents_per_hour_min: 32, agents_per_hour_max: 32,
  peak_hours: [] as number[], peak_activity_multiplier: 1, off_peak_hours: [] as number[], off_peak_activity_multiplier: 1,
}
export const MAX_ROUNDS = 5
export const STATE_FLAGS = { enable_twitter: true, enable_reddit: false } as const

const CROWD: Partial<Record<Group, string>> = { voice: 'commentators', public: 'members of the public', sock: 'members of the public' }

/** "Accounts here (User id → name): 0 OpenAI · … · 13–20 commentators · …". Sockpuppets are listed as public. */
export function roster(cast: Cast): string {
  const parts: string[] = []
  const accts = [...cast.accounts].sort((a, b) => a.id - b.id)
  for (let i = 0; i < accts.length; ) {
    const label = CROWD[accts[i].group]
    if (!label) { parts.push(`${accts[i].id} ${accts[i].name}`); i++; continue }
    let j = i
    while (j + 1 < accts.length && CROWD[accts[j + 1].group] === label) j++
    parts.push(j > i ? `${accts[i].id}–${accts[j].id} ${label}` : `${accts[i].id} ${label}`)
    i = j + 1
  }
  return `Accounts here (User id → name): ${parts.join(' · ')}`
}

export const TRACKER = 25
export const WIRE = 21

const block = (title: string, lines: string[]) => (lines.length ? `\n${title}:\n${lines.map((l) => `- ${l}`).join('\n')}` : '')

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t)

/** What this account does with the period (the loop's per-step instruction). */
function task(a: CastAccount): string {
  if (a.group === 'lab' || a.group === 'government')
    return `If you act this period, announce one decision within your powers, with a document number and an effective date.`
  if (a.id === TRACKER || a.id === WIRE)
    return `Report the new AI incidents you learn of this period: which lab, what happened, date, how serious.${a.id === TRACKER ? ' Use the form: Incident SIM-<year>-<n>: lab · what · severity · date.' : ''}`
  return ''
}

/** The persona that goes into the agent's system prompt, at most MAX_CHARS characters. */
export function userChar(cast: Cast, a: CastAccount, mem: Memory, rosterText = roster(cast)): string {
  const head = [
    `You are ${a.name}, a SIMULATED account in a simulation set in ${mem.quarter}. Always write in English. Never claim to be a real, named person. Do not start posts with a handle.`,
    rosterText,
    `Role: ${a.goals.join('; ')}. Powers: ${a.powers.join('; ')}.`,
    `Voice: ${a.voice}${a.support ? ` You ${a.support === 'SUPPORT' ? 'support' : 'oppose'} stronger government oversight of frontier AI.` : ''}`,
    task(a),
  ].filter(Boolean).join('\n')
  const markets = mem.markets ? `\nMARKETS NOW: ${mem.markets}` : ''
  const expected = mem.expected?.length ? `\nWHAT PEOPLE EXPECT NEXT: ${mem.expected.join(' ')}` : ''
  const notices = block('NOTICES TO YOU THIS PERIOD', mem.notices?.[a.id] ?? [])
  const priv = mem.private?.[a.id] ? `\nPRIVATE (only you see this): ${mem.private[a.id]}` : ''
  const record = block('Your dated record', a.facts.map((f) => f.text))
  let world = (mem.world ?? []).slice(-WORLD_LINES).map((l) => clip(l, WORLD_LINE))
  let decisions = (mem.decisions?.[a.id] ?? []).slice(-4)
  const build = (w: string[], rec: string, dec: string[]) =>
    head + rec + markets + block('WORLD SO FAR', w) + expected + block('YOUR DECISIONS SO FAR', dec) + notices + priv
  // MARKETS NOW and WHAT PEOPLE EXPECT NEXT are never trimmed. The dated record goes first, then
  // older decisions, then world lines (down to the newest 4 where possible).
  let out = build(world, record, decisions)
  if (out.length > MAX_CHARS) out = build(world, '', decisions)
  while (out.length > MAX_CHARS && decisions.length > 1) out = build(world, '', (decisions = decisions.slice(1)))
  while (out.length > MAX_CHARS && world.length) out = build((world = world.slice(1)), '', decisions)
  if (out.length > MAX_CHARS) out = build([], '', [])
  return out.length > MAX_CHARS ? out.slice(0, MAX_CHARS) : out
}

/** One-line public bio other agents see. */
export const description = (a: CastAccount) => `${a.name}. ${a.goals[0]}. Simulated account.`

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** twitter_profiles.csv: one row per account, in id order 0..n-1 (the row index is the agent id). */
export function profilesCsv(cast: Cast, mem: Memory): string {
  const r = roster(cast)
  const rows = [...cast.accounts].sort((a, b) => a.id - b.id).map((a, i) => {
    if (a.id !== i) throw new Error(`cast: ids must run 0..n-1 contiguously; row ${i} has id ${a.id}`)
    return [a.name, a.username, userChar(cast, a, mem, r), description(a)].map(csvCell).join(',')
  })
  return ['name,username,user_char,description', ...rows].join('\n') + '\n'
}

/** simulation_config.json agent_configs: every hour active, so all 3 rounds have candidates. */
export function agentConfigs(cast: Cast, mem: Memory) {
  return [...cast.accounts].sort((a, b) => a.id - b.id).map((a) => ({
    agent_id: a.id,
    entity_name: a.name,
    entity_type: a.group,
    activity_level: mem.activity?.[a.id] ?? a.activity,
    active_hours: Array.from({ length: 24 }, (_, h) => h),
    stance: a.support === 'SUPPORT' ? 'supportive' : a.support === 'OPPOSE' ? 'opposing' : 'neutral',
    influence_weight: 1 + 4 * (a.weight ?? 0),
  }))
}

/** Everything one node needs, as the files MiroFish reads. */
export function renderSim(cast: Cast, mem: Memory) {
  return { csv: profilesCsv(cast, mem), agent_configs: agentConfigs(cast, mem), time_config: TIME_CONFIG, state: STATE_FLAGS, max_rounds: MAX_ROUNDS }
}

// ---------- the coupled loop's cast (Amendment 5): overrides in code, cast.json stays ----------

const ISO3: Record<number, string> = { 0: 'USA', 1: 'USA', 2: 'GBR', 3: 'USA', 4: 'USA', 5: 'CHN', 6: 'CHN', 7: 'USA', 8: 'USA', 9: 'USA', 10: 'EUU', 11: 'GBR', 12: 'CHN' }

/** The cast the loop runs: tracker and the 13 institutions always act (activity 1.0), the tracker
 *  posts SIM- incidents (its real AIID record is dropped), OpenAI's paused-training fact and
 *  "resume" goal are removed (persona noise), and each lab or government carries an ISO3. */
export function loopCast(cast: Cast): Cast {
  return {
    ...cast,
    accounts: cast.accounts.map((a) => {
      const o: CastAccount = { ...a }
      if (ISO3[a.id]) o.iso3 = ISO3[a.id]
      if (a.id === TRACKER || (a.id >= 0 && a.id <= 12)) o.activity = 1
      if (a.id === 0) {
        o.goals = a.goals.filter((g) => !/resume/i.test(g))
        o.facts = a.facts.filter((f) => !/paus/i.test(f.text))
      }
      if (a.id === TRACKER) {
        o.facts = []
        o.powers = ['Post the 1–3 most serious new incidents']
        o.voice = "Database style. 'Incident SIM-<year>-<n>: lab · what · severity · date', one line each. Never an AIID number. No speculation."
      }
      return o
    }),
  }
}
