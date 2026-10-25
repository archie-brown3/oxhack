// Live mode of the Engine tab (task 156), local only. `?live=1` runs the MiroFish simulation armed by
// `node doomclock/pipeline/world/live.ts prepare` through that script's live server, which the Vite dev and
// preview servers proxy at /live; `?live=report` opens the epoch prepared before judging. Off on any host but
// localhost, and this is the only file that asks for anything MiroFish produces live: the browser never calls
// :5001 itself (web/scripts/check-inert.mjs proves the production bundle names none of it).
import { useEffect, useState } from 'react'
import type { WorldEvent } from '../../contracts.ts'
import type { GraphData, ReplicaProject, ReplicaStep } from './replica/types.ts'

export type LiveMode = 'run' | 'report'
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]'])

/** True on localhost, where the live server can be reached; the recorded Engine tab's Step 5 is on only here. */
export const isLocal = () => LOCAL.has(location.hostname)

/** `run` for ?live=1 (or any value but `report`), `report` for ?live=report, null elsewhere or off localhost. */
export function liveMode(url: URL): LiveMode | null {
  const v = url.searchParams.get('live')
  if (!v || v === '0' || !LOCAL.has(url.hostname)) return null
  return v === 'report' ? 'report' : 'run'
}

export type LivePhase = 'idle' | 'running' | 'readout' | 'done' | 'failed'
export interface LiveResult {
  step: number; start: string; end: string; events: WorldEvent[]; rejected: number; readoutOk: boolean
  rubric: Record<string, number>; rubricOk: boolean; baseline: Record<string, number>
  startAnchors: Record<string, number>; anchors: Record<string, number>
  date10Before: number; date10: number; rulesOffDate10: number; noEventsDate10: number
  llmCost: number; rulesVersion: string; label: string
}
export interface LiveRun {
  armed: { simulation_id: string; future: number; rounds: number } | null
  phase: LivePhase; startedAt: string | null; endedAt: string | null
  log: { t: string; msg: string }[]; run: { wall_s: number; cost_usd: number } | null; result: LiveResult | null; error: string | null
}
export interface LiveArmed { simulation_id: string; future: number; rounds: number; preparedAt: string; usedAt: string | null }
export interface LiveState { armed: LiveArmed | null; run: LiveRun; project: ReplicaProject | null; /** The future's Step 1 graph, shown before a run exists. */ graph: GraphData | null; replica: ReplicaStep | null; backend: string; now: string }
export interface LiveReport { project: ReplicaProject; step: ReplicaStep; epoch: { simulation_id: string; future: number; rounds: number; report_id: string; run: { wall_s: number; cost_usd: number }; report_s: number; usedAt: string } }

const POLL_MS = 2000
export const SERVER_HINT = 'node doomclock/pipeline/world/live.ts serve'

/** Run mode polls /live/state every 2 s; report mode fetches /live/report once. `error` is set while the live server is unreachable. */
export function useLive(mode: LiveMode | null) {
  const [state, setState] = useState<LiveState | null>(null)
  const [report, setReport] = useState<LiveReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!mode) return
    let on = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const r = await fetch(mode === 'run' ? '/live/state' : '/live/report', { cache: 'no-store' })
        const j = await r.json().catch(() => null)
        if (!on) return
        if (!r.ok || !j) throw new Error(j?.error ?? `the live server is not answering at /live (HTTP ${r.status}); start it with: ${SERVER_HINT}`)
        if (mode === 'run') setState(j as LiveState); else setReport(j as LiveReport)
        setError(null)
      } catch (e) { if (on) setError(String((e as Error).message ?? e)) }
      if (on && mode === 'run') timer = setTimeout(tick, POLL_MS)
    }
    tick()
    return () => { on = false; clearTimeout(timer) }
  }, [mode])
  const start = async () => {
    const r = await fetch('/live/start', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) setError(j.error ?? `HTTP ${r.status}`)
    return r.ok
  }
  return { state, report, error, start }
}

/** The round the live replica shows: every action that has arrived; all rounds once the runner has finished. */
export function liveRound(step: ReplicaStep, phase: LivePhase): number {
  const rounds = step.runStatus?.total_rounds || 0
  const arrived = Math.max(0, ...step.actions.map((a) => a.round_num + 1))
  const rs = step.runStatus?.runner_status
  if (phase !== 'running' || rs === 'completed' || rs === 'stopped' || rs === 'failed') return rounds || arrived
  return rounds ? Math.min(rounds, arrived) : arrived
}

/** "Jun 2032" for a decimal year. */
export const monthOf = (y: number) => { const yr = Math.floor(y); return new Date(Date.UTC(yr, Math.min(11, Math.floor((y - yr) * 12)), 1)).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) }

// ---------- Step 5 (local only): MiroFish's report-agent chat and agent interviews, through the live server ----------

async function post<T>(path: string, payload: unknown): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
  return j as T
}
export type ChatTurn = { role: 'user' | 'assistant'; content: string }
/** POST /api/report/chat: the report agent answers with its retrieval tools over this sim's graph and posts. */
export const liveChat = (simulation_id: string, message: string, chat_history: ChatTurn[]) =>
  post<{ response: string; tool_calls?: unknown[]; sources?: unknown[] }>('/live/chat', { simulation_id, message, chat_history })
/** POST /api/simulation/interview (twitter): one agent answers in character. Needs the run's environment alive. */
export const liveInterview = (simulation_id: string, agent_id: number, prompt: string) =>
  post<{ result?: { response?: string }; response?: string }>('/live/interview', { simulation_id, agent_id, prompt })
export const liveEnvStatus = (simulation_id: string) => post<{ env_alive: boolean; message: string }>('/live/env-status', { simulation_id })
