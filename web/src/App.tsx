import { PhoneOutgoing } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { BriefCard } from './BriefCard'
import { CallDemo } from './CallDemo'
import type { Brief } from './policy'

const initialBrief: Brief = {
  item: '2016 Ford Focus 1.0 Titanium, 58k miles',
  ask: 9200,
  fairLow: 7800,
  fairHigh: 8400,
  ceiling: 8500,
  hoursLeft: 72,
}

export default function App() {
  const [brief, setBrief] = useState(initialBrief)
  const [startKey, setStartKey] = useState(0)
  const reduce = useReducedMotion()
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
        }

  return (
    <>
      <header className="mx-auto flex h-16 max-w-6xl items-center px-4 md:px-8">
        <span className="text-lg font-semibold tracking-tight">Haggle</span>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 md:px-8 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <motion.h1 {...enter(0)} className="text-4xl leading-[1.05] font-semibold tracking-tighter md:text-5xl lg:text-[3.5rem]">
              Name your price.
              <br />
              Haggle makes the call.
            </motion.h1>
            <motion.p {...enter(0.08)} className="mt-6 max-w-[44ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              Haggle's AI agent phones the seller, negotiates live, and brings back a deal for you to approve.
            </motion.p>
            <motion.div {...enter(0.16)} className="mt-8">
              <button
                onClick={() => setStartKey((k) => k + 1)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-3 font-medium text-white transition hover:bg-emerald-800 active:scale-[0.98] dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300"
              >
                <PhoneOutgoing size={18} weight="bold" /> Watch a call
              </button>
            </motion.div>
          </div>
          <motion.div {...enter(0.12)}>
            <BriefCard brief={brief} onChange={setBrief} />
          </motion.div>
        </section>

        <CallDemo brief={brief} startKey={startKey} />
      </main>
    </>
  )
}
