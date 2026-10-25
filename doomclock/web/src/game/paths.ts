// Path keys and the RNG they seed (format in types.ts). Pure.
import { mulberry32 } from '../engine/rng.ts'

export const ROOT = 't0'
const SEGMENT = /^(G[1-7](@\d+)?|x|a\d)$/

/** The key one turn further down: a card (with an optional lab target), a pass, or an auto turn. */
export function childKey(parent: string, seg: string): string {
  if (!SEGMENT.test(seg)) throw new Error(`paths: bad segment ${seg}`)
  return `${parent}.${seg}`
}

export function isKey(key: string): boolean {
  const [root, ...segs] = key.split('.')
  return root === ROOT && segs.every((s) => SEGMENT.test(s))
}

/** FNV-1a 32-bit: a stable hash of a string. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/** A seeded uniform stream for one purpose ('rogue', 'events', 'surface', ...) at one node. */
export function rngFor(seed: number, key: string, purpose: string): () => number {
  return mulberry32(hash32(`${seed}|${key}|${purpose}`))
}
