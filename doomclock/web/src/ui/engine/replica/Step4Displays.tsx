// The four tool-result displays of MiroFish's Step 4 (Deep Insight, Panorama Search, Agent Interview, Quick
// Search), ported from the render-function components in Step4Report.vue. Same tabs, counts, limits and labels.
import { useState, type ReactNode } from 'react'
import { t } from './i18n.ts'
import { renderMarkdown, type InsightResult, type InterviewResult, type PanoramaResult, type QuickResult } from './Step4Parse.ts'

type Cls = string | false | null | undefined | Record<string, boolean | undefined>
/** Class names with the replica's Step 4 prefix: c('fact-item', { active: on }) -> "mf-s4-fact-item mf-s4-active". */
export const c = (...a: Cls[]): string =>
  a.flatMap((x) => (!x ? [] : typeof x === 'string' ? x.split(' ') : Object.entries(x).filter(([, on]) => on).map(([k]) => k))).filter(Boolean).map((k) => 'mf-s4-' + k).join(' ')

const formatSize = (length?: number) => (!length ? '' : length >= 1000 ? `${(length / 1000).toFixed(1)}k chars` : `${length} chars`)
const INITIAL = 5

function Stats({ items, size }: { items: [ReactNode, string][]; size?: number }) {
  return (
    <div className={c('header-stats')}>
      {items.map(([v, label], i) => (
        <span key={label} style={{ display: 'contents' }}>
          {i > 0 && <span className={c('stat-divider')}>/</span>}
          <span className={c('stat-item')}><span className={c('stat-value')}>{v}</span><span className={c('stat-label')}>{label}</span></span>
        </span>
      ))}
      {size ? <><span className={c('stat-divider')}>·</span><span className={c('stat-size')}>{formatSize(size)}</span></> : null}
    </div>
  )
}

function Expand({ shown, total, onToggle, all }: { shown: boolean; total: number; onToggle: () => void; all?: 'entities' }) {
  return <button className={c('expand-btn')} onClick={onToggle}>{shown ? t('step4.collapse') : t(all === 'entities' ? 'step4.expandAllEntities' : 'step4.expandAll', { count: total })}</button>
}

