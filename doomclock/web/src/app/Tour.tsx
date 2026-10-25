// The first-launch walkthrough: a few short steps, each asking for one thing. It spotlights the
// part of the screen it talks about and never blocks it: the spotlight lets clicks through,
// Skip and Esc end it, and "Show me around" replays it. Steps are data (tourSteps.tsx).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import '../styles/tour.css'

export interface TourStep {
  id: string
  /** CSS selector to spotlight. None centres the card. */
  target?: string
  title: string
  body: ReactNode
  /** The one thing this step asks the person to do, as an instruction. */
  ask: string
  /** The step completes by itself when this happens (on `selector`, else on `target`). */
  on?: { event: 'click' | 'input'; selector?: string; key?: string }
  /** The step completes by itself once this turns true (e.g. the first simulated step has landed). */
  complete?: boolean
  /** The card's button. `run` happens before moving on. Default: "Next". */
  next?: { label: string; run?: () => void }
  /** Runs when the step opens: open or close a sheet, pause the replay. */
  enter?: () => void
}

const KEY = 'dc-tour'
export const tourDone = () => { try { return localStorage.getItem(KEY) === 'done' } catch { return false } }
const markDone = () => { try { localStorage.setItem(KEY, 'done') } catch { /* private window: it just shows again */ } }

type Box = { left: number; top: number; width: number; height: number }

export function Tour({ steps, onEnd }: { steps: TourStep[]; onEnd: () => void }) {
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const step = steps[i]
  const last = i === steps.length - 1
  const end = () => { markDone(); onEnd() }
  const advance = () => (last ? end() : setI(i + 1))

  useEffect(() => { step?.enter?.() }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the target as the layout moves (sheets open, the dock resizes).
  useEffect(() => {
    if (!step?.target) { setBox(null); return }
    const measure = () => {
      const el = document.querySelector(step.target!)
      const r = el?.getBoundingClientRect()
      setBox((b) => (!r || !r.width ? null : b && b.left === r.left && b.top === r.top && b.width === r.width && b.height === r.height ? b : { left: r.left, top: r.top, width: r.width, height: r.height }))
    }
    measure()
    const t = setInterval(measure, 200)
    addEventListener('resize', measure)
    return () => { clearInterval(t); removeEventListener('resize', measure) }
  }, [step?.target])

  // Done by doing: the step's action on the page moves the tour on. Bound once per step, so
  // the re-render the action itself causes doesn't cancel the pending advance.
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  const complete = !!step?.complete
  useEffect(() => {
    if (!complete) return
    const t = setTimeout(() => advanceRef.current(), 1200)
    return () => clearTimeout(t)
  }, [complete, i])
  useEffect(() => {
    const on = step?.on
    if (!on) return
    const sel = on.selector ?? step.target!
    let t = 0
    const later = (ms: number) => { clearTimeout(t); t = window.setTimeout(() => advanceRef.current(), ms) }
    const hit = (e: Event) => { if ((e.target as Element | null)?.closest?.(sel)) later(on.event === 'input' ? 900 : 350) }
    const key = (e: KeyboardEvent) => { if (on.key && e.key === on.key) later(350) }
    document.addEventListener(on.event, hit, true)
    document.addEventListener('keydown', key, true)
    return () => { clearTimeout(t); document.removeEventListener(on.event, hit, true); document.removeEventListener('keydown', key, true) }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') end() }
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  })

  // Put the card beside the target: right, left, below, above, else bottom centre.
  useLayoutEffect(() => {
    const c = card.current
    if (!c) return
    const W = c.offsetWidth, H = c.offsetHeight, vw = innerWidth, vh = innerHeight, m = 16, g = 14
    const clampX = (x: number) => Math.max(m, Math.min(vw - W - m, x)), clampY = (y: number) => Math.max(m, Math.min(vh - H - m, y))
    if (!box) { setPos({ left: (vw - W) / 2, top: clampY((vh - H) / 2) }); return }
    const tries = [
      { left: box.left + box.width + g, top: clampY(box.top), ok: box.left + box.width + g + W <= vw - m },
      { left: box.left - g - W, top: clampY(box.top), ok: box.left - g - W >= m },
      { left: clampX(box.left), top: box.top + box.height + g, ok: box.top + box.height + g + H <= vh - m },
      { left: clampX(box.left), top: box.top - g - H, ok: box.top - g - H >= m },
    ]
    const p = tries.find((t) => t.ok) ?? { left: (vw - W) / 2, top: vh - H - m }
    setPos({ left: p.left, top: p.top })
  }, [box, i])

  if (!step) return null
  return <>
    {box && <div className="tour-spot" aria-hidden="true" style={{ left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 }} />}
    <div ref={card} className="tour-card dc-panel" role="dialog" aria-modal="false" aria-labelledby="tour-h" aria-describedby="tour-b"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }} onClick={(e) => e.stopPropagation()}>
      <div className="tour-top"><span className="dc-faint">{i + 1} of {steps.length}</span><button className="dc-btn dc-btn--quiet dc-btn--sm" onClick={end}>Skip tour</button></div>
      <h2 id="tour-h">{step.title}</h2>
      <div id="tour-b" className="tour-body">{step.body}</div>
      <p className="tour-ask">{step.ask}</p>
      <div className="tour-foot">
        <div className="tour-dots" aria-hidden="true">{steps.map((s, k) => <i key={s.id} className={k === i ? 'on' : k < i ? 'past' : ''} />)}</div>
        <button className={`dc-btn ${last ? 'dc-btn--primary' : 'dc-btn--outline'}`} onClick={() => { step.next?.run?.(); advance() }}>{step.next?.label ?? (last ? 'Done' : 'Next')}</button>
      </div>
    </div>
  </>
}
