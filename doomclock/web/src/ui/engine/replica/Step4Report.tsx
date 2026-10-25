// Step 4 of the MiroFish replica: the report. A clone of MiroFish's Step4Report.vue on the recorded report and
// its agent log (the finished state: nothing is polled). Left, the report; right, the workflow overview, the
// agent-log timeline and its tool results; below, the console output. The prose is SIMULATED, shown as written.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { t } from './i18n.ts'
import type { Step4Props } from './props.ts'
import type { AgentLogEntry } from './types.ts'
import { c, InsightDisplay, InterviewDisplay, PanoramaDisplay, QuickSearchDisplay } from './Step4Displays.tsx'
import { parseInsightForge, parseInterview, parsePanorama, parseQuickSearch, renderMarkdown } from './Step4Parse.ts'
import './Step4Report.css'

const TOOLS: Record<string, { name: string; color: string; icon: string }> = {
  insight_forge: { name: 'Deep Insight', color: 'purple', icon: 'lightbulb' },
  panorama_search: { name: 'Panorama Search', color: 'blue', icon: 'globe' },
  interview_agents: { name: 'Agent Interview', color: 'green', icon: 'users' },
  quick_search: { name: 'Quick Search', color: 'orange', icon: 'zap' },
  get_graph_statistics: { name: 'Graph Stats', color: 'cyan', icon: 'chart' },
  get_entities_by_type: { name: 'Entity Query', color: 'pink', icon: 'database' },
}
const toolName = (n?: string) => (n && TOOLS[n]?.name) || n
const LABELS: Record<string, string> = {
  report_start: 'Report Started', planning_start: 'Planning', planning_complete: 'Plan Complete', section_start: 'Section Start',
  section_content: 'Content Ready', section_complete: 'Section Done', tool_call: 'Tool Call', tool_result: 'Tool Result',
  llm_response: 'LLM Response', report_complete: 'Complete',
}

const svg = (children: ReactNode, size = 14, cls?: string) => (
  <svg className={cls} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2}>{children}</svg>
)
const ICONS: Record<string, ReactNode> = {
  lightbulb: <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.5V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.5A7 7 0 0 0 12 2z" />,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>,
  tool: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
}

const formatTime = (ts: string) => {
  try { return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return '' }
}
const formatResultSize = (n?: number) => (!n ? '' : n < 1000 ? `${n} chars` : `${(n / 1000).toFixed(1)}k chars`)
const truncate = (s: string | undefined, max: number) => (!s ? '' : s.length <= max ? s : s.substring(0, max) + '...')
const logLevel = (l: string) => (l.includes('ERROR') || l.includes('错误') ? 'error' : l.includes('WARNING') || l.includes('警告') ? 'warning' : '')
const d = (log: AgentLogEntry) => log.details as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

interface OutlineSection { title: string; description?: string }
interface Step { key: string; noLabel: string; title: string; status: 'done' | 'active' | 'todo'; meta: string }

