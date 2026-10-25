// Moved into asOf(T) (doomclock/pipeline/asof/asof.ts), the one point-in-time module. Kept as a re-export so
// existing imports keep working; new code should import from ../asof/asof.ts.
export { loadPrices, priceAt, type Point } from "../asof/asof.ts";
