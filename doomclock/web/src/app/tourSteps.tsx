// The walkthrough's steps, as data. Each asks for one thing in ordinary words.
import { ForecastChart, type LinePoint } from '../ui/chart/ForecastChart.tsx'
import { dmy } from '../ui/format.ts'
import type { TourStep } from './Tour.tsx'

export interface TourContext {
  /** The day the real forecast passes 1 in 10, or null if after 2100. */
  date10: string | null
  daysPerSecond: number | null
  /** The backtest's headline, when a real one is loaded (not the fixture). */
  trackHeadline: string | null
  real: LinePoint[]
  openInputs: () => void
  closeSheets: () => void
  openTrack: () => void
}

export function tourSteps(c: TourContext): TourStep[] {
  return [
    {
      id: 'clock', target: '#clock', enter: c.closeSheets,
      title: 'This clock counts down',
      body: <p>It counts down to <b>{c.date10 ? dmy(c.date10) : 'after 2100'}</b>, the day the chance of an AI catastrophe passes 1 in 10. The date comes from today's prediction-market prices.{c.daysPerSecond ? ` Each second on the face is about ${Math.round(c.daysPerSecond)} days.` : ''}</p>,
      ask: 'Look at the hand and the countdown under it.',
      next: { label: 'Got it' },
    },
    {
      id: 'inputs', target: '#asof', enter: c.openInputs,
      title: 'Real data, every item dated',
      body: <p>These are the forecast's inputs: market prices, AI incidents, government actions and datacentres. Each one is dated by when it became public.</p>,
      ask: 'Drag the date back. Anything published later disappears, so the forecast cannot peek ahead.',
      on: { event: 'input', selector: '#asof' },
    },
    {
      id: 'play', target: '.dc-play', enter: c.closeSheets,
      title: 'Watch one possible future',
      body: <p>The engine draws 10,000 futures from the same model as the clock. The globe plays one of them, a quarter at a time. Solid rings are real events. Dashed rings are simulated.</p>,
      ask: 'Press play.',
      on: { event: 'click', selector: '.dc-play', key: ' ' },
    },
    {
      id: 'chart',
      title: 'Why this date',
      body: <>
        <p>The line is the chance of an AI catastrophe by each date. The clock shows the day it passes 1 in 10. It is an estimate from the data on this page, not a prediction we are sure of.</p>
        <ForecastChart real={c.real} width={320} height={130} years={10} />
      </>,
      ask: 'Find where the line crosses 1 in 10.',
    },
    {
      id: 'track', target: '#clock',
      title: 'Can you trust the markets?',
      body: <p>{c.trackHeadline ?? 'We test these markets on AI questions that have already resolved, against a coin flip, using only prices from before each date.'}</p>,
      ask: 'Open the track record to see the scores and how well the prices were calibrated.',
      next: { label: 'Show the track record', run: c.openTrack },
    },
  ]
}
