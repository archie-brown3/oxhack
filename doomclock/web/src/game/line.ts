// The two lines (task 107, plan §4). The real line is the 1-in-10 date of the engine's model on the
// pinned markets: its only input is the World, so no game move can reach it. "Your timeline" shifts
// two of the same anchors by log-odds computed from game state (GAME RULE) and re-reads the date.
import type { World } from '../contracts.ts'
import { p10Year, withDlogits, yearToIso, type LineDlogits, type SimInput } from '../engine/sim.ts'
import { RULES } from './rules.ts'
import type { GameState } from './types.ts'

export interface LineReading {
  label: 'REAL' | 'GAME RULE'
  /** Decimal year the chance of AI catastrophe passes 1 in 10; null if not by 2100. */
  year: number | null
  /** UTC day of that date. */
  date: string | null
}

export interface YourLine extends LineReading {
  /** Months later (+) or earlier (-) than the real line. */
  months: number
  dlogit: LineDlogits
}

// Decimal year by calendar-year fraction, as the clock reads asOf.
function decimalYear(iso: string): number {
  const ms = Date.parse(iso)
  const y = new Date(ms).getUTCFullYear()
  const a = Date.UTC(y, 0, 1)
  return y + (ms - a) / (Date.UTC(y + 1, 0, 1) - a)
}

/** The engine's input for the World, exactly as the clock builds it (knots at 2030/2040/2100). */
export function simInputOf(world: World, lagMeanYears = world.lagMeanYears): SimInput {
  const a = world.anchors
  return {
    startYear: decimalYear(world.asOf),
    asi: [{ year: 2030, p: a.asi2030 }, { year: 2040, p: a.asi2040 }, { year: 2100, p: a.asi2100 }],
    pCat2100: a.cat2100,
    lagMeanYears,
  }
}

const reading = (label: LineReading['label'], year: number | null): LineReading => ({ label, year, date: year === null ? null : yearToIso(year).slice(0, 10) })

/** The real forecast's 1-in-10 date. It takes the World only. */
export function realLine(world: World): LineReading {
  return reading('REAL', p10Year(simInputOf(world)))
}

/** The log-odds shifts game state implies (plan §4, GAME RULE). */
export function lineDlogits(s: GameState): LineDlogits {
  const l = RULES.line
  return {
    asi: l.asiPerC * (s.C - s.cBase),
    cat: l.catPerFoothold * (s.footholds.length - 1) + l.catPerOversight * s.oversight + (s.outcome === 'contained' ? l.contained : 0) + (s.outcome === 'skynet' ? l.skynet : 0),
  }
}

export function yourLine(s: GameState, world: World): YourLine {
  const dlogit = lineDlogits(s)
  const real = realLine(world).year
  const r = reading('GAME RULE', p10Year(withDlogits(simInputOf(world), dlogit)))
  const months = r.year === null || real === null ? (r.year === null ? 999 : -999) : Math.round((r.year - real) * 120) / 10
  return { ...r, months, dlogit }
}

/** The headline's dependence on the lag, for the Model drawer: lag 1, 3 (default) and 10 years. */
export function lagSensitivity(world: World): { lag: number; date: string | null }[] {
  return [1, 3, 10].map((lag) => ({ lag, date: reading('REAL', p10Year(simInputOf(world, lag))).date }))
}
