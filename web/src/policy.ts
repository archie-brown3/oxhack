// Illustrative negotiation policy. The coefficients below are hand-set
// placeholders; the real version is fitted on the NBER/eBay Best Offer threads.

export type Brief = {
  item: string
  ask: number // original asking price
  fairLow: number
  fairHigh: number
  ceiling: number // buyer's hard limit
  hoursLeft: number // time until the buyer's deadline
}

const STEP = 25
/** Each extra round risks the seller selling to someone else. */
const PATIENCE = 0.8

/** How many offer rounds fit before the deadline. */
export function roundsFor(hoursLeft: number) {
  return Math.min(5, Math.max(1, Math.ceil(hoursLeft / 18)))
}

/** P(seller accepts `offer` against their current asking price). */
export function pAccept(offer: number, sellerAsk: number, round: number) {
  const ratio = offer / sellerAsk
  const logit = 14 * (ratio - 0.93) + 0.2 * (round - 1)
  return 1 / (1 + Math.exp(-logit))
}

/** Saving if no deal is reached: the buyer has to start again elsewhere. */
export function noDealValue(brief: Brief) {
  return -0.025 * brief.ask
}

function offerGrid(brief: Brief, sellerAsk: number, floor: number) {
  const hi = Math.min(brief.ceiling, sellerAsk - STEP)
  const lo = Math.max(floor, Math.round((0.7 * sellerAsk) / STEP) * STEP)
  const grid: number[] = []
  for (let o = lo; o <= hi; o += STEP) grid.push(o)
  return grid
}

/**
 * Best expected saving with `roundsLeft` offers still to make.
 * The seller is assumed to hold at `sellerAsk` after a rejection.
 */
export function value(brief: Brief, sellerAsk: number, round: number, roundsLeft: number, floor = 0): number {
  if (roundsLeft <= 0) return noDealValue(brief)
  return plan(brief, sellerAsk, round, roundsLeft, floor).ev
}

export type Plan = {
  offer: number
  p: number
  ev: number
  curve: { offer: number; p: number }[]
}

/** Choose the offer that maximises expected saving against the original ask. */
export function plan(brief: Brief, sellerAsk: number, round: number, roundsLeft: number, floor = 0): Plan {
  const carryOn = roundsLeft > 1 ? PATIENCE * value(brief, sellerAsk, round + 1, roundsLeft - 1, floor) : noDealValue(brief)
  const grid = offerGrid(brief, sellerAsk, floor)
  let best: Plan = { offer: Math.min(brief.ceiling, sellerAsk), p: 0, ev: noDealValue(brief), curve: [] }
  for (const offer of grid) {
    const p = pAccept(offer, sellerAsk, round)
    const ev = p * (brief.ask - offer) + (1 - p) * carryOn
    best.curve.push({ offer, p })
    if (ev > best.ev) best = { ...best, offer, p, ev }
  }
  return best
}

/** Baseline: offer 90% of the asking price once. */
export function baseline(brief: Brief) {
  const offer = Math.round((0.9 * brief.ask) / STEP) * STEP
  const p = pAccept(offer, brief.ask, 1)
  return { offer, p, ev: p * (brief.ask - offer) + (1 - p) * noDealValue(brief) }
}

/** Should the agent take the seller's counter rather than keep going? */
export function shouldAccept(brief: Brief, counter: number, round: number, roundsLeft: number, floor: number) {
  if (counter > brief.ceiling) return false
  if (roundsLeft <= 0) return true
  return brief.ask - counter >= PATIENCE * value(brief, counter, round + 1, roundsLeft, floor)
}

export const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
