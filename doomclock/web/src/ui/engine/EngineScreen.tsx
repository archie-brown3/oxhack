// The Engine tab: a replica of MiroFish's UI (Graph / Split / Workbench, Steps 1-5) on the recorded data.
// Nothing is fetched from the MiroFish backend. The main time bar picks the step (`step`); the rounds of
// that step replay here, so the graph grows as they play. SIMULATED and RECORDED.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GraphPanel } from './replica/GraphPanel.tsx'
import { t, tm } from './replica/i18n.ts'
import type { LogLine } from './replica/props.ts'
import { loadReplica, type ReplicaData } from './replica/load.ts'
import { cutoffAt, graphAt, roundsOf } from './replica/replay.ts'
import { Step1GraphBuild } from './replica/Step1GraphBuild.tsx'
import { Step2EnvSetup } from './replica/Step2EnvSetup.tsx'
import { Step3Simulation } from './replica/Step3Simulation.tsx'
import { Step4Report } from './replica/Step4Report.tsx'
import { Step5Interaction } from './replica/Step5Interaction.tsx'
import './replica/replica.css'

/** The avatar manifest entry app/data.ts loads; the replica draws no avatars, so only the type stays. */
export interface Avatar { id: string; name: string; role: string; file: string; aliases: string[] }

type ViewMode = 'graph' | 'split' | 'workbench'
const ROUND_MS = 1100

const stamp = () => { const d = new Date(); return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0') }

interface Props {
  /** The watched future's id (1-3) and the step (1-6) the main time bar is on. */
  futureId: number
  step: number
}

export function EngineScreen({ futureId, step }: Props) {
  const [data, setData] = useState<ReplicaData | null | undefined>(undefined)
  const [mode, setMode] = useState<ViewMode>('split')
  const [mf, setMf] = useState(3) // MiroFish's Step 1..5; opens on Run Simulation, where the rounds replay
  const [round, setRound] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [logs, setLogs] = useState<LogLine[]>([])
  const log = useCallback((msg: string) => setLogs((l) => [...l.slice(-99), { time: stamp(), msg }]), [])

  useEffect(() => {
    let live = true
    setData(undefined)
    loadReplica(futureId, step).then((d) => { if (live) { setData(d); setRound(0); setPlaying(true); setLogs([]) } })
    return () => { live = false }
  }, [futureId, step])

  const rounds = data ? roundsOf(data.step) : 0
  // The rounds replay while the step is on screen; the time bar picking a new step restarts them.
  useEffect(() => {
    if (!playing || !data || round >= rounds) return
    const id = setTimeout(() => setRound((r) => r + 1), ROUND_MS)
    return () => clearTimeout(id)
  }, [playing, data, round, rounds])
  useEffect(() => { if (data) log(round === 0 ? `Replaying future ${futureId}, step ${step} (${rounds} rounds)` : `Round ${Math.min(round, rounds)}/${rounds} done`) }, [round]) // eslint-disable-line react-hooks/exhaustive-deps

  // Steps 1-2 show the graph as built before the simulation; Step 3 grows it round by round; Step 4-5 are final.
  const graph = useMemo(() => {
    if (!data) return null
    const r = mf <= 2 ? 0 : mf === 3 ? round : rounds
    return graphAt(data.step.graph, cutoffAt(data.step, r))
  }, [data, mf, round, rounds])

  const go = (n: number) => { setMf(Math.max(1, Math.min(5, n))); log(t('log.enterStep', { step: n, name: tm('main.stepNames')[n - 1] })) }
  const toggleMax = () => setMode((m) => (m === 'graph' ? 'split' : 'graph'))

  const phase = mf === 3 ? 3 : 2
  const simulating = mf === 3 && playing && round < rounds
  const status = !data ? ['processing', 'Loading'] : simulating ? ['processing', 'Running'] : mf === 3 ? ['completed', 'Completed'] : mf === 4 ? ['completed', 'Completed'] : ['completed', 'Ready']

  const left = mode === 'graph' ? { width: '100%' } : mode === 'workbench' ? { width: '0%', opacity: 0 } : { width: '50%' }
  const right = mode === 'workbench' ? { width: '100%' } : mode === 'graph' ? { width: '0%', opacity: 0 } : { width: '50%' }

  return (
    <div id="engine-replica" className="mf" role="region" aria-label="MiroFish replica">
      <header className="mf-header">
        <div className="mf-header-left"><div className="mf-brand">MIROFISH</div><span className="mf-tag">{data?.spike ? 'SIMULATED · RECORDED · stand-in data' : 'SIMULATED · RECORDED'}</span></div>
        <div className="mf-header-center">
          <div className="mf-view-switcher">
            {(['graph', 'split', 'workbench'] as ViewMode[]).map((m) => (
              <button key={m} className={`mf-switch-btn${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>{t(`main.layout${m[0].toUpperCase()}${m.slice(1)}`)}</button>
            ))}
          </div>
        </div>
        <div className="mf-header-right">
          <div className="mf-workflow-step">
            <span className="mf-step-num">Step {mf}/5</span>
            <span className="mf-step-name">{tm('main.stepNames')[mf - 1]}</span>
          </div>
          <div className="mf-step-divider" />
          <span className={`mf-status ${status[0]}`}><span className="mf-dot" />{status[1]}</span>
        </div>
      </header>

      <main className="mf-content">
        <div className="mf-panel left" style={left}>
          <GraphPanel graph={graph} currentPhase={phase} isSimulating={simulating} recorded onToggleMaximize={toggleMax} />
          {mf === 3 && rounds > 0 && (
            <div className="mf-replay" aria-label="Round replay">
              <button className="mf-btn" onClick={() => { if (round >= rounds) setRound(0); setPlaying(!(playing && round < rounds)) }}>{playing && round < rounds ? 'Pause' : round >= rounds ? 'Replay' : 'Play'}</button>
              <input type="range" min={0} max={rounds} value={round} onChange={(e) => { setPlaying(false); setRound(+e.target.value) }} aria-label="Round" />
              <span className="mf-replay-n">Round {Math.min(round, rounds)}/{rounds}</span>
            </div>
          )}
        </div>
        <div className="mf-panel right" style={right}>
          {data === undefined && <div className="mf-empty">Loading…</div>}
          {data === null && <div className="mf-empty">No recording for this future yet.</div>}
          {data && mf === 1 && <Step1GraphBuild project={data.project} graph={graph} logs={logs} onNext={() => go(2)} />}
          {data && mf === 2 && <Step2EnvSetup project={data.project} step={data.step} graph={graph} logs={logs} onBack={() => go(1)} onNext={() => go(3)} onLog={log} />}
          {data && mf === 3 && <Step3Simulation step={data.step} round={round} rounds={rounds} logs={logs} onBack={() => go(2)} onNext={() => go(4)} onLog={log} />}
          {data && mf === 4 && <Step4Report step={data.step} project={data.project} logs={logs} spike={data.spike} onBack={() => go(3)} onNext={() => go(5)} onLog={log} />}
          {data && mf === 5 && <Step5Interaction onBack={() => go(4)} />}
        </div>
      </main>
    </div>
  )
}
