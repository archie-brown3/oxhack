import { CheckCircle, PhoneDisconnect, PhoneOutgoing, SpeakerHigh, SpeakerSlash, XCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { deadlineLabel } from './BriefCard'
import { OfferChart } from './OfferChart'
import { baseline, gbp, plan, roundsFor, shouldAccept, type Brief, type Plan } from './policy'

type Mode = 'sim' | 'you'
type Who = 'agent' | 'seller'
type Msg = { id: number; who: Who; text: string }
type Phase = 'idle' | 'seller-turn' | 'thinking' | 'deal' | 'walked'

type Call = {
  phase: Phase
  msgs: Msg[]
  round: number
  rounds: number
  sellerAsk: number
  lastOffer: number
  plan: Plan | null
  deal: number | null
}

/** The simulated seller's private floor. The agent never sees it. */
const RESERVATION = 8050
const TURN_MS = 1700
const round50 = (n: number) => Math.round(n / 50) * 50

const lines = {
  open: (item: string, o: number) =>
    `Hi, I'm an AI agent calling for a buyer about your ${item}. They've checked the MOT history and can offer ${gbp(o)} today.`,
  counter: (o: number) => `Understood. With the advisories on the last MOT, they can come up to ${gbp(o)}. Can you do that?`,
  final: (o: number) => `This is their final offer before the deadline: ${gbp(o)}, and they can collect this week.`,
  accept: (c: number) => `${gbp(c)} works. I'll send it to the buyer to approve, and they'll confirm shortly.`,
  walk: () => `Thanks for your time. That's above their limit, so we'll leave it there.`,
  sellerCounter: (c: number) => `I can't go that low. The lowest I'd take is ${gbp(c)}.`,
  sellerAccept: (o: number) => `Go on then, ${gbp(o)} it is.`,
}

const idle = (brief: Brief): Call => ({
  phase: 'idle',
  msgs: [],
  round: 0,
  rounds: roundsFor(brief.hoursLeft),
  sellerAsk: brief.ask,
  lastOffer: 0,
  plan: null,
  deal: null,
})

export function CallDemo({ brief, startKey }: { brief: Brief; startKey: number }) {
  const [mode, setMode] = useState<Mode>('sim')
  const [voice, setVoice] = useState(false)
  const [call, setCall] = useState<Call>(() => idle(brief))
  const [counter, setCounter] = useState(8600)
  const timers = useRef<number[]>([])
  const frozen = useRef(brief) // brief as it was when the call started
  const nextId = useRef(0)
  const section = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => () => clearTimers(), [])

  const later = (fn: () => void) => timers.current.push(window.setTimeout(fn, TURN_MS))

  const speak = (who: Who, text: string) => {
    if (!voice || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    u.pitch = who === 'seller' ? 0.8 : 1
    window.speechSynthesis.speak(u)
  }

  const say = (who: Who, text: string, patch: Partial<Call> = {}) => {
    speak(who, text)
    setCall((c) => ({ ...c, ...patch, msgs: [...c.msgs, { id: nextId.current++, who, text }] }))
  }

  const sellerTurn = (offer: number, sellerAsk: number, round: number, rounds: number) => {
    if (offer >= RESERVATION) {
      say('seller', lines.sellerAccept(offer), { phase: 'deal', deal: offer })
      return
    }
    const c = Math.max(RESERVATION, round50((sellerAsk + offer) / 2))
    say('seller', lines.sellerCounter(c), { phase: 'thinking' })
    later(() => agentTurn(c, round, rounds, offer, 'sim'))
  }

  const agentTurn = (c: number, round: number, rounds: number, lastOffer: number, m: Mode) => {
    const b = frozen.current
    const roundsLeft = rounds - round
    if (shouldAccept(b, c, round, roundsLeft, lastOffer)) {
      say('agent', lines.accept(c), { phase: 'deal', deal: c })
      return
    }
    if (roundsLeft <= 0) {
      say('agent', lines.walk(), { phase: 'walked' })
      return
    }
    const next = round + 1
    const p = plan(b, c, next, roundsLeft, lastOffer + 25)
    const text = next === rounds ? lines.final(p.offer) : lines.counter(p.offer)
    say('agent', text, {
      phase: m === 'sim' ? 'thinking' : 'seller-turn',
      round: next,
      sellerAsk: c,
      lastOffer: p.offer,
      plan: p,
    })
    if (m === 'sim') later(() => sellerTurn(p.offer, c, next, rounds))
  }

  const start = (m: Mode = mode) => {
    clearTimers()
    window.speechSynthesis?.cancel()
    frozen.current = brief
    const rounds = roundsFor(brief.hoursLeft)
    const p = plan(brief, brief.ask, 1, rounds)
    setCall({ ...idle(brief), rounds, round: 1, lastOffer: p.offer, plan: p })
    say('agent', lines.open(brief.item, p.offer), { phase: m === 'sim' ? 'thinking' : 'seller-turn' })
    if (m === 'sim') later(() => sellerTurn(p.offer, brief.ask, 1, rounds))
  }

  const reset = () => {
    clearTimers()
    window.speechSynthesis?.cancel()
    setCall(idle(brief))
  }

  // Hero CTA: scroll here and start the simulated call.
  useEffect(() => {
    if (!startKey) return
    section.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    setMode('sim')
    start('sim')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey])

  const b = call.phase === 'idle' ? brief : frozen.current
  const shown = call.plan ?? plan(b, b.ask, 1, roundsFor(b.hoursLeft))
  const hoursNow = b.hoursLeft - ((Math.max(call.round, 1) - 1) * b.hoursLeft) / call.rounds
  const base = baseline(b)
  const live = call.phase === 'seller-turn' || call.phase === 'thinking'

  return (
    <section ref={section} id="demo" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 md:px-8 md:py-24">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Hear it haggle.</h2>
      <p className="mt-3 max-w-[60ch] text-zinc-600 dark:text-zinc-400">
        The agent says it is an AI, takes every number from the policy, and never goes past your ceiling.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-zinc-200 p-1 dark:border-zinc-800" role="radiogroup" aria-label="Who plays the seller">
          {(
            [
              ['sim', 'Simulated seller'],
              ['you', 'You are the seller'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              disabled={live}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                mode === m
                  ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setVoice((v) => !v)}
          aria-pressed={voice}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {voice ? <SpeakerHigh size={16} /> : <SpeakerSlash size={16} />}
          {voice ? 'Voice on' : 'Voice off'}
        </button>
        {call.phase === 'idle' ? (
          <button
            onClick={() => start()}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white transition active:scale-[0.98] hover:bg-emerald-800 dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300"
          >
            <PhoneOutgoing size={16} weight="bold" /> Start a call
          </button>
        ) : (
          <button
            onClick={reset}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2 text-sm transition active:scale-[0.98] hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <PhoneDisconnect size={16} /> {live ? 'End call' : 'Reset'}
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Transcript */}
        <div className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {call.phase === 'idle' ? (
            <div className="m-auto max-w-[36ch] text-center text-sm text-zinc-500 dark:text-zinc-400">
              Set your ceiling and deadline above, then start a call. Pick "You are the seller" to push back yourself.
            </div>
          ) : (
            <ol className="grid gap-3" aria-live="polite">
              <AnimatePresence initial={false}>
                {call.msgs.map((m) => (
                  <motion.li
                    key={m.id}
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                      m.who === 'agent'
                        ? 'bg-zinc-100 dark:bg-zinc-800'
                        : 'ml-auto bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-100'
                    }`}
                  >
                    <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      {m.who === 'agent' ? 'Haggle (AI)' : 'Seller'}
                    </span>
                    {m.text}
                  </motion.li>
                ))}
              </AnimatePresence>
              {call.phase === 'thinking' && (
                <li className="text-sm text-zinc-500 dark:text-zinc-400" aria-label="Waiting for reply">
                  <motion.span
                    animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    On the line...
                  </motion.span>
                </li>
              )}
            </ol>
          )}

          {call.phase === 'seller-turn' && (
            <div className="mt-auto grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <label htmlFor="counter" className="text-sm text-zinc-600 dark:text-zinc-400">
                Your reply as the seller
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="counter"
                  type="number"
                  step={50}
                  value={counter}
                  onChange={(e) => setCounter(Number(e.target.value))}
                  className="w-32 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none dark:border-zinc-700"
                />
                <button
                  onClick={() => {
                    say('seller', lines.sellerCounter(counter), { phase: 'thinking' })
                    later(() => agentTurn(counter, call.round, call.rounds, call.lastOffer, 'you'))
                  }}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-zinc-50 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Counter
                </button>
                <button
                  onClick={() => say('seller', lines.sellerAccept(call.lastOffer), { phase: 'deal', deal: call.lastOffer })}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm active:scale-[0.98] dark:border-zinc-700"
                >
                  Accept {gbp(call.lastOffer)}
                </button>
                <button
                  onClick={() => say('seller', 'No thanks, not at that price.', { phase: 'walked' })}
                  className="rounded-full px-4 py-2 text-sm text-zinc-600 active:scale-[0.98] dark:text-zinc-400"
                >
                  Hang up
                </button>
              </div>
            </div>
          )}

          {(call.phase === 'deal' || call.phase === 'walked') && (
            <Outcome deal={call.deal} brief={b} baselineEv={base.ev} />
          )}
        </div>

        {/* Decision panel */}
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" aria-label="What the policy is doing">
          <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              Round {Math.max(call.round, 1)} of {call.rounds}
            </span>
            <span>{deadlineLabel(Math.max(1, Math.round(hoursNow)))} left</span>
          </div>
          <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">Next offer</p>
          <p className="text-3xl tracking-tight text-emerald-700 tabular-nums dark:text-emerald-400">
            {gbp(shown.offer)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Chance they accept</dt>
              <dd className="tabular-nums">{Math.round(shown.p * 100)}%</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Seller is asking</dt>
              <dd className="tabular-nums">{gbp(call.sellerAsk)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Expected saving</dt>
              <dd className="tabular-nums">{gbp(shown.ev)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Walk away above</dt>
              <dd className="tabular-nums">{gbp(b.ceiling)}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">Chance of a yes at each price</p>
            <OfferChart plan={shown} ceiling={b.ceiling} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Illustrative coefficients. The fitted model uses held-out 2012-13 eBay Best Offer threads.
          </p>
        </aside>
      </div>
    </section>
  )
}

function Outcome({ deal, brief, baselineEv }: { deal: number | null; brief: Brief; baselineEv: number }) {
  const [approved, setApproved] = useState(false)
  if (deal === null) {
    return (
      <div className="mt-auto flex items-center gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <XCircle size={20} className="text-zinc-500" />
        No deal under your ceiling. Nothing was agreed on your behalf.
      </div>
    )
  }
  const saved = brief.ask - deal
  return (
    <div className="mt-auto grid gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-[1fr_auto] sm:items-end dark:border-zinc-800">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Agreed price, pending your approval</p>
        <p className="text-2xl tabular-nums">{gbp(deal)}</p>
        <p className="mt-1 text-sm">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">{gbp(saved)} saved</span>
          <span className="text-zinc-500 dark:text-zinc-400"> vs asking. Offering 90% expects {gbp(baselineEv)}.</span>
        </p>
      </div>
      <button
        onClick={() => setApproved(true)}
        disabled={approved}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium whitespace-nowrap text-white active:scale-[0.98] disabled:opacity-70 dark:bg-emerald-400 dark:text-zinc-950"
      >
        <CheckCircle size={16} weight="bold" /> {approved ? 'Approved' : 'Approve deal'}
      </button>
    </div>
  )
}
