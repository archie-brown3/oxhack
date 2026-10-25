// The Engine tab: a replica of MiroFish's UI (Graph / Split / Workbench, Steps 1-5) on the recorded data.
// Nothing is fetched from the MiroFish backend. The main time bar picks the step (`step`); the rounds of
// that step replay here, so the graph grows as they play. SIMULATED and RECORDED.
// Local live mode (task 156, `live`): the same components render the armed simulation as it runs, polled
// from the pipeline's live server at /live (live.ts), or the epoch prepared before judging (report tab).
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
import { Step5Interaction, type Step5Live } from './replica/Step5Interaction.tsx'
import { liveRound, useLive, type LiveMode } from './live.ts'
import { LiveArm, LiveResult } from './LivePanel.tsx'
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
  /** Local only (?live=1 or ?live=report on localhost): run the armed simulation, or show the prepared epoch. */
  live?: LiveMode | null
}

export function EngineScreen({ futureId, step, live = null }: Props) {
  const [recorded, setRecorded] = useState<ReplicaData | null | undefined>(undefined)
  const [mode, setMode] = useState<ViewMode>('split')
  const [mf, setMf] = useState(live === 'report' ? 4 : 3) // MiroFish's Step 1..5; opens on Run Simulation, where the rounds replay
  const [round, setRound] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [logs, setLogs] = useState<LogLine[]>([])
  const log = useCallback((msg: string) => setLogs((l) => [...l.slice(-99), { time: stamp(), msg }]), [])
  const lv = useLive(live)

  useEffect(() => {
    if (live) return
    let on = true
    setRecorded(undefined)
    loadReplica(futureId, step).then((d) => { if (on) { setRecorded(d); setRound(0); setPlaying(true); setLogs([]) } })
    return () => { on = false }
  }, [futureId, step, live])

  // Live: the replica payload comes from the live server; undefined while loading, null before a run exists.
  const liveData: ReplicaData | null | undefined = live === 'report'
    ? (lv.report ? { project: lv.report.project, step: lv.report.step, spike: false } : undefined)
    : live === 'run' ? (lv.state ? (lv.state.replica && lv.state.project ? { project: lv.state.project, step: lv.state.replica, spike: false } : null) : undefined)
    : undefined
  const data = live ? liveData : recorded
  const phase = lv.state?.run.phase ?? 'idle'

  const rounds = data ? roundsOf(data.step) : 0
  // The rounds replay while the step is on screen; the time bar picking a new step restarts them.
  useEffect(() => {
    if (live || !playing || !data || round >= rounds) return
    const id = setTimeout(() => setRound((r) => r + 1), ROUND_MS)
    return () => clearTimeout(id)
  }, [live, playing, data, round, rounds])
  useEffect(() => { if (!live && data) log(round === 0 ? `Replaying future ${futureId}, step ${step} (${rounds} rounds)` : `Round ${Math.min(round, rounds)}/${rounds} done`) }, [round]) // eslint-disable-line react-hooks/exhaustive-deps
  // Live: the round is wherever the runner is; when the run ends the result pane opens once.
  const shownRound = live === 'run' && data ? liveRound(data.step, phase) : live === 'report' ? rounds : round
  useEffect(() => { if (live === 'run' && phase === 'readout') setMf(4) }, [live, phase])

  // Steps 1-2 show the graph as built before the simulation; Step 3 grows it round by round; Step 4-5 are final.
  // Live runs keep graph memory off, so the Step 1 graph stands as built.
  const graph = useMemo(() => {
    if (live) return data?.step.graph ?? lv.state?.graph ?? null
    if (!data) return null
    const r = mf <= 2 ? 0 : mf === 3 ? round : rounds
    return graphAt(data.step.graph, cutoffAt(data.step, r))
  }, [data, live, lv.state?.graph, mf, round, rounds])

  const go = (n: number) => { setMf(Math.max(1, Math.min(5, n))); log(t('log.enterStep', { step: n, name: tm('main.stepNames')[n - 1] })) }
  const toggleMax = () => setMode((m) => (m === 'graph' ? 'split' : 'graph'))
  const startLive = () => { lv.start().then((ok) => { if (ok) setMf(3) }) }

  const liveLogs: LogLine[] = useMemo(() => (lv.state?.run.log ?? []).map((l) => ({ time: l.t.slice(11, 23), msg: l.msg })), [lv.state?.run.log])
  const shownLogs = live === 'run' ? liveLogs : logs
  const simulating = live === 'run' ? phase === 'running' : mf === 3 && playing && round < rounds
  const status = live === 'run'
    ? (lv.error ? ['error', 'Live server down'] : phase === 'running' ? ['processing', `Running · round ${Math.min(shownRound, rounds)}/${rounds || '–'}`] : phase === 'readout' ? ['processing', 'Reading out'] : phase === 'done' ? ['completed', 'Completed'] : phase === 'failed' ? ['error', 'Failed'] : lv.state?.armed && !lv.state.armed.usedAt ? ['completed', 'Armed'] : ['completed', 'Idle'])
    : !data ? ['processing', 'Loading'] : simulating ? ['processing', 'Running'] : mf === 3 ? ['completed', 'Completed'] : mf === 4 ? ['completed', 'Completed'] : ['completed', 'Ready']
  const tag = live === 'run' ? 'LIVE · SIMULATED' : live === 'report' ? 'SIMULATED · RECORDED · prepared epoch' : data?.spike ? 'SIMULATED · RECORDED · stand-in data' : 'SIMULATED · RECORDED'
  const canStart = !!lv.state?.armed && !lv.state.armed.usedAt && phase !== 'running' && phase !== 'readout'

  // Step 5 talks to MiroFish only locally: the report agent for this sim, interviews while its environment is alive.
  const step5: Step5Live | null = live && data ? { simulationId: data.step.simulation.simulation_id, agents: (data.step.config?.agent_configs ?? []).map((a) => ({ id: a.agent_id, name: a.entity_name })), label: live === 'report' ? 'prepared epoch' : 'live run' } : null

  const left = mode === 'graph' ? { width: '100%' } : mode === 'workbench' ? { width: '0%', opacity: 0 } : { width: '50%' }
  const right = mode === 'workbench' ? { width: '100%' } : mode === 'graph' ? { width: '0%', opacity: 0 } : { width: '50%' }

  return (
    <div id="engine-replica" className={`mf${live ? ' mf-live' : ''}`} role="region" aria-label="MiroFish replica">
      <header className="mf-header">
        <div className="mf-header-left"><div className="mf-brand">MIROFISH</div><span className={`mf-tag${live === 'run' ? ' live' : ''}`}>{tag}</span></div>
        <div className="mf-header-center">
          <div className="mf-view-switcher">
            {(['graph', 'split', 'workbench'] as ViewMode[]).map((m) => (
              <button key={m} className={`mf-switch-btn${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>{t(`main.layout${m[0].toUpperCase()}${m.slice(1)}`)}</button>
            ))}
          </div>
        </div>
        <div className="mf-header-right">
          {live === 'run' && canStart && <button className="mf-btn" onClick={startLive}>Run live</button>}
          <div className="mf-workflow-step">
            <span className="mf-step-num">Step {mf}/5</span>
            <span className="mf-step-name">{live === 'run' && mf === 4 ? 'Step result' : tm('main.stepNames')[mf - 1]}</span>
          </div>
          <div className="mf-step-divider" />
          <span className={`mf-status ${status[0]}`}><span className="mf-dot" />{status[1]}</span>
        </div>
      </header>

      <main className="mf-content">
        <div className="mf-panel left" style={left}>
          <GraphPanel graph={graph} currentPhase={mf === 3 ? 3 : 2} isSimulating={!live && simulating} recorded onToggleMaximize={toggleMax} />
          {!live && mf === 3 && rounds > 0 && (
            <div className="mf-replay" aria-label="Round replay">
              <button className="mf-btn" onClick={() => { if (round >= rounds) setRound(0); setPlaying(!(playing && round < rounds)) }}>{playing && round < rounds ? 'Pause' : round >= rounds ? 'Replay' : 'Play'}</button>
              <input type="range" min={0} max={rounds} value={round} onChange={(e) => { setPlaying(false); setRound(+e.target.value) }} aria-label="Round" />
              <span className="mf-replay-n">Round {Math.min(round, rounds)}/{rounds}</span>
            </div>
          )}
          {live && <div className="mf-replay" aria-label="Live note"><span className="mf-replay-n">{live === 'run' ? 'Step 1 graph as built · graph memory off' : `Prepared epoch · ${lv.report?.epoch.simulation_id ?? ''}`}</span></div>}
        </div>
        <div className="mf-panel right" style={right}>
          {live === 'run' && !data && <LiveArm state={lv.state} error={lv.error} onStart={startLive} />}
          {live === 'report' && data === undefined && <div className="mf-empty">{lv.error ?? 'Loading the prepared epoch…'}</div>}
          {!live && data === undefined && <div className="mf-empty">Loading…</div>}
          {!live && data === null && <div className="mf-empty">No recording for this future yet.</div>}
          {data && mf === 1 && <Step1GraphBuild project={data.project} graph={graph} logs={shownLogs} onNext={() => go(2)} />}
          {data && mf === 2 && <Step2EnvSetup project={data.project} step={data.step} graph={graph} logs={shownLogs} onBack={() => go(1)} onNext={() => go(3)} onLog={log} />}
          {data && mf === 3 && <Step3Simulation step={data.step} recorded={!!data.step.report?.markdown_content} round={shownRound} rounds={rounds} logs={shownLogs} onBack={() => go(2)} onNext={() => go(4)} onLog={log} />}
          {data && mf === 4 && live === 'run' && lv.state && <LiveResult run={lv.state.run} onBack={() => go(3)} onNext={() => go(5)} />}
          {data && mf === 4 && live !== 'run' && <Step4Report step={data.step} project={data.project} logs={shownLogs} spike={data.spike} onBack={() => go(3)} onNext={() => go(5)} onLog={log} />}
          {data && mf === 5 && <Step5Interaction onBack={() => go(4)} live={step5} />}
        </div>
      </main>
    </div>
  )
}
