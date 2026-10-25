// Typed access to data/cards.json (doomclock.cards/1). The reducer, the Rogue, the interviews and
// the UI all read cards through here.
import raw from './data/cards.json' with { type: 'json' }
import type { AgentId, GuardianCardId, RogueCardId, Word } from './types.ts'

export type Who = AgentId | 'target' | 'targetGov'

export interface MarketRef {
  source: 'kalshi' | 'manifold'
  id: string
  question: string
  url: string
  p: number
  ts: string
  traders: number | null
  volume?: number
  thin?: boolean
}

export interface GuardianCard {
  id: GuardianCardId
  title: string
  blurb: string
  price: { bits: number; source: 'market' | 'game rule'; market?: MarketRef; note?: string }
  /** Last day it can be enacted (YYYY-MM-DD), or null. */
  expires: string | null
  trust: number
  target: 'none' | 'lab' | 'revealed'
  measure: string
  ask: string
  seeds: { author: Who; template: string }[]
  noticesTo: Who[]
  gatekeepers: { id: Who; vocab: string }[]
  subjects: { ids: AgentId[] | 'target'; vocab: string | null }
  reactors?: { id: Who; vocab: string }[]
  engine: { kind: string; [k: string]: unknown }
}

export interface RogueCard {
  id: RogueCardId
  title: string
  cu: number
  risk: number
  target: 'none' | 'lab'
  needs: { minC?: number; footholdAtTarget?: boolean }
  aiid: string[]
  context?: MarketRef
  enters: string
  private?: string
  engine: Record<string, unknown>
}

export interface CardsFile {
  schema: 'doomclock.cards/1'
  pinnedAt: string
  m: Record<Word, number>
  vocab: Record<string, Word[]>
  offerOrder: GuardianCardId[]
  g7Slot: number
  guardian: GuardianCard[]
  rogue: RogueCard[]
}

export const CARDS = raw as unknown as CardsFile
export const M = CARDS.m

export function guardianCard(id: GuardianCardId): GuardianCard {
  const c = CARDS.guardian.find((g) => g.id === id)
  if (!c) throw new Error(`cards: no ${id}`)
  return c
}

export function rogueCard(id: RogueCardId): RogueCard {
  const c = CARDS.rogue.find((r) => r.id === id)
  if (!c) throw new Error(`cards: no ${id}`)
  return c
}