export function Step4Report({ step, onNext, onLog }: Step4Props) {
  const logs = step.agentLog
  const consoleLogs = step.consoleLog
  const reportId = step.report.report_id
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [raw, setRaw] = useState<Record<string, boolean>>({})
  const rightRef = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ btn: HTMLElement; top: number } | null>(null)

  // The finished state, derived from the log the way the Vue component builds it while polling.
  const { outline, generated, isComplete } = useMemo(() => {
    let outline: { title?: string; summary?: string; sections: OutlineSection[] } | null = null
    const generated: Record<number, string> = {}
    let done = false
    for (const l of logs) {
      if (l.action === 'planning_complete' && d(l)?.outline) outline = d(l).outline
      if (l.action === 'section_complete' && d(l)?.content && l.section_index != null) generated[l.section_index] = d(l).content
      if (l.action === 'report_complete') done = true
    }
    return { outline, generated, isComplete: done }
  }, [logs])

  const total = outline?.sections?.length || 0
  const completed = Object.keys(generated).length
  const toolCalls = logs.filter((l) => l.action === 'tool_call').length
  const elapsed = logs.length ? logs[logs.length - 1].elapsed_seconds || 0 : 0
  const elapsedText = logs.length === 0 ? '0s' : elapsed < 60 ? `${Math.round(elapsed)}s` : `${Math.floor(elapsed / 60)}m ${Math.round(elapsed % 60)}s`
  const statusClass = isComplete ? 'completed' : logs.length > 0 ? 'processing' : 'pending'
  const statusText = isComplete ? 'Completed' : logs.length > 0 ? 'Generating...' : 'Waiting'

  const steps: Step[] = useMemo(() => {
    const planningDone = !!outline?.sections?.length || logs.some((l) => l.action === 'planning_complete')
    const planningStarted = logs.some((l) => l.action === 'planning_start' || l.action === 'report_start')
    const finalizing = !isComplete && planningDone && total > 0 && completed >= total
    const activeIdx = isComplete ? null : total > 0 && completed < total ? completed + 1 : null
    const out: Step[] = [{ key: 'planning', noLabel: 'PL', title: 'Planning / Outline', status: planningDone ? 'done' : planningStarted ? 'active' : 'todo', meta: !planningDone && planningStarted ? 'IN PROGRESS' : '' }]
    ;(outline?.sections || []).forEach((s, i) => {
      const idx = i + 1
      const status = isComplete || generated[idx] ? 'done' : activeIdx === idx ? 'active' : 'todo'
      out.push({ key: `section-${idx}`, noLabel: String(idx).padStart(2, '0'), title: s.title, status, meta: status === 'active' ? 'IN PROGRESS' : '' })
    })
    const cs = isComplete ? 'done' : finalizing ? 'active' : 'todo'
    out.push({ key: 'complete', noLabel: 'OK', title: 'Complete', status: cs, meta: cs === 'active' ? 'FINALIZING' : '' })
    return out
  }, [logs, outline, generated, isComplete, total, completed])
  const activeStep = steps.find((s) => s.status === 'active') ?? [...steps].reverse().find((s) => s.status === 'done') ?? steps[0]

  // Keep a clicked "Raw Output" button where it was on screen when the result below it changes height.
  useLayoutEffect(() => {
    const a = anchor.current
    if (a && rightRef.current) { rightRef.current.scrollTop += a.btn.getBoundingClientRect().top - a.top; anchor.current = null }
  }, [raw])

  const toggleExpand = (ts: string) => setExpandedLogs((s) => { const n = new Set(s); if (n.has(ts)) n.delete(ts); else n.add(ts); return n })
  const toggleRaw = (ts: string, e: React.MouseEvent<HTMLElement>) => {
    anchor.current = { btn: e.currentTarget, top: e.currentTarget.getBoundingClientRect().top }
    setRaw((r) => ({ ...r, [ts]: !r[ts] }))
  }
  const toggleSection = (idx: number) => {
    if (!generated[idx + 1]) return
    setCollapsed((s) => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
  }
  const isLogCollapsed = (l: AgentLogEntry) => ['tool_call', 'tool_result', 'llm_response'].includes(l.action) && !expandedLogs.has(l.timestamp)

  const resultBody = (l: AgentLogEntry) => {
    const name = d(l).tool_name as string | undefined, res = d(l).result as string | undefined, len = d(l).result_length as number | undefined
    if (name === 'interview_agents') return <InterviewDisplay result={parseInterview(res || '')} resultLength={len} />
    if (name === 'insight_forge') return <InsightDisplay result={parseInsightForge(res || '')} resultLength={len} />
    if (name === 'panorama_search') return <PanoramaDisplay result={parsePanorama(res || '')} resultLength={len} />
    if (name === 'quick_search') return <QuickSearchDisplay result={parseQuickSearch(res || '')} resultLength={len} />
    return <pre className={c('raw-preview')}>{truncate(res, 300)}</pre>
  }

  const body = (l: AgentLogEntry) => {
    const x = d(l)
    switch (l.action) {
      case 'report_start':
        return <>
          <div className={c('info-row')}><span className={c('info-key')}>Simulation</span><span className={c('info-val', 'mono')}>{x?.simulation_id}</span></div>
          {x?.simulation_requirement && <div className={c('info-row')}><span className={c('info-key')}>Requirement</span><span className={c('info-val')}>{x.simulation_requirement}</span></div>}
        </>
      case 'planning_start': return <div className={c('status-message', 'planning')}>{x?.message}</div>
      case 'planning_complete': return <>
        <div className={c('status-message', 'success')}>{x?.message}</div>
        {x?.outline && <div className={c('outline-badge')}>{x.outline.sections?.length || 0} sections planned</div>}
      </>
      case 'section_start': return <div className={c('section-tag')}><span className={c('tag-num')}>#{l.section_index}</span><span className={c('tag-title')}>{l.section_title}</span></div>
      case 'section_content': return <div className={c('section-tag', 'content-ready')}>{svg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>)}<span className={c('tag-title')}>{l.section_title}</span></div>
      case 'section_complete': return <div className={c('section-tag', 'completed')}>{svg(<polyline points="20 6 9 17 4 12" />)}<span className={c('tag-title')}>{l.section_title}</span></div>
      case 'tool_call': {
        const cfg = TOOLS[x?.tool_name]
        return <>
          <div className={c('tool-badge', 'tool-' + (cfg?.color || 'gray'))}>{svg(ICONS[cfg?.icon || 'tool'], 14, c('tool-icon'))}{toolName(x?.tool_name)}</div>
          {x?.parameters && expandedLogs.has(l.timestamp) && <div className={c('tool-params')}><pre>{JSON.stringify(x.parameters, null, 2)}</pre></div>}
        </>
      }
      case 'tool_result': {
        const hideMeta = ['interview_agents', 'insight_forge', 'panorama_search', 'quick_search'].includes(x?.tool_name)
        return (
          <div className={c('result-wrapper', 'result-' + x?.tool_name)}>
            {!hideMeta && <div className={c('result-meta')}><span className={c('result-tool')}>{toolName(x?.tool_name)}</span><span className={c('result-size')}>{formatResultSize(x?.result_length)}</span></div>}
            {!raw[l.timestamp] ? <div className={c('result-structured')}>{resultBody(l)}</div> : <div className={c('result-raw')}><pre>{x?.result}</pre></div>}
          </div>
        )
      }
      case 'llm_response': return <>
        <div className={c('llm-meta')}>
          <span className={c('meta-tag')}>Iteration {x?.iteration}</span>
          <span className={c('meta-tag', { active: !!x?.has_tool_calls })}>Tools: {x?.has_tool_calls ? 'Yes' : 'No'}</span>
          <span className={c('meta-tag', { active: !!x?.has_final_answer, 'final-answer': !!x?.has_final_answer })}>Final: {x?.has_final_answer ? 'Yes' : 'No'}</span>
        </div>
        {x?.has_final_answer && <div className={c('final-answer-hint')}>{svg(<polyline points="20 6 9 17 4 12" />)}<span>Section "{l.section_title}" content generated</span></div>}
        {expandedLogs.has(l.timestamp) && x?.response && <div className={c('llm-content')}><pre>{x.response}</pre></div>}
      </>
      case 'report_complete': return <div className={c('complete-banner')}>{svg(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>, 20)}<span>Report Generation Complete</span></div>
      default: return null
    }
  }

  return (
    <div className={c('report-panel')}>
      <div className={c('main-split-layout')}>
        <div className={c('left-panel', 'report-style')}>
          {outline ? (
            <div className={c('report-content-wrapper')}>
              <div className={c('report-header-block')}>
                <div className={c('report-meta')}>
                  <span className={c('report-tag')}>Prediction Report</span>
                  <span className={c('sim-tag')}>SIMULATED</span>
                  <span className={c('report-id')}>ID: {reportId || 'REF-2024-X92'}</span>
                </div>
                <h1 className={c('main-title')}>{outline.title}</h1>
                <p className={c('sub-title')}>{outline.summary}</p>
                <div className={c('header-divider')} />
              </div>
              <div className={c('sections-list')}>
                {outline.sections.map((s, idx) => {
                  const done = !!generated[idx + 1]
                  return (
                    <div key={idx} className={c('report-section-item', { 'is-completed': done, 'is-pending': !done })}>
                      <div className={c('section-header-row', { clickable: done })} onClick={() => toggleSection(idx)}>
                        <span className={c('section-number')}>{String(idx + 1).padStart(2, '0')}</span>
                        <h3 className={c('section-title')}>{s.title}</h3>
                        {done && <svg className={c('collapse-icon', { 'is-collapsed': collapsed.has(idx) })} viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9" /></svg>}
                      </div>
                      <div className={c('section-body')} style={collapsed.has(idx) ? { display: 'none' } : undefined}>
                        {done && <div className={c('generated-content')} dangerouslySetInnerHTML={{ __html: renderMarkdown(generated[idx + 1]) }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className={c('waiting-placeholder')}>
              <div className={c('waiting-animation')}><div className={c('waiting-ring')} /><div className={c('waiting-ring')} /><div className={c('waiting-ring')} /></div>
              <span className={c('waiting-text')}>Waiting for Report Agent...</span>
            </div>
          )}
        </div>

        <div className={c('right-panel')} ref={rightRef}>
          {!isComplete && (
            <div className={c('panel-header', 'panel-header--' + activeStep.status)}>
              {activeStep.status === 'active' && <span className={c('header-dot')} />}
              <span className={c('header-index', 'mono')}>{activeStep.noLabel}</span>
              <span className={c('header-title')}>{activeStep.title}</span>
              {activeStep.meta && <span className={c('header-meta', 'mono')}>{activeStep.meta}</span>}
            </div>
          )}
          {(logs.length > 0 || outline) && (
            <div className={c('workflow-overview')}>
              <div className={c('workflow-metrics')}>
                <div className={c('metric')}><span className={c('metric-label')}>Sections</span><span className={c('metric-value', 'mono')}>{completed}/{total}</span></div>
                <div className={c('metric')}><span className={c('metric-label')}>Elapsed</span><span className={c('metric-value', 'mono')}>{elapsedText}</span></div>
                <div className={c('metric')}><span className={c('metric-label')}>Tools</span><span className={c('metric-value', 'mono')}>{toolCalls}</span></div>
                <div className={c('metric', 'metric-right')}><span className={c('metric-pill', 'pill--' + statusClass)}>{statusText}</span></div>
              </div>
              {steps.length > 0 && (
                <div className={c('workflow-steps')}>
                  {steps.map((s, i) => (
                    <div key={s.key} className={c('wf-step', 'wf-step--' + s.status)}>
                      <div className={c('wf-step-connector')}><div className={c('wf-step-dot')} />{i < steps.length - 1 && <div className={c('wf-step-line')} />}</div>
                      <div className={c('wf-step-content')}>
                        <div className={c('wf-step-title-row')}>
                          <span className={c('wf-step-index', 'mono')}>{s.noLabel}</span><span className={c('wf-step-title')}>{s.title}</span>
                          {s.meta && <span className={c('wf-step-meta', 'mono')}>{s.meta}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isComplete && (
                <button className={c('next-step-btn')} onClick={() => { onLog('Entering Step 5: ' + t('step4.goToInteraction')); onNext() }}>
                  <span>{t('step4.goToInteraction')}</span>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              )}
              <div className={c('workflow-divider')} />
            </div>
          )}

          <div className={c('workflow-timeline')}>
            {logs.map((l, idx) => {
              const latest = idx === logs.length - 1 && !isComplete
              const milestone = l.action === 'section_complete' || l.action === 'report_complete'
              const x = d(l)
              const footer = l.elapsed_seconds || (l.action === 'tool_call' && x?.parameters) || l.action === 'tool_result' || (l.action === 'llm_response' && x?.response)
              return (
                <div key={l.timestamp + '-' + idx} className={c('timeline-item', { 'node--active': latest, 'node--done': !latest && milestone, 'node--muted': !latest && !milestone, 'node--tool': l.action === 'tool_call' || l.action === 'tool_result' })}>
                  <div className={c('timeline-connector')}>
                    <div className={c('connector-dot', latest ? 'dot-active' : milestone ? 'dot-done' : 'dot-muted')} />
                    {idx < logs.length - 1 && <div className={c('connector-line')} />}
                  </div>
                  <div className={c('timeline-content')}>
                    <div className={c('timeline-header')}><span className={c('action-label')}>{LABELS[l.action] || l.action}</span><span className={c('action-time')}>{formatTime(l.timestamp)}</span></div>
                    <div className={c('timeline-body', { collapsed: isLogCollapsed(l) })} onClick={() => toggleExpand(l.timestamp)}>{body(l)}</div>
                    {footer ? (
                      <div className={c('timeline-footer')}>
                        {l.elapsed_seconds ? <span className={c('elapsed-badge')}>+{l.elapsed_seconds.toFixed(1)}s</span> : <span className={c('elapsed-placeholder')} />}
                        <div className={c('footer-actions')}>
                          {l.action === 'tool_call' && x?.parameters && <button className={c('action-btn')} onClick={(e) => { e.stopPropagation(); toggleExpand(l.timestamp) }}>{expandedLogs.has(l.timestamp) ? 'Hide Params' : 'Show Params'}</button>}
                          {l.action === 'tool_result' && <button className={c('action-btn')} onClick={(e) => { e.stopPropagation(); toggleRaw(l.timestamp, e) }}>{raw[l.timestamp] ? 'Structured View' : 'Raw Output'}</button>}
                          {l.action === 'llm_response' && x?.response && <button className={c('action-btn')} onClick={(e) => { e.stopPropagation(); toggleExpand(l.timestamp) }}>{expandedLogs.has(l.timestamp) ? 'Hide Response' : 'Show Response'}</button>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {logs.length === 0 && !isComplete && <div className={c('workflow-empty')}><div className={c('empty-pulse')} /><span>Waiting for agent activity...</span></div>}
          </div>
        </div>
      </div>

      <div className={c('console-logs')}>
        <div className={c('log-header')}><span className={c('log-title')}>CONSOLE OUTPUT</span><span className={c('log-id')}>{reportId || 'NO_REPORT'}</span></div>
        <div className={c('log-content')} ref={(el) => { if (el) el.scrollTop = el.scrollHeight }}>
          {consoleLogs.map((l, i) => <div key={i} className={c('log-line')}><span className={c('log-msg', logLevel(l))}>{l}</span></div>)}
        </div>
      </div>
    </div>
  )
}
