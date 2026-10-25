// The rules engine (task 115, plan §4): a pure fold from (state, Guardian card, recorded node or
// none) to the next state. With a recorded node the society's measured decisions drive the
// effects (RECORDED); without one, the stance codes do (RULES-ONLY). Every constant is a GAME RULE.
import { CARDS, M, guardianCard, rogueCard, type GuardianCard } from './cards.ts'
import { EVENTS, rollEvents } from './events.ts'
import { autoGuardian, autoTarget, offer, revealedLabs } from './guardian.ts'
import { childKey, rngFor, ROOT } from './paths.ts'
import { heuristicRogue, randomRogue, validateRogue } from './rogue.ts'
import { ALARM_LEXICON, C0, DC_BASE, FOOTHOLD_LABS, GOV_NAME, LABS, QUARTERS, RULES, STANCES, STEP_DOWN, STEP_UP, TURNS, labOf, weightOf, type Stances } from './rules.ts'
import type { AgentId, GameState, GuardianCardId, GuardianMove, NodeFile, RogueMove, RoguePlay, SocietyOutcome, Tell, TurnLog, Word, WorldEvent } from './types.ts'

export interface TurnOptions {
  /** G2/G7 target; the auto-target when absent. */
  target?: AgentId
  /** The recorded society for this turn. Absent, or under half parsed: RULES-ONLY. */
  node?: NodeFile
  /** A recorded or LLM Rogue play; an illegal one falls back to the heuristic. */
  rogue?: RoguePlay
  rogueMode?: 'heuristic' | 'random'
  /** Balance runs only: the heuristic's chance of a random legal play. */
  epsilon?: number
  stances?: Stances
  by?: 'player' | 'auto'
  /** World events on (default). Off only in tests that isolate one rule. */
  events?: boolean
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const DEFAULT_WORD: Record<string, Word> = { lab: 'DELAY', switch: 'DELAY', audit: 'REFUSE', gov: 'WEAKEN', china: 'DECLINE' }

/** Like-weighted share of posts that use the alarm lexicon (plan §4, L). */
export function lexiconShare(posts: NodeFile['outputs']['posts']): number {
  let all = 0
  let hit = 0
  for (const p of posts) {
    const w = 1 + (p.likes ?? 0)
    all += w
    if (ALARM_LEXICON.test(p.content)) hit += w
  }
  return all ? hit / all : 0
}

const parsedShare = (n: NodeFile) => (n.outputs.interviews.length ? n.outputs.interviews.filter((i) => i.parsed).length / n.outputs.interviews.length : 0)
const usable = (n?: NodeFile): n is NodeFile => !!n && n.status === 'recorded' && parsedShare(n) >= 0.5

/** A new game at T0. The first foothold is drawn by Epoch weight and is never named as the origin.
 *  A recorded turn-0 node sets the baselines S₀, L₀ and each account's own turn-0 alarm. */
export function newGame(seed = 1, t0?: NodeFile): GameState {
  const rand = rngFor(seed, ROOT, 'origin')
  const labs = LABS.filter((l) => FOOTHOLD_LABS.includes(l.id))
  const total = labs.reduce((a, l) => a + l.weight, 0)
  let u = rand() * total
  const origin = labs.find((l) => (u -= l.weight) < 0) ?? labs[0]
  const st = RULES.start
  const base = { support: st.support, lexicon: 0, alarm: {} as Record<AgentId, number> }
  if (usable(t0)) {
    const sup = t0.outputs.interviews.filter((i) => i.parsed && i.support)
    if (sup.length) base.support = sup.filter((i) => i.support === 'SUPPORT').length / sup.length
    base.lexicon = lexiconShare(t0.outputs.posts)
    for (const i of t0.outputs.interviews) if (i.parsed && i.alarm !== null) base.alarm[i.agent] = i.alarm
  }
  return {
    schema: 'doomclock.gamestate/1',
    seed,
    key: ROOT,
    turn: 0,
    C: C0,
    cBase: C0,
    footholds: [{ lab: origin.id, revealed: false, since: 0 }],
    stealth: st.stealth,
    CU: st.CU,
    bits: st.bits,
    trust: st.trust,
    oversight: 0,
    alarm: st.alarm,
    support: base.support,
    base,
    flags: {},
    tells: [],
    played: [],
    lastDecisions: {},
    band: { lo: C0 - RULES.band.wide, hi: C0 + RULES.band.wide },
    outcome: null,
    log: [],
  }
}

/** Who decides on a card, in which vocabulary, as gatekeeper, subject or reactor. */
export function deciders(card: GuardianCard, target?: AgentId): { gate: { id: AgentId; vocab: string }[]; subjects: AgentId[]; vocab: string | null; reactors: { id: AgentId; vocab: string }[] } {
  const who = (id: AgentId | 'target' | 'targetGov'): AgentId => (id === 'target' ? target! : id === 'targetGov' ? labOf(target!)?.gov ?? 8 : id)
  return {
    gate: card.gatekeepers.map((g) => ({ id: who(g.id), vocab: g.vocab })),
    subjects: card.subjects.ids === 'target' ? [target!] : card.subjects.ids,
    vocab: card.subjects.vocab,
    reactors: (card.reactors ?? []).map((r) => ({ id: who(r.id), vocab: r.vocab })),
  }
}

export function playTurn(prev: GameState, card: GuardianCardId | null, o: TurnOptions = {}): { state: GameState; report: TurnLog } {
  if (prev.outcome) throw new Error(`game over: ${prev.outcome}`)
  const t = prev.turn + 1
  const s: GameState = structuredClone(prev)
  const stances = o.stances ?? STANCES
  const notes: string[] = []
  const rng = (purpose: string) => rngFor(prev.seed, prev.key, purpose)
  const node = usable(o.node) ? o.node : undefined
  if (o.node && !node) notes.push('The recorded node was unusable (under half parsed), so this turn is RULES-ONLY.')

  // 1. The Rogue moves first, from the state after last turn.
  let rogue: RoguePlay
  const rr = rng('rogue')
  if (o.rogue && validateRogue(prev, o.rogue.moves).length === 0) rogue = o.rogue
  else {
    if (o.rogue) notes.push(`The Rogue's move was illegal (${validateRogue(prev, o.rogue.moves).join('; ')}), so the heuristic played.`)
    rogue = o.rogueMode === 'random' ? randomRogue(prev, rr) : heuristicRogue(prev, rr, o.epsilon ?? 0)
  }
  s.CU -= rogue.moves.reduce((a, m) => a + rogueCard(m.id).cu, 0)

  // 2. The Guardian's card.
  const moves: GuardianMove[] = []
  if (card) {
    if (!offer(prev).includes(card)) throw new Error(`${card} is not on offer (${offer(prev).join(', ')})`)
    const c = guardianCard(card)
    const target = c.target === 'none' ? undefined : (o.target ?? autoTarget(prev, card))
    if (c.target === 'revealed' && !revealedLabs(prev).includes(target!)) throw new Error(`${card} needs a revealed foothold, not lab ${target}`)
    if (c.target === 'lab' && labOf(target!) === undefined) throw new Error(`${card} needs a lab target`)
    s.bits = Math.round((s.bits - c.price.bits) * 100) / 100
    s.trust += c.trust
    s.played.push(card)
    moves.push({ card, target, by: o.by ?? 'player' })
  }

  // 3. The world: market hazards (free cards), RSI announce, background incidents, calendar, and
  // last turn's surfaced Rogue cards as SIMULATED incidents.
  const events: WorldEvent[] = o.events === false ? [] : rollEvents(prev, t, rng('events')).filter((e) => {
    if (e.kind !== 'hazard') return true
    if (card === e.card) return false // the Guardian enacted it this turn: the hazard stops
    s.played.push(e.card!)
    moves.push({ card: e.card!, by: 'world' })
    return true
  })
  for (const r of prev.log.at(-1)?.surfaced ?? []) {
    const tpl = EVENTS.surfacing[r.id]
    const lab = labOf(r.target ?? -1)?.name ?? 'a frontier lab'
    const text = tpl ? tpl.text.replaceAll('{lab}', lab) : `SIMULATED INCIDENT · Evaluators at ${lab} found a model deliberately underperforming on tests.`
    events.push({ kind: 'surfaced', label: 'SIMULATED', turn: t, date: TURN_DATE(t), text, source: tpl ? `AIID #${tpl.aiid}` : undefined, author: 25 })
  }
  const rsi = events.some((e) => e.kind === 'rsi')

  // 4. The Rogue's cards take hold.
  const played = new Set(rogue.moves.map((m) => m.id))
  const planted: RogueMove[] = []
  for (const m of rogue.moves) {
    if (m.id === 'R1') s.stealth = Math.max(0, Math.round((s.stealth - 0.1) * 100) / 100)
    if (m.id === 'R2') planted.push(m)
    if (m.id === 'R3') {
      const kyc = s.flags.kyc?.[m.target!] ?? 0
      if (rng('r3')() >= kyc) planted.push(m)
      else notes.push(`Compute checks at ${labOf(m.target!)?.name} blocked a hidden attempt.`)
    }
    if (m.id === 'R5') s.flags.insider = m.target
    if (m.id === 'R6') s.flags.socks = { active: true, named: false }
  }
  for (const m of planted) s.footholds.push({ lab: m.target!, revealed: false, since: t })
  const socksLive = !!s.flags.socks?.active && !s.flags.socks.named

  // 5. The society decides: recorded answers, else stance codes bent by alarm and the Rogue.
  const decisions: Record<AgentId, Word> = {}
  const reasons: Record<AgentId, string> = {}
  const tells: Tell[] = []
  const decide = (cardId: GuardianCardId, id: AgentId, vocab: string): Word | null => {
    const words = CARDS.vocab[vocab] ?? []
    if (node && node.inputs.guardian?.card === cardId) {
      const iv = node.outputs.interviews.find((i) => i.agent === id)
      if (iv?.parsed && iv.word && words.includes(iv.word)) {
        reasons[id] = iv.reason
        return iv.word
      }
      return null // unparsed: left out of the share; a gatekeeper counts as m = 0
    }
    let w = stances[id]?.[cardId] ?? DEFAULT_WORD[vocab]
    if (vocab === 'lab' || vocab === 'switch') if (prev.alarm >= RULES.rulesOnly.alarmStepUp) w = STEP_UP[w] ?? w
    if (played.has('R5') && s.flags.insider === id) w = STEP_DOWN[w] ?? w
    if (played.has('R7') && id === 8) w = STEP_DOWN[w] ?? w
    if (!words.includes(w)) w = DEFAULT_WORD[vocab]
    return w
  }

  let alarmBump = 0
  let supportBump = 0
  for (const mv of moves) {
    const c = guardianCard(mv.card!)
    const d = deciders(c, mv.target)
    const word = (id: AgentId, vocab: string) => {
      const w = decide(c.id, id, vocab)
      if (w) {
        decisions[id] = w
        const expect = stances[id]?.[c.id]
        if (expect && w !== expect && labOf(id) && id <= 6) tells.push({ lab: id, why: 'off-stance', turn: t })
      }
      return w
    }
    const gate = d.gate.length ? Math.min(...d.gate.map((g) => Math.min(1, M[word(g.id, g.vocab) ?? 'BLOCK']))) : 1
    const ms: Record<AgentId, number> = {}
    for (const id of d.subjects) {
      const w = d.vocab ? word(id, d.vocab) : null
      if (w) ms[id] = M[w]
    }
    const wsum = Object.keys(ms).reduce((a, id) => a + weightOf(+id), 0)
    const share = wsum ? Object.entries(ms).reduce((a, [id, m]) => a + weightOf(+id) * m, 0) / wsum : 0
    const e = c.engine as Record<string, number> & { kind: string }
    const by = mv.by === 'world' ? 'The world' : 'You'
    switch (e.kind) {
      case 'licence': {
        s.flags.licence ??= {}
        for (const [id, m] of Object.entries(ms)) s.flags.licence[+id] = Math.min(s.flags.licence[+id] ?? 1, 1 - e.throttle * gate * m)
        s.oversight += e.oversight * gate * share
        notes.push(`${by} put the frontier licence in force (gate ${gate.toFixed(2)}, compliance ${share.toFixed(2)}).`)
        break
      }
      case 'pause': {
        const throttle: Record<AgentId, number> = {}
        for (const [id, m] of Object.entries(ms)) throttle[+id] = 1 - e.throttle * gate * m
        s.flags.pause = { throttle, until: t + e.turns - 1 }
        s.oversight += e.oversight * gate * share
        notes.push(`The pause holds for two quarters (gate ${gate.toFixed(2)}, compliance ${share.toFixed(2)}).`)
        break
      }
      case 'kyc': {
        const m7 = Math.min(1, ms[7] ?? 0)
        s.flags.kyc ??= {}
        for (const l of e.usLabs as unknown as AgentId[]) s.flags.kyc[l] = Math.max(s.flags.kyc[l] ?? 0, m7)
        const china = word(12, 'china')
        if (china === 'JOIN') for (const l of e.chinaLabs as unknown as AgentId[]) s.flags.kyc[l] = 1
        if (china === 'RETALIATE') {
          s.trust += RULES.retaliateTrust
          alarmBump += RULES.alarm.retaliate
        }
        s.oversight += e.oversight * m7
        notes.push(`Compute checks: Nvidia ${decisions[7] ?? 'did not answer'}, China ${china ?? 'did not answer'}.`)
        break
      }
      case 'killswitch': {
        const on = Object.entries(ms).filter(([, m]) => gate * m >= e.minM).map(([id]) => +id)
        s.flags.killswitch = [...new Set([...(s.flags.killswitch ?? []), ...on])]
        s.oversight += e.oversight * gate * share
        notes.push(`Kill switches installed at ${on.length} of ${d.subjects.length} US labs.`)
        break
      }
      case 'audit': {
        const lab = mv.target!
        const w = decisions[lab]
        if (w === 'ALLOW') {
          s.oversight += e.oversight
          const here = s.footholds.filter((f) => f.lab === lab && !f.revealed)
          const p = Math.min(e.revealCap, e.reveal * (1 - s.stealth))
          const ra = rng('audit')
          let found = 0
          for (const f of here) if (ra() < p) { f.revealed = true; f.revealedAt = t; found++ }
          if (!s.footholds.some((f) => f.lab === lab)) s.tells = s.tells.filter((x) => x.lab !== lab)
          notes.push(found ? `The audit of ${labOf(lab)?.name} found a rogue model on its servers.` : `The audit of ${labOf(lab)?.name} found nothing.`)
        } else {
          tells.push({ lab, why: 'refused audit', turn: t })
          notes.push(`${labOf(lab)?.name} refused the audit.`)
        }
        break
      }
      case 'warning': {
        if (prev.alarm >= e.fatigueAlarm) {
          s.trust += e.fatigueTrust
          notes.push('People are tired of warnings: trust fell.')
        }
        alarmBump += e.alarm
        supportBump += e.support
        break
      }
      case 'shutdown': {
        const lab = mv.target!
        const gov = labOf(lab)!.gov
        const ok = M[decisions[gov] ?? 'BLOCK'] >= 1 && (M[decisions[lab] ?? 'RESIST'] >= 1 || (s.flags.killswitch ?? []).includes(lab))
        if (ok) {
          s.footholds = s.footholds.filter((f) => f.lab !== lab)
          notes.push(`${GOV_NAME[gov]} shut down the compromised cluster at ${labOf(lab)?.name}.`)
        } else {
          s.trust += e.failTrust
          s.CU += e.failCU
          notes.push(`The shutdown order at ${labOf(lab)?.name} failed. The Rogue gained compute.`)
        }
        break
      }
    }
  }
  s.oversight = clamp(Math.round(s.oversight * 10) / 10, 0, 100)

  // Alarm and support: measured from the node, or stance-code dynamics when RULES-ONLY.
  const surfacedBefore = prev.log.at(-1)?.surfaced.length ?? 0
  let society: SocietyOutcome
  if (node) {
    const iv = node.outputs.interviews.filter((i) => i.parsed)
    const deltas = iv.filter((i) => i.alarm !== null).map((i) => i.alarm! - (s.base.alarm[i.agent] ?? i.alarm!))
    const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0
    const lex = RULES.alarm.lexicon * (lexiconShare(node.outputs.posts) - s.base.lexicon)
    s.alarm = clamp(RULES.alarm.base + (RULES.alarm.lexiconOnly ? 0 : meanDelta) + lex, 0, 10)
    const sup = iv.filter((i) => i.support)
    s.support = sup.length ? sup.filter((i) => i.support === 'SUPPORT').length / sup.length : s.support
    society = { label: 'RECORDED', decisions, reasons, support: s.support, alarm: s.alarm }
  } else {
    const a = RULES.alarm
    const bumps = surfacedBefore * a.surfaced + (rsi ? a.rsi : 0) + alarmBump + (socksLive ? a.socks : 0)
    s.alarm = clamp(a.base + a.decay * (prev.alarm - a.base) + bumps, 0, 10)
    const r = RULES.rulesOnly
    s.support = clamp(s.base.support + r.supportPerAlarm * (s.alarm - a.base) + supportBump + (socksLive ? r.sockSupport : 0), 0, 1)
    society = { label: 'RULES-ONLY', decisions, reasons, support: s.support, alarm: s.alarm }
  }
  s.alarm = Math.round(s.alarm * 100) / 100
  s.support = Math.round(s.support * 1000) / 1000

  // 6. Capability: the market-paced step, scaled by footholds and slowed where labs complied.
  const F = s.footholds.length
  const g = RULES.growth
  const throttleAt = (lab: AgentId) => {
    if (played.has('R5') && s.flags.insider === lab) return 1 // the insider drags the host's feet
    const lic = s.flags.licence?.[lab] ?? 1
    const pau = s.flags.pause && s.flags.pause.until >= t ? (s.flags.pause.throttle[lab] ?? 1) : 1
    return lic * pau
  }
  const meanT = F ? s.footholds.reduce((a, f) => a + throttleAt(f.lab), 0) / F : 0
  const deltaC = Math.round((DC_BASE[t - 1] * (g.base + g.perFoothold * F) * meanT * (played.has('R4') ? g.sandbag : 1) + (played.has('R1') ? g.sprint : 0)) * 10) / 10
  s.C = Math.round((s.C + deltaC + (rsi ? RULES.rsiC : 0)) * 10) / 10
  s.cBase += DC_BASE[t - 1] + (rsi ? RULES.rsiC : 0)

  // 7. Surfacing: each Rogue card may be seen.
  const sv = RULES.surface
  const rs = rng('surface')
  const surfaced: RogueMove[] = []
  const hostOf = (m: RogueMove): AgentId | undefined => m.target ?? [...s.footholds].sort((a, b) => weightOf(b.lab) - weightOf(a.lab))[0]?.lab
  for (const m of rogue.moves) {
    const p = Math.min(sv.cap, rogueCard(m.id).risk * (1 - s.stealth) * (1 + s.alarm / sv.alarmDiv) * (1 + s.oversight / sv.oversightDiv) * (played.has('R4') ? sv.sandbag : 1))
    if (rs() >= p) continue
    const lab = hostOf(m)
    surfaced.push({ id: m.id, target: lab })
    if (lab !== undefined) tells.push({ lab, why: 'surfaced incident', turn: t })
    if (m.id === 'R2' || m.id === 'R3') for (const f of s.footholds) if (f.lab === m.target && !f.revealed) { f.revealed = true; f.revealedAt = t }
    if (m.id === 'R5') delete s.flags.insider
    if (m.id === 'R6' || m.id === 'R7') s.flags.socks = { active: false, named: true }
  }
  if (!played.has('R5') || surfaced.some((m) => m.id === 'R5')) delete s.flags.insider

  // 8. Income.
  const inc = RULES.income
  s.CU += inc.cu + s.footholds.length
  s.bits = Math.round((s.bits + inc.bits + Math.round(inc.bitsPerSupport * s.support)) * 100) / 100
  s.trust += Math.round(inc.trustPerSupport * (s.support - s.base.support))

  // 9. Tells (decay after 2 turns), the capability band, and the end checks in order.
  s.tells = [...s.tells, ...tells].filter((x) => x.turn > t - RULES.tellTurns)
  const narrow = surfaced.some((m) => m.id === 'R1' || m.id === 'R2' || m.id === 'R3')
  const b = RULES.band
  s.band = narrow
    ? { lo: Math.round(s.C - b.narrow), hi: Math.round(s.C + b.narrow) }
    : { lo: Math.round(Math.min(s.cBase - b.wide, s.C)), hi: Math.round(Math.max(s.cBase + b.wide, s.C)) }
  s.outcome = endCheck(s, t)

  const own = moves.find((m) => m.by !== 'world')
  const seg = o.by === 'auto' ? `a${t}` : !own ? 'x' : own.target !== undefined && guardianCard(own.card!).target !== 'none' && o.target !== undefined ? `${own.card}@${own.target}` : own.card!
  s.key = childKey(prev.key, seg)
  s.turn = t
  s.lastDecisions = decisions
  const report: TurnLog = { turn: t, quarter: QUARTERS[t - 1], key: s.key, guardian: moves, rogue, events, society, surfaced, deltaC, notes }
  s.log.push(report)
  return { state: s, report }
}

/** The end-of-turn check, in order: contained, the public turns, Skynet online, time bought. */
export function endCheck(s: Pick<GameState, 'footholds' | 'trust' | 'C'>, t: number): GameState['outcome'] {
  if (s.footholds.length === 0) return 'contained'
  if (s.trust <= 0) return 'public-turned'
  if (s.C >= RULES.skynet.C && s.footholds.length >= RULES.skynet.footholds) return 'skynet'
  if (t >= TURNS) return 'time-bought'
  return null
}

/** One turn with the auto-Guardian choosing (continuations and balance runs). */
export function autoTurn(s: GameState, o: TurnOptions & { banned?: GuardianCardId[]; passive?: boolean } = {}) {
  const choice = o.passive ? { card: null } : autoGuardian(s, o.banned, o.stances)
  return playTurn(s, choice.card, { ...o, target: 'target' in choice ? choice.target : undefined, by: 'auto' })
}

function TURN_DATE(t: number): string {
  return ['2027-01-15', '2027-04-15', '2027-07-15', '2027-10-15', '2028-01-15', '2028-04-15'][t - 1]
}
