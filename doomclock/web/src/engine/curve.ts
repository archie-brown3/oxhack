// The chart behind the clock (Why → When, Inputs → Markets): the four market points, the
// superintelligence CDF through them, the catastrophe CDF the lag rule makes of it, and where
// that reaches 1 in 10. Every number comes from sim.ts and timeline.ts's own functions, so the
// chart and the clock cannot disagree.
import type { NodeId, Prob } from "../contracts.ts";
import { analyticCdf, asiKnots, cdfAt, HORIZON, p10Year } from "./sim.ts";
import { LAG_RANGE, simInput } from "./timeline.ts";

export interface CurvePoint {
  year: number; // decimal year
  p: number;
}

export interface MarketPoint {
  id: NodeId;
  year: number; // the market's deadline
  p: Prob; // its price, as traded (the curve pools disagreeing points; the dot stays honest)
  curve: "asi" | "cat";
}

export interface MarketCurve {
  points: MarketPoint[];
  /** P(superintelligence by year): piecewise linear through the market points, 0 at `at`. */
  asi: CurvePoint[];
  /** P(AI catastrophe by year): the ASI curve lagged by the game-rule gap, scaled to cat2100. */
  cat: CurvePoint[];
  /** Decimal year the catastrophe curve first reaches 1 in 10: the root the clock reads. Null past 2100. */
  y10: number | null;
  /** [earliest, latest] of that root with the gap at 1 y and at 10 y: the clock's grey band. */
  y10Lag: [number | null, number | null];
}

const DEADLINE: Record<NodeId, number> = { asi2030: 2030, asi2040: 2040, asi2100: 2100, cat2100: 2100 };

/** The curves the clock is read from, for anchors read at decimal year `at`. */
export function marketCurve(anchors: Record<NodeId, Prob>, at: number, lagMeanYears: number, step = 0.25): MarketCurve {
  const input = simInput(anchors, at, lagMeanYears);
  const knots = asiKnots(input);
  const years = new Set<number>([at, HORIZON, ...knots.xs]);
  for (let y = at + step; y < HORIZON; y += step) years.add(y);
  const xs = [...years].sort((a, b) => a - b);
  const lag = LAG_RANGE.map((l) => p10Year({ ...input, lagMeanYears: l }) ?? Infinity);
  const fin = (y: number) => (Number.isFinite(y) ? y : null);
  return {
    points: (Object.keys(DEADLINE) as NodeId[]).map((id) => ({ id, year: DEADLINE[id], p: anchors[id], curve: id === "cat2100" ? "cat" : "asi" })),
    asi: xs.map((year) => ({ year, p: cdfAt(knots, year) })),
    cat: xs.map((year) => ({ year, p: analyticCdf(input, year, knots) })),
    y10: p10Year(input),
    y10Lag: [fin(Math.min(...lag)), fin(Math.max(...lag))],
  };
}
