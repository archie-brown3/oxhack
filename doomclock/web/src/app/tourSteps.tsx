// The walkthrough's five steps, as data. Each asks for one thing in ordinary words.
import { dmy } from '../ui/format.ts'
import type { TourStep } from './Tour.tsx'

export interface TourContext {
  /** The day the real forecast passes 1 in 10, or null if after 2100. */
  date10: string | null
  daysPerSecond: number | null
  /** The backtest's headline, when a real one is loaded (not the fixture). */
  trackHeadline: string | null
  /** True once the first simulated step has landed. */
  landed: boolean
  openDanger: () => void
  openInputs: () => void
  closeSheets: () => void
  openTrack: () => void
}

export function tourSteps(c: TourContext): TourStep[] {
  return [
    {
      id: 'clock', target: '#clock', enter: c.closeSheets,
      title: 'This clock counts down',
      body: <p>It counts down to <b>{c.date10 ? dmy(c.date10) : 'after 2100'}</b>, the day the chance of an AI catastrophe passes 1 in 10. The date comes from today's prediction-market prices only.{c.daysPerSecond ? ` Each second on the face is about ${Math.round(c.daysPerSecond)} days.` : ''}</p>,
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
      id: 'play', target: '.dc-play', enter: c.closeSheets, complete: c.landed,
      title: 'Watch a simulated future',
      body: <p>MiroFish plays a made-up world forward six months at a time. Dashed rings are simulated events. Each one nudges the clock by a rule we set. Nothing here moves the real clock.</p>,
      ask: 'Press play and wait for the first step to land.',
    },
    {
      id: 'danger', target: '#clock', enter: c.openDanger,
      title: 'How dangerous is it?',
      body: <p>The market says <b>when</b>. After each step a report scores the simulated world from 0 to 3 on loss of control, misuse, oversight and race pressure. That sets <b>how dangerous</b>.</p>,
      ask: 'Look at the four scores and the three lines.',
      next: { label: 'Got it', run: c.closeSheets },
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
