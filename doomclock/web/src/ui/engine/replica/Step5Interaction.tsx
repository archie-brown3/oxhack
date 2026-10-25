import { useEffect, useState } from 'react'
import { t } from './i18n.ts'
import { liveChat, liveEnvStatus, liveInterview, type ChatTurn } from '../live.ts'

// Step 5 (chat with the report agent, interview an individual) needs the live MiroFish backend. The replica shows
// MiroFish's own header and tool names, and says so. Locally (task 156, `live`), both talk to MiroFish's real
// routes through the pipeline's live server: the report agent for any sim, interviews while the run's
// environment is alive. SIMULATED: these are simulated accounts answering in character.
export interface Step5Live { simulationId: string; agents: { id: number; name: string }[]; label: string }

export function Step5Interaction({ onBack, live = null }: { onBack: () => void; live?: Step5Live | null }) {
  if (!live) return (
    <div className="mf-step5">
      <div className="mf-step5-card">
        <div className="mf-step5-title">{t('step5.interactiveTools')}</div>
        <p>{t('step5.chatWithReportAgent')} · {t('step5.chatWithAgent')}</p>
        <p className="mf-step5-note">Available when running live. This recording has no backend to answer.</p>
        <button className="mf-btn" onClick={onBack}>← Back</button>
      </div>
    </div>
  )
  return (
    <div className="mf-step5 mf-live-step5">
      <div className="mf-live-head"><button className="mf-btn" onClick={onBack}>← Back</button><h2>{t('step5.interactiveTools')} <small>{live.label} · {live.simulationId} · simulated</small></h2></div>
      <div className="mf-live-chat">
        <ReportChat sim={live.simulationId} />
        <Interview sim={live.simulationId} agents={live.agents} />
      </div>
    </div>
  )
}

function ReportChat({ sim }: { sim: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const send = async () => {
    const q = text.trim(); if (!q || busy) return
    setText(''); setErr(null); setBusy(true)
    const history = turns
    setTurns([...history, { role: 'user', content: q }])
    try { const r = await liveChat(sim, q, history); setTurns([...history, { role: 'user', content: q }, { role: 'assistant', content: r.response || t('step5.noResponse') }]) }
    catch (e) { setErr(t('step5.errorOccurred', { error: String((e as Error).message ?? e) })) }
    setBusy(false)
  }
  return (
    <div className="mf-step5-card mf-live-card">
      <div className="mf-step5-title">{t('step5.reportAgentChat')}</div>
      <p className="mf-step5-note">{t('step5.reportAgentDesc')}</p>
      <div className="mf-live-msgs">
        {turns.length === 0 && <p className="mf-live-note">{t('step5.chatEmptyReportAgent')}</p>}
        {turns.map((m, i) => <div key={i} className={`mf-live-msg ${m.role}`}>{m.content}</div>)}
        {busy && <div className="mf-live-msg assistant mf-live-wait">The report agent is searching the graph and the posts… (10–60 s)</div>}
      </div>
      {err && <p className="mf-live-err">{err}</p>}
      <form className="mf-live-ask" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('step5.chatInputPlaceholder')} disabled={busy} />
        <button className="mf-btn" type="submit" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  )
}

function Interview({ sim, agents }: { sim: string; agents: { id: number; name: string }[] }) {
  const [agent, setAgent] = useState<number>(agents[0]?.id ?? 0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [env, setEnv] = useState<{ env_alive: boolean; message: string } | null>(null)
  const [answers, setAnswers] = useState<{ who: string; q: string; a: string }[]>([])
  useEffect(() => { let on = true; liveEnvStatus(sim).then((s) => { if (on) setEnv(s) }, () => { if (on) setEnv({ env_alive: false, message: 'env-status failed' }) }); return () => { on = false } }, [sim])
  const ask = async () => {
    const q = text.trim(); if (!q || busy) return
    setErr(null); setBusy(true)
    const who = agents.find((a) => a.id === agent)?.name ?? `agent ${agent}`
    try { const r = await liveInterview(sim, agent, q); setAnswers((l) => [{ who, q, a: r.result?.response ?? r.response ?? t('step5.noResponse') }, ...l]); setText('') }
    catch (e) { setErr(t('step5.errorOccurred', { error: String((e as Error).message ?? e) })) }
    setBusy(false)
  }
  return (
    <div className="mf-step5-card mf-live-card">
      <div className="mf-step5-title">{t('step5.chatWithAgent')}</div>
      <p className="mf-step5-note">{t('step5.agentsAvailable', { count: agents.length })} · {env ? (env.env_alive ? 'environment alive: interviews on' : 'environment closed: interviews need a run whose environment is still open (the latest live run)') : 'checking the environment…'}</p>
      <form className="mf-live-ask" onSubmit={(e) => { e.preventDefault(); ask() }}>
        <select value={agent} onChange={(e) => setAgent(+e.target.value)} aria-label={t('step5.selectChatTarget')}>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('step5.chatInputPlaceholder')} disabled={busy || env?.env_alive === false} />
        <button className="mf-btn" type="submit" disabled={busy || !text.trim() || env?.env_alive === false}>Ask</button>
      </form>
      {busy && <p className="mf-live-wait">Interviewing… (the agent answers in character, 10–60 s)</p>}
      {err && <p className="mf-live-err">{err}</p>}
      <div className="mf-live-msgs">
        {answers.length === 0 && !busy && <p className="mf-live-note">{t('step5.chatEmptyAgent')}</p>}
        {answers.map((x, i) => <div key={i} className="mf-live-answer"><div className="mf-live-msg user">{x.who}: {x.q}</div><div className="mf-live-msg assistant">{x.a}</div></div>)}
      </div>
    </div>
  )
}