function Facts({ facts, shown, cls }: { facts: string[]; shown: boolean; cls?: string }) {
  return (
    <div className={c('facts-list')}>
      {(shown ? facts : facts.slice(0, INITIAL)).map((fact, i) => {
        const tm = cls === 'historical' ? fact.match(/^\[(.+?)\]\s*(.*)$/) : null
        return (
          <div key={i} className={c('fact-item', cls)}>
            <span className={c('fact-number')}>{i + 1}</span>
            <div className={c('fact-content')}>
              {tm ? <><span className={c('fact-time')}>{tm[1]}</span><span className={c('fact-text')}>{tm[2]}</span></> : cls === 'historical' ? <span className={c('fact-text')}>{fact}</span> : fact}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const PanelHead = ({ title, count }: { title: string; count: string }) => (
  <div className={c('panel-header')}><span className={c('panel-title')}>{title}</span><span className={c('panel-count')}>{count}</span></div>
)

export function InsightDisplay({ result, resultLength }: { result: InsightResult; resultLength?: number }) {
  const [tab, setTab] = useState<'facts' | 'entities' | 'relations' | 'subqueries'>('facts')
  const [xf, setXf] = useState(false), [xe, setXe] = useState(false), [xr, setXr] = useState(false)
  const tabs: ['facts' | 'entities' | 'relations' | 'subqueries', string, boolean][] = [
    ['facts', t('step4.tabKeyFacts', { count: result.facts.length }), true],
    ['entities', t('step4.tabCoreEntities', { count: result.entities.length }), true],
    ['relations', t('step4.tabRelationChains', { count: result.relations.length }), true],
    ['subqueries', t('step4.tabSubQueries', { count: result.subQueries.length }), result.subQueries.length > 0],
  ]
  return (
    <div className={c('insight-display', 'dx')}>
      <div className={c('insight-header')}>
        <div className={c('header-main')}>
          <div className={c('header-title')}>Deep Insight</div>
          <Stats size={resultLength} items={[[result.stats.facts || result.facts.length, 'Facts'], [result.stats.entities || result.entities.length, 'Entities'], [result.stats.relationships || result.relations.length, 'Relations']]} />
        </div>
        {result.query && <div className={c('header-topic')}>{result.query}</div>}
        {result.simulationRequirement && <div className={c('header-scenario')}><span className={c('scenario-label')}>{t('step4.scenarioLabel')}</span><span className={c('scenario-text')}>{result.simulationRequirement}</span></div>}
      </div>
      <div className={c('insight-tabs')}>
        {tabs.filter((x) => x[2]).map(([k, label]) => <button key={k} className={c('insight-tab', { active: tab === k })} onClick={() => setTab(k)}><span className={c('tab-label')}>{label}</span></button>)}
      </div>
      <div className={c('insight-content')}>
        {tab === 'facts' && result.facts.length > 0 && (
          <div className={c('facts-panel')}>
            <PanelHead title={t('step4.panelKeyFacts')} count={t('step4.totalCount', { count: result.facts.length })} />
            <Facts facts={result.facts} shown={xf} />
            {result.facts.length > INITIAL && <Expand shown={xf} total={result.facts.length} onToggle={() => setXf(!xf)} />}
          </div>
        )}
        {tab === 'entities' && result.entities.length > 0 && (
          <div className={c('entities-panel')}>
            <PanelHead title={t('step4.panelCoreEntities')} count={t('step4.totalEntityCount', { count: result.entities.length })} />
            <div className={c('entities-grid')}>
              {(xe ? result.entities : result.entities.slice(0, 12)).map((e, i) => (
                <div key={i} className={c('entity-tag')} title={e.summary || ''}>
                  <span className={c('entity-name')}>{e.name}</span><span className={c('entity-type')}>{e.type}</span>
                  {e.relatedFactsCount > 0 && <span className={c('entity-fact-count')}>{t('step4.factCount', { count: e.relatedFactsCount })}</span>}
                </div>
              ))}
            </div>
            {result.entities.length > 12 && <Expand all="entities" shown={xe} total={result.entities.length} onToggle={() => setXe(!xe)} />}
          </div>
        )}
        {tab === 'relations' && result.relations.length > 0 && (
          <div className={c('relations-panel')}>
            <PanelHead title={t('step4.panelRelationChains')} count={t('step4.totalCount', { count: result.relations.length })} />
            <div className={c('relations-list')}>
              {(xr ? result.relations : result.relations.slice(0, INITIAL)).map((r, i) => (
                <div key={i} className={c('relation-item')}>
                  <span className={c('rel-source')}>{r.source}</span>
                  <span className={c('rel-arrow')}><span className={c('rel-line')} /><span className={c('rel-label')}>{r.relation}</span><span className={c('rel-line')} /></span>
                  <span className={c('rel-target')}>{r.target}</span>
                </div>
              ))}
            </div>
            {result.relations.length > INITIAL && <Expand shown={xr} total={result.relations.length} onToggle={() => setXr(!xr)} />}
          </div>
        )}
        {tab === 'subqueries' && result.subQueries.length > 0 && (
          <div className={c('subqueries-panel')}>
            <PanelHead title={t('step4.panelSubQueries')} count={t('step4.totalEntityCount', { count: result.subQueries.length })} />
            <div className={c('subqueries-list')}>
              {result.subQueries.map((sq, i) => <div key={i} className={c('subquery-item')}><span className={c('subquery-number')}>Q{i + 1}</span><div className={c('subquery-text')}>{sq}</div></div>)}
            </div>
          </div>
        )}
        {tab === 'facts' && result.facts.length === 0 && <div className={c('empty-state')}>{t('step4.emptyKeyFacts')}</div>}
        {tab === 'entities' && result.entities.length === 0 && <div className={c('empty-state')}>{t('step4.emptyCoreEntities')}</div>}
        {tab === 'relations' && result.relations.length === 0 && <div className={c('empty-state')}>{t('step4.emptyRelationChains')}</div>}
      </div>
    </div>
  )
}

export function PanoramaDisplay({ result, resultLength }: { result: PanoramaResult; resultLength?: number }) {
  const [tab, setTab] = useState<'active' | 'historical' | 'entities'>('active')
  const [xa, setXa] = useState(false), [xh, setXh] = useState(false), [xe, setXe] = useState(false)
  return (
    <div className={c('panorama-display', 'dx')}>
      <div className={c('panorama-header')}>
        <div className={c('header-main')}>
          <div className={c('header-title')}>Panorama Search</div>
          <Stats size={resultLength} items={[[result.stats.nodes, 'Nodes'], [result.stats.edges, 'Edges']]} />
        </div>
        {result.query && <div className={c('header-topic')}>{result.query}</div>}
      </div>
      <div className={c('panorama-tabs')}>
        <button className={c('panorama-tab', { active: tab === 'active' })} onClick={() => setTab('active')}><span className={c('tab-label')}>{t('step4.tabActiveFacts', { count: result.activeFacts.length })}</span></button>
        <button className={c('panorama-tab', { active: tab === 'historical' })} onClick={() => setTab('historical')}><span className={c('tab-label')}>{t('step4.tabHistoricalFacts', { count: result.historicalFacts.length })}</span></button>
        <button className={c('panorama-tab', { active: tab === 'entities' })} onClick={() => setTab('entities')}><span className={c('tab-label')}>{t('step4.tabEntities', { count: result.entities.length })}</span></button>
      </div>
      <div className={c('panorama-content')}>
        {tab === 'active' && (
          <div className={c('facts-panel', 'active-facts')}>
            <PanelHead title={t('step4.panelActiveFacts')} count={t('step4.totalCount', { count: result.activeFacts.length })} />
            {result.activeFacts.length > 0 ? <Facts facts={result.activeFacts} shown={xa} cls="active" /> : <div className={c('empty-state')}>{t('step4.emptyActiveFacts')}</div>}
            {result.activeFacts.length > INITIAL && <Expand shown={xa} total={result.activeFacts.length} onToggle={() => setXa(!xa)} />}
          </div>
        )}
        {tab === 'historical' && (
          <div className={c('facts-panel', 'historical-facts')}>
            <PanelHead title={t('step4.panelHistoricalFacts')} count={t('step4.totalCount', { count: result.historicalFacts.length })} />
            {result.historicalFacts.length > 0 ? <Facts facts={result.historicalFacts} shown={xh} cls="historical" /> : <div className={c('empty-state')}>{t('step4.emptyHistoricalFacts')}</div>}
            {result.historicalFacts.length > INITIAL && <Expand shown={xh} total={result.historicalFacts.length} onToggle={() => setXh(!xh)} />}
          </div>
        )}
        {tab === 'entities' && (
          <div className={c('entities-panel')}>
            <PanelHead title={t('step4.panelEntities')} count={t('step4.totalEntityCount', { count: result.entities.length })} />
            {result.entities.length > 0 ? (
              <div className={c('entities-grid')}>
                {(xe ? result.entities : result.entities.slice(0, 8)).map((e, i) => <div key={i} className={c('entity-tag')}><span className={c('entity-name')}>{e.name}</span>{e.type && <span className={c('entity-type')}>{e.type}</span>}</div>)}
              </div>
            ) : <div className={c('empty-state')}>{t('step4.emptyEntities')}</div>}
            {result.entities.length > 8 && <Expand all="entities" shown={xe} total={result.entities.length} onToggle={() => setXe(!xe)} />}
          </div>
        )}
      </div>
    </div>
  )
}

const isPlaceholderText = (text?: string) => {
  if (!text) return true
  const s = text.trim()
  return s === '（该平台未获得回复）' || s === '(该平台未获得回复)' || s === '[无回复]'
}

// Splits a platform answer into one part per question ("问题X：" first, then "1. ").
function splitAnswerByQuestions(answerText: string, questionCount: number): string[] {
  if (!answerText || questionCount <= 0) return [answerText]
  if (isPlaceholderText(answerText)) return ['']
  const matches: { index: number; full: string }[] = []
  let m: RegExpExecArray | null
  const cn = /(?:^|[\r\n]+)问题(\d+)[：:]\s*/g
  while ((m = cn.exec(answerText)) !== null) matches.push({ index: m.index, full: m[0] })
  if (matches.length === 0) {
    const num = /(?:^|[\r\n]+)(\d+)\.\s+/g
    while ((m = num.exec(answerText)) !== null) matches.push({ index: m.index, full: m[0] })
  }
  if (matches.length <= 1) return [answerText.replace(/^问题\d+[：:]\s*/, '').replace(/^\d+\.\s+/, '').trim() || answerText]
  const parts = matches.map((cur, i) => answerText.substring(cur.index + cur.full.length, matches[i + 1]?.index ?? answerText.length).trim().replace(/[\r\n]+$/, '').trim())
  return parts.some((p) => p) ? parts : [answerText]
}

export function InterviewDisplay({ result, resultLength }: { result: InterviewResult; resultLength?: number }) {
  const [active, setActive] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [platform, setPlatform] = useState<Record<string, 'twitter' | 'reddit'>>({})
  const iv = result.interviews[active]
  const getAnswer = (i: typeof iv, qIdx: number, p: 'twitter' | 'reddit') => {
    const answer = p === 'twitter' ? i.twitterAnswer : i.redditAnswer || i.twitterAnswer
    if (!answer || isPlaceholderText(answer)) return answer || ''
    const answers = splitAnswerByQuestions(answer, i.questions?.length || 1)
    if (answers.length > 1 && qIdx < answers.length) return answers[qIdx] || ''
    return qIdx === 0 ? answer : ''
  }
  const dual = (i: typeof iv, qIdx: number) => {
    if (!i.twitterAnswer || !i.redditAnswer) return false
    const a = getAnswer(i, qIdx, 'twitter'), b = getAnswer(i, qIdx, 'reddit')
    return !isPlaceholderText(a) && !isPlaceholderText(b) && a !== b
  }
  const toggle = (k: string) => setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const formatAnswer = (text: string, open: boolean) => esc(open || text.length <= 400 ? text : text.substring(0, 400) + '...').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
  const cleanQuote = (s: string) => (s ? s.replace(/^\s*\d+[.、)）]\s*/, '').trim() : '')
  const questions = iv ? (iv.questions?.length > 0 ? iv.questions : [iv.question || 'No question available']) : []
  return (
    <div className={c('interview-display', 'dx')}>
      <div className={c('interview-header')}>
        <div className={c('header-main')}>
          <div className={c('header-title')}>Agent Interview</div>
          <div className={c('header-stats')}>
            <span className={c('stat-item')}><span className={c('stat-value')}>{result.successCount || result.interviews.length}</span><span className={c('stat-label')}>Interviewed</span></span>
            {result.totalCount > 0 && <><span className={c('stat-divider')}>/</span><span className={c('stat-item')}><span className={c('stat-value')}>{result.totalCount}</span><span className={c('stat-label')}>Total</span></span></>}
            {resultLength ? <><span className={c('stat-divider')}>·</span><span className={c('stat-size')}>{formatSize(resultLength)}</span></> : null}
          </div>
        </div>
        {result.topic && <div className={c('header-topic')}>{result.topic}</div>}
      </div>
      {result.interviews.length > 0 && (
        <div className={c('agent-tabs')}>
          {result.interviews.map((v, i) => (
            <button key={i} className={c('agent-tab', { active: active === i })} onClick={() => setActive(i)}>
              <span className={c('tab-avatar')}>{v.name ? v.name.charAt(0) : i + 1}</span>
              <span className={c('tab-name')}>{v.title || v.name || `Agent ${i + 1}`}</span>
            </button>
          ))}
        </div>
      )}
      {iv && (
        <div className={c('interview-detail')}>
          <div className={c('agent-profile')}>
            <div className={c('profile-avatar')}>{iv.name?.charAt(0) || 'A'}</div>
            <div className={c('profile-info')}>
              <div className={c('profile-name')}>{iv.name || 'Agent'}</div>
              <div className={c('profile-role')}>{iv.role || ''}</div>
              {iv.bio && <div className={c('profile-bio')}>{iv.bio}</div>}
            </div>
          </div>
          {iv.selectionReason && <div className={c('selection-reason')}><div className={c('reason-label')}>选择理由</div><div className={c('reason-content')}>{iv.selectionReason}</div></div>}
          <div className={c('qa-thread')}>
            {questions.map((q, qIdx) => {
              const key = `${active}-${qIdx}`
              const cur = platform[key] || 'twitter'
              const answer = getAnswer(iv, qIdx, cur)
              const open = expanded.has(key)
              const ph = isPlaceholderText(answer)
              return (
                <div key={qIdx} className={c('qa-pair')}>
                  <div className={c('qa-question')}>
                    <div className={c('qa-badge', 'q-badge')}>Q{qIdx + 1}</div>
                    <div className={c('qa-content')}><div className={c('qa-sender')}>Interviewer</div><div className={c('qa-text')}>{q}</div></div>
                  </div>
                  {answer && (
                    <div className={c('qa-answer', { 'answer-placeholder': ph })}>
                      <div className={c('qa-badge', 'a-badge')}>A{qIdx + 1}</div>
                      <div className={c('qa-content')}>
                        <div className={c('qa-answer-header')}>
                          <div className={c('qa-sender')}>{iv.name || 'Agent'}</div>
                          {dual(iv, qIdx) && (
                            <div className={c('platform-switch')}>
                              {(['twitter', 'reddit'] as const).map((p) => (
                                <button key={p} className={c('platform-btn', { active: cur === p })} onClick={(e) => { e.stopPropagation(); setPlatform({ ...platform, [key]: p }) }}>
                                  <svg className={c('platform-icon')} viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
                                    {p === 'twitter' ? <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></> : <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />}
                                  </svg>
                                  <span>{t(p === 'twitter' ? 'step4.world1' : 'step4.world2')}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={c('qa-text', 'answer-text', { 'placeholder-text': ph })} dangerouslySetInnerHTML={{ __html: ph ? esc(answer) : formatAnswer(answer, open) }} />
                        {!ph && answer.length > 400 && <button className={c('expand-answer-btn')} onClick={() => toggle(key)}>{open ? 'Show Less' : 'Show More'}</button>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {iv.quotes?.length > 0 && (
            <div className={c('quotes-section')}>
              <div className={c('quotes-header')}>Key Quotes</div>
              <div className={c('quotes-list')}>
                {iv.quotes.slice(0, 3).map((q, qi) => {
                  const cq = cleanQuote(q)
                  return <blockquote key={qi} className={c('quote-item')} dangerouslySetInnerHTML={{ __html: renderMarkdown(cq.length > 200 ? cq.substring(0, 200) + '...' : cq) }} />
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {result.summary && (
        <div className={c('summary-section')}>
          <div className={c('summary-header')}>Interview Summary</div>
          <div className={c('summary-content')} dangerouslySetInnerHTML={{ __html: renderMarkdown(result.summary.length > 500 ? result.summary.substring(0, 500) + '...' : result.summary) }} />
        </div>
      )}
    </div>
  )
}

export function QuickSearchDisplay({ result, resultLength }: { result: QuickResult; resultLength?: number }) {
  const [tab, setTab] = useState<'facts' | 'edges' | 'nodes'>('facts')
  const [xf, setXf] = useState(false)
  const hasEdges = result.edges.length > 0, hasNodes = result.nodes.length > 0, showTabs = hasEdges || hasNodes
  return (
    <div className={c('quick-search-display', 'dx')}>
      <div className={c('quicksearch-header')}>
        <div className={c('header-main')}>
          <div className={c('header-title')}>Quick Search</div>
          <Stats size={resultLength} items={[[result.count || result.facts.length, 'Results']]} />
        </div>
        {result.query && <div className={c('header-query')}><span className={c('query-label')}>{t('step4.searchLabel')}</span><span className={c('query-text')}>{result.query}</span></div>}
      </div>
      {showTabs && (
        <div className={c('quicksearch-tabs')}>
          <button className={c('quicksearch-tab', { active: tab === 'facts' })} onClick={() => setTab('facts')}><span className={c('tab-label')}>{t('step4.tabFacts', { count: result.facts.length })}</span></button>
          {hasEdges && <button className={c('quicksearch-tab', { active: tab === 'edges' })} onClick={() => setTab('edges')}><span className={c('tab-label')}>{t('step4.tabEdges', { count: result.edges.length })}</span></button>}
          {hasNodes && <button className={c('quicksearch-tab', { active: tab === 'nodes' })} onClick={() => setTab('nodes')}><span className={c('tab-label')}>{t('step4.tabNodes', { count: result.nodes.length })}</span></button>}
        </div>
      )}
      <div className={c('quicksearch-content', { 'no-tabs': !showTabs })}>
        {(!showTabs || tab === 'facts') && (
          <div className={c('facts-panel')}>
            {!showTabs && <PanelHead title={t('step4.panelSearchResults')} count={t('step4.totalCount', { count: result.facts.length })} />}
            {result.facts.length > 0 ? <Facts facts={result.facts} shown={xf} /> : <div className={c('empty-state')}>{t('step4.emptySearchResults')}</div>}
            {result.facts.length > INITIAL && <Expand shown={xf} total={result.facts.length} onToggle={() => setXf(!xf)} />}
          </div>
        )}
        {tab === 'edges' && hasEdges && (
          <div className={c('edges-panel')}>
            <PanelHead title={t('step4.panelRelatedEdges')} count={t('step4.totalCount', { count: result.edges.length })} />
            <div className={c('edges-list')}>
              {result.edges.map((e, i) => (
                <div key={i} className={c('edge-item')}>
                  <span className={c('edge-source')}>{e.source}</span>
                  <span className={c('edge-arrow')}><span className={c('edge-line')} /><span className={c('edge-label')}>{e.relation}</span><span className={c('edge-line')} /></span>
                  <span className={c('edge-target')}>{e.target}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'nodes' && hasNodes && (
          <div className={c('nodes-panel')}>
            <PanelHead title={t('step4.panelRelatedNodes')} count={t('step4.totalEntityCount', { count: result.nodes.length })} />
            <div className={c('nodes-grid')}>
              {result.nodes.map((n, i) => <div key={i} className={c('node-tag')}><span className={c('node-name')}>{n.name}</span>{n.type && <span className={c('node-type')}>{n.type}</span>}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
