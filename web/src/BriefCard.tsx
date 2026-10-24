import { baseline, gbp, plan, roundsFor, type Brief } from './policy'

export const DEADLINES = [2, 6, 12, 24, 48, 72, 120, 168]

export const deadlineLabel = (h: number) => (h < 24 ? `${h} hours` : h === 24 ? '1 day' : `${h / 24} days`)

/** The buyer's brief. Changing the ceiling or deadline re-plans the opening offer live. */
export function BriefCard({ brief, onChange }: { brief: Brief; onChange: (b: Brief) => void }) {
  const rounds = roundsFor(brief.hoursLeft)
  const opening = plan(brief, brief.ask, 1, rounds)
  const base = baseline(brief)

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_24px_60px_-30px_rgba(24,24,27,0.25)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium">{brief.item}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">asking {gbp(brief.ask)}</p>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Fair price {gbp(brief.fairLow)} to {gbp(brief.fairHigh)} (example band)
      </p>

      <div className="mt-6 grid gap-5">
        <label className="grid gap-2">
          <span className="flex justify-between text-sm">
            <span>Your ceiling</span>
            <span>{gbp(brief.ceiling)}</span>
          </span>
          <input
            type="range"
            min={7500}
            max={brief.ask}
            step={50}
            value={brief.ceiling}
            onChange={(e) => onChange({ ...brief, ceiling: Number(e.target.value) })}
            className="accent-emerald-600 dark:accent-emerald-400"
          />
        </label>
        <label className="grid gap-2">
          <span className="flex justify-between text-sm">
            <span>Need it within</span>
            <span>{deadlineLabel(brief.hoursLeft)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={DEADLINES.length - 1}
            step={1}
            value={DEADLINES.indexOf(brief.hoursLeft)}
            onChange={(e) => onChange({ ...brief, hoursLeft: DEADLINES[Number(e.target.value)] })}
            className="accent-emerald-600 dark:accent-emerald-400"
          />
        </label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="col-span-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Opening offer</p>
          <p className="text-4xl tracking-tight text-emerald-700 tabular-nums dark:text-emerald-400">
            {gbp(opening.offer)}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Chance they accept</p>
          <p className="tabular-nums">{Math.round(opening.p * 100)}%</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Rounds before deadline</p>
          <p className="tabular-nums">{rounds}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Expected saving</p>
          <p className="tabular-nums">{gbp(opening.ev)}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Offering 90% instead</p>
          <p className="text-zinc-500 tabular-nums dark:text-zinc-400">{gbp(base.ev)}</p>
        </div>
      </div>
    </div>
  )
}
