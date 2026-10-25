// The two live-only panes of the Engine tab (task 156): the arm card with the one Run live control, and the
// step's result after a live run (events read out, the rubric, and the future's 1-in-10 date moved by the
// labelled game rules). SIMULATED throughout; nothing here touches the real clock.
import { Label } from '../Label.tsx'
import { dmy } from '../format.ts'
import { monthOf, SERVER_HINT, type LiveRun, type LiveState } from './live.ts'
import './live.css'

const hms = (iso: string) => iso.slice(11, 19)

export function LiveArm({ state, error, onStart }: { state: LiveState | null; error: string | null; onStart: () => void }) {
  const a = state?.armed ?? null
  const phase = state?.run.phase ?? 'idle'
  const busy = phase === 'running' || phase === 'readout'
  const ready = !!a && !a.usedAt && !busy
  return (
    <div className="mf-live-arm">
      <h2>Run MiroFish live</h2>
      <p className="mf-live-sub"><Label kind="simulated">Live · simulated</Label> One prepared 6-month step of future {a?.future ?? '–'}: 32 accounts on a simulated X, {a?.rounds ?? '–'} rounds on this future's Step 1 knowledge graph.</p>
      <button className="mf-btn mf-live-go" disabled={!ready} onClick={onStart}>{busy ? 'Running…' : 'Run live'}</button>
      {error && <p className="mf-live-err">{error}{/start it with/.test(error) ? '' : ` (live server: ${SERVER_HINT})`}</p>}
      {!error && !a && <p className="mf-live-err">Nothing is armed. Run: node doomclock/pipeline/world/live.ts prepare</p>}
      {a && <dl className="mf-live-meta">
        <dt>Simulation</dt><dd className="mono">{a.simulation_id}</dd>
        <dt>Prepared</dt><dd>{dmy(a.preparedAt)} {hms(a.preparedAt)} UTC{a.usedAt ? ` · already ran at ${hms(a.usedAt)} UTC, run prepare again to re-arm` : ''}</dd>
        <dt>Backend</dt><dd className="mono">{state?.backend}</dd>
      </dl>}
      <p className="mf-live-note">Personas, config and seeds were written before the demo; the button only starts the simulation. Graph memory updates are off for live runs, so the graph on the left is the Step 1 graph as built. Nothing it produces is a forecast; the real clock never moves.</p>
    </div>
  )
}

const DIMS: [string, string][] = [['lossOfControl', 'Loss of control'], ['misuse', 'Misuse'], ['oversight', 'Oversight'], ['racePressure', 'Race pressure']]
const pct = (p: number, d = 0) => `${(p * 100).toFixed(d)}%`
const months = (a: number, b: number) => { const m = Math.round((b - a) * 12); return m === 0 ? 'no change' : `${m > 0 ? '+' : '−'}${Math.abs(m)} mo` }

export function LiveResult({ run, onBack, onNext }: { run: LiveRun; onBack: () => void; onNext: () => void }) {
  const r = run.result
  return (
    <div className="mf-live-result">
      <div className="mf-live-head">
        <button className="mf-btn" onClick={onBack}>← Simulation</button>
        <h2>Step result <Label kind="simulated">Simulated</Label> <Label kind="game-rule">Game rule</Label></h2>
        <span className={`mf-status ${run.phase === 'done' ? 'completed' : run.phase === 'failed' ? 'error' : 'processing'}`}><span className="mf-dot" />{run.phase === 'readout' ? 'Reading out' : run.phase === 'done' ? 'Done' : run.phase === 'failed' ? 'Failed' : run.phase}</span>
        <button className="mf-btn" onClick={onNext}>Interview the world →</button>
      </div>
      {run.error && <p className="mf-live-err">{run.error}</p>}
      {r && <>
        <section>
          <h3>Events read out of the posts <small>{r.events.length} kept, {r.rejected} rejected · only accounts with standing can make events</small></h3>
          {r.events.length === 0 && <p className="mf-live-note">No post by an account with standing announced anything that counts as an event, so only time and noise move the odds.</p>}
          <ul className="mf-live-events">
            {r.events.map((e, i) => <li key={i}><span className="mf-live-when">{dmy(e.ts)}</span><b>{e.who ?? 'Unknown'}</b> {e.title}<span className="mf-live-type">{e.type ?? 'event'}</span></li>)}
          </ul>
        </section>
        <section>
          <h3>Danger rubric <small>scored from the events; baseline is today's real record</small></h3>
          <table className="mf-live-table"><tbody>
            {DIMS.map(([k, name]) => <tr key={k}><td>{name}</td><td className="mono">{r.baseline[k] ?? 0}</td><td>→</td><td className="mono">{r.rubric[k] ?? 0}</td></tr>)}
          </tbody></table>
          {!r.rubricOk && <p className="mf-live-note">The rubric call failed or returned no change; the baseline stands.</p>}
        </section>
        <section>
          <h3>This future's clock <Label kind="game-rule">Game rule</Label> <small>{r.rulesVersion}</small></h3>
          <table className="mf-live-table"><tbody>
            <tr><td>1-in-10 date before</td><td className="mono">{monthOf(r.date10Before)}</td><td /><td /></tr>
            <tr><td>After this step</td><td className="mono">{monthOf(r.date10)}</td><td>{months(r.date10Before, r.date10)}</td><td /></tr>
            <tr><td>Same noise, rules off</td><td className="mono">{monthOf(r.rulesOffDate10)}</td><td>{months(r.date10Before, r.rulesOffDate10)}</td><td>luck</td></tr>
            <tr><td>No events, no noise</td><td className="mono">{monthOf(r.noEventsDate10)}</td><td>{months(r.date10Before, r.noEventsDate10)}</td><td>time passing</td></tr>
            <tr><td>P(AI catastrophe by 2100)</td><td className="mono">{pct(r.startAnchors.cat2100, 1)}</td><td>→</td><td className="mono">{pct(r.anchors.cat2100, 1)}</td></tr>
            <tr><td>P(powerful AI by 2030)</td><td className="mono">{pct(r.startAnchors.asi2030)}</td><td>→</td><td className="mono">{pct(r.anchors.asi2030)}</td></tr>
          </tbody></table>
          <p className="mf-live-note">Simulated odds moved by the engine's labelled rules, not by any market. The real clock on the World tab never moves. Run: {run.run?.wall_s ?? '–'} s, ${run.run?.cost_usd ?? '–'}; readout and rubric ${r.llmCost}.</p>
        </section>
      </>}
      <section>
        <h3>Log</h3>
        <div className="mf-live-log">{run.log.map((l, i) => <div key={i}><span className="mono">{hms(l.t)}</span> {l.msg}</div>)}</div>
      </section>
    </div>
  )
}
